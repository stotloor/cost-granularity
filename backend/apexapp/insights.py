"""Insight engine over the cost-granularity data in PostgreSQL (see pgsource.py).

Joins the three grains described in P&A-REQ-001:
  commercial approval grain  - PO Summary (one summary line per PO)
  financial posting grain    - SAP Data (YTD actuals by project / WBS element)
  analytical reporting grain - Actual Allocation (PO -> WBS split) and Copperleaf
                               (regulatory investment -> SAP project, % of WBS)
and derives KPIs, drill-downs, data-quality control totals and rule-based exceptions
mapped to requirement IDs. The sheet names below are the workbook's; pgsource.py
maps each to the table or view that now holds it.

    python3 -m apexapp.insights                 # print a summary
    python3 -m apexapp.insights --export out.json [--dsn postgresql://...]
"""
import datetime
import json
import os
import re
import sys
import threading
from collections import defaultdict

from . import pgsource
from .requirements import CATALOGUE

TOLERANCE = 0.5  # £ tolerance for arithmetic / reconciliation checks
LARGE_REVERSAL = 100_000  # single-period credit that counts as unexpected movement
MATERIAL_UNATTRIBUTED = 100_000

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}

# System-derived activity normalisation (GRN-009 "system-derived classification").
# Versioned so a mapping change is visible in the output (ACT-004).
ACTIVITY_MAPPING_VERSION = "v1-system-derived"
_TYPO_FIXES = {
    "Affiars": "Affairs",
    "Evironmental": "Environmental",
    "Accomodation": "Accommodation",
}
_PLURAL_FIXES = {"NG Overheads": "NG Overhead"}
_NUMBER_PREFIX = re.compile(r"^\d+\.(?:\d+|PROJECT \d+)\s+")
_DUMMY_ACTIVITY = re.compile(r"dummy|pending correct", re.I)
_ANON_ZERO = "PROJECT 0001"  # anonymisation artefact that replaced '0' in some values


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _f(v):
    n = _num(v)
    return float(n) if n is not None else 0.0


def _r(v, nd=2):
    return round(v, nd) if isinstance(v, float) else v


def canonical_activity(desc):
    """Return (canonical activity, [rules applied]) for a raw WBS description."""
    raw = (desc or "").strip()
    out, rules = raw, []
    if _NUMBER_PREFIX.match(out):
        out = _NUMBER_PREFIX.sub("", out)
        rules.append("strip numbering prefix")
    for bad, good in _TYPO_FIXES.items():
        if bad in out:
            out = out.replace(bad, good)
            rules.append("spelling: %s -> %s" % (bad, good))
    if out in _PLURAL_FIXES:
        out = _PLURAL_FIXES[out]
        rules.append("singular form")
    return out or "(blank)", rules


def parse_amount(v):
    """Return (value or None, status, candidate) for a monetary cell.

    status: 'ok' | 'text' (numeric stored as text) | 'invalid' (quarantined) | 'blank'.
    candidate: best-effort recovery for invalid values, never used in totals.
    """
    if v is None or v == "":
        return None, "blank", None
    if _num(v) is not None:
        return float(v), "ok", None
    s = str(v).strip()
    try:
        return float(s), "text", None
    except ValueError:
        pass
    try:
        cand = float(s.replace(_ANON_ZERO, "0"))
    except ValueError:
        cand = None
    return None, "invalid", cand


_SAP_PROJECT = re.compile(r"^GT-P\d{4}$")


def _valid_project(v):
    # 'PROJECT 0280' in the anonymised extract, 'GT-P0280' in the database.
    return isinstance(v, str) and (v.startswith("PROJECT ") or bool(_SAP_PROJECT.match(v)))


def _wbs_sep(wbs):
    # Database WBS codes are dotted below the project (GT-P0280.01.02); the anonymised
    # extract used '-' between levels.
    return "." if "." in (wbs or "") else "-"


def _wbs_segments(wbs):
    return (wbs or "").split(_wbs_sep(wbs))


class Builder:
    def __init__(self, data):
        self.d = data
        self.exceptions = []
        self.checks = []

    # ------------------------------------------------------------------ helpers
    def exc(self, rule, req, severity, title, detail, entity_type, entity_id,
            project=None, owner=None, value=None, source=None):
        self.exceptions.append({
            "id": "EXC-%03d" % (len(self.exceptions) + 1),
            "rule": rule, "requirement": req, "severity": severity, "title": title,
            "detail": detail, "entity_type": entity_type, "entity_id": entity_id,
            "project": project, "owner": owner, "value": _r(value), "source": source,
        })

    def check(self, group, name, requirement, expected, actual, ok, detail="", status=None):
        self.checks.append({
            "group": group, "check": name, "requirement": requirement,
            "expected": _r(expected), "actual": _r(actual),
            "difference": _r(actual - expected) if _num(expected) is not None and _num(actual) is not None else None,
            "status": status or ("pass" if ok else "fail"), "detail": detail,
        })

    # ------------------------------------------------------------------ SAP
    def build_sap(self):
        rows = self.d["SAP Data"]["records"]
        periods_used = [i for i in range(1, 13) if any(_num(r["p%d" % i]) is not None for r in rows)]
        self.periods_used = periods_used
        wbs_rows = []
        for r in rows:
            ytd = _f(r["ytd_total"])
            per = [_f(r["p%d" % i]) for i in periods_used]
            canon, rules = canonical_activity(r["wbs_description"])
            seg = _wbs_segments(r["wbs"])
            w = {
                "row": r["_row"], "project": r["project"], "project_name": r["project_name"],
                "wbs": r["wbs"], "wbs_description": r["wbs_description"], "activity": canon,
                "activity_rules": rules, "level": len(seg), "ytd": ytd, "periods": per,
                "period_sum": sum(per), "reg_activity": r["reg_activity"],
                "reg_activity_description": r["reg_activity_description"],
                "dummy_activity": bool(_DUMMY_ACTIVITY.search(r["reg_activity_description"] or "")),
                "person_responsible": r["person_responsible"], "initiative_id": r["initiative_id"],
                "scheme_ref": r["scheme_ref"], "company_code": r["company_code"],
                "object_class": r["object_class"], "in_copperleaf_flag": r["in_copperleaf"],
                "flags": [],
            }
            wbs_rows.append(w)
        self.sap = wbs_rows
        self.sap_by_wbs = {w["wbs"]: w for w in wbs_rows}
        self.sap_total = sum(w["ytd"] for w in wbs_rows)

    # ------------------------------------------------------------------ Copperleaf
    def build_copperleaf(self):
        rows = self.d["Copperleaf Data"]["records"]
        invs = []
        for r in rows:
            ecc, ecc_status, cand = parse_amount(r["ecc"])
            pct = _num(r["pct_of_wbs"])
            sap_project = r["sap_project"]
            if _valid_project(sap_project) and pct and pct > 0:
                link = "linked"
            elif sap_project in (None, ""):
                link = "no SAP project"
            else:
                link = "invalid reference"
            invs.append({
                "row": r["_row"], "investment_code": r["investment_code"],
                "investment_name": r["investment_name"], "area": r["area"],
                "facility": r["facility"], "site": r["site"], "site_id": r["site_id"],
                "submission_id": r["submission_id"] or r["inv_id_code"],
                "submission_id_raw": r["submission_id"], "inv_id_code": r["inv_id_code"],
                "submission_volume": r["submission_volume"], "investment_volume": r["investment_volume"],
                "price_base": r["price_base"], "product": r["product"],
                "funding_position": r["funding_position"], "intervention_driver": r["intervention_driver"],
                "sap_project": sap_project if _valid_project(sap_project) else None,
                "sap_project_raw": sap_project, "pct_of_wbs": pct, "link_status": link,
                "ecc": ecc, "ecc_raw": r["ecc"] if ecc_status in ("text", "invalid") else None,
                "ecc_status": ecc_status, "ecc_candidate": cand, "ecc_counted": 0.0,
                "pac_code": r["pac_code"], "attributed_actual": None, "flags": [],
            })
        # De-duplicate the submission-level ECC that is repeated on several investment rows.
        groups = defaultdict(list)
        for i in invs:
            groups[i["submission_id"]].append(i)
        submissions = []
        for sid, members in groups.items():
            seen = set()
            naive = 0.0
            for m in members:
                if m["ecc"]:
                    naive += m["ecc"]
                    key = round(m["ecc"], 2)
                    if key in seen:
                        m["flags"].append("duplicate ECC")
                    else:
                        seen.add(key)
                        m["ecc_counted"] = m["ecc"]
            dedup = sum(m["ecc_counted"] for m in members)
            submissions.append({
                "submission_id": sid, "investment_count": len(members),
                "ecc_naive": naive, "ecc": dedup, "duplicate_exposure": naive - dedup,
                "price_bases": sorted({m["price_base"] for m in members if m["price_base"]}),
                "products": sorted({m["product"] for m in members if m["product"]}),
                "drivers": sorted({m["intervention_driver"] for m in members if m["intervention_driver"]}),
                "funding_positions": sorted({m["funding_position"] for m in members if m["funding_position"]}),
                "sap_projects": sorted({m["sap_project"] for m in members if m["sap_project"]}),
                "quarantined": [m["investment_code"] for m in members if m["ecc_status"] == "invalid"],
                "investments": [m["investment_code"] for m in members],
            })
        self.invs = invs
        self.submissions = submissions

    # ------------------------------------------------------------------ attribution
    def build_attribution(self):
        sap_projects = defaultdict(float)
        for w in self.sap:
            sap_projects[w["project"]] += w["ytd"]
        self.sap_project_totals = sap_projects
        links = defaultdict(list)
        for i in self.invs:
            if i["link_status"] == "linked":
                links[i["sap_project"]].append(i)
                if i["sap_project"] in sap_projects:
                    i["attributed_actual"] = sap_projects[i["sap_project"]] * i["pct_of_wbs"] / 100.0
        self.inv_links = links
        for sub in self.submissions:
            members = [i for i in self.invs if i["submission_id"] == sub["submission_id"]]
            sub["attributed_actual"] = sum(i["attributed_actual"] or 0 for i in members)
            sub["spend_to_plan"] = (sub["attributed_actual"] / sub["ecc"]) if sub["ecc"] else None

    # ------------------------------------------------------------------ POs + allocations
    def build_pos(self):
        allocs = self.d["Actual Allocation"]["records"]
        by_wbs_alloc = defaultdict(float)
        for a in allocs:
            by_wbs_alloc[a["wbs"]] += _f(a["final_allocated"])
        self.alloc_by_wbs = by_wbs_alloc
        pos = []
        for p in self.d["PO Summary"]["records"]:
            lines = [a for a in allocs if a["po_number"] == p["po_number"]]
            value, posted = _f(p["po_value"]), _f(p["actual_posted"])
            out_lines = []
            for a in lines:
                sap = self.sap_by_wbs.get(a["wbs"])
                final = _f(a["final_allocated"])
                calc_expected = _f(a["allocation_pct"]) * _f(a["po_actual"])
                flags = []
                if not sap:
                    flags.append("WBS not in SAP extract")
                else:
                    if sap["project"] != a["project"]:
                        flags.append("project differs from SAP")
                    if sap["initiative_id"] != a["investment_id"]:
                        flags.append("investment ID differs from SAP")
                    if sap["dummy_activity"]:
                        flags.append("dummy regulatory activity")
                    if final > 0 and by_wbs_alloc[a["wbs"]] > sap["ytd"] + TOLERANCE:
                        flags.append("allocated > SAP posted")
                if abs(calc_expected - _f(a["calculated_allocation"])) > TOLERANCE:
                    flags.append("calculated allocation arithmetic")
                if abs(_f(a["calculated_allocation"]) + _f(a["manual_adjustment"]) - final) > TOLERANCE:
                    flags.append("final allocation arithmetic")
                if abs(_f(a["po_actual"]) - posted) > TOLERANCE:
                    flags.append("PO actual differs from PO Summary")
                canon, _ = canonical_activity(a["wbs_description"])
                out_lines.append({
                    "allocation_id": a["allocation_id"], "project": a["project"],
                    "project_name": a["project_name"], "wbs": a["wbs"],
                    "wbs_description": a["wbs_description"], "activity": canon,
                    "investment_id": a["investment_id"], "allocation_rule": a["allocation_rule"],
                    "allocation_pct": _f(a["allocation_pct"]), "po_actual": _f(a["po_actual"]),
                    "calculated_allocation": _f(a["calculated_allocation"]),
                    "manual_adjustment": _f(a["manual_adjustment"]), "final_allocated": final,
                    "rationale": a["rationale"], "review_status": a["review_status"],
                    "origin": "governed allocation (%s)" % (a["allocation_rule"] or "rule"),
                    "sap_ytd": sap["ytd"] if sap else None,
                    "sap_total_allocated": by_wbs_alloc[a["wbs"]],
                    "sap_coverage": (by_wbs_alloc[a["wbs"]] / sap["ytd"]) if sap and sap["ytd"] > 0 else None,
                    "reg_activity": sap["reg_activity"] if sap else None,
                    "reg_activity_description": sap["reg_activity_description"] if sap else None,
                    "person_responsible": sap["person_responsible"] if sap else None,
                    "investments": [
                        {"investment_code": i["investment_code"], "investment_name": i["investment_name"],
                         "pct_of_wbs": i["pct_of_wbs"], "submission_id": i["submission_id"]}
                        for i in self.inv_links.get(a["project"], [])
                    ],
                    "flags": flags,
                })
            alloc_pct = sum(l["allocation_pct"] for l in out_lines)
            alloc_total = sum(l["final_allocated"] for l in out_lines)
            projects = sorted({l["project"] for l in out_lines})
            by_project = []
            for proj in projects:
                pl = [l for l in out_lines if l["project"] == proj]
                by_project.append({
                    "project": proj, "project_name": pl[0]["project_name"],
                    "allocated": sum(l["final_allocated"] for l in pl), "wbs_count": len(pl),
                    "sap_ytd": self.sap_project_totals.get(proj),
                })
            checks = {
                "allocation_pct_total": alloc_pct,
                "allocation_pct_ok": abs(alloc_pct - 1.0) < 1e-6,
                "allocated_total": alloc_total,
                "allocated_matches_posted": abs(alloc_total - posted) <= TOLERANCE,
                "unallocated": posted - alloc_total,
                "stated_unallocated": _f(p["unallocated_difference"]),
                "stated_total_pct": _f(p["total_allocation_pct"]),
                "stated_allocated": _f(p["allocated_actual"]),
                "within_commitment": posted <= value + TOLERANCE,
            }
            pending = sum(1 for l in out_lines if (l["review_status"] or "").lower() != "approved")
            pos.append({
                "po_number": p["po_number"], "supplier_id": p["supplier_id"],
                "contract_ref": p["contract_ref"], "description": p["description"],
                "po_date": p["po_date"], "currency": p["currency"],
                "posting_level": p["posting_level"], "summary_cost_object": p["summary_cost_object"],
                "status": p["status"], "allocation_basis": p["allocation_basis"],
                "po_value": value, "actual_posted": posted, "remaining_commitment": value - posted,
                "consumed_pct": posted / value if value else None,
                "po_line_count": 1, "wbs_count": len(out_lines), "project_count": len(projects),
                "pending_review": pending, "projects": by_project, "allocations": out_lines,
                "checks": checks,
                "flag_count": sum(len(l["flags"]) for l in out_lines)
                + (0 if checks["allocation_pct_ok"] else 1)
                + (0 if checks["allocated_matches_posted"] else 1),
            })
        self.pos = pos

    # ------------------------------------------------------------------ projects + WBS tree
    def build_projects(self):
        projects = []
        cl_projects = {i["sap_project"] for i in self.invs if i["sap_project"]}
        for proj in sorted({w["project"] for w in self.sap}):
            rows = [w for w in self.sap if w["project"] == proj]
            first = rows[0]
            nodes = {}

            def node(path, label, level):
                if path not in nodes:
                    nodes[path] = {"id": path, "label": label, "level": level, "ytd": 0.0,
                                   "own_ytd": None, "description": None, "activity": None,
                                   "periods": [0.0] * len(self.periods_used), "children": [],
                                   "flags": [], "posting": False, "po_allocated": 0.0}
                return nodes[path]

            root_ids = []
            for w in rows:
                seg, sep = _wbs_segments(w["wbs"]), _wbs_sep(w["wbs"])
                for depth in range(1, len(seg) + 1):
                    path = sep.join(seg[:depth])
                    n = node(path, seg[depth - 1], depth)
                    n["ytd"] += w["ytd"]
                    n["po_allocated"] += self.alloc_by_wbs.get(w["wbs"], 0.0)
                    n["periods"] = [a + b for a, b in zip(n["periods"], w["periods"])]
                    if depth > 1:
                        parent = nodes[sep.join(seg[:depth - 1])]
                        if path not in parent["children"]:
                            parent["children"].append(path)
                    elif path not in root_ids:
                        root_ids.append(path)
                leaf = nodes[w["wbs"]]
                leaf.update(own_ytd=w["ytd"], description=w["wbs_description"],
                            activity=w["activity"], posting=True, flags=w["flags"])

            def materialise(pid):
                n = dict(nodes[pid])
                n["children"] = [materialise(c) for c in sorted(n["children"])]
                return n

            invs = self.inv_links.get(proj, [])
            attributed_pct = sum(i["pct_of_wbs"] for i in invs)
            total = sum(w["ytd"] for w in rows)
            dummy_value = sum(w["ytd"] for w in rows if w["dummy_activity"])
            projects.append({
                "project": proj, "project_name": first["project_name"],
                "person_responsible": first["person_responsible"],
                "initiative_id": first["initiative_id"], "scheme_ref": first["scheme_ref"],
                "company_code": first["company_code"],
                "reg_activities": sorted({(w["reg_activity"], w["reg_activity_description"]) for w in rows}),
                "dummy_activity": any(w["dummy_activity"] for w in rows),
                "dummy_activity_value": dummy_value,
                "ytd": total, "gross_debits": sum(w["ytd"] for w in rows if w["ytd"] > 0),
                "credits": sum(w["ytd"] for w in rows if w["ytd"] < 0),
                "periods": [sum(w["periods"][k] for w in rows) for k in range(len(self.periods_used))],
                "wbs_count": len(rows), "in_copperleaf": proj in cl_projects,
                "po_allocated": sum(self.alloc_by_wbs.get(w["wbs"], 0.0) for w in rows),
                "po_numbers": sorted({p["po_number"] for p in self.pos for l in p["allocations"] if l["project"] == proj}),
                "attributed_pct": attributed_pct, "attributed_actual": total * attributed_pct / 100.0,
                "unattributed_actual": total * (1 - attributed_pct / 100.0),
                "investments": [
                    {k: i[k] for k in ("investment_code", "investment_name", "submission_id", "pct_of_wbs",
                                        "attributed_actual", "ecc_counted", "pac_code", "product",
                                        "intervention_driver", "funding_position", "site_id", "price_base")}
                    for i in invs
                ],
                "pac_codes": sorted({i["pac_code"] for i in invs if i["pac_code"]}),
                "exception_count": 0,
                "tree": [materialise(r) for r in root_ids],
                "wbs": rows,
            })
        self.projects = projects

    # ------------------------------------------------------------------ activities
    def build_activities(self):
        acts = defaultdict(lambda: {"total": 0.0, "wbs": 0, "projects": set(), "variants": set(),
                                    "po_allocated": 0.0})
        mapping = {}
        for w in self.sap:
            a = acts[w["activity"]]
            a["total"] += w["ytd"]
            a["wbs"] += 1
            a["projects"].add(w["project"])
            a["variants"].add(w["wbs_description"])
            a["po_allocated"] += self.alloc_by_wbs.get(w["wbs"], 0.0)
            mapping[w["wbs_description"]] = (w["activity"], w["activity_rules"])
        self.activities = sorted([
            {"activity": k, "total": v["total"], "wbs_count": v["wbs"], "project_count": len(v["projects"]),
             "projects": sorted(v["projects"]), "variants": sorted(v["variants"]),
             "po_allocated": v["po_allocated"]}
            for k, v in acts.items()
        ], key=lambda x: -abs(x["total"]))
        self.activity_mapping = sorted([
            {"raw": raw, "canonical": c, "rules": rules, "origin": "system-derived",
             "version": ACTIVITY_MAPPING_VERSION, "changed": bool(rules)}
            for raw, (c, rules) in mapping.items()
        ], key=lambda x: (x["canonical"], x["raw"]))
        reg = defaultdict(lambda: {"total": 0.0, "wbs": 0, "projects": set(), "description": None, "dummy": False})
        for w in self.sap:
            g = reg[w["reg_activity"]]
            g["total"] += w["ytd"]
            g["wbs"] += 1
            g["projects"].add(w["project"])
            g["description"] = w["reg_activity_description"]
            g["dummy"] = g["dummy"] or w["dummy_activity"]
        self.reg_activities = sorted([
            {"code": k, "description": v["description"], "total": v["total"], "wbs_count": v["wbs"],
             "project_count": len(v["projects"]), "projects": sorted(v["projects"]), "dummy": v["dummy"]}
            for k, v in reg.items()
        ], key=lambda x: -abs(x["total"]))

        def breakdown(field):
            agg = defaultdict(lambda: {"ecc": 0.0, "count": 0, "attributed": 0.0})
            for i in self.invs:
                g = agg[i[field] or "(not set)"]
                g["ecc"] += i["ecc_counted"]
                g["count"] += 1
                g["attributed"] += i["attributed_actual"] or 0.0
            return sorted([{"key": k, **v} for k, v in agg.items()], key=lambda x: -x["ecc"])

        self.investment_breakdowns = {
            "product": breakdown("product"), "intervention_driver": breakdown("intervention_driver"),
            "funding_position": breakdown("funding_position"), "area": breakdown("area"),
        }

    # ------------------------------------------------------------------ exceptions
    def build_exceptions(self):
        owner_of = {p["project"]: p["person_responsible"] for p in self.projects}
        # SAP posting grain
        for p in self.projects:
            if p["dummy_activity"] and abs(p["dummy_activity_value"]) > 0:
                codes = ", ".join("%s (%s)" % c for c in p["reg_activities"])
                self.exc("dummy-activity", "ACT-001", "high",
                         "Actuals on placeholder regulatory activity code",
                         "%d WBS elements carry %s; cost cannot be attributed to a regulatory activity."
                         % (p["wbs_count"], codes), "project", p["project"], p["project"],
                         p["person_responsible"], p["dummy_activity_value"], "SAP Data")
            if p["scheme_ref"] in (None, "", "TEMPLATE"):
                self.exc("scheme-ref-missing", "WBS-001", "medium",
                         "Scheme / project reference not populated",
                         "Scheme No/Proj Ref is '%s'; cross-system matching to the Copperleaf PAC code relies on it."
                         % (p["scheme_ref"] or "blank"), "project", p["project"], p["project"],
                         p["person_responsible"], p["ytd"], "SAP Data")
            elif p["pac_codes"] and p["scheme_ref"] not in p["pac_codes"]:
                self.exc("scheme-ref-mismatch", "WBS-001", "medium",
                         "SAP scheme reference does not match Copperleaf PAC code",
                         "SAP '%s' vs Copperleaf %s." % (p["scheme_ref"], ", ".join(p["pac_codes"])),
                         "project", p["project"], p["project"], p["person_responsible"], p["ytd"], "SAP Data / Copperleaf")
            if not p["investments"]:
                self.exc("project-no-investment", "INV-001", "high",
                         "Project has no linked regulatory investment",
                         "No Copperleaf row links this SAP project with a valid % of WBS.",
                         "project", p["project"], p["project"], p["person_responsible"], p["ytd"], "Copperleaf")
            elif p["attributed_pct"] > 100.0001:
                self.exc("over-attributed", "BR-002", "high", "Investment attribution exceeds 100%",
                         "Copperleaf %% of WBS sums to %.2f%%." % p["attributed_pct"], "project", p["project"],
                         p["project"], p["person_responsible"], p["ytd"] * (p["attributed_pct"] - 100) / 100, "Copperleaf")
            elif p["attributed_pct"] < 99.9999:
                sev = "high" if abs(p["unattributed_actual"]) >= MATERIAL_UNATTRIBUTED else "medium"
                self.exc("under-attributed", "BR-001", sev, "Actuals not fully attributed to investments",
                         "Copperleaf %% of WBS sums to %.2f%% across %d investment(s); the remainder of SAP actuals has no regulatory investment."
                         % (p["attributed_pct"], len(p["investments"])), "project", p["project"], p["project"],
                         p["person_responsible"], p["unattributed_actual"], "SAP Data / Copperleaf")
        for w in self.sap:
            owner = w["person_responsible"]
            if w["level"] <= 2 and abs(w["ytd"]) > TOLERANCE:
                w["flags"].append("summary-level posting")
                self.exc("summary-wbs-posting", "WBS-004", "medium", "Posting to summary-level WBS element",
                         "Level-%d WBS '%s' carries %s directly instead of a leaf element."
                         % (w["level"], w["wbs_description"], "actuals"), "wbs", w["wbs"], w["project"], owner, w["ytd"], "SAP Data")
            if (w["wbs_description"] or "").strip().lower() == "all" and abs(w["ytd"]) > TOLERANCE:
                w["flags"].append("non-specific description")
                self.exc("aggregated-wbs", "WBS-004", "medium", "Overly aggregated WBS element ('All')",
                         "WBS described as 'All' cannot evidence activity type.", "wbs", w["wbs"], w["project"], owner, w["ytd"], "SAP Data")
            if w["ytd"] < -TOLERANCE:
                w["flags"].append("credit balance")
                self.exc("negative-ytd", "FOR-008", "medium", "WBS element in net credit",
                         "YTD actual is negative; check for reversal, mis-posting or transfer.", "wbs", w["wbs"],
                         w["project"], owner, w["ytd"], "SAP Data")
            big = [(self.periods_used[k], v) for k, v in enumerate(w["periods"]) if v <= -LARGE_REVERSAL]
            for period, v in big:
                w["flags"].append("large reversal P%d" % period)
                self.exc("large-reversal", "FOR-008", "high" if v <= -1_000_000 else "medium",
                         "Unexpected movement: large single-period credit",
                         "Period %d movement of %.0f on '%s'." % (period, v, w["wbs_description"]), "wbs", w["wbs"],
                         w["project"], owner, v, "SAP Data")
            if abs(w["ytd"]) <= TOLERANCE and any(abs(v) > TOLERANCE for v in w["periods"]):
                w["flags"].append("fully reversed")
                self.exc("net-zero", "FOR-008", "low", "Postings fully reversed to nil",
                         "Period movements net to zero YTD.", "wbs", w["wbs"], w["project"], owner, 0.0, "SAP Data")
        variants = [a for a in self.activities if len(a["variants"]) > 1]
        for a in variants:
            self.exc("activity-variants", "ACT-004", "low", "Same activity recorded under different descriptions",
                     "%s mapped to '%s' (%s)." % (" / ".join(repr(v) for v in a["variants"]), a["activity"],
                                                  ACTIVITY_MAPPING_VERSION), "activity", a["activity"], None, None, a["total"], "SAP Data")
        # Commercial / allocation grain
        for p in self.pos:
            if not p["checks"]["allocation_pct_ok"]:
                self.exc("alloc-pct", "GRN-002", "high", "PO allocation does not total 100%",
                         "Allocation %% totals %.2f%%." % (p["checks"]["allocation_pct_total"] * 100), "po", p["po_number"],
                         None, None, None, "Actual Allocation")
            if not p["checks"]["allocated_matches_posted"]:
                self.exc("alloc-unreconciled", "GRN-002", "high", "PO actual not fully allocated",
                         "Allocated %.2f vs posted %.2f." % (p["checks"]["allocated_total"], p["actual_posted"]),
                         "po", p["po_number"], None, None, p["checks"]["unallocated"], "PO Summary / Actual Allocation")
            if not p["checks"]["within_commitment"]:
                self.exc("over-commitment", "GRN-007", "high", "Actual posted exceeds PO value",
                         "Posted exceeds committed value; PO change or reapproval trigger.", "po", p["po_number"],
                         None, None, p["actual_posted"] - p["po_value"], "PO Summary")
            if p["pending_review"]:
                self.exc("alloc-review", "G5", "info", "Allocation lines awaiting review",
                         "%d of %d allocation lines are not approved." % (p["pending_review"], p["wbs_count"]),
                         "po", p["po_number"], None, None, p["actual_posted"], "Actual Allocation")
            for l in p["allocations"]:
                owner = l["person_responsible"] or owner_of.get(l["project"])
                if "WBS not in SAP extract" in l["flags"]:
                    self.exc("alloc-wbs-missing", "GRN-004", "high", "Allocation to WBS with no SAP posting record",
                             "%s allocates to a WBS absent from SAP Data." % l["allocation_id"], "allocation",
                             l["allocation_id"], l["project"], owner, l["final_allocated"], "Actual Allocation")
                if "investment ID differs from SAP" in l["flags"]:
                    self.exc("alloc-investment-mismatch", "WBS-001", "medium", "Allocation investment ID differs from SAP",
                             "%s carries %s." % (l["allocation_id"], l["investment_id"]), "allocation",
                             l["allocation_id"], l["project"], owner, l["final_allocated"], "Actual Allocation")
                if any("arithmetic" in f for f in l["flags"]):
                    self.exc("alloc-arithmetic", "SUP-004", "high", "Allocation arithmetic does not recalculate",
                             ", ".join(f for f in l["flags"] if "arithmetic" in f), "allocation", l["allocation_id"],
                             l["project"], owner, l["final_allocated"], "Actual Allocation")
        seen_wbs = set()
        for p in self.pos:
            for l in p["allocations"]:
                if "allocated > SAP posted" in l["flags"] and l["wbs"] not in seen_wbs:
                    seen_wbs.add(l["wbs"])
                    owner = l["person_responsible"]
                    self.exc("alloc-exceeds-ledger", "GRN-005", "high",
                             "PO allocations exceed SAP posted actual on WBS",
                             "Allocated %.0f vs SAP YTD %.0f on '%s' - the allocation schedule is acting as a second ledger."
                             % (l["sap_total_allocated"], l["sap_ytd"], l["wbs_description"]), "wbs", l["wbs"],
                             l["project"], owner, l["sap_total_allocated"] - (l["sap_ytd"] or 0), "Actual Allocation / SAP Data")
        # Analytical / regulatory grain
        for i in self.invs:
            if i["link_status"] == "no SAP project":
                self.exc("investment-unlinked", "INV-001", "medium", "Investment has no SAP project",
                         "%s (%s) has no SAPProject; planned cost cannot be tracked to actuals."
                         % (i["investment_code"], i["investment_name"]), "investment", i["investment_code"], None, None,
                         i["ecc_counted"] or None, "Copperleaf Data")
            elif i["link_status"] == "invalid reference":
                self.exc("investment-invalid-link", "INT-004", "medium", "Invalid SAP project reference",
                         "SAPProject=%r, PercentageOfWBS=%r." % (i["sap_project_raw"], i["pct_of_wbs"]), "investment",
                         i["investment_code"], None, None, i["ecc_counted"] or None, "Copperleaf Data")
            elif i["sap_project"] not in self.sap_project_totals:
                self.exc("investment-no-actuals", "INV-007", "low", "Linked SAP project has no actuals in extract",
                         "%s links to %s, which is not in the SAP Data extract." % (i["investment_code"], i["sap_project"]),
                         "investment", i["investment_code"], i["sap_project"], None, i["ecc_counted"] or None, "Copperleaf / SAP Data")
            if i["ecc_status"] == "invalid":
                self.exc("ecc-invalid", "INT-004", "high", "Planned cost value quarantined",
                         "IDTTotalECC %r is not a number (possible recovery %s); excluded from totals."
                         % (i["ecc_raw"], "%.0f" % i["ecc_candidate"] if i["ecc_candidate"] else "n/a"),
                         "investment", i["investment_code"], i["sap_project"], None, i["ecc_candidate"], "Copperleaf Data")
            elif i["ecc_status"] == "text":
                self.exc("ecc-text", "INT-004", "low", "Planned cost stored as text",
                         "IDTTotalECC %r parsed as a number." % i["ecc_raw"], "investment", i["investment_code"],
                         i["sap_project"], None, i["ecc"], "Copperleaf Data")
            if (_num(i["submission_volume"]) is not None and _num(i["investment_volume"]) is not None
                    and i["submission_volume"] != i["investment_volume"]):
                self.exc("volume-mismatch", "BR-003", "low", "Submitted volume differs from investment volume",
                         "FinalSubmissionVolumeT3=%s, InvestmentVolume=%s." % (i["submission_volume"], i["investment_volume"]),
                         "investment", i["investment_code"], i["sap_project"], None, None, "Copperleaf Data")
            if i["submission_id_raw"] in (None, ""):
                self.exc("submission-missing", "BR-003", "medium", "No final regulatory submission reference",
                         "FinalSubmissionInvIdT3 is blank; grouped by InvIdCode %s." % i["inv_id_code"], "investment",
                         i["investment_code"], i["sap_project"], None, None, "Copperleaf Data")
        for s in self.submissions:
            if s["duplicate_exposure"] > TOLERANCE:
                self.exc("ecc-duplicate", "SUP-006", "medium", "Planned cost repeated across investments",
                         "The same ECC appears on several investments of %s; a plain sum overstates plan by %.0f."
                         % (s["submission_id"], s["duplicate_exposure"]), "submission", s["submission_id"], None, None,
                         s["duplicate_exposure"], "Copperleaf Data")
            if len(s["price_bases"]) > 1:
                self.exc("price-base-mix", "BR-004", "low", "Mixed price bases within one submission",
                         "Price bases %s within %s." % (", ".join(s["price_bases"]), s["submission_id"]), "submission",
                         s["submission_id"], None, None, None, "Copperleaf Data")
        self.exceptions.sort(key=lambda e: (SEVERITY_ORDER[e["severity"]], -abs(e["value"] or 0)))
        for k, e in enumerate(self.exceptions):
            e["id"] = "EXC-%03d" % (k + 1)
        counts = defaultdict(int)
        for e in self.exceptions:
            if e["project"]:
                counts[e["project"]] += 1
        for p in self.projects:
            p["exception_count"] = counts[p["project"]]

    # ------------------------------------------------------------------ control totals
    def build_checks(self):
        d = self.d
        pivot = [r for r in d["SAPPivot"]["records"] if r["wbs"] not in (None, "(blank)")]
        pivot_total = sum(_f(r["ytd_total"]) for r in pivot)
        self.check("SAP S/4", "SAP Data YTD total = SAPPivot total", "INT-005", self.sap_total, pivot_total,
                   abs(pivot_total - self.sap_total) <= TOLERANCE)
        self.check("SAP S/4", "SAP Data WBS rows = SAPPivot rows", "INT-005", len(self.sap), len(pivot),
                   len(self.sap) == len(pivot))
        pivot_wbs = {r["wbs"] for r in pivot}
        missing = [w["wbs"] for w in self.sap if w["wbs"] not in pivot_wbs]
        self.check("SAP S/4", "Every SAP WBS present in pivot", "INT-005", 0, len(missing), not missing,
                   ", ".join(missing[:3]))
        period_sum = sum(w["period_sum"] for w in self.sap)
        ratios = [round(w["period_sum"] / w["ytd"], 4) for w in self.sap if abs(w["ytd"]) > 1]
        common = max(set(ratios), key=ratios.count) if ratios else None
        self.check("SAP S/4", "Σ posting periods = YTD TOTAL", "INT-005", self.sap_total, period_sum,
                   abs(period_sum - self.sap_total) <= TOLERANCE,
                   "Periods P%s populated. %d of %d rows have period sum = %.4f × YTD; YTD TOTAL is used as the authoritative actual, periods only for phasing."
                   % (",".join(str(p) for p in self.periods_used), ratios.count(common), len(ratios), common or 0),
                   status="warn" if abs(period_sum - self.sap_total) > TOLERANCE else None)
        cl_projects = {i["sap_project"] for i in self.invs if i["sap_project"]}
        bad_flag = [w for w in self.sap if str(w["in_copperleaf_flag"]).lstrip("_").lower() == "yes" and w["project"] not in cl_projects]
        self.check("SAP S/4", "'In Copperleaf?' flag agrees with Copperleaf links", "WBS-001", 0, len(bad_flag), not bad_flag)
        cp = [r for r in d["CopperPivot"]["records"] if r["investment_code"] not in (None, "(blank)")]
        cp_total = 0.0
        for r in cp:
            v, _, _ = parse_amount(r["ecc"])
            cp_total += v or 0.0
        cl_total = sum(i["ecc"] or 0.0 for i in self.invs)
        pivot_ecc = {r["investment_code"]: parse_amount(r["ecc"])[0] or 0.0 for r in cp}
        dropped = [i for i in self.invs if i["ecc"] and abs(pivot_ecc.get(i["investment_code"], 0.0) - i["ecc"]) > TOLERANCE]
        self.check("Copperleaf", "Copperleaf Σ ECC (validated) = CopperPivot Σ", "INT-005", cl_total, cp_total,
                   abs(cl_total - cp_total) <= TOLERANCE,
                   "Pivot counts text-stored ECC as 0: %s." % ", ".join(
                       "%s (%.0f)" % (i["investment_code"], i["ecc"]) for i in dropped) if dropped else "")
        self.check("Copperleaf", "Investment rows = CopperPivot rows", "INT-005", len(self.invs), len(cp),
                   len(self.invs) == len(cp))
        quarantined = [i for i in self.invs if i["ecc_status"] == "invalid"]
        self.check("Copperleaf", "Planned cost values rejected (quarantined)", "INT-004", 0, len(quarantined),
                   not quarantined, ", ".join(i["investment_code"] for i in quarantined))
        dup = sum(s["duplicate_exposure"] for s in self.submissions)
        self.check("Copperleaf", "Duplicate ECC exposure removed by submission de-duplication", "SUP-006",
                   0, dup, dup <= TOLERANCE, status="warn" if dup > TOLERANCE else None)
        po_posted = sum(p["actual_posted"] for p in self.pos)
        alloc_total = sum(p["checks"]["allocated_total"] for p in self.pos)
        self.check("COUPA / allocation", "PO actual posted = Σ final allocated", "GRN-002", po_posted, alloc_total,
                   abs(po_posted - alloc_total) <= TOLERANCE)
        bad_pct = [p["po_number"] for p in self.pos if not p["checks"]["allocation_pct_ok"]]
        self.check("COUPA / allocation", "Every PO allocates 100%", "GRN-002", 0, len(bad_pct), not bad_pct, ", ".join(bad_pct))
        stated = [p["po_number"] for p in self.pos
                  if abs(p["checks"]["stated_allocated"] - p["checks"]["allocated_total"]) > TOLERANCE
                  or abs(p["checks"]["stated_unallocated"] - p["checks"]["unallocated"]) > TOLERANCE]
        self.check("COUPA / allocation", "PO Summary stated totals recalculate from allocation lines", "SUP-004",
                   0, len(stated), not stated, ", ".join(stated))
        arith = [l["allocation_id"] for p in self.pos for l in p["allocations"] if any("arithmetic" in f for f in l["flags"])]
        self.check("COUPA / allocation", "Allocation line arithmetic (% × actual + adjustment)", "SUP-004",
                   0, len(arith), not arith, ", ".join(arith))
        missing_wbs = [l["allocation_id"] for p in self.pos for l in p["allocations"] if l["sap_ytd"] is None]
        self.check("COUPA / allocation", "Allocation WBS found in SAP Data", "GRN-004", 0, len(missing_wbs),
                   not missing_wbs, ", ".join(missing_wbs))
        over = sorted({l["wbs"] for p in self.pos for l in p["allocations"] if "allocated > SAP posted" in l["flags"]})
        over_val = sum(self.alloc_by_wbs[w] - self.sap_by_wbs[w]["ytd"] for w in over)
        self.check("Cross-grain", "PO allocations ≤ SAP posted actual per WBS", "GRN-005", 0, over_val, not over,
                   "%d of %d allocated WBS elements exceed their SAP actual." % (len(over), len(self.alloc_by_wbs)))
        attributed = sum(p["attributed_actual"] for p in self.projects)
        self.check("Cross-grain", "SAP actuals attributed to a regulatory investment", "BR-001", self.sap_total,
                   attributed, abs(attributed - self.sap_total) <= TOLERANCE, status="warn" if abs(attributed - self.sap_total) > TOLERANCE else None)

    # ------------------------------------------------------------------ requirements
    def evaluate_requirements(self):
        exc_by_req = defaultdict(list)
        for e in self.exceptions:
            exc_by_req[e["requirement"]].append(e)
        tot = self.sap_total or 1.0
        gross = sum(w["ytd"] for w in self.sap if w["ytd"] > 0) or 1.0
        attributed = sum(p["attributed_actual"] for p in self.projects)
        dummy = sum(w["ytd"] for w in self.sap if w["dummy_activity"] and w["ytd"] > 0)
        alloc_lines = sum(p["wbs_count"] for p in self.pos)
        n_pos = len(self.pos)
        check_map = defaultdict(list)
        for c in self.checks:
            check_map[c["requirement"]].append(c)
        many = [p for p in self.projects if len(p["investments"]) > 1]
        multi_proj_subs = [s for s in self.submissions if len(s["sap_projects"]) > 1]
        unlinked = [i for i in self.invs if i["link_status"] != "linked"]

        def status_from(excs, checks=()):
            if any(c["status"] == "fail" for c in checks) or any(e["severity"] in ("critical", "high") for e in excs):
                return "gap"
            if excs or any(c["status"] == "warn" for c in checks):
                return "partial"
            return "met"

        ev = {}

        def put(rid, status, metric, evidence, page):
            ev[rid] = {"status": status, "metric": metric, "evidence": evidence, "page": page,
                       "exceptions": len(exc_by_req.get(rid, []))}

        put("G2", "met", "%d PO lines → %d WBS allocations → %d investments" % (n_pos, alloc_lines, len(self.invs)),
            "Commercial (PO Summary), posting (SAP Data) and analytical (Allocation, Copperleaf) grains are joined by PO number, WBS element and SAP project.", "Overview")
        put("G4", "met", "%d PO lines carry %d WBS allocations (%.1f× detail)" % (n_pos, alloc_lines, alloc_lines / max(n_pos, 1)),
            "Each PO is a single summary line; WBS detail lives in the governed allocation schedule.", "Purchase Orders")
        put("EFF-003", "met", ev["G4"]["metric"], ev["G4"]["evidence"], "Purchase Orders")
        put("G3", "met", "%d POs with summary, consumption and exception indicators" % n_pos,
            "PO view summarises value, posted, remaining commitment and flags; WBS coding by drill-down.", "Purchase Orders")
        put("EFF-002", "met", ev["G3"]["metric"], ev["G3"]["evidence"], "Purchase Orders")
        put("GRN-008", "met", ev["G3"]["metric"], ev["G3"]["evidence"], "Purchase Orders")
        put("G5", "partial" if self.exceptions else "met", "%d exceptions raised" % len(self.exceptions),
            "Rule-based exception queue with owner (SAP Person Responsible) and requirement reference.", "Exceptions")
        put("BR-001", status_from(exc_by_req["BR-001"]), "%.1f%% of SAP actual attributed to an investment" % (attributed / tot * 100),
            "Investment → SAP project → WBS → PO allocation chain built from Copperleaf % of WBS.", "Investment Traceability")
        put("BR-002", "gap" if dummy > 0 else "met", "%.1f%% of gross actual on placeholder activity codes" % (dummy / gross * 100),
            "Regulatory activity code must be specific for activity-level attribution.", "Activity Analysis")
        put("ACT-001", ev["BR-002"]["status"], ev["BR-002"]["metric"], "W99 / QQQ codes are placeholders pending correct activity assignment.", "Activity Analysis")
        put("ACT-004", "partial" if exc_by_req["ACT-004"] else "met",
            "%d raw descriptions → %d activities (%s)" % (len(self.activity_mapping), len(self.activities), ACTIVITY_MAPPING_VERSION),
            "Supplier/WBS description variants mapped to a controlled activity list.", "Activity Analysis")
        put("ACT-005", "met", "WBS, activity, regulatory activity and investment held separately",
            "Activity is derived from WBS description and shown alongside, not replacing, the WBS element.", "Activity Analysis")
        put("BR-003", status_from(exc_by_req["BR-003"]),
            "%d submissions, %d investments" % (len(self.submissions), len(self.invs)),
            "Regulatory submission reference and price base carried into the investment view.", "Investment Traceability")
        put("BR-004", "partial", "Commitment, actual and planned ECC shown; baseline/forecast/ETC not in input",
            "PO value (commitment), SAP YTD (actual) and Copperleaf ECC (plan) kept as distinct measures.", "Investment Traceability")
        put("FOR-002", "partial", ev["BR-004"]["metric"], ev["BR-004"]["evidence"], "Investment Traceability")
        put("BR-005", status_from(exc_by_req["GRN-005"], check_map["GRN-005"]), check_map["GRN-005"][0]["detail"] if check_map["GRN-005"] else "",
            "Allocation schedule compared with SAP posted actual on each WBS.", "Purchase Orders")
        put("GRN-005", ev["BR-005"]["status"], ev["BR-005"]["metric"], ev["BR-005"]["evidence"], "Purchase Orders")
        put("GRN-001", "met", ev["G2"]["metric"], ev["G2"]["evidence"], "Overview")
        put("GRN-002", status_from(exc_by_req["GRN-002"], check_map["GRN-002"]),
            "%d/%d POs reconcile to their allocation schedule" % (sum(1 for p in self.pos if p["checks"]["allocated_matches_posted"] and p["checks"]["allocation_pct_ok"]), n_pos),
            "PO actual posted equals Σ final allocated and allocation % totals 100%.", "Purchase Orders")
        put("GRN-004", status_from(exc_by_req["GRN-004"], check_map["GRN-004"]),
            "%d allocation lines traced to SAP WBS" % alloc_lines, "Allocation ID → PO → WBS → SAP posting.", "Purchase Orders")
        put("GRN-009", "met", "Origin shown on every detailed record",
            "Allocation lines: governed allocation (rule); activity: system-derived (%s); actuals: SAP posted." % ACTIVITY_MAPPING_VERSION, "Purchase Orders")
        put("GRN-007", status_from(exc_by_req["GRN-007"]), "%d POs within committed value" % sum(1 for p in self.pos if p["checks"]["within_commitment"]),
            "Actual > PO value is raised as a reapproval trigger.", "Purchase Orders")
        put("WBS-001", status_from(exc_by_req["WBS-001"], check_map["WBS-001"]),
            "%d projects with missing/mismatched scheme reference" % len(exc_by_req["WBS-001"]),
            "Matching uses identifiers (WBS element, SAP project, PAC code), never names.", "Projects & WBS")
        put("WBS-004", status_from(exc_by_req["WBS-004"]), "%d postings to summary or 'All' WBS" % len(exc_by_req["WBS-004"]),
            "Postings on level-1/2 or non-specific WBS elements routed to exceptions.", "Projects & WBS")
        put("INV-001", status_from(exc_by_req["INV-001"]), "%d of %d investments without a valid SAP link" % (len(unlinked), len(self.invs)),
            "Unlinked investments and projects without investments raised as exceptions.", "Investment Traceability")
        put("INV-003", "met", "%d projects funded by >1 investment; %d submissions span >1 project" % (len(many), len(multi_proj_subs)),
            "Many-to-many investment ↔ project relationships with % of WBS.", "Investment Traceability")
        put("INV-007", status_from(exc_by_req["INV-007"]), "%d linked projects without actuals in extract" % len(exc_by_req["INV-007"]),
            "Actual by investment available for linked projects present in SAP.", "Investment Traceability")
        put("SUP-004", status_from(exc_by_req["SUP-004"], check_map["SUP-004"]), "%d validation checks" % len(check_map["SUP-004"]),
            "Arithmetic, references and stated totals recalculated from source lines.", "Data Quality")
        put("SUP-005", status_from([], check_map["GRN-002"] + check_map["SUP-004"]), "Control totals visible",
            "PO → allocation → SAP control totals with differences.", "Data Quality")
        put("SUP-006", status_from(exc_by_req["SUP-006"], check_map["SUP-006"]),
            "%.0f duplicate planned cost removed" % sum(s["duplicate_exposure"] for s in self.submissions),
            "Submission-level ECC counted once per submission.", "Investment Traceability")
        put("FOR-008", status_from(exc_by_req["FOR-008"]), "%d unexpected movements / credit balances" % len(exc_by_req["FOR-008"]),
            "Large reversals, credit balances and fully reversed WBS routed to named owners.", "Exceptions")
        put("INT-001", status_from([], check_map["INT-005"][:3]), "SAP YTD %.0f" % self.sap_total,
            "All actual figures are SAP YTD TOTAL; analytical views reconcile back to it.", "Data Quality")
        put("INT-004", status_from(exc_by_req["INT-004"], check_map["INT-004"]),
            "%d values quarantined, %d invalid references" % (sum(1 for i in self.invs if i["ecc_status"] == "invalid"),
                                                              sum(1 for i in self.invs if i["link_status"] == "invalid reference")),
            "Header contract enforced on load; non-numeric amounts quarantined with reason.", "Data Quality")
        put("INT-005", status_from([], check_map["INT-005"]), "%d control totals" % len(check_map["INT-005"]),
            "Source sheet vs pivot record and value totals.", "Data Quality")
        put("G6", "partial", "Source key and load lineage retained on every record",
            "Each record keeps its natural key; the payload is stamped with the database load (etl_load id, source file SHA-256) and mapping version. Version history of submissions is not in the input.", "Data Quality")
        put("G1", "partial", "SAP, COUPA-style PO and Copperleaf reused without re-keying",
            "FastDraft and Primavera P6 data are not part of the input workbook.", "Overview")
        out = []
        for rid, section, text, acceptance in CATALOGUE:
            e = ev.get(rid)
            out.append({
                "id": rid, "section": section, "text": text, "acceptance": acceptance,
                "status": e["status"] if e else "not evidenced",
                "metric": e["metric"] if e else "", "evidence": e["evidence"] if e else
                "The input workbook does not contain data for this requirement.",
                "page": e["page"] if e else None, "exceptions": len(exc_by_req.get(rid, [])),
            })
        self.requirements = out

    # ------------------------------------------------------------------ assemble
    def build(self, source_meta):
        self.build_sap()
        self.build_copperleaf()
        self.build_attribution()
        self.build_pos()
        self.build_projects()
        self.build_activities()
        self.build_exceptions()
        self.build_checks()
        self.evaluate_requirements()
        sev = defaultdict(int)
        for e in self.exceptions:
            sev[e["severity"]] += 1
        po_value = sum(p["po_value"] for p in self.pos)
        po_posted = sum(p["actual_posted"] for p in self.pos)
        attributed = sum(p["attributed_actual"] for p in self.projects)
        gross = sum(w["ytd"] for w in self.sap if w["ytd"] > 0)
        dummy = sum(w["ytd"] for w in self.sap if w["dummy_activity"] and w["ytd"] > 0)
        ecc = sum(s["ecc"] for s in self.submissions)
        summary = {
            "sap_ytd": self.sap_total, "sap_gross_debits": gross,
            "sap_credits": sum(w["ytd"] for w in self.sap if w["ytd"] < 0),
            "project_count": len(self.projects), "wbs_count": len(self.sap),
            "po_count": len(self.pos), "po_value": po_value, "po_actual_posted": po_posted,
            "po_remaining": po_value - po_posted, "allocation_lines": sum(p["wbs_count"] for p in self.pos),
            "investment_count": len(self.invs), "submission_count": len(self.submissions),
            "planned_ecc": ecc, "planned_ecc_naive": sum(s["ecc_naive"] for s in self.submissions),
            "planned_ecc_quarantined": sum(i["ecc_candidate"] or 0 for i in self.invs if i["ecc_status"] == "invalid"),
            "attributed_actual": attributed, "unattributed_actual": self.sap_total - attributed,
            "attribution_pct": attributed / self.sap_total if self.sap_total else None,
            "dummy_activity_value": dummy, "dummy_activity_pct": dummy / gross if gross else None,
            "exceptions": len(self.exceptions), "exceptions_by_severity": dict(sev),
            "checks_failed": sum(1 for c in self.checks if c["status"] == "fail"),
            "checks_warn": sum(1 for c in self.checks if c["status"] == "warn"),
            "checks_total": len(self.checks),
            "requirements_status": {s: sum(1 for r in self.requirements if r["status"] == s)
                                    for s in ("met", "partial", "gap", "not evidenced")},
            "periods": ["P%d" % p for p in self.periods_used],
            "period_totals": [sum(w["periods"][k] for w in self.sap) for k in range(len(self.periods_used))],
        }
        meta = {
            **source_meta,
            "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "currency": "GBP", "activity_mapping_version": ACTIVITY_MAPPING_VERSION,
        }
        return {
            "meta": meta, "summary": summary, "pos": self.pos, "projects": self.projects,
            "investments": self.invs, "submissions": self.submissions,
            "investment_breakdowns": self.investment_breakdowns,
            "activities": self.activities, "activity_mapping": self.activity_mapping,
            "reg_activities": self.reg_activities, "exceptions": self.exceptions,
            "checks": self.checks, "requirements": self.requirements,
        }


_cache = {"key": None, "value": None}
_lock = threading.Lock()


def compute(dsn=None):
    """Return insights from the database, recomputed when a new load is recorded in etl_load."""
    dsn = dsn or pgsource.DSN
    key = (dsn, pgsource.SCHEMA) + pgsource.version(dsn)
    with _lock:
        if _cache["key"] != key:
            data, source_meta = pgsource.load(dsn)
            _cache["value"] = Builder(data).build(source_meta)
            _cache["key"] = key
        return _cache["value"]


def _round_all(o):
    if isinstance(o, float):
        return round(o, 2)
    if isinstance(o, dict):
        return {k: _round_all(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_round_all(v) for v in o]
    return o


def to_json(data):
    return _round_all(data)


if __name__ == "__main__":
    args = sys.argv[1:]
    dsn = None
    if "--dsn" in args:
        dsn = args[args.index("--dsn") + 1]
    result = to_json(compute(dsn))
    if "--export" in args:
        target = args[args.index("--export") + 1]
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, separators=(",", ":"))
        print("wrote", target, os.path.getsize(target), "bytes")
    else:
        print(json.dumps(result["summary"], indent=2))
        for c in result["checks"]:
            print("%-5s %-60s %s" % (c["status"], c["check"], c["detail"][:80]))

"""Read the cost-granularity input workbook (.xlsx) with the standard library only.

The workbook's sheets and columns are a fixed input contract: every sheet's header
row is checked against SHEET_CONTRACT and the load fails with the exact differences
if a column was added, removed, renamed or moved.
"""
import datetime
import os
import re
import zipfile
import xml.etree.ElementTree as ET

DEFAULT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "Cost Granularity Anonymised with PO Allocation.xlsx",
)
WORKBOOK_PATH = os.environ.get("APEX_WORKBOOK", DEFAULT_PATH)

_NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
_T = "{%s}t" % _NS["m"]

# Header rows exactly as they appear in the source. None marks a blank header
# cell. SAP period 10 is anonymised to '1PROJECT 0001' in the extract.
SAP_PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "1PROJECT 0001", "11", "12"]
SHEET_CONTRACT = {
    "SAP Data": [
        None, "YTD TOTAL", "In Copperleaf?", ".", "Company Code", "Project Definition",
        "Project Definition", "WBS Element", "WBS Element", "Object Class",
        "Person Responsible", "Initiative ID", "Scheme No/Proj Ref", "WBS Regulatory Activity",
        "WBS Regulatory Activity | Posting period",
    ] + SAP_PERIODS,
    "SAPPivot": [
        None, None, None, "Project Definition", "Project Definition2", "WBS Element",
        "WBS Element2", "Initiative ID", "Sum of YTD TOTAL",
    ],
    "Copperleaf Data": [
        "InvestmentCode", "InvestmentName", "Area", "Facility", "FinalSubmissionInvIdT3",
        "FinalSubmissionVolumeT3", "InvestmentVolume", "InvIdCode", "PriceBaseOfEnteredCost",
        "Product", "Site", "SiteId", "FundingPositionT3Proposed", "InterventionDriver",
        "SAPProject", "PercentageOfWBS", "IDTTotalECC", "PACCode",
    ],
    "CopperPivot": [
        None, None, None, "FinalSubmissionInvIdT3", "FinalSubmissionVolumeT3", "InvestmentCode",
        "InvestmentName", "PACCode", "SAPProject", "PercentageOfWBS", "Sum of IDTTotalECC",
    ],
    "PO Summary": [
        "PO Number", "Supplier ID", "Contract Ref", "PO Description", "PO Date", "Currency",
        "Posting Level", "Summary Cost Object", "PO Value (£)", "Actual Posted (£)",
        "Allocation Basis", "Status", "Total Allocation %", "Allocated Actual (£)",
        "Unallocated Difference (£)",
    ],
    "Actual Allocation": [
        "Allocation ID", "PO Number", "Project Definition", "Project Name", "WBS Element",
        "WBS Description", "Investment ID", "Allocation Rule", "Allocation %", "PO Actual (£)",
        "Calculated Allocation (£)", "Manual Adjustment (£)", "Final Allocated Actual (£)",
        "Allocation Rationale", "Review Status",
    ],
}

# Field keys used by the insight engine, by column position. Positional because the
# SAP sheet repeats 'Project Definition' and 'WBS Element' (code, then description).
FIELDS = {
    "SAP Data": [
        None, "ytd_total", "in_copperleaf", None, "company_code", "project", "project_name",
        "wbs", "wbs_description", "object_class", "person_responsible", "initiative_id",
        "scheme_ref", "reg_activity", "reg_activity_description",
    ] + ["p%d" % i for i in range(1, 13)],
    "SAPPivot": [None, None, None, "project", "project_name", "wbs", "wbs_description",
                 "initiative_id", "ytd_total"],
    "Copperleaf Data": [
        "investment_code", "investment_name", "area", "facility", "submission_id",
        "submission_volume", "investment_volume", "inv_id_code", "price_base", "product",
        "site", "site_id", "funding_position", "intervention_driver", "sap_project",
        "pct_of_wbs", "ecc", "pac_code",
    ],
    "CopperPivot": [None, None, None, "submission_id", "submission_volume", "investment_code",
                    "investment_name", "pac_code", "sap_project", "pct_of_wbs", "ecc"],
    "PO Summary": [
        "po_number", "supplier_id", "contract_ref", "description", "po_date", "currency",
        "posting_level", "summary_cost_object", "po_value", "actual_posted", "allocation_basis",
        "status", "total_allocation_pct", "allocated_actual", "unallocated_difference",
    ],
    "Actual Allocation": [
        "allocation_id", "po_number", "project", "project_name", "wbs", "wbs_description",
        "investment_id", "allocation_rule", "allocation_pct", "po_actual", "calculated_allocation",
        "manual_adjustment", "final_allocated", "rationale", "review_status",
    ],
}

# Pivot sheets repeat a group key only on the first row of each group.
_FILL_DOWN = {
    "SAPPivot": ["project", "project_name"],
    "CopperPivot": ["submission_id", "submission_volume"],
}


class WorkbookContractError(ValueError):
    """The workbook's sheets or columns differ from SHEET_CONTRACT."""


def _col_index(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def _read_raw(path: str) -> dict:
    """Return {sheet name: [(Excel row number, row values)]} with cached cell values (formulas not evaluated)."""
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", _NS):
                shared.append("".join(t.text or "" for t in si.iter(_T)))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in rels}
        book = ET.fromstring(z.read("xl/workbook.xml"))
        out = {}
        for sheet in book.find("m:sheets", _NS):
            target = targets[sheet.get("{%s}id" % _NS["r"])].lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            rows = []
            for row in ET.fromstring(z.read(target)).iter("{%s}row" % _NS["m"]):
                cells = {}
                for c in row.findall("m:c", _NS):
                    v, kind = c.find("m:v", _NS), c.get("t")
                    if kind == "inlineStr":
                        val = "".join(t.text or "" for t in c.iter(_T))
                    elif v is None:
                        continue
                    elif kind == "s":
                        val = shared[int(v.text)]
                    elif kind in ("str", "e"):
                        val = v.text
                    elif kind == "b":
                        val = v.text == "1"
                    else:
                        f = float(v.text)
                        val = int(f) if f.is_integer() else f
                    cells[_col_index(c.get("r"))] = val
                if cells:
                    # Keep the Excel row number: empty rows are absent from the XML.
                    rownum = int(row.get("r")) if row.get("r") else len(rows) + 1
                    rows.append((rownum, [cells.get(i) for i in range(max(cells) + 1)]))
            out[sheet.get("name")] = rows
    return out


def _norm_header(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def excel_date(serial):
    if isinstance(serial, (int, float)):
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(serial))).isoformat()
    return serial


def load(path: str = None) -> dict:
    """Load and validate the workbook. Returns {sheet: {"header_row": n, "records": [...]}}."""
    path = path or WORKBOOK_PATH
    if not os.path.exists(path):
        raise FileNotFoundError("Input workbook not found: %s (set APEX_WORKBOOK)" % path)
    raw = _read_raw(path)
    problems = []
    result = {}
    for sheet, expected in SHEET_CONTRACT.items():
        numbered = raw.get(sheet)
        if numbered is None:
            problems.append("missing sheet '%s'" % sheet)
            continue
        rows = [values for _, values in numbered]
        want = [_norm_header(h) for h in expected]
        header_idx = None
        for i, row in enumerate(rows[:10]):
            got = [_norm_header(h) for h in row[: len(want)]]
            got += [None] * (len(want) - len(got))
            if got == want and not any(_norm_header(h) for h in row[len(want):]):
                header_idx = i
                break
        if header_idx is None:
            # Report against the row that looks most like a header.
            best = max(rows[:10], key=lambda r: sum(1 for h in r if _norm_header(h) in want), default=[])
            got = [_norm_header(h) for h in best]
            diffs = []
            for pos in range(max(len(want), len(got))):
                w = want[pos] if pos < len(want) else None
                g = got[pos] if pos < len(got) else None
                if w != g:
                    diffs.append("col %d expected %r found %r" % (pos + 1, w, g))
            problems.append("sheet '%s' columns changed: %s" % (sheet, "; ".join(diffs[:8])))
            continue
        keys = FIELDS[sheet]
        records, carry = [], {}
        for rownum, row in numbered[header_idx + 1:]:
            rec = {"_row": rownum}  # Excel row number
            for pos, key in enumerate(keys):
                if key:
                    rec[key] = row[pos] if pos < len(row) else None
            if all(rec.get(k) in (None, "") for k in keys if k):
                continue
            for k in _FILL_DOWN.get(sheet, []):
                if rec.get(k) in (None, ""):
                    rec[k] = carry.get(k)
                else:
                    carry[k] = rec[k]
            records.append(rec)
        result[sheet] = {"header_row": numbered[header_idx][0], "records": records}
    if problems:
        raise WorkbookContractError("Workbook does not match the input contract: " + " | ".join(problems))
    return result

"""Build the Cost Granularity Insights Agentflow (Flowise Agentflow V2).

    python3 build_flow.py "Cost Granularity Insights Agentflow.json"

Agents do the data work, all on Claude Sonnet: one standardises the workbook; three run in parallel, one
per grain (commercial approval = POs, financial posting = SAP actuals, analytical reporting = Copperleaf
investments), each writing its sections of the JSON the frontend expects from GET /api/insights; one
reconciles the grains and writes exceptions, checks, requirements and the summary. Custom Functions only
merge, patch and validate. Contracts are read from this repo so the
prompts stay in sync: the input column contract (backend/apexapp/workbook.py), the requirement
catalogue (backend/apexapp/requirements.py) and the payload shape
(frontend/src/lib/insightsSnapshot.json, exported by the backend engine).

Engine rules respected (packages/server/src/utils/buildAgentflow.ts): a node with several inputs
waits for all of them unless a Condition / Human Input node is upstream, so the join happens
before the only Condition; nodes run from a single queue, so parallel branches interleave.
"""
import copy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.environ.get("FLOWISE_TEMPLATES", os.path.join(HERE, "templates"))
OUT = sys.argv[1]
sys.path.insert(0, os.path.join(ROOT, "backend"))
from apexapp.workbook import SHEET_CONTRACT, FIELDS  # noqa: E402
from apexapp.requirements import CATALOGUE  # noqa: E402

MODEL = "claude-sonnet-5-5"  # any Claude Sonnet the Anthropic credential can use
MAX_TOKENS = 64000  # the financial grain (projects + WBS trees) is ~28k output tokens


def shell(template, name, label=None):
    d = json.load(open(os.path.join(SRC, template)))
    return copy.deepcopy(next(n for n in d["nodes"] if n["data"]["name"] == name and label in (None, n["data"]["label"])))


SHELLS = {
    "startAgentflow": shell("tpl_Human_In_The_Loop.json", "startAgentflow"),
    "httpAgentflow": shell("tpl_Interacting_With_API.json", "httpAgentflow"),
    "customFunctionAgentflow": shell("tpl_SQL_Agent.json", "customFunctionAgentflow"),
    "agentAgentflow": shell("tpl_Interacting_With_API.json", "agentAgentflow", "OpenAPI Agent"),  # the chatAnthropic one
    "conditionAgentflow": shell("tpl_Supervisor_Worker.json", "conditionAgentflow"),
    "loopAgentflow": shell("tpl_Human_In_The_Loop.json", "loopAgentflow"),
    "directReplyAgentflow": shell("tpl_Workplace_Chat.json", "directReplyAgentflow"),
    "stickyNoteAgentflow": shell("tpl_Interacting_With_API.json", "stickyNoteAgentflow"),
}


# ------------------------------------------------------------------ contracts from the repo
def describe(v, depth=0):
    """Compact type sketch of a JSON value; list items are merged so optional keys show up."""
    if isinstance(v, dict):
        return {k: ("[same shape as this node]" if k == "children" and depth > 0 else describe(x, depth + 1)) for k, x in v.items()}
    if isinstance(v, list):
        if not v:
            return []
        if all(isinstance(x, dict) for x in v):
            values = {}
            for x in v:
                for k, y in x.items():
                    values.setdefault(k, []).append(y)
            out = {}
            for k, ys in values.items():
                if k == "children" and depth > 0:
                    out[k] = "[same shape as this node]"
                    continue
                kinds = {describe(y, depth + 2) if not isinstance(y, (dict, list)) else None for y in ys} - {"null"}
                structured = [y for y in ys if isinstance(y, (dict, list))]
                if structured:
                    # merge nested structures across items too
                    out[k] = describe(structured if isinstance(structured[0], dict) else [i for s in structured for i in s], depth + 1)
                    if isinstance(structured[0], dict):
                        out[k] = out[k][0] if out[k] else {}
                    else:
                        out[k] = out[k] if out[k] else []
                elif len(kinds) > 1:
                    out[k] = "|".join(sorted(kinds))
                else:
                    out[k] = kinds.pop() if kinds else "null"
            return [out]
        return [describe(v[0], depth + 1)]
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if v is None:
        return "null"
    return "string"


snapshot = json.load(open(os.path.join(ROOT, "frontend", "src", "lib", "insightsSnapshot.json")))
PAYLOAD_SCHEMA = {k: describe(v) for k, v in snapshot.items()}
PAYLOAD_SCHEMA_TEXT = json.dumps(PAYLOAD_SCHEMA, separators=(",", ":"), ensure_ascii=False)
REQUIRED_KEYS = list(snapshot.keys())

COLUMN_CONTRACT_TEXT = "\n".join(
    "- %s: columns %s -> fields %s" % (
        sheet,
        json.dumps(cols, ensure_ascii=False),
        json.dumps([f for f in FIELDS[sheet] if f]),
    )
    for sheet, cols in SHEET_CONTRACT.items()
)
REQUIREMENTS_TEXT = "\n".join("%s (%s): %s" % (rid, section, text) for rid, section, text, _ in CATALOGUE)


# ------------------------------------------------------------------ node helpers
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def mention(var):
    return '<span class="variable" data-type="mention" data-id="%s" data-label="%s">{{ %s }}</span>' % (var, var, var)


def p(*parts):
    return "<p>" + " ".join(parts) + " </p>"


def para(text):
    """Plain text (may contain newlines and < >) as editor paragraphs."""
    return "".join("<p>%s</p>" % esc(line) if line else "<p></p>" for line in text.split("\n"))


nodes, edges, counters = [], [], {}


def add(kind, label, x, y, inputs):
    i = counters.get(kind, 0)
    counters[kind] = i + 1
    n = copy.deepcopy(SHELLS[kind])
    old = n["id"]
    nid = "%s_%d" % (kind, i)
    n["id"] = n["data"]["id"] = nid
    n["position"] = n["positionAbsolute"] = {"x": x, "y": y}
    n["data"]["label"] = label
    base = {k: "" for k in n["data"]["inputs"]}
    for k in ("agentModel", "agentModelConfig"):
        if k in n["data"]["inputs"]:
            base[k] = n["data"]["inputs"][k]
    n["data"]["inputs"] = {**base, **inputs}
    cfg = n["data"]["inputs"].get("agentModelConfig")
    if isinstance(cfg, dict):
        n["data"]["inputs"]["agentModelConfig"] = {"credential": "", **cfg, "modelName": MODEL, "temperature": 0,
                                                   "maxTokensToSample": MAX_TOKENS}
    n["selected"] = n["data"]["selected"] = False
    for a in n["data"].get("outputAnchors", []):
        a["id"] = a["id"].replace(old, nid)
    nodes.append(n)
    return n


def link(src, dst, out=None, label=None):
    sh = "%s-output-%s" % (src["id"], src["data"]["name"] if out is None else out)
    data = {"sourceColor": src["data"]["color"], "targetColor": dst["data"]["color"], "isHumanInput": False}
    if label is not None:
        data["edgeLabel"] = label
    edges.append({"source": src["id"], "sourceHandle": sh, "target": dst["id"], "targetHandle": dst["id"],
                  "data": data, "type": "agentFlow", "id": "%s-%s-%s-%s" % (src["id"], sh, dst["id"], dst["id"])})


CALCULATOR = [{"agentSelectedTool": "calculator", "agentSelectedToolRequiresHumanInput": "",
               "agentSelectedToolConfig": {"agentSelectedTool": "calculator"}}]

COMMON_RULES = (
    "Rules for every number: compute it from the records you were given, use the calculator tool for sums, "
    "ratios and percentages, never estimate or round before the final value, keep currency in GBP. "
    "Keep identifiers (PO numbers, PROJECT codes, WBS elements, INITIATIVE codes) exactly as given; never match "
    "records by name or description. Return only valid JSON - no prose, no markdown fences."
)


def agent(label, x, y, state_key, system, user, tools=CALCULATOR):
    return add("agentAgentflow", label, x, y, {
        "agentMessages": [{"role": "system", "content": para(system)}],
        "agentTools": tools,
        "agentEnableMemory": False,
        "agentUserMessage": user,
        "agentReturnResponseAs": "assistantMessage",
        "agentStructuredOutput": "",
        "agentUpdateState": [{"key": state_key, "value": p(mention("output"))}],
    })


# which payload sections each agent writes (Merge Sections reads these state keys)
GRAIN_STATE = {
    "grain_commercial": ["pos"],
    "grain_financial": ["projects", "activities", "activity_mapping", "reg_activities"],
    "grain_analytical": ["investments", "submissions", "investment_breakdowns"],
    "reconciliation": ["meta", "summary", "exceptions", "checks", "requirements"],
}
STATE = ["raw_sheets", "workbook"] + list(GRAIN_STATE) + ["payload", "validation", "patches"]


def function_code(name):
    """Custom Function source from functions/, with build-time constants filled in."""
    code = open(os.path.join(HERE, "functions", name)).read()
    return (code.replace("__PAYLOAD_SCHEMA__", PAYLOAD_SCHEMA_TEXT)
                .replace("__SECTION_STATE__", json.dumps(GRAIN_STATE))
                .replace("__REQUIRED_KEYS__", json.dumps(REQUIRED_KEYS)))


def schema_for(keys):
    return json.dumps({k: PAYLOAD_SCHEMA[k] for k in keys}, separators=(",", ":"), ensure_ascii=False)


def refs(*keys):
    return "".join(p("%s:" % k) + p(mention("$flow.state." + k)) for k in keys)


# ------------------------------------------------------------------ 1. ingest
start = add("startAgentflow", "Start", -1000, 400, {
    "startInputType": "formInput",
    "formTitle": "Cost Granularity Insights",
    "formDescription": "Link to the input workbook (Cost Granularity ... with PO Allocation.xlsx). Its sheets and columns must not change.",
    "formInputTypes": [
        {"type": "string", "label": "Workbook URL (.xlsx)", "name": "workbook_url", "addOptions": ""},
        {"type": "string", "label": "Notes for the analysts (optional)", "name": "notes", "addOptions": ""},
    ],
    "startEphemeralMemory": "",
    "startState": [{"key": k, "value": ""} for k in STATE],
    "startPersistState": "",
})
fetch = add("httpAgentflow", "Fetch Workbook", -790, 400, {
    "method": "GET", "url": p(mention("$form.workbook_url")), "headers": "", "queryParams": "",
    "bodyType": "", "body": "", "responseType": "arraybuffer",
})
extract = add("customFunctionAgentflow", "Extract Sheets to Rows", -580, 400, {
    "customFunctionInputVariables": [{"variableName": "workbook_file", "variableValue": p(mention(fetch["id"]))},
                                     {"variableName": "workbook_url", "variableValue": p(mention("$form.workbook_url"))}],
    "customFunctionJavascriptFunction": function_code("extract_sheets.js"),
    "customFunctionUpdateState": [{"key": "raw_sheets", "value": p(mention("output"))}],
})
link(start, fetch)
link(fetch, extract)

# ------------------------------------------------------------------ 2. standardise
standardise = agent("Data Standardisation Agent", -330, 400, "workbook", (
    "You are the data standardisation agent for a project cost-granularity controller. You receive the raw rows of "
    "an Excel workbook as {\"source\": {...}, \"sheets\": {\"<sheet name>\": [{\"row\": <Excel row number>, \"cells\": [values by column position]}]}} and must return clean, standardised tables. The workbook is a fixed input contract: these "
    "sheets, with exactly these header columns, mapped by position to these field names:\n"
    + COLUMN_CONTRACT_TEXT + "\n\n"
    "Steps:\n"
    "1. Find each sheet's header row (PO Summary and Actual Allocation have title rows above it) and check it against "
    "the contract. If a sheet is missing or its columns differ, return {\"ok\": false, \"error\": \"<sheet, column "
    "position, expected vs found>\"} and nothing else.\n"
    "2. Map every data row positionally to the field names (SAP Data repeats 'Project Definition' and 'WBS Element': "
    "the first is the code, the second the name / description) and add \"_row\" = the row's Excel row number.\n"
    "3. Types: amounts and percentages as numbers; a number stored as text (e.g. '1.43877642336E8') becomes a number "
    "and is logged; a value that is not a number (e.g. contains 'PROJECT 0001', an anonymisation artefact) becomes "
    "null and is logged as quarantined with the raw value. Excel serial dates become ISO dates. SAP period header "
    "'1PROJECT 0001' is period 10.\n"
    "4. Pivot sheets are only control totals: fill their group keys down, drop '(blank)' rows, and return "
    "pivot_controls instead of rows - SAPPivot: row count, Σ 'Sum of YTD TOTAL', list of WBS elements; "
    "CopperPivot: row count and {InvestmentCode: Sum of IDTTotalECC as the pivot shows it (text counts as 0)}.\n"
    "5. Do not invent, merge, re-key or drop records, and do not correct identifiers or description typos.\n\n"
    "Return tables in columnar form to keep the output small: {\"ok\": true, \"tables\": {\"sap_data\": {\"fields\": "
    "[\"_row\", ...], \"rows\": [[...], ...]}, \"copperleaf\": {...}, \"po_summary\": {...}, \"actual_allocation\": "
    "{...}}, \"pivot_controls\": {\"sap_pivot\": {...}, \"copper_pivot\": {...}}, \"meta\": {\"sheets\": [{\"name\", "
    "\"header_row\", \"records\", \"columns\"}]}, \"cleaning_log\": [{\"sheet\", \"row\", \"field\", \"raw\", "
    "\"action\": \"parsed_text_number\" | \"quarantined\" | \"filled_down\" | \"dropped_blank\"}]}.\n" + COMMON_RULES),
    p("Raw sheet rows:") + p(mention("$flow.state.raw_sheets")) + p("Analyst notes:", mention("$form.notes")),
    tools="")
link(extract, standardise)

# ------------------------------------------------------------------ 3. one agent per grain, in parallel
# Each grain agent writes its frontend sections directly (see GRAIN_STATE). Cross-grain fields it needs
# (PO allocations on a WBS, investment attribution) it computes from the standardised tables itself; the
# Reconciliation & Controls Agent then checks that the three grains agree.
TABLES = p("Standardised workbook (columnar tables):") + p(mention("$flow.state.workbook"))
GRAIN_COMMON = (
    "You write part of the JSON document the Cost Granularity Controller frontend loads from GET /api/insights. "
    "Your sections must match this shape exactly - same keys and nesting, numbers as numbers, ratios as fractions "
    "(0.42 not 42) except attributed_pct and pct_of_wbs, which are percentages:\n")


def grain_agent(label, y, state_key, page, task, extra_keys):
    keys = GRAIN_STATE[state_key]
    return agent(label, 0, y, state_key, (
        GRAIN_COMMON + schema_for(keys) + "\n\n"
        "The frontend page you feed: \"" + page + "\"\n\n" + task + "\n"
        "Return {" + ", ".join('"%s": ...' % k for k in keys + extra_keys) + "} and nothing else.\n" + COMMON_RULES),
        TABLES)


commercial = grain_agent(
    "Commercial Approval Agent", 120, "grain_commercial",
    "Each summary PO with its committed value and posted actual. Expand a PO to see how its actual is allocated "
    "across projects and WBS elements, and whether that allocation reconciles to SAP.",
    "You own the commercial-approval grain: purchase orders as COUPA approves them (requirements G3, G4, EFF-002, "
    "EFF-003, GRN-002, GRN-004, GRN-007, SUP-004).\n"
    "Use tables po_summary and actual_allocation, and sap_data / copperleaf only to reconcile the allocation lines.\n"
    "- pos: one entry per PO in PO Summary order. value, actual posted, remaining_commitment (value - posted), "
    "consumed (posted / value), wbs_count, project_count, pending_review (lines not 'Approved'), a per-project split "
    "(allocated, wbs_count, SAP project YTD), and every allocation line: allocation %, calculated, manual adjustment, "
    "final allocated, origin = 'governed allocation (<rule>)', SAP YTD on the same WBS element, total allocated to "
    "that WBS across all POs, sap_coverage = that total / SAP YTD (null if SAP YTD <= 0), regulatory activity and "
    "Person Responsible from SAP, and the linked investments (Copperleaf rows whose SAPProject is the line's project).\n"
    "- line flags: 'WBS not in SAP extract', 'project differs from SAP', 'investment ID differs from SAP', 'dummy "
    "regulatory activity' (SAP activity description contains 'dummy' or 'pending correct'), 'allocated > SAP "
    "posted', 'calculated allocation arithmetic' (% x PO actual != calculated), 'final allocation arithmetic' "
    "(calculated + adjustment != final), 'PO actual differs from PO Summary'.\n"
    "- PO checks: allocation % totals 100, allocated total = actual posted, within commitment, the stated PO Summary "
    "totals recalculate.\n"
    "- checks: control totals in the checks shape, group 'COUPA / allocation'.\n"
    "- alloc_by_wbs: {\"<wbs>\": Σ final allocated} across all POs.",
    ["checks", "alloc_by_wbs"])

financial = grain_agent(
    "Financial Posting Agent", 400, "grain_financial",
    "SAP S/4 actuals by project and WBS element, with the regulatory activity, investment attribution and PO "
    "allocations that land on each element.",
    "You own the financial-posting grain: actuals as SAP S/4 posts them (requirements WBS-001, WBS-004, "
    "ACT-001..ACT-005, FOR-008, INT-001, INT-005).\n"
    "Use table sap_data and pivot_controls.sap_pivot; actual_allocation for the PO allocations on each WBS element; "
    "copperleaf for the investments attributed to each project. YTD TOTAL is the authoritative actual; the posting-"
    "period columns show phasing only (report which periods are populated and how their sum compares with YTD).\n"
    "- projects: one per Project Definition, sorted ascending by project code. Name, Person Responsible, initiative, "
    "scheme ref, company, regulatory activities, dummy_activity (+ value), ytd, gross debits, credits, periods, "
    "wbs_count; attribution from Copperleaf (attributed_pct = Σ PercentageOfWBS of linked investments, "
    "attributed_actual = ytd x that % / 100, unattributed_actual, the investments with their pct_of_wbs and "
    "attributed_actual, pac_codes, in_copperleaf); po_allocated and po_numbers from actual_allocation; "
    "exception_count (flagged WBS rows + allocation lines over SAP).\n"
    "- wbs: one row per SAP WBS element of the project: wbs, wbs_description, activity, activity_rules, level (number "
    "of '-' separated code segments), ytd, periods, period_sum, reg_activity, reg_activity_description, "
    "dummy_activity (description contains 'dummy' or 'pending correct'), person_responsible, initiative_id, "
    "scheme_ref, company_code, po_allocated (Σ final allocated on the element) and flags.\n"
    "- activity: normalise the description (strip numbering like '4.24 ', fix 'Affiars', 'Evironmental', "
    "'Accomodation', singular 'NG Overheads' -> 'NG Overhead'); record the rules applied.\n"
    "- flags: 'summary-level posting' (level <= 2, non-zero YTD), 'non-specific description' (description 'All'), "
    "'credit balance' (YTD < 0), 'large reversal P<n>' (period credit <= -100,000), 'fully reversed' (YTD 0 with "
    "period movement), 'allocated > SAP posted' (po_allocated > ytd).\n"
    "- tree: nodes from the WBS code segments split on '-' (id = joined prefix, label = last segment, level = depth), "
    "each node rolling up ytd, periods and po_allocated of its descendants; posting leaves carry own_ytd, description, "
    "activity, flags, posting=true. This drives the Projects & WBS dropdown and tree.\n"
    "- activities (with po_allocated per activity), activity_mapping (origin 'system-derived', version 'v1-agent') "
    "and reg_activities.\n"
    "- checks (group 'SAP S/4'): SAP Data YTD total = SAPPivot total, row counts, every WBS in the pivot, Σ periods = "
    "YTD. Also return periods, period_totals and sap_total for the summary.",
    ["checks", "periods", "period_totals", "sap_total"])

analytical = grain_agent(
    "Analytical Reporting Agent", 680, "grain_analytical",
    "Regulatory submission → investment → SAP project → WBS → actual (BR-001, BR-003). Planned cost comes from "
    "Copperleaf; actual is SAP YTD attributed by each investment's % of WBS.",
    "You own the analytical-reporting grain: investment plans as Copperleaf holds them for regulatory submissions "
    "(requirements BR-001, BR-003, INV-001, INV-003, INV-007, SUP-006, INT-004, INT-005).\n"
    "Use table copperleaf, pivot_controls.copper_pivot, the cleaning log, and SAP project YTD totals from sap_data.\n"
    "- investments: every Copperleaf row. link_status = 'linked' when SAPProject is a 'PROJECT ...' code and "
    "PercentageOfWBS > 0; 'no SAP project' when blank; otherwise 'invalid reference'. ecc_status ok / text / invalid "
    "(quarantined) from the cleaning log, keeping the raw value. attributed_actual = SAP project YTD x "
    "PercentageOfWBS / 100, and the SAP project's WBS elements.\n"
    "- submissions: group by FinalSubmissionInvIdT3 (fall back to InvIdCode). The same ECC is repeated on several "
    "investment rows of a submission: count each distinct value once (ecc_counted on the first row, 'duplicate ECC' "
    "flag on the rest); report ecc_naive, ecc and duplicate_exposure; attributed actual and spend_to_plan = "
    "attributed / ecc.\n"
    "- investment_breakdowns by product, intervention_driver, funding_position, area: Σ ecc_counted, count, Σ "
    "attributed.\n"
    "- coverage per SAP project: Σ PercentageOfWBS of linked investments, attributed and unattributed actual.\n"
    "- checks (group 'Copperleaf'): Σ validated ECC = CopperPivot Σ (name the investments the pivot counts as 0), "
    "row counts, quarantined values, duplicate exposure.",
    ["checks", "coverage"])
grains = (commercial, financial, analytical)
for g in grains:
    link(standardise, g)

# ------------------------------------------------------------------ 4. reconcile and controls (join: waits for all three)
recon = agent("Reconciliation & Controls Agent", 360, 400, "reconciliation", (
    GRAIN_COMMON + schema_for(GRAIN_STATE["reconciliation"]) + "\n\n"
    "You reconcile the three grain agents (commercial approval = POs, financial posting = SAP, analytical reporting "
    "= Copperleaf investments; guardrail G2, GRN-001) and write the cross-cutting sections.\n"
    "1. corrections: wherever the same fact disagrees between grains - SAP YTD per WBS / project in the PO lines vs "
    "the financial grain, po_allocated per WBS vs alloc_by_wbs, attribution per project vs the analytical coverage, "
    "project codes referenced by one grain but missing in another - recompute it from the standardised tables and "
    "return a JSON Patch (RFC 6902) operation against the section as the grain agent returned it (projects are "
    "sorted by code; pos and investments keep their order): {\"op\": \"replace\", \"path\": \"/projects/3/ytd\", "
    "\"value\": ..., \"reason\": \"...\"}. Return [] when the grains agree.\n"
    "2. exceptions: one per breach - WBS / PO / allocation / investment / submission flags from the grain agents, "
    "plus breaches only visible across grains (Σ PO allocations > SAP posted on a WBS: second-ledger risk, BR-005 / "
    "GRN-005; SAP actual not attributed to any investment) - with id EXC-nnn, rule, requirement, severity (high / "
    "medium / low / info), title, detail, entity_type, entity_id, project, owner (SAP Person Responsible where "
    "known), value, source; sorted by severity then |value|, ids numbered in that order.\n"
    "3. checks: every grain agent's checks plus cross-grain checks (group 'Cross-grain': allocations <= SAP per WBS; "
    "SAP actual attributed to investments).\n"
    "4. requirements: every requirement below, with status met / partial / gap / 'not evidenced', metric, evidence, "
    "page (Overview, Purchase Orders, Projects & WBS, Investment Traceability, Activity Analysis, Exceptions, Data "
    "Quality) and exceptions (count of breaches citing it). 'not evidenced' when the workbook has no data for it; "
    "'gap' when a high-severity breach exists.\n" + REQUIREMENTS_TEXT + "\n"
    "5. summary, after applying your corrections, so every KPI agrees with the sections: sap_ytd (Σ projects.ytd), "
    "gross debits and credits, project / wbs / po counts, po_value, po_actual_posted, po_remaining, allocation_lines, "
    "investment / submission counts, planned_ecc (Σ submissions.ecc), planned_ecc_naive, planned_ecc_quarantined "
    "(recoverable candidates), attributed / unattributed actual, attribution_pct, dummy_activity value and pct of "
    "gross debits, exceptions and exceptions_by_severity, checks pass / warn / fail counts, requirements_status "
    "counts, periods and period_totals.\n"
    "6. meta: source file name, generated timestamp, currency GBP, activity_mapping_version, sheets (from the "
    "standardisation meta).\n"
    "Return {\"corrections\": [...], " + ", ".join('"%s": ...' % k for k in GRAIN_STATE["reconciliation"])
    + "} and nothing else.\n" + COMMON_RULES),
    TABLES + refs("grain_commercial", "grain_financial", "grain_analytical"))
for g in grains:
    link(g, recon)

merge = add("customFunctionAgentflow", "Merge Sections", 680, 400, {
    "customFunctionInputVariables": "",
    "customFunctionJavascriptFunction": function_code("merge_sections.js"),
    "customFunctionUpdateState": [{"key": "payload", "value": p(mention("output"))}],
})
link(recon, merge)

corrections = add("customFunctionAgentflow", "Apply Corrections", 900, 400, {
    "customFunctionInputVariables": [{"variableName": "patch_key", "variableValue": p("reconciliation")}],
    "customFunctionJavascriptFunction": function_code("apply_patches.js"),
    "customFunctionUpdateState": [{"key": "payload", "value": p(mention("output"))}],
})
link(merge, corrections)

# ------------------------------------------------------------------ 7. validate and repair (after the last join)
validate = add("customFunctionAgentflow", "Validate Payload Schema", 1120, 400, {
    "customFunctionInputVariables": "",
    "customFunctionJavascriptFunction": function_code("validate_payload.js"),
    "customFunctionUpdateState": [{"key": "validation", "value": p(mention("output"))}],
})
link(corrections, validate)

cond = add("conditionAgentflow", "Payload valid?", 1340, 400, {
    "conditions": [{"type": "string", "value1": p(mention("$flow.state.validation")), "operation": "contains",
                    "value2": '<p>"valid":true</p>'}],
})
for prm in cond["data"]["inputParams"]:
    if prm.get("name") == "conditions":
        prm["default"] = cond["data"]["inputs"]["conditions"]
cond["data"]["outputAnchors"] = [
    {"id": cond["id"] + "-output-0", "label": 0, "name": 0, "description": "Condition 0"},
    {"id": cond["id"] + "-output-1", "label": 1, "name": 1, "description": "Else"},
]
link(validate, cond)

reply = add("directReplyAgentflow", "Return Frontend JSON", 1580, 310, {"directReplyMessage": p(mention("$flow.state.payload"))})
link(cond, reply, out="0", label="0")

repair = agent("Payload Repair Agent", 1580, 510, "patches", (
    "The assembled frontend payload failed validation. You receive the validator's problems (JSON paths, the "
    "problem and the current value) and the grain agents' outputs. Fix each problem by recomputing the correct "
    "value from the grain outputs and the standardised tables. Do not rewrite sections and do not touch paths that were not reported.\n"
    "Return a JSON Patch array (RFC 6902): [{\"op\": \"replace\" | \"add\" | \"remove\", \"path\": \"/pos/2/"
    "remaining_commitment\", \"value\": ...}].\n" + COMMON_RULES),
    TABLES + refs("validation", "grain_commercial", "grain_financial", "grain_analytical"))
apply = add("customFunctionAgentflow", "Apply Patches", 1810, 510, {
    "customFunctionInputVariables": [{"variableName": "patch_key", "variableValue": p("patches")}],
    "customFunctionJavascriptFunction": function_code("apply_patches.js"),
    "customFunctionUpdateState": [{"key": "payload", "value": p(mention("output"))}],
})
retry = add("loopAgentflow", "Re-validate", 2040, 510, {
    "loopBackToNode": "%s-%s" % (validate["id"], validate["data"]["label"]), "maxLoopCount": 2})
link(cond, repair, out="1", label="1")
link(repair, apply)
link(apply, retry)

# ------------------------------------------------------------------ notes
add("stickyNoteAgentflow", "Sticky Note", -1000, 60, {"note": (
    "Cost Granularity Insights\n\n"
    "Standardise -> 3 grain agents in parallel (commercial approval / financial posting / analytical reporting) -> "
    "reconcile & controls -> merge -> apply corrections -> validate (repair loop) -> frontend JSON (GET /api/insights "
    "shape).\n\n"
    "Custom Function nodes (functions/*.js) do no business logic: unzip, merge, apply patches, validate.\n\n"
    "Needs an Anthropic credential on every Agent node (model " + MODEL + "), and HTTP_SECURITY_CHECK=false if the "
    "workbook URL is on localhost or a private network.")})
add("stickyNoteAgentflow", "Sticky Note", 360, 80, {"note": (
    "Join: the Reconciliation & Controls Agent waits for all 3 grain agents. No Condition sits before it - "
    "downstream of a Condition, a join fires on its first input.\n\n"
    "It returns its fixes as JSON patches (corrections), applied before validation, so the grain sections are "
    "never rewritten.")})
add("stickyNoteAgentflow", "Sticky Note", 0, -160, {"note": (
    "One agent per grain, each writing its frontend page's data: Commercial Approval -> pos (Purchase Orders); "
    "Financial Posting -> projects + activities (Projects & WBS, Activity Analysis); Analytical Reporting -> "
    "investments + submissions (Investment Traceability).")})

json.dump({"nodes": nodes, "edges": edges}, open(OUT, "w"), indent=2, ensure_ascii=False)
kinds = {}
for n in nodes:
    kinds[n["data"]["name"]] = kinds.get(n["data"]["name"], 0) + 1
print("wrote", OUT, len(nodes), "nodes", len(edges), "edges", kinds)

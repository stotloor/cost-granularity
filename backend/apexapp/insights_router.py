"""Read-only insight routes over the cost_granularity database (see insights.py, pgsource.py)."""
from fastapi import APIRouter, HTTPException

from . import insights, pgsource

router = APIRouter(prefix="/api/insights")

SECTIONS = {
    "meta", "summary", "pos", "projects", "investments", "submissions", "investment_breakdowns",
    "activities", "activity_mapping", "reg_activities", "exceptions", "checks", "requirements",
}


def _data():
    try:
        return insights.to_json(insights.compute())
    except pgsource.SourceUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except pgsource.SchemaMismatch as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("")
def all_insights():
    return _data()


@router.get("/pos/{po_number}")
def po_detail(po_number: str):
    for p in _data()["pos"]:
        if p["po_number"] == po_number:
            return p
    raise HTTPException(status_code=404, detail="Unknown PO: " + po_number)


@router.get("/projects/{project}")
def project_detail(project: str):
    for p in _data()["projects"]:
        if p["project"] == project:
            return p
    raise HTTPException(status_code=404, detail="Unknown project: " + project)


@router.get("/{section}")
def section(section: str):
    if section not in SECTIONS:
        raise HTTPException(status_code=404, detail="Unknown insight section: " + section)
    return _data()[section]

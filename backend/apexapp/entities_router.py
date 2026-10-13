"""Generic CRUD routes for every entity (capabilities 9, 11, 22)."""
from fastapi import APIRouter, Depends, HTTPException, Request

from . import crud, events, rbac
from .schema import ENTITIES

router = APIRouter(prefix="/api/entities")


def _check(table: str):
    if table not in ENTITIES:
        raise HTTPException(status_code=404, detail="Unknown entity: " + table)


@router.get("/{table}")
def list_rows(table: str, request: Request, user=Depends(rbac.current_user)):
    _check(table)
    return crud.list_rows(table, dict(request.query_params))


@router.post("/{table}", status_code=201)
async def create_row(table: str, request: Request, user=Depends(rbac.require_write)):
    _check(table)
    data = await request.json()
    row = crud.create_row(table, data)
    events.broadcast({"type": "change", "entity": table, "action": "create", "id": row["id"]})
    return row


@router.get("/{table}/{id}")
def get_row(table: str, id: str, user=Depends(rbac.current_user)):
    _check(table)
    row = crud.get_row(table, id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@router.patch("/{table}/{id}")
async def update_row(table: str, id: str, request: Request, user=Depends(rbac.require_write)):
    _check(table)
    data = await request.json()
    row = crud.update_row(table, id, data)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    events.broadcast({"type": "change", "entity": table, "action": "update", "id": id})
    return row


@router.delete("/{table}/{id}", status_code=200)
def delete_row(table: str, id: str, user=Depends(rbac.require_delete)):
    _check(table)
    if not crud.delete_row(table, id):
        raise HTTPException(status_code=404, detail="Not found")
    events.broadcast({"type": "change", "entity": table, "action": "delete", "id": id})
    return {"ok": True}

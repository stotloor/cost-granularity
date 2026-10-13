"""Generic server-side proxy for configured integrations (capabilities 15, 16)."""
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import integrations, rbac

router = APIRouter(prefix="/api/integrations")


class ProxyRequest(BaseModel):
    path: str = ""
    method: str = "GET"
    params: dict | None = None
    json_body: dict | None = None


@router.get("")
def list_integrations(user=Depends(rbac.current_user)):
    return {"integrations": list(integrations.INTEGRATIONS.keys())}


@router.get("/public/maps-key")
def public_maps_key():
    """
    Unauthenticated: returns ONLY the Google Maps JS key (if configured). This key is
    designed to be used client-side (restricted by HTTP referrer in Google Cloud
    Console), unlike every other integration secret which stays server-side only.
    """
    return {"key": os.environ.get("GOOGLE_MAPS_API_KEY", "")}


@router.post("/{name}")
def call(name: str, body: ProxyRequest, user=Depends(rbac.current_user)):
    cfg = integrations.config(name)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown integration: " + name)
    headers = {}
    sec = integrations.secret(cfg)
    if sec:
        headers[cfg.get("header", "Authorization")] = cfg.get("prefix", "Bearer ") + sec
    url = cfg["base_url"].rstrip("/") + "/" + body.path.lstrip("/")
    try:
        r = httpx.request(body.method, url, params=body.params,
                          json=body.json_body, headers=headers, timeout=30)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Integration call failed: " + str(exc))
    ctype = r.headers.get("content-type", "")
    if ctype.startswith("application/json"):
        return r.json()
    return {"status": r.status_code, "text": r.text}

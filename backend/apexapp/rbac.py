"""FastAPI auth dependencies and role guards (capability 13)."""
from fastapi import Depends, Header, HTTPException

from . import auth
from .schema import WRITE_ROLES, DELETE_ROLES


def current_user(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = auth.verify_token(authorization[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"id": payload["sub"], "role": payload["role"]}


def require_write(user=Depends(current_user)):
    if user["role"] not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Requires role: " + ", ".join(WRITE_ROLES))
    return user


def require_delete(user=Depends(current_user)):
    if user["role"] not in DELETE_ROLES:
        raise HTTPException(status_code=403, detail="Requires role: " + ", ".join(DELETE_ROLES))
    return user

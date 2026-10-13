"""File upload + download backed by disk storage (capability 18)."""
import datetime, os, uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from . import db, rbac

UPLOAD_DIR = os.environ.get(
    "APEX_UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api/files")


@router.post("")
async def upload(file: UploadFile = File(...), user=Depends(rbac.current_user)):
    fid = uuid.uuid4().hex
    safe = os.path.basename(file.filename or "file")
    path = os.path.join(UPLOAD_DIR, fid + "_" + safe)
    with open(path, "wb") as fh:
        fh.write(await file.read())
    with db._lock, db.connect() as conn:
        conn.execute(
            "INSERT INTO files (id, filename, path, created_at) VALUES (?,?,?,?)",
            (fid, safe, path, datetime.datetime.now(datetime.timezone.utc).isoformat()),
        )
    return {"id": fid, "filename": safe, "url": "/api/files/" + fid}


@router.get("/{id}")
def download(id: str):
    with db._lock, db.connect() as conn:
        row = conn.execute("SELECT * FROM files WHERE id = ?", (id,)).fetchone()
    if not row or not os.path.exists(row["path"]):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(row["path"], filename=row["filename"])

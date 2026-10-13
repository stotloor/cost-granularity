"""Registration, login and profile (capability 12, Wave 1 #2 emails)."""
import datetime, uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import auth, db, rbac, emails

router = APIRouter(prefix="/api/auth")


class Register(BaseModel):
    email: str
    password: str
    role: str | None = None


class Login(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: Register):
    with db._lock, db.connect() as conn:
        exists = conn.execute("SELECT 1 FROM users WHERE email = ?", (body.email,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Email already registered")
        first = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0
        # Only the very first user bootstraps as admin. Self-registration can
        # never request an elevated role; an admin promotes users out of band.
        role = "admin" if first else "viewer"
        uid = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?,?,?,?,?)",
            (uid, body.email, auth.hash_password(body.password), role,
             datetime.datetime.now(datetime.timezone.utc).isoformat()),
        )
    user = {"id": uid, "email": body.email, "role": role}
    emails.send_email(body.email, "welcome")
    return {"token": auth.make_token(uid, role), "user": user}


@router.post("/login")
def login(body: Login):
    with db._lock, db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    if not row or not auth.verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = {"id": row["id"], "email": row["email"], "role": row["role"]}
    return {"token": auth.make_token(row["id"], row["role"]), "user": user}


@router.get("/me")
def me(user=Depends(rbac.current_user)):
    with db._lock, db.connect() as conn:
        row = conn.execute("SELECT id, email, role FROM users WHERE id = ?", (user["id"],)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)

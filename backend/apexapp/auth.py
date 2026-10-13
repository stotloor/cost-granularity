"""Password hashing (pbkdf2) and HMAC-signed bearer tokens (no external deps)."""
import base64, hashlib, hmac, json, os, secrets, time

SECRET = os.environ.get("APEX_SECRET", "dev-secret-change-me")


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 100_000)
    return base64.b64encode(salt).decode() + ":" + base64.b64encode(dk).decode()


def verify_password(pw: str, stored: str) -> bool:
    try:
        s, h = stored.split(":")
        salt = base64.b64decode(s)
        expected = base64.b64decode(h)
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 100_000)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _ub64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(sub: str, role: str, ttl: int = 86400) -> str:
    payload = {"sub": sub, "role": role, "exp": int(time.time()) + ttl}
    body = _b64(json.dumps(payload).encode())
    sig = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return body + "." + sig


def verify_token(token: str):
    try:
        body, sig = token.split(".")
        expected = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_ub64(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

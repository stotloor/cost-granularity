"""SQLite connection + schema init. Swap DATABASE handling here for Postgres."""
import os, sqlite3, threading

from .schema import ENTITIES

DB_PATH = os.environ.get(
    "APEX_DB", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data.db")
)
_lock = threading.Lock()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock, connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users ("
            "id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, "
            "role TEXT, created_at TEXT)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS files ("
            "id TEXT PRIMARY KEY, filename TEXT, path TEXT, created_at TEXT)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS subscriptions ("
            "id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, status TEXT, "
            "provider TEXT, created_at TEXT)"
        )
        for table, meta in ENTITIES.items():
            cols = ", ".join('"%s" %s' % (c["name"], c["sqlite"]) for c in meta["columns"])
            extra = (", " + cols) if cols else ""
            conn.execute(
                'CREATE TABLE IF NOT EXISTS "%s" (id TEXT PRIMARY KEY%s, created_at TEXT)'
                % (table, extra)
            )
    from .seed import run_seed
    run_seed()

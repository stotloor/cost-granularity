"""Generic CRUD over the sqlite tables described in schema.ENTITIES."""
import datetime, uuid

from . import db
from .schema import ENTITIES

CONTROL = {"q", "sort", "order", "limit", "offset"}


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _cols(table: str):
    return [c["name"] for c in ENTITIES[table]["columns"]]


def list_rows(table: str, params: dict):
    cols = _cols(table)
    where, args = [], []
    for k, v in params.items():
        if k in CONTROL:
            continue
        if k in cols:
            where.append('"%s" = ?' % k)
            args.append(v)
    if params.get("q") and cols:
        like = "(" + " OR ".join('CAST("%s" AS TEXT) LIKE ?' % c for c in cols) + ")"
        where.append(like)
        args += ["%" + params["q"] + "%"] * len(cols)

    sql = 'SELECT * FROM "%s"' % table
    if where:
        sql += " WHERE " + " AND ".join(where)

    sort = params.get("sort")
    if sort in cols or sort in ("created_at", "id"):
        order = "DESC" if params.get("order") == "desc" else "ASC"
        sql += ' ORDER BY "%s" %s' % (sort, order)

    if params.get("limit") is not None:
        try:
            sql += " LIMIT %d OFFSET %d" % (int(params["limit"]), int(params.get("offset") or 0))
        except (TypeError, ValueError):
            pass

    with db._lock, db.connect() as conn:
        rows = conn.execute(sql, args).fetchall()
    return [dict(r) for r in rows]


def get_row(table: str, id: str):
    with db._lock, db.connect() as conn:
        r = conn.execute('SELECT * FROM "%s" WHERE id = ?' % table, (id,)).fetchone()
    return dict(r) if r else None


def create_row(table: str, data: dict):
    cols = _cols(table)
    clean = {k: data[k] for k in data if k in cols}
    clean["id"] = uuid.uuid4().hex
    clean["created_at"] = _now()
    keys = list(clean.keys())
    placeholders = ", ".join("?" for _ in keys)
    col_sql = ", ".join('"%s"' % k for k in keys)
    with db._lock, db.connect() as conn:
        conn.execute(
            'INSERT INTO "%s" (%s) VALUES (%s)' % (table, col_sql, placeholders),
            [clean[k] for k in keys],
        )
    return clean


def update_row(table: str, id: str, data: dict):
    cols = _cols(table)
    clean = {k: data[k] for k in data if k in cols}
    if not clean:
        return get_row(table, id)
    sets = ", ".join('"%s" = ?' % k for k in clean)
    with db._lock, db.connect() as conn:
        cur = conn.execute(
            'UPDATE "%s" SET %s WHERE id = ?' % (table, sets),
            [clean[k] for k in clean] + [id],
        )
        if cur.rowcount == 0:
            return None
    return get_row(table, id)


def delete_row(table: str, id: str) -> bool:
    with db._lock, db.connect() as conn:
        cur = conn.execute('DELETE FROM "%s" WHERE id = ?' % table, (id,))
        return cur.rowcount > 0

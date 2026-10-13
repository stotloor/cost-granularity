"""AI connector (capability 17, Wave 1 #3): chat, summarize, translate, extract, RAG."""
import hashlib, json, os, sqlite3

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import db, rbac

router = APIRouter(prefix="/api/ai")
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")


def _ai_call(messages: list, system: str | None = None, max_tokens: int = 1024):
    """Helper to call Claude API or simulate."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        last = next((m.get("content", "") for m in reversed(messages)
                     if m.get("role") == "user"), "")
        return {"reply": "[simulated AI] " + (str(last)[:400] or "Hello!"), "simulated": True}
    payload = {"model": MODEL, "max_tokens": max_tokens, "messages": messages}
    if system:
        payload["system"] = system
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            json=payload,
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
            timeout=60,
        )
        r.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI request failed: " + str(exc))
    data = r.json()
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    return {"reply": text, "simulated": False}


class ChatRequest(BaseModel):
    messages: list
    system: str | None = None
    max_tokens: int | None = 1024


class TextRequest(BaseModel):
    text: str
    context: str | None = None


class ExtractRequest(BaseModel):
    text: str
    schema: dict


@router.post("/chat")
def chat(body: ChatRequest, user=Depends(rbac.current_user)):
    return _ai_call(body.messages, body.system, body.max_tokens or 1024)


@router.post("/summarize")
def summarize(body: TextRequest, user=Depends(rbac.current_user)):
    prompt = f"Summarize this text in 2-3 sentences:\n\n{body.text}"
    return _ai_call([{"role": "user", "content": prompt}], max_tokens=512)


@router.post("/translate")
def translate(body: TextRequest, user=Depends(rbac.current_user)):
    lang = body.context or "Spanish"
    prompt = f"Translate this text to {lang}:\n\n{body.text}"
    return _ai_call([{"role": "user", "content": prompt}], max_tokens=2048)


@router.post("/extract")
def extract(body: ExtractRequest, user=Depends(rbac.current_user)):
    prompt = (
        f"Extract structured data from the text below according to this schema:\n\n"
        f"{json.dumps(body.schema, indent=2)}\n\nText:\n{body.text}\n\n"
        f"Return ONLY valid JSON matching the schema, no extra text."
    )
    result = _ai_call([{"role": "user", "content": prompt}], max_tokens=2048)
    if not result.get("simulated"):
        try:
            result["data"] = json.loads(result["reply"])
        except Exception:
            pass
    return result


# --- RAG with embeddings + vector search ---
class RAGStoreRequest(BaseModel):
    collection: str
    text: str
    metadata: dict | None = None


class RAGQueryRequest(BaseModel):
    collection: str
    query: str
    top_k: int | None = 5


def _init_rag_table():
    with db._lock, db.connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS rag_embeddings ("
            "id TEXT PRIMARY KEY, collection TEXT, text TEXT, metadata TEXT, "
            "embedding_hash TEXT, created_at TEXT)"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_collection ON rag_embeddings(collection)")


def _simple_embed(text: str) -> str:
    """Simple hash-based 'embedding' for demo. Use real embeddings API in production."""
    return hashlib.sha256(text.encode()).hexdigest()


def _cosine_sim(a: str, b: str) -> float:
    """Dummy similarity: character overlap ratio."""
    a_set = set(a.lower())
    b_set = set(b.lower())
    return len(a_set & b_set) / max(len(a_set | b_set), 1)


@router.post("/rag/store")
def rag_store(body: RAGStoreRequest, user=Depends(rbac.current_user)):
    _init_rag_table()
    import datetime, uuid
    doc_id = uuid.uuid4().hex
    emb = _simple_embed(body.text)
    with db._lock, db.connect() as conn:
        conn.execute(
            "INSERT INTO rag_embeddings (id, collection, text, metadata, embedding_hash, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (doc_id, body.collection, body.text, json.dumps(body.metadata or {}), emb,
             datetime.datetime.now(datetime.timezone.utc).isoformat()),
        )
    return {"id": doc_id, "status": "stored"}


@router.post("/rag/query")
def rag_query(body: RAGQueryRequest, user=Depends(rbac.current_user)):
    _init_rag_table()
    with db._lock, db.connect() as conn:
        rows = conn.execute(
            "SELECT id, text, metadata FROM rag_embeddings WHERE collection = ?",
            (body.collection,),
        ).fetchall()
    docs = [{"id": r["id"], "text": r["text"], "metadata": json.loads(r["metadata"]),
             "score": _cosine_sim(body.query, r["text"])} for r in rows]
    docs.sort(key=lambda d: d["score"], reverse=True)
    top = docs[: body.top_k or 5]
    context = "\n\n".join(d["text"] for d in top)
    prompt = f"Context:\n{context}\n\nQuestion: {body.query}\n\nAnswer:"
    answer = _ai_call([{"role": "user", "content": prompt}], max_tokens=1024)
    return {"answer": answer["reply"], "documents": top, "simulated": answer.get("simulated")}

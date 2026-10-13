"""In-memory SSE broker for real-time updates (capability 19)."""
import json, queue, threading

_subs = set()
_lock = threading.Lock()


def broadcast(evt: dict) -> None:
    data = json.dumps(evt)
    with _lock:
        for q in list(_subs):
            try:
                q.put_nowait(data)
            except Exception:
                pass


def subscribe_stream():
    q = queue.Queue()
    with _lock:
        _subs.add(q)
    try:
        yield "event: ping\ndata: {}\n\n"
        while True:
            try:
                data = q.get(timeout=15)
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield "data: " + data + "\n\n"
    finally:
        with _lock:
            _subs.discard(q)

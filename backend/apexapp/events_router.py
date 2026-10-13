"""Server-Sent Events stream (capability 19)."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from . import events

router = APIRouter()


@router.get("/api/events")
def stream():
    return StreamingResponse(events.subscribe_stream(), media_type="text/event-stream")

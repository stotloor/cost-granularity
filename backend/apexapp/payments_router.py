"""Payments + subscriptions via Stripe (capability 20). Simulates when unconfigured."""
import datetime, os, uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from . import db, rbac

router = APIRouter(prefix="/api/payments")


class Checkout(BaseModel):
    plan: str
    amount: int | None = None       # in the smallest currency unit (e.g. cents)
    currency: str | None = "usd"
    interval: str | None = "month"  # None for one-time payment
    success_url: str | None = None
    cancel_url: str | None = None


def _record(user_id: str, plan: str, status: str, provider: str) -> dict:
    sid = uuid.uuid4().hex
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with db._lock, db.connect() as conn:
        conn.execute(
            "INSERT INTO subscriptions (id, user_id, plan, status, provider, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (sid, user_id, plan, status, provider, now),
        )
    return {"id": sid, "user_id": user_id, "plan": plan, "status": status,
            "provider": provider, "created_at": now}


@router.post("/checkout")
def checkout(body: Checkout, user=Depends(rbac.current_user)):
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        sub = _record(user["id"], body.plan, "active", "simulated")
        return {"id": sub["id"], "url": body.success_url or "#", "simulated": True}
    try:
        import stripe
    except ImportError:
        raise HTTPException(status_code=500, detail="Install 'stripe' to enable live payments")
    stripe.api_key = key
    price = {"currency": body.currency or "usd",
             "product_data": {"name": body.plan},
             "unit_amount": body.amount or 0}
    if body.interval:
        price["recurring"] = {"interval": body.interval}
    session = stripe.checkout.Session.create(
        mode="subscription" if body.interval else "payment",
        line_items=[{"price_data": price, "quantity": 1}],
        success_url=body.success_url or "https://example.com/success",
        cancel_url=body.cancel_url or "https://example.com/cancel",
    )
    _record(user["id"], body.plan, "pending", "stripe")
    return {"id": session.id, "url": session.url, "simulated": False}


@router.get("/subscriptions")
def subscriptions(user=Depends(rbac.current_user)):
    with db._lock, db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/webhook")
async def webhook(request: Request):
    # In production, verify the signature with STRIPE_WEBHOOK_SECRET before trusting.
    try:
        event = await request.json()
    except Exception:
        event = {}
    return {"received": True, "type": event.get("type")}

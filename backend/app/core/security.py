import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# In-memory store for one-time ws-tickets
_ws_tickets: dict[str, dict] = {}

# In-memory set of refresh-token JTIs that have already been used.
# Enforces single-use refresh rotation: once a token is swapped for a new pair,
# replaying the same token is rejected. Maps jti -> expiry datetime so we can
# safely reap entries whose underlying token has expired anyway.
_used_refresh_jtis: dict[str, datetime] = {}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    # Every refresh token gets a unique jti so single-use rotation can track it.
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def mark_refresh_used(jti: str, exp_ts: int) -> bool:
    """Record that a refresh-token jti has been consumed.

    Returns False if the jti was already seen (replay attempt), True on first
    use. `exp_ts` is the token's own exp (unix seconds) — we keep it so old
    entries can be reaped.
    """
    if jti in _used_refresh_jtis:
        return False
    _used_refresh_jtis[jti] = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
    return True


def cleanup_used_refresh_jtis() -> int:
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _used_refresh_jtis.items() if now > v]
    for k in expired:
        del _used_refresh_jtis[k]
    return len(expired)


def decode_token(token: str, expected_type: str = "access") -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


def create_ws_ticket(user_id: str, room_id: str) -> str:
    ticket = uuid.uuid4().hex
    expire = datetime.now(timezone.utc) + timedelta(
        seconds=settings.WS_TICKET_EXPIRE_SECONDS
    )
    _ws_tickets[ticket] = {
        "user_id": user_id,
        "room_id": room_id,
        "expire": expire,
    }
    return ticket


def validate_ws_ticket(ticket: str) -> dict | None:
    data = _ws_tickets.pop(ticket, None)
    if data is None:
        return None
    if datetime.now(timezone.utc) > data["expire"]:
        return None
    return data


def cleanup_expired_ws_tickets() -> int:
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _ws_tickets.items() if now > v["expire"]]
    for k in expired:
        del _ws_tickets[k]
    return len(expired)

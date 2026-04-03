import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# In-memory store for one-time ws-tickets
_ws_tickets: dict[str, dict] = {}


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
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


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

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.rate_limit import (
    login_limiter,
    refresh_limiter,
    register_limiter,
    ws_ticket_limiter,
)
from app.core.security import create_ws_ticket
from app.database import get_db
from app.models.room import Room
from app.models.room_participant import RoomParticipant
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    WsTicketRequest,
    WsTicketResponse,
)
from app.services.auth_service import login_user, refresh_tokens, register_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_key(request: Request) -> str:
    """Best-effort client identifier for rate-limiting. Trusts X-Forwarded-For
    only if the server is actually behind a proxy — for MVP we just use the
    direct peer. Returns a stable per-client string.
    """
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _raise_rate_limited():
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please slow down.",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    if not register_limiter.check(_client_key(request)):
        _raise_rate_limited()
    user = await register_user(db, body.username, body.email, body.password)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    # Rate-limit by source IP *and* by target email, so one IP can't brute many
    # accounts and one account can't be brute-forced from many IPs. We RESERVE a
    # slot atomically before auth (check() records under the lock) so a burst of
    # concurrent bad logins can't all slip past a peek() before any record() lands.
    # A *successful* login releases its reservation, so only FAILED attempts
    # ultimately count — a shared NAT (e.g. a classroom) isn't locked out by
    # legitimate logins. The email key is normalized identically to the lookup
    # (`strip().lower()`) so casing/whitespace variants can't mint fresh buckets.
    ip_key = _client_key(request)
    email_key = f"email:{body.email.strip().lower()}"
    if not login_limiter.check(ip_key):
        _raise_rate_limited()
    if not login_limiter.check(email_key):
        login_limiter.release(ip_key)  # don't burn the IP slot on an email-bucket 429
        _raise_rate_limited()
    # If login_user raises (bad credentials / disabled), the reservations stay in
    # place and the failure counts. On success we give both slots back.
    result = await login_user(db, body.email, body.password)
    login_limiter.release(ip_key)
    login_limiter.release(email_key)
    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    if not refresh_limiter.check(_client_key(request)):
        _raise_rate_limited()
    return await refresh_tokens(db, body.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def ws_ticket(
    body: WsTicketRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not ws_ticket_limiter.check(f"user:{current_user.id}"):
        _raise_rate_limited()

    # User is actively coming back — cancel any pending grace timer so they
    # don't get kicked out between issuing this ticket and the WS handshake.
    # (The WS connect path also cancels the timer, but that's 1+ RTT later.)
    from app.ws.manager import manager
    manager._cancel_grace_timer(str(body.room_id), str(current_user.id))
    manager.disconnected_users.pop((str(body.room_id), str(current_user.id)), None)
    # Verify room exists and is active
    room_result = await db.execute(
        select(Room).where(Room.id == body.room_id, Room.is_active == True)
    )
    if room_result.scalar_one_or_none() is None:
        raise NotFoundError("Room not found or inactive")

    # Verify user is an active participant
    part_result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == body.room_id,
            RoomParticipant.user_id == current_user.id,
            RoomParticipant.left_at == None,
        )
    )
    if part_result.scalar_one_or_none() is None:
        raise ForbiddenError("You are not a participant of this room")

    ticket = create_ws_ticket(str(current_user.id), str(body.room_id))
    return WsTicketResponse(ticket=ticket)

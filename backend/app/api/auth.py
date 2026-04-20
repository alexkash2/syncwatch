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
    # accounts and one account can't be brute-forced from many IPs.
    if not login_limiter.check(_client_key(request)):
        _raise_rate_limited()
    if not login_limiter.check(f"email:{body.email.lower()}"):
        _raise_rate_limited()
    return await login_user(db, body.email, body.password)


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

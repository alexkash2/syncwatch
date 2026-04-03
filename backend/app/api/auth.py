from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await register_user(db, body.username, body.email, body.password)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_user(db, body.email, body.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_tokens(db, body.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def ws_ticket(
    body: WsTicketRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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

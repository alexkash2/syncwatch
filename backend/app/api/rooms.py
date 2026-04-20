import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.room import (
    JoinRoomRequest,
    ParticipantResponse,
    RoomCreate,
    RoomDetailResponse,
    RoomListResponse,
    RoomResponse,
)
from app.schemas.chat import ChatHistoryResponse, ChatMessageResponse
from app.services import room_service
from app.services.chat_service import get_history

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    body: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await room_service.create_room(db, body.name, current_user.id)
    return room


@router.get("/", response_model=RoomListResponse)
async def list_rooms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rooms, total = await room_service.get_user_rooms(db, current_user.id, page, size)
    return RoomListResponse(rooms=rooms, total=total)


@router.get("/{room_id}", response_model=RoomDetailResponse)
async def get_room(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await room_service.get_room(db, room_id, current_user.id)
    participants = [
        ParticipantResponse(
            user_id=p.user_id,
            username=p.user.username,
            is_ready=p.is_ready,
            joined_at=p.joined_at,
        )
        for p in room.participants
        if p.left_at is None
    ]
    return RoomDetailResponse(
        id=room.id,
        name=room.name,
        room_code=room.room_code,
        host_id=room.host_id,
        is_active=room.is_active,
        max_participants=room.max_participants,
        file_version=room.file_version,
        created_at=room.created_at,
        participants=participants,
        host_username=room.host.username,
    )


@router.post("/join", response_model=RoomResponse)
async def join_room(
    body: JoinRoomRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await room_service.join_room(db, body.room_code, current_user.id)
    return room


@router.post("/{room_id}/leave", status_code=status.HTTP_200_OK)
async def leave_room(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    was_host = await room_service.leave_room(db, room_id, current_user.id)
    # If the host leaves explicitly, tear down WS for everyone immediately
    # instead of waiting for host-grace-period timeout. Exclude the host from
    # the broadcast — they're already navigating away; a "host left" flash to
    # themselves is nonsense.
    if was_host:
        from app.ws.manager import manager
        await manager.close_room(
            str(room_id), "host_left", exclude_user=str(current_user.id)
        )
    return {"ok": True}


@router.delete("/{room_id}", status_code=status.HTTP_200_OK)
async def delete_room(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await room_service.delete_room(db, room_id, current_user.id)
    # Notify any active WS sessions so clients navigate out immediately.
    # Exclude the deleter (they already got a HTTP 200; they don't need the
    # "room was deleted" flash as well).
    from app.ws.manager import manager
    await manager.close_room(
        str(room_id), "deleted", exclude_user=str(current_user.id)
    )
    return {"ok": True}


# NOTE: `PUT /rooms/{id}/file-info` used to exist here but was removed.
# Setting the reference file now goes through the `file_verify_request` WS
# message, which also updates the in-memory `RoomState.verified_users` gate
# in one place. Keeping two entry points risked drifting the gate state.


@router.get("/{room_id}/messages", response_model=ChatHistoryResponse)
async def get_chat_history(
    room_id: uuid.UUID,
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify participation
    await room_service.get_room(db, room_id, current_user.id)
    messages, next_cursor = await get_history(db, room_id, cursor, limit)
    return ChatHistoryResponse(
        messages=[
            ChatMessageResponse(
                id=m.id,
                user_id=m.user_id,
                username=m.user.username,
                content=m.content,
                created_at=m.created_at,
            )
            for m in messages
        ],
        next_cursor=next_cursor,
    )

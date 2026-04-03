import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.room import (
    FileInfoRequest,
    JoinRoomRequest,
    ParticipantResponse,
    RoomCreate,
    RoomDetailResponse,
    RoomListResponse,
    RoomResponse,
)
from app.services import room_service

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
    await room_service.leave_room(db, room_id, current_user.id)
    return {"ok": True}


@router.delete("/{room_id}", status_code=status.HTTP_200_OK)
async def delete_room(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await room_service.delete_room(db, room_id, current_user.id)
    return {"ok": True}


@router.put("/{room_id}/file-info", response_model=RoomResponse)
async def update_file_info(
    room_id: uuid.UUID,
    body: FileInfoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await room_service.update_file_info(
        db, room_id, current_user.id,
        body.file_hash, body.file_size, body.file_duration_ms, body.file_name,
    )
    return room

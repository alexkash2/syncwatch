import secrets
import uuid

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.models.room import Room
from app.models.room_participant import RoomParticipant
from app.models.user import User

ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _generate_room_code() -> str:
    return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(8))


async def create_room(db: AsyncSession, name: str, host_id: uuid.UUID) -> Room:
    for attempt in range(3):
        code = _generate_room_code()
        room = Room(name=name, room_code=code, host_id=host_id)
        db.add(room)
        try:
            await db.flush()
            break
        except IntegrityError:
            await db.rollback()
            if attempt == 2:
                raise ConflictError("Failed to generate unique room code, try again")
            continue

    participant = RoomParticipant(room_id=room.id, user_id=host_id)
    db.add(participant)
    await db.commit()
    await db.refresh(room)
    return room


async def get_room(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> Room:
    result = await db.execute(
        select(Room)
        .options(selectinload(Room.participants).selectinload(RoomParticipant.user))
        .where(Room.id == room_id, Room.is_active == True)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundError("Room not found")

    # Check that user is an active participant
    is_participant = any(
        p.user_id == user_id and p.left_at is None for p in room.participants
    )
    if not is_participant:
        raise ForbiddenError("You are not a participant of this room")

    return room


async def get_user_rooms(
    db: AsyncSession, user_id: uuid.UUID, page: int = 1, size: int = 20
) -> tuple[list[Room], int]:
    subquery = (
        select(RoomParticipant.room_id)
        .where(RoomParticipant.user_id == user_id, RoomParticipant.left_at == None)
    )
    base = select(Room).where(Room.is_active == True, Room.id.in_(subquery))

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base.order_by(Room.created_at.desc()).offset((page - 1) * size).limit(size)
    )
    rooms = list(result.scalars().all())
    return rooms, total


async def join_room(db: AsyncSession, room_code: str, user_id: uuid.UUID) -> Room:
    # Lock the room row to prevent race conditions on max_participants
    result = await db.execute(
        select(Room)
        .where(Room.room_code == room_code.upper(), Room.is_active == True)
        .with_for_update()
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundError("Room not found")

    # Check if already an active participant
    existing = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room.id,
            RoomParticipant.user_id == user_id,
            RoomParticipant.left_at == None,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return room  # Already joined

    # Atomic count of active participants
    count_result = await db.execute(
        select(func.count()).select_from(
            select(RoomParticipant)
            .where(
                RoomParticipant.room_id == room.id,
                RoomParticipant.left_at == None,
            )
            .subquery()
        )
    )
    active_count = count_result.scalar_one()
    if active_count >= room.max_participants:
        raise BadRequestError("Room is full")

    participant = RoomParticipant(room_id=room.id, user_id=user_id)
    db.add(participant)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Partial unique index conflict = already joined (race condition)
        return room
    await db.refresh(room)
    return room


async def leave_room(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Returns True if the leaving user was the host (room became inactive)."""
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.user_id == user_id,
            RoomParticipant.left_at == None,
        )
    )
    participant = result.scalar_one_or_none()
    if participant is None:
        raise NotFoundError("Not a participant of this room")

    participant.left_at = func.now()

    room_result = await db.execute(select(Room).where(Room.id == room_id))
    room = room_result.scalar_one_or_none()
    was_host = bool(room and room.host_id == user_id)
    if was_host:
        room.is_active = False

    await db.commit()
    return was_host


async def delete_room(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> None:
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundError("Room not found")
    if room.host_id != user_id:
        raise ForbiddenError("Only the host can delete a room")

    room.is_active = False
    await db.commit()


async def update_file_info(
    db: AsyncSession,
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    file_hash: str,
    file_size: int,
    file_duration_ms: int,
    file_name: str,
) -> Room:
    result = await db.execute(
        select(Room).options(selectinload(Room.participants)).where(Room.id == room_id)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundError("Room not found")
    if room.host_id != user_id:
        raise ForbiddenError("Only the host can set file info")

    room.file_hash = file_hash
    room.file_size = file_size
    room.file_duration = file_duration_ms
    room.file_name = file_name
    room.file_version += 1

    for p in room.participants:
        if p.left_at is None:
            p.is_ready = False

    await db.commit()
    await db.refresh(room)
    return room

import secrets
import uuid

from sqlalchemy import func, select
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

    # Add host as participant
    participant = RoomParticipant(room_id=room.id, user_id=host_id)
    db.add(participant)
    await db.commit()
    await db.refresh(room)
    return room


async def get_room(db: AsyncSession, room_id: uuid.UUID) -> Room:
    result = await db.execute(
        select(Room)
        .options(selectinload(Room.participants))
        .where(Room.id == room_id, Room.is_active == True)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundError("Room not found")
    return room


async def get_user_rooms(
    db: AsyncSession, user_id: uuid.UUID, page: int = 1, size: int = 20
) -> tuple[list[Room], int]:
    # Rooms where user is host or active participant
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
    result = await db.execute(
        select(Room)
        .options(selectinload(Room.participants))
        .where(Room.room_code == room_code.upper(), Room.is_active == True)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundError("Room not found")

    # Check if already a participant
    active_participants = [p for p in room.participants if p.left_at is None]
    for p in active_participants:
        if p.user_id == user_id:
            return room  # Already joined

    # Check max_participants
    if len(active_participants) >= room.max_participants:
        raise BadRequestError("Room is full")

    participant = RoomParticipant(room_id=room.id, user_id=user_id)
    db.add(participant)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return room  # Race condition: already joined
    await db.refresh(room)
    return room


async def leave_room(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> None:
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

    # If host leaves, close the room
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    room = room_result.scalar_one_or_none()
    if room and room.host_id == user_id:
        room.is_active = False

    await db.commit()


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

    # Reset is_ready for all participants
    for p in room.participants:
        if p.left_at is None:
            p.is_ready = False

    await db.commit()
    await db.refresh(room)
    return room

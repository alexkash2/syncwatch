import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import validate_ws_ticket
from app.database import async_session
from app.models.room import Room
from app.models.room_participant import RoomParticipant
from app.models.user import User
from app.services.chat_service import save_message
from app.ws.manager import RoomState, manager

router = APIRouter()

MAX_CHAT_LENGTH = 2000


async def _get_participant_info(db: AsyncSession, room_id: str):
    result = await db.execute(
        select(RoomParticipant, User.username)
        .join(User, RoomParticipant.user_id == User.id)
        .where(
            RoomParticipant.room_id == uuid.UUID(room_id),
            RoomParticipant.left_at == None,
        )
    )
    participants = []
    for row in result.all():
        p, username = row
        participants.append({
            "user_id": str(p.user_id),
            "username": username,
            "is_ready": p.is_ready,
        })
    return participants


async def _get_room_info(db: AsyncSession, room_id: str) -> dict | None:
    result = await db.execute(
        select(Room).where(Room.id == uuid.UUID(room_id))
    )
    room = result.scalar_one_or_none()
    if not room:
        return None
    return {
        "host_id": str(room.host_id),
        "is_active": room.is_active,
        "file_hash": room.file_hash,
        "file_size": room.file_size,
        "file_duration_ms": room.file_duration,
        "file_name": room.file_name,
        "file_version": room.file_version,
    }


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    ticket = websocket.query_params.get("ticket")
    if not ticket:
        await websocket.close(code=4001, reason="Missing ticket")
        return

    ticket_data = validate_ws_ticket(ticket)
    if not ticket_data:
        await websocket.close(code=4001, reason="Invalid or expired ticket")
        return

    user_id = ticket_data["user_id"]
    expected_room = ticket_data["room_id"]
    if expected_room != room_id:
        await websocket.close(code=4003, reason="Ticket room mismatch")
        return

    await websocket.accept()

    # Connect and handle tab dedup
    connection_id, old_ws = await manager.connect(room_id, user_id, websocket)

    if old_ws is not None:
        try:
            await old_ws.send_json({
                "type": "error",
                "code": "tab_replaced",
                "message": "Connected from another tab",
            })
            await old_ws.close(code=4002)
        except Exception:
            pass

    # Get username and room info
    async with async_session() as db:
        result = await db.execute(
            select(User.username).where(User.id == uuid.UUID(user_id))
        )
        username = result.scalar_one_or_none() or "Unknown"
        participants = await _get_participant_info(db, room_id)
        room_info = await _get_room_info(db, room_id)

    if not room_info or not room_info["is_active"]:
        await websocket.send_json({"type": "room_closed", "reason": "deleted"})
        await websocket.close(code=4000)
        await manager.disconnect(room_id, user_id, connection_id)
        return

    host_id = room_info["host_id"]

    # Send room_state to connecting user
    state = manager.room_states.get(room_id)
    file_info = {
        k: room_info[k]
        for k in ("file_hash", "file_size", "file_duration_ms", "file_name", "file_version")
    }
    await manager.send_to_user(room_id, user_id, {
        "type": "room_state",
        "participants": participants,
        "playback_state": {
            "is_playing": state.is_playing if state else False,
            "current_time_ms": state.current_time_ms if state else 0,
            "playback_rate": state.playback_rate if state else 1.0,
        },
        "file_info": file_info,
        "file_version": file_info.get("file_version", 0),
        "room_status": state.room_status if state else "waiting_file",
    })

    # Broadcast user_joined
    await manager.broadcast(room_id, {
        "type": "user_joined",
        "user_id": user_id,
        "username": username,
        "connection_id": connection_id,
    }, exclude_user=user_id)

    # Message loop
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "chat_send":
                content = data.get("content", "").strip()
                if not content or len(content) > MAX_CHAT_LENGTH:
                    continue

                async with async_session() as db:
                    msg = await save_message(
                        db, uuid.UUID(room_id), uuid.UUID(user_id), content
                    )

                await manager.broadcast(room_id, {
                    "type": "chat_message",
                    "id": str(msg.id),
                    "user_id": user_id,
                    "username": username,
                    "content": content,
                    "created_at": msg.created_at.isoformat(),
                })

            elif msg_type == "file_verify_request":
                file_hash = data.get("file_hash", "")
                file_size = data.get("file_size", 0)
                file_duration_ms = data.get("file_duration_ms", 0)

                async with async_session() as db:
                    ri = await _get_room_info(db, room_id)

                if not ri or not ri["file_hash"]:
                    # No reference file set yet — if host, this is the first file
                    if user_id == host_id:
                        async with async_session() as db:
                            from app.services.room_service import update_file_info
                            await update_file_info(
                                db, uuid.UUID(room_id), uuid.UUID(user_id),
                                file_hash, file_size, file_duration_ms,
                                data.get("file_name", "unknown"),
                            )
                        await manager.send_to_user(room_id, user_id, {
                            "type": "file_verify_response",
                            "match": True,
                            "file_version": (manager.room_states.get(room_id) or RoomState()).file_version,
                        })
                        # Broadcast file_changed to all others
                        async with async_session() as db:
                            updated_info = await _get_room_info(db, room_id)
                        if updated_info:
                            state = manager.room_states.get(room_id)
                            if state:
                                state.file_version = updated_info["file_version"]
                                state.room_status = "waiting_ready"
                            await manager.broadcast(room_id, {
                                "type": "file_changed",
                                "file_hash": updated_info["file_hash"],
                                "file_size": updated_info["file_size"],
                                "file_duration_ms": updated_info["file_duration_ms"],
                                "file_name": updated_info["file_name"],
                                "file_version": updated_info["file_version"],
                            }, exclude_user=user_id)
                    else:
                        await manager.send_to_user(room_id, user_id, {
                            "type": "file_verify_response",
                            "match": False,
                            "reason": "Host has not selected a file yet.",
                        })
                else:
                    # Compare against reference
                    match = (
                        ri["file_hash"] == file_hash
                        and ri["file_size"] == file_size
                        and abs((ri["file_duration_ms"] or 0) - file_duration_ms) <= 1000
                    )
                    reason = None if match else "File does not match the host's file."
                    await manager.send_to_user(room_id, user_id, {
                        "type": "file_verify_response",
                        "match": match,
                        "reason": reason,
                        "file_version": ri["file_version"],
                    })

            elif msg_type == "ready":
                async with async_session() as db:
                    result = await db.execute(
                        select(RoomParticipant).where(
                            RoomParticipant.room_id == uuid.UUID(room_id),
                            RoomParticipant.user_id == uuid.UUID(user_id),
                            RoomParticipant.left_at == None,
                        )
                    )
                    p = result.scalar_one_or_none()
                    if p:
                        p.is_ready = True
                        await db.commit()

                await manager.broadcast(room_id, {
                    "type": "participant_ready",
                    "user_id": user_id,
                    "is_ready": True,
                    "file_version": data.get("file_version", 0),
                })

            elif msg_type == "not_ready":
                async with async_session() as db:
                    result = await db.execute(
                        select(RoomParticipant).where(
                            RoomParticipant.room_id == uuid.UUID(room_id),
                            RoomParticipant.user_id == uuid.UUID(user_id),
                            RoomParticipant.left_at == None,
                        )
                    )
                    p = result.scalar_one_or_none()
                    if p:
                        p.is_ready = False
                        await db.commit()

                await manager.broadcast(room_id, {
                    "type": "participant_ready",
                    "user_id": user_id,
                    "is_ready": False,
                })

            # Other message types handled in Phase 5

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Only broadcast user_left if THIS connection is still the active one
        actually_removed = await manager.disconnect(room_id, user_id, connection_id)
        if actually_removed:
            await manager.broadcast(room_id, {
                "type": "user_left",
                "user_id": user_id,
                "username": username,
                "reason": "disconnect",
            })
            # If host disconnected, close the room for all
            if user_id == host_id:
                await manager.close_room(room_id, "host_left")

import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.rate_limit import RateLimiter
from app.core.security import validate_ws_ticket
from app.database import async_session
from app.models.room import Room
from app.models.room_participant import RoomParticipant
from app.models.user import User
from app.services.chat_service import save_message
from app.ws.manager import RoomState, manager
from app.ws.sync import apply_play, apply_pause, apply_seek, evaluate_drift, get_current_time_ms

router = APIRouter()

MAX_CHAT_LENGTH = 2000

# Per-user limits for WS message categories. The chat limit is deliberately
# stricter (spam prevention); playback control can burst during scrubbing.
_chat_limiter = RateLimiter(max_events=20, window_seconds=10)
_control_limiter = RateLimiter(max_events=60, window_seconds=10)
_msg_limiter = RateLimiter(max_events=200, window_seconds=10)


def _allowed_ws_origin(origin: str | None) -> bool:
    """Only accept WS handshakes whose Origin matches our configured CORS list.
    Browsers always send Origin on cross-origin WS connects; same-origin may
    omit it, so None is permitted.
    """
    if origin is None:
        return True
    allowed = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    return origin in allowed


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
    # Reject cross-origin WS handshakes. Ticket + CORS on the ticket endpoint
    # already mitigate this, but Origin enforcement is a cheap defence in depth.
    if not _allowed_ws_origin(websocket.headers.get("origin")):
        await websocket.close(code=4003, reason="Origin not allowed")
        return

    # Path param comes from the URL as a raw string; validate the UUID shape
    # before touching the DB with it.
    try:
        uuid.UUID(room_id)
    except (ValueError, TypeError):
        await websocket.close(code=4001, reason="Invalid room id")
        return

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

    # Re-verify active membership at handshake time. The ticket was issued when
    # the user was a participant, but they may have since called /leave — a
    # valid ticket shouldn't be enough on its own.
    async with async_session() as db:
        still_member = await db.execute(
            select(RoomParticipant.id).where(
                RoomParticipant.room_id == uuid.UUID(room_id),
                RoomParticipant.user_id == uuid.UUID(user_id),
                RoomParticipant.left_at == None,
            )
        )
        if still_member.scalar_one_or_none() is None:
            await websocket.close(code=4003, reason="Not a participant")
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

    # Sync in-memory RoomState.file_version with DB on first connect.
    # Otherwise play/pause/seek/ready would be rejected as file_version_mismatch
    # when joining a room that already has a file set.
    state = manager.room_states.get(room_id)
    if state is not None:
        db_fv = room_info.get("file_version") or 0
        if state.file_version == 0 and db_fv > 0:
            state.file_version = db_fv
            if room_info.get("file_hash"):
                # Existing file: room is waiting for participants to become ready again
                state.room_status = "waiting_ready"

    # Check if this is a reconnect (user was in grace period)
    reconnect_data = manager.is_reconnecting(room_id, user_id)
    if reconnect_data:
        is_host_reconnect = reconnect_data.get("is_host", False)
        was_ready = reconnect_data.get("was_ready", False)

        if is_host_reconnect:
            state = manager.room_states.get(room_id)
            if state and state.room_status == "closing":
                # Restore to paused (never playing — autopause happened)
                restored = state._pre_closing_status or "paused"
                if restored == "playing":
                    restored = "paused"
                state.room_status = restored
            await manager.broadcast(room_id, {"type": "host_reconnected"})

        # Restore ready state in DB if file_version matches
        if was_ready:
            state = manager.room_states.get(room_id)
            current_fv = state.file_version if state else 0
            room_fv = room_info.get("file_version", 0)
            if current_fv == room_fv:
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
                # Also restore the verify-gate so a subsequent `ready` on the
                # same file_version isn't rejected as not_verified.
                if state:
                    state.verified_users.add(user_id)

    # Send room_state to connecting user
    state = manager.room_states.get(room_id)
    file_info = {
        k: room_info[k]
        for k in ("file_hash", "file_size", "file_duration_ms", "file_name", "file_version")
    }
    # Use canonical time (not stale state.current_time_ms) for late joiners
    canonical_time = get_current_time_ms(state) if state else 0
    await manager.send_to_user(room_id, user_id, {
        "type": "room_state",
        "participants": participants,
        "playback_state": {
            "is_playing": state.is_playing if state else False,
            "current_time_ms": canonical_time,
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

    # Heartbeat is per-room, managed by ConnectionManager
    # Message loop
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # Global per-user WS message cap. Drop silently once exceeded so we
            # don't amplify a spammer's traffic with error replies.
            if not _msg_limiter.check(f"msg:{user_id}"):
                continue

            if msg_type == "chat_send":
                if not _chat_limiter.check(f"chat:{user_id}"):
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error", "code": "rate_limited",
                        "message": "You're sending messages too quickly.",
                    })
                    continue
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
                file_name = data.get("file_name", "unknown")

                async with async_session() as db:
                    ri = await _get_room_info(db, room_id)

                if ri is None:
                    # Room was deleted between handshake and this message.
                    # Tell the client and skip the verify flow; close_room will
                    # follow shortly for delete_room callers.
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error",
                        "code": "room_gone",
                        "message": "Room no longer exists.",
                    })
                    continue

                is_host = (user_id == host_id)
                has_reference = bool(ri["file_hash"])

                if is_host and (not has_reference or ri["file_hash"] != file_hash):
                    # Host sets or changes the reference file
                    from app.services.room_service import update_file_info
                    async with async_session() as db:
                        await update_file_info(
                            db, uuid.UUID(room_id), uuid.UUID(user_id),
                            file_hash, file_size, file_duration_ms, file_name,
                        )
                    async with async_session() as db:
                        updated_info = await _get_room_info(db, room_id)

                    if updated_info:
                        new_version = updated_info["file_version"]
                        state = manager.room_states.get(room_id)
                        if state:
                            state.file_version = new_version
                            state.room_status = "waiting_ready"
                            state.is_playing = False
                            state.current_time_ms = 0
                            # New file_version invalidates prior verifications;
                            # host just verified against it, so they're in.
                            state.verified_users.clear()
                            state.verified_users.add(user_id)

                        await manager.send_to_user(room_id, user_id, {
                            "type": "file_verify_response",
                            "match": True,
                            "file_hash": file_hash,
                            "file_version": new_version,
                        })
                        # Broadcast file_changed + reset ready for all others
                        await manager.broadcast(room_id, {
                            "type": "file_changed",
                            "file_hash": updated_info["file_hash"],
                            "file_size": updated_info["file_size"],
                            "file_duration_ms": updated_info["file_duration_ms"],
                            "file_name": updated_info["file_name"],
                            "file_version": new_version,
                        }, exclude_user=user_id)
                        # Broadcast ready=false for all participants
                        async with async_session() as db:
                            parts = await _get_participant_info(db, room_id)
                        for p in parts:
                            await manager.broadcast(room_id, {
                                "type": "participant_ready",
                                "user_id": p["user_id"],
                                "is_ready": False,
                            })

                elif is_host and has_reference and ri["file_hash"] == file_hash:
                    # Host re-selected same file
                    state = manager.room_states.get(room_id)
                    if state:
                        state.verified_users.add(user_id)
                    await manager.send_to_user(room_id, user_id, {
                        "type": "file_verify_response",
                        "match": True,
                        "file_hash": file_hash,
                        "file_version": ri["file_version"],
                    })

                elif not is_host and not has_reference:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "file_verify_response",
                        "match": False,
                        "file_hash": file_hash,
                        "reason": "Host has not selected a file yet.",
                    })

                else:
                    # Non-host: compare against reference
                    match = (
                        ri["file_hash"] == file_hash
                        and ri["file_size"] == file_size
                        and abs((ri["file_duration_ms"] or 0) - file_duration_ms) <= 1000
                    )
                    reason = None if match else "File does not match the host's file."
                    if match:
                        state = manager.room_states.get(room_id)
                        if state:
                            state.verified_users.add(user_id)
                    await manager.send_to_user(room_id, user_id, {
                        "type": "file_verify_response",
                        "match": match,
                        "file_hash": file_hash,
                        "reason": reason,
                        "file_version": ri["file_version"],
                    })

            elif msg_type == "ready":
                msg_file_version = data.get("file_version", -1)
                state = manager.room_states.get(room_id)
                current_version = state.file_version if state else 0

                if msg_file_version != current_version:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error",
                        "code": "file_version_mismatch",
                        "message": f"Expected file_version {current_version}, got {msg_file_version}",
                    })
                    continue

                # Require a successful file_verify_request against the current
                # file_version before allowing ready. Without this gate a client
                # can skip verification and just declare themselves ready.
                if state is None or user_id not in state.verified_users:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error",
                        "code": "not_verified",
                        "message": "Verify your file before marking ready.",
                    })
                    continue

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
                    "file_version": current_version,
                })

                # Send current playback position so late joiners / re-readys sync up.
                # Without this, newcomers start at 0s while everyone else is mid-playback.
                if state:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "sync_state",
                        "is_playing": state.is_playing,
                        "current_time_ms": get_current_time_ms(state),
                        "file_version": state.file_version,
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

            elif msg_type in ("play", "pause", "seek"):
                if user_id != host_id:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error", "code": "not_host", "message": "Only the host can control playback.",
                    })
                    continue
                if not _control_limiter.check(f"ctrl:{user_id}"):
                    continue
                state = manager.room_states.get(room_id)
                if not state:
                    continue
                # Validate file_version
                msg_fv = data.get("file_version")
                if msg_fv is not None and msg_fv != state.file_version:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error", "code": "file_version_mismatch",
                        "message": "Stale file version.",
                    })
                    continue

                time_ms = data.get("current_time_ms", 0)
                if msg_type == "play":
                    apply_play(state, time_ms)
                elif msg_type == "pause":
                    apply_pause(state, time_ms)
                else:
                    apply_seek(state, time_ms)

                await manager.broadcast(room_id, {
                    "type": "sync_state",
                    "is_playing": state.is_playing,
                    "current_time_ms": state.current_time_ms,
                    "file_version": state.file_version,
                })

            elif msg_type == "sync_report":
                state = manager.room_states.get(room_id)
                if state and state.is_playing:
                    canonical = get_current_time_ms(state)
                    reported = data.get("current_time_ms", 0)
                    playback_status = data.get("playback_status", "playing")
                    buffer_health = data.get("buffer_health_ms", 0)
                    correction = evaluate_drift(canonical, reported, playback_status, buffer_health)
                    if correction:
                        await manager.send_to_user(room_id, user_id, correction)

            elif msg_type == "reconnect":
                # Client sends this right after open on reconnect
                # last_seq and file_version are informational —
                # we already sent room_state with canonical time
                # If file_version mismatches, send updated sync_state
                client_fv = data.get("file_version", -1)
                state = manager.room_states.get(room_id)
                if state and client_fv != state.file_version:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "sync_state",
                        "is_playing": state.is_playing,
                        "current_time_ms": get_current_time_ms(state),
                        "file_version": state.file_version,
                    })

            elif msg_type == "playback_error":
                # Just broadcast participant status so others can see
                await manager.broadcast(room_id, {
                    "type": "participant_status",
                    "user_id": user_id,
                    "status": "error",
                    "detail": data.get("error_code", "unknown"),
                })

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Check if user was ready before disconnect (for reconnect restore)
        was_ready = False
        async with async_session() as db:
            result = await db.execute(
                select(RoomParticipant.is_ready).where(
                    RoomParticipant.room_id == uuid.UUID(room_id),
                    RoomParticipant.user_id == uuid.UUID(user_id),
                    RoomParticipant.left_at == None,
                )
            )
            row = result.scalar_one_or_none()
            if row is not None:
                was_ready = row

        actually_removed = await manager.disconnect(room_id, user_id, connection_id)
        if actually_removed:
            is_host = (user_id == host_id)

            if is_host:
                state = manager.room_states.get(room_id)
                if state and state.room_status != "closing":
                    # Autopause FIRST (while status is still "playing")
                    if state.is_playing:
                        apply_pause(state, get_current_time_ms(state))
                    # Then set closing
                    state._pre_closing_status = state.room_status
                    state.room_status = "closing"

                # Broadcast autopause sync_state so clients actually pause
                if state:
                    await manager.broadcast(room_id, {
                        "type": "sync_state",
                        "is_playing": False,
                        "current_time_ms": state.current_time_ms,
                        "file_version": state.file_version,
                    })

                from app.ws.manager import HOST_GRACE_PERIOD_S
                await manager.broadcast(room_id, {
                    "type": "host_disconnected",
                    "grace_period_ms": HOST_GRACE_PERIOD_S * 1000,
                })

                async def _host_timeout():
                    await manager.close_room(room_id, "host_timeout")
                    async with async_session() as db:
                        from app.models.room import Room as RoomModel
                        result = await db.execute(
                            select(RoomModel).where(RoomModel.id == uuid.UUID(room_id))
                        )
                        r = result.scalar_one_or_none()
                        if r:
                            r.is_active = False
                            await db.commit()

                manager.start_grace_period(
                    room_id, user_id, True, _host_timeout, was_ready=was_ready
                )
            else:
                await manager.broadcast(room_id, {
                    "type": "user_left",
                    "user_id": user_id,
                    "username": username,
                    "reason": "disconnect",
                })

                async def _participant_timeout():
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
                            from sqlalchemy import func as sa_func
                            p.left_at = sa_func.now()
                            await db.commit()
                    # Clean up room state if no more grace timers
                    if not manager._has_grace_timers(room_id) and room_id not in manager.rooms:
                        manager.room_states.pop(room_id, None)
                        manager.seq_counters.pop(room_id, None)

                manager.start_grace_period(
                    room_id, user_id, False, _participant_timeout, was_ready=was_ready
                )

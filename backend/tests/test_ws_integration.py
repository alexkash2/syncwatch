"""End-to-end WebSocket integration tests.

These drive the real `ws/handler.py` through Starlette's TestClient, which the
async httpx fixture in test_integration_rest.py can't do. Data is seeded through
the real REST flows (register / login / create-room / join / ws-ticket), then the
socket(s) are opened with the issued tickets.

Cross-loop note: TestClient runs the ASGI app in its own worker thread/loop, so
an in-memory `:memory:` DB (per-connection) wouldn't be visible to it. We use a
temp FILE sqlite so the schema + seeded rows are shared across loops. The WS
handler binds `async_session` at import time (`from app.database import ...`), so
the swap must patch `app.ws.handler.async_session` too — not just `db_module`.
"""
import asyncio
import os
import pathlib
import tempfile

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.testclient import TestClient

from app import database as db_module
from app.core.rate_limit import ALL_LIMITERS
from app.main import app
from app.models import Base
from app.ws import handler as ws_handler
from app.ws.manager import manager


def _reset_manager():
    manager.rooms.clear()
    manager.room_states.clear()
    manager.seq_counters.clear()
    manager.disconnected_users.clear()
    for task in list(manager._heartbeat_tasks.values()):
        task.cancel()
    manager._heartbeat_tasks.clear()
    for task in list(manager._grace_timers.values()):
        task.cancel()
    manager._grace_timers.clear()


@pytest.fixture
def ws_client():
    """A sync TestClient wired to an isolated temp-file sqlite DB + clean state."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_path = pathlib.Path(tmp.name).as_posix()
    # NullPool: every operation opens + closes its own connection, so nothing
    # lingers bound to TestClient's (now-dead) worker loop at teardown — avoids
    # a cross-loop "no active connection" rollback on dispose.
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=False, poolclass=NullPool)
    session = async_sessionmaker(engine, expire_on_commit=False)

    async def _create_schema():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create_schema())

    orig_engine = db_module.engine
    orig_session = db_module.async_session
    orig_handler_session = ws_handler.async_session
    db_module.engine = engine
    db_module.async_session = session
    ws_handler.async_session = session

    for limiter in ALL_LIMITERS:
        limiter._log.clear()
    _reset_manager()

    with TestClient(app) as client:
        yield client

    _reset_manager()
    db_module.engine = orig_engine
    db_module.async_session = orig_session
    ws_handler.async_session = orig_handler_session
    asyncio.run(engine.dispose())
    try:
        os.unlink(tmp.name)
    except OSError:
        pass  # Windows may still hold the handle briefly; temp dir gets cleaned anyway.


def _register(client: TestClient, username: str, email: str):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    r = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    return r.json()["access_token"]


def _ws_ticket(client: TestClient, token: str, room_id: str) -> str:
    r = client.post(
        "/api/auth/ws-ticket",
        json={"room_id": room_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()["ticket"]


def _seed_room(client: TestClient):
    """Two users + a room they both joined. Returns ids/tokens needed for WS."""
    host_tok = _register(client, "wshost", "wshost@example.com")
    viewer_tok = _register(client, "wsviewer", "wsviewer@example.com")
    host_hdr = {"Authorization": f"Bearer {host_tok}"}

    room = client.post("/api/rooms/", json={"name": "WS Room"}, headers=host_hdr).json()
    client.post(
        "/api/rooms/join",
        json={"room_code": room["room_code"]},
        headers={"Authorization": f"Bearer {viewer_tok}"},
    )
    return {
        "room_id": room["id"],
        "host_tok": host_tok,
        "viewer_tok": viewer_tok,
    }


_FILE_MSG = {
    "type": "file_verify_request",
    "file_hash": "a" * 64,
    "file_size": 1_000_000,
    "file_duration_ms": 120_000,
    "file_name": "movie.mp4",
}


def _recv_until(ws, msg_type: str, limit: int = 12):
    """Drain messages until one of `msg_type` arrives (skips heartbeat/ping etc.).

    Bounded so a wrong reply can't hang the test — every assertion here triggers
    an immediate server reply, so the wanted message arrives well within `limit`.
    """
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == msg_type:
            return msg
    raise AssertionError(f"never received a {msg_type!r} message")


def test_ws_connect_receives_room_state(ws_client):
    env = _seed_room(ws_client)
    ticket = _ws_ticket(ws_client, env["host_tok"], env["room_id"])

    with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket={ticket}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "room_state"
        assert msg["room_status"] == "waiting_file"
        # both participants present
        assert len(msg["participants"]) == 2


def test_ws_rejects_bad_ticket(ws_client):
    env = _seed_room(ws_client)
    with pytest.raises(Exception):
        with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket=garbage") as ws:
            ws.receive_json()


def test_host_sets_reference_file(ws_client):
    env = _seed_room(ws_client)
    ticket = _ws_ticket(ws_client, env["host_tok"], env["room_id"])
    with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket={ticket}") as ws:
        ws.receive_json()  # room_state
        ws.send_json(_FILE_MSG)
        resp = _recv_until(ws, "file_verify_response")
        assert resp["match"] is True
        assert resp["file_version"] == 1


def test_non_host_can_control_playback(ws_client):
    """Regression for the viewer-control feature: a non-host's play is accepted
    (broadcast sync_state) instead of rejected with error/not_host."""
    env = _seed_room(ws_client)
    host_ticket = _ws_ticket(ws_client, env["host_tok"], env["room_id"])
    viewer_ticket = _ws_ticket(ws_client, env["viewer_tok"], env["room_id"])

    with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket={host_ticket}") as host_ws:
        host_ws.receive_json()  # room_state
        host_ws.send_json(_FILE_MSG)  # host sets the reference file → file_version 1
        _recv_until(host_ws, "file_verify_response")

        with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket={viewer_ticket}") as viewer_ws:
            rs = _recv_until(viewer_ws, "room_state")
            assert rs["file_version"] == 1

            viewer_ws.send_json({"type": "play", "current_time_ms": 5_000, "file_version": 1})
            sync = _recv_until(viewer_ws, "sync_state")
            assert sync["is_playing"] is True
            assert sync["current_time_ms"] == 5_000


def test_control_rejected_on_stale_file_version(ws_client):
    env = _seed_room(ws_client)
    host_ticket = _ws_ticket(ws_client, env["host_tok"], env["room_id"])
    with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket={host_ticket}") as host_ws:
        host_ws.receive_json()
        host_ws.send_json(_FILE_MSG)  # file_version → 1
        _recv_until(host_ws, "file_verify_response")
        host_ws.send_json({"type": "play", "current_time_ms": 0, "file_version": 99})
        err = _recv_until(host_ws, "error")
        assert err["code"] == "file_version_mismatch"


def test_chat_message_is_broadcast(ws_client):
    env = _seed_room(ws_client)
    ticket = _ws_ticket(ws_client, env["host_tok"], env["room_id"])
    with ws_client.websocket_connect(f"/ws/{env['room_id']}?ticket={ticket}") as ws:
        ws.receive_json()  # room_state
        ws.send_json({"type": "chat_send", "content": "hello room"})
        msg = _recv_until(ws, "chat_message")
        assert msg["content"] == "hello room"
        assert msg["username"] == "wshost"

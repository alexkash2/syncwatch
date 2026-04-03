"""Unit tests for ConnectionManager logic."""
import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.ws.manager import ConnectionManager, RoomState


@pytest.fixture
def mgr():
    return ConnectionManager()


@pytest.mark.asyncio
async def test_connect_returns_connection_id(mgr):
    ws = AsyncMock()
    conn_id, old_ws = await mgr.connect("room1", "user1", ws)
    assert conn_id
    assert old_ws is None
    assert "user1" in mgr.rooms["room1"]


@pytest.mark.asyncio
async def test_tab_dedup_returns_old_ws(mgr):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws1)
    conn_id, old_ws = await mgr.connect("room1", "user1", ws2)
    assert old_ws is ws1
    assert mgr.rooms["room1"]["user1"] is ws2


@pytest.mark.asyncio
async def test_disconnect_removes_user(mgr):
    ws = AsyncMock()
    await mgr.connect("room1", "user1", ws)
    await mgr.disconnect("room1", "user1")
    assert "room1" not in mgr.rooms


@pytest.mark.asyncio
async def test_broadcast_sends_to_all(mgr):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws1)
    await mgr.connect("room1", "user2", ws2)
    await mgr.broadcast("room1", {"type": "test"})
    ws1.send_json.assert_called_once()
    ws2.send_json.assert_called_once()
    msg = ws1.send_json.call_args[0][0]
    assert msg["type"] == "test"
    assert "seq" in msg
    assert "server_time" in msg


@pytest.mark.asyncio
async def test_broadcast_excludes_user(mgr):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws1)
    await mgr.connect("room1", "user2", ws2)
    await mgr.broadcast("room1", {"type": "test"}, exclude_user="user1")
    ws1.send_json.assert_not_called()
    ws2.send_json.assert_called_once()


@pytest.mark.asyncio
async def test_seq_increments(mgr):
    ws = AsyncMock()
    await mgr.connect("room1", "user1", ws)
    await mgr.broadcast("room1", {"type": "a"})
    await mgr.broadcast("room1", {"type": "b"})
    calls = ws.send_json.call_args_list
    assert calls[0][0][0]["seq"] == 1
    assert calls[1][0][0]["seq"] == 2


@pytest.mark.asyncio
async def test_room_state_created_on_connect(mgr):
    ws = AsyncMock()
    await mgr.connect("room1", "user1", ws)
    assert "room1" in mgr.room_states
    state = mgr.room_states["room1"]
    assert state.is_playing is False
    assert state.current_time_ms == 0


@pytest.mark.asyncio
async def test_get_room_users(mgr):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws1)
    await mgr.connect("room1", "user2", ws2)
    users = mgr.get_room_users("room1")
    assert set(users) == {"user1", "user2"}


@pytest.mark.asyncio
async def test_disconnect_cleans_up_empty_room(mgr):
    ws = AsyncMock()
    await mgr.connect("room1", "user1", ws)
    await mgr.disconnect("room1", "user1")
    assert "room1" not in mgr.rooms
    assert "room1" not in mgr.room_states
    assert "room1" not in mgr.seq_counters

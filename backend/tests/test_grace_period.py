"""Unit tests for grace period logic in ConnectionManager."""
from unittest.mock import AsyncMock

import pytest

from app.ws.manager import ConnectionManager


@pytest.fixture
def mgr():
    return ConnectionManager()


@pytest.mark.asyncio
async def test_disconnect_creates_disconnected_entry(mgr):
    ws = AsyncMock()
    conn_id, _ = await mgr.connect("room1", "user1", ws)

    callback = AsyncMock()
    await mgr.disconnect("room1", "user1", conn_id)
    mgr.start_grace_period("room1", "user1", False, callback)

    assert ("room1", "user1") in mgr.disconnected_users


@pytest.mark.asyncio
async def test_reconnect_returns_disconnected_state(mgr):
    ws = AsyncMock()
    conn_id, _ = await mgr.connect("room1", "user1", ws)

    callback = AsyncMock()
    await mgr.disconnect("room1", "user1", conn_id)
    mgr.start_grace_period("room1", "user1", False, callback)

    # Reconnect — is_reconnecting returns the saved state (consumed once)
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws2)
    data = mgr.is_reconnecting("room1", "user1")
    assert data is not None
    assert data["is_host"] is False

    # Second call returns None (consumed)
    assert mgr.is_reconnecting("room1", "user1") is None


@pytest.mark.asyncio
async def test_grace_timer_cancelled_on_reconnect(mgr):
    ws = AsyncMock()
    conn_id, _ = await mgr.connect("room1", "user1", ws)

    callback = AsyncMock()
    await mgr.disconnect("room1", "user1", conn_id)
    mgr.start_grace_period("room1", "user1", False, callback)

    assert ("room1", "user1") in mgr._grace_timers

    # Reconnect cancels timer
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws2)
    assert ("room1", "user1") not in mgr._grace_timers


@pytest.mark.asyncio
async def test_close_room_cancels_all_grace_timers(mgr):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await mgr.connect("room1", "user1", ws1)
    conn2, _ = await mgr.connect("room1", "user2", ws2)

    callback = AsyncMock()
    await mgr.disconnect("room1", "user2", conn2)
    mgr.start_grace_period("room1", "user2", False, callback)

    await mgr.close_room("room1", "host_timeout")

    assert ("room1", "user2") not in mgr._grace_timers
    assert ("room1", "user2") not in mgr.disconnected_users


@pytest.mark.asyncio
async def test_host_grace_stores_is_host(mgr):
    ws = AsyncMock()
    conn_id, _ = await mgr.connect("room1", "host1", ws)

    callback = AsyncMock()
    await mgr.disconnect("room1", "host1", conn_id)
    mgr.start_grace_period("room1", "host1", True, callback)

    data = mgr.disconnected_users.get(("room1", "host1"))
    assert data is not None
    assert data["is_host"] is True

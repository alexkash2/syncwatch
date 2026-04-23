"""REST integration tests using an in-memory SQLite DB.

These exercise the FastAPI app end-to-end (routing, deps, services, DB) without
needing a real Postgres. SQLite doesn't understand `postgresql_where`, but
SQLAlchemy skips the dialect-specific clause on non-Postgres, so the partial
unique index becomes a plain unique index — still good enough for the cases
covered here.
"""
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import database as db_module
from app.core.rate_limit import ALL_LIMITERS
from app.main import app
from app.models import Base


@pytest_asyncio.fixture
async def client():
    # Isolated in-memory DB per test.
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    test_session = async_sessionmaker(test_engine, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Swap the module-level engine/session that everything depends on.
    original_engine = db_module.engine
    original_session = db_module.async_session
    db_module.engine = test_engine
    db_module.async_session = test_session

    # Rate limiters are module-level singletons; reset every registered one
    # (auth + WS) so tests don't bleed — relying on a hardcoded list would
    # silently miss any limiter added later.
    for limiter in ALL_LIMITERS:
        limiter._log.clear()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    db_module.engine = original_engine
    db_module.async_session = original_session
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_login_flow(client: AsyncClient):
    r = await client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "password123"},
    )
    assert r.status_code == 201
    user = r.json()
    assert user["username"] == "alice"
    # Email is normalized to lowercase at storage.
    assert user["email"] == "alice@example.com"

    # Login with the original casing should succeed thanks to normalization.
    r = await client.post(
        "/api/auth/login",
        json={"email": "Alice@Example.com", "password": "password123"},
    )
    assert r.status_code == 200
    tokens = r.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    # /me with access token returns the user.
    r = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert r.status_code == 200
    assert r.json()["username"] == "alice"


@pytest.mark.asyncio
async def test_register_rejects_bad_username_and_short_password(client: AsyncClient):
    # Username with a space
    r = await client.post(
        "/api/auth/register",
        json={"username": "bob jones", "email": "bob@example.com", "password": "password123"},
    )
    assert r.status_code == 422

    # Password too short
    r = await client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@example.com", "password": "short"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_does_not_leak_user_existence(client: AsyncClient):
    """Both unknown-user and wrong-password paths must return the same error."""
    await client.post(
        "/api/auth/register",
        json={"username": "carol", "email": "carol@example.com", "password": "password123"},
    )
    r1 = await client.post(
        "/api/auth/login",
        json={"email": "carol@example.com", "password": "wrongpass"},
    )
    r2 = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "whatever123"},
    )
    assert r1.status_code == r2.status_code == 400
    assert r1.json()["detail"] == r2.json()["detail"]


@pytest.mark.asyncio
async def test_rate_limit_on_login_per_email(client: AsyncClient):
    """Brute force against a single email is stopped even when the attacker
    rotates IPs. We vary the source IP via X-Forwarded-For so the per-IP
    limiter (which sees different IPs) never fires — the per-email limiter
    has to carry this test alone.
    """
    await client.post(
        "/api/auth/register",
        json={"username": "dan", "email": "dan@example.com", "password": "password123"},
    )
    for i in range(10):
        await client.post(
            "/api/auth/login",
            json={"email": "dan@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": f"10.0.0.{i}"},
        )
    # 11th attempt from yet another IP: per-IP limiter is fine, per-email
    # limiter trips.
    r = await client.post(
        "/api/auth/login",
        json={"email": "dan@example.com", "password": "wrong"},
        headers={"X-Forwarded-For": "10.0.0.99"},
    )
    assert r.status_code == 429


@pytest.mark.asyncio
async def test_rate_limit_on_login_per_ip(client: AsyncClient):
    """A single IP probing different accounts hits the per-IP limiter."""
    # Register enough accounts that rotating emails does not trip the
    # per-email limiter (max_events=10/60s per email).
    for i in range(11):
        await client.post(
            "/api/auth/register",
            json={
                "username": f"u{i}",
                "email": f"u{i}@example.com",
                "password": "password123",
            },
        )
    for i in range(10):
        await client.post(
            "/api/auth/login",
            json={"email": f"u{i}@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": "10.0.0.1"},
        )
    r = await client.post(
        "/api/auth/login",
        json={"email": "u10@example.com", "password": "wrong"},
        headers={"X-Forwarded-For": "10.0.0.1"},
    )
    assert r.status_code == 429


@pytest.mark.asyncio
async def test_create_and_join_room(client: AsyncClient):
    # Register two users
    await client.post(
        "/api/auth/register",
        json={"username": "host1", "email": "host1@example.com", "password": "password123"},
    )
    await client.post(
        "/api/auth/register",
        json={"username": "guest1", "email": "guest1@example.com", "password": "password123"},
    )
    host_tok = (
        await client.post(
            "/api/auth/login",
            json={"email": "host1@example.com", "password": "password123"},
        )
    ).json()["access_token"]
    guest_tok = (
        await client.post(
            "/api/auth/login",
            json={"email": "guest1@example.com", "password": "password123"},
        )
    ).json()["access_token"]

    host_hdr = {"Authorization": f"Bearer {host_tok}"}
    guest_hdr = {"Authorization": f"Bearer {guest_tok}"}

    r = await client.post("/api/rooms/", json={"name": "Test Room"}, headers=host_hdr)
    assert r.status_code == 201
    room = r.json()
    assert room["name"] == "Test Room"
    assert len(room["room_code"]) == 8

    # Guest joins by code
    r = await client.post(
        "/api/rooms/join", json={"room_code": room["room_code"]}, headers=guest_hdr
    )
    assert r.status_code == 200

    # Guest can read the room
    r = await client.get(f"/api/rooms/{room['id']}", headers=guest_hdr)
    assert r.status_code == 200
    assert len(r.json()["participants"]) == 2

    # Non-member can't read — create a third user
    await client.post(
        "/api/auth/register",
        json={"username": "stranger", "email": "s@example.com", "password": "password123"},
    )
    stranger_tok = (
        await client.post(
            "/api/auth/login",
            json={"email": "s@example.com", "password": "password123"},
        )
    ).json()["access_token"]
    r = await client.get(
        f"/api/rooms/{room['id']}",
        headers={"Authorization": f"Bearer {stranger_tok}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_room_only_host(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"username": "hostx", "email": "hx@example.com", "password": "password123"},
    )
    await client.post(
        "/api/auth/register",
        json={"username": "guestx", "email": "gx@example.com", "password": "password123"},
    )
    host_tok = (
        await client.post(
            "/api/auth/login", json={"email": "hx@example.com", "password": "password123"}
        )
    ).json()["access_token"]
    guest_tok = (
        await client.post(
            "/api/auth/login", json={"email": "gx@example.com", "password": "password123"}
        )
    ).json()["access_token"]

    room = (
        await client.post(
            "/api/rooms/",
            json={"name": "DeleteMe"},
            headers={"Authorization": f"Bearer {host_tok}"},
        )
    ).json()
    await client.post(
        "/api/rooms/join",
        json={"room_code": room["room_code"]},
        headers={"Authorization": f"Bearer {guest_tok}"},
    )

    # Guest may not delete
    r = await client.delete(
        f"/api/rooms/{room['id']}", headers={"Authorization": f"Bearer {guest_tok}"}
    )
    assert r.status_code == 403

    # Host can delete
    r = await client.delete(
        f"/api/rooms/{room['id']}", headers={"Authorization": f"Bearer {host_tok}"}
    )
    assert r.status_code == 200

    # Room is now inactive → not returned
    r = await client.get(
        f"/api/rooms/{room['id']}", headers={"Authorization": f"Bearer {host_tok}"}
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_refresh_is_single_use(client: AsyncClient):
    """Replaying a refresh token must be rejected (rotation via jti blocklist)."""
    await client.post(
        "/api/auth/register",
        json={"username": "rot", "email": "rot@example.com", "password": "password123"},
    )
    tokens = (
        await client.post(
            "/api/auth/login",
            json={"email": "rot@example.com", "password": "password123"},
        )
    ).json()

    # First /refresh succeeds and rotates.
    r = await client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200

    # Replaying the same refresh token must fail.
    r2 = await client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_ws_ticket_requires_participation(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"username": "tkt_h", "email": "th@example.com", "password": "password123"},
    )
    await client.post(
        "/api/auth/register",
        json={"username": "tkt_o", "email": "to@example.com", "password": "password123"},
    )
    host_tok = (
        await client.post(
            "/api/auth/login", json={"email": "th@example.com", "password": "password123"}
        )
    ).json()["access_token"]
    other_tok = (
        await client.post(
            "/api/auth/login", json={"email": "to@example.com", "password": "password123"}
        )
    ).json()["access_token"]

    room = (
        await client.post(
            "/api/rooms/", json={"name": "R"}, headers={"Authorization": f"Bearer {host_tok}"}
        )
    ).json()

    # Non-participant can't get ticket
    r = await client.post(
        "/api/auth/ws-ticket",
        json={"room_id": room["id"]},
        headers={"Authorization": f"Bearer {other_tok}"},
    )
    assert r.status_code == 403

    # Host can
    r = await client.post(
        "/api/auth/ws-ticket",
        json={"room_id": room["id"]},
        headers={"Authorization": f"Bearer {host_tok}"},
    )
    assert r.status_code == 200
    assert r.json()["ticket"]

    # Bogus room UUID → 404
    r = await client.post(
        "/api/auth/ws-ticket",
        json={"room_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {host_tok}"},
    )
    assert r.status_code == 404

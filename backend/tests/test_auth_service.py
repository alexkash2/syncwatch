import time

from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_ws_ticket,
    decode_token,
    hash_password,
    validate_ws_ticket,
    verify_password,
)


def test_password_hashing():
    plain = "my_secret_password"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed)
    assert not verify_password("wrong_password", hashed)


def test_access_token_create_and_decode():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    token = create_access_token(user_id)
    payload = decode_token(token, expected_type="access")
    assert payload is not None
    assert payload["sub"] == user_id
    assert payload["type"] == "access"


def test_refresh_token_create_and_decode():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    token = create_refresh_token(user_id)
    payload = decode_token(token, expected_type="refresh")
    assert payload is not None
    assert payload["sub"] == user_id
    assert payload["type"] == "refresh"


def test_token_type_mismatch():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    assert decode_token(access, expected_type="refresh") is None
    assert decode_token(refresh, expected_type="access") is None


def test_invalid_token():
    assert decode_token("garbage.token.here") is None


def test_ws_ticket_create_and_validate():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    room_id = "660e8400-e29b-41d4-a716-446655440000"
    ticket = create_ws_ticket(user_id, room_id)
    data = validate_ws_ticket(ticket)
    assert data is not None
    assert data["user_id"] == user_id
    assert data["room_id"] == room_id


def test_ws_ticket_one_time_use():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    room_id = "660e8400-e29b-41d4-a716-446655440000"
    ticket = create_ws_ticket(user_id, room_id)
    assert validate_ws_ticket(ticket) is not None
    assert validate_ws_ticket(ticket) is None


def test_ws_ticket_invalid():
    assert validate_ws_ticket("nonexistent-ticket") is None

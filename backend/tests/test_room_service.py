"""Unit tests for room_service logic that doesn't require a database."""
import secrets

from app.services.room_service import _generate_room_code, ROOM_CODE_ALPHABET


def test_generate_room_code_length():
    code = _generate_room_code()
    assert len(code) == 8


def test_generate_room_code_alphabet():
    for _ in range(50):
        code = _generate_room_code()
        for ch in code:
            assert ch in ROOM_CODE_ALPHABET, f"Unexpected char '{ch}' in code '{code}'"


def test_generate_room_code_uniqueness():
    codes = {_generate_room_code() for _ in range(100)}
    # With 36^8 possible codes, 100 should be unique
    assert len(codes) == 100

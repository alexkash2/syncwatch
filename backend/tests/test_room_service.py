"""Unit tests for room_service logic that doesn't require a database."""
import re

import pytest
from pydantic import ValidationError

from app.schemas.room import FileInfoRequest, JoinRoomRequest
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
    assert len(codes) == 100


def test_join_room_code_must_be_8_chars():
    with pytest.raises(ValidationError):
        JoinRoomRequest(room_code="SHORT")


def test_join_room_code_rejects_invalid_chars():
    with pytest.raises(ValidationError):
        JoinRoomRequest(room_code="abcd1234")  # lowercase not allowed


def test_join_room_code_accepts_valid():
    req = JoinRoomRequest(room_code="ABCD1234")
    assert req.room_code == "ABCD1234"


def test_file_info_rejects_negative_size():
    with pytest.raises(ValidationError):
        FileInfoRequest(
            file_hash="a" * 64,
            file_size=-1,
            file_duration_ms=1000,
            file_name="test.mp4",
        )


def test_file_info_rejects_zero_duration():
    with pytest.raises(ValidationError):
        FileInfoRequest(
            file_hash="a" * 64,
            file_size=1000,
            file_duration_ms=0,
            file_name="test.mp4",
        )


def test_file_info_rejects_short_hash():
    with pytest.raises(ValidationError):
        FileInfoRequest(
            file_hash="tooshort",
            file_size=1000,
            file_duration_ms=1000,
            file_name="test.mp4",
        )


def test_file_info_accepts_valid():
    req = FileInfoRequest(
        file_hash="a" * 64,
        file_size=1_000_000,
        file_duration_ms=7200000,
        file_name="movie.mp4",
    )
    assert req.file_size == 1_000_000

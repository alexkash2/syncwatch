"""Unit tests for sync algorithm math."""
import time
from unittest.mock import patch

import pytest

from app.ws.manager import RoomState
from app.ws.sync import apply_play, apply_pause, apply_seek, evaluate_drift, get_current_time_ms


def test_get_current_time_paused():
    state = RoomState(is_playing=False, current_time_ms=5000)
    assert get_current_time_ms(state) == 5000


def test_get_current_time_playing():
    state = RoomState(
        is_playing=True,
        current_time_ms=5000,
        last_update_epoch=time.monotonic() - 2.0,  # 2 seconds ago
        playback_rate=1.0,
    )
    result = get_current_time_ms(state)
    # Should be approximately 7000ms (5000 + 2000)
    assert 6900 <= result <= 7100


def test_get_current_time_playing_with_rate():
    state = RoomState(
        is_playing=True,
        current_time_ms=10000,
        last_update_epoch=time.monotonic() - 1.0,
        playback_rate=1.05,
    )
    result = get_current_time_ms(state)
    # 10000 + 1000 * 1.05 = 11050
    assert 10950 <= result <= 11150


def test_apply_play():
    state = RoomState(room_status="paused")
    apply_play(state, 5000)
    assert state.is_playing is True
    assert state.current_time_ms == 5000
    assert state.room_status == "playing"
    assert state.last_update_epoch > 0


def test_apply_pause():
    state = RoomState(is_playing=True, room_status="playing")
    apply_pause(state, 8000)
    assert state.is_playing is False
    assert state.current_time_ms == 8000
    assert state.room_status == "paused"


def test_apply_seek():
    state = RoomState(is_playing=True, current_time_ms=1000)
    apply_seek(state, 50000)
    assert state.current_time_ms == 50000
    assert state.is_playing is True  # Seek doesn't change play state


def test_evaluate_drift_acceptable():
    result = evaluate_drift(10000, 10200, "playing")
    assert result is None  # < 300ms


def test_evaluate_drift_nudge_behind():
    result = evaluate_drift(10000, 9500, "playing")
    assert result is not None
    assert result["type"] == "playback_rate"
    assert result["rate"] == 1.05


def test_evaluate_drift_nudge_ahead():
    result = evaluate_drift(10000, 10600, "playing")
    assert result is not None
    assert result["type"] == "playback_rate"
    assert result["rate"] == 0.95


def test_evaluate_drift_hard_seek():
    result = evaluate_drift(10000, 7000, "playing")
    assert result is not None
    assert result["type"] == "sync_correction"
    assert result["action"] == "seek"
    assert result["target_time_ms"] == 10000


def test_evaluate_drift_buffering_ignored():
    result = evaluate_drift(10000, 5000, "buffering")
    assert result is None


def test_evaluate_drift_error_ignored():
    result = evaluate_drift(10000, 5000, "error")
    assert result is None


def test_evaluate_drift_low_buffer_ignored():
    """Playing but nearly out of buffer — don't correct."""
    result = evaluate_drift(10000, 7000, "playing", buffer_health_ms=200)
    assert result is None


def test_evaluate_drift_good_buffer_corrects():
    """Playing with healthy buffer — correct normally."""
    result = evaluate_drift(10000, 7000, "playing", buffer_health_ms=5000)
    assert result is not None
    assert result["type"] == "sync_correction"


def test_evaluate_drift_waiting_interaction_ignored():
    result = evaluate_drift(10000, 5000, "waiting_interaction")
    assert result is None

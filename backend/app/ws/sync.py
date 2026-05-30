"""Sync algorithm: canonical time calculation and drift detection."""
import time

from app.ws.manager import RoomState


def get_current_time_ms(state: RoomState) -> int:
    """Calculate canonical playback position right now."""
    if not state.is_playing:
        return state.current_time_ms
    elapsed_s = time.monotonic() - state.last_update_epoch
    return state.current_time_ms + int(elapsed_s * 1000 * state.playback_rate)


def apply_play(state: RoomState, current_time_ms: int) -> None:
    state.is_playing = True
    state.current_time_ms = current_time_ms
    state.last_update_epoch = time.monotonic()
    # Reset to 1.0 intentionally: a fresh play is authoritative and cancels any in-flight drift nudge.
    state.playback_rate = 1.0
    if state.room_status in ("waiting_ready", "paused"):
        state.room_status = "playing"


def apply_pause(state: RoomState, current_time_ms: int) -> None:
    state.is_playing = False
    state.current_time_ms = current_time_ms
    state.last_update_epoch = time.monotonic()
    if state.room_status == "playing":
        state.room_status = "paused"


def apply_seek(state: RoomState, current_time_ms: int) -> None:
    state.current_time_ms = current_time_ms
    state.last_update_epoch = time.monotonic()


def evaluate_drift(
    canonical_ms: int, reported_ms: int, playback_status: str,
    buffer_health_ms: int = 0,
) -> dict | None:
    """Evaluate client drift and return correction if needed.
    Returns None if no correction needed."""
    if playback_status in ("buffering", "error", "waiting_interaction"):
        return None  # Don't correct clients that can't play

    # Client is technically playing but nearly out of buffer — don't correct
    # buffer_health_ms > 0 means client reported it; 0 means unknown (don't skip)
    if playback_status == "playing" and 0 < buffer_health_ms < 500:
        return None

    drift_ms = abs(canonical_ms - reported_ms)

    if drift_ms < 300:
        return None  # Acceptable

    if drift_ms >= 2000:
        return {"type": "sync_correction", "target_time_ms": canonical_ms, "action": "seek"}

    # 300ms - 2000ms: nudge via playback rate
    if reported_ms < canonical_ms:
        return {"type": "playback_rate", "rate": 1.05}
    else:
        return {"type": "playback_rate", "rate": 0.95}

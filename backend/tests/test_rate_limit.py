"""Direct unit tests for the RateLimiter primitive.

These prove the per-key semantics unambiguously (the REST integration tests can't
fully isolate the per-email vs per-IP bucket), plus the reserve/release flow the
login endpoint relies on and the max_keys hard cap.
"""
from app.core.rate_limit import RateLimiter


def test_check_caps_at_max_events():
    rl = RateLimiter(max_events=3, window_seconds=60)
    assert all(rl.check("k") for _ in range(3))
    assert rl.check("k") is False  # 4th exceeds the cap


def test_peek_does_not_record():
    rl = RateLimiter(max_events=2, window_seconds=60)
    assert rl.peek("k") is True
    assert rl.peek("k") is True  # peek never consumes a slot
    assert rl.check("k") is True
    assert rl.check("k") is True
    assert rl.peek("k") is False  # now genuinely at the cap


def test_release_returns_a_slot():
    rl = RateLimiter(max_events=2, window_seconds=60)
    assert rl.check("k") is True
    assert rl.check("k") is True
    assert rl.check("k") is False  # capped
    rl.release("k")
    assert rl.check("k") is True  # the released slot is reusable
    rl.release("never-seen")  # releasing an unknown key is a safe no-op


def test_keys_are_independent():
    """The property the per-email integration test can't isolate on its own."""
    rl = RateLimiter(max_events=1, window_seconds=60)
    assert rl.check("a") is True
    assert rl.check("a") is False
    assert rl.check("b") is True  # a different key has its own budget


def test_max_keys_is_a_hard_cap():
    rl = RateLimiter(max_events=5, window_seconds=60, max_keys=3)
    for i in range(10):
        rl.check(f"key{i}")  # all keys active in-window → reaping frees nothing
    assert len(rl._log) <= 3  # oldest-inserted keys evicted to hold the cap

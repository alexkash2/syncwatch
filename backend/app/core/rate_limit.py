"""Simple in-memory sliding-window rate limiter.

Designed for a single-instance deployment (matches the rest of this MVP).
For horizontal scaling, swap the backing store with Redis.
"""
import time
from collections import deque
from threading import Lock


class RateLimiter:
    def __init__(
        self,
        max_events: int,
        window_seconds: float,
        max_keys: int = 100_000,
    ):
        self.max_events = max_events
        self.window = window_seconds
        # Guard against an attacker minting unbounded keys (e.g. one entry per
        # random email on /login). Once we hit the cap we proactively reap
        # idle entries before accepting a new key.
        self.max_keys = max_keys
        self._log: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> bool:
        """Record an event for `key` and return True if within the limit.

        Returns False if adding this event would exceed the limit — the event
        is NOT recorded in that case, so repeated .check() calls after a limit
        hit don't extend the window.
        """
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            dq = self._log.get(key)
            if dq is None:
                if len(self._log) >= self.max_keys:
                    self._reap(cutoff)
                dq = self._log.setdefault(key, deque())
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.max_events:
                return False
            dq.append(now)
            return True

    def peek(self, key: str) -> bool:
        """True if a new event for `key` would be within the limit, WITHOUT
        recording it. Pairs with `record()` for count-only-on-failure flows
        (e.g. only failed logins count, so successful logins behind a shared
        NAT don't lock everyone out)."""
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            dq = self._log.get(key)
            if dq is None:
                return True
            while dq and dq[0] < cutoff:
                dq.popleft()
            return len(dq) < self.max_events

    def record(self, key: str) -> None:
        """Record an event for `key` unconditionally (used after a peek-gated
        failure). Reaps idle keys if at capacity, like `check()`."""
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            dq = self._log.get(key)
            if dq is None:
                if len(self._log) >= self.max_keys:
                    self._reap(cutoff)
                dq = self._log.setdefault(key, deque())
            while dq and dq[0] < cutoff:
                dq.popleft()
            dq.append(now)

    def _reap(self, cutoff: float) -> int:
        """Drop keys whose newest event is older than the window. Assumes
        the caller is holding the lock."""
        stale = [k for k, dq in self._log.items() if not dq or dq[-1] < cutoff]
        for k in stale:
            del self._log[k]
        return len(stale)

    def reap(self) -> int:
        """Public reaper — run from a background task on a cadence."""
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            return self._reap(cutoff)

    def reset(self, key: str) -> None:
        with self._lock:
            self._log.pop(key, None)


# Sensible defaults for auth endpoints. Tune as needed.
login_limiter = RateLimiter(max_events=10, window_seconds=60)
register_limiter = RateLimiter(max_events=5, window_seconds=60)
refresh_limiter = RateLimiter(max_events=30, window_seconds=60)
ws_ticket_limiter = RateLimiter(max_events=30, window_seconds=60)


# Registry so the periodic cleanup and test teardown can touch every limiter
# without hardcoding the list in multiple places.
ALL_LIMITERS: list[RateLimiter] = [
    login_limiter,
    register_limiter,
    refresh_limiter,
    ws_ticket_limiter,
]


def register_limiter_instance(limiter: RateLimiter) -> RateLimiter:
    """Register an externally-created limiter so it gets reaped and reset
    alongside the built-ins. Returns the limiter for convenient assignment."""
    ALL_LIMITERS.append(limiter)
    return limiter


def reap_all() -> int:
    """Reap idle entries across every registered limiter. Call periodically."""
    return sum(lim.reap() for lim in ALL_LIMITERS)

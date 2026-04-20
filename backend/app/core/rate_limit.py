"""Simple in-memory sliding-window rate limiter.

Designed for a single-instance deployment (matches the rest of this MVP).
For horizontal scaling, swap the backing store with Redis.
"""
import time
from collections import deque
from threading import Lock


class RateLimiter:
    def __init__(self, max_events: int, window_seconds: float):
        self.max_events = max_events
        self.window = window_seconds
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
            dq = self._log.setdefault(key, deque())
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.max_events:
                return False
            dq.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._log.pop(key, None)


# Sensible defaults for auth endpoints. Tune as needed.
login_limiter = RateLimiter(max_events=10, window_seconds=60)
register_limiter = RateLimiter(max_events=5, window_seconds=60)
refresh_limiter = RateLimiter(max_events=30, window_seconds=60)
ws_ticket_limiter = RateLimiter(max_events=30, window_seconds=60)

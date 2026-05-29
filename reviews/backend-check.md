# SyncWatch Backend Review

**Verdict:** Backend health is solid for a university project — clean layering, sensible auth hardening (timing-safe login, single-use refresh, ws-tickets, origin checks), and the WS state machine handles most edge cases deliberately. No crash-level P1 was found, but there are several real correctness gaps in the reconnect/ready broadcast path and a few races/leaks worth fixing before a graded live demo.

---

## P1

**1. `delete_room` / `leave_room` (host) leave `RoomState` + heartbeat alive after `close_room`, but a still-connected handler can resurrect a zombie room.**
`api/rooms.py:99` and `:116` call `manager.close_room`, which pops `rooms`/`room_states`/heartbeat. But each victim handler's own `finally` (`handler.py:560-648`) still runs `manager.disconnect` and, for the host path, re-broadcasts/`start_grace_period` against a room that was just torn down — `disconnect` returns False (entry gone) so the host branch is skipped, but a non-host whose socket the `close_room` `ws.close()` raced can re-`setdefault` a `RoomState` via a late message. Low probability but it produces an orphaned room+heartbeat task that never stops.
*Fix:* In `disconnect`, when the room is already absent, also ensure no heartbeat/state was re-created; or guard the message loop so messages after `close_room` are ignored (check `room_id in manager.rooms` before `room_states.setdefault`-dependent paths).

*(No higher-severity P1 — the originally suspicious areas, e.g. lazy-load under asyncpg, are correctly pre-empted with `selectinload(Room.host)` + `Room.participants.user` in `room_service.get_room:48-51`.)*

---

## P2

**1. Reconnect ready-restore never broadcasts `participant_ready`, so other clients show a reconnected user as "not ready".** — `handler.py:193-214`
On reconnect the handler sets `p.is_ready = True` in the DB and re-adds the user to `verified_users`, but unlike the normal `ready` path (`:447`) it sends nothing to the room. The frontend only updates ready-state on a `participant_ready` message (`useRoomWsHandler.ts:188`), so everyone except the reconnecting user keeps showing them as not-ready until an unrelated refresh.
*Fix:* After the DB commit, `await manager.broadcast(room_id, {"type":"participant_ready","user_id":user_id,"is_ready":True,"file_version":current_fv})`.

**2. Host autopause on disconnect is not persisted; on host reconnect `current_time_ms` can jump.** — `handler.py:582-596`
When the host drops, `apply_pause(state, get_current_time_ms(state))` freezes time in memory and broadcasts a pause, but `RoomState` is in-memory only. If the room later empties (`disconnect` clears `room_states` once no grace timers remain — but the host grace timer keeps it alive, so this specific case is OK). The real gap: if the host process-side state is cleared by a *participant* timeout cleanup (`handler.py:642-643` pops `room_states` when `room not in manager.rooms`) while the host grace timer is still pending, the host's reconnect rebuilds `file_version` from DB but loses playback position (resets to canonical 0).
*Fix:* Don't pop `room_states`/`seq_counters` in `_participant_timeout` while `_has_grace_timers(room_id)` is true (the host timer counts) — the current guard checks `not _has_grace_timers` so it's correct only if the host timer is registered; verify ordering, and prefer cleaning state solely in `disconnect`/`close_room`.

**3. Concurrent `broadcast` calls can interleave `seq`/sends (heartbeat vs handler).** — `manager.py:132-144`, `:159-184`
`broadcast` assigns `seq` synchronously then `await`s each `send_json`. The 3s heartbeat task and a handler broadcast run on the same loop; an `await` in the middle of broadcast A lets broadcast B assign the next `seq` and start sending, so a client may receive seq=6 before seq=5. Seq is still strictly unique/increasing per message, so a gap-detecting client is fine, but any consumer assuming "received order == seq order" is wrong.
*Fix:* Snapshot the message+seq and the connection list, or serialize broadcasts behind an `asyncio.Lock` per room if strict ordering is ever needed. Low risk today; flag so it isn't assumed away.

**4. `login_limiter` is shared between the per-IP and per-email keys with the same `max_events=10`.** — `api/auth.py:65-68`, `rate_limit.py:70`
A successful login burns one slot from the IP bucket *and* one from the email bucket. Behind a shared NAT/office IP, ~10 legitimate logins/min from that IP trip the per-IP limiter and lock out everyone behind it. Tests pass only because they vary `X-Forwarded-For`.
*Fix:* Either raise the per-IP budget meaningfully above expected concurrent users, or only count *failed* logins toward the limiter (call `.check` after a failed `verify_password`, not before).

**5. `file_verify_request` does two separate `async_session()` writes/reads non-atomically.** — `handler.py:323-330`
`update_file_info` commits in one session, then a *second* session reads the room back. Between them another host message (same user, rapid re-select) or a concurrent delete could change `file_version`, so the broadcast `file_changed`/`file_verify_response` can carry a version that no longer matches in-memory `state.file_version` set at `:336`. Verify-limiter (5/10s) makes this rare but possible.
*Fix:* Have `update_file_info` return the refreshed room and use its values directly instead of a second read.

**6. `not_ready` / `ready` write `is_ready` without re-checking the room is still active.** — `handler.py:434-476`
If the host deleted the room (`is_active=False`) between handshake and a `ready` message, the participant row update still commits against a dead room. Harmless data-wise, but the subsequent `participant_ready` broadcast goes to a room `close_room` may have already drained — wasted work and a confusing log if it raises.
*Fix:* Early-out these branches when `manager.room_states.get(room_id)` is absent (it's already popped on close).

**7. `health` opens a raw `engine.connect()` that bypasses the test session swap.** — `main.py:55-57`
Integration tests swap `db_module.engine`, and the health test happens to pass because the swap replaces the module attribute before the request. But `main.py` imported `database as db_module` and reads `db_module.engine` at call time (good) — confirm any future direct `engine` import doesn't shadow this. Minor, but the pattern is fragile; one stray `from app.database import engine` would silently break the swap.

---

## P3

**1. `_pre_closing_status` typed as a public-looking field but used as private.** — `manager.py:21`
Dataclass field with a leading underscore still becomes a constructor kwarg; harmless but misleading. Consider `field(default="")` with a comment or a plain attribute set in `__post_init__`.

**2. `apply_play` unconditionally resets `playback_rate = 1.0`.** — `sync.py:19`
If a drift nudge set the room to 1.05/0.95 and the host then hits play again, rate snaps to 1.0 mid-correction. Probably intended (play = authoritative reset) but undocumented; add a one-line comment so it isn't read as a bug.

**3. `evaluate_drift` `buffer_health_ms == 0` means "unknown, correct anyway".** — `sync.py:47-48`
Comment explains it, but a client that genuinely has a 0ms buffer (truly stalled) will be hard-seeked. Edge case; acceptable for the demo.

**4. `FileInfoRequest` schema is now dead.** — `schemas/room.py:47-51`
The `PUT /file-info` route was removed (`rooms.py:122-125` note); the schema is only referenced by `test_room_service.py`. Keep for the validation tests or drop both — currently it documents nothing the WS path enforces (the WS `file_verify_request` does no length/range validation on `file_hash`/`file_size`).

**5. WS `file_verify_request` fields are unvalidated.** — `handler.py:299-302`
`file_hash`/`file_size`/`file_duration_ms` come straight from `data.get(...)` with no bounds; a host can persist an arbitrary 128-char string or negative size into the room row (DB column is `String(128)`/`BigInteger`, so no crash, just garbage). The removed REST route used `FileInfoRequest` for exactly this. Cheap to add a length/`>0` guard before `update_file_info`.

**6. `close_room` broadcasts then closes sockets, but `broadcast` swallows send errors silently.** — `manager.py:141-144`, `:215`
`except Exception: pass` on every send hides genuine serialization bugs (e.g. a non-JSON-able value slipping into a message dict). For a demo this is fine; once any structured logging exists, log at debug.

**7. Migration 005 `_recreate_fk` relies on the inspector finding a *named* FK.** — `alembic/versions/005_fk_cascades.py:34-36`
Migration 002 created FKs inline via `sa.ForeignKey(...)` without explicit names; Postgres auto-names them, so `fk.get("name")` is populated and the drop works. On a DB where an FK ended up unnamed this would silently skip the drop and then fail on `create_foreign_key` (duplicate). Low risk on a fresh Postgres; note it.

**8. Tests: no end-to-end WS coverage; reconnect/ready/grace broadcast bugs (P2-1, P2-2) are invisible to the suite.** — `tests/`
`test_ws.py`/`test_grace_period.py` exercise `ConnectionManager` in isolation with `AsyncMock`s; they never drive `handler.py`, so the missing `participant_ready` broadcast on reconnect and the autopause-persist gap have zero coverage. This matches TODO.md's "Integration tests for WebSocket flow", but given how much logic lives in `handler.py`, a single `TestClient.websocket_connect` happy-path test would catch the most likely demo regressions.

**9. `get_history` cursor parsing swallows all `ValueError`/`TypeError` and silently restarts from the top.** — `chat_service.py:46-47`
A malformed/old cursor returns the newest page instead of an error — acceptable, but combined with the `.isoformat()` cursor including microseconds, a client round-tripping the cursor across DBs with different precision could loop. Minor.

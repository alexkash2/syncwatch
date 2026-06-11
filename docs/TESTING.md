# Testing

## Backend

74 tests, pytest-asyncio. Split into unit-style (pure logic) and integration-style (FastAPI + in-memory SQLite DB).

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. pytest -q
```

Files:

| File                           | Kind        | What's covered                                           |
| ------------------------------ | ----------- | -------------------------------------------------------- |
| `tests/test_auth_service.py`   | unit        | bcrypt round-trip, JWT create/decode, ws-ticket lifecycle (create, validate, one-time, expiry, cleanup). |
| `tests/test_room_service.py`   | unit        | room code generation, pydantic validation (join code, file info). |
| `tests/test_ws.py`             | unit        | `ConnectionManager`: connect, tab-dedup, disconnect, stale-id disconnect, broadcast, seq, close-room cleanup. |
| `tests/test_grace_period.py`   | unit        | disconnect → grace period bookkeeping, reconnect cancels timer, close_room cancels all timers. |
| `tests/test_sync.py`           | unit        | canonical time math, drift thresholds (nudge/seek/ignore), buffering bypass, buffer-health guard. |
| `tests/test_rate_limit.py`     | unit        | sliding-window limiter: cap enforcement, `peek` doesn't record, slot release, per-key isolation, max-keys hard cap. |
| `tests/test_integration_rest.py` | integration | End-to-end REST flows: register → login → rooms CRUD, ws-ticket permissions, rate limiting, no-enumeration on login, /health. |
| `tests/test_ws_integration.py` | integration | Full WS flow over TestClient: handshake → `room_state`, bad-ticket rejection, host sets reference file, non-host playback control, stale `file_version` rejection, chat broadcast. |

### Integration fixture

`test_integration_rest.py` swaps the module-level `app.database.engine` / `async_session` with an isolated in-memory SQLite engine per test, and resets the singleton rate limiters between tests. SQLite ignores the dialect-specific `postgresql_where` clause on the partial unique index — becomes a plain unique index, which is fine for the paths these tests exercise.

## Frontend

### Type check + lint

```bash
cd frontend
npm install
npx tsc --noEmit    # type check
npx eslint .        # lint
```

### Unit tests (Vitest + React Testing Library)

```bash
cd frontend
npm test            # watch mode
npm run test:run    # single run (used in CI)
```

Files:

| File                                                  | What's covered                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/utils/fileHash.test.ts`                          | `computeFileHash` — 64-hex SHA-256 output, determinism, size sensitivity, partial-hash path for files >3 MB. |
| `src/components/room/ParticipantList.test.tsx`        | Host badge, "(you)" label for the current user, sort order (host first, then alphabetical), ready-state legend. |
| `src/components/room/PlaybackControls.test.tsx`       | `canControl` gating: buttons / `Space` / seekbar enabled vs blocked (with `onBlockedControlAttempt`), keyboard seek commits through `onSeek`. |
| `src/components/auth/AuthModal.test.tsx`              | Open/close behaviour (Escape, backdrop), login vs register views, client-side username validation, post-register switch to login. |
| `src/contexts/AuthContext.test.tsx`                   | Auth-modal state: default login mode, explicit mode + message carry-over, close clears state. |
| `src/hooks/useRoomWsHandler.test.ts`                  | WS message → store routing: `chat_message`, `participant_ready`, error-code toast policy (incl. silenced `file_version_mismatch`), `host_reconnected`. |
| `src/hooks/useVideoSync.test.ts`                      | Applying `sync_state` (seek/play/pause), `sync_report` replies, resync snapshots guarded by `file_version`. |
| `src/pages/HomePage.test.tsx`                         | Adaptive home: guest landing CTAs open the right auth modal, authenticated users get the dashboard. |

Test setup lives in `src/test/setup.ts` — wires `@testing-library/jest-dom` matchers into Vitest.

## Manual E2E (smoke test)

No Playwright suite yet (see [TODO.md](../TODO.md)). The happy path, run in two browser profiles:

1. `docker compose up --build` from a clean `.env`.
2. Register User1 → create room "Movie Night" → copy code.
3. Register User2 in a different browser → join by code.
4. User1 picks a video file → waits for "verified" → `<video>` renders.
5. User2 sees **"Waiting for host…"** flip to **"Select the host's video file"** when User1's `file_version` propagates.
6. User2 picks the **same** file → verified; both `<video>` elements show 00:00.
7. User1 hits Play → both play in sync (drift < 300 ms after a second).
8. User1 scrubs; User2 follows within ~2 s.
9. Chat: both send messages; both see them in order with correct "you" styling.
10. User1 closes the tab. User2 sees **"Host lost connection"** + 30 s countdown, playback autopauses.
11. User1 returns within 30 s → overlay goes away. Returns after 30 s → User2 is redirected to `/` with `"The host lost connection and did not return in time."` flash.
12. User1 opens the same room in a second tab → first tab redirected to `/` with `"You opened this room in another tab."`.
13. User1 picks a new file → User2 sees **"The host changed the video. Please select the new file."** toast and file selector reappears.
14. Browser blocks autoplay (e.g. restricted profile) → overlay shows "Autoplay is blocked" with **Click to play** button.

## CI

`.github/workflows/ci.yml` runs all three on every push / PR:

1. **backend** — `pytest -q`.
2. **frontend** — `tsc --noEmit`, `eslint .`, `vitest run`.
3. **docker** — `docker compose build` to catch image regressions.

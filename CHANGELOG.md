# Changelog

## 2026-04-20 — UX residuals

### P2
- **Room code hidden on mobile.** The header line carrying the room code and connection indicator was `hidden md:block`, so phone users had no way to read or share the code from inside the room. Kept the verbose "Room Code:" / "Connected" labels desktop-only, but the code (copyable) and a colour-coded connection dot are now visible at every breakpoint.
- **Dashboard masked a rooms-fetch failure as empty state.** `fetchRooms()` swallowed errors silently, leaving users to stare at "No rooms yet" when the backend was unreachable. Added `roomsLoading` and `roomsLoadError` states; rendered states are now: loading · error (with Retry) · empty · populated.

### P3
- **"Copied!" shown even if `navigator.clipboard.writeText` rejected.** Success-state was set in a `finally`-ish branch regardless of outcome. Moved `setCopied(true)` inside the success path of the try/await, so a blocked Clipboard API (insecure context, permissions) simply leaves the code on screen instead of lying.
- **FileSelector: wrong error message for non-video files.** Picking a PDF showed "the file format may not be supported by your browser" — misattributed to a decoder issue. Added a `not_video` status with a distinct message ("That's not a video file — pick a video file (mp4, mkv, webm, …)"); the existing `error` branch is now reserved for genuine read/decoder failures.
- **Chat history silently hid load failures.** A failed `GET /messages` left an empty scroll-view indistinguishable from a brand-new room. `ChatPanel` now receives `loadError` + `onRetryLoad`; shows a banner with Retry when the initial fetch fails, and a single-line error with Retry when scroll-up pagination fails.

### Verification
- `npm run build` · `pytest -q` (60/60) · `eslint` · `vitest run` (8/8) — all green.

---

## 2026-04-20 — Second follow-up audit

### P1
- **`npm run build` was broken; CI masked it.** `const { roomId } = useParams<{ roomId: string }>()` is still `string | undefined` under react-router v7, and TypeScript loses that narrowing across the `async function load()` inside `useEffect`. `tsc -b` (which `vite build` runs via `npm run build`) rejected the two call sites that passed `roomId` to `getRoom` / `getChatHistory`. CI was only running `tsc --noEmit`, which doesn't project-reference the build config, so it passed while `docker compose build` on the frontend failed.
  - Fix: `async function load(id: string)` — explicit parameter narrows once. Call site passes `roomId` (already checked).
  - CI updated: the frontend job now runs `npm run build` (exercises the real build) instead of `npx tsc --noEmit`. `docker compose build` in the docker job also catches this end-to-end now.

### P2
- **`127.0.0.1` blocked on CORS + WS Origin.** The default `CORS_ORIGINS` only listed `localhost`, so opening the app on `http://127.0.0.1:3000` (equally valid loopback, often typed by hand) got `4003 "Origin not allowed"` on the WS handshake and a permanent reconnect loop. Added `http://127.0.0.1:3000` and `http://127.0.0.1` to the defaults in `app/config.py`, `docker-compose.yml`, and `.env.example`.

### P3
- **Chromium flagged `pattern="[A-Za-z0-9_.-]+"` as an invalid HTML-attribute regex** on the register form. Pattern attribute removed; the JS-side `handleSubmit` check already covers the same rule. `title` attribute retained so the validation message still surfaces on hover/focus.
- **"The host changed the video" banner was sticky.** `fileChangedNotice` was set to `true` on `file_changed` but never reset, so it stayed on screen even after a successful re-verify. Cleared in the `file_verify_response` handler when `msg.match` is true.
- **localStorage token risk (documented, no code change).** `access_token` and `refresh_token` still live in `localStorage`, which means any XSS is a full session compromise. This is a known residual risk tracked as P1 in [TODO.md](TODO.md) with the full migration plan to `HttpOnly; Secure; SameSite=Strict` cookies + CSRF protection.

### Verification
- `npm run build` — clean.
- `docker compose build` — both images build to completion.
- `pytest -q` — 60/60.
- `npx eslint .` — 0/0, `vitest run` — 8/8.

---

## 2026-04-20 — Follow-up audit fixes

### P1 (broken paths closed)

- **Docker build was broken.** Backend multi-stage image installed deps into `/install` but the runtime didn't put that prefix on Python's `sys.path`, so `docker compose up` died at `alembic upgrade head` with `ModuleNotFoundError: alembic.config`. Rewritten to install into the standard `/usr/local` prefix and copy `site-packages` + `bin` over — imports are automatic from there. Verified end-to-end by running `alembic upgrade head` against live Postgres from the built image.
- **Migration 005 crashed on first-time DB init.** Using `sa.text(":table::regclass", {"table": ...})` made asyncpg choke because the Postgres `::regclass` cast syntax collides with SQLAlchemy's `:param` placeholder. Rewritten using SQLAlchemy's `inspect()` to discover the actual FK constraint name — no bind-params needed, no vendor-specific DDL. Migration now completes cleanly; all 5 FKs (`rooms.host_id`, `room_participants.room_id|user_id`, `chat_messages.room_id|user_id`) show `ON DELETE CASCADE` in `pg_constraint` after upgrade.
- **Refresh tokens were replayable.** One `refresh_token` could be exchanged repeatedly. Added per-token `jti` (uuid4 in JWT payload) and an in-memory single-use blocklist in `app/core/security.py`. Each successful `/auth/refresh` consumes the old `jti`; replaying the same token returns 400. Cleanup of expired `jti`s runs alongside the existing ws-ticket GC. New regression test `test_refresh_is_single_use`.

### P2 (real issues on live traffic)

- **ws-ticket kept working after leave.** `POST /api/rooms/{id}/leave` marks the participant inactive but the WS handshake, after validating the ticket, didn't re-check membership. Added an active-participant lookup right after `validate_ws_ticket` — a stale ticket now closes with `4003 "Not a participant"`.
- **`ready` bypassed `file_verify_request`.** Server only checked `file_version`, so a client could send `{"type":"ready","file_version":N}` without actually verifying the file. Added `verified_users: set[str]` to `RoomState`, populated on successful `file_verify_request`, cleared on every `file_version` bump. `ready` now rejects `not_verified` if the user hasn't proven file identity against the current version. Grace-period restore also re-adds the user to the gate.
- **FileSelector race on fast re-select.** `pendingNonce` was tracked but never actually read, so a late response for file A could confirm or reject file B. Server now echoes `file_hash` back in `file_verify_response`; client discards responses whose hash doesn't match the currently-pending file.
- **`pytest -q` red out of the box.** `tests/test_integration_rest.py` requires `aiosqlite`, which wasn't in `requirements.txt`. Added it (with a comment explaining why). All 60 backend tests now pass on a fresh checkout.

### P3

- **Frontend lint was red.** `no-useless-escape` on `[A-Za-z0-9_.\-]` in `RegisterPage.tsx`. Hyphen moved to the end: `[A-Za-z0-9_.-]`. Also removed a now-stale `eslint-disable` in `ErrorBoundary.tsx`.
- **`useWebSocket` retried 4xx forever.** For 403/404/422 from `/auth/ws-ticket`, the hook used to enter an exponential-backoff loop with no UI feedback. Added `onFatalTicketError(status)` callback; for non-retryable statuses (anything 4xx except 401/429) the hook flags `intentionalClose` and the caller navigates out. `RoomPage` wires this to a flash banner ("You're no longer a participant of this room." / "The room no longer exists.").

### Regression coverage

- `test_refresh_is_single_use` — replay rejected with 400.
- Existing integration suite re-checked: 60/60 passing (was 59; new test added).

---

## 2026-04-20 — Hardening & docs

Full functional, security, UX and reliability audit pass. All fixes landed; backend tests 59/59, frontend tsc clean, vitest 8/8.

### Functional fixes
- **P1**: `RoomState.file_version` now synced from DB on first WS connect (prevented `file_version_mismatch` on every control message after rejoining a room with a file).
- **P1**: `useVideoSync` receives `fileVersionRef` by reference, not by value — sync messages are no longer dropped between a ref update and the next render.
- **P1**: Server replies with `sync_state` after `ready` — late joiners and reconnectors land on the canonical position instead of 0 s.
- **P1**: `DELETE /api/rooms/{id}` and `POST /api/rooms/{id}/leave` (when host) now call `manager.close_room(...)` instead of waiting for the host-grace timeout. Participants get `room_closed` immediately.
- **P2**: `proxy_read_timeout 3600s` in nginx + idle keepalive `ping` every 30 s — paused watch parties no longer drop at the nginx default.
- **P2**: Blob URLs revoked on `file_changed` and on room unmount (was leaking).
- **P2**: CORS origins `.strip()`ed — whitespace in `.env` no longer breaks CORS.
- **P2**: `close_room` skips cancelling the current task when invoked from inside a grace-timer callback (was self-cancelling its own broadcast).
- **P2**: `room_state` drops stale `fileUrl` when a new `file_version` arrives on reconnect.
- **P3**: WS handler guards `ri is None`, sends `error/room_gone` + `continue`. Orphan blob URLs revoked on fast re-selection in `FileSelector`.

### Security
- **Auth rate-limiting** via in-memory sliding-window (`app/core/rate_limit.py`): login 10/60s by IP and by email, register 5/60s, refresh 30/60s, ws-ticket 30/60s per user.
- **Timing-attack mitigation**: dummy bcrypt compare for unknown users in `login_user`.
- **User enumeration**: `register` error message generalised; `login` returns identical message for unknown user and wrong password.
- **Username policy**: `^[A-Za-z0-9_.\-]{3,30}$`, case-insensitive uniqueness (blocks `Admin` vs `admin`).
- **Password policy**: 8–72 chars (bcrypt boundary).
- **Email normalised** to lowercase on storage.
- **WebSocket Origin** validated against `CORS_ORIGINS` at handshake.
- **UUID parsing** guarded on JWT `sub` and WS path params (→ 401/4001 instead of 500).
- **WS per-user rate limits**: global 200/10s (silent drop), chat 20/10s (`error/rate_limited`), control 60/10s (silent drop).
- **nginx security headers**: CSP (with `frame-ancestors 'none'`, `object-src 'none'`, `media-src 'self' blob:`), X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, X-Content-Type-Options.

### UX
- Password minLength sync between frontend (was 6) and backend (now both 8).
- `FileSelector` — new `waiting_for_host` state for non-hosts before the host picks a file (was mislabelled as "File does not match").
- `room_closed` / `tab_replaced` / room-load errors now carry human-readable reasons via `navigate(state)` → flash banner on HomePage.
- `window.confirm` before a host leaves ("…will close the room for everyone").
- `file_changed` toast for non-hosts: "The host changed the video. Please select the new file."
- Non-host click on video / keyboard shortcuts surface a 2.5 s hint: "Only the host can control playback."
- Room code copy shows "Copied!" feedback for 1.5 s.
- Delete-room button for hosts on HomePage (was endpoint-only).
- `PlaybackControls` hidden when no video is loaded (no more disabled controls below the file picker).
- Volume slider marked as personal via `title` + `aria-label`.
- Chat pagination on scroll-up via existing `next_cursor`; preserves scroll offset; "Beginning of conversation" marker.
- Ready indicator legend + "(you)" marker in `ParticipantList`.
- Register success flash on login page: "Account created. Please log in."
- Username rules hint under the input + client-side pattern enforcement.

### Reliability
- `/health` endpoint; Docker HEALTHCHECK on backend; compose `frontend.depends_on.backend.condition: service_healthy`.
- Graceful shutdown on lifespan exit: all active rooms broadcast `room_closed { reason: "server_shutdown" }`, engine disposed.
- FK cascades migration (005): `rooms.host_id`, `room_participants.*`, `chat_messages.*` all `ON DELETE CASCADE`.
- `FileSelector` rejects non-video MIME up front.
- `isReconnecting` state in `useWebSocket` + persistent "Reconnecting to server…" banner.
- Autoplay-blocked overlay with "Click to play" button — resume on user gesture.
- Global React `ErrorBoundary` replaces the would-be white-screen-of-death with a Reload / Go home fallback.

### Testing & infra
- 8 REST integration tests (`tests/test_integration_rest.py`) via httpx + in-memory SQLite: register/login, rate limit, no enumeration, rooms CRUD, ws-ticket permissions, /health.
- Vitest + React Testing Library set up. Initial tests for `computeFileHash` and `ParticipantList`.
- Backend Dockerfile rewritten as multi-stage, non-root (`syncwatch:1000`), HEALTHCHECK built in.
- `.env.example` extended with all env vars + comments.
- docker-compose: backend healthcheck, `stop_grace_period: 15s`, `ENVIRONMENT` and `CORS_ORIGINS` plumbed through.
- GitHub Actions CI (`.github/workflows/ci.yml`): backend tests, frontend tsc+lint+vitest, docker compose build.

### Docs
- New `docs/` directory:
  - `docs/ARCHITECTURE.md` — system diagram, DB schema, design decisions.
  - `docs/API.md` — REST reference, rate limits.
  - `docs/WS_PROTOCOL.md` — full WebSocket protocol.
  - `docs/DEPLOYMENT.md` — Docker, env, migrations, graceful shutdown.
  - `docs/SECURITY.md` — security overview and known limitations.
  - `docs/TESTING.md` — test layout and manual E2E checklist.
- `README.md` rewritten as an entry point with links to `docs/`.
- `TODO.md` tracks outstanding work across security, reliability, scaling, observability, UX, a11y, i18n, performance, docs.

### Performance
- `ParticipantList`: `useMemo` on the sorted list.
- `ChatPanel`: row extracted to a memoised `ChatRow` component.

---

## 2026-04-08
- Fix: WebSocket double-connect in React StrictMode (mountId generation counter prevents stale connections from `tab_replaced` loop).
- Fix: video sync messages (`sync_state`, `sync_check`) were silently dropped due to double seq check in `handleWsMessage` + `useVideoSync`.
- Fix: `video.play()` blocked by browser autoplay policy — now called synchronously on user gesture (host click), not after WS round-trip.
- Fix: PlaybackControls timer stuck at 00:00 — effect didn't re-run when video element appeared (added `videoReady` prop).
- Feature: skip ±5s buttons (⏪/⏩) next to play/pause.
- Feature: click video area to toggle play/pause (host only).
- Feature: keyboard shortcuts — Space (play/pause), ←/→ (seek ±5s), F (fullscreen).
- Feature: fullscreen button (⛶) for the video section.
- Cleanup: ESLint errors fixed (no-explicit-any, unused vars, self-reference). 0 errors, 0 warnings.
- Docs: README updated with controls, run instructions, project structure.

## 2026-04-03
- Project initialized. Created implementation plan (PLAN.md), README, project description for university (SyncWatch_opis_projektu.docx).
- PLAN.md v2: architecture constraints, state machines, reconnect policy, WS envelope, new events.
- PLAN.md v3: fixed all Codex v2 review issues — reconnect protocol, participant_status, RoomState, global seq, room_code gen, nginx description.
- **Phase 1**: Backend (FastAPI + auth + JWT + ws-ticket + bcrypt + Alembic), Frontend (Vite + React + TS + Tailwind + auth pages), Docker Compose. Codex review: fixed 7 issues.
- **Phase 2**: Room + RoomParticipant models, CRUD with room_code gen (A-Z0-9), join/leave, max_participants. Codex review: fixed 7 issues.
- **Phase 3**: WebSocket + real-time chat. ConnectionManager with connection_id, seq, tab dedup. ChatMessage model + REST history (cursor pagination). Codex review: fixed 7 issues.
- **Phase 4**: File selection + verification. Partial SHA-256 hashing (head+middle+tail+size). FileSelector with states. Codex review: fixed 7 issues.
- **Phase 5**: Video player + sync. sync.py (canonical time, drift evaluation). play/pause/seek handlers (host-only). Per-room heartbeat (3s). Codex review: fixed 6 issues.
- **Phase 6**: Reconnect lifecycle. Host grace period (30s, CLOSING state, autopause). Participant grace period (60s). Codex review: fixed 7 issues.
- SECRET_KEY: crashes in production if default value used.
- Mobile responsive layout for all pages.
- .gitattributes: enforce LF line endings.
- Design assets from Stitch (redesign variant, adapted to match plan).

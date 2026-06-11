# Changelog

## 2026-06-11 — Pre-defense documentation sync + ws-ticket ordering fix

Full docs-vs-code consistency pass before the project defense:

- **API.md** — refresh tokens documented as single-use (the old "stays valid until
  expiry" note contradicted both the code and SECURITY.md); removed the section for
  the long-gone `PUT /rooms/{id}/file-info` endpoint.
- **ARCHITECTURE.md / SECURITY.md / IDEAS.md** — scrubbed the stale "host-only
  playback control" leftovers; control has been open to all participants since the
  viewer-control release. IDEAS.md section on playback rights dropped (shipped),
  remaining ideas renumbered.
- **TESTING.md / README** — test counts updated (74 backend, 44 frontend) and both
  file tables completed (2 backend + 6 frontend test files were undocumented).
- **DEPLOYMENT.md** — real 4-origin `CORS_ORIGINS` default; `HEALTHCHECK` wording.
- **WS_PROTOCOL.md** — documented both `user_left` reasons (`disconnect` / `left`).
- `/api/auth/ws-ticket` now cancels the reconnect grace timer only **after** the
  room/participant authorization checks, so a non-member request can't clear
  someone's reconnect bookkeeping as a side effect.
- Dropped `PLAN.md` (fully superseded by `docs/`), replaced the stock Vite template
  README in `frontend/` with a real one, cleaned `SyncWatch_opis_projektu.docx`
  metadata.
- Fixed a flaky frontend test: AuthModal "closes on Escape" raced the async
  (rAF) autofocus on CI — the test now focuses a field inside the dialog
  synchronously before sending the key.

## 2026-06-04 — Frontend redesign: light/emerald port (branch `redesign/frontend-emerald`)

Ported the new design prototype (light minimalism · emerald accent ·
Space Grotesk/JetBrains Mono) 1:1 onto the real stack, keeping **all** the
existing backend wiring (REST + WebSocket sync) untouched. The presentational layer
was rebuilt; the WS/sync hooks, zustand store, API client and types are unchanged.

Done in 4 reviewed chunks (each: tsc + eslint + build + vitest green):

- **Foundation** — replaced `index.css` `@theme` with the light/emerald token set
  (accent/ink/line/stage…), added Google Fonts, scrubber/range styles, pseudo-FS
  helper. New custom EN/PL i18n (`src/i18n/`, `useI18n`) — a first-class in-app
  toggle persisted to `sw-lang`; no new dependency. Restyled the shared primitives
  (Button +outline/iconOnly, Panel, Badge +accent/ink/dot, Input/Field, Toast,
  ConfirmDialog, StatePanel) and added design primitives (CodeChip, Segmented,
  LangToggle, IconField, Spinner). Used transient legacy-token aliases to keep the
  build green file-by-file, then removed them once grep hit zero.
- **Home / auth** — new `TopBar`, `GuestHome` (minimal landing), `Dashboard`
  (workspace: New room + Join by code + "Your rooms" list with role avatars, file
  status, copy-code, open, delete). Adaptive `/` (guest landing vs dashboard, gated
  on `isLoading`). Auth modal restyled (icon fields, show/hide pw, mobile bottom
  sheet). Arrival notices (room closed/gone) now surface as a localized **toast**
  keyed off `notice.key` (no big banner). 404 rebuilt.
- **Room (desktop)** — `RoomHeader` (always-visible centre room code + connection
  dot + N/total ready + lang + Leave/"Close room"), `VideoArea` (dark stage +
  filename chip + centre play glyph + autoplay/host-away/reconnecting overlays),
  `PlaybackControls` player bar (scrubber, ±5s, big play, time, volume, fullscreen),
  `FileSelector` redrawn as in-stage select/verify/mismatch states (hashing + verify
  state machine byte-identical), `RoomSidebar` (Segmented Chat/People), `ChatPanel`
  (own-right accent bubbles), `ParticipantList`. Playback is available to **every**
  participant (backend permits it; only the host closes the room).
- **Room (mobile) + cleanup** — `useIsMobile` (≤760) drives a separate mobile room
  (16:9 strip + compact header + player bar + underline Chat/People tabs). Device-
  aware fullscreen (`useFullscreen`): real Fullscreen API for desktop/Android/iPad/
  macOS, CSS pseudo-fullscreen for iPhone (Fullscreen API unavailable on a `<div>`
  there); `playsInline` kept. Deleted the cut features: Preferences/Settings
  (context, hook, dialog, toggle card), marketing `BrandIllustration`, `RoomOnboarding`,
  `HostDisconnectOverlay`, old drawer `Header`/`RoomTabs`, `types/preferences`.
  Removed the unused `@vitejs/plugin-basic-ssl` dep.

Visual check (Playwright): guest landing, auth modal (desktop + mobile bottom sheet)
and 404 match the prototype. Dashboard/room live check pending the backend stack.

**Review round** — an independent code review returned **APPROVED FOR MERGE**
(P1=0, P2=0): all WS/sync wiring confirmed preserved, i18n keys type-enforced, token
migration fully resolved. Applied the review + a11y advisories that don't alter the
design: iPhone pseudo-fullscreen now force-exits when the file is cleared
(`useFullscreen.exit`); ARIA tabs pattern on Segmented + MobileTabs (roving tabindex,
arrow keys, `aria-controls`/`aria-labelledby`); StageOverlay labelled; redundant
toast `role` dropped; spinners use the labelled `Spinner`. Known caveat (design-
inherent, left for fidelity): white-on-emerald buttons and some faint meta text are
below WCAG AA contrast — flagged for a later accent-darkening pass if desired.

**External review round 1** — 3×P2 + 1×P3, all fixed (socket-drop drift / clipboard edge cases):
- P2 `FileSelector` — a hash that resolves *after* the selector unmounts could
  `createObjectURL` with no owner to revoke it → leak. The unmount cleanup now bumps
  `requestNonce` so the in-flight guard short-circuits before `createObjectURL`.
- P2 `FileSelector`/`RoomPage` — `file_verify_request` ignored `send()` failing, so a
  pick during a socket drop wedged the selector in `verifying` forever. `onVerifyRequest`
  now returns the send result; on failure the selector reverts to an actionable `idle`.
- P2 `PlaybackControls`/`RoomPage` — play/pause mutated the local `<video>` before knowing
  the WS command landed, drifting this client while disconnected. Both paths now send
  first and only `play()/pause()` (and flip `roomStatus`) when `send()` succeeds.
- P3 `CodeChip` — reported "Copied" without awaiting the clipboard write. Now `await`s
  `writeText`; success → checkmark + `onCopy`, failure → new `onError` (warning toast).

**External review round 2** — round-1 fixes confirmed correct; 2×P2 + 1×P3 more, all fixed:
- P2 `PlaybackControls` — seek (±5s + scrubber) still moved the local `<video>` before the
  WS `seek` was accepted. `onSeek` is now `=> boolean`; skip/scrubber send first and only
  set `currentTime` on success, reverting the scrubber to the real position on failure.
- P2 `FileSelector` — the one-shot persistent auto-restore could be burned while the socket
  was still connecting (verify send fails, `restoredFileKeyRef` already set → never retries).
  Now gated on a new `socketReady` prop so it fires only once the room socket is open.
- P3 `Dashboard` — the desktop room-row `CodeChip` was missing the `onError` callback (only
  the mobile row had it). Wired `onError={onCopyError}` so a denied clipboard shows a toast.

**External review round 3** — 1×P2, fixed: the native `<input type=range>` scrubber's own keyboard
(arrows/Home/End on focus) changed the value via `onChange` but never committed a seek or
moved the element. Added a `seekInteractionActiveRef` interaction guard + `keydown`/`keyup`
handlers on the scrubber so keyboard edits commit through the same send-first `handleSeekEnd`
(move on success, snap back on reject), with double-send guarded. +2 regression tests
(keyboard seek commit + reject). Suite now 44.

**External review round 4** — 2×P2 + 1×P3 (follow-ons from the round-2/3 fixes), all fixed:
- P2 `PlaybackControls` — `handleSeekStart` marked an interaction active without seeding
  `seekValueRef`, so an interaction with no change event (thumb click without moving, arrow
  at a boundary) committed a stale ref (often 0) and jerked the video to the start. Now seeds
  `seekValueRef` from the live `video.currentTime` at interaction start.
- P2 `FileSelector` — under React StrictMode the auto-restore was burned: setup marked
  `restoredFileKeyRef`, the StrictMode cleanup cancelled, and the second setup bailed on the
  already-marked key → restore never ran. Now the key is marked only inside the resolved
  `restoreRoomFile` callback (when `!cancelled && restored`), so StrictMode's second pass
  proceeds.
- P3 `PlaybackControls.test` — the keyboard-seek test didn't assert ordering; it now asserts
  inside the `onSeek` mock that `video.currentTime` is still the old value when the send fires,
  so a reordered (mutate-before-send) impl fails.

**External review round 5** — verified the round-4 fixes; no new findings → **APPROVED FOR MERGE**.
The review loop closed clean after 5 rounds (11 issues total, all P2/P3 around socket-drop drift
and clipboard/StrictMode edge cases — zero P1).

Gates: frontend tsc + eslint + build + vitest 44 — all green.

## 2026-05-30 — External review of P3 cleanup (branch `chore/p3-cleanup`)

P1=1, P2=0, P3=2 — all applied:

- **P1** `requirements.txt` — removing `passlib[bcrypt]` also dropped the transitive
  `bcrypt`, which `core/security.py` imports directly → a clean `pip install` would
  break `import bcrypt`. Added `bcrypt>=4.0.0` as a direct dependency. (Local gates
  had missed it: the existing venv still had bcrypt.)
- **P3** `manager.close_user` — moved grace-cleanup + `verified_users.discard` before
  the no-active-socket early return, so leaving *during* the grace window also drops
  the verified flag; also discard on participant grace timeout (`handler.py`).
- **P3** skip-to-main link hoisted to `App.tsx` (covers RoomPage, which doesn't render
  `Layout`); removed the duplicate from `Layout`.
- **P3 (follow-up round)** `NotFoundPage` now renders `<main id="main">` so the global
  skip link has a target on the 404 route too. The reviewer then returned **APPROVED FOR MERGE**.

Gates: backend pytest 74 + ruff clean; frontend tsc + lint + build + vitest 44.

## 2026-05-30 — P3 cleanup (audit leftovers, branch `chore/p3-cleanup`)

Closed the actionable P3s from the four audits (the infra/cosmetic ones are
documented as deferred):

- **security** — removed the unused `passlib` dependency; `close_user` now prunes
  the departed user from `RoomState.verified_users`.
- **backend** — `ConnectionManager` swallow-points now `logger.debug(..., exc_info=True)`
  instead of bare `pass`; commented the intentional `playback_rate = 1.0` reset in `apply_play`.
- **a11y** — skip-to-main-content link + `id="main"` (Layout & RoomPage), a visually
  hidden `<h1>` on the room screen, `role="menu"` on the user dropdown.
- **frontend** — defensive empty-username guard in `ParticipantList`; explicit
  `seqForReconnect` capture in `useWebSocket` (read-before-reset clarity).

Deferred (documented): python-jose→PyJWT migration, large-file hashing path,
ErrorBoundary→Sentry, SECRET_KEY default behavior, and assorted cosmetic items.

Gates: backend pytest 74 + ruff clean; frontend tsc + lint + build + vitest 44.

## 2026-05-30 — External audit review, round 2 (branch `audit/p1-p2-fixes`)

P1=0, P2=0 (round-1's three blockers confirmed closed), P3=1 — applied:

- **P3** `auth.py` — a transient non-credential error in `login_user()` (e.g. a DB
  blip) left both reserved limiter slots counted, so repeated 500s could briefly
  lock out a legitimate user. Now release both slots on non-`BadRequestError`
  exceptions; invalid-credential failures still count. Added a regression test
  (`test_transient_login_error_releases_rate_limit_slots`).

Gates: backend pytest 74 + ruff clean; frontend vitest 44.

## 2026-05-30 — External audit review, round 1 (branch `audit/p1-p2-fixes`)

Independent review pass over the audit branch.
P1=1, P2=2, P3=2 — all applied:

- **P1** login limiter was peek-then-record → a burst of concurrent bad logins
  could bypass the cap. Now reserves atomically (`check()`) before auth and
  releases on success (`RateLimiter.release()`).
- **P2** reconnect snapshot was tagged with the stale local file_version → resync
  no-op'd; the synthetic sync_state now carries `file_version` and useVideoSync
  compares versions only at apply time.
- **P2** queued chat/ready frames could process after `/leave`; added a
  connection-identity check at the top of the WS loop.
- **P3** `max_keys` was a soft cap → `_ensure_capacity()` now evicts oldest when full.
- **P3** added `tests/test_rate_limit.py` (direct limiter unit tests) + frontend
  regression tests for the reconnect snapshot-version fix.

Gates: backend pytest 73 + ruff clean; frontend vitest 44.

## 2026-05-30 — Test coverage + CI lint (branch `test/coverage-ci`)

Closed the biggest coverage gap (the WS layer had zero e2e tests) and made the
backend CI job actually lint.

- **WS integration tests** (`tests/test_ws_integration.py`, new) — first real
  coverage of `ws/handler.py` via Starlette TestClient (temp-file sqlite + NullPool
  for cross-loop safety; patches `handler.async_session`; resets `ConnectionManager`
  between tests). Covers connect→room_state, bad-ticket reject, host sets reference
  file, **non-host can control playback** (viewer-control regression), stale
  file_version reject, chat broadcast.
- **Frontend hook tests** (`useVideoSync.test.ts`, `useRoomWsHandler.test.ts`, new)
  — sync_state apply / drift / sync_report, the reconnect re-sync fix, and the WS
  message dispatch table (incl. the audit-added error branches + host_reconnected).
- **ruff** wired into backend CI (`pyproject.toml` config ignoring SQLAlchemy
  E711/E712; `ruff check app tests` step). Removed 13 unused imports; moved the
  ws/handler logger below imports. `ruff format` deferred (would conflict with open PRs).

Gates: backend pytest **68** (was 62), frontend vitest **42** (was 29); ruff clean.

## 2026-05-30 — P1/P2 audit remediation sprint (branch `audit/p1-p2-fixes`)

Acted on the four independent project-wide audits (backend, frontend,
security, a11y). Fixed every P1+P2 that was a safe, in-scope code change; documented
the rest (migrations / deployment tuning) with rationale. Gates after each chunk:
backend pytest 62, frontend tsc + lint + build + vitest 29.

**a11y (P1×2, P2×8):** `Field` label association (`useId`+`htmlFor`+`cloneElement`),
`AuthModal` focus-trap + initial focus + persistent error live-region + `aria-invalid`,
`CreateRoomPage` error live-region, `ConfirmDialog` Escape, `HostDisconnectOverlay`
`alertdialog`+live countdown, autoplay/preparing/hint overlays `role=status`+focus-move,
contrast bumps on informational text/placeholders.

**backend correctness (P1×1, P2×6):** reconnect now broadcasts `participant_ready`;
`ready`/`not_ready` no-op on a closed room; atomic `file_verify` (use the Room returned
by `update_file_info`); server-side file-metadata validation; `broadcast`/`send_to_user`
bail for torn-down rooms (P1-1 residue); documented broadcast seq-ordering (P2-3),
verified autopause state-pop guard (P2-2).

**frontend reliability (P2×5):** reconnect re-sync so a playing room doesn't freeze
(`useVideoSync.resyncToLastState`, snapshot stored before the video-null guard);
optimistic `roomStatus` only on accepted `send`; connection-banner first-transition;
mismatched-file object-URL race; refresh-interceptor `sessionDead` flag.

**security (P2):** login rate limiter now counts only **failed** attempts + normalizes
the email key (`strip().lower()`) — a shared NAT isn't locked out by successful logins
(new test); non-host `/leave` force-closes the WS socket (`manager.close_user`) so a
departed user can't keep sending frames. Documented accepted MVP trade-offs in
`docs/SECURITY.md` (client-attested file hash, `Origin: None`, `trusted_hosts="*"`,
in-memory `jti`/ticket, token_version revocation as a follow-up).

## 2026-05-29 — Viewer playback control (any participant can play/pause/seek)

Implemented per the viewer-control plan, with a follow-up self-review.
Resolves `IDEAS.md` §1: playback is no longer host-only.

**Changed:**

- `backend/app/ws/handler.py` — dropped the `not_host` gate on `play/pause/seek`.
  Authorization is now active membership (the WS handshake already verifies it);
  the server stays authoritative and broadcasts `sync_state` to everyone. Decided
  against a `verified_users` gate (reconnect fragility + client-spoofable hash =
  no real boundary).
- `frontend/src/pages/RoomPage.tsx` — `canControl = Boolean(fileUrl)` (controls
  only render once you've loaded+verified a file); click-to-toggle gates on it.
- `frontend/src/components/room/{PlaybackControls,VideoArea}.tsx` — `isHost` →
  `canControl` for control affordances; neutral a11y/aria copy (no "host only").
- `frontend/src/hooks/useRoomWsHandler.ts` — handle `file_version_mismatch`
  (self-heals) + generic error-toast fallback so control rejections aren't silent.
- `frontend/src/components/room/PlaybackControls.test.tsx` — new (4 tests).

**Self-review:**

- **P1** `RoomPage.tsx` — the first pass placed `const canControl` *after* the
  `handleVideoClickToggle` callback that references it in its deps → temporal-dead-zone
  ReferenceError crashing the room on render (tsc/vitest missed it; no RoomPage
  render test). Moved the declaration above the playback callbacks.

**Review round 1 — code + security angles, in parallel:**

- **P1** (code) `handler.py` — a viewer could un-pause the room during the
  host-disconnect grace window: the `window` keydown handler lives behind the
  overlay and the control branch had no `"closing"` guard, so Space/arrows
  resumed playback for everyone and left `is_playing`/`room_status` inconsistent
  on host reconnect. Fix: server-side `if state.room_status == "closing": continue`
  (authoritative, covers every input path) + client `canControl &&= !hostDisconnected`.
- **P1** (security) `handler.py` — removing the host gate weaponized the known
  post-handshake membership gap: a user who left via REST `/leave` but keeps the
  socket open could drive everyone's playback. Fix: re-validate active membership
  (`RoomParticipant.left_at IS NULL`) inside the control branch.
- **P2** (security) `handler.py` — per-user rate buckets let an N-participant room
  amplify into N×(per-user) `sync_state` broadcasts. Fix: added a room-scoped
  control limiter (`ctrlroom:{room_id}`, 120/10s).
- **P2** (code) — added Space-key path tests to `PlaybackControls.test.tsx`.
- **P3** (security) `handler.py` — clamp control time to a non-negative lower bound.
- **P3** (code) — renamed `onNonHostControlAttempt` → `onBlockedControlAttempt`
  (the block is now "no file loaded", not "not host") across the 3 wiring sites + test.

Out of scope / backlog (follow-up): close non-host sockets on `/leave`
to fix the membership gap for chat/ready/verify too (not just control); a WS
integration test harness to cover the new guards end-to-end (TODO.md item).

**External review round 1 (independent) — P1=0, P2=3, P3=2, all applied:**

- **P2** `handler.py` — the room-wide limiter was consumed *before* the membership
  re-check, so a departed user could burn the shared budget and starve legit
  controllers. Reordered: room limiter runs LAST, only for messages that actually
  mutate/broadcast.
- **P2** `handler.py` — `file_version` was optional (only non-None mismatches
  rejected); a custom client could omit it. Now required (must be an `int` and match).
- **P2** `handler.py` — `current_time_ms` wasn't type/finite-checked and had no
  server-side upper bound. Now: reject non-numeric/non-finite, clamp to
  `[0, Room.file_duration]` (duration fetched in the same membership query).
- **P3** `handler.py` — a transient DB error in the new membership query would
  disconnect a legit controller (and trigger host-grace for the host). Wrapped in
  try/except → fail-closed for that one command, socket survives.
- **P3** `handler.py` + `ws.ts` + `useRoomWsHandler.ts` — `host_reconnected` now
  carries the restored `room_status` so a reconnect into a `waiting_ready` room
  isn't forced to `paused` on the client.

**External review round 2 — P1=0, P2=1, P3=1, all applied (edge cases from round 1's fixes):**

- **P2** `handler.py` — before a reference file is chosen `state.file_version == 0`,
  so the new "must match" check passed `0 == 0` and a client could flip a
  `waiting_file` room to "playing". Added an explicit `state.file_version <= 0` reject.
- **P3** `handler.py` — a host can persist a negative `file_duration` via the
  (unvalidated) `file_verify_request` path; the upper clamp then drove `time_ms`
  negative. Guarded with `room_duration_ms = max(0, …)`. (Root-cause file-metadata
  validation in `file_verify_request` left for the audit backlog — backend P3-5 /
  security P3-2.)

Gates after review round 2: backend pytest 61, frontend tsc + lint + vitest (29) green
(frontend unchanged this round; build last green at round 1).

## 2026-04-20 — Deep-review fixes

Third independent review (two parallel reviewers, no context from prior
rounds). Every P1/P2 finding addressed; half the P3s handled, the rest
documented in TODO.md.

### P1

- **Rate limiter collapsed all users into one bucket behind nginx.**
  Starlette's `request.client.host` returned the nginx container's IP for
  every request because the backend never read `X-Forwarded-For`. Fix: nginx
  now sets `X-Forwarded-For` / `X-Real-IP` / `X-Forwarded-Proto` on `/api/`
  and `/ws/`; backend wraps the ASGI app with `ProxyHeadersMiddleware`;
  uvicorn in Dockerfile + compose runs with `--proxy-headers
  --forwarded-allow-ips=*`. Added per-IP and per-email rate-limit tests that
  independently verify both axes using `X-Forwarded-For`.
- **`room.host` lazy-load would raise `MissingGreenlet` on Postgres.**
  `room_service.get_room` eager-loaded participants but not `host`; the
  RoomDetailResponse reads `room.host.username`. SQLite-based tests
  tolerated the implicit sync lazy load, asyncpg didn't. Fix:
  `selectinload(Room.host)` added to the query.

### P2

- **"Account is disabled" message revealed user existence.** Merged the
  disabled-account check into the same error path as wrong password so
  login returns the same `"Invalid email or password"` regardless.
- **Rate-limit memory was unbounded.** `RateLimiter._log` dict grew by
  attacker-controlled keys (random emails on /login). Added `max_keys` cap,
  a `reap()` method, and a registry (`ALL_LIMITERS`, `reap_all()`) ticked
  every 60 s alongside ticket/jti cleanup. Idle buckets drop out
  automatically.
- **`verified_users` wasn't invalidated through the REST `PUT /file-info`
  path** (and the endpoint wasn't actually used by the frontend). Removed
  the dead endpoint entirely; the WS `file_verify_request` flow remains
  the single code path that updates both DB file metadata and the in-memory
  verify gate.
- **Grace timer didn't stop on REST rejoin.** A user bouncing into
  `/auth/ws-ticket` before the WS handshake could still be timed out
  mid-flight and 403'd. Cancelling the grace timer now happens on ticket
  issue too (the WS connect path was the only prior cancellation point).
- **Host initiating `leaveRoom` / `deleteRoom` saw "The host left the
  room." flash themselves.** `close_room` got an optional `exclude_user`;
  both REST entry points now pass the caller's id.
- **`onFatalTicketError` was a stale closure.** Captured once by
  `useCallback(connect, [roomId])`, while `RoomPage` built a fresh
  callback inline each render. Moved to a ref following the same pattern
  already used for `onMessage`.
- **`file_verify_request` had no per-user rate limit.** A host could spam
  `file_changed` broadcasts at the global message cap. Added a dedicated
  5/10s limiter with an `error/rate_limited` reply.
- **Docker ports were exposed on `0.0.0.0`.** Postgres on :5432 (with a
  weak default password) and backend on :8000 were reachable from the LAN,
  and :8000 bypassed nginx's security headers. Both now bind to
  `127.0.0.1` only. Ingress is nginx on :3000.
- **`/health` leaked DB exception strings** (connection-string fragments,
  driver version). Now logs the exception server-side and returns
  `{"status": "error", "db": "unavailable"}`.
- **`/auth/refresh` burnt the jti before validating the user.** A
  transient DB hiccup would force re-login unnecessarily. Moved
  `mark_refresh_used` after the User load + `is_active` check.

### P3

- Replaced `window.history.replaceState({}, '')` with
  `navigate(pathname, { replace: true, state: null })` so react-router 7
  state tracking isn't clobbered.
- `PlaybackControls.volume` now persists to `localStorage` (`sw.volume`)
  so it actually stays "sticky" across room changes.
- Unhandled `Exception` in the WS handler loop is logged via
  `logger.exception` instead of silently swallowed.
- `ChatPanel` send-error auto-hide `setTimeout` is now stored in a ref and
  cleared on unmount.
- `test_rate_limit_on_login` split into two independent tests: one drives
  the per-IP bucket (rotates emails, same IP), the other drives the
  per-email bucket (same email, rotates X-Forwarded-For). Each fails
  cleanly if its own axis regresses.
- Removed dead `PUT /rooms/{id}/file-info` REST endpoint (plus the now-
  unused import) and noted the decision in a comment.

### Verification
- `pytest -q`: 61/61 (60 + one new per-IP rate-limit test).
- `npm run build` / `eslint .` / `vitest run` all green.
- `docker compose build` — both images rebuild cleanly.

### Carried forward (tracked in TODO.md)
- Refresh-jti blocklist is still in-memory (multi-worker / restart loss
  documented).
- WS handler is still ~625 lines; per-message split deferred.
- `WsMessage` still `[key: string]: any`; discriminated union deferred.
- CI still doesn't run `npm audit` / `pip-audit`.
- localStorage tokens remain (architectural — tracked as a top P1).

---

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
- PLAN.md v3: fixed all v2 review issues — reconnect protocol, participant_status, RoomState, global seq, room_code gen, nginx description.
- **Phase 1**: Backend (FastAPI + auth + JWT + ws-ticket + bcrypt + Alembic), Frontend (Vite + React + TS + Tailwind + auth pages), Docker Compose. Review pass: fixed 7 issues.
- **Phase 2**: Room + RoomParticipant models, CRUD with room_code gen (A-Z0-9), join/leave, max_participants. Review pass: fixed 7 issues.
- **Phase 3**: WebSocket + real-time chat. ConnectionManager with connection_id, seq, tab dedup. ChatMessage model + REST history (cursor pagination). Review pass: fixed 7 issues.
- **Phase 4**: File selection + verification. Partial SHA-256 hashing (head+middle+tail+size). FileSelector with states. Review pass: fixed 7 issues.
- **Phase 5**: Video player + sync. sync.py (canonical time, drift evaluation). play/pause/seek handlers (host-only). Per-room heartbeat (3s). Review pass: fixed 6 issues.
- **Phase 6**: Reconnect lifecycle. Host grace period (30s, CLOSING state, autopause). Participant grace period (60s). Review pass: fixed 7 issues.
- SECRET_KEY: crashes in production if default value used.
- Mobile responsive layout for all pages.
- .gitattributes: enforce LF line endings.
- Design mockups added (redesign variant, adapted to match plan).

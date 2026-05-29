Independent final code-review pass — SyncWatch "viewer playback control" feature.
You are the final independent reviewer (a different model from the one that wrote
this code). The change is uncommitted in the working tree on `master`. Be rigorous,
concrete, and skeptical.

## Working directory
C:\Users\Alex\Desktop\Proj zesp

## Stack
- Backend: Python 3.13, FastAPI, WebSocket, SQLAlchemy 2.0 async, PostgreSQL
  (asyncpg in prod, aiosqlite in tests). Single process; live room state in-memory
  in `app/ws/manager.py` (ConnectionManager / RoomState).
- Frontend: React 19 + TypeScript strict, Tailwind v4, Vite. Single quotes,
  semicolons, 2-space indent.

## What the change does
Playback control (play/pause/seek over WebSocket) used to be HOST-ONLY (server
rejected non-hosts with error `not_host`). Now ANY active participant can control
playback. The server stays authoritative and broadcasts `sync_state` to all.
Authorization is now: active membership at handshake + re-validated membership
inside the control branch + per-user AND per-room rate limits + `file_version`
match + a `"closing"` (host-grace) guard. Design rationale:
`reviews/viewer-control-plan.md`. Decisions log: top entry of `CHANGELOG.md`
(2026-05-29).

## See the diff
Run `git --no-pager diff` (and `--stat`). Files changed:
- `backend/app/ws/handler.py` — host gate removed; added room-scoped limiter,
  `"closing"` guard, per-message membership re-check, lower-bound time clamp.
- `frontend/src/pages/RoomPage.tsx` — `canControl = Boolean(fileUrl) && !hostDisconnected`;
  click-to-toggle gate; hint copy.
- `frontend/src/components/room/PlaybackControls.tsx` — `isHost`→`canControl`;
  neutral a11y copy; prop renamed `onBlockedControlAttempt`.
- `frontend/src/components/room/VideoArea.tsx` — threads `canControl`.
- `frontend/src/hooks/useRoomWsHandler.ts` — handle `file_version_mismatch` +
  generic error-toast fallback.
- `frontend/src/components/room/PlaybackControls.test.tsx` — new tests.

## Look hard at
1. The new control-branch guards in `handler.py`: ordering, correctness, and the
   per-message DB membership query — can a legit member be wrongly dropped, or a
   departed user slip through? What happens if that query raises?
2. The `"closing"` guard vs the host-reconnect path (`handler.py` ~L177-215):
   after a viewer's command is blocked during the grace window, is canonical state
   (`is_playing` / `room_status`) consistent when the host returns?
3. Multi-controller correctness in `useVideoSync.ts`: a sender receives its own
   `sync_state` echo — confirm no feedback loop and clean last-write-wins; two users
   seeking near-simultaneously.
4. `canControl` declaration ordering in `RoomPage.tsx` (a temporal-dead-zone bug
   was already found + fixed — confirm no residual TDZ; confirm the `!hostDisconnected`
   gating is correct).
5. Rate-limit values: per-user 60/10s + per-room 120/10s — any abuse window left.
6. The new `useRoomWsHandler` error branches — placement, no fallthrough, no
   double-toast.

## Out of scope (do NOT re-flag — known/documented, tracked separately)
- Client-asserted / spoofable file hash; tokens in localStorage; no email
  verification / 2FA.
- The broader post-handshake membership gap for chat/ready/verify (the control
  path is now re-validated; closing the socket on `/leave` is backlog).
- Whole-project audit findings (a separate audit wrote
  `reviews/{backend,frontend,security,a11y}-check.md`).

## Quality gates (should be green — re-run)
- Backend: `cd backend && PYTHONPATH=. .venv/Scripts/python -m pytest -q`  (expect 61 passed)
- Frontend: `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm run test:run`  (expect 29 passed)

## Output
Markdown. Sections P1 / P2 / P3. Each finding: `file:line` + one-sentence repro +
suggested fix. If P1=0 and P2=0 with only minor P3, end with "APPROVED FOR MERGE".
Under 1200 words.

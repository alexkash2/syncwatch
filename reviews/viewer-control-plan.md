# Implementation plan — democratize playback control (viewer control)

Status: **v2** (revised after plan review)
Owner: orchestrator (Opus)
Source idea: `IDEAS.md` §1 (tester's "viewer has no rights" report).

## Goal

Let **any participant** — not only the host — play / pause / seek the shared
timeline. The server stays the single source of truth ("last command wins");
the host keeps ownership of room lifecycle and reference-file selection.

This is the **functional** feature. Cosmetic button styling / marketing copy
("Viewer lane", onboarding wording) is explicitly left to the user.

## Design decision (REVISED in v2)

**Gate playback control on active membership, not on `verified_users`.**

A connected WebSocket already proves active membership (the handshake re-checks
`room_participants.left_at IS NULL`). So the server gate becomes simply: a valid
`RoomState` exists + per-user rate limit + `file_version` match. The host check
is removed; nothing replaces it.

### Why not the `verified_users` gate (rejected in v2)
1. **Reconnect fragility (plan-review P1-2):** the client's `fileUrl` survives a
   socket drop, but the server only repopulates `verified_users` on reconnect
   when the user *was ready* and grace hadn't expired. So `fileUrl`-set but
   `verified_users`-absent windows exist → control silently rejected.
2. **No real security gain:** file-hash verification is fully client-asserted and
   spoofable (project security audit), so `verified_users` is not a trust
   boundary anyway — only a UX signal.
3. **Simplicity / demo robustness:** with the membership gate, the non-host
   control path becomes **identical to the host path**, which already works
   (optimistic local `video.play()/pause()` + `send(...)` + authoritative
   `sync_state` echo reconciles everyone). Reusing a proven path = fewer demo bugs.

### Client-side UX gate
`canControl = Boolean(fileUrl)`. This is purely cosmetic: `PlaybackControls` and
the `<video>` element are only rendered when `fileUrl` is set (VideoArea's
`{fileUrl ? … : <FileSelector/>}`), so in practice `canControl` is true wherever
controls exist. It still cleanly gates the click-to-toggle / keyboard paths.

**Explicitly out of scope:** co-host delegation, per-user permission toggles,
playback locking, host handover.

## Server-authoritative model (unchanged)

Anyone sends `play`/`pause`/`seek` → server validates (state + rate limit +
`file_version`) → updates canonical `RoomState` → broadcasts `sync_state` to ALL
(incl. sender). Clients apply `sync_state` via the DOM and never re-emit
(`useVideoSync.handleSyncMessage`) → **no feedback loop** from the self-echo.
`sync_report`/`sync_check`/`sync_correction` are already host-agnostic (every
client reports while `state.is_playing`) → no change. Concurrent commands resolve
last-write-wins (acceptable per `IDEAS.md`).

## Backend changes

### `backend/app/ws/handler.py` — `("play","pause","seek")` branch (~L484–517)
- **Remove** the `if user_id != host_id:` → `not_host` block entirely.
- Keep the existing order: `_control_limiter.check(f"ctrl:{user_id}")` → fetch
  `state`; `if not state: continue` → `file_version` check → `apply_*` → broadcast
  `sync_state`. (This is the only playback-authorization point in the codebase —
  confirmed; nothing else gates play/pause/seek on host.)
- No new error code. No schema/protocol change.

## Frontend changes

### `frontend/src/pages/RoomPage.tsx`
- Compute `const canControl = Boolean(fileUrl)`; pass to `VideoArea`.
- `handleVideoClickToggle` (~L314): replace `if (room?.host_id !== user?.id)` →
  `if (!canControl)`. Keep the rest (optimistic local `video.play()/pause()` +
  `send` + `setRoomStatus`) — this now matches the host path exactly.
- `showInteractionHint` default arg (L281): change `'Only the host can control
  playback.'` → `'Load your file to control playback.'` (rarely shown now, but
  must not say "host").

### `frontend/src/components/room/PlaybackControls.tsx`
- Add prop `canControl: boolean` (replaces `isHost` for control gating).
- `togglePlay`, `skipBy`, `handleSeekEnd`: `if (!isHost)` → `if (!canControl)`.
- Buttons / seekbar: `enabled={canControl}`, `disabled={!canControl}`.
- sr-only note (L260-264) + Play/Pause aria-label/title (L298-299): drop the
  "Only the host can control" wording; describe the controls neutrally.

### `frontend/src/components/room/VideoArea.tsx`
- Thread `canControl`; `<VideoPlayer isInteractive={canControl} />` (cosmetic
  cursor only — the real click gate is in RoomPage) and pass `canControl` to
  `<PlaybackControls />`. Keep `isHost` for `showCompactOnboarding` + file stage.

### `frontend/src/hooks/useRoomWsHandler.ts` (plan-review P1-1)
- In the `error` switch (L254-273), add a branch for control-rejection codes so
  they aren't silently dropped: on `file_version_mismatch` → no destructive UI
  (self-heals via the next `sync_state`/`file_changed`); optionally a quiet toast.
  Keep a generic fallback toast for unknown error codes with a `message`.
  (`not_verified` no longer applies to control under the membership gate, but the
  generic fallback covers it for safety.)

### Copy left to the user (do NOT touch)
`RoomHeader` "Viewer lane / host controls" badge, `CreateRoomPage` "You control
playback for the whole room", `RoomOnboarding` "Follow playback".

## Tests

- **Frontend:** add `PlaybackControls.test.tsx` — `canControl=true` → clicking
  Play calls `onPlay`; `canControl=false` → click does not call `onPlay` (calls
  the blocked hint). Uses existing vitest + RTL.
- **Backend:** the change is a deletion of a gate; the underlying `apply_play/
  pause/seek` are already unit-tested (`test_sync.py`). A full WS-integration test
  (two clients, non-host drives, broadcast asserted) is the right coverage but is
  explicitly deferred in `TODO.md` (needs a WS harness). Document manual two-window
  verification instead; leave a TODO if a lightweight harness proves quick.

## Plan-review findings — resolutions

- **P1-1 (client ignores `not_verified`)** → resolved structurally: membership
  gate removes `not_verified` from the control path; plus we add error handling +
  generic fallback in `useRoomWsHandler`.
- **P1-2 (reconnect gate mismatch)** → resolved structurally: membership gate has
  no `verified_users` dependency, so `fileUrl` and the server gate can't diverge.
- **P1-3 / P2-1 / P2-2 (optimistic status, correction-vs-command races)** →
  the non-host path is now byte-for-byte the host path, which already ships these
  same optimistic updates and self-corrects within one `sync_check` (~3s). No new
  failure mode beyond what the host already has. Documented, not re-engineered.
- **P2-3 (`isInteractive` is cosmetic)** → acknowledged; real gate is RoomPage's
  `handleVideoClickToggle`, which we change. `isInteractive={canControl}` kept for
  the cursor.
- **P2-4 (stale "only host" copy)** → `showInteractionHint` default + PlaybackControls
  sr-only/aria strings are listed as explicit change points above.
- **P3-2 (leave-socket / membership-recheck gap)** → out of scope; recorded for the
  audit backlog + Codex prompt. Membership gate doesn't widen it beyond the
  pre-existing chat/ready/verify exposure (a `/leave` user's socket already had those).

## Files touched (scope ~5)

- `backend/app/ws/handler.py`
- `frontend/src/pages/RoomPage.tsx`
- `frontend/src/components/room/PlaybackControls.tsx`
- `frontend/src/components/room/VideoArea.tsx`
- `frontend/src/hooks/useRoomWsHandler.ts`
- `frontend/src/components/room/PlaybackControls.test.tsx` (new)

Independent final review pass — SyncWatch P1/P2 audit remediation.
You are the final independent reviewer (a different model than the one that wrote
these fixes). The work is on branch `audit/p1-p2-fixes`, stacked on
`feature/viewer-control`. Be rigorous, concrete, skeptical.

## Working directory
C:\Users\Alex\Desktop\Proj zesp

## Stack
- Backend: Python 3.13, FastAPI, WebSocket, SQLAlchemy 2.0 async, PostgreSQL
  (asyncpg; aiosqlite in tests). Single process; live state in `app/ws/manager.py`.
- Frontend: React 19 + TS strict, Tailwind v4, Vite. Single quotes, semicolons,
  2-space indent.

## What this branch does
Fixes the P1/P2 findings from the four audits in `reviews/{backend,frontend,
security,a11y}-check.md`. Decisions log: top entry of `CHANGELOG.md` (2026-05-30).
Accepted MVP trade-offs are documented in `docs/SECURITY.md`.

## See the diff (audit changes only, excludes the stacked feature)
Run: `git --no-pager diff feature/viewer-control..audit/p1-p2-fixes`
(and `--stat`). Read whole files where needed.

## Look hard at
1. **Login rate limiter (security)** — `core/rate_limit.py` new `peek()`/`record()`
   and `api/auth.py` login now counts only FAILED attempts (peek up front, record
   on `BadRequestError`). Any way a brute-force now slips the limit, or a legit
   user is still wrongly locked out? Email key normalization vs the lookup.
2. **`manager.close_user` + non-host `/leave`** (`ws/manager.py`, `api/rooms.py`) —
   force-closing a single socket. Races with the handler's `finally`/`disconnect`,
   double `user_left`, orphaned grace timers, room-empty teardown correctness.
3. **Reconnect re-sync** (`hooks/useVideoSync.ts`, `pages/RoomPage.tsx`) — snapshot
   stored BEFORE the video-null guard; `resyncToLastState()` on canplay. Does it
   ever resume a paused room, or apply a stale snapshot across a file change?
4. **backend WS fixes** (`ws/handler.py`) — reconnect `participant_ready` broadcast
   placement; `ready`/`not_ready` room-gone guards; atomic `file_verify` reading the
   returned Room post-session; file-metadata validation completeness.
5. **a11y** (`Field.tsx` cloneElement label/aria wiring; `AuthModal` focus-trap +
   persistent live region) — any broken input association, focus escape, or
   regressed test selector?
6. **`broadcast`/`send_to_user` early-return** — does bailing before `_next_seq`
   for empty rooms break any ordering/seq assumption?

## Out of scope (documented / deferred — do NOT re-flag)
- token_version revocation, `ProxyHeaders trusted_hosts="*"`, client-attested file
  hash, `Origin: None`, in-memory `jti`/ticket reset — all accepted in
  `docs/SECURITY.md` with rationale.
- The viewer-control feature itself (already reviewed in #7).
- P3s not addressed this sprint (listed in the audit reports).

## Quality gates (should be green — re-run)
- Backend: `cd backend && PYTHONPATH=. .venv/Scripts/python -m pytest -q`  (expect 62)
- Frontend: `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm run test:run`  (expect 29)

## Output
Markdown. P1 / P2 / P3 sections. Each finding: `file:line` + one-sentence repro +
suggested fix. If P1=0 and P2=0 with only minor P3 → "APPROVED FOR MERGE". Under 1200 words.

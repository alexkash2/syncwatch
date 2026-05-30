Independent review pass — SyncWatch P3 cleanup + carried audit fixes.
You are the final independent reviewer (a different model than the author). The
work is on branch `chore/p3-cleanup`, targeting `master`. Be rigorous and
skeptical.

## Working directory
C:\Users\Alex\Desktop\Proj zesp

## Stack
- Backend: Python 3.13, FastAPI, WebSocket, SQLAlchemy 2.0 async, PostgreSQL
  (asyncpg; aiosqlite in tests). Single process; live state in `app/ws/manager.py`.
- Frontend: React 19 + TS strict, Tailwind v4, Vite.

## What's in this branch (vs master)
Two things, because PR #10 merged early and missed the Codex round-1/2 fixes:
1. **Carried audit fixes** (already Codex-reviewed over two rounds, included here so
   they reach master): atomic login limiter (reserve via `check()` + `release()` on
   success), reconnect snapshot tagged with the room `file_version`, WS message-loop
   connection-revocation check, `RateLimiter` `max_keys` hard cap, transient-login
   slot release.
2. **New P3 cleanup**: remove unused `passlib` dep; prune `verified_users` in
   `close_user`; debug-log `ConnectionManager` send swallows; comment `apply_play`
   rate reset; a11y (skip-to-main link + `id=main`, sr-only room `<h1>`, `role=menu`);
   empty-username guard; explicit `seqForReconnect` in `useWebSocket`.

Decisions log: top of `CHANGELOG.md`.

## See the diff
`git --no-pager diff master..chore/p3-cleanup` (and `--stat`). Read whole files where needed.

## Look hard at (new this branch)
1. `core/rate_limit.py` + `api/auth.py` — the reserve/release login flow: any path
   where a slot leaks (never released) or is double-released; the email-bucket-429
   branch releasing the IP slot; transient-error release vs `BadRequestError` keep.
2. `core/rate_limit.py` `_ensure_capacity` — eviction-when-full correctness; does it
   ever loop forever or evict the key just inserted?
3. `ws/manager.py` — `verified_users.discard` placement in `close_user`; the new
   `logger.debug` swallows don't change control flow; `broadcast`/`send_to_user`
   early-returns still correct.
4. `ws/handler.py` — the top-of-loop connection-revocation check (`active[1] != connection_id`)
   doesn't break normal flow or skip legitimate frames.
5. `hooks/useVideoSync.ts` + `useRoomWsHandler.ts` — snapshot stored with the
   message's own `file_version`, compared only at apply time; the synthetic reconnect
   sync_state carries `file_version`.
6. `hooks/useWebSocket.ts` — `seqForReconnect` capture is behavior-neutral.
7. a11y additions — duplicate `id="main"` only across different routes (Layout vs
   RoomPage), skip link target valid.

## Out of scope (documented as deferred — do NOT re-flag)
python-jose→PyJWT, large-file hashing path, ErrorBoundary→Sentry, SECRET_KEY default,
client-attested file hash, Origin:None, in-memory jti/ticket, and the cosmetic P3s
listed as acknowledged in the audit reports / SECURITY.md.

## Quality gates (should be green — re-run)
- Backend: `cd backend && .venv/Scripts/python -m ruff check app tests && PYTHONPATH=. .venv/Scripts/python -m pytest -q`  (expect ruff clean, 74 passed)
- Frontend: `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm run test:run`  (expect 44)

## Output
Markdown. P1 / P2 / P3 sections. file:line + repro + fix. If P1=0 and P2=0 with only
minor P3 → "APPROVED FOR MERGE". Under 1000 words.

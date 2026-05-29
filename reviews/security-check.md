# SyncWatch — Security Review

**Overall posture:** Solid for a university MVP. The auth core is well thought out — single-use refresh rotation with a jti blocklist, timing-equalised login, case-insensitive enumeration hardening, one-time WS tickets, Origin checks, parameterised SQL throughout, a non-root Docker image, loopback-only port bindings, and a real CSP. No SQL injection, no XSS injection path, no `alg=none` bypass (decode pins `algorithms=[HS256]`). The notable gaps are not in the cryptography but in **WebSocket session lifecycle authorization**: membership and host identity are checked only at handshake and never re-validated for the lifetime of the socket. That becomes materially worse under the planned "everyone can control playback" change.

**Docs vs. reality:** `docs/SECURITY.md` is largely accurate, with three divergences worth noting. (1) It states refresh "only verifies signature and expiry … no rotation" (line 88–89) — this is **stale**; rotation + jti single-use replay detection *is* implemented in `auth_service.refresh_tokens` and `security.mark_refresh_used` (TODO.md line 14 has the correct, updated description). (2) It lists `PUT .../file-info` as a host-only route (line 26) — that route was **removed** (see `api/rooms.py:122`); file changes now flow through the WS `file_verify_request` handler. (3) The login rate-limit table (line 36) omits that the **email-keyed limiter shares the same bucket object** as the IP limiter, which slightly changes the real-world limits (see P2-3).

---

## P1 — Critical

### P1-1 — WS message loop never re-checks membership; a "left" non-host keeps full room control
`backend/app/ws/handler.py:256-552` (loop) vs `backend/app/api/rooms.py:86-102` (leave)

Membership and `host_id` are resolved **once** at handshake (`handler.py:120-163`). The message loop after that trusts the open socket forever. `POST /api/rooms/{id}/leave` for a **non-host** sets `left_at` in the DB and returns 200 **without closing that user's WebSocket** (`rooms.py:97` only tears down WS `if was_host`). The user's socket stays open, so they can keep sending `chat_send`, `ready`, `not_ready`, `file_verify_request`, `sync_report`, `playback_error` — none of which re-check `left_at`. `save_message` (`chat_service.py:11`) and the ready handlers happily write/broadcast for a user who is no longer a participant.

**Repro:** join room → open WS → `POST /{id}/leave` → continue sending `chat_send` frames on the still-open socket → messages persist and broadcast to the room.

**Democratization impact (in-scope note):** today `play`/`pause`/`seek` are gated by `user_id == host_id` (`handler.py:485`). Once that gate is relaxed to "any participant," this same stale-socket path lets a *departed* user drive everyone's playback — a clear broken-access-control hole. Do NOT relax the gate without fixing membership re-validation first.

**Fix:** Re-check active membership inside the loop for state-changing frames (cheap: cache + invalidate, or query per control/chat message), and on non-host `leave` push a close to that user's socket via `manager` (mirror the host path).

### P1-2 — File-hash verification is fully client-asserted; any participant can self-"verify" with a forged hash
`backend/app/ws/handler.py:291-408`, `frontend/src/utils/fileHash.ts:3-42`

The "are we watching the same file" gate is the SHA-256 of head+middle+tail+size computed **in the browser** and sent as a plain string in `file_verify_request`. The server compares the attacker-supplied `file_hash`/`file_size`/`file_duration_ms` against the stored reference (`handler.py:392-396`) and, on match, adds the user to `state.verified_users`, which is the *only* gate for `ready` (`handler.py:426`). A malicious client never opens a file at all — it just sends the room's reference hash (which it received in `room_state`/`file_changed`, `handler.py:239` / `:352-359`) and is marked verified+ready.

**Repro:** join room → read `file_info.file_hash` from `room_state` → send `file_verify_request` echoing that hash/size/duration → receive `match:true` → send `ready`. No actual media required.

**Impact:** the integrity guarantee SECURITY.md implies ("verify everyone is watching the same media") does not hold against a crafted client. For a watch-party this is mostly a correctness/trust issue, but it is a genuine spoofing surface and the "ready" gate is bypassable. Note also the **host** can set the reference to *any* hash with no server-side validation of the file's existence (`update_file_info`, `room_service.py:173`).

**Fix (realistic for scope):** Accept that this is client-attested and document it as a non-security trust signal **OR**, if it must be trusted, require participants to prove knowledge of file *content* the server can't trivially relay (e.g. a server-issued random byte-offset challenge answered with bytes from the local file). At minimum, validate `file_hash` shape server-side (hex, 64 chars) before storing — currently the WS path stores whatever string arrives (P3-2).

---

## P2 — High / Medium

### P2-1 — WS Origin check is trivially bypassed by non-browser clients
`backend/app/ws/handler.py:36-44`, `:89`

`_allowed_ws_origin` returns `True` when `origin is None`. Any non-browser client (python `websockets`, `curl`, a script) simply omits the `Origin` header and passes the check. The handshake still requires a valid one-time ticket, so this is not a standalone bypass, but the documented "defence in depth … cheap Origin enforcement" (SECURITY.md:61) provides **zero** protection against the only attacker who would bother (an automated client) — it only constrains real browsers, which CORS already constrains. CSRF-style WS hijacking from a victim's browser is what Origin defends, and that *is* covered; just don't overstate it.

**Fix:** Acceptable as-is for MVP; document that `None` Origin is permitted by design (non-browser clients), and rely on the ticket as the real auth. If you want strictness, reject `None` only when behind nginx (Origin is always set for browser WS).

### P2-2 — `ProxyHeadersMiddleware(trusted_hosts="*")` + `--forwarded-allow-ips=*` make rate-limit IPs spoofable if backend is ever reachable directly
`backend/app/main.py:77`, `docker-compose.yml:44`, `backend/Dockerfile:46`

With `trusted_hosts="*"`, `request.client.host` is taken from a client-supplied `X-Forwarded-For`. The rate limiter keys on this (`api/auth.py:32-39`), so anyone who can reach uvicorn directly can send `X-Forwarded-For: <random>` per request and **defeat all IP-based limits** (login/register brute force). The deployment mitigates this by binding `127.0.0.1:8000` only (compose:35) and routing through nginx, which overwrites XFF — correct today. But it is a single-config-change away from disaster (any future `0.0.0.0` exposure, a dev running uvicorn directly on a LAN, or a second ingress) and the comment in main.py acknowledges the assumption.

**Fix:** Set `trusted_hosts` / `--forwarded-allow-ips` to the actual proxy CIDR (e.g. the docker network gateway) instead of `*`, so a spoofed XFF from a non-proxy source is ignored. Defence-in-depth even behind nginx.

### P2-3 — Login email-bucket and IP-bucket share one `RateLimiter` instance, and the email key isn't normalized like the lookup
`backend/app/api/auth.py:65-68`, `backend/app/core/rate_limit.py:70`

Both `login_limiter.check(_client_key(request))` and `login_limiter.check(f"email:{...}")` call the **same** limiter object (10/60s). They are different *keys* so they don't literally collide, but SECURITY.md (line 35-36) presents these as two independent 10/60s limits when they are two keys in one limiter with one shared config. More importantly, the email key uses `body.email.lower()` while the lookup normalizes with `.strip().lower()` (`auth_service.py:63`) — submitting `" victim@x.com"` (leading space) or case/dot variants that resolve to the same account but produce a **different rate-limit key** lets an attacker get fresh buckets per spelling against the same target account.

**Fix:** Normalize the rate-limit email key identically to the auth lookup (`body.email.strip().lower()`), and consider distinct limiter instances if you want the documented independence.

### P2-4 — No revocation on logout/password-change; refresh rotation alone leaves a stolen access token live up to 30 min and a stolen refresh chain live until first replay
`backend/app/services/auth_service.py:83-112`, `backend/app/core/security.py:49-59`

Rotation detects *replay* of an already-used refresh token, which is good. But there is still no way to invalidate a session: `logout()` on the frontend only clears `localStorage` (`AuthContext.tsx:75`), the access token remains valid for its full 30-minute TTL, and a thief who *rotates* (rather than replays) the stolen refresh token gets an unbroken new chain indefinitely — the legitimate user's next refresh then fails (their token was burned), silently logging them out without alerting anyone. This is partially in TODO.md (line 14) but the *silent victim lockout / attacker-keeps-the-chain* asymmetry is not called out.

**Fix:** Implement the planned `token_version` on `users` embedded in the JWT; increment on logout/password change to kill all live tokens. (Documented as planned — flagging because the rotation design's failure mode favors the attacker.)

### P2-5 — In-memory jti blocklist and ws-ticket store reset on restart → refresh replay + ticket reuse window across restarts
`backend/app/core/security.py:10-16`, `:95-101`

`_used_refresh_jtis` and `_ws_tickets` are process-local dicts. On every backend restart/redeploy the replay-protection set is wiped: a refresh token that was already consumed before the restart can be replayed once after it (its jti is no longer "seen"). Likewise the single-use-ticket invariant only holds within one process lifetime. SECURITY.md frames single-use rotation as a hard guarantee; it is actually "hard within one process lifetime." Acceptable for a single-instance MVP but worth stating.

**Fix:** Document the restart caveat; for production move both stores to Redis with TTL (already in TODO.md scaling section).

---

## P3 — Low / Hardening

### P3-1 — `verified_users` set grows without pruning departed users
`backend/app/ws/manager.py:25`, `handler.py:342-401`

`RoomState.verified_users` is an unbounded `set` that only clears on file_version bump. A user spamming `file_verify_request` with the same valid hash re-adds themselves (bounded by `_verify_limiter`, 5/10s, so not a real DoS) but the set never prunes departed users. Minor memory hygiene.

**Fix:** Drop a user from `verified_users` on disconnect/leave.

### P3-2 — WS `file_verify_request` accepts an unvalidated `file_hash` string and persists it to the DB
`backend/app/ws/handler.py:299`, `room_service.update_file_info:191`

The REST `FileInfoRequest` schema enforced `min_length=64, max_length=128` hex shape (`schemas/room.py:47`), but that route is gone; the WS path does `data.get("file_hash", "")` with **no validation** and writes it straight into `rooms.file_hash` (String(128)). A host can store an arbitrary ≤128-char string (only bounded by the column). No injection (parameterised), but it defeats the documented "File hash: 64–128 hex chars" validation claim (SECURITY.md:57) for the only path that still sets it.

**Fix:** Validate `file_hash` (hex, length) and `file_size`/`file_duration_ms` (positive ints) in the handler before calling `update_file_info`; reuse the old `FileInfoRequest` model.

### P3-3 — Default `SECRET_KEY` only blocks startup when `ENVIRONMENT=production`; the docker-compose default ships `ENVIRONMENT=development`
`backend/app/config.py:27-36`, `docker-compose.yml:27-28`, `.env.example:6,13`

A `docker compose up` with no `.env` runs with `SECRET_KEY=change-me-in-production` and `ENVIRONMENT=development`, so the guard does not fire and JWTs are signed with a public, source-committed key — anyone can forge an access token for any `sub`. This is the intended dev default and the guard is correct, but the *failure mode* (deploying the compose file as-is, never setting ENVIRONMENT) yields full auth bypass. The weak default `DB_PASSWORD=syncwatch` has the same shape.

**Fix:** Consider defaulting `ENVIRONMENT` to `production` (fail-closed) so an unconfigured deploy refuses to start, or emit a loud startup warning when the default key is used in any environment (it currently only `warnings.warn`, easily missed in container logs).

### P3-4 — `/api/auth/me` returns email; keep it out of multi-user response schemas
`backend/app/api/auth.py:81-83`, `schemas/auth.py:31-36`

`UserResponse` includes `email`. `/me` returning your own email is fine. Participant/chat responses correctly use `ParticipantResponse`/`ChatMessageResponse` with only username (no email leak today). Flagging to keep it that way.

**Fix:** None needed now; never add `email` to any response that returns *other* users' data.

### P3-5 — `python-jose` is a soft-maintained library with historical algorithm-confusion CVEs
`backend/requirements.txt:8`

`python-jose[cryptography]>=3.3.0` has known advisories (algorithm-confusion / DoS classes). Usage here is safe (HS256 pinned, `algorithms=[...]` enforced), but the library is effectively unmaintained.

**Fix:** Consider migrating to `PyJWT` (actively maintained); low urgency given correct current usage.

### P3-6 — `passlib[bcrypt]` pinned but unused
`backend/requirements.txt:10`, `backend/app/core/security.py:19-24`

Code uses the `bcrypt` package directly (correct, cost 12 default matches `_DUMMY_BCRYPT_HASH`'s `$2b$12$`). `passlib[bcrypt]` is also in requirements but appears unused — extra dependency surface.

**Fix:** Remove `passlib[bcrypt]` if confirmed unused.

---

## Verified clean (no findings)
- **SQL injection:** none — all queries parameterised via SQLAlchemy; chat cursor parsing is try/except-guarded (`chat_service.py:33-47`).
- **XSS:** no React raw-HTML injection API is used anywhere, no `innerHTML`/`eval`; chat & usernames render as React text nodes (`ChatPanel.tsx:51`, `ParticipantList.tsx:68`); username charset is restricted at registration. CSP is strict (`object-src 'none'`, `frame-ancestors 'none'`, no `unsafe-inline` on `script-src`).
- **Open redirect / token-in-URL:** WS ticket (not JWT) is the only thing in a URL, and it's single-use/30s; no user-controlled redirect targets.
- **JWT alg confusion:** `decode_token` pins `algorithms=[settings.ALGORITHM]`; type claim checked.
- **CSRF:** tokens live in `localStorage` and are sent via the `Authorization` header (not cookies), so classic CSRF doesn't apply to current state-changing routes. NOTE: the planned localStorage→cookie migration (TODO.md) will *introduce* CSRF risk — the plan already notes adding CSRF protection then.
- **Docker:** non-root user, multi-stage build, host ports bound to loopback, no secrets committed (`.gitignore` excludes `.env`; only `.env.example` with placeholders is tracked).

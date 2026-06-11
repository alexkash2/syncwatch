# Security

Summary of what's defended against, how, and what remains open.

## Threat model (MVP scope)

SyncWatch is a multi-user realtime app with local-file playback. It's exposed to:
- Untrusted users (register/login is open).
- Untrusted browser content (XSS risk if any JS injection slips through React).
- Network attackers (standard TLS assumptions).
- Noisy clients / abuse (brute-force, spam, DoS at the app layer).

Out of scope for MVP: insider threats, nation-state TLS attacks, physical access to the server.

## What's implemented

### Authentication
- **bcrypt** password hashing (cost 12, via the `bcrypt` package).
- **JWT** access (30 min) + refresh (7 d) tokens, HS256 signed with `SECRET_KEY`.
- App refuses to start with the default `SECRET_KEY` if `ENVIRONMENT=production`.

### Authorization
- `get_current_user` dependency on every authed REST route.
- WebSocket auth via **one-time ticket** (`POST /api/auth/ws-ticket`) tied to `(user_id, room_id)`, 30 s TTL, single-use. Avoids putting JWTs in URL query strings (which end up in access logs).
- `ws-ticket` endpoint verifies the caller is an active participant of the room before issuing.
- Host-only actions (`DELETE /api/rooms/{id}`, setting or changing the reference file via `file_verify_request`) check `user_id == host_id`. Playback control (`play`/`pause`/`seek`) is open to every active participant, but each command re-validates membership and the current `file_version` server-side.

### Rate limiting
In-memory sliding-window limiter (`app/core/rate_limit.py`):

| Surface                   | Key            | Limit / window |
| ------------------------- | -------------- | -------------- |
| `POST /api/auth/register` | IP             | 5 / 60 s       |
| `POST /api/auth/login`    | IP             | 10 / 60 s      |
| `POST /api/auth/login`    | target email   | 10 / 60 s      |
| `POST /api/auth/refresh`  | IP             | 30 / 60 s      |
| `POST /api/auth/ws-ticket`| `user:{id}`    | 30 / 60 s      |
| WS messages (any)         | `msg:{user}`   | 200 / 10 s (dropped silently) |
| `chat_send`               | `chat:{user}`  | 20 / 10 s (replies `error/rate_limited`) |
| `play`/`pause`/`seek`     | `ctrl:{user}`  | 60 / 10 s (dropped silently) |

All REST limits return `429 Too Many Requests`.

### Timing-safe login
Unknown-user path still runs a dummy `bcrypt` compare so response time doesn't leak "user exists vs doesn't". See `_DUMMY_BCRYPT_HASH` in `auth_service.py`.

### User enumeration hardening
- `register` returns a generic `"Registration failed. Please try different credentials."` on conflict — doesn't say whether email or username was taken.
- `login` returns the same `"Invalid email or password"` for unknown user and wrong password.

### Input validation
- **Username**: `^[A-Za-z0-9_.\-]{3,30}$` — blocks whitespace, unicode lookalikes, control chars, emoji. Case-insensitive uniqueness (prevents `Admin` vs `admin` impersonation).
- **Email**: validated by pydantic's `EmailStr`, normalized to lowercase on storage.
- **Password**: 8–72 chars (72 = bcrypt input boundary).
- **Room code**: `^[A-Z0-9]{8}$`.
- **File hash**: 64–128 hex chars.
- **UUID path params**: `uuid.UUID()` parsing guarded with try/except → 401/4001 instead of 500.

### CORS and WebSocket Origin
- REST: `CORSMiddleware` restricts `allow_origins` to the configured list, with `allow_credentials=True`.
- WS: on handshake, `Origin` header is checked against the same list. Rejected with close code `4003 "Origin not allowed"`.

### HTTP security headers (nginx)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

### SQL injection
All DB access via SQLAlchemy's parameterised queries (no f-string SQL). Not audited for raw SQL because none exists.

### XSS
- React escapes all text nodes by default.
- No unsafe HTML-injection APIs are used anywhere in the codebase (verified by grep).
- Usernames enforced to safe character set at registration.
- Chat content stored as-is but rendered as text.

## Known limitations (tracked for later)

These are explicit trade-offs for MVP scope. Full notes and effort estimates are in [TODO.md](../TODO.md).

### localStorage tokens (XSS escalation risk)
`access_token` and `refresh_token` live in `localStorage`. Any XSS that sneaks in — e.g. through a compromised dependency — can steal both.

**Mitigation plan:** move tokens to `HttpOnly; Secure; SameSite=Strict` cookies and add CSRF protection (double-submit cookie or `X-CSRF-Token` header).

### Refresh token revocation
Refresh tokens **are** single-use with rotation + in-memory `jti` replay detection (`mark_refresh_used`). What's still missing: an explicit logout-with-revocation and bulk revocation (e.g. on password change). A *rotated* (not replayed) stolen token also yields an unbroken new chain while the legitimate user's next refresh fails — i.e. the failure mode currently favors the attacker.

**Mitigation plan:** add `token_version: int` to `users`, embed in JWT, increment on logout/password change; reject stale-version tokens. Optionally a Redis-backed `jti` blocklist for finer-grained revocation.

### No 2FA
Only email + password. No TOTP, no backup codes.

### No audit logging
Currently nothing logs security-relevant events (failed logins, rate-limit hits, origin rejections, host-takeover attempts, etc.). All `except Exception: pass` blocks swallow details.

**Mitigation plan:** structured logging (`structlog` or stdlib `JSONFormatter`) with a defined event schema — see [TODO.md](../TODO.md).

### Single-instance in-memory state
`ConnectionManager`, rate limiters, and ws-ticket store are all process-local. Running ≥2 backend instances requires Redis pub/sub + Redis-backed state.

### File identity is client-attested
The "everyone is watching the same file" check is a partial SHA-256 computed in the browser and sent over WS. A crafted client can echo the room's reference hash without owning the file and be marked verified/ready. For a friends-watch-party threat model this is an **accepted trade-off, not a trust boundary**. Server-side *shape* validation (hex, length, positive size, non-negative duration) is enforced before persisting.

### WebSocket session lifecycle (largely closed)
The WS loop authenticates at handshake. Playback-control frames now **re-validate active membership per message**, and a non-host who leaves via REST `/leave` has their socket force-closed (`manager.close_user`) — so a departed user can no longer drive chat / ready / playback. Residual: chat/ready membership is enforced via the closed socket rather than a per-frame DB check, which is acceptable at single-instance scope.

### Accepted for MVP scope
- **WS `Origin: None` allowed** — non-browser clients can omit `Origin`; the single-use, 30 s, room-bound ws-ticket is the real auth, so the Origin check is defense-in-depth against browser CSRF only.
- **`ProxyHeadersMiddleware(trusted_hosts="*")`** — safe today because the backend binds loopback-only behind nginx (which overwrites `X-Forwarded-For`). Tighten to the proxy CIDR if the backend is ever exposed directly. Left as-is deliberately: a wrong CIDR re-collapses the per-IP rate limiter into a single bucket.
- **In-memory `jti` blocklist + ws-ticket store** — reset on restart, so single-use guarantees hold within one process lifetime. Single-instance MVP; move to Redis for multi-instance.

### Other gaps
- No password reset flow (requires email infra).
- No email verification (anyone can register with any address).
- No account lockout (only rate limiting; login now counts **failed** attempts so a shared NAT isn't locked out by successful logins).
- No HTTPS enforced inside the stack — must be terminated by an outer proxy.

## Reporting

For a university project: file an issue in the repo. For anything production-ish: email the maintainer before public disclosure.

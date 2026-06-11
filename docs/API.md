# REST API reference

Base URL: `/api` (proxied from the frontend `nginx.conf`).

All responses are `application/json`. Authenticated endpoints expect `Authorization: Bearer <access_token>` unless noted.

FastAPI also publishes interactive docs at `/docs` (Swagger UI) and `/redoc`.

---

## Auth

### `POST /api/auth/register`

Create a new account.

**Request body**
```json
{
  "username": "alice",        // 3–30 chars, [A-Za-z0-9_.-]
  "email":    "a@example.com",
  "password": "password123"   // 8–72 chars (bcrypt boundary)
}
```

**Responses**
- `201 Created` — returns the new user (no password hash). Email is lower-cased on storage.
- `409 Conflict` — username or email already taken (generic message; does not reveal which).
- `422 Unprocessable Entity` — schema validation failed.
- `429 Too Many Requests` — rate limited (see [Rate limits](#rate-limits)).

---

### `POST /api/auth/login`

**Request**: `{ "email": "...", "password": "..." }`

**Responses**
- `200` — `{ access_token, refresh_token, token_type: "bearer" }`. Access token expires in 30 min, refresh in 7 days (configurable via env).
- `400` — `"Invalid email or password"` — same message for unknown user and wrong password. A dummy bcrypt compare is run for unknown users to equalise response time.
- `400` — `"Account is disabled"`.
- `429` — rate limited by IP or by target email.

---

### `POST /api/auth/refresh`

Swap a refresh token for a fresh token pair.

**Request**: `{ "refresh_token": "..." }`

**Responses**
- `200` — `{ access_token, refresh_token, token_type }`
- `400` — token invalid/expired or user no longer active.
- `429` — rate limited.

> Refresh tokens are **single-use**: a successful refresh marks the old token's `jti` as used (in-memory), and replaying it returns `400`. An explicit logout endpoint and bulk revocation are tracked in [TODO](../TODO.md).

---

### `GET /api/auth/me`

Current user profile.

- `200` — `{ id, username, email, is_active, created_at }`
- `401` — invalid/expired token, or UUID in `sub` malformed.

---

### `POST /api/auth/ws-ticket`

Issue a one-time ticket for opening a WebSocket to a specific room.

**Request**: `{ "room_id": "<uuid>" }`

**Responses**
- `200` — `{ "ticket": "<hex>" }`. Valid for 30 s, single-use.
- `403` — caller is not an active participant of the room.
- `404` — room not found or inactive.
- `429` — per-user rate limit.

---

## Rooms

### `POST /api/rooms/`

Create a room and join as host.

**Request**: `{ "name": "Movie Night" }` (1–100 chars)

**Responses**
- `201` — `{ id, name, room_code, host_id, is_active, max_participants: 10, file_version: 0, created_at }`. Code is 8 uppercase alphanumeric chars (A–Z0–9).
- `409` — failed to generate a unique code after retries (extremely rare).

---

### `GET /api/rooms/?page=1&size=20`

Active rooms the caller has participated in (as host or guest). Past membership counts — a participant whose session lapsed (left or timed out) still sees the room here and can rejoin by code.

**Responses**: `200` — `{ rooms: Room[], total: number }`. `size` capped at 100.

---

### `GET /api/rooms/{room_id}`

Full room details including participant list.

**Responses**
- `200` — `{ …Room, participants: [{ user_id, username, is_ready, joined_at }], host_username }`.
- `403` — caller not a participant.
- `404` — room not found or inactive.

---

### `POST /api/rooms/join`

Join a room by code.

**Request**: `{ "room_code": "ABCD1234" }` (must match `^[A-Z0-9]{8}$`)

**Responses**
- `200` — returns the Room. Idempotent: rejoining an already-joined room returns the same object.
- `400` — room is full (`max_participants` reached).
- `404` — code not found or room inactive.

---

### `POST /api/rooms/{room_id}/leave`

Leave the room. If the **host** leaves, the room is deactivated and all active WebSockets in it are closed with `room_closed { reason: "host_left" }`.

**Responses**
- `200` — `{ "ok": true }`
- `404` — caller was not an active participant.

---

### `DELETE /api/rooms/{room_id}`

Host-only. Deactivates the room and broadcasts `room_closed { reason: "deleted" }` to all WS clients.

**Responses**
- `200` — `{ "ok": true }`
- `403` — caller is not the host.
- `404` — room not found.

---

### `GET /api/rooms/{room_id}/messages?cursor=<c>&limit=50`

Chat history, newest-first, cursor-paginated. Limit capped at 100.

**Cursor format**: `"<iso-timestamp>:<message-uuid>"` — returned as `next_cursor` when more history exists.

**Responses**
- `200` — `{ messages: ChatMessage[], next_cursor: string | null }`. `messages` are returned oldest-first for direct append to UI.
- `403` — caller not a participant.
- `404` — room not found.

---

## Health

### `GET /health`

- `200` — `{ "status": "ok", "db": "ok" }` — used by Docker/compose healthchecks.
- `503` — DB unreachable; payload includes a truncated error.

---

## Rate limits

All numbers are sliding-window, per 60 s unless noted. In-memory (single backend instance).

| Endpoint                    | Key            | Limit      |
| --------------------------- | -------------- | ---------- |
| `POST /api/auth/register`   | client IP      | 5          |
| `POST /api/auth/login`      | client IP      | 10         |
| `POST /api/auth/login`      | target email   | 10         |
| `POST /api/auth/refresh`    | client IP      | 30         |
| `POST /api/auth/ws-ticket`  | `user:{id}`    | 30         |

WS message limits (per 10 s, per user):
- global cap: **200** messages of any kind (drops silently beyond)
- chat_send: **20** (replies with `error/rate_limited`)
- play/pause/seek: **60** (silently dropped beyond — avoids echo storms during scrubbing)

On rate-limit hit, REST returns `429 Too Many Requests` with `detail: "Too many requests. Please slow down."`.

---

## Error shape

All error responses follow FastAPI's default `{ "detail": "<message>" }` or `{ "detail": { … } }`. The frontend reads `error.response.data.detail` and surfaces it where appropriate.

# Architecture

SyncWatch is a single-instance web application for synchronized video playback. Users load local files on their own devices; the server only stores metadata and coordinates playback and chat in real time over WebSocket.

## High-level diagram

```
┌──────────────┐          ┌─────────────────────┐          ┌──────────────┐
│   Browser    │◄────────►│    nginx (SPA +     │◄────────►│   FastAPI    │
│ (React SPA)  │  HTTPS   │   reverse proxy)    │   HTTP   │ (uvicorn)    │
│              │  WSS     │                     │   WS     │              │
└──────────────┘          └─────────────────────┘          └──────┬───────┘
                                                                  │
                                                                  │ asyncpg
                                                                  ▼
                                                          ┌──────────────┐
                                                          │  PostgreSQL  │
                                                          └──────────────┘
```

- Browser serves the React SPA (Vite build) statically and proxies `/api` and `/ws` to the backend.
- Backend is a single uvicorn process — all in-memory state (rooms, WS connections, rate limiters, ws-tickets) lives in that process.
- Postgres is the only persistent store (users, rooms, participants, chat messages, migration state).

## Directory layout

```
syncwatch/
├── backend/
│   ├── alembic/                   database migrations
│   ├── app/
│   │   ├── main.py                FastAPI app, lifespan, /health
│   │   ├── config.py              pydantic-settings (env)
│   │   ├── database.py            async engine, get_db
│   │   ├── api/
│   │   │   ├── auth.py            REST: register/login/refresh/me/ws-ticket
│   │   │   ├── rooms.py           REST: rooms CRUD + chat history
│   │   │   └── router.py
│   │   ├── ws/
│   │   │   ├── handler.py         WebSocket endpoint, message dispatcher
│   │   │   ├── manager.py         ConnectionManager, RoomState, heartbeats
│   │   │   └── sync.py            canonical time, drift evaluation
│   │   ├── services/              business logic (auth, rooms, chat)
│   │   ├── models/                SQLAlchemy models
│   │   ├── schemas/               pydantic request/response schemas
│   │   └── core/
│   │       ├── security.py        JWT, bcrypt, ws-ticket store
│   │       ├── rate_limit.py      in-memory sliding-window limiter
│   │       ├── dependencies.py    FastAPI deps (get_current_user)
│   │       └── exceptions.py
│   ├── tests/                     pytest suite (unit + integration)
│   ├── Dockerfile                 multi-stage, non-root
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                routes, ErrorBoundary, AuthProvider
│   │   ├── pages/                 Login, Register, Home, Room, 404
│   │   ├── components/
│   │   │   ├── layout/            Header, Layout, ProtectedRoute, ErrorBoundary
│   │   │   └── room/              VideoPlayer, PlaybackControls, FileSelector, ChatPanel, ParticipantList
│   │   ├── hooks/                 useAuth, useWebSocket, useVideoSync
│   │   ├── contexts/              AuthContext
│   │   ├── api/                   axios client + REST wrappers
│   │   ├── utils/fileHash.ts      partial SHA-256
│   │   ├── types/                 shared TS types
│   │   └── test/                  Vitest setup
│   ├── Dockerfile                 build + nginx
│   ├── nginx.conf                 SPA + /api + /ws + security headers
│   └── vite.config.ts / vitest.config.ts
│
├── docker-compose.yml             postgres + backend + frontend
├── .env.example                   all environment variables documented
├── .github/workflows/ci.yml       lint + test + docker build
└── docs/                          this folder
```

## Database schema

See [alembic migrations](../backend/alembic/versions/). Current schema (after migration 005):

**users** — `id uuid PK`, `username`, `email` (both unique, case-insensitive enforced at service layer), `password_hash` (bcrypt), `is_active`, `created_at`, `updated_at`.

**rooms** — `id uuid PK`, `name`, `room_code` (8-char alphanumeric, unique), `host_id → users.id ON DELETE CASCADE`, `is_active`, `max_participants` (default 10), `file_hash`, `file_size`, `file_duration`, `file_name`, `file_version` (bumped on every file change), `created_at`.

**room_participants** — `id uuid PK`, `room_id → rooms.id ON DELETE CASCADE`, `user_id → users.id ON DELETE CASCADE`, `is_ready`, `joined_at`, `left_at`. Partial unique index `(room_id, user_id) WHERE left_at IS NULL` allows a user to leave and rejoin.

**chat_messages** — `id uuid PK`, `room_id → rooms.id ON DELETE CASCADE`, `user_id → users.id ON DELETE CASCADE`, `content text`, `created_at` (indexed for cursor pagination).

## Key design decisions

### Single-process, in-memory state

`ConnectionManager` holds every active WebSocket, room playback state, seq counter, heartbeat task, and grace-period timer. This is intentional: the MVP trades horizontal scalability for simplicity. Scaling to >1 backend instance requires moving this state to Redis (pub/sub + TTL keys).

### Local files, not uploads

Each participant plays a file from their own disk. The server never sees bytes. Identity is verified by a **partial SHA-256**: hash of `head(1MB) ‖ middle(1MB) ‖ tail(1MB) ‖ size`. This is fast (<100ms on any file) and rejects 99.9% of mismatches without uploading anything. See [utils/fileHash.ts](../frontend/src/utils/fileHash.ts) and the `file_verify_request` handler in [ws/handler.py](../backend/app/ws/handler.py).

### WebSocket authentication via one-time ticket

Browsers can't send `Authorization` headers on WS handshake. We avoid putting the JWT in the URL (leaks to server access logs) by issuing a short-lived one-time ticket via REST:

1. Client has a JWT → calls `POST /api/auth/ws-ticket { room_id }`.
2. Server verifies membership, creates a ticket tied to `(user_id, room_id)`, TTL 30s, stored in-memory.
3. Client opens `wss://…/ws/{room_id}?ticket=<ticket>`.
4. Server validates and consumes the ticket (one-time use), attaches identity.

The URL can still appear in logs, but the ticket is single-use and expires quickly, so replay is meaningless.

### Host-only playback control

`play`/`pause`/`seek` over WS are rejected for non-hosts with `error/not_host`. The server maintains authoritative playback state (`is_playing`, `current_time_ms`, `last_update_epoch`) and broadcasts `sync_state` to everyone on change. This avoids the N-way sync problem entirely.

### Canonical time & drift correction

The server computes the "true" playback position on demand:

```
canonical = current_time_ms + (monotonic_now - last_update_epoch) * 1000 * playback_rate
```

Every 3 s while playing, server broadcasts `sync_check` with canonical time. Clients reply `sync_report` with their actual position and buffer health. Server evaluates drift:

- `< 300 ms` → ignore (within tolerance).
- `300 ms – 2 s` → tell client to nudge `playback_rate` (±5 %) for ~5 s.
- `≥ 2 s` → hard `sync_correction { action: "seek", target_time_ms }`.
- Buffering or starved buffer (<500 ms) → skip correction, will self-heal.

See [ws/sync.py](../backend/app/ws/sync.py).

### Integer milliseconds everywhere

All times in the WS protocol are integer milliseconds. Avoids float rounding and accidental seconds/milliseconds confusion.

### One tab per user per room

Two tabs opening the same room from the same account: the new connection wins, the old one receives `error/tab_replaced` and navigates out. Enforced in `ConnectionManager.connect` via `connection_id` and a `tab_replaced` WS error.

### Grace periods on disconnect

When a host disconnects mid-playback:

1. `room_status` → `"closing"` (saving previous status), `autopause` applied.
2. All participants receive `host_disconnected { grace_period_ms: 30_000 }` and show a countdown overlay.
3. If the host reconnects within 30 s → `host_reconnected` is broadcast, playback resumes (as paused).
4. Otherwise `close_room("host_timeout")` fires — `room_closed` is broadcast, the room row is deactivated.

Participants get a 60 s grace instead. Their `is_ready` state is restored on reconnect if `file_version` still matches.

### Security layers

- **Auth:** bcrypt passwords, JWT access (30 m) + refresh (7 d) tokens.
- **Rate limiting:** in-memory sliding windows on login/register/refresh/ws-ticket; per-user caps on WS messages (chat/control/global).
- **Timing-attack protection:** login against unknown user still runs a dummy bcrypt compare.
- **CORS + WS Origin** both whitelisted against `CORS_ORIGINS`.
- **CSP + security headers** in nginx (`frame-ancestors 'none'`, `object-src 'none'`, `media-src 'self' blob:`, etc.).
- **UUID validation** on JWT `sub` and WS path params → 401/4001 instead of 500.

Full audit + known limitations: [SECURITY.md](SECURITY.md).

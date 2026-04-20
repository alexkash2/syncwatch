# Deployment

## Environment variables

All backend config comes from env. See [`.env.example`](../.env.example) for the full list. Copy it to `.env` before running `docker compose`:

```bash
cp .env.example .env
```

| Variable                      | Required | Default                  | Notes                                                                 |
| ----------------------------- | :------: | ------------------------ | --------------------------------------------------------------------- |
| `SECRET_KEY`                  |    ✓     | `change-me-in-production`| App **refuses to start** if `ENVIRONMENT=production` and default value. Generate via `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `DB_PASSWORD`                 |    ✓     | `syncwatch`              | Postgres password (dev-friendly default).                              |
| `ENVIRONMENT`                 |          | `development`            | Set to `production` to enforce the SECRET_KEY check.                  |
| `CORS_ORIGINS`                |          | `http://localhost:3000,http://localhost` | Comma-separated allow-list, used both for REST CORS and WS Origin check. |
| `DATABASE_URL`                |          | (docker-compose sets it) | `postgresql+asyncpg://user:pass@host:5432/db`.                        |
| `ACCESS_TOKEN_EXPIRE_MINUTES` |          | `30`                     |                                                                       |
| `REFRESH_TOKEN_EXPIRE_DAYS`   |          | `7`                      |                                                                       |
| `WS_TICKET_EXPIRE_SECONDS`    |          | `30`                     |                                                                       |

## Docker Compose

```bash
cp .env.example .env
# edit .env — at minimum set SECRET_KEY and ENVIRONMENT=production
docker compose up --build
```

Services:

- **postgres** — `postgres:16-alpine`, volume `pgdata`, healthcheck `pg_isready`.
- **backend** — multi-stage Python 3.13 image running as non-root `syncwatch` UID 1000. Runs `alembic upgrade head` on start, then uvicorn. Healthcheck hits `/health`. `stop_grace_period: 15s` lets in-flight WebSockets close cleanly.
- **frontend** — Vite build served by nginx. `depends_on.backend.condition: service_healthy` so it only starts after backend is actually reachable.

Ports exposed:
- `5432` — Postgres (expose only if you need host access).
- `8000` — backend. Remove this mapping in production; only nginx needs to reach it.
- `3000 → 80` — nginx/frontend.

Production checklist:
- Set `SECRET_KEY` and `ENVIRONMENT=production`.
- Narrow `CORS_ORIGINS` to your real domains.
- Put a TLS terminator (Caddy / nginx / cloudflare) in front of `frontend` — cookies/tokens are only safe over HTTPS.
- Remove the public `8000` mapping so only the frontend service can reach the backend.
- Consider moving Postgres to a managed service (compose uses a named volume; back it up if you rely on it).

## Local development (without Docker)

```bash
# 1) Postgres
docker run -d --name syncwatch-pg \
  -e POSTGRES_USER=syncwatch -e POSTGRES_PASSWORD=syncwatch -e POSTGRES_DB=syncwatch \
  -p 5432:5432 postgres:16-alpine

# 2) Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3) Frontend (another terminal)
cd frontend
npm install
npm run dev    # http://localhost:3000, proxies /api and /ws to :8000
```

## Migrations

Alembic is configured for async engine (`alembic/env.py`).

```bash
cd backend
PYTHONPATH=. alembic upgrade head            # apply all
PYTHONPATH=. alembic downgrade -1            # roll back one
PYTHONPATH=. alembic revision -m "msg"       # new revision
```

Current migrations (in order): 001 users · 002 rooms & participants · 003 partial index + `file_size` to BigInt · 004 chat_messages · 005 FK cascades.

## Health & readiness

- `GET /health` — simple DB ping, returns `200 { status: "ok", db: "ok" }` or `503 { status: "error", db: <msg> }`. Used by Docker healthcheck (both `Dockerfile.HEALTHCHECK` and `docker-compose.yml`).
- Postgres has its own `pg_isready` healthcheck; backend only starts after Postgres is healthy.
- Frontend only starts after backend is healthy (`service_healthy`).

## Graceful shutdown

On `SIGTERM` (uvicorn's default handler), the app's lifespan runs:

1. Ticket cleanup task cancelled.
2. For every active room, `manager.close_room(room_id, "server_shutdown")` is called — broadcasts `room_closed { reason: "server_shutdown" }` to every connected client, then closes the WS with code `4000`.
3. SQLAlchemy engine disposed.

Compose gives the container 15 s to finish this (`stop_grace_period: 15s`) before force-killing.

## Reverse proxy notes

`frontend/nginx.conf` already sets:
- `proxy_read_timeout 3600s` on `/ws/` — without this the nginx default of 60 s would kill paused watch parties.
- WebSocket upgrade headers.
- Security response headers (CSP, X-Frame-Options: DENY, Permissions-Policy, Referrer-Policy, X-Content-Type-Options).

If you add another layer of reverse proxy (Caddy/cloudflare), verify those headers survive it — otherwise the browser-level defences disappear.

## CI

`.github/workflows/ci.yml` runs on push/PR:

1. `backend` — `pytest -q` (unit + integration with in-memory SQLite).
2. `frontend` — `tsc --noEmit`, `eslint .`, `vitest run`.
3. `docker` — `docker compose build` to catch image-build regressions.

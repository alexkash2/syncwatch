# SyncWatch

Web app for synchronised video playback. Users create rooms and watch the same movie together — each plays a file from their own device, the server coordinates playback and chat in real time over WebSocket. Nothing is uploaded.

## Stack

- **Backend**: Python 3.13, FastAPI, WebSocket, SQLAlchemy 2.0 (async), Alembic, PostgreSQL 16.
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite.
- **Deployment**: Docker Compose (postgres + backend + nginx-served SPA), multi-stage non-root backend image.

## Quick start

```bash
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY (generate with:
#   python -c "import secrets; print(secrets.token_hex(32))")
docker compose up --build
```

Open http://localhost:3000.

For running without Docker, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What it does

- **Local-file playback** — each participant plays a file from their disk. Identity verified via partial SHA-256 (`head ‖ middle ‖ tail ‖ size`) — no uploads.
- **Shared playback control** — any participant can play/pause/seek; state is server-authoritative and broadcast as `sync_state`. Only the host can **close** the room.
- **Drift correction** — server sends `sync_check` every 3 s while playing, clients report position + buffer health, server decides between "ignore / nudge rate / hard seek".
- **Text chat** — persisted, cursor-paginated history, rate-limited.
- **Reconnect with grace periods** — host 30 s, participant 60 s. Host dropping autopauses for everyone; reconnect resumes.
- **Tab dedup** — one active tab per user per room; opening a second tab kicks the first with a clear message.
- **Bilingual UI** — English / Polish, switchable in-app (persisted to `localStorage`). Light, minimal design with an emerald accent; separate desktop and mobile layouts.

## Player controls

- **Play/Pause** — click button, click video area, or press `Space` (available to every participant)
- **Seek ±5 s** — `←` / `→` arrow keys, or the −5s / +5s buttons
- **Fullscreen** — `F` key or the ⛶ button. Device-aware: real Fullscreen API on desktop / Android / iPad / macOS, CSS pseudo-fullscreen on iPhone (where the Fullscreen API isn't available on a `<div>`).
- **Volume** — slider, independent per user

## Repo layout

```
syncwatch/
├── backend/          FastAPI + WebSocket (see docs/ARCHITECTURE.md)
├── frontend/         React SPA
├── docs/             documentation (start here)
├── docker-compose.yml
├── .env.example
├── .github/workflows/ci.yml
├── CHANGELOG.md
└── TODO.md           outstanding work + known limitations
```

## Documentation

| Doc                                               | What it covers                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)      | System diagram, directory layout, DB schema, design decisions.      |
| [docs/API.md](docs/API.md)                        | REST endpoints, rate limits, error shapes.                          |
| [docs/WS_PROTOCOL.md](docs/WS_PROTOCOL.md)        | WebSocket message types (client ↔ server), error codes, close codes. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)          | Docker, env vars, migrations, graceful shutdown, production notes.  |
| [docs/SECURITY.md](docs/SECURITY.md)              | What's defended, how. Threat model and known gaps.                  |
| [docs/TESTING.md](docs/TESTING.md)                | Test layout, how to run, manual E2E smoke list.                     |
| [TODO.md](TODO.md)                                | Everything that's deliberately left for later.                      |
| [CHANGELOG.md](CHANGELOG.md)                      | History of notable changes.                                         |

FastAPI also serves interactive API docs at `/docs` (Swagger UI) and `/redoc`.

## Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api` and `/ws` to `http://localhost:8000`.

## Tests

```bash
cd backend && PYTHONPATH=. pytest -q           # 59 tests
cd frontend && npx tsc --noEmit && npm run test:run
```

CI runs all of the above plus `docker compose build` on every push / PR. See [docs/TESTING.md](docs/TESTING.md).

## License

University project; no license specified yet.

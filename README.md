# SyncWatch

Web application for synchronized video playback. Users create rooms and watch the same video together — each plays a local file from their own device, with playback synced in real-time via WebSocket.

## Stack

- **Backend**: Python, FastAPI, WebSocket, SQLAlchemy 2.0 (async), PostgreSQL
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Deployment**: Docker Compose

## Concept

- No file uploads — each user plays a local video file
- Files are verified to be identical via partial SHA-256 hash (head + middle + tail + size)
- Host controls playback (play/pause/seek), synced to all participants via WebSocket
- Text chat inside rooms (persisted, cursor-paginated history)
- Independent volume per user
- Reconnect with grace periods (host 30s, participant 60s)

## How to Run

### Development (local)

```bash
# Start PostgreSQL
docker run -d --name syncwatch-pg \
  -e POSTGRES_USER=syncwatch -e POSTGRES_PASSWORD=syncwatch -e POSTGRES_DB=syncwatch \
  -p 5432:5432 postgres:16-alpine

# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Docker Compose (production)

```bash
cp .env.example .env
# Edit .env — set a real SECRET_KEY!
docker compose up --build
```

Open http://localhost:3000

## Project Structure

```
backend/          FastAPI + WebSocket server
  app/
    api/          REST endpoints (auth, rooms, chat)
    ws/           WebSocket handler, ConnectionManager, sync algorithm
    models/       SQLAlchemy models (User, Room, RoomParticipant, ChatMessage)
    services/     Business logic (auth, rooms, chat)
    core/         Security (JWT, bcrypt, ws-ticket), dependencies
  alembic/        Database migrations
  tests/          Unit tests (51 passing)

frontend/         React SPA
  src/
    pages/        Login, Register, Home, Room, 404
    components/   VideoPlayer, PlaybackControls, FileSelector, ChatPanel, ParticipantList
    hooks/        useAuth, useWebSocket, useVideoSync, useFileHash
    contexts/     AuthContext
    api/          Axios client with JWT interceptor
    utils/        File hashing (partial SHA-256)
```

## Implementation Status

- [x] Phase 1: Auth (register, login, JWT, ws-ticket)
- [x] Phase 2: Rooms (create, join, leave, list)
- [x] Phase 3: WebSocket + real-time chat
- [x] Phase 4: File selection + verification
- [x] Phase 5: Video player + playback sync
- [x] Phase 6: Reconnect + grace periods
- [ ] Phase 7: Polish + Docker finalization

See [PLAN.md](PLAN.md) for the full implementation plan.

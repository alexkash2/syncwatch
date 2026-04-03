# SyncWatch

Web application for synchronized video playback. Users create rooms and watch the same video together — each plays a local file from their own device, with playback synced in real-time via WebSocket.

## Stack

- **Backend**: Python, FastAPI, WebSocket, SQLAlchemy, PostgreSQL
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Deployment**: Docker Compose

## Concept

- No file uploads — each user plays a local video file
- Files are verified to be identical via partial SHA-256 hash (head + middle + tail)
- Host controls playback (play/pause/seek), synced to all participants
- Text chat inside rooms
- Independent volume per user

## Status

Project is in planning phase. See [PLAN.md](PLAN.md) for the full implementation plan.

# Changelog

## 2026-04-03
- Project initialized. Created implementation plan (PLAN.md), README, project description for university (SyncWatch_opis_projektu.docx).
- PLAN.md v2: added architecture constraints (single worker, single tab, integer ms, ws-ticket auth), state machines for room and participant, reconnect policy with grace periods, WS envelope with seq/file_version ordering, new events (not_ready, file_changed, room_closed, host_disconnected, playback_error), file_version tracking, autoplay/codec error handling, auto-test plan. Created design-prompt.txt for Stitch.
- PLAN.md v3: fixed all Codex v2 review issues — added reconnect to WS protocol table, participant_status event, RoomState with room_status, global seq ordering, correct room_code generation, reconnect bypass for max_participants, CLOSING state restore logic, REST→reason mapping, nginx proxy description.
- Phase 1 implemented: Backend (FastAPI + auth endpoints + JWT + ws-ticket + bcrypt + Alembic + 8 passing tests), Frontend (Vite + React + TS + Tailwind v4 + AuthContext + Login/Register/Home/404 pages + ProtectedRoute + axios JWT interceptor), Docker Compose (postgres + backend + frontend + nginx).

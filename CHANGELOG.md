# Changelog

## 2026-04-03
- Project initialized. Created implementation plan (PLAN.md), README, project description for university (SyncWatch_opis_projektu.docx).
- PLAN.md v2: architecture constraints, state machines, reconnect policy, WS envelope, new events.
- PLAN.md v3: fixed all Codex v2 review issues — reconnect protocol, participant_status, RoomState, global seq, room_code gen, nginx description.
- **Phase 1**: Backend (FastAPI + auth + JWT + ws-ticket + bcrypt + Alembic), Frontend (Vite + React + TS + Tailwind + auth pages), Docker Compose. Codex review: fixed 7 issues (email-validator, migration, SECRET_KEY warning, IntegrityError, UUID cast, ws-ticket cleanup, expiry test).
- **Phase 2**: Room + RoomParticipant models, CRUD with room_code gen (A-Z0-9), join/leave, max_participants. Codex review: fixed 7 issues (response construction, partial unique index, atomic max_participants, auth check, stricter validation, file_size BigInteger).
- **Phase 3**: WebSocket + real-time chat. ConnectionManager with connection_id, seq, tab dedup. ChatMessage model + REST history (cursor pagination). Codex review: fixed 7 issues (ws-ticket membership check, tab race via connection_id, host leave closes room, reconnect guard, chat history load, send feedback).
- **Phase 4**: File selection + verification. Partial SHA-256 hashing (head+middle+tail+size). FileSelector with states. WS file_verify/ready/not_ready/file_changed. Codex review: fixed 7 issues (file_version tracking, nonce-based verify, host file change, canplay before ready, broadcast ready reset, small file hash fix).
- **Phase 5**: Video player + sync. sync.py (canonical time, drift evaluation). play/pause/seek handlers (host-only). Per-room heartbeat (3s). PlaybackControls + useVideoSync. Codex review: fixed 6 issues (server-authoritative correction, late join canonical time, file_version on commands, codec detection, per-room heartbeat, event-driven controls).
- **Phase 6**: Reconnect lifecycle. Host grace period (30s, CLOSING state, autopause). Participant grace period (60s). reconnect WS message. host_disconnected/reconnected UI with countdown. Codex review: fixed 7 issues (preserve state during grace, pause order, broadcast sync_state, reconnect handler, ready restore, global seq, frontend leaks).
- SECRET_KEY: crashes in production if default value used.
- Mobile responsive layout for all pages.
- .gitattributes: enforce LF line endings.
- Design assets from Stitch (redesign variant, adapted to match plan).

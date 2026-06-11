# WebSocket protocol

Endpoint: `wss://<host>/ws/{room_id}?ticket=<ws-ticket>`

The ticket is obtained from `POST /api/auth/ws-ticket` (see [API.md](API.md#post-apiauthws-ticket)). It's consumed on handshake and only valid 30 s.

All frames are JSON. Times are **integer milliseconds**. Every server → client message carries envelope fields `seq` (monotonically increasing per room) and `server_time` (unix ms).

## Handshake

1. Client opens WebSocket with `?ticket=…`.
2. Server validates in this order (closes with given code on failure):
   - `4003 "Origin not allowed"` — `Origin` header not in `CORS_ORIGINS`.
   - `4001 "Invalid room id"` — path param isn't a UUID.
   - `4001 "Missing ticket"` / `"Invalid or expired ticket"`.
   - `4003 "Ticket room mismatch"` — ticket doesn't belong to this room.
3. Server accepts the WS, dedupes tabs: if the user already has a connection, the **old** one receives `error/tab_replaced` and is closed with `4002`.
4. Server immediately sends `room_state`. Then everyone else receives `user_joined`.

## Server → client messages

All include `type`, `seq`, `server_time`.

### `room_state`
Sent once on connect, and on reconnect if state changed.
```json
{
  "type": "room_state",
  "participants": [{ "user_id", "username", "is_ready" }],
  "playback_state": { "is_playing", "current_time_ms", "playback_rate" },
  "file_info": { "file_hash", "file_size", "file_duration_ms", "file_name", "file_version" },
  "file_version": 3,
  "room_status": "waiting_file" | "waiting_ready" | "playing" | "paused" | "closing"
}
```

### `user_joined` / `user_left`
```json
{ "type": "user_joined", "user_id", "username", "connection_id" }
{ "type": "user_left", "user_id", "username", "reason": "disconnect" }
```

`reason` is `"disconnect"` (socket dropped / grace period expired) or `"left"` (user left via REST `POST /rooms/{id}/leave`; this variant omits `username` — clients key off `user_id`).

### `chat_message`
```json
{ "type": "chat_message", "id", "user_id", "username", "content", "created_at" }
```

### `file_verify_response`
Reply to a client's `file_verify_request`.
```json
{ "type": "file_verify_response", "match": true|false, "reason"?, "file_version"? }
```
`reason` is filled when `match=false`. Two semantic cases for non-matches:
- Host hasn't set a file yet → `reason: "Host has not selected a file yet."` (the UI treats this as *waiting*, not *mismatch*).
- Hash/size/duration differ → `reason: "File does not match the host's file."`.

### `file_changed`
Broadcast to non-hosts when the host picks a new file. Resets every participant's `is_ready` to `false` and forces re-verify.
```json
{
  "type": "file_changed",
  "file_hash", "file_size", "file_duration_ms", "file_name",
  "file_version": 4
}
```

### `participant_ready`
`is_ready` state changed for a participant.
```json
{ "type": "participant_ready", "user_id", "is_ready", "file_version"? }
```

### `participant_status`
Soft status reported by a client (currently only `status: "error"` with a `detail` like `autoplay_blocked` / `codec_unsupported`).
```json
{ "type": "participant_status", "user_id", "status", "detail" }
```

### Playback sync messages
All carry `file_version`. Clients drop sync messages whose `file_version` doesn't match theirs.

**`sync_state`** — authoritative snapshot after `play`/`pause`/`seek`:
```json
{ "type": "sync_state", "is_playing", "current_time_ms", "file_version" }
```

**`sync_check`** — heartbeat, sent every 3 s while `is_playing`:
```json
{ "type": "sync_check", "current_time_ms", "is_playing": true }
```

**`sync_correction`** — hard seek when drift ≥ 2 s:
```json
{ "type": "sync_correction", "action": "seek", "target_time_ms" }
```

**`playback_rate`** — soft nudge when drift is 300–2000 ms. Client applies rate for 5 s, then resets to `1.0`.
```json
{ "type": "playback_rate", "rate": 1.05 | 0.95 }
```

### Host lifecycle
```json
{ "type": "host_disconnected", "grace_period_ms": 30000 }
{ "type": "host_reconnected" }
```

### Room closure
```json
{ "type": "room_closed", "reason": "host_left" | "host_timeout" | "deleted" | "server_shutdown" }
```
Clients navigate to `/` with a human-readable flash.

### Keepalive
```json
{ "type": "ping" }
```
Sent every 30 s while paused so reverse proxies don't drop the idle socket. Clients ignore it.

### Errors
```json
{ "type": "error", "code": "<code>", "message": "<text>" }
```

Known codes:

| Code                      | Meaning                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `tab_replaced`            | Another tab opened this room from the same account.             |
| `not_host`                | Non-host tried a `play`/`pause`/`seek`.                         |
| `file_version_mismatch`   | Client action carried a stale `file_version`.                   |
| `rate_limited`            | Chat rate limit hit.                                            |
| `room_gone`               | Room was deleted between handshake and this message.            |

## Client → server messages

Client envelope: just `{ "type": "...", ...fields }`.

### `chat_send`
```json
{ "type": "chat_send", "content": "hello" }
```
- Trimmed server-side; ≤ 2000 chars; empty messages dropped.
- Rate-limited at 20/10 s per user.
- Persisted to `chat_messages`, then broadcast as `chat_message`.

### `file_verify_request`
```json
{
  "type": "file_verify_request",
  "file_hash", "file_size", "file_duration_ms", "file_name"
}
```
Behaviour:
- **Host, no reference yet** OR **host, new file**: the reference is set (or updated), `file_version` bumped, everyone's `is_ready` reset. Host gets `file_verify_response { match: true, file_version }`; others get `file_changed` + `participant_ready { is_ready: false }`.
- **Host, same file**: `match: true` with the current `file_version`.
- **Non-host, no reference**: `match: false, reason: "Host has not selected a file yet."`.
- **Non-host, reference set**: compare `hash`, `size`, and `abs(duration_ms - ref) ≤ 1000`. `match` + `reason` returned.

### `ready` / `not_ready`
```json
{ "type": "ready", "file_version": 3 }
{ "type": "not_ready" }
```
- `ready` is sent on `canplay` of the `<video>` element, once verification succeeded.
- Server validates `file_version` matches the current one (returns `error/file_version_mismatch` otherwise), persists `is_ready`, broadcasts `participant_ready`, and **replies to the same user with `sync_state`** so late joiners jump to the canonical position instead of starting at 0 s.

### `play` / `pause` / `seek` (host only)
```json
{ "type": "play",  "current_time_ms": 12345, "file_version": 3 }
{ "type": "pause", "current_time_ms": 12345, "file_version": 3 }
{ "type": "seek",  "current_time_ms": 67000, "file_version": 3 }
```
Non-hosts get `error/not_host`. Stale `file_version` → `error/file_version_mismatch`. Rate limit 60/10 s per user; excess is dropped silently.

On success the server updates its authoritative `RoomState` and broadcasts `sync_state` to everyone.

### `sync_report`
Response to `sync_check`:
```json
{
  "type": "sync_report",
  "current_time_ms": 12345,
  "is_playing": true,
  "buffer_health_ms": 5000,
  "playback_status": "playing" | "paused" | "buffering" | "error" | "waiting_interaction"
}
```
Server evaluates drift (see [ARCHITECTURE.md](ARCHITECTURE.md#canonical-time--drift-correction)) and may reply with `sync_correction` or `playback_rate` **only to this user**.

### `reconnect`
Sent immediately after the WS opens, if this is a reconnect (not the first connect):
```json
{ "type": "reconnect", "last_seq": 42, "file_version": 3 }
```
`room_state` was already sent on connect, so this is mostly informational — the server re-sends `sync_state` if the client's `file_version` is out of date.

### `playback_error`
Informational. Client reports a local failure so the server can broadcast `participant_status`.
```json
{ "type": "playback_error", "error_code": "autoplay_blocked" | "codec_unsupported" | ... }
```

## Close codes

| Code | Meaning                                                                 |
| ---- | ----------------------------------------------------------------------- |
| 4000 | Room was closed (`room_closed` emitted first).                          |
| 4001 | Handshake rejected — bad ticket or bad room id.                         |
| 4002 | Tab dedup — your older tab was replaced.                                |
| 4003 | Origin not allowed or ticket doesn't belong to this room.               |

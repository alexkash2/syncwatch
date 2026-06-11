# Ideas to discuss

Scratchpad for things that need a decision before they're plannable. This
is not a TODO — there's no agreed plan here. Once a direction is picked,
the concrete pieces move into `TODO.md` with a priority.

Complexity scale:
- **S** — a few hours, no migrations or protocol changes.
- **M** — a day or two, DB migrations or new WS messages, but the same
  architecture.
- **L** — several days, breaks an architectural assumption, rewrites sync
  or auth.

---

## 1. Room passwords

### Context
Today a room = `room_code` (8 alnum chars, server-generated). Anyone
with the code can join. That's fine for friends but not safe for
public or private scenarios.

### Basic implementation idea
- DB migration: `rooms.password_hash: text | null`. Hash via bcrypt
  (reuse `core/security.hash_password / verify_password` — same code
  path as user passwords).
- On room creation, the frontend gets an optional "Room password" field.
  Empty → `password_hash = null`, backwards compatible.
- On join-by-code: if a room has `password_hash`, require a `password`
  field in `POST /api/rooms/join`. The server compares via
  `verify_password`. Wrong password → `401`; missing password → a
  distinct `password_required` code so the frontend can prompt for one.
- Rate limit on `/join` already exists (global limit) — add a per-room
  limit on failed attempts so the password can't be brute-forced.
- The password itself **never** goes through WS — it's only used during
  REST join. After that the participant is already in
  `room_participants` and the WS ticket is issued as usual.

### Complexity: M
- 1 Alembic migration.
- 1 form field in "Create room" + a password input in "Join by code".
- Changes in `services/rooms.py` and `api/rooms.py`.
- Tests: join without password → 401, join with correct password → 200,
  join with no password sent → `password_required`, rate limit.

### Open questions
- Should the host be able to see their own password? Can't store it in
  plaintext; options are "forget — reset it" or a one-time reveal at
  creation time.
- Can the password of an existing room be changed or removed? Probably
  yes — `PATCH /api/rooms/{id}` (host only).
- Pass the password via URL (`/join?code=…&password=…`)? **No** — it
  would land in logs and browser history. Body of POST only.

---

## 2. Host kicking participants

### Context
Today the host has no way to remove a single participant. If someone
trolls in chat or is otherwise disruptive, the only way to deal with
them is to close the whole room. That's too coarse.

### Basic implementation idea
- New WS message from the host: `kick { target_user_id }`. The server:
  1. Verifies `is_host(sender)`.
  2. Closes the target's WS with code `4004` and `error/kicked`.
  3. Removes them from `room_participants` (sets `left_at = now`).
  4. Broadcasts `user_left { reason: "kicked" }` to the rest.
  5. Adds the `user_id` to an in-memory `banned_users[room_id]` set.
- On a re-join attempt via REST `POST /api/rooms/{id}/join`, the
  server checks `banned_users` and replies `403 kicked_from_room`. The
  list is kept in-memory — single-instance rooms only need it to
  survive until the process restarts, which is acceptable (the room
  will die without the host anyway).
- On the frontend: a "Kick" button next to each non-host participant
  in `ParticipantList`, host-only visibility. Confirm dialog. Toast on
  success.
- For the kicked user: WS receives `error/kicked` → redirect to
  `/create` with an arrival-notice "You were removed from the room by
  the host".

### Complexity: M
- New WS message-type + handler.
- Change to `services/rooms.py::join_by_code` (ban-list check).
- UI in `ParticipantList` + new arrival-notice / toast copy.
- Tests: kick → target booted and can't return; non-host sends kick →
  `not_host`; kicking a non-member → `not_in_room`.

### Open questions
- Permanent ban (until the room closes) or with a TTL? I'd lean
  "until the room closes" — it's in-memory anyway.
- Can the host un-kick? If not, `kick` is final. If yes, a second WS
  message `unkick`. Not needed for MVP.
- Log kicks in the security audit log (P2 in `TODO.md`)? Yes, once
  the audit log lands.

---

## Next steps

1. For #1 and #2 — agree on the order. Both are needed for "private"
   rooms but they're independent, so they can land in parallel or in
   sequence.
2. Once a direction is agreed, move the chosen pieces into `TODO.md`
   under P2 (important before opening to the public).

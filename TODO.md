# TODO

Everything that's deliberately out of MVP scope or left for later. Grouped by category, priority-ranked within each group.

Legend: **P1** blocks production · **P2** important before opening to public · **P3** quality of life / future work.

---

## Security

### P1

- [ ] **Move tokens out of `localStorage`** — switch to `HttpOnly; Secure; SameSite=Strict` cookies. Requires rewriting `frontend/src/api/client.ts` (drop the `Authorization` interceptor), backend `/login` / `/refresh` to `Set-Cookie`, `get_current_user` to read cookies, and CSRF protection (double-submit token or `X-CSRF-Token` header) on all mutating routes.
- [ ] **Logout endpoint / bulk revocation.** Single-use refresh rotation is in (replay is detected via in-memory `jti` blocklist). Still missing: an explicit `POST /api/auth/logout` to invalidate the *current* refresh, and a way to revoke *all* refresh tokens for a user (e.g. on password change). Simple path: add `token_version: int` to `users`, embed in JWT, increment on logout/password change.

### P2

- [ ] **Security audit logging.** Structured JSON logs for at least: `auth.login.success/failure`, `auth.register`, `auth.refresh.failure`, `auth.rate_limited`, `auth.logout`, `room.created/deleted`, `ws.ticket.issued`, `ws.origin.rejected`, `ws.tab_replaced`. Never log plaintext tokens or passwords; email may be hashed (`sha256(email)[:8]`) for pseudonymisation. 90-day retention.
- [ ] **Password reset flow.** Requires email infra (SMTP/SES), single-use reset tokens, rate-limited.
- [ ] **Email verification at registration.** Same email infra. Block login until verified, or degrade gracefully.
- [ ] **Account lockout** after N failed logins, with auto-unlock after X minutes. Currently we only have rate limit; a determined attacker with distributed IPs can stretch attempts over time.
- [ ] **2FA (TOTP).** `pyotp`, `totp_secret` + `totp_enabled` on `users`, enable/verify/disable endpoints, challenge flow in `login_user`, backup codes stored as bcrypt hashes.

### P3

- [ ] **Sentry / error telemetry** for the React `ErrorBoundary` — currently just `console.error`.
- [ ] **CSP `script-src` nonces** — currently `'self'` only, which is fine for now but would break if any inline scripts are ever needed.

---

## Reliability & edge cases

### P2

- [ ] **Integration tests for WebSocket flow.** Currently only REST is covered end-to-end. Needs either a real Postgres fixture (testcontainers) or custom SQLite shims for the partial unique index. Scenarios to cover: connect → ready → play → drift correction → disconnect → reconnect, tab-dedup, host grace/timeout, file_changed cascade, rate-limit replies.
- [ ] **E2E smoke tests (Playwright).** The manual checklist in [docs/TESTING.md](docs/TESTING.md#manual-e2e-smoke-test) is the source list. Two-browser automation is the hard part — may need `--browser=chromium` twice with different profiles.
- [ ] **Ready state cleanup on rooms deactivation.** When `is_active` goes to `false`, participants' `is_ready` stays `true` in DB. Cosmetic but can confuse re-activation paths if those are ever added.

### P3

- [ ] **File size / duration sanity checks** on the client before hashing. Very large files (>10 GB) may OOM the browser's `ArrayBuffer` when building the partial-hash buffer. The chunked path handles this, but the small-file (<3 MB) path reads the whole file — safe today because `accept="video/*"` practically gates large files, but a hard limit would be explicit.
- [ ] **Protocol schema validation** on the server side. Right now the WS handler does `.get("field", default)` — a malformed message is just silently dropped. A pydantic model per `msg_type` would produce clearer errors (useful once audit logging is in).
- [ ] **Clock skew handling.** All sync math uses `time.monotonic()` on the server, but `server_time` in broadcasts is `time.time()` (wall clock). If the server's wall clock jumps, UI timestamps (chat) will jump too. Not a sync-correctness issue, just ordering.

---

## Scaling

### P2 (required before >1 backend instance)

- [ ] **Move `ConnectionManager` state to Redis.** Rooms, per-user connection map, `RoomState`, grace timers, disconnected-user bookkeeping. Needs pub/sub for broadcasts across instances.
- [ ] **Move WS-ticket store to Redis** with TTL. Tickets are currently in-memory; a user rotated to a different instance on ticket redemption would fail.
- [ ] **Move rate-limiter to Redis** (or a dedicated edge proxy). In-memory limits per instance mean the effective limit is `N × configured` when load-balanced.

### P3

- [ ] **Sticky sessions or session affinity** won't fully solve this — the partition of "all participants in room X on instance Y" has to be strict, or we need real pub/sub. Document this constraint for whoever deploys.

---

## Observability & operations

### P2

- [ ] **Structured logging setup.** `structlog` or stdlib `logging` with `JSONFormatter`. Add request-id middleware. Wire into every `except` block that currently does `pass`.
- [ ] **Metrics (Prometheus).** At minimum: active WS connections, active rooms, messages/sec per type, rate-limit rejections per endpoint, DB query latency, bcrypt latency (detects CPU starvation).
- [ ] **Alerting** on: sudden spike in 4xx/5xx, WS disconnection rate above baseline, health-endpoint failures.

### P3

- [ ] **Backup strategy for Postgres.** Compose uses a named volume; for real deployment either managed DB or `pg_dump` on schedule with off-host storage.
- [ ] **Log rotation** in Docker (compose default is `json-file` unlimited; in production switch to `local` driver or ship logs out).

---

## UX / product

### P2

- [ ] **Chat "X is typing…" indicator.** Requires a new WS message type; debounce on the client.
- [ ] **Host handover.** When the host leaves, the room closes. Alternative: auto-promote the longest-present participant. Needs a state-machine update + new `host_changed` WS message.
- [ ] **Show "ready / total" counter** in the header while in `waiting_ready` — right now the host has to open the participant panel to see who's still loading.
- [ ] **Subtitles / captions support.** External `.vtt`/`.srt` picked alongside the video, rendered via a `<track>` element. Each participant picks their own.

### P3

- [ ] **Password show/hide toggle** on login/register.
- [ ] **Room activity** (last played, last message) on HomePage rooms table.
- [ ] **Per-room max-participants override** (currently hard-coded to 10).
- [ ] **Dark/light theme** toggle. Currently dark-only.

---

## Internationalisation

### P2 (when a second language is actually needed)

- [ ] **Full i18n pass.** `react-i18next` + `i18next-browser-languagedetector`. Every JSX string, `window.confirm`/`window.alert` text, flash messages, tooltips, aria-labels, and backend error messages must be extracted into keyed bundles. Backend errors should return **codes** (e.g. `"auth.email_taken"`) instead of prose; client does the lookup. Scaffold-without-translation is worse than nothing (extra indirection, same UX).

---

## Accessibility

### P2

- [ ] **Pass a11y audit.** Emoji-only buttons (`💬`, `⏪`, `⏩`, `⛶`, `▸`) need `aria-label`. Table rows on HomePage are `onClick` divs — make them `<button>` or add `role="button"` + `tabIndex={0}` + Enter/Space handlers. Overlays (host-disconnected, autoplay-blocked) should trap focus.
- [ ] **Keyboard navigation** — modals don't currently support Escape to dismiss; the sidebar toggle on mobile has no focus management.
- [ ] **Contrast audit** on the primary-container gradient over dark background. Tooltip/hint text (`text-on-surface-variant/60`) is borderline on WCAG AA.

### P3

- [ ] **Screen reader announcements** for `room_closed`, `host_disconnected`, `tab_replaced` — currently only visual.
- [ ] **Reduced motion** — spinners ignore `prefers-reduced-motion`.

---

## Performance

### P3

- [ ] **Virtualise `ChatPanel`** for rooms with very long history (react-virtual / tanstack-virtual). We already memoise the row; virtualisation only matters past ~1000 messages.
- [ ] **Memo `handleWsMessage`** dependency chain in `RoomPage.tsx` — the callback rebuilds every render of `RoomPage` (any state change), which re-subscribes WS handlers. Currently not expensive but worth revisiting.
- [ ] **N+1 check** on `get_user_rooms` — `selectinload` is fine for small N, but at scale paginate with a JOIN on a denormalised "last activity" column to avoid an extra COUNT query.

---

## Documentation

### P3

- [ ] **ADRs (Architecture Decision Records)** for the non-obvious calls: one-process in-memory state, ws-ticket vs JWT-in-URL, partial-hash over full-hash, etc. Currently implicit in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- [ ] **Contributing guide** (branch naming, commit style, PR checklist).
- [ ] **License file.**

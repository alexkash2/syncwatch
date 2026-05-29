# SyncWatch Frontend Review

**Verdict:** The frontend is in solid shape for a university submission. The WS reconnect/seq-dedup machinery, file-restore fallback, and auth interceptor are unusually careful and well-commented for a student project. No crash-level P1 was found in the happy paths I traced; the issues below are mostly race conditions and state-desync edges that *can* surface during a live demo (reconnect, host toggling pause, mismatched-file retries). Prioritise the P2 sync/state items — they are the ones most likely to bite during grading.

---

## P1

None.

I traced join → file-verify → ready → play → drift → disconnect → reconnect → leave and found no guaranteed crash or fully-broken core flow. The closest candidates are listed under P2 because they require specific timing/order to trigger.

---

## P2

### 1. Optimistic `setRoomStatus` on host toggle desyncs from server truth
`frontend/src/pages/RoomPage.tsx:329` and `:333` (also `handlePlay`/`handlePause` at `:339`,`:347`)
When the host clicks the video, `handleVideoClickToggle` sets `roomStatus` locally *and* sends `play`/`pause`. If the server rejects or never echoes a `sync_state` (e.g. send returns `false` because the socket just dropped), the local `roomStatus` is now wrong and `shouldKeepControlsVisible` / onboarding logic act on a phantom state. The `send()` return value is ignored here (unlike `handlePlay` which returns it but the caller discards it).
*Fix:* only flip `roomStatus` from the authoritative `sync_state` handler (`useRoomWsHandler.ts:243`), or revert the optimistic value if `send()` returns `false`.

### 2. `room_state` rehydration races the local file/video element on reconnect
`frontend/src/hooks/useRoomWsHandler.ts:119-123`
On reconnect, the handler synthesises a `sync_state` and pushes it through `useVideoSync` to re-apply play/seek. But file restore from IndexedDB (`FileSelector` effect, `persistentFileHandle.ts`) is async and usually *not* finished when `room_state` arrives, so `videoRef.current` is null and `handleSyncMessage` returns early at `useVideoSync.ts:78-80`. The room then thinks it's playing but the just-restored video never gets `play()`'d, because the restore path only fires `onVideoCanPlay` → `announceLocalFileReady`, not a re-sync.
*Fix:* after the restored file reports `canplay`, re-request current room state (or have the host's periodic `sync_state` cover it). Confirm the backend sends a fresh `sync_state` shortly after `room_state`; if not, this is a frozen-player-on-reconnect bug.

### 3. `isRoomPlayingRef` only set by `sync_state`, never rehydrated label-correctly for `sync_correction`
`frontend/src/hooks/useVideoSync.ts:88` vs `:123-127`
`isRoomPlayingRef` is the gate `resumePlayback` uses to decide whether tapping the autoplay overlay should actually start playback. It is updated **only** in the `sync_state` branch. If the first message a reconnecting viewer processes is a `sync_correction` (seek) while paused, then later a user taps "Resume", the stale `isRoomPlayingRef` may misjudge. Minor, but it means the overlay's resume decision can lag the true room state by one message.
*Fix:* also update `isRoomPlayingRef` when an authoritative play/pause-bearing message arrives, or carry `is_playing` on more message types.

### 4. `sendSyncReport` closes over stale `autoplayBlocked`; report stops being accurate
`frontend/src/hooks/useVideoSync.ts:27-50`
`sendSyncReport` is memoised on `[autoplayBlocked, send]`, so it *is* rebuilt when `autoplayBlocked` changes — good. But `handleSyncMessage` is given to `RoomPage` via `syncMessageRef` (`RoomPage.tsx:206`), and the `sync_check` branch calls the *current* `sendSyncReport` through the same closure chain, so this is actually fine. The real smell: `playback_status` reports `'playing'` as the default even when the room is paused but the local video happens to be paused-by-user — verify the server's interpretation of `playback_status` vs `is_playing` doesn't double-count. Low impact; flag for a quick contract check against the backend.

### 5. Mismatched-file retry can leak the previous object URL’s revocation timing
`frontend/src/components/room/FileSelector.tsx:191-218`
In the verify effect, on `match` the code reads `pendingFile.current` destructured into `{ persistentHandle, url, file }`, calls `onFileVerified(url)`, then sets `pendingFile.current = null` *without* revoking `url` (correct — ownership transfers to the store). But on the *non-match* branch it revokes and nulls. If a second file is chosen while the first verify is still in-flight, `processSelectedFile` (`:92-95`) revokes the prior `pendingFile.url` — but the verify effect's `setTimeout(…, 0)` may already have captured the old `pendingFile.current`. The hash guard at `:184-188` mitigates most cases, but a same-hash re-pick could act on a revoked URL.
*Fix:* capture `pendingFile.current` into a local at the top of the timeout and bail if it changed; you already compare hashes — also compare object identity.

### 6. `useWebSocket` connect effect depends on `connect`, which depends on `roomId` — extra teardown/reconnect churn
`frontend/src/hooks/useWebSocket.ts:184-219`
The main effect lists `[connect, resetRoom, roomId]`. `connect` is rebuilt whenever `scheduleReconnect`/refs change. Because `connect` is in the dep array, any rebuild of `connect` tears down the socket (cleanup runs `wsRef.current?.close()` + `resetRoom()`) and reconnects with a new `mountIdRef`. In practice `connect`'s deps are all stable (`fileVersionRef`, `lastSeqRef` are refs; `roomId` stable; `scheduleReconnect` has `[]` deps), so it should be stable — but this is fragile: if any dep of `connect` ever becomes non-stable, you get a reconnect storm *and* a `resetRoom()` that wipes chat/participants mid-session.
*Fix:* drive the effect off `roomId` only and read `connect` through `connectRef` (which you already maintain at `:185`). Remove `connect` from the dep array.

### 7. Auth refresh interceptor: queued requests during refresh aren’t all retried
`frontend/src/api/client.ts:90-123`
`refreshPromise` correctly de-dupes concurrent refreshes, but each failed request only retries itself if *its own* `originalRequest._retry` is unset. Requests that 401'd and entered the handler *after* `refreshPromise` resolved get the new token and retry — fine. However, a request whose `_retry` was already `true` (a second 401 after refresh) is rejected without surfacing that the new token is also bad, and there's no global "session dead" short-circuit, so several in-flight calls can each independently trigger the rejection path. Functionally OK, but during a token-expiry demo you may see multiple error toasts.
*Fix:* once `refreshAccessToken` returns null, set a module flag so subsequent queued requests reject fast without re-entering refresh.

### 8. `handleVideoClickToggle` reads `room?.host_id !== user?.id` but gating is moving — verify the optimistic branch
`frontend/src/pages/RoomPage.tsx:314-334`
(Not flagging the host-only gate per instructions.) The concern that *will* survive the "all participants can control" change: this handler calls `video.play()/pause()` and `send(...)` and `setRoomStatus(...)` directly, duplicating logic that also lives in `PlaybackControls.togglePlay`. Two code paths mutating the same video + sending the same WS messages is a desync/double-send risk once viewers can also control. Consolidate into one handler before the gating change lands.

### 9. `previousConnectionStateRef` initialised to `null` swallows the first real transition
`frontend/src/pages/RoomPage.tsx:454-460`
The effect early-returns and records the *current* state the first time it runs. If the very first observed `connectionState` is `'reconnecting'` (socket failed before first open), the "Reconnecting" banner never shows because the first transition is treated as the baseline. Edge, but possible on a flaky-network demo.
*Fix:* initialise the ref to `'connecting'` (the true initial state) instead of `null`.

---

## P3

### 1. `participant.username[0]` will throw on an empty username
`frontend/src/components/room/ParticipantList.tsx:63`
`participant.username[0].toUpperCase()` crashes if `username` is ever an empty string. Backend validation makes it unlikely, but a defensive `participant.username?.[0]?.toUpperCase() ?? '?'` is cheap insurance against a render crash.

### 2. `RoomTabs` `setActiveTab` always resets to `'chat'` when opening the launcher
`frontend/src/components/room/RoomSidebar.tsx:164-166`
The floating chat launcher forces `setActiveTab('chat')` on every open, discarding a user who last had "People" selected. Minor UX nit.

### 3. Dead/unused props and computed values
- `frontend/src/components/room/RoomSidebar.tsx:46` — `roomName` is destructured but used only in two `aria-label`s; fine, but `sidebarRef`/focus logic duplicates `RoomHeader`'s drawer logic almost verbatim — candidate for a shared `useDismissable` hook.
- `frontend/src/components/room/VideoArea.tsx:359` `getConnectionMeta` returns `label`/`tone` that are never read (only `helper`/`dotClass` used). Trim.
- `frontend/src/hooks/useVideoSync.ts:29` the `'error'` literal in the `playbackStatus` union is computed but `video.error` path is reachable only briefly; verify the server maps it.

### 4. `showInteractionHint` default message is host-specific copy
`frontend/src/pages/RoomPage.tsx:281` — default `'Only the host can control playback.'` will be wrong once all participants can control. Make the default generic or require the caller to pass copy.

### 5. `computeFileHash` small-file path reads the entire file into memory
`frontend/src/utils/fileHash.ts:11-16` — already noted in TODO P3, repeating only to confirm it's real: files ≤3 MB are fully buffered; not a concern given `accept="video/*"`, but the threshold means a 3 MB clip and a 3 GB movie take different hash *inputs* — ensure the backend uses the identical chunking, or a host on one path and viewer on another could mismatch. **Worth a quick cross-check** with the server's hash implementation; if they diverge this becomes a P2 (verification always fails).

### 6. `getBufferHealthMs` returns 0 when `currentTime` sits exactly on a gap boundary
`frontend/src/utils/fileHash.ts`/`useVideoSync.ts:150-160` — uses inclusive `>=`/`<=`; on a buffered-range gap it reports 0 health, which may spuriously mark a viewer as buffering. Cosmetic (only affects the participant status badge).

### 7. `ErrorBoundary` renders raw `error.message` to the user
`frontend/src/components/layout/ErrorBoundary.tsx:45-47` — fine for a uni project, but it surfaces internal messages. Already covered by TODO (Sentry). No action needed for submission.

### 8. `lastSeqRef` reset comment is load-bearing but the reset happens after `reconnect` send
`frontend/src/hooks/useWebSocket.ts:94-110` — correct as written (reads `lastSeqRef` for the reconnect payload *before* nulling it), but the ordering is subtle and a future edit could easily swap the two lines and silently break rehydration. Consider an explicit local `const seqForReconnect = lastSeqRef.current ?? 0;` at the top of `onopen` to make the dependency obvious.

---

## Notes / things I checked that are NOT bugs
- Host-only playback gating (`PlaybackControls`, `VideoArea`, `useVideoSync`) — intentionally left per instructions.
- `roomStore.setFileUrl`/`resetRoom` correctly `URL.revokeObjectURL` the previous blob; `RoomPage` unmount cleanup also revokes via `fileUrlRef`. No double-revoke crash (revoking an already-revoked URL is a no-op).
- `useWebSocket` cleanup correctly sets `intentionalCloseRef`/`shouldReconnectRef` and bumps `mountIdRef`, so an in-flight `createWsTicket` resolving after unmount is discarded (`:78-84`). Good.
- `tab_replaced` handling sets `intentionalCloseRef` in `onmessage` (`:129-131`) so the subsequent close doesn't reconnect. Correct.
- `useLoadRoom` cancellation flag prevents setState-after-unmount and the chat-history failure is non-fatal. Good.
- Toast overflow eviction in `UiContext` clears the evicted timer before slicing. Good.
- `addMessage` in the store dedupes by id, so a chat echo + history overlap won't duplicate. Good.

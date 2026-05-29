# SyncWatch Frontend — WCAG 2.1 AA Accessibility Audit

**Verdict:** The codebase is meaningfully better than its TODO list suggests — most icon-only buttons carry `aria-label`, the ConfirmDialog/SettingsDialog have real focus traps + Escape, RoomTabs implements full ARIA tablist keyboard navigation, decorative SVG icons are `aria-hidden`, and `prefers-reduced-motion` is honoured both via CSS and a `data-motion` attribute. The remaining gaps are concentrated in two core flows: the **AuthModal lacks a focus trap and initial focus** (the only modal that does), and **form fields have visually-present labels that are not programmatically associated** with their inputs. Those, plus a couple of live-region and contrast issues, are the priority fixes.

---

## P1 — Critical (core flow blocked for keyboard / screen-reader users)

**`frontend/src/components/ui/Field.tsx:11-15` — WCAG 1.3.1 (Info & Relationships) / 3.3.2 (Labels or Instructions) / 4.1.2 (Name, Role, Value)**
The `<label>` is not associated with its child input — no `htmlFor`/`id` link and the input is not nested inside the `<label>`. Every field built with `Field` (all of AuthModal: Username, Email, Password, Confirm Password; CreateRoomPage: Room Name, Room Code) exposes only a placeholder as its accessible name, so screen readers announce the input as unlabeled and clicking the label text does not focus the field.
*Fix:* Generate an id (`useId()`), put it on the `<label htmlFor={id}>`, and pass it down to the input — e.g. clone the child with `id`/`aria-describedby`, or have `Field` render the `<input>` via render-prop. Then thread `aria-invalid`/`aria-describedby` for errors (see AuthModal P2).

**`frontend/src/components/auth/AuthModal.tsx:130-274` — WCAG 2.1.2 (No Keyboard Trap, inverse) / 2.4.3 (Focus Order)**
The auth dialog (`role="dialog" aria-modal="true"`) is the primary login/registration surface but, unlike ConfirmDialog and SettingsDialog, it implements **no focus trap and sets no initial focus**. On open, focus stays on whatever triggered it (or `body`); Tab can walk out of the dialog into the page behind the backdrop, and screen-reader users are not moved into the dialog. This degrades the most important entry flow.
*Fix:* On open, focus the first field (or the close button via a ref); add a Tab/Shift-Tab wrap handler over the dialog's focusable elements, mirroring the existing logic in `SettingsDialog.tsx:38-73`.

---

## P2 — Serious

**`frontend/src/components/auth/AuthModal.tsx:250-259` — WCAG 4.1.3 (Status Messages)**
The error `Panel` carries `aria-live="polite"` but is conditionally mounted (`{error && ...}`). Because the live region does not exist in the DOM before the error appears, many screen readers will not announce "Invalid email or password" / "Passwords do not match". The same pattern repeats in `CreateRoomPage.tsx:269-288` (the `error` panel is only rendered when truthy).
*Fix:* Render a persistent live-region wrapper (always in DOM, `aria-live="assertive"` for form errors) and place only the text inside it conditionally, or move `role="alert"` onto an always-present container.

**`frontend/src/components/auth/AuthModal.tsx:193-241` — WCAG 3.3.1 (Error Identification) / 3.3.3**
Inputs are not linked to the error message: no `aria-invalid` on the failing field and no `aria-describedby` pointing at the error text. The error is a generic banner, so a screen-reader user tabbing the form cannot tell which field is wrong. (Contrast with `ChatPanel.tsx:269-270`, which does this correctly.)
*Fix:* Give the error Panel an `id`, set `aria-invalid` + `aria-describedby={errorId}` on the relevant inputs when validation fails.

**`frontend/src/components/ui/ConfirmDialog.tsx:43-89` — WCAG 2.1.1 (Keyboard)**
The ConfirmDialog traps Tab focus but, unlike SettingsDialog, has **no Escape-to-close handler**. Users expect `alertdialog`s to be dismissable with Escape; here the only exits are the buttons. (This is the dialog used for "Delete room" and "Leave as host".)
*Fix:* Add an `if (event.key === 'Escape') onCancel();` branch to the existing `keydown` listener.

**`frontend/src/components/room/VideoPlayer.tsx:82-114` — WCAG 2.1.1 (Keyboard) / 4.1.2**
The video surface toggles play/pause and fullscreen via `onClick`/`onDoubleClick` on a non-interactive `<div>` with no `role`, `tabIndex`, or key handler, and the `<video>` itself has `controls={false}`. A keyboard-only user cannot click the player. Playback is partially keyboard-reachable through the global Space/Arrow/F handler in `PlaybackControls.tsx:169-200`, but that handler is `isHost`-gated and the player div remains unfocusable, so the click-to-toggle/double-click-to-fullscreen affordances are mouse-only.
*Fix:* Either rely solely on the (already labelled) `PlaybackControls` buttons for keyboard users, or make the surface a real control (`role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space) with an `aria-label`.

**`frontend/src/components/room/HostDisconnectOverlay.tsx:8-43` — WCAG 4.1.3 (Status Messages)**
This full-screen overlay announces a critical state ("Host connection dropped", room closing in N seconds) but has **no `role="alert"`/`role="status"` and no `aria-live`**, so its appearance and the `{graceCountdown}s` countdown (`line 26`) are silent to screen readers. The `room_closed`/host-disconnect transitions are exactly the async state changes the spec calls out.
*Fix:* Wrap the panel in `role="alertdialog"` with `aria-labelledby`/`aria-describedby`, and put the countdown in an `aria-live="assertive"` (or at least `polite`) region. Consider `aria-atomic` so the full "Time left Ns" reads each tick (or throttle announcements).

**`frontend/src/components/room/VideoArea.tsx:194-213` — WCAG 4.1.3 / 2.4.3**
The autoplay-blocked overlay ("Playback is waiting for your click") is a modal-style prompt with no `role`/`aria-live` and no focus move to its "Resume Playback" button. It is announced neither on appearance nor focused, so a screen-reader user may not know an action is required. The transient "Preparing the local video player…" (`line 235-242`) and `interactionHint` (`line 244-250`) are likewise plain `<div>`s with no live region.
*Fix:* Add `role="status"` + `aria-live="polite"` to the autoplay/preparing/hint containers; on autoplay-block, move focus to the Resume button.

**`frontend/src/index.css:5,11` & usages with `/40`–`/60` alpha — WCAG 1.4.3 (Contrast Minimum)**
`--color-on-surface-variant` (`#c2c6d9`) is fine at full opacity (~12:1 on `#131313`), but it is frequently rendered at reduced alpha that drops below 4.5:1 for body text. Concrete failures: placeholder text `placeholder:text-on-surface-variant/40` (`inputStyles.ts:5`, ChatPanel input `ChatPanel.tsx:265`) ≈ ~3:1; the "Conversation starts here" hint `text-on-surface-variant/40` (`ChatPanel.tsx:221`); timestamp `text-on-surface-variant/60` (`ChatPanel.tsx:44`). The TODO already flags this.
*Fix:* Raise these to at least `/70`–`/80` for any text that conveys information (timestamps, hints). Placeholders are exempt from 1.4.3 only when not the sole label — but since `Field` labels are currently not associated (P1), the placeholder is effectively the label, so its contrast matters here.

---

## P3 — Minor / polish

**`frontend/src/components/room/PlaybackControls.tsx:397-419` — WCAG 4.1.2**
`ControlButton` uses `aria-disabled={!enabled}` but keeps the button clickable (intentional, to surface the "only host" hint). That is acceptable, but for the volume "button" (`line 311-319`) the `onClick` merely focuses the adjacent slider; on touch/keyboard that interaction is non-obvious. Minor: consider making the volume control a single labelled `<input type="range">` rather than a button-then-reveal-slider pattern so it is reachable in one Tab stop.

**`frontend/src/components/room/VideoArea.tsx:322`, `HostDisconnectOverlay.tsx:31`, `CreateRoomPage.tsx:637` — WCAG 2.3.3 (Animation from Interactions, AAA) / good practice**
Several `RefreshIcon`s use `className="animate-spin"`. The global `prefers-reduced-motion` CSS (`index.css:68-94`) clamps `animation-duration` to 0.01ms, which neutralizes these — good. No action required; noting that reduced-motion is correctly handled app-wide (also `data-motion="reduced"` set in `PreferencesContext.tsx:64-68`).

**`frontend/src/App.tsx` / `frontend/src/components/layout/Layout.tsx:14-18` — WCAG 2.4.1 (Bypass Blocks)**
There is no "skip to main content" link. With a fixed `<Header>` containing brand link + Create-room + user menu, keyboard users must tab through the header on every page. The `<main>` exists but has no `id`/skip target.
*Fix:* Add a visually-hidden skip link as the first focusable element pointing at `#main`, and give `<main id="main">` (Layout) and RoomPage's `<main>` (`RoomPage.tsx:607`) the id.

**`frontend/src/components/layout/Header.tsx:195-223` — WCAG 4.1.2 (Name, Role, Value)**
The user dropdown trigger has `aria-haspopup="menu"`/`aria-expanded`, and items have `role="menuitem"`, but the container is a plain `<div>` (no `role="menu"`) and there is no arrow-key roving focus between the two items. Functionally usable (each item is a real button, Escape closes, outside-click closes) but not a fully conformant menu.
*Fix:* Add `role="menu"` to the wrapper and optional Up/Down focus movement, or relax the pattern to a simple group of buttons (drop `role="menuitem"`).

**`frontend/src/components/room/ParticipantList.tsx:45-47` & `RoomHeader.tsx:208-214` — WCAG 4.1.3 (Status Messages)**
These `aria-live` regions are well-intentioned, but the participant-count region re-announces the *entire* sentence ("N participants in the room. M ready for playback.") on every roster change, which can be noisy. Minor: scope announcements to deltas or `aria-atomic` tuning. The pattern itself is correct.

**`frontend/src/components/ui/PreferenceToggleCard.tsx:32-42` — WCAG 1.4.11 (Non-text Contrast)**
The toggle's off-state track (`bg-black/24` with `border-outline-variant/18`) against the card background is very low contrast for a UI component boundary (<3:1), making the control's state hard to perceive. The thumb (`bg-on-surface-variant`) carries the signal, which helps. Minor.
*Fix:* Strengthen the track border/background in the unchecked state to meet 3:1 against the surrounding surface.

**Headings — WCAG 1.3.1 (good, with one note)**
Heading hierarchy is mostly sound: pages use a single `<h1>` (HomePage `line 45`, NotFoundPage `line 27`) and section `<h2>`/`<h3>`. Note: RoomPage has **no `<h1>`** — the room name lives in `RoomHeader` inside a `<button>` (`RoomHeader.tsx:304` is an `<h3>` inside the off-screen drawer). For the room screen, consider a visually-hidden `<h1>` naming the room so the page has a top-level heading. Minor.

---

## Areas verified as already accessible (no action)

- **Icon-only buttons** broadly carry `aria-label`: close buttons (`AuthModal.tsx:144`, `ConfirmDialog.tsx:108`, `SettingsDialog.tsx:98`), toast dismiss (`ToastViewport.tsx:82`), room-deck/sidebar launchers (`RoomHeader.tsx:262`, `RoomSidebar.tsx:169`), copy-code (`RoomHeader.tsx:309`), and all `PlaybackControls` buttons (play/pause, fullscreen, volume) have labels + titles. The TODO's "emoji-only buttons" concern is not reflected in the current code — icons are labelled SVGs, not bare emoji.
- **SVG icons** are decorative-safe: `BaseIcon` sets `aria-hidden="true"` (`icons.tsx:21`).
- **RoomTabs** is a textbook ARIA tablist: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex`, and Arrow/Home/End handling (`RoomTabs.tsx:24-92`); the panel is `role="tabpanel"` with `aria-labelledby` (`RoomSidebar.tsx:127-132`).
- **ChatPanel** is strong: associated `<label htmlFor>` (`ChatPanel.tsx:256`), `role="log" aria-live="polite" aria-relevant="additions text"` on the message list, `aria-invalid`/`aria-describedby` wiring, and `role="alert"` on the offline error.
- **ConfirmDialog & SettingsDialog** both implement focus-on-open + Tab focus traps (`ConfirmDialog.tsx:43-85`, `SettingsDialog.tsx:26-74`); SettingsDialog additionally handles Escape.
- **RoomSidebar / RoomHeader drawer** move focus to the close button on open and close on outside-click + Escape (`RoomSidebar.tsx:50-79`, `RoomHeader.tsx:60-89`).
- **prefers-reduced-motion** is respected globally (CSS media query + `data-motion` attribute) and consulted in JS for header parallax (`Header.tsx:86`), chat autoscroll (`ChatPanel.tsx:83`), and scroll behavior (`CreateRoomPage.tsx`).
- **focus-visible** styling is defined globally with a clear 2px outline + ring (`index.css:40-48`), satisfying 2.4.7.
- **HomePage room cards** are semantic `<article>` elements with real `<Button>` actions inside — the TODO's "onClick divs / table rows" issue does not exist in the current code.
- **Touch targets**: most interactive controls use `min-h-10`/`min-h-11`/`h-11`/`h-14`, meeting the 44px guidance; the "Delete" text button (`CreateRoomPage.tsx:526`) and some `size="sm"` buttons are on the smaller side but acceptable for AA.

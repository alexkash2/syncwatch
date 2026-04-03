# Design System Specification: Cinema-Grade Synchronization

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Obsidian"**
This design system moves beyond the utility of a standard media player to create a "Digital Obsidian" experience—polished, deep, and monolithic. While the foundation is inspired by functional giants like Discord and YouTube, our execution leans into high-end editorial aesthetics. We achieve this through **Atmospheric Depth** and **Intentional Asymmetry**.

We are not just building a synchronized player; we are building a private cinema. The layout should feel like a darkened theater where the content is the only source of light. By utilizing wide tracking in labels, aggressive typographic scales, and layered surfaces, we remove the "template" feel and replace it with a bespoke, curated interface.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in deep obsidian tones, using blue as a surgical strike of color rather than a blunt instrument.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1-pixel solid borders to define sections (e.g., sidebars, headers). Boundaries must be created via **Background Shifts**. 
*   *Example:* A sidebar using `surface-container-low` should sit directly against a `surface` main stage. The human eye will perceive the edge through the shift in luminance, creating a more sophisticated, seamless look.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
*   **Base Layer:** `surface` (#131313) for the primary stage.
*   **Recessed Elements:** `surface-container-lowest` (#0E0E0E) for search bars or "sunken" content areas.
*   **Elevated Elements:** `surface-container-high` (#2A2A2A) for floating chat panels or hover states.

### The Glass & Gradient Rule
While the foundation is flat, main CTAs and floating overlays should utilize a "Signature Texture":
*   **Glassmorphism:** Use `surface-variant` with a 60% opacity and a `24px` backdrop-blur for player controls and dropdown menus.
*   **Luminous Accents:** Primary buttons should use a subtle linear gradient from `primary` (#ADC6FF) to `primary-container` (#4D8EFF) to simulate a soft internal glow.

---

## 3. Typography: Editorial Authority
We use **Inter** not as a default, but as a precision tool. Hierarchy is driven by extreme contrast between oversized display headers and tightly tracked labels.

*   **Display (lg/md):** Used for movie titles or "Room Names." These should feel cinematic and authoritative.
*   **Title (sm):** Used for metadata (Year, Genre, Duration). 
*   **Label (md/sm):** Always uppercase with `0.05em` letter-spacing. This transforms standard text into a functional UI element.
*   **Body (md):** Optimized for the chat experience. Use a slightly generous line height (1.5) to ensure long-form discussions in sync-rooms remain legible during high-intensity scenes.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too heavy for this "Digital Obsidian" look. We use light to define space.

### The Layering Principle
Instead of a "Drop Shadow," we use **Luminance Stacking**:
1.  **Level 0:** `surface-container-lowest` (The "Void" / Background)
2.  **Level 1:** `surface` (The "Stage")
3.  **Level 2:** `surface-container-low` (Secondary Panels)
4.  **Level 3:** `surface-container-highest` (Modals & Active Tooltips)

### Ambient Shadows & Ghost Borders
*   **Ambient Shadows:** For floating elements, use a `32px` blur, `0px` offset, and `4%` opacity of the `on-surface` color. It should feel like a "glow of darkness."
*   **The Ghost Border:** If high-contrast accessibility is required, use `outline-variant` at **15% opacity**. Never use a 100% opaque border; it breaks the illusion of the monolithic surface.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` fill. Roundedness `md` (6px). Transition: 200ms ease-in-out.
*   **Secondary (Ghost):** No fill. `Ghost Border` (15% opacity `outline-variant`). On hover, shift background to `surface-container-high`.
*   **Tertiary:** Text-only. Use `primary` color for the label.

### Input Fields
*   **Style:** `surface-container-lowest` background. No border. On focus, add a 1px `primary` bottom-border only. This maintains a clean, "terminal" aesthetic.

### Cards & Lists
*   **The Forbidden Divider:** Never use a horizontal line to separate chat messages or video list items. Use **Vertical White Space** (`16px` or `24px`) or a subtle hover-state background shift (`surface-container-low`).

### Video Player Controls (Signature Component)
*   **The Frosted Bar:** The control bar should be a floating `Glassmorphic` container positioned `24px` from the bottom edge. This creates a sense of depth, suggesting the controls are hovering over the film itself.

### Chips (Sync Status)
*   **Active:** `secondary-container` background with `on-secondary-container` text.
*   **Synced:** A small `2px` pulse animation using the `primary` color next to the "Live" label.

---

## 6. Do's and Don'ts

### Do:
*   **DO** use asymmetry in the chat layout. Align system messages to the center and user messages to the left to create a rhythmic flow.
*   **DO** lean into the "Darkness." If a section feels too busy, try making the background darker (`surface-container-lowest`) rather than adding a border.
*   **DO** use `display-lg` typography for empty states. A large, faint "Syncing..." in the background is more premium than a small centered icon.

### Don't:
*   **DON'T** use pure black (#000000). It kills the ability to create depth via "lowest" surface tiers.
*   **DON'T** use standard 8px padding. Use a strict 4px/8px/16px/24px/32px/48px/64px scale to ensure mathematical harmony.
*   **DON'T** use high-saturation reds for errors. Use the `error` (#FFB4AB) and `error-container` tokens to keep the palette sophisticated and "muted."
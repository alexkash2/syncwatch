# Design System Document: Deep Space Editorial

## 1. Overview & Creative North Star
**Creative North Star: "The Celestial Editor"**

This design system moves away from the "utility-first" dark mode and toward a high-end, editorial cinematic experience. The goal is to make the user feel like they are interacting with a premium media console rather than a standard web application. We achieve this through "The Celestial Editor" philosophy: an expansive, immersive layout that uses deep tonal depth, razor-sharp precision, and luminous accents to guide the eye. 

We break the "template" look by favoring intentional asymmetry, generous negative space, and a rejection of traditional structural lines. The UI does not sit on the screen; it floats within a void, defined by light and shadow rather than boxes.

## 2. Colors & Surface Architecture

The palette is anchored in "Midnight" and "Charcoal," punctuated by "Electric Blue" light sources.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning content. Boundaries must be defined through background color shifts or tonal transitions.
- Use `surface-container-low` (#1c1b1b) against a `surface` (#131313) background to imply a change in context.
- Use `surface-container-lowest` (#0e0e0e) to create "wells" or recessed areas for secondary content like sidebars or chat history.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each "inner" container should move up or down the tier system to define importance.
- **Base Layer:** `surface` (#131313)
- **Primary Content Area:** `surface-container` (#201f1f)
- **Floating Overlays/Modals:** `surface-bright` (#3a3939) with 80% opacity and 12px backdrop blur.

### The "Glass & Gradient" Rule
To achieve the "Premium Media Player" look, use glassmorphism for all floating elements. 
- **Glass Formula:** `surface-container-highest` at 60% opacity + `backdrop-filter: blur(20px)`.
- **Signature Gradients:** For primary actions, use a linear gradient from `primary-container` (#0062ff) to `inverse-primary` (#0053da) at a 135-degree angle. This adds a "lithium-ion" glow that flat colors cannot replicate.

## 3. Typography: The Editorial Edge

The typography system is designed to feel like a high-end tech journal. We utilize **Inter** for its technical precision and **Manrope** for functional labels.

- **Display & Headlines:** Use `display-lg` through `headline-sm`. These should feature a `-0.02em` letter-spacing for a "tight" editorial feel.
- **Body Text:** `body-lg` and `body-md` use `Inter`. Increase letter-spacing to `+0.01em` for optimal readability against dark backgrounds.
- **The Label Strategy:** All `label-md` and `label-sm` elements must be set in **Manrope** with `uppercase` transform and `0.1em` letter-spacing. This creates a "technical readout" aesthetic common in high-end playback interfaces.
- **Hierarchy:** Use `on-surface-variant` (#c2c6d9) for secondary body text to ensure the `primary` (#b4c5ff) headers remain the focal point.

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering**. Place a `surface-container-lowest` card inside a `surface-container-low` section to create a soft, natural "recess" without shadows.

### Ambient Shadows
When an element must float (e.g., a dropdown or context menu), use an **Ambient Glow**:
- **Shadow:** `0px 24px 48px rgba(0, 0, 0, 0.4), 0px 0px 12px rgba(0, 98, 255, 0.1)`. 
- The subtle blue tint in the shadow mimics the "light bleed" from our luminous electric blue accents.

### The "Ghost Border" Fallback
If a border is required for accessibility, use a **Ghost Border**:
- `outline-variant` (#424656) at 20% opacity. 
- **Rule:** Never use a 100% opaque border.

## 5. Components

### Buttons
- **Primary:** `primary-container` gradient background, `on-primary-container` text. `0.25rem` (sm) roundedness for a sharp, modern look.
- **Secondary (The Glass Button):** Transparent background with a `Ghost Border` and `backdrop-filter: blur(10px)`.
- **States:** On hover, primary buttons should increase their "glow" via a `box-shadow: 0 0 15px rgba(0, 98, 255, 0.4)`.

### Cards & Lists
- **No Dividers:** Forbid the use of line dividers. Use `1.5rem` to `2rem` of vertical whitespace to separate list items.
- **Active State:** Use a vertical 2px "light bar" of `primary-container` on the far left of a list item to indicate the active selection.

### Input Fields
- **Styling:** `surface-container-lowest` background with a bottom-only `outline-variant` (20% opacity). 
- **Focus:** The bottom border transitions to 100% `primary-container` opacity.

### Custom Component: The "Sync-Seeker"
A specialized media progress bar.
- **Track:** `surface-container-highest` (#353534).
- **Progress:** `primary-container` (#0062ff) with a "luminous" drop shadow.
- **Thumb:** Only visible on hover; a razor-sharp `0px` radius square.

## 6. Do's and Don'ts

### Do
- **Do** use expansive layouts. Allow content to breathe with wide margins (at least 48px).
- **Do** use `primary` (#b4c5ff) for high-emphasis text, but keep it sparse to maintain its impact.
- **Do** use `surface-container-lowest` for the "Chat" area to make it feel like a sidebar recessed into the interface.

### Don't
- **Don't** use `DEFAULT` roundedness (0.25rem) on everything. Keep large containers at `none` or `sm` for a more "professional equipment" feel.
- **Don't** use pure white (#ffffff) for text. Always use `on-surface` (#e5e2e1) to reduce eye strain in dark environments.
- **Don't** use standard tooltips. Tooltips must be "Glass" style with `label-sm` typography.

### Accessibility Note
Ensure that all `primary` text against `surface` backgrounds maintains a contrast ratio of at least 4.5:1. Use `on-surface-variant` for non-essential metadata only.
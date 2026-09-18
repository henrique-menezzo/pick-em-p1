# Pick Em · P1 — prototype

Interactive prototype of the Daily Wire midterms prediction map ("Pick Em"), built from the Figma frame
*Pick Em · P1 (web build)*.

**Live:** https://henrique-menezzo.github.io/pick-em-p1/

> Prototype only. Candidates, polls and election-night results are simulated, and the sign-up form is a
> mock: nothing is sent anywhere, everything stays in your browser's local storage.

## What to try

- **Pick on the map** — click a state: 1st click Republican, again Democrat, again clears. The pick shows
  next to the state and in the panel.
- **Pick in the panel** — one race at a time; picking moves to the next open race. "Up next" previews the queue.
- **Race matrix** (bottom) — one dot per race (97). Hover to see who you picked, click to jump to it.
- **Map** — drag to move, scroll / pinch or +/− to zoom, the round arrow returns to the whole map.
- **Autofill**, **Reset**, and the countdown to when picks lock (Nov 3, 2026, 6 PM ET).
- **Save Map** asks for an account (any email + 6-character password works), then unlocks
  **Election Night**: a simulated night (7 PM → 3 AM, play or scrub) comparing your saved map with the calls.
  Right calls show in full colour, misses fade out, uncalled races breathe in grey.

Handy URL params: `?reset` (back to the Figma state) · `?fill=1` (a complete map) · `?night=1&t=240`
(election night at 11 PM) · `?lock=1` (picks lock in one minute).

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · Motion · Zustand (persisted). The dot map is SVG on a single
uniform lattice (`scripts/gen-grid.mjs`); states are separated by a one-dot gap.

```bash
npm install
npm run dev
```

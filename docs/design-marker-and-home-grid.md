# Marker, free-form highlight & the home grid — UX review

*Drafted July 2026 in response to a fresh round of user feedback after
Release 2 shipped (D2 second band + D3 size marker, `docs/ux-action-plan.md`).
Three items, reviewed as a UX designer would: what the user actually needs,
what the app's own principles allow, and the smallest honest change that
delivers it.*

The three pieces of feedback:

1. **The size marker is loved — and used for more than sizes.** Rename it to
   something general (e.g. "markör").
2. **A more free-form marker** — mark a *specific instruction* (a sentence, a
   phrase), not just the whole line the band already covers.
3. **The home screen hides projects.** With more than ~3 active projects you
   can't see them all; the "Nytt projekt" button and the tool shortcuts get
   pushed off-screen. The user's sketch: lay the projects out as a **rutnät
   (grid)** instead of a tall stack of full-width rows.

All three are consistent with the design principles in
`docs/ux-action-plan.md §4` — keep the main surface clean, default stays
simple, the sofa is the benchmark (one-handed, mid-row, no reading). Nothing
here touches the core architecture.

---

## M1 — Rename "storleksmarkör" → **Markör** (the general marker)

### Why this is right
D3 shipped as "Märk din storlek", but the underlying primitive was never
about size — it's *"circle a spot on the pattern I want to keep an eye on."*
Users found the other uses on their own (a critical stitch count, the row a
chart repeat starts, "start decreasing HERE"). The name is now narrower than
the feature, which quietly discourages the very uses people like.

There's a happy domain resonance: in knitting, a **markör** is the little
ring you slip onto the needle to remember a spot. A digital marker you drop on
the pattern to remember a spot is the same idea — so "Markör / Markera" reads
as native vocabulary, not app jargon.

### The change is almost entirely copy
The data is already general: state lives in `viewState.markers` (not
`sizeMarkers`), and the mode is `markerMode`, not `sizeMode`. **No schema
change, no migration.** This is a naming/copy pass plus one CSS class rename.

| Surface | Today | Proposed |
|---|---|---|
| Sheet menu item (`PdfViewer.jsx`) | "Märk din storlek" | **"Markera"** |
| …its meta line | "Ringa in din siffra i '56 (60, 64, 68)' – tryck igen för att sudda" | **"Ringa in din storlek – eller vilken siffra eller rad du vill hålla koll på. Tryck igen för att sudda."** |
| Marker-mode toolbar label | "Tryck på din storlek – tryck igen för att sudda" | **"Tryck för att markera – tryck igen för att sudda"** |
| "Fler bandverktyg" tooltip | "Andra band och storleksmarkör" | **"Andra band och markör"** |
| CSS class | `.size-marker` / `.size-marker-editable` | `.marker` / `.marker-editable` |
| Code comments / `MARKER_PT` | "storleksmarkör" | "markör" (constant name already generic) |
| Docs (`ux-action-plan.md` D3 row) | "size marker" | note the rename; the feature is "the marker" |

Keep the *example* ("din storlek") in the meta line — it's still the most
common use and the fastest way to teach the gesture — but frame it as one
example, not the definition. That single wording change is what unlocks the
broader mental model.

---

## M2 — The free-form highlight: mark the *instruction*, not the line

This is the request D3's own design note anticipated:

> *"D3 is the scope-creep trap of this plan. Hold the line at 'circle a
> number': no ink, no text, no shapes. If users need more, that's a v3
> conversation."* — `ux-action-plan.md`, Workstream D

We are now in that conversation, and the need is specific and legitimate:
the **band** marks *the whole row I'm on* (transient, moves with me); the
**ring** marks *one point/number* (persistent). Missing is the middle: *"this
particular instruction — `öka 1 m i vart 4:e varv` — buried in a paragraph of
six sizes."* A knitter wants to underline the words they must follow, the way
they'd run a highlighter pen along one line of a printed pattern.

### The design tension (and how the app already resolved a twin of it)
The obvious implementation — drag a rectangle around the text — is exactly the
input the app **already rejected once**. D6 replaced the band's drag-grip with
tap-to-place-then-step because *"finger occlusion and fat-finger precision made
drag the wrong input"* on a phone. Drawing a tight 2-D box around small
pattern text one-handed on the sofa has the same failure. So a literal
"draw any shape" highlighter would violate the app's hard-won lesson and its
sofa benchmark.

### Recommended interaction — the highlighter *swipe* (one tool, two marks)
Fold this into the (now renamed) **Markera** mode instead of adding a tool.
Inside marker mode the gesture already splits on the existing
`MARKER_TAP_MOVE` (12 px) threshold — use it:

- **Tap** (movement < 12 px) → drops/erases a **ring**, exactly as today.
- **Swipe along a line** (movement ≥ 12 px, horizontal) → paints a
  **highlight bar**: a rounded, translucent pill from where you started to
  where you lifted, at a **fixed height** centred on the swipe.

Why this respects every constraint:

- **No 2-D precision.** You control only the *horizontal extent* (how far you
  swipe across the words) — a coarse, forgiving 1-D gesture. Vertical position
  and height are chosen for you (fixed line-height, snapped to the swipe's y),
  so there is no box to align. This is the highlighter-pen motion, not a
  drawing tool.
- **The gestures are already free.** Marker mode suppresses swipe-to-page-turn
  and double-tap-zoom (D3), so a horizontal drag has no other meaning to
  collide with — no new mode, no new button, main surface untouched
  (principle #1).
- **Erase is unified.** A tap on any existing mark (ring *or* bar) removes it,
  as rings do today. Nothing new to learn.
- **Holds a sensible line.** Single-line spans only. A two-line instruction is
  two swipes — cheaper to build and to understand than text-flow highlighting,
  and honest about the fact that the page is a rendered image with no text
  layer to reflow around. This is the *new* "hold the line": a highlighter,
  not a WYSIWYG annotator. No free ink, no typed notes, no arbitrary shapes.

### Data model (no migration, same as D3)
Make each entry in `viewState.markers[page]` a tagged shape; an entry with no
`type` is a ring (back-compat with everything already stored):

```js
// viewState.markers[page] = [
//   { x, y },                 // legacy ring — read as { type:'ring', ... }
//   { type: 'ring', x, y },   // circle a point (M1)
//   { type: 'bar', x, y, w }, // highlight span: centre x,y + width w (0–1)
// ]
```

`x, y, w` stay as document-coordinate fractions (0–1), so a bar rides zoom and
stays on its words exactly like the ring and the band. Height is a constant in
PDF points (a `MARKER_BAR_PT` sibling to `MARKER_PT`), so it scales with zoom
without being stored. Absent-field-reads-as-default is the same non-migration
pattern D3, D7 and D6 all used — backup/merge need no change.

### Colour & hierarchy
Keep bars in the marker family's amber (`.size-marker`'s orange), distinct
from the band pastels, so the three tools read as three jobs at a glance:
band = *where I am now*, ring = *this number*, highlight = *this instruction*.
Give the bar a slightly lower fill opacity than the ring's border so overlapping
a ring and a bar stays readable.

### If testing shows accidental bars
The 12 px threshold has protected taps well since D3, so the tap/swipe split
should hold. If mid-zoom pans leak into stray bars, the fallback is a small
sub-toggle in the marker toolbar ("○ ring / ▬ markera") rather than reworking
the gesture — but start without it; don't spend the clean surface speculatively.

---

## H1 — The home grid: show the projects, keep the tools in reach

### What's actually wrong
`HomeView` renders the rest-projects as `.card-list` — a vertical stack of
full-width rows (`min-height: 64px` each). The hero "Fortsätt sticka" card is
full-width and correct. But every additional project adds a full-width row, so
with 4–5 active projects the "Nytt projekt" primary and the whole shortcut grid
(Mönster, Färdiga projekt, Garnkorgen, Masktäthet, Måttbanken, Ditt stickår)
are pushed below the fold. The user's crossed-out sketch is exactly this: the
stack is eating the screen, and the fix is to lay the *rest* out as a **grid**.

### Recommendation
Keep the hero full-width — it's the primary "one tap back to my row" action and
deserves the width. Turn **"Fler pågående projekt"** from a 1-column list into a
**2-up responsive grid**, reusing the pattern already proven in the page gallery
(D7):

```css
.card-list {                        /* or a new .project-grid */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
```

`auto-fill, minmax(150px, 1fr)` gives two columns on a phone and more on a
tablet for free — same rule as `.gallery-grid`, so the app gains no new layout
idea, just applies an existing one. Two columns roughly **halves** the vertical
footprint of the project list, which brings "Nytt projekt" and the shortcuts
back near the top.

### The compact tile — keep what identifies a project, drop the rest
A grid tile has less room than a row, so spend it on what a knitter actually
scans by (the plan says this repeatedly: *knitters recognise yarn by sight,
not by name*):

- **Thumbnail** — the pattern cover, prominent (top of the tile or a large
  left square). This is the primary identifier.
- **Name** — clamped to 2 lines so long names don't blow out the row height.
- **The one number that matters** — "Varv: N" (current row), nothing else. No
  difficulty, no yarn, no second counter in the tile.
- **Project colour** — move it from the row's `border-left` spine to a top
  accent bar or a coloured thumbnail frame, since a grid tile has no tall left
  edge to spare.
- **Deadline** — the existing `DeadlineBadge` as a small corner chip; it
  already knows how to shrink.

Tiles stay full `<button>`s with a ≥ 44 px tap target and the same
`navigate('/projekt/:id')` behaviour — this is a layout change, not a data or
navigation change.

### Two decisions to make (with a recommendation)

1. **Always grid, or only past a threshold?** Recommend **always grid** the
   rest-projects. The hero already covers the "roomy, most important" case, so
   the rest are secondary by definition and read fine as tiles at any count —
   and one layout is simpler and more predictable than switching at N=3. (If
   the roomier row for the common 1–2-project case is missed in testing, an
   adaptive switch is a small follow-up, but start with the single path.)
2. **"Nytt projekt" as a grid tile?** Optional. A dashed "+" tile inside the
   grid is a familiar pattern and a nice second entry point, but keep the
   existing prominent primary button too — don't bury the main creation action
   to save a row. Recommend: keep the primary button as-is now; consider the
   "+" tile only if the grid still feels like it needs an in-context affordance.

### Trade-off to name honestly
A tile shows less text than a row (name may clamp; only one counter). For a
project switcher where the thumbnail does the identifying, that's an acceptable
— arguably better — trade: more projects visible, tools back in reach, and the
thing you recognise (the photo) gets *bigger*, not smaller.

---

## Sequencing

Smallest-first, each shippable alone:

1. **M1 (rename)** — copy + one CSS class. Hours, no risk, and it's the change
   that makes the marker's real value legible. Ship first.
2. **H1 (home grid)** — self-contained layout change in `HomeView` + CSS.
   Half a day; big daily payoff and directly answers the sketch.
3. **M2 (highlight swipe)** — the only one with new interaction logic
   (tap/swipe split, `bar` shape, render + hit-test). Design M1's copy so it
   already implies "mark things", then M2 slots under the same **Markera** name
   with no second rename.

M1 + M2 together retire "storleksmarkör" cleanly: one tool called **Markera**
that drops a **ring** on a number or a **highlight** along an instruction —
the general marker the user asked for, arrived at without a shape-drawing tool
the sofa would punish.

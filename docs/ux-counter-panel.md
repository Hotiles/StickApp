# Stickan — UX proposal: the counter panel vs. the pattern

*Drafted July 2026, in response to user feedback: "the counter section takes
up a lot of space and hides too much of the pattern — especially in landscape."
Companion to `docs/ux-action-plan.md` (extends Workstream C, the sofa session).*

---

## 1. Quantifying the complaint

The project view stacks four fixed-height bands vertically, identical in both
orientations (`.project-view` in `src/styles.css`, composed in
`src/projects/ProjectView.jsx`):

| Band | Height (approx.) | Source |
|---|---|---|
| Topbar | ~64 pt + safe-top | `.topbar`: 10+10 padding, 44 pt icon buttons |
| PDF viewport | *whatever is left* | `flex: 1` |
| PDF toolbar | ~49 pt | `.pdf-toolbar`: 2+2 padding, 44 pt buttons, border |
| Counter panel | ~92 pt + safe-bottom | `.counter-panel`: 10+10 padding, 72 pt min-height cards |

On a typical phone (390 pt viewport height in landscape, standalone PWA):

- **Portrait (844 pt tall):** fixed chrome ≈ 205 pt → the pattern gets
  ~640 pt, **~76 %** of the screen. The panel alone is ~11 %. Acceptable.
- **Landscape (390 pt tall):** the same 205 pt of chrome → the pattern gets
  ~185 pt, **under half the screen**. The counter panel alone eats ~24 %,
  and on phones with a notch the bottom safe-area inflates it further.

So the feedback is precise: the panel is not too big in general — it is too
big **as a horizontal band in a viewport where height is the scarce
dimension**. In landscape the width is abundant (~700–850 pt) and largely
wasted: three counter cards stretch to comical widths while the chart above
them is reduced to a letterbox slit.

## 2. What must not be broken

The counter panel's size is not accidental. Three constraints are core
promises of the app (README, knitter's review §3–§4):

1. **One tap = one row, always available.** Counting happens mid-row with
   hands full of wool. Any design where the counter must be summoned before
   it can be tapped turns one interaction into two or three, dozens of times
   per session.
2. **Big, blind-tappable targets.** The 72 pt cards with haptic feedback are
   praised in the review; they are tappable without looking. Shrinking them
   below ~56–64 pt breaks blind tapping (Apple/Android minimum is 44/48 pt,
   but "sofa precision" needs more).
3. **Glanceable state.** Target progress ("47 /120"), repeat status
   ("Varv 5 av 6", "Dags! ✨") and the lock must stay visible — they are what
   makes the counting *trustworthy* (Workstream B).

## 3. Options considered

### A. Hideable panel (user's own suggestion) — rejected as primary fix

A show/hide toggle adds a **mode**. Modes are paid for on every interaction:
unhide → tap → (hide again) is 2–3 gestures per row, and after resume the
user must remember which state they left the panel in. Auto-hide variants
(hide on pan/zoom, reappear on tap) make the layout jump underneath the
band-dragging gesture and cause mis-taps. The user's own instinct here is
right: "then you can't use it smoothly." A hide affordance can exist as a
*secondary* reading-mode refinement (§5) — never as the fix for landscape.

### B. Smaller counters everywhere — rejected

Punishes portrait (which is fine today) to fix landscape, and erodes the
blind-tappable targets that are the app's core ergonomic win. A few points of
padding can be trimmed, but no honest amount of shrinking recovers a
letterboxed chart: saving 20 pt still leaves the pattern under 55 % of a
landscape screen.

### C. Floating translucent counters over the PDF — rejected

Occlusion doesn't disappear, it just loses its border. Floating cards fight
with pan/pinch/band gestures on the same surface, invite accidental ticks
(the exact phantom-tap problem the lock B2 was built against), and
translucency destroys glanceability over a busy chart.

### D. Orientation-adaptive layout: side-dock the panel in landscape — **recommended**

In landscape, move the counter panel from the bottom edge to the **right
edge**, as a vertical column. Same components, same behavior, zero new modes
— just a different flex direction under `@media (orientation: landscape)`.

```
Portrait (unchanged)          Landscape (proposed)
┌──────────────────┐          ┌───────────────────────────────┐
│ topbar           │          │ topbar                        │
├──────────────────┤          ├───────────────────────┬───────┤
│                  │          │                       │ Varv  │
│                  │          │       PDF             │  47   │
│      PDF         │          │      viewport         ├───────┤
│    viewport      │          │                       │ Rapp. │
│                  │          │                       │  5/6  │
├──────────────────┤          ├───────────────────────┼───────┤
│ pdf-toolbar      │          │ pdf-toolbar           │ 🔒    │
├──────────────────┤          └───────────────────────┴───────┘
│ [Varv][Rapp][🔒] │
└──────────────────┘
```

Why this wins on every axis:

- **The pattern gets the height back.** Viewport goes from ~185 pt to
  ~277 pt on the reference phone — **+50 % pattern height**, with zero
  functionality removed. For charts (rows of stitches) vertical space is
  exactly what you want in landscape.
- **Tap targets get *bigger*, not smaller.** A right-edge column ~120–132 pt
  wide with 3 default counters gives each card ~90 pt of height — more than
  today's 72 pt. The thumb naturally rests at the phone's edge when holding
  it two-handed in landscape, so the right edge is *more* blind-tappable
  than today's centered bottom row.
- **Nothing to learn, nothing to toggle.** The panel is always there, in the
  orientation-appropriate place. Rotation is the "toggle", and it's one the
  user already performs deliberately.
- **Cheap and low-risk.** `CounterPanel`/`Counter` need no logic changes;
  this is a CSS restructure (`.project-view` becomes a row of
  `main + panel` in landscape) plus small card-layout tweaks
  (label/value/sub already stack vertically and fit a narrow card;
  `counter-minus` stays in the corner; the lock button becomes the column's
  bottom cell). Respect `env(safe-area-inset-right)` for notched phones.

Edge cases:

- **4–6 counters** (max is 6): cap the column cards at min-height 56 pt and
  let the column scroll vertically if they overflow — the same graceful
  degradation the bottom row already has horizontally. Default projects have
  3 counters and never hit this.
- **Handedness:** right edge suits the right-handed majority; if feedback
  asks, a "panel på vänster sida" toggle in Inställningar is a one-line
  `flex-direction: row-reverse`. Don't build it speculatively.
- **Tablets/very wide screens:** the same side-dock layout is strictly
  better there too; no special casing needed.

## 4. General trim ✅ *(shipped July 2026)*

Portrait was not the original complaint, but follow-up user feedback asked
for a general slimming of the counter row, so this went further than first
sketched:

- Panel padding 10 → 8 pt, card gap 8 → 6 pt, card inner padding 8 → 5 pt.
- Card min-height 72 → 60 pt (lock rail follows). Still comfortably above
  the 44 pt blind-tap floor, and cards with a sub-line grow from content
  (~73 pt) rather than being clipped — verified in-browser.
- Net effect: the row is ~16 pt slimmer for default counters (92 → 76 pt),
  ~10 pt slimmer when target/repeat sub-lines are showing.

Explicitly **not** trimmed: the 28 pt value digits (glanceability), the
lock rail width, the progress line.

## 5. Optional follow-up (Tier 2, only if feedback persists): reading strip

If users still want a "study the chart" state after D ships, add a manual
collapse — a chevron on the lock rail that folds the panel into a slim strip
(~28 pt) still showing live values read-only; one tap on the strip restores
it. Manual only (never auto-hide), persisted per project like
`countersLocked`. This is a refinement of a calm state, not a substitute for
D: counting must remain one tap away by default.

## 6. Recommendation

Ship **D (landscape side-dock) + §4 (portrait trim)** as one change:
"the panel respects the orientation". It answers the feedback directly
(+50 % pattern height in landscape), makes the counters *easier* to hit
rather than harder, introduces no modes, and touches only CSS and minor
markup. Defer §5 until real usage says it's needed.

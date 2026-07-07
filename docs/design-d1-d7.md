# D1 + D7 — Design: multiple pattern files & page gallery

*Settled July 2026 in design discussion with the user. Implements the
Release 2 items D1 and D7 from `docs/ux-action-plan.md`, which calls for
designing them as **one navigation model**.*

> **Status (July 2026):** D1 is **paused** — the user wants to validate the
> actual need with real users before building the multi-file model. D7
> **shipped standalone** against the single-file model, with one deliberate
> deviation from §4: the gallery lives inside `PdfViewer` (which owns the
> one document) instead of the parent view. Nothing else changed, and
> nothing needs rework when D1 lands — the parent-owned, multi-section
> gallery described below is the lift-out path. `band.lastMovedPage`
> shipped exactly as §5 describes (no schema migration; it lives inside
> `viewState.band` and `normalizeBand` backfills null).

---

## 1. The model: one map, two zoom levels

The knitter's reality (review §7): a "pattern" is a description PDF + a
chart PDF + a measurement schematic, and within each file you constantly
detour (page 2 → chart on page 6 → back to your row).

D1 fixes navigation *between files*, D7 navigation *within and across
files*. They share one mental model — **the map of my pattern** — at two
zoom levels:

- **Quick switcher** (D1): one tap to flip between files, each file
  restoring its own page/zoom/band exactly where you left it.
- **Page gallery** (D7): tap the page indicator to see every page of every
  file and jump directly, with "här är du" pointing back to your row.

With a single file, nothing changes anywhere — the default stays simple
(design principle #3).

---

## 2. Data model (D1)

The project's `patternId` + `viewState` pair becomes an ordered list:

```js
patternFiles: [
  {
    patternId,          // reference into the pattern library (unchanged)
    label: '',          // optional short label; '' = pattern's library name
    viewState: {        // same shape as today's project.viewState
      page, zoom, scrollX, scrollY,
      band,             // incl. new band.lastMovedPage (see §5)
      bandThickness,    // D6 override — now naturally per file
    },
  },
  // ...
],
activePatternFile: 0,   // index; resume returns to the file you were in
```

Decisions and rationale:

- **Per-file `viewState` is the payoff.** Switching Beskrivning → Diagram
  → back restores exact position in each. The band and D6's thickness
  override become per-file — correct, since a chart band and a
  text-line band have different thicknesses. D2 (second band) will build
  on the same per-file band state.
- **Labels are editable, defaulting to the pattern name** (user decision).
  Each ref has an optional short label edited in the Mönsterfiler sheet;
  empty falls back to the library name (truncated). Zero friction to
  start, one field to make tabs read "Beskrivning · Diagram". Renaming in
  the library still propagates wherever no label is set.
- **The pattern library is untouched.** Files live in the library; a
  project holds several references. A missing/deleted pattern degrades
  per file ("Filen kunde inte öppnas" on that tab), not per project —
  strictly better than today.

### Migration

Follows the B4 precedent — *the two shapes can never disagree*:

- **db v6** via `normalize.js`: `patternId` →
  `patternFiles: [{ patternId, label: '', viewState }]` (reusing the
  project's existing `viewState`); `patternId: null` → `[]`;
  `activePatternFile = 0`. The old `patternId` and root `viewState`
  fields are **removed**. Idempotent; reused on old-backup restore.
- **`merge.js` needs no logic change** — entities merge whole ("nyast
  vinner"); normalize both sides before merging. Add a merge test with
  mixed old/new shapes (the `storage/merge.test.js` model).
- **Backup `formatVersion` → 2** and test restore-from-old-backup
  explicitly, per the action plan's Workstream D note.

### Ripples

- `HomeView` project thumbnails read the **active** file (show the chart
  if that's where you knit), falling back to the first.
- `NewProjectModal` keeps its single pattern pick — casting on stays
  simple; more files are attached later from the project menu.
- `ProjectView`'s "Byt mönster" menu item becomes **"Mönsterfiler …"**:
  a sheet listing the project's files with add (from library), remove,
  reorder and label editing. Management UI never appears on the main
  surface (design principle #1).

---

## 3. Quick switcher UI (D1)

**A slim segmented strip docked directly above the existing
`pdf-toolbar`** (user decision), shown only when the project has ≥ 2
files.

- Bottom placement wins on the sofa test: thumb-reachable one-handed,
  unlike the top of the screen.
- One tap flips between files; the active segment is highlighted.
- Costs ~36 px of pattern height, and only in multi-file projects.
- Switching files persists `activePatternFile` through the existing
  debounced save, so resume returns to the right file *and* its position.

---

## 4. Page gallery (D7)

- **Entry:** the page indicator ("3 / 12") in the toolbar becomes a
  button. `PdfViewer` gets an `onOpenGallery` callback; the gallery is a
  separate sheet component owned by the parent view — it must span
  multiple documents, which `PdfViewer` (one doc) can't.
- **Content:** a thumbnail grid of all pages. Multi-file projects get one
  section per file with its label as header, and tapping any thumb
  switches file **and** page in one gesture — the gallery is the
  whole-pattern map. Single-file: just the grid, no headers.
- **Thumbnails:** generalize `src/pdf/thumbnail.js` into
  `renderPageThumb(doc, pageNum, width)`, rendered lazily as thumbs
  scroll into view, cached **in memory only** (small LRU). Persisting
  page thumbs would bloat IndexedDB and backups for no gain. Page counts
  are already stored (`pattern.pageCount`), so the grid lays out
  instantly with placeholders; non-active files' documents open lazily
  when the gallery opens.
- The standalone `PatternView` (library browsing) gets the single-file
  gallery for free.

---

## 5. "Här är du" (D7)

Two markers in the grid (user decision):

1. **Current page** — outlined. Orients you; standard grid behavior.
2. **The band's last-moved page** — band-colored badge. This is the
   return-trip marker: the band follows your knitting, so its last touch
   is your working page. Requires one tiny state addition,
   `band.lastMovedPage`, set on band drag-end and band-fit adjustments.

Rejected alternatives: badging *all* pages with stored band positions
(stale positions accumulate; the marker stops meaning "my row") and
current-page-only (useless for the exact detour scenario D7 exists for —
you open the grid *from* the detour page).

Per the action plan: if the grid alone proves insufficient for the return
trip, a dedicated back-affordance can be added later — start simple.

---

## 6. Build order

1. **D1** — schema + migration (db v6, backup v2, merge test), file
   management sheet, switcher strip, ripples (HomeView, resume).
2. **D7** — gallery sheet on top of D1's list, thumbnail generalization,
   `band.lastMovedPage`, PatternView hookup.

Shippable separately, as the action plan intends, but designed here as
one navigation model.

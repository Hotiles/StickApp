# Stickan — UX action plan (response to the knitter's review)

*Drafted July 2026, based on `docs/review-knitter.md` plus subsequent direct
user feedback (marked "user feedback" in the tables). This plan translates the
feedback into grouped improvement workstreams, each anchored in the underlying
user need rather than the individual feature request.*

---

## 1. What the review is actually telling us

Reading past the nineteen wishlist items, the review makes **three root
diagnoses**. Every item falls out of one of them:

1. **The app treats a project as an archive, but a project is a living
   document.** Notes, yarn, dates, statuses — everything you scribble on a
   project *while knitting it* is locked behind "Markera som färdigt" or
   missing entirely (review §1, §5, §6; wishlist 2, 3, 11, 18).

2. **Counting must be trustworthy, or it is worse than paper.** Counters that
   don't know about each other, a single repeat rhythm, resets that erase
   history, phantom pocket-taps — each one is a way the app can be *quietly
   wrong*, which the reviewer correctly calls "the worst kind of wrong"
   (review §3, §4, §5b; wishlist 4, 5, 6, 9, 10).

3. **The physical context is a sofa, not a desk.** Hands full of wool, phone
   untouched for twenty minutes, patterns that are three PDFs and a
   photographed magazine page from 1987 (review §2, §7, §8; wishlist 1, 7, 8, 15).

The good news is equally clear: the reviewer confirms the hard, risky parts —
band, resume, offline-first, counter ergonomics — are right. Nothing in this
plan touches the core architecture. This is about **finishing the workflows
around a core that already works.**

One code-level confirmation worth noting: the reviewer guessed that "the
fields already exist in the data model; they're just locked in the wrong
room" — and she's right. `createProject()` in `src/storage/storage.js`
already initializes `yarn`, `yarnAmount`, `needleSize`, `madeSize`,
`difficulty`, `notes` and `photoBlobIds` at creation. Several Tier 1 items
are UI unlocks, not schema work.

---

## 2. The improvement workstreams

Six groups. Each is a coherent piece of UX that can be designed, built and
shipped as a unit. Review/wishlist references in parentheses.

---

### Workstream A — The living project

> **Underlying need:** "Let me write things down while I knit, and let the
> project's story (started, paused, frogged, finished) be visible and true."

This is the reviewer's #1 complaint and the cheapest big win, because the
data model already supports most of it.

| # | Change | Detail | Review ref |
|---|--------|--------|-----------|
| A1 ✅ *(shipped July 2026)* | **Projektinfo editable from cast-on** | Auto-saving "Projektinfo" sheet (notes first — scribble, not form) opened in one tap via a pencil button in the project topbar, plus a menu entry. Shared `ProjectInfoFields`; FinishForm is now a thin wrapper adding the finish date and status change. | §1, wish 2 |
| A2 ✅ *(shipped July 2026)* | **Started/finished dates** | Set `startedAt` at creation, `finishedAt` on finish; both editable (people mark things finished weeks late). Backfill in db migration v3 (and on old-backup restore): `startedAt = createdAt`, `finishedAt = updatedAt` for already-finished projects, flagged `datesEstimated` and shown with ≈. F1's date keying shipped in the same change. | §5, wish 3 |
| A3 | **Project statuses: `vilar` and `rivdes upp`** | Extend `status` beyond pågående/färdigt. "Vilar" collapses the project into a separate, quieter section on the home screen (out of the way, never in your face, one tap to wake). "Rivdes upp" keeps history and notes-to-self ("the lessons of the ones that didn't make it") in the gallery with distinct visual treatment. | §6, wish 11 |
| A4 | **Recipient link** | Optional reference from project → person in Måttbanken. Gives gift history per person and puts their measurements one tap from the pattern. Small, but it makes Måttbanken and projects feel like one app. | wish 18 |

**Design notes**
- A1 must feel like *scribbling*, not form-filling: notes field first and
  auto-saving, opened in one tap from the project view. The reviewer's use
  case is "left sleeve: decreased at row 38 — do the same on the right!"
  typed one-handed mid-row. Consider a timestamped notes area (append-style)
  rather than a single mutable blob, so mid-project notes read as a log.
- A3 home screen: pågående projects first, "Fortsätt sticka" hero unchanged;
  vilande in a collapsed "Vilar (3)" row below. Status change lives in the
  same project menu as Projektinfo.
- **Dependency:** A2 is a prerequisite for the honest statistics in
  Workstream F.

---

### Workstream B — Counting you can trust

> **Underlying need:** "The counters must never be quietly wrong, and they
> must express how patterns actually shape garments."

This is the workstream with the highest knitting-domain depth. Do it in two
passes: integrity first (B1–B3), expressiveness second (B4–B5).

| # | Change | Detail | Review ref |
|---|--------|--------|-----------|
| B1 ✅ *(shipped July 2026)* | **Linked counters** | A counter can follow a primary counter ("Följ en annan räknare …" in the long-press menu): plus/minus on the primary ticks followers symmetrically; ticks directly on a follower never propagate. No chains, max one primary per project — enforced by the candidate list, not by rules the user has to learn. Follower marked with a small chain glyph. Reset never propagates. Pure logic in `counters/tick.js` with unit tests. | §3, wish 4 |
| B2 ✅ *(shipped July 2026)* | **Counter lock** | Padlock button at the edge of the counter panel making all counters read-only (minus hidden, taps shake the card and pulse the padlock, long-press menus off — the padlock is the single way out). Persisted per project (`countersLocked`) so it survives backgrounding/restart, like highlight tape stays on. | wish 5, small obs. |
| B3 ✅ *(shipped July 2026)* | **Accumulated history (`totalTicks`)** | Per-counter lifetime tick count that survives resets. Plus increments, minus decrements (a miscount was never a knitted row), reset doesn't touch it. Invisible in the counter UI; feeds "räknade varv" in stats. Backfilled `totalTicks = value` in db v4 + on old-backup restore. | §5b, wish 10 |
| B4 ✅ *(shipped July 2026)* | **Shaping sequences** | Repeat is now an ordered sequence of steps `[{every: 4, times: 3}, {every: 6, times: 4}]`. Single rhythm stays the simple default (one open-ended step, displayed exactly as before); "Lägg till steg" in the Upprepning dialog reveals the step editor, whose read-back preview ("vart 4:e varv 3 ggr, sedan vart 6:e varv 4 ggr — sista åtgärden på varv 36") is the receipt that the pattern was entered right. Sequence counters show the absolute next action ("Nästa på varv 18 · steg 4 av 7"), light up "Dags! ✨" on action rows — haptics included, also through linked counters — and go quiet with "Formningen klar · 7 av 7" after the last one. Pure logic in `counters/sequence.js` with unit tests; migration in db v5 + old-backup restore (`repeatEvery: 6` → `[{every: 6, times: null}]`, field removed so the two shapes can never disagree). | §4, wish 6 |
| B5 ✅ *(shipped July 2026)* | **Total and repeat shown together** | With both target and repeat set, the total ("47 /120") is the big number and the repeat position the sub-line ("Varv 5 av 6 · Dags! ✨"). Repeat-only counters keep the repeat position as the main number — a pure pattern-repeat counter is *about* the position. | small obs., wish 9 |

**Design notes**
- B1 setup lives in the existing long-press menu ("Följ Varv-räknaren"), so
  the main surface stays clean — the reviewer explicitly praised that
  economy; don't spend it.
- Linked counters change the failure mode from "forgot to tap the second
  counter" to "tapped the primary when only the follower should move." Ticking
  a follower directly must therefore still work (it just doesn't propagate),
  and the link should be visually indicated (small chain glyph) so the
  behavior is never surprising.
- B4's data migration: `repeatEvery: 6` → `sequence: [{every: 6, times: null}]`
  (open-ended). The merge logic in `storage/merge.js` needs to handle both
  shapes during transition.

---

### Workstream C — The sofa session

> **Underlying need:** "For twenty minutes at a time I look at the screen
> constantly and touch it never. Respect that."

Small workstream, huge daily impact — the reviewer put it at wish #1.

| # | Change | Detail | Review ref |
|---|--------|--------|-----------|
| C1 ✅ *(shipped July 2026)* | **Wake lock in the project view** | `navigator.wakeLock` acquired when a project (pattern open) is active, released on navigation away/backgrounding, re-acquired on visibilitychange. Toggle in Inställningar (default **on**) for battery-anxious users. Graceful no-op where unsupported. | §2, wish 1 |
| C2 | **Session-hardening pass** | While in there: verify resume flush on `visibilitychange` also runs before wake-lock release, and confirm the counter-lock state (B2) persists across resume. Bundle as one "the phone behaves on the sofa" QA pass. | — |

**Design notes**
- This is deliberately its own workstream despite its size: it's the top of
  the reviewer's list, it's ~20 lines, and it ships value on day one. Never
  let a two-day fix wait for a two-month workstream.

---

### Workstream D — Real patterns are messy

> **Underlying need:** "My pattern is three PDFs, a schematic, and a photo of
> a magazine page — and I mark it up before I cast on."

This extends the pattern/viewer layer the reviewer called the app's best
asset. Highest technical risk of the six groups (viewer state, band storage,
backups all touched), so it deserves its own design spike before commitment.

| # | Change | Detail | Review ref |
|---|--------|--------|-----------|
| D1 | **Multiple pattern files per project** | Project holds an ordered list of pattern references instead of one `patternId`. Quick switcher (segmented control or tab strip: "Beskrivning · Diagram · Måttskiss") in the pattern view. Each file keeps its own `viewState` (page, zoom, scroll, band). Migration: existing `patternId` → list of one. | §7, wish 7 |
| D2 | **A second band** | Two independently colored/positioned bands per file (chart row + written-instruction line). Reuses the existing document-coordinate machinery wholesale. Second band is opt-in ("Lägg till band" in band settings) so the default stays one-band simple. | §8, wish 8 |
| D3 | **Tap-to-highlight size marker** | Lightweight annotation: tap to drop a small circle/highlight in document coordinates, for marking your size in "56 (60, 64, 68) sts" through a whole pattern. Explicitly *not* free-form drawing — dots and short highlights only, erasable by tapping again. Stored like band positions. | §8, wish 8 |
| D4 | **Image patterns** | The promised v1.1: import one or more photos as a multi-page "pattern" with the same band, zoom and resume behavior. Reuse the PDF viewer's page abstraction with an image page source. | wish 15 |
| D5 | **Library search + tags** | Name search across folders (instant filter on the existing list), plus a small fixed tag vocabulary (garment type, yarn weight). Folders stay; search complements them. | §7, wish 14 |
| D6 ✅ *(shipped July 2026)* | **Band thickness per project, adjusted in place** | "Passa in bandet" mode from the band controls in the toolbar: −/+ step the thickness 2 pt per tap (hold to repeat, accelerating), **edge-anchored** — the top/left edge stays put, so you align it on the row by moving the band, then tap until the other edge matches. Mode exits via Klar or any page change; band gets crisp edge lines while active. Saved as `viewState.bandThickness` (pt) only once the user actually adjusts, so Inställningar remains the default for new projects. *(v1 shipped a drag-grip on the band's edge; replaced after UX review — finger occlusion and fat-finger precision made drag the wrong input for edge-matching on a phone, and a permanent second handle invited accidental resizes.)* | user feedback |
| D7 | **Page gallery for direct navigation** | Real patterns send you from page 2 to the chart on page 6 and back; step-by-step paging makes that a chore. Tap the page indicator to open a thumbnail grid of all pages and jump directly. Reuse the existing thumbnail renderer (`src/pdf/thumbnail.js`) with lazy, cached page thumbs. Mark the band's page in the grid ("här är du") so the trip *back* to your row is one obvious tap. | user feedback |

**Design notes**
- Sequence *within* the workstream: D6 first (small, self-contained, daily
  pain), then D1 (it changes the project↔pattern relationship everything
  else builds on), then D7 and D2/D3 (shared annotation/navigation surface —
  design them together even if shipped apart), then D4, D5.
- D6 follows the pattern the reviewer singled out as the app's proof of
  craft: state that belongs to *this pattern* lives with the project, not in
  global settings. Band position already works that way; thickness should
  too. Same future rule for any per-document tunable (opacity could get the
  same override later if asked for — don't build it speculatively).
- D7 doubles as the temporary-detour fix: "check page 6, come back to my
  row." Highlighting the band's page in the grid makes the return trip
  self-evident without inventing a separate "back to my row" button. If the
  grid alone proves insufficient, a back-affordance can be added later —
  start with the simpler thing.
- D3 is the scope-creep trap of this plan. Hold the line at "circle a number":
  no ink, no text, no shapes. If users need more, that's a v3 conversation.
- Backup format must version-bump for D1/D4; test restore-from-old-backup
  explicitly (the merge tests in `storage/merge.test.js` are the model).

---

### Workstream E — Yarn and gauge that answer real questions

> **Underlying need:** "Can I cast on tonight without buying anything — and
> will it fit when I'm done?"

The stash and the gauge calculator each work in isolation; the review's point
is that they don't participate in the project workflow.

| # | Change | Detail | Review ref |
|---|--------|--------|-----------|
| E1 | **Structured yarn amounts** | Optional structured fields on stash entries (skeins / grams / meters) alongside the free-text amount. Free text remains valid — never force re-entry of an existing stash. | §9, wish 12 |
| E2 | **Project ↔ stash link** | A project can reference stash yarns ("stickas i: Ljunglila"). Stash entry shows "används i Vantar till mamma." On finish, offer one-tap deduction: "Använde 3 nystan?" pre-filled from the project's yarnAmount. Deduction is always confirm-first, never automatic. | §9, wish 12 |
| E3 | **Gauge comparison (the pattern direction)** | Second mode in GaugeCalculator: pattern gauge vs. my gauge → "ditt 50 cm-stycke blir 45,8 cm — överväg storlek L eller grövre stickor." This is the direction published patterns need. | §10, wish 13 |
| E4 | **Persist calculator inputs + saved swatches** | Last inputs survive navigation (settings-level persistence). "Spara provlapp" attaches a swatch record (yarn, needle, washed/unwashed, counts) to a stash yarn or project — the digital swatch notebook. | §10, wish 13 |

**Design notes**
- E2's linking UI should live in Projektinfo (A1) — one more reason A ships
  first. The picker shows stash photos, because knitters recognize yarn by
  sight, not by name.
- Keep the stash's identity: "a photo gallery that happens to know amounts,"
  not an inventory system. The review praised the current restraint.

---

### Workstream F — A record you can trust (and show off)

> **Underlying need:** "The yearly record must be true, and then it's worth
> celebrating."

Ordered dependency: honesty first (F1 — mostly consuming A2 and B3), delight
after. Never ship the wrap-up card while the stats still lie.

| # | Change | Detail | Review ref |
|---|--------|--------|-----------|
| F1 ✅ *(shipped July 2026)* | **Honest statistics** | "Ditt stickår" and "Färdigt per år" keyed on `finishedAt` (A2), never `updatedAt`. "Räknade varv" from `totalTicks` (B3), never current values. Projects with estimated backfilled dates marked subtly. | §5, wish 3+10 |
| F2 | **Deadline math** | Deadline badge + row target → "≈ 9 varv per dag till jul." Only shown when both exist; tone stays whisper, not nag. | wish 17 |
| F3 | **Time-on-project** | Rough automatic tracking of time with the project open (resume machinery already knows the sessions). Shown on the finished card: "127 timmar." No timers, no start/stop UI. | wish 16 |
| F4 | **Yearly wrap-up share card** | "Ditt stickår 2026" image via the existing share-card machinery: projects finished, rows counted, meters of yarn (if E1 data exists). The app's best word-of-mouth feature, gated on F1. | wish 19 |

---

### Workstream 0 — Foundation hygiene (parallel, ongoing)

Not a UX group, but the review flags it and it guards everything else:

- **Backup memory limits on iOS** — the review: "fix that one before
  someone's pattern collection depends on it." Stream the zip instead of
  building it in memory. This protects the only safety net and rises in
  urgency as D1/D4 grow libraries.
- **Migrations + merge tests** for every schema change above (statuses,
  dates, sequences, multi-file). Each workstream lands with its migration and
  a `merge.js` test, so the deferred cloud sync stays viable.

---

## 3. Sequencing — four releases

The workstreams are the *design* units; releases cut across them so each
release passes a recognizable user test.

### Release 1 — "The sofa test" *(reviewer's Tier 1, verbatim)*
> After this release the reviewer hands the app to her knitting circle.

- C1 Wake lock ✅
- A1 Projektinfo from cast-on ✅
- A2 Started/finished dates (+ F1 stats fix — done in the same change) ✅
- B1 Linked counters ✅
- B2 Counter lock ✅
- B3 `totalTicks` ✅ *(landed with B1/B2 — "räknade varv" now reads it, completing F1)*
- B5 Total/repeat display fix ✅
- D6 Band thickness per project ✅

Small, sharply-scoped items; roughly the "weekend of work" the review
estimates, plus migrations. Ship it as one visible release — it directly
answers the review's headline criticism.

**Release 1 is complete (July 2026).** Time to hand the app back to the
reviewer and ask for the re-review against her own Tier 1 list (§5).

### Release 2 — "Real patterns" *(Tier 2)*
- B4 Shaping sequences ✅
- D1 Multiple files per project
- D7 Page gallery (shares the document-navigation surface with D1's file
  switcher — design them as one navigation model)
- D2 Second band + D3 size marker
- Workstream 0: streamed backups (before libraries grow)

### Release 3 — "The ecosystem" *(Tier 3)*
- A3 Statuses (vilar / rivdes upp)
- E1–E4 Stash links + gauge both directions + swatches
- D5 Library search + tags
- D4 Image patterns

### Release 4 — "Delight" *(Tier 4)*
- F2 Deadline math, F3 time-on-project, F4 wrap-up card
- A4 Recipient link

*(A3 and D4 are deliberately later than their workstream siblings: statuses
matter once people have project **history**, and image import benefits from
D1's multi-file plumbing. If user feedback screams earlier, both can be
pulled forward without dependency trouble.)*

---

## 4. Design principles to hold while executing

Distilled from what the review *praised*, so we don't lose it while fixing
what it criticized:

1. **Keep the main surface clean.** Every new feature (links, sequences,
   second band, annotations) enters through the existing long-press/overflow
   pattern. The reviewer loved that the counter face stays minimal.
2. **Never be quietly wrong.** Any state that can drift (linked counters,
   deductions, backfilled dates) is visibly indicated and manually
   correctable. Confirm-first for anything destructive or numeric.
3. **The default stays simple.** Sequences, second bands, structured amounts
   are all opt-in reveals. A garter-scarf knitter should never see raglan
   machinery.
4. **Offline, local, no accounts** — unchanged. Every schema change ships
   with its migration and merge test so the sync option stays open.
5. **The sofa is the benchmark.** Every interaction in the project view must
   work one-handed, mid-row, without reading. If it needs two hands, it goes
   behind a menu.

## 5. How we'll know it worked

- The reviewer's bottom line was conditional: *"Tier 1 … turns this from
  'impressive' into 'the app I tell my knitting circle to install'."*
  Release 1 is scoped exactly to that condition — after shipping, ask her to
  re-review against her own list.
- Concrete checks per root diagnosis:
  - *Living project:* a mid-project note ("left sleeve: row 38!") can be
    written in ≤ 3 taps from the chart.
  - *Trustworthy counting:* a raglan with simultaneous neck + armhole shaping
    is trackable with one tap per row, and a reset no longer changes yearly
    stats.
  - *Sofa context:* the screen never sleeps during a 20-minute chart session,
    and a phone in the project bag knits zero phantom rows.

# Stickan — a knitter's review

*Reviewed July 2026, from the perspective of a long-time knitter (garter-stitch
scarves through steeked colorwork cardigans). I reviewed the app the way I'd
review a pattern: by checking whether it holds up on the sofa, mid-row, with a
sleeping child on one arm — not just whether it demos well.*

---

## The short version

Stickan understands knitting better than most knitting apps I've paid money
for. The row counters and the highlight band are clearly designed by someone
who has actually knitted from a chart, and "resume exactly where I was" is the
single most important promise a knitting app can make — this one keeps it.

But it has one blind spot that runs right through the middle of the app:
**it treats a project as something you document when it's *finished*, when in
reality a project is something you scribble on constantly while it's *alive*.**
No notes, no yarn details, no start date until you press "Markera som färdigt".
That, plus a handful of counter limitations you'll hit on your first sweater
with simultaneous neck and armhole shaping, is what keeps this from being the
app I'd hand to everyone in my knitting circle without caveats.

Details below, honestly, both directions.

---

## What it genuinely gets right

**The counters are the best I've used in an app.** Big tap targets you can hit
without looking, haptic tick, and — bless whoever decided this — a visible
minus button, because tinking back a row is not an edge case, it's Tuesday.
The long-press menu (back one / reset / rename / target / repeat) keeps the
main surface clean. Targets show "47 / 120" with a progress line, and the
repeat counter ("increase every 6th row") shows where you are *within* the
repeat and lights up on the action row with "Dags! ✨". That is exactly the
mental load a repeat counter should carry for you. The little celebration
every ten rows is silly and I love it.

**The band is the right metaphor, correctly implemented.** It's the magnet
board / highlighter tape we all use, digitized. It's anchored to document
coordinates, so when you pinch-zoom into a stranded chart the band stays on
your row — this is the detail that separates apps made *by* knitters from
apps made *at* knitters. Position is remembered per page, it flips to
vertical (chart columns, or marking your size in a schematic), and thickness
and opacity are adjustable so you can match it to one chart row. Keyboard
nudging is a thoughtful touch.

**Resume actually works.** Page, zoom, scroll position, band, counters — all
saved continuously and flushed when the app is backgrounded. You put the
phone down mid-sleeve for three weeks, open the app, and you are looking at
the same chart row with the same counts. The "Fortsätt sticka" hero card on
the home screen takes you there in one tap. This is the core loop and it's
solid.

**Offline-first is the right architecture for knitting.** Knitting happens in
summer cottages, on planes, in waiting rooms. No account, no cloud, no
spinner. Everything on the device, with a proper zip backup (and a backup
nag after 30 days — good, because "my phone died and my pattern notes went
with it" is a genuine tragedy).

**The dark mode dims the PDF.** Evening knitting in front of the TV without a
white A4 rectangle burning your retinas. Small thing, real thing.

**The satellite features are sensibly scoped.** The measurement bank ("mamma's
foot length, 24 cm") solves an actual recurring problem — no more digging
through two years of text messages. The stash gets a photo, colorway, and
amount without pretending to be a Ravelry database. The finished gallery
captures yarn, amount used, needles, size knitted, difficulty and notes-to-
self, which is precisely what future-you needs when someone says "can you
make me one too?". The share card for finished projects is a nice bit of joy.

**The gauge calculator does honest arithmetic** — swatch per 10 cm plus
desired measurement gives stitches to cast on and rows to knit, with comma
decimals accepted like a proper Swedish app.

---

## Where it falls short — the honest part

**1. You can't write anything down on a project until it's finished.**
This is my biggest complaint, and it's a workflow flaw, not a missing luxury.
Notes, yarn, needle size — the FinishForm fields — only exist behind
"Markera som färdigt". But a knitter knows the yarn and needle size *at
cast-on*, and the notes that matter ("switched to M1L", "knitted body 2 cm
shorter", "left sleeve: decreased at row 38, not 40 — do the same on the
right!") are written *mid-project*. Right now that second sleeve note has
nowhere to live. The fields already exist in the data model; they're just
locked in the wrong room.

**2. The screen goes to sleep while your hands are full of wool.**
There is no wake lock. Knitting from a chart means glancing at the screen
every few stitches for twenty minutes while never touching it — exactly the
usage pattern that makes the phone dim and lock. Every serious row-counter
app keeps the screen awake in the pattern view; the Web Wake Lock API exists
and this app doesn't use it. As it stands you'll be nose-tapping your phone
awake with a cable needle in your teeth.

**3. Counters don't know about each other.**
Each counter is an island. In practice, the "increase every 6th row" repeat
counter and the main row counter *are the same physical row* — but here you
must remember to tap both, and the moment you tap one and not the other your
tracking is quietly wrong (the worst kind of wrong). Linked counters — tick
the row, the repeat and the "total rows this section" tick along — are the
established solution and the single biggest counter improvement available.

**4. One repeat rhythm per counter can't express real shaping.**
"Every 6th row" is lovely until the pattern says *"decrease every 4th row 3
times, then every 6th row 4 times"* — which is roughly every raglan and
every sleeve ever written. A single `repeatEvery` number can't carry a
compound sequence, so you're back to pencil tally marks for exactly the rows
where mistakes are most expensive.

**5. Finished projects have no dates, and the yearly stats quietly lie.**
There's no started/finished date on a project. "Ditt stickår" counts a
project in the year of its **updatedAt** — so when you open a 2024 sweater
next January to fix a typo in the notes, it migrates into 2026's statistics.
For a feature whose whole point is the year-by-year record, that's a real
data-integrity problem, not a nitpick. Likewise "räknade varv" sums the
counters' *current* values, so resetting a counter (or using it for repeats
rather than rows) silently rewrites history.

**6. Only "pågående" and "färdigt" exist. Where does the hibernating sweater go?**
Every knitter has a project in time-out — wrong yarn, boring body, mystery
mistake. With only two statuses, your shame pile sits on the home screen
between you and your active projects forever, or gets deleted (losing its
history). A "vilar" (hibernating) status — and honestly a "rivs upp"/frogged
one — reflects how projects actually live.

**7. One PDF per project.**
Modern patterns routinely ship as several files: written instructions +
separate A4 charts + a schematic. A project holds exactly one pattern here,
so you'll be juggling. (Related: the pattern library has no search — with two
users and thirty patterns that's fine today, but folders alone stop scaling
around pattern #50.)

**8. The band is the only mark you can make on a pattern.**
The first thing I do with a new multi-size pattern is highlight my size all
the way through — every "56 (60, 64, 68) sts" needs a circle around one
number. There's no way to do that here, and no second band either (working a
chart while also tracking your place in the written instructions two pages
away means dragging the one band back and forth).

**9. The stash and the projects don't talk to each other.**
The stash is a pleasant photo gallery, but yarn amount is free text
("4 nystan / 200 g"), so nothing can be deducted when you knit, and a project
can't point at the stash entry it's consuming. The moment you wonder "do I
still have enough of the Ljunglila for mittens?" you're counting skeins in
the closet again — the exact trip the feature exists to save.

**10. The gauge calculator only solves the easy direction.**
Swatch → cast-on numbers is the direction you need for improvised scarves and
blankets. The direction you need for *published patterns* is: "pattern wants
22 sts/10 cm, I'm getting 24 — how far off will the finished measurement be,
and at which size/needle should I knit instead?" Also, the calculator
forgets its inputs the moment you navigate away, and a swatch you measured
can't be saved to the yarn or project it belongs to — knitters keep swatch
notebooks for a reason.

**Smaller observations, quickly:** no protection against pocket-taps
incrementing a counter (a tiny lock toggle in the project view would do);
counter with both a target *and* a repeat shows only the repeat position
prominently, so "row 47 of 120" disappears exactly when the counter got more
complicated; no image import for patterns (promised for v1.1 — many older
patterns are photos of a magazine page); Web Share Target not working on iOS
is Apple's fault, not yours, and the file-picker fallback is fine.

To be fair about scope: cloud sync being absent is a documented v1 decision
with the merge logic already built and tested — that's the right way to defer
it. And the tech-debt list in the README is refreshingly honest, including the
warning that backups (the only safety net) can hit memory limits with a big
library on iOS. Fix that one before someone's pattern collection depends on it.

---

## Wishlist

Prioritized, from "this changes whether I recommend the app" down to "would
delight me".

### Tier 1 — the sofa test (do these first)

1. **Keep the screen awake in the project view.** Wake lock while a pattern
   is open, released on navigation away, with a small toggle in Inställningar
   for battery-anxious users. This is a ~20-line change that removes the
   single most common physical annoyance.
2. **Project notes and details from cast-on, not from cast-off.** Make the
   FinishForm fields (yarn, needles, size, notes, photos) editable on an
   ongoing project — a "Projektinfo" item in the project menu is enough. The
   notes field is the second-sleeve insurance policy; it must exist while the
   first sleeve is on the needles.
3. **Started/finished dates on projects.** Set `startedAt` at creation and
   `finishedAt` when marked done (both editable, since we all mark things
   finished three weeks late). Base "Ditt stickår" and "Färdigt per år" on
   `finishedAt`, never `updatedAt`.
4. **Linked counters.** "When *Varv* ticks, also tick *Raglan* and
   *Knapphål*." One primary counter, others follow. This removes the
   forgot-to-tap-the-second-counter failure mode entirely.
5. **A counter lock.** One padlock toggle that makes counters read-only, so
   a phone dropped in the project bag doesn't knit fourteen phantom rows.

### Tier 2 — real patterns are messier than the demo

6. **Shaping sequences.** Let a repeat be a sequence: "every 4th × 3, then
   every 6th × 4", displayed as "next: decrease at row 31 · step 2 of 7".
   This covers sleeves, raglans, waist shaping — the majority of garment
   knitting.
7. **Multiple pattern files per project.** A project should hold a small list
   of PDFs (instructions / charts / schematic) with quick switching, each
   with its own band and remembered position.
8. **A second band, or simple annotations.** Two independently colored bands
   (chart + written instructions), and ideally a tap-to-highlight marker for
   circling your size through a multi-size pattern. Store them in document
   coordinates like the band already does.
9. **Show total and repeat position together.** When a counter has both a
   target and a repeat, keep the total ("47/120") as the big number and the
   repeat position as the sub-line — the total is what you compare against
   the pattern.
10. **Accumulated row history.** A per-counter `totalTicks` that survives
    resets, so "räknade varv" in the stats becomes trustworthy and reset
    stops meaning "erase my year".

### Tier 3 — the ecosystem around the needles

11. **Hibernating and frogged statuses.** "Vilar" hides a project from the
    home screen without deleting its history; "rivdes upp" keeps the record
    (and the lessons) of the ones that didn't make it.
12. **Connect stash to projects.** Let a project reference stash yarns, add
    optional structured amount (skeins/grams/meters) to stash entries, and
    offer "used 3 skeins" deduction when finishing. Then the stash answers
    its actual question: *what can I cast on tonight without buying
    anything?*
13. **Gauge calculator, both directions.** Add pattern-gauge vs. my-gauge
    comparison ("your 50 cm piece will come out 45.8 cm — consider knitting
    size L or going up a needle"), persist the last inputs, and allow saving
    a swatch (yarn, needle, washed/unwashed, counts) to a yarn or project.
14. **Search in the pattern library**, plus a few tags (garment type, yarn
    weight). Folders stop being enough right around the moment the app
    becomes indispensable.
15. **Image patterns (the promised v1.1).** Half the treasured patterns in
    any Swedish knitting family are a photographed magazine page from 1987.
    Import photos as a multi-page "pattern" with the same band and resume
    behavior.

### Tier 4 — delight

16. **Time-on-project.** Rough, automatic (time with the project open),
    shown on the finished card: "127 hours". Wildly motivating, mildly
    horrifying.
17. **Deadline math.** The deadline badge already counts days; with a row
    target it could whisper "≈ 9 varv per dag till jul" — knitting a
    Christmas sweater is a burn-down chart whether we admit it or not.
18. **Recipient link.** Finished projects could reference a person from the
    Måttbanken ("stickat till mamma"), giving both a gift history per person
    and their measurements one tap from the pattern.
19. **Yearly wrap-up share card.** The stats page already has the numbers;
    a "Ditt stickår 2026" image via the existing share-card machinery would
    be the app's best word-of-mouth feature.

---

*Bottom line: the hard parts — the band, the counters, resume, offline — are
built, and built well. What's missing is mostly the lived-in mess of real
projects: notes while you knit, shaping that changes rhythm, the sweater in
time-out. Tier 1 is a weekend of work and turns this from "impressive" into
"the app I tell my knitting circle to install".*

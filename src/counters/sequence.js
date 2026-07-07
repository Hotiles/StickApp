/*
 * Formningssekvenser (B4). Ren logik utan IO- eller React-beroenden —
 * enhetstestas i sequence.test.js och används av Counter, CounterPanel
 * och tick.js.
 *
 * En sekvens är en ordnad lista steg { every, times }: "öka vart 4:e varv
 * 3 ggr, sedan vart 6:e varv 4 ggr" = [{every: 4, times: 3}, {every: 6,
 * times: 4}]. times = null betyder "tills vidare" och är bara meningsfullt
 * i sista steget. Den gamla enkla rytmen repeatEvery: 6 motsvarar
 * [{every: 6, times: null}] — counterSequence läser båda formerna så att
 * odmigrerad data (gamla backuper mitt i en återläsning) aldrig tappar
 * sin upprepning.
 */

/** Sekvensen för en räknare, eller null. Läser `sequence`, faller tillbaka på gamla `repeatEvery`. */
export function counterSequence(counter) {
  if (Array.isArray(counter?.sequence) && counter.sequence.length > 0) return counter.sequence;
  if (counter?.repeatEvery >= 1) return [{ every: counter.repeatEvery, times: null }];
  return null;
}

/** Är sekvensen den enkla enrytmsformen (visas exakt som före B4)? */
export function isSimpleRhythm(steps) {
  return steps.length === 1 && steps[0].times == null;
}

function sanitize(step) {
  const every = Math.max(1, Math.floor(step.every) || 1);
  const times = step.times == null ? null : Math.max(1, Math.floor(step.times) || 1);
  return { every, times };
}

/**
 * Var i sekvensen står räknaren på varv `value`?
 *
 *  - every/pos/due beskriver det pågående intervallet: "Varv pos av every",
 *    due när värdet självt är ett åtgärdsvarv (= "Dags! ✨").
 *  - nextActionRow är nästa åtgärdsvarv i absoluta varv, null när en
 *    ändlig sekvens är slut.
 *  - actionsDone/totalActions räknar åtgärder (ökningar/minskningar):
 *    "steg 3 av 7". totalActions är null för öppna sekvenser.
 *  - finished: ändlig sekvens helt avverkad.
 */
export function sequenceStatus(steps, value) {
  const v = Math.max(0, value || 0);
  let segStart = 0; // sista åtgärdsvarvet i föregående steg
  let actionsDone = 0;
  let totalActions = 0;
  let openEnded = false;
  let located = null;
  let nextActionRow = null;

  for (const raw of steps) {
    const { every, times } = sanitize(raw);
    const segEnd = times == null ? Infinity : segStart + every * times;
    if (times == null) openEnded = true;
    else totalActions += times;

    if (!located && v <= segEnd) {
      const into = v - segStart;
      actionsDone += Math.floor(into / every);
      located = {
        every,
        pos: into === 0 ? 0 : ((into - 1) % every) + 1,
        due: into > 0 && into % every === 0,
      };
    } else if (!located) {
      actionsDone += times;
    }

    if (nextActionRow === null) {
      const k = Math.floor(Math.max(0, v - segStart) / every) + 1;
      const candidate = segStart + k * every;
      if (candidate > v && candidate <= segEnd) nextActionRow = candidate;
    }
    segStart = segEnd;
  }

  if (!located) {
    // Värdet ligger bortom en ändlig sekvens — man stickar vidare efter formningen
    const { every } = sanitize(steps[steps.length - 1]);
    located = { every, pos: 0, due: false };
    actionsDone = totalActions;
  }

  return {
    ...located,
    nextActionRow,
    actionsDone,
    totalActions: openEnded ? null : totalActions,
    finished: !openEnded && nextActionRow === null,
  };
}

/** Är `row` ett åtgärdsvarv? Används för haptiken vid nästa tryck. */
export function isActionRow(steps, row) {
  if (!(row >= 1)) return false;
  return sequenceStatus(steps, row).due;
}

/** Sista åtgärdsvarvet i en ändlig sekvens, null för öppna. */
export function sequenceEndRow(steps) {
  let end = 0;
  for (const raw of steps) {
    const { every, times } = sanitize(raw);
    if (times == null) return null;
    end += every * times;
  }
  return end || null;
}

/** "vart 4:e varv" med korrekt svensk ordinal (varje/vartannat för 1/2). */
export function everyPhrase(every) {
  if (every === 1) return 'varje varv';
  if (every === 2) return 'vartannat varv';
  const suffix =
    (every % 10 === 1 || every % 10 === 2) && every % 100 !== 11 && every % 100 !== 12
      ? ':a'
      : ':e';
  return `vart ${every}${suffix} varv`;
}

/** Läser tillbaka sekvensen som mönstret säger den: "vart 4:e varv 3 ggr, sedan vart 6:e varv 4 ggr". */
export function describeSequence(steps) {
  return steps
    .map((raw, i) => {
      const { every, times } = sanitize(raw);
      const base = everyPhrase(every);
      const part =
        times != null ? `${base} ${times} ggr` : steps.length > 1 ? `${base} tills vidare` : base;
      return i === 0 ? part : `sedan ${part}`;
    })
    .join(', ');
}

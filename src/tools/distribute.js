/*
 * Jämnt fördelade minskningar/ökningar över ett varv.
 *
 * Ger två förslag för varje uträkning:
 *  - "enklaste": ett kort upprepningskommando, resten på slutet
 *    (t.ex. "K8, k2tog × 10").
 *  - "balanserad": maskorna delas i C+1 luckor så att hela maskor blir
 *    kvar i båda kanterna och de större luckorna sprids jämnt
 *    (t.ex. "K7, k2tog, K8, k2tog, …, K7").
 *
 * Allt räknas lokalt utan sidoeffekter — ren indata → utdata, lätt att testa.
 */

// Minskning: två maskor sticks ihop (k2tog) → en maska. Varje minskning
// äter alltså två maskor och tar bort en.
const DECREASE = {
  op: 'k2tog',
  opLabel: 'sticka 2 räta tillsammans',
  eats: 2, // maskor som förbrukas per åtgärd
};

// Ökning: en ny maska görs mellan två (M1). Inga befintliga maskor förbrukas.
const INCREASE = {
  op: 'M1',
  opLabel: 'öka 1 maska (M1)',
  eats: 0,
};

/**
 * @param {number|string} total  antal maskor du har nu
 * @param {number|string} change hur många du vill minska/öka med
 * @param {'decrease'|'increase'} mode
 */
export function distribute(total, change, mode) {
  const N = toInt(total);
  const C = toInt(change);

  if (N == null || N < 1) return { ok: false, error: 'Fyll i hur många maskor du har.' };
  if (C == null || C < 1) return { ok: false, error: 'Fyll i hur många maskor du vill ändra.' };

  return mode === 'decrease' ? decrease(N, C) : increase(N, C);
}

function decrease(N, C) {
  const maxDec = Math.floor(N / 2);
  if (C > maxDec) {
    return {
      ok: false,
      error: `Du kan minska högst ${maxDec} maskor från ${N} — varje minskning tar två maskor.`,
    };
  }

  // Maskor som sticks slätt (inte del av en minskning).
  const plain = N - DECREASE.eats * C;
  return build({ N, C, plain, result: N - C, kind: DECREASE, mode: 'decrease' });
}

function increase(N, C) {
  // Alla befintliga maskor sticks slätt; ökningarna läggs emellan.
  return build({ N, C, plain: N, result: N + C, kind: INCREASE, mode: 'increase' });
}

function build({ N, C, plain, result, kind, mode }) {
  const { op, opLabel } = kind;

  // Enklaste: dela de släta maskorna i C lika sektioner, resten på slutet.
  const base = Math.floor(plain / C);
  const extra = plain - base * C;
  const simpleSegments = [];
  for (let i = 0; i < C; i++) simpleSegments.push({ knit: base, op });
  if (extra > 0) simpleSegments.push({ knit: extra, op: null });

  // Balanserad: dela de släta maskorna i C+1 luckor (hela maskor kvar i
  // båda kanterna) och sprid de större luckorna jämnt.
  const gaps = spread(plain, C + 1);
  const balancedSegments = gaps.map((knit, i) => ({
    knit,
    op: i < gaps.length - 1 ? op : null,
  }));

  return {
    ok: true,
    mode,
    total: N,
    change: C,
    result,
    op,
    opLabel,
    simple: { segments: simpleSegments, text: compactText(simpleSegments) },
    balanced: { segments: balancedSegments, text: compactText(balancedSegments) },
  };
}

/**
 * Delar `total` maskor i `groups` luckor så jämnt som möjligt och speglar
 * fördelningen så att raden blir en palindrom — lika stora luckor i båda
 * kanterna. Summan blir alltid exakt `total`.
 *
 * Första halvan sätts med klassisk jämn partition (avrundade brytpunkter)
 * och speglas till andra halvan. En eventuell paritetsrest (udda antal
 * maskor på jämnt antal luckor kan omöjligt vara helt symmetriskt) hamnar
 * i mitten, där den märks minst.
 */
export function spread(total, groups) {
  const res = new Array(groups).fill(0);
  const half = Math.floor(groups / 2);
  let prev = 0;
  let sum = 0;
  for (let i = 1; i <= half; i++) {
    const x = Math.round((i * total) / groups);
    const gap = x - prev;
    res[i - 1] = gap;
    res[groups - i] = gap;
    prev = x;
    sum += 2 * gap;
  }
  const leftover = total - sum;
  if (groups % 2 === 1) {
    res[half] = leftover; // udda antal luckor: mittluckan tar resten
  } else if (leftover !== 0) {
    // Jämnt antal luckor med en paritetsrest på ±1: lägg den mot mitten.
    res[half - 1] += Math.ceil(leftover / 2);
    res[half] += Math.floor(leftover / 2);
  }
  return res;
}

/**
 * Bygger ett kort, läsbart kommando ur segmenten och slår ihop identiska
 * på varandra följande delar ("K8, k2tog × 10").
 */
export function compactText(segments) {
  const parts = [];
  for (const s of segments) {
    if (s.op) parts.push(knitOp(s.knit, s.op));
    else if (s.knit > 0) parts.push(`K${s.knit}`);
  }
  if (parts.length === 0) return '';

  const out = [];
  let i = 0;
  while (i < parts.length) {
    let j = i;
    while (j + 1 < parts.length && parts[j + 1] === parts[i]) j++;
    const n = j - i + 1;
    out.push(n > 1 ? `${parts[i]} × ${n}` : parts[i]);
    i = j + 1;
  }
  return out.join(', ');
}

function knitOp(knit, op) {
  return knit > 0 ? `K${knit}, ${op}` : op;
}

function toInt(value) {
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

import { counterSequence, isActionRow } from './sequence.js';

/*
 * Ren räknarlogik för länkade räknare (B1) och ackumulerad historik (B3).
 * Inga IO- eller React-beroenden — enhetstestas i tick.test.js och
 * återanvänds av CounterPanel.
 *
 * Reglerna:
 *  - En räknare kan följa en huvudräknare (followsId). Plus/minus på
 *    huvudräknaren tickar följarna symmetriskt; tryck direkt på en
 *    följare sprids aldrig. Kedjor är förbjudna och det finns högst en
 *    huvudräknare per projekt.
 *  - totalTicks är livstidsräkningen: plus ökar, minus backar (en
 *    felräkning var aldrig ett stickat varv), nollställning rör den inte.
 */

/** Räknare som följer den angivna. */
export function followersOf(counters, id) {
  return counters.filter((c) => c.followsId === id);
}

/**
 * Vilka räknare kan den här börja följa? Inga kedjor (den som själv har
 * följare kan inte följa någon), och finns redan en huvudräknare är den
 * det enda giltiga valet.
 */
export function followCandidates(counters, id) {
  const self = counters.find((c) => c.id === id);
  if (!self) return [];
  if (followersOf(counters, id).length > 0) return [];
  const primary = counters.find((c) => counters.some((o) => o.followsId === c.id));
  if (primary) return primary.id === id ? [] : [primary];
  return counters.filter((c) => c.id !== id && !c.followsId);
}

/** ±1 med golv på noll; totalTicks följer den faktiska ändringen. */
function applyDelta(counter, delta) {
  const value = Math.max(0, (counter.value || 0) + delta);
  const actual = value - (counter.value || 0);
  if (actual === 0) return counter;
  const totalTicks = Math.max(0, (counter.totalTicks ?? counter.value ?? 0) + actual);
  return { ...counter, value, totalTicks };
}

/**
 * Tickar en räknare (delta ±1) och låter huvudräknarens följare ticka
 * med. Om golvet stoppade ändringen (minus på noll) händer ingenting
 * alls — följarna ska inte backa varv som huvudräknaren aldrig tog.
 */
export function tickCounter(counters, id, delta) {
  const self = counters.find((c) => c.id === id);
  if (!self) return counters;
  const updatedSelf = applyDelta(self, delta);
  if (updatedSelf === self) return counters;
  const followerIds = self.followsId
    ? new Set()
    : new Set(followersOf(counters, id).map((c) => c.id));
  return counters.map((c) => {
    if (c.id === id) return updatedSelf;
    if (followerIds.has(c.id)) return applyDelta(c, delta);
    return c;
  });
}

/**
 * Firar nästa tryck? Kollar räknaren själv och dess följare — raglanens
 * "Dags!" ska kännas i tummen även när repetitionen sitter på följaren
 * och inte på kortet man trycker på.
 */
export function nextTickMilestone(counters, id) {
  const self = counters.find((c) => c.id === id);
  if (!self) return { hitTarget: false, hitRepeat: false };
  const cascade = [self, ...(self.followsId ? [] : followersOf(counters, id))];
  let hitTarget = false;
  let hitRepeat = false;
  for (const c of cascade) {
    const next = (c.value || 0) + 1;
    if (c.target && next === c.target) hitTarget = true;
    const steps = counterSequence(c);
    if (steps && isActionRow(steps, next)) hitRepeat = true;
  }
  return { hitTarget, hitRepeat };
}

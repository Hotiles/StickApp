import { describe, it, expect } from 'vitest';
import { tickCounter, followersOf, followCandidates, nextTickMilestone } from './tick.js';

const varv = { id: 'varv', label: 'Varv', value: 10, totalTicks: 30 };
const raglan = { id: 'raglan', label: 'Raglan', value: 10, totalTicks: 10, followsId: 'varv', repeatEvery: 4 };
const fri = { id: 'fri', label: 'Knapphål', value: 3, totalTicks: 3 };
const counters = [varv, raglan, fri];

describe('tickCounter – länkade räknare (B1)', () => {
  it('plus på huvudräknaren tickar följarna med', () => {
    const next = tickCounter(counters, 'varv', 1);
    expect(next.find((c) => c.id === 'varv').value).toBe(11);
    expect(next.find((c) => c.id === 'raglan').value).toBe(11);
    expect(next.find((c) => c.id === 'fri').value).toBe(3);
  });

  it('minus på huvudräknaren backar följarna symmetriskt', () => {
    const next = tickCounter(counters, 'varv', -1);
    expect(next.find((c) => c.id === 'varv').value).toBe(9);
    expect(next.find((c) => c.id === 'raglan').value).toBe(9);
  });

  it('tick direkt på en följare sprids inte', () => {
    const next = tickCounter(counters, 'raglan', 1);
    expect(next.find((c) => c.id === 'raglan').value).toBe(11);
    expect(next.find((c) => c.id === 'varv').value).toBe(10);
  });

  it('minus på huvudräknare på noll är en no-op — följarna backar inte', () => {
    const atZero = [{ ...varv, value: 0 }, { ...raglan, value: 5 }, fri];
    const next = tickCounter(atZero, 'varv', -1);
    expect(next).toBe(atZero);
  });

  it('följare på noll stannar på noll när huvudräknaren backar', () => {
    const mixed = [varv, { ...raglan, value: 0, totalTicks: 8 }, fri];
    const next = tickCounter(mixed, 'varv', -1);
    expect(next.find((c) => c.id === 'varv').value).toBe(9);
    const follower = next.find((c) => c.id === 'raglan');
    expect(follower.value).toBe(0);
    expect(follower.totalTicks).toBe(8);
  });
});

describe('tickCounter – totalTicks (B3)', () => {
  it('plus ökar totalTicks på räknaren och dess följare', () => {
    const next = tickCounter(counters, 'varv', 1);
    expect(next.find((c) => c.id === 'varv').totalTicks).toBe(31);
    expect(next.find((c) => c.id === 'raglan').totalTicks).toBe(11);
  });

  it('minus backar totalTicks — en felräkning var aldrig ett varv', () => {
    const next = tickCounter(counters, 'varv', -1);
    expect(next.find((c) => c.id === 'varv').totalTicks).toBe(29);
  });

  it('räknare utan totalTicks (före migreringen) utgår från värdet', () => {
    const legacy = [{ id: 'a', label: 'Varv', value: 7 }];
    const next = tickCounter(legacy, 'a', 1);
    expect(next[0].totalTicks).toBe(8);
  });
});

describe('followCandidates – en huvudräknare, inga kedjor', () => {
  it('utan länkar kan vem som helst följas utom en själv', () => {
    const free = [{ ...varv }, { ...raglan, followsId: undefined }, fri].map((c) => ({
      ...c,
      followsId: null,
    }));
    expect(followCandidates(free, 'raglan').map((c) => c.id)).toEqual(['varv', 'fri']);
  });

  it('finns en huvudräknare är den det enda valet', () => {
    expect(followCandidates(counters, 'fri').map((c) => c.id)).toEqual(['varv']);
  });

  it('huvudräknaren kan inte själv börja följa någon (ingen kedja)', () => {
    expect(followCandidates(counters, 'varv')).toEqual([]);
  });

  it('följare räknas upp av followersOf', () => {
    expect(followersOf(counters, 'varv').map((c) => c.id)).toEqual(['raglan']);
  });
});

describe('nextTickMilestone – haptik för hela kaskaden', () => {
  it('följarens åtgärdsvarv känns vid tryck på huvudräknaren', () => {
    // raglan står på 11 → nästa är 12, delbart med 4
    const state = [{ ...varv, value: 11 }, { ...raglan, value: 11 }, fri];
    expect(nextTickMilestone(state, 'varv').hitRepeat).toBe(true);
  });

  it('följarens mål känns vid tryck på huvudräknaren', () => {
    const state = [varv, { ...raglan, target: 11 }, fri];
    expect(nextTickMilestone(state, 'varv').hitTarget).toBe(true);
  });

  it('tryck på en följare tittar bara på den själv', () => {
    // varv skulle fira nästa tryck — men raglans tryck sprids inte dit
    const state = [{ ...varv, target: 11, repeatEvery: 11 }, raglan, fri];
    expect(nextTickMilestone(state, 'raglan')).toEqual({ hitTarget: false, hitRepeat: false });
  });
});

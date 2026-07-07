import { describe, it, expect } from 'vitest';
import { normalizeProjectDates, normalizeProjectCounters, normalizeProject } from './normalize.js';

const base = {
  id: 'p1',
  createdAt: '2025-03-01T10:00:00.000Z',
  updatedAt: '2025-06-15T18:30:00.000Z',
  deletedAt: null,
  name: 'Raglantröja',
};

describe('normalizeProjectDates – backfyllning av v2-projekt (A2)', () => {
  it('pågående projekt får startedAt = createdAt och inget finishedAt', () => {
    const p = normalizeProjectDates({ ...base, status: 'pågående' });
    expect(p.startedAt).toBe(base.createdAt);
    expect(p.finishedAt).toBeNull();
    expect(p.datesEstimated).toBe(false);
  });

  it('färdigt projekt får finishedAt = updatedAt, flaggat som uppskattat', () => {
    const p = normalizeProjectDates({ ...base, status: 'färdigt' });
    expect(p.startedAt).toBe(base.createdAt);
    expect(p.finishedAt).toBe(base.updatedAt);
    expect(p.datesEstimated).toBe(true);
  });

  it('rör aldrig updatedAt — merge-ordningen ("nyast vinner") får inte påverkas', () => {
    const p = normalizeProjectDates({ ...base, status: 'färdigt' });
    expect(p.updatedAt).toBe(base.updatedAt);
  });

  it('lämnar projekt med riktiga datum orörda (samma objektreferens)', () => {
    const modern = {
      ...base,
      status: 'färdigt',
      startedAt: '2025-03-02T09:00:00.000Z',
      finishedAt: '2025-06-01T12:00:00.000Z',
      datesEstimated: false,
    };
    expect(normalizeProjectDates(modern)).toBe(modern);
  });

  it('muterar inte indata', () => {
    const input = { ...base, status: 'färdigt' };
    normalizeProjectDates(input);
    expect(input.finishedAt).toBeUndefined();
    expect(input.datesEstimated).toBeUndefined();
  });

  it('flaggar inte färdiga projekt som redan har finishedAt', () => {
    const p = normalizeProjectDates({
      ...base,
      status: 'färdigt',
      finishedAt: '2025-06-01T12:00:00.000Z',
    });
    expect(p.finishedAt).toBe('2025-06-01T12:00:00.000Z');
    expect(p.datesEstimated).toBe(false);
  });
});

describe('normalizeProjectCounters – backfyllning av v3-projekt (B2+B3)', () => {
  const v3 = {
    ...base,
    status: 'pågående',
    counters: [
      { id: 'c1', label: 'Varv', value: 47 },
      { id: 'c2', label: 'Räknare 2', value: 0 },
    ],
  };

  it('räknare utan totalTicks får totalTicks = nuvarande värde', () => {
    const p = normalizeProjectCounters(v3);
    expect(p.counters[0].totalTicks).toBe(47);
    expect(p.counters[1].totalTicks).toBe(0);
  });

  it('projekt utan countersLocked får låset av', () => {
    expect(normalizeProjectCounters(v3).countersLocked).toBe(false);
  });

  it('lämnar moderna projekt orörda (samma objektreferens)', () => {
    const modern = {
      ...base,
      countersLocked: true,
      counters: [{ id: 'c1', label: 'Varv', value: 12, totalTicks: 200 }],
    };
    expect(normalizeProjectCounters(modern)).toBe(modern);
  });

  it('skriver aldrig över befintlig totalTicks-historik', () => {
    const p = normalizeProjectCounters({
      ...base,
      counters: [{ id: 'c1', label: 'Varv', value: 3, totalTicks: 250 }],
    });
    expect(p.counters[0].totalTicks).toBe(250);
  });

  it('muterar inte indata', () => {
    const input = { ...v3, counters: v3.counters.map((c) => ({ ...c })) };
    normalizeProjectCounters(input);
    expect(input.counters[0].totalTicks).toBeUndefined();
    expect(input.countersLocked).toBeUndefined();
  });
});

describe('normalizeProject – datum + räknare i ett svep', () => {
  it('backfyller både v2-datum och v3-räknare', () => {
    const p = normalizeProject({
      ...base,
      status: 'färdigt',
      counters: [{ id: 'c1', label: 'Varv', value: 80 }],
    });
    expect(p.finishedAt).toBe(base.updatedAt);
    expect(p.counters[0].totalTicks).toBe(80);
    expect(p.countersLocked).toBe(false);
  });

  it('är idempotent — andra körningen är en no-op (samma referens)', () => {
    const once = normalizeProject({
      ...base,
      status: 'pågående',
      counters: [{ id: 'c1', label: 'Varv', value: 5 }],
    });
    expect(normalizeProject(once)).toBe(once);
  });
});

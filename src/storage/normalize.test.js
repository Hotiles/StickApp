import { describe, it, expect } from 'vitest';
import { normalizeProjectDates } from './normalize.js';

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

import { describe, it, expect } from 'vitest';
import { stepBandFit, MIN_BAND_PT, MAX_BAND_PT } from './bandFit.js';

// A4-höjd i punkter — spannet för ett horisontellt band
const SPAN = 842;

describe('stepBandFit – kantförankrad inpassning (D6)', () => {
  it('+ flyttar bara nedre kanten; övre kanten ligger still', () => {
    const before = { position: 0.5, thicknessPt: 24 };
    const after = stepBandFit({ ...before, deltaPt: 2, spanPt: SPAN });
    const edgeBefore = before.position - before.thicknessPt / SPAN / 2;
    const edgeAfter = after.position - after.thicknessPt / SPAN / 2;
    expect(after.thicknessPt).toBe(26);
    expect(edgeAfter).toBeCloseTo(edgeBefore, 10);
  });

  it('− krymper mot den stilla kanten', () => {
    const before = { position: 0.5, thicknessPt: 24 };
    const after = stepBandFit({ ...before, deltaPt: -2, spanPt: SPAN });
    const edgeBefore = before.position - before.thicknessPt / SPAN / 2;
    const edgeAfter = after.position - after.thicknessPt / SPAN / 2;
    expect(after.thicknessPt).toBe(22);
    expect(edgeAfter).toBeCloseTo(edgeBefore, 10);
  });

  it('klampar mot max och returnerar null när inget händer', () => {
    const clamped = stepBandFit({ position: 0.5, thicknessPt: MAX_BAND_PT - 1, deltaPt: 6, spanPt: SPAN });
    expect(clamped.thicknessPt).toBe(MAX_BAND_PT);
    expect(stepBandFit({ position: 0.5, thicknessPt: MAX_BAND_PT, deltaPt: 2, spanPt: SPAN })).toBeNull();
  });

  it('klampar mot min och returnerar null när inget händer', () => {
    const clamped = stepBandFit({ position: 0.5, thicknessPt: MIN_BAND_PT + 1, deltaPt: -6, spanPt: SPAN });
    expect(clamped.thicknessPt).toBe(MIN_BAND_PT);
    expect(stepBandFit({ position: 0.5, thicknessPt: MIN_BAND_PT, deltaPt: -2, spanPt: SPAN })).toBeNull();
  });

  it('positionen håller sig inom 0–1 vid sidans kant', () => {
    const after = stepBandFit({ position: 0.99, thicknessPt: 100, deltaPt: 20, spanPt: 200 });
    expect(after.position).toBeLessThanOrEqual(1);
  });
});

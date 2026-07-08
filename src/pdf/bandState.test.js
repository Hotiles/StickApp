import { describe, it, expect } from 'vitest';
import {
  cycleOrientation,
  normalizeBand,
  makeSecondBand,
  ORIENTATIONS,
  DEFAULT_BAND_COLOR,
  BAND_COLORS,
} from './bandState.js';

describe('cycleOrientation – trelägescykeln', () => {
  it('går horisontell → vertikal → båda → horisontell', () => {
    expect(cycleOrientation('horisontell')).toBe('vertikal');
    expect(cycleOrientation('vertikal')).toBe('båda');
    expect(cycleOrientation('båda')).toBe('horisontell');
  });

  it('okänt värde landar på första riktningen', () => {
    expect(cycleOrientation('diagonal')).toBe(ORIENTATIONS[0]);
    expect(cycleOrientation(undefined)).toBe(ORIENTATIONS[0]);
  });
});

describe('normalizeBand – migrering av sparade lägen', () => {
  it('saknat band ger standardläget', () => {
    expect(normalizeBand(null)).toEqual({
      orientation: 'horisontell',
      positionByPage: {},
      positionByPageV: {},
      visible: true,
      lastMovedPage: null,
      color: DEFAULT_BAND_COLOR,
      thicknessPt: null,
    });
  });

  it('saknat band kan få en egen grundfärg (andra bandet)', () => {
    expect(normalizeBand(null, BAND_COLORS[1]).color).toBe(BAND_COLORS[1]);
  });

  it('äldre läge utan positionByPageV får samma positioner i båda kartorna', () => {
    const old = { orientation: 'vertikal', positionByPage: { 1: 0.3, 4: 0.7 }, visible: true };
    const band = normalizeBand(old);
    expect(band.positionByPageV).toEqual({ 1: 0.3, 4: 0.7 });
    expect(band.positionByPage).toEqual({ 1: 0.3, 4: 0.7 });
    expect(band.positionByPageV).not.toBe(band.positionByPage); // egna objekt
    expect(band.orientation).toBe('vertikal');
    expect(band.lastMovedPage).toBeNull();
  });

  it('läge utan lastMovedPage (före D7) får null', () => {
    const old = {
      orientation: 'horisontell',
      positionByPage: { 2: 0.4 },
      positionByPageV: { 2: 0.4 },
      visible: true,
    };
    const band = normalizeBand(old);
    expect(band.lastMovedPage).toBeNull();
    expect(band.positionByPage).toEqual({ 2: 0.4 });
  });

  it('läge utan color/thicknessPt (före D2) backfylls', () => {
    const old = {
      orientation: 'horisontell',
      positionByPage: { 1: 0.4 },
      positionByPageV: { 1: 0.4 },
      visible: true,
      lastMovedPage: 1,
    };
    const band = normalizeBand(old);
    expect(band.color).toBe(DEFAULT_BAND_COLOR);
    expect(band.thicknessPt).toBeNull();
  });

  it('dagens form passerar orörd', () => {
    const band = {
      orientation: 'båda',
      positionByPage: { 1: 0.2 },
      positionByPageV: { 1: 0.8 },
      visible: true,
      lastMovedPage: 3,
      color: DEFAULT_BAND_COLOR,
      thicknessPt: null,
    };
    expect(normalizeBand(band)).toBe(band);
  });
});

describe('makeSecondBand – opt-in andra band (D2)', () => {
  it('får en egen färg skild från första bandet', () => {
    const b = makeSecondBand();
    expect(b.color).toBe(BAND_COLORS[1]);
    expect(b.color).not.toBe(DEFAULT_BAND_COLOR);
    expect(b.visible).toBe(true);
    expect(b.thicknessPt).toBeNull();
    expect(b.positionByPage).toEqual({});
  });
});

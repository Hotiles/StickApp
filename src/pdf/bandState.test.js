import { describe, it, expect } from 'vitest';
import { cycleOrientation, normalizeBand, ORIENTATIONS } from './bandState.js';

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
    });
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

  it('dagens form passerar orörd', () => {
    const band = {
      orientation: 'båda',
      positionByPage: { 1: 0.2 },
      positionByPageV: { 1: 0.8 },
      visible: true,
      lastMovedPage: 3,
    };
    expect(normalizeBand(band)).toBe(band);
  });
});

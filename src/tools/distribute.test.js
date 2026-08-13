import { describe, it, expect } from 'vitest';
import { distribute, spread, compactText } from './distribute.js';

// Summera de släta maskorna i en segmentlista.
const sumKnit = (segments) => segments.reduce((a, s) => a + s.knit, 0);
// Räkna åtgärderna (minskningar/ökningar).
const countOps = (segments) => segments.filter((s) => s.op).length;

describe('distribute – minskning', () => {
  it('Jakobs exempel: 100 maskor, minska 10 → 90', () => {
    const r = distribute(100, 10, 'decrease');
    expect(r.ok).toBe(true);
    expect(r.result).toBe(90);
    expect(r.op).toBe('k2tog');
  });

  it('enklaste jämnt fall blir ett rent upprepningskommando', () => {
    const r = distribute(100, 10, 'decrease');
    expect(r.simple.text).toBe('K8, k2tog × 10');
    // 10 minskningar × (8 släta + 2 ihopstickade) = 100 maskor.
    expect(countOps(r.simple.segments)).toBe(10);
    expect(sumKnit(r.simple.segments) + 2 * 10).toBe(100);
  });

  it('balanserad behåller hela maskor i båda kanterna', () => {
    const r = distribute(100, 10, 'decrease');
    const segs = r.balanced.segments;
    // C+1 = 11 luckor, sista utan åtgärd.
    expect(segs).toHaveLength(11);
    expect(segs[0].knit).toBeGreaterThan(0);
    expect(segs[segs.length - 1].op).toBe(null);
    expect(segs[0].knit).toBe(segs[segs.length - 1].knit); // symmetriska kanter
    expect(countOps(segs)).toBe(10);
    expect(sumKnit(segs) + 2 * 10).toBe(100);
  });

  it('ojämnt fall fördelar resten (100, minska 7)', () => {
    const r = distribute(100, 7, 'decrease');
    expect(r.result).toBe(93);
    // Släta maskor = 100 - 2*7 = 86, bevaras i båda förslagen.
    expect(sumKnit(r.simple.segments)).toBe(86);
    expect(sumKnit(r.balanced.segments)).toBe(86);
    expect(countOps(r.simple.segments)).toBe(7);
    expect(countOps(r.balanced.segments)).toBe(7);
  });

  it('alla maskor ihopstickade när minskningen är maximal', () => {
    const r = distribute(10, 5, 'decrease');
    expect(r.ok).toBe(true);
    expect(r.result).toBe(5);
    expect(r.simple.text).toBe('k2tog × 5');
  });

  it('nekar för stor minskning', () => {
    const r = distribute(10, 6, 'decrease');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/högst 5/);
  });
});

describe('distribute – ökning', () => {
  it('100 maskor, öka 10 → 110', () => {
    const r = distribute(100, 10, 'increase');
    expect(r.ok).toBe(true);
    expect(r.result).toBe(110);
    expect(r.op).toBe('M1');
    expect(r.simple.text).toBe('K10, M1 × 10');
    // Alla 100 maskor sticks slätt, 10 ökningar läggs emellan.
    expect(sumKnit(r.simple.segments)).toBe(100);
    expect(countOps(r.simple.segments)).toBe(10);
  });

  it('balanserad ökning har lika kanter och rätt antal', () => {
    const r = distribute(100, 7, 'increase');
    const segs = r.balanced.segments;
    expect(segs).toHaveLength(8);
    expect(segs[0].knit).toBe(segs[segs.length - 1].knit);
    expect(sumKnit(segs)).toBe(100);
    expect(countOps(segs)).toBe(7);
    expect(r.result).toBe(107);
  });
});

describe('distribute – ogiltig indata', () => {
  it('tomt/noll ger felmeddelande, inte krasch', () => {
    expect(distribute('', 10, 'decrease').ok).toBe(false);
    expect(distribute(100, '', 'decrease').ok).toBe(false);
    expect(distribute(0, 5, 'increase').ok).toBe(false);
  });
});

describe('spread – jämn fördelning', () => {
  it('delar exakt när det går jämnt ut', () => {
    expect(spread(80, 8)).toEqual([10, 10, 10, 10, 10, 10, 10, 10]);
  });

  it('sprider resten och bevarar summan', () => {
    const g = spread(86, 8);
    expect(g.reduce((a, b) => a + b, 0)).toBe(86);
    // Skillnaden mellan största och minsta lucka är som mest 1.
    expect(Math.max(...g) - Math.min(...g)).toBe(1);
  });

  it('bevarar summan och håller luckorna jämna för alla kombinationer', () => {
    for (let total = 0; total <= 120; total++) {
      for (let groups = 1; groups <= 40; groups++) {
        const g = spread(total, groups);
        expect(g).toHaveLength(groups);
        expect(g.reduce((a, b) => a + b, 0)).toBe(total); // aldrig tappa/skapa maskor
        expect(g.every((n) => n >= 0)).toBe(true);
        // Kanterna är exakt lika när pariteten tillåter det, annars på sin
        // höjd 1 ifrån (udda summa på jämnt antal luckor kan inte speglas).
        const parityAllowsSymmetry = !(total % 2 === 1 && groups % 2 === 0);
        if (parityAllowsSymmetry) expect(g[0]).toBe(g[groups - 1]);
        else expect(Math.abs(g[0] - g[groups - 1])).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('compactText', () => {
  it('slår ihop upprepningar', () => {
    const segs = [
      { knit: 8, op: 'k2tog' },
      { knit: 8, op: 'k2tog' },
      { knit: 4, op: null },
    ];
    expect(compactText(segs)).toBe('K8, k2tog × 2, K4');
  });

  it('utelämnar tom släta maskor på slutet', () => {
    expect(compactText([{ knit: 5, op: 'M1' }, { knit: 0, op: null }])).toBe('K5, M1');
  });
});

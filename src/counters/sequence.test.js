import { describe, it, expect } from 'vitest';
import {
  counterSequence,
  isSimpleRhythm,
  sequenceStatus,
  isActionRow,
  sequenceEndRow,
  everyPhrase,
  describeSequence,
} from './sequence.js';

// Recensentens raglanexempel: "öka vart 4:e varv 3 ggr, sedan vart 6:e varv 4 ggr"
// Åtgärdsvarv: 4, 8, 12, 18, 24, 30, 36 — sju åtgärder totalt.
const raglan = [
  { every: 4, times: 3 },
  { every: 6, times: 4 },
];

describe('counterSequence – läser båda dataformerna', () => {
  it('ny form: sequence-listan som den är', () => {
    expect(counterSequence({ sequence: raglan })).toBe(raglan);
  });

  it('gammal form: repeatEvery blir ett öppet enstegs-steg', () => {
    expect(counterSequence({ repeatEvery: 6 })).toEqual([{ every: 6, times: null }]);
  });

  it('sequence vinner över kvarliggande repeatEvery', () => {
    expect(counterSequence({ sequence: raglan, repeatEvery: 6 })).toBe(raglan);
  });

  it('ingen upprepning alls ger null', () => {
    expect(counterSequence({ label: 'Varv', value: 3 })).toBeNull();
    expect(counterSequence({ repeatEvery: null })).toBeNull();
    expect(counterSequence({ sequence: [] })).toBeNull();
  });
});

describe('isSimpleRhythm – enrytmsformen visas som före B4', () => {
  it('ett öppet steg är enkel rytm', () => {
    expect(isSimpleRhythm([{ every: 6, times: null }])).toBe(true);
  });
  it('ändligt antal eller flera steg är en sekvens', () => {
    expect(isSimpleRhythm([{ every: 6, times: 5 }])).toBe(false);
    expect(isSimpleRhythm(raglan)).toBe(false);
  });
});

describe('sequenceStatus – enkel rytm beter sig exakt som gamla repeatEvery', () => {
  const simple = [{ every: 6, times: null }];

  it('på noll: position 0, inget dags, nästa åtgärd på varv 6', () => {
    const s = sequenceStatus(simple, 0);
    expect(s).toMatchObject({ every: 6, pos: 0, due: false, nextActionRow: 6, actionsDone: 0 });
    expect(s.totalActions).toBeNull();
    expect(s.finished).toBe(false);
  });

  it('mitt i intervallet: varv 5 av 6', () => {
    expect(sequenceStatus(simple, 5)).toMatchObject({ pos: 5, due: false, nextActionRow: 6 });
  });

  it('på åtgärdsvarvet: dags, och repetitionerna räknas', () => {
    expect(sequenceStatus(simple, 12)).toMatchObject({
      pos: 6,
      due: true,
      actionsDone: 2,
      nextActionRow: 18,
    });
  });
});

describe('sequenceStatus – raglanexemplet steg för steg', () => {
  it('varv 0: sju åtgärder framför sig, första på varv 4', () => {
    expect(sequenceStatus(raglan, 0)).toMatchObject({
      every: 4,
      pos: 0,
      due: false,
      nextActionRow: 4,
      actionsDone: 0,
      totalActions: 7,
      finished: false,
    });
  });

  it('varv 12: sista åtgärden i steg 1 — dags, 3 av 7 gjorda, nästa på 18', () => {
    expect(sequenceStatus(raglan, 12)).toMatchObject({
      due: true,
      actionsDone: 3,
      nextActionRow: 18,
      finished: false,
    });
  });

  it('varv 13: första varvet i 6-rytmen — varv 1 av 6', () => {
    expect(sequenceStatus(raglan, 13)).toMatchObject({
      every: 6,
      pos: 1,
      due: false,
      nextActionRow: 18,
      actionsDone: 3,
    });
  });

  it('varv 36: sista åtgärden — dags och klart', () => {
    expect(sequenceStatus(raglan, 36)).toMatchObject({
      due: true,
      actionsDone: 7,
      nextActionRow: null,
      finished: true,
    });
  });

  it('varv 40: bortom sekvensen — klart, inget mer dags', () => {
    expect(sequenceStatus(raglan, 40)).toMatchObject({
      due: false,
      actionsDone: 7,
      nextActionRow: null,
      finished: true,
    });
  });
});

describe('sequenceStatus – öppen svans efter ändliga steg', () => {
  const tail = [
    { every: 4, times: 3 },
    { every: 6, times: null },
  ];

  it('svansen fortsätter för evigt: varv 30 är dags, nästa på 36', () => {
    const s = sequenceStatus(tail, 30);
    expect(s).toMatchObject({ due: true, nextActionRow: 36, finished: false });
    expect(s.totalActions).toBeNull();
  });
});

describe('isActionRow – haptik för nästa tryck', () => {
  it('träffar åtgärdsvarven i båda stegen', () => {
    expect(isActionRow(raglan, 4)).toBe(true);
    expect(isActionRow(raglan, 12)).toBe(true);
    expect(isActionRow(raglan, 18)).toBe(true);
    expect(isActionRow(raglan, 16)).toBe(false);
    expect(isActionRow(raglan, 0)).toBe(false);
  });
});

describe('sequenceEndRow', () => {
  it('ändlig sekvens: sista åtgärdsvarvet', () => {
    expect(sequenceEndRow(raglan)).toBe(36);
  });
  it('öppen sekvens: null', () => {
    expect(sequenceEndRow([{ every: 6, times: null }])).toBeNull();
  });
});

describe('everyPhrase – svenska ordinaler', () => {
  it('specialformer för 1 och 2', () => {
    expect(everyPhrase(1)).toBe('varje varv');
    expect(everyPhrase(2)).toBe('vartannat varv');
  });
  it(':e som regel, :a för 21/22-mönstret men inte 11/12', () => {
    expect(everyPhrase(4)).toBe('vart 4:e varv');
    expect(everyPhrase(21)).toBe('vart 21:a varv');
    expect(everyPhrase(11)).toBe('vart 11:e varv');
    expect(everyPhrase(12)).toBe('vart 12:e varv');
  });
});

describe('describeSequence – läser tillbaka vad mönstret säger', () => {
  it('raglanexemplet ordagrant', () => {
    expect(describeSequence(raglan)).toBe('vart 4:e varv 3 ggr, sedan vart 6:e varv 4 ggr');
  });
  it('enkel rytm utan antal', () => {
    expect(describeSequence([{ every: 6, times: null }])).toBe('vart 6:e varv');
  });
  it('öppen svans märks ut', () => {
    expect(
      describeSequence([
        { every: 4, times: 3 },
        { every: 6, times: null },
      ])
    ).toBe('vart 4:e varv 3 ggr, sedan vart 6:e varv tills vidare');
  });
});

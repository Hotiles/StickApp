/*
 * Bandets riktning och lagringsform: ren logik utan IO/React.
 *
 * Riktningen kan vara 'horisontell', 'vertikal' eller 'båda' — det sista
 * visar ett horisontellt och ett vertikalt band samtidigt (överlappande
 * kors), t.ex. för att följa både varv och maska i ett diagram. Varje
 * riktning har sin egen positionskarta per sida: positionByPage för det
 * horisontella bandet och positionByPageV för det vertikala.
 */

export const ORIENTATIONS = ['horisontell', 'vertikal', 'båda'];

/** Nästa riktning i cykeln horisontell → vertikal → båda → … */
export function cycleOrientation(orientation) {
  const i = ORIENTATIONS.indexOf(orientation);
  return ORIENTATIONS[(i + 1) % ORIENTATIONS.length];
}

/**
 * Ger ett sparat bandläge dagens form. Äldre lägen (innan 'båda') hade en
 * gemensam positionskarta som återanvändes vid riktningsbyte — de får
 * samma positioner i båda kartorna, vilket motsvarar det gamla beteendet.
 *
 * lastMovedPage (D7): sidan där bandet senast flyttades eller passades in —
 * "här är du"-markören i sidgalleriet. null tills bandet faktiskt rörts.
 */
export function normalizeBand(band) {
  if (!band) {
    return {
      orientation: 'horisontell',
      positionByPage: {},
      positionByPageV: {},
      visible: true,
      lastMovedPage: null,
    };
  }
  if (band.positionByPageV && band.lastMovedPage !== undefined) return band;
  const next = { ...band };
  if (!next.positionByPageV) next.positionByPageV = { ...next.positionByPage };
  if (next.lastMovedPage === undefined) next.lastMovedPage = null;
  return next;
}

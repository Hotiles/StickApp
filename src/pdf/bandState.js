/*
 * Bandets riktning och lagringsform: ren logik utan IO/React.
 *
 * Riktningen kan vara 'horisontell', 'vertikal' eller 'båda' — det sista
 * visar ett horisontellt och ett vertikalt band samtidigt (överlappande
 * kors), t.ex. för att följa både varv och maska i ett diagram. Varje
 * riktning har sin egen positionskarta per sida: positionByPage för det
 * horisontella bandet och positionByPageV för det vertikala.
 *
 * D2: ett projekt kan ha ett andra band (opt-in) med egen färg, position
 * och tjocklek — t.ex. ett band på diagramraden och ett på den skrivna
 * instruktionsraden. Andra bandet är ett vanligt bandobjekt till, lagrat
 * i viewState.band2; är det null finns bara ett band (grundläget).
 */

// Bandfärgerna (rgb utan alfa). Första är appens klassiska pastellrosa;
// resten ger tydligt åtskilda band när man har två samtidigt.
export const BAND_COLORS = [
  '244, 194, 219', // rosa (band 1)
  '160, 205, 175', // salvia (band 2)
  '243, 214, 150', // sand
  '176, 196, 240', // blåklint
];

export const DEFAULT_BAND_COLOR = BAND_COLORS[0];

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
 *
 * color/thicknessPt (D2/D6): varje band bär nu sin egen färg och en
 * tjockleksöverride (null = Inställningarnas standard, sätts först när man
 * passar in). Äldre band backfyllas med rosa och null.
 */
export function normalizeBand(band, defaultColor = DEFAULT_BAND_COLOR) {
  if (!band) {
    return {
      orientation: 'horisontell',
      positionByPage: {},
      positionByPageV: {},
      visible: true,
      lastMovedPage: null,
      color: defaultColor,
      thicknessPt: null,
    };
  }
  if (
    band.positionByPageV &&
    band.lastMovedPage !== undefined &&
    band.color !== undefined &&
    band.thicknessPt !== undefined
  ) {
    return band;
  }
  const next = { ...band };
  if (!next.positionByPageV) next.positionByPageV = { ...next.positionByPage };
  if (next.lastMovedPage === undefined) next.lastMovedPage = null;
  if (next.color === undefined) next.color = defaultColor;
  if (next.thicknessPt === undefined) next.thicknessPt = null;
  return next;
}

/**
 * Ett nytt andra band (D2). Grundfärg är nästa i paletten så att de två
 * banden går att skilja åt direkt; övrigt börjar tomt precis som första
 * bandet vid gjutning.
 */
export function makeSecondBand() {
  return {
    orientation: 'horisontell',
    positionByPage: {},
    positionByPageV: {},
    visible: true,
    lastMovedPage: null,
    color: BAND_COLORS[1],
    thicknessPt: null,
  };
}

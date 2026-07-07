/*
 * Inpassning av bandets tjocklek (D6): ren steglogik utan IO/React.
 *
 * Tjockleken ändras kantförankrat, inte symmetriskt: övre/vänstra kanten
 * ligger still och +/− flyttar bara den nedre/högra. Så håller den kant
 * man just lagt mot diagramradens ena linje sig kvar där, medan varje
 * steg flyttar den synliga kanten en liten förutsägbar bit mot den andra.
 */

// Friare spelrum än reglaget i Inställningar (10–60): diagramrader kan
// vara både pyttesmå och jättelika.
export const MIN_BAND_PT = 6;
export const MAX_BAND_PT = 120;
// Samma upplösning som reglaget i Inställningar.
export const BAND_STEP_PT = 2;

/**
 * Ett steg. position är bandets mitt som andel (0–1) av sidans spann i
 * bandets riktning; spanPt är det spannet i PDF-punkter. Returnerar ny
 * { position, thicknessPt } eller null om klampningen stoppade steget.
 */
export function stepBandFit({ position, thicknessPt, deltaPt, spanPt }) {
  const fixedEdge = position - thicknessPt / spanPt / 2;
  const next = Math.min(MAX_BAND_PT, Math.max(MIN_BAND_PT, thicknessPt + deltaPt));
  if (next === thicknessPt) return null;
  const pos = Math.min(1, Math.max(0, fixedEdge + next / spanPt / 2));
  return { position: pos, thicknessPt: next };
}

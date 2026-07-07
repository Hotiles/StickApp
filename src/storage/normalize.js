/*
 * Normalisering av äldre poster till aktuell schema-form. Rena funktioner
 * utan IO — används både av db-migrationen (v3) och när gamla backuper
 * läses in, och kan enhetstestas.
 */

/**
 * Projekt fick startedAt/finishedAt i v3 (UX-plan A2). Äldre poster
 * backfyllas: startedAt = createdAt (gjutningen låg nära skapandet) och
 * finishedAt = updatedAt för redan färdiga projekt. Det senare är en
 * gissning och flaggas med datesEstimated så statistiken kan visa det.
 * updatedAt röras aldrig — merge-logiken ("nyast vinner") bygger på den.
 */
export function normalizeProjectDates(project) {
  if (!project) return project;
  if (project.startedAt !== undefined && project.finishedAt !== undefined) return project;

  const p = { ...project };
  if (p.startedAt === undefined || p.startedAt === null) p.startedAt = p.createdAt ?? null;
  if (p.finishedAt === undefined) p.finishedAt = null;
  if (p.status === 'färdigt' && !p.finishedAt && p.updatedAt) {
    p.finishedAt = p.updatedAt;
    p.datesEstimated = true;
  }
  if (p.datesEstimated === undefined) p.datesEstimated = false;
  return p;
}

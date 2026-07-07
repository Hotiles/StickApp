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

/**
 * Räknare fick totalTicks i v4 (UX-plan B3) och projekt fick räknarlåset
 * countersLocked (B2). Äldre poster backfyllas: totalTicks = nuvarande
 * värde (bästa tillgängliga uppskattning — historik före migreringen är
 * borta) och låset av.
 */
export function normalizeProjectCounters(project) {
  if (!project) return project;
  const counters = project.counters || [];
  const needsTicks = counters.some((c) => c.totalTicks === undefined);
  const needsLock = project.countersLocked === undefined;
  if (!needsTicks && !needsLock) return project;

  const p = { ...project };
  if (needsTicks) {
    p.counters = counters.map((c) =>
      c.totalTicks === undefined ? { ...c, totalTicks: c.value || 0 } : c
    );
  }
  if (needsLock) p.countersLocked = false;
  return p;
}

/** Alla projektnormaliseringar i ett svep — för db-migrationen och backup-inläsning. */
export function normalizeProject(project) {
  return normalizeProjectCounters(normalizeProjectDates(project));
}

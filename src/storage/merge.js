/*
 * Merge-logik "nyast vinner" (§4.5). Ren funktion utan IO så att den kan
 * enhetstestas — och återanvändas rakt av när sync (Nivå 2) byggs.
 */

/** Slår ihop två listor av entiteter per id; nyast updatedAt vinner. */
export function mergeEntities(local, incoming) {
  const byId = new Map();
  for (const e of local) byId.set(e.id, e);
  for (const e of incoming) {
    const existing = byId.get(e.id);
    if (!existing || (e.updatedAt || '') > (existing.updatedAt || '')) {
      byId.set(e.id, e);
    }
  }
  return [...byId.values()];
}

/**
 * Slår ihop en hel backup-dump med lokal data.
 * Blobbar saknar updatedAt och är immutabla — de läggs bara till om de saknas,
 * och blobbar vars ägare (mönster/projekt) är borttagen efter mergen tas inte med.
 */
export function mergeDump(local, incoming) {
  const folders = mergeEntities(local.folders, incoming.folders);
  const patterns = mergeEntities(local.patterns, incoming.patterns);
  const projects = mergeEntities(local.projects, incoming.projects);

  const referenced = new Set();
  for (const p of patterns) {
    if (!p.deletedAt && p.fileBlobId) referenced.add(p.fileBlobId);
  }
  for (const p of projects) {
    if (!p.deletedAt) for (const id of p.photoBlobIds || []) referenced.add(id);
  }

  const localBlobIds = new Set(local.blobRecords.map((b) => b.id));
  const blobRecords = [
    ...local.blobRecords.filter((b) => referenced.has(b.id)),
    ...incoming.blobRecords.filter((b) => referenced.has(b.id) && !localBlobIds.has(b.id)),
  ];

  return { folders, patterns, projects, blobRecords };
}

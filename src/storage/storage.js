import { getDb, STORES } from './db.js';
import { normalizeProject } from './normalize.js';

/*
 * API-lager för all datalagring (§5 i specen): komponenter pratar bara med
 * detta modul-API, aldrig direkt med IndexedDB. Sync (Nivå 2) kan senare
 * läggas till bakom samma interface.
 *
 * Alla entiteter: { id, createdAt, updatedAt, deletedAt, ...fält }.
 * Borttagning är alltid soft delete (deletedAt sätts); tillhörande blobbar
 * hårdraderas för att frigöra utrymme — tombstone-posten finns kvar för sync.
 */

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Fallback för äldre WebViews
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function now() {
  return new Date().toISOString();
}

function newEntity(fields) {
  const t = now();
  return { id: uuid(), createdAt: t, updatedAt: t, deletedAt: null, ...fields };
}

async function getAllActive(storeName) {
  const db = await getDb();
  const all = await db.getAll(storeName);
  return all.filter((e) => !e.deletedAt);
}

async function getActive(storeName, id) {
  if (!id) return null;
  const db = await getDb();
  const e = await db.get(storeName, id);
  return e && !e.deletedAt ? e : null;
}

async function patch(storeName, id, changes) {
  const db = await getDb();
  const existing = await db.get(storeName, id);
  if (!existing) throw new Error(`Posten finns inte: ${storeName}/${id}`);
  const updated = { ...existing, ...changes, id, updatedAt: now() };
  await db.put(storeName, updated);
  return updated;
}

async function softDelete(storeName, id) {
  return patch(storeName, id, { deletedAt: now() });
}

// ---------- Blobbar ----------

export async function putBlob(blob, meta = {}) {
  const db = await getDb();
  const record = { id: uuid(), blob, type: blob.type, size: blob.size, createdAt: now(), ...meta };
  await db.put(STORES.blobs, record);
  return record.id;
}

export async function getBlob(id) {
  if (!id) return null;
  const db = await getDb();
  const record = await db.get(STORES.blobs, id);
  return record?.blob ?? null;
}

export async function deleteBlobHard(id) {
  if (!id) return;
  const db = await getDb();
  await db.delete(STORES.blobs, id);
}

// ---------- Mappar ----------

export async function listFolders() {
  const folders = await getAllActive(STORES.folders);
  return folders.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'sv'));
}

export async function createFolder(name) {
  const db = await getDb();
  const existing = await listFolders();
  const folder = newEntity({ name: name.trim(), sortOrder: existing.length });
  await db.put(STORES.folders, folder);
  return folder;
}

export async function renameFolder(id, name) {
  return patch(STORES.folders, id, { name: name.trim() });
}

export async function deleteFolder(id) {
  // Mönster i mappen flyttas till Osorterat (folderId = null)
  const patterns = await listPatterns(id);
  for (const p of patterns) {
    await patch(STORES.patterns, p.id, { folderId: null });
  }
  return softDelete(STORES.folders, id);
}

// ---------- Mönster ----------

export async function listPatterns(folderId) {
  const patterns = await getAllActive(STORES.patterns);
  const filtered =
    folderId === undefined ? patterns : patterns.filter((p) => (p.folderId ?? null) === folderId);
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

export async function getPattern(id) {
  return getActive(STORES.patterns, id);
}

export async function createPattern({ name, folderId, fileBlobId, thumbBlobId = null, fileSize, pageCount }) {
  const db = await getDb();
  const pattern = newEntity({
    name: name.trim(),
    folderId: folderId ?? null,
    fileBlobId,
    thumbBlobId,
    fileSize,
    pageCount,
  });
  await db.put(STORES.patterns, pattern);
  return pattern;
}

export async function updatePattern(id, changes) {
  return patch(STORES.patterns, id, changes);
}

export async function deletePattern(id) {
  const pattern = await getActive(STORES.patterns, id);
  if (pattern?.fileBlobId) await deleteBlobHard(pattern.fileBlobId);
  if (pattern?.thumbBlobId) await deleteBlobHard(pattern.thumbBlobId);
  return softDelete(STORES.patterns, id);
}

// ---------- Projekt ----------

export const DEFAULT_COUNTERS = () => [
  { id: uuid(), label: 'Varv', value: 0, totalTicks: 0 },
  { id: uuid(), label: 'Räknare 2', value: 0, totalTicks: 0 },
  { id: uuid(), label: 'Räknare 3', value: 0, totalTicks: 0 },
];

export const DEFAULT_VIEW_STATE = () => ({
  page: 1,
  zoom: 1,
  scrollX: 0,
  scrollY: 0,
  band: { orientation: 'horisontell', positionByPage: {}, positionByPageV: {}, visible: true },
});

export async function listProjects(status) {
  const projects = await getAllActive(STORES.projects);
  const filtered = status ? projects.filter((p) => p.status === status) : projects;
  return filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getProject(id) {
  return getActive(STORES.projects, id);
}

export async function createProject({ name, patternId = null, color = null }) {
  const db = await getDb();
  const project = newEntity({
    name: name.trim(),
    status: 'pågående',
    patternId,
    color, // id i garnpaletten (yarnColors.js); null = appens accentfärg
    viewState: DEFAULT_VIEW_STATE(),
    counters: DEFAULT_COUNTERS(),
    countersLocked: false,
    countersCollapsed: false, // läsremsan: panelen hopfälld till en smal remsa
    yarn: '',
    yarnAmount: '',
    needleSize: '',
    madeSize: '',
    difficulty: null,
    notes: '',
    photoBlobIds: [],
    finishedAt: null,
    datesEstimated: false,
  });
  project.startedAt = project.createdAt;
  await db.put(STORES.projects, project);
  return project;
}

export async function updateProject(id, changes) {
  return patch(STORES.projects, id, changes);
}

export async function deleteProject(id) {
  const project = await getActive(STORES.projects, id);
  if (project) {
    for (const blobId of project.photoBlobIds || []) await deleteBlobHard(blobId);
  }
  return softDelete(STORES.projects, id);
}

// ---------- Måttbanken ----------

export async function listPersons() {
  const persons = await getAllActive(STORES.persons);
  return persons.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

export async function createPerson(name) {
  const db = await getDb();
  const person = newEntity({ name: name.trim(), rows: [] }); // rows: [{ id, label, value }]
  await db.put(STORES.persons, person);
  return person;
}

export async function updatePerson(id, changes) {
  return patch(STORES.persons, id, changes);
}

export async function deletePerson(id) {
  return softDelete(STORES.persons, id);
}

// ---------- Garnkorgen ----------

export async function listYarns() {
  const yarns = await getAllActive(STORES.yarns);
  return yarns.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function createYarn(fields) {
  const db = await getDb();
  const yarn = newEntity({
    name: '',
    colorName: '',
    amount: '',
    note: '',
    photoBlobId: null,
    ...fields,
  });
  await db.put(STORES.yarns, yarn);
  return yarn;
}

export async function updateYarn(id, changes) {
  return patch(STORES.yarns, id, changes);
}

export async function deleteYarn(id) {
  const yarn = await getActive(STORES.yarns, id);
  if (yarn?.photoBlobId) await deleteBlobHard(yarn.photoBlobId);
  return softDelete(STORES.yarns, id);
}

// ---------- Inställningar ----------

const SETTINGS_DEFAULTS = {
  lastBackupAt: null,
  lastOpenedProjectId: null,
  bandOpacity: 0.4,
  bandThickness: 24, // i PDF-punkter (dokumentkoordinater)
  keepAwake: true, // håll skärmen vaken i projektvyn
};

export async function getSettings() {
  const db = await getDb();
  const rows = await db.getAll(STORES.settings);
  const settings = { ...SETTINGS_DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

export async function updateSettings(changes) {
  const db = await getDb();
  const tx = db.transaction(STORES.settings, 'readwrite');
  for (const [key, value] of Object.entries(changes)) {
    await tx.store.put({ key, value });
  }
  await tx.done;
  return getSettings();
}

// ---------- Export/underlag för backup ----------

export async function dumpAll() {
  const db = await getDb();
  const [folders, patterns, projects, persons, yarns, settings] = await Promise.all([
    db.getAll(STORES.folders),
    db.getAll(STORES.patterns),
    db.getAll(STORES.projects),
    db.getAll(STORES.persons),
    db.getAll(STORES.yarns),
    getSettings(),
  ]);
  const blobRecords = await db.getAll(STORES.blobs);
  return { folders, patterns, projects, persons, yarns, settings, blobRecords };
}

const DATA_STORES = [STORES.folders, STORES.patterns, STORES.projects, STORES.persons, STORES.yarns, STORES.blobs];

function writeDump(tx, { folders, patterns, projects, persons = [], yarns = [], blobRecords }) {
  for (const f of folders) tx.objectStore(STORES.folders).put(f);
  for (const p of patterns) tx.objectStore(STORES.patterns).put(p);
  // Projekt från äldre backuper saknar datum/totalTicks/lås — backfyll vid inläsning
  for (const p of projects) tx.objectStore(STORES.projects).put(normalizeProject(p));
  for (const p of persons) tx.objectStore(STORES.persons).put(p);
  for (const y of yarns) tx.objectStore(STORES.yarns).put(y);
  for (const b of blobRecords) tx.objectStore(STORES.blobs).put(b);
}

export async function replaceAll(dump) {
  const db = await getDb();
  const tx = db.transaction(DATA_STORES, 'readwrite');
  await Promise.all(DATA_STORES.map((name) => tx.objectStore(name).clear()));
  writeDump(tx, dump);
  await tx.done;
}

export async function writeMerged(dump) {
  const db = await getDb();
  const tx = db.transaction(DATA_STORES, 'readwrite');
  writeDump(tx, dump);
  await tx.done;
}

// ---------- Lagringsstatus ----------

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* stöds inte — ok */
  }
  return false;
}

export async function storageEstimate() {
  try {
    if (navigator.storage?.estimate) return await navigator.storage.estimate();
  } catch {
    /* stöds inte */
  }
  return null;
}

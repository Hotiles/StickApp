import { Zip, ZipPassThrough, unzipSync, strToU8, strFromU8 } from 'fflate';
import { dumpAll, replaceAll, writeMerged, updateSettings, deleteBlobHard, now } from './storage.js';
import { mergeDump } from './merge.js';

export const BACKUP_FORMAT_VERSION = 1;

/*
 * Backupformat: en zip med
 *   data.json     – all strukturerad data + blob-metadata
 *   blobs/<id>    – varje PDF/foto som egen fil
 */

// Hur mycket zip-utdata vi buffrar i JS-heapen innan vi viker in det i en
// (disk-backad) Blob. Håller minnestoppen låg på iOS oavsett bibliotekets storlek.
const BACKUP_FLUSH_BYTES = 4 * 1024 * 1024;

export async function createBackupZip() {
  const { folders, patterns, projects, persons, yarns, settings, blobRecords } = await dumpAll();

  const data = {
    app: 'stickan',
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now(),
    folders,
    patterns,
    projects,
    persons,
    yarns,
    settings: { lastBackupAt: settings.lastBackupAt },
    blobs: blobRecords.map(({ id, type, size, createdAt }) => ({ id, type, size, createdAt })),
  };

  // Streama zip:en istället för att bygga hela biblioteket i minnet på en gång.
  // Varje blob läses in, matas till zip-strömmen och släpps innan nästa läses —
  // och utdatan viks löpande in i en växande Blob, som webbläsaren backar på
  // disk. Toppminnet blir då ~största enskilda filen, inte hela biblioteket.
  let outBlob = new Blob([], { type: 'application/zip' });
  let pending = [];
  let pendingBytes = 0;
  const flush = () => {
    if (!pending.length) return;
    outBlob = new Blob([outBlob, ...pending], { type: 'application/zip' });
    pending = [];
    pendingBytes = 0;
  };

  await new Promise((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (chunk) {
        pending.push(chunk);
        pendingBytes += chunk.length;
        if (pendingBytes >= BACKUP_FLUSH_BYTES) flush();
      }
      if (final) resolve();
    });

    (async () => {
      try {
        const dataEntry = new ZipPassThrough('data.json'); // store — JSON är litet, PDF/JPEG redan komprimerade
        zip.add(dataEntry);
        dataEntry.push(strToU8(JSON.stringify(data, null, 2)), true);
        for (const record of blobRecords) {
          const entry = new ZipPassThrough(`blobs/${record.id}`);
          zip.add(entry);
          entry.push(new Uint8Array(await record.blob.arrayBuffer()), true);
        }
        zip.end();
      } catch (e) {
        reject(e);
      }
    })();
  });

  flush();
  const stamp = new Date().toISOString().slice(0, 10);
  return new File([outBlob], `stickan-backup-${stamp}.zip`, { type: 'application/zip' });
}

export async function exportBackup() {
  const file = await createBackupZip();
  let shared = false;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Stickan-backup' });
      shared = true;
    } catch (err) {
      if (err?.name === 'AbortError') return { done: false }; // användaren ångrade sig
      // annars: falla tillbaka på nedladdning
    }
  }
  if (!shared) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  await updateSettings({ lastBackupAt: now() });
  return { done: true };
}

/** Läser och validerar en backup-zip. Returnerar innehåll + sammanfattning för förhandsvisning. */
export async function readBackupZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let entries;
  try {
    entries = unzipSync(buf);
  } catch {
    throw new Error('Filen kunde inte läsas som en zip-fil.');
  }
  const dataRaw = entries['data.json'];
  if (!dataRaw) throw new Error('Ingen data.json i filen — är det verkligen en Stickan-backup?');

  let data;
  try {
    data = JSON.parse(strFromU8(dataRaw));
  } catch {
    throw new Error('data.json är skadad och kunde inte tolkas.');
  }
  if (data.app !== 'stickan') throw new Error('Filen är inte en Stickan-backup.');
  if (data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('Backupen är gjord med en nyare version av appen. Uppdatera appen först.');
  }
  for (const key of ['folders', 'patterns', 'projects']) {
    if (!Array.isArray(data[key])) throw new Error(`Backupen saknar fältet "${key}".`);
  }

  const blobMeta = new Map((data.blobs || []).map((b) => [b.id, b]));
  const blobRecords = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith('blobs/')) continue;
    const id = path.slice('blobs/'.length);
    if (!id) continue;
    const meta = blobMeta.get(id) || {};
    blobRecords.push({
      id,
      blob: new Blob([bytes], { type: meta.type || 'application/octet-stream' }),
      type: meta.type || 'application/octet-stream',
      size: bytes.length,
      createdAt: meta.createdAt || now(),
    });
  }

  const active = (list) => list.filter((e) => !e.deletedAt).length;
  return {
    data,
    blobRecords,
    summary: {
      exportedAt: data.exportedAt,
      patternCount: active(data.patterns),
      projectCount: active(data.projects),
      folderCount: active(data.folders),
      photoCount: blobRecords.length,
    },
  };
}

export async function restoreReplace({ data, blobRecords }) {
  await replaceAll({
    folders: data.folders,
    patterns: data.patterns,
    projects: data.projects,
    persons: data.persons || [],
    yarns: data.yarns || [],
    blobRecords,
  });
}

export async function restoreMerge({ data, blobRecords }) {
  const local = await dumpAll();
  const merged = mergeDump(local, {
    folders: data.folders,
    patterns: data.patterns,
    projects: data.projects,
    persons: data.persons || [],
    yarns: data.yarns || [],
    blobRecords,
  });
  await writeMerged(merged);
  // Lokala blobbar vars ägare tombstone:ades av mergen är nu föräldralösa —
  // radera dem så att t.ex. borttagna mönster-PDF:er inte ligger kvar och tar plats.
  const keep = new Set(merged.blobRecords.map((b) => b.id));
  for (const record of local.blobRecords) {
    if (!keep.has(record.id)) await deleteBlobHard(record.id);
  }
}

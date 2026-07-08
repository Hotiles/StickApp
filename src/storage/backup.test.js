import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unzipSync } from 'fflate';

// createBackupZip/readBackupZip går via storage.js (IndexedDB). Vi mockar bort
// datalagret och testar bara zip-strömningen: att en streamad backup blir en
// giltig, läsbar zip vars bloatbytes överlever round-trip — även när utdatan
// korsar flush-tröskeln och alltså viks in i Blob:en i flera omgångar.
const state = { dump: null };
vi.mock('./storage.js', () => ({
  dumpAll: () => Promise.resolve(state.dump),
  updateSettings: () => Promise.resolve(),
  replaceAll: () => Promise.resolve(),
  writeMerged: () => Promise.resolve(),
  deleteBlobHard: () => Promise.resolve(),
  now: () => '2026-07-08T00:00:00.000Z',
}));

const { createBackupZip, readBackupZip } = await import('./backup.js');

const blobRecord = (id, bytes, type = 'application/pdf') => ({
  id,
  blob: new Blob([bytes], { type }),
  type,
  size: bytes.length,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const baseDump = () => ({
  folders: [{ id: 'f1', name: 'Vantar', deletedAt: null }],
  patterns: [{ id: 'p1', name: 'Mönster', deletedAt: null }],
  projects: [{ id: 'pr1', name: 'Projekt', deletedAt: null }],
  persons: [],
  yarns: [],
  settings: { lastBackupAt: '2026-06-01T00:00:00.000Z' },
  blobRecords: [],
});

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

beforeEach(() => {
  state.dump = baseDump();
});

describe('createBackupZip – streamad', () => {
  it('producerar en giltig, läsbar zip utan bloatar', async () => {
    const file = await createBackupZip();
    expect(file.name).toMatch(/^stickan-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(file.type).toBe('application/zip');

    const entries = unzipSync(await bytesOf(file));
    expect(Object.keys(entries)).toEqual(['data.json']);

    const parsed = await readBackupZip(file);
    expect(parsed.summary.patternCount).toBe(1);
    expect(parsed.summary.photoCount).toBe(0);
    expect(parsed.data.settings.lastBackupAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('round-trippar bloatbytes exakt', async () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([9, 8, 7]);
    state.dump.blobRecords = [blobRecord('blob-a', a), blobRecord('blob-b', b, 'image/jpeg')];

    const parsed = await readBackupZip(await createBackupZip());
    const byId = Object.fromEntries(parsed.blobRecords.map((r) => [r.id, r]));

    expect(parsed.summary.photoCount).toBe(2);
    expect(await bytesOf(byId['blob-a'].blob)).toEqual(a);
    expect(await bytesOf(byId['blob-b'].blob)).toEqual(b);
    expect(byId['blob-b'].type).toBe('image/jpeg');
  });

  it('förblir en giltig zip när utdatan korsar flush-tröskeln', async () => {
    // > BACKUP_FLUSH_BYTES (4 MB) tvingar flera flush-varv under strömningen.
    const big = new Uint8Array(5 * 1024 * 1024);
    for (let i = 0; i < big.length; i += 4096) big[i] = i & 0xff;
    state.dump.blobRecords = [blobRecord('big', big)];

    const parsed = await readBackupZip(await createBackupZip());
    expect(parsed.summary.photoCount).toBe(1);
    const got = await bytesOf(parsed.blobRecords[0].blob);
    // Buffer.equals är en memcmp — undviker vitests element-för-element-toEqual på 5 MB.
    expect(Buffer.from(got).equals(Buffer.from(big))).toBe(true);
  });
});

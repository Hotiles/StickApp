import { describe, it, expect } from 'vitest';
import { mergeEntities, mergeDump } from './merge.js';

const entity = (id, updatedAt, extra = {}) => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
  deletedAt: null,
  ...extra,
});

describe('mergeEntities – nyast vinner', () => {
  it('behåller lokala poster som saknas i importen', () => {
    const local = [entity('a', '2026-01-02T00:00:00.000Z')];
    expect(mergeEntities(local, [])).toEqual(local);
  });

  it('lägger till nya poster från importen', () => {
    const incoming = [entity('b', '2026-01-02T00:00:00.000Z')];
    expect(mergeEntities([], incoming)).toEqual(incoming);
  });

  it('låter nyare import vinna över äldre lokal post', () => {
    const local = [entity('a', '2026-01-01T00:00:00.000Z', { name: 'gammal' })];
    const incoming = [entity('a', '2026-01-05T00:00:00.000Z', { name: 'ny' })];
    expect(mergeEntities(local, incoming)[0].name).toBe('ny');
  });

  it('låter nyare lokal post vinna över äldre import', () => {
    const local = [entity('a', '2026-01-05T00:00:00.000Z', { name: 'lokal' })];
    const incoming = [entity('a', '2026-01-01T00:00:00.000Z', { name: 'import' })];
    expect(mergeEntities(local, incoming)[0].name).toBe('lokal');
  });

  it('respekterar nyare tombstone (soft delete) från importen', () => {
    const local = [entity('a', '2026-01-01T00:00:00.000Z')];
    const incoming = [
      { ...entity('a', '2026-01-05T00:00:00.000Z'), deletedAt: '2026-01-05T00:00:00.000Z' },
    ];
    expect(mergeEntities(local, incoming)[0].deletedAt).not.toBeNull();
  });

  it('klarar poster utan updatedAt utan att krascha', () => {
    const local = [{ id: 'a' }];
    const incoming = [entity('a', '2026-01-05T00:00:00.000Z', { name: 'ny' })];
    expect(mergeEntities(local, incoming)[0].name).toBe('ny');
  });
});

describe('mergeDump – blobbar', () => {
  const basePattern = (id, blobId, updatedAt, deletedAt = null) => ({
    ...entity(id, updatedAt),
    deletedAt,
    fileBlobId: blobId,
    folderId: null,
    name: 'Mönster',
  });

  const emptyDump = { folders: [], patterns: [], projects: [], blobRecords: [] };

  it('tar med blobbar för importerade mönster', () => {
    const incoming = {
      ...emptyDump,
      patterns: [basePattern('p1', 'b1', '2026-01-02T00:00:00.000Z')],
      blobRecords: [{ id: 'b1' }],
    };
    const merged = mergeDump(emptyDump, incoming);
    expect(merged.blobRecords.map((b) => b.id)).toEqual(['b1']);
  });

  it('tar inte in blobbar vars ägare är borttagen efter mergen', () => {
    const local = {
      ...emptyDump,
      patterns: [basePattern('p1', 'b1', '2026-01-01T00:00:00.000Z')],
      blobRecords: [{ id: 'b1' }],
    };
    const incoming = {
      ...emptyDump,
      patterns: [basePattern('p1', 'b1', '2026-01-05T00:00:00.000Z', '2026-01-05T00:00:00.000Z')],
      blobRecords: [{ id: 'b1' }],
    };
    const merged = mergeDump(local, incoming);
    expect(merged.blobRecords).toEqual([]);
    expect(merged.patterns[0].deletedAt).not.toBeNull();
  });

  it('duplicerar inte blobbar som redan finns lokalt', () => {
    const local = {
      ...emptyDump,
      patterns: [basePattern('p1', 'b1', '2026-01-01T00:00:00.000Z')],
      blobRecords: [{ id: 'b1', local: true }],
    };
    const incoming = {
      ...emptyDump,
      patterns: [basePattern('p1', 'b1', '2026-01-01T00:00:00.000Z')],
      blobRecords: [{ id: 'b1', local: false }],
    };
    const merged = mergeDump(local, incoming);
    expect(merged.blobRecords).toHaveLength(1);
    expect(merged.blobRecords[0].local).toBe(true);
  });

  it('tar med projektfoton från importen', () => {
    const incoming = {
      ...emptyDump,
      projects: [
        {
          ...entity('pr1', '2026-01-02T00:00:00.000Z'),
          name: 'Sockor',
          status: 'färdigt',
          photoBlobIds: ['f1', 'f2'],
        },
      ],
      blobRecords: [{ id: 'f1' }, { id: 'f2' }],
    };
    const merged = mergeDump(emptyDump, incoming);
    expect(merged.blobRecords.map((b) => b.id).sort()).toEqual(['f1', 'f2']);
  });
});

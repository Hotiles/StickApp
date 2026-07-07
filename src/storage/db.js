import { openDB } from 'idb';

/*
 * IndexedDB-uppsättning. All åtkomst utifrån ska gå via storage.js —
 * inga direkta anrop hit från komponenter.
 */
export const DB_NAME = 'stickan';
export const DB_VERSION = 2;

export const STORES = {
  folders: 'folders',
  patterns: 'patterns',
  projects: 'projects',
  blobs: 'blobs',
  settings: 'settings',
  persons: 'persons', // måttbanken: personer med mått
  yarns: 'yarns', // garnkorgen: garn man har hemma
};

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORES.folders)) {
          db.createObjectStore(STORES.folders, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.patterns)) {
          const store = db.createObjectStore(STORES.patterns, { keyPath: 'id' });
          store.createIndex('folderId', 'folderId');
        }
        if (!db.objectStoreNames.contains(STORES.projects)) {
          const store = db.createObjectStore(STORES.projects, { keyPath: 'id' });
          store.createIndex('status', 'status');
        }
        if (!db.objectStoreNames.contains(STORES.blobs)) {
          db.createObjectStore(STORES.blobs, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
        // v2: måttbank + garnkorg
        if (!db.objectStoreNames.contains(STORES.persons)) {
          db.createObjectStore(STORES.persons, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.yarns)) {
          db.createObjectStore(STORES.yarns, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/** Endast för tester. */
export function resetDbForTests() {
  dbPromise = null;
}

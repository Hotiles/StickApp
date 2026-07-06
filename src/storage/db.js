import { openDB } from 'idb';

/*
 * IndexedDB-uppsättning. All åtkomst utifrån ska gå via storage.js —
 * inga direkta anrop hit från komponenter.
 */
export const DB_NAME = 'stickan';
export const DB_VERSION = 1;

export const STORES = {
  folders: 'folders',
  patterns: 'patterns',
  projects: 'projects',
  blobs: 'blobs',
  settings: 'settings',
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
      },
    });
  }
  return dbPromise;
}

/** Endast för tester. */
export function resetDbForTests() {
  dbPromise = null;
}

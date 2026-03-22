import type { EvalHistoryEntry } from './evalTypes';

const DB_NAME = 'aigle-movie-db';
const DB_VERSION = 1;
const HISTORY_STORE = 'evalHistory';
const PROMPT_STORE = 'promptCache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('source', 'source');
      }
      if (!db.objectStoreNames.contains(PROMPT_STORE)) {
        db.createObjectStore(PROMPT_STORE, { keyPath: 'tabType' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHistoryEntry(entry: EvalHistoryEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllHistory(): Promise<EvalHistoryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const req = tx.objectStore(HISTORY_STORE).index('timestamp').openCursor(null, 'prev');
    const results: EvalHistoryEntry[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as EvalHistoryEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveEditedPrompt(tabType: string, text: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROMPT_STORE, 'readwrite');
    tx.objectStore(PROMPT_STORE).put({ tabType, editedText: text, lastModified: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEditedPrompt(tabType: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROMPT_STORE, 'readonly');
    const req = tx.objectStore(PROMPT_STORE).get(tabType);
    req.onsuccess = () => resolve(req.result?.editedText ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearEditedPrompt(tabType: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROMPT_STORE, 'readwrite');
    tx.objectStore(PROMPT_STORE).delete(tabType);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

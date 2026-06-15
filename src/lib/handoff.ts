// Reliable client→client handoff for the Image Studio → Storyboard transfer.
//
// We previously used sessionStorage, but on mobile Safari its small (~5 MB)
// quota rejects multiple base64 reference images and the transfer silently
// failed. IndexedDB has a far larger quota and handles structured data, so we
// use it as the primary store and keep sessionStorage as a fallback for any
// browser where IndexedDB is unavailable (e.g. private-mode quirks).

const DB_NAME = "sb_handoff_db";
const STORE = "kv";
const KEY = "studio_handoff";
const SS_KEY = "sb_studio_handoff";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist the handoff payload. Resolves once it is durably stored. */
export async function saveHandoff(data: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return;
  } catch {
    // Fall back to sessionStorage (may itself throw on quota — surfaced to caller).
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(data));
  }
}

/** Read and CLEAR the handoff payload. Returns null when there is nothing. */
export async function loadHandoff<T>(): Promise<T | null> {
  try {
    const db = await openDb();
    const val = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(KEY);
      rq.onsuccess = () => resolve(rq.result as T | undefined);
      rq.onerror = () => reject(rq.error);
    });
    if (val !== undefined && val !== null) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      db.close();
      return val;
    }
    db.close();
  } catch {
    /* fall through to sessionStorage */
  }
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (raw) {
      window.sessionStorage.removeItem(SS_KEY);
      return JSON.parse(raw) as T;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Character preset — save the current cast (names / roles / appearance + the
// uploaded frontal photos) ONCE and reload it into any project, so making
// several projects with the SAME characters no longer means re-uploading every
// time. Stored in IndexedDB (large quota for base64 photos) with a localStorage
// fallback. There is a single preset; loading keeps it (so it can be reused
// across projects) and the user clears it explicitly when done, so it never
// lingers. Mirrors the proven handoff.ts storage pattern.

const DB_NAME = "sb_char_preset_db";
const STORE = "kv";
const KEY = "cast_preset";
const LS_KEY = "sb_cast_preset";

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

/** Save (overwrite) the single character preset. */
export async function saveCharacterPreset(data: unknown): Promise<void> {
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
    // Fall back to localStorage (may itself throw on quota — surfaced to caller).
    window.localStorage.setItem(LS_KEY, JSON.stringify(data));
  }
}

/** Read the preset WITHOUT clearing it, so it can be reused across projects. */
export async function loadCharacterPreset<T>(): Promise<T | null> {
  try {
    const db = await openDb();
    const val = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(KEY);
      rq.onsuccess = () => resolve(rq.result as T | undefined);
      rq.onerror = () => reject(rq.error);
    });
    db.close();
    if (val !== undefined && val !== null) return val;
  } catch {
    /* fall through to localStorage */
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return null;
}

/** Delete the preset so it no longer lingers. */
export async function clearCharacterPreset(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** True when a non-empty preset is stored. */
export async function hasCharacterPreset(): Promise<boolean> {
  const preset = await loadCharacterPreset<unknown[]>();
  return Array.isArray(preset) && preset.length > 0;
}

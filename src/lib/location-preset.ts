// ============================================================
// LOCATION PRESETS — the user's own places, saved once and reused in any
// project, like the cast preset. A library holds sets ("Nhà tôi", "Văn
// phòng"…), each with rooms (kitchen, living room, bedroom…) and their
// photos. Uploading photos into a room saves them; a room is pushed into a
// 10-second segment with one click and can serve several segments at once
// (its photos travel to the server once, under the room's name).
// Stored in IndexedDB (large quota for base64 photos) with a localStorage
// fallback, following character-preset.ts.
// ============================================================

export interface PresetPhoto {
  id: string;
  base64: string;
  fileName: string;
  /** Rebuilt from base64 on load (blob previews die with the page). */
  preview?: string;
}

export interface LocationRoom {
  id: string;
  name: string;
  images: PresetPhoto[];
}

export interface LocationGroup {
  id: string;
  name: string;
  rooms: LocationRoom[];
}

export interface LocationLibrary {
  version: 1;
  groups: LocationGroup[];
}

export const MAX_ROOM_PHOTOS = 5;

export const GROUP_SUGGESTIONS = ["Nhà tôi", "Nhà ông bà", "Văn phòng", "Quán cà phê", "Cửa hàng"];
export const ROOM_SUGGESTIONS = [
  "Phòng khách",
  "Phòng bếp",
  "Phòng ngủ",
  "Phòng ăn",
  "Ban công",
  "Phòng làm việc",
  "Sân trước",
  "Cổng nhà",
  "Cầu thang",
  "Phòng tắm",
];

export const emptyLibrary = (): LocationLibrary => ({ version: 1, groups: [] });

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const stripDataUrl = (value: string) => value.replace(/^data:[^,]+,/, "");
const clean = (value: unknown, max = 60) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** A name not yet used in `taken` ("Phòng ngủ" → "Phòng ngủ 2"). */
function uniqueName(name: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) if (!used.has(`${name} ${n}`.toLowerCase())) return `${name} ${n}`;
}

function normalizePhoto(raw: unknown, index: number): PresetPhoto | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.base64 !== "string" || !r.base64) return null;
  const base64 = stripDataUrl(r.base64);
  return {
    id: clean(r.id, 80) || `photo-${index + 1}`,
    base64,
    fileName: clean(r.fileName, 120) || "location.jpg",
    preview: `data:image/jpeg;base64,${base64}`,
  };
}

/** Clean a stored library and rebuild every preview from its bytes. */
export function normalizeLibrary(raw: unknown): LocationLibrary {
  const groups = Array.isArray((raw as LocationLibrary | null)?.groups) ? (raw as LocationLibrary).groups : [];
  return {
    version: 1,
    groups: groups
      .map((g) => ({
        id: clean(g?.id, 80) || newId("set"),
        name: clean(g?.name) || "Bối cảnh",
        rooms: (Array.isArray(g?.rooms) ? g.rooms : []).map((room) => ({
          id: clean(room?.id, 80) || newId("room"),
          name: clean(room?.name) || "Phòng",
          images: (Array.isArray(room?.images) ? room.images : [])
            .map(normalizePhoto)
            .filter((p): p is PresetPhoto => p !== null)
            .slice(0, MAX_ROOM_PHOTOS),
        })),
      })),
  };
}

export function addGroup(lib: LocationLibrary, name: string): { library: LocationLibrary; groupId: string } {
  const id = newId("set");
  const label = uniqueName(clean(name) || "Nhà tôi", lib.groups.map((g) => g.name));
  return { library: { ...lib, groups: [...lib.groups, { id, name: label, rooms: [] }] }, groupId: id };
}

export function renameGroup(lib: LocationLibrary, groupId: string, name: string): LocationLibrary {
  const label = clean(name);
  if (!label) return lib;
  const others = lib.groups.filter((g) => g.id !== groupId).map((g) => g.name);
  return { ...lib, groups: lib.groups.map((g) => (g.id === groupId ? { ...g, name: uniqueName(label, others) } : g)) };
}

export function removeGroup(lib: LocationLibrary, groupId: string): LocationLibrary {
  return { ...lib, groups: lib.groups.filter((g) => g.id !== groupId) };
}

export function addRoom(lib: LocationLibrary, groupId: string, name: string): { library: LocationLibrary; roomId: string } {
  const id = newId("room");
  return {
    library: {
      ...lib,
      groups: lib.groups.map((g) =>
        g.id === groupId
          ? { ...g, rooms: [...g.rooms, { id, name: uniqueName(clean(name) || "Phòng", g.rooms.map((r) => r.name)), images: [] }] }
          : g
      ),
    },
    roomId: id,
  };
}

export function updateRoom(
  lib: LocationLibrary,
  roomId: string,
  patch: { name?: string; images?: Array<{ id: string; base64: string; fileName: string }> }
): LocationLibrary {
  return {
    ...lib,
    groups: lib.groups.map((g) => ({
      ...g,
      rooms: g.rooms.map((room) => {
        if (room.id !== roomId) return room;
        const others = g.rooms.filter((r) => r.id !== roomId).map((r) => r.name);
        const name = patch.name !== undefined && clean(patch.name) ? uniqueName(clean(patch.name), others) : room.name;
        const images = patch.images
          ? patch.images
              .map((img, i) => normalizePhoto(img, i))
              .filter((p): p is PresetPhoto => p !== null)
              .slice(0, MAX_ROOM_PHOTOS)
          : room.images;
        return { ...room, name, images };
      }),
    })),
  };
}

export function removeRoom(lib: LocationLibrary, roomId: string): LocationLibrary {
  return { ...lib, groups: lib.groups.map((g) => ({ ...g, rooms: g.rooms.filter((r) => r.id !== roomId) })) };
}

export function findRoom(lib: LocationLibrary, roomId: string): { group: LocationGroup; room: LocationRoom } | null {
  for (const group of lib.groups) {
    const room = group.rooms.find((r) => r.id === roomId);
    if (room) return { group, room };
  }
  return null;
}

/** The place name the script and the vision analysis see: "Phòng bếp (Nhà tôi)". */
export const placeName = (group: LocationGroup, room: LocationRoom) => `${room.name} (${group.name})`;

export const roomCount = (lib: LocationLibrary) => lib.groups.reduce((n, g) => n + g.rooms.filter((r) => r.images.length).length, 0);

// ─── Segment assignment (the form's per-segment location sets) ──────────────

export interface SegmentPlace<T> {
  name: string;
  description: string;
  images: T[];
  /** 1-based 10s segments this place serves. */
  sceneIndices?: number[];
  /** Set when the place comes from the saved library (kept in sync with it). */
  presetRoomId?: string;
}

const servesSegment = <T>(place: SegmentPlace<T>, n: number) => (place.sceneIndices ?? []).includes(n);

/** Take segment `n` out of every place; places left with no segment are dropped. */
function releaseSegment<T>(places: SegmentPlace<T>[], n: number): SegmentPlace<T>[] {
  return places
    .map((p) => (servesSegment(p, n) ? { ...p, sceneIndices: (p.sceneIndices ?? []).filter((i) => i !== n) } : p))
    .filter((p) => (p.sceneIndices ?? []).length > 0);
}

export function placeForSegment<T>(places: SegmentPlace<T>[], n: number): SegmentPlace<T> | undefined {
  return places.find((p) => servesSegment(p, n));
}

/** Photos uploaded straight into one segment: that segment gets its own place. */
export function setSegmentPhotos<T>(places: SegmentPlace<T>[], n: number, images: T[]): SegmentPlace<T>[] {
  const rest = releaseSegment(places, n);
  return images.length ? [...rest, { name: `Đoạn ${n}`, description: "", images, sceneIndices: [n] }] : rest;
}

/** Push a saved room into segment `n` (or take it out again when it is already there). */
export function toggleRoomOnSegment<T>(
  places: SegmentPlace<T>[],
  n: number,
  room: { id: string; name: string; images: T[] }
): SegmentPlace<T>[] {
  const current = placeForSegment(places, n);
  if (current?.presetRoomId === room.id) return releaseSegment(places, n);
  const rest = releaseSegment(places, n);
  const existing = rest.find((p) => p.presetRoomId === room.id);
  if (existing) return rest.map((p) => (p === existing ? { ...p, sceneIndices: [...(p.sceneIndices ?? []), n].sort((a, b) => a - b) } : p));
  if (!room.images.length) return rest;
  return [...rest, { name: room.name, description: "", images: room.images, sceneIndices: [n], presetRoomId: room.id }];
}

/** The place of segment `from` also serves every empty segment up to `count` (no photo copies). */
export function shareWithEmptySegments<T>(places: SegmentPlace<T>[], from: number, count: number): SegmentPlace<T>[] {
  const source = placeForSegment(places, from);
  if (!source) return places;
  const empty = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !placeForSegment(places, n));
  if (!empty.length) return places;
  return places.map((p) => (p === source ? { ...p, sceneIndices: [...(p.sceneIndices ?? []), ...empty].sort((a, b) => a - b) } : p));
}

/** Keep pushed rooms in step with the library: new photos or name follow, a deleted or emptied room leaves its segments. */
export function syncPresetPlaces<T>(
  places: SegmentPlace<T>[],
  lib: LocationLibrary,
  toImages: (room: LocationRoom) => T[]
): SegmentPlace<T>[] {
  return places.flatMap((p) => {
    if (!p.presetRoomId) return [p];
    const found = findRoom(lib, p.presetRoomId);
    if (!found || !found.room.images.length) return [];
    const name = placeName(found.group, found.room);
    const sameImages =
      p.images.length === found.room.images.length &&
      found.room.images.every((img, i) => (p.images[i] as { id?: string } | undefined)?.id === img.id);
    return [sameImages && p.name === name ? p : { ...p, name, images: sameImages ? p.images : toImages(found.room) }];
  });
}

// ─── Storage ────────────────────────────────────────────────────────────────

const DB_NAME = "sb_location_preset_db";
const STORE = "kv";
const KEY = "location_library";
const LS_KEY = "sb_location_library";

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

/** Previews are rebuilt on load, so only the bytes are stored. */
const forStorage = (lib: LocationLibrary): LocationLibrary => ({
  version: 1,
  groups: lib.groups.map((g) => ({
    ...g,
    rooms: g.rooms.map((r) => ({ ...r, images: r.images.map(({ preview: _preview, ...photo }) => photo) })),
  })),
});

export async function saveLocationLibrary(lib: LocationLibrary): Promise<void> {
  const data = forStorage(lib);
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

export async function loadLocationLibrary(): Promise<LocationLibrary> {
  try {
    const db = await openDb();
    const val = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(KEY);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    db.close();
    if (val) return normalizeLibrary(val);
  } catch {
    /* fall through to localStorage */
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) return normalizeLibrary(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return emptyLibrary();
}

// ============================================================
// LOCATION BLUEPRINT — the structured source of every place.
//
// The root problem behind furniture drifting between clips was not one room:
// a place only ever existed as free prose ("…: beige sofa behind the family,
// low wooden table at the rug edge, …"), and every downstream prompt re-read
// that prose its own way. A regex parser then guessed a set map from it — and
// returned nothing when the prose was written differently.
//
// Now the planner writes ONE blueprint per location — for ANY kind of place
// (room, shop, street, beach, car, stage…): a short name, the kind of place,
// where the master camera stands, the anchor (main surface / route), the fixed
// elements with their master-view frame zone and relation, and the light. The
// world key, the set map, the place name, the fixed-set locks and the script
// supervisor all read this structure. Older projects without it get a
// blueprint derived from their prose (marked "derived" so the supervisor can
// say so).
// ============================================================
import { buildSetMap, landmarkList, looseLandmarkList, type SetMap, type SetMapPlacement } from "../environment/set-map.ts";
import type { BlueprintElement, BlueprintKind, LocationBlueprint } from "./types.ts";

const str = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const lower = (v: unknown) => str(v).toLocaleLowerCase();
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

const KINDS: BlueprintKind[] = ["interior", "exterior", "vehicle", "other"];
const OUTDOOR = /\b(?:street|alley|lane|road|sidewalk|pavement|market|park|beach|garden|courtyard|square|riverside|river|lake|field|rooftop|terrace|exterior|outdoors?|village|harbou?r|bridge|forest|mountain|desert|yard|playground|campsite|parking)\b/i;
const VEHICLE = /\b(?:car|van|bus|truck|taxi|train|tram|carriage|cabin|cockpit|boat|ship|ferry|plane|aircraft)\b/i;
const INDOOR = /(?<!\p{L})(?:room|kitchen|restaurant|bistro|caf[eé]|office|apartment|flat|bedroom|bathroom|hall|lobby|studio|classroom|library|shop|store|salon|clinic|hospital|corridor|hallway|interior|indoors?|lounge|bar|pub|house|home|temple|pagoda|gym|warehouse|garage)(?!\p{L})/iu;

/** A place name that is a script sentence, not a place ("Continue from the prior end frame."). */
export function junkPlaceName(name: string): boolean {
  const n = str(name);
  if (!n) return true;
  return /^(?:same|continue|continues|continuing|as\s+before|as\s+in|back\s+to|still|again|return)\b/i.test(n) ||
    /\b(?:as|from|of|the|and|to|with)$/i.test(n) ||
    /[.!?]$/.test(n) ||
    n.split(/\s+/).length > 9;
}

/** "obj_paper_box" / "paper_box" → "paper box". */
export function humanLabel(raw: string): string {
  return str(raw).replace(/^(?:obj|prop|product)_/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Last word, singular ("picture cards" → "card", "boxes" → "box", "glass" stays). */
export function headNoun(label: string): string {
  const word = lower(label).split(/\s+/).pop() ?? "";
  if (/(?:x|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Canonical "left|centre|right foreground|midground|background" — only the axes
 * the text actually states (no invented "centre"), or the raw text when it
 * names no zone at all.
 */
export function normalizeFrameZone(zone: unknown): string {
  const z = lower(zone);
  if (!z) return "";
  const x = /\bleft\b/.test(z) ? "left" : /\bright\b/.test(z) ? "right" : /\bcent(?:er|re)|\bmiddle\b|\bcentral\b/.test(z) ? "centre" : "";
  const depth = /\bforeground\b|\bfront\b|\bnear\b|\bclose to (?:the )?camera\b/.test(z)
    ? "foreground"
    : /\bbackground\b|\bback\b|\bfar\b|\brear\b|\bbehind\b/.test(z)
      ? "background"
      : /\bmid(?:dle)?[- ]?ground\b|\bmid\b|\bmiddle\b/.test(z)
        ? "midground"
        : "";
  if (x || depth) return [x, depth].filter(Boolean).join(" ");
  return str(zone).slice(0, 80);
}

function inferKind(text: string): BlueprintKind {
  if (VEHICLE.test(text) && !INDOOR.test(text)) return "vehicle";
  const out = text.search(OUTDOOR);
  const ins = text.search(INDOOR);
  if (out >= 0 && (ins < 0 || out < ins)) return "exterior";
  if (ins >= 0) return "interior";
  return "other";
}

function elementFrom(raw: unknown): BlueprintElement | null {
  if (typeof raw === "string") {
    const [name, rest] = raw.split(/\s+[—–-]\s+|:\s+/, 2);
    const n = str(name);
    return n ? { name: n.slice(0, 80), frame_zone: normalizeFrameZone(rest), relation: normalizeFrameZone(rest) === str(rest) ? "" : str(rest).slice(0, 140) } : null;
  }
  if (!isObj(raw)) return null;
  const name = str(raw.name ?? raw.item ?? raw.element);
  if (!name) return null;
  return {
    name: name.slice(0, 80),
    frame_zone: normalizeFrameZone(raw.frame_zone ?? raw.zone ?? raw.position),
    relation: str(raw.relation ?? raw.placement ?? raw.relative_to).slice(0, 160),
  };
}

export interface BlueprintContext {
  /** Story props (registry objects): a hand may move them, so they are never fixed elements. */
  propNames?: string[];
  /** Place name to use when the blueprint's own name is missing or a sentence. */
  fallbackName?: string;
}

function isPropName(name: string, propHeads: Set<string>, propNames: Set<string>): boolean {
  const n = lower(name);
  if (propNames.has(n)) return true;
  const head = headNoun(name);
  return head.length >= 3 && propHeads.has(head);
}

/**
 * Clean one planner blueprint: short name, known kind, canonical zones, the
 * anchor first, no story props among the fixed elements, at most 10 elements.
 * Returns null when it has no location id.
 */
export function normalizeLocationBlueprint(raw: unknown, ctx: BlueprintContext = {}): LocationBlueprint | null {
  if (!isObj(raw)) return null;
  const id = str(raw.location_id ?? raw.id);
  if (!id) return null;
  const propNames = new Set((ctx.propNames ?? []).map((p) => lower(humanLabel(p))));
  const propHeads = new Set([...propNames].map(headNoun).filter((h) => h.length >= 3));
  const ownName = str(raw.name).slice(0, 60);
  const name = ownName && !junkPlaceName(ownName) ? ownName : str(ctx.fallbackName) && !junkPlaceName(str(ctx.fallbackName)) ? str(ctx.fallbackName) : id.replace(/[_-]+/g, " ");
  const kindRaw = lower(raw.kind);
  const kind = (KINDS as string[]).includes(kindRaw) ? (kindRaw as BlueprintKind) : inferKind(`${name} ${str(raw.master_view)}`);
  const seen = new Set<string>();
  const elements: BlueprintElement[] = [];
  for (const item of Array.isArray(raw.fixed_elements) ? raw.fixed_elements : []) {
    const element = elementFrom(item);
    if (!element) continue;
    const k = lower(element.name);
    if (seen.has(k) || isPropName(element.name, propHeads, propNames)) continue;
    seen.add(k);
    elements.push(element);
  }
  let anchor = str(raw.anchor);
  if (anchor && isPropName(anchor, propHeads, propNames)) anchor = "";
  if (anchor) {
    const at = elements.findIndex((e) => lower(e.name) === lower(anchor) || lower(e.name).includes(lower(anchor)) || lower(anchor).includes(lower(e.name)));
    if (at > 0) elements.unshift(...elements.splice(at, 1));
    else if (at < 0) elements.unshift({ name: anchor.slice(0, 80), frame_zone: "", relation: "" });
    anchor = elements[0]!.name;
  } else {
    anchor = elements[0]?.name ?? "";
  }
  return {
    location_id: id,
    name,
    kind,
    master_view: str(raw.master_view).slice(0, 200) || "the establishing image's side of the place",
    anchor,
    fixed_elements: elements.slice(0, 10),
    light: str(raw.light ?? raw.lighting).slice(0, 200),
    source: "planner",
  };
}

function firstClause(text: string, max = 140): string {
  const clause = (str(text).split(/[;]|,\s(?=[a-z])/)[0] ?? "").trim();
  return clause.length > max ? clause.slice(0, max).replace(/\s+\S*$/, "") : clause;
}

/** Zone words already present in a set-map position ("back-left corner" → "left background"). */
function zoneFromPosition(position: string): string {
  const zone = normalizeFrameZone(position);
  return /^(?:(?:left|centre|right)(?: (?:foreground|midground|background))?|foreground|midground|background)$/.test(zone) ? zone : "";
}

/**
 * Blueprint for a place that only has prose (older projects, or a planner that
 * skipped it): built from the set map when the prose yields one, else from the
 * landmark list. Story props are left out.
 */
export function blueprintFromProse(params: {
  locationId: string;
  name: string;
  setting: string;
  scenery: string;
  lighting: string;
  propNames?: string[];
  setMap?: SetMap | null;
}): LocationBlueprint {
  const propNames = new Set((params.propNames ?? []).map((p) => lower(humanLabel(p))));
  const propHeads = new Set([...propNames].map(headNoun).filter((h) => h.length >= 3));
  const map = params.setMap === undefined ? buildSetMap({ setting: params.setting, scenery: params.scenery }) : params.setMap;
  const elements: BlueprintElement[] = [];
  const push = (name: string, position: string) => {
    const n = str(name).replace(/^the\s+/i, "");
    if (!n || n === "main furniture" || isPropName(n, propHeads, propNames) || elements.some((e) => lower(e.name) === lower(n))) return;
    const pos = position === "as described" ? "" : str(position);
    elements.push({ name: n, frame_zone: zoneFromPosition(pos), relation: pos });
  };
  if (map) {
    const anchorPosition = /stands in the middle ground([^.]*)\./i.exec(map.text)?.[1]?.replace(/^,\s*/, "").replace(/,\s*its long side parallel to the back wall/i, "").trim() ?? "";
    push(map.anchor, anchorPosition);
    // The set map always stands its anchor in the middle ground.
    if (elements[0]) elements[0].frame_zone = "midground";
    for (const p of map.placements) push(p.item, p.position);
  } else {
    const loose = looseLandmarkList(params.scenery, params.setting);
    const items = loose.length >= 2 ? loose : landmarkList(params.scenery, params.setting).map((item) => ({ item, position: "" }));
    for (const i of items) push(i.item, i.position);
  }
  const settingHead = str(params.setting).split(/[,.;:—]|\bwith\b/i)[0]?.trim() ?? "";
  const name = !junkPlaceName(params.name) ? str(params.name) : !junkPlaceName(settingHead) ? settingHead : params.locationId.replace(/[_-]+/g, " ");
  return {
    location_id: params.locationId,
    name: name.slice(0, 60),
    kind: map ? (map.exterior ? "exterior" : inferKind(`${name} ${params.setting}`) === "vehicle" ? "vehicle" : "interior") : inferKind(`${name} ${params.setting} ${params.scenery}`),
    master_view: "the establishing image's side of the place",
    anchor: elements[0]?.name ?? "",
    fixed_elements: elements.slice(0, 10),
    light: firstClause(params.lighting),
    source: "derived",
  };
}

/**
 * The set map of a planner blueprint, in the SetMap shape the existing
 * set_map / camera_side_lock fields already consume.
 */
export function setMapFromBlueprint(blueprint: LocationBlueprint): SetMap | null {
  const [anchorElement, ...rest] = blueprint.fixed_elements;
  if (!anchorElement || rest.length === 0) return null;
  const where = (e: BlueprintElement) => [e.frame_zone, e.relation].filter(Boolean).join(", ");
  const placements: SetMapPlacement[] = rest.map((e) => ({ item: e.name, position: where(e) || "as described" }));
  const anchor = `the ${anchorElement.name.replace(/^the\s+/i, "")}`;
  const layout = `${anchor[0]!.toUpperCase()}${anchor.slice(1)}${where(anchorElement) ? ` — ${where(anchorElement)}` : ""}.`;
  const list = placements.map((p) => (p.position === "as described" ? p.item : `${p.item} — ${p.position}`)).join("; ");
  const text =
    `SET MAP (fixed; identical in the establishing image and in every shot, seen from the master view: ${blueprint.master_view}): ${layout} Landmarks: ${list}. ` +
    "Every landmark keeps exactly this position, size and count in every shot — never moved, mirrored, duplicated, removed or added to fill a vertical frame.";
  const side = (s: "left" | "right" | "centre") => rest.filter((e) => e.frame_zone.startsWith(s)).map((e) => e.name);
  const sides = [
    side("left").length ? `a subject on the left of ${anchor} has the left part of the view behind them (${side("left").join(", ")})` : "",
    side("right").length ? `a subject on the right has the right part behind them (${side("right").join(", ")})` : "",
    side("centre").length ? `${side("centre").join(", ")} stays centred behind ${anchor}` : "",
  ].filter(Boolean).join("; ");
  return { anchor, exterior: blueprint.kind === "exterior", placements, text, sides };
}

export interface LocationProse {
  id: string;
  name: string;
  setting: string;
  scenery: string;
  lighting: string;
}

/**
 * One blueprint per location: the planner's (normalised) where it wrote one,
 * otherwise derived from the location's prose.
 */
export function resolveLocationBlueprints(params: {
  planner?: unknown;
  locations: LocationProse[];
  propNames?: string[];
  /** Set maps already computed for the prose (keeps derived blueprints identical to the set_map text). */
  setMaps?: Map<string, SetMap | null>;
}): Map<string, LocationBlueprint> {
  const out = new Map<string, LocationBlueprint>();
  // A usable place name for each location: its own name, else its setting's head.
  const names = new Map(params.locations.map((l) => {
    const head = str(l.setting).split(/[,.;:—]|\bwith\b/i)[0]?.trim() ?? "";
    return [l.id, !junkPlaceName(l.name) ? l.name : head];
  }));
  for (const raw of Array.isArray(params.planner) ? params.planner : []) {
    const id = isObj(raw) ? str(raw.location_id ?? raw.id) : "";
    const bp = normalizeLocationBlueprint(raw, { propNames: params.propNames, fallbackName: names.get(id) });
    if (bp && bp.fixed_elements.length > 0 && !out.has(bp.location_id)) out.set(bp.location_id, bp);
  }
  for (const loc of params.locations) {
    if (out.has(loc.id)) continue;
    out.set(loc.id, blueprintFromProse({
      locationId: loc.id,
      name: loc.name,
      setting: loc.setting,
      scenery: loc.scenery,
      lighting: loc.lighting,
      propNames: params.propNames,
      ...(params.setMaps?.has(loc.id) ? { setMap: params.setMaps.get(loc.id) ?? null } : {}),
    }));
  }
  return out;
}

/** Normalise the planner output in place on a breakdown (server side, after generation). */
export function normalizeBreakdownBlueprints<T extends { location_blueprints?: unknown; segments?: Array<{ location_id?: string | null; environment_ref?: string | null }> }>(
  breakdown: T,
  propNames: string[] = []
): T {
  const raw = breakdown.location_blueprints;
  if (!Array.isArray(raw)) return breakdown;
  const used = new Set((breakdown.segments ?? []).map((s) => str(s.location_id) || str(s.environment_ref)).filter((id) => id && id !== "custom"));
  const clean: LocationBlueprint[] = [];
  for (const item of raw) {
    const bp = normalizeLocationBlueprint(item, { propNames });
    if (!bp || clean.some((c) => c.location_id === bp.location_id)) continue;
    if (used.size && !used.has(bp.location_id)) continue;
    clean.push(bp);
  }
  (breakdown as { location_blueprints?: LocationBlueprint[] }).location_blueprints = clean;
  return breakdown;
}

/** Names of the props the state ledger tracks (they can move, so they are never fixed elements). */
export function ledgerPropNames(breakdown: {
  character_locks?: Array<{ name?: string }>;
  segments?: Array<{ state_ledger?: { start?: Array<{ entity_id?: string }>; end?: Array<{ entity_id?: string }>; changes?: Array<{ entity_id?: string }> } }>;
}): string[] {
  const cast = new Set((breakdown.character_locks ?? []).map((c) => lower(c.name)));
  const names = new Set<string>();
  for (const segment of breakdown.segments ?? []) {
    const ledger = segment.state_ledger;
    if (!ledger) continue;
    for (const entry of [...(ledger.start ?? []), ...(ledger.end ?? []), ...(ledger.changes ?? [])]) {
      const id = humanLabel(str(entry?.entity_id));
      if (id && !cast.has(lower(id))) names.add(id);
    }
  }
  return [...names];
}

/** The planner blueprint written for one location, normalised (null when the planner wrote none). */
export function plannerBlueprintFor(
  breakdown: { location_blueprints?: unknown },
  locationId: string | undefined,
  propNames: string[] = []
): LocationBlueprint | null {
  const id = str(locationId);
  if (!id || !Array.isArray(breakdown.location_blueprints)) return null;
  const raw = breakdown.location_blueprints.find((b) => isObj(b) && str(b.location_id ?? b.id) === id);
  const bp = normalizeLocationBlueprint(raw, { propNames });
  return bp && bp.fixed_elements.length ? bp : null;
}

// ── Editor helpers (Phòng biên tập: the user reviews / edits each place) ──────

export type FrameX = "" | "left" | "centre" | "right";
export type FrameDepth = "" | "foreground" | "midground" | "background";

/** "left background" → { x: "left", depth: "background" }; free text → both "". */
export function splitFrameZone(zone: string): { x: FrameX; depth: FrameDepth } {
  const z = normalizeFrameZone(zone);
  const x = (/\b(left|centre|right)\b/.exec(z)?.[1] ?? "") as FrameX;
  const depth = (/\b(foreground|midground|background)\b/.exec(z)?.[1] ?? "") as FrameDepth;
  return { x, depth };
}

export function joinFrameZone(x: FrameX, depth: FrameDepth): string {
  return [x, depth].filter(Boolean).join(" ");
}

interface EditorBreakdown {
  location_blueprints?: unknown;
  character_locks?: Array<{ name?: string }>;
  scene_bible?: { backdrop?: string; lighting?: string };
  segments?: Array<{
    location_id?: string | null;
    environment_ref?: string | null;
    first_frame_prompt?: string;
    title?: string;
    state_ledger?: { start?: Array<{ entity_id?: string }>; end?: Array<{ entity_id?: string }>; changes?: Array<{ entity_id?: string }> };
  }>;
}

/** The places the segments are filmed at, in first-use order (no "custom"). */
export function editorLocations(breakdown: EditorBreakdown): string[] {
  const out: string[] = [];
  for (const segment of breakdown.segments ?? []) {
    const id = str(segment.location_id) || str(segment.environment_ref);
    if (id && id !== "custom" && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * The blueprint the editor shows for a place, as stored — NOT normalised, so a
 * row being typed (empty name) or a prop the user is warned about stays on
 * screen. The export path normalises it.
 */
export function editorBlueprint(breakdown: EditorBreakdown, locationId: string): LocationBlueprint | null {
  const raw = Array.isArray(breakdown.location_blueprints)
    ? breakdown.location_blueprints.find((b) => isObj(b) && str(b.location_id ?? b.id) === locationId)
    : undefined;
  if (!isObj(raw)) return null;
  const elements: BlueprintElement[] = (Array.isArray(raw.fixed_elements) ? raw.fixed_elements : []).map((item) => {
    if (typeof item === "string") return elementFrom(item) ?? { name: item, frame_zone: "", relation: "" };
    const o = isObj(item) ? item : {};
    return {
      name: typeof o.name === "string" ? o.name : "",
      frame_zone: typeof o.frame_zone === "string" ? o.frame_zone : "",
      relation: typeof o.relation === "string" ? o.relation : "",
    };
  });
  const kindRaw = lower(raw.kind);
  return {
    location_id: locationId,
    name: typeof raw.name === "string" ? raw.name : "",
    kind: (KINDS as string[]).includes(kindRaw) ? (kindRaw as BlueprintKind) : inferKind(`${str(raw.name)} ${str(raw.master_view)}`),
    master_view: typeof raw.master_view === "string" ? raw.master_view : "",
    anchor: elements[0]?.name ?? str(raw.anchor),
    fixed_elements: elements,
    light: typeof raw.light === "string" ? raw.light : "",
    source: raw.source === "derived" ? "derived" : "planner",
  };
}

/**
 * A first draft for a place that has no blueprint yet, built from the script's
 * own prose (first start state at that place + scene-bible backdrop). It is
 * marked "planner" because the user reviews and saves it as the authority.
 */
export function seedBlueprint(breakdown: EditorBreakdown, locationId: string): LocationBlueprint {
  const segment = (breakdown.segments ?? []).find((s) => (str(s.location_id) || str(s.environment_ref)) === locationId);
  const derived = blueprintFromProse({
    locationId,
    name: locationId.replace(/[_-]+/g, " "),
    setting: str(segment?.first_frame_prompt),
    scenery: str(breakdown.scene_bible?.backdrop),
    lighting: str(breakdown.scene_bible?.lighting),
    propNames: ledgerPropNames(breakdown),
  });
  return { ...derived, source: "planner" };
}

/** Replace (or add) one place's blueprint, keeping the others as they are. */
export function upsertBlueprint(list: unknown, blueprint: LocationBlueprint): LocationBlueprint[] {
  const current = (Array.isArray(list) ? list : []).filter(isObj) as unknown as LocationBlueprint[];
  const at = current.findIndex((b) => str(b.location_id) === blueprint.location_id);
  const next = { ...blueprint, anchor: blueprint.fixed_elements[0]?.name ?? blueprint.anchor, source: "planner" as const };
  return at >= 0 ? current.map((b, i) => (i === at ? next : b)) : [...current, next];
}

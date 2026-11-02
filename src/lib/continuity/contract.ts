// ============================================================
// CONTINUITY CONTRACT — the WORLD KEY and the per-shot PROP PLAN written into
// the establishing image, every keyframe and every video prompt.
//
// Research (02/11/2026; Google DeepMind Veo prompt guide, AuxWorld "keep one
// world across six clips", Veo/Runway/Kling practitioner guides, script
// supervisor practice):
//   · paste ONE world key, word for word, at the top of every prompt of a place;
//     rewriting the setting per prompt is the most common cause of drift;
//   · name the fixed set pieces and say that they never move; list only the
//     props that exist; give every moved prop its start → end and the hand;
//   · negatives must name the object ("the low wooden table sliding"), not
//     "no inconsistencies".
// Everything here is ADDED to the existing prompts (new keys + appended
// negatives); no existing block is removed or rewritten.
// ============================================================
import { buildSetMap, landmarkList, looseLandmarkList, type SetMap } from "../environment/set-map.ts";
import type { ProductionRegistryEntry, ProductionState, ShotState } from "../production-state/types.ts";
import type { NanoFlowManifest } from "@/types/nano-flow";
import { analyzeCameraPath, cameraContinuityRule, sizePath } from "./camera.ts";
import type { ContinuityLogRow, NanoFlowContinuity, PropMove, PropStay, PropTouch, ShotPropPlan } from "./types.ts";

type Json = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const lower = (v: unknown) => str(v).toLocaleLowerCase();

export const WORLD_KEY_FIELD = "world_key";
export const CONTINUITY_FIELD = "continuity_contract";

/** "obj_paper_box" / "paper_box" → "paper box". */
export function propLabel(entry: ProductionRegistryEntry | undefined, fallbackId = ""): string {
  const raw = entry?.display_name || fallbackId;
  return raw.replace(/^(?:obj|prop|product)_/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

const handLabel = (limb: string | null | undefined) =>
  limb && /hand$/.test(limb) ? limb.replace(/_/g, " ") : null;

function firstClause(text: string, max = 120): string {
  const clause = (text.split(/[;]|,\s(?=[a-z])/)[0] ?? "").replace(/\s+/g, " ").trim();
  return clause.length > max ? `${clause.slice(0, max).replace(/\s+\S*$/, "")}` : clause;
}

function headNoun(label: string): string {
  return lower(label).split(/\s+/).pop()?.replace(/s$/, "") ?? "";
}

export interface WorldKeyInput {
  locationId: string;
  name: string;
  setting: string;
  scenery: string;
  lighting: string;
  setMap: SetMap | null;
  /** An uploaded location photo is the geometry authority. */
  hasLocationPhoto: boolean;
  /** Story props (registry objects) — never listed as fixed set pieces. */
  propLabels: string[];
}

export interface WorldKey {
  location_id: string;
  text: string;
  /** Fixed set pieces in map order (anchor first). */
  fixed_set: string[];
  anchor: string;
}

/** The fixed pieces of a place: its set map (anchor first), else its landmark list. */
function fixedPieces(input: WorldKeyInput): Array<{ item: string; position: string }> {
  const propHeads = new Set(input.propLabels.map(headNoun).filter((h) => h.length >= 3));
  const isProp = (item: string) => propHeads.has(headNoun(item));
  const out: Array<{ item: string; position: string }> = [];
  const map = input.setMap;
  if (map) {
    const anchor = map.anchor.replace(/^the\s+/i, "");
    const anchorPosition = /stands in the middle ground([^.]*)\./i.exec(map.text)?.[1]?.replace(/^,\s*/, "").replace(/,\s*its long side parallel to the back wall/i, "").trim();
    if (anchor && anchor !== "main furniture" && !isProp(anchor)) {
      out.push({ item: anchor, position: `middle ground${anchorPosition ? `, ${anchorPosition}` : ""}` });
    }
    for (const p of map.placements) {
      if (isProp(p.item)) continue;
      out.push({ item: p.item, position: p.position === "as described" ? "" : p.position });
    }
    return out;
  }
  const loose = looseLandmarkList(input.scenery, input.setting);
  const items = loose.length >= 2 ? loose : landmarkList(input.scenery, input.setting).map((item) => ({ item, position: "" }));
  return items.filter((i) => !isProp(i.item));
}

/**
 * One WORLD KEY per location: place, fixed set with positions, light, camera
 * side. Deterministic, so every prompt of the place carries the same text.
 */
export function buildWorldKey(input: WorldKeyInput): WorldKey {
  const pieces = fixedPieces(input);
  const palette = input.scenery.includes(":") ? input.scenery.slice(0, input.scenery.indexOf(":")) : firstClause(input.scenery || input.setting, 160);
  const place = [input.name, palette && lower(palette) !== lower(input.name) ? palette : ""].filter(Boolean).join(" — ").replace(/\s+/g, " ").slice(0, 220);
  const fixedLine = input.hasLocationPhoto
    ? "FIXED SET — exactly as in the attached location photo: every wall, opening and piece of furniture keeps its photo position, size and count; nothing in it moves."
    : pieces.length
      ? `FIXED SET — ${pieces.map((p) => (p.position ? `${p.item}: ${p.position}` : p.item)).join("; ")}. These pieces never move, turn, slide, resize, duplicate or disappear; nobody moves them.`
      : "FIXED SET — exactly as the establishing image shows it; no piece of furniture or architecture moves, resizes or disappears.";
  const light = firstClause(input.lighting, 140);
  const text = [
    `WORLD KEY · ${input.name || input.locationId} (identical in the establishing image, every keyframe and every video of this place; only the cast, their action and the camera change):`,
    `PLACE — ${place}.`,
    fixedLine,
    light ? `LIGHT — ${light}; same direction and colour in every shot of this place.` : "",
    "CAMERA SIDE — always the establishing image's side of the room; a closer framing only crops this view, it never re-draws or re-arranges it.",
  ].filter(Boolean).join("\n");
  return {
    location_id: input.locationId,
    text,
    fixed_set: pieces.map((p) => p.item),
    anchor: pieces[0]?.item ?? "",
  };
}

function positionsDiffer(a: string, b: string): boolean {
  const norm = (s: string) => lower(s).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\b(?:the|a|an|on|in|of)\b/g, " ").replace(/\s+/g, " ").trim();
  return norm(a) !== norm(b);
}

/** What moves, what is only touched and what must stay put in one shot. */
export function shotPropPlan(shot: ShotState, registry: ProductionRegistryEntry[]): ShotPropPlan {
  const byId = new Map(registry.map((r) => [r.entity_id, r]));
  const isProp = (id: string | null | undefined) => {
    const kind = id ? byId.get(id)?.kind : undefined;
    return kind === "object" || kind === "product";
  };
  const nameOf = (id: string | null | undefined) => (id ? byId.get(id)?.display_name ?? null : null);
  const start = new Map((shot.start_snapshot?.entities ?? []).map((e) => [e.entity_id, e]));
  const end = new Map((shot.end_snapshot?.entities ?? []).map((e) => [e.entity_id, e]));
  const moved = new Map<string, PropMove>();
  for (const change of shot.changes ?? []) {
    if (!isProp(change.entity_id)) continue;
    const from = str(change.from_position) || str(start.get(change.entity_id)?.position);
    const to = str(change.to_position) || str(end.get(change.entity_id)?.position);
    const holderMoved = (change.from_holder_entity_id ?? null) !== (change.to_holder_entity_id ?? null);
    const placeMoved = Boolean(from && to && positionsDiffer(from, to));
    // Same place, new arrangement ("small cushion separate" → "forming the
    // right wall"): the hand still changes it, so it is NOT a prop that stays put.
    const stateChanged = !placeMoved && !holderMoved && Boolean(str(change.from) && str(change.to) && positionsDiffer(str(change.from), str(change.to)));
    if (!placeMoved && !holderMoved && !stateChanged) continue;
    const action = (shot.actions ?? []).find((a) => a.object_entity_id === change.entity_id && a.subject_entity_id);
    moved.set(change.entity_id, {
      entity_id: change.entity_id,
      label: propLabel(byId.get(change.entity_id), change.entity_id),
      from: stateChanged ? str(change.from) : from || "its opening place",
      to: stateChanged ? str(change.to) : to || "its end place",
      by: nameOf(action?.subject_entity_id),
      hand: handLabel(action?.body_part ?? change.body_part ?? null),
      kind: stateChanged ? "change" : "move",
    });
  }
  // A prop whose snapshot position changes without a ledger change still moves.
  for (const [id, s] of start) {
    if (!isProp(id) || moved.has(id)) continue;
    const e = end.get(id);
    if (!e || !positionsDiffer(str(s.position), str(e.position))) continue;
    const action = (shot.actions ?? []).find((a) => a.object_entity_id === id && a.subject_entity_id);
    moved.set(id, {
      entity_id: id,
      label: propLabel(byId.get(id), id),
      from: str(s.position),
      to: str(e.position),
      by: nameOf(action?.subject_entity_id),
      hand: handLabel(action?.body_part ?? null),
    });
  }
  const touched = new Map<string, PropTouch>();
  for (const action of shot.actions ?? []) {
    for (const id of action.contact_entity_ids ?? []) {
      if (!isProp(id) || moved.has(id) || touched.has(id)) continue;
      touched.set(id, {
        entity_id: id,
        label: propLabel(byId.get(id), id),
        by: nameOf(action.subject_entity_id),
        hand: handLabel(action.body_part),
      });
    }
  }
  const stays: PropStay[] = [];
  for (const [id, s] of start) {
    if (!isProp(id) || moved.has(id)) continue;
    stays.push({ entity_id: id, label: propLabel(byId.get(id), id), position: str(s.position) });
  }
  return { moves: [...moved.values()], touched: [...touched.values()], stays };
}

const who = (by: string | null, hand: string | null) =>
  by ? `${by}'s ${hand ?? "hand"}` : hand ? `the ${hand}` : "a visible hand";

export function propPlanLines(plan: ShotPropPlan): { moves: string[]; touched: string[]; stays: string } {
  return {
    moves: plan.moves.map((m) =>
      m.kind === "change"
        ? `${m.label}: ${m.from} → ${m.to}. Only ${who(m.by, m.hand)} changes it, in one continuous visible motion; it stays in its place.`
        : `${m.label}: ${m.from} → ${m.to}. Only ${who(m.by, m.hand)} moves it, in one continuous visible motion, and it ends resting there.`
    ),
    touched: plan.touched.map((t) => `${t.label}: ${who(t.by, t.hand)} touches it; it does not move.`),
    // Positions are already in background_lock.props (SET DRESSING LOCK).
    stays: plan.stays.length
      ? `${plan.stays.map((s) => s.label).join(", ")}: each stays exactly where the opening frame shows it for the whole clip — no sliding, drifting, rotating, tipping, resizing or leaving the frame, even when the camera moves. No other prop appears.`
      : "No prop appears that the opening frame does not show.",
  };
}

/** Named negatives for the fixed set and the props that stay put. */
export function namedNegatives(worldKey: WorldKey, plan: ShotPropPlan): string {
  const fixed = worldKey.fixed_set.slice(0, 4);
  const still = plan.stays.map((s) => s.label).slice(0, 6);
  return [
    fixed.length ? `the ${fixed.join(", the ")} moving, sliding, turning or changing size` : "",
    still.length ? `the ${still.join(", the ")} sliding, drifting or leaving the frame on their own` : "",
    "furniture or props re-arranged, appearing or vanishing when the camera moves",
  ].filter(Boolean).join(", ");
}

function withFirstKeys(obj: Json, entries: Array<[string, unknown]>): Json {
  const out: Json = {};
  for (const [key, value] of entries) if (value !== undefined) out[key] = value;
  for (const [key, value] of Object.entries(obj)) if (!(key in out)) out[key] = value;
  return out;
}

function appendNegative(existing: unknown, extra: string): unknown {
  if (!extra) return existing;
  const text = str(existing);
  if (text.includes(extra)) return existing;
  if (typeof existing !== "string") return existing;
  return `${text.replace(/[\s.,;]+$/, "")}, ${extra}`;
}

/**
 * Put the world key at the top of a JSON-string prompt — right after the
 * keyframe's own opening_frame description when it has one (that description
 * leads every keyframe), otherwise first. Non-JSON prompts stay as they are.
 */
export function withWorldKeyInJsonPrompt(prompt: string | undefined, worldKey: string, patch?: (parsed: Json) => void): string | undefined {
  if (!prompt || !worldKey) return prompt;
  try {
    const parsed = JSON.parse(prompt) as unknown;
    if (!isObj(parsed)) return prompt;
    patch?.(parsed);
    if (parsed[WORLD_KEY_FIELD] === worldKey && !patch) return prompt;
    const lead: Array<[string, unknown]> = typeof parsed.opening_frame === "string"
      ? [["opening_frame", parsed.opening_frame], [WORLD_KEY_FIELD, worldKey]]
      : [[WORLD_KEY_FIELD, worldKey]];
    return JSON.stringify(withFirstKeys(parsed, lead));
  } catch {
    return prompt;
  }
}

/** A background name that is a script sentence, not a place name. */
export function junkPlaceName(name: string): boolean {
  const n = str(name);
  if (!n) return true;
  return /^(?:same|continue|continues|continuing|as\s+before|as\s+in|back\s+to|still|again|return)\b/i.test(n) ||
    /\b(?:as|from|of|the|and|to|with)$/i.test(n) ||
    /[.!?]$/.test(n) ||
    n.split(/\s+/).length > 9;
}

function locationParams(manifest: NanoFlowManifest): Map<string, { name: string; setting: string; scenery: string; lighting: string; photo: boolean; sheet: Json }> {
  const out = new Map<string, { name: string; setting: string; scenery: string; lighting: string; photo: boolean; sheet: Json }>();
  for (const env of manifest.assets?.environments ?? []) {
    let sheet: Json = {};
    try {
      sheet = env.location_sheet_prompt ? (JSON.parse(env.location_sheet_prompt) as Json) : {};
    } catch {
      sheet = {};
    }
    const setting = str(sheet.source_authority) || str(sheet.setting) || "";
    // The asset name came from the first clip's background name, which can be
    // a script sentence ("Continue from the prior end frame.").
    const settingHead = setting.split(/[,.;:—]|\bwith\b/i)[0]?.trim() ?? "";
    const name = !junkPlaceName(env.name ?? "") ? env.name : !junkPlaceName(settingHead) ? settingHead : env.id.replace(/_/g, " ");
    out.set(env.id, {
      name: name || env.id,
      setting: str(sheet.source_authority) || str(sheet.setting) || env.name || "",
      scenery: str(sheet.scenery),
      lighting: str(sheet.lighting),
      photo: Boolean(env.image),
      sheet,
    });
  }
  return out;
}

function productionShotFor(state: ProductionState | undefined, shot: NanoFlowManifest["shots"][number], index: number): ShotState | undefined {
  const id = shot.state_authority?.production_shot_id;
  return (id ? state?.shots.find((s) => s.shot_id === id) : undefined) ?? state?.shots[index];
}

export interface ApplyContinuityOptions {
  /** Set maps the manifest builder already computed (same text as its set_map fields). */
  setMaps?: Map<string, SetMap | null>;
  /** Repairs recorded by the ledger repair, keyed by production shot id. */
  repairsByShot?: Map<string, string[]>;
  /** Locations whose shots carry an uploaded location photo. */
  photoLocations?: Set<string>;
}

const FOREGROUND_EDGE = /\b(?:in the foreground|foreground|at the frame edge|frame edge|edge of (?:the )?frame|bottom edge|lower edge|front edge)\b/i;

/** Props that must stay put but that the camera beats place in the foreground / at the frame edge. */
export function foregroundProps(beats: Array<{ beat?: string; camera?: string }> | undefined, labels: string[]): string[] {
  const text = (beats ?? []).map((b) => `${b.beat ?? ""} ${b.camera ?? ""}`).join(" ").toLowerCase();
  return labels.filter((label) => {
    const head = (label.split(/\s+/).pop() ?? label).toLowerCase();
    if (head.length < 3) return false;
    for (let at = text.indexOf(head); at >= 0; at = text.indexOf(head, at + 1)) {
      if (FOREGROUND_EDGE.test(text.slice(Math.max(0, at - 40), at + head.length + 40))) return true;
    }
    return false;
  });
}

/**
 * Write the continuity contract into a manifest. Pure (returns a new manifest)
 * and idempotent: running it twice gives the same result.
 */
export function applyContinuityContract<T extends NanoFlowManifest>(manifest: T, options: ApplyContinuityOptions = {}): T {
  const out = JSON.parse(JSON.stringify(manifest)) as T;
  const state = out.production_state;
  const registry = state?.registry ?? [];
  const locations = locationParams(out);
  const worldKeys = new Map<string, WorldKey>();
  const propLabels = registry.filter((r) => r.kind === "object" || r.kind === "product").map((r) => propLabel(r));
  for (const [id, loc] of locations) {
    const setMap = options.setMaps?.has(id) ? options.setMaps.get(id) ?? null : buildSetMap({ setting: loc.setting, scenery: loc.scenery });
    worldKeys.set(id, buildWorldKey({
      locationId: id,
      name: loc.name,
      setting: loc.setting,
      scenery: loc.scenery,
      lighting: loc.lighting,
      setMap: loc.photo || options.photoLocations?.has(id) ? null : setMap,
      hasLocationPhoto: loc.photo || Boolean(options.photoLocations?.has(id)),
      propLabels,
    }));
  }

  // Establishing image(s): the same key, first.
  for (const env of out.assets?.environments ?? []) {
    const cleanName = locations.get(env.id)?.name;
    if (cleanName && cleanName !== env.name && junkPlaceName(env.name ?? "")) env.name = cleanName;
    const key = worldKeys.get(env.id)?.text;
    if (!key) continue;
    env.location_sheet_prompt = withWorldKeyInJsonPrompt(env.location_sheet_prompt, key);
    if (Array.isArray(env.location_views)) {
      env.location_views = env.location_views.map((view) => ({ ...view, prompt: withWorldKeyInJsonPrompt(view.prompt, key) ?? view.prompt }));
    }
  }

  const log: ContinuityLogRow[] = [];
  let previousElements: Set<string> | null = null;
  let previousLocation = "";
  out.shots.forEach((shot, index) => {
    const loc =
      str(shot.location_id) ||
      (isObj(shot.video_prompt) ? str(shot.video_prompt.location_id) : "") ||
      str(shot.video_refs?.environments?.[0]);
    const worldKey = worldKeys.get(loc);
    const production = productionShotFor(state, shot, index);
    const plan = production ? shotPropPlan(production, registry) : { moves: [], touched: [], stays: [] };
    const lines = propPlanLines(plan);
    const camera = analyzeCameraPath(shot.beats);

    // A background name that is a script sentence is replaced by the place's
    // name — in the video AND in the keyframe's copy of the video projection,
    // so both keep agreeing word for word.
    const envName = locations.get(loc)?.name;
    const oldBgName = isObj(shot.video_prompt) && isObj(shot.video_prompt.background_lock) ? str(shot.video_prompt.background_lock.name) : "";
    const renameBg = Boolean(envName && oldBgName && junkPlaceName(oldBgName));
    const patchProjection = renameBg
      ? (parsed: Json) => {
          const projection = isObj(parsed.video_prompt_projection) ? parsed.video_prompt_projection : undefined;
          const bg = projection && isObj(projection.background_lock) ? projection.background_lock : undefined;
          if (projection && bg && str(bg.name) === oldBgName) projection.background_lock = { ...bg, name: envName };
        }
      : undefined;
    if (worldKey) {
      shot.storyboard_prompt = withWorldKeyInJsonPrompt(shot.storyboard_prompt, worldKey.text, patchProjection) ?? shot.storyboard_prompt;
      if (shot.end_storyboard_prompt) shot.end_storyboard_prompt = withWorldKeyInJsonPrompt(shot.end_storyboard_prompt, worldKey.text, patchProjection);
    }
    const edge = foregroundProps(shot.beats, plan.stays.map((s) => s.label));
    if (isObj(shot.video_prompt)) {
      const clip = shot.video_prompt;
      const contract = {
        fixed_set: worldKey?.fixed_set.length
          ? "The world key's FIXED SET stays exactly in place for the whole clip; nobody moves it."
          : "The furniture and architecture stay exactly as the establishing image shows them for the whole clip.",
        props_that_move: lines.moves.length ? lines.moves : ["None — no prop changes place in this clip."],
        ...(lines.touched.length ? { props_touched_not_moved: lines.touched } : {}),
        props_that_stay_put: lines.stays,
        ...(edge.length
          ? { frame_margin: `${edge.join(", ")}: near the camera — keep ${edge.length > 1 ? "them" : "it"} fully inside the frame with a clear margin for the whole clip; the frame never cuts ${edge.length > 1 ? "them" : "it"} off or pushes ${edge.length > 1 ? "them" : "it"} out.` }
          : {}),
        camera: cameraContinuityRule({ fixedSet: worldKey?.fixed_set ?? [], anchor: worldKey?.anchor }),
      };
      const bg = isObj(clip.background_lock) ? clip.background_lock : undefined;
      const nextClip = withFirstKeys(clip, [
        [WORLD_KEY_FIELD, worldKey?.text],
        [CONTINUITY_FIELD, contract],
      ]);
      if (bg && renameBg) nextClip.background_lock = { ...bg, name: envName };
      if (worldKey) nextClip.negative_prompt = appendNegative(nextClip.negative_prompt, namedNegatives(worldKey, plan));
      shot.video_prompt = nextClip;
    }

    const elements = new Set<string>([
      ...(shot.characters_in_scene ?? []).map((n) => `char:${lower(n)}`),
      ...plan.stays.map((s) => `prop:${s.entity_id}`),
      ...plan.moves.map((m) => `prop:${m.entity_id}`),
    ]);
    const newElements = previousElements && previousLocation === loc
      ? [...elements].filter((e) => !previousElements!.has(e)).map((e) => {
          const [kind, id] = e.split(":");
          return kind === "prop" ? propLabel(registry.find((r) => r.entity_id === id), id) : (shot.characters_in_scene ?? []).find((n) => lower(n) === id) ?? id!;
        })
      : [];
    previousElements = elements;
    previousLocation = loc;

    log.push({
      shot_index: shot.index ?? index + 1,
      shot_id: shot.shot_id,
      location_id: loc,
      camera_path: sizePath(camera.sizes),
      camera_locked: camera.locked,
      moves: lines.moves,
      touched: lines.touched,
      stays: plan.stays.map((s) => s.label),
      new_elements: newElements,
      repairs: (production && options.repairsByShot?.get(production.shot_id)) ?? [],
      findings: [],
    });
  });

  const continuity: NanoFlowContinuity = {
    version: "1.0",
    world_keys: Object.fromEntries([...worldKeys].map(([id, key]) => [id, key.text])),
    log,
  };
  (out as NanoFlowManifest).continuity = continuity;
  return out;
}

import assert from "node:assert/strict";
import test from "node:test";
import { buildSetMap, looseLandmarkList } from "../environment/set-map.ts";
import { analyzeCameraPath, enforceCameraContinuity, withCameraContinuity, CAMERA_HOLD_MARK } from "./camera.ts";
import { compileAtomicActions } from "../production-state/action-compiler.ts";
import { repairProductionStateContinuity } from "./ledger-repair.ts";
import {
  blueprintFromProse,
  junkPlaceName,
  ledgerPropNames,
  normalizeBreakdownBlueprints,
  normalizeFrameZone,
  normalizeLocationBlueprint,
  resolveLocationBlueprints,
  setMapFromBlueprint,
} from "./blueprint.ts";
import { applyContinuityContract, shotPropPlan, worldKeyFromBlueprint } from "./contract.ts";
import { superviseContinuity, isBlockingContinuityFinding } from "./supervisor.ts";
import { assessContinuityExportGate } from "../validation/export-policy.ts";
import { buildNanoFlowManifest } from "../nano-flow/manifest.ts";
import { compactNanoFlowManifest } from "../nano-flow/prompt-compaction.ts";
import type { ProductionRegistryEntry, ProductionState, ShotState } from "../production-state/types.ts";

// The continuity contract is structural: one blueprint per location of ANY kind
// (room, shop, street, vehicle…). Places below are deliberately varied.
const PLANNER_BLUEPRINTS = [
  {
    location_id: "night_market",
    name: "Night market alley",
    kind: "exterior",
    master_view: "from the alley mouth facing the food stalls",
    anchor: "noodle stall counter",
    fixed_elements: [
      { name: "lantern string", frame_zone: "top centre background", relation: "strung above the stalls" },
      { name: "noodle stall counter", frame_zone: "centre midground", relation: "" },
      { name: "plastic stools", frame_zone: "left foreground", relation: "in front of the counter" },
      { name: "shopping basket", frame_zone: "right foreground", relation: "on a stool" }, // a story prop → dropped
      { name: "noodle stall counter", frame_zone: "centre", relation: "duplicate" },
    ],
    light: "warm lantern light from above, neon spill from the right",
  },
  {
    location_id: "taxi",
    name: "Continue from the prior end frame.",
    kind: "vehicle",
    master_view: "from the front passenger seat facing the back seat",
    anchor: "back seat",
    fixed_elements: ["back seat — centre midground", "left rear window — left background", "right rear door: right midground"],
    light: "city light through the rear windows",
  },
];

const PROPS = ["shopping_basket", "paper_cup"];

test("planner blueprints normalise for any kind of place: name, kind, zones, anchor first, no story props", () => {
  const market = normalizeLocationBlueprint(PLANNER_BLUEPRINTS[0], { propNames: PROPS })!;
  assert.equal(market.name, "Night market alley");
  assert.equal(market.kind, "exterior");
  assert.equal(market.anchor, "noodle stall counter");
  assert.deepEqual(market.fixed_elements.map((e) => e.name), ["noodle stall counter", "lantern string", "plastic stools"], "anchor first, no duplicate, the basket is a prop");
  assert.equal(market.fixed_elements[0]!.frame_zone, "centre midground");
  assert.equal(market.source, "planner");
  const taxi = normalizeLocationBlueprint(PLANNER_BLUEPRINTS[1], { fallbackName: "Taxi back seat" })!;
  assert.equal(taxi.name, "Taxi back seat", "a script sentence is never a place name");
  assert.equal(taxi.kind, "vehicle");
  assert.deepEqual(taxi.fixed_elements.map((e) => [e.name, e.frame_zone]), [["back seat", "centre midground"], ["left rear window", "left background"], ["right rear door", "right midground"]]);
  // Zones only carry the axes the text states.
  assert.equal(normalizeFrameZone("behind the family"), "background");
  assert.equal(normalizeFrameZone("left"), "left");
  assert.equal(normalizeFrameZone("against the wall"), "against the wall");
  assert.equal(junkPlaceName("Same kitchen and exact positions as"), true);
  assert.equal(junkPlaceName("Hotel lobby"), false);
});

test("set map and world key are compiled from the blueprint structure, not from prose", () => {
  const market = normalizeLocationBlueprint(PLANNER_BLUEPRINTS[0], { propNames: PROPS })!;
  const map = setMapFromBlueprint(market)!;
  assert.equal(map.anchor, "the noodle stall counter");
  assert.equal(map.exterior, true);
  assert.match(map.text, /seen from the master view: from the alley mouth facing the food stalls/);
  assert.match(map.text, /plastic stools — left foreground, in front of the counter/);
  assert.match(map.sides, /left part of the view behind them \(plastic stools\)/);
  const key = worldKeyFromBlueprint(market);
  assert.match(key.text, /^WORLD KEY · Night market alley/);
  assert.match(key.text, /PLACE — Night market alley \(exterior\)\./);
  assert.match(key.text, /MASTER VIEW — from the alley mouth facing the food stalls\./);
  assert.match(key.text, /FIXED SET \(seen from the master view\) — noodle stall counter: centre midground; lantern string: /);
  assert.match(key.text, /LIGHT — warm lantern light from above/);
  assert.deepEqual(key.fixed_set, ["noodle stall counter", "lantern string", "plastic stools"]);
  assert.match(worldKeyFromBlueprint(market, { hasLocationPhoto: true }).text, /exactly as in the attached location photo \(noodle stall counter, lantern string, plastic stools\)/);
});

test("older projects without a blueprint get one derived from their prose — any phrasing", () => {
  // One-sentence comma list (it used to yield no set map at all).
  const scenery = "Bright small café in white and pale oak: long oak counter by the entrance, espresso machine, chalkboard menu, two round tables, a tall fiddle-leaf plant; open seating.";
  assert.ok(looseLandmarkList(scenery, "Small café").length >= 4);
  const map = buildSetMap({ setting: "Small café", scenery });
  assert.ok(map, "a comma-list scenery still yields a map");
  const derived = blueprintFromProse({ locationId: "cafe", name: "Same café as before", setting: "Small café, oak counter", scenery, lighting: "Soft daylight from the front windows, even", propNames: ["paper_cup"] });
  assert.equal(derived.source, "derived");
  assert.equal(derived.name, "Small café");
  assert.ok(derived.fixed_elements.length >= 3);
  assert.equal(derived.light, "Soft daylight from the front windows");
  const street = blueprintFromProse({ locationId: "street", name: "Old street", setting: "Hang Bong street in the Old Quarter at dusk", scenery: "Landmarks: narrow tube houses with yellow facades, wrought-iron balconies, a street vendor's bamboo pole, tangled overhead power lines.", lighting: "" });
  assert.equal(street.kind, "exterior");
  // The resolver prefers the planner's blueprint and derives the rest.
  const all = resolveLocationBlueprints({
    planner: PLANNER_BLUEPRINTS,
    locations: [
      { id: "night_market", name: "x", setting: "", scenery: "", lighting: "" },
      { id: "cafe", name: "Small café", setting: "Small café", scenery, lighting: "" },
    ],
    propNames: PROPS,
  });
  assert.equal(all.get("night_market")!.source, "planner");
  assert.equal(all.get("cafe")!.source, "derived");
});

test("server normalisation keeps one clean blueprint per used location and drops ledger props", () => {
  const breakdown = {
    character_locks: [{ name: "Lan" }],
    location_blueprints: [...PLANNER_BLUEPRINTS, { location_id: "unused_place", name: "Unused", fixed_elements: ["wall"] }, { name: "no id" }],
    segments: [
      { location_id: "night_market", state_ledger: { start: [{ entity_id: "shopping_basket" }, { entity_id: "Lan" }], changes: [], end: [] } },
      { location_id: "taxi" },
    ],
  };
  assert.deepEqual(ledgerPropNames(breakdown), ["shopping basket"]);
  normalizeBreakdownBlueprints(breakdown, ledgerPropNames(breakdown));
  const ids = (breakdown.location_blueprints as Array<{ location_id: string }>).map((b) => b.location_id);
  assert.deepEqual(ids, ["night_market", "taxi"]);
});

test("camera: push in then widen back holds the opening framing; one move stays as written", () => {
  const beats = [
    { beat: "Lan looks at the menu", camera: "handheld_vlog: vertical medium at Lan's eye level; counter and menu visible" },
    { beat: "push", camera: "handheld_vlog: slightly downward medium close from the same camera zone; focus follows the menu" },
    { beat: "react", camera: "reaction_comedy: steady two-shot; Minh remains readable behind her; focus settles on Lan" },
  ];
  assert.deepEqual(analyzeCameraPath(beats).sizes, ["MS", "CU", "MS"]);
  const fixed = enforceCameraContinuity(beats);
  assert.equal(fixed.changed, true);
  assert.deepEqual(fixed.after, ["MS", "MS", "MS"]);
  assert.equal(fixed.beats[0], beats[0], "the keyframe beat is untouched");
  assert.match(fixed.beats[1]!.camera!, /^handheld_vlog: HOLD the opening medium framing .*; focus follows the menu$/);
  assert.match(fixed.beats[2]!.camera!, /Minh remains readable behind her/, "subjects and reactions stay");
  assert.equal(analyzeCameraPath(fixed.beats).locked, true);
  assert.equal(enforceCameraContinuity(fixed.beats).changed, false, "idempotent");
  const pullBack = [{ camera: "[CU] close on hands" }, { camera: "[CU] close" }, { camera: "[MS] medium reveal" }];
  assert.equal(enforceCameraContinuity(pullBack).changed, false, "one pull-back is one move");
  const coded = enforceCameraContinuity([{ camera: "[MS] medium two-shot of Lan and Minh" }, { camera: "[CU] close on Lan" }, { camera: "[WS] wide of the place" }]);
  assert.match(coded.beats[1]!.camera!, /^\[MS\] HOLD the opening medium framing/);
  const breakdown = { segments: [{ beats: pullBack }] };
  assert.equal(withCameraContinuity(breakdown), breakdown, "nothing to fix → same object");
});

const registry: ProductionRegistryEntry[] = [
  { entity_id: "char_lan", display_name: "Lan", kind: "character", aliases: [] },
  { entity_id: "char_minh", display_name: "Minh", kind: "character", aliases: [] },
  { entity_id: "obj_paper_cup", display_name: "paper_cup", kind: "object", aliases: [] },
  { entity_id: "obj_serving_tray", display_name: "serving_tray", kind: "object", aliases: [] },
  { entity_id: "obj_cart", display_name: "shopping_cart", kind: "object", aliases: [] },
  { entity_id: "obj_tray_card", display_name: "tray_card", kind: "object", aliases: [] },
  { entity_id: "entity_lan_holds_card_in_left_hand", display_name: "Lan holds card in left hand", kind: "unknown", aliases: [] },
];

function emptySnapshot() {
  return { entities: [], contacts: [], supports: [], placements: [], visual_instances: [], occlusions: [] };
}

function shot(id: string, extra: Partial<ShotState>): ShotState {
  return {
    shot_id: id,
    scene_id: id,
    segment_number: Number(id.slice(-1)),
    location_id: "night_market",
    start_time_s: 0,
    end_time_s: 10,
    story_time: null,
    spatial_graph: null,
    camera_state: {} as ShotState["camera_state"],
    lighting_state: {} as ShotState["lighting_state"],
    dialogue_state: { language: null, source: "none", camera_beat_count: 0, turns: [] },
    audio_state: {} as ShotState["audio_state"],
    start_snapshot: emptySnapshot(),
    changes: [],
    actions: [],
    end_snapshot: emptySnapshot(),
    ...extra,
  } as ShotState;
}

test("actions: a continuation clause keeps its actor; owners and compound nouns are neither actors nor contacts", () => {
  const s = shot("shot_002", {
    changes: [
      { entity_id: "obj_paper_cup", from: "full", action: "Minh lifts his cup with his right hand, carries it to the tray, and releases it beside Lan's cup", to: "full", caused_by: "Minh's right hand", body_part: "right_hand", contact_entity_ids: ["obj_paper_cup"] },
      { entity_id: "char_lan", from: "standing", action: "Lan finishes and rests her right hand on the tray rim", to: "standing", caused_by: "Lan", contact_entity_ids: ["char_lan"], body_part: "right_hand" },
      { entity_id: "obj_paper_cup", from: "on tray", action: "Lan uses her left hand to remove only the tray card from the cup sleeve", to: "on tray", caused_by: "Lan" },
    ],
  });
  compileAtomicActions(s, registry);
  assert.equal(s.actions.find((a) => /releases it/.test(a.verb))!.subject_entity_id, "char_minh", "Lan's cup names an owner, not the actor");
  assert.deepEqual(s.actions.find((a) => /rests her right hand/.test(a.verb))!.contact_entity_ids, ["obj_serving_tray"], "the rim is a contact with the tray, not with Lan herself");
  assert.ok(!s.actions.find((a) => /tray card/.test(a.verb))!.contact_entity_ids.includes("obj_serving_tray"), "a tray CARD is not the serving tray");
});

test("ledger repair: a prop in/on any registry object or blueprint element has no holder; a sentence holder becomes the hand; a lap is body support", () => {
  const state: ProductionState = {
    version: "1.0",
    registry,
    boundaries: [],
    findings: [],
    shots: [
      shot("shot_002", {
        changes: [{ entity_id: "obj_paper_cup", from: "full", action: "Minh puts it down", to: "full", caused_by: "Minh", from_position: "Minh's lap", to_position: "in the shopping cart", from_holder_entity_id: "char_minh", to_holder_entity_id: "char_lan" }],
        start_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_paper_cup", kind: "object", state: "full", position: "Minh's lap", holder_entity_id: "char_minh" }] },
        end_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_paper_cup", kind: "object", state: "full", position: "on the stall counter", holder_entity_id: "char_lan" }] },
      }),
      shot("shot_004", {
        end_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_tray_card", kind: "object", state: "held", position: "before Lan's chest", holder_entity_id: "entity_lan_holds_card_in_left_hand" }] },
      }),
    ],
  };
  const frozen = JSON.stringify(state);
  const { state: repaired, repairs } = repairProductionStateContinuity(state, { surfaceNames: ["stall counter"] });
  assert.equal(JSON.stringify(state), frozen, "the input is never mutated");
  assert.equal(repaired.shots[0]!.changes[0]!.to_holder_entity_id, null, "in the cart (a registry object) → nobody holds it");
  assert.equal(repaired.shots[0]!.end_snapshot.entities[0]!.holder_entity_id, null, "on the stall counter (a blueprint element) → nobody holds it");
  assert.equal(repaired.shots[0]!.start_snapshot.entities[0]!.holder_entity_id, null);
  assert.ok(repaired.shots[0]!.start_snapshot.supports.some((s) => s.kind === "body" && s.support_entity_id === "char_minh"));
  assert.equal(repaired.shots[1]!.end_snapshot.entities[0]!.holder_entity_id, "char_lan");
  assert.deepEqual(repairs.map((r) => r.kind).sort(), ["holder_but_inside_container", "holder_but_inside_container", "holder_is_a_sentence", "lap_is_body_support"]);
});

test("prop plan: what moves (with hand), what changes in place, what stays put", () => {
  const s = shot("shot_003", {
    changes: [{ entity_id: "obj_paper_cup", from: "full", action: "Lan slides the cup with her right hand onto the tray", to: "full", caused_by: "Lan", from_position: "on the counter", to_position: "on the serving tray", body_part: "right_hand" }],
    start_snapshot: { ...emptySnapshot(), entities: [
      { entity_id: "obj_paper_cup", kind: "object", state: "", position: "on the counter" },
      { entity_id: "obj_serving_tray", kind: "object", state: "", position: "counter, right end" },
    ] },
    end_snapshot: { ...emptySnapshot(), entities: [
      { entity_id: "obj_paper_cup", kind: "object", state: "", position: "on the serving tray" },
      { entity_id: "obj_serving_tray", kind: "object", state: "", position: "counter, right end" },
    ] },
  });
  compileAtomicActions(s, registry);
  const plan = shotPropPlan(s, registry);
  assert.deepEqual(plan.moves.map((m) => [m.label, m.by, m.hand, m.kind]), [["paper cup", "Lan", "right hand", "move"]]);
  assert.deepEqual(plan.stays.map((x) => x.label), ["serving tray"]);
  const folded = shot("shot_005", {
    changes: [{ entity_id: "obj_serving_tray", from: "flat", action: "Minh uses his left hand to fold the tray stand", to: "folded", caused_by: "Minh", from_position: "counter, right end", to_position: "counter, right end", body_part: "left_hand" }],
    start_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_serving_tray", kind: "object", state: "flat", position: "counter, right end" }] },
    end_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_serving_tray", kind: "object", state: "folded", position: "counter, right end" }] },
  });
  compileAtomicActions(folded, registry);
  const foldedPlan = shotPropPlan(folded, registry);
  assert.deepEqual(foldedPlan.moves.map((m) => [m.label, m.kind, m.by]), [["serving tray", "change", "Minh"]], "changed in place by a hand ≠ staying put");
  assert.deepEqual(foldedPlan.stays, []);
});

function twoPlaceBreakdown(withBlueprints: boolean) {
  const beats = [
    { beat: "Lan looks at the stall", camera: "handheld_vlog: vertical medium at Lan's eye level; counter visible" },
    { beat: "push", camera: "handheld_vlog: slightly downward medium close; focus follows her hands" },
    { beat: "reaction", camera: "reaction_comedy: steady two-shot; Lan's hand rests on the cup in the foreground, Minh behind" },
  ];
  return {
    title: "Two places",
    total_duration_seconds: 20,
    thumbnail_title: "T",
    social_posts: { tiktok: { caption: "x", hashtags: [] } },
    character_locks: [{ name: "Lan" }, { name: "Minh" }],
    ...(withBlueprints ? { location_blueprints: PLANNER_BLUEPRINTS } : {}),
    segments: [
      { segment_number: 1, duration_seconds: 10, marketing_role: "hook", first_frame_prompt: "Lan at the noodle stall counter", full_prompt: "x", motion_prompt: "x", characters_in_scene: ["Lan", "Minh"], environment_ref: "night_market", location_id: "night_market", beats },
      { segment_number: 2, duration_seconds: 10, marketing_role: "body", first_frame_prompt: "Lan on the back seat", full_prompt: "x", motion_prompt: "x", characters_in_scene: ["Lan", "Minh"], environment_ref: "taxi", location_id: "taxi", beats },
    ],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
}

const clipAt = (name: string, setting: string, scenery: string) => ({
  background_lock: { name, setting, scenery, lighting: "Evening light, warm" },
  negative_prompt: "morphing",
  scene_action: { start_state: "Lan stands", end_state: "Lan smiles" },
});
const CLIPS = [
  clipAt("Same alley and exact positions as", "Night market alley with food stalls", "Busy alley: noodle stall counter, plastic stools, lantern string, neon signs"),
  clipAt("Continue from the prior end frame.", "Taxi back seat at night", "Taxi interior: back seat, rear windows, door panels"),
];

test("manifest: every place gets its blueprint world key — the same text in its establishing image, keyframes and videos, also after compaction", () => {
  const m = buildNanoFlowManifest(twoPlaceBreakdown(true), { veoClips: CLIPS as never });
  for (const manifest of [m, compactNanoFlowManifest(m)]) {
    const keys = manifest.continuity!.world_keys;
    assert.match(keys.night_market!, /^WORLD KEY · Night market alley/);
    assert.match(keys.taxi!, /^WORLD KEY · Taxi back seat/, "the planner's junk name falls back to a real place name");
    assert.equal(manifest.continuity!.blueprints!.night_market!.source, "planner");
    for (const env of manifest.assets.environments!) {
      const plate = JSON.parse(env.location_views![0]!.prompt) as Record<string, unknown>;
      assert.equal(Object.keys(plate)[0], "world_key");
      assert.equal(plate.world_key, keys[env.id]);
    }
    manifest.shots.forEach((s) => {
      const loc = s.video_refs!.environments![0]!;
      const frame = JSON.parse(s.storyboard_prompt) as Record<string, unknown>;
      const lead = typeof frame.opening_frame === "string" ? ["opening_frame", "world_key"] : ["world_key"];
      assert.deepEqual(Object.keys(frame).slice(0, lead.length), lead);
      assert.equal(frame.world_key, keys[loc]);
      const video = s.video_prompt as Record<string, unknown>;
      assert.deepEqual(Object.keys(video).slice(0, 2), ["world_key", "continuity_contract"]);
      assert.equal(video.world_key, keys[loc]);
      assert.doesNotMatch(String((video.background_lock as Record<string, unknown>).name), /Same alley|Continue from/);
      assert.match(String(s.beats![1]!.camera), new RegExp(CAMERA_HOLD_MARK));
    });
  }
  const market = m.shots[0]!.video_prompt as Record<string, unknown>;
  assert.match(String((market.background_lock as Record<string, unknown>).set_map), /seen from the master view: from the alley mouth facing the food stalls/, "the set map comes from the blueprint");
  assert.match(String(market.negative_prompt), /the noodle stall counter, the lantern string, the plastic stools[^,]*(?:, the [^,]+)? moving, sliding/);
  assert.equal(m.assets.environments!.find((e) => e.id === "night_market")!.name, "Night market alley");
  assert.equal(JSON.stringify(applyContinuityContract(m)), JSON.stringify(m), "idempotent");
  assert.deepEqual(superviseContinuity(m).findings.filter((f) => f.code === "CONT-009"), []);
});

test("script supervisor: derived blueprints are flagged; a widen-back or a missing key blocks; override unlocks", () => {
  const legacy = buildNanoFlowManifest(twoPlaceBreakdown(false), { veoClips: CLIPS as never });
  assert.equal(legacy.continuity!.blueprints!.night_market!.source, "derived");
  const legacyReport = superviseContinuity(legacy);
  assert.ok(legacyReport.findings.some((f) => f.code === "CONT-009" && f.severity === "medium"));
  assert.deepEqual(legacyReport.findings.filter(isBlockingContinuityFinding), []);

  const broken = JSON.parse(JSON.stringify(legacy)) as typeof legacy;
  broken.shots[0]!.beats = [{ beat: "a", camera: "[MS] medium" }, { beat: "b", camera: "[CU] close" }, { beat: "c", camera: "[MS] medium" }];
  delete (broken.shots[1]!.video_prompt as Record<string, unknown>).world_key;
  const report = superviseContinuity(broken);
  const codes = report.findings.map((f) => `${f.segment_number ?? "p"}:${f.code}`);
  assert.ok(codes.includes("1:CONT-002"), codes.join(" "));
  assert.ok(codes.includes("2:CONT-004"), codes.join(" "));
  const asReport = { ok: false, findings: report.findings, counts: { critical: 0, high: 2, medium: 0, total: 2 }, summary: "" };
  assert.equal(assessContinuityExportGate(asReport).blocked, true);
  assert.equal(assessContinuityExportGate(asReport, true).blocked, false, "explicit override");
  assert.ok(report.log[0]!.findings.some((f) => f.startsWith("CONT-002")));
});

test("continuity end frames (opt-in): only shots where a hand moves a prop get an END keyframe with the same world key", () => {
  const ledger = (moves: boolean) => ({
    start: [{ entity_id: "paper_cup", state: "full", position: "on the stall counter" }],
    changes: moves
      ? [{ entity_id: "paper_cup", from: "full", action: "Lan slides the cup with her right hand onto the tray", to: "full", caused_by: "Lan", from_position: "on the stall counter", to_position: "on the serving tray", body_part: "right_hand" }]
      : [],
    end: [{ entity_id: "paper_cup", state: "full", position: moves ? "on the serving tray" : "on the stall counter" }],
  });
  const bd = {
    ...twoPlaceBreakdown(true),
    segments: [1, 2].map((n) => ({
      segment_number: n, duration_seconds: 10, marketing_role: "hook", first_frame_prompt: "Lan at the stall counter", full_prompt: "x", motion_prompt: "x",
      characters_in_scene: ["Lan"], location_id: "night_market", environment_ref: "night_market", beats: [{ beat: "a", camera: "[MS] medium of Lan" }], state_ledger: ledger(n === 1),
    })),
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const off = buildNanoFlowManifest(bd, { veoClips: [CLIPS[0], CLIPS[0]] as never });
  assert.deepEqual(off.shots.map((s) => s.frame_mode), ["start", "start"], "off by default");
  const on = compactNanoFlowManifest(buildNanoFlowManifest(bd, { veoClips: [CLIPS[0], CLIPS[0]] as never, continuityEndFrames: true }));
  assert.deepEqual(on.shots.map((s) => [s.frame_mode, s.continuity_end_frame === true]), [["start_end", true], ["start", false]]);
  const end = JSON.parse(on.shots[0]!.end_storyboard_prompt!) as Record<string, unknown>;
  assert.equal(end.world_key, on.continuity!.world_keys.night_market);
  assert.equal(on.continuity!.log[0]!.end_frame, true);
  // A per-shot "start" override still wins.
  const forced = buildNanoFlowManifest(bd, { veoClips: [CLIPS[0], CLIPS[0]] as never, continuityEndFrames: true, frameModeOverrides: { 1: "start" } });
  assert.equal(forced.shots[0]!.frame_mode, "start");
});

test("structured camera fields: shot_size / move are read before the camera text and follow the rewrite", async () => {
  const { normalizeBeatCameraFields, normalizeShotSize, normalizeCameraMove } = await import("./camera.ts");
  assert.equal(normalizeShotSize("wide"), "WS");
  assert.equal(normalizeShotSize("Medium close-up"), "CU");
  assert.equal(normalizeShotSize("?"), null);
  assert.equal(normalizeCameraMove("Push-in"), "push_in");
  assert.equal(normalizeCameraMove("dolly out"), "pull_back");
  // The prose says nothing about size; the structured fields do.
  const beats = [
    { beat: "a", camera: "handheld: Lan at the counter", shot_size: "MS", move: "hold" },
    { beat: "b", camera: "handheld: on her hands", shot_size: "CU", move: "push_in" },
    { beat: "c", camera: "handheld: both of them", shot_size: "MS", move: "pull_back" },
  ];
  assert.deepEqual(analyzeCameraPath(beats).sizes, ["MS", "CU", "MS"]);
  const fixed = enforceCameraContinuity(beats);
  assert.equal(fixed.changed, true);
  assert.deepEqual(fixed.beats.map((b) => [b.shot_size, b.move]), [["MS", "hold"], ["MS", "hold"], ["MS", "hold"]]);
  // Same size but a structured push_in then pull_back is still two directions.
  assert.equal(analyzeCameraPath([{ camera: "x", shot_size: "MS" }, { camera: "y", shot_size: "MS", move: "push_in" }, { camera: "z", shot_size: "MS", move: "pull_back" }]).turns, 1);
  const breakdown = { segments: [{ beats: [{ beat: "a", camera: "x", shot_size: "close up", move: "zoom in" }, { beat: "b", camera: "y", shot_size: "??", move: "??" }] }] };
  normalizeBeatCameraFields(breakdown);
  assert.deepEqual(breakdown.segments[0]!.beats, [{ beat: "a", camera: "x", shot_size: "CU", move: "push_in" }, { beat: "b", camera: "y" }]);
});

test("structured hand / touches in the state ledger win over guessing from the verb", async () => {
  const { buildProductionState } = await import("../production-state/normalizer.ts");
  const state = buildProductionState({
    total_duration_seconds: 10,
    character_locks: [{ name: "Lan" }],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      characters_in_scene: ["Lan"],
      location_id: "night_market",
      state_ledger: {
        start: [{ entity_id: "Lan", state: "standing", position: "at the counter" }, { entity_id: "paper_cup", state: "full", position: "on the counter" }, { entity_id: "serving_tray", state: "empty", position: "counter, right end" }],
        // The verb names no hand and no tray contact; the structured fields do.
        changes: [{ entity_id: "paper_cup", from: "full", action: "Lan moves the cup over", to: "full", caused_by: "Lan", from_position: "on the counter", to_position: "on the serving tray", hand: "left_hand", touches: ["paper_cup", "serving_tray"] }],
        end: [{ entity_id: "Lan", state: "standing", position: "at the counter" }, { entity_id: "paper_cup", state: "full", position: "on the serving tray" }, { entity_id: "serving_tray", state: "holds the cup", position: "counter, right end" }],
      },
    }],
  } as never);
  const change = state.shots[0]!.changes[0]!;
  assert.equal(change.body_part, "left_hand");
  const action = state.shots[0]!.actions[0]!;
  assert.equal(action.body_part, "left_hand");
  const ids = new Map(state.registry.map((r) => [r.display_name, r.entity_id]));
  assert.deepEqual([...action.contact_entity_ids].sort(), [ids.get("paper_cup"), ids.get("serving_tray")].sort());
});

test("script supervisor cross-checks each start state with its place's blueprint (CONT-010) and asks for structured hands (CONT-011)", () => {
  const breakdown = twoPlaceBreakdown(true) as unknown as { segments: Array<Record<string, unknown>> };
  breakdown.segments[0]!.first_frame_prompt = "Lan stands at the noodle stall counter; the plastic stools are on the right of the frame.";
  breakdown.segments[1]!.first_frame_prompt = "Lan sits and looks out.";
  const m = buildNanoFlowManifest(breakdown as never, { veoClips: CLIPS as never });
  const report = superviseContinuity(m, breakdown as never);
  const cont10 = report.findings.filter((f) => f.code === "CONT-010").map((f) => `${f.segment_number}:${f.message}`);
  assert.ok(cont10.some((f) => f.startsWith("1:") && /plastic stools" ở bên phải/.test(f)), cont10.join(" | "));
  assert.ok(cont10.some((f) => f.startsWith("2:") && /không nhắc đồ cố định/.test(f)), cont10.join(" | "));
  assert.ok(report.findings.filter((f) => f.code === "CONT-010").every((f) => f.severity === "medium"));
});

test("CONT-011: a hand change on a prop without structured hand/touches is flagged in a structured project", () => {
  const withLedger = (structured: boolean) => ({
    ...twoPlaceBreakdown(true),
    segments: [{
      segment_number: 1, duration_seconds: 10, marketing_role: "hook", first_frame_prompt: "Lan at the noodle stall counter", full_prompt: "x", motion_prompt: "x",
      characters_in_scene: ["Lan"], location_id: "night_market", environment_ref: "night_market", beats: [{ beat: "a", camera: "[MS] medium of Lan" }],
      state_ledger: {
        start: [{ entity_id: "paper_cup", state: "full", position: "on the stall counter" }],
        changes: [{
          entity_id: "paper_cup", from: "full", action: "Lan slides the cup with her right hand onto the tray", to: "full", caused_by: "Lan", from_position: "on the stall counter", to_position: "on the serving tray",
          ...(structured ? { hand: "right_hand", touches: ["paper_cup"] } : {}),
        }],
        end: [{ entity_id: "paper_cup", state: "full", position: "on the serving tray" }],
      },
    }],
    total_duration_seconds: 10,
  }) as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const codes = (structured: boolean) => superviseContinuity(buildNanoFlowManifest(withLedger(structured), { veoClips: [CLIPS[0]] as never })).findings.map((f) => f.code);
  assert.ok(codes(false).includes("CONT-011"));
  assert.ok(!codes(true).includes("CONT-011"));
});

test("Phòng biên tập helpers: list places, seed from the script, edit without losing a row being typed", async () => {
  const B = await import("./blueprint.ts");
  const draft = {
    character_locks: [{ name: "Lan" }],
    scene_bible: { backdrop: "Small bakery: long glass counter, bread shelves on the back wall, a round café table by the window", lighting: "Morning sun from the front window" },
    segments: [
      { segment_number: 1, location_id: "bakery", first_frame_prompt: "Lan behind the glass counter", state_ledger: { start: [{ entity_id: "bread_basket" }], changes: [], end: [] } },
      { segment_number: 2, location_id: "custom" },
      { segment_number: 3, environment_ref: "bakery" },
    ],
  };
  assert.deepEqual(B.editorLocations(draft), ["bakery"]);
  assert.equal(B.editorBlueprint(draft, "bakery"), null);
  const seeded = B.seedBlueprint(draft, "bakery");
  assert.equal(seeded.source, "planner", "the reviewed draft becomes the authority");
  assert.ok(seeded.fixed_elements.length >= 2);
  const list = B.upsertBlueprint(undefined, seeded);
  const withRow = B.upsertBlueprint(list, { ...seeded, fixed_elements: [...seeded.fixed_elements, { name: "", frame_zone: "", relation: "" }] });
  const shown = B.editorBlueprint({ ...draft, location_blueprints: withRow }, "bakery")!;
  assert.equal(shown.fixed_elements.at(-1)!.name, "", "an empty row the user is filling stays on screen");
  assert.deepEqual(B.splitFrameZone("left background"), { x: "left", depth: "background" });
  assert.equal(B.joinFrameZone("right", ""), "right");
  // The export path still cleans it (empty rows and props are dropped).
  const exported = B.normalizeLocationBlueprint(withRow[0], { propNames: B.ledgerPropNames(draft) })!;
  assert.ok(exported.fixed_elements.every((e) => e.name.trim()));
});

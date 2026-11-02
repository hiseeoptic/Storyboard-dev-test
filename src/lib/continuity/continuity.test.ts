import assert from "node:assert/strict";
import test from "node:test";
import { buildSetMap, looseLandmarkList } from "../environment/set-map.ts";
import { analyzeCameraPath, enforceCameraContinuity, withCameraContinuity, CAMERA_HOLD_MARK } from "./camera.ts";
import { compileAtomicActions } from "../production-state/action-compiler.ts";
import { repairProductionStateContinuity } from "./ledger-repair.ts";
import { applyContinuityContract, buildWorldKey, junkPlaceName, shotPropPlan } from "./contract.ts";
import { superviseContinuity, isBlockingContinuityFinding } from "./supervisor.ts";
import { assessContinuityExportGate } from "../validation/export-policy.ts";
import { buildNanoFlowManifest } from "../nano-flow/manifest.ts";
import { compactNanoFlowManifest } from "../nano-flow/prompt-compaction.ts";
import type { ProductionRegistryEntry, ProductionState, ShotState } from "../production-state/types.ts";

// The living room of "na-kiem-tra-gio-dien-thoai" (02/11/2026): table shifted in
// clip 2, the open box slid out of frame in clip 3.
const LIVING_ROOM = {
  setting: "Contemporary Vietnamese living room, beige sofa behind the family, low wooden table at the cream rug edge.",
  scenery:
    "Warm modern Vietnamese living room in beige, cream, honeyed wood, and muted green: beige sofa behind the family, low wooden table at the rug edge, cream rug, sunlit window, woven rattan basket, and one small leafy plant; uncluttered play area.",
};

const registry: ProductionRegistryEntry[] = [
  { entity_id: "char_na", display_name: "Na", kind: "character", aliases: [] },
  { entity_id: "char_me", display_name: "Mẹ", kind: "character", aliases: [] },
  { entity_id: "char_bo", display_name: "Bố", kind: "character", aliases: [] },
  { entity_id: "obj_phone_father", display_name: "phone_father", kind: "object", aliases: [] },
  { entity_id: "obj_paper_box", display_name: "paper_box", kind: "object", aliases: [] },
  { entity_id: "obj_picture_cards", display_name: "picture_cards", kind: "object", aliases: [] },
  { entity_id: "obj_cushion_castle", display_name: "cushion_castle", kind: "object", aliases: [] },
  { entity_id: "entity_na_holds_castle_card_in_left_hand", display_name: "Na holds castle card in left hand", kind: "unknown", aliases: [] },
];

function emptySnapshot() {
  return { entities: [], contacts: [], supports: [], placements: [], visual_instances: [], occlusions: [] };
}

function shot(id: string, extra: Partial<ShotState>): ShotState {
  return {
    shot_id: id,
    scene_id: id,
    segment_number: Number(id.slice(-1)),
    location_id: "location_01",
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

test("a scenery written as one comma list still gets a fixed set map, anchored on the table", () => {
  const items = looseLandmarkList(LIVING_ROOM.scenery, LIVING_ROOM.setting);
  assert.deepEqual(items.map((i) => i.item), ["beige sofa", "low wooden table", "cream rug", "sunlit window", "woven rattan basket", "small leafy plant"]);
  assert.equal(items.find((i) => i.item === "beige sofa")?.position, "behind the family");
  const map = buildSetMap(LIVING_ROOM)!;
  assert.ok(map, "the room used to get NO map");
  assert.equal(map.anchor, "the low wooden table");
  assert.match(map.text, /The low wooden table stands in the middle ground, at the rug edge/);
  assert.match(map.text, /woven rattan basket — right end of the table/);
  assert.match(map.text, /small leafy plant — back-left corner/);
  // Too little text still yields no map.
  assert.equal(buildSetMap({ setting: "Living room", scenery: "A cosy room." }), null);
});

test("camera: push in then widen back holds the opening framing; one move stays as written", () => {
  const beats = [
    { beat: "Na looks at the cards", camera: "handheld_vlog: vertical family medium at Na's eye level; box and three cards visible" },
    { beat: "push", camera: "handheld_vlog: slightly downward medium close from the same camera zone; focus follows the card group" },
    { beat: "react", camera: "reaction_comedy: steady family framing; Mẹ and Bố remain readable behind her; focus settles on Na" },
  ];
  assert.deepEqual(analyzeCameraPath(beats).sizes, ["MS", "CU", "MS"]);
  assert.equal(analyzeCameraPath(beats).turns, 1);
  const fixed = enforceCameraContinuity(beats);
  assert.equal(fixed.changed, true);
  assert.deepEqual(fixed.after, ["MS", "MS", "MS"]);
  assert.equal(fixed.beats[0], beats[0], "the keyframe beat is untouched");
  assert.match(fixed.beats[1]!.camera!, /^handheld_vlog: HOLD the opening medium framing .*; focus follows the card group$/);
  assert.match(fixed.beats[2]!.camera!, /Mẹ and Bố remain readable behind her/, "subjects and reactions stay");
  assert.equal(fixed.beats[2]!.beat, "react");
  assert.equal(analyzeCameraPath(fixed.beats).locked, true);
  assert.equal(enforceCameraContinuity(fixed.beats).changed, false, "idempotent");
  // A single pull-back or push-in is one move.
  const pullBack = [{ camera: "[CU] close on hands" }, { camera: "[CU] close" }, { camera: "[MS] medium reveal" }];
  assert.equal(enforceCameraContinuity(pullBack).changed, false);
  // Bracket codes follow the opening size.
  const coded = enforceCameraContinuity([{ camera: "[MS] medium two-shot of Lan and Minh" }, { camera: "[CU] close on Lan" }, { camera: "[WS] wide of the room" }]);
  assert.match(coded.beats[1]!.camera!, /^\[MS\] HOLD the opening medium framing/);
  const breakdown = { segments: [{ beats: pullBack }] };
  assert.equal(withCameraContinuity(breakdown), breakdown, "nothing to fix → same object");
});

test("actions: a continuation clause keeps its actor; owners and compound nouns are not actors or contacts", () => {
  const s = shot("shot_002", {
    changes: [
      {
        entity_id: "obj_phone_father",
        from: "intact",
        action: "Bố lifts his phone with his right hand, carries it to the basket, and releases it beside Mẹ's phone",
        to: "intact",
        caused_by: "Bố's right hand",
        body_part: "right_hand",
        contact_entity_ids: ["obj_phone_father"],
      },
      { entity_id: "char_na", from: "seated", action: "Na finishes the transfer and rests her right hand on the box rim", to: "seated", caused_by: "Na", contact_entity_ids: ["char_na"], body_part: "right_hand" },
      { entity_id: "obj_picture_cards", from: "in box", action: "Na uses her left hand to remove only the castle card from the box", to: "held", caused_by: "Na" },
    ],
  });
  compileAtomicActions(s, registry);
  const release = s.actions.find((a) => /releases it/.test(a.verb))!;
  assert.equal(release.subject_entity_id, "char_bo", "Mẹ's phone names an owner, not the actor");
  const rest = s.actions.find((a) => /rests her right hand/.test(a.verb))!;
  assert.deepEqual(rest.contact_entity_ids, ["obj_paper_box"], "the box rim is a contact with the box, not with Na herself");
  const remove = s.actions.find((a) => /castle card/.test(a.verb))!;
  assert.ok(!remove.contact_entity_ids.includes("obj_cushion_castle"), "a castle CARD is not the cushion castle");
  assert.ok(remove.contact_entity_ids.includes("obj_picture_cards"));
});

test("ledger repair: a prop in the basket has no holder, a sentence holder becomes the hand, a lap is body support", () => {
  const state: ProductionState = {
    version: "1.0",
    registry,
    boundaries: [],
    findings: [],
    shots: [
      shot("shot_002", {
        changes: [{ entity_id: "obj_phone_father", from: "intact", action: "Bố releases it beside Mẹ's phone", to: "intact", caused_by: "Bố", from_position: "Bố's lap", to_position: "inside rattan basket beside phone_mother", from_holder_entity_id: "char_bo", to_holder_entity_id: "char_me" }],
        start_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_phone_father", kind: "object", state: "intact", position: "Bố's lap", holder_entity_id: "char_bo" }] },
        end_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_phone_father", kind: "object", state: "intact", position: "inside rattan basket beside phone_mother", holder_entity_id: "char_me" }] },
      }),
      shot("shot_004", {
        end_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_picture_cards", kind: "object", state: "one castle card held", position: "castle card before Na's chest", holder_entity_id: "entity_na_holds_castle_card_in_left_hand" }] },
      }),
    ],
  };
  const frozen = JSON.stringify(state);
  const { state: repaired, repairs } = repairProductionStateContinuity(state);
  assert.equal(JSON.stringify(state), frozen, "the input is never mutated");
  const change = repaired.shots[0]!.changes[0]!;
  assert.equal(change.to_holder_entity_id, null);
  assert.equal(repaired.shots[0]!.end_snapshot.entities[0]!.holder_entity_id, null);
  assert.equal(repaired.shots[0]!.start_snapshot.entities[0]!.holder_entity_id, null, "on a lap → supported by the body");
  assert.ok(repaired.shots[0]!.start_snapshot.supports.some((s) => s.kind === "body" && s.support_entity_id === "char_bo"));
  assert.equal(repaired.shots[1]!.end_snapshot.entities[0]!.holder_entity_id, "char_na");
  assert.deepEqual(
    repairs.map((r) => r.kind).sort(),
    ["holder_but_inside_container", "holder_but_inside_container", "holder_is_a_sentence", "lap_is_body_support"]
  );
});

test("world key: one deterministic block per place, fixed set without the story props", () => {
  const key = buildWorldKey({
    locationId: "location_01",
    name: "Contemporary Vietnamese living room",
    ...LIVING_ROOM,
    lighting: "Soft window daylight, even light level on the play area",
    setMap: buildSetMap(LIVING_ROOM),
    hasLocationPhoto: false,
    propLabels: ["rattan phone basket", "paper box", "picture cards"],
  });
  assert.match(key.text, /^WORLD KEY · Contemporary Vietnamese living room/);
  assert.match(key.text, /FIXED SET — low wooden table: middle ground, at the rug edge; beige sofa: behind the family/);
  assert.doesNotMatch(key.text, /rattan basket/, "the phone basket is a story prop, not furniture");
  assert.match(key.text, /LIGHT — Soft window daylight;/);
  assert.equal(key.anchor, "low wooden table");
  const photo = buildWorldKey({ locationId: "l", name: "Kitchen", setting: "", scenery: "", lighting: "", setMap: null, hasLocationPhoto: true, propLabels: [] });
  assert.match(photo.text, /exactly as in the attached location photo/);
  assert.equal(junkPlaceName("Continue from the prior end frame."), true);
  assert.equal(junkPlaceName("Same living room and exact positions as"), true);
  assert.equal(junkPlaceName("Contemporary Vietnamese living room"), false);
});

test("prop plan: what moves (with hand), what is only touched, what stays put", () => {
  const s = shot("shot_003", {
    changes: [{ entity_id: "obj_picture_cards", from: "face-up", action: "Na gathers all three cards with her right hand and transfers them into the open box", to: "face-up", caused_by: "Na", from_position: "beside open box on table", to_position: "inside open paper box", body_part: "right_hand" }],
    start_snapshot: { ...emptySnapshot(), entities: [
      { entity_id: "obj_picture_cards", kind: "object", state: "", position: "beside open box on table" },
      { entity_id: "obj_paper_box", kind: "object", state: "open", position: "table in front of Na" },
    ] },
    end_snapshot: { ...emptySnapshot(), entities: [
      { entity_id: "obj_picture_cards", kind: "object", state: "", position: "inside open paper box" },
      { entity_id: "obj_paper_box", kind: "object", state: "open", position: "table in front of Na" },
    ] },
  });
  compileAtomicActions(s, registry);
  const plan = shotPropPlan(s, registry);
  assert.deepEqual(plan.moves.map((m) => [m.label, m.by, m.hand]), [["picture cards", "Na", "right hand"]]);
  assert.deepEqual(plan.stays.map((x) => x.label), ["paper box"]);
  // Same place, new arrangement: the castle is changed by a hand, not "staying put".
  const castle = shot("shot_005", {
    changes: [{ entity_id: "obj_cushion_castle", from: "two large cushions as walls; small cushion separate", action: "Na uses her right hand to push the small cushion against the rear-wall end", to: "three cushions forming rear, left and right walls", caused_by: "Na", from_position: "rug in front of Na", to_position: "rug in front of Na", body_part: "right_hand" }],
    start_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_cushion_castle", kind: "object", state: "", position: "rug in front of Na" }] },
    end_snapshot: { ...emptySnapshot(), entities: [{ entity_id: "obj_cushion_castle", kind: "object", state: "", position: "rug in front of Na" }] },
  });
  compileAtomicActions(castle, registry);
  const castlePlan = shotPropPlan(castle, registry);
  assert.deepEqual(castlePlan.moves.map((m) => [m.label, m.kind, m.by]), [["cushion castle", "change", "Na"]]);
  assert.deepEqual(castlePlan.stays, []);
  assert.deepEqual(castlePlan.touched, []);
});

function livingRoomBreakdown() {
  const beats = [
    { beat: "Na looks at the cards", camera: "handheld_vlog: vertical family medium at Na's eye level; box and three cards visible" },
    { beat: "Na gathers the cards", camera: "handheld_vlog: slightly downward medium close; focus follows the card group" },
    { beat: "reaction", camera: "reaction_comedy: steady family framing; Na's hand rests on the box rim in the foreground, Bố behind" },
  ];
  return {
    title: "Na kiểm tra giờ điện thoại",
    total_duration_seconds: 20,
    thumbnail_title: "NA",
    social_posts: { tiktok: { caption: "x", hashtags: [] } },
    character_locks: [{ name: "Na" }, { name: "Bố" }],
    segments: [1, 2].map((n) => ({
      segment_number: n,
      duration_seconds: 10,
      marketing_role: "hook",
      first_frame_prompt: "Na sits at the low wooden table",
      full_prompt: "x",
      motion_prompt: "x",
      characters_in_scene: ["Na", "Bố"],
      environment_ref: "location_01",
      beats,
    })),
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
}

const livingRoomClip = {
  background_lock: { name: "Continue from the prior end frame.", ...LIVING_ROOM, lighting: "Soft window daylight, even" },
  negative_prompt: "morphing",
  scene_action: { start_state: "Na sits", end_state: "Na smiles" },
};

test("manifest: the same world key leads the establishing image, every keyframe and every video — also after compaction", () => {
  const m = buildNanoFlowManifest(livingRoomBreakdown(), { veoClips: [livingRoomClip, livingRoomClip] as never });
  for (const manifest of [m, compactNanoFlowManifest(m)]) {
    const key = manifest.continuity!.world_keys.location_01!;
    assert.match(key, /FIXED SET — low wooden table/);
    const plate = JSON.parse(manifest.assets.environments![0]!.location_views![0]!.prompt) as Record<string, unknown>;
    assert.equal(Object.keys(plate)[0], "world_key");
    assert.equal(plate.world_key, key);
    for (const s of manifest.shots) {
      const frame = JSON.parse(s.storyboard_prompt) as Record<string, unknown>;
      const lead = typeof frame.opening_frame === "string" ? ["opening_frame", "world_key"] : ["world_key"];
      assert.deepEqual(Object.keys(frame).slice(0, lead.length), lead, "the frame's own description still leads; the world key comes right after");
      assert.equal(frame.world_key, key);
      const video = s.video_prompt as Record<string, unknown>;
      assert.deepEqual(Object.keys(video).slice(0, 2), ["world_key", "continuity_contract"]);
      assert.equal(video.world_key, key);
      assert.equal((video.background_lock as Record<string, unknown>).name, "Contemporary Vietnamese living room", "no script sentence as place name");
      assert.match(String(video.negative_prompt), /the low wooden table, the beige sofa, the cream rug, the sunlit window moving, sliding/);
      assert.match(String((video.continuity_contract as Record<string, unknown>).camera), /never widen back out/);
      assert.match(String(s.beats![1]!.camera), new RegExp(CAMERA_HOLD_MARK));
    }
    assert.equal(manifest.continuity!.log.length, 2);
    assert.equal(manifest.continuity!.log[0]!.camera_locked, true);
  }
  assert.equal(m.assets.environments![0]!.name, "Contemporary Vietnamese living room");
  // Idempotent: applying the contract again changes nothing.
  assert.equal(JSON.stringify(applyContinuityContract(m)), JSON.stringify(m));
});

test("script supervisor: a clean manifest passes; a widen-back, a moved prop without an actor or a missing key is blocking", () => {
  const m = buildNanoFlowManifest(livingRoomBreakdown(), { veoClips: [livingRoomClip, livingRoomClip] as never });
  const clean = superviseContinuity(m);
  assert.deepEqual(clean.findings.filter(isBlockingContinuityFinding), []);
  assert.equal(assessContinuityExportGate({ ok: true, findings: clean.findings, counts: { critical: 0, high: 0, medium: 0, total: 0 }, summary: "" }).blocked, false);

  const broken = JSON.parse(JSON.stringify(m)) as typeof m;
  broken.shots[0]!.beats = [{ beat: "a", camera: "[MS] medium" }, { beat: "b", camera: "[CU] close" }, { beat: "c", camera: "[MS] medium" }];
  delete (broken.shots[1]!.video_prompt as Record<string, unknown>).world_key;
  const report = superviseContinuity(broken);
  const codes = report.findings.map((f) => `${f.segment_number}:${f.code}`);
  assert.ok(codes.includes("1:CONT-002"), codes.join(" "));
  assert.ok(codes.includes("2:CONT-004"), codes.join(" "));
  const gate = assessContinuityExportGate({ ok: false, findings: report.findings, counts: { critical: 0, high: 2, medium: 0, total: 2 }, summary: "" });
  assert.equal(gate.blocked, true);
  assert.equal(assessContinuityExportGate({ ok: false, findings: report.findings, counts: { critical: 0, high: 2, medium: 0, total: 2 }, summary: "" }, true).blocked, false, "explicit override");
  assert.ok(report.log[0]!.findings.some((f) => f.startsWith("CONT-002")), "the log row carries its finding");
});

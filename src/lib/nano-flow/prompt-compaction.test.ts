import assert from "node:assert/strict";
import test from "node:test";
import { buildNanoFlowManifest } from "./manifest.ts";
import {
  compactKeyframePrompt,
  compactNanoFlowManifest,
  compactVideoPrompt,
  keyframeReferenceBinding,
} from "./prompt-compaction.ts";
import { validatePromptExports } from "../validation/prompt-validator.ts";

const BED = "Quiet indoor family-room tone, faint natural room ambience.";
const REVERB = "Small furnished living room with soft, short reflections.";
const LIGHT = "Soft window daylight; a discreet warm practical lamp remains secondary.";
const SCENERY = "Beige sofa behind the family, low wooden table at the rug edge, cream rug.";
const LENS = "Smartphone main-camera perspective, approximately 26 mm equivalent.";
const ARTIFACTS = "plastic-looking hair, plastic-looking skin";

const lockFor = (id: string, name: string, gender: string, voice: string, top: string) => ({
  id,
  name,
  reference_image_lock: "REFERENCE IMAGE IDENTITY LOCK: use the attached image only for this named character's identity.",
  avoid_character_surface_artifacts: ARTIFACTS,
  species: "REFERENCE_IMAGE",
  gender,
  age: "REFERENCE_IMAGE",
  voice_personality: voice,
  hair: "REFERENCE_IMAGE",
  outfit_top: top,
  outfit_bottom: "a plain matching pair of trousers completing the locked outfit, kept identical in every clip",
  outfit_materials: "matte cotton",
  hand_detail: "Natural hands with correct contact on named props; no fused or extra fingers",
  action_flow: {
    pre_action: "Begin exactly in scene_action.start_state",
    main_action: `Perform only ${name}'s actions in scene_action.motion`,
  },
});

function clip() {
  return {
    scene_id: "1",
    duration_sec: 10,
    aspect_ratio: "9:16",
    production_profile: { genre: "sitcom", camera_direction: "intimate motivated handheld" },
    location_id: "location_01",
    continuity_mode: "opening",
    visual_style: `Naturalistic family video; ${LENS}`,
    character_lock: {
      CHAR_1: lockFor("CHAR_1", "Na", "Female", "child timbre, 270-360 Hz, 170 wpm", "Pale yellow T-shirt and long blue trousers."),
      CHAR_2: lockFor("CHAR_2", "Mẹ", "Female", "warm adult timbre, 190-235 Hz, 150 wpm", "Cream top and light brown trousers."),
    },
    scene_bible_tokens: { lens: LENS, lighting: LIGHT, backdrop: SCENERY, audio_bed: BED, reverb: REVERB, film_grain: "fine grain" },
    background_lock: { id: "location_01", setting: "Vietnamese living room", scenery: SCENERY, lighting: LIGHT },
    audio_transition: { policy: "open", to_location_id: "location_01", sound_bed: BED, reverb_profile: REVERB },
    camera: { framing: "MEDIUM", movement: "USER-SELECTED CAMERA: Handheld — intimate motivated handheld. Hold the subject." },
    scene_action: { start_state: "Na sits on the rug", motion: "Mẹ lowers her phone", end_state: "phone in basket" },
    foley_and_ambience: { environment_sound_bed: BED, environment_reverb: REVERB, project_ambient: "", ambience: [BED], music: "None" },
    dialogue: [{ speaker_id: "CHAR_1", speaker_name: "Na", voice_personality: "child timbre, 270-360 Hz, 170 wpm", text: "Cho con đi mà!" }],
    lip_sync_director_note: "HARD VOICE BINDING.",
    output_rules: {
      audio: "One clean native voice at a time, each line taken from its own dialogue row's voice_personality — never use the first character as a default and never infer the speaker from camera framing or the visible face. Keep one low constant ambient bed; dialogue is audio only, with no captions or subtitles.",
      reference_priority: "AUTHORITY ORDER (do NOT reverse it): the SCRIPT-DERIVED STRUCTURED VIDEO PROMPT is the sole semantic authority for story action.",
      storyboard_reference_role: "Visual continuity only for events: do not infer new actions from the keyframe.",
      board_is_reference_not_a_frame: "The attached STORYBOARD KEYFRAME is the single full-frame visual opening authority.",
      semantic_priority: "Follow script_contract + ordered_atomic_actions + end_snapshot for WHAT HAPPENS. The storyboard image is downstream of that.",
    },
    negative_prompt: `resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual, morphing, ${ARTIFACTS}`,
    opening_frame: "OPENING FRAME (9:16, frame 0 of this clip): Camera: medium. Na sits on the rug. Set: Vietnamese living room. Light: daytime: soft…",
    board_usage: "OPENING VISUAL AUTHORITY: the attached single full-frame keyframe IS the first frame.",
    production_state_authority: { production_shot_id: "shot_001", authority_fingerprint: "psa_1", canonical_manifest_path: "production_state.shots[0]" },
    state_transition_contract: {
      authority_fingerprint: "psa_1",
      start_snapshot: {
        entities: [
          { entity_id: "char_na", kind: "character", state: "seated", position: "rug", holder_entity_id: null, held_objects: [] },
          { entity_id: "obj_phone", kind: "object", state: "intact", position: "Mẹ's hand", holder_entity_id: "char_me", held_objects: [] },
          { entity_id: "obj_box", kind: "object", state: "open", position: "table", holder_entity_id: null, held_objects: [] },
        ],
      },
      ordered_atomic_actions: [{ action_id: "a1", verb: "lowers the phone", start_state: "", transition_states: [], from_zone_id: "zone_one", to_zone_id: "zone_one" }],
      end_snapshot: {
        entities: [
          { entity_id: "char_na", kind: "character", state: "seated", position: "rug", holder_entity_id: null, held_objects: [] },
          { entity_id: "obj_phone", kind: "object", state: "intact", position: "inside basket", holder_entity_id: null, held_objects: [] },
          { entity_id: "obj_box", kind: "object", state: "open", position: "table", holder_entity_id: null, held_objects: [] },
        ],
      },
    },
    dialogue_audio_contract: { authority_fingerprint: "psa_1", audio_state: { environment_sound_bed: BED, environment_reverb: REVERB, music_strategy: "under dialogue" } },
  };
}

test("video: each repeated rule is written once and every fact survives", () => {
  const out = compactVideoPrompt(clip()) as Record<string, any>;

  // Shared character scaffolding moves to one block; identity, voice and outfit stay per person.
  assert.equal(out.character_lock_common.scope, "Applies to EVERY character in character_lock.");
  assert.equal(out.character_lock_common.hand_detail, "Natural hands with correct contact on named props; no fused or extra fingers");
  assert.equal(out.character_lock_common.action_flow.main_action, "Perform only each character's actions in scene_action.motion");
  assert.match(out.character_lock_common.identity_from_reference_image, /species, age, hair/);
  assert.equal(out.character_lock_common.avoid_character_surface_artifacts, undefined, "already in negative_prompt");
  assert.deepEqual(Object.keys(out.character_lock.CHAR_1), ["id", "name", "gender", "voice_personality", "outfit_top", "outfit_materials"]);
  assert.equal(out.character_lock.CHAR_2.voice_personality, "warm adult timbre, 190-235 Hz, 150 wpm");
  assert.ok(Object.keys(out).indexOf("character_lock_common") < Object.keys(out).indexOf("scene_action"));

  // Sound bed and reverb live once, in foley_and_ambience.
  assert.equal(out.foley_and_ambience.environment_sound_bed, BED);
  assert.equal(out.foley_and_ambience.ambience, undefined);
  assert.equal(out.audio_transition.sound_bed, undefined);
  assert.equal(out.audio_transition.policy, "open");
  assert.equal(out.dialogue_audio_contract.audio_state.environment_sound_bed, undefined);
  assert.equal(out.dialogue_audio_contract.audio_state.music_strategy, "under dialogue");
  assert.deepEqual(out.scene_bible_tokens, { film_grain: "fine grain" });
  assert.equal(out.background_lock.lighting, LIGHT);
  assert.equal(out.production_profile.camera_direction, undefined);

  // The keyframe role is said once, in opening_frame; the authority keys keep their checked words.
  assert.match(out.opening_frame, /^OPENING FRAME \(9:16\): the attached keyframe IS frame 0/);
  assert.equal(out.board_usage, undefined);
  assert.equal(out.output_rules.board_is_reference_not_a_frame, undefined);
  assert.match(out.output_rules.reference_priority, /^AUTHORITY ORDER \(do NOT reverse it\)/);
  assert.match(out.output_rules.storyboard_reference_role.toLowerCase(), /visual continuity only/);
  assert.match(out.output_rules.semantic_priority.toLowerCase(), /storyboard image is downstream/);
  assert.match(out.output_rules.audio, /lip_sync_director_note/);

  // Start once, then only what changed.
  assert.equal(out.state_transition_contract.authority_fingerprint, undefined);
  assert.deepEqual(out.state_transition_contract.end_changes, [{ entity_id: "obj_phone", position: "inside basket", holder_entity_id: null }]);
  assert.deepEqual(out.state_transition_contract.ordered_atomic_actions, [{ action_id: "a1", verb: "lowers the phone", zone_id: "zone_one" }]);
  assert.match(out.negative_prompt, /resembling a real, famous or identifiable person \(celebrity or public-figure lookalike\)/);

  assert.ok(JSON.stringify(out).length < JSON.stringify(clip()).length);
  assert.deepEqual(compactVideoPrompt(out), out, "idempotent");
});

test("video: a one-piece or named trousers drops the filler bottom, a bare top keeps it", () => {
  const raw = clip();
  raw.character_lock.CHAR_2.outfit_top = "Cream cotton blouse";
  const out = compactVideoPrompt(raw) as Record<string, any>;
  assert.equal(out.character_lock.CHAR_1.outfit_bottom, undefined);
  assert.match(out.character_lock.CHAR_2.outfit_bottom, /plain matching pair of trousers/);
});

test("video: a flat-string prompt passes through", () => {
  assert.equal(compactVideoPrompt("a flat prompt"), "a flat prompt");
});

function keyframe() {
  const names = ["Na", "Mẹ"];
  return {
    opening_frame: "OPENING FRAME (9:16): Camera: medium. Na sits on the rug.",
    type: "photoreal_keyframe",
    aspect_ratio: "9:16",
    layout: "ONE single 9:16 still. NO text of any kind anywhere on the image.",
    moment: "THE FIRST FRAME of this ~10s shot: Na sits on the rug beside the basket.",
    camera: "[MEDIUM] eye level",
    cast: names.map((name) => ({
      name,
      appearance: "Female",
      wardrobe: `${name === "Na" ? "Pale yellow T-shirt and long blue trousers" : "Cream top and brown trousers"}., a plain matching pair of trousers completing the locked outfit, kept identical in every clip`,
    })),
    setting: "Vietnamese living room.",
    set_dressing_lock: "SET DRESSING LOCK: on the table — paper box (open, table).",
    wardrobe_note: "Wardrobe (story-locked): Na in Pale yellow T-shirt and long blue trousers.; Mẹ in Cream top and brown trousers..",
    reference_fidelity_contract: "The attached character and location reference images are LAW.",
    authority_fingerprint: "psa_1",
    production_state_authority: {
      production_shot_id: "shot_001",
      authority_fingerprint: "psa_1",
      authority_order: ["script", "production_state", "video_prompt", "storyboard_board"],
      script_contract: { first_frame_prompt: "Na sits on the rug beside the basket.", motion_prompt: "Mẹ lowers her phone", beats: [{ beat: "pull back" }] },
      start_snapshot: {
        entities: [
          { entity_id: "char_na", kind: "character", state: "seated", position: "rug", orientation: "facing Mẹ", holder_entity_id: null, wardrobe: null, held_objects: [], pose: "unknown" },
          { entity_id: "obj_paper_box", kind: "object", state: "open", position: "table", orientation: "opening upward", holder_entity_id: null, held_objects: [] },
        ],
        placements: [{ entity_id: "char_na", zone_id: "zone_one" }],
      },
      ordered_atomic_actions: [{ action_id: "a1", verb: "lowers" }],
      end_snapshot: { entities: [{ entity_id: "char_na", state: "standing" }], placements: [] },
      canonical_manifest_path: "production_state.shots[0]",
    },
    video_prompt_projection: { scene_action: { motion: "Mẹ lowers her phone" } },
    character_cardinality_contract: {
      identities: names.map((name) => ({ name, reference_binding: keyframeReferenceBinding(name, false), maximum_instances_per_panel: 1 })),
      rule: "Render each named identity at most once in this frame (0-or-1 instances).",
    },
    camera_subject_contract: { required_on_camera: ["Na"], rule: "Camera framing decides who is visible." },
    support_surface_contract: { seated_characters: [], rule: "Every seated character's pelvis rests on the support." },
    placement_continuity_contract: {
      mode: "initial",
      canonical_placements: names.map((_name, i) => ({
        entity_id: i === 0 ? "char_na" : "char_me",
        zone_id: "zone_one",
        anchor_id: null,
        position_label: "each occupies the declared zone",
        body_orientation: i === 0 ? "facing Mẹ" : "facing Na",
        world_side: "unknown",
      })),
      rule: "Keep every character on the declared side.",
    },
    setting_authority: "The SCRIPT defines the location content. If none is attached, build the complete setting faithfully from this description: Vietnamese living room.. Never replace it.",
    staging: "Render only the camera-visible subject(s) required by camera_subject_contract, each at most once.",
    consistency: "PROJECT CONTINUITY LOCK set_01: SAME physical set. Persistent props (obj_paper_box (paper_box)) keep one exact shape, material, colour and wear across shots. Only script-caused change.",
    persistent_prop_authority: [{ entity_id: "obj_paper_box (paper_box)", rule: "The first generated/attached appearance is the immutable visual design authority for every later frame." }],
    reference_authority: "ABSOLUTE REFERENCE LAW — obey the image. (2) WARDROBE comes from the STORY-LOCKED outfit in wardrobe_note — NOT from the reference image. (3) LOCATION comes from the attached location reference — reproduce it.",
    body_visibility_contract: "A visible hand stays connected to its owner; never a disembodied crop.",
    negative: "Photorealistic only — NOT cartoon. This is ONE single film frame: no storyboard grid, no panels, no split frames, no collage, no captions, no numbers, no watermark, no logo, NO text of any kind. No identity drift; never duplicate a character; never render disembodied hands, arm-only crops or headless people; no extra fingers.",
  };
}

test("keyframe: one instant, one reference law, one copy of each rule", () => {
  const out = JSON.parse(compactKeyframePrompt(JSON.stringify(keyframe()))) as Record<string, any>;

  // The clip's motion, the other end and the video blocks are gone; the opening instant stays.
  assert.equal(out.opening_frame, undefined);
  assert.equal(out.video_prompt_projection, undefined);
  const psa = out.production_state_authority;
  assert.deepEqual(Object.keys(psa), ["production_shot_id", "canonical_manifest_path", "start_snapshot"]);
  assert.deepEqual(psa.start_snapshot.entities, [
    { entity_id: "char_na", state: "seated", position: "rug" },
    { entity_id: "obj_paper_box", orientation: "opening upward" },
  ]);
  assert.equal(psa.start_snapshot.placements, undefined, "the placement contract carries them");

  // Wardrobe once (cast), the filler gone, the law pointing at cast.
  assert.equal(out.cast[0].wardrobe, "Pale yellow T-shirt and long blue trousers");
  assert.equal(out.wardrobe_note, undefined);
  assert.match(out.reference_authority, /outfit in cast\[\]\.wardrobe/);
  assert.equal(out.reference_fidelity_contract, undefined);
  assert.ok(Object.keys(out).indexOf("reference_authority") < Object.keys(out).indexOf("production_state_authority"));

  // The identity budget the validator checks stays per name; the binding text once.
  assert.deepEqual(out.character_cardinality_contract.identities, [
    { name: "Na", maximum_instances_per_panel: 1 },
    { name: "Mẹ", maximum_instances_per_panel: 1 },
  ]);
  assert.match(out.character_cardinality_contract.reference_binding, /side-profile panel is ONLY for head\/silhouette shape/);

  assert.equal(out.support_surface_contract, undefined);
  assert.equal(out.staging, undefined);
  assert.equal(out.setting_authority, undefined, "law (3) says it");
  assert.equal(out.persistent_prop_authority, undefined);
  assert.match(out.consistency, /Persistent props \(obj_paper_box\) keep one exact shape, material, colour and wear across shots; their first generated\/attached appearance is the immutable visual design authority/);
  assert.equal(out.placement_continuity_contract.shared_position_label, "each occupies the declared zone");
  assert.deepEqual(out.placement_continuity_contract.canonical_placements[0], { entity_id: "char_na", zone_id: "zone_one", body_orientation: "facing Mẹ" });
  assert.equal(out.negative, "Photorealistic only — NOT cartoon. No watermark, no logo. No identity drift; never duplicate a character; no extra fingers.");

  const again = compactKeyframePrompt(JSON.stringify(out));
  assert.equal(again, JSON.stringify(out), "idempotent");
});

test("keyframe: the script's first-frame text stays when moment does not cover it", () => {
  const raw = keyframe();
  raw.production_state_authority.script_contract.first_frame_prompt = "Same room as the preceding end frame; both hands resting on her lap.";
  const out = JSON.parse(compactKeyframePrompt(JSON.stringify(raw))) as Record<string, any>;
  assert.equal(out.production_state_authority.script_first_frame, "Same room as the preceding end frame; both hands resting on her lap.");
});

test("a multi-panel board and a non-JSON prompt are left alone", () => {
  const board = JSON.stringify({ type: "photoreal_storyboard_board", panels: [{ panel: 1 }], video_prompt_projection: {} });
  assert.equal(compactKeyframePrompt(board), board);
  assert.equal(compactKeyframePrompt("plain text prompt"), "plain text prompt");
});

test("a compiled manifest keeps every gate-checked field after compaction", () => {
  const breakdown = {
    title: "Giỏ điện thoại",
    total_duration_seconds: 10,
    thumbnail_title: "CẢ NHÀ CẤT MÁY?",
    character_locks: [{ name: "Na" }, { name: "Mẹ" }],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      first_frame_prompt: "Na sits on the rug; Mẹ holds her phone.",
      full_prompt: "Mẹ lowers her phone into the basket.",
      motion_prompt: "Mẹ lowers her phone into the basket.",
      dialogue: "Cho con điện thoại đi mà!",
      characters_in_scene: ["Na", "Mẹ"],
      environment_ref: "living_room_1",
      beats: [{ beat: "Mẹ lowers the phone", camera: "[MEDIUM] eye level two-shot of Na and Mẹ" }],
    }],
  };
  const canonical = buildNanoFlowManifest(breakdown as never, { generatedAt: "2026-10-27T00:00:00Z", veoClips: [clip()] });
  const compact = compactNanoFlowManifest(canonical);
  const before = JSON.stringify(canonical.shots[0]);
  const after = JSON.stringify(compact.shots[0]);
  assert.ok(after.length < before.length * 0.75, `${before.length} -> ${after.length}`);
  assert.deepEqual(compactNanoFlowManifest(compact), compact, "idempotent");

  // Findings on rules the compact prompt must still satisfy exactly.
  const kept = ["AUTH-004", "AUTH-005", "AUTH-006", "AUTH-007", "VID-003", "VID-004", "IMG-001", "IMG-003", "IMG-004", "IMG-005", "IMG-006", "SYNC-001"];
  const codes = (m: typeof canonical) => validatePromptExports(m).findings.map((f) => f.code).filter((code) => kept.includes(code)).sort();
  assert.deepEqual(codes(compact), codes(canonical));
  assert.equal(compact.production_state, canonical.production_state, "the canonical state is untouched");
});

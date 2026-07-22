const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "../..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const mapped = request.startsWith("@/")
    ? path.join(projectRoot, "src", request.slice(2))
    : request;
  return originalResolve.call(this, mapped, parent, isMain, options);
};

const compileTs = (mod, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  mod._compile(output.outputText, filename);
};
require.extensions[".ts"] = compileTs;

const { buildVeoJson } = require("./storyboard-breakdown.ts");
const {
  inferRevolvingDoorOperation,
  resolveSpatialLayout,
} = require("../lib/spatial-topology/index.ts");

test("Veo JSON keeps the stable structure without repeating character/outfit/voice prose", () => {
  const breakdown = {
    character_locks: [
      {
        name: "Minh",
        gender: "male",
        is_child: false,
        gender_age: "Vietnamese male, 32 years old",
        build: "average build",
        skin_tone: "medium complexion",
        face_structure: "oval face",
        skin_texture: "real skin with visible pores",
        eye_details: "dark brown eyes",
        eyebrow_details: "individual natural brow hairs",
        eyelash_details: "individual natural lashes",
        nose_lips_details: "natural nose and lips",
        hair: "short black hair",
        hair_details: "natural hairline and flyaways",
        eyes: "dark brown",
        costume: "light blue collared shirt, dark grey trousers",
        wardrobe_materials: "cotton shirt and wool-blend trousers",
        signature_features: "gentle asymmetrical smile",
        render_style: "photoreal live action",
        voice: "native Standard Northern Vietnamese, warm male voice",
      },
      {
        name: "Lan",
        gender: "female",
        is_child: false,
        voice: "native Standard Northern Vietnamese, calm female voice",
      },
    ],
    scene_bible: {
      lens: "natural medium lens",
      lighting: "soft window daylight",
      backdrop: "modest apartment dining room",
      color_grade: "neutral natural grade",
      film_grain: "fine organic grain",
    },
    style_guide: { art_direction: "natural live action", color_palette: [] },
    segments: [
      {
        segment_number: 1,
        duration_seconds: 8,
        title: "Bữa cơm",
        marketing_role: "body",
        beats: [{ beat: "Minh sits", camera: "medium static eye-level framing" }],
        first_frame_prompt:
          "A modest apartment dining room with a wooden table and soft window daylight. Minh, Vietnamese male, 32 years old, with short black hair, wearing light blue collared shirt, dark grey trousers, sits left of Lan with both feet on the floor.",
        motion_prompt:
          "Minh turns toward Lan and places his right hand on the table. Lan watches silently. Single continuous motion, natural movement obeying real-world physics, consistent weight and gravity, stable identity, object permanence.",
        dialogue: "Anh hiểu rồi.",
        speaker: "Minh",
        dialogue_lines: [{ speaker: "Minh", text: "Anh hiểu rồi.", start_s: 1, end_s: 3 }],
        characters_in_scene: ["Minh", "Lan"],
        environment_ref: "custom",
        spatial_layout: {
          zone_order: "dining table left -> dining table right",
          fixed_architecture: "table and walls stay fixed",
          character_placement: "Minh sits left of Lan",
          walkable_path: "clear floor around the table",
          camera_zone: "supported floor in front of the table",
        },
        continuity_note: "Minh remains seated left of Lan with his right hand on the table.",
      },
    ],
  };

  const result = buildVeoJson(breakdown, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
    characterReferenceNames: ["Lan"],
  });
  const clip = result.clips[0];

  assert.equal(Object.hasOwn(clip, "prompt"), false);
  assert.deepEqual(Object.keys(clip).slice(0, 6), [
    "scene_id",
    "duration_sec",
    "visual_style",
    "scene_role",
    "characters_in_scene",
    "character_lock",
  ]);
  assert.equal(Object.hasOwn(clip.scene_action, "wardrobe_lock"), false);
  assert.equal(Object.hasOwn(clip.dialogue[0], "voice_personality"), false);
  const stableCharacterFields = [
    "id",
    "name",
    "species",
    "gender",
    "age",
    "voice_personality",
    "body_build",
    "face_shape",
    "hair",
    "eyes",
    "skin_or_fur_color",
    "skin_texture",
    "signature_feature",
    "outfit_top",
    "outfit_bottom",
    "outfit_materials",
    "helmet_or_hat",
    "shoes_or_footwear",
    "props",
    "body_metrics",
    "position",
    "orientation",
    "pose",
    "foot_placement",
    "hand_detail",
    "expression",
    "action_flow",
  ];
  for (const character of Object.values(clip.character_lock)) {
    for (const field of stableCharacterFields) assert.ok(Object.hasOwn(character, field), field);
  }
  assert.match(clip.character_lock.CHAR_1.voice_personality, /Northern Vietnamese/i);
  assert.equal(clip.character_lock.CHAR_1.outfit_top, "light blue collared shirt");
  assert.equal(clip.character_lock.CHAR_1.outfit_bottom, "dark grey trousers");
  assert.equal(clip.character_lock.CHAR_2.outfit_top, "REFERENCE_IMAGE");
  assert.equal(clip.character_lock.CHAR_2.face_shape, "REFERENCE_IMAGE");
  assert.equal(clip.character_lock.CHAR_2.position, "Use spatial_topology.character_placement");
  assert.ok(clip.character_lock.CHAR_2.action_flow);
  assert.doesNotMatch(
    clip.scene_action.start_state,
    /32 years|short black hair|light blue collared shirt|dark grey trousers/i
  );
  assert.doesNotMatch(clip.background_lock.setting, /Minh|Lan/i);
  assert.doesNotMatch(
    clip.scene_action.motion,
    /single continuous motion, natural movement obeying/i
  );
  assert.match(clip.camera.focus, /NOT the active speaker/i);
  assert.match(clip.camera.focus, /speaker may remain off-camera/i);
  assert.match(clip.lip_sync_director_note, /dialogue\.speaker_id/i);
  assert.match(clip.lip_sync_director_note, /camera holds the listener/i);
  assert.match(clip.negative_prompt, /listener lip movement/i);
  assert.match(clip.negative_prompt, /wrong-speaker lip sync/i);
  assert.match(clip.negative_prompt, /disembodied hand/i);
  assert.match(clip.negative_prompt, /technical readout or HUD/i);
  assert.ok(clip.negative_prompt.length > 1400);
  // Full historical failure blacklist is intentionally retained; this cap
  // still catches the old duplicated flat prompt without deleting safeguards.
  assert.ok(JSON.stringify(clip).length < 12000);
});

test("revolving-door scenes never inherit doorway or stair topology", () => {
  const layout = resolveSpatialLayout({
    layout: {
      zone_order: "lower walkable area -> stair entry -> stair flight -> upper landing",
      fixed_architecture: "wrong legacy stair template",
      character_placement: "Minh and Lan stand by the mall entrance",
      walkable_path: "wrong legacy stair route",
      camera_zone: "mall lobby",
    },
    setting: "A modern mall entrance with one glass revolving door.",
    motion: "Lan steps out of the revolving-door compartment while Minh waits on the lobby floor.",
    characterNames: ["Minh", "Lan"],
  });

  assert.match(layout.zone_order, /revolving-door compartment/i);
  assert.doesNotMatch(layout.zone_order, /stair/i);
  assert.doesNotMatch(layout.fixed_architecture, /stair/i);
  assert.match(layout.character_placement, /Lan starts inside/i);
  assert.match(layout.walkable_path, /destination-side threshold exactly once/i);
  assert.match(layout.mechanism_motion, /already occupied wedge/i);
  assert.match(layout.mechanism_motion, /never reverse/i);
});

test("revolving-door operation distinguishes an exit from background-only motion", () => {
  assert.equal(inferRevolvingDoorOperation({
    setting: "A mall lobby with one glass revolving door.",
    motion: "Lan steps out of the revolving-door compartment while Minh waits.",
    startState: "Lan is inside the same occupied compartment.",
  }), "exit");

  const background = resolveSpatialLayout({
    setting: "A mall lobby with one glass revolving door behind Minh and Lan.",
    motion: "Minh and Lan remain on the lobby floor while the revolving door rotates behind them.",
    startState: "Minh and Lan stand together on the destination-side lobby floor.",
    endState: "They remain together on the same lobby floor.",
    characterNames: ["Minh", "Lan"],
  });

  assert.match(background.walkable_path, /background architecture only/i);
  assert.match(background.mechanism_motion, /unoccupied revolving door/i);
  assert.doesNotMatch(background.mechanism_motion, /occupied wedge/i);
});

test("Veo JSON serializes revolving-door mechanics and targeted failures without deleting the full negative contract", () => {
  const result = buildVeoJson({
    character_locks: [{
      name: "Minh",
      gender: "male",
      is_child: false,
      costume: "blue shirt, dark trousers",
      voice: "native Standard Northern Vietnamese male voice",
    }],
    scene_bible: { backdrop: "mall lobby" },
    segments: [{
      segment_number: 1,
      duration_seconds: 8,
      title: "Cửa xoay",
      marketing_role: "hook",
      beats: [{ beat: "Minh enters", camera: "medium eye-level hold on the listener" }],
      first_frame_prompt: "A mall lobby with one glass revolving door. Minh stands before the entrance gap on the origin side.",
      motion_prompt: "Minh enters one compartment and follows its curved arc to the destination side.",
      dialogue: "Em chờ anh nhé.",
      speaker: "Minh",
      dialogue_lines: [{ speaker: "Minh", text: "Em chờ anh nhé.", start_s: 1, end_s: 3 }],
      characters_in_scene: ["Minh"],
      environment_ref: "custom",
      continuity_note: "Minh stands on the destination-side lobby floor.",
    }],
  }, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
  });

  const clip = result.clips[0];
  assert.match(clip.spatial_topology.mechanism_motion, /same two wings/i);
  assert.match(clip.scene_action.staging, /mechanism_motion is mandatory/i);
  assert.match(clip.negative_prompt, /walking straight through a revolving door/i);
  assert.match(clip.negative_prompt, /exiting before the occupied opening aligns/i);
  assert.match(clip.negative_prompt, /listener lip movement/i);
  assert.ok(clip.negative_prompt.length > 1500);
});

test("Veo JSON reconciles chained revolving-door exit state without changing its schema", () => {
  const result = buildVeoJson({
    character_locks: [
      {
        name: "Minh",
        gender: "male",
        is_child: false,
        voice: "native Standard Northern Vietnamese male voice",
      },
      {
        name: "Lan",
        gender: "female",
        is_child: false,
        voice: "native Standard Northern Vietnamese female voice",
      },
    ],
    scene_bible: { backdrop: "modern mall lobby" },
    segments: [
      {
        segment_number: 1,
        duration_seconds: 10,
        title: "Cửa xoay",
        marketing_role: "hook",
        beats: [{ beat: "Lan waits inside", camera: "medium hold through the glass" }],
        first_frame_prompt: "A modern mall entrance with one glass revolving door. Lan is inside one compartment while Minh waits outside.",
        motion_prompt: "The occupied wedge rotates slowly while Lan remains between the same two glass wings and Minh waits outside.",
        characters_in_scene: ["Minh", "Lan"],
        environment_ref: "custom",
        continuity_note: "Lan remains inside the same occupied revolving-door compartment, looking toward Minh, who waits on the destination-side lobby floor.",
      },
      {
        segment_number: 2,
        duration_seconds: 10,
        title: "Bàn Tay Hằn Đỏ",
        marketing_role: "problem",
        beats: [
          { beat: "Lan exits", camera: "[MEDIUM] Lan has already exited the door" },
          { beat: "Minh looks down", camera: "[EXTREME_CLOSE] deep red marks on Lan's hand" },
          { beat: "Minh reacts", camera: "[CLOSE] Minh becomes concerned" },
        ],
        first_frame_prompt: "A modern mall entrance. Lan has just exited the revolving door and Minh faces her.",
        motion_prompt: "Lan steps out of the revolving door holding heavy shopping bags. Minh notices deep red marks on her skin where the bag straps have been digging in.",
        dialogue: "Anh cứ đi trước hoài, em theo muốn hụt hơi luôn đó.",
        speaker: "Lan",
        dialogue_lines: [
          { speaker: "Lan", text: "Anh cứ đi trước hoài, em theo muốn hụt hơi luôn đó.", start_s: 2, end_s: 6 },
          { speaker: "Minh", text: "Ủa anh tưởng em theo kịp mà...", start_s: 6.3, end_s: 9.2 },
        ],
        characters_in_scene: ["Minh", "Lan"],
        environment_ref: "custom",
        spatial_layout: {
          zone_order: "origin floor -> revolving door -> destination floor",
          fixed_architecture: "one glass revolving door",
          character_placement: "Lan and Minh both stand outside",
          walkable_path: "enter the door from the origin side",
          camera_zone: "mall exterior",
        },
        continuity_note: "Minh looks at Lan's hand, which is red from the bag straps, with quiet concern.",
      },
    ],
  }, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
    characterReferenceNames: ["Minh", "Lan"],
  });

  const clip = result.clips[1];
  assert.deepEqual(Object.keys(clip).slice(0, 6), [
    "scene_id",
    "duration_sec",
    "visual_style",
    "scene_role",
    "characters_in_scene",
    "character_lock",
  ]);
  assert.match(clip.scene_action.start_state, /Lan remains inside the same occupied/i);
  assert.doesNotMatch(clip.scene_action.start_state, /has just exited/i);
  assert.match(clip.spatial_topology.character_placement, /Lan starts inside/i);
  assert.match(clip.spatial_topology.walkable_path, /threshold exactly once/i);
  assert.doesNotMatch(clip.spatial_topology.walkable_path, /Enter only/i);
  assert.equal(clip.camera.framing, "MS");
  assert.match(clip.camera.movement, /one continuous medium two-shot/i);
  assert.doesNotMatch(clip.camera.movement, /EXTREME_CLOSE|deep red marks/i);
  assert.match(clip.scene_action.motion, /temporary pressure lines/i);
  assert.doesNotMatch(clip.scene_action.motion, /deep red marks|digging in/i);
  assert.doesNotMatch(clip.scene_action.end_state, /red from/i);
  assert.match(clip.scene_action.staging, /exits exactly once/i);
  assert.match(clip.negative_prompt, /repeating an entry or exit/i);
  assert.equal(clip.dialogue[0].speaker_id, "CHAR_2");
  assert.equal(clip.dialogue[1].speaker_id, "CHAR_1");
});

test("ordinary step verbs do not invent stairs", () => {
  const layout = resolveSpatialLayout({
    setting: "A flat mall lobby with a glass entrance.",
    motion: "Minh steps toward Lan on the same-level polished floor.",
    characterNames: ["Minh", "Lan"],
  });

  assert.equal(layout, null);
});

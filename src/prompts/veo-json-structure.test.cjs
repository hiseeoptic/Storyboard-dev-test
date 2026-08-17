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

const {
  buildSegmentVeoPrompt,
  buildStoryboardUserPrompt,
  buildThumbnailPrompt,
  buildVeoJson,
} = require("./storyboard-breakdown.ts");
const {
  inferRevolvingDoorOperation,
  resolveSpatialLayout,
} = require("../lib/spatial-topology/index.ts");
const {
  stripUploadedCharacterAppearance,
} = require("../lib/character-realism.ts");

test("stick-figure thumbnail keeps the selected medium and requested aspect", () => {
  const prompt = buildThumbnailPrompt({
    title: "Đừng vội cười người đi chậm",
    titleText: "ĐI CHẬM KHÔNG SAI",
    gagHint: "Người đi chậm buộc dây giày trong khi hai người khác chạy trước",
    settingHint: "Đường chạy vẽ tay có vạch xuất phát",
    characterDescription: "three distinct minimal stick-figure roles",
    style: "pencil_sketch",
    creativeDirective: "LOCKED STICK-FIGURE LINE LANGUAGE",
    coverTreatment: "stylized",
    aspectRatio: "16:9",
  });

  assert.match(prompt, /STYLIZED STORY VIDEO COVER/);
  assert.match(prompt, /HORIZONTAL 16:9/);
  assert.match(prompt, /ĐI CHẬM KHÔNG SAI/);
  assert.match(prompt, /same locked graphic medium/i);
  assert.doesNotMatch(prompt, /EXAGGERATED COMEDIC EXPRESSION|STICKER-POP TREATMENT/);
});

test("anonymous stylized projects request faithful thumbnail and social metadata", () => {
  const prompt = buildStoryboardUserPrompt({
    story_idea: "Một người đi chậm chuẩn bị kỹ rồi bền bỉ đi tiếp.",
    genre: "life_wisdom",
    style: "pencil_sketch",
    scene_count: 6,
    segment_count: 6,
    beats_per_segment: 3,
    video_goal: "social_short",
    character_representation: "whiteboard_stick_figure",
    anonymous_narration: true,
    dialogue_language: "Vietnamese",
  });

  assert.match(prompt, /anonymous stylized story/i);
  assert.match(prompt, /never invent personal names, character quotes/i);
  assert.match(prompt, /người que\/hoạt hình/i);
  assert.match(prompt, /no personal names, fake quotation/i);
  assert.match(prompt, /PRODUCTION LANGUAGE CONTRACT/);
  assert.match(prompt, /ALL machine-facing production prose in English/);
  assert.match(prompt, /ONLY fields allowed in Vietnamese are verbatim dialogue\/voice-over text/);
  assert.match(prompt, /Never code-switch within a production sentence/);
});

test("stick-figure video prompt rejects real hands and photoreal scene-bible leakage", () => {
  const breakdown = {
    character_locks: [{
      name: "Người đi chậm",
      build: "thin black-line stick figure",
      costume: "small blue shoe accent",
      signature_features: "blue shoes",
    }],
    scene_bible: {
      lens: "85mm live-action lens at f/1.8",
      lighting: "photographic studio skin light",
      backdrop: "a script-derived rough running road",
      color_grade: "photoreal premium commercial Rec.709",
      film_grain: "organic camera sensor grain",
    },
    style_guide: { art_direction: "photoreal premium commercial", color_palette: [] },
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      title: "Buộc dây giày",
      marketing_role: "hook",
      beats: [{ beat: "Người đi chậm buộc dây", camera: "medium eye-level" }],
      first_frame_prompt: "A rough illustrated running road with a start line.",
      motion_prompt: "The slow stick figure ties one shoe and rises.",
      dialogue_lines: [{ speaker: "", text: "Mỗi người có một thời điểm khác nhau.", start_s: 1, end_s: 5 }],
      characters_in_scene: ["Người đi chậm"],
      environment_ref: "office_night",
      continuity_note: "The same graphic world continues.",
    }],
  };
  const result = buildVeoJson(breakdown, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
    narratorVoiceStyle: "reflective low-mid register with deliberate pauses",
    characterRepresentation: "whiteboard_stick_figure",
    anonymousNarration: true,
  });
  const clip = result.clips[0];
  const serialized = JSON.stringify(clip);

  assert.match(clip.character_lock.CHAR_1.hand_detail, /black-line endpoints|minimal mitten/i);
  assert.match(clip.negative_prompt, /photoreal human hand|realistic skin hand/i);
  assert.match(clip.dialogue[0].voice_personality, /NARRATOR_01/);
  assert.match(clip.dialogue[0].voice_personality, /reflective low-mid register/i);
  assert.doesNotMatch(clip.visual_style, /photoreal premium commercial|Rec\.709|85mm/i);
  assert.doesNotMatch(JSON.stringify(clip.scene_bible_tokens), /Rec\.709|85mm|sensor grain/i);
  assert.doesNotMatch(serialized, /REAL MATERIALS/i);

  const flat = buildSegmentVeoPrompt({
    characterDescription: "one minimal black-line stick figure",
    setting: "the script-derived rough running road",
    sceneBible: breakdown.scene_bible,
    colorPalette: [],
    motionPrompt: "The figure ties one shoe.",
    dialogue: "Mỗi người có một thời điểm khác nhau.",
    dialogueLanguage: "Vietnamese",
    renderMedium: "whiteboard_stick_figure",
    environmentRef: "office_night",
  });
  assert.match(flat, /NARRATOR_01/);
  assert.doesNotMatch(flat, /REAL MATERIALS|Rec\.709|85mm|sensor grain/i);
});

test("anonymous role labels do not silence character dialogue in mixed mode", () => {
  const result = buildVeoJson({
    character_locks: [{
      name: "Người chồng",
      build: "minimal black-line stick figure",
      costume: "small blue accent",
      signature_features: "square glasses",
      voice: "warm adult male voice, calm natural cadence",
    }],
    scene_bible: {},
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      title: "Một câu trả lời",
      marketing_role: "body",
      characters_in_scene: ["Người chồng"],
      environment_ref: "drawn_home",
      first_frame_prompt: "A hand-drawn living room; Người chồng faces the listener.",
      motion_prompt: "Người chồng answers with a small reassuring nod.",
      dialogue_lines: [{
        speaker: "Người chồng",
        delivery: "on_screen",
        text: "Anh hiểu rồi.",
        start_s: 2,
        end_s: 4,
      }],
      beats: [{ beat: "Người chồng answers", camera: "[MEDIUM] face and upper body" }],
    }],
  }, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
    characterRepresentation: "whiteboard_stick_figure",
    speechMode: "mixed",
    anonymousCharacters: true,
  });

  const character = result.clips[0].character_lock.CHAR_1;
  assert.match(character.voice_personality, /warm adult male voice/i);
  assert.equal(character.speech_authority, undefined);
  assert.equal(result.clips[0].dialogue[0].speaker_name, "Người chồng");
});

test("Veo clip carries the locked genre voice, camera and sound profile", () => {
  const result = buildVeoJson({
    context_ir: {
      layers: {
        environment: {
          locations: [{
            id: "stadium",
            description: "A competition stadium with a readable finish line",
            spatial_anchors: ["track", "finish line", "stands"],
            fixed_elements: ["lane markings", "scoreboard"],
            lighting_motivation: "daylight",
            sound_bed: "crowd bed and track ambience",
            reverb_profile: "open stadium reflections",
          }],
        },
      },
      production_profile: {
        genre: "sports",
        dialogue_style_id: "live_commentary",
        narrator_voice_style_id: "sports",
        camera_profile_id: "broadcast_sports",
        script_direction: "Name the live contest, score pressure and consequence.",
        voice_direction: "Responsive commentary with rising energy at decisive moments.",
        camera_direction: "Readable field geography, tracked play and decisive replay coverage.",
        edit_rhythm: "Follow live action; replay only the decisive event.",
        sound_direction: "Crowd bed, impact detail and clear commentary priority.",
        forbidden_patterns: ["music-video montage", "camera crossing play direction"],
      },
    },
    character_locks: [{ name: "Vận động viên", costume: "blue competition kit" }],
    scene_bible: {},
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      title: "Pha quyết định",
      marketing_role: "hook",
      characters_in_scene: ["Vận động viên"],
      environment_ref: "stadium",
      first_frame_prompt: "A stadium during the decisive play.",
      motion_prompt: "The athlete accelerates toward the finish.",
      beats: [{ beat: "The athlete reaches the finish", camera: "tracked medium-wide" }],
    }],
  }, { aspectRatio: "16:9", dialogueLanguage: "Vietnamese" });

  assert.equal(result.clips[0].production_profile.camera_profile_id, "broadcast_sports");
  assert.match(result.clips[0].production_profile.camera_direction, /field geography/i);
  assert.match(result.clips[0].production_profile.sound_direction, /crowd bed/i);
});

test("uploaded references keep identity image-only while preserving contextual clothing text", () => {
  const cleaned = stripUploadedCharacterAppearance(
    "Lan, with long black hair, wearing a soft beige knit top and dark indigo jeans, stands beside Minh.",
    ["Lan"]
  );

  assert.doesNotMatch(cleaned, /long black hair/i);
  assert.match(cleaned, /soft beige knit top/i);
  assert.match(cleaned, /dark indigo jeans/i);
});

test("Veo JSON never treats a known character action as the static setting", () => {
  const result = buildVeoJson({
    character_locks: [
      {
        name: "Minh",
        gender: "male",
        is_child: false,
        costume: "light blue shirt, dark trousers",
        voice: "warm male timbre, natural F0 range 90-140 Hz, speaking rate 130 wpm",
      },
      {
        name: "Lan",
        gender: "female",
        is_child: false,
        costume: "cream blouse, dark trousers",
        voice: "gentle female timbre, natural F0 range 170-230 Hz, speaking rate 140 wpm",
      },
    ],
    context_ir: {
      layers: {
        environment: {
          locations: [{
            id: "home_living_room",
            description: "A modest Vietnamese apartment living room at night",
            spatial_anchors: ["sofa", "coffee table", "entry door"],
            fixed_elements: ["warm ceiling lamp", "street-facing window"],
            lighting_motivation: "warm practical ceiling light",
            sound_bed: "quiet room tone and distant motorbikes",
            reverb_profile: "short furnished-room decay",
          }],
        },
      },
    },
    scene_bible: {
      backdrop: "Lan stands in the living room, facing Minh",
    },
    segments: [{
      segment_number: 3,
      duration_seconds: 10,
      title: "Lan waits",
      marketing_role: "body",
      beats: [{ beat: "Lan watches the water", camera: "medium eye-level" }],
      first_frame_prompt: "Lan stands in the living room, facing Minh.",
      motion_prompt: "Lan looks down at the glass of water.",
      dialogue: "",
      speaker: "",
      dialogue_lines: [],
      // Reproduce the production defect: Lan was omitted from this per-scene
      // list even though she appears in the first-frame text.
      characters_in_scene: ["Minh"],
      environment_ref: "custom",
      location_id: "home_living_room",
      continuity_note: "Lan remains beside the coffee table.",
    }],
  }, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
  });

  const setting = result.clips[0].background_lock.setting;
  assert.match(setting, /apartment living room at night/i);
  assert.match(setting, /sofa|coffee table/i);
  assert.doesNotMatch(setting, /Lan|stands in|facing Minh/i);
});

test("Veo JSON keeps the stable structure with contextual outfits and local voice binding", () => {
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
        costume: "soft beige knit top, dark indigo jeans",
        wardrobe_materials: "matte fine knit and natural denim",
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

  assert.equal(result.production_prompt_language, "English");
  assert.equal(result.spoken_language, "Vietnamese");
  assert.equal(clip.output_specs.production_prompt_language, "English");
  assert.equal(clip.output_specs.spoken_language, "Vietnamese");
  assert.match(clip.output_specs.language_policy, /Only verbatim dialogue or voice-over/i);

  assert.equal(Object.hasOwn(clip, "prompt"), false);
  assert.deepEqual(Object.keys(clip).slice(0, 7), [
    "scene_id",
    "duration_sec",
    "aspect_ratio",
    "output_specs",
    "continuity_mode",
    "visual_style",
    "scene_role",
  ]);
  assert.equal(Object.hasOwn(clip.scene_action, "wardrobe_lock"), false);
  assert.equal(Object.hasOwn(clip.dialogue[0], "voice_personality"), true);
  assert.equal(
    clip.dialogue[0].voice_personality,
    clip.character_lock.CHAR_1.voice_personality
  );
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
  assert.equal(clip.character_lock.CHAR_2.gender, "Female");
  assert.equal(clip.character_lock.CHAR_2.outfit_top, "soft beige knit top");
  assert.equal(clip.character_lock.CHAR_2.outfit_bottom, "dark indigo jeans");
  assert.equal(clip.character_lock.CHAR_2.outfit_materials, "matte fine knit and natural denim");
  assert.match(clip.character_lock.CHAR_2.reference_image_lock, /identity lock/i);
  assert.match(clip.character_lock.CHAR_2.reference_image_lock, /do not copy clothing/i);
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
  assert.match(
    clip.lip_sync_director_note,
    /dialogue\.speaker_id \+ dialogue\.speaker_name \+ verbatim dialogue\.voice_personality/i
  );
  assert.match(clip.output_rules.audio, /Never use the first character as a default/i);
  assert.match(clip.negative_prompt, /listener lip movement/i);
  assert.match(clip.negative_prompt, /wrong-speaker lip sync/i);
  assert.match(clip.negative_prompt, /male voice for a female speaker/i);
  assert.match(
    clip.negative_prompt,
    /accent or dialect drift away from the locked character voice/i
  );
  assert.match(clip.negative_prompt, /disembodied hand/i);
  assert.match(clip.negative_prompt, /technical readout or HUD/i);
  assert.ok(clip.negative_prompt.length > 1400);
  // Full historical failure blacklist is intentionally retained; this cap
  // still catches the old duplicated flat prompt without deleting safeguards.
  assert.ok(JSON.stringify(clip).length < 12000);
});

test("scene_action keeps ordinary words that also appear inside character-lock fields", () => {
  // REGRESSION GUARD: stripCanonicalCharacterDetails used to split lock fields
  // (build / voice / render_style …) on commas and delete every >=4-char
  // fragment globally with NO word boundary — so "warm", "calm", "slim",
  // "cinematic" were erased from ordinary action prose and "warmly" was gutted
  // to "ly". Only a verbatim-copied DISTINCTIVE identity phrase (the exact hair
  // lock) may be removed; normal words must survive intact.
  const breakdown = {
    character_locks: [
      {
        name: "Minh",
        gender: "male",
        is_child: false,
        gender_age: "Vietnamese male, 32 years old",
        build: "slim, athletic",
        hair: "long black hair",
        costume: "white cotton blouse, blue jeans",
        wardrobe_materials: "soft cotton, worn denim",
        voice: "warm, calm, measured Northern Vietnamese male voice",
        render_style: "cinematic photoreal",
      },
    ],
    scene_bible: {
      lens: "natural medium lens",
      lighting: "soft daylight",
      backdrop: "quiet kitchen",
      color_grade: "neutral natural grade",
      film_grain: "fine organic grain",
    },
    style_guide: { color_palette: [] },
    segments: [
      {
        segment_number: 1,
        duration_seconds: 8,
        title: "Sáng sớm",
        marketing_role: "body",
        beats: [{ beat: "Minh reaches", camera: "medium eye-level" }],
        first_frame_prompt: "A quiet kitchen at dawn. Minh stands by the counter.",
        motion_prompt:
          "Minh calmly reaches for the warm teapot on the slim shelf, then warmly turns toward the cinematic dawn light and steps forward with athletic ease, his long black hair catching the glow.",
        dialogue: "",
        speaker: "",
        dialogue_lines: [],
        characters_in_scene: ["Minh"],
        environment_ref: "custom",
        continuity_note: "Minh stands by the counter holding the warm teapot.",
      },
    ],
  };

  const result = buildVeoJson(breakdown, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
  });
  const motion = result.clips[0].scene_action.motion;

  // Ordinary words that happen to be comma-fragments of build/voice/render_style
  // MUST survive (the old bug deleted them).
  for (const word of ["calmly", "warm", "slim", "warmly", "cinematic", "athletic"]) {
    assert.match(
      motion,
      new RegExp(`\\b${word}\\b`, "i"),
      `expected "${word}" to survive stripping, got: ${motion}`
    );
  }
  // No word was gutted into a bare "ly" fragment.
  assert.doesNotMatch(motion, /\bly\b/i);
  // The distinctive copied identity phrase is still de-duplicated out.
  assert.doesNotMatch(motion, /long black hair/i);
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
  assert.deepEqual(Object.keys(clip).slice(0, 7), [
    "scene_id",
    "duration_sec",
    "aspect_ratio",
    "output_specs",
    "continuity_mode",
    "visual_style",
    "scene_role",
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
  assert.equal(
    clip.dialogue[0].voice_personality,
    clip.character_lock.CHAR_2.voice_personality
  );
  assert.equal(
    clip.dialogue[1].voice_personality,
    clip.character_lock.CHAR_1.voice_personality
  );
  // Voice-identity binding lives ONCE in lip_sync_director_note; output_rules.audio
  // stays a concise on-set note and must NOT duplicate the full binding essay —
  // competing voice blocks are what made a character's voice drift clip-to-clip.
  assert.match(
    clip.lip_sync_director_note,
    /speaker_id \+ dialogue\.speaker_name \+ verbatim dialogue\.voice_personality/i
  );
  assert.match(clip.output_rules.audio, /never use the first character as a default/i);
  assert.doesNotMatch(clip.output_rules.audio, /timbre, resonance, base-pitch range/i);
  assert.match(clip.negative_prompt, /inferring the speaker from character order or camera framing/i);
});

test("ordinary step verbs do not invent stairs", () => {
  const layout = resolveSpatialLayout({
    setting: "A flat mall lobby with a glass entrance.",
    motion: "Minh steps toward Lan on the same-level polished floor.",
    characterNames: ["Minh", "Lan"],
  });

  // Two visible characters still need a same-level placement/topology lock so
  // the board and video cannot swap or teleport them. The ordinary verb
  // "steps" must not be misread as architectural stairs.
  assert.ok(layout);
  assert.match(layout.zone_order, /continuous declared walkable scene zone/i);
  assert.doesNotMatch(JSON.stringify(layout), /stairs?|staircase|steps connecting/i);
});

// Regression: the selected VIDEO aspect ratio travels INSIDE every clip (so the
// extension/Veo renders the exact frame the app chose), and any verbatim spoken
// line quoted in motion_prompt is stripped so the character never says it twice.
test("Veo clip carries the chosen aspect ratio and never repeats a quoted line in motion", () => {
  for (const aspect of ["16:9", "9:16", "1:1"]) {
    const result = buildVeoJson({
      title: "T",
      total_duration_seconds: 10,
      character_locks: [{ name: "Lan", gender: "female", gender_age: "adult", costume: "ao dai", skin_tone: "warm", hair: "black", eyes: "brown", voice: "gentle female" }],
      segments: [{
        segment_number: 1,
        duration_seconds: 10,
        title: "S1",
        marketing_role: "hook",
        beats: [{ beat: "Lan asks", camera: "[MS] Lan" }],
        first_frame_prompt: "Lan in the kitchen.",
        motion_prompt: 'Lan looks at Minh and says "Anh an com chua?" then smiles.',
        dialogue: "",
        speaker: "Lan",
        characters_in_scene: ["Lan"],
        environment_ref: "kitchen",
        continuity_note: "",
        dialogue_lines: [{ speaker: "Lan", delivery: "on_screen", camera_beat: 1, text: "Anh an com chua?" }],
      }],
    }, { aspectRatio: aspect, dialogueLanguage: "Vietnamese" });

    const clip = result.clips[0];
    assert.equal(clip.aspect_ratio, aspect);
    assert.equal(clip.output_specs.aspect_ratio, aspect);
    // The quoted line must NOT survive in the action prose (dialogue owns it once).
    assert.doesNotMatch(clip.scene_action.motion || "", /Anh an com chua/i);
    // But the line is still delivered exactly once via the dialogue row.
    assert.equal(clip.dialogue.length, 1);
    assert.match(clip.dialogue[0].text, /Anh an com chua/i);
  }
});

test("action drama keeps a kinetic causal exchange, readable camera and exactly-once speech", () => {
  const result = buildVeoJson({
    world_context: { genre: "action thriller" },
    character_locks: [
      { name: "Minh", gender: "male", costume: "dark work clothes", voice: "low tense male voice" },
      { name: "Thắng", gender: "male", costume: "worn street clothes", voice: "rough male voice" },
    ],
    scene_bible: {},
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      title: "Minh intercepts the attack",
      marketing_role: "body",
      characters_in_scene: ["Minh", "Thắng"],
      first_frame_prompt: "A narrow alley; Thắng charges from screen right while Minh plants his left foot between him and the victim.",
      motion_prompt: "Thắng drives his shoulder forward. Minh braces, redirects the forearm across his body, steps through and shoves from his hips; Thắng loses balance, hits the wall with his shoulder and drops to one knee, both men breathing hard.",
      dialogue_lines: [{ speaker: "Minh", text: "Lùi lại!", start_s: 1, end_s: 2 }],
      beats: [
        { beat: "the threat closes distance", camera: "[WIDE] eye-level alley geography" },
        { beat: "the impact lands", camera: "[CLOSE] controlled push to the consequence" },
      ],
      continuity_note: "Thắng is on one knee by the wall; Minh remains between him and the victim.",
    }],
  }, { aspectRatio: "16:9", dialogueLanguage: "Vietnamese" });

  const clip = result.clips[0];
  assert.match(clip.scene_action.action_director_profile, /attacker initiates/i);
  assert.match(clip.camera.movement, /ACTION CAMERA|real-time speed/i);
  assert.doesNotMatch(clip.camera.movement, /pace everything calmly/i);
  assert.doesNotMatch(clip.camera.movement, /without a cut or shot-scale change/i);
  assert.match(clip.foley_and_ambience.fx[0], /one distinct impact/i);
  assert.equal(clip.dialogue[0].utterance_count, 1);
  assert.equal(clip.dialogue[0].repeat_policy, "exactly_once");
  assert.match(clip.dialogue[0].turn_id, /1_turn_001/);
});

test("ordinary prose containing the word action does not activate the fight director", () => {
  const result = buildVeoJson({
    world_context: { genre: "reflection" },
    character_locks: [
      { name: "Người đi chậm", build: "minimal stick figure", signature_features: "blue shoes" },
    ],
    scene_bible: {},
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      title: "Buộc dây giày",
      marketing_role: "hook",
      characters_in_scene: ["Người đi chậm"],
      environment_ref: "minimal_glass_studio",
      first_frame_prompt: "A drawn starting line; Người đi chậm bends over one shoe.",
      motion_prompt: "Người đi chậm ties the shoelace carefully; the deliberate action contrasts with the runners ahead.",
      dialogue_lines: [{ speaker: "", delivery: "voiceover", text: "Đi chậm không có nghĩa là đứng yên." }],
      beats: [{ beat: "Người đi chậm ties the lace", camera: "[WIDE] the illustrated route" }],
      continuity_note: "Người đi chậm finishes the knot.",
    }],
  }, {
    aspectRatio: "9:16",
    dialogueLanguage: "Vietnamese",
    characterRepresentation: "whiteboard_stick_figure",
    anonymousNarration: true,
  });

  const clip = result.clips[0];
  assert.equal(clip.scene_action.action_director_profile, undefined);
  assert.doesNotMatch(clip.camera.movement, /ACTION CAMERA/i);
  assert.doesNotMatch(JSON.stringify(clip.character_lock), /early thirties|skin_texture|Human -/i);
  assert.match(JSON.stringify(clip.character_lock), /Silent visible role/);
  assert.doesNotMatch(JSON.stringify(clip.background_lock), /Minimal Glass|concrete|micro-cement|lux|Kelvin/i);
  assert.match(clip.background_lock.setting, /starting line/i);
});

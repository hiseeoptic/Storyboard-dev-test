const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(
  __dirname,
  "../../../extension/autoflowreel1.8.7-affiliate"
);
const NanoManifest = require(path.join(extensionRoot, "nano_manifest.js"));
const NanoPipeline = require(path.join(extensionRoot, "nano_pipeline.js"));

test("extension normalizes a legacy two-frame chained manifest to one independent keyframe", () => {
  const manifest = {
    manifest_version: "1.0",
    project: { project_id: "legacy", title: "Legacy" },
    assets: { characters: [], environments: [], products: [] },
    shots: [{
      shot_id: "SHOT_001",
      index: 1,
      storyboard_prompt: "opening frame",
      end_storyboard_prompt: "legacy end frame",
      frame_mode: "start_end",
      chain_from_prev: true,
      video_prompt: { scene_id: "1" },
      image_refs: { characters: [], environments: [], products: [] },
      video_refs: { characters: [], environments: [], products: [] },
    }],
  };

  const queue = NanoManifest.toQueue(manifest);
  assert.equal(queue[0].frameMode, "start");
  assert.equal(queue[0].chainFromPrev, false);
  assert.equal(queue[0].endStoryboardPrompt, "");

  const plan = NanoPipeline.buildQueuePlan(queue).plans[0];
  assert.equal(plan.frameMode, "start");
  assert.equal(plan.chainFromPrev, false);
  assert.equal(plan.endImageStep, null);
  assert.equal(plan.videoStep.mode, "start_frame");
});

test("extension repairs legacy same-location environment and camera leakage locally", () => {
  const common = {
    location_id: "location_01",
    image_refs: { characters: [], environments: [], products: [] },
    video_refs: { characters: [], environments: [], products: [] },
  };
  const manifest = {
    manifest_version: "1.0",
    project: { project_id: "legacy-location", title: "Legacy location" },
    assets: { characters: [], environments: [], products: [] },
    shots: [
      {
        ...common,
        shot_id: "SHOT_001",
        index: 1,
        storyboard_prompt: "frame 1",
        video_prompt: {
          location_id: "location_01",
          background_lock: {
            id: "location_01",
            name: "Warm Apartment Living Room",
            setting: "Vietnamese living room with wooden table",
            scenery: "warm furnished interior",
            lighting: "warm practical lamp; 4300K, 400 lux",
          },
          camera: { framing: "WS", angle: "eye level", movement: "front to rear OTS" },
          foley_and_ambience: {
            environment_sound_bed: "quiet furnished-room tone",
            environment_reverb: "short room decay",
            ambience: ["quiet furnished-room tone", "city traffic"],
          },
        },
      },
      {
        ...common,
        shot_id: "SHOT_002",
        index: 2,
        storyboard_prompt: "frame 2",
        video_prompt: {
          location_id: "location_01",
          background_lock: {
            id: "location_01",
            name: "Coastal Cliff over Open Sea",
            setting: "Vietnamese living room with wooden table",
            scenery: "warm furnished interior",
            lighting: "cool daylight; 5600K, 9000 lux",
          },
          camera: { framing: "CU", angle: "eye level", movement: "orbit to reverse angle" },
          foley_and_ambience: {
            environment_sound_bed: "quiet furnished-room tone",
            environment_reverb: "short room decay",
            ambience: ["quiet furnished-room tone", "sea wind and gulls"],
          },
        },
      },
    ],
  };

  const queue = NanoManifest.toQueue(manifest);
  const repaired = JSON.parse(queue[1].videoPrompt);
  assert.equal(repaired.background_lock.name, "Vietnamese living room with wooden table");
  assert.equal(repaired.background_lock.lighting, "warm practical lamp");
  assert.deepEqual(repaired.foley_and_ambience.ambience, ["quiet furnished-room tone"]);
  assert.match(repaired.camera.movement, /one stable cu eye level camera axis/i);
  assert.notEqual(repaired.camera.movement, "orbit to reverse angle");
});

test("location assets lock spatial identity while shot-local time and sound remain intentional", () => {
  const manifest = {
    manifest_version: "1.0",
    project: { project_id: "arbitrary-story", title: "Arbitrary story" },
    assets: {
      characters: [],
      products: [],
      environments: [{
        id: "place_alpha",
        name: "Canonical place",
        image: "data:image/jpeg;base64,AAA",
        location_sheet_prompt: JSON.stringify({
          source_authority: "A script-defined workshop with one north window",
          scenery: "fixed workbench, north window and tool wall",
          lighting: "baseline daylight",
        }),
      }],
    },
    shots: [
      {
        shot_id: "A",
        index: 1,
        location_id: "place_alpha",
        storyboard_prompt: "opening",
        image_refs: { characters: [], environments: ["place_alpha"], products: [] },
        video_refs: { characters: [], environments: ["place_alpha"], products: [] },
        video_prompt: {
          location_id: "place_alpha",
          background_lock: { name: "wrong preset", setting: "wrong set", scenery: "wrong geometry", lighting: "wrong light" },
          scene_bible_tokens: { lighting: "cool dawn entering from north", audio_bed: "quiet dawn room tone", reverb: "short decay" },
          foley_and_ambience: { environment_sound_bed: "wrong sound", ambience: ["wrong sound"] },
          camera: { framing: "MS", angle: "eye level", movement: "Slow dolly toward the workbench" },
        },
      },
      {
        shot_id: "B",
        index: 2,
        location_id: "place_alpha",
        storyboard_prompt: "later",
        image_refs: { characters: [], environments: ["place_alpha"], products: [] },
        video_refs: { characters: [], environments: ["place_alpha"], products: [] },
        video_prompt: {
          location_id: "place_alpha",
          transition_in: { mode: "time_jump", time_relation: "that evening" },
          background_lock: { name: "another wrong preset", setting: "another set", scenery: "other geometry", lighting: "other light" },
          scene_bible_tokens: { lighting: "warm evening practical light", audio_bed: "evening rain on roof", reverb: "short decay" },
          foley_and_ambience: { environment_sound_bed: "wrong sound", ambience: ["wrong sound"] },
          camera: { framing: "CU", angle: "eye level", movement: "Locked close view" },
        },
      },
    ],
  };

  const queue = NanoManifest.toQueue(manifest);
  const dawn = JSON.parse(queue[0].videoPrompt);
  const evening = JSON.parse(queue[1].videoPrompt);
  for (const clip of [dawn, evening]) {
    assert.equal(clip.background_lock.name, "Canonical place");
    assert.equal(clip.background_lock.setting, "A script-defined workshop with one north window");
    assert.equal(clip.background_lock.scenery, "fixed workbench, north window and tool wall");
  }
  assert.equal(dawn.background_lock.lighting, "cool dawn entering from north");
  assert.equal(evening.background_lock.lighting, "warm evening practical light");
  assert.deepEqual(dawn.foley_and_ambience.ambience, ["quiet dawn room tone"]);
  assert.deepEqual(evening.foley_and_ambience.ambience, ["evening rain on roof"]);
  assert.match(dawn.camera.movement, /Slow dolly toward the workbench/);
  assert.match(dawn.camera.movement, /one camera axis/i);
  assert.match(evening.camera.movement, /Locked close view/);
  assert.match(evening.camera.movement, /one camera axis/i);
});

test("reference resolution is identity-agnostic and follows manifest ids", () => {
  const manifest = {
    manifest_version: "1.0",
    project: { project_id: "any-cast", title: "Any cast" },
    assets: {
      characters: [
        { id: "entity_7f3", name: "Role A", image: "data:image/png;base64,A" },
        { id: "entity_98z", name: "Role B", image: "data:image/png;base64,B" },
      ],
      environments: [],
      products: [],
    },
    shots: [{
      shot_id: "UNRELATED_001",
      index: 1,
      storyboard_prompt: "an arbitrary scripted event",
      video_prompt: { scene_id: "x" },
      image_refs: { characters: ["entity_98z"], environments: [], products: [] },
      video_refs: { characters: ["entity_98z", "entity_7f3"], environments: [], products: [] },
    }],
  };
  const item = NanoManifest.toQueue(manifest)[0];
  assert.deepEqual(item.videoRefs.characters.map((asset) => asset.id), ["entity_98z", "entity_7f3"]);
});

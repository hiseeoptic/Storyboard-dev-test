const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(__dirname, "../../../extension/autoflowreel1.8.7-affiliate");
const NanoManifest = require(path.join(extensionRoot, "nano_manifest.js"));
const NanoPipeline = require(path.join(extensionRoot, "nano_pipeline.js"));
const AgentPlan = require(path.join(extensionRoot, "agent_plan.js"));

function manifest() {
  return {
    manifest_version: "1.0",
    project: { project_id: "fashion", title: "Đồ đôi", thumbnail_prompt: "cover" },
    assets: {
      characters: [
        { id: "char_mai", name: "Mai", image: null, required: true, wardrobe: "pink bunny tee; white shorts", outfit_product_id: "prod_tee", appearance: "young girl (child)" },
        { id: "char_lan", name: "Lan", image: "data:image/png;base64,FACE", required: true, wardrobe: "linen dress" },
      ],
      environments: [],
      products: [
        { id: "prod_tee", name: "Áo thun thỏ", image: "data:image/png;base64,TEE1", images: ["data:image/png;base64,TEE1", "data:image/png;base64,TEE2"], placement_kind: "outfit", worn_by: "Mai", garments_only: true },
      ],
    },
    shots: [{
      shot_id: "SHOT_001",
      index: 1,
      storyboard_prompt: "opening frame",
      video_prompt: { scene_id: "1" },
      image_refs: { characters: ["char_mai", "char_lan"], environments: [], products: [] },
      video_refs: { characters: ["char_mai", "char_lan"], environments: [], products: [] },
    }],
  };
}

test("a character wearing a sold outfit carries its photos to the batch refs, even with no face photo", () => {
  const queue = NanoManifest.toQueue(manifest());
  const mai = queue[0].imageRefs.characters.find((c) => c.id === "char_mai");
  assert.deepEqual(mai.outfit_images, ["data:image/png;base64,TEE1", "data:image/png;base64,TEE2"]);
  const plan = NanoPipeline.buildQueuePlan(queue).plans[0];
  const ref = plan.imageStep.refs.find((r) => r.id === "char_mai");
  assert.equal(ref.outfitImages.length, 2);
  assert.equal(ref.appearance, "young girl (child)");
  // Lan has no outfit: nothing extra.
  assert.deepEqual(plan.imageStep.refs.find((r) => r.id === "char_lan").outfitImages, []);
});

test("agent mode builds a try-on sheet for a faceless wearer and keeps model photos off the cover", () => {
  const m = manifest();
  const queue = NanoManifest.toQueue(m);
  const plans = NanoPipeline.buildQueuePlan(queue).plans;
  const ctx = AgentPlan.buildContext(m, queue, plans, {});
  const mai = ctx.sheets.find((s) => s.name === "Mai");
  assert.ok(mai, "Mai gets a sheet from the outfit photos");
  assert.equal(mai.photoKey, "");
  assert.equal(mai.outfitKeys.length, 2);
  assert.match(mai.prompt, /No face photo exists for this character/);
  assert.match(mai.prompt, /young girl \(child\)/);
  assert.match(mai.prompt, /never copy the face, hair, skin, body or pose of any model/);
  assert.match(mai.prompt, /"task":"VIRTUAL TRY-ON CHARACTER SHEET: ONE new person wearing the EXACT garment\(s\)/);
  assert.match(mai.prompt, /VIRTUAL TRY-ON: EXACTLY the garment\(s\) in the OUTFIT photo\(s\)/);
  assert.match(mai.prompt, /never redesign, simplify or embellish it/);
  assert.ok(ctx.thumb);
  assert.ok(!ctx.thumb.refKeys.includes("products:prod_tee"), "the outfit photo may show a model: not on the cover");
});

test("the try-on sheet leads with the task, drops the garment's text description, keeps the missing pieces", () => {
  const oldCostume = 'strapless mini dress in light beige with a subtle textured fabric, featuring a ruffled top edge, fitted bodice (exactly as in the attached outfit photo); styled with (app-chosen, identical in every shot): footwear: plain beige low-heeled shoes';
  const newCostume = 'strapless mini dress — EXACTLY the garment in the attached OUTFIT photo "Đầm" (copied from the photo, never redrawn from words); plus pieces not in the photo (app-chosen, identical in every shot): footwear: plain beige low-heeled shoes';
  for (const costume of [oldCostume, newCostume]) {
    const sheet = JSON.parse(AgentPlan.sheetPrompt("Lan", costume, "", { outfitRef: true, hasFace: true }));
    assert.equal(Object.keys(sheet)[0], "task");
    assert.match(sheet.task, /PERSON photo \(the LAST attached image\).*OUTFIT photo\(s\) \(the FIRST attached image\(s\)\)/);
    assert.doesNotMatch(sheet.wardrobe, /ruffled|textured|bodice/);
    assert.match(sheet.wardrobe, /Pieces the photo does not show: footwear: plain beige low-heeled shoes\.$/);
    assert.match(sheet.identity_authority, /PERSON photo \(the LAST attached image\)/);
  }
  // Without an outfit photo the sheet is unchanged: no try-on task.
  const plain = JSON.parse(AgentPlan.sheetPrompt("Minh", "navy shirt, grey trousers", "", {}));
  assert.equal(plain.task, undefined);
  assert.match(plain.wardrobe, /navy shirt/);
});

test("the sheet carries the makeup lock; a non-hero product never reaches the agent cover", () => {
  const sheet = JSON.parse(AgentPlan.sheetPrompt("Lan", "linen dress", "", { makeup: "NO MAKEUP — bare natural face." }));
  assert.match(sheet.makeup, /^NO MAKEUP — bare natural face\. Identical in all three cells\.$/);
  const m = manifest();
  m.assets.products.push({ id: "prod_pan", name: "Chảo", image: "data:image/png;base64,PAN", placement_kind: "product", thumbnail_hero: false });
  m.assets.products[0].thumbnail_hero = false;
  const queue = NanoManifest.toQueue(m);
  const ctx = AgentPlan.buildContext(m, queue, NanoPipeline.buildQueuePlan(queue).plans, {});
  assert.ok(!ctx.thumb.refKeys.some((k) => k.startsWith("products:")), "story covers carry no product refs");
});

test("agent messages state the frame of every item: keyframes and videos follow the video, references are 16:9", () => {
  const m = manifest();
  m.project.aspect_ratio = "9:16";
  m.project.keyframe_aspect_ratio = "9:16";
  m.shots[0].storyboard_prompt = '{"type":"photoreal_keyframe","aspect_ratio":"9:16"}';
  const queue = NanoManifest.toQueue(m);
  const ctx = AgentPlan.buildContext(m, queue, NanoPipeline.buildQueuePlan(queue).plans, {});
  assert.equal(ctx.keyframeAspect, "9:16");
  const all = AgentPlan.stages(ctx, {}, {}).map((stage) => AgentPlan.messageFor(ctx, stage, {})).join("\n");
  assert.match(all, /character sheet: Lan ===\nAspect ratio: 16:9 \(landscape \/ horizontal\)/);
  assert.match(all, /SHOT 01 – keyframe ===\nAspect ratio: 9:16 \(portrait \/ vertical\)/);
  assert.match(all, /Each keyframe is ONE single full-frame still \(the first frame of a video\) in 9:16 \(portrait \/ vertical\)/);
  assert.match(all, /Every video in this message is 9:16 \(portrait \/ vertical\)/);
  assert.match(all, /SHOT 01 – video ===\n[^\n]*\nAspect ratio: 9:16 \(portrait \/ vertical\)/);
});

test("family reel: a photo-less kid gets a sheet built from text in batch and agent mode", () => {
  const m = manifest();
  m.assets.characters.push({ id: "char_na", name: "Bé Na", image: null, required: true, wardrobe: "yellow cotton dress", appearance: "Vietnamese girl about 6 years old, two short pigtails", sheet_from_text: true });
  m.assets.characters.push({ id: "char_bo", name: "Bố", image: null, required: true, appearance: "father in his 30s" });
  m.shots[0].image_refs.characters.push("char_na", "char_bo");
  const queue = NanoManifest.toQueue(m);
  const refs = NanoPipeline.buildQueuePlan(queue).plans[0].imageStep.refs;
  assert.equal(refs.find((r) => r.id === "char_na").sheetFromText, true);
  assert.equal(refs.find((r) => r.id === "char_bo").sheetFromText, false, "no flag → no text sheet");
  const ctx = AgentPlan.buildContext(m, queue, NanoPipeline.buildQueuePlan(queue).plans, {});
  const na = ctx.sheets.find((s) => s.name === "Bé Na");
  assert.ok(na, "Bé Na gets a sheet");
  assert.equal(na.photoKey, "");
  assert.deepEqual(na.outfitKeys, []);
  assert.match(na.prompt, /No image is attached: build this person from the description alone/);
  assert.match(na.prompt, /two short pigtails/);
  assert.doesNotMatch(na.prompt, /NOT the model from any outfit photo/);
  assert.equal(ctx.sheets.find((s) => s.name === "Bố"), undefined);
  assert.ok(ctx.shots[0].charKeys.includes(na.key), "the shot keyframe uses the text-built sheet");
});

test("agent messages forbid rewriting a refused prompt into a short one", () => {
  const m = manifest();
  m.shots[0].video_prompt = { scene_id: "1", scene_action: { motion: "Na reaches for Mẹ's hand" }, camera: { movement: "USER-SELECTED CAMERA: path 0–3.3s → 3.3–6.7s" } };
  const queue = NanoManifest.toQueue(m);
  const ctx = AgentPlan.buildContext(m, queue, NanoPipeline.buildQueuePlan(queue).plans, {});
  const messages = AgentPlan.stages(ctx, {}, {}).map((stage) => AgentPlan.messageFor(ctx, stage, {}));
  const videos = messages[messages.length - 1];
  assert.match(videos, /pasted WHOLE — from its title through the final closing brace — never turned into prose, never reduced to its action text/);
  assert.match(videos, /If a generation is refused or fails, do NOT rewrite, soften, shorten or re-word its prompt/);
  assert.ok(videos.includes(JSON.stringify(queue[0].videoPrompt ? JSON.parse(queue[0].videoPrompt) : {})), "the full JSON prompt is in the message");
  // A prompt cut down to its action text is detected.
  const full = ctx.shots[0].videoPrompt;
  assert.ok(AgentPlan.fidelity(full, "Na reaches for Mẹ's hand") < 0.5);
  assert.equal(AgentPlan.fidelity(full, full), 1);
});

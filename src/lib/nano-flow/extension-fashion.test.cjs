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
  assert.match(mai.prompt, /VIRTUAL TRY-ON: dress this person in the EXACT garment\(s\) from the OUTFIT photo/);
  assert.match(mai.prompt, /never redesign, simplify or embellish it from words/);
  assert.ok(ctx.thumb);
  assert.ok(!ctx.thumb.refKeys.includes("products:prod_tee"), "the outfit photo may show a model: not on the cover");
});

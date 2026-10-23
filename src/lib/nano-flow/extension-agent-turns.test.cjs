const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(__dirname, "../../../extension/autoflowreel1.8.7-affiliate");
const NanoManifest = require(path.join(extensionRoot, "nano_manifest.js"));
const NanoPipeline = require(path.join(extensionRoot, "nano_pipeline.js"));
const AgentPlan = require(path.join(extensionRoot, "agent_plan.js"));

// A family reel whose every shot prompt is `size` characters long (JSON, like the app's).
function agentContext(shots, size) {
  const pad = (label) => JSON.stringify({ type: "photoreal_keyframe", shot: label, detail: "x".repeat(Math.max(0, size - 60)) });
  const m = {
    manifest_version: "1.0",
    project: { project_id: "family", title: "Na kiểm tra giỏ điện thoại", aspect_ratio: "9:16", thumbnail_prompt: "cover" },
    assets: {
      characters: [
        { id: "char_na", name: "Na", image: "data:image/png;base64,NA", required: true, wardrobe: "yellow tee" },
        { id: "char_me", name: "Mẹ", image: "data:image/png;base64,ME", required: true, wardrobe: "cream top" },
      ],
      environments: [],
      products: [],
    },
    shots: Array.from({ length: shots }, (_, i) => ({
      shot_id: `SHOT_00${i + 1}`,
      index: i + 1,
      storyboard_prompt: pad(`keyframe ${i + 1}`),
      video_prompt: { scene_id: String(i + 1), detail: "y".repeat(Math.max(0, size - 40)) },
      image_refs: { characters: ["char_na", "char_me"], environments: [], products: [] },
      video_refs: { characters: ["char_na", "char_me"], environments: [], products: [] },
    })),
  };
  const queue = NanoManifest.toQueue(m);
  return AgentPlan.buildContext(m, queue, NanoPipeline.buildQueuePlan(queue).plans, {});
}

const countBy = (stages) => stages.reduce((acc, s) => ({ ...acc, [s.type]: (acc[s.type] || 0) + 1 }), {});

test("short prompts still go out as the usual three messages", () => {
  const ctx = agentContext(5, 3000);
  assert.deepEqual(countBy(AgentPlan.stages(ctx, {}, {})), { prep: 1, frames: 1, videos: 1 });
});

test("a step bigger than one agent turn is split so the agent can finish every item", () => {
  // Log 23/10/2026: five ~40k-character keyframes in one message → the agent made SHOT 01 and stopped.
  const ctx = agentContext(5, 40000);
  const stages = AgentPlan.stages(ctx, {}, {});
  assert.deepEqual(countBy(stages), { prep: 1, frames: 5, videos: 5 });
  for (const stage of stages.filter((s) => s.type !== "prep")) {
    const size = stage.keys.reduce((n, k) => n + ctx.shots.find((s) => s.key === k)[stage.type === "frames" ? "keyframePrompt" : "videoPrompt"].length, 0);
    assert.ok(stage.keys.length === 1 || size <= AgentPlan.AGENT_TURN_CHARS, `${stage.type} ${stage.keys.join(",")}`);
  }
  // Nothing is cut: the whole prompt still travels verbatim.
  const message = AgentPlan.messageFor(ctx, stages.find((s) => s.type === "frames"), {});
  assert.ok(message.includes(ctx.shots[0].keyframePrompt));
  // Mid-size prompts share a message up to the budget.
  assert.deepEqual(countBy(AgentPlan.stages(agentContext(6, 12000), {}, {})), { prep: 1, frames: 3, videos: 3 });
});

test("the creator's items-per-message setting and the chat-box limit still apply", () => {
  const ctx = agentContext(5, 3000);
  assert.equal(countBy(AgentPlan.stages(ctx, {}, { maxCount: 2 })).frames, 3);
  assert.equal(countBy(AgentPlan.stages(ctx, {}, { maxChars: 7000 })).frames, 3);
  // Items already made are not sent again.
  const done = { media: { "SHOT 01": "m1", "SHOT 02": "m2" }, videos: {} };
  const frames = AgentPlan.stages(ctx, done, {}).filter((s) => s.type === "frames");
  assert.deepEqual(frames.flatMap((s) => s.keys), ["SHOT 03", "SHOT 04", "SHOT 05"]);
});

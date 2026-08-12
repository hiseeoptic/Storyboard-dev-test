import assert from "node:assert/strict";
import test from "node:test";
import {
  makeProjectInputSlot,
  normalizeProjectInputWorkspace,
  PROJECT_INPUT_SLOT_LIMIT,
} from "./project-input-slots.ts";

test("input workspace starts with one project and caps at five", () => {
  const fallback = { story: "" };
  const empty = normalizeProjectInputWorkspace(null, fallback);
  assert.equal(empty.projects.length, 1);
  const projects = Array.from({ length: 7 }, (_, index) =>
    makeProjectInputSlot({ story: `story-${index}` }, index)
  );
  const restored = normalizeProjectInputWorkspace(
    { version: 1, active_project_id: projects[6]!.id, projects },
    fallback
  );
  assert.equal(restored.projects.length, PROJECT_INPUT_SLOT_LIMIT);
  assert.equal(restored.active_project_id, restored.projects[0]!.id);
});

test("input snapshots remain isolated and contain no workflow result", () => {
  const first = makeProjectInputSlot({ story: "one", images: ["a"] }, 0);
  const second = makeProjectInputSlot({ story: "two", images: ["b"] }, 1);
  first.snapshot.story = "changed";
  assert.equal(second.snapshot.story, "two");
  assert.equal("workflow" in first, false);
  assert.equal("result" in first, false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  makeProjectSlot,
  normalizeProjectWorkspace,
  PROJECT_WORKSPACE_LIMIT,
} from "./project-workspace-store.ts";

test("workspace always starts with one editable project", () => {
  const workspace = normalizeProjectWorkspace(null, { story: "" });
  assert.equal(workspace.projects.length, 1);
  assert.equal(workspace.projects[0]!.status, "draft");
  assert.equal(workspace.active_project_id, workspace.projects[0]!.id);
});

test("workspace caps restored projects at five and keeps snapshots isolated", () => {
  const projects = Array.from({ length: 7 }, (_, index) =>
    makeProjectSlot({ story: `story-${index}` }, index)
  );
  const workspace = normalizeProjectWorkspace(
    { version: 1, active_project_id: projects[6]!.id, projects },
    { story: "fallback" }
  );
  assert.equal(workspace.projects.length, PROJECT_WORKSPACE_LIMIT);
  assert.equal(workspace.active_project_id, workspace.projects[0]!.id);
  workspace.projects[0]!.snapshot.story = "changed";
  assert.equal(workspace.projects[1]!.snapshot.story, "story-1");
});

test("queued snapshot remains immutable while the editable snapshot changes", () => {
  const project = makeProjectSlot({ story: "approved" }, 0);
  project.status = "queued";
  project.queued_snapshot = structuredClone(project.snapshot);
  project.snapshot.story = "later edit";
  assert.equal(project.queued_snapshot.story, "approved");
});

test("workflow results and statuses stay isolated per project", () => {
  const workspace = normalizeProjectWorkspace<{ story: string }, { title: string }>(
    {
      version: 1,
      active_project_id: "one",
      projects: [
        { id: "one", name: "One", status: "completed", snapshot: { story: "a" }, workflow: { title: "A" }, created_at: "x", updated_at: "x" },
        { id: "two", name: "Two", status: "needs_repair", snapshot: { story: "b" }, workflow: { title: "B" }, created_at: "x", updated_at: "x" },
      ],
    },
    { story: "" }
  );
  workspace.projects[0]!.workflow!.title = "changed";
  assert.equal(workspace.projects[1]!.workflow!.title, "B");
  assert.equal(workspace.projects[1]!.status, "needs_repair");
});

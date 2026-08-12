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

test("cost-safe workspace restores only one active project", () => {
  const projects = Array.from({ length: 7 }, (_, index) =>
    makeProjectSlot({ story: `story-${index}` }, index)
  );
  const workspace = normalizeProjectWorkspace(
    { version: 1, active_project_id: projects[6]!.id, projects },
    { story: "fallback" }
  );
  assert.equal(PROJECT_WORKSPACE_LIMIT, 1);
  assert.equal(workspace.projects.length, 1);
  assert.equal(workspace.active_project_id, workspace.projects[0]!.id);
  assert.equal(workspace.projects[0]!.snapshot.story, "story-0");
});

test("queued snapshot remains immutable while the editable snapshot changes", () => {
  const project = makeProjectSlot({ story: "approved" }, 0);
  project.status = "queued";
  project.queued_snapshot = structuredClone(project.snapshot);
  project.snapshot.story = "later edit";
  assert.equal(project.queued_snapshot.story, "approved");
});

test("cost-safe workspace preserves the active project's workflow", () => {
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
  assert.equal(workspace.projects.length, 1);
  assert.equal(workspace.projects[0]!.workflow!.title, "A");
  assert.equal(workspace.projects[0]!.status, "completed");
});

test("a stale building project becomes recoverable after reload", () => {
  const project = makeProjectSlot({ story: "timeout" }, 0);
  project.status = "building";
  const workspace = normalizeProjectWorkspace(
    { version: 1, active_project_id: project.id, projects: [project] },
    { story: "" }
  );
  assert.equal(workspace.projects[0]!.status, "needs_repair");
  assert.match(workspace.projects[0]!.last_error ?? "", /chạy lại/i);
});

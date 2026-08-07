import assert from "node:assert/strict";
import test from "node:test";
import type { NanoFlowManifest } from "@/types/nano-flow";
import type { StoryboardGenerationOutput } from "@/types";
import {
  productionStateExportFindings,
  validateExportReadiness,
} from "./export-readiness.ts";

test("export readiness combines source and compiled-prompt findings", () => {
  const breakdown = {
    title: "Broken export",
    total_duration_seconds: 10,
    character_locks: [],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      marketing_role: "hook",
      motion_prompt: "",
      first_frame_prompt: "",
      characters_in_scene: [],
    }],
  } as unknown as StoryboardGenerationOutput;
  const manifest = {
    manifest_version: "1.0",
    generator: "test",
    project: { title: "Broken export" },
    assets: {},
    shots: [{
      shot_id: "SHOT_001",
      index: 1,
      storyboard_name: "Broken export 1",
      storyboard_prompt: "",
      video_prompt: "",
    }],
  } as NanoFlowManifest;

  const report = validateExportReadiness(breakdown, manifest);
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((finding) => finding.code === "STRUCT-001"));
  assert.ok(report.findings.some((finding) => finding.code === "VID-001"));
});

test("optional thumbnail absence is not an export-readiness finding", () => {
  const breakdown = {
    title: "Thumbnail optional",
    total_duration_seconds: 0,
    character_locks: [],
    segments: [],
  } as unknown as StoryboardGenerationOutput;
  const manifest = {
    manifest_version: "1.0",
    generator: "test",
    project: { title: "Thumbnail optional" },
    assets: {},
    shots: [],
  } as NanoFlowManifest;
  const report = validateExportReadiness(breakdown, manifest);
  assert.ok(report.findings.every((finding) => !/thumbnail/i.test(finding.message)));
});

test("Production State physical findings retain shot evidence in the export gate", () => {
  const breakdown = {
    title: "Physical gate",
    total_duration_seconds: 0,
    character_locks: [],
    segments: [],
  } as unknown as StoryboardGenerationOutput;
  const manifest = {
    manifest_version: "1.0",
    generator: "test",
    project: { title: "Physical gate" },
    assets: {},
    shots: [{
      shot_id: "SHOT_001",
      index: 1,
      storyboard_name: "Physical gate 1",
      storyboard_prompt: "",
      video_prompt: "",
      state_authority: { production_shot_id: "shot_001" },
    }],
    production_state: {
      version: "1.0",
      registry: [],
      shots: [],
      boundaries: [],
      findings: [{
        code: "HAND_OCCUPANCY_CONFLICT",
        severity: "critical",
        message: "One hand has incompatible simultaneous jobs.",
        shot_id: "shot_001",
        entity_ids: ["char_lan"],
        evidence: { limb_id: "right_hand" },
        suggested_patch: { op: "split_action" },
      }],
    },
  } as unknown as NanoFlowManifest;

  void breakdown;
  const physical = productionStateExportFindings(manifest).find(
    (finding) => finding.code === "HAND_OCCUPANCY_CONFLICT"
  );
  assert.equal(physical?.segment_number, 1);
  assert.match(physical?.evidence ?? "", /char_lan/);
  assert.match(physical?.evidence ?? "", /split_action/);
});

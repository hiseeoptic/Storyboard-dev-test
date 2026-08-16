import assert from "node:assert/strict";
import test from "node:test";
import type { AtomicAction, EntityPlacementState } from "../production-state/types.ts";
import {
  buildBoardPlacementContract,
  normalizeBoardImagePanels,
} from "./board-image-validator.ts";

function placement(
  entityId: string,
  zoneId: string,
  label: string,
  screenSide: "left" | "right"
): EntityPlacementState {
  return {
    entity_id: entityId,
    zone_id: zoneId,
    anchor_id: `${zoneId}_chair`,
    position_label: label,
    body_orientation: "seated facing partner",
    facing_entity_id: entityId === "char_minh" ? "char_lan" : "char_minh",
    distance_to_anchor: "on chair",
    world_side: screenSide,
    screen_side: screenSide,
  };
}

function action(verb: string): AtomicAction {
  return {
    action_id: "action_1",
    source_change_index: 0,
    subject_entity_id: "char_minh",
    verb,
    object_entity_id: null,
    body_part: null,
    start_state: "seated",
    transition_states: [],
    end_state: "seated",
    contact_entity_ids: [],
    duration_s: 2,
    minimum_duration_s: 1,
    physical_conditions: [],
    from_zone_id: null,
    to_zone_id: null,
    is_atomic: true,
    evidence: verb,
  };
}

test("restores previous chair sides when the next board silently swaps characters", () => {
  const previous = [
    placement("char_minh", "table_left", "left chair beside Lan", "left"),
    placement("char_lan", "table_right", "right chair beside Minh", "right"),
  ];
  const current = [
    placement("char_minh", "table_right", "right chair opposite Lan", "right"),
    placement("char_lan", "table_left", "left chair opposite Minh", "left"),
  ];
  const contract = buildBoardPlacementContract({
    previousEndPlacements: previous,
    currentStartPlacements: current,
    sameLocation: true,
    actions: [action("Minh speaks while remaining seated")],
  });

  assert.equal(contract.mode, "preserve_previous_without_movement");
  assert.equal(contract.repaired_from_previous, true);
  assert.deepEqual(contract.canonical_placements, previous);
  assert.equal(contract.findings[0]?.code, "BOARD_UNMOTIVATED_PLACEMENT_CHANGE");
});

test("allows a new chair only when a visible relocation is scripted", () => {
  const previous = [placement("char_minh", "table_left", "left chair", "left")];
  const current = [placement("char_minh", "table_right", "right chair", "right")];
  const contract = buildBoardPlacementContract({
    previousEndPlacements: previous,
    currentStartPlacements: current,
    sameLocation: true,
    actions: [action("Minh stands up, walks around the table and sits down in the right chair")],
  });

  assert.equal(contract.mode, "scripted_relocation");
  assert.equal(contract.repaired_from_previous, false);
  assert.deepEqual(contract.canonical_placements, current);
});

test("widens a hand-only close-up and keeps the owner visibly connected", () => {
  const result = normalizeBoardImagePanels({
    castNames: ["Minh", "Lan"],
    sceneAction: "Minh shows Lan the phone",
    panels: [{
      action: "Close-up on Minh's hand gripping the phone",
      camera: "[CLOSE] focus on Minh's fingers",
    }],
  });
  const panel = result.panels[0]!;

  assert.match(String(panel.camera), /^\[MEDIUM_CLOSE\]/);
  assert.match(`${String(panel.action)} ${String(panel.camera)}`, /Minh.*face.*shoulders.*upper torso/iu);
  assert.deepEqual(panel.expected_character_instances, { Minh: 1, Lan: 0 });
  assert.ok(result.findings.some((finding) => finding.code === "BOARD_DISMEMBERED_CHARACTER"));
});

test("repairs a hand-led side panel even when the model forgot to label it close-up", () => {
  const result = normalizeBoardImagePanels({
    castNames: ["Minh", "Lan"],
    sceneAction: "Minh reaches toward Lan",
    panels: [{
      action: "Minh's hand reaches toward Lan's wrist",
      camera: "[SIDE] camera follows the hand",
    }],
  });

  assert.match(`${String(result.panels[0]!.action)} ${String(result.panels[0]!.camera)}`, /face.*shoulders.*upper torso/iu);
  assert.ok(result.findings.some((finding) => finding.code === "BOARD_DISMEMBERED_CHARACTER"));
});

test("binds a missing close-up subject and declares one instance per identity", () => {
  const result = normalizeBoardImagePanels({
    castNames: ["Minh", "Lan"],
    sceneAction: "Lan studies Minh's expression",
    panels: [{ action: "Lan pauses", camera: "[CLOSE] camera focusing on, eyes widening" }],
  });
  const panel = result.panels[0]!;

  assert.doesNotMatch(String(panel.camera), /focusing on\s*,/iu);
  assert.deepEqual(panel.expected_character_instances, { Minh: 0, Lan: 1 });
  assert.ok(result.findings.some((finding) => finding.code === "BOARD_SUBJECT_MISSING"));
  assert.ok(result.findings.some((finding) => finding.code === "BOARD_DUPLICATE_IDENTITY_RISK"));
});

test("a wide panel does not add cast members absent from that panel action", () => {
  const result = normalizeBoardImagePanels({
    castNames: ["Người đi chậm", "Người chạy nhanh 1", "Người chạy nhanh 2"],
    sceneAction: "All three figures remain somewhere along the route",
    panels: [{
      action: "Wide shot of Người đi chậm tying the shoelace alone at the starting line",
      camera: "[WIDE] establish the route around Người đi chậm",
    }],
  });

  assert.deepEqual(result.panels[0]!.visible_characters, ["Người đi chậm"]);
  assert.deepEqual(result.panels[0]!.expected_character_instances, {
    "Người đi chậm": 1,
    "Người chạy nhanh 1": 0,
    "Người chạy nhanh 2": 0,
  });
});

test("enumerated role shorthand resolves both locked identities", () => {
  const result = normalizeBoardImagePanels({
    castNames: ["Người đi chậm", "Người chạy nhanh 1", "Người chạy nhanh 2"],
    panels: [{
      action: "Người chạy nhanh 1 and 2 sprint beyond the starting line",
      camera: "[OTS] behind the two runners",
    }],
  });

  assert.deepEqual(result.panels[0]!.visible_characters, [
    "Người chạy nhanh 1",
    "Người chạy nhanh 2",
  ]);
});

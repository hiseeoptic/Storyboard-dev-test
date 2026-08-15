import type { ImageReference, StoryboardGenerationInput } from "@/types";
import { isStylizedCharacterRepresentation } from "../creative-routing/profiles.ts";
import {
  buildReport,
  type SemanticFinding,
  type SemanticValidationReport,
} from "./semantic-validator.ts";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function referenceGroups(input: StoryboardGenerationInput): ImageReference[] {
  return [
    ...(input.character_images ?? []),
    ...(input.product_images ?? []),
    ...(input.ingredient_images ?? []),
    ...(input.background_images ?? []),
  ];
}

/**
 * Free, deterministic gate over user-controlled input. It runs before vision,
 * script or Context-IR calls, so malformed reference declarations never spend
 * API credit downstream.
 */
export function validateStoryboardInput(
  input: StoryboardGenerationInput
): SemanticValidationReport {
  const findings: SemanticFinding[] = [];
  const push = (finding: SemanticFinding) => findings.push(finding);

  if (!text(input.story_idea)) {
    push({
      code: "INPUT-001",
      severity: "high",
      scope: "project",
      message: "Story idea is empty.",
    });
  }

  const segmentCount = input.segment_count ?? input.scene_count;
  if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > 60) {
    push({
      code: "INPUT-002",
      severity: "high",
      scope: "project",
      message: "Segment count must be an integer from 1 to 60.",
      evidence: `segment_count=${String(segmentCount)}`,
    });
  }

  if (
    input.beats_per_segment != null &&
    (!Number.isInteger(input.beats_per_segment) ||
      input.beats_per_segment < 3 ||
      input.beats_per_segment > 5)
  ) {
    push({
      code: "INPUT-003",
      severity: "high",
      scope: "project",
      message: "Each 10-second segment must contain 3–5 storyboard beats.",
      evidence: `beats_per_segment=${String(input.beats_per_segment)}`,
    });
  }

  if (input.force_dialogue && !text(input.dialogue_language)) {
    push({
      code: "INPUT-004",
      severity: "high",
      scope: "project",
      message: "Forced dialogue requires an explicit dialogue language.",
    });
  }

  const namedCollections: Array<Array<{ name: string }>> = [
    input.character_descriptions ?? [],
    input.character_images ?? [],
    input.product_images ?? [],
    input.ingredient_images ?? [],
    input.background_images ?? [],
  ];
  for (const collection of namedCollections) {
    const seen = new Set<string>();
    for (const item of collection) {
      const name = text(item.name);
      if (!name) {
        push({
          code: "INPUT-005",
          severity: "high",
          scope: "project",
          message: "Every character/product/environment reference group needs a name.",
        });
        continue;
      }
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) {
        push({
          code: "INPUT-006",
          severity: "high",
          scope: "project",
          message: `Duplicate reference authority name "${name}" in one asset class.`,
          evidence: name,
        });
      }
      seen.add(key);
    }
  }

  for (const group of referenceGroups(input)) {
    if ((group.images?.length ?? 0) === 0 && group.isReference !== true) {
      push({
        code: "INPUT-007",
        severity: "high",
        scope: "project",
        message: `Reference group "${text(group.name) || "(unnamed)"}" has no image and is not declared as an extension-side reference.`,
      });
    }
  }

  const stylizedRepresentation = isStylizedCharacterRepresentation(
    input.character_representation
  );
  const hasCharacterPhotos = (input.character_images ?? []).some(
    (group) => (group.images?.length ?? 0) > 0 || group.isReference === true
  );
  if (stylizedRepresentation && hasCharacterPhotos) {
    push({
      code: "INPUT-008",
      severity: "high",
      scope: "project",
      message:
        "Stylized character representation conflicts with real character-photo identity authority.",
      evidence: `character_representation=${input.character_representation}`,
    });
  }

  return buildReport(findings, "input gate");
}

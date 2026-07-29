import type {
  CharacterLock,
  StoryboardGenerationOutput,
  VideoSegment,
} from "@/types";
import {
  validateStoryboardSemantics,
  type SemanticFinding,
  type SemanticValidationReport,
} from "./semantic-validator.ts";

export type StoryboardRepairStatus =
  | "clean"
  | "unrepairable"
  | "no_progress"
  | "exhausted";

export interface StoryboardRepairBatch {
  /** Repaired segment objects. The loop accepts only requested segment numbers. */
  segments: VideoSegment[];
  /** Full or partial lock repairs. Only requested names and safe fields merge. */
  character_locks?: CharacterLock[];
}

export interface StoryboardRepairRound {
  round: number;
  target_segment_numbers: number[];
  target_character_names: string[];
  findings: SemanticFinding[];
}

export interface StoryboardRepairLoopResult {
  breakdown: StoryboardGenerationOutput;
  report: SemanticValidationReport;
  status: StoryboardRepairStatus;
  rounds: number;
  repaired_segment_numbers: number[];
  repaired_character_names: string[];
}

export interface StoryboardRepairLoopOptions {
  breakdown: StoryboardGenerationOutput;
  /** Remote repair rounds, not JSON transport retries. */
  maxRounds?: number;
  /** Defaults to Layer A. Callers may compose Layer A+B for export repair. */
  validate?: (
    breakdown: StoryboardGenerationOutput
  ) => SemanticValidationReport;
  repair: (
    breakdown: StoryboardGenerationOutput,
    request: StoryboardRepairRound
  ) => Promise<StoryboardRepairBatch>;
  /** Deterministic normalization run after each merge and before re-validation. */
  afterMerge?: (breakdown: StoryboardGenerationOutput) => void | Promise<void>;
}

function blockingFindings(report: SemanticValidationReport): SemanticFinding[] {
  return report.findings.filter(
    (finding) =>
      finding.severity === "critical" || finding.severity === "high"
  );
}

function targetSegmentNumbers(
  breakdown: StoryboardGenerationOutput,
  findings: SemanticFinding[]
): number[] {
  const validNumbers = new Set(
    breakdown.segments.map((segment) => segment.segment_number)
  );
  return [
    ...new Set(
      findings
        .filter(
          (finding) =>
            finding.scope === "segment" &&
            typeof finding.segment_number === "number" &&
            validNumbers.has(finding.segment_number)
        )
        .map((finding) => finding.segment_number as number)
    ),
  ].sort((a, b) => a - b);
}

function targetCharacterNames(findings: SemanticFinding[]): string[] {
  return [
    ...new Set(
      findings
        .filter(
          (finding) =>
            finding.scope === "character" &&
            typeof finding.character === "string" &&
            finding.character.trim()
        )
        .map((finding) => finding.character!.trim().toLowerCase())
    ),
  ].sort();
}

function findingSignature(report: SemanticValidationReport): string {
  return blockingFindings(report)
    .map(
      (finding) =>
        [
          finding.severity,
          finding.code,
          finding.scope,
          finding.segment_number ?? "",
          finding.character ?? "",
          finding.message,
          finding.evidence ?? "",
        ].join("|")
    )
    .sort()
    .join("\n");
}

function lockedDialogue(
  original: VideoSegment,
  repaired: VideoSegment
): Pick<VideoSegment, "dialogue" | "speaker" | "dialogue_lines"> {
  const originalTurns =
    original.dialogue_lines && original.dialogue_lines.length > 0
      ? original.dialogue_lines
      : typeof original.dialogue === "string" && original.dialogue.trim()
        ? [
            {
              speaker: (original.speaker ?? "").trim(),
              text: original.dialogue.trim(),
            },
          ]
        : [];

  if (originalTurns.length === 0) {
    return { dialogue: "", speaker: "", dialogue_lines: undefined };
  }

  const repairedTurns = repaired.dialogue_lines ?? [];
  const dialogue_lines = originalTurns.map((turn, index) => ({
    speaker: (turn.speaker ?? "").trim(),
    delivery: turn.delivery,
    text: turn.text.trim(),
    start_s: repairedTurns[index]?.start_s,
    end_s: repairedTurns[index]?.end_s,
  }));

  return {
    dialogue: dialogue_lines[0]!.text,
    speaker: dialogue_lines[0]!.speaker,
    dialogue_lines,
  };
}

/**
 * Merge a critic repair without allowing it to alter project structure,
 * approved dialogue, clip duration/order or already-rendered assets.
 */
function mergeSegmentRepair(
  original: VideoSegment,
  repaired: VideoSegment
): VideoSegment {
  return {
    ...original,
    ...repaired,
    segment_number: original.segment_number,
    duration_seconds: original.duration_seconds,
    marketing_role: original.marketing_role,
    ...lockedDialogue(original, repaired),
    first_frame_url: null,
    keyframe_url: null,
    full_prompt: undefined,
  };
}

function mergeCharacterRepair(
  original: CharacterLock,
  repaired: CharacterLock
): CharacterLock {
  const gender =
    repaired.gender === "male" || repaired.gender === "female"
      ? repaired.gender
      : original.gender;
  const costume =
    typeof repaired.costume === "string" && repaired.costume.trim()
      ? repaired.costume.trim()
      : original.costume;
  const wardrobeMaterials =
    typeof repaired.wardrobe_materials === "string" &&
    repaired.wardrobe_materials.trim()
      ? repaired.wardrobe_materials.trim()
      : original.wardrobe_materials;
  const voice =
    typeof repaired.voice === "string" && repaired.voice.trim()
      ? repaired.voice.trim()
      : original.voice;

  // Identity/face/body/name remain owned by the original lock/reference.
  return {
    ...original,
    gender,
    costume,
    wardrobe_materials: wardrobeMaterials,
    voice,
  };
}

/**
 * Lớp C: validate for free, repair only blocking segments in one remote batch,
 * then validate again. It never renders an image/video and never loops forever.
 */
export async function runStoryboardRepairLoop(
  options: StoryboardRepairLoopOptions
): Promise<StoryboardRepairLoopResult> {
  const maxRounds = Math.max(0, Math.min(3, options.maxRounds ?? 2));
  const validate = options.validate ?? validateStoryboardSemantics;
  let breakdown = options.breakdown;
  let report = validate(breakdown);
  const repairedNumbers = new Set<number>();
  const repairedCharacters = new Set<string>();

  if (report.ok) {
    return {
      breakdown,
      report,
      status: "clean",
      rounds: 0,
      repaired_segment_numbers: [],
      repaired_character_names: [],
    };
  }

  for (let round = 1; round <= maxRounds; round++) {
    const blocking = blockingFindings(report);
    const targets = targetSegmentNumbers(breakdown, blocking);
    const targetCharacters = targetCharacterNames(blocking);

    // Project-only defects cannot be fixed safely by changing scenes or
    // character locks. Stop before spending an irrelevant API call.
    if (targets.length === 0 && targetCharacters.length === 0) {
      return {
        breakdown,
        report,
        status: "unrepairable",
        rounds: round - 1,
        repaired_segment_numbers: [...repairedNumbers].sort((a, b) => a - b),
        repaired_character_names: [...repairedCharacters].sort(),
      };
    }

    const previousSignature = findingSignature(report);
    const batch = await options.repair(breakdown, {
      round,
      target_segment_numbers: targets,
      target_character_names: targetCharacters,
      findings: blocking.filter(
        (finding) =>
          (finding.scope === "segment" &&
            targets.includes(finding.segment_number ?? -1)) ||
          (finding.scope === "character" &&
            targetCharacters.includes(
              (finding.character ?? "").trim().toLowerCase()
            ))
      ),
    });
    const requested = new Set(targets);
    const byNumber = new Map(
      batch.segments
        .filter((segment) => requested.has(segment.segment_number))
        .map((segment) => [segment.segment_number, segment])
    );
    const requestedCharacters = new Set(targetCharacters);
    const characterPatches = new Map(
      (batch.character_locks ?? [])
        .filter((lock) =>
          requestedCharacters.has((lock.name ?? "").trim().toLowerCase())
        )
        .map((lock) => [(lock.name ?? "").trim().toLowerCase(), lock])
    );

    if (byNumber.size === 0 && characterPatches.size === 0) {
      return {
        breakdown,
        report,
        status: "no_progress",
        rounds: round,
        repaired_segment_numbers: [...repairedNumbers].sort((a, b) => a - b),
        repaired_character_names: [...repairedCharacters].sort(),
      };
    }

    breakdown = {
      ...breakdown,
      segments:
        byNumber.size === 0
          ? breakdown.segments
          : breakdown.segments.map((original) => {
              const repaired = byNumber.get(original.segment_number);
              if (!repaired) return original;
              repairedNumbers.add(original.segment_number);
              return mergeSegmentRepair(original, repaired);
            }),
      character_locks: (() => {
        const seenTargets = new Set<string>();
        return breakdown.character_locks.flatMap((original) => {
          const key = (original.name ?? "").trim().toLowerCase();
          const patch = characterPatches.get(key);
          if (!patch) return [original];
          // A duplicated lock name is one identity. Keep the first authority and
          // remove later duplicates without changing any scene references.
          if (seenTargets.has(key)) return [];
          seenTargets.add(key);
          repairedCharacters.add(original.name);
          return [mergeCharacterRepair(original, patch)];
        });
      })(),
    };

    await options.afterMerge?.(breakdown);
    report = validate(breakdown);

    if (report.ok) {
      return {
        breakdown,
        report,
        status: "clean",
        rounds: round,
        repaired_segment_numbers: [...repairedNumbers].sort((a, b) => a - b),
        repaired_character_names: [...repairedCharacters].sort(),
      };
    }

    if (findingSignature(report) === previousSignature) {
      return {
        breakdown,
        report,
        status: "no_progress",
        rounds: round,
        repaired_segment_numbers: [...repairedNumbers].sort((a, b) => a - b),
        repaired_character_names: [...repairedCharacters].sort(),
      };
    }
  }

  return {
    breakdown,
    report,
    status: "exhausted",
    rounds: maxRounds,
    repaired_segment_numbers: [...repairedNumbers].sort((a, b) => a - b),
    repaired_character_names: [...repairedCharacters].sort(),
  };
}

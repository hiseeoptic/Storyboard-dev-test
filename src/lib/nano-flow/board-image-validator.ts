import type {
  AtomicAction,
  EntityPlacementState,
} from "../production-state/types.ts";

export interface BoardImageFinding {
  code:
    | "BOARD_SUBJECT_MISSING"
    | "BOARD_DISMEMBERED_CHARACTER"
    | "BOARD_DUPLICATE_IDENTITY_RISK"
    | "BOARD_UNMOTIVATED_PLACEMENT_CHANGE";
  severity: "high" | "medium";
  evidence: string;
  suggested_patch: Record<string, unknown>;
}

export interface BoardPanelLike extends Record<string, unknown> {
  action?: string;
  camera?: string;
  panel?: number;
}

export interface BoardPlacementContract {
  mode: "initial" | "preserve_previous_without_movement" | "scripted_relocation";
  canonical_placements: EntityPlacementState[];
  rule: string;
  repaired_from_previous: boolean;
  findings: BoardImageFinding[];
}

interface NormalizeBoardPanelsParams {
  panels: BoardPanelLike[];
  castNames: string[];
  sceneAction?: string;
}

const BODY_PART = /\b(hand|hands|finger|fingers|wrist|wrists|palm|palms|arm|arms|bàn tay|ngón tay|cổ tay|cánh tay)\b/iu;
const CONNECTED_BODY = /\b(face|head|shoulder|shoulders|torso|upper body|waist|chest|mặt|đầu|vai|thân trên|nửa người)\b/iu;
const CLOSE_FRAMING = /^\s*\[(?:CLOSE|CU|ECU|MACRO)\]|\b(?:close[- ]?up|macro|extreme close)\b/iu;
const DANGLING_TARGET_SOURCE = "\\b(focus(?:ed|ing)?|camera focus(?:ed|ing)?|close[- ]?up|push(?:es)? in|pan(?:s)?|drift(?:s)?)\\s+(on|to|toward)\\s*(?=,|;|\\.|$)";
const danglingTarget = (global = false) => new RegExp(DANGLING_TARGET_SOURCE, global ? "giu" : "iu");
const RELOCATION = /\b(walk(?:s|ed|ing)?|move(?:s|d|ment|ing)?|step(?:s|ped|ping)?|stand(?:s|ing)? up|stood up|rise(?:s|n)?|sit(?:s|ting)? down|sat down|cross(?:es|ed|ing)?|approach(?:es|ed|ing)?|crouch(?:es|ed|ing)?|kneel(?:s|ed|ing)?|bend(?:s|ing)?|leave(?:s|ing)?|enter(?:s|ed|ing)?|change(?:s|d)? seats?|switch(?:es|ed)? seats?|slide(?:s|d)? (?:over|across)|đi|bước|di chuyển|đứng dậy|ngồi xuống|ngồi xổm|quỳ|cúi|đổi chỗ|đổi ghế|rời|tiến lại)\b/iu;

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsName(text: string, name: string): boolean {
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`,
    "iu"
  ).test(text);
}

function namesIn(text: string, castNames: string[]): string[] {
  const exact = castNames.filter((name) => mentionsName(text, name));
  const expanded = [...exact];
  // Models often shorten an enumerated role after naming the first identity,
  // e.g. "Người chạy nhanh 1 and 2". Recover the second locked identity so a
  // two-person beat never compiles as one person or clones identity #1.
  for (const name of exact) {
    const match = name.match(/^(.*?)(\d+)$/u);
    if (!match) continue;
    const prefix = match[1]!.trim();
    if (!prefix) continue;
    for (const sibling of castNames) {
      const siblingMatch = sibling.match(/^(.*?)(\d+)$/u);
      if (!siblingMatch || siblingMatch[1]!.trim() !== prefix) continue;
      const siblingNumber = siblingMatch[2]!;
      const firstNumber = match[2]!;
      const shorthand = new RegExp(
        `${escapeRegExp(prefix)}\\s*${escapeRegExp(firstNumber)}\\s*(?:and|&|và)\\s*${escapeRegExp(siblingNumber)}(?:\\b|$)`,
        "iu"
      );
      if (shorthand.test(text)) expanded.push(sibling);
    }
  }
  return unique(expanded);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function placementKey(placement: EntityPlacementState): string {
  return [
    placement.zone_id ?? "",
    placement.anchor_id ?? "",
    clean(placement.position_label)
      .toLocaleLowerCase()
      .replace(/\b(?:facing|faces|looking|looks|gaze|hướng về|đối diện|nhìn|ánh mắt)\b[^,;]*/giu, "")
      .replace(/\s+/g, " ")
      .trim(),
    placement.world_side,
    placement.screen_side,
  ].join("|");
}

function placementChanged(
  previous: EntityPlacementState[],
  current: EntityPlacementState[]
): boolean {
  const currentById = new Map(current.map((placement) => [placement.entity_id, placement]));
  return previous.some((placement) => {
    const next = currentById.get(placement.entity_id);
    return next ? placementKey(placement) !== placementKey(next) : false;
  });
}

function hasScriptedRelocation(actions: AtomicAction[], motionText: string): boolean {
  return actions.some(
    (action) =>
      (!!action.from_zone_id && !!action.to_zone_id && action.from_zone_id !== action.to_zone_id) ||
      RELOCATION.test(`${action.verb} ${action.evidence}`)
  ) || RELOCATION.test(motionText);
}

/**
 * Freeze blocking across adjacent boards in the same location. If the next
 * start snapshot silently changes a chair/side/anchor and there is no visible
 * relocation action, the previous end placement remains authoritative.
 */
export function buildBoardPlacementContract(params: {
  previousEndPlacements?: EntityPlacementState[];
  currentStartPlacements?: EntityPlacementState[];
  sameLocation: boolean;
  actions: AtomicAction[];
  motionText?: string;
}): BoardPlacementContract {
  const previous = params.previousEndPlacements ?? [];
  const current = params.currentStartPlacements ?? [];
  const moved = hasScriptedRelocation(params.actions, clean(params.motionText));
  const silentChange =
    params.sameLocation &&
    previous.length > 0 &&
    current.length > 0 &&
    placementChanged(previous, current) &&
    !moved;

  if (silentChange) {
    return {
      mode: "preserve_previous_without_movement",
      canonical_placements: previous,
      repaired_from_previous: true,
      rule:
        "No character may change chair, table side, screen side, anchor, facing direction or opposite/adjacent relationship between boards without a visible scripted stand/walk/sit relocation. Preserve these previous end placements exactly in every panel of this board.",
      findings: [{
        code: "BOARD_UNMOTIVATED_PLACEMENT_CHANGE",
        severity: "high",
        evidence: `previous=${JSON.stringify(previous)} current=${JSON.stringify(current)}`,
        suggested_patch: {
          op: "restore_previous_end_placements",
          canonical_placements: previous,
        },
      }],
    };
  }

  return {
    mode: moved ? "scripted_relocation" : "initial",
    canonical_placements: current.length > 0 ? current : previous,
    repaired_from_previous: false,
    rule: moved
      ? "A placement change is allowed only along the visible ordered relocation action; show the body leaving the old support/seat, crossing real floor and settling at the new anchor."
      : "Keep every character on the declared chair/side/anchor with the declared facing and opposite/adjacent relationship for the whole board.",
    findings: [],
  };
}

/**
 * Repair image-board panels without another model call. The output gives Nano
 * Banana explicit character cardinality and converts unsafe hand-only closeups
 * into connected medium-close frames that retain the owner's face and torso.
 */
export function normalizeBoardImagePanels(
  params: NormalizeBoardPanelsParams
): { panels: BoardPanelLike[]; findings: BoardImageFinding[] } {
  const castNames = unique(params.castNames);
  const findings: BoardImageFinding[] = [];
  let lastSubject = namesIn(clean(params.sceneAction), castNames)[0] ?? castNames[0] ?? "the acting character";

  const panels = params.panels.map((source, index) => {
    let action = clean(source.action);
    let camera = clean(source.camera);
    const originallyNamed = namesIn(`${action} ${camera}`, castNames);
    let visibleNames = [...originallyNamed];
    let subject = visibleNames[visibleNames.length - 1] ?? lastSubject;

    if (danglingTarget().test(`${action} ${camera}`)) {
      const evidence = `${action} | ${camera}`;
      action = action.replace(danglingTarget(true), (_match, verb: string, prep: string) => `${verb} ${prep} ${subject}`);
      camera = camera.replace(danglingTarget(true), (_match, verb: string, prep: string) => `${verb} ${prep} ${subject}`);
      visibleNames = unique([...visibleNames, subject]);
      findings.push({
        code: "BOARD_SUBJECT_MISSING",
        severity: "high",
        evidence,
        suggested_patch: { op: "bind_missing_panel_subject", panel: index + 1, subject },
      });
    }

    const combined = `${action} ${camera}`;
    if (BODY_PART.test(combined) && !CONNECTED_BODY.test(combined)) {
      const owners = namesIn(combined, castNames);
      const connectedOwners = owners.length > 0 ? owners : [subject];
      const ownerText = connectedOwners.join(" and ");
      action = `${action}. ${ownerText}'s face, shoulders, upper torso and acting limb remain visibly connected in the same frame`;
      camera = `${CLOSE_FRAMING.test(camera)
        ? camera.replace(/^\s*\[(?:CLOSE|CU|ECU|MACRO)\]/iu, "[MEDIUM_CLOSE]")
        : camera}; frame ${ownerText}'s face, shoulders, upper torso and acting hand together as one anatomically connected person — never an isolated hand, arm-only crop or disembodied body part`;
      visibleNames = unique([...visibleNames, ...connectedOwners]);
      findings.push({
        code: "BOARD_DISMEMBERED_CHARACTER",
        severity: "high",
        evidence: combined,
        suggested_patch: {
          op: "widen_to_connected_character_frame",
          panel: index + 1,
          owners: connectedOwners,
        },
      });
    }

    // A wide frame controls geography, not cast membership. Earlier code put
    // the whole project cast into every WIDE panel, creating people absent from
    // the beat. Expand to the whole cast only when the prose explicitly asks
    // for the complete group and names no individual identity.
    const groupCount = castNames.length;
    const explicitWholeGroup = groupCount > 1 && new RegExp(
      `\\b(?:all\\s+${groupCount}|${groupCount}\\s+(?:people|persons|characters|figures|runners)|cả\\s+${groupCount}|${groupCount}\\s+(?:người|nhân vật|người que))\\b`,
      "iu"
    ).test(`${action} ${camera}`);
    if (visibleNames.length === 0 && explicitWholeGroup) {
      visibleNames = [...castNames];
    }
    if (visibleNames.length === 0 && castNames.length > 0) visibleNames = [subject];
    if (visibleNames.length > 0) lastSubject = visibleNames[visibleNames.length - 1]!;

    const expectedInstances = Object.fromEntries(
      castNames.map((name) => [name, visibleNames.includes(name) ? 1 : 0])
    );

    return {
      ...source,
      action,
      camera,
      visible_characters: visibleNames,
      expected_character_instances: expectedInstances,
      identity_rule:
        "Each visible name maps to its own same-named attached wardrobe sheet. Render exactly the declared 0-or-1 count for each identity; never clone, merge, substitute or reuse one character's face/body for another.",
    };
  });

  if (castNames.length > 1) {
    findings.push({
      code: "BOARD_DUPLICATE_IDENTITY_RISK",
      severity: "medium",
      evidence: `cast=${castNames.join(", ")}`,
      suggested_patch: {
        op: "declare_exact_character_cardinality",
        identities: castNames.map((name) => ({ name, maximum_instances_per_panel: 1 })),
      },
    });
  }

  return { panels, findings };
}

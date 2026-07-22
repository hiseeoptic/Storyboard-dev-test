import type { SpatialLayout } from "@/types";

/**
 * A scene's spatial topology is the small physical map that sits between the
 * environment description and motion choreography.  It does not invent a
 * location; it records which zones connect, where fixed architecture lives,
 * where people stand, and which route must remain walkable.
 */

const BALCONY = /\b(?:balcony|loggia)\b|ban công|lô gia|hiên căn hộ/iu;
const REVOLVING_DOOR =
  /\b(?:revolving door|rotating door|turnstile door)\b|cửa xoay/iu;
const REVOLVING_DOOR_EXIT =
  /\b(?:steps?|walks?|moves?)\s+out\b|\b(?:exits?|leaves?|emerges?)\b(?:.{0,48}\b(?:revolving door|rotating door|compartment)\b)?|bước ra|đi ra|ra khỏi cửa xoay|thoát khỏi cửa xoay/iu;
const REVOLVING_DOOR_ENTER =
  /\b(?:steps?|walks?|moves?)\s+(?:in|into)\b|\b(?:enters?|goes? into)\b(?:.{0,48}\b(?:revolving door|rotating door|compartment)\b)?|bước vào|đi vào|vào cửa xoay/iu;
const REVOLVING_DOOR_PASS =
  /\b(?:passes?|walks?|moves?|goes?)\s+through\b(?:.{0,48}\b(?:revolving door|rotating door)\b)?|đi xuyên qua cửa xoay|đi qua cửa xoay|bước qua cửa xoay/iu;
const INSIDE_REVOLVING_DOOR =
  /\binside\b.{0,56}\b(?:revolving door|compartment|wedge)\b|\b(?:revolving door|compartment|wedge)\b.{0,56}\binside\b|trong.{0,40}(?:cửa xoay|khoang cửa)|(?:cửa xoay|khoang cửa).{0,40}bên trong/iu;
const DOORWAY =
  /\b(?:doorway|door frame|threshold|sliding door|open doorway|open door|door opening|entrance door|exit door)\b|khung cửa|ngưỡng cửa|cửa ra ban công|cửa trượt|lối vào cửa|lối ra cửa/iu;
const RAILING = /\b(?:railing|guardrail|balustrade|parapet)\b|lan can|tay vịn|tường chắn/iu;
const STAIRS =
  /\b(?:stairs?|staircase|stairway|stairwell|stair flight|flight of stairs|stair landing|landing between stairs|steps leading|steps up to|steps down to|front steps|concrete steps|stone steps)\b|cầu thang|bậc thang|chiếu nghỉ/iu;
const EXPOSED_EDGE =
  /\b(?:rooftop|roof edge|platform edge|cliff edge|dock edge|pool edge)\b|sân thượng|mép mái|mép bục|vách đá|mép hồ|mép bến/iu;

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim()
    : "";
}

function namesLine(characterNames?: string[]): string {
  const names = (characterNames ?? []).map(clean).filter(Boolean);
  return names.length > 0
    ? `${names.join(", ")} each occupies exactly the zone, floor position, distance from the anchor, and facing direction declared in the start state; feet stay on a real walkable surface.`
    : "Every visible character occupies exactly the zone, floor position, distance from the anchor, and facing direction declared in the start state; feet stay on a real walkable surface.";
}

function mentionsEveryCurrentCharacter(text: string, characterNames?: string[]): boolean {
  const names = (characterNames ?? []).map(clean).filter(Boolean);
  if (names.length === 0 || !text) return false;
  const lower = text.toLocaleLowerCase();
  return names.every((name) => lower.includes(name.toLocaleLowerCase()));
}

export type RevolvingDoorOperation =
  | "enter"
  | "exit"
  | "pass_through"
  | "hold"
  | "background";

/** Determine the physical operation before rendering any revolving-door route. */
export function inferRevolvingDoorOperation(params: {
  setting?: string | null;
  motion?: string | null;
  startState?: string | null;
  endState?: string | null;
  continuityFromPrevious?: string | null;
}): RevolvingDoorOperation | null {
  const setting = clean(params.setting);
  const motion = clean(params.motion);
  const start = [clean(params.continuityFromPrevious), clean(params.startState)]
    .filter(Boolean)
    .join(" ");
  const end = clean(params.endState);
  const corpus = `${setting} ${start} ${motion} ${end}`;
  if (!REVOLVING_DOOR.test(corpus)) return null;
  if (REVOLVING_DOOR_PASS.test(motion)) return "pass_through";
  if (REVOLVING_DOOR_EXIT.test(motion)) return "exit";
  if (REVOLVING_DOOR_ENTER.test(motion)) return "enter";
  if (INSIDE_REVOLVING_DOOR.test(start)) return "hold";
  return "background";
}

function operationActor(
  operation: RevolvingDoorOperation,
  motion: string,
  startState: string,
  characterNames?: string[]
): string {
  const names = (characterNames ?? []).map(clean).filter(Boolean);
  const source = `${motion} ${startState}`;
  const actionPattern =
    operation === "exit"
      ? REVOLVING_DOOR_EXIT
      : operation === "enter" || operation === "pass_through"
        ? REVOLVING_DOOR_ENTER
        : INSIDE_REVOLVING_DOOR;
  const actionIndex = source.search(actionPattern);
  if (actionIndex >= 0) {
    const lower = source.toLocaleLowerCase();
    const ranked = names
      .map((name) => {
        const index = lower.lastIndexOf(name.toLocaleLowerCase(), actionIndex);
        return { name, distance: index >= 0 ? actionIndex - index : Number.POSITIVE_INFINITY };
      })
      .filter((item) => item.distance <= 120)
      .sort((a, b) => a.distance - b.distance);
    if (ranked[0]) return ranked[0].name;
  }
  return names.find((name) => source.toLocaleLowerCase().includes(name.toLocaleLowerCase())) || "";
}

function revolvingDoorPlacement(
  operation: RevolvingDoorOperation,
  actor: string,
  characterNames?: string[]
): string {
  if (!actor) return namesLine(characterNames);
  const others = (characterNames ?? []).map(clean).filter((name) => name && name !== actor);
  const otherPlacement = others.length
    ? ` ${others.join(", ")} ${others.length === 1 ? "waits" : "wait"} on the destination-side walkable floor, at least one full step clear of the threshold, facing ${actor}.`
    : "";
  if (operation === "exit" || operation === "hold") {
    return `${actor} starts inside the same occupied wedge compartment between the same two radial glass wings, approaching the destination-side opening.${otherPlacement}`;
  }
  if (operation === "enter" || operation === "pass_through") {
    return `${actor} starts on the origin-side walkable floor before the aligned entrance gap, facing the revolving door.${otherPlacement}`;
  }
  return namesLine(characterNames);
}

function suppliedLayout(layout?: SpatialLayout | null): SpatialLayout | null {
  if (!layout || typeof layout !== "object") return null;
  const normalized: SpatialLayout = {
    zone_order: clean(layout.zone_order),
    fixed_architecture: clean(layout.fixed_architecture),
    character_placement: clean(layout.character_placement),
    walkable_path: clean(layout.walkable_path),
    camera_zone: clean(layout.camera_zone),
    mechanism_motion: clean(layout.mechanism_motion),
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

/**
 * Resolve the model's compact map, with a deterministic safety net for old
 * storyboards and for high-risk boundary scenes where the model omitted it.
 * The fallback is deliberately archetype-neutral except for topology that is
 * already named in the scene text.
 */
export function resolveSpatialLayout(params: {
  layout?: SpatialLayout | null;
  setting?: string | null;
  motion?: string | null;
  characterNames?: string[];
  startState?: string | null;
  endState?: string | null;
  continuityFromPrevious?: string | null;
}): SpatialLayout | null {
  const supplied = suppliedLayout(params.layout);
  const text = `${clean(params.setting)} ${clean(params.motion)} ${clean(params.startState)} ${clean(params.endState)} ${clean(params.continuityFromPrevious)}`;
  const hasBalcony = BALCONY.test(text);
  const hasRevolvingDoor = REVOLVING_DOOR.test(text);
  const revolvingDoorOperation = hasRevolvingDoor
    ? inferRevolvingDoorOperation(params) || "background"
    : null;
  const hasDoorway = !hasRevolvingDoor && DOORWAY.test(text);
  const hasRailing = RAILING.test(text);
  const hasStairs = STAIRS.test(text);
  const hasEdge = EXPOSED_EDGE.test(text);
  const highRisk =
    hasBalcony || hasRevolvingDoor || hasDoorway || hasRailing || hasStairs || hasEdge;

  if (!supplied && !highRisk) return null;
  if (supplied && !highRisk) {
    return {
      zone_order: supplied.zone_order || "one continuous declared walkable scene zone",
      fixed_architecture:
        supplied.fixed_architecture ||
        "Walls, openings, furniture and fixed set pieces keep their declared positions for the whole clip.",
      character_placement: supplied.character_placement || namesLine(params.characterNames),
      walkable_path:
        supplied.walkable_path ||
        "All movement follows the visible load-bearing floor and does not pass through people, furniture or architecture.",
      camera_zone:
        supplied.camera_zone ||
        "The camera occupies one real supported position with an unobstructed line of sight.",
    };
  }

  let fallback: SpatialLayout;
  if (hasBalcony && hasDoorway) {
    fallback = {
      zone_order:
        "interior room -> open doorway/threshold in the facade wall -> balcony walkable floor -> railing at the outer perimeter -> exterior air/city beyond",
      fixed_architecture:
        "The doorway is one unobstructed opening between the interior and balcony. The railing follows ONLY the balcony's exposed outer perimeter; it never crosses, faces across, or blocks the doorway/threshold and never stands between people conversing across that threshold.",
      character_placement: namesLine(params.characterNames),
      walkable_path:
        "A continuous clear floor route runs from the interior through the doorway threshold onto the balcony. No railing, wall, furniture, planter, body, or prop cuts across this route.",
      camera_zone:
        "The camera occupies one named walkable zone on the safe side of the railing, with a direct line of sight through open air; it is never inside a wall, inside the threshold, or beyond the outer railing.",
    };
  } else if (hasRevolvingDoor) {
    const actor = operationActor(
      revolvingDoorOperation || "background",
      clean(params.motion),
      `${clean(params.continuityFromPrevious)} ${clean(params.startState)}`,
      params.characterNames
    );
    const placement = revolvingDoorPlacement(
      revolvingDoorOperation || "background",
      actor,
      params.characterNames
    );
    fallback = {
      zone_order:
        "origin-side lobby floor -> one wedge-shaped revolving-door compartment -> destination-side lobby floor",
      fixed_architecture:
        "One fixed circular glass enclosure surrounds one fixed center shaft. Rigid radial glass wings divide the door into wedge-shaped compartments and rotate together around that shaft; the enclosure, shaft, thresholds and lobby architecture never move or deform.",
      character_placement: placement,
      walkable_path:
        revolvingDoorOperation === "exit"
          ? "The occupant remains inside the same wedge while it follows its curved arc, then steps across the destination-side threshold exactly once only after that compartment opening fully aligns. No re-entry, repeated exit, straight shortcut through glass, center shaft or enclosure."
          : revolvingDoorOperation === "hold"
            ? "The occupant remains inside the same wedge between the same two radial wings for the whole clip; no entry, exit, compartment change or crossing through glass occurs."
            : revolvingDoorOperation === "background"
              ? "All characters remain on their declared supported lobby floor. The revolving door is background architecture only; nobody enters, exits or occupies a wedge in this clip."
              : "Enter only through the open gap aligned with the origin side, remain inside the same wedge compartment, follow its curved floor arc, and exit only after that same compartment opening aligns with the destination side. No straight shortcut through glass, center shaft or enclosure.",
      camera_zone:
        revolvingDoorOperation === "exit"
          ? "The camera occupies one supported destination-side lobby position, safely offset from the exit route and threshold, with a clear sightline to the occupied wedge and waiting characters."
          : "The camera occupies one supported lobby position with a clear sightline through or around the glass; it never enters the rotating center or clips through a panel.",
      mechanism_motion:
        revolvingDoorOperation === "exit"
          ? "The clip starts with one already occupied wedge rotating in one established direction. The occupant and every carried bag remain between the same two radial glass wings, then exit exactly once only when that opening aligns with the destination floor; never reverse, re-enter, cross a wing or center shaft."
          : revolvingDoorOperation === "hold"
            ? "The already occupied wedge and all radial glass wings rotate together in one direction. The occupant and every carried bag remain between the same two wings for the whole clip; no entry or exit occurs."
            : revolvingDoorOperation === "background"
              ? "If the unoccupied revolving door moves in the background, all radial glass wings rotate together in one direction around the fixed center shaft. No visible character enters, exits or occupies a compartment."
              : "At the first visible movement establish one rotation direction and keep it for the entire clip. The radial wings and occupied compartment rotate together as one rigid mechanism. The person and every carried bag remain between the same two wings, never reverse, overtake, cross a wing or center shaft, and step onto the destination floor only when the opening physically aligns with it.",
    };
  } else if (hasStairs) {
    fallback = {
      zone_order: "lower walkable area -> stair entry -> continuous stair flight -> upper landing",
      fixed_architecture:
        "Steps, risers, landings, walls, and guardrails retain one coherent geometry. Guardrails run along exposed sides only, never across a step, stair entry, landing, or required walking route.",
      character_placement: namesLine(params.characterNames),
      walkable_path:
        "The walking route follows consecutive load-bearing steps and landings; every footfall lands on a visible tread and no body or prop passes through the guardrail.",
      camera_zone:
        "The camera stands on a real floor, tread, or supported rig position with an unobstructed sightline; never floating over the stair void or clipping through rails and walls.",
    };
  } else if (hasDoorway) {
    fallback = {
      zone_order: "declared room/side A -> open doorway threshold -> adjoining walkable room/side B",
      fixed_architecture:
        "The doorway remains a real opening in a wall, with jambs at the sides and a threshold on the floor. No wall, railing, counter, furniture, or prop crosses or seals the opening unless the script explicitly closes the door.",
      character_placement: namesLine(params.characterNames),
      walkable_path:
        "One unobstructed floor route passes through the doorway; anyone changing sides must visibly cross the threshold along this route.",
      camera_zone:
        "The camera occupies a real declared side of the doorway and keeps a physically possible line of sight; it never sits inside the wall or looks through a solid door panel.",
    };
  } else {
    fallback = {
      zone_order: hasBalcony
        ? "facade/inner balcony edge -> balcony walkable floor -> protected outer perimeter -> exterior beyond"
        : "safe walkable surface -> exposed boundary -> non-walkable space beyond",
      fixed_architecture:
        "Every guardrail, parapet, curb, or safety boundary stays on the actual exposed perimeter. It never migrates into the middle of the floor, crosses a doorway, or divides a required walking route.",
      character_placement: namesLine(params.characterNames),
      walkable_path:
        "All action remains on connected load-bearing floor. Characters and props stay on the safe side of the boundary and never occupy empty space beyond it.",
      camera_zone:
        "The camera remains on a real supported surface or plausible rig on the safe side of the boundary, never floating beyond the edge or looking through solid architecture.",
    };
  }

  if (!supplied) return fallback;
  // In high-risk scenes the structural relation is a law of the named
  // architecture, not a creative suggestion. Keep model-authored placement
  // detail, but never let prose override the safe connector/edge topology.
  return {
    zone_order: fallback.zone_order,
    fixed_architecture: fallback.fixed_architecture,
    // Never concatenate model prose with the generic fallback. That produced
    // duplicated/stale names from an older cast, which makes Veo invent extra
    // people or place them in both zones.
    // For an explicit cast, bind only the current names and let the segment's
    // start_state carry the detailed position/facing prose.
    character_placement:
      hasRevolvingDoor && revolvingDoorOperation !== "background"
        ? fallback.character_placement
        : mentionsEveryCurrentCharacter(supplied.character_placement, params.characterNames)
          ? supplied.character_placement
          : params.characterNames && params.characterNames.length > 0
            ? namesLine(params.characterNames)
            : supplied.character_placement || fallback.character_placement,
    walkable_path: fallback.walkable_path,
    camera_zone: hasRevolvingDoor && revolvingDoorOperation !== "background"
      ? fallback.camera_zone
      : supplied.camera_zone
      ? /real supported walkable surface|supported lobby position/iu.test(supplied.camera_zone)
        ? supplied.camera_zone
        : `${supplied.camera_zone} This position is valid only on a real supported walkable surface, on the safe side of every boundary, with no solid architecture blocking the sightline.`
      : fallback.camera_zone,
    ...(fallback.mechanism_motion
      ? { mechanism_motion: fallback.mechanism_motion }
      : supplied.mechanism_motion
        ? { mechanism_motion: supplied.mechanism_motion }
        : {}),
  };
}

export const SPATIAL_TOPOLOGY_INVARIANTS =
  "Freeze this map for the whole clip: zones never swap order; fixed architecture never moves; openings remain openings; perimeter barriers stay on the true exposed edge; people and props never cross a solid boundary or leave a walkable surface; movement between zones occurs only through the declared connector.";

/** A self-contained lock for keyframes, boards, and flat video prompts. */
export function renderSpatialTopologyLock(layout?: SpatialLayout | null): string {
  const normalized = suppliedLayout(layout);
  if (!normalized) return "";
  return `SPATIAL TOPOLOGY LOCK — ZONE ORDER: ${normalized.zone_order}; FIXED ARCHITECTURE: ${normalized.fixed_architecture}; CHARACTER PLACEMENT: ${normalized.character_placement}; CLEAR WALKABLE PATH: ${normalized.walkable_path}; CAMERA ZONE: ${normalized.camera_zone}${normalized.mechanism_motion ? `; MECHANISM MOTION: ${normalized.mechanism_motion}` : ""}; INVARIANTS: ${SPATIAL_TOPOLOGY_INVARIANTS}`;
}

/** Short version for the small panels of the master overview board. */
export function renderSpatialTopologyBoardHint(layout?: SpatialLayout | null): string {
  const normalized = suppliedLayout(layout);
  if (!normalized) return "";
  return `PHYSICAL MAP: ${normalized.zone_order}. ARCHITECTURE: ${normalized.fixed_architecture}`;
}

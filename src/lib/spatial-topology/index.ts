import type { SpatialLayout } from "@/types";

/**
 * A scene's spatial topology is the small physical map that sits between the
 * environment description and motion choreography.  It does not invent a
 * location; it records which zones connect, where fixed architecture lives,
 * where people stand, and which route must remain walkable.
 */

const BALCONY = /\b(?:balcony|loggia)\b|ban công|lô gia|hiên căn hộ/iu;
const DOORWAY =
  /\b(?:doorway|door frame|threshold|sliding door|open door|entrance|exit)\b|khung cửa|ngưỡng cửa|cửa ra ban công|cửa kính|cửa trượt|lối vào|lối ra/iu;
const RAILING = /\b(?:railing|guardrail|balustrade|parapet)\b|lan can|tay vịn|tường chắn/iu;
const STAIRS = /\b(?:stairs?|staircase|landing|steps?)\b|cầu thang|bậc thang|chiếu nghỉ/iu;
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

function suppliedLayout(layout?: SpatialLayout | null): SpatialLayout | null {
  if (!layout || typeof layout !== "object") return null;
  const normalized: SpatialLayout = {
    zone_order: clean(layout.zone_order),
    fixed_architecture: clean(layout.fixed_architecture),
    character_placement: clean(layout.character_placement),
    walkable_path: clean(layout.walkable_path),
    camera_zone: clean(layout.camera_zone),
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
}): SpatialLayout | null {
  const supplied = suppliedLayout(params.layout);
  const text = `${clean(params.setting)} ${clean(params.motion)}`;
  const hasBalcony = BALCONY.test(text);
  const hasDoorway = DOORWAY.test(text);
  const hasRailing = RAILING.test(text);
  const hasStairs = STAIRS.test(text);
  const hasEdge = EXPOSED_EDGE.test(text);
  const highRisk = hasBalcony || hasDoorway || hasRailing || hasStairs || hasEdge;

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
      params.characterNames && params.characterNames.length > 0
        ? namesLine(params.characterNames)
        : supplied.character_placement || fallback.character_placement,
    walkable_path: fallback.walkable_path,
    camera_zone: supplied.camera_zone
      ? `${supplied.camera_zone} This position is valid only on a real supported walkable surface, on the safe side of every boundary, with no solid architecture blocking the sightline.`
      : fallback.camera_zone,
  };
}

export const SPATIAL_TOPOLOGY_INVARIANTS =
  "Freeze this map for the whole clip: zones never swap order; fixed architecture never moves; openings remain openings; perimeter barriers stay on the true exposed edge; people and props never cross a solid boundary or leave a walkable surface; movement between zones occurs only through the declared connector.";

/** A self-contained lock for keyframes, boards, and flat video prompts. */
export function renderSpatialTopologyLock(layout?: SpatialLayout | null): string {
  const normalized = suppliedLayout(layout);
  if (!normalized) return "";
  return `SPATIAL TOPOLOGY LOCK — ZONE ORDER: ${normalized.zone_order}; FIXED ARCHITECTURE: ${normalized.fixed_architecture}; CHARACTER PLACEMENT: ${normalized.character_placement}; CLEAR WALKABLE PATH: ${normalized.walkable_path}; CAMERA ZONE: ${normalized.camera_zone}; INVARIANTS: ${SPATIAL_TOPOLOGY_INVARIANTS}`;
}

/** Short version for the small panels of the master overview board. */
export function renderSpatialTopologyBoardHint(layout?: SpatialLayout | null): string {
  const normalized = suppliedLayout(layout);
  if (!normalized) return "";
  return `PHYSICAL MAP: ${normalized.zone_order}. ARCHITECTURE: ${normalized.fixed_architecture}`;
}

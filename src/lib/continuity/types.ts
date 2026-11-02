// Shared types of the continuity contract (world key, prop plan, script
// supervisor log). Kept free of runtime imports so the manifest type can use it.

export interface PropMove {
  entity_id: string;
  label: string;
  from: string;
  to: string;
  /** Character who moves it ("Na"); null when the ledger names nobody. */
  by: string | null;
  /** "right hand" / "left hand"; null when the ledger names no hand. */
  hand: string | null;
  /** "move" = changes place / holder; "change" = same place, new state (a cushion pushed into a wall). */
  kind?: "move" | "change";
}

export interface PropTouch {
  entity_id: string;
  label: string;
  by: string | null;
  hand: string | null;
}

export interface PropStay {
  entity_id: string;
  label: string;
  position: string;
}

export interface ShotPropPlan {
  moves: PropMove[];
  touched: PropTouch[];
  stays: PropStay[];
}

export interface ContinuityLogRow {
  shot_index: number;
  shot_id: string;
  location_id: string;
  /** "MS → MS → MS". */
  camera_path: string;
  /** The rule held the opening framing because the plan widened back. */
  camera_locked: boolean;
  /** The shot ends on a continuity END keyframe (first + last frame video). */
  end_frame?: boolean;
  moves: string[];
  touched: string[];
  stays: string[];
  new_elements: string[];
  repairs: string[];
  findings: string[];
}

export interface NanoFlowContinuity {
  version: "1.0";
  /** One WORLD KEY per location, pasted word for word into its prompts. */
  world_keys: Record<string, string>;
  /** The structured blueprint each world key was compiled from. */
  blueprints?: Record<string, LocationBlueprint>;
  /** Script-supervisor continuity log, one row per shot. */
  log: ContinuityLogRow[];
}

// ── Location blueprint — the structured, location-agnostic source of a place ──
// Written once per location by the planner (any place: a room, a street, a
// beach, a car, a shop…), normalised by the app, and the ONLY input of the
// world key, the set map and the fixed-set locks. Old projects without it get a
// blueprint derived from their setting/scenery prose.

export type BlueprintKind = "interior" | "exterior" | "vehicle" | "other";

export interface BlueprintElement {
  /** One fixed piece: furniture, architecture, terrain or landmark. */
  name: string;
  /** Where it is in the master view: "left|centre|right" + "foreground|midground|background". */
  frame_zone: string;
  /** Where it is relative to the anchor or another element ("against the wall behind the counter"). */
  relation: string;
}

export interface LocationBlueprint {
  location_id: string;
  /** Short place name (never a script sentence). */
  name: string;
  kind: BlueprintKind;
  /** Where the master camera stands and what it looks at. */
  master_view: string;
  /** The main surface / route the action happens on or around; always fixed_elements[0]. */
  anchor: string;
  fixed_elements: BlueprintElement[];
  /** Light source and its direction in the master view. */
  light: string;
  /** "planner" = written by the planner; "derived" = rebuilt from prose for an older project. */
  source: "planner" | "derived";
}

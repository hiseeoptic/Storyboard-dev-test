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
  /** Script-supervisor continuity log, one row per shot. */
  log: ContinuityLogRow[];
}

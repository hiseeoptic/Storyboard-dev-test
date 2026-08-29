export const RULE_AUTHORITY_ORDER = [
  "user_reference",
  "approved_script",
  "locked_context",
  "production_profile",
  "scene_intent",
  "production_state",
  "shot_direction",
  "style_preference",
  "negative_prompt",
] as const;

export type RuleAuthority = (typeof RULE_AUTHORITY_ORDER)[number];

export const CANONICAL_RULE_OWNERS = [
  "reference_authority", "approved_script", "project_intent", "world_context",
  "ontology", "timeline", "environment", "character_identity", "object_state",
  "scene_intent", "physical_state", "spatial_state", "cinematography",
  "dialogue_audio", "prompt_compiler", "validation",
] as const;

export type CanonicalRuleOwner = (typeof CANONICAL_RULE_OWNERS)[number];

export interface RuleOwnerContract {
  owner: CanonicalRuleOwner;
  owns: readonly string[];
  must_not_own: readonly string[];
}

/** One fact, one owner. Other layers may consume a fact but may not redefine it. */
export const RULE_OWNER_CONTRACTS: readonly RuleOwnerContract[] = [
  { owner: "reference_authority", owns: ["uploaded identity pixels", "uploaded product geometry", "uploaded location geometry"], must_not_own: ["story action", "dialogue", "camera grammar"] },
  { owner: "approved_script", owns: ["plot facts", "approved dialogue text", "cast roles", "causal reveal", "ending"], must_not_own: ["physical support graph", "camera implementation", "validation policy"] },
  { owner: "project_intent", owns: ["purpose", "audience", "platform", "success criteria"], must_not_own: ["action choreography", "camera recipe", "dialogue clock"] },
  { owner: "world_context", owns: ["reality mode", "physics mode", "era", "culture", "technology boundary"], must_not_own: ["per-shot pose", "per-shot camera move", "speaker timing"] },
  { owner: "ontology", owns: ["allowed entity classes", "forbidden entity classes", "visible text policy"], must_not_own: ["object position", "object holder", "camera framing"] },
  { owner: "timeline", owns: ["story time", "time jumps", "temporal relation", "time-of-day continuity"], must_not_own: ["dialogue delivery clock", "location geometry"] },
  { owner: "environment", owns: ["location", "fixed architecture", "light motivation", "sound bed", "reverb"], must_not_own: ["character identity", "scene purpose", "dialogue text"] },
  { owner: "character_identity", owns: ["character ID", "appearance lock", "wardrobe lock", "voice identity"], must_not_own: ["per-shot position", "per-shot action", "camera focus"] },
  { owner: "object_state", owns: ["object ID", "part-whole identity", "material", "intrinsic condition"], must_not_own: ["scene intent", "camera style", "dialogue"] },
  { owner: "scene_intent", owns: ["why the scene exists", "required change", "proof requirements", "subtext"], must_not_own: ["action choreography", "lighting recipe", "dialogue timing"] },
  { owner: "physical_state", owns: ["contact", "support", "holder", "force", "state transition", "persistent trace"], must_not_own: ["world style", "scene purpose", "dialogue wording"] },
  { owner: "spatial_state", owns: ["zones", "connectors", "placements", "walkable path", "line of sight"], must_not_own: ["location identity", "character identity", "scene purpose"] },
  { owner: "cinematography", owns: ["camera grammar", "axis", "screen direction", "exposure", "shot lighting state"], must_not_own: ["plot facts", "object holder", "dialogue text"] },
  { owner: "dialogue_audio", owns: ["speaker binding", "dialogue clock", "lip sync", "Foley", "audio transition"], must_not_own: ["character appearance", "object position", "camera axis"] },
  { owner: "prompt_compiler", owns: ["active rule packet", "prompt ordering", "prompt budget", "negative selection"], must_not_own: ["new story facts", "new entities", "new state changes"] },
  { owner: "validation", owns: ["violation findings", "severity", "repair target"], must_not_own: ["creative invention", "silent state mutation", "silent script rewrite"] },
] as const;

export function isCanonicalRuleOwner(value: string): value is CanonicalRuleOwner {
  return (CANONICAL_RULE_OWNERS as readonly string[]).includes(value);
}

export function authorityRank(authority: RuleAuthority): number {
  return RULE_AUTHORITY_ORDER.indexOf(authority);
}

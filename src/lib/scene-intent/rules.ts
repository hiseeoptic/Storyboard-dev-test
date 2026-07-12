import { defineRules, selectRules, type RuleSelectionContext } from "@/lib/rules";

/** Abstract laws. They apply to every project without assuming a marketing arc. */
export const SCENE_INTENT_ABSTRACT_LAWS = [
  "Scene intent is derived from the locked project intent, approved script and story state — never selected from a default marketing template without evidence",
  "The FIRST clip reserves a 3-5 second Hook Window that earns immediate attention in an intent-appropriate form (visual event, question, conflict, observed fact, sensory moment, emotional recognition or product proof); later clips do not pretend to be new opening hooks",
  "A Hook Window carries exactly one honest core promise and names how the later payoff fulfils it; misleading clickbait, unrelated spectacle, slow greetings, logo-first openings and context dumps before the hook are violations",
  "Hook dialogue is optional: a strong visual/audio event may carry the first 3-5 seconds, but the window must provide immediate observable evidence rather than an abstract claim",
  "Every clip has exactly one primary function and at most three secondary functions; the primary function wins whenever purposes compete",
  "Every clip must create a declared change in story state, audience understanding, emotion, character position, product proof or atmosphere; pure beauty is valid only when atmosphere is the declared purpose",
  "The intent states WHY the clip exists and WHAT must change; it must not duplicate action choreography, camera instructions, lighting recipes or dialogue timing owned by other layers",
  "Audience effect is explicit: what earns attention, what emotion is intended, what belief changes and what action—if any—is desired",
  "Character performance follows objective → obstacle → tactic → subtext → emotional/physical result; no unmotivated expression or emotional reset",
  "Proof requirements name the smallest visible and audible evidence needed to prove the intent; unrelated spectacle and decorative details are forbidden distractions",
  "Entry and exit states obey the locked continuity mode; strict continuity preserves physical state, while montage/symbolic/scene-cut modes preserve their declared anchors instead",
  "If removing the clip breaks nothing in narrative, information, emotion, product proof, rhythm or atmosphere, the clip must be merged, rewritten or intentionally justified",
  "A hook, CTA, product reveal, punchline or educational explanation is used only when the project intent or approved script requires it",
  "Scene success and failure conditions must be testable by validators before prompt compilation",
] as const;

/** Original laws are retained verbatim as a legacy short-form marketing profile. */
export const SCENE_INTENT_LEGACY_MARKETING_LAWS = [
  "Each clip serves EXACTLY ONE intent (hook / escalate / reveal / soothe / cta) with one emotional trajectory (flat / rising / falling)",
  "Pacing serves the spoken line: leave breathing room before and after dialogue — never cram actions to 'fill' the clip",
  "Emotion changes gradually between chained clips (max ~20% shift) — no expression resets, no mood teleports",
  "The topic's spirit (numerology, health, comedy…) is expressed through setting, light, rhythm, voice and silence — NEVER by breaking physics",
] as const;

export const SCENE_INTENT_RULE_DEFINITIONS = defineRules([
  ...SCENE_INTENT_ABSTRACT_LAWS.map((statement, index) => ({
    id: `scene_intent_abstract_${String(index + 1).padStart(2, "0")}`,
    version: "2.0.0",
    layer: "scene_intent",
    statement,
    state: "abstract" as const,
    priority: "hard" as const,
    scope: "clip" as const,
    profile: "all_projects",
    owner: "scene_intent",
    applies_when: ["project intent and approved script are available"],
    does_not_apply_when: [],
    conflicts_with: [],
    exception_policy: "An exception must cite script evidence and declare what replaces this rule.",
    enforced_by: ["analyzer", "validator"] as const,
    violation_code: `SCENE_INTENT_RULE_${String(index + 1).padStart(2, "0")}`,
    violation_severity: "error" as const,
    autofix: "Regenerate only the scene_intent contract; do not regenerate the full project.",
    source: "Context-Locked Video DNA canon + Scene Intent V2",
  })),
  ...SCENE_INTENT_LEGACY_MARKETING_LAWS.map((statement, index) => ({
    id: `scene_intent_legacy_marketing_${String(index + 1).padStart(2, "0")}`,
    version: "1.0.0",
    layer: "scene_intent",
    statement,
    state: "abstract" as const,
    priority: "conditional" as const,
    scope: "clip" as const,
    profile: "short_form_marketing",
    owner: "scene_intent",
    applies_when: ["locked project intent explicitly requires short-form marketing/engagement"],
    does_not_apply_when: ["documentary", "pure narrative", "atmosphere", "experimental", "non-conversion ending"],
    conflicts_with: ["project-led non-marketing ending"],
    exception_policy: "Project intent and approved script always outrank this legacy profile.",
    enforced_by: ["analyzer", "prompt"] as const,
    violation_code: `SCENE_INTENT_LEGACY_${String(index + 1).padStart(2, "0")}`,
    violation_severity: "warning" as const,
    autofix: "Disable the legacy profile when the project intent is not marketing-led.",
    source: "Preserved legacy sceneIntentLaws.ts",
  })),
]);

export function sceneIntentSystemDigest(): string {
  return `SCENE INTENT CONTRACT (per clip — mandatory, project-led, never template-led):\n${SCENE_INTENT_ABSTRACT_LAWS.map((law) => `· ${law}`).join("\n")}`;
}

export function selectSceneIntentRules(context: RuleSelectionContext) {
  return selectRules(SCENE_INTENT_RULE_DEFINITIONS, context);
}

export function selectedSceneIntentRulesDigest(context: RuleSelectionContext): string {
  const selected = selectSceneIntentRules(context);
  return `ACTIVE SCENE-INTENT RULES (deterministically selected):\n${selected
    .map((rule) => `· [${rule.profile}/${rule.priority}] ${rule.statement}`)
    .join("\n")}`;
}

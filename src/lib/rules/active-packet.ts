import type { ProductIR } from "../product-ir.ts";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { resolveRuleConflicts, type RuleConflictCandidate } from "./conflict-resolver.ts";
import { STORYBOARD_PROMPT_RULE_INVENTORY, type PromptRuleInventoryEntry } from "./prompt-inventory.ts";

export type StoryboardRuleStage = "generation" | "segment_rewrite" | "repair";
export type DialogueAuthorityMode = "preserve_user_verbatim" | "use_editorial_revision" | "use_generated_script" | "preserve_current_edit" | "editorial_polish" | "generate";
export type VisibleTextMode = "forbid_all" | "verified_brand_only" | "contextual_diegetic" | "contextual_diegetic_with_verified_brand" | "overlay_allowed";
export type HookSelectionMode = "required_by_menu" | "intent_gated";
export type ClipExecutionMode = "continuous_generated_clip_with_context_boundaries";
export type CameraSelectionMode = "locked_context_grammar" | "selected_menu_profile" | "derive_without_forced_recipe";
export type ActionSelectionMode = "locked_context_budget" | "intent_led_safe_budget";
interface RulePacketImageReference { images?: readonly string[]; isReference?: boolean; }
export interface StoryboardRulePacketInput {
  source_script?: string;
  script_treatment?: "preserve" | "polish";
  source_script_revision?: "user_verbatim" | "editorial_revision" | "generated_script";
  video_goal?: string;
  audience_goal?: string;
  story_format?: string;
  directing_profile?: string;
  camera_profile_custom?: string;
  product_images?: readonly RulePacketImageReference[];
  product_ir?: ProductIR;
  resolved_context?: ResolvedVideoContext;
}
export interface ActiveStoryboardRulePacket {
  version: "3.0";
  stage: StoryboardRuleStage;
  dialogue: { mode: DialogueAuthorityMode; rationale: string; };
  visible_text: { mode: VisibleTextMode; locked_policy: string; has_verified_product_reference: boolean; rationale: string; };
  hook: { mode: HookSelectionMode; evidence: string[]; rationale: string; };
  clip_execution: { mode: ClipExecutionMode; continuity_mode: string; allowed_transition_modes: string[]; rationale: string; };
  camera: { mode: CameraSelectionMode; selected_profile_id: string; locked_grammar: string[]; edit_rhythm: string; rationale: string; };
  action: { mode: ActionSelectionMode; locked_budget: string; rationale: string; };
  active_rule_ids: string[];
  suppressed_rule_ids: string[];
  conflict_resolutions: ReturnType<typeof resolveRuleConflicts>["resolutions"];
  unresolved_conflicts: ReturnType<typeof resolveRuleConflicts>["unresolved"];
  prompt_digest: string;
}
const INVENTORY_BY_ID = new Map(STORYBOARD_PROMPT_RULE_INVENTORY.map((entry) => [entry.id, entry]));
function inventoryRule(id: string): PromptRuleInventoryEntry { const rule = INVENTORY_BY_ID.get(id); if (!rule) throw new Error(`Missing storyboard prompt rule inventory entry: ${id}`); return rule; }
function candidate(id: string, authority: RuleConflictCandidate["authority"]): RuleConflictCandidate { return { rule: inventoryRule(id), authority }; }
export function isPromptRuleRouterEnabled(
  value: string | undefined = process.env.PROMPT_RULE_ROUTER_V3 ?? process.env.PROMPT_RULE_ROUTER_V2
): boolean {
  return ["1", "true", "on", "yes"].includes(value?.trim().toLowerCase() ?? "");
}

/** @deprecated Compatibility alias for Phase-2 callers. */
export const isPromptRuleRouterV2Enabled = isPromptRuleRouterEnabled;
function isExplicitTextBan(policy: string): boolean { const value = policy.trim().toLowerCase(); return Boolean(value) && /\b(none|forbid(?:den)?|disallow(?:ed)?|zero readable|no readable|blur(?:red)?)\b/.test(value); }
function allowsOverlay(policy: string): boolean { const value = policy.trim().toLowerCase(); return !isExplicitTextBan(value) && /\b(overlay|caption|subtitle|title card)\b/.test(value) && /\b(allow(?:ed)?|permit(?:ted)?|require(?:d)?|yes)\b/.test(value); }
function hasVerifiedProductReference(input: StoryboardRulePacketInput): boolean { return input.product_ir?.review_status === "approved" || (input.product_images ?? []).some((entry) => (entry.images?.length ?? 0) > 0 || entry.isReference === true); }

const MENU_HOOK_GOALS = new Set([
  "marketing_general", "product_ad", "brand_story", "social_short",
  "testimonial", "promo_sale", "review",
]);
const MENU_HOOK_AUDIENCE_GOALS = new Set(["attention", "retention"]);
const MENU_HOOK_FORMATS = new Set(["short_insight"]);

function hookSelection(input: StoryboardRulePacketInput): ActiveStoryboardRulePacket["hook"] {
  const evidence: string[] = [];
  if (input.video_goal && MENU_HOOK_GOALS.has(input.video_goal)) evidence.push(`video_goal=${input.video_goal}`);
  if (input.audience_goal && MENU_HOOK_AUDIENCE_GOALS.has(input.audience_goal)) evidence.push(`audience_goal=${input.audience_goal}`);
  if (input.story_format && MENU_HOOK_FORMATS.has(input.story_format)) evidence.push(`story_format=${input.story_format}`);
  return evidence.length
    ? { mode: "required_by_menu", evidence, rationale: "An explicit menu selection requires an immediate opening promise; its form still follows the selected format and story facts." }
    : { mode: "intent_gated", evidence: [], rationale: "No menu choice universally requires a formal hook; preserve the approved opening and use a hook only when Project/Scene Intent requires it." };
}

function clipExecutionSelection(input: StoryboardRulePacketInput): ActiveStoryboardRulePacket["clip_execution"] {
  const motion = input.resolved_context?.layers?.motion_continuity;
  return {
    mode: "continuous_generated_clip_with_context_boundaries",
    continuity_mode: motion?.continuity_mode?.trim() || "not locked",
    allowed_transition_modes: motion?.allowed_transition_modes ?? [],
    rationale: "One generated clip stays physically continuous; cuts, montage, time jumps and parallel edits occur only at declared clip boundaries and obey Context IR.",
  };
}

function cameraSelection(input: StoryboardRulePacketInput): ActiveStoryboardRulePacket["camera"] {
  const profile = input.resolved_context?.production_profile;
  const grammar = input.resolved_context?.layers?.visual_language?.camera_grammar ?? [];
  const explicitMenuProfile = input.directing_profile && input.directing_profile !== "auto"
    ? input.directing_profile
    : "";
  if (explicitMenuProfile) {
    const contextMatchesMenu = profile?.camera_profile_id === explicitMenuProfile;
    return {
      mode: "selected_menu_profile",
      selected_profile_id: explicitMenuProfile,
      locked_grammar: contextMatchesMenu
        ? grammar
        : input.camera_profile_custom?.trim()
          ? [input.camera_profile_custom.trim()]
          : [],
      edit_rhythm: contextMatchesMenu ? profile?.edit_rhythm ?? "" : "",
      rationale: contextMatchesMenu
        ? "The locked production profile confirms the explicit directing menu selection; its compiled Context grammar is binding."
        : "The explicit directing menu selection outranks missing or stale compiled context; do not substitute another camera profile.",
    };
  }
  if (grammar.length > 0 || profile?.camera_profile_id) {
    return {
      mode: "locked_context_grammar",
      selected_profile_id: profile?.camera_profile_id || "context-defined",
      locked_grammar: grammar,
      edit_rhythm: profile?.edit_rhythm ?? "",
      rationale: "Context IR and its production profile already compile the menu, genre and custom camera data; generic smoothness or variety cannot replace them.",
    };
  }
  if (input.camera_profile_custom?.trim()) {
    return {
      mode: "selected_menu_profile",
      selected_profile_id: "custom",
      locked_grammar: input.camera_profile_custom?.trim() ? [input.camera_profile_custom.trim()] : [],
      edit_rhythm: "",
      rationale: "The explicit directing menu/custom instruction is binding while Context IR is unavailable.",
    };
  }
  return {
    mode: "derive_without_forced_recipe",
    selected_profile_id: "auto",
    locked_grammar: [],
    edit_rhythm: "",
    rationale: "Derive camera implementation from story facts, genre and Scene Intent; do not force smoothness, movement variety or a default shot recipe.",
  };
}

function actionSelection(input: StoryboardRulePacketInput): ActiveStoryboardRulePacket["action"] {
  const budget = input.resolved_context?.layers?.motion_continuity?.action_budget?.trim() ?? "";
  return budget
    ? { mode: "locked_context_budget", locked_budget: budget, rationale: "Use the exact Context IR action budget. Every gesture must serve Scene Intent or a causal state change; intentional stillness remains valid." }
    : { mode: "intent_led_safe_budget", locked_budget: "", rationale: "Use only causally necessary, physically feasible action. Do not invent hand business merely because a character is visible." };
}

function buildPromptDigest(packet: Omit<ActiveStoryboardRulePacket, "prompt_digest">): string {
  const dialogue = packet.dialogue.mode === "preserve_user_verbatim"
    ? "MENU MODE — PRESERVE EVERY LINE: preserve the user's supplied dialogue and speaker ownership exactly. Do not elevate, paraphrase, translate, or re-author it; build the technical shot/keyframe plan around those words."
    : packet.dialogue.mode === "use_editorial_revision"
      ? "MENU MODE — CREATIVE POLISH ALREADY APPLIED: Stage 1 has reviewed the original screenplay and produced the selected upgraded hook, narration/dialogue, action, and performance version. Use THAT revised version as the creative authority for the technical shot/keyframe plan; do not revert to the original or perform an uncontrolled second rewrite."
      : packet.dialogue.mode === "use_generated_script"
        ? "CREATIVE SCRIPT ALREADY GENERATED: use the Stage-1 script as the current dialogue and story authority while converting it into the technical shot/keyframe plan."
        : packet.dialogue.mode === "preserve_current_edit"
          ? "CURRENT EDIT IS LOCKED FOR THIS OPERATION: preserve the dialogue currently shown in the scene editor and repair or regenerate only its staging, timing, camera coverage, and physical continuity."
          : packet.dialogue.mode === "editorial_polish"
            ? "MENU MODE — CREATIVE POLISH: review the supplied screenplay and actively improve its opening hook plus only the enabled speech channels. Rewrite weak dialogue/narration with character-specific voice, subtext, rhythm, and payoff while preserving cast, relationships, plot facts, props, causal meaning, and ending."
            : "GENERATIVE DIALOGUE MODE: no approved dialogue text is locked; write only dialogue justified by Scene Intent and the selected audio profile.";
  let visible: string;
  if (packet.visible_text.mode === "verified_brand_only") visible = "VISIBLE TEXT — VERIFIED PRODUCT EXCEPTION ONLY: preserve lettering/logo actually legible in uploaded product reference or approved Product IR. Never invent or redesign branding; forbid all other readable text and overlays.";
  else if (packet.visible_text.mode === "contextual_diegetic_with_verified_brand") visible = `VISIBLE TEXT — LOCKED CONTEXT PLUS VERIFIED PRODUCT: obey the locked diegetic-text policy exactly (${JSON.stringify(packet.visible_text.locked_policy)}), and preserve only verified product branding. No invented words.`;
  else if (packet.visible_text.mode === "contextual_diegetic") visible = `VISIBLE TEXT — LOCKED CONTEXT: obey this diegetic-text policy exactly (${JSON.stringify(packet.visible_text.locked_policy)}). Do not invent words outside it; overlays remain forbidden unless explicitly permitted.`;
  else if (packet.visible_text.mode === "overlay_allowed") visible = `VISIBLE TEXT — EXPLICIT OVERLAY POLICY: obey the locked policy exactly (${JSON.stringify(packet.visible_text.locked_policy)}). Generate no additional wording or graphics beyond that authority.`;
  else visible = "VISIBLE TEXT — FORBIDDEN: generate zero readable text, logos, labels, captions, titles, HUD, or overlays in video frames.";
  const hook = packet.hook.mode === "required_by_menu"
    ? `HOOK — REQUIRED BY EXPLICIT MENU (${packet.hook.evidence.join(", ")}): earn attention immediately, but derive the hook form from the selected Story Format, approved story and Scene Intent. A sensory, emotional, factual, narrative or product-proof opening is valid; never force generic clickbait.`
    : "HOOK — INTENT GATED: there is no universal 3-5 second hook requirement. Preserve the approved opening and enable a formal hook only when Project Intent, Scene Intent or the current script requires it.";
  const clip = `CLIP/EDIT SCOPE: every generated clip is one physically continuous take. Inter-clip continuity mode=${JSON.stringify(packet.clip_execution.continuity_mode)}; allowed boundary transitions=${JSON.stringify(packet.clip_execution.allowed_transition_modes)}. A montage, time jump, scene cut or parallel edit belongs at a declared clip boundary; inherit prior physical state only for mode=continuous.`;
  const camera = packet.camera.mode === "derive_without_forced_recipe"
    ? "CAMERA — DERIVE FROM INPUT: use story facts, genre and Scene Intent. Do not impose smooth movement, forced variety or a default camera recipe."
    : `CAMERA — SELECTED AUTHORITY: profile=${JSON.stringify(packet.camera.selected_profile_id)}; Context camera grammar=${JSON.stringify(packet.camera.locked_grammar)}; edit rhythm=${JSON.stringify(packet.camera.edit_rhythm)}. Follow these selections exactly; do not replace them with generic smoothness or forced variation.`;
  const action = packet.action.mode === "locked_context_budget"
    ? `ACTION BUDGET — LOCKED CONTEXT: ${JSON.stringify(packet.action.locked_budget)}. Spend motion only on Scene Intent, causal state changes and required performance. Intentional stillness is valid; never add decorative hand business.`
    : "ACTION BUDGET — INTENT LED: stage only causally necessary, physically feasible movement. Intentional stillness is valid; never invent hand business merely because a character is visible.";
  return [
    "ACTIVE RULE PACKET V3 — FINAL CONFLICT RESOLUTION",
    "INPUT FIDELITY (HIGHEST OPERATING PRINCIPLE): obey every explicit menu selection, uploaded reference, approved/current script fact, locked Context IR value and user instruction. This packet resolves implementation conflicts only; it may never replace input facts with a preferred template.",
    `- ${dialogue}`, `- ${visible}`, `- ${hook}`, `- ${clip}`, `- ${camera}`, `- ${action}`,
    `- Active rule ids: ${packet.active_rule_ids.join(", ") || "none"}`,
    `- Suppressed conflicting rule ids: ${packet.suppressed_rule_ids.join(", ") || "none"}`,
  ].join("\n");
}

export function buildActiveStoryboardRulePacket(input: StoryboardRulePacketInput, options: { stage?: StoryboardRuleStage } = {}): ActiveStoryboardRulePacket {
  const stage = options.stage ?? "generation"; const hasSource = Boolean(input.source_script?.trim()); let dialogueMode: DialogueAuthorityMode;
  if (stage !== "generation") dialogueMode = "preserve_current_edit";
  else if (input.source_script_revision === "editorial_revision") dialogueMode = "use_editorial_revision";
  else if (input.source_script_revision === "generated_script") dialogueMode = "use_generated_script";
  else if ((input.source_script_revision === "user_verbatim" && input.script_treatment !== "polish") || (hasSource && input.script_treatment !== "polish")) dialogueMode = "preserve_user_verbatim";
  else if (input.script_treatment === "polish") dialogueMode = "editorial_polish";
  else dialogueMode = "generate";
  const candidates: RuleConflictCandidate[] = []; const selected: string[] = [];
  const usesCurrent = ["preserve_user_verbatim", "use_editorial_revision", "use_generated_script", "preserve_current_edit"].includes(dialogueMode);
  if (usesCurrent) { candidates.push(candidate("storyboard.dialogue.verbatim", "approved_script"), candidate("storyboard.dialogue.reauthor", "style_preference")); selected.push("storyboard.dialogue.verbatim"); }
  else if (dialogueMode === "editorial_polish") candidates.push(candidate("storyboard.dialogue.reauthor", "style_preference"));

  const hook = hookSelection(input);
  candidates.push(
    candidate("storyboard.hook.always_first_clip", "style_preference"),
    candidate("storyboard.hook.required_by_selection", "user_selection"),
    candidate("storyboard.hook.intent_gated", "scene_intent")
  );
  selected.push(
    hook.mode === "required_by_menu"
      ? "storyboard.hook.required_by_selection"
      : "storyboard.hook.intent_gated"
  );

  const clipExecution = clipExecutionSelection(input);
  candidates.push(
    candidate("storyboard.clip.continuous_take", "production_state"),
    candidate("storyboard.editing.context_mode", "locked_context")
  );

  const camera = cameraSelection(input);
  const cameraAuthority = input.directing_profile && input.directing_profile !== "auto"
    ? "user_selection"
    : camera.mode === "locked_context_grammar"
      ? "locked_context"
      : "scene_intent";
  candidates.push(
    candidate("storyboard.camera.context_grammar", cameraAuthority),
    candidate("storyboard.camera.smooth_minimal", "style_preference"),
    candidate("storyboard.camera.forced_variety", "style_preference")
  );
  selected.push("storyboard.camera.context_grammar");

  const action = actionSelection(input);
  candidates.push(
    candidate("storyboard.action.selective_budget", action.mode === "locked_context_budget" ? "locked_context" : "scene_intent"),
    candidate("storyboard.performance.forced_business", "style_preference")
  );
  selected.push("storyboard.action.selective_budget");

  const lockedPolicy = input.resolved_context?.layers?.ontology?.visible_text_policy?.trim() ?? "";
  const overlayPolicy = input.resolved_context?.layers?.visual_language?.text_overlay_policy?.trim() ?? "";
  const effectiveTextPolicy = [lockedPolicy, overlayPolicy].filter(Boolean).join("; ");
  const contextAllowsDiegetic = Boolean(lockedPolicy) && !isExplicitTextBan(lockedPolicy); const contextAllowsOverlay = allowsOverlay(overlayPolicy); const contextAllowsText = contextAllowsDiegetic || contextAllowsOverlay; const verifiedProduct = hasVerifiedProductReference(input);
  candidates.push(candidate("storyboard.visible_text.forbid_all", "negative_prompt"));
  if (contextAllowsText) { candidates.push(candidate("storyboard.visible_text.context_policy", "locked_context")); selected.push("storyboard.visible_text.context_policy"); }
  if (verifiedProduct) { candidates.push(candidate("storyboard.product.exact_label_lock", "user_reference")); selected.push("storyboard.product.exact_label_lock"); }
  const result = resolveRuleConflicts(candidates, selected);
  const visibleTextMode: VisibleTextMode = contextAllowsOverlay ? "overlay_allowed" : contextAllowsText && verifiedProduct ? "contextual_diegetic_with_verified_brand" : contextAllowsText ? "contextual_diegetic" : verifiedProduct ? "verified_brand_only" : "forbid_all";
  const without: Omit<ActiveStoryboardRulePacket, "prompt_digest"> = {
    version: "3.0", stage,
    dialogue: { mode: dialogueMode, rationale: dialogueMode === "preserve_user_verbatim" ? "Menu selected preservation." : dialogueMode === "use_editorial_revision" ? "Menu-selected creative revision was completed upstream." : dialogueMode === "use_generated_script" ? "Stage 1 generated the script before technical planning." : dialogueMode === "preserve_current_edit" ? "Editor owns current dialogue." : dialogueMode === "editorial_polish" ? "Menu selects creative revision and no completed revision is attached." : "Dialogue follows Scene Intent and audio profile." },
    visible_text: { mode: visibleTextMode, locked_policy: effectiveTextPolicy, has_verified_product_reference: verifiedProduct, rationale: contextAllowsText ? "Locked Context IR selects permitted scope." : verifiedProduct ? "Verified product truth overrides suppression only on the referenced surface." : "No higher-authority text permission exists." },
    hook,
    clip_execution: clipExecution,
    camera,
    action,
    active_rule_ids: result.active.map((entry) => entry.rule.id).sort(), suppressed_rule_ids: result.suppressed.map((entry) => entry.rule.id).sort(), conflict_resolutions: result.resolutions, unresolved_conflicts: result.unresolved,
  };
  return { ...without, prompt_digest: buildPromptDigest(without) };
}

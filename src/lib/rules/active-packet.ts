import type { ProductIR } from "../product-ir.ts";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { resolveRuleConflicts, type RuleConflictCandidate } from "./conflict-resolver.ts";
import { STORYBOARD_PROMPT_RULE_INVENTORY, type PromptRuleInventoryEntry } from "./prompt-inventory.ts";

export type StoryboardRuleStage = "generation" | "segment_rewrite" | "repair";
export type DialogueAuthorityMode = "preserve_user_verbatim" | "use_editorial_revision" | "use_generated_script" | "preserve_current_edit" | "editorial_polish" | "generate";
export type VisibleTextMode = "forbid_all" | "verified_brand_only" | "contextual_diegetic" | "contextual_diegetic_with_verified_brand" | "overlay_allowed";
interface RulePacketImageReference { images?: readonly string[]; isReference?: boolean; }
export interface StoryboardRulePacketInput {
  source_script?: string;
  script_treatment?: "preserve" | "polish";
  source_script_revision?: "user_verbatim" | "editorial_revision" | "generated_script";
  product_images?: readonly RulePacketImageReference[];
  product_ir?: ProductIR;
  resolved_context?: ResolvedVideoContext;
}
export interface ActiveStoryboardRulePacket {
  version: "2.0";
  stage: StoryboardRuleStage;
  dialogue: { mode: DialogueAuthorityMode; rationale: string; };
  visible_text: { mode: VisibleTextMode; locked_policy: string; has_verified_product_reference: boolean; rationale: string; };
  active_rule_ids: string[];
  suppressed_rule_ids: string[];
  conflict_resolutions: ReturnType<typeof resolveRuleConflicts>["resolutions"];
  unresolved_conflicts: ReturnType<typeof resolveRuleConflicts>["unresolved"];
  prompt_digest: string;
}
const INVENTORY_BY_ID = new Map(STORYBOARD_PROMPT_RULE_INVENTORY.map((entry) => [entry.id, entry]));
function inventoryRule(id: string): PromptRuleInventoryEntry { const rule = INVENTORY_BY_ID.get(id); if (!rule) throw new Error(`Missing storyboard prompt rule inventory entry: ${id}`); return rule; }
function candidate(id: string, authority: RuleConflictCandidate["authority"]): RuleConflictCandidate { return { rule: inventoryRule(id), authority }; }
export function isPromptRuleRouterV2Enabled(value: string | undefined = process.env.PROMPT_RULE_ROUTER_V2): boolean { return ["1", "true", "on", "yes"].includes(value?.trim().toLowerCase() ?? ""); }
function isExplicitTextBan(policy: string): boolean { const value = policy.trim().toLowerCase(); return Boolean(value) && /\b(none|forbid(?:den)?|disallow(?:ed)?|zero readable|no readable|blur(?:red)?)\b/.test(value); }
function allowsOverlay(policy: string): boolean { const value = policy.trim().toLowerCase(); return !isExplicitTextBan(value) && /\b(overlay|caption|subtitle|title card)\b/.test(value) && /\b(allow(?:ed)?|permit(?:ted)?|require(?:d)?|yes)\b/.test(value); }
function hasVerifiedProductReference(input: StoryboardRulePacketInput): boolean { return input.product_ir?.review_status === "approved" || (input.product_images ?? []).some((entry) => (entry.images?.length ?? 0) > 0 || entry.isReference === true); }

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
  return ["ACTIVE RULE PACKET V2 — FINAL CONFLICT RESOLUTION", "These resolved policies override conflicting generic legacy prose but never override user facts or schema requirements.", `- ${dialogue}`, `- ${visible}`, `- Active rule ids: ${packet.active_rule_ids.join(", ") || "none"}`, `- Suppressed conflicting rule ids: ${packet.suppressed_rule_ids.join(", ") || "none"}`].join("\n");
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
  const lockedPolicy = input.resolved_context?.layers.ontology.visible_text_policy?.trim() ?? "";
  const overlayPolicy = input.resolved_context?.layers.visual_language.text_overlay_policy?.trim() ?? "";
  const effectiveTextPolicy = [lockedPolicy, overlayPolicy].filter(Boolean).join("; ");
  const contextAllowsDiegetic = Boolean(lockedPolicy) && !isExplicitTextBan(lockedPolicy); const contextAllowsOverlay = allowsOverlay(overlayPolicy); const contextAllowsText = contextAllowsDiegetic || contextAllowsOverlay; const verifiedProduct = hasVerifiedProductReference(input);
  candidates.push(candidate("storyboard.visible_text.forbid_all", "negative_prompt"));
  if (contextAllowsText) { candidates.push(candidate("storyboard.visible_text.context_policy", "locked_context")); selected.push("storyboard.visible_text.context_policy"); }
  if (verifiedProduct) { candidates.push(candidate("storyboard.product.exact_label_lock", "user_reference")); selected.push("storyboard.product.exact_label_lock"); }
  const result = resolveRuleConflicts(candidates, selected);
  const visibleTextMode: VisibleTextMode = contextAllowsOverlay ? "overlay_allowed" : contextAllowsText && verifiedProduct ? "contextual_diegetic_with_verified_brand" : contextAllowsText ? "contextual_diegetic" : verifiedProduct ? "verified_brand_only" : "forbid_all";
  const without: Omit<ActiveStoryboardRulePacket, "prompt_digest"> = {
    version: "2.0", stage,
    dialogue: { mode: dialogueMode, rationale: dialogueMode === "preserve_user_verbatim" ? "Menu selected preservation." : dialogueMode === "use_editorial_revision" ? "Menu-selected creative revision was completed upstream." : dialogueMode === "use_generated_script" ? "Stage 1 generated the script before technical planning." : dialogueMode === "preserve_current_edit" ? "Editor owns current dialogue." : dialogueMode === "editorial_polish" ? "Menu selects creative revision and no completed revision is attached." : "Dialogue follows Scene Intent and audio profile." },
    visible_text: { mode: visibleTextMode, locked_policy: effectiveTextPolicy, has_verified_product_reference: verifiedProduct, rationale: contextAllowsText ? "Locked Context IR selects permitted scope." : verifiedProduct ? "Verified product truth overrides suppression only on the referenced surface." : "No higher-authority text permission exists." },
    active_rule_ids: result.active.map((entry) => entry.rule.id).sort(), suppressed_rule_ids: result.suppressed.map((entry) => entry.rule.id).sort(), conflict_resolutions: result.resolutions, unresolved_conflicts: result.unresolved,
  };
  return { ...without, prompt_digest: buildPromptDigest(without) };
}

import type { RuleDefinition } from "./types";

export interface RuleSelectionContext {
  projectPurpose?: string;
  videoGoal?: string;
  genre?: string;
  realityMode?: string;
  continuityMode?: string;
  activeProfiles?: string[];
}

const MARKETING_GOALS = new Set([
  "marketing_general",
  "product_ad",
  "brand_story",
  "social_short",
  "testimonial",
  "promo_sale",
  "review",
]);

export function isMarketingLed(context: RuleSelectionContext): boolean {
  if (context.videoGoal && MARKETING_GOALS.has(context.videoGoal)) return true;
  return /(sell|sale|market|advert|conversion|lead|brand campaign|promotion|social engagement)/i.test(
    context.projectPurpose ?? ""
  );
}

/** Deterministic profile selection; no LLM may activate a rule implicitly. */
export function selectRules(
  definitions: readonly RuleDefinition[],
  context: RuleSelectionContext
): RuleDefinition[] {
  const active = new Set(context.activeProfiles ?? []);
  return definitions.filter((rule) => {
    if (rule.profile === "all_projects") return true;
    if (rule.profile === "short_form_marketing") return isMarketingLed(context);
    return active.has(rule.profile);
  });
}

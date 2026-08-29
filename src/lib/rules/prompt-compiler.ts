export interface CompiledStoryboardSystemPrompt {
  prompt: string;
  removed_rule_ids: string[];
}

interface LegacyRuleTransform {
  rule_id: string;
  patterns: readonly RegExp[];
}

/**
 * Exact, line-scoped migrations for legacy global prose. These expressions are
 * deliberately narrow: a router decision may remove only the sentence(s)
 * owned by that rule id, never a neighbouring production contract.
 */
const LEGACY_RULE_TRANSFORMS: readonly LegacyRuleTransform[] = [
  {
    rule_id: "storyboard.hook.always_first_clip",
    patterns: [
      /^- Clip 1 ALWAYS owns a 3-5 second Hook Window,.*\n/gm,
      /^- For videos lasting 30s or longer, clips 1-3 form a RETENTION LADDER:.*\n/gm,
      /^- ⏱️ FIRST 2-3 SECONDS DECIDE EVERYTHING \(every genre, not just hooks\):.*\n/gm,
    ],
  },
  {
    rule_id: "storyboard.visible_text.forbid_all",
    patterns: [
      /^- VIDEO OUTPUT TEXT CONTRACT \(NON-NEGOTIABLE\): every generated VIDEO frame contains ZERO readable text or graphics\..*\n/gm,
    ],
  },
  {
    rule_id: "storyboard.camera.smooth_minimal",
    patterns: [
      /^- Camera moves are smooth and minimal \(a slow push-in or gentle pan\)\..*\n/gm,
    ],
  },
  {
    rule_id: "storyboard.camera.forced_variety",
    patterns: [
      /^- 🎬 CAMERA VARIETY ACROSS CLIPS:.*\n/gm,
    ],
  },
  {
    rule_id: "storyboard.performance.forced_business",
    patterns: [
      /^- ✋ CHARACTER BUSINESS:.*\n/gm,
    ],
  },
  {
    rule_id: "storyboard.dialogue.reauthor",
    patterns: [
      /^- DIALOGUE QUALITY DOCTRINE \(MANDATORY — the user's #1 priority\):.*\n/gm,
      /^- NEVER FAKE A LINE:.*\n/gm,
    ],
  },
] as const;

export function compileStoryboardSystemPrompt(
  legacyPrompt: string,
  suppressedRuleIds: readonly string[] = []
): CompiledStoryboardSystemPrompt {
  if (suppressedRuleIds.length === 0) {
    return { prompt: legacyPrompt, removed_rule_ids: [] };
  }
  const suppressed = new Set(suppressedRuleIds);
  const removedRuleIds: string[] = [];
  let prompt = legacyPrompt;

  for (const transform of LEGACY_RULE_TRANSFORMS) {
    if (!suppressed.has(transform.rule_id)) continue;
    const before = prompt;
    for (const pattern of transform.patterns) prompt = prompt.replace(pattern, "");
    if (prompt !== before) removedRuleIds.push(transform.rule_id);
  }

  return {
    prompt: removedRuleIds.length > 0 ? prompt.replace(/\n{4,}/g, "\n\n\n") : legacyPrompt,
    removed_rule_ids: removedRuleIds.sort(),
  };
}

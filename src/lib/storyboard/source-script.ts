const INLINE_LABELLED_DIALOGUE =
  /^\s*[\p{L}\p{N}][\p{L}\p{N}\s._-]{0,39}:[ \t]*(?:["“][^"”\n]+["”]|[^:\n]{4,})[ \t]*$/gmu;
const NEXT_LINE_LABELLED_DIALOGUE =
  /^\s*[\p{L}\p{N}][\p{L}\p{N}\s._-]{0,39}:[ \t]*\r?\n[ \t]*["“][^"”\n]+["”][ \t]*$/gmu;

/**
 * A pasted screenplay is already approved creative text. Detect it
 * conservatively so the pipeline can skip a paid "rewrite the script" call and
 * move straight to Context IR + technical storyboard expansion.
 */
export function approvedScriptFromStoryIdea(
  storyIdea: string
): string | null {
  const script = storyIdea.trim();
  if (script.length < 500) return null;

  const labelledDialogueCount =
    [...script.matchAll(INLINE_LABELLED_DIALOGUE)].length +
    [...script.matchAll(NEXT_LINE_LABELLED_DIALOGUE)].length;
  const explicitScriptHeading =
    /(?:^|\n)\s*(?:kịch bản|kich ban|screenplay|script)\s*:/imu.test(script);
  const hasSceneAction =
    /(?:^|\n)\s*(?:tiếng|cảnh|ngoại|nội|một lúc sau|sau đó|cut to|fade in|fade out)\b/imu.test(
      script
    );

  if (labelledDialogueCount >= 2 && (explicitScriptHeading || hasSceneAction)) {
    return script;
  }
  return null;
}

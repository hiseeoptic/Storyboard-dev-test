import type {
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
} from "../../types/index.ts";

const UNSOLICITED_ENGAGEMENT_CTA =
  /(?:\b(?:follow|subscribe|comment|share|tell me|what about you|how will you|will you)\b|(?:theo dõi|đăng ký|bình luận|chia sẻ|còn bạn|bạn sẽ|hãy cho biết|hãy kể|như thế nào))/iu;

export function stripUnrequestedNarrationCta(text: string, source: string): string {
  const sourceFolded = source.replace(/\s+/g, " ").toLocaleLowerCase();
  const sentences = text.match(/[^.!?…]+[.!?…]*/gu) ?? [text];
  const kept = sentences.filter((sentence) => {
    const clean = sentence.trim();
    if (!clean || !UNSOLICITED_ENGAGEMENT_CTA.test(clean)) return true;
    const normalized = clean
      .replace(/[.!?…]+$/u, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
    return normalized.length > 0 && sourceFolded.includes(normalized);
  });
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/** Apply the narrator-only menu choice as deterministic structure after every
 * model/repair response. This is not a validator and makes no API call. */
export function enforceAnonymousNarrationContract(
  input: StoryboardGenerationInput,
  breakdown: StoryboardGenerationOutput,
  options: { preserveCurrentText?: boolean } = {}
): void {
  if (!input.anonymous_narration) return;
  const source = input.story_idea ?? "";
  for (const segment of breakdown.segments) {
    const turns = (segment.dialogue_lines ?? [])
      .map((turn) => ({
        ...turn,
        speaker: "",
        delivery: "voiceover" as const,
        camera_beat: undefined,
        text: options.preserveCurrentText
          ? (turn.text ?? "").trim()
          : stripUnrequestedNarrationCta(turn.text ?? "", source),
      }))
      .filter((turn) => turn.text);
    segment.dialogue_lines = turns.length > 0 ? turns : undefined;
    segment.dialogue = turns[0]?.text ?? "";
    segment.speaker = "";
  }
}

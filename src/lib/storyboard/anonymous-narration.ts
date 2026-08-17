import type {
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
} from "../../types/index.ts";

const UNSOLICITED_ENGAGEMENT_CTA =
  /(?:\b(?:follow|subscribe|comment|share|tell me|what about you|how will you|will you)\b|(?:theo dõi|đăng ký|bình luận|chia sẻ|còn bạn|bạn sẽ|hãy cho biết|hãy kể|như thế nào))/iu;

export interface SpeechModeContract {
  voice_over: boolean;
  character_dialogue: boolean;
  anonymous_characters: boolean;
  mode: "mixed" | "voice_over_only" | "character_dialogue_only" | "wordless";
}

export interface SpeechManifestContract {
  mode: SpeechModeContract["mode"];
  voice_over_enabled: boolean;
  character_dialogue_enabled: boolean;
  anonymous_characters: boolean;
  narrator_voice_style?: string;
  character_dialogue_style?: string;
  music_enabled: boolean;
  ambience_enabled: boolean;
  foley_enabled: boolean;
}

/** Resolve the new independent menu without breaking stored legacy projects. */
export function resolveSpeechMode(
  input: Pick<
    StoryboardGenerationInput,
    | "voice_over_enabled"
    | "character_dialogue_enabled"
    | "anonymous_characters"
    | "anonymous_narration"
  >
): SpeechModeContract {
  const legacyNarrationOnly = input.anonymous_narration === true;
  const voiceOver = input.voice_over_enabled ?? legacyNarrationOnly;
  const characterDialogue =
    input.character_dialogue_enabled ?? !legacyNarrationOnly;
  const anonymousCharacters =
    input.anonymous_characters ?? legacyNarrationOnly;
  return {
    voice_over: voiceOver,
    character_dialogue: characterDialogue,
    anonymous_characters: anonymousCharacters,
    mode: voiceOver
      ? characterDialogue
        ? "mixed"
        : "voice_over_only"
      : characterDialogue
        ? "character_dialogue_only"
        : "wordless",
  };
}

/** Serialize the menu choice once for manifest consumers. This deliberately
 * contains only compact settings, never duplicated prose instructions. */
export function buildSpeechManifestContract(
  input: Pick<
    StoryboardGenerationInput,
    | "voice_over_enabled"
    | "character_dialogue_enabled"
    | "anonymous_characters"
    | "anonymous_narration"
    | "narrator_voice_style"
    | "character_dialogue_style"
    | "tone"
    | "music_enabled"
    | "ambience_enabled"
    | "foley_enabled"
  >
): SpeechManifestContract {
  const mode = resolveSpeechMode(input);
  return {
    mode: mode.mode,
    voice_over_enabled: mode.voice_over,
    character_dialogue_enabled: mode.character_dialogue,
    anonymous_characters: mode.anonymous_characters,
    narrator_voice_style: input.narrator_voice_style?.trim() || undefined,
    character_dialogue_style:
      input.character_dialogue_style?.trim() || input.tone?.trim() || undefined,
    music_enabled: input.music_enabled !== false,
    ambience_enabled: input.ambience_enabled !== false,
    foley_enabled: input.foley_enabled !== false,
  };
}

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
  const speech = resolveSpeechMode(input);
  if (speech.mode === "mixed") {
    // Normalize ownership only. Narrator and character voices remain separate;
    // the shared dialogue clock prevents overlap downstream.
    for (const segment of breakdown.segments) {
      const turns = (segment.dialogue_lines ?? []).map((turn) => ({
        ...turn,
        speaker: (turn.speaker ?? "").trim(),
        delivery: (turn.speaker ?? "").trim()
          ? turn.delivery === "off_screen"
            ? ("off_screen" as const)
            : ("on_screen" as const)
          : ("voiceover" as const),
        camera_beat: (turn.speaker ?? "").trim()
          ? turn.camera_beat
          : undefined,
      }));
      segment.dialogue_lines = turns.length > 0 ? turns : undefined;
    }
    return;
  }

  if (speech.mode === "wordless") {
    for (const segment of breakdown.segments) {
      segment.dialogue_lines = undefined;
      segment.dialogue = "";
      segment.speaker = "";
    }
    return;
  }

  if (speech.mode === "character_dialogue_only") {
    for (const segment of breakdown.segments) {
      const turns = (segment.dialogue_lines ?? []).filter(
        (turn) =>
          (turn.speaker ?? "").trim() && turn.delivery !== "voiceover"
      );
      segment.dialogue_lines = turns.length > 0 ? turns : undefined;
      segment.dialogue = turns[0]?.text ?? "";
      segment.speaker = turns[0]?.speaker ?? "";
    }
    return;
  }

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

// ============================================================
// LONG VIDEO — a 2–3 minute story (12–18 clips of 10 s) written in parts.
//
// One storyboard call cannot hold 15+ rich clips: the model's output budget
// truncates the JSON tail, and the server action stops at 300 s. So the first
// request writes clips 1–8 with every global lock of the WHOLE story
// (characters, location blueprints, scene bible), and each following request
// (its own 300 s budget) writes the next five clips, continuing exactly from
// the previous clip's end state. Videos of up to 10 clips are unchanged.
// ============================================================
import type { StoryboardGenerationInput, StoryboardGenerationOutput, VideoSegment } from "@/types";
import { familyActPlan, familyLessonOf, normalizeFamilyDrama } from "../family/family-drama.ts";
import { normalizeOfficeDrama, officeActPlan, officeLessonOf } from "../workplace/office-drama.ts";
import { normalizeQuoteStory, quoteActPlan, quoteOf } from "../quotes/quote-story.ts";

/** The drama configs a long video can follow ("Chuyện nhà", "Chuyện công sở"). */
type DramaInput = Pick<StoryboardGenerationInput, "family_drama" | "office_drama" | "quote_story">;

/** Videos up to this many clips are still written in ONE request, exactly as before. */
export const LONG_THRESHOLD = 10;
export const LONG_FIRST_PART = 8;
export const LONG_NEXT_PART = 5;

/** The full clip count when the video must be written in parts (more than 10 clips), else 0. */
export function longVideoTotal(input: Pick<StoryboardGenerationInput, "segment_count" | "scene_count">): number {
  const total = Number(input.segment_count ?? input.scene_count ?? 0);
  return Number.isInteger(total) && total > LONG_THRESHOLD ? total : 0;
}

/** What one clip must do in the whole story (family drama act plan when there is one). */
export function clipPurpose(input: DramaInput, clip: number, total: number): string {
  const family = normalizeFamilyDrama(input.family_drama);
  if (family) {
    const slot = familyActPlan(total).find((s) => clip >= s.from && clip <= s.to);
    const lesson = familyLessonOf(family);
    if (slot) {
      const detail =
        slot.act === "lesson" && lesson ? ` The technique to act out: ${lesson.lesson}.`
          : slot.act === "awakening" && lesson ? ` The awakening: ${lesson.awakening}.`
            : slot.act === "climax" && lesson ? ` The climax: ${lesson.climax}.`
              : slot.act === "turning" && lesson ? ` The turning point: ${lesson.turning}.`
                : slot.act === "rising" && lesson ? ` The escalation: ${lesson.conflict}.`
                  : "";
      return `${slot.label_vi.toUpperCase()} (clips ${slot.from}–${slot.to}) — ${slot.purpose_en}.${detail}`;
    }
  }
  // "Chuyện công sở": the same four movements, with the workplace case.
  const office = normalizeOfficeDrama(input.office_drama);
  if (office) {
    const slot = officeActPlan(total).find((s) => clip >= s.from && clip <= s.to);
    const lesson = officeLessonOf(office);
    if (slot) {
      const detail =
        slot.act === "lesson" && lesson ? ` The practice to act out: ${lesson.lesson}.`
          : slot.act === "awakening" && lesson ? ` The awakening: ${lesson.awakening}.`
            : slot.act === "climax" && lesson ? ` The climax: ${lesson.climax}.`
              : slot.act === "turning" && lesson ? ` The turning point: ${lesson.turning}.`
                : slot.act === "rising" && lesson ? ` The escalation: ${lesson.conflict}.`
                  : "";
      return `${slot.label_vi.toUpperCase()} (clips ${slot.from}–${slot.to}) — ${slot.purpose_en}.${detail}`;
    }
  }
  // "Lời xưa – Chuyện nay": the saying's six beats.
  const quote = normalizeQuoteStory(input.quote_story);
  if (quote) {
    const entry = quoteOf(quote);
    const slot = quoteActPlan(total, entry).find((s) => clip >= s.from && clip <= s.to);
    if (slot) {
      const detail =
        slot.act === "saying" && entry ? ` Speak the saying VERBATIM: «${entry.text}».`
          : slot.act === "awakening" && entry ? ` The awakening: ${entry.awakening}.`
            : slot.act === "turning" && entry ? ` The turning point: ${entry.turning}.`
              : slot.act === "rising" && entry ? ` The mistake: ${entry.mistake}.`
                : "";
      return `${slot.label_vi.toUpperCase()} (clips ${slot.from}–${slot.to}) — ${slot.purpose_en}.${detail}`;
    }
  }
  if (clip === total) return "the final clip: the story's resolution and closing image";
  return "continue the approved script beat by beat";
}

/** Extra instruction for the FIRST request of a long video. */
export function longVideoFirstPartDirective(input: DramaInput, total: number, written = LONG_FIRST_PART): string {
  return [
    `LONG VIDEO — PART 1 OF A ${total}-CLIP STORY (≈ ${total * 10} s): the approved story has ${total} clips of 10 s. This request writes ONLY clips 1–${written}; the remaining clips are written in later requests that continue from clip ${written}'s end state.`,
    `- Do NOT compress the whole story into ${written} clips and do NOT end it: clip ${written} ends mid-story and leads into clip ${written + 1} (${clipPurpose(input, written + 1, total)}).`,
    `- character_locks, location_blueprints, scene_bible, thumbnail_title and social_posts cover the WHOLE ${total}-clip story: every character and every place that appears in ANY clip, so later parts reuse them unchanged.`,
    `- total_duration_seconds = ${total * 10} (the whole video).`,
  ].join("\n");
}

/** The next range to write, or null when the video is complete. */
export function nextLongVideoRange(breakdown: Pick<StoryboardGenerationOutput, "segments">, total: number): { from: number; to: number } | null {
  const from = (breakdown.segments?.length ?? 0) + 1;
  if (from > total) return null;
  return { from, to: Math.min(total, from + LONG_NEXT_PART - 1) };
}

/** Placeholder segments for the range; the targeted segment writer fills them in. */
export function stubSegments(
  breakdown: StoryboardGenerationOutput,
  input: DramaInput,
  from: number,
  to: number,
  total: number
): VideoSegment[] {
  const last = breakdown.segments[breakdown.segments.length - 1];
  const out: VideoSegment[] = [];
  for (let n = from; n <= to; n++) {
    out.push({
      ...(last ? {
        location_id: last.location_id,
        environment_ref: last.environment_ref,
        characters_in_scene: [...(last.characters_in_scene ?? [])],
        ...(last.state_ledger ? { state_ledger: { start: last.state_ledger.end ?? [], changes: [], end: last.state_ledger.end ?? [] } } : {}),
      } : {}),
      segment_number: n,
      duration_seconds: 10,
      title: `Clip ${n} — ${clipPurpose(input, n, total).split(" — ")[0]}`,
      marketing_role: n === total ? "cta" : "body",
      beats: [],
      first_frame_prompt: "",
      motion_prompt: "",
      dialogue: "",
      continuity_mode: "continuous",
      continuity_note: "",
    } as unknown as VideoSegment);
  }
  return out;
}

/** The "write these clips" findings handed to the targeted segment writer. */
export function longVideoFindings(input: DramaInput, from: number, to: number, total: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    return {
      code: "LONG-001",
      severity: "critical" as const,
      scope: "segment" as const,
      segment_number: n,
      message: `Clip ${n} of ${total} is NOT WRITTEN YET. Write it completely with the full segment structure (beats with shot_size/move, first_frame_prompt, motion_prompt, dialogue_lines, characters_in_scene, location_id, transition_in, state_ledger with hand/touches, spatial_layout when needed, continuity_note). Its job in the story: ${clipPurpose(input, n, total)}`,
      evidence: `Continue exactly from the previous clip's end state (people, props, light, place); use only the locked characters and location blueprints; ${n === total ? "this is the FINAL clip — resolve the story and close on the ending image." : `the story is not over yet — clip ${n} leads into clip ${n + 1}.`}`,
    };
  });
}

/** A written segment is usable when it has a start state, an action and beats. */
export function isWrittenSegment(segment: Partial<VideoSegment> | undefined): boolean {
  return Boolean(
    segment &&
      String(segment.first_frame_prompt ?? "").trim() &&
      String(segment.motion_prompt ?? "").trim() &&
      Array.isArray(segment.beats) &&
      segment.beats.length > 0
  );
}

/**
 * Append the written clips of [from, to] (in order, numbered), stop at the
 * first clip that came back unwritten, and fix the totals and roles.
 */
export function mergeLongVideoPart(
  breakdown: StoryboardGenerationOutput,
  written: Array<Partial<VideoSegment>>,
  from: number,
  to: number,
  total: number
): StoryboardGenerationOutput {
  const byNumber = new Map(written.map((s) => [Number(s.segment_number), s]));
  const segments = [...breakdown.segments];
  for (let n = from; n <= to; n++) {
    const segment = byNumber.get(n);
    if (!isWrittenSegment(segment)) break;
    segments.push({ ...(segment as VideoSegment), segment_number: n, duration_seconds: Number(segment!.duration_seconds) || 10 });
  }
  // Only the final clip of the WHOLE video carries the closing role.
  segments.forEach((segment, index) => {
    if (index < total - 1 && segment.marketing_role === "cta") segment.marketing_role = "body";
  });
  return {
    ...breakdown,
    segments,
    total_duration_seconds: segments.reduce((sum, s) => sum + (Number(s.duration_seconds) || 10), 0),
  };
}

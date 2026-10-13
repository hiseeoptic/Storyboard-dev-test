// ============================================================
// WRITERS' ROOM PROMPTS — every turn returns ONE JSON object so the chat can
// render cards (analysis, plan options, a shot table, an evaluation) instead
// of free prose. The script is always written as 10-second shots: one row is
// one Omni Flash clip with ONE continuous action and a spoken-word budget the
// clip can actually carry.
// ============================================================
import type { BookAnalysis, Faithfulness, PlanOption, RoomScript, RoomState, ShotLine } from "./types.ts";

export const ROOM_GENRES = [
  "drama", "comedy", "sitcom", "romance", "action", "thriller", "horror", "fantasy", "historical",
  "mythology", "kids", "animation", "documentary", "education", "life_wisdom", "psychology",
  "health", "finance", "tech", "travel", "nature", "lifestyle",
];
export const ROOM_STYLES = [
  "cinematic", "realistic", "anime", "comic", "watercolor", "pencil_sketch", "noir", "3d_render", "pixel_art",
];
export const ROOM_CHARACTER_MEDIA = [
  "generated_human", "illustrated_2d", "stylized_3d", "anthropomorphic_animal", "anthropomorphic_object",
  "whiteboard_stick_figure", "flat_2d_cartoon", "chibi_illustration", "cinematic_cartoon", "claymation", "none",
];

const FAITHFULNESS_RULE: Record<Faithfulness, string> = {
  faithful: "FAITHFUL ADAPTATION: keep the book's events, order, character names and key lines; quote dialogue verbatim where it fits the shot budget, otherwise trim without changing meaning.",
  condensed: "CONDENSED ADAPTATION: keep the core events, characters and message; merge and shorten freely, rewrite lines in natural spoken Vietnamese for short video.",
  reimagined: "REIMAGINED: keep the theme, message and main characters; you may invent new situations, setting or structure that serve a short video.",
};

const SHOT_CONTRACT = `SHOT CONTRACT (each shot = ONE 10-second Omni Flash / Veo clip, the clip cannot cut):
- "action": ONE continuous physical action that fits 10 seconds (what the camera sees), specific body-part + verb + object; never a list of separate actions.
- SPEECH IN EVERY SHOT (unless the plan is wordless): 10–20 spoken Vietnamese words per shot — dialogue and/or narrator voice-over, ≈ 4–8 s of speech (dialogue ≈ 0.4 s/word, narrator ≈ 0.47 s/word), never more than 28 words. Speech plays OVER the action at the same time; never leave a shot silent "so the action can breathe" — a shot without speech loses the viewer and is a script error.
- Clock: every line has start_s/end_s inside 0–10, lines do not overlap, and the last line ends by ~9 s.
- "characters": every person visible in the shot; a speaker who is not visible speaks off-screen.
- Voice-over goes in "voice_over" ({"speaker":"Lời dẫn","text":...}); character lines go in "dialogue".
- "camera": one framing + one move that suits the action (e.g. "[CLOSE] slow push-in").
- HOOK: the first 3 seconds decide whether people keep watching. Shot 1's first spoken line starts at 0–0.5 s and hooks (a question, a conflict, a surprising claim or a promise), said over a striking opening visual; shot 2 keeps the tension with speech too. Every shot advances the story; the last shot lands the message / ending.
- Spoken text is natural Vietnamese; everything else (action, camera, location) is concise Vietnamese too.`;

const SCRIPT_JSON = `{"title":"…","logline":"…","characters":[{"name":"…","age":"…","gender":"…","appearance":"…","personality":"…","role":"…","wardrobe":"…"}],"shots":[{"n":1,"duration_s":10,"location":"…","characters":["…"],"action":"…","dialogue":[{"speaker":"…","text":"…","start_s":0.5,"end_s":3.5}],"voice_over":{"speaker":"Lời dẫn","text":"…","start_s":4,"end_s":8} ,"camera":"…","transition":"…","pages":[1]}]}`;

export const ROOM_SYSTEM_PROMPT = `You are the head writer of a short-video writers' room for Vietnamese creators. You turn books, chapters or ideas into video plans and shot-by-shot scripts made of 10-second AI video clips (Omni Flash / Veo), then evaluate and improve them with the user.
Rules: answer ONLY with the single JSON object requested; Vietnamese for every human-facing text field; never invent facts about a real book that its pages do not support (mark guesses as such); keep characters consistent across shots; respect the user's chosen faithfulness level.`;

const pagesBlock = (state: RoomState, maxChars = 60_000) => {
  const text = state.pages.map((p) => `--- TRANG ${p.index} ---\n${p.text.trim()}`).join("\n\n");
  const idea = state.idea?.trim() ? `\nÝ TƯỞNG / GHI CHÚ CỦA NGƯỜI DÙNG:\n${state.idea.trim()}\n` : "";
  return `${idea}${text ? `\nNỘI DUNG SÁCH (đã đọc từ ảnh):\n${text.slice(0, maxChars)}` : ""}`;
};

const compactAnalysis = (a?: BookAnalysis) => (a ? JSON.stringify({
  book_type: a.book_type, title_guess: a.title_guess, summary: a.summary, themes: a.themes, message: a.message,
  characters: a.characters, settings: a.settings, key_quotes: (a.key_quotes ?? []).slice(0, 6),
}) : "chưa có");

export function analyzePrompt(state: RoomState): string {
  return `TASK: analyse the source and propose 3 different video plans.
${FAITHFULNESS_RULE[state.faithfulness]}
${pagesBlock(state)}

Return JSON:
{"analysis":{"book_type":"fiction|self_help|kids|history|knowledge|review|other","title_guess":"…","summary":"3-5 câu","themes":["…"],"message":"…","characters":[{"name":"…","age":"…","gender":"…","appearance":"…","personality":"…","role":"…","wardrobe":"trang phục hợp bối cảnh","pages":[1]}],"settings":[{"name":"…","description":"…","era":"…"}],"key_quotes":["…"]},
 "options":[{"id":"A","title":"…","format":"adaptation|explainer|kids|documentary|review|other","logline":"…","shot_count":6,"episodes":1,"structure":["Shot 1-2: …","…"],"genre":"one of ${ROOM_GENRES.join("|")}","visual_style":"one of ${ROOM_STYLES.join("|")}","character_representation":"one of ${ROOM_CHARACTER_MEDIA.join("|")}","voice_over":true,"dialogue":true,"camera":"…","why":"vì sao hợp với nội dung này"}],
 "reply":"1-3 câu tiếng Việt chào và tóm tắt bạn đã hiểu gì, mời chọn phương án"}
Plans must differ in format or tone (e.g. dramatised adaptation vs. visual explainer vs. kids animation vs. review). shot_count is the number of 10-second shots (4–12 for one episode); if the material needs more than ~12 shots, set "episodes" > 1 and describe the split.`;
}

/** What the chosen plan allows the characters / narrator to say. */
export function speechModeLine(option?: Pick<PlanOption, "dialogue" | "voice_over">): string {
  if (!option) return "SPEECH: dialogue and/or narrator voice-over in every shot.";
  if (option.dialogue && option.voice_over) {
    return "SPEECH: characters talk on screen in every shot where they appear; the narrator voice-over carries the shots where nobody talks and may deliver the opening hook.";
  }
  if (option.dialogue) {
    return "SPEECH: on-screen dialogue only (no narrator). Every shot needs at least one line — give a character a line, or let one speak from off screen.";
  }
  if (option.voice_over) {
    return "SPEECH: narrator voice-over only (no on-screen dialogue). Every shot carries narration; put it in \"voice_over\".";
  }
  return "SPEECH: this plan is WORDLESS — no dialogue and no narrator; leave \"dialogue\" empty and \"voice_over\" null; music and sound carry the story.";
}

/** Whether the chosen plan has any spoken words at all. */
export const planHasSpeech = (state: RoomState) => {
  const option = state.options?.find((o) => o.id === state.chosenOptionId);
  return option ? option.dialogue || option.voice_over : true;
};

const chosenOption = (state: RoomState) => state.options?.find((o) => o.id === state.chosenOptionId);

/** How much of the book the script writer sees: all of it when faithful, the key passages when condensing. */
const SOURCE_CHARS: Record<Faithfulness, number> = { faithful: 40_000, condensed: 20_000, reimagined: 6_000 };

export function writeScriptPrompt(state: RoomState, option: PlanOption, extra = ""): string {
  return `TASK: write the full shot-by-shot script for the chosen plan.
${FAITHFULNESS_RULE[state.faithfulness]}
CHOSEN PLAN: ${JSON.stringify(option)}
ANALYSIS: ${compactAnalysis(state.analysis)}
${pagesBlock(state, SOURCE_CHARS[state.faithfulness])}
${SHOT_CONTRACT}
Write exactly ${Math.max(1, option.shot_count)} shots${option.episodes > 1 ? " for EPISODE 1 only" : ""}.
${speechModeLine(option)}
${extra}
Return JSON: {"script":${SCRIPT_JSON},"reply":"1-2 câu tiếng Việt giới thiệu kịch bản"}`;
}

export function revisePrompt(state: RoomState, instruction: string): string {
  return `TASK: revise the current script following the instruction. Change only what the instruction needs; keep every other shot, line and character as it is.
${FAITHFULNESS_RULE[state.faithfulness]}
ANALYSIS: ${compactAnalysis(state.analysis)}
CURRENT SCRIPT: ${JSON.stringify(state.script)}
INSTRUCTION: ${instruction}
${SHOT_CONTRACT}
${speechModeLine(chosenOption(state))}
Return JSON: {"script":${SCRIPT_JSON},"reply":"1-2 câu tiếng Việt nói đã sửa gì"}`;
}

export function evaluatePrompt(state: RoomState, rulesFindings: string): string {
  return `TASK: evaluate the current script as a demanding script editor for short AI video.
${FAITHFULNESS_RULE[state.faithfulness]}
ANALYSIS: ${compactAnalysis(state.analysis)}
CURRENT SCRIPT: ${JSON.stringify(state.script)}
AUTOMATIC 10-SECOND CHECKS ALREADY FOUND:
${rulesFindings || "none"}
Score 0–10: hook (first 3 s: a spoken hook line from 0–0.5 s AND a striking visual), story (clear arc, every shot advances), dialogue (every shot carries natural Vietnamese speech in the character's voice; silent shots score low), action_fit (one filmable continuous action per 10 s clip), character (consistent look/role), faithfulness (to the source at the chosen level). Then list the most important problems the automatic checks did not already cover, each with a concrete fix instruction, and 3–5 one-click improvement options.
Return JSON: {"scores":{"hook":0,"story":0,"dialogue":0,"action_fit":0,"character":0,"faithfulness":0},"summary":"2-3 câu tiếng Việt","issues":[{"shot":2,"severity":"error|warning|info","message":"tiếng Việt","fix":"English instruction for the writer"}],"options":[{"label":"nhãn nút tiếng Việt ngắn","instruction":"English instruction for the writer"}]}`;
}

export function chatPrompt(state: RoomState, message: string): string {
  const recent = state.messages.slice(-8).map((m) => `${m.role === "user" ? "USER" : "WRITER"}: ${m.text}`).join("\n");
  return `TASK: reply to the user in the writers' room. If the message asks to change the script, return the full revised script; otherwise return "script": null and just answer (questions, advice, explanations).
${FAITHFULNESS_RULE[state.faithfulness]}
ANALYSIS: ${compactAnalysis(state.analysis)}
PLAN OPTIONS: ${JSON.stringify((state.options ?? []).map((o) => ({ id: o.id, title: o.title, logline: o.logline })))}
CURRENT SCRIPT: ${state.script ? JSON.stringify(state.script) : "chưa có"}
RECENT CONVERSATION:
${recent || "(trống)"}
USER: ${message}
${state.script ? `${SHOT_CONTRACT}\n${speechModeLine(chosenOption(state))}` : ""}
Return JSON: {"reply":"tiếng Việt","script":${state.script ? `null or ${SCRIPT_JSON}` : "null"}}`;
}

export const OCR_SYSTEM_PROMPT =
  "You transcribe photographed book pages exactly. Keep the original language, spelling, Vietnamese diacritics, paragraph breaks and dialogue punctuation. Never summarise, translate or invent text; mark unreadable words as […].";

export function ocrPrompt(firstPageNumber: number, count: number): string {
  return `Transcribe the ${count} attached book page photo(s) in order. They are pages ${firstPageNumber}–${firstPageNumber + count - 1} of the batch. Ignore page headers/footers and page numbers.
Return JSON: {"pages":[{"index":${firstPageNumber},"text":"…"}]}`;
}

/** Parse the model's JSON, tolerating code fences and leading prose. */
export function parseRoomJson<T>(raw: string): T {
  const text = String(raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI không trả về JSON hợp lệ");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** Normalise a script returned by the model (numbers, arrays, names). */
type RawLine = Record<string, unknown> | string | null | undefined;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** A spoken line in any of the shapes models return ({speaker,text}, {character,line}, "Lan: …"). */
function toLine(raw: RawLine): ShotLine | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const m = raw.match(/^\s*([^:：]{1,40})[:：]\s*(.+)$/u);
    const text = (m ? m[2]! : raw).trim().replace(/^["“]|["”]$/gu, "");
    return text ? { speaker: m ? m[1]!.trim() : "", text } : null;
  }
  const text = String(raw.text ?? raw.line ?? raw.content ?? raw.dialogue ?? "").trim();
  if (!text) return null;
  const start = num(raw.start_s ?? raw.start);
  const end = num(raw.end_s ?? raw.end);
  return {
    speaker: String(raw.speaker ?? raw.character ?? raw.name ?? raw.who ?? "").trim(),
    text,
    ...(start !== undefined ? { start_s: start } : {}),
    ...(end !== undefined ? { end_s: end } : {}),
  };
}

function toVoiceOver(raw: unknown): ShotLine | null {
  const parts = (Array.isArray(raw) ? raw : [raw]).map((r) => toLine(r as RawLine)).filter((l): l is ShotLine => !!l);
  if (!parts.length) return null;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return {
    speaker: first.speaker || "Lời dẫn",
    text: parts.map((l) => l.text).join(" "),
    ...(first.start_s !== undefined ? { start_s: first.start_s } : {}),
    ...(last.end_s !== undefined ? { end_s: last.end_s } : {}),
  };
}

export function normalizeScript(raw: unknown): RoomScript | null {
  const r = (raw ?? null) as Partial<RoomScript> | null;
  if (!r || !Array.isArray(r.shots) || !r.shots.length) return null;
  const str = (v: unknown) => String(v ?? "").trim();
  return {
    title: str(r.title) || "Kịch bản",
    ...(str(r.logline) ? { logline: str(r.logline) } : {}),
    characters: (Array.isArray(r.characters) ? r.characters : []).filter((c) => str(c?.name)).map((c) => ({
      name: str(c.name), age: str(c.age) || undefined, gender: str(c.gender) || undefined, appearance: str(c.appearance) || undefined,
      personality: str(c.personality) || undefined, role: str(c.role) || undefined, wardrobe: str(c.wardrobe) || undefined,
    })),
    shots: r.shots.map((s, i) => ({
      n: i + 1,
      duration_s: 10,
      location: str(s?.location),
      characters: (Array.isArray(s?.characters) ? s.characters : []).map(str).filter(Boolean),
      action: str(s?.action),
      dialogue: (Array.isArray(s?.dialogue) ? (s.dialogue as unknown[]) : []).map((l) => toLine(l as RawLine)).filter((l): l is ShotLine => !!l),
      voice_over: toVoiceOver(s?.voice_over),
      camera: str(s?.camera) || undefined,
      transition: str(s?.transition) || undefined,
      pages: Array.isArray(s?.pages) ? s.pages.filter((p) => Number.isFinite(p)) : undefined,
    })),
  };
}

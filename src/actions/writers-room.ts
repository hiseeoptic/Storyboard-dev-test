"use server";

// ============================================================
// WRITERS' ROOM server actions.
//   · writersRoomOcr   — transcribe photographed book pages (Gemini Vision,
//     OpenAI vision fallback). Pages are read once; later turns send text only.
//   · writersRoomTurn  — one chat turn: analyse → plan options, write the
//     10-second-shot script for a chosen option, revise, evaluate, free chat.
//     Every new script version is evaluated automatically (free 10-second
//     rules + an AI script editor) so the chat always shows scores, problems
//     and one-click fixes.
// The room state lives on the client and is passed in/out (no storage here).
// Uses the app's configured script providers (OpenAI: GPT-6.1 Sol).
// ============================================================
import { jsonrepair } from "jsonrepair";
import { geminiGenerateText } from "@/lib/gemini/client";
import { claudeGenerateText } from "@/lib/anthropic/client";
import { getOpenAIClient } from "@/lib/openai/client";
import { logOpenAiUsage } from "@/lib/ai/usage";
import { createOpenAiChat } from "@/lib/ai/openai-models";
import type { ActionResult, AIProvider } from "@/types";
import {
  OCR_SYSTEM_PROMPT,
  ROOM_SYSTEM_PROMPT,
  analyzePrompt,
  chatPrompt,
  evaluatePrompt,
  normalizeScript,
  ocrPrompt,
  revisePrompt,
  writeScriptPrompt,
  planHasSpeech,
} from "@/lib/writers-room/prompts";
import { checkScriptRules, rulesScore } from "@/lib/writers-room/shot-rules";
import type {
  BookAnalysis,
  BookPage,
  ChatMessage,
  EvaluationIssue,
  PlanOption,
  RoomAction,
  RoomScript,
  RoomState,
  ScriptEvaluation,
} from "@/lib/writers-room/types";

const MAX_OCR_IMAGES_PER_CALL = 4;
const MAX_HISTORY = 12;
const MAX_MESSAGES = 60;

function parseJson<T>(raw: string): T {
  const text = String(raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return JSON.parse(jsonrepair(candidate)) as T;
  }
}

async function callProvider(provider: AIProvider, userPrompt: string, maxTokens: number, timeoutMs: number): Promise<string> {
  if (provider === "claude") {
    return claudeGenerateText({ systemPrompt: ROOM_SYSTEM_PROMPT, userPrompt, maxTokens, timeoutMs });
  }
  if (provider === "gemini") {
    return geminiGenerateText({
      systemPrompt: ROOM_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.7,
      maxOutputTokens: Math.min(maxTokens * 2, 32_000),
      timeoutMs,
    });
  }
  // GPT-6.1 Sol, same as the storyboard script writer (openai-models.ts).
  const completion = await createOpenAiChat(getOpenAIClient(), {
    stage: "writers_room",
    messages: [
      { role: "system", content: ROOM_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens,
    responseFormat: { type: "json_object" },
    timeoutMs,
  });
  logOpenAiUsage({ stage: "writers_room", model: completion.model, usage: completion.usage, promptParts: [ROOM_SYSTEM_PROMPT, userPrompt] });
  return completion.content ?? "";
}

/** One turn must finish inside the page's 300 s serverless window. */
const TURN_BUDGET_MS = 280_000;

/** Chosen provider first, then the other configured writers (Claude only when chosen). */

async function roomLLM<T>(provider: AIProvider, userPrompt: string, deadline: number, maxTokens = 12_000): Promise<{ data: T; usedProvider: AIProvider }> {
  const remainingMs = () => deadline - Date.now();
  const chain: AIProvider[] = [provider, ...(["openai", "gemini"] as AIProvider[]).filter((p) => p !== provider)];
  let lastError: unknown = null;
  for (const p of chain) {
    const budget = Math.min(150_000, remainingMs() - 5_000);
    if (budget < 30_000) break;
    try {
      const raw = await callProvider(p, userPrompt, maxTokens, budget);
      return { data: parseJson<T>(raw), usedProvider: p };
    } catch (err) {
      lastError = err;
      console.error(`[WritersRoom] ${p} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Không gọi được AI");
}

const say = (text: string, kind: ChatMessage["kind"] = "text"): ChatMessage => ({ role: "assistant", text, kind, at: Date.now() });

function pushScript(state: RoomState, script: RoomScript): RoomState {
  const history = state.script ? [...state.history, state.script].slice(-MAX_HISTORY) : state.history;
  return { ...state, script, history, evaluation: undefined };
}

/**
 * Silent shots and a late first line are fixed before the user sees the
 * script: one automatic revision asks the writer for exactly the missing
 * speech. It replaces the version just written (no extra undo step) only when
 * it really has fewer speech problems, and is skipped when time is short.
 */
async function autoFixSpeech(state: RoomState, provider: AIProvider, deadline: number): Promise<{ state: RoomState; fixedShots: number[] }> {
  const speech = planHasSpeech(state);
  if (!state.script || !speech || deadline - Date.now() < 120_000) return { state, fixedShots: [] };
  const speechIssues = (script: RoomScript) => checkScriptRules(script, { speech }).filter((i) => i.code && i.fix);
  const before = speechIssues(state.script);
  if (!before.length) return { state, fixedShots: [] };
  const instruction = `Fix ONLY the spoken words of these shots and keep every action, camera and other line exactly as it is:\n${before.map((i) => `- ${i.fix}`).join("\n")}`;
  try {
    const { data } = await roomLLM<{ script?: unknown }>(provider, revisePrompt(state, instruction), deadline, 14_000);
    const script = normalizeScript(data.script);
    if (!script || script.shots.length !== state.script.shots.length) return { state, fixedShots: [] };
    const after = speechIssues(script);
    if (after.length >= before.length) return { state, fixedShots: [] };
    const still = new Set(after.map((i) => i.shot));
    return {
      state: { ...state, script },
      fixedShots: [...new Set(before.map((i) => i.shot ?? 0))].filter((n) => n && !still.has(n)).sort((a, b) => a - b),
    };
  } catch (err) {
    console.error("[WritersRoom] automatic speech fix failed:", err);
    return { state, fixedShots: [] };
  }
}

async function evaluate(state: RoomState, provider: AIProvider, deadline: number): Promise<ScriptEvaluation | undefined> {
  const remainingMs = () => deadline - Date.now();
  if (!state.script) return undefined;
  const ruleIssues = checkScriptRules(state.script, { speech: planHasSpeech(state) });
  const rulesText = ruleIssues.map((i) => `- ${i.message}`).join("\n");
  const fit = rulesScore(ruleIssues, state.script.shots.length);
  const rulesOnly = (summary: string): ScriptEvaluation => ({ scores: { shot_fit_10s: fit }, overall: fit, issues: ruleIssues, options: [], summary });
  if (remainingMs() < 45_000) return rulesOnly("Đã chạy kiểm tra tự động 10 giây; bấm \"Chấm điểm lại\" để AI chấm chi tiết.");
  try {
    const { data } = await roomLLM<{
      scores?: Record<string, number>;
      summary?: string;
      issues?: Array<Omit<EvaluationIssue, "source">>;
      options?: Array<{ label: string; instruction: string }>;
    }>(provider, evaluatePrompt(state, rulesText), deadline, 6_000);
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.scores ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n)) scores[k] = Math.max(0, Math.min(10, Math.round(n * 10) / 10));
    }
    scores.shot_fit_10s = fit;
    const values = Object.values(scores);
    const aiIssues: EvaluationIssue[] = (data.issues ?? [])
      .filter((i) => i && String(i.message ?? "").trim())
      .slice(0, 10)
      .map((i) => ({
        ...(Number.isFinite(Number(i.shot)) ? { shot: Number(i.shot) } : {}),
        severity: i.severity === "error" || i.severity === "info" ? i.severity : "warning",
        message: String(i.message),
        ...(i.fix ? { fix: String(i.fix) } : {}),
        source: "ai" as const,
      }));
    return {
      scores,
      overall: Math.round((values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)) * 10) / 10,
      issues: [...ruleIssues, ...aiIssues],
      options: (data.options ?? []).filter((o) => o?.label && o?.instruction).slice(0, 5),
      ...(data.summary ? { summary: String(data.summary) } : {}),
    };
  } catch (err) {
    console.error("[WritersRoom] AI evaluation failed:", err);
    return rulesOnly("Chỉ chạy được bước kiểm tra tự động 10 giây (AI chấm điểm tạm lỗi).");
  }
}

function evaluationMessage(ev: ScriptEvaluation): ChatMessage {
  const errors = ev.issues.filter((i) => i.severity === "error").length;
  const warnings = ev.issues.filter((i) => i.severity === "warning").length;
  return say(`Điểm tổng ${ev.overall}/10 · ${errors} lỗi, ${warnings} cảnh báo.${ev.summary ? ` ${ev.summary}` : ""}`, "evaluation");
}

export async function writersRoomOcr(params: {
  images: string[];
  firstPage: number;
}): Promise<ActionResult<{ pages: BookPage[] }>> {
  const images = (params.images ?? []).filter(Boolean).slice(0, MAX_OCR_IMAGES_PER_CALL);
  if (!images.length) return { success: false, error: "Chưa có ảnh trang sách." };
  const first = Math.max(1, Math.floor(params.firstPage || 1));
  const prompt = ocrPrompt(first, images.length);
  let raw = "";
  try {
    raw = await geminiGenerateText({
      systemPrompt: OCR_SYSTEM_PROMPT,
      userPrompt: prompt,
      images: images.map((base64) => ({ base64, mimeType: "image/jpeg" })),
      jsonMode: true,
      temperature: 0.1,
      maxOutputTokens: 16_000,
      timeoutMs: 120_000,
    });
  } catch (geminiError) {
    console.error("[WritersRoom OCR] Gemini failed, trying OpenAI:", geminiError);
    try {
      const model = process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini";
      const res = await getOpenAIClient().chat.completions.create({
        model,
        messages: [
          { role: "system", content: OCR_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map((b64) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" as const } })),
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 12_000,
      });
      logOpenAiUsage({ stage: "writers_room_ocr", model, usage: res.usage, imageCount: images.length });
      raw = res.choices[0]?.message?.content ?? "";
    } catch (openAiError) {
      return { success: false, error: `Không đọc được ảnh trang sách: ${openAiError instanceof Error ? openAiError.message : String(openAiError)}` };
    }
  }
  try {
    const data = parseJson<{ pages?: Array<{ index?: number; text?: string }> }>(raw);
    const pages = (data.pages ?? [])
      .map((p) => String(p.text ?? "").trim())
      .filter(Boolean)
      // Numbered here, not by the model: a photo of an open book yields two pages.
      .map((text, i) => ({ index: first + i, text }));
    if (!pages.length) return { success: false, error: "AI không đọc ra chữ nào — thử ảnh rõ hơn, chụp thẳng trang." };
    return { success: true, data: { pages } };
  } catch {
    return { success: false, error: "AI đọc ảnh nhưng trả dữ liệu lỗi — thử lại." };
  }
}

export async function writersRoomTurn(params: {
  state: RoomState;
  action: RoomAction;
  provider?: AIProvider;
}): Promise<ActionResult<{ state: RoomState; usedProvider?: AIProvider }>> {
  const provider: AIProvider = params.provider ?? "openai";
  const deadline = Date.now() + TURN_BUDGET_MS;
  let state: RoomState = { ...params.state, messages: [...(params.state.messages ?? [])].slice(-MAX_MESSAGES) };
  const action = params.action;
  const addUser = (text: string) => { state = { ...state, messages: [...state.messages, { role: "user", text, at: Date.now() }] }; };
  const addAssistant = (m: ChatMessage) => { state = { ...state, messages: [...state.messages, m] }; };
  let usedProvider: AIProvider | undefined;
  const speechPass = async () => {
    const fixed = await autoFixSpeech(state, provider, deadline);
    state = fixed.state;
    if (fixed.fixedShots.length) {
      addAssistant(say(`Mình đã tự bổ sung lời thoại cho shot ${fixed.fixedShots.join(", ")} — 3 giây đầu có câu mở màn và không shot nào bị im lặng.`, "text"));
    }
  };

  try {
    if (action.type === "analyze") {
      if (!state.pages.length && !state.idea?.trim()) return { success: false, error: "Hãy đọc ảnh trang sách hoặc nhập ý tưởng trước." };
      addUser(state.pages.length ? `Phân tích ${state.pages.length} trang sách và đề xuất kế hoạch video.` : "Phân tích ý tưởng và đề xuất kế hoạch video.");
      const { data, usedProvider: up } = await roomLLM<{ analysis?: BookAnalysis; options?: PlanOption[]; reply?: string }>(provider, analyzePrompt(state), deadline, 10_000);
      usedProvider = up;
      if (!data.analysis || !Array.isArray(data.options) || !data.options.length) throw new Error("AI chưa trả về phân tích / phương án.");
      const options = data.options.slice(0, 4).map((o, i) => ({
        ...o,
        id: String(o.id || String.fromCharCode(65 + i)),
        shot_count: Math.max(1, Math.min(30, Math.round(Number(o.shot_count) || 6))),
        episodes: Math.max(1, Math.round(Number(o.episodes) || 1)),
        structure: Array.isArray(o.structure) ? o.structure.map(String) : [],
        voice_over: o.voice_over !== false,
        dialogue: o.dialogue !== false,
      }));
      state = { ...state, analysis: data.analysis, options, chosenOptionId: undefined };
      addAssistant(say(data.reply || "Mình đã đọc xong. Đây là phân tích và các phương án video.", "analysis"));
      addAssistant(say("Chọn một phương án để mình viết kịch bản theo từng shot 10 giây.", "options"));
    } else if (action.type === "choose") {
      const option = state.options?.find((o) => o.id === action.optionId);
      if (!option) return { success: false, error: "Không tìm thấy phương án." };
      addUser(`Chọn phương án ${option.id}: ${option.title}`);
      const { data, usedProvider: up } = await roomLLM<{ script?: unknown; reply?: string }>(provider, writeScriptPrompt(state, option), deadline, 14_000);
      usedProvider = up;
      const script = normalizeScript(data.script);
      if (!script) throw new Error("AI chưa trả về kịch bản theo shot.");
      state = pushScript({ ...state, chosenOptionId: option.id }, script);
      addAssistant(say(data.reply || `Kịch bản ${script.shots.length} shot × 10 giây đã sẵn sàng.`, "script"));
      await speechPass();
      const ev = await evaluate(state, provider, deadline);
      if (ev) { state = { ...state, evaluation: ev }; addAssistant(evaluationMessage(ev)); }
    } else if (action.type === "revise") {
      if (!state.script) return { success: false, error: "Chưa có kịch bản để sửa." };
      addUser(action.instruction);
      const { data, usedProvider: up } = await roomLLM<{ script?: unknown; reply?: string }>(provider, revisePrompt(state, action.instruction), deadline, 14_000);
      usedProvider = up;
      const script = normalizeScript(data.script);
      if (!script) throw new Error("AI chưa trả về kịch bản đã sửa.");
      state = pushScript(state, script);
      addAssistant(say(data.reply || "Đã sửa kịch bản.", "script"));
      await speechPass();
      const ev = await evaluate(state, provider, deadline);
      if (ev) { state = { ...state, evaluation: ev }; addAssistant(evaluationMessage(ev)); }
    } else if (action.type === "evaluate") {
      if (!state.script) return { success: false, error: "Chưa có kịch bản để chấm." };
      addUser("Chấm điểm lại kịch bản.");
      const ev = await evaluate(state, provider, deadline);
      if (ev) { state = { ...state, evaluation: ev }; addAssistant(evaluationMessage(ev)); }
    } else if (action.type === "chat") {
      const message = action.message.trim();
      if (!message) return { success: false, error: "Tin nhắn trống." };
      addUser(message);
      const { data, usedProvider: up } = await roomLLM<{ reply?: string; script?: unknown }>(provider, chatPrompt(state, message), deadline, 14_000);
      usedProvider = up;
      const script = data.script ? normalizeScript(data.script) : null;
      if (script) {
        state = pushScript(state, script);
        addAssistant(say(data.reply || "Đã cập nhật kịch bản.", "script"));
        await speechPass();
        const ev = await evaluate(state, provider, deadline);
        if (ev) { state = { ...state, evaluation: ev }; addAssistant(evaluationMessage(ev)); }
      } else {
        addAssistant(say(data.reply || "…"));
      }
    }
    return { success: true, data: { state, ...(usedProvider ? { usedProvider } : {}) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    addAssistant(say(`Lỗi: ${message}`, "error"));
    return { success: true, data: { state } };
  }
}

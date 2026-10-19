"use server";

// ============================================================
// "Bé cưng viral" — 10 fresh episode ideas for the same kid and family.
// Fast text stage (OpenAI first, Gemini as backup); the user picks one and
// it fills the request box.
// ============================================================
import { jsonrepair } from "jsonrepair";
import { geminiGenerateText } from "@/lib/gemini/client";
import { getOpenAIClient } from "@/lib/openai/client";
import { logOpenAiUsage } from "@/lib/ai/usage";
import { createOpenAiChat } from "@/lib/ai/openai-models";
import type { ActionResult, AIProvider } from "@/types";
import { PARENTING_LESSONS } from "@/lib/kids/parenting-lessons";
import {
  EPISODE_IDEAS_SYSTEM,
  buildEpisodeIdeasPrompt,
  normalizeEpisodeIdeas,
  type CuteKidsConfig,
  type EpisodeIdea,
} from "@/lib/kids/cute-kids";

function parseJson(raw: string): unknown {
  const text = String(raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(jsonrepair(candidate));
  }
}

async function ask(provider: AIProvider, userPrompt: string): Promise<string> {
  if (provider === "gemini") {
    return geminiGenerateText({
      systemPrompt: EPISODE_IDEAS_SYSTEM,
      userPrompt,
      jsonMode: true,
      temperature: 0.9,
      maxOutputTokens: 4000,
      timeoutMs: 60_000,
    });
  }
  const completion = await createOpenAiChat(getOpenAIClient(), {
    stage: "rewrite",
    messages: [
      { role: "system", content: EPISODE_IDEAS_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.9,
    maxTokens: 3000,
    responseFormat: { type: "json_object" },
    timeoutMs: 60_000,
  });
  logOpenAiUsage({ stage: "cute_kids_ideas", model: completion.model, usage: completion.usage, promptParts: [EPISODE_IDEAS_SYSTEM, userPrompt] });
  return completion.content ?? "";
}

export async function suggestCuteKidsEpisodes(params: {
  config: CuteKidsConfig;
  avoid?: string[];
  provider?: AIProvider;
}): Promise<ActionResult<EpisodeIdea[]>> {
  // Teach mode: the AI invents situations the lesson library does not have yet.
  const libraryTitles = params.config?.goal === "teach"
    ? PARENTING_LESSONS.filter((l) => l.pillar === (params.config.pillar ?? "money")).map((l) => l.title).slice(0, 40)
    : [];
  const userPrompt = buildEpisodeIdeasPrompt(params.config, (params.avoid ?? []).slice(0, 20), libraryTitles);
  const first: AIProvider = params.provider === "gemini" ? "gemini" : "openai";
  let lastError: unknown = null;
  for (const provider of [first, first === "openai" ? "gemini" : "openai"] as AIProvider[]) {
    try {
      const ideas = normalizeEpisodeIdeas(parseJson(await ask(provider, userPrompt)));
      if (ideas.length) return { success: true, data: ideas };
      lastError = new Error("AI không trả về ý tưởng nào");
    } catch (err) {
      lastError = err;
      console.error(`[CuteKids] ${provider} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return { success: false, error: lastError instanceof Error ? lastError.message : "Không gợi ý được ý tưởng" };
}

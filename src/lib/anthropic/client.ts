/**
 * Anthropic (Claude) client using REST (fetch) — same "no extra deps" approach
 * as the Gemini client. Used for SCRIPT generation only (best "nội dung chuẩn"),
 * switchable from the hidden admin panel. Images stay on Gemini.
 *
 * Opus 4.8 note: adaptive-thinking only — do NOT send `temperature`, `top_p`,
 * `top_k`, or `thinking.budget_tokens` (they return 400). We omit `thinking`
 * entirely (runs without thinking on 4.8) and ask for JSON in the prompt.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

interface ClaudeContentBlock {
  type?: string;
  text?: string;
}
interface ClaudeResponse {
  content?: ClaudeContentBlock[];
  error?: { message?: string };
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY chưa được cấu hình. Thêm nó vào Environment Variables trên Vercel để dùng Claude viết kịch bản."
    );
  }
  return key;
}

export async function claudeGenerateText(params: {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: params.maxTokens ?? 16000,
    messages: [{ role: "user", content: params.userPrompt }],
  };
  if (params.systemPrompt) body.system = params.systemPrompt;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as ClaudeResponse;

  if (!res.ok || json.error) {
    throw new Error(
      `Claude generation failed (${res.status}): ${json.error?.message ?? "Unknown error"}`
    );
  }

  const text = (json.content ?? [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Claude trả về nội dung rỗng");
  return text;
}

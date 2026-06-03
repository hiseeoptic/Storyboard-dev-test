/**
 * Gemini API client using REST (fetch) to avoid extra dependencies.
 * Mirrors the OpenAI capabilities used by the storyboard pipeline:
 *  - Text generation (with optional JSON mode + vision images)
 *  - Image generation (Nano Banana / Nano Banana Pro) with reference
 *    images for character consistency and aspect-ratio control.
 */

import type { AspectRatio, ImageQuality } from "@/types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Model names — change here if Google updates model identifiers.
const TEXT_MODEL = "gemini-2.5-flash";
// Standard = Nano Banana, Pro = Nano Banana Pro (best face consistency).
const IMAGE_MODEL_STANDARD = "gemini-2.5-flash-image";
const IMAGE_MODEL_PRO = "gemini-3-pro-image";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it in the Vercel environment variables to use Gemini."
    );
  }
  return key;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
}

// ─── Text Generation (with optional vision + JSON mode) ─────────────────────

export async function geminiGenerateText(params: {
  systemPrompt?: string;
  userPrompt: string;
  jsonMode?: boolean;
  images?: { base64: string; mimeType?: string }[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const apiKey = getApiKey();

  const parts: GeminiPart[] = [{ text: params.userPrompt }];
  if (params.images) {
    for (const img of params.images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType ?? "image/jpeg",
          data: img.base64,
        },
      });
    }
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxOutputTokens ?? 8192,
      ...(params.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (params.systemPrompt) {
    body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
  }

  const res = await fetch(`${API_BASE}/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as GeminiResponse;

  if (!res.ok || json.error) {
    throw new Error(
      `Gemini text generation failed (${res.status}): ${json.error?.message ?? "Unknown error"}`
    );
  }

  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty text response");
  }

  return text;
}

// ─── Image Generation (Nano Banana / Nano Banana Pro) ───────────────────────

function extractImage(json: GeminiResponse): string | null {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const data = p.inlineData?.data ?? p.inline_data?.data;
    const mime = p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? "image/png";
    if (data) return `data:${mime};base64,${data}`;
  }
  return null;
}

/**
 * Generates an image and returns a data URI (data:image/png;base64,...).
 *
 * - referenceImages: passed as input so the model keeps the same character /
 *   product / scene (image-to-image, the key to face consistency).
 * - aspectRatio: 16:9 or 9:16 etc.
 * - quality: "pro" uses Nano Banana Pro (gemini-3-pro-image) for best
 *   identity preservation; "standard" uses gemini-2.5-flash-image.
 */
export async function geminiGenerateImage(params: {
  prompt: string;
  referenceImages?: { base64: string; mimeType?: string }[];
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}): Promise<string> {
  const apiKey = getApiKey();
  const model = params.quality === "pro" ? IMAGE_MODEL_PRO : IMAGE_MODEL_STANDARD;

  // Reinforce aspect ratio in the prompt text (always works as a hint).
  const ratioHint = params.aspectRatio
    ? ` Generate the image in ${params.aspectRatio} ${
        params.aspectRatio === "9:16" ? "vertical (portrait)" : "horizontal (landscape)"
      } aspect ratio.`
    : "";

  const parts: GeminiPart[] = [{ text: params.prompt + ratioHint }];
  if (params.referenceImages) {
    for (const img of params.referenceImages) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType ?? "image/jpeg",
          data: img.base64,
        },
      });
    }
  }

  const buildBody = (withImageConfig: boolean): Record<string, unknown> => ({
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      ...(withImageConfig && params.aspectRatio
        ? { responseFormat: { image: { aspectRatio: params.aspectRatio, imageSize: "2K" } } }
        : {}),
    },
  });

  const callApi = async (withImageConfig: boolean) => {
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(withImageConfig)),
    });
    const json = (await res.json()) as GeminiResponse;
    return { res, json };
  };

  // First attempt: with aspect-ratio config.
  let { res, json } = await callApi(true);

  // If the config field is rejected (400), retry without it. The prompt
  // text still requests the aspect ratio.
  if (res.status === 400 && params.aspectRatio) {
    ({ res, json } = await callApi(false));
  }

  if (!res.ok || json.error) {
    throw new Error(
      `Gemini image generation failed (${res.status}): ${json.error?.message ?? "Unknown error"}`
    );
  }

  const image = extractImage(json);
  if (!image) {
    throw new Error("Gemini did not return an image");
  }

  return image;
}

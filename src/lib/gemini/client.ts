/**
 * Gemini API client using REST (fetch) to avoid extra dependencies.
 * Mirrors the OpenAI capabilities used by the storyboard pipeline:
 *  - Text generation (with optional JSON mode + vision images)
 *  - Image generation (Nano Banana / Nano Banana Pro) with reference
 *    images for character consistency and aspect-ratio control.
 */

import type { AspectRatio, ImageQuality } from "@/types";
import sharp from "sharp";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Model names — change here if Google updates model identifiers.
const TEXT_MODEL = "gemini-2.5-flash";

// Image model fallback chains (newest first). If the API key doesn't have
// access to a model (404 / not found), we automatically try the next one.
// NOTE: these are the REAL public model IDs on the Gemini Developer API
// (generativelanguage v1beta). The `-preview` suffix is REQUIRED — IDs like
// "gemini-3-pro-image" or "gemini-3.1-flash-image" (no suffix) 404, which is
// why earlier builds silently fell all the way back to gemini-2.5-flash-image
// (the old Nano Banana, capped at 1024px) and produced soft, low-res faces.
// Pro      = Nano Banana Pro (gemini-3-pro-image-preview) — best identity
//            preservation (up to 5 subjects) + 2K/4K output.
// Standard = Nano Banana (gemini-2.5-flash-image) — fast, 1K.
const IMAGE_MODELS_PRO = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];
const IMAGE_MODELS_STANDARD = [
  "gemini-2.5-flash-image",
];

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
 * Re-encode a generated image (Gemini returns multi-MB PNGs) to a compact
 * JPEG. This is essential: a raw PNG board can be 3-10MB which blows past
 * Vercel's ~4.5MB serverless response limit and the client then sees
 * "An unexpected response was received from the server". A JPEG at these
 * sizes is a few hundred KB — well within budget — and visually identical for
 * a reference board / portrait. Falls back to the original on any failure.
 */
async function compressImage(dataUri: string, maxDim: number, quality: number): Promise<string> {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m || !m[2]) return dataUri;
  try {
    const out = await sharp(Buffer.from(m[2], "base64"))
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return dataUri;
  }
}

function isModelUnavailable(status: number, message?: string): boolean {
  if (status === 404) return true;
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("not supported") ||
    m.includes("does not exist") ||
    m.includes("no access") ||
    m.includes("permission")
  );
}

/**
 * Generates an image and returns a data URI (data:image/png;base64,...).
 *
 * - referenceImages: passed as input so the model keeps the same character /
 *   product / scene (image-to-image, the key to face consistency).
 * - aspectRatio: 16:9 or 9:16.
 * - quality: "pro" = Nano Banana Pro (gemini-3-pro-image),
 *            "standard" = Nano Banana 2 (gemini-3.1-flash-image).
 *
 * Tries each model in the chain (newest first) and falls back to the next
 * one if the key has no access to it.
 */
export async function geminiGenerateImage(params: {
  prompt: string;
  referenceImages?: { base64: string; mimeType?: string; label?: string }[];
  aspectRatio?: AspectRatio | "1:1";
  quality?: ImageQuality;
  /**
   * Optional resolution cap. Composite storyboard boards pass "1K" so the
   * base64 data-URI response stays well under the serverless body limit
   * (a 2K board can be 5-10MB and the response then fails → "Frame lỗi").
   * Single Studio portraits leave this unset to keep Pro's 2K detail.
   */
  imageSize?: "1K" | "2K";
}): Promise<string> {
  const apiKey = getApiKey();
  const models = params.quality === "pro" ? IMAGE_MODELS_PRO : IMAGE_MODELS_STANDARD;

  // Reinforce aspect ratio in the prompt text (always works as a hint).
  const ratioWord =
    params.aspectRatio === "9:16"
      ? "vertical (portrait)"
      : params.aspectRatio === "1:1"
        ? "square"
        : "horizontal (landscape)";
  const ratioHint = params.aspectRatio
    ? ` Generate the image in ${params.aspectRatio} ${ratioWord} aspect ratio.`
    : "";

  // When references carry per-image role labels (Image Studio), interleave
  // "label → image" pairs FIRST and put the instruction LAST — this is what
  // makes the model lock onto the right face/outfit/product per reference.
  // Without labels (storyboard boards) keep the original "prompt then images".
  const hasLabels = params.referenceImages?.some((i) => i.label);
  const parts: GeminiPart[] = [];
  if (hasLabels && params.referenceImages) {
    for (const img of params.referenceImages) {
      if (img.label) parts.push({ text: img.label });
      parts.push({ inlineData: { mimeType: img.mimeType ?? "image/jpeg", data: img.base64 } });
    }
    parts.push({ text: params.prompt + ratioHint });
  } else {
    parts.push({ text: params.prompt + ratioHint });
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
  }

  // Pro (Nano Banana Pro / Gemini 3) can render at 2K, but composite boards
  // pass an explicit "1K" cap to keep the response small enough to return.
  const imageSize = params.imageSize ?? (params.quality === "pro" ? "2K" : null);

  // Correct field per the Gemini Developer API (generativelanguage v1beta):
  //   generationConfig.imageConfig.{aspectRatio,imageSize}
  // (the old `responseFormat.image` key was non-existent and silently 400'd,
  // so neither aspect ratio nor resolution ever actually applied.)
  // We try richest config first, then degrade so older models still answer:
  //   level 2 = aspectRatio + imageSize · level 1 = aspectRatio only · level 0 = none
  const buildBody = (level: 0 | 1 | 2): Record<string, unknown> => {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ["IMAGE", "TEXT"],
    };
    if (level >= 1 && params.aspectRatio) {
      const imageConfig: Record<string, string> = { aspectRatio: params.aspectRatio };
      if (level >= 2 && imageSize) imageConfig.imageSize = imageSize;
      generationConfig.imageConfig = imageConfig;
    }
    return { contents: [{ role: "user", parts }], generationConfig };
  };

  const callApi = async (model: string, level: 0 | 1 | 2) => {
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(level)),
    });
    const json = (await res.json()) as GeminiResponse;
    return { res, json };
  };

  let lastErr = "Unknown error";

  for (const model of models) {
    // Richest config first (aspect + size). On a 400 (model rejects a field)
    // step down: aspect-only, then no image config at all.
    const topLevel: 0 | 1 | 2 = params.aspectRatio ? (imageSize ? 2 : 1) : 0;
    let { res, json } = await callApi(model, topLevel);

    if (res.status === 400 && topLevel === 2) {
      ({ res, json } = await callApi(model, 1)); // drop imageSize, keep aspect
    }
    if (res.status === 400 && topLevel >= 1) {
      ({ res, json } = await callApi(model, 0)); // drop image config entirely
    }

    if (res.ok && !json.error) {
      const image = extractImage(json);
      if (image) {
        // Compress before returning so the data-URI fits the serverless
        // response limit. Composite boards (1K) cap ~1280px at q86; single
        // Studio portraits keep ~2048px at high quality (q93) so the reference
        // images stay crisp and flattering — better refs = better video.
        const isBoard = imageSize === "1K";
        return await compressImage(image, isBoard ? 1280 : 2048, isBoard ? 86 : 93);
      }
      lastErr = `Model ${model} returned no image`;
      continue; // try next model
    }

    const message = json.error?.message;
    lastErr = `${model} (${res.status}): ${message ?? "Unknown error"}`;

    // If this model is simply unavailable to the key, try the next one.
    if (isModelUnavailable(res.status, message)) {
      console.warn(`[Gemini] ${model} unavailable, falling back. ${lastErr}`);
      continue;
    }

    // A real error (quota, safety, bad request) — stop and report.
    throw new Error(`Gemini image generation failed: ${lastErr}`);
  }

  throw new Error(`Gemini image generation failed (no available model): ${lastErr}`);
}

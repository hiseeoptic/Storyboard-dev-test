/**
 * Gemini API client using REST (fetch) to avoid extra dependencies.
 * Mirrors the OpenAI capabilities used by the storyboard pipeline:
 *  - Text generation (with optional JSON mode + vision images)
 *  - Image generation (Gemini 2.5 Flash Image, "Nano Banana")
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Model names — change here if Google updates model identifiers.
const TEXT_MODEL = "gemini-2.0-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image-preview";

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

// ─── Image Generation (Nano Banana) ─────────────────────────────────────────

/**
 * Generates an image and returns a data URI (data:image/png;base64,...)
 * which can be used directly in <img src> and downloads.
 */
export async function geminiGenerateImage(prompt: string): Promise<string> {
  const apiKey = getApiKey();

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  };

  const res = await fetch(`${API_BASE}/${IMAGE_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as GeminiResponse;

  if (!res.ok || json.error) {
    throw new Error(
      `Gemini image generation failed (${res.status}): ${json.error?.message ?? "Unknown error"}`
    );
  }

  const imagePart = json.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini did not return an image");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

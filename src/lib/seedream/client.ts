/**
 * Seedream (ByteDance) image client via the official BytePlus ModelArk API.
 * Same "REST fetch, no extra deps" approach as the Gemini client.
 *
 * Why Seedream exists here: Nano Banana Pro (Google) regularly 503s under
 * load, and every Gemini-side fallback shares the same infrastructure. This
 * is a genuinely independent provider — near Nano-Banana-level subject
 * consistency (up to 10 reference images) at ~$0.045/image.
 *
 * Env:
 *  - ARK_API_KEY            (required)
 *  - ARK_BASE_URL           (optional, default BytePlus intl endpoint)
 *  - ARK_SEEDREAM_MODEL     (optional, default Seedream 4.5)
 */

import type { AspectRatio } from "@/types";

const ARK_BASE =
  process.env.ARK_BASE_URL ||
  "https://ark.ap-southeast.bytepluses.com/api/v3";

// Seedream 4.5 — text-to-image + image-to-image with up to 10 reference
// images. Update here (or via env) when ByteDance rotates the dated id.
const SEEDREAM_MODEL = process.env.ARK_SEEDREAM_MODEL || "seedream-4-5-251128";

function getApiKey(): string {
  const key = process.env.ARK_API_KEY;
  if (!key) {
    throw new Error(
      "ARK_API_KEY chưa được cấu hình. Thêm nó vào Environment Variables trên Vercel để dùng Seedream (BytePlus Ark)."
    );
  }
  return key;
}

interface ArkImageResponse {
  data?: { url?: string; b64_json?: string }[];
  error?: { message?: string; code?: string };
}

/**
 * Re-encode to a compact baseline JPEG — same rationale as the Gemini client:
 * a raw 2K image can be several MB, which blows past Vercel's ~4.5MB
 * serverless response limit. Falls back to the original on any failure.
 */
async function compressImage(dataUri: string): Promise<string> {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m || !m[2]) return dataUri;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(m[2], "base64"))
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: false, chromaSubsampling: "4:4:4" })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return dataUri;
  }
}

/** Map our aspect ratios to explicit Seedream pixel sizes (~2K class). */
function seedreamSize(aspect?: AspectRatio | "1:1"): string {
  if (aspect === "9:16") return "1152x2048";
  if (aspect === "1:1") return "2048x2048";
  return "2048x1152"; // 16:9 default
}

/**
 * Generates an image with Seedream and returns a data URI, matching the
 * Gemini client's contract so the image pipeline can treat providers alike.
 */
export async function seedreamGenerateImage(params: {
  prompt: string;
  referenceImages?: { base64: string; mimeType?: string; label?: string }[];
  aspectRatio?: AspectRatio | "1:1";
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = getApiKey();

  // Seedream takes reference images as data URIs in the `image` array (max 10).
  const refs = (params.referenceImages ?? [])
    .slice(0, 10)
    .map((r) => `data:${r.mimeType ?? "image/jpeg"};base64,${r.base64}`);

  const buildBody = (size: string): Record<string, unknown> => ({
    model: SEEDREAM_MODEL,
    prompt: params.prompt,
    ...(refs.length > 0 ? { image: refs } : {}),
    size,
    // One image per call; no auto image series.
    sequential_image_generation: "disabled",
    response_format: "b64_json",
    watermark: false,
  });

  const doFetch = (size: string) =>
    fetch(`${ARK_BASE}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(size)),
      signal: AbortSignal.timeout(params.timeoutMs ?? 120_000),
    });

  let res = await doFetch(seedreamSize(params.aspectRatio));
  let json = (await res.json()) as ArkImageResponse;

  // SAFETY NET: if the explicit pixel size is rejected (Ark size grammar can
  // change between model revisions), retry once with the coarse "2K" tier.
  if (res.status === 400 && /size/i.test(json.error?.message ?? "")) {
    console.error(
      `[Seedream] size rejected (${json.error?.message?.slice(0, 160)}); retrying with "2K"`
    );
    res = await doFetch("2K");
    json = (await res.json()) as ArkImageResponse;
  }

  // 429 / 5xx are transient — one short backoff, mirroring the Claude client.
  if (res.status === 429 || res.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    res = await doFetch(seedreamSize(params.aspectRatio));
    json = (await res.json()) as ArkImageResponse;
  }

  if (!res.ok || json.error) {
    throw new Error(
      `Seedream image generation failed (${res.status}): ${json.error?.message ?? "Unknown error"}`
    );
  }

  const item = json.data?.[0];
  if (item?.b64_json) {
    return compressImage(`data:image/jpeg;base64,${item.b64_json}`);
  }
  if (item?.url) return item.url;
  throw new Error("Seedream returned no image data");
}

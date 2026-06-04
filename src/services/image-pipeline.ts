import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateImage } from "@/lib/gemini/client";
import {
  buildCharacterRefSheetPrompt,
  buildSegmentFirstFramePrompt,
  buildStoryboardPosterPrompt,
} from "@/prompts";
import type {
  AIProvider,
  AspectRatio,
  CharacterLock,
  ImageQuality,
} from "@/types";

type RefImage = { base64: string; mimeType?: string };

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ImageGenOptions {
  provider?: AIProvider;
  /** Base64 reference images for character/product consistency (Gemini only). */
  referenceImages?: { base64: string; mimeType?: string }[];
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}

/** Map an aspect ratio to the closest DALL-E 3 supported size. */
function dalleSize(aspect?: AspectRatio): "1792x1024" | "1024x1792" {
  return aspect === "9:16" ? "1024x1792" : "1792x1024";
}

async function generateImage(
  prompt: string,
  opts: ImageGenOptions = {}
): Promise<string> {
  const provider = opts.provider ?? "openai";
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (provider === "gemini") {
        // Returns a data URI (data:image/png;base64,...)
        return await geminiGenerateImage({
          prompt,
          referenceImages: opts.referenceImages,
          aspectRatio: opts.aspectRatio,
          quality: opts.quality,
        });
      }

      // OpenAI / DALL-E 3 — no reference-image support; honour aspect ratio
      // via size. Face consistency requires Gemini.
      const openai = getOpenAIClient();
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: dalleSize(opts.aspectRatio),
        quality: "hd",
      });

      const url = response.data?.[0]?.url;
      if (!url) throw new Error("No image URL in response");
      return url;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[Image Pipeline] Attempt ${attempt + 1}/${MAX_RETRIES} (${provider}):`,
        lastError.message
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("Image generation failed");
}

/** Extract raw base64 from a data URI so it can be reused as a reference image. */
export function dataUriToBase64(
  dataUri: string
): { base64: string; mimeType: string } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { mimeType: match[1], base64: match[2] };
}

// ─── Generate Character Reference Sheet ─────────────────────────────────────

export async function generateCharacterRefSheet(params: {
  characterLock: CharacterLock;
  props?: string[];
  colorPalette?: string[];
  /** Uploaded reference photos of the real person/character (Gemini). */
  referenceImages?: { base64: string; mimeType?: string }[];
  provider?: AIProvider;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}): Promise<{ url: string }> {
  const hasRefs = (params.referenceImages?.length ?? 0) > 0;

  let prompt = buildCharacterRefSheetPrompt({
    characterLock: params.characterLock,
    props: params.props,
    colorPalette: params.colorPalette,
  });

  // When real reference photos are supplied, instruct the model to lock
  // the face to the uploaded image rather than inventing one.
  if (hasRefs) {
    prompt = `IMPORTANT: Use the attached reference photo(s) as the EXACT identity for this character. Keep the face, facial features, skin tone and hair IDENTICAL to the reference photo across every pose and angle. Do not invent a different face.\n\n${prompt}`;
  }

  const url = await generateImage(prompt, {
    provider: params.provider,
    referenceImages: params.referenceImages,
    aspectRatio: params.aspectRatio,
    quality: params.quality,
  });
  return { url };
}

// ─── Generate a Segment First-Frame (8s clip start) ─────────────────────────

export async function generateSegmentFrame(params: {
  segmentNumber: number;
  firstFramePrompt: string;
  characterDescription: string;
  style: string;
  isFirst: boolean;
  referenceImages?: RefImage[];
  provider?: AIProvider;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}): Promise<{ url: string }> {
  const prompt = buildSegmentFirstFramePrompt({
    segmentNumber: params.segmentNumber,
    firstFramePrompt: params.firstFramePrompt,
    characterDescription: params.characterDescription,
    style: params.style,
    isFirst: params.isFirst,
  });

  const url = await generateImage(prompt, {
    provider: params.provider,
    referenceImages: params.referenceImages,
    aspectRatio: params.aspectRatio,
    quality: params.quality,
  });
  return { url };
}

// ─── Generate Storyboard Poster ─────────────────────────────────────────────

export async function generateStoryboardPoster(params: {
  title: string;
  totalDuration: number;
  segmentCount: number;
  moodTags: string[];
  segments: {
    segment_number: number;
    title: string;
    summary: string;
    role: string;
  }[];
  characterDescription: string;
  style: string;
  colorPalette?: string[];
  /** Reference images (e.g. the generated character sheet) for consistency. */
  referenceImages?: RefImage[];
  provider?: AIProvider;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}): Promise<{ url: string }> {
  const hasRefs = (params.referenceImages?.length ?? 0) > 0;

  let prompt = buildStoryboardPosterPrompt(params);

  if (hasRefs) {
    prompt = `IMPORTANT: The attached reference image defines the character's exact appearance. Keep the same face, hair, costume and features IDENTICAL across every panel.\n\n${prompt}`;
  }

  const url = await generateImage(prompt, {
    provider: params.provider,
    referenceImages: params.referenceImages,
    aspectRatio: params.aspectRatio,
    quality: params.quality,
  });
  return { url };
}

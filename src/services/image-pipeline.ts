import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateImage } from "@/lib/gemini/client";
import {
  buildCharacterRefSheetPrompt,
  buildStoryboardPosterPrompt,
} from "@/prompts";
import type { AIProvider, CharacterLock } from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(
  prompt: string,
  provider: AIProvider = "openai"
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (provider === "gemini") {
        // Returns a data URI (data:image/png;base64,...)
        return await geminiGenerateImage(prompt);
      }

      const openai = getOpenAIClient();
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
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

// ─── Generate Character Reference Sheet ─────────────────────────────────────

export async function generateCharacterRefSheet(params: {
  characterLock: CharacterLock;
  props?: string[];
  colorPalette?: string[];
  provider?: AIProvider;
}): Promise<{ url: string }> {
  const prompt = buildCharacterRefSheetPrompt({
    characterLock: params.characterLock,
    props: params.props,
    colorPalette: params.colorPalette,
  });

  const url = await generateImage(prompt, params.provider);
  return { url };
}

// ─── Generate Storyboard Poster ─────────────────────────────────────────────

export async function generateStoryboardPoster(params: {
  title: string;
  totalDuration: number;
  sceneCount: number;
  moodTags: string[];
  scenes: {
    scene_number: number;
    title: string;
    description: string;
    camera_code: string;
    dialogue?: string | null;
    characters: string[];
  }[];
  characterDescription: string;
  style: string;
  colorPalette?: string[];
  provider?: AIProvider;
}): Promise<{ url: string }> {
  const prompt = buildStoryboardPosterPrompt(params);
  const url = await generateImage(prompt, params.provider);
  return { url };
}

// ─── Legacy: Generate individual scene image ────────────────────────────────

export async function generateSceneImage(params: {
  scene: { scene_number: number; visual_prompt: string };
  style: string;
  characterDescriptions?: Record<string, string>;
  productDescriptions?: Record<string, string>;
  backgroundDescription?: string;
}): Promise<{ url: string }> {
  let enhancedPrompt = params.scene.visual_prompt;

  if (params.characterDescriptions) {
    const charPrefix = Object.entries(params.characterDescriptions)
      .map(([name, desc]) => `${name}: ${desc}`)
      .join("; ");
    if (charPrefix) enhancedPrompt = `Characters — ${charPrefix}. ${enhancedPrompt}`;
  }

  if (params.productDescriptions) {
    const prodPrefix = Object.entries(params.productDescriptions)
      .map(([name, desc]) => `${name}: ${desc}`)
      .join("; ");
    if (prodPrefix) enhancedPrompt = `Products — ${prodPrefix}. ${enhancedPrompt}`;
  }

  if (params.backgroundDescription) {
    enhancedPrompt = `Setting — ${params.backgroundDescription}. ${enhancedPrompt}`;
  }

  const prompt = `Professional storyboard frame, ${params.style} style. ${enhancedPrompt}. No text, no watermarks, single frame composition.`;

  const url = await generateImage(prompt);
  return { url };
}

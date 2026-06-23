"use server";

import { geminiGenerateText } from "@/lib/gemini/client";
import {
  buildVideoAnalysisSystemPrompt,
  buildVideoAnalysisUserPrompt,
} from "@/prompts/video-analysis";
import type { VideoAnalysisOutput, VideoAnalysisScene } from "@/types";

export interface VideoAnalysisResult {
  success: boolean;
  data?: VideoAnalysisOutput;
  error?: string;
}

function sanitizeJson(text: string): string {
  let cleaned = text.trim();
  const block = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block?.[1]) cleaned = block[1].trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  // Gemini sometimes emits trailing commas (`...,}` / `...,]`) which break
  // JSON.parse — strip them. Also strip JS-style comments just in case.
  cleaned = cleaned
    .replace(/\/\/[^\n\r]*/g, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return cleaned;
}

/** Parse Gemini JSON robustly: try as-is, then a trailing-comma-stripped pass. */
function parseLenient(text: string): unknown {
  try {
    return JSON.parse(sanitizeJson(text));
  } catch {
    // Last resort: aggressively remove anything after the final closing brace
    // and retry once more.
    const cut = text.slice(0, text.lastIndexOf("}") + 1);
    return JSON.parse(sanitizeJson(cut));
  }
}

function normalize(raw: unknown): VideoAnalysisOutput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const scenesIn = Array.isArray(d.scenes) ? d.scenes : [];
  const scenes: VideoAnalysisScene[] = scenesIn.map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      index: typeof o.index === "number" ? o.index : i + 1,
      durationSec: typeof o.durationSec === "number" ? o.durationSec : 0,
      shot: String(o.shot ?? ""),
      cameraMotion: String(o.cameraMotion ?? ""),
      action: String(o.action ?? ""),
      productNote: String(o.productNote ?? ""),
      generationPrompt: String(o.generationPrompt ?? ""),
    };
  });
  return {
    title: String(d.title ?? "Untitled"),
    summary: String(d.summary ?? ""),
    product: String(d.product ?? ""),
    totalScenes: typeof d.totalScenes === "number" ? d.totalScenes : scenes.length,
    scenes,
  };
}

/**
 * Analyze an ordered set of frames sampled (client-side) from a reference
 * video and return a reusable storyboard. Frames are base64 JPEG strings
 * (with or without the data: prefix).
 */
export async function analyzeVideoFrames(input: {
  frames: string[];
  productName?: string;
  notes?: string;
  lang?: "vi" | "en";
}): Promise<VideoAnalysisResult> {
  try {
    const frames = (input.frames || []).filter(Boolean);
    if (frames.length < 2) {
      return { success: false, error: "Cần ít nhất 2 khung hình từ video." };
    }

    const images = frames.map((f) => ({
      base64: f.replace(/^data:[^,]+,/, ""),
      mimeType: "image/jpeg",
    }));

    const raw = await geminiGenerateText({
      systemPrompt: buildVideoAnalysisSystemPrompt(),
      userPrompt: buildVideoAnalysisUserPrompt({
        frameCount: images.length,
        productName: input.productName,
        notes: input.notes,
        lang: input.lang,
      }),
      images,
      jsonMode: true,
      temperature: 0.4,
      maxOutputTokens: 8192,
    });

    const parsed = parseLenient(raw);
    const data = normalize(parsed);
    if (data.scenes.length === 0) {
      return { success: false, error: "Không phân tích được cảnh nào từ video." };
    }
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lỗi không xác định khi phân tích video.",
    };
  }
}

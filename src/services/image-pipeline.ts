import { getOpenAIClient } from "@/lib/openai/client";
import { buildImagePrompt, buildCharacterConsistencyPrefix } from "@/prompts";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  SceneBreakdown,
  StoryboardStyle,
  GenerationStatus,
  ImageGenerationJob,
  GenerationProgress,
  Plan,
} from "@/types";
import { PLAN_LIMITS } from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateSceneImage(params: {
  scene: SceneBreakdown;
  style: StoryboardStyle;
  plan: Plan;
  characterDescriptions?: Record<string, string>;
  customStylePrompt?: string;
}): Promise<{ url: string }> {
  const openai = getOpenAIClient();
  const resolution = PLAN_LIMITS[params.plan].image_resolution;

  const characterPrefix = buildCharacterConsistencyPrefix(
    params.scene.characters,
    params.characterDescriptions ?? {}
  );

  const prompt = buildImagePrompt({
    visual_prompt: characterPrefix + params.scene.visual_prompt,
    style: params.style,
    camera_angle: params.scene.camera_angle,
    shot_type: params.scene.shot_type,
    mood: params.scene.mood,
    lighting: params.scene.lighting,
    custom_style_prompt: params.customStylePrompt,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: resolution,
        quality: params.plan === "free" ? "standard" : "hd",
        style: "natural",
      });

      const url = response.data?.[0]?.url;
      if (!url) throw new Error("No image URL in response");

      return { url };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[Image Pipeline] Scene ${params.scene.scene_number} attempt ${attempt + 1}/${MAX_RETRIES}:`,
        lastError.message
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("Image generation failed");
}

async function updateSceneStatus(
  sceneId: string,
  status: GenerationStatus,
  imageUrl?: string | null,
  error?: string | null,
  retryCount?: number
): Promise<void> {
  const supabase = await createAdminClient();
  const updateData: Record<string, unknown> = {
    generation_status: status,
  };
  if (imageUrl !== undefined) updateData.image_url = imageUrl;
  if (error !== undefined) updateData.notes = error;
  if (retryCount !== undefined) updateData.retry_count = retryCount;

  await supabase.from("scenes").update(updateData).eq("id", sceneId);
}

async function updateStoryboardStatus(
  storyboardId: string,
  status: string
): Promise<void> {
  const supabase = await createAdminClient();
  await supabase
    .from("storyboards")
    .update({ status })
    .eq("id", storyboardId);
}

export async function runImagePipeline(params: {
  storyboardId: string;
  scenes: Array<{ id: string; breakdown: SceneBreakdown }>;
  style: StoryboardStyle;
  plan: Plan;
  characterDescriptions?: Record<string, string>;
  onProgress?: (progress: GenerationProgress) => void;
}): Promise<ImageGenerationJob[]> {
  const { storyboardId, scenes, style, plan, onProgress } = params;
  const maxConcurrent = PLAN_LIMITS[plan].max_concurrent_generations;

  const jobs: ImageGenerationJob[] = scenes.map((s) => ({
    id: s.id,
    scene_id: s.id,
    storyboard_id: storyboardId,
    prompt: s.breakdown.visual_prompt,
    style,
    status: "pending" as GenerationStatus,
    progress: 0,
    image_url: null,
    error: null,
    retry_count: 0,
    max_retries: MAX_RETRIES,
    created_at: new Date().toISOString(),
  }));

  await updateStoryboardStatus(storyboardId, "generating");

  function emitProgress(): void {
    if (!onProgress) return;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const inProgress = jobs.filter(
      (j) => j.status === "generating" || j.status === "retrying"
    ).length;
    const pending = jobs.filter((j) => j.status === "pending").length;
    const currentScene =
      jobs.find((j) => j.status === "generating")
        ? scenes.findIndex(
            (s) => s.id === jobs.find((j) => j.status === "generating")?.scene_id
          ) + 1
        : null;

    onProgress({
      storyboard_id: storyboardId,
      total_scenes: jobs.length,
      completed,
      failed,
      in_progress: inProgress,
      pending,
      percent: Math.round((completed / jobs.length) * 100),
      current_scene: currentScene,
      status: "generating",
    });
  }

  async function processScene(
    job: ImageGenerationJob,
    sceneData: SceneBreakdown
  ): Promise<void> {
    job.status = "generating";
    await updateSceneStatus(job.scene_id, "generating");
    emitProgress();

    try {
      const result = await generateSceneImage({
        scene: sceneData,
        style,
        plan,
        characterDescriptions: params.characterDescriptions,
      });

      job.status = "completed";
      job.image_url = result.url;
      job.progress = 100;
      await updateSceneStatus(job.scene_id, "completed", result.url);
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "Unknown error";
      await updateSceneStatus(
        job.scene_id,
        "failed",
        null,
        job.error,
        MAX_RETRIES
      );
    }

    emitProgress();
  }

  const pendingScenes = [...scenes];
  const activePromises: Promise<void>[] = [];

  while (pendingScenes.length > 0 || activePromises.length > 0) {
    while (
      activePromises.length < maxConcurrent &&
      pendingScenes.length > 0
    ) {
      const scene = pendingScenes.shift()!;
      const job = jobs.find((j) => j.scene_id === scene.id)!;

      const promise = processScene(job, scene.breakdown).then(() => {
        const idx = activePromises.indexOf(promise);
        if (idx !== -1) activePromises.splice(idx, 1);
      });
      activePromises.push(promise);
    }

    if (activePromises.length > 0) {
      await Promise.race(activePromises);
    }
  }

  const allCompleted = jobs.every((j) => j.status === "completed");
  const anyFailed = jobs.some((j) => j.status === "failed");
  const finalStatus = allCompleted
    ? "completed"
    : anyFailed
      ? "partial"
      : "failed";

  await updateStoryboardStatus(storyboardId, finalStatus);

  return jobs;
}

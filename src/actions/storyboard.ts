"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateStoryboardBreakdown } from "@/services/ai-engine";
import { runImagePipeline } from "@/services/image-pipeline";
import { checkCredits, deductCredits, checkSceneLimits } from "@/services/credits";
import type {
  ActionResult,
  Storyboard,
  Scene,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  GenerationProgress,
} from "@/types";

export async function createStoryboard(
  projectId: string,
  title: string,
  style: string
): Promise<ActionResult<Storyboard>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return { success: false, error: "Project not found" };

  const { data: storyboard, error: dbError } = await supabase
    .from("storyboards")
    .insert({
      project_id: projectId,
      title,
      style,
      scene_count: 0,
      status: "idle",
    })
    .select()
    .single();

  if (dbError) return { success: false, error: dbError.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: storyboard };
}

export async function generateStoryboard(
  input: StoryboardGenerationInput & {
    project_id: string;
    storyboard_id: string;
  }
): Promise<
  ActionResult<{
    breakdown: StoryboardGenerationOutput;
    scenes: Scene[];
    progress: GenerationProgress;
  }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const credits = await checkCredits(user.id);
  if (!credits.allowed) {
    return {
      success: false,
      error: "No credits remaining. Upgrade your plan.",
      code: "NO_CREDITS",
    };
  }

  const sceneLimits = await checkSceneLimits(user.id, input.storyboard_id);
  if (!sceneLimits.allowed) {
    return {
      success: false,
      error: `Scene limit reached (${sceneLimits.max}). Upgrade for more scenes.`,
      code: "LIMIT_REACHED",
    };
  }

  const effectiveSceneCount = Math.min(
    input.scene_count,
    sceneLimits.max === -1
      ? input.scene_count
      : sceneLimits.max - sceneLimits.current
  );

  await supabase
    .from("storyboards")
    .update({ status: "generating" })
    .eq("id", input.storyboard_id);

  let breakdown: StoryboardGenerationOutput;
  try {
    breakdown = await generateStoryboardBreakdown({
      ...input,
      scene_count: effectiveSceneCount,
    });
  } catch (err) {
    await supabase
      .from("storyboards")
      .update({ status: "failed" })
      .eq("id", input.storyboard_id);

    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Storyboard generation failed",
    };
  }

  const sceneInserts = breakdown.scenes.map((scene, index) => ({
    storyboard_id: input.storyboard_id,
    order_index: sceneLimits.current + index,
    title: scene.title,
    prompt: input.story_idea,
    visual_prompt: scene.visual_prompt,
    description: scene.description,
    dialogue: scene.dialogue,
    action_notes: scene.action_notes,
    camera_angle: scene.camera_angle,
    shot_type: scene.shot_type,
    mood: scene.mood,
    lighting: scene.lighting,
    location: scene.location,
    characters: scene.characters,
    duration_seconds: scene.duration_seconds,
    transition: scene.transition,
    generation_status: "pending",
    retry_count: 0,
  }));

  const { data: scenes, error: insertError } = await supabase
    .from("scenes")
    .insert(sceneInserts)
    .select();

  if (insertError || !scenes) {
    return { success: false, error: insertError?.message ?? "Failed to save scenes" };
  }

  await supabase
    .from("storyboards")
    .update({ scene_count: sceneLimits.current + scenes.length })
    .eq("id", input.storyboard_id);

  const characterDescriptions: Record<string, string> = {};
  if (input.character_descriptions) {
    for (const char of input.character_descriptions) {
      characterDescriptions[char.name] = char.appearance;
    }
  }

  const jobs = await runImagePipeline({
    storyboardId: input.storyboard_id,
    scenes: scenes.map((s, i) => ({
      id: s.id,
      breakdown: breakdown.scenes[i]!,
    })),
    style: input.style,
    plan: credits.plan,
    characterDescriptions,
  });

  const creditsUsed = scenes.length;
  await deductCredits(user.id, creditsUsed, "batch_generation", {
    storyboard_id: input.storyboard_id,
    project_id: input.project_id,
    scene_count: scenes.length,
  });

  const { data: updatedScenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("storyboard_id", input.storyboard_id)
    .order("order_index", { ascending: true });

  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  revalidatePath(`/projects/${input.project_id}`);
  revalidatePath(
    `/projects/${input.project_id}/storyboard/${input.storyboard_id}`
  );

  return {
    success: true,
    data: {
      breakdown,
      scenes: updatedScenes ?? [],
      progress: {
        storyboard_id: input.storyboard_id,
        total_scenes: scenes.length,
        completed,
        failed,
        in_progress: 0,
        pending: 0,
        percent: Math.round((completed / scenes.length) * 100),
        current_scene: null,
        status: failed > 0 ? "partial" : "completed",
      },
    },
  };
}

export async function regenerateScene(
  sceneId: string,
  storyboardId: string,
  projectId: string
): Promise<ActionResult<Scene>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const credits = await checkCredits(user.id);
  if (!credits.allowed) {
    return { success: false, error: "No credits remaining" };
  }

  const { data: scene } = await supabase
    .from("scenes")
    .select("*")
    .eq("id", sceneId)
    .single();

  if (!scene) return { success: false, error: "Scene not found" };

  const { data: storyboard } = await supabase
    .from("storyboards")
    .select("style")
    .eq("id", storyboardId)
    .single();

  if (!storyboard) return { success: false, error: "Storyboard not found" };

  await supabase
    .from("scenes")
    .update({ generation_status: "generating" })
    .eq("id", sceneId);

  try {
    const { generateSceneImage } = await import("@/services/image-pipeline");
    const result = await generateSceneImage({
      scene: {
        scene_number: scene.order_index + 1,
        title: scene.title,
        description: scene.description,
        visual_prompt: scene.visual_prompt,
        dialogue: scene.dialogue,
        action_notes: scene.action_notes,
        camera_angle: scene.camera_angle,
        shot_type: scene.shot_type,
        mood: scene.mood,
        lighting: scene.lighting,
        location: scene.location,
        characters: scene.characters ?? [],
        duration_seconds: scene.duration_seconds,
        transition: scene.transition,
        continuity_notes: "",
      },
      style: storyboard.style,
      plan: credits.plan,
    });

    const { data: updated } = await supabase
      .from("scenes")
      .update({
        image_url: result.url,
        generation_status: "completed",
        retry_count: scene.retry_count + 1,
      })
      .eq("id", sceneId)
      .select()
      .single();

    await deductCredits(user.id, 1, "scene_regeneration", {
      scene_id: sceneId,
      storyboard_id: storyboardId,
    });

    revalidatePath(`/projects/${projectId}/storyboard/${storyboardId}`);
    return { success: true, data: updated! };
  } catch (err) {
    await supabase
      .from("scenes")
      .update({ generation_status: "failed" })
      .eq("id", sceneId);

    return {
      success: false,
      error: err instanceof Error ? err.message : "Regeneration failed",
    };
  }
}

export async function deleteScene(
  sceneId: string,
  storyboardId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { error: dbError } = await supabase
    .from("scenes")
    .delete()
    .eq("id", sceneId);

  if (dbError) return { success: false, error: dbError.message };

  const { count } = await supabase
    .from("scenes")
    .select("*", { count: "exact", head: true })
    .eq("storyboard_id", storyboardId);

  await supabase
    .from("storyboards")
    .update({ scene_count: count ?? 0 })
    .eq("id", storyboardId);

  revalidatePath(`/projects/${projectId}/storyboard/${storyboardId}`);
  return { success: true, data: undefined };
}

export async function getStoryboardWithScenes(
  storyboardId: string
): Promise<{ storyboard: Storyboard; scenes: Scene[] } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: storyboard } = await supabase
    .from("storyboards")
    .select("*")
    .eq("id", storyboardId)
    .single();

  if (!storyboard) return null;

  const { data: scenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("storyboard_id", storyboardId)
    .order("order_index", { ascending: true });

  return { storyboard, scenes: scenes ?? [] };
}

export async function reorderScenes(
  storyboardId: string,
  sceneIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const updates = sceneIds.map((id, index) =>
    supabase
      .from("scenes")
      .update({ order_index: index })
      .eq("id", id)
      .eq("storyboard_id", storyboardId)
  );

  await Promise.all(updates);
  return { success: true, data: undefined };
}

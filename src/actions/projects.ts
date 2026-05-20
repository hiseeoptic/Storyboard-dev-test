"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkProjectLimits } from "@/services/credits";
import type { ActionResult, Project, Genre, ProjectStatus } from "@/types";

export async function createProject(
  formData: FormData
): Promise<ActionResult<Project>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const genre = formData.get("genre") as Genre;

  if (!title?.trim()) {
    return { success: false, error: "Title is required" };
  }

  const limits = await checkProjectLimits(user.id);
  if (!limits.allowed) {
    return {
      success: false,
      error: `Project limit reached (${limits.max}). Upgrade your plan for more projects.`,
      code: "LIMIT_REACHED",
    };
  }

  const { data: project, error: dbError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      genre: genre ?? "other",
      status: "draft" as ProjectStatus,
    })
    .select()
    .single();

  if (dbError) {
    return { success: false, error: dbError.message };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: true, data: project };
}

export async function updateProject(
  projectId: string,
  formData: FormData
): Promise<ActionResult<Project>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const title = formData.get("title") as string | null;
  const description = formData.get("description") as string | null;
  const genre = formData.get("genre") as Genre | null;
  const status = formData.get("status") as ProjectStatus | null;

  const updates: Record<string, unknown> = {};
  if (title !== null) updates.title = title.trim();
  if (description !== null) updates.description = description.trim();
  if (genre !== null) updates.genre = genre;
  if (status !== null) updates.status = status;

  const { data: project, error: dbError } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (dbError) {
    return { success: false, error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, data: project };
}

export async function deleteProject(
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { error: dbError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (dbError) {
    return { success: false, error: dbError.message };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return data ?? [];
}

export async function getProject(
  projectId: string
): Promise<Project | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  return data;
}

import { createAdminClient } from "@/lib/supabase/server";
import type { Plan, UsageAction } from "@/types";
import { PLAN_LIMITS } from "@/types";

export async function checkCredits(
  userId: string
): Promise<{ allowed: boolean; remaining: number; plan: Plan }> {
  const supabase = await createAdminClient();

  const { data: profile } = await supabase
    .from("users")
    .select("plan, credits_remaining")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { allowed: false, remaining: 0, plan: "free" };
  }

  const plan = profile.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  if (limits.credits_per_month === -1) {
    return { allowed: true, remaining: -1, plan };
  }

  return {
    allowed: profile.credits_remaining > 0,
    remaining: profile.credits_remaining,
    plan,
  };
}

export async function deductCredits(
  userId: string,
  amount: number,
  action: UsageAction,
  metadata: Record<string, unknown> = {}
): Promise<{ remaining: number }> {
  const supabase = await createAdminClient();

  const { data: profile } = await supabase
    .from("users")
    .select("credits_remaining, plan")
    .eq("id", userId)
    .single();

  if (!profile) throw new Error("User profile not found");

  const plan = profile.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  let newRemaining = profile.credits_remaining;
  if (limits.credits_per_month !== -1) {
    newRemaining = Math.max(0, profile.credits_remaining - amount);
    await supabase
      .from("users")
      .update({ credits_remaining: newRemaining })
      .eq("id", userId);
  }

  await supabase.from("usage_records").insert({
    user_id: userId,
    action,
    credits_used: amount,
    metadata,
  });

  return { remaining: newRemaining };
}

export async function checkProjectLimits(
  userId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const supabase = await createAdminClient();

  const { data: profile } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = (profile?.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  if (limits.max_projects === -1) {
    return { allowed: true, current: 0, max: -1 };
  }

  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const current = count ?? 0;
  return {
    allowed: current < limits.max_projects,
    current,
    max: limits.max_projects,
  };
}

export async function checkSceneLimits(
  userId: string,
  storyboardId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const supabase = await createAdminClient();

  const { data: profile } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = (profile?.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  if (limits.max_scenes_per_storyboard === -1) {
    return { allowed: true, current: 0, max: -1 };
  }

  const { count } = await supabase
    .from("scenes")
    .select("*", { count: "exact", head: true })
    .eq("storyboard_id", storyboardId);

  const current = count ?? 0;
  return {
    allowed: current < limits.max_scenes_per_storyboard,
    current,
    max: limits.max_scenes_per_storyboard,
  };
}

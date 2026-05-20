"use server";

import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import type { ActionResult, Plan } from "@/types";

export async function createCheckout(
  plan: Exclude<Plan, "free">
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  try {
    const url = await createCheckoutSession(
      user.id,
      user.email!,
      plan,
      profile?.stripe_customer_id ?? undefined
    );
    return { success: true, data: { url } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Checkout failed",
    };
  }
}

export async function manageBilling(): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return { success: false, error: "No billing account found" };
  }

  try {
    const url = await createPortalSession(profile.stripe_customer_id);
    return { success: true, data: { url } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Portal session failed",
    };
  }
}

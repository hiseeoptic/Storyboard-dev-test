"use server";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import type { ActionResult, Plan } from "@/types";

export async function createCheckout(
  plan: Exclude<Plan, "free">
): Promise<ActionResult<{ url: string }>> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  try {
    const url = await createCheckoutSession(
      session.user.id,
      session.user.email,
      plan,
      user?.stripeCustomerId ?? undefined
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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return { success: false, error: "No billing account found" };
  }

  try {
    const url = await createPortalSession(user.stripeCustomerId);
    return { success: true, data: { url } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Portal session failed",
    };
  }
}

import { prisma } from "@/lib/db/prisma";
import type { Plan } from "@/types";
import { PLAN_LIMITS } from "@/types";

export async function checkCredits(
  userId: string
): Promise<{ allowed: boolean; remaining: number; plan: Plan }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, creditsRemaining: true },
  });

  if (!user) return { allowed: false, remaining: 0, plan: "free" };

  const plan = user.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  if (limits.credits_per_month === -1) {
    return { allowed: true, remaining: -1, plan };
  }

  return {
    allowed: user.creditsRemaining > 0,
    remaining: user.creditsRemaining,
    plan,
  };
}

export async function deductCredits(
  userId: string,
  amount: number
): Promise<{ remaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsRemaining: true, plan: true },
  });

  if (!user) throw new Error("User not found");

  const plan = user.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  if (limits.credits_per_month === -1) {
    return { remaining: -1 };
  }

  const newRemaining = Math.max(0, user.creditsRemaining - amount);
  await prisma.user.update({
    where: { id: userId },
    data: { creditsRemaining: newRemaining },
  });

  return { remaining: newRemaining };
}

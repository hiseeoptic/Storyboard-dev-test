import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { BillingClient } from "./billing-client";
import type { Plan } from "@/types";

export const metadata = { title: "Billing - StoryboardAI" };

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, creditsRemaining: true },
  });

  return (
    <BillingClient
      currentPlan={(user?.plan ?? "free") as Plan}
      creditsRemaining={user?.creditsRemaining ?? 0}
    />
  );
}

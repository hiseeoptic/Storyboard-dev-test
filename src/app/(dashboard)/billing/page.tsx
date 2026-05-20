import { redirect } from "next/navigation";
import { getSession, getUserProfile } from "@/actions/auth";
import { BillingClient } from "./billing-client";
import type { Plan } from "@/types";

export const metadata = { title: "Billing - StoryboardAI" };

export default async function BillingPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const profile = await getUserProfile();
  const currentPlan = (profile?.plan ?? "free") as Plan;
  const credits = profile?.credits_remaining ?? 0;

  return (
    <BillingClient currentPlan={currentPlan} creditsRemaining={credits} />
  );
}

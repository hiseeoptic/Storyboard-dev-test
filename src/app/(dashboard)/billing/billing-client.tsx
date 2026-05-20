"use client";

import { useState } from "react";
import { PricingCard } from "@/components/billing/pricing-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createCheckout, manageBilling } from "@/actions/billing";
import { PLAN_LIMITS } from "@/types";
import type { Plan } from "@/types";

interface BillingClientProps {
  currentPlan: Plan;
  creditsRemaining: number;
}

export function BillingClient({
  currentPlan,
  creditsRemaining,
}: BillingClientProps) {
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const limits = PLAN_LIMITS[currentPlan];
  const creditPercent =
    limits.credits_per_month === -1
      ? 100
      : Math.round((creditsRemaining / limits.credits_per_month) * 100);

  const handleUpgrade = async (plan: "pro" | "enterprise") => {
    setUpgrading(plan);
    const result = await createCheckout(plan);
    if (result.success) {
      window.location.href = result.data.url;
    }
    setUpgrading(null);
  };

  const handleManage = async () => {
    const result = await manageBilling();
    if (result.success) {
      window.location.href = result.data.url;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your subscription and usage
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Current Usage</CardTitle>
            <Badge className="capitalize">{currentPlan} Plan</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>Credits</span>
              <span className="text-muted-foreground">
                {limits.credits_per_month === -1
                  ? "Unlimited"
                  : `${creditsRemaining} / ${limits.credits_per_month}`}
              </span>
            </div>
            <Progress value={creditPercent} />
          </div>

          {currentPlan !== "free" && (
            <Button variant="outline" size="sm" onClick={handleManage}>
              Manage Subscription
            </Button>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            name="Free"
            description="Get started with basic features"
            price={0}
            features={PLAN_LIMITS.free.features}
            isCurrentPlan={currentPlan === "free"}
            onSelect={() => {}}
          />
          <PricingCard
            name="Pro"
            description="For professional filmmakers"
            price={29}
            features={PLAN_LIMITS.pro.features}
            isCurrentPlan={currentPlan === "pro"}
            onSelect={() => handleUpgrade("pro")}
            loading={upgrading === "pro"}
            highlighted
          />
          <PricingCard
            name="Enterprise"
            description="For studios and teams"
            price={99}
            features={PLAN_LIMITS.enterprise.features}
            isCurrentPlan={currentPlan === "enterprise"}
            onSelect={() => handleUpgrade("enterprise")}
            loading={upgrading === "enterprise"}
          />
        </div>
      </div>
    </div>
  );
}

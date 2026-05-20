import type { Plan } from "@/types";

export interface StripePlan {
  name: string;
  description: string;
  price_monthly: number;
  price_id: string;
  features: string[];
}

export const STRIPE_PLANS: Record<Exclude<Plan, "free">, StripePlan> = {
  pro: {
    name: "Pro",
    description: "For professional filmmakers and content creators",
    price_monthly: 29,
    price_id: process.env.STRIPE_PRO_PRICE_ID ?? "",
    features: [
      "25 projects",
      "50 scenes per storyboard",
      "200 AI credits/month",
      "1024x1024 resolution",
      "PDF, PPTX, MP4 export",
      "Priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    description: "For studios and production teams",
    price_monthly: 99,
    price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
    features: [
      "Unlimited projects",
      "Unlimited scenes",
      "Unlimited AI credits",
      "1792x1024 resolution",
      "All export formats",
      "Custom integrations",
      "Dedicated support",
      "Team collaboration",
    ],
  },
};

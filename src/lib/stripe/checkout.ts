import Stripe from "stripe";
import { getStripeClient } from "./client";
import type { Plan } from "@/types";
import { STRIPE_PLANS } from "./plans";

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: Exclude<Plan, "free">,
  customerId?: string
): Promise<string> {
  const stripe = getStripeClient();
  const stripePlan = STRIPE_PLANS[plan];

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: stripePlan.price_id, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
    metadata: { userId, plan },
  };

  if (customerId) {
    params.customer = customerId;
  } else {
    params.customer_email = email;
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return session.url;
}

export async function createPortalSession(
  customerId: string
): Promise<string> {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return session.url;
}

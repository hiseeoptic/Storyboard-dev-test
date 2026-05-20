import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/types";
import type { Plan } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as Plan | undefined;

      if (userId && plan) {
        await supabase
          .from("users")
          .update({
            plan,
            stripe_customer_id: session.customer as string,
            credits_remaining: PLAN_LIMITS[plan].credits_per_month,
          })
          .eq("id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabase
        .from("users")
        .update({
          plan: "free",
          credits_remaining: PLAN_LIMITS.free.credits_per_month,
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: user } = await supabase
        .from("users")
        .select("plan")
        .eq("stripe_customer_id", customerId)
        .single();

      if (user) {
        const limits = PLAN_LIMITS[user.plan as Plan];
        if (limits.credits_per_month !== -1) {
          await supabase
            .from("users")
            .update({ credits_remaining: limits.credits_per_month })
            .eq("stripe_customer_id", customerId);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/db/prisma";
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as Plan | undefined;

      if (userId && plan) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeCustomerId: session.customer as string,
            creditsRemaining: PLAN_LIMITS[plan].credits_per_month === -1
              ? 999999
              : PLAN_LIMITS[plan].credits_per_month,
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          plan: "free",
          creditsRemaining: PLAN_LIMITS.free.credits_per_month,
        },
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
        select: { plan: true },
      });

      if (user) {
        const limits = PLAN_LIMITS[user.plan as Plan];
        if (limits.credits_per_month !== -1) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { creditsRemaining: limits.credits_per_month },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

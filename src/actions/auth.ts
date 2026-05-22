"use server";

import { signIn, signOut } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import type { ActionResult } from "@/types";

export async function loginWithCredentials(
  formData: FormData
): Promise<ActionResult<{ redirect: string }>> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirect") as string) || "/dashboard";

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true, data: { redirect: redirectTo } };
  } catch {
    return { success: false, error: "Invalid email or password" };
  }
}

export async function registerUser(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const name = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
    },
  });

  return { success: true, data: { message: "Account created! You can now sign in." } };
}

export async function loginWithOAuth(provider: "google" | "github") {
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      plan: true,
      creditsRemaining: true,
      stripeCustomerId: true,
    },
  });
}

export async function updateUserName(
  name: string
): Promise<ActionResult<{ name: string }>> {
  const { auth } = await import("@/lib/auth/config");
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  return { success: true, data: { name } };
}

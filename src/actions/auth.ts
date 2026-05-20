"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

export async function signIn(
  formData: FormData
): Promise<ActionResult<{ redirect: string }>> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirect") as string) ?? "/dashboard";

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: true, data: { redirect: redirectTo } };
}

export async function signUp(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return {
    success: true,
    data: { message: "Check your email to confirm your account" },
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const email = formData.get("email") as string;

  if (!email) {
    return { success: false, error: "Email is required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: { message: "Password reset email sent. Check your inbox." },
  };
}

export async function resetPassword(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return { success: false, error: "Both password fields are required" };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { message: "Password updated successfully" } };
}

export async function signInWithOAuth(
  provider: "google" | "github",
  redirectTo?: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback?redirect=${redirectTo ?? "/dashboard"}`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { url: data.url } };
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<{ error: string } | never> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function registerAction(formData: {
  email: string;
  password: string;
}): Promise<{ error: string } | { success: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "가입 확인 이메일을 보냈습니다. 이메일을 확인해주세요." };
}

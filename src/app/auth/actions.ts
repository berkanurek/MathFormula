"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  success: boolean;
  error?: string;
};

export async function signUp(email: string, password: string): Promise<AuthActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signIn(email: string, password: string): Promise<AuthActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signOut(): Promise<AuthActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

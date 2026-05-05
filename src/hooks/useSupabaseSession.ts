"use client";

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import { useEffect, useMemo, useState } from "react";

export function useSupabaseSession() {
  const supabaseClient = useMemo<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [toast, setToast] = useState<{
    open: boolean;
    tone: "success" | "error";
    message: string;
  }>({ open: false, tone: "success", message: "" });

  const showToast = useMemo(
    () =>
      ({ tone, message }: { tone: "success" | "error"; message: string }) =>
        setToast({ open: true, tone, message }),
    [],
  );

  useEffect(() => {
    if (!toast.open) return;
    const t = window.setTimeout(
      () => setToast((s) => ({ ...s, open: false })),
      2400,
    );
    return () => window.clearTimeout(t);
  }, [toast.open]);

  useEffect(() => {
    if (!supabaseClient) return;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setCurrentUser(user ?? null);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseClient]);

  useEffect(() => {
    if (currentUser) {
      posthog.identify(currentUser.id, {
        email: currentUser.email ?? "",
      });
      return;
    }
    posthog.reset();
  }, [currentUser]);

  const handleSignIn = async (email: string, password: string) => {
    if (!supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
  };

  const handleSignUp = async (email: string, password: string) => {
    if (!supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
    });
    if (error) throw new Error(error.message);
  };

  const handleSignOut = async () => {
    if (!supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw new Error(error.message);
    posthog.reset();
  };

  return {
    supabaseClient,
    currentUser,
    toast,
    showToast,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  };
}

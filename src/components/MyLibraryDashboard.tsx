"use client";

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import {
  MyLibraryWorkspace,
  type LibraryFolder,
  type LibraryFormula,
} from "@/components/MyLibraryWorkspace";
import { Toast } from "@/components/Toast";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MyLibraryDashboard({
  currentUserId,
  initialFolders,
  initialFormulas,
  loadErrorMessage,
}: {
  currentUserId: string;
  initialFolders: LibraryFolder[];
  initialFormulas: LibraryFormula[];
  loadErrorMessage: string | null;
}) {
  const t = useTranslations("myLibraryPage");
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
  };

  return (
    <div className="flex min-h-[100dvh] flex-col font-body-md text-body-md">
      <Header
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onSignOut={handleSignOut}
        onToast={showToast}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-lg px-4 py-lg md:px-6">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-900/30" />
          <div className="relative flex flex-col gap-md border-b border-slate-200 bg-slate-50/90 px-gutter py-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80 md:flex-row md:items-end md:justify-between">
            <div className="space-y-xs">
              <p className="font-label-caps text-label-caps text-primary">
                {t("badge")}
              </p>
              <h1 className="font-h1 text-h1 text-slate-900 dark:text-slate-100">
                {t("title")}
              </h1>
              <p className="max-w-xl font-body-md text-body-md text-slate-600 dark:text-slate-400">
                {t("description")}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-DEFAULT border border-slate-200 bg-white px-md py-sm font-body-sm text-body-sm text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <span
                className="material-symbols-outlined text-[20px] text-primary"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                edit_note
              </span>
              {t("openLiveEditor")}
            </Link>
          </div>
          <div className="relative p-gutter">
            {loadErrorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-md py-md dark:border-red-900/50 dark:bg-red-950/40">
                <p className="font-body-sm text-body-sm text-red-700 dark:text-red-300">
                  {loadErrorMessage}
                </p>
              </div>
            ) : (
              <MyLibraryWorkspace
                currentUserId={currentUserId}
                initialFolders={initialFolders}
                initialFormulas={initialFormulas}
                onToast={showToast}
              />
            )}
          </div>
        </div>
      </main>

      <Toast open={toast.open} tone={toast.tone} message={toast.message} />
      <Footer />
    </div>
  );
}

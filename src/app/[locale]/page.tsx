"use client";

import { Footer } from "@/components/Footer";
import { FormulaLibrary } from "@/components/FormulaLibrary";
import { Header } from "@/components/Header";
import { LiveEditor } from "@/components/LiveEditor";
import { Toast } from "@/components/Toast";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

export default function Home() {
  const t = useTranslations("home");
  const { supabaseClient, currentUser, toast, showToast, handleSignIn, handleSignUp, handleSignOut } =
    useSupabaseSession();

  const initialLatex = useMemo(() => {
    if (typeof window === "undefined") {
      return "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("latex") ?? "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
  }, []);

  const [latex, setLatex] = useState<string>(initialLatex);
  const [editorFocusToken, setEditorFocusToken] = useState(0);
  const editorTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const latexFromQuery = params.get("latex");
    if (!latexFromQuery) return;
    const frame = window.requestAnimationFrame(() => {
      setLatex(latexFromQuery);
      setEditorFocusToken((token) => token + 1);
      editorTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleSendToEditor = (nextLatex: string) => {
    setLatex(nextLatex);
    setEditorFocusToken((token) => token + 1);
    editorTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex min-h-screen flex-col font-body-md text-body-md">
      <Header
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onSignOut={handleSignOut}
        onToast={showToast}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-lg px-4 py-lg md:px-6 lg:px-8">
        <div className="flex flex-col gap-sm">
          <h1 className="font-h1 text-h1 text-slate-900 dark:text-slate-100">
            {t("hero.title")}
          </h1>
          <p className="max-w-3xl font-body-md text-body-md text-slate-600 dark:text-slate-400">
            {t("hero.subtitle")}
          </p>
          <div className="mt-sm flex border-b border-slate-200 dark:border-slate-800">
            <button className="px-md py-xs font-label-caps text-label-caps text-primary border-b-2 border-primary -mb-[1px]">
              {t("workspaceTab")}
            </button>
          </div>
        </div>

        <div ref={editorTopRef} />
        <LiveEditor
          latex={latex}
          onLatexChange={setLatex}
          currentUserId={currentUser?.id ?? null}
          supabase={supabaseClient}
          focusToken={editorFocusToken}
          onToast={showToast}
          onOcrComplete={() => {
            setEditorFocusToken((n) => n + 1);
            editorTopRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        />
        <FormulaLibrary
          currentUserId={currentUser?.id ?? null}
          onToast={showToast}
          onSendToEditor={handleSendToEditor}
        />
      </main>

      <Toast open={toast.open} tone={toast.tone} message={toast.message} />
      <Footer />
    </div>
  );
}

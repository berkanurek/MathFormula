"use client";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Toast } from "@/components/Toast";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { Link } from "@/i18n/navigation";
import { ClipboardPaste, Library, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";

const stepIcons = [SquarePen, ClipboardPaste, Library] as const;

export function HowItWorksClient() {
  const t = useTranslations("howItWorks");
  const {
    currentUser,
    toast,
    showToast,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  } = useSupabaseSession();

  return (
    <div className="flex min-h-[100dvh] flex-col font-body-md text-body-md">
      <Header
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onSignOut={handleSignOut}
        onToast={showToast}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-lg px-4 py-lg md:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl dark:bg-indigo-900/40" />
          <div className="relative px-gutter py-lg md:py-xl">
            <p className="font-label-caps text-label-caps text-primary">
              {t("badge")}
            </p>
            <h1 className="mt-xs font-h1 text-h1 text-slate-900 dark:text-slate-100">
              {t("title")}
            </h1>
            <p className="mt-sm max-w-2xl font-body-md text-body-md text-slate-600 dark:text-slate-400">
              {t("intro")}
            </p>
          </div>
        </header>

        <section className="grid gap-gutter lg:grid-cols-3">
          {([1, 2, 3] as const).map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <article
                key={step}
                className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-gutter shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative z-10 flex flex-col gap-md">
                  <div className="flex items-center gap-sm">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
                      <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                    </span>
                    <span className="font-label-caps text-label-caps text-slate-500 dark:text-slate-400">
                      {t("stepLabel", { step })}
                    </span>
                  </div>
                  <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
                    {t(`steps.${step}.title`)}
                  </h2>
                  <p className="font-body-md text-body-md text-slate-600 dark:text-slate-400">
                    {t(`steps.${step}.description`)}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-gutter py-lg text-center dark:border-slate-700 dark:bg-slate-950/50">
          <p className="font-body-md text-body-md text-slate-900 dark:text-slate-100">
            {t("ctaTitle")}
          </p>
          <div className="mt-md flex flex-wrap items-center justify-center gap-sm">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-DEFAULT bg-primary px-md py-sm font-body-sm text-body-sm text-on-primary shadow-sm transition-colors hover:bg-surface-tint"
            >
              {t("openLiveEditor")}
            </Link>
            {currentUser ? (
              <Link
                href="/my-library"
                className="inline-flex items-center justify-center rounded-DEFAULT border border-slate-200 bg-white px-md py-sm font-body-sm text-body-sm text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {t("goMyLibrary")}
              </Link>
            ) : null}
          </div>
        </section>
      </main>

      <Toast open={toast.open} tone={toast.tone} message={toast.message} />
      <Footer />
    </div>
  );
}

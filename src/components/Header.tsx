"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Languages, Loader2, Menu, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

const localeList = routing.locales;

function BrandWordmark() {
  return (
    <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
      Math<span className="text-primary">Formula</span>
    </span>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const iconCircleShell =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";

/** Language control: icon + locale code, wider than icon-only for clarity on mobile. */
const langTriggerClass =
  "inline-flex h-9 min-w-[4.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-w-[4.75rem] sm:px-3";

const iconAvatar = `${iconCircleShell} bg-indigo-50 font-semibold text-body-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100`;

function drawerNavLinkClass(active: boolean) {
  return active
    ? "border-l-4 border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
    : "border-l-4 border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
}

export function Header({
  currentUser,
  onSignIn,
  onSignUp,
  onSignOut,
  onToast,
}: {
  currentUser: AuthenticatedUser | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onToast: (toast: { tone: "success" | "error"; message: string }) => void;
}) {
  const t = useTranslations("header");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("header.toast");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;

  const isLiveEditorActive = pathname === "/";
  const isMyLibraryActive = pathname.startsWith("/my-library");
  const isHowItWorksActive = pathname.startsWith("/how-it-works");

  const navLinkClass = (active: boolean) =>
    active
      ? "border-indigo-600 font-semibold text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
      : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100";

  const [mounted, setMounted] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  const supabaseClient = useMemo<SupabaseClient | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthModalOpen) setIsGoogleLoading(false);
  }, [isAuthModalOpen]);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  /** Close mobile drawer when crossing desktop breakpoint. */
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setIsMobileDrawerOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mounted]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    if (!isLangOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!langMenuRef.current?.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isLangOpen]);

  const userInitial = useMemo(() => {
    const firstChar = currentUser?.email?.trim().charAt(0).toUpperCase();
    return firstChar || "U";
  }, [currentUser?.email]);

  const handleGoogleLogin = async () => {
    if (!supabaseClient) {
      onToast({ tone: "error", message: tToast("supabaseMissing") });
      return;
    }
    setIsGoogleLoading(true);
    try {
      const returnLocale = `/${locale}`;
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnLocale)}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      onToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : tToast("googleOAuthFailed"),
      });
      setIsGoogleLoading(false);
    }
  };

  const submitAuth = async () => {
    if (!email.trim() || !password.trim()) {
      onToast({ tone: "error", message: tToast("emailPasswordRequired") });
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === "sign-in") {
        await onSignIn(email.trim(), password);
        onToast({ tone: "success", message: tToast("signedIn") });
      } else {
        await onSignUp(email.trim(), password);
        onToast({
          tone: "success",
          message: tToast("signUpSuccess"),
        });
      }
      setIsAuthModalOpen(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      onToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : tToast("authFailed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const localeLabel = (loc: Locale) =>
    t(
      `language.${loc}` as
        | "language.en"
        | "language.de"
        | "language.cs"
        | "language.tr",
    );

  const closeDrawer = () => setIsMobileDrawerOpen(false);

  const openAuthFromDrawer = (mode: "sign-in" | "sign-up") => {
    closeDrawer();
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const desktopLangDropdown = (
    <div className="relative" ref={langMenuRef}>
      <button
        type="button"
        onClick={() => setIsLangOpen((o) => !o)}
        className={langTriggerClass}
        aria-expanded={isLangOpen}
        aria-haspopup="listbox"
        title={t("language.label")}
        aria-label={`${t("language.label")}: ${localeLabel(locale)}`}
      >
        <Languages className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200 text-xs sm:text-sm tabular-nums">
          {locale}
        </span>
      </button>
      {isLangOpen ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {localeList.map((loc) => (
            <li key={loc} role="option" aria-selected={loc === locale}>
              <button
                type="button"
                className={
                  loc === locale
                    ? "w-full px-3 py-2 text-left font-body-sm text-body-sm text-primary"
                    : "w-full px-3 py-2 text-left font-body-sm text-body-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }
                onClick={() => {
                  if (loc !== locale) {
                    router.replace(pathname, { locale: loc });
                  }
                  setIsLangOpen(false);
                }}
              >
                {localeLabel(loc)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const desktopAuth = currentUser ? (
    <div className="relative md:overflow-visible">
      <button
        type="button"
        onClick={() => setIsAccountMenuOpen((open) => !open)}
        className={iconAvatar}
        title={t("accountMenu")}
      >
        {userInitial}
      </button>
      {isAccountMenuOpen ? (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[220px] w-max max-w-[min(18rem,calc(100vw-2rem))] overflow-visible rounded-lg border border-slate-200 bg-white p-sm shadow-md md:max-h-none md:overflow-y-visible dark:border-slate-700 dark:bg-slate-900"
          role="menu"
        >
          <p className="break-words text-left font-body-sm text-body-sm leading-snug text-slate-600 dark:text-slate-400">
            {currentUser.email}
          </p>
          <button
            type="button"
            className="mt-xs w-full rounded-DEFAULT px-2 py-1 text-left font-body-sm text-body-sm text-indigo-600 transition-colors hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-800"
            onClick={async () => {
              try {
                await onSignOut();
                onToast({ tone: "success", message: tToast("signedOut") });
              } catch (error) {
                onToast({
                  tone: "error",
                  message:
                    error instanceof Error
                      ? error.message
                      : tToast("signOutFailed"),
                });
              } finally {
                setIsAccountMenuOpen(false);
              }
            }}
          >
            {t("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  ) : (
    <>
      <button
        type="button"
        onClick={() => {
          setAuthMode("sign-in");
          setIsAuthModalOpen(true);
        }}
        className="rounded-DEFAULT px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        {t("signIn")}
      </button>
      <button
        type="button"
        onClick={() => {
          setAuthMode("sign-up");
          setIsAuthModalOpen(true);
        }}
        className="rounded-DEFAULT bg-primary px-3 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-surface-tint"
      >
        {t("signUp")}
      </button>
    </>
  );

  const mobileDrawer =
    mounted && isMobileDrawerOpen ? (
      <>
        <div
          className="fixed inset-0 z-[110] bg-black/45 md:hidden dark:bg-black/60"
          aria-hidden
          onClick={closeDrawer}
        />
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-drawer-title"
          className="fixed inset-y-0 right-0 z-[120] flex max-h-[100dvh] w-[min(100vw,20rem)] flex-col border-l border-slate-200 bg-white shadow-2xl md:hidden dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2
              id="mobile-drawer-title"
              className="flex min-w-0 shrink-0 items-center"
            >
              <BrandWordmark />
            </h2>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={t("closeMainMenu")}
              onClick={closeDrawer}
            >
              <X className="h-6 w-6" strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <nav
              className="flex flex-col gap-0 p-2"
              aria-label={t("menuNavAria")}
            >
              <Link
                href="/"
                aria-current={isLiveEditorActive ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-lg px-3 py-3 font-body-sm text-body-sm ${drawerNavLinkClass(isLiveEditorActive)}`}
                onClick={closeDrawer}
              >
                {t("nav.liveEditor")}
              </Link>
              <Link
                href="/my-library"
                aria-current={isMyLibraryActive ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-lg px-3 py-3 font-body-sm text-body-sm ${drawerNavLinkClass(isMyLibraryActive)}`}
                onClick={closeDrawer}
              >
                {t("nav.myLibrary")}
              </Link>
              <Link
                href="/how-it-works"
                aria-current={isHowItWorksActive ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-lg px-3 py-3 font-body-sm text-body-sm ${drawerNavLinkClass(isHowItWorksActive)}`}
                onClick={closeDrawer}
              >
                {t("nav.howItWorks")}
              </Link>
            </nav>

            <div className="mx-2 border-t border-slate-200 px-2 py-4 dark:border-slate-700">
              <p className="mb-2 px-2 font-label-caps text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("language.label")}
              </p>
              <ul className="flex flex-col gap-1" role="listbox">
                {localeList.map((loc) => (
                  <li key={loc}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={loc === locale}
                      className={
                        loc === locale
                          ? "flex min-h-[44px] w-full items-center rounded-lg px-3 text-left font-body-sm font-semibold text-primary"
                          : "flex min-h-[44px] w-full items-center rounded-lg px-3 text-left font-body-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      }
                      onClick={() => {
                        if (loc !== locale) {
                          router.replace(pathname, { locale: loc });
                        }
                        closeDrawer();
                      }}
                    >
                      {localeLabel(loc)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mx-2 flex min-h-[44px] items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <span className="font-body-sm text-body-sm text-slate-700 dark:text-slate-300">
                {t("appearance")}
              </span>
              <ThemeToggle />
            </div>

            <div className="mx-2 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-700">
              {currentUser ? (
                <div className="space-y-3">
                  <p className="truncate font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
                    {currentUser.email}
                  </p>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center justify-center rounded-DEFAULT border border-slate-200 bg-white font-body-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={async () => {
                      closeDrawer();
                      try {
                        await onSignOut();
                        onToast({
                          tone: "success",
                          message: tToast("signedOut"),
                        });
                      } catch (error) {
                        onToast({
                          tone: "error",
                          message:
                            error instanceof Error
                              ? error.message
                              : tToast("signOutFailed"),
                        });
                      }
                    }}
                  >
                    {t("signOut")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center justify-center rounded-DEFAULT border border-slate-200 bg-white font-body-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => openAuthFromDrawer("sign-in")}
                  >
                    {t("signIn")}
                  </button>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center justify-center rounded-DEFAULT bg-primary font-body-sm font-medium text-on-primary transition-colors hover:bg-surface-tint"
                    onClick={() => openAuthFromDrawer("sign-up")}
                  >
                    {t("signUp")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    ) : null;

  const authModal =
    mounted && isAuthModalOpen ? (
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 px-4 dark:bg-black/60"
        role="presentation"
        onClick={() => setIsAuthModalOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-gutter shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-h3 text-h3 text-slate-900 dark:text-slate-100">
            {authMode === "sign-in"
              ? t("auth.signInTitle")
              : t("auth.signUpTitle")}
          </h3>
          <div className="mt-md flex flex-col gap-sm">
            <button
              type="button"
              disabled={isSubmitting || isGoogleLoading}
              onClick={() => void handleGoogleLogin()}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-3 rounded-DEFAULT border border-slate-300 bg-white px-4 py-2.5 font-body-sm text-body-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {isGoogleLoading ? (
                <Loader2
                  className="h-5 w-5 shrink-0 animate-spin text-slate-600 dark:text-slate-300"
                  aria-hidden
                />
              ) : (
                <GoogleMark className="h-5 w-5 shrink-0" />
              )}
              {t("auth.continueWithGoogle")}
            </button>
            <div className="relative py-1">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden
              >
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 font-body-sm text-body-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {t("auth.orContinueWithEmail")}
                </span>
              </div>
            </div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={tCommon("email")}
              disabled={isGoogleLoading}
              autoComplete="email"
              className="w-full rounded-DEFAULT border border-slate-200 bg-white px-3 py-2 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={tCommon("password")}
              disabled={isGoogleLoading}
              autoComplete={
                authMode === "sign-in" ? "current-password" : "new-password"
              }
              className="w-full rounded-DEFAULT border border-slate-200 bg-white px-3 py-2 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="mt-md flex items-center justify-end gap-sm">
            <button
              type="button"
              disabled={isGoogleLoading}
              onClick={() => setIsAuthModalOpen(false)}
              className="px-2 py-1 font-body-sm text-body-sm text-slate-600 transition-colors hover:text-slate-900 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={isSubmitting || isGoogleLoading}
              onClick={() => void submitAuth()}
              className="bg-primary hover:bg-surface-tint text-on-primary font-body-sm text-body-sm px-3 py-2 rounded-DEFAULT transition-colors disabled:opacity-60"
            >
              {authMode === "sign-in"
                ? t("auth.signInSubmit")
                : t("auth.signUpSubmit")}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-[100] w-full border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="relative mx-auto flex h-16 max-w-7xl min-w-0 items-center justify-between gap-4 overflow-x-clip px-4 md:h-20 md:px-8 md:justify-start">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center hover:opacity-90"
            aria-label="MathFormula"
          >
            <BrandWordmark />
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center md:flex"
            aria-label="Main"
          >
            <div className="flex h-full items-stretch gap-8 lg:gap-10">
              <Link
                aria-current={isLiveEditorActive ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-0.5 pb-2.5 pt-2 text-sm font-medium transition-colors lg:text-[0.9375rem] ${navLinkClass(isLiveEditorActive)}`}
                href="/"
              >
                {t("nav.liveEditor")}
              </Link>
              <Link
                aria-current={isMyLibraryActive ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-0.5 pb-2.5 pt-2 text-sm font-medium transition-colors lg:text-[0.9375rem] ${navLinkClass(isMyLibraryActive)}`}
                href="/my-library"
              >
                {t("nav.myLibrary")}
              </Link>
              <Link
                aria-current={isHowItWorksActive ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-0.5 pb-2.5 pt-2 text-sm font-medium transition-colors lg:text-[0.9375rem] ${navLinkClass(isHowItWorksActive)}`}
                href="/how-it-works"
              >
                {t("nav.howItWorks")}
              </Link>
            </div>
          </nav>

          <div className="hidden shrink-0 items-center gap-2 sm:gap-4 md:flex md:gap-5">
            {desktopLangDropdown}
            <ThemeToggle />
            {desktopAuth}
          </div>

          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-100 md:hidden dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-expanded={isMobileDrawerOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={t("openMainMenu")}
            onClick={() => setIsMobileDrawerOpen(true)}
          >
            <Menu className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      {mounted ? createPortal(mobileDrawer, document.body) : null}
      {mounted ? createPortal(authModal, document.body) : null}
    </>
  );
}

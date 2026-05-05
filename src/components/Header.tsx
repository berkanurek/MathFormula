"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

const localeList = routing.locales;

const iconCircleShell =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";

/** Language control: icon + locale code, wider than icon-only for clarity on mobile. */
const langTriggerClass =
  "inline-flex h-9 min-w-[4.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-w-[4.75rem] sm:px-3";

const iconAvatar = `${iconCircleShell} bg-indigo-50 font-semibold text-body-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100`;

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

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

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
    t(`language.${loc}` as "language.en" | "language.de" | "language.cs");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6 md:px-8">
        <div className="flex min-w-0 flex-shrink-0 items-center">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-900 hover:opacity-90 sm:text-xl dark:text-slate-50"
          >
            {t("brand")}
          </Link>
        </div>

        <nav
          className="hidden min-h-0 flex-1 md:flex md:items-stretch md:justify-center"
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
            {currentUser ? (
              <Link
                aria-current={isMyLibraryActive ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-0.5 pb-2.5 pt-2 text-sm font-medium transition-colors lg:text-[0.9375rem] ${navLinkClass(isMyLibraryActive)}`}
                href="/my-library"
              >
                {t("nav.myLibrary")}
              </Link>
            ) : null}
            <Link
              aria-current={isHowItWorksActive ? "page" : undefined}
              className={`inline-flex items-center border-b-2 px-0.5 pb-2.5 pt-2 text-sm font-medium transition-colors lg:text-[0.9375rem] ${navLinkClass(isHowItWorksActive)}`}
              href="/how-it-works"
            >
              {t("nav.howItWorks")}
            </Link>
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4 md:gap-5">
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
          <ThemeToggle />
          {currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                className={iconAvatar}
                title={t("accountMenu")}
              >
                {userInitial}
              </button>
              {isMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="truncate font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
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
                        setIsMenuOpen(false);
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
          )}
        </div>
      </div>
      {isAuthModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 dark:bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-gutter shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-h3 text-h3 text-slate-900 dark:text-slate-100">
              {authMode === "sign-in"
                ? t("auth.signInTitle")
                : t("auth.signUpTitle")}
            </h3>
            <div className="mt-md flex flex-col gap-sm">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={tCommon("email")}
                className="w-full rounded-DEFAULT border border-slate-200 bg-white px-3 py-2 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={tCommon("password")}
                className="w-full rounded-DEFAULT border border-slate-200 bg-white px-3 py-2 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="mt-md flex items-center justify-end gap-sm">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="px-2 py-1 font-body-sm text-body-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
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
      ) : null}
    </header>
  );
}

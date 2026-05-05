"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const CONTACT_MAILTO = "mailto:berkanurekk@gmail.com";

export function Footer() {
  const t = useTranslations("footer");

  const mutedLink =
    "text-slate-400 transition-colors hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300";

  return (
    <footer className="mt-auto w-full border-t border-slate-200/80 bg-slate-50 dark:border-slate-800/80 dark:bg-slate-950">
      {/* Primary: developer signature — centered */}
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 text-center md:px-8 md:pb-10 md:pt-12">
        <p className="mx-auto m-0 max-w-2xl text-sm leading-relaxed tracking-wide text-slate-500 dark:text-slate-400 md:text-base">
          {t.rich("signatureRich", {
            b: (chunks) => (
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {chunks}
              </span>
            ),
          })}
        </p>
      </div>

      <div className="border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 text-sm font-inter md:flex-row md:items-center md:px-8 md:py-10">
          <div className="text-center font-semibold text-slate-600 dark:text-slate-300 md:text-left">
            {t("copyright")}
          </div>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-end"
            aria-label="Footer"
          >
            <Link href="/privacy" className={mutedLink}>
              {t("privacy")}
            </Link>
            <Link href="/terms" className={mutedLink}>
              {t("terms")}
            </Link>
            <a className={mutedLink} href={CONTACT_MAILTO}>
              {t("contactDeveloper")}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

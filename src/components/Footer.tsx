"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="full-width flat no shadows mx-auto mt-xl flex w-full max-w-7xl flex-col items-center justify-between gap-4 border-t border-t border-slate-200 bg-slate-50 px-4 py-12 text-sm font-inter text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 md:flex-row md:px-8">
      <div className="font-semibold text-slate-900 dark:text-slate-100">
        {t("copyright")}
      </div>
      <div className="flex gap-4 flex-wrap justify-center">
        <a
          className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-all cursor-pointer"
          href="#"
        >
          {t("privacy")}
        </a>
        <a
          className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-all cursor-pointer"
          href="#"
        >
          {t("terms")}
        </a>
        <a
          className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-all cursor-pointer"
          href="#"
        >
          {t("contact")}
        </a>
        <a
          className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-all cursor-pointer"
          href="#"
        >
          {t("docs")}
        </a>
      </div>
    </footer>
  );
}

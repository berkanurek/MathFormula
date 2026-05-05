"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="bg-slate-50 dark:bg-slate-950 text-sm font-inter text-slate-500 dark:text-slate-400 full-width border-t border-t border-slate-200 dark:border-slate-800 flat no shadows w-full py-12 px-6 flex flex-col md:flex-row justify-between items-center gap-4 max-w-7xl mx-auto mt-xl">
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

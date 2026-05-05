"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={isDark ? t("switchToLight") : t("switchToDark")}
      title={isDark ? t("light") : t("dark")}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

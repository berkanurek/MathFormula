"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export function LatexSourceDisclosure({
  latex,
  onCopy,
}: {
  latex: string;
  onCopy: () => Promise<void>;
}) {
  const t = useTranslations("latexSource");
  const [open, setOpen] = useState(false);
  const latexText = useMemo(() => latex ?? "", [latex]);

  return (
    <div className="mt-xs">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left font-body-sm text-body-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">
            {open ? "expand_more" : "chevron_right"}
          </span>
          {t("title")}
        </span>
        <span className="font-label-caps text-label-caps text-slate-500 dark:text-slate-400">
          {open ? t("hide") : t("show")}
        </span>
      </button>

      {open ? (
        <div className="mt-xs rounded-DEFAULT bg-slate-50 px-md py-sm dark:bg-slate-950">
          <div className="flex items-start gap-sm">
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-slate-600 dark:text-slate-400">
              {latexText || "—"}
            </pre>
            <button
              type="button"
              className="rounded-DEFAULT p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary"
              title={t("copyTitle")}
              onClick={onCopy}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                content_copy
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

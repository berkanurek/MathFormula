"use client";

import type { FormulaCategory } from "@/data/formulas";
import { copyLatexAsWordMathML, renderLatexToHtmlAndMathml } from "@/lib/latex";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

type Props = {
  title: string;
  category: FormulaCategory;
  latex: string;
  onToast: (toast: { tone: "success" | "error"; message: string }) => void;
  onSendToEditor: (latex: string) => void;
};

export function FormulaCard({
  title,
  category,
  latex,
  onToast,
  onSendToEditor,
}: Props) {
  const t = useTranslations("formulaCard");
  const tFormulas = useTranslations("Formulas");
  const tToast = useTranslations("workspace.toast");
  const rendered = useMemo(() => renderLatexToHtmlAndMathml(latex), [latex]);

  const categoryLabel = tFormulas(`categories.${category}`);

  return (
    <div className="flex flex-col gap-md rounded-lg border border-slate-200 bg-white p-md shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-sm">
        <h3 className="font-h3 text-h3 text-slate-900 dark:text-slate-100">{title}</h3>
        <span className="font-label-caps text-label-caps text-slate-500 dark:text-slate-400">
          {categoryLabel}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center rounded bg-slate-50 px-md py-xl dark:bg-slate-950">
        {rendered.ok ? (
          <div
            className="katex-formula-wrap text-lg text-slate-900 dark:text-slate-100"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        ) : (
          <div className="text-center">
            <div className="font-body-sm text-body-sm text-error">
              {t("renderError")}
            </div>
            <div className="mt-xs font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
              {rendered.errorMessage}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-sm">
        <button
          className="flex-1 rounded-DEFAULT border border-slate-200 bg-white py-2 px-3 font-body-sm text-body-sm text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          type="button"
          onClick={async () => {
            try {
              await copyLatexAsWordMathML(latex);
              onToast({
                tone: "success",
                message: tToast("copyWordSuccess"),
              });
            } catch (e) {
              onToast({
                tone: "error",
                message:
                  e instanceof Error ? e.message : tToast("copyFailed"),
              });
            }
          }}
        >
          {t("copyWord")}
        </button>
        <button
          className="flex-1 rounded-DEFAULT py-2 px-3 font-body-sm text-body-sm text-primary transition-colors hover:bg-primary/10 dark:hover:bg-primary/20"
          type="button"
          onClick={() => onSendToEditor(latex)}
        >
          {t("edit")}
        </button>
      </div>
    </div>
  );
}

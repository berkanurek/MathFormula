"use client";

import { useRouter } from "@/i18n/navigation";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { copyLatexAsWordMathML, renderLatexToHtmlAndMathml } from "@/lib/latex";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export type MyLibraryFormula = {
  id: string;
  title: string;
  latexCode: string;
  createdAt: string;
};

function formatSavedAt(iso: string, locale: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function MyLibraryCard({
  formula,
  savedAtLabel,
  onCopyForWord,
  onEdit,
  onDelete,
}: {
  formula: MyLibraryFormula;
  savedAtLabel: string;
  onCopyForWord: (latex: string) => Promise<void>;
  onEdit: (latex: string) => void;
  onDelete: (formulaId: string) => Promise<void>;
}) {
  const tGrid = useTranslations("myLibraryGrid");
  const rendered = useMemo(
    () => renderLatexToHtmlAndMathml(formula.latexCode),
    [formula.latexCode],
  );

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 dark:bg-primary/10" />
      <div className="relative flex items-start justify-between gap-sm border-b border-slate-200 bg-slate-50/80 px-md pt-md dark:border-slate-800 dark:bg-slate-950/50">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-h3 text-h3 text-slate-900 dark:text-slate-100">
            {formula.title}
          </h3>
          {savedAtLabel ? (
            <p className="mt-0.5 font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
              {savedAtLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-[160px] flex-1 items-center justify-center bg-slate-50 px-md py-lg dark:bg-slate-950">
        {rendered.ok ? (
          <div
            className="katex-formula-wrap math-font max-w-full text-center text-lg text-slate-900 dark:text-slate-100"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        ) : (
          <p className="text-center font-body-sm text-body-sm text-error">
            {tGrid("cantDisplay")}
          </p>
        )}
      </div>

      <div className="relative flex items-center justify-end gap-1 border-t border-slate-200 bg-white px-sm py-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          title={tGrid("copyTitle")}
          aria-label={tGrid("copyAria")}
          onClick={() => void onCopyForWord(formula.latexCode)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-DEFAULT text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            content_copy
          </span>
        </button>
        <button
          type="button"
          title={tGrid("editTitle")}
          aria-label={tGrid("editAria")}
          onClick={() => onEdit(formula.latexCode)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-DEFAULT text-primary transition-colors hover:bg-primary/10 dark:hover:bg-primary/20"
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            edit_square
          </span>
        </button>
        <button
          type="button"
          title={tGrid("deleteTitle")}
          aria-label={tGrid("deleteAria")}
          onClick={() => void onDelete(formula.id)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-DEFAULT text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            delete
          </span>
        </button>
      </div>
    </article>
  );
}

export function MyLibraryGrid({
  currentUserId,
  initialFormulas,
  onToast,
}: {
  currentUserId: string;
  initialFormulas: MyLibraryFormula[];
  onToast: (toast: { tone: "success" | "error"; message: string }) => void;
}) {
  const tGrid = useTranslations("myLibraryGrid");
  const tToast = useTranslations("myLibraryGrid.toast");
  const locale = useLocale();
  const router = useRouter();
  const [formulas, setFormulas] = useState(initialFormulas);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFormulas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return formulas;
    return formulas.filter((item) => {
      const inTitle = item.title.toLowerCase().includes(q);
      const inLatex = item.latexCode.toLowerCase().includes(q);
      return inTitle || inLatex;
    });
  }, [formulas, searchQuery]);

  const handleCopyForWord = async (latex: string) => {
    try {
      await copyLatexAsWordMathML(latex);
      onToast({
        tone: "success",
        message: tToast("copyWordSuccess"),
      });
    } catch (error) {
      onToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : tToast("copyFailed"),
      });
    }
  };

  const handleEdit = (latex: string) => {
    router.push(`/?latex=${encodeURIComponent(latex)}`);
  };

  const handleDelete = async (formulaId: string) => {
    const ok = window.confirm(tGrid("deleteConfirm"));
    if (!ok) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("user_formulas")
        .delete()
        .eq("id", formulaId)
        .eq("user_id", currentUserId);

      if (error) {
        throw error;
      }

      setFormulas((previous) => previous.filter((item) => item.id !== formulaId));
      onToast({ tone: "success", message: tToast("deleted") });
    } catch (error) {
      console.error("Delete formula failed:", error);
      onToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : tToast("deleteFailed"),
      });
    }
  };

  const total = formulas.length;
  const shown = filteredFormulas.length;

  const countLabel =
    shown === total
      ? `${total} ${total === 1 ? tGrid("formulaOne") : tGrid("formulaMany")}`
      : tGrid("shownOf", { shown, total });

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tGrid("searchPlaceholder")}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-sm font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
          <span className="rounded-full bg-indigo-100 px-3 py-1 font-label-caps text-label-caps text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-100">
            {countLabel}
          </span>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-gutter py-xl text-center dark:border-slate-700 dark:bg-slate-950/50">
          <span
            className="material-symbols-outlined mb-2 inline-block text-[40px] text-slate-400"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            folder_open
          </span>
          <p className="font-body-md text-body-md text-slate-900 dark:text-slate-100">
            {tGrid("emptyTitle")}
          </p>
          <p className="mt-xs font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
            {tGrid("emptyHint")}
          </p>
        </div>
      ) : shown === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-gutter py-xl text-center dark:border-slate-800 dark:bg-slate-950/50">
          <p className="font-body-md text-body-md text-slate-900 dark:text-slate-100">
            {tGrid("noSearchMatch")}
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-sm font-body-sm text-body-sm text-primary underline-offset-2 hover:underline"
          >
            {tGrid("clearSearch")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {filteredFormulas.map((formula) => {
            const dateStr = formatSavedAt(formula.createdAt, locale);
            const savedAtLabel = dateStr
              ? tGrid("savedAt", { date: dateStr })
              : "";
            return (
              <MyLibraryCard
                key={formula.id}
                formula={formula}
                savedAtLabel={savedAtLabel}
                onCopyForWord={handleCopyForWord}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

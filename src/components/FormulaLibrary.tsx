"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FORMULAS,
  type FormulaCategory,
  type FormulaFilter,
  type FormulaItem,
} from "@/data/formulas";
import { FormulaCard } from "./FormulaCard";

/** Shown before "View all" — ~2 rows on desktop (3 columns × 3 rows). */
const COLLAPSED_COUNT = 9;

type UserLibraryFormula = {
  id: string;
  title: string;
  latex: string;
  category: FormulaCategory;
};

type LibraryRow = FormulaItem | UserLibraryFormula;

function isUserLibraryFormula(row: LibraryRow): row is UserLibraryFormula {
  return Object.prototype.hasOwnProperty.call(row, "title");
}

export function FormulaLibrary({
  currentUserId,
  onToast,
  onSendToEditor,
}: {
  currentUserId: string | null;
  onToast: (toast: { tone: "success" | "error"; message: string }) => void;
  onSendToEditor: (latex: string) => void;
}) {
  const t = useTranslations("library");
  const tFilters = useTranslations("library.filters");
  const tFormulas = useTranslations("Formulas");
  const tCommon = useTranslations("common");
  const [activeFilter, setActiveFilter] = useState<FormulaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [myLibraryItems, setMyLibraryItems] = useState<UserLibraryFormula[]>(
    [],
  );
  const [isLoadingMyLibrary, setIsLoadingMyLibrary] = useState(false);
  const [libraryExpanded, setLibraryExpanded] = useState(false);

  const filterOptions: FormulaFilter[] = [
    "all",
    "my-library",
    "algebra",
    "geometry",
    "trigonometry",
    "derivatives",
    "integrals",
  ];

  useEffect(() => {
    if (activeFilter !== "my-library" || !currentUserId) {
      return;
    }

    const loadMyLibrary = async () => {
      setIsLoadingMyLibrary(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("user_formulas")
          .select("id,title,latex_code,created_at")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const safeRows = Array.isArray(data) ? data : [];
        const mapped = safeRows.map((row) => ({
          id: String(row.id ?? crypto.randomUUID()),
          title: String(row.title ?? tCommon("untitledFormula")),
          latex: String(row.latex_code ?? ""),
          category: "algebra" as FormulaCategory,
        }));

        setMyLibraryItems(mapped);
      } catch (error) {
        onToast({
          tone: "error",
          message:
            error instanceof Error ? error.message : t("loadFailed"),
        });
      } finally {
        setIsLoadingMyLibrary(false);
      }
    };

    void loadMyLibrary();
  }, [activeFilter, currentUserId, onToast, t, tCommon]);

  const filteredFormulas = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase();
    const sourceItems: LibraryRow[] =
      activeFilter === "my-library"
        ? currentUserId
          ? myLibraryItems
          : []
        : FORMULAS;

    return sourceItems.filter((formula) => {
      const categoryMatch =
        activeFilter === "all" ||
        activeFilter === "my-library" ||
        formula.category === activeFilter;

      const categoryLabel = tFormulas(
        `categories.${formula.category}`,
      ).toLocaleLowerCase();

      const titleLabel = isUserLibraryFormula(formula)
        ? formula.title
        : tFormulas(formula.id);

      const queryMatch =
        q === "" ||
        titleLabel.toLocaleLowerCase().includes(q) ||
        formula.latex.toLocaleLowerCase().includes(q) ||
        categoryLabel.includes(q);

      return categoryMatch && queryMatch;
    });
  }, [
    activeFilter,
    currentUserId,
    myLibraryItems,
    searchQuery,
    tFormulas,
  ]);

  const hasMore = filteredFormulas.length > COLLAPSED_COUNT;

  const visibleFormulas = useMemo(() => {
    if (!hasMore || libraryExpanded) {
      return filteredFormulas;
    }
    return filteredFormulas.slice(0, COLLAPSED_COUNT);
  }, [filteredFormulas, hasMore, libraryExpanded]);

  return (
    <div className="mt-xl flex flex-col gap-md border-t border-slate-200 pt-lg dark:border-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-sm">
        <div>
          <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
            {t("title")}
          </h2>
          <p className="mt-1 font-body-md text-body-md text-slate-600 dark:text-slate-400">
            {t("subtitle")}
          </p>
        </div>
        {hasMore ? (
          <button
            type="button"
            onClick={() => setLibraryExpanded((open) => !open)}
            className="inline-flex items-center gap-1 font-body-md text-body-md text-primary transition-opacity hover:underline"
          >
            {libraryExpanded ? (
              <>
                {t("showLess")}
                <span className="material-symbols-outlined text-[18px]">
                  expand_less
                </span>
              </>
            ) : (
              <>
                {t("viewAll")}
                <span className="material-symbols-outlined text-[18px]">
                  expand_more
                </span>
              </>
            )}
          </button>
        ) : null}
      </div>

      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="flex flex-wrap gap-sm">
        {filterOptions.map((filterOption) => {
          const active = activeFilter === filterOption;
          return (
            <button
              key={filterOption}
              type="button"
              onClick={() => {
                if (filterOption === "my-library" && !currentUserId) {
                  onToast({
                    tone: "error",
                    message: t("signInForMyLibrary"),
                  });
                  return;
                }
                setActiveFilter(filterOption);
                setLibraryExpanded(false);
              }}
              className={
                active
                  ? "rounded-full border border-slate-200 bg-indigo-100 px-4 py-2 font-body-sm font-semibold text-indigo-900 dark:border-slate-600 dark:bg-indigo-950/80 dark:text-indigo-100"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 font-body-sm text-body-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              }
            >
              {tFilters(filterOption)}
            </button>
          );
        })}
      </div>

      {activeFilter === "my-library" && isLoadingMyLibrary ? (
        <p className="py-sm text-center font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
          {t("loadingMyLibrary")}
        </p>
      ) : null}

      <motion.div layout className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleFormulas.map((formula) => (
            <motion.div
              key={formula.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <FormulaCard
                title={
                  isUserLibraryFormula(formula)
                    ? formula.title
                    : tFormulas(formula.id)
                }
                category={formula.category}
                latex={formula.latex}
                onToast={onToast}
                onSendToEditor={onSendToEditor}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {filteredFormulas.length === 0 ? (
        <p className="py-md text-center font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
          {t("noMatch")}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { renderLatexToHtmlAndMathml } from "@/lib/latex";
import { Star } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export type LibraryFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type LibraryFormula = {
  id: string;
  content: string;
  folderId: string | null;
  isFavorite: boolean;
  createdAt: string;
};

type ActiveView =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "folder"; folderId: string };

export function MyLibraryWorkspace({
  currentUserId,
  initialFolders,
  initialFormulas,
  onToast,
}: {
  currentUserId: string;
  initialFolders: LibraryFolder[];
  initialFormulas: LibraryFormula[];
  onToast: (toast: { tone: "success" | "error"; message: string }) => void;
}) {
  const [folders, setFolders] = useState(initialFolders);
  const [formulas, setFormulas] = useState(initialFormulas);
  const [activeView, setActiveView] = useState<ActiveView>({ kind: "all" });
  const [folderName, setFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportRootRef = useRef<HTMLDivElement | null>(null);

  const visibleFormulas = useMemo(() => {
    if (activeView.kind === "favorites") {
      return formulas.filter((f) => f.isFavorite);
    }
    if (activeView.kind === "folder") {
      return formulas.filter((f) => f.folderId === activeView.folderId);
    }
    return formulas;
  }, [activeView, formulas]);

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    setIsCreatingFolder(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: currentUserId, name })
        .select("id,name,created_at")
        .single();
      if (error || !data) throw error ?? new Error("Folder creation failed.");

      setFolders((prev) => [
        ...prev,
        { id: data.id as string, name: data.name as string, createdAt: data.created_at as string },
      ]);
      setFolderName("");
      onToast({ tone: "success", message: "Folder created." });
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to create folder.",
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const toggleFavorite = async (formulaId: string, current: boolean) => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("saved_formulas")
        .update({ is_favorite: !current })
        .eq("id", formulaId)
        .eq("user_id", currentUserId);
      if (error) throw error;
      setFormulas((prev) =>
        prev.map((f) => (f.id === formulaId ? { ...f, isFavorite: !current } : f)),
      );
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update favorite.",
      });
    }
  };

  const moveToFolder = async (formulaId: string, nextFolderId: string | null) => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("saved_formulas")
        .update({ folder_id: nextFolderId })
        .eq("id", formulaId)
        .eq("user_id", currentUserId);
      if (error) throw error;
      setFormulas((prev) =>
        prev.map((f) => (f.id === formulaId ? { ...f, folderId: nextFolderId } : f)),
      );
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to move formula.",
      });
    }
  };

  const exportToPdf = async () => {
    if (!exportRootRef.current || visibleFormulas.length === 0) {
      onToast({ tone: "error", message: "No formulas to export." });
      return;
    }
    setIsExporting(true);
    try {
      const module = await import("html2pdf.js");
      const html2pdf = (module.default ?? module) as {
        (): {
          from: (element: HTMLElement) => { set: (options: unknown) => { save: () => Promise<void> } };
        };
      };
      const filename =
        activeView.kind === "favorites"
          ? "favorites-formulas.pdf"
          : activeView.kind === "folder"
            ? `folder-${activeView.folderId}.pdf`
            : "all-formulas.pdf";

      await html2pdf()
        .from(exportRootRef.current)
        .set({
          margin: 8,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .save();

      onToast({ tone: "success", message: "PDF exported." });
    } catch (error) {
      onToast({
        tone: "error",
        message: error instanceof Error ? error.message : "PDF export failed.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-h3 text-h3 text-slate-900 dark:text-slate-100">Library</h2>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setActiveView({ kind: "all" })}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            All Formulas
          </button>
          <button
            type="button"
            onClick={() => setActiveView({ kind: "favorites" })}
            className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
            Favorites
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-body-sm text-body-sm text-slate-500 dark:text-slate-400">Folders</h3>
          </div>
          <div className="space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setActiveView({ kind: "folder", folderId: folder.id })}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {folder.name}
              </button>
            ))}
            {folders.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No folders yet.</p>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="New folder"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => void createFolder()}
              disabled={isCreatingFolder}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-surface-tint disabled:opacity-60"
            >
              +
            </button>
          </div>
        </div>
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-h3 text-h3 text-slate-900 dark:text-slate-100">Saved Formulas</h2>
          <button
            type="button"
            onClick={() => void exportToPdf()}
            disabled={isExporting}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {isExporting ? "Exporting..." : "Export to PDF"}
          </button>
        </div>

        <div ref={exportRootRef} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleFormulas.map((formula) => {
            const rendered = renderLatexToHtmlAndMathml(formula.content);
            return (
              <article
                key={formula.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleFavorite(formula.id, formula.isFavorite)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${formula.isFavorite ? "fill-yellow-400 text-yellow-500" : "text-slate-400"}`}
                    />
                    Favorite
                  </button>
                  <select
                    value={formula.folderId ?? ""}
                    onChange={(event) => void moveToFolder(formula.id, event.target.value || null)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-h-[110px] rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  {rendered.ok ? (
                    <div
                      className="katex-formula-wrap max-w-full overflow-x-auto text-center"
                      dangerouslySetInnerHTML={{ __html: rendered.html }}
                    />
                  ) : (
                    <p className="text-sm text-red-600 dark:text-red-400">Unable to render formula.</p>
                  )}
                </div>
              </article>
            );
          })}
          {visibleFormulas.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No formulas in this view yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

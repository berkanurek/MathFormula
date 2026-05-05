"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MathfieldElement } from "mathlive";
import { AlertCircle, Calculator, Clock3, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyLatexAsWordMathML, renderLatexToHtmlAndMathml } from "@/lib/latex";
import { evaluateLatexNumeric } from "@/lib/mathEvaluator";
import { compressImageFileForOcr } from "@/lib/ocrImage";
import {
  exportPreviewAsPdf,
  exportPreviewAsPngTransparent,
  exportPreviewAsSvg,
} from "@/lib/exportPreview";
import { VisualMathField } from "@/components/VisualMathField";
import { LatexSourceDisclosure } from "@/components/LatexSourceDisclosure";
import { useIsNarrowViewport } from "@/hooks/useMatchMedia";

const VK_DISMISS_BTN_ID = "mathformula-vk-dismiss";
const HISTORY_STORAGE_KEY = "mathformula_history";
const MAX_HISTORY_ITEMS = 5;

/**
 * Mount dismiss on `.MLK__plate` (shared by all keyboard layers). Runs only in the browser via
 * useEffect — no DOM access during React render (avoids hydration issues).
 */
function injectVirtualKeyboardDismissButton(ariaLabel: string) {
  if (typeof document === "undefined") return;
  const vk = window.mathVirtualKeyboard;
  if (!vk) return;

  const kb = document.querySelector("body > .ML__keyboard.is-visible");
  if (!kb) return;

  const plate = kb.querySelector<HTMLElement>(".MLK__backdrop .MLK__plate");
  if (!plate) return;

  let btn = document.getElementById(VK_DISMISS_BTN_ID) as HTMLButtonElement | null;
  if (!btn) {
    btn = document.createElement("button");
    btn.id = VK_DISMISS_BTN_ID;
    btn.type = "button";
    btn.className = "ml-vk-dismiss-btn ml-vk-dismiss-plate";
    btn.setAttribute("aria-label", ariaLabel);
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const kbd = window.mathVirtualKeyboard;
        if (kbd) {
          kbd.executeCommand("hideVirtualKeyboard");
        }
      } catch {
        window.mathVirtualKeyboard?.hide?.({ animate: true });
      }
    });
  }

  btn.setAttribute("aria-label", ariaLabel);
  btn.classList.add("ml-vk-dismiss-plate");
  if (!plate.contains(btn)) {
    plate.appendChild(btn);
  }
}

/** Strip data:image/...;base64, prefix for a compact payload; normalize MIME. */
function normalizeOcrImageForApi(
  imageInput: string,
  mimeType: string,
): { imageBase64: string; mimeType: string } {
  const trimmed = imageInput.trim();
  const dataUrl = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/i);
  if (dataUrl) {
    const parsedMime = dataUrl[1]?.trim() || "image/png";
    const b64 = dataUrl[2].replace(/\s/g, "");
    return {
      imageBase64: b64,
      mimeType: parsedMime.startsWith("image/")
        ? parsedMime
        : mimeType.startsWith("image/")
          ? mimeType
          : "image/png",
    };
  }
  const raw = trimmed.replace(/\s/g, "");
  return {
    imageBase64: raw,
    mimeType: mimeType.startsWith("image/") ? mimeType : "image/png",
  };
}

function formatResultToLatex(value: string): string {
  let latex = value
    .trim()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/log_([a-zA-Z0-9]+)/g, "\\log_$1")
    .replace(/\bpi\b/gi, "\\pi")
    .replace(/\btheta\b/gi, "\\theta");

  // Normalize powers: ^2 -> ^{2}, ^(-1) -> ^{-1}
  latex = latex
    .replace(/\^\(([^()]+)\)/g, "^{$1}")
    .replace(/\^(-?\d+(?:\.\d+)?)/g, "^{$1}")
    .replace(/\^([a-zA-Z])/g, "^{$1}");

  // Convert simple divisions to fractions.
  for (let i = 0; i < 3; i += 1) {
    const next = latex.replace(
      /(\([^()]+\)|[a-zA-Z0-9.+-]+)\s*\/\s*(\([^()]+\)|[a-zA-Z0-9.+-]+)/g,
      (_match, numerator: string, denominator: string) => {
        const num = numerator.replace(/^\((.*)\)$/, "$1");
        const den = denominator.replace(/^\((.*)\)$/, "$1");
        return `\\frac{${num}}{${den}}`;
      },
    );
    if (next === latex) break;
    latex = next;
  }

  latex = latex
    .replace(/\*/g, " \\cdot ")
    // Cleaner variable multiplication: xy instead of x \cdot y
    .replace(/([a-zA-Z}\\])\s*\\cdot\s*([a-zA-Z\\{])/g, "$1 $2")
    // Dynamic parentheses for better visual scaling.
    .replace(/\(/g, "\\left(")
    .replace(/\)/g, "\\right)");

  return latex;
}

export function LiveEditor({
  latex,
  onLatexChange,
  currentUserId,
  supabase,
  focusToken,
  onToast,
  onOcrComplete,
}: {
  latex: string;
  onLatexChange: (next: string) => void;
  currentUserId: string | null;
  supabase: SupabaseClient | null;
  focusToken: number;
  onToast: (toast: { tone: "success" | "error"; message: string }) => void;
  onOcrComplete?: () => void;
}) {
  const t = useTranslations("workspace");
  const tToast = useTranslations("workspace.toast");
  const tExp = useTranslations("workspace.export");
  const tCommon = useTranslations("common");

  const mathFieldRef = useRef<MathfieldElement | null>(null);
  const workspaceRootRef = useRef<HTMLDivElement | null>(null);
  const [calcOutcome, setCalcOutcome] = useState<
    | { kind: "numeric"; value: string }
    | { kind: "solution"; value: string }
    | { kind: "equation_none" }
    | { kind: "symbolic" }
    | null
  >(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [recentHistory, setRecentHistory] = useState<string[]>([]);
  const [activeHistoryFormula, setActiveHistoryFormula] = useState<string | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);
  const ocrDropZoneRef = useRef<HTMLDivElement | null>(null);
  const howToWrapRef = useRef<HTMLDivElement | null>(null);
  const isNarrowViewport = useIsNarrowViewport();

  const rendered = useMemo(() => renderLatexToHtmlAndMathml(latex), [latex]);
  const renderedSolution = useMemo(() => {
    if (!calcOutcome || calcOutcome.kind === "equation_none" || calcOutcome.kind === "symbolic") {
      return null;
    }
    const latexValue = formatResultToLatex(calcOutcome.value);
    const renderedMath = renderLatexToHtmlAndMathml(latexValue);
    return {
      latexValue,
      renderedMath,
    };
  }, [calcOutcome]);

  const status = useMemo(() => {
    if (!latex.trim()) {
      return {
        label: t("status.empty.label"),
        detail: t("status.empty.detail"),
        dotClass: "bg-slate-400 dark:bg-slate-500",
      };
    }
    if (!rendered.ok) {
      return {
        label: t("status.invalid.label"),
        detail: t("status.invalid.detail"),
        dotClass: "bg-amber-500 dark:bg-amber-400",
      };
    }
    return {
      label: t("status.ready.label"),
      detail: t("status.ready.detail"),
      dotClass: "bg-emerald-500 dark:bg-emerald-400",
    };
  }, [latex, rendered.ok, t]);

  useEffect(() => {
    if (!focusToken) return;
    mathFieldRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vk = window.mathVirtualKeyboard;
    if (!vk) return;

    const rootEl = workspaceRootRef.current;
    const dismissLabel = t("closeVirtualKeyboard");

    const scheduleInject = () => {
      requestAnimationFrame(() => {
        injectVirtualKeyboardDismissButton(dismissLabel);
      });
    };

    const syncKeyboardChrome = () => {
      try {
        const root = workspaceRootRef.current;
        const rect = vk.boundingRect;
        const open = vk.visible && rect.height > 8;
        const inset = open ? Math.ceil(rect.height) : 0;
        root?.style.setProperty("--math-vk-inset", `${inset}px`);

        if (open) {
          scheduleInject();
        } else {
          document.getElementById(VK_DISMISS_BTN_ID)?.remove();
        }
      } catch {
        /* MathLive not ready or boundingRect unavailable */
      }
    };

    vk.addEventListener("geometrychange", syncKeyboardChrome);
    vk.addEventListener("virtual-keyboard-toggle", syncKeyboardChrome);
    syncKeyboardChrome();
    return () => {
      vk.removeEventListener("geometrychange", syncKeyboardChrome);
      vk.removeEventListener("virtual-keyboard-toggle", syncKeyboardChrome);
      document.getElementById(VK_DISMISS_BTN_ID)?.remove();
      rootEl?.style.removeProperty("--math-vk-inset");
    };
  }, [t]);

  useEffect(() => {
    queueMicrotask(() => {
      setCalcOutcome(null);
    });
  }, [latex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        setRecentHistory([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setRecentHistory([]);
        return;
      }
      const cleaned = parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_HISTORY_ITEMS);
      setRecentHistory(cleaned);
    } catch {
      setRecentHistory([]);
    }
  }, []);

  const persistHistory = useCallback((next: string[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write errors (private mode/quota).
    }
  }, []);

  const addFormulaToHistory = useCallback(
    (formulaValue: string) => {
      const normalized = formulaValue.trim();
      if (!normalized) return;
      const normalizeForCompare = (value: string) => {
        if (!value) return "";
        return value
          .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
          .replace(/\\left\b/g, "")
          .replace(/\\right\b/g, "")
          .replace(/[{}]/g, "");
      };
      setRecentHistory((prev) => {
        const nextDraft = [...prev];
        const existingIndex = nextDraft.findIndex(
          (item) => normalizeForCompare(item) === normalizeForCompare(normalized),
        );
        if (existingIndex >= 0) {
          nextDraft.splice(existingIndex, 1);
        }
        nextDraft.unshift(normalized);
        const next = nextDraft.slice(0, MAX_HISTORY_ITEMS);
        persistHistory(next);
        return next;
      });
    },
    [persistHistory],
  );

  const clearRecentHistory = useCallback(() => {
    setRecentHistory([]);
    persistHistory([]);
  }, [persistHistory]);

  const removeHistoryItem = useCallback(
    (formulaValue: string) => {
      setRecentHistory((prev) => {
        const next = prev.filter((item) => item !== formulaValue);
        persistHistory(next);
        return next;
      });
    },
    [persistHistory],
  );

  const loadFormulaFromHistory = useCallback(
    (formulaValue: string) => {
      onLatexChange(formulaValue);
      addFormulaToHistory(formulaValue);
      setActiveHistoryFormula(formulaValue);
      mathFieldRef.current?.focus();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          setActiveHistoryFormula((current) =>
            current === formulaValue ? null : current,
          );
        }, 550);
      }
    },
    [addFormulaToHistory, onLatexChange],
  );

  useEffect(() => {
    if (!isHowToOpen) return;
    const close = (e: MouseEvent) => {
      if (!howToWrapRef.current?.contains(e.target as Node)) {
        setIsHowToOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isHowToOpen]);

  const trackActivity = useCallback(
    async (actionType: "generated_formula" | "scanned_image") => {
      if (!supabase) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("activity_log").insert({
          user_id: user.id,
          action_type: actionType,
        });
        if (error) {
          console.error("Activity log insert failed:", error.message);
        }
      } catch (error) {
        console.error("Activity log failed:", error);
      }
    },
    [supabase],
  );

  const handleCalculate = useCallback(() => {
    const raw =
      mathFieldRef.current?.getValue?.("latex") ?? latex;
    const trimmed = raw.trim();
    if (!trimmed) {
      onToast({
        tone: "error",
        message: tToast("calcEmpty"),
      });
      return;
    }
    const out = evaluateLatexNumeric(trimmed);
    if (out.ok) {
      setCalcOutcome(
        out.mode === "solution"
          ? { kind: "solution", value: out.display }
          : { kind: "numeric", value: out.display },
      );
      addFormulaToHistory(trimmed);
      void trackActivity("generated_formula");
      return;
    }
    switch (out.reason) {
      case "equation_none":
        setCalcOutcome({ kind: "equation_none" });
        return;
      case "symbolic":
        setCalcOutcome({ kind: "symbolic" });
        return;
      case "zerodiv":
        setCalcOutcome(null);
        onToast({ tone: "error", message: tToast("calcZerodiv") });
        return;
      case "domain":
        setCalcOutcome(null);
        onToast({ tone: "error", message: tToast("calcDomain") });
        return;
      default:
        setCalcOutcome(null);
        onToast({ tone: "error", message: tToast("calcSyntax") });
    }
  }, [addFormulaToHistory, latex, onToast, tToast, trackActivity]);

  const runOcrRequest = useCallback(
    async (imageBase64: string, mimeType: string) => {
      const payload = normalizeOcrImageForApi(imageBase64, mimeType);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
        }),
      });

      const rawText = await res.text();
      let data: { latex?: string; error?: string };
      try {
        data = JSON.parse(rawText) as { latex?: string; error?: string };
      } catch {
        throw new Error(
          !res.ok
            ? `OCR failed (${res.status}): ${rawText.slice(0, 240)}`
            : "Invalid JSON from OCR service.",
        );
      }

      if (!res.ok) {
        throw new Error(
          data.error?.trim() ||
            `${tToast("ocrRequestFailed")} (${res.status})`,
        );
      }
      if (!data.latex?.trim()) {
        throw new Error(tToast("ocrNoLatex"));
      }
      const extractedLatex = data.latex.trim();
      onLatexChange(extractedLatex);
      addFormulaToHistory(extractedLatex);
      void trackActivity("scanned_image");
      onOcrComplete?.();
      onToast({
        tone: "success",
        message: tToast("ocrSuccess"),
      });
    },
    [addFormulaToHistory, onLatexChange, onOcrComplete, onToast, tToast, trackActivity],
  );

  const MAX_OCR_FILE_BYTES = 12 * 1024 * 1024;

  const handleOcrImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        onToast({
          tone: "error",
          message: tToast("ocrInvalidFile"),
        });
        return;
      }
      if (file.size > MAX_OCR_FILE_BYTES) {
        onToast({
          tone: "error",
          message: tToast("ocrTooLarge"),
        });
        return;
      }
      setIsOcrLoading(true);
      setIsOcrModalOpen(false);
      try {
        const { dataUrl, mimeType } = await compressImageFileForOcr(file);
        await runOcrRequest(dataUrl, mimeType);
      } catch (error) {
        onToast({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : tToast("ocrReadFailed"),
        });
      } finally {
        setIsOcrLoading(false);
      }
    },
    [onToast, runOcrRequest, tToast],
  );

  useEffect(() => {
    if (!isOcrModalOpen) return;
    const id = requestAnimationFrame(() => {
      ocrDropZoneRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isOcrModalOpen]);

  useEffect(() => {
    if (!isOcrModalOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void handleOcrImageFile(file);
          return;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [isOcrModalOpen, handleOcrImageFile]);

  const saveFormula = async () => {
    if (!currentUserId) {
      onToast({
        tone: "error",
        message: tToast("signInToSave"),
      });
      return;
    }

    if (!latex.trim()) {
      onToast({
        tone: "error",
        message: tToast("enterFormula"),
      });
      return;
    }

    const title = saveTitle.trim();
    if (!title) {
      onToast({ tone: "error", message: tToast("titleRequired") });
      return;
    }

    if (!supabase) {
      onToast({
        tone: "error",
        message: tToast("supabaseMissing"),
      });
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Save formula auth lookup failed:", userError);
        throw userError;
      }

      if (!user) {
        throw new Error(tToast("sessionExpired"));
      }

      if (user.id !== currentUserId) {
        console.error("Save formula user mismatch:", {
          expectedUserId: currentUserId,
          sessionUserId: user.id,
        });
      }

      const { data, error } = await supabase
        .from("user_formulas")
        .insert({
          user_id: user.id,
          title,
          latex_code: latex,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Save formula insert failed:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          userId: user.id,
          title,
        });
        throw error;
      }

      if (!data?.id) {
        console.error("Save formula completed without returned row.", {
          userId: user.id,
          title,
        });
        throw new Error(tToast("saveNotConfirmed"));
      }

      const { error: savedFormulaError } = await supabase
        .from("saved_formulas")
        .insert({
          user_id: user.id,
          content: latex,
        });
      if (savedFormulaError) {
        console.error("Mirror insert into saved_formulas failed:", {
          message: savedFormulaError.message,
          details: savedFormulaError.details,
          hint: savedFormulaError.hint,
          code: savedFormulaError.code,
          userId: user.id,
        });
      }

      setIsSaveDialogOpen(false);
      setSaveTitle("");
      onToast({ tone: "success", message: tToast("saveSuccess") });
    } catch (error) {
      console.error("Save formula failed:", error);
      onToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : tToast("saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canCopyWord = rendered.ok && !!latex.trim();
  const canExportVisual = !!latex.trim();
  const canCopyRawLatex = !!latex.trim();
  const canCalculate = !!latex.trim();

  const runExport = async (
    label: string,
    fn: (el: HTMLElement) => Promise<void>,
  ) => {
    const el = mathFieldRef.current;
    if (!el || !canExportVisual) {
      onToast({
        tone: "error",
        message: tToast("addBeforeExport"),
      });
      return;
    }
    setIsExporting(true);
    try {
      await fn(el);
      onToast({
        tone: "success",
        message: tToast("exportDownloaded", { format: label }),
      });
    } catch (error) {
      console.error(`${label} export failed:`, error);
      onToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : tToast("exportFailed", { format: label }),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const uiBusy = isOcrLoading;

  const primaryBtnClass =
    "flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-DEFAULT px-2 py-3 font-h3 text-[13px] font-semibold leading-snug shadow-sm transition-colors break-words disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[48px] sm:gap-2 sm:px-lg sm:text-base md:text-h3";

  /** Unified secondary actions (Save, Calculate, Scan) — matches dark panel */
  const secondaryActionBtnClass = `${primaryBtnClass} border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`;

  const iconHitClass =
    "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors";

  const exportIconBtnClass = `${iconHitClass} shrink-0 border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-primary`;

  return (
    <div
      ref={workspaceRootRef}
      className="relative flex w-full max-w-6xl flex-1 flex-col transition-[padding-bottom] duration-150 ease-out"
      style={{ paddingBottom: "var(--math-vk-inset, 0px)" }}
    >
      {isOcrLoading ? (
        <div
          className="fixed inset-0 z-[250] flex flex-col items-center justify-center gap-md border border-slate-200/60 bg-white/92 p-gutter backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-950/94"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span
            className="material-symbols-outlined animate-spin text-4xl text-primary"
            aria-hidden
          >
            progress_activity
          </span>
          <p className="max-w-sm text-center font-h3 text-h3 text-slate-800 dark:text-slate-100">
            {t("ocrLoading.title")}
          </p>
          <p className="max-w-xs text-center font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
            {t("ocrLoading.subtitle")}
          </p>
        </div>
      ) : null}

      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_8px_40px_rgb(0,0,0,0.35)]"
        aria-label={t("ariaWorkspace")}
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 px-4 py-3 dark:border-slate-800 md:gap-sm md:px-gutter md:py-md">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-md">
            <div
              className="flex min-w-0 items-start gap-1.5 sm:items-center"
              ref={howToWrapRef}
            >
              <h2 className="font-h3 text-h3 tracking-tight text-slate-900 dark:text-slate-100">
                {t("title")}
              </h2>
              <div className="relative shrink-0 pt-0.5 sm:pt-0">
                <button
                  type="button"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-expanded={isHowToOpen}
                  aria-label={t("howToUseAria")}
                  onClick={() => setIsHowToOpen((o) => !o)}
                >
                  <Info className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
                {isHowToOpen ? (
                  <div
                    className="absolute left-0 top-full z-20 mt-2 w-[min(calc(100vw-2rem),20rem)] max-w-[min(100%,20rem)] rounded-lg border border-slate-200 bg-white p-3 text-left font-body-sm text-body-sm text-slate-700 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    role="region"
                    aria-label={t("howToUseTitle")}
                  >
                    <p className="m-0 mb-2 font-medium text-slate-900 dark:text-slate-100">
                      {t("howToUseTitle")}
                    </p>
                    <p className="m-0 whitespace-pre-line text-slate-600 dark:text-slate-300">
                      {t("howToUseBody")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <div
              className="flex max-w-full items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 sm:px-3 dark:border-slate-700 dark:bg-slate-950/80"
              title={`${status.label} — ${status.detail}`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${status.dotClass}`}
                aria-hidden
              />
              <span className="hidden font-label-caps text-label-caps text-slate-600 sm:inline dark:text-slate-300">
                {status.label}
              </span>
              <span className="hidden font-body-sm text-body-sm text-slate-500 dark:text-slate-400 md:inline">
                · {status.detail}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-xs">
            <div className="flex items-center gap-0 rounded-lg border border-slate-200/70 bg-white/80 p-0.5 dark:border-slate-700 dark:bg-slate-950/60">
              <button
                className={`${iconHitClass} text-slate-500 hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800`}
                title={t("toolbar.undo")}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => mathFieldRef.current?.executeCommand("undo")}
              >
                <span className="material-symbols-outlined text-[22px]">
                  undo
                </span>
              </button>
              <button
                className={`${iconHitClass} text-slate-500 hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800`}
                title={t("toolbar.redo")}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => mathFieldRef.current?.executeCommand("redo")}
              >
                <span className="material-symbols-outlined text-[22px]">
                  redo
                </span>
              </button>
            </div>
            <button
              className={`${iconHitClass} text-slate-500 hover:bg-white hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800`}
              title={t("toolbar.clear")}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onLatexChange("")}
            >
              <span className="material-symbols-outlined text-[22px]">delete</span>
            </button>
            <button
              className={`${iconHitClass} border border-slate-200/70 bg-white/80 text-slate-600 hover:bg-slate-100 hover:text-primary dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800`}
              title="Toggle history panel"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsHistoryOpen((open) => !open)}
            >
              <Clock3 className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-md pt-4 md:px-gutter md:pt-lg">
          {isNarrowViewport ? (
            <p className="mb-md font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
              {t("mobileKeyboardHint")}
            </p>
          ) : null}
          <div className="flex h-[400px] min-w-0 items-stretch gap-md">
            <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-x-auto">
              <VisualMathField
                ref={mathFieldRef}
                id="latex-input"
                value={latex}
                onChange={onLatexChange}
                className="visual-math-field h-full w-full min-w-0 flex-1 rounded-lg border border-slate-200/90 bg-white p-md text-body-md leading-relaxed text-slate-900 shadow-inner focus-within:border-primary focus-within:ring-2 focus-within:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:p-lg"
              />
            </div>
          <aside
            className={`hidden md:flex md:shrink-0 md:self-start md:flex-col md:h-full md:overflow-hidden md:rounded-lg md:border-l md:border-slate-200/90 md:bg-white/75 md:backdrop-blur-sm dark:md:border-slate-700 dark:md:bg-slate-950/50 transition-all duration-300 ${
              isHistoryOpen
                ? "md:w-80 md:opacity-100 md:p-sm"
                : "md:w-0 md:opacity-0 md:p-0 md:pointer-events-none md:border-l-0"
            }`}
            aria-label="Recent history panel"
          >
            <div className="flex-none flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-700/80">
              <h3 className="font-h3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Activity
              </h3>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={clearRecentHistory}
              >
                Clear All
              </button>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.7)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600">
              <div className="space-y-2">
              {recentHistory.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center font-body-sm text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No recent history.
                </p>
              ) : (
                recentHistory.map((entry) => {
                  const renderedEntry = renderLatexToHtmlAndMathml(entry);
                  return (
                    <div
                      key={entry}
                      className="group rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:border-primary/50 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="truncate text-left text-xs font-medium text-slate-700 hover:text-primary dark:text-slate-200 dark:hover:text-primary"
                          onClick={() => loadFormulaFromHistory(entry)}
                        >
                          Load formula
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          onClick={() => removeHistoryItem(entry)}
                          aria-label="Remove history item"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`block w-full rounded-md border px-2 py-2 text-left transition-all ${
                          activeHistoryFormula === entry
                            ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
                            : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70"
                        }`}
                        onClick={() => loadFormulaFromHistory(entry)}
                      >
                        {renderedEntry.ok ? (
                          <div className="relative">
                            <div
                              className="katex-formula-wrap max-w-full overflow-x-auto overflow-y-hidden pb-1 text-slate-800 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:text-slate-100"
                              dangerouslySetInnerHTML={{ __html: renderedEntry.html }}
                            />
                            <span
                              aria-hidden
                              className="pointer-events-none absolute bottom-1 right-0 top-0 w-6 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950/70"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {entry}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </aside>
          </div>

          <div className="mt-md space-y-md">
            <LatexSourceDisclosure
              latex={latex}
              onCopy={async () => {
                try {
                  await navigator.clipboard.writeText(latex || "");
                  onToast({
                    tone: "success",
                    message: tToast("latexCopied"),
                  });
                } catch {
                  onToast({
                    tone: "error",
                    message: tToast("latexCopyFailed"),
                  });
                }
              }}
            />
            {calcOutcome ? (
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"
                role="status"
                aria-live="polite"
              >
                {calcOutcome.kind === "numeric" ? (
                  <div className="space-y-3 text-center">
                    <p className="m-0 text-sm font-medium text-primary">
                      {t("resultLabel")}:
                    </p>
                    {renderedSolution?.renderedMath.ok ? (
                      <div
                        className="katex-formula-wrap max-w-full overflow-x-auto pb-1 text-lg text-slate-900 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:text-slate-100"
                        dangerouslySetInnerHTML={{ __html: renderedSolution.renderedMath.html }}
                      />
                    ) : (
                      <p className="m-0 font-mono text-base text-slate-800 dark:text-slate-100">
                        {calcOutcome.value}
                      </p>
                    )}
                  </div>
                ) : calcOutcome.kind === "solution" ? (
                  <div className="space-y-3 text-center">
                    <p className="m-0 text-sm font-medium text-primary">
                      {t("solutionLabel")}:
                    </p>
                    {renderedSolution?.renderedMath.ok ? (
                      <div
                        className="katex-formula-wrap max-w-full overflow-x-auto pb-1 text-lg text-slate-900 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:text-slate-100"
                        dangerouslySetInnerHTML={{ __html: renderedSolution.renderedMath.html }}
                      />
                    ) : (
                      <p className="m-0 font-mono text-base text-slate-800 dark:text-slate-100">
                        {calcOutcome.value}
                      </p>
                    )}
                  </div>
                ) : calcOutcome.kind === "equation_none" ? (
                  <p className="m-0 font-sans text-sm font-normal leading-relaxed">
                    {t("equationNoSolutions")}
                  </p>
                ) : (
                  <div className="inline-flex max-w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left dark:border-amber-800/50 dark:bg-amber-900/20">
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
                      aria-hidden
                    />
                    <p className="m-0 font-sans text-sm font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                      {t("resultSymbolic")}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {isHistoryOpen ? (
          <div className="mx-4 mb-md rounded-lg border border-slate-200/90 bg-white/90 p-sm shadow-sm backdrop-blur-sm md:hidden dark:border-slate-700 dark:bg-slate-950/80">
            <div className="mb-2 flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-700/80">
              <h3 className="font-h3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Activity
              </h3>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={clearRecentHistory}
              >
                Clear All
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentHistory.length === 0 ? (
                <p className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center font-body-sm text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No recent history.
                </p>
              ) : (
                recentHistory.map((entry) => (
                  <button
                    key={`mobile-${entry}`}
                    type="button"
                    className={`min-w-[190px] rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                      activeHistoryFormula === entry
                        ? "border-primary/70 bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                    onClick={() => loadFormulaFromHistory(entry)}
                  >
                    {entry}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <footer className="mt-auto shrink-0 border-t border-slate-200/90 bg-slate-50/95 px-4 py-md dark:border-slate-800 dark:bg-slate-950 md:px-gutter md:py-lg">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-sm">
            <button
              type="button"
              disabled={!canCopyWord || uiBusy}
              className={`${primaryBtnClass} bg-primary text-on-primary hover:bg-surface-tint`}
              onClick={async () => {
                try {
                  await copyLatexAsWordMathML(latex);
                  addFormulaToHistory(latex);
                  onToast({
                    tone: "success",
                    message: tToast("copyWordSuccess"),
                  });
                } catch (error) {
                  onToast({
                    tone: "error",
                    message:
                      error instanceof Error
                        ? error.message
                        : tToast("copyFailed"),
                  });
                }
              }}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                content_copy
              </span>
              {t("copyWord")}
            </button>
            <button
              type="button"
              disabled={uiBusy}
              className={secondaryActionBtnClass}
              onClick={() => {
                if (!currentUserId) {
                  onToast({
                    tone: "error",
                    message: tToast("signInFirst"),
                  });
                  return;
                }
                setIsSaveDialogOpen(true);
              }}
            >
              <span className="material-symbols-outlined text-[22px]">library_add</span>
              {t("saveToLibrary")}
            </button>
            <button
              type="button"
              aria-label={t("calculateAria")}
              title={t("calculateAria")}
              disabled={!canCalculate || uiBusy}
              className={secondaryActionBtnClass}
              onClick={handleCalculate}
            >
              <Calculator
                className="size-[22px] shrink-0 text-slate-700 dark:text-slate-200"
                aria-hidden
              />
              {t("calculate")}
            </button>
            <button
              type="button"
              title={t("scanImageHint")}
              disabled={uiBusy}
              className={secondaryActionBtnClass}
              onClick={() => setIsOcrModalOpen(true)}
            >
              <span className="material-symbols-outlined text-[22px]">
                document_scanner
              </span>
              {t("scanImage")}
            </button>
          </div>

          <div className="mt-md flex flex-col items-stretch border-t border-slate-200/80 pt-md dark:border-slate-700/80 sm:mt-lg sm:pt-lg">
            <span className="mb-2 hidden text-center font-label-caps text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 sm:mb-0 sm:block">
              {t("export.section")}
            </span>
            <div className="-mx-1 flex max-w-full flex-nowrap items-center justify-center gap-1 overflow-x-auto overflow-y-hidden px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                aria-label={tExp("svgAria")}
                title={tExp("svgTitle")}
                disabled={!canExportVisual || isExporting || uiBusy}
                className={exportIconBtnClass}
                onClick={() =>
                  void runExport("SVG", (el) => exportPreviewAsSvg(el))
                }
              >
                <span className="material-symbols-outlined text-[24px]">
                  polyline
                </span>
              </button>
              <button
                type="button"
                aria-label={tExp("pngAria")}
                title={tExp("pngTitle")}
                disabled={!canExportVisual || isExporting || uiBusy}
                className={exportIconBtnClass}
                onClick={() =>
                  void runExport("PNG", (el) =>
                    exportPreviewAsPngTransparent(el),
                  )
                }
              >
                <span className="material-symbols-outlined text-[24px]">
                  image
                </span>
              </button>
              <button
                type="button"
                aria-label={tExp("pdfAria")}
                title={tExp("pdfTitle")}
                disabled={!canExportVisual || isExporting || uiBusy}
                className={exportIconBtnClass}
                onClick={() =>
                  void runExport("PDF", (el) => exportPreviewAsPdf(el))
                }
              >
                <span className="material-symbols-outlined text-[24px]">
                  picture_as_pdf
                </span>
              </button>
              <button
                type="button"
                aria-label={tExp("copyRawAria")}
                title={tExp("copyRawTitle")}
                disabled={!canCopyRawLatex || uiBusy}
                className={exportIconBtnClass}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(latex);
                    onToast({
                      tone: "success",
                      message: tToast("rawLatexCopied"),
                    });
                  } catch {
                    onToast({
                      tone: "error",
                      message: tToast("latexCopyFailed"),
                    });
                  }
                }}
              >
                <span className="material-symbols-outlined text-[24px]">
                  data_object
                </span>
              </button>
            </div>
          </div>

          <p className="mt-md text-center font-body-sm text-body-sm text-slate-600 dark:text-slate-300">
            {t("footnote")}
          </p>
        </footer>
      </section>

      {isSaveDialogOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 dark:bg-black/60"
          role="presentation"
          onClick={() => {
            setIsSaveDialogOpen(false);
            setSaveTitle("");
          }}
        >
          <div
            className="flex h-auto min-h-0 w-full max-w-full flex-col overflow-y-auto rounded-t-2xl border border-slate-200 border-b-0 bg-white p-gutter pb-[max(1rem,env(safe-area-inset-bottom))] pt-md shadow-lg sm:max-h-[min(90vh,680px)] sm:max-w-md sm:rounded-lg sm:border sm:border-b dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="save-dialog-title"
              className="font-h3 text-h3 text-slate-900 dark:text-slate-100"
            >
              {t("saveModal.title")}
            </h3>
            <p className="mt-xs font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
              {t("saveModal.description")}
            </p>
            <input
              type="text"
              value={saveTitle}
              onChange={(event) => setSaveTitle(event.target.value)}
              placeholder={t("saveModal.placeholder")}
              className="mt-sm w-full rounded-DEFAULT border border-slate-200 bg-white px-3 py-2 font-body-sm text-body-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <div className="mt-md flex flex-wrap justify-end gap-sm border-t border-slate-100 pt-md dark:border-slate-800 sm:border-0 sm:pt-0">
              <button
                type="button"
                className="min-h-[44px] rounded-lg px-4 font-body-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => {
                  setIsSaveDialogOpen(false);
                  setSaveTitle("");
                }}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveFormula()}
                className="min-h-[44px] rounded-DEFAULT bg-primary px-4 font-body-sm font-medium text-on-primary transition-colors hover:bg-surface-tint disabled:opacity-60"
              >
                {isSaving ? tCommon("saving") : tCommon("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isOcrModalOpen ? (
        <div
          className="fixed inset-0 z-[102] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4 dark:bg-black/60"
          role="presentation"
          onClick={() => setIsOcrModalOpen(false)}
        >
          <div
            className="flex min-h-[88dvh] w-full max-w-full flex-col overflow-y-auto rounded-t-2xl border border-slate-200 border-b-0 bg-white p-gutter pb-[max(1rem,env(safe-area-inset-bottom))] pt-md shadow-xl sm:min-h-0 sm:max-h-[min(90vh,680px)] sm:max-w-md sm:rounded-lg sm:border-b dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ocr-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="ocr-dialog-title"
              className="font-h3 text-h3 text-slate-900 dark:text-slate-100"
            >
              {t("ocrModal.title")}
            </h3>
            <p className="mt-xs font-body-sm text-body-sm text-slate-600 dark:text-slate-400">
              {t("ocrModal.hintBefore")}{" "}
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {t("ocrModal.keyCtrl")}
              </kbd>
              {" + "}
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {t("ocrModal.keyV")}
              </kbd>{" "}
              {t("ocrModal.hintAfter")}
            </p>
            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleOcrImageFile(file);
              }}
            />
            <div
              ref={ocrDropZoneRef}
              tabIndex={0}
              className="mt-md flex min-h-[min(200px,35vh)] flex-1 cursor-pointer flex-col items-center justify-center gap-sm rounded-DEFAULT border-2 border-dashed border-slate-300 bg-slate-50/80 p-md text-center outline-none transition-colors [touch-action:manipulation] hover:border-primary/60 hover:bg-primary/5 focus:border-primary focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-950/50 dark:hover:border-primary/50 sm:min-h-[160px] sm:flex-none"
              onClick={() => ocrFileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  ocrFileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void handleOcrImageFile(file);
              }}
            >
              <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500">
                add_photo_alternate
              </span>
              <span className="font-body-sm text-body-sm text-slate-700 dark:text-slate-300">
                {t("ocrModal.dropzone")}
              </span>
              <span className="font-body-sm text-body-sm text-slate-500 dark:text-slate-400">
                {t("ocrModal.pasteNote")}
              </span>
            </div>
            <div className="mt-md flex justify-end border-t border-slate-100 pt-md dark:border-slate-800 sm:border-0 sm:pt-0">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg px-4 font-body-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => setIsOcrModalOpen(false)}
              >
                {tCommon("cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

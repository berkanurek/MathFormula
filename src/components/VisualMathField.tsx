"use client";

import "@/lib/mathliveFonts";
import { useIsNarrowViewport } from "@/hooks/useMatchMedia";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { MathfieldElement } from "mathlive";

type Props = {
  value: string;
  onChange: (latex: string) => void;
  className?: string;
  id?: string;
};

/** LaTeX suitable for KaTeX / React state — always read after MathLive has parsed content. */
function readLatex(el: MathfieldElement): string {
  try {
    const exported = el.getValue("latex");
    if (exported?.trim()) return exported;
  } catch {
    // fall through
  }
  return el.value ?? "";
}

function stripLatexDelimiters(input: string): string {
  const raw = input.trim();
  if (raw.startsWith("$$") && raw.endsWith("$$") && raw.length > 4) {
    return raw.slice(2, -2).trim();
  }
  if (raw.startsWith("$") && raw.endsWith("$") && raw.length > 2) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

/** True when clipboard text should be handed to MathLive (not plain-text normalized). */
function isLikelyLatex(input: string): boolean {
  const s = stripLatexDelimiters(input);
  if (s.startsWith("\\")) return true;
  if (/\\[a-zA-Z@]+/.test(s)) return true;
  return false;
}

function normalizePlainPasteForMathField(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  if (isLikelyLatex(raw)) return stripLatexDelimiters(raw);

  let latex = raw
    .replace(/×/g, "*")
    .replace(/÷/g, "/");

  for (let i = 0; i < 3; i += 1) {
    const next = latex
      .replace(/sqrt\(([^()]+)\)/g, "\\sqrt{$1}")
      .replace(/log_([a-zA-Z0-9]+)\(([^()]+)\)/g, "\\log_{$1}\\left($2\\right)")
      .replace(/log\(([^()]+)\)/g, "\\log\\left($1\\right)");
    if (next === latex) break;
    latex = next;
  }

  latex = latex.replace(
    /\^(?!\{)(\([^()]+\)|-?\d+(?:\.\d+)?|[a-zA-Z])/g,
    (_match, exponent: string) => `^{${exponent.replace(/^\((.*)\)$/, "$1")}}`,
  );

  for (let i = 0; i < 2; i += 1) {
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
    .replace(/([a-zA-Z}\\])\s*\\cdot\s*([a-zA-Z\\{])/g, "$1 $2");

  const openCount = (latex.match(/\(/g) ?? []).length;
  const closeCount = (latex.match(/\)/g) ?? []).length;
  if (!latex.includes("\\left(") && openCount === closeCount) {
    latex = latex.replace(/\(/g, "\\left(").replace(/\)/g, "\\right)");
  }

  return latex;
}

/**
 * WYSIWYG math editor (MathLive). Exports LaTeX via `onChange` for the workspace and Word copy.
 */
export const VisualMathField = forwardRef<MathfieldElement, Props>(
  function VisualMathField({ value, onChange, className, id }, ref) {
    const [mounted, setMounted] = useState(false);
    const isNarrow = useIsNarrowViewport();
    const innerRef = useRef<MathfieldElement | null>(null);
    const didSelectAllRef = useRef(false);
    const pendingNativePasteFinalizeRef = useRef(false);
    const lastEmittedLatexRef = useRef(value);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const setRefs = useCallback(
      (node: MathfieldElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as MutableRefObject<MathfieldElement | null>).current = node;
      },
      [ref],
    );

    useEffect(() => {
      setMounted(true);
    }, []);

    const pushLatexToParent = useCallback((next: string, force = false) => {
      if (!force && next === lastEmittedLatexRef.current) return;
      lastEmittedLatexRef.current = next;
      onChangeRef.current(next);
    }, []);

    const syncLatexFromElement = useCallback((force = false) => {
      const el = innerRef.current;
      if (!el) return;
      pushLatexToParent(readLatex(el), force);
    }, [pushLatexToParent]);

    const finalizePasteLikeKeystroke = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;

      const run = () => {
        try {
          el.executeCommand("commit");
        } catch {
          // commit may be unavailable in some contexts
        }

        const exported = readLatex(el);
        pushLatexToParent(exported, true);

        el.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertFromPaste",
          }),
        );
      };

      run();
      queueMicrotask(run);
      requestAnimationFrame(run);
      window.setTimeout(run, 0);
      window.setTimeout(run, 50);
    }, [pushLatexToParent]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      const handleInput = () => {
        syncLatexFromElement();
      };

      const handleKeyDown = async (event: KeyboardEvent) => {
        const isPrimaryModifier = event.ctrlKey || event.metaKey;
        if (!isPrimaryModifier) return;
        const key = event.key.toLowerCase();

        if (key === "a") {
          event.preventDefault();
          didSelectAllRef.current = true;
          el.executeCommand("selectAll");
          return;
        }

        if (key === "c") {
          event.preventDefault();
          try {
            const selected = window.getSelection?.()?.toString().trim();
            const textToCopy = selected || readLatex(el);
            await navigator.clipboard.writeText(textToCopy);
          } catch {
            document.execCommand("copy");
          }
        }
      };

      const keepFocus = () => {
        if (document.activeElement !== el) {
          el.focus();
        }
      };

      const handlePasteCapture = (event: ClipboardEvent) => {
        const pasted = event.clipboardData?.getData("text/plain") ?? "";
        const hasNonTextPayload = Array.from(event.clipboardData?.types ?? []).some(
          (type) => type !== "text/plain",
        );

        if (!pasted.trim()) {
          if (hasNonTextPayload) {
            pendingNativePasteFinalizeRef.current = true;
          }
          return;
        }

        if (isLikelyLatex(pasted)) {
          pendingNativePasteFinalizeRef.current = true;
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const normalizedPaste = normalizePlainPasteForMathField(pasted);
        if (didSelectAllRef.current) {
          didSelectAllRef.current = false;
          el.value = normalizedPaste;
        } else {
          el.insert(normalizedPaste, { focus: true, mode: "math" });
        }
        finalizePasteLikeKeystroke();
      };

      const handlePasteBubble = () => {
        if (!pendingNativePasteFinalizeRef.current) return;
        pendingNativePasteFinalizeRef.current = false;
        finalizePasteLikeKeystroke();
      };

      el.addEventListener("input", handleInput, { capture: true });
      el.addEventListener("keydown", handleKeyDown);
      el.addEventListener("pointerdown", keepFocus);
      el.addEventListener("paste", handlePasteCapture, { capture: true });
      el.addEventListener("paste", handlePasteBubble);
      return () => {
        el.removeEventListener("input", handleInput, { capture: true });
        el.removeEventListener("keydown", handleKeyDown);
        el.removeEventListener("pointerdown", keepFocus);
        el.removeEventListener("paste", handlePasteCapture, { capture: true });
        el.removeEventListener("paste", handlePasteBubble);
      };
    }, [mounted, finalizePasteLikeKeystroke, syncLatexFromElement]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      if (value === lastEmittedLatexRef.current) return;
      el.value = value;
      lastEmittedLatexRef.current = value;
    }, [mounted, value]);

    if (!mounted) {
      return (
        <div
          id={id}
          className={className}
          aria-busy="true"
          aria-label="Loading math editor"
        />
      );
    }

    return (
      <math-field
        ref={setRefs}
        id={id}
        className={className}
        math-virtual-keyboard-policy={isNarrow ? "manual" : "auto"}
      />
    );
  },
);

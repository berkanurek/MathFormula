"use client";

import "@/lib/mathliveFonts";
import { useIsNarrowViewport } from "@/hooks/useMatchMedia";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
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

function normalizeForMathField(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  if (raw.startsWith("\\")) return raw;

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
    const normalizedCurrentValue = useMemo(
      () => normalizeForMathField(value),
      [value],
    );
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

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      const handleInput = () => {
        onChange(el.getValue("latex"));
      };

      el.addEventListener("input", handleInput);
      return () => el.removeEventListener("input", handleInput);
    }, [mounted, onChange]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

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
            const textToCopy = selected || el.getValue("latex");
            await navigator.clipboard.writeText(textToCopy);
          } catch {
            // Fallback to native behavior if clipboard API is blocked.
            document.execCommand("copy");
          }
          return;
        }

        if (key === "v") return;
      };

      const keepFocus = () => {
        if (document.activeElement !== el) {
          el.focus();
        }
      };

      const handlePaste = (event: ClipboardEvent) => {
        event.preventDefault();
        const pasted = event.clipboardData?.getData("text/plain") ?? "";
        if (!pasted) return;
        const normalizedPaste = normalizeForMathField(pasted);

        // If user just did Ctrl/Cmd+A, replace the full editor content.
        if (didSelectAllRef.current) {
          el.setValue(normalizedPaste);
          didSelectAllRef.current = false;
        } else {
          el.executeCommand(["insert", normalizedPaste]);
        }
        onChange(el.getValue("latex"));
      };

      el.addEventListener("keydown", handleKeyDown);
      el.addEventListener("pointerdown", keepFocus);
      el.addEventListener("paste", handlePaste);
      return () => {
        el.removeEventListener("keydown", handleKeyDown);
        el.removeEventListener("pointerdown", keepFocus);
        el.removeEventListener("paste", handlePaste);
      };
    }, [mounted]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      const current = el.getValue("latex");
      if (current !== normalizedCurrentValue) {
        el.setValue(normalizedCurrentValue);
      }
    }, [mounted, normalizedCurrentValue]);

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

"use client";

import "@/lib/mathliveFonts";
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

/**
 * WYSIWYG math editor (MathLive). Exports LaTeX via `onChange` for the workspace and Word copy.
 */
export const VisualMathField = forwardRef<MathfieldElement, Props>(
  function VisualMathField({ value, onChange, className, id }, ref) {
    const [mounted, setMounted] = useState(false);
    const innerRef = useRef<MathfieldElement | null>(null);
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
      const current = el.getValue("latex");
      if (current !== value) {
        el.setValue(value);
      }
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
        math-virtual-keyboard-policy="auto"
      />
    );
  },
);

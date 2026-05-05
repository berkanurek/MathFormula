import { evaluate, format, typeOf } from "mathjs";
// Bundled build registers solveEquations on nerdamer (Solve + Algebra + Calculus).
// @ts-expect-error — package ships typings for core only; all.js augments at runtime.
import nerdamer from "nerdamer/all.js";

export type EvaluateOutcome =
  | { ok: true; display: string; mode: "numeric" | "solution" }
  | {
      ok: false;
      reason:
        | "symbolic"
        | "syntax"
        | "domain"
        | "zerodiv"
        | "equation_none";
      detail?: string;
    };

type NerdamerCallable = typeof nerdamer & {
  solveEquations(eqn: string, variable: string): unknown;
};

const n = nerdamer as NerdamerCallable;

/** Split at top-level `=` (brace depth), skipping `\command` names so `\frac{a}{b}=c` works. */
export function splitEquationAtEquals(latexInput: string): {
  lhs: string;
  rhs: string;
} | null {
  let depth = 0;
  const s = latexInput.trim();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      i = j - 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "=" && depth === 0) {
      const lhs = s.slice(0, i).trim();
      const rhs = s.slice(i + 1).trim();
      if (lhs.length && rhs.length) return { lhs, rhs };
      return null;
    }
  }
  return null;
}

function inferSolveVariable(lhsExpr: string, rhsExpr: string): string | null {
  try {
    const merged = `${lhsExpr}-(${rhsExpr})`;
    const vars = n(merged).variables() as string[];
    if (!vars?.length) return null;
    if (vars.includes("x")) return "x";
    const order = ["y", "z", "t", "n", "a", "b", "c", "k", "r", "u", "v", "w"];
    for (const v of order) {
      if (vars.includes(v)) return v;
    }
    return vars.sort()[0] ?? null;
  } catch {
    return null;
  }
}

function nerdamerPartToString(part: unknown): string {
  if (typeof part === "object" && part !== null && "text" in part) {
    const t = (part as { text?: () => string }).text;
    if (typeof t === "function") return t.call(part);
  }
  return String(part);
}

function formatNerdamerSolutions(solutions: unknown, variable: string): string {
  if (solutions == null) return "";

  if (Array.isArray(solutions)) {
    if (solutions.length === 0) return "";
    return solutions
      .map((s) => `${variable} = ${nerdamerPartToString(s)}`)
      .join(", ");
  }

  return `${variable} = ${nerdamerPartToString(solutions)}`;
}

function trySolveEquation(lhsLatex: string, rhsLatex: string): EvaluateOutcome {
  const lhsExpr = latexToMathjsExpression(lhsLatex);
  const rhsExpr = latexToMathjsExpression(rhsLatex);
  if (!lhsExpr.trim() || !rhsExpr.trim()) {
    return { ok: false, reason: "syntax", detail: "Empty side of equation" };
  }

  const variable = inferSolveVariable(lhsExpr, rhsExpr);
  if (!variable) {
    return {
      ok: false,
      reason: "symbolic",
      detail: "Could not infer a variable to solve for.",
    };
  }

  const eqStr = `${lhsExpr}=${rhsExpr}`;

  try {
    const sol = n.solveEquations(eqStr, variable);

    if (sol == null) {
      return {
        ok: false,
        reason: "symbolic",
        detail: "Solver returned no result.",
      };
    }

    if (Array.isArray(sol) && sol.length === 0) {
      return { ok: false, reason: "equation_none" };
    }

    const formatted = formatNerdamerSolutions(sol, variable);
    if (!formatted.trim()) {
      return {
        ok: false,
        reason: "symbolic",
        detail: "Empty solution set.",
      };
    }

    return { ok: true, display: formatted, mode: "solution" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: "symbolic",
      detail: msg,
    };
  }
}

/** Extract `{...}` starting at index `start` (must point at `{`). Returns inner text and index after `}`. */
function takeBalancedBrace(s: string, start: number): { inner: string; end: number } | null {
  if (s[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        return { inner: s.slice(start + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Replace `\frac{num}{den}` / `\dfrac{num}{den}` with `(converted(num))/(converted(den))`
 * using balanced braces so simple nesting works.
 */
function replaceFracCommands(s: string): string {
  const marker = /\\(?:d)?frac\b/.exec(s);
  if (!marker || marker.index === undefined) return s;

  const i = marker.index + marker[0].length;
  const num = takeBalancedBrace(s, i);
  if (!num) return s;
  const den = takeBalancedBrace(s, num.end);
  if (!den) return s;

  const before = s.slice(0, marker.index);
  const after = s.slice(den.end);
  const inner =
    "(" +
    latexToMathjsExpressionInner(num.inner) +
    ")/(" +
    latexToMathjsExpressionInner(den.inner) +
    ")";
  return before + inner + after;
}

/** Inner fragment (already inside a frac); avoid infinite recursion via replaceFracCommands entry. */
function latexToMathjsExpressionInner(fragment: string): string {
  let t = fragment.trim();
  t = t.replace(/\\cdot\b/g, "*");
  t = t.replace(/\\times\b/g, "*");
  t = t.replace(/\\div\b/g, "/");
  t = t.replace(/\\pi\b/gi, "pi");
  t = t.replace(/\\infty\b/g, "Infinity");
  t = t.replace(/\\left\b/g, "");
  t = t.replace(/\\right\b/g, "");
  t = t.replace(/\\[,;:]/g, " ");
  // Nested frac inside numerator/denominator
  while (/\\(?:d)?frac\b/.test(t)) {
    t = replaceFracCommands(t);
  }
  t = applySqrtAndScripts(t);
  t = applyTrigLog(t);
  t = unwrapParenGroups(t);
  return t.replace(/\s+/g, " ").trim();
}

function applySqrtAndScripts(s: string): string {
  let t = s;
  // \sqrt[n]{body}
  while (true) {
    const m = /\\sqrt\s*\[/.exec(t);
    if (!m || m.index === undefined) break;
    const bracketStart = m.index + m[0].length - 1;
    const closeBracket = t.indexOf("]", bracketStart + 1);
    if (closeBracket < 0) break;
    const nStr = t.slice(bracketStart + 1, closeBracket).trim();
    const afterBracket = closeBracket + 1;
    const body = takeBalancedBrace(t, afterBracket);
    if (!body) break;
    const repl = `nthRoot(${latexToMathjsExpressionInner(body.inner)}, ${latexToMathjsExpressionInner(nStr)})`;
    t = t.slice(0, m.index) + repl + t.slice(body.end);
  }
  // \sqrt{body}
  while (true) {
    const m = /\\sqrt\b/.exec(t);
    if (!m || m.index === undefined) break;
    const open = m.index + m[0].length;
    const body = takeBalancedBrace(t, open);
    if (!body) break;
    const repl = `sqrt(${latexToMathjsExpressionInner(body.inner)})`;
    t = t.slice(0, m.index) + repl + t.slice(body.end);
  }
  // ^{...}
  t = t.replace(/\^\s*\{([^}]*)\}/g, "^($1)");
  // _{...} subscripts — usually symbolic; strip numeric-only subscripts for identifiers
  t = t.replace(/_\s*\{([^}]*)\}/g, "");
  return t;
}

function applyTrigLog(s: string): string {
  return s
    .replace(/\\sin\b/g, "sin")
    .replace(/\\cos\b/g, "cos")
    .replace(/\\tan\b/g, "tan")
    .replace(/\\asin\b/g, "asin")
    .replace(/\\acos\b/g, "acos")
    .replace(/\\atan\b/g, "atan")
    .replace(/\\ln\b/g, "log")
    .replace(/\\log\b/g, "log10")
    .replace(/\\exp\b/g, "exp");
}

/** Replace `\log_{10}` style accidentally introduced — mathjs uses log10(x). */
function unwrapParenGroups(s: string): string {
  return s.replace(/\\mathrm\{([^}]*)\}/g, "$1");
}

/**
 * Convert a subset of LaTeX to a mathjs-parseable expression.
 * Complex or unsupported constructs may still fail at evaluate time.
 */
export function latexToMathjsExpression(latex: string): string {
  let s = latex.trim();
  if (!s) return "";

  s = s.replace(/\\cdot\b/g, "*");
  s = s.replace(/\\times\b/g, "*");
  s = s.replace(/\\div\b/g, "/");
  s = s.replace(/\\pi\b/gi, "pi");
  s = s.replace(/\\infty\b/g, "Infinity");
  s = s.replace(/\\left\b/g, "");
  s = s.replace(/\\right\b/g, "");
  s = s.replace(/\s+/g, " ");

  while (/\\(?:d)?frac\b/.test(s)) {
    s = replaceFracCommands(s);
  }

  s = applySqrtAndScripts(s);
  s = applyTrigLog(s);
  s = unwrapParenGroups(s);

  // Remaining braces used only for grouping → parentheses
  s = s.replace(/\{([^{}]*)\}/g, "($1)");

  return s.replace(/\s+/g, " ").trim();
}

function isNumericLike(value: unknown): boolean {
  const t = typeOf(value);
  return (
    t === "number" ||
    t === "BigNumber" ||
    t === "Fraction" ||
    t === "Complex" ||
    t === "Unit"
  );
}

export function evaluateLatexNumeric(latex: string): EvaluateOutcome {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { ok: false, reason: "syntax", detail: "Empty expression" };
  }

  const equation = splitEquationAtEquals(trimmed);
  if (equation) {
    return trySolveEquation(equation.lhs, equation.rhs);
  }

  const expr = latexToMathjsExpression(trimmed);
  if (!expr.trim()) {
    return { ok: false, reason: "syntax", detail: "Empty expression" };
  }

  try {
    const raw = evaluate(expr);

    if (typeof raw === "number") {
      if (Number.isNaN(raw)) {
        return { ok: false, reason: "domain" };
      }
      if (!Number.isFinite(raw)) {
        return { ok: false, reason: "zerodiv" };
      }
      return { ok: true, display: format(raw, { precision: 14 }), mode: "numeric" };
    }

    if (isNumericLike(raw)) {
      const str = format(raw, { precision: 14 });
      return { ok: true, display: str, mode: "numeric" };
    }

    return { ok: false, reason: "symbolic" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const combined = msg.toLowerCase();

    if (
      combined.includes("divide by zero") ||
      combined.includes("division by zero") ||
      combined.includes("infinity")
    ) {
      return { ok: false, reason: "zerodiv", detail: msg };
    }
    if (
      combined.includes("undefined symbol") ||
      combined.includes("undefined function") ||
      /\bx\b.*not defined|unexpected/i.test(combined)
    ) {
      return { ok: false, reason: "symbolic", detail: msg };
    }

    return { ok: false, reason: "syntax", detail: msg };
  }
}

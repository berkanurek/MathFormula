export type FormulaCategory =
  | "algebra"
  | "geometry"
  | "trigonometry"
  | "derivatives"
  | "integrals";

export type FormulaFilter =
  | FormulaCategory
  | "all"
  | "my-library";

export type FormulaItem = {
  id: string;
  category: FormulaCategory;
  latex: string;
};

export const FORMULAS: FormulaItem[] = [
  // Algebra
  {
    id: "alg-quadratic",
    category: "algebra",
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  },
  {
    id: "alg-difference-squares",
    category: "algebra",
    latex: "a^2 - b^2 = (a-b)(a+b)",
  },
  {
    id: "alg-binomial-2",
    category: "algebra",
    latex: "(a+b)^2 = a^2 + 2ab + b^2",
  },
  {
    id: "alg-log-product",
    category: "algebra",
    latex: "\\log_b(xy) = \\log_b x + \\log_b y",
  },
  {
    id: "alg-log-quotient",
    category: "algebra",
    latex: "\\log_b\\left(\\frac{x}{y}\\right)=\\log_b x-\\log_b y",
  },
  {
    id: "alg-exp-product",
    category: "algebra",
    latex: "a^m a^n = a^{m+n}",
  },

  // Geometry
  {
    id: "geo-pythagorean",
    category: "geometry",
    latex: "a^2 + b^2 = c^2",
  },
  {
    id: "geo-circle-area",
    category: "geometry",
    latex: "A = \\pi r^2",
  },
  {
    id: "geo-circle-circumference",
    category: "geometry",
    latex: "C = 2\\pi r",
  },
  {
    id: "geo-triangle-area",
    category: "geometry",
    latex: "A = \\frac{1}{2}bh",
  },
  {
    id: "geo-sphere-volume",
    category: "geometry",
    latex: "V = \\frac{4}{3}\\pi r^3",
  },
  {
    id: "geo-cylinder-volume",
    category: "geometry",
    latex: "V = \\pi r^2 h",
  },

  // Trigonometry
  {
    id: "trig-pythagorean-identity",
    category: "trigonometry",
    latex: "\\sin^2 x + \\cos^2 x = 1",
  },
  {
    id: "trig-tan-identity",
    category: "trigonometry",
    latex: "1 + \\tan^2 x = \\sec^2 x",
  },
  {
    id: "trig-sine-rule",
    category: "trigonometry",
    latex: "\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}",
  },
  {
    id: "trig-cosine-rule",
    category: "trigonometry",
    latex: "c^2 = a^2 + b^2 - 2ab\\cos C",
  },
  {
    id: "trig-double-angle-sin",
    category: "trigonometry",
    latex: "\\sin(2x) = 2\\sin x\\cos x",
  },
  {
    id: "trig-double-angle-cos",
    category: "trigonometry",
    latex: "\\cos(2x) = \\cos^2 x - \\sin^2 x",
  },

  // Derivatives
  {
    id: "derivative-power",
    category: "derivatives",
    latex: "\\frac{d}{dx}(x^n) = nx^{n-1}",
  },
  {
    id: "derivative-product",
    category: "derivatives",
    latex: "(fg)' = f'g + fg'",
  },
  {
    id: "derivative-quotient",
    category: "derivatives",
    latex: "\\left(\\frac{f}{g}\\right)' = \\frac{f'g-fg'}{g^2}",
  },
  {
    id: "derivative-chain",
    category: "derivatives",
    latex: "\\frac{d}{dx}f(g(x)) = f'(g(x))g'(x)",
  },
  {
    id: "derivative-sin",
    category: "derivatives",
    latex: "\\frac{d}{dx}(\\sin x) = \\cos x",
  },
  {
    id: "derivative-ln",
    category: "derivatives",
    latex: "\\frac{d}{dx}(\\ln x)=\\frac{1}{x}",
  },

  // Integrals
  {
    id: "integral-power",
    category: "integrals",
    latex: "\\int x^n\\,dx = \\frac{x^{n+1}}{n+1}+C",
  },
  {
    id: "integral-by-parts",
    category: "integrals",
    latex: "\\int u\\,dv = uv - \\int v\\,du",
  },
  {
    id: "integral-substitution",
    category: "integrals",
    latex: "\\int f(g(x))g'(x)\\,dx = \\int f(u)\\,du",
  },
  {
    id: "integral-fundamental-theorem",
    category: "integrals",
    latex: "\\frac{d}{dx}\\int_a^x f(t)\\,dt = f(x)",
  },
  {
    id: "integral-definite",
    category: "integrals",
    latex: "\\int_a^b f(x)\\,dx = F(b)-F(a)",
  },
  {
    id: "integral-exponential",
    category: "integrals",
    latex: "\\int e^x\\,dx = e^x + C",
  },
];

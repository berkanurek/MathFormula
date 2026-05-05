import type * as React from "react";
import type { MathfieldElement } from "mathlive";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          "math-virtual-keyboard-policy"?: "auto" | "manual" | "sandboxed";
        },
        MathfieldElement
      >;
    }
  }
}

export {};

import katex from "katex";

export type LatexRenderResult =
  | { ok: true; html: string; mathml: string }
  | { ok: false; errorMessage: string };

function normalizeLatex(input: string) {
  return input.trim();
}

export function renderLatexToHtmlAndMathml(latexInput: string): LatexRenderResult {
  const latex = normalizeLatex(latexInput);

  if (!latex) {
    return { ok: true, html: "", mathml: "" };
  }

  try {
    const htmlAndMathml = katex.renderToString(latex, {
      throwOnError: true,
      displayMode: true,
      output: "htmlAndMathml",
      strict: "ignore",
      trust: false,
    });

    const mathml = katex.renderToString(latex, {
      throwOnError: true,
      displayMode: true,
      output: "mathml",
      strict: "ignore",
      trust: false,
    });

    return { ok: true, html: htmlAndMathml, mathml };
  } catch (err) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : "Invalid LaTeX syntax";
    return { ok: false, errorMessage: msg || "Invalid LaTeX syntax" };
  }
}

export async function copyLatexAsWordMathML(latex: string) {
  const rendered = renderLatexToHtmlAndMathml(latex);
  if (!rendered.ok) {
    throw new Error(rendered.errorMessage);
  }

  const { mathml } = rendered;
  // MS Word is picky: wrap MathML in an HTML document and a StartFragment region.
  const htmlPayload = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:m="http://schemas.microsoft.com/office/2004/12/omml">
  <head></head>
  <body>
    <!--StartFragment-->
    ${mathml}
    <!--EndFragment-->
  </body>
</html>
`.trim();

  // Best-effort: attempt rich clipboard payloads first, then fall back.
  const clipboardAny = navigator.clipboard as unknown as {
    write?: (items: ClipboardItem[]) => Promise<void>;
    writeText: (text: string) => Promise<void>;
  };

  if (typeof ClipboardItem !== "undefined" && clipboardAny.write) {
    const blob = new Blob([htmlPayload], { type: "text/html" });
    const clipboardItem = new ClipboardItem({ "text/html": blob });
    await clipboardAny.write([clipboardItem]);
    return;
  }

  // Fallback: at least provide MathML text for environments without ClipboardItem.
  await clipboardAny.writeText(mathml);
}


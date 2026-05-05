import { getFontEmbedCSS, toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";

type HtmlToImageOptions = NonNullable<Parameters<typeof toPng>[1]>;

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Without this, html-to-image walks every stylesheet to embed webfonts and hits
 * SecurityError when reading cssRules on cross-origin `<link>` sheets without CORS.
 */
const SAFE_HTML_TO_IMAGE: HtmlToImageOptions = {
  skipFonts: true,
  cacheBust: true,
};

function mergeOptions(overrides?: HtmlToImageOptions): HtmlToImageOptions {
  return { ...SAFE_HTML_TO_IMAGE, ...overrides };
}

function isSecurityError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "SecurityError" || e.code === 18)
  );
}

/**
 * Lists stylesheets and whether `cssRules` is readable (cross-origin blocks access).
 * Does not modify the DOM; useful for debugging export failures.
 */
export function inspectStylesheetAccess(doc: Document | undefined): Array<{
  href: string | null;
  readable: boolean;
}> {
  if (typeof document === "undefined" || !doc) return [];
  try {
    return Array.from(doc.styleSheets).map((sheet) => {
      try {
        void sheet.cssRules;
        return { href: sheet.href ?? null, readable: true };
      } catch {
        return { href: sheet.href ?? null, readable: false };
      }
    });
  } catch {
    return [];
  }
}

/** True if any stylesheet is unreadable (typical: cross-origin without CORS). */
function hasTaintedStylesheet(doc: Document | undefined): boolean {
  return inspectStylesheetAccess(doc).some((s) => !s.readable);
}

/**
 * Optionally builds font embed CSS only when rules are readable (avoids
 * getFontEmbedCSS throwing on tainted sheets). Returns undefined on failure.
 */
async function tryFontEmbedCSS(node: HTMLElement): Promise<string | undefined> {
  const doc = node.ownerDocument ?? (typeof document !== "undefined" ? document : undefined);
  if (hasTaintedStylesheet(doc)) {
    return undefined;
  }
  try {
    return await getFontEmbedCSS(node, {
      skipFonts: false,
      cacheBust: true,
    });
  } catch (e) {
    if (isSecurityError(e)) {
      console.warn(
        "[exportPreview] getFontEmbedCSS skipped (SecurityError):",
        e,
      );
      return undefined;
    }
    console.warn("[exportPreview] getFontEmbedCSS failed:", e);
    return undefined;
  }
}

async function captureToPng(
  element: HTMLElement,
  options: HtmlToImageOptions,
): Promise<string> {
  try {
    return await toPng(element, options);
  } catch (first) {
    if (!isSecurityError(first)) {
      throw first instanceof Error
        ? first
        : new Error(String(first));
    }

    console.warn(
      "[exportPreview] toPng SecurityError; retrying with skipFonts and no fontEmbedCSS:",
      first,
    );

    const fallback: HtmlToImageOptions = {
      ...options,
      skipFonts: true,
      fontEmbedCSS: undefined,
    };

    try {
      return await toPng(element, fallback);
    } catch (second) {
      const tainted = inspectStylesheetAccess(element.ownerDocument ?? document);
      const blocked = tainted.filter((s) => !s.readable);
      throw new Error(
        `Export failed (cross-origin CSS). ${blocked.length} stylesheet(s) are not readable. ` +
          `Try skipFonts (already applied) or host CSS with crossorigin="anonymous". ` +
          (second instanceof Error ? second.message : String(second)),
      );
    }
  }
}

export async function exportPreviewAsSvg(element: HTMLElement) {
  const fontEmbedCSS = await tryFontEmbedCSS(element);
  const dataUrl = await toSvg(
    element,
    mergeOptions({
      backgroundColor: "transparent",
      pixelRatio: 2,
      ...(fontEmbedCSS ? { fontEmbedCSS, skipFonts: false } : {}),
    }),
  );
  downloadDataUrl(dataUrl, "formula.svg");
}

export async function exportPreviewAsPngTransparent(element: HTMLElement) {
  const fontEmbedCSS = await tryFontEmbedCSS(element);
  const dataUrl = await captureToPng(
    element,
    mergeOptions({
      pixelRatio: 3,
      backgroundColor: "rgba(0,0,0,0)",
      ...(fontEmbedCSS ? { fontEmbedCSS, skipFonts: false } : {}),
    }),
  );
  downloadDataUrl(dataUrl, "formula.png");
}

export async function exportPreviewAsPdf(element: HTMLElement) {
  let dataUrl: string;
  try {
    const fontEmbedCSS = await tryFontEmbedCSS(element);
    dataUrl = await captureToPng(
      element,
      mergeOptions({
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        ...(fontEmbedCSS ? { fontEmbedCSS, skipFonts: false } : {}),
      }),
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not render formula to image.";
    console.error("[exportPreview] exportPreviewAsPdf capture failed:", e);
    throw new Error(message);
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  const props = pdf.getImageProperties(dataUrl);
  const imgRatio = props.height / props.width;
  let drawWidth = maxWidth;
  let drawHeight = drawWidth * imgRatio;
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight / imgRatio;
  }

  const x = margin + (maxWidth - drawWidth) / 2;
  const y = margin;

  pdf.addImage(dataUrl, "PNG", x, y, drawWidth, drawHeight);
  pdf.save("formula.pdf");
}

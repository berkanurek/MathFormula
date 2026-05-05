/**
 * Downscale and re-encode camera/gallery images before OCR so requests stay small
 * (avoids 413 / timeouts on mobile).
 */

const MAX_EDGE_PX = 1920;
const JPEG_QUALITY_START = 0.82;
const JPEG_QUALITY_MIN = 0.45;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns a data URL and MIME type suitable for `/api/ocr`.
 */
export async function compressImageFileForOcr(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
}> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image");
  }

  if (file.size <= 700 * 1024) {
    const dataUrl = await readAsDataUrl(file);
    const base64Len = (dataUrl.split(",")[1] ?? "").length;
    if (base64Len < 1_200_000) {
      return { dataUrl, mimeType: file.type || "image/jpeg" };
    }
  }

  try {
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width;
    let h = bitmap.height;
    const maxEdge = Math.max(w, h);
    const scale =
      maxEdge > MAX_EDGE_PX ? MAX_EDGE_PX / maxEdge : 1;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("Canvas unsupported");
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const mimeType = "image/jpeg";
    let q = JPEG_QUALITY_START;
    let dataUrl = canvas.toDataURL(mimeType, q);
    while (dataUrl.length > 2_200_000 && q > JPEG_QUALITY_MIN) {
      q -= 0.08;
      dataUrl = canvas.toDataURL(mimeType, q);
    }
    return { dataUrl, mimeType };
  } catch {
    const dataUrl = await readAsDataUrl(file);
    return { dataUrl, mimeType: file.type || "image/png" };
  }
}

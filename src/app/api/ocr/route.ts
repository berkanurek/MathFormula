import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are a specialized Mathematical OCR. Analyze the provided image and extract ONLY the mathematical formula as a LaTeX string. Do not include markdown code blocks, explanations, or any other text. Just the raw LaTeX.";

const USER_IMAGE_PROMPT = "Extract the formula from this image.";

/** Default chain: stable alias first, then explicit names (SDK / regional differences). */
const DEFAULT_MODEL_CHAIN = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
] as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Vision models (no :free suffix; OpenRouter routes to available endpoints). */
const OPENROUTER_MODEL_CHAIN = [
  "google/gemini-flash-1.5-8b",
  "meta-llama/llama-3.2-11b-vision-instruct",
  "qwen/qwen-2-vl-72b-instruct",
  "microsoft/phi-3.5-vision-instruct",
] as const;

const ALL_MODELS_NOT_FOUND_MESSAGE =
  "API connection successful, but the model ID is invalid. Please check your Google AI Studio project settings.";

/** Prefer GOOGLE_GEMINI_API_KEY; common alternates from Google docs / samples. */
function resolveGeminiApiKey(): string | undefined {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
}

function resolveOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/** Env override first, then defaults without duplicates. */
function buildModelChain(): string[] {
  const envModel = process.env.GEMINI_OCR_MODEL?.trim();
  const defaults = [...DEFAULT_MODEL_CHAIN];
  if (!envModel) return defaults;
  const rest = defaults.filter((m) => m !== envModel);
  return [envModel, ...rest];
}

function parseImagePayload(
  imageBase64: string,
  mimeType?: string,
): { mimeType: string; data: string } {
  const trimmed = imageBase64.trim();
  const dataUrl = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (dataUrl) {
    return {
      mimeType:
        typeof mimeType === "string" && mimeType.startsWith("image/")
          ? mimeType
          : dataUrl[1] || "image/png",
      data: dataUrl[2].replace(/\s/g, ""),
    };
  }
  return {
    mimeType:
      typeof mimeType === "string" && mimeType.startsWith("image/")
        ? mimeType
        : "image/png",
    data: trimmed.replace(/\s/g, ""),
  };
}

function normalizeLatexOutput(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s
      .replace(/^```(?:latex|tex|math)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
  }
  s = s.replace(/^[`"'\u201c\u201d]+|[`"'\u201c\u201d]+$/g, "");
  return s.trim();
}

function formatGeminiError(error: unknown): string {
  if (error instanceof Error) {
    const m = error.message;
    if (/API[_ ]?KEY|API key|PERMISSION_DENIED|401|403/i.test(m)) {
      return "Invalid API key or access denied. Check GOOGLE_GEMINI_API_KEY.";
    }
    if (/not found|NOT_FOUND|404|was not found/i.test(m)) {
      return `Model not found or unavailable. Set GEMINI_OCR_MODEL to a valid model (error: ${m.slice(0, 160)})`;
    }
    if (/quota|429|RESOURCE_EXHAUSTED/i.test(m)) {
      return "Gemini quota exceeded or rate limited. Try again later.";
    }
    if (/deadline|timeout|ETIMEDOUT|Deadline/i.test(m)) {
      return "Model timeout. Try a smaller image or retry.";
    }
    if (/Payload|too large|size|MAX_TOKENS/i.test(m)) {
      return "Image or payload too large for the model.";
    }
    return m.length > 280 ? `${m.slice(0, 280)}…` : m;
  }
  return "Gemini request failed.";
}

function formatOpenRouterError(error: unknown): string {
  if (error instanceof Error) {
    const m = error.message;
    return m.length > 280 ? `${m.slice(0, 280)}…` : m;
  }
  return "OpenRouter request failed.";
}

function formatCombinedFailure(
  geminiErr: unknown | undefined,
  openRouterErr: unknown | undefined,
): string {
  const parts: string[] = [];
  if (geminiErr) {
    parts.push(`Gemini: ${formatGeminiError(geminiErr)}`);
  }
  if (openRouterErr) {
    parts.push(`OpenRouter: ${formatOpenRouterError(openRouterErr)}`);
  }
  if (parts.length === 0) {
    return "OCR failed. Please try again or use a different image.";
  }
  return parts.join(" ");
}

/** Model missing / wrong name (404 from Google API). */
function isLikelyModelNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  const cause = error.cause;
  const causeStr =
    cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const combined = `${msg} ${causeStr}`;
  return /404|not\s*found|NOT_FOUND|was not found|does not exist|invalid.*model|model.*not.*found|No matching model/i.test(
    combined,
  );
}

/** Quota / 429: hand off to OpenRouter immediately — do not try other Gemini model IDs. */
function isGeminiQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  const cause = error.cause;
  const causeStr =
    cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const combined = `${msg} ${causeStr}`.toLowerCase();
  return (
    /\b429\b|resource_exhausted|quota exceeded|quota|rate.?limit|too many requests/i.test(
      combined,
    )
  );
}

/**
 * 401 / invalid key, or 500-class → stop Gemini chain and use OpenRouter backup.
 * (429 is handled above with explicit logging.)
 */
function geminiErrorRequiresOpenRouterFallback(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  const cause = error.cause;
  const causeStr =
    cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const combined = `${msg} ${causeStr}`.toLowerCase();
  return (
    /\b401\b|\b403\b|api[_ ]?key|permission_denied|invalid.*key|unauthorized/i.test(
      combined,
    ) ||
    /\b500\b|internal error|internal_server|unavailable|503|502|bad gateway/i.test(
      combined,
    )
  );
}

function logGeminiFailure(modelId: string, error: unknown) {
  console.error(`[OCR] Model "${modelId}" failed:`);
  if (error instanceof Error) {
    console.error("[OCR] Message:", error.message);
    if (error.stack) {
      console.error("[OCR] Stack:\n", error.stack);
    }
    if (error.cause) {
      console.error("[OCR] Cause:", error.cause);
    }
  } else {
    console.error("[OCR] Non-Error:", error);
  }
}

function extractOpenRouterMessageContent(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0]) return undefined;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content.map((part) => {
      if (typeof part === "object" && part !== null && "text" in part) {
        return String((part as { text?: string }).text ?? "");
      }
      return "";
    });
    const joined = texts.join("");
    return joined || undefined;
  }
  return undefined;
}

function openRouterHttpErrorMessage(
  status: number,
  data: unknown,
  rawBody: string,
): string {
  if (data && typeof data === "object") {
    const err = (data as { error?: { message?: string } }).error;
    if (err?.message) return `OpenRouter ${status}: ${err.message}`;
  }
  return `OpenRouter request failed (${status}). ${rawBody.slice(0, 200)}`;
}

async function tryOpenRouterVision(
  apiKey: string,
  mimeType: string,
  base64Data: string,
): Promise<{ latex?: string; lastError?: unknown }> {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  let lastError: unknown;

  const referer =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  for (const model of OPENROUTER_MODEL_CHAIN) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          /** Required by OpenRouter for many models (especially free tiers). */
          "HTTP-Referer": referer,
          "X-Title": "MathFormula OCR",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
                { type: "text", text: USER_IMAGE_PROMPT },
              ],
            },
          ],
        }),
      });

      const rawText = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText) as unknown;
      } catch {
        lastError = new Error(
          `OpenRouter returned non-JSON (${res.status}): ${rawText.slice(0, 240)}`,
        );
        console.error(`[OCR] OpenRouter model "${model}" parse failed:`, lastError);
        continue;
      }

      if (!res.ok) {
        const detail = openRouterHttpErrorMessage(res.status, parsed, rawText);
        lastError = new Error(detail);

        if (res.status === 404) {
          console.warn(
            `[OpenRouter] Model endpoint not found (404) for "${model}" — often "No endpoints found". Trying next model.`,
          );
          console.warn(`[OpenRouter] 404 response: ${detail}`);
        } else {
          console.error(
            `[OpenRouter] Model "${model}" failed with HTTP ${res.status}:`,
            detail,
          );
        }
        continue;
      }

      const text = extractOpenRouterMessageContent(parsed);
      if (!text?.trim()) {
        lastError = new Error("OpenRouter returned empty content.");
        console.error(`[OCR] OpenRouter model "${model}": empty content`);
        continue;
      }

      const latex = normalizeLatexOutput(text);
      if (!latex) {
        lastError = new Error("Could not extract LaTeX from OpenRouter response.");
        console.error(`[OCR] OpenRouter model "${model}": no LaTeX after normalize`);
        continue;
      }

      return { latex };
    } catch (e) {
      lastError = e;
      console.error(`[OCR] OpenRouter model "${model}" failed:`, e);
    }
  }

  return { lastError };
}

type GeminiChainResult = {
  latex?: string;
  lastError?: unknown;
};

async function tryGeminiModelChain(
  genAI: GoogleGenerativeAI,
  mimeType: string,
  data: string,
  modelChain: string[],
): Promise<GeminiChainResult> {
  let lastError: unknown;
  const modelNotFoundAttempts: string[] = [];

  for (const modelId of modelChain) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: SYSTEM_PROMPT,
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data,
          },
        },
        { text: USER_IMAGE_PROMPT },
      ]);

      const response = result.response;
      const candidates = response.candidates;
      if (!candidates?.length) {
        console.warn("[OCR] No candidates in response.");
        lastError = new Error("No response from the model. Try another image.");
        continue;
      }

      let text: string;
      try {
        text = response.text();
      } catch (textErr) {
        console.error("[OCR] response.text() failed:", textErr);
        lastError =
          textErr instanceof Error
            ? textErr
            : new Error("Could not read model output.");
        if (isGeminiQuotaExceededError(lastError)) {
          console.warn(
            "[OCR] Gemini quota or rate limit hit on response; skipping remaining Gemini models.",
          );
          return { lastError };
        }
        if (geminiErrorRequiresOpenRouterFallback(lastError)) {
          return { lastError };
        }
        continue;
      }

      const latex = normalizeLatexOutput(text);
      if (!latex) {
        lastError = new Error("Could not extract LaTeX from the image.");
        continue;
      }

      return { latex };
    } catch (geminiErr) {
      lastError = geminiErr;
      logGeminiFailure(modelId, geminiErr);

      if (isGeminiQuotaExceededError(geminiErr)) {
        console.warn(
          "[OCR] Gemini quota exceeded (429); skipping remaining Gemini models for faster OpenRouter fallback.",
        );
        return { lastError: geminiErr };
      }

      if (geminiErrorRequiresOpenRouterFallback(geminiErr)) {
        return { lastError: geminiErr };
      }

      if (isLikelyModelNotFound(geminiErr)) {
        modelNotFoundAttempts.push(modelId);
        continue;
      }

      continue;
    }
  }

  if (modelNotFoundAttempts.length === modelChain.length) {
    console.error(
      "[OCR] All models failed with model-not-found style errors. Chain:",
      modelChain,
    );
    lastError = new Error(ALL_MODELS_NOT_FOUND_MESSAGE);
  }

  return { lastError };
}

export async function POST(request: Request) {
  const apiKey = resolveGeminiApiKey();
  const openRouterKey = resolveOpenRouterApiKey();

  if (!apiKey && !openRouterKey) {
    console.warn("[OCR] Abort: no OCR provider configured.");
    return NextResponse.json(
      {
        error:
          "OCR is not configured. Set GOOGLE_GEMINI_API_KEY and/or OPENROUTER_API_KEY in .env.local.",
      },
      { status: 503 },
    );
  }

  let body: { imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    console.warn("[OCR] Invalid JSON body.");
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawInput = body.imageBase64;
  const mimeHint =
    typeof body.mimeType === "string" ? body.mimeType : undefined;

  if (typeof rawInput !== "string" || !rawInput.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid imageBase64 string." },
      { status: 400 },
    );
  }

  const { mimeType, data } = parseImagePayload(rawInput, mimeHint);

  if (!data.length) {
    return NextResponse.json({ error: "Empty image data." }, { status: 400 });
  }

  const modelChain = buildModelChain();

  let geminiLastError: unknown | undefined;

  try {
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiResult = await tryGeminiModelChain(
        genAI,
        mimeType,
        data,
        modelChain,
      );

      if (geminiResult.latex) {
        return NextResponse.json({ latex: geminiResult.latex });
      }

      geminiLastError = geminiResult.lastError;

      if (openRouterKey) {
        const orResult = await tryOpenRouterVision(openRouterKey, mimeType, data);
        if (orResult.latex) {
          return NextResponse.json({ latex: orResult.latex });
        }
        return NextResponse.json(
          {
            error: formatCombinedFailure(geminiLastError, orResult.lastError),
          },
          { status: 502 },
        );
      }

      return NextResponse.json(
        { error: formatGeminiError(geminiLastError) },
        { status: 502 },
      );
    }

    // Gemini not configured — OpenRouter only
    if (openRouterKey) {
      const orResult = await tryOpenRouterVision(openRouterKey, mimeType, data);
      if (orResult.latex) {
        return NextResponse.json({ latex: orResult.latex });
      }
      return NextResponse.json(
        { error: formatOpenRouterError(orResult.lastError) },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "OCR is not configured." },
      { status: 503 },
    );
  } catch (error) {
    console.error("[OCR] Unexpected route error:", error);
    if (error instanceof Error && error.stack) {
      console.error("[OCR] Unexpected stack:\n", error.stack);
    }
    return NextResponse.json(
      { error: formatGeminiError(error) },
      { status: 500 },
    );
  }
}

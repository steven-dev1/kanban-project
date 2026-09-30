/**
 * Proveedor de IA — SOLO servidor.
 * Soporta dos backends intercambiables:
 *  - "opencode": OpenCode Zen/Go (endpoint compatible con OpenAI).
 *  - "gemini":   Google Gemini (free tier).
 * La API key nunca llega al cliente.
 */

const GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_DEFAULT_FALLBACK = "gemini-3.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const OPENCODE_DEFAULT_BASE = "https://opencode.ai/zen/go/v1";
const OPENCODE_DEFAULT_MODEL = "deepseek-v4-flash";
const OPENCODE_FALLBACK_MODEL = "deepseek-v4.1-flash";

export type AiResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; status?: string };
}

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tiempo máximo por llamada al proveedor. Evita que la función serverless se
// quede colgada y supere el límite de Vercel (FUNCTION_INVOCATION_TIMEOUT).
const REQUEST_TIMEOUT_MS = 25000;

/** fetch con aborto por timeout. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function friendlyError(status: number, message: string): string {
  if (status === 429) {
    return "Se alcanzó el límite de uso de la IA por ahora. Inténtalo de nuevo en unos minutos.";
  }
  if (status === 503 || status === 500) {
    return "El modelo de IA está saturado en este momento. Espera unos segundos y reintenta.";
  }
  if (status === 401 || status === 403) {
    return "La clave de IA no es válida o no tiene permisos.";
  }
  if (status >= 500) {
    return "El servicio de IA no está disponible en este momento. Inténtalo más tarde.";
  }
  return message || "No se pudo obtener respuesta de la IA.";
}

export function aiProviderName(): "opencode" | "gemini" {
  const configured = (process.env.AI_PROVIDER || "").toLowerCase();
  if (configured === "opencode" || configured === "gemini") {
    return configured as "opencode" | "gemini";
  }
  return process.env.OPENCODE_API_KEY ? "opencode" : "gemini";
}

export function aiConfigured() {
  if (aiProviderName() === "opencode") return !!process.env.OPENCODE_API_KEY;
  return !!process.env.GEMINI_API_KEY;
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function callGemini(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<AiResult> {
  let lastStatus = 0;
  let lastMessage = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as GeminiResponse | null;

      if (!response.ok) {
        lastStatus = response.status;
        lastMessage = data?.error?.message ?? `Error ${response.status}`;
        if (RETRYABLE.has(response.status) && attempt < 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        return {
          ok: false,
          status: response.status,
          error: friendlyError(response.status, lastMessage),
        };
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";

      if (!text) {
        return { ok: false, status: 502, error: "La IA devolvió una respuesta vacía." };
      }
      return { ok: true, text };
    } catch (error) {
      lastStatus = 502;
      lastMessage = error instanceof Error ? error.message : "error de red";
      if (attempt < 1) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  return {
    ok: false,
    status: lastStatus || 502,
    error: friendlyError(lastStatus || 502, lastMessage),
  };
}

async function generateGemini(options: GenerateOptions): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "Falta configurar GEMINI_API_KEY en .env.local para usar la IA.",
    };
  }

  const primary = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
    ...(options.json ? { responseMimeType: "application/json" } : {}),
  };
  const baseBody: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: options.prompt }] }],
    generationConfig,
  };
  if (options.system) {
    baseBody.systemInstruction = { parts: [{ text: options.system }] };
  }
  const fastBody: Record<string, unknown> = {
    ...baseBody,
    generationConfig: { ...generationConfig, thinkingConfig: { thinkingBudget: 0 } },
  };

  const fallback = process.env.GEMINI_FALLBACK_MODEL || GEMINI_DEFAULT_FALLBACK;
  const models = [primary];
  if (fallback && fallback !== primary) models.push(fallback);

  let last: AiResult = {
    ok: false,
    status: 502,
    error: "No se pudo obtener respuesta de la IA.",
  };
  for (const model of models) {
    let result = await callGemini(model, apiKey, fastBody);
    if (!result.ok && result.status === 400) {
      result = await callGemini(model, apiKey, baseBody);
    }
    if (result.ok) return result;
    last = result;
    if (!RETRYABLE.has(result.status)) return result;
  }
  return last;
}

// ---------------------------------------------------------------------------
// OpenCode (Zen / Go) — endpoint compatible con OpenAI
// ---------------------------------------------------------------------------

const OPENCODE_SESSION = `kanban-${Math.random().toString(36).slice(2, 10)}`;

async function callOpenCode(
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<AiResult> {
  let lastStatus = 0;
  let lastMessage = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "kanban-knowledge-hub/1.0",
          "x-opencode-session": OPENCODE_SESSION,
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as OpenAiResponse | null;

      if (!response.ok) {
        lastStatus = response.status;
        lastMessage = data?.error?.message ?? `Error ${response.status}`;
        if (RETRYABLE.has(response.status) && attempt < 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        return {
          ok: false,
          status: response.status,
          error: friendlyError(response.status, lastMessage),
        };
      }

      const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) {
        return { ok: false, status: 502, error: "La IA devolvió una respuesta vacía." };
      }
      return { ok: true, text };
    } catch (error) {
      lastStatus = 502;
      lastMessage = error instanceof Error ? error.message : "error de red";
      if (attempt < 1) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  return {
    ok: false,
    status: lastStatus || 502,
    error: friendlyError(lastStatus || 502, lastMessage),
  };
}

async function generateOpenCode(options: GenerateOptions): Promise<AiResult> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "Falta configurar OPENCODE_API_KEY en .env.local para usar la IA.",
    };
  }

  const baseUrl = (process.env.OPENCODE_BASE_URL || OPENCODE_DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.OPENCODE_MODEL || OPENCODE_DEFAULT_MODEL;

  const buildBody = (withJson: boolean): Record<string, unknown> => ({
    model,
    messages: [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: options.prompt },
    ],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxOutputTokens ?? 4096,
    ...(withJson && options.json ? { response_format: { type: "json_object" } } : {}),
  });

  let result = await callOpenCode(baseUrl, apiKey, buildBody(true));
  // Algunos gateways no soportan response_format; reintenta sin él.
  if (!result.ok && result.status === 400 && options.json) {
    result = await callOpenCode(baseUrl, apiKey, buildBody(false));
  }

  if (!result.ok && RETRYABLE.has(result.status)) {
    const fallbackModel = process.env.OPENCODE_FALLBACK_MODEL || OPENCODE_FALLBACK_MODEL;
    if (fallbackModel !== model) {
      result = await callOpenCode(
        baseUrl,
        apiKey,
        { ...buildBody(true), model: fallbackModel },
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Envía un prompt al proveedor configurado (OpenCode o Gemini). */
export async function aiGenerate(options: GenerateOptions): Promise<AiResult> {
  return aiProviderName() === "opencode"
    ? generateOpenCode(options)
    : generateGemini(options);
}

/** Extrae JSON de una respuesta (tolera bloques ```json). */
export function parseJsonResponse<T>(text: string): T | null {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

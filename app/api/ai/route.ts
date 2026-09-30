import { buildPrompt, type AiIntent, type AiPayload } from "@/lib/ai/prompts";
import { aiConfigured, aiGenerate, parseJsonResponse } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// La IA puede tardar; permite hasta 60s en Vercel (Hobby) para no cortar la respuesta.
export const maxDuration = 60;

const INTENTS: AiIntent[] = [
  "explain",
  "document",
  "summarize",
  "diagnose",
  "diff-explain",
  "extract-cases",
];

const MAX_CODE = 40000;
const MAX_TEXT = 30000;

function stripCodeFences(value: string) {
  return value
    .replace(/^\s*```[a-zA-Z]*\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "La IA no está configurada en el servidor (falta GEMINI_API_KEY)." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    intent?: AiIntent;
    payload?: AiPayload;
  } | null;

  const intent = body?.intent;
  const payload = body?.payload ?? {};

  if (!intent || !INTENTS.includes(intent)) {
    return NextResponse.json({ error: "Acción de IA no válida" }, { status: 400 });
  }

  const tooLong =
    (payload.code?.length ?? 0) > MAX_CODE ||
    (payload.previous?.length ?? 0) > MAX_CODE ||
    (payload.current?.length ?? 0) > MAX_CODE;
  if (tooLong) {
    return NextResponse.json(
      { error: "El código es demasiado largo para analizarlo (máx. 40.000 caracteres)." },
      { status: 413 },
    );
  }
  if ((payload.text?.length ?? 0) > MAX_TEXT) {
    return NextResponse.json(
      { error: "El texto es demasiado largo (máx. 30.000 caracteres)." },
      { status: 413 },
    );
  }

  const built = buildPrompt(intent, payload);
  const result = await aiGenerate({
    system: built.system,
    prompt: built.prompt,
    json: built.json,
    temperature: built.temperature,
    maxOutputTokens: built.maxOutputTokens,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status >= 500 ? 502 : result.status },
    );
  }

  if (intent === "document") {
    const parsed = parseJsonResponse<{
      description?: string;
      functional_description?: string;
    }>(result.text);
    if (!parsed) {
      // Si el modelo no devolvió JSON válido, usamos el texto como descripción.
      return NextResponse.json({
        ok: true,
        description: result.text,
        functional_description: "",
      });
    }
    return NextResponse.json({
      ok: true,
      description: parsed.description ?? "",
      functional_description: parsed.functional_description ?? "",
    });
  }

  if (intent === "extract-cases") {
    const parsed = parseJsonResponse<{ cases?: unknown[] }>(result.text);
    if (!parsed || !Array.isArray(parsed.cases)) {
      return NextResponse.json(
        { error: "La IA no pudo interpretar el texto como casos." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, cases: parsed.cases });
  }

  const text = intent === "diagnose" ? stripCodeFences(result.text) : result.text;
  return NextResponse.json({ ok: true, text });
}

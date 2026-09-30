export type AiIntent =
  | "explain"
  | "document"
  | "summarize"
  | "diagnose"
  | "diff-explain"
  | "extract-cases";

export interface AiColumnContext {
  name: string;
  dataType?: string | null;
  description?: string | null;
}

export interface AiPayload {
  code?: string;
  language?: string;
  objectName?: string;
  schema?: string;
  objectType?: string;
  description?: string;
  columns?: AiColumnContext[];
  previous?: string;
  current?: string;
  problem?: string;
  text?: string;
  members?: { name: string; email: string }[];
  lists?: string[];
}

export interface BuiltPrompt {
  system: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

const SYSTEM =
  "Eres un asistente experto en Oracle, SQL y PL/SQL para un equipo interno de desarrollo. " +
  "Responde SIEMPRE en español, de forma clara, técnica y concisa. " +
  "No inventes información: si faltan datos, indícalo explícitamente.";

export function buildPrompt(intent: AiIntent, payload: AiPayload): BuiltPrompt {
  switch (intent) {
    case "explain":
      return {
        system: SYSTEM,
        prompt: [
          "Explica el siguiente código para un desarrollador del equipo.",
          "Incluye: propósito, lógica principal paso a paso, tablas/objetos que usa, parámetros relevantes y posibles riesgos o mejoras.",
          "Usa viñetas y evita repetir el código completo.",
          payload.objectName
            ? `Objeto: ${payload.schema ? `${payload.schema}.` : ""}${payload.objectName} (${payload.objectType ?? "PL/SQL"})`
            : "",
          "```",
          payload.code ?? "",
          "```",
        ]
          .filter(Boolean)
          .join("\n"),
        maxOutputTokens: 2048,
      };

    case "document": {
      const columns = (payload.columns ?? [])
        .map(
          (column) =>
            `- ${column.name}${column.dataType ? ` (${column.dataType})` : ""}${
              column.description ? `: ${column.description}` : ""
            }`,
        )
        .join("\n");
      return {
        system: SYSTEM,
        prompt: [
          "Genera documentación técnica para el siguiente objeto de base de datos.",
          "Devuelve EXACTAMENTE un JSON con esta forma:",
          '{"description": "descripción técnica breve", "functional_description": "para qué sirve funcionalmente y cómo se usa"}',
          "Sé preciso y no repitas el nombre como única descripción.",
          `Objeto: ${payload.schema ? `${payload.schema}.` : ""}${payload.objectName ?? ""} (${payload.objectType ?? ""})`,
          payload.description ? `Descripción actual: ${payload.description}` : "",
          columns ? `Columnas:\n${columns}` : "",
          payload.code ? `Código:\n\`\`\`\n${payload.code}\n\`\`\`` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        json: true,
        maxOutputTokens: 2048,
      };
    }

    case "summarize":
      return {
        system: SYSTEM,
        prompt: [
          "Resume el siguiente paquete/procedimiento/función de Oracle.",
          "Incluye: resumen general, rutinas o parámetros principales, objetos de los que depende y observaciones.",
          "Usa viñetas.",
          payload.objectName ? `Objeto: ${payload.objectName}` : "",
          "```",
          payload.code ?? "",
          "```",
        ]
          .filter(Boolean)
          .join("\n"),
        maxOutputTokens: 2560,
      };

    case "diagnose":
      return {
        system: SYSTEM,
        prompt: [
          "Genera una consulta SQL de Oracle para diagnosticar/investigar el siguiente problema.",
          "Devuelve ÚNICAMENTE el SQL, sin explicaciones ni bloques de código Markdown.",
          "Usa nombres de vistas/tablas genéricos indicados si se dan; si no, usa nombres descriptivos y añade comentarios SQL con --.",
          payload.schema ? `Schema sugerido: ${payload.schema}` : "",
          payload.objectName ? `Objeto relacionado: ${payload.objectName}` : "",
          `Problema: ${payload.problem ?? "(sin descripción)"}`,
          payload.code ? `Contexto (consulta o código previo):\n${payload.code}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        temperature: 0.3,
        maxOutputTokens: 2048,
      };

    case "diff-explain":
      return {
        system: SYSTEM,
        prompt: [
          "Explica las diferencias entre estas dos versiones de código PL/SQL.",
          "Indica qué cambió funcionalmente, si hay riesgos o posibles regresiones, y si el cambio parece seguro.",
          "VERSIÓN ANTERIOR:",
          "```",
          payload.previous ?? "",
          "```",
          "VERSIÓN NUEVA:",
          "```",
          payload.current ?? "",
          "```",
        ].join("\n"),
        maxOutputTokens: 2048,
      };

    case "extract-cases": {
      const members = (payload.members ?? [])
        .map((member) => `- ${member.name} <${member.email}>`)
        .join("\n");
      const lists = (payload.lists ?? []).map((list) => `- ${list}`).join("\n");
      return {
        system:
          "Eres un asistente que convierte correos o mensajes con casos/incidencias en tarjetas de un tablero Kanban. " +
          "Responde SIEMPRE en español y en JSON válido. No inventes datos ni casos que no estén en el texto.",
        prompt: [
          "Analiza el siguiente texto (correos, mensajes o listados) y detecta TODOS los casos/incidencias/solicitudes.",
          "Para cada caso devuelve un objeto con:",
          '- "title": título corto y claro (máx. 80 caracteres)',
          '- "description": detalle útil del caso (puede incluir el texto original relevante)',
          '- "assignee_email": correo del responsable si se identifica claramente, si no null',
          '- "assignee_name": nombre del responsable si se identifica claramente, si no null',
          '- "priority": "alta" | "media" | "baja" | null',
          '- "due_date": fecha límite en formato YYYY-MM-DD si se menciona, si no null',
          '- "list": nombre de la columna/lista sugerida de la lista permitida, si no null',
          '- "confidence": número entre 0 y 1 con tu confianza',
          'Devuelve EXACTAMENTE: {"cases": [ ... ]}',
          members ? `Miembros del tablero (usa sus correos exactos cuando el responsable coincida):\n${members}` : "",
          lists ? `Listas permitidas (usa una exactamente o null):\n${lists}` : "",
          "TEXTO:",
          payload.text ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
        json: true,
        temperature: 0.1,
        maxOutputTokens: 4096,
      };
    }
  }
}

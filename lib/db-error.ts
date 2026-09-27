import type { OracleObjectType } from "@/lib/types";

interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Error de base de datos con mensaje legible para el usuario final.
 * Conserva el código de Postgres/Supabase para poder inspeccionarlo.
 */
export class DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  constraint?: string;

  constructor(message: string, init?: Partial<Pick<DatabaseError, "code" | "details" | "hint" | "constraint">>) {
    super(message);
    this.name = "DatabaseError";
    this.code = init?.code;
    this.details = init?.details;
    this.hint = init?.hint;
    this.constraint = init?.constraint;
  }
}

const OBJECT_PARTITIVE: Record<OracleObjectType, string> = {
  TABLE: "una tabla",
  VIEW: "una vista",
  PROCEDURE: "un procedimiento",
  FUNCTION: "una función",
  PACKAGE: "un paquete",
  TRIGGER: "un trigger",
  SEQUENCE: "una secuencia",
  SYNONYM: "un sinónimo",
  MATERIALIZED_VIEW: "una vista materializada",
};

/** Mensajes para las restricciones de unicidad conocidas del esquema. */
const UNIQUE_CONSTRAINTS: Record<string, string> = {
  oracle_objects_user_unique:
    "Ya existe un objeto con ese schema, nombre y tipo. Valida el schema, el nombre y el tipo del objeto.",
  knowledge_tags_user_unique: "Ya existe una etiqueta con ese nombre.",
  oracle_columns_object_id_column_name_key:
    "Ya existe una columna con ese nombre en este objeto.",
  oracle_column_values_column_id_value_key: "Ese valor ya existe para esa columna.",
  oracle_object_environments_object_id_environment_key:
    "Ese ambiente ya está asociado a este objeto.",
  oracle_code_versions_object_id_source_type_environment_version_number_key:
    "Ya existe esa versión de código para este objeto y ambiente.",
  object_relations_source_object_id_target_object_id_relation_type_key:
    "Esa relación ya existe entre los objetos.",
  knowledge_user_favorites_user_id_item_type_item_id_key:
    "Ese elemento ya está marcado como favorito.",
  card_knowledge_links_card_id_item_type_item_id_key:
    "Ese elemento ya está vinculado a la tarjeta.",
  board_members_board_id_user_id_key: "Ese usuario ya es miembro del tablero.",
};

export interface DbErrorOptions {
  /** Mensaje a usar cuando es una violación de unicidad (tiene prioridad). */
  duplicate?: string;
  /** Mensaje si el error no se puede interpretar. */
  fallback?: string;
}

function extractConstraint(message: string): string | undefined {
  const match = message.match(/constraint "([^"]+)"/i);
  return match?.[1];
}

function extractColumn(message: string): string | undefined {
  const match = message.match(/column "([^"]+)"/i);
  return match?.[1];
}

function isUniqueViolation(error: DbErrorLike, message: string) {
  return error.code === "23505" || /duplicate key value violates unique constraint/i.test(message);
}

/** Convierte un error crudo (Supabase/Postgres) en un DatabaseError legible. */
export function toDatabaseError(error: unknown, options: DbErrorOptions = {}): DatabaseError {
  const fallback = options.fallback ?? "No se pudo completar la operación.";
  if (!error) return new DatabaseError(fallback);

  const err: DbErrorLike = typeof error === "object" ? (error as DbErrorLike) : {};
  const message =
    typeof err.message === "string" && err.message.length > 0 ? err.message : String(error);
  const constraint = extractConstraint(message);
  const init = { code: err.code, details: err.details, hint: err.hint, constraint };

  if (isUniqueViolation(err, message)) {
    const friendly =
      options.duplicate ??
      (constraint ? UNIQUE_CONSTRAINTS[constraint] : undefined) ??
      (constraint?.includes("oracle_objects")
        ? "Ya existe un objeto con ese nombre. Valida el schema, el nombre y el tipo."
        : undefined) ??
      "Ya existe un registro con esos mismos datos.";
    return new DatabaseError(friendly, init);
  }

  if (err.code === "23503" || /violates foreign key constraint/i.test(message)) {
    return new DatabaseError(
      "No se puede completar porque falta un registro relacionado (o fue eliminado).",
      init,
    );
  }
  if (err.code === "23502" || /null value in column/i.test(message)) {
    const column = extractColumn(message);
    return new DatabaseError(`Falta un campo obligatorio${column ? ` (${column})` : ""}.`, init);
  }
  if (err.code === "23514" || /violates check constraint/i.test(message)) {
    return new DatabaseError("Uno de los valores no cumple las reglas permitidas.", init);
  }
  if (
    err.code === "42501" ||
    /permission denied/i.test(message) ||
    /row-level security/i.test(message)
  ) {
    return new DatabaseError("No tienes permisos para realizar esta acción.", init);
  }
  if (err.code === "42P01" || /relation .* does not exist/i.test(message)) {
    return new DatabaseError("La tabla o recurso indicado no existe.", init);
  }
  if (err.code === "42703" || /column .* does not exist/i.test(message)) {
    return new DatabaseError(
      "La base de datos no tiene una columna esperada. Aplica las migraciones pendientes.",
      init,
    );
  }
  if (err.code === "PGRST116" || /no rows returned|multiple .* returned/i.test(message)) {
    return new DatabaseError("No se encontró el registro solicitado.", init);
  }
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return new DatabaseError("No se pudo conectar con el servidor. Revisa tu conexión.", init);
  }

  return new DatabaseError(message || fallback, init);
}

/** ¿El error es una violación de unicidad (registro duplicado)? */
export function isDuplicateError(error: unknown): boolean {
  if (error instanceof DatabaseError) return error.code === "23505";
  const err: DbErrorLike = typeof error === "object" && error ? (error as DbErrorLike) : {};
  return isUniqueViolation(err, err.message ?? "");
}

/** Mensaje legible para un objeto duplicado según su tipo. */
export function duplicateObjectMessage(type: OracleObjectType, name?: string) {
  const partitive = OBJECT_PARTITIVE[type] ?? "un objeto";
  const suffix = name ? ` (${name})` : "";
  return `Ya existe ${partitive} con ese nombre${suffix}. Valida el schema, el nombre y el tipo.`;
}

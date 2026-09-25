import type { Profile } from "@/lib/types";
import type {
  DocSource,
  Environment,
  EnvStatus,
  KnowledgeRole,
  OracleObject,
  OracleObjectType,
  RelationType,
  SourceType,
} from "@/lib/knowledge/types";

export const OBJECT_TYPES: { value: OracleObjectType; label: string }[] = [
  { value: "TABLE", label: "Tabla" },
  { value: "VIEW", label: "Vista" },
  { value: "PROCEDURE", label: "Procedure" },
  { value: "FUNCTION", label: "Function" },
  { value: "PACKAGE", label: "Package" },
  { value: "TRIGGER", label: "Trigger" },
  { value: "SEQUENCE", label: "Sequence" },
  { value: "SYNONYM", label: "Synonym" },
  { value: "MATERIALIZED_VIEW", label: "Vista materializada" },
];

export const ENVIRONMENTS: { value: Environment; label: string; color: string }[] = [
  { value: "DEV", label: "DEV", color: "#3b82f6" },
  { value: "QA", label: "QA", color: "#f59e0b" },
  { value: "PRODUCTIVO", label: "PRODUCTIVO", color: "#22c55e" },
];

export const ENV_STATUSES: { value: EnvStatus; label: string }[] = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "UNKNOWN", label: "Desconocido" },
];

export const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "SOURCE", label: "Source" },
  { value: "SPECIFICATION", label: "Specification" },
  { value: "BODY", label: "Body" },
];

export const RELATION_TYPES: { value: RelationType; label: string }[] = [
  { value: "DEPENDS_ON", label: "Depende de" },
  { value: "USES", label: "Usa" },
  { value: "CALLS", label: "Llama a" },
  { value: "REFERENCES", label: "Referencia" },
  { value: "RELATED_TO", label: "Relacionado con" },
];

export const SNIPPET_CATEGORIES = [
  "Consulta",
  "Diagnóstico",
  "Validación",
  "Corrección",
  "Reporte",
  "Mantenimiento",
  "Utilidad",
  "Otro",
] as const;

export const DATABASE_TYPES = [
  "Oracle",
  "PostgreSQL",
  "MySQL",
  "SQL Server",
  "Otro",
] as const;

export const DOC_SOURCES: { value: DocSource; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "ORACLE", label: "Importado de Oracle" },
];

export const KNOWLEDGE_ROLES: { value: KnowledgeRole; label: string }[] = [
  { value: "viewer", label: "Usuario" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Administrador" },
];

export const ARGUMENT_DIRECTIONS = ["IN", "OUT", "IN OUT"] as const;

/** Permisos del módulo: reutiliza el rol guardado en profiles. */
export const canEditKnowledge = (profile: Profile | null) =>
  profile?.knowledge_role === "editor" || profile?.knowledge_role === "admin";

export const canAdminKnowledge = (profile: Profile | null) =>
  profile?.knowledge_role === "admin";

export const objectFullName = (object: Pick<OracleObject, "schema_name" | "object_name">) =>
  `${object.schema_name}.${object.object_name}`;

export const objectHref = (object: Pick<OracleObject, "id">) =>
  `/hub/objects/${object.id}`;

export const objectTypeLabel = (type: OracleObjectType) =>
  OBJECT_TYPES.find((t) => t.value === type)?.label ?? type;

export const environmentColor = (env?: Environment | null) =>
  ENVIRONMENTS.find((e) => e.value === env)?.color ?? "#94a3b8";

import type {
  DatabaseType,
  Environment,
  EnvironmentStatus,
  OracleObjectType,
  RelationType,
  SqlCategory,
} from "@/lib/types";

export const OBJECT_TYPES: OracleObjectType[] = [
  "TABLE",
  "VIEW",
  "PROCEDURE",
  "FUNCTION",
  "PACKAGE",
  "TRIGGER",
  "SEQUENCE",
  "SYNONYM",
  "MATERIALIZED_VIEW",
];

export const OBJECT_TYPE_LABELS: Record<OracleObjectType, string> = {
  TABLE: "Tabla",
  VIEW: "Vista",
  PROCEDURE: "Procedure",
  FUNCTION: "Function",
  PACKAGE: "Package",
  TRIGGER: "Trigger",
  SEQUENCE: "Secuencia",
  SYNONYM: "Sinónimo",
  MATERIALIZED_VIEW: "Vista materializada",
};

export const OBJECT_TYPE_COLORS: Record<OracleObjectType, string> = {
  TABLE: "#3b82f6",
  VIEW: "#14b8a6",
  PROCEDURE: "#8b5cf6",
  FUNCTION: "#f59e0b",
  PACKAGE: "#ec4899",
  TRIGGER: "#ef4444",
  SEQUENCE: "#06b6d4",
  SYNONYM: "#64748b",
  MATERIALIZED_VIEW: "#84cc16",
};

export const ENVIRONMENTS: Environment[] = ["DEV", "QA", "PRODUCTIVO"];

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  DEV: "Desarrollo",
  QA: "Pruebas",
  PRODUCTIVO: "Productivo",
};

export const ENVIRONMENT_SHORT: Record<Environment, string> = {
  DEV: "DEV",
  QA: "QA",
  PRODUCTIVO: "PROD",
};

export const ENVIRONMENT_COLORS: Record<Environment, string> = {
  DEV: "#3b82f6",
  QA: "#f59e0b",
  PRODUCTIVO: "#22c55e",
};

export const ENVIRONMENT_STATUSES: EnvironmentStatus[] = ["ACTIVE", "INACTIVE", "UNKNOWN"];

export const ENVIRONMENT_STATUS_LABELS: Record<EnvironmentStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  UNKNOWN: "Desconocido",
};

export const RELATION_TYPES: RelationType[] = [
  "DEPENDS_ON",
  "USES",
  "RELATED_TO",
  "CALLS",
  "REFERENCES",
];

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  DEPENDS_ON: "Depende de",
  USES: "Usa",
  RELATED_TO: "Relacionado con",
  CALLS: "Llama a",
  REFERENCES: "Referencia a",
};

export const SQL_CATEGORIES: SqlCategory[] = [
  "Consulta",
  "Diagnóstico",
  "Validación",
  "Corrección",
  "Reporte",
  "Mantenimiento",
  "Utilidad",
  "Otro",
];

export const DATABASE_TYPES: DatabaseType[] = [
  "Oracle",
  "PostgreSQL",
  "MySQL",
  "SQL Server",
  "Otro",
];

export const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#64748b",
];

export const DEFAULT_OBJECT_TYPE: OracleObjectType = "TABLE";
export const DEFAULT_ENVIRONMENT: Environment = "DEV";

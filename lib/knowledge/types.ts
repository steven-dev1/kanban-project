import type { KnowledgeRole, Profile } from "@/lib/types";

export type { KnowledgeRole };

export type OracleObjectType =
  | "TABLE"
  | "VIEW"
  | "PROCEDURE"
  | "FUNCTION"
  | "PACKAGE"
  | "TRIGGER"
  | "SEQUENCE"
  | "SYNONYM"
  | "MATERIALIZED_VIEW";

export type Environment = "DEV" | "QA" | "PRODUCTIVO";
export type EnvStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";
export type SourceType = "SOURCE" | "SPECIFICATION" | "BODY";
export type DocSource = "MANUAL" | "ORACLE";
export type RelationType =
  | "DEPENDS_ON"
  | "USES"
  | "RELATED_TO"
  | "CALLS"
  | "REFERENCES";
export type KnowledgeItemType = "OBJECT" | "COLUMN" | "SNIPPET";

export interface KnowledgeTag {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export interface OracleObject {
  id: string;
  schema_name: string;
  object_name: string;
  object_type: OracleObjectType;
  description: string | null;
  functional_description: string | null;
  module: string | null;
  owner: string | null;
  notes: string | null;
  source: DocSource;
  is_favorite: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectEnvironment {
  id: string;
  object_id: string;
  environment: Environment;
  version: string | null;
  status: EnvStatus;
  notes: string | null;
  last_verified_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OracleColumn {
  id: string;
  object_id: string;
  column_name: string;
  data_type: string | null;
  data_length: number | null;
  data_precision: number | null;
  data_scale: number | null;
  nullable: boolean;
  column_order: number | null;
  description: string | null;
  business_meaning: string | null;
  notes: string | null;
  source: DocSource;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OracleColumnValue {
  id: string;
  column_id: string;
  value: string;
  meaning: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodeVersion {
  id: string;
  object_id: string;
  version_number: number;
  source_type: SourceType;
  source_code: string;
  environment: Environment | null;
  change_description: string | null;
  created_by: string | null;
  created_at: string;
  profile?: Profile | null;
}

export interface OracleArgument {
  id: string;
  object_id: string;
  argument_name: string;
  position: number | null;
  data_type: string | null;
  in_out: "IN" | "OUT" | "IN OUT" | null;
  description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SqlSnippet {
  id: string;
  title: string;
  description: string | null;
  sql_code: string;
  category: string;
  database_type: string;
  schema_name: string | null;
  environment: Environment | null;
  notes: string | null;
  warnings: string | null;
  is_favorite: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnippetParameter {
  id: string;
  snippet_id: string;
  parameter_name: string;
  data_type: string | null;
  description: string | null;
  example_value: string | null;
  required: boolean;
  position: number | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectRelation {
  id: string;
  source_object_id: string;
  target_object_id: string;
  relation_type: RelationType;
  description: string | null;
  created_by: string | null;
  created_at: string;
  target?: OracleObject | null;
  source?: OracleObject | null;
}

export interface CardKnowledgeLink {
  id: string;
  card_id: string;
  item_type: KnowledgeItemType;
  item_id: string;
  environment: Environment | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  card?: { id: string; title: string; board_id: string } | null;
}

export interface RecentView {
  id: string;
  item_type: KnowledgeItemType;
  item_id: string;
  viewed_at: string;
}

export interface KnowledgeStats {
  tables_count: number;
  views_count: number;
  columns_count: number;
  snippets_count: number;
  procedures_count: number;
  functions_count: number;
  packages_count: number;
}

/** Resultado normalizado de la búsqueda global. */
export interface SearchResult {
  kind: OracleObjectType | "COLUMN" | "VALUE" | "SQL";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  matchField?: string;
  score: number;
}

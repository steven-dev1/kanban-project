export type Role = "admin" | "member";

/** Rol del usuario dentro del Oracle Knowledge Hub. */
export type KnowledgeRole = "viewer" | "editor" | "admin";

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
export type SourceType = "SOURCE" | "SPECIFICATION" | "BODY";
export type ObjectSource = "MANUAL" | "ORACLE";
export type RelationType = "DEPENDS_ON" | "USES" | "RELATED_TO" | "CALLS" | "REFERENCES";
export type SqlCategory = "Consulta" | "Diagnóstico" | "Validación" | "Corrección" | "Reporte" | "Mantenimiento" | "Utilidad" | "Otro";
export type DatabaseType = "Oracle" | "PostgreSQL" | "MySQL" | "SQL Server" | "Otro";
export type EnvironmentStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";
export type KnowledgeItemType = "OBJECT" | "COLUMN" | "SNIPPET";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  knowledge_role: KnowledgeRole;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface BoardInvitation {
  id: string;
  board_id: string;
  email: string;
  role: Role;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

export interface BoardList {
  id: string;
  board_id: string;
  title: string;
  color: string | null;
  position: number;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  board_id: string | null;
  type: "board_invite" | "board_added" | string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface CardAssignee {
  user_id: string;
  profile: Profile | null;
}

export interface Attachment {
  id: string;
  card_id: string;
  board_id: string;
  name: string;
  path: string;
  size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CardWithLabels extends Card {
  card_labels: { label_id: string; labels: Label }[];
  card_assignees: CardAssignee[];
  attachments: Attachment[];
}

// ============================================================================
// Oracle Knowledge Hub Types
// ============================================================================

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
  source: ObjectSource;
  is_favorite: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OracleObjectEnvironment {
  id: string;
  object_id: string;
  environment: Environment;
  version: string | null;
  status: EnvironmentStatus;
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
  source: ObjectSource;
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

export interface OracleCodeVersion {
  id: string;
  object_id: string;
  version_number: number;
  source_type: SourceType;
  source_code: string;
  environment: Environment | null;
  change_description: string | null;
  created_by: string | null;
  created_at: string;
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
  created_at: string;
}

export interface SqlSnippet {
  id: string;
  title: string;
  description: string | null;
  sql_code: string;
  category: SqlCategory;
  database_type: DatabaseType;
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

export interface SqlSnippetParameter {
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

export interface SqlSnippetObject {
  snippet_id: string;
  object_id: string;
}

export interface ObjectRelation {
  id: string;
  source_object_id: string;
  target_object_id: string;
  relation_type: RelationType;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface KnowledgeTag {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export interface OracleObjectTag {
  object_id: string;
  tag_id: string;
}

export interface SqlSnippetTag {
  snippet_id: string;
  tag_id: string;
}

export interface KnowledgeFavorite {
  user_id: string;
  item_type: KnowledgeItemType;
  item_id: string;
  created_at: string;
}

export interface KnowledgeRecentView {
  id: string;
  user_id: string;
  item_type: KnowledgeItemType;
  item_id: string;
  viewed_at: string;
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
}

// Extended types with relations
export interface OracleObjectWithRelations extends OracleObject {
  environments: OracleObjectEnvironment[];
  columns: OracleColumnWithValues[];
  code_versions: OracleCodeVersion[];
  arguments: OracleArgument[];
  tags: KnowledgeTag[];
  relations_as_source: (ObjectRelation & { target_object: OracleObject })[];
  relations_as_target: (ObjectRelation & { source_object: OracleObject })[];
  snippet_count: number;
}

export interface OracleColumnWithValues extends OracleColumn {
  values: OracleColumnValue[];
}

export interface SqlSnippetWithRelations extends SqlSnippet {
  parameters: SqlSnippetParameter[];
  objects: OracleObject[];
  tags: KnowledgeTag[];
}

export interface KnowledgeStats {
  total_tables: number;
  total_views: number;
  total_columns: number;
  total_sql_snippets: number;
  total_procedures: number;
  total_functions: number;
  total_packages: number;
}

export interface SearchResult {
  id: string;
  type: "TABLE" | "VIEW" | "COLUMN" | "VALUE" | "SQL" | "PROCEDURE" | "FUNCTION" | "PACKAGE" | "TRIGGER";
  name: string;
  schema_name?: string;
  description?: string;
  object_id?: string;
  snippet_id?: string;
  column_id?: string;
}

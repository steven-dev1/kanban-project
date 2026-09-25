-- ============================================================================
-- ORACLE KNOWLEDGE HUB — Diccionario de datos y repositorio técnico
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de supabase/schema.sql
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- RBAC del módulo (reutiliza profiles, no crea un sistema de auth paralelo)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists knowledge_role text not null default 'admin';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_knowledge_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_knowledge_role_check
      check (knowledge_role in ('viewer','editor','admin'));
  end if;
end $$;

create or replace function public.knowledge_role_of(p_user uuid)
returns text language sql security definer set search_path = public stable as $$
  select coalesce((select knowledge_role from public.profiles where id = p_user), 'admin');
$$;

create or replace function public.is_knowledge_editor(p_user uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.knowledge_role_of(p_user) in ('editor','admin');
$$;

create or replace function public.is_knowledge_admin(p_user uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.knowledge_role_of(p_user) = 'admin';
$$;

-- Evita que un usuario se auto-escale el rol (profiles_update permite editarse a sí mismo)
create or replace function public.protect_knowledge_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.knowledge_role is distinct from old.knowledge_role
     and not public.is_knowledge_admin(auth.uid()) then
    new.knowledge_role := old.knowledge_role;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_knowledge_role on public.profiles;
create trigger trg_protect_knowledge_role before update on public.profiles
  for each row execute function public.protect_knowledge_role();

-- ---------------------------------------------------------------------------
-- Tablas del módulo
-- ---------------------------------------------------------------------------

create table if not exists public.oracle_objects (
  id uuid primary key default gen_random_uuid(),
  schema_name text not null,
  object_name text not null,
  object_type text not null check (object_type in
    ('TABLE','VIEW','PROCEDURE','FUNCTION','PACKAGE','TRIGGER','SEQUENCE','SYNONYM','MATERIALIZED_VIEW')),
  description text,
  functional_description text,
  module text,
  owner uuid references public.profiles(id) on delete set null,
  notes text,
  source text not null default 'MANUAL' check (source in ('MANUAL','ORACLE')),
  is_favorite boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schema_name, object_name, object_type)
);

create table if not exists public.oracle_object_environments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.oracle_objects(id) on delete cascade,
  environment text not null check (environment in ('DEV','QA','PRODUCTIVO')),
  version text,
  status text not null default 'UNKNOWN' check (status in ('ACTIVE','INACTIVE','UNKNOWN')),
  notes text,
  last_verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id, environment)
);

create table if not exists public.oracle_columns (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.oracle_objects(id) on delete cascade,
  column_name text not null,
  data_type text,
  data_length integer,
  data_precision integer,
  data_scale integer,
  nullable boolean not null default true,
  column_order integer,
  description text,
  business_meaning text,
  notes text,
  source text not null default 'MANUAL' check (source in ('MANUAL','ORACLE')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id, column_name)
);

create table if not exists public.oracle_column_values (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.oracle_columns(id) on delete cascade,
  value text not null,
  meaning text,
  notes text,
  is_active boolean not null default true,
  sort_order integer,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (column_id, value)
);

create table if not exists public.oracle_code_versions (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.oracle_objects(id) on delete cascade,
  version_number numeric not null,
  source_type text not null check (source_type in ('SOURCE','SPECIFICATION','BODY')),
  source_code text not null,
  environment text check (environment in ('DEV','QA','PRODUCTIVO')),
  change_description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (object_id, source_type, environment, version_number)
);

create table if not exists public.oracle_arguments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.oracle_objects(id) on delete cascade,
  argument_name text not null,
  position integer,
  data_type text,
  in_out text check (in_out in ('IN','OUT','IN OUT')),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sql_snippets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sql_code text not null,
  category text not null default 'Consulta' check (category in
    ('Consulta','Diagnóstico','Validación','Corrección','Reporte','Mantenimiento','Utilidad','Otro')),
  database_type text not null default 'Oracle' check (database_type in
    ('Oracle','PostgreSQL','MySQL','SQL Server','Otro')),
  schema_name text,
  environment text check (environment in ('DEV','QA','PRODUCTIVO')),
  notes text,
  warnings text,
  is_favorite boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sql_snippet_parameters (
  id uuid primary key default gen_random_uuid(),
  snippet_id uuid not null references public.sql_snippets(id) on delete cascade,
  parameter_name text not null,
  data_type text,
  description text,
  example_value text,
  required boolean not null default false,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sql_snippet_objects (
  snippet_id uuid not null references public.sql_snippets(id) on delete cascade,
  object_id uuid not null references public.oracle_objects(id) on delete cascade,
  primary key (snippet_id, object_id)
);

create table if not exists public.object_relations (
  id uuid primary key default gen_random_uuid(),
  source_object_id uuid not null references public.oracle_objects(id) on delete cascade,
  target_object_id uuid not null references public.oracle_objects(id) on delete cascade,
  relation_type text not null check (relation_type in
    ('DEPENDS_ON','USES','RELATED_TO','CALLS','REFERENCES')),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_object_id, target_object_id, relation_type),
  check (source_object_id <> target_object_id)
);

create table if not exists public.knowledge_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6366f1',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_object_tags (
  object_id uuid not null references public.oracle_objects(id) on delete cascade,
  tag_id uuid not null references public.knowledge_tags(id) on delete cascade,
  primary key (object_id, tag_id)
);

create table if not exists public.knowledge_snippet_tags (
  snippet_id uuid not null references public.sql_snippets(id) on delete cascade,
  tag_id uuid not null references public.knowledge_tags(id) on delete cascade,
  primary key (snippet_id, tag_id)
);

-- Favoritos por usuario (permite que un usuario normal marque favoritos)
create table if not exists public.knowledge_user_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('OBJECT','COLUMN','SNIPPET')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

-- Recientes por usuario
create table if not exists public.knowledge_recent_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('OBJECT','COLUMN','SNIPPET')),
  item_id uuid not null,
  viewed_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- Integración con los casos del Kanban
create table if not exists public.card_knowledge_links (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  item_type text not null check (item_type in ('OBJECT','SNIPPET')),
  item_id uuid not null,
  environment text check (environment in ('DEV','QA','PRODUCTIVO')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (card_id, item_type, item_id)
);

-- ---------------------------------------------------------------------------
-- updated_at (reutiliza el trigger existente del proyecto)
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'oracle_objects','oracle_object_environments','oracle_columns',
    'oracle_column_values','oracle_arguments','sql_snippets','sql_snippet_parameters'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Índices (búsqueda rápida con pg_trgm + FKs)
-- ---------------------------------------------------------------------------

create index if not exists idx_objects_name_trgm on public.oracle_objects using gin (object_name gin_trgm_ops);
create index if not exists idx_objects_schema_trgm on public.oracle_objects using gin (schema_name gin_trgm_ops);
create index if not exists idx_objects_desc_trgm on public.oracle_objects using gin (coalesce(description,'') gin_trgm_ops);
create index if not exists idx_objects_func_trgm on public.oracle_objects using gin (coalesce(functional_description,'') gin_trgm_ops);
create index if not exists idx_objects_notes_trgm on public.oracle_objects using gin (coalesce(notes,'') gin_trgm_ops);
create index if not exists idx_objects_type on public.oracle_objects(object_type);
create index if not exists idx_objects_module on public.oracle_objects(module);
create index if not exists idx_objects_updated on public.oracle_objects(updated_at desc);

create index if not exists idx_columns_name_trgm on public.oracle_columns using gin (column_name gin_trgm_ops);
create index if not exists idx_columns_desc_trgm on public.oracle_columns using gin (coalesce(description,'') gin_trgm_ops);
create index if not exists idx_columns_object on public.oracle_columns(object_id);

create index if not exists idx_column_values_column on public.oracle_column_values(column_id);
create index if not exists idx_column_values_value_trgm on public.oracle_column_values using gin (value gin_trgm_ops);
create index if not exists idx_column_values_meaning_trgm on public.oracle_column_values using gin (coalesce(meaning,'') gin_trgm_ops);

create index if not exists idx_code_versions_object on public.oracle_code_versions(object_id, source_type, version_number desc);
create index if not exists idx_code_versions_code_trgm on public.oracle_code_versions using gin (source_code gin_trgm_ops);

create index if not exists idx_arguments_object on public.oracle_arguments(object_id);
create index if not exists idx_obj_env_object on public.oracle_object_environments(object_id);

create index if not exists idx_snippets_title_trgm on public.sql_snippets using gin (title gin_trgm_ops);
create index if not exists idx_snippets_code_trgm on public.sql_snippets using gin (sql_code gin_trgm_ops);
create index if not exists idx_snippets_desc_trgm on public.sql_snippets using gin (coalesce(description,'') gin_trgm_ops);
create index if not exists idx_snippets_category on public.sql_snippets(category);
create index if not exists idx_snippets_updated on public.sql_snippets(updated_at desc);

create index if not exists idx_snippet_params_snippet on public.sql_snippet_parameters(snippet_id);
create index if not exists idx_snippet_objects_object on public.sql_snippet_objects(object_id);
create index if not exists idx_relations_source on public.object_relations(source_object_id);
create index if not exists idx_relations_target on public.object_relations(target_object_id);
create index if not exists idx_object_tags_tag on public.knowledge_object_tags(tag_id);
create index if not exists idx_snippet_tags_tag on public.knowledge_snippet_tags(tag_id);
create index if not exists idx_favorites_user on public.knowledge_user_favorites(user_id);
create index if not exists idx_recent_user on public.knowledge_recent_views(user_id, viewed_at desc);
create index if not exists idx_card_links_card on public.card_knowledge_links(card_id);
create index if not exists idx_card_links_item on public.card_knowledge_links(item_type, item_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Convención del proyecto: select para autenticados, escritura por rol.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'oracle_objects','oracle_object_environments','oracle_columns','oracle_column_values',
    'oracle_code_versions','oracle_arguments','sql_snippets','sql_snippet_parameters',
    'sql_snippet_objects','object_relations','knowledge_tags','knowledge_object_tags',
    'knowledge_snippet_tags'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter table public.knowledge_user_favorites enable row level security;
alter table public.knowledge_recent_views enable row level security;
alter table public.card_knowledge_links enable row level security;

-- Lectura: cualquier usuario autenticado puede consultar el hub
do $$
declare t text;
begin
  foreach t in array array[
    'oracle_objects','oracle_object_environments','oracle_columns','oracle_column_values',
    'oracle_code_versions','oracle_arguments','sql_snippets','sql_snippet_parameters',
    'sql_snippet_objects','object_relations','knowledge_tags','knowledge_object_tags',
    'knowledge_snippet_tags'
  ]
  loop
    execute format('drop policy if exists %s_select on public.%I', t, t);
    execute format(
      'create policy %s_select on public.%I for select to authenticated using (true)', t, t
    );
    execute format('drop policy if exists %s_insert on public.%I', t, t);
    execute format(
      'create policy %s_insert on public.%I for insert to authenticated with check (public.is_knowledge_editor(auth.uid()))', t, t
    );
    execute format('drop policy if exists %s_update on public.%I', t, t);
    execute format(
      'create policy %s_update on public.%I for update to authenticated using (public.is_knowledge_editor(auth.uid())) with check (public.is_knowledge_editor(auth.uid()))', t, t
    );
    execute format('drop policy if exists %s_delete on public.%I', t, t);
    execute format(
      'create policy %s_delete on public.%I for delete to authenticated using (public.is_knowledge_admin(auth.uid()))', t, t
    );
  end loop;
end $$;

-- Las versiones históricas de código NO se borran (trazabilidad)
drop policy if exists oracle_code_versions_delete on public.oracle_code_versions;
create policy oracle_code_versions_delete on public.oracle_code_versions
  for delete to authenticated using (false);

-- Favoritos y recientes: solo los propios
drop policy if exists favorites_own on public.knowledge_user_favorites;
create policy favorites_own on public.knowledge_user_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recent_own on public.knowledge_recent_views;
create policy recent_own on public.knowledge_recent_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vínculos con casos del Kanban: mismos permisos que las cards del tablero
drop policy if exists card_links_select on public.card_knowledge_links;
create policy card_links_select on public.card_knowledge_links for select to authenticated
  using (
    exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id, auth.uid()))
    or public.is_knowledge_editor(auth.uid())
  );
drop policy if exists card_links_insert on public.card_knowledge_links;
create policy card_links_insert on public.card_knowledge_links for insert to authenticated
  with check (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())));
drop policy if exists card_links_delete on public.card_knowledge_links;
create policy card_links_delete on public.card_knowledge_links for delete to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())));

-- Roles del módulo: solo un admin puede cambiarlos (además del trigger de protección)
drop policy if exists profiles_role_update on public.profiles;
create policy profiles_role_update on public.profiles for update to authenticated
  using (public.is_knowledge_admin(auth.uid()))
  with check (public.is_knowledge_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime (colaboración en tiempo real, igual que el resto de la app)
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'oracle_objects','oracle_object_environments','oracle_columns','oracle_column_values',
    'oracle_code_versions','oracle_arguments','sql_snippets','sql_snippet_parameters',
    'sql_snippet_objects','object_relations','knowledge_tags','card_knowledge_links'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Vista auxiliar para el dashboard (estadísticas)
-- ---------------------------------------------------------------------------

create or replace view public.knowledge_stats as
select
  (select count(*) from public.oracle_objects where object_type = 'TABLE')     as tables_count,
  (select count(*) from public.oracle_objects where object_type = 'VIEW')      as views_count,
  (select count(*) from public.oracle_columns)                                 as columns_count,
  (select count(*) from public.sql_snippets)                                   as snippets_count,
  (select count(*) from public.oracle_objects where object_type = 'PROCEDURE') as procedures_count,
  (select count(*) from public.oracle_objects where object_type = 'FUNCTION')  as functions_count,
  (select count(*) from public.oracle_objects where object_type = 'PACKAGE')   as packages_count;

grant select on public.knowledge_stats to authenticated;

-- ---------------------------------------------------------------------------
-- ROLES DEL MÓDULO
-- Por defecto todos los usuarios son 'admin' (acceso completo al hub).
-- Si prefieres que solo editen pero no eliminen, usa 'editor'.
-- Para aplicarlo a una base ya creada:
--
--   alter table public.profiles alter column knowledge_role set default 'admin';
--   update public.profiles set knowledge_role = 'admin';
-- ============================================================================

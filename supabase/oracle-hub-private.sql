-- ============================================================================
-- ORACLE KNOWLEDGE HUB — Modelo PRIVADO POR USUARIO
-- Ejecutar DESPUÉS de supabase/schema.sql y supabase/oracle-hub.sql.
-- Idempotente: se puede ejecutar varias veces.
--
-- Convierte el hub compartido en un hub privado: cada usuario ve y gestiona
-- únicamente sus propios objetos, columnas, SQL, packages, tags y relaciones.
-- Favoritos y recientes ya eran por usuario y se mantienen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Columna de dueño en las tablas raíz
-- ---------------------------------------------------------------------------

alter table public.oracle_objects
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.sql_snippets
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.knowledge_tags
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

-- Backfill: lo existente pasa a su creador (o al primer perfil disponible).
update public.oracle_objects o
  set user_id = coalesce(o.created_by, (select id from public.profiles order by created_at limit 1))
  where o.user_id is null;
update public.sql_snippets s
  set user_id = coalesce(s.created_by, (select id from public.profiles order by created_at limit 1))
  where s.user_id is null;
update public.knowledge_tags t
  set user_id = coalesce(t.created_by, (select id from public.profiles order by created_at limit 1))
  where t.user_id is null;

-- Default para inserciones nuevas + NOT NULL cuando ya no queden huérfanos.
alter table public.oracle_objects alter column user_id set default auth.uid();
alter table public.sql_snippets alter column user_id set default auth.uid();
alter table public.knowledge_tags alter column user_id set default auth.uid();

do $$
begin
  if not exists (select 1 from public.oracle_objects where user_id is null) then
    alter table public.oracle_objects alter column user_id set not null;
  end if;
  if not exists (select 1 from public.sql_snippets where user_id is null) then
    alter table public.sql_snippets alter column user_id set not null;
  end if;
  if not exists (select 1 from public.knowledge_tags where user_id is null) then
    alter table public.knowledge_tags alter column user_id set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Unicidad por usuario (antes era global)
-- ---------------------------------------------------------------------------

alter table public.oracle_objects
  drop constraint if exists oracle_objects_schema_name_object_name_object_type_key;
alter table public.oracle_objects
  drop constraint if exists oracle_objects_user_unique;
alter table public.oracle_objects
  add constraint oracle_objects_user_unique
  unique (user_id, schema_name, object_name, object_type);

alter table public.knowledge_tags
  drop constraint if exists knowledge_tags_name_key;
alter table public.knowledge_tags
  drop constraint if exists knowledge_tags_user_unique;
alter table public.knowledge_tags
  add constraint knowledge_tags_user_unique unique (user_id, name);

-- ---------------------------------------------------------------------------
-- 3) Índices de propiedad
-- ---------------------------------------------------------------------------

create index if not exists idx_oracle_objects_user on public.oracle_objects(user_id);
create index if not exists idx_sql_snippets_user on public.sql_snippets(user_id);
create index if not exists idx_knowledge_tags_user on public.knowledge_tags(user_id);

-- ---------------------------------------------------------------------------
-- 4) Helpers de propiedad (SECURITY DEFINER, filtran explícitamente al dueño)
-- ---------------------------------------------------------------------------

create or replace function public.kb_owns_object(p_object uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.oracle_objects
    where id = p_object and user_id = auth.uid()
  );
$$;

create or replace function public.kb_owns_column(p_column uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.oracle_columns c
    join public.oracle_objects o on o.id = c.object_id
    where c.id = p_column and o.user_id = auth.uid()
  );
$$;

create or replace function public.kb_owns_snippet(p_snippet uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.sql_snippets
    where id = p_snippet and user_id = auth.uid()
  );
$$;

grant execute on function public.kb_owns_object(uuid) to authenticated;
grant execute on function public.kb_owns_column(uuid) to authenticated;
grant execute on function public.kb_owns_snippet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) RLS por dueño
-- ---------------------------------------------------------------------------

-- Aseguramos RLS activo en todas las tablas del hub.
do $$
declare t text;
begin
  foreach t in array array[
    'oracle_objects','oracle_object_environments','oracle_columns','oracle_column_values',
    'oracle_code_versions','oracle_arguments','sql_snippets','sql_snippet_parameters',
    'sql_snippet_objects','object_relations','knowledge_tags','knowledge_object_tags',
    'knowledge_snippet_tags','knowledge_user_favorites','knowledge_recent_views',
    'card_knowledge_links'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Quitamos las políticas anteriores (compartidas / por rol).
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
    execute format('drop policy if exists %s_insert on public.%I', t, t);
    execute format('drop policy if exists %s_update on public.%I', t, t);
    execute format('drop policy if exists %s_delete on public.%I', t, t);
    execute format('drop policy if exists %s_own on public.%I', t, t);
    execute format('drop policy if exists %s_owner on public.%I', t, t);
    execute format('drop policy if exists %s_write on public.%I', t, t);
  end loop;
end $$;

drop policy if exists oracle_code_versions_delete on public.oracle_code_versions;

-- Tablas raíz: el dueño gestiona todo lo suyo.
drop policy if exists oracle_objects_owner on public.oracle_objects;
create policy oracle_objects_owner on public.oracle_objects
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists sql_snippets_owner on public.sql_snippets;
create policy sql_snippets_owner on public.sql_snippets
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists knowledge_tags_owner on public.knowledge_tags;
create policy knowledge_tags_owner on public.knowledge_tags
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tablas hijas: se heredan del objeto/snippet dueño.
drop policy if exists oracle_columns_owner on public.oracle_columns;
create policy oracle_columns_owner on public.oracle_columns
  for all to authenticated
  using (public.kb_owns_object(object_id))
  with check (public.kb_owns_object(object_id));

drop policy if exists oracle_column_values_owner on public.oracle_column_values;
create policy oracle_column_values_owner on public.oracle_column_values
  for all to authenticated
  using (public.kb_owns_column(column_id))
  with check (public.kb_owns_column(column_id));

drop policy if exists oracle_code_versions_owner on public.oracle_code_versions;
create policy oracle_code_versions_owner on public.oracle_code_versions
  for all to authenticated
  using (public.kb_owns_object(object_id))
  with check (public.kb_owns_object(object_id));

drop policy if exists oracle_arguments_owner on public.oracle_arguments;
create policy oracle_arguments_owner on public.oracle_arguments
  for all to authenticated
  using (public.kb_owns_object(object_id))
  with check (public.kb_owns_object(object_id));

drop policy if exists oracle_object_environments_owner on public.oracle_object_environments;
create policy oracle_object_environments_owner on public.oracle_object_environments
  for all to authenticated
  using (public.kb_owns_object(object_id))
  with check (public.kb_owns_object(object_id));

drop policy if exists sql_snippet_parameters_owner on public.sql_snippet_parameters;
create policy sql_snippet_parameters_owner on public.sql_snippet_parameters
  for all to authenticated
  using (public.kb_owns_snippet(snippet_id))
  with check (public.kb_owns_snippet(snippet_id));

drop policy if exists sql_snippet_objects_owner on public.sql_snippet_objects;
create policy sql_snippet_objects_owner on public.sql_snippet_objects
  for all to authenticated
  using (public.kb_owns_snippet(snippet_id) and public.kb_owns_object(object_id))
  with check (public.kb_owns_snippet(snippet_id) and public.kb_owns_object(object_id));

drop policy if exists object_relations_owner on public.object_relations;
create policy object_relations_owner on public.object_relations
  for all to authenticated
  using (public.kb_owns_object(source_object_id) and public.kb_owns_object(target_object_id))
  with check (public.kb_owns_object(source_object_id) and public.kb_owns_object(target_object_id));

drop policy if exists knowledge_object_tags_owner on public.knowledge_object_tags;
create policy knowledge_object_tags_owner on public.knowledge_object_tags
  for all to authenticated
  using (public.kb_owns_object(object_id))
  with check (public.kb_owns_object(object_id));

drop policy if exists knowledge_snippet_tags_owner on public.knowledge_snippet_tags;
create policy knowledge_snippet_tags_owner on public.knowledge_snippet_tags
  for all to authenticated
  using (public.kb_owns_snippet(snippet_id))
  with check (public.kb_owns_snippet(snippet_id));

-- Favoritos y recientes: solo los propios (se mantiene).
drop policy if exists favorites_own on public.knowledge_user_favorites;
create policy favorites_own on public.knowledge_user_favorites
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recent_own on public.knowledge_recent_views;
create policy recent_own on public.knowledge_recent_views
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) La vista de estadísticas respeta RLS del que consulta
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'knowledge_stats') then
    execute 'alter view public.knowledge_stats set (security_invoker = true)';
  end if;
end $$;

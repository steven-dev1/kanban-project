-- ============================================================================
-- ORACLE KNOWLEDGE HUB — CLAVES Y RESTRICCIONES DE COLUMNA
-- Ejecutar DESPUÉS de supabase/oracle-hub.sql, oracle-hub-private.sql y
-- knowledge-sharing.sql. Idempotente: se puede ejecutar varias veces.
--
-- Permite documentar, por columna: si es PRIMARY KEY, si es UNIQUE, su clave
-- foránea (REFERENCES schema.tabla.columna) y una expresión CHECK.
-- ============================================================================

alter table public.oracle_columns
  add column if not exists is_primary_key boolean not null default false;
alter table public.oracle_columns
  add column if not exists is_unique boolean not null default false;
alter table public.oracle_columns
  add column if not exists references_schema text;
alter table public.oracle_columns
  add column if not exists references_table text;
alter table public.oracle_columns
  add column if not exists references_column text;
alter table public.oracle_columns
  add column if not exists check_expression text;

create index if not exists idx_columns_primary_key
  on public.oracle_columns(object_id) where is_primary_key;

-- ---------------------------------------------------------------------------
-- Copia de objetos compartidos: conservar las claves documentadas.
-- (Misma función que knowledge-sharing.sql, extendida con las nuevas columnas.)
-- ---------------------------------------------------------------------------

create or replace function public.accept_shared_item(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_share public.shared_items;
  v_uid uuid := auth.uid();
  v_new_id uuid;
  v_new_name text;
  v_suffix int := 0;
  v_obj public.oracle_objects;
  v_snip public.sql_snippets;
  v_col record;
  v_new_col uuid;
  v_tag record;
  v_new_tag uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_share from public.shared_items where id = p_id;
  if v_share is null then raise exception 'Envío no encontrado'; end if;
  if v_share.recipient_id <> v_uid then raise exception 'No autorizado'; end if;

  if v_share.status = 'ACCEPTED' then
    return coalesce(v_share.accepted_item_id, v_share.item_id);
  end if;
  if v_share.status = 'REJECTED' then
    raise exception 'El envío fue rechazado';
  end if;

  if v_share.item_type = 'OBJECT' then
    select * into v_obj from public.oracle_objects where id = v_share.item_id;
    if v_obj is null then raise exception 'El objeto ya no existe'; end if;

    v_new_name := v_obj.object_name;
    loop
      exit when not exists (
        select 1 from public.oracle_objects
        where user_id = v_uid and schema_name = v_obj.schema_name
          and object_name = v_new_name and object_type = v_obj.object_type
      );
      v_suffix := v_suffix + 1;
      v_new_name := v_obj.object_name || '_COPIA' || v_suffix::text;
    end loop;

    insert into public.oracle_objects (
      schema_name, object_name, object_type, description, functional_description,
      module, owner, notes, source, user_id, created_by, updated_by
    ) values (
      v_obj.schema_name, v_new_name, v_obj.object_type, v_obj.description,
      v_obj.functional_description, v_obj.module, v_uid, v_obj.notes, 'MANUAL',
      v_uid, v_uid, v_uid
    ) returning id into v_new_id;

    for v_col in
      select * from public.oracle_columns where object_id = v_share.item_id order by column_order
    loop
      insert into public.oracle_columns (
        object_id, column_name, data_type, data_length, data_precision, data_scale,
        nullable, column_order, description, business_meaning, notes, source,
        is_primary_key, is_unique, references_schema, references_table,
        references_column, check_expression, created_by, updated_by
      ) values (
        v_new_id, v_col.column_name, v_col.data_type, v_col.data_length, v_col.data_precision,
        v_col.data_scale, v_col.nullable, v_col.column_order, v_col.description,
        v_col.business_meaning, v_col.notes, 'MANUAL',
        coalesce(v_col.is_primary_key, false), coalesce(v_col.is_unique, false),
        v_col.references_schema, v_col.references_table, v_col.references_column,
        v_col.check_expression, v_uid, v_uid
      ) returning id into v_new_col;

      insert into public.oracle_column_values (
        column_id, value, meaning, notes, is_active, sort_order, created_by, updated_by
      )
      select v_new_col, value, meaning, notes, is_active, sort_order, v_uid, v_uid
      from public.oracle_column_values where column_id = v_col.id;
    end loop;

    insert into public.oracle_arguments (
      object_id, argument_name, position, data_type, in_out, description, created_by
    )
    select v_new_id, argument_name, position, data_type, in_out, description, v_uid
    from public.oracle_arguments where object_id = v_share.item_id;

    insert into public.oracle_code_versions (
      object_id, version_number, source_type, source_code, environment, change_description, created_by
    )
    select v_new_id, version_number, source_type, source_code, environment, change_description, v_uid
    from public.oracle_code_versions where object_id = v_share.item_id;

    for v_tag in
      select kt.name, kt.color
      from public.knowledge_object_tags kot
      join public.knowledge_tags kt on kt.id = kot.tag_id
      where kot.object_id = v_share.item_id
    loop
      select id into v_new_tag from public.knowledge_tags where user_id = v_uid and name = v_tag.name;
      if v_new_tag is null then
        insert into public.knowledge_tags (name, color, user_id, created_by)
        values (v_tag.name, v_tag.color, v_uid, v_uid) returning id into v_new_tag;
      end if;
      insert into public.knowledge_object_tags (object_id, tag_id)
      values (v_new_id, v_new_tag) on conflict do nothing;
    end loop;

  elsif v_share.item_type = 'SNIPPET' then
    select * into v_snip from public.sql_snippets where id = v_share.item_id;
    if v_snip is null then raise exception 'La consulta ya no existe'; end if;

    insert into public.sql_snippets (
      title, description, sql_code, category, database_type, schema_name,
      environment, notes, warnings, user_id, created_by, updated_by
    ) values (
      v_snip.title, v_snip.description, v_snip.sql_code, v_snip.category,
      v_snip.database_type, v_snip.schema_name, v_snip.environment, v_snip.notes,
      v_snip.warnings, v_uid, v_uid, v_uid
    ) returning id into v_new_id;

    insert into public.sql_snippet_parameters (
      snippet_id, parameter_name, data_type, description, example_value, required, position
    )
    select v_new_id, parameter_name, data_type, description, example_value, required, position
    from public.sql_snippet_parameters where snippet_id = v_share.item_id;

    for v_tag in
      select kt.name, kt.color
      from public.knowledge_snippet_tags kst
      join public.knowledge_tags kt on kt.id = kst.tag_id
      where kst.snippet_id = v_share.item_id
    loop
      select id into v_new_tag from public.knowledge_tags where user_id = v_uid and name = v_tag.name;
      if v_new_tag is null then
        insert into public.knowledge_tags (name, color, user_id, created_by)
        values (v_tag.name, v_tag.color, v_uid, v_uid) returning id into v_new_tag;
      end if;
      insert into public.knowledge_snippet_tags (snippet_id, tag_id)
      values (v_new_id, v_new_tag) on conflict do nothing;
    end loop;
  else
    raise exception 'Tipo no soportado: %', v_share.item_type;
  end if;

  update public.shared_items
    set status = 'ACCEPTED', is_read = true, accepted_item_id = v_new_id
    where id = p_id;

  update public.notifications
    set is_read = true
    where user_id = v_uid and metadata->>'shared_item_id' = p_id::text;

  return v_new_id;
end $$;

grant execute on function public.accept_shared_item(uuid) to authenticated;

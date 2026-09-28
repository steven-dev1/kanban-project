-- ============================================================================
-- KANBAN — ENDURECIMIENTO DE SEGURIDAD
-- Ejecutar DESPUÉS de schema.sql, oracle-hub*.sql, knowledge-*.sql y
-- collab-features.sql. Idempotente.
--
-- Corrige:
--   1) Escalada de privilegios en invitaciones (role/board_id manipulables).
--   2) IDOR en accept_shared_item (copiar items de otro usuario).
--   3) Perfiles: lectura global de PII (email).
--   4) Rol de knowledge por defecto (admin) -> viewer.
--   5) Funciones SECURITY DEFINER ejecutables por public/anon.
--   6) Propiedad de item al crear shared_items / card_knowledge_links.
--   7) Índices faltantes en consultas frecuentes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) INVITACIONES: impedir escalada de privilegios
-- ---------------------------------------------------------------------------

-- El usuario invitado solo puede ACEPTAR/RECHAZAR su propia invitación, sin
-- poder cambiar rol ni tablero. El admin gestiona el resto.
drop policy if exists invitations_update on public.board_invitations;
create policy invitations_update on public.board_invitations for update to authenticated
  using (
    public.is_board_admin(board_id, auth.uid())
    or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  )
  with check (
    -- Si lo hace el invitado, no puede alterar rol ni tablero.
    (
      lower(email) = lower(coalesce(auth.jwt()->>'email',''))
      and role = 'member'
    )
    or public.is_board_admin(board_id, auth.uid())
  );

-- Revalida en la RPC: aunque cambien board_id o role, al aceptar solo se
-- concede como 'member' del tablero que la invitación tenga en ese momento,
-- y se exige que el correo coincida.
create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.board_invitations; v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_inv from public.board_invitations where id = p_invitation_id;
  if v_inv is null then raise exception 'Invitation not found'; end if;
  select email into v_email from auth.users where id = v_uid;
  if lower(v_inv.email) <> lower(coalesce(v_email,'')) then
    raise exception 'This invitation is for another email';
  end if;
  if v_inv.status = 'pending' then
    -- El rol efectivo del invitado nunca es admin por esta vía.
    insert into public.board_members (board_id, user_id, role)
    values (v_inv.board_id, v_uid, case when v_inv.role = 'admin' then 'member' else v_inv.role end)
    on conflict (board_id, user_id) do nothing;
    update public.board_invitations
      set status = 'accepted', responded_at = now() where id = p_invitation_id;
  end if;
  return v_inv.board_id;
end $$;

grant execute on function public.accept_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) SHARED ITEMS: validar propiedad del item (evita IDOR)
-- ---------------------------------------------------------------------------

-- Al crear un envío, el emisor debe ser dueño del objeto o consulta.
drop policy if exists shared_items_insert on public.shared_items;
create policy shared_items_insert on public.shared_items for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (item_type = 'OBJECT' and public.kb_owns_object(item_id))
      or (item_type = 'SNIPPET' and public.kb_owns_snippet(item_id))
    )
  );

-- accept_shared_item verifica que el emisor sea dueño del item antes de copiar.
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
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_share from public.shared_items where id = p_id;
  if v_share is null then raise exception 'Envío no encontrado'; end if;
  if v_share.recipient_id <> v_uid then raise exception 'No autorizado'; end if;

  -- Verifica que el emisor sea dueño real del item compartido.
  if v_share.item_type = 'OBJECT' then
    select user_id into v_owner from public.oracle_objects where id = v_share.item_id;
  else
    select user_id into v_owner from public.sql_snippets where id = v_share.item_id;
  end if;
  if v_owner is null or v_owner <> v_share.sender_id then
    raise exception 'El elemento compartido no pertenece al emisor';
  end if;

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

-- ---------------------------------------------------------------------------
-- 3) PERFILES: dejar de exponer el email de todos
-- ---------------------------------------------------------------------------
-- Se puede leer: el propio perfil, o perfiles de gente con la que se comparte
-- al menos un tablero. El email se sigue guardando, pero el acceso se acota.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.board_members me
      join public.board_members other on other.board_id = me.board_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );

-- Directorio para elegir destinatarios al compartir: devuelve id y nombre de
-- todos los usuarios (sin email), mediante SECURITY DEFINER para no depender
-- de la política anterior. No expone datos sensibles.
create or replace function public.list_directory()
returns table (id uuid, full_name text, email text)
language sql security definer set search_path = public stable as $$
  select p.id, p.full_name, p.email
  from public.profiles p
  order by coalesce(p.full_name, p.email);
$$;

revoke execute on function public.list_directory() from public, anon;
grant execute on function public.list_directory() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Rol de knowledge por defecto: viewer en vez de admin
-- ---------------------------------------------------------------------------

alter table public.profiles alter column knowledge_role set default 'viewer';

-- ---------------------------------------------------------------------------
-- 5) Funciones SECURITY DEFINER: solo authenticated (no public/anon)
-- ---------------------------------------------------------------------------

revoke execute on function public.is_board_member(uuid, uuid) from public, anon;
revoke execute on function public.is_board_admin(uuid, uuid) from public, anon;
revoke execute on function public.board_is_active(uuid) from public, anon;
revoke execute on function public.can_edit_board(uuid, uuid) from public, anon;
grant execute on function public.is_board_member(uuid, uuid) to authenticated;
grant execute on function public.is_board_admin(uuid, uuid) to authenticated;
grant execute on function public.board_is_active(uuid) to authenticated;
grant execute on function public.can_edit_board(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) card_knowledge_links: validar propiedad del item al enlazar
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'card_knowledge_links') then
    execute 'drop policy if exists card_knowledge_links_insert on public.card_knowledge_links';
    execute 'create policy card_knowledge_links_insert on public.card_knowledge_links
      for insert to authenticated
      with check (
        public.can_edit_board(
          (select board_id from public.cards where id = card_id),
          auth.uid()
        )
        and (
          (item_type = ''OBJECT'' and public.kb_owns_object(item_id))
          or (item_type = ''SNIPPET'' and public.kb_owns_snippet(item_id))
        )
      )';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Índices faltantes
-- ---------------------------------------------------------------------------

create index if not exists idx_card_activity_board on public.card_activity(board_id, created_at desc);
create index if not exists idx_card_comments_board on public.card_comments(board_id, created_at);
create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_object_tags_object on public.knowledge_object_tags(object_id);
create index if not exists idx_snippet_tags_snippet on public.knowledge_snippet_tags(snippet_id);

-- ---------------------------------------------------------------------------
-- 8) Realtime: publicar las tablas de colaboración (comentarios, actividad,
--    campos). Sin esto, las suscripciones del cliente quedan inertes.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['board_fields','card_field_values','card_comments','card_activity']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

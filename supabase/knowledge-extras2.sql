-- ============================================================================
-- Extras 2: Historial (auditoría) del Knowledge Hub + Enviar objetos a usuarios
-- Ejecutar DESPUÉS de supabase/schema.sql y supabase/oracle-hub.sql.
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Historial / auditoría del Knowledge Hub
-- ---------------------------------------------------------------------------

create table if not exists public.knowledge_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,          -- INSERT | UPDATE | DELETE
  entity text not null,          -- tabla afectada
  entity_id uuid,
  label text,                    -- etiqueta legible (SP6DF.VG_TIQUETES, título, etc.)
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_activity_user on public.knowledge_activity(user_id, created_at desc);
create index if not exists idx_knowledge_activity_created on public.knowledge_activity(created_at desc);

alter table public.knowledge_activity enable row level security;

drop policy if exists knowledge_activity_select on public.knowledge_activity;
create policy knowledge_activity_select on public.knowledge_activity
  for select to authenticated using (user_id = auth.uid());

drop policy if exists knowledge_activity_insert on public.knowledge_activity;
create policy knowledge_activity_insert on public.knowledge_activity
  for insert to authenticated with check (user_id = auth.uid());

-- Trigger de auditoría genérico
create or replace function public.log_knowledge_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_label text;
  v_entity_id uuid;
  v_user uuid := auth.uid();
  v_row jsonb;
begin
  v_entity_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  v_row := coalesce(to_jsonb(new), to_jsonb(old));

  if TG_TABLE_NAME = 'oracle_objects' then
    v_label := (v_row->>'schema_name') || '.' || (v_row->>'object_name');
  elsif TG_TABLE_NAME = 'oracle_columns' then
    v_label := v_row->>'column_name';
  elsif TG_TABLE_NAME = 'oracle_column_values' then
    v_label := v_row->>'value';
  elsif TG_TABLE_NAME = 'oracle_code_versions' then
    v_label := 'v' || (v_row->>'version_number') || ' ' || (v_row->>'source_type') ||
               coalesce(' · ' || (v_row->>'environment'), '');
  elsif TG_TABLE_NAME = 'oracle_arguments' then
    v_label := v_row->>'argument_name';
  elsif TG_TABLE_NAME = 'sql_snippets' then
    v_label := v_row->>'title';
  elsif TG_TABLE_NAME = 'sql_snippet_parameters' then
    v_label := v_row->>'parameter_name';
  else
    v_label := TG_TABLE_NAME;
  end if;

  insert into public.knowledge_activity (user_id, action, entity, entity_id, label)
  values (v_user, TG_OP, TG_TABLE_NAME, v_entity_id, v_label);

  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'oracle_objects','oracle_columns','oracle_column_values','oracle_code_versions',
    'oracle_arguments','object_relations','sql_snippets','sql_snippet_parameters'
  ]
  loop
    execute format('drop trigger if exists trg_activity_%s on public.%I', t, t);
    execute format(
      'create trigger trg_activity_%s after insert or update or delete on public.%I for each row execute function public.log_knowledge_activity()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Enviar objetos/consultas a otros usuarios (mensajería interna)
-- ---------------------------------------------------------------------------

create table if not exists public.shared_items (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('OBJECT','SNIPPET')),
  item_id uuid not null,
  item_label text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_shared_items_recipient on public.shared_items(recipient_id, created_at desc);
create index if not exists idx_shared_items_sender on public.shared_items(sender_id, created_at desc);

alter table public.shared_items enable row level security;

drop policy if exists shared_items_select on public.shared_items;
create policy shared_items_select on public.shared_items
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists shared_items_insert on public.shared_items;
create policy shared_items_insert on public.shared_items
  for insert to authenticated with check (sender_id = auth.uid());

drop policy if exists shared_items_update on public.shared_items;
create policy shared_items_update on public.shared_items
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists shared_items_delete on public.shared_items;
create policy shared_items_delete on public.shared_items
  for delete to authenticated using (sender_id = auth.uid());

-- Notifica al destinatario cuando le envían un objeto
create or replace function public.notify_on_shared_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, board_id, type, title, body, metadata)
  values (
    new.recipient_id,
    null,
    'item_shared',
    'Te enviaron un objeto',
    new.item_label,
    jsonb_build_object('shared_item_id', new.id, 'item_type', new.item_type, 'item_id', new.item_id)
  );
  return new;
end $$;

drop trigger if exists trg_notify_shared_item on public.shared_items;
create trigger trg_notify_shared_item after insert on public.shared_items
  for each row execute function public.notify_on_shared_item();

-- ---------------------------------------------------------------------------
-- 3) Realtime
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['shared_items','knowledge_activity']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

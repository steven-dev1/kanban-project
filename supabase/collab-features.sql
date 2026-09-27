-- ============================================================================
-- KANBAN — COLABORACIÓN Y ORGANIZACIÓN
-- Ejecutar DESPUÉS de supabase/schema.sql. Idempotente.
--
-- Añade: fechas de inicio en tarjetas, plantillas de tablero, campos
-- personalizados, actividad por tarjeta y comentarios con menciones.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Fechas de inicio (para calendario/timeline)
-- ---------------------------------------------------------------------------

alter table public.cards add column if not exists start_date timestamptz;
alter table public.boards add column if not exists is_template boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) Plantillas de tablero
-- Reutilizamos boards con is_template = true. El dueño ve sus plantillas.
-- ---------------------------------------------------------------------------

create index if not exists idx_boards_template on public.boards(owner_id) where is_template;

-- ---------------------------------------------------------------------------
-- 3) Campos personalizados
-- ---------------------------------------------------------------------------

create table if not exists public.board_fields (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  field_type text not null check (field_type in ('TEXT','NUMBER','DATE','SELECT','CHECKBOX','USER')),
  options jsonb,                       -- para SELECT: ["A","B"]
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.card_field_values (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  field_id uuid not null references public.board_fields(id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  unique (card_id, field_id)
);

create index if not exists idx_board_fields_board on public.board_fields(board_id, position);
create index if not exists idx_card_field_values_card on public.card_field_values(card_id);

-- ---------------------------------------------------------------------------
-- 4) Actividad por tarjeta
-- ---------------------------------------------------------------------------

create table if not exists public.card_activity (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_activity_card on public.card_activity(card_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Comentarios con menciones
-- ---------------------------------------------------------------------------

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_card_comments_card on public.card_comments(card_id, created_at);

drop trigger if exists trg_card_comments_updated on public.card_comments;
create trigger trg_card_comments_updated before update on public.card_comments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'board_fields','card_field_values','card_activity','card_comments'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %s_member on public.%I', t, t);
  end loop;
end $$;

-- board_fields: cualquier miembro puede leer; admin/dueño puede escribir.
drop policy if exists board_fields_read on public.board_fields;
create policy board_fields_read on public.board_fields
  for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));

drop policy if exists board_fields_write on public.board_fields;
create policy board_fields_write on public.board_fields
  for all to authenticated
  using (public.is_board_admin(board_id, auth.uid()))
  with check (public.is_board_admin(board_id, auth.uid()));

-- card_field_values: miembros leen; miembros con permiso de edición escriben.
drop policy if exists card_field_values_read on public.card_field_values;
create policy card_field_values_read on public.card_field_values
  for select to authenticated
  using (exists (
    select 1 from public.cards c
    where c.id = card_id and public.is_board_member(c.board_id, auth.uid())
  ));

drop policy if exists card_field_values_write on public.card_field_values;
create policy card_field_values_write on public.card_field_values
  for all to authenticated
  using (exists (
    select 1 from public.cards c
    where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())
  ))
  with check (exists (
    select 1 from public.cards c
    where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())
  ));

-- card_activity: miembros leen; cualquier miembro puede insertar (es un log).
drop policy if exists card_activity_read on public.card_activity;
create policy card_activity_read on public.card_activity
  for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));

drop policy if exists card_activity_insert on public.card_activity;
create policy card_activity_insert on public.card_activity
  for insert to authenticated
  with check (public.is_board_member(board_id, auth.uid()) and actor_id = auth.uid());

-- card_comments: miembros leen; el autor crea/edita/elimina lo suyo.
drop policy if exists card_comments_read on public.card_comments;
create policy card_comments_read on public.card_comments
  for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));

drop policy if exists card_comments_insert on public.card_comments;
create policy card_comments_insert on public.card_comments
  for insert to authenticated
  with check (public.is_board_member(board_id, auth.uid()) and author_id = auth.uid());

drop policy if exists card_comments_update on public.card_comments;
create policy card_comments_update on public.card_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists card_comments_delete on public.card_comments;
create policy card_comments_delete on public.card_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_board_admin(board_id, auth.uid()));

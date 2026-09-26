-- ============================================================================
-- Extras: Pull Requests (Knowledge Hub) + Checklists de cards (Kanban)
-- Ejecutar DESPUÉS de supabase/schema.sql y supabase/oracle-hub.sql.
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Pull Requests (privados por usuario, igual que el resto del hub)
-- ---------------------------------------------------------------------------

create table if not exists public.pull_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  environment text not null default 'DEV' check (environment in ('DEV','QA','PRODUCTIVO')),
  pr_number text,
  title text,
  url text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pull_requests_user on public.pull_requests(user_id, created_at desc);
create index if not exists idx_pull_requests_env on public.pull_requests(environment);

drop trigger if exists trg_pull_requests_updated on public.pull_requests;
create trigger trg_pull_requests_updated before update on public.pull_requests
  for each row execute function public.touch_updated_at();

alter table public.pull_requests enable row level security;

drop policy if exists pull_requests_owner on public.pull_requests;
create policy pull_requests_owner on public.pull_requests
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) Checklists por card (Kanban)
-- ---------------------------------------------------------------------------

create table if not exists public.card_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  text text not null,
  is_done boolean not null default false,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_checklist_card on public.card_checklist_items(card_id, position);

alter table public.card_checklist_items enable row level security;

drop policy if exists card_checklist_select on public.card_checklist_items;
create policy card_checklist_select on public.card_checklist_items for select to authenticated
  using (exists (
    select 1 from public.cards c
    where c.id = card_id and public.is_board_member(c.board_id, auth.uid())
  ));

drop policy if exists card_checklist_write on public.card_checklist_items;
create policy card_checklist_write on public.card_checklist_items for all to authenticated
  using (exists (
    select 1 from public.cards c
    where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())
  ))
  with check (exists (
    select 1 from public.cards c
    where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 3) Al completar, mover la card a otra columna (configurable por columna)
-- ---------------------------------------------------------------------------

alter table public.lists
  add column if not exists completed_list_id uuid references public.lists(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4) Realtime
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['pull_requests','card_checklist_items']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

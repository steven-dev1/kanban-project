-- ============================================================================
-- Kanban app schema
-- Run this in the Supabase SQL editor (project: grgimmvwzworxadidkfa)
-- Safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create table if not exists public.board_invitations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  color text default '#94a3b8',
  position double precision not null default 1000,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null,
  description text,
  position double precision not null default 1000,
  due_date timestamptz,
  is_completed boolean not null default false,
  completed_at timestamptz,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the initial release (safe to re-run on existing DBs)
alter table public.cards add column if not exists is_completed boolean not null default false;
alter table public.cards add column if not exists completed_at timestamptz;

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists public.card_labels (
  card_id uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table if not exists public.card_assignees (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  path text not null,
  size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_board_members_user on public.board_members(user_id);
create index if not exists idx_board_members_board on public.board_members(board_id);
create index if not exists idx_invitations_email on public.board_invitations(lower(email));
create index if not exists idx_lists_board on public.lists(board_id, position);
create index if not exists idx_cards_list on public.cards(list_id, position);
create index if not exists idx_cards_board on public.cards(board_id);
create index if not exists idx_labels_board on public.labels(board_id);
create index if not exists idx_card_assignees_user on public.card_assignees(user_id);
create index if not exists idx_attachments_card on public.attachments(card_id);
create index if not exists idx_attachments_board on public.attachments(board_id);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_board_member(p_board uuid, p_user uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board and (b.owner_id = p_user
      or exists (select 1 from public.board_members m
                 where m.board_id = p_board and m.user_id = p_user))
  );
$$;

create or replace function public.is_board_admin(p_board uuid, p_user uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board and (b.owner_id = p_user
      or exists (select 1 from public.board_members m
                 where m.board_id = p_board and m.user_id = p_user and m.role = 'admin'))
  );
$$;

create or replace function public.board_is_active(p_board uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select not is_paused from public.boards where id = p_board), false);
$$;

create or replace function public.can_edit_board(p_board uuid, p_user uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.board_is_active(p_board) and public.is_board_member(p_board, p_user);
$$;

-- Extracts the board id from a storage path like "<board_id>/<card_id>/<file>"
create or replace function public.attachment_board_id(p_name text)
returns uuid language sql immutable as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_boards_updated on public.boards;
create trigger trg_boards_updated before update on public.boards
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_cards_updated on public.cards;
create trigger trg_cards_updated before update on public.cards
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auth -> profile sync + pending invitation notifications
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.notifications (user_id, board_id, type, title, body, metadata)
  select new.id, i.board_id, 'board_invite', 'Te invitaron a un tablero',
         b.title, jsonb_build_object('invitation_id', i.id, 'board_id', i.board_id)
  from public.board_invitations i
  join public.boards b on b.id = i.board_id
  where i.status = 'pending' and lower(i.email) = lower(coalesce(new.email,''));

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.notify_on_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select id into v_user from public.profiles where lower(email) = lower(new.email) limit 1;
  if v_user is not null then
    insert into public.notifications (user_id, board_id, type, title, body, metadata)
    values (v_user, new.board_id, 'board_invite', 'Te invitaron a un tablero',
            (select title from public.boards where id = new.board_id),
            jsonb_build_object('invitation_id', new.id, 'board_id', new.board_id));
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_invitation on public.board_invitations;
create trigger trg_notify_invitation after insert on public.board_invitations
  for each row execute function public.notify_on_invitation();

create or replace function public.notify_on_member_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, board_id, type, title, body, metadata)
  values (new.user_id, new.board_id, 'board_added', 'Te agregaron a un tablero',
          (select title from public.boards where id = new.board_id),
          jsonb_build_object('board_id', new.board_id));
  return new;
end $$;

drop trigger if exists trg_notify_member_added on public.board_members;
create trigger trg_notify_member_added after insert on public.board_members
  for each row execute function public.notify_on_member_added();

-- ---------------------------------------------------------------------------
-- Invitation RPCs
-- ---------------------------------------------------------------------------

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
    insert into public.board_members (board_id, user_id, role)
    values (v_inv.board_id, v_uid, v_inv.role)
    on conflict (board_id, user_id) do nothing;
    update public.board_invitations
      set status = 'accepted', responded_at = now() where id = p_invitation_id;
  end if;
  return v_inv.board_id;
end $$;

create or replace function public.decline_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv public.board_invitations; v_email text;
begin
  select * into v_inv from public.board_invitations where id = p_invitation_id;
  if v_inv is null then return; end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(v_inv.email) <> lower(coalesce(v_email,'')) then
    raise exception 'This invitation is for another email';
  end if;
  update public.board_invitations
    set status = 'declined', responded_at = now() where id = p_invitation_id;
end $$;

grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_invitations enable row level security;
alter table public.lists enable row level security;
alter table public.cards enable row level security;
alter table public.labels enable row level security;
alter table public.card_labels enable row level security;
alter table public.card_assignees enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards for select to authenticated
  using (owner_id = auth.uid() or public.is_board_member(id, auth.uid()));
drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards for update to authenticated
  using (public.is_board_admin(id, auth.uid()))
  with check (public.is_board_admin(id, auth.uid()));
drop policy if exists boards_delete on public.boards;
create policy boards_delete on public.boards for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists board_members_select on public.board_members;
create policy board_members_select on public.board_members for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));
drop policy if exists board_members_write on public.board_members;
create policy board_members_write on public.board_members for all to authenticated
  using (public.is_board_admin(board_id, auth.uid()))
  with check (public.is_board_admin(board_id, auth.uid()));

drop policy if exists invitations_select on public.board_invitations;
create policy invitations_select on public.board_invitations for select to authenticated
  using (public.is_board_admin(board_id, auth.uid()) or lower(email) = lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists invitations_insert on public.board_invitations;
create policy invitations_insert on public.board_invitations for insert to authenticated
  with check (public.is_board_admin(board_id, auth.uid()) and invited_by = auth.uid());
drop policy if exists invitations_update on public.board_invitations;
create policy invitations_update on public.board_invitations for update to authenticated
  using (public.is_board_admin(board_id, auth.uid()) or lower(email) = lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists invitations_delete on public.board_invitations;
create policy invitations_delete on public.board_invitations for delete to authenticated
  using (public.is_board_admin(board_id, auth.uid()));

drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));
drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert to authenticated
  with check (public.can_edit_board(board_id, auth.uid()));
drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists for update to authenticated
  using (public.can_edit_board(board_id, auth.uid()))
  with check (public.can_edit_board(board_id, auth.uid()));
drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists for delete to authenticated
  using (public.can_edit_board(board_id, auth.uid()));

drop policy if exists cards_select on public.cards;
create policy cards_select on public.cards for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));
drop policy if exists cards_insert on public.cards;
create policy cards_insert on public.cards for insert to authenticated
  with check (public.can_edit_board(board_id, auth.uid()));
drop policy if exists cards_update on public.cards;
create policy cards_update on public.cards for update to authenticated
  using (public.can_edit_board(board_id, auth.uid()))
  with check (public.can_edit_board(board_id, auth.uid()));
drop policy if exists cards_delete on public.cards;
create policy cards_delete on public.cards for delete to authenticated
  using (public.can_edit_board(board_id, auth.uid()));

drop policy if exists labels_select on public.labels;
create policy labels_select on public.labels for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));
drop policy if exists labels_insert on public.labels;
create policy labels_insert on public.labels for insert to authenticated
  with check (public.can_edit_board(board_id, auth.uid()));
drop policy if exists labels_update on public.labels;
create policy labels_update on public.labels for update to authenticated
  using (public.can_edit_board(board_id, auth.uid()))
  with check (public.can_edit_board(board_id, auth.uid()));
drop policy if exists labels_delete on public.labels;
create policy labels_delete on public.labels for delete to authenticated
  using (public.can_edit_board(board_id, auth.uid()));

drop policy if exists card_labels_select on public.card_labels;
create policy card_labels_select on public.card_labels for select to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id, auth.uid())));
drop policy if exists card_labels_insert on public.card_labels;
create policy card_labels_insert on public.card_labels for insert to authenticated
  with check (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())));
drop policy if exists card_labels_delete on public.card_labels;
create policy card_labels_delete on public.card_labels for delete to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())));

drop policy if exists card_assignees_select on public.card_assignees;
create policy card_assignees_select on public.card_assignees for select to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id, auth.uid())));
drop policy if exists card_assignees_insert on public.card_assignees;
create policy card_assignees_insert on public.card_assignees for insert to authenticated
  with check (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())));
drop policy if exists card_assignees_delete on public.card_assignees;
create policy card_assignees_delete on public.card_assignees for delete to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_board(c.board_id, auth.uid())));

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated
  using (public.is_board_member(board_id, auth.uid()));
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.can_edit_board(board_id, auth.uid()) and uploaded_by = auth.uid());
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments for delete to authenticated
  using (public.can_edit_board(board_id, auth.uid()));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage (attachments)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_storage_select on storage.objects;
create policy attachments_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_board_member(public.attachment_board_id(name), auth.uid())
  );

drop policy if exists attachments_storage_insert on storage.objects;
create policy attachments_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.can_edit_board(public.attachment_board_id(name), auth.uid())
  );

drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_edit_board(public.attachment_board_id(name), auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['cards','lists','labels','card_labels','card_assignees','attachments','board_members','boards','board_invitations','notifications']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- Caraoto core schema. Run in Supabase SQL Editor.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Yo',
  created_at timestamptz not null default now());

create table public.couples (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());

create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  primary key (couple_id, user_id));

create table public.invitations (
  code text primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '48 hours',
  used_at timestamptz);

create table public.current_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  color text not null check (color in ('azul','verde','naranja','rojo','amarillo','blanco','negro','marron','morado','rosado','gris','celeste')),
  note text check (char_length(note) <= 200),
  sharing_paused boolean not null default false,
  updated_at timestamptz not null default now());

create table public.status_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  color text not null check (color in ('azul','verde','naranja','rojo','amarillo','blanco','negro','marron','morado','rosado','gris','celeste')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now());
create index on public.status_history (couple_id, created_at desc);
create index on public.current_status (couple_id);

-- Helpers (security definer => no RLS recursion)
create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from couple_members where couple_id = c and user_id = auth.uid()) $$;
create function public.is_partner(u uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
   where a.user_id = auth.uid() and b.user_id = u) $$;

-- RLS
alter table profiles enable row level security;
alter table couples enable row level security;
alter table couple_members enable row level security;
alter table invitations enable row level security;
alter table current_status enable row level security;
alter table status_history enable row level security;

create policy "profiles read" on profiles for select using (id = auth.uid() or is_partner(id));
create policy "profiles update own" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "couples read" on couples for select using (is_member(id));
create policy "members read" on couple_members for select using (user_id = auth.uid() or is_member(couple_id));
create policy "status read" on current_status for select using (is_member(couple_id));
create policy "history read" on status_history for select using (is_member(couple_id));
create policy "history delete own" on status_history for delete using (user_id = auth.uid());
-- No insert/update policies on status tables: writes only through set_status() below.
-- invitations: no policies => unreadable from client; only RPCs touch it.

-- Auto-create profile on signup
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), 'Yo'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- RPCs
create function public.create_couple() returns text language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from couple_members where user_id = auth.uid()) then raise exception 'Ya tienes una pareja'; end if;
  insert into couples default values returning id into v_couple;
  insert into couple_members values (v_couple, auth.uid());
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into invitations (code, couple_id, created_by) values (v_code, v_couple, auth.uid());
  return v_code;
end $$;

create function public.join_couple(p_code text) returns void language plpgsql security definer set search_path = public as $$
declare v_inv invitations;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from couple_members where user_id = auth.uid()) then raise exception 'Ya tienes una pareja'; end if;
  select * into v_inv from invitations where code = upper(trim(p_code)) and used_at is null and expires_at > now() for update;
  if not found then raise exception 'Código inválido o expirado'; end if;
  if (select count(*) from couple_members where couple_id = v_inv.couple_id) >= 2 then raise exception 'Este espacio ya está completo'; end if;
  insert into couple_members values (v_inv.couple_id, auth.uid());
  update invitations set used_at = now() where code = v_inv.code;
end $$;

-- Atomic: history + current state in one transaction (a function body is one transaction)
create function public.set_status(p_color text, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_note text := nullif(trim(p_note), '');
begin
  select couple_id into v_couple from couple_members where user_id = auth.uid();
  if v_couple is null then raise exception 'Sin espacio de pareja'; end if;
  insert into status_history (user_id, couple_id, color, note) values (auth.uid(), v_couple, p_color, v_note);
  insert into current_status (user_id, couple_id, color, note, updated_at) values (auth.uid(), v_couple, p_color, v_note, now())
  on conflict (user_id) do update set color = excluded.color, note = excluded.note, updated_at = excluded.updated_at;
end $$;

revoke execute on function create_couple(), join_couple(text), set_status(text,text) from public, anon;
grant execute on function create_couple(), join_couple(text), set_status(text,text) to authenticated;

alter publication supabase_realtime add table public.current_status;

begin;

-- Preserve all existing memberships, invitations and statuses.
create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.couple_members where couple_id = c and user_id = auth.uid())
$$;

create or replace function public.is_partner(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members a join public.couple_members b using (couple_id)
    where a.user_id = auth.uid() and b.user_id = u
  )
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Yo'));
  return new;
end
$$;

-- The route guard needs only the caller's membership.
create function public.my_couple_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

create function public.get_invitation() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_code text;
begin
  select couple_id into v_couple from public.couple_members where user_id = v_user;
  if v_couple is null then raise exception 'Sin espacio de pareja'; end if;

  -- All operations that add a partner or issue a code lock the couple first.
  perform 1 from public.couples where id = v_couple for update;
  if (select count(*) from public.couple_members where couple_id = v_couple) >= 2 then
    raise exception 'Este espacio ya está completo';
  end if;

  select code into v_code from public.invitations
  where couple_id = v_couple and used_at is null and expires_at > now()
  order by expires_at desc limit 1;
  if found then return v_code; end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.invitations (code, couple_id, created_by)
    values (v_code, v_couple, v_user) on conflict (code) do nothing;
    if found then return v_code; end if;
  end loop;
end
$$;

create or replace function public.create_couple() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
begin
  perform 1 from public.profiles where id = v_user for update;
  if not found then raise exception 'No se encontró tu perfil'; end if;
  if public.my_couple_id() is not null then
    raise exception 'Ya tienes una pareja' using errcode = 'PT409';
  end if;

  insert into public.couples default values returning id into v_couple;
  insert into public.couple_members (couple_id, user_id) values (v_couple, v_user);
  return public.get_invitation();
end
$$;

create or replace function public.join_couple(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_couple uuid;
begin
  perform 1 from public.profiles where id = v_user for update;
  if not found then raise exception 'No se encontró tu perfil'; end if;
  if public.my_couple_id() is not null then
    raise exception 'Ya tienes una pareja' using errcode = 'PT409';
  end if;

  select couple_id into v_couple from public.invitations
  where code = v_code and used_at is null and expires_at > now();
  if not found then raise exception 'Código inválido o expirado'; end if;

  perform 1 from public.couples where id = v_couple for update;
  if (select count(*) from public.couple_members where couple_id = v_couple) >= 2 then
    raise exception 'Este espacio ya está completo';
  end if;

  update public.invitations set used_at = now()
  where code = v_code and used_at is null and expires_at > now();
  if not found then raise exception 'Código inválido o expirado'; end if;

  insert into public.couple_members (couple_id, user_id) values (v_couple, v_user);
end
$$;

create or replace function public.set_status(p_color text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_note text := nullif(trim(p_note), '');
  v_updated_at timestamptz;
begin
  select couple_id into v_couple from public.couple_members where user_id = v_user for update;
  if not found then raise exception 'Sin espacio de pareja'; end if;
  v_updated_at := clock_timestamp();

  insert into public.status_history (user_id, couple_id, color, note, created_at)
  values (v_user, v_couple, p_color, v_note, v_updated_at);
  insert into public.current_status (user_id, couple_id, color, note, updated_at)
  values (v_user, v_couple, p_color, v_note, v_updated_at)
  on conflict (user_id) do update set
    couple_id = excluded.couple_id, color = excluded.color, note = excluded.note,
    updated_at = excluded.updated_at;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_member(uuid), public.is_partner(uuid),
  public.my_couple_id(), public.get_invitation(), public.create_couple(),
  public.join_couple(text), public.set_status(text, text) from public, anon;
grant execute on function public.is_member(uuid), public.is_partner(uuid),
  public.my_couple_id(), public.get_invitation(), public.create_couple(),
  public.join_couple(text), public.set_status(text, text) to authenticated;

grant select on public.profiles, public.couples, public.couple_members,
  public.current_status, public.status_history to authenticated;
revoke all on public.invitations from public, anon, authenticated;

alter policy "profiles read" on public.profiles to authenticated;
alter policy "profiles update own" on public.profiles to authenticated;
alter policy "couples read" on public.couples to authenticated;
alter policy "members read" on public.couple_members to authenticated;
alter policy "status read" on public.current_status to authenticated;
alter policy "history read" on public.status_history to authenticated;
alter policy "history delete own" on public.status_history to authenticated;

create index on public.status_history (couple_id, user_id, id desc);
create index on public.status_history (couple_id, id desc);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'current_status'
  ) then
    alter publication supabase_realtime add table public.current_status;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_members'
  ) then
    alter publication supabase_realtime add table public.couple_members;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;



begin;

-- Keep history rows and their original couple IDs intact. A recovery shares only
-- the moving author's rows from the solo space with their new space.
create table public.recovered_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_couple_id uuid not null references public.couples(id) on delete cascade,
  destination_couple_id uuid not null references public.couples(id) on delete cascade,
  primary key (user_id, source_couple_id),
  check (source_couple_id <> destination_couple_id)
);
alter table public.recovered_history enable row level security;
revoke all on public.recovered_history from public, anon, authenticated;

create function public.can_read_recovered_history(p_user uuid, p_source uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.recovered_history h
    join public.couple_members author
      on author.user_id = h.user_id and author.couple_id = h.destination_couple_id
    join public.couple_members reader on reader.couple_id = author.couple_id
    where h.user_id = p_user and h.source_couple_id = p_source and reader.user_id = auth.uid()
  )
$$;
revoke execute on function public.can_read_recovered_history(uuid, uuid) from public, anon;
grant execute on function public.can_read_recovered_history(uuid, uuid) to authenticated;

alter policy "history read" on public.status_history
using (user_id = auth.uid() or public.is_member(couple_id)
       or public.can_read_recovered_history(user_id, couple_id));
create index on public.status_history (user_id, id desc);

create or replace function public.get_invitation() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_code text;
begin
  select couple_id into v_couple from public.couple_members where user_id = v_user;
  if not found then raise exception 'Sin espacio de pareja'; end if;

  perform 1 from public.couples where id = v_couple for no key update;
  if not exists (select 1 from public.couple_members where couple_id = v_couple and user_id = v_user) then
    raise exception 'Tu espacio cambió. Recarga el panel.';
  end if;
  if (select count(*) from public.couple_members where couple_id = v_couple) <> 1 then
    raise exception 'Este espacio ya está completo';
  end if;

  select code into v_code from public.invitations
  where couple_id = v_couple and created_by = v_user and used_at is null and expires_at > clock_timestamp()
  order by expires_at desc limit 1;
  if found then return v_code; end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.invitations (code, couple_id, created_by, expires_at)
    values (v_code, v_couple, v_user, clock_timestamp() + interval '48 hours')
    on conflict (code) do nothing;
    if found then return v_code; end if;
  end loop;
end
$$;

-- Internal helper. A null expected source is the normal join for an unpaired account.
create function public.redeem_couple_invitation(p_code text, p_expected_source uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_source uuid;
  v_target uuid;
  v_inviter uuid;
begin
  perform 1 from public.profiles where id = v_user for no key update;
  if not found then raise exception 'No se encontró tu perfil'; end if;
  select couple_id into v_source from public.couple_members where user_id = v_user;

  if p_expected_source is null and v_source is not null then
    raise exception 'Ya tienes una pareja' using errcode = 'PT409';
  end if;
  if p_expected_source is not null and p_expected_source is distinct from v_source then
    raise exception 'Tu espacio cambió. Recarga el panel.';
  end if;

  select couple_id, created_by into v_target, v_inviter from public.invitations
  where code = v_code and used_at is null and expires_at > clock_timestamp();
  if not found then raise exception 'Código inválido o expirado'; end if;
  if v_target = v_source then raise exception 'Usa el código de tu pareja, no el de tu propio espacio'; end if;

  -- All invitation writers serialize on these same rows. A fixed lock order
  -- also handles reciprocal requests. NO KEY UPDATE permits status-write FKs.
  perform id from public.couples
  where id = v_source or id = v_target order by id for no key update;

  if v_source is not null then
    if (select count(*) from public.couple_members where couple_id = v_source) <> 1 then
      raise exception 'Tu espacio ya tiene dos miembros';
    end if;
    -- Serialize the move with set_status and recheck the membership after waiting.
    perform 1 from public.couple_members where user_id = v_user and couple_id = v_source for update;
    if not found then raise exception 'Tu espacio cambió. Recarga el panel.'; end if;
  end if;

  if not exists (select 1 from public.couple_members where couple_id = v_target and user_id = v_inviter) then
    raise exception 'Código inválido o expirado';
  end if;
  if (select count(*) from public.couple_members where couple_id = v_target) <> 1 then
    raise exception 'Este espacio ya está completo';
  end if;

  update public.invitations set used_at = clock_timestamp()
  where code = v_code and used_at is null and expires_at > clock_timestamp();
  if not found then raise exception 'Código inválido o expirado'; end if;

  if v_source is null then
    insert into public.couple_members (couple_id, user_id) values (v_target, v_user);
    return;
  end if;

  -- Carry forward only this user's previously shared history.
  update public.recovered_history set destination_couple_id = v_target
  where user_id = v_user and destination_couple_id = v_source and source_couple_id <> v_target;
  delete from public.recovered_history
  where user_id = v_user and destination_couple_id = v_source and source_couple_id = v_target;
  insert into public.recovered_history (user_id, source_couple_id, destination_couple_id)
  values (v_user, v_source, v_target)
  on conflict (user_id, source_couple_id) do update set destination_couple_id = excluded.destination_couple_id;

  update public.invitations set used_at = clock_timestamp()
  where couple_id = v_source and used_at is null;
  update public.couple_members set couple_id = v_target where user_id = v_user;
  update public.current_status set couple_id = v_target where user_id = v_user and couple_id = v_source;
end
$$;
revoke execute on function public.redeem_couple_invitation(text, uuid) from public, anon, authenticated;

create or replace function public.join_couple(p_code text) returns void
language sql security definer set search_path = '' as $$
  select public.redeem_couple_invitation(p_code, null)
$$;

create function public.recover_pairing(p_code text, p_source uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_source is null then raise exception 'Falta el espacio actual'; end if;
  perform public.redeem_couple_invitation(p_code, p_source);
end
$$;
revoke execute on function public.recover_pairing(text, uuid) from public, anon;
grant execute on function public.recover_pairing(text, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

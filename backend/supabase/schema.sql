create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'collecting' check (status in ('collecting', 'battle', 'complete')),
  current_round integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null,
  is_host boolean not null default false,
  joined_at timestamptz not null default now()
);

create table public.room_picks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  added_by_member_id uuid not null references public.room_members(id) on delete cascade,
  spotify_id text not null,
  spotify_uri text not null,
  artist_name text not null,
  album_name text not null,
  artwork_url text,
  seed_order integer not null,
  eliminated_at_round integer,
  created_at timestamptz not null default now(),
  unique (room_id, spotify_uri)
);

create table public.battle_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round integer not null,
  left_pick_id uuid not null references public.room_picks(id) on delete cascade,
  right_pick_id uuid not null references public.room_picks(id) on delete cascade,
  winner_pick_id uuid references public.room_picks(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (room_id, round)
);

create table public.match_votes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  member_id uuid not null references public.room_members(id) on delete cascade,
  pick_id uuid not null references public.room_picks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, member_id)
);

create index room_members_room_id_idx on public.room_members(room_id);
create index room_picks_room_id_idx on public.room_picks(room_id);
create index battle_matches_room_id_idx on public.battle_matches(room_id);
create index match_votes_match_id_idx on public.match_votes(match_id);

create or replace function public.enforce_room_pick_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pick_count integer;
begin
  perform 1
    from rooms
    where id = new.room_id
    for update;

  select count(*)
    into v_pick_count
    from room_picks
    where room_id = new.room_id;

  if v_pick_count >= 500 then
    raise exception 'A room can hold up to 500 bands.';
  end if;

  return new;
end;
$$;

create trigger room_picks_limit_before_insert
before insert on public.room_picks
for each row
execute function public.enforce_room_pick_limit();

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_picks enable row level security;
alter table public.battle_matches enable row level security;
alter table public.match_votes enable row level security;

create policy "rooms are readable by invite code"
  on public.rooms
  for select
  using (true);

create policy "rooms can be created by app clients"
  on public.rooms
  for insert
  with check (true);

create policy "rooms can be updated by app clients"
  on public.rooms
  for update
  using (true)
  with check (true);

create policy "room members are readable"
  on public.room_members
  for select
  using (true);

create policy "room members can join"
  on public.room_members
  for insert
  with check (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
    )
  );

create policy "room picks are readable"
  on public.room_picks
  for select
  using (true);

create policy "room members can add picks"
  on public.room_picks
  for insert
  with check (
    exists (
      select 1
      from public.room_members rm
      where rm.id = added_by_member_id
        and rm.room_id = room_id
    )
  );

create policy "room picks can be updated by app clients"
  on public.room_picks
  for update
  using (true)
  with check (true);

create policy "room picks can be removed before battle"
  on public.room_picks
  for delete
  using (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.status = 'collecting'
    )
  );

create policy "battle matches are readable"
  on public.battle_matches
  for select
  using (true);

create policy "battle matches can be created by app clients"
  on public.battle_matches
  for insert
  with check (
    exists (
      select 1
      from public.rooms r
      where r.id = room_id
    )
  );

create policy "battle matches can be updated by app clients"
  on public.battle_matches
  for update
  using (true)
  with check (true);

create policy "battle matches can be reset by app clients"
  on public.battle_matches
  for delete
  using (true);

create policy "match votes are readable"
  on public.match_votes
  for select
  using (true);

create policy "room members can vote once per match"
  on public.match_votes
  for insert
  with check (
    exists (
      select 1
      from public.battle_matches bm
      join public.room_members rm on rm.room_id = bm.room_id
      where bm.id = match_id
        and rm.id = member_id
    )
    and exists (
      select 1
      from public.battle_matches bm
      where bm.id = match_id
        and pick_id in (bm.left_pick_id, bm.right_pick_id)
    )
  );

create policy "match votes can be reset by app clients"
  on public.match_votes
  for delete
  using (true);

create or replace function public.start_room_battle(
  p_room_code text,
  p_member_id uuid
)
returns table (
  room_code text,
  started boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_pick_count integer;
  v_left_pick_id uuid;
  v_right_pick_id uuid;
begin
  select *
    into v_room
    from rooms
    where code = p_room_code
    for update;

  if not found then
    raise exception 'Room % was not found.', p_room_code;
  end if;

  if not exists (
    select 1
    from room_members
    where room_id = v_room.id
      and id = p_member_id
      and is_host = true
  ) then
    raise exception 'Only the host can start the battle.';
  end if;

  if exists (
    select 1
    from battle_matches
    where room_id = v_room.id
      and winner_pick_id is null
  ) then
    return query select v_room.code, false;
    return;
  end if;

  select count(*)
    into v_pick_count
    from room_picks
    where room_id = v_room.id;

  if v_pick_count < 2 then
    return query select v_room.code, false;
    return;
  end if;

  delete from match_votes
    where match_id in (
      select id
      from battle_matches
      where room_id = v_room.id
    );

  delete from battle_matches
    where room_id = v_room.id;

  update room_picks
    set eliminated_at_round = null
    where room_id = v_room.id;

  select left_pick_id, right_pick_id
    into v_left_pick_id, v_right_pick_id
    from (
      select rp.id as left_pick_id,
             lead(rp.id) over () as right_pick_id
        from (
          select id
          from room_picks
          where room_id = v_room.id
          order by random()
          limit 2
        ) rp
    ) next_picks
    where right_pick_id is not null
    limit 1;

  insert into battle_matches (room_id, round, left_pick_id, right_pick_id)
  values (v_room.id, 1, v_left_pick_id, v_right_pick_id);

  update rooms
    set status = 'battle',
        current_round = 1
    where id = v_room.id;

  return query select v_room.code, true;
end;
$$;

create or replace function public.cast_match_vote(
  p_match_id uuid,
  p_member_id uuid,
  p_pick_id uuid
)
returns table (
  room_code text,
  advanced boolean,
  completed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match battle_matches%rowtype;
  v_room rooms%rowtype;
  v_member_count integer;
  v_majority integer;
  v_vote_count integer;
  v_loser_pick_id uuid;
  v_available_count integer;
  v_next_left_pick_id uuid;
  v_next_right_pick_id uuid;
  v_next_round integer;
begin
  select *
    into v_match
    from battle_matches
    where id = p_match_id
    for update;

  if not found then
    raise exception 'Match % was not found', p_match_id;
  end if;

  if v_match.winner_pick_id is not null then
    select * into v_room from rooms where id = v_match.room_id;
    return query select v_room.code, false, v_room.status = 'complete';
    return;
  end if;

  if p_pick_id not in (v_match.left_pick_id, v_match.right_pick_id) then
    raise exception 'Pick % is not in match %', p_pick_id, p_match_id;
  end if;

  insert into match_votes (match_id, member_id, pick_id)
  values (p_match_id, p_member_id, p_pick_id)
  on conflict (match_id, member_id) do nothing;

  select count(*)
    into v_member_count
    from room_members
    where room_id = v_match.room_id;

  v_majority := floor(v_member_count / 2) + 1;

  select count(*)
    into v_vote_count
    from match_votes
    where match_id = p_match_id
      and pick_id = p_pick_id;

  select *
    into v_room
    from rooms
    where id = v_match.room_id
    for update;

  if v_vote_count < v_majority then
    return query select v_room.code, false, false;
    return;
  end if;

  v_loser_pick_id := case
    when v_match.left_pick_id = p_pick_id then v_match.right_pick_id
    else v_match.left_pick_id
  end;

  update battle_matches
    set winner_pick_id = p_pick_id,
        completed_at = now()
    where id = p_match_id
      and winner_pick_id is null;

  update room_picks
    set eliminated_at_round = v_match.round
    where id = v_loser_pick_id;

  select count(*)
    into v_available_count
    from room_picks rp
    where rp.room_id = v_match.room_id
      and rp.eliminated_at_round is null;

  if v_available_count <= 1 then
    update rooms
      set status = 'complete'
      where id = v_match.room_id;

    return query select v_room.code, true, true;
    return;
  end if;

  v_next_round := v_match.round + 1;

  select left_pick_id, right_pick_id
    into v_next_left_pick_id, v_next_right_pick_id
    from (
      select rp.id as left_pick_id,
             lead(rp.id) over () as right_pick_id
        from (
          select id
          from room_picks
          where room_id = v_match.room_id
            and eliminated_at_round is null
          order by random()
          limit 2
        ) rp
    ) next_picks
    where right_pick_id is not null
    limit 1;

  insert into battle_matches (room_id, round, left_pick_id, right_pick_id)
  values (v_match.room_id, v_next_round, v_next_left_pick_id, v_next_right_pick_id);

  update rooms
    set status = 'battle',
        current_round = v_next_round
    where id = v_match.room_id;

  return query select v_room.code, true, false;
end;
$$;

create or replace function public.reset_room_battle(
  p_room_code text,
  p_member_id uuid
)
returns table (
  room_code text,
  reset boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
begin
  select *
    into v_room
    from rooms
    where code = p_room_code
    for update;

  if not found then
    raise exception 'Room % was not found.', p_room_code;
  end if;

  if not exists (
    select 1
    from room_members
    where room_id = v_room.id
      and id = p_member_id
      and is_host = true
  ) then
    raise exception 'Only the host can reset the battle.';
  end if;

  delete from match_votes
    where match_id in (
      select id
      from battle_matches
      where room_id = v_room.id
    );

  delete from battle_matches
    where room_id = v_room.id;

  update room_picks
    set eliminated_at_round = null
    where room_id = v_room.id;

  update rooms
    set status = 'collecting',
        current_round = 0
    where id = v_room.id;

  return query select v_room.code, true;
end;
$$;

create or replace function public.resolve_match_tie(
  p_match_id uuid,
  p_member_id uuid,
  p_pick_id uuid
)
returns table (
  room_code text,
  resolved boolean,
  completed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match battle_matches%rowtype;
  v_room rooms%rowtype;
  v_member_count integer;
  v_vote_count integer;
  v_majority integer;
  v_left_vote_count integer;
  v_right_vote_count integer;
  v_loser_pick_id uuid;
  v_available_count integer;
  v_next_left_pick_id uuid;
  v_next_right_pick_id uuid;
  v_next_round integer;
begin
  select *
    into v_match
    from battle_matches
    where id = p_match_id
    for update;

  if not found then
    raise exception 'Match % was not found', p_match_id;
  end if;

  select *
    into v_room
    from rooms
    where id = v_match.room_id
    for update;

  if not exists (
    select 1
    from room_members
    where room_id = v_match.room_id
      and id = p_member_id
      and is_host = true
  ) then
    raise exception 'Only the host can resolve a tie.';
  end if;

  if v_match.winner_pick_id is not null then
    return query select v_room.code, false, v_room.status = 'complete';
    return;
  end if;

  if p_pick_id not in (v_match.left_pick_id, v_match.right_pick_id) then
    raise exception 'Pick % is not in match %', p_pick_id, p_match_id;
  end if;

  select count(*)
    into v_member_count
    from room_members
    where room_id = v_match.room_id;

  select count(*)
    into v_vote_count
    from match_votes
    where match_id = p_match_id;

  if v_vote_count < v_member_count then
    return query select v_room.code, false, false;
    return;
  end if;

  v_majority := floor(v_member_count / 2) + 1;

  select count(*)
    into v_left_vote_count
    from match_votes
    where match_id = p_match_id
      and pick_id = v_match.left_pick_id;

  select count(*)
    into v_right_vote_count
    from match_votes
    where match_id = p_match_id
      and pick_id = v_match.right_pick_id;

  if v_left_vote_count >= v_majority or v_right_vote_count >= v_majority then
    return query select v_room.code, false, false;
    return;
  end if;

  v_loser_pick_id := case
    when v_match.left_pick_id = p_pick_id then v_match.right_pick_id
    else v_match.left_pick_id
  end;

  update battle_matches
    set winner_pick_id = p_pick_id,
        completed_at = now()
    where id = p_match_id
      and winner_pick_id is null;

  update room_picks
    set eliminated_at_round = v_match.round
    where id = v_loser_pick_id;

  select count(*)
    into v_available_count
    from room_picks
    where room_id = v_match.room_id
      and eliminated_at_round is null;

  if v_available_count <= 1 then
    update rooms
      set status = 'complete'
      where id = v_match.room_id;

    return query select v_room.code, true, true;
    return;
  end if;

  v_next_round := v_match.round + 1;

  select left_pick_id, right_pick_id
    into v_next_left_pick_id, v_next_right_pick_id
    from (
      select rp.id as left_pick_id,
             lead(rp.id) over () as right_pick_id
        from (
          select id
          from room_picks
          where room_id = v_match.room_id
            and eliminated_at_round is null
          order by random()
          limit 2
        ) rp
    ) next_picks
    where right_pick_id is not null
    limit 1;

  insert into battle_matches (room_id, round, left_pick_id, right_pick_id)
  values (v_match.room_id, v_next_round, v_next_left_pick_id, v_next_right_pick_id);

  update rooms
    set status = 'battle',
        current_round = v_next_round
    where id = v_match.room_id;

  return query select v_room.code, true, false;
end;
$$;

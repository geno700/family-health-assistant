-- Family Health Assistant / منظّم صحة البيت — database for the shared "github apps" project.
-- Everything lives in schema fha. Safe to run again (if not exists / or replace / drop policy if exists).
--
-- Privacy: health content is encrypted in the browser with the household's family key.
-- records.cipher / records.iv are all the server ever gets; it cannot read names, medicines
-- or doses. Plain here: household name, membership, roles, record kind and timestamps.
--
-- After running: Dashboard > Project Settings > Data API > Exposed schemas: add "fha".

create schema if not exists fha;

-- ======================================================================
-- Tables
-- ======================================================================

create table if not exists fha.groups (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 60),
  join_code         text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  key_check_cipher  text not null,   -- encrypted test value: proves a typed family key is right
  key_check_iv      text not null,
  disabled          boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists fha.members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references fha.groups(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'viewer' check (role in ('owner', 'admin', 'caregiver', 'patient', 'viewer')),
  status        text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  person_id     uuid,                -- the family member a patient account is (records.id of kind person)
  display_name  text not null default '' check (char_length(display_name) <= 60),
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  unique (group_id, user_id),
  check (role <> 'patient' or person_id is not null or status <> 'active')
);
create index if not exists members_user_idx on fha.members(user_id);

create table if not exists fha.records (
  id          uuid primary key,
  group_id    uuid not null references fha.groups(id) on delete cascade,
  kind        text not null check (kind in ('person', 'medicine', 'dose_log', 'stock', 'appointment', 'paper')),
  person_id   uuid not null,         -- random id of the family member it belongs to (for permissions)
  cipher      text not null check (char_length(cipher) between 16 and 200000),
  iv          text not null check (char_length(iv) between 12 and 32),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null default auth.uid(),
  deleted_at  timestamptz
);
create index if not exists records_group_idx on fha.records(group_id) where deleted_at is null;

create table if not exists fha.activity_log (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references fha.groups(id) on delete cascade,
  action         text not null,       -- insert / update / delete / member_approved / role_changed / …
  kind           text,
  record_id      uuid,
  before_cipher  text, before_iv text, -- record changes stay encrypted: readable only by the family
  after_cipher   text, after_iv text,
  detail         jsonb,               -- membership changes: names and roles only, never health data
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null default auth.uid()
);
create index if not exists activity_group_idx on fha.activity_log(group_id, created_at desc);

create table if not exists fha.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ======================================================================
-- Permission helpers (security definer, fixed search_path)
-- ======================================================================

create or replace function fha.is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = fha, pg_temp as $$
  select exists (
    select 1 from fha.members m join fha.groups g on g.id = m.group_id
    where m.group_id = p_group and m.user_id = auth.uid() and m.status = 'active' and not g.disabled);
$$;

create or replace function fha.has_role(p_group uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = fha, pg_temp as $$
  select exists (
    select 1 from fha.members m join fha.groups g on g.id = m.group_id
    where m.group_id = p_group and m.user_id = auth.uid() and m.status = 'active'
      and not g.disabled and m.role = any (p_roles));
$$;

-- The family member a patient account may see and mark doses for (null for other roles).
create or replace function fha.my_person(p_group uuid) returns uuid
language sql stable security definer set search_path = fha, pg_temp as $$
  select person_id from fha.members
  where group_id = p_group and user_id = auth.uid() and status = 'active' and role = 'patient';
$$;

create or replace function fha.is_platform_admin() returns boolean
language sql stable security definer set search_path = fha, pg_temp as $$
  select exists (select 1 from fha.platform_admins where user_id = auth.uid());
$$;

create or replace function fha.new_join_code() returns text
language plpgsql volatile security definer set search_path = fha, pg_temp as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from fha.groups where join_code = code);
  end loop;
  return code;
end $$;

create or replace function fha.log_event(p_group uuid, p_action text, p_detail jsonb) returns void
language sql volatile security definer set search_path = fha, pg_temp as $$
  insert into fha.activity_log(group_id, action, detail) values (p_group, p_action, p_detail);
$$;

-- ======================================================================
-- Row Level Security
-- ======================================================================

alter table fha.groups enable row level security;
alter table fha.members enable row level security;
alter table fha.records enable row level security;
alter table fha.activity_log enable row level security;
alter table fha.platform_admins enable row level security; -- no policies: only definer functions read it

-- groups: visible to its active and waiting members (waiting members see the name only in the UI).
-- No direct writes: create / rename / delete go through the functions below.
drop policy if exists groups_select on fha.groups;
create policy groups_select on fha.groups for select to authenticated
  using (exists (select 1 from fha.members m where m.group_id = groups.id and m.user_id = auth.uid() and m.status in ('active', 'pending')));

-- members: your own rows, plus everyone in households where you are active. No direct writes.
drop policy if exists members_select on fha.members;
create policy members_select on fha.members for select to authenticated
  using (user_id = auth.uid() or fha.is_member(group_id));

-- records: members read (a patient only their own person); owner/admin/caregiver write;
-- a patient writes only dose logs for their own person. Delete = set deleted_at (an update).
drop policy if exists records_select on fha.records;
create policy records_select on fha.records for select to authenticated
  using (fha.is_member(group_id) and (fha.my_person(group_id) is null or person_id = fha.my_person(group_id)));

drop policy if exists records_insert on fha.records;
create policy records_insert on fha.records for insert to authenticated
  with check (
    fha.has_role(group_id, array['owner', 'admin', 'caregiver'])
    or (kind = 'dose_log' and fha.has_role(group_id, array['patient']) and person_id = fha.my_person(group_id)));

drop policy if exists records_update on fha.records;
create policy records_update on fha.records for update to authenticated
  using (
    fha.has_role(group_id, array['owner', 'admin', 'caregiver'])
    or (kind = 'dose_log' and fha.has_role(group_id, array['patient']) and person_id = fha.my_person(group_id)))
  with check (
    fha.has_role(group_id, array['owner', 'admin', 'caregiver'])
    or (kind = 'dose_log' and fha.has_role(group_id, array['patient']) and person_id = fha.my_person(group_id)));

-- activity_log: read through fha.list_activity (admins); written only by triggers/functions.
drop policy if exists activity_select on fha.activity_log;
create policy activity_select on fha.activity_log for select to authenticated
  using (fha.has_role(group_id, array['owner', 'admin']));

-- ======================================================================
-- Record bookkeeping and activity log (trigger)
-- ======================================================================

create or replace function fha.records_before() returns trigger
language plpgsql security definer set search_path = fha, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
    new.version := 1;
  else
    if new.group_id <> old.group_id or new.kind <> old.kind then
      raise exception 'records cannot move between households or kinds' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_before on fha.records;
create trigger records_before before insert or update on fha.records
  for each row execute function fha.records_before();

create or replace function fha.records_after() returns trigger
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  act text;
begin
  if tg_op = 'INSERT' then act := 'insert';
  elsif new.deleted_at is not null and old.deleted_at is null then act := 'delete';
  elsif new.deleted_at is null and old.deleted_at is not null then act := 'insert';
  else act := 'update';
  end if;
  insert into fha.activity_log(group_id, action, kind, record_id, before_cipher, before_iv, after_cipher, after_iv)
  values (new.group_id, act, new.kind, new.id,
          case when tg_op = 'UPDATE' then old.cipher end, case when tg_op = 'UPDATE' then old.iv end,
          case when act <> 'delete' then new.cipher end, case when act <> 'delete' then new.iv end);
  return null;
end $$;

drop trigger if exists records_after on fha.records;
create trigger records_after after insert or update on fha.records
  for each row execute function fha.records_after();

-- ======================================================================
-- Household functions (each checks the caller's rights itself)
-- ======================================================================

create or replace function fha.create_group(p_name text, p_key_check_cipher text, p_key_check_iv text, p_display_name text)
returns fha.groups language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  g fha.groups;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into fha.groups(name, join_code, key_check_cipher, key_check_iv, created_by)
  values (btrim(p_name), fha.new_join_code(), p_key_check_cipher, p_key_check_iv, auth.uid())
  returning * into g;
  insert into fha.members(group_id, user_id, role, status, display_name, created_by)
  values (g.id, auth.uid(), 'owner', 'active', left(coalesce(p_display_name, ''), 60), auth.uid());
  perform fha.log_event(g.id, 'group_created', null);
  return g;
end $$;

-- Returns the household name, or null if the code doesn't exist. The request waits for approval.
create or replace function fha.join_group(p_code text, p_display_name text) returns text
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  g fha.groups;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into g from fha.groups where join_code = upper(btrim(p_code)) and not disabled;
  if not found then return null; end if;
  insert into fha.members(group_id, user_id, role, status, display_name, created_by)
  values (g.id, auth.uid(), 'viewer', 'pending', left(coalesce(p_display_name, ''), 60), auth.uid())
  on conflict (group_id, user_id) do update
    set status = case when fha.members.status = 'removed' then 'pending' else fha.members.status end,
        role = case when fha.members.status = 'removed' then 'viewer' else fha.members.role end;
  return g.name;
end $$;

create or replace function fha.list_members(p_group uuid)
returns table (id uuid, group_id uuid, user_id uuid, role text, status text, person_id uuid, display_name text, created_at timestamptz, email text)
language plpgsql stable security definer set search_path = fha, pg_temp as $$
begin
  if not fha.is_member(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select m.id, m.group_id, m.user_id, m.role, m.status, m.person_id, m.display_name, m.created_at,
           case when fha.has_role(p_group, array['owner', 'admin']) then u.email::text end
    from fha.members m join auth.users u on u.id = m.user_id
    where m.group_id = p_group and m.status <> 'removed'
    order by m.created_at;
end $$;

-- Shared checks for approve / set_role: caller is owner/admin of the member's household,
-- the role is not owner, and a patient is linked to a person record of that household.
create or replace function fha.check_role_change(p_member uuid, p_role text, p_person uuid) returns fha.members
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  m fha.members;
begin
  select * into m from fha.members where id = p_member;
  if not found or not fha.has_role(m.group_id, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'caregiver', 'patient', 'viewer') or m.role = 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role = 'patient' and not exists (
      select 1 from fha.records where id = p_person and group_id = m.group_id and kind = 'person' and deleted_at is null) then
    raise exception 'a patient must be linked to a family member' using errcode = '22023';
  end if;
  return m;
end $$;

create or replace function fha.approve_member(p_member uuid, p_role text, p_person uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  m fha.members;
begin
  m := fha.check_role_change(p_member, p_role, p_person);
  if m.status <> 'pending' then raise exception 'not waiting' using errcode = '22023'; end if;
  update fha.members set status = 'active', role = p_role,
         person_id = case when p_role = 'patient' then p_person end
  where id = p_member;
  perform fha.log_event(m.group_id, 'member_approved', jsonb_build_object('member', m.display_name, 'role', p_role));
end $$;

create or replace function fha.set_role(p_member uuid, p_role text, p_person uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  m fha.members;
begin
  m := fha.check_role_change(p_member, p_role, p_person);
  if m.user_id = auth.uid() then raise exception 'not allowed' using errcode = '42501'; end if;
  -- An admin can't demote another admin; only the owner can
  if m.role = 'admin' and not fha.has_role(m.group_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update fha.members set role = p_role, person_id = case when p_role = 'patient' then p_person end where id = p_member;
  perform fha.log_event(m.group_id, 'role_changed', jsonb_build_object('member', m.display_name, 'from', m.role, 'to', p_role));
end $$;

create or replace function fha.reject_member(p_member uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  m fha.members;
begin
  select * into m from fha.members where id = p_member;
  if not found or not fha.has_role(m.group_id, array['owner', 'admin']) or m.status <> 'pending' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update fha.members set status = 'removed' where id = p_member;
  perform fha.log_event(m.group_id, 'member_rejected', jsonb_build_object('member', m.display_name));
end $$;

create or replace function fha.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  m fha.members;
begin
  select * into m from fha.members where id = p_member;
  if not found or not fha.has_role(m.group_id, array['owner', 'admin']) or m.role = 'owner' or m.user_id = auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if m.role = 'admin' and not fha.has_role(m.group_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update fha.members set status = 'removed' where id = p_member;
  perform fha.log_event(m.group_id, 'member_removed', jsonb_build_object('member', m.display_name));
end $$;

create or replace function fha.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  m fha.members;
begin
  select * into m from fha.members where group_id = p_group and user_id = auth.uid() and status <> 'removed';
  if not found then return; end if;
  if m.role = 'owner' then raise exception 'the owner must transfer ownership first' using errcode = '42501'; end if;
  update fha.members set status = 'removed' where id = m.id;
  perform fha.log_event(p_group, 'member_left', jsonb_build_object('member', m.display_name));
end $$;

create or replace function fha.regenerate_join_code(p_group uuid) returns text
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  code text;
begin
  if not fha.has_role(p_group, array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  code := fha.new_join_code();
  update fha.groups set join_code = code where id = p_group;
  perform fha.log_event(p_group, 'join_code_changed', null);
  return code;
end $$;

create or replace function fha.rename_group(p_group uuid, p_name text) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  old_name text;
begin
  if not fha.has_role(p_group, array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  select name into old_name from fha.groups where id = p_group;
  update fha.groups set name = btrim(p_name) where id = p_group;
  perform fha.log_event(p_group, 'group_renamed', jsonb_build_object('from', old_name, 'to', btrim(p_name)));
end $$;

create or replace function fha.transfer_ownership(p_group uuid, p_member uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
declare
  target fha.members;
begin
  if not fha.has_role(p_group, array['owner']) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into target from fha.members where id = p_member and group_id = p_group and status = 'active';
  if not found or target.user_id = auth.uid() then raise exception 'not allowed' using errcode = '42501'; end if;
  update fha.members set role = 'admin' where group_id = p_group and user_id = auth.uid();
  update fha.members set role = 'owner', person_id = null where id = p_member;
  perform fha.log_event(p_group, 'ownership_transferred', jsonb_build_object('to', target.display_name));
end $$;

create or replace function fha.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
begin
  if not fha.has_role(p_group, array['owner']) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from fha.groups where id = p_group; -- members, records and activity go with it (cascade)
end $$;

create or replace function fha.list_activity(p_group uuid, p_limit integer default 100)
returns table (id uuid, group_id uuid, user_id uuid, user_name text, at timestamptz, action text, kind text, record_id uuid,
               before_cipher text, before_iv text, after_cipher text, after_iv text, detail jsonb)
language plpgsql stable security definer set search_path = fha, pg_temp as $$
begin
  if not fha.has_role(p_group, array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.id, a.group_id, a.created_by, coalesce(m.display_name, ''), a.created_at, a.action, a.kind, a.record_id,
           a.before_cipher, a.before_iv, a.after_cipher, a.after_iv, a.detail
    from fha.activity_log a
    left join fha.members m on m.group_id = a.group_id and m.user_id = a.created_by
    where a.group_id = p_group
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

-- ======================================================================
-- Platform owner (#/owner): counts and names only, never health content
-- ======================================================================

create or replace function fha.owner_stats() returns json
language plpgsql stable security definer set search_path = fha, pg_temp as $$
begin
  if not fha.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'groups', (select count(*) from fha.groups),
    'users', (select count(distinct user_id) from fha.members where status = 'active'),
    'week_activity', (select count(*) from fha.activity_log where created_at > now() - interval '7 days'));
end $$;

create or replace function fha.owner_groups(p_search text default '')
returns table (id uuid, name text, disabled boolean, created_at timestamptz, members bigint, records bigint, last_activity timestamptz)
language plpgsql stable security definer set search_path = fha, pg_temp as $$
begin
  if not fha.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select g.id, g.name, g.disabled, g.created_at,
           (select count(*) from fha.members m where m.group_id = g.id and m.status = 'active'),
           (select count(*) from fha.records r where r.group_id = g.id and r.deleted_at is null),
           (select max(a.created_at) from fha.activity_log a where a.group_id = g.id)
    from fha.groups g
    where coalesce(p_search, '') = '' or g.name ilike '%' || p_search || '%'
    order by g.created_at desc
    limit 200;
end $$;

create or replace function fha.owner_set_disabled(p_group uuid, p_disabled boolean) returns void
language plpgsql security definer set search_path = fha, pg_temp as $$
begin
  if not fha.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update fha.groups set disabled = p_disabled where id = p_group;
  perform fha.log_event(p_group, case when p_disabled then 'group_disabled' else 'group_enabled' end, null);
end $$;

-- ======================================================================
-- Papers (phase 3): photos and PDFs, encrypted in the browser, in a private Storage bucket.
-- Path: <household id>/<person id>/<file id>. Same rules as records: members read (a patient
-- only their own person), owner/admin/caregiver add and remove. The bucket only accepts
-- application/octet-stream, i.e. the encrypted bytes; the server never sees a readable image.
-- ======================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fha-papers', 'fha-papers', false, 6291456, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function fha.paper_path_ok(p_name text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = fha, pg_temp as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  g uuid;
  p uuid;
begin
  if coalesce(array_length(parts, 1), 0) <> 3 or parts[1] !~ uuid_re or parts[2] !~ uuid_re or parts[3] !~ uuid_re then
    return false;
  end if;
  g := parts[1]::uuid;
  p := parts[2]::uuid;
  if p_write then return fha.has_role(g, array['owner', 'admin', 'caregiver']); end if;
  return fha.is_member(g) and (fha.my_person(g) is null or p = fha.my_person(g));
end $$;

drop policy if exists fha_papers_select on storage.objects;
create policy fha_papers_select on storage.objects for select to authenticated
  using (bucket_id = 'fha-papers' and fha.paper_path_ok(name, false));
drop policy if exists fha_papers_insert on storage.objects;
create policy fha_papers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fha-papers' and fha.paper_path_ok(name, true));
drop policy if exists fha_papers_delete on storage.objects;
create policy fha_papers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fha-papers' and fha.paper_path_ok(name, true));

-- ======================================================================
-- Grants: signed-in users only (anon gets nothing); RLS and the functions do the rest
-- ======================================================================

grant usage on schema fha to authenticated;
revoke all on all tables in schema fha from anon;
revoke all on all functions in schema fha from anon, public;
grant select on fha.groups, fha.members, fha.activity_log to authenticated;
grant select, insert, update on fha.records to authenticated;
grant execute on all functions in schema fha to authenticated;
-- Internal helpers are not callable from the browser (they skip permission checks or are triggers)
revoke execute on function fha.log_event(uuid, text, jsonb) from authenticated;
revoke execute on function fha.new_join_code() from authenticated;
revoke execute on function fha.check_role_change(uuid, text, uuid) from authenticated;
revoke execute on function fha.records_before() from authenticated;
revoke execute on function fha.records_after() from authenticated;

-- To make yourself platform owner (run once, with your own user id from Authentication > Users):
-- insert into fha.platform_admins(user_id) values ('00000000-0000-0000-0000-000000000000') on conflict do nothing;

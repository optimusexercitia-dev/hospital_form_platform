-- Cases-Extras batch / R3: flexible case TAGGING (trends / yearly reporting).
--
-- A controlled per-commission vocabulary so yearly aggregation stays clean
-- (a single free-text label would not aggregate). Purely additive.
--
-- public.case_tags — the commission's tag vocabulary (unique(commission_id,name),
--   color_token, archivable). RLS member-read / staff_admin-write.
-- public.case_tag_assignments — the (case_id, tag_id) join; a BEFORE INSERT guard
--   asserts the tag and case share a commission (HC026) — cheaper than a
--   composite FK. RLS member-read / staff_admin-write.
--
-- Writes go through RPCs (create/rename/archive_case_tag, assign/unassign),
-- gated by cases_extras + is_staff_admin_of (consistent with the R2 status CRUD).
-- The reporting read case_tag_report mirrors dashboard_form_totals (SECURITY
-- DEFINER + is_staff_admin_of gate + optional date window over
-- cases.created_at::date).
--
-- New SQLSTATE:
--   HC026 tag/case commission mismatch.

-- ===========================================================================
-- public.case_tags — per-commission vocabulary
-- ===========================================================================
create table public.case_tags (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  name text not null,
  color_token text not null default 'muted'
    check (color_token in ('muted', 'slate', 'blue', 'amber', 'green', 'red', 'violet')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint case_tags_commission_name_key unique (commission_id, name),
  constraint case_tags_name_not_blank check (btrim(name) <> '')
);

alter table public.case_tags enable row level security;
create index case_tags_commission_idx on public.case_tags (commission_id);

-- ===========================================================================
-- public.case_tag_assignments — (case, tag) join
-- ===========================================================================
create table public.case_tag_assignments (
  case_id uuid not null references public.cases (id) on delete cascade,
  tag_id uuid not null references public.case_tags (id) on delete cascade,
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  primary key (case_id, tag_id)
);

alter table public.case_tag_assignments enable row level security;
create index case_tag_assignments_tag_idx on public.case_tag_assignments (tag_id);

-- ===========================================================================
-- app.guard_case_tag_assignment — BEFORE INSERT: tag & case share a commission
-- ===========================================================================
-- Cheaper than a composite FK and gives a clean HC026. SECURITY DEFINER so it
-- reads both parents regardless of the caller's RLS (the assign RPC has already
-- confirmed staff_admin rights).
create function app.guard_case_tag_assignment()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_commission uuid;
  v_tag_commission uuid;
begin
  select commission_id into v_case_commission from public.cases where id = new.case_id;
  select commission_id into v_tag_commission from public.case_tags where id = new.tag_id;

  if v_case_commission is null or v_tag_commission is null
     or v_case_commission <> v_tag_commission then
    raise exception 'esta etiqueta não pertence à comissão deste caso'
      using errcode = 'HC026';
  end if;

  return new;
end;
$$;

create trigger guard_case_tag_assignment_trg
  before insert on public.case_tag_assignments
  for each row execute function app.guard_case_tag_assignment();

-- ===========================================================================
-- RLS — members read, staff_admin write
-- ===========================================================================
create policy case_tags_select on public.case_tags
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy case_tags_staff_admin_write on public.case_tags
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

create policy case_tag_assignments_select on public.case_tag_assignments
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_tag_assignments_staff_admin_write on public.case_tag_assignments
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );

-- ===========================================================================
-- Vocabulary CRUD RPCs (SECURITY INVOKER; RLS authority + explicit gate)
-- ===========================================================================
-- create_case_tag(commission, name, color_token) -> case_tags
create function public.create_case_tag(
  p_commission_id uuid,
  p_name text,
  p_color_token text default 'muted'
)
returns public.case_tags
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome da etiqueta' using errcode = 'check_violation';
  end if;

  insert into public.case_tags (commission_id, name, color_token)
  values (p_commission_id, btrim(p_name), p_color_token)
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_case_tag(uuid, text, text) to authenticated, service_role;
revoke all on function public.create_case_tag(uuid, text, text) from public, anon;

-- rename_case_tag(tag_id, name, color_token) -> case_tags
create function public.rename_case_tag(
  p_tag_id uuid,
  p_name text,
  p_color_token text
)
returns public.case_tags
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id from public.case_tags where id = p_tag_id;
  if v_commission_id is null then
    raise exception 'etiqueta não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome da etiqueta' using errcode = 'check_violation';
  end if;

  update public.case_tags
  set name = btrim(p_name), color_token = p_color_token
  where id = p_tag_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.rename_case_tag(uuid, text, text) to authenticated, service_role;
revoke all on function public.rename_case_tag(uuid, text, text) from public, anon;

-- archive_case_tag(tag_id) -> case_tags
create function public.archive_case_tag(p_tag_id uuid)
returns public.case_tags
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id from public.case_tags where id = p_tag_id;
  if v_commission_id is null then
    raise exception 'etiqueta não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_tags set archived = true where id = p_tag_id returning * into v_result;
  return v_result;
end;
$$;

grant execute on function public.archive_case_tag(uuid) to authenticated, service_role;
revoke all on function public.archive_case_tag(uuid) from public, anon;

-- ===========================================================================
-- Assignment RPCs
-- ===========================================================================
-- assign_case_tag(case_id, tag_id) -> void. Idempotent on the PK; the BEFORE
-- INSERT guard enforces same-commission (HC026). assigned_by = the caller.
create function public.assign_case_tag(p_case_id uuid, p_tag_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  insert into public.case_tag_assignments (case_id, tag_id, assigned_by)
  values (p_case_id, p_tag_id, auth.uid())
  on conflict (case_id, tag_id) do nothing;
end;
$$;

grant execute on function public.assign_case_tag(uuid, uuid) to authenticated, service_role;
revoke all on function public.assign_case_tag(uuid, uuid) from public, anon;

-- unassign_case_tag(case_id, tag_id) -> void.
create function public.unassign_case_tag(p_case_id uuid, p_tag_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.case_tag_assignments
  where case_id = p_case_id and tag_id = p_tag_id;
end;
$$;

grant execute on function public.unassign_case_tag(uuid, uuid) to authenticated, service_role;
revoke all on function public.unassign_case_tag(uuid, uuid) from public, anon;

-- ===========================================================================
-- case_tag_report(commission, from, to) -> per-tag case counts
-- ===========================================================================
-- SECURITY DEFINER, internally is_staff_admin_of/admin-gated (mirror
-- dashboard_form_totals). Per NON-archived tag: the count of DISTINCT cases
-- assigned that tag whose created_at::date falls in the optional [from,to]
-- window. Returns nothing to a non-staff_admin (no leak). status_position is not
-- relevant here; ordered by case_count desc then name. Reads do NOT gate
-- cases_extras (a dark feature returns an empty report).
create function public.case_tag_report(
  p_commission_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  tag_id uuid,
  name text,
  color_token text,
  case_count bigint
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select t.id,
         t.name,
         t.color_token,
         count(distinct c.id) as case_count
  from public.case_tags t
  left join public.case_tag_assignments ta on ta.tag_id = t.id
  left join public.cases c
    on c.id = ta.case_id
   and (p_from is null or c.created_at::date >= p_from)
   and (p_to   is null or c.created_at::date <= p_to)
  where t.commission_id = p_commission_id
    and not t.archived
  group by t.id, t.name, t.color_token
  order by count(distinct c.id) desc, t.name;
end;
$$;

grant execute on function public.case_tag_report(uuid, date, date) to authenticated, service_role;
revoke all on function public.case_tag_report(uuid, date, date) from public, anon;

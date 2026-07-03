-- =============================================================================
-- Phase A · A1 — Committee member titles (ADR 0051 Decision 6)
-- =============================================================================
-- A FIFTH per-commission vocabulary (Presidente / Vice-Presidente /
-- Secretário(a) …), cloning the commission_meeting_types pattern. DISPLAY-ONLY:
-- a title carries ZERO access semantics — a titled `staff` gains no extra rights.
-- Rendered on the member-management page, member overview, meeting attendee lists
-- and signature blocks / exported atas.
--
-- Policies here intentionally use `is_org_admin_of_commission` (the pre-swap OR-
-- term) so the A2 mechanical swap catches them uniformly with every other
-- commission-scoped policy; after A2 they read `is_commission_admin_of` and a
-- hospital_admin inherits management of its hospital's commissions' titles.
-- =============================================================================

-- 1. The vocabulary table (vocab clone — no color_token/archived; titles are
--    simpler than meeting types: a name + a sort position, hard-deleted with a
--    SET NULL on assignments).
create table if not exists public.commission_member_titles (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_member_titles_name_not_blank check (btrim(name) <> '')
);
alter table public.commission_member_titles owner to postgres;

comment on table public.commission_member_titles is
  'Per-commission member-title vocabulary (ADR 0051 Decision 6). DISPLAY-ONLY — zero RLS/access semantics. Managed by the commission staff_admin (admins inherit via is_commission_admin_of). Auto-seeded Presidente/Vice-Presidente/Secretário(a) on commission create.';

alter table only public.commission_member_titles
  add constraint commission_member_titles_commission_name_key
  unique (commission_id, name);
-- DEFERRABLE like the other vocabs so a reorder can shuffle positions in one txn.
alter table only public.commission_member_titles
  add constraint commission_member_titles_commission_position_key
  unique (commission_id, position) deferrable;

create index if not exists commission_member_titles_commission_idx
  on public.commission_member_titles using btree (commission_id);

grant all on table public.commission_member_titles to authenticated;
grant all on table public.commission_member_titles to service_role;

-- 2. The assignment column (nullable; one title per member; ON DELETE SET NULL so
--    deleting a title clears the assignment rather than blocking the delete).
alter table public.commission_members
  add column if not exists title_id uuid
  references public.commission_member_titles(id) on delete set null;

comment on column public.commission_members.title_id is
  'Optional DISPLAY-ONLY committee title (ADR 0051). One per member; must belong to the member''s commission (guarded). Zero access semantics — never referenced by any RLS predicate.';

-- 3. Same-commission integrity: a member's title must belong to the member's
--    commission (a CHECK cannot sub-query → BEFORE INS/UPD trigger).
create or replace function app.guard_member_title_commission()
  returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if new.title_id is not null then
    if (select commission_id from public.commission_member_titles where id = new.title_id)
       is distinct from new.commission_id then
      raise exception 'title % does not belong to commission %',
        new.title_id, new.commission_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
alter function app.guard_member_title_commission() owner to postgres;

comment on function app.guard_member_title_commission() is
  'Same-commission integrity for commission_members.title_id (ADR 0051): a member''s title must belong to the member''s commission. Raises check_violation otherwise.';

drop trigger if exists guard_member_title_commission_trg on public.commission_members;
create trigger guard_member_title_commission_trg
  before insert or update on public.commission_members
  for each row execute function app.guard_member_title_commission();

-- 4. RLS. Member-read, commission-admin-write (the A2 swap converts the OR-term to
--    is_commission_admin_of). DISPLAY-ONLY — mirrors meeting_types exactly.
alter table public.commission_member_titles enable row level security;

create policy "member_titles_select" on public.commission_member_titles
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_org_admin_of_commission(commission_id));

create policy "member_titles_staff_admin_write" on public.commission_member_titles
  to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_org_admin_of_commission(commission_id))
  with check (app.is_staff_admin_of(commission_id) or app.is_org_admin_of_commission(commission_id));

-- 5. Auto-seed the defaults on commission create. A DEFINER seed fn + a SIBLING
--    AFTER-INSERT trigger (kept separate from seed_meetings_on_commission_insert
--    to keep concerns isolated — Decision 6 / plan §6).
create or replace function app.seed_default_member_titles(p_commission_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  insert into public.commission_member_titles (commission_id, name, position)
  values
    (p_commission_id, 'Presidente', 1),
    (p_commission_id, 'Vice-Presidente', 2),
    (p_commission_id, 'Secretário(a)', 3)
  on conflict (commission_id, name) do nothing;
end;
$$;
alter function app.seed_default_member_titles(uuid) owner to postgres;

comment on function app.seed_default_member_titles(uuid) is
  'Seeds the default committee titles (Presidente/Vice-Presidente/Secretário(a)) for a new commission (ADR 0051). Editable/deletable afterward.';

create or replace function app.seed_member_titles_on_commission_insert()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.seed_default_member_titles(new.id);
  return new;
end;
$$;
alter function app.seed_member_titles_on_commission_insert() owner to postgres;

drop trigger if exists seed_member_titles_on_commission_insert_trg on public.commissions;
create trigger seed_member_titles_on_commission_insert_trg
  after insert on public.commissions
  for each row execute function app.seed_member_titles_on_commission_insert();

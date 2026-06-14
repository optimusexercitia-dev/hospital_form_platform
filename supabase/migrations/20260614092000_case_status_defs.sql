-- Cases-Extras batch / R2 (1 of 2): configurable per-commission CASE STATUS
-- vocabulary.
--
-- The macro/micro split already exists (cases.status is a macro state, separate
-- from case_phases.status), but the macro lifecycle was a hard-coded 3-state
-- CHECK (aberto/concluido/cancelado). R2 replaces it with a per-commission,
-- coordinator-ordered status SET (which also becomes the kanban columns).
--
-- This migration lands the DATA MODEL for that:
--   * public.case_status_defs — the per-commission vocabulary (unique key +
--     DEFERRABLE unique position + a partial-unique "exactly one non-archived
--     is_initial" index), RLS member-read / staff_admin-write.
--   * app.case_status_is_terminal(commission_id, key) — the "is this status
--     final" helper that REPLACES the 'aberto' liveness literal across the cases
--     RPCs (the rewrite + literal sweep is migration 092001).
--   * app.seed_default_case_statuses(commission_id) — seeds the default set, and
--     an AFTER INSERT trigger on public.commissions that calls it (commissions
--     are created by a bare INSERT in src/lib/admin/actions.ts, NOT an RPC, so
--     the seeding hook must be a trigger — it covers both seed.sql demo
--     commissions and any created at runtime).
--   * the structural `drop constraint cases_status_check` (cases.status stays
--     text NOT NULL; validity moves into the rewritten guard in 092001).
--
-- NO DATA MIGRATION: the project is pre-launch and the DB resets from scratch,
-- so there is NO row remap and NO existing-commission backfill — a fresh
-- `supabase db reset` + seed.sql is the baseline. Default set:
--   rascunho, em_andamento [initial], em_revisao, concluido [terminal],
--   cancelado [terminal].
-- concluido/cancelado keep today's keys, so only aberto -> em_andamento is a key
-- rename to propagate (seed.sql + the pgTAP fixtures, done in this batch).
--
-- The status CRUD RPCs, set_case_status, list_case_status_defs, the guard
-- rewrite, the 'aberto'-literal liveness sweep, and the cases_extras feature
-- flag all land in 092001. ADR 0022 (cross-committee referrals) is a separate
-- doc; this batch's design lives in the R2 plan section.

-- ===========================================================================
-- public.case_status_defs — the per-commission vocabulary
-- ===========================================================================
-- key is the ASCII slug stored in cases.status (validated by the rewritten guard
-- in 092001, NOT an FK — a composite FK would fight the "archive, don't delete"
-- ethos and complicate ordering). color_token is a CONSTRAINED palette token
-- resolved to CSS in the UI (Rule 10), never raw CSS; the CHECK list mirrors the
-- CaseStatusColorToken union in src/lib/queries/case-statuses.ts. The
-- (commission_id, position) unique is DEFERRABLE INITIALLY IMMEDIATE so the
-- single-statement reorder swap tolerates a transient duplicate (mirror
-- reorder_section, ADR 0011).
create table public.case_status_defs (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  key text not null,
  label text not null,
  position integer not null,
  color_token text not null default 'muted'
    check (color_token in ('muted', 'slate', 'blue', 'amber', 'green', 'red', 'violet')),
  is_initial boolean not null default false,
  is_terminal boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_status_defs_commission_key_key unique (commission_id, key),
  constraint case_status_defs_commission_position_key
    unique (commission_id, position) deferrable initially immediate,
  -- key shape: ASCII slug (lowercase, digits, underscore) so it is safe to store
  -- in cases.status and surface in URLs/filters.
  constraint case_status_defs_key_shape check (key ~ '^[a-z0-9_]+$')
);

alter table public.case_status_defs enable row level security;
create index case_status_defs_commission_idx on public.case_status_defs (commission_id);

-- Exactly one NON-archived is_initial per commission (the status new cases enter;
-- archived rows are exempt so retiring an initial after promoting another is
-- clean). A partial unique index over the constant `true` is the standard idiom.
create unique index case_status_defs_one_initial_idx
  on public.case_status_defs (commission_id)
  where is_initial and not archived;

-- ===========================================================================
-- public.case_status_defs RLS — members read, staff_admin write
-- ===========================================================================
-- Mirrors the cases family (20260613090007): MEMBERS READ the vocabulary (so a
-- member's board/detail can resolve a status key to its label/colour), STAFF_ADMIN
-- WRITES it (+ admin everywhere). list_case_status_defs (092001) is a definer
-- read for the staff_admin board; this policy lets a plain member resolve the
-- keys their RLS-visible cases reference.
create policy case_status_defs_select on public.case_status_defs
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy case_status_defs_staff_admin_write on public.case_status_defs
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- app.case_status_is_terminal(commission_id, key) -> boolean
-- ===========================================================================
-- The "is this status FINAL" helper. SECURITY DEFINER + pinned search_path so it
-- reads the vocabulary regardless of the caller's RLS (it is invoked from the
-- already-gated guard / RPCs in 092001). This REPLACES the hard-coded 'aberto'
-- liveness literal everywhere a case's "is it live" was previously
-- `status = 'aberto'` / `status <> 'aberto'` (now `not case_status_is_terminal`).
-- An UNKNOWN key returns false (treated as non-terminal / still live): the guard
-- separately rejects an undefined NEW key (HC024), and a case can never hold a
-- key absent from its commission once seeded, so this only guards against a
-- transient lookup miss — failing toward "live" is the safe default (the guard,
-- not this helper, is the authority on legality).
create function app.case_status_is_terminal(p_commission_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    (select is_terminal from public.case_status_defs
     where commission_id = p_commission_id and key = p_key),
    false
  );
$$;

revoke all on function app.case_status_is_terminal(uuid, text) from public;
grant execute on function app.case_status_is_terminal(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- app.seed_default_case_statuses(commission_id)
-- ===========================================================================
-- Seeds the default status set for a commission. SECURITY DEFINER so it inserts
-- regardless of who created the commission (the AFTER INSERT trigger fires within
-- the commission INSERT; the inserter may be an admin via the cookie client or
-- the superuser running seed.sql). Idempotent: ON CONFLICT DO NOTHING on the
-- (commission_id, key) unique so a re-run (or a manual call) never errors.
--
-- The default vocabulary (ASCII keys; pt-BR labels):
--   1 rascunho      — draft / intake
--   2 em_andamento  — INITIAL (cases start here; renamed from the old 'aberto')
--   3 em_revisao    — under committee review
--   4 concluido     — TERMINAL (kept key; today's "concluido")
--   5 cancelado     — TERMINAL (kept key; today's "cancelado")
create function app.seed_default_case_statuses(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  insert into public.case_status_defs
    (commission_id, key, label, position, color_token, is_initial, is_terminal)
  values
    (p_commission_id, 'rascunho',     'Rascunho',      1, 'slate',  false, false),
    (p_commission_id, 'em_andamento', 'Em andamento',  2, 'blue',   true,  false),
    (p_commission_id, 'em_revisao',   'Em revisão',    3, 'amber',  false, false),
    (p_commission_id, 'concluido',    'Concluído',     4, 'green',  false, true),
    (p_commission_id, 'cancelado',    'Cancelado',     5, 'red',    false, true)
  on conflict (commission_id, key) do nothing;
end;
$$;

revoke all on function app.seed_default_case_statuses(uuid) from public;
grant execute on function app.seed_default_case_statuses(uuid) to authenticated, service_role;

-- ===========================================================================
-- Seed the default set on every new commission (AFTER INSERT trigger)
-- ===========================================================================
-- commissions are created by a bare INSERT (src/lib/admin/actions.ts), not an
-- RPC, so this trigger is the seeding hook for BOTH runtime-created commissions
-- and the seed.sql demo data. SECURITY DEFINER on the seeder above means it
-- succeeds whatever the inserter's RLS.
create function app.seed_case_statuses_on_commission_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.seed_default_case_statuses(new.id);
  return new;
end;
$$;

create trigger seed_case_statuses_on_commission_insert_trg
  after insert on public.commissions
  for each row execute function app.seed_case_statuses_on_commission_insert();

-- ===========================================================================
-- Drop the hard-coded cases.status CHECK
-- ===========================================================================
-- The inline 3-state CHECK from 20260613090004 is replaced by trigger-based
-- validation against case_status_defs (the rewritten guard in 092001). The column
-- stays `text NOT NULL`; its DEFAULT is updated in 092001 alongside the guard
-- (kept together so the default + its validator change atomically). No row remap
-- (pre-launch, from-scratch reset).
alter table public.cases drop constraint cases_status_check;

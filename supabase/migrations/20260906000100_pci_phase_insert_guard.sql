-- PCI/H1 (process-case integrity audit, finding H1) — close the `case_phases`
-- INSERT hole.
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────────
--
-- `guard_case_phase_status_trg` fired on DELETE and UPDATE ONLY. Combined with
-- `case_phases_staff_admin_write` (a FOR ALL policy) and the table-level INSERT
-- grant to `authenticated`, a staff_admin could POST a row straight to PostgREST
-- that was BORN in a terminal state — `status = 'completed'`, `completed_at` set —
-- without the transition matrix ever running. The matrix on the UPDATE arm is
-- therefore not a state machine; it is a state machine with an open back door.
--
-- It is worse than a bare integrity hole because `recompute_case_status_trg` DOES
-- fire on INSERT: a forged phase feeds the case's derived status immediately.
--
-- ── THE GATE: CLIENT ROLE **AND** NO RPC WINDOW ────────────────────────────────
--
-- Verified against the catalog before writing — `pg_proc.prosrc ~* 'insert into
-- …case_phases'` returns EXACTLY two functions, and both already set the flag
-- BEFORE their INSERT:
--
--   public.create_case_from_template   secdef=t   sets app.in_case_rpc
--   public.add_ad_hoc_phase            secdef=f   sets app.in_case_rpc
--
-- and a sweep of `src/lib` for `.from('case_phases')` with `.insert(`/`.upsert(`
-- returns ZERO app call sites — every write already routes through an RPC.
--
-- ⚠ WHY NOT GUC-ONLY (the obvious design, and the one this migration started with):
-- a bare `if not v_in_rpc then raise` fails 22 pgTAP suites. Their fixtures build
-- case states by inserting phases directly as `postgres` — e.g. 113_case_action_
-- items.sql plants a `status='active'` phase — which is legitimate privileged
-- bootstrap, not an attack. The tempting workaround (add `set_config('app.in_case_
-- rpc','on')` to those 22 files) is WORSE THAN THE PROBLEM: the flag is
-- transaction-scoped, so it would stay on for the remainder of each test and
-- silently disarm the UPDATE/DELETE arms those same suites rely on. That converts
-- a visible failure into 22 files of invisible coverage loss.
--
-- So the guard is scoped to what it actually defends against: `authenticated` and
-- `anon` — the roles that reach this table through PostgREST under RLS. That is
-- precisely the audited threat (a staff_admin POSTing a forged terminal phase past
-- a FOR ALL policy). A `postgres` connection is already omnipotent — it can
-- DISABLE TRIGGER or DROP POLICY outright — so refusing it here would buy no
-- security and cost the whole fixture layer.
--
-- `service_role` is deliberately NOT in the refusal set: it is trusted server-side
-- infrastructure that bypasses RLS by design and is never exposed to a browser.
-- The sweep above confirms no server path writes these tables directly today.
--
-- ⚠ A `status = 'pending'` birth rule was also in the first draft and IS
-- DELIBERATELY ABSENT — it fails `supabase db reset` at the seed, which inserts a
-- `completed` phase under this same GUC on purpose. Reasoning is recorded at the
-- assertion site below so the next reader does not re-derive and re-add it.
--
-- Neither problem was visible to an incremental `supabase migration up`; only a
-- full `db reset` plus the pgTAP suite surfaced them. That is why both are the
-- gate and not the convenience.
--
-- ── THE MISSING CASE-SIDE SHAPE CHECK ──────────────────────────────────────────
--
-- `process_template_phases` carries `..._result_ruleset_shape`; `case_phases`
-- carried NO twin. The snapshot half of a snapshot/source pair was unconstrained,
-- so a direct INSERT could plant a `result_ruleset` of any shape and
-- `app.compute_case_phase_result` would then walk it. Added here as the exact
-- twin predicate.
--
-- Provenance argument for adding it to a data-bearing table: `result_ruleset` on
-- `case_phases` is written in exactly one place — the template copy inside
-- `create_case_from_template` — and the template side has carried the CHECK all
-- along. `add_ad_hoc_phase` does not write the column at all. Existing rows are
-- therefore constrained-by-construction. NOT VALID + VALIDATE is used anyway so a
-- data-bearing remote fails at a named VALIDATE step (diagnosable) rather than
-- inside an ADD (ambiguous) — see the backfill-guard lesson in the project memory.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §H1. Drop the `tg_op = 'INSERT'`
-- arm below and t1/t2/t3 go red; drop the CHECK and t4 goes red.

-- ── `current_user` DOES NOT WORK HERE — the helper exists because of that ──────
--
-- ⚠ This guard's first working draft tested `current_user in ('authenticated',
-- 'anon')` and was COMPLETELY INERT. `app.guard_case_phase_status` is SECURITY
-- DEFINER, so inside it `current_user` is the FUNCTION OWNER (`postgres`), never
-- the caller — the condition was false for everyone, including a real PostgREST
-- client, and the guard silently permitted exactly the write it exists to refuse.
--
-- It read correctly, applied cleanly, broke no test, and defended nothing. Only
-- the pgTAP keystone caught it ("caught: no exception"), which is the entire
-- argument for writing keystones that must fail.
--
-- Measured on this stack inside a SECURITY DEFINER function, under
-- `SET ROLE authenticated`:
--
--   current_user            = postgres         (the owner — useless here)
--   session_user            = postgres         (the login role — useless here)
--   current_setting('role') = authenticated    (the caller — correct)
--
-- SECURITY DEFINER swaps the effective user id; it does NOT touch the `role` GUC.
-- PostgREST issues `SET LOCAL ROLE authenticated` (or `anon`) per request, so that
-- GUC is exactly the client boundary. A privileged fixture or the seed, running as
-- `postgres` with no SET ROLE, reads 'none'.
create or replace function app.is_client_role()
 returns boolean
 language sql
 stable
 set search_path to 'pg_catalog'
as $function$
  select coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon');
$function$;

comment on function app.is_client_role() is
  'True when the caller reached us as a PostgREST client role. Reads the `role` GUC, NOT current_user: inside a SECURITY DEFINER function current_user is the owner, so a current_user test there is inert (it was, and it shipped past review — see 20260906000100''s header).';

-- ── The guard ──────────────────────────────────────────────────────────────────
-- The DELETE and UPDATE arms below are UNCHANGED from the deployed body (copied
-- from pg_get_functiondef, not from the migration that last wrote it). Only the
-- INSERT arm is new.
create or replace function app.guard_case_phase_status()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  -- PCI/H1 — NEW ARM. A phase may only be born inside a vetted RPC / bootstrap
  -- context. Without this, the transition matrix below is unreachable by simply
  -- never transitioning: insert the terminal row directly.
  if tg_op = 'INSERT' then
    -- The boundary is: a CLIENT role, outside a vetted RPC window. See the header
    -- for why this is role-scoped rather than GUC-only.
    if not v_in_rpc and app.is_client_role() then
      raise exception 'case phases must be created through the case RPCs'
        using errcode = 'check_violation';
    end if;

    -- ⚠ DO NOT ADD "and new.status must be 'pending'" HERE.
    -- It is the obvious next assertion, it is WRONG, and it was written and
    -- reverted once already. supabase/seed.sql builds its mid-flight fixture by
    -- inserting a `completed` phase 1 (with activated_at/completed_at) directly
    -- under this very GUC, and says so in the line above it: "The guards permit
    -- these seeded statuses under app.in_case_rpc." That is a pre-existing
    -- contract with ~900 tests behind it; a born-pending rule fails `db reset` at
    -- the seed. The GUC gate above is the whole security fix — a PostgREST client
    -- cannot set app.in_case_rpc, so the forged-terminal-phase POST is refused
    -- outright. Constraining the two internal writers further buys nothing:
    -- create_case_from_template and add_ad_hoc_phase both omit `status` and take
    -- the column default anyway.

    -- What IS asserted: internal consistency. A `pending` phase carries no
    -- lifecycle timestamps — true for every writer (both RPCs set none, the seed
    -- sets them only on its `completed` row), and it blocks the pending-row-with-
    -- completed_at shape that would make the UPDATE arm's audit diff lie.
    if new.status = 'pending'
       and (new.completed_at is not null
            or new.skipped_at is not null
            or new.activated_at is not null) then
      raise exception 'uma fase pendente não pode carregar marcos de ciclo de vida'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Phases are only deleted via the case cascade (handled there) or while the
    -- case is being built under the flag; a direct terminal-phase delete is
    -- blocked.
    if not v_in_rpc and old.status in ('completed', 'not_required', 'voided') then
      raise exception 'terminal case phases are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case phase status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'pending' and new.status in ('active', 'not_required'))
      or (old.status = 'active' and new.status in ('completed', 'not_required'))
      or (old.status = 'completed' and new.status = 'voided')  -- correction void
    ) then
      raise exception 'invalid case phase transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- No status change. Permit the recommended-flag toggle while pendente; permit
  -- any non-status field change under the RPC flag (activate/reassign metadata);
  -- otherwise freeze a non-pendente phase.
  if v_in_rpc then
    return new;
  end if;

  if old.status = 'pending'
     and new.recommended is distinct from old.recommended
     and new.status = old.status
     and new.assigned_to is not distinct from old.assigned_to
     and new.activated_at is not distinct from old.activated_at
     and new.completed_at is not distinct from old.completed_at
     and new.skipped_at is not distinct from old.skipped_at then
    return new;
  end if;

  raise exception 'case phase changes must go through the case RPCs'
    using errcode = 'check_violation';
end;
$function$;

comment on function app.guard_case_phase_status() is
  'PCI/H1 — case_phases lifecycle guard. Fires BEFORE INSERT OR UPDATE OR DELETE. The INSERT arm (added by 20260906000100) requires the app.in_case_rpc GUC and a `pending` birth status; without it the UPDATE transition matrix is bypassable by inserting the terminal row directly.';

-- Re-create the trigger to add INSERT. (CREATE OR REPLACE TRIGGER exists in PG14+
-- but a drop/create keeps the change legible in \d output and in diffs.)
drop trigger if exists guard_case_phase_status_trg on public.case_phases;
create trigger guard_case_phase_status_trg
  before insert or update or delete on public.case_phases
  for each row execute function app.guard_case_phase_status();

-- ── The case-side result_ruleset shape CHECK ───────────────────────────────────
-- Predicate is the exact twin of process_template_phases_result_ruleset_shape.
alter table public.case_phases
  add constraint case_phases_result_ruleset_shape
  check (
    result_ruleset is null
    or (
      jsonb_typeof(result_ruleset) = 'object'
      and (result_ruleset ? 'rules')
      and jsonb_typeof(result_ruleset -> 'rules') = 'array'
      and (result_ruleset ? 'default_result_id')
      and jsonb_typeof(result_ruleset -> 'default_result_id') = any (array['string', 'null'])
    )
  ) not valid;

alter table public.case_phases validate constraint case_phases_result_ruleset_shape;

comment on constraint case_phases_result_ruleset_shape on public.case_phases is
  'PCI/H1 — twin of process_template_phases_result_ruleset_shape. The snapshot half of the ruleset pair was previously unconstrained, so a direct INSERT could plant an arbitrary jsonb that app.compute_case_phase_result would then walk.';

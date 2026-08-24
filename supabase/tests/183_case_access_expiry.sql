-- Case-access grant EXPIRY + reason — migration 20260708000000_case_access_expiry.sql
-- (ADR 0050).
--
-- `case_access` gains nullable `expires_at` + `reason`. An EXPIRED grant row is
-- KEPT (the panel shows "Expirada"; re-grant refreshes; revoke deletes) but is
-- DENIED by the filter `(expires_at is null or expires_at > now())` on the grant
-- arm of ALL SIX consulters. "Expired means expired everywhere." This file proves
-- the lockout across the full consulter set, plus that a NULL/future grant still
-- grants and a revoked (deleted) grant still denies, and the RPC surface
-- (grant_case_access future-validation + list_case_access projection).
--
-- The six consulters (re-grepped; ADR 0050 §Decision 5):
--   1. app.can_read_case            (grant arm)
--   2. app.can_read_case_patient    (PHI — Rule 12)
--   3. app.can_write_case_content   (+ blocks save_narrative_body by delegation)
--   4. get_member_overview          (cases-not-concluded count grant leg)
--   5. app.referral_target_analyst  (feeds app.can_read_referral_phi — PHI, Rule 12)
--   6. public.list_my_cases         (both arms: my_role chip + list membership)
--
-- Personas (commission X unless noted):
--   sa_x   coordinator (staff_admin) — role-based access (grants never gate them)
--   st_x   a plain member — the GRANTEE whose expiry we toggle (NO attribution)
--   sa_y   foreign coordinator (commission Y) — the referral's target coordinator
--
-- The case + phase + referral + grant are built directly as table owner
-- (mirrors 144/150): the predicates are read-only, and the case_access /
-- case_referral direct writes run under the app.in_referral_rpc guard flag where
-- a status/snapshot guard would otherwise bite.

begin;
select plan(23);   -- FUP-QO-7 close: +§E (E0-E3) — the PO-ruled re-grant expiry semantics

-- case_access + referral flags ON (the expiry filter lives on both surfaces).
update app.feature_flags set enabled = true
  where key in ('case_access', 'cases_extras', 'cases_multi_phase', 'case_referrals');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- One case in X. st_x will be the grantee (NOT attributed — a pure grant so the
-- expiry is the ONLY thing keeping access; an attribution would mask the lockout).
create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as narr_x, gen_random_uuid() as ref_x;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select case_x from cs), (select comm_x from k), 9401, 'Caso Expiry', (select sa_x from k));

-- An UN-assigned narrative (so a write-grantee may write it — the save gate uses
-- can_write_case_content on an un-attributed narrative).
insert into public.case_narratives (id, case_id, display_label, display_position, status, assigned_to)
values ((select narr_x from cs), (select case_x from cs), 'Resumo', 1, 'open', null);

-- A referral whose TARGET case is our case, so referral_target_analyst consults a
-- case_access grant on target_case_id. Built directly under the RPC guard flag.
select set_config('app.in_referral_rpc', 'on', true);
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id,
   target_case_id, type_label, subject, status, response_expected, has_patient)
values
  ((select ref_x from cs), 'ENC-EXPIRY-1', (select case_x from cs), (select comm_x from k),
   (select comm_y from k), (select case_x from cs), 'Parecer', 'Assunto', 'completed', false, true);
select set_config('app.in_referral_rpc', 'off', true);

-- Helper: (re)write st_x's grant with a chosen expiry. A separate proc keeps each
-- assertion block a single UPDATE away from the predicate call.
create or replace function pg_temp.set_grant(p_expires timestamptz)
returns void language plpgsql as $$
begin
  delete from public.case_access_grants
    where case_id = (select case_x from cs) and principal_id = (select st_x from k);
  -- Stage B: PHI is a per-column grant now, so set read_standard_phi too — 183 gates
  -- EVERY consulter (incl. the PHI door) on expiry, and a write grant alone confers no PHI.
  insert into public.case_access_grants
    (case_id, principal_id, source, read_case_content, read_case_deliberation,
     write_case_content, read_standard_phi, granted_by, expires_at)
  values ((select case_x from cs), (select st_x from k), 'manual_grant', true, true, true, true,
          (select sa_x from k), p_expires);
end $$;

-- ===========================================================================
-- FUTURE grant (expires_at > now()) → every consulter GRANTS.
-- ===========================================================================
select pg_temp.set_grant(now() + interval '30 days');

select ok(app.can_read_case((select case_x from cs), (select st_x from k)),
  'future grant: can_read_case → true');
select ok(app.can_read_case_patient((select case_x from cs), (select st_x from k)),
  'future grant: can_read_case_patient → true (PHI)');
select ok(app.can_write_case_content((select case_x from cs), (select st_x from k)),
  'future grant: can_write_case_content → true');
select ok(app.referral_target_analyst((select ref_x from cs), (select st_x from k)),
  'future grant: referral_target_analyst → true (feeds can_read_referral_phi)');
select ok(app.can_read_referral_phi((select ref_x from cs), (select st_x from k)),
  'future grant: can_read_referral_phi → true (PHI referral read)');

-- ===========================================================================
-- EXPIRED grant (expires_at <= now()) → every consulter DENIES.
-- ===========================================================================
select pg_temp.set_grant(now() - interval '1 second');

select ok(not app.can_read_case((select case_x from cs), (select st_x from k)),
  'expired grant: can_read_case → FALSE');
select ok(not app.can_read_case_patient((select case_x from cs), (select st_x from k)),
  'expired grant: can_read_case_patient → FALSE (PHI lockout)');
select ok(not app.can_write_case_content((select case_x from cs), (select st_x from k)),
  'expired grant: can_write_case_content → FALSE');
select ok(not app.referral_target_analyst((select ref_x from cs), (select st_x from k)),
  'expired grant: referral_target_analyst → FALSE');
select ok(not app.can_read_referral_phi((select ref_x from cs), (select st_x from k)),
  'expired grant: can_read_referral_phi → FALSE (referral PHI lockout — Rule 12)');

-- save_narrative_body is blocked by the expired write grant (delegates to
-- can_write_case_content). st_x acting as themselves.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.save_narrative_body(%L::uuid, 'corpo') $$, (select narr_x from cs)),
  '42501', null, 'expired grant: save_narrative_body is blocked (can_write_case_content gate)');
reset role;

-- get_member_overview: the expired grant no longer counts the case toward st_x's
-- cases-not-concluded (the ONLY leg keeping it — st_x has no attribution).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  ((select public.get_member_overview((select comm_x from k)))->>'cases_not_concluded')::int,
  0, 'expired grant: get_member_overview cases_not_concluded drops the case');
reset role;

-- list_my_cases: the expired grant drops the case from "Meus Casos" entirely.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select jsonb_array_length(public.list_my_cases((select comm_x from k)))),
  0, 'expired grant: list_my_cases drops the case (both arms honor expiry)');
reset role;

-- ===========================================================================
-- FUTURE grant again → list_my_cases restores the case with the collaborator chip
-- (proves the my_role chip arm ALSO honors the future/expiry filter).
-- ===========================================================================
select pg_temp.set_grant(now() + interval '90 days');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table myc on commit drop as
  select public.list_my_cases((select comm_x from k)) as d;
grant select on myc to authenticated;
reset role;
select is((select jsonb_array_length(d) from myc), 1,
  'future grant: list_my_cases restores the case');
select is((select d->0->>'my_role' from myc), 'collaborator',
  'future grant: the my_role chip is collaborator (write grant, non-expired)');

-- ===========================================================================
-- REVOKED (deleted) grant → still denies (the row is GONE, not merely expired).
-- ===========================================================================
delete from public.case_access_grants
  where case_id = (select case_x from cs) and principal_id = (select st_x from k);
select ok(not app.can_read_case((select case_x from cs), (select st_x from k)),
  'revoked grant: can_read_case → FALSE (row deleted)');

-- ===========================================================================
-- RPC SURFACE — grant_case_access future-validation + list_case_access projection.
-- ===========================================================================
-- grant_case_access rejects a PAST expiry (must be future).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.grant_case_access(%L::uuid, %L::uuid, 'read', %L::timestamptz, 'motivo teste') $$,
         (select case_x from cs), (select st_x from k), (now() - interval '1 day')),
  '23514', null, 'grant_case_access: a PAST expiry is rejected (must be future)');

-- A valid grant with a future expiry + reason lands, and list_case_access returns
-- both new columns.
select public.grant_case_access(
  (select case_x from cs), (select st_x from k), 'read',
  (now() + interval '60 days'), 'Apoio à análise');
create temp table la on commit drop as
  select * from public.list_case_access((select case_x from cs))
  where user_id = (select st_x from k);
grant select on la to authenticated;
reset role;
select ok((select expires_at from la) is not null,
  'list_case_access: returns the grant''s expires_at');
select is((select reason from la), 'Apoio à análise',
  'list_case_access: returns the grant''s reason (trimmed, non-blank)');

-- ============================================================================
-- §E — RE-GRANT EXPIRY SEMANTICS: a NULL p_expires_at means PERMANENT, INTENDED.
--      PO ruling 2026-08-07 (FUP-QO-7); ADR 0103.
--
-- ⛔ READ THIS BEFORE "FIXING" ANYTHING BELOW. `app._grant_case_access_unchecked`'s
-- `on conflict … do update set` list ends with `expires_at = excluded.expires_at` —
-- UNCOALESCED, deliberately. Re-granting a time-boxed grant with a NULL expiry makes
-- it PERMANENT. That looks exactly like the silent privilege widening ADR 0102 §2
-- REFUSED for the role door, and someone will eventually "fix" it by adding a
-- `coalesce`. These assertions exist to stop that.
--
-- ⭐ THE ASYMMETRY IS THE DESIGN, and it turns on the CALLERS, not on taste:
--   • Role door (`app.grant_role_impl`, ADR 0102): NO caller passes `p_expires_at` —
--     all 12 TS sites omit it — so "NULL clears" would have been an accident nobody
--     asked for. NULL therefore means LEAVE UNCHANGED.
--   • This door: exactly ONE caller can deliver a NULL expiry to an EXISTING grant —
--     `grantCaseAccess` (src/lib/case-access/actions.ts). ⚠ NOT via a blank field: the
--     grant dialog's expiry control is a NativeSelect (`Sem prazo` / `30 dias` /
--     `90 dias` / `Data específica`), and the one blankable control — the DatePicker
--     under `Data específica` — fails client-side validation when empty. NULL reaches
--     the door ONLY through the EXPLICIT `Sem prazo` choice, so it is a deliberate
--     human instruction, never an accident. On re-grant, `Sem prazo` therefore REMOVES
--     an existing expiry. `create_case` / `create_case_from_template` reach the
--     kernel only via the creator self-grant with a hardcoded null on a BRAND-NEW case,
--     where no conflict row can exist — the DO UPDATE arm is unreachable from them.
-- Same operator, opposite meaning, because the two doors have opposite caller
-- populations. Do NOT unify them without re-running BOTH caller sweeps.
--
-- ⚠ FALSIFIABILITY. These pin CURRENT behaviour, so they are green on first run — the
-- vacuity trap. Proven falsifiable by TWO neutralisations on 2026-08-07, each a one-line
-- `replace()` over `pg_get_functiondef` inside a rolled-back transaction. MEASURED, not
-- predicted:
--   • `expires_at = coalesce(excluded.expires_at, case_access_grants.expires_at)`
--     → **E1 RED, and only E1** (E0/E2/E3 stayed green). That is the tightest possible
--       proof that E1 pins the NULL-clear specifically and nothing else.
--   • `expires_at = greatest(excluded.expires_at, case_access_grants.expires_at)`
--     → **E0, E1, E3 RED; E2 green.** Wider than the label's parenthetical suggests,
--       because a ratchet also refuses E0's 7-day narrowing of the 30-day grant the
--       earlier sections leave behind. Recorded as measured rather than tidied: the
--       claim E3 makes ("a greatest() door passes E2 and reds here") holds exactly.
-- E2/E3 are the both-directions twin that keeps E1 honest: without them, a door that
-- ignored `p_expires_at` entirely would also satisfy "a NULL argument leaves it null".
--
-- ⛔ Assert as OWNER, not as the caller. `case_access_grants` is RLS-scoped; reading it
-- under `set local role authenticated` returned NO ROW and made all four assertions red
-- on the first attempt. A grantee-invisible row is indistinguishable from a wrong value
-- through an `ok()` — so the door is CALLED as `authenticated` and every read below runs
-- after `reset role`.
-- ============================================================================
select test_helpers.claims_for((select sa_x from k), false);

-- Start from a time-boxed grant, through the REAL door (not pg_temp.set_grant — the ruling is about what the DOOR does).
set local role authenticated;
select public.grant_case_access((select case_x from cs), (select st_x from k), 'read',
       now() + interval '7 days', null, false, false);
reset role;   -- ⛔ assert as OWNER: case_access_grants is RLS-scoped, and a
              -- grantee-invisible row would read as 'no row' and fake every ok() below.
select ok(
  (select g.expires_at is not null and g.expires_at < now() + interval '8 days'
   from public.case_access_grants g
   where g.case_id = (select case_x from cs) and g.principal_id = (select st_x from k)
     and g.revoked_at is null),
  'E0 fixture: the door seeded a 7-day time-boxed grant');

-- E1 — THE RULING. Re-grant with a NULL expiry (the UI's explicit `Sem prazo`): the
-- grant becomes PERMANENT.
set local role authenticated;
select public.grant_case_access((select case_x from cs), (select st_x from k), 'read',
       null, null, false, false);
reset role;   -- ⛔ assert as OWNER: case_access_grants is RLS-scoped, and a
              -- grantee-invisible row would read as 'no row' and fake every ok() below.
select ok(
  (select g.expires_at is null
   from public.case_access_grants g
   where g.case_id = (select case_x from cs) and g.principal_id = (select st_x from k)
     and g.revoked_at is null),
  'E1 ⭐ PO RULING 2026-08-07 (ADR 0103): re-granting with a NULL expiry (the UI''s explicit ''Sem prazo'') CLEARS it — the grant becomes permanent, ON PURPOSE. Do not add a coalesce here; ADR 0102 ruled the opposite for the ROLE door because its callers never pass the argument, and this door''s UI deliberately does.');

-- E2 — the positive twin, EXTEND direction. A passed expiry overwrites.
set local role authenticated;
select public.grant_case_access((select case_x from cs), (select st_x from k), 'read',
       now() + interval '30 days', null, false, false);
reset role;   -- ⛔ assert as OWNER: case_access_grants is RLS-scoped, and a
              -- grantee-invisible row would read as 'no row' and fake every ok() below.
select ok(
  (select g.expires_at > now() + interval '29 days'
   from public.case_access_grants g
   where g.case_id = (select case_x from cs) and g.principal_id = (select st_x from k)
     and g.revoked_at is null),
  'E2 twin (EXTEND): a supplied expiry overwrites — null -> 30 days');

-- E3 — the positive twin, SHORTEN direction. Absolute set, not a ratchet: without this a greatest() implementation would satisfy E2 while silently refusing to close a PHI window early.
set local role authenticated;
select public.grant_case_access((select case_x from cs), (select st_x from k), 'read',
       now() + interval '2 days', null, false, false);
reset role;   -- ⛔ assert as OWNER: case_access_grants is RLS-scoped, and a
              -- grantee-invisible row would read as 'no row' and fake every ok() below.
select ok(
  (select g.expires_at < now() + interval '3 days' and g.expires_at > now()
   from public.case_access_grants g
   where g.case_id = (select case_x from cs) and g.principal_id = (select st_x from k)
     and g.revoked_at is null),
  'E3 twin (SHORTEN): ...and a shorter one shortens — absolute set, not a ratchet (a greatest() door passes E2 and reds here)');

select * from finish();
rollback;

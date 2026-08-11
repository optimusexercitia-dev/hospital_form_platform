-- ETH·E4 §1.3 (ADR 0108 Decision 2) — `set_primary_subject` gains MOVE semantics and
-- re-runs the respondent-linkage assert.
--
-- ⚠ THIS MODIFIES A SHIPPED, KEYSTONED DEFINER DOOR. It is `create or replace`, and
-- it must NEVER become DROP+CREATE: a rebuild silently loses properties the original
-- carried — the ACL first among them (a dropped function takes its grants with it,
-- and the recreated one comes back with `proacl = NULL`, which is not "no grants" but
-- the Postgres default of EXECUTE to PUBLIC). The defect in that shape is what the
-- new statement OMITS, so `prosecdef`, `proconfig` and the ACL are diffed FROM THE
-- CATALOG, property by property, against values captured before this migration ran.
-- This file contains NO revoke/grant statements on purpose: the door keeps its
-- shipped ACL (`postgres=X`, `authenticated=X`, `service_role=X`) untouched.
--
-- Everything outside the two deltas below is the shipped body verbatim, including the
-- gates (`HC0E4` / `HC0F1`), the `unique_violation` → `HC0E7` backstop, and the audit
-- event name `case.primary_subject_set`. Keystones that assert on this door — pgTAP
-- 228 (t19 ACL), 229 (M1·2 exclusion gate + door census), 314 (QO wall 11.3) — must
-- stay green; none of them pins set-only semantics, which is why the behaviour change
-- is safe and why suite 321 keystone 6 had to be written first and watched go RED.
--
-- DELTA 1 — MOVE, not set-only. The shipped body could only ever SET
-- `is_primary_subject = true`; a case that already had a primary raised `HC0E7`
-- through the partial unique index, so there was no way to correct a
-- mis-designated respondent short of removing the participant. The demote and the
-- promote are TWO SEQUENTIAL STATEMENTS, deliberately: a single dual-row UPDATE has
-- no guaranteed row order and could trip
-- `case_participants_one_primary_subject` mid-statement. Two statements clear the
-- index entry before adding one.
--
-- DELTA 2 — re-run `app.assert_respondent_linkage_resolved`. Promotion must not
-- become a way around `HC0F0`. `add_case_participant` asserts the linkage at SEATING
-- time, but `set_professional_link_state` can flip a profile back to `unknown`
-- afterwards; without this, promoting that already-seated participant to primary
-- subject would install an unresolved respondent — and an unresolved respondent
-- makes `app.is_case_respondent` unable to resolve, so the automatic case exclusion
-- becomes silently decorative. The assert runs AFTER the authorization gates, so an
-- unauthorized caller still gets `HC0E4` rather than leaking `HC0F0`.

create or replace function public.set_primary_subject(p_case_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_participant uuid;
  v_role uuid;
begin
  perform app.assert_case_participants_enabled();
  -- (delta 2 also selects participant_id + role_id — the assert's two arguments.)
  select cp.case_id, c.commission_id, cp.participant_id, cp.role_id
    into v_case_id, v_commission, v_participant, v_role
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  -- ⚠ A GATE fix, NOT a durability fix (§W-6): is_case_respondent does NOT read
  -- is_primary_subject, so this door cannot dissolve the deny. It is a CO-LOCATED
  -- defect — an excluded principal exercising coordinator authority — and its
  -- keystone must assert the gate, or it cannot falsify.
  if app.is_case_excluded(v_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;

  -- ETH·E4 delta 2 — a promotion is a respondent designation; re-assert the linkage.
  perform app.assert_respondent_linkage_resolved(v_participant, v_role);

  begin
    -- ETH·E4 delta 1 — demote the incumbent, THEN promote the target.
    update public.case_participants
       set is_primary_subject = false
     where case_id = v_case_id
       and is_primary_subject
       and removed_at is null;
    update public.case_participants set is_primary_subject = true where id = p_case_participant_id;
  exception when unique_violation then
    raise exception 'não é possível definir mais de um sujeito principal ativo'
      using errcode = 'HC0E7';
  end;
  perform app.audit_write('case.primary_subject_set', 'case', v_case_id, v_commission,
    'Sujeito principal definido',
    jsonb_build_object('case_participant_id', p_case_participant_id));
end;
$$;

comment on function public.set_primary_subject(uuid) is
  'ETH·E4 (ADR 0108 D2): designate a case participant as the primary subject, MOVING '
  'the designation off any incumbent. Coordinator-gated (HC0E4), exclusion-gated '
  '(HC0F1), respondent-linkage asserted (HC0F0), audited case.primary_subject_set.';

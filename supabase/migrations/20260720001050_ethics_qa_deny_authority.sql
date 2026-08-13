-- =============================================================================
-- ETH·E1 — QA fix loop (review docs/reviews/phase-ETH-E1-review.md).
--
-- MAJOR-1 — the m2 respondent/recusal hard-deny was out-voted at the RLS POLICY layer.
--   `can_read_case` is correct, but ten case-scoped SELECT policies ORed an admin
--   predicate OUTSIDE the DEFINER — `can_read_case(x) OR is_commission_admin_of(...)` —
--   so a respondent/recused user who is an org_admin/hospital_admin still read the row
--   via plain PostgREST, falsifying ADR 0072 D2 ("exclusion cannot be out-voted by any
--   positive arm"). E1's own `can_read_interview` reproduced the same shape.
--   FIX: `app.can_read_case_or_admin()` applies the two deny-terms FIRST and only then
--   ORs the admin arm; the nine policies + `can_read_interview` (which covers the seven
--   interview-family policies) are repointed at it. `commission_default` behaviour is
--   unchanged for everyone who is not a respondent/recused — the admin arm still grants.
--
--   Scope note: `action_items_select` also mentions both tokens but is NOT this shape —
--   its `can_read_case` sits alone in the `case_restricted` arm (deny already applies);
--   its admin arms are on the disjoint commission-scoped `committee`/`assignees_only`
--   scopes. Deliberately untouched.
--
-- MAJOR-2 — `record_recusal`'s self-arm had NO authority gate: any authenticated user
--   could write a `case_recusals` row (and an `audit_write` row) into ANY case in ANY
--   org, and the P0002-vs-success distinction was a case-existence oracle. FIX: a reach
--   gate mirroring `declare_conflict`'s not-found posture.
--
-- MINOR-3 — `app.confidentiality_rank` skipped the t19 REVOKE→GRANT pair.
--
-- Forward-only / additive; local-first. No schema change ⇒ `database.ts` unaffected.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · MAJOR-1 — the deny-authoritative case-read-or-admin predicate.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_case_or_admin(p_case_id uuid, p_uid uuid)
  returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  -- ⟵ HARD DENY FIRST (ADR 0072 D2 · QA MAJOR-1). The whole point of this wrapper: the
  -- commission-admin arm below used to be ORed by each policy OUTSIDE the DEFINER, so it
  -- out-voted the exclusion. Evaluating the denies here makes them authoritative at the
  -- boundary — no positive arm, at any layer, can out-vote a respondent/recusal deny.
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;
  return app.can_read_case(p_case_id, p_uid)
      or app.is_commission_admin_of_for(app.commission_of_case(p_case_id), p_uid);
end;
$$;
comment on function app.can_read_case_or_admin(uuid, uuid) is
  'ADR 0072 D2 · QA MAJOR-1 — case read INCLUDING the commission-admin (org/hospital) arm, '
  'with the respondent/recusal hard-denies applied FIRST. The single predicate every '
  'case-scoped SELECT policy that needs an admin arm must use: ORing the admin arm outside '
  'the DEFINER out-votes the m2 exclusion. Non-excluded readers are unaffected.';
alter function app.can_read_case_or_admin(uuid, uuid) owner to postgres;
revoke all on function app.can_read_case_or_admin(uuid, uuid) from public;
grant execute on function app.can_read_case_or_admin(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2 · Repoint the nine case-scoped SELECT policies. Each keeps its EXACT prior
--     case-resolution expression + auth.uid() form; only the OR-admin shape changes.
-- -----------------------------------------------------------------------------
drop policy if exists cases_select on public.cases;
create policy cases_select on public.cases
  for select to authenticated
  using (app.can_read_case_or_admin(id, (select auth.uid())));

drop policy if exists case_events_select on public.case_events;
create policy case_events_select on public.case_events
  for select to authenticated
  using (app.can_read_case_or_admin(case_id, auth.uid()));

drop policy if exists case_narratives_select on public.case_narratives;
create policy case_narratives_select on public.case_narratives
  for select to authenticated
  using (app.can_read_case_or_admin(case_id, auth.uid()));

drop policy if exists case_offered_outcomes_select on public.case_offered_outcomes;
create policy case_offered_outcomes_select on public.case_offered_outcomes
  for select to authenticated
  using (app.can_read_case_or_admin(case_id, auth.uid()));

drop policy if exists case_phase_offered_results_select on public.case_phase_offered_results;
create policy case_phase_offered_results_select on public.case_phase_offered_results
  for select to authenticated
  using (app.can_read_case_or_admin(case_id, auth.uid()));

drop policy if exists case_phases_select on public.case_phases;
create policy case_phases_select on public.case_phases
  for select to authenticated
  using (app.can_read_case_or_admin(case_id, auth.uid()));

drop policy if exists case_tag_assignments_select on public.case_tag_assignments;
create policy case_tag_assignments_select on public.case_tag_assignments
  for select to authenticated
  using (app.can_read_case_or_admin(case_id, auth.uid()));

drop policy if exists case_phase_allowed_results_select on public.case_phase_allowed_results;
create policy case_phase_allowed_results_select on public.case_phase_allowed_results
  for select to authenticated
  using (app.can_read_case_or_admin(app.case_of_case_phase(case_phase_id), auth.uid()));

drop policy if exists case_interview_links_select on public.case_interview_links;
create policy case_interview_links_select on public.case_interview_links
  for select to authenticated
  using (app.can_read_case_or_admin(app.case_of_interview(interview_id), auth.uid()));

-- -----------------------------------------------------------------------------
-- 3 · can_read_interview — E1's own reproduction of the defective shape. Repointing it
--     fixes the whole interview family (case_interviews / _subjects / _interviewers /
--     interview_sessions / _session_attendance / interview_topics / interview_summaries)
--     in one place. Confidentiality ceiling unchanged.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_interview(p_interview_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and exists (
    select 1 from public.case_interviews ci
    where ci.id = p_interview_id
      and app.can_read_case_or_admin(ci.case_id, p_uid)
      and app.confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level, p_uid)
  );
$$;

-- -----------------------------------------------------------------------------
-- 3b · MAJOR-1, the deeper half (found while verifying the fix — beyond QA's
--      enumeration, which only matched policies *containing* `can_read_case`).
--
--      The `*_staff_admin_write` policies are `FOR ALL` PERMISSIVE with a BARE admin
--      USING (`is_staff_admin_of OR is_commission_admin_of`) and no case-read predicate
--      at all. `FOR ALL` covers SELECT, and permissive policies OR together — so they
--      handed the row straight back to a respondent/recused admin even after the nine
--      `*_select` policies were fixed. (This is why the policy-layer pgTAP still failed
--      on `cases`/`case_phases` after step 2.) The same applies to the interview-family
--      write policies and `case_access_select`.
--
--      FIX: one `app.is_case_excluded()` deny helper, applied as a pure
--      `AND NOT is_case_excluded(...)` conjunct. For every user who is NOT a respondent
--      or recused it evaluates false ⇒ the conjunct is a no-op and behaviour is
--      byte-for-byte unchanged; for an excluded user it is authoritative on BOTH read
--      and write (ADR 0072 D3 — an excluded user must not write the case either).
--
--      Commission-scoped VOCABULARY catalogs (`case_tags`, `case_outcomes`,
--      `case_narrative_types`) are deliberately NOT touched: they are per-commission
--      catalogs, not case-scoped rows, so per-case exclusion does not apply to them.
-- -----------------------------------------------------------------------------
create or replace function app.is_case_excluded(p_case_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null
     and (app.is_case_respondent(p_case_id, p_uid)
          or app.is_recused_from_case(p_case_id, p_uid));
$$;
comment on function app.is_case_excluded(uuid, uuid) is
  'ADR 0072 D2/D3 · QA MAJOR-1 — the m2 exclusion in one place: true iff p_uid is a live '
  'respondent_doctor of, or holds a live recusal on, this case. Applied as an '
  '`AND NOT is_case_excluded(...)` conjunct to every case-scoped policy whose grant arm '
  'does not route through can_read_case/_or_admin (the FOR ALL admin-write policies). '
  'A no-op for every non-excluded user.';
alter function app.is_case_excluded(uuid, uuid) owner to postgres;
revoke all on function app.is_case_excluded(uuid, uuid) from public;
grant execute on function app.is_case_excluded(uuid, uuid) to authenticated, service_role;

-- The eight case-scoped FOR ALL admin-write policies. USING == WITH CHECK for each
-- (verified against pg_policy), so the deny conjunct is mirrored onto both.
drop policy if exists cases_staff_admin_write on public.cases;
create policy cases_staff_admin_write on public.cases
  for all to authenticated
  using ((app.is_staff_admin_of(commission_id) or app.is_commission_admin_of(commission_id))
         and not app.is_case_excluded(id, auth.uid()))
  with check ((app.is_staff_admin_of(commission_id) or app.is_commission_admin_of(commission_id))
         and not app.is_case_excluded(id, auth.uid()));

drop policy if exists case_phases_staff_admin_write on public.case_phases;
create policy case_phases_staff_admin_write on public.case_phases
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()));

drop policy if exists case_events_staff_admin_write on public.case_events;
create policy case_events_staff_admin_write on public.case_events
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()));

drop policy if exists case_narratives_staff_admin_write on public.case_narratives;
create policy case_narratives_staff_admin_write on public.case_narratives
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()));

drop policy if exists case_offered_outcomes_staff_admin_write on public.case_offered_outcomes;
create policy case_offered_outcomes_staff_admin_write on public.case_offered_outcomes
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()));

drop policy if exists case_phase_offered_results_staff_admin_write on public.case_phase_offered_results;
create policy case_phase_offered_results_staff_admin_write on public.case_phase_offered_results
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()));

drop policy if exists case_phase_allowed_results_staff_admin_write on public.case_phase_allowed_results;
create policy case_phase_allowed_results_staff_admin_write on public.case_phase_allowed_results
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
          or app.is_commission_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id))))
         and not app.is_case_excluded(app.case_of_case_phase(case_phase_id), auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
          or app.is_commission_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id))))
         and not app.is_case_excluded(app.case_of_case_phase(case_phase_id), auth.uid()));

drop policy if exists case_tag_assignments_staff_admin_write on public.case_tag_assignments;
create policy case_tag_assignments_staff_admin_write on public.case_tag_assignments
  for all to authenticated
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_commission_admin_of(app.commission_of_case(case_id)))
         and not app.is_case_excluded(case_id, auth.uid()));

-- The three interview-family FOR ALL write policies (their admin arm bypasses the deny
-- for read AND write; can_write_interview does not consult it either).
drop policy if exists case_interview_subjects_write on public.case_interview_subjects;
create policy case_interview_subjects_write on public.case_interview_subjects
  for all to authenticated
  using ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
         and not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()))
  with check ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
         and not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()));

drop policy if exists case_interview_interviewers_write on public.case_interview_interviewers;
create policy case_interview_interviewers_write on public.case_interview_interviewers
  for all to authenticated
  using ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
         and not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()))
  with check ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
         and not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()));

drop policy if exists case_interview_links_write on public.case_interview_links;
create policy case_interview_links_write on public.case_interview_links
  for all to authenticated
  using ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
         and not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()))
  with check ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id)))
         and not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()));

-- case_access_select — the admin arms would let an excluded admin enumerate the case's
-- ACL (case-scoped metadata). Gate them; KEEP the `user_id = auth.uid()` self-arm, which
-- mirrors the intentional D4 recusal self-arm (you may always see your own grant).
drop policy if exists case_access_select on public.case_access;
create policy case_access_select on public.case_access
  for select to authenticated
  using (
    ((app.is_staff_admin_of(app.commission_of_case(case_id))
      or app.is_commission_admin_of(app.commission_of_case(case_id)))
     and not app.is_case_excluded(case_id, auth.uid()))
    or user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 4 · MAJOR-2 — record_recusal reach gate. Body reproduced from 20260720001010 with
--     ONLY the authority block changed (+ the not-found posture).
-- -----------------------------------------------------------------------------
create or replace function public.record_recusal(
  p_case_id uuid, p_user_id uuid, p_reason_md text, p_conflict_declaration_id uuid default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_is_coord boolean;
  v_source text;
  v_id uuid;
begin
  perform app.assert_case_participants_enabled();
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;

  -- ⟵ QA MAJOR-2 REACH GATE. Previously the self-arm accepted ANY authenticated user for
  -- ANY case in ANY org (cross-tenant write + foreign audit-trail pollution), and the
  -- P0002-vs-HC0E4 split leaked case existence for any UUID. A caller with no reach now
  -- gets the same not-found posture as a non-existent case — mirroring declare_conflict.
  v_is_coord := app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission);
  if not (v_is_coord or app.can_read_case(p_case_id, auth.uid())) then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;

  -- Authority: a coordinator may recuse ANOTHER member; anyone with reach (coordinator
  -- included) may recuse THEMSELVES.
  if p_user_id = auth.uid() then
    v_source := 'self';
  elsif v_is_coord then
    v_source := 'coordinator';
  else
    raise exception 'apenas a coordenação pode registrar recusas deste caso'
      using errcode = 'HC0E4';
  end if;

  begin
    insert into public.case_recusals
      (case_id, user_id, reason_md, source, conflict_declaration_id, recused_by)
    values
      (p_case_id, p_user_id, nullif(btrim(p_reason_md), ''),
       case when p_conflict_declaration_id is not null then 'conflict' else v_source end,
       p_conflict_declaration_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'recusa já registrada para este usuário neste caso'
      using errcode = 'HC0E0';
  end;

  if p_conflict_declaration_id is not null then
    update public.case_conflict_declarations
      set status = 'recused', resolved_at = now(), resolved_by = auth.uid()
    where id = p_conflict_declaration_id and case_id = p_case_id;
  end if;

  perform app.audit_write('case.recusal_recorded', 'case', p_case_id, v_commission,
    'Recusa registrada no caso',
    jsonb_build_object('user_id', p_user_id, 'source', v_source));
  return v_id;
end;
$$;
alter function public.record_recusal(uuid, uuid, text, uuid) owner to postgres;
revoke all on function public.record_recusal(uuid, uuid, text, uuid) from public;
grant execute on function public.record_recusal(uuid, uuid, text, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5 · MINOR-3 — the t19 REVOKE→GRANT pair every other new app.* function in the phase
--     carries. Inert in substance (immutable pure `case` over a literal) but uniformity
--     is what makes the guard auditable.
-- -----------------------------------------------------------------------------
revoke all on function app.confidentiality_rank(text) from public;
grant execute on function app.confidentiality_rank(text) to authenticated, service_role;

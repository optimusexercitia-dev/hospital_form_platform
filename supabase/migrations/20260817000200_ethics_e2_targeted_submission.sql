-- =============================================================================
-- ETH·E2 (ADR 0073 §D13) — BE-3b: the respondent targeted-submission door.
--
-- The ONE narrow exception to the 0072 D3 respondent hard-deny: a targeted participant
-- may reach ONLY their own targeted response (+ its answers + the published form
-- definition to render the wizard) — NEVER the case. The predicate
-- app.can_access_targeted_response is base-table + R6-safe and NEVER calls
-- app.can_read_case / app.can_write_case_content / app.is_case_respondent / the case
-- row, so it cannot weaken the hard-deny (0072 D2·0): a respondent who selects cases /
-- case_participants / ethics_* / case_decisions / case_votes / meetings / case_narratives
-- / attachments still reads ZERO rows.
--
-- Policy landing (VERIFIED against live pg_policies, post-SUP): responses / answers /
-- form_versions / form_sections / form_items all carry ONLY PERMISSIVE policies, and
-- NONE of the existing arms grants a targeted respondent reach (the coordinator is
-- created_by, not the respondent; the response is in_progress, not submitted; the
-- respondent is not a commission member/admin). So the door lands as SEPARATE additive
-- PERMISSIVE policies (Postgres ORs permissive policies per command) — the existing
-- arms are untouched (no rewrite, disjunctive by construction).
--
-- Only a `linked` professional profile (user_id resolved) can use the door — a
-- no_account / unknown target has no reachable user and responds out-of-band.
--
-- SQLSTATEs (ADR 0073 D11): HC0J1 (coordinator authority on target_case_response),
-- HC0J0 (invalid state / cross-case participant / non-ethics / non-case response),
-- HC0J9 (submit_targeted_case_response — caller is not the targeted participant),
-- HC000 (ethics flag OFF).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · responses.target_case_participant_id — the D10 column D13 upgrades from a
--     projection into a narrow access seam. Nullable (most responses target a phase,
--     not a participant).
-- -----------------------------------------------------------------------------
alter table public.responses
  add column if not exists target_case_participant_id uuid references public.case_participants(id);
comment on column public.responses.target_case_participant_id is
  'ADR 0073 D10/D13 — when set, this response is a targeted submission (e.g. a Declaração '
  'do denunciado) bound to a specific case participant. The narrow door '
  'app.can_access_targeted_response lets that participant reach ONLY this response + its '
  'answers + the form definition, NEVER the case (the 0072 respondent hard-deny holds).';

create index if not exists responses_target_participant_idx
  on public.responses (target_case_participant_id)
  where target_case_participant_id is not null;

-- -----------------------------------------------------------------------------
-- 1 · app.can_access_targeted_response — the READ gate. Base-table, R6-safe. NEVER
--     touches can_read_case / the case row. True iff the response is targeted at a LIVE
--     professional participant that resolves to p_uid (⇒ linked; see the note in-body).
--     ⛔ The 2 access conjuncts (removed_at / user_id) are the mutation targets — widening
--     EITHER makes a DIFFERENT user's response reachable (see the mutation audit).
-- -----------------------------------------------------------------------------
create or replace function app.can_access_targeted_response(p_response_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and exists (
    select 1
    from public.responses resp
    join public.case_participants cp        on cp.id = resp.target_case_participant_id
    join public.professional_participants pp on pp.participant_id = cp.participant_id
    join public.professional_profiles prof  on prof.id = pp.professional_profile_id
    where resp.id = p_response_id
      and resp.target_case_participant_id is not null   -- the response IS targeted
      and cp.removed_at is null                          -- the participant link is LIVE
      and prof.user_id = p_uid                           -- resolves to THIS user (⇒ linked, see note)
  );
  -- NOTE (D13 "only a linked profile"): `prof.user_id = p_uid` ALREADY enforces this.
  -- app.guard_professional_linkage makes `user_id IS NOT NULL ⇔ link_state = 'linked'`
  -- a hard biconditional (a profile with a user_id is ALWAYS 'linked'; a no_account/
  -- unknown profile has user_id NULL, which never equals a caller's uid). An explicit
  -- `link_state = 'linked'` conjunct would therefore be VACUOUS — it can never change the
  -- result, so it is deliberately omitted (a gate that cannot fail is not a gate). The
  -- pgTAP no-account keystone proves a user_id-NULL target is unreachable by anyone.
$$;
alter function app.can_access_targeted_response(uuid, uuid) owner to postgres;
revoke all on function app.can_access_targeted_response(uuid, uuid) from public;
grant execute on function app.can_access_targeted_response(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2 · app.can_write_targeted_response — the WRITE gate = read gate AND the response is
--     still in_progress (submitted → read-only). Keeps the status logic inside a DEFINER
--     base-table read (no RLS recursion via an answers→responses subquery).
-- -----------------------------------------------------------------------------
create or replace function app.can_write_targeted_response(p_response_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.can_access_targeted_response(p_response_id, p_uid)
     and exists (select 1 from public.responses r
                 where r.id = p_response_id and r.status = 'in_progress');
$$;
alter function app.can_write_targeted_response(uuid, uuid) owner to postgres;
revoke all on function app.can_write_targeted_response(uuid, uuid) from public;
grant execute on function app.can_write_targeted_response(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · app.can_access_targeted_version — the FORM-DEFINITION render gate. A targeted
--     respondent is often a NON-MEMBER (external doctor), so the member-gated
--     form_versions/_sections/_items SELECT policies would deny the wizard. This narrow
--     twin admits ONLY the published versions referenced by a response targeted at p_uid
--     — form definitions are commission-scoped published artifacts, not case PHI (D13).
--     Kept in sync with can_access_targeted_response (same live/linked conjuncts).
-- -----------------------------------------------------------------------------
create or replace function app.can_access_targeted_version(p_form_version_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and exists (
    select 1
    from public.responses resp
    join public.case_participants cp        on cp.id = resp.target_case_participant_id
    join public.professional_participants pp on pp.participant_id = cp.participant_id
    join public.professional_profiles prof  on prof.id = pp.professional_profile_id
    where resp.form_version_id = p_form_version_id
      and resp.target_case_participant_id is not null
      and cp.removed_at is null
      and prof.user_id = p_uid   -- ⇒ linked (the biconditional; see can_access_targeted_response)
  );
$$;
alter function app.can_access_targeted_version(uuid, uuid) owner to postgres;
revoke all on function app.can_access_targeted_version(uuid, uuid) from public;
grant execute on function app.can_access_targeted_version(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4 · Additive PERMISSIVE policies (OR-combined with the existing arms per command).
--     The existing responses/answers/form_* policies are UNTOUCHED.
-- -----------------------------------------------------------------------------

-- responses: read the targeted response (any status); update it while in_progress.
create policy responses_select_targeted on public.responses
  for select to authenticated
  using (app.can_access_targeted_response(id, auth.uid()));
create policy responses_update_targeted on public.responses
  for update to authenticated
  using (app.can_write_targeted_response(id, auth.uid()))
  with check (app.can_access_targeted_response(id, auth.uid()));

-- answers: read/insert/update the targeted response's answers (writes require in_progress).
create policy answers_select_targeted on public.answers
  for select to authenticated
  using (app.can_access_targeted_response(response_id, auth.uid()));
create policy answers_insert_targeted on public.answers
  for insert to authenticated
  with check (app.can_write_targeted_response(response_id, auth.uid()));
create policy answers_update_targeted on public.answers
  for update to authenticated
  using (app.can_write_targeted_response(response_id, auth.uid()))
  with check (app.can_write_targeted_response(response_id, auth.uid()));

-- form definition: render the wizard (the ONLY place D13 admits form reads).
create policy form_versions_select_targeted on public.form_versions
  for select to authenticated
  using (app.can_access_targeted_version(id, auth.uid()));
create policy form_sections_select_targeted on public.form_sections
  for select to authenticated
  using (app.can_access_targeted_version(form_version_id, auth.uid()));
create policy form_items_select_targeted on public.form_items
  for select to authenticated
  using (app.can_access_targeted_version(form_version_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- 5 · target_case_response — COORDINATOR sets the target. HC0J1 / HC0J0.
-- -----------------------------------------------------------------------------
create or replace function public.target_case_response(
  p_response_id uuid, p_case_participant_id uuid
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_phase_id uuid;
  v_commission uuid;
  v_case_id uuid;
begin
  perform app.assert_ethics_enabled();

  select case_phase_id, commission_id into v_phase_id, v_commission
  from public.responses where id = p_response_id;
  if not found then
    raise exception 'resposta não encontrada' using errcode = 'P0002';
  end if;
  -- A targeted submission must be a CASE-PHASE response (its case is the access anchor).
  if v_phase_id is null then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;
  select case_id into v_case_id from public.case_phases where id = v_phase_id;

  -- Authority: coordinator only.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar este processo ético'
      using errcode = 'HC0J1';
  end if;

  -- Ethics-typed (Lead ruling 1).
  if not exists (select 1 from public.ethics_case_details d where d.case_id = v_case_id) then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;

  -- The participant must belong to the SAME case and be LIVE (no cross-case targeting).
  if not exists (
    select 1 from public.case_participants cp
    where cp.id = p_case_participant_id and cp.case_id = v_case_id and cp.removed_at is null
  ) then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;

  update public.responses set target_case_participant_id = p_case_participant_id
  where id = p_response_id;

  perform app.audit_write('case.response_targeted', 'case', v_case_id, v_commission,
    'Resposta dirigida a um participante do caso',
    jsonb_build_object('response_id', p_response_id, 'case_participant_id', p_case_participant_id));
end;
$$;
alter function public.target_case_response(uuid, uuid) owner to postgres;
revoke all on function public.target_case_response(uuid, uuid) from public;
grant execute on function public.target_case_response(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6 · submit_targeted_case_response — the TARGETED USER submits their own defense.
--     Asserts can_access (HC0J9) + in_progress; flips to submitted WITHOUT calling
--     submit_response (that path checks authorship / can_write_case_content, which the
--     respondent fails by design). The submitted-immutability guard freezes answers.
-- -----------------------------------------------------------------------------
create or replace function public.submit_targeted_case_response(p_response_id uuid)
  returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_status text;
  v_phase_id uuid;
  v_commission uuid;
  v_case_id uuid;
begin
  perform app.assert_ethics_enabled();

  -- The ONLY authorization: the caller IS the targeted participant. Never can_read_case.
  if not app.can_access_targeted_response(p_response_id, auth.uid()) then
    raise exception 'usuário não autorizado a esta submissão dirigida' using errcode = 'HC0J9';
  end if;

  select status, case_phase_id, commission_id into v_status, v_phase_id, v_commission
  from public.responses where id = p_response_id;
  if v_status <> 'in_progress' then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;
  select case_id into v_case_id from public.case_phases where id = v_phase_id;

  update public.responses set status = 'submitted', submitted_at = now()
  where id = p_response_id;

  perform app.audit_write('case.targeted_response_submitted', 'case', v_case_id, v_commission,
    'Submissão dirigida concluída pelo participante',
    jsonb_build_object('response_id', p_response_id));
end;
$$;
alter function public.submit_targeted_case_response(uuid) owner to postgres;
revoke all on function public.submit_targeted_case_response(uuid) from public;
grant execute on function public.submit_targeted_case_response(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7 · sync_case_phase_on_submit — a targeted submission is NOT a committee phase-fill.
--     A targeted defense (responses.target_case_participant_id set) must NOT complete
--     the case_phase or fire recompute_recommendations, which calls
--     app.assert_not_case_excluded(auth.uid()) — and the targeted respondent IS
--     case-excluded by design (0072 D2·0), so that chain would raise HC0F1 and block the
--     respondent from ever submitting. Additive early-return; behavior for every
--     NON-targeted response (target_case_participant_id is null — i.e. all responses that
--     existed before BE-3b) is byte-for-byte unchanged. The rest of the body is verbatim
--     from the shipped function.
-- -----------------------------------------------------------------------------
create or replace function public.sync_case_phase_on_submit()
  returns trigger
  language plpgsql security definer
  set search_path to 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_case_status text;
begin
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  -- ETH·E2 §D13: a targeted respondent's defense does not advance the committee workflow.
  if new.target_case_participant_id is not null then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  if v_case_status in ('completed', 'cancelled') then
    return new;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = new.case_phase_id and status = 'active';
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.compute_case_phase_result(new.case_phase_id);

  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$$;
alter function public.sync_case_phase_on_submit() owner to postgres;

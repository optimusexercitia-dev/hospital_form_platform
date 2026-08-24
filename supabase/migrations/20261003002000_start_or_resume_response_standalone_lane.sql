-- ADR 0136 follow-through (FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT).
--
-- `start_or_resume_response` is the STANDALONE lane's door: its only caller is the
-- "Preencher / Continuar" affordance on `/o/[org]/c/[commission]/forms`, which routes to
-- `/forms/[formId]/responder/[responseId]`. Its resume query, however, was lane-blind —
--
--     where form_version_id = p_form_version_id
--       and created_by = v_uid
--       and status = 'in_progress'
--
-- — while the unique index it defers to on the CREATE path is not:
--
--     responses_one_draft_per_user_idx
--       unique (form_version_id, created_by)
--       where status = 'in_progress' AND case_phase_id IS NULL
--
-- The index states the rule correctly: "one draft per user per version" is a property of
-- the STANDALONE lane. A case-phase response is created by `start_or_resume_phase` and
-- bounded by its own two indexes (`responses_one_open_draft_per_phase_idx`,
-- `responses_one_root_per_case_phase_idx`).
--
-- ⛔ THE CONSEQUENCE. A member holding an `in_progress` CASE-PHASE draft on version V who
-- pressed "Preencher" on the standalone form V was handed THAT draft back, and the UI then
-- routed them into the standalone responder with it. Since ADR 0136 that route refuses a
-- case-phase response outright (it is written for the standalone lane — its back-link,
-- its confirmation screen, and the `deferStaffSignoff` resolution all are), so the path
-- ends in a 404; before the route learned its lane, the same path rendered a wizard whose
-- submit button was permanently disabled while `submit_response` would have accepted it.
-- The route guard did not create this — it made it visible.
--
-- ⚠ The state is not in `seed.sql` (it holds no `in_progress` case-phase response at all),
-- which is why no existing test could have met it. It is constructed and pinned in
-- `supabase/tests/367_deferred_staff_signoff.sql` §15, red-first: 15.1 failed against this
-- function's previous body and passes against this one, and 15.2 pins that the fix ADDS a
-- standalone draft rather than hijacking or closing the phase draft.
--
-- ⚠ ONE CONJUNCT, IN TWO PLACES — the resume SELECT and the `unique_violation`
-- re-read, which is the same query and must answer the same question. Everything
-- else — the version/commission resolve, the published-only backstop, the FF-4
-- default seeding on the create path — is byte-identical to the previous definition.
--
-- ⚠ CORRECTED 2026-08-24 (QA review, MINOR-1). This paragraph listed "the
-- unique_violation re-read" among the byte-identical parts while the code below
-- changed it, and said so in its own comment ("Same conjunct as the resume
-- branch") — a header contradicting its own body two screens down. Verified against
-- the prior definition (20260903000400, whose text IS authoritative for this
-- function: its two `pg_get_functiondef` mentions are in comments, not runtime
-- rewrites): that re-read carried no such conjunct. The CODE was right and needed
-- both sites; only this description was wrong.

create or replace function public.start_or_resume_response(p_form_version_id uuid)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
  v_uid uuid := auth.uid();
  v_result public.responses;
begin
  -- Resolve the version's form/commission and its lifecycle status.
  select f.commission_id, v.status
    into v_commission_id, v_status
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = p_form_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  -- Server backstop: only published versions are fillable (the query layer
  -- lists published only, but a hand-crafted call must not start a draft on an
  -- unpublished/archived version).
  if v_status <> 'published' then
    raise exception 'este formulário não está publicado'
      using errcode = 'check_violation';
  end if;

  -- Resume: hand back the caller's existing in_progress STANDALONE draft if one
  -- exists. `case_phase_id is null` mirrors `responses_one_draft_per_user_idx`
  -- EXACTLY — this door owns the standalone lane, and a case-phase draft belongs
  -- to `start_or_resume_phase` and its own two indexes. See the header.
  select * into v_result
  from public.responses
  where form_version_id = p_form_version_id
    and created_by = v_uid
    and status = 'in_progress'
    and case_phase_id is null;

  if v_result.id is not null then
    return v_result;
  end if;

  -- Create. The unique index guards against a concurrent create winning the
  -- race; on conflict, re-read and return the surviving draft.
  begin
    insert into public.responses (form_version_id, commission_id, created_by, status)
    values (p_form_version_id, v_commission_id, v_uid, 'in_progress')
    returning * into v_result;

    -- FF-4 (ADR 0092 ruling 5, BE-6): seed dynamic defaults exactly once, at
    -- creation. The RESUME branch above already returned for an existing
    -- draft, so this can never re-run against one -- draft-start by
    -- construction, not by a flag or a timestamp check.
    perform app.seed_default_answers(v_result.id, p_form_version_id, v_commission_id, v_uid);
  exception
    when unique_violation then
      -- Same conjunct as the resume branch: the index that raised is the
      -- standalone one, so the surviving draft to re-read is the standalone one.
      select * into v_result
      from public.responses
      where form_version_id = p_form_version_id
        and created_by = v_uid
        and status = 'in_progress'
        and case_phase_id is null;
  end;

  return v_result;
end;
$function$;

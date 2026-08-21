-- =============================================================================
-- ADR 0129 Amendment 2 — the stand-aside, repeated per lane.
--
-- WHAT WAS BROKEN. ADR 0129 taught `app.guard_meeting_child_lock` to stand aside for
-- `app.in_disposal_rpc`, and closed the class FOR THE MEETING LANE ONLY. Three sibling
-- child locks — `app.guard_rca_child_lock`, `app.guard_capa_child_lock`,
-- `app.guard_interview_child_lock` — read NO `app.in_*` GUC at all, and they sit on
-- tables `dispose_event_phi` and `dispose_case_phi` write. The raise aborts the RPC, so
-- the Class-1 PHI DELETE that ran FIRST is rolled back with it: nothing is erased.
-- Measured 2026-08-20 (`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`): `event_patient`
-- 1 -> 1, `phi_disposed_at` still NULL. A legal obligation failing closed.
--
-- ⭐ TEN STATEMENTS, FOUR GUARDS — not the nine across three the bug was filed with.
-- Re-derived from the live catalog by crossing each door's write set with every
-- row-level trigger on those tables that can `raise` (census:
-- `docs/reviews/disposal-guard-crossing-census.md`):
--   #1-#5  dispose_event_phi -> rca_factors / rca_root_causes / rca_timeline_entries /
--          rca_evidence / rca_why_chains        (guard_rca_child_lock, HC047)
--   #6-#8  dispose_event_phi -> capa_effectiveness / capa_measure_result /
--          capa_action_task                     (guard_capa_child_lock, HC049)
--   #9     dispose_case_phi  -> case_interview_subjects
--                                              (guard_interview_child_lock, 23514)
--   #10    dispose_case_phi  -> meeting_cases   (guard_meeting_child_lock, 23514)
--
-- ⭐ #10 NEEDS NO GUARD CHANGE AND APPEARS IN NO FILED RECORD. `meeting_cases` carries
-- `app.guard_meeting_child_lock`, which ALREADY reads `app.in_disposal_rpc` (ADR 0129).
-- `dispose_case_phi` simply never set it — it set `app.in_meeting_rpc` under the inline
-- comment `-- for meeting_cases child-lock`, which is FACTUALLY FALSE against the live
-- guard. That comment is corrected below (ADR 0129 Decision 2: correcting the false
-- comment is part of the change; leaving it plants the next stale-comment defect).
--
-- ⛔ SHAPE 1 STAYS REJECTED. Teaching each guard to honour its own lane's
-- `app.in_safety_rpc` / `app.in_interview_rpc` would give EVERY safety and interview RPC
-- child-write power over locked parents. This is ADR 0129 Decision 1's shape 2, repeated:
-- one narrow flag, set only by disposal doors.
--
-- ⛔ THE INVARIANT, RESTATED BECAUSE IT IS WHAT BOUNDS THE BYPASS (ADR 0129 Amdt 1):
-- it was never "exactly one guard reads the flag" — it is **only a disposal door bypasses
-- a child lock**, and *the SETTER count is what bounds that*. After this migration:
--   SETTERS: 3, all disposal doors — dispose_meeting_minutes, dispose_event_phi,
--            dispose_case_phi. (dispose_referral_phi writes no child-locked table; the
--            census names its two crossings and both are HC0D3 legal holds, by design.)
--   READERS: 5, all child-lock trigger guards — guard_meeting_child_lock,
--            guard_reserved_child_lock, guard_rca_child_lock, guard_capa_child_lock,
--            guard_interview_child_lock.
-- No non-disposal door may set it; no guard outside the child locks may read it. The
-- post-migration verification query for both halves is in the ADR 0129 Amendment 3 build
-- record.
--
-- ⚠ RESIDUAL RISK A FUTURE READER INHERITS. The stand-aside is a GUC, so a *future*
-- trigger that learns to read this flag would stand aside silently inside any open
-- window. The windows below are opened as tight as statement order allows — FOUR windows,
-- one per contiguous run of guarded child writes, so no window spans `capa_plan`,
-- `cases`, `documents` or `file_objects` at all — but tightness is a mitigation, not the
-- bound. The bound is the invariant above.
--
-- ⛔ `CREATE OR REPLACE FUNCTION` does not reset an ACL and no grant is issued here, so
-- every object below keeps the ACL it had. Censused before and after; see the build
-- record. (All five child locks carry a NULL `proacl` — the pre-existing house state for
-- `app` trigger functions, unchanged by this migration and not this migration's subject.)
-- =============================================================================

-- ── GUARD 1/3 — RCA children (HC047) ────────────────────────────────────────────────
create or replace function app.guard_rca_child_lock()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_rca_id uuid := case when tg_op = 'DELETE' then old.rca_id else new.rca_id end;
  v_status text;
begin
  select status into v_status from public.rca where id = v_rca_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status = 'completed' then
    -- THE NAMED STAND-ASIDE (ADR 0129 Decision 1, Amendment 2 — verbatim from
    -- `app.guard_meeting_child_lock`). Only the LGPD disposal doors set this flag, and
    -- only around their own child UPDATEs. Everything else — including every door that
    -- sets `app.in_safety_rpc` — still falls through to the raise below.
    -- ⛔ Do NOT widen this to `app.in_safety_rpc`. That is shape 1, rejected.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta análise está bloqueado (concluída)'
      using errcode = 'HC047';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- ── GUARD 2/3 — CAPA children (HC049) ───────────────────────────────────────────────
-- ⚠ This ONE function is the guard on SIX tables (capa_action, capa_measure,
-- capa_effectiveness, capa_action_task, capa_action_evidence, capa_measure_result);
-- `dispose_event_phi` writes three of them. Read from `pg_trigger`, not from the door.
create or replace function app.guard_capa_child_lock()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_capa_id uuid;
  v_action_id uuid;
  v_measure_id uuid;
  v_status text;
begin
  -- Resolve the owning plan id from whichever child fired.
  if tg_table_name = 'capa_action' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_measure' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_effectiveness' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_action_task' then
    v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;
    select capa_id into v_capa_id from public.capa_action where id = v_action_id;
  elsif tg_table_name = 'capa_action_evidence' then
    v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;
    select capa_id into v_capa_id from public.capa_action where id = v_action_id;
  elsif tg_table_name = 'capa_measure_result' then
    v_measure_id := case when tg_op = 'DELETE' then old.measure_id else new.measure_id end;
    select capa_id into v_capa_id from public.capa_measure where id = v_measure_id;
  end if;

  select status into v_status from public.capa_plan where id = v_capa_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status in ('completed', 'cancelled') then
    -- THE NAMED STAND-ASIDE (ADR 0129 Decision 1, Amendment 2 — verbatim).
    -- ⛔ Do NOT widen this to `app.in_safety_rpc`. That is shape 1, rejected.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo deste plano de ação está bloqueado (%)' , v_status
      using errcode = 'HC049';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- ── GUARD 3/3 — interview children (23514) ──────────────────────────────────────────
create or replace function app.guard_interview_child_lock()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_interview_id uuid;
  v_status text;
begin
  v_interview_id := case when tg_op = 'DELETE' then old.interview_id else new.interview_id end;
  select status into v_status from public.case_interviews where id = v_interview_id;

  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('completed', 'cancelled') then
    -- THE NAMED STAND-ASIDE (ADR 0129 Decision 1, Amendment 2 — verbatim).
    -- ⛔ Do NOT widen this to `app.in_interview_rpc`. That is shape 1, rejected — every
    -- interview RPC would gain child-write power over a completed/cancelled interview.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta entrevista está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- ── DOOR 1/2 — dispose_event_phi: statements #1-#5 and #6-#8 ────────────────────────
-- TWO windows, not one. The statement between them (`update public.capa_plan set
-- lessons_learned_md`) is a PARENT write guarded by `app.guard_capa_status`, which reads
-- `app.in_safety_rpc` and not this flag; excluding it costs one extra set_config pair and
-- removes the need to argue that spanning it is inert.
create or replace function public.dispose_event_phi(p_event_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_event public.patient_safety_event;
  v_rca_id uuid;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_patient_safety_enabled();

  if not (app.is_tenancy_admin_of(app.commission_of_event(p_event_id))
          or app.is_pqs_operator_of(app.hospital_of_event(p_event_id))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if v_event.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste evento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.event_patient where event_id = p_event_id;
  update public.patient_safety_event set description_md = null where id = p_event_id;
  update public.event_triage set disposition_notes_md = null where event_id = p_event_id;

  select id into v_rca_id from public.rca where event_id = p_event_id;
  if v_rca_id is not null then
    -- `app.in_safety_rpc` covers this PARENT write (`app.guard_rca_status`). It does NOT
    -- reach `app.guard_rca_child_lock` on the five child tables below, which reads
    -- `app.in_disposal_rpc` only (ADR 0129 Amdt 2).
    update public.rca
       set what_md = null, expected_md = null, summary_md = null, impact = null, scope = null
     where id = v_rca_id;

    -- ── stand-aside window 1: the RCA children, on a `completed` RCA (HC047) ──
    perform set_config('app.in_disposal_rpc', 'on', true);

    update public.rca_factors          set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_root_causes       set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_timeline_entries  set description = v_redacted  where rca_id = v_rca_id;
    -- WS-4 gap-fill: RCA evidence free-text (citation label + title) + why-chain root.
    update public.rca_evidence set title = v_redacted,
           citation_label = case when citation_label is not null then v_redacted else citation_label end
     where rca_id = v_rca_id;
    update public.rca_why_chains set root_text = v_redacted where rca_id = v_rca_id;

    perform set_config('app.in_disposal_rpc', 'off', true);
    -- ── end window 1 ──
  end if;

  -- Parent write, `app.guard_capa_status` / `app.in_safety_rpc`. Deliberately OUTSIDE
  -- both windows.
  update public.capa_plan set lessons_learned_md = null
   where source_event_id = p_event_id or (v_rca_id is not null and source_rca_id = v_rca_id);

  -- ── stand-aside window 2: the CAPA children, on a completed/cancelled plan (HC049) ──
  perform set_config('app.in_disposal_rpc', 'on', true);

  update public.capa_effectiveness ce set method_md = null
   where ce.capa_id in (select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id or (v_rca_id is not null and cp.source_rca_id = v_rca_id));
  update public.capa_measure_result cmr set note = null
   where cmr.measure_id in (select cm.id from public.capa_measure cm where cm.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id or (v_rca_id is not null and cp.source_rca_id = v_rca_id)));
  update public.capa_action_task cat set description = v_redacted
   where cat.action_id in (select ca.id from public.capa_action ca where ca.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id or (v_rca_id is not null and cp.source_rca_id = v_rca_id)));

  perform set_config('app.in_disposal_rpc', 'off', true);
  -- ── end window 2 ──

  update public.patient_safety_event
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_event_id;

  perform app.audit_write(
    'event_patient.disposed', 'event_patient', p_event_id, v_event.reporting_commission_id,
    'Dados do paciente do evento ' || v_event.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
end;
$function$;

-- ── DOOR 2/2 — dispose_case_phi: statements #9 and #10 ──────────────────────────────
-- TWO windows again: (d)'s subject notes and (g)'s per-(meeting,case) notes are not
-- adjacent, and the statements between them ((e) `cases`, (f) `documents`/`file_objects`)
-- carry no child-lock guard. Two narrow windows means no window spans them at all.
create or replace function public.dispose_case_phi(p_case_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação da comissão pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case_id);  -- ADR 0078 M1·4 (qa B2)
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso já foram descartados'
      using errcode = 'HC056';
  end if;

  -- Scoped bypasses for every frozen/submitted PARENT guard this dispose edits.
  perform set_config('app.in_case_rpc', 'on', true);
  perform set_config('app.in_narrative_rpc', 'on', true);
  perform set_config('app.in_interview_rpc', 'on', true);
  perform set_config('app.in_submit_rpc', 'on', true);   -- for the answers DELETE (submitted-freeze)
  -- ⛔ CORRECTED COMMENT (ADR 0129 Amdt 2). This used to read
  -- `-- for meeting_cases child-lock`, and that was FALSE against the live guard:
  -- `app.guard_meeting_child_lock` — the trigger on `meeting_cases` — reads
  -- `app.in_disposal_rpc` and has never read `app.in_meeting_rpc`. What this flag really
  -- stands aside is the PARENT-table guard `app.guard_meeting_status`. The child lock is
  -- handled by window 2 below. Same defect family as the one ADR 0129 was written about:
  -- a comment asserting a bypass the guard it names does not implement.
  perform set_config('app.in_meeting_rpc', 'on', true);  -- parent-table meeting guards only
  perform set_config('app.phi_dispose_reason', p_reason, true);

  -- (a) structured patient rows — N PER CASE (ADR 0064 Decision 3 / R3).
  delete from public.patient_identifiers pi
   where pi.participant_id in (
     select cp.participant_id
     from public.case_participants cp
     join public.participants p on p.id = cp.participant_id
     where cp.case_id = p_case_id and p.participant_type = 'patient'
   );

  --     Q4: redact the patient participants' registry display_name (belt-and-suspenders)
  --     and soft-remove their case links.
  update public.participants p
     set display_name = v_redacted
   where p.participant_type = 'patient'
     and p.id in (select cp.participant_id from public.case_participants cp
                  where cp.case_id = p_case_id);
  update public.case_participants cp
     set removed_at = coalesce(cp.removed_at, now())
   where cp.case_id = p_case_id
     and cp.participant_id in (
       select p.id from public.participants p where p.participant_type = 'patient');

  -- (b) case-phase ANSWERS — DELETE (patient-authored content; selections cascade via
  -- answer_selected_options FK). case_phases.result_id SURVIVES.
  delete from public.answers a
   using public.responses r, public.case_phases cp
   where a.response_id = r.id and r.case_phase_id = cp.id and cp.case_id = p_case_id;

  -- (c) narratives + case-event bodies AND titles.
  update public.case_narratives set body_md = null where case_id = p_case_id;
  update public.case_events set body = v_redacted, title = v_redacted where case_id = p_case_id;

  -- (d) interviews (summary) + interview subjects (note), for this case's interviews.
  --     The PARENT write below rides `app.in_interview_rpc` (app.guard_interview_status);
  --     the CHILD write rides `app.in_disposal_rpc` (app.guard_interview_child_lock),
  --     which is a different flag on a different guard (ADR 0129 Amdt 2).
  update public.case_interviews set summary_md = null where case_id = p_case_id;

  -- ── stand-aside window 1: interview subject notes, on a completed/cancelled
  --    interview (23514) ──
  perform set_config('app.in_disposal_rpc', 'on', true);
  update public.case_interview_subjects s set note = v_redacted
   where s.interview_id in (select id from public.case_interviews where case_id = p_case_id);
  perform set_config('app.in_disposal_rpc', 'off', true);
  -- ── end window 1 ──

  -- (e) the case label (self-labeled PHI).
  update public.cases set label = v_redacted where id = p_case_id;

  -- (f) DM2·S2 (FUP-DM1-DISPOSE discharged): case-homed documents. Titles and
  --     descriptions redact (D12); every PHI-tier bound file enters the D10
  --     disposal machine with the caller's reason (the Art. 18 lane when the
  --     reason is a subject request — see complete_document_disposal's
  --     provisional-retention gate). Standard-tier files stay untouched.
  --     ⚠ BY DESIGN, and now stated: `app.guard_document_transition` and
  --     `app.guard_file_object_transition` raise HC0D3 when an ACTIVE LEGAL HOLD binds
  --     the document, and that aborts this whole erasure. That is the same posture
  --     `dispose_referral_phi` already documents ("Blocked by an active legal hold
  --     (HC0D3) BY DESIGN — D10's rule"): a legal hold outranks an Art. 18 request, and
  --     the refusal is the correct answer, not a defect. It is NOT the child-lock class
  --     this migration fixes — a child lock protects a FINISHED committee record, a legal
  --     hold protects evidence under a live obligation.
  update public.documents d
     set title = v_redacted, description = null
   where d.home_resource_id = p_case_id;
  update public.file_objects f
     set disposal_state = 'disposal_pending', disposal_reason_category = p_reason
   where f.disposal_state = 'none' and f.sensitivity_tier = 'phi'
     and f.id in (
       select vf.file_object_id
         from public.documents d
         join public.document_versions dv on dv.document_id = d.id
         join public.document_version_files vf on vf.document_version_id = dv.id
        where d.home_resource_id = p_case_id);
  update public.documents d
     set status = 'disposal_pending'
   where d.home_resource_id = p_case_id and d.status = 'active'
     and exists (
       select 1 from public.document_versions dv
       join public.document_version_files vf on vf.document_version_id = dv.id
       join public.file_objects f on f.id = vf.file_object_id
      where dv.document_id = d.id and f.sensitivity_tier = 'phi');

  -- (g) per-(meeting,case) notes.
  -- ── stand-aside window 2: `meeting_cases` is guarded by
  --    `app.guard_meeting_child_lock`, which raises 23514 while the parent meeting is
  --    in_signature / signed / distributed / cancelled. The guard ALREADY read
  --    `app.in_disposal_rpc` (ADR 0129); this door simply never set it — statement #10,
  --    which appeared in no filed record. ──
  perform set_config('app.in_disposal_rpc', 'on', true);
  update public.meeting_cases set summary = v_redacted, decision = v_redacted where case_id = p_case_id;
  perform set_config('app.in_disposal_rpc', 'off', true);
  -- ── end window 2 ──

  -- (h) flags.
  update public.cases
     set has_patient = false, phi_disposed_at = now(),
         phi_disposed_by = auth.uid(), phi_disposed_reason = p_reason
   where id = p_case_id;

  perform app.audit_write(
    'case_patient.disposed', 'case_patient', p_case_id, v_case.commission_id,
    'Dados do paciente do caso ' || v_case.case_number || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_meeting_rpc', 'off', true);
  perform set_config('app.in_submit_rpc', 'off', true);
  perform set_config('app.in_interview_rpc', 'off', true);
  perform set_config('app.in_narrative_rpc', 'off', true);
  perform set_config('app.in_case_rpc', 'off', true);
end;
$function$;

comment on function app.guard_rca_child_lock() is
  'Child lock for RCA children: refuses writes while the parent RCA is `completed` '
  '(HC047). Stands aside for `app.in_disposal_rpc` ONLY — the LGPD erasure flag set by '
  'the disposal doors alone (ADR 0129 Decision 1 / Amendment 2).';
comment on function app.guard_capa_child_lock() is
  'Child lock for CAPA children (six tables): refuses writes while the parent plan is '
  '`completed`/`cancelled` (HC049). Stands aside for `app.in_disposal_rpc` ONLY '
  '(ADR 0129 Decision 1 / Amendment 2).';
comment on function app.guard_interview_child_lock() is
  'Child lock for interview children: refuses writes while the parent interview is '
  '`completed`/`cancelled` (23514). Stands aside for `app.in_disposal_rpc` ONLY '
  '(ADR 0129 Decision 1 / Amendment 2).';

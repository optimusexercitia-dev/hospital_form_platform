-- =============================================================================
-- ADR 0130 Amendment 4 reaches the CODE — `notify_scrub_check` stops being minted.
--
-- WHAT WAS BROKEN. `create_dsr_request` unconditionally minted one
-- `notify_scrub_check` task per request, and `close_dsr_request` raises HCDS4 while any
-- task is `pending` on a `granted` / `granted_partial` outcome. So **every granted LGPD
-- subject request was blocked until a human attested to a residue class the program
-- itself proved absent** — and the attestation text asserts, in a legal record, that a
-- residue was checked which cannot exist. ADR 0130 Amendment 4 WITHDREW Decision 9's
-- notification-scrubbing clause as premise-falsified on 2026-08-20; the withdrawal
-- reached the ADR and never reached the code.
--
-- ⚠ THE RECORDED RATIONALE IS INCOMPLETE — DO NOT REPEAT IT. Amendment 4 item 1 argues
-- that `notifications.entity_type`'s CHECK does not admit `case` / `referral` / `event`.
-- That is true and it is NOT sufficient: the CHECK also admits **`meeting`** and
-- **`capa_action`**, and the disposal doors touch both lanes. The complete argument is a
-- census of the WRITERS, not of the CHECK:
--
--   `app.enqueue_notification` is the ONLY `insert into public.notifications` in the
--   catalog, and it has 16 callers / 25 call sites (measured 2026-08-20 from `pg_proc`,
--   with `--` comments stripped so the regex cannot match commentary). Every
--   (entity_type, body-source) pair:
--     capa_action                 <- capa_action.title                       TITLE
--     meeting                     <- meetings.title (verbatim, or `title || ' — '
--                                    || <fixed string>` in the minutes-job lanes)  TITLE
--     action_item                 <- action_items.title                      TITLE
--     commission                  <- commission NAME + fixed string   PHI-free (Rule 12)
--     controlled_document(_version) <- controlled_documents.code || ' — ' || .title  TITLE
--     ethics_notification         <- ethics_notifications.notification_type
--                                    (CHECK enum) or a fixed string    PHI-free
--     response_section_signoff    <- NULL, or a form SECTION title      TITLE / empty
--
--   Cross-referenced against all four `dispose_*` door bodies: **no admitted
--   `entity_type` reachable from a disposal door carries non-title free text.** The two
--   representable subjects are `meeting` and `capa_action`; both bodies are TITLES, which
--   ADR 0131 Amendment 1's *title invariant* places OUT of erasure scope by design —
--   `dispose_meeting_minutes` deliberately never touches `meetings.title`, and
--   `dispose_event_phi` deliberately never touches `capa_action.title`. So the scrub has
--   nothing to scrub, for a better reason than the one on file.
--   (`controlled_documents.title` is a DIFFERENT table from the `documents.title` that
--   `dispose_case_phi` / `dispose_referral_phi` redact; neither door writes
--   `controlled_documents`.)
--
-- WHAT THIS MIGRATION DOES, AND DELIBERATELY DOES NOT DO.
--  ✅ Stops minting the task: the final `insert into public.dsr_tasks (...
--     'notify_scrub_check' ...)` block is removed from `create_dsr_request`. Every other
--     statement is unchanged.
--  ⛔ KEEPS `notify_scrub_check` in `dsr_tasks_kind_check` — historical rows must stay
--     valid, and `complete_dsr_task` must keep admitting the kind so any surviving row is
--     completable by a human exactly as today. Retiring the MINTING does not strand the
--     COMPLETION.
--  ⛔ NO BACKFILL, by ruling. Flipping surviving `pending` rows to `blocked` would make
--     them indistinguishable from a REFUSAL retirement — `blocked` means "retired by
--     decision" in the vocabulary `close_dsr_request` writes, and ADR 0130 Amendment 3's
--     QA-r2 correction binds: no surface may name the cause of a retirement from `status`
--     alone. **This migration touches no existing row** — true regardless of what any
--     environment holds, which is why no data-dependent statement appears below (a
--     data-dependent backfill passes a fresh reset and fails on `db push`).
--  ⛔ `close_dsr_request` is UNCHANGED. Its HCDS4 pending-task gate is correct and stays;
--     with zero `notify_scrub_check` tasks minted it simply stops firing on that account.
--  ⛔ `src/lib/dsr/messages.ts` keeps its `notify_scrub_check` render copy — a historical
--     row must still render with a correct label.
--
-- ⛔ `CREATE OR REPLACE FUNCTION` does not reset an ACL and no grant is issued here.
-- =============================================================================

create or replace function public.create_dsr_request(
  p_hospital_id uuid,
  p_mrn text,
  p_file_ref text,
  p_encounter text default null::text,
  p_due_days integer default 15
)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
  v_patient_key text;
  v_encounter_key text;
  v_request_id uuid;
  v_unroutable integer;
  v_unresolved integer;
  v_tasks integer;
  v_file text;
  v_identity_note text;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  -- ⚠ THE GATE COMES BEFORE THE LOOKUP, deliberately. `app.is_dpo_of` is false for
  -- a hospital that does not exist, so an unknown id yields 42501 rather than
  -- "hospital não encontrado" — a stranger cannot use this door to learn whether a
  -- uuid names a hospital. The org is resolved after, for the audit row.
  if not app.is_dpo_of(p_hospital_id) then
    raise exception 'apenas o Encarregado deste hospital pode registrar uma solicitação de titular'
      using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital_id);

  if btrim(coalesce(p_file_ref, '')) = '' then
    raise exception 'a referência do processo é obrigatória' using errcode = 'check_violation';
  end if;
  v_file := btrim(p_file_ref);

  -- ⚠ The reviewer needs to know WHO to look for, and the platform never stores
  -- or displays that (ADR 0130 Q6 — the record is hash-only). So every attestation
  -- task points at the paper/GED process, which is where the identity lives.
  v_identity_note := 'A plataforma não exibe a identidade do titular: consulte o processo '
                     || v_file || '. ';

  v_patient_key := app.derive_patient_key(p_mrn);
  if v_patient_key is null then
    raise exception 'o identificador do paciente é inválido' using errcode = 'check_violation';
  end if;
  v_encounter_key := app.derive_patient_key(p_encounter);

  -- ⚠ The encounter is RECORDED, never a filter. A subject request concerns the
  -- person, so the MRN determines the population; narrowing by encounter would
  -- under-enumerate the very census the request exists to produce.
  insert into public.dsr_requests (
    hospital_id, patient_key, encounter_key, file_ref, due_date, created_by
  ) values (
    p_hospital_id, v_patient_key, v_encounter_key, v_file,
    (current_date + make_interval(days => greatest(coalesce(p_due_days, 15), 1)))::date,
    auth.uid()
  )
  returning id into v_request_id;

  -- An xref row with no commission has no hospital, and so belongs to no
  -- controller. It is LOUD, not dropped: a census that silently omits a member of
  -- its own population is worthless, and completeness is this record's whole value.
  -- ⚠ Contrast, deliberate: a matched row whose commission belongs to ANOTHER
  -- hospital IS silently excluded — that is ADR 0130 Decision 4 (hospital-scoped,
  -- silently; a cross-hospital hint is itself the inference isolation prevents).
  select count(*) into v_unroutable
  from public.patient_xref x
  where x.patient_key = v_patient_key and x.commission_id is null;

  if v_unroutable > 0 then
    raise exception 'há % registro(s) do titular sem comissão atribuída; a solicitação não pode ser enumerada com segurança', v_unroutable
      using errcode = 'HCDS2';
  end if;

  -- ⚠ GRAIN, MEASURED — the module name does NOT name the entity. For
  -- module='case' the xref's entity_id is a **patient_participants id**, not a
  -- case id (app.trg_xref_maintain_patient_identifiers indexes the participant),
  -- while dispose_case_phi takes a CASE id. Resolving it is not cosmetic: without
  -- the resolution the case lane fails closed forever — complete_dsr_task would
  -- look for a `cases` row that cannot exist — and the meeting join below would
  -- compare participant ids to case ids and never match. Both would have been
  -- silent. events and referrals ARE keyed on the entity itself.
  select count(*) into v_unresolved
  from public.patient_xref x
  where x.patient_key = v_patient_key
    and x.module = 'case'
    and x.commission_id is not null
    and app.hospital_of_commission(x.commission_id) = p_hospital_id
    and app.case_of_patient_participant(x.entity_id) is null;

  if v_unresolved > 0 then
    raise exception 'há % participante(s) do titular sem caso resolvível; a solicitação não pode ser enumerada com segurança', v_unresolved
      using errcode = 'HCDS2';
  end if;

  -- Mechanical tier: one task per xref row in this hospital. An already-disposed
  -- row lands pre-completed as history (Q16iv) and never re-fires.
  insert into public.dsr_tasks (
    request_id, kind, module, entity_id, commission_id, hospital_id,
    status, completed_at, note
  )
  select v_request_id,
         'dispose_' || r.module,
         r.module, r.target_id, r.commission_id, p_hospital_id,
         case when r.disposed_at is not null then 'done' else 'pending' end,
         r.disposed_at,
         nullif(concat_ws(' ',
           case when r.disposed_at is not null
                then 'Descartado previamente em ' || to_char(r.disposed_at, 'DD/MM/YYYY') || '.' end,
           -- dispose_case_phi erases the WHOLE case, every patient participant in
           -- it. When the subject is not the only one, the executor is told so
           -- before acting; adjudication is where that becomes a decision.
           case when r.co_patients > 0
                then 'Atenção: este caso possui outros pacientes participantes e o descarte apaga os dados de todos eles.' end
         ), '')
  from (
    select x.module,
           case when x.module = 'case'
                then app.case_of_patient_participant(x.entity_id)
                else x.entity_id
           end as target_id,
           x.commission_id,
           x.disposed_at,
           case when x.module = 'case' then (
             select count(*)
             from public.case_participants cp
             join public.participants pp on pp.id = cp.participant_id
             where cp.case_id = app.case_of_patient_participant(x.entity_id)
               and pp.participant_type = 'patient'
               and cp.participant_id <> x.entity_id
           ) else 0 end as co_patients
    from public.patient_xref x
    where x.patient_key = v_patient_key
      and x.commission_id is not null
      and app.hospital_of_commission(x.commission_id) = p_hospital_id
  ) r
  -- Two participant rows resolving to the same case collapse to one task.
  on conflict (request_id, kind, entity_id) where entity_id is not null do nothing;

  -- Attested tier, part 1 — meetings that DISCUSSED the subject's case. Meetings
  -- are NOT in patient_xref, so `meeting_cases` is the only mechanical signal.
  -- ⛔ This mints attest_review, NEVER dispose_meeting: dispose_meeting_minutes
  -- erases the WHOLE minutes, and firing it over one agenda item would destroy
  -- other committees' records (ADR 0130 Amendment 2 item 3). Escalation to full
  -- disposal is `adjudicate_dsr_request`'s, per meeting, by a human.
  insert into public.dsr_tasks (
    request_id, kind, module, entity_id, commission_id, hospital_id, note
  )
  select distinct v_request_id, 'attest_review', 'meeting', m.id, m.commission_id, p_hospital_id,
         v_identity_note
         || 'Revisar a ata em busca de menções ao titular. Procedimento para remoção: '
         || 'reabrir a reunião, redigir o trecho e assinar novamente. Não existe descarte '
         || 'parcial de conteúdo bloqueado. Registre o seu nome e a quantidade de menções '
         || 'removidas. ⚠ Descreva APENAS o que foi feito: não transcreva o trecho encontrado '
         || 'nem qualquer dado que identifique o titular.'
  from public.meeting_cases mc
  join public.meetings m on m.id = mc.meeting_id
  where mc.case_id in (
          select t.entity_id from public.dsr_tasks t
          where t.request_id = v_request_id and t.kind = 'dispose_case'
        )
    and m.phi_disposed_at is null
    and app.hospital_of_commission(m.commission_id) = p_hospital_id
  on conflict (request_id, kind, entity_id) where entity_id is not null do nothing;

  -- ⭐ Attested tier, part 2 — THE PROSE WITH NO SIGNAL (ADR 0130 Decision 6,
  -- Amendment 3 item 2). `patient_xref` structurally cannot find a name typed into
  -- prose, and NOTHING links a commission's free text to a subject in either
  -- direction. So the only complete answer is a named human per commission that
  -- HOLDS such prose, and the predicate below measures exactly that: a non-case
  -- form response carrying free text, or a meeting carrying minutes/agenda prose.
  -- A commission with neither is not asked to attest to nothing.
  --
  -- ⚠ This is the honest half of the two-tier claim. Without it the "attested"
  -- tier is a tier the workflow never populates for the population it names, and
  -- the outcome record would report a completeness the platform cannot support.
  insert into public.dsr_tasks (
    request_id, kind, commission_id, hospital_id, note
  )
  select v_request_id, 'attest_review', c.id, p_hospital_id,
         v_identity_note
         || 'Revisar o conteúdo em texto livre desta comissão (respostas de formulários '
         || 'fora de casos, atas e anotações) em busca de menções ao titular. Procedimento '
         || 'para remoção em conteúdo bloqueado: reabrir a reunião, redigir o trecho e '
         || 'assinar novamente. Não existe descarte parcial de conteúdo bloqueado. Registre '
         || 'o seu nome e a quantidade de menções removidas. ⚠ Descreva APENAS o que foi '
         || 'feito: não transcreva o trecho encontrado nem qualquer dado que identifique o titular.'
  from public.commissions c
  where c.hospital_id = p_hospital_id
    and (
      exists (
        select 1
        from public.responses r
        join public.answers a on a.response_id = r.id
        where r.commission_id = c.id
          and r.case_phase_id is null
          and (coalesce(btrim(a.value #>> '{}'), '') <> ''
               or coalesce(btrim(a.observation), '') <> ''
               or coalesce(btrim(a.other_text), '') <> '')
      )
      or exists (
        select 1
        from public.meetings m
        where m.commission_id = c.id
          and m.phi_disposed_at is null
          and (coalesce(btrim(m.minutes_md), '') <> ''
               or exists (
                 select 1 from public.meeting_agenda_items ai
                 where ai.meeting_id = m.id
                   and (coalesce(btrim(ai.description), '') <> ''
                        or coalesce(btrim(ai.discussion_notes), '') <> ''
                        or coalesce(btrim(ai.resolution), '') <> '')
               ))
      )
    )
  on conflict (request_id, kind, commission_id) where entity_id is null and commission_id is not null do nothing;

  -- ⛔ THE `notify_scrub_check` TASK USED TO BE MINTED HERE (Q12a / Decision 9).
  -- REMOVED — ADR 0130 Amendment 4 withdrew the notification-scrubbing clause as
  -- premise-falsified, and the complete writer census is in this migration's header.
  -- Nothing replaces it: there is no residue class for it to attest to. The KIND stays
  -- admitted by `dsr_tasks_kind_check` and by `complete_dsr_task`, so any historical row
  -- remains valid and completable.

  select count(*) into v_tasks from public.dsr_tasks where request_id = v_request_id;

  -- ⚠ The metadata carries counts and the request id — never the patient_key.
  -- The hash is stored on the row by design; repeating it into the audit trail
  -- would widen its blast radius for no gain (Rule 11: records THAT and WHO).
  perform app.audit_write(
    'dsr.request_created', 'dsr_request', v_request_id, null,
    'Solicitação de titular registrada',
    jsonb_build_object('task_count', v_tasks, 'file_ref', v_file),
    v_org, p_hospital_id
  );

  return v_request_id;
end;
$function$;

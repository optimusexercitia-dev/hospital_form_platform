-- =============================================================================
-- DSR Slice 3, part 2 of 2 — the ADJUDICATION lane and the ATTESTED tier.
--
-- ⛔ ZERO AUTHORIZATION GATES CHANGE IN THIS FILE. The program's one named
-- widening lives in part 1 (`search_patient_xref`, ADR 0130 Decision 3). Nothing
-- here touches `dispose_case_phi`, `dispose_event_phi`, `dispose_referral_phi` or
-- `dispose_meeting_minutes` — not their gates, not their bodies. The two new
-- doors gate on `app.is_dpo_of` and `app.can_execute_dsr_task`, both existing
-- predicates called by the existing RLS policies: one definition, not a copy.
--
-- ---------------------------------------------------------------------------
-- WHAT MEASUREMENT CHANGED, AGAINST WHAT THE PLAN AND THE ADR SAY (ADR 0130
-- Amendment 3 records each of these; they are listed here because a migration
-- that silently disagrees with its ADR is how a wrong shape gets built twice):
--
-- 1. ⭐ `adjudicated` WAS UNREACHABLE. `complete_dsr_task` advanced
--    `open → executing` directly, so the lane `open → adjudicated → executing →
--    closed` was a fiction: no writer ever produced the middle state. Fixed by
--    the new door plus widening that advance to `status in ('open','adjudicated')`.
--
-- 2. ⭐ TWO OF THE ATTESTED TIER'S THREE NAMED POPULATIONS ARE MECHANICAL.
--    Measured from `dispose_case_phi`'s live body: it already erases
--    `case_narratives.body_md`, `case_events.body/title`, `case_interviews`,
--    case-phase `answers`, case-homed `documents` and `meeting_cases
--    .summary/decision`. So "narratives" and case-linked responses are in the
--    MECHANICAL tier, not the attested one. The plan's sentence (§ Slice 3 item 4)
--    predates that measurement. What is genuinely left with NO mechanical signal
--    is: meeting minutes prose (already minted per LINKED meeting in Slice 2) and
--    **non-case form responses plus assorted per-commission free text** — for
--    which no signal exists at all, in either direction. The honest population is
--    therefore one attestation per COMMISSION OF THE HOSPITAL THAT HOLDS SUCH
--    PROSE, and the predicate below is that measurement, not a guess.
--
-- 3. ⭐ THE MINTED PROCEDURE TEXT WAS DESTROYED ON COMPLETION.
--    `complete_dsr_task` wrote the caller's note over `dsr_tasks.note` — the same
--    column the fan-out uses to carry the revoke-corridor procedure. An
--    attestation task whose procedure vanishes the moment it is completed cannot
--    document the corridor it exists to document. `note` is now the immutable
--    minted PROCEDURE; `completion_note` is what the human wrote.
--
-- 4. `dsr_tasks`'s double-mint guard is a PARTIAL unique index over
--    `(request_id, kind, entity_id) WHERE entity_id IS NOT NULL`. An entity-less,
--    commission-scoped attestation is outside it and could be minted twice; a
--    second partial index closes exactly that hole.
--
-- ---------------------------------------------------------------------------
-- ⚠ RULE 12, RESTATED BECAUSE THIS FILE ADDS COLUMNS TO A DSR TABLE. Nothing
-- here holds patient data. `attested_by_name` is the STAFF MEMBER who performed
-- the review — an attestor's signature, the same class as
-- `meeting_attendees.external_name` — and never the data subject. A name or MRN
-- column on a `dsr_*` table would make a fourth PHI module; 350 pins the POSITIVE
-- column list of both tables so the well-meant "just add the name" patch reds.
--
-- ⛔ THE COLUMN PINS DO NOT COVER `completion_note`, WHICH IS FREE TEXT. A reviewer
-- who transcribes the passage they found writes cleartext patient identity into a
-- `dsr_*` row, and no CHECK can stop them. The only control on that axis is COPY,
-- and it is enumerated here so the claim can be checked rather than believed:
--   1. the minted procedure text on both attestation flavours (below), and
--   2. `DSR_ATTEST_PROCEDURE_COMMON` in `src/lib/dsr/messages.ts`, and
--   3. the note field's own placeholder + description (`dsr-attest-form.tsx`).
-- All three must say: record WHAT YOU DID, never WHAT YOU FOUND.
-- ⚠ An earlier version of this comment asserted that control as already existing
-- when items 1–3 did not contain it and the placeholder actively invited the
-- opposite ("o que foi encontrado"). QA caught it. A comment asserting a
-- safeguard that does not exist is worse than no comment, and worst of all on the
-- axis it was written to protect.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema — the decision stamp and the attestation's structured shape.
-- ---------------------------------------------------------------------------
alter table public.dsr_requests
  add column if not exists adjudicated_at timestamptz,
  add column if not exists adjudicated_by uuid references public.profiles(id);

comment on column public.dsr_requests.adjudicated_at is
  'When the Encarregado recorded the decision. The DECISION FACT, separate from '
  'the work state in `status`: a request whose execution began before adjudication '
  'stays `executing` and still carries this stamp. Resolve the value, not the noun.';

alter table public.dsr_requests
  drop constraint if exists dsr_requests_adjudication_stamped;
alter table public.dsr_requests
  add constraint dsr_requests_adjudication_stamped check (
    ((adjudicated_at is null) = (adjudicated_by is null))
    and (adjudicated_at is null or outcome is not null)
    and (status <> 'adjudicated' or adjudicated_at is not null)
  );

alter table public.dsr_tasks
  add column if not exists completion_note text,
  add column if not exists attested_by_name text,
  add column if not exists attested_redactions integer;

comment on column public.dsr_tasks.note is
  'The MINTED PROCEDURE, written by the fan-out or by adjudication. Immutable — '
  'no door overwrites it. What the human wrote goes to `completion_note`.';
comment on column public.dsr_tasks.attested_by_name is
  '⚠ THE REVIEWER — a STAFF member''s name, never the data subject''s (Rule 12). '
  'An attestor''s signature: the attested tier is a person''s statement and is '
  'reported as one in the outcome record (ADR 0130 Decision 6).';
comment on column public.dsr_tasks.attested_redactions is
  'How many mentions of the subject the reviewer removed. 0 is a real, meaningful '
  'answer — "I looked and found nothing" — and is required rather than implied.';

alter table public.dsr_tasks
  drop constraint if exists dsr_tasks_attested_redactions_nonneg;
alter table public.dsr_tasks
  add constraint dsr_tasks_attested_redactions_nonneg
    check (attested_redactions is null or attested_redactions >= 0);

-- A completed attestation without an attestor and a count is not an attestation:
-- the outcome record could not state the count it exists to state.
alter table public.dsr_tasks
  drop constraint if exists dsr_tasks_attestation_shape;
alter table public.dsr_tasks
  add constraint dsr_tasks_attestation_shape check (
    status <> 'done'
    or kind <> 'attest_review'
    or (attested_by_name is not null
        and btrim(attested_by_name) <> ''
        and attested_redactions is not null)
  );

-- And the converse: the attestation columns are meaningless on the other five
-- kinds, so they may not be populated there (a disposal task carrying a reviewer
-- name would be counted by the outcome record's attested tier).
alter table public.dsr_tasks
  drop constraint if exists dsr_tasks_attestation_only_on_attest;
alter table public.dsr_tasks
  add constraint dsr_tasks_attestation_only_on_attest check (
    kind = 'attest_review'
    or (attested_by_name is null and attested_redactions is null)
  );

-- The double-mint guard for entity-LESS, commission-scoped tasks. The existing
-- index is `WHERE entity_id IS NOT NULL` and cannot see these.
create unique index if not exists dsr_tasks_request_kind_commission_uniq
  on public.dsr_tasks (request_id, kind, commission_id)
  where entity_id is null and commission_id is not null;

-- ---------------------------------------------------------------------------
-- 2. `create_dsr_request` — the attested tier gains its measured population.
--
-- Everything else in this door is Slice 2's, verbatim: the gate-before-lookup
-- ordering, the HCDS2 refusals, the case-grain resolution, the mechanical
-- fan-out, the per-linked-meeting attestation, the residue check.
-- ---------------------------------------------------------------------------
create or replace function public.create_dsr_request(
  p_hospital_id uuid,
  p_mrn text,
  p_file_ref text,
  p_encounter text default null,
  p_due_days integer default 15
)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

  -- One residue check per request (Q12a). The automatic notification scrub in the
  -- four disposal doors is Slice 4; until then this is manual and attested.
  insert into public.dsr_tasks (request_id, kind, hospital_id, note)
  values (v_request_id, 'notify_scrub_check', p_hospital_id,
          'Verificar resíduo de dados do titular em notificações (título e corpo) das entidades descartadas e registrar o resultado.');

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
$$;

revoke all on function public.create_dsr_request(uuid, text, text, text, integer) from public, anon;
grant execute on function public.create_dsr_request(uuid, text, text, text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. ⭐ `adjudicate_dsr_request` — THE DECISION, and the ONLY place a
--    `dispose_meeting` task is ever minted.
--
-- Counsel's holding 2 (ADR 0035 Amendment 1) makes this step mandatory rather
-- than merely prudent: removal requests are decided CASE BY CASE, TOGETHER WITH
-- LEGAL CONSULTATION. The recorded `legal_consultation_ref` is that consultation;
-- an unrecorded one is the approval-without-written-scope failure this program
-- has already paid for once.
--
-- ⛔ THE MEETING ESCALATION IS EXPLICIT, PER MEETING, AND BOUNDED BY THE REQUEST.
-- ADR 0130 Amendment 2 item 3: `dispose_meeting_minutes` erases the WHOLE minutes,
-- so a mechanical mint over one agenda item would destroy other committees'
-- records. Three bounds, each of them an assertion in 350:
--   · the outcome must GRANT something — nothing is escalated to erasure on a
--     refusal or a withdrawal;
--   · the meeting must already be ENUMERATED on this request (it has this
--     request's `attest_review` task) — an arbitrary meeting id is refused HCDS2,
--     so this door cannot be used to reach a meeting the census never found;
--   · the meeting must not already be disposed — HCDS5, mirroring the door's own
--     HC056 rather than letting the executor discover it at fire time.
--
-- ⛔ AND IT MINTS A TASK, NOT AN ERASURE. `dispose_meeting_minutes` is NOT called
-- from here and its gate does not move: the DSR never fires a door on the
-- executor's behalf (Decision 2). The task is executed by whoever already holds
-- that gate, under their own session.
-- ---------------------------------------------------------------------------
create or replace function public.adjudicate_dsr_request(
  p_request_id uuid,
  p_outcome text,
  p_outcome_basis text default null,
  p_legal_consultation_ref text default null,
  p_dispose_meeting_ids uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_request public.dsr_requests;
  v_org uuid;
  v_ids uuid[] := coalesce(p_dispose_meeting_ids, '{}'::uuid[]);
  v_unknown integer;
  v_disposed integer;
  v_minted integer := 0;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  select * into v_request from public.dsr_requests where id = p_request_id;
  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  if not app.is_dpo_of(v_request.hospital_id) then
    raise exception 'apenas o Encarregado deste hospital pode registrar a decisão de uma solicitação'
      using errcode = '42501';
  end if;

  if v_request.status = 'closed' then
    raise exception 'esta solicitação já foi encerrada' using errcode = 'HCDS5';
  end if;

  -- A decision that can be silently rewritten is not a decision. Re-opening an
  -- adjudication is a deliberate act with its own paper trail, not an UPDATE.
  if v_request.adjudicated_at is not null then
    raise exception 'esta solicitação já foi decidida; a decisão registrada não pode ser reescrita'
      using errcode = 'HCDS5';
  end if;

  if p_outcome is null or p_outcome not in ('granted', 'granted_partial',
                                            'refused_retention', 'refused_identity',
                                            'withdrawn') then
    raise exception 'desfecho inválido' using errcode = 'check_violation';
  end if;

  -- LGPD Art. 18 §4 — and the pt-BR message exists so a raw 23514 never reaches a
  -- user. The CHECK constraints stay as the structural backstop underneath.
  if p_outcome in ('refused_retention', 'refused_identity')
     and btrim(coalesce(p_outcome_basis, '')) = '' then
    raise exception 'a recusa exige o fundamento legal informado ao titular'
      using errcode = 'check_violation';
  end if;

  -- ADR 0130 Amendment 1 item 3 (PO-confirmed): consultation is part of every
  -- SUBSTANTIVE adjudication. ⚠ The refusal copy cites the institutional
  -- retention policy, NEVER CFM 1821/2007 — counsel held that statute does not
  -- cover committee records, so citing it to a data subject is a false basis.
  if p_outcome in ('granted', 'granted_partial', 'refused_retention')
     and btrim(coalesce(p_legal_consultation_ref, '')) = '' then
    raise exception 'informe a referência da consulta jurídica que fundamentou a decisão'
      using errcode = 'check_violation';
  end if;

  if array_length(v_ids, 1) is not null then
    if p_outcome not in ('granted', 'granted_partial') then
      raise exception 'o descarte de atas só pode ser determinado em um desfecho de atendimento'
        using errcode = 'HCDS5';
    end if;

    -- Bounded by THIS request's enumeration. An id the census never found is not
    -- adjudicable here — the door would otherwise reach any meeting in the
    -- hospital, which is a wider reach than the request that justifies it.
    select count(*) into v_unknown
    from unnest(v_ids) as u(id)
    where not exists (
      select 1 from public.dsr_tasks t
      where t.request_id = p_request_id
        and t.kind = 'attest_review'
        and t.module = 'meeting'
        and t.entity_id = u.id
    );
    if v_unknown > 0 then
      raise exception '% reunião(ões) informada(s) não pertence(m) à enumeração desta solicitação', v_unknown
        using errcode = 'HCDS2';
    end if;

    select count(*) into v_disposed
    from public.meetings m
    where m.id = any(v_ids) and m.phi_disposed_at is not null;
    if v_disposed > 0 then
      raise exception 'a ata de % reunião(ões) informada(s) já foi descartada', v_disposed
        using errcode = 'HCDS5';
    end if;

    with minted as (
      insert into public.dsr_tasks (
        request_id, kind, module, entity_id, commission_id, hospital_id, note
      )
      select p_request_id, 'dispose_meeting', 'meeting', m.id, m.commission_id,
             v_request.hospital_id,
             'Descarte integral da ata determinado na decisão da solicitação. '
             || '⚠ O descarte apaga a ata INTEIRA — o texto da ata e a descrição, as notas de '
             || 'discussão e a resolução de todos os itens de pauta, inclusive os que não se '
             || 'referem ao titular.'
      from public.meetings m
      where m.id = any(v_ids)
      on conflict (request_id, kind, entity_id) where entity_id is not null do nothing
      returning 1
    )
    select count(*)::integer into v_minted from minted;

    -- ⛔ RETIRE THE SIBLING ATTESTATION FOR THE SAME MEETING (QA r1 M2).
    -- The fan-out minted an `attest_review` for this ata whose procedure is the
    -- revoke corridor — "reabra a reunião, edite o trecho e assine novamente". The
    -- decision has just ordered the ata erased WHOLESALE, so an executor who
    -- followed that procedure would reopen and re-sign a meeting about to be
    -- destroyed, bumping `revision` and invalidating registered prints (ADR 0126)
    -- on a record that is going away. Same harm as the refusal path's, mirrored
    -- onto the GRANTING path.
    --
    -- ⚠ IT MUST BE RETIRED, NOT MERELY HIDDEN. Suppressing the corridor text in
    -- the UI leaves the task `pending`, and `close_dsr_request` counts every
    -- pending task for a granted close — so the DPO would be blocked from closing
    -- by a task nobody should perform. Hiding an instruction while leaving its
    -- blocking effect is worse than the instruction.
    --
    -- ⚠ `and t.status = 'pending'` so an attestation a reviewer ALREADY completed
    -- keeps its statement and its redaction count: that is a named human's
    -- assertion about work they really did, and the outcome record reports it.
    -- Retiring a `done` attestation would erase evidence, not moot work.
    --
    -- ⛔ THE STRANDING BOUND, AND WHY IT IS SAFE — recorded because this is the
    -- reasoning that makes the decision defensible, not a caveat on it.
    -- If the escalated disposal is never executed, this attestation has been
    -- retired for a prose review that turned out to be needed, and adjudication is
    -- write-once so there is no un-escalate. What bounds it: the `dispose_meeting`
    -- task stays `pending`, which **keeps the request from closing as `granted`**
    -- (HCDS4), and the retired attestation stays readable under `dsr_tasks_select`.
    -- So the failure surfaces as an OPEN REQUEST, never as a closed one falsely
    -- claiming completion. ⭐ **Visible-and-wrong is recoverable; closed-and-wrong
    -- is not** — and a closed request over-claiming erasure is the exact family
    -- (`FUP-DISPOSE-DIALOG-OVERCLAIM`) this program exists to end. A reinstatement
    -- path is deliberately NOT built: it would be a second writer of a decision
    -- this program made write-once.
    update public.dsr_tasks t
       set status = 'blocked'
     where t.request_id = p_request_id
       and t.kind = 'attest_review'
       and t.module = 'meeting'
       and t.entity_id = any(v_ids)
       and t.status = 'pending';
  end if;

  -- ⚠ STATUS IS THE WORK STATE; `adjudicated_at` IS THE DECISION FACT. A request
  -- whose execution already began (Slice 2 mints executable tasks at intake, and
  -- the executors hold their doors independently of this workflow) stays
  -- `executing` and still records the decision. Reporting it as `adjudicated`
  -- would read as a regression of work that has happened.
  update public.dsr_requests
     set status = case when status = 'open' then 'adjudicated' else status end,
         outcome = p_outcome,
         outcome_basis = nullif(btrim(coalesce(p_outcome_basis, '')), ''),
         legal_consultation_ref = nullif(btrim(coalesce(p_legal_consultation_ref, '')), ''),
         adjudicated_at = now(),
         adjudicated_by = auth.uid()
   where id = p_request_id;

  v_org := app.org_of_hospital(v_request.hospital_id);
  perform app.audit_write(
    'dsr.request_adjudicated', 'dsr_request', p_request_id, null,
    'Decisão registrada na solicitação de titular',
    jsonb_build_object('outcome', p_outcome, 'meeting_disposals', v_minted),
    v_org, v_request.hospital_id
  );

  return v_minted;
end;
$$;

revoke all on function public.adjudicate_dsr_request(uuid, text, text, text, uuid[]) from public, anon;
grant execute on function public.adjudicate_dsr_request(uuid, text, text, text, uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. `close_dsr_request` — now CONSUMES the recorded decision.
--
-- THE RULE, statable in one line: **close may record a decision directly only
-- when the decision erases nothing.** `granted` / `granted_partial` require a
-- prior adjudication, because adjudication is where the erasure population —
-- including the per-meeting escalations — is finalized; a `granted` close that
-- skipped it would ship an erasure the workflow never finished enumerating. The
-- three non-erasing outcomes (`refused_retention`, `refused_identity`,
-- `withdrawn`) keep the direct one-step path, which is also the shape ADR 0130
-- Amendment 1 already drew for the two that never reach the merits.
--
-- ⚠ A SUPPLIED OUTCOME MUST MATCH THE RECORDED ONE (HCDS5). Otherwise close would
-- be a second, quieter writer of the decision — and the whole point of the
-- adjudication step is that the decision has one author and one timestamp.
--
-- ⭐ AND THE DIRECT PATH STILL STAMPS THE ADJUDICATION. `refused_retention`
-- carries a REQUIRED `legal_consultation_ref`, which makes it a *substantive*
-- adjudication under ADR 0035 Amendment 1 holding 2 (removal requests decided
-- case by case, WITH COUNSEL). A closed request whose adjudication stamp was NULL
-- would let the record say that a decision requiring counsel was never
-- adjudicated. So every closed request answers "when was this decided, and by
-- whom?" with exactly one non-null answer — either the one adjudication wrote, or
-- this one. Pinned by 350 t16.
-- ---------------------------------------------------------------------------
create or replace function public.close_dsr_request(
  p_request_id uuid,
  p_outcome text default null,
  p_outcome_basis text default null,
  p_legal_consultation_ref text default null
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_request public.dsr_requests;
  v_org uuid;
  v_pending integer;
  v_outcome text;
  v_basis text;
  v_legal text;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  select * into v_request from public.dsr_requests where id = p_request_id;
  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  if not app.is_dpo_of(v_request.hospital_id) then
    raise exception 'apenas o Encarregado deste hospital pode encerrar uma solicitação'
      using errcode = '42501';
  end if;

  if v_request.status = 'closed' then
    raise exception 'esta solicitação já foi encerrada' using errcode = 'HCDS5';
  end if;

  if p_outcome is not null
     and v_request.outcome is not null
     and p_outcome <> v_request.outcome then
    raise exception 'o desfecho informado difere da decisão já registrada para esta solicitação'
      using errcode = 'HCDS5';
  end if;

  v_outcome := coalesce(p_outcome, v_request.outcome);
  v_basis := coalesce(nullif(btrim(coalesce(p_outcome_basis, '')), ''), v_request.outcome_basis);
  v_legal := coalesce(nullif(btrim(coalesce(p_legal_consultation_ref, '')), ''),
                      v_request.legal_consultation_ref);

  -- No outcome supplied AND none recorded: the caller is closing a request that
  -- was never decided. Answer with the step they are missing, not with "invalid
  -- outcome" — the latter is true and useless.
  if v_outcome is null then
    raise exception 'registre a decisão (parecer) antes de encerrar a solicitação'
      using errcode = 'HCDS5';
  end if;

  if v_outcome not in ('granted', 'granted_partial',
                       'refused_retention', 'refused_identity',
                       'withdrawn') then
    raise exception 'desfecho inválido' using errcode = 'check_violation';
  end if;

  -- The erasing outcomes require the recorded decision. Checked BEFORE the
  -- pending-work count, deliberately: "you have not decided yet" is the more
  -- fundamental error, and answering with "3 tasks pending" would send the
  -- Encarregado to chase execution of a decision that does not exist.
  if v_outcome in ('granted', 'granted_partial') and v_request.adjudicated_at is null then
    raise exception 'registre a decisão (parecer) antes de encerrar a solicitação como atendida'
      using errcode = 'HCDS5';
  end if;

  -- LGPD Art. 18 §4 — pt-BR before the CHECK, so a raw 23514 never reaches a user.
  if v_outcome in ('refused_retention', 'refused_identity')
     and btrim(coalesce(v_basis, '')) = '' then
    raise exception 'a recusa exige o fundamento legal informado ao titular'
      using errcode = 'check_violation';
  end if;

  -- ⚠ The refusal copy cites the institutional retention policy, NEVER
  -- CFM 1821/2007 (ADR 0035 Amendment 1 holding 1).
  if v_outcome in ('granted', 'granted_partial', 'refused_retention')
     and btrim(coalesce(v_legal, '')) = '' then
    raise exception 'informe a referência da consulta jurídica que fundamentou a decisão'
      using errcode = 'check_violation';
  end if;

  if v_outcome in ('granted', 'granted_partial') then
    select count(*) into v_pending
    from public.dsr_tasks
    where request_id = p_request_id and status = 'pending';

    if v_pending > 0 then
      raise exception 'ainda há % tarefa(s) pendente(s); conclua a execução antes de encerrar como atendida', v_pending
        using errcode = 'HCDS4';
    end if;
  end if;

  update public.dsr_requests
     set status = 'closed',
         outcome = v_outcome,
         outcome_basis = v_basis,
         legal_consultation_ref = v_legal,
         -- The direct path is still an adjudication (see the header). `coalesce`
         -- so a request adjudicated earlier keeps ITS author and ITS timestamp —
         -- close never re-stamps a decision it did not make.
         adjudicated_at = coalesce(v_request.adjudicated_at, now()),
         adjudicated_by = coalesce(v_request.adjudicated_by, auth.uid()),
         closed_at = now(),
         closed_by = auth.uid()
   where id = p_request_id;

  v_org := app.org_of_hospital(v_request.hospital_id);
  perform app.audit_write(
    'dsr.request_closed', 'dsr_request', p_request_id, null,
    'Solicitação de titular encerrada',
    jsonb_build_object('outcome', v_outcome,
                       'adjudicated', v_request.adjudicated_at is not null),
    v_org, v_request.hospital_id
  );
end;
$$;

revoke all on function public.close_dsr_request(uuid, text, text, text) from public, anon;
grant execute on function public.close_dsr_request(uuid, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. `complete_dsr_task` — three changes, no gate change.
--
--   (a) `attest_review` is REFUSED here and routed to `attest_dsr_task`. An
--       attestation with no attestor name and no redaction count cannot be stated
--       in the outcome record, and an OPTIONAL structured tier is an unreliable
--       one. This deliberately supersedes 349 t24's blank-note refusal, which
--       moves to the new door (350 t20).
--   (b) The minted PROCEDURE in `note` is no longer overwritten; what the human
--       wrote goes to `completion_note`.
--   (c) The request advance now covers `adjudicated` as well as `open` — without
--       it a request decided before execution would never reach `executing`.
--
-- ⛔ The EFFECT check is unchanged and remains the whole of ADR 0130 Amendment 2
-- item 2: no door is called from here, and no gate expression is mirrored here.
-- ---------------------------------------------------------------------------
create or replace function public.complete_dsr_task(p_task_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_task public.dsr_tasks;
  v_org uuid;
  v_disposed boolean;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  select * into v_task from public.dsr_tasks where id = p_task_id;
  if not found then
    raise exception 'tarefa não encontrada' using errcode = 'P0002';
  end if;

  if not (app.can_execute_dsr_task(v_task.hospital_id, v_task.commission_id, auth.uid())
          or app.is_dpo_of(v_task.hospital_id)) then
    raise exception 'sem permissão para concluir esta tarefa' using errcode = '42501';
  end if;

  if v_task.status = 'done' then
    raise exception 'esta tarefa já foi concluída' using errcode = 'HCDS5';
  end if;

  if v_task.kind = 'attest_review' then
    raise exception 'esta é uma tarefa de revisão: use o formulário de atestação, informando quem revisou e quantas menções foram removidas'
      using errcode = 'HCDS3';
  end if;

  if v_task.kind in ('dispose_case', 'dispose_event', 'dispose_referral', 'dispose_meeting') then
    -- ⚠ A DEFINER read of the module tables, bounded to ONE boolean per row and
    -- carrying no content. It tells the caller nothing they did not already hold:
    -- the task names the entity, and the task is only visible in a scope where
    -- they wear a qualifying hat. This is the whole of the "verify the effect"
    -- shape — no door is called from here, by construction (ADR 0130 Decision 2).
    v_disposed := case v_task.module
                    when 'case' then
                      (select c.phi_disposed_at is not null from public.cases c where c.id = v_task.entity_id)
                    when 'event' then
                      (select e.phi_disposed_at is not null from public.patient_safety_event e where e.id = v_task.entity_id)
                    when 'referral' then
                      (select r.phi_disposed_at is not null from public.case_referral r where r.id = v_task.entity_id)
                    when 'meeting' then
                      (select m.phi_disposed_at is not null from public.meetings m where m.id = v_task.entity_id)
                  end;
    if not coalesce(v_disposed, false) then
      raise exception 'o descarte ainda não foi realizado neste registro; execute o descarte antes de concluir a tarefa'
        using errcode = 'HCDS3';
    end if;
  else
    -- notify_scrub_check: a residue check with no statement is not a check.
    if btrim(coalesce(p_note, '')) = '' then
      raise exception 'descreva o que foi revisado para concluir esta tarefa'
        using errcode = 'HCDS3';
    end if;
  end if;

  update public.dsr_tasks
     set status = 'done',
         completed_at = now(),
         completed_by = auth.uid(),
         completion_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), completion_note)
   where id = p_task_id;

  update public.dsr_requests
     set status = 'executing'
   where id = v_task.request_id and status in ('open', 'adjudicated');

  v_org := app.org_of_hospital(v_task.hospital_id);
  perform app.audit_write(
    'dsr.task_completed', 'dsr_task', p_task_id, v_task.commission_id,
    'Tarefa de titular concluída',
    jsonb_build_object('kind', v_task.kind, 'request_id', v_task.request_id),
    v_org, v_task.hospital_id
  );
end;
$$;

revoke all on function public.complete_dsr_task(uuid, text) from public, anon;
grant execute on function public.complete_dsr_task(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. ⭐ `attest_dsr_task` — THE ATTESTED TIER (ADR 0130 Decision 6).
--
-- The mechanical tier is what `patient_xref` found. This is the other half, and
-- it is a NAMED HUMAN'S STATEMENT, reported as one: who reviewed, and how many
-- mentions they removed. `patient_xref` structurally cannot find a name typed into
-- prose — no refactor changes that — so the honest claim is the two-tier one and
-- this door is what makes the outcome record able to state it.
--
-- ⛔ IT REDACTS NOTHING, AND NO DOOR DOES. The procedure for a found mention is
-- the revoke corridor: `reopen_meeting` (→ `revoked`, children unlock) → edit →
-- re-sign, with the revision bump correctly invalidating registered prints (ADR
-- 0126). An in-place redaction door for locked content is "the child-lock defect's
-- evil twin, a bypass that works" (ADR 0130 Decision 7) and is not built. This
-- door's job is to make the corridor DOCUMENTED IN THE TASK and the review
-- ATTRIBUTABLE — nothing more.
--
-- ⚠ Same gate as `complete_dsr_task`, the same two existing predicates. No new
-- authorization, and `app.can_execute_dsr_task`'s deliberate coarseness (ADR 0130
-- Amendment 2 item 2) is NOT mirrored or narrowed here.
-- ---------------------------------------------------------------------------
create or replace function public.attest_dsr_task(
  p_task_id uuid,
  p_reviewer_name text,
  p_redactions integer,
  p_note text
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_task public.dsr_tasks;
  v_org uuid;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  select * into v_task from public.dsr_tasks where id = p_task_id;
  if not found then
    raise exception 'tarefa não encontrada' using errcode = 'P0002';
  end if;

  if not (app.can_execute_dsr_task(v_task.hospital_id, v_task.commission_id, auth.uid())
          or app.is_dpo_of(v_task.hospital_id)) then
    raise exception 'sem permissão para concluir esta tarefa' using errcode = '42501';
  end if;

  if v_task.kind <> 'attest_review' then
    raise exception 'esta tarefa não é uma revisão; conclua-a pelo fluxo da própria tarefa'
      using errcode = 'HCDS3';
  end if;

  if v_task.status = 'done' then
    raise exception 'esta tarefa já foi concluída' using errcode = 'HCDS5';
  end if;

  -- The attestation is NOMINAL. `completed_by` records which account clicked; this
  -- records which PERSON states they reviewed the content, and the two are not
  -- always the same (an administrative assistant may operate the account).
  if btrim(coalesce(p_reviewer_name, '')) = '' then
    raise exception 'informe o nome de quem revisou o conteúdo; a atestação é pessoal e nominal'
      using errcode = 'HCDS3';
  end if;

  -- ⚠ 0 IS A REAL ANSWER and must be given, not implied. "I looked and found
  -- nothing" is the statement the outcome record needs; a NULL is "nobody said".
  if p_redactions is null or p_redactions < 0 then
    raise exception 'informe quantas menções ao titular foram removidas (use 0 se nenhuma foi encontrada)'
      using errcode = 'HCDS3';
  end if;

  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'descreva o que foi revisado para concluir esta tarefa'
      using errcode = 'HCDS3';
  end if;

  update public.dsr_tasks
     set status = 'done',
         completed_at = now(),
         completed_by = auth.uid(),
         attested_by_name = btrim(p_reviewer_name),
         attested_redactions = p_redactions,
         completion_note = btrim(p_note)
   where id = p_task_id;

  update public.dsr_requests
     set status = 'executing'
   where id = v_task.request_id and status in ('open', 'adjudicated');

  -- ⚠ The metadata carries the COUNT, not the reviewer's name and not the note:
  -- Rule 11 records THAT and WHO, never the payload. The name is on the row, under
  -- the same RLS as the task.
  v_org := app.org_of_hospital(v_task.hospital_id);
  perform app.audit_write(
    'dsr.task_attested', 'dsr_task', p_task_id, v_task.commission_id,
    'Revisão de conteúdo em texto livre atestada',
    jsonb_build_object('request_id', v_task.request_id, 'redactions', p_redactions),
    v_org, v_task.hospital_id
  );
end;
$$;

revoke all on function public.attest_dsr_task(uuid, text, integer, text) from public, anon;
grant execute on function public.attest_dsr_task(uuid, text, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. `list_dsr_disposable_meetings` — the escalation picker's lister.
--
-- WHY A DEFINER LISTER AND NOT A POLICY ARM: exactly the ADR 0130 Amendment 2
-- item 5 precedent. The Encarregado is a plain member of ONE commission by design,
-- so a meeting in a SIBLING commission of the same hospital is unreadable to them
-- — and adjudicating a whole-minutes erasure against an unidentified meeting is
-- worse than the narrow read this door grants. No shared table's read boundary
-- moves.
--
-- ⛔ IT RETURNS GOVERNANCE IDENTIFIERS ONLY — meeting number, date, commission
-- name, disposal flag. NEVER the title, never `minutes_md`, never an agenda item.
-- The Encarregado needs to know WHICH meeting, not what is in it, and this
-- program widens no content boundary.
--
-- ⚠ It adds no authorization: the gate is `app.is_dpo_of` — the same predicate
-- `dsr_requests_select` calls — over the request's OWN enumerated meetings.
-- ---------------------------------------------------------------------------
create or replace function public.list_dsr_disposable_meetings(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- ⛔ NO `taskId` IN THIS PAYLOAD, deliberately (BUG-DSR-S3-001's root cause).
  -- It shipped one and the adjudication panel posted it to
  -- `adjudicate_dsr_request`, which validates MEETING ids — so the door correctly
  -- refused HCDS2 and the escalation silently never happened. Two same-typed uuids
  -- in one payload where the caller needs exactly one is a defect generator.
  -- ⚠ And it was WRONG-GRAIN besides: `t.id` here is the **attest_review** task,
  -- which is not the `dispose_meeting` task and not anything an adjudicating caller
  -- acts on. The executor gets that id from the inbox, never from here. Removed
  -- from the jsonb AND from `DsrDisposableMeeting` in the same change, so the two
  -- cannot drift; 350 t62 pins the key list positively so a re-add goes red.
  select coalesce(jsonb_agg(jsonb_build_object(
           'meetingId', m.id,
           'commissionId', m.commission_id,
           'commissionName', c.name,
           'label', 'Reunião nº ' || m.meeting_number::text
                    || coalesce(' — ' || to_char(coalesce(m.held_at, m.scheduled_start), 'DD/MM/YYYY'), ''),
           'alreadyDisposed', m.phi_disposed_at is not null
         ) order by m.meeting_number desc), '[]'::jsonb)
  from public.dsr_requests r
  join public.dsr_tasks t
    on t.request_id = r.id and t.kind = 'attest_review' and t.module = 'meeting'
  join public.meetings m on m.id = t.entity_id
  left join public.commissions c on c.id = m.commission_id
  where r.id = p_request_id
    and app.feature_enabled('dsr')
    and app.is_dpo_of(r.hospital_id);
$$;

revoke all on function public.list_dsr_disposable_meetings(uuid) from public, anon;
grant execute on function public.list_dsr_disposable_meetings(uuid) to authenticated, service_role;

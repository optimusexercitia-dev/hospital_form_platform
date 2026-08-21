-- =============================================================================
-- DSR Slice 2, part 2 of 2 — the minimal execution corridor: the request record,
-- the task fan-out, and the three doors. ADR 0130 (all sixteen decisions) +
-- Amendment 2; plan docs/plans/dsr-workflow-plan.md § Slice 2.
--
-- Posture, per the DM1 precedent: RLS on at creation; `authenticated` holds
-- SELECT only. Every write goes through a DEFINER door — there is no write
-- policy on either table, deliberately.
--
-- ⛔ THE LOAD-BEARING CONSTRAINT (ADR 0130 Decision 2): this workflow ASSIGNS
-- disposal work; it never FIRES a disposal door. Executors fire the existing
-- module doors under their own sessions, so all four gates keep applying
-- unchanged. `complete_dsr_task` below therefore verifies the EFFECT (the module
-- row's own phi_disposed_at) and calls nothing — see Amendment 2 item 2 for why
-- mirroring the four gate expressions was rejected.
--
-- ⛔ NOT BUILT HERE, stated so the absence is not read as an oversight:
--   · no widening of search_patient_xref (ADR 0130 Decision 3 — Slice 3);
--   · no adjudication surface (Slice 3) — S2 requests go open → executing → closed;
--   · no `dispose_meeting` task is ever MINTED here (Amendment 2 item 3): the kind
--     exists for Slice 3's adjudication, because disposing a whole minutes over one
--     agenda item would destroy other committees' records. Meetings enter S2 as
--     attest_review, whose procedure is the Q10a revoke corridor.
-- =============================================================================

-- 1. dsr_requests — the adjudicated record. PHI-FREE BY CONSTRUCTION (Q6).
--
-- ⚠ RULE 12 CENSUS: this table must never grow a name / MRN / birthdate column.
-- It stores the peppered HASH and nothing that identifies a person, which is what
-- keeps "exactly three PHI modules" true. The pgTAP suite pins the POSITIVE
-- column list (not "has no name column" — a pin phrased as an absence goes
-- vacuous the moment its subject is removed).
create table public.dsr_requests (
  id                     uuid primary key default gen_random_uuid(),
  hospital_id            uuid not null references public.hospitals(id) on delete restrict,
  -- app.derive_patient_key output: HMAC-SHA256 hex of the normalized MRN.
  patient_key            text not null
    constraint dsr_requests_patient_key_not_blank check (btrim(patient_key) <> ''),
  encounter_key          text,
  -- Where the identity documents actually live: the hospital's own paper file or
  -- DMS. The platform never holds them (Q6).
  file_ref               text not null
    constraint dsr_requests_file_ref_not_blank check (btrim(file_ref) <> ''),
  status                 text not null default 'open'
    constraint dsr_requests_status_check
    check (status in ('open', 'adjudicated', 'executing', 'closed')),
  outcome                text
    constraint dsr_requests_outcome_check
    check (outcome is null or outcome in ('granted', 'granted_partial',
                                          'refused_retention', 'refused_identity',
                                          'withdrawn')),
  outcome_basis          text,
  legal_consultation_ref text,
  received_at            timestamptz not null default now(),
  due_date               date not null,
  closed_at              timestamptz,
  closed_by              uuid references public.profiles(id),
  created_by             uuid not null references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- LGPD Art. 18 §4: a declined request must be answered WITH its legal basis.
  constraint dsr_requests_refusal_basis check (
    outcome is null
    or outcome not in ('refused_retention', 'refused_identity')
    or (outcome_basis is not null and btrim(outcome_basis) <> '')
  ),
  -- ADR 0130 Amendment 1 item 3, PO-confirmed 2026-08-19: counsel's holding makes
  -- consultation part of every SUBSTANTIVE adjudication. An identity failure or a
  -- withdrawal never reaches the merits, so those two are exempt.
  constraint dsr_requests_legal_consultation check (
    outcome is null
    or outcome not in ('granted', 'granted_partial', 'refused_retention')
    or (legal_consultation_ref is not null and btrim(legal_consultation_ref) <> '')
  ),
  constraint dsr_requests_closed_stamped check (
    status <> 'closed'
    or (closed_at is not null and closed_by is not null and outcome is not null)
  )
);

comment on table public.dsr_requests is
  'ADR 0130 Q6: LGPD Art. 18 subject request. HASH-ONLY — patient_key is app.derive_patient_key output; identity documents stay in the hospital''s own files. Adding any identifying column would make this a fourth PHI module and needs an ADR amending Rule 12.';
comment on column public.dsr_requests.due_date is
  'ADR 0130 Q9iii: a BADGE, not a promise. No scheduler exists in this platform (Critical FUP C1''s finding) and nothing here is automated.';

create index dsr_requests_hospital_idx on public.dsr_requests (hospital_id, status);
create index dsr_requests_patient_key_idx on public.dsr_requests (hospital_id, patient_key);

-- 2. dsr_tasks — the execution fan-out.
create table public.dsr_tasks (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.dsr_requests(id) on delete cascade,
  kind          text not null
    constraint dsr_tasks_kind_check
    check (kind in ('dispose_case', 'dispose_event', 'dispose_referral',
                    'dispose_meeting', 'attest_review', 'notify_scrub_check')),
  module        text
    constraint dsr_tasks_module_check
    check (module is null or module in ('case', 'event', 'referral', 'meeting')),
  entity_id     uuid,
  -- Routing. commission_id null => the task is routed at the hospital level.
  commission_id uuid references public.commissions(id) on delete restrict,
  hospital_id   uuid not null references public.hospitals(id) on delete restrict,
  status        text not null default 'pending'
    constraint dsr_tasks_status_check check (status in ('pending', 'done', 'blocked')),
  note          text,
  completed_at  timestamptz,
  completed_by  uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  constraint dsr_tasks_entity_pairing check ((module is null) = (entity_id is null)),
  constraint dsr_tasks_dispose_targets_entity check (
    kind not in ('dispose_case', 'dispose_event', 'dispose_referral', 'dispose_meeting')
    or (module is not null and entity_id is not null)
  ),
  -- completed_by is NULLABLE on a done row on purpose: a pre-completed HISTORY
  -- task (Q16iv — the xref was already disposed before this request existed) has
  -- a real completion time and no actor this workflow can name.
  constraint dsr_tasks_done_stamped check (status <> 'done' or completed_at is not null)
);

comment on table public.dsr_tasks is
  'ADR 0130 Decision 2: the workflow ASSIGNS disposal work and never fires a door. Completion is verified against the module row''s own phi_disposed_at (Amdt 2 item 2), never by mirroring the four gate expressions.';

create unique index dsr_tasks_request_kind_entity_uniq
  on public.dsr_tasks (request_id, kind, entity_id)
  where entity_id is not null;
create index dsr_tasks_request_idx on public.dsr_tasks (request_id, status);
create index dsr_tasks_routing_idx on public.dsr_tasks (hospital_id, commission_id, status);

create trigger touch_dsr_requests_updated_at
  before update on public.dsr_requests
  for each row execute function app.touch_updated_at();

alter table public.dsr_requests enable row level security;
alter table public.dsr_tasks enable row level security;

revoke all on public.dsr_requests, public.dsr_tasks from anon, authenticated;
grant select on public.dsr_requests, public.dsr_tasks to authenticated;

-- 3. The routing predicate — who may EXECUTE a task in a given scope.
--
-- ⚠ This is deliberately COARSER than the four disposal gates and must stay so.
-- It answers "may this person see and act on work routed here?", not "may this
-- person fire that door?" — the door itself answers the second question, under
-- the executor's own session, and a copy of it here would be a mirror nothing
-- keeps in sync (ADR 0130 Amendment 2 item 2).
create or replace function app.can_execute_dsr_task(p_hospital_id uuid, p_commission_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.feature_enabled('dsr')
     and app.is_active(p_uid)
     and case
           when p_commission_id is not null then
             app.is_staff_admin_of_for(p_commission_id, p_uid)
             or app.is_tenancy_admin_of_for(p_commission_id, p_uid)
             or app.is_pqs_operator_of_for(p_hospital_id, p_uid)
           else
             app.is_pqs_operator_of_for(p_hospital_id, p_uid)
             or app.is_hospital_admin_of_for(p_hospital_id, p_uid)
         end;
$$;

revoke all on function app.can_execute_dsr_task(uuid, uuid, uuid) from public, anon;
grant execute on function app.can_execute_dsr_task(uuid, uuid, uuid) to authenticated, service_role;

-- 4. Read policies. ⛔ NO platform-admin arm on either table: ADR 0130 Decision 2
-- puts platform_admin outside the DSR plane entirely (ADR 0078 A35 noun rule).
create policy dsr_requests_select on public.dsr_requests
  for select to authenticated
  using (app.is_dpo_of(hospital_id));

create policy dsr_tasks_select on public.dsr_tasks
  for select to authenticated
  using (
    app.is_dpo_of(hospital_id)
    or app.can_execute_dsr_task(hospital_id, commission_id, (select auth.uid()))
  );

-- 5. Door 1 — create_dsr_request. DPO-gated; derives the key; fans out the
--    mechanical tier from patient_xref.
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
    p_hospital_id, v_patient_key, v_encounter_key, btrim(p_file_ref),
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
           -- before acting; Slice 3's adjudication is where that becomes a
           -- decision rather than a warning.
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

  -- Attested tier for meetings. Meetings are NOT in patient_xref, so the only
  -- mechanical signal is meeting_cases. ⛔ This mints attest_review, NEVER
  -- dispose_meeting: dispose_meeting_minutes erases the WHOLE minutes, and firing
  -- it over one agenda item would destroy other committees' records
  -- (ADR 0130 Amendment 2 item 3).
  insert into public.dsr_tasks (
    request_id, kind, module, entity_id, commission_id, hospital_id, note
  )
  select distinct v_request_id, 'attest_review', 'meeting', m.id, m.commission_id, p_hospital_id,
         'Revisar a ata em busca de menções ao titular. Procedimento para remoção: reabrir a reunião, redigir o trecho e assinar novamente. Não existe descarte parcial de conteúdo bloqueado.'
  from public.meeting_cases mc
  join public.meetings m on m.id = mc.meeting_id
  where mc.case_id in (
          select t.entity_id from public.dsr_tasks t
          where t.request_id = v_request_id and t.kind = 'dispose_case'
        )
    and m.phi_disposed_at is null
    and app.hospital_of_commission(m.commission_id) = p_hospital_id
  on conflict (request_id, kind, entity_id) where entity_id is not null do nothing;

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
    jsonb_build_object('task_count', v_tasks, 'file_ref', btrim(p_file_ref)),
    v_org, p_hospital_id
  );

  return v_request_id;
end;
$$;

-- 6. Door 2 — complete_dsr_task. Verifies the EFFECT; fires nothing.
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
    -- An attestation with no attestor statement is not an attestation.
    if btrim(coalesce(p_note, '')) = '' then
      raise exception 'descreva o que foi revisado para concluir esta tarefa'
        using errcode = 'HCDS3';
    end if;
  end if;

  update public.dsr_tasks
     set status = 'done',
         completed_at = now(),
         completed_by = auth.uid(),
         note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
   where id = p_task_id;

  update public.dsr_requests
     set status = 'executing'
   where id = v_task.request_id and status = 'open';

  v_org := app.org_of_hospital(v_task.hospital_id);
  perform app.audit_write(
    'dsr.task_completed', 'dsr_task', p_task_id, v_task.commission_id,
    'Tarefa de titular concluída',
    jsonb_build_object('kind', v_task.kind, 'request_id', v_task.request_id),
    v_org, v_task.hospital_id
  );
end;
$$;

-- 7. Door 3 — close_dsr_request. DPO-only; two-phase.
create or replace function public.close_dsr_request(
  p_request_id uuid,
  p_outcome text,
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

  if p_outcome in ('granted', 'granted_partial') then
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
         outcome = p_outcome,
         outcome_basis = nullif(btrim(coalesce(p_outcome_basis, '')), ''),
         legal_consultation_ref = nullif(btrim(coalesce(p_legal_consultation_ref, '')), ''),
         closed_at = now(),
         closed_by = auth.uid()
   where id = p_request_id;

  v_org := app.org_of_hospital(v_request.hospital_id);
  perform app.audit_write(
    'dsr.request_closed', 'dsr_request', p_request_id, null,
    'Solicitação de titular encerrada',
    jsonb_build_object('outcome', p_outcome),
    v_org, v_request.hospital_id
  );
end;
$$;

revoke all on function public.create_dsr_request(uuid, text, text, text, integer) from public, anon;
revoke all on function public.complete_dsr_task(uuid, text) from public, anon;
revoke all on function public.close_dsr_request(uuid, text, text, text) from public, anon;
grant execute on function public.create_dsr_request(uuid, text, text, text, integer) to authenticated, service_role;
grant execute on function public.complete_dsr_task(uuid, text) to authenticated, service_role;
grant execute on function public.close_dsr_request(uuid, text, text, text) to authenticated, service_role;

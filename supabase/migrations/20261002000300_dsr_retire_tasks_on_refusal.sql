-- =============================================================================
-- DSR Slice 3, fix — a REFUSAL retires its outstanding work.
--
-- ⛔ THE DEFECT, MEASURED. After `close_dsr_request(…, 'refused_retention', …)` on
-- a request with a full fan-out:
--
--     request  status=closed  outcome=refused_retention
--     dispose_case / dispose_event / dispose_referral  -> ALL pending
--     attest_review ×2, notify_scrub_check             -> pending
--     executor still offered 6 executable task(s) AFTER the refusal
--
-- So a decision to RETAIN left three live PHI-erasure instructions in the
-- executor's inbox, with a working affordance and no closed-request guard on
-- either completion door. The workflow was **instructing the opposite of its own
-- decision**, and it failed OPEN against a decision to retain — in a program whose
-- entire subject is adjudicated retention.
--
-- ⚠ NOT a privilege defect: the executor holds those four doors independently of
-- the DSR and could always fire them. What was wrong is that the DSR was still
-- ASKING. Nothing here widens or narrows any disposal gate.
--
-- ---------------------------------------------------------------------------
-- ⚠ THE ASYMMETRY THAT STAYS. `close_dsr_request` counts pending tasks ONLY for
-- `granted` / `granted_partial`, and that is deliberate and load-bearing:
-- requiring the disposal tasks `done` before a REFUSAL close would force the
-- executor to erase exactly the data the adjudication just decided to retain. The
-- fix is therefore to RETIRE the work, never to demand it.
--
-- ⛔ `blocked` IS REUSED, NOT MINTED — say what that costs, at the write site.
-- `dsr_tasks.status` has admitted `blocked` since Slice 2 and NOTHING has ever
-- written it. Reusing it avoids a new enum value, which is the right trade, but it
-- means the word is now doing two jobs and its plain reading — *"cannot proceed
-- yet"* — is the WRONG one here. These tasks are not waiting on anything; they are
-- retired by a decision. **That distinction lives only in
-- `dsr_requests.status = 'closed'` + a non-granting `outcome`, one join away.** Any
-- surface showing a blocked task must resolve that join and say *why*, or it
-- implies the task is queued.
--
-- ---------------------------------------------------------------------------
-- ⭐ EVERY READER OF `dsr_tasks.status` WAS SWEPT BEFORE THE VALUE WAS WRITTEN,
-- because a new value in an existing state column breaks readers that were correct
-- when the old domain was the whole domain — and none of them error. Nine SQL
-- readers (from `pg_proc`, comments stripped) + the TS layer + the UI. The question
-- asked of each was "what does this DO when it meets `blocked`?", not "is it still
-- right?":
--
--   close_dsr_request .............. counts `= 'pending'` -> retired excluded. CORRECT already.
--   create_dsr_request ............. writes only done/pending. Unaffected.
--   dsr_tasks_select (policy) ...... no status term. Unaffected — a retired task stays VISIBLE,
--                                    which is intended: the record of what was retired is the point.
--   list_my_dsr_hospitals .......... no status term. A retired task still reaches the console. Fine.
--   list_my_dsr_task_commissions ... no status term. A retired task still names its scope. Fine.
--   list_dsr_disposable_meetings ... no status term. Reachable only via adjudication, which
--                                    refuses a CLOSED request — and `blocked` is written only by
--                                    close. Ordering-safe, and that is a one-join dependency, so
--                                    it is stated rather than left to be rediscovered.
--   adjudicate_dsr_request ......... same ordering guarantee.
--   ⛔ complete_dsr_task ........... guarded ONLY `status = 'done'` -> a retired task would be
--                                    COMPLETABLE. FIXED below.
--   ⛔ attest_dsr_task ............. same omission. ⚠ The brief named only `complete_dsr_task`;
--                                    fixing one of a sibling pair is the guard-omission class this
--                                    project has already paid for. FIXED below.
--   ⛔ list_my_executable_dsr_tasks . NO status filter AT ALL -> it would keep offering retired
--                                    tasks as executable. This is the reader that made the defect
--                                    VISIBLE. FIXED below.
--
-- ⚠ TWO NON-SQL READERS, reported rather than silently assumed correct:
--   · `getDsrOutcomeRecord` counted `disposed = done` and `pending = pending`, so a
--     retired task fell into NEITHER and `total` stopped equalling its parts — the
--     census-whose-parts-don't-sum shape, in the one artifact that must not make
--     false claims. A `retired` count is added in the same change.
--   · The task card branches on `isDone = status === "done"`, so a retired task
--     renders as neither done nor actionable, with no explanation. That file is
--     `frontend`'s and is NOT edited here; they have been told it needs a case.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. `close_dsr_request` — retire the outstanding work on a non-granting outcome.
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
  v_retired integer := 0;
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

  if v_outcome is null then
    raise exception 'registre a decisão (parecer) antes de encerrar a solicitação'
      using errcode = 'HCDS5';
  end if;

  if v_outcome not in ('granted', 'granted_partial',
                       'refused_retention', 'refused_identity',
                       'withdrawn') then
    raise exception 'desfecho inválido' using errcode = 'check_violation';
  end if;

  if v_outcome in ('granted', 'granted_partial') and v_request.adjudicated_at is null then
    raise exception 'registre a decisão (parecer) antes de encerrar a solicitação como atendida'
      using errcode = 'HCDS5';
  end if;

  if v_outcome in ('refused_retention', 'refused_identity')
     and btrim(coalesce(v_basis, '')) = '' then
    raise exception 'a recusa exige o fundamento legal informado ao titular'
      using errcode = 'check_violation';
  end if;

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
         adjudicated_at = coalesce(v_request.adjudicated_at, now()),
         adjudicated_by = coalesce(v_request.adjudicated_by, auth.uid()),
         closed_at = now(),
         closed_by = auth.uid()
   where id = p_request_id;

  -- ⭐ RETIRE THE OUTSTANDING WORK. A refusal decided the records are KEPT, so
  -- every task still asking for their erasure is now wrong — and it was sitting in
  -- an executor's inbox with a working button. `blocked` here means RETIRED BY
  -- DECISION, not "waiting"; see the header on why that distinction lives one join
  -- away in `dsr_requests`.
  --
  -- ⛔ The guard is `not in ('granted','granted_partial')`, and it is unreachable on
  -- the granting path by construction: that path raises HCDS4 above unless the
  -- pending count is already ZERO, so there is nothing to retire. 350 t66 is the
  -- over-grant twin — it proves this cannot fire where it should not.
  if v_outcome not in ('granted', 'granted_partial') then
    update public.dsr_tasks
       set status = 'blocked'
     where request_id = p_request_id
       and status = 'pending';
    get diagnostics v_retired = row_count;
  end if;

  v_org := app.org_of_hospital(v_request.hospital_id);
  perform app.audit_write(
    'dsr.request_closed', 'dsr_request', p_request_id, null,
    'Solicitação de titular encerrada',
    jsonb_build_object('outcome', v_outcome,
                       'adjudicated', v_request.adjudicated_at is not null,
                       'tasks_retired', v_retired),
    v_org, v_request.hospital_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. `complete_dsr_task` — a retired task is not completable.
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

  -- The retired arm. Without it a task the workflow explicitly withdrew stays
  -- completable, and for a `dispose_*` kind the effect check would even PASS if the
  -- executor erased the record anyway — recording the erasure as workflow-sanctioned.
  --
  -- ⚠ THE MESSAGE SAYS "pela decisão registrada", NOT "junto com a solicitação".
  -- It used to say the latter, which was true when a non-granting CLOSE was the
  -- only writer of `blocked`. Escalation now retires a meeting's attestation on an
  -- OPEN, granted request — so "closed with the request" is FALSE for that cause.
  -- Two writers, one value: any copy that names the CAUSE from the value alone is
  -- wrong for one of them.
  if v_task.status = 'blocked' then
    raise exception 'esta tarefa foi encerrada pela decisão registrada e não deve mais ser executada'
      using errcode = 'HCDS5';
  end if;

  if v_task.kind = 'attest_review' then
    raise exception 'esta é uma tarefa de revisão: use o formulário de atestação, informando quem revisou e quantas menções foram removidas'
      using errcode = 'HCDS3';
  end if;

  if v_task.kind in ('dispose_case', 'dispose_event', 'dispose_referral', 'dispose_meeting') then
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

-- ---------------------------------------------------------------------------
-- 3. `attest_dsr_task` — THE SIBLING. ⚠ The brief named only `complete_dsr_task`;
--    guarding one of a pair and not the other is the omission class this project
--    has already paid for (a missing `is_active` let a deactivated user keep print
--    bytes). Both completion doors carry the same arm.
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

  if v_task.status = 'blocked' then
    raise exception 'esta tarefa foi encerrada pela decisão registrada e não deve mais ser executada'
      using errcode = 'HCDS5';
  end if;

  if btrim(coalesce(p_reviewer_name, '')) = '' then
    raise exception 'informe o nome de quem revisou o conteúdo; a atestação é pessoal e nominal'
      using errcode = 'HCDS3';
  end if;

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

  v_org := app.org_of_hospital(v_task.hospital_id);
  perform app.audit_write(
    'dsr.task_attested', 'dsr_task', p_task_id, v_task.commission_id,
    'Revisão de conteúdo em texto livre atestada',
    jsonb_build_object('request_id', v_task.request_id, 'redactions', p_redactions),
    v_org, v_task.hospital_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. `list_my_executable_dsr_tasks` — stop offering work that is not actionable.
--
-- ⚠ THIS HAD NO STATUS FILTER AT ALL, so it has been offering `done` tasks as
-- executable since Slice 2 as well — a pre-existing coarseness the `blocked` sweep
-- exposed rather than caused. The filter is `= 'pending'`, i.e. the actionable
-- domain, not `<> 'blocked'`: enumerating what IS actionable survives the next new
-- status value; enumerating what is not does not.
-- ---------------------------------------------------------------------------
create or replace function public.list_my_executable_dsr_tasks(p_hospital_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(jsonb_agg(t.id), '[]'::jsonb)
  from public.dsr_tasks t
  where app.feature_enabled('dsr')
    and t.hospital_id = p_hospital_id
    and t.status = 'pending'
    and app.can_execute_dsr_task(t.hospital_id, t.commission_id, (select auth.uid()));
$$;

-- ⛔ NO GRANT STATEMENTS IN THIS MIGRATION, DELIBERATELY. All four objects above
-- are `CREATE OR REPLACE` of PRE-EXISTING functions, and `CREATE OR REPLACE
-- FUNCTION` does not reset an ACL — their existing grants carry over untouched.
-- Applying the house `grant to authenticated, service_role` idiom to a REWRITE is
-- exactly how this slice widened `app.patient_trajectory_bundle`, the ungated PHI
-- assembler, from service_role-only (suite 152 §M1 caught it). ACLs for all four
-- are diffed from the catalog after this migration, not assumed from intent.

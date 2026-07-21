-- =============================================================================
-- Controlled-Document Redesign (ADR 0081) — §4: the scan-side producer + Remind.
--
-- ⚠ compute_due_notifications is a RUNTIME-REWRITTEN DEFINER (the ethics + charter
-- migrations inject their arms via pg_get_functiondef+replace+execute — the repo
-- pattern). RE-EMITTING its whole body from any captured text silently reverts those
-- arms (keystone-1; caught here by 262_charter_notifications). So we follow the SAME
-- pattern: a self-contained arm function + an idempotent injection into the LIVE body,
-- exactly like app.compute_due_charter_notifications().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The controlled-document review-due arm → staff_admins. The DOCUMENT arm of
-- documents_due_for_review, inlined for the GLOBAL scan (that RPC gates on
-- auth.uid(), absent in cron). due_soon within 30 days, overdue when past; weekly
-- re-fire via the ISO-week dedup bucket. Body = code + title (PHI-free metadata).
-- Flag-gated on controlled_docs (a batch — return early, no raise).
-- ---------------------------------------------------------------------------
create or replace function app.compute_due_document_review_notifications()
 returns integer
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_count integer := 0;
  v_ok boolean;
  v_week text := to_char(now(), 'IYYY"-W"IW');
  r record;
  v_signers uuid[];
  v_signer uuid;
begin
  if not app.feature_enabled('controlled_docs') then
    return 0;
  end if;

  for r in
    select d.id as document_id, d.commission_id, d.code, d.title, v.review_due_date
    from public.controlled_documents d
    join public.controlled_document_versions v on v.id = d.current_version_id
    where d.status = 'effective'
      and v.status = 'effective'
      and v.review_due_date is not null
      and v.review_due_date <= current_date + 30
  loop
    select coalesce(array_agg(principal_id), '{}'::uuid[]) into v_signers
    from public.memberships
    where commission_id = r.commission_id and role = 'staff_admin';

    foreach v_signer in array v_signers
    loop
      if r.review_due_date < current_date then
        v_ok := app.enqueue_notification(
          v_signer, r.commission_id, 'document_review_due', 'overdue', true,
          'controlled_document', r.document_id,
          'Revisão de documento atrasada', r.code || ' — ' || r.title,
          'document_review_due:' || r.document_id || ':overdue:' || v_week
        );
      else
        v_ok := app.enqueue_notification(
          v_signer, r.commission_id, 'document_review_due', 'due_soon', true,
          'controlled_document', r.document_id,
          'Revisão de documento em breve', r.code || ' — ' || r.title,
          'document_review_due:' || r.document_id || ':due_soon:' || v_week
        );
      end if;
      if v_ok then v_count := v_count + 1; end if;
    end loop;
  end loop;

  return v_count;
end;
$function$;

alter function app.compute_due_document_review_notifications() owner to postgres;
revoke all on function app.compute_due_document_review_notifications() from public;
grant execute on function app.compute_due_document_review_notifications() to authenticated, service_role;

-- Wire the arm into public.compute_due_notifications by RUNTIME-REWRITE of the LIVE
-- body (never a from-text re-emit — mirrors the charter/ethics injection). Idempotent.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.compute_due_notifications()'::regprocedure);
  if position('compute_due_document_review_notifications' in d) = 0 then
    d := replace(
      d,
      'v_count := v_count + app.compute_due_charter_notifications();',
      'v_count := v_count + app.compute_due_document_review_notifications();' || chr(10) ||
      '  v_count := v_count + app.compute_due_charter_notifications();'
    );
    execute d;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- remind_document_approver — staff_admin-of-the-commission re-enqueues a lembrete
-- to a STILL-PENDING named approver of an in_approval version. Authority enforced
-- IN THE BODY (a DEFINER gate is bypassable if left to the UI — memory:
-- definer-rpc-gate-needs-table-level-enforcement; here the RPC is the only writer).
-- Rate-limited to one per approver per day via the date dedup bucket. NEW public
-- RPC ⇒ REVOKE ALL FROM PUBLIC before GRANT (t19 guard; memory:
-- new-public-rpc-revoke-from-public).
-- ---------------------------------------------------------------------------
create or replace function public.remind_document_approver(p_version_id uuid, p_approver_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
  v_code text;
  v_title text;
  v_status text;
  v_pending boolean;
begin
  perform app.assert_controlled_docs_enabled();

  select d.commission_id, d.code, d.title, v.status
    into v_commission, v_code, v_title, v_status
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;

  -- Authority: staff_admin OR commission_admin of the owning commission (server-side).
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  if v_status <> 'in_approval' then
    raise exception 'esta versão não está aguardando aprovação' using errcode = 'HC089';
  end if;

  -- The target must be a still-pending named approver of THIS version.
  select exists (
    select 1 from public.document_approvals
    where document_version_id = p_version_id
      and approver_id = p_approver_id
      and decision is null
  ) into v_pending;
  if not v_pending then
    raise exception 'aprovador não está pendente nesta versão' using errcode = 'HC091';
  end if;

  -- Reminder (suppressible). Returns false if the notifications flag is off or the
  -- approver was already reminded today.
  return app.enqueue_notification(
    p_approver_id, v_commission, 'document_approval', 'pending', true,
    'controlled_document_version', p_version_id,
    'Lembrete: documento ' || v_code || ' aguarda sua aprovação', v_title,
    'document_approval:' || p_version_id || ':' || p_approver_id
      || ':reminded:' || to_char(current_date, 'YYYY-MM-DD')
  );
end;
$function$;

revoke all on function public.remind_document_approver(uuid, uuid) from public;
grant execute on function public.remind_document_approver(uuid, uuid) to authenticated, service_role;

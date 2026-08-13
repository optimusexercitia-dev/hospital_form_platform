-- =============================================================================
-- DM3 · M7 — the ethics document seams, discharged on ALL FIVE conditions.
-- ADR 0114 Amendment 2 / D17. A partial discharge is not a discharge.
--
--   1. real FK on both columns → documents(id)
--   2. issue_ethics_notification's p_related_document_id becomes a WORKING
--      parameter — a BODY change (CREATE OR REPLACE, ACL preserved)
--   3. the fail-closed HC0DM rejection is removed
--   4. 328 K8c is removed (companion commit; K8a/K8b survive for DM4/Wave D)
--   5. set_ethics_decision_details gains p_decision_letter_document_id — an
--      IDENTITY change (DROP+CREATE, ACL rebuilt by hand)
--
-- ⚠ CONDITIONS 2 AND 5 ARE MIRROR IMAGES AND THE ASYMMETRY IS THE TRAP.
-- issue_ethics_notification keeps its 8-arg identity, so CREATE OR REPLACE is
-- legal and the ACL survives. set_ethics_decision_details must gain a 12th
-- parameter, which CREATE OR REPLACE CANNOT do — it would mint an OVERLOAD, and
-- because args 2..11 all default to NULL the live 11-arg call from the ethics
-- screen would then be AMBIGUOUS (42725). So it is DROP+CREATE, and the DROP
-- restores the Postgres default ACL — hence the explicit re-GRANT below.
-- Asserted from pg_proc.proacl by DM3·E6, never from this comment.
--
-- ⚠ THE HOME TYPE IS THE SECURITY ARGUMENT (lead ruling Q1, ADR 0114 Am. 2).
-- An ethics letter homes on the CASE securable resource, never on a
-- controlled_document one, so it inherits the ETH·E1 spine (can_read_case +
-- confidentiality_clearance_ok) instead of Wave B's commission-membership arm.
-- The case-scope trigger below is what makes that structural rather than
-- conventional: a linked document must belong to the linking row's OWN case.
--
-- Distinct errcodes so a red is attributable to ONE barrier:
--   HC0DI  the TRIGGER's cross-case refusal (substrate; survives direct DML)
--   HC0DJ  the RPC's refusal (door; also covers "you cannot read it")
-- Observed pre-M7: a direct INSERT linking ANOTHER case's document succeeded
-- ("caught: no exception", DM3·E2) — the substrate hole this closes.
-- =============================================================================

-- --- condition 1: real FKs ----------------------------------------------------
alter table public.ethics_decision_details
  add constraint ethics_decision_details_decision_letter_document_fk
  foreign key (decision_letter_document_id)
  references public.documents (id) on delete restrict;

alter table public.ethics_notifications
  add constraint ethics_notifications_related_document_fk
  foreign key (related_document_id)
  references public.documents (id) on delete restrict;

-- --- the case-scope guard (substrate barrier) --------------------------------
create or replace function app.guard_ethics_document_case_scope()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_doc uuid;
  v_home uuid;
  v_type text;
begin
  -- ⚠ IF/ELSIF, not a CASE EXPRESSION. One trigger function serves two tables
  -- with differently-named columns; inside a CASE *expression* plpgsql resolves
  -- the field references of BOTH arms against the record, so the notification
  -- table raised 42703 'record "new" has no field
  -- "decision_letter_document_id"'. Separate statements resolve only the arm
  -- that executes.
  if tg_table_name = 'ethics_decision_details' then
    v_doc := new.decision_letter_document_id;
  else
    v_doc := new.related_document_id;
  end if;

  if v_doc is null then
    return new;
  end if;

  select d.home_resource_id, s.resource_type into v_home, v_type
    from public.documents d
    join public.securable_resources s on s.id = d.home_resource_id
   where d.id = v_doc;

  -- An ethics-linked document must be a CASE document of THIS case. That is
  -- what keeps the ETH·E1 reader set (ADR 0114 Amendment 2): a controlled- or
  -- meeting-homed document would carry a different, wider audience.
  if v_type is distinct from 'case' or v_home is distinct from new.case_id then
    raise exception
      'o documento vinculado deve pertencer a este processo ético'
      using errcode = 'HC0DI';
  end if;
  return new;
end;
$function$;

revoke all on function app.guard_ethics_document_case_scope() from public;

create trigger guard_ethics_decision_letter_scope_trg
  before insert or update of decision_letter_document_id
  on public.ethics_decision_details
  for each row execute function app.guard_ethics_document_case_scope();

create trigger guard_ethics_notification_document_scope_trg
  before insert or update of related_document_id
  on public.ethics_notifications
  for each row execute function app.guard_ethics_document_case_scope();

-- --- conditions 2 + 3: the notification door ---------------------------------
-- Body change only; the 8-arg identity and its ACL are preserved.
do $rewrite$
declare src text; mutated text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_ethics_notification';

  mutated := replace(src,
$old$  -- DM1 (ADR 0114/0116): related_document_id pointed at the dropped
  -- attachments substrate and its wave owner is an OPEN ITEM (plan Q1).
  -- PARKED, fail-closed, until the PO ruling (authority checked above).
  if p_related_document_id is not null then
    raise exception
      'anexar documento à notificação está temporariamente indisponível (migração do modelo de documentos)'
      using errcode = 'HC0DM';
  end if;$old$,
$new$  -- DM3 (ADR 0114 Amendment 2 / D17): the seam is live. Two checks, both
  -- door-side; the SUBSTRATE keeps its own independent guard (HC0DI), so
  -- neutralizing either one still leaves the other standing.
  if p_related_document_id is not null then
    -- You may not link what you cannot read: linking is a disclosure by
    -- reference, and the D15 ceiling must gate it exactly as it gates the read.
    if not app.can_read_document(p_related_document_id, auth.uid()) then
      raise exception 'documento não encontrado' using errcode = 'HC0DJ';
    end if;
    if not exists (
      select 1 from public.documents d
      where d.id = p_related_document_id
        and d.home_resource_id = p_case_id) then
      raise exception 'o documento vinculado deve pertencer a este processo ético'
        using errcode = 'HC0DJ';
    end if;
  end if;$new$);

  if mutated = src then
    raise exception 'M7: issue_ethics_notification anchor drifted — the HC0DM refusal was NOT removed';
  end if;
  execute mutated;
end $rewrite$;

-- --- condition 5: the decision-letter writer ---------------------------------
-- DROP+CREATE (identity change). See the header for why CREATE OR REPLACE is
-- not an option here.
drop function public.set_ethics_decision_details(
  uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz);

create function public.set_ethics_decision_details(
  p_decision_id uuid,
  p_sanction_type_id uuid default null,
  p_sanction_start_date date default null,
  p_sanction_end_date date default null,
  p_remediation_required boolean default null,
  p_remediation_description_md text default null,
  p_external_reporting_required boolean default null,
  p_external_reporting_target text default null,
  p_external_reporting_deadline timestamptz default null,
  p_appeal_allowed boolean default null,
  p_appeal_deadline timestamptz default null,
  p_decision_letter_document_id uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare v_case_id uuid; v_commission uuid; v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_org := app.org_of_commission(v_commission);
  if p_sanction_type_id is not null and not exists (
       select 1 from public.ethics_sanction_types s where s.id = p_sanction_type_id and s.organization_id = v_org) then
    raise exception 'tipo de sanção inválido' using errcode = 'HC0J0';
  end if;
  if p_external_reporting_target is not null
     and p_external_reporting_target not in ('crm','cfm','legal_department','police','other') then
    raise exception 'destino de comunicação externa inválido' using errcode = 'HC0J0';
  end if;
  -- DM3 (D17): the decision letter, gated exactly like the notification seam.
  -- The substrate trigger (HC0DI) is the independent second barrier.
  if p_decision_letter_document_id is not null then
    if not app.can_read_document(p_decision_letter_document_id, auth.uid()) then
      raise exception 'documento não encontrado' using errcode = 'HC0DJ';
    end if;
    if not exists (
      select 1 from public.documents d
      where d.id = p_decision_letter_document_id
        and d.home_resource_id = v_case_id) then
      raise exception 'o documento vinculado deve pertencer a este processo ético'
        using errcode = 'HC0DJ';
    end if;
  end if;
  insert into public.ethics_decision_details as d
    (decision_id, case_id, sanction_type_id, sanction_start_date, sanction_end_date,
     remediation_required, remediation_description_md, external_reporting_required,
     external_reporting_target, external_reporting_deadline, appeal_allowed, appeal_deadline,
     decision_letter_document_id)
  values (p_decision_id, v_case_id, p_sanction_type_id, p_sanction_start_date, p_sanction_end_date,
     coalesce(p_remediation_required, false), nullif(btrim(p_remediation_description_md), ''),
     coalesce(p_external_reporting_required, false), p_external_reporting_target,
     p_external_reporting_deadline, coalesce(p_appeal_allowed, true), p_appeal_deadline,
     p_decision_letter_document_id)
  on conflict (decision_id) do update set
    sanction_type_id            = coalesce(excluded.sanction_type_id, d.sanction_type_id),
    sanction_start_date         = coalesce(excluded.sanction_start_date, d.sanction_start_date),
    sanction_end_date           = coalesce(excluded.sanction_end_date, d.sanction_end_date),
    remediation_required        = coalesce(p_remediation_required, d.remediation_required),
    remediation_description_md  = coalesce(excluded.remediation_description_md, d.remediation_description_md),
    external_reporting_required = coalesce(p_external_reporting_required, d.external_reporting_required),
    external_reporting_target   = coalesce(excluded.external_reporting_target, d.external_reporting_target),
    external_reporting_deadline = coalesce(excluded.external_reporting_deadline, d.external_reporting_deadline),
    appeal_allowed              = coalesce(p_appeal_allowed, d.appeal_allowed),
    appeal_deadline             = coalesce(excluded.appeal_deadline, d.appeal_deadline),
    decision_letter_document_id = coalesce(excluded.decision_letter_document_id, d.decision_letter_document_id),
    updated_at                  = now();
  perform app.audit_write('case.decision_details_set', 'case', v_case_id, v_commission,
    'Detalhes da decisão definidos', jsonb_build_object('decision_id', p_decision_id));
end;
$function$;

-- ⚠ NOT OPTIONAL: the DROP above discarded the ACL. Without these two lines the
-- function ships with the Postgres default (PUBLIC EXECUTE, no authenticated
-- grant) — the "a rebuild loses properties" class. DM3·E6 asserts the result
-- from the catalog on the 12-ARG identity.
revoke all on function public.set_ethics_decision_details(
  uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz, uuid) from public;
grant execute on function public.set_ethics_decision_details(
  uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz, uuid)
  to authenticated, service_role;

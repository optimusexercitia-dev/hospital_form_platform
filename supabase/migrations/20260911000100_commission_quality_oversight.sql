-- =============================================================================
-- QO·A M2 — commission oversight classification (ADR 0100 D8/D9).
--
-- `commissions.quality_oversight` fails CLOSED ('excluded' default): onboarding
-- opts each clinical committee in; a sensitive committee (Ética) is simply never
-- opted in. The column is an AUTHORIZATION INPUT, so it gets the full
-- set_case_visibility/M6 discipline: a guarded, audited DEFINER door is the ONLY
-- writer, and a BEFORE UPDATE trigger blocks raw column writes — load-bearing,
-- not belt-and-braces: `commissions` grants authenticated full table DML behind
-- `commissions_admin_write` (is_admin OR org_admin OR hospital_admin), so without
-- the trigger any of those — including platform_admin — flips the column by raw
-- PATCH, silently (trg_audit_commissions diffs only name/slug).
--
-- Door authority (D9): is_hospital_admin_of OR is_org_admin_of. platform_admin
-- stays OUT (noun rule — this is commission-content adjacency, not tenancy).
-- The committee itself (staff_admin) cannot opt out. Error codes: 42501
-- authority · HC0L0 invalid value · P0002 unknown commission — distinct
-- SQLSTATEs per failure class (authz-handoff §7.1's structural defence).
--
-- NOTE on the audit trail: trg_audit_commissions fires on EVERY commissions
-- UPDATE and will emit its generic `commission.updated` row (empty name/slug
-- diff) beside the explicit `commission.oversight_changed` verb below. That is
-- pre-existing behavior for every commission update; the explicit verb is the
-- record of THIS action (pinned by pgTAP 307).
-- =============================================================================

alter table public.commissions
  add column quality_oversight text not null default 'excluded'
  constraint commissions_quality_oversight_check
  check (quality_oversight in ('visible', 'excluded'));

comment on column public.commissions.quality_oversight is
  'ADR 0100 D8 — quality-office oversight classification. ''visible'' opts the '
  'committee into the hospital quality office''s cross-committee read (S7 arm + '
  'aggregate dashboards); ''excluded'' (default) keeps it invisible to that arm. '
  'Written ONLY via public.set_commission_oversight (guard trigger blocks raw '
  'writes); PHI-free.';

-- -----------------------------------------------------------------------------
-- The guard trigger (copies app.guard_case_visibility verbatim, new GUC).
-- -----------------------------------------------------------------------------
create function app.guard_commission_oversight()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_commission_rpc', true), 'off') = 'on';
begin
  -- ⚠ `BEFORE UPDATE OF quality_oversight` fires when the column is MENTIONED in
  -- the SET list, NOT when it changes. The `is distinct from` test is therefore
  -- mandatory: without it, a full-row PATCH carrying an UNCHANGED value would eat
  -- a spurious raise (the guard_case_visibility lesson, kept verbatim).
  if new.quality_oversight is distinct from old.quality_oversight and not v_in_rpc then
    raise exception 'commission oversight changes must go through set_commission_oversight'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger guard_commission_oversight_trg
  before update of quality_oversight on public.commissions
  for each row execute function app.guard_commission_oversight();

-- -----------------------------------------------------------------------------
-- The door.
-- -----------------------------------------------------------------------------
create function public.set_commission_oversight(p_commission_id uuid, p_oversight text)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_comm public.commissions;
begin
  select * into v_comm from public.commissions where id = p_commission_id;
  if v_comm.id is null then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;

  -- AUTHORITY FIRST (42501), VALIDATION SECOND (HC0L0) — ADR 0078 M1·4 ordering,
  -- preserved deliberately: a keystone whose principal lacks authority fails
  -- LOUDLY here instead of being silently caught by a throws_ok aimed at the
  -- validation code. D9: hospital_admin OR org_admin; the committee cannot opt
  -- itself out; platform_admin stays out (noun rule).
  if not (app.is_hospital_admin_of(v_comm.hospital_id) or app.is_org_admin_of(v_comm.organization_id)) then
    raise exception 'apenas o administrador do hospital ou da organização pode alterar a supervisão da qualidade'
      using errcode = '42501';
  end if;

  if p_oversight is null or p_oversight not in ('visible', 'excluded') then
    raise exception 'classificação de supervisão inválida' using errcode = 'HC0L0';
  end if;

  -- Transaction-local GUC bracket: opens the guard above for exactly this write.
  perform set_config('app.in_commission_rpc', 'on', true);
  update public.commissions set quality_oversight = p_oversight where id = p_commission_id;
  perform set_config('app.in_commission_rpc', 'off', true);

  -- Explicit verb — PHI-free metadata (Rule 11): classification values + ids
  -- only, never committee content.
  perform app.audit_write('commission.oversight_changed', 'commission', p_commission_id, p_commission_id,
    'Supervisão da qualidade alterada',
    jsonb_build_object(
      'quality_oversight', p_oversight,
      'previous_quality_oversight', v_comm.quality_oversight));
end;
$function$;

revoke all on function public.set_commission_oversight(uuid, text) from public;
grant execute on function public.set_commission_oversight(uuid, text) to service_role;
grant execute on function public.set_commission_oversight(uuid, text) to authenticated;

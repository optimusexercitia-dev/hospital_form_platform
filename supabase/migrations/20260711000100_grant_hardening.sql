-- =============================================================================
-- WS-2 · Grant hardening — C-1, C-2, C-4
-- =============================================================================
-- Pre-pilot DB hardening, item #2 (reuses the WS-1 audit/DEFINER patterns).
-- Detail: docs/plans/pre-pilot-db-hardening-program.md §1 WS-2 (+ the C-4 box);
--         docs/reviews/external-db-audit-2026-07-evaluation.md §2 (C-4);
--         docs/decisions/0053-audit-access-entitlement-guard.md (C-4 rationale).
--
-- C-1  Lock down audit_log DML from authenticated + add a BEFORE TRUNCATE arm to the
--      immutability guard (row triggers never fire on TRUNCATE). Latent (no exposed
--      raw-SQL/TRUNCATE door), hardened because it is free on a tamper-evidence table.
-- C-2  Flip the blanket `ALTER DEFAULT PRIVILEGES … GRANT ALL … TO authenticated` to
--      revoke-the-default + grant-per-object going forward (posture change; no mass
--      revoke on the 75 existing RLS-enabled tables).
-- C-4  Entitlement guard INSIDE log_audit_access (NOT a revoke — 6 app callers invoke
--      it as authenticated; the actor is server-derived so no framing risk). Dispatch
--      on p_action to the entity's OWN can_read_* predicate: "if you could read it, you
--      may audit that read." Closes cross-tenant forgery of who-read-what rows.
--
-- Reset-OK (pre-launch): no back-compat migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- C-1 · audit_log DML lockdown + TRUNCATE guard
-- -----------------------------------------------------------------------------
-- The baseline grants ALL to authenticated (incl. INSERT/UPDATE/DELETE/TRUNCATE);
-- audit_write is SECURITY DEFINER (owner postgres) so it still inserts. Leave SELECT
-- (the 4-tier audit_log_select policy, 20260709000300, stays). No client ever writes
-- audit_log directly — every row is minted by audit_write behind its chain lock.
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- The immutability guard (app.guard_audit_immutable, HC042) is wired BEFORE DELETE OR
-- UPDATE FOR EACH ROW — but row-level triggers NEVER fire on TRUNCATE. Add a
-- statement-level BEFORE TRUNCATE arm so a TRUNCATE also raises HC042 (defence in depth
-- behind the revoke). This catches a service_role TRUNCATE and — importantly — an
-- ACCIDENTAL TRUNCATE that reaches audit_log by CASCADE (audit_log FKs commissions, so
-- `truncate commissions cascade` would otherwise silently wipe the trail).
--
-- A dedicated statement-level function (not the row-level guard) so it can carry the
-- ONE legitimate escape: a deliberate maintenance path may set the session GUC
-- `app.allow_audit_teardown = 'on'` to permit the truncate (used by the pgTAP fixture's
-- hermetic tenant-tree teardown, and available to a future audited maintenance
-- migration). This is NOT a client bypass: `authenticated` has no TRUNCATE grant at all
-- (revoked above), so setting the GUC changes nothing for a client — the escape only
-- relaxes the belt-and-suspenders trigger for a grant-holder (service_role / owner)
-- that has opted in explicitly. Default (GUC unset) = raise. See ADR 0053 note.
create or replace function app.guard_audit_truncate() returns trigger
  language plpgsql
  set search_path to 'app', 'pg_catalog'
as $$
begin
  if coalesce(current_setting('app.allow_audit_teardown', true), 'off') = 'on' then
    return null;
  end if;
  raise exception 'os registros de auditoria são imutáveis (TRUNCATE bloqueado)'
    using errcode = 'HC042';
end;
$$;
alter function app.guard_audit_truncate() owner to postgres;

drop trigger if exists guard_audit_immutable_truncate_trg on public.audit_log;
create trigger guard_audit_immutable_truncate_trg
  before truncate on public.audit_log
  for each statement execute function app.guard_audit_truncate();

comment on trigger guard_audit_immutable_truncate_trg on public.audit_log is
  'WS-2 C-1: TRUNCATE arm of the append-only guard. Raises HC042 on any TRUNCATE '
  '(direct OR by cascade from a parent table), UNLESS the session GUC '
  'app.allow_audit_teardown = ''on'' (deliberate maintenance opt-in). No client bypass: '
  'authenticated has no TRUNCATE grant regardless of the GUC.';

-- -----------------------------------------------------------------------------
-- C-2 · Flip default privileges: revoke the blanket authenticated default; grant
--       per-object going forward.
-- -----------------------------------------------------------------------------
-- POSTURE CHANGE (documented in backend-state): the baseline carried Supabase's stock
-- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON
-- {TABLES,FUNCTIONS,SEQUENCES} TO authenticated` (baseline ~24927/24936/24945). That
-- makes any FUTURE table created without RLS world-readable/writable by every logged-in
-- user. Revoke the blanket authenticated default here. postgres + service_role defaults
-- are LEFT INTACT (service_role must retain full access).
--
-- >>> FORWARD RULE for every future migration: a new public table/function gets NO
--     authenticated privilege by default — GRANT explicitly (the established habit:
--     `revoke all from public; grant … to authenticated, service_role`). RLS still
--     backstops tables, but do not rely on it: grant the minimum the feature needs. <<<
--
-- NOT a mass revoke: the 75 existing tables keep their explicit per-object grants and
-- are all RLS-enabled (deny-by-default backstop) — verified via catalog check at
-- author time (reported at the gate).
alter default privileges for role postgres in schema public revoke all on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on functions from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from authenticated;

-- -----------------------------------------------------------------------------
-- C-4 · Entitlement guard inside log_audit_access
-- -----------------------------------------------------------------------------
-- app._audit_access_authorized(action, entity_id, commission): does auth.uid() have
-- standing to emit THIS audit row? Dispatch on the action to the entity's OWN read
-- predicate keyed on (entity_id, auth.uid()). This is byte-for-byte the authorization
-- every legitimate caller (8 SQL DEFINER doors + 9 app-layer call sites) already passed
-- before logging, so all succeed; a forger passing a foreign entity they cannot read
-- fails. Standing is NOT checked against p_commission for entity-scoped actions — the
-- caller's standing may be on a DIFFERENT commission/hospital than the (correct)
-- attribution commission (custody transfer moves an event to another commission; a PQS
-- operator is hospital-scoped, not a commission_members row). See ADR 0053.
--
-- auth.uid() resolves inside this DEFINER helper (it reads the request-scoped JWT GUC,
-- independent of the function's security context); the can_read_* predicates take the
-- uid explicitly.
create or replace function app._audit_access_authorized(
  p_action text, p_entity_id uuid, p_commission uuid
) returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_resp_commission uuid;
  v_commission uuid;
begin
  if v_uid is null then
    return false;
  end if;
  -- Platform admin has standing everywhere (mirrors the audit read tier).
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  -- === Per-action dispatch. EVERY allow-listed action in log_audit_access MUST have
  -- an arm here (fail-closed: unmapped => the ELSE denies; the 191 completeness pgTAP
  -- asserts allow-list ⊆ this map so a new .viewed action can't silently fall through). ===
  case p_action
    -- Case entity-scoped reads (entity_id = case id).
    when 'case.opened' then
      return app.can_read_case(p_entity_id, v_uid);
    when 'case_patient.read' then
      return app.can_read_case_patient(p_entity_id, v_uid);

    -- Patient-safety event / triage (entity_id = event id).
    when 'event_patient.read' then
      return app.can_read_event_patient(p_entity_id, v_uid);
    when 'safety_event.viewed' then
      return app.can_read_event(p_entity_id, v_uid);
    when 'triage.viewed' then
      return app.can_read_event(p_entity_id, v_uid);

    -- RCA (entity_id = rca id) → resolve its event, then can_read_event (inline, 1 use).
    when 'rca.viewed' then
      select event_id into v_event from public.rca where id = p_entity_id;
      return v_event is not null and app.can_read_event(v_event, v_uid);

    -- CAPA (entity_id = capa_plan id).
    when 'capa.viewed' then
      return app.can_read_capa(p_entity_id, v_uid);

    -- Meeting / interview detail-open (entity_id = meeting / interview id). Both
    -- tables are governed by the same RLS SELECT shape — is_member_of(commission) OR
    -- is_commission_admin_of(commission) — so resolve the row's own commission and
    -- apply that predicate (no can_read_* function exists for these).
    when 'meeting.viewed' then
      select commission_id into v_commission from public.meetings where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));
    when 'interview.viewed' then
      select commission_id into v_commission from public.case_interviews where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));

    -- Referrals (entity_id = referral id). Both the PHI-identifier read and the
    -- PHI-bearing detail-open are gated on can_read_referral_phi upstream.
    when 'referral.viewed' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    when 'referral_patient.read' then
      return app.can_read_referral_phi(p_entity_id, v_uid);

    -- Foreign submitted-response open (entity_id = response id). Governed by the
    -- responses_select staff_admin path; resolve the response's own commission.
    when 'response.opened_foreign' then
      select commission_id into v_resp_commission from public.responses where id = p_entity_id;
      return v_resp_commission is not null
             and (app.is_staff_admin_of(v_resp_commission)
                  or app.is_commission_admin_of(v_resp_commission));

    -- Coarse export actions: entity_id is a form/opaque id with NO per-entity read
    -- predicate, so standing is checked against p_commission (the route-handler gate:
    -- staff_admin or commission_admin of that commission). Residual: entity_id is not
    -- cross-checked against p_commission — same-actor/same-scope, and a caller still
    -- cannot pass a p_commission they lack standing in (ADR 0053).
    when 'response.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));
    when 'audit.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));

    else
      -- Fail-closed: an allow-listed-but-unmapped action denies (never opens the hole).
      -- The 191 completeness test prevents this from ever reaching prod.
      return false;
  end case;
end;
$$;
alter function app._audit_access_authorized(text, uuid, uuid) owner to postgres;
comment on function app._audit_access_authorized(text, uuid, uuid) is
  'WS-2 C-4: entitlement guard for log_audit_access. Dispatches each allow-listed '
  'action to the entity''s own can_read_* predicate (entity-scoped) or a p_commission '
  'staff_admin/commission_admin check (coarse exports). "If you could read it, you may '
  'audit that read." Fail-closed on an unmapped action. Closes cross-tenant who-read-'
  'what forgery (ADR 0053). Platform admin has standing everywhere.';
revoke all on function app._audit_access_authorized(text, uuid, uuid) from public;
grant execute on function app._audit_access_authorized(text, uuid, uuid) to authenticated, service_role;

-- log_audit_access: keep the verb allow-list, then require entitlement before
-- audit_write. Body otherwise unchanged (actor + org derivation stay in audit_write).
create or replace function public.log_audit_access(
  p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    -- Phase 22 (referrals): the audited PHI-identifier read + the PHI-bearing
    -- detail open (snapshot/reply bodies).
    'referral_patient.read', 'referral.viewed',
    -- case_patient (ADR 0038): the audited case-identifier read door.
    'case_patient.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;

  -- WS-2 C-4: the caller must have standing to emit this row (entitlement guard).
  -- Closes the who-read-what forgery vector — a caller cannot mint a chain-valid row
  -- into a commission/entity they have no relationship with (ADR 0053).
  if not app._audit_access_authorized(p_action, p_entity_id, p_commission) then
    raise exception 'log_audit_access: sem permissão para registrar este acesso'
      using errcode = '42501';
  end if;

  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;
alter function public.log_audit_access(text, text, uuid, uuid, text, jsonb) owner to postgres;

-- t19 grant hygiene (MEMORY): CREATE OR REPLACE resets grants to PUBLIC-executable.
-- Re-assert authenticated/service_role-only (the pre-migration posture, baseline:23951).
revoke all on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) from public;
grant execute on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) to authenticated, service_role;

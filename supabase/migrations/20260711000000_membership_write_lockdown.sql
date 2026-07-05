-- =============================================================================
-- WS-1 · Membership write-path lockdown (C-3; closes H-6, H-7)
-- =============================================================================
-- Pre-pilot DB hardening, item #1. Authoritative design:
--   docs/plans/membership-write-path-lockdown.md
--   docs/plans/pre-pilot-db-hardening-program.md  §1 WS-1
--   docs/reviews/external-db-audit-2026-07-evaluation.md  §2 (C-3), §6.1
--
-- The platform's entire PHI posture rests on roster/role membership:
--   * pqs_members enrollment grants a hospital's PHI READ (via is_pqs_member_of).
--   * organization_members.role grants org/hospital authority incl. nsp_coordinator.
-- Both tables were DIRECTLY writable by an ordinary authenticated client (stock
-- GRANT ALL never revoked + FOR ALL write policies), so a client could bypass the
-- guarded appointment RPCs with a raw INSERT/UPDATE and self-escalate into PHI:
--   * C-3a: an org_admin could INSERT (org, auth.uid(), 'nsp_coordinator', hospital)
--           and bootstrap itself toward PHI.
--   * C-3b: an nsp_org_admin could self-enroll into pqs_members (curator policy has
--           no self-exclusion; add_pqs_member lacked the p_user <> auth.uid() guard).
--   * H-6:  grants were audited inconsistently (only role='hospital_admin').
--   * H-7:  organization_members_write is FOR ALL, no column pinning / self-guard.
--
-- Fix (by construction — the case_access pattern generalized): revoke direct DML,
-- drop the write policies, funnel every grant through guarded SECURITY DEFINER RPCs
-- with a shared self-exclusion helper, add the missing assign_org_admin/
-- revoke_org_admin (+ anti-lockout), patch add_pqs_member, and add BLANKET audit
-- triggers on both tables (every grant/revoke audited regardless of the write path).
--
-- Reset-OK (pre-launch): no back-compat migration; service_role/seed (RLS-exempt)
-- is unaffected, so provisioning + `supabase db reset` still work.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Close direct writes
-- -----------------------------------------------------------------------------
-- organization_members: drop the FOR ALL write policy (H-7) + revoke DML. The
-- SELECT policy (organization_members_select, self-read arm 20260709000500) stays.
drop policy if exists organization_members_write on public.organization_members;
revoke insert, update, delete on public.organization_members from authenticated;

-- pqs_members: drop the FOR ALL curator policy + revoke DML.
--
-- NOTE (deliberate end state): pqs_members_curator_all is `FOR ALL`, so it also
-- served READS for curators. But pqs_members is read ONLY through SECURITY DEFINER
-- helpers (is_pqs_member_of_for, list_pqs_members, ...) which are RLS-exempt, and
-- there are ZERO direct `.from('pqs_members')` accesses in src/lib. Dropping this
-- leaves pqs_members with NO policy at all — RPC-only for reads AND writes, exactly
-- like case_access (writes only via grant/revoke_case_access DEFINER RPCs). This is
-- the intended "no policy = DEFINER-only door" posture, not an omission.
drop policy if exists pqs_members_curator_all on public.pqs_members;
revoke insert, update, delete on public.pqs_members from authenticated;

comment on table public.pqs_members is
  'PER-HOSPITAL PQS/NSP roster (NSP-per-hospital, ADR 0052). Enrollment in '
  '(hospital_id, user_id) grants that hospital''s PHI READ via app.is_pqs_member_of. '
  'WS-1 (C-3b): NO direct client writes and NO RLS policy — reads and writes flow '
  'ONLY through SECURITY DEFINER RPCs (add/remove/list_pqs_members) + the DEFINER '
  'read predicates. Curation is coordinator-of-hospital OR org nsp_org_admin, with '
  'self-enrollment denied (app._deny_self_grant). Every roster change is audited by '
  'trg_audit_pqs_members. service_role/seed (RLS-exempt) provisions the fixture.';

-- -----------------------------------------------------------------------------
-- 2 · Shared self-exclusion helper (uniform 42501 across every appointment RPC)
-- -----------------------------------------------------------------------------
create or replace function app._deny_self_grant(p_principal uuid)
  returns void language plpgsql
  set search_path to 'app', 'pg_catalog'
as $$
begin
  if p_principal = auth.uid() then
    raise exception 'não é permitido conceder acesso a si mesmo' using errcode = '42501';
  end if;
end;
$$;
alter function app._deny_self_grant(uuid) owner to postgres;
comment on function app._deny_self_grant(uuid) is
  'Uniform self-exclusion guard for the membership appointment RPCs (WS-1): raises '
  '42501 if the principal being granted is the caller (auth.uid()). Centralizes the '
  'duty-separation rule "an appointer may not appoint themselves" in one place.';
-- app.* is not PostgREST-exposed, but keep the grant posture explicit (audit C-2).
revoke all on function app._deny_self_grant(uuid) from public;
grant execute on function app._deny_self_grant(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · NEW assign_org_admin / revoke_org_admin (the org_admin door)
-- -----------------------------------------------------------------------------
-- org_admin was grantable ONLY by direct table write (no RPC existed). Now that the
-- write policy is dropped, add the guarded door. Authority = platform is_admin() OR
-- an existing org_admin of that org (so both platform provisioning AND org-admin
-- succession work). Self-exclusion on grant; anti-lockout on revoke.
create or replace function public.assign_org_admin(p_org uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not (app.is_admin() or app.is_org_admin_of(p_org)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user);

  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (p_org, p_user, 'org_admin', null)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
  -- The org-tier audit row is emitted by trg_audit_organization_members.
end;
$$;
alter function public.assign_org_admin(uuid, uuid) owner to postgres;
comment on function public.assign_org_admin(uuid, uuid) is
  'Grant org_admin (WS-1). Authority: platform admin OR an existing org_admin of the '
  'org (provisioning + succession). Denies self-grant (42501). Idempotent. The sole '
  'org_admin write door now that organization_members has no write policy.';

create or replace function public.revoke_org_admin(p_org uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org_admin_count integer;
begin
  if not (app.is_admin() or app.is_org_admin_of(p_org)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Anti-lockout (HC081): never remove the org's LAST org_admin. org_admin is the
  -- root authority for the org; hospital_admin / nsp_org_admin can always be
  -- re-appointed by a platform_admin or org_admin, so no last-of-kind guard is
  -- needed there — this guard is scoped to org_admin ONLY.
  select count(*) into v_org_admin_count
  from public.organization_members
  where organization_id = p_org and role = 'org_admin' and hospital_id is null;

  if v_org_admin_count <= 1
     and exists (
       select 1 from public.organization_members
       where organization_id = p_org and user_id = p_user
         and role = 'org_admin' and hospital_id is null
     ) then
    raise exception 'não é permitido remover o último administrador da organização'
      using errcode = 'HC081';
  end if;

  delete from public.organization_members
  where organization_id = p_org and user_id = p_user
    and role = 'org_admin' and hospital_id is null;
  -- The org-tier audit row is emitted by trg_audit_organization_members.
end;
$$;
alter function public.revoke_org_admin(uuid, uuid) owner to postgres;
comment on function public.revoke_org_admin(uuid, uuid) is
  'Revoke org_admin (WS-1). Same authority as assign_org_admin. Anti-lockout: '
  'raises HC081 when removing the org''s LAST org_admin (the root authority). '
  'Idempotent for a non-holder / non-last removal.';

-- -----------------------------------------------------------------------------
-- 4 · Patch existing appointment RPCs to route through the shared self-guard
-- -----------------------------------------------------------------------------
-- add_pqs_member: ADD the missing self-exclusion (C-3b). All other logic verbatim
-- from 20260710000000_nsp_per_hospital.sql:1929.
create or replace function public.add_pqs_member(p_hospital_id uuid, p_user_id uuid)
returns pqs_members
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_members;
begin
  if not (app.is_nsp_org_admin_of(app.org_of_hospital(p_hospital_id))
          or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
      using errcode = '42501';
  end if;
  -- WS-1 (C-3b): an nsp_org_admin / coordinator may not self-enroll into the PHI
  -- roster. Enrollment grants PHI read, so curation must stay a distinct grant.
  perform app._deny_self_grant(p_user_id);
  insert into public.pqs_members (hospital_id, user_id, added_by)
  values (p_hospital_id, p_user_id, auth.uid())
  on conflict (hospital_id, user_id) do nothing;
  select * into v_row from public.pqs_members
    where hospital_id = p_hospital_id and user_id = p_user_id;
  return v_row;
end;
$function$;
alter function public.add_pqs_member(uuid, uuid) owner to postgres;

-- assign_hospital_admin: re-point the inline self-check to the shared helper (no
-- behavioural change). Verbatim otherwise from 20260709000400:31.
create or replace function public.assign_hospital_admin(p_hospital uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
begin
  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;
  if not app.is_org_admin_of(v_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user);

  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (v_org, p_user, 'hospital_admin', p_hospital)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
  -- Audit row emitted by trg_audit_organization_members (WS-1 blanket trigger,
  -- supersedes the retired trg_audit_hospital_admin_grant).
end;
$$;
alter function public.assign_hospital_admin(uuid, uuid) owner to postgres;

-- assign_nsp_org_admin: re-point the inline self-check to the shared helper.
create or replace function public.assign_nsp_org_admin(p_org uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.is_org_admin_of(p_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user);

  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (p_org, p_user, 'nsp_org_admin', null)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
end;
$$;
alter function public.assign_nsp_org_admin(uuid, uuid) owner to postgres;

-- assign_nsp_coordinator: re-point the inline self-check to the shared helper.
-- Verbatim otherwise from 20260710000000_nsp_per_hospital.sql:2184.
create or replace function public.assign_nsp_coordinator(p_hospital uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
begin
  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;
  -- Only the org's nsp_org_admin may appoint (NOT org_admin, NOT hospital_admin —
  -- decision 3). The org_admin appoints the nsp_org_admin; the nsp_org_admin
  -- appoints the per-hospital coordinator.
  if not app.is_nsp_org_admin_of(v_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user);

  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (v_org, p_user, 'nsp_coordinator', p_hospital)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
end;
$function$;
alter function public.assign_nsp_coordinator(uuid, uuid) owner to postgres;

-- The revoke_* RPCs (remove_pqs_member, revoke_hospital_admin, revoke_nsp_org_admin,
-- revoke_nsp_coordinator) carry no self-check (nothing to re-point) and were already
-- the sole write path — left UNCHANGED to avoid needless churn / grant resets.

-- -----------------------------------------------------------------------------
-- 5 · Blanket audit triggers (H-6) — every grant/revoke audited, ANY write path
-- -----------------------------------------------------------------------------
-- Mirror app.trg_audit_commission_members + the audit_write 8-arg org/hospital form.
-- Rows record role name + scope + who + when ONLY — NEVER PHI (Architecture Rule 11).

-- organization_members: chain-key precedence in audit_write routes org-level rows
-- (hospital_id NULL -> org chain) and hospital-scoped rows (hospital_id set ->
-- hospital chain) automatically. entity_id = the row id (the table has one).
create or replace function app.trg_audit_organization_members()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['role', 'user_id', 'hospital_id'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write(
      'organization_member.granted', 'organization_member', new.id, null,
      'Função de organização concedida (' || new.role || ')',
      jsonb_build_object('role', new.role, 'user_id', new.user_id,
                         'hospital_id', new.hospital_id),
      new.organization_id, new.hospital_id);
    return null;
  elsif tg_op = 'UPDATE' then
    -- Only a role change is a meaningful grant event.
    if new.role is distinct from old.role then
      perform app.audit_write(
        'organization_member.role_changed', 'organization_member', new.id, null,
        'Função de organização alterada: ' || old.role || ' → ' || new.role,
        app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols),
        new.organization_id, new.hospital_id);
    end if;
    return null;
  else
    perform app.audit_write(
      'organization_member.revoked', 'organization_member', old.id, null,
      'Função de organização revogada (' || old.role || ')',
      jsonb_build_object('role', old.role, 'user_id', old.user_id,
                         'hospital_id', old.hospital_id),
      old.organization_id, old.hospital_id);
    return null;
  end if;
end;
$$;
alter function app.trg_audit_organization_members() owner to postgres;
comment on function app.trg_audit_organization_members() is
  'WS-1 blanket audit (H-6): every organization_members grant/revoke/role-change '
  'emits an audit row (role + scope + who), regardless of the write path. Supersedes '
  'the narrow trg_audit_hospital_admin_grant. Role + scope only — never PHI (Rule 11).';

drop trigger if exists trg_audit_organization_members on public.organization_members;
create trigger trg_audit_organization_members
  after insert or update or delete on public.organization_members
  for each row execute function app.trg_audit_organization_members();

-- Retire the narrow hospital_admin-only grant trigger — the blanket trigger above is
-- a strict superset (it audits org_admin / nsp_org_admin / nsp_coordinator grants
-- too, which is exactly the H-6 fix). Verb changes from hospital.admin_granted to
-- the uniform organization_member.granted.
drop trigger if exists trg_audit_hospital_admin_grant on public.organization_members;
drop function if exists app.trg_audit_hospital_admin_grant();

-- pqs_members: no `id` column (PK is composite (hospital_id, user_id)) — use user_id
-- as the entity_id (the enrolled principal, matching how the old grant trigger
-- recorded the grantee). Resolve org from the hospital -> hospital chain. NEVER emit
-- the PHI the enrollment unlocks.
create or replace function app.trg_audit_pqs_members()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit_write(
      'pqs_member.enrolled', 'pqs_member', new.user_id, null,
      'Membro do NSP inscrito',
      jsonb_build_object('user_id', new.user_id, 'hospital_id', new.hospital_id),
      app.org_of_hospital(new.hospital_id), new.hospital_id);
    return null;
  elsif tg_op = 'DELETE' then
    perform app.audit_write(
      'pqs_member.removed', 'pqs_member', old.user_id, null,
      'Membro do NSP removido',
      jsonb_build_object('user_id', old.user_id, 'hospital_id', old.hospital_id),
      app.org_of_hospital(old.hospital_id), old.hospital_id);
    return null;
  else
    -- UPDATE is not a meaningful roster op (PK is (hospital_id, user_id)); emit a
    -- defensive enrolled-shaped row on the new identity if one somehow occurs.
    perform app.audit_write(
      'pqs_member.enrolled', 'pqs_member', new.user_id, null,
      'Membro do NSP atualizado',
      jsonb_build_object('user_id', new.user_id, 'hospital_id', new.hospital_id),
      app.org_of_hospital(new.hospital_id), new.hospital_id);
    return null;
  end if;
end;
$$;
alter function app.trg_audit_pqs_members() owner to postgres;
comment on function app.trg_audit_pqs_members() is
  'WS-1 blanket audit (H-6): every pqs_members enrollment/removal emits a hospital-'
  'tier audit row (user + hospital), regardless of the write path. Records WHO was '
  'enrolled where — NEVER the PHI the enrollment unlocks (Rule 11).';

drop trigger if exists trg_audit_pqs_members on public.pqs_members;
create trigger trg_audit_pqs_members
  after insert or update or delete on public.pqs_members
  for each row execute function app.trg_audit_pqs_members();

-- -----------------------------------------------------------------------------
-- 6 · t19 grant hygiene (MEMORY: every recreated public.* RPC must REVOKE ALL FROM
--     PUBLIC then GRANT — DROP/CREATE OR REPLACE reset grants to PUBLIC-executable;
--     this is the C-2 lesson). Standardize all appointment RPCs on
--     authenticated,service_role (the nsp_per_hospital convention; the older
--     appointments migration granted authenticated only).
-- -----------------------------------------------------------------------------
revoke all on function public.assign_org_admin(uuid, uuid) from public;
revoke all on function public.revoke_org_admin(uuid, uuid) from public;
revoke all on function public.add_pqs_member(uuid, uuid) from public;
revoke all on function public.assign_hospital_admin(uuid, uuid) from public;
revoke all on function public.assign_nsp_org_admin(uuid, uuid) from public;
revoke all on function public.assign_nsp_coordinator(uuid, uuid) from public;
grant execute on function public.assign_org_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_org_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.add_pqs_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.assign_hospital_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.assign_nsp_org_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.assign_nsp_coordinator(uuid, uuid) to authenticated, service_role;

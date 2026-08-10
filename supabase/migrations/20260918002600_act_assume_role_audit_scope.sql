-- ACT (ADR 0106) — assume_role's audit row is scoped to the ASSUMED ROLE's own
-- tenancy, not the platform-tier bucket.
--
-- Coordinator's ruling (catalog-verified: all 14 pre-existing `active_role.assumed`
-- rows carried organization_id/hospital_id/commission_id all NULL, landing in the
-- platform-tier audit chain — which `phase13-audit.spec.ts` AC-3f-platform asserts
-- is permanently empty, a pre-existing test the tester correctly left red rather
-- than weakening):
--
--   "An assumption of `org_admin of Rede A` is an event ABOUT Rede A, and leaving
--   it unscoped both breaks tenancy-scoped audit completeness (Architecture Rule
--   11) and pollutes the platform-tier bucket with routine per-user noise.
--   platform_admin's hat genuinely has no tenant, so NULL stays correct ONLY for
--   that case."
--
-- Implementation: resolve the CALLER'S OWN membership row matching the role being
-- assumed and pass its scope columns straight through to `audit_write` — the
-- SAME columns `memberships_scope_shape` already guarantees are correctly
-- NULL-shaped per role tier (org-tier: organization_id set, rest NULL;
-- hospital-tier: organization_id + hospital_id set; commission-tier:
-- commission_id set — `audit_write` itself derives org+hospital from a passed
-- commission, matching every other caller in the codebase).
--
-- D2 makes the hat a ROLE TYPE, not a single membership row, so a caller holding
-- the SAME role type across MULTIPLE scope instances (e.g., staff_admin of two
-- commissions) has no single canonical scope for "the hat I assumed" — this picks
-- the most-recently-granted matching instance, deterministically tie-broken by
-- id (the same tie-break shape already used elsewhere in this codebase,
-- app.commission_staff_admin_of_case's `order by granted_at nulls last`). This is
-- an audit-summary simplification, not an authorization decision — has_role's own
-- hat condition already applies uniformly across every instance of the matching
-- role type regardless of which one this picks.
--
-- platform_admin keeps its existing eligibility check (profiles.is_admin) and
-- stamps no scope — the carve-out the ruling names explicitly. A single-role
-- platform_admin never reaches this branch via a real session (D11: the hook
-- derives their hat implicitly, no picker in the path), so the platform-tier
-- audit chain is expected to stay empty in practice — verified as a keystone,
-- not assumed (`supabase/tests/315_act_stage3_hat_condition.sql`).
create or replace function public.assume_role(p_role platform_role)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_holds boolean;
  v_org uuid;
  v_hospital uuid;
  v_commission uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  v_session_id := nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'),
    ''
  )::uuid;
  if v_session_id is null then
    raise exception 'sessão inválida' using errcode = '28000';
  end if;

  if p_role = 'platform_admin' then
    v_holds := exists (
      select 1 from public.profiles where id = v_uid and is_admin = true
    );
    -- No tenant to stamp — v_org/v_hospital/v_commission stay NULL (the ruling's
    -- own carve-out).
  else
    select m.organization_id, m.hospital_id, m.commission_id
      into v_org, v_hospital, v_commission
    from public.memberships m
    where m.principal_id = v_uid
      and m.role = p_role::text
      and (m.expires_at is null or m.expires_at > now())
    order by m.granted_at desc nulls last, m.id
    limit 1;

    v_holds := v_org is not null or v_hospital is not null or v_commission is not null;
  end if;

  if not v_holds then
    raise exception 'papel não disponível para este usuário' using errcode = '42501';
  end if;

  insert into app.active_role_selections (session_id, user_id, role, chosen_at)
  values (v_session_id, v_uid, p_role, now())
  on conflict (session_id) do update
    set role = excluded.role,
        chosen_at = excluded.chosen_at;

  perform app.audit_write(
    'active_role.assumed', 'active_role_selection', v_session_id, v_commission,
    'Papel assumido: ' || p_role::text,
    jsonb_build_object('role', p_role),
    v_org, v_hospital
  );
end;
$function$;

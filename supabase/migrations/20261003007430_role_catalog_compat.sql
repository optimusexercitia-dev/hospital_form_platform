-- AE5-ROLE-CATALOG-COMPAT — ADR 0207 D5 steps 1-4, in D5's order, as ONE migration.
-- door-sweep-targets: public.assume_role(text)
--
-- WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT.
--   step 1  app.active_role_selections.role : platform_role -> text, + FK to authz.roles(code)
--   step 2  public.assume_role(platform_role) -> ONE public.assume_role(text), empty search_path
--   step 3  drop type public.platform_role
--   step 4  delete the `administrativo` role row; drop `capability_plane` from authz.scope_kind
-- ⛔ STEP 6 IS NOT TAKEN HERE. `app.member_can` / `app.member_can_for` and every door calling
-- them keep their current semantics (ADR 0207 D5 step 6, D7); pgTAP 422 §5 pins both bodies by
-- md5 so a mapping bolted on inside this unit reds. `authz.role_permissions` is untouched.
--
-- ⭐ THE BODY IN STEP 2 WAS TAKEN FROM `pg_get_functiondef`, NOT FROM A MIGRATION FILE. Migration
-- text in this tree is STALE BY DESIGN — several migrations rewrite function bodies at runtime via
-- `pg_get_functiondef()` + `replace()` + `execute` (ADR 0078), so the newest file naming
-- `assume_role` is not evidence of what `assume_role` contains. The three gates below, their order,
-- their pt-BR messages and their SQLSTATEs are transcribed from the LIVE catalog and are unchanged:
-- the only differences are the parameter type, the dropped `::text` casts it made redundant, the
-- empty `search_path`, and the schema qualification that empty path requires.
--
-- ⚠ EVERY GATE IS PRESERVED, INCLUDING THE ORDER, WHICH IS LOAD-BEARING. `session_selectable`
-- (fail-closed on a missing catalog row) runs BEFORE `app.is_active`, because a role nobody may
-- pick keeps its more specific answer; the real-assignment check runs last. Re-ordering them
-- changes which pt-BR message a caller sees, and pgTAP 408 and 422 §2 both assert messages rather
-- than bare SQLSTATEs precisely because two of these denials share 42501.

-- ============================================================================
-- STEP 1 — the column becomes catalog-validated text.
-- ============================================================================

-- ⛔ The FK is added to a table that may already hold rows on a data-bearing target. Every
-- platform_role label maps to an authz.roles row today, but that is a fact to ASSERT, not to
-- assume: without this the ALTER would fail later with a bare 23503 naming no value.
do $$
declare
  v_orphans text;
begin
  select string_agg(distinct s.role::text, ', ')
    into v_orphans
    from app.active_role_selections s
   where not exists (select 1 from authz.roles r where r.code = s.role::text);

  if v_orphans is not null then
    raise exception
      'AE5 step 1: app.active_role_selections carries role code(s) absent from authz.roles: %. '
      'Reconcile before re-typing the column.', v_orphans
      using errcode = 'data_exception';
  end if;
end $$;

alter table app.active_role_selections
  alter column role type text using role::text;

-- NO ACTION in both directions (RESTRICT semantics), matching memberships_role_scope_kind_fkey.
-- ⚠ OPERATIONAL CONSEQUENCE: a role code held by a live session selection can no longer be
-- deleted from authz.roles. pgTAP 408 §4, which deletes the platform_admin catalog row to reach
-- assume_role's fail-closed branch, now clears the selection rows first as fixture cleanup.
alter table app.active_role_selections
  add constraint active_role_selections_role_fkey
  foreign key (role) references authz.roles (code);

-- ============================================================================
-- STEP 2 — ONE non-overloaded text door, on ADR 0208 D4's empty search_path.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.assume_role(public.platform_role)') is null then
    raise exception
      'AE5 step 2: public.assume_role(platform_role) not found. Refusing to no-op — this '
      'migration REPLACES a door, and a silent skip would leave the enum signature live.'
      using errcode = 'undefined_function';
  end if;
end $$;

drop function public.assume_role(public.platform_role);

create function public.assume_role(p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
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

  -- ⭐ G4 (ADR 0155), ENFORCED SERVER-SIDE (ADR 0176 D7). authz.roles is sealed from every
  -- application role; this function is SECURITY DEFINER, so the read needs no grant.
  -- FAIL CLOSED: a role with no catalog row is NOT selectable.
  -- ⚠ WITH A TEXT PARAMETER THIS GATE ALSO CARRIES THE VOCABULARY. The enum used to reject an
  -- unknown string for free, at the call boundary; now nothing does until here, which is why
  -- 422 §2.11 asserts an unknown code fails 42501 HERE and never reaches the INSERT below to be
  -- refused by step 1's FK with 23503.
  if not coalesce(
       (select r.session_selectable from authz.roles r where r.code = p_role),
       false) then
    raise exception 'papel não selecionável nesta sessão' using errcode = '42501';
  end if;

  -- ⭐⭐ ACCOUNT STATE, DOOR-WIDE (ADR 0201 D4 / Batch 9 ruling R12, widened by PO ruling R1).
  -- The SEATING door follows the caller's account state for EVERY tier, before ANY seating.
  -- Placed AFTER the selectability check on purpose: a role nobody may pick keeps its more
  -- specific answer.
  -- ⛔ Gating `app.is_admin()` and `app.is_admin_for()` while leaving this door open would have
  -- read complete — a deactivated admin could simply mint a fresh hat here, and
  -- `app.active_role()` is a bare claim read, so nothing downstream would have noticed.
  -- CALLER-KEYED (`v_uid := auth.uid()`), like every other predicate in this body.
  if not app.is_active(v_uid) then
    raise exception 'papel não disponível para este usuário' using errcode = '42501';
  end if;

  -- ⭐ THE REAL-ASSIGNMENT GATE (ADR 0207 D3): the caller must actually HOLD the role.
  -- platform_admin reads profiles.is_admin and touches no membership; every other code needs a
  -- LIVE memberships row. 422 §2.6-2.10 mutate this arm in both directions.
  if p_role = 'platform_admin' then
    v_holds := exists (
      select 1 from public.profiles where id = v_uid and is_admin = true
    );
    -- No tenant to stamp — v_org/v_hospital/v_commission stay NULL (the ruling's own
    -- carve-out). Since R10 that is no longer a carve-out but the general rule.
  else
    select m.organization_id, m.hospital_id, m.commission_id
      into v_org, v_hospital, v_commission
    from public.memberships m
    where m.principal_id = v_uid
      and m.role = p_role
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

  -- ⭐⭐ R10 (ADR 0201 D2): the audit row logs the ROLE ONLY, no place — for EVERY tier.
  -- ⛔ v_org / v_hospital / v_commission are STILL SELECTED above (v_holds is derived from them)
  -- and are deliberately NOT stamped, and they are deliberately NOT renamed: a rename would make
  -- this file's "the old scope arguments are gone" assertion pass for the wrong reason. The
  -- reason is not tidiness — a footprint captured at assume-time is a SNAPSHOT that a mid-session
  -- grant invalidates, while `hat_ok` compares role_code only and admits the new seating.
  -- ⚠ THE ROW IS STILL WRITTEN. R10 NULLs three columns; it does not stop the audit
  -- (315 §"exactly one active_role.assumed row per session" still holds, and 418 §3.7 pins it).
  perform app.audit_write(
    'active_role.assumed', 'active_role_selection', v_session_id, null::uuid,
    'Papel assumido: ' || p_role,
    jsonb_build_object('role', p_role),
    null::uuid, null::uuid
  );
end;
$fn$;

-- ⛔ RE-ISSUED, NOT INHERITED. A dropped function takes its ACL with it, and a fresh function's
-- DEFAULT ACL is NULL — which INCLUDES PUBLIC EXECUTE. Omitting the revoke would silently widen
-- the seating door to every role in the cluster. 422 §2.4 asserts proacl IS NOT NULL first, for
-- exactly that reason: a NULL ACL and an explicitly-granted one are indistinguishable to a probe
-- that only looks for a PUBLIC entry.
revoke all on function public.assume_role(text) from public;
grant execute on function public.assume_role(text) to authenticated, service_role;

-- ============================================================================
-- STEP 3 — the enum is dropped, and only after its dependents are gone.
-- ============================================================================

do $$
declare
  v_n int;
  v_what text;
begin
  select count(*), string_agg(distinct d.classid::regclass::text, ', ')
    into v_n, v_what
    from pg_depend d
   where d.refobjid = 'public.platform_role'::regtype
     and d.deptype <> 'i';

  if v_n > 0 then
    raise exception
      'AE5 step 3: public.platform_role still has % non-internal dependent(s) in %. Refusing to '
      'drop — steps 1 and 2 are what remove them, and a CASCADE here would silently take the '
      'dependent with it.', v_n, v_what
      using errcode = 'dependent_objects_still_exist';
  end if;
end $$;

drop type public.platform_role;

-- ============================================================================
-- STEP 4 — the inert `administrativo` row leaves, then the domain tightens.
--
-- ⛔ ORDER IS BINDING: the row carries `allowed_scope_kind = 'capability_plane'`, so tightening
-- the domain first would fail validating authz.roles itself.
-- ============================================================================

do $$
declare
  v_perms int;
  v_members int;
begin
  select count(*) into v_perms from authz.role_permissions where role_code = 'administrativo';
  select count(*) into v_members from public.memberships where role = 'administrativo';

  if v_perms > 0 or v_members > 0 then
    raise exception
      'AE5 step 4: `administrativo` still has % role_permissions row(s) and % memberships row(s). '
      'ADR 0207 D1 moves it out of authz.roles as a capability PROVIDER; deleting the row while '
      'anything still references it as a ROLE would change an entitlement, which this unit does '
      'not do.', v_perms, v_members
      using errcode = 'dependent_objects_still_exist';
  end if;
end $$;

delete from authz.roles where code = 'administrativo';

-- ⭐⭐ THE MEMBERSHIPS PROOF ADR 0207 D5 ORDERS BEFORE THE TIGHTENING. `authz.scope_kind` is a
-- DOMAIN, and `public.memberships.scope_kind` depends on it as well as `authz.roles`. Measured 0
-- at the unit's opening — but a CHECK can be altered, so this is asserted here and keystoned
-- separately by pgTAP 422 §4.3, whose probe is proven able to SEE a planted row (§4.4).
do $$
declare
  v_n int;
begin
  select count(*) into v_n from public.memberships where scope_kind::text = 'capability_plane';
  if v_n > 0 then
    raise exception
      'AE5 step 4: % public.memberships row(s) carry scope_kind = ''capability_plane''. The '
      'domain may not be tightened under live data — rule on those rows first.', v_n
      using errcode = 'check_violation';
  end if;
end $$;

alter domain authz.scope_kind drop constraint scope_kind_check;

-- ⚠ The `::text` casts are written explicitly so `pg_get_constraintdef` renders the same shape
-- 411 §5 and 422 §4.2 parse (`'([a-z_]+)'::text`). A bare literal list renders differently and
-- would red both readers for a formatting reason.
alter domain authz.scope_kind add constraint scope_kind_check
  check (value = any (array['organization'::text, 'hospital'::text, 'commission'::text, 'none'::text]));

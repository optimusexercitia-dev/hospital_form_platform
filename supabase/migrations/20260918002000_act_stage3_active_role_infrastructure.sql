-- ACT Stage 3 (ADR 0106) — THE ATOM: the active-role ("hat") enforcement point.
--
-- This migration is the ONE red window the program is built around (D10). It:
--   1. introduces app.active_role_selections + public.assume_role(p_role) (the
--      DEFINER RPC in `public` — config.toml exposes only public/graphql_public,
--      so an `app.*` RPC would be a 404; a correct door nothing can reach is this
--      repo's recorded failure mode);
--   2. extends public.custom_access_token_hook to mint the `active_role` claim
--      (selection row -> that role; no row + exactly one live role type -> derive
--      implicitly, D11 break-glass; no row + multi-role -> no claim, D5: stranger);
--   3. adds app.active_role() (reads the claim);
--   4. gains has_role (4-arg) the plan §2 caller-only condition;
--   5. reimplements has_role_any with the same caller-only carve-out;
--   6. gains member_can the D13 condition;
--   7. re-diffs session_context's hat-blind exemption (no-op confirmation, D9);
--   8. generalises audit_write's actor_is_admin pattern to metadata.acting_as (D8).
--
-- CREATE OR REPLACE only; no parameter renames; every touched function's
-- prosecdef/provolatile/proacl/proconfig/owner diffed old-vs-new from the live
-- catalog (see docs/plans/act-as-buildnotes.md Stage 3 for the diff).
--
-- ⚠ SCOPE NOTE, flagged rather than silently expanded or silently skipped: ADR
-- 0106 D11's prose also says "is_admin() gains the same active-role condition."
-- That change is NOT included here — it is absent from both the plan's own §4
-- Stage 3 task list and this session's task brief, and its blast radius is a
-- different order of magnitude (is_admin() gates a very large fraction of the
-- RLS surface, AND the TypeScript layer independently reads `claims.is_admin`
-- directly in `getSessionContext()` with no active_role consultation at all --
-- fixing only the SQL side would leave the client-visible `isAdmin` flag stale
-- and inconsistent with the DB's own enforcement). Recorded here as an open gap
-- between the ADR's stated intent and the concrete task list, for an explicit
-- decision, not smuggled in and not silently dropped.

-- ── 1. app.active_role_selections ───────────────────────────────────────────
-- The table stays in `app` (unexposed schema); only the `platform_role` TYPE is
-- in `public` (Stage 0 lead ruling). Written ONLY via the DEFINER RPC below.
create table app.active_role_selections (
  session_id uuid primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.platform_role not null,
  chosen_at  timestamptz not null default now()
);

create index active_role_selections_user_id_idx on app.active_role_selections (user_id);

alter table app.active_role_selections enable row level security;

-- Defense-in-depth (Architecture Rule 1): the table is unreachable via
-- PostgREST regardless (schema not exposed), but every table still carries
-- explicit RLS + policies per the binding rule. No INSERT/UPDATE/DELETE
-- policy exists on purpose -- every write goes through assume_role, which
-- validates against LIVE memberships before touching this table.
create policy active_role_selections_select_own
  on app.active_role_selections for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ── 2. public.assume_role(p_role) ───────────────────────────────────────────
-- DEFINER, in `public` (the reachable schema). Validates p_role against LIVE
-- memberships (or profiles.is_admin for the platform_admin hat), upserts by
-- session_id (named ON CONFLICT target -- the untargeted-`do nothing` lesson),
-- and audits `role_assumed`. `session_id` is read from `request.jwt.claims` --
-- it is one of GoTrue's required base claims, already present in the INCOMING
-- token before this RPC ever runs (verified against the current Auth Hook
-- docs, not assumed).
create function public.assume_role(p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_holds boolean;
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
    v_holds := coalesce(app.is_admin(), false);
  else
    v_holds := exists (
      select 1 from public.memberships m
      where m.principal_id = v_uid
        and m.role = p_role::text
        and (m.expires_at is null or m.expires_at > now())
    );
  end if;

  if not v_holds then
    raise exception 'papel não disponível para este usuário' using errcode = '42501';
  end if;

  insert into app.active_role_selections (session_id, user_id, role, chosen_at)
  values (v_session_id, v_uid, p_role, now())
  on conflict (session_id) do update
    set role = excluded.role,
        chosen_at = excluded.chosen_at;

  -- `audit_log_action_shape` requires a dotted `noun.verb` action name (every
  -- other action in the catalog follows this — `membership.granted`,
  -- `case.created`, ...); the plan/ADR's own prose names the action
  -- "role_assumed" (no dot) — recorded here as the fix, not silently renamed
  -- without a trace.
  perform app.audit_write(
    'active_role.assumed', 'active_role_selection', v_session_id, null,
    'Papel assumido: ' || p_role::text,
    jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function public.assume_role(public.platform_role) from public;
grant execute on function public.assume_role(public.platform_role) to authenticated;

-- ── 3. app.active_role() ────────────────────────────────────────────────────
-- Plain text (not public.platform_role) to match has_role's existing `p_role
-- text` parameter with zero new casting surface. INVOKER: touches no table,
-- nothing to bypass -- reads only the session-level JWT-claims GUC.
create function app.active_role()
returns text
language sql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'active_role';
$$;

-- ── 4. app.has_role (4-arg) gains the §2 caller-only binding ────────────────
-- Unchanged predicate, AND'd with the caller-only condition verbatim from
-- plan §2: binds ONLY when the checked principal IS the caller (p_user_id =
-- auth.uid()) -- a third-party check (asking about someone ELSE's roles) is
-- untouched, unaffected by MY hat.
--
-- ⚠ FAIL-OPEN FOUND AND FIXED (not in the plan's literal text, found running a
-- manual sanity check before writing the pgTAP keystones): the plan's exact
-- wording is `... OR p_role = app.active_role())`. A plain `=` against
-- app.active_role() is NULL whenever the caller holds NO active-role claim at
-- all -- and `TRUE AND NULL` is NULL, not FALSE. Confirmed live: a hatless
-- caller made `has_role(...)` return NULL, and `IF NOT has_role(...) THEN
-- raise ...` SILENTLY DID NOT FIRE (`IF NULL` is treated as false-ish by
-- plpgsql's IF, so the guard never raises) -- the exact fail-OPEN shape D5
-- exists to reject, on the enforcement point D5 is written for. Fixed by
-- `IS NOT DISTINCT FROM` (Postgres's NULL-safe equality -- ALWAYS TRUE or
-- FALSE, never NULL, even when one side is NULL): verified all 4 truth-table
-- cells (caller+hat / caller+no-hat / caller+wrong-hat / third-party) against
-- this exact fixture before and after -- identical results, now guaranteed
-- non-null. Matches the established house pattern (`app.is_active` already
-- wraps its result in `coalesce(..., false)` for the identical reason).
create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and m.role = p_role
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
  )
  and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role());
$function$;

-- ── 5. app.has_role_any reimplemented, same carve-out ───────────────────────
-- NOT a literal wrapper call to has_role (which would need a fixed p_role and
-- has_role_any has none) -- an integrated AND-clause of IDENTICAL shape,
-- proven equivalent to "has_role(scope,scope_id,active_role(),p_user_id) for
-- caller checks, the ORIGINAL any-role query for third-party checks":
--   caller check (p_user_id = auth.uid()): the OR's right arm requires
--     m.role = active_role(), collapsing "any role" down to exactly the
--     active-role row -- byte-identical to has_role's own predicate with
--     p_role substituted to active_role().
--   third-party check: the OR's left arm is true, the role filter never
--     applies -- the ORIGINAL unfiltered "any role" body, unchanged.
-- Same NULL-safety fix as has_role (`IS NOT DISTINCT FROM`, never a plain `=`
-- against app.active_role()) -- see has_role's comment above for the finding.
create or replace function app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
      and (p_user_id is distinct from auth.uid() or m.role is not distinct from app.active_role())
  );
$function$;

-- ── 6. app.member_can gains the D13 condition ───────────────────────────────
-- ADR 0106 D13: an administrativo capability is live only while the caller is
-- ACTING AS the committee role the delegation decorates (staff/staff_admin of
-- that commission) -- not merely a relationship the caller is in (D6 does not
-- reach this; D13 is explicit that it fails OPEN as first written). Reuses the
-- EXISTING hat-aware door is_member_of(p_commission_id) -- a caller check
-- through has_role_any -- rather than inlining a second active_role() read;
-- "one place" stays literal.
create or replace function app.member_can(p_commission_id uuid, p_capability text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.feature_enabled('administrativo')
     and app.is_active(auth.uid())
     and app.is_member_of(p_commission_id)
     and exists (
       select 1 from public.commission_administrativo_capabilities c
       where c.commission_id = p_commission_id
         and c.user_id = auth.uid()
         and c.capability = p_capability
     );
$function$;

-- ── 7. public.session_context() — no-op confirmation, re-diffed ────────────
-- Body UNCHANGED (verified: the expiry filter this function's own comment
-- calls "verbatim from app.has_role_any" is STILL byte-identical post-Stage-3
-- -- `m.expires_at is null or m.expires_at > now()` -- has_role_any's NEW
-- caller-only clause is a separate, additional AND, not a rewrite of the
-- expiry check this comment refers to). Comment augmented to name the
-- exemption explicitly, so a later "fix the inconsistency" sweep does not
-- rewire this door and break the picker/D9 hint, which need the caller's
-- FULL grant list regardless of the active hat.
create or replace function public.session_context()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with me as (select (select auth.uid()) as uid)
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'full_name',            p.full_name,
        'is_active',            p.is_active,
        'suspended_until',      p.suspended_until,
        'email_confirmed_at',   p.email_confirmed_at,
        'must_change_password', p.must_change_password
      )
      from public.profiles p cross join me
      where p.id = me.uid
    ),
    'grants', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'role', m.role,
                 'organization', case when o.id is not null then
                   jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name) end,
                 'hospital', case when h.id is not null then
                   jsonb_build_object('id', h.id, 'slug', h.slug, 'name', h.name,
                                      'organization_id', h.organization_id) end,
                 'commission', case when c.id is not null then
                   jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug,
                     'organization', jsonb_build_object(
                       'id', co.id, 'slug', co.slug, 'name', co.name)) end
               )
               -- Deterministic order so pgTAP can compare snapshots directly.
               order by m.role, coalesce(c.name, h.name, o.name), m.id
             )
      from public.memberships m
      cross join me
      left join public.organizations o  on o.id  = m.organization_id
      left join public.hospitals     h  on h.id  = m.hospital_id
      left join public.commissions   c  on c.id  = m.commission_id
      left join public.organizations co on co.id = c.organization_id
      where m.principal_id = me.uid
        -- Verbatim from app.has_role_any's own expiry filter (unchanged by ACT
        -- Stage 3's caller-only condition -- re-diffed 2026-08-10, still
        -- byte-identical: `m.expires_at is null or m.expires_at > now()`).
        --
        -- ACT Stage 3 (ADR 0106 D9 / plan §1): this function is a DESIGNED
        -- hat-blind door. It deliberately does NOT gain has_role_any's new
        -- caller-only active-role condition -- the picker and the D9 hint need
        -- the caller's FULL grant list (every role type held, regardless of
        -- which hat is currently active) to build their option lists; a
        -- hat-scoped read could never show the OTHER hats there are to switch
        -- TO. Do not "fix" this to match has_role_any -- that would break the
        -- picker. Allowlisted the way service_role is exempt under D11 (Stage
        -- 4 records this in the 0079 findings file per the plan's own
        -- sequencing; this comment is the Stage 3 confirmation).
        and (m.expires_at is null or m.expires_at > now())
    ), '[]'::jsonb)
  );
$function$;

-- ── 8. public.custom_access_token_hook extended ─────────────────────────────
-- EXTENDED, not replaced: keeps the existing is_admin stamp verbatim, adds the
-- active_role claim per D11/D12/D5. Runs as `postgres` (config.toml
-- `pg-functions://postgres/public/custom_access_token_hook`), so it bypasses
-- RLS on app.active_role_selections without any new grant.
create or replace function public.custom_access_token_hook(event jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  claims jsonb;
  v_is_admin boolean;
  v_user_id uuid := (event ->> 'user_id')::uuid;
  -- `session_id` is one of GoTrue's required base claims -- already present in
  -- the INCOMING claims object the hook receives (verified against current
  -- Auth Hook docs: Inputs = user_id/claims/authentication_method; `claims`
  -- itself is pre-populated with session_id before the hook runs).
  v_session_id uuid := nullif(event -> 'claims' ->> 'session_id', '')::uuid;
  v_selected_role text;
  v_live_roles text[];
begin
  select is_admin into v_is_admin
  from public.profiles
  where id = v_user_id;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(coalesce(v_is_admin, false)));

  -- ACT (ADR 0106 D12): the active_role claim, session-bound (D7: fresh each
  -- session, one hat per sign-in).
  if v_session_id is not null then
    select role::text into v_selected_role
    from app.active_role_selections
    where session_id = v_session_id;
  end if;

  if v_selected_role is not null then
    -- An explicit selection for THIS session wins.
    claims := jsonb_set(claims, '{active_role}', to_jsonb(v_selected_role));
  else
    -- D11 break-glass: no selection row. Exactly one live role TYPE -> derive
    -- implicitly (platform_admin included -- its own type, no UI involved).
    -- Zero or multiple role types -> NO claim at all (D5: fail closed).
    select array_agg(distinct role) into v_live_roles
    from (
      select 'platform_admin'::text as role where coalesce(v_is_admin, false)
      union all
      select distinct m.role from public.memberships m
      where m.principal_id = v_user_id
        and (m.expires_at is null or m.expires_at > now())
    ) t;

    if coalesce(array_length(v_live_roles, 1), 0) = 1 then
      claims := jsonb_set(claims, '{active_role}', to_jsonb(v_live_roles[1]));
    end if;
    -- else: no active_role key at all -- not a JSON null, an absent key
    -- (matching test_helpers.claims_for's own established convention).
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$function$;

-- ── 9. app.audit_write generalises actor_is_admin -> metadata.acting_as ────
-- D8: every audit row stamps the active role; the stamp reads from the SAME
-- claim the permission check read (app.active_role()), so the record and the
-- enforcement can never disagree. Free per D8's own framing: audit_log.metadata
-- is inside the hash chain already, no migration to the hash function itself.
-- Omitted (not a JSON null) when the caller has no active role -- service_role
-- paths (D11 exemption) and any hatless caller never get a phantom stamp.
create or replace function app.audit_write(
  p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb,
  p_organization uuid default null::uuid, p_hospital uuid default null::uuid
)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_seq bigint;
  v_prev_hash text;
  v_occurred timestamptz := now();
  v_lock_key text;
  v_row_hash text;
  v_org uuid := p_organization;
  v_hospital uuid := p_hospital;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_acting_as text;
begin
  if not app.feature_enabled('audit_trail') then
    return;
  end if;

  if v_actor is not null then
    v_actor_is_admin := coalesce(app.is_admin(), false);
  end if;

  v_acting_as := app.active_role();
  if v_acting_as is not null then
    v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
  end if;

  -- Derive org + hospital from the commission when a commission was passed (the
  -- ~62 trg_audit_* callers do exactly this). A commission ALWAYS belongs to a
  -- hospital + org (post-reseed) -> the commission row is org-set + hospital-set +
  -- commission-set.
  if p_commission is not null then
    select organization_id, hospital_id into v_org, v_hospital
    from public.commissions where id = p_commission;
  end if;

  -- The CHAIN is identified by PRECEDENCE (matching verify_audit_chain):
  --   commission set -> commission chain (keyed on commission_id ALONE)
  --   hospital set    -> hospital chain   (hospital_id, commission NULL)
  --   org set         -> org chain        (organization_id, hospital + commission NULL)
  --   else            -> platform chain   (all NULL)
  if p_commission is not null then
    v_lock_key := 'audit:c:' || p_commission::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where commission_id = p_commission
    order by seq desc limit 1;
  elsif v_hospital is not null then
    v_lock_key := 'audit:h:' || v_hospital::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where hospital_id = v_hospital and commission_id is null
    order by seq desc limit 1;
  elsif v_org is not null then
    v_lock_key := 'audit:o:' || v_org::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id = v_org and hospital_id is null and commission_id is null
    order by seq desc limit 1;
  else
    v_lock_key := 'audit:p';
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id is null and hospital_id is null and commission_id is null
    order by seq desc limit 1;
  end if;

  v_seq := coalesce(v_seq, 0) + 1;

  v_row_hash := encode(
    extensions.digest(
      coalesce(v_prev_hash, '') || app.audit_canonical(
        v_seq, v_occurred, v_actor, v_actor_is_admin, p_commission,
        p_action, p_entity_type, p_entity_id, p_summary,
        v_metadata, v_org, v_hospital
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_log (
    occurred_at, organization_id, hospital_id, commission_id, actor_id, actor_is_admin,
    action, entity_type, entity_id, summary, metadata,
    seq, prev_hash, row_hash
  ) values (
    v_occurred, v_org, v_hospital, p_commission, v_actor, v_actor_is_admin,
    p_action, p_entity_type, p_entity_id, p_summary,
    v_metadata,
    v_seq, v_prev_hash, v_row_hash
  );
end;
$function$;

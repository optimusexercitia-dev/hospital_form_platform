-- ACT Stage 2 (ADR 0106) — behaviour-preserving normalisation.
--
-- Re-bases the 8 boolean gates that read `public.memberships` directly onto
-- `app.has_role` / `app.has_role_any`, so that Stage 3 has ONE place to add
-- the caller-only active-role ("hat") condition instead of eight.
--
-- Derived from the live catalog (comment-stripped `prosrc`, all ~149 boolean
-- gates in `app`+`public`), not from the QA-r1 hypothesis list — the catalog
-- reconciled to exactly the same 8 names; see docs/plans/act-as-buildnotes.md
-- Stage 2 for the full derivation and the per-function equivalence proof:
--   app.can_manage_professional, app.is_entitled_document_approver,
--   app.is_hospital_member_of, app.is_org_level_admin_within,
--   app.is_org_member, app.is_pqs_member_of_any,
--   app.is_pqs_operator_in_org_for, app.is_quality_reviewer_in_org
--
-- CREATE OR REPLACE only (never DROP+CREATE) — preserves ACL/owner/prosecdef
-- exactly. No parameter renames. No semantic change: every rewrite below is
-- an exact re-expression of the prior predicate through has_role/has_role_any,
-- except `can_manage_professional`, whose original memberships-branch carried
-- no expiry filter (a pre-existing quirk, unrelated to this migration) — its
-- rewrite reproduces that quirk verbatim via an explicit compensating clause
-- rather than silently tightening it. See buildnotes for the empirical proof.

-- 1. app.is_org_member(p_org_id) — "member (any role) of a commission in this org".
--    Was a direct memberships+commissions join; now delegates the per-commission
--    membership check to has_role_any (scope='commission'), unifying identity/
--    expiry logic in one place while keeping the org->commission join local
--    (has_role_any has no hierarchical/org-tier notion of "any commission under").
create or replace function app.is_org_member(p_org_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active((select auth.uid())) and exists (
    select 1
    from public.commissions c
    where c.organization_id = p_org_id
      and app.has_role_any('commission', c.id, (select auth.uid()))
  );
$function$;

-- 2. app.is_hospital_member_of(p_hospital_id) — same pattern, hospital tier.
create or replace function app.is_hospital_member_of(p_hospital_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active((select auth.uid())) and exists (
    select 1
    from public.commissions c
    where c.hospital_id = p_hospital_id
      and app.has_role_any('commission', c.id, (select auth.uid()))
  );
$function$;

-- 3. app.is_entitled_document_approver(p_hospital, p_user) — same pattern,
--    explicit target principal (not auth.uid()).
create or replace function app.is_entitled_document_approver(p_hospital uuid, p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active(p_user) and exists (
    select 1
    from public.commissions c
    where c.hospital_id = p_hospital
      and app.has_role_any('commission', c.id, p_user)
  );
$function$;

-- 4. app.is_org_level_admin_within(p_org_id) — org-tier row, role IN two
--    values. Both roles carry organization_id = p_org_id on a match (per
--    memberships_scope_shape), so has_role('organization', ...) matches
--    identically to the original's direct organization_id filter.
create or replace function app.is_org_level_admin_within(p_org_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active((select auth.uid())) and (
    app.has_role('organization', p_org_id, 'hospital_admin', (select auth.uid()))
    or app.has_role('organization', p_org_id, 'nsp_org_admin', (select auth.uid()))
  );
$function$;

-- 5. app.is_pqs_member_of_any(p_user_id) — "pqs_member at ANY hospital", no
--    scope_id known in advance. Enumerates the user's own hospital-tier rows
--    (any role, purely a candidate/performance narrowing — the pqs_member
--    row itself, if any, is always among them) and re-verifies each via
--    has_role; the AND-composition means the enumeration cannot widen or
--    narrow the result relative to has_role's own verdict.
create or replace function app.is_pqs_member_of_any(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active(p_user_id) and exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and m.hospital_id is not null
      and app.has_role('hospital', m.hospital_id, 'pqs_member', p_user_id)
  );
$function$;

-- 6. app.is_pqs_operator_in_org_for(p_org_id, p_user_id) — role IN two
--    values, org-tier match. pqs_member/nsp_coordinator rows always carry
--    organization_id = their org (memberships_scope_shape), so
--    has_role('organization', ...) reproduces the original's direct
--    organization_id filter exactly; the original's `hospital_id is not
--    null` guard is always true for these two roles per the same CHECK, so
--    dropping it changes nothing.
create or replace function app.is_pqs_operator_in_org_for(p_org_id uuid, p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active(p_user_id) and (
    app.has_role('organization', p_org_id, 'pqs_member', p_user_id)
    or app.has_role('organization', p_org_id, 'nsp_coordinator', p_user_id)
  );
$function$;

-- 7. app.is_quality_reviewer_in_org(p_org_id) — single-role, org-tier match;
--    direct 1:1 rewrite onto has_role.
create or replace function app.is_quality_reviewer_in_org(p_org_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active((select auth.uid()))
     and app.has_role('organization', p_org_id, 'quality_reviewer', (select auth.uid()));
$function$;

-- 8. app.can_manage_professional(p_org, p_uid) — gates 10 professional-
--    identity/ethics-vocab write RPCs. Its raw memberships branch (staff_admin
--    at a commission in p_org) carries NO expiry filter, unlike has_role's
--    canonical check (verified empirically: seed data carries zero expired
--    memberships, so a synthetic expired-row fixture was used to prove this;
--    see buildnotes). Delegating to has_role alone would silently NARROW
--    behaviour (an expired staff_admin would newly lose the capability) —
--    forbidden by Stage 2's "no semantic change" rule. The compensating
--    `or exists (... expired ...)` clause reproduces the omission verbatim:
--    has_role(...) covers the non-expired subset (now hat-aware from Stage 3
--    onward); the compensating clause covers exactly the expired subset that
--    has_role would otherwise exclude. Together they partition the original
--    predicate with no gap and no overlap. Whether the expiry omission
--    itself is a latent bug is a separate, unresolved question — flagged to
--    the lead, not fixed here (that would be a semantic change).
--    Note also (unrelated to the memberships rebase, pre-existing, unchanged
--    by this migration): the `is_org_admin_of(p_org)` disjunct reads the
--    CALLER's auth.uid(), not the `p_uid` target parameter. Every live call
--    site binds `p_uid => auth.uid()` (verified: e.g.
--    public.create_professional_profile calls
--    `app.can_manage_professional(p_org, auth.uid())`), so caller and target
--    coincide in practice; flagged for completeness per plan §2's
--    caller-vs-third-party concern, not altered here.
create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select p_uid is not null and (
    coalesce(app.is_admin(), false)
    or app.is_org_admin_of(p_org)
    or exists (
      select 1 from public.commissions c
      where c.organization_id = p_org
        and (
          app.has_role('commission', c.id, 'staff_admin', p_uid)
          or exists (
            select 1 from public.memberships m
            where m.commission_id = c.id
              and m.principal_id = p_uid
              and m.role = 'staff_admin'
              and m.expires_at is not null
              and m.expires_at <= now()
          )
        )
    )
  );
$function$;

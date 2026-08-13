-- BUG-ACT-EXPIRY-1 — `app.can_manage_professional` honours membership expiry.
--
-- THE DEFECT. Before ACT, this gate's raw `public.memberships` branch carried no
-- `expires_at` filter, so a principal whose commission `staff_admin` membership had
-- ALREADY EXPIRED still passed it. Everywhere else on this platform `expires_at` is
-- live-or-nothing (`224_memberships_collapse.sql` §9 pins the semantics: NULL never
-- filters, a past date does), and `app.has_role` implements exactly that. This gate
-- was the sole dissenter.
--
-- WHY IT SURVIVED STAGE 2. `20260918001000` re-based 8 direct-`memberships` readers
-- onto `has_role`. `has_role` filters expiry; the original predicate did not; so a
-- BEHAVIOUR-PRESERVING refactor had to keep the expired subset reachable, and it did
-- so through an explicit compensating clause (`expires_at is not null and
-- expires_at <= now()`) partitioning the original predicate with no gap and no
-- overlap. That was correct: a refactor that silently tightens an authz gate is
-- smuggling a security change under a rename. The tightening was deferred to here,
-- where it gets its own migration and its own keystone.
--
-- WHAT STAGE 3 ALREADY TOOK. `20260918002800` gave the compensating clause a
-- caller-only hat condition, which incidentally made it unreachable for its MAIN
-- population: an expired-ONLY principal can never obtain the `staff_admin` hat at
-- all (`assume_role` validates live holding; `custom_access_token_hook` derives only
-- from live rows). What survived was the cross-org shape — a LIVE `staff_admin` in
-- one org (hat derived implicitly) PLUS an expired `staff_admin` in the org being
-- asked about. Keystone 318 assertion 10 pinned that surviving reach. This migration
-- closes it.
--
-- BLAST RADIUS. 10 SECURITY DEFINER write RPCs gate on this function (catalog-
-- derived, not from memory): create/update/redact_professional_profile,
-- set_professional_link_state, create/archive_ethics_allegation_category,
-- create/archive_ethics_sanction_type, create/archive_case_assignment_role.
-- Every one of them is a Class-2 professional-identity or ethics-vocabulary write.
--
-- NOT A NO-OP, AND NOT AN OBSERVABLE REGRESSION EITHER. `seed.sql` carries zero
-- expired memberships, which is why the quirk took a synthetic fixture to observe
-- and why no existing test could have caught it. The change is a strict TIGHTENING:
-- the removed clause could only ever return true, never false.
--
-- CREATE OR REPLACE only (never DROP+CREATE) — preserves ACL, owner, and prosecdef
-- exactly. No parameter renames (a parameter rename is a privilege reset).

create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- The `is_org_admin_of(p_org)` disjunct reads the CALLER's auth.uid(), not the
  -- `p_uid` target parameter. Pre-existing, unchanged here, and flagged in Stage 2:
  -- every live call site binds `p_uid => auth.uid()`, so caller and target coincide
  -- in practice. Left alone deliberately — this migration carries one change.
  --
  -- `has_role` is now the ONLY membership path. It filters expiry
  -- (`expires_at is null or expires_at > now()`) and carries the ACT caller-only
  -- hat condition internally, so both properties are inherited rather than
  -- re-implemented — which is the whole point of the Stage 2 rebase.
  select p_uid is not null and (
    coalesce(app.is_admin(), false)
    or app.is_org_admin_of(p_org)
    or exists (
      select 1 from public.commissions c
      where c.organization_id = p_org
        and app.has_role('commission', c.id, 'staff_admin', p_uid)
    )
  );
$function$;

comment on function app.can_manage_professional(uuid, uuid) is
  'Gate for the 10 Class-2 professional-identity / ethics-vocabulary write RPCs. '
  'Membership is read through app.has_role only, so expiry and the ACT caller-only '
  'hat condition are inherited, not re-implemented. The expired-membership '
  'compensating clause Stage 2 preserved was removed by BUG-ACT-EXPIRY-1 '
  '(20260918003000); do not reintroduce a raw memberships read here.';

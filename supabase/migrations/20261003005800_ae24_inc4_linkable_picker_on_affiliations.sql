-- ============================================================================
-- AE2.4 INCREMENT 4 — the coordinator's "possui conta" picker moves off
--         `profiles.home_organization_id` onto the `organization_affiliations`
--         substrate WITHOUT moving its audience.
--
-- Plan/ruling:  ADR 0164 § Decision item 4 (shape C-b'; option C-a REJECTED)
-- Keystone:     supabase/tests/395_ae24_inc4_linkable_picker.sql
--               (written first; observed RED — Files=2, Tests=9: § 0.1-0.6 and
--                § 0.8 failed and § 1 aborted on "function
--                public.list_linkable_org_users(uuid) does not exist".
--                ⚠ § 0.7 PASSED pre-migration and could not have failed on that
--                axis — it pins that `organization_affiliations_select` is
--                UNCHANGED, which is true by construction before the change.
--                Said rather than counted as a red.)
-- Phase record: docs/progress/authz-ae2.md § AE2.4 increment 4
--
-- ============================================================================
-- WHY A DOOR AT ALL, WHEN THE OLD READ WAS A PLAIN RLS SELECT
-- ============================================================================
-- `listLinkableOrgUsers` (src/lib/queries/members.ts) read `profiles` filtered
-- `home_organization_id = <org>` under the CALLER'S OWN RLS, deliberately: its
-- audience is "the coordinator's own read perimeter, intersected with the org",
-- carried by `profiles_select_self_or_admin`'s CO-MEMBERSHIP arm.
--
-- ⛔ THE NAIVE RE-PREDICATION IS MEASURED AND REJECTED.  Re-pointing that read
--    at `organization_affiliations` collapses a coordinator's picker from TEN
--    candidates to ONE — themselves — because that table's SELECT policy is
--    `principal_id = auth.uid() OR app.is_org_admin_of(organization_id)`, with
--    NO staff_admin arm and NO hospital tier, BY DESIGN (ADR 0151 D1).  An
--    embedded `!inner` join collapses identically: the embed is RLS-filtered
--    too.  Measured live 2026-08-28: `chefe.ccih` 10 -> 1, `dr.john` 10 -> 1,
--    `multi` 13 -> 1, `hospitaladmin.a1` 23 -> 1.  Only `orgadmin.a` (28 -> 28)
--    is unaffected, which is exactly why measuring one caller proves nothing.
--    395 § 1.6 re-measures the collapse every run.
--
-- ⛔ THE STAKES ARE GOVERNANCE, NOT UX.  A coordinator who cannot find the
--    respondent under *possui conta* is pushed to *não possui conta*, which
--    ADR 0108 D6 makes an AUDITED HUMAN ASSERTION rendering the case exclusion
--    VACUOUSLY SATISFIED.  The impedimento silently stops working and the record
--    shows a deliberate assertion where there was a UI dead end.
--
-- ⛔ OPTION C-a IS REJECTED AND MUST NOT BE RE-PROPOSED (ADR 0164 § Consequences):
--    adding a staff_admin / co-membership arm to `organization_affiliations_select`
--    repairs an application read by WIDENING A TENANCY POLICY, against an ADR that
--    says "no hospital tier, by design".  A policy widened for a picker stays
--    widened for everything else it gates.  395 § 0.7 is that prohibition
--    expressed as a GATE (policy count + command + qual md5) rather than as prose.
--
-- SHAPE C-b':  a `public` **INVOKER** RPC whose body filters with a `bool`-returning
-- `app` **DEFINER** helper.  The wrapper being INVOKER is what preserves the
-- perimeter EXACTLY (`profiles` RLS still applies to the caller); the helper being
-- DEFINER is what takes the AFFILIATION lookup, and only that, out of RLS.  It
-- never materialises a roster.
--
-- ⚠ THE WRAPPER'S `prosecdef = f` IS LOAD-BEARING, NOT HYGIENE.  Flip it and the
--   picker stops being a perimeter intersection and becomes an org-wide roster
--   disclosure.  395 § 0.1 pins the flag; § 4.1 is the BEHAVIOURAL cell that reds
--   when it flips, with § 4.2 as the floor that stops § 4.1 passing over an empty
--   set.
--
-- ============================================================================
-- ⚠ A PRE-DECLARED WIDENING, INHERENT TO C-b' AND STATED RATHER THAN DISCOVERED
-- ============================================================================
-- An INVOKER wrapper may only call functions ITS CALLER may execute, so the
-- DEFINER helper must be granted to `authenticated`.  That makes it a one-bit
-- existence oracle: a caller who already holds a (person, org) uuid pair may ask
-- whether that person is actively affiliated there.
--
-- Bounded, and the bound is ASSERTED rather than argued (395 § 5.1 / § 5.2):
--   · one bit about a pair of opaque uuids — not enumerable;
--   · for a person the caller can ALREADY see it discloses nothing the picker
--     does not (inclusion/exclusion says the same thing);
--   · it does NOT become a roster — the policy is untouched and a cross-org
--     caller still reads ZERO `organization_affiliations` rows.
-- ⛔ The alternative that removes the oracle — a DEFINER wrapper re-imposing the
--    `profiles` perimeter in its own body — was REJECTED: it duplicates a six-arm
--    RLS policy inside a function, and the second copy is what drifts.
--
-- ============================================================================
-- PRE-DECLARED BEHAVIOUR DELTA (395 § 2 measures every cell)
-- ============================================================================
--   NARROWINGS  a person whose only affiliation in the org is ENDED · one whose
--               only row is VOIDED · one whose ACTIVE affiliation is in ANOTHER
--               org although the column says this one · a person with NO
--               affiliation row at all (the ADR 0164 orphan window).
--   WIDENING    a person ACTIVELY affiliated to an organisation appears in THAT
--               organisation's picker even when the column says otherwise — the
--               substrate being the truth.
--
-- ⚠ ACTIVE, not NON-VOIDED, and the divergence from ADR 0163's retention is
--   deliberate with AE2.2's own reason of record: this door answers *"who may be
--   SEATED here"* — the same question as `list_addable_commission_members` —
--   while `app.person_authority_orgs` answers *"who may be ADMINISTERED"*.
--   Retention answers the second only and was never an input to the first, so
--   active-only here is not a RESTRICTION of retention; retention is out of scope.
--   ⛔ Do not "unify" the two predicates.  395 § 2.2 is the cell that flips if
--   anyone does, and 395 § 8.1 re-derives that this door and
--   `list_addable_commission_members` still carry the SAME tense predicate, so a
--   fix applied to one sibling and not the other reds instead of shipping.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- The predicate.  DEFINER, because the whole point is that the affiliation
-- lookup must not run under the caller's RLS.
--
-- ⚠ `principal_id` in the body is what puts this function inside ARM=policy's
--   PRED_DOMAIN (its NAME matches no door-filter prefix).  395 § 0.6 evaluates
--   the harness's own domain expression, so a rewrite that drops the word and
--   silently leaves the swept domain reds there.
-- ----------------------------------------------------------------------------
create or replace function app.person_has_active_org_affiliation(
  p_person uuid,
  p_organization uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
      from public.organization_affiliations oa
     where oa.principal_id = p_person
       and oa.organization_id = p_organization
       and oa.ended_on is null
       and oa.voided_at is null
  );
$function$;

comment on function app.person_has_active_org_affiliation(uuid, uuid) is
  'AE2.4 inc 4 — "is this person ACTIVELY affiliated to this organisation?", evaluated '
  'outside the caller''s RLS so a `public` INVOKER wrapper can intersect it with the '
  'caller''s own `profiles` perimeter. Contains NO caller term: it LOCATES, it never '
  'GRANTS (Architecture Rule 13). ACTIVE, not non-voided — the staffing question, not '
  'the administration question (ADR 0163 bound 3).';

revoke all on function app.person_has_active_org_affiliation(uuid, uuid) from public;
grant execute on function app.person_has_active_org_affiliation(uuid, uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- The wrapper.  `public` so PostgREST exposes it (`app.*` RPCs are 404), INVOKER
-- so `profiles` RLS decides the audience, plpgsql so it sits INSIDE ARM=wrapper's
-- and the census's clause-2 domain rather than escaping the enumeration through a
-- language choice nobody would notice.
--
-- ⚠ The three output columns are `AddableUser`'s three fields, NOT `setof profiles`:
--   under INVOKER a `profiles` composite cannot even be produced (`authenticated`
--   holds no column grant on cpf / date_of_birth / phone — measured), and under
--   DEFINER it would disclose all three.  What preserves the perimeter is the
--   SECURITY CONTEXT, never the return type.
--
-- ⚠ `limit 500` is carried over verbatim from the shipped read. It is a silent cap
--   in both versions; 395 § 6.2 pins its presence because no fixture this repo can
--   build reaches it, so the alternative is not a better assertion but none.
-- ----------------------------------------------------------------------------
create or replace function public.list_linkable_org_users(p_organization uuid)
returns table (user_id uuid, full_name text, email text)
language plpgsql
stable
security invoker
set search_path to 'public', 'app', 'pg_catalog'
as $function$
begin
  return query
    select p.id, p.full_name, p.email::text
      from public.profiles p
     where p.is_active
       and not p.is_admin
       and app.person_has_active_org_affiliation(p.id, p_organization)
     order by p.full_name asc nulls last, p.id
     limit 500;
end;
$function$;

comment on function public.list_linkable_org_users(uuid) is
  'AE2.4 inc 4 — the "possui conta" picker (ETH·E4, ADR 0108 D6). SECURITY INVOKER on '
  'purpose: `profiles` RLS is the audience decision, and this door only replaces the '
  'org filter. `is_admin` stays excluded (the noun rule, ADR 0078 A35) and `is_active` '
  'stays required. Callers: src/lib/queries/members.ts listLinkableOrgUsers.';

revoke all on function public.list_linkable_org_users(uuid) from public;
grant execute on function public.list_linkable_org_users(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- M3 / ADR 0164's REQUIRED MITIGATION — the orphan detector gains a caller.
--
-- `app.tenant_orphan_profiles()` shipped in `…005600` well-built, correctly
-- discriminated on `is_admin`, proven able to fire by 393 § 1.5/§ 1.6 — and with
-- NO caller outside pgTAP, which does not run in production.  ADR 0164 says the
-- mitigation is REQUIRED, so a detector nothing ever asks does not discharge it.
--
-- ⛔ AND IT COULD NOT HAVE ACQUIRED ONE AS IT STOOD, WHICH THE TYPECHECKER FOUND
--    AND NO REVIEW DID: it lives in `app`, and PostgREST exposes only `public`,
--    so `client.rpc('tenant_orphan_profiles')` is a 404 by construction — the
--    "correct door nothing can reach" shape.  A grant on the `app` function would
--    have been a fix that changes nothing.  This wrapper is the reachable half.
--
-- ⚠ `service_role` ONLY.  Never `authenticated`: a row-returning DEFINER is a gate
--   you can WALK THROUGH rather than one you can neutralize, and this one
--   enumerates precisely the people no tenant admin can reach.  The `app` function
--   keeps its `postgres`-only ACL untouched — the wrapper is DEFINER, so it needs
--   no grant there, and 393 § 1.1's three role bits stay exactly as they were.
--
-- ⛔ ARM DOMAINS, DERIVED RATHER THAN ASSUMED — this wrapper is in NONE of the four:
--   census c1 admits a set-returning DEFINER only when `authenticated` may EXECUTE
--   (it may not); census c2 and ARM=wrapper require `prosecdef = f`; ARM=policy's
--   PRED_DOMAIN is boolean-returning only; ARM=floor requires `authenticated`
--   EXECUTE.  Absence of a verdict is absence of coverage, so the compensating
--   controls are named: 395 § 9.1 (ACL, asserted positively for all four roles) and
--   § 9.2/§ 9.3 (it returns the same rows as the `app` function it wraps, and it
--   still refuses to name the platform admin).
-- ----------------------------------------------------------------------------
create or replace function public.tenant_orphan_profiles()
returns table (profile_id uuid, reason text)
language sql
stable
security definer
set search_path to 'public', 'app', 'pg_catalog'
as $function$
  select t.profile_id, t.reason from app.tenant_orphan_profiles() t;
$function$;

comment on function public.tenant_orphan_profiles() is
  'AE2.4 inc 4 — the PostgREST-reachable half of ADR 0164''s required orphan-detection '
  'mitigation. Pure delegation: every rule, including the `is_admin` discriminator that '
  'separates an orphan from the platform admin, stays in app.tenant_orphan_profiles(). '
  'service_role only. Caller: listTenantOrphans() → isTenantOrphan() in '
  'src/lib/users/actions.ts, on createPerson''s success and post-account failure paths.';

revoke all on function public.tenant_orphan_profiles() from public;
grant execute on function public.tenant_orphan_profiles() to service_role;

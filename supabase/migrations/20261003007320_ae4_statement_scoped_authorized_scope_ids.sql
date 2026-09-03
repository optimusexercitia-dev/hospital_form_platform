-- AE4 / IA-F9 follow-on — the INVOCATION-STRUCTURE increment the acceptance named.
-- Obligation: docs/design/authz-ae4-performance-acceptance.md §12.4, which localized the
-- residue and said outright that removing it "is a change to authz.entailed_grants'
-- invocation structure, not to scope_reaches, and it is a different increment with its own
-- approval". PO-approved 2026-09-03. ADR 0182.
--
-- ============================================================================
-- WHAT CHANGES. Three NEW functions and ONE altered policy predicate. ⛔ Nothing existing
-- is redefined: authz.scope_reaches, authz.entailed_grants, authz.assignment_facts,
-- authz.has_permission, authz.candidate_has_permission and app.can_read_professional_profile
-- are all left EXACTLY as they are. That is deliberate — app.can_read_professional_profile
-- has two other DEFINER callers (app._audit_access_authorized, public.get_case_professional)
-- which ask a single-row question and are not the performance subject.
--
--   NEW  authz.authorized_scope_ids(principal, resolution_kind, permission_code)
--   NEW  authz.candidate_authorized_scope_ids(...)      -- the test_validation-visible twin
--   NEW  app.current_professional_read_organizations()  -- the narrow current-principal door
--   ALTER POLICY professional_profiles_select
--
-- ============================================================================
-- THE PROBLEM, MEASURED (not inferred). On the acceptance's own P5 statement — a 10 000-row
-- org-filtered read of public.professional_profiles — the permission arm costs 1 000 164
-- buffers against the legacy arm's 170 164. That is 100 buffers per protected row, and
-- EVERY ONE of the 10 000 rows re-resolves the IDENTICAL 20 assignment facts against the
-- IDENTICAL scope. The policy calls app.can_read_professional_profile(id, uid), which selects
-- organization_id out of the ROW into v_org and passes it to authz.has_permission. Because
-- v_org is row-derived the planner cannot hoist the call, even though on an org-filtered read
-- every row carries the same organization.
--
-- ⛔ THE COST IS VOLUME, NOT A PLAN DEFECT. Attribution is by measurement: DC1b plants ~50x
-- cost into scope_reaches and moves the statement 18.12x/17.01x; DC1a plants into
-- assignment_facts and moves it 1.58x/1.68x. scope_reaches' PLAN was already fixed by
-- 20261003007310 and P1 passes. What remains is ~200 000 evaluations of a question with
-- ~2 distinct answers.
--
-- ============================================================================
-- WHY THE SET FORM IS EQUIVALENT — an identity, not a heuristic.
--
-- For a FIXED principal, permission code and resolution kind, authz.has_permission's answer
-- depends on the requested scope id through exactly ONE term: the
-- authz.scope_reaches(af.scope_kind, af.scope_id, p_resolution_kind, p_scope_id) conjunct
-- inside authz.entailed_grants. Every other gate — the permission's resolution_scope_kind,
-- app.is_active, the expires_at term, roles.state, role_permissions, the implication closure
-- and the hat_ok self/third-party asymmetry — is a function of the ASSIGNMENT FACT and the
-- session, never of the requested id.
--
-- And in all four of its live arms, scope_reaches compares the requested id for EQUALITY
-- against a single derived value:
--
--     same kind            ->  p_assignment_id
--     commission -> org    ->  commissions.organization_id
--     hospital   -> org    ->  hospitals.organization_id
--     commission -> hosp   ->  commissions.hospital_id
--     anything else        ->  false
--
-- So per assignment fact there is EXACTLY ONE id that can satisfy it. Therefore
--
--     has_permission(P, K, X, C)   <=>   X in authorized_scope_ids(P, K, C)
--
-- ⛔ AND THE IMPLEMENTATION DOES NOT RELY ON THAT ARGUMENT BEING RIGHT. The CASE below only
-- PROPOSES a candidate; authz.has_permission ITSELF then confirms every candidate before it
-- is returned. Consequences, and they are the whole safety story:
--
--   * OVER-GRANT IS IMPOSSIBLE BY CONSTRUCTION. Every id this function returns has been
--     approved by the unmodified runtime resolver, on the real row, in this statement.
--     No second implementation of role state, the hat, the closure or the hierarchy exists
--     anywhere in this migration to drift out of step with the first.
--   * A WRONG CANDIDATE CAN ONLY DENY. If the CASE ever fails to propose an id that
--     scope_reaches would have accepted, the result is a MISSING grant — a 404/empty list,
--     never an escalation. That is the direction a bug is allowed to point on this path.
--
-- The `distinct` runs BEFORE the confirmation, so has_permission is invoked once per DISTINCT
-- candidate scope, not once per assignment fact. For the measured principal that is 2 calls,
-- not 20.
--
-- ============================================================================
-- WHY IT IS FASTER — measured on the live catalog, ANALYZEd AE4 perf fixture
-- (12 000 users / 10 000 professional_profiles / 48 800 memberships), 2026-09-03, candidate
-- installed in a ROLLED-BACK transaction against the real policy. Read from EXPLAIN.
--
--   M1b permission arm   1 001 345 buffers / 12 178 ms   ->   402 buffers / 8.3 ms
--   M1b legacy arm         170 164 buffers /  2 205 ms   ->   170 254 / 2 175 ms  (unmoved)
--
-- The policy predicate plans as `CASE WHEN (ANY (organization_id = (hashed SubPlan 1).col1))`
-- with the SubPlan at loops=1 returning 2 rows — uncorrelated, built once per statement — and
-- the fallback arm's InitPlan reads `never executed`, i.e. the short-circuit is real.
--
-- ⛔ WHAT THIS IS NOT. It is NOT a cache. Nothing is stored, memoized across statements, or
-- carried in a GUC, a session table or a JWT claim. The set is an uncorrelated subplan inside
-- ONE statement, under ONE MVCC snapshot; the next statement recomputes it. A membership
-- revoked concurrently was never visible mid-statement anyway. A design that reused an answer
-- ACROSS statements would be privilege escalation wearing a performance argument, and is
-- exactly what ADR 0182 rejects.
--
-- ⛔ WHAT IT DOES NOT FIX. public.professional_participants' SELECT policy calls the same
-- per-row authorizer and is left UNCONVERTED, deliberately: its product input is bounded to
-- <= 20 profile ids (src/lib/queries/participants.ts), it has no failing acceptance condition
-- driving it, and the acceptance's DC1 control is being re-aimed onto it precisely BECAUSE it
-- is still per-row. Recorded as an open follow-up, not treated as solved.
--
-- ⚠ SHAPE BOUND. This is O(distinct candidate scopes) has_permission calls per statement,
-- and O(1) in protected rows — which is the acceptance's subject. Max memberships per
-- principal on the fixture is 20 (avg 4.1, none above 50).
-- ============================================================================

-- Preflight. The candidate map below mirrors authz.scope_reaches' four arms. If that function
-- ever grows a FIFTH arm, this map would silently stop proposing ids for it — a DENIAL, never
-- an escalation, but still a defect. Refuse to apply if the assumed shape is not what is
-- installed, so the gap is found here rather than as an unexplained empty list.
do $preflight$
declare
  v_src text;
begin
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.proname = 'scope_reaches';

  if v_src is null then
    raise exception 'AE4 authorized_scope_ids REFUSED — authz.scope_reaches is not installed.';
  end if;

  -- The three ascents this migration knows how to propose, plus the same-kind arm.
  if not (v_src like '%p_assignment_kind = p_resolution_kind%'
          and v_src like '%c.organization_id%'
          and v_src like '%h.organization_id%'
          and v_src like '%c.hospital_id%') then
    raise exception
      'AE4 authorized_scope_ids REFUSED — authz.scope_reaches does not have the four arms this candidate map mirrors.'
      using hint = 'Re-read the body and extend the CASE in authz.authorized_scope_ids to match, then re-apply.';
  end if;
end
$preflight$;

-- ============================================================================
-- authz.authorized_scope_ids — the runtime set resolver.
-- Mirrors authz.has_permission's state gate: `authoritative` only.
-- ============================================================================
create or replace function authz.authorized_scope_ids(
  p_principal       uuid,
  p_resolution_kind text,
  p_permission_code text
)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  with candidate as materialized (
    -- PROPOSE. One id per assignment fact, deduplicated before anything is confirmed.
    -- A wrong proposal can only lose a grant; it can never invent one.
    select distinct case
             when af.scope_kind = p_resolution_kind then af.scope_id
             when p_resolution_kind = 'organization' and af.scope_kind = 'commission'
               then (select c.organization_id from public.commissions c where c.id = af.scope_id)
             when p_resolution_kind = 'organization' and af.scope_kind = 'hospital'
               then (select h.organization_id from public.hospitals h where h.id = af.scope_id)
             when p_resolution_kind = 'hospital' and af.scope_kind = 'commission'
               then (select c.hospital_id from public.commissions c where c.id = af.scope_id)
           end as scope_id
      from authz.assignment_facts(p_principal) af
  )
  -- CONFIRM. The unmodified runtime resolver is the authority, not this function.
  select c.scope_id
    from candidate c
   where c.scope_id is not null
     and authz.has_permission(p_principal, p_resolution_kind, c.scope_id, p_permission_code);
$function$;

-- ============================================================================
-- authz.candidate_authorized_scope_ids — the PRE-CUTOVER twin, for the differential oracle.
-- Identical in every respect except that it confirms with authz.candidate_has_permission,
-- which also sees roles in `test_validation`. That is the state a role occupies WHILE it is
-- being differentialled (403's header). The one-word difference is the ONLY difference, and
-- it mirrors has_permission / candidate_has_permission exactly.
-- ============================================================================
create or replace function authz.candidate_authorized_scope_ids(
  p_principal       uuid,
  p_resolution_kind text,
  p_permission_code text
)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  with candidate as materialized (
    select distinct case
             when af.scope_kind = p_resolution_kind then af.scope_id
             when p_resolution_kind = 'organization' and af.scope_kind = 'commission'
               then (select c.organization_id from public.commissions c where c.id = af.scope_id)
             when p_resolution_kind = 'organization' and af.scope_kind = 'hospital'
               then (select h.organization_id from public.hospitals h where h.id = af.scope_id)
             when p_resolution_kind = 'hospital' and af.scope_kind = 'commission'
               then (select c.hospital_id from public.commissions c where c.id = af.scope_id)
           end as scope_id
      from authz.assignment_facts(p_principal) af
  )
  select c.scope_id
    from candidate c
   where c.scope_id is not null
     and authz.candidate_has_permission(p_principal, p_resolution_kind, c.scope_id, p_permission_code);
$function$;

-- authz.* resolvers are reachable by NO application role (401 §16); the app layer is the only
-- door. Re-emitted rather than assumed — a NULL proacl includes PUBLIC.
revoke all on function authz.authorized_scope_ids(uuid, text, text) from public;
revoke all on function authz.candidate_authorized_scope_ids(uuid, text, text) from public;

-- ============================================================================
-- app.current_professional_read_organizations — the narrow door the POLICY calls.
--
-- ⛔ IT TAKES NO PRINCIPAL ARGUMENT. The principal is bound internally to auth.uid(), and the
-- permission and resolution kind are FIXED. A generic `authorized_scope_ids for any principal
-- and any permission` exposed to `authenticated` would hand every caller a readable map of
-- their whole capability surface, and would let a caller ask about someone else — which flips
-- entailed_grants' hat conjunct onto its third-party branch, where the hat is not required.
-- Narrowness here is the security property, not tidiness.
-- ============================================================================
create or replace function app.current_professional_read_organizations()
returns setof uuid
language sql
stable
security definer
set search_path to 'app, public, pg_catalog'
as $function$
  select authz.authorized_scope_ids(
           (select auth.uid()),
           'organization',
           'org.professionals.read'
         );
$function$;

revoke all on function app.current_professional_read_organizations() from public;
grant execute on function app.current_professional_read_organizations() to authenticated;
grant execute on function app.current_professional_read_organizations() to service_role;

-- ============================================================================
-- THE POLICY. The set arm is a strict SUBSET of what app.can_read_professional_profile
-- already grants through its permission arm, so the grant set is UNCHANGED in both
-- directions:
--
--   set arm true for row r
--     <=> r.organization_id in authorized_scope_ids(uid,'organization','org.professionals.read')
--     <=> has_permission(uid,'organization', r.organization_id, 'org.professionals.read')   [above]
--     ==> app.can_read_professional_profile(r.id, uid)                                       [its own arm]
--
-- The step marked ==> needs v_org to be non-null, and public.professional_profiles
-- .organization_id is NOT NULL — asserted in the postflight below and pinned by pgTAP 413,
-- because it is load-bearing and a later migration could drop it.
--
-- ⛔ `case ... then true else <fn> end`, NOT `<set> or <fn>`. A disjunction lets the planner
-- order the arms by its own cost estimate, and app.can_read_professional_profile's default
-- cost of 100 is not obviously worse than a hashed subplan; CASE fixes the evaluation order,
-- which is what makes the short-circuit a guarantee rather than an observation.
-- ============================================================================
alter policy professional_profiles_select on public.professional_profiles
  using (
    case
      when organization_id in (select app.current_professional_read_organizations()) then true
      else app.can_read_professional_profile(id, (select auth.uid()))
    end
  );

-- ============================================================================
-- Postflight. Two facts, then a bounded differential on BOTH polarities.
-- ⚠ The differential here is BOUNDED (deterministic sample) so the migration stays fast on a
-- large database. The EXHAUSTIVE differential is pgTAP 413's job; this is a smoke test that
-- refuses to leave a clearly-wrong resolver installed, not the coverage.
-- ============================================================================
do $postflight$
declare
  v_disagree bigint;
  v_cells    bigint;
begin
  if exists (
    select 1 from pg_attribute
     where attrelid = 'public.professional_profiles'::regclass
       and attname  = 'organization_id'
       and not attnotnull
  ) then
    raise exception
      'AE4 authorized_scope_ids POSTFLIGHT FAILED — professional_profiles.organization_id is nullable, '
      'which breaks the subset argument the altered policy rests on.';
  end if;

  with principals as (
    select distinct m.principal_id as id from public.memberships m order by 1 limit 200
  ),
  cells as (
    select authz.has_permission(p.id, 'organization', o.id, 'org.professionals.read') as hp,
           o.id in (select authz.authorized_scope_ids(p.id, 'organization', 'org.professionals.read')) as inset
      from principals p cross join public.organizations o
  )
  select count(*), count(*) filter (where hp is distinct from inset)
    into v_cells, v_disagree
    from cells;

  if v_disagree > 0 then
    raise exception
      'AE4 authorized_scope_ids POSTFLIGHT FAILED — set membership disagrees with authz.has_permission on % of % cells.',
      v_disagree, v_cells;
  end if;

  raise notice
    'AE4 authorized_scope_ids: % cells, set membership and authz.has_permission agree on both polarities.',
    v_cells;
end
$postflight$;

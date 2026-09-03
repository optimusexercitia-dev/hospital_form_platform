-- AE4 / IA-F9 follow-on — the ONE plan defect the performance acceptance localized.
-- Obligation: FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH; acceptance record
-- docs/design/authz-ae4-performance-acceptance.md §§10.3, 11.4. PO ruling 2026-09-02:
-- "scope_reaches fix spun off to its own session" (PROGRESS.md § Now).
--
-- door-sweep-targets: authz.scope_reaches(text, uuid, text, uuid)
--
-- ============================================================================
-- WHAT CHANGES. Exactly ONE of the four CASE arms — the organization-from-commission
-- ascent. It stops joining public.hospitals to read a column public.commissions
-- already carries. Nothing else in the body moves; the other three arms, the
-- signature, the volatility, the SECURITY DEFINER property, the empty search_path
-- and the ACL are all re-emitted unchanged.
--
--   before:  p_requested_id = (select h.organization_id
--                                from public.commissions c
--                                join public.hospitals h on h.id = c.hospital_id
--                               where c.id = p_assignment_id)
--   after:   p_requested_id = (select c.organization_id
--                                from public.commissions c
--                               where c.id = p_assignment_id)
--
-- ============================================================================
-- WHY IT IS EQUIVALENT — a constraint, not an observation.
--
-- public.commissions carries BOTH hospital_id (NOT NULL) and organization_id (NOT
-- NULL), and the composite foreign key
--
--     commissions_hospital_org_fkey
--       FOREIGN KEY (hospital_id, organization_id) REFERENCES hospitals(id, organization_id)
--
-- (backed by the unique index hospitals_id_org_uq) makes the two forms return the
-- same value for every possible argument:
--
--   * commission EXISTS -> hospital_id is NOT NULL, so the FK guarantees exactly one
--     hospitals row whose (id, organization_id) equals (c.hospital_id, c.organization_id).
--     Therefore h.organization_id IS c.organization_id. Both forms return it.
--   * commission ABSENT -> both forms select zero rows and yield NULL, so the outer
--     comparison is NULL in both. The NULL-vs-FALSE semantics are PRESERVED EXACTLY;
--     this is deliberately NOT rewritten as an `exists`, which would return FALSE
--     where the shipped body returns NULL.
--
-- Neither column is nullable, so MATCH SIMPLE's "any column NULL exempts the row"
-- escape cannot apply. The preflight below REFUSES TO APPLY if that FK or either
-- NOT NULL is missing, because the equivalence argument rests on them and on nothing
-- else. pgTAP 412 pins the same three facts so a later migration cannot quietly
-- remove the ground under this body.
--
-- ============================================================================
-- WHY IT IS FASTER — measured on the live catalog, ANALYZEd AE4 perf fixture
-- (12 000 users / 10 000 professional_profiles / 48 800 memberships), 2026-09-02.
-- Read from EXPLAIN, never from the SQL text: the acceptance doc's §9.3 reasoned from
-- this function's source, concluded "reached by primary key", and §10.3 retracted it
-- against the plan.
--
-- The shipped arm plans as an InitPlan Hash Join that scans and hashes the WHOLE
-- hospitals table on every call, then joins it to a single commission row:
--
--     InitPlan 1
--       ->  Hash Join  (cost=8.30..11.88)  Hash Cond: (h.id = c.hospital_id)
--             Buffers: shared hit=5
--             ->  Seq Scan on hospitals h  (cost=0.00..3.24 rows=124)  hit=2
--             ->  Hash  ->  Index Scan using commissions_pkey  (cost=0.28..8.29)  hit=3
--
-- The rewritten arm is one primary-key lookup, 5 buffers -> 3, and it drops a
-- 124-row hash build per call as well:
--
--     Index Scan using commissions_pkey on commissions c  (cost=0.28..8.29)  hit=3
--
-- The measured principal holds 17 commission-scope memberships, so authz.entailed_grants
-- takes this arm 17 times per protected row. Same-session A/B on the acceptance's own P5
-- statement (10 000-row org-filtered read, candidate installed in a rolled-back
-- transaction, best of 3): permission arm 24 890 ms -> 14 589 ms.
--
-- WHAT THIS DOES NOT CLAIM. The acceptance doc calls the shipped plan
-- "O(protected_rows x M x |hospitals|) — the only part of the chain that scales with
-- tenant count". Measured against ANALYZEd copies of hospitals at 124 / 620 / 1 984 /
-- 19 964 rows with identical indexes, that is NOT so: the join flips to a Nested Loop +
-- Index Only Scan by ~2 000 rows, and the sibling organization-from-hospital arm flips
-- at ~620. The seq scan is a SMALL-TABLE artifact (hospitals is 2 pages, so a full scan
-- at cost 3.24 genuinely beats an index descent at 8.29) that the planner corrects on
-- its own as tenants are onboarded. What is fixed here is the wasted join itself, which
-- is paid at EVERY cardinality — not a tenant-count scaling term.
--
-- AND WHAT IT DOES NOT FIX. The organization-from-hospital arm still reads
-- public.hospitals and still plans as a Seq Scan at fixture scale. That is left ALONE
-- deliberately: forcing it onto hospitals_id_org_uq was measured buffer-neutral (2 vs 2),
-- so changing it would move no cost and would only satisfy acceptance condition P1's
-- literal wording. P1 is therefore expected to STILL FAIL after this migration, and is
-- reported as failing. See FUP-AE4-P1-BOUNDS-A-SYNTAX-NOT-A-PROPERTY.
-- ============================================================================

-- Preflight. The equivalence above is a claim about constraints; refuse to apply if
-- any of the three has gone away.
do $preflight$
declare
  v_missing text := '';
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid  = 'public.commissions'::regclass
       and conname   = 'commissions_hospital_org_fkey'
       and contype   = 'f'
       and confrelid = 'public.hospitals'::regclass
  ) then
    v_missing := v_missing || 'commissions_hospital_org_fkey ';
  end if;

  if exists (
    select 1 from pg_attribute
     where attrelid = 'public.commissions'::regclass
       and attname in ('hospital_id', 'organization_id')
       and not attnotnull
  ) then
    v_missing := v_missing || 'commissions.hospital_id/organization_id-NOT-NULL ';
  end if;

  if v_missing <> '' then
    raise exception
      'AE4 scope_reaches ascent rewrite REFUSED — its equivalence proof rests on facts that are missing: %',
      v_missing
      using hint = 'Restore the composite FK / NOT NULLs, or keep the join form. Do not apply this body without them.';
  end if;
end
$preflight$;

create or replace function authz.scope_reaches(
  p_assignment_kind text,
  p_assignment_id   uuid,
  p_resolution_kind text,
  p_requested_id    uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when p_assignment_kind = p_resolution_kind then
      p_assignment_id = p_requested_id

    -- The ascent. commissions.organization_id is the SAME value the join used to
    -- fetch from hospitals — commissions_hospital_org_fkey makes that an enforced
    -- invariant, not a convention. See this migration's header for the proof and
    -- for the plan measurement that motivated it.
    when p_resolution_kind = 'organization' and p_assignment_kind = 'commission' then
      p_requested_id = (select c.organization_id
                          from public.commissions c
                         where c.id = p_assignment_id)

    when p_resolution_kind = 'organization' and p_assignment_kind = 'hospital' then
      p_requested_id = (select h.organization_id from public.hospitals h where h.id = p_assignment_id)

    when p_resolution_kind = 'hospital' and p_assignment_kind = 'commission' then
      p_requested_id = (select c.hospital_id from public.commissions c where c.id = p_assignment_id)

    else false
  end;
$function$;

-- Postflight. Differential over every commission that exists right now: the retired
-- join form and the shipped body must agree on BOTH polarities — the commission's own
-- organization (must grant) and some other organization (must not). A disagreement
-- here means the FK did not imply what the header says it implies.
do $postflight$
declare
  v_disagree bigint;
  v_other    uuid;
  v_total    bigint;
begin
  select count(*) into v_total from public.commissions;

  select o.id into v_other
    from public.organizations o
   where not exists (select 1 from public.commissions c where c.organization_id = o.id)
   limit 1;

  select count(*) into v_disagree
    from public.commissions c
    left join lateral (
      select h.organization_id as joined_org
        from public.commissions c2
        join public.hospitals h on h.id = c2.hospital_id
       where c2.id = c.id
    ) j on true
   where j.joined_org is distinct from c.organization_id
      or authz.scope_reaches('commission', c.id, 'organization', c.organization_id) is distinct from true
      or (v_other is not null
          and authz.scope_reaches('commission', c.id, 'organization', v_other) is distinct from false);

  if v_disagree > 0 then
    raise exception
      'AE4 scope_reaches ascent rewrite DISAGREES with the join form on % of % commissions',
      v_disagree, v_total;
  end if;

  raise notice
    'AE4 scope_reaches ascent rewrite: % commissions, join form and rewritten form agree on both polarities.',
    v_total;
end
$postflight$;

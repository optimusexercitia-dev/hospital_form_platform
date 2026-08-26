-- ============================================================================
-- AFF4 · B5 — ADR 0151 D10: backfill `organization_affiliations` from the
-- `profiles.home_organization_id` column it is replacing as the roster predicate.
--
-- WHAT IT DOES. One ACTIVE org-affiliation row per non-admin profile that carries a
-- `home_organization_id`, with `started_on = created_at::date` and `created_by NULL`.
--
-- ⚠ THE APPROXIMATION, AND WHY IT IS ACCEPTABLE. `started_on` is the date the
--    PROFILE ROW was created, which is not the date the person was employed. It is an
--    approximation, knowingly. It is acceptable because **no real employment records
--    exist anywhere to be approximated away**: before AFF4 the platform had no concept
--    of an org affiliation at all, so there is no truer value being overwritten and no
--    prior record being contradicted — the alternative is not a better date, it is a
--    NULL `started_on`, which the NOT NULL column forbids and which would leave the
--    D4 containment rule unsatisfiable for every pre-existing person. Where a real
--    start date is later learned, `update_org_affiliation` (B4) corrects it and emits
--    `org_affiliation.updated`; the correction path is the reason the approximation is
--    safe rather than permanent.
--    ⚠ `created_at::date` resolves in the SERVER's TimeZone, so the day can differ by
--    one from a reader's local reckoning. Deliberately not pinned to UTC: the value is
--    already an approximation of a fact it cannot know, and a one-day skew in an
--    approximation is not a defect worth a second convention.
--
-- ⚠ NO CLAIM IS MADE HERE ABOUT WHAT THE REMOTE HOLDS. An earlier draft of this
--    comment cited a row count for the linked project. A record's claim about an
--    EXTERNAL system goes stale silently — this repo has had exactly that claim rot
--    five times — so the correctness argument above is written to hold for ANY
--    population: it depends on "no org affiliations existed before this migration",
--    which this migration can verify locally, and NOT on how many rows the remote has.
--
-- ⚠ DATA-DEPENDENT: ON A FRESH `supabase db reset` THIS MATCHES ZERO ROWS, AND THAT
--    IS EXPECTED — `db reset` applies migrations BEFORE `seed.sql`, so `profiles` is
--    empty when this runs. The local seed supplies its own rows (B7); this block
--    exists for the `db push` against a data-bearing database. A zero-row local run
--    therefore proves NOTHING about correctness, and a broken backfill would look
--    identical to a correct one here. It is exercised instead against a seeded
--    database (reset → seed → run this block → assert rows + assert idempotency),
--    which is the only state that can tell the two apart.
--
-- ⛔ NO TOP-LEVEL `set local`. Outside an explicit transaction it is a silent no-op
--    (Postgres warns 25P01 and continues), so it would pass every local gate while
--    doing nothing (gate 6, `lint:set-local`). None is needed: measured against the
--    live catalog, `public.organization_affiliations` carries NO flag-gated BEFORE
--    INSERT guard (its only BEFORE trigger is `guard_org_affiliation_no_delete`, which
--    is DELETE-only) and `relforcerowsecurity` is false with owner `postgres`, so the
--    migration's own role is not filtered by the SELECT policy. The "guard wrap" this
--    block needs is therefore the IDEMPOTENCE guard below, not a session flag.
--
-- ⚠ THE AUDIT TRIGGER FIRES, deliberately. `trg_audit_organization_affiliations`
--    emits one `org_affiliation.created` row per inserted row, with a NULL actor
--    because a migration has none. Rule 11 wants the mutation recorded; a backfill
--    that created rows invisibly would be the worse outcome. NULL-actor writes are the
--    established service-path shape for `app.audit_write`.
--
-- ⚠ THE D4 CONTAINMENT BACKSTOP (the deferred constraint trigger on
--    `hospital_affiliations`) IS STILL NOT INSTALLED and is NOT installed here. The
--    live body of `app.affiliate_person_impl` says it "lands AFTER B5's backfill". That
--    ordering is necessary but not sufficient: `seed.sql` currently inserts hospital
--    affiliations with no org parent (measured on a fresh reset: 5 hospital rows, 0 org
--    rows), so the backstop would fail the seed until B7 adds the org rows. It must
--    land after B7, not merely after B5.
-- ============================================================================

do $$
declare
  v_inserted   bigint;
  v_preexisting bigint;
begin
  -- The premise of the approximation above, asserted rather than assumed: if org
  -- affiliations already exist, some other authority has been writing them and
  -- `created_at::date` is no longer "the only value available". The block still runs
  -- (the idempotence guard makes it safe), but the notice records that the premise
  -- did not hold, so a reviewer of the push log can see it.
  select count(*) into v_preexisting from public.organization_affiliations;

  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  select pr.id,
         pr.home_organization_id,
         pr.created_at::date,
         null                       -- D10: a migration has no actor. Not a fake one.
    from public.profiles pr
   where pr.home_organization_id is not null
     -- The noun rule (ADR 0078 A35): a platform_admin is not a tenant person and does
     -- not belong on a tenant roster, so it gets no employment row either.
     and not pr.is_admin
     -- THE IDEMPOTENCE GUARD. Re-running this migration, or running it after some
     -- rows were created by `affiliate_person_to_org`, inserts nothing rather than
     -- tripping `organization_affiliations_active_uq`. A backfill that can only be run
     -- once is a backfill nobody dares re-run.
     and not exists (
       select 1
         from public.organization_affiliations oa
        where oa.principal_id = pr.id
          and oa.organization_id = pr.home_organization_id
          and oa.ended_on is null
          and oa.voided_at is null
     );

  get diagnostics v_inserted = row_count;

  -- DEACTIVATED ACCOUNTS ARE INCLUDED, and that is not an oversight.
  -- `affiliate_person_impl` REFUSES to affiliate a deactivated account (HC0R4), but
  -- that is a rule about creating NEW employment going forward. This block records
  -- employment that the database already asserts, in the `home_organization_id` column
  -- it is migrating off. Skipping deactivated people would leave exactly the
  -- inconsistent state this backfill exists to remove — a home org with no affiliation
  -- row — and would make every later correction to their record unsatisfiable once the
  -- D4 containment backstop lands.
  raise notice
    'AFF4 B5: % organization_affiliations row(s) backfilled (% pre-existing).',
    v_inserted, v_preexisting;
end;
$$;

-- ============================================================================
-- AFF4 · D4 — THE CONTAINMENT BACKSTOP.
--
-- The rule: an ACTIVE `hospital_affiliations` row implies an ACTIVE
-- `organization_affiliations` row for the same principal in the same organization.
-- The doors already guarantee it (`affiliate_person_impl` ensures the org parent
-- before it writes; `end_org_affiliation_impl` refuses while active hospital
-- affiliations remain). This is the STRUCTURAL guarantee behind them — Rule 1's
-- "enforce in the DB, not just the door".
--
-- ⚠ WHY IT LANDS HERE AND NOT IN B4, stated because the ordering is not obvious and
--    the previous statement of it was wrong. `app.affiliate_person_impl`'s own body
--    said the backstop "lands AFTER B5's backfill". That is NECESSARY BUT NOT
--    SUFFICIENT, and it is corrected below in this same migration. B5's backfill
--    matches ZERO rows on a fresh `supabase db reset` — migrations run BEFORE
--    `seed.sql`, against an empty `profiles` — so the backfill can never be what makes
--    the seed's hospital affiliations legal. Only B7's seed rows can, and they landed
--    in the commit before this one. The true precondition is B7-seed, not B5.
--
-- ⭐ INSTALLING IT HERE MAKES `supabase db reset` THE TEST OF THE SEED ORDERING: if
--    the `organization_affiliations` insert in `seed.sql` is ever moved below the
--    `hospital_affiliations` insert, the reset fails at seed time. That is the cheapest
--    feedback available for an ordering constraint that is otherwise only a comment.
--
-- ⚠ BOUND, STATED HONESTLY: the trigger is DEFERRABLE INITIALLY DEFERRED, so a
--    misordering INSIDE ONE TRANSACTION is legal by design (that is what lets a door
--    write parent and child in either order). It therefore catches a seed misordering
--    only to the extent that `seed.sql` does not wrap both inserts in one explicit
--    transaction. Deferral is still the right choice — an IMMEDIATE trigger would
--    forbid legitimate atomic writes — but "the reset tests the ordering" is a claim
--    with that caveat attached, not an unconditional one.
--
-- ⚠ SCOPE: only ACTIVE hospital affiliations are constrained. An ENDED or VOIDED row is
--    a historical record and may outlive its org affiliation; constraining it would make
--    the past unrepresentable. D7's record-vs-contribution asymmetry, applied here.
-- ============================================================================

create or replace function app.assert_hospital_affiliation_has_org()
returns trigger
language plpgsql
set search_path to 'public', 'pg_catalog'
as $fn$
begin
  -- Only an ACTIVE row carries the obligation — see the SCOPE note above.
  if new.ended_on is not null or new.voided_at is not null then
    return null;
  end if;

  if not exists (
    select 1
      from public.organization_affiliations oa
     where oa.principal_id    = new.principal_id
       and oa.organization_id = new.organization_id
       and oa.ended_on  is null
       and oa.voided_at is null
  ) then
    -- A NAMED condition (`check_violation` -> 23514) matching the
    -- `assert_profile_tenant_has_org` precedent, NOT a dedicated `HC0R*` code. ADR 0156:
    -- trigger functions are excluded from the door-SQLSTATE domain by construction, and
    -- this raise is not a user-facing refusal — every reachable path refuses earlier with
    -- its own mapped code (`affiliate_person` ensures the parent; `end_org_affiliation`
    -- enumerates the blockers). A code minted here would be an arm no `toState` could
    -- ever exercise.
    raise exception
      'active hospital affiliation requires an active organization affiliation (ADR 0151 D4): principal % / organization %',
      new.principal_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  return null;
end;
$fn$;

comment on function app.assert_hospital_affiliation_has_org() is
  'AFF4 / ADR 0151 D4. Constraint-trigger backstop: an ACTIVE hospital affiliation '
  'requires an ACTIVE organization affiliation for the same principal in the same '
  'organization. Ended and voided rows are exempt (historical records outlive the '
  'affiliation that contained them). Unreachable through any door — the doors refuse '
  'earlier with their own mapped codes; this exists so a path that is not a door '
  'cannot create the state.';

-- Trigger functions are locked to the owner (the P3 ACL discipline,
-- `20261003002700`/`20261003002800`): a `returns trigger` function cannot be invoked
-- directly, but a NULL `proacl` grants PUBLIC, and "cannot be invoked" is a property of
-- the return type rather than of the grant.
revoke execute on function app.assert_hospital_affiliation_has_org() from public;

drop trigger if exists hospital_affiliation_has_org_trg on public.hospital_affiliations;

create constraint trigger hospital_affiliation_has_org_trg
  after insert or update on public.hospital_affiliations
  deferrable initially deferred
  for each row execute function app.assert_hospital_affiliation_has_org();

-- ── The stale sentence inside `app.affiliate_person_impl` ───────────────────
--
-- ⛔ A COMMENT IS AN ASSERTION, AND THIS ONE IS NOW FALSE. The body says the backstop
--    "lands AFTER B5's backfill"; the backstop lands here, after B7's SEED, and B5 is
--    not what unblocks it. A stale comment inside `prosrc` is the worst place for one:
--    nothing greps it, no gate reads it, and this repo has shipped a defect off a stale
--    comment before.
--
-- ⭐ RE-EMITTED FROM THE LIVE `pg_get_functiondef`, never from migration text — this
--    body is one that gets rewritten at runtime (ADR 0078 A28), so the file that created
--    it is not what is running. The replacement is ASSERTED to have landed: if the target
--    text is absent (already corrected, or reworded by a later migration), this RAISES
--    rather than silently doing nothing. A no-op "fix" that reports success is exactly
--    the mutation-that-did-not-apply shape.
do $patch$
declare
  v_old   text := 'The STRUCTURAL guarantee is the deferred constraint trigger, which lands'
               || E'\n  -- AFTER B5''s backfill — before that backfill it would reject legitimate writes against'
               || E'\n  -- pre-existing rows that have no parent yet.';
  v_new   text := 'The STRUCTURAL guarantee is the deferred constraint trigger'
               || E'\n  -- `hospital_affiliation_has_org_trg` (20261003004000). It could not land before the'
               || E'\n  -- SEED carried org-affiliation rows: B5''s backfill matches zero rows on a fresh'
               || E'\n  -- reset (migrations run before seed.sql), so B7-seed, not B5, is its precondition.';
  v_def   text;
  v_patched text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'affiliate_person_impl';

  if v_def is null then
    raise exception 'app.affiliate_person_impl not found — the comment correction has no subject';
  end if;

  v_patched := replace(v_def, v_old, v_new);

  if v_patched = v_def then
    raise exception
      'the stale B5 sentence was NOT found in app.affiliate_person_impl — refusing to report a no-op as a correction';
  end if;

  execute v_patched;
end;
$patch$;

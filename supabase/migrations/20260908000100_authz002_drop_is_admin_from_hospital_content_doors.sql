-- BUG-AUTHZ-002 — drop the forbidden `app.is_admin()` arm from the two hospital-tier
-- DEFINER doors that return COMMISSION CONTENT.
--
-- ADR 0078 A35's noun rule: platform_admin may administer tenancy, identity,
-- vocabulary and audit; it may NOT read commission content. `20260903000700` fixed the
-- five `dashboard_*` DEFINERs and left the identical OR-arm live in
-- `public.hospital_document_register` (controlled documents) and
-- `public.hospital_indicator_rollup` (indicator rollups). In both, `app.is_admin()` is
-- the first disjunct of the gate, so it IS the gate — not a comment about one.
--
-- RED BEFORE GREEN (the bug filed 2026-08-03 recorded a catalog-layer verification and
-- explicitly asked for this): a live probe as platform@test.local against Hospital
-- Central A, immediately before this migration, returned
--   hospital_document_register -> 3 rows
--   hospital_indicator_rollup  -> 2 rows
-- Both must read 0 after it. `284_hospital_content_door_noun_rule.sql` holds that.
--
-- ── The enumeration is BY PROPERTY, and it found one more door than the bug named ──
-- The bug's own lesson is that `20260903000700` enumerated by NAME PREFIX (`dashboard_*`)
-- where the real property is "DEFINER door returning commission content". Applying that
-- lesson here — `prosecdef` ∧ `proretset` ∧ authenticated-EXECUTE ∧ a hospital argument —
-- returns FOUR doors, not two:
--
--   hospital_document_register   arm INSIDE the hospital gate -> content -> FIXED HERE
--   hospital_indicator_rollup    arm INSIDE the hospital gate -> content -> FIXED HERE
--   hospital_readiness           no arm at all                -> already correct (0093 D6)
--   verify_audit_chain           arm, but NOT in the hospital gate — LEFT IN PLACE
--
-- ⚠ `verify_audit_chain` repays a second look, because a `prosrc` match makes it look
-- like a third offender. It is tiered (commission -> hospital -> org -> platform) and
-- its `app.is_admin()` is the PLATFORM-tier branch, taken only when all three arguments
-- are null. Its HOSPITAL branch already admits just hospital_admin/org_admin, so it is
-- noun-rule-correct today. Probed both ways rather than read: platform_admin calling it
-- at the hospital tier is refused 42501, and at the platform tier returns ok = t. The
-- global audit chain IS platform_admin's own noun; removing that arm would break the
-- one thing the noun rule grants.
--
-- ⚠ So the fix the bug prescribes — "a parity pgTAP asserting platform_admin gets zero
-- rows from *every* hospital-tier DEFINER" — is wrong as written. Taken literally it
-- fails on `verify_audit_chain`'s platform tier, or invites someone to "fix" a function
-- that is already right. The property is commission CONTENT, not hospital TIER.
--
-- ── Why this rewrites from the LIVE catalog instead of restating the bodies ──
-- Migration text is stale by design in this repo (bodies are rewritten at runtime), so
-- re-emitting a body from a file would silently revert whatever else has been applied to
-- these functions since. We take `pg_get_functiondef` as the source of truth and change
-- ONLY the gate. Every step is asserted: a `replace()` that matches nothing silently
-- no-ops and would leave the hole open while the migration reports success.

do $mig$
declare
  v_sig  text;
  v_def  text;
  v_new  text;
  v_hits int;
begin
  foreach v_sig in array array[
    'public.hospital_document_register(uuid,text,text,boolean)',
    'public.hospital_indicator_rollup(uuid)'
  ] loop
    v_def := pg_get_functiondef(v_sig::regprocedure);

    -- Pre-assert the shape we believe we are editing. Verified live: exactly one
    -- occurrence of the arm, and exactly one gate-shaped match, in each function.
    select count(*) into v_hits from regexp_matches(v_def, 'app\.is_admin\(\)\s*or\s+', 'g');
    if v_hits <> 1 then
      raise exception 'AUTHZ002: % has % gate matches, expected exactly 1 — refusing to guess',
        v_sig, v_hits;
    end if;

    -- Drop the disjunct, keeping the two legitimate authority arms and the indentation
    -- of the line that follows it.
    v_new := regexp_replace(v_def, 'app\.is_admin\(\)\s*or\s+', '');

    if v_new = v_def then
      raise exception 'AUTHZ002: replace was a no-op on % — the hole would stay open', v_sig;
    end if;
    if v_new ~ 'app\.is_admin\(\)' then
      raise exception 'AUTHZ002: % still carries app.is_admin() after the rewrite', v_sig;
    end if;

    execute v_new;
  end loop;

  -- A comment is an assertion, and this one is now false. `hospital_indicator_rollup`
  -- documents its gate as "platform admin, hospital_admin of the hospital, or org_admin
  -- of the hospital's org"; the platform-admin half no longer exists. Left uncorrected
  -- it would read as intent and invite the arm back.
  v_def := pg_get_functiondef('public.hospital_indicator_rollup(uuid)'::regprocedure);
  v_new := replace(
    v_def,
    'Q3 gate: platform admin, hospital_admin of the hospital, or org_admin of the',
    'Q3 gate: hospital_admin of the hospital, or org_admin of the'
  );
  if v_new = v_def then
    raise exception 'AUTHZ002: the stale Q3 gate comment was not found — re-read it live';
  end if;
  execute v_new;
end
$mig$;

-- Post-condition, asserted rather than assumed: neither content door carries the arm,
-- and the audit door still does.
do $verify$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('hospital_document_register', 'hospital_indicator_rollup')
    and p.prosrc ~ 'app\.is_admin\(\)';
  if v_bad is not null then
    raise exception 'AUTHZ002: the arm survived on %', v_bad;
  end if;

  -- The audit door's PLATFORM-tier arm must survive: a sweep that keyed on the
  -- `app.is_admin()` string alone would have stripped it, and the global audit chain is
  -- the one thing the noun rule positively grants platform_admin.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'verify_audit_chain'
      and p.prosrc ~ 'app\.is_admin\(\)'
  ) then
    raise exception 'AUTHZ002: verify_audit_chain LOST its platform-tier is_admin arm — '
      'audit is platform_admin''s own noun and that arm is correct';
  end if;
end
$verify$;

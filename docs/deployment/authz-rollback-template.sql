-- =====================================================================================
-- AUTHZ ROLLBACK — OUT-OF-CHAIN SQL TEMPLATE
--
-- ⛔ THIS FILE IS DELIBERATELY *NOT* UNDER supabase/migrations, AND MUST NOT BE MOVED THERE.
--    A file in the migration tree is part of the ordered, forward-only applied chain —
--    committed means applied — so a "retained rollback migration" either undoes the cutover
--    on the next apply, is not a repository artifact, or hides behind a future timestamp and
--    fires unexpectedly. ADR 0162 §1 (which retracts ADR 0155 D7's retain-a-migration clause).
--
-- HOW TO USE
--    1. Work through docs/deployment/authz-rollback-runbook.md §1 (pre-flight) FIRST and paste
--       its output into the rollback record. Do not skip it: a rollback that assumes a
--       signature drops a function and silently invalidates its dependent policies.
--    2. npx supabase migration new authz_rollback_<what>
--    3. Copy the section(s) below into that new migration, fill every <PLACEHOLDER>, DELETE
--       every section you are not using, and delete this header.
--    4. Apply through the normal command. Verify per runbook §5 — on the CATALOG, and read
--       every exit code directly.
--
-- ⭐ FOR THE AE4.9 D6 RE-KEY, THE SECTIONS BELOW ARE ALREADY FILLED IN: runbook § 6 is the
--    worked example — the four form policies, app.can_create_professional,
--    app.can_read_professional_profile, the ordering hazard between the last two, and the
--    manifest/pgTAP work a revert obliges. Start there, not here.
--
-- ⛔ NEVER `legacy OR new`. NEVER a caller-selectable evaluator. Runbook §3 — a disjunction of
--    the two evaluators is a permanent over-grant that passes every "did it work" check,
--    because the legacy side answers.
-- ⛔ NEVER delete catalog data. authz.roles / permissions / role_permissions and the assignment
--    projection stay exactly as they are. The catalog going quiet IS the rollback.
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- SECTION A — guard: fail loudly if the world is not what the pre-flight described.
-- Keep this. It is the difference between a rollback and a second incident.
-- -------------------------------------------------------------------------------------
do $$
begin
  -- A1. The object we are about to revert still exists with the signature we recorded.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '<SCHEMA>' and p.proname = '<FUNCTION>'
       and pg_get_function_identity_arguments(p.oid) = '<RECORDED ARG LIST>'
  ) then
    raise exception
      'ROLLBACK ABORTED: %.% with args (%) is not present as recorded at pre-flight. '
      'Re-run the runbook §1 queries; the tree moved under this rollback.',
      '<SCHEMA>', '<FUNCTION>', '<RECORDED ARG LIST>';
  end if;

  -- A2. The DEFINER flag is what we recorded. A DEFINER's gate REPLACES RLS, so a silent
  --     flip here changes what the rollback means.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '<SCHEMA>' and p.proname = '<FUNCTION>'
       and p.prosecdef is distinct from <TRUE|FALSE>
  ) then
    raise exception 'ROLLBACK ABORTED: %.% prosecdef differs from pre-flight.',
      '<SCHEMA>', '<FUNCTION>';
  end if;

  -- A3. THE POLICY GUARD. Keep this whenever Section C is in play. A1/A2 guard the FUNCTION,
  --     but a §2b rollback's subject is a POLICY, and `alter policy` succeeds silently against
  --     a policy that someone already reverted, or that never carried the cutover at all.
  --     ⛔ Assert BOTH halves and assert the CARDINALITY. Reverting three of four sites reads
  --     as complete and leaves the fourth enforcing the new authority alone.
  --     ⛔ Anchor the needle (`\yname\y`, or name || '('). A bare `like '%name%'` matches
  --     `name_for(` as a PREFIX and reports the old name present when only the variant is —
  --     which is exactly the pair an AE4.9-shaped rollback moves.
  if (select count(*) from pg_policies
       where schemaname = '<SCHEMA>' and tablename = any (array[<TABLE LIST>])
         and policyname = any (array[<POLICY LIST>])
         and coalesce(qual,'')       ~ '\y<POST-CUTOVER AUTHORIZER>\y'
         and coalesce(with_check,'') ~ '\y<POST-CUTOVER AUTHORIZER>\y')
     <> <RECORDED SITE COUNT> then
    raise exception
      'ROLLBACK ABORTED: the enforcement sites are not in the post-cutover shape recorded at '
      'pre-flight (expected % policies calling %s in BOTH halves). Someone moved them, or a '
      'previous rollback attempt half-applied. Re-run the runbook §1 queries.',
      <RECORDED SITE COUNT>, '<POST-CUTOVER AUTHORIZER>';
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- SECTION B — revert a RE-POINTED WRAPPER to the legacy adapter  (runbook §2a; AE4.6, AE5)
-- Delete this section if you are reverting an enforcement site instead.
-- -------------------------------------------------------------------------------------
-- ⚠ `language` IS A RECORDED VALUE, NOT A CONSTANT. These bodies are not all `sql`:
--   app.can_read_professional_profile is `plpgsql`. Copy what the pre-flight
--   pg_get_functiondef printed. A `create or replace` may change the language freely as long
--   as the signature holds, so getting it wrong fails loudly rather than silently — but only
--   if you actually reverted the BODY to match.
create or replace function <SCHEMA>.<WRAPPER>(<RECORDED ARG LIST>)
returns <RECORDED RETURN TYPE>
language <RECORDED LANGUAGE: sql | plpgsql>
stable
security definer
set search_path = <RECORDED SEARCH PATH>
as $fn$
  -- <THE PRE-CUTOVER PREDICATE, VERBATIM FROM THE PRE-FLIGHT CAPTURE.>
  -- ⛔ Not a paraphrase and not reconstructed from the migration file — migration text in
  --    this tree is stale by design (bodies are rewritten at runtime via
  --    pg_get_functiondef + replace + execute). Paste what pg_get_functiondef returned.
$fn$;

-- Restore the recorded ACLs explicitly. Do not assume they survived.
-- ⚠ A REVOKE you are not entitled to make is a SILENT NO-OP — verify by effective privilege
--   (has_function_privilege), never by reading proacl text (a NULL proacl includes PUBLIC).
--
-- ⛔⛔ THE RECORDED GRANTEE SET CAN BE **EMPTY**, AND THEN THESE TWO LINES ARE DELETED, NOT
--     FILLED IN. Measured on this tree: app.can_create_professional is EXECUTE-granted to
--     NOBODY — not anon, not authenticated, not service_role. Only the owner runs it, and the
--     three RPC doors reach it because THEY are SECURITY DEFINER. Typing a `grant execute …
--     to authenticated` here is a WIDENING WEARING THE COSTUME OF A RESTORE, and it will pass
--     every "did the rollback work" check because a wider gate answers everything the narrow
--     one did. `create or replace` preserves the existing ACL; when the record says "no
--     grant", the correct edit is no statement at all.
--     ⚠ Its sibling app.can_read_professional_profile is the opposite — `authenticated` +
--     `service_role` EXECUTE is REQUIRED, because it is embedded in two RLS policies and a
--     policy expression evaluates as the querying role. Two sibling gates, opposite postures;
--     do not transplant one's note onto the other. Runbook §6.1 has both, measured.
revoke all on function <SCHEMA>.<WRAPPER>(<RECORDED ARG LIST>) from public;
grant execute on function <SCHEMA>.<WRAPPER>(<RECORDED ARG LIST>) to <RECORDED GRANTEES>;

-- -------------------------------------------------------------------------------------
-- SECTION C — revert a RE-KEYED ENFORCEMENT SITE to the role wrapper  (runbook §2b; AE4.9 D6)
-- Delete this section if you are reverting a wrapper instead.
--
-- ⛔ RESTORE THE DISJUNCT, NOT THE WHOLE BODY. A re-keyed policy typically reads
--      <permission authorizer>(...) OR <other authority>(...)
--    where only the FIRST disjunct was re-keyed. The second (e.g. a tenancy-admin arm) was
--    never part of the cutover and must survive verbatim — replacing the whole body is how a
--    rollback becomes its own outage.
-- ⛔ A `FOR ALL` POLICY HAS TWO HALVES. USING gates WHICH ROWS may be touched; WITH CHECK
--    gates THE NEW ROW. Restore and verify BOTH. A gate present in only one half is a live
--    hole that reads as a completed rollback.
-- ⛔ ARM ORDER IS PART OF "VERBATIM", AND IT IS NOT UNIFORM ACROSS A POLICY FAMILY. Two
--    disjuncts in either order are the same decision (Postgres guarantees no OR evaluation
--    order) but NOT the same TEXT — and pgTAP `387` C1 pins an md5 over the unwrapped
--    qual/with_check of 99 hot-table policies. Measured on the AE4.9 D6 family:
--    `form_versions_staff_admin_write` listed the TENANCY arm FIRST while its two siblings
--    listed it second. Getting that wrong moves the md5 exactly like a real regression.
--    ⭐ The flip side is a gift: get it right and C1 returns to its recorded pre-cutover
--    constant, which is a 128-bit statement that you moved what you claimed and nothing else.
--    Runbook §6.2 + §6.7 step 4.
-- -------------------------------------------------------------------------------------
alter policy <POLICY NAME> on <SCHEMA>.<TABLE>
  using       ( <PRE-CUTOVER USING EXPRESSION, VERBATIM — ARM ORDER INCLUDED> )
  with check  ( <PRE-CUTOVER WITH CHECK EXPRESSION, VERBATIM — ARM ORDER INCLUDED> );

-- Repeat for EVERY site the cutover touched. Enumerate them from the pre-flight dependent-
-- policy query, never from memory: a rollback that reverts three of four sites reads as
-- complete and leaves the fourth enforcing the new authority alone.

-- The now-unused domain authorizer is left IN PLACE, inert. Dropping it invalidates dependent
-- policies for no benefit, and leaving it makes a re-forward a one-line policy change.
-- ⛔ AND DROPPING IT DESTROYS THE ROLLBACK'S OWN EVIDENCE. pgTAP `409` §6.2-6.4 call
--    has_function_privilege(...) and `grant execute ... to anon` against the AE4.9 D6
--    authorizer by name; with the function gone those raise `undefined_function`, which
--    ABORTS THE WHOLE FILE. You then get "file aborted" instead of the twelve expected reds —
--    nothing measured, and the difference is invisible in a summary line.

-- -------------------------------------------------------------------------------------
-- SECTION D — post-conditions, inside the same transaction. If one fails, nothing applies.
-- -------------------------------------------------------------------------------------
do $$
declare
  v_offenders text;
begin
  -- D1. No site may end up asking BOTH authorities. Runbook §3.
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ')
    into v_offenders
    from pg_policies
   where coalesce(qual,'') || coalesce(with_check,'') like '%<NEW PERMISSION AUTHORIZER>%'
     and coalesce(qual,'') || coalesce(with_check,'') like '%<LEGACY PREDICATE>%';
  if v_offenders is not null then
    raise exception 'ROLLBACK ABORTED: legacy OR new left in place on: %', v_offenders;
  end if;

  -- D1b. ⛔⛔ D1 ALONE IS BLIND TO THE SHAPE AE4.9 D6 SHIPPED, AND THIS IS NOT HYPOTHETICAL.
  --      D1 scans `pg_policies`. Since D6 the surviving non-permission arms live INSIDE
  --      SECURITY DEFINER bodies, where a policy-text scan cannot follow them (ADR 0178 §2
  --      accepted exactly this cost; ADR 0079 door blindness). A `legacy OR new` reintroduced
  --      inside an authorizer passes D1 without a murmur.
  --
  --      ⚠ AND A NAIVE prosrc SCAN OVER-FIRES. `app.can_edit_commission_forms` legitimately
  --      reads `has_permission(...) OR is_tenancy_admin_of_for(...)`: two arms over DIFFERENT
  --      populations, which §3 permits. The prohibition is the SAME arm asked BOTH ways. So
  --      name the one legacy predicate the re-key REPLACED at each site — not "any legacy
  --      predicate" — and require it absent from the body that carries the code.
  --      For AE4.9 D6 the pairs are (runbook §6):
  --        app.can_edit_commission_forms      / is_staff_admin_of
  --        app.can_create_professional        / is_org_commission_staff_admin
  --        app.can_read_professional_profile  / can_create_professional
  select string_agg(n.nspname || '.' || p.proname, ', ')
    into v_offenders
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app','public','authz')
     and p.proname = '<AUTHORIZER CARRYING THE CODE>'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '<PERMISSION CODE>'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\y<THE REPLACED LEGACY PREDICATE>\y';
  if v_offenders is not null then
    raise exception
      'ROLLBACK ABORTED: legacy OR new for the SAME arm, inside a function body where D1 '
      'cannot see it: %', v_offenders;
  end if;
  -- ⛔ Comment-strip before matching. A `--` comment naming the old predicate makes a raw
  --    prosrc regex fire on text that executes nothing.

  -- D2. Catalog data is intact. The rollback silences the catalog; it never empties it.
  if (select count(*) from authz.role_permissions) = 0
     or (select count(*) from authz.permissions) = 0 then
    raise exception 'ROLLBACK ABORTED: catalog data was deleted. This template never deletes it.';
  end if;
end $$;

commit;

-- -------------------------------------------------------------------------------------
-- SECTION E — THE HALF THAT IS NOT SQL. Do it in the SAME change, not afterwards.
--
-- ⛔ A REVERTED SITE LEAVES THE ENFORCEMENT MANIFEST CLAIMING A STATE THE CATALOG NO LONGER
--    HAS. supabase/tests/vectors/authz-enforcement-manifest.json is a committed vector file
--    and pgTAP `410` pins it to the catalog IN BOTH DIRECTIONS, so a revert catches it in a
--    scissor: leave the row `re-keyed` and §4.4/§3.5/§3.7 red; flip it to `pending-rekey` and
--    §4.5/§4.6/§3.6 red. THERE IS NO EDIT THAT GREENS BOTH HALVES while the SQL is reverted.
--    ⛔ So do not pick the edit that makes the suite quietest. Flip the row honestly, then
--    RE-DERIVE the pinned literals and record that you did. §4.5's own message: "a red here is
--    the increment being recorded, never a number to restore."
--
--    Per reverted code: status -> "pending-rekey" · domainAuthorizer -> null ·
--    residualLegacyAuthority -> [] (an ARRAY; null fails lint) · add a pendingRekey block with
--    a non-empty layer1Gate / owner / expiry · and if you also blank enforcementSites, add a
--    full callGraphBoundary (reason / reviewedBy / reviewedOn — an ATTRIBUTED sign-off; the
--    gate will not let you drop the sites anonymously). Re-run the generator so
--    authz-matrix-coverage.json re-renders (it embeds statusCounts + migrationHead).
--
-- ⛔⛔ AND `npm run lint`'s lint:authz-vectors NEVER TOUCHES A DATABASE — it is deliberately
--    Docker-free. Greening it after a rollback is POSSIBLE AND PROVES NOTHING; it validates
--    the manifest's internal shape, not that the SQL matches. Cite `410` §4.4/§4.5/§4.6 and
--    `409` §1.1/§1.3 in the record, never lint.
--
-- ⛔ EXPECT REDS AND DO NOT EDIT THEM AWAY. A red suite after a rollback means the assertions
--    were tracking reality; a fully GREEN one means they were pinned to something the rollback
--    did not touch. The gate-line assertions assert the very thing the rollback undoes —
--    remove or skip that suite WITH the revert, with the reason recorded. ⛔ Never re-code an
--    expectation to green: that greens the test and deletes its subject.
--    ⚠ Watch for reds in suites whose NAMES give no hint of the subject — for AE4.9 D6 those
--    are `404` §1.6 (a chain probe grepping for the permission-code literal) and `387` C1
--    (a single 32-hex md5 whose "fix" looks like a one-token edit; its own comment forbids
--    re-capturing it by pasting a fresh measurement). Runbook §6.8 has the full inventory,
--    including the suites that stay GREEN and must not be read as validating the rollback.
-- -------------------------------------------------------------------------------------

-- =====================================================================================
-- AFTER APPLYING — runbook §5. Not optional, and not satisfiable from console output:
--   1. npx supabase db reset --local && npm run test:db   — and read runbook §6.8 FIRST, so
--      you know which reds are the correct outcome before you start "fixing" them
--   2. re-run the runbook §1 pre-flight and DIFF against the recorded pre-cutover output,
--      object for object, including prosecdef and EFFECTIVE ACLs
--   3. for a Section C revert, exercise the PRODUCTION DOOR on a WRITE — a permissive
--      sibling *_select policy keeps a SELECT-based check green with the write policy
--      fully revoked. ⭐ And make it a DISCRIMINATION test: delete the grant in a rolled-back
--      transaction and confirm the door NO LONGER flips. Every structural check can pass
--      while the decision did not move; that probe is the one that cannot.
--   4. record BOTH compatibility directions (app→db and db→app) in the rollback record
-- ⛔ Read every exit code DIRECTLY. A pipe, a `| tail`, or a trailing echo erases it — this
--    program has already recorded two runs reported as exit 0 that were exit 1.
-- =====================================================================================

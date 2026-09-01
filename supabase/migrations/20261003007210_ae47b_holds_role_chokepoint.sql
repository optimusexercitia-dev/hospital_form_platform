-- AE4.7b — THE CHOKEPOINT. `authz.holds_role`, both wrappers collapsed onto it, and the
-- PUBLIC EXECUTE grant on `app.is_staff_admin_of` revoked.
-- Plan: docs/plans/authz-evolution.md § AE4.7 · ADR 0155 D7 · QA 2026-09-01 findings F6/F9.
--
-- door-sweep-targets: authz.holds_role(uuid, text, text, uuid), app.is_staff_admin_of(uuid), app.is_staff_admin_of_for(uuid, uuid)
--
-- ============================================================================
-- ⭐⭐ WHY THIS EXISTS: THE CUTOVER MOVED ENFORCEMENT OFF A CHOKEPOINT AND NAMED NO SUCCESSOR.
--
-- Before AE4.6, `app.has_role` was the single place the active-role ("hat") condition lived,
-- and pgTAP 315/319 mutated exactly that one body to prove their keystones could fail. AE4.6
-- re-pointed the staff_admin wrappers at `authz.assignment_facts` — which carries three of
-- has_role's four gates and NOT the fourth — so each wrapper HAND-COPIED the hat conjunct into
-- its own body. Consequences, all measured rather than predicted:
--
--   * 315 test 14 and 319 test 5 went RED and STAYED red on the branch: their mutation of
--     `app.has_role` no longer reaches the wrappers. They are ORPHANED, not wrong.
--     ⚠ They failed LOUDLY. Had the mutation left their assertions satisfied they would have
--     gone silently vacuous — a hat control no longer testing the hat, green forever. The red
--     is the only reason this migration exists at all.
--   * The hat conjunct now exists in FOUR hand-written phrasings (both wrappers,
--     `authz.has_direct_permission`, `authz.explain_direct_permission`). pgTAP 405 § 4.4 could
--     only COUNT the copies; nothing could assert they agreed.
--   * AE5 substitutes eleven more roles. Eleven more cutovers × four phrasings is the shape
--     that produces a divergence nobody notices.
--
-- ⭐ ONE helper. Both wrappers become one-liners, the mutation twins get ONE site forever, and
-- each AE5 cutover becomes a two-line body swap instead of a re-derivation of the gate.
--
-- ============================================================================
-- ⭐⭐ THE ASYMMETRY IS EXPRESSED ONCE, AND IT FALLS OUT — it is not re-implemented per wrapper.
--
-- Matrix § 6A: the active-role filter applies to SELF-checks and NOT to third-party checks.
-- Uniform-apply breaks the 27 `_for` call sites; never-apply drops the hat gate for the ~151
-- self-check sites. NEITHER uniform choice is correct, which is why AE4.6 wrote the disjunct
-- into each wrapper by hand and why 405 § 3.3 exists to stop someone "fixing" it.
--
-- `holds_role` derives it INTERNALLY from `p_principal is distinct from auth.uid()` — never a
-- caller-supplied flag (a parameter is a thing callers get wrong, and getting it wrong is
-- undetectable from the answer). So:
--   * `is_staff_admin_of(cid)`            passes auth.uid()   -> self      -> hat APPLIES
--   * `is_staff_admin_of_for(cid, uid)`   uid  = auth.uid()   -> self      -> hat APPLIES
--   * `is_staff_admin_of_for(cid, other)` uid <> auth.uid()   -> 3rd party -> hat SHORT-CIRCUITS
-- All three polarities are asserted behaviourally in 405 §§ 2.2 / 3.2 / 3.3, which were written
-- against the hand-copied bodies and pass UNCHANGED against this one. That is the point: the
-- collapse is behaviour-preserving, and the suite that proves it predates the collapse.
--
-- ============================================================================
-- ⭐⭐ `authz.roles.state` STOPS BEING INERT. THIS IS A REAL BEHAVIOUR CHANGE, NOT A TIDY-UP.
--
-- Until now nothing read `authz.roles.state`: flipping a row to `authoritative` changed
-- NOTHING, and the AE4.6 "atomic cutover" was atomic only because the wrapper bodies happened
-- to move in the same migration. `holds_role` requires `state = 'authoritative'`, so:
--   * a wrapper for a role that is still `legacy` answers FALSE for everyone — it fails CLOSED
--     and loudly, instead of quietly granting through a half-finished substitution;
--   * the AE5 flip becomes the atomic cutover the design has been claiming it is.
--
-- ⛔ CONSEQUENCE, STATED SO NOBODY RE-DERIVES IT AS A BUG: `holds_role` is NOT a general role
-- predicate. Today it answers FALSE for all ELEVEN legacy roles even when the membership row
-- is present, live and correctly scoped. `app.has_role` remains the predicate for those, and
-- remains fully live — this migration does not touch it. Both polarities of this bound are
-- asserted in pgTAP 405 § 6: staff_admin (authoritative) -> TRUE, org_admin (legacy, real
-- membership, right hat) -> FALSE. Without the second, "requires authoritative" is satisfied by
-- a function that returns false for the wrong reason.
--
-- ============================================================================
-- ⚠ SCOPE COMPARISON IS `=`, DELIBERATELY, AND IT FAILS CLOSED ON NULL.
--
-- `af.scope_id = p_scope_id` is NULL — not false — when either side is NULL, so an `exists`
-- over it returns FALSE. That is has_role's own shape and AE4.6's wrapper shape, preserved.
-- ⛔ Do not "improve" it to `is not distinct from`: that would make `holds_role(uid,
-- 'platform_admin', 'none', null)` resolve TRUE off the adapter's platform arm — a widening
-- into the platform tier dressed as a null-safety fix. The hat conjunct DOES use
-- `is not distinct from`, and for the opposite reason (BUG-ACT-NULLHAT-1): a NULL hat must
-- compare FALSE explicitly rather than by accident. Two null comparisons, two different
-- correct answers, on adjacent lines. 405 § 4.5 pins the second one.
-- ============================================================================

create function authz.holds_role(
  p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from authz.assignment_facts(p_principal) af
      join authz.roles r
        on r.code = af.role_code
     where af.role_code  = p_role_code
       and af.scope_kind = p_scope_kind
       and af.scope_id   = p_scope_id
       and r.state       = 'authoritative'
       and (
         p_principal is distinct from (select auth.uid())
         or af.role_code is not distinct from app.active_role()
       )
  );
$$;

comment on function authz.holds_role(uuid, text, text, uuid) is
  'THE role chokepoint. Carries all four of app.has_role''s gates — seat expiry, scope, '
  'principal state (the first three via authz.assignment_facts) and the active-role hat — plus '
  'a fifth the legacy predicate never had: the role must be authz.roles.state = ''authoritative''. '
  '⛔ NOT a general role predicate: it answers FALSE for every LEGACY role, by design, so a '
  'premature AE5 delegation fails closed and loudly rather than granting through a half-finished '
  'substitution. app.has_role remains the predicate for the eleven legacy roles. ⚠ The self / '
  'third-party asymmetry (matrix § 6A) is derived INTERNALLY from p_principal vs auth.uid(), '
  'never from a caller-supplied flag.';

-- ============================================================================
-- THE COLLAPSE. Both wrappers become one-liners over the chokepoint.
--
-- ⚠ `create or replace` is NOT drop+create: name, signature, `prosecdef`, volatility,
-- `search_path` and ACLs all persist — which is exactly why the revoke below is a SEPARATE,
-- SNAPSHOTTED step rather than something this replace could be assumed to have done.
--
-- ⛔ NEVER `legacy OR new`, and no caller-selectable evaluator (AE4.6's rule, unchanged).
-- pgTAP 405 § 4.2 greps the comment-stripped `prosrc` of both wrappers for `has_role`'s
-- absence; § 4.3 is its positive control and now names `holds_role` as the delegate.
--
-- ⛔ WHAT MOVES IN 405 AND WHY IT IS THE COLLAPSE WORKING, NOT A REGRESSION: § 4.3 and § 4.4
-- previously asserted that BOTH wrapper bodies contain `assignment_facts` and `active_role`
-- (count 2 each) — i.e. they counted the hand-copied duplication. § 4.4's own comment named
-- this migration as the thing that would retire it. After the collapse those counts are ZERO in
-- the wrappers and ONE in `holds_role`, so the assertions are re-pointed rather than deleted:
-- an assertion removed leaves no witness that the property moved.
-- ============================================================================

create or replace function app.is_staff_admin_of(p_commission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select authz.holds_role((select auth.uid()), 'staff_admin', 'commission', p_commission_id);
$f$;

create or replace function app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select authz.holds_role(p_user_id, 'staff_admin', 'commission', p_commission_id);
$f$;

-- ============================================================================
-- FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE — the revoke, snapshotted.
--
-- `app.is_staff_admin_of` carries `=X/postgres`: the EMPTY grantee, which IS a PUBLIC grant, so
-- `anon` holds EXECUTE on it. Its `_for` sibling does not. AE1.2's global revoke governs only
-- NEWLY-CREATED functions, and `create or replace` preserved this one through every rewrite
-- since — including the two immediately above.
--
-- Not a live hole: `anon` resolves `auth.uid()` to NULL, the adapter projects nothing, and the
-- wrapper answers false. It is least-privilege debt and door-sweep domain NOISE, and AE4.7b is
-- where the QA plan put it.
--
-- ⛔ A REVOKE YOU ARE NOT ENTITLED TO MAKE IS A SILENT NO-OP. `revoke` does not error when the
-- grant is not yours to remove — it removes nothing and reports success. So the effect is
-- MEASURED on both sides, by EFFECTIVE PRIVILEGE (`has_function_privilege`), never by reading
-- `proacl` text: a NULL `proacl` includes PUBLIC, which is the shape that has fooled this
-- repo four times.
--
-- ⚠ ASSERTED AGAINST EACH FUNCTION'S OWN BEFORE/AFTER VALUE, never by comparing the two
-- siblings to each other — they are not symmetric, and a sibling comparison passes while a
-- PUBLIC grant silently vanishes or spreads (§ Dead ends already learned this one).
-- ============================================================================

do $revoke$
declare
  v_before_anon_self  boolean;
  v_before_anon_for   boolean;
  v_before_auth_self  boolean;
  v_before_auth_for   boolean;
  v_after_anon_self   boolean;
  v_after_anon_for    boolean;
  v_after_auth_self   boolean;
  v_after_auth_for    boolean;
begin
  select has_function_privilege('anon',          'app.is_staff_admin_of(uuid)'::regprocedure, 'EXECUTE'),
         has_function_privilege('anon',          'app.is_staff_admin_of_for(uuid, uuid)'::regprocedure, 'EXECUTE'),
         has_function_privilege('authenticated', 'app.is_staff_admin_of(uuid)'::regprocedure, 'EXECUTE'),
         has_function_privilege('authenticated', 'app.is_staff_admin_of_for(uuid, uuid)'::regprocedure, 'EXECUTE')
    into v_before_anon_self, v_before_anon_for, v_before_auth_self, v_before_auth_for;

  -- PRE-CONDITION, not decoration: if the grant is already gone the revoke below is a no-op
  -- and this migration would report success while proving nothing about its own subject.
  if not v_before_anon_self then
    raise exception 'AE4.7b: app.is_staff_admin_of does NOT carry the PUBLIC EXECUTE grant this migration exists to revoke (anon EXECUTE was already false). Re-derive FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE before removing this block.'
      using errcode = 'check_violation';
  end if;
  if v_before_anon_for then
    raise exception 'AE4.7b: app.is_staff_admin_of_for unexpectedly carries a PUBLIC EXECUTE grant. The asymmetry this migration was written against no longer holds; re-measure before proceeding.'
      using errcode = 'check_violation';
  end if;

  revoke execute on function app.is_staff_admin_of(uuid) from public;

  select has_function_privilege('anon',          'app.is_staff_admin_of(uuid)'::regprocedure, 'EXECUTE'),
         has_function_privilege('anon',          'app.is_staff_admin_of_for(uuid, uuid)'::regprocedure, 'EXECUTE'),
         has_function_privilege('authenticated', 'app.is_staff_admin_of(uuid)'::regprocedure, 'EXECUTE'),
         has_function_privilege('authenticated', 'app.is_staff_admin_of_for(uuid, uuid)'::regprocedure, 'EXECUTE')
    into v_after_anon_self, v_after_anon_for, v_after_auth_self, v_after_auth_for;

  if v_after_anon_self then
    raise exception 'AE4.7b: the revoke was a NO-OP — anon still holds EXECUTE on app.is_staff_admin_of.'
      using errcode = 'check_violation';
  end if;

  -- ⛔ THE OVER-REVOKE TWIN. A revoke that also stripped `authenticated` would satisfy the
  -- assertion above while taking every policy on this predicate offline — an outage that reads
  -- as a successful least-privilege tightening.
  if not (v_after_auth_self and v_after_auth_for) then
    raise exception 'AE4.7b: the revoke OVER-REACHED — authenticated lost EXECUTE (self=%, for=%). Both wrappers are called from live RLS policies.',
      v_after_auth_self, v_after_auth_for using errcode = 'check_violation';
  end if;

  -- The sibling must be UNMOVED in both directions: this migration's claim is that it changed
  -- exactly one grant on exactly one function.
  if v_after_anon_for <> v_before_anon_for then
    raise exception 'AE4.7b: app.is_staff_admin_of_for''s anon EXECUTE moved (% -> %) — the revoke was not scoped to its named subject.',
      v_before_anon_for, v_after_anon_for using errcode = 'check_violation';
  end if;
end $revoke$;

-- ============================================================================
-- POST-CONDITIONS on the collapse itself, asserted from the CATALOG at apply time.
-- ⚠ Comments are stripped before every match (the house idiom): a raw `prosrc` regex counts
-- `--` text as code, so a body that merely MENTIONS has_role in a comment would read as an
-- un-cut-over wrapper.
-- ============================================================================

do $post$
declare
  v_delegating int;
  v_legacy     int;
  v_hat        int;
begin
  select count(*) into v_delegating
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mholds_role\M';

  select count(*) into v_legacy
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mhas_role\M';

  select count(*) into v_hat
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.proname = 'holds_role'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'active_role';

  if v_delegating <> 2 then
    raise exception 'AE4.7b: expected BOTH wrappers to delegate to authz.holds_role, found %.', v_delegating
      using errcode = 'check_violation';
  end if;
  if v_legacy <> 0 then
    raise exception 'AE4.7b: % wrapper(s) still call app.has_role — `legacy OR new` is ruled out.', v_legacy
      using errcode = 'check_violation';
  end if;
  if v_hat <> 1 then
    raise exception 'AE4.7b: the active-role conjunct is ABSENT from authz.holds_role — the collapse removed the gate instead of relocating it.'
      using errcode = 'check_violation';
  end if;

  -- ⛔ `\mhas_role\M` matches `holds_role`? It does NOT — `\m` is a word BOUNDARY and
  -- `holds_role` has none before `has_role` (it does not contain the substring at all). This
  -- assertion is the instrument control for the two above: if the regex ever stopped
  -- discriminating, v_legacy would be 2 and this migration would fail rather than pass quietly.
  if not ('holds_role' !~ '\mhas_role\M' and 'app.has_role(x)' ~ '\mhas_role\M') then
    raise exception 'AE4.7b: the prosrc discriminator does not discriminate — every grep above is unreliable.'
      using errcode = 'check_violation';
  end if;
end $post$;

-- BUG-PROF-INACTIVE-001 — app.can_manage_professional bypasses the is_active gate.
-- PA-F8 disposition (a): fix in a preceding, independently gated increment.
-- Found by AE4.5's differential oracle (pgTAP 403 section 4.1) on its first real run.
--
-- door-sweep-targets: app.can_manage_professional(uuid, uuid)
--
-- ============================================================================
-- THE DEFECT. app.is_staff_admin_of_for is `app.is_active(uid) AND app.has_role(...)`.
-- app.has_role does NOT itself check is_active. app.can_manage_professional calls
-- app.has_role DIRECTLY, so the gate is simply absent. Measured in a rolled-back
-- transaction on the same principal:
--       ACTIVE       is_staff_admin_of_for=true   can_manage_professional=true
--       DEACTIVATED  is_staff_admin_of_for=false  can_manage_professional=TRUE   <- defect
--       SUSPENDED    is_staff_admin_of_for=false  can_manage_professional=TRUE   <- defect
--
-- BLAST RADIUS: the 13 doors gating on it - create/update/redact_professional_profile
-- (CPF, licence number, specialty), set_professional_link_state, the ethics and
-- case-assignment vocabularies, create_external_participant - and 13 of 13 hold
-- `authenticated` EXECUTE. The app-layer sign-out is NOT a defence: JWTs are bearer
-- tokens and deactivation does not revoke them, which is why Architecture Rule 1 puts
-- the boundary in the database. The window is the JWT lifetime after deactivation.
--
-- PREDATES AE4 AND IS NOT CAUSED BY IT. AE4.5 is what made it visible: the resolver
-- answers correctly, and the oracle's SECOND assertion - is(catalog, approved matrix) -
-- is what made the disagreement actionable instead of authoritative (PA-F8). With
-- is(legacy, catalog) alone the cheapest green would have been to declare legacy the
-- oracle and encode the defect as expected.
--
-- A SINGLETON, MEASURED NOT ASSUMED: sweeping BOTH app and public for functions calling
-- has_role without is_active returns exactly one name. app.is_org_admin_of gates
-- correctly. The fix does not generalise into a class.
--
-- SCOPE: THE staff_admin ARM ONLY, matching is_staff_admin_of_for's shape exactly.
-- Do NOT wrap the whole expression in is_active(p_uid), tidier though it looks:
-- app.is_org_admin_of already gates internally (redundant there), and over app.is_admin()
-- it would be ACTIVELY WRONG - see the follow-up below.
--
-- A SECOND, DISTINCT DEFECT LIVES IN THIS PREDICATE AND IS DELIBERATELY NOT FIXED HERE:
-- app.is_admin() takes NO argument and reads auth.uid(), so the first arm of a predicate
-- parameterised on a third party answers about the CALLER. 12 of 13 callers pass
-- auth.uid() (invisible there); exactly one passes a third party -
-- can_read_professional_profile. Filed as
-- FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM. Folding it in would make this security fix
-- unattributable, and it needs its own reachability analysis.
--
-- METHOD: pg_get_functiondef + replace + execute, with landing assertions in BOTH
-- directions - a no-op replace raises, AND the body is re-read from pg_proc after the
-- execute. A mutation that did not fully apply otherwise reports green.
-- Measured before writing: the target clause occurs EXACTLY ONCE in the raw body, and the
-- body contains no `is_active` at all, so the substitution is unambiguous.
-- ============================================================================

do $mig$
declare
  v_src text;
  v_new text;
  v_fn  constant text := 'app.can_manage_professional(uuid, uuid)';
  v_old constant text := 'and app.has_role(''commission'', c.id, ''staff_admin'', p_uid)';
  v_rep constant text := 'and app.is_active(p_uid)' || chr(10) ||
                         '        and app.has_role(''commission'', c.id, ''staff_admin'', p_uid)';
begin
  v_src := pg_get_functiondef(v_fn::regprocedure);

  if position('app.is_active(' in v_src) > 0 then
    raise exception 'BUG-PROF-INACTIVE-001: % already gates on is_active - investigate rather than re-run.', v_fn
      using errcode = 'check_violation';
  end if;
  if position(v_old in v_src) = 0 then
    raise exception 'BUG-PROF-INACTIVE-001: % does not contain the expected clause. The body changed since this migration was written.', v_fn
      using errcode = 'check_violation';
  end if;

  v_new := replace(v_src, v_old, v_rep);
  if v_new = v_src then
    raise exception 'BUG-PROF-INACTIVE-001: substitution was a NO-OP on %.', v_fn
      using errcode = 'check_violation';
  end if;

  execute v_new;

  -- Belt and braces: re-read from the catalog AFTER the execute.
  if position('app.is_active(p_uid)' in pg_get_functiondef(v_fn::regprocedure)) = 0 then
    raise exception 'BUG-PROF-INACTIVE-001: the is_active gate is ABSENT from % after execute - the mutation did not land.', v_fn
      using errcode = 'check_violation';
  end if;
end $mig$;

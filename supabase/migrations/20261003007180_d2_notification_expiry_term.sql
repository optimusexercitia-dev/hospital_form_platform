-- D2 — the seat-expiry term in four NOTIFICATION-TARGETING bodies.
-- Matrix § 1.2 (the finding) · § 10 D2 (disposition (a): fix in a preceding, independently
-- gated increment, before AE4.6). Bug entry: PROGRESS.md Bug Log.
--
-- ============================================================================
-- THE FINDING. `app.has_role` carries the seat-expiry gate for every AUTHORIZATION path:
-- `expires_at is null or m.expires_at > now()`. Five sites resolve `staff_admin` holders by
-- querying `public.memberships` DIRECTLY and inherit none of it. Four of those five are
-- notification targeting, and they are what this migration fixes:
--
--   app.compute_due_charter_notifications          (DEFINER)
--   app.compute_due_document_review_notifications  (DEFINER)
--   public.compute_due_notifications               (DEFINER)
--   public.save_section_answers                    (INVOKER)
--
-- REACHABLE CONSEQUENCE, measured verbatim rather than inferred from the function names: a
-- coordinator whose seat has LAPSED keeps receiving governance CONTENT, not a bare ping —
-- 'A comissao <name> esta com a cadencia de reunioes em atraso', and controlled-document
-- CODE + TITLE. No PHI: nothing here touches event_patient / referral_patient /
-- patient_identifiers, so this is not a Rule 12 matter.
--
-- WHY (a) AND NOT (b): a named compatibility exception needs an owner and an expiry, and
-- this is one term per body matching the canonical predicate — not a design choice anyone
-- would defend. It cannot be left, either: AE4.4b's adapter projects ONE assignment fact per
-- principal and implements the CORRECT semantics, so at cutover the catalog would be right
-- where four legacy sites are wrong, and AE4.5's differential would surface legacy defects
-- dressed as resolver errors.
--
-- ⛔ NOT IN SCOPE, STATED SO THE ANALYSIS IS NOT REPEATED — the next person to grep
-- `memberships` without `expires_at` will find these two and must not "fix" them:
--   * public.list_approver_candidates — reads `staff_admin` ONLY to derive the display label
--     'Coordenador(a)'. Eligibility is a separate hospital_users set and the door's own gate
--     is already app.is_staff_admin_of. Cosmetic, not authorization.
--   * app.revoke_role_impl — `p_role in ('staff','staff_admin')` is a SCOPE DISPATCH, not a
--     holder resolution. There is no set to narrow.
--
-- ⚠ THIS IS A NARROWING, so it fails CLOSED — the inverse risk profile to a widening. The
-- failure mode is OVER-narrowing: a term that also excludes LIVE seats, silently stopping
-- notifications that should arrive. pgTAP 402 pins BOTH polarities per body, and the
-- live-seat arm is the one that matters here.
--
-- ⚠ METHOD: pg_get_functiondef + replace + execute — the house pattern, and deliberately the
-- one that makes migration file text stale-by-design. Retyping four bodies this author did
-- not write is the larger risk. ⛔ BECAUSE it is that pattern, every substitution asserts it
-- LANDED, twice: a no-op replace raises, AND the term is re-read from pg_proc after execute.
-- A mutation that did not fully apply otherwise reports green.
--
-- Measured before writing: each of the four contains `role = 'staff_admin'` EXACTLY ONCE in
-- its raw body, has ONE public.memberships query, and carries no expires_at — so one
-- substitution string is unambiguous in all four. All four queries are unaliased, so the
-- bare column resolves to memberships.
-- ============================================================================

do $mig$
declare
  v_fn  text;
  v_src text;
  v_new text;
  v_targets constant text[] := array[
    'app.compute_due_charter_notifications()',
    'app.compute_due_document_review_notifications()',
    'public.compute_due_notifications()',
    'public.save_section_answers(uuid,uuid,jsonb,uuid[],jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'
  ];
  v_old constant text := 'role = ''staff_admin''';
  v_new_clause constant text :=
    'role = ''staff_admin'' and (expires_at is null or expires_at > now())';
begin
  foreach v_fn in array v_targets loop
    v_src := pg_get_functiondef(v_fn::regprocedure);

    if position(v_new_clause in v_src) > 0 then
      raise exception 'D2: % ALREADY carries the expiry term — this migration is not idempotent by design; investigate rather than re-run.', v_fn
        using errcode = 'check_violation';
    end if;

    if position(v_old in v_src) = 0 then
      raise exception 'D2: % does not contain the expected clause %. The body changed since this migration was written.', v_fn, v_old
        using errcode = 'check_violation';
    end if;

    v_new := replace(v_src, v_old, v_new_clause);

    if v_new = v_src then
      raise exception 'D2: substitution was a NO-OP on % — refusing to continue.', v_fn
        using errcode = 'check_violation';
    end if;

    execute v_new;
  end loop;

  -- Belt and braces: re-read every body from the catalog AFTER the executes.
  foreach v_fn in array v_targets loop
    if position(v_new_clause in pg_get_functiondef(v_fn::regprocedure)) = 0 then
      raise exception 'D2: the expiry term is ABSENT from % after execute — the mutation did not land.', v_fn
        using errcode = 'check_violation';
    end if;
  end loop;
end $mig$;

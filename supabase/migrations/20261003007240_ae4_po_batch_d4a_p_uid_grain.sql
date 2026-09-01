-- AE4 PO batch — D4(a): `p_uid`'s GRAIN, recorded where a caller will actually read it.
-- ADR 0175 D4(a). FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM: documented, NOT fixed.
--
-- ⛔ COMMENT-ONLY. No function body, signature, ACL or `prosecdef` bit is touched, so no
-- answer can move. That is the whole point: the ruling was to document the shape, and a
-- body rewrite would have been a different decision.
--
-- ⚠ THE RULING NAMED THE WRONG FUNCTION, AND THE MEASUREMENT IS WHY THIS MIGRATION EXISTS.
-- D4(a) said "document `p_uid` in can_manage_professional". Measured on the live catalog,
-- that comment ALREADY says it — AE4.7c wrote it ("p_uid is now a null guard only"). The
-- undocumented function is its CALLER, `can_create_professional`, which AE4.7c's own comment
-- says inherited "its one third-party call site". Its comment describes the population and
-- the naming, and says nothing about grain.
--
-- WHAT THE GRAIN ACTUALLY IS (read from prosrc, 2026-09-01):
--   can_create_professional(p_org, p_uid)
--     = can_manage_professional(p_org, p_uid)      -- arms read the CALLER; p_uid = null guard
--    or is_org_commission_staff_admin(p_org, p_uid) -- honours p_uid: is_active + staff_admin_of
--
-- ⭐ So the function is MIXED-GRAIN: one arm answers about the TARGET, the other about the
-- CALLER. A reader seeing `(p_org uuid, p_uid uuid)` reasonably assumes both answer about
-- p_uid, and would be half right — which is worse than being wrong, because the half that
-- holds is the half they will test.
--
-- ⚠ THE REACHABLE CONSEQUENCE, stated so nobody has to re-derive it:
-- app.can_read_professional_profile(p_profile_id, p_uid) arm 2 forwards a THIRD-PARTY p_uid
-- into this function. When the CALLER is an org_admin of that professional's organization,
-- the can_manage_professional arm returns true regardless of p_uid — so the door answers
-- "yes" to a question it was asked about someone else. Not a widening of who can read what
-- TODAY (every caller in the tree passes auth.uid(), and arm 1 already grants platform
-- admins), but it is a trap laid for the first caller that does otherwise.
--
-- ⛔ Do not "fix" this by making the arms honour p_uid without a ruling: that MOVES ANSWERS
-- for every existing caller, and ADR 0175 D4(a) explicitly chose documentation over an
-- authorization change.

do $$
begin
  if to_regprocedure('app.can_create_professional(uuid,uuid)') is null then
    raise exception
      'app.can_create_professional(uuid,uuid) not found — AE4.7c is expected to have created it. '
      'Refusing to comment a function that does not exist rather than silently no-opping.';
  end if;
end $$;

comment on function app.can_create_professional(p_org uuid, p_uid uuid) is
  'Gate for matrix row 43 (org.professionals.create): mint a professional profile, seat it in '
  'the participants registry, and complete its initial platform linkage. ⭐ This is the '
  'population app.can_manage_professional had BEFORE AE4.7c — org authority PLUS the commission '
  'staff_admin ascent — so every ADD door''s answer is unchanged by the split. ⛔ The name is '
  'narrower than the contents (create + seat + initial linkage); org.professionals.register '
  'would read truer, but org.professionals.create is the code the PO approved by name '
  '(matrix § 12.8.5, naming note). '
  '⚠ MIXED GRAIN — THE TWO ARMS DO NOT ANSWER THE SAME QUESTION (ADR 0175 D4a). '
  '`is_org_commission_staff_admin(p_org, p_uid)` honours p_uid (is_active + is_staff_admin_of_for '
  'on the target). `can_manage_professional(p_org, p_uid)` does NOT: both of ITS arms read the '
  'CALLER (is_admin(), is_org_admin_of(p_org)), so there p_uid is a null guard and nothing more. '
  'Consequence: app.can_read_professional_profile forwards a THIRD-PARTY p_uid here, and when the '
  'CALLER is an org_admin of that org this returns true whoever p_uid is. Harmless today — every '
  'caller in the tree passes auth.uid() — and a trap for the first one that does not. '
  '⛔ Do not make the arms honour p_uid without a ruling: it moves answers for every existing '
  'caller. FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM is DOCUMENTED here, not closed.';

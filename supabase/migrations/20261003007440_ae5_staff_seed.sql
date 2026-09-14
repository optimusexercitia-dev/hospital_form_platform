-- AE5 increment 1, T4 -- `staff`'s catalog seed. Mirrors 20261003007160 (staff_admin's grants)
-- in shape, and differs from it in exactly three ways, each ruled rather than chosen:
--
--   1. It also INSERTS PERMISSIONS. 20261003007160 only granted codes that already existed;
--      `staff`'s matrix derived 18 codes the catalog does not carry (matrix section 5.2,
--      PO-approved 2026-09-13). `authz.permissions` goes 43 -> 61.
--   2. It grants those 18 to `staff_admin` TOO. PO item 4: every `staff` site is gated by the
--      role-SET predicate `app.has_role_any('commission', ...)`, which `staff_admin` satisfies
--      exactly as readily, so all 18 are `staff_admin` behaviour TODAY. Not granting them would
--      silently under-grant the baseline role at T7's re-key. `staff_admin` goes 42 -> 60.
--   3. It FLIPS `authz.roles.staff` to `test_validation`. 20261003007160 deliberately left
--      staff_admin `legacy` so pgTAP 401 section 3.2's tripwire stayed armed. Here the flip is
--      REQUIRED and is not a cutover: `authz.candidate_has_permission` -- the differential's
--      subject -- admits `test_validation` (20261003007250:334-335) while `authz.has_permission`,
--      the RUNTIME evaluator, admits only `authoritative` (:283). So the differential can see
--      these grants and NO production door can. The cutover to `authoritative` is T6, behind the
--      R-1 wrapper ADR.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO:
--   * it re-keys NOTHING. Every one of the 18 rows is `pending-rekey` in the enforcement
--     manifest and every enforcement site still calls `app.is_member_of(_for)`. T7 owns the
--     re-key, and ADR 0211 owns the wrapper it re-keys onto.
--   * it creates no wrapper and touches no function body.
--   * it seeds no implication edges -- `authz.permission_implications` stays EMPTY, exactly as
--     after 20261003007160, so 401 sections 6.4 / 7.4 / 7.5 stay vacuous-by-construction and
--     keep taking their value from the constructed controls beside them.
--
-- EXPECTED REDS, RECORDED BEFORE THEY ARE OBSERVED (never re-pointed afterwards):
--   * 403 section 3.2b -- asserts the `test_validation` population; a SECOND role in that state
--     is what it was written to notice. It goes RED and the re-clause is PROPOSED, not applied,
--     in the unit record.
--   * 410 section 7.2 -- the approved-suite / subject-role fusion over the manifest; RED until
--     the manifest names `staff` (it does, as of the T3+T5 landing) AND the catalog carries the
--     61 codes (it does, as of this migration).
--   * any gate pinning `count(*) from authz.permissions` at 43 or `authz.role_permissions` at 42.
--     ⛔ Those are re-pinned only after being OBSERVED red, never pre-adjusted.

-- ── 1. THE 18 NEW PERMISSION CODES ───────────────────────────────────────────────────────────
-- resource_kind / risk_class / sensitivity_ceiling are matrix section 5.2's approved values,
-- transcribed. Every one resolves at `commission`: `staff` is commission-scoped by
-- `memberships_scope_shape`, and no approved row is org- or hospital-scoped (contrast AE4.3's
-- rows 30-33). ⛔ `sensitivity_ceiling` has NO DEFAULT by design -- `none` is the permissive
-- value, so a defaulted column would let a forgotten insert classify a PHI permission as
-- unclassified. Every row below states it.
insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind) values
  ('commission.forms.read',                'commission_content', 'read',  'none', 'commission'),
  ('commission.responses.create',          'commission_content', 'write', 'none', 'commission'),
  ('commission.roster.read',               'identity',           'read',  'none', 'commission'),
  ('commission.charter.read',              'commission_content', 'read',  'none', 'commission'),
  ('commission.meetings.read',             'commission_content', 'read',  'none', 'commission'),
  ('commission.meetings.minutes.sign',     'commission_content', 'write', 'none', 'commission'),
  ('commission.cases.deliberation.read',   'commission_content', 'read',  'none', 'commission'),
  ('commission.action_items.read',         'commission_content', 'read',  'none', 'commission'),
  ('commission.cases.vote',                'commission_content', 'write', 'none', 'commission'),
  ('commission.process_templates.read',    'commission_content', 'read',  'none', 'commission'),
  ('commission.indicators.read',           'commission_content', 'read',  'none', 'commission'),
  ('commission.accreditation.read',        'commission_content', 'read',  'none', 'commission'),
  ('commission.documents.read',            'commission_content', 'read',  'none', 'commission'),
  ('commission.safety_events.read',        'commission_content', 'read',  'none', 'commission'),
  ('commission.capa.read',                 'commission_content', 'read',  'none', 'commission'),
  ('commission.referrals.metadata.read',   'commission_content', 'read',  'none', 'commission'),
  ('commission.referrals.notes.author',    'commission_content', 'write', 'none', 'commission'),
  ('commission.cases.vocabulary.read',     'vocabulary',         'read',  'none', 'commission');

-- ── 2. `staff`'s 20 APPROVED GRANTS ──────────────────────────────────────────────────────────
-- The 18 above plus the TWO codes `staff` shares with `staff_admin` -- matrix rows 7 and 18,
-- which the derivation found `staff` holds IN FULL: the meeting-case SHELL is member-wide
-- (`meeting_cases_select` = `can_reach_meeting AND NOT is_case_respondent`), and reporting a
-- safety event is a MEMBER act, not a coordinator act (`notify_safety_event` raises on
-- `not app.is_member_of(p_reporting_commission_id)`).
-- ⛔ Rows 3 and 10 are NOT here and their absence is PO-approved (item 3): a member's own
-- response reads are ownership-keyed, and `commission.cases.read` is `read_case_content`, which
-- the S5 arm does not confer.
insert into authz.role_permissions (role_code, permission_code) values
  ('staff', 'commission.forms.read'),
  ('staff', 'commission.responses.create'),
  ('staff', 'commission.roster.read'),
  ('staff', 'commission.charter.read'),
  ('staff', 'commission.meetings.read'),
  ('staff', 'commission.meetings.cases.shell.read'),
  ('staff', 'commission.meetings.minutes.sign'),
  ('staff', 'commission.cases.deliberation.read'),
  ('staff', 'commission.action_items.read'),
  ('staff', 'commission.cases.vote'),
  ('staff', 'commission.process_templates.read'),
  ('staff', 'commission.indicators.read'),
  ('staff', 'commission.accreditation.read'),
  ('staff', 'commission.documents.read'),
  ('staff', 'commission.safety_events.read'),
  ('staff', 'commission.safety_events.report'),
  ('staff', 'commission.capa.read'),
  ('staff', 'commission.referrals.metadata.read'),
  ('staff', 'commission.referrals.notes.author'),
  ('staff', 'commission.cases.vocabulary.read');

-- ── 3. THE SAME 18 TO `staff_admin` (PO item 4) ──────────────────────────────────────────────
-- ⛔ NOT a widening. `app.has_role_any` already admits `staff_admin` at every one of these
-- sites, so the grant confers nothing it cannot do today; withholding it is what would change
-- behaviour, at T7, by making the re-keyed authorizer answer false for the baseline role.
-- ⚠ ONE row reaches its site from elsewhere: `commission.cases.deliberation.read`. A coordinator
-- gets the deliberation bit from `app._case_caps` **S1** (the coordinator arm), not S5. The grant
-- is still not an over-grant -- S1 already confers the bit -- and without it the re-keyed
-- authorizer would deny a coordinator a read it holds today.
insert into authz.role_permissions (role_code, permission_code) values
  ('staff_admin', 'commission.forms.read'),
  ('staff_admin', 'commission.responses.create'),
  ('staff_admin', 'commission.roster.read'),
  ('staff_admin', 'commission.charter.read'),
  ('staff_admin', 'commission.meetings.read'),
  ('staff_admin', 'commission.meetings.minutes.sign'),
  ('staff_admin', 'commission.cases.deliberation.read'),
  ('staff_admin', 'commission.action_items.read'),
  ('staff_admin', 'commission.cases.vote'),
  ('staff_admin', 'commission.process_templates.read'),
  ('staff_admin', 'commission.indicators.read'),
  ('staff_admin', 'commission.accreditation.read'),
  ('staff_admin', 'commission.documents.read'),
  ('staff_admin', 'commission.safety_events.read'),
  ('staff_admin', 'commission.capa.read'),
  ('staff_admin', 'commission.referrals.metadata.read'),
  ('staff_admin', 'commission.referrals.notes.author'),
  ('staff_admin', 'commission.cases.vocabulary.read');

-- ── 4. `staff` -> `test_validation`, COUNT-VERIFIED ──────────────────────────────────────────
-- ⛔ The `do` block is the point, not the `update`. A bare update that matched zero rows -- a
-- renamed code, a role deleted by a peer migration -- would apply silently and every downstream
-- differential would read "the catalog denies everything" as a divergence rather than as a
-- missing flip. This mirrors 20261003007200's count-verified shape.
do $$
declare
  v_perms   integer;
  v_staff   integer;
  v_admin   integer;
  v_flipped integer;
begin
  select count(*) into v_perms from authz.permissions;
  if v_perms <> 61 then
    raise exception 'authz.permissions is % rows, expected 61 (43 + the 18 AE5 staff codes)', v_perms;
  end if;

  select count(*) into v_staff from authz.role_permissions where role_code = 'staff';
  if v_staff <> 20 then
    raise exception '`staff` holds % permission grants, expected the 20 PO-approved codes', v_staff;
  end if;

  select count(*) into v_admin from authz.role_permissions where role_code = 'staff_admin';
  if v_admin <> 60 then
    raise exception '`staff_admin` holds % permission grants, expected 60 (42 + the 18 shared)', v_admin;
  end if;

  update authz.roles set state = 'test_validation' where code = 'staff' and state = 'legacy';
  get diagnostics v_flipped = row_count;
  if v_flipped <> 1 then
    raise exception 'expected to flip exactly 1 role to test_validation, flipped % — `staff` was '
                    'not `legacy` at this point in the chain', v_flipped;
  end if;

  -- ⛔ EXACTLY ONE `authoritative` AND EXACTLY ONE `test_validation`. The first half is the AE4
  -- cutover, untouched by this migration; the second is this migration's whole effect. Asserting
  -- both together is what refuses the two shapes a later hand could produce here: flipping the
  -- wrong role, and flipping a second one.
  if (select count(*) from authz.roles where state = 'authoritative') <> 1 then
    raise exception 'expected exactly 1 authoritative role after this migration';
  end if;
  if (select count(*) from authz.roles where state = 'test_validation') <> 1 then
    raise exception 'expected exactly 1 test_validation role after this migration';
  end if;
end $$;

comment on table authz.role_permissions is
  'Role -> permission grants. AE4 seeded staff_admin (42); AE5 increment 1 added the 18 staff '
  'codes to BOTH commission-tier roles and granted staff its 20 approved codes. ⛔ `staff` is '
  '`test_validation`, so authz.candidate_has_permission sees these grants and '
  'authz.has_permission -- the runtime evaluator -- does not. No production door is affected '
  'until T6 flips the state and T7 re-keys the sites.';

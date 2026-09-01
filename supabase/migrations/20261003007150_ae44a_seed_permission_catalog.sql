-- AE4.4a step 2 -- seed the 42 approved permission codes.
--
-- SOURCE OF TRUTH: the PO-approved matrix,
-- docs/design/authz-ae43-staff-admin-permission-matrix.md section 4.2, approved 2026-09-01 at
-- 42 rows. These values were MECHANICALLY EXTRACTED from that table, not transcribed -- the
-- extractor asserts the numbering is contiguous 1..42 and that every value falls inside the
-- three declared domains, so a hand-typing slip cannot enter here.
--
-- From cutover this catalog IS the regression oracle (ADR 0155 D7). A row that disagrees with
-- the approved matrix is not a bug in the catalog, it is a bug in the approval trail -- amend
-- the matrix and re-approve, never edit a code here to make a test pass.
--
-- MIGRATION-MANAGED, NEVER `seed.sql` -- the Increment 1 argument, unchanged: rows that live
-- only in `seed.sql` are ABSENT IN PRODUCTION while local and E2E are green, and these are FK
-- referents for `authz.role_permissions`.

insert into authz.permissions
  (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind) values
  ('commission.forms.edit',                       'commission_content', 'write',        'none',                          'commission'),
  ('commission.forms.publish',                    'commission_content', 'irreversible', 'none',                          'commission'),
  ('commission.forms.assets.upload',              'commission_content', 'write',        'none',                          'commission'),
  ('commission.responses.read',                   'commission_content', 'read',         'none',                          'commission'),
  ('commission.responses.correct',                'commission_content', 'write',        'none',                          'commission'),
  ('commission.signoffs.read',                    'commission_content', 'read',         'none',                          'commission'),
  ('commission.signoffs.sign',                    'commission_content', 'write',        'none',                          'commission'),
  ('commission.dashboard.read',                   'commission_content', 'read',         'none',                          'commission'),
  ('commission.staff.manage',                     'identity',           'authority',    'none',                          'commission'),
  ('commission.titles.manage',                    'vocabulary',         'write',        'none',                          'commission'),
  ('commission.meetings.manage',                  'commission_content', 'write',        'none',                          'commission'),
  ('commission.meetings.reserved.author',         'commission_content', 'write',        'none',                          'commission'),
  ('commission.meetings.cases.shell.read',        'commission_content', 'read',         'none',                          'commission'),
  ('commission.meetings.cases.substance.read',    'commission_content', 'read',         'none',                          'commission'),
  ('commission.meetings.cases.decision.read',     'commission_content', 'read',         'none',                          'commission'),
  ('commission.cases.manage',                     'commission_content', 'write',        'none',                          'commission'),
  ('commission.cases.access.manage',              'commission_content', 'authority',    'none',                          'commission'),
  ('commission.cases.recusal.manage',             'commission_content', 'authority',    'none',                          'commission'),
  ('commission.cases.lifecycle',                  'commission_content', 'irreversible', 'none',                          'commission'),
  ('commission.cases.phi.dispose',                'phi',                'irreversible', 'phi',                           'commission'),
  ('commission.process_templates.manage',         'commission_content', 'write',        'none',                          'commission'),
  ('commission.action_items.manage',              'commission_content', 'write',        'none',                          'commission'),
  ('commission.documents.manage',                 'commission_content', 'write',        'none',                          'commission'),
  ('commission.documents.publish',                'commission_content', 'irreversible', 'none',                          'commission'),
  ('commission.accreditation.manage',             'commission_content', 'write',        'none',                          'commission'),
  ('commission.referrals.manage',                 'commission_content', 'write',        'none',                          'commission'),
  ('commission.referrals.phi.read',               'phi',                'read',         'phi',                           'commission'),
  ('commission.safety_events.report',             'commission_content', 'write',        'none',                          'commission'),
  ('commission.audit.read',                       'audit',              'read',         'none',                          'commission'),
  ('org.professionals.manage',                    'identity',           'authority',    'class2_professional_identity',  'organization'),
  ('org.participants.external.manage',            'identity',           'write',        'none',                          'organization'),
  ('org.case_vocabulary.manage',                  'vocabulary',         'write',        'none',                          'organization'),
  ('org.professionals.read',                      'identity',           'read',         'class2_professional_identity',  'organization'),
  ('commission.charter.manage',                   'commission_content', 'write',        'none',                          'commission'),
  ('commission.safety_events.phi.read',           'phi',                'read',         'phi',                           'commission'),
  ('commission.safety_events.phi.write',          'phi',                'write',        'phi',                           'commission'),
  ('commission.safety_events.custody',            'commission_content', 'write',        'none',                          'commission'),
  ('commission.dsr.execute',                      'audit',              'write',        'none',                          'commission'),
  ('commission.cases.phi.read',                   'phi',                'read',         'phi',                           'commission'),
  ('commission.indicators.manage',                'commission_content', 'write',        'none',                          'commission'),
  ('commission.cases.read',                       'commission_content', 'read',         'none',                          'commission'),
  ('commission.meetings.minutes.transcript.read', 'commission_content', 'read',         'none',                          'commission');

do $$
declare v_n int;
begin
  select count(*) into v_n from authz.permissions;
  if v_n <> 42 then
    raise exception 'AE4.4a: expected 42 permission rows after seeding, found %. The approved matrix has 42 rows; a mismatch means this migration and the oracle have diverged.', v_n
      using errcode = 'check_violation';
  end if;
end $$;

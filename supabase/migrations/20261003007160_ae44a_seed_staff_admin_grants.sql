-- AE4.4a step 3 -- `staff_admin`'s permission grants. AE4.2 spec: "zero `role_permissions`
-- rows except `staff_admin`'s (AE4.3)".
--
-- All 42 approved codes are granted to `staff_admin`, because the matrix IS `staff_admin`'s
-- matrix -- every row was derived as a capability this role holds today. No other role gets a
-- row; AE5 substitutes the remaining ten, one at a time.
--
-- `authz.roles.staff_admin` STAYS `legacy`. This migration seeds grants; it does not flip an
-- evaluator. The tripwire in pgTAP 401 section 3.2 (every role is `legacy`) must remain ARMED
-- -- disarming it here would silence the assertion that AE4.6 cutover actually happened. The
-- catalog remains AUTHORITY-ELECT (ADR 0162 section 2).
--
-- `authz.permission_implications` stays EMPTY after this migration. Stated because it is easy
-- to assume otherwise: pgTAP 401 sections 6.4 / 7.4 / 7.5 range over implication EDGES, so
-- seeding permissions and grants does NOT give them a subject. They remain vacuous-by-
-- construction until AE4.4b introduces the closure, and their value continues to come
-- entirely from the constructed controls in sections 6.1-6.3 / 7.1-7.3.

insert into authz.role_permissions (role_code, permission_code) values
  ('staff_admin', 'commission.forms.edit'),
  ('staff_admin', 'commission.forms.publish'),
  ('staff_admin', 'commission.forms.assets.upload'),
  ('staff_admin', 'commission.responses.read'),
  ('staff_admin', 'commission.responses.correct'),
  ('staff_admin', 'commission.signoffs.read'),
  ('staff_admin', 'commission.signoffs.sign'),
  ('staff_admin', 'commission.dashboard.read'),
  ('staff_admin', 'commission.staff.manage'),
  ('staff_admin', 'commission.titles.manage'),
  ('staff_admin', 'commission.meetings.manage'),
  ('staff_admin', 'commission.meetings.reserved.author'),
  ('staff_admin', 'commission.meetings.cases.shell.read'),
  ('staff_admin', 'commission.meetings.cases.substance.read'),
  ('staff_admin', 'commission.meetings.cases.decision.read'),
  ('staff_admin', 'commission.cases.manage'),
  ('staff_admin', 'commission.cases.access.manage'),
  ('staff_admin', 'commission.cases.recusal.manage'),
  ('staff_admin', 'commission.cases.lifecycle'),
  ('staff_admin', 'commission.cases.phi.dispose'),
  ('staff_admin', 'commission.process_templates.manage'),
  ('staff_admin', 'commission.action_items.manage'),
  ('staff_admin', 'commission.documents.manage'),
  ('staff_admin', 'commission.documents.publish'),
  ('staff_admin', 'commission.accreditation.manage'),
  ('staff_admin', 'commission.referrals.manage'),
  ('staff_admin', 'commission.referrals.phi.read'),
  ('staff_admin', 'commission.safety_events.report'),
  ('staff_admin', 'commission.audit.read'),
  ('staff_admin', 'org.professionals.manage'),
  ('staff_admin', 'org.participants.external.manage'),
  ('staff_admin', 'org.case_vocabulary.manage'),
  ('staff_admin', 'org.professionals.read'),
  ('staff_admin', 'commission.charter.manage'),
  ('staff_admin', 'commission.safety_events.phi.read'),
  ('staff_admin', 'commission.safety_events.phi.write'),
  ('staff_admin', 'commission.safety_events.custody'),
  ('staff_admin', 'commission.dsr.execute'),
  ('staff_admin', 'commission.cases.phi.read'),
  ('staff_admin', 'commission.indicators.manage'),
  ('staff_admin', 'commission.cases.read'),
  ('staff_admin', 'commission.meetings.minutes.transcript.read');

do $$
declare v_n int; v_other int;
begin
  select count(*) into v_n from authz.role_permissions where role_code = 'staff_admin';
  select count(*) into v_other from authz.role_permissions where role_code <> 'staff_admin';
  if v_n <> 42 or v_other <> 0 then
    raise exception 'AE4.4a: expected 42 staff_admin grants and 0 others, found % and %.', v_n, v_other
      using errcode = 'check_violation';
  end if;
end $$;

-- 427 — AE5-STAFF, lead ruling L34 finding F2: two T7 fixtures that had only ROLLED-BACK witnesses,
-- asserted in a committed suite. Owner: backend.
--
-- ⛔ WHY THIS FILE EXISTS. The AC-4 fixture-gap disposition (2026-09-15, `8b92d026`) found two seeded
-- fixtures bound by no committed suite: row 9's grant persona `a5f00000-…-f5` with its grant
-- `a5fb0000-…-c1`, and L18's closed-session items `a5fc0000-…-e1–e3`. Each had exactly ONE witness,
-- taken in a rolled-back transaction and written into the unit record. A witness nobody re-runs is a
-- claim about the day it was taken; this file makes each one a gate.
-- ⚠ A NEW FILE, not an addition to an existing suite: the suites that already call these doors
-- (243, 245, 248, 319, 356, 382, 409, 410, 421) predate T7, build their own fixtures and pin their own
-- plan counts. Binding T7's seed rows into them would couple unrelated suites to this unit's seed.
--
-- ⭐ EVERY CALL WAS READ AGAINST ITS LIVE BODY (2026-09-15) before it was written:
--   `app.has_case_capability(case, uid, cap)` = `(app._case_caps(case, uid) & app._cap_bit(cap)) <> 0`
--     — row 9's door (`arm3Door.expression`), taking the principal as an argument, so no claims.
--   `public.get_reserved_session_items(meeting)` — reach via `app.can_reach_meeting(meeting, auth.uid())`;
--     `withdrawals` is shown when the item is case-linked AND the caller is NOT the case respondent AND
--     (`c.visibility_policy = 'commission_default'` OR `app.can_reach_case_on_member_surface(case, uid)`,
--     the thin projection of `read_case_deliberation`). L18 kept that `commission_default` disjunct as a
--     resource-shape condition, and its witness was "a member without the bit reads withdrawals in a
--     commission_default session and is denied in a restricted one".

begin;
select plan(12);

-- ===========================================================================
-- § 0  FIXTURE CONTROLS — the rows bound below exist and are what they claim.
-- ⛔ Named ids, never a filter: a filter matching nothing makes every assertion below read green.
-- ===========================================================================
select is((select count(*)::int from public.case_access_grants g
            where g.id = 'a5fb0000-0000-0000-0000-0000000000c1'
              and g.case_id = 'd0000000-0000-0000-0000-0000000000c1'
              and g.principal_id = 'a5f00000-0000-0000-0000-0000000000f5'
              and g.read_case_deliberation and g.revoked_at is null),
          1,
  '0.1 FIXTURE: the T7 grant `a5fb…c1` gives `a5f0…f5` a live read_case_deliberation grant on `d0…c1`.');

select is((select count(*)::int from public.memberships m
            where m.principal_id = 'a5f00000-0000-0000-0000-0000000000f5'),
          0,
  '0.2 FIXTURE ⭐ the grant persona holds NO membership anywhere. Without this, § 1 could grant through '
  'the member-default arm and would say nothing about the residual GRANT arm row 9 keeps (L17).');

select is((select string_agg(i.id || '=' || c.visibility_policy || '/' || (i.withdrawals is not null), ', ' order by i.id)
             from public.meeting_closed_session_items i
             join public.meeting_closed_sessions s on s.id = i.closed_session_id
             join public.cases c on c.id = i.case_id
            where s.id = 'a5fc0000-0000-0000-0000-0000000000e1'
              and s.meeting_id = 'f1000000-0000-0000-0000-0000000000e1'),
          'a5fc0000-0000-0000-0000-0000000000e2=commission_default/true, a5fc0000-0000-0000-0000-0000000000e3=explicit_grants_only/true',
  '0.3 FIXTURE: session `a5fc…e1` on meeting `f1…e1` carries exactly two items — `…e2` on a '
  'commission_default case and `…e3` on an explicit_grants_only case — and BOTH hold withdrawal text, '
  'so a null read in § 2 is masking, never missing data.');

select is((select array[app.can_reach_meeting('f1000000-0000-0000-0000-0000000000e1', u),
                        app.is_case_respondent('d0000000-0000-0000-0000-0000000000c1', u),
                        app.is_case_respondent('ca000000-0000-0000-0000-0000000000e1', u),
                        app.is_recused_from_case('d0000000-0000-0000-0000-0000000000c1', u),
                        app.is_recused_from_case('ca000000-0000-0000-0000-0000000000e1', u),
                        app.has_case_capability('ca000000-0000-0000-0000-0000000000e1', u, 'read_case_deliberation'),
                        exists (select 1 from public.case_access_grants g
                                 where g.principal_id = u
                                   and g.case_id in ('d0000000-0000-0000-0000-0000000000c1',
                                                     'ca000000-0000-0000-0000-0000000000e1'))]
             from (select '00000000-0000-0000-0000-0000000000a1'::uuid as u) x),
          array[true, false, false, false, false, false, false],
  '0.4 FIXTURE: the § 2 caller (dr.john) reaches the meeting, is neither respondent nor recused on '
  'either case, holds NO deliberation bit on the explicit_grants_only case, and holds NO case grant on '
  'either — so its reads are membership and visibility alone. ⚠ Measured and excluded (2026-09-15): '
  'staff1.ccih is recused on `ca00…e1`, which would mask § 2.2''s arm; staff3.ccih holds a grant and '
  'staff2.ccih a role-keyed arm on `d0…c1` (caps 6 SURVIVE an explicit_grants_only flip), so § 2.1 could '
  'not red for either. dr.john''s caps on `d0…c1` are 2 seeded and 0 under that flip.');

-- ===========================================================================
-- § 1  ROW 9 — the residual GRANT arm, in isolation.
-- ===========================================================================
select is(app.has_case_capability('d0000000-0000-0000-0000-0000000000c1'::uuid,
                                  'a5f00000-0000-0000-0000-0000000000f5'::uuid,
                                  'read_case_deliberation'),
          true,
  '1.1 row 9 WITH the grant: `a5f0…f5`, holding no membership, reads deliberation on `d0…c1`.');

-- ⭐ The grant-less half is BUILT HERE, inside this transaction, never assumed from another fixture.
delete from public.case_access_grants where id = 'a5fb0000-0000-0000-0000-0000000000c1';

select is(app.has_case_capability('d0000000-0000-0000-0000-0000000000c1'::uuid,
                                  'a5f00000-0000-0000-0000-0000000000f5'::uuid,
                                  'read_case_deliberation'),
          false,
  '1.2 row 9 WITHOUT the grant: the same principal no longer reads deliberation — so 1.1''s true is the '
  'grant arm, not a door that grants everyone.');

-- ===========================================================================
-- § 2  L18 — the closed-session items resolve on their cases as L18 intended.
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_admin":false,"active_role":"staff"}', true);
set local role authenticated;

select is((select withdrawals is not null from public.get_reserved_session_items('f1000000-0000-0000-0000-0000000000e1')
            where id = 'a5fc0000-0000-0000-0000-0000000000e2'),
          true,
  '2.1 L18: on the commission_default case, a plain member (dr.john) reads the item''s withdrawals.');

select is((select withdrawals is null from public.get_reserved_session_items('f1000000-0000-0000-0000-0000000000e1')
            where id = 'a5fc0000-0000-0000-0000-0000000000e3'),
          true,
  '2.2 L18: on the explicit_grants_only case, the same member gets the item row with its withdrawals '
  'MASKED — the member-surface authority answers, and no commission_default disjunct carries it.');

select is((select count(*)::int from public.get_reserved_session_items('f1000000-0000-0000-0000-0000000000e1')
            where id in ('a5fc0000-0000-0000-0000-0000000000e2', 'a5fc0000-0000-0000-0000-0000000000e3')),
          2,
  '2.3 CARDINALITY CONTROL: both item rows ARE returned to that caller, so 2.2''s null is a masked '
  'column on a visible row, not an absent row reading as null.');

reset role;

-- ⭐⭐ 2.4–2.5 — THE DISJUNCT ON ITS OWN, which is L18's own witness. On `d0…c1` every active CCIH
-- member holds the deliberation bit through the member default (measured), so 2.1 alone cannot say
-- which arm showed the withdrawals. A recusal hard-denies the bit (`_case_caps` STEP 4) while
-- `withdrawals`' term reads the RESPONDENT only — so a recused member has NO bit and still reads the
-- withdrawals, through `visibility_policy = 'commission_default'` alone. Built here, rolled back.
select set_config('request.jwt.claims', '', true);
insert into public.case_recusals (id, case_id, user_id, source, reason_md, recused_by)
values ('42700000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000a1', 'coordinator', 'Recusa de teste (427).',
        '00000000-0000-0000-0000-000000000002');

select is(app.has_case_capability('d0000000-0000-0000-0000-0000000000c1'::uuid,
                                  '00000000-0000-0000-0000-0000000000a1'::uuid,
                                  'read_case_deliberation'),
          false,
  '2.4 the recused member holds NO deliberation bit on `d0…c1` — the precondition that isolates 2.5.');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_admin":false,"active_role":"staff"}', true);
set local role authenticated;

select is((select withdrawals is not null from public.get_reserved_session_items('f1000000-0000-0000-0000-0000000000e1')
            where id = 'a5fc0000-0000-0000-0000-0000000000e2'),
          true,
  '2.5 ⭐ L18''s WITNESS: a member WITHOUT the bit still reads the withdrawals on the commission_default '
  'case — the carried `commission_default` disjunct, and nothing else, shows them.');

select is((select withdrawals is null from public.get_reserved_session_items('f1000000-0000-0000-0000-0000000000e1')
            where id = 'a5fc0000-0000-0000-0000-0000000000e3'),
          true,
  '2.6 …and is still denied them on the explicit_grants_only case — the two halves L18 named, together.');

reset role;

select * from finish();
rollback;

-- =============================================================================
-- AUDIT-INVOKER-WRAPPER (ADR 0079 Amendment 7) — the meeting-verb wrappers are the
-- SOLE boundary between a staff_admin and a delegated `schedule_meetings` holder.
--
-- WHY THIS SUITE EXISTS. The first invoker sweep returned 47 BLIND wrappers. Most are
-- NOT vulnerabilities: for an INVOKER function the write still runs under RLS, and for
-- 26 of them the target table's write policy re-states the wrapper's own identity
-- predicate — the gate is defence in depth and a green suite is CORRECT. This family is
-- the exception, and the reason the sweep was worth building:
--
--   wrapper gate : app.assert_meeting_staff_admin -> app.is_staff_admin_of(commission)
--   meetings RLS : app.is_staff_admin_of(commission)
--                    OR app.member_can(commission, 'schedule_meetings')
--
-- The wrapper is STRICTER than the policy behind it. So a `schedule_meetings` delegate —
-- an ordinary `staff` member with an ADR 0061 administrativo capability — is exactly the
-- persona the two layers disagree about, and RLS cannot backstop the wrapper for them.
--
-- ⭐ MUTATION-PROVEN, not inferred. With `perform app.assert_meeting_staff_admin(...)`
-- rewritten to `perform 1` in `cancel_meeting`, seed persona `staff2.ccih@test.local`
-- (plain `staff`, holds `schedule_meetings` on CCIH) went from refused `42501` to
-- SUCCESSFULLY CANCELLING the meeting, in one transaction, rolled back. Before the
-- rewrite: refused. After: cancelled. That is the leak these tests red on.
--
-- ⚠ The probe that established this is itself worth recording: a FIRST attempt used
-- `update_meeting`, whose gate is the ASSIGNMENT form (`v := app.assert_...`). The
-- rewrite matched nothing, the door refused for the unchanged reason, and the probe
-- reported "RLS backstops the wrapper" — a conclusion drawn from a mutation that never
-- applied. The re-run asserts its own rewrite changed the text before believing the
-- result. `update_meeting` therefore carries the SAME exposure but cannot be swept; it
-- is covered by t6 here rather than by the harness.
--
-- AUTHORITY FIRST: every door below checks authorization before any state/domain rule,
-- so a single seeded meeting serves all of them regardless of its status.
-- =============================================================================

begin;
select plan(7);

create temp table k (uid uuid, mtg uuid, comm uuid) on commit drop;
insert into k
select (select id from auth.users where email = 'staff2.ccih@test.local'),
       (select id from public.meetings
         where commission_id = 'a0000000-0000-0000-0000-0000000000a1'
         order by created_at limit 1),
       'a0000000-0000-0000-0000-0000000000a1'::uuid;
grant select on k to authenticated;

-- ── CONTROLS: without these the suite could pass by testing the wrong persona ────────
select is((select count(*)::int from public.commission_administrativo_capabilities c, k
            where c.user_id = k.uid and c.commission_id = k.comm
              and c.capability = 'schedule_meetings'),
          1, 't1 CONTROL: the persona really does hold the schedule_meetings capability');
select is((select m.role from public.memberships m, k
            where m.principal_id = k.uid and m.commission_id = k.comm),
          'staff', 't2 CONTROL: …and is a plain staff member, NOT a staff_admin — the two layers disagree only about this persona');
select isnt((select mtg from k), null,
  't3 CONTROL: a CCIH meeting exists to aim at (a null target would make every throws_ok below pass vacuously)');

-- ── THE KEYSTONES ───────────────────────────────────────────────────────────────────
select test_helpers.claims_for((select uid from k), false);
set local role authenticated;

select throws_ok(
  format('select public.cancel_meeting(%L::uuid)', (select mtg from k)),
  '42501',
  null,
  't4 ⭐ a schedule_meetings delegate cannot CANCEL a meeting — mutation-proven: with this gate opened the same persona cancelled it, because the meetings RLS policy admits delegates');
select throws_ok(
  format('select public.distribute_meeting(%L::uuid)', (select mtg from k)),
  '42501',
  null,
  't5 ⭐ …cannot DISTRIBUTE a meeting');
select throws_ok(
  format('select public.update_meeting_minutes(%L::uuid, %L)', (select mtg from k), 'ata forjada'),
  '42501',
  null,
  't6 ⭐ …cannot write MINUTES. Also stands in for update_meeting, whose assignment-form gate the sweep cannot open — same gate, same RLS, same exposure');
select throws_ok(
  format('select public.set_meeting_quorum_met(%L::uuid, true)', (select mtg from k)),
  '42501',
  null,
  't7 ⭐ …cannot declare QUORUM MET');

select * from finish();
rollback;

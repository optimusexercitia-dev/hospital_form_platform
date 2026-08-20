-- =============================================================================
-- 348 — ADR 0129: the LGPD erasure door gets through the meeting child lock,
--       and NOTHING ELSE DOES.
--
-- WHAT WAS BROKEN. `public.dispose_meeting_minutes` (ADR 0056 §2) set
-- `app.in_meeting_rpc` under the comment "bypass the meeting freeze guards".
-- `app.guard_meeting_child_lock` never read that flag. The door therefore nulled
-- `minutes_md`, then RAISED on its `meeting_agenda_items` UPDATE and rolled the whole
-- thing back — so PHI erasure was impossible on a locked meeting WITH agenda items,
-- which is precisely the population that carries PHI. It failed CLOSED, against a
-- legal obligation (`FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`, blocked C1a/C1b).
--
-- ⭐ THE FIXTURE IS THE POINT, AND IT MUST BE BUILT. A locked meeting with NO agenda
-- items disposed fine before this fix, so a suite built on one is green either way and
-- proves nothing. This is not hypothetical: `346_print_currency` says so in a comment
-- and deliberately uses agenda-free meetings, and `197_phi_disposal_closure` §2 does
-- exercise an agenda item but on a `held` (UNLOCKED) meeting — between them, the entire
-- committed suite passed over the broken population without touching it.
-- Measured on a FRESH reset: the seed contains no locked meeting with children at all —
-- its only meeting with agenda items is `held`. (An E2E-mutated database shows that same
-- meeting as `in_signature`, which is how a fixture derived from seed state can look
-- correct and be wrong.) This suite therefore CONSTRUCTS the population.
--
-- ⭐ THE DIFFERENTIAL IS THE OTHER HALF. t9 (the door succeeds) is RED before the
-- migration — verified by neutralization, it dies `23514 … está bloqueado` — but on its
-- own it would be equally satisfied by simply deleting the guard. So t5/t6/t8/t15 pin
-- that the guard still refuses EVERYONE ELSE. The stand-aside is exactly one named door
-- wide, and these are the assertions that go red if a later "fix" widens it to
-- `app.in_meeting_rpc` (shape 1, rejected: 26 `public.*` doors set that flag — it would
-- have opened all of them at once).
--
-- ⭐ t7 EXISTS BECAUSE THE DIFF-SCOPED DOOR SWEEP FOUND THIS DOOR BLIND. Rewriting
-- `dispose_meeting_minutes`'s authorization gate to `if false then` — so that ANY caller
-- passes — left the full 6548-test suite GREEN. A PHI-erasure door whose gate no
-- keystone exercises is door-blind by construction (ADR 0079); the gate was correct, but
-- nothing would have noticed its removal. t7 is that missing keystone. (ADR 0079's
-- recipe filters the diff to `^(is_|can_|has_)` names and RLS policies, and by that
-- SYNTAX this migration's case list is empty — the gate is a plain `if not (...)` inside
-- a door and the guard is a trigger function. The property, not the syntax, is what the
-- sweep is for.)
--
-- ⚠ DISCRIMINATE ON THE MESSAGE, NOT THE SQLSTATE. `update_meeting_agenda_item`
-- (t8) raises `check_violation` — 23514, the SAME code the guard raises — for a blank
-- title. A `throws_ok(..., '23514')` there would pass for the wrong reason and keep
-- passing if the guard were removed. Every lock refusal below asserts the guard's own
-- message text.
--
-- ⚠ ROLE CHOICE IS DELIBERATE. t5/t6/t15 run as the suite's default (superuser) role so
-- that RLS CANNOT be the party refusing: the trigger is then the only thing that can
-- raise, and the assertion cannot be satisfied by an unrelated permission failure.
-- t7/t8/t9 run as personas, because they must pass (or fail) their door's own
-- authorization gate.
-- =============================================================================

begin;
select plan(15);

-- The door calls `app.assert_meetings_enabled()`; without this the keystone would SKIP
-- into a green, and audit_write needs its own flag (pgtap-fixture-flag-gaps).
update app.feature_flags set enabled = true where key in ('meetings', 'audit_trail');

-- ── FIXTURE ─────────────────────────────────────────────────────────────────────────
-- Anchored on a commission that actually HAS a staff_admin, rather than a hardcoded
-- seed id: the persona is a precondition of reaching either door, and t3 fails loudly
-- if it ever resolves to nobody. `staff_uid` is a PLAIN staff member of the SAME
-- commission — the tightest discriminator for t7, because they hold commission
-- membership and still fail both arms of the gate.
create temp table k (comm uuid, uid uuid, staff_uid uuid, mtg uuid, item uuid, locked_msg text)
  on commit drop;
insert into k
select c.id,
       mm.principal_id,
       (select m2.principal_id from public.memberships m2
         where m2.commission_id = c.id and m2.role = 'staff'
         order by m2.principal_id limit 1),
       gen_random_uuid(),
       gen_random_uuid(),
       format('o conteúdo desta reunião está bloqueado (%s)', 'in_signature')
  from public.commissions c
  join public.memberships mm on mm.commission_id = c.id and mm.role = 'staff_admin'
 order by c.created_at, mm.principal_id
 limit 1;
grant select on k to authenticated;

insert into public.meetings (id, commission_id, title, scheduled_start, minutes_md)
select k.mtg, k.comm, 'Ata com PHI para descarte', now(),
       'Deliberações sobre o caso, com identificação do paciente.'
  from k;

insert into public.meeting_agenda_items (id, meeting_id, position, title, description, discussion_notes, resolution)
select k.item, k.mtg, 1, 'Item com PHI',
       'Descrição com PHI', 'Notas com PHI', 'Encaminhamento com PHI'
  from k;

-- WALKED, not set: guard_meeting_status admits no jumps (scheduled -> held ->
-- in_signature). The children are inserted BEFORE the lock, because the lock is
-- precisely what would refuse them after.
select set_config('app.in_meeting_rpc', 'on', true);
update public.meetings set status = 'held'         where id = (select mtg from k);
update public.meetings set status = 'in_signature' where id = (select mtg from k);
select set_config('app.in_meeting_rpc', 'off', true);

-- ── CONTROLS ────────────────────────────────────────────────────────────────────────
select is((select m.status from public.meetings m, k where m.id = k.mtg), 'in_signature',
  't1 CONTROL: the fixture meeting really reached a LOCKED status — if the status walk silently failed, every throws_ok below would pass for the wrong reason and the keystone would prove nothing');
select cmp_ok((select count(*)::int from public.meeting_agenda_items ai, k where ai.meeting_id = k.mtg),
              '>', 0,
  't2 ⭐ CONTROL: …and it HAS agenda items. This is the whole fixture requirement: an agenda-less locked meeting disposed fine before ADR 0129');
select is((select mm.role from public.memberships mm, k
            where mm.principal_id = k.uid and mm.commission_id = k.comm),
          'staff_admin',
  't3 CONTROL: the authorized persona really is staff_admin of the fixture commission, so t8/t9 reach the trigger instead of stopping at a 42501');
select is((select mm.role from public.memberships mm, k
            where mm.principal_id = k.staff_uid and mm.commission_id = k.comm),
          'staff',
  't4 CONTROL: the refused persona is a PLAIN staff of the SAME commission — so t7''s 42501 is attributable to the role, not to tenancy or to a missing membership');

-- ── THE GUARD STILL REFUSES EVERYONE ELSE (run as superuser: RLS cannot be the refuser)
select throws_ok(
  format('update public.meeting_agenda_items set description = %L where meeting_id = %L::uuid',
         'probe', (select mtg from k)),
  '23514', (select locked_msg from k),
  't5 a bare child UPDATE on a locked meeting is REFUSED — the lock stays load-bearing (ADR 0126 §E rests on this)');

select set_config('app.in_meeting_rpc', 'on', true);
select throws_ok(
  format('update public.meeting_agenda_items set description = %L where meeting_id = %L::uuid',
         'probe', (select mtg from k)),
  '23514', (select locked_msg from k),
  't6 ⭐ …and is STILL refused with app.in_meeting_rpc = on — the flag all 26 sibling doors set. This is shape 1''s widening, pinned out: if someone later teaches the guard to honour in_meeting_rpc, this goes RED');
select set_config('app.in_meeting_rpc', 'off', true);

-- ── THE DOOR'S OWN GATE (the blind one the sweep found) ─────────────────────────────
select test_helpers.claims_for((select staff_uid from k), false);
set local role authenticated;
select throws_ok(
  format('select public.dispose_meeting_minutes(%L::uuid, %L)', (select mtg from k), 'subject_request'),
  '42501', null,
  't7 ⭐ a plain commission member CANNOT erase a meeting''s PHI — mutation-proven blind before this test existed: with the gate rewritten to `if false then`, all 6548 tests still passed');
reset role;

-- ── THE AUTHORIZED LANE ─────────────────────────────────────────────────────────────
select test_helpers.claims_for((select uid from k), false);
set local role authenticated;

-- A real sibling door, past its own authorization gate, writing the same child table.
-- A non-blank title is passed on purpose: a blank one raises 23514 too, and this test
-- must fail only for the lock.
select throws_ok(
  format('select public.update_meeting_agenda_item(%L::uuid, %L)',
         (select item from k), 'titulo valido'),
  '23514', (select locked_msg from k),
  't8 ⭐ a sibling meeting RPC — authorized, gate passed — still CANNOT write children of a locked meeting');

select lives_ok(
  format('select public.dispose_meeting_minutes(%L::uuid, %L)', (select mtg from k), 'subject_request'),
  't9 ⭐⭐ THE KEYSTONE: the LGPD erasure door COMPLETES on a locked meeting WITH agenda items. RED before this migration (it raised on the child UPDATE and rolled the whole transaction back)');

reset role;

-- ── THE OUTCOME IS WHAT ADR 0056 §2 PROMISES ────────────────────────────────────────
select is((select minutes_md from public.meetings m, k where m.id = k.mtg), null,
  't10 minutes_md is nulled');
select is((select count(*)::int from public.meeting_agenda_items ai, k
            where ai.meeting_id = k.mtg
              and (ai.description is distinct from '[PHI removido]'
                or ai.discussion_notes is distinct from '[PHI removido]'
                or ai.resolution is distinct from '[PHI removido]')),
          0,
  't11 every agenda row is redacted in all three columns — counted as "rows NOT fully redacted = 0", so with t2 holding, an empty table cannot satisfy it');
select ok((select m.phi_disposed_at is not null and m.phi_disposed_reason = 'subject_request'
             from public.meetings m, k where m.id = k.mtg),
  't12 phi_disposed_at is stamped with the reason given');
select is((select m.status from public.meetings m, k where m.id = k.mtg), 'in_signature',
  't13 status is UNCHANGED by disposal — erasure is not a lifecycle transition (ADR 0126 §F: disposal un-registers via phi_disposed_at, not via status)');

-- ── THE STAND-ASIDE IS SCOPED TO THE DOOR ───────────────────────────────────────────
-- Not in ADR 0129's obligation list; added because a flag left 'on' would hand the rest
-- of the CALLER's transaction a silent bypass of the lock, and nothing else would notice.
select isnt(current_setting('app.in_disposal_rpc', true), 'on',
  't14 ⭐ the door RESET the flag — it does not survive into the rest of the caller''s transaction');
select throws_ok(
  format('update public.meeting_agenda_items set description = %L where meeting_id = %L::uuid',
         'probe', (select mtg from k)),
  '23514', (select locked_msg from k),
  't15 ⭐ …proven behaviourally: a child UPDATE immediately AFTER the door is refused exactly as before it');

select * from finish();
rollback;

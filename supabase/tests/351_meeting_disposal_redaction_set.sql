-- =============================================================================
-- 351 — ADR 0056 Amendment 1: `dispose_meeting_minutes` clears the free text it
--       CLAIMS to clear, and clears it only for the meeting it was asked about.
--
-- ⚠ Numbered 351, not 350: `350_dsr_adjudication_and_attested_tier.sql` already holds
-- that number (DSR Slice 3), and "suite 350" is cited throughout backend-state.md, the
-- Slice 3 review and the bug log meaning THAT file. Two suites sharing a number breaks
-- nothing at run time but makes every future gate record and bug report ambiguous.
--
-- WHAT WAS BROKEN. The door redacted three of `meeting_agenda_items`' four text
-- columns and nothing on any other child table, while
-- `DSR_RESIDUE_NOTICE` line 1 told the data subject the meeting's database PHI was
-- erased. An agenda item titled with a patient's name survived that claim
-- (FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT).
--
-- ⭐ EVERY PIN HAS A SIBLING CONTROL, BECAUSE "IT IS GONE" IS THE WEAK HALF. A pin
-- that only asserts the target's text is redacted would pass equally against a door
-- implemented as `delete from meeting_agenda_items` or `update ... where true`. So a
-- SECOND meeting in the same commission is built with identical child rows and must
-- come through the call UNTOUCHED. The pins below always run in pairs: redacted here,
-- intact there.
--
-- ⭐ THE FIXTURE MEETING IS LOCKED, AND THAT IS THE POINT. `app.guard_meeting_child_lock`
-- only fires on `in_signature`/`signed`/`distributed`/`cancelled`. A fixture on a
-- `scheduled` or `held` meeting never reaches the guard, so a widened door that the
-- lock actually REFUSES would still show green — which is exactly how the ADR 0129
-- defect survived the committed suite (`197_phi_disposal_closure` §2 exercises an
-- agenda item on a `held` meeting; `346_print_currency` deliberately uses agenda-free
-- meetings). The locked meeting is also the population that carries PHI.
--
-- ⚠ COUNTED AS "ROWS NOT REDACTED = 0", PAIRED WITH A NON-EMPTY CONTROL. Each pin
-- asserts a count of offending rows is zero; each has a t1-t7 control proving the
-- population is non-empty. Either half alone is satisfiable by an empty table.
--
-- ⚠ NULL IS ASSERTED TO STAY NULL (t22). `meeting_attendees_identity_xor` requires an
-- INTERNAL attendee's `external_name` to remain NULL; a blanket redaction would
-- violate the CHECK and abort the entire disposal. t22 is that constraint's keystone —
-- it goes red the moment someone "simplifies" the door's `case when ... is not null`
-- branches into an unconditional assignment.
--
-- ⚠ t25 PINS A DELIBERATE OMISSION. `meeting_cases.{summary,decision}` belong to
-- `dispose_case_phi`, per case, by ADR 0056 §2's decoupling — one meeting discusses
-- many cases and a meeting-wide redaction would over-redact other cases' text. Pinned
-- so that widening it later is a decision someone makes, not a side effect.
--
-- ⭐ t31/t32 ARE THE OVER-GRANT TWIN FOR THE NEW STAND-ASIDE. This change teaches a
-- SECOND guard (`app.guard_reserved_child_lock`) to honour `app.in_disposal_rpc`, so the
-- flag now has two readers and still one setter. "Disposal can now write closed-session
-- items" (t27-t29) would be satisfied just as well by deleting the guard outright. t31
-- pins that a bare UPDATE is still refused, and t32 that it is still refused under
-- `app.in_meeting_rpc` — the flag 26 sibling doors set, and the widening ADR 0129
-- explicitly rejected. Without this pair the stand-aside has no upper bound.
-- =============================================================================

begin;
select plan(33);

-- The door calls `app.assert_meetings_enabled()`; without this every keystone would
-- SKIP into a green, and `audit_write` needs its own flag (pgtap-fixture-flag-gaps).
update app.feature_flags set enabled = true where key in ('meetings', 'audit_trail');

-- ── FIXTURE ─────────────────────────────────────────────────────────────────────────
-- Anchored on a commission that actually HAS a staff_admin rather than a hardcoded seed
-- id. `sib` is the survival control: same commission, same child rows, never disposed.
create temp table k (comm uuid, uid uuid, mtg uuid, sib uuid,
                     item uuid, sib_item uuid, ext_att uuid, int_att uuid,
                     sib_att uuid, sess uuid, sib_sess uuid, job uuid, sib_job uuid,
                     mcase uuid, csi uuid, sib_csi uuid, redacted text, locked_msg text)
  on commit drop;
insert into k
select c.id, mm.principal_id,
       gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       gen_random_uuid(), gen_random_uuid(),
       '[PHI removido]',
       format('o conteúdo desta reunião está bloqueado (%s)', 'in_signature')
  from public.commissions c
  join public.memberships mm on mm.commission_id = c.id and mm.role = 'staff_admin'
 -- ⛔ TWO REQUIREMENTS, NEITHER DECORATIVE. Both bound what the ORDER BY can pick,
 -- because the ordering is far weaker than it looks: the seed's six commissions share an
 -- IDENTICAL `created_at`, so `order by c.created_at, mm.principal_id` is a TOTAL tie on
 -- the first key and the winner is decided ENTIRELY by `min(principal_id)` — an arbitrary
 -- UUID.
 --
 -- (a) `cases` — makes t25's fixture row UNCONDITIONAL. The `meeting_cases` insert below
 --     is the suite's only conditional one (it joins `public.cases`), so for a commission
 --     with no cases it silently produces NO ROW and t25 asserts over an empty set.
 --     ⚠ MEASURED, and NOT the stronger thing an earlier version of this comment
 --     claimed: `Comissão de Farmácia B` (1 staff_admin, 0 cases) ranked **4 of 4**, not
 --     first, so the pin was vacuity-CAPABLE — one seed shuffle away — rather than
 --     already vacuous. The earlier text asserted both at once ("already a live winner"
 --     AND "one seed shuffle from permanent vacuity"), which cannot both be true; it
 --     inferred a rank from the tie without measuring one. ADR 0056 Amdt 1 cites t25
 --     twice as a guarantee, which is why the ordering is now bounded rather than
 --     trusted.
 --
 -- (b) SINGLE-ROLE — makes the persona one the DOOR ACTUALLY ADMITS. Holding a
 --     `staff_admin` membership row is NOT the same as passing `app.is_staff_admin_of`:
 --     `app.has_role`'s final conjunct requires the probed role to equal
 --     `app.active_role()`, and D11 derives that implicitly only for a SINGLE-role
 --     principal (0 or 2+ live roles ⇒ no claim at all). Measured under each persona's
 --     own claims: the `Qualidade e Segurança` staff_admin also holds `org_admin`, so
 --     `active_role()` is NULL and BOTH arms of the door's gate are false — it is
 --     refused. Without this clause the fixture is one UUID shuffle from 16 red tests.
   and exists (select 1 from public.cases ca where ca.commission_id = c.id)
   and not exists (select 1 from public.memberships m2
                    where m2.principal_id = mm.principal_id and m2.role <> 'staff_admin')
 order by c.created_at, mm.principal_id
 limit 1;
grant select on k to authenticated;

insert into public.meetings (id, commission_id, title, scheduled_start, minutes_md)
select k.mtg, k.comm, 'Ata alvo', now(), 'Deliberações com identificação do paciente.' from k
union all
select k.sib, k.comm, 'Ata irmã', now(), 'Ata de outra reunião — deve sobreviver.' from k;

insert into public.meeting_agenda_items
  (id, meeting_id, position, title, description, discussion_notes, resolution)
select k.item, k.mtg, 1, 'Item com nome do paciente',
       'Descrição com PHI', 'Notas com PHI', 'Encaminhamento com PHI' from k
union all
select k.sib_item, k.sib, 1, 'Item da reunião irmã',
       'Descrição irmã', 'Notas irmãs', 'Encaminhamento irmão' from k;

-- EXTERNAL attendee (user_id null, external_name non-blank) — the redactable arm of
-- `meeting_attendees_identity_xor`. INTERNAL attendee (user_id set, external_name NULL)
-- — the arm t22 protects.
insert into public.meeting_attendees
  (id, meeting_id, user_id, external_name, external_org, role, attendance, note)
select k.ext_att, k.mtg, null, 'Maria da Silva (acompanhante)', 'Hospital Externo',
       'convidado', 'present', 'Relatou o quadro clínico do paciente' from k
union all
select k.int_att, k.mtg, k.uid, null, null,
       'membro', 'present', 'Nota interna com PHI' from k
union all
select k.sib_att, k.sib, null, 'João Externo', 'Clínica Irmã',
       'convidado', 'present', 'Nota da reunião irmã' from k;

insert into public.meeting_closed_sessions (id, meeting_id, label)
select k.sess, k.mtg, 'Sessão fechada — caso do paciente' from k
union all
select k.sib_sess, k.sib, 'Sessão fechada irmã' from k;

-- Depth-2: these key on `closed_session_id`, NOT on `meeting_id`. A census that stops at
-- the meeting's direct children never sees this table, which is how it stayed out of the
-- original filing's four-column list.
insert into public.meeting_closed_session_items
  (id, closed_session_id, position, withdrawals, substance, decision)
select k.csi, k.sess, 1, 'Dr. X se declarou impedido',
       'Deliberação reservada sobre o paciente', 'Decisão reservada com PHI' from k
union all
select k.sib_csi, k.sib_sess, 1, 'Impedimento irmão',
       'Deliberação reservada irmã', 'Decisão reservada irmã' from k;

-- `status = 'done'`: the job has been transcribed and awaits human review. This is the
-- resting state the three purge doors (`apply`/`cancel`/`fail`) never reach, and the one
-- that keeps a verbatim transcript indefinitely.
insert into public.meeting_minutes_jobs
  (id, meeting_id, requested_by, status, transcript, draft, result)
select k.job, k.mtg, k.uid, 'done'::audio_job_status,
       'Transcrição literal: o paciente João relatou...',
       '{"minutes_md": "rascunho com PHI"}'::jsonb,
       '{"segments": ["fala com PHI"]}'::jsonb from k
union all
select k.sib_job, k.sib, k.uid, 'done'::audio_job_status,
       'Transcrição da reunião irmã',
       '{"minutes_md": "rascunho irmão"}'::jsonb,
       '{"segments": ["fala irmã"]}'::jsonb from k;

-- ADR 0056 §2's decoupled columns, on the TARGET meeting: they must survive (t25).
insert into public.meeting_cases (id, meeting_id, case_id, summary, decision)
select k.mcase, k.mtg, ca.id, 'Resumo do caso com PHI', 'Decisão do caso com PHI'
  from k join public.cases ca on ca.commission_id = k.comm
 order by ca.created_at limit 1;

-- WALKED, not set: `guard_meeting_status` admits no jumps. Children are inserted BEFORE
-- the lock, because the lock is precisely what would refuse them after.
select set_config('app.in_meeting_rpc', 'on', true);
update public.meetings set status = 'held'         where id in (select mtg from k);
update public.meetings set status = 'in_signature' where id in (select mtg from k);
select set_config('app.in_meeting_rpc', 'off', true);

-- ── CONTROLS: the population is non-empty and locked ────────────────────────────────
select is((select m.status from public.meetings m, k where m.id = k.mtg), 'in_signature',
  't1 CONTROL: the target meeting really reached a LOCKED status — on an unlocked meeting the child-lock guard never fires and every pin below would pass without exercising it');
select cmp_ok((select count(*)::int from public.meeting_agenda_items ai, k where ai.meeting_id = k.mtg),
              '>', 0, 't2 CONTROL: the target HAS agenda items');
select cmp_ok((select count(*)::int from public.meeting_attendees a, k
                where a.meeting_id = k.mtg and a.note is not null), '>', 0,
  't3 CONTROL: the target HAS attendees carrying notes');
select cmp_ok((select count(*)::int from public.meeting_attendees a, k
                where a.meeting_id = k.mtg and a.external_name is not null), '>', 0,
  't4 CONTROL: …and at least one EXTERNAL attendee, the redactable arm of the identity XOR');
select cmp_ok((select count(*)::int from public.meeting_closed_sessions s, k
                where s.meeting_id = k.mtg and s.label is not null), '>', 0,
  't5 CONTROL: the target HAS a labelled closed session');
select cmp_ok((select count(*)::int from public.meeting_minutes_jobs j, k
                where j.meeting_id = k.mtg and j.transcript is not null), '>', 0,
  't6 CONTROL: the target HAS a minutes job holding a transcript, in the non-purging `done` state');
-- ⛔ ASKS THE DOOR'S OWN PREDICATE, NOT THE `memberships` ROW. This first read
-- `mm.role = 'staff_admin'` straight off the table, which certifies MEMBERSHIP and not
-- ADMISSIBILITY — the same distinction `lint:memberships-door` enforces in `src/`,
-- recurring here where no lint gate reaches. `app.has_role`'s final conjunct requires
-- the probed role to equal `app.active_role()`, so a principal holding a `staff_admin`
-- row AND another role derives no hat and is REFUSED by the door while the old
-- assertion stayed green. Constructed: forcing the anchor onto the multi-role
-- `Qualidade e Segurança` staff_admin reds 16 tests, t8 dies `42501` — and the old t7
-- passed throughout, certifying a persona the door would refuse.
--
-- ⚠ PROBED UNDER THE PERSONA'S OWN CLAIMS, NOT AS SUPERUSER. `has_role` short-circuits
-- its hat conjunct when `p_user_id is distinct from auth.uid()`, so a superuser probe
-- answers a DIFFERENT question and returns a reassuring result for principals the door
-- refuses. `claims_for` first, then the predicate.
select test_helpers.claims_for((select uid from k), false);
set local role authenticated;
select ok(app.is_staff_admin_of((select comm from k)),
  't7 ⭐ CONTROL: the persona passes THE DOOR''S OWN GATE under its own claims — not merely "has a staff_admin row". This is what makes t8 reach the redactions instead of stopping at a 42501, and it is the assertion that reds if the anchor ever lands on a multi-role principal whose active_role derives to NULL');
reset role;

-- ── THE DOOR RUNS ───────────────────────────────────────────────────────────────────
select test_helpers.claims_for((select uid from k), false);
set local role authenticated;
select lives_ok(
  format('select public.dispose_meeting_minutes(%L::uuid, %L)', (select mtg from k), 'subject_request'),
  't8 the erasure door COMPLETES on a locked meeting carrying every child-table text column');
reset role;

-- ── PINS: the target's free text is gone ────────────────────────────────────────────
select is((select count(*)::int from public.meeting_agenda_items ai, k
            where ai.meeting_id = k.mtg and ai.title is distinct from k.redacted), 0,
  't9 ⭐ agenda item TITLE is redacted — the sharp one: three of this table''s four text columns were already redacted and `title` survived them');
select is((select count(*)::int from public.meeting_attendees a, k
            where a.meeting_id = k.mtg and a.note is not null and a.note is distinct from k.redacted), 0,
  't10 attendee NOTE is redacted');
select is((select count(*)::int from public.meeting_attendees a, k
            where a.meeting_id = k.mtg and a.external_name is not null
              and a.external_name is distinct from k.redacted), 0,
  't11 attendee EXTERNAL_NAME is redacted — a named non-staff person in the room');
select is((select count(*)::int from public.meeting_attendees a, k
            where a.meeting_id = k.mtg and a.external_org is not null
              and a.external_org is distinct from k.redacted), 0,
  't12 attendee EXTERNAL_ORG is redacted — it sits beside external_name and was missing from the filing''s four-column list');
select is((select count(*)::int from public.meeting_closed_sessions s, k
            where s.meeting_id = k.mtg and s.label is not null and s.label is distinct from k.redacted), 0,
  't13 closed-session LABEL is redacted');
select is((select count(*)::int from public.meeting_minutes_jobs j, k
            where j.meeting_id = k.mtg and j.transcript is not null), 0,
  't14 ⭐ minutes-job TRANSCRIPT is nulled — the verbatim record of everything said in the room, which the three purge doors never reach in the `done` state');
select is((select count(*)::int from public.meeting_minutes_jobs j, k
            where j.meeting_id = k.mtg and j.draft is not null), 0,
  't15 minutes-job DRAFT (jsonb) is nulled — free text is not a type; a text/varchar census misses this column');
select is((select count(*)::int from public.meeting_minutes_jobs j, k
            where j.meeting_id = k.mtg and j.result is not null), 0,
  't16 minutes-job RESULT (jsonb) is nulled');
select is((select count(*)::int from public.meeting_minutes_jobs j, k
            where j.meeting_id = k.mtg and j.purged_at is null), 0,
  't17 …and the job is stamped purged_at, so the audio lifecycle agrees with the disposal');

-- ── VACUITY CONTROLS: the SIBLING meeting is untouched ──────────────────────────────
-- Without these, every pin above is equally satisfied by `delete from <table>` or by an
-- unfiltered `update ... where true`.
select is((select count(*)::int from public.meeting_agenda_items ai, k
            where ai.meeting_id = k.sib and ai.title = k.redacted), 0,
  't18 ⭐ VACUITY CONTROL: the sibling meeting''s agenda titles are NOT redacted — t9 would pass against a door that redacted every row in the table');
select is((select count(*)::int from public.meeting_attendees a, k
            where a.meeting_id = k.sib
              and (a.note = k.redacted or a.external_name = k.redacted or a.external_org = k.redacted)), 0,
  't19 ⭐ VACUITY CONTROL: the sibling''s attendee text survives intact');
select is((select count(*)::int from public.meeting_closed_sessions s, k
            where s.meeting_id = k.sib and s.label = k.redacted), 0,
  't20 ⭐ VACUITY CONTROL: the sibling''s closed-session label survives intact');
select is((select count(*)::int from public.meeting_minutes_jobs j, k
            where j.meeting_id = k.sib
              and (j.transcript is null or j.draft is null or j.result is null)), 0,
  't21 ⭐ VACUITY CONTROL: the sibling''s transcript, draft and result all survive — t14-t16 would pass against an unfiltered `update ... set transcript = null`');

-- ── THE IDENTITY-XOR KEYSTONE ───────────────────────────────────────────────────────
-- ⛔ THIS ASSERTION IS A DIFFERENTIAL ON PURPOSE, AND THE FIRST VERSION OF IT WAS
-- VACUOUS. It read `count(user_id is not null and external_name is not null) = 0`.
-- Mutation-proven worthless: with the door's conditional branch replaced by an
-- unconditional `external_name = v_redacted`, the identity XOR raises, the whole
-- disposal rolls back, the fixture rows are therefore UNCHANGED — and an unchanged
-- internal attendee still has a NULL external_name, so the pin stayed GREEN while the
-- door was completely broken. It was asserting a property the CHECK constraint
-- guarantees structurally, which no mutation can ever falsify.
-- The differential below instead requires the row to have been TOUCHED (its note is
-- redacted, proving it was inside the UPDATE's scope) WHILE its external_name stayed
-- NULL. That separates "preserved correctly" from "preserved because nothing ran",
-- and it goes red on the abort. The fixture builds exactly one internal attendee.
select is((select count(*)::int from public.meeting_attendees a, k
            where a.meeting_id = k.mtg and a.user_id is not null
              and a.note = k.redacted and a.external_name is null), 1,
  't22 ⭐ the INTERNAL attendee was redacted in `note` AND kept external_name NULL. `meeting_attendees_identity_xor` forbids user_id and external_name coexisting, so an unconditional redaction violates the CHECK and aborts the WHOLE disposal — a legal obligation failing closed on every meeting that had an internal attendee');

-- ── REGRESSION: what ADR 0056 §2 already promised still holds ───────────────────────
select is((select minutes_md from public.meetings m, k where m.id = k.mtg), null,
  't23 minutes_md is still nulled');
select is((select count(*)::int from public.meeting_agenda_items ai, k
            where ai.meeting_id = k.mtg
              and (ai.description is distinct from k.redacted
                or ai.discussion_notes is distinct from k.redacted
                or ai.resolution is distinct from k.redacted)), 0,
  't24 the three originally-redacted agenda columns are still redacted');
-- ⛔ ASSERTED IN THE POSITIVE, AND THE NEGATIVE FORM WAS VACUOUS. This first read
-- `count(rows where summary = redacted or decision = redacted) = 0`, which an EMPTY
-- meeting_cases set satisfies perfectly — and the fixture insert above is the suite's
-- only conditional one, so the set really could be empty. Proven by construction:
-- forcing that insert to match nothing left the suite fully green. Counting rows that
-- still carry their EXACT original text and requiring 1 fails BOTH ways — if the
-- fixture row is missing (0 ≠ 1) and if the door redacted it (0 ≠ 1) — so the pin
-- cannot pass by having no subject. Same family as t22: the tell was the fixture, not
-- the assertion.
select is((select count(*)::int from public.meeting_cases mc, k
            where mc.meeting_id = k.mtg
              and mc.summary = 'Resumo do caso com PHI'
              and mc.decision = 'Decisão do caso com PHI'), 1,
  't25 ⭐ meeting_cases.{summary,decision} still hold their ORIGINAL text — NOT touched by the meeting door. ADR 0056 §2 decouples them to `dispose_case_phi`, per case, because one meeting discusses many. Pinned so widening it later is a decision, not a side effect');

-- ── DEPTH-2: THE CLOSED-SESSION ITEMS (the new stand-aside's lane) ──────────────────
select cmp_ok((select count(*)::int from public.meeting_closed_session_items i
                join public.meeting_closed_sessions s on s.id = i.closed_session_id, k
               where s.meeting_id = k.mtg), '>', 0,
  't26 CONTROL: the target still HAS closed-session item rows after disposal — erasure here is redaction, not deletion, so t27-t29 cannot be satisfied by an empty table');
select is((select count(*)::int from public.meeting_closed_session_items i
            join public.meeting_closed_sessions s on s.id = i.closed_session_id, k
           where s.meeting_id = k.mtg and i.substance is not null
             and i.substance is distinct from k.redacted), 0,
  't27 ⭐ closed-session SUBSTANCE is redacted — the most sensitive deliberation text in the aggregate, and unreachable before this migration because its guard had no stand-aside');
select is((select count(*)::int from public.meeting_closed_session_items i
            join public.meeting_closed_sessions s on s.id = i.closed_session_id, k
           where s.meeting_id = k.mtg and i.decision is not null
             and i.decision is distinct from k.redacted), 0,
  't28 closed-session DECISION is redacted');
select is((select count(*)::int from public.meeting_closed_session_items i
            join public.meeting_closed_sessions s on s.id = i.closed_session_id, k
           where s.meeting_id = k.mtg and i.withdrawals is not null
             and i.withdrawals is distinct from k.redacted), 0,
  't29 closed-session WITHDRAWALS is redacted');
select is((select count(*)::int from public.meeting_closed_session_items i
            join public.meeting_closed_sessions s on s.id = i.closed_session_id, k
           where s.meeting_id = k.sib
             and (i.substance = k.redacted or i.decision = k.redacted or i.withdrawals = k.redacted)), 0,
  't30 ⭐ VACUITY CONTROL: the sibling meeting''s closed-session items survive intact');

-- ── THE OVER-GRANT TWIN: the new stand-aside is exactly one door wide ───────────────
-- Run as the suite's default (superuser) role so RLS cannot be the party refusing — the
-- trigger is then the only thing that can raise, and these cannot pass for an unrelated
-- permission failure. Discriminating on the guard's MESSAGE, not just on 23514, because
-- sibling doors raise check_violation for other reasons too.
select throws_ok(
  format('update public.meeting_closed_session_items set substance = %L where closed_session_id = %L::uuid',
         'probe', (select sess from k)),
  '23514', (select locked_msg from k),
  't31 ⭐ a bare UPDATE on a locked meeting''s closed-session items is STILL refused immediately after the door ran — the lock stays load-bearing and the flag did not survive into the rest of the transaction');
select set_config('app.in_meeting_rpc', 'on', true);
select throws_ok(
  format('update public.meeting_closed_session_items set substance = %L where closed_session_id = %L::uuid',
         'probe', (select sess from k)),
  '23514', (select locked_msg from k),
  't32 ⭐ …and STILL refused with app.in_meeting_rpc = on — the flag all 26 sibling doors set. This is the widening ADR 0129 rejected, pinned out on the SECOND guard exactly as 348 t6 pins it on the first');
select set_config('app.in_meeting_rpc', 'off', true);

-- ── t25'S EXPLICIT NON-EMPTY CONTROL ────────────────────────────────────────────────
-- ⚠ POSITIONED LAST ON PURPOSE, not out of laziness. pgTAP numbers by execution order,
-- so inserting this beside t25 would renumber t26-t32 and silently invalidate the
-- `351` t8 / t25 / t31 / t32 citations in ADR 0056 Amdt 1 and ADR 0129 Amdt 1 —
-- manufacturing the stale-record defect this slice keeps fixing. Order does not affect
-- the conjunction: nothing between t25 and here writes `meeting_cases`, and the suite
-- is a single transaction. `351:31`'s rule (every pin paired with a non-empty control)
-- is satisfied by t25's own positive form AND by this; belt and braces, because this
-- pin is what two ADR sentences rest on.
select is((select count(*)::int from public.meeting_cases mc, k where mc.meeting_id = k.mtg), 1,
  't33 ⭐ CONTROL for t25: the meeting_cases fixture row EXISTS. The anchor now requires a commission with at least one case, so this is unconditional — if it ever reads 0, t25 is asserting over an empty set and is worthless rather than wrong');

select * from finish();
rollback;

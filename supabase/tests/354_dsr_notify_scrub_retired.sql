-- =============================================================================
-- 354 — ADR 0130 Amendment 4 reaches the CODE: `notify_scrub_check` is no longer
--       minted, and the HCDS4 gate it used to jam is UNCHANGED.
--
-- WHAT WAS BROKEN. `create_dsr_request` unconditionally minted one
-- `notify_scrub_check` task, and `close_dsr_request` raises HCDS4 while ANY task is
-- `pending` on a `granted`/`granted_partial` outcome. So **every granted LGPD subject
-- request was blocked until a human attested to a residue class the program itself
-- proved absent** — and the attestation text asserts, in a legal record, that a residue
-- was checked which cannot exist. Amendment 4 WITHDREW Decision 9 on 2026-08-20; the
-- withdrawal reached the ADR and never reached the code.
--
-- ⚠ THE WITHDRAWAL'S RECORDED RATIONALE IS INCOMPLETE, AND THIS SUITE DOES NOT REPEAT
-- IT. Amendment 4 item 1 argues `notifications.entity_type` does not admit
-- `case`/`referral`/`event`. True, and not sufficient: it DOES admit `meeting` and
-- `capa_action`, both of which the disposal doors touch. The complete argument is a
-- census of the WRITERS (16 callers / 25 call sites of `app.enqueue_notification`, the
-- only `insert into notifications` in the catalog): every admitted `entity_type`
-- reachable from a disposal door carries a TITLE as its body — `meetings.title`,
-- `capa_action.title` — which ADR 0131 Amendment 1's title invariant places OUT of
-- erasure scope, and which the doors deliberately never touch. The census lives in
-- migration `20261003000100`'s header; this suite pins the BEHAVIOUR.
--
-- ⭐ WHAT MUST NOT REGRESS, AND IS PINNED HERE:
--   · nothing mints the task any more (t3) — with a control proving that zero is a real
--     zero over a POPULATED request (t4) and that the counter can see such a row at all
--     (t5/t8). A "count = 0" assertion whose subject cannot exist is vacuous in the
--     strongest sense; t5 constructs the row and requires the same query to find it.
--   · a granted request now CLOSES (t10) — the differential that the jam is gone.
--   · ⛔ the HCDS4 gate ITSELF is untouched and still refuses (t12). Without this, t10
--     would be satisfied just as well by deleting the pending-task gate, which is a real
--     control on erasure completeness. What changed is what gets minted, not what closes.
--   · ⛔ the KIND stays valid (t6) and stays COMPLETABLE (t7) — historical rows must
--     remain legal and finishable. Retiring the MINTING must not strand the COMPLETION.
--
-- ⚠ ROLE CHOICE. Fixture construction runs as the suite's default (superuser) role;
-- every door call runs as the named Encarregado, because a door assertion satisfied by
-- an unrelated permission failure proves nothing.
-- =============================================================================

begin;
select plan(12);

create temp table f (
  hosp_a uuid, dpo uuid, req uuid, req2 uuid, probe_task uuid, scrub2 uuid
) on commit drop;
grant all on f to authenticated;

insert into f (hosp_a, dpo)
select '05000000-0000-0000-0000-00000000000a',
       (select id from public.profiles where email = 'staff1.ccih@test.local');

-- Without the flag every door raises HCDS1 and every keystone below would SKIP into a
-- green (pgtap-fixture-flag-gaps). Asserted, not assumed.
select is((select enabled from app.feature_flags where key = 'dsr'), true,
  't1 CONTROL: the `dsr` feature flag is ON — every assertion below is vacuous without it');
select is(app.is_dpo_of_for((select hosp_a from f), (select dpo from f)), true,
  't2 CONTROL: the seeded Encarregado really holds the office at Hospital A, so the door calls below reach their bodies instead of stopping at 42501');

-- ── THE REQUEST ─────────────────────────────────────────────────────────────────────
select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
update f set req = public.create_dsr_request(
  '05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-354-A');
reset role;

select is((select count(*)::int from public.dsr_tasks
            where request_id = (select req from f) and kind = 'notify_scrub_check'), 0,
  't3 ⭐⭐ KEYSTONE: a new subject request mints ZERO `notify_scrub_check` tasks — ADR 0130 Amendment 4''s withdrawal, in the code');
select cmp_ok((select count(*)::int from public.dsr_tasks where request_id = (select req from f)),
              '>', 0,
  't4 ⭐ CONTROL: …and the request DID mint tasks. Without this, t3 would pass equally well on a request that failed to enumerate anything, or on a door that raised — a real zero, over a populated request');

-- ⭐ THE POSITIVE CONTROL: prove the counter t3 uses can SEE such a row. A "count = 0"
-- whose subject is unconstructible is the strongest form of vacuous.
update f set probe_task = gen_random_uuid();
insert into public.dsr_tasks (id, request_id, kind, hospital_id, note)
select f.probe_task, f.req, 'notify_scrub_check', f.hosp_a, 'sonda de controle' from f;
select is((select count(*)::int from public.dsr_tasks
            where request_id = (select req from f) and kind = 'notify_scrub_check'), 1,
  't5 ⭐ POSITIVE CONTROL: inserting one `notify_scrub_check` row makes t3''s exact query read 1 — so t3''s zero is a measurement, not an unconstructible predicate');
select ok((select kind = 'notify_scrub_check' from public.dsr_tasks where id = (select probe_task from f)),
  't6 ⛔ …and that insert SUCCEEDED, which is the pin that `dsr_tasks_kind_check` still ADMITS the kind. Historical rows must stay valid; only the minting is retired');

-- ── THE KIND IS STILL COMPLETABLE (retiring the minting must not strand the row) ─────
select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select lives_ok(
  format($$ select public.complete_dsr_task(%L::uuid, 'Verificado; nenhum resíduo aplicável.') $$,
         (select probe_task from f)),
  't7 ⛔ a surviving `notify_scrub_check` row is still COMPLETABLE by the Encarregado — `complete_dsr_task` admits the kind exactly as before');
reset role;

delete from public.dsr_tasks where id = (select probe_task from f);
select is((select count(*)::int from public.dsr_tasks
            where request_id = (select req from f) and kind = 'notify_scrub_check'), 0,
  't8 …and removing the probe returns the counter to the state t3 measured');

-- ── THE JAM IS GONE: a granted request CLOSES ───────────────────────────────────────
-- Fixture completion, not a door assertion: the mechanism by which the module and
-- attestation tasks reach `done` is 349/350's subject, not this suite's. The
-- attestation columns are set because `dsr_tasks_attestation_shape` requires them on a
-- done `attest_review`.
--
-- ⛔⛔ THE `kind <> 'notify_scrub_check'` FILTER IS THE WHOLE DIFFERENTIAL, AND ITS
-- ABSENCE WAS A REAL VACUITY IN THIS FILE'S FIRST DRAFT — caught by asking what the
-- mutation would do, not by the suite going green (it did go green). Completing EVERY
-- pending task models an executor who also attested to the phantom residue, which is
-- precisely the work this change removes; t10 would then have passed identically with the
-- task still minted, and would have pinned nothing at all. Completing everything EXCEPT
-- the scrub models the REAL executor: before this change one pending row survived here
-- and HCDS4 refused the close; after it, there is no such row. t9 is that row's absence,
-- stated as a count.
update public.dsr_tasks
   set status = 'done', completed_at = now(),
       attested_by_name = case when kind = 'attest_review' then 'Revisor 354' end,
       attested_redactions = case when kind = 'attest_review' then 0 end
 where request_id = (select req from f)
   and status = 'pending'
   and kind <> 'notify_scrub_check';

select is((select count(*)::int from public.dsr_tasks
            where request_id = (select req from f) and status = 'pending'), 0,
  't9 ⭐ CONTROL/DIFFERENTIAL: with every task an executor can actually finish now done, NOTHING is pending. Before this change a `notify_scrub_check` sat here, pending, minted by nobody''s request');

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select public.adjudicate_dsr_request((select req from f), 'granted', null, 'Parecer 354/2026');
select lives_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'granted', null, 'Parecer 354/2026') $$,
         (select req from f)),
  't10 ⭐⭐ KEYSTONE: a GRANTED request closes. Before this change it could not: the unminted-by-nobody `notify_scrub_check` sat pending and HCDS4 refused every granted close');
reset role;

select ok((select status = 'closed' and outcome = 'granted' and closed_at is not null
             from public.dsr_requests where id = (select req from f)),
  't11 …and the request really is CLOSED as granted — t10 alone would be satisfied by a door that returns without writing');

-- ── ⛔ THE GATE ITSELF IS UNTOUCHED (the over-grant twin) ────────────────────────────
-- t8 is satisfied just as well by DELETING the pending-task gate, which is a real
-- control on erasure completeness. This is the half that pins it out.
select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
update f set req2 = public.create_dsr_request(
  '05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-354-B');
reset role;

update f set scrub2 = gen_random_uuid();
insert into public.dsr_tasks (id, request_id, kind, hospital_id, note)
select f.scrub2, f.req2, 'notify_scrub_check', f.hosp_a, 'residuo pendente' from f;

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select public.adjudicate_dsr_request((select req2 from f), 'granted', null, 'Parecer 354-B/2026');
select throws_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'granted', null, 'Parecer 354-B/2026') $$,
         (select req2 from f)),
  'HCDS4', null,
  't12 ⛔ OVER-GRANT TWIN: with a task still PENDING, the granted close is STILL refused HCDS4. The gate is unchanged — what this change retires is the minting, not the completeness guarantee');
reset role;

select * from finish();
rollback;

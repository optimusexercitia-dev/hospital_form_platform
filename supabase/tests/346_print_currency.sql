-- =============================================================================
-- CURRENCY — derived at read time, never stamped. ADR 0126 D2/D3/D4/D9/D11 + the
-- disposal conjunct. Migration 20260928001400.
--
--   current ⇔ the source STILL satisfies the registration predicate  (conjunct 1)
--             AND the source is still the HEAD of its series          (conjunct 2)
--
-- ⛔⛔ CURRENCY KEYSTONES MUST BE TWO-SIDED, PER CONJUNCT. A predicate stubbed
-- "always current" passes every not-current test that only asserts the negative;
-- one stubbed "never current" passes every positive one. And a test that fails
-- BOTH conjuncts at once cannot tell you which one is load-bearing — so each is
-- ISOLATED here, with the other held true:
--
--   conjunct 1 isolated — DISPOSAL: registers ✗ while the revision is untouched,
--     so head stays ✓. (The reopen corridor fails BOTH at once and therefore
--     isolates neither, which is why it is not used for this.)
--   conjunct 2 isolated — THE D9 ROUND TRIP: reopen bumps the epoch, then the
--     meeting is re-advanced to a REGISTERING state, so registers is ✓ again and
--     ONLY the revision mismatch remains.
--
-- ⚠ The bound this suite does NOT claim: currency answers "is this print of the
-- current REVISION of the source record", NOT "would a re-render be
-- byte-identical". For meetings those differ by construction.
-- =============================================================================

begin;
select plan(27);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table k on commit drop as
  select (v->>'st_x')::uuid as st_x, (v->>'sa_x')::uuid as sa_x,
         -- A READER-NON-CREATOR: same commission, plain staff. authz-handoff §7
         -- requires the probe principal be exactly this, never a foreign one —
         -- a foreign principal would be refused by tenancy and the keystone would
         -- pass without the door's own gate ever deciding anything.
         (v->>'st_x2')::uuid as st_x2,
         (v->>'comm_x')::uuid as comm_x, (v->>'ver_u')::uuid as ver_u
  from ctx;
grant select on k to authenticated;

-- Two meetings with NO agenda items. ⚠ This was once FORCED: `dispose_meeting_minutes`
-- used to RAISE on a locked meeting that had agenda items, so the disposal leg below was
-- only constructible on an agenda-free meeting. ✅ Fixed 2026-08-19 by ADR 0129 (the
-- narrow `app.in_disposal_rpc` stand-aside); the constraint is gone and agenda items
-- would no longer break this fixture. They are still omitted here only because this
-- suite is about print CURRENCY and does not need them — the locked-with-agenda
-- population is covered by `348_disposal_flag_meeting_child_lock`.
create temp table mm on commit drop as
  select '00000000-0000-0000-0000-0000000c0a01'::uuid as m_disp,
         '00000000-0000-0000-0000-0000000c0a02'::uuid as m_rev,
         '00000000-0000-0000-0000-0000000c0b01'::uuid as p_disp,
         '00000000-0000-0000-0000-0000000c0b02'::uuid as p_rev0,
         '00000000-0000-0000-0000-0000000c0b03'::uuid as p_rev1,
         -- §5's fixture: a meeting that is actually DELETABLE. m_disp sits at
         -- in_signature, which `guard_meeting_status` refuses to DELETE outright
         -- (in_signature|signed|distributed|cancelled) — so a differential built
         -- on it can never succeed, and would be measuring the WRONG guard.
         '00000000-0000-0000-0000-0000000c0a03'::uuid as m_del,
         '00000000-0000-0000-0000-0000000c0b04'::uuid as p_del;
grant select on mm to authenticated;

insert into public.meetings (id, commission_id, title, scheduled_start, minutes_md)
select mm.m_disp, k.comm_x, 'Ata para descarte', now(), 'Deliberações.' from mm, k;
insert into public.meetings (id, commission_id, title, scheduled_start, minutes_md)
select mm.m_rev, k.comm_x, 'Ata para reabertura', now(), 'Deliberações.' from mm, k;
insert into public.meetings (id, commission_id, title, scheduled_start, minutes_md)
select mm.m_del, k.comm_x, 'Ata para exclusão', now(), 'Deliberações.' from mm, k;

-- WALKED, not set: guard_meeting_status admits no jumps.
select set_config('app.in_meeting_rpc', 'on', true);
update public.meetings set status = 'held'         where id in ((select m_disp from mm), (select m_rev from mm), (select m_del from mm));
update public.meetings set status = 'in_signature' where id in ((select m_disp from mm), (select m_rev from mm), (select m_del from mm));
select set_config('app.in_meeting_rpc', 'off', true);

insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(x), jsonb_build_object('size', 1024, 'mimetype', 'application/pdf')
from (select p_disp as x from mm union all select p_rev0 from mm union all select p_rev1 from mm union all select p_del from mm) s;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mint_printed_document((select p_disp from mm), 'meeting', (select m_disp from mm),
  'meeting', 1, repeat('ab', 32), 'CURTOKEN1AAAABBBBCCCCDDDDEEEEFFFF', 'AAAABB2345', false, 0);
select public.mint_printed_document((select p_rev0 from mm), 'meeting', (select m_rev from mm),
  'meeting', 1, repeat('ab', 32), 'CURTOKEN2AAAABBBBCCCCDDDDEEEEFFFF', 'AAAACC2345', false, 0);
select public.mint_printed_document((select p_del from mm), 'meeting', (select m_del from mm),
  'meeting', 1, repeat('ab', 32), 'CURTOKEN4AAAABBBBCCCCDDDDEEEEFFFF', 'AAAAEE2345', false, 0);
reset role;

-- ── 1. THE POSITIVE SIDE (both conjuncts true) ──────────────────────────────
select is(app.printed_document_is_current((select p_disp from mm)), true,
  't1 ⭐ POSITIVE: a fresh print of an in_signature ata IS current — registers ✓, head ✓. '
  'Without this leg every negative below is satisfied by a predicate stubbed to "never current"');
select is(app.printed_document_is_current((select p_rev0 from mm)), true,
  't2 POSITIVE (the second fixture, before its round trip)');
select is((select source_revision from public.printed_documents where id = (select p_rev0 from mm)), 0,
  't3 the mint stored the observed revision (0)');

-- ── 2. CONJUNCT 1 ISOLATED — disposal: registers ✗ while head stays ✓ ───────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.dispose_meeting_minutes((select m_disp from mm), 'retention_expired');
reset role;

select is((select status from public.meetings where id = (select m_disp from mm)), 'in_signature',
  't4 ⭐ NON-VACUITY CONTROL: disposal did NOT change the status. The meeting is still in a '
  'REGISTERING status and its revision is untouched, so conjunct 2 is still TRUE — which is '
  'what makes t5 a test of conjunct 1 alone');
select is(app.print_source_head('meeting', (select m_disp from mm),
            (select source_revision from public.printed_documents where id = (select p_disp from mm))), true,
  't5a the head conjunct is still TRUE after disposal (asserted, not assumed)');
select is(app.printed_document_is_current((select p_disp from mm)), false,
  't5 ⭐⭐ CONJUNCT 1: a DISPOSED ata''s print is NOT current. dispose_meeting_minutes nulls '
  'minutes_md without touching status or revision, so without the disposal term this print '
  'would read "autêntico e atual" over content that no longer exists');

-- ── 3. CONJUNCT 2 ISOLATED — the D9 round trip ──────────────────────────────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_meeting((select m_rev from mm));
reset role;
-- Re-advance so the source REGISTERS AGAIN: this is what isolates conjunct 2.
select set_config('app.in_meeting_rpc', 'on', true);
update public.meetings set status = 'in_signature' where id = (select m_rev from mm);
select set_config('app.in_meeting_rpc', 'off', true);

select is(app.print_source_registers('meeting', (select m_rev from mm)), true,
  't6 ⭐ NON-VACUITY CONTROL: after reopen -> re-advance the source REGISTERS AGAIN — conjunct 1 '
  'is back to TRUE, so t7 tests conjunct 2 alone. This is exactly the corridor 0126 D9 exists '
  'for: the registration predicate is satisfied again, with different content');
select is((select revision from public.meetings where id = (select m_rev from mm)), 1,
  't6b the epoch advanced (reopen_meeting is its only writer)');
select is(app.printed_document_is_current((select p_rev0 from mm)), false,
  't7 ⭐⭐ CONJUNCT 2: the OLD print is NOT current after the round trip. Its content_hash pins '
  'minutes that no longer exist. The STATUS is identical on both sides of this assertion — only '
  'the revision differs, which is why a set-membership test could never catch it');

-- The re-mint restores currency: the differential that stops t7 passing against a
-- predicate stubbed "meetings are never current".
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mint_printed_document((select p_rev1 from mm), 'meeting', (select m_rev from mm),
  'meeting', 1, repeat('cd', 32), 'CURTOKEN3AAAABBBBCCCCDDDDEEEEFFFF', 'AAAADD2345', false, 1);
reset role;

select is(app.printed_document_is_current((select p_rev1 from mm)), true,
  't8 ⭐ THE DIFFERENTIAL: re-minting at the NEW revision produces a print that IS current. '
  'Without it t7 is equally satisfied by "never current"');
select is((select status from public.printed_documents where id = (select p_rev0 from mm)), 'superseded',
  't9 the re-mint superseded the stale print (registry status is a DELIBERATE act — ADR 0126 D3)');

-- ── 4. `revoked` — NULL means NOT EVALUATED, and no source is joined ────────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.revoke_printed_document((select p_rev1 from mm), 'minted_in_error', 'teste de anulacao');
reset role;

select ok(app.printed_document_is_current((select p_rev1 from mm)) is null,
  't10 ⭐⭐ ADR 0126 D3/D4: a REVOKED print reports currency as NULL — NOT EVALUATED, which is a '
  'different fact from false (evaluated, and stale). Collapsing them would tell a paper-holder '
  'the page is "not current" when the honest answer is ANULADO');

-- ⭐ The NO-JOIN independence `312` t76 pins, asserted structurally rather than
-- described: the revoked arm must not consult the source at all.
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'printed_document_is_current')
    ~ 'if v_row\.status = ''revoked'' then\s+return null;',
  't11 ⭐ NO-JOIN INDEPENDENCE: the revoked arm short-circuits BEFORE any source lookup — read '
  'from pg_proc, not from the migration text. This is what lets a paper-holder verify a document '
  'whose source was later discarded');

-- ── 5. `guard_meeting_active_print` — the t76/t80-shaped differential ───────
-- ⚠ THE FIXTURE MUST BE A **REOPENED `held`** MEETING, and getting this wrong
-- measures the wrong guard. `guard_meeting_status` refuses a DELETE outright at
-- `in_signature|signed|distributed|cancelled`, so a differential built on a
-- locked meeting can never succeed — the first draft of this block used m_disp
-- and died with 23514 from that guard, with `guard_meeting_active_print` never
-- consulted. `held` is exactly the state ADR 0126 D11 names as the reachable
-- danger: a reopened meeting that still holds a registered print.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_meeting((select m_del from mm));
reset role;

select is((select status from public.meetings where id = (select m_del from mm)), 'held',
  't12a NON-VACUITY CONTROL: the meeting is now `held` — DELETABLE as far as guard_meeting_status '
  'is concerned, so whatever refuses the delete below is not that guard');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$delete from public.meetings where id = '00000000-0000-0000-0000-0000000c0a03'$$,
  'HC0DQ', null,
  't12 ⭐⭐ ADR 0126 D11: a reopened `held` meeting holding a live print CANNOT be deleted — '
  'guard_meeting_active_print, the exact symmetric of guard_response_active_print');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.revoke_printed_document((select p_del from mm), 'other', 'liberando a exclusao');
reset role;

select is(
  (select count(*)::int from public.printed_documents
    where source_kind = 'meeting' and source_id = (select m_del from mm)
      and status in ('active', 'superseded')), 0,
  't13 NON-VACUITY CONTROL: zero live prints remain — without this, t14 could pass because the '
  'revoke silently failed and the guard was never the thing that changed');

-- ⭐⭐ THE DIFFERENTIAL, AND ITS EXPECTED CODE IS THE FINDING. With the print
-- revoked, `guard_meeting_active_print` NO LONGER FIRES — proving it discriminates
-- on print status rather than blocking every meeting delete. The delete still
-- fails, but with **23503**: deleting the meeting fires
-- `trg_drop_securable_resource`, and the mint's own `documents` row still
-- references that securable resource under `documents_home_resource_id_fkey`
-- ON DELETE RESTRICT.
--
-- ⚠ That is not a weaker assertion than "the delete succeeds" — it is a MORE
-- precise one, and it pins ADR 0126 D11's actual argument: the anchor holding
-- today is two hops over and OWNED BY THE DOCUMENTS DOMAIN. The day the disposal
-- program (C1a/C1b) deletes document rows, this 23503 disappears and
-- `guard_meeting_active_print` becomes the only thing standing between a reopened
-- meeting and an orphaned registry row. A changed SQLSTATE here is therefore a
-- signal worth reading, not a test to relax.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$delete from public.meetings where id = '00000000-0000-0000-0000-0000000c0a03'$$,
  '23503', null,
  't14 ⭐⭐ THE DIFFERENTIAL: with the print REVOKED the guard STANDS DOWN — the refusal is no '
  'longer HC0DQ but 23503 from the documents -> securable_resources RESTRICT. So the guard '
  'discriminates on status (not "blocks every delete"), AND the FK chain D11 names is measured '
  'rather than asserted');
reset role;

-- ── 6. THE TWO AUTHZ GATES — BLIND until now, and why the sweep missed them ──
-- ⭐⭐ `ARM=census` flagged these as UNKNOWN, and the diff-scoped audit it
-- prescribes returned `BLIND: 0` **vacuously**: that harness enumerates candidate
-- gates by a NAME PREFIX (`^(is_|can_|has_|…)`) over `bool`-returning functions.
-- `print_source_state` and `printed_document_currency` match neither — wrong
-- prefix, and both return TABLE rather than bool. So the remediation was
-- structurally unable to see them AND reported success. Neutralized by hand:
-- both gates removed, full suite still PASSED. **Both were genuinely BLIND.**
--
-- Neither is an unreachable backstop, so neither is allowlistable: both are
-- `authenticated`-reachable disclosures.
create temp table az on commit drop as
  select '00000000-0000-0000-0000-0000000c0c01'::uuid as resp_mine,   -- created by st_x2
         '00000000-0000-0000-0000-0000000c0c02'::uuid as resp_other,  -- created by st_x
         '00000000-0000-0000-0000-0000000c0d01'::uuid as pr_mine,
         '00000000-0000-0000-0000-0000000c0d02'::uuid as pr_other;
grant select on az to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select az.resp_mine, k.ver_u, k.comm_x, k.st_x2, 'submitted', now(), now() from az, k;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select az.resp_other, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from az, k;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(x), jsonb_build_object('size', 1024, 'mimetype', 'application/pdf')
from (select pr_mine as x from az union all select pr_other from az) s;

-- Each print is minted BY ITS OWN CREATOR — the only principal the door admits.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select public.mint_printed_document((select pr_mine from az), 'form_response', (select resp_mine from az),
  'form_response', 1, repeat('ab', 32), 'AZTOKEN1AAAABBBBCCCCDDDDEEEEFFFFG', 'BBBBCC2345', false);
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mint_printed_document((select pr_other from az), 'form_response', (select resp_other from az),
  'form_response', 1, repeat('ab', 32), 'AZTOKEN2AAAABBBBCCCCDDDDEEEEFFFFG', 'BBBBDD2345', false);
reset role;

-- ---- public.print_source_state -------------------------------------------
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.print_source_state('form_response', (select resp_other from az))),
  0,
  't15 ⭐⭐ BLIND GATE CLOSED — print_source_state: a principal who CANNOT view the source gets '
  'ZERO ROWS, not an error. An open gate hands any authenticated caller the status / '
  'correction_open / phase_voided / meeting_disposed of ANY source. The door''s own comment says '
  '"no row: no oracle" — until now that contract was stated and untested');

select is(
  (select count(*)::int from public.print_source_state('form_response', (select resp_mine from az))),
  1,
  't16 ⭐ THE DIFFERENTIAL: the SAME principal, in the same session, DOES get the row for a source '
  'he can view. Without this leg t15 is satisfied by a door stubbed to return nothing — which would '
  'also "pass" while silently removing the feature');
reset role;

-- ---- public.printed_document_currency ------------------------------------
-- ⭐ BOTH ids in ONE call, deliberately: that pins PER-ROW filtering. Two separate
-- calls would be equally satisfied by an all-or-nothing door that refuses whenever
-- any id is unviewable.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.printed_document_currency(
     array[(select pr_other from az), (select pr_mine from az)])
    where id = (select pr_other from az)),
  0,
  't17 ⭐⭐ BLIND GATE CLOSED — printed_document_currency: an id the caller CANNOT view is ABSENT '
  'from the result. An open gate returns currency for arbitrary print ids, leaking existence and '
  'state across tenants');

select is(
  (select count(*)::int from public.printed_document_currency(
     array[(select pr_other from az), (select pr_mine from az)])
    where id = (select pr_mine from az)),
  1,
  't18 ⭐ THE DIFFERENTIAL, SAME CALL, SAME ARRAY: the viewable id IS present. Filtering is per-row, '
  'not all-or-nothing — and t17 cannot pass by the door simply returning nothing');
reset role;

-- ── 7. B1 — A LOCKED SOURCE IS NOT PREVIEWABLE (qa blocker) ─────────────────
-- ADR 0125 D5's fourth cell has TWO directions. `documentProvenance` blocks
-- FINAL+prévia by type narrowing; nothing blocked REGISTERING+prévia, because
-- that guard fires only on `watermark !== 'draft'` and an in_signature ata is
-- `draft`. D5's stated mechanism — "a locked source always registers" — held for
-- form_response ONLY because Amendment 2 made its two axes re-coincide, i.e. by
-- EXPLOITING the coincidence both ADRs say to record and not exploit.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.log_document_previa('meeting', (select m_rev from mm), 'meeting')$$,
  'HC0DV', null,
  't19 ⭐⭐ B1: an in_signature ata is REFUSED a prévia (HC0DV). It REGISTERS under D1, so it must '
  'be EMITTED — serving it under a footer that says "sem valor de registro" would disclaim a page '
  'the platform is about to treat as a record. Enforced in the DOOR, not the route: the route logs '
  'BEFORE it streams, so a refusal here means NO BYTES LEAVE (Architecture Rule 1)');

select lives_ok(
  $$select public.log_document_previa('meeting', (select m_del from mm), 'meeting')$$,
  't20 ⭐ THE DIFFERENTIAL: a `held` ata (reopened, not locked) still GETS its prévia. Without this '
  'leg t19 is satisfied by a door that refuses every prévia — which would silently delete ADR 0125 '
  'D2''s protected interest, paper on demand for an incomplete artifact');
reset role;

-- ── 8. B2 — the form_response HEAD arm, two-sided PER LANE (qa blocker) ─────
-- ⛔ Measured by qa: `print_source_head('form_response', …)` had EXACTLY ONE call
-- in the whole tree (344:229, expecting true), and every other head/currency probe
-- used a meeting. A stub returning `true` for this arm passed 6514 pgTAP, 1439
-- vitest and 20/20 E2E — so D2 row 3 ("R2 approved, nobody minted revision 2")
-- had no coverage, and the `isCurrent: true` defect shipped its fix with no
-- regression test. My own backlog entry claimed this arm was pinned; every pin it
-- named was a MEETING pin. That is where the unearned pass was hiding.
create temp table hh on commit drop as
  select '00000000-0000-0000-0000-0000000c0e01'::uuid as r_std,   -- standalone predecessor
         '00000000-0000-0000-0000-0000000c0e02'::uuid as r_std_s, -- its successor
         '00000000-0000-0000-0000-0000000c0e03'::uuid as r_ph,    -- phase-bound predecessor
         '00000000-0000-0000-0000-0000000c0e04'::uuid as r_ph_s,  -- its successor
         '00000000-0000-0000-0000-0000000c0f01'::uuid as case_h,
         '00000000-0000-0000-0000-0000000c0f02'::uuid as phase_h,
         '00000000-0000-0000-0000-0000000c0f03'::uuid as cr_h;

-- ⚠ CLEAR THE SESSION CLAIMS FIRST. `test_helpers.claims_for` sets
-- `request.jwt.claims` for the SESSION, and §7 above left `st_x` — a plain staff
-- member — in effect. `guard_supersession_coherent`'s standalone arm reads
-- `auth.uid()` and refuses a non-staff_admin with 42501, so these fixture inserts
-- die on an authority check they never meant to exercise. The DEFINER/migration
-- path (`auth.uid()` null) is what the guard trusts (ADR 0075). Second time this
-- exact trap has bitten in this build — it is a property of the session, not of
-- any one file.
select set_config('request.jwt.claims', null, true);

-- ---- LANE 1: STANDALONE (Amendment 1 §A — the extension, previously uncovered)
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select hh.r_std, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from hh, k;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, supersedes_id)
select hh.r_std_s, k.ver_u, k.comm_x, k.sa_x, 'in_progress', now(), hh.r_std from hh, k;

select is(app.print_source_head('form_response', (select r_std from hh), 0), true,
  't21 ⭐⭐ STANDALONE LANE, differential side: a predecessor whose successor is merely IN_PROGRESS '
  'is STILL HEAD. That is app.submitted_form_responses'' own rule — "a half-finished correction '
  'never blanks the metric" — and the reason §A chose it: currency must NOT flap on a low-authority '
  'act like creating a draft');

select set_config('app.in_submit_rpc', 'on', true);
update public.responses set status = 'submitted', submitted_at = now() where id = (select r_std_s from hh);
select set_config('app.in_submit_rpc', 'off', true);

select is(app.print_source_head('form_response', (select r_std from hh), 0), false,
  't22 ⭐⭐ STANDALONE LANE: once the successor is SUBMITTED the predecessor is NOT HEAD. Amendment 1 '
  '§A — supersede_response creates a standalone successor with NO correction request, so D8 as '
  'written left a corrected original head forever and its stale print read "atual"');

-- ---- LANE 2: PHASE-BOUND (D8 verbatim — head turns at the APPROVAL door)
insert into public.cases (id, commission_id, organization_id, case_number)
select hh.case_h, k.comm_x, c.organization_id, 990501
  from hh, k, public.commissions c where c.id = k.comm_x;
select set_config('app.in_case_rpc', 'on', true);
insert into public.case_phases (id, case_id, position, form_id, form_version_id, status)
select hh.phase_h, hh.case_h, 1, fv.form_id, k.ver_u, 'active'
  from hh, k, public.form_versions fv where fv.id = k.ver_u;
select set_config('app.in_case_rpc', 'off', true);

insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at, submitted_at)
select hh.r_ph, k.ver_u, k.comm_x, k.st_x, 'submitted', hh.phase_h, now(), now() from hh, k;
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set current_response_id = (select r_ph from hh) where id = (select phase_h from hh);
select set_config('app.in_case_rpc', 'off', true);

insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at, submitted_at, supersedes_id)
select hh.r_ph_s, k.ver_u, k.comm_x, k.st_x, 'submitted', hh.phase_h, now(), now(), hh.r_ph from hh, k;
select set_config('app.in_correction_rpc', 'on', true);
insert into public.case_correction_requests
  (id, case_id, commission_id, case_phase_id, kind, reason, classification, requested_by,
   permitted_corrector, draft_response_id, status)
select hh.cr_h, hh.case_h, k.comm_x, hh.phase_h, 'correction', 'vetor', 'clerical',
       k.sa_x, k.st_x, hh.r_ph_s, 'under_review' from hh, k;
select set_config('app.in_correction_rpc', 'off', true);

select is(app.print_source_head('form_response', (select r_ph from hh), 0), true,
  't23 ⭐⭐ PHASE-BOUND LANE, differential side: a submitted successor whose correction request is '
  'still UNDER_REVIEW leaves the predecessor HEAD. D8 rejected chain-tip semantics precisely for '
  'this — flipping at draft creation would flap a PUBLIC page on a low-authority act and disclose '
  'an in-flight correction to any paper-holder');

select set_config('app.in_correction_rpc', 'on', true);
update public.case_correction_requests set status = 'approved' where id = (select cr_h from hh);
select set_config('app.in_correction_rpc', 'off', true);

select is(app.print_source_head('form_response', (select r_ph from hh), 0), false,
  't24 ⭐⭐ PHASE-BOUND LANE: once the correction request is APPROVED the predecessor is NOT HEAD — '
  'head turns at the APPROVAL door (D8), the same door that moves case_phases.current_response_id. '
  'This is ADR 0126 D2 ROW 3, the conjunct the isCurrent defect violated and shipped without a '
  'regression test');

select * from finish();
rollback;

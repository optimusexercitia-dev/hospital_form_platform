-- TV — process-template VERSIONING keystones (ADR 0096; migrations 20260907000100..001100).
--
-- EVERY assertion here is MUTATION-PROVEN: the comment above each section names the
-- exact change that turns it red, and where a section forks, a probe per ARM
-- (ADR 0079 Amendment 2 — one mutation certifies at most one arm and reports green
-- for the other).
--
-- ⚠ THE CONTROL-PAIR RULE (inherited from 296). A deny assertion passes on a broken
-- fixture: if the write would have failed anyway — missing column, wrong commission,
-- absent parent — `throws_ok` is satisfied for the wrong reason and proves nothing.
-- So deny arms here assert the SPECIFIC SQLSTATE, never merely that something raised,
-- and every mutation deny is paired with an assertion that the ROW SURVIVED.
--
-- MUTATION LEDGER — every assertion below was observed RED under at least one
-- probe, run against the live stack, not argued for in a comment:
--
--   m1  discard: drop `get diagnostics`/42501                -> FI1a
--   m2  discard: BARE row-count (drop the not-found guard)   -> FI1c, FI1d
--   m3  discard: disambiguate via the DEFINER helper         -> FI1d
--   m4  archive: drop `get diagnostics`/42501                -> FI2a
--   m5  archive: BARE row-count (drop the HC023 guard)       -> FI2d
--   m6  archive: update matches nothing for EVERYONE         -> FI2c-control, FI2d
--   p1  RLS write policy widened to `is_member_of`           -> FI1a, FI1b, FI2a,
--                                                               FI2b, FI2c-control
--   m7  drop DEFERRABLE from the phases position unique      -> RB1, RB2, RB3
--   m8  revert create_case's insert list to `template_id`    -> RB5, RB6
--   m9  make `reorder_template_phase` a no-op                -> RB2
--   m10 make ONLY the 'up' direction a no-op                 -> RB4
--   m11 make set_template_collects_patient update nothing    -> FL2
--
-- TENANT-ISOLATION probes (section TI). Each of the six policies the ADR-0079 diff
-- sweep reported BLIND is opened AND closed — one direction certifies the deny arm,
-- the other the allow arm, and neither certifies both (ADR 0079 Amendment 2). The
-- "open" direction is byte-for-byte what `p0-authz-door-audit.sh` does, so a green
-- sweep and a red keystone here are the same event seen from two sides:
--
--   p3  phases_select      using(true)                    -> TIP3
--   p4  phases_select      using(false)                   -> TIP2
--   p5  phases_write       using(true)  with check(true)  -> TIP3,TIP4,TIP5,TIP6,TIP7
--   p6  phases_write       using(false) with check(false) -> TIP1,TIP2,TIP6,TIP7
--   p7  narratives_select  using(true)                    -> TIN3
--   p8  narratives_select  using(false)                   -> TIN2
--   p9  narratives_write   using(true)  with check(true)  -> TIN3,TIN4,TIN5,TIN6,TIN7
--   p10 narratives_write   using(false) with check(false) -> TIN1,TIN2,TIN6,TIN7
--   p11 outcomes_select    using(true)                    -> TIO3
--   p12 outcomes_select    using(false)                   -> TIO2
--   p13 outcomes_write     using(true)  with check(true)  -> TIO3,TIO4,TIO5,TIO6,TIO7
--   p14 outcomes_write     using(false) with check(false) -> TIO1,TIO2,TIO6,TIO7
--
-- ⚠ HOW p6 WAS RUN, and why it is recorded differently from its eleven siblings.
-- Against the WHOLE file, p6 does not fail — it ABORTS. Closing the phases write
-- policy makes the FI section's `add_template_phase` fixture (line ~106, which
-- predates this section) raise 42501, so pg_prove reports "Bad plan: you planned
-- 37 tests but ran 0" and every TI assertion is unrun, not red. That is the p2
-- trap above recurring verbatim, one section later, and it is why the "reds" of a
-- probe must always be read next to its DENOMINATOR. So the twelve probes were
-- re-run against a TI-only extract of this section (the block below plus the
-- ctx/k fixture, plan(21)); every probe there reports ran=21, and the eleven that
-- also run cleanly against the whole file produce byte-identical red sets in both
-- harnesses — which is what makes the extract's p6 result usable rather than a
-- convenient one-off. A close-direction probe cannot be run whole-file here at
-- all: the fixture that would have to survive it is the very thing it disables.
--
-- ⚠ WHY BOTH DIRECTIONS, CONCRETELY. Opening the write policy CANNOT red TIP1
-- (an owner who could already insert still can), and closing it CANNOT red TIP4
-- (a foreigner refused by a wider policy is still refused by a narrower one).
-- Neither probe alone distinguishes "the policy names the right commission" from
-- "the policy denies everyone" — which is precisely the D11 failure this repo
-- shipped. Note also that closing `_select` leaves TIP6 GREEN: the FOR ALL write
-- policy is a second read path for the owner, so a `_select` regression is
-- observable ONLY through a non-admin member. That is what TI*2 exists for.
--
-- ⚠ m9 AND m10 BOTH EXIST BECAUSE ONE OF THEM WAS NOT ENOUGH — this is ADR 0079 A2's
-- fork rule in miniature. m7 (the swap raises) leaves RB4 green, because a reorder
-- that always fails leaves the order untouched, and so does m9 (a reorder that never
-- acts). Two opposite mutations, same green. Only m10 — down works, up silently does
-- nothing — distinguishes "swapped twice" from "never swapped" at the round trip.
-- A symmetric assertion is blind to symmetric failure; probe each DIRECTION, not just
-- each function.
--
-- ⚠ A REJECTED PROBE, recorded because it nearly passed as a result. `p2` set the
-- write policy to `using(false)` to prove FI2c-control. It reported "nothing red",
-- which reads as a vacuous keystone — but the deny-all policy stops the FIXTURE
-- from inserting v1 at all, so the suite aborted and ZERO tests ran. A harness
-- counting only `not ok` lines cannot tell 0-failed from 0-run; that is the repo's
-- "a gate summary can hide unrun tests" lesson reproduced inside the vacuity
-- harness itself. m6 replaces it with a probe narrow enough to leave the fixture
-- intact. When a probe reports green, check the DENOMINATOR before believing it.
--
-- Assertion count: 37

begin;
select plan(37);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'cases_extras', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u
  from ctx;
grant select on k to authenticated;

-- A published v1 + an open v2 draft in comm_x.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'TV Proc', null)).id as tid,
         null::uuid as v1, null::uuid as v2;
-- ADR 0096: `app.draft_version_of_template` is STABLE, so resolving it inside the
-- CREATE ... AS above would read the pre-statement snapshot and return NULL.
update tpl set v1 = app.draft_version_of_template(tid);
grant select on tpl to authenticated;
select public.add_template_phase((select v1 from tpl), (select form_u from k), 'Fase 1');
select public.publish_template_version((select v1 from tpl));
update tpl set v2 = public.clone_template_version((select v1 from tpl));
reset role;

-- ===========================================================================
-- FI — FEEDBACK INTEGRITY: a door must not report success for a mutation that
-- RLS silently ate (migration 20260907001100).
--
-- Measured before the fix: `discard_template_draft` returned 204 and
-- `archive_process_template` returned 200 for a plain `staff`, having changed
-- NOTHING. RLS held in both cases — this is not a privilege leak — but the
-- caller could not distinguish "done" from "denied", and Architecture Rule 1
-- makes the DB the boundary, so the TypeScript `authorizeCommission` pre-check
-- in `src/lib/process-templates/actions.ts` does not count as the answer.
--
-- ⚠ THE FORK, and why there are three arms and not one. Zero rows changed has
-- THREE causes that must not collapse onto one SQLSTATE:
--   (a) the row is visible to the caller but the WRITE policy denied them  -> 42501
--   (b) the row is genuinely absent / already in the target state          -> P0002 / HC023
--   (c) the row exists but is INVISIBLE to the caller (another tenant)     -> P0002
-- Arm (c) is the reason the fix resolves existence through the RLS-FILTERED read
-- that already runs FIRST, and NOT through `app.commission_of_template_version`.
-- That helper is SECURITY DEFINER; measured on this stack, it returns non-null for
-- a version the caller cannot select, so using it to disambiguate would turn every
-- cross-tenant probe into an existence oracle — trading this bug for a worse one.
-- Ordering is what separates (a) from (c): control only reaches the row-count check
-- when the caller has already demonstrated it can SEE the row, and telling a reader
-- "you may not write this" discloses nothing it does not already hold.
-- ===========================================================================

-- MUTATION (arm a): drop the `get diagnostics` / 42501 raise from
-- `discard_template_draft` -> t1 goes green-with-204 and reds here.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_template_draft(%L) $$, (select v2 from tpl)),
  '42501',
  null,
  'FI1a: a plain staff discarding a draft is REFUSED with 42501, not a silent 204'
);
reset role;

-- The control half. Without it, t1 passes on a fixture where v2 never existed.
select is(
  (select count(*)::int from public.process_template_versions where id = (select v2 from tpl)),
  1,
  'FI1b: the draft SURVIVED the plain-staff discard attempt'
);

-- MUTATION (arm b): map bare row_count=0 to 42501 -> this reds, because a
-- staff_admin deleting nothing would be told "sem permissão".
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.discard_template_draft('00000000-0000-0000-0000-0000000000fe'::uuid) $$,
  'P0002',
  null,
  'FI1c: discarding an ABSENT version is not-found (P0002), NOT 42501'
);
reset role;

-- MUTATION (arm c): disambiguate via app.commission_of_template_version instead of
-- the RLS-filtered read -> this reds with 42501, exposing the existence oracle.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_template_draft(%L) $$, (select v2 from tpl)),
  'P0002',
  null,
  'FI1d: a FOREIGN commission admin gets not-found (P0002) — no existence oracle'
);
reset role;

-- MUTATION (arm a): drop the `get diagnostics` / 42501 raise from
-- `archive_process_template` -> t5 goes green-with-200 and reds here.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  '42501',
  null,
  'FI2a: a plain staff archiving a template is REFUSED with 42501, not a silent 200'
);
reset role;

-- The control half: prove the versions are still live, so t5 cannot pass on a
-- template that was already archived.
select is(
  (select count(*)::int from public.process_template_versions
   where template_id = (select tid from tpl) and status <> 'archived'),
  2,
  'FI2b: BOTH versions SURVIVED the plain-staff archive attempt, unarchived'
);

-- MUTATION (arm b): as above — bare row_count=0 -> 42501 reds this, because the
-- template is legitimately already fully archived.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  'FI2c-control: the OWNING staff_admin CAN archive (the allow arm)'
);
select throws_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  'HC023',
  null,
  'FI2d: re-archiving an already-archived template is HC023, NOT 42501'
);
reset role;

-- ===========================================================================
-- RB — REBUILD PROPERTY LOSS (migration 20260907001200).
--
-- Three defects, one cause: a rebuild silently dropped a property the original
-- carried. These keystones exist because that class is invisible to review — the
-- new statement reads correct, and what is missing is not written anywhere.
--
-- ⚠ These use their OWN template, deliberately. `tpl` above is fully archived by
-- FI2c, and a keystone that happened to depend on that ordering would be one
-- section-reorder away from silently testing nothing.
-- ===========================================================================

update app.feature_flags set enabled = true where key = 'processless_cases';

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rtpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'TV Reorder', null)).id as tid,
         null::uuid as vid;
update rtpl set vid = app.draft_version_of_template(tid);
grant select on rtpl to authenticated;
select public.add_template_phase((select vid from rtpl), (select form_u from k), 'R1');
select public.add_template_phase((select vid from rtpl), (select form_u from k), 'R2');
select public.add_template_phase((select vid from rtpl), (select form_u from k), 'R3');

-- MUTATION: drop `deferrable initially immediate` from
-- process_template_phases_position_key -> both reds with 23505.
--
-- `reorder_template_phase` swaps two rows' positions in ONE update. A
-- non-deferrable unique is checked per ROW, so the first row collides with the
-- neighbour that has not moved yet. This is the assertion that would have caught
-- 20260907000400 dropping the keyword, and the reason it is here at all.
select lives_ok(
  format($$ select public.reorder_template_phase(
    (select id from public.process_template_phases
     where template_version_id = %L and position = 1), 'down') $$,
    (select vid from rtpl)),
  'RB1: a positional SWAP down succeeds (the unique is DEFERRABLE)'
);
-- ⚠ THE INTERMEDIATE STATE IS ASSERTED, and that is the whole point of RB2.
-- The first draft of this section asserted only the ROUND TRIP — that after down
-- then up the order is back to R1,R2,R3. Probe m9 (make `reorder_template_phase`
-- a no-op) left that GREEN, because a door that does nothing also leaves the order
-- unchanged. A round-trip assertion is symmetric and therefore blind to inaction;
-- only the midpoint distinguishes "swapped twice" from "never swapped".
select is(
  (select string_agg(title, ',' order by position)
   from public.process_template_phases where template_version_id = (select vid from rtpl)),
  'R2,R1,R3',
  'RB2: after the down swap the order actually MOVED (catches a no-op door)'
);

select lives_ok(
  format($$ select public.reorder_template_phase(
    (select id from public.process_template_phases
     where template_version_id = %L and position = 2), 'up') $$,
    (select vid from rtpl)),
  'RB3: swapping back UP succeeds too — both directions, not just the happy one'
);

select is(
  (select string_agg(title, ',' order by position)
   from public.process_template_phases where template_version_id = (select vid from rtpl)),
  'R1,R2,R3',
  'RB4: the down+up round trip restored the original order'
);

-- MUTATION: revert create_case's insert column list to `template_id` -> reds 42703.
--
-- ⚠ THE CALL IS INSIDE `lives_ok` FOR A REASON, and it is not style. Calling
-- create_case directly in the fixture was the first draft, and the mutation probe
-- caught it: a 42703 there aborts the transaction, so RB4/RB5 did not go RED — they
-- did not RUN AT ALL (11/13). An assertion that can only ever be green-or-absent is
-- vacuous in the most deceptive way, because the suite summary still says "failed 0".
-- `lives_ok` runs the statement in a subtransaction, so the door failing is reported
-- as a FAILING TEST rather than as a missing one.
create temp table pcase (cid uuid) on commit drop;
grant select on pcase to authenticated;
select lives_ok(
  format($$ insert into pcase
            select (public.create_case(%L, 'Caso sem processo')).id $$,
         (select comm_x from k)),
  'RB5: create_case SUCCEEDS — the processless door is not 42703'
);

-- ADR 0096 A1.1 item 4: a processless case legitimately carries no version. The
-- point of this assertion predates the re-key and survives it — only the grain moved.
--
-- Asserted as a COUNT, not as `is(<scalar>, null)`. With an empty `pcase` the scalar
-- form reads NULL and `is(null, null)` PASSES — the assertion would certify the
-- absence of the row it is supposed to be inspecting.
select is(
  (select count(*)::int from public.cases c join pcase p on p.cid = c.id
   where c.template_version_id is null),
  1,
  'RB6: a processless case has NULL template_version_id (no process, still pinned)'
);

-- ===========================================================================
-- FL — ARM-2 FLOOR: `set_template_collects_patient` must COMPLETE somewhere.
--
-- `20260907000600` re-keyed this door's parameter from `p_template_id` to
-- `p_template_version_id`. The ARM-2 floor allowlist keys entries by EXACT
-- `proname(identity args)`, so its line 111 —
--     set_template_collects_patient(p_template_id uuid, p_collects boolean)
-- — stopped matching the door it names, and the door dropped off the floor with
-- nothing raising. Fifth instance of this phase's governing failure: **anything
-- keyed by a name you changed is a dependant, including things that live OUTSIDE
-- the database.** The allowlist is a text file; no catalog sweep would ever reach it.
--
-- ⚠ THIS MUST DRIVE THE DOOR TO SUCCESS, AND A `throws_ok` WOULD NOT.
-- ARM 2 counts CALLS via `pg_stat_user_functions`, and a call that raises records
-- zero. So a deny-arm keystone drives the door and still leaves it on the offender
-- list — which is deliberate: ARM 2 is implicitly also "this DEFINER can complete at
-- least once", and a door whose authorized path is broken can never clear the floor
-- no matter how much deny coverage it accumulates. Three doors were found broken
-- exactly that way on 2026-08-04. Hence `lives_ok` on the AUTHORIZED path.
--
-- MUTATION: make the door's UPDATE match nothing (or re-gate it to reject drafts)
-- -> FL2 reds. FL1 alone would not: a DEFINER that silently updates zero rows still
-- "lives", which is the same feedback-integrity hole this suite's FI section pins on
-- two sibling doors. FL1 clears the floor; FL2 is what makes FL1 mean something.
-- ===========================================================================

select lives_ok(
  format($$ select public.set_template_collects_patient(%L, true) $$,
         (select vid from rtpl)),
  'FL1: set_template_collects_patient COMPLETES on a draft (clears the ARM-2 floor)'
);

select is(
  (select collects_patient from public.process_template_versions
   where id = (select vid from rtpl)),
  true,
  'FL2: …and it actually SET the flag — not a DEFINER that lives while doing nothing'
);
reset role;

-- ===========================================================================
-- TI — TENANT ISOLATION on the three per-version child tables (ADR 0079).
--
-- WHY THIS SECTION EXISTS. The diff-scoped ADR-0079 door sweep over this phase's
-- new policies returned SIX BLIND: opening any of
--   process_template_{phases,narratives,outcomes}_{select,staff_admin_write}
-- to `true` left the ENTIRE suite green. Nothing asserted through them, so a real
-- cross-tenant leak on these tables would have been invisible. A tenant-isolation
-- policy may never be allowlisted — allowlisting one is indistinguishable from
-- having no boundary at all — so each of the six gets a keystone here.
--
-- ⚠ THE ALLOW ARM IS THE POINT, not a courtesy. A deny-only keystone passes
-- against a policy that denies EVERYONE, which is exactly the D11 fail-closed
-- shape this repo shipped: an enum re-key stranded a predicate on the wrong
-- column, every deny test stayed green, and legitimate users saw nothing. So
-- every table asserts ROWS on both sides — a member READS a nonzero count, and
-- the owner's write LANDS.
--
-- ⚠ A `FOR ALL` POLICY IS ALSO A READ POLICY, AND ITS DENY IS SILENT. RLS raises
-- 42501 only on INSERT (the WITH CHECK arm); for UPDATE and DELETE the USING
-- clause merely FILTERS, so a denied DELETE reports success having removed
-- nothing. A `throws_ok`-only keystone is therefore structurally blind to the
-- USING arm. TI*5 asserts the foreign DELETE's RETURNING set is EMPTY, and TI*6
-- pairs it with the row's SURVIVAL — because "removed nothing" and "there was
-- nothing to remove" are the same observation without that control.
--
-- ⚠ THE DENY IS ASSERTED BY SQLSTATE, NOT BY "something raised". All three tables
-- carry an INSERT coherence guard (HC054 / HC030) that rejects a narrative type,
-- outcome or form belonging to another commission. A deny fixture built from
-- FOREIGN vocabulary would satisfy `throws_ok` on the GUARD and prove nothing
-- about RLS, so the foreign-writer probes below deliberately use comm_x's OWN
-- vocabulary: the guards pass, and 42501 can only have come from the policy.
--
-- ⚠ SCOPE, stated rather than left implicit. Each predicate is a disjunction —
-- `is_member_of` / `is_staff_admin_of` OR `is_tenancy_admin_of`. These
-- keystones drive the FIRST disjunct in both directions. The
-- `is_tenancy_admin_of` disjunct needs an org_admin persona that
-- `test_helpers.bootstrap()` does not build (it homes BOTH commissions under one
-- org and mints only commission-scoped memberships), so it is not exercised here.
-- That does not leave the sweep finding open — the sweep opens the WHOLE policy,
-- not one disjunct — but the org-admin reach arm is a real, separate gap and is
-- named rather than silently omitted.
-- ===========================================================================

-- --- Block A: the OWNING staff_admin writes (the WITH CHECK allow arm). -----
-- Each insert is inside `lives_ok` on purpose (the RB5 lesson): a closed write
-- policy would abort the fixture and the section would report 0 tests RUN rather
-- than tests FAILED, and a harness counting `not ok` lines cannot tell those apart.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table xtpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'TV Isolamento', null)).id as tid,
         null::uuid as vid;
update xtpl set vid = app.draft_version_of_template(tid);
grant select on xtpl to authenticated;

create temp table xv (ntype uuid, out_own uuid, out_foreign uuid) on commit drop;
grant select on xv to authenticated;
with n as (
  insert into public.case_narrative_types (commission_id, label, position)
  values ((select comm_x from k), 'TV Tipo', 1) returning id
), o1 as (
  insert into public.case_outcomes (commission_id, label, position)
  values ((select comm_x from k), 'TV Desfecho A', 1) returning id
), o2 as (
  insert into public.case_outcomes (commission_id, label, position)
  values ((select comm_x from k), 'TV Desfecho B', 2) returning id
)
insert into xv select (select id from n), (select id from o1), (select id from o2);

select lives_ok(
  format($$ insert into public.process_template_phases
              (template_version_id, position, form_id, title)
            values (%L, 1, %L, 'TV Iso Fase') $$,
         (select vid from xtpl), (select form_u from k)),
  'TIP1: the OWNING staff_admin CAN insert a phase (write WITH CHECK admits)'
);
select lives_ok(
  format($$ insert into public.process_template_narratives
              (template_version_id, narrative_type_id, display_position, title)
            values (%L, %L, 1, 'TV Iso Narrativa') $$,
         (select vid from xtpl), (select ntype from xv)),
  'TIN1: the OWNING staff_admin CAN insert a narrative slot (write WITH CHECK admits)'
);
select lives_ok(
  format($$ insert into public.process_template_outcomes
              (template_version_id, outcome_id, position)
            values (%L, %L, 1) $$,
         (select vid from xtpl), (select out_own from xv)),
  'TIO1: the OWNING staff_admin CAN insert an outcome link (write WITH CHECK admits)'
);
reset role;

-- --- Block B: a PLAIN MEMBER of the owning commission reads (the _select allow
-- arm, and the only assertions that drive `is_member_of` rather than
-- `is_staff_admin_of` — st_x is not a staff_admin, so the FOR ALL write policy
-- cannot be what lets it see these rows). ------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.process_template_phases
   where template_version_id = (select vid from xtpl)),
  1,
  'TIP2: a plain MEMBER of the owning commission READS the phase (non-vacuity)'
);
select is(
  (select count(*)::int from public.process_template_narratives
   where template_version_id = (select vid from xtpl)),
  1,
  'TIN2: a plain MEMBER of the owning commission READS the narrative slot'
);
select is(
  (select count(*)::int from public.process_template_outcomes
   where template_version_id = (select vid from xtpl)),
  1,
  'TIO2: a plain MEMBER of the owning commission READS the outcome link'
);
reset role;

-- --- Block C: a staff_admin of ANOTHER commission — the deny arms. ----------
-- sa_y is a staff_admin of comm_y and holds no org/hospital membership, so all
-- three predicates resolve false for comm_x. Verified against the live stack, not
-- inferred from the persona's name.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;

select is(
  (select count(*)::int from public.process_template_phases
   where template_version_id = (select vid from xtpl)),
  0,
  'TIP3: a FOREIGN commission staff_admin reads ZERO phases (tenant isolation)'
);
select is(
  (select count(*)::int from public.process_template_narratives
   where template_version_id = (select vid from xtpl)),
  0,
  'TIN3: a FOREIGN commission staff_admin reads ZERO narrative slots'
);
select is(
  (select count(*)::int from public.process_template_outcomes
   where template_version_id = (select vid from xtpl)),
  0,
  'TIO3: a FOREIGN commission staff_admin reads ZERO outcome links'
);

-- The write deny, INSERT half. A DISTINCT position / outcome is used so a unique
-- violation can never be what satisfies these, and comm_x's own vocabulary so the
-- coherence guard can never be what satisfies them either: 42501 or nothing.
select throws_ok(
  format($$ insert into public.process_template_phases
              (template_version_id, position, form_id, title)
            values (%L, 2, %L, 'TV Iso Invasora') $$,
         (select vid from xtpl), (select form_u from k)),
  '42501',
  null,
  'TIP4: a FOREIGN staff_admin INSERT is refused by RLS with 42501 (not by a guard)'
);
select throws_ok(
  format($$ insert into public.process_template_narratives
              (template_version_id, narrative_type_id, display_position, title)
            values (%L, %L, 2, 'TV Iso Invasora') $$,
         (select vid from xtpl), (select ntype from xv)),
  '42501',
  null,
  'TIN4: a FOREIGN staff_admin INSERT is refused by RLS with 42501, not HC054'
);
select throws_ok(
  format($$ insert into public.process_template_outcomes
              (template_version_id, outcome_id, position)
            values (%L, %L, 2) $$,
         (select vid from xtpl), (select out_foreign from xv)),
  '42501',
  null,
  'TIO4: a FOREIGN staff_admin INSERT is refused by RLS with 42501, not HC030'
);

-- The write deny, USING half — the one that raises NOTHING. The data-modifying
-- CTE is at the top level of the executed statement (the only place Postgres
-- allows it), so `is_empty` measures rows ACTUALLY removed, not an error class.
select is_empty(
  format($$ with d as (delete from public.process_template_phases
                       where template_version_id = %L returning id)
            select id from d $$, (select vid from xtpl)),
  'TIP5: a FOREIGN staff_admin DELETE removes ZERO phase rows — filtered, not raised'
);
select is_empty(
  format($$ with d as (delete from public.process_template_narratives
                       where template_version_id = %L returning id)
            select id from d $$, (select vid from xtpl)),
  'TIN5: a FOREIGN staff_admin DELETE removes ZERO narrative rows'
);
select is_empty(
  format($$ with d as (delete from public.process_template_outcomes
                       where template_version_id = %L returning outcome_id)
            select outcome_id from d $$, (select vid from xtpl)),
  'TIO5: a FOREIGN staff_admin DELETE removes ZERO outcome rows'
);
reset role;

-- --- Block D: back as the owner — the control pair for block C's deletes, then
-- the write USING allow arm. ------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (select count(*)::int from public.process_template_phases
   where template_version_id = (select vid from xtpl)),
  1,
  'TIP6: the phase SURVIVED the foreign delete (the control TIP5 needs to mean anything)'
);
select is(
  (select count(*)::int from public.process_template_narratives
   where template_version_id = (select vid from xtpl)),
  1,
  'TIN6: the narrative slot SURVIVED the foreign delete'
);
select is(
  (select count(*)::int from public.process_template_outcomes
   where template_version_id = (select vid from xtpl)),
  1,
  'TIO6: the outcome link SURVIVED the foreign delete'
);

-- The owner's UPDATE must actually REACH the row. Asserted on the resulting
-- VALUE, and each target value differs from the fixture's, so an update that
-- matched zero rows (the D11 fail-closed shape) reads the old value and reds.
update public.process_template_phases set title = 'TV Iso Alterada'
  where template_version_id = (select vid from xtpl);
update public.process_template_narratives set title = 'TV Iso Alterada'
  where template_version_id = (select vid from xtpl);
update public.process_template_outcomes set position = 7
  where template_version_id = (select vid from xtpl);

select is(
  (select title from public.process_template_phases
   where template_version_id = (select vid from xtpl)),
  'TV Iso Alterada',
  'TIP7: the OWNING staff_admin UPDATE reached the phase row (write USING admits)'
);
select is(
  (select title from public.process_template_narratives
   where template_version_id = (select vid from xtpl)),
  'TV Iso Alterada',
  'TIN7: the OWNING staff_admin UPDATE reached the narrative row'
);
select is(
  (select position from public.process_template_outcomes
   where template_version_id = (select vid from xtpl)),
  7,
  'TIO7: the OWNING staff_admin UPDATE reached the outcome row'
);
reset role;

select * from finish();
rollback;

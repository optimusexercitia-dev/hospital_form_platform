-- =============================================================================
-- AUTHZ · M5b — defect ③ at the DOORS. ADR 0078 Context·3 / D3.
--
-- ⛔ WHY THIS FILE EXISTS: M5 (231) gated the `app.*` PREDICATES and I claimed the
-- set was CLOSED. IT WAS NOT — the claim was a FLOOR, and §7.5 says that is this
-- program's signature failure (five rounds, five caller floors, never converged).
-- I closed over {app.* functions touching a raw-arm table} = 17. The `public.*`
-- DEFINER RPCs were EXCLUDED, and they are `prosecdef = t` — so RLS DOES NOT APPLY
-- TO THEM. That is A28's exact lesson: a DEFINER's gate REPLACES RLS, so a
-- predicate-shaped closure is STRUCTURALLY BLIND to them. Fourth time on this
-- program.
--
-- Proven live against the gated catalog (staff1.ccih deactivated, `set local role
-- authenticated`, rolled back) — the predicates deny and the doors serve anyway:
--     app.can_read_case          = f      <- 231's gate works
--     app.can_read_action_item   = f      <- 231's gate works
--     public.list_my_cases       -> 2 rows
--     public.list_my_action_items-> 1 row
--     public.get_member_overview -> cases_not_concluded 2, pending_action_items 1
--     public.conclude_narrative  -> SUCCEEDS
--     public.advance_committee_action_item -> SUCCEEDS
-- These doors delegate to NO predicate: they inline the raw arms under a bare
-- auth.uid(). That is the literal text of defect ③.
--
-- ⛔ THE CLOSURE HERE IS BEHAVIOURAL, NOT TEXTUAL — and that is not a preference.
-- A text-based transitive-is_active graph reports `list_my_cases` as GATED. It is
-- NOT: `is_staff_admin_of_for` appears only in its `my_role` CHIP, never in its
-- WHERE clause. Both qa's sweep and my own `delegates` column were fooled by that
-- exact string. Only `set local role authenticated` caught it. Every verdict below
-- is a row count or a raised SQLSTATE under a real role — never a predicate's
-- return value (§7.2: resolve the VALUE, not the noun).
--
-- ⚠ NARROWING (§7.7): every negative is paired with an ACTIVE positive twin and a
-- RESTORE. A door that serves nobody passes its negative BY CONSTRUCTION.
-- =============================================================================

begin;
select plan(33);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x, (v->>'st_x2')::uuid as st_x2,
         (v->>'st_y')::uuid as st_y, (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u, (v->>'ver_u')::uuid as ver_u
  from ctx;
grant select on k to authenticated;

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'case_access', 'cases_extras', 'action_items', 'audit_trail');
update app.feature_flags set enabled = false where key in ('case_types', 'case_referrals');

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000b5001', (select comm_x from k), 94001, (select sa_x from k),
        'commission_default');

-- st_x  = plain member; reach = a PHASE assignment ONLY.
-- st_x2 = plain member; reach = a NARRATIVE assignment ONLY.
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, assigned_to)
select '00000000-0000-0000-0000-0000000b5002', '00000000-0000-0000-0000-0000000b5001', 1,
       'Apuração', (select form_u from k), (select ver_u from k), (select st_x from k);
insert into public.case_narrative_types (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000b5003', (select comm_x from k), 'Relato', 1);
insert into public.case_narratives
  (id, case_id, narrative_type_id, type_label, display_position, assigned_to, status)
values ('00000000-0000-0000-0000-0000000b5004', '00000000-0000-0000-0000-0000000b5001',
        '00000000-0000-0000-0000-0000000b5003', 'Relato', 1, (select st_x2 from k), 'open');
-- ⛔ A SECOND narrative, for the positive twin ALONE. The twin must not share a row
-- with the negatives: PRE-FIX the negatives SUCCEED (that is the defect), which
-- concludes the shared row, so the twin then hits HC055 and goes red for a reason
-- that has nothing to do with M5b. A twin whose result depends on the negatives
-- failing is not an independent twin.
insert into public.case_narratives
  (id, case_id, narrative_type_id, type_label, display_position, assigned_to, status)
values ('00000000-0000-0000-0000-0000000b5006', '00000000-0000-0000-0000-0000000b5001',
        '00000000-0000-0000-0000-0000000b5003', 'Relato 2', 2, (select st_x2 from k), 'open');
-- A `manual` item so advance_committee_action_item takes the meeting/manual branch,
-- whose arms are: the raw assignee OR staff_admin OR commission_admin.
insert into public.action_items
  (id, commission_id, source_type, title, status_id, visibility_scope, assigned_to, created_by)
select '00000000-0000-0000-0000-0000000b5005', (select comm_x from k), 'manual', 'Item M5b',
       (select id from public.action_item_statuses where commission_id is null and key = 'open'),
       'committee', (select st_x from k), (select sa_x from k);

-- ⛔ auth.uid() survives `reset role`, and guard_profile_privileged_columns raises for
-- ANY signed-in caller touching suspended_until — so every profile mutation below runs
-- with the claims CLEARED. Without this the suite ABORTS rather than asserting, and an
-- aborted suite reports "Failed: 0" (§7.1: red != abort).
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- FLAGS + PRE-FLIGHT — asserted, never assumed (§7.3).
-- ===========================================================================
select is(app.feature_enabled('case_access'), true,
  'FLAG: case_access ON — list_my_cases asserts it and would raise otherwise');
select is(app.feature_enabled('cases_extras'), true,
  'FLAG: cases_extras ON — else get_member_overview counts 0 and every twin below is vacuous');
select is(app.feature_enabled('action_items'), true,
  'FLAG: action_items ON — else the action-item doors are inert');

-- The arms must be RAW-ONLY. If any principal held a role arm, deactivating him would
-- deny through the ROLE wrapper (gated since long before M5) and prove nothing.
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: the phase/action assignee is NOT staff_admin — the assignment is his ONLY arm');
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: …nor commission_admin');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), false,
  'PRE ⭐: the narrative assignee is NOT staff_admin either');
select is(app.is_active((select st_x from k)), true, 'PRE: the assignee starts ACTIVE');

-- ===========================================================================
-- list_my_cases — the personal list. It delegates to NO predicate.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(jsonb_array_length(public.list_my_cases((select comm_x from k))), 1,
  'M5b TWIN ⭐: the ACTIVE phase assignee SEES his case in Meus Casos — the door reaches');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = false where id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(jsonb_array_length(public.list_my_cases((select comm_x from k))), 0,
  'M5b ⭐ defect ③: a DEACTIVATED phase assignee gets ZERO rows from list_my_cases (today: he still gets the case)');
select is(jsonb_array_length(public.list_my_action_items((select comm_x from k))), 0,
  'M5b ⭐ defect ③: …and ZERO from list_my_action_items');
select is((public.get_member_overview((select comm_x from k))->>'cases_not_concluded')::int, 0,
  'M5b ⭐ defect ③: …and get_member_overview counts ZERO cases');
select is((public.get_member_overview((select comm_x from k))->>'pending_action_items')::int, 0,
  'M5b ⭐ defect ③: …and ZERO pending action items');
reset role;
select set_config('request.jwt.claims', '', true);

-- The SUSPENSION half. A gate honouring only the flag passes every test above and
-- still serves every suspended user.
update public.profiles set is_active = true, suspended_until = now() + interval '1 day'
  where id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(jsonb_array_length(public.list_my_cases((select comm_x from k))), 0,
  'M5b ⭐: a SUSPENDED phase assignee gets ZERO rows (the second half of is_active)');
select is((public.get_member_overview((select comm_x from k))->>'cases_not_concluded')::int, 0,
  'M5b ⭐: …and the overview counts ZERO for him too');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set suspended_until = now() - interval '1 day' where id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(jsonb_array_length(public.list_my_cases((select comm_x from k))), 1,
  'M5b ⭐: an EXPIRED suspension sees his case again — the gate honours the expiry, it does not just test for NULL');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set suspended_until = null where id = (select st_x from k);

-- RESTORE — proves the denial was is_active and not some other arm.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(jsonb_array_length(public.list_my_cases((select comm_x from k))), 1,
  'M5b RESTORE ⭐: reactivating restores Meus Casos');
select is(jsonb_array_length(public.list_my_action_items((select comm_x from k))), 1,
  'M5b RESTORE ⭐: …and Meus Itens de Ação');
select is((public.get_member_overview((select comm_x from k))->>'cases_not_concluded')::int, 1,
  'M5b RESTORE ⭐: …and the overview counts him again');
reset role;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- ⛔ THE WRITE DOORS. qa found the three READ doors; probing the WRITE doors with
-- the same deactivated principal found TWO MORE of the same class — a raw
-- `assigned_to = auth.uid()` arm ORed beside gated coordinator arms.
--
-- ⭐ SQLSTATE ORDER IS THE STRUCTURAL DEFENCE (A33). The gate raises HC0F4 AFTER the
-- door's existing AUTHORITY check (42501 / HC027 / HC037). So a fixture whose
-- principal is NOT the assignee fails LOUDLY on authority instead of passing on the
-- code under test. It makes the vacuous keystone UNWRITABLE rather than merely
-- discouraged — the trap that caught a keystone on this program already.
-- ===========================================================================
select is(app.is_active((select st_x2 from k)), true, 'PRE: the narrative assignee starts ACTIVE');

update public.profiles set is_active = false where id = (select st_x2 from k);
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.conclude_narrative('00000000-0000-0000-0000-0000000b5004') $$,
  'HC0F4',
  null,
  'M5b ⭐ defect ③: a DEACTIVATED narrative assignee CANNOT conclude his narrative (today: it succeeds)');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = true, suspended_until = now() + interval '1 day'
  where id = (select st_x2 from k);
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.conclude_narrative('00000000-0000-0000-0000-0000000b5004') $$,
  'HC0F4',
  null,
  'M5b ⭐: a SUSPENDED narrative assignee cannot conclude it either');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set suspended_until = null where id = (select st_x2 from k);

-- ⭐ THE WRONG-ARM DEFENCE, ASSERTED. st_y is ACTIVE and is NOT the assignee. He must
-- fail on AUTHORITY (42501), NOT on HC0F4. If this ever returns HC0F4 the gate has
-- been hoisted above the authority check and every HC0F4 keystone above has silently
-- become vacuous — a deactivated NON-assignee would satisfy them.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.conclude_narrative('00000000-0000-0000-0000-0000000b5004') $$,
  '42501',
  null,
  'M5b ⭐ ORDER: an ACTIVE NON-assignee fails on AUTHORITY (42501), not HC0F4 — this is what keeps the HC0F4 keystones non-vacuous');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = false where id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.advance_committee_action_item('00000000-0000-0000-0000-0000000b5005',
       (select id from public.action_item_statuses where commission_id is null and key = 'in_progress'), null) $$,
  'HC0F4',
  null,
  'M5b ⭐ defect ③: a DEACTIVATED action-item assignee CANNOT advance his item (today: it succeeds)');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = true, suspended_until = now() + interval '1 day'
  where id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.advance_committee_action_item('00000000-0000-0000-0000-0000000b5005',
       (select id from public.action_item_statuses where commission_id is null and key = 'in_progress'), null) $$,
  'HC0F4',
  null,
  'M5b ⭐: a SUSPENDED action-item assignee cannot advance it either');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set suspended_until = null where id = (select st_x from k);

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.advance_committee_action_item('00000000-0000-0000-0000-0000000b5005',
       (select id from public.action_item_statuses where commission_id is null and key = 'in_progress'), null) $$,
  'HC037',
  null,
  'M5b ⭐ ORDER: an ACTIVE NON-assignee fails on AUTHORITY (HC037), not HC0F4');
reset role;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- ⛔ THE POSITIVE TWINS, LAST — the whole risk of a narrowing. These MUTATE, so they
-- run after the negatives (a concluded narrative cannot be concluded again).
-- ===========================================================================
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.conclude_narrative('00000000-0000-0000-0000-0000000b5006') $$,
  'M5b TWIN ⭐: the ACTIVE narrative assignee STILL concludes his narrative — M5b did not deny everyone');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select status from public.case_narratives where id = '00000000-0000-0000-0000-0000000b5006'),
  'completed', 'M5b TWIN ⭐: …and the write actually LANDED (asserted as STATE, not as a non-throw)');
-- ⛔ And the narrative the NEGATIVES targeted must still be OPEN. Pre-fix it was
-- concluded by the very calls that were supposed to be denied — so this asserts the
-- denial had no side effect, which a throws_ok alone does not prove.
select is((select status from public.case_narratives where id = '00000000-0000-0000-0000-0000000b5004'),
  'open', 'M5b ⭐: the narrative the DENIED calls targeted is STILL OPEN — the denial left no side effect');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.advance_committee_action_item('00000000-0000-0000-0000-0000000b5005',
       (select id from public.action_item_statuses where commission_id is null and key = 'in_progress'), null) $$,
  'M5b TWIN ⭐: the ACTIVE action-item assignee STILL advances his item');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select st.key from public.action_items ai join public.action_item_statuses st on st.id = ai.status_id
           where ai.id = '00000000-0000-0000-0000-0000000b5005'),
  'in_progress', 'M5b TWIN ⭐: …and the transition actually LANDED');

-- ===========================================================================
-- STRUCTURAL — comments stripped. This is the PRESENCE direction of §7.2·2, the
-- dangerous one: the migration explains the gate at length, so an unstripped match
-- would go GREEN on the COMMENT while the gate itself was absent.
-- ===========================================================================
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('list_my_cases', 'list_my_action_items', 'get_member_overview',
                               'conclude_narrative', 'advance_committee_action_item')
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 5,
  'M5b STRUCTURAL ⭐: all FIVE doors call is_active in CODE (comments stripped)');

-- ⛔ CLOSURE FENCE — the doors proven FIXED FOR FREE must stay that way. If one of
-- these ever stops delegating, it becomes a new ungated arm and this goes red.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.list_cases_board((select comm_x from k), 50)), 1,
  'M5b CLOSURE ⭐: list_cases_board serves the ACTIVE assignee (it filters per-row on can_read_case ⇒ fixed for free, not gated here)');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.list_cases_board((select comm_x from k), 50)), 0,
  'M5b CLOSURE ⭐: …and serves a DEACTIVATED one ZERO rows — fixed for free by 231''s can_read_case gate, no door change needed');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select st_x from k);

select * from finish();
rollback;

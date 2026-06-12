-- submit_response RPC: required-answer check, stray-answer cleanup on hidden
-- sections, sign-off check (feature-flagged), double-submit rejection, and the
-- happy path. The RPC is security-invoker, so we act as the response owner
-- (authenticated) for the calls; assertions on resulting rows reset to the
-- superuser role to read freely.

begin;
select plan(8);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table r on commit drop as select gen_random_uuid() as id;
-- act_as switches to the authenticated role; let it read these fixture tables.
grant select on ctx, r to authenticated;

-- Create an in_progress response on the sectioned form S, owned by staff X.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r.id, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r, ctx c;

-- ---- 1) missing required in a visible section is rejected ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select id from r)),
  'P0011',
  null,
  'submit rejects when a required answer in a visible section is missing'
);
reset role;

-- Answer the gate 'Não' (hides the conditional section), answer the required
-- item in the respondent-signoff section, and drop a STRAY answer into the
-- now-hidden conditional section to prove cleanup.
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (c.v->>'it_gate')::uuid, 's_gate', '"Não"'::jsonb from ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (c.v->>'it_req')::uuid, 's_req', '"Sim"'::jsonb from ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (c.v->>'it_cond')::uuid, 's_cond', '"stray"'::jsonb from ctx c;

-- ---- 2) sign-off enforcement ON would reject (no sign-off rows). Flip the
-- flag within this txn and assert rejection, then flip back. ----
update app.feature_flags set enabled = true where key = 'signoff_enforcement';
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select id from r)),
  'P0012',
  null,
  'submit rejects a missing sign-off when enforcement is ON'
);
reset role;
update app.feature_flags set enabled = false where key = 'signoff_enforcement';

-- ---- 3) happy path with enforcement OFF (Phase 1 default) ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.submit_response(%L) $$, (select id from r)),
  'submit succeeds on the hidden-branch happy path (sign-off check off)'
);
reset role;

-- Status flipped to submitted.
select is(
  (select status from public.responses where id = (select id from r)),
  'submitted',
  'response status is submitted after the RPC'
);

-- Stray answer in the hidden conditional section was deleted.
select is(
  (select count(*)::int from public.answers a
     where a.response_id = (select id from r) and a.question_key = 's_cond'),
  0,
  'stray answers in the hidden section are cleaned up'
);

-- Visible-section answers survive.
select is(
  (select count(*)::int from public.answers a
     where a.response_id = (select id from r) and a.question_key in ('s_gate','s_req')),
  2,
  'answers in visible sections are preserved'
);

-- ---- 4) double submission is rejected ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select id from r)),
  'P0010',
  null,
  'a second submit of the same response is rejected'
);
reset role;

-- ---- 5) required answer present but section visible -> succeeds (taking the
-- 'Sim' branch) on a fresh response. ----
create temp table r2 on commit drop as select gen_random_uuid() as id;
grant select on r2 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r2.id, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x2')::uuid, 'in_progress'
from r2, ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (c.v->>'it_gate')::uuid, 's_gate', '"Sim"'::jsonb from ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (c.v->>'it_cond')::uuid, 's_cond', '"detail"'::jsonb from ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (c.v->>'it_req')::uuid, 's_req', '"Sim"'::jsonb from ctx c;

select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.submit_response(%L) $$, (select id from r2)),
  'submit succeeds taking the visible conditional branch with its required answer'
);
reset role;

select * from finish();
rollback;

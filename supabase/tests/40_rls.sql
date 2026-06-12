-- RLS policy coverage. Each assertion acts as a specific persona via
-- test_helpers.act_as (sets the authenticated role + JWT claims) and checks
-- what is visible / mutable through the policies.

begin;
select plan(20);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;

-- Seed one submitted + one in_progress response in commission X by staff X, and
-- one in commission Y, so cross-commission and ownership rules have data.
create temp table rids on commit drop as
  select gen_random_uuid() as sub_x, gen_random_uuid() as prog_x, gen_random_uuid() as sub_y;
-- act_as switches to the authenticated role; let it read these fixture tables.
grant select on ctx, rids to authenticated;

-- Insert the answer while in_progress, then flip to submitted under the guard
-- (the submitted-immutability trigger blocks child writes once submitted).
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select sub_x, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from rids, ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select sub_x from rids), (c.v->>'item_mc')::uuid, 'u_q1', '"Sim"'::jsonb from ctx c;
select set_config('app.in_submit_rpc','on', true);
update public.responses set status='submitted', submitted_at=now() where id = (select sub_x from rids);
select set_config('app.in_submit_rpc','off', true);

insert into public.responses (id, form_version_id, commission_id, created_by, status)
select prog_x, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from rids, ctx c;

insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select sub_y, (c.v->>'ver_y')::uuid, (c.v->>'comm_y')::uuid, (c.v->>'st_y')::uuid, 'submitted', now()
from rids, ctx c;

-- =========================================================================
-- Cross-commission isolation: staff Y cannot see commission X's data.
-- =========================================================================
select test_helpers.claims_for((select (v->>'st_y')::uuid from ctx), false);
set local role authenticated;

select is(
  (select count(*)::int from public.commissions where id = (select (v->>'comm_x')::uuid from ctx)),
  0,
  'staff of Y cannot read commission X'
);

select is(
  (select count(*)::int from public.forms where commission_id = (select (v->>'comm_x')::uuid from ctx)),
  0,
  'staff of Y cannot read commission X''s forms'
);

select is(
  (select count(*)::int from public.responses where commission_id = (select (v->>'comm_x')::uuid from ctx)),
  0,
  'staff of Y cannot read commission X''s responses'
);

select is(
  (select count(*)::int from public.answers a
     where a.response_id = (select sub_x from rids)),
  0,
  'staff of Y cannot read commission X''s answers'
);

reset role;

-- =========================================================================
-- Staff cannot edit forms (no write policy for the staff role).
-- =========================================================================
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;

-- bootstrap creates two forms in X (Form U + Form S).
select is(
  (select count(*)::int from public.forms where commission_id = (select (v->>'comm_x')::uuid from ctx)),
  2,
  'staff of X CAN read X''s forms'
);

-- An update by staff matches no rows (USING false) rather than erroring.
prepare staff_form_update as
  update public.forms set title = 'hacked' where title = 'Form U';
select lives_ok('execute staff_form_update', 'staff form UPDATE does not error');
select is(
  (select title from public.forms
     where id = (select (v->>'form_u')::uuid from ctx)),
  'Form U',
  'staff UPDATE of a form changed nothing (RLS blocked)'
);
deallocate staff_form_update;

reset role;

-- =========================================================================
-- in_progress response is invisible + uneditable to anyone but its creator.
-- staff X2 is a co-member but not the creator.
-- =========================================================================
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;

select is(
  (select count(*)::int from public.responses where id = (select prog_x from rids)),
  0,
  'a co-member cannot see another member''s in_progress response'
);

reset role;

-- staff_admin of X can see the SUBMITTED response but NOT the in_progress one.
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

select is(
  (select count(*)::int from public.responses where id = (select sub_x from rids)),
  1,
  'staff_admin of X sees a submitted response'
);
select is(
  (select count(*)::int from public.responses where id = (select prog_x from rids)),
  0,
  'staff_admin of X does NOT see another member''s in_progress response'
);
select is(
  (select count(*)::int from public.answers a where a.response_id = (select sub_x from rids)),
  1,
  'staff_admin of X can read answers of a submitted response'
);

reset role;

-- =========================================================================
-- staff_admin cannot escalate to global admin (profiles.is_admin) and cannot
-- create a staff_admin member (escalation guards).
-- =========================================================================
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

-- Self-promote attempt via profiles update: blocked by the privileged-column
-- guard trigger (raises), so is_admin stays false.
select throws_ok(
  format($$ update public.profiles set is_admin = true where id = %L $$,
         (select (v->>'sa_x')::uuid from ctx)),
  '23514',
  null,
  'staff_admin cannot self-promote (privileged-column guard raises)'
);

reset role;
select is(
  (select is_admin from public.profiles where id = (select (v->>'sa_x')::uuid from ctx)),
  false,
  'staff_admin cannot escalate self to global admin'
);

-- Creating a staff_admin member is rejected by the insert WITH CHECK (role must
-- be staff). Done as sa_x.
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.commission_members (commission_id, user_id, role)
            values (%L, %L, 'staff_admin') $$,
         (select (v->>'comm_x')::uuid from ctx),
         (select (v->>'st_y')::uuid from ctx)),
  '42501',  -- insufficient_privilege: RLS WITH CHECK violation
  null,
  'staff_admin cannot create another staff_admin (escalation blocked)'
);
reset role;

-- MAJOR-1: a staff_admin cannot demote a FELLOW staff_admin to staff. Add a
-- second staff_admin (the admin user) to commission X as postgres, then act as
-- sa_x and try to update that row to role='staff' — the USING clause restricts
-- targets to staff rows, so the UPDATE matches nothing (and the row is
-- unchanged).
insert into public.commission_members (commission_id, user_id, role)
select (v->>'comm_x')::uuid, (v->>'admin')::uuid, 'staff_admin' from ctx;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
prepare demote_peer as
  update public.commission_members set role = 'staff'
  where commission_id = (select (v->>'comm_x')::uuid from ctx)
    and user_id = (select (v->>'admin')::uuid from ctx);
select lives_ok('execute demote_peer', 'demote-peer UPDATE does not error');
deallocate demote_peer;
reset role;

select is(
  (select role from public.commission_members
     where commission_id = (select (v->>'comm_x')::uuid from ctx)
       and user_id = (select (v->>'admin')::uuid from ctx)),
  'staff_admin',
  'staff_admin cannot demote a fellow staff_admin (USING restricts to staff)'
);

-- MINOR-2: profiles are never deleted. Two layers prove this:
-- (a) RLS exposes no DELETE policy, so an admin's delete matches no rows;
-- (b) the BEFORE DELETE trigger raises even when RLS is bypassed (postgres).
-- (a) admin delete is a no-op under RLS (no DELETE policy):
select test_helpers.claims_for((select (v->>'admin')::uuid from ctx), true);
set local role authenticated;
prepare admin_del_profile as
  delete from public.profiles where id = (select (v->>'st_y')::uuid from ctx);
select lives_ok('execute admin_del_profile', 'admin profile DELETE is a no-op under RLS (no policy)');
deallocate admin_del_profile;
reset role;

-- (b) trigger backstop fires when RLS is bypassed (running as postgres here):
select throws_ok(
  format($$ delete from public.profiles where id = %L $$,
         (select (v->>'st_y')::uuid from ctx)),
  '23514',
  null,
  'the no-delete trigger blocks profile deletion even bypassing RLS'
);

-- The profile still exists after both attempts.
select is(
  (select count(*)::int from public.profiles where id = (select (v->>'st_y')::uuid from ctx)),
  1,
  'profile is never deleted'
);

-- MINOR-3: a response whose form_version_id belongs to a DIFFERENT commission
-- than its commission_id is rejected by the version/commission guard. Attempt
-- (as postgres) to insert a response in commission Y referencing X's form.
select throws_ok(
  format($$ insert into public.responses (form_version_id, commission_id, created_by, status)
            values (%L, %L, %L, 'in_progress') $$,
         (select (v->>'ver_u')::uuid from ctx),   -- X's form version
         (select (v->>'comm_y')::uuid from ctx),  -- Y's commission
         (select (v->>'st_y')::uuid from ctx)),
  '23514',
  null,
  'response.form_version_id must belong to its commission_id'
);

select * from finish();
rollback;

-- Immutability + integrity triggers (run as superuser; RLS not the subject
-- here — these are the DB-level guards that hold regardless of role).

begin;
select plan(14);

-- Build fixture; capture ids in a temp table so we can reference across calls.
create temp table ctx on commit drop as select test_helpers.bootstrap() as v;

-- ----- Published-version immutability -----
select throws_ok(
  format($$ update public.form_versions set version_number = 99 where id = %L $$,
         (select v->>'ver_u' from ctx)),
  '23514',
  null,
  'cannot UPDATE a published version row'
);

select throws_ok(
  format($$ delete from public.form_versions where id = %L $$,
         (select v->>'ver_u' from ctx)),
  '23514',
  null,
  'cannot DELETE a published version'
);

select throws_ok(
  format($$ update public.form_sections set title = 'x' where id = %L $$,
         (select v->>'sec_s1' from ctx)),
  '23514',
  null,
  'cannot UPDATE a published version''s section'
);

select throws_ok(
  format($$ delete from public.form_sections where id = %L $$,
         (select v->>'sec_s1' from ctx)),
  '23514',
  null,
  'cannot DELETE a published version''s section'
);

select throws_ok(
  format($$ update public.form_items set label = 'x' where id = %L $$,
         (select v->>'it_gate' from ctx)),
  '23514',
  null,
  'cannot UPDATE a published version''s item'
);

select throws_ok(
  format($$ insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
            values (%L, 9, 'free_text', 'sneak', 'x', null, false) $$,
         (select v->>'sec_s1' from ctx)),
  '23514',
  null,
  'cannot INSERT an item into a published version'
);

-- ----- Display-item answer rejection -----
-- Create an in_progress response on the unsectioned form, then try to answer a
-- display item (the section_text at position 1 of sec_u).
create temp table resp on commit drop as
  select gen_random_uuid() as id;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r.id, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from resp r, ctx c;

select throws_ok(
  $$ insert into public.answers (response_id, item_id, question_key, value)
     select r.id, fi.id, 'display', '"x"'::jsonb
     from resp r,
          public.form_items fi
     where fi.item_type = 'section_text'
       and fi.section_id = (select (v->>'sec_u')::uuid from ctx)
     limit 1 $$,
  '23514',
  null,
  'cannot record an answer for a display item'
);

-- ----- Submitted-response immutability -----
-- Submit the response (answer the required item first), then prove freeze.
insert into public.answers (response_id, item_id, question_key, value)
select r.id, (c.v->>'item_mc')::uuid, 'u_q1', '"Sim"'::jsonb
from resp r, ctx c;

-- Drive submission directly (act_as not needed; we test the guard, not RLS).
select set_config('app.in_submit_rpc','on', true);
update public.responses set status='submitted', submitted_at=now()
  where id = (select id from resp);
select set_config('app.in_submit_rpc','off', true);

select throws_ok(
  $$ update public.responses set last_section_id = null where id = (select id from resp) $$,
  '23514',
  null,
  'cannot UPDATE a submitted response'
);

select throws_ok(
  $$ update public.answers set value = '"Não"'::jsonb
     where response_id = (select id from resp) $$,
  '23514',
  null,
  'cannot UPDATE an answer of a submitted response'
);

select throws_ok(
  $$ delete from public.answers where response_id = (select id from resp) $$,
  '23514',
  null,
  'cannot DELETE an answer of a submitted response'
);

select throws_ok(
  $$ delete from public.responses where id = (select id from resp) $$,
  '23514',
  null,
  'cannot DELETE a submitted response'
);

-- Sign-offs of a submitted response are immutable (PHASES.md Phase 1 lists
-- sign-offs explicitly). A sign-off INSERT against the submitted response is
-- blocked by guard_submitted_signoffs_trg.
select throws_ok(
  $$ insert into public.response_section_signoffs (response_id, section_id, signed_by)
     select (select id from resp), (c.v->>'sec_u')::uuid, (c.v->>'st_x')::uuid
     from ctx c $$,
  '23514',
  null,
  'cannot write a sign-off on a submitted response'
);

-- EXISTING sign-off rows reject UPDATE and DELETE once the response is
-- submitted. Build a fresh response, create a sign-off while it is still
-- in_progress, submit it, then prove both UPDATE and DELETE of that row raise.
create temp table resp2 on commit drop as select gen_random_uuid() as id;
create temp table so2 on commit drop as select gen_random_uuid() as id;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
select (select id from resp2), (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from ctx c;

-- Sign-off created while in_progress (guard allows it; RLS bypassed as postgres).
insert into public.response_section_signoffs (id, response_id, section_id, signed_by, note)
select (select id from so2), (select id from resp2), (c.v->>'sec_u')::uuid, (c.v->>'st_x')::uuid, 'antes'
from ctx c;

-- Answer the required item and submit under the guard.
insert into public.answers (response_id, item_id, question_key, value)
select (select id from resp2), (c.v->>'item_mc')::uuid, 'u_q1', '"Sim"'::jsonb from ctx c;
select set_config('app.in_submit_rpc','on', true);
update public.responses set status='submitted', submitted_at=now() where id = (select id from resp2);
select set_config('app.in_submit_rpc','off', true);

select throws_ok(
  $$ update public.response_section_signoffs set note = 'depois'
     where id = (select id from so2) $$,
  '23514',
  null,
  'cannot UPDATE an existing sign-off of a submitted response'
);

select throws_ok(
  $$ delete from public.response_section_signoffs where id = (select id from so2) $$,
  '23514',
  null,
  'cannot DELETE an existing sign-off of a submitted response'
);

select * from finish();
rollback;

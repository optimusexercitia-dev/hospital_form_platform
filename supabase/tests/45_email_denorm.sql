-- Phase 3 / M9: email denormalization onto public.profiles (ADR 0010).
-- Proves: (1) the signup trigger copies auth.users.email onto the new profile;
-- (2) the email-change sync trigger keeps profiles.email fresh; (3) email rides
-- on the existing profiles_select policy — a co-member can read another member's
-- email, a foreign-commission staff cannot.

begin;
select plan(5);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- =========================================================================
-- (1) Signup trigger populates profiles.email from auth.users.email.
-- bootstrap() created its users with email '<uuid>@test'; the trigger ran.
-- =========================================================================
select is(
  (select email::text from public.profiles where id = (select (v->>'st_x')::uuid from ctx)),
  (select (v->>'st_x')::text from ctx) || '@test',
  'signup trigger copied auth.users.email onto profiles.email'
);

-- =========================================================================
-- (2) Email-change sync trigger mirrors an auth email change onto the profile.
-- =========================================================================
update auth.users
set email = 'changed-' || (select (v->>'st_x')::uuid from ctx) || '@test'
where id = (select (v->>'st_x')::uuid from ctx);

select is(
  (select email::text from public.profiles where id = (select (v->>'st_x')::uuid from ctx)),
  'changed-' || (select (v->>'st_x')::text from ctx) || '@test',
  'email-change sync trigger updated profiles.email to match auth.users.email'
);

-- =========================================================================
-- (3) Visibility under profiles_select_self_or_admin.
-- =========================================================================
-- A co-member (staff X2) can read another X member's (staff X) email.
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;

select isnt(
  (select email from public.profiles where id = (select (v->>'st_x')::uuid from ctx)),
  null,
  'a co-member can read another member''s denormalized email'
);
select is(
  (select count(*)::int from public.profiles
     where id = (select (v->>'st_x')::uuid from ctx) and email is not null),
  1,
  'co-member sees exactly the one profile row with its email'
);

reset role;

-- A staff of commission Y (no shared commission) cannot read X-member profiles.
select test_helpers.claims_for((select (v->>'st_y')::uuid from ctx), false);
set local role authenticated;

select is(
  (select count(*)::int from public.profiles
     where id = (select (v->>'st_x')::uuid from ctx)),
  0,
  'a foreign-commission staff cannot read an X member''s profile/email'
);

reset role;

select * from finish();
rollback;

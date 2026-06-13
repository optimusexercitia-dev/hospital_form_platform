-- Response-fill RPCs (M11): save_section_answers (upsert idempotency, value
-- update, last_section_id bump, orphan-clear, cross-version rejection) and
-- start_or_resume_response (resume existing, create fresh, one-draft conflict
-- handling). Plus the cross-cutting RLS / immutability cases: foreign-user and
-- cross-commission rejection, and that no new write path mutates a submitted
-- response. The RPCs are security-invoker, so we act as the response owner
-- (authenticated) for the calls; assertions on resulting rows reset to the
-- superuser role to read freely.

begin;
select plan(16);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- =========================================================================
-- start_or_resume_response
-- =========================================================================

-- ---- 1) creates a fresh in_progress draft on the unsectioned form U ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
create temp table resumed on commit drop as
  select (public.start_or_resume_response((select (v->>'ver_u')::uuid from ctx))).id as rid;
reset role;
grant select on resumed to authenticated;

select isnt(
  (select rid from resumed),
  null,
  'start_or_resume_response creates an in_progress draft when none exists'
);

select is(
  (select count(*)::int from public.responses
     where form_version_id = (select (v->>'ver_u')::uuid from ctx)
       and created_by = (select (v->>'st_x')::uuid from ctx)
       and status = 'in_progress'),
  1,
  'exactly one in_progress draft exists after the first start_or_resume call'
);

-- ---- 2) a second call RESUMES the same draft (no new row, no conflict) ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (public.start_or_resume_response((select (v->>'ver_u')::uuid from ctx))).id,
  (select rid from resumed),
  'a second start_or_resume returns the SAME existing draft (resume, not duplicate)'
);
reset role;

select is(
  (select count(*)::int from public.responses
     where form_version_id = (select (v->>'ver_u')::uuid from ctx)
       and created_by = (select (v->>'st_x')::uuid from ctx)
       and status = 'in_progress'),
  1,
  'still exactly one in_progress draft (one-draft unique index respected)'
);

-- ---- 3) cross-commission: staff Y cannot start a draft on form S (comm X) ----
-- form_versions_select requires commission membership, so a non-member cannot
-- even SEE the version: the resolve-version SELECT returns nothing and the RPC
-- raises no_data_found (P0002) BEFORE reaching the RLS-gated insert. Either way
-- the non-member is denied — this asserts the version stays invisible to them.
select test_helpers.claims_for((select (v->>'st_y')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.start_or_resume_response(%L) $$, (select (v->>'ver_s')::uuid from ctx)),
  'P0002',  -- no_data_found: the version is not visible to a non-member (RLS)
  null,
  'a non-member is rejected when starting a response in another commission (version invisible)'
);
reset role;

-- =========================================================================
-- save_section_answers
-- =========================================================================

-- ---- 4) upsert: a section save writes one answer row per item + last_section ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format(
    $$ select public.save_section_answers(%L, %L, %L::jsonb) $$,
    (select rid from resumed),
    (select (v->>'sec_u')::uuid from ctx),
    (select jsonb_build_object((v->>'item_mc'), '"Sim"'::jsonb)::text from ctx)
  ),
  'save_section_answers upserts a section''s answers'
);
reset role;

select is(
  (select value from public.answers
     where response_id = (select rid from resumed)
       and item_id = (select (v->>'item_mc')::uuid from ctx)),
  '"Sim"'::jsonb,
  'the upserted answer has the saved value and resolves its question_key'
);

select is(
  (select last_section_id from public.responses where id = (select rid from resumed)),
  (select (v->>'sec_u')::uuid from ctx),
  'save_section_answers sets responses.last_section_id'
);

-- ---- 5) idempotency + value update: saving again updates in place ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from resumed),
  (select (v->>'sec_u')::uuid from ctx),
  (select jsonb_build_object((v->>'item_mc'), '"Não"'::jsonb) from ctx)
);
reset role;

select is(
  (select count(*)::int from public.answers
     where response_id = (select rid from resumed)
       and item_id = (select (v->>'item_mc')::uuid from ctx)),
  1,
  'a repeated save updates in place — still exactly one answer row (idempotent upsert)'
);

select is(
  (select value from public.answers
     where response_id = (select rid from resumed)
       and item_id = (select (v->>'item_mc')::uuid from ctx)),
  '"Não"'::jsonb,
  'the repeated save overwrites the previous value'
);

-- ---- 6) cross-version guard: an item from another version is rejected ----
-- item_mc belongs to ver_u; start a sectioned response on ver_s and try to
-- write item_mc into it (an item from a DIFFERENT version of a different form).
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
create temp table rs on commit drop as
  select (public.start_or_resume_response((select (v->>'ver_s')::uuid from ctx))).id as rid;
reset role;
grant select on rs to authenticated;

select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format(
    $$ select public.save_section_answers(%L, %L, %L::jsonb) $$,
    (select rid from rs),
    (select (v->>'sec_s1')::uuid from ctx),
    (select jsonb_build_object((v->>'item_mc'), '"Sim"'::jsonb)::text from ctx)
  ),
  '23514',  -- check_violation: the cross-version guard
  null,
  'an item from a different version of the form is rejected (cross-version guard)'
);
reset role;

-- ---- 7) orphan-clear: clearing the conditional section's answers deletes them ----
-- Answer the gate ('Sim' shows the conditional) + the conditional's input.
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from rs),
  (select (v->>'sec_s1')::uuid from ctx),
  (select jsonb_build_object((v->>'it_gate'), '"Sim"'::jsonb) from ctx)
);
select public.save_section_answers(
  (select rid from rs),
  (select (v->>'sec_cond')::uuid from ctx),
  (select jsonb_build_object((v->>'it_cond'), '"detalhe"'::jsonb) from ctx)
);
reset role;

select is(
  (select count(*)::int from public.answers
     where response_id = (select rid from rs)
       and item_id = (select (v->>'it_cond')::uuid from ctx)),
  1,
  'precondition: the conditional section has a saved answer'
);

-- Now flip the gate to 'Não' (hides the conditional) and clear the orphan in
-- the SAME save call via p_clear_item_ids.
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from rs),
  (select (v->>'sec_s1')::uuid from ctx),
  (select jsonb_build_object((v->>'it_gate'), '"Não"'::jsonb) from ctx),
  array[(select (v->>'it_cond')::uuid from ctx)]
);
reset role;

select is(
  (select count(*)::int from public.answers
     where response_id = (select rid from rs)
       and item_id = (select (v->>'it_cond')::uuid from ctx)),
  0,
  'orphan-clear deletes the now-hidden section''s answers in the same save call'
);

-- =========================================================================
-- Foreign-user + submitted-immutability
-- =========================================================================

-- ---- 8) foreign user cannot save into someone else's draft ----
-- st_x2 (a different staff in comm X) targets st_x's resumed draft. RLS reads
-- it as "not found" (responses_select excludes other members' in_progress).
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format(
    $$ select public.save_section_answers(%L, %L, '{}'::jsonb) $$,
    (select rid from resumed),
    (select (v->>'sec_u')::uuid from ctx)
  ),
  'P0002',  -- no_data_found
  null,
  'a foreign user cannot save into another user''s in_progress draft (reads as not found)'
);
reset role;

-- ---- 9) submitted-immutability: no save path mutates a submitted response ----
-- Submit the unsectioned draft (its only required item is answered 'Não'),
-- then attempt a save against it.
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select public.submit_response((select rid from resumed));
reset role;

select is(
  (select status from public.responses where id = (select rid from resumed)),
  'submitted',
  'precondition: the response is submitted'
);

select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format(
    $$ select public.save_section_answers(%L, %L, %L::jsonb) $$,
    (select rid from resumed),
    (select (v->>'sec_u')::uuid from ctx),
    (select jsonb_build_object((v->>'item_mc'), '"Sim"'::jsonb)::text from ctx)
  ),
  null,  -- any error: the in_progress status guard rejects it before any write
  null,
  'save_section_answers cannot mutate a submitted response (immutability holds)'
);
reset role;

select * from finish();
rollback;

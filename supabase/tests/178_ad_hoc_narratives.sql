-- Ad-hoc Narratives on an open Case — migration 20260701000000_ad_hoc_narratives.sql.
--
-- Mirrors the ad-hoc Phase growth path (add_ad_hoc_phase) for narratives. Proves
-- public.add_ad_hoc_narrative:
--   * a coordinator adds a narrative on an OPEN case with an EXISTING type;
--   * inline new-type create-or-reuse: adding twice with the same label REUSES
--     the vocabulary row (no duplicate case_narrative_types);
--   * a terminal (concluido) case → HC020;
--   * a non-member assignee → HC021;
--   * a wrong-commission p_narrative_type_id → HC054;
--   * display_position lands strictly AFTER all existing phases+narratives;
--   * a plain staff member (non-coordinator) → 42501;
--   * body_md/title/instructions never leak into any audit_log.metadata row.
--
-- Flags case_narratives + cases_multi_phase + audit_trail ON; case_access OFF
-- (coordinator inline path, matching 116_case_narratives).

begin;
select plan(14);

update app.feature_flags set enabled = true
  where key in ('case_narratives', 'cases_multi_phase', 'audit_trail');
update app.feature_flags set enabled = false where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- A narrative type in commission X, and one in commission Y (for the HC054 test).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table nt on commit drop as
  select (public.create_case_narrative_type((select comm_x from k), 'Resumo Clínico', null)).id as x_type;
grant select on nt to authenticated;
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table nt_y on commit drop as
  select (public.create_case_narrative_type((select comm_y from k), 'Resumo Y', null)).id as y_type;
grant select on nt_y to authenticated;
reset role;

-- An open (nao_iniciado, non-terminal) process-less case in commission X.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case((select comm_x from k), 'Caso narrativa avulsa')).id as cid;
grant select on cse to authenticated;
reset role;

-- =========================================================================
-- 1) Coordinator adds an ad-hoc narrative with an EXISTING type.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table n1 on commit drop as
  select (public.add_ad_hoc_narrative(
            (select cid from cse), (select x_type from nt), null,
            null, null, (select sa_x from k))).id as nid;
grant select on n1 to authenticated;
reset role;

select ok(
  (select nid from n1) is not null,
  'add_ad_hoc_narrative appends a narrative to an open case (existing type)');
select is(
  (select is_ad_hoc from public.case_narratives where id = (select nid from n1)),
  true,
  'the appended narrative is flagged is_ad_hoc = true');
select is(
  (select display_label from public.case_narratives where id = (select nid from n1)),
  'Resumo Clínico',
  'display_label snapshots the resolved type label when no title override is given');
select is(
  (select assigned_to from public.case_narratives where id = (select nid from n1)),
  (select sa_x from k),
  'the assignee is stored on the narrative');

-- =========================================================================
-- 2) display_position lands strictly AFTER all existing phases + narratives.
--    The case has one add-hoc phase (dp 1) + narrative n1 (dp from step 1);
--    a second narrative must land at max(dp)+1.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_ad_hoc_phase((select cid from cse), (select form_u from k), 'Fase avulsa');
create temp table n2 on commit drop as
  select (public.add_ad_hoc_narrative(
            (select cid from cse), (select x_type from nt), null,
            'Título override', 'Instruções', null)).id as nid;
grant select on n2 to authenticated;
reset role;

select is(
  (select display_position from public.case_narratives where id = (select nid from n2)),
  (select max(dp) + 1 from (
     select coalesce(display_position, position) as dp
     from public.case_phases where case_id = (select cid from cse)
     union all
     select display_position as dp
     from public.case_narratives where case_id = (select cid from cse)
       and id <> (select nid from n2)
   ) s),
  'display_position lands strictly after all existing phases + narratives');
select is(
  (select display_label from public.case_narratives where id = (select nid from n2)),
  'Título override',
  'a title override wins over the type label for the snapshot display_label');

-- =========================================================================
-- 3) Inline new-type create-or-reuse: adding twice with the same label REUSES.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_ad_hoc_narrative((select cid from cse), null, 'Nova Narrativa Inline');
select public.add_ad_hoc_narrative((select cid from cse), null, 'Nova Narrativa Inline');
reset role;

select is(
  (select count(*)::int from public.case_narrative_types
   where commission_id = (select comm_x from k) and label = 'Nova Narrativa Inline'),
  1,
  'inline new-type create-or-reuse: the second identical label REUSES (no duplicate type)');

-- =========================================================================
-- 3b) Inline reuse of an ARCHIVED type un-archives it (M3): matching an archived
--     label reuses that row AND flips archived=false (so it's picker-visible).
-- =========================================================================
-- Archive the 'Resumo Clínico' type (x_type), then add a narrative whose
-- p_new_type_label matches it.
update public.case_narrative_types set archived = true where id = (select x_type from nt);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_ad_hoc_narrative((select cid from cse), null, 'Resumo Clínico');
reset role;

select is(
  (select count(*)::int from public.case_narrative_types
   where commission_id = (select comm_x from k) and label = 'Resumo Clínico'),
  1,
  'inline reuse of an archived label REUSES that row (no duplicate type)');
select is(
  (select archived from public.case_narrative_types where id = (select x_type from nt)),
  false,
  'inline reuse of an archived type flips it back to archived=false (picker-visible)');

-- =========================================================================
-- 4) A non-member assignee → HC021.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_ad_hoc_narrative(%L, %L, null, null, null, %L) $$,
         (select cid from cse), (select x_type from nt), (select sa_y from k)),
  'HC021', null,
  'add_ad_hoc_narrative with a non-member assignee → HC021');
reset role;

-- =========================================================================
-- 5) A wrong-commission p_narrative_type_id → HC054.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_ad_hoc_narrative(%L, %L) $$,
         (select cid from cse), (select y_type from nt_y)),
  'HC054', null,
  'add_ad_hoc_narrative with a cross-commission type → HC054');
reset role;

-- =========================================================================
-- 6) A plain staff member (non-coordinator) → 42501.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_ad_hoc_narrative(%L, %L) $$,
         (select cid from cse), (select x_type from nt)),
  '42501', null,
  'a plain staff (non-coordinator) cannot add_ad_hoc_narrative → 42501');
reset role;

-- =========================================================================
-- 7) A terminal (concluido) case → HC020.
-- =========================================================================
-- Settle every phase, then close the case.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase(id)
  from public.case_phases where case_id = (select cid from cse) and status = 'pending';
select public.close_case((select cid from cse));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_ad_hoc_narrative(%L, %L) $$,
         (select cid from cse), (select x_type from nt)),
  'HC020', null,
  'add_ad_hoc_narrative on a terminal (concluido) case → HC020');
reset role;

-- =========================================================================
-- 8) AUDIT: no body_md/title/instructions value leaks into audit metadata.
-- =========================================================================
-- n2 carried title 'Título override' + instructions 'Instruções'. The title
-- override legitimately becomes the audited display_label snapshot; what Rule 11
-- forbids is copying the free-text title/instructions/body_md payloads. Assert no
-- narrative audit row exposes those keys, nor the 'Instruções' free-text value.
select ok(
  not exists (
    select 1 from public.audit_log al
    join public.case_narratives cn on cn.id = al.entity_id
    where cn.case_id = (select cid from cse)
      and (al.metadata ? 'title' or al.metadata ? 'instructions'
           or al.metadata ? 'body_md'
           or al.metadata::text ilike '%Instruções%')
  ),
  'ad-hoc narrative audit metadata NEVER carries title / instructions / body_md payloads (Rule 11)');

select * from finish();
rollback;

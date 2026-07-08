-- discard_response RPC (F9 / B1): discard the caller's OWN in_progress draft
-- response for a STANDALONE form (case_phase_id IS NULL). SECURITY INVOKER, so we
-- act as the response owner (authenticated) for the calls; fixture setup + row
-- assertions run as the superuser. Covers: owner discards own standalone draft
-- (+ cascade), non-owner refused, submitted refused, case-bound refused, and the
-- payload-free audit row.

begin;
select plan(10);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- Ensure the audit trail is ON so the discard audit row is written + assertable.
update app.feature_flags set enabled = true where key = 'audit_trail';

-- ---------------------------------------------------------------------------
-- Fixtures: three standalone in_progress drafts on form S, all owned by st_x,
-- plus one case-bound draft. r_ok = happy path; r_nonowner = refused for st_x2;
-- r_submitted = flipped to submitted; r_case = case-bound.
-- ---------------------------------------------------------------------------
create temp table r on commit drop as
  select gen_random_uuid() as r_ok,
         gen_random_uuid() as r_nonowner,
         gen_random_uuid() as r_submitted,
         gen_random_uuid() as r_case;
grant select on r to authenticated;

-- The one-draft-per-user unique index covers only (in_progress AND case_phase_id
-- IS NULL), so the two standalone in_progress drafts owned by st_x MUST sit on
-- DIFFERENT versions (ver_s / ver_u, both published + standalone in comm_x); the
-- submitted + case-bound drafts are exempt from that index and can reuse ver_s.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r.r_ok, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r, ctx c;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r.r_nonowner, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r, ctx c;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r.r_submitted, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r, ctx c;

-- Give r_ok a couple of answers to prove the cascade deletes them.
insert into public.answers (response_id, item_id, question_key, value)
select r.r_ok, (c.v->>'it_gate')::uuid, 's_gate', '"Não"'::jsonb from r, ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select r.r_ok, (c.v->>'it_req')::uuid, 's_req', '"Sim"'::jsonb from r, ctx c;

-- Case-bound fixture: a minimal case + case_phase, then a draft referencing it.
create temp table cf on commit drop as
  select gen_random_uuid() as case_id, gen_random_uuid() as phase_id;
grant select on cf to authenticated;

insert into public.cases (id, commission_id, case_number, created_by, status)
select cf.case_id, (c.v->>'comm_x')::uuid, 9001, (c.v->>'st_x')::uuid, 'em_revisao'
from cf, ctx c;
insert into public.case_phases (id, case_id, position, form_id, form_version_id, status)
select cf.phase_id, cf.case_id, 0, (c.v->>'form_s')::uuid, (c.v->>'ver_s')::uuid, 'ativa'
from cf, ctx c;
insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
select r.r_case, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress', cf.phase_id
from r, ctx c, cf;

-- ---- 1) a non-owner (st_x2, same commission) cannot discard st_x's draft ----
-- RLS hides the row from st_x2 → the RPC's read finds nothing → no_data_found.
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_response(%L) $$, (select r_nonowner from r)),
  'P0002',
  null,
  'a non-owner member cannot discard another user''s draft (no_data_found)'
);
reset role;

-- The non-owner's failed attempt left the row intact.
select is(
  (select count(*)::int from public.responses where id = (select r_nonowner from r)),
  1,
  'the draft survives a non-owner discard attempt'
);

-- ---- 2) a submitted response cannot be discarded (HC065) ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_response(%L) $$, (select r_submitted from r)),
  'HC065',
  null,
  'a submitted response cannot be discarded (HC065)'
);
reset role;

select is(
  (select count(*)::int from public.responses where id = (select r_submitted from r)),
  1,
  'the submitted response survives the discard attempt'
);

-- ---- 3) a case-bound draft cannot be discarded via the standalone path (HC066) ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_response(%L) $$, (select r_case from r)),
  'HC066',
  null,
  'a case-bound draft is refused by the standalone discard (HC066)'
);
reset role;

select is(
  (select count(*)::int from public.responses where id = (select r_case from r)),
  1,
  'the case-bound draft survives the standalone discard attempt'
);

-- ---- 4) the owner discards their own standalone in_progress draft ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.discard_response(%L) $$, (select r_ok from r)),
  'the owner discards their own standalone in_progress draft'
);
reset role;

-- The response row is gone AND its answers cascaded away.
select is(
  (select count(*)::int from public.responses where id = (select r_ok from r)),
  0,
  'the discarded response row is deleted'
);
select is(
  (select count(*)::int from public.answers where response_id = (select r_ok from r)),
  0,
  'the discarded response''s answers cascade-delete'
);

-- ---- 5) exactly one payload-free response.discarded audit row was written ----
select is(
  (select count(*)::int from public.audit_log
     where action = 'response.discarded'
       and entity_id = (select r_ok from r)
       -- Rule 11: the audit row never copies answer payloads. Assert the metadata
       -- carries no answer value/free-text keys (a diff of only structural cols).
       and not (metadata ? 'value')),
  1,
  'a single payload-free response.discarded audit row is recorded'
);

select * from finish();
rollback;

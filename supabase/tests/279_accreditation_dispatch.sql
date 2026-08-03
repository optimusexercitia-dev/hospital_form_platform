-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration B
-- dispatch + freshness predicates. ADR 0093 D4/D5 + Amendment 2 + Amendment 3
-- (A3·1/A3·2/A3·3). Migrations 20260903000900_accreditation_dispatch.sql,
-- 20260903001000_capa_plan_open_atencao.sql (the A3·1 fix), and
-- 20260903001100_action_item_open_blocked_atencao.sql (the A3·3 fix).
--
--   §A — ARM PARITY BY CONSTRUCTION. The kind list is read out of the LIVE
--        evidence_links.artifact_kind CHECK at runtime (never hardcoded) and
--        iterated — a future kind added to the CHECK without a matching arm
--        in either function goes red on its own. Plus: the ELSE-raise arms
--        actually raise for a kind outside the CHECK (safety_event —
--        declined per D4).
--   §B — Positive + negative `belongs` per kind (all 10), incl. the
--        cross-hospital CAPA rejection (Amendment 1 A1·1) and the two
--        structural negatives (charter with no row; ethics_procedure whose
--        case has no ethics_case_details).
--   §C — The freshness matrix, cell by cell, incl. the
--        review_due_date = current_date boundary (valida, not vencida), the
--        changes_requested -> vencida cell (PO ruling, Amendment 2 A2·3),
--        capa_plan open -> atencao DISTINCT from cancelled -> vencida (PO
--        ruling, Amendment 3 A3·1 — the whole point is the split, so a
--        dedicated assertion proves the two never share a bucket again),
--        action_item open/blocked -> atencao (Amendment 3 A3·3, aligning
--        action_item with capa_plan's A3·1 ruling — 'open' meant "live
--        commitment" for one and "absent proof" for the other before this),
--        PLUS a dedicated cross-kind assertion that action_item's and
--        capa_plan's 'open' report the SAME bucket — the durable, permanent
--        form of the A3·3 consistency ruling, not a one-time value check —
--        and meeting held -> atencao / signed -> valida (Amendment 3 A3·2,
--        confirmed no change — signature is the evidentiary act).
--
-- FORWARD-LOOKING NOTE (ADR 0093 A3·3, binding on future edits to this
-- file): a new lifecycle cell added here must be bucketed against the
-- A3·1/A3·3 rationale (live/tracked -> atencao vs abandoned/never-started ->
-- vencida), not copied from whichever sibling cell looked similar — that is
-- exactly how the action_item arm drifted from capa_plan in the first pass.
--
-- MUTATION DISCIPLINE (per the work instruction): every keystone below was
-- broken by hand against the live local stack — a scratch `create or
-- replace function` swapped in a regressed body, the SAME assertion in this
-- file was re-run and confirmed RED, then the correct function was restored
-- via a fresh `supabase db reset --local` — before this file was considered
-- done. What broke and what went red is in the turn's report, not encoded
-- here (a permanent test file is not the place to ship a temporarily-broken
-- function). Keystones proved this way: K1 fail-open coalesce (a
-- nonexistent-artifact belongs check would return NULL, not FALSE, without
-- it), K2 the review_due_date boundary, K3 the arm-parity guard itself
-- (§A1/§A2 catch a removed arm), K4 the cross-hospital CAPA rejection, K5
-- the changes_requested -> vencida PO ruling, K6 the capa_plan
-- open/cancelled split (Amendment 3 A3·1), K7 the action_item
-- open/blocked -> atencao alignment with capa_plan (Amendment 3 A3·3).

begin;

select plan(61);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_b,
         (v->>'hosp_b')::uuid  as hosp_b
  from ctx;
grant select on k to authenticated;

-- A second hospital — needed ONLY for the cross-hospital CAPA negative.
create temp table h2 on commit drop as select gen_random_uuid() as hosp_c;
grant select on h2 to authenticated;
insert into public.hospitals (id, organization_id, name, slug)
  select hosp_c, (select org_b from k), 'Hosp 279', 'hosp-279-' || substr(hosp_c::text, 1, 8)
  from h2;

-- ===========================================================================
-- Fixtures (owner role — RLS bypassed to set up the world).
-- ===========================================================================

-- form_a/b/c: each PUBLISHES one version, differing only in review_due_date
-- (future / boundary=today / past) — covers BOTH the 'form' kind (which
-- resolves to whichever version is currently published) and the
-- 'form_version' kind (which addresses that version directly) with the same
-- three rows. form_d has a DRAFT-only version (never published).
insert into public.forms (id, commission_id, title, created_by) select
  '27900000-0000-0000-0000-000000000a01'::uuid, comm_x, '279 Form A', admin from k union all select
  '27900000-0000-0000-0000-000000000a02'::uuid, comm_x, '279 Form B', admin from k union all select
  '27900000-0000-0000-0000-000000000a03'::uuid, comm_x, '279 Form C', admin from k union all select
  '27900000-0000-0000-0000-000000000a04'::uuid, comm_x, '279 Form D', admin from k;

insert into public.form_versions (id, form_id, version_number, status, review_due_date) values
  ('27900000-0000-0000-0000-000000000b01', '27900000-0000-0000-0000-000000000a01', 1, 'published', current_date + 30),
  ('27900000-0000-0000-0000-000000000b02', '27900000-0000-0000-0000-000000000a02', 1, 'published', current_date),
  ('27900000-0000-0000-0000-000000000b03', '27900000-0000-0000-0000-000000000a03', 1, 'published', current_date - 5),
  ('27900000-0000-0000-0000-000000000b04', '27900000-0000-0000-0000-000000000a04', 1, 'draft', current_date + 30);

-- meetings: signed (valida) / held (atencao) / scheduled (vencida).
insert into public.meetings (id, commission_id, title, status, scheduled_start) select
  '27900000-0000-0000-0000-000000000c01'::uuid, comm_x, '279 Reunião Signed', 'signed', now() from k union all select
  '27900000-0000-0000-0000-000000000c02'::uuid, comm_x, '279 Reunião Held', 'held', now() from k union all select
  '27900000-0000-0000-0000-000000000c03'::uuid, comm_x, '279 Reunião Scheduled', 'scheduled', now() + interval '1 day' from k;

-- cases: case_x carries ethics_case_details (the ethics_procedure host);
-- case_y does NOT (the "commission matches but no ethics details" negative).
insert into public.cases (id, commission_id, organization_id, case_number, created_by) select
  '27900000-0000-0000-0000-000000000d01'::uuid, comm_x, org_b, 27901, admin from k union all select
  '27900000-0000-0000-0000-000000000d02'::uuid, comm_x, org_b, 27902, admin from k;
insert into public.ethics_case_details (case_id) values ('27900000-0000-0000-0000-000000000d01'::uuid);

-- indicator: mensal frequency (cutoff = today - 1 month). Three measurements
-- probe on_target (valida) / off_target (atencao, same window) / a fourth,
-- OUT-of-window indicator proves "no measurement in window" (vencida) and a
-- fifth, archived indicator proves the status gate independent of any
-- measurement.
insert into public.indicators (id, commission_id, code, name, kind, frequency, status, created_by) select
  '27900000-0000-0000-0000-000000000e01'::uuid, comm_x, '279-IND-1', '279 Indicador On-Target', 'contagem', 'mensal', 'active', admin from k union all select
  '27900000-0000-0000-0000-000000000e02'::uuid, comm_x, '279-IND-2', '279 Indicador Off-Target', 'contagem', 'mensal', 'active', admin from k union all select
  '27900000-0000-0000-0000-000000000e03'::uuid, comm_x, '279-IND-3', '279 Indicador Sem Medição na Janela', 'contagem', 'mensal', 'active', admin from k union all select
  '27900000-0000-0000-0000-000000000e04'::uuid, comm_x, '279-IND-4', '279 Indicador Arquivado', 'contagem', 'mensal', 'archived', admin from k;

insert into public.indicator_measurements (indicator_id, period_label, period_start, value, status, source) values
  ('27900000-0000-0000-0000-000000000e01', 'Este mês', current_date - 5, 10, 'on_target', 'manual'),
  ('27900000-0000-0000-0000-000000000e02', 'Este mês', current_date - 5, 3, 'off_target', 'manual'),
  ('27900000-0000-0000-0000-000000000e03', 'Há 6 meses', current_date - interval '6 months', 3, 'on_target', 'manual');

-- controlled_documents: one document per freshness cell, current_version_id
-- pointed at the version under test. doc_no_version has current_version_id
-- left NULL.
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f01', comm_x, '279-DOC-1', '279 Doc Válida Futuro', 'policy', 'effective' from k limit 1;
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f02', comm_x, '279-DOC-2', '279 Doc Válida Hoje', 'policy', 'effective' from k limit 1;
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f03', comm_x, '279-DOC-3', '279 Doc Vencida Atraso', 'policy', 'effective' from k limit 1;
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f04', comm_x, '279-DOC-4', '279 Doc Atenção', 'policy', 'in_approval' from k limit 1;
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f05', comm_x, '279-DOC-5', '279 Doc Changes Requested', 'policy', 'changes_requested' from k limit 1;
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f06', comm_x, '279-DOC-6', '279 Doc Obsoleto', 'policy', 'obsolete' from k limit 1;
insert into public.controlled_documents (id, commission_id, code, title, doc_type, status) select
  '27900000-0000-0000-0000-000000000f07', comm_x, '279-DOC-7', '279 Doc Sem Versão', 'policy', 'draft' from k limit 1;

insert into public.controlled_document_versions (id, document_id, version_number, status, review_due_date) values
  ('27900000-0000-0000-0000-000000001001', '27900000-0000-0000-0000-000000000f01', 1, 'effective', current_date + 30),
  ('27900000-0000-0000-0000-000000001002', '27900000-0000-0000-0000-000000000f02', 1, 'effective', current_date),
  ('27900000-0000-0000-0000-000000001003', '27900000-0000-0000-0000-000000000f03', 1, 'effective', current_date - 5),
  ('27900000-0000-0000-0000-000000001004', '27900000-0000-0000-0000-000000000f04', 1, 'in_approval', current_date + 30),
  ('27900000-0000-0000-0000-000000001005', '27900000-0000-0000-0000-000000000f05', 1, 'changes_requested', current_date + 30),
  ('27900000-0000-0000-0000-000000001006', '27900000-0000-0000-0000-000000000f06', 1, 'obsolete', current_date + 30);

update public.controlled_documents set current_version_id = '27900000-0000-0000-0000-000000001001' where id = '27900000-0000-0000-0000-000000000f01';
update public.controlled_documents set current_version_id = '27900000-0000-0000-0000-000000001002' where id = '27900000-0000-0000-0000-000000000f02';
update public.controlled_documents set current_version_id = '27900000-0000-0000-0000-000000001003' where id = '27900000-0000-0000-0000-000000000f03';
update public.controlled_documents set current_version_id = '27900000-0000-0000-0000-000000001004' where id = '27900000-0000-0000-0000-000000000f04';
update public.controlled_documents set current_version_id = '27900000-0000-0000-0000-000000001005' where id = '27900000-0000-0000-0000-000000000f05';
update public.controlled_documents set current_version_id = '27900000-0000-0000-0000-000000001006' where id = '27900000-0000-0000-0000-000000000f06';
-- 279-DOC-7 (f07): current_version_id stays NULL — "no current version".

-- charter: comm_x links its bylaws to the "válida futuro" document (f01) —
-- proves the charter's inherited valida. comm_y gets NO charter row at all
-- (the "no row" belongs-negative AND the "no bylaws" vencida both fall out
-- of the same absent-row path).
insert into public.commission_charters (commission_id, meeting_frequency, controlled_document_id, created_by)
  select comm_x, 'mensal', '27900000-0000-0000-0000-000000000f01', admin from k;

-- action_items: reuse the GLOBAL seeded action_item_statuses (commission_id
-- IS NULL) — 'done' (category completed), 'in_progress', 'open'. 'blocked'
-- has no global seeded status, so comm_x gets one custom row for it (the
-- Amendment 3 A3·3 cell).
insert into public.action_item_statuses (id, commission_id, key, label, category, sort_order) select
  '27900000-0000-0000-0000-000000001104'::uuid, comm_x, '279-bloqueado', '279 Bloqueado', 'blocked', 90
  from k;

insert into public.action_items (id, commission_id, source_type, title, status_id) select
  '27900000-0000-0000-0000-000000001101'::uuid, comm_x, 'manual', '279 Item Concluído',
  (select ais.id from public.action_item_statuses ais where ais.key = 'done' and ais.commission_id is null)
  from k union all select
  '27900000-0000-0000-0000-000000001102'::uuid, comm_x, 'manual', '279 Item Em Andamento',
  (select ais.id from public.action_item_statuses ais where ais.key = 'in_progress' and ais.commission_id is null)
  from k union all select
  '27900000-0000-0000-0000-000000001103'::uuid, comm_x, 'manual', '279 Item Aberto',
  (select ais.id from public.action_item_statuses ais where ais.key = 'open' and ais.commission_id is null)
  from k union all select
  '27900000-0000-0000-0000-000000001106'::uuid, comm_x, 'manual', '279 Item Bloqueado',
  '27900000-0000-0000-0000-000000001104'::uuid
  from k;

-- capa_plan: four under hosp_b (comm_x's hospital) — completed / in_execution
-- / open / cancelled, the last two proving the Amendment 3 A3·1 split; one
-- under the FOREIGN hosp_c (the cross-hospital rejection target).
insert into public.capa_plan (id, hospital_id, source, classification, status, opened_by) select
  '27900000-0000-0000-0000-000000001201'::uuid, hosp_b, 'manual', 'corretiva', 'completed', admin from k union all select
  '27900000-0000-0000-0000-000000001202'::uuid, hosp_b, 'manual', 'corretiva', 'in_execution', admin from k union all select
  '27900000-0000-0000-0000-000000001203'::uuid, hosp_b, 'manual', 'corretiva', 'open', admin from k union all select
  '27900000-0000-0000-0000-000000001205'::uuid, hosp_b, 'manual', 'corretiva', 'cancelled', admin from k;
insert into public.capa_plan (id, hospital_id, source, classification, status, opened_by) select
  '27900000-0000-0000-0000-000000001204'::uuid, hosp_c, 'manual', 'corretiva', 'open', admin from k, h2;

-- ===========================================================================
-- §A · Arm parity BY CONSTRUCTION — the kind list comes from the live CHECK,
-- never a hardcoded copy in this file.
-- ===========================================================================
select lives_ok(
  $$
  do $BODY$
  declare
    v_kind text;
    v_kinds text[];
  begin
    select array_agg(m[1] order by m[1]) into v_kinds
    from pg_constraint pc, regexp_matches(pg_get_constraintdef(pc.oid), '''([a-z_]+)''', 'g') as m
    where pc.conname = 'evidence_links_artifact_kind_check';

    if v_kinds is null or array_length(v_kinds, 1) <> 10 then
      raise exception 'derived kind list is wrong: %', v_kinds;
    end if;

    foreach v_kind in array v_kinds loop
      begin
        perform app.artifact_belongs_to_commission(v_kind, gen_random_uuid(), gen_random_uuid());
      exception when others then
        if sqlerrm like '%unrecognized artifact_kind%' then
          raise exception 'MISSING ARM in artifact_belongs_to_commission for kind: %', v_kind;
        end if;
      end;
    end loop;
  end
  $BODY$;
  $$,
  'A1. every live evidence_links.artifact_kind CHECK value (derived at runtime) has a matching arm in artifact_belongs_to_commission'
);

select lives_ok(
  $$
  do $BODY$
  declare
    v_kind text;
    v_kinds text[];
  begin
    select array_agg(m[1] order by m[1]) into v_kinds
    from pg_constraint pc, regexp_matches(pg_get_constraintdef(pc.oid), '''([a-z_]+)''', 'g') as m
    where pc.conname = 'evidence_links_artifact_kind_check';

    foreach v_kind in array v_kinds loop
      begin
        perform app.evidence_status_of(v_kind, gen_random_uuid());
      exception when others then
        if sqlerrm like '%unrecognized artifact_kind%' then
          raise exception 'MISSING ARM in evidence_status_of for kind: %', v_kind;
        end if;
      end;
    end loop;
  end
  $BODY$;
  $$,
  'A2. every live evidence_links.artifact_kind CHECK value (derived at runtime) has a matching arm in evidence_status_of'
);

select throws_ok(
  $$ select app.artifact_belongs_to_commission('safety_event', gen_random_uuid(), gen_random_uuid()) $$,
  'P0001', null,
  'A3. a kind outside the CHECK (safety_event — declined, D4) raises in artifact_belongs_to_commission'
);
select throws_ok(
  $$ select app.evidence_status_of('safety_event', gen_random_uuid()) $$,
  'P0001', null,
  'A4. same bogus kind raises in evidence_status_of'
);

-- ===========================================================================
-- §B · Positive + negative belongs, per kind.
-- ===========================================================================
select ok((select app.artifact_belongs_to_commission('form', '27900000-0000-0000-0000-000000000a01', comm_x) from k),
  'B1a. form belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('form', '27900000-0000-0000-0000-000000000a01', comm_y) from k),
  'B1b. that same form does NOT belong to a foreign commission');
select ok(not (select app.artifact_belongs_to_commission('form', gen_random_uuid(), comm_x) from k),
  'B1c. a NONEXISTENT form id belongs to nothing (fail-closed, not NULL — K1)');

select ok((select app.artifact_belongs_to_commission('form_version', '27900000-0000-0000-0000-000000000b01', comm_x) from k),
  'B2a. form_version belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('form_version', '27900000-0000-0000-0000-000000000b01', comm_y) from k),
  'B2b. that same form_version does NOT belong to a foreign commission');

select ok((select app.artifact_belongs_to_commission('meeting', '27900000-0000-0000-0000-000000000c01', comm_x) from k),
  'B3a. meeting belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('meeting', '27900000-0000-0000-0000-000000000c01', comm_y) from k),
  'B3b. that same meeting does NOT belong to a foreign commission');

select ok((select app.artifact_belongs_to_commission('case', '27900000-0000-0000-0000-000000000d01', comm_x) from k),
  'B4a. case belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('case', '27900000-0000-0000-0000-000000000d01', comm_y) from k),
  'B4b. that same case does NOT belong to a foreign commission');

select ok((select app.artifact_belongs_to_commission('indicator', '27900000-0000-0000-0000-000000000e01', comm_x) from k),
  'B5a. indicator belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('indicator', '27900000-0000-0000-0000-000000000e01', comm_y) from k),
  'B5b. that same indicator does NOT belong to a foreign commission');

select ok((select app.artifact_belongs_to_commission('controlled_document', '27900000-0000-0000-0000-000000000f01', comm_x) from k),
  'B6a. controlled_document belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('controlled_document', '27900000-0000-0000-0000-000000000f01', comm_y) from k),
  'B6b. that same document does NOT belong to a foreign commission');

select ok((select app.artifact_belongs_to_commission('action_item', '27900000-0000-0000-0000-000000001101', comm_x) from k),
  'B7a. action_item belongs to its own commission');
select ok(not (select app.artifact_belongs_to_commission('action_item', '27900000-0000-0000-0000-000000001101', comm_y) from k),
  'B7b. that same action_item does NOT belong to a foreign commission');

select ok((select app.artifact_belongs_to_commission('charter', comm_x, comm_x) from k),
  'B8a. charter identity: comm_x''s own charter belongs to comm_x');
select ok(not (select app.artifact_belongs_to_commission('charter', comm_x, comm_y) from k),
  'B8b. comm_x''s charter artifact_id does NOT belong to comm_y (identity mismatch)');
select ok(not (select app.artifact_belongs_to_commission('charter', comm_y, comm_y) from k),
  'B8c. comm_y has NO commission_charters row — belongs is false, not an error');

select ok((select app.artifact_belongs_to_commission('ethics_procedure', '27900000-0000-0000-0000-000000000d01', comm_x) from k),
  'B9a. ethics_procedure (case_x has ethics_case_details) belongs to comm_x');
select ok(not (select app.artifact_belongs_to_commission('ethics_procedure', '27900000-0000-0000-0000-000000000d01', comm_y) from k),
  'B9b. that same ethics_procedure does NOT belong to a foreign commission');
select ok(not (select app.artifact_belongs_to_commission('ethics_procedure', '27900000-0000-0000-0000-000000000d02', comm_x) from k),
  'B9c. case_y belongs to comm_x but carries NO ethics_case_details row — not linkable as ethics_procedure');

select ok((select app.artifact_belongs_to_commission('capa_plan', '27900000-0000-0000-0000-000000001201', comm_x) from k),
  'B10a. capa_plan (hosp_b) belongs to comm_x (also hosp_b) — hospital match');
select ok(not (select app.artifact_belongs_to_commission('capa_plan', '27900000-0000-0000-0000-000000001204', comm_x) from k),
  'B10b. CROSS-HOSPITAL: a capa_plan under the FOREIGN hosp_c does NOT belong to comm_x (Amendment 1 A1·1 — K4)');

-- ===========================================================================
-- §C · Freshness matrix, cell by cell.
-- ===========================================================================
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f01') from k),
  'valida', 'C1. effective + review_due_date in the future = valida');
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f02') from k),
  'valida', 'C2. BOUNDARY: effective + review_due_date = current_date = valida, not vencida (K2)');
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f03') from k),
  'vencida', 'C3. effective + review_due_date in the past (overdue) = vencida');
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f04') from k),
  'atencao', 'C4. in_approval = atencao');
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f05') from k),
  'vencida', 'C5. changes_requested = vencida (PO ruling, Amendment 2 A2·3 — K5)');
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f06') from k),
  'vencida', 'C6. obsolete = vencida');
select is((select app.evidence_status_of('controlled_document', '27900000-0000-0000-0000-000000000f07') from k),
  'vencida', 'C7. draft (via a document with NO current_version_id) = vencida');

select is((select app.evidence_status_of('form', '27900000-0000-0000-0000-000000000a01') from k),
  'valida', 'C8. form: currently-published version, due in the future = valida');
select is((select app.evidence_status_of('form', '27900000-0000-0000-0000-000000000a02') from k),
  'valida', 'C9. form: BOUNDARY due = current_date = valida');
select is((select app.evidence_status_of('form', '27900000-0000-0000-0000-000000000a03') from k),
  'vencida', 'C10. form: overdue = vencida');
select is((select app.evidence_status_of('form', '27900000-0000-0000-0000-000000000a04') from k),
  'vencida', 'C11. form: no currently-published version (draft only) = vencida');

select is((select app.evidence_status_of('form_version', '27900000-0000-0000-0000-000000000b01') from k),
  'valida', 'C12. form_version: published, due in the future = valida');
select is((select app.evidence_status_of('form_version', '27900000-0000-0000-0000-000000000b04') from k),
  'vencida', 'C13. form_version: draft status = vencida regardless of its due date');

select is((select app.evidence_status_of('indicator', '27900000-0000-0000-0000-000000000e01') from k),
  'valida', 'C14. indicator: active, on_target measurement inside the current (mensal) window = valida');
select is((select app.evidence_status_of('indicator', '27900000-0000-0000-0000-000000000e02') from k),
  'atencao', 'C15. indicator: active, off_target measurement inside the window = atencao');
select is((select app.evidence_status_of('indicator', '27900000-0000-0000-0000-000000000e03') from k),
  'vencida', 'C16. indicator: only a 6-month-old measurement — outside the mensal window = vencida (no silent stale valida)');
select is((select app.evidence_status_of('indicator', '27900000-0000-0000-0000-000000000e04') from k),
  'vencida', 'C17. indicator: archived = vencida regardless of any measurement');

select is((select app.evidence_status_of('action_item', '27900000-0000-0000-0000-000000001101') from k),
  'valida', 'C18. action_item: category=completed (key ''done'') = valida');
select is((select app.evidence_status_of('action_item', '27900000-0000-0000-0000-000000001102') from k),
  'atencao', 'C19. action_item: category=in_progress = atencao');
select is((select app.evidence_status_of('action_item', '27900000-0000-0000-0000-000000001103') from k),
  'atencao', 'C20. action_item: category=open = atencao (Amendment 3 A3·3 — CHANGED, was vencida)');
select is((select app.evidence_status_of('action_item', '27900000-0000-0000-0000-000000001106') from k),
  'atencao', 'C20a. action_item: category=blocked = atencao (A3·3 — the most attention-worthy of the set)');

select is((select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001201') from k),
  'valida', 'C21. capa_plan: completed = valida');
select is((select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001202') from k),
  'atencao', 'C22. capa_plan: in_execution = atencao');
select is((select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001203') from k),
  'atencao', 'C23. capa_plan: open = atencao (Amendment 3 A3·1 — CHANGED, was vencida)');
select is((select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001205') from k),
  'vencida', 'C23a. capa_plan: cancelled = vencida');
select isnt(
  (select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001203') from k),
  (select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001205') from k),
  'C23b. open and cancelled do NOT share a bucket — the whole point of Amendment 3 A3·1''s split (K6)'
);
select is(
  (select app.evidence_status_of('action_item', '27900000-0000-0000-0000-000000001103') from k),
  (select app.evidence_status_of('capa_plan', '27900000-0000-0000-0000-000000001203') from k),
  'C23c. ''open'' reports the SAME bucket for action_item and capa_plan — the durable form of Amendment 3 A3·3''s consistency ruling (K7); a future divergence must red here, not pass quietly'
);

-- Amendment 3 A3·2 (confirmed, no change): signature is the evidentiary act
-- — a held-but-unsigned ata does NOT count as valida.
select is((select app.evidence_status_of('meeting', '27900000-0000-0000-0000-000000000c01') from k),
  'valida', 'C24. meeting: signed = valida');
select is((select app.evidence_status_of('meeting', '27900000-0000-0000-0000-000000000c02') from k),
  'atencao', 'C25. meeting: held = atencao (A3·2 — held-but-unsigned is NOT valida)');
select is((select app.evidence_status_of('meeting', '27900000-0000-0000-0000-000000000c03') from k),
  'vencida', 'C26. meeting: scheduled = vencida');

select is((select app.evidence_status_of('charter', comm_x) from k),
  'valida', 'C27. charter: inherits its linked bylaws document''s status (f01 = valida)');
select is((select app.evidence_status_of('charter', comm_y) from k),
  'vencida', 'C28. charter: comm_y has no charter/bylaws row at all = vencida (no silent valida)');

select is((select app.evidence_status_of('case', '27900000-0000-0000-0000-000000000d01') from k),
  'valida', 'C29. case: always valida (D5)');
select is((select app.evidence_status_of('ethics_procedure', '27900000-0000-0000-0000-000000000d01') from k),
  'valida', 'C30. ethics_procedure: always valida (D5)');

select * from finish();
rollback;

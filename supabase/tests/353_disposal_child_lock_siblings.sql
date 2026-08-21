-- =============================================================================
-- 353 — ADR 0129 Amendment 2: the LGPD erasure doors get through the RCA, CAPA,
--       INTERVIEW and MEETING_CASES child locks, and NOTHING ELSE DOES.
--
-- WHAT WAS BROKEN. ADR 0129 closed this class FOR THE MEETING LANE ONLY (suite `348`).
-- Three sibling child locks read no `app.in_*` GUC at all, and `meeting_cases` carried a
-- guard that DID read the flag which `dispose_case_phi` never set. Ten statements, four
-- guards, two doors. The guard raises, the RPC aborts, and **the Class-1 PHI DELETE that
-- ran FIRST is rolled back with it** — measured `event_patient` 1 -> 1,
-- `phi_disposed_at` NULL (`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`).
--
-- ⭐⭐ EVERY LANE ASSERTS THE CLASS-1 PHI IS GONE, NOT MERELY THAT FREE TEXT REDACTED.
-- That is the whole trap in this bug. A suite that pins only redaction goes GREEN while
-- the rollback defect is live, because on the failing path NOTHING is written — including
-- the redaction the suite would be checking. `event_patient` / `patient_identifiers`
-- reaching ZERO, and `phi_disposed_at` being STAMPED, are the assertions that can only
-- hold if the whole door committed.
--
-- ⭐ THE FIXTURES ARE CONSTRUCTED, NOT FOUND. Measured on a fresh reset, the seed's only
-- `rca` is `in_progress`, its only `capa_plan` is `in_execution`, its only
-- `case_interviews` is `awaiting_follow_up` and all three meetings are `held` — i.e. the
-- seed cannot reproduce ANY of the ten. A suite built on seed state is green either way
-- and proves nothing. Same lesson `348` had to learn one table over.
-- ⚠ Statuses are WALKED where the transition graph demands it and INSERTED where it does
-- not: `guard_{rca,capa,interview,meeting}_status` are all BEFORE **DELETE/UPDATE** (read
-- from `pg_trigger`'s tgtype mask, not assumed), so a fixture may be BORN at a legal
-- pre-lock status and then updated exactly once into the locked one. Children are always
-- inserted BEFORE the lock, because the lock is precisely what would refuse them after.
--
-- ⭐ THE THREE ADR 0129 OBLIGATIONS, PER LANE:
--   (a) locked/terminal parent WITH children populated => the door completes end-to-end;
--   (b) the NO-FLAG DIFFERENTIAL — same fixture, flag absent, a direct child UPDATE still
--       raises the lane's error. Without this the fix is untested: "disposal can now write
--       these children" is satisfied just as well by DELETING the guard;
--   (c) the SIBLING-RPC OVER-GRANT TWIN — a real lane RPC, past its own authorization
--       gate, still cannot write children of a locked parent. This is what pins SHAPE 1's
--       widening out: if someone later teaches a guard to honour `app.in_safety_rpc` /
--       `app.in_interview_rpc` / `app.in_meeting_rpc`, these go RED.
--
-- ⚠ DISCRIMINATE ON THE MESSAGE, NOT THE SQLSTATE. The interview and meeting locks raise
-- `check_violation` (23514), which sibling validations in the same doors also raise for
-- blank input. A bare `throws_ok(..., '23514')` would pass for the wrong reason and keep
-- passing with the guard removed. Every lock refusal below pins the guard's own message.
--
-- ⚠ EVERY REDACTION PIN IS PAIRED WITH A SIBLING-ROW SURVIVAL CONTROL. Each lane carries
-- a second, NEVER-DISPOSED parent (or, for meeting_cases, a second case on the same
-- locked meeting) whose free text must be byte-identical afterwards. Without it a pin
-- shaped "no row is un-redacted" is satisfied by `delete from <table>` or by an
-- unfiltered `update ... where true`.
--
-- ⚠ ROLE CHOICE IS DELIBERATE. The (b) differentials run as the suite's default
-- (superuser) role, so RLS CANNOT be the party refusing and the trigger is the only thing
-- that can raise. The doors and the (c) twins run as personas, because they must pass
-- their own authorization gate first.
--
-- ⛔ DO NOT "fix" a red here by widening a guard to its lane's own RPC flag.
-- =============================================================================

begin;
select plan(60);

-- Flags: each door opens with its own `assert_*_enabled`; without these the keystones
-- SKIP into a green (pgtap-fixture-flag-gaps). `audit_trail` is needed by the
-- `app.audit_write` at the end of every door's allow leg.
update app.feature_flags set enabled = true
 where key in ('patient_safety', 'case_patient', 'meetings', 'interviews', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'comm_x')::uuid as comm_x,
         (v->>'hosp_b')::uuid as hosp_b, (v->>'org_b')::uuid  as org_b
  from ctx;
grant select on k to authenticated;

-- `sa_x` needs the PQS hat for `dispose_event_phi` (its gate is tenancy-admin OR PQS
-- operator) and keeps its `staff_admin` hat for `dispose_case_phi`. Two role TYPES means
-- `claims_for` can no longer derive the hat, so EVERY persona switch below names it.
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
values ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'pqs_member',
        (select admin from k))
on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;

-- Shared PHI-participant scaffolding for the three case lanes (ADR 0064 E0 / F1: the
-- identifiers hang off a `participants` row via `patient_participants`).
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values (gen_random_uuid(), app.org_of_commission((select comm_x from k)),
        'affected_patient', 'Paciente afetado', array['patient'], true)
on conflict (organization_id, key) where case_type_id is null do nothing;


-- ===========================================================================
-- LANE A — `app.guard_rca_child_lock` (HC047) · dispose_event_phi statements #1-#5
-- ===========================================================================
create temp table la on commit drop as
  select gen_random_uuid() as event,   gen_random_uuid() as rca,
         gen_random_uuid() as factor,  gen_random_uuid() as root,
         gen_random_uuid() as tl,      gen_random_uuid() as evid,   gen_random_uuid() as why,
         -- the SURVIVAL CONTROL: a second event + RCA that is never disposed.
         gen_random_uuid() as event_s, gen_random_uuid() as rca_s,  gen_random_uuid() as factor_s,
         'o conteúdo desta análise está bloqueado (concluída)'::text as locked_msg;
grant select on la to authenticated;

insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
select la.event, 'EV-353A', k.comm_x, current_date, 'Evento 353A', 'acknowledged', 'pqs', k.sa_x
  from la, k;
insert into public.event_patient (event_id, name, mrn, sex)
select la.event, 'PACIENTE-353A', 'MRN-353A', 'female' from la;
update public.patient_safety_event set has_patient = true where id = (select event from la);

-- BORN at `in_review` (INSERT carries no status guard), children added, then WALKED once
-- into `completed` — the only transition the graph admits from there.
insert into public.rca (id, event_id, status, created_by)
select la.rca, la.event, 'in_review', k.sa_x from la, k;
insert into public.rca_factors (id, rca_id, category, text, position)
select la.factor, la.rca, 'process', 'FATOR-PHI-353A', 1 from la;
insert into public.rca_root_causes (id, rca_id, text, position)
select la.root, la.rca, 'CAUSA-RAIZ-PHI-353A', 1 from la;
insert into public.rca_timeline_entries (id, rca_id, occurred_at, description, position)
select la.tl, la.rca, now(), 'LINHA-DO-TEMPO-PHI-353A', 1 from la;
insert into public.rca_evidence (id, rca_id, kind, title, citation_label, external_url, created_by)
select la.evid, la.rca, 'link', 'TITULO-EVID-PHI-353A', 'ROTULO-CITACAO-PHI-353A',
       'https://example.com/353a', k.sa_x from la, k;
insert into public.rca_why_chains (id, rca_id, factor_id, steps, root_text)
select la.why, la.rca, la.factor, '[]'::jsonb, 'PORQUE-RAIZ-PHI-353A' from la;

select set_config('app.in_safety_rpc', 'on', true);
update public.rca set status = 'completed' where id = (select rca from la);
select set_config('app.in_safety_rpc', 'off', true);

-- The survival control: a whole second event/RCA graph the door must not reach.
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
select la.event_s, 'EV-353AS', k.comm_x, current_date, 'Evento 353A-sibling', 'acknowledged', 'pqs', k.sa_x
  from la, k;
insert into public.rca (id, event_id, status, created_by)
select la.rca_s, la.event_s, 'in_review', k.sa_x from la, k;
insert into public.rca_factors (id, rca_id, category, text, position)
select la.factor_s, la.rca_s, 'process', 'FATOR-IRMAO-INTACTO', 1 from la;

-- ── CONTROLS ────────────────────────────────────────────────────────────────────────
select is((select status from public.rca where id = (select rca from la)), 'completed',
  't1 CONTROL: the fixture RCA really reached `completed`. If the status walk silently failed, every assertion below would pass over an UNLOCKED parent and the keystone would prove nothing');
select is((select (select count(*) from public.rca_factors         where rca_id = la.rca)
                + (select count(*) from public.rca_root_causes      where rca_id = la.rca)
                + (select count(*) from public.rca_timeline_entries where rca_id = la.rca)
                + (select count(*) from public.rca_evidence         where rca_id = la.rca)
                + (select count(*) from public.rca_why_chains       where rca_id = la.rca) from la)::int, 5,
  't2 ⭐ CONTROL: …and it HAS a row in all five guarded child tables. This is the whole fixture requirement — a childless completed RCA disposed fine before this fix');
select is((select count(*)::int from public.event_patient ep, la where ep.event_id = la.event), 1,
  't3 ⭐ CONTROL: the event really HAS Class-1 PHI and is NOT yet disposed — without this, t5 could pass on an event that never had a patient row');
select ok((select phi_disposed_at is null from public.patient_safety_event p, la where p.id = la.event),
  't4 CONTROL: …and phi_disposed_at is NULL going in, so t7 cannot pass on a stale stamp');

-- ── THE KEYSTONE ────────────────────────────────────────────────────────────────────
select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;
select lives_ok(
  format('select public.dispose_event_phi(%L::uuid, %L)', (select event from la), 'subject_request'),
  't5 ⭐⭐ KEYSTONE: the LGPD erasure door COMPLETES on an event whose RCA is `completed` WITH children. RED before this migration — it raised HC047 on the rca_factors UPDATE and rolled the whole transaction back');
reset role;

select is((select count(*)::int from public.event_patient ep, la where ep.event_id = la.event), 0,
  't6 ⭐⭐ THE CLASS-1 PHI IS GONE — event_patient is empty. This, not the redaction below, is what the rollback bug destroyed: on the failing path NOTHING was written, so a redaction-only suite stays GREEN while the PHI survives');
select ok((select phi_disposed_at is not null and phi_disposed_reason = 'subject_request'
             from public.patient_safety_event p, la where p.id = la.event),
  't7 ⭐ …and phi_disposed_at is STAMPED with the reason given — the door committed, it did not merely return');
select isnt(current_setting('app.in_disposal_rpc', true), 'on',
  't8 ⭐ the door RESET the flag on the way out. Four windows means four `off` resets and every one is an exit path; a flag left on would hand the rest of the CALLER''s transaction a silent bypass. (A raise mid-body needs no reset: the GUC is transaction-local, so it dies with the transaction that set it.)');
select is((select count(*)::int from la,
            (select 1 from public.rca_factors         f where f.rca_id = (select rca from la) and f.text        is distinct from '[PHI removido]'
              union all
             select 1 from public.rca_root_causes      r where r.rca_id = (select rca from la) and r.text        is distinct from '[PHI removido]'
              union all
             select 1 from public.rca_timeline_entries t where t.rca_id = (select rca from la) and t.description is distinct from '[PHI removido]'
              union all
             select 1 from public.rca_evidence         e where e.rca_id = (select rca from la) and (e.title is distinct from '[PHI removido]' or e.citation_label is distinct from '[PHI removido]')
              union all
             select 1 from public.rca_why_chains       w where w.rca_id = (select rca from la) and w.root_text   is distinct from '[PHI removido]') q
           limit 1), 0,
  't9 every guarded RCA child is redacted — counted as "rows NOT redacted = 0", so with t2 holding, an emptied table cannot satisfy it');
select is((select text from public.rca_factors where id = (select factor_s from la)), 'FATOR-IRMAO-INTACTO',
  't10 ⭐ SURVIVAL CONTROL: the SIBLING RCA''s factor text is byte-identical. t9 alone would be satisfied by `delete from rca_factors` or by an unfiltered `update ... where true`');
select is((select status from public.rca where id = (select rca from la)), 'completed',
  't11 the RCA status is UNCHANGED by disposal — erasure is not a lifecycle transition');

-- ── (b) THE NO-FLAG DIFFERENTIAL — run as superuser so RLS cannot be the refuser ─────
select throws_ok(
  format('update public.rca_factors set text = %L where rca_id = %L::uuid', 'probe', (select rca from la)),
  'HC047', (select locked_msg from la),
  't12 ⭐ a bare child UPDATE on the same completed RCA is still REFUSED — the lock stays load-bearing for every non-disposal writer');
select set_config('app.in_safety_rpc', 'on', true);
select throws_ok(
  format('update public.rca_factors set text = %L where rca_id = %L::uuid', 'probe', (select rca from la)),
  'HC047', (select locked_msg from la),
  't13 ⭐ …and is STILL refused with app.in_safety_rpc = on — the flag every NSP door sets. SHAPE 1''s widening, pinned out: teach this guard to honour in_safety_rpc and this goes RED');
select set_config('app.in_safety_rpc', 'off', true);

-- ── (c) THE SIBLING-RPC OVER-GRANT TWIN ─────────────────────────────────────────────
select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;
select throws_ok(
  format('select public.update_rca_factor(%L::uuid, %L)', (select factor from la), 'texto valido'),
  'HC047', (select locked_msg from la),
  't14 ⭐ a sibling RCA RPC — authorized, its own gate passed — still CANNOT write children of a completed RCA. A non-blank text is passed on purpose: a blank one raises for validation, and this must fail only for the lock');
reset role;


-- ===========================================================================
-- LANE B — `app.guard_capa_child_lock` (HC049) · dispose_event_phi statements #6-#8
-- ⚠ ONE function guards SIX tables (capa_action, capa_measure, capa_effectiveness,
--   capa_action_task, capa_action_evidence, capa_measure_result); the door writes three.
--   Read from `pg_trigger`, not inferred from the door body.
-- ===========================================================================
create temp table lb on commit drop as
  select gen_random_uuid() as event,   gen_random_uuid() as capa,
         gen_random_uuid() as action,  gen_random_uuid() as task,
         gen_random_uuid() as measure, gen_random_uuid() as mresult,
         gen_random_uuid() as event_s, gen_random_uuid() as capa_s,
         gen_random_uuid() as action_s, gen_random_uuid() as task_s,
         'o conteúdo deste plano de ação está bloqueado (completed)'::text as locked_msg;
grant select on lb to authenticated;

insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
select lb.event, 'EV-353B', k.comm_x, current_date, 'Evento 353B', 'acknowledged', 'pqs', k.sa_x from lb, k;
insert into public.event_patient (event_id, name, mrn, sex)
select lb.event, 'PACIENTE-353B', 'MRN-353B', 'male' from lb;
update public.patient_safety_event set has_patient = true where id = (select event from lb);

insert into public.capa_plan (id, code, source, source_event_id, status, hospital_id, opened_by)
select lb.capa, 'CAPA-353B', 'event', lb.event, 'in_verification', k.hosp_b, k.sa_x from lb, k;
insert into public.capa_action (id, capa_id, title, position)
select lb.action, lb.capa, 'Ação 353B', 1 from lb;
insert into public.capa_action_task (id, action_id, description, position)
select lb.task, lb.action, 'DESCRICAO-TAREFA-PHI-353B', 1 from lb;
insert into public.capa_measure (id, capa_id, name, position)
select lb.measure, lb.capa, 'Medida 353B', 1 from lb;
insert into public.capa_measure_result (id, measure_id, period, value, note, created_by)
select lb.mresult, lb.measure, '2026-08', 1, 'NOTA-RESULTADO-PHI-353B', k.sa_x from lb, k;
insert into public.capa_effectiveness (capa_id, verdict, method_md, verified_by)
select lb.capa, 'eficaz', 'METODO-VERIFICACAO-PHI-353B', k.sa_x from lb, k;

select set_config('app.in_safety_rpc', 'on', true);
update public.capa_plan set status = 'completed' where id = (select capa from lb);
select set_config('app.in_safety_rpc', 'off', true);

-- Survival control: a second event + CAPA plan, never disposed.
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
select lb.event_s, 'EV-353BS', k.comm_x, current_date, 'Evento 353B-sibling', 'acknowledged', 'pqs', k.sa_x from lb, k;
insert into public.capa_plan (id, code, source, source_event_id, status, hospital_id, opened_by)
select lb.capa_s, 'CAPA-353BS', 'event', lb.event_s, 'open', k.hosp_b, k.sa_x from lb, k;
insert into public.capa_action (id, capa_id, title, position)
select lb.action_s, lb.capa_s, 'Ação irmã', 1 from lb;
insert into public.capa_action_task (id, action_id, description, position)
select lb.task_s, lb.action_s, 'TAREFA-IRMA-INTACTA', 1 from lb;

select is((select status from public.capa_plan where id = (select capa from lb)), 'completed',
  't15 CONTROL: the fixture CAPA plan really reached `completed` — the normal end state of a finished plan, and the population that carries PHI');
select is((select (select count(*) from public.capa_action_task    where action_id  = lb.action)
                + (select count(*) from public.capa_measure_result where measure_id = lb.measure)
                + (select count(*) from public.capa_effectiveness  where capa_id    = lb.capa) from lb)::int, 3,
  't16 ⭐ CONTROL: …and it HAS a row in all three guarded child tables the door writes');
select is((select count(*)::int from public.event_patient ep, lb where ep.event_id = lb.event), 1,
  't17 ⭐ CONTROL: the event really HAS Class-1 PHI and is not yet disposed');

select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;
select lives_ok(
  format('select public.dispose_event_phi(%L::uuid, %L)', (select event from lb), 'subject_request'),
  't18 ⭐⭐ KEYSTONE: the door COMPLETES on an event whose CAPA plan is `completed` WITH children. RED before this migration — HC049 on the capa_effectiveness UPDATE aborted everything');
reset role;

select is((select count(*)::int from public.event_patient ep, lb where ep.event_id = lb.event), 0,
  't19 ⭐⭐ THE CLASS-1 PHI IS GONE — event_patient is empty');
select ok((select phi_disposed_at is not null from public.patient_safety_event p, lb where p.id = lb.event),
  't20 ⭐ …and phi_disposed_at is STAMPED — the door committed');
select isnt(current_setting('app.in_disposal_rpc', true), 'on',
  't21 ⭐ the door RESET the flag after window 2 as well as window 1');
select is((select count(*)::int from
            (select 1 from public.capa_action_task    t where t.action_id  = (select action from lb)  and t.description is distinct from '[PHI removido]'
              union all
             select 1 from public.capa_measure_result r where r.measure_id = (select measure from lb) and r.note        is not null
              union all
             select 1 from public.capa_effectiveness  e where e.capa_id    = (select capa from lb)    and e.method_md   is not null) q
           limit 1), 0,
  't22 every guarded CAPA child is cleared — counted as "rows NOT cleared = 0", so with t16 holding, an emptied table cannot satisfy it');
select is((select description from public.capa_action_task where id = (select task_s from lb)), 'TAREFA-IRMA-INTACTA',
  't23 ⭐ SURVIVAL CONTROL: the SIBLING plan''s task description is byte-identical');
select is((select status from public.capa_plan where id = (select capa from lb)), 'completed',
  't24 the CAPA status is UNCHANGED by disposal');

select throws_ok(
  format('update public.capa_action_task set description = %L where action_id = %L::uuid', 'probe', (select action from lb)),
  'HC049', (select locked_msg from lb),
  't25 ⭐ a bare child UPDATE on the completed plan is still REFUSED');
select set_config('app.in_safety_rpc', 'on', true);
select throws_ok(
  format('update public.capa_action_task set description = %L where action_id = %L::uuid', 'probe', (select action from lb)),
  'HC049', (select locked_msg from lb),
  't26 ⭐ …and is STILL refused with app.in_safety_rpc = on — shape 1 pinned out on the CAPA lane');
select set_config('app.in_safety_rpc', 'off', true);

select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;
select throws_ok(
  format('select public.set_capa_action_task_done(%L::uuid, true)', (select task from lb)),
  'HC049', (select locked_msg from lb),
  't27 ⭐ a sibling CAPA RPC — authorized, gate passed — still CANNOT write children of a completed plan');
reset role;


-- ===========================================================================
-- LANE B2 — the CAPA lock's OTHER terminal status: `cancelled`
-- ===========================================================================
create temp table lb2 on commit drop as
  select gen_random_uuid() as event, gen_random_uuid() as capa,
         gen_random_uuid() as action, gen_random_uuid() as task,
         'o conteúdo deste plano de ação está bloqueado (cancelled)'::text as locked_msg;
grant select on lb2 to authenticated;

insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
select lb2.event, 'EV-353B2', k.comm_x, current_date, 'Evento 353B2', 'acknowledged', 'pqs', k.sa_x from lb2, k;
insert into public.event_patient (event_id, name, mrn, sex)
select lb2.event, 'PACIENTE-353B2', 'MRN-353B2', 'female' from lb2;
update public.patient_safety_event set has_patient = true where id = (select event from lb2);
insert into public.capa_plan (id, code, source, source_event_id, status, hospital_id, opened_by)
select lb2.capa, 'CAPA-353B2', 'event', lb2.event, 'in_verification', k.hosp_b, k.sa_x from lb2, k;
insert into public.capa_action (id, capa_id, title, position)
select lb2.action, lb2.capa, 'Ação 353B2', 1 from lb2;
insert into public.capa_action_task (id, action_id, description, position)
select lb2.task, lb2.action, 'DESCRICAO-TAREFA-PHI-353B2', 1 from lb2;
select set_config('app.in_safety_rpc', 'on', true);
update public.capa_plan set status = 'cancelled' where id = (select capa from lb2);
select set_config('app.in_safety_rpc', 'off', true);

select is((select status from public.capa_plan where id = (select capa from lb2)), 'cancelled',
  't28 CONTROL: the second CAPA fixture reached `cancelled` — the guard''s OTHER terminal arm, which a `completed`-only suite never exercises');
select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;
select lives_ok(
  format('select public.dispose_event_phi(%L::uuid, %L)', (select event from lb2), 'retention_expired'),
  't29 ⭐⭐ KEYSTONE: the door COMPLETES on a `cancelled` CAPA plan with children');
reset role;
select is((select count(*)::int from public.event_patient ep, lb2 where ep.event_id = lb2.event), 0,
  't30 ⭐⭐ …and the Class-1 PHI is GONE for the cancelled lane too');
select throws_ok(
  format('update public.capa_action_task set description = %L where action_id = %L::uuid', 'probe', (select action from lb2)),
  'HC049', (select locked_msg from lb2),
  't31 ⭐ the cancelled plan''s lock still refuses everyone else');


-- ===========================================================================
-- LANE C — `app.guard_interview_child_lock` (23514) · dispose_case_phi statement #9
-- ===========================================================================
create temp table lc on commit drop as
  select gen_random_uuid() as kase,   gen_random_uuid() as part,
         gen_random_uuid() as intv,   gen_random_uuid() as subj,
         gen_random_uuid() as kase_s, gen_random_uuid() as intv_s, gen_random_uuid() as subj_s,
         'o conteúdo desta entrevista está bloqueado (completed)'::text as locked_msg;
grant select on lc to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by, patient_enabled)
select lc.kase, k.comm_x, 9531, 'ROTULO-PHI-353C', k.sa_x, true from lc, k;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select lc.part, app.org_of_commission((select comm_x from k)), 'patient', 'patient_phi', 'Paciente 353C' from lc;
insert into public.patient_participants (participant_id) select lc.part from lc;
insert into public.case_participants (case_id, participant_id, role_id, added_by)
select lc.kase, lc.part,
       (select id from public.case_participant_roles
         where organization_id = app.org_of_commission((select comm_x from k))
           and key = 'affected_patient' and case_type_id is null),
       k.sa_x from lc, k;
insert into public.patient_identifiers (participant_id, name, mrn, sex)
select lc.part, 'Paciente PHI 353C', 'MRN-353C', 'female' from lc;
update public.cases set has_patient = true where id = (select kase from lc);

-- BORN `in_progress`, subject added, then WALKED once into `completed`.
insert into public.case_interviews
  (id, case_id, commission_id, interview_number, summary_md, created_by, status, interview_category)
select lc.intv, lc.kase, k.comm_x, 9531, 'RESUMO-ENTREVISTA-PHI-353C', k.sa_x, 'in_progress', 'witness' from lc, k;
insert into public.case_interview_subjects (id, interview_id, external_name, note, relationship_to_case)
select lc.subj, lc.intv, 'Entrevistado 353C', 'NOTA-SUJEITO-PHI-353C', 'witness' from lc;
select set_config('app.in_interview_rpc', 'on', true);
update public.case_interviews set status = 'completed' where id = (select intv from lc);
select set_config('app.in_interview_rpc', 'off', true);

-- Survival control: a second case + interview, never disposed.
insert into public.cases (id, commission_id, case_number, created_by)
select lc.kase_s, k.comm_x, 9532, k.sa_x from lc, k;
insert into public.case_interviews
  (id, case_id, commission_id, interview_number, created_by, status, interview_category)
select lc.intv_s, lc.kase_s, k.comm_x, 9532, k.sa_x, 'in_progress', 'witness' from lc, k;
insert into public.case_interview_subjects (id, interview_id, external_name, note, relationship_to_case)
select lc.subj_s, lc.intv_s, 'Entrevistado irmão', 'NOTA-IRMA-INTACTA', 'witness' from lc;

select is((select status from public.case_interviews where id = (select intv from lc)), 'completed',
  't32 CONTROL: the fixture interview really reached `completed`');
select is((select count(*)::int from public.case_interview_subjects s, lc where s.interview_id = lc.intv), 1,
  't33 ⭐ CONTROL: …and it HAS a subject row. A subject-less completed interview disposed fine before this fix');
select is((select count(*)::int from public.patient_identifiers pi, lc where pi.participant_id = lc.part), 1,
  't34 ⭐ CONTROL: the case really HAS Class-1 PHI and is not yet disposed');

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  format('select public.dispose_case_phi(%L::uuid, %L)', (select kase from lc), 'subject_request'),
  't35 ⭐⭐ KEYSTONE: the LGPD erasure door COMPLETES on a case whose interview is `completed` WITH subjects. RED before this migration — 23514 on the case_interview_subjects UPDATE rolled back the patient_identifiers DELETE that had already run');
reset role;

select is((select count(*)::int from public.patient_identifiers pi, lc where pi.participant_id = lc.part), 0,
  't36 ⭐⭐ THE CLASS-1 PHI IS GONE — patient_identifiers is empty');
select ok((select phi_disposed_at is not null and phi_disposed_reason = 'subject_request'
             from public.cases c, lc where c.id = lc.kase),
  't37 ⭐ …and cases.phi_disposed_at is STAMPED with the reason — the door committed');
select isnt(current_setting('app.in_disposal_rpc', true), 'on',
  't38 ⭐ dispose_case_phi RESET the flag on the way out');
select is((select note from public.case_interview_subjects where id = (select subj from lc)), '[PHI removido]',
  't39 the interview subject''s note is redacted');
select is((select note from public.case_interview_subjects where id = (select subj_s from lc)), 'NOTA-IRMA-INTACTA',
  't40 ⭐ SURVIVAL CONTROL: the SIBLING case''s subject note is byte-identical — t39 cannot be satisfied by an unfiltered update or a delete');
select is((select status from public.case_interviews where id = (select intv from lc)), 'completed',
  't41 the interview status is UNCHANGED by disposal');

select throws_ok(
  format('update public.case_interview_subjects set note = %L where interview_id = %L::uuid', 'probe', (select intv from lc)),
  '23514', (select locked_msg from lc),
  't42 ⭐ a bare child UPDATE on the completed interview is still REFUSED — pinned on the guard''s MESSAGE, because 23514 is also what this lane''s validations raise');
select set_config('app.in_interview_rpc', 'on', true);
select throws_ok(
  format('update public.case_interview_subjects set note = %L where interview_id = %L::uuid', 'probe', (select intv from lc)),
  '23514', (select locked_msg from lc),
  't43 ⭐ …and is STILL refused with app.in_interview_rpc = on — shape 1 pinned out on the interview lane');
select set_config('app.in_interview_rpc', 'off', true);

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select throws_ok(
  format('select public.update_interview_subject(%L::uuid, %L, %L, %L, %L, %L)',
         (select subj from lc), 'papel', 'nota valida', 'Nome Externo', 'Org Externa', 'witness'),
  '23514', (select locked_msg from lc),
  't44 ⭐ a sibling interview RPC — authorized, gate passed — still CANNOT write children of a completed interview');
reset role;


-- ===========================================================================
-- LANE C2 — the interview lock's OTHER terminal status: `cancelled`
-- ===========================================================================
create temp table lc2 on commit drop as
  select gen_random_uuid() as kase, gen_random_uuid() as part,
         gen_random_uuid() as intv, gen_random_uuid() as subj,
         'o conteúdo desta entrevista está bloqueado (cancelled)'::text as locked_msg;
grant select on lc2 to authenticated;

insert into public.cases (id, commission_id, case_number, created_by, patient_enabled)
select lc2.kase, k.comm_x, 9533, k.sa_x, true from lc2, k;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select lc2.part, app.org_of_commission((select comm_x from k)), 'patient', 'patient_phi', 'Paciente 353C2' from lc2;
insert into public.patient_participants (participant_id) select lc2.part from lc2;
insert into public.case_participants (case_id, participant_id, role_id, added_by)
select lc2.kase, lc2.part,
       (select id from public.case_participant_roles
         where organization_id = app.org_of_commission((select comm_x from k))
           and key = 'affected_patient' and case_type_id is null),
       k.sa_x from lc2, k;
insert into public.patient_identifiers (participant_id, name, mrn, sex)
select lc2.part, 'Paciente PHI 353C2', 'MRN-353C2', 'male' from lc2;
update public.cases set has_patient = true where id = (select kase from lc2);
insert into public.case_interviews
  (id, case_id, commission_id, interview_number, created_by, status, interview_category)
select lc2.intv, lc2.kase, k.comm_x, 9533, k.sa_x, 'in_progress', 'witness' from lc2, k;
insert into public.case_interview_subjects (id, interview_id, external_name, note, relationship_to_case)
select lc2.subj, lc2.intv, 'Entrevistado 353C2', 'NOTA-SUJEITO-PHI-353C2', 'witness' from lc2;
select set_config('app.in_interview_rpc', 'on', true);
update public.case_interviews set status = 'cancelled' where id = (select intv from lc2);
select set_config('app.in_interview_rpc', 'off', true);

select is((select status from public.case_interviews where id = (select intv from lc2)), 'cancelled',
  't45 CONTROL: the second interview fixture reached `cancelled` — the guard''s OTHER terminal arm');
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  format('select public.dispose_case_phi(%L::uuid, %L)', (select kase from lc2), 'retention_expired'),
  't46 ⭐⭐ KEYSTONE: the door COMPLETES on a `cancelled` interview with subjects');
reset role;
select is((select count(*)::int from public.patient_identifiers pi, lc2 where pi.participant_id = lc2.part), 0,
  't47 ⭐⭐ …and the Class-1 PHI is GONE for the cancelled lane too');
select throws_ok(
  format('update public.case_interview_subjects set note = %L where interview_id = %L::uuid', 'probe', (select intv from lc2)),
  '23514', (select locked_msg from lc2),
  't48 ⭐ the cancelled interview''s lock still refuses everyone else');


-- ===========================================================================
-- LANE D — `app.guard_meeting_child_lock` on `meeting_cases` (23514)
--          · dispose_case_phi statement #10
-- ⭐ THIS LANE NEEDED NO GUARD CHANGE AT ALL, AND IT APPEARS IN NO FILED RECORD. The
--   guard has read `app.in_disposal_rpc` since ADR 0129; `dispose_case_phi` simply never
--   set it, while carrying an inline comment claiming `app.in_meeting_rpc` covered this
--   child lock. The comment was false; the flag it named reaches the PARENT guards only.
-- ===========================================================================
create temp table ld on commit drop as
  select gen_random_uuid() as kase,   gen_random_uuid() as part,
         gen_random_uuid() as mtg,    gen_random_uuid() as kase_s,
         'o conteúdo desta reunião está bloqueado (signed)'::text as locked_msg;
grant select on ld to authenticated;

insert into public.cases (id, commission_id, case_number, created_by, patient_enabled)
select ld.kase, k.comm_x, 9541, k.sa_x, true from ld, k;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select ld.part, app.org_of_commission((select comm_x from k)), 'patient', 'patient_phi', 'Paciente 353D' from ld;
insert into public.patient_participants (participant_id) select ld.part from ld;
insert into public.case_participants (case_id, participant_id, role_id, added_by)
select ld.kase, ld.part,
       (select id from public.case_participant_roles
         where organization_id = app.org_of_commission((select comm_x from k))
           and key = 'affected_patient' and case_type_id is null),
       k.sa_x from ld, k;
insert into public.patient_identifiers (participant_id, name, mrn, sex)
select ld.part, 'Paciente PHI 353D', 'MRN-353D', 'female' from ld;
update public.cases set has_patient = true where id = (select kase from ld);

-- A SECOND case on the SAME meeting: the survival control, and the reason the door's
-- `where case_id = p_case_id` predicate is load-bearing.
insert into public.cases (id, commission_id, case_number, created_by)
select ld.kase_s, k.comm_x, 9542, k.sa_x from ld, k;

insert into public.meetings (id, commission_id, meeting_number, title, status, scheduled_start, created_by)
select ld.mtg, k.comm_x, 9541, 'Reunião 353D', 'held', now(), k.sa_x from ld, k;
insert into public.meeting_cases (meeting_id, case_id, summary, decision)
select ld.mtg, ld.kase, 'RESUMO-REUNIAO-PHI-353D', 'DECISAO-PHI-353D' from ld;
insert into public.meeting_cases (meeting_id, case_id, summary, decision)
select ld.mtg, ld.kase_s, 'RESUMO-IRMAO-INTACTO', 'DECISAO-IRMA-INTACTA' from ld;

-- WALKED, not set: `guard_meeting_status` admits no jumps and there is NO held -> signed.
select set_config('app.in_meeting_rpc', 'on', true);
update public.meetings set status = 'in_signature' where id = (select mtg from ld);
update public.meetings set status = 'signed'       where id = (select mtg from ld);
select set_config('app.in_meeting_rpc', 'off', true);

select is((select status from public.meetings where id = (select mtg from ld)), 'signed',
  't49 CONTROL: the fixture meeting really reached a LOCKED status (`signed`)');
select is((select count(*)::int from public.meeting_cases mc, ld where mc.meeting_id = ld.mtg), 2,
  't50 ⭐ CONTROL: …and it carries TWO linked cases — the second is the survival control for t54');
select is((select count(*)::int from public.patient_identifiers pi, ld where pi.participant_id = ld.part), 1,
  't51 ⭐ CONTROL: the case really HAS Class-1 PHI and is not yet disposed');

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  format('select public.dispose_case_phi(%L::uuid, %L)', (select kase from ld), 'subject_request'),
  't52 ⭐⭐ KEYSTONE: the door COMPLETES on a case linked to a SIGNED meeting. RED before this migration — statement #10 raised 23514 and rolled back the patient_identifiers DELETE. This lane appeared in NO filed record; the guard already read the flag, the door never set it');
reset role;

select is((select count(*)::int from public.patient_identifiers pi, ld where pi.participant_id = ld.part), 0,
  't53 ⭐⭐ THE CLASS-1 PHI IS GONE — patient_identifiers is empty');
select ok((select mc.summary = '[PHI removido]' and mc.decision = '[PHI removido]'
             from public.meeting_cases mc, ld where mc.meeting_id = ld.mtg and mc.case_id = ld.kase),
  't54 the disposed case''s meeting_cases summary + decision are redacted');
select ok((select mc.summary = 'RESUMO-IRMAO-INTACTO' and mc.decision = 'DECISAO-IRMA-INTACTA'
             from public.meeting_cases mc, ld where mc.meeting_id = ld.mtg and mc.case_id = ld.kase_s),
  't55 ⭐ SURVIVAL CONTROL: the OTHER case on the SAME locked meeting is byte-identical — the stand-aside did not turn statement #10 into a meeting-wide wipe');
select is((select status from public.meetings where id = (select mtg from ld)), 'signed',
  't56 the meeting status is UNCHANGED by a case disposal');
select isnt(current_setting('app.in_disposal_rpc', true), 'on',
  't57 ⭐ the door RESET the flag after window 2');

select throws_ok(
  format('update public.meeting_cases set summary = %L where meeting_id = %L::uuid', 'probe', (select mtg from ld)),
  '23514', (select locked_msg from ld),
  't58 ⭐ a bare child UPDATE on the signed meeting is still REFUSED');
select set_config('app.in_meeting_rpc', 'on', true);
select throws_ok(
  format('update public.meeting_cases set summary = %L where meeting_id = %L::uuid', 'probe', (select mtg from ld)),
  '23514', (select locked_msg from ld),
  't59 ⭐ …and is STILL refused with app.in_meeting_rpc = on — the flag all 26 sibling meeting doors set, and the one this door''s comment WRONGLY claimed covered this lock');
select set_config('app.in_meeting_rpc', 'off', true);

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select throws_ok(
  format('select public.link_meeting_case(%L::uuid, %L::uuid, null, %L, %L)',
         (select mtg from ld), (select kase_s from ld), 'resumo', 'decisao'),
  '23514', (select locked_msg from ld),
  't60 ⭐ a sibling meeting RPC — authorized, gate passed — still CANNOT write children of a signed meeting');
reset role;

select * from finish();
rollback;

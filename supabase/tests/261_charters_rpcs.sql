-- Committee Charters & Meeting Cadence (S4·CH, Phase 21) — RPC behaviour (CH-BE-3).
-- Migration 20260818000100_charter_rpcs.sql. ADR 0080 D6/D7; plan §3/§4/§5/§9.
--
-- Covers: upsert authority (staff_admin ok / plain member HC0K0) + link validation
-- (HC0K1) + one charter.upserted audit row; cadence across all 5 frequencies × the
-- window states (em_dia/em_atraso) + the two neutral states (sem_reunioes/sem_regimento),
-- participants_only EXCLUSION, member-scope deny (HC0K2), computed over base tables
-- (DEFINER, not RLS-filtered); carry-forward unresolved-agenda + open-action lists with
-- the app.can_read_action_item CONFIDENTIALITY filter (a non-readable item absent both
-- directions) + a positive twin + non-terminal + most-recent-meeting + member-scope;
-- flag-OFF → HC000 on all three.
--
-- The fixture MUST enable `charters` (else the flag-gated RPC tests silently skip — the
-- known pgTAP-fixture-flag-gap) and `audit_trail` (for the charter.upserted assertion).
--
-- MUTATION-PROVEN (ADR 0079) by supabase/tests/mutation/ch-be3-mutation-audit.sh: neutralize
-- the HC0K0 authority gate → #KS_AUTHORITY reddens; neutralize HC0K2 → #KS_MEMBER reddens;
-- neutralize app.can_read_action_item → the case-confidential item leaks → #KS_FILTER reddens.
-- Confidentiality is exercised via an `assignees_only` item (a non-assignee, non-staff_admin
-- member is denied — the deterministic can_read_action_item branch, no case-model coupling);
-- a `case_restricted` item routes through the SAME app.can_read_action_item call, so the
-- filter — and its mutation proof — cover it identically.

begin;
select plan(29);

update app.feature_flags set enabled = true where key in ('charters', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- Extra users: `cad` (member of every cadence commission), `assignee` (holds the
-- assignees_only item), `outsider` (member of nothing). Org-anchored (deferred check
-- fires at COMMIT; the test rolls back).
create temp table u on commit drop as
  select gen_random_uuid() as cad, gen_random_uuid() as assignee, gen_random_uuid() as outsider;
grant select on u to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x, 'authenticated', 'authenticated', x || '@test', now(), now()
  from (select cad as x from u union all select assignee from u union all select outsider from u) s;
update public.profiles set home_organization_id = (select org_b from k)
  where id in (select cad from u union all select assignee from u union all select outsider from u);

-- Controlled documents in comm_x for the upsert link-validation tests: a valid
-- regimento (doc_type='bylaws' after the ADR-0081 B0 anglicization) + a wrong-type
-- (sop) doc. Code is trigger-minted.
insert into public.controlled_documents (commission_id, title, doc_type, created_by)
  select comm_x, 'Regimento CCIH', 'bylaws', sa_x from k;
insert into public.controlled_documents (commission_id, title, doc_type, created_by)
  select comm_x, 'POP CCIH', 'sop', sa_x from k;

-- A global (commission_id NULL) open/done status the fixture re-seeds in 00_setup.
create temp table stt on commit drop as
  select (select id from public.action_item_statuses where key = 'open'  and commission_id is null) as open_id,
         (select id from public.action_item_statuses where key = 'done'  and commission_id is null) as done_id;
grant select on stt to authenticated;

-- -------------------------------------------------------------------------
-- Seed the cadence world: one commission per (frequency, state); `cad` a staff
-- member of each; a held commission_default meeting at a date clearly inside
-- (em_dia) / outside (em_atraso) the frequency window.
-- -------------------------------------------------------------------------
create function pg_temp.seed_cadence(p_freq text, p_state text, p_held_at timestamptz)
returns uuid language plpgsql as $$
declare
  v_comm uuid := gen_random_uuid();
  v_hosp uuid := (select hosp_b from k);
  v_cad  uuid := (select cad from u);
begin
  insert into public.commissions (id, name, slug, created_by, hospital_id)
    values (v_comm, 'Cad '||p_freq||' '||p_state, 'cad-'||substr(v_comm::text,1,8), v_cad, v_hosp);
  insert into public.memberships (commission_id, principal_id, role) values (v_comm, v_cad, 'staff');
  if p_state <> 'sem_regimento' then
    insert into public.commission_charters (commission_id, meeting_frequency, created_by)
      values (v_comm, p_freq, v_cad);
  end if;
  if p_held_at is not null then
    insert into public.meetings (commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
      values (v_comm, 'Reunião', 'presencial', p_held_at, 'held', 'commission_default', p_held_at);
  end if;
  return v_comm;
end; $$;

create temp table cad_comm on commit drop as
  select p.freq, p.state, pg_temp.seed_cadence(p.freq, p.state, p.held_at) as comm
  from (values
    -- em_dia: clearly inside the window
    ('semanal',   'em_dia',   now() - interval '2 days'),
    ('quinzenal', 'em_dia',   now() - interval '5 days'),
    ('mensal',    'em_dia',   now() - interval '10 days'),
    ('bimestral', 'em_dia',   now() - interval '20 days'),
    ('trimestral','em_dia',   now() - interval '40 days'),
    -- em_atraso: clearly outside the window
    ('semanal',   'em_atraso', now() - interval '14 days'),
    ('quinzenal', 'em_atraso', now() - interval '30 days'),
    ('mensal',    'em_atraso', now() - interval '70 days'),
    ('bimestral', 'em_atraso', now() - interval '120 days'),
    ('trimestral','em_atraso', now() - interval '150 days'),
    -- neutral states (frequency-independent by construction)
    ('mensal',    'sem_reunioes',  null::timestamptz),
    ('mensal',    'sem_regimento', null::timestamptz)
  ) as p(freq, state, held_at);
grant select on cad_comm to authenticated;

-- Exclusion commission: charter mensal, an OLD commission_default meeting (em_atraso)
-- + a RECENT participants_only meeting. If participants_only were counted the status
-- would be em_dia; excluded → em_atraso.
create temp table excl on commit drop as select gen_random_uuid() as comm, gen_random_uuid() as po_m;
grant select on excl to authenticated;
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select comm, 'Excl', 'excl-'||substr(comm::text,1,8), (select cad from u), (select hosp_b from k) from excl;
insert into public.memberships (commission_id, principal_id, role)
  select comm, (select cad from u), 'staff' from excl;
insert into public.commission_charters (commission_id, meeting_frequency, created_by)
  select comm, 'mensal', (select cad from u) from excl;
insert into public.meetings (commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select comm, 'Plenária antiga', 'presencial', now() - interval '70 days', 'held', 'commission_default', now() - interval '70 days' from excl;
-- Recent participants_only meeting: reached the app way (insert commission_default →
-- add a participant → flip visibility) since a fresh participants_only insert trips
-- the roster-nonempty guard (HC0C3).
insert into public.meetings (id, commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select po_m, comm, 'Audiência recente', 'presencial', now(), 'held', 'commission_default', now() from excl;
insert into public.meeting_attendees (meeting_id, user_id)
  select po_m, (select cad from u) from excl;
update public.meetings set visibility_policy = 'participants_only' where id = (select po_m from excl);

-- -------------------------------------------------------------------------
-- Seed the carry-forward world (comm_cf): a most-recent + an older held
-- commission_default meeting; agenda items (resolved/unresolved); action items
-- (committee/assignees_only/terminal).
-- -------------------------------------------------------------------------
create temp table cf on commit drop as
  select gen_random_uuid() as comm, gen_random_uuid() as m_recent, gen_random_uuid() as m_old,
         gen_random_uuid() as ai_committee, gen_random_uuid() as ai_assignees, gen_random_uuid() as ai_terminal;
grant select on cf to authenticated;
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select comm, 'CarryFwd', 'cf-'||substr(comm::text,1,8), (select cad from u), (select hosp_b from k) from cf;
insert into public.memberships (commission_id, principal_id, role)
  select comm, (select cad from u), 'staff' from cf;
insert into public.memberships (commission_id, principal_id, role)
  select comm, (select assignee from u), 'staff' from cf;

insert into public.meetings (id, commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select m_recent, comm, 'Reunião recente', 'presencial', now() - interval '1 day', 'held', 'commission_default', now() - interval '1 day' from cf;
insert into public.meetings (id, commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select m_old, comm, 'Reunião antiga', 'presencial', now() - interval '30 days', 'held', 'commission_default', now() - interval '30 days' from cf;

-- Agenda: unresolved + resolved on the recent meeting; unresolved on the OLD meeting (must not surface).
insert into public.meeting_agenda_items (meeting_id, position, title, resolution)
  select m_recent, 0, 'Pendência A', null from cf;
insert into public.meeting_agenda_items (meeting_id, position, title, resolution)
  select m_recent, 1, 'Resolvida B', 'Encaminhado' from cf;
insert into public.meeting_agenda_items (meeting_id, position, title, resolution)
  select m_old, 0, 'Antiga C', null from cf;

-- Action items on the recent meeting (source_type=meeting).
insert into public.action_items (id, commission_id, source_type, source_meeting_id, title, status_id, visibility_scope)
  select ai_committee, comm, 'meeting', m_recent, 'Ação comitê', (select open_id from stt), 'committee' from cf;
insert into public.action_items (id, commission_id, source_type, source_meeting_id, title, status_id, visibility_scope, assigned_to)
  select ai_assignees, comm, 'meeting', m_recent, 'Ação restrita', (select open_id from stt), 'assignees_only', (select assignee from u) from cf;
insert into public.action_items (id, commission_id, source_type, source_meeting_id, title, status_id, visibility_scope)
  select ai_terminal, comm, 'meeting', m_recent, 'Ação concluída', (select done_id from stt), 'committee' from cf;

-- MUTATION_MARKER
-- =========================================================================
-- UPSERT — authority + link validation + audit.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.upsert_commission_charter((select comm_x from k), 'mensal'))->>'meetingFrequency',
  'mensal',
  'upsert by staff_admin returns the persisted charter (mensal)'
);
select is(
  (public.upsert_commission_charter((select comm_x from k), 'quinzenal',
     (select id from public.controlled_documents
        where commission_id = (select comm_x from k) and doc_type = 'bylaws' limit 1)))->>'controlledDocumentId',
  (select id::text from public.controlled_documents
     where commission_id = (select comm_x from k) and doc_type = 'bylaws' limit 1),
  'upsert with a same-commission regimento link succeeds and returns the doc id'
);
select throws_ok(
  format($f$ select public.upsert_commission_charter(%L::uuid, 'mensal', %L::uuid) $f$,
    (select comm_x from k),
    (select id from public.controlled_documents
       where commission_id = (select comm_x from k) and doc_type = 'sop' limit 1)),
  'HC0K1', null,
  'upsert with a non-regimento (pop) link is refused HC0K1'
);
reset role;

-- #KS_AUTHORITY — a plain member cannot upsert (HC0K0).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($f$ select public.upsert_commission_charter(%L::uuid, 'mensal') $f$, (select comm_x from k)),
  'HC0K0', null,
  'KS_AUTHORITY: a plain member is refused HC0K0 on upsert'
);
reset role;

-- Audit: exactly one charter.upserted for comm_y after a single upsert (count as owner).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.upsert_commission_charter((select comm_y from k), 'trimestral');
reset role;
select is(
  (select count(*)::int from public.audit_log
     where commission_id = (select comm_y from k) and action = 'charter.upserted'),
  1,
  'exactly one charter.upserted audit row per upsert'
);

-- =========================================================================
-- CADENCE — all 5 frequencies × window states + neutral states, as `cad`.
-- =========================================================================
select test_helpers.claims_for((select cad from u), false);
set local role authenticated;
select is((public.meeting_cadence_status((select comm from cad_comm where freq='semanal'   and state='em_dia')))->>'status', 'em_dia', 'semanal em_dia');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='quinzenal' and state='em_dia')))->>'status', 'em_dia', 'quinzenal em_dia');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='mensal'    and state='em_dia')))->>'status', 'em_dia', 'mensal em_dia');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='bimestral' and state='em_dia')))->>'status', 'em_dia', 'bimestral em_dia');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='trimestral' and state='em_dia')))->>'status', 'em_dia', 'trimestral em_dia');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='semanal'   and state='em_atraso')))->>'status', 'em_atraso', 'semanal em_atraso');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='quinzenal' and state='em_atraso')))->>'status', 'em_atraso', 'quinzenal em_atraso');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='mensal'    and state='em_atraso')))->>'status', 'em_atraso', 'mensal em_atraso');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='bimestral' and state='em_atraso')))->>'status', 'em_atraso', 'bimestral em_atraso');
select is((public.meeting_cadence_status((select comm from cad_comm where freq='trimestral' and state='em_atraso')))->>'status', 'em_atraso', 'trimestral em_atraso');
select is((public.meeting_cadence_status((select comm from cad_comm where state='sem_reunioes')))->>'status', 'sem_reunioes', 'charter but no qualifying meeting → sem_reunioes');
select is((public.meeting_cadence_status((select comm from cad_comm where state='sem_regimento')))->>'status', 'sem_regimento', 'no charter → sem_regimento');
select is((public.meeting_cadence_status((select comm from excl)))->>'status', 'em_atraso',
  'participants_only meeting is EXCLUDED (recent hearing does not make it em_dia)');
reset role;

-- #KS_MEMBER — a non-member is denied cadence (HC0K2).
select test_helpers.claims_for((select outsider from u), false);
set local role authenticated;
select throws_ok(
  format($f$ select public.meeting_cadence_status(%L::uuid) $f$, (select comm from cad_comm where freq='mensal' and state='em_dia')),
  'HC0K2', null,
  'KS_MEMBER: a non-member is refused HC0K2 on cadence'
);
reset role;

-- =========================================================================
-- CARRY-FORWARD — agenda/action lists + confidentiality filter, as `cad`.
-- =========================================================================
select test_helpers.claims_for((select cad from u), false);
set local role authenticated;
select ok(
  exists (select 1 from jsonb_array_elements((public.suggest_carry_forward((select comm from cf)))->'agendaItems') e
          where e->>'title' = 'Pendência A'),
  'carry-forward agenda includes the unresolved item'
);
select ok(
  not exists (select 1 from jsonb_array_elements((public.suggest_carry_forward((select comm from cf)))->'agendaItems') e
             where e->>'title' = 'Resolvida B'),
  'carry-forward agenda excludes a resolved item'
);
select ok(
  not exists (select 1 from jsonb_array_elements((public.suggest_carry_forward((select comm from cf)))->'agendaItems') e
             where e->>'title' = 'Antiga C'),
  'carry-forward agenda excludes an older-meeting item (most-recent only)'
);
select ok(
  exists (select 1 from jsonb_array_elements((public.suggest_carry_forward((select comm from cf)))->'actionItems') e
          where (e->>'id')::uuid = (select ai_committee from cf)),
  'carry-forward actions include a readable committee item (positive twin)'
);
select ok(
  not exists (select 1 from jsonb_array_elements((public.suggest_carry_forward((select comm from cf)))->'actionItems') e
             where (e->>'id')::uuid = (select ai_assignees from cf)),
  'KS_FILTER: a non-readable (assignees_only) action item is absent — confidentiality filter'
);
select ok(
  not exists (select 1 from jsonb_array_elements((public.suggest_carry_forward((select comm from cf)))->'actionItems') e
             where (e->>'id')::uuid = (select ai_terminal from cf)),
  'carry-forward actions exclude a terminal (done) item'
);
reset role;

-- Member-scope on carry-forward (HC0K2).
select test_helpers.claims_for((select outsider from u), false);
set local role authenticated;
select throws_ok(
  format($f$ select public.suggest_carry_forward(%L::uuid) $f$, (select comm from cf)),
  'HC0K2', null,
  'a non-member is refused HC0K2 on carry-forward'
);
reset role;

-- =========================================================================
-- FLAG-OFF → HC000 on all three RPCs.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'charters';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($f$ select public.upsert_commission_charter(%L::uuid, 'mensal') $f$, (select comm_x from k)),
  'HC000', null, 'flag OFF → upsert raises HC000'
);
select throws_ok(
  format($f$ select public.meeting_cadence_status(%L::uuid) $f$, (select comm_x from k)),
  'HC000', null, 'flag OFF → cadence raises HC000'
);
select throws_ok(
  format($f$ select public.suggest_carry_forward(%L::uuid) $f$, (select comm from cf)),
  'HC000', null, 'flag OFF → carry-forward raises HC000'
);
reset role;

select * from finish();
rollback;

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
select plan(39);

update app.feature_flags set enabled = true where key in ('charters', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'oa_b')::uuid   as oa_b,
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

-- =============================================================================
-- §CAD — commission_cadence_overview (`20260917000300`), the tenancy-tier read.
--
-- PO ruling 2026-08-09 (charter ③): `manage/charter` stays coordinator-only, and the
-- oversight question it raised is answered by a READ-ONLY cadence overview on the registry
-- the tenancy admin already owns. These pin that the door grants exactly that and no more.
--
-- The door takes NO arguments by design — the row set is derived from is_tenancy_admin_of,
-- so a caller cannot ask about a commission it does not administer. That makes isolation
-- structural, but structural is not observable: CAD-3/CAD-4/CAD-5 assert it by ROWS.
-- =============================================================================

-- ⚠ RE-ENABLE THE FLAG. Line 309 turns `charters` OFF for the flag-OFF/HC000 tests above,
-- and this section runs after them — every door here calls assert_charters_enabled() first,
-- so without this the whole block dies on `recurso indisponível` and reports as an ABORT
-- (tests planned-but-not-run), not as failures. The recorded pgTAP fixture-flag-gap, in its
-- nastier ordering-dependent form: the flag was correct when the file started.
update app.feature_flags set enabled = true where key = 'charters';

-- ⚠ CLEAR THE CLAIMS FIRST. `guard_profile_privileged_columns` treats identity columns as
-- service-role-only and decides by `auth.uid() is null`, NOT by the database role — so a
-- leftover `request.jwt.claims` from the section above makes the profile updates below
-- raise, even running as postgres with the role reset.
select set_config('request.jwt.claims', null, true);

-- A tenancy admin of a DIFFERENT organization. bootstrap homes both commissions under one
-- org, so `oa_b` cannot serve as the cross-org control — it would see everything and the
-- test would pass for the wrong reason (the wrong-arm fixture trap).
create temp table xorg on commit drop as
  select gen_random_uuid() as org, gen_random_uuid() as admin;
grant select on xorg to authenticated;
insert into public.organizations (id, name, slug)
  select org, 'Org Estranha CAD', 'org-estranha-cad' from xorg;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', admin, 'authenticated', 'authenticated',
         admin || '@test', now(), now() from xorg;
insert into public.memberships (principal_id, organization_id, role)
  select admin, org, 'org_admin' from xorg;

-- A hospital_admin of hosp_b — the second tenancy tier. Cadence is a GRANT here rather
-- than a wall, but the Q4 principle is the same: the two tiers must not diverge.
create temp table hadm on commit drop as select gen_random_uuid() as ha;
grant select on hadm to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', ha, 'authenticated', 'authenticated',
         ha || '@test', now(), now() from hadm;
insert into public.memberships (principal_id, organization_id, hospital_id, role)
  select (select ha from hadm), (select org_b from k), (select hosp_b from k), 'hospital_admin';

-- ⭐ CAD-1 — PARITY. The reason app.cadence_status_of was extracted is that a second caller
-- means a second copy of the rule, and two copies drift silently. This asserts the two
-- paths answer identically for the SAME commission, read through their own gates: the
-- overview as the tenancy admin, meeting_cadence_status as a real member.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
create temp table cadov on commit drop as
  select commission_id, status, meeting_frequency from public.commission_cadence_overview();
grant select on cadov to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select status from cadov where commission_id = (select comm_x from k)),
  (public.meeting_cadence_status((select comm_x from k)) ->> 'status'),
  'CAD-1 ⭐ PARITY: the tenancy overview and the member door classify comm_x identically — the extracted helper has not drifted from the original inline rule');
reset role;

-- ⭐ CAD-2 — the grant works, and at BOTH tiers.
select is(
  (select count(*)::int from cadov where commission_id in ((select comm_x from k), (select comm_y from k))),
  2,
  'CAD-2 ⭐ the org tenancy admin sees every commission it administers (both bootstrap commissions)');

select test_helpers.claims_for((select ha from hadm), false);
set local role authenticated;
select ok(
  (select count(*) from public.commission_cadence_overview()) > 0,
  'CAD-3 ⭐ Q4 SYMMETRY: hospital_admin reaches the overview too — the two tenancy tiers do not diverge');
reset role;

-- ⭐ CAD-4 — THE OVER-GRANT TWIN, cross-tenant. CAD-2/CAD-3 pass by construction the moment
-- the door returns anything; only a negative shows the grant stopped where it was meant to.
select test_helpers.claims_for((select admin from xorg), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_cadence_overview()),
  0,
  'CAD-4 ⭐⭐ OVER-GRANT TWIN: a tenancy admin of ANOTHER organization sees ZERO rows — the door derives its own row set, so there is no parameter through which to ask about a foreign commission');
reset role;

-- ⭐ CAD-5 — and it is not a general listing. A plain member of comm_x reads its own cadence
-- through meeting_cadence_status; this door is the TENANCY surface and owes them nothing.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_cadence_overview()),
  0,
  'CAD-5 ⭐ a plain committee member gets ZERO rows — the overview is the tenancy-oversight door, not a general cadence listing');
reset role;

-- ⭐ CAD-6 — the restricted-meeting filter is INHERITED, and must stay inherited. The NEW
-- door carries its own copy of the `commission_default` predicate, so the existing §cadence
-- proof of the OLD door says nothing about it.
--
-- Reuses the `excl` fixture rather than minting a participants_only meeting here: a direct
-- participants_only INSERT trips the roster-nonempty guard (HC0C3), so a hand-rolled fixture
-- would fail for a reason unrelated to the filter. `excl` is charter=mensal with an OLD
-- commission_default meeting (→ em_atraso) plus a RECENT participants_only one — if the
-- closed session were counted the answer would flip to em_dia. Line ~244 pins the same
-- expectation on the member door, so CAD-6 is the tenancy-side twin of a proven property.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is(
  (select status from public.commission_cadence_overview() where commission_id = (select comm from excl)),
  'em_atraso',
  'CAD-6 ⭐ the overview EXCLUDES participants_only meetings: excl stays em_atraso on its old plenary — a closed session never reaches the tenancy tier, not even as a date');
reset role;

-- ⭐ CAD-7 — the boundary is INCLUSIVE, pinned directly on the helper. Flipping `<=` to `<`
-- would mark a committee overdue a day early, and no other assertion here would notice
-- (every fixture commission sits far from its boundary).
-- ⚠ `semanal`, not `mensal`, and the reason is worth keeping. `interval '1 month'` compares
-- as exactly 30 DAYS, but `now() - interval '1 month'` walks back a CALENDAR month — 31 days
-- in a 31-day month. So the "exactly one period old" probe is 31 days against a 30-day
-- window and lands em_atraso, which reads as a boundary bug and is not one (the original
-- door had identical semantics). A week is exactly 7 days in both directions, so it pins the
-- `<=` without the calendar confounder. The month behaviour itself is pinned by CAD-8b below
-- rather than left as a surprise for the next reader.
select is(
  app.cadence_status_of('semanal', now() - interval '1 week'),
  'em_dia',
  'CAD-7 ⭐ boundary INCLUSIVE: a meeting exactly one period old is still em_dia (the original `<=`, preserved through the extraction)');
select is(
  app.cadence_status_of('semanal', now() - interval '1 week' - interval '1 day'),
  'em_atraso',
  'CAD-8 ⭐ ...and one day past the period is em_atraso — CAD-7 is a boundary, not a blanket pass');
select is(
  app.cadence_status_of('mensal', now() - interval '30 days'),
  'em_dia',
  'CAD-8b ⭐ DOCUMENTED SEMANTICS: `mensal` measures 30 DAYS, not a calendar month — `interval ''1 month''` compares as 30 days, so a committee meeting on the same date each month reads em_atraso for the last day of every 31-day month. Pre-existing, unchanged by the extraction, pinned here so it is a decision rather than a surprise');
select is(
  app.cadence_status_of(null, now()),
  'sem_regimento',
  'CAD-9 no configured frequency classifies as sem_regimento regardless of meetings held');

select * from finish();
rollback;

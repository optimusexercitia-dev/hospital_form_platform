-- Referral detail redesign — Phase 1 (Backend). Plan: docs/plans/referral-detail-redesign.md.
--
-- What this file pins:
--   §1 (RETIRED) referral_note_types — the per-commission vocabulary this phase
--      shipped with. It was replaced by the fixed case-Registro `kind` vocabulary
--      (shared with case_events.kind), so the table, its RLS, its audit trigger and
--      the reorder RPC are gone and there is nothing left here to gate.
--   §2 create_referral_internal_note — the title/kind/assignee params, the REQUIRED
--      kind (default 'note') with its CHECK backstop, and authority-before-domain
--      ordering (42501 before HC0A9).
--   §3 K-R5-1 PRESERVED ACROSS THE NEW FIELDS. The old keystone proved a note's BODY
--      does not cross sides. A note now also carries a title, a kind and an
--      assignee — each of which is just as disclosing — so the keystone is re-proven
--      over the whole enriched row plus the A4 column-grant matrix.
--   §4 the open → concluded lifecycle and its four doors.
--   §5 get_referral_case_access_summary — a NEW prosecdef door. Its five roster arms,
--      the two that must NOT appear (S2 org_admin, S5 plain member), the hard-deny
--      (recusal), and the PARITY property that makes the whole design safe.
--   §6 two REGRESSIONS this phase's own migration created or closed, kept here
--      because neither is visible from the feature's happy path.
--
-- Convention (inherited from 150/298): assert ROWS or RAISES under `set local role
-- authenticated`, never a bare predicate call — a correct predicate is not a correct
-- policy. Every DENY carries a POSITIVE twin so a fail-closed regression cannot
-- masquerade as passing isolation.

begin;
select plan(63);

-- Flags ON for the whole test (hermetic; must not depend on migration order).
update app.feature_flags set enabled = true where key = 'case_referrals';
update app.feature_flags set enabled = true where key = 'case_access';
update app.feature_flags set enabled = true where key = 'audit_trail';
update app.feature_flags set enabled = true where key = 'technical_director';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,   -- + pqs_member of hosp_b below (S6)
         (v->>'sa_x')::uuid   as sa_x,    -- source coordinator (commission X)
         (v->>'st_x')::uuid   as st_x,    -- plain staff of X -> becomes the GRANTEE
         (v->>'st_x2')::uuid  as st_x2,   -- plain staff of X -> becomes the ASSIGNEE
         (v->>'sa_y')::uuid   as sa_y,    -- target coordinator (commission Y)
         (v->>'st_y')::uuid   as st_y,    -- plain staff of Y -> + quality_reviewer (S7)
         (v->>'oa_b')::uuid   as oa_b,    -- org_admin (S2 — must NOT appear)
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

create temp table voc on commit drop as
  select (select id from public.referral_types where key = 'parecer') as type_parecer;
grant select on voc to authenticated;

-- S6: the platform persona becomes a PQS operator of the hospital both commissions
-- hang under. S7: the target-side staff becomes a quality reviewer of the same
-- hospital, and X is made oversight-VISIBLE (the arm is inert on an excluded one).
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
select (select organization_id from public.hospitals where id = (select hosp_b from k)),
       (select hosp_b from k), (select admin from k), 'pqs_member', (select admin from k);
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
select (select organization_id from public.hospitals where id = (select hosp_b from k)),
       (select hosp_b from k), (select st_y from k), 'quality_reviewer', (select admin from k);
-- quality_oversight is guard-protected: it may only move through its own door, so the
-- fixture uses the door (as the org_admin) rather than reaching around the guard.
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select public.set_commission_oversight((select comm_x from k), 'visible');
reset role;

-- Cases: a SOURCE case in X (the referral's origin) and a TARGET case in Y.
create temp table cs on commit drop as
  select gen_random_uuid() as src_case, gen_random_uuid() as tgt_case,
         gen_random_uuid() as narr;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by) values
  ((select src_case from cs), (select comm_x from k), 9601, 'Caso origem', (select sa_x from k)),
  ((select tgt_case from cs), (select comm_y from k), 9602, 'Caso destino', (select sa_y from k));

-- S4 arm: a narrative on the source case assigned to st_x2.
insert into public.case_narratives
  (id, case_id, type_label, display_position, title, body_md, created_by, assigned_to)
values ((select narr from cs), (select src_case from cs), 'Resumo', 0, 'Resumo',
        'Corpo da narrativa', (select sa_x from k), (select st_x2 from k));

-- S3 arm: an explicit, live content grant to st_x.
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, reason_code, granted_by)
values ((select src_case from cs), (select st_x from k), 'manual_grant', true,
        'coordinator_grant', (select sa_x from k));

-- The referral: X -> Y, driven to in_review so BOTH sides' notes are readable.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r1 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Registros internos', true,
    'Descrição para viabilizar o envio.');
select public.send_referral((select id from r1));
reset role;
grant select on r1 to authenticated;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r1));
select public.accept_referral((select id from r1));
select public.start_referral_review((select id from r1));
select public.link_referral_case((select id from r1), (select tgt_case from cs));
reset role;

-- A SECOND referral, deliberately left UNLINKED (the null-summary case).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r2 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Sem caso vinculado', true,
    'Descrição para viabilizar o envio.');
select public.send_referral((select id from r2));
reset role;
grant select on r2 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r2));
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2 — create_referral_internal_note: title / kind / assignee
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table note_src on commit drop as
  select * from public.create_referral_internal_note(
    (select id from r1), (select comm_x from k), 'CORPO-NOTA-ORIGEM',
    'TITULO-NOTA-ORIGEM', 'meeting', (select st_x2 from k));
reset role;
grant select on note_src to authenticated;

select is((select kind from note_src), 'meeting',
  '2.1 the picked kind is stored (the SHARED case-Registro vocabulary)');
select is((select title from note_src), 'TITULO-NOTA-ORIGEM', '2.2 the title is stored');
select is((select assigned_to from note_src), (select st_x2 from k), '2.3 the assignee is stored');
select is((select status from note_src), 'open', '2.4 a new note starts open');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, 'corpo', null, 'analise_interna', null) $$,
    (select id from r1), (select comm_x from k)),
  'HC0A9', null,
  '2.5 a kind outside the shared six is rejected (HC0A9)');
-- On r2, NOT r1: this probe inserts a real note, and r1's list is the subject of
-- §4's open-before-concluded ordering contract (an extra open row there would push
-- the concluded note past the index 4.18 asserts on).
select is(
  (select kind from public.create_referral_internal_note(
     (select id from r2), (select comm_x from k), 'corpo sem tipo', null, null, null)),
  'note',
  '2.6 an omitted kind defaults to ''note'' (the type is REQUIRED, never untyped)');
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, 'corpo', null, 'note', %L) $$,
    (select id from r1), (select comm_x from k), (select sa_y from k)),
  'HC0A9', null,
  '2.7 an assignee who is not a member of THIS side is rejected (HC0A9)');
reset role;

-- Authority still precedes domain: a wrong-side caller passing an ALSO-invalid kind
-- must get 42501, never HC0A9 (the non-vacuity that proves the ordering).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, '   ', null, 'analise_interna', null) $$,
    (select id from r1), (select comm_x from k)),
  '42501', null,
  '2.8 authority is checked BEFORE domain: a wrong-side caller gets 42501, not HC0A9');
reset role;

-- The RPC's pt-BR refusal is the front door; the CHECK is the backstop that holds
-- even for a writer that never goes through it.
select throws_ok(
  format($$ update public.referral_internal_notes set kind = 'analise_interna' where id = %L $$,
    (select id from note_src)),
  '23514', null,
  '2.9 referral_internal_notes_kind_check rejects a kind outside the shared six');

-- A target-side note, so the cross-side keystone has something to fail to see.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table note_tgt on commit drop as
  select * from public.create_referral_internal_note(
    (select id from r1), (select comm_y from k), 'CORPO-NOTA-DESTINO',
    'TITULO-NOTA-DESTINO', 'decision', null);
reset role;
grant select on note_tgt to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3 — K-R5-1 PRESERVED ACROSS THE NEW FIELDS + the A4 grant matrix
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table notes_tgt_view on commit drop as
  select public.list_referral_internal_notes((select id from r1)) as j;
reset role;
grant select on notes_tgt_view to authenticated;

select is((select jsonb_array_length(notes_tgt_view.j) from notes_tgt_view), 1,
  '3.1 K-R5-1: the target side''s list carries ONLY its own note');
select is((select notes_tgt_view.j->0->>'title' from notes_tgt_view), 'TITULO-NOTA-DESTINO',
  '3.2 non-vacuity: it IS the target''s own note (title served to the owning side)');
select ok((select notes_tgt_view.j::text not like '%TITULO-NOTA-ORIGEM%'
             and notes_tgt_view.j::text not like '%CORPO-NOTA-ORIGEM%'
             and notes_tgt_view.j::text not like '%Análise técnica%'
           from notes_tgt_view),
  '3.3 K-R5-1 EXTENDED: the source note''s TITLE and TYPE LABEL do not cross either');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table notes_src_view on commit drop as
  select public.list_referral_internal_notes((select id from r1)) as j;
reset role;
grant select on notes_src_view to authenticated;
select is((select notes_src_view.j->0->>'assigned_to_name' from notes_src_view),
  (select full_name from public.profiles where id = (select st_x2 from k)),
  '3.4 the owning side DOES get the assignee''s resolved name');
select is((select notes_src_view.j->0->>'body_md' from notes_src_view), 'CORPO-NOTA-ORIGEM',
  '3.5 the door serves body_md (the renamed key) to the owning side');

select ok(not has_column_privilege('authenticated', 'public.referral_internal_notes', 'body_md', 'SELECT'),
  '3.6 A4: authenticated has NO direct SELECT on referral_internal_notes.body_md');
select ok(
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'title',        'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'kind',         'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'assigned_to',  'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'status',       'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'concluded_at', 'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'concluded_by', 'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'updated_at',   'SELECT') and
  has_column_privilege('authenticated', 'public.referral_internal_notes', 'updated_by',   'SELECT'),
  '3.7 A4 non-vacuity: EVERY new PHI-free column carries its own explicit grant');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select body_md from public.referral_internal_notes where id = %L $$,
    (select id from note_src)),
  '42501', null,
  '3.8 even the owning-side coordinator''s DIRECT select of body_md is denied (door-only)');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- §4 — the open -> concluded lifecycle
-- ═══════════════════════════════════════════════════════════════════════════
-- st_x is an owning-side member who is NEITHER author NOR assignee NOR coordinator.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_referral_internal_note(%L, 'x', 'y', 'note') $$,
    (select id from note_src)),
  '42501', null,
  '4.1 a member who is neither author, assignee nor coordinator cannot edit (42501)');
select throws_ok(
  format($$ select public.assign_referral_internal_note(%L, %L) $$,
    (select id from note_src), (select st_x from k)),
  '42501', null,
  '4.2 assignment is COORDINATOR-only — a plain member is denied (42501)');
reset role;

-- The ASSIGNEE may edit (the arm that makes 4.1 non-vacuous).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.update_referral_internal_note(%L, 'TITULO-EDITADO', 'CORPO-EDITADO', 'follow_up') $$,
    (select id from note_src)),
  '4.3 the ASSIGNEE can edit the note (non-vacuity for 4.1)');
reset role;
select is((select title from public.referral_internal_notes where id = (select id from note_src)),
  'TITULO-EDITADO', '4.4 …and the edit landed');
select is((select kind from public.referral_internal_notes where id = (select id from note_src)),
  'follow_up', '4.5 …and the kind was re-filed (meeting -> follow_up)');
select ok((select updated_by from public.referral_internal_notes where id = (select id from note_src))
          = (select st_x2 from k), '4.6 …and updated_by records who edited');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_referral_internal_note(%L, %L) $$,
    (select id from note_src), (select sa_y from k)),
  'HC0A9', null,
  '4.7 the coordinator cannot assign to a non-member of this side (HC0A9, after authority)');
select lives_ok(
  format($$ select public.unassign_referral_internal_note(%L) $$, (select id from note_src)),
  '4.8 the coordinator unassigns');
reset role;
select ok((select assigned_to is null from public.referral_internal_notes where id = (select id from note_src)),
  '4.9 …and the assignee is cleared');

-- The former assignee has now LOST edit authority (the gate reads live state).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_referral_internal_note(%L, 'x', 'y', null) $$,
    (select id from note_src)),
  '42501', null,
  '4.10 an UNASSIGNED former assignee loses edit authority (the gate is not cached)');
reset role;

-- Conclude, then prove the freeze.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.conclude_referral_internal_note(%L) $$, (select id from note_src)),
  '4.11 the author/coordinator concludes the note');
select throws_ok(
  format($$ select public.update_referral_internal_note(%L, 'x', 'y', null) $$,
    (select id from note_src)),
  'HC0A9', null,
  '4.12 a CONCLUDED note is frozen against edits (HC0A9)');
select throws_ok(
  format($$ select public.conclude_referral_internal_note(%L) $$, (select id from note_src)),
  'HC0A9', null,
  '4.13 a concluded note cannot be re-concluded (HC0A9)');
select throws_ok(
  format($$ select public.assign_referral_internal_note(%L, %L) $$,
    (select id from note_src), (select st_x from k)),
  'HC0A9', null,
  '4.14 a concluded note cannot receive an assignee (HC0A9)');
reset role;
select ok((select status = 'concluded' and concluded_at is not null
                  and concluded_by = (select sa_x from k)
             from public.referral_internal_notes where id = (select id from note_src)),
  '4.15 …and status/concluded_at/concluded_by are all set coherently');

-- AUTHORITY still precedes LIFECYCLE on a concluded note: the wrong-side caller must
-- get 42501, not the HC0A9 the note''s own state would produce.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.conclude_referral_internal_note(%L) $$, (select id from note_src)),
  '42501', null,
  '4.16 authority precedes lifecycle: a cross-side caller gets 42501, not the note''s HC0A9');
reset role;

-- Ordering contract: open first, then concluded; created_at DESC within each group.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table note_new on commit drop as
  select * from public.create_referral_internal_note(
    (select id from r1), (select comm_x from k), 'CORPO-NOTA-NOVA', 'TITULO-NOTA-NOVA', null, null);
-- The assign door's POSITIVE arm, and it is here because ARM=floor demanded it:
-- every other call to assign_referral_internal_note in this file RAISES, and a door
-- whose every invocation aborts is recorded by pg_stat_user_functions as never
-- called. The floor arm reported it as an uncalled door, which was literally true and
-- meant the "a coordinator CAN assign" half had never been proven at all.
select lives_ok(
  format($$ select public.assign_referral_internal_note(%L, %L) $$,
    (select id from note_new), (select st_x from k)),
  '4.20 the coordinator ASSIGNS an open note (the door''s positive arm)');
create temp table notes_ordered on commit drop as
  select public.list_referral_internal_notes((select id from r1)) as j;
reset role;
grant select on note_new to authenticated;
grant select on notes_ordered to authenticated;
select ok((select assigned_to from public.referral_internal_notes where id = (select id from note_new))
          = (select st_x from k),
  '4.21 …and the assignee is recorded on the note');
select is((select notes_ordered.j->0->>'status' from notes_ordered), 'open',
  '4.17 the list orders OPEN notes before concluded ones');
select is((select notes_ordered.j->1->>'status' from notes_ordered), 'concluded',
  '4.18 …with the concluded note after it');

select cmp_ok((select count(*)::int from public.audit_log
               where action in ('referral.note_updated','referral.note_assigned',
                                'referral.note_unassigned','referral.note_concluded')
                 and entity_id = (select id from r1)), '>=', 3,
  '4.19 Rule 11: every lifecycle mutation emits its own audit row');

-- ═══════════════════════════════════════════════════════════════════════════
-- §5 — get_referral_case_access_summary (NEW prosecdef door)
-- ═══════════════════════════════════════════════════════════════════════════
-- Authority.
--
-- ⚠ These two assert the MESSAGE, not just the SQLSTATE, and the reason is a finding
-- rather than a style choice. Neutralizing this door's own gate to `if false then`
-- left both GREEN when they matched on '42501' alone: execution simply fell through
-- to log_audit_access, whose registry arm independently refuses the same caller with
-- the SAME SQLSTATE. Defence in depth is welcome, but a keystone that cannot tell the
-- door's gate from its backstop is measuring the backstop. Pinning the door's own
-- pt-BR message is what makes the neutralization visible.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_referral_case_access_summary(%L, %L) $$,
    (select id from r1), (select comm_x from k)),
  '42501',
  'apenas um membro da comissão de origem ou destino pode consultar o acesso ao caso',
  '5.1 a principal who is a member of NEITHER side is denied by the DOOR''s own gate (42501)');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_referral_case_access_summary(%L, %L) $$,
    (select id from r1), (select comm_x from k)),
  '42501',
  'apenas um membro da comissão de origem ou destino pode consultar o acesso ao caso',
  '5.2 a member of Y cannot ask for X''s side (the side param is authority-checked)');
reset role;

-- Source side.
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
create temp table sum_src on commit drop as
  select public.get_referral_case_access_summary((select id from r1), (select comm_x from k)) as j;
reset role;
grant select on sum_src to authenticated;

select is((select (sum_src.j->>'case_id')::uuid from sum_src), (select src_case from cs),
  '5.3 the case is SIDE-DERIVED: the source side gets the source case');
select ok((select sum_src.j->'coordinators' ?
             (select full_name from public.profiles where id = (select sa_x from k)) from sum_src),
  '5.4 S1: the commission coordinator appears under Coordenadores');
select ok((select sum_src.j->'grantees' ?
             (select full_name from public.profiles where id = (select st_x from k)) from sum_src),
  '5.5 S3: the explicit case_access_grants holder appears under Acesso concedido');
select ok((select sum_src.j->'assignees' ?
             (select full_name from public.profiles where id = (select st_x2 from k)) from sum_src),
  '5.6 S4: the narrative assignee appears under Atribuídos');
select ok((select sum_src.j->'patient_safety' ?
             (select full_name from public.profiles where id = (select admin from k)) from sum_src),
  '5.7 S6: the PQS/NSP operator of the case''s hospital appears under Segurança do paciente');
select ok((select sum_src.j->'quality' ?
             (select full_name from public.profiles where id = (select st_y from k)) from sum_src),
  '5.8 S7: the hospital''s quality reviewer appears under Qualidade (oversight = visible)');
select ok((select sum_src.j::text not like
             '%' || (select full_name from public.profiles where id = (select oa_b from k)) || '%'
           from sum_src),
  '5.9 A7: S2 org_admin confers manage_case_access but NOT read_case_content — absent from every group');

-- PARITY — the property the whole design rests on: the roster is exactly the set of
-- people for whom can_read_case is true, so it CANNOT drift from app.can_read_case.
select is(
  (select count(*)::int
     from sum_src,
          jsonb_array_elements_text(
            (sum_src.j->'coordinators') || (sum_src.j->'grantees') || (sum_src.j->'assignees')
            || (sum_src.j->'patient_safety') || (sum_src.j->'quality')) as n(name)
    where not exists (
      select 1 from public.profiles p
       where p.full_name = n.name
         and app.can_read_case((select src_case from cs), p.id))),
  0,
  '5.10 PARITY: EVERY name in the roster genuinely satisfies app.can_read_case');

-- can_read is the CALLER's own effective access.
select test_helpers.claims_for((select st_x from k), false, 'staff');
set local role authenticated;
select ok((select (public.get_referral_case_access_summary(
             (select id from r1), (select comm_x from k)) ->> 'can_read')::boolean),
  '5.11 can_read is TRUE for the grantee (S3)');
reset role;

select test_helpers.claims_for((select sa_y from k), false, 'staff_admin');
set local role authenticated;
select is((select (public.get_referral_case_access_summary(
             (select id from r1), (select comm_y from k)) ->> 'case_id')::uuid),
  (select tgt_case from cs),
  '5.12 the TARGET side gets the target case (symmetry)');
select ok((select (public.get_referral_case_access_summary(
             (select id from r1), (select comm_y from k)) ->> 'can_read')::boolean),
  '5.13 …and can_read is TRUE for Y''s coordinator on Y''s own case (S1 on their side)');
select is(public.get_referral_case_access_summary((select id from r2), (select comm_y from k)),
  null,
  '5.14 a target side with NO linked case returns null (the empty-state contract)');
reset role;

-- HARD DENY: a recusal beats even the strongest positive arm (S1 coordinator).
insert into public.case_recusals (case_id, user_id, source, reason_md, recused_by)
values ((select src_case from cs), (select sa_x from k), 'coordinator',
        'Conflito declarado', (select sa_x from k));

select test_helpers.claims_for((select st_x from k), false, 'staff');
set local role authenticated;
create temp table sum_after on commit drop as
  select public.get_referral_case_access_summary((select id from r1), (select comm_x from k)) as j;
reset role;
grant select on sum_after to authenticated;
select ok((select not (sum_after.j->'coordinators' ?
             (select full_name from public.profiles where id = (select sa_x from k))) from sum_after),
  '5.15 HARD DENY: a RECUSED coordinator disappears from the roster (deny precedes every arm)');
select ok((select sum_after.j->'grantees' ?
             (select full_name from public.profiles where id = (select st_x from k)) from sum_after),
  '5.16 non-vacuity: the roster is not simply empty — the grantee is still listed');

-- can_read, the FALSE direction, with a meaningful cause: the recused coordinator is
-- still a member of the referral's source side (so the door answers), but the case
-- itself has closed to them.
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select ok(not (select (public.get_referral_case_access_summary(
             (select id from r1), (select comm_x from k)) ->> 'can_read')::boolean),
  '5.17 can_read is FALSE for the recused coordinator (the caller''s own effective access)');
reset role;

select ok((select sum_src.j::text !~* '(@|mrn|cpf|prontuário)' from sum_src),
  '5.18 PHI-free: the payload carries full names only — no e-mail, MRN or record number');

select cmp_ok((select count(*)::int from public.audit_log
               where action = 'referral.case_access_summary_viewed'
                 and entity_id = (select id from r1)), '>=', 1,
  '5.19 Rule 11: the roster read emits referral.case_access_summary_viewed');

-- ═══════════════════════════════════════════════════════════════════════════
-- §6 — REGRESSIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- 6a. THE NULL-HOLE. Before this phase, create_referral_internal_note gated with
-- `p_committee_id not in (source, target)`. On a technical_director referral
-- target_commission_id IS NULL, so that expression is NULL for every committee other
-- than the source, `NULL or false` is NULL, and plpgsql's IF skipped the raise — a
-- member of a WHOLLY UNINVOLVED commission could author a note on the referral.
-- Verified reachable against the live catalog before the fix. `link_referral_case`
-- already carried an explicit refusal for the identical shape ("NULL-hole #3"), which
-- is why this one is a regression test and not a feature request.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rdt on commit drop as
  select * from public.create_referral_draft(
    p_source_case_id       => (select src_case from cs),
    p_target_commission_id => null,
    p_referral_type_id     => (select type_parecer from voc),
    p_subject              => 'Direção técnica',
    p_description_md       => 'Parecer da direção técnica.',
    p_target_hospital_id   => (select hosp_b from k));
select public.send_referral((select id from rdt));
reset role;
grant select on rdt to authenticated;

select ok((select target_commission_id is null and target_type = 'technical_director'
             from public.case_referral where id = (select id from rdt)),
  '6.1 PREMISE: the DT referral really does have a NULL target_commission_id');

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, 'nota de terceiros') $$,
    (select id from rdt), (select comm_y from k)),
  '42501', null,
  '6.2 NULL-HOLE CLOSED: a member of an uninvolved commission cannot author on a DT referral');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_referral_internal_note(%L, %L, 'nota da origem') $$,
    (select id from rdt), (select comm_x from k)),
  '6.3 non-vacuity: the SOURCE side can still author on the same DT referral');
reset role;

-- 6b. THE RENAME ORPHAN. `dispose_referral_phi` (the LGPD Art. 18 erasure path)
-- redacts internal-note bodies by NAME. plpgsql resolves column names at runtime, so
-- the body -> body_md rename silently orphaned it: the migration stayed green and PHI
-- DISPOSAL broke. Proven here rather than trusted.
select is((select body_md from public.referral_internal_notes where id = (select id from note_tgt)),
  'CORPO-NOTA-DESTINO', '6.4 PREMISE: the note body is present before disposal');

select test_helpers.claims_for((select admin from k), false, 'pqs_member');
set local role authenticated;
select lives_ok(
  format($$ select public.dispose_referral_phi(%L, 'subject_request') $$, (select id from r1)),
  '6.5 dispose_referral_phi still RUNS after the rename (the orphan was repaired)');
reset role;

select is((select body_md from public.referral_internal_notes where id = (select id from note_tgt)),
  '[PHI removido]',
  '6.6 …and it still redacts the internal-note body through its NEW name (body_md)');

select * from finish();
rollback;

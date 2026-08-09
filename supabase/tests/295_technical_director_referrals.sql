-- =============================================================================
-- ADR 0094 W4 (T4.5-T4.9) — the Diretor Técnico referral plane.
--
-- The design claim under test is narrow: **a referral's target became a sum type and
-- nothing else forked.** So this file spends most of its assertions on the two things
-- that can go wrong with a sum type rather than on the happy path:
--
--   * §7 — the arms that must NOT exist. `target_commission_id` is now nullable, and
--     four expressions in the referral plane compared something to it. In SQL a NULL
--     comparison inside `if` / `check` is not `false`, it is PASS — so all four failed
--     OPEN and no pre-existing test could have gone red on any of them. Each is pinned
--     here by the DENIAL it is supposed to produce.
--   * §4 — the whole lifecycle driven by a DEPUTY, not the titular. D1 says titular
--     and deputy are equal; an arm that merely *mentions* the deputy role would pass a
--     membership assertion and still stall the referral at `accept`.
--
-- §1 catalog · §2 submission + the same-hospital rule · §3 the audience matrix ·
-- §4 the full lifecycle by a deputy · §5 dialogue (D3, NULL sender) · §6 waiting_on
-- (D9) · §7 the explicit "DT n/a" dispositions · §8 the office handover (D4) ·
-- §9 flag off ⇒ dark.
--
-- Mutation-checked by supabase/tests/mutation/w4-technical-director-referrals-audit.sh.
-- =============================================================================

begin;
-- 7 catalog + 7 submission + 11 audience + 5 lifecycle + 4 dialogue + 9 waiting_on
-- + 6 dispositions + 4 handover + 5 flag-off + 2 completeness = 60.
select plan(61);

update app.feature_flags set enabled = true
  where key in ('case_referrals', 'case_access', 'audit_trail', 'technical_director');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,   -- SOURCE coordinator (commission X, hospital B)
         (v->>'st_x')::uuid   as st_x,   -- plain staff of X
         (v->>'sa_y')::uuid   as sa_y,   -- coordinator of commission Y (same hospital)
         (v->>'st_y')::uuid   as st_y,   -- plain staff of Y — uninvolved in a DT referral
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- ── Fixture, MADE not borrowed ───────────────────────────────────────────────
-- The DT principals must hold NO commission membership. Every bootstrap persona holds
-- one, and `can_read_referral_metadata` admits any member of the SOURCE commission —
-- so a borrowed persona would read the referral through the source arm and the entire
-- audience matrix in §3 would pass without a DT arm existing at all. That is the
-- wrong-arm fixture failure this program keeps paying for, so the DT personas are new
-- users with nothing but a hospital-tier grant.
--
-- A SECOND hospital is also needed: bootstrap homes both commissions under hosp_b, so
-- without hosp_c there is no "another hospital's DT" and no way to test the
-- same-hospital rule at all.
create temp table dt on commit drop as
  select gen_random_uuid() as titular,
         gen_random_uuid() as deputy,
         gen_random_uuid() as other_hosp_dt,
         gen_random_uuid() as hosp_c;
grant select on dt to authenticated;

do $$
declare
  v_phys uuid := (select id from public.professional_categories where key = 'physician');
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u || '@test', now(), now()
  from (select titular as u from dt union all select deputy from dt
        union all select other_hosp_dt from dt) s;

  update public.profiles
     set home_organization_id = (select org_b from k),
         professional_category_id = v_phys,
         full_name = 'DT ' || left(id::text, 8)
   where id in (select titular from dt union all select deputy from dt
                union all select other_hosp_dt from dt);

  insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp_c from dt), (select org_b from k), 'Hosp C',
          'hosp-c-' || substr((select hosp_c from dt)::text, 1, 8));

  -- Appointments are made by raw DML here ON PURPOSE. supabase/tests/294 owns the
  -- appointment door (authority, the physician rule, the one-titular index); this file
  -- owns what the appointment BUYS. Driving the door again would couple the two suites
  -- and, when 294's arm broke, red this file for a reason that has nothing to do with
  -- referrals.
  insert into public.memberships (principal_id, organization_id, hospital_id, role) values
    ((select titular from dt), (select org_b from k), (select hosp_b from k), 'technical_director'),
    ((select deputy from dt),  (select org_b from k), (select hosp_b from k), 'technical_director_deputy'),
    ((select other_hosp_dt from dt), (select org_b from k), (select hosp_c from dt), 'technical_director');
end $$;

create temp table voc on commit drop as
  select (select id from public.referral_types where key = 'parecer') as type_parecer,
         (select id from public.reply_outcomes where key = 'procede') as outcome_procede;
grant select on voc to authenticated;

create temp table cs on commit drop as
  select gen_random_uuid() as src_case, gen_random_uuid() as tgt_case;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by) values
  ((select src_case from cs), (select comm_x from k), 9501, 'Caso DT', (select sa_x from k)),
  ((select tgt_case from cs), (select comm_y from k), 9502, 'Caso Y',  (select sa_y from k));

-- =============================================================================
-- §1 — CATALOG
-- =============================================================================

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.case_referral'::regclass
      and conname in ('case_referral_target_type_check', 'case_referral_target_shape')),
  2,
  '1.1 the discriminator and the shape are BOTH constraints (D7)');

select ok(
  pg_get_constraintdef((select oid from pg_constraint
    where conrelid = 'public.case_referral'::regclass and conname = 'case_referral_target_shape'))
    ilike '%else false%',
  '1.2 the target shape terminates in `else false` (an unknown target_type is rejected, not unconstrained)');

select ok(
  (select is_nullable = 'YES' from information_schema.columns
    where table_schema='public' and table_name='case_referral' and column_name='target_commission_id')
  and (select is_nullable = 'YES' from information_schema.columns
    where table_schema='public' and table_name='referral_messages' and column_name='sender_commission_id'),
  '1.3 both target-side columns are nullable (the sum type, and D3''s NULL sender)');

-- ⚠ THE RUNTIME-ONLY DEFECT. `authenticated` holds table-level INSERT/UPDATE on
-- case_referral but COLUMN-level SELECT, so a new column reads 42501 unless granted
-- explicitly — and nothing in a migration, a type-check or a build says so.
select is(
  (select count(*)::int from unnest(array[
       'target_type','target_hospital_id','target_hospital_name','waiting_on_hospital_id']) c(col)
    where has_column_privilege('authenticated', 'public.case_referral', c.col, 'SELECT')),
  4,
  '1.4 GRANTS: all four new columns carry an authenticated SELECT grant');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_referral_draft'),
  1,
  '1.5 create_referral_draft has exactly ONE overload (a second would be PGRST203)');

select ok(
  pg_get_triggerdef((select oid from pg_trigger
    where tgrelid = 'public.case_referral'::regclass and tgname = 'referral_snap_commission_names'))
    like '%target_hospital_id%',
  '1.6 the name-snapshot trigger fires on target_hospital_id (D5 would be correct on INSERT and stale forever otherwise)');

select ok(
  (select count(*) from pg_indexes
    where tablename = 'case_referral'
      and indexname = 'case_referral_target_hospital_created_keyset_idx') = 1,
  '1.7 the DT inbox has its own keyset index, mirroring the committee inbox');

-- =============================================================================
-- §2 — SUBMISSION (T4.7) and the SAME-HOSPITAL rule
-- =============================================================================

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table r1 on commit drop as
  select * from public.create_referral_draft(
    p_source_case_id       => (select src_case from cs),
    p_target_commission_id => null,
    p_referral_type_id     => (select type_parecer from voc),
    p_subject              => 'Análise da direção técnica',
    p_description_md       => 'Solicitamos parecer da direção técnica.',
    p_target_hospital_id   => (select hosp_b from k));
reset role;
grant select on r1 to authenticated;

select is(
  (select target_type from public.case_referral where id = (select id from r1)),
  'technical_director',
  '2.1 a DT draft lands with target_type = technical_director');

select ok(
  (select target_hospital_id = (select hosp_b from k) and target_commission_id is null
     from public.case_referral where id = (select id from r1)),
  '2.2 ...with the hospital set and the commission NULL (the shape CHECK''s other half)');

select is(
  (select target_hospital_name from public.case_referral where id = (select id from r1)),
  'Hosp Bootstrap',
  '2.3 D5: the target HOSPITAL name is snapshotted (not a commission name, not the DT''s person name)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- THE SAME-HOSPITAL RULE. A committee has no standing to address another hospital's
-- technical direction, and admitting one would hand that DT the PHI of a hospital it
-- is not responsible for.
select throws_ok(
  format($$select public.create_referral_draft(
             p_source_case_id => %L, p_target_commission_id => null,
             p_referral_type_id => %L, p_subject => 'X',
             p_target_hospital_id => %L)$$,
         (select src_case from cs), (select type_parecer from voc), (select hosp_c from dt)),
  'HC071', null,
  '2.4 SAME-HOSPITAL: a committee cannot address ANOTHER hospital''s technical direction');

select throws_ok(
  format($$select public.create_referral_draft(
             p_source_case_id => %L, p_target_commission_id => %L,
             p_referral_type_id => %L, p_subject => 'X',
             p_target_hospital_id => %L)$$,
         (select src_case from cs), (select comm_y from k),
         (select type_parecer from voc), (select hosp_b from k)),
  '23514', null,
  '2.5 EXACTLY ONE target: both a commission and a hospital is refused');

select throws_ok(
  format($$select public.create_referral_draft(
             p_source_case_id => %L, p_target_commission_id => null,
             p_referral_type_id => %L, p_subject => 'X',
             p_target_hospital_id => null)$$,
         (select src_case from cs), (select type_parecer from voc)),
  '23514', null,
  '2.6 EXACTLY ONE target: neither is refused (the two-sided test, so "neither" cannot slip through)');

reset role;

-- D7 at the base table: the discriminator cannot disagree with the ids, whatever a
-- future writer believes. A door-only rule is bypassable; W3's lesson is that such
-- writers appear.
select throws_ok(
  format($$insert into public.case_referral
             (source_case_id, source_commission_id, target_commission_id, target_type,
              type_label, subject)
           values (%L, %L, %L, 'technical_director', 'Parecer', 'X')$$,
         (select src_case from cs), (select comm_x from k), (select comm_y from k)),
  '23514', null,
  '2.7 D7: target_type = technical_director with a COMMISSION id is rejected by the shape CHECK');

-- The PHI snapshot + send. From here R1 is a live, sent DT referral.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.save_referral_patient(
  (select id from r1), 'Paciente DT', 'MRN-DT-1', null, 61, 'female', null, 'Clínica', 'Dr Y');
select public.send_referral((select id from r1));
reset role;

-- =============================================================================
-- §3 — THE AUDIENCE MATRIX (D1 titular ≡ deputy · D4 live)
-- =============================================================================

select ok(
  app.can_read_referral_metadata((select id from r1), (select titular from dt)),
  '3.1 the TITULAR reads the referral (the inbox — referrals have no notification fan-out)');

select ok(
  app.can_read_referral_metadata((select id from r1), (select deputy from dt)),
  '3.2 D1: the DEPUTY reads it too — flat authority, not a second tier');

select ok(
  not app.can_read_referral_metadata((select id from r1), (select other_hosp_dt from dt)),
  '3.3 another hospital''s technical direction reads NOTHING');

select ok(
  app.can_read_referral_metadata((select id from r1), (select st_x from k)),
  '3.4 the source committee is unchanged (a plain member of X still reads it)');

-- The arm is not simply admitting everyone: a plain member of the OTHER committee has
-- no part in a DT referral, and neither the source nor the DT arm reaches them.
select ok(
  not app.can_read_referral_metadata((select id from r1), (select st_y from k)),
  '3.11 an uninvolved committee''s staff reads nothing');

select ok(
  app.can_read_referral_phi((select id from r1), (select titular from dt))
  and app.can_read_referral_phi((select id from r1), (select deputy from dt)),
  '3.5 T4.8: both DT holders reach referral PHI');

select ok(
  not app.can_read_referral_phi((select id from r1), (select other_hosp_dt from dt)),
  '3.6 ...and another hospital''s DT does not');

-- The audited PHI door, at the product surface. Snapshotted BEFORE the role switch:
-- audit_log is not readable to a plain `authenticated` caller.
create temp table phi_before on commit drop as
  select (select count(*) from public.audit_log where action = 'referral_patient.read') as n;

-- RLS, not just the predicate. A correct predicate wired to the wrong policy is a
-- distinct failure shape, so assert actual ROWS under `set local role`.
select test_helpers.claims_for((select deputy from dt), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_referral where id = (select id from r1)),
  1,
  '3.7 RLS: the deputy actually SELECTs the row (predicate + policy, not predicate alone)');

select is(
  (select public.get_referral_patient((select id from r1)) ->> 'mrn'),
  'MRN-DT-1',
  '3.8 the deputy reads the patient identifiers through the audited single door');
reset role;
select is(
  (select count(*) from public.audit_log where action = 'referral_patient.read')
    - (select n from phi_before),
  1::bigint,
  '3.9 ...and that read wrote exactly one referral_patient.read audit row');

-- A DRAFT is the source's private workspace — the DT arm carries `status <> draft`
-- exactly as the target-committee arm does.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r2 on commit drop as
  select * from public.create_referral_draft(
    p_source_case_id       => (select src_case from cs),
    p_target_commission_id => null,
    p_referral_type_id     => (select type_parecer from voc),
    p_subject              => 'Rascunho DT',
    p_description_md       => 'ainda não enviado',
    p_target_hospital_id   => (select hosp_b from k));
reset role;
grant select on r2 to authenticated;

select ok(
  not app.can_read_referral_metadata((select id from r2), (select titular from dt)),
  '3.10 a DRAFT is invisible to the DT (same rule the target committee gets)');

-- =============================================================================
-- §4 — THE FULL LIFECYCLE, DRIVEN BY THE DEPUTY (D1 + D2)
-- =============================================================================
-- D1 is a claim about AUTHORITY, not about a role name appearing in a predicate. The
-- only way to prove it is to make a deputy carry the referral from arrival to reply
-- with the titular never acting.

select test_helpers.claims_for((select deputy from dt), false);
set local role authenticated;

select lives_ok(
  format($$select public.receive_referral(%L)$$, (select id from r1)),
  '4.1 the DEPUTY receives the referral');
select lives_ok(
  format($$select public.accept_referral(%L)$$, (select id from r1)),
  '4.2 ...accepts it');
select lives_ok(
  format($$select public.start_referral_review(%L)$$, (select id from r1)),
  '4.3 ...starts the review');

-- D2: insufficient_information is one of the two decline reasons that genuinely apply
-- to a DT, so the DT must be able to ASK before it has to refuse.
select lives_ok(
  format($$select public.request_referral_information(%L, 'Falta o laudo.')$$, (select id from r1)),
  '4.4 ...requests information from the source');
reset role;

select is(
  (select status from public.case_referral where id = (select id from r1)),
  'awaiting_information',
  '4.5 ...and the status machine is the SAME one (no forked lifecycle)');

-- =============================================================================
-- §5 — DIALOGUE (D3): a NULL sender IS the technical direction
-- =============================================================================

select is(
  (select sender_commission_id from public.referral_messages
    where referral_id = (select id from r1) and message_type = 'information_request'),
  null,
  '5.1 D3: the DT''s message carries a NULL sender_commission_id');

-- The other half of D3, and the one that matters: NULL is admissible on a DT row ONLY.
-- The previous guard tested `sender not in (v_src, v_tgt)`, which is NULL for a NULL
-- sender — the IF was not taken and the trigger returned NEW. It would have admitted a
-- NULL sender on EVERY referral.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r3 on commit drop as
  select * from public.create_referral_draft(
    p_source_case_id       => (select src_case from cs),
    p_target_commission_id => (select comm_y from k),
    p_referral_type_id     => (select type_parecer from voc),
    p_subject              => 'Encaminhamento comum',
    p_description_md       => 'via comissão');
select public.send_referral((select id from r3));
reset role;
grant select on r3 to authenticated;

select throws_ok(
  format($$insert into public.referral_messages
             (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
           values (%L, 99, null, %L, 'general', 'x')$$,
         (select id from r3), (select sa_x from k)),
  'HC0A0', null,
  '5.2 a NULL sender on a COMMISSION-targeted referral is REFUSED (the fail-open this closed)');

select lives_ok(
  format($$insert into public.referral_messages
             (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
           values (%L, 99, null, %L, 'general', 'x')$$,
         (select id from r1), (select deputy from dt)),
  '5.3 POSITIVE TWIN: the same NULL sender IS admitted on the DT-targeted referral');

select throws_ok(
  format($$insert into public.referral_messages
             (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
           values (%L, 98, %L, %L, 'general', 'x')$$,
         (select id from r1), (select comm_y from k), (select deputy from dt)),
  'HC0A0', null,
  '5.4 a foreign commission is still refused as sender on a DT referral');

-- =============================================================================
-- §6 — waiting_on (D9): "the DT is holding this" ≠ "nobody is waiting"
-- =============================================================================
-- provide_referral_information wrote `waiting_on_committee_id = target_commission_id`,
-- which is NULL on a DT row — and the CHECK permits NULL. Without D9 the busiest
-- state in the flow was indistinguishable from the idle one.

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.provide_referral_information((select id from r1), 'Segue o laudo.');
reset role;

select ok(
  (select waiting_on_hospital_id = (select hosp_b from k) and waiting_on_committee_id is null
     from public.case_referral where id = (select id from r1)),
  '6.1 D9: answering hands the ball to the DT''s HOSPITAL, not to nobody');

select isnt(
  (select waiting_on_hospital_id from public.case_referral where id = (select id from r1)),
  null,
  '6.2 ...so "the DT is holding this" is a state that can be read off the row');

-- These two probe the CHECK, so the STATUS guard has to be stood down first: it is a
-- BEFORE trigger and would raise HC070 before the constraint is ever evaluated — the
-- assertion would pass on the wrong guard entirely (authz-handoff §7.1).
set local app.in_referral_rpc = 'on';

select throws_ok(
  format($$update public.case_referral set waiting_on_hospital_id = %L where id = %L$$,
         (select hosp_b from k), (select id from r3)),
  '23514', null,
  '6.3 waiting_on_hospital_id is refused on a COMMISSION-targeted referral');

select throws_ok(
  format($$update public.case_referral
              set waiting_on_committee_id = %L, waiting_on_hospital_id = %L
            where id = %L$$,
         (select comm_x from k), (select hosp_b from k), (select id from r1)),
  '23514', null,
  '6.4 ...and BOTH waiting parties at once is refused (two answers to one question)');

set local app.in_referral_rpc = 'off';

-- Finish the lifecycle: conclude (deputy) → resolve (source) → reopen (source).
select test_helpers.claims_for((select deputy from dt), false);
set local role authenticated;
select lives_ok(
  format($$select public.conclude_referral(%L, %L, 'Parecer da direção técnica.', false)$$,
         (select id from r1), (select outcome_procede from voc)),
  '6.5 the DEPUTY concludes the referral (D1, end to end, titular never acted)');
reset role;

select is(
  (select status from public.case_referral where id = (select id from r1)),
  'answered',
  '6.6 ...and the reply lands on the ordinary answered/resolve path');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.resolve_referral((select id from r1), 'Encerrado.', false);
reset role;

-- "Exactly one waiting party" makes every writer of one column a writer of BOTH. This
-- is the assertion that would have caught conclude_referral and resolve_referral,
-- which carry no DT audience arm and therefore appear in no DT-shaped enumeration.
select ok(
  (select waiting_on_committee_id is null and waiting_on_hospital_id is null
     from public.case_referral where id = (select id from r1)),
  '6.9 a terminal state clears BOTH waiting parties (a stale one reads as "the DT still holds this")');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_referral((select id from r1), 'Nova informação.');
reset role;

-- The plan named only provide_referral_information for D9. The catalog names TWO:
-- reopen_referral hands the ball back to the target as well, and on a DT row it wrote
-- the same silent NULL.
select ok(
  (select waiting_on_hospital_id = (select hosp_b from k) and waiting_on_committee_id is null
     from public.case_referral where id = (select id from r1)),
  '6.7 D9: REOPENING also hands the ball to the DT''s hospital (the second site)');

-- The commission path is untouched by all of this — the regression proof for D9.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r3));
select public.accept_referral((select id from r3));
select public.start_referral_review((select id from r3));
select public.request_referral_information((select id from r3), 'Faltam dados.');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.provide_referral_information((select id from r3), 'Seguem os dados.');
reset role;

select ok(
  (select waiting_on_committee_id = (select comm_y from k) and waiting_on_hospital_id is null
     from public.case_referral where id = (select id from r3)),
  '6.8 REGRESSION: a commission-targeted referral still waits on the COMMITTEE');

-- =============================================================================
-- §7 — THE EXPLICIT "DT n/a" DISPOSITIONS
-- =============================================================================
-- None of these may be left implicit. Three of the four were fail-OPEN: the DT passes
-- app.can_manage_referral_target (§4 just widened it), reaches the domain check, and
-- the domain check compares against a NULL target_commission_id.

select test_helpers.claims_for((select deputy from dt), false);
set local role authenticated;

-- Finding 3: a DT referral can NEVER have a target case — `cases.commission_id` is NOT
-- NULL and a DT holds no commission. Before the explicit refusal,
-- `v_case_commission <> target_commission_id` was NULL, the IF was not taken, and ANY
-- case in the database could have been attached.
select throws_ok(
  format($$select public.link_referral_case(%L, %L)$$,
         (select id from r1), (select tgt_case from cs)),
  'HC079', null,
  '7.1 NULL-HOLE: the DT cannot attach a target case (it would have attached ANY case)');

select throws_ok(
  format($$select public.link_referral_related_case(%L, %L, 'related_case')$$,
         (select id from r1), (select tgt_case from cs)),
  'HC0A8', null,
  '7.2 NULL-HOLE: the DT cannot link related cases (a raw 23502 out of a check it PASSED)');

-- This one needs no code: `p_commission_id = target_commission_id` is NULL for a DT
-- row so the elsif is not taken and it falls to the else. It fails CLOSED already —
-- asserted rather than assumed, so a future edit cannot quietly open it.
select throws_ok(
  format($$select public.assign_referral_reviewer(%L, %L, %L, 'primary_reviewer')$$,
         (select id from r1), (select comm_y from k), (select sa_y from k)),
  'HC0A7', null,
  '7.3 assign_referral_reviewer already fails CLOSED for a DT row (no edit, but asserted)');
reset role;

-- D8 — no DT internal notes. Internal notes exist so a multi-member committee can
-- deliberate privately before answering; the DT audience is one office that answers
-- directly. Purely additive later if a need ever appears.
select ok(
  not app.can_read_referral_internal_notes((select id from r1), (select titular from dt))
  and not app.can_read_referral_internal_notes((select id from r1), (select deputy from dt)),
  '7.4 D8: internal notes are invisible to the technical direction');

-- D6 — no DT disposal arm. A party that governs neither the record nor its retention
-- must not be able to destroy it; ADR 0078/M2 removed the platform_admin bypass for
-- exactly this shape.
select test_helpers.claims_for((select titular from dt), false);
set local role authenticated;
select ok(
  not public.can_dispose_referral_phi((select id from r1)),
  '7.5 D6: the technical direction may READ the PHI it was sent and may NOT dispose of it');
reset role;

-- ⚠ RE-ANCHORED by BUG-QOB-004 (`20260917000000`). The twin used to run on a COMMISSION
-- ADMIN — sa_x granted `org_admin` — because `staff_admin` was the wrong arm. The PO's
-- CUT ruling removed the tenancy arm from this door outright, so that anchor no longer
-- exists and the twin was pinning a capability the product deliberately deleted (the
-- recorded shape: a fixed/removed behaviour leaves tests asserting the OLD one).
--
-- The control's JOB is unchanged and still necessary: without it, 7.5 passes vacuously
-- the moment `can_dispose_referral_phi` returns a blanket false. So it re-anchors on the
-- arm that SURVIVES the ruling — the NSP/PQS operator — rather than being deleted.
--
-- ⚠ It must be the SOURCE hospital. r1 targets the technical direction, so
-- `target_commission_id` is NULL and `hospital_of_commission(NULL)` is NULL → the target
-- arm cannot fire for a DT-targeted referral (catalog-checked, not assumed). A dedicated
-- principal is seated holding ONLY `pqs_member` so the twin measures disposal authority
-- and nothing else — sa_x is by now triple-hatted (coordinator + org_admin for §8's
-- handover) and would blur exactly what this control is for.
create temp table pqs on commit drop as select gen_random_uuid() as operator;
grant select on pqs to authenticated;

-- Clear the claims first — guard_profile_privileged_columns decides by `auth.uid() is
-- null`, not by database role, so a leftover JWT makes this fixture raise even as
-- postgres (same trap §8 documents below).
select set_config('request.jwt.claims', null, true);
do $$
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', (select operator from pqs),
          'authenticated', 'authenticated', (select operator from pqs) || '@test', now(), now());
  update public.profiles
     set home_organization_id = (select org_b from k),
         professional_category_id = (select id from public.professional_categories where key = 'physician'),
         full_name = 'NSP Operador'
   where id = (select operator from pqs);
end $$;

insert into public.memberships (principal_id, organization_id, hospital_id, role)
  values ((select operator from pqs), (select org_b from k), (select hosp_b from k), 'pqs_member');

-- sa_x still needs org_admin for §8's atomic handover; the grant moves nowhere, it just
-- stops being what the twin measures.
insert into public.memberships (principal_id, organization_id, role)
  values ((select sa_x from k), (select org_b from k), 'org_admin');

select test_helpers.claims_for((select operator from pqs), false);
set local role authenticated;
select ok(
  public.can_dispose_referral_phi((select id from r1)),
  '7.6 POSITIVE TWIN for D6: the source-hospital NSP operator still can (7.5 is not a blanket refusal)');
reset role;

-- ⚠ REVERSED WITHIN THE DAY, and the history is the point. `20260917000000` CUT the
-- tenancy arm here (BUG-QOB-004, on the D5 precedent) and this assertion pinned the cut.
-- `20260917000400` RESTORED it as a BACKSTOP once two facts surfaced while examining the
-- sibling `dispose_event_phi`: a hospital can have ZERO NSP operators (`Hospital Unico C`),
-- so NSP-only disposal strands an LGPD Art. 18 erasure obligation that belongs to the
-- ORGANIZATION; and this platform already keeps the tenancy arm on the identically-shaped
-- `revoke_printed_document` (ADR 0104 D11 — a governance act that reveals no content).
--
-- So the assertion flips rather than being deleted: it still measures the tenancy tier on
-- this door, and it still fails loudly if someone re-cuts by symmetry. The DRAFTING cut is
-- untouched and guarded separately (`314` 8.7).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  public.can_dispose_referral_phi((select id from r1)),
  '7.7 BACKSTOP (FUP-QOB-3): the source-side tenancy admin CAN dispose again — disposal reveals no content, and an unstaffed-NSP hospital must still be able to honour an erasure request');
reset role;

-- =============================================================================
-- §8 — THE OFFICE HANDOVER (D4)
-- =============================================================================
-- The referral targets the OFFICE, not the person. Replace the DT mid-referral and
-- access must move with the office in BOTH directions in the same instant — that is
-- what "no person-snapshot, no grace window" has to mean operationally.

create temp table hand on commit drop as select gen_random_uuid() as successor;
grant select on hand to authenticated;

-- ⚠ CLEAR THE CLAIMS FIRST. guard_profile_privileged_columns treats identity columns
-- as service-role-only and decides by `auth.uid() is null`, NOT by the database role —
-- so a leftover `request.jwt.claims` from the previous section makes this fixture
-- update raise, even running as postgres with the role reset.
select set_config('request.jwt.claims', null, true);

do $$
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', (select successor from hand),
          'authenticated', 'authenticated', (select successor from hand) || '@test', now(), now());
  update public.profiles
     set home_organization_id = (select org_b from k),
         professional_category_id = (select id from public.professional_categories where key = 'physician'),
         full_name = 'DT Sucessor'
   where id = (select successor from hand);
end $$;

select ok(
  not app.can_read_referral_metadata((select id from r1), (select successor from hand)),
  '8.1 the successor holds NOTHING before the handover');

-- The atomic replacement door (T4.3) is what a real handover uses. sa_x was made an
-- org_admin of this org before §7.6, which is exactly the authority the DT arm wants.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.appoint_technical_director((select hosp_b from k), (select successor from hand));
reset role;

select ok(
  app.can_read_referral_metadata((select id from r1), (select successor from hand))
  and app.can_read_referral_phi((select id from r1), (select successor from hand)),
  '8.2 D4: the INCOMING holder immediately gains the referral AND its PHI');

select ok(
  not app.can_read_referral_metadata((select id from r1), (select titular from dt))
  and not app.can_read_referral_phi((select id from r1), (select titular from dt)),
  '8.3 D4: the OUTGOING holder immediately loses both (no standing grant to someone no longer responsible)');

select ok(
  app.can_read_referral_metadata((select id from r1), (select deputy from dt)),
  '8.4 ...and the DEPUTY is untouched by a titular handover');

-- =============================================================================
-- §9 — FLAG OFF ⇒ DARK
-- =============================================================================
-- The flag is folded into app.is_technical_director_of_for rather than repeated at its
-- six call sites, so "off ⇒ the audience is empty" is true by construction everywhere,
-- including at sites added after this migration.

update app.feature_flags set enabled = false where key = 'technical_director';

select ok(
  not app.can_read_referral_metadata((select id from r1), (select successor from hand)),
  '9.1 FLAG OFF: the DT loses the inbox');
select ok(
  not app.can_read_referral_phi((select id from r1), (select successor from hand)),
  '9.2 FLAG OFF: ...and the PHI');
select ok(
  not app.can_manage_referral_target((select id from r1), (select successor from hand)),
  '9.3 FLAG OFF: ...and the whole target-side lifecycle');
select ok(
  not app.can_read_referral_metadata((select id from r1), (select deputy from dt)),
  '9.4 FLAG OFF: the deputy goes dark too (one predicate, one flag, both roles)');

-- The commission path is completely unaffected by the DT flag.
select ok(
  app.can_read_referral_metadata((select id from r3), (select sa_y from k)),
  '9.5 FLAG OFF: the commission referral plane is untouched');

update app.feature_flags set enabled = true where key = 'technical_director';

-- =============================================================================
-- §10 — THE SUM TYPE HAS NO THIRD ARM
-- =============================================================================
-- The completeness check, in the shape ADR 0094 decision 6 established: iterate the
-- LIVE target_type vocabulary and assert every value has an audience arm. A third
-- target added without an arm reds this immediately instead of failing open.

select is(
  (select count(*)::int
     from regexp_matches(
       pg_get_constraintdef((select oid from pg_constraint
         where conrelid='public.case_referral'::regclass
           and conname='case_referral_target_type_check')),
       '''(commission|technical_director)''', 'g')),
  2,
  '10.1 the target vocabulary is exactly {commission, technical_director} — a third value needs an arm in every §3 predicate');

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in ('can_manage_referral_target','can_read_referral_metadata','can_read_referral_phi')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') like '%is_technical_director_of_for%'),
  3,
  '10.2 all three audience predicates carry the DT arm (one missing = a whole tier of access silently absent)');

select * from finish();
rollback;

-- =============================================================================
-- 328 — DM1 substrate cutover keystones (ADR 0114; plan:
-- docs/plans/dm1-substrate-cutover-plan.md; decisions ADR 0116).
--
-- Turn-1 sections: K1 (attachment door-sweep), K2 (DM4 allowlist pins),
-- K8 (parked-seam writer refusals). K3–K7/K9/K10 join this file with M2–M6
-- inside the same phase — the plan() count grows with them.
--
-- ⭐ RED-FIRST RECORD (K1/K8): this file was authored and run against the
-- PRE-M1 catalog (2026-08-12, HEAD 61bb0ce) and observed RED before migration
-- 20260923000100 existed. The observed pre-M1 values are recorded in the
-- phase record (PROGRESS.md DM1 rows) and the M1 commit message — K1 red
-- proves the sweep SEES the doomed surface; K8 red (three writers SUCCEED)
-- proves the parked-seam guards did not pre-exist. K2 is a set of existence
-- PINS (green on both sides by design — its red is "someone dropped a
-- preserved referral surface early", the accident it exists to catch).
--
-- K1 allowlist (= the DM4 closure artifact, ADR 0114 D5 / plan DM1 item 2):
-- DM4 empties it — ALL of it, including the two non-%attachment% entries
-- (case_documents_select_member + app.can_read_snapshot_document) — and
-- re-runs this sweep at zero exceptions. Every name below is asserted to
-- EXIST in K2 so DM4 cannot forget one.
-- =============================================================================

begin;
select plan(20);

-- Flag preconditions asserted, never assumed (authz-handoff §7.3).
select is(app.feature_enabled('case_referrals'), true,
  'precondition: case_referrals flag is ON (K8a exercises a referral writer)');
select is(app.feature_enabled('patient_safety'), true,
  'precondition: patient_safety flag is ON (K8b exercises an RCA writer)');
select is(app.feature_enabled('ethics'), true,
  'precondition: ethics flag is ON (K8c exercises an ethics writer)');

-- =============================================================================
-- K1 — the attachment door-sweep: zero surviving centralized-attachment
-- surface, minus the named referral-owned allowlist. Enumerated from the LIVE
-- catalog, never from prose.
-- =============================================================================

-- K1a: routines. Allowlist: the two referral-owned RPCs (DM4 retires them).
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.proname ilike '%attachment%'
      and p.proname not in ('add_referral_reply_attachment',
                            'get_referral_attachment_path')),
  0,
  'K1a zero %attachment% routines in app/public beyond the two referral-owned RPCs');

-- K1b: policies (ALL schemas — table policies + storage.objects). Allowlist:
-- the referral reply-attachment table policy + the two referral storage doors.
select is(
  (select count(*)::int
     from pg_policies
    where (policyname ilike '%attachment%' or tablename ilike '%attachment%')
      and policyname not in ('referral_reply_attachment_select_readable',
                             'referral_attachments_obj_insert',
                             'referral_attachments_obj_select')),
  0,
  'K1b zero %attachment% policies beyond the three referral-owned ones');

-- K1c: relations. Allowlist: referral_reply_attachment (the referral module''s
-- own table, DM4''s to migrate).
select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'public')
      and c.relkind in ('r', 'v', 'm', 'p')
      and c.relname ilike '%attachment%'
      and c.relname <> 'referral_reply_attachment'),
  0,
  'K1c zero %attachment% relations beyond referral_reply_attachment');

-- K1d: routine EXECUTE grants reachable by client roles.
select is(
  (select count(*)::int
     from information_schema.role_routine_grants g
    where g.routine_schema in ('app', 'public')
      and g.routine_name ilike '%attachment%'
      and g.routine_name not in ('add_referral_reply_attachment',
                                 'get_referral_attachment_path')
      and g.grantee in ('authenticated', 'anon', 'PUBLIC')),
  0,
  'K1d zero client EXECUTE grants on %attachment% routines beyond the allowlist');

-- K1e: no SURVIVING function body references a dropped routine name
-- (comment-stripped — §7.2; this is what catches an unpatched
-- _audit_access_authorized-class dependency).
select is(
  (select count(*)::int
     from (select n.nspname, p.proname,
                  regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('app', 'public')) b
    where b.src ~ ('assert_attachments_enabled|attachment_confidentiality_ok'
                || '|can_read_attachment|can_write_attachment'
                || '|commission_of_attachment|guard_attachment_immutable'
                || '|trg_audit_attachment|create_attachment|open_attachment'
                || '|dispose_attachment_phi|reclassify_attachment'
                || '|soft_delete_attachment')),
  0,
  'K1e no surviving app/public function body references a dropped attachment routine');

-- K1f: no surviving function body references the dropped relations.
select is(
  (select count(*)::int
     from (select n.nspname, p.proname,
                  regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('app', 'public')) b
    where b.src ~ ('public\.attachments\M|public\.attachment_references\M'
                || '|public\.attachment_subjects\M'
                || '|\yfrom attachments\y|\yjoin attachments\y'
                || '|\yinto attachments\y|\yupdate attachments\y')),
  0,
  'K1f no surviving app/public function body references a dropped attachment relation');

-- K1g: no storage.objects policy references the two centralized-attachment
-- bucket literals (quoted-literal match — cannot false-positive on
-- ''referral-attachments''). The bucket ROWS themselves retire in DM5, not here.
select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~ '''attachments''|''attachments-phi'''),
  0,
  'K1g no storage.objects policy references the attachments / attachments-phi buckets');

-- =============================================================================
-- K2 — the DM4 allowlist, pinned by NAME so DM4 cannot forget an entry.
-- Every row here is a live referral-owned boundary DM1 deliberately spares
-- (plan DM1 item 1 + the 2026-08-12 amendments). DM4 retires ALL of them and
-- flips these pins to zero-count DELIBERATELY, in the same change (the
-- 325-t4 discipline: retire deliberately, never by accident).
-- =============================================================================

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'case_documents_select_member'),
  'K2a case_documents_select_member survives DM1 (live frozen-snapshot boundary until DM4)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_snapshot_document'),
  'K2b app.can_read_snapshot_document survives DM1 (predicate of K2a, DM4 retires it)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_referral_reply_attachment'),
  'K2c add_referral_reply_attachment survives DM1 (referral-owned, DM4 migrates it)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_referral_attachment_path'),
  'K2d get_referral_attachment_path survives DM1 (referral-owned, DM4 migrates it)');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'public' and tablename = 'referral_reply_attachment'
     and policyname = 'referral_reply_attachment_select_readable'),
  'K2e referral_reply_attachment_select_readable survives DM1');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'referral_attachments_obj_insert'),
  'K2f referral_attachments_obj_insert survives DM1');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'referral_attachments_obj_select'),
  'K2g referral_attachments_obj_select survives DM1');

-- =============================================================================
-- K8 — parked-seam writers refuse their document arms (HC0DM), fail-closed
-- until the owning wave re-points them (referrals → DM4; RCA citation →
-- Wave D; ethics → open item Q1). Personas + fixtures from seed.sql; the
-- document-id arguments are never dereferenced post-M1 (the guards raise
-- first), so these keystones survive the seed losing its attachment rows.
-- =============================================================================

-- K8a fixture: a DRAFT referral from Caso 0001 (CCIH → Farmácia), direct
-- insert under the referral guard GUC (the seed dialect).
select set_config('app.in_referral_rpc', 'on', true);
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id,
   referral_type_id, type_label, subject, response_expected, created_by, status)
values
  ('328e0000-0000-0000-0000-0000000000d1',
   'd0000000-0000-0000-0000-0000000000c1',       -- Caso 0001 (CCIH)
   'a0000000-0000-0000-0000-0000000000a1',       -- CCIH (source)
   'b0000000-0000-0000-0000-0000000000b1',       -- Farmácia (target)
   (select id from public.referral_types where key = 'parecer'),
   'Parecer', 'Fixture K8a (DM1)', true,
   '00000000-0000-0000-0000-000000000002',       -- chefe.ccih
   'draft');
select set_config('app.in_referral_rpc', 'off', true);

select test_helpers.claims_for(
  '00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $$ select public.add_referral_shared_item(
       '328e0000-0000-0000-0000-0000000000d1', 'document', null,
       'a3300000-0000-0000-0000-0000000000a1') $$,
  'HC0DM',
  'o compartilhamento de documentos do caso está temporariamente indisponível (migração do modelo de documentos)',
  'K8a add_referral_shared_item refuses its document arm (parked until DM4)');
reset role;

-- K8b: the seeded in-progress RCA (chefe.ccih is its team lead) refuses a
-- document CITATION (the cited_document_id seam, parked until Wave D).
select test_helpers.claims_for(
  '00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $$ select public.add_rca_evidence(
       'f3000000-0000-0000-0000-0000000000a3', 'citation',
       'Citação de documento (K8b)', null, null, 'document',
       'a3300000-0000-0000-0000-0000000000a1', 'Rótulo K8b') $$,
  'HC0DM',
  'a citação de documento como evidência está temporariamente indisponível (migração do modelo de documentos)',
  'K8b add_rca_evidence refuses a document citation (parked until Wave D)');
reset role;

-- K8c: the ethics coordinator cannot attach a related document to a
-- notification (the related_document_id seam, parked until the Q1 ruling).
select test_helpers.claims_for(
  '00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $$ select public.issue_ethics_notification(
       'ca000000-0000-0000-0000-0000000000e1', 'other', 'system',
       'fd000000-0000-0000-0000-0000000000e1', null, null,
       'a7000000-0000-0000-0000-0000000000e1', null) $$,
  'HC0DM',
  'anexar documento à notificação está temporariamente indisponível (migração do modelo de documentos)',
  'K8c issue_ethics_notification refuses a related document (parked until the Q1 ruling)');
reset role;

select * from finish();
rollback;

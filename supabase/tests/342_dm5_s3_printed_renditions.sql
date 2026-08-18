-- =============================================================================
-- 342 — DM5 S3 (Wave D pt.2): printed renditions on the core document model.
-- ADR 0120 D1/D6/D7/D11/D12/D13/D17/D18; migrations 20260927000300..000350.
--
-- ⚠ WHY THIS FILE IS THE WHOLE ASSURANCE, and not a supplement to the four authz
-- arms. Every door DM5 adds or changes sits in a census BLIND class, so
-- ARM=census / hat / floor / wrapper pass REGARDLESS of what is built (ADR 0120
-- Consequences). Bespoke keystones plus mutation twins are therefore MANDATORY
-- here, not a fallback, and `lint:vacuous` cannot help: it scans TS, and every
-- assertion below is SQL (FUP-PGTAP-VACUOUS).
--
-- ⭐ THE DISCIPLINE APPLIED THROUGHOUT: neutralize each lock INDEPENDENTLY, and
-- carry a positive control for the block's own assertions. Sibling locks in this
-- area are dense — `add_referral_shared_item` alone carries TWO independent
-- reasons to exclude a print, and the new pin trigger stands in front of three
-- pre-existing `printed_documents` probes in 312. A green assertion whose
-- refusal came from the wrong lock is this phase's most-paid-for failure.
-- =============================================================================

begin;
-- ⚠ The number below must equal the `plan(N)` on the next executable line. It
-- read 44 while the plan ran 59 (FUP-DM5-342-PLAN-COMMENT) — and the itemisation
-- itself already summed to 59: only the leading total was stale, because items
-- were appended without re-adding. The header is the first thing a reader trusts
-- when judging whether assertions went missing, which is exactly the call
-- pg_prove's plan line exists to support.
-- plan(59) = 3 preconditions + 5 coupling + 6 mint + 4 separation + 7 inactive-print
-- + 2 positive control + 2 structural direction-2 + 3 D18 + 7 write guards
-- + 2 core-door premise + 3 ACL/population + 5 meeting-print narrowing (S3j)
-- + 1 guard-5 twin (r1 MINOR-3) + 3 guard-4 sibling-open (r1 MAJOR-1, S3k)
-- + 3 can_write_document print arm (r1 MINOR-2, S3l)
-- + 3 unique-violation attribution (r1 MINOR-4, S3n — incl. its restore control).
select plan(59);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

create temp table r on commit drop as
  select '00000000-0000-0000-0000-00000000f101'::uuid as resp_sub,
         '00000000-0000-0000-0000-00000000f201'::uuid as pd1,
         'S3TOKEN1AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok1,
         'RSTUVW2345'::text as sc1,
         -- r1 MINOR-4: a THIRD id, so the short-code collision can be probed
         -- without a coordinate collision confounding it.
         '00000000-0000-0000-0000-00000000f203'::uuid as pd3,
         'S3TOKEN3AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok3;
grant select on r to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select r.resp_sub, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from r, k;

-- A case in the BOOTSTRAP tenancy, for the guard TWINS in S3f.
-- ⚠ It has to be created here: `test_helpers.bootstrap()` truncates
-- `public.organizations cascade`, so every seeded case is gone by this point.
-- A suite that reached for a seed id here would fail P0002 and read as a
-- broken guard rather than a missing fixture.
create temp table cs on commit drop as
  select '00000000-0000-0000-0000-00000000f301'::uuid as case_a;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, status, created_by)
select cs.case_a, k.comm_x, 942001, 'Caso fixture 342', 'in_review', k.sa_x from cs, k;   -- cases_status_check vocabulary, read from the catalog

-- Upload-before-mint at the DERIVED coordinate, with metadata (the mint derives
-- size/mime from it — ADR 0114 D9 server-derived facts).
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(pd1),
       jsonb_build_object('size', 4096, 'mimetype', 'application/pdf') from r;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(pd3),
       jsonb_build_object('size', 4096, 'mimetype', 'application/pdf') from r;

-- ⭐ A MEETING PRINT, and it is the most load-bearing fixture in this file.
-- The form_response print above CANNOT demonstrate what the M3 print arm is for,
-- because `form_response` has no home arm of its own — remove the print arm and
-- the kernel falls through to `else false`, i.e. it gets NARROWER and every
-- assertion about a refusal stays green. A MEETING print is the opposite: its
-- home arm is `app.is_member_of_for(v_commission, p_uid)`, which is WIDER than
-- `can_view_printed_document`'s meeting arm (can_reach_meeting AND
-- can_read_full_meeting_content). So a `participants_only` meeting plus a member
-- who is NOT an attendee is exactly the state where routing a print's authority
-- by its HOME TYPE would disclose the print's metadata to someone the print door
-- refuses. S3j asserts that gap is closed, and it is the only block here that
-- would go RED if the print arm were deleted from can_read_document.
create temp table mt on commit drop as
  select '00000000-0000-0000-0000-00000000f401'::uuid as meet_p,
         '00000000-0000-0000-0000-00000000f402'::uuid as pd2,
         'S3TOKEN2AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok2,
         'STUVWX2345'::text as sc2;
grant select on mt to authenticated;
-- ⚠ Created `commission_default` then FLIPPED. A guard refuses a
-- `participants_only` meeting with no participants ("uma reunião restrita aos
-- participantes exige ao menos um participante"), and the attendee cannot be
-- inserted before the meeting it points at. So the order is forced: insert,
-- attend, then restrict. Doing it the intuitive way aborts the whole file.
insert into public.meetings
  (id, commission_id, meeting_number, title, scheduled_start, visibility_policy)
select mt.meet_p, k.comm_x, 942002, 'Reunião restrita 342', now(), 'commission_default'
  from mt, k;
-- st_x is an ATTENDEE (so he can reach it and may mint); st_x2 is a plain
-- commission member and is deliberately NOT one.
insert into public.meeting_attendees (meeting_id, user_id)
select mt.meet_p, k.st_x from mt, k;
update public.meetings set visibility_policy = 'participants_only'
 where id = (select meet_p from mt);
-- Asserted, not assumed: the flip is the entire premise of S3j.
do $$
begin
  if (select visibility_policy from public.meetings
       where id = '00000000-0000-0000-0000-00000000f401') <> 'participants_only' then
    raise exception '342 fixture: the meeting did not become participants_only';
  end if;
end $$;

-- ADR 0125 D1: `scheduled` is not a lock point and no longer registers, so the
-- mints below would raise HC0DP. Walk to `in_signature` (the separating state:
-- registers, still stamped RASCUNHO) through the real transition graph, which
-- admits no jumps. ⛔ AFTER the attendee insert and the visibility flip:
-- app.guard_meeting_child_lock refuses meeting_attendees writes once the parent
-- is in_signature, and it reads no rpc flag.
select set_config('app.in_meeting_rpc', 'on', true);
update public.meetings set status = 'held'         where id = (select meet_p from mt);
update public.meetings set status = 'in_signature' where id = (select meet_p from mt);
select set_config('app.in_meeting_rpc', 'off', true);
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(pd2),
       jsonb_build_object('size', 4096, 'mimetype', 'application/pdf') from mt;

-- Expected coordinates, precomputed as the OWNER: the derivation authority is
-- app-scoped with EXECUTE granted to `postgres` only (D12), so an assertion
-- inside an authenticated block cannot call it.
create temp table xp on commit drop as
  select app.printed_rendition_storage_bucket(false) as std_bucket,
         app.printed_rendition_storage_path(pd1) as p1
  from r;
grant select on xp to authenticated;

-- ── 0. Preconditions, ASSERTED (authz-handoff §7.3: a reading is not a fact
--       until it is pinned to the state you are claiming about) ──────────────
select is(app.feature_enabled('document_printing'), true,
  'DM5·S3 P1 PRECONDITION: document_printing ON (seed forces it; the migration ships it OFF)');
select is(app.feature_enabled('documents_wave_d'), true,
  'DM5·S3 P2 PRECONDITION: documents_wave_d ON — the print corridor now asserts it too (D10)');
select is(app.feature_enabled('audit_trail'), true,
  'DM5·S3 P3 PRECONDITION: audit_trail ON — the audit assertions can observe writes');

-- =============================================================================
-- S3a — ADR 0120 D1: the TWO coupled CHECKs, FOUR cases.
-- A coupling keystone that exercises only the new type would pass while the
-- other shape became a hole, so all three live shapes are probed plus the
-- counterfactual.
-- =============================================================================
create temp table t on commit drop as
  select c.organization_id as org, c.hospital_id as hosp, c.id as comm
  from public.commissions c where c.id = (select comm_x from k);

select lives_ok(
  $$insert into public.securable_resources
      (id, resource_type, organization_id, hospital_id, commission_id)
    select gen_random_uuid(), 'form_response', org, hosp, comm from t$$,
  'DM5·S3a1 a FULLY TENANTED form_response registry row is ACCEPTED (shape A admits the new type)');

select throws_ok(
  $$insert into public.securable_resources
      (id, resource_type, organization_id, hospital_id, commission_id)
    select gen_random_uuid(), 'form_response', org, hosp, null from t$$,
  '23514', null,
  'DM5·S3a2 a COMMISSION-LESS form_response is REJECTED — shape A was not relaxed to admit the new type');

select throws_ok(
  $$insert into public.securable_resources
      (id, resource_type, organization_id, hospital_id, commission_id)
    select gen_random_uuid(), 'capa_action', org, null, null from t$$,
  '23514', null,
  'DM5·S3a3 a HOSPITAL-LESS capa_action is still REJECTED — D14''s shape B did not become a hole');

-- The counterfactual, and it is the one that proves the COUPLING rather than
-- merely the widening. With `type_check` neutralized, `tenant_shape` must
-- independently refuse an unknown type — otherwise "both CHECKs enumerate the
-- type" is a claim about text, not about behaviour. Same technique as 330 R2:
-- capture the real definition first so the restore cannot drift from it.
create temp table _saved_tc on commit drop as
  select pg_get_constraintdef(oid) as def
    from pg_constraint where conname = 'securable_resources_type_check';
alter table public.securable_resources drop constraint securable_resources_type_check;
select throws_ok(
  $$insert into public.securable_resources
      (id, resource_type, organization_id, hospital_id, commission_id)
    select gen_random_uuid(), 'not_a_real_type', org, hosp, comm from t$$,
  '23514', null,
  'DM5·S3a4 ⭐ with _type_check NEUTRALIZED, _tenant_shape independently refuses an unknown type (the coupling, not the text)');
do $$
declare d text;
begin
  select def into d from _saved_tc;
  execute format(
    'alter table public.securable_resources add constraint securable_resources_type_check %s', d);
end $$;
select is(
  (select count(*)::int from pg_constraint
    where conname in ('securable_resources_type_check', 'securable_resources_tenant_shape')
      and pg_get_constraintdef(oid) like '%form_response%'),
  2,
  'DM5·S3a5 [RESTORE CONTROL] both CHECKs are back and both still enumerate form_response');

-- =============================================================================
-- THE MINT — every later block reads this print. If the mint breaks, the whole
-- file must go red loudly rather than silently skip, so it is a lives_ok and the
-- rows it produced are asserted immediately.
-- =============================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select pd1 from r), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('cd', 32),
      (select tok1 from r), (select sc1 from r), false)$$,
  'DM5·S3m1 the mint succeeds onto the core substrate (the creator mints his own submitted response)');
reset role;

select is(
  (select p.status || '|' || (p.document_id is not null)::text
          || '|' || (p.document_version_id is not null)::text
     from public.printed_documents p where p.id = (select pd1 from r)),
  'active|true|true',
  'DM5·S3m2 D7: the registry row is the SATELLITE — active, and bound to both a document and a version');

select is(
  (select d.kind || '|' || s.resource_type || '|' || coalesce(d.confidentiality_level, 'NULL')
     from public.printed_documents p
     join public.documents d on d.id = p.document_id
     join public.securable_resources s on s.id = d.home_resource_id
    where p.id = (select pd1 from r)),
  'printed_rendition|form_response|NULL',
  'DM5·S3m3 D6/D13: the print has its OWN documents row, homed on the SOURCE''s securable resource, carrying no confidentiality label');

select is(
  (select f.storage_bucket || '|' || f.storage_path || '|' || f.sensitivity_tier
          || '|' || f.upload_state || '|' || f.disposal_state
          || '|' || (f.sha256 is not null)::text || '|' || f.mime_type
     from public.printed_documents p
     join public.document_version_files vf
       on vf.document_version_id = p.document_version_id
      and vf.rendition_kind = 'printed_pdf'
     join public.file_objects f on f.id = vf.file_object_id
    where p.id = (select pd1 from r)),
  (select std_bucket from xp) || '|' || (select p1 from xp)
    || '|standard|unscanned_accepted|none|true|application/pdf',
  'DM5·S3m4 D11: the bytes are the version''s printed_pdf rendition, walked through the REAL file_objects state machine, with SERVER-DERIVED mime');

select is(
  (select count(*)::int from public.document_version_files vf
    where vf.document_version_id = (select document_version_id from public.printed_documents
                                     where id = (select pd1 from r))
      and vf.rendition_kind = 'source'),
  0,
  'DM5·S3m5 the print version carries NO `source` rendition — the fact three separate consumers depend on');

select is(
  (select count(*)::int from public.audit_log
    where action = 'document.minted' and entity_id = (select pd1 from r)
      and metadata ? 'document_id' and metadata ? 'document_version_id'), 1,
  'DM5·S3m6 Rule 11: document.minted emitted exactly once, and carries the substrate linkage (identifiers, never content)');

-- =============================================================================
-- S3b — ADR 0120 D13: the SEPARATION itself, with each exclusion probed
-- INDEPENDENTLY.
--
-- ⚠ A keystone against `add_referral_shared_item` GOES GREEN ON ITS FIRST RUN for
-- reasons that have nothing to do with D13: that door carries TWO independent
-- guards, `s.resource_type = 'case'` AND `vf.rendition_kind = 'source'`, and a
-- print fails BOTH. Asserting "the door does not pick the print" would therefore
-- prove nothing about which lock did the work — the sibling-lock shape. So each
-- exclusion is asserted on its own, against the real fixture.
-- =============================================================================
select is(
  (select count(*)::int from public.document_versions dv
    where dv.document_id = (select document_id from public.printed_documents
                             where id = (select pd1 from r))),
  1,
  'DM5·S3b1 D13: the print''s document holds EXACTLY ONE version — so `version_number desc` on a CONTENT document can never reach it');

select is(
  (select count(*)::int from public.printed_documents p
     join public.documents d on d.id = p.document_id
     join public.securable_resources s on s.id = d.home_resource_id
    where p.id = (select pd1 from r) and s.resource_type = 'case'),
  0,
  'DM5·S3b2 EXCLUSION 1, alone: the print''s home is not a `case`, so add_referral_shared_item''s resource_type guard excludes it by itself');

select is(
  (select count(*)::int
     from public.document_version_files vf
     join public.file_objects f on f.id = vf.file_object_id
    where vf.document_version_id = (select document_version_id from public.printed_documents
                                     where id = (select pd1 from r))
      and vf.rendition_kind = 'source'
      and f.upload_state in ('clean', 'unscanned_accepted')),
  0,
  'DM5·S3b3 EXCLUSION 2, alone: the print version has no servable `source` binding, so the rendition guard excludes it EVEN IF the home guard were removed');

select ok(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'add_referral_shared_item'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'resource_type = ''case'''
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'rendition_kind = ''source''') = 1,
  'DM5·S3b4 both exclusions are STILL in the freeze door''s body — if either is removed the other still holds (b2/b3), but the pair is what the record claims');

-- =============================================================================
-- S3c — ADR 0120 D12, direction 1: PRINT CHECK PASSES, KERNEL FAILS.
-- Regression test for BUG-DM5-S3-INACTIVE-PRINT-1: `can_view_printed_document`
-- admits a DEACTIVATED account (its form_response arm opens with the bare column
-- comparison `v_resp.created_by = p_uid` behind an `or` — no callee can supply a
-- check that a disjunction bypasses), while `app.can_read_document` opens with
-- `app.is_active`. Latent, not live: document_printing ships OFF.
-- =============================================================================
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select st_x from k)), true,
  'DM5·S3c1 [CONTROL] the creator, ACTIVE, passes the print check — so the deny below is not vacuous');
select is(app.can_read_document(
            (select document_id from public.printed_documents where id = (select pd1 from r)),
            (select st_x from k)), true,
  'DM5·S3c2 [CONTROL] the same creator passes the KERNEL while active — both halves of the conjunction are open');

-- ⚠ `reset role` resets the ROLE, not `request.jwt.claims` — so auth.uid() is
-- still the previous persona here, and `guard_profile_privileged_columns`
-- refuses an is_active change from any non-admin session. Clearing the claims
-- puts us on the trusted service path (the guard's `auth.uid() is null` arm),
-- which is the house idiom (329 B5, 231 M5).
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select st_x from k);

select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select st_x from k)), true,
  'DM5·S3c3 ⛔ BUG-DM5-S3-INACTIVE-PRINT-1: DEACTIVATED, the print check STILL passes — the defect, pinned');
select is(app.can_read_document(
            (select document_id from public.printed_documents where id = (select pd1 from r)),
            (select st_x from k)), false,
  'DM5·S3c4 ⭐ but the KERNEL refuses the deactivated account — this is what the D12 conjunction adds');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
-- ⚠ MEASURED, NOT ASSUMED, AND THE SHAPE SURPRISED ME: this refusal RAISES
-- 42501, it does not return an empty set. The door's own two refusals (row
-- absent, print check failed) `return` with no row; the KERNEL half refuses
-- inside `app.resolve_document_version_bytes`, which raises so that
-- `open_document_version` keeps the SQLSTATE contract its existing suites
-- assert. So `open_printed_document` now has three refusal outcomes, not two.
-- ⭐ DELIBERATELY NOT SMOOTHED OVER by adding an `is_active` check to the door:
-- that would be a SECOND COPY of the same predicate, added for cosmetic
-- uniformity, which is the 'two locks that are really one lock' trap. The
-- serving route maps ANY error to 404 exactly as it maps an empty result, so
-- externally the outcomes are already indistinguishable — no oracle is opened,
-- and what the code says about its own state stays true.
select throws_ok(
  $$select * from public.open_printed_document((select pd1 from r))$$,
  '42501', null,
  'DM5·S3c5 ⭐ END TO END: the deactivated creator is REFUSED by the byte door (42501, from the kernel half) — the conjunction, not either half, is the authority');
reset role;
select is((select count(*)::int from public.audit_log
            where action = 'document.downloaded' and entity_id = (select pd1 from r)), 0,
  'DM5·S3c6 and the refusal mints NO audit row (the D11 floor: denials raise or return, never log)');

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select st_x from k);
select is(app.is_active((select st_x from k)), true,
  'DM5·S3c7 [RESTORE CONTROL] the persona is active again — later blocks measure the real state, not this block''s residue');

-- =============================================================================
-- S3i — ⭐ THE POSITIVE CONTROL FOR THE WHOLE SLICE: THE FEATURE STILL WORKS.
--
-- This is the assertion S2 did not have. S2 passed pgTAP, tsc, lint, vitest and
-- all four authz arms while the feature DID NOT WORK AT ALL, because not one of
-- those executes the corridor. S3 excludes prints from BOTH content
-- projections (D18) and re-signatures the byte door (D12) in the same slice —
-- precisely the shape where every static gate stays green and the feature is
-- dead. So: after all that, a print must still DOWNLOAD through its own door.
-- It also double-serves as S3c's restore control: if the reactivation above did
-- not take, this goes red.
-- =============================================================================
-- ⚠ GUARDED, AND THE REASON IS A MUTATION RESULT, NOT CAUTION.
-- Run with the M3 print arm neutralized, this call RAISES (the kernel refuses,
-- so the resolver raises P0002). As a bare `select is(...)` that error lands
-- OUTSIDE any pgTAP wrapper and ABORTS the file — observed: the neutralized run
-- died here and the 29 assertions after it never executed, so S3j's leak proof
-- was unreadable. That is the `329:494` pattern verbatim, which cost S2 a whole
-- review round by turning a clean FAIL into an ERROR nobody could interpret.
-- ⭐ It matters beyond this file: the diff-scoped door sweep NEUTRALIZES gates and
-- then asks whether the suite NOTICES. A suite that aborts instead of failing is
-- indistinguishable from a smaller suite, so this idiom (the 340-B7 shape) is
-- what lets 342 be usable as sweep coverage at all.
create temp table s3i (v text) on commit drop;
grant all on s3i to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
do $s3i$
begin
  insert into s3i
  select storage_bucket || '|' || storage_path || '|' || status || '|' || contains_phi::text
    from public.open_printed_document((select pd1 from r));
exception when others then
  insert into s3i values ('RAISED:' || sqlstate);
end $s3i$;
reset role;
select is(
  (select v from s3i),
  (select std_bucket from xp) || '|' || (select p1 from xp) || '|active|false',
  'DM5·S3i1 ⭐ THE FEATURE WORKS: the print still downloads through its own corridor, coordinates resolved by the SHARED resolver (bucket, path, status, contains_phi)');
select is((select count(*)::int from public.audit_log
            where action = 'document.downloaded' and entity_id = (select pd1 from r)), 1,
  'DM5·S3i2 Rule 11: the SUCCESSFUL serve mints exactly ONE document.downloaded row — and S3c6 proved the refusal minted none');

-- =============================================================================
-- S3d — ADR 0120 D12, direction 2: STRUCTURAL, because it is UNREACHABLE.
-- After migration …000320 the kernel's print arm DELEGATES to
-- `can_view_printed_document`, so "kernel passes but the print check fails" is
-- impossible by construction. No fixture is fabricated for an unreachable state;
-- the implication is pinned as the FACT that makes it unreachable.
-- =============================================================================
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
    ~ 'can_view_printed_document',
  'DM5·S3d1 the kernel''s print arm delegates to can_view_printed_document — so the kernel CONTAINS the print check and direction 2 cannot occur');
-- ⛔ CORRECTED AT QA r1 (MINOR-1). The first version asserted only
-- `position(is_active) < position(printed_documents)`. `position()` returns 0 when
-- the needle is ABSENT, and `0 < N` is TRUE — so deleting the `is_active` guard
-- entirely would have made this assertion PASS. A vacuous assertion guarding the
-- one ordering property the migration header calls binding. Both terms must be
-- PRESENT and then ordered.
select ok(
  (select position('is_active' in src) > 0
      and position('printed_documents' in src) > 0
      and position('is_active' in src) < position('printed_documents' in src)
     from (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_document') q),
  'DM5·S3d2 ⭐ both terms PRESENT and the print arm sits BELOW app.is_active — hoisting it above (or deleting the guard) would silently drop the account check and re-open S3c');

-- =============================================================================
-- S3e — ADR 0120 D18: the exclusion, and the TWIN that proves it would otherwise
-- be listed. Same row, two relations, opposite answers — nonzero on both sides.
-- ⚠ D18 IS PRESENTATION. These assertions must never be read as access control.
-- =============================================================================
select is(
  (select count(*)::int from public.documents d
    where d.id = (select document_id from public.printed_documents where id = (select pd1 from r))),
  1,
  'DM5·S3e1 [TWIN] the print''s documents row EXISTS and is homed where the panel looks — without the filter it WOULD be listed');
select is(
  (select count(*)::int from public.documents d
    where d.home_resource_id = (select resp_sub from r)
      and not exists (select 1 from public.printed_documents pd where pd.document_id = d.id)),
  0,
  'DM5·S3e2 the content projection''s anti-join excludes it — the discriminator is a NOT NULL + UNIQUE FK, never documents.kind');
select is(
  (select count(*)::int from pg_attribute a
    where a.attrelid = 'public.printed_documents'::regclass
      and a.attname = 'document_id' and a.attnotnull),
  1,
  'DM5·S3e3 the discriminator cannot be NULL by accident — document_id is NOT NULL (kind, by contrast, has no CHECK at all)');

-- =============================================================================
-- S3f — the write guards (migration …000350). Each with a CONTENT-document twin,
-- because a guard that also binds ordinary documents is a regression, not a fix.
-- =============================================================================
-- The content-document twin goes through the REAL corridor, as the entitled
-- staff_admin — so it also proves guard 4 did not break ordinary uploads.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cd on commit drop as
  select public.begin_document_upload('case', (select case_a from cs),
    'Documento de conteúdo 342', null, null, null, 'x.pdf', 'application/pdf', 100) as j;
reset role;

select throws_ok(
  format($$insert into public.document_versions (document_id, version_number, created_by)
           values (%L, 2, %L)$$,
         (select document_id from public.printed_documents where id = (select pd1 from r)),
         (select st_x from k)),
  'HC0DK', null,
  'DM5·S3f1 GUARD 1: a print''s document accepts NO second version — structural, at the table, so no writer can forget it');
select lives_ok(
  format($$insert into public.document_versions (document_id, version_number, created_by)
           values (%L, 99, %L)$$,
         (select (j->>'document_id')::uuid from cd), (select st_x from k)),
  'DM5·S3f1t [TWIN] a CONTENT document still accepts a new version — guard 1 does not bind ordinary documents');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$select public.soft_delete_document(%L)$$,
         (select document_id from public.printed_documents where id = (select pd1 from r))),
  'HC0DL', null,
  'DM5·S3f2 GUARD 2: a print cannot be soft-deleted — prints are REVOKED (else the registry says active while the bytes are gone)');
select throws_ok(
  format($$select public.request_document_disposition(%L, 'retention_expired')$$,
         (select document_id from public.printed_documents where id = (select pd1 from r))),
  'HC0DN', null,
  'DM5·S3f3 GUARD 3: the ACTIVE print''s bytes cannot be disposed — D11 retires SUPERSEDED bytes, and this is what makes that literal');
select throws_ok(
  $$select public.begin_document_upload('form_response', (select resp_sub from r), 'Upload proibido')$$,
  'P0002', null,
  'DM5·S3f4 GUARD 4 (both locks closed): form_response is a PRINT-ONLY home. ⚠ TWO INDEPENDENT LOCKS refuse here — guard 4 AND can_write_document''s fail-closed else, both with P0002 — so this assertion alone cannot attribute the refusal; S3k2 is the discriminating one. Do not simplify either away');
select is(
  (select can_delete from public.document_delete_affordances(
     array[(select document_id from public.printed_documents where id = (select pd1 from r))])),
  false,
  'DM5·S3f5 GUARD 5: the delete affordance does not promise what guard 2 refuses (server-computed, never derived UI-side)');
-- MINOR-3 (QA r1): guard 5 had no over-binding twin. A guard with no twin passes
-- while breaking ordinary documents — and this one is a projection the UI reads.
select is(
  (select can_delete from public.document_delete_affordances(
     array[(select (j->>'document_id')::uuid from cd)])),
  true,
  'DM5·S3f5t [TWIN] an ORDINARY document is still deletable by the same caller — guard 5 removed exactly prints and nothing else');
reset role;

-- GUARD 3's positive twin: once the print is no longer active, disposition is
-- ALLOWED. Without this the guard could be refusing unconditionally and S3f3
-- would look identical.
update public.printed_documents set status = 'superseded', superseded_at = now()
 where id = (select pd1 from r);
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.request_document_disposition(%L, 'retention_expired')$$,
         (select document_id from public.printed_documents where id = (select pd1 from r))),
  'DM5·S3f3t ⭐ [TWIN] a SUPERSEDED print''s bytes CAN be disposed — guard 3 is narrow, not a blanket refusal, so D11''s retirement path is reachable');
reset role;

-- =============================================================================
-- S3g — D12's PREMISE: the core door cannot serve a print, because it hardcodes
-- `source`. If this ever goes green-by-serving, D12's whole composition was
-- unnecessary and the parameterization ADR 0120 rejected happened anyway.
-- Asserted AFTER the disposal above, so the code is the disposal one; the
-- rendition-kind premise is pinned structurally beside it.
-- =============================================================================
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'resolve_document_version_bytes')
    ~ 'p_rendition_kind',
  'DM5·S3g1 the shared resolver is PARAMETERIZED by rendition kind — which is what lets one resolver serve both doors (D12)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'open_document_version'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ '''source'''),
  1,
  'DM5·S3g2 ...and the CORE door passes ''source'' and only ''source'' — so a print-only version stays unopenable through it (D12''s premise)');

-- =============================================================================
-- S3h — D12's SCOPE requirement, at the ACL and not merely at the schema.
-- `config.toml` exposes only `public`, but a configuration is not a boundary.
-- =============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        aclexplode(p.proacl) x
    where n.nspname = 'app' and p.proname = 'resolve_document_version_bytes'
      and x.privilege_type = 'EXECUTE'
      and x.grantee in (0, 'authenticated'::regrole, 'anon'::regrole)),
  0,
  'DM5·S3h1 the shared resolver is EXECUTE-able by neither PUBLIC nor anon nor authenticated — app-scoped AND acl-scoped');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        aclexplode(p.proacl) x
    where n.nspname = 'public' and p.proname = 'open_printed_document'
      and x.privilege_type = 'EXECUTE' and x.grantee = 0),
  0,
  'DM5·S3h2 ⭐ and open_printed_document holds NO PUBLIC grant — its DROP+CREATE re-applied Postgres''s default and this is the assertion that caught it');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) x
                       where x.privilege_type = 'EXECUTE'
                         and x.grantee in (0, 'anon'::regrole)))),
  0,
  'DM5·S3h3 POPULATION: ZERO first-party public SECURITY DEFINER functions are anon/PUBLIC-executable (a null proacl IS public-executable)');

-- =============================================================================
-- S3j — ⭐ THE §B PROOF, BEHAVIOURAL: the print arm NARROWS, and without it a
-- print's metadata would leak to a member the print door refuses. This is the
-- block whose green depends on the M3 arm EXISTING; every other assertion here
-- about that arm would survive its deletion.
-- =============================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select pd2 from mt), 'meeting', (select meet_p from mt),
      'meeting', 1, repeat('ef', 32),
      (select tok2 from mt), (select sc2 from mt), false)$$,
  'DM5·S3j1 an ATTENDEE mints the ata of a participants_only meeting (mint right = source visibility)');
reset role;
select set_config('request.jwt.claims', '', true);

select is(app.is_member_of_for((select comm_x from k), (select st_x2 from k)), true,
  'DM5·S3j2 [CONTROL] the non-attendee IS a member of the owning commission — so the WIDER home arm would grant, and the deny below is not vacuous');
select is(app.can_view_printed_document('meeting', (select meet_p from mt), (select st_x2 from k)), false,
  'DM5·S3j3 [CONTROL] ...and the PRINT door refuses him (not an attendee of a participants_only meeting) — the two predicates genuinely DISAGREE here');
select is(app.can_read_document(
            (select document_id from public.printed_documents where id = (select pd2 from mt)),
            (select st_x2 from k)), false,
  'DM5·S3j4 ⭐ THE KERNEL REFUSES HIM TOO: the print arm routes authority to the print predicate instead of the wider home arm, so D18 hides nothing that was ever reachable');
select is(app.can_read_document(
            (select document_id from public.printed_documents where id = (select pd2 from mt)),
            (select st_x from k)), true,
  'DM5·S3j5 [POSITIVE TWIN] the ATTENDEE still reads it — the arm narrows exactly ONE class and does not deny everyone (a narrowing that denies all passes its negative keystone by construction)');

-- =============================================================================
-- S3k — ⛔ QA r1 MAJOR-1: GUARD 4's KEYSTONE WAS VACUOUS. This block is the fix.
--
-- S3f4 asserts `begin_document_upload('form_response', …)` raises P0002. QA proved
-- by neutralization that with GUARD 4 DELETED the same call still raises the SAME
-- P0002 — from `can_write_document`'s fail-closed `else` (line 95), not from guard 4
-- (line 38). Two independent locks refuse, so the assertion could not fail on the
-- property it names. Behaviour was always correct; the KEYSTONE was the defect.
--
-- ⭐ [[a-door-can-have-two-locks]], and this is the prescription verbatim: OPEN EACH
-- LOCK INDEPENDENTLY AND TOGETHER, AND VERIFY THEY DIFFER. So the sibling is opened
-- here — `can_write_document` gains a permissive `form_response` arm inside this
-- transaction — and guard 4 must STILL refuse. Now only guard 4 can be the cause.
-- ⛔ NOT fixed by giving guard 4 its own SQLSTATE: P0002 is this door's deliberate
-- absence≡denial idiom, and changing a production error code to make a test
-- discriminate is the tail wagging the dog.
-- S3f4 above is KEPT as the both-closed case; its label now says two locks refuse,
-- so nobody 'simplifies' one away.
-- =============================================================================
create temp table _saved_cwd on commit drop as
  select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_write_document';
do $open$
declare d text;
begin
  select def into d from _saved_cwd;
  -- Insert a permissive form_response arm ABOVE the rca arm: the sibling lock is
  -- now OPEN for exactly this home type and nothing else.
  execute replace(d, 'when ''rca'' then',
                     'when ''form_response'' then return true;' || chr(10) || '    when ''rca'' then');
end $open$;
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_write_document')
    ~ 'when ''form_response'' then return true',
  'DM5·S3k1 [PRECONDITION] the SIBLING lock is genuinely OPEN — can_write_document now grants form_response, so a refusal below can only be guard 4');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.begin_document_upload('form_response', (select resp_sub from r), 'Upload proibido')$$,
  'P0002', null,
  'DM5·S3k2 ⭐ GUARD 4 REFUSES ON ITS OWN, with the sibling lock open — the discriminating assertion S3f4 could not make');
reset role;
select set_config('request.jwt.claims', '', true);
do $restore$
declare d text;
begin
  select def into d from _saved_cwd;
  execute d;
end $restore$;
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_write_document')
    !~ 'when ''form_response'' then return true',
  'DM5·S3k3 [RESTORE CONTROL] the sibling lock is closed again — later blocks and any sweep measure the real gate, not this block''s residue');

-- =============================================================================
-- S3l — QA r1 MINOR-2: `can_write_document`'s PRINT ARM had no keystone at all.
-- ⛔ This does NOT close FUP-DM5-330-WRITE-BLIND: door-level BLIND lifting is not
-- arm-level coverage, which is precisely why the lead re-scoped that follow-up to
-- the arm-level claim. This covers the PRINT arm only.
-- =============================================================================
select is(app.can_write_document(
            (select document_id from public.printed_documents where id = (select pd1 from r)),
            (select sa_x from k)), true,
  'DM5·S3l1 the print arm GRANTS the commission staff_admin — mirroring revoke_printed_document''s authority, which is what makes D11''s retirement path reachable at all');
select is(app.can_write_document(
            (select document_id from public.printed_documents where id = (select pd1 from r)),
            (select st_x from k)), false,
  'DM5·S3l2 ⭐ ...and REFUSES the print''s own creator — a print is not writable by whoever emitted it (revocation is a governance act, not undo)');
select is(app.can_write_document(
            (select document_id from public.printed_documents where id = (select pd2 from mt)),
            (select st_x2 from k)), false,
  'DM5·S3l3 [CROSS-ARM CONTROL] a plain commission member gets no write on a MEETING print either — the arm is the print''s commission admin chain, not its home-type arm');

-- =============================================================================
-- S3n — QA r1 MINOR-4: the mint's `unique_violation` handler must ATTRIBUTE.
-- Migration …000360 made it read `constraint_name` and re-raise anything that is
-- not one of the two credential uniques. Both directions are asserted, because a
-- handler that maps everything to HC0D4 and a handler that maps nothing to it are
-- indistinguishable from one assertion.
-- =============================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
-- Direction 1: a genuine CREDENTIAL collision (short code already minted) is still
-- HC0D4 — the code the server action loops on to re-mint with fresh credentials.
select throws_ok(
  $$select public.mint_printed_document(
      (select pd3 from r), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('cd', 32),
      (select tok3 from r), (select sc1 from r), false)$$,
  'HC0D4', null,
  'DM5·S3n1 a real CREDENTIAL collision still maps to HC0D4 — the action''s re-mint path stays alive');
-- Direction 2 — and getting here HONESTLY took two attempts, recorded because the
-- first one was vacuous in exactly the way MAJOR-1 was.
--
-- ⛔ THE VACUOUS VERSION: re-mint an already-minted id and assert 23505. MEASURED —
-- that collides on `file_objects_bucket_path_uniq`, which fires BEFORE the
-- printed_documents insert and therefore OUTSIDE the exception block. The error
-- never reaches the handler, so the assertion passed identically with the OLD broad
-- handler and proved nothing. (It also falsified this fix's first rationale: no
-- caller-reachable unique was ever MISreported, because none reached the handler.)
--
-- ⭐ SO THE LOCK THAT HIDES THE PATH IS OPENED — the same prescription as S3k: a
-- non-credential unique on `printed_documents` is unreachable at the handler today
-- (pkey is shadowed by the coordinate unique; document/version uniques take fresh
-- uuids; one_active is pre-empted by supersession). Dropping the coordinate unique
-- inside this transaction lets the SAME re-mint reach the printed_documents insert
-- and trip `printed_documents_pkey` — which the handler DOES see. With …000360 it
-- re-raises 23505; with the old broad handler it would have answered HC0D4.
create temp table _saved_fo on commit drop as
  select pg_get_constraintdef(oid) as def
    from pg_constraint where conname = 'file_objects_bucket_path_uniq';
reset role;
alter table public.file_objects drop constraint file_objects_bucket_path_uniq;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select pd1 from r), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('cd', 32),
      'S3TOKEN9AAAABBBBCCCCDDDDEEEEFFFFGGGG', 'VWXYZ23456', false)$$,
  '23505', null,
  'DM5·S3n2 ⭐ with the shadowing unique OPENED, a NON-credential violation (printed_documents_pkey) reaches the handler and keeps its OWN SQLSTATE — it is not absorbed as a credential collision');
reset role;
do $restore_fo$
declare d text;
begin
  select def into d from _saved_fo;
  execute format('alter table public.file_objects add constraint file_objects_bucket_path_uniq %s', d);
end $restore_fo$;
select ok(
  exists (select 1 from pg_constraint where conname = 'file_objects_bucket_path_uniq'),
  'DM5·S3n3 [RESTORE CONTROL] the coordinate unique is back — nothing after this block, and no sweep, measures a relaxed file_objects');

select * from finish();
rollback;

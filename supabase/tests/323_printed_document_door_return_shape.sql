-- =============================================================================
-- FUP-PDF-3 — the mint/revoke doors' RETURN SHAPE mirrors the granted column
-- list (QA P1 MINOR-2; ADR 0104). Both doors used to `returns
-- printed_documents` (the full row type), so a DIRECT PostgREST caller received
-- `verification_token` (the real widening) plus `storage_path` / `revoked_by` /
-- `revoked_reason` — the four columns deliberately excluded from the
-- authenticated column-list SELECT GRANT on `printed_documents`. Migration
-- 20260921000100 narrows both doors to `public.printed_document_public`, the
-- composite that mirrors that GRANT exactly, so the doors and the GRANT can
-- never diverge in the caller's favor.
--
-- ⭐ KEYSTONES (red-first, authz-handoff §7.1): t2–t5, t7–t8 were observed RED
-- against the pre-change catalog (returns=printed_documents; to_jsonb of the
-- result carried the withheld keys) before the migration landed.
--
-- t10–t13 are green-first PROPERTY-PRESERVATION CONTROLS, not keystones: the
-- fix is a DROP+CREATE (a return type cannot change under CREATE OR REPLACE),
-- which is exactly the shape that silently loses ACLs / SECURITY DEFINER /
-- search_path ("guards that read right but fail open"). They pin the
-- properties the rebuild must carry over, with the population pinned to
-- exactly 2 so a dropped-and-not-recreated door cannot pass vacuously.
-- =============================================================================

begin;
select plan(13);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- One submitted response by st_x (mint right = source visibility, D11).
create temp table r on commit drop as
  select '00000000-0000-0000-0000-00000000e301'::uuid as resp_sub,
         '00000000-0000-0000-0000-00000000e302'::uuid as doc1;
grant select on r to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select r.resp_sub, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from r, k;

-- Upload-before-mint (Amendment B): the object pre-exists at the derived path.
-- FORCED FIXTURE CHANGE (DM5·S3, migrations 20260927000310/000340): the
-- coordinate moved to the CHECK-constrained document buckets and `metadata`
-- became load-bearing (the mint derives size/mime from it). Path from the single
-- SQL derivation authority, so this cannot drift from the door.
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc1),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from r;

-- Door-result capture: ONE mint, ONE revoke — captured, then asserted on.
create temp table res_mint (j jsonb) on commit drop;
create temp table res_revoke (j jsonb) on commit drop;
grant all on res_mint, res_revoke to authenticated;

-- ── 0. Preconditions (asserted, never assumed — §7.3) ────────────────────────
select is(app.feature_enabled('document_printing'), true,
  't1 PRECONDITION: document_printing ON in this environment (seed forces it)');

-- ── 1. Return TYPE is the granted-column composite (structural pins) ─────────
select is(
  pg_get_function_result('public.mint_printed_document(uuid,text,uuid,text,integer,text,text,text,boolean)'::regprocedure),
  'printed_document_public',
  't2 ⭐ mint door RETURNS printed_document_public, not the full row type');
select is(
  pg_get_function_result('public.revoke_printed_document(uuid,text,text)'::regprocedure),
  'printed_document_public',
  't3 ⭐ revoke door RETURNS printed_document_public, not the full row type');

-- ── 2. Behavioural: the mint return carries no withheld column ───────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
insert into res_mint
select to_jsonb(public.mint_printed_document(
  (select doc1 from r), 'form_response', (select resp_sub from r),
  'form_response', 1, repeat('ab', 32),
  repeat('A', 40), 'ABCDEF2345', false));
reset role;

select is((select j ? 'verification_token' from res_mint), false,
  't4 ⭐ mint return carries NO verification_token (the real widening — a direct PostgREST caller must not receive the public-verification credential)');
-- ⭐ WIDENED, BECAUSE ONE MEMBER WENT DEAD (DM5·S3). `storage_path` is RETIRED
-- from `printed_documents` (ADR 0120 D7), so its presence here can no longer
-- fail — a name that cannot be found is not a test. It is KEPT (a future reader
-- must see it was considered) and the two NEW coordinate columns are added: they
-- are real table columns that the narrowed composite must continue to withhold.
select is((select j ?| array['storage_path', 'revoked_by', 'revoked_reason',
                             'document_id', 'document_version_id'] from res_mint), false,
  't5 ⭐ mint return carries none of the ungranted/withheld columns — incl. the two NEW coordinate columns (storage_path itself is now retired, so it is a dead name kept for the record)');
select is(
  (select (j->>'id') || '|' || (j->>'status') || '|' || (j->>'verification_short_code') from res_mint),
  (select doc1::text from r) || '|active|ABCDEF2345',
  't6 POSITIVE TWIN: the narrowed return still carries the summary surface the product reads (id, status, short code)');

-- ── 3. Behavioural: the revoke return carries no withheld column ─────────────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
insert into res_revoke
select to_jsonb(public.revoke_printed_document(
  (select doc1 from r), 'minted_in_error', 'Emitido por engano (fixture)'));
reset role;

select is((select j ? 'verification_token' from res_revoke), false,
  't7 ⭐ revoke return carries NO verification_token');
select is((select j ?| array['storage_path', 'revoked_by', 'revoked_reason',
                             'document_id', 'document_version_id'] from res_revoke), false,
  't8 ⭐ revoke return carries none of the ungranted/withheld columns, incl. the two NEW coordinate columns (the revoker supplied p_reason itself — no product information is lost)');
select is(
  (select (j->>'status') || '|' || (j->>'revoked_reason_class') || '|' || ((j->>'revoked_at') is not null)::text from res_revoke),
  'revoked|minted_in_error|true',
  't9 POSITIVE TWIN: the narrowed revoke return still carries status / reason class / revoked_at');

-- ── 4. Property-preservation controls (green-first; population pinned to 2) ──
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('mint_printed_document', 'revoke_printed_document')
     and has_function_privilege('authenticated', p.oid, 'execute')),
  2, 't10 CONTROL: authenticated keeps EXECUTE on both doors (the DROP+CREATE must re-grant)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('mint_printed_document', 'revoke_printed_document')
     and has_function_privilege('anon', p.oid, 'execute')),
  0, 't11 CONTROL: anon holds NO EXECUTE on either door (a rebuild must not fall back to the PUBLIC default ACL)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('mint_printed_document', 'revoke_printed_document')
     and p.prosecdef),
  2, 't12 CONTROL: both doors remain SECURITY DEFINER');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('mint_printed_document', 'revoke_printed_document')
     and array_to_string(p.proconfig, ';') like '%search_path=app, public, pg_catalog%'),
  2, 't13 CONTROL: both doors keep the pinned search_path=app, public, pg_catalog');

select * from finish();
rollback;

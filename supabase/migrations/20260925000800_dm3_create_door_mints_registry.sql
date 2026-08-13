-- =============================================================================
-- DM3 · M8 — the CREATE door mints what M1's FK requires.
--
-- ⚠ P0 IN DM3's OWN WORK, found by the mandatory fresh-reset gate step.
-- M1 added `controlled_documents_securable_resource_fk (id, securable_type) →
-- securable_resources(id, resource_type)` and BACKFILLED the existing rows —
-- but never taught the CREATE path to satisfy it. So since M1, EVERY attempt to
-- create a controlled document has failed with 23503: the product's create
-- wizard, not merely `seed.sql`. The failed seed was the symptom that surfaced
-- it, not the defect.
--
-- WHY NOTHING CAUGHT IT. Migrations were applied incrementally to a database
-- that ALREADY held the seeded documents, so the backfill made everything
-- downstream consistent and no suite exercised a fresh INSERT. A fresh reset
-- inverts that: migrations run against an empty DB (the backfill finds nothing
-- to do) and only then does anything insert a NEW controlled document, which
-- must satisfy the FK on its own. The backfill and the create path can each
-- look correct while the PAIR is broken — the recorded rule, earned again:
-- the migration chain and seed.sql are ONE artifact.
--
-- The class: adding a referential obligation is never done until every WRITER
-- has been taught it. A backfill covers the rows that exist; only the door
-- covers the rows that will.
--
-- WHAT A NEW CONTROLLED DOCUMENT OWES (enumerated from the catalog, not from
-- the error message — fixing only the constraint that fired is how you earn a
-- second failed reset):
--   1. a `securable_resources` row: own id, type `controlled_document`, and the
--      full org/hospital/commission triple (BOTH type CHECKs demand it)
--   2. `securable_type` — has a DEFAULT, so automatic
--   3. `core_document_id` → a core `documents` row homed on that registry row.
--      NOT optional: `beginControlledVersionUpload` resolves it and refuses when
--      null, so a document created without one could never receive a file.
--   4. a core `document_version` for the initial domain version — deliberately
--      NOT minted here; see the note below.
--
-- ⚠ THE INITIAL VERSION'S POINTER STAYS NULL, DELIBERATELY. M3's backfill gave
-- existing domain versions a FILELESS core version (lead ruling Q2, 1:1). A new
-- document does not get one: `begin_document_upload` mints the core version when
-- a file is actually uploaded, so minting one here would leave permanent litter
-- and — as `frontend` found by driving the real screens — a NON-NULL pointer on
-- a version that has no file, which reads to the UI as "an upload is in
-- progress" when none is. Null pointer is the truthful encoding of "no file
-- yet". This leaves backfilled rows and new rows asymmetric; that asymmetry and
-- its options are raised with the lead rather than settled here.
-- =============================================================================

create or replace function public.create_controlled_document(
  p_commission uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null,
  p_category text default null,
  p_tags text[] default '{}'::text[],
  p_description text default null)
 returns public.controlled_documents
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_doc public.controlled_documents;
  v_version public.controlled_document_versions;
  v_id uuid := gen_random_uuid();
  v_core_doc uuid;
  v_org uuid;
  v_hospital uuid;
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.is_staff_admin_of(p_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;

  select c.organization_id, c.hospital_id into v_org, v_hospital
    from public.commissions c where c.id = p_commission;
  if v_org is null then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;

  -- (1) The registry row FIRST — the composite FK below cannot validate without
  -- it, and the id is minted here so the shared-PK link is exact.
  insert into public.securable_resources
    (id, resource_type, organization_id, hospital_id, commission_id)
  values (v_id, 'controlled_document', v_org, v_hospital, p_commission);

  insert into public.controlled_documents
    (id, commission_id, title, doc_type, review_cycle_months, category, tags, description, created_by)
  values
    (v_id, p_commission, btrim(p_title), p_doc_type, p_review_cycle_months,
     nullif(btrim(coalesce(p_category, '')), ''),
     coalesce(p_tags, '{}'::text[]),
     nullif(btrim(coalesce(p_description, '')), ''),
     auth.uid())
  returning * into v_doc;

  -- (3) The core document, homed on the registry row. Its `kind` matches what
  -- the backfill used so the two populations are indistinguishable downstream.
  insert into public.documents
    (home_resource_id, title, kind, status, created_by)
  values (v_id, v_doc.title, 'documento_controlado', 'active', auth.uid())
  returning id into v_core_doc;

  update public.controlled_documents
  set core_document_id = v_core_doc
  where id = v_id
  returning * into v_doc;

  insert into public.controlled_document_versions (document_id, version_number, status, created_by)
  values (v_doc.id, 1, 'draft', auth.uid())
  returning * into v_version;

  update public.controlled_documents
  set current_version_id = v_version.id
  where id = v_doc.id
  returning * into v_doc;

  return v_doc;
end;
$function$;

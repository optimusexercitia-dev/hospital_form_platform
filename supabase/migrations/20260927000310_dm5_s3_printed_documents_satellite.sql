-- =============================================================================
-- DM5 S3 · M2 — `printed_documents` BECOMES the satellite (ADR 0120 D7 + D11)
--
-- D7: ADR 0114 D13 says verification tokens "stay in a satellite" — the
-- satellite never existed. `verification_token` / `verification_short_code`
-- are columns on `printed_documents` itself. So the row KEEPS tokens, status,
-- supersession and revocation, and EXCHANGES its own storage coordinate
-- (`storage_path` + the derived-path CHECK `pd_storage_path_derived`) for a
-- binding to the core rendition row. No new table is created.
--
-- D11: one `document_version` per print event, its bytes bound as that
-- version's `printed_pdf` rendition. `document_version_files` is NOT touched —
-- no liveness column, no partial unique, no guard exception, no DM1-invariant
-- amendment (ADR 0120's D3/D4/D5 withdrawal).
--
-- ⭐ WHY TWO COLUMNS AND A COMPOSITE FK, not one column.
--   `document_version_id` is the BYTE ANCHOR: it names the exact version whose
--   `printed_pdf` binding holds this print's bytes, with no ordering involved.
--   That matters because D13 exists precisely to keep prints away from
--   `order by version_number desc` semantics.
--   `document_id` is the D18 DISCRIMINATOR: "a print is a `documents` row
--   referenced by `printed_documents`" — a relational fact the content
--   projections anti-join on. It cannot be typo'd, cannot be NULL by accident
--   and cannot drift, which `documents.kind` (unchecked text) can.
--   Carrying both invites them to DISAGREE, so they structurally cannot: the
--   composite FK `(document_version_id, document_id) -> document_versions
--   (id, document_id)` makes disagreement unrepresentable. That is the same
--   typed-composite-FK idiom `securable_resources_id_type_uniq` already uses.
--
-- ⛔ THIS MIGRATION REQUIRES A RESET ON ANY DATA-BEARING DATABASE, BY DESIGN.
-- The two new columns are NOT NULL with no default, so on a `printed_documents`
-- table that already holds rows this migration fails `23502`. That is the
-- INTENDED loud failure under ADR 0120 D17: DM5 designs for a reset remote and
-- adds no convenience backfill, because a backfill is what masked DM3's P0. Do
-- not pre-empt it with a nullable interim — a nullable byte anchor is a print
-- that points at nothing.
-- Locally this is a no-op: `select count(*) from public.printed_documents` = 0
-- on a fresh reset (the seed inserts none — measured, and contrary to ADR 0120
-- D17.1's text, which named the seed as a source of print rows).
--
-- ⭐ THE DERIVED-PATH PIN IS REPLACED, NOT RETIRED. `pd_storage_path_derived`
-- was the only thing keeping the TS-side upload path and the SQL-side expected
-- path from drifting. Two mechanisms replace it, and neither is "a test":
--   1. `app.guard_printed_document_binding()` below — a BEFORE INSERT trigger
--      asserting the bound file object's (bucket, path) EQUALS the derivation
--      from (id, contains_phi). Same strength as the retired CHECK, on the
--      production path, without referencing the retired column.
--   2. The mint door's `HC0D3` existence check is a RUNTIME EQUALITY between
--      the two derivations: `p_id` is a fresh TS-minted uuid uploaded with
--      `upsert: false` BEFORE the RPC, so nothing but that upload can occupy
--      the derived coordinate — therefore HC0D3 fires IFF the TS path differs
--      from the SQL path. Not two green tests; one equality in production.
-- `app.printed_rendition_storage_path` / `_storage_bucket` exist so that
-- SQL has exactly ONE derivation authority shared by the trigger and the door.
--
-- ⭐ THE TIER MOVES FROM A PATH PREFIX INTO THE BUCKET, and that is a
-- strengthening. Today the phi/std split is a `phi/` vs `std/` prefix inside
-- ONE bucket. Under `file_objects_bucket_check` a print's bytes must live in
-- `documents-standard` or `documents-phi`, and `file_objects_bucket_from_tier`
-- CHECK-pins bucket to tier. So the sensitivity split becomes a
-- constraint-enforced physical boundary instead of a naming convention, and
-- the derived path loses its only branch.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The single SQL derivation authority for a print's storage coordinates.
--    IMMUTABLE and total: no branch in the path at all (the tier is the
--    bucket), so there is nothing here for a caller to get subtly wrong.
-- -----------------------------------------------------------------------------
create or replace function app.printed_rendition_storage_path(p_id uuid)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select 'printed/' || p_id::text || '.pdf';
$$;

create or replace function app.printed_rendition_storage_bucket(p_contains_phi boolean)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case when coalesce(p_contains_phi, false)
              then 'documents-phi' else 'documents-standard' end;
$$;

-- Neither is a gate and neither is reachable by a client: both are called ONLY
-- from SECURITY DEFINER bodies, which execute as the owner. Postgres grants
-- EXECUTE to PUBLIC by default on new functions, so revoke it explicitly —
-- the `…000120` habit, applied at creation instead of retrofitted.
revoke all on function app.printed_rendition_storage_path(uuid) from public;
revoke all on function app.printed_rendition_storage_bucket(boolean) from public;

-- -----------------------------------------------------------------------------
-- 2. The composite-FK target. `document_versions` already has PK(id) and
--    UNIQUE(document_id, version_number); the composite FK needs (id,
--    document_id) to be provably unique, which it is — id alone is the PK.
-- -----------------------------------------------------------------------------
alter table public.document_versions
  add constraint document_versions_id_document_uniq unique (id, document_id);

-- -----------------------------------------------------------------------------
-- 3. The satellite's binding to the core rendition row.
-- -----------------------------------------------------------------------------
alter table public.printed_documents
  add column document_id uuid not null,
  add column document_version_id uuid not null;

alter table public.printed_documents
  -- One print event <-> one documents row <-> one document_version. The
  -- uniques are what let the D18 anti-join treat the relation as one-to-one
  -- and what stop a second print from claiming another print's bytes.
  add constraint printed_documents_document_uniq unique (document_id),
  add constraint printed_documents_document_version_uniq unique (document_version_id),
  add constraint printed_documents_document_fk
    foreign key (document_id) references public.documents (id) on delete restrict,
  -- Disagreement between the two columns is unrepresentable.
  add constraint printed_documents_version_document_fk
    foreign key (document_version_id, document_id)
    references public.document_versions (id, document_id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 4. The old coordinate goes. The CHECK must be dropped before the column it
--    references.
-- -----------------------------------------------------------------------------
alter table public.printed_documents drop constraint pd_storage_path_derived;
alter table public.printed_documents drop column storage_path;

-- -----------------------------------------------------------------------------
-- 5. COLUMN-LIST GRANTS. `printed_documents` grants SELECT per column, never
--    table-wide (`storage_path`, `verification_token`, `revoked_reason`,
--    `revoked_by` are withheld). A new column with no GRANT reads `42501` —
--    the `case_referral` trap. Both new columns are safe to expose: they are
--    internal coordinates whose targets are independently gated by
--    `app.can_read_document`, which M3 routes to the PRINT predicate for
--    exactly these rows.
-- -----------------------------------------------------------------------------
grant select (document_id, document_version_id)
  on public.printed_documents to authenticated;

-- -----------------------------------------------------------------------------
-- 6. The derived-coordinate pin, restored as a trigger.
--    Fires BEFORE INSERT, so the mint door must create the file object, the
--    version and the `printed_pdf` binding BEFORE the registry row — which is
--    also the order Amendment B requires ("a registry row never points at a
--    missing object").
-- -----------------------------------------------------------------------------
create or replace function app.guard_printed_document_binding()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_bucket text;
  v_path text;
begin
  select f.storage_bucket, f.storage_path
    into v_bucket, v_path
  from public.document_version_files vf
  join public.file_objects f on f.id = vf.file_object_id
  where vf.document_version_id = new.document_version_id
    and vf.rendition_kind = 'printed_pdf';

  if v_path is null then
    raise exception
      'emissão sem arquivo vinculado: a versão % não possui rendição printed_pdf',
      new.document_version_id using errcode = 'HC0DA';
  end if;

  -- The pin the retired `pd_storage_path_derived` CHECK used to carry.
  if v_bucket <> app.printed_rendition_storage_bucket(new.contains_phi)
     or v_path <> app.printed_rendition_storage_path(new.id) then
    raise exception
      'coordenadas do arquivo emitido divergem da derivação canônica'
      using errcode = 'HC0DA';
  end if;

  return new;
end;
$$;

revoke all on function app.guard_printed_document_binding() from public;

create trigger trg_guard_printed_document_binding
  before insert on public.printed_documents
  for each row execute function app.guard_printed_document_binding();

-- -----------------------------------------------------------------------------
-- 7. Self-verification, STRUCTURAL ONLY.
--    M1's first version tried to verify behaviour here and was falsified by a
--    reset: migrations run BEFORE `seed.sql`, so there is no tenancy, no
--    commission, no response and no meeting to build a print from at this
--    point. Behaviour lives in pgTAP 342.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_attribute
              where attrelid = 'public.printed_documents'::regclass
                and attname = 'storage_path' and not attisdropped) then
    raise exception 'DM5 S3 M2: printed_documents.storage_path survived';
  end if;
  if exists (select 1 from pg_constraint
              where conrelid = 'public.printed_documents'::regclass
                and conname = 'pd_storage_path_derived') then
    raise exception 'DM5 S3 M2: pd_storage_path_derived survived';
  end if;

  -- Both new columns must carry their own column-level SELECT grant, or reads
  -- answer 42501. Asserted through aclexplode, never a substring of the acl:
  -- an ACL is not a string (the `…000120` finding, both directions).
  if (select count(*) from pg_attribute a, aclexplode(a.attacl) x
       where a.attrelid = 'public.printed_documents'::regclass
         and a.attname in ('document_id', 'document_version_id')
         and x.privilege_type = 'SELECT'
         and x.grantee = 'authenticated'::regrole) <> 2 then
    raise exception 'DM5 S3 M2: a new printed_documents column lacks its authenticated SELECT grant';
  end if;

  -- The withheld set must NOT have grown a member by accident.
  if exists (select 1 from pg_attribute a, aclexplode(a.attacl) x
              where a.attrelid = 'public.printed_documents'::regclass
                and a.attname in ('verification_token', 'revoked_reason', 'revoked_by')
                and x.privilege_type = 'SELECT'
                and x.grantee = 'authenticated'::regrole) then
    raise exception 'DM5 S3 M2: a withheld printed_documents column became readable';
  end if;

  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.printed_documents'::regclass
                    and tgname = 'trg_guard_printed_document_binding'
                    and not tgisinternal) then
    raise exception 'DM5 S3 M2: the derived-coordinate pin trigger is missing';
  end if;

  -- PUBLIC must hold EXECUTE on none of the three new app functions.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                  aclexplode(p.proacl) x
              where n.nspname = 'app'
                and p.proname in ('printed_rendition_storage_path',
                                  'printed_rendition_storage_bucket',
                                  'guard_printed_document_binding')
                and x.grantee = 0 and x.privilege_type = 'EXECUTE') then
    raise exception 'DM5 S3 M2: PUBLIC holds EXECUTE on a new app function';
  end if;
end;
$$;

commit;

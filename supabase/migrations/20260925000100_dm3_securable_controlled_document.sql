-- =============================================================================
-- DM3 · M1 — registry admission: a controlled document becomes a SECURABLE
-- RESOURCE, so it can be the HOME of a core `documents` row.
--
-- ADR 0114 D4/D13 (Wave B); plan docs/plans/dm3-controlled-documents-plan.md §3.
--
-- ⚠ THREE barriers refuse a `controlled_document` home today. This migration
-- opens exactly TWO of them:
--   1. securable_resources_type_check      — the type enumeration      → opened here
--   2. securable_resources_tenant_shape    — an UNCONDITIONAL conjunction that
--      re-enumerates the same closed set                               → opened here
--   3. app.can_read_document's dispatch `else false`                   → M2, NOT here
--
-- The M1/M2 split is deliberate and is what makes DM3·A1 a genuine red: after
-- this migration a controlled-document-homed document is readable by NOBODY.
-- That intermediate state is FAIL-CLOSED, which is what licenses the split — we
-- would not split a migration whose intermediate state were a deliberately
-- defective gate (an absent door beats a broken one).
--
-- Barrier 2 is easy to miss: it is not a per-type implication but a flat
-- conjunction, so widening only the type enumeration leaves inserts refused.
-- Pinned by DM3·R2b (both definitions must name the type) and DM3·R2 (with
-- barrier 1 neutralized, barrier 2 still refuses).
-- =============================================================================

-- --- barrier 1: the type enumeration ----------------------------------------
alter table public.securable_resources
  drop constraint securable_resources_type_check;

alter table public.securable_resources
  add constraint securable_resources_type_check
  check (resource_type = any (array[
    'case'::text, 'meeting'::text, 'interview'::text, 'action_item'::text,
    'controlled_document'::text]));

-- --- barrier 2: the tenant shape --------------------------------------------
-- A controlled document is commission-scoped (controlled_documents.commission_id
-- is NOT NULL), so it takes the SAME full org/hospital/commission triple as the
-- four Wave-A types — no new shape arm is needed, only the enumeration.
alter table public.securable_resources
  drop constraint securable_resources_tenant_shape;

alter table public.securable_resources
  add constraint securable_resources_tenant_shape
  check (
    resource_type = any (array[
      'case'::text, 'meeting'::text, 'interview'::text, 'action_item'::text,
      'controlled_document'::text])
    and organization_id is not null
    and hospital_id is not null
    and commission_id is not null);

-- --- the shared-PK link, mirroring the cases/meetings/interviews/action_items
-- precedent EXACTLY (typed composite FK against (id, resource_type), so a row
-- cannot be re-pointed at a registry entry of a different type).
alter table public.controlled_documents
  add column securable_type text not null default 'controlled_document';

alter table public.controlled_documents
  add constraint controlled_documents_securable_type_check
  check (securable_type = 'controlled_document');

-- --- backfill BEFORE the FK, or the FK cannot validate ------------------------
-- Tenant triple is derived from the document's OWN commission (never a constant
-- and never inherited) — pinned by DM3·R1c, which asserts agreement row-by-row
-- rather than counting violations.
insert into public.securable_resources
  (id, resource_type, organization_id, hospital_id, commission_id)
select d.id, 'controlled_document', c.organization_id, c.hospital_id, c.id
  from public.controlled_documents d
  join public.commissions c on c.id = d.commission_id
 where not exists (
   select 1 from public.securable_resources s where s.id = d.id);

alter table public.controlled_documents
  add constraint controlled_documents_securable_resource_fk
  foreign key (id, securable_type)
  references public.securable_resources (id, resource_type);

comment on column public.controlled_documents.securable_type is
  'Shared-PK discriminator pinning this row to its securable_resources entry '
  '(ADR 0114 D4). Constant by CHECK; the composite FK is what makes the '
  'registry link type-safe.';

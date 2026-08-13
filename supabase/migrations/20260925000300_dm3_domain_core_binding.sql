-- =============================================================================
-- DM3 · M3 — the domain↔core seam, its 1:1 backfill, and the pointer FREEZE.
--
-- ADR 0114 D3/D10; ADR 0118 §10; plan §3 M3 + §4 (S2.8 disposition).
-- Lead rulings: Q2 (backfill 1:1) and Q3 (the domain-side pointer is outside
-- D10, CONDITIONAL on the freeze below — binding condition R2).
--
-- WHY A DOMAIN-SIDE POINTER AT ALL. Today `set_document_version_file` re-UPDATEs
-- `storage_path` so a coordinator can replace a wrong file on a draft. Under the
-- core model each `begin_document_upload` mints a NEW `document_version`, so the
-- naive port would re-bind the existing core version's file — precisely the
-- mutation S2.8 could not express (`document_version_files` carries
-- UNIQUE(document_version_id, rendition_kind) + an unconditional immutability
-- trigger, and D10 forbids the pointer update). Instead the mutable pointer
-- lives HERE, on the domain row; every core version and every file binding stays
-- append-only. Superseded core versions remain as honest history — the same cost
-- ADR 0118 §10 already accepted for reclassification.
--
-- ⚠ CORE vs DOMAIN version_number are deliberately NOT equal, and must not be
-- "reconciled" later: the core number counts FILE revisions, the domain number
-- is the published revision identity.
--
-- ⚠⚠ THE FREEZE, AND WHY IT DOES NOT READ THE GUC (R2).
-- `app.guard_controlled_document_status` ends with a freeze clause gated on
-- `not v_in_rpc`, where v_in_rpc := current_setting('app.in_controlled_docs_rpc')
-- = 'on'. EVERY controlled-docs RPC sets that GUC, so that clause guards only
-- direct table DML — and after M4 the RPC corridor is the ONLY writable path.
-- A pointer guard written in that sibling's image would be VACUOUS BY
-- CONSTRUCTION. `app.guard_controlled_core_binding` therefore ignores the GUC
-- entirely. Do NOT "restore consistency" with the sibling: DM3·P3 impersonates
-- the corridor and will go red, which is the point.
--
-- Distinct errcodes so a red is attributable to ONE barrier:
--   HC089  the DOOR's freeze re-check (M4, mirrors set_document_version_file)
--   HC0DB  THIS trigger's hard freeze
--   HC0DC  THIS trigger's cross-document binding refusal
-- =============================================================================

alter table public.controlled_documents
  add column core_document_id uuid
  references public.documents (id) on delete restrict;

alter table public.controlled_document_versions
  add column core_document_version_id uuid
  references public.document_versions (id) on delete restrict;

-- --- guard: never invent attribution -----------------------------------------
-- `controlled_documents.created_by` is NULLABLE, but `documents.created_by` is
-- NOT NULL. Rather than fabricate a creator or silently skip the row (both are
-- "inventing success"), refuse the migration and name the rows. Locally this is
-- a no-op (3 rows, all non-null); it exists for the data-bearing remote, which
-- is exactly where the plan says the production numbers start to matter.
do $$
declare n int;
begin
  select count(*) into n from public.controlled_documents where created_by is null;
  if n > 0 then
    raise exception
      'DM3 backfill: % controlled_documents row(s) have a NULL created_by and cannot be '
      'given a core documents row without inventing attribution — reconcile them first', n;
  end if;
end $$;

-- --- backfill: one core document per controlled document ---------------------
with new_docs as (
  insert into public.documents
    (home_resource_id, title, kind, status, created_by)
  select d.id, d.title, 'documento_controlado', 'active', d.created_by
    from public.controlled_documents d
   where d.core_document_id is null
  returning id, home_resource_id
)
update public.controlled_documents cd
   set core_document_id = nd.id
  from new_docs nd
 where cd.id = nd.home_resource_id;

-- --- backfill: one core version per domain version (1:1, lead ruling Q2) -----
-- Fileless BY DESIGN: zero controlled_document_versions rows carry a
-- storage_path in EITHER environment (local measured; production per the
-- 2026-08-11 audit, PROVISIONAL and un-re-measured), so there is nothing to
-- bind. A fileless core version is a REPRESENTABLE state — it is exactly what
-- begin_document_upload creates between begin and finalize — and
-- open_document_version answers HC0D8 'arquivo ainda não disponível' for it.
--
-- ⚠ THE BACKFILL NEEDS THE SIBLING GUARD'S BYPASS, and the reason is the R2
-- finding seen from the other side. `app.guard_controlled_document_status`
-- refuses a non-status UPDATE on a FROZEN version whenever
-- `app.in_controlled_docs_rpc` is off — and a MIGRATION is exactly that
-- context. All three seeded versions are effective/in_approval, so setting
-- their pointer trips HC089 (observed: this migration failed at this statement
-- on its first run). Using the guard's own sanctioned bypass here is
-- legitimate — a reviewed one-time migration is not application-path DML — and
-- `set local` confines it to this transaction.
--
-- Note the irony, deliberately recorded: the bypass this migration must use is
-- the same one the NEW trigger below refuses to inherit. That is not
-- inconsistency, it is the whole point — and it is independent evidence the
-- bypass is real and load-bearing, which is what DM3·P3b asserts.
set local app.in_controlled_docs_rpc = 'on';

with new_vers as (
  insert into public.document_versions
    (document_id, version_number, created_by)
  select cd.core_document_id, v.version_number, coalesce(v.created_by, cd.created_by)
    from public.controlled_document_versions v
    join public.controlled_documents cd on cd.id = v.document_id
   where v.core_document_version_id is null
  returning id, document_id, version_number
)
update public.controlled_document_versions v
   set core_document_version_id = nv.id
  from new_vers nv
  join public.controlled_documents cd2 on cd2.core_document_id = nv.document_id
 where v.document_id = cd2.id
   and v.version_number = nv.version_number;

set local app.in_controlled_docs_rpc = 'off';

-- --- the freeze trigger (created AFTER the backfill, which legitimately sets
-- the pointer on already-frozen versions) -------------------------------------
create or replace function app.guard_controlled_core_binding()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_status text;
begin
  -- Not our business unless the pointer itself is being set or moved.
  if tg_op = 'UPDATE'
     and new.core_document_version_id is not distinct from old.core_document_version_id then
    return new;
  end if;

  v_status := case when tg_op = 'INSERT' then new.status else old.status end;

  -- ⚠ NO `app.in_controlled_docs_rpc` CHECK HERE, DELIBERATELY. See the header:
  -- inheriting the sibling guard's bypass would make this freeze vacuous for
  -- every command in the corridor, which after M4 is every writer there is.
  if v_status not in ('draft', 'changes_requested') then
    raise exception
      'o arquivo de uma versão em aprovação, vigente ou obsoleta não pode ser alterado'
      using errcode = 'HC0DB';
  end if;

  -- The pointer must resolve to a core version of THIS controlled document's
  -- own core document — never another document's history.
  if new.core_document_version_id is not null
     and not exists (
       select 1
         from public.document_versions dv
         join public.controlled_documents cd on cd.core_document_id = dv.document_id
        where dv.id = new.core_document_version_id
          and cd.id = new.document_id) then
    raise exception
      'a versão de arquivo referenciada não pertence a este documento'
      using errcode = 'HC0DC';
  end if;

  return new;
end;
$function$;

revoke all on function app.guard_controlled_core_binding() from public;

create trigger guard_controlled_core_binding_trg
  before insert or update on public.controlled_document_versions
  for each row execute function app.guard_controlled_core_binding();

comment on column public.controlled_document_versions.core_document_version_id is
  'The DOMAIN-side pointer at the core document_versions row carrying this '
  'version''s file (ADR 0114 D3; lead ruling Q3 2026-08-13). Movable ONLY while '
  'the domain version is draft/changes_requested — enforced by '
  'app.guard_controlled_core_binding, which deliberately does NOT honour '
  'app.in_controlled_docs_rpc. The CORE binding (document_version_files) stays '
  'append-only and immutable; D10 governs that, not this column.';

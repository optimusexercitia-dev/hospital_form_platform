-- =============================================================================
-- DM3 · M10 — the core-binding freeze guard fires ONLY when a pointer is
-- actually involved.
--
-- ⚠ BUG IN M3's GUARD, found by the full pgTAP suite on a fresh reset.
-- `app.guard_controlled_core_binding` decided *whether to raise* from the row's
-- STATUS before checking whether the POINTER was being touched at all. On INSERT
-- it therefore refused any version born frozen — even with
-- `core_document_version_id` NULL, i.e. a row that has no file binding and is
-- not acquiring one. `279_accreditation_dispatch` inserts exactly that (six
-- effective/in_approval/obsolete versions, no pointers) and got HC0DB.
--
-- The invariant this guard exists to hold is narrow and unchanged: YOU CANNOT
-- CHANGE WHICH FILE A FROZEN VERSION POINTS AT. An insert with no pointer moves
-- no file, so it was never in scope. The over-reach also explains why the seed
-- had to walk draft → in_approval → effective to place its pointers; that dance
-- is still correct (it DOES set a pointer) and stays.
--
-- Scope is now explicit: guard when a pointer is PRESENT on INSERT, or CHANGES
-- on UPDATE. Everything else returns untouched.
--
-- ⚠ The GUC bypass is still deliberately NOT honoured — the sibling guard's
-- `app.in_controlled_docs_rpc` escape would make this vacuous for every command
-- in the corridor, which after M4 is every writer there is. pgTAP 330 DM3·P3
-- impersonates the corridor and requires the refusal to hold; DM3·P2 pins the
-- UPDATE arm. Both still pass against this narrower scope, which is the point:
-- narrowing removed an over-reach, not a protection.
-- =============================================================================

create or replace function app.guard_controlled_core_binding()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_status text;
begin
  -- Not our business unless the pointer itself is being set or moved. On INSERT
  -- that means a non-null pointer; on UPDATE, a value that actually changes.
  if tg_op = 'INSERT' then
    if new.core_document_version_id is null then
      return new;
    end if;
  elsif new.core_document_version_id is not distinct from old.core_document_version_id then
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
  if not exists (
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

-- =============================================================================
-- DM3 · M9 — the registry row is minted BY THE TABLE, not by each writer.
--
-- ⚠ THE BLAST RADIUS OF M1's FK WAS EVERY WRITER, AND I ENUMERATED ONLY TWO.
-- M8 taught `create_controlled_document`; the seed was fixed by hand. The full
-- pgTAP suite then found FOUR MORE writers that insert `controlled_documents`
-- directly and now raise 23503: `252_authz_p0_isolation`, `261_charters_rpcs`,
-- `279_accreditation_dispatch`, `314_qob_org_admin_content_wall`.
--
-- Patching six call sites would have "worked" and been wrong: a referential
-- obligation hand-mirrored at N sites drifts at the first site someone adds, and
-- the next writer is invisible until it runs. The recorded rule is the one that
-- applies — *a new door must inherit EVERY sibling arm* — and the only place
-- that holds for writers you have not met yet is the TABLE.
--
-- So the registry row is minted by a BEFORE INSERT trigger, exactly mirroring
-- the precedent already on this table (`mint_controlled_document_code_trg`,
-- which mints `code` the same way). Every writer — the door, the seed, every
-- pgTAP fixture, and anything added later — satisfies the composite FK by
-- construction. Derived from `commission_id`, which is NOT NULL, so the tenant
-- triple is always resolvable.
--
-- `on conflict do nothing`: `create_controlled_document` (M8) inserts the
-- registry row explicitly before its own INSERT, and the migration chain is
-- forward-only, so the two must coexist without fighting. The trigger is the
-- authority; the door's explicit insert is now belt-and-braces.
--
-- ⚠ This trigger mints the REGISTRY row only — NOT `core_document_id`. That
-- needs `documents.created_by` (NOT NULL) and there is no honest fallback when a
-- direct fixture insert supplies no creator; inventing attribution is the thing
-- M3's backfill guard already refuses to do. The door owns `core_document_id`,
-- and pgTAP 330 DM3·R3c pins it there.
-- =============================================================================

create or replace function app.mint_controlled_document_resource()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
  v_hospital uuid;
begin
  select c.organization_id, c.hospital_id into v_org, v_hospital
    from public.commissions c where c.id = new.commission_id;
  if v_org is null then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;

  insert into public.securable_resources
    (id, resource_type, organization_id, hospital_id, commission_id)
  values (new.id, 'controlled_document', v_org, v_hospital, new.commission_id)
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function app.mint_controlled_document_resource() from public;

-- Fires BEFORE the row lands, so the composite FK finds its parent.
create trigger mint_controlled_document_resource_trg
  before insert on public.controlled_documents
  for each row execute function app.mint_controlled_document_resource();

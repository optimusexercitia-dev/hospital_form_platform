-- =============================================================================
-- WS-3b · D2 — tenant-hierarchy composite FK + hospitals org-repoint guard
-- =============================================================================
-- Pre-pilot DB hardening. Detail: docs/plans/pre-pilot-db-hardening-program.md §1 WS-3;
--   docs/reviews/external-db-audit-2026-07-perf-datamodel-analysis.md §2 (D2);
--   docs/decisions/0054-tenant-composite-fk.md.
--
-- The gap: commissions carries TWO independent single-column FKs (hospital_id ->
-- hospitals, organization_id -> organizations), but nothing ties the commission's
-- stored organization_id to its hospital's ACTUAL organization. `UPDATE hospitals SET
-- organization_id = <other org>` succeeds and silently desyncs every child commission's
-- organization_id, every stamped audit_log.organization_id, and every org-scoped RLS
-- predicate — all still pointing at the OLD org. commissions.organization_id is
-- trigger-derived on the commissions side, but nothing guards the hospitals side.
--
-- Fix (same composite-FK shape as WS-3a C-5): an FK-referenceable UNIQUE(id,
-- organization_id) on hospitals + a composite FK commissions(hospital_id,
-- organization_id) -> hospitals(id, organization_id) (KEEP the existing single-column
-- FKs for their ON DELETE RESTRICT — the composite is NO ACTION and only adds the
-- cross-check) + a BEFORE UPDATE guard on hospitals that BLOCKS moving a POPULATED
-- hospital to another org with a clean pt-BR message (the composite FK's ON UPDATE NO
-- ACTION already blocks it opaquely; the trigger is purely the friendly message).
--
-- ✋ Skip profiles.home_* (descriptive columns, NOT an access boundary — analysis §D2).
-- Reset-OK (pre-launch): no back-compat data migration.
-- =============================================================================

-- 1 · FK-referenceable unique on hospitals (real CONSTRAINT, not a bare index; trivially
--     satisfied since id is the PK). Coexists with hospitals_org_slug_key.
alter table public.hospitals
  add constraint hospitals_id_org_uq unique (id, organization_id);

comment on constraint hospitals_id_org_uq on public.hospitals is
  'WS-3b D2: FK-referenceable superset unique so commissions can tie '
  '(hospital_id, organization_id) to the hospital''s ACTUAL org. Trivially satisfied '
  '(id is PK).';

-- 2 · Composite FK on commissions: the stored org must match the hospital''s org.
--     KEEP the existing single-column FKs (their ON DELETE RESTRICT stays); this adds
--     the cross-tenant consistency check (ON UPDATE/DELETE NO ACTION).
alter table public.commissions
  add constraint commissions_hospital_org_fkey
  foreign key (hospital_id, organization_id)
  references public.hospitals (id, organization_id);

comment on constraint commissions_hospital_org_fkey on public.commissions is
  'WS-3b D2: a commission''s stored organization_id must equal its hospital''s org — '
  'closes the silent tenant-hierarchy desync. Keeps the single-column FKs for ON DELETE '
  'RESTRICT; this composite is the cross-check.';

-- 3 · hospitals org-repoint guard: BLOCK moving a hospital that has child commissions to
--     another organization (HC082, clean pt-BR message). Moving an EMPTY hospital is
--     allowed. The composite FK already blocks the populated case (ON UPDATE NO ACTION
--     -> children would dangle) but with an opaque error; this trigger raises first with
--     a friendly message. Repointing IS the desync vector, so this is the clean door.
create or replace function app.guard_hospital_org_repoint() returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if new.organization_id is distinct from old.organization_id
     and exists (select 1 from public.commissions where hospital_id = old.id) then
    raise exception 'não é permitido mover um hospital com comissões para outra organização'
      using errcode = 'HC082';
  end if;
  return new;
end;
$$;
alter function app.guard_hospital_org_repoint() owner to postgres;
comment on function app.guard_hospital_org_repoint() is
  'WS-3b D2: blocks an org-repoint of a POPULATED hospital (HC082) — the tenant-desync '
  'vector. An empty hospital may still be moved. The composite FK backstops this.';

drop trigger if exists guard_hospital_org_repoint_trg on public.hospitals;
create trigger guard_hospital_org_repoint_trg
  before update on public.hospitals
  for each row execute function app.guard_hospital_org_repoint();

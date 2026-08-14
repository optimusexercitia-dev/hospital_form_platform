-- =============================================================================
-- DM4 M1 — case_referral joins the securable-resource registry (ADR 0119 D1;
-- executes ADR 0114 D4's "later waves add … referral").
--
-- Own migration because: it is the substrate every later DM4 step FKs into,
-- it carries the phase's only registry backfill + composite-FK pair, and its
-- keystones (340 A1–A4, F1) pin exactly this diff.
--
-- Registry anchors = the SOURCE commission's tenancy (matches every referral
-- audit row today). The generic app.ensure_securable_resource() reads
-- new.commission_id and cannot be attached (case_referral carries
-- source_commission_id) — hence the referral-specific ensure fn. The drop
-- trigger reuses the generic id-keyed app.drop_securable_resource
-- (catalog-verified: `delete … where id = old.id`, nothing else).
-- =============================================================================

-- 1. Widen both registry CHECKs with the new type.
alter table public.securable_resources
  drop constraint securable_resources_type_check;
alter table public.securable_resources
  add constraint securable_resources_type_check
  check (resource_type = any (array['case','meeting','interview','action_item',
                                    'controlled_document','case_referral']));
alter table public.securable_resources
  drop constraint securable_resources_tenant_shape;
alter table public.securable_resources
  add constraint securable_resources_tenant_shape
  check (resource_type = any (array['case','meeting','interview','action_item',
                                    'controlled_document','case_referral'])
         and organization_id is not null
         and hospital_id is not null
         and commission_id is not null);

-- 2. The constant satellite column (participants dialect, roles inverted —
--    ADR 0116 #2). DELIBERATELY NO client GRANT: nothing client-side reads a
--    constant discriminator, and pgTAP 326 t1 pins grant-set ≡ the
--    case_referral_public view — a column joins the client surface only with
--    its own grant AND view column, consciously. (A precautionary grant was
--    tried first and 326 t1 correctly refused it.)
alter table public.case_referral
  add column securable_type text not null default 'case_referral'
  constraint case_referral_securable_type_pin check (securable_type = 'case_referral');

-- 3. Registry population BY CONSTRUCTION (ADR 0116 #3; the DM3-P0 class —
--    "an FK backfilled while the create path was never taught" — cannot arise:
--    the BEFORE INSERT trigger IS the create path's teacher, for every writer
--    present and future). Targeted ON CONFLICT (id), deliberately.
create or replace function app.ensure_securable_resource_referral()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
  v_hospital uuid;
begin
  select c.organization_id, c.hospital_id into v_org, v_hospital
  from public.commissions c where c.id = new.source_commission_id;
  if v_org is null then
    raise exception 'securable_resources: comissão % inexistente', new.source_commission_id
      using errcode = 'foreign_key_violation';
  end if;
  insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
  values (new.id, 'case_referral', v_org, v_hospital, new.source_commission_id)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function app.ensure_securable_resource_referral() from public;

create trigger trg_ensure_securable_resource
  before insert on public.case_referral
  for each row execute function app.ensure_securable_resource_referral();
create trigger trg_drop_securable_resource
  after delete on public.case_referral
  for each row execute function app.drop_securable_resource();

-- 4. Backfill existing referrals (0 rows on a fresh reset — the trigger owns
--    every future row; on a data-bearing database this covers pre-DM4 rows).
insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
select r.id, 'case_referral', c.organization_id, c.hospital_id, r.source_commission_id
  from public.case_referral r
  join public.commissions c on c.id = r.source_commission_id
on conflict (id) do nothing;

-- 5. The composite pin, AFTER the backfill.
alter table public.case_referral
  add constraint case_referral_securable_resource_fk
  foreign key (id, securable_type) references public.securable_resources (id, resource_type);

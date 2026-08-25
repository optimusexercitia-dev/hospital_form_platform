-- ADR 0150 (amends ADR 0149) — the audit organization is DERIVED from the hospital, and
-- leg 5 of `audit_log_select` expresses the PLATFORM CHAIN exactly.
--
-- Two halves of one defect, with deliberately different reach:
--
--   WRITE side — `app.audit_write` now derives `organization_id` from `p_hospital` when the
--     caller supplied a hospital but no organization. FORWARD-ONLY. There is NO BACKFILL and
--     there cannot be: `v_org` is an input to `app.audit_canonical`, which feeds the sha256
--     `row_hash`, and rows chain on `prev_hash`. Rewriting `organization_id` on an existing
--     row would invalidate its hash and break the tamper-evident chain (Architecture Rule 11)
--     — the exact property `public.verify_audit_chain` exists to prove. Pre-existing NULL-org
--     ⛔ AND IT IS BARRED TWICE OVER, the first bar being the one that actually fires:
--     `app.guard_audit_immutable()` is a BEFORE DELETE OR UPDATE ... FOR EACH ROW trigger
--     whose entire body raises `HC042` unconditionally, so the UPDATE never lands and the
--     hash is never recomputed. The hash argument above is the SECOND, independent fact —
--     cite the guard first, or a reader concludes a backfill is merely inadvisable.
--     ⚠ A backfill `UPDATE ... where organization_id is null` reports SUCCESS on a clean DB
--     because it matches zero rows: a row trigger cannot fire on a row never touched.
--     hospital-tier rows therefore stay invisible to their org admin permanently.
--
--   READ side — leg 5 of `audit_log_select` gains `hospital_id IS NULL`. RETROACTIVE, because
--     a predicate change touches no data: it closes the platform_admin half for those same
--     pre-existing rows, which the write-side fix cannot reach. Leg 5 was broader than the
--     tier it names — `app.audit_write` and `public.verify_audit_chain` BOTH define the
--     platform chain as all three scope keys NULL, and leg 5 checked only two of them, so a
--     malformed hospital-tier row satisfied it and handed a platform_admin tenant CONTENT
--     (the noun rule — CLAUDE.md §1, ADR 0078 A35). This is a correction, not a new
--     restriction: a WELL-FORMED hospital-tier row never satisfied leg 5 anyway.
--
-- ⚠ The function below is re-emitted from the LIVE `pg_get_functiondef`, never from earlier
-- migration text — migrations in this repo rewrite function bodies at runtime, so a
-- create-or-replace built from stale text silently reverts intervening patches.
--
-- Proof: supabase/tests/373_audit_write_derives_org_from_hospital.sql (§1 write side,
-- §2 read consequence, §3 chain neutrality, §4 the platform-chain bound, §5 structure).

CREATE OR REPLACE FUNCTION app.audit_write(p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb DEFAULT '{}'::jsonb, p_organization uuid DEFAULT NULL::uuid, p_hospital uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_seq bigint;
  v_prev_hash text;
  v_occurred timestamptz := now();
  v_lock_key text;
  v_row_hash text;
  v_org uuid := p_organization;
  v_hospital uuid := p_hospital;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_acting_as text;
begin
  if not app.feature_enabled('audit_trail') then
    return;
  end if;

  if v_actor is not null then
    v_actor_is_admin := coalesce(app.is_admin(), false);
  end if;

  v_acting_as := app.active_role();
  if v_acting_as is not null then
    v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
  end if;

  -- Derive org + hospital from the commission when a commission was passed (the
  -- ~62 trg_audit_* callers do exactly this). A commission ALWAYS belongs to a
  -- hospital + org (post-reseed) -> the commission row is org-set + hospital-set +
  -- commission-set.
  if p_commission is not null then
    select organization_id, hospital_id into v_org, v_hospital
    from public.commissions where id = p_commission;
  end if;

  -- ⭐ ADR 0150 — DERIVE the organization from the HOSPITAL. Until now the hospital branch
  -- used `v_org := p_organization` verbatim: derivation existed for the commission (above)
  -- and nowhere else, so every hospital-tier caller had to remember to pass the org by
  -- hand. All but one did. `app.trg_audit_standard_ownerships` passes `p_hospital` at all
  -- three of its call sites and no organization, so its rows landed `organization_id NULL`
  -- — invisible to the org admin (ADR 0149's widened leg 4 keys on that column) and
  -- VISIBLE to a platform_admin (leg 5 admitted them, the worse half).
  --
  -- Fixed as a CLASS rather than at the trigger, so the next hospital-tier writer cannot
  -- reintroduce it. `coalesce` semantics deliberately: an explicitly-passed organization
  -- still wins, so this adds derivation and adds NO validation.
  --
  -- ⛔ CHAIN-NEUTRAL BY CONSTRUCTION, and it must stay that way. The precedence block
  -- below tests `v_hospital is not null` BEFORE `v_org is not null`, and the hospital
  -- chain's lookup keys on `hospital_id` + `commission_id is null` — never on
  -- `organization_id` — as does `public.verify_audit_chain`'s enumeration of that same
  -- chain. So a now-non-null `v_org` cannot move a row to another chain or perturb `seq`.
  -- Do not reorder the branches below without re-reading test 373 §3.
  if v_hospital is not null and v_org is null then
    v_org := app.org_of_hospital(v_hospital);
  end if;

  -- The CHAIN is identified by PRECEDENCE (matching verify_audit_chain):
  --   commission set -> commission chain (keyed on commission_id ALONE)
  --   hospital set    -> hospital chain   (hospital_id, commission NULL)
  --   org set         -> org chain        (organization_id, hospital + commission NULL)
  --   else            -> platform chain   (all NULL)
  if p_commission is not null then
    v_lock_key := 'audit:c:' || p_commission::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where commission_id = p_commission
    order by seq desc limit 1;
  elsif v_hospital is not null then
    v_lock_key := 'audit:h:' || v_hospital::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where hospital_id = v_hospital and commission_id is null
    order by seq desc limit 1;
  elsif v_org is not null then
    v_lock_key := 'audit:o:' || v_org::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id = v_org and hospital_id is null and commission_id is null
    order by seq desc limit 1;
  else
    v_lock_key := 'audit:p';
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id is null and hospital_id is null and commission_id is null
    order by seq desc limit 1;
  end if;

  v_seq := coalesce(v_seq, 0) + 1;

  v_row_hash := encode(
    extensions.digest(
      coalesce(v_prev_hash, '') || app.audit_canonical(
        v_seq, v_occurred, v_actor, v_actor_is_admin, p_commission,
        p_action, p_entity_type, p_entity_id, p_summary,
        v_metadata, v_org, v_hospital
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_log (
    occurred_at, organization_id, hospital_id, commission_id, actor_id, actor_is_admin,
    action, entity_type, entity_id, summary, metadata,
    seq, prev_hash, row_hash
  ) values (
    v_occurred, v_org, v_hospital, p_commission, v_actor, v_actor_is_admin,
    p_action, p_entity_type, p_entity_id, p_summary,
    v_metadata,
    v_seq, v_prev_hash, v_row_hash
  );
end;
$function$;


-- Leg 5 only. Legs 1-4 are re-stated verbatim because `alter policy ... using` replaces the
-- WHOLE expression — a leg lost in transcription would be invisible to any arm that never
-- exercises it (test 372 §6.7 exists for exactly that reason).
alter policy audit_log_select on public.audit_log
using (
  app.is_staff_admin_of(commission_id)
  or app.is_tenancy_admin_of(commission_id)
  or (commission_id is null and app.is_hospital_admin_of(hospital_id))
  or (commission_id is null and app.is_org_admin_of(organization_id))
  -- ⭐ ADR 0150: `hospital_id IS NULL` added. The platform chain is ALL THREE scope keys
  -- NULL. ADR 0149 D4 froze this leg as a deliberate non-decision on the grounds that its
  -- `organization_id IS NULL` bound WAS the noun rule; that reasoning was right about the
  -- bound and wrong that two keys expressed it. This amends it.
  or (organization_id is null and hospital_id is null and commission_id is null and app.is_admin())
);

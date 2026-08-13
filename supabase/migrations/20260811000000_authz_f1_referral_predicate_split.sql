-- ADR 0078 D7 / F1 (Stage F-min): split the conflated referral read authority into a
-- five-predicate authorization SEAM. This migration adds the four missing named
-- predicates; `app.can_read_referral_phi` is deliberately LEFT UNCHANGED (it keeps its
-- legitimate read arms, incl. the target analyst FOR READ — the defect is read⇒WRITE,
-- not read). See ADR 0078 defect ②, acceptance criterion 6.
--
-- Live-catalog re-emit (ADR 0078 A28): `can_read_referral_metadata` copies the envelope
-- body from the live `app.can_read_referral` (pg_get_functiondef @ DB HEAD), and
-- `can_read_referral` is redefined to delegate to the new canonical `_metadata` name so
-- EVERY existing `can_read_referral` caller (RLS + RPCs) is transparently routed to the
-- metadata predicate with no behaviour change.

-- 1) Canonical non-PHI envelope reader: subject / status / commissions / trajectory.
create or replace function app.can_read_referral_metadata(p_referral_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        -- PQS reads every referral at every status (ADR 0037 D6).
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        -- The SOURCE committee authors the draft and sees it on the case card.
        or app.is_member_of_for(r.source_commission_id, p_uid)
        -- The TARGET committee only once the referral has actually been SENT.
        or (r.status <> 'draft' and app.is_member_of_for(r.target_commission_id, p_uid))
      )
  );
$function$;

-- 2) Backward-compat alias: `can_read_referral` now delegates to `_metadata` (single
--    source of truth; transparently routes all existing callers to the metadata seam).
create or replace function app.can_read_referral(p_referral_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.can_read_referral_metadata(p_referral_id, p_uid);
$function$;

-- 3) Target reply authority (the target Committee Coordinator answers the consult).
create or replace function app.can_write_referral_response(p_referral_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.can_manage_referral_target(p_referral_id, p_uid);
$function$;

-- 4) Source-coordinator-ONLY authority to DISCLOSE (write) the PHI snapshot. Read never
--    implies write (ADR 0078 Context·2). NEVER a target-side reader/analyst.
create or replace function app.can_manage_referral_phi_disclosure(p_referral_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.can_manage_referral_source(p_referral_id, p_uid);
$function$;

-- 5) Source-coordinator authority to AMEND an existing PHI snapshot (distinct seam name;
--    for F-min it resolves to the same source-coordinator authority as disclosure).
create or replace function app.can_amend_referral_phi_snapshot(p_referral_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.can_manage_referral_source(p_referral_id, p_uid);
$function$;

-- ACLs: mirror the existing app-predicate convention (no PUBLIC execute).
revoke all on function app.can_read_referral_metadata(uuid, uuid) from public;
revoke all on function app.can_write_referral_response(uuid, uuid) from public;
revoke all on function app.can_manage_referral_phi_disclosure(uuid, uuid) from public;
revoke all on function app.can_amend_referral_phi_snapshot(uuid, uuid) from public;
grant execute on function app.can_read_referral_metadata(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_write_referral_response(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_manage_referral_phi_disclosure(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_amend_referral_phi_snapshot(uuid, uuid) to authenticated, service_role;

comment on function app.can_read_referral_metadata(uuid, uuid) is
  'ADR 0078 D7/F1: non-PHI referral envelope reader (subject/status/commissions/trajectory).';
comment on function app.can_read_referral(uuid, uuid) is
  'ADR 0078 D7/F1: backward-compat alias -> app.can_read_referral_metadata.';
comment on function app.can_write_referral_response(uuid, uuid) is
  'ADR 0078 D7/F1: target reply authority (target Committee Coordinator).';
comment on function app.can_manage_referral_phi_disclosure(uuid, uuid) is
  'ADR 0078 D7/F1: source-coordinator-ONLY PHI snapshot write/disclosure authority. Read never implies write; never a target-side reader/analyst.';
comment on function app.can_amend_referral_phi_snapshot(uuid, uuid) is
  'ADR 0078 D7/F1: source-coordinator amend authority for an existing PHI snapshot.';

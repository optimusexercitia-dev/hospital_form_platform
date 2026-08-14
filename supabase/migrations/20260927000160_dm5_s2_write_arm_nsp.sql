-- =============================================================================
-- DM5 S2 · M7 — BUG-DM5-S2-WRITE-ARM-1: app.can_write_document gains the
-- `rca` and `capa_action` arms.
--
-- ⛔ THE DEFECT M2 SHIPPED. 20260927000110 extended `app.can_read_document`
-- and NOTHING ELSE. `app.can_write_document` dispatches on six arms — case,
-- meeting, action_item, interview, controlled_document, case_referral — and
-- falls to `else return false` for the two types S2 introduced. So
-- `begin_document_upload` refused EVERY caller on an rca / capa_action home
-- with P0002. Fixing the TS stubs alone would not have made upload work.
--
-- ⭐ WHY IT WAS INVISIBLE. Every keystone, every instruction and every review
-- comment in S2 named `can_read_document`: custody-following, read-time
-- resolution, the meeting-arm trap. The READ side was measured exhaustively.
-- Nobody asked what the WRITE side dispatches on — and a read arm proven
-- correct says nothing about its write counterpart. The pair is not symmetric
-- and must be enumerated as two objects, not one.
--
-- ⭐ THE DISCRIMINATING MATRIX, measured BEFORE this file was written (custody
-- moved via the real transfer_event_custody RPC, all in a rolled-back txn):
--
--   persona              read_evt  write_rca  read_capa  write_capa
--   staff1.farm (…006)     true      FALSE      true       FALSE
--   nspcoord.a  (…0c1)     true      true       true       true
--   chefe.ccih  (…002)     true      true       true       FALSE
--
--   • staff1.farm is the READ-YES / WRITE-NO negative for BOTH arms — the
--     assertion a write arm needs and a read arm cannot provide.
--   • chefe.ccih writes RCA but NOT CAPA, which is the fixture that catches
--     the likeliest error here: copying the rca arm into the capa_action slot.
--     nspcoord.a and staff1.farm both PASS such a mistake; only this row fails
--     it. The two arms are independent and this proves it.
--
-- Rebuilt with CREATE OR REPLACE (signature unchanged ⇒ ACL preserved), the
-- body diffed against the captured original, and both ACL directions asserted
-- (lost-grant AND gained-PUBLIC, via aclexplode grantee = 0).
-- =============================================================================

begin;

CREATE OR REPLACE FUNCTION app.can_write_document(p_document_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id
    into v_resource, v_type, v_commission
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;
  case v_type
    when 'case' then
      if app.is_case_excluded(v_resource, p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      if app.is_case_excluded(app.case_of_action_item(v_resource), p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = v_resource and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = v_resource and a.user_id = p_uid
                       and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(v_resource, p_uid);
    -- DM3 Wave B: writing a controlled document's files mirrors the authority
    -- the retiring `set_document_version_file` enforced (app.is_staff_admin_of
    -- on the owning commission). The APPROVER arm is deliberately absent here —
    -- an approver reads the artifact he reviews; he does not replace its bytes.
    when 'controlled_document' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    -- DM4 Wave C (ADR 0119 D6): reply attachments are B-side only, while the
    -- referral still accepts them — the legacy add_referral_reply_attachment
    -- window, preserved exactly.
    when 'case_referral' then
      return app.can_manage_referral_target(v_resource, p_uid)
         and exists (select 1 from public.case_referral r
                      where r.id = v_resource
                        and r.status in ('accepted', 'in_review'));
    -- DM5 S2 M7: the WRITE counterparts. `can_write_rca` = PQS operator of the
    -- event's hospital OR a non-observer rca_member. `can_write_capa` takes the
    -- PLAN id, so the action resolves to its plan first — the same inlining
    -- can_read_document uses, and for the same reason: this resolves STRUCTURE,
    -- not authority, so it must not become a new DEFINER door that would have to
    -- join the census domain and the findings file (ADR 0079 Am. 7).
    when 'rca' then
      return app.can_write_rca(v_resource, p_uid);
    when 'capa_action' then
      return app.can_write_capa(
        (select ca.capa_id from public.capa_action ca where ca.id = v_resource), p_uid);
    else
      return false;
  end case;
end;
$function$;

do $$
declare v_secdef boolean; v_cfg text; v_acl text; v_raw aclitem[]; v_src text;
begin
  select p.prosecdef, array_to_string(p.proconfig,','), array_to_string(p.proacl,','),
         p.proacl, p.prosrc
    into v_secdef, v_cfg, v_acl, v_raw, v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'can_write_document';

  if not v_secdef then raise exception 'can_write_document lost SECURITY DEFINER'; end if;
  if v_cfg is distinct from 'search_path=app, public, pg_catalog' then
    raise exception 'can_write_document lost its search_path pin (got %)', v_cfg;
  end if;
  if not exists (select 1 from aclexplode(v_raw) a
                  where a.grantee = 'authenticated'::regrole::oid and a.privilege_type = 'EXECUTE') then
    raise exception 'can_write_document lost the authenticated EXECUTE grant (got %)', v_acl;
  end if;
  if exists (select 1 from aclexplode(v_raw) a where a.grantee = 0) then
    raise exception 'can_write_document gained a PUBLIC grant (got %)', v_acl;
  end if;
  if v_src !~ 'when ''rca'' then' or v_src !~ 'when ''capa_action'' then' then
    raise exception 'the rca / capa_action write arms are missing';
  end if;
  -- The likeliest error, pinned structurally: the capa arm must NOT call can_write_rca.
  if v_src ~ 'when ''capa_action'' then\s*\n\s*return app\.can_write_rca' then
    raise exception 'the capa_action arm calls can_write_rca (copied from the rca arm)';
  end if;
end $$;

commit;

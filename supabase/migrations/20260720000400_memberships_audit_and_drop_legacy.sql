-- ============================================================================
-- MEM-5 · Blanket audit trigger on public.memberships (unified membership.* verbs,
--   O-6 / lead D1 HARD-CUT — no legacy aliases), retire the three legacy triggers,
--   then DROP the three legacy tables LAST (create-then-cutover; every predicate +
--   read fn + door has already been repointed by MEM-2..4).
--
-- Verb family (D1, PO override): membership.granted / .role_changed / .revoked.
-- The three legacy families (organization_member.* / commission_member.* /
-- pqs_member.*) are RETIRED — no aliases. Audit carries role + scope + who only,
-- PHI-free (Rule 11). The chain tuple mirrors the retired triggers' precedence:
--   commission-scope → commission chain (audit_write derives org+hospital)
--   org-scope        → org chain
--   hospital-scope   → hospital chain (org + hospital resolved from the row)
--
-- Spec: docs/plans/memberships-collapse-s6-1.md §2.4. Binding: Rules 1/11.
-- ============================================================================

create or replace function app.trg_audit_memberships()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row      public.memberships;
  v_action   text;
  v_summary  text;
  v_meta     jsonb;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_action := 'membership.granted';
    v_summary := 'Função concedida (' || v_row.role || ')';
  elsif tg_op = 'DELETE' then
    v_row := old;
    v_action := 'membership.revoked';
    v_summary := 'Função revogada (' || v_row.role || ')';
  else  -- UPDATE — only a role change is a meaningful grant event (matches the
        -- retired triggers). A title_id-only update (assign_member_title) is NOT a
        -- role change → no audit row (display-only metadata, unaudited by design).
    if new.role is distinct from old.role then
      v_row := new;
      v_action := 'membership.role_changed';
      v_summary := 'Função alterada: ' || old.role || ' → ' || new.role;
    else
      return null;
    end if;
  end if;

  -- PHI-free metadata: role + scope ids + principal only (never a name/title/payload).
  v_meta := jsonb_build_object(
    'role', v_row.role,
    'user_id', v_row.principal_id,
    'organization_id', v_row.organization_id,
    'hospital_id', v_row.hospital_id,
    'commission_id', v_row.commission_id
  );

  if v_row.commission_id is not null then
    -- commission chain: pass p_commission; audit_write derives org + hospital.
    perform app.audit_write(v_action, 'membership', v_row.id, v_row.commission_id, v_summary, v_meta);
  else
    -- org / hospital chain: pass the explicit chain tuple (commission NULL). For an
    -- org-scope row hospital is NULL → org chain; for a hospital-scope row both set →
    -- hospital chain (matches audit_write's precedence).
    perform app.audit_write(v_action, 'membership', v_row.id, null, v_summary, v_meta,
                            v_row.organization_id, v_row.hospital_id);
  end if;

  return null;
end;
$$;

create trigger trg_audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function app.trg_audit_memberships();

-- ----------------------------------------------------------------------------
-- Retire the three legacy audit triggers + their functions. (The tables drop below
-- would cascade the triggers anyway; drop the functions explicitly since they are
-- not owned by the tables.)
-- ----------------------------------------------------------------------------
drop trigger if exists audit_commission_members_trg  on public.commission_members;
drop trigger if exists trg_audit_organization_members on public.organization_members;
drop trigger if exists trg_audit_pqs_members          on public.pqs_members;
drop function if exists app.trg_audit_commission_members();
drop function if exists app.trg_audit_organization_members();
drop function if exists app.trg_audit_pqs_members();

-- Retire the two legacy BEFORE guard functions (superseded by the memberships
-- guards in MEM-2). CASCADE drops their still-attached triggers on the legacy
-- tables (the tables themselves are dropped just below).
drop function if exists app.guard_member_title_commission() cascade;
drop function if exists app.guard_org_member_hospital_org() cascade;

-- ----------------------------------------------------------------------------
-- DROP the three legacy tables LAST. Every predicate, read fn, door, shim, and RLS
-- policy that referenced them has been repointed to public.memberships. CASCADE
-- clears their remaining policies/indexes/FK-back-references (none of substance
-- remain — the answer/case/meeting graph never FK'd these role tables).
-- ----------------------------------------------------------------------------
drop table if exists public.commission_members  cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.pqs_members          cascade;

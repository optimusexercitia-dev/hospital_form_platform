-- W1 / Package A (ADR 0094, decision 2) — one commission role per principal.
--
-- DEFECT CLOSED. `memberships_grant_uq` is UNIQUE (principal_id, role, organization_id,
-- hospital_id, commission_id) — it keys on ROLE, so (u, 'staff', C) and
-- (u, 'staff_admin', C) are two legal rows. The dual-role state is UI-reachable today:
-- `addStaff` upserts 'staff' and `assignStaffAdmin` upserts 'staff_admin', neither
-- looking for the other. The resulting principal is simultaneously staff and
-- staff_admin of one commission, which no predicate in the catalog expects.
--
-- ── T1.0, THE REPLACEMENT SEMANTIC (PO-approved 2026-08-04: "atomic replace") ──
--
-- Granting a commission role to a principal who already holds the OTHER commission
-- role in that commission REPLACES it, atomically.
--
-- ⚠ Implemented as an in-place UPDATE, NOT the plan's parenthetical "delete old +
-- insert new". The plan asked for delete+insert *"so the audit stream shows
-- `role_changed` semantics"* — but those two clauses contradict each other against the
-- live catalog: `app.trg_audit_memberships` emits `membership.role_changed` ONLY on its
-- UPDATE arm (`new.role is distinct from old.role`). A delete+insert fires the DELETE
-- and INSERT arms instead, emitting `membership.revoked` + `membership.granted` — two
-- events, neither of which is the semantic the plan named. The UPDATE path reaches the
-- arm the trigger already has, so the goal is met by writing less, not more.
--
-- The UPDATE also preserves, for free, what delete+insert would have destroyed:
--   * `id` — the membership's stable identity (audit rows reference it as entity_id);
--   * `title_id` — the per-commission title (ADR 0051) is an attribute of the
--     membership, not of the role, so a titled member promoted staff → staff_admin
--     keeps their title. An explicit p_title_id still wins.
-- `granted_by` / `granted_at` DO reset: a role change is a new grant, and
-- `getHospitalAdmins`-style queries render `granted_at` as "holds this role since".
--
-- ⚠ AUTHORITY OVER THE OUTGOING ROLE IS REQUIRED — this is not in the plan, and
-- without it the replacement semantic opens a hole the dual-role bug did not have.
-- grant_role's 'staff' arm admits a plain `is_staff_admin_of`. Before this migration,
-- a plain staff_admin calling grant_role(commission, C, 'staff', <a staff_admin>)
-- merely inserted a redundant second row. WITH naive replacement it would DEMOTE a
-- peer staff_admin — a destructive write by a principal the 'staff_admin' arm
-- deliberately excludes (the role-pin). So replacing a `staff_admin` row requires the
-- `staff_admin` arm's authority (is_admin OR is_commission_admin_of), checked below.
-- The role-pin therefore governs BOTH directions: a plain staff_admin can neither
-- create nor destroy a staff_admin.

-- ── Pre-flight: collapse any existing violator, deterministically ───────────────
--
-- Local + seed hold ZERO violators (verified against the live catalog before writing
-- this). A data-bearing remote may not, and a bare CREATE UNIQUE INDEX would fail
-- `db push` with a cryptic 23505 naming only an index (the backfill-guard-wrap
-- lesson: a data-dependent migration that passes on a 0-row local reset fails on the
-- remote). Resolve rather than abort — and resolve the only way that cannot lose
-- authority: keep the HIGHER-privilege row (staff_admin), drop the redundant staff
-- row. That is precisely the replacement semantic applied retroactively.
--
-- The DELETE fires `trg_audit_memberships`, so each collapse emits a
-- `membership.revoked` audit row (Rule 11) rather than vanishing silently.
do $$
declare
  v_collapsed integer;
begin
  with dupes as (
    select id,
           row_number() over (
             partition by principal_id, commission_id
             -- staff_admin sorts first => rank 1 => kept.
             order by case role when 'staff_admin' then 0 else 1 end, granted_at
           ) as rn
    from public.memberships
    where commission_id is not null
  )
  delete from public.memberships m
  using dupes d
  where m.id = d.id and d.rn > 1;

  get diagnostics v_collapsed = row_count;
  if v_collapsed > 0 then
    raise notice
      'W1 pre-flight: collapsed % duplicate commission membership row(s); the higher-privilege role was kept and each removal is audited as membership.revoked.',
      v_collapsed;
  end if;
end $$;

-- ── T1.1 — the invariant ───────────────────────────────────────────────────────
--
-- Partial, because org- and hospital-tier rows legitimately have commission_id NULL
-- and must stay unconstrained by this index (a principal may hold org_admin AND
-- nsp_org_admin of the same org — different tier, different rule).
create unique index memberships_one_commission_role_uq
  on public.memberships (principal_id, commission_id)
  where commission_id is not null;

comment on index public.memberships_one_commission_role_uq is
  'ADR 0094 W1/T1.1 — a principal holds at most ONE role per commission. memberships_grant_uq keys on role and therefore permits (staff + staff_admin) in one commission; this index forbids it. Replacement (not refusal) is the sanctioned resolution — see public.grant_role.';

-- ── T1.2 — grant_role's conflict arm ───────────────────────────────────────────
--
-- Body is byte-identical to the live catalog definition except for the clearly marked
-- T1.0 block. Signature, defaults, volatility, SECURITY DEFINER, search_path and
-- grants are unchanged (`create or replace` preserves the ACL; Rule 8 needs no regen).
create or replace function public.grant_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org      uuid;
  v_hospital uuid;
  v_existing_id   uuid;
  v_existing_role text;
begin
  -- Authority + scope-column resolution, dispatched on (scope_type, role). Each arm
  -- reuses the incumbent RPC's authority check verbatim (no widening).
  if p_scope_type = 'organization' and p_role in ('org_admin', 'nsp_org_admin') then
    -- assign_org_admin: is_admin() OR is_org_admin_of; assign_nsp_org_admin: is_org_admin_of.
    if p_role = 'org_admin' then
      if not (app.is_admin() or app.is_org_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else  -- nsp_org_admin
      if not app.is_org_admin_of(p_scope_id) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;
    v_org := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'hospital_admin' then
    -- assign_hospital_admin: is_org_admin_of(org_of_hospital).
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_org_admin_of(v_org) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'nsp_coordinator' then
    -- assign_nsp_coordinator: is_nsp_org_admin_of(org_of_hospital) ONLY (decision 3).
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_nsp_org_admin_of(v_org) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'pqs_member' then
    -- add_pqs_member: is_nsp_org_admin_of(org_of_hospital) OR is_nsp_coordinator_of.
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_nsp_org_admin_of(v_org) or app.is_nsp_coordinator_of(p_scope_id)) then
      raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
        using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    -- addStaff / commission_members write policies: staff_admin manages ONLY 'staff'
    -- rows; org/hospital admin (is_commission_admin_of) manages ALL roles. A staff_admin
    -- CANNOT grant staff_admin (the role-pin — staff self-escalation stays 42501, D3).
    if p_role = 'staff' then
      if not (app.is_admin() or app.is_staff_admin_of(p_scope_id) or app.is_commission_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else  -- staff_admin: is_admin OR commission-admin (NOT a plain staff_admin — no self-escalation).
          -- Mirrors commission_members_admin_all (is_admin() OR is_commission_admin_of).
      if not (app.is_admin() or app.is_commission_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;

  else
    raise exception 'combinação de escopo e função inválida' using errcode = 'HC0G0';
  end if;

  -- Self-grant denied on EVERY path (WS-1 helper, verbatim; stays 42501).
  perform app._deny_self_grant(p_user);

  -- title_id is legal only on the commission shape (defensive; CHECK also enforces).
  if p_title_id is not null and p_scope_type <> 'commission' then
    raise exception 'escopo da função inválido' using errcode = 'HC0G2';
  end if;

  -- ┌─ ADR 0094 W1/T1.0 — ATOMIC ROLE REPLACEMENT (commission tier only) ────────┐
  -- memberships_one_commission_role_uq guarantees at most one row here, so this
  -- lookup needs no ordering and cannot be ambiguous. Without this block the index
  -- would raise a raw, unhandled 23505 out of the door and out of every UI action
  -- that calls it.
  if p_scope_type = 'commission' then
    select id, role into v_existing_id, v_existing_role
    from public.memberships
    where principal_id = p_user and commission_id = p_scope_id;

    if found and v_existing_role is distinct from p_role then
      -- Authority over the OUTGOING role, not just the incoming one. Replacing a
      -- staff_admin row is a destructive act on a role the 'staff' arm above does not
      -- govern; requiring the staff_admin arm's authority keeps the role-pin
      -- symmetric (a plain staff_admin can neither create nor destroy a staff_admin).
      if v_existing_role = 'staff_admin'
         and not (app.is_admin() or app.is_commission_admin_of(p_scope_id)) then
        raise exception 'sem permissão para alterar a função de um administrador da comissão'
          using errcode = '42501';
      end if;

      update public.memberships
         set role       = p_role,
             title_id   = coalesce(p_title_id, title_id),
             granted_by = (select auth.uid()),
             granted_at = now()
       where id = v_existing_id;
      -- trg_audit_memberships emits membership.role_changed on this UPDATE.
      return;
    end if;
  end if;
  -- └───────────────────────────────────────────────────────────────────────────┘

  -- Shape-coherent insert. Map (scope_type, scope_id) to the right columns; the
  -- hospital tier also fills organization_id (v_org resolved above) for the audit
  -- chain + org rollups. on conflict do nothing → idempotent grant.
  insert into public.memberships (
    principal_id, organization_id, hospital_id, commission_id, role, title_id, granted_by
  ) values (
    p_user,
    case when p_scope_type = 'organization' then p_scope_id else v_org end,
    case when p_scope_type = 'hospital'     then p_scope_id else null  end,
    case when p_scope_type = 'commission'   then p_scope_id else null  end,
    p_role,
    case when p_scope_type = 'commission'   then p_title_id else null  end,
    (select auth.uid())
  )
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
  -- Audit row emitted by trg_audit_memberships (MEM-5).
end;
$function$;

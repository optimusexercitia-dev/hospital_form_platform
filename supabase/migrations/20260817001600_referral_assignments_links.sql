-- =============================================================================
-- Referrals v2 (RV2) · R4 — Responsibility & multi-linkage.
-- =============================================================================
-- Pre-pilot expansion of the shipped Phase-22 referral module (ADR 0037
-- Amendment 1 — the DEFERRED "responsibility & multi-linkage" increment;
-- plan docs/plans/referrals-v2-dialogue-governance.md §R4). Two ADDITIVE
-- governance tables — NOT a state-machine change:
--   * referral_assignments — WHO is responsible for a referral on either side
--     (reviewer + role + status + due). A committee coordinator assigns members
--     of THEIR side; the assignment is a task pointer only.
--   * referral_case_links — TYPED "related case" pointers on a referral (a
--     related / follow-up / escalated / duplicate case). The PRIMARY target link
--     stays case_referral.target_case_id (read by referral_target_analyst); THIS
--     table is ADDITIONAL and is a POINTER only.
-- Additive / forward-only (reset-OK; no live referral data). Behind the existing
-- `case_referrals` flag. Rules 1/2/9/10/11/12.
--
-- 🔒 ISOLATION INVARIANT (the R4 keystone, ADR 0037 D-R4 gate + ADR 0078
-- assignment≠access discipline):
--   * An assignment row grants NO read of the referral. `can_read_referral_metadata`
--     / `can_read_referral_phi` do NOT (and must NOT) consult referral_assignments —
--     responsibility never widens access (K-R4-1).
--   * A referral_case_link row grants NO read of the linked case. It appears in NO
--     referral read predicate and NO case read predicate — `can_read_case`,
--     `referral_target_analyst`, and every case predicate ignore it (K-R4-2). It is
--     a pure pointer; access to the linked case is governed independently.
--
-- ⚠ PHI POSTURE (Rule 12): every column on BOTH tables is PHI-FREE governance
-- metadata (roles, statuses, timestamps, user/commission/case ids). No PHI column
-- → standard grants (SELECT to authenticated at the table level; NO column REVOKE
-- dance). dispose_referral_phi therefore needs no change (nothing to purge here).
--
-- SQLSTATE (ADR 0037 Amendment 1 reserves the HC0A0–HC0A9 block; R4 takes A7/A8):
--   HC0A7 = assignment domain error (invalid commission for this referral, invalid
--           assignment role, or assignee is not a member of the commission);
--   HC0A8 = case-link domain error (invalid relationship type, missing case, or a
--           duplicate (referral, case, relationship) link).
-- Authority failures raise 42501, checked FIRST — a wrong actor on a domain-valid
-- request yields 42501, never HC0A7/HC0A8 (ADR 0078 non-vacuity discipline: the
-- authority SQLSTATE is distinct from the domain SQLSTATE and asserted before any
-- domain check).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. referral_assignments — WHO is responsible on a referral's source OR target
--    side. commission_id must equal the referral's source OR target commission
--    (enforced in the RPC — a CHECK cannot subquery case_referral). Writes go
--    through the DEFINER RPCs only (no authenticated write policy). PHI-free.
-- -----------------------------------------------------------------------------
create table public.referral_assignments (
  id               uuid primary key default gen_random_uuid(),
  referral_id      uuid not null references public.case_referral(id) on delete cascade,
  commission_id    uuid not null references public.commissions(id) on delete cascade,
  assignee_user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role  text not null,
  status           text not null default 'pending',
  due_at           timestamptz,
  assigned_by      uuid references public.profiles(id) on delete set null,
  assigned_at      timestamptz not null default now(),
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  constraint referral_assignments_role_check check (assignment_role = any (array[
    'referral_coordinator', 'primary_reviewer', 'secondary_reviewer',
    'clinical_reviewer', 'legal_reviewer', 'committee_chair'])),
  constraint referral_assignments_status_check check (status = any (array[
    'pending', 'accepted', 'in_progress', 'completed', 'cancelled']))
);
alter table public.referral_assignments owner to postgres;

-- The "my open tasks" access path: an assignee's active assignments.
create index referral_assignments_assignee_active
  on public.referral_assignments (assignee_user_id)
  where status in ('pending', 'accepted', 'in_progress');
-- Referral-scoped lookup (the detail door + management RPCs).
create index referral_assignments_referral_idx
  on public.referral_assignments (referral_id);

comment on table public.referral_assignments is
  'RV2 R4 (ADR 0037 D-R4): WHO is responsible for a referral on its source OR '
  'target side (reviewer + role + status + due). PHI-free. commission_id is one of '
  'the referral''s two committees (RPC-enforced). ASSIGNMENT ≠ ACCESS: a row here '
  'grants NO read of the referral — the referral read predicates do NOT consult this '
  'table (K-R4-1). Writes via the DEFINER RPCs only (assign/update/cancel).';

-- Standard grants: PHI-free, so authenticated may SELECT the whole row (RLS scopes
-- it). NO insert/update/delete to authenticated — the DEFINER RPCs (owner=postgres)
-- are the only writers, and there is deliberately no authenticated write policy. A
-- postgres-owned table grants authenticated nothing by default, so no REVOKE needed.
grant select on table public.referral_assignments to authenticated;
grant all on table public.referral_assignments to service_role;

alter table public.referral_assignments enable row level security;

-- SELECT: any metadata-tier reader of the referral (source/target member or QPS).
-- The row is PHI-free, so no tighter gate is warranted; it never widens referral
-- access (this policy READS access, it does not grant it).
create policy "referral_assignments_select_metadata" on public.referral_assignments
  for select to authenticated
  using (app.can_read_referral_metadata(referral_id, auth.uid()));
-- No authenticated INSERT/UPDATE/DELETE policy: writes only via the DEFINER RPCs.

-- -----------------------------------------------------------------------------
-- 2. referral_case_links — TYPED "related case" pointers on a referral. The
--    PRIMARY target link stays case_referral.target_case_id (read by
--    referral_target_analyst); THIS table is ADDITIONAL and is a POINTER ONLY —
--    it grants NO access to the linked case and appears in NO read predicate.
-- -----------------------------------------------------------------------------
create table public.referral_case_links (
  id                uuid primary key default gen_random_uuid(),
  referral_id       uuid not null references public.case_referral(id) on delete cascade,
  case_id           uuid not null references public.cases(id) on delete cascade,
  commission_id     uuid not null references public.commissions(id) on delete cascade,
  relationship_type text not null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint referral_case_links_relationship_check check (relationship_type = any (array[
    'related_case', 'follow_up_case', 'escalated_case', 'duplicate_case'])),
  constraint referral_case_links_unique unique (referral_id, case_id, relationship_type)
);
alter table public.referral_case_links owner to postgres;

create index referral_case_links_referral_idx
  on public.referral_case_links (referral_id);

comment on table public.referral_case_links is
  'RV2 R4 (ADR 0037 D-R4): TYPED "related case" pointers on a referral '
  '(related/follow_up/escalated/duplicate). A POINTER ONLY — it grants NO access to '
  'case_id and appears in NO referral OR case read predicate (can_read_case, '
  'referral_target_analyst, can_read_referral_* all ignore it; K-R4-2). The PRIMARY '
  'target link remains case_referral.target_case_id. Writes via the DEFINER RPCs '
  '(link/unlink) only. PHI-free.';

grant select on table public.referral_case_links to authenticated;
grant all on table public.referral_case_links to service_role;

alter table public.referral_case_links enable row level security;

-- SELECT: any metadata-tier reader of the referral. PHI-free pointer.
create policy "referral_case_links_select_metadata" on public.referral_case_links
  for select to authenticated
  using (app.can_read_referral_metadata(referral_id, auth.uid()));
-- No authenticated INSERT/UPDATE/DELETE policy: writes only via the DEFINER RPCs.

-- -----------------------------------------------------------------------------
-- 3. assign_referral_reviewer — a coordinator of p_commission_id's side assigns a
--    member of that commission to the referral. AUTHORITY FIRST (42501): the side
--    is resolved from p_commission_id, and the matching manage-predicate must hold.
--    A p_commission_id that is neither side is HC0A7 (invalid argument, not an
--    authority path). DOMAIN checks (role in set, assignee is a member) run AFTER
--    authority and raise HC0A7.
-- -----------------------------------------------------------------------------
create or replace function public.assign_referral_reviewer(
  p_referral_id uuid,
  p_commission_id uuid,
  p_assignee_user_id uuid,
  p_assignment_role text,
  p_due_at timestamptz default null
) returns public.referral_assignments
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_row public.referral_assignments;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (distinct SQLSTATE, before any domain check). Resolve the side
  -- from p_commission_id; a coordinator of THAT side may assign.
  if p_commission_id = v_ref.source_commission_id then
    if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de origem pode atribuir responsáveis'
        using errcode = '42501';
    end if;
  elsif p_commission_id = v_ref.target_commission_id then
    if not app.can_manage_referral_target(p_referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de destino pode atribuir responsáveis'
        using errcode = '42501';
    end if;
  else
    raise exception 'comissão inválida para este encaminhamento' using errcode = 'HC0A7';
  end if;

  -- DOMAIN validation (after authority).
  if p_assignment_role is null or p_assignment_role <> all (array[
       'referral_coordinator', 'primary_reviewer', 'secondary_reviewer',
       'clinical_reviewer', 'legal_reviewer', 'committee_chair']) then
    raise exception 'papel de atribuição inválido' using errcode = 'HC0A7';
  end if;
  if not app.is_member_of_for(p_commission_id, p_assignee_user_id) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC0A7';
  end if;

  insert into public.referral_assignments (
    referral_id, commission_id, assignee_user_id, assignment_role, status,
    due_at, assigned_by, assigned_at
  ) values (
    p_referral_id, p_commission_id, p_assignee_user_id, p_assignment_role, 'pending',
    p_due_at, auth.uid(), now()
  )
  returning * into v_row;

  perform app.audit_write(
    'referral_assignment.created', 'referral_assignment', v_row.id, p_commission_id,
    'Responsável atribuído ao encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('assignment_role', p_assignment_role,
                       'assignee_user_id', p_assignee_user_id));

  return v_row;
end;
$$;
alter function public.assign_referral_reviewer(uuid, uuid, uuid, text, timestamptz) owner to postgres;
revoke all on function public.assign_referral_reviewer(uuid, uuid, uuid, text, timestamptz) from public;
grant execute on function public.assign_referral_reviewer(uuid, uuid, uuid, text, timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. update_referral_assignment — the coordinator of the assignment's commission
--    side edits its status / due / role. AUTHORITY FIRST (42501); domain (new
--    status/role in set) → HC0A7. Sets completed_at on →completed, cancelled_at on
--    →cancelled.
-- -----------------------------------------------------------------------------
create or replace function public.update_referral_assignment(
  p_assignment_id uuid,
  p_status text default null,
  p_due_at timestamptz default null,
  p_assignment_role text default null
) returns public.referral_assignments
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_asg public.referral_assignments;
  v_ref public.case_referral;
  v_row public.referral_assignments;
begin
  perform app.assert_referrals_enabled();

  select * into v_asg from public.referral_assignments where id = p_assignment_id for update;
  if v_asg.id is null then
    raise exception 'atribuição não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_asg.referral_id;

  -- AUTHORITY FIRST — coordinator of the assignment's commission side.
  if v_asg.commission_id = v_ref.source_commission_id then
    if not app.can_manage_referral_source(v_asg.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de origem pode alterar esta atribuição'
        using errcode = '42501';
    end if;
  else
    if not app.can_manage_referral_target(v_asg.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de destino pode alterar esta atribuição'
        using errcode = '42501';
    end if;
  end if;

  -- DOMAIN validation (after authority).
  if p_status is not null and p_status <> all (array[
       'pending', 'accepted', 'in_progress', 'completed', 'cancelled']) then
    raise exception 'status de atribuição inválido' using errcode = 'HC0A7';
  end if;
  if p_assignment_role is not null and p_assignment_role <> all (array[
       'referral_coordinator', 'primary_reviewer', 'secondary_reviewer',
       'clinical_reviewer', 'legal_reviewer', 'committee_chair']) then
    raise exception 'papel de atribuição inválido' using errcode = 'HC0A7';
  end if;

  update public.referral_assignments
     set status          = coalesce(p_status, status),
         assignment_role = coalesce(p_assignment_role, assignment_role),
         due_at          = case when p_due_at is not null then p_due_at else due_at end,
         completed_at    = case when p_status = 'completed' then now() else completed_at end,
         cancelled_at    = case when p_status = 'cancelled' then now() else cancelled_at end
   where id = p_assignment_id
   returning * into v_row;

  perform app.audit_write(
    'referral_assignment.updated', 'referral_assignment', v_row.id, v_asg.commission_id,
    'Atribuição do encaminhamento ' || coalesce(v_ref.code, '') || ' atualizada',
    jsonb_build_object('status', v_row.status, 'assignment_role', v_row.assignment_role));

  return v_row;
end;
$$;
alter function public.update_referral_assignment(uuid, text, timestamptz, text) owner to postgres;
revoke all on function public.update_referral_assignment(uuid, text, timestamptz, text) from public;
grant execute on function public.update_referral_assignment(uuid, text, timestamptz, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. cancel_referral_assignment — coordinator of the assignment's side cancels it
--    (status='cancelled', cancelled_at=now()). AUTHORITY FIRST (42501).
-- -----------------------------------------------------------------------------
create or replace function public.cancel_referral_assignment(
  p_assignment_id uuid
) returns public.referral_assignments
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_asg public.referral_assignments;
  v_ref public.case_referral;
  v_row public.referral_assignments;
begin
  perform app.assert_referrals_enabled();

  select * into v_asg from public.referral_assignments where id = p_assignment_id for update;
  if v_asg.id is null then
    raise exception 'atribuição não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_asg.referral_id;

  if v_asg.commission_id = v_ref.source_commission_id then
    if not app.can_manage_referral_source(v_asg.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de origem pode cancelar esta atribuição'
        using errcode = '42501';
    end if;
  else
    if not app.can_manage_referral_target(v_asg.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de destino pode cancelar esta atribuição'
        using errcode = '42501';
    end if;
  end if;

  update public.referral_assignments
     set status = 'cancelled', cancelled_at = now()
   where id = p_assignment_id
   returning * into v_row;

  perform app.audit_write(
    'referral_assignment.cancelled', 'referral_assignment', v_row.id, v_asg.commission_id,
    'Atribuição do encaminhamento ' || coalesce(v_ref.code, '') || ' cancelada',
    '{}'::jsonb);

  return v_row;
end;
$$;
alter function public.cancel_referral_assignment(uuid) owner to postgres;
revoke all on function public.cancel_referral_assignment(uuid) from public;
grant execute on function public.cancel_referral_assignment(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. link_referral_related_case — a coordinator of EITHER side records a TYPED
--    "related case" pointer. AUTHORITY (42501): source OR target coordinator.
--    commission_id = the acting coordinator's side. DOMAIN (relationship in set,
--    case exists, duplicate) → HC0A8. Grants NO access to p_case_id — a pointer.
-- -----------------------------------------------------------------------------
create or replace function public.link_referral_related_case(
  p_referral_id uuid,
  p_case_id uuid,
  p_relationship_type text
) returns public.referral_case_links
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_is_source boolean;
  v_is_target boolean;
  v_commission uuid;
  v_row public.referral_case_links;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST — coordinator of EITHER side may link.
  v_is_source := app.can_manage_referral_source(p_referral_id, auth.uid());
  v_is_target := app.can_manage_referral_target(p_referral_id, auth.uid());
  if not (v_is_source or v_is_target) then
    raise exception 'apenas a coordenação de origem ou destino pode vincular casos relacionados'
      using errcode = '42501';
  end if;
  -- The link is attributed to the acting coordinator's side (source preferred).
  v_commission := case when v_is_source then v_ref.source_commission_id
                       else v_ref.target_commission_id end;

  -- DOMAIN validation (after authority).
  if p_relationship_type is null or p_relationship_type <> all (array[
       'related_case', 'follow_up_case', 'escalated_case', 'duplicate_case']) then
    raise exception 'tipo de relação inválido' using errcode = 'HC0A8';
  end if;
  if not exists (select 1 from public.cases where id = p_case_id) then
    raise exception 'caso relacionado não encontrado' using errcode = 'HC0A8';
  end if;
  if exists (select 1 from public.referral_case_links
             where referral_id = p_referral_id and case_id = p_case_id
               and relationship_type = p_relationship_type) then
    raise exception 'este caso já está vinculado com esta relação' using errcode = 'HC0A8';
  end if;

  insert into public.referral_case_links (
    referral_id, case_id, commission_id, relationship_type, created_by
  ) values (
    p_referral_id, p_case_id, v_commission, p_relationship_type, auth.uid()
  )
  returning * into v_row;

  perform app.audit_write(
    'referral_case_link.created', 'referral_case_link', v_row.id, v_commission,
    'Caso relacionado vinculado ao encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('relationship_type', p_relationship_type, 'case_id', p_case_id));

  return v_row;
end;
$$;
alter function public.link_referral_related_case(uuid, uuid, text) owner to postgres;
revoke all on function public.link_referral_related_case(uuid, uuid, text) from public;
grant execute on function public.link_referral_related_case(uuid, uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. unlink_referral_case — a coordinator of the link's commission side removes a
--    typed related-case pointer. AUTHORITY FIRST (42501). Distinct from the
--    existing link_referral_case (the PRIMARY target link) — do NOT confuse them.
-- -----------------------------------------------------------------------------
create or replace function public.unlink_referral_case(
  p_link_id uuid
) returns void
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_link public.referral_case_links;
  v_ref public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_link from public.referral_case_links where id = p_link_id for update;
  if v_link.id is null then
    raise exception 'vínculo não encontrado' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_link.referral_id;

  if v_link.commission_id = v_ref.source_commission_id then
    if not app.can_manage_referral_source(v_link.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de origem pode remover este vínculo'
        using errcode = '42501';
    end if;
  else
    if not app.can_manage_referral_target(v_link.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de destino pode remover este vínculo'
        using errcode = '42501';
    end if;
  end if;

  delete from public.referral_case_links where id = p_link_id;

  perform app.audit_write(
    'referral_case_link.deleted', 'referral_case_link', v_link.id, v_link.commission_id,
    'Vínculo de caso removido do encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('relationship_type', v_link.relationship_type, 'case_id', v_link.case_id));
end;
$$;
alter function public.unlink_referral_case(uuid) owner to postgres;
revoke all on function public.unlink_referral_case(uuid) from public;
grant execute on function public.unlink_referral_case(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. list_my_referral_assignments — the CALLER's assignments joined to referral
--    NON-PHI metadata (task pointers ONLY, never PHI). DEFINER + auth.uid()-scoped,
--    so it is inherently self-scoped (another user's assignments never appear).
-- -----------------------------------------------------------------------------
create or replace function public.list_my_referral_assignments()
    returns jsonb
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform app.assert_referrals_enabled();

  select coalesce(jsonb_agg(row_json order by ord_due, assigned_at desc), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
             'id', a.id,
             'referral_id', a.referral_id,
             'commission_id', a.commission_id,
             'assignment_role', a.assignment_role,
             'status', a.status,
             'due_at', a.due_at,
             'assigned_by', a.assigned_by,
             'assigned_at', a.assigned_at,
             'completed_at', a.completed_at,
             'cancelled_at', a.cancelled_at,
             -- Referral NON-PHI metadata (task pointers only — NO PHI).
             'referral_code', r.code,
             'referral_subject', r.subject,
             'referral_status', r.status,
             'referral_priority', r.priority,
             'referral_response_due_at', r.response_due_at
           ) as row_json,
           -- NULL due dates sort last; then most-recently-assigned first.
           (a.due_at is null) as ord_due,
           a.due_at,
           a.assigned_at
    from public.referral_assignments a
    join public.case_referral r on r.id = a.referral_id
    where a.assignee_user_id = v_uid
  ) s;

  return v_result;
end;
$$;
alter function public.list_my_referral_assignments() owner to postgres;
revoke all on function public.list_my_referral_assignments() from public;
grant execute on function public.list_my_referral_assignments() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. get_referral_detail — AMEND: expose the PHI-free `assignments` + `links`
--    arrays to every metadata-tier reader (the door already gates
--    can_read_referral). LIVE R3 body reproduced verbatim; the ONLY additions are
--    the two arrays (placed right after `resolutions`). Both are PHI-free pointers
--    — NEITHER widens PHI: they carry no bodies and no identifiers.
-- -----------------------------------------------------------------------------
create or replace function public.get_referral_detail(p_referral_id uuid)
    returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_can_phi boolean;
  v_can_compose_target boolean;
  v_result jsonb;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());
  -- RV2 R1 fast-follow: compose authority = the EXACT R1 RPC gates (PHI-free).
  v_can_compose_target := app.is_staff_admin_of(v_referral.target_commission_id)
                          or app.referral_target_analyst(p_referral_id, auth.uid());

  if v_can_phi and not v_is_source_coord then
    perform public.log_audit_access(
      'referral.viewed', 'referral', p_referral_id, v_referral.source_commission_id,
      'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'id', v_referral.id,
    'code', v_referral.code,
    'status', v_referral.status,
    'subject', v_referral.subject,
    'description_md', case when v_can_phi then v_referral.description_md else null end,
    'referral_type_id', v_referral.referral_type_id,
    'type_label', v_referral.type_label,
    'response_expected', v_referral.response_expected,
    -- RV2 R2: PHI-FREE triage/SLA metadata (visible to every metadata-tier reader).
    'priority', v_referral.priority,
    'requested_action_id', v_referral.requested_action_id,
    'requested_action_label', v_referral.requested_action_label,
    'response_due_at', v_referral.response_due_at,
    'decline_reason_code', v_referral.decline_reason_code,
    -- RV2 R3: PHI-FREE lineage pointer (QPS chain view).
    'parent_referral_id', v_referral.parent_referral_id,
    'source_commission_id', v_referral.source_commission_id,
    'source_commission_name', (select name from public.commissions where id = v_referral.source_commission_id),
    'target_commission_id', v_referral.target_commission_id,
    'target_commission_name', (select name from public.commissions where id = v_referral.target_commission_id),
    'source_case_id', v_referral.source_case_id,
    'source_case_number', (select case_number from public.cases where id = v_referral.source_case_id),
    'target_case_id', v_referral.target_case_id,
    'target_case_number', (select case_number from public.cases where id = v_referral.target_case_id),
    'has_patient', v_referral.has_patient,
    'created_by', v_referral.created_by,
    'created_by_name', (select full_name from public.profiles where id = v_referral.created_by),
    -- PHI free-text decline note stays PHI-gated (distinct from decline_reason_code).
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
    'waiting_on_committee_id', v_referral.waiting_on_committee_id,
    'last_message_at', v_referral.last_message_at,
    -- RV2 R1 fast-follow: compose authority for THIS caller (PHI-free).
    'can_compose_as_source', v_is_source_coord,
    'can_compose_as_target', v_can_compose_target,
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', case when v_can_phi then s.frozen_body_md else null end,
        'frozen_storage_path', case when v_can_phi then s.frozen_storage_path else null end,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'referral_id', m.referral_id,
        'sequence_number', m.sequence_number,
        'sender_commission_id', m.sender_commission_id,
        'sender_commission_name', (select name from public.commissions where id = m.sender_commission_id),
        'sender_user_id', m.sender_user_id,
        'sender_user_name', (select full_name from public.profiles where id = m.sender_user_id),
        'message_type', m.message_type,
        'body', case when v_can_phi then m.body else null end,
        'created_at', m.created_at
      ) order by m.sequence_number)
      from public.referral_messages m where m.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R3: the resolution history. Non-PHI columns project to every metadata-tier
    -- reader; summary_md is served ONLY to a PHI reader (v_can_phi).
    'resolutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rr.id,
        'referral_id', rr.referral_id,
        'resolution_number', rr.resolution_number,
        'resolved_by_commission_id', rr.resolved_by_commission_id,
        'resolved_by_user_id', rr.resolved_by_user_id,
        'resolved_by_name', (select full_name from public.profiles where id = rr.resolved_by_user_id),
        'summary_md', case when v_can_phi then rr.summary_md else null end,
        'follow_up_required', rr.follow_up_required,
        'final_reply_id', rr.final_reply_id,
        'resolved_at', rr.resolved_at,
        'reopened_at', rr.reopened_at,
        'reopened_by', rr.reopened_by,
        'reopened_reason', rr.reopened_reason
      ) order by rr.resolution_number)
      from public.referral_resolutions rr where rr.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R4: WHO is responsible (PHI-free). Visible to every metadata-tier reader;
    -- an assignment row grants NO access (K-R4-1) — it is a task pointer only.
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'referral_id', a.referral_id,
        'commission_id', a.commission_id,
        'assignee_user_id', a.assignee_user_id,
        'assignee_name', (select full_name from public.profiles where id = a.assignee_user_id),
        'assignment_role', a.assignment_role,
        'status', a.status,
        'due_at', a.due_at,
        'assigned_by', a.assigned_by,
        'assigned_by_name', (select full_name from public.profiles where id = a.assigned_by),
        'assigned_at', a.assigned_at,
        'completed_at', a.completed_at,
        'cancelled_at', a.cancelled_at
      ) order by a.assigned_at)
      from public.referral_assignments a where a.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R4: TYPED related-case pointers (PHI-free). A pointer ONLY — it grants NO
    -- access to the linked case (K-R4-2).
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'referral_id', l.referral_id,
        'case_id', l.case_id,
        'case_number', (select case_number from public.cases where id = l.case_id),
        'commission_id', l.commission_id,
        'relationship_type', l.relationship_type,
        'created_by', l.created_by,
        'created_by_name', (select full_name from public.profiles where id = l.created_by),
        'created_at', l.created_at
      ) order by l.created_at)
      from public.referral_case_links l where l.referral_id = p_referral_id
    ), '[]'::jsonb),
    'reply', (
      select case when r.referral_id is null then null else jsonb_build_object(
        'referral_id', r.referral_id,
        'reply_outcome_id', r.reply_outcome_id,
        'outcome_label', r.outcome_label,
        'result_md', case when v_can_phi then r.result_md else null end,
        'acknowledged_only', r.acknowledged_only,
        'replied_by', r.replied_by,
        'replied_by_name', (select full_name from public.profiles where id = r.replied_by),
        'replied_at', r.replied_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'referral_id', a.referral_id, 'title', a.title,
            'storage_path', a.storage_path, 'mime_type', a.mime_type,
            'size_bytes', a.size_bytes, 'uploaded_by', a.uploaded_by,
            'uploaded_by_name', (select full_name from public.profiles where id = a.uploaded_by),
            'created_at', a.created_at
          ) order by a.created_at)
          from public.referral_reply_attachment a where a.referral_id = p_referral_id
        ), '[]'::jsonb)
      ) end
      from public.referral_reply r where r.referral_id = p_referral_id
    ),
    'sent_at', v_referral.sent_at,
    'received_at', v_referral.received_at,
    'decided_at', v_referral.decided_at,
    'concluded_at', v_referral.concluded_at,
    'withdrawn_at', v_referral.withdrawn_at,
    'created_at', v_referral.created_at,
    'updated_at', v_referral.updated_at
  ) into v_result;

  return v_result;
end;
$$;
alter function public.get_referral_detail(uuid) owner to postgres;
revoke all on function public.get_referral_detail(uuid) from public;
grant execute on function public.get_referral_detail(uuid) to authenticated, service_role;

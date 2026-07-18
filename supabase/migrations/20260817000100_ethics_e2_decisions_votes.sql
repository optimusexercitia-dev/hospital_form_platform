-- =============================================================================
-- ETH·E2 (ADR 0073 D3/D4) — BE-3: decisions + votes + sanction catalog +
--   cast_case_vote (the E1-consumption recusal/respondent vote-exclusion).
--
-- Scope (lead-approved ruling 6, 2026-07-18; window 20260817000100):
--   1. ethics_sanction_types  — org-scoped catalog (dialect-2), SELECT-only RLS
--        mirroring BE-2 / case_participant_roles; DEFINER CRUD lands in BE-6.
--   2. case_decisions          — ENGINE-LEVEL (M&M/credentialing reuse it).
--        decision_type is FREE TEXT pre-pilot (a catalog is a post-pilot refinement).
--   3. ethics_decision_details — 1:1 ethics extension, DENORMALIZED case_id (base-table
--        RLS, matching ethics_findings). sanction_type_id = NULLABLE FK (null = none).
--   4. case_votes              — ENGINE-LEVEL; ethics is the primary consumer.
--   5. app.eligible_voters(case) — R6-safe (base tables): members − recused − respondent.
--   6. cast_case_vote          — the DEFINER door. ⛔ NON-VACUITY-CRITICAL (M6/233 +
--        the no-regression-twin trap): AUTHORITY (member) is checked FIRST and raises a
--        SQLSTATE DISTINCT from HC0J5 (42501), so a non-member voter can NEVER be
--        mistaken for an excluded one; EXCLUSION (recused/respondent) then raises HC0J5.
--        A recused/respondent member is ALSO structurally denied the whole deliberation
--        by E1's can_read_case (belt-and-suspenders D4) — the RPC is the suspenders.
--
-- RLS (Rule 1): the three case-child tables carry ONE SELECT policy
-- app.can_read_case(case_id, auth.uid()) — verbatim E1 predicate, NO new shape;
-- WRITES are DEFINER-RPC-ONLY (cast_case_vote here; create_case_decision /
-- set_ethics_decision_details in BE-6). SELECT grant to authenticated (RLS narrows an
-- existing grant — F1 MAJOR-1). Catalog SELECT org-scoped (is_org_member OR is_admin —
-- precedent case_participant_roles); no direct write policy/grant (DEFINER CRUD, BE-6).
--
-- SQLSTATEs (ADR 0073 D11): HC0J0 (case is not ethics-typed / invalid state), HC0J4
-- (duplicate vote — unique(decision_id,voter_id)), HC0J5 (impedido — recused/respondent),
-- 42501 (non-member authority — DISTINCT from HC0J5 by design), HC000 (ethics flag OFF).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · ethics feature-flag assert (E2's whole procedure spine gates on it). HC000
--     'recurso indisponível' — the platform's feature-unavailable idiom (D12).
-- -----------------------------------------------------------------------------
create or replace function app.assert_ethics_enabled()
  returns void language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('ethics') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
end;
$$;
alter function app.assert_ethics_enabled() owner to postgres;

-- -----------------------------------------------------------------------------
-- 1 · ethics_sanction_types — org-scoped catalog (CEM vocabulary; seeded per org in
--     seed.sql). Mirrors the BE-2 catalog shape.
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_sanction_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  display_name text not null,                              -- pt-BR (Rule 10)
  is_active boolean not null default true,
  position int not null default 0,
  unique (organization_id, key)
);
comment on table public.ethics_sanction_types is
  'ADR 0073 D3 — org-scoped ethics sanction-type catalog (CEM vocabulary: advertência/'
  'censura/suspensão/cassação). SELECT org-scoped (mirrors case_participant_roles); '
  'writes DEFINER-CRUD-only (BE-6). ethics_decision_details.sanction_type_id FKs here '
  '(nullable — null = no sanction).';

alter table public.ethics_sanction_types enable row level security;

create policy ethics_sanction_types_select on public.ethics_sanction_types
  for select to authenticated
  using (app.is_org_member(organization_id) or app.is_admin());

grant select on public.ethics_sanction_types to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · case_decisions — ENGINE-LEVEL. decision_type is free text pre-pilot.
-- -----------------------------------------------------------------------------
create table if not exists public.case_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_type text not null,                             -- free text (engine-level; no catalog pre-pilot)
  summary_md text not null,                                -- sanitized Markdown (Rule 7)
  rationale_md text,                                       -- sanitized Markdown (Rule 7)
  status text not null default 'draft'
    check (status in ('draft', 'proposed', 'voted', 'issued', 'appealed', 'voided')),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.case_decisions is
  'ADR 0073 D3 — ENGINE-LEVEL case decision (M&M/credentialing reuse it; only E2 writes '
  'it pre-pilot). SELECT gated by can_read_case; writes DEFINER-RPC-only (create_case_'
  'decision / issue_decision — BE-6). The BE-5 retention-pin trigger fires on status→issued.';

create index case_decisions_case_idx
  on public.case_decisions (case_id);

alter table public.case_decisions enable row level security;

create policy case_decisions_select on public.case_decisions
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

grant select on public.case_decisions to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · ethics_decision_details — 1:1 ethics extension. case_id DENORMALIZED (base-table
--     RLS, matching ethics_findings). Coherence (case_id = the parent decision's case_id)
--     is enforced by the BE-6 set_ethics_decision_details RPC, not a cross-table CHECK.
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_decision_details (
  decision_id uuid primary key references public.case_decisions(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,   -- denormalized for base-table RLS
  sanction_type_id uuid references public.ethics_sanction_types(id),      -- nullable = no sanction
  sanction_start_date date,
  sanction_end_date date,
  remediation_required boolean not null default false,
  remediation_description_md text,                         -- sanitized Markdown (Rule 7)
  external_reporting_required boolean not null default false,
  external_reporting_target text
    check (external_reporting_target in ('crm', 'cfm', 'legal_department', 'police', 'other')),
  external_reporting_referral_id uuid references public.case_referral(id),   -- ADR-0037 hand-off (§D7)
  external_reporting_deadline timestamptz,
  external_reporting_completed_at timestamptz,
  appeal_allowed boolean not null default true,
  appeal_deadline timestamptz,
  -- F2 attachment; rides the ordinary case-confidentiality gate pre-pilot (the
  -- legal_privileged clearance ceiling defers to Stage E — 0078 A19/B3).
  decision_letter_document_id uuid references public.attachments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_decision_details is
  'ADR 0073 D3 — the 1:1 ethics extension of a case_decisions row (sanction + CRM/CFM '
  'hand-off + appeal deadline). case_id is DENORMALIZED for a base-table can_read_case '
  'SELECT (no join to case_decisions). Writes DEFINER-RPC-only (set_ethics_decision_'
  'details — BE-6). sanction_type_id → ethics_sanction_types (nullable).';

create index ethics_decision_details_case_idx
  on public.ethics_decision_details (case_id);

alter table public.ethics_decision_details enable row level security;

create policy ethics_decision_details_select on public.ethics_decision_details
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

grant select on public.ethics_decision_details to authenticated;

-- -----------------------------------------------------------------------------
-- 4 · case_votes — ENGINE-LEVEL; ethics is the primary consumer. NO 'recused' vote
--     value: recusal is an ACCESS fact (E1), not a ballot option (D4).
-- -----------------------------------------------------------------------------
create table if not exists public.case_votes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_id uuid not null references public.case_decisions(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,   -- the hearing/meeting where cast (BE-4)
  voter_id uuid not null references public.profiles(id) on delete restrict,
  vote text not null check (vote in ('approve', 'reject', 'abstain')),   -- NO 'recused' — D4
  rationale_md text,                                       -- sanitized Markdown (Rule 7)
  voted_at timestamptz not null default now(),
  -- One vote per member per decision — HC0J4. NAMED so the mutation audit can drop it.
  constraint case_votes_decision_voter_uniq unique (decision_id, voter_id),
  created_at timestamptz not null default now()
);
comment on table public.case_votes is
  'ADR 0073 D4 — a formal deliberation vote (ENGINE-LEVEL; ethics primary consumer). One '
  'vote per (decision, voter) — HC0J4. NO recused ballot: a recused/respondent member is '
  'access-denied (E1 can_read_case) AND refused at the cast_case_vote door (HC0J5). SELECT '
  'gated by can_read_case; writes DEFINER-RPC-only (cast_case_vote).';

create index case_votes_decision_idx
  on public.case_votes (decision_id);
create index case_votes_case_idx
  on public.case_votes (case_id);

alter table public.case_votes enable row level security;

create policy case_votes_select on public.case_votes
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

grant select on public.case_votes to authenticated;

-- -----------------------------------------------------------------------------
-- 5 · app.eligible_voters(p_case_id) — R6-safe over base tables: active commission
--     members MINUS recused MINUS respondent. Used by the read projection (BE-8) + the
--     optional quorum gate (O-3); NEVER an RLS term.
-- -----------------------------------------------------------------------------
create or replace function app.eligible_voters(p_case_id uuid)
  returns setof uuid
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select m.principal_id
  from public.memberships m
  where m.commission_id = app.commission_of_case(p_case_id)
    and (m.expires_at is null or m.expires_at > now())
    and app.is_active(m.principal_id)
    and not app.is_recused_from_case(p_case_id, m.principal_id)
    and not app.is_case_respondent(p_case_id, m.principal_id)
  group by m.principal_id;
$$;
alter function app.eligible_voters(uuid) owner to postgres;
revoke all on function app.eligible_voters(uuid) from public;
grant execute on function app.eligible_voters(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6 · cast_case_vote — the E1-consumption vote-exclusion door. ⛔ ORDER IS
--     LOAD-BEARING (M6/233 + no-regression-twin): flag → decision-exists → ethics-typed
--     → AUTHORITY (member, 42501 — DISTINCT from HC0J5) → EXCLUSION (recused/respondent,
--     HC0J5) → value CHECK → insert (HC0J4 on the unique). A non-member NEVER reaches the
--     HC0J5 branch, so the HC0J5 keystones test ONLY the exclusion, never authority.
-- -----------------------------------------------------------------------------
create or replace function public.cast_case_vote(
  p_decision_id uuid, p_vote text, p_rationale_md text default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_id uuid;
begin
  -- (a) flag.
  perform app.assert_ethics_enabled();

  -- (b) the decision must exist; resolve its case.
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then
    raise exception 'decisão não encontrada' using errcode = 'P0002';
  end if;
  v_commission := app.commission_of_case(v_case_id);

  -- (c) ethics-typed (Lead ruling 1: existence of ethics_case_details IS the marker).
  if not exists (select 1 from public.ethics_case_details d where d.case_id = v_case_id) then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;

  -- (d) AUTHORITY FIRST — a commission member may vote. DISTINCT SQLSTATE (42501), so a
  -- non-member is NEVER mistaken for an excluded member (the non-vacuity requirement).
  if not app.is_member_of_for(v_commission, auth.uid()) then
    raise exception 'usuário não autorizado a votar neste caso' using errcode = '42501';
  end if;

  -- (e) EXCLUSION — consume E1. A recused OR respondent member is refused (HC0J5). This
  -- is reached ONLY by an authority-passing member, so the HC0J5 keystones are non-vacuous.
  if app.is_recused_from_case(v_case_id, auth.uid())
     or app.is_case_respondent(v_case_id, auth.uid()) then
    raise exception 'membro impedido (recusado ou denunciado) não pode votar'
      using errcode = 'HC0J5';
  end if;

  -- (f) value.
  if p_vote not in ('approve', 'reject', 'abstain') then
    raise exception 'valor de voto inválido' using errcode = 'check_violation';
  end if;

  -- (g) insert. case_votes.case_id = the decision's case_id (coherence in the RPC).
  begin
    insert into public.case_votes (case_id, decision_id, voter_id, vote, rationale_md)
    values (v_case_id, p_decision_id, auth.uid(), p_vote, nullif(btrim(p_rationale_md), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'já existe um voto deste membro para esta decisão'
      using errcode = 'HC0J4';
  end;

  -- Rule 11: THAT + WHO + the vote value, never case content.
  perform app.audit_write('case.vote_cast', 'case', v_case_id, v_commission,
    'Voto registrado na decisão do caso',
    jsonb_build_object('decision_id', p_decision_id, 'vote', p_vote));
  return v_id;
end;
$$;
alter function public.cast_case_vote(uuid, text, text) owner to postgres;
revoke all on function public.cast_case_vote(uuid, text, text) from public;
grant execute on function public.cast_case_vote(uuid, text, text) to authenticated, service_role;

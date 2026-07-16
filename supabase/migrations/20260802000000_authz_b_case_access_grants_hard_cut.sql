-- =============================================================================
-- ADR 0078 · Stage B — the case_access → case_access_grants HARD CUT (B1→B5).
--
-- ONE atomic migration (lead-approved): there is never a broken intermediate state
-- (no function referencing a dropped table; the two tables never both live). This
-- retires the `case_access` flag (D9) and ships a SINGLE authorization path.
--
-- ⛔ Every repointed / de-referenced function below was RE-EMITTED from the LIVE
-- `pg_get_functiondef()` (2026-07-16 @ HEAD, 122 migrations), NOT from migration
-- text — migration file bodies are stale by design (some are rewritten at runtime
-- via pg_get_functiondef()+replace()+execute). Re-emitting off stale text would
-- silently drop intervening patches (M5/M5b/A2/A4/U1/U2). See handoff §7 /
-- re-emit-from-live-def.
--
-- SEMANTIC CHANGE (intended — defect ①·2 closure): a legacy `case_access.level`
-- read/write grant conferred read_standard_phi. In the new shape PHI is a PER-COLUMN
-- capability (`read_standard_phi`), conferred iff granted, NEVER inferred from a
-- read/write grant and NEVER from write (A16 — disjoint chains). Migrated legacy
-- grants keep content/deliberation/write (LOST=0) and lose only the inferred PHI.
--
-- SQLSTATE: authority 42501 → exclusion HC0F1 (assert_not_case_excluded) → validation
-- check_violation. (Door authority kept at 42501 — already distinct from HC0F1, so
-- §7.1's distinct-code/authority-first defense holds; not churned to HC0F5.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- B1 · 1 — the table. Capability-per-column; RLS from creation; NO authenticated
--          DML (BUG-SUP-002 — only the DEFINER doors + resolver, owner postgres,
--          touch it). Plain cases(id) tenancy anchor (lead ruling D3): the case is
--          the authoritative anchor and the doors confine grantor authority +
--          grantee membership to the case's commission.
-- -----------------------------------------------------------------------------
create table public.case_access_grants (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references public.cases(id)    on delete cascade,
  principal_id           uuid not null references public.profiles(id) on delete cascade,

  -- Source of the grant. Only 'manual_grant' is REACHABLE pre-pilot (no writer
  -- produces the others); the RESERVED three shape-in for Stage D/E. `source_entity_id`
  -- is a single polymorphic scope ref (lead ruling D1) — null for manual_grant.
  -- ⚠ When 'referral'/'nsp_investigation' land (Stage D/E), source_entity_id's tenant
  -- relationship to the case MUST be guarded there (a referral can be cross-org by
  -- design); manual_grant needs no such guard (the case is the anchor).
  source                 text not null default 'manual_grant'
    check (source in ('manual_grant', 'nsp_investigation', 'referral', 'break_glass')),
  source_entity_id       uuid,

  -- Capability-per-column (grantable). view_case_overview is RESERVED/UNCONSUMED
  -- (A16) and manage_case_access is computed for the doors — NEITHER is a grant column.
  read_case_content      boolean not null default false,
  read_case_deliberation boolean not null default false,
  read_standard_phi      boolean not null default false,
  read_restricted_phi    boolean not null default false,
  write_case_content     boolean not null default false,

  -- Confidentiality ceiling: a RANKED, RESERVED column (A19). ORTHOGONAL to
  -- read_restricted_phi (that gates rank 2; the ceiling gates ranks 5/6) — do NOT
  -- collapse the two. Stage E builds the write path/selector/unfencing.
  max_confidentiality    text
    check (max_confidentiality is null or max_confidentiality in
      ('non_phi_internal', 'phi_standard', 'phi_restricted', 'peer_review_confidential',
       'legal_privileged', 'ethics_investigation', 'credentialing_sensitive')),

  -- Governance signal: which arm authorized. 'org_admin_deadlock_exit' marks a B6
  -- member-less-admin deadlock grant; 'creator_self_grant' marks a case-creator's
  -- self read-grant. All three values are REACHABLE (no invented-with-no-writer code).
  reason_code            text not null default 'coordinator_grant'
    check (reason_code in ('coordinator_grant', 'org_admin_deadlock_exit', 'creator_self_grant')),
  reason                 text check (reason is null or btrim(reason) <> ''),

  granted_by             uuid references public.profiles(id),
  granted_at             timestamptz not null default now(),
  expires_at             timestamptz,
  revoked_at             timestamptz,
  revoked_by             uuid references public.profiles(id),

  -- lattice
  constraint case_access_grants_write_implies_read
    check (not write_case_content or read_case_content),
  constraint case_access_grants_restricted_implies_standard
    check (not read_restricted_phi or read_standard_phi),
  -- non-empty: a grant confers at least one capability
  constraint case_access_grants_nonempty
    check (read_case_content or read_case_deliberation or read_standard_phi
           or read_restricted_phi or write_case_content),
  -- ⚠ NO `expires_at > granted_at` table CHECK: the future-at-grant-time invariant is
  -- the DOOR's (grant_case_access rejects p_expires_at <= now()); a table invariant
  -- would (a) reject the lossless migration of an already-expired legacy grant and
  -- (b) break the expiry-test pattern (backdating expires_at to simulate expiry). The
  -- resolver reads `expires_at > now()`, so a past expiry correctly confers nothing.
  -- revoke shape: revoked_at and revoked_by move together
  constraint case_access_grants_revoke_shape
    check ((revoked_at is null) = (revoked_by is null)),
  -- source↔entity shape: manual_grant carries no scope entity
  constraint case_access_grants_manual_no_entity
    check (source <> 'manual_grant' or source_entity_id is null)
);

comment on table public.case_access_grants is
  'ADR 0078 Stage B — per-case capability grants (replaces case_access). '
  'Capability-per-column; PHI is granted per-column, never inferred from a read/write '
  'grant (defect ①·2). Writes are DEFINER-RPC-only (grant/revoke_case_access + the '
  'creator self-grant); NO authenticated DML (BUG-SUP-002). Soft revocation via '
  'revoked_at. Only source=manual_grant is reachable pre-pilot.';

-- Active partial-unique. NULLS NOT DISTINCT (PG≥15 — local is 17.6) so a null
-- source_entity_id still collides: at most ONE active grant per (case, principal,
-- source). Without NULLS NOT DISTINCT two active manual grants would slip through.
create unique index case_access_grants_active_source_uniq
  on public.case_access_grants (case_id, principal_id, source, source_entity_id)
  nulls not distinct
  where revoked_at is null;

-- The resolver's driving lookup + the expiry sweep, both over active rows only.
create index case_access_grants_active_case_principal_idx
  on public.case_access_grants (case_id, principal_id)
  where revoked_at is null;
create index case_access_grants_principal_expiry_idx
  on public.case_access_grants (principal_id, expires_at)
  where revoked_at is null;

-- RLS from creation. BUG-SUP-002 posture: authenticated has NO direct DML (no INSERT/
-- UPDATE/DELETE grant, no write policy) — only the DEFINER doors write. SELECT is a
-- narrow OWN-ROW self-arm (mirrors the legacy case_access self-arm the 228 sweep
-- documents): a principal may see their own grant, nobody else's; the roster is served
-- only by the DEFINER list_case_access. A plain SELECT of another principal's grant
-- returns zero rows, never a leak.
alter table public.case_access_grants enable row level security;
revoke all on public.case_access_grants from public;
revoke all on public.case_access_grants from authenticated;
grant select on public.case_access_grants to authenticated;
create policy case_access_grants_select_own on public.case_access_grants
  for select to authenticated
  using (principal_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- B5 (in-migration half) · LOSSLESS data migration — old rows → new shape, BEFORE
-- the DROP and BEFORE the audit trigger (no audit noise; already audited at grant).
-- read→read_case_content, write→write+read_case_content, deliberation by lattice,
-- max_confidentiality carried as the orthogonal ceiling. NO PHI inferred.
-- On a fresh reset this migrates 0 rows (migrations precede seed) and is harmless;
-- on an in-place apply it prevents grant loss.
-- -----------------------------------------------------------------------------
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_case_deliberation,
   write_case_content, max_confidentiality, reason_code, reason,
   granted_by, granted_at, expires_at)
select ca.case_id, ca.user_id, 'manual_grant',
       true,                       -- read_case_content (every legacy grant saw content)
       true,                       -- read_case_deliberation (lattice)
       (ca.level = 'write'),       -- write_case_content
       ca.max_confidentiality,     -- carry the ceiling; NO PHI column inferred
       'coordinator_grant',
       ca.reason,
       ca.granted_by, ca.granted_at, ca.expires_at
from public.case_access ca;

-- -----------------------------------------------------------------------------
-- B1 · 2 — audit trigger, repointed to the new table + column set. A soft-revoke
-- (UPDATE setting revoked_at) is audited as 'case_access.revoked', not 'updated'.
-- -----------------------------------------------------------------------------
create or replace function app.trg_audit_case_access()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_cols constant text[] := array['read_case_content', 'read_case_deliberation',
    'read_standard_phi', 'read_restricted_phi', 'write_case_content',
    'max_confidentiality', 'expires_at', 'reason_code', 'reason'];
  v_case uuid;
  v_user uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_case := old.case_id; v_user := old.principal_id; v_action := 'case_access.revoked';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_case := new.case_id; v_user := new.principal_id; v_action := 'case_access.granted';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_case := new.case_id; v_user := new.principal_id;
    v_action := case when new.revoked_at is not null and old.revoked_at is null
                     then 'case_access.revoked' else 'case_access.updated' end;
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;

  perform app.audit_write(v_action, 'case_access', v_case,
    app.commission_of_case(v_case),
    'Acesso ao caso ' || tg_op || ' (membro ' || coalesce(v_user::text, '?') || ')',
    v_meta);
  return null;
end;
$fn$;

create trigger audit_case_access_grants_trg
  after insert or delete or update on public.case_access_grants
  for each row execute function app.trg_audit_case_access();

-- =============================================================================
-- B1 · 3 — the RESOLVER. `manual_grant` arm swaps from case_access.level to the
-- case_access_grants columns; S5L (flag-OFF legacy) DELETED (D9); the flag branch
-- collapses. Every OTHER arm (STEP 1–5, nsp/coordinator/org/member) is faithful to
-- the live A2/A4 body — re-emitted, not reconstructed from scratch.
-- =============================================================================
create or replace function app._case_caps(p_case_id uuid, p_uid uuid)
returns integer
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_caps       int  := 0;
  v_commission uuid;
  v_policy     text;
  v_eg         boolean;
  v_coord      boolean;
  v_orgadmin   boolean;
  v_member     boolean;
  v_g          record;
begin
  -- STEP 1 — null user => 0.
  if p_uid is null then
    return 0;
  end if;

  -- STEP 2 — D3 outer gate: a deactivated/suspended principal reaches nothing.
  if not app.is_active(p_uid) then
    return 0;
  end if;

  -- STEP 3 — tenant anchors. Unknown case => fail closed.
  select commission_id, visibility_policy
    into v_commission, v_policy
  from public.cases where id = p_case_id;
  if v_commission is null then
    return 0;
  end if;

  -- STEP 4 — HARD DENY, before every positive arm (ADR 0072 D2). A respondent or a
  -- recused user is denied even where a positive arm would grant.
  if app.is_case_respondent(p_case_id, p_uid) then
    return 0;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return 0;
  end if;

  -- STEP 5 — union the positive sources.
  v_eg       := (v_policy = 'explicit_grants_only');
  v_coord    := app.is_staff_admin_of_for(v_commission, p_uid);
  v_orgadmin := app.is_commission_admin_of_for(v_commission, p_uid);
  v_member   := app.is_member_of_for(v_commission, p_uid);

  -- ── S6 · nsp_referral_touched (LIVE — confers content + PHI today; D8/N1 removes
  --         the PHI half at Gate 2). Unchanged from A2. ─────────────────────────
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_standard_phi')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S1 · committee_coordinator — all EXCEPT read_restricted_phi (D5·6). ───────
  if v_coord then
    v_caps := v_caps | app._cap_bit('view_case_overview')
                     | app._cap_bit('read_case_deliberation')
                     | app._cap_bit('read_case_content')
                     | app._cap_bit('read_standard_phi')
                     | app._cap_bit('write_case_content')
                     | app._cap_bit('manage_case_access');
  end if;

  -- ── S2 · org_admin — manage_case_access ONLY (A4 removed content/deliberation). ─
  if v_orgadmin then
    v_caps := v_caps | app._cap_bit('manage_case_access');
  end if;

  -- ── S5 · committee_member_default — read_case_deliberation ONLY (A15). ────────
  if v_member and not v_eg then
    v_caps := v_caps | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S3 · manual_grant (case_access_grants — per-column capabilities). ─────────
  -- ⭐ DEFECT ①·2 CLOSED: read_standard_phi is conferred iff its COLUMN is set,
  -- NEVER inferred from a read/write grant and NEVER from write (A16). Lattice
  -- closure applied on read. NO feature-flag branch (the flag is retired); the
  -- flag-OFF legacy member arm (S5L) is DELETED (D9). Multiple active grants union
  -- (the active partial-unique bounds it to one per source, but the loop is robust).
  for v_g in
    select read_case_content, read_case_deliberation, read_standard_phi,
           read_restricted_phi, write_case_content
    from public.case_access_grants g
    where g.case_id = p_case_id and g.principal_id = p_uid
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  loop
    -- Faithful to the pre-cut grant arm: it conferred content + deliberation (NOT
    -- view_case_overview — that RESERVED bit stays coordinator-only), so the mechanism
    -- swap keeps GAINED=0 on the raw bitmask, not only on consumed reach.
    if v_g.write_case_content then
      v_caps := v_caps | app._cap_bit('write_case_content')
                       | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_case_deliberation then
      v_caps := v_caps | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_standard_phi then
      v_caps := v_caps | app._cap_bit('read_standard_phi');
    end if;
    if v_g.read_restricted_phi then
      v_caps := v_caps | app._cap_bit('read_restricted_phi')
                       | app._cap_bit('read_standard_phi');
    end if;
  end loop;

  -- ── S4 · case_assignment — read_case_content + read_case_deliberation ONLY
  --         (NEVER PHI — defect ①; NEVER write — D10). Unchanged from A2. ────────
  if exists (select 1 from public.case_phases cp
             where cp.case_id = p_case_id and cp.assigned_to = p_uid)
     or exists (select 1 from public.case_narratives cn
                where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- STEP 6 — return. (No lifecycle step; guard_case_status owns terminal-freeze.)
  return v_caps;
end;
$fn$;

-- =============================================================================
-- B1 · 4 — the writer. DROP+CREATE (signature gains reason_code + PHI params, all
-- defaulted so the 3-arg creator self-grant calls still resolve). Translates
-- level→columns; source is always the only reachable value, manual_grant. Upserts
-- the ACTIVE grant (partial-index inference) so re-granting refreshes in place.
-- =============================================================================
drop function if exists app._grant_case_access_unchecked(uuid, uuid, text, timestamptz, text);
create function app._grant_case_access_unchecked(
  p_case uuid, p_user uuid, p_level text,
  p_expires_at timestamptz default null,
  p_reason text default null,
  p_reason_code text default 'coordinator_grant',
  p_read_standard_phi boolean default false,
  p_read_restricted_phi boolean default false)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
begin
  insert into public.case_access_grants
    (case_id, principal_id, source, read_case_content, read_case_deliberation,
     write_case_content, read_standard_phi, read_restricted_phi,
     reason_code, reason, granted_by, granted_at, expires_at)
  values
    (p_case, p_user, 'manual_grant',
     true, true,                                       -- content + deliberation
     (p_level = 'write'),
     (p_read_standard_phi or p_read_restricted_phi),   -- restricted implies standard
     p_read_restricted_phi,
     p_reason_code, nullif(btrim(p_reason), ''),
     auth.uid(), now(), p_expires_at)
  on conflict (case_id, principal_id, source, source_entity_id) where revoked_at is null
  do update set
     read_case_content      = excluded.read_case_content,
     read_case_deliberation = excluded.read_case_deliberation,
     write_case_content     = excluded.write_case_content,
     read_standard_phi      = excluded.read_standard_phi,
     read_restricted_phi    = excluded.read_restricted_phi,
     reason_code            = excluded.reason_code,
     reason                 = excluded.reason,
     granted_by             = excluded.granted_by,
     granted_at             = excluded.granted_at,
     expires_at             = excluded.expires_at;
end;
$fn$;
revoke all on function app._grant_case_access_unchecked(uuid, uuid, text, timestamptz, text, text, boolean, boolean) from public;

-- =============================================================================
-- B2 · the doors — re-cut to the new shape. assert_case_access_enabled() dropped
-- (flag retired). Authority 42501 FIRST, then exclusion HC0F1 (U1 preserved), then
-- validation. B6 org-admin deadlock arm preserved (safe: grantee must be a member).
-- =============================================================================
drop function if exists public.grant_case_access(uuid, uuid, text, timestamptz, text);
create function public.grant_case_access(
  p_case uuid, p_user uuid, p_level text default 'read',
  p_expires_at timestamptz default null,
  p_reason text default null,
  p_read_standard_phi boolean default false,
  p_read_restricted_phi boolean default false)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_commission uuid;
  v_is_coord   boolean;
  v_reason_code text;
begin
  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;

  -- Authority FIRST (42501) — the B6 org-admin arm is the single-coordinator
  -- deadlock exit; safe because the door also requires grantee membership below,
  -- so an Organization User (not a member) can never self-escalate.
  v_is_coord := app.is_staff_admin_of(v_commission);
  if not (v_is_coord or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- U1 EXCLUSION: a recused coordinator cannot choose who investigates the case she
  -- is recused from. Authority-first means a precondition-less twin fails loudly.
  perform app.assert_not_case_excluded(p_case);

  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'a data de expiração deve ser futura' using errcode = 'check_violation';
  end if;

  -- D5·6: the coordinator may ISSUE read_restricted_phi without holding it. No
  -- grantor-holds-it gate is added (matching today's door): the coordinator holds
  -- Content + Standard PHI by construction, and the org-admin deadlock arm is bounded
  -- by grantee membership.
  v_reason_code := case when v_is_coord then 'coordinator_grant'
                        else 'org_admin_deadlock_exit' end;
  perform app._grant_case_access_unchecked(
    p_case, p_user, p_level, p_expires_at, p_reason,
    v_reason_code, p_read_standard_phi, p_read_restricted_phi);
end;
$fn$;
revoke all on function public.grant_case_access(uuid, uuid, text, timestamptz, text, boolean, boolean) from public;
grant execute on function public.grant_case_access(uuid, uuid, text, timestamptz, text, boolean, boolean) to authenticated;

create or replace function public.revoke_case_access(p_case uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- U1 EXCLUSION: a recused coordinator cannot obstruct a grant on the case she is
  -- recused from.
  perform app.assert_not_case_excluded(p_case);

  -- Soft-revoke: the resolver reads only revoked_at is null grants.
  update public.case_access_grants
     set revoked_at = now(), revoked_by = auth.uid()
   where case_id = p_case and principal_id = p_user
     and source = 'manual_grant' and revoked_at is null;
end;
$fn$;

drop function if exists public.list_case_access(uuid);
create function public.list_case_access(p_case uuid)
returns table(user_id uuid, level text, granted_at timestamptz, expires_at timestamptz,
              reason text, max_confidentiality text,
              read_standard_phi boolean, read_restricted_phi boolean)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case);

  -- B2: PROJECT THE CLEARANCE — max_confidentiality (omitted today) + the PHI tiers.
  -- `level` is derived for backward-compat with the existing UI reader.
  return query
    select g.principal_id,
           case when g.write_case_content then 'write' else 'read' end,
           g.granted_at, g.expires_at, g.reason,
           g.max_confidentiality, g.read_standard_phi, g.read_restricted_phi
    from public.case_access_grants g
    where g.case_id = p_case and g.source = 'manual_grant' and g.revoked_at is null
    order by g.granted_at;
end;
$fn$;
revoke all on function public.list_case_access(uuid) from public;
grant execute on function public.list_case_access(uuid) to authenticated;

-- =============================================================================
-- B3 · attachment clearance — repoint the two readers to case_access_grants, and
-- FENCE the trap: reclassify_attachment REJECTS legal_privileged / credentialing_
-- sensitive pre-pilot (A19 — the write path/selector/unfencing is Stage E).
-- =============================================================================
create or replace function app.attachment_confidentiality_ok(p_owner_type text, p_owner_id uuid, p_label text, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_case uuid;
begin
  if p_uid is null then
    return false;
  end if;
  -- O2: only these two labels gate above ordinary case-read; everything else passes.
  if p_label is null
     or p_label not in ('legal_privileged', 'credentialing_sensitive') then
    return true;
  end if;
  v_case := case p_owner_type
    when 'case' then p_owner_id
    when 'interview' then app.case_of_interview(p_owner_id)
    else null
  end;
  if v_case is null then
    return false;                                     -- gated label, no clearance plane: fail closed
  end if;
  return exists (
    select 1 from public.case_access_grants g
    where g.case_id = v_case and g.principal_id = p_uid
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and g.max_confidentiality is not null
      and app.confidentiality_rank(g.max_confidentiality) >= app.confidentiality_rank(p_label)
  );
end;
$fn$;

create or replace function app.confidentiality_clearance_ok(p_case_id uuid, p_label text, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
begin
  if p_uid is null then
    return false;
  end if;
  if p_label is null
     or p_label not in ('legal_privileged', 'credentialing_sensitive') then
    return true;
  end if;
  return exists (
    select 1 from public.case_access_grants g
    where g.case_id = p_case_id and g.principal_id = p_uid
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and g.max_confidentiality is not null
      and app.confidentiality_rank(g.max_confidentiality) >= app.confidentiality_rank(p_label)
  );
end;
$fn$;

create or replace function public.reclassify_attachment(p_id uuid, p_new_tier text, p_new_label text DEFAULT NULL::text)
returns attachments
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_row public.attachments;
  v_commission uuid;
  v_new_bucket text;
  v_new_label text;
begin
  perform app.assert_attachments_enabled();

  if p_new_tier not in ('phi', 'standard') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  -- B3 FENCE (A19): the two ceiling labels have no reachable clearance-write path
  -- pre-pilot, so applying one PERMANENTLY hides the attachment from everyone,
  -- including its uploader. Reject until Stage E builds the write path + unfencing.
  if p_new_label in ('legal_privileged', 'credentialing_sensitive') then
    raise exception 'esta classificação de confidencialidade ainda não está disponível'
      using errcode = 'check_violation';
  end if;

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    raise exception 'anexo não encontrado' using errcode = 'P0002';
  end if;
  v_commission := app.commission_of_attachment(v_row.owner_type, v_row.owner_id);

  if p_new_tier = 'standard' and v_row.sensitivity_tier = 'phi' then
    if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
      raise exception 'apenas a coordenação pode reduzir a classificação de um anexo'
        using errcode = '42501';
    end if;
    if v_row.owner_type = 'case' then
      perform app.assert_not_case_excluded(v_row.owner_id);
    elsif v_row.owner_type = 'interview' then
      perform app.assert_not_case_excluded(app.case_of_interview(v_row.owner_id));
    end if;
  else
    if not app.can_write_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
      raise exception 'sem permissão para reclassificar este anexo' using errcode = '42501';
    end if;
  end if;

  v_new_bucket := case when p_new_tier = 'phi' then 'attachments-phi' else 'attachments' end;

  v_new_label := coalesce(p_new_label, v_row.confidentiality_label);
  if p_new_tier = 'standard' and v_new_label in ('phi_standard', 'phi_restricted') then
    v_new_label := 'non_phi_internal';
  end if;
  if v_new_label in ('phi_standard', 'phi_restricted') and p_new_tier <> 'phi' then
    raise exception 'rótulo incompatível com a classificação' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_attachments_rpc', 'on', true);
  update public.attachments
     set sensitivity_tier = p_new_tier,
         storage_bucket = v_new_bucket,
         confidentiality_label = v_new_label,
         updated_at = now()
   where id = p_id
  returning * into v_row;
  perform set_config('app.in_attachments_rpc', 'off', true);

  return v_row;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- referral_target_analyst — 3rd disjunct (a grantee of the target case is an
-- analyst) repointed to case_access_grants. The M5 outer is_active gate preserved.
-- -----------------------------------------------------------------------------
create or replace function app.referral_target_analyst(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  select app.is_active(p_uid) and exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and r.target_case_id is not null
      and (
        exists (select 1 from public.case_phases cp
                where cp.case_id = r.target_case_id and cp.assigned_to = p_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = r.target_case_id and cn.assigned_to = p_uid)
        or exists (select 1 from public.case_access_grants g
                   where g.case_id = r.target_case_id and g.principal_id = p_uid
                     and g.revoked_at is null
                     and (g.expires_at is null or g.expires_at > now()))
      )
  );
$fn$;

-- =============================================================================
-- B4 · the case creator self-grant + the flag-branching readers. Every
-- `feature_enabled('case_access')` branch COLLAPSES to its (live) flag-ON form; the
-- self-grants carry reason_code 'creator_self_grant'.
-- =============================================================================
create or replace function public.create_case(p_commission_id uuid, p_label text DEFAULT NULL::text, p_patient_enabled boolean DEFAULT false, p_outcome_ids uuid[] DEFAULT '{}'::uuid[], p_department_id uuid DEFAULT NULL::uuid, p_department_other text DEFAULT NULL::text)
returns cases
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();
  perform app.assert_processless_cases_enabled();

  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
          or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, p_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if cardinality(p_outcome_ids) > 0 then
    perform app.assert_extras_enabled();

    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = p_commission_id
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other)
      values
        (p_commission_id, null, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(p_patient_enabled, false), p_department_id, v_dept_other)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  if cardinality(p_outcome_ids) > 0 then
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case.id, oid from unnest(p_outcome_ids) as oid
    on conflict do nothing;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  -- ADR 0061 (revised): a NON-coordinator (capability-arm) creator self-grants a
  -- case_access READ — just enough to SEE the case they opened. Coordinators/commission
  -- admins already see the whole board — skip them. (Flag branch collapsed — B4.)
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  return v_case;
end;
$fn$;

create or replace function public.create_case_from_template(p_template_id uuid, p_label text DEFAULT NULL::text, p_department_id uuid DEFAULT NULL::uuid, p_department_other text DEFAULT NULL::text, p_case_type_id uuid DEFAULT NULL::uuid)
returns cases
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_case_phase_id uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
  v_dept_other text := nullif(btrim(p_department_other), '');
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if p_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = p_case_type_id
      and organization_id = app.org_of_commission(v_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_collects, false), p_department_id, v_dept_other,
         v_visibility, v_confidentiality)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  for r_slot in
    select id, position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result
    from public.process_template_phases
    where template_id = p_template_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    if r_slot.recommend_when is not null then
      perform app.validate_template_recommend_when(
        p_template_id, r_slot.position, r_slot.recommend_when
      );
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset,
       emits_result)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result)
    returning id into v_case_phase_id;

    insert into public.case_phase_allowed_results (case_phase_id, result_id, position)
    select v_case_phase_id, tar.result_id, tar.position
    from public.process_template_phase_allowed_results tar
    where tar.template_phase_id = r_slot.id
      and r_slot.emits_result;
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from (
    select (r ->> 'result_id')::uuid as rid
    from public.case_phases cp
    cross join lateral jsonb_array_elements(coalesce(cp.result_ruleset -> 'rules', '[]'::jsonb)) as r
    where cp.case_id = v_case.id
    union
    select (cp.result_ruleset ->> 'default_result_id')::uuid
    from public.case_phases cp
    where cp.case_id = v_case.id
    union
    select cpar.result_id
    from public.case_phase_allowed_results cpar
    join public.case_phases cp on cp.id = cpar.case_phase_id
    where cp.case_id = v_case.id
  ) ids
  where ids.rid is not null
  on conflict do nothing;

  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_id = p_template_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  -- ADR 0061 (revised): self-grant the non-coordinator creator a READ. (Flag branch
  -- collapsed — B4.)
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  return v_case;
end;
$fn$;

create or replace function public.get_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $fn$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Flag branch collapsed (B4): the case_access read path is the only path now.
  if not app.can_read_case(p_case_id, auth.uid()) then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id);

  if not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    'has_patient', v_case.has_patient,
    'patient_enabled', v_case.patient_enabled,
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at,
          'result_id', cp.result_id,
          'result_computed_at', cp.result_computed_at,
          'result', case when prr.id is null then null else jsonb_build_object(
            'id', prr.id,
            'label', prr.label,
            'color_token', prr.color_token,
            'is_adverse', prr.is_adverse,
            'source', cp.result_source
          ) end
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join public.phase_results prr on prr.id = cp.result_id
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'completed'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'is_ad_hoc', cn.is_ad_hoc,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$fn$;

create or replace function public.get_member_overview(p_commission uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_uid uuid := auth.uid();
  v_cases_flag boolean := app.feature_enabled('cases_extras');
  v_meetings_flag boolean := app.feature_enabled('meetings');
  v_action_items_flag boolean := app.feature_enabled('action_items');

  v_cases_not_concluded int := 0;
  v_pending_action_items int := 0;
  v_pending_overdue int := 0;
  v_meetings_not_concluded int := 0;
  v_next_meeting_start timestamptz := null;
  v_pending_signatures int := 0;
  v_in_progress_responses int := 0;
begin
  if v_uid is null then
    return jsonb_build_object(
      'cases_not_concluded', 0,
      'pending_action_items', 0,
      'pending_action_items_overdue', 0,
      'meetings_not_concluded', 0,
      'next_meeting_start', null,
      'pending_signatures', 0,
      'in_progress_responses', 0
    );
  end if;

  if not app.is_active(v_uid) then
    return jsonb_build_object(
      'cases_not_concluded', 0,
      'pending_action_items', 0,
      'pending_action_items_overdue', 0,
      'meetings_not_concluded', 0,
      'next_meeting_start', null,
      'pending_signatures', 0,
      'in_progress_responses', 0
    );
  end if;

  -- (1) Cases not concluded — PERSONAL. The grant leg (now case_access_grants, active
  -- rows only) carries the expiry filter. (Flag branch collapsed — B4.)
  if v_cases_flag then
    select count(*) into v_cases_not_concluded
    from public.cases c
    where c.commission_id = p_commission
      and c.status not in ('completed', 'cancelled')
      and (
        exists (
          select 1 from public.case_phases cp
          where cp.case_id = c.id and cp.assigned_to = v_uid
        )
        or exists (
          select 1 from public.case_narratives cn
          where cn.case_id = c.id and cn.assigned_to = v_uid
        )
        or exists (
          select 1 from public.case_access_grants g
          where g.case_id = c.id and g.principal_id = v_uid
            and g.revoked_at is null
            and (g.expires_at is null or g.expires_at > now())
        )
      );
  end if;

  select
    count(*),
    count(*) filter (where due_date is not null and due_date < current_date)
    into v_pending_action_items, v_pending_overdue
  from (
    select ai.due_date
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    where ai.assigned_to = v_uid
      and ai.commission_id = p_commission
      and st.is_terminal = false
      and (
        (ai.source_type = 'case' and v_cases_flag)
        or (ai.source_type in ('meeting', 'manual') and v_action_items_flag)
      )
  ) pend;

  if v_meetings_flag then
    select
      count(*),
      min(m.scheduled_start) filter (where m.scheduled_start >= now())
      into v_meetings_not_concluded, v_next_meeting_start
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and m.status in ('scheduled', 'held', 'in_signature');
  end if;

  if v_meetings_flag then
    select count(*) into v_pending_signatures
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and a.attendance = 'present'
      and m.status = 'in_signature'
      and not exists (
        select 1 from public.meeting_signatures s
        where s.attendee_id = a.id and s.status = 'signed'
      );
  end if;

  select count(*) into v_in_progress_responses
  from public.responses r
  where r.created_by = v_uid
    and r.commission_id = p_commission
    and r.status = 'in_progress';

  return jsonb_build_object(
    'cases_not_concluded', v_cases_not_concluded,
    'pending_action_items', v_pending_action_items,
    'pending_action_items_overdue', v_pending_overdue,
    'meetings_not_concluded', v_meetings_not_concluded,
    'next_meeting_start', v_next_meeting_start,
    'pending_signatures', v_pending_signatures,
    'in_progress_responses', v_in_progress_responses
  );
end;
$fn$;

create or replace function public.list_my_cases(p_commission uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  -- assert_case_access_enabled() removed (B4 — flag retired).
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  if not app.is_active(v_uid) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_obj order by created_at desc, case_number desc), '[]'::jsonb)
    into v_result
  from (
    select
      c.id,
      c.created_at,
      c.case_number,
      jsonb_build_object(
        'case_id', c.id,
        'case_number', c.case_number,
        'label', c.label,
        'status', c.status,
        'my_role',
          case
            when app.is_staff_admin_of_for(c.commission_id, v_uid)
                 or app.is_commission_admin_of_for(c.commission_id, v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access_grants g
              where g.case_id = c.id and g.principal_id = v_uid and g.write_case_content
                and g.revoked_at is null
                and (g.expires_at is null or g.expires_at > now())
            ) then 'collaborator'
            else 'viewer'
          end,
        'items', (
          select coalesce(jsonb_agg(item order by display_position), '[]'::jsonb)
          from (
            select
              coalesce(cp.display_position, cp.position) as display_position,
              jsonb_build_object(
                'kind', 'phase',
                'id', cp.id,
                'title', coalesce(nullif(btrim(cp.title), ''), f.title, 'Fase ' || cp.position),
                'status', cp.status,
                'display_position', coalesce(cp.display_position, cp.position),
                'actionable', (cp.status = 'active')
              ) as item
            from public.case_phases cp
            join public.forms f on f.id = cp.form_id
            where cp.case_id = c.id and cp.assigned_to = v_uid
            union all
            select
              cn.display_position,
              jsonb_build_object(
                'kind', 'narrative',
                'id', cn.id,
                'title', cn.type_label,
                'status', cn.status,
                'display_position', cn.display_position,
                'actionable', (cn.status = 'open')
              ) as item
            from public.case_narratives cn
            where cn.case_id = c.id and cn.assigned_to = v_uid
          ) items
        )
      ) as row_obj
    from public.cases c
    where c.commission_id = p_commission
      and (
        exists (select 1 from public.case_access_grants g
                where g.case_id = c.id and g.principal_id = v_uid
                  and g.revoked_at is null
                  and (g.expires_at is null or g.expires_at > now()))
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
      )
      and not app.is_case_respondent(c.id, v_uid)
      and not app.is_recused_from_case(c.id, v_uid)
  ) rows;

  return v_result;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- B4 · the five narrative RPCs — de-reference the deleted assert_case_access_enabled().
-- (Set C — closed via the 9-caller catalog sweep, not the contract's list.)
-- -----------------------------------------------------------------------------
create or replace function public.assign_narrative(p_narrative uuid, p_assignee uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin

  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'open' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;
  if not app.is_member_of_for(v_commission, p_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = p_assignee, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.conclude_narrative(p_narrative uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
  v_assigned uuid;
begin

  -- (Unit 2: resolve cn.case_id for the exclusion guard.)
  select cn.case_id, c.commission_id, c.status, cn.status, cn.assigned_to
    into v_case_id, v_commission, v_case_status, v_status, v_assigned
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- The assignee OR a coordinator/admin may conclude.
  if not (v_assigned = auth.uid()
          or app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2): a recused assignee/coordinator cannot conclude.
  perform app.assert_not_case_excluded(v_case_id);

  -- <- M5b defect 3. AFTER the authority check, never before: a deactivated
  -- NON-assignee must still fail on 42501, so a wrong-arm fixture cannot pass
  -- this gate's keystone by accident (A33).
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'open' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'completed', concluded_at = now(), concluded_by = auth.uid(),
      updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.reopen_narrative(p_narrative uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin

  -- (Unit 2: resolve cn.case_id for the exclusion guard.)
  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'completed' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'open', concluded_at = null, concluded_by = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.save_narrative_body(p_narrative uuid, p_body_md text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case_status text;
  v_status text;
begin

  select c.status, cn.status into v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- Q14 write predicate (the authority).
  if not app.can_write_case_narrative(p_narrative, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'as narrativas deste caso estão bloqueadas' using errcode = 'HC054';
  end if;
  if v_status <> 'open' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set body_md = p_body_md, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.unassign_narrative(p_narrative uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
begin

  select cn.case_id, c.commission_id, c.status
    into v_case_id, v_commission, v_case_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

-- =============================================================================
-- B4 · DROP the retired flag helpers, the old table, and the flag row.
-- =============================================================================
drop table public.case_access;                      -- cascades its trigger + policy + index
drop function public.case_access_enabled();
drop function app.assert_case_access_enabled();
delete from app.feature_flags where key = 'case_access';

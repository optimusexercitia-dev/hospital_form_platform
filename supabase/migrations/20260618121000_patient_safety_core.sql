-- Phase 14a / B2: Patient-Safety / NSP — CORE schema, event-code minting, lifecycle
-- guard, PQS membership helper, feature flag. The platform's FIRST PHI lands across
-- 14a (Architecture Rule 12; ADR 0030 umbrella; ADR 0031 the 14a backend decision).
--
-- A hospital committee detects a patient-safety EVENT during case analysis (or
-- stand-alone) and NOTIFIES the central Núcleo de Segurança do Paciente (NSP / PQS
-- department), which acknowledges, triages (14b), and where warranted runs an RCA
-- (14c) + a CAPA loop (14d). This migration (B2) lands the GOVERNANCE backbone only —
-- NO PHI, NO custody ledger yet:
--   * public.pqs_department — the singleton NSP config (name + RCA default due-days).
--   * public.patient_safety_event — the event header + lifecycle AUTHORITY
--     (reported → acknowledged → triaged → closed, plus cancelled) with the
--     denormalized current-owner pair that drives access-follows-custody RLS (B3).
--   * app.mint_event_code — per-NSP (GLOBAL) counter (advisory-lock copy of
--     app.mint_meeting_number, but the chain is platform-wide, not per-commission).
--   * app.is_pqs_member(uid) — the NSP access helper (= app.is_admin_for(uid) today,
--     STRUCTURED to OR-in a future pqs_members table — the single seam).
--   * app.commission_of_event — the RLS resolver (mirror commission_of_meeting).
--   * app.guard_event_status — the lifecycle state machine + freeze-at-triaged hook,
--     gated by the app.in_safety_rpc session flag (mirror guard_meeting_status).
--   * case_events.kind widened to add 'safety_event' (mirror the Phase-11 'interview'
--     add) so a case-linked event shows on the Phase-12 case timeline.
--   * the patient_safety feature flag (default OFF) + app.assert_patient_safety_enabled()
--     (RPC gate) + public.patient_safety_enabled() (TS-layer gate, mirror
--     public.meetings_enabled).
--
-- PHI (public.event_patient) + the custody ledger (public.event_custody) + the
-- access-follows-custody RLS land in B3; the lifecycle RPCs + the mutation-audit
-- triggers + the flag flip ON land in B4.
--
-- New SQLSTATEs (user-defined HC0xx class; ADR 0030 reserves HC043–HC053 for Phase 14;
-- 14a takes the first two):
--   HC043 event in the wrong state for the requested lifecycle operation.
--   HC044 not the current custodian — cannot act on the event (raised by the B4 RPCs).

-- ===========================================================================
-- public.pqs_department — the singleton NSP configuration
-- ===========================================================================
-- One NSP per platform deployment. The singleton is enforced by a partial unique
-- index on a constant expression (only one row may have singleton = true) — the
-- B4 seed inserts exactly one. rca_default_due_days is the 45-day RCA window the
-- triage (14b) / RCA (14c) phases read; kept here so the NSP can configure it.
create table public.pqs_department (
  id uuid primary key default gen_random_uuid(),
  -- A constant marker column the partial unique index keys on (always true).
  singleton boolean not null default true,
  name text not null default 'Núcleo de Segurança do Paciente',
  rca_default_due_days integer not null default 45,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pqs_department_name_not_blank check (btrim(name) <> ''),
  constraint pqs_department_singleton_true check (singleton = true),
  constraint pqs_department_due_days_positive check (rca_default_due_days >= 1)
);

alter table public.pqs_department enable row level security;

-- At most one NSP row (the singleton).
create unique index pqs_department_singleton_key on public.pqs_department (singleton);

comment on table public.pqs_department is
  'Singleton NSP/PQS-department configuration (one row per deployment). Holds the '
  'RCA default due-window read by triage (14b) / RCA (14c). No PHI.';

-- ===========================================================================
-- public.patient_safety_event — the event header + lifecycle authority
-- ===========================================================================
-- GOVERNANCE METADATA ONLY — NO patient identifiers (those live on the isolated
-- 0..1 public.event_patient satellite, B3). `code` is a PER-NSP (platform-wide)
-- minted human reference (EV-0001…), set by app.mint_event_code (the insert omits
-- it), backstopped by unique(code); notify_safety_event (B4) wraps the insert in a
-- one-shot unique_violation retry.
--
-- description_md is the reporter's SANITIZED-MARKDOWN narrative (Architecture Rule 7,
-- enforced in the data layer like section_text/minutes_md) — it is clinical free text
-- and is NEVER copied into the audit log (Rule 11).
--
-- The denormalized current-owner pair (current_owner_kind / current_owner_commission_id)
-- is the HEAD of the append-only event_custody ledger (B3). It is what the
-- access-follows-custody RLS reads (so a policy never recurses into the ledger):
-- read = member of the current owner commission OR member of reporting_commission_id
-- (provenance, never revoked) OR PQS/admin. notify_safety_event opens custody at the
-- NSP, so a freshly-reported event has current_owner_kind = 'pqs' / NULL commission.
--
-- event_type_id is a PLAIN NULLABLE uuid in 14a (a deferred-nullable hook, cf. capa's
-- source_indicator_id) — the FK target table public.pqs_event_types does not exist
-- until 14b, which adds the FK. The 14a notify form collects NO event type; the NSP
-- classifies during 14b triage.
create table public.patient_safety_event (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  reporting_commission_id uuid not null references public.commissions (id) on delete no action,
  -- A case-linked event references its case; stand-alone events leave this null.
  -- ON DELETE SET NULL keeps the event (an enduring safety record) if the case is
  -- ever removed — though cases are not hard-deleted in practice.
  case_id uuid references public.cases (id) on delete set null,
  discovered_at date,
  reported_at timestamptz not null default now(),
  location text,
  reported_by uuid references public.profiles (id),
  -- FK to public.pqs_event_types added in 14b (deferred-nullable hook).
  event_type_id uuid,
  suspected_harm_level text not null default 'unknown'
    check (suspected_harm_level in ('none', 'mild', 'moderate', 'severe', 'death', 'unknown')),
  title text not null,
  -- Sanitized Markdown (Rule 7); clinical free text — NEVER audited as a body.
  description_md text,
  status text not null default 'reported'
    check (status in ('reported', 'acknowledged', 'triaged', 'closed', 'cancelled')),
  -- Denormalized custody head (the access-follows-custody RLS reads this; the
  -- ledger of record is public.event_custody, B3).
  current_owner_kind text not null default 'pqs'
    check (current_owner_kind in ('pqs', 'commission')),
  current_owner_commission_id uuid references public.commissions (id) on delete no action,
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_safety_event_code_key unique (code),
  constraint patient_safety_event_title_not_blank check (btrim(title) <> ''),
  -- A 'commission' owner must name the commission; a 'pqs' owner must not.
  constraint patient_safety_event_owner_shape check (
    (current_owner_kind = 'pqs' and current_owner_commission_id is null)
    or (current_owner_kind = 'commission' and current_owner_commission_id is not null)
  )
);

alter table public.patient_safety_event enable row level security;

create index patient_safety_event_reporting_idx
  on public.patient_safety_event (reporting_commission_id);
create index patient_safety_event_owner_idx
  on public.patient_safety_event (current_owner_commission_id);
create index patient_safety_event_case_idx on public.patient_safety_event (case_id);
create index patient_safety_event_status_idx on public.patient_safety_event (status);

comment on table public.patient_safety_event is
  'Patient-safety event GOVERNANCE METADATA — no patient identifiers (those are '
  'isolated on public.event_patient, B3). current_owner_* is the denormalized head '
  'of the public.event_custody ledger and drives access-follows-custody RLS (ADR 0031).';
comment on column public.patient_safety_event.description_md is
  'Reporter narrative — SANITIZED Markdown (Rule 7). Clinical free text; NEVER copied '
  'into the audit log (Rule 11).';

-- ===========================================================================
-- app.is_pqs_member(uid) -> boolean    (the NSP access helper)
-- ===========================================================================
-- The NSP-side authority for RLS + the DEFINER reads (pqs_inbox). Returns
-- app.is_admin_for(uid) TODAY, but is written as an OR so a future pqs_members table
-- ORs in with NO RLS rewrite — the single seam ADR 0030 anticipates. uid-pure
-- (SECURITY DEFINER, takes the uid) so pgTAP can assert it per-user; the B3 policies
-- also OR app.is_admin() alongside it for the live JWT-claim admin path (the
-- interviews lesson — a current-session admin authenticated via the claim, with no
-- profiles flag, is still permitted).
create function app.is_pqs_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- Today: PQS membership == platform admin. When a real public.pqs_members table
  -- lands, OR an `exists (select 1 from public.pqs_members where user_id = p_user_id)`
  -- term here — no policy change needed (ADR 0030/0031).
  select app.is_admin_for(p_user_id);
$$;

revoke all on function app.is_pqs_member(uuid) from public;
grant execute on function app.is_pqs_member(uuid) to authenticated, service_role;

-- ===========================================================================
-- app.commission_of_event(event_id) -> uuid    (RLS resolver — provenance commission)
-- ===========================================================================
-- Resolves the REPORTING commission of an event for child-table RLS / DEFINER reads,
-- regardless of the caller's RLS. Mirrors commission_of_meeting / commission_of_case.
-- (The custody-aware access predicate needs BOTH the reporting commission AND the
-- current-owner commission; B3's policies read the event row's columns directly for
-- the owner side and use this for provenance where a child table can't see them.)
create function app.commission_of_event(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select reporting_commission_id from public.patient_safety_event where id = p_event_id;
$$;

revoke all on function app.commission_of_event(uuid) from public;
grant execute on function app.commission_of_event(uuid) to authenticated, service_role;

-- ===========================================================================
-- Event-code minting — per-NSP (platform-wide) counter
-- ===========================================================================
-- BEFORE INSERT on patient_safety_event. Advisory-lock copy of app.mint_meeting_number,
-- but the chain is GLOBAL (one NSP), so the lock key is a fixed string, not the
-- commission id: pg_advisory_xact_lock(hashtextextended('pqs:event_code', 0)) —
-- serialized across the whole platform's event inserts, which is correct for a single
-- NSP. Format EV-%04d (zero-padded), backstopped by unique(code); notify_safety_event
-- adds the one-shot unique_violation retry on top.
create function app.mint_event_code()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('pqs:event_code', 0));

  -- Highest existing EV-#### suffix + 1 (substring after the 'EV-' prefix).
  v_next := coalesce(
    (select max((substring(code from 4))::integer)
     from public.patient_safety_event
     where code ~ '^EV-[0-9]+$'),
    0
  ) + 1;

  new.code := 'EV-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

create trigger mint_event_code_trg
  before insert on public.patient_safety_event
  for each row execute function app.mint_event_code();

-- ===========================================================================
-- Event lifecycle state-machine + freeze guard
-- ===========================================================================
-- Mirrors guard_meeting_status / guard_interview_status. Every legitimate mutation
-- happens inside a B4 RPC that sets app.in_safety_rpc = 'on'; a DIRECT client
-- UPDATE/DELETE (even one RLS would allow) is rejected unless the flag is on. This
-- funnels every status change AND every locked-content edit through the vetted RPCs.
--
-- Legal transitions (only under app.in_safety_rpc):
--   reported     -> acknowledged | cancelled
--   acknowledged -> triaged | cancelled
--   triaged      -> closed | acknowledged (reopen-triage, 14b) | cancelled
--   closed / cancelled are TERMINAL.
-- (acknowledged -> closed is allowed for a non-PSE disposition that closes without an
--  RCA; the 14b triage RPC drives that. 14a's RPCs only reach reported->acknowledged
--  and ->cancelled, but the machine is defined fully here so 14b adds no guard churn.)
--
-- Freeze-at-triaged: once status reaches 'triaged' (rank 3) the governance content is
-- frozen except under the flag — 14b's confirm-triage locks the worksheet + the event;
-- reopen-triage (triaged -> acknowledged) unlocks. 14a only RESERVES the rank; no 14a
-- path edits a triaged event.
create function app.guard_event_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
  v_locked_rank constant int := 3;  -- triaged and beyond are "locked"
  v_old_rank int;
begin
  v_old_rank := case old.status
    when 'reported' then 1
    when 'acknowledged' then 2
    when 'triaged' then 3
    when 'closed' then 4
    when 'cancelled' then 4
    else 0
  end;

  if tg_op = 'DELETE' then
    -- A triaged/closed/cancelled event cannot be deleted outside an RPC. (A commission
    -- cascade cannot reach this table — the FKs are ON DELETE NO ACTION / SET NULL.)
    if not v_in_rpc and old.status in ('triaged', 'closed', 'cancelled') then
      raise exception 'eventos triados ou encerrados não podem ser excluídos'
        using errcode = 'HC043';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado do evento devem passar pelas RPCs do NSP'
        using errcode = 'HC043';
    end if;

    if not (
      (old.status = 'reported' and new.status in ('acknowledged', 'cancelled'))
      or (old.status = 'acknowledged' and new.status in ('triaged', 'closed', 'cancelled'))
      or (old.status = 'triaged' and new.status in ('closed', 'acknowledged', 'cancelled'))
    ) then
      raise exception 'transição de estado de evento inválida: % -> %', old.status, new.status
        using errcode = 'HC043';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED event (>= triaged).
  if v_in_rpc then
    return new;
  end if;

  if v_old_rank >= v_locked_rank then
    raise exception 'eventos a partir de "triado" são imutáveis (edição bloqueada)'
      using errcode = 'HC043';
  end if;

  return new;
end;
$$;

create trigger guard_event_status_trg
  before update or delete on public.patient_safety_event
  for each row execute function app.guard_event_status();

-- ===========================================================================
-- case_events.kind — widen to add 'safety_event'  (Phase-12 timeline integration)
-- ===========================================================================
-- Mirror the Phase-11 'interview' widening (…091000). A case-linked event writes a
-- case_events row (notify_safety_event, B4) so it appears on the Phase-12 case
-- timeline. The constraint name is the inline-CHECK default confirmed in the live DB.
alter table public.case_events drop constraint case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check
  check (kind in ('note', 'meeting', 'decision', 'interview', 'safety_event', 'other'));

-- ===========================================================================
-- Feature flag — patient_safety (default OFF)
-- ===========================================================================
-- Every Phase-14 RPC gates app.assert_patient_safety_enabled() at entry, and the
-- TS layer gates public.patient_safety_enabled(); the feature is dark until the
-- one-line ON flip ships at the END of B4 (mirroring the meetings/interviews flip).
-- A single umbrella flag covers 14a–14d (ADR 0030 — supersedes the reserved `capa`).
insert into app.feature_flags (key, enabled, description) values
  ('patient_safety', false,
   'When true, the Patient-Safety / NSP module (event intake & hand-off with isolated '
   || 'PHI + a custody ledger [14a], triage [14b], RCA [14c], CAPA [14d]) is live: the '
   || 'notify/acknowledge/transfer/PHI RPCs run, the access-follows-custody RLS + PHI '
   || 'isolation apply, and PHI reads emit .read audit rows (Rule 12). Enabled at Phase '
   || '14a completion; the single umbrella flag for all of Phase 14 (ADR 0030).');

-- app.assert_patient_safety_enabled() — shared RPC entry gate (mirror
-- assert_meetings_enabled). check_violation (23514) maps to a generic "feature
-- unavailable" in the data layer.
create function app.assert_patient_safety_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('patient_safety') then
    raise exception 'o módulo de segurança do paciente não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_patient_safety_enabled() from public;
grant execute on function app.assert_patient_safety_enabled() to authenticated, service_role;

-- public.patient_safety_enabled() — TS-layer gate. Thin SECURITY DEFINER boolean
-- read of the flag (which lives in the locked-down app schema, invisible to
-- PostgREST). Mirrors public.meetings_enabled / public.audit_trail_enabled.
create function public.patient_safety_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('patient_safety');
$$;

grant execute on function public.patient_safety_enabled() to authenticated, service_role;
revoke all on function public.patient_safety_enabled() from public, anon;

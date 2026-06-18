-- Phase 13 / B2: Audit Trail — CORE table, hash-chain writer, append-only guard,
-- feature flag. Establishes Architecture Rule 11 (auditability). ADR 0029.
--
-- The platform needs a system-wide, APPEND-ONLY, TAMPER-EVIDENT record of who did
-- what to which entity, when — the data-integrity backbone (ALCOA+) that JCI MOI
-- and ONA score, and the cross-cutting contract every later track phase honors.
--
-- NO patient data (Rule 1 + Rule 11): a row records the ACTOR + the ACTION
-- (`<entity>.<verb>`) + the entity reference + a SHORT pt-BR summary + a curated
-- old->new diff over a NON-SENSITIVE column allow-list. It NEVER stores answer
-- payloads, `*_md`/free-text/Markdown bodies, or any clinical content.
--
-- This migration (B2) lands the core only:
--   * public.audit_log — the append-only, hash-chained log.
--   * app.jsonb_canonical(jsonb) — deterministic, key-sorted jsonb serializer so
--     the writer and verify_audit_chain (B4) hash byte-identically.
--   * app.audit_write(...) — the single SECURITY DEFINER writer: advisory-locked
--     per chain (per-commission + a dedicated global chain), computes seq = prev+1
--     and the sha256 row_hash, attributes auth.uid() with a system (null) fallback,
--     snapshots actor_is_admin.
--   * app.guard_audit_immutable — BEFORE UPDATE OR DELETE → HC042, ABSOLUTE (even
--     the service role cannot mutate or delete an audit row; there is no
--     legitimate UPDATE/DELETE path anywhere).
--   * the audit_trail feature flag (default OFF) + app.assert_audit_enabled()
--     (RPC gate) + public.audit_trail_enabled() (TS-layer gate, mirror
--     public.meetings_enabled).
--
-- Instrumentation triggers (B3), RLS + verify_audit_chain (B4), and the ON flip
-- (B4 tail) land separately.
--
-- New SQLSTATE (user-defined HC0xx class; the accreditation track starts at HC042
-- per ADR 0028):
--   HC042 append-only violation (INTERNAL — never surfaced to the UI).

-- ===========================================================================
-- public.audit_log — the append-only, hash-chained record
-- ===========================================================================
-- chains: one per commission_id, plus a SEPARATE GLOBAL chain for the rows whose
-- commission_id IS NULL (admin / system / cross-commission actions). `seq` is a
-- per-chain monotone counter (max+1 under an advisory lock — the case/meeting
-- mint pattern; a real Postgres sequence cannot be per-commission).
--
-- Tamper-evidence: row_hash = sha256(coalesce(prev_hash,'') || canonical(row))
-- where canonical commits to EVERY semantic column except id (random), prev_hash,
-- and row_hash itself (ADR 0029 Q3). prev_hash is the previous row's row_hash on
-- the same chain (NULL for the chain's first row).
--
-- actor_id -> profiles is safe (profiles are NEVER deleted — Rule 2). commission_id
-- is ON DELETE NO ACTION (RESTRICT): commissions are archived, not dropped (there
-- is no deleteCommission action), so the trail is genuinely ENDURING and a
-- commission cannot be hard-deleted out from under its audit history (ADR 0029 Q5).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  -- commissions are archived, not dropped; audit rows are never deleted.
  commission_id uuid references public.commissions (id) on delete no action,
  actor_id uuid references public.profiles (id),
  actor_is_admin boolean not null default false,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  seq bigint not null,
  prev_hash text,
  row_hash text not null,
  constraint audit_log_action_shape check (position('.' in action) > 1),
  constraint audit_log_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_log_summary_not_blank check (btrim(summary) <> ''),
  constraint audit_log_seq_positive check (seq >= 1)
);

alter table public.audit_log enable row level security;

-- Per-commission monotone seq: unique within a commission's chain.
create unique index audit_log_commission_seq_key
  on public.audit_log (commission_id, seq)
  where commission_id is not null;
-- Global chain monotone seq: unique among commission_id IS NULL rows.
create unique index audit_log_global_seq_key
  on public.audit_log (seq)
  where commission_id is null;

-- Primary list/filter: a commission's timeline, newest-first.
create index audit_log_commission_occurred_idx
  on public.audit_log (commission_id, occurred_at desc);
-- Filter dropdowns.
create index audit_log_actor_idx on public.audit_log (commission_id, actor_id);
create index audit_log_action_idx on public.audit_log (commission_id, action);
-- Entity drill-down (cross-commission, e.g. an admin tracing one entity).
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

comment on column public.audit_log.commission_id is
  'NULL = the global chain (admin/system/cross-commission). ON DELETE NO ACTION: '
  'commissions are archived, not dropped; audit rows are never deleted (ADR 0029).';
comment on column public.audit_log.metadata is
  'Curated old->new diff over a NON-SENSITIVE column allow-list ONLY. NEVER '
  'answer payloads or *_md/free-text/Markdown bodies (Rule 1 + Rule 11).';

-- ===========================================================================
-- app.jsonb_canonical(jsonb) -> text    (deterministic serializer)
-- ===========================================================================
-- Recursively serializes a jsonb value with OBJECT KEYS SORTED, so the same
-- logical metadata always produces the same byte string. The writer and
-- verify_audit_chain (B4) both call this, guaranteeing a byte-identical recompute.
-- Postgres jsonb already dedupes keys + drops insignificant whitespace, but does
-- not guarantee a stable key ORDER across `::text`, hence this sorter.
--
-- IMMUTABLE + no I/O so it is safe to reuse in both the write and verify paths.
-- PL/pgSQL (not SQL) so each jsonb_typeof branch is evaluated in isolation — a
-- SQL-language `case ... from lateral jsonb_each(...)` couples the scalar branch
-- to a join that yields zero rows for scalars (returning NULL instead of the
-- scalar). Objects: keys sorted; arrays: element order preserved; scalars: jsonb's
-- own canonical text form.
create function app.jsonb_canonical(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = app, pg_catalog
as $$
declare
  v_type text := jsonb_typeof(p_value);
begin
  if p_value is null or v_type = 'null' then
    return 'null';
  elsif v_type = 'object' then
    return '{' || coalesce((
      select string_agg(to_json(kv.key)::text || ':' || app.jsonb_canonical(kv.value), ','
                        order by kv.key)
      from jsonb_each(p_value) as kv(key, value)
    ), '') || '}';
  elsif v_type = 'array' then
    return '[' || coalesce((
      select string_agg(app.jsonb_canonical(elem), ',' order by ord)
      from jsonb_array_elements(p_value) with ordinality as a(elem, ord)
    ), '') || ']';
  else
    -- string / number / boolean — jsonb's text form is already canonical.
    return p_value::text;
  end if;
end;
$$;

revoke all on function app.jsonb_canonical(jsonb) from public;
grant execute on function app.jsonb_canonical(jsonb) to authenticated, service_role;

-- ===========================================================================
-- app.audit_canonical(...) -> text    (the row's canonical hash input)
-- ===========================================================================
-- The EXACT serialization row_hash commits to (ADR 0029 Q3): every semantic
-- column except id / prev_hash / row_hash, joined by U+001E (a control char that
-- cannot appear in our values). occurred_at is rendered in UTC with microsecond
-- precision so it is stable regardless of the session TimeZone. A NULL actor /
-- commission renders as the empty string. verify_audit_chain reuses this fn.
create function app.audit_canonical(
  p_seq bigint,
  p_occurred_at timestamptz,
  p_actor_id uuid,
  p_actor_is_admin boolean,
  p_commission_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_metadata jsonb
)
returns text
language sql
immutable
set search_path = app, pg_catalog
as $$
  select concat_ws(
    chr(30),  -- U+001E record separator
    p_seq::text,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(p_actor_id::text, ''),
    case when p_actor_is_admin then 'true' else 'false' end,
    coalesce(p_commission_id::text, ''),
    p_action,
    p_entity_type,
    p_entity_id::text,
    p_summary,
    app.jsonb_canonical(p_metadata)
  );
$$;

revoke all on function app.audit_canonical(bigint, timestamptz, uuid, boolean, uuid, text, text, uuid, text, jsonb) from public;
grant execute on function app.audit_canonical(bigint, timestamptz, uuid, boolean, uuid, text, text, uuid, text, jsonb) to authenticated, service_role;

-- ===========================================================================
-- app.audit_write(...) — the single hash-chain writer (DEFINER)
-- ===========================================================================
-- The ONLY way a row enters audit_log. SECURITY DEFINER so it can insert under
-- the no-write RLS and so the instrumentation triggers (B3) and the explicit
-- .read/.export call sites (B5) can all reach it. Advisory-locked per CHAIN:
--   * a per-commission key for commission-scoped actions,
--   * a dedicated global key for commission_id IS NULL,
-- via pg_advisory_xact_lock(hashtextextended('audit:'||key, 0)) — parallel ACROSS
-- chains, serial WITHIN one — so seq + the hash are computed against a stable tail
-- (identical concurrency reasoning to app.mint_meeting_number).
--
-- Actor attribution: auth.uid() when present; NULL = the SYSTEM fallback (a
-- service-role / out-of-band write). actor_is_admin snapshots app.is_admin() (only
-- meaningful when an actor is present).
--
-- No-op when the audit_trail flag is OFF, so the log stays empty until the in-phase
-- flip — the instrumentation triggers call this unconditionally and rely on this
-- gate (keeps the chain starting cleanly at flip; ADR 0029 §9).
create function app.audit_write(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_commission uuid,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_seq bigint;
  v_prev_hash text;
  v_occurred timestamptz := now();
  v_lock_key text;
  v_row_hash text;
begin
  -- Dark until the feature is ON (the chain starts cleanly at the in-phase flip).
  if not app.feature_enabled('audit_trail') then
    return;
  end if;

  if v_actor is not null then
    v_actor_is_admin := coalesce(app.is_admin(), false);
  end if;

  -- Serialize this CHAIN (per-commission, or the global chain).
  v_lock_key := 'audit:' || coalesce(p_commission::text, '__global__');
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- The chain tail: highest seq + its row_hash. `is not distinct from` matches the
  -- NULL (global) chain correctly.
  select seq, row_hash into v_seq, v_prev_hash
  from public.audit_log
  where commission_id is not distinct from p_commission
  order by seq desc
  limit 1;

  v_seq := coalesce(v_seq, 0) + 1;  -- v_prev_hash stays NULL for the first row.

  v_row_hash := encode(
    extensions.digest(
      coalesce(v_prev_hash, '') || app.audit_canonical(
        v_seq, v_occurred, v_actor, v_actor_is_admin, p_commission,
        p_action, p_entity_type, p_entity_id, p_summary,
        coalesce(p_metadata, '{}'::jsonb)
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_log (
    occurred_at, commission_id, actor_id, actor_is_admin,
    action, entity_type, entity_id, summary, metadata,
    seq, prev_hash, row_hash
  ) values (
    v_occurred, p_commission, v_actor, v_actor_is_admin,
    p_action, p_entity_type, p_entity_id, p_summary,
    coalesce(p_metadata, '{}'::jsonb),
    v_seq, v_prev_hash, v_row_hash
  );
end;
$$;

revoke all on function app.audit_write(text, text, uuid, uuid, text, jsonb) from public;
grant execute on function app.audit_write(text, text, uuid, uuid, text, jsonb) to authenticated, service_role;

-- ===========================================================================
-- app.guard_audit_immutable — append-only enforcement (ABSOLUTE)
-- ===========================================================================
-- BEFORE UPDATE OR DELETE on audit_log → HC042, with NO escape (unlike the
-- meetings guard, there is no legitimate update/delete path, so there is no rpc
-- flag). The commission FK is ON DELETE NO ACTION, so a commission cascade can
-- never trigger a DELETE here either. SECURITY DEFINER is unnecessary (a BEFORE
-- trigger runs regardless of the writer's privileges) — the point is that this
-- fires for EVERY role including service_role.
create function app.guard_audit_immutable()
returns trigger
language plpgsql
set search_path = app, pg_catalog
as $$
begin
  raise exception 'os registros de auditoria são imutáveis (somente inserção)'
    using errcode = 'HC042';
end;
$$;

create trigger guard_audit_immutable_trg
  before update or delete on public.audit_log
  for each row execute function app.guard_audit_immutable();

-- ===========================================================================
-- Feature flag — audit_trail (default OFF)
-- ===========================================================================
-- The writer no-ops while OFF and every audit RPC gates app.assert_audit_enabled();
-- the one-line ON flip ships at the END of Phase 13 (B4 tail), mirroring the
-- meetings / interviews pattern. Tests flip it ON for the duration.
insert into app.feature_flags (key, enabled, description) values
  ('audit_trail', false,
   'When true, the append-only tamper-evident audit trail is live: every '
   || 'instrumented mutation emits one hash-chained audit_log row, sensitive '
   || 'foreign reads/exports emit .read/.export rows, and verify_audit_chain '
   || 'checks integrity. Enabled at Phase 13 completion (Architecture Rule 11).');

-- app.assert_audit_enabled() — shared RPC entry gate (mirror assert_meetings_enabled).
create function app.assert_audit_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('audit_trail') then
    raise exception 'a trilha de auditoria não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_audit_enabled() from public;
grant execute on function app.assert_audit_enabled() to authenticated, service_role;

-- public.audit_trail_enabled() — TS-layer gate (mirror public.meetings_enabled).
create function public.audit_trail_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('audit_trail');
$$;

grant execute on function public.audit_trail_enabled() to authenticated, service_role;
revoke all on function public.audit_trail_enabled() from public, anon;

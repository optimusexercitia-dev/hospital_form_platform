-- ----------------------------------------------------------------------------
-- Consolidated baseline — anon/PUBLIC privilege revocation (B6 end-state)
-- ----------------------------------------------------------------------------
-- The Supabase local stack auto-grants every newly-created public table and
-- function to anon/authenticated/service_role at creation time. The original
-- migration history reached a hardened end-state by revoking those (Phase 8 B6,
-- migrations 090012/090013/090014) plus an explicit hook lockdown in identity
-- (100002). pg_dump does NOT re-emit those revocations (a revoked-from-default
-- ACL on a public object serializes as "no statement"), so a dump-derived
-- baseline silently re-exposes anon. This file re-asserts the exact B6 posture
-- as the LAST step of the baseline so the squashed schema is privilege-identical
-- to the pre-squash history:
--   * anon has ZERO DML on public tables/sequences and ZERO EXECUTE on public
--     functions (RLS already denies anon at the row level; this is defense in
--     depth — Phase 1 QA INFO-1 / Phase 8 B6).
--   * the implicit EXECUTE-to-PUBLIC on public functions is revoked (anon
--     inherits PUBLIC), and default privileges are altered so future objects do
--     not re-leak.
--   * authenticated + service_role keep their explicit grants (emitted in the
--     domain files), so every authenticated path is unaffected.
-- The auth.users access-token hook (custom_access_token_hook) is locked to
-- supabase_auth_admin only (GoTrue runs it); anon/authenticated/public are
-- revoked, matching identity migration 100002.

-- --- B6: revoke anon DML/EXECUTE on the public schema (090012) -------------
revoke all privileges on all tables    in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;

-- anon inherits EXECUTE on public functions through the PUBLIC pseudo-role;
-- revoke that too (090012/090014).
revoke execute on all functions in schema public from public;

-- Future objects in public must not auto-grant to anon or PUBLIC (090012/090014).
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- --- access-token hook lockdown (identity 100002) -------------------------
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- --- WS A: event_patient is fully RPC-only (no direct authenticated DML) -----
-- The isolated PHI identifier table must carry ZERO direct `authenticated` DML.
-- Reads go through the audited public.get_event_patient RPC; writes through the
-- public.set_event_patient DEFINER (runs as owner `postgres`) and seeds run as
-- superuser — so revoking SELECT/INSERT/UPDATE/DELETE/etc. from authenticated
-- breaks nothing legitimate and removes the auto-exposed direct-write grants that
-- have no caller. service_role is left intact. RLS already denies anon.
revoke all privileges on table public.event_patient from authenticated;

-- ===========================================================================
-- Phase 8 — B6(a): revoke anon DML/EXECUTE on the public schema (defense in depth)
-- ===========================================================================
-- Supabase's platform bootstrap grants the `anon` role broad privileges on the
-- public schema: full DML (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES) on
-- every table and EXECUTE on every function (the default `GRANT ... TO anon`).
-- RLS already denies anon at the row level (deny-by-default; no anon policies),
-- and every RPC is auth.uid()-scoped, so anon can do nothing useful TODAY — but
-- relying on RLS alone is a single line of defense. This revokes the unused
-- privileges so an unauthenticated caller cannot even reach the tables/functions
-- (Phase 1 QA INFO-1).
--
-- SCOPE: strictly the `public` schema. The unauthenticated login/auth path runs
-- through GoTrue (the `auth` schema + /auth/v1), NOT through public DML/EXECUTE,
-- so login is unaffected. The platform-owned `auth`, `storage` (public-bucket
-- reads), `realtime`, and `supabase_functions` schemas keep their own anon
-- grants — they are NOT touched here. The `app` schema is already inaccessible
-- to anon (usage on schema app was revoked from public in
-- 20260612100001_extensions_and_app_schema.sql).
--
-- `authenticated` and `service_role` grants are untouched.
-- ===========================================================================

revoke all privileges on all tables    in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;

-- Postgres grants EXECUTE on every newly-created function to the PUBLIC
-- pseudo-role by default, and `anon` inherits it through PUBLIC — so revoking
-- from `anon` alone leaves anon able to EXECUTE our RPCs (verified: anon could
-- still reach submit_response via PUBLIC). Revoke the implicit PUBLIC grant too.
-- Our RPCs are explicitly granted to authenticated + service_role (so they keep
-- working), and trigger functions are invoked by the trigger mechanism (not via
-- a caller EXECUTE grant), so this does not break any authenticated path. After
-- this, anon has NO way to reach a public function.
revoke execute on all functions in schema public from public;

-- Future objects created in public should not auto-grant to anon either. The
-- default privileges are altered for the roles that have historically created
-- public objects (postgres + supabase_admin); the explicit form keeps this
-- deterministic regardless of who runs a later migration.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- And the default EXECUTE-to-PUBLIC on future functions, so a later migration
-- that forgets to revoke does not silently re-expose anon. (Future functions
-- still get their explicit `grant execute ... to authenticated, service_role`.)
alter default privileges in schema public revoke execute on functions from public;

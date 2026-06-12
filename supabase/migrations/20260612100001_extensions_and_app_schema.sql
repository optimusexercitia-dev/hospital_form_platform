-- Phase 1 / M1: Extensions, the internal `app` schema, and feature flags.
--
-- The `app` schema holds internal helper functions (security-definer RLS
-- helpers in a later migration, the condition evaluator, the feature-flag
-- reader). Keeping them out of `public` avoids exposing them as PostgREST RPCs
-- and keeps the public surface limited to the RPCs the frontend genuinely calls.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;

-- Lock down the helper schema: only the privileged roles may resolve objects in
-- it. RLS-helper functions are SECURITY DEFINER and granted to authenticated
-- explicitly where needed; this prevents anon/authenticated from probing
-- internal helpers they were not granted.
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------
-- A tiny key/value table the backend reads to gate behaviour across phases.
-- The only flag in Phase 1 is `signoff_enforcement`, which the submit_response
-- RPC consults; it stays OFF until a one-line Phase 6 migration flips it on.
-- See docs/decisions/0004-signoff-feature-flag.md.
create table app.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text
);

insert into app.feature_flags (key, enabled, description) values
  ('signoff_enforcement', false,
   'When true, submit_response requires a sign-off row for every visible '
   || 'requires_signoff section. Enabled in Phase 6.');

-- SECURITY DEFINER so RLS/ownership on app.feature_flags never blocks the
-- check, and so the table itself stays invisible to the data API.
create function app.feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = app, pg_catalog
as $$
  select coalesce((select enabled from app.feature_flags where key = p_key), false);
$$;

revoke all on function app.feature_enabled(text) from public;
grant execute on function app.feature_enabled(text) to authenticated, service_role;

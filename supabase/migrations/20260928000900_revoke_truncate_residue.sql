-- Revoke the TRUNCATE residue from the client roles (FUP-PCITV-1 item 3).
--
-- WHY. `TRUNCATE` bypasses RLS entirely, so a role holding it is outside Architecture
-- Rule 1's security boundary. It ALSO bypasses `storage.protect_delete` and every other
-- statement-level `AFTER DELETE` guard, because TRUNCATE does not fire DELETE triggers
-- (measured 2026-08-18: a bare DELETE on storage.objects raises 42501, a TRUNCATE
-- succeeds and leaves the bytes on disk as orphans). So the blast radius of this grant
-- is not "rows lost, restorable" — for storage it is "every byte in every bucket
-- orphaned", and by the Cloud orphan probe of the same day those bytes are then
-- unobservable on Cloud forever. See docs/progress/cloud-orphan-probe-2026-08-18.md.
--
-- `20260711000100_grant_hardening.sql` flipped the DEFAULT so new tables grant the
-- client roles nothing (pinned by pgTAP 191 §2, verified again here: a fresh table gives
-- neither anon nor authenticated TRUNCATE). It did not sweep the tables that already
-- existed. This is that sweep — the "residue" FUP-PCITV-1 item 3 asked to be "swept or
-- accepted in writing, not left implicit".
--
-- BOUNDED BY OWNERSHIP, NOT BY A SCHEMA NAME LIST. The set is derived from the catalog
-- as "tables we own", so a table added to a new first-party schema is inside the sweep
-- automatically. A name list is a syntax; ownership is the property.
--
-- ⛔ WHAT THIS DELIBERATELY DOES NOT TOUCH — and it is the half that matters most.
-- `storage.objects` / `storage.buckets` / `storage.buckets_analytics` (owner
-- `supabase_storage_admin`) and the `net` tables (owner `supabase_admin`) also grant
-- TRUNCATE to anon and authenticated. **We cannot revoke them**, and the way that fails
-- is the trap: on Cloud, `revoke truncate on storage.objects from authenticated` returns
-- with NO ERROR and changes NOTHING (measured: privilege `t` -> `t`; the same statement
-- against a public table went `t` -> `f`). Postgres does not error when the caller is
-- not entitled to revoke — it warns and no-ops. A migration that swept "everywhere it
-- could" would therefore go green on `db push` having hardened nothing, and be recorded
-- as complete. It would also diverge local-vs-Cloud, since a local superuser CAN revoke
-- there. So the scope is the deterministic, first-party one, and the platform residue is
-- ACCEPTED IN WRITING in docs/progress/follow-ups.md (FUP-PCITV-1 item 3) instead of
-- being silently half-attempted.
--
-- Not reachable today either way: PostgREST exposes no TRUNCATE verb, and anon /
-- authenticated / service_role are all NOLOGIN roles, so an API key is not a database
-- credential. This is defense in depth, closing a gap that only ever needed one
-- direct-connection mistake to matter.
--
-- service_role KEEPS TRUNCATE, deliberately: it is the trusted server-only role that
-- already bypasses RLS by design, and anything holding that key can delete everything
-- through the Storage/PostgREST API regardless. Revoking there would be a functional
-- change to admin tooling for no reachability gain.

do $$
declare
  r record;
  revoked int := 0;
  remaining int;
  residue text;
begin
  for r in
    select c.oid::regclass as tbl
    from pg_class c
    where c.relkind in ('r', 'p')
      and c.relpersistence <> 't'
      and c.relowner = 'postgres'::regrole
      and (has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
  loop
    execute format('revoke truncate on %s from anon, authenticated', r.tbl);
    revoked := revoked + 1;
  end loop;

  -- VERIFY THE EFFECT, NOT THE ABSENCE OF AN ERROR. Counting executed statements would
  -- report success even where every REVOKE silently no-opped (see the storage note
  -- above). Re-derive the set from the catalog and require it to be empty.
  select count(*) into remaining
  from pg_class c
  where c.relkind in ('r', 'p')
    and c.relpersistence <> 't'
    and c.relowner = 'postgres'::regrole
    and (has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE'));

  if remaining <> 0 then
    raise exception
      'TRUNCATE residue survived the sweep on % postgres-owned table(s) — the REVOKE ran but did not take effect',
      remaining;
  end if;

  select coalesce(string_agg(distinct n.nspname, ', ' order by n.nspname), '(none)')
    into residue
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and c.relpersistence <> 't'
    and c.relowner <> 'postgres'::regrole
    and (has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE'));

  raise notice 'TRUNCATE revoked from anon/authenticated on % first-party table(s); 0 remain.', revoked;
  raise notice 'Platform-owned residue we cannot revoke (accepted in writing): schema(s) %', residue;
end $$;

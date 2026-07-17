-- Stage-C systemic guard (the real lesson of the get_reserved_session_items defect):
-- an audited PHI-read door writes an audit_log row (log_audit_access → audit_write →
-- INSERT). PostgREST runs STABLE/IMMUTABLE functions in a READ-ONLY transaction even over
-- rpc/POST, so such a door MUST be VOLATILE or it raises SQLSTATE 25006 at runtime.
--
-- ⛔ pgTAP itself runs in a read-WRITE transaction, so it CANNOT reproduce 25006 (the
-- audit INSERT succeeds here while failing under PostgREST — this is why 112 behavioural
-- keystones missed it). The only defence is a CATALOG INVARIANT: no STABLE/IMMUTABLE
-- function may contain an audit-write call. This keystone is mutation-falsifiable —
-- re-marking any audited-read RPC STABLE fails t1 — and it catches every FUTURE audited
-- read door that forgets VOLATILE.

begin;
select plan(3);

-- t1 — THE GUARD: zero STABLE/IMMUTABLE functions in public/app call an audit-writer.
select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prokind = 'f'
     and n.nspname in ('public', 'app')
     and p.provolatile in ('s', 'i')
     and pg_get_functiondef(p.oid) ~* 'log_audit_access\s*\(|audit_write\s*\('),
  0,
  'GUARD ⭐: no STABLE/IMMUTABLE function writes an audit row (else it raises 25006 under PostgREST''s read-only tx)');

-- t2 — the specific fix landed: the offending door is now VOLATILE.
select is(
  (select p.provolatile
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_reserved_session_items'),
  'v',
  'FIX ⭐: get_reserved_session_items is VOLATILE (its meeting.viewed audit INSERT can run over rpc/POST)');

-- t3 — NON-VACUITY: the same regex DOES find the audited-read doors among VOLATILE
-- functions, so t1''s zero is a real invariant, not a broken pattern matching nothing.
select cmp_ok(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prokind = 'f'
     and n.nspname in ('public', 'app')
     and p.provolatile = 'v'
     and pg_get_functiondef(p.oid) ~* 'log_audit_access\s*\(|audit_write\s*\('),
  '>=', 3,
  'NON-VACUITY ⭐: the audit-writer regex matches the known VOLATILE audited doors (get_case_patients / get_referral_patient / get_reserved_session_items …) — the guard is meaningful');

select * from finish();
rollback;

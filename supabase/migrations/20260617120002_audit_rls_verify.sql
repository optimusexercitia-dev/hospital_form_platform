-- Phase 13 / B4: Audit Trail — RLS + verify_audit_chain DEFINER RPC. ADR 0029.
--
-- RLS is the security boundary (Rule 1). audit_log had RLS ENABLED at creation
-- (…120000) and is deny-by-default; this migration adds the ONLY policy: a SELECT
-- for admins (all rows) OR the staff_admin of the row's commission (their own
-- commission's rows). There is DELIBERATELY no INSERT/UPDATE/DELETE policy for
-- anyone — writes happen only through the app.audit_write DEFINER writer, and the
-- app.guard_audit_immutable trigger (…120000) backstops UPD/DEL with HC042.
--
-- NOTE the read shape is STAFF_ADMIN, not member (unlike meetings' member-read):
-- the audit trail is a governance/oversight surface, so plain `staff` get NOTHING.
-- Global-chain rows (commission_id IS NULL) are admin-only automatically, since
-- is_staff_admin_of(NULL) is false. list_audit is served by this RLS-scoped SELECT
-- (no RPC) — the query layer reads audit_log through the cookie client.

-- ===========================================================================
-- audit_log — SELECT only: admin (all) OR staff_admin of the row's commission
-- ===========================================================================
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (app.is_admin() or app.is_staff_admin_of(commission_id));

-- No INSERT/UPDATE/DELETE policy is created on purpose. The table stays
-- deny-by-default for every write; only the SECURITY DEFINER writer inserts.

-- ===========================================================================
-- public.verify_audit_chain(p_commission uuid default null) -> table(ok, broken_seq)
-- ===========================================================================
-- Recomputes the hash chain and reports integrity. DEFINER because it must read
-- the FULL chain (including rows an RLS-scoped caller might be edge-cased away
-- from) to recompute byte-identically; internally GATED so it never leaks:
--   * p_commission given  -> caller must be is_staff_admin_of(p_commission) or admin;
--                            verifies that ONE commission's chain.
--   * p_commission NULL   -> ADMIN ONLY; verifies the global chain AND every
--                            per-commission chain (the cross-commission integrity
--                            sweep for /admin/audit).
-- Returns a single row: (ok boolean, broken_seq bigint). ok=true / broken_seq=null
-- when intact; ok=false / broken_seq=<first bad seq> at the first row whose stored
-- row_hash disagrees with the recompute OR whose prev_hash breaks the link. The
-- recompute reuses app.audit_canonical byte-for-byte (the write path's serializer).
create function public.verify_audit_chain(p_commission uuid default null)
returns table (ok boolean, broken_seq bigint)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_rec record;
  v_prev_hash text;
  v_expected text;
  v_chain uuid;
begin
  perform app.assert_audit_enabled();

  -- Authorization.
  if p_commission is null then
    if not app.is_admin() then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  else
    if not (app.is_admin() or app.is_staff_admin_of(p_commission)) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  end if;

  -- Build the set of chains to verify. For a single commission, just that chain.
  -- For the admin sweep (NULL), the global chain (NULL) plus every commission
  -- that has at least one audit row.
  for v_chain in
    select c from (
      select p_commission as c where p_commission is not null
      union all
      select null::uuid where p_commission is null
      union all
      select distinct commission_id from public.audit_log
        where p_commission is null and commission_id is not null
    ) chains
  loop
    v_prev_hash := null;
    for v_rec in
      select * from public.audit_log
      where commission_id is not distinct from v_chain
      order by seq asc
    loop
      v_expected := encode(
        extensions.digest(
          coalesce(v_prev_hash, '') || app.audit_canonical(
            v_rec.seq, v_rec.occurred_at, v_rec.actor_id, v_rec.actor_is_admin,
            v_rec.commission_id, v_rec.action, v_rec.entity_type, v_rec.entity_id,
            v_rec.summary, v_rec.metadata
          ),
          'sha256'
        ),
        'hex'
      );
      -- prev_hash link OR the row hash itself mismatching => tamper at this seq.
      if v_rec.prev_hash is distinct from v_prev_hash or v_rec.row_hash <> v_expected then
        ok := false;
        broken_seq := v_rec.seq;
        return next;
        return;
      end if;
      v_prev_hash := v_rec.row_hash;
    end loop;
  end loop;

  ok := true;
  broken_seq := null;
  return next;
end;
$$;

revoke all on function public.verify_audit_chain(uuid) from public, anon;
grant execute on function public.verify_audit_chain(uuid) to authenticated, service_role;

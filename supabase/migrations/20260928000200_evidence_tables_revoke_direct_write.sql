-- FUP-DM5-GRANTS — make `add_*_evidence` / `delete_*_evidence` the ONLY writers of
-- `rca_evidence` and `capa_action_evidence`.
--
-- ── What was measured (live catalog, 2026-08-17, not read from migration text) ──
--
--   relacl BOTH tables : authenticated=arwdDxtm/postgres   ← every privilege
--   column ACLs        : 0   (so a table-level revoke is COMPLETE — there are no
--                             column grants left behind to re-open the write path;
--                             cf. the case_referral column-grant trap)
--   policies           : *_select (SELECT) + *_write (ALL) — genuinely DISTINCT
--                        predicates, so RLS is a real second lock here, not the
--                        same-predicate-twice trap
--
-- ⚠ CALIBRATION, kept from the follow-up so nobody re-grades this as a breach:
-- this is HARDENING, not an open door. RLS is enabled on both tables and the write
-- policy is `app.can_write_rca(...)` / `app.can_write_capa(...)`, so direct DML was
-- never unauthorized at the ROW level. What direct DML bypassed is the RPC's FLAG
-- GATE and its fail-closed arms — the DM3 QA MAJOR-1 shape, where a gate sits on the
-- last step of a corridor instead of across the corridor.
--
-- ── Where the grant came from (worth recording; it is not a mistake anyone made) ──
--
-- `20260620000000_baseline.sql:22989,23088` — `GRANT ALL ON TABLE ... TO authenticated`,
-- pg_dump output capturing platform state. Postgres ALSO carries
-- `ALTER DEFAULT PRIVILEGES FOR supabase_admin IN SCHEMA public GRANT arwdDxtm TO
-- authenticated`, so ANY table created by `supabase_admin` in `public` starts this
-- way by default. ⭐ That is a standing posture, not a one-off: the narrow idiom this
-- project uses elsewhere (`grant select on public.X to authenticated`,
-- e.g. `20260713000000_controlled_docs_core.sql:319`) only holds where someone
-- remembered to write it. Any NEW table needs its own revoke or it inherits this.
--
-- ⛔ The baseline is an APPLIED migration on the linked remote (measured 2026-08-17:
-- the remote carries everything through 20260927000360). It may NOT be edited in
-- place — that is the drift that blocks `db push`. Hence a new migration.
--
-- SELECT is deliberately KEPT: six measured call sites read these tables directly
-- under RLS — `src/lib/queries/rca.ts:553`, `queries/capa.ts:505`,
-- `safety/capa-actions.ts:501,558`, `safety/rca-actions.ts:592,694` — all `.select()`,
-- zero direct writes. Revoking SELECT would break reads for no security gain, since
-- `*_select` already carries the read predicate.
--
-- Safe for the DEFINER doors, verified rather than assumed: all six writers
-- (`add_rca_evidence`, `delete_rca_evidence`, `add_capa_action_evidence`,
-- `delete_capa_action_evidence`, `dispose_event_phi`, `app.guard_capa_child_lock`)
-- are `prosecdef = t` and OWNED BY `postgres`, which owns both tables and has
-- `relforcerowsecurity = f`. They execute as the owner, so a revoke from
-- `authenticated` cannot reach them.

revoke insert, update, delete, truncate, references, trigger
  on public.rca_evidence from authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.capa_action_evidence from authenticated;

-- ── Self-verification. A grant change is exactly the class that "reads right and
--    fails open": it is invisible to lint, typecheck and every green test bar, and a
--    later DROP+CREATE or a re-dump silently restores it. Assert the END STATE.
do $$
declare
  v_tbl  text;
  v_priv text;
  v_has  boolean;
begin
  foreach v_tbl in array array['public.rca_evidence', 'public.capa_action_evidence'] loop

    -- The write privileges must be GONE.
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE'] loop
      v_has := has_table_privilege('authenticated', v_tbl, v_priv);
      if v_has then
        raise exception
          'FUP-DM5-GRANTS: authenticated still holds % on % after the revoke — '
          'check for a column-level grant or a competing GRANT later in the chain.',
          v_priv, v_tbl;
      end if;
    end loop;

    -- ...and SELECT must SURVIVE. This half is not decoration: revoking too much
    -- would break six read sites, and it would do so at RUNTIME with a 42501 that
    -- no migration-time check would have caught.
    if not has_table_privilege('authenticated', v_tbl, 'SELECT') then
      raise exception
        'FUP-DM5-GRANTS: the revoke removed SELECT on % — the app reads this table '
        'directly under RLS (6 call sites). Only the write privileges may go.', v_tbl;
    end if;

    -- The DEFINER doors must still be able to write. Checked as the OWNER's
    -- privilege, which is what a `security definer` body actually executes with.
    if not has_table_privilege('postgres', v_tbl, 'INSERT') then
      raise exception
        'FUP-DM5-GRANTS: postgres lost INSERT on % — the add_*/delete_* doors run '
        'as the owner and would now fail closed.', v_tbl;
    end if;

  end loop;
end $$;

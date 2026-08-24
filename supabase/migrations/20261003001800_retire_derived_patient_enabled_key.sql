-- =============================================================================
-- ADR 0137 D1 · FUP-0137-PHI-MODE-SHIMS — retire the LAST PHI-mode shim.
--
-- `get_case_detail` has been emitting a DERIVED `patient_enabled` key
-- (`patient_mode <> 'none'`) ever since the boolean columns were dropped in
-- `20261003001400`. It is not a column and never was after that migration; it
-- existed for exactly one reader — the build deployed at the time — and the
-- envelope already carries the real fields beside it (`patient_mode`,
-- `patient_required_fields`).
--
-- ⛔ DEPLOY PRECONDITION, AND IT IS THE WHOLE REASON THIS IS ITS OWN MIGRATION.
-- Apply this ONLY once the ADR 0137 code deploy is CONFIRMED LIVE. While an
-- older build still serves, dropping the key does NOT error — the reader is
-- `?? false`, so every case silently reads as collecting no PHI. A silent
-- wrong answer on a PHI affordance is worse than a 42703, which is why this
-- key outlived the columns it shadowed and why the order here is the REVERSE
-- of the batch's: code first, then schema.
--
-- ⚠ Body is re-emitted from `pg_get_functiondef`, never from migration text —
-- this body has been re-emitted twice already (CLAUDE.md's binding SQL
-- exception; `re-emit-definer-body-from-live-def`). `create or replace`
-- preserves the ACLs, so no re-GRANT is owed.
--
-- ⚠ SINGLE-LINE ANCHOR, DELIBERATELY — an anchor spanning a newline is hostage
-- to line-ending drift in the stored body (the house idiom; see
-- `20260722000100_authz_m1_gate_helper_deny.sql`).
-- =============================================================================

do $mig$
declare
  v_def  text := pg_get_functiondef('public.get_case_detail(uuid)'::regprocedure);
  v_from text := '''patient_enabled'', (v_case.patient_mode <> ''none''),';
  v_hits int;
begin
  -- Verified from pg_proc at author time: exactly ONE occurrence. Asserted here so
  -- a drifted body FAILS LOUDLY instead of patching the wrong place — or patching
  -- nothing and leaving a green suite behind.
  v_hits := (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from);
  if v_hits <> 1 then
    raise exception
      'FUP-0137-PHI-MODE-SHIMS: get_case_detail anchor found % time(s), expected 1 — '
      'the body drifted; RE-READ pg_proc and RE-ANCHOR rather than forcing this patch',
      v_hits;
  end if;

  execute replace(v_def, v_from, '');

  -- Prove the patch LANDED, from the catalog, in the same transaction. A mutation
  -- that did not fully apply otherwise reports green.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_case_detail'
      and p.prosrc like '%patient_enabled%'
  ) then
    raise exception 'FUP-0137-PHI-MODE-SHIMS: the derived patient_enabled key survived the re-emit';
  end if;

  -- And prove the re-emit did not take the REAL fields with it: this migration
  -- removes a shim, and a body that lost `patient_mode` would satisfy the check
  -- above while breaking every current reader.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_case_detail'
      and p.prosrc like '%''patient_mode'', v_case.patient_mode%'
      and p.prosrc like '%patient_required_fields%'
  ) then
    raise exception 'FUP-0137-PHI-MODE-SHIMS: get_case_detail lost patient_mode/patient_required_fields';
  end if;
end;
$mig$;

-- =============================================================================
-- AUTHZ · M6 — `cases.visibility_policy`: the guarded door. ADR 0078 A1 / A27.
--
-- WHAT WAS WRONG (both measured live, not read from a file — 117/117, rolled back):
--
--   D1. `visibility_policy` is THE authorization column for the member surface, and
--       it was writable by raw PostgREST PATCH. `cases_staff_admin_write` is FOR ALL
--       to `authenticated`, `authenticated` holds table UPDATE, and NO trigger guarded
--       the column. Measured, as chefe.ccih (staff_admin) against the seeded ethics
--       case, watching a plain non-excluded member (staff2.ccih):
--
--           before          explicit_grants_only   reach = f
--           after PATCH     commission_default     reach = t   <- silent widening
--           after restore   explicit_grants_only   reach = f   <- the twin MOVES
--
--       The restore returning to `f` is what makes that a measurement and not a
--       coincidence (§7.10: a probe that reads the same on both sides measures nothing).
--       ⚠ A first attempt used staff1.ccih, who is `is_case_excluded = t` — the hard
--       deny masked the widening and the probe read `f`. A negative from an excluded
--       fixture proves nothing. The fixture above is the corrected one.
--
--   D2. That widening emitted NO audit row (Rule 11). `app.trg_audit_cases` fires on
--       INSERT, then `elsif new.status is distinct from old.status` — a visibility flip
--       with no status change falls off the end. Measured: audit_log 162 → 162,
--       delta = 0. So D1 was undetectable after the fact.
--
-- The contrast that made this indefensible: `status` (workflow) was already guarded by
-- `app.guard_case_status`, and `confidentiality_level` already had a `set_case_*` door.
-- The ONE column that decides who can reach an ethics deliberation had neither.
--
-- ⭐ WHY THE EXCLUSION CHECK IS NOT DEFENCE-IN-DEPTH HERE — IT IS THE EQUALITY.
-- The live qual of `cases_staff_admin_write` is:
--     (is_staff_admin_of(commission_id) OR is_commission_admin_of(commission_id))
--       AND (NOT is_case_excluded(id, auth.uid()))
-- The RLS policy ALREADY carries the exclusion term. This RPC is `prosecdef = t`, so
-- RLS DOES NOT APPLY TO IT (A28) — the door must re-enforce what the policy enforced.
-- Authority ALONE would make this RPC **WIDER** than the raw PATCH it replaces: an
-- excluded coordinator would gain a door the PATCH denied him. `assert_not_case_excluded`
-- is therefore load-bearing for LOST = 0 / GAINED = 0, and A27's respondent lesson
-- (the accused must not re-open the visibility of the case in which he is accused) is
-- the same line doing double duty. The brief asserted parity while printing the qual
-- that disproved its reasoning; the parity holds, for this reason instead.
--
-- ⛔ NO FEATURE FLAG — DELIBERATE, AND NOT AN OVERSIGHT.
-- The model (`set_case_confidentiality`) opens with `assert_case_participants_enabled()`.
-- This door does NOT, on two grounds:
--   1. `case_participants` governs the participant ROSTER, not visibility. Borrowing its
--      gate is §7.8 — a rule extrapolated across a boundary it does not cross.
--   2. Decisive: the column's EFFECT is ungated. `app.can_reach_case_on_member_surface`
--      reads `visibility_policy` with NO `feature_enabled` call (verified: prosrc has no
--      match). The guard trigger below is likewise unconditional. A flag-gated door plus
--      an unconditional column therefore builds a LOCKOUT: flag OFF ⇒ the column still
--      governs reach and the only correction door is switched off, freezing every case
--      at whatever policy it holds. That is §7.7's signature failure — a narrowing whose
--      danger is that it binds TOO MUCH.
-- INVARIANT: the door's availability must equal the column's liveness. Ungated column,
-- ungated door. If a future change gates the column's effect, gate this door with it.
--
-- SQLSTATEs. HC0F5 = authority, HC0F6 = invalid value. Both were collision-checked by
-- RUNNING the census over `pg_proc` with COMMENTS STRIPPED (§7.2 #2: a `prosrc` match
-- counts `--` comments) plus a sweep of src/ supabase/ e2e/ — zero hits for either.
-- M1's lesson is that a block the ADR called "collision-checked at freeze" HAD collided,
-- because the check had never actually been run. It has now been run.
--
-- Keystones: supabase/tests/233_authz_m6_visibility_door.sql
-- Mutation proof (A33): supabase/tests/mutation/m6-mutation-audit.sh
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The guard (D1). A NEW trigger — `guard_case_status` is a keystone and is
--    not touched. Precedent for the shape: trg_guard_case_org_matches_commission,
--    which is likewise BEFORE UPDATE OF <columns>.
-- ---------------------------------------------------------------------------
create or replace function app.guard_case_visibility()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  -- ⚠ `BEFORE UPDATE OF visibility_policy` fires when the column is MENTIONED in the
  -- SET list, NOT when it changes. So the `is distinct from` test is mandatory: without
  -- it, a full-row PATCH carrying an UNCHANGED visibility_policy would eat a spurious
  -- raise. (Verified there is no such caller today — every `from('cases')` in src/ is a
  -- read, zero `.update(`/`.upsert(` — but a guard that depends on that staying true is
  -- a trap for the next author.)
  if new.visibility_policy is distinct from old.visibility_policy and not v_in_rpc then
    raise exception 'case visibility policy changes must go through the case RPCs'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function app.guard_case_visibility() is
  'ADR 0078 M6 / D1. `visibility_policy` is the authorization column for the member '
  'surface and was raw-PATCH writable by any staff_admin (measured: reach f→t→f, silent). '
  'Confines writes to public.set_case_visibility via the app.in_case_rpc GUC, exactly as '
  'app.guard_case_status confines `status`. Raises check_violation to mirror that '
  'precedent — same "wrong door" class, no new SQLSTATE minted.';

drop trigger if exists guard_case_visibility_trg on public.cases;
create trigger guard_case_visibility_trg
  before update of visibility_policy on public.cases
  for each row execute function app.guard_case_visibility();

-- ---------------------------------------------------------------------------
-- 2. The door. Structural mirror of public.set_case_confidentiality (read live via
--    pg_get_functiondef, NOT from migration text — that function was rewritten at
--    runtime by M1 and its migration text is stale by design).
-- ---------------------------------------------------------------------------
create or replace function public.set_case_visibility(p_case_id uuid, p_policy text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;

  -- ⬅ ADR 0078 M1·4, preserved deliberately. AUTHORITY FIRST (HC0F5), EXCLUSION
  -- SECOND (HC0F1), VALIDATION THIRD (HC0F6) — so a keystone cannot mistake the
  -- precondition for the gate, which is exactly how this door stayed open. A twin
  -- whose principal lacks the authority precondition then fails LOUDLY on HC0F5
  -- instead of being silently caught by a throws_ok aimed at HC0F1.
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação pode alterar a visibilidade deste caso'
      using errcode = 'HC0F5';
  end if;

  -- Load-bearing for parity, not merely for A27 — see the header. The RLS qual this
  -- DEFINER bypasses carries `AND NOT is_case_excluded(...)`; without this line the
  -- door would be WIDER than the raw PATCH it closes.
  perform app.assert_not_case_excluded(p_case_id);

  if p_policy is null or p_policy not in ('commission_default', 'explicit_grants_only') then
    raise exception 'política de visibilidade inválida' using errcode = 'HC0F6';
  end if;

  -- in_case_rpc opens BOTH the terminal-case immutability guard (a closed case may still
  -- be re-scoped) and the new visibility guard above. The update emits NO auto case audit
  -- — app.trg_audit_cases only fires on a status change (D2, measured delta = 0) — so the
  -- explicit verb below is the ONE row that records this. Metadata is PHI-free (Rule 11):
  -- policy values and ids only, never case content.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.cases set visibility_policy = p_policy where id = p_case_id;
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.audit_write('case.visibility_changed', 'case', p_case_id, v_case.commission_id,
    'Visibilidade do caso alterada',
    jsonb_build_object(
      'visibility_policy', p_policy,
      'previous_visibility_policy', v_case.visibility_policy));
end;
$$;

comment on function public.set_case_visibility(uuid, text) is
  'ADR 0078 M6 / A1. The guarded, audited door for cases.visibility_policy — the '
  'per-case override A1 ruled must exist ("no schema change: the column was already '
  'per-case overridable"), which was only honest once the override became a real door '
  'rather than an unguarded raw PATCH. Authority (HC0F5) → exclusion (HC0F1) → '
  'validation (HC0F6); audits explicitly because the cases audit trigger does not fire '
  'on this column. Intentionally UNFLAGGED: the column it writes is read unconditionally '
  'by app.can_reach_case_on_member_surface, so a flag here would build a lockout.';

-- Rule: every new public.* RPC revokes from PUBLIC before granting, or the dashboard
-- t19 pgTAP guard fails.
revoke all on function public.set_case_visibility(uuid, text) from public;
grant execute on function public.set_case_visibility(uuid, text) to authenticated;

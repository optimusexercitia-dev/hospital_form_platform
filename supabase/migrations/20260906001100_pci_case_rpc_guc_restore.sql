-- PCI/H1-b — make the `app.in_case_rpc` window COMPOSABLE.
--
-- ── HOW THIS WAS FOUND ─────────────────────────────────────────────────────────
--
-- `supabase db reset` failed at the seed with "case phases must be created through
-- the case RPCs" on the SECOND phase insert of a block whose FIRST insert had
-- succeeded — inside a single `set_config('app.in_case_rpc','on') … 'off'` window.
--
-- The cause is a latent defect that predates this branch:
--
--   app.recompute_case_status ends with an UNCONDITIONAL
--     perform set_config('app.in_case_rpc', 'off', true);
--
-- and it runs from `recompute_case_status_trg`, an AFTER INSERT/UPDATE trigger on
-- `case_phases`. So writing a phase inside an open window turns that window OFF as
-- a side effect. Sequence:
--
--   1. caller sets app.in_case_rpc = on
--   2. INSERT phase 1        -> AFTER trigger -> recompute -> sets the flag OFF
--   3. INSERT phase 2        -> the caller's window is gone
--
-- ── WHY NOTHING CAUGHT IT BEFORE ───────────────────────────────────────────────
--
-- Nothing read the flag on INSERT. The guard only consulted it for UPDATE and
-- DELETE, so a silently-closed window had no observable effect on an insert loop.
-- PCI/H1 is the first reader on that path, which is what turned a dormant defect
-- into a hard failure.
--
-- ⚠ This is NOT merely a seed problem. `create_case_from_template` inserts phases
-- in a LOOP inside one window — so with H1 in place and this unfixed, EVERY case
-- created from a template with 2+ phases would fail on the second phase. The seed
-- happened to fail first. An incremental `supabase migration up` did not reveal any
-- of it; only a full reset did.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────────
--
-- Save the caller's value on entry and RESTORE it, instead of forcing 'off'. A
-- function-local variable is used deliberately rather than a shared "previous
-- value" GUC: a single shared slot corrupts at nesting depth 2 (the inner restore
-- overwrites the slot the outer one still needs), whereas one local per frame
-- nests correctly to any depth.
--
-- The rest of the body is reproduced verbatim from pg_get_functiondef — the live
-- catalog, not the migration that last wrote it (ADR 0078 A28).
--
-- ── SCOPE, STATED HONESTLY ─────────────────────────────────────────────────────
--
-- ⚠ Two sibling helpers carry the SAME unconditional-off shape and are NOT changed
-- here: `app.compute_case_phase_result` and `public.sync_case_phase_on_submit`
-- (both reachable from `approve_correction` / `set_case_phase_result_override` /
-- the response-submit trigger). They are pre-existing, this branch does not make
-- them worse, and neither is on the path this migration must unblock — so they are
-- left for a change that can prove its own fix rather than rewritten speculatively
-- from bodies not fully read. They are recorded in the audit report as a known
-- latent instance of the same class.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §H1b — open a window, insert two
-- phases, and require BOTH to succeed AND the flag to still read 'on' afterwards.
-- Restore the unconditional 'off' and the second insert goes red. `db reset`
-- itself is the other, blunter proof.

create or replace function app.recompute_case_status(p_case_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_old_status text;
  v_new_status text;
  v_has_active boolean;
  v_has_concluded boolean;
  -- PCI/H1-b — the caller's window, captured BEFORE this function opens its own.
  v_prev_rpc text := coalesce(current_setting('app.in_case_rpc', true), 'off');
begin
  select status into v_old_status from public.cases where id = p_case_id;
  if v_old_status is null then
    return;  -- case gone (e.g. mid-cascade); nothing to do.
  end if;

  -- Never override a manual terminal status.
  if v_old_status in ('completed', 'cancelled') then
    return;
  end if;

  select bool_or(status = 'active'), bool_or(status = 'completed')
    into v_has_active, v_has_concluded
  from public.case_phases
  where case_id = p_case_id;

  if coalesce(v_has_active, false) then
    v_new_status := 'in_review';
  elsif coalesce(v_has_concluded, false) then
    v_new_status := 'pending';
  else
    v_new_status := 'not_started';
  end if;

  if v_new_status is distinct from v_old_status then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set status = v_new_status where id = p_case_id;
    -- RESTORE, never force 'off' — see this migration's header.
    perform set_config('app.in_case_rpc', v_prev_rpc, true);
  end if;
end;
$function$;

comment on function app.recompute_case_status(uuid) is
  'Recomputes the macro case status from its phases. PCI/H1-b: restores the caller''s app.in_case_rpc value instead of forcing ''off'' — it runs from an AFTER-trigger on case_phases, so forcing off silently closed the window of any caller inserting more than one phase (create_case_from_template''s loop, and the seed).';

-- PCI/M2 (process-case integrity audit, finding M2, RESTATED) — give the CASE side
-- the two `blocks[]` integrity arms the TEMPLATE side already has.
--
-- ── THE FINDING, CORRECTED ─────────────────────────────────────────────────────
--
-- ⚠ The audit originally said "nothing checks that a referenced position exists,
-- and nothing revalidates when a phase is deleted". Read against the deployed
-- catalog that is WRONG for the template side, and the template side is worth
-- describing because it is the model this migration copies:
--
--   app.validate_template_phase_blocks   — "Every referenced position must exist
--                                          as a slot in this template" (it does)
--   public.remove_template_phase         — REFUSES to delete a phase whose position
--                                          another phase's blocks reference, then
--                                          renumbers the tail AND shifts every
--                                          blocks element in ONE update, then
--                                          re-validates the survivors
--   public.reorder_template_phase        — value-swaps blocks alongside positions
--
-- That is a careful, complete design. The defect is that NONE of it reaches
-- `case_phases`. The case side has only the shared shape guard
-- (`app.guard_phase_blocks_shape`: element is non-null, >= 1, < this row's
-- position) — no existence check, and `delete_ad_hoc_case_phase` guards
-- `recommend_when.from_phase` dependencies while saying nothing about `blocks`.
--
-- This is the project's own recurring shape: a sibling arm that a second call site
-- did not inherit. The array-of-positions MODEL is not the bug — the template side
-- proves it can be made sound. The missing arm is the bug. (The join-table remodel
-- is argued separately in the ADR; it is not needed to close this.)
--
-- ── REACHABILITY, STATED HONESTLY ──────────────────────────────────────────────
--
-- Through the RPCs this is currently UNREACHABLE, and saying so matters more than
-- claiming a P0: `case_phases.blocks` is written only by `create_case_from_template`
-- (copied from an already-validated template, inserted in ascending position order
-- so every referenced earlier position exists), and `add_ad_hoc_phase` does not
-- write the column at all, so ad-hoc phases carry `{}` and nothing can reference
-- them. There is no `set_case_phase_blocks`.
--
-- It is reachable by DIRECT WRITE — the FOR ALL policy plus full DML grants let a
-- staff_admin DELETE a pending phase at position 2 while a sibling holds
-- blocks = {2}, or INSERT a phase with blocks = {3} into a case that has no phase
-- 3. Both leave a dangling reference that the derive layer silently reads as
-- "not blocked", i.e. it fails OPEN: a phase that should be gated becomes
-- available. That is the whole reason to fix it in the substrate rather than in
-- another RPC.
--
-- ── WHY EXISTENCE IS *NOT* ADDED TO THE SHARED SHAPE TRIGGER ───────────────────
--
-- ⚠ `app.guard_phase_blocks_shape` backs BOTH tables. Putting the existence check
-- there would break `remove_template_phase`: its renumbering UPDATE walks rows one
-- at a time, so mid-statement the table holds a mix of shifted and unshifted
-- positions and an existence probe against it transiently fails. The template side
-- already solved this by validating existence OUTSIDE the trigger, AFTER the
-- renumbering settles. So the case-side check goes in its own trigger, on a table
-- where nothing renumbers at all — verified: no function in the catalog assigns
-- `case_phases.position` (only remove_/reorder_template_phase assign a phase
-- position, and both are template-side).
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §M2 — insert a phase whose blocks
-- name a non-existent sibling (must fail); delete a phase another phase blocks on
-- (must fail); and delete the WHOLE case (the cascade must still SUCCEED, which is
-- the arm a naive referenced-check breaks).

-- ── A · referenced positions must exist ────────────────────────────────────────
create or replace function app.guard_case_phase_blocks_refs()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_missing integer;
begin
  if new.blocks is null or cardinality(new.blocks) = 0 then
    return new;
  end if;

  select b into v_missing
  from unnest(new.blocks) as b
  where not exists (
    select 1 from public.case_phases
    where case_id = new.case_id and position = b
  )
  limit 1;

  if found then
    raise exception
      'um bloqueio da fase % referencia a fase %, que não existe neste caso',
      new.position, v_missing
      using errcode = 'HC016';
  end if;

  return new;
end;
$function$;

comment on function app.guard_case_phase_blocks_refs() is
  'PCI/M2 — case-side twin of the existence half of app.validate_template_phase_blocks. Deliberately NOT folded into the shared app.guard_phase_blocks_shape: that function also backs process_template_phases, where remove_template_phase renumbers row-by-row and an existence probe would fail mid-statement.';

drop trigger if exists guard_case_phase_blocks_refs_trg on public.case_phases;
create trigger guard_case_phase_blocks_refs_trg
  before insert or update on public.case_phases
  for each row execute function app.guard_case_phase_blocks_refs();

-- ── B · a blocked-on phase may not be deleted ──────────────────────────────────
create or replace function app.guard_case_phase_blocks_referenced()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  -- ⚠ THE CASCADE ARM. When the owning case is deleted, ON DELETE CASCADE removes
  -- the parent FIRST and the phases after, so `commission_of_case` is already NULL
  -- here. Without this escape the sibling check below would see the other phases
  -- (still visible in this snapshot), refuse, and make every case undeletable.
  -- Same convention the audit triggers use.
  if app.commission_of_case(old.case_id) is null then
    return old;
  end if;

  if exists (
    select 1 from public.case_phases
    where case_id = old.case_id
      and id <> old.id
      and blocks @> array[old.position]
  ) then
    raise exception
      'outra fase depende desta fase (bloqueio); ajuste o bloqueio antes de excluir'
      using errcode = 'HC016';
  end if;

  return old;
end;
$function$;

comment on function app.guard_case_phase_blocks_referenced() is
  'PCI/M2 — case-side twin of the referenced-position refusal in public.remove_template_phase. Applies even under app.in_case_rpc: delete_ad_hoc_case_phase is precisely the path that should refuse, exactly as remove_template_phase does on the template side.';

drop trigger if exists guard_case_phase_blocks_referenced_trg on public.case_phases;
create trigger guard_case_phase_blocks_referenced_trg
  before delete on public.case_phases
  for each row execute function app.guard_case_phase_blocks_referenced();

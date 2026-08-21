-- ============================================================================
-- Flip `dsr` ON permanently — the DSR gate flip (same two-migration convention as
-- the FF-1 repeating_groups flip 20260828000900, the ADR-0085 case_corrections
-- flip 20260825000600, the ADR-0084 cases_bulk_create flip 20260824000000, and
-- the ADR-0083 case_custom_fields flip 20260822000000). Seeded OFF in
-- 20261001000000; this is the deliberate permanent go-live flip (PO decision,
-- 2026-08-20, at the DSR remediation gate).
--
-- ADR 0130 "Direitos do Titular" is live and gate-passed across four slices: the
-- hospital_dpos capability + is_dpo_of predicate, the request/task fan-out with
-- the case-grain resolution, the adjudication tier with per-meeting escalation,
-- and the residue-language notice. Suites 349/350/354.
--
-- ⛔ WHY THIS MIGRATION IS NUMBERED AFTER 20261003000000, AND IT IS NOT
-- COSMETIC ORDERING. The DSR execution tier's whole purpose is to fire the four
-- `dispose_*` doors, and until 20261003000000 three sibling child locks aborted
-- two of them on exactly the records they exist to erase — the RPC rolled back
-- with the Class-1 PHI DELETE inside it, so nothing was erased
-- (BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW). Making the module REACHABLE
-- before that fix landed would have shipped a workflow that hands an executor a
-- working button which silently accomplishes nothing on a `completed` RCA, a
-- `completed`/`cancelled` CAPA plan, a terminal interview, or a locked meeting's
-- case notes. Migrations apply in filename order, so this ordering IS the
-- guarantee; do not renumber it below 20261003000000.
--
-- WHAT WAS ACTUALLY BROKEN, since a flip migration usually fixes nothing. The
-- flag row was inserted `false` by 20261001000000 and the ONLY writer that ever
-- set it true was `supabase/seed.sql`, which runs on `db reset` and never on the
-- deployed project. So on production the module was unreachable end to end:
-- every door raised HCDS1, `list_my_dsr_hospitals()` returned '[]', and
-- `/o/[org]/titulares` 404'd for every persona including the appointed
-- Encarregado. Local and E2E were green throughout, because the seed path hid it.
--
-- ⚠ THE DESCRIPTION IS UPDATED IN THE SAME STATEMENT, and that is a rule this
-- repo paid for (ADR 0078 M4, migration 20260725000000): a flag's `description`
-- is prose, only `enabled` is the flag, and a description asserting a gate that
-- has been released is the stale-comment defect — it once put a false claim into
-- a permanent ADR. The prior text asserted a pre-gate posture; it is replaced
-- with a resolved STATE clause naming this migration. ⛔ It is PARAPHRASED, never
-- quoted: 20260725000000's self-check greps descriptions for that literal claim,
-- and re-creating the string in order to narrate its removal is a trap that
-- migration's own header records tripping three times.
--
-- seed.sql additionally forces it ON for local/E2E (redundant here; keeps the two
-- paths honest — a seed regression then fails loudly rather than silently
-- skipping the flag-guarded keystones, per the pgtap-fixture-flag-gaps scar).
-- ============================================================================

update app.feature_flags
   set enabled = true,
       description =
         'ADR 0130: "Direitos do Titular" — LGPD Art. 18 subject-request intake, adjudication '
         'and execution. Gates the dsr_* doors and the /o/[org]/titulares surface. '
         'STATE: ENABLED — flipped permanently by migration 20261003000200 at the DSR gate, '
         'deliberately ordered AFTER the child-lock erasure fix (20261003000000) the execution '
         'tier depends on. Resolve the VALUE in the enabled column, never this sentence.'
 where key = 'dsr';

-- ⛔ THE SILENT NO-OP IS THE FAILURE MODE HERE, not an error. A typo in the key
-- (`dsrr`) updates ZERO rows, raises nothing, and leaves the module unreachable on
-- production with a green migration log — the exact shape that made this flip
-- necessary in the first place. Assert the row count AND the resulting value.
-- Data-independent: 20261001000000 inserts this row unconditionally, so exactly one
-- row exists in every environment; this is not a data-dependent backfill.
do $mig$
declare
  v_rows int;
  v_enabled boolean;
begin
  select count(*) into v_rows from app.feature_flags where key = 'dsr';
  if v_rows <> 1 then
    raise exception 'dsr flip: expected exactly 1 feature_flags row for the key, found %', v_rows;
  end if;

  select enabled into v_enabled from app.feature_flags where key = 'dsr';
  if v_enabled is not true then
    raise exception 'dsr flip: the flag is still % after the update', coalesce(v_enabled::text, 'null');
  end if;

  if exists (select 1 from app.feature_flags
              where key = 'dsr' and description not like '%STATE: ENABLED%') then
    raise exception 'dsr flip: the description was not resolved alongside the value';
  end if;
end $mig$;

-- PCI/H4 (process-case integrity audit, finding H4 — REMEDY CORRECTED) — stop a
-- deleted result option from bricking case creation.
--
-- ── THE REAL DEFECT ────────────────────────────────────────────────────────────
--
-- Deleting a `phase_results` row cascades every RELATIONAL reference (four junction
-- tables). It cannot cascade the uuid embedded as a JSON STRING inside
-- `process_template_phases.result_ruleset`, because no FK reaches into jsonb.
--
-- `create_case_from_template` then derives the per-case offered set by reading
-- those very strings:
--
--     select (r ->> 'result_id')::uuid  from … jsonb_array_elements(ruleset->'rules')
--     union select (ruleset ->> 'default_result_id')::uuid
--     union select result_id from case_phase_allowed_results …
--     -> insert into case_phase_offered_results   (FK -> phase_results)
--
-- with NO existence filter. So a ruleset naming a deleted result makes that INSERT
-- raise 23503 and EVERY case creation from that template fails — with a raw
-- Postgres error reaching the UI (also a Rule 10 breach).
--
-- ── WHY THE ORIGINAL REMEDY WAS WRONG ──────────────────────────────────────────
--
-- ⚠ The audit recommended "forbid hard-delete of a referenced phase_results row;
-- archive instead", justified by result-actions.ts:275 ("archive, never delete")
-- and the absence of any delete RPC. That remedy was IMPLEMENTED, and the pgTAP
-- suite rejected it — correctly.
--
-- `supabase/tests/210_phase_result_junctions.sql` (assertions 10-15) is an
-- EXISTING KEYSTONE that deliberately deletes a ruleset-referenced result and
-- asserts the cascade is clean, including one titled "a ruleset-ONLY result ref
-- cascades from the offered shadow — no dangling UUID". Deletion-with-graceful-
-- degradation is the DESIGNED behaviour, not an oversight: the offered shadow
-- cascades away and `app.compute_case_phase_result` already discards any result
-- absent from the frozen offered set.
--
-- So the prose comment in the app was a preference, not the system's contract, and
-- the audit mistook one for the other. The keystone wins. What survives review is
-- the narrower, real claim: the DERIVATION is not robust to a ruleset naming a
-- result that no longer exists.
--
-- ⚠ Note what test 210 does and does not prove. Its "ZERO dangling references"
-- assertion counts rows in the four JUNCTION tables only — it never inspects the
-- ruleset jsonb, which still names the deleted uuid after the delete. The keystone
-- is sound about what it measures; the brick lives in the gap it does not measure.
--
-- Scrubbing the jsonb on delete was considered and rejected: on `case_phases` that
-- would rewrite the recorded ruleset of CLOSED cases, i.e. edit an accreditation
-- record to fix a vocabulary problem. Filtering the derivation changes no stored
-- history and cannot fail closed.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────────
--
-- One join. The derived offered set is restricted to results that still exist AND
-- belong to the case's commission — the second half also closes the cross-tenant
-- variant, where a ruleset copied between commissions names a foreign result.
--
-- Everything else in create_case_from_template is reproduced verbatim from
-- pg_get_functiondef (the live catalog, ADR 0078 A28).
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §H4 reproduces the ORIGINAL bug:
-- author a ruleset, delete the result it names, then call
-- create_case_from_template and require SUCCESS with the dead id absent from the
-- offered set. Revert the join and it goes red with 23503.

do $$
declare
  v_src text;
  v_new text;
begin
  v_src := pg_get_functiondef('public.create_case_from_template(uuid,text,uuid,text,uuid,jsonb)'::regprocedure);

  -- Targeted substitution: add the existence + commission filter to the derived
  -- offered-results INSERT. Anchored on the closing lines of that one statement so
  -- it cannot match anything else in the body.
  v_new := replace(
    v_src,
$anchor$  ) ids
  where ids.rid is not null
  on conflict do nothing;$anchor$,
$patched$  ) ids
  -- PCI/H4 — the rid values come from JSONB (rules[].result_id and
  -- default_result_id), which no FK can validate. A result deleted after the
  -- ruleset was authored would otherwise reach the FK below and raise 23503,
  -- failing EVERY case creation from this template. Restricting to results that
  -- still exist AND belong to this commission degrades gracefully instead —
  -- matching what app.compute_case_phase_result already does at compute time.
  join public.phase_results pr
    on pr.id = ids.rid
   and pr.commission_id = v_commission_id
  where ids.rid is not null
  on conflict do nothing;$patched$
  );

  if v_new = v_src then
    raise exception
      'PCI/H4 ABORT: the anchor for the derived offered-results INSERT did not match; create_case_from_template has changed shape and this patch must be re-derived from pg_get_functiondef';
  end if;

  execute v_new;
end
$$;

comment on function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb) is
  'Creates a case from an active process template, snapshotting phases/narratives/custom fields and freezing the reachable result set. PCI/H4: the derived case_phase_offered_results insert now filters to phase_results that still EXIST and belong to the commission — those ids come from jsonb rulesets that no FK can police, and a deleted result previously bricked every creation from the template with a raw 23503.';

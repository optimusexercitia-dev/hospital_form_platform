---
id: BUG-AE5-STAFF-CAPA-UPDATE-MOVES-ACROSS-TENANTS
status: open
severity: catastrophic
area: nsp
opened: 2026-09-15
closed: null
feature: AE5-STAFF
related_adrs: [0079]
---

# BUG-AE5-STAFF-CAPA-UPDATE-MOVES-ACROSS-TENANTS

## Symptom

An NSP coordinator can change an open CAPA plan's `hospital_id` to a hospital of another organization; that organization's PQS member then reads the Class-1 CAPA.

## Expected behavior

An UPDATE may never move a CAPA to a hospital the writer does not operate, and never across tenants; the NEW row must satisfy the write check.

## Actual behavior

`capa_plan_update` USING and WITH CHECK both call `app.can_write_capa(id, auth.uid())`; the helper reads the stored row by id, so WITH CHECK validates the OLD hospital.

## Reproduction

Rolled back: `q2/review/capa_move_probe.sql` (lead scratchpad). As nspcoord.a (`nsp_coordinator`): `update public.capa_plan set hospital_id = '05000000-0000-0000-0000-00000000000b' where id = 'a5f70000-0000-0000-0000-0000000000b1' returning hospital_id` → 1 row. pqs.b (Rede B, `pqs_member`) 0 → 1 row; mover 1 → 0. Readback after rollback: unchanged.

## Impact

Cross-tenant disclosure of a Class-1 patient-safety CAPA to another organization, and loss of the moving organization's own access. The sub-review also measured the same shape through `rca.event_id` (not re-run by the lead).

**Exposure ruling (PO, 2026-09-15):** the project is pre-pilot with no active users, and a full remote database reset will be performed, so no hosted check is run. The hole is still a defect on `main` and is fixed by a separate hotfix unit cut from `main`.

## Investigation

Found by the AE5-STAFF F1 adversarial plan review (`q2/plan-review.md` PRE-2), reproduced by the review lead and the unit lead. On `main` since the baseline; last redefined `20260928000500`. Hosted database not measured.

## Root cause

_TBD_

## Fix

_TBD_

## Regression protection

_TBD_

## Related code

`public.capa_plan` policy `capa_plan_update`; `app.can_write_capa`; `public.rca` update path via `event_id` (sub-review).

## Lesson

_TBD_

## Resolution

_TBD_

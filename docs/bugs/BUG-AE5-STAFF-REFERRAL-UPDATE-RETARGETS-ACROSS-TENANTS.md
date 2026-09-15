---
id: BUG-AE5-STAFF-REFERRAL-UPDATE-RETARGETS-ACROSS-TENANTS
status: open
severity: catastrophic
area: authz
opened: 2026-09-15
closed: null
feature: AE5-STAFF
related_adrs: [0079]
---

# BUG-AE5-STAFF-REFERRAL-UPDATE-RETARGETS-ACROSS-TENANTS

## Symptom

A referral source or target coordinator can change a draft referral's `source_commission_id` to a commission of another organization; users of that organization then read the Class-1 referral.

## Expected behavior

An UPDATE may never place a referral in a commission the writer does not manage, and never across tenants; the NEW row must satisfy the same management check as the old.

## Actual behavior

`case_referral_update_coord` USING and WITH CHECK both call `app.can_manage_referral_source(id, uid) OR app.can_manage_referral_target(id, uid)` keyed on `id`; the helpers read the stored row, so WITH CHECK re-validates the OLD commission, never the new one.

## Reproduction

Rolled back, live catalog, post-E2E local stack: `q2/review/ref_move_probe.sql` (lead scratchpad; the fixture step uses `session_replication_role = replica` only to set `efa…a1` to draft, then `origin` before the move). As chefe.ccih (`staff_admin`): `update public.case_referral set source_commission_id = 'c0000000-0000-0000-0000-0000000000c1' where id = 'efa00000-0000-0000-0000-0000000000a1'` → `UPDATE 1`. As staff1.qual.b (Rede B, `staff`): 0 rows before, 1 row after, `has_patient = t`, `source_case_id = d0000000-…-c1`. Readback after rollback: unchanged.

## Impact

Cross-tenant disclosure of a Class-1 PHI referral (existence of a patient, the linked case id) to another organization, by a legitimate writer acting through PostgREST on the exposed `public` schema. Also: a target-side coordinator can overwrite source-side draft fields it cannot read (sub-review measured).

**Exposure ruling (PO, 2026-09-15):** the project is pre-pilot with no active users, and a full remote database reset will be performed, so no hosted check is run. The hole is still a defect on `main` and is fixed by a separate hotfix unit cut from `main`.

## Investigation

Found by the AE5-STAFF F1 adversarial plan review (`q2/review/ref-prof-subreview.md` P1-2), re-measured by the review lead and by the unit lead. Not introduced by AE5-STAFF: the policy exists on `main` since `20260620000000_baseline.sql`, last redefined `20261003004710`. Hosted database not measured. ADR 0079 covers foreign-org users, not a writer moving a row.

## Root cause

_TBD_

## Fix

_TBD_

## Regression protection

_TBD_

## Related code

`public.case_referral` policy `case_referral_update_coord`; `app.can_manage_referral_source`; `app.can_manage_referral_target`; column UPDATE privilege of `authenticated` on `source_commission_id`.

## Lesson

_TBD_

## Resolution

_TBD_

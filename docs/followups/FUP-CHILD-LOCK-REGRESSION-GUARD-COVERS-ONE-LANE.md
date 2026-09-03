# FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE — the browser-level P0 guard covers the interview lane only (owner: tester; **filed 2026-08-21 by its own author, as a stated bound**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-21 · status open

`e2e/dsr-disposal-child-lock-regression.spec.ts` drives a real inbox disposal against a **locked
interview** and asserts by **count** (`patient_identifiers` = 0), never by null-check. That is item 9
of the P0's **ten** guard-tripping statements.

⛔ **Not covered at the browser level:** the **`meeting_cases`** lane (item 10 — the shared fixture's
meeting stays `scheduled`, and reaching `signed` requires the real meeting-lifecycle RPCs) and the
**RCA/CAPA** lanes (no NSP/event fixture exists in the DSR helper). Both are covered at the DB layer
by pgTAP `353`, mutation-proven — so this is a *layer* gap, not an unproven fix.

⭐ **Filed by the author of the guard, in the report that delivered it.** Recorded because the
alternative — a green regression spec whose name implies it covers the bug — is exactly how the
original defect survived a full gate.

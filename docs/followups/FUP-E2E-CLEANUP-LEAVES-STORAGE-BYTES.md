# FUP-E2E-CLEANUP-LEAVES-STORAGE-BYTES — registry rows deleted, PHI-bucket objects left behind (owner: tester + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25, measured on a tree that had been freshly reset hours earlier:**
> `storage.objects` held **9** `printed/<uuid>.pdf` objects in **`documents-phi`** while
> `printed_documents` held **0** rows. Lead-verified independently, not taken from a report.
>
> ⇒ **An E2E run's cleanup deletes the registry row and leaves the bytes.** In the local harness that
> is hygiene. The *mechanism* is not: an orphaned object in the PHI bucket is a file with **no
> registry row to revoke**, so `dispose_case_phi`'s block (f) — which iterates the registry — cannot
> reach it. That is the storage-orphan class this repo already knows, arriving through a new door,
> and on the one bucket where it matters most.
>
> ⚠ **It also falsifies a baseline claim that reads as complete:** the clean-tree residue check
> counts `documents-*` storage objects as 0, and every *catalog* dimension did reproduce byte-for-byte
> — so "freshly reset, baseline verified" was true in every dimension anyone measured and false in
> the one nobody did. ⛔ A reset does not clean a bucket; treat storage as its own dimension.
>
> **Owed:** (1) make the E2E cleanup delete bytes before (or with) the registry row, and assert the
> object count returns to baseline — an assertion, not a comment, since the current gap is exactly a
> cleanup nobody checks. (2) Decide whether a reset should also empty `documents-*`. (3) Check whether
> the production disposal path can orphan the same way: if a `printed_documents` row is ever deleted
> rather than revoked, its bytes outlive every control that reaches them by registry.
---

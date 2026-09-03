# FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN — three policies that were in no arm's domain may return BLIND on their first sweep

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

Three `storage.objects` INSERT policies sat outside every arm: `ARM=census` bounds itself to `public`,
and the write-path arm's old snapshot held only 33 `public` rows. The domain fix puts them **in** the
write arm's scope for the first time.

**How it was measured.** The 74 policies the old snapshot missed decompose exactly as 62 `ALL` + 9
(the names `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 3 lists) + **3 `storage.objects` INSERT** — a
decomposition re-derived from the property, not read off the FUP's list.

**What would close it.** Sweep them and record a verdict per policy.

⛔ **What must NOT be mistaken for closing it.** If any comes back **BLIND**, it is a real finding and
must be keystoned. ⛔ **Never allowlist one** — floor and this arm would then agree while both measure
nothing, and agreement reads as coverage.

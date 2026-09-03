# FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE — the enforcement manifest checks set difference on the PERMISSION axis only, so a declared-but-unre-keyed site cannot red

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`supabase/tests/vectors/authz-enforcement-manifest.json` declares an `enforcementSites` list per permission
row. **Nothing compares that list to the catalog.** pgTAP `410`'s set differences are computed over
permission **codes**; no arm asks whether every site a row names is actually re-keyed, nor whether every
catalog site carrying the code appears in the row.

**How it was measured.** The Gate AE4 QA review walked `commission.forms.edit` from its PO-approved matrix
(`docs/design/authz-ae43-staff-admin-permission-matrix.md:291`, "7 ALL") to the live catalog and found
**4 of 7** sites re-keyed, with the manifest declaring 4, `status: "re-keyed"`, `callGraphBoundary: null` —
and every gate green. The live instance is filed separately as `BUG-AE49-D6-REKEY-INCOMPLETE`; **this entry
is the gate gap, not the instance**, and it survives that bug's fix.

**What would close it.** A generated check, in both directions, over the site axis: every `enforcementSites`
entry resolves to a catalog object that carries the row's permission literal, and every catalog object
carrying that literal appears in exactly one row. It must be proven able to red — remove one site from a
row and the gate must fail; add a spurious one and it must fail the other way.

⛔ **What must NOT be mistaken for closing it.** Fixing `BUG-AE49-D6-REKEY-INCOMPLETE` closes the instance
and leaves the axis unchecked — the next re-key gets the same free pass. ⛔ Nor does a green `410`:
its set differences are on the wrong axis, which is the whole finding. ⛔ And `lint:authz-vectors` cannot
substitute — it never touches a database (measured 2026-09-02), so it cannot see a catalog/manifest divergence at all.

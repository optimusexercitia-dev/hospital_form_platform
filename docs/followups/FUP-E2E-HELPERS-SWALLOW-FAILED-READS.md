# FUP-E2E-HELPERS-SWALLOW-FAILED-READS — ~48 spec files + 2 helpers turn a FAILED READ into "the table is empty" (owner: tester/lead; **filed 2026-08-21; 3 instances fixed, the population reported and deliberately NOT swept**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-21 · status open

The second mechanism inside `FUP-E2E-ABSENT-ROW-ASSERTIONS`, and the one **no matcher choice
defends against**: a helper that returns `[]` when the request itself failed, so *"the request
errored"* and *"the table is empty"* become indistinguishable at every call site.

**Fixed 2026-08-21, three live instances, all now `expect(resp.ok(), …)` before returning:**
`e2e/case-patient.spec.ts`'s local `restGet` · `e2e/patient-index.spec.ts`'s local `restGet` · the
**shared** `serviceQuery` in `e2e/helpers/documents.ts`. ⭐ The shared one is used by **6** spec
files; all 6 re-run, **47/47 pass**. Safe by construction: every call site uses the service-role
key, never an RLS-scoped read, so asserting `ok()` cannot misclassify a real access-boundary result
as a failure — checked, not assumed.

⛔ **The population is ~48 spec files + 2 helpers carrying the same
`Array.isArray(data) ? data : []` shape, and it was deliberately left alone.** The overwhelming
majority are unrelated to PHI erasure, and a 48-file sweep in the same session that fixed 3 would be
a scope explosion with regressions nobody could individually verify. ⛔ **Do not read the 3 fixed as
a sample that closes the item** — ⭐ *a fix count is not a population count*, the same shape as this
round's other three magnitude corrections.

**When this is taken up:** derive the population as a property (a helper that can return a
collection **and** has a non-throwing failure path), not as a grep for `Array.isArray`; fix the
**shared** helpers first, since each covers many call sites at once; and prove each fix by making a
read fail and requiring red. ⚠ Where a helper is used with an **RLS-scoped** key rather than the
service role, `ok()` is the wrong assertion — an empty result may be the correct answer there, and
that distinction is what makes this a per-helper job rather than a codemod.

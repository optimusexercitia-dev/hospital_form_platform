# FUP-PGTAP-VACUOUS — `lint:vacuous` scans TS spec files ONLY; ~6000+ pgTAP assertions are entirely unscanned, and a live specimen was found (owner: lead + backend; a program-level audit, NOT a phase side quest)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status open

Filed 2026-08-14 during DM4. **Found by `backend` while re-reading a suite it had to edit, and
lead-confirmed.**

**The live specimen** — `supabase/tests/197_phi_disposal_closure.sql` assertion **4.1**, inside a
**PHI-boundary suite**:

```sql
(select (j -> 'shared_items' -> 0 ->> 'frozen_storage_path') from meta_read) is null
```

If `shared_items` is an **empty array**, `-> 0` yields NULL, `->> 'field'` yields NULL, and
`is null` is **true**. The assertion passes **having asserted nothing** — and it has been doing so.
Nothing guards the array's non-emptiness. The DM4 successor adds a positive control
(`shared_items -> 0 ->> 'id' IS NOT NULL` in the same read) so the deny-half provably denies a row
that **exists**.

**Why this is 🔴 and program-level.** `npm run lint`'s fifth gate (`check-vacuous-assertions.mjs`)
exists precisely because "a test that can go GREEN having asserted nothing" already shipped here —
but its scope is **first-party TS** (`src/`, `e2e/`, `*.test.*`): **180 spec files scanned, 0
findings**. The pgTAP suites are **SQL and completely outside it**, against **~6152 assertions** as
of DM3. The JSON-path-on-a-possibly-empty-array shape is a *natural* way to write these, so one
confirmed instance is weak evidence for one instance.

⚠ **Scope discipline, deliberately recorded:** DM4 fixes **only** the instance in its own diff.
A repo-wide sweep is its own audit with its own ways of being wrong — and this project has the
scar: [[a-detector-that-finds-a-lot-needs-proving-too]] (a sweep reported 89; seven of its own bugs
were 56 of them). Any detector built here must be **dry-run against a hand-classified control** and
**proven able to fail** before its count is believed
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

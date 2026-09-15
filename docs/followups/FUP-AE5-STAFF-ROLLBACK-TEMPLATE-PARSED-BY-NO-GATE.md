# FUP-AE5-STAFF-ROLLBACK-TEMPLATE-PARSED-BY-NO-GATE

**Filed:** 2026-09-15 (unit `AE5-STAFF`, AC-9 catalog pass, ordered by the lead) · **Owner:** backend
**Severity:** medium — the rollback path's SQL can be invalid or self-defeating, and nothing reds.
**Status:** open

## The finding

`docs/deployment/authz-rollback-template.sql` is the SQL an operator copies into a new migration
under time pressure, during an incident (runbook § 7). It sits outside `supabase/migrations/` by
design (ADR 0162 § 1), so no gate ever feeds it to Postgres:

- `npm run lint` does not parse SQL under `docs/`;
- `npm run test:db` loads `supabase/tests/`, never `docs/deployment/`;
- no authz arm reads the file.

A template nobody executes is a comment with SQL syntax. Twice in one unit it carried a defect that
every gate was blind to.

## Evidence

**1. SECTION G's guards did not parse (2026-09-14, found by hand).** `G1a` and `G3a` read
`position( || rp.permission_code ||  in p.prosrc) > 0`: a quoting layer between the author and the
file had eaten the `''''` literals. The operator would have got a syntax error where a refusal
belongs. It was found by chance, while making `F1b(ii)` byte-identical to `G`'s guard.

**2. F2's row-count guard could never pass (2026-09-15, found by the AC-9 pass).** F2 was written
as `update authz.roles …;` followed by a SEPARATE `do $$ … get diagnostics v_n = row_count …`.
`GET DIAGNOSTICS` reads the last command run inside its own plpgsql block, so it always read 0. On
the live catalog, inside one rolled-back transaction, `staff` read `authoritative`, then
`test_validation` after the UPDATE, and then the guard raised
`ROLLBACK ABORTED: expected to flip exactly 1 role, flipped 0.` A guard that can never pass is one
an operator deletes. **No straight run of SECTION F could reach F2:** on any post-T7 catalog
`F1b(ii)` refuses first (`20 permission code(s) held by staff are enforced at app/public sites`),
correctly, so F2 and F4 were never executed. It was found only by running F2 on its own. The UPDATE
now sits inside the block. Measured both ways: the first run flips 1 and passes, and F4 passes
behind it. A second run in the same transaction raises `flipped 0`.

**The AC-9 pass itself (2026-09-15, ad hoc, not committed).** Each section A–G was cut from the
file by its `-- SECTION X` header, with placeholders filled from a written map. Two modes ran per
section, each inside `begin … rollback`:
- PARSE compiled every `do` block as `create function pg_temp.… language plpgsql`, which raw-parses
  every embedded statement without executing it;
- EXEC ran the whole section with `ON_ERROR_STOP=1`.

Results:
- A–E: 0 errors in both modes.
- F and G: all DO blocks compiled (3 and 2). Execution refused at `F1b(ii)` and at `G3a`
  ("REVERT INCOMPLETE"), both the correct refusals on an unreverted post-T7 catalog.
- PLANT (G with every `''''` stripped): PARSE exit 3, `syntax error at or near "in"`.

The harness lived in a session scratchpad; the method above is the specification.

## Why a parse gate alone is not enough — stated, not ruled

Defect 1 is a PARSE defect: a parse gate catches it. Defect 2 PARSES: every block compiled. It is a
run-time defect in a section that a correct earlier guard makes unreachable. A gate that only
parses would have been green on it, and so would a straight run of the section. Only running each
guarded step in isolation reached it. Whether the gate should also run each DO block in isolation
against a constructed state is for whoever closes this. The close condition below is the one the
lead ordered and does not require it.

## Closes when

A gate parses each section A–G of the template on a fresh reset, with placeholders filled from a
recorded map and DO blocks compiled without executing (statements run inside `begin … rollback`),
and is shown to red on a stripped-quote plant.

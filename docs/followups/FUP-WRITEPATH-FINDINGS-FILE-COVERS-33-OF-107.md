# FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107 — the committed findings baseline predates the domain fix, and `FROMFINDINGS` arms structurally cannot notice

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`p0-authz-writepath-audit.sh`'s domain was widened from an embedded 33-row snapshot to the live catalog's
**107** write-capable policies (`polcmd <> 'r'`). `docs/reviews/authz-writepath-audit-findings.md` still
holds verdicts for **33 of 107** and now says so in a note. Any `FROMFINDINGS=1` arm re-measures nothing —
it compares against the committed rows — so **it cannot see the 74 absent ones**. A door absent from the
findings passes vacuously.

**How it was measured.** `pg_policy` grouped by `polcmd` on the live catalog: 62 `ALL` + 17 INSERT +
17 UPDATE + 11 DELETE = 107; the committed file holds 33.

**What would close it.** One full write-path sweep over the widened domain, with its rows **merged into**
the committed findings file — not replacing it, since the 33 carry hand-merged annotations.

⛔ **What must NOT be mistaken for closing it.** A green `FROMFINDINGS=1` run at any point before that
merge: it is green *because* the 74 are absent. ⛔ Nor does the domain fix itself close it — the instrument
was repaired, nothing was measured, and 4 gates *selected* is not 4 gates *measured*.

⭐ **NOW 37 OF 107 — 2026-09-02.** The four AE4.9 D6 policies were swept (4 COVERED, 0 BLIND, exit 0)
and their verdicts merged into the committed baseline per ADR 0079 Amdt 1 (`974328e6`), because a
subset run writes only to SCRATCH (ADR 0153) and that directory is temporary. ⛔ **The item does not
close on this:** 37 of 107 is not 107, the 70 unmeasured still pass any `FROMFINDINGS` arm vacuously
by being absent, and all four new rows are `snapshot:ABSENT` — swept, but with no §7.2 drift tripwire
protecting the verdict.

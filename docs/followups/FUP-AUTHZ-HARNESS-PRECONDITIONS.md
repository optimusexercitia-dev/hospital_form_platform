# FUP-AUTHZ-HARNESS-PRECONDITIONS — a neutralization verdict has at least TWO preconditions and the harness checks ONE (owner: backend/harness; **filed after two near-miss false BLINDs on the same live door in one session**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**2026-08-20, DSR Slice 3.** The neutralization harness returned **`PASS`** for two probes against
`create_dsr_request`'s authorization gate and `complete_dsr_task`'s effect check. Read literally, that
says **a live PHI-adjacent authorization gate is BLIND**. It said nothing of the kind — **twice, by two
different broken preconditions:**

1. **The baseline was already red.** The `db reset` before the run had **exited 1** and the suite was
   failing 73/75 before any probe fired. A probe verdict over a red baseline is not a weak verdict, it is
   **no verdict**.
2. **The domain did not contain the subject.** The harness's `SUITE` defaulted to `00_setup + 350`, and
   **both keystones live in `349`.** The suite it ran never contained the assertion it was trying to
   falsify.

⛔ **The general form: *"nothing noticed the gate opening"* and *"nothing that could notice was running"*
are INDISTINGUISHABLE in the output.** A neutralization verdict rests on at least two preconditions —
**baseline green** and **the keystone present in the swept domain** — and the harness asserts only the
first. Both near-misses were on the **same door**, reached by different routes, within one session.

⚠ **How the second was caught: by wondering why a gate that had been watched working would suddenly be
unguarded.** The author's own words: *"that is luck, not method."* ⛔ Had either been piped through
`tail`, or believed, it would have been a **false P0 on a live authorization door** — the exact class
that burned an external auditor in ADR 0078.

**Scope — ⛔ do NOT read this as "RED verdicts are unaffected".** This defect cannot manufacture a false
COVERED from a **green-verified** baseline: it fails toward PASS/BLIND, and the harness already asserts
the probe moved `md5(pg_get_functiondef)` (a dead write channel aborts loudly). ⚠ **It does NOT follow
that RED is unconditionally safe.** A **red baseline also yields a red post-probe run** — mutate a gate
in an already-failing suite and it stays failing, the harness prints `# Failed test …`, and that reads as
**RED = COVERED**, attributing a pre-existing failure to the mutation. That is a **false RED, failing in
the *reassuring* direction** — the one nobody re-checks. It is the exact inverse of the two near-misses,
and is **not** excluded by them.

> **A RED verdict is sound iff the baseline was verified green for that run.**

**Every verdict in DSR Slice 3 meets that bar:** each battery run gated on a printed green baseline, and
**no verdict rests on a PASS — 47 RED + 1 GREEN, and the GREEN was recorded as a finding, not a pass.**
So no Slice 3 verdict needs re-opening.

⛔ **Provenance of this scope note, because it is the point.** QA argued structurally that *"a RED entails
all three preconditions, so the harness defect cannot reach a RED"*, and **the lead endorsed it without
testing it.** `backend` refuted it: the argument holds for two preconditions and **fails for the
baseline**. An over-strong safety rule, adopted because its conclusion was correct for the case at hand,
would have been relied on later where the conclusion does not hold. *The conclusion being right is not
evidence that the reasoning is.*

**A second instance of the same family, found fixing this one:** `350`'s verdict census. The strict
pattern (`\.\.+` dot-leader) returned **46** — it missed a line appended with a one-dot leader. The naive
pattern (`^--   .*RED`) returns **49** — inflated by prose lines merely containing the word. **Both
candidate shapes are wrong, in opposite directions.** True total **48 = 47 RED + 1 GREEN**, now derived
four ways and cross-checked. ⛔ The shape contract is written out — and **nothing enforces it**: a comment
cannot check itself.

**The fix (filed, NOT built):** the harness must assert its own preconditions and refuse to emit a
verdict when either fails — baseline green ✅ *(already checked)*, and **keystone present in the domain
❌ (not checked)**. A `PASS` with the subject absent must be an ERROR, never a verdict. This project
leans on this instrument for its entire authz coverage story.

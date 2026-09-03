# FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS — the subset half is fixed, the full half is not, and the file is not purely generated (owner: backend; filed 2026-08-26, found while closing the subset half)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-26 · status open

_**Detail rotated VERBATIM from the Follow-ups section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-26**, restoring that index line to its declared one-line form during a size rotation. Nothing was summarised away — the text below is the removed substring exactly as it stood:_

> and that file is **not purely generated**: it carries hand-merged subset verdicts, a trailing `## Note — a RENAME moves a gate's verdict` section, and inline annotations on the skipped-policy bullets. A full run destroys all of them, silently. ⚠ **Same class as the closed item, different RUN MODE** — the guard that fixed the subset path deliberately does not cover it, so "the truncation is fixed" is true of one half only. Fix is the register's option **(b)**: merge verdicts rather than replace. All four sweeps now print a startup warning counting the hand-merged blocks — a hint, not a gate

Residual of [[FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE]] (closed 2026-08-26, ADR
[0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)). That fix
covers the **subset** run mode only, by design: with `CASES=` set the report goes to scratch. A **full**
sweep still emits `docs/reviews/authz-door-audit-findings.md` through the same truncating redirect.

⚠ **That would be harmless if the file were generated — and it is not.** The committed baseline carries
material no run reproduces:

- a hand-merged `<!-- … -->` block of subset verdicts (around line 569);
- a trailing `## Note — a RENAME moves a gate's verdict` section;
- inline annotations on the skipped-policy bullets.

A full sweep destroys all three, silently, and the loss looks exactly like a clean regeneration. The
periodic full sweep is ~5 h and rare, which is *why* this is 🟡 and also why nobody would notice for
weeks — the annotations are read at the next audit, not at the run that erased them.

**Fix: the register's option (b)** — merge verdicts into the committed file rather than replacing it,
so generated rows update while hand-authored blocks survive. ⛔ Do **not** close this by extending the
subset guard to full runs: a full run *should* rewrite the generated rows; the property to preserve is
the hand-authored material, not the file.

⚠ **What exists today is a hint, not a gate.** All four sweeps print a startup warning counting the
hand-merged blocks and telling the operator to re-merge from `git show HEAD:<path>`. A warning the
operator must read at the right moment is the same shape as the *"restore the findings file"*
instruction whose failure produced the parent item.

---

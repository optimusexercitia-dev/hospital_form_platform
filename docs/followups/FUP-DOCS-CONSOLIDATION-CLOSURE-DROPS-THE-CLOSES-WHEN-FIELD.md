# FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD — a closure archives the body but DELETES the entry, so the field survives only in git

**Filed:** 2026-09-04 (QA review of HARNESS-CRASH-SAFETY, finding F-REC-4)
**Owner:** lead
**Severity:** medium — nothing is wrong in any closed item; what is lost is the ability to audit a
closure against the condition it was closed on, and the loss is silent and total per item.

## The rule, and what actually happens

`docs/followups/follow-ups-open.md` states the rotation in its own words:

> **Resolved** → move the whole entry — and its body file, if it has one — **verbatim**

The **body** is moved verbatim; this unit's three closures were measured byte-identical against
`main` (QA M18/M19). The **register entry block** — the six fields `Filed` / `Owner` / `Severity` /
`Closes when` / `Status` / `Body` — is *deleted* rather than moved. The archived item therefore
keeps the filed narrative and loses the field that says what would close it.

## The measurement

Taken 2026-09-04 on `authz-harness-crash-safety`:

| what | measured |
|---|---|
| `docs/followups/follow-ups-archive.md` | **8963** lines, hundreds of closures |
| register-style `**Closes when:**` lines in it | **3** (`:8014`, `:8282`, `:8321`) |

Three surviving fields across the whole archive. ⛔ **Not attributable to any one unit** — it is
longstanding practice, and it is raised as a register-procedure defect, not as a defect of the unit
whose review found it.

## Why it matters

`docs/features/<unit>.md` hubs make the `Closes when` clause the **audit contract**: this unit's
hub says *"each on its own `Closes when` clause — quoted there, not paraphrased here. **Nothing
else counts as closure.**"* A reader auditing that claim after the rotation has to reconstruct the
field from `git log`, and will more often simply take the closure note's word for it.

⚠ The same review found the second-order consequence: two of this unit's four entries carried the
consolidation placeholder `**Closes when:** PO to rule`, and were closed on their **body files'**
conditions instead — a substitution that was correct but invisible, precisely because the field is
not in the archive to compare against. (Disclosed in the two archived closure notes, 2026-09-04.)

## Closes when

**Either** of these, whichever the lead prefers:

1. The rotation moves the **entry block** as well as the body — verbatim, under the archived
   heading, exactly as the body is moved today; **or**
2. a lint gate over the registers asserts that an archived entry carries a `**Closes when:**`
   field. ⚠ The QA disposition named `lint:progress`; register **shape** is
   `lint:registers`' domain (`scripts/check-docs-registers.mjs`), so that is the likelier home —
   the implementer should confirm which gate owns the assertion before writing it.

⛔ Whichever is chosen must be **proven able to fire**: archive one entry without the field and
watch the gate red, or diff a rotation before/after and show the block arrived. A rule that nothing
checks is what produced the 3-in-8963 figure above.

⚠ Retrofitting the ~hundreds of already-archived closures is **explicitly not** required by this
item; the fields are recoverable from git history and mass-editing the archive would be a worse
risk than the gap. What must stop is the *next* closure dropping it.

## Related

- ADR [0179](../decisions/0179-follow-up-register-consolidation.md) — the rotation mechanics.
- ADR [0186](../decisions/0186-documentation-consolidation-one-home-per-fact.md) — one home per
  fact; the register's shape and gate 13's ratchets.
- `docs/reviews/harness-crash-safety-review.md` § F-REC-4 and § F-MAJOR-4(b) — where it was found.

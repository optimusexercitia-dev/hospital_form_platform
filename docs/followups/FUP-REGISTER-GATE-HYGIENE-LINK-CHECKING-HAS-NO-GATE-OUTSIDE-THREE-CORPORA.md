# FUP-REGISTER-GATE-HYGIENE-LINK-CHECKING-HAS-NO-GATE-OUTSIDE-THREE-CORPORA — most of `docs/` has no link gate at all, and the five broken links found today were found by hand

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-08 · status open

⭐ **This is the direct successor of `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE`** (closed 2026-09-08,
`docs/followups/follow-ups-archive.md`), which is why it is filed under that unit's code rather than
under the unit whose second-pass repairs surfaced it. That item found 14 dangling ADR-to-ADR links
and closed by giving gate 9 a **case-exact** `checkLinks` over `docs/decisions/` — *"one link checker
across three gates, not a third that could disagree"* (`af9cf1e4`). ⇒ The checker is now shared and
correct; what is **not** shared is the corpus. This item is that residue, and its instance in
`docs/reviews/aff4-review.md` is a generated ADR back-pointer — literally the predecessor's own
defect class, sitting one directory outside the predecessor's corpus.

⛔ **THE FIVE BROKEN LINKS ARE NOT THE FINDING.** They are repaired (below). The finding is that
**nothing would have found them**, and nothing will find the next one: relative-link resolution is
gated over three subtrees and the tree has far more than three. Repairing instances is exactly what
leaves the rest unfound — the shape this repo has now hit repeatedly under *"a sweep bounded by a
SYNTAX cannot find the CLASS"*.

## The corpus gap, DERIVED from the three scripts (not recalled)

`checkLinks` is a single shared function — `scripts/check-docs-registers.mjs`, exported and imported
by the other two, so there is **one** checker and **three disjoint corpora**:

| gate | script | link corpus it hands to `checkLinks` | `exists` semantics |
| --- | --- | --- | --- |
| 7 `lint:progress` | `check-progress-doc.mjs` | `PROGRESS.md`, `CLAUDE.md` (`LINK_CHECKED_DOCS`), every `docs/progress/*.md`, plus `movedDocs` = `docs/followups/*.md` + `docs/bugs/*.md` | `existsSync` — **case-INSENSITIVE on NTFS** |
| 9 `lint:adr-index` | `build-adr-index.mjs` | `docs/decisions/*.md` | **CASE-EXACT** (`makeCaseExactExists`, built from `readdirSync` listings — deliberately, and it carries a `links-wrong-case-detect` self-test) |
| 13 `lint:registers` | `check-docs-registers.mjs` | its `owned` list: `docs/INDEX.md`, `docs/bugs/BUGS.md`, `docs/learning/LESSONS.md`, the legacy-codes doc, `docs/followups/follow-ups-open.md`, `docs/postmortems/README.md` + its files, `docs/bugs/README.md` + `BUG-*.md`, every hub `docs/features/*.md`, every FUP body file | `existsSync` — **case-INSENSITIVE** |

⇒ **Gate subset NONE**, measured by walking `docs/**` and subtracting the three corpora: **320**
`.md` files. Among them, whole subtrees that carry binding or load-bearing text —
`docs/design/`, `docs/plans/`, `docs/reviews/`, `docs/deployment/`, `docs/phases/`,
`docs/testing/`, `docs/planning/`, `docs/handoffs/`, `docs/backend-state.md`, `docs/lint-gates.md`.

⭐ **And two repo-root binding docs**: `ARCHITECTURE.md` and `PHASES.md` are **not** link-checked —
`LINK_CHECKED_DOCS` is `['PROGRESS.md', 'CLAUDE.md']` only, and gate 13's `owned` does not name them.
They happen to be clean today (swept, 0 findings), which is precisely the state in which a gap is
invisible. ⛔ Their cleanliness is not coverage.

## What the sweep measured, and with what instrument

Run 2026-09-08 at `98a19d0e` + these repairs, over the 320 uncovered files, **using the gates' own
`checkLinks` imported from `scripts/check-docs-registers.mjs`** — deliberately not a
reimplementation, because the derived audit that opened this item *was* a reimplementation and
that is where its one error came from (below).

- **55 unresolved relative links** remain: **54** in `docs/design/temp/`, **1** outside it.
- `docs/design/temp/` is **declared historical** — its 54 are recorded here as the known,
  bounded remainder, not as work. ⛔ They are also why a gate added over the whole tree would
  start **red**: the honest first move is an exclusion for that directory, written as an
  exclusion, not a silently narrower corpus.
- The **five live instances** outside it are repaired in this commit (all five predate Batch 7;
  introducing commits named).

| site | defect | introduced by |
| --- | --- | --- |
| `docs/deployment/authz-rollback-runbook.md:3` | ADR 0162 cited by a slug it never had (`0162-plan-audit-corrections-authorization-evolution-program.md`; real: `0162-authz-evolution-plan-audit-corrections.md`). ⚠ It is the runbook's **Authority** line — the first link a reader follows | `0126cb9a` (AE4.9 D6) |
| `docs/design/authz-c2-tier1-sizing.md:239` | repo-rooted `docs/decisions/0173-…` used relatively → `docs/design/docs/decisions/…` | `3f213d48` |
| `docs/plans/quality-office-oversight.md:162` | percent-encoded `%5Borg%5D`; the real path has literal `[org]` | `aa8e05dc` (2026-08-07) |
| `docs/reviews/aff4-review.md:713` | a **generated ADR back-pointer copied verbatim into a review**, so its `./`-relative form resolves against `docs/reviews/`. ⭐ Exactly the class gate 9 was extended for on 2026-09-08 — but gate 9's corpus is `docs/decisions/` **only** | `6d33f395` (2026-08-26) |
| `docs/reviews/dm2-orchestration-wave-a-review.md:806` | repo-rooted self-reference used relatively. ⭐ **The derived audit MISSED this one** — see § What the audit got wrong | — |

The two review sites are historical records: only the link **destination** was changed, the
reviewers' prose and the rendered visible text are untouched, and each carries a dated annotation
saying so.

## What the audit that opened this item got wrong

⭐ Recorded because the instrument is the lesson, not the count. The audit reported **59** findings
partitioned **55 historical / 4 live**. Re-measured with the production `checkLinks`, the true
partition is **54 historical / 5 live** — the same total, and **one live instance under-reported**.
⇒ A hand-partitioned "4 live" would have been repaired and closed with a fifth still in the tree,
in the same directory as one that *was* found. ⛔ The lesson is not "the audit was sloppy": it is
that a **reimplementation of a gate's own checker is a second instrument**, and two instruments that
agree on a total can still disagree on the partition that decides the work.

## Two bounds on the sweep, stated because they are invisible in the number

1. **File existence only in the audit; anchors in this re-run.** The audit checked existence and
   **not `#anchors`**. Production `checkLinks` *does* resolve anchors against the file's own
   headings — so the audit's figure was a floor, and anchor breakage in the uncovered corpus was
   never in its domain at all. (This re-run found **0** anchor-kind findings inside
   `docs/design/temp/`, so anchors do not explain the partition difference above.)
2. ⛔ **NTFS case-insensitivity makes wrong-case links invisible to the sweep AND to two of the
   three gates.** This sweep used `existsSync`, as gates 7 and 13 do. ⇒ A link whose case is wrong
   resolves on Windows/APFS and **breaks on a case-sensitive checkout or CI runner**, and it is
   invisible *inside gate 7's and gate 13's own corpora* — not merely in the uncovered one. Only
   gate 9 is case-exact, and it built `makeCaseExactExists` on purpose after this exact trap. ⇒ The
   case gap is a **second, orthogonal hole**: widening the corpus without adopting gate 9's
   `exists` would extend coverage while leaving this class unfound everywhere.

## What would close it

A gate whose link corpus is bound on **the property** — *every markdown file the repo keeps* —
with any exclusion written **as a named, dated exclusion carrying its reason** (`docs/design/temp/`
being the one known candidate), and using gate 9's **case-exact** `exists` rather than `existsSync`.
⛔ Not a fourth hand-registered list: gate 7's own header records that every widening of its
hand-registered list found debt the registry had been hiding — 41 broken links at the first
widening, 130 more when it went registry-free — which is this item's argument already proven once
in this tree.

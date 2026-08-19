# ADR 0127 — standing rules get a path-scoped home, and a staleness gate

- **Status:** accepted (PO, 2026-08-19)
- **Context.** PROGRESS.md carried three categories with different lifetimes, and the
  rotation predicate (`is it resolved?`) only handled one. **State** rotates on
  *"did it merge?"* — working. **Backlog** is open but not actionable, so the predicate
  never fires. **Rules** — *"never fix FUP-42501 by granting INSERT"*, *"before touching
  `buildAnswerMaps` read BUG-FF4-001"* — have **no resolution event at all**, so they can
  only accumulate. § Bug Log's "Closed" subsection had stopped being a bug list and become
  a rule list. Rules do not belong in a state file.
- **Decision.**
  1. **Standing rules live in `.claude/rules/*.md`, always with `paths:` frontmatter**, so
     they load when Claude touches the files they govern. A rule **without** `paths:` loads
     on every session and every teammate spawn — the cost this directory exists to avoid,
     reached by omission — so the gate reds on it.
  2. **Admission filter.** A rule is admitted only if it (a) declares machine-checkable
     `anchors:` and (b) is not already enforced by a gate or by code. Applied to the nine
     candidates, **five were rejected**: three already enforced (the minutes
     `MINUTES_SERVICE_URL` precondition fails fast in the spec itself; `lint:set-local`;
     pgTAP `320`'s ACL census), one with a **dead anchor** (*"date a log before citing it"*
     names `batch-9-unrun.log`, which is untracked), and one with no tight glob
     (supersession spans 8+ files, so the rule would fire everywhere or nowhere). A rule a
     gate already enforces is a downgrade dressed as a cleanup.
  3. **`lint:rules` is gate 8** (`scripts/check-rules-staleness.mjs`, self-red-proving).
     Keystone: **a rule whose own `paths:` glob matches zero files is orphaned** — its
     subject was renamed or deleted, so it can never fire again. Anchors resolve as `path`
     or `path#literal`. Retirement → `docs/progress/rules-archive.md`, verbatim, never
     deletion.
  4. **The Stop hook's domain widens to `.claude/rules/`.** `lint:rules` catches a rule
     whose *subject* vanished; a rule whose *claim* went false while its subject still
     exists has **no gate at all**, and the only witness is a human contradicting it
     mid-session.
- **Consequences.** The accumulation problem is capped at admission rather than observed
  after the fact: *"can this be shown stale?"* is now a precondition for writing a rule.
  ⚠ **Bounded, stated:** DB anchors (`prosecdef`, ACLs, RLS policies) are **not** checkable
  in `lint`, which runs without Docker — those belong in pgTAP, and the gate says so rather
  than reporting a pass that reads wider than its domain.
- **Open risk, unresolved at acceptance.** `.claude/rules/` path-scoping is gated by a
  runtime feature flag (`claudemd_rule_globs`). A rule file created mid-session did **not**
  load when a matching file was touched, which is consistent with either session-start
  enumeration *or* the flag being off for this account — the two cannot be distinguished
  from inside a session. **The rule files are therefore unproven, not proven.** An
  `InstructionsLoaded` hook is installed to measure it: the next session that opens
  PROGRESS.md either logs a `path_glob_match` load or does not. Until then the source prose
  remains reachable in the archives, and PROGRESS.md's pointer names both homes — so an
  inert rule costs a hop, not a fact.

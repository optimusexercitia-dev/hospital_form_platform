# Lessons register

One row per generalizable lesson this project paid for. Purpose: a lesson learned once, in one
session, is not available to the next session unless it is written where every session can find
it — this table, not a memory file or a chat transcript. A postmortem (`docs/learning/postmortems/`)
shares its `LEARN-NNN` id with its row here: the row is the short form, the postmortem the long
form, and only some rows have one.

**Enforcement column — allowed values only:**
- `prose only` — no gate can red on this lesson; it is a claim, not a guarantee.
- `lint:<name>` — a script named in `package.json`'s `scripts` (part of `npm run lint`).
- `ARM=census` / `ARM=hat` / `ARM=floor` / `ARM=wrapper` / `ARM=policy` — an arm of
  `supabase/tests/mutation/p0-authz-invariant.sh`.
- a repo path in backticks that exists — a pgTAP file, an E2E/vitest spec, or a script.
- a `.claude/rules/<file>.md` that exists.

**Admission rule (ADR 0185 D7):** a lesson with no enforcer is labeled `prose only`, so a reader
can tell a protected claim from a hope. Multiple tokens are comma-separated. Sources: the 17
lessons in `docs/progress/authz-handoff.md` §7, plus session-memory lessons whose origin resolves
to a repo record (an ADR, a `FUP-`/`BUG-` id registered in a tracker, a commit, or an existing path).

| ID | Area | Lesson | Origin | Enforcement |
|---|---|---|---|---|
| LEARN-001 | Mutation testing | A keystone that cannot go red under mutation is not evidence it protects anything; revert the fix and require the test to fail. | `docs/progress/authz-handoff.md#7.1` | lint:vacuous, `supabase/tests/mutation/p0-authz-invariant.sh` |
| LEARN-002 | Text vs catalog truth | Stale text hides in flag descriptions, prosrc comments, TypeScript claims and persona names, not only in migration files. | `docs/progress/authz-handoff.md#7.2` | ARM=wrapper |
| LEARN-003 | State assertions | A reading is a fact only at the instant it was taken; assert live state instead of trusting an earlier claim of it. | `docs/progress/authz-handoff.md#7.3` | `supabase/tests/229_authz_m1_exclusion_durability.sql`, `supabase/tests/230_authz_m3_assignment_phi.sql` |
| LEARN-004 | Review method | A second check counts as independent verification only when it does not reuse the first check's own query or pattern. | `docs/progress/authz-handoff.md#7.4` | prose only |
| LEARN-005 | Closure & enumeration | A caller population is closed by the gate-helper set, not by counting callers found across successive sweeps. | `docs/progress/authz-handoff.md#7.5` | prose only |
| LEARN-006 | RLS exclusion | An exclusion is only as strong as its weakest mutator; audit every writer of the rows a deny resolves through. | `docs/progress/authz-handoff.md#7.6` | prose only |
| LEARN-007 | Risk direction | A narrowing that over-denies passes its negative keystone by construction, so the positive twin is the real review. | `docs/progress/authz-handoff.md#7.7` | prose only |
| LEARN-008 | Verification discipline | A claim not falsifiable by a test is a hope, and a rule proven in one context does not transfer across a boundary it never crossed. | `docs/progress/authz-handoff.md#7.8` | prose only |
| LEARN-009 | Closure & enumeration | A closure claim is closed only over the population the rule was actually applied to; state the population's scope first. | `docs/progress/authz-handoff.md#7.9` | prose only |
| LEARN-010 | Diff-based proof | A metric that reads the same before and after a fix is measuring the wrong thing; require the probe to move on its positive twin. | `docs/progress/authz-handoff.md#7.10` | prose only |
| LEARN-011 | Inferred mechanism | An inferred causal arrow between two verified facts is itself unverified until you mutate one side and watch the other move. | `docs/progress/authz-handoff.md#7.11` | prose only |
| LEARN-012 | Severity & reachability | A leak's severity is its measured blast radius, not how alarming the policy text reads; find the writer of the exposed rows first. | `docs/progress/authz-handoff.md#7.12` | prose only |
| LEARN-013 | Closure & enumeration | Your own enumeration is a closure claim too; presenting "the N cases I found" as complete repeats the audited error. | `docs/progress/authz-handoff.md#7.13` | prose only |
| LEARN-014 | Layer blindness | A check that verifies one authorization layer and infers the adjacent one is blind by construction and survives a green suite. | BUG-AUTHZ-001 | `supabase/tests/270_authz_dashboard_gate_uniformity.sql` |
| LEARN-015 | Test execution | Green has a third failure mode beyond a vacuous pass: an assertion that never executed because its own fixture aborted the file. | `docs/progress/authz-handoff.md#7.15` | prose only |
| LEARN-016 | Toolchain drift | A defect reproducing only on the prod/standalone build may be toolchain drift; verify node_modules matches the lockfile first. | BUG-PROD-ACTIONS | `scripts/e2e-prod-gate.sh` |
| LEARN-017 | Call-site binding | An authz gate can receive the caller's uid as a parameter; classify hat-blindness by what call sites bind, never by signature shape. | `docs/progress/authz-handoff.md#7.17` | `supabase/tests/318_act_hat_blind_caller_gate_siblings.sql` |
| LEARN-018 | Mutation testing | A designated runtime authority with zero production callers is a conformance finding against the ADR that named it, not a rename nit. | ADR 0155 | prose only |
| LEARN-019 | Coverage vs verdicts | "Nothing has ever asked about a door" is a bookkeeping gap, not proof it is unprotected; neutralize a sample before escalating. | FUP-AUTHZ-COMMAND-DOOR-UNSWEPT | prose only |
| LEARN-020 | Escape hatches | A flag that lets an unmeasurable case pass also silences a measured failure, because both share one not-clean bucket. | ADR 0128 | `scripts/storage-manifest.mjs` |
| LEARN-021 | Test fixtures | A green suite can mean the check is sound and every fixture avoids the state that actually breaks, not that the code is correct. | `supabase/tests/348_disposal_flag_meeting_child_lock.sql` | `supabase/tests/348_disposal_flag_meeting_child_lock.sql`, `supabase/tests/351_meeting_disposal_redaction_set.sql` |
| LEARN-022 | Mutation testing | A never-fires mutation reds every deny assertion but cannot move an accept assertion; each polarity needs its own mutation. | `docs/progress/authz-ae2.md` | prose only |
| LEARN-023 | Test drift | Re-coding a test's expected error after a new guard fires earlier leaves the original guard asserted by nothing; change the caller instead. | `docs/progress/authz-ae4.md` | `supabase/tests/229_authz_m1_exclusion_durability.sql`, `supabase/tests/257_ethics_e2_retention.sql` |
| LEARN-024 | Mutation harness | A neutralization harness keyed on an exact gate string is a hand-written copy of production code that a later migration silently falsifies. | `supabase/tests/mutation/p0-authz-writepath-audit.sh` | `supabase/tests/mutation/p0-authz-writepath-audit.sh` |
| LEARN-025 | Control design | A dead query satisfies a set-difference check and its own negative control at once; pair every such check with a discrimination control. | `supabase/tests/mutation/p0-authz-invariant.sh` | `supabase/tests/mutation/p0-authz-invariant.sh` |
| LEARN-026 | Mutation testing | When an observation is a union of arms, a mutation opening one arm is invisible if another legitimately-open arm already supplies its bits. | `supabase/tests/319_act_case_caps_arm_divergence.sql` | `supabase/tests/319_act_case_caps_arm_divergence.sql` |
| LEARN-027 | Performance controls | An optimization that flattens a cost curve invalidates every control whose pass condition tracks that curve, so success reads as failure. | `docs/progress/authz-ae4.md` | prose only |
| LEARN-028 | Performance controls | A control that plants a fixed cost gets stronger as its subject gets faster; a multiplicative share model predicts the opposite direction. | `docs/progress/authz-ae4.md` | prose only |
| LEARN-029 | Mutation testing | A mutation table keyed by assertion id proves mutations ran, not that every cell was exercised; add a subject column to find the gaps. | `docs/progress/authz-ae2.md` | prose only |
| LEARN-030 | Sweep completeness | A sibling sweep can hold the door fixed and vary the guard, or hold the guard fixed and vary the door; sweeping only one misses the class. | ADR 0129 | prose only |
| LEARN-031 | Plan baselines | A plan's verified-facts baseline is a hand-list that names the instance found, not the class, and the "verified" label stops re-derivation. | ADR 0134 | prose only |
| LEARN-032 | Duplication | A universal negative like "there is no X anywhere" has no natural stopping point and is exactly the claim that authorises a duplicate. | `src/lib/queries/org.ts` | prose only |
| LEARN-033 | Review discipline | Correcting a claim's direction without re-deriving its magnitude leaves the figure wrong while a correction note makes it look checked. | `docs/backend-state.md` | prose only |
| LEARN-034 | Follow-up closure | A follow-up's own close condition can name the one construction that provably cannot exhibit the defect, so closing it proves nothing. | FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED | prose only |
| LEARN-035 | Evidence grain | A real filter or guard cited for a conclusion it does not bound reads exactly like proof; state what the evidence must show, then check it does. | BUG-CASEEVT-KIND-001 | prose only |
| LEARN-036 | Keystone design | A keystone can pass by asserting a property Postgres guarantees structurally, or by checking a write and never that write's column readers. | `supabase/tests/312_printed_documents.sql` | `supabase/tests/312_printed_documents.sql` |
| LEARN-037 | Absence assertions | An affordance's absence can have a different mechanism than the gate it looks like it belongs to; only neutralization tells you which. | FUP-CASOS-ABSENCE-DIFFERENTIAL-UNASSERTED | prose only |
| LEARN-038 | Control design | A before/after detector's own positive control can prime a cache that then manufactures the false positive it was meant to rule out. | `scripts/cloud-orphan-probe.mjs` | `scripts/cloud-orphan-probe.mjs` |
| LEARN-039 | Accessibility | A label bound to its control by DOM position can flip targets once a sibling control appears, so the binding is correct only in one state. | BUG-CASEPHASE-DUEDATE-001 | `src/components/cases/activate-phase-dialog.test.tsx` |
| LEARN-040 | Test assertions | A word-boundary regex over textContent is blind at every element edge, because textContent joins sibling text with no separator. | FUP-DISPOSE-DIALOG-OVERCLAIM | `.claude/rules/ui-copy-forbidden-strings.md` |
| LEARN-041 | Test assertions | Optional chaining on a possibly-absent row is not vacuous by itself; the matcher decides, and `.not.toBeNull()` passes on undefined. | FUP-E2E-ABSENT-ROW-ASSERTIONS | prose only |
| LEARN-042 | Lifecycle invariants | A "once X, always X" claim read off a state list is false the moment any door walks the lifecycle backwards; check the transition graph. | ADR 0125 | prose only |
| LEARN-043 | Follow-up scoping | A follow-up's named mechanism is a derived claim, not an observation; sweeping by it inherits its error and can be too wide and still blind. | FUP-0137-PERSIST-REFRESH-DROPS-FOCUS | prose only |
| LEARN-044 | Plan hygiene | A plan's "remember the X lesson" note is a hand-copied claim about a specific subject, and can be false about the sibling it is applied to. | `docs/plans/aff2-user-management.md` | prose only |
| LEARN-045 | Test assertions | An assertion whose matcher cannot see the correct state fails identically to a real regression; dump what actually rendered before concluding. | `src/app/not-found.tsx` | prose only |
| LEARN-046 | Gate integrity | A gate can report near-perfect coverage over tests that never ran, through a dropped batch, a pipe, a missing exit, or a moving tree. | `supabase/tests/mutation/p0-authz-door-audit.sh` | `supabase/tests/mutation/p0-authz-door-audit.sh`, `supabase/tests/292_session_context.sql` |
| LEARN-047 | Code reading | A retrieval window anchored on a declaration and read forward cannot see that declaration's own doc comment, which sits above it. | `src/components/cases/coordinator-phase-actions.tsx` | prose only |
| LEARN-048 | Catalog reading | Grepping `prosrc` line by line drops a multi-line predicate's continuation lines, always reporting a guard narrower than it really is. | ADR 0134 | prose only |
| LEARN-049 | Register hygiene | A tracker's dominant failure mode is a false sentence in its act-or-not-act clause, not a stale subject, and the error always reads as care. | FUP-DM5-SIBLING-GUARD-DIFF | prose only |
| LEARN-050 | Register hygiene | An amendment recorded only in the new document leaves the amended one reading as current law to anyone who arrives at it directly. | ADR 0133 | lint:adr-index |
| LEARN-051 | Context budget | PROGRESS.md has never been auto-loaded into any session; the real load-cost optimization target was CLAUDE.md and MEMORY.md all along. | ADR 0124 | prose only |
| LEARN-052 | Register hygiene | A follow-up is one entry with severity, id, owner and origin together in one register file; a split index-plus-body dual-write drifts. | ADR 0179 | lint:progress |
| LEARN-053 | External-state claims | A repo can gate its own contents but not a claim about an external system like a remote database or git remote; only a fresh read can. | `docs/progress/dm5-handoff.md` | `.claude/rules/live-facts-measure-dont-quote.md` |
| LEARN-054 | Decision hygiene | A figure you measured yourself ages exactly like an inherited claim; re-run the measurement immediately before a decision rests on it. | FUP-DM5-STACK-CYCLE-DESTROYS-BYTES | prose only |
| LEARN-055 | Approval hygiene | A PO approval recorded against one unit says nothing about a second unit sharing its gate; the ambiguity is invisible from either document alone. | `docs/reviews/dsr-remediation-review.md` | prose only |
| LEARN-056 | Review authority | A prescribed fix from a reviewer or lead is a hypothesis, not a spec; test it against real data before implementing it. | ADR 0072 | prose only |
| LEARN-057 | Text vs catalog truth | A migration's last literal function definition can be years stale, because some migrations rewrite bodies programmatically off the live catalog. | ADR 0078 | prose only |
| LEARN-058 | Reachability | A predicted defect can be unreachable because an unrelated trigger closes it incidentally, not for the reason the record then credits it with. | FUP-0137-MRN-BLANKABLE-AFTER-SEND | prose only |
| LEARN-059 | Mutation harness | A neutralization that silently failed to apply, or applied only part of a multi-part mutation, prints green and certifies coverage that never ran. | ADR 0137 | prose only |
| LEARN-060 | Mutation harness | A mutation harness must verify its rollback point exists and its restore channel actually writes before it touches any live authz gate. | `supabase/tests/mutation/p0-authz-invoker-audit.sh` | `supabase/tests/mutation/p0-authz-invoker-audit.sh` |
| LEARN-061 | Layer blindness | A SECURITY DEFINER function's own behaviour is truth about the SQL and evidence about nothing downstream; the TS seam can filter independently. | ADR 0106 | prose only |
| LEARN-062 | Grants & ACLs | A REVOKE the calling role is not entitled to make returns no error and changes nothing; re-derive the privilege from the catalog, never trust exit 0. | `supabase/tests/191_grant_hardening.sql` | `supabase/tests/191_grant_hardening.sql` |
| LEARN-063 | Cascade closure | A table can be perfectly locked down and still be wiped through an FK cascade from a parent that was never locked down. | ADR 0132 | prose only |
| LEARN-064 | Sweep coverage | Allowlisting a door as "exercised only by E2E" is precisely the state that makes it blind to a pgTAP neutralization sweep, and the arms then agree. | `supabase/tests/mutation/authz-neverclled-door-allowlist.txt` | `supabase/tests/300_rowdoor_gate_keystones.sql` |
| LEARN-065 | Merge safety | A conflict-free merge can silently revert a bulk repair; "no conflict" only means the two sides did not edit the same lines. | ADR 0143 | lint:mojibake |
| LEARN-066 | Deploy safety | Resetting the linked remote database applies the E2E seed fixture, publishing 36 shared-password accounts and synthetic PHI to production. | BUG-BOOTSTRAP-001 | prose only |
| LEARN-067 | PHI handling | On Windows a non-system drive root grants BUILTIN Users read access by default, so the better backup location is the worse ACL for PHI. | FUP-DM5-BACKUP-IS-PHI-EXPORT | prose only |
| LEARN-068 | Mutation harness | A mutation sweep's green-baseline preflight proves the tree is green unmutated; it says nothing about whether a mutated run will be trustworthy. | `supabase/tests/mutation/p0-authz-door-audit.sh` | `supabase/tests/mutation/p0-authz-door-audit.sh` |
| LEARN-069 | UI feedback | A success banner set immediately before a callback that unmounts its owner mounts and unmounts in one React commit and never paints. | BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS | prose only |
| LEARN-070 | Test infrastructure | Playwright's webServer leaves a dev server holding live DB connections, which makes a local db reset half-apply and produces phantom reds and greens. | FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS | prose only |
| LEARN-071 | E2E gate hygiene | A flaky-test baseline is a floor, not a count; naming flaky tests by identity and by batch health is what makes it falsifiable across runs. | BUG-QO-STALE-CASOS | prose only |
| LEARN-072 | E2E maintainability | Several E2E specs locate elements by styling class and tag rather than role or text, so a restyle breaks them and a string sweep will not find it. | `e2e/cases-outcomes-blockers.spec.ts` | `e2e/cases-outcomes-blockers.spec.ts`, `e2e/views-labels-participants.spec.ts` |
| LEARN-073 | Verification design | An observable proxy substituted for the property that matters always fails in the reassuring direction; "I could not look" must not read as "I looked and found nothing." | FUP-DM5-NO-ANSWER-VS-NOTHING | `docs/learning/postmortems/LEARN-073-no-answer-vs-nothing.md` |
| LEARN-074 | RLS census scope | `prosecdef` belongs beside `pg_policies` — a DEFINER function's gate replaces RLS, so a policy census is not proof. | ADR 0078 | ARM=census, ARM=wrapper |
| LEARN-075 | Text vs catalog truth | Text is not truth: a migration file, a comment, a status line is a claim; the catalog and the measurement are the fact. | ADR 0078 | prose only |

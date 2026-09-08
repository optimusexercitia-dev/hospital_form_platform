# PRIVILEGE-SURFACE — progress record

Privilege surface: pre-AE5 remediation **Batch 7**. The unit's **summary** is its hub,
[docs/features/privilege-surface.md](../features/privilege-surface.md) § Current state; this file is
its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `docs/backend-state.md` § Privilege budget (`CEILING: 752`, the merge rule, and the
`RE-MEASURED … 759` block), `docs/design/authz-ae1-revoke-partition.md` (the 233-revoke partition
RV0 produced and executed none of), `supabase/config.toml:13` (the one line that bounds the `app`
PUBLIC floor), and — if the PO rules for execution — `supabase/migrations/` plus every authz arm
whose domain a revoke moves. Decisions: ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the door-audit sweep is a
standing gate; a revoke that evicts a function from an arm's domain is sweep blindness),
[0134](../decisions/0134-case-surface-split-and-administrativo-case-read.md) Amdt 6 (where the `app` PUBLIC floor was found, while
deriving an ACL **by property**), [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D9 +
[0160](../decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md) D3 (the budget's origin and the 843 → 856
correction), [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) (the **one** of the
seven that carries a named justification),
[0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(the widened `PRED_DOMAIN` that is the stated prerequisite for any revoke), and
[0192](../decisions/0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md)
(**ownership is a proxy, not the property** — the shape a privilege audit is most likely to repeat).

## Session log

### 2026-09-08 — unit opened (lead)

**Tree measured before anything was assumed** (plan §6 step 1, whose parenthetical says to re-run it
because a clean push state is an instant, not a lease):

- `git status --porcelain | wc -l` → **0**
- `git rev-list --count origin/main..main` → **27** (unchanged from Batch 6's close note)
- `docs/features/INDEX.md` → 13 hubs, **in progress 0**
- `git branch --list` → `main` only; `git ls-remote --heads origin` → `authz-c2-tier1`,
  `authz-enforcement-manifest`, `main` — **no Batch 7 branch on either side**, so plan §6 step 3's
  `initiate` is the correct verb, not `resume`. ⚠ Both facts are about this clone and about
  `origin`; neither is evidence about a second machine's clone
  (*an-inference-about-what-you-cannot-measure*), and Batch 4 is the precedent for that mattering.

**The three follow-ups were read in their bodies, not the register.** This is not ceremony: the
register's index entry for `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN` **truncates its own
`Closes when` mid-sentence** — it ends `…converts …` — so the register text is a summary of the
clause, and the batch protocol requires closing on the clause itself.

**⭐ A finding at unit open, before any build: the follow-up's named heads are already stale.** The
`Closes when` clause says to diff the `authenticated`-executable DEFINER set between head
`…005300` and head `…007330`. The live migration head is **`20261003007350`** — Batch 4 landed
`…007340` (`ae49_d6_rekey_remaining_forms_edit_sites`) and `…007350`
(`batch4_rekey_set_item_validations`) after the 759 was measured. Diffing only the clause's pair
would satisfy the clause *and* leave any delta those two migrations introduced unattributed and
invisible: the number put to the PO would be a five-day-old aggregate presented as the current one.
Recorded as a **three-head** run in the hub's acceptance criteria — the clause's own pair is
reproduced (so the finding is shown to reproduce, not merely re-asserted) and the current head is
what the PO is asked to rule against. ⛔ This is *a-partial-fix-reads-as-a-complete-one*: the
direction of the clause is right; its magnitude went stale between filing and execution.

**Why the two PO questions are asked at different times** (protocol §4 step 2 — before the build
where they change scope, after where they need a measurement):

- **Before**: does Batch 7 *execute* revokes at all? This decides whether the unit carries a
  migration, and therefore whether it owes a diff-scoped door sweep over **both arms** rather than
  the empty-diff assertion every docs-and-scripts batch has made. It is answerable without any
  re-derivation.
- **After**: the ceiling's disposition (move it by ruling to the justified number, or revoke the
  unjustified grants) and the `app` PUBLIC floor's three-part decision. Both need numbers that do
  not exist yet, and the AE1 body **forbids** reusing the ones on file.

**Unit opened:** hub `docs/features/privilege-surface.md` (status `in_progress`), this record,
`npm run features:index`, gates 7 + 13, commit, branch `authz-privilege-surface` off `main` at
`412fa4d7`.

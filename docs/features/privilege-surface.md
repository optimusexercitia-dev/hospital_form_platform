---
id: PRIVILEGE-SURFACE
title: Privilege surface — the authenticated-executable DEFINER budget's seven-over-ceiling breach attributed function by function, the 233 held AE1 revokes ruled on with their 137 silent no-ops named, and the app-schema PUBLIC floor given the decision it has been waiting for (pre-AE5 Batch 7)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 7 of the follow-up batches ruled 2026-09-04"
branch: authz-privilege-surface
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/privilege-surface.md
reviews: []
adrs: ["0079", "0127", "0134", "0155", "0160", "0182", "0191", "0192", "0193", "0195"]
handoff: ~
fup: ~
---

# PRIVILEGE-SURFACE — the surface AE5 substitutes on top of, measured before it is substituted on

## Acceptance criteria

The unit closes **three** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause, quoted **there**, not paraphrased here. Nothing else counts as closure.

⚠ **This batch is PO-heavy by construction.** Two of the three close on the literal clause
**`Closes when: PO to rule`** — for those the deliverable is *the measurement that makes a ruling
possible*, plus the ruling, recorded where a later reader finds it. ⛔ A measurement alone does not
close them, and ⛔ a ruling taken without the re-derivation the follow-up's body demands closes them
on stale numbers.

⚠ **A checked box means the CONDITION IS MET AND PROVEN, not that the register entry is closed.**
Entries stay `Status: open` until the Record step, after PO approval.

- [ ] `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN` 🟠 — attribute the six unattributed of the
      seven by **diffing the `authenticated`-executable DEFINER set** between heads, naming each
      function and the increment that added it; then the aggregate goes to the PO: the ceiling moves
      by ruling to the justified number, **or** the unjustified grants are revoked.
      ⛔ **Editing `docs/backend-state.md`'s `CEILING: 752` to 759 is NOT closure** — the follow-up
      names that as the thing to not mistake for a fix; the ceiling moves only by PO ruling.
      ⚠ **The clause names heads `…005300` → `…007330`. The live head is `…007350`** — two Batch 4
      re-key migrations landed after the 759 was measured. Diffing only to `…007330` satisfies the
      clause and leaves any newer delta unattributed and invisible, which is
      *a-partial-fix-reads-as-a-complete-one*. The run is therefore **three heads**, and the PO is
      given the current one to rule against, with the clause's own pair shown beside it.
      ⛔ A revoke here **may not create sweep blindness** — revoking `authenticated` EXECUTE evicts a
      function from `ARM=floor`'s domain (RV0's load-bearing ruling).
- [ ] `FUP-AE1-REVOKE-SET-EXECUTION` 🟠 — `Closes when: PO to rule`. The ruling is on **execution**
      of the 233-revoke set AE1 classified and executed none of.
      ⛔ The body forbids reusing its numbers: the partition (44 property-rescued · 5 name-rescued ·
      **23 HOLD** · 161 UNCHANGED) is `…005300`-dated and must be **re-derived at the current head**
      before anything is put to the PO or executed.
      ⛔ **137 of the 233 reach `authenticated` only via `PUBLIC` (`proacl IS NULL`)**, so
      `revoke … from authenticated` is a silent no-op and **no arm would notice** — every arm
      returns an identical verdict for the honest reason that the privilege never moved. Any
      executed batch asserts `has_function_privilege` **moved**; an unmoved predicate is a failure,
      not idempotence.
      ⛔ **RV3 is a hard input**: EXECUTE is re-checked at write time on a function referenced inside
      a stored CHECK expression (`42501`), so such a revoke **breaks writes to the constrained
      table**. ⚠ `UNCHANGED = 161` is unexamined, not cleared.
- [ ] `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` 🟢 — `Closes when: PO to rule`. Informational
      anchor: 237 of 467 `app` functions are `anon`-executable, bounded by `supabase/config.toml`'s
      **`[api].schemas`** key (`["public", "graphql_public"]`) — **a config line, not the ACLs**.
      ⚠ Cited by **key, not line number**: this read `config.toml:13` until 2026-09-08, when the
      gate's own comment block displaced the assignment to line 51 (R30). *A cited line number rots
      when its artifact is overwritten* — the key cannot. ⛔ Not a
      vulnerability and must not be reported as one. The body's own close path is a decision in
      three parts (default-`REVOKE` `app` from PUBLIC or not · if yes a **red-first pgTAP** gate,
      because DB anchors are not checkable in `npm run lint` · and a comment on the load-bearing
      config line either way). ⛔ Do not smuggle a sweeping `REVOKE` into a feature migration.

**Proven-to-fire criterion.** The durable form the ceiling follow-up asks for is a `lint:*` gate. A
gate that reds when the budget exceeds a committed figure is believed only after it is shown red on
a **planted** excess and green on the clean tree — the *detector-that-finds-nothing* bar every batch
since 0 has been held to. ⚠ A count gate cannot be a `npm run lint` step if it needs a live DB
(ADR 0127's stated bound, restated by the green follow-up's own item 2) — where the anchor lands is
a design question the plan turn answers, not an assumption this file makes.

**Gate.** `npm run lint` 0/0 · `typecheck` · `test:db` on a fresh reset · the four authz arms with
domains quoted · `SELFTEST=1` · the set-valued targeted home · the diff-scoped door sweep **both
arms** with its `SCOPE:` line quoted. ⚠ If this batch executes a revoke it **is** a migration, so
the sweep is owed both arms over the derived case list, and `git diff --name-only main... --
supabase/migrations supabase/seed.sql src` will not be empty.

## Current state

**Updated:** 2026-09-08

### Objective

Retire the three pre-live privilege-surface liabilities before AE5 substitutes role by role on top
of this surface: an aggregate budget that rose seven over its ceiling without anyone noticing, a
classified-but-unexecuted 233-revoke set whose majority is a silent no-op as written, and an
`app`-schema PUBLIC floor whose only bound is one config line.

### Done since start

Unit opened off `main` @ `412fa4d7`; follow-ups read in their **bodies**, not the register (the
ceiling item's `Closes when` is truncated mid-sentence there). Four PO rulings taken: **R1** defer
revoke execution ⇒ no migration, no ACL change · **R2** keep the `app` floor's config bound and gate
the config line · **R24** the ceiling **moves 752 → 759** · **R25** run the reachability analysis
on the three unproven grants. ⛔ **No live count of the rulings is stated here** — it said "31" and
the file held 34 by the time anyone read it (QA M4). Batch 6's standing repair: *no live count in
the unit's files; the derivation instead* — `grep -c '^## R' batch7-rulings.md`.

**Track A** — three-head catalog run (`…005300`/484 · `…007330`/522 · `…007350`/524, keyed on the
**pair**, since a head alone does not identify a migration set). A→B: **7 ADDED, 0 REMOVED**, all
new functions, all with explicit `authenticated` grants, **0 unattributable**. B→C: the empty **set**
is the finding — ⛔ not "759 == 759", which is exactly what an add/remove pair looks like. Full AE1
re-derivation reproduces 44/5/23/161 = 233; all six arm predicates had moved, the largest a write-arm
worklist that tripled its domain. **Track B** — gate 14 pins `[api].schemas`; its fixture count is
in the self-test's own output, not restated here (it said "13"; the self-test reports 14).
**Track C** — reachability verdicts REQUIRED / UNNECESSARY / UNDECIDED (⛔ a closed three-way set,
never a binary), the ceiling's move in its one home, `320` §U4/U5/U6, and gate 15. **Track D** —
citations repointed to the **key**, and the silent no-op class corrected to 138 beside 137.

**Gate at the tip** (independent runner, not a builder): every command rc **0**, `lint` reaching all
15 gates, `test:db` PASS, four authz arms `INVARIANT HOLDS`, deriver rc 3 NOT-APPLICABLE, set-valued
`CLEAN`, `PATHSPEC_BYTES=0`. ADR **0195** filed — the runner's own finding that every prior batch
left one and this had none.

### In progress

**Fix-loop iteration 1 of ≤5.** QA returned **CHANGES REQUESTED** (`docs/reviews/privilege-surface-review.md`)
with four blocking findings. `backend` holds B1–B4, M2's `320` half and R35; the **lead** holds M1,
M2's ADR half and this file. ⚠ Two of QA's findings are the lead's own defects — a live count in
prose, and a tip-gate freeze the lead broke by committing while the gate ran.

### Next

Re-review → PO approval → Record step. Three follow-ups close on their own quoted clauses; two on
`PO to rule`, so each closure carries **the ruling**, and R1's carries a **re-open condition** rather
than a bare "deferred".

### Blockers

None. ⚠ 27 commits unpushed on `main` at unit open — a fact about the tree, not a blocker here.

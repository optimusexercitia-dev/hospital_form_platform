# 0195 — A committed number needs ONE home and a GATED mirror, and a ratchet joins its incumbent

**Status:** Proposed
**Area:** authorization / privilege surface / gates
**Related:** [0079](./0079-authz-door-blindness-standing-invariant.md) · [0127](./0127-standing-rules-home-and-staleness-gate.md) · [0134](./0134-case-surface-split-and-administrativo-case-read.md) · [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) · [0160](./0160-ae0-corrections-to-adr-0155-measured-figures.md) · [0182](./0182-statement-scoped-authorized-scope-ids.md) · [0191](./0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) · [0192](./0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md)

> ⛔ **This ADR amends nothing, and that is a claim, not an omission.** Every prior pre-AE5 batch
> produced an amending ADR (0190/0191 amend 0173+0079; 0192 amends 0189+0153; 0193 amends 0176+0178;
> 0194 amends 0192), so a reader is entitled to ask what this one overrode. The answer is nothing:
> ADR 0155 D9 established *"track reachable-definer count as a security budget"* and this decision
> **exercises** that rule rather than changing it; ADR 0127's bound that DB anchors are not checkable
> in `npm run lint` is **applied**, not relaxed. The one figure that moved — the ceiling — was never
> in an ADR; it lives in `docs/backend-state.md`, and it moved by the merge rule's own mechanism.

---

## Context

`docs/backend-state.md` § Privilege budget records the count of `SECURITY DEFINER` functions in
`app` + `public` that `authenticated` may EXECUTE, under **CEILING: 752** and a merge rule: *"no
increment may raise the count without a named justification in its own gate record, and the ceiling
moves only by PO ruling."*

On 2026-09-03 the live count was measured at **759**. Six of the seven were unattributed. The
section's own ⭐ note had predicted the shape in writing: *"it rises silently, one convenient
`grant execute … to authenticated` at a time, each individually defensible."* Nothing had noticed
for a week, because nothing was watching — the merge rule was a sentence, and a sentence is not a
gate.

Two adjacent liabilities were batched with it (pre-AE5 Batch 7): AE1's **233** classified revokes,
executed **none**, of which a majority are a silent no-op as written; and the `app` schema's PUBLIC
floor — **237 of 467** `app` functions are `anon`-executable, bounded not by their ACLs but by one
line of `supabase/config.toml`.

## Problem

Four distinct problems, which look like one and are not.

**P1 — the merge rule had no enforcer.** A rule that only a careful reader applies is a rule that
fails silently, and it did.

**P2 — the obvious gate is forbidden where it is wanted and unwanted where it is allowed.** The
follow-up asked for a `lint:*` step, *"so the next commit noticed"*. The count is a query against a
live catalog, and ADR 0127's bound is mechanical, not stylistic: `npm run lint` runs **without
Docker**. A DB-dependent step in that chain has two available behaviours — **fail** on every
Docker-less machine, breaking the chain for reasons unrelated to the commit, or **skip**, which is
worse: ⛔ *an escape hatch for the unmeasurable also silences the measured*, and the skip fires
everywhere.

**P3 — a committed figure in a test is one edit away from being a number with no owner.** The
`ARM=census` arm carries a standing prohibition, filed after a literal `(407 reachable)` drifted to
427 *while printing beside four green arms*: **"DERIVED, NEVER FROZEN … A number a banner states
about a population NOTHING re-derives is a claim with no owner, and this arm exists to stop exactly
that shape."** A naive budget gate hard-codes 752 in pgTAP beside the 752 in the doc — two homes,
free to drift, and the drifted one is precisely the disease.

**P4 — a second ratchet over overlapping surface.** `supabase/tests/320_act_expiry_and_acl_hardening.sql`
§U1 **already** pins a privilege population to a committed number with its own merge rule: the `app`
functions carrying a default-or-PUBLIC ACL, pinned at **236**, with a detector-moves control and an
over-revoke twin. An `app` DEFINER with `proacl IS NULL` is in **both** populations. Building a
second ratchet elsewhere means two pins over one surface with two merge rules in two files, and a
reader who moves one has no reason to see the other.

## Decision

**D1 — The ceiling moves to 759, by PO ruling, recorded.** All seven increments were attributed by a
set diff; four are referenced directly inside live RLS policy expressions and are therefore
structurally required. ⛔ The record states, at the point of the edit, that this is **the same edit
the follow-up forbids taken without a ruling** — because the artefact left behind is identical
either way, and only the recorded ruling distinguishes a decision from a breach quietly rebased into
a baseline.

**D2 — A committed number has ONE home and every copy of it is GATED.** The home is
`docs/backend-state.md` § Privilege budget. The pgTAP assertion necessarily carries a copy (pgTAP
cannot read Markdown, and reading it through a CLI-managed bind mount is too clever to rely on), so
a new text gate — **gate 15, `lint:budget-anchor`** — parses both sites and reds on disagreement.
That converts P3's "two homes" into **one home plus a gated mirror**: the mirror cannot become a
number with no owner, because the gate reds the moment it stops matching its owner.

⇒ **The `ARM=census` prohibition is satisfied on three conditions, and all three must hold**:
(i) the population figure is **re-derived every run**, never printed from a literal; (ii) the
committed number is a **decision**, not a description of a population; (iii) the decision has **one
home** and every copy is gated. The census banner failed (i) and (iii) together.

**D3 — The obligation splits along its two natures, and the half that cannot be honest says so.**
The **catalog half** (is the live budget still what we committed to?) lives in pgTAP under
`npm run test:db`. The **text half** (does the mirror still equal its home?) lives in `npm run lint`.
⇒ ⛔ **The follow-up's ⭐ is recorded as amended by measurement, never as delivered as asked**: the
catalog half buys *"the next Phase Gate noticed"*, **not** *"the next commit noticed"*. Claiming
otherwise would be the more comfortable sentence and the false one.

**D4 — The budget ratchet EXTENDS `320`; no second file is created.** New §U4/U5/U6 sit beside §U1
under a boundary paragraph written for a reviewer: different **population**, different **decision
owner** (§U1's 236 moves by triage; the ceiling moves **only by PO ruling**), different **direction
of concern**. Neither derives from the other, and both re-derive from the live catalog every run —
so they cannot drift into disagreement; only the world can move them, which is correct.
⛔ `320` is **not renamed** despite its name now understating its contents: a rename orphans every
name-keyed citation.

**D5 — Polarity is equality, both directions, per schema AND total.** A one-directional ceiling
cannot see a **fall**, and a fall is not good news: it means a revoke nobody recorded, and under
RV0's ruling a revoke **evicts a function from `ARM=floor`'s domain** — sweep blindness. A
total-only pin is blind to a `+1`/`−1` pair across schemas, which is P-for-population what a count
is to a set (D7).

**D6 — The `app` PUBLIC floor keeps its config bound, and the bound itself is gated as TEXT.** A
sweeping default-`REVOKE` across 228 functions was ruled **no**. Instead **gate 14,
`lint:config-schemas`**, pins `supabase/config.toml`'s `[api].schemas` key, and the line carries a
comment saying what it holds up. ⭐ The justification is stronger than "documenting a posture":
`320` §U1's **severity argument itself** rests on that line in prose, so the gate protects the
premise of a live assertion. ⛔ **Bound, stated in the gate, the record and the closure:** it proves
the **FILE** never gains `app`; it does **not** prove the **deployed** PostgREST configuration
matches the file.

**D7 — A count is not a set, and a head is not a migration set.** The attribution was run at
**three** heads (the follow-up's clause named two; two more migrations had landed since) and
differenced as **sets**. ⛔ The measured budget at the newest head was **759 — identical to the
previous head** — and that identity is the *reason to run the diff*, not evidence of no change: a
count of zero is exactly what an add/remove pair looks like. Reproduction is keyed on the **pair**
`(max(version), count(*))`, because a migration was once inserted *below* an existing head after
the fact, so a head alone does not identify a migration set.

**D8 — Revoke execution is deferred, with a re-open condition rather than a shrug.** Grounds, all
measured: EXECUTE is re-checked at write time on a function referenced in a stored `CHECK`
expression (`42501`), so such a revoke **breaks writes to the constrained table**; the effective
silent-no-op class is **138**; and a revoke evicts its subject from `ARM=floor`'s domain. The
partition was re-derived at the current head so the deferred unit does not restart from figures its
own source forbids reusing.

## Considered options

| option | why not |
|---|---|
| Edit `CEILING` to 759 and move on | ⛔ Exactly what the follow-up names as the thing to not mistake for a fix. Converts a breach into a baseline, and the merge rule reserves it to the PO. Adopted **only** with the ruling recorded (D1). |
| Assert `count <= 752` in pgTAP | Red on the clean tree today — blocks the Phase Gate on a condition the PO had not ruled on, and trains everyone to ignore a red. Rejected in favour of ruling first, then pinning what the ruling produced. |
| Put the count in `npm run lint` as asked | P2. Fails or skips on every Docker-less machine; the skip is the worse half. |
| A new `415_*.sql` for the budget ratchet | P4 unresolved — two pins, two merge rules, two files, plus a bidirectional cross-reference nothing gates. |
| Rename `320` to match its widened contents | Orphans every name-keyed citation. Fixed with a header line instead. |
| Default-`REVOKE` `app` from PUBLIC | A sweeping ACL change across 228 functions, each of which must still work for `authenticated` / `service_role` / the DEFINER chains. Ruled **no**; the config line is the actual bound and is now gated (D6). |
| Execute the 49 "safe" AE1 revokes | D8's three measured hazards. Deferred with its re-open condition. |

## Consequences

- The merge rule has an enforcer for the first time. **P1 closes.**
- ⚠ **Two gates were added, so `npm run lint` has 15, not 13.** Any record, review or prose citing
  "gate N" positionally must be read against that. Both were appended at the **end** for exactly
  this reason — an insertion would have silently renumbered every existing citation.
- ⚠ **D6's mitigation for displaced citations is not gated.** The comment block moved the `schemas`
  assignment off line 13, and old `config.toml:13` citations now land on a note explaining the move.
  Gate 14 pins the **assignment**, not the note's position — ⭐ so that graceful degradation depends
  on something no gate enforces. Stated here so a future edit to that block meets this sentence.
- ⚠ **`UNCHANGED = 161` of AE1's 233 remains unexamined, not cleared.** No arm looked at those rows
  before or after; this decision does not change that.
- ⭐ Both new gates were proven able to fail before being believed — planted reds with observed exit
  codes, clean-tree negative controls, and a discrimination half. One of them nearly shipped a defect
  that this repo should expect again: fixtures **derived from the real artefact** were poisoned by
  the very plant meant to detect them, so the single red the gate exists to produce became
  unreachable and the exit code **inverted** from *"security event"* to *"the checker is broken"*.
  Caught by measuring the fixture table, not by reasoning about it.

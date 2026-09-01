# C2 Tier 1 — sizing (step one of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`)

**Date:** 2026-08-31 · **Status:** sizing COMPLETE, awaiting PO ruling · **Owner:** lead + backend
**Instrument:** [`scripts/authz-c2-tier1-sizing.sql`](../../scripts/authz-c2-tier1-sizing.sql)
(re-runnable; derives every figure from the live catalog, quotes none)
**Measured against:** local catalog at `main` `34a0e854`, 501/501 migrations applied.

> ⚠ **Not to be confused with PA-F11 / ADR 0162's "Tier 1" (523 remotely-reachable
> functions,** [`authz-ae1-tier1-threat-review.md`](authz-ae1-tier1-threat-review.md)**).**
> That is a different population and a different obligation. AE1 **characterized** C2's
> command doors and explicitly did **not** sweep them.

---

## 1. What sizing owed

The PO ruling of 2026-08-18 (`docs/progress/follow-ups.md:946-990`, `decisions-log.md:266`)
split the command-door backlog into **Tier 1** — "the subset that **touches PHI or crosses a
tenant boundary**", swept next — and **Tier 2**, deferred past the pilot. It then bounded the
method: *"Tier 1's population is DERIVED FROM THE CATALOG AS A PROPERTY, never hand-listed"*,
and *"**Sizing Tier 1 — deriving the predicate and counting what it returns — is step one and
is NOT yet done.**"*

So step one owes exactly two things: **a predicate expressed over the catalog**, and **the
count it returns**. Both are below.

## 2. Parent population — re-derived, not quoted

ARM=census's five conjuncts (`p0-authz-invariant.sh:373`): `prosecdef` ∧ return ≠ `trigger` ∧
not set-returning ∧ return ≠ `bool` ∧ (`authenticated` ∨ `anon` holds EXECUTE), over
`public` + `app`.

| schema | doors |
| ------ | ----: |
| `public` | **345** |
| `app` | **82** |
| **total** | **427** |

Agrees with the § Critical FUP C2 row's own 2026-08-31 re-derivation, reached here by an
independent query path. The instrument re-derives it every run; **do not quote 427 forward.**

## 3. The instrument

Three catalog-derived stages, all re-computed per run:

1. **Bodies** — `prosrc` for all 1 075 `app`/`public` functions, `--` comments stripped first
   (a line-filtered `prosrc` under-reports multiline guards).
2. **Call graph** — 2 300 edges, `caller → callee` where the callee's name appears
   word-bounded and followed by `(`. Transitive closure to depth 8 → 5 807 (root, fn) pairs.
3. **Relation references** — 1 896 (fn, relation) pairs, word-bounded name match; lifted
   through the closure to 3 997 (door, relation) pairs.

**Known over-approximation:** the reference match is textual, so a relation named for a common
word can match inside a string literal, and dynamic `execute` is invisible. Both err **wide**,
which is the safe direction for deciding sweep membership.

## 4. Marker sets — what "PHI" and "tenancy" can actually be keyed on

| marker | relations | verdict |
| ------ | --------: | ------- |
| **(a) PHI by comment convention** (`PHI-BEARING` / `ISOLATED PHI`) | 28 | ⛔ **UNSOUND ALONE** |
| **(b) door-only** — `authenticated` holds no table SELECT | 23 | ✅ hard catalog fact |
| **(c) tenancy-anchored** — carries `organization_id` / `hospital_id` / `commission_id` | 54 | ✅ hard catalog fact |

⛔ **(a) is not a usable marker on its own, and this is a finding in its own right.** The
convention is prose, and prose polarity is not machine-decidable:

- On table comments the mention splits **12 positive-ish / 31 negative-ish / 7 ambiguous**, and
  a positive regex captures `patient_xref` (*"is **NOT** a PHI store"*) and `printed_documents`
  (*"**ZERO** PHI in columns"*) — the negation sits inside the matched phrase.
- On column comments it splits **29 / 27 / 10**.
- A column-comment rule alone captures **0 of 6** canonical PHI stores; adding table comments
  reaches **4 of 6**, still missing `patient_participants` and `profile_private_details`.
- **50 base tables carry no comment at all** — undecidable, not clean.

Marker **(b)** captures **6 of 6** canonical PHI stores and is a hard `has_table_privilege`
fact, so it carries the PHI arm. There is **no** catalog-side PHI-audit vocabulary to key on
instead: `audit_log.action` is free text under a single shape CHECK (`position('.' in action) > 1`).

## 5. The counts

Closure grain (a door plus its transitive callees):

| candidate | doors | % of 427 |
| --------- | ----: | -------: |
| A — PHI by comment | 230 | 53.9 % |
| B — reaches a door-only relation | 375 | 87.8 % |
| C — reaches a tenancy anchor | 395 | 92.5 % |
| **D — A ∨ B (PHI, either marker)** | **387** | **90.6 %** |
| **E — A ∨ B ∨ C (THE LITERAL RULING)** | **405** | **94.8 %** |
| B\* — B minus 4 infra relations *(hand-list)* | 182 | 42.6 % |
| D\* — A ∨ B\* *(hand-list)* | 262 | 61.4 % |

## 6. Positive controls — which candidates survive

⛔ A candidate that drops a known PHI door is **falsified**, however much cheaper it is.
`assume_role` is in Tier 1 **by construction** per the ruling (`platform_role` crosses every
tenancy boundary).

| control | D closure | D0 depth-0 | D\* hand-list | E literal |
| ------- | :-------: | :--------: | :-----------: | :-------: |
| `assume_role` | ✅ | ✅ | ⛔ **f** | ✅ |
| `create_case` | ✅ | ⛔ **f** | ✅ | ✅ |
| `dispose_case_phi` | ✅ | ✅ | ✅ | ✅ |
| `get_referral_patient` | ✅ | ✅ | ✅ | ✅ |
| `set_event_patient` | ✅ | ✅ | ✅ | ✅ |
| `set_participant_patient` | ✅ | ⛔ **f** | ✅ | ✅ |

- **Depth-0 is FALSIFIED.** It is much cheaper (194 vs 387) but drops `create_case` and
  `set_participant_patient` — the two gates of the case PHI **write** path that Rule 12's own
  amendment names. They delegate to `app._set_participant_patient_unchecked`, so the PHI never
  appears in the door's own body.
- **D\* is FALSIFIED** on `assume_role`, and is a hand-list besides — inadmissible under
  method rule 1 unless the PO restates the exclusion as a property.
- **Only D (387) and E (405) pass all six controls with no hand-list.**

## 7. ⛔ The finding: the tier split does not split

**The ruled predicate, derived honestly, returns 405 of 427 — 94.8 %.** Tier 1 is not a subset
worth the name; Tier 2 is 22 doors, all of them internal helpers (`answer_map*`,
`published_version_of_*`, `ensure_answer_rows`, …).

The two disjuncts behave completely differently, and the reason is structural:

- **The PHI arm discriminates** — 230–387 depending on marker, a real partition.
- **The tenancy arm cannot.** It alone returns **395 / 92.5 %**, because a DEFINER door bypasses
  RLS and must therefore re-establish tenancy itself. Every gated door reads
  `profiles` (**354** of 427 reach it), `memberships` (**346**), `commissions` (**246**),
  `hospitals` (**159**). "Crosses a tenant boundary" is true of nearly every door *by design* —
  the predicate measures **"is tenancy-gated"**, not **"crosses a boundary"**, and at that grain
  it carries almost no information.

This is the classic failure the register already names: *a predicate quoted at the wrong grain* —
a real filter cited for a conclusion it does not bound. The tiering was created to make the
sweep affordable; as ruled it does not.

## 8. What the PO must now rule

Sizing is done; the number is the answer, and the answer is that the ruling needs revisiting.
Three options, with their costs:

1. **Accept Tier 1 ≈ 387–405 doors** and fund the sweep. At the door-audit grain (~1 min/door,
   full suite per neutralization) that is **~6.5–7 h**; at the `ae13` grain (one suite *file*,
   ~30–60 s/door) **~3.5–7 h**. Tier 2 becomes 22 helper doors and the split is cosmetic.
2. **Drop the tenancy disjunct and sweep on PHI alone — 387 doors (D).** Barely cheaper, because
   marker (b) is dominated by `profiles` and `feature_flags` (reached by 354 and 328 doors).
3. **Re-grain the predicate.** The only variant that meaningfully cuts the population is
   D\* at **262 (61.4 %)**, which excludes four infra relations — but that exclusion is a
   **hand-list**, inadmissible under the PO's own method rule until restated as a property,
   and it is **falsified on `assume_role`** as it stands.

⚠ **A fourth thing is owed under every option:** no **command-door neutralizer** exists. All
three existing harnesses (`p0-authz-door-audit.sh`, `ae13-…`, `p0137-…`) open a **boolean** gate
or a policy `USING`. A 427-population door returns `jsonb` / `uuid` / `void` — there is no
boolean to flip. That instrument is unbuilt and unsized, and it is the actual long pole.

## 9. Absorbed items — status unchanged

Both remain absorbed and **absorption is not closure**; each keeps its own index line and needs
its own recorded verdict.

- **`FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN`** — successor `app.resolve_document_version_bytes`.
  Confirmed present in the parent population, so it is inside Tier 1 under D and E alike.
- **`FUP-DM5-SIBLING-GUARD-DIFF`** — wants a transitive guard-set diff over `prosecdef` doors.
  The call-graph + closure stages built here are the substrate it needs; the diff itself is
  unbuilt. It closes on *the diff existing with a positive control*, not on Tier 1 shipping.

## 10. What this does NOT do

- It does **not** sweep anything. No door has a recorded verdict as a result of this work.
- It does **not** close C2, either tier, and it does not close either absorbed item.
- `assume_role` remains **ERROR-shaped, not COVERED**, and must be resolved *within* Tier 1.
- The 3-door neutralization sample still closes nothing.

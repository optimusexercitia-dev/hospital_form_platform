# C2 Tier 1 — sizing (step one of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`)

**Date:** 2026-08-31 · **Status:** sizing COMPLETE · predicate **RE-GRAINED and ADOPTED** (§8b) ·
**Owner:** lead + backend
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

## 8. The fork the sizing opened *(ruled — see §8b)*

Sizing was done; the number was the answer, and the answer was that the ruling needed revisiting.
Three options were put: **(1)** accept Tier 1 ≈ 387–405 and fund the sweep (~3.5–7 h) with a
cosmetic Tier 2 of 22 helpers; **(2)** drop the tenancy disjunct and sweep PHI alone — 387, barely
cheaper, because marker (b) was dominated by `profiles` (354) and `feature_flags` (328); **(3)**
re-grain. The only population-cutting variant available *at that point* was 262 (61.4 %) via a
**hand-list** of four infra relations — inadmissible under the method rule, and falsified on
`assume_role`. **The PO ruled option 3.**

## 8b. ⭐ THE RE-GRAIN — adopted 2026-08-31

Two changes, each a catalog property. Result: **Tier 1 = 237 of 427 (55.5 %), Tier 2 = 190**, all
six positive controls passing, **no hand-list anywhere in the derivation**.

### Change one — a GATE-AWARE closure

⭐ **A predicate that CHECKS whether you may read PHI is not itself a PHI-touching door.** The
first sizing descended through every call edge, so every gated door inherited whatever its authz
predicates read — which is exactly why `profiles` and `feature_flags` dominated. The fix: **never
descend into a boolean-returning callee.** Return type is a catalog fact, so this is a property,
not a name filter.

| arm | all-edges | gate-aware |
| --- | ---: | ---: |
| PHI | 387 (90.6 %) | **237 (55.5 %)** |
| tenancy | 395 (92.5 %) | 346 (81.0 %) |

Under the gate-aware closure `profiles` and `feature_flags` leave the top of the reach table
entirely — confirming they were gate-driven, not data-driven.

### Change two — the TENANCY disjunct is DROPPED, not re-grained

It was given every chance and cannot partition:

| tenancy variant | doors | % |
| --- | ---: | ---: |
| all-edges closure | 395 | 92.5 % |
| gate-aware closure | 346 | 81.0 % |
| gate-aware, minus tenancy ROOTS and the hash-chained AUDIT SINK (both derived as properties) | 318 | 74.5 % |

Its top drivers after every exclusion are `cases` (94), `memberships` (36), `case_interviews`
(30), `meetings` (28), `capa_plan` (26), `responses` (25) — **the ordinary business tables**.

⛔ **"Crosses a tenant boundary" is a domain tautology here, not a filter.** A DEFINER door
bypasses RLS and must re-establish tenancy itself; in a multi-tenant governance platform,
operating on tenant-scoped data is what every command door *does*. A predicate true of ~80 % of
the population carries almost no information, and no further exclusion rescues it without becoming
the hand-list the method rule forbids.

⚠ **What dropping it costs, stated plainly.** Tier 1 no longer claims to prioritise
tenant-isolation risk among the command doors; those doors move to **Tier 2 (deferred), they are
NOT cleared**. Tenant isolation is not thereby unmeasured platform-wide — `ARM=hat`, `ARM=floor`
and `ARM=policy` all bear on it; C2's gap was always specifically the *command doors*, and this
ruling decides which of them go first.

### The adopted predicate

> **Tier 1** = a command door (ARM=census's five conjuncts) whose **gate-aware call closure**
> reaches a relation that is either **door-only for `authenticated`** (`has_table_privilege`
> false — a DEFINER door is the only access path) **or** carries a **positive-polarity PHI
> comment** on the table or any column.

Marker (b) remains **unsound alone** (§4) and is used only in UNION with the hard fact (a), where
it can only widen. Erring wide is safe for deciding *membership*; it would not be safe for
exclusion. What drives Tier 1 is now recognisably the PHI surface — `case_referral` (51), `rca`
(46), `case_interviews` (30), `profiles` (29), `meetings` (28), `capa_plan` (26),
`patient_safety_event` (21), `case_narratives` (19), `referral_patient` (16), `event_patient`
(15), `patient_identifiers` (9).

`assume_role` — in Tier 1 **by construction** per the ruling — survives on the PHI arm alone, via
`profiles` and `app.active_role_selections`, both door-only. It never needed the tenancy disjunct.

### Controls, re-run

| control | ADOPTED (gate-aware) | all-edges | depth-0 |
| --- | :---: | :---: | :---: |
| `assume_role` | ✅ | ✅ | ✅ |
| `create_case` | ✅ | ✅ | ⛔ |
| `dispose_case_phi` | ✅ | ✅ | ✅ |
| `get_referral_patient` | ✅ | ✅ | ✅ |
| `set_event_patient` | ✅ | ✅ | ✅ |
| `set_participant_patient` | ✅ | ✅ | ⛔ |

### Worklist

`supabase/tests/mutation/c2-tier1-doors.txt` — **237** lines, emitted by the instrument's
`TIER 1 WORKLIST` block. ⛔ Derived, never edited; a dated snapshot of a derivation, not an
authority. **A door absent from it is not thereby cleared** — it is Tier 2, deferred.

⚠ **Unchanged by this ruling: no command-door neutralizer exists.** 237 doors still cannot be
swept until one is built, and it remains unbuilt and unsized — the actual long pole. All three
existing harnesses open a **boolean** gate or a policy `USING`; these doors return
`jsonb`/`uuid`/`void`, so there is no boolean to flip.

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

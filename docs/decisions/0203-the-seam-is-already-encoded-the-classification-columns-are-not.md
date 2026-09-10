# ADR 0203 — Audit F5's seam is already encoded as data in the enforcement manifest; the three classification columns are not, and their disposition is the PO's

**Status:** proposed — 2026-09-09 (pre-AE5 remediation Batch 9, unit `AE5-OPENING-ADR`, PO ruling R7's second ADR). ⭐ **All three Decisions are RULED.** D3 travelled as `PO to rule` and was **ruled 2026-09-10 by PO ruling R11**: option **(C)** — keep all three classification columns, each owing a **named layer-3 consumer**. See § Decision D3 and § Considered options (C).
**Date:** 2026-09-09
**Area:** authorization / audit F5's four-way enforcement seam / `authz.permissions`' deferred classification columns / what counts as a consumer
**Amends:** ADR [0172](./0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md) (§ 4 — its deferral is re-scoped precisely: 0172 defers column **creation**, and its own 2026-09-01 amendment already overturned that for `sensitivity_ceiling`; what this ADR ratifies is the **seam** those columns were created to serve, and it corrects the loose citation *"ADR 0172 defers them"*) · ADR [0176](./0176-authz-permission-layer-made-real.md) (the four-column **no-reader list** at `:45-47` is now **three**, and D8's clause *"layer 3 is where their consumer appears, or they leave with a named reason"* is discharged in two moves rather than one: the **seam** is closed by D1, and the **columns** are settled by D3 on the clause's ***"a consumer appears"*** branch (PO ruling R11, 2026-09-10) — ⛔ not on its *"leaves with a named reason"* branch)
**Related:** ADR [0193](./0193-the-enforcement-manifest-declares-what-it-measured.md) (D1–D4 — the manifest became an oracle; D3's provenance value already carries the *"only 3 of the 7 classes have a gate"* bound in its own name) · ADR [0195](./0195-a-committed-number-needs-one-home-and-a-gated-mirror.md) (a committed number needs one home and a gated mirror — every figure below names what watches it) · ADR [0201](./0201-the-keying-asymmetry-is-the-model.md) (Batch 9's other ADR; F6's two axes) · ADR [0078](./0078-authorization-capability-model.md) (the live catalog is truth) · ADR [0182](./0182-statement-scoped-authorized-scope-ids.md)
⛔ **Supersedes nothing.**

---

## Context

**Measured on the live catalog** (ADR 0078) at migration head pair **`(20261003007360, 525)`**,
container `supabase_db_azkbbhskturikxpgmafq`, discriminated by `authz` = **5 tables / 16 columns**.

Audit finding **F5** asked for one thing decided *before* AE5: the **seam** along which enforcement
divides — **entitlement**, **hard-deny**, **lifecycle**, **sensitivity** — so that eleven role
increments do not each invent their own partition. ADR 0176 D8 bundled it, adding the columns'
own clause: *"The classification columns stay deferred per 0172 — layer 3 is where their consumer
appears, or they leave with a named reason"* (`0176:153-155`).

**The seam is already encoded, as data, in `supabase/tests/vectors/authz-enforcement-manifest.json`
— and three of its four sections already have gates.** Measured section by section:

| seam section | where it lives | population | what gates it |
| --- | --- | --- | --- |
| **entitlement** | per-row `domainAuthorizer` + `enforcementSites` (+ `status`, `pendingRekey`, `definerSurface`, `nonEnforcementConsumers`, `residualLegacyAuthority`) | **3** of 43 rows carry a non-null authorizer; the same **3** carry non-empty sites | `410` § 8.4's policy-axis closure, § 8.5, § 4.6's verbatim residual-arm pin; the generator's `composedWith` cross-check (a one-sided edit fails generation) |
| **hard-deny** | top-level `hardDenyVocabulary` + per-row `hardDenyClasses` / `hardDenyProvenance` | **7** classes, of which **3** name a `gate` and **4** are `"gate": null` | `410` § 6.2 as a fixed point over the composed-call closure, with § 6.2b's synthetic-root discrimination control and § 6.2c (ADR 0193 D1/D2/D4) |
| **lifecycle** | top-level `lifecycleDerivation` + per-row `axes.resourceLifecycle` / `resourceLifecycleProvenance` | **43 of 43** rows carry a value | ⛔ **nothing**, and the manifest says so itself: *"there is NO catalog column encoding lifecycle, so 410 asserts NOTHING about these values … the one field in a row that no gate can contradict"* |
| **sensitivity** | per-row `axes.sensitivity` and `catalog.sensitivityCeiling`; **and** a `hardDenyVocabulary` entry | `axes.sensitivity` on **43 of 43** rows, three values (`none` / `phi` / `class2_professional_identity`), **0** rows disagreeing with `catalog.sensitivityCeiling` | `410` § 2.3 — *"THE FOUR-COLUMN MIRROR"*, `410:118-133` — plus the M9 lint arm at `scripts/gen-authz-matrix-cells.mjs:704`; ⭐ it is **§ 2.3's own assertion message** that states the watching relation, calling **itself** *"the fuse"* that gives that lint arm teeth (`410:129-131`) |

⚠ **CITATION CORRECTED 2026-09-10 (QA finding MAJOR-2) — the *"fuse"* sentence was attributed to
the wrong file, and the attribution is the half that was wrong.** This ADR's draft read *"the lint
arm at `gen-authz-matrix-cells.mjs:704`, whose own comment calls § 2.3 'the fuse' that gives it
teeth"*. Measured: `grep -rn "the fuse" scripts supabase src` returns **two** hits and neither is
that comment — `410:129` and a migration header (`20261003007200:18`). The phrase lives in **§ 2.3's
own message**, `410:129-131`:

> `'re-reviews its enforcement row. ⚠ This is also the fuse that gives lint''s '`
> `'axes.sensitivity == catalog.sensitivityCeiling arm real teeth: lint pins the two manifest '`
> `'fields to each other, and this pins one of them to the database. ...'`

The generator's M9 comment (`:699-700`) says something compatible but weaker and does not use the
word: *"sensitivity is declared TWICE (as an axis and as the catalog mirror) and fused, so 410's
catalog binding on `catalog.sensitivityCeiling` also pins the axis value."* ⇒ the **teeth**
direction as drafted (§ 2.3 gives the lint arm teeth) was correct; **which file says so** was not,
and under ADR 0195 the one place this ADR names a watching relation must name it from the file that
carries it. ⚠ For the record, QA graded this *"the watching relation is INVERTED"*; measured, the
inversion is in the **attribution**, not in the teeth relation — the fix is the same either way.

⭐ **The framing this batch arrived with — *"3 of 4 encoded"* — is understated, and correcting it
changes the question.** Sensitivity is encoded **twice**: as a per-row axis that **is** gated (§ 2.3
pins it to the catalog column; the lint arm pins the two manifest fields to each other), and as a
`hardDenyVocabulary` class that is **not**:

```json
    "sensitivity_ceiling":        { "gate": null, "note": "Rule 12 / class-2 professional identity; ADR 0172 defers the column's runtime consumer" }
```

— `authz-enforcement-manifest.json:250`. It is the **only** entry in that vocabulary whose `note`
points at a **deferral** rather than at a mechanism; the other three `gate: null` entries point at
Architecture Rules 3 and 5 and at the UUID id-space, i.e. at enforcement that exists and that no
call search can see.

## Problem

Two questions arrive as one, and **only one of them is decidable without the PO.**

**(1) Is the manifest's four-section encoding *the* seam model?** Decidable here: it is measurable,
it is already the oracle three gates read, and F5's ask was for a partition rather than for new
machinery.

**(2) What becomes of `risk_class`, `sensitivity_ceiling` and `resource_kind`** under 0176 D8's
*"a consumer appears, or the column leaves with a named reason"*? ⛔ **Not the drafter's to decide**
— it disposes of shipped columns on a table AE5 is about to build eleven increments over. It was put
to the PO with the three options and their measured consequences below, and **PO ruling R11
(2026-09-10) answered it: option (C)**. § Decision D3 records the ruling; § Considered options keeps
all three options with the chosen one marked, because the **rejected** consequences are the ruling's
basis and deleting them would leave D3 asserting a choice with no visible price.

**The reader census, and ⛔ every zero carries its control in the same query.** `authz.permissions`
holds **43** rows and five columns — `code` plus four `text` columns over domains (`resource_kind`,
`risk_class`, `sensitivity_ceiling` over domain `authz.sensitivity_class`, `resolution_scope_kind`),
all **NOT NULL**, none with a default, with `permissions_pkey` as the table's only index. One
instrument, five column names, run over six catalog surfaces:

| column | `pg_proc` bodies | `pg_views` | `pg_policies` | `pg_constraint` | `pg_indexes` | `pg_attrdef` | `src/` files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `risk_class` | **0** | 0 | 0 | 0 | 0 | 0 | **0** |
| `sensitivity_ceiling` | **0** | 0 | 0 | 0 | 0 | 0 | **0** |
| `resource_kind` | **0** | 0 | 0 | 0 | 0 | 0 | **0** |
| `resolution_scope_kind` ⭐ CONTROL | **3** | 0 | 0 | 0 | 0 | 0 | 0 |
| `session_selectable` ⭐ CONTROL | **1** | 0 | 0 | 0 | 0 | 0 | 1 (a **comment**) |

- The `resolution_scope_kind` control names its three readers — `authz.has_permission`,
  `authz.candidate_has_permission`, `authz.explain_permission`. ⇒ **2 of the 5 columns are
  runtime-read, 3 are not**: the instrument distinguishes, so the zeros are measurements.
- **Self-tests on the two arms most likely to be dead.** `pg_policies`: the same query counts
  **278** policies in `public`, 4 in `storage`, 1 in `app` — it sees policies; there are none on
  `authz`. `src/`: the same grep for `sensitivity_class` hits **2** files, and
  `src/lib/types/database.ts` carries **no `authz` schema at all**, so no generated type could read
  these columns even in principle.
- **Nothing outside a DEFINER could read them anyway.** All five `authz` tables have RLS
  **enabled** with **ZERO** policies; `has_table_privilege('authenticated'|'anon', …, 'SELECT')` is
  **false** on all five, and `has_column_privilege('authenticated', 'authz.permissions', <col>)` is
  **false** for every one of the five columns (checked separately — a column-list grant would have
  bypassed the table answer). All **10 of 10** functions in `authz` are `prosecdef`. ⇒ a consumer
  must be one of those ten, and three of them are the control's readers.

**⛔ FRAMING CORRECTION 1 — *"ADR 0172 defers them"* is imprecise in two directions.** 0172 § 4
— header `0172:112`, *"Three classification columns are NOT CREATED; `risk_class` is (PO
override)"* — defers column **CREATION** for `sensitivity_ceiling`, `assignable` and
`applies_to_descendants`, the choice stated at `0172:115` (*"**Not-created is chosen for**
`sensitivity_ceiling`, `assignable` and `applies_to_descendants`"*) — and its own amendment block at
`0172:124-136` **overturned** that for `sensitivity_ceiling` on a PO ruling of 2026-09-01 (*"The
reasoning below was not wrong; its stated reason EXPIRED"*), with migration `20261003007130`
creating it. *(⚠ Anchors corrected 2026-09-10, QA finding MAJOR-2: this ADR's draft cited `0172:102`
and `0172:114-119`. Measured with `sed -n`, `:102` is inside § 3 — *"by `memberships_role_check`.
That CHECK **retires at AE5-complete**"* — and `:114-119` is the § 4 **body**, i.e. the text the
amendment overturns rather than the amendment. The substance below was verbatim-supported
throughout; only the two pointers were wrong.)* What 0172 keeps deferred is the
**ordering / comparison rule**, gated by a constructed detector at `401` §§ 13.6–13.7. The
**consumer** deferral this ADR is asked about is **ADR 0176's** (`0176:153-155`), not 0172's.

**⭐ FRAMING CORRECTION 2 — the no-reader list is FOUR columns, it is now THREE, and the arm has
already fired once.** `0176:45-47` reads, verbatim:

> *"Callers of `has_direct_permission` in `pg_proc`: **none**. Readers of `role_permissions`: the
> resolver and its explanation only. Readers of `session_selectable`, `risk_class`,
> `sensitivity_ceiling`, `resource_kind`: **none**."*

`authz.roles.session_selectable` **now has a reader**: `public.assume_role` fails closed on it
(*"FAIL CLOSED: a role with no catalog row is NOT selectable"*), gated by `408` — including a
mutation twin at its § 3 flipping one real role's `session_selectable` `true → false` and asserting
that role becomes unassumable. ⇒ **0176 D8's *"a consumer appears"* arm has already been exercised
once, and it landed with a gate on the first try — which is this ADR's strongest input to D3.**
⛔ It is also a stale figure **no gate can contradict**: `0176:45-47` is ADR prose and `npm run
lint` has no Docker, so a pgTAP mirror would buy *"the next Phase Gate noticed"*, never *"the next
commit noticed"*. This ADR is the correction's one home (ADR 0195) and ships **no** mirror.

## Decision

**D1 — RATIFY the enforcement manifest's four sections as audit F5's seam model.** The seam is
`entitlement | hard-deny | lifecycle | sensitivity`, and it is **already declared as data** at the
field names tabulated in § Context; F5 is closed by ratification, not by new machinery. Two bounds
travel with the ratification and are part of it:

1. **Lifecycle is the one section no gate can contradict**, by its own admission — there is no
   catalog column encoding lifecycle. It stays an internal-consistency subject. ⛔ It must never be
   cited as an enforced axis, and `po-approved` stays reserved for the day it gets an oracle.
2. **Entitlement is populated on 3 of 43 rows** and 40 still carry `not-attributable-until-rekey`.
   That is the AE4 scope (ADR 0176 D6), not a defect — and it is exactly what AE5's eleven
   increments fill in. Each increment therefore **owes a re-measurement** of its row's
   `hardDenyClasses`, per ADR 0193's own consequence.

**D2 — `hardDenyVocabulary.sensitivity_ceiling`'s `"gate": null` is CORRECT and STAYS, and what was
missing was never a gate.** Ruled:

- A `gate: null` is an **honest declaration** that no call-reachable function *is* this class, and
  ADR 0193 D3 already carries the bound **in the provenance value's own name**
  (`measured-transitive-over-gated-classes`, 3 of 7 gated). Inventing a gate here is the exact
  defect 0193 D1 exists to prevent.
- ⛔ **What distinguishes this entry is its `note`, not its `gate`:** it is the only one pointing at
  a **deferral** rather than a **mechanism**. The other three `gate: null` classes are enforced by
  things no call search can see (two triggers, the UUID id-space); this one is enforced by **nothing
  at all** pending D3 — and the manifest does not mark that difference.
- ⇒ **The entry is retained as the seam's sensitivity slot however D3 falls**, because the
  sensitivity *seam* is independent of the *column*: `axes.sensitivity` sits on 43 of 43 rows,
  pinned to `catalog.sensitivityCeiling` by the lint arm, which `410` § 2.3 pins to the database.
  Its `note` is rewritten to name **D3's ruling** instead of a standing deferral; ⛔ it is not
  deleted merely because a column is.
- ⚠ **`410` § 2.3 may not be cited as closing F5** — it says so itself: *"a TEST reader is not a
  consumer, and this assertion must never be cited as closing IA-F5."* Honoured: D1 closes the
  **seam**, and D3 — not § 2.3 — is what closes the columns.

**D3 (PO ruling R11, 2026-09-10) — KEEP ALL THREE classification columns: `risk_class`,
`sensitivity_ceiling` and `resource_kind`, EACH OWING A NAMED LAYER-3 CONSUMER.** Option **(C)**.
0176 D8's clause is discharged on its ***"a consumer appears"*** branch — ⛔ never on *"leave with
a named reason"*, and ⛔ never as *"leave them, nobody is hurt"*, which was not available as a
status quo because D8's clause is a disjunction with no third branch. Three things travel with the
ruling and are part of it:

1. **Each column owes a *named* layer-3 consumer**, not *"a consumer eventually"*. The shapes are
   named in § Considered options (C) so the option was concrete when it was chosen: `risk_class`
   — a resolver-side refusal to let a `read` grant satisfy a `write` code; `resource_kind` — the
   PHI-separation join `401` § 13.8 already does structurally, moved into `authz.has_permission`;
   `sensitivity_ceiling` — the AE5 `phi` split `401` § 13.7 names. ⛔ Each new reader arrives with
   a **RED-first** gate; a consumer landed without one buys the column a reader and the corpus no
   assertion.
2. **Sequenced AFTER AE5 increment 1, not before it.** Each consumer is a behaviour change on the
   resolver those eleven increments substitute through — the concentration risk 0176 D8 exists to
   manage — so the sequencing is itself part of the ruling, per § Considered options (C)'s third
   consequence.
3. **`authz.roles.session_selectable` is the cited precedent, and it is a worked one rather than an
   analogy.** It was the **fourth** column on `0176:45-47`'s no-reader list; it now has
   `public.assume_role` as a fail-closed reader, gated by pgTAP `408` — including a mutation twin at
   its § 3 that flips one real role's `session_selectable` `true → false` and asserts the role
   becomes unassumable. ⇒ the *"a consumer appears"* arm has already fired once and landed with a
   gate on the first try (§ Problem, Correction 2).

**⛔ The removal options were DECLINED ON MEASURED COST, and the cost is two invariants PLUS the
control that proves they are two.** `401` **§ 7 — THE PHI / WRITE SEPARATION INVARIANTS** (header
`401:369`) uses `resource_kind` and `risk_class` as an **ordering** over the implication closure —
the detectors at `401:380` (a non-PHI permission must not imply a PHI one) and `401:390` (a `read`
must not imply a `write`) — and **five** cells rest on them: `:397` and `:406` the constructed
violations, `:414` and `:416` the real edge set, and ⭐ `:408`, which is a **DISCRIMINATION
CONTROL** — *"7.3 DISCRIMINATION CONTROL: that same read->write edge is NOT flagged by the PHI
check — the two invariants are independent, not one predicate counted twice"*. ⇒ removal is not a
test edit: it loses the two invariants **and** the control that licenses calling them two, and the
surviving substitute is a substring test on a permission **code** that `401` § 13.8's own message
calls the weaker instrument *"which a rename defeats silently"*. Option (B) does not soften this —
`401:380` and `401:390` are precisely the two columns (A) and (B) both drop. ⚠ **One home, and it is
not this paragraph** (ADR 0195): the per-cell detail behind these anchors lives once, in
§ Considered options (A), and is restated here only because a ruling that does not carry its own
basis is a preference. An editor who moves one of these anchors moves **both**.

⚠ **What D3 does NOT do.** It adds no consumer, no migration and no gate in Batch 9 — Batch 9 is
doc-only by PO ruling R1 and the empty-pathspec assertion is this batch's defining claim, so every
consumer above is a later batch's migration. It does not date the three consumers beyond *"after
increment 1"*: naming the increment each one rides is routing, owed at the Record step, and until it
is done the only place that obligation can live is an open follow-up entry (§ Consequences).

## Considered options

**For D3 — the three columns.** ✅ **Decision: (C), PO ruling R11, 2026-09-10.** ⛔ All three
options stay here with their measured consequences — the **rejected** consequences are the ruling's
stated basis, so removing them would leave D3 asserting a choice whose price is invisible.
Consequences are measured, not estimated.

**(A) Remove all three** (`risk_class`, `sensitivity_ceiling`, `resource_kind`), with the named
reason being the census above. ⛔ **REJECTED (R11)**, on the first consequence below. Consequences:

- ⛔ **This is an INVARIANT LOSS, not a test edit**, and it is the decisive fact. ⚠ *(Section
  attribution corrected while drafting: these cells are `401` **§ 7 — THE PHI / WRITE SEPARATION
  INVARIANTS**, header at `401:369`, not § 12 — `401:627` is the AE4.5 generator section. The line
  numbers are right; the section label was not.)* § 7 uses two of the columns as an **ordering**
  over the implication closure: the detector at `401:380` — `ing.resource_kind <> 'phi' and
  ied.resource_kind = 'phi'`, a non-PHI permission must not imply a PHI one — and at `401:390` —
  `ing.risk_class = 'read' and ied.risk_class in ('write', 'authority', 'irreversible')`, a read
  must not imply a write. **Five** cells rest on them: `:397` / `:406` constructed violations,
  `:414` / `:416` the real edge set, and ⭐ `:408` — *"7.3 DISCRIMINATION CONTROL: that same
  read->write edge is NOT flagged by the PHI check — the two invariants are independent, not one
  predicate counted twice"*. Delete the columns and those invariants cannot be **expressed**, let
  alone asserted; the surviving substitute is a substring test on a permission **code**, which
  `401` § 13.8's own message calls out as the weaker instrument *"which a rename defeats
  silently"*.
- `401` §§ 11.1–11.3 (domain rejection + positive twin), the whole of § 13 (`13.1` existence,
  `13.2` NOT NULL, `13.3` no default with its stated fail-open reasoning, `13.6`/`13.7` the ordering
  detector and its vacuity control, `13.8` the sensitivity ↔ `resource_kind` PHI agreement,
  `:850-853` the non-vacuity guard) all go, plus `410` § 2.3's four-column mirror drops to a
  one-column mirror and the lint arm at `gen-authz-matrix-cells.mjs:704` loses the fuse § 2.3's own
  message names at `410:129-131`.
- Three `authz` domains (`risk_class`, `resource_kind`, `sensitivity_class`) become unreferenced.
- ⚠ `401` § 13.7's own text names a **future** consumer inside AE5: *"When AE5 splits `phi` into
  standard/restricted and the PO rules an ordering, this assertion is the one to change
  DELIBERATELY."* Removal forecloses that without deciding it.

**(B) Keep `sensitivity_ceiling` only**, on the `gate: null` slot D2 retains; remove `risk_class`
and `resource_kind`. ⛔ **REJECTED (R11)** — it incurs (A)'s invariant loss in full and adds one of
its own. Consequences:

- Keeps the column the corpus has the most machinery around (§ 13's nine cells, the three-value
  partition `none | class2_professional_identity | phi` over 35 / 3 / 5 rows, the deferred-ordering
  detector) and the one AE5 has a named future use for.
- ⛔ **Still incurs the full § 7 invariant loss of (A)** — `401:380` and `401:390` are precisely
  the `resource_kind` and `risk_class` detectors, and 7.3's independence control dies with them.
  Worse, § 13.8's cross-check (`sensitivity_ceiling = 'phi' and resource_kind <> 'phi'` → 0) needs
  **both** columns, so keeping only `sensitivity_ceiling` silently retires the assertion that the
  two independently-declared columns agree — the very cell § 13.8 says upgrades the PHI invariant
  *"from a substring test on a permission CODE … to a join on a COLUMN"*.
- Leaves the seam's sensitivity slot with a column and no runtime reader — i.e. the same state that
  produced this question, now with a named reason rather than a deferral.

**(C) Keep all three, each with a NAMED layer-3 consumer and a date.** ✅ **CHOSEN (R11,
2026-09-10)** — see § Decision D3. Consequences:

- Discharges 0176 D8's clause on its *"a consumer appears"* branch instead of its *"leaves with a
  named reason"* branch — and there is a **worked precedent for exactly that**:
  `session_selectable` went from this same no-reader list to a fail-closed read in
  `public.assume_role` with a `408` mutation twin (Correction 2). ⇒ the arm is known to be
  executable, not hypothetical.
- Costs three consumers plus three RED-first gates, inside or before AE5. Plausible shapes, named so
  the option is concrete rather than aspirational: `risk_class` — a resolver-side refusal to let a
  `read` grant satisfy a `write` code (today § 7 checks the closure, never the resolution);
  `resource_kind` — the PHI-separation join § 13.8 already does structurally, moved into
  `authz.has_permission`; `sensitivity_ceiling` — the AE5 `phi` split § 13.7 names.
- ⛔ **Each new runtime reader is a behaviour change on the resolver AE5 substitutes eleven
  increments through**, which is the concentration risk ADR 0176 D8 exists to manage. Sequencing it
  *after* increment 1 rather than before is itself part of the ruling.
- Present distributions, so an option is not chosen against an imagined table: `risk_class` read
  **13** / write **22** / authority **4** / irreversible **4**; `resource_kind` commission_content
  **29** / identity **5** / phi **5** / audit **2** / vocabulary **2**; `sensitivity_ceiling` none
  **35** / class2_professional_identity **3** / phi **5**.

**For D1, the rejected alternative** was to write F5's seam as prose in `docs/backend-state/` and
leave the manifest as an implementation detail. ⛔ Rejected: that is the shape ADR 0193 was created
to end (*"a prose claim about a measurement, written beside a correct measurement, that no gate can
contradict"*), and one fact would then have two homes (ADR 0186).

## Consequences

- **F5's seam is closed by D1; the columns are RULED by D3 and NOT YET DISCHARGED** — two
  different states, and conflating them is how this ADR would read as finished. R11 chose the branch
  that carries a **cost**: three named layer-3 consumers, each a RED-first gate, sequenced after AE5
  increment 1. ⇒ the follow-up register keeps a `Status: open` entry, but its closing condition is
  now **concrete** instead of a pending question — it closes when each of `risk_class`,
  `resource_kind` and `sensitivity_ceiling` has a **named runtime consumer inside `authz`** with a
  gate asserting it, ⛔ not when a later batch decides the columns are fine where they are, and
  ⛔ not on a test or lint reader (see the next bullet: a test reader is not a consumer). ⛔ A reader
  who takes D1 as closing F5 whole — or D3 as closing the **columns** — inherits exactly the
  *"all-clear from whichever page you opened"* failure that ADR 0201 D6 is retiring at `409` § 3.7.
- **What a "consumer" means is now settled, and it is narrower than "a reader".** A test or lint
  reader is **not** a consumer — `410` § 2.3 states it, and this ADR ratifies it. There are **four**
  structural readers of the three columns and none counts: `401` (§§ 7, 11, 13), `410` § 2.3, the
  generated projection `supabase/tests/vectors/authz_enforcement_manifest.psql:69` with its
  generator at `scripts/gen-authz-matrix-cells.mjs:865`, and — ⚠ weakest of the four —
  `scripts/gen-authz-differential-cells.py:65-67`, where `resource_kind` is a **comment-level
  tie-break rationale** for choosing `org.case_vocabulary.manage` as a representative, not a value
  the script computes with. Naming it as a reader without that qualifier would overstate the census
  in the direction that keeps the columns.
- **Every live figure here is ungated and says so where it is stated** — `0176:45-47`'s
  four-that-is-three and each count in § Problem. ⛔ `npm run lint` cannot hold a live-catalog count
  (no Docker in the chain), so the strongest instrument available is a pgTAP mirror bought at *"the
  next Phase Gate noticed"*, and **this ADR ships none**; whichever D3 option is chosen, its
  migration is the place to add one.
- **D2 costs a manifest edit Batch 9 does not make** (doc-only by PO ruling R1). Rewriting the
  `:250` `note` to name D3's ruling — **R11: the column stays, its consumer is owed** — is owed by
  whichever batch lands the first named consumer; until then that
  `note`'s *"ADR 0172 defers the column's runtime consumer"* is imprecise for Correction 1's reason
  — the deferral it should cite is `0176:153-155`.
- **AE5 increment 1 is unblocked on F5.** It needs the seam, and D1 gives it the seam with both
  bounds attached. It does **not** need D3 *discharged*: no increment writes these columns, because
  `authz.permissions` is seeded by migration and sealed from every application role — and D3's own
  sequencing puts the three consumers **after** increment 1 for exactly that reason. ⛔ The converse
  does not hold: increment 1 may not cite D3 as licensing a *read* of these columns, because there
  is none to cite until a consumer lands with its gate.

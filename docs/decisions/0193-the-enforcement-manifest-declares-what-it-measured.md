# ADR 0193 — The enforcement manifest declares what it measured, and the measurement is a fixed point over the call closure

**Status:** proposed — unit ENFORCEMENT-MANIFEST (pre-AE5 remediation Batch 4, with Batch 5 riding along), branch `authz-enforcement-manifest`; `accepted` at the Record step
**Date:** 2026-09-07
**Area:** authorization / the enforcement manifest as an oracle / vacuity of gates / rollback procedure
**Amends:** ADR [0176](./0176-authz-permission-layer-made-real.md) (D5 — the manifest's field contract
gains `hardDenyClasses` semantics, a new provenance value, and two new required per-row fields,
`definerSurface` and `nonEnforcementConsumers`) · ADR
[0178](./0178-ae49-d6-rekey-as-built.md) (the `commission.forms.edit` representative's enforcement
surface gains a re-keyed SECURITY DEFINER door, and `org.professionals.read`'s site list gains the
function that carries its literal)
**Related:** ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (a green arm bounds its own
domain) · ADR [0162](./0162-authz-evolution-plan-audit-corrections.md) (the runbook's shape; AE5 is
post-pilot) · ADR [0172](./0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md)
(`sensitivity_ceiling`'s runtime consumer is deferred — one of the four gate-less classes) · ADR
[0182](./0182-statement-scoped-authorized-scope-ids.md) (the statement-scoped set-valued arm, which is
the site D6 declares) · ADR [0186](./0186-documentation-consolidation-one-home-per-fact.md) (one home
per fact — why the consumer axis lives in the manifest and not in `backend-state.md`) · ADR
[0190](./0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) and ADR
[0191](./0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) (the
diff-scoped sweep this unit owes, both arms)
⛔ **Supersedes nothing.**

---

## Context

The AE4 per-role template is about to be copied **eleven times** by AE5. Its oracle is
`supabase/tests/vectors/authz-enforcement-manifest.json` — 43 rows, one per permission code — read by
the lint arm inside `scripts/gen-authz-matrix-cells.mjs` (gate 12) and by pgTAP `410`. Four open
follow-ups, filed by the Gate AE4 QA review and by the rollback-runbook work, said the same thing from
four directions: **the manifest describes more than it asserts.**

Measured on a fresh reset at head `20261003007340`, before this change:

- **`hardDenyClasses` was `[]` on 43 of 43 rows.** The lint arm that validates it is a `for` loop over
  that array: **zero iterations, zero possible failures**. A check that cannot return the failing
  verdict is not a check.
- **`410` § 6.2 searched depth 1** — the declared site bodies and the authorizer body — and asserted
  the answer was `'(none)'`. It said so honestly in its own caption; the label had already been
  renamed `measured-at-declared-sites` → `measured-depth1-at-sites-and-authorizer` on 2026-09-03 for
  exactly that reason. But `principal_inactive` is enforced on **all three** re-keyed rows at depths
  2–4, and `org.professionals.read` reaches `respondent_exclusion` at depth 5 — the zero was a search
  horizon, and the only control beside it said in its own words that it was a cardinality control and
  not a discrimination one.
- **`form_item_validations`' re-keyed policy is unreachable.** `authenticated` holds `SELECT` and
  nothing else on that table, so the policy `20261003007340` re-keyed is a backstop no client
  statement can reach. Its real write path is the SECURITY DEFINER `public.set_item_validations`,
  which gated on `app.is_staff_admin_of` — so `commission.forms.edit` was **load-bearing on nothing**
  for that table, and `409` § 2.10c pinned that state as a countdown.
- **`app.current_professional_read_organizations` carries the literal `org.professionals.read`** and
  appeared in no manifest row; `410` § 8.5 held it green with a hand-maintained by-name
  `[UNDECLARED]` pin.
- **`app._audit_access_authorized` is the fourth consumer of `app.can_read_professional_profile`** and
  appeared nowhere at all — not a site (it decides what the audit trail *records*, never what a caller
  may read) and with no other home.
- **The rollback runbook § 6.2 was scoped to four policies** where six had been re-keyed, behind a
  2026-09-03 interim banner.

The common shape is the one QA has blocked on every time in these batches: **a prose claim about a
measurement, written beside a correct measurement, that no gate can contradict.**

## Problem

How does a manifest stop being a description and become an oracle — without, in the act of populating
it, reproducing the same defect one level up? Populating `hardDenyClasses` while leaving the lint arm
as a membership loop would give the tree non-empty lists that nothing can prove **wrong**, which is
strictly worse than an empty list nothing can prove **right**.

## Decision

| | Decision |
| --- | --- |
| **D1** | `hardDenyClasses` is a **committed claim**, hand-written and dated, never generated. ⛔ The generator does not open a database connection. A value derived live and compared live in the same instant is a number compared to itself (LEARN-084), and it is this asymmetry — a committed claim on one side, a live derivation on the other — that makes `410` § 6.2 an assertion at all. Stated here as a decision rather than a code comment because a later well-meaning change that gives the generator a catalog read would silently void § 6.2 with nothing to notice. |
| **D2** | § 6.2's measurement is a **fixed point over the composed-call closure**, seeded from the declared sites **and** the domain authorizer, comment-stripped, **with no depth bound** — the reached-function set is a subset of `pg_proc` over three schemas and `union` dedupes, so the fixed point *is* the bound. ⛔ Not a depth cap: the measured depths are 2/3/4/5 **authorizer-rooted** and +1 policy-rooted, and a depth stated without saying which root it counts from is the LEARN-077 shape this very section already suffered once. ⛔ Not a path enumeration: measured while authoring, bounded at depth 10 it produced 1232 paths for one row and was still growing; the recursion dedupes on the reached-function **set**. |
| **D3** | The provenance value **names both of its bounds**: `measured-transitive-over-gated-classes`. Only **3 of the 7** vocabulary classes carry a non-null `gate`; the other four — two triggers (Architecture Rules 3 and 5), the UUID id-space, and ADR 0172's deferred column — are structurally unfindable by any call search at any depth, and the label may not read as a closure over them. The declared provenance vocabulary now carries **one value per real state**: the retired depth-1 value and the never-carried `po-approved` are both dropped, because a declared-but-uncarried value is a slot for an unreviewed row later. |
| **D4** | Every arm that can be satisfied by an empty domain carries a **discrimination control that plants a positive**, distinct from a cardinality control. § 6.3 remains a cardinality control and keeps saying so; § 6.2b plants a vocabulary gate on a **synthetic root string** — never a catalog object — and requires the same instrument to name it; § 6.2c makes two real rows answer differently. |
| **D5** | A policy re-key is **not complete** while a SECURITY DEFINER writer of the same relation stays on the legacy gate. Where the policy is **unreachable**, the DEFINER is re-keyed (`public.set_item_validations`, migration `20261003007350`); where it is reachable, the split is **declared as data** in a new per-row `definerSurface`, not described in prose — and the AE5 template inherits that obligation. ⚠ A re-keyed DEFINER door lives on the `definerSurface` axis, **not** in `enforcementSites`: the site axis of that row is the POLICY axis (`410` § 8.4's closure is policy-only and says so), one door has one home (ADR 0186), and the door's behavioural proof is `409` § 2.6f / § 2.10e. |
| **D6** | An enforcement site is a catalog object that **carries the code and changes the answer**. `app.current_professional_read_organizations` is an independent FIRST arm of `professional_profiles_select` that short-circuits the authorizer entirely — deny it and the answer changes — so it is **declared, not excepted**, and the hand-maintained by-name pin ceases to *be an exception* rather than being relocated. ⛔ The pin was not deleted: its element text flips `[UNDECLARED]` → `[declared site]` and the assertion stays. |
| **D7** | A **consumer of a domain authorizer that is not an enforcement site is declared as such** (`nonEnforcementConsumers`), so the partition over an authorizer's callers is closed in **both** directions. `app._audit_access_authorized` is the first entry. ⛔ It is not a site: adding it to `enforcementSites` to make it visible would make the site-axis closure measure a logging predicate as a door. |
| **D8** | A rollback section is **re-measured at the tip of the change that moves its counts**, and an interim banner is deleted rather than left beside corrected text. A live-twin cross-check has an **expiry**, and this ADR records that the `commission_of_version` twin **has already expired** — measured 2026-09-07, zero live policies carry that shape **under the predicate the runbook states**, `coalesce(qual,'')||coalesce(with_check,'') like '%is_staff_admin_of(app.commission_of_version%'` (the **pre-cutover** shape), so all four of those sites are record-only. ⚠ *Predicate inserted 2026-09-07 (QA F-REC-1): the bare shape `app.commission_of_version(form_version_id)` is still carried by 4 live policies — "that shape" alone was not re-derivable.* |

## Considered options

**For `hardDenyClasses` (D1 + D2 + D4).**

| | Option | Why not / why |
| --- | --- | --- |
| (i) | Populate the field, keep the membership loop | ⛔ Rejected. The loop would iterate, and still only assert *"the name is in the vocabulary"* — nothing can contradict a WRONG list. This is literally the follow-up's *"reproduces the defect one level up"*. |
| (ii) | Replace the loop, leave the rows `[]` | ⛔ Rejected. Makes the lint arm falsifiable and leaves the catalog fact unrecorded, with § 6.2 still at depth 1. |
| (iii) | Populate **and** rewrite the arm **and** make § 6.2 a transitive set equality **and** plant a discrimination control | ✅ **Chosen.** The follow-up requires ONE change; this is the smallest change that is one. |

**For the DEFINER split (D5).** Re-keying all eight form DEFINER doors was rejected: seven of them sit
behind a policy `authenticated` *can* reach, so the permission is already load-bearing there, and
re-keying seven more doors means seven more behavioural differentials nobody has written — inside the
batch whose job is to make the **template** safe. Recording the split in a `_comment` was rejected as
the exact recurrence shape QA has blocked on. Declaring it as data with a lint arm and a two-direction
pgTAP closure is what AE5 inherits.

**For the read-organizations function (D6).** A `reviewedExclusions` block was considered and
rejected: it moves the exception from the test file into gated data, which is better than today, but
the exception survives — and no bound could be stated for it that was not "it's fine". ADR 0182's
reason is an *implementation* reason (statement-scoped scope ids), not a reason the path is not
enforcement.

## Consequences

- **`hardDenyClasses` becomes a claim that ages.** Any future migration that changes a call chain
  moves the derived set and reds § 6.2 — **by design**. AE5's eleven increments each owe a
  re-measurement, and a red there is an increment being *recorded*, never a number to restore.
- **The lint arm gained an escape hatch, and it is fenced.** `hardDenyClassesEmptyReason` is the only
  way a `measured-*` row may carry an empty list; it is optional, so it does not become a default on
  43 rows, and declaring it *beside* a populated list is itself a failure.
- **A `collate "C"` gotcha is load-bearing.** The recursive term's text column needs an explicit
  `collate "C"` or Postgres refuses the query outright with a collation conflict. It is not
  decoration; a future edit that drops it breaks the arm loudly, which is the good failure.
- **Two named bounds survive and are stated everywhere the value appears.** `--` comments are stripped
  from bodies but `/* */` block comments are not, and an unqualified call resolved through
  `search_path` is not an edge. Neither shape exists at a gate call in the current population.
- **Four of the seven hard-deny classes still have no detector**, and that is now a filed follow-up
  (`FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR`) rather than an unstated assumption.
- **`409` § 5.2's function-body census moved 179 → 178.** The first increment in this program to
  re-key a FUNCTION rather than a policy; the delta is fully attributed to the one replaced body.
- **The rollback runbook's § 6.2 is now six policies and one DEFINER door**, and `387`'s hot subset
  pins the arm order of only three of the six — `forms`, `form_item_options` and
  `form_item_validations` are pinned by nothing, which the runbook now says in those words.

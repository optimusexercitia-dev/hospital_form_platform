# FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR — 4 of the 7 hard-deny classes are unfindable by any call search, at any depth

**Filed:** 2026-09-07 (unit ENFORCEMENT-MANIFEST, pre-AE5 Batch 4 — PO ruling Q5 = (A) + file this)
**Owner:** backend · **Severity:** medium — nothing is wrong today; what is missing is an instrument,
and the bound is disclosed in three places rather than silently assumed away.

**What was measured.** `hardDenyVocabulary` declares **7** classes. Exactly **3** carry a `gate`
naming the function that IS the class, and those three are what
[ADR 0193](../decisions/0193-the-enforcement-manifest-declares-what-it-measured.md) D2's fixed point
over the composed-call closure can reach:

| class | `gate` | findable by a call search? |
| --- | --- | --- |
| `recusal_exclusion` | `app.is_case_excluded` | ✔ |
| `respondent_exclusion` | `app.is_case_respondent` | ✔ |
| `principal_inactive` | `app.is_active` | ✔ |
| `record_immutable_published` | **null** | ⛔ a TRIGGER (Architecture Rule 5) |
| `record_immutable_submitted` | **null** | ⛔ a TRIGGER (Architecture Rule 3) |
| `tenant_mismatch` | **null** | ⛔ the UUID id-space; matrix 6.1 measured it as enforced by the id-space, not by an org term in the resolver |
| `sensitivity_ceiling` | **null** | ⛔ ADR 0172 defers the column's runtime consumer |

So `410` § 6.2's set equality is complete over the **call-reachable sub-vocabulary** and over nothing
more. That is why the provenance value is named `measured-transitive-over-gated-classes` — the bound
is carried in the name, in § 6.2's caption, and in the manifest's `hardDenyVocabulary._comment`, so
the label cannot read as a closure over all seven (the F-MAJOR-1 shape, one level up).

**Why it is not "just add them".** A trigger-backed class is enforced by an object a `prosrc` walk
from a policy or an authorizer never visits: `pg_trigger` rows on the relation, whose function is
reached from nothing the manifest declares. Detecting them needs a **different instrument** —
"which triggers fire on the relations this row's sites name, and which of them raise" — not a deeper
version of the one that exists. The other two are not detectable at all today: `tenant_mismatch` is
a property of the id-space (there is nothing to call), and `sensitivity_ceiling`'s runtime consumer
does not exist yet by ADR 0172's own decision.

**What would close it.** EITHER a non-call detector for the **two trigger-backed classes** —
`record_immutable_published` and `record_immutable_submitted` — that reads `pg_trigger` for the
relations a row's declared sites name and attributes the class the way § 6.2 attributes a gate, with
its own planted discrimination control; **OR** a PO ruling that the `gate: null` bound is permanent,
recorded in the manifest's vocabulary comment with the reason, so the four are excluded by decision
rather than by the instrument's reach. ⛔ The two remaining classes (`tenant_mismatch`,
`sensitivity_ceiling`) are out of scope of either route until something exists to detect.

⛔ **What must NOT be mistaken for closing it.** Deepening the call search — no depth reaches a
trigger. Nor declaring one of the four on a row: M7 arm 3 refuses a class whose vocabulary `gate` is
null precisely because a call search cannot have measured it, and that refusal is the reason this
follow-up exists rather than a fabricated attribution.

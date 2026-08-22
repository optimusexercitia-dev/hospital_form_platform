# QA review — Case surface split, Increment 2 (ADR 0134 D6 + Amendments 1–7)

**Branch:** `feat/case-surface-split-2` @ `3b53418a` (28 commits ahead of `main`, 0 behind,
clean tree — verified, not assumed) · **Reviewer:** `qa` · **Date:** 2026-08-22 ·
**Gate step:** §6 step 3 · **Scope:** commits `aa16057a`..`3b53418a`.

> ⛔ **Method bound, stated up front.** The full `e2e:prod` gate was running against the local
> stack for the whole of this review, so **every catalog query was deferred and, at the time of
> writing, the live-catalog verifications in §3 have NOT been run.** Everything below is derived
> from migration text, test text, TypeScript, git and the records. ⚠ **In this repo migration text
> is stale by design** — where a claim below depends on the catalog it is marked
> `CANNOT VERIFY (catalog)` and must be settled before merge. It is not folded into the verdict as
> though checked.

---

## Verdict

# CHANGES REQUESTED

Five blocking items:

- **B1** — a Rule-12 / noun-rule widening the increment newly created (`platform_admin` gains a
  PHI write).
- **B2** — a live-RED E2E fixture assertion that also demonstrates §A5.3's enumeration obligation
  was discharged by recall.
- **B3** — the two mutation twins the ADR names as blocking (**P4**, **P9-twin**) have no recorded
  run, on the one object that is in **no** ARM's domain.
- **B4** — six records assert superseded mechanisms as live, two of them explicit obligations of
  this increment, two of them `⛔`-marked comments telling a future author to keep a gate the door
  no longer has.
- **B5** — the assertion-integrity cluster: **the fifth instance you asked me to assume exists is
  real, and there are four of them**, including a `throws`-style assertion that can never execute
  and an E2E purge whose failure is silent.

**This is not a weak increment.** The mutation discipline in `205` (N1–N5), the backlog entries for
`member_can_for` and the PHI helper, `276` O5/O5b's bounded exception, `356` §7/§8's rebuilt
differentials, `189` NEG-A/B/C, and `357`'s keystone are among the strongest evidence this repo has
produced. The TS layer is clean where it matters most: the two-key mirror is **exact** in both
directions, the bulk error map is a genuine recognition map, and no identifier value crosses back
from the server. The blockers are, with one exception, gaps *beside* that work — and the exception
(B1) is a predicate the same delivery reasoned about correctly one function away.

---

## 1. Obligation → evidence

Verdicts are **independent** — "the record says it landed" is not evidence.
⚠ **`CANNOT VERIFY` is a work item, not a caveat.** Six rows below carry it; none of them is
discharged by this review and none of them may be read as approval.

### 1.1 ADR 0134 Increment-2 obligations (the "Obligations" section)

| # | Obligation | Evidence | Verdict |
| --- | --- | --- | --- |
| I2-1 | P1 positive — administrativo, zero grants, reads a grantless case | `356` §3 (3.1/3.2/3.3/3.4/3.5) with **zero-grant + zero-assignment controls** at 3.0a/3.0b | **MET** |
| I2-2 | P2 negatives ×2 (capability revoked · appointment revoked) | `356` §4, with 4.2a naming the FK-cascade mechanism and 4.2b **labelled structural** | **MET** — and honestly labelled |
| I2-3 | P3 flag-dark | `356` §5, with 5.2 the flag-independent coordinator control and 5.3 a verified restore | **MET** |
| I2-4 | **P4 over-grant twin — arm reverted ⇒ P1 RED, under a harness with hash-verified restore** | **No record found anywhere.** Swept by property: `P9-twin`/`P4`/"arm reverted"/"revert the arm" over `*.md`, `*.sh`, `*.txt`, `*.log`, `*.sql` → the only hits are the *specifications* (ADR, plan, PROGRESS) plus one migration comment. `supabase/tests/mutation/` gained no script. `356` never mentions P4 | **NOT MET** → **B3** |
| I2-5 | P5 cross-commission | `356` §6, with 6.2 comm_y's own coordinator as the control | **MET** |
| I2-6 | P6 audit row — **rewritten as a differential** | `356` §7: baseline delta, actor+commission pinned, **exactly one** row, and 7.3's coordinator-emits-none pairing | **MET** — the rewrite is correct and the original spec was indeed unfalsifiable |
| I2-7 | **P7 PHI non-leak, through the doors** | `356` §8: 8.1a/8.1b positive control (an S3 `read_standard_phi` grantee succeeds at the same door, same case), 8.2a precondition (content readable ⇒ the denial is PHI, not not-found), 8.2b/8.2c/8.2d denial at both public doors | **MET** (see M-6 for one soft edge at 8.2d) |
| I2-8 | P8 authorship bound | `356` §9, with 9.3 the coordinator succeeding at the same door | **MET** |
| I2-9 | §6 authz gates — all four ARMs + diff-scoped sweep | Run, and **the record states all four held vacuously** (`follow-ups.md` §FUP-DOOR-AUDIT-…, per-object table). The sweep ran zero cases | **MET as disclosed** — the disclosure is exemplary; the coverage is nil, which is why I2-4 matters more, not less |
| I2-10 | `gen:types` after migrations (Rule 8) | `database.ts` gains `p_patient?: Json` on both doors | **MET** |
| I2-11 | **The Amendment-1 stubs in ADRs 0033 *and* 0061 updated from "not yet built" to the build record, in the same change** | ADR 0061: done, and well. **ADR 0033 §"Amendment 1" line 143-144 still reads *"design PO-ratified, NOT yet built (update this stub to the build record when Increment 2 lands)"*** and still describes the arm **without** Amendment 4's `not v_eg` bound | **NOT MET** → **B4a** |

### 1.2 Amendment 2 §A2.5 (the option-D bill)

| # | Obligation | Evidence | Verdict |
| --- | --- | --- | --- |
| A2.5-1 | **The keystone** — the same administrativo, one call later, refused on the post-creation writers | `357` §4.1/§4.2 — **both** doors, errcode **and** pt-BR message, plus 4.3 (nothing overwritten) | **MET** — this is the strongest pin in the increment |
| A2.5-2 | Positive, single **and** bulk, with PHI | `357` §2 (single, with read-back at 2.2) · `189` §8b (bulk, with read-back at "MRN-ADM") | **MET** |
| A2.5-3 | Negatives — capability revoked · appointment revoked · membership removed | `357` §8.1 (capability, **through the door**) · §8.2 (membership, **through the predicate only** — see M-4) · appointment-revoked covered structurally by the FK, as `356` §4.2 documents | **PARTIAL** — M-4 |
| A2.5-4 | Flag-dark (`administrativo` off; `case_patient` off) | `357` §9.1/§9.2, and 9.2 is explicitly the pin that makes the helper's **own** flag assert falsifiable | **MET** |
| A2.5-5 | **Over-grant twin** — revert the arm ⇒ the positive goes RED | `authz-unswept-backlog.txt`: *"PHI write reverted (11 RED), wrapper gate removed (4 RED …), helper ACL opened (1 RED), helper's own flag assert removed (1 RED)"*, under a harness stated to reject a no-op probe | **MET** — and recorded with red sets, which is the standard the other twins should have met |
| A2.5-6 | Audit row `case_patient.updated` with the administrativo as actor | `357` §6.1, plus §6.2 pinning **no identifier value or key** in the payload, with 2.2 named as its non-vacuity anchor | **MET** |
| A2.5-7 | PHI non-leak **after** they have written | `357` §5.1/§5.2 with §5.3 the coordinator positive control at the same door | **MET** |
| A2.5-8 | **Invert M13 deliberately, intent in the header, anti-vacuity PRE kept** | `189` §2b: the inversion is stated as a *reversal of a recorded design*, the PRE survives and still lands the refusal on the gate under test, and the original keystone is **re-purposed as NEG-A** rather than deleted | **MET** — model handling |
| A2.5-9 | `ARM=census` specifically, plus the diff-scoped sweep | Run; `ARM=census` correctly VIOLATED on `member_can_for`; resolved by admitting the gap in the backlog rather than hand-writing a verdict | **MET** |
| A2.5-10 | The route re-gates **only after** the door admits it | Migration `…000700` (two-key gate) precedes the route change in the same delivery; ordering respected | **MET** |

### 1.3 Amendment 4 §A4.3 (six items, not five)

| # | Obligation | Evidence | Verdict |
| --- | --- | --- | --- |
| A4.3-1 | The arm carries `not v_eg`, positioned with the other positive arms, after STEP 4 | Migration `…000500`: `if not v_eg and app.member_can_for(v_commission, 'read_cases', p_uid)`, placed after S7 and after STEP 4's hard denies. Generated from `pg_get_functiondef` (md5 recorded) with the block injected programmatically | **MET (pending catalog)** — see V-2 |
| A4.3-2 | **P9** locked-case negative — `can_read_case` false, absent from the board, `get_case_detail` refuses | `356` §10.1/10.3/10.4, with 10.2 the coordinator control and 10.4 pinning **`P0002`** (not a bare 42501) | **MET** |
| A4.3-3 | **P9-twin** — remove `not v_eg` ⇒ P9 RED | **No record found** (same sweep as I2-4). `docs/backend-state.md:461` asserts *"proven only by the P9-twin mutation"* as fact; nothing records the run | **NOT MET** → **B3** |
| A4.3-4 | **P10** bit-shape, both directions | `356` §11.1–11.6, **plus 11.7** — a genuine S7 quality reviewer for whom the predicate is TRUE. Without 11.7 "false" is the default answer for almost everyone | **MET** — 11.7 is exactly the right control |
| A4.3-5 | **P11** the S3 grant path survives the bound | `356` §12.1, plus 12.2 (the grant carries no PHI) | **MET** |
| A4.3-6 | The `is_oversight_only_reader` door set **enumerated by property and recorded** | `356` §13 — and better than required: pinned, not merely recorded, and it names the number the routine-bounded framing hides (11 policies + 3 routines through the negation `can_read_case_committee`, incl. the Class-2 PHI door) | **MET** — with M-5 (count-keyed, not name-keyed) |

### 1.4 Amendment 5 §A5.3

| # | Obligation | Evidence | Verdict |
| --- | --- | --- | --- |
| A5.3-1 | The migration must not touch existing rows; a pgTAP negative pins that a pre-migration appointee keeps exactly their four | `…000400` guards on `GET DIAGNOSTICS row_count > 0`; `205` §(A5) `array_agg = array['create_cases']` for `adm2` | **MET** |
| A5.3-2 | The seed's DIRECT-INSERT path gains nothing; the two paths asserted **separately** | `205` §(A5) *"a DIRECT-INSERT appointment … confers ZERO capabilities"*, and `seed.sql` grants `read_cases` explicitly with the reasoning attached | **MET** — and N4 (auto-grant moved to a trigger ⇒ the direct-INSERT pin REDs) is the mutation that makes it mean something |
| A5.3-3 | `appoint_administrativo` grants `read_cases` **and nothing else** | `205` §(A5) `array_agg = array['read_cases']`, asserted **before** the four explicit grants — with the vacuity note explaining why a count or an `exists` would not do | **MET** |
| A5.3-4 | **⚠ Every existing assertion that a fresh appointment confers zero capabilities becomes false — enumerate by property, do not close on the ones you can recall** | No enumeration is recorded anywhere (swept: `A5.3`, "confers zero capabilit", "enumerate" across `docs/`, `supabase/`, `src/`, `e2e/`). And the class produced a **live casualty**: `e2e/orphan-administrativo-reachability.spec.ts:204` still expects **4** | **NOT MET** → **B2** |

### 1.5 Amendment 6 §A6.4 and Amendment 7 §A7.4

| # | Obligation | Evidence | Verdict |
| --- | --- | --- | --- |
| A6.4-1 | `member_can_for`'s ACL derived from the catalog by property | `356` §2.5/2.6 pin `anon` false / `authenticated` true, with the NULL-proacl-is-permissive reasoning attached | **MET (pending catalog)** |
| A6.4-2 | The obvious drift pin is **vacuous** and must not be counted; instead one behavioural pin per conjunct + a **catalog** delegation assertion | `356` §1.0–1.5c (one pin per term, each with a verified restore) and §2.1–2.3. ⭐ **1.2 is re-labelled** as a behavioural pin because the `is_active` term was *measured* redundant — the honest move | **MET** — and the redundancy finding is recorded in five places |
| A6.4-3 | Regression evidence **names the 12 consumers** and states whether any suite exercises the **meetings write path** | The 12 are named in `…000500`'s header and in `backend-state.md`. **I found no statement, anywhere, of whether a suite exercises the meetings write path** — the specific question A6.4-3 asks, and the one "the suite is green" does not answer | **PARTIAL** → **M-1** |
| A6.4-4 | `ARM=census` run on `member_can_for` | Run; VIOLATED; resolved into the backlog with per-term neutralization red sets | **MET** |
| A7.4-1 | Two-key positive (`first_only`) | `189` two-key positive + PRE2 + a landed-case count | **MET** |
| A7.4-2 | ⭐ **`create_cases` alone ⇒ refused** and ⭐ **`assign_case_phases` alone ⇒ refused** | `189` NEG-A and NEG-C, both errcode **and** message, symmetric | **MET** — this is the right shape; the conjunction is demonstrated, not asserted |
| A7.4-3 | `all_phases` refused **at the gate**, pinned on the **message** not the errcode | `189` NEG-B: message names the scope, **plus a case-count control proving not one row was minted** — which is the half that distinguishes a gate refusal from a rollback | **MET** — best pin in `189` |
| A7.4-4 | Coordinator `all_phases` still succeeds | Present in `189`'s pre-existing coordinator coverage | **MET (pending run)** |

### 1.6 Amendment 2 §A2.6 (records that must change in the same commit)

| Record | Required change | Verdict |
| --- | --- | --- |
| CLAUDE.md §3 Rule 12 | one writer, two gates | **MET** — precise, and it bounds the claim to the **write** side and to the **case** module only |
| ARCHITECTURE.md §2 | same | **MET** (M-3: one phrase slightly over-states the INVOKER lock) |
| ADR 0038 | single-door language | **MET** |
| ADR 0030 / 0066 | single-door language | **MET by correct refusal** — I verified by property: `0030` has exactly one `single-door` hit and it is about **reads** in the NSP module; `0066` has none. The record's judgement that A2.6's list over-scoped is **correct** |
| ADR 0061 PHI note | "enter and read" corrected | **PARTIAL** — the ADR and the **user-facing copy** are corrected well; the component **docblock** still says *"enter and read patient context"* → **B4f**. The record claims this DISCHARGED |
| **ADR 0134 D6 and A1.2** | this ADR's own D6 and A1.2 | **NOT MET** → **B4b/B4c** |
| PROGRESS.md OPEN-4 | closed | **MET** |

### 1.7 Plan §4 "E2E (tester)" — the five UI obligations

| # | Obligation | Verdict |
| --- | --- | --- |
| E-1 | Appoint dialog shows the fifth capability | **PARTIAL** — E2E asserts it only in test **B5**, which is the deliberately-RED pin. Covered at the unit layer instead (`member-administrativo-controls.test.tsx:106-123`, five ids **in order** plus an unconditional `toHaveLength(5)` — which is the anti-vacuity control that makes the loop mean something). No E2E asserts the checklist *count*, so a dialog that added `read_cases` while dropping another entry passes at that layer |
| E-2 | The board now lists commission cases | **MET — the strongest E2E item.** Positive (`:316-321`) with a ground-truth precondition (no grant, not the author) **and** a genuine differential: a `create_cases`-only peer with `read_cases` explicitly revoked does not see it (`:328-338`), preceded by a positive board-render checkpoint |
| E-3 | Open an ungranted case read-only, content cards absent | **PARTIAL** — reachability and two named absences are paired with a coordinator positive control on the same case and the same buttons (`:353-374`), so that half can fail and is sound. But "read-only" is asserted by a **2-item hand-list**, in the same delivery that derives the case-wide affordance class **by property** at 16 members (`casos-reading-surface-differential.spec.ts:374-517`) — including the four `canWriteContent` editors an S8-only administrativo must equally not have. The exported `Member[]` tables are not reused. See **M-15** |
| E-4 | Bulk wizard requires two capabilities; `all_phases` suppressed | **MET** — two-key positive (keyboard-only, reaching both link and route) plus **both** single-key negatives, negative 1 carrying a real positive checkpoint before the absence; `all_phases` absence paired with a same-route coordinator positive and a positive statement of the replacement copy |
| E-5 | Identifier confirmation built from the user's own submission | **PARTIAL** — the *existence* of the confirmation can fail (`case-patient.spec.ts:1471-1475`, `processless-cases.spec.ts:324-328`). The **property the ruling protects** is unasserted: if the server began echoing values and the component were "simplified" to render them, both specs pass byte-identically. See **M-8**. ⚠ The `case-patient.spec.ts` twin is at the tail of a 19-test `serial` file, so it has plausibly never executed on this branch; the `processless-cases.spec.ts` twin is not serial and is the one currently carrying the obligation |

---

## 2. Blocking findings

### B1 — `public.create_case` now writes PHI behind an `app.is_admin()` disjunct: a `platform_admin` gains a patient-identifier write that did not exist before this increment

**Requirement violated:** CLAUDE.md §1 (`platform_admin` — *"**May NOT** touch **commission content or PHI**"*, the noun rule, ADR 0078 A35) · CLAUDE.md §3 **Rule 12** (minimum-necessary) · ADR 0134 **§A2.1** (*"A **member holding the `create_cases` capability**"*) · **§A2.7** approval scope (option D authorizes the A2.2 mechanism for that principal class; a platform-admin PHI write was never put to the PO).

`supabase/migrations/20261003000600_creation_scoped_case_phi.sql:259-261`:

```sql
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
          or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'sem permissão' using errcode = '42501';
```

…and at `:353-366` of the same function, unconditionally on the same path:

```sql
  if p_patient is not null then
    perform app._set_participant_patient_unchecked(
      v_case.id, null, …);
```

`app.is_admin()` (`20260918002200…:32-56`) is `platform_admin` **and currently acting as
platform_admin** — reachable in the product through `assume_role`. So a hatted `platform_admin`
can, in any commission of any tenant, call `create_case(…, p_patient => {...})` and write
`patient_identifiers` + `patient_participants`, firing `trg_xref_maintain_patient_identifiers`
into the **cross-module patient index** (Amendment 2 M4 / §A2.4 risk 1).

**This is new.** Before this increment, `createCase` minted the case and then called
`set_case_patient` → `set_participant_patient`, whose single authority branch is
`app.is_staff_admin_of` — the plan measured that (§4 OPEN-3) and a platform_admin was refused.
The DROP+CREATE that added `p_patient` moved the write **inside** the door whose gate carries
`is_admin()`, with no compensating condition.

**Why this is not a pre-existing issue wearing a new label.** The `is_admin()` disjunct on case
*creation* is pre-existing and the plan flagged it (§4, *"noted because it sits one call away"*).
The **PHI write** through it is not. The delivery moved it from one call away to zero.

**The asymmetry is visible inside the same delivery.** Migration `…000700:98-107` — for
`bulk_create_cases` — carries a nine-line comment ending *"⛔ **NO `app.is_admin()` DISJUNCT AND NO
TENANCY ARM** … the noun rule (ADR 0078 A35) keeps platform_admin out of commission content."* The
identical reasoning was written, correctly, one function away from where it was needed, and
`create_case_from_template` — the sibling that also gained `p_patient` — has no `is_admin` arm
either. `create_case` is the sole outlier of the three creation doors.

**No pin excludes it.** Swept by property: `is_admin`/`platform_admin` across `357`, `356`, `205`,
`189` → **zero occurrences**. `314` §11.34's catalog list bounds the **tenancy-admin** predicate,
which is a different function.

**Contributing cause, worth recording:** `357` §8.2 asserts the membership negative against the
**predicate** (`app.member_can_for(...) = false`) rather than against the **door**
(`create_case(...)` raises). A door-level assertion would have had to reckon with the disjunct set
and the extra arm would have been visible. This is the *"a predicate quoted at the wrong grain"*
shape, and it is the reason the widening was invisible to an otherwise thorough suite.

**To close** — a PO call, not a lead one, because it is a Rule-12 authority question:
1. Remove `app.is_admin()` from `create_case`'s gate (which also makes the three creation doors
   agree, and lands the noun rule the sibling comment already argues for); **or**
2. keep the disjunct for case creation but make the **PHI branch** conditional on the principal
   class option D actually names; **or**
3. put it to the PO explicitly as a Rule-12 widening and record the ruling.
   Whichever is chosen, add the pin: a hatted `platform_admin` calling `create_case` with
   `p_patient` — asserted **at the door**, and paired with a positive control at the same door so
   the refusal is not a broken fixture.

⚠ **Also re-derive, before choosing:** the same `is_admin()` arm means a platform_admin creating a
case receives the `creator_self_grant` at `:341-343`. That is pre-existing; it is named here only
so option (1) is evaluated against the whole reach, not just the PHI half.

---

### B2 — `e2e/orphan-administrativo-reachability.spec.ts:204` asserts the seed grants **four** capabilities; the seed now grants **five**. The file goes RED at `afterAll`, and it is the casualty that shows §A5.3's enumeration was done by recall

```ts
  expect(seedIntact, "seed's own administrativo grants must survive").toBe(4)
```

`supabase/seed.sql:2764-2765` now grants `staff2.ccih`
`['schedule_meetings','create_cases','assign_case_phases','view_signoffs','read_cases']` — **five**.
The file's own header still describes *"the seed's own appointment (`staff2.ccih`, all four
capabilities)"*.

**Two consequences, and the second is worse than the first.**

1. An `afterAll` failure fails the whole file, so C0/C1/C2/C3's real verdicts are buried behind
   fixture arithmetic. This is a live red the gate will surface.
2. The file was added in `aa16057a` (the branch's first commit) and the seed gained `read_cases` in
   `e39ad3ac` (twelve commits later). ⇒ **this spec has not been run since `e39ad3ac`**, so every
   claim in its control map is asserted against a pre-`read_cases` build.

**It is also the evidence for §A5.3-4.** Amendment 5 §A5.3 says, in terms: *"Every existing
assertion that a fresh appointment confers zero capabilities becomes false and must be updated
deliberately, not discovered. **Enumerate them by property** before writing the migration; do not
close on the ones you can recall."* Three assertions were updated (`205`'s 4→5 twice, plus the
board re-anchor) — all inside the file the author was editing. The one in a *different* file,
carried on the same branch, was missed. That is exactly the failure mode the clause names, and it
means the clause is **NOT MET** independently of whether this one line is fixed.

**To close:**
1. Fix `:204` (and the file header) — but **as the output of a sweep, not as a one-line patch**.
2. Run the sweep §A5.3 asks for, by the property *"asserts a count or set of
   `commission_administrativo_capabilities` rows, or asserts that an appointment confers none"*,
   over `supabase/tests/`, `e2e/`, `src/**/*.test.*`, and record the population and the result.
   A hand-list here would repeat the defect inside its own fix.
3. Re-run this file standalone and record `did-not-run 0`, because it has not run in twelve
   commits.

---

### B3 — P4 and P9-twin, the two mutation twins the ADR names as blocking, have no recorded run — and they cover the one object that is in **no** ARM's domain

**Requirement violated:** ADR 0134 Obligations (*"the over-grant twin (arm reverted ⇒ the positive
goes red)"*) · **§A4.3 item 3** (*"Without this twin the bound is asserted, not proven — and a
bound is the half of an arm that nothing else in the gate set can see"*) · plan §7 (*"P4 **and**
P9-twin mutation-proven both directions"*) · plan §4 P4 (*"under the neutralization harness with
hash-verified restore … the harness's own rollback is proven first"*).

**Swept by property**, not by recall — `P9-twin`, `P4`, `arm reverted`, `revert the arm`,
`S8 arm removed` over `*.md`, `*.sh`, `*.txt`, `*.log`, `*.sql`:

| where | what is there |
| --- | --- |
| ADR 0134, plan, PROGRESS.md, `case-surface-split-increment-2.md` | the **specification** of the twins |
| `docs/backend-state.md:461` | *"proven only by the P9-twin mutation"* — an assertion of a result |
| `supabase/migrations/…000500.sql:69` | *"which is why P9-twin exists"* |
| `supabase/tests/356_…sql` | **no mention of P4 or P9-twin at all** |
| `supabase/tests/mutation/` | **no new script**; `authz-unswept-backlog.txt` records neutralizations of `member_can_for`'s **terms** and of the **PHI helper**, not of the S8 arm or its bound |

⇒ three of the increment's five mutation subjects were recorded to a high standard, with red sets
and an explicit statement that the harness rejects a no-op probe. The two that were not are the two
the ADR marks blocking.

**Why this is not bookkeeping.** `follow-ups.md` (FUP-DOOR-AUDIT-…) and `backend-state.md` both
state that `app._case_caps` returns `int` and is therefore in **no** authz arm's domain — *"Its
only evidence is the targeted P4/P9-twin mutations written by hand for this increment."* So for this
one object, the twin is not corroborating evidence; it is the **entire** evidence, and the record
that names it as such is the same record that never records it running.

⚠ **The structural arguments do not substitute.** P1's controls (3.0a/3.0b) make it *derivable*
that S8 is the only arm that can confer content there, and `not v_eg` makes P9 *derivable* too. This
program's own standing rule is that a derivation is what a twin converts into evidence — Amendment 4
§A4.2 says so of its own claim, and P10 exists for exactly that reason. Accepting a derivation here
would apply the opposite rule to the arm than to its consequence.

**To close:** run both, and record them to the standard `authz-unswept-backlog.txt` already sets for
`member_can_for` — probe moved `md5(pg_get_functiondef)`, restore returned it, the red set named
per assertion. If the runs already happened, the fix is to write them down; ⛔ do not write down a
result that was not observed.

---

### B4 — Four records assert superseded mechanisms as live, one of them an explicit obligation of this increment

Each is verified at HEAD. Grouped because they are one failure — inline amendment markers were
applied to D1 and D6 for Amendments 3 and 4 and then not applied for 5, 6 and 7.

**B4a · ADR 0033 Amendment 1 (blocking, and an obligation).** `docs/decisions/0033-case-access-control.md:143-144`
still reads *"design PO-ratified, **NOT yet built** (update this stub to the build record when
Increment 2 lands)"*, and the quoted design bullet describes the S8 arm **with no `not v_eg`
bound**. ADR 0134's Obligations require this stub updated *"in the same change"*; ADR 0061's twin
stub was updated properly. ADR 0033 is the ADR that governs case access control — it is the wrong
one to leave asserting an unbounded arm.

**B4b · ADR 0134's own status line.** Line 5-7:
*"Increment 1 ✅ … · **Increment 2 not started** · no remote `db push`"* — while four migrations,
two pgTAP suites, three E2E specs and the UI are built on the branch. ⭐ The same sentence carries
the note *"⚠ this line read 'code built but not gated, nothing merged' until 2026-08-22; corrected
by measurement, not by memory."* **It went stale again in the delivery that corrected it.**

**B4c · D6 and A1.2 carry Amendment 4's inline correction and not Amendments 5, 6 or 7.**
- D6 (`:99-111`) still says *"(default-checked in the appoint dialog)"* — the phrasing Amendment 5
  §A5.1 measured **not implementable** and §A5.4 explicitly authorized correcting (*"the D6 wording
  correction"*). Not made.
- D6 still says *"routed through the flag-aware chokepoint"* naming `app.member_can` — the mechanism
  Amendment 6 measured **cannot answer the question**. A6's own status block says *"This amends
  **D6** and plan §4's **V-G / M2**."*
- A1.2's Consequences (`:238-240`) still read *"Increment 2 gains a second migration: a
  `member_can(commission, 'create_cases')` arm on `bulk_create_cases`"* — the one-key mechanism
  Amendment 7 measured **insufficient**, with no Amendment-7 marker.

**B4d · The plan was not amended at all.** `docs/plans/case-surface-split.md` §4 **V-G** (`:346`)
still says *"`app.member_can` flag-awareness — S8 must route through it"*; **M2** (`:447`) still says
*"via the flag-aware chokepoint, V-G"*; `:241` and `:250` still describe the **one-key** bulk arm.
Amendment 6 names plan §4 V-G/M2 as things it amends.

**B4e · Two `⛔`-marked route comments assert the pre-Amendment-7 door, and instruct a future author
to keep it.** These are the same class living in code rather than docs, and they are worse than the
doc instances because they carry a directive.

- `src/app/o/[org]/c/[commission]/manage/cases/multiplos/page.tsx:50-51`:
  `// ⛔ THE EXACT TS MIRROR OF app.is_staff_admin_of, which is what public.bulk_create_cases gates on`
  — **false since `…000700`**, which made that door `is_staff_admin_of ∨ (create_cases ∧
  assign_case_phases)`. The "⚠ REVERSED 2026-08-22" note 18 lines below quotes a *different*
  retired sentence, so a reader who takes the `⛔` block as current concludes the door is
  coordinator-only.
- `src/app/o/[org]/c/[commission]/manage/cases/page.tsx:247` still calls it *"a staff_admin
  bulk-create link"*, and `:258-263` — ``// `access.role === 'staff_admin'` is the exact TS mirror
  of `app.is_staff_admin_of` … Do not "improve" this by re-adding it here`` — describes a variable
  **deleted in this diff**; the paragraph now floats above `eligibleBulkCount` describing nothing.

⚠ The *other* half of both comments (that `access.role` reproduces the membership arm **and** the
ACT-hat arm) was checked and is **true** — `app.has_role`/`has_role_any` do carry the hat carve-out.
Only the `is_staff_admin_of`-is-the-whole-door half went false.

**B4f · The PHI over-claim the increment records as DISCHARGED is only half-discharged.**
`src/components/members/member-administrativo-controls.tsx:25-26` still reads: *"on a PHI-bearing
commission `create_cases` lets the member **enter and read** patient context — `showPhiNotice`
surfaces that plainly."* The rendered notice (`:267-272`) says the opposite and correctly denies
read *including of self-typed rows*; `e2e/administrativo.spec.ts:724` asserts the corrected copy;
ADR 0061's build record states the reversal. Only the user-facing string was fixed.

⭐ **The miss was caused by the stated verification method.** `case-surface-split-increment-2.md`
records the discharge as *"Verified on **rendered output**, never by a source grep — the comment
explaining the fix would itself be a hit."* Avoiding the grep was right for confirming the *copy*;
it is exactly why the **docblock** survived. Rendered output cannot see a comment. The finding
should be re-opened as PARTIAL and the record corrected — a Rule-12 over-claim in the file a future
author reads before editing the copy is the same defect one layer in.

**Why blocking rather than tidy-up.** This ADR's own D1 keeps a struck sentence precisely because
*"a reader who finds only the new text cannot tell which claim those citations were making."* The
inverse hazard is live here: a reader who finds only D6/A1.2/V-G/M2 gets the falsified mechanism as
the decision, and this program has already paid an increment for exactly that (A1.2 was
*"written from the door's name, not from its call graph, and it survived ratification and a written
plan"*).

**To close:** inline the Amendment 5/6/7 markers in D6 and A1.2 as Amendments 3/4 were inlined;
update ADR 0033's stub to the build record **including** the `not v_eg` bound; amend plan §4 V-G/M2
and the two bulk bullets; repoint the two route comments at the two-key door; fix the
`member-administrativo-controls.tsx` docblock and re-open the discharge as PARTIAL. All six in one
edit, with the superseded text struck rather than deleted, per this ADR's own precedent.

---

### B5 — The assertion-integrity cluster: the fifth instance is real, and there are four

You asked me to assume a fifth vacuity nobody caught. There are four, none of them in the pgTAP
suites — which is where the discipline was concentrated.

**B5a · An assertion that can never execute.**
`e2e/orphan-administrativo-reachability.spec.ts:315-321`:

```ts
    const rpc = await request.post(`${SUPABASE_URL}/rest/v1/rpc/member_can`, { … })
    if (rpc.ok()) {
      expect(await rpc.json(), 'app.member_can must REFUSE the orphan').toBe(false)
    }
```

`member_can` exists only as **`app.member_can`**; verified by property — `grep -rl "public\.member_can"
supabase/migrations/` returns **exit 1, zero files**. `supabase/config.toml:13` exposes
`schemas = ["public", "graphql_public"]`, so this POST is a PostgREST `404/PGRST202`, `rpc.ok()` is
false, and **the assertion has never run**. This is the recorded *"a correct door nothing can reach
— `app.*` RPCs are 404"* class, and the surrounding test still passes on its other assertions, so
the hole is invisible. It is in the same file as **B2**, so it is naturally in scope for that fix.

**B5b · A restore whose failure is silent — the class the lead caught once today, recurring.**
`e2e/casos-reading-surface-differential.spec.ts:346-348` runs the fixture purge as a `spawnSync`
whose `status` and `stderr` are never inspected, against a hard-coded container name. `psql -c` runs
its statement string as one implicit transaction, so **one** SQL error aborts all fourteen
statements — with zero signal. Both the `beforeAll` pre-purge and the `afterAll` purge then become
no-ops, leaving a published process template, a commission-wide `phase_results` vocabulary row and
two cases in CCIH for every subsequent spec in the gate. This is *"a restore that silently failed
and contaminated the next probe"* at the E2E layer. **Must be fixed before the next `e2e:prod`
declare-green**, because a contaminated run is not distinguishable from a clean one.

**B5c · Two claims that describe a protection the code does not provide.** Neither assertion is
vacuous; both *labels* are false, and the label is what stops the next person re-deriving.

- `src/lib/cases/bulk-error-map.test.ts:26-30`, titled *"is anchored on the door: the canonical
  entry matches the migration verbatim"*, with the comment *"If the door's wording changes, this
  reds HERE."* The assertion is `expect(RECOGNISED_FORBIDDEN_MESSAGES).toContain(ALL_PHASES)` where
  `ALL_PHASES` is **a second hand-copy of the same string, declared four lines above, in the same
  file**. It compares TS to TS. Change `…000700:133` and this stays green while `mapBulkRpcError`
  silently degrades the PO-mandated scope message to the generic string. ⚠ The property *is*
  covered — `189:231` pins the message against the real door — but nothing links the SQL literal to
  the TS literal, so updating `189` and forgetting `bulk-error-map.ts` leaves **both** gates green.
  Either derive the constant from a shared fixture, or retitle the test to what it actually asserts
  and point it at `189`.
- `src/components/cases/case-patient-confirmation.test.tsx:8-9`: *"The `fieldsSet` prop is typed
  `readonly string[]` **precisely so it cannot carry one** [an identifier value]."* A
  `readonly string[]` carries any string. The two things that actually hold the Rule-12 line are
  `actions.ts:367-374` (`.map(([k]) => k)`, keys only) and `case-patient-confirmation.tsx:57-58`
  (`const field = FIELDS[key]; if (!field) return null` — a seven-name whitelist that would drop a
  value even if one arrived). **Neither is tested:** `patientFieldsSet` has zero tests (verified by
  property — its only occurrences in `src/` + `e2e/` are the definition and four consuming sites),
  and no test feeds an out-of-vocabulary `fieldsSet` entry to the component. This is the mechanism
  of the lead's own echo-narrowing ruling, asserted by a type that does not assert it.

**B5d · An absence with no presence control, in code that has never run.**
`e2e/case-surface-split-increment-2.spec.ts:537` —
`await expect(page.getByText(CF_CASE_LABEL)).toHaveCount(0)` — is the *"unchecking `read_cases`
empties the board again"* claim, straight after a `goto` with nothing asserting the board rendered.
Its neighbouring poll at `:521-530` reads through `dbQuery`, whose `if (!res.ok()) return []`
(`:128`) makes `.toBe(0)` pass on a failed request. Both sit in the never-executed tail behind
`BUG-ADM-APPOINT-CAPS-NOT-SYNCED`. ⭐ **The record correctly warns that this half will run for the
first time when the bug is fixed** — the point here is that when it does, it will pass whether or
not the board narrowed. Fix the assertions *with* the bug, not after it.

⚠ Two further soft spots in the same file, non-blocking but cheap: `dbQuery`'s fail-open also backs
`:310 expect(grants.length).toBe(0)` — the ground truth on which the whole S8 claim rests — though
there it is rescued one line later, because `:312-314` destructures the next query's result and
would throw on `[]`. And `clearAppointment` (`:133-138`) never checks its own response, so a
silently-failed clear runs each test against an accumulating persona; the failure direction happens
to be red for B1/B3, which is luck rather than design.

---

## 3. Security / RLS — Rule 12 as the sharp edge

⛔ **Every row in this section is derived from migration text and test text. The catalog was not
queried.** These are the verifications owed before merge.

| # | Claim to verify from the live catalog | Why it cannot be settled from text |
| --- | --- | --- |
| V-1 | `app._case_caps`'s live body: **only** the S8 block was added; S1–S7 and the S3 loop are byte-identical to the pre-change body | The migration header records the source md5 (`edb85248a21326eb139e7e994b9c469b`) and says the block was injected programmatically. **Verifiable exactly:** take `pg_get_functiondef` now, delete the S8 block, `md5` it, compare. A `CREATE OR REPLACE` of a 7-arm resolver is the highest-leverage place in this change for an unintended edit, and the approval scope forbids touching S3/S5/S7 |
| V-2 | The S8 guard is literally `if not v_eg and app.member_can_for(v_commission, 'read_cases', p_uid)`, positioned **after** STEP 4 | Migration text is stale by design |
| V-3 | `app._set_participant_patient_unchecked`: `prosecdef = f`, `proacl` excludes `authenticated`/`anon`/PUBLIC, caller set is exactly the four | `357` §1.1-1.3 assert this **in the suite** — so this is a re-verification that the suite ran against the live catalog, not an independent claim |
| V-4 | The capability CHECK admits exactly five literals — **no sixth** | approval scope: no sixth capability |
| V-5 | `dispose_case_phi`, `search_patient_xref`, `get_patient_trajectory_for_entity`, `is_oversight_only_reader`, `can_read_case_committee` unchanged | approval scope names each; the migrations claim not to touch them |
| V-6 | **No remote `db push` happened** — `supabase migration list --linked` shows `20261003000400`–`…000700` **absent** remotely | Standing discipline, named in every amendment's scope. Not checkable from the working tree |

**What I can settle from text:**

- **S8 confers no PHI bit.** The arm sets `app._cap_bit('read_case_content')` only.
  `app.can_read_case_patient` is `has_case_capability(…, 'read_standard_phi')`, a bare bit test with
  no lattice closure. `356` §8 pins the consequence **through both public doors** with a working
  positive control. **The keystone holds.**
- **The `not v_eg` bound is written and pinned** (`356` §10), with the coordinator control and a
  `P0002` (not-found) posture rather than a bare `42501`. Proof of the bound's *necessity* is B3.
- **The creation-scoped write cannot read.** `357` §5 and §4 together are the claim's real evidence:
  refused at both post-creation writers one call later, and `get_case_patients` returns NULL to the
  writer while the coordinator succeeds at the same door on the same case.
- **`SECURITY INVOKER` is load-bearing — conditionally, and the records mostly say so.** On the
  intended path the helper is only ever called from DEFINER bodies owned by `postgres`, so INVOKER
  and DEFINER are identical; the difference appears **only if the ACL leaks**, where INVOKER is
  refused by the PHI tables' grants and DEFINER writes. Migration `…000700:28-44` and
  `backend-state.md` state this precisely, including that the two INVOKER cells refused via
  **different locks**. See M-3 for the one place the phrasing outruns it.
- **`276` O5's amendment is sound.** The assertion was moved from the `prosecdef` **proxy** to the
  **property**, and — the part that matters — **O5b bounds the exception by name to exactly one
  function**. An escape hatch written for the case that needs it does not silence the next one. This
  is the correct handling of a keystone that a change trips.
- **Two locks, same errcode:** checked. `357` §4.1/4.2, `189` NEG-A/B/C and `205` §(VOC) all pin the
  **pt-BR message** where the errcode is ambiguous, and `205`'s header records N2 — the mutation
  proving an errcode-only `throws_ok` stays **green** with the validator deleted. `356` §9.2's
  `42501 + 'sem permissão'` is the one place the message is generic, but the alternative lock there
  (`assert_extras_enabled`) raises `check_violation`, and 9.3 proves the door is reachable. Sound.

**Observation, not a finding (O-1): confidentiality is orthogonal to the bound and unexamined for
S8.** `app.confidentiality_clearance_ok` is consulted by the document kernels, not by `_case_caps`,
so S8 reaches a `confidential`-classified case whose `visibility_policy` is `commission_default`.
That is the same reach S7 (an out-of-commission quality reviewer) already has, so S8 is strictly
narrower and this is not a new class. Recorded so the next arm's author does not assume `not v_eg`
covers the confidentiality axis — it does not.

---

## 3b. The TS layer — mirror fidelity, code quality, UX & a11y

**The two-key mirror is exact, in both directions.** Door (`…000700:107-111`):
`is_staff_admin_of ∨ (member_can('create_cases') ∧ member_can('assign_case_phases'))`. Mirror:
**one** function, `src/components/cases/bulk-create-gate.ts:31-38`, consumed by both surfaces
(`manage/cases/page.tsx:8`+`:266`, `multiplos/page.tsx:11-14`+`:76`). The four conjuncts of
`member_can_for` are each covered: the flag by `session.ts:623-641` zeroing `capabilities`,
`is_active` by the `/conta-inativa` shell redirect, `is_member_of` by the new `role !== null`
(`session.ts:713-715`), the capability row by `.includes`. **I could construct neither a dead-end
door nor a suppression** on the changed surfaces.

**`all_phases` is enforced in the payload, not merely hidden.** `canUseAllPhasesScope` is
`role === 'staff_admin'` (`bulk-create-gate.ts:56-58`), and `effectiveScope`
(`bulk-create-wizard.tsx:199-200`) feeds `commit()` at `:310`, the rail at `:500` and the deal step
at `:428` — a stale `phaseScope` in client state cannot be submitted. The door remains the
authority; the UI mirrors it. **This satisfies A7.2's binding clause correctly.**

**No PHI travels back — verified end to end at the seam.** `actions.ts:530-545` / `:606-620` return
`{ ok, error, caseId, patientFieldsSet }`; `patientFieldsSet` is keys-only (`:367-374`); the RPC's
`data` is used solely for `.id`. `bulk-actions.ts` returns no patient data at all. The confirmation
takes its values from client state (`create-case-dialog.tsx:326` `draft={patient}`). ⚠ See **B5c**
for the untested mechanism and **M-8** for the missing seam assertion.

**Error mapping (Rule 10, no raw Postgres in the UI): correct.** `bulk-error-map.ts:66-87` excludes
`42501` from the pt-BR SQLSTATE allowlist and matches it against an explicit recognition list,
returning the **canonical** entry rather than the matched text — so no `linha N:` prefix or
Postgres `CONTEXT:` tail can ride along — with every unrecognised `42501` collapsing to the generic
pt-BR string. Both halves are tested (`:54-65`), and the record documents complementary
neutralizations proving neither mutation alone reds both. **Raw Postgres text cannot reach the UI.**

**pt-BR & a11y: clean.** All five capability labels and the `read_cases` hint are pt-BR, the hint
is wired via `aria-describedby` (`:227-236`), the PHI notice has its own `id` and joins the
description list, errors render through `role="alert"`, and the E2E includes a keyboard-only path
to `multiplos` (`case-surface-split-increment-2.spec.ts:185-208`).

**Conventions: clean.** No `any` in any changed file. No client value-import of a server query
module (`bulk-create-gate.ts` lives under `src/components/` and imports `@/lib/queries/session`, but
is consumed only by Server Components, and the transitive gate reports 0 findings over 496 client
modules). All data access goes through `src/lib/queries/` or the `'use server'` action layer. One
unnecessary `"use client"` — **M-12**.

**The one real narrowing gap: a sibling axis was not swept.** `src/lib/queries/session.ts:640` is
still `isAdministrativo = apptRow !== null` — **no membership term** — while `canInCommission` 70
lines below gained `role !== null` and carries a docblock arguing at length that an orphan's
appointment and capability rows both survive a membership delete, so *"the un-narrowed mirror was
strictly WIDER than the door."* **That argument applies verbatim to `isAdministrativo`**, which is
arm 2 of `canOpenCaseManagement` (`cases.ts:691`) and of `hasCaseStanding` (`layout.tsx:214`,
`manage/cases/page.tsx:145`).

It is **not live today** — the commission shell returns early for `role === null` on both branches
(`layout.tsx:126`, `:151`) so `hasCaseStanding` never evaluates for an orphan, and
`canOpenCaseManagement` arm 2 is caught one gate later by `getCaseDetail → notFound`, an asymmetry
`cases.ts:646-652` declares deliberate. But `orphan-administrativo-reachability.spec.ts` pins only
the **board affordance** half; nothing constructs an orphan against `canOpenCaseManagement`, so the
residual width has no witness. ⭐ This is the recorded *"sweeping one sibling AXIS reads as sweeping
the class"* shape, and the reachability argument above is itself an inference of exactly the kind
the same docblock records as having been **half wrong last time**. Filed as **M-13**; narrow the
sibling in the same edit and add the orphan fixture against `canOpenCaseManagement`.

---

## 4. Did anything exceed its authorization?

| Non-authorization | Verdict |
| --- | --- |
| No remote `db push` | **CANNOT VERIFY** — V-6. No evidence of one in the tree; the check is one command and belongs in the gate record |
| No merge to `main` | **HELD** — `main` is `e096e6d9`; branch is 28 ahead, 0 behind; tree clean |
| No PHI **read** for administrativo | **HELD** — `356` §8, `357` §5, `189` §8b |
| No PHI write outside the creation path | **HELD for the administrativo** (`357` §4 keystone). ⛔ **EXCEEDED for `platform_admin`** — B1 |
| No change to `dispose_case_phi` / the xref gates | **CANNOT VERIFY (catalog)** — V-5; the migrations do not reference them |
| No change to S5 / S7 / S3 / `is_oversight_only_reader` | **CANNOT VERIFY (catalog)** — V-1/V-5. This is the one worth actually running, because `_case_caps` was re-created wholesale |
| No sixth capability | **HELD (pending V-4)** — the CHECK and the whitelist both list exactly five |
| No auto-grant of anything but `read_cases` | **HELD** — `205` §(A5) `array_agg = array['read_cases']`, asserted before the explicit grants |
| Amendment 3 scope (wording + two record edits only; no new `/casos` affordance, no change to `narrowToReadingSurface` or D3) | **HELD** — no change to either in the diff |
| Amendment 4 §A4.4 (findings first on the door-set enumeration) | **HELD** — `356` §13's header states it explicitly and nothing in the set was touched |
| Amendment 7 §A7.5 (no change to `activate_phase`/`assign_narrative`; `assign_case_phases` not added to the auto-grant) | **HELD** — neither function is in the diff; the auto-grant inserts `read_cases` only |

---

## 5. Reviewing the lead's own work

**The four rulings.**

- **INVOKER kept over the pinned invariant** — **correct, and correctly evidenced.** The measurement
  has a flipping control (DEFINER succeeds), the two INVOKER cells are reported as refusing via
  *different* locks rather than the expected one, and the keystone was amended to its property with
  a name-bounded hatch (O5b). Flipping `prosecdef` to satisfy a proxy would have removed a
  safeguard; the ruling avoided that and left a `COMMENT ON` in the catalog so the next reader finds
  the reason before the red.
- **The echo narrowed to no server-side PHI** — **correct, and the safer direction.** A response
  body carrying identifier values to a principal with no `read_standard_phi` is a read path wearing
  another name. The narrowing is pinned structurally in `357` §7 with 7.4 as the explicit
  non-vacuity anchor. ⚠ Its stated residual (a *server-side normalization* mismatch is invisible to
  a client-side echo) is accurate and remains uncovered by design — that is disclosed, not hidden.
  See M-8: the property the ruling protects is not asserted at the E2E layer.
- **`all_phases` refused at the gate** — **correct, and the pin is better than the ruling asked for.**
  A7.4 required the message; `189` NEG-B adds the case-count control, which is the only assertion
  that distinguishes "refused before work" from "rolled back after work" — the actual content of the
  ruling.
- **A-full over A-lite** — ⛔ **this ruling appears in no document.** Swept by property: `A-full`,
  `A-lite`, `lite` across `docs/`, `PROGRESS.md`, the increment record → **zero occurrences**. Per
  this project's own standing lesson (*an approval's scope is a fact that must be written down*; the
  recorded lead failure mode is that the receiver remembers it and so never records it), this needs a
  line in § Decisions or the increment record naming what was chosen, what was rejected, and by whom.
  Filed as **M-2**.

**The seven amendments.** Substantively sound; A2.2's rejection of the GUC gate and of a
`member_can` disjunct on `set_participant_patient` are both right for reasons that outlive the
feature, and A7's *"before ruling that a door opens, enumerate the doors it calls"* is the most
reusable sentence in the set. Their **defect is mechanical, not substantive** — see B4: the
amendments were written and the clauses they amend were not annotated, so the ADR now reads
differently depending on where you enter it.

**The self-corrections.** Five baseline rows corrected in place with the correction marked; the
`is_active` redundancy caught by mutation and propagated to five documents; the inlining mechanism
downgraded from "measured" to "one of two sufficient blockers" after a probe whose *first run was
invalid in the same way*. This is the right standard, and it is why B3's two missing twins stand out
rather than blend in.

**One overturned mechanism, correctly handled.** A6.3's *"`SECURITY DEFINER`, which Postgres never
inlines"* was falsified by the four-arm probe (`SET search_path` alone also blocks inlining). The
conclusion survived; the explanation was corrected in the direction of **less** certainty, and the
invalid first probe is recorded. Model behaviour.

---

## 6. Minor findings and recommendations (non-blocking)

**M-1 · A6.4-3's specific question is unanswered.** The 12 consumers are named, but nowhere does any
record state **whether a suite exercises the `meetings` write path** — the three
`meetings_staff_admin_{insert,update,delete}` policies that now reach `member_can_for` through a
delegation. A6.4-3 asks for that sentence precisely because *"the suite is green" is not the same
claim*. One line, derived by property over `supabase/tests/`.

**M-2 · The "A-full over A-lite" ruling is unrecorded.** See §5.

**M-3 · ARCHITECTURE.md's INVOKER phrasing outruns the measurement.** *"measured, an INVOKER call by
a non-owner is refused while a DEFINER one succeeds, **so INVOKER is the second lock**"* omits the
conditional the migration and `backend-state.md` both state: on the intended path there is **no**
difference; INVOKER bites only if the ACL leaks. ADR 0038's *"the second lock **behind the ACL**"*
is the right phrasing — copy it.

**M-4 · `357` §8.2 asserts the predicate, not the door.** The membership-removed negative is
`app.member_can_for(...) = false` where §8.1's capability negative goes through `create_case`. The
door has two further disjuncts the predicate assertion cannot see — which is how B1 stayed
invisible. Make it symmetric with §8.1.

**M-5 · `356` §13.1/13.4/13.5 are count-keyed, not name-keyed.** `count(*) = 4` passes if one door
leaves the set and another joins it. The names are in the description, which is not an assertion.
`276` O5b's `array_agg(... order by ...)` shape is right there in this same delivery — use it. (The
converse hazard is real and recorded — a rename orphans a name-keyed verdict — but `321` K8 shows
the team already handles that correctly, with a header telling the next reader to establish
*added vs renamed* before touching the array.)

**M-6 · `356` §8.2d can pass on a NULL participant id.** The subselect
`(select cp.participant_id … limit 1)` returns NULL if the chain is absent, and
`get_participant_patient(NULL)` returns NULL, so the assertion is satisfied either way. 8.1b makes it
*very likely* the chain exists (the grantee reads identifiers for that case) but nothing asserts it,
and the second door has no positive control of its own — unlike 8.2c, which has 8.1b. One
`isnt(…, null)` for the grantee at `get_participant_patient` closes it.

**M-7 · `356` §2.1's "one body, not two" is bounded to the `app` schema.** A hand-copy of the
conjunct list into a `public` routine would not red. The claim in the description
(*"the predicate has one body"*) is wider than the assertion's domain. Either widen the domain or
narrow the wording.

**M-8 · The property the echo-narrowing ruling protects is unasserted end-to-end.** `case-patient.spec.ts`
and `processless-cases.spec.ts` assert the confirmation **renders** with the typed values — which it
would also do if the server started echoing values and the component were "simplified" to read them.
`357` §7 pins the DB side (return types unchanged, no identifier-shaped column). What is missing is
the seam: an assertion that the creation response carries **field names only**. That is one
network-level assertion, and it is the only thing standing between the ruling and a future
regression. ⚠ Related: `case-patient.spec.ts`'s new assertions sit at the tail of a `serial` file, so
they have plausibly never executed on this branch — `processless-cases.spec.ts`'s twin is not serial
and is the one currently carrying the obligation.

**M-9 · `FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE`'s blocking premise is now false.**
Its measured basis is *"`can_read_case` for [`staff2.ccih`] on that case is **false**"* and its
closing condition is *"a seed change — a case with custom-field values readable by a `create_cases`
holder … Natural home: Increment 2."* Increment 2 granted `staff2.ccih` `read_cases`, and
`case-surface-split-increment-2.spec.ts:316-321` **asserts staff2 now sees that very case**
(`CF_CASE_ID`/`CF_CASE_LABEL`). The fixture exists; the arm is still unpinned. Re-derive the entry
and close it, or state the new reason it stays open — leaving the falsified premise in place is the
record failure this repo tracks.

**M-10 · Records the increment left slightly behind.**
- `357`'s header (`:18-22`) says the bulk pins *"are currently RED pending a PO ruling"*. The PO
  ruled (Amendment 7) and `189` §2b/§8b are built. A stale claim in a test-file header.
- ADR 0061's build record contradicts itself: correction 3 ends *"which is Increment 2 work and is
  **not yet landed**"*, and eleven lines later *"✅ the `multiplos` re-gate and its board link"*.
- § Decisions has rows for Amendments 3 and 4 but **none** for Amendment 2 (option D — the
  platform's first non-coordinator PHI write path), 5, 6 or 7, and **no row for OPEN-1's ruling**,
  which plan §4 "Docs & records" requires in `decisions-log.md` (untouched in this delivery). The
  2026-08-21 row still says *"⛔ NOT built"*.
- The `B5` bug reference (PROGRESS.md Bug Log, increment record) names a test id with no file.
  `B5` is `e2e/case-surface-split-increment-2.spec.ts:446`. A name-keyed verdict with no path is
  hard to clear.

**M-11 · The appoint dialog does not tell the coordinator that the two keys together unlock bulk.**
`read_cases`' hint states its ceiling well (Amendment 4's Consequences asked for exactly that).
`create_cases` + `assign_case_phases` now jointly unlock creation of up to 200 cases with assignment
across members, and neither label says so. Not an obligation — A7.5 only authorized the wizard
suppression — but Amendment 7's Consequences call the standing second key *"the trade the ruling
makes, stated here so it is not rediscovered as a surprise"*, and the coordinator ticking the box is
the person who should not be surprised.

**M-12 · Two small UI items.** (a) `case-patient-confirmation.tsx:1` carries `"use client"` on a
component with no hooks, handlers or browser APIs, rendered only from the already-client
`create-case-dialog.tsx` — contrary to CLAUDE.md §8's *"only where interaction requires it"*.
(b) `create-case-dialog.tsx:249` returns early from the navigation effect whenever identifiers were
recorded, leaving "Continuar para o caso" as the only forward path; dismissing the dialog instead
(`onOpenChange={setOpen}`, no `router.refresh()`) leaves the board without the new case until a
manual reload, where the pre-change behaviour always navigated. Medium confidence — reasoned from
the code, not run.

**M-13 · `isAdministrativo` was not narrowed alongside `canInCommission`.** See §3b. Not live, no
witness.

**M-15 · The "read-only shell" E2E claim is a 2-item hand-list against a 16-member derived class.**
See E-3. The property-derived `Member[]` tables in `casos-reading-surface-differential.spec.ts` are
exported and sit in the same delivery; reusing them on the manage host for an S8-only administrativo
turns "read-only" from two named absences into the class. ⭐ Also worth carrying: three assertion
helpers in that file are soft — `:570-573` wraps `Locator.isVisible()` (which is **not**
auto-waiting) in a `15_000` timeout that is inert, and `:583-589`'s `assertAbsentHere` is the only
helper with **no** structure check. Both fail in the safe direction here, but the `15_000` reads as
a wait that does not exist.

**M-16 · `case-surface-split-increment-2.spec.ts`'s 404 matcher cannot say which gate fired.**
`/não encontr/i` (at `:231`, `:248`, `:251`, `:351`, `:406`) matches both the root copy and the
commission copy, so these pass whichever boundary refused — including one firing for a reason
unrelated to capabilities. The sibling `orphan-administrativo-reachability.spec.ts:132-156` exists
specifically to distinguish them and records that *"an earlier draft matched only the root copy and
reported C2 as still reaching the board when it was in fact correctly 404'd."* Reuse
`notFoundKind()`. `:248` is the weakest instance — a bare 404 with no presence control ahead of it.

**M-14 · `ALL` in `session-capability-mirror.test.ts:52` is unenforced exhaustiveness, in the file
whose own docblock says it must be enforced.** *"⛔ EVERY `MemberCapability` VALUE MUST APPEAR
HERE. A value missing from this list is silently untested"* — then `const ALL: MemberCapability[]`,
which accepts any subset. A sixth capability compiles clean and is skipped by all five tests
including the orphan regression row. `members.ts:270-278` correctly documents that there are now
**four** unenforced TS hand-lists plus `seed.sql` — it documents rather than gates. A
`satisfies Record<MemberCapability, …>` keyset turns the next omission into a compile error, for
one line. ⭐ Worth doing now specifically because `read_cases` — the value this diff added — is the
event the docblock is reacting to; the next one will not be caught.

**Rotation and contract hygiene: clean.** `now-concluded-2026-08.md` and
`case-surface-split-increment-2.md` carry zero root-relative `docs/` links (verified by count); the
one apparent hit is prose about the pattern. Increment-2 material is in a rotation destination with
the OPEN follow-ups keeping their index lines, as the contract requires.

**Secrets: clean.** Zero `SERVICE_ROLE`/`service_role` occurrences in the `src/` diff (verified by
count, exit code read directly). The three `SUPABASE_SERVICE_ROLE_KEY` reads are in `e2e/` harness
code, from `process.env`, with pt-BR fail-fast messages and no literals.

---

## 7. On the seven pre-filed follow-ups — are they correctly bounded?

Not re-filed. Assessed as instructed:

| Follow-up | Bounding | Assessment |
| --- | --- | --- |
| `FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME` | 🟠 | ⭐ **Under-rated — recommend promotion to § Critical FUP.** The entry itself is excellent (802/101/42 measured, *"outside the arm ≠ unswept"* stated, the third instance on a real shipped change tabulated per object). But its consequence is not a coverage gap, it is a **gate-record integrity defect**: an empty-domain run prints the byte-identical line a clean run prints, and it has now produced a §6 step-1 record reading *"all four ARMs HOLD"* for a change that added a PHI writer and rewrote a bulk authority gate. Every future gate record for a non-boolean door inherits that ambiguity. The proposed cheap fix — *refuse to report `BLIND: 0` on an empty domain* — is the right one and is cheaper than the classification |
| `FUP-GRANT-CASE-ACCESS-UNCHECKED-HAS-NO-COVERAGE` | 🟠 | **Correctly bounded.** *"Untested ≠ unprotected"* is stated, the ACL is measured, and the class was derived by property rather than named from the instance. ⭐ Worth adding one line: the **new** member of that class shipped with four recorded mutation twins while the **precedent it was modelled on** still has none — the asymmetry is the argument for scheduling it |
| `FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER` | 🟠 | **Correctly bounded, and unusually well evidenced.** 104/1/103 and 63/2 measured both sides; the *recognition list* shape is right (canonical entry returned, not matched text, so no `linha N:` or `CONTEXT:` rides along); both halves of the test proven by **complementary** neutralizations; and the no-op first probe is disclosed. The reason it is not simply sweepable — `42501` is the one SQLSTATE whose message cannot be trusted from the code alone — is the correct analysis |
| `FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS` | 🟠 | **Correctly bounded.** Its real value is the discipline it records (rule out the instrument before filing a product bug) and it directly prevented a false bug report in this increment |
| `FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS` | 🟠 | **Correctly bounded**, and the bound is the entry's best feature — *"136 is the population that CAN hold the defect, not the population that does"*, with the real population explicitly not established. The root-cause close (one `test_helpers` verb, red-first) is right; 136 hand-paired edits would be the wrong fix |
| `FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE` | 🟡 | **Correctly bounded.** Swept by property afterwards (exactly one such executable reference in the tree), and `357` §1.6/1.7 put the pin beside its explanation |
| `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` | 🟢 | ⚠ **Possibly under-rated at 🟢.** Half the `app` schema is PUBLIC-executable and the only thing bounding it is one line of `config.toml` — a *configuration* boundary standing in for a privilege one, on a schema this increment just made the home of a PHI writer. It does **not** affect the new helper (`357` §1.3 pins that `authenticated`, and therefore PUBLIC, holds no EXECUTE on it), which is why 🟢 is defensible. But the same backlog file records `app.save_instance_answers` / `app.seed_default_answers` carrying a **NULL `proacl`** — the permissive default — and this repo's own recorded lesson is *"a guard that reads right but fails open"*. Suggest 🟡 with the population sized by property |

---

## 8. What must happen before this branch merges

1. **B1** — resolve the `is_admin()` PHI write; PO ruling if the disjunct is kept. Add the
   door-level pin.
2. **B2** — fix `orphan-administrativo-reachability.spec.ts:204` **as the output of the §A5.3 sweep**,
   record the sweep, and re-run that file standalone (`did-not-run 0`). It has not run in twelve
   commits.
3. **B3** — run and record P4 and P9-twin to the `authz-unswept-backlog.txt` standard.
4. **B4** — the six record repairs (a–f), in one edit, including the two `⛔` route comments and the
   PHI docblock; re-open the "false PHI copy" discharge as PARTIAL.
5. **B5** — B5a and B5b before the next `e2e:prod` declare-green (a contaminated run is
   indistinguishable from a clean one); B5c and B5d in the same pass, and B5d **with** the
   `BUG-ADM-APPOINT-CAPS-NOT-SYNCED` fix rather than after it.
6. **§3's six catalog verifications (V-1…V-6)**, once the stack is free. **V-1** and **V-6** are the
   two that carry real risk.
7. Re-run the §6 step-1 set and `e2e:prod` after (2) and (5), and — per `FUP-DOOR-AUDIT-…` — state
   in the gate record **which ARM had a non-empty domain**, rather than "four ARMs HOLD".

Non-blocking M-1…M-16 are recommendations; M-4, M-5, M-6, M-8, M-13, M-14 and M-16 are cheap and
each closes a real soft edge.

### What I could NOT verify, restated so it is not read away

The six catalog rows (V-1…V-6) and the `all_phases` coordinator positive (A7.4-4, which needs a run).
**These are work items.** In particular, **V-1** — that the `CREATE OR REPLACE` of `app._case_caps`
changed nothing but S8 — is both the highest-leverage check in this change and exactly computable:
take `pg_get_functiondef` now, delete the S8 block, `md5`, compare against the
`edb85248a21326eb139e7e994b9c469b` the migration header records. Nothing in this review substitutes
for running it.

---

**Verdict: CHANGES REQUESTED**

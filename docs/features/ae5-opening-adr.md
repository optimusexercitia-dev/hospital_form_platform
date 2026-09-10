---
id: AE5-OPENING-ADR
title: "AE5's opening decision — the ADR 0176 D8 bundle, the F5 seam model and the per-role template's arm keying, taken together with the admin arm's `is_active` blindness, its Class-2 write reach and the manifest comment that describes a red which is green, so the template is decided before AE5 copies it eleven times (pre-AE5 Batch 9)"
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 9 of the follow-up batches ruled 2026-09-04; the last block under plan §3 § Remaining"
branch: authz-ae5-opening-adr
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/ae5-opening-adr.md
reviews: []
adrs: ["0078", "0079", "0155", "0162", "0172", "0175", "0176", "0193", "0200"]
handoff: ~
fup: ~
---

# AE5-OPENING-ADR — the decisions AE5's first role increment is not allowed to pick off inside itself

## Acceptance criteria

The unit closes **three** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause, quoted **there**, not paraphrased here. Nothing else counts as closure.

⚠ **This batch is NOT A FIX by the plan's own §3 statement, and the PO ruled on 2026-09-09 that it
stays that way**: *decide now, build later*. Batch 9 produces an ADR and the rulings it records;
where a ruling orders a database change, the change is **deferred to a named Batch 10** and the
follow-up stays `Status: open` with a decided path, ⛔ never closed on the ruling alone when its
own clause demands a migration and a pgTAP cell. ⇒ Batch 7's **empty-pathspec assertion applies**:
`git diff --name-only main... -- supabase/migrations supabase/seed.sql src` must be empty.

⚠ **Two of the three clauses are DISJUNCTIVE and the PO's ruling picks the branch.** Each names a
"fix it" arm (migration + RED-first pgTAP, ⇒ Batch 10, entry stays open) and a "rule it deliberate"
arm (an ADR recording why, ⇒ closes here). ⛔ Which arm a clause lands on is **not knowable before
the ruling**, so the boxes below are ticked per-arm at the Record step, never predicted at open.

⚠ **A checked box means the CONDITION IS MET AND PROVEN, not that the register entry is closed.**
Entries stay `Status: open` until the Record step, after PO approval.

⛔ **Batch 7's lesson applies to all three clauses**: *a `Closes when` can name stale heads, a
wrong predicate, or a case that cannot fail.* Read each **body**, re-measure what it names from the
**live catalog** (⛔ never migration text — ADR 0078), and correct the clause *before* closing on
it, never around it.

- [ ] **AE5's opening ADR itself** — the decisions ADR [0176](../decisions/0176-authz-permission-layer-made-real.md)
      D8 forbids being *"picked off inside a role increment"*, plus the seam model audit F5 orders
      decided *"before AE5"*. Owed, from plan §3 § Batch 9:
      1. The **D8 bundle**, as one compatibility decision: F6 exact-assignment active context vs the
         role-wide hat (audit scope must match whichever wins) · F8 `administrativo` out of
         `authz.roles` · `platform_role` retirement (⚠ the implementation audit recommended retiring
         it *now*; the binding decision defers it *into* AE5 — ⛔ do not report these as agreeing) ·
         F7 one manifest entry per role.
      2. **Audit F5's seam** — entitlement / hard-deny / lifecycle / sensitivity. The classification
         columns (`risk_class`, `sensitivity_ceiling`, `resource_kind`) have **no reader** (ADR 0172
         defers them): a consumer appears, or the column is removed with a reason.
      3. ADR [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) D3's
         inheritance — the **arm-3 divergent cells** arrive already enumerated for AE5's matrix.
      4. `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` 🟡 — a stated ceiling on `D` (scopes per
         principal) **or** a ruling that the tenancy model makes a large `D` unreachable, with the
         census that shows it. ⚠ Named in plan §3 as Batch 9 scope; whether it closes here is a
         ruling, not an assumption.
      5. `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` 🟡 — the pgTAP sweep half is done (`414`);
         the `search_path = ''` convention is *"a platform-wide decision owing an ADR"*.
      6. The per-role checklist's **own corrections from Batches 0–2**: quote the `SCOPE:` line; run
         `SELFTEST=1` and the set-valued targeted home beside the four arms; `NOTICED` is evidence
         not a verdict; `RESET_EVERY` on every full run; the CARRIED ruling as a step.
      7. ⭐ **ADR 0200's inherited data obligation** (plan §6 step 2, extending 0193 D5): the AE5
         per-role template must **declare the keying of every arm it pairs** and must never place a
         caller-keyed arm beside a `p_uid`-keyed one — Batch 8 found that exact pair in the
         representative chain 0193 differenced.

- [ ] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE` 🟠 — neither
      `app.is_admin()` nor `app.is_admin_for()` carries an `app.is_active` term, so a deactivated or
      suspended `platform_admin` passes every admin arm in the tree, while arm 2
      (`app.is_org_admin_of_for`) *does* follow the subject's state. Owed, in order:
      1. **Re-measure from `pg_proc`** (comments stripped) that both bodies still lack the term, at
         the migration head pair recorded in the record — ⛔ the follow-up's own statement is a dated
         measurement, not a fact to quote.
      2. **The blast radius**, derived not estimated: every RLS policy whose `qual`/`with_check`
         names the predicate, and every function whose `prosrc` does, with counts **and** sets
         (⛔ Batch 7: *a count is not a set*).
      3. **The PO ruling**, taken with 1 and 2 in front of them.
      4. **Arm A — "deliberately independent":** the ruling is recorded in ADR 0201 ⇒ the clause's
         second arm is met and the entry **closes here**.
         **Arm B — "gate it":** ⇒ Batch 10 owes the migration plus a pgTAP cell that deactivates a
         `platform_admin` and asserts the admin arm denies, **reported RED before the change**; the
         entry **stays open** and this box stays unticked.
      ⛔ Not closed by *"no one has deactivated an admin yet"*.

- [ ] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE` 🟠 — arm 1 of
      `app.can_manage_professional` grants on `is_admin_for(p_uid)` alone, and that predicate gates
      writes to CPF, licence number and specialty, i.e. **Class-2 professional identity content**,
      which ADR 0078 A35's noun rule says a `platform_admin` may not touch. This is ADR 0200 option
      (ii), rejected there on **attributability, not on the merits**. Owed, in order:
      1. **The door list derived from `pg_proc`**, ⛔ not quoted from the follow-up: the follow-up
         says *3 `public` RPCs* — re-derive the count and the names, and say so plainly if it is not
         3. For each: what it writes (table + columns), its `prosecdef`, whether `authenticated`
         holds EXECUTE, and whether any path in `src/` reaches it.
      2. **The PO ruling**, taken with that list in front of them — the clause requires it.
      3. **Arm A — "keep the arm":** the exception is recorded in ADR 0201 **naming why professional
         identity is a tenancy noun** ⇒ the entry **closes here**.
         **Arm B — "remove the arm":** ⇒ Batch 10 owes the migration, a pgTAP cell asserting a
         `platform_admin` is denied `redact_professional_profile` (RED before / GREEN after), **and**
         an E2E over the reachable UI path; the entry **stays open** and this box stays unticked.

- [ ] `FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN` 🟡 — rows 31/32 of
      `supabase/tests/vectors/authz-enforcement-manifest.json` carry a `_comment` saying `401
      § 19.2b` *"is RED on exactly this and must not be re-numbered to 2 … AWAITING A LEAD RULING"*.
      The ruling was taken: 19.2b's expected value moved 1 → 2 **and** § 19.2c was added to pin
      *which* pair survives, so the count cannot green itself by any pairing. ⛔ **Text-only — this
      is the one item that closes inside Batch 9 unconditionally.** Owed:
      1. The `_comment` on **both** rows states the ruling that was taken and the current value of
         `401 § 19.2b` (⚠ recorded on both rows, not once — that duplication is deliberate and the
         rows say why).
      2. **A fresh run of `401` quoted beside it** showing § 19.2b **and** § 19.2c green, its exit
         read **bare**.
      ⛔ Not closed by deleting the comment — the ruling it half-records is worth keeping.

**Gate.** `npm run lint` 0 errors / 0 warnings · `typecheck` · `npm run test` · `npm run test:db`
on a **fresh** `supabase db reset` (shape must not move) · the four authz arms (`census`, `hat`,
`floor`, `FROMFINDINGS=1 wrapper`) with **domains quoted** · `SELFTEST=1` on the deriver **and** the
door harness · the set-valued targeted home · the diff-scoped deriver over `main...HEAD` with its
`SCOPE:` line quoted and its exit read **bare** before any substitution · ⭐ `git diff --name-only
main... -- supabase/migrations supabase/seed.sql src` **EMPTY** — Batch 7's empty-pathspec
assertion, live again because the PO ruled this batch is not a fix. ⛔ Someone other than the
builder runs the arms at the tip.

## Current state

**Updated:** 2026-09-10

### Objective

Take, and record, the authorization decisions the corpus forbids AE5's first role increment from
picking off inside itself — ratified per PO ruling R7 as **ADR 0201** (the keying asymmetry) and
**ADR 0203** (the enforcement seam and the classification columns), with 0202 and 0204 deferred to
named successors — together with the three follow-ups the PO added at initiation.

### Done since start

**Twelve PO rulings taken** (R1–R12), each with its measured basis in the record. **ADR 0201** (353
lines) and **ADR 0203** (253), both `Status: proposed` and registered in `proposed-review.json`.
The manifest follow-up's three conditions **met and proven**. Both register clauses **corrected**,
superseded wording quoted. Item 6's five checklist corrections added as pointers (measured at **0 of
5** first). Both deferred censuses written into their follow-up bodies. `AE5-MATRIX-ARM3-CELLS` hub
opened. ⭐ **Gate at the tip run by the lead, not the builder**: lint **rc 0** (17/17, 0/0) ·
typecheck **0** · vitest **151 files / 2056** · `test:db` **264 files / 8923, PASS** on a fresh reset
(shape unmoved) · all **four arms HOLD** · deriver **rc 3 = NOT-APPLICABLE**, its `SCOPE:` line
quoted · ⭐ **empty-pathspec assertion EMPTY** — the batch's defining claim.

### In progress

Nothing building. Awaiting the PO's disposition on the one instrument red before QA.

### Next

PO disposition on the `SELFTEST` red (file only, or file **and** ride the three-site fix along —
it does not touch the pathspec the assertion guards) → QA review → PO approval → Record step, which
owes: the ADRs flipped `proposed` → `accepted` and removed from `proposed-review.json`, `"0201"`
re-added to the `AE5-MATRIX-ARM3-CELLS` hub, the ledger row, and **eight** findings filed plus **two
lessons** (the `prosrc`-blind-to-`RETURNS TABLE` artefact and the bash-3.2 verdict split).

### Blockers

⛔ **None for this batch, and one for the next.** `SELFTEST=1` exits **1** (`PASS 40 · FAIL 6`) —
proven **not** attributable here (harness byte-identical to `main`; no sweep owed; the set-ness
semantics green in the same run at 32/33) and traced to **`bash 3.2.57`, the macOS default**, whose
`$( )` parser breaks a `case` pattern in three harnesses. ⚠ It **blocks Batch 10**, which runs a real
door sweep from this machine, and the same defect means the mandated gate step **returns different
verdicts on different machines** with nothing saying so.

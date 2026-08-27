# AE1 — Integrity and privilege hardening (authz evolution, ADR 0155 D9)

Live working record for phase AE1, branch `authz-ae1-hardening`. **Authority:** ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) +
the [plan](../plans/authz-evolution.md). Started 2026-08-26 (AE0 closed same day).

⛔ **This file exists so that phase-level facts and obligations do not live only in agent
messages.** AFF4's Record step left ~16 review obligations and ~20 plan-discovered
follow-ups unfiled — invisible to the register the PO reads from. The § "FUP obligations"
list below is the countermeasure, and it is maintained **as work happens**, not at the end.

## Task status

| task | state |
| --- | --- |
| **AE1.1** FKs | ✅ **built + committed** (`14ad668d`) — both FKs `ON DELETE CASCADE`, pgTAP 383 |
| **AE1.2** DEFINER classification | ✅ classified (752 functions); ⛔ **all 233 revokes HELD** under RV0 |
| — RV0 partition | ▶ in flight (`ae1-fk-build`) |
| **AE1.3** person doors | ▶ in flight — design approved (R0–R6); migrations `…004600/004610/004620` written |
| **AE1.4** service-role registry | ✅ **built + committed** (`800ffe2a`) — 45 sites, gate extension **OFF** |
| **AE1.5** initplan triage | ▶ in flight — red-first observed, BEFORE captured, in its reset window |
| **AE1.6** zero-policy tables | ✅ **built + committed** (`91455fbd`) — pgTAP 382, 68 assertions |

## ⚠ AE1 close conditions AMENDED 2026-08-27 (plan audit → ADR 0162)

The [plan audit](../reviews/authz-evolution-plan-audit-2026-08-27.md) (CHANGES REQUESTED)
was PO-ruled; the [plan](../plans/authz-evolution.md) carries the corrections as `[PA-F#]`
tags and ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) the 0155
amendments. **Nothing already built here is invalidated**; AE1 continues as independently
mergeable increments but **does not close** until:

1. ✅ **RULED + RECORDED 2026-08-27** — the 11 `.rpc()` sites approved as-is (+ 4 PO
   observations) → [authz-ae1-rpc-rulings.md](../design/authz-ae1-rpc-rulings.md); registry
   Group E flipped, **zero `undecided` rows** [PA-F10]; R3 discharged (local↔remote body-md5
   parity; 0 refs in the unregistered migrations). Residue: R2 =
   `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`; migration `…005000` + pgTAP `388` verify in the
   next owned stack window (see gate obligations below);
2. AE1.2's `ALTER DEFAULT PRIVILEGES` uses the **global `FOR ROLE <creator>` form** with
   positive effective-ACL probes (`has_function_privilege` + `pg_default_acl`) — the
   `IN SCHEMA` form is a documented no-op against the built-in PUBLIC default [PA-F4];
3. the DEFINER review runs **tiered** (Tier 1 threat columns for the remotely reachable
   surface; Tier 2 classification + grants for `app`-schema) and the budget gains a
   ceiling + merge rule [PA-F11] — this binds RV0's held revokes too;
4. supporting indexes for AE1.1's two FKs verified via `pg_index` and asserted (follow-up
   migration — AE1.1 already shipped at `14ad668d`) [PA-F15];
5. named-flake baseline entries carry **error fingerprints** + owner/expiry [PA-F16];
6. the six `TO public` process-template policies (AE0 F-AE0-4) normalized or explicitly
   ruled.

## ⚠ Operational facts this phase established the hard way

### ⛔⛔ A MANDATED GATE HARNESS REPORTED SUCCESS AT EXIT 0 HAVING MEASURED NOTHING

**2026-08-27, `p0-authz-writepath-audit.sh`, found by AE1.5.** Of its 22 write-layer cases:
**13 ERRORed** on the §7.2 drift tripwire (AE1.5's wrap changed their `qual`/`with_check`
text, so the harness's embedded 33-policy worklist no longer matched the live catalog and it
correctly refused to neutralize), and **9 were absent from that worklist entirely** — never
selected, and outside **both** arms' domains.

⛔ **So its `(COVERED = the rest)` computed a residual over an EMPTY SET, and it printed
`WRITEPATH EXITCODE=0`.** Zero cases measured, positive-sounding summary, clean exit.

⭐ **This is a second instance of the failure that produced this repo's standing rule.**
`ARM=census` once printed `INVARIANT HOLDS` at exit 0 **having enumerated ZERO gates** — which
is why no authz-gate result predating 2026-08-24 is trusted
(`.claude/rules/authz-gate-results-need-a-current-baseline.md`). It has now recurred in a
different harness, in the *other half of the same gate*: `p0-authz-door-audit.sh` handles the
identical situation as **exit 3 UNPROVEN (PARTIAL)**, with *"a clean verdict over a subset of
what was asked for is the finding this gate exists to prevent. NOT a pass."* **Same class,
opposite handling, two halves of one gate CLAUDE.md §6 step 1 mandates every phase.**

✅ **The tripwire itself did its job** — it detected drift and refused to sweep against a stale
worklist. Had it swept anyway it would have neutralized 13 policies using predicates that no
longer existed. The defect is the **exit code and the residual**, not the detection.

**Ruled:** the 13 drifted snapshot lines are regenerated **from the live catalog, never
hand-typed**, and the update must **prove the tripwire can still fire** — otherwise "update the
snapshot" is "silence the tripwire" wearing maintenance clothes. ⛔ The harness's exit semantics
are **not** changed mid-phase (it is a gate component, in flight for other phases); filed and
raised to the PO instead.

### ⛔ And worse than the exit code: the harness cannot tell "swept" from "not in my worklist"

Established 2026-08-27 by grepping the write-path harness for any *"requested but never
swept"* reporting — **there is none.** A `CASES=` entry absent from its embedded worklist is
**silently ignored**: no ERROR, no warning, no mention in the summary.

> **The harness cannot distinguish "I swept your case" from "your case is not in my worklist",
> and reports the second as the first.**

So handing it 52 cases and receiving `13 COVERED, exit 0` reads as coverage of 52. ⚠ The only
reason the gap was ever visible is that the **sibling** arm prints
`REQUESTED CASES THAT MATCHED NO GATE` and refuses to end CLEAN.

### ⚖ RULING 2026-08-27 — AE1.5's sweep closes at 43 of 52, recorded as PARTIAL

The **9** unmeasured policies sit outside **both** arms' domains — a **pre-existing apparatus
gap**, same family as `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2). AE1.5 did not create it; it
**revealed** it by altering policies that fall in the hole. ⛔ Blocking the task until the 9 are
measured would block on machinery that does not exist, for a defect the task **found rather than
caused** — which would make surfacing an apparatus gap more expensive than not looking.

**Conditions, binding:** the 9 are **named individually**, never counted (a count is what let
them hide) · the gate line is **in words**, never an exit code · and the record states **how the
43 was derived — by the worklist cross-check, not by the harness's report**, because the harness
would have said 52.

⚠ **The lead's earlier merge condition was UNMEETABLE and is corrected:** "merge only once the
combined run is not-PARTIAL" cannot be satisfied while the 9 are unmeasurable by either arm.
**Revised: merge the verdicts actually MEASURED — changed rows only, never a copy (ADR 0079
Amdt 1). The 9 gain NO rows**, not even a placeholder; a findings file with no row for a case is
the honest representation of "not measured".

⚠ **AE1.5's gate line, binding, in words and never as an exit code:** *52 policies altered ·
**43 measured** · **9 UNMEASURED BY EITHER ARM** · **PROVEN on the read half, PARTIAL on the
write half**.*

### ⭐ One lesson, not three: a correct source does not make a correct derivation

*"Regenerated from the catalog" describes the **source**, not the **transformation**.* A
generator can read a correct catalog and still emit a wrong row. Any mechanical rewrite of a
pinned artefact needs **a differential against what it replaces, with the permitted delta stated
in advance**.

⭐ This phase produced **three** instances that look unrelated and are the same shape — all three
derived correctly from a real source and still wrong, because the derivation's **domain or
mapping** went unexamined: the `polcmd` mapping (`a → ALL` instead of `a → INSERT`, which would
have relabelled five INSERT policies as `ALL` — and an `ALL` policy **is** a read policy); the
self-erasing AFTER selector (its subject test was the property the migration removed); and the
"exactly two text pins" claim (bounded to *suites*, while the third pin lived in a *harness*).
Measured anchor: `polcmd` in `public` is `a`=14 · `r`=174 · `w`=17 · `d`=11 · `*`=62.

### A blast-radius claim inherits the domain of the instrument that produced it

AE1.5 reported the wrap's text-pin blast radius as *"exactly two, measured"* (`270`, `371`).
**It is three.** The third is the write-path harness's embedded worklist — invisible to
`npm run test:db` because it lives in a **mutation harness, not a suite**.

⭐ *"The full pgTAP suite found exactly two"* sounded exhaustive **because the suite is
exhaustive — over suites.** Pins also live in harnesses, in scripts, and in allowlists. Bound
every "measured" claim by the instrument's own domain, and say what that domain excludes.

### The diff-scoped door sweep MUTATES the shared stack — it is not a read

`p0-authz-door-audit.sh` **neutralizes each gate in the live catalog** and asks the suite
whether anything noticed. So does any mutation audit. **Every task running one needs the
stack to itself**, and the sweep must run *inside* the runner's window — never after
releasing the lock, or a sibling reading `pg_proc` sees an authority check that does not
exist and can file a phantom finding against work that is not theirs.

⚠ The sweep's **preflight refuses to run on a dirty pgTAP baseline** (*"a dirty baseline
invalidates every case"*), so the only economical order is one contiguous window:
**reset → suite green → mutation audit → door sweep → `ARM=census`.** Splitting it costs a
re-verification per split.

⭐ **The lead had this wrong** and was treating the sweep as a read; `ae1-doors-build`
raised it before it corrupted anyone's evidence rather than after.

### Applying migrations by hand makes every sibling's reading unreproducible

2026-08-27: `ae1-doors-build` applied its three migrations directly by `psql` without
registering them. Measured divergence: registry head `20261003004400` / 476 registered,
while the catalog already carried `app.can_administer_person_for`, all **6** person doors
and **8** `_impl` kernels — **13+ objects no registry row accounted for**.

⛔ The same action had been **denied** to `ae1-initplan` an hour earlier, for the reason it
then caused. `ae1-fk-build` — whose entire deliverable is catalog-derived arm-domain
membership — had not yet run a live query. **That was luck, not isolation.**

**Ruled:** every measurement taken against a hand-mutated stack is **provisional** and is
re-run post-reset. Editing the already-psql-applied `…004610` was ruled *acceptable*
(uncommitted, unregistered, re-applied cleanly, so no repo/remote divergence) — but the
psql application is what made it a judgement call at all.

### Fixture traps that made tests measure the wrong thing

Three, all caught by the agents' own controls rather than by review:

1. **A hand-minted `{"is_admin": true}` is not enough for `app.is_admin()`** — it ends
   `and app.active_role() is not distinct from 'platform_admin'` (ADR 0106 D11 ACT).
   Without the hat it returns **false** and the persona falls to a weaker arm: **1 visible
   profile instead of 36**, on the one arm AE1.5's edit *keeps*.
2. **`test_helpers.claims_for(<user>, false)` derives NO `active_role` when the persona
   holds more than one live role** (`orgadmin.b` holds `{org_admin, staff_admin}`). It is a
   fixture whose arm changes silently when seed memberships change, with nothing able to
   notice. ⛔ **Pass every persona's hat explicitly.**
3. **A PHI sentinel CPF collided with a seeded persona's real CPF** (`52998224725` is
   `solo.c@test.local`'s). It fabricated a `23505` that read exactly like a broken finalize
   door. Fixed structurally: pgTAP 385 §0.5 now asserts every sentinel is a valid but
   **UNUSED** value, so the class cannot recur.

### Two design defects found by keystones, not by design review

- **AE1.3:** the door normalised CPF for the **change comparison** but stored `p_cpf`
  **verbatim**, so a formatted CPF compared equal (correctly not a change, correctly not
  escalated to SUBSET) and was then written raw into a `^[0-9]{11}$` CHECK → `23514`.
  ⭐ *A writer that disagrees with its own comparison is the defect.* Both impls now
  normalise on write, matching the TS half.
- **AE1.1:** a bare `throws_ok(…, '23503', null, …)` **passes with the FK gone** — the
  AFTER INSERT audit trigger's own FK catches the same bad value downstream. Only pinning
  the constraint name makes the assertion test the FK under review.

## FUP obligations this phase owes — ⛔ file every one at the Record step

⚠ **A gate-record sentence is not a register entry.** Each of these needs an index line in
PROGRESS.md **and** a body in `follow-ups.md`.

| # | obligation | source |
| --- | --- | --- |
| 1 | ✅ **FILED** — `FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY`; measured census says the `ALL`-is-also-a-read-policy class is **26 tables, not 2** | AE1.5 |
| 2 | The **11 unreachable `public` doors** `authenticated` can call that nothing in `src/` calls, + 3 `app` functions no instrument references, + 15 whose only `src/` occurrence is a comment | RV4 |
| 3 | The platform-wide **`actor_id` = null** audit gap; these doors are new instances, not the cause | R3 |
| 4 | **26 of 45** service-role write sites have **no test that would notice their guard vanish** — concentrated in the 33 sites outside the plan's "12 raw-DML" framing | AE1.4 |
| 5 | **`app.is_admin()` hoisting** for `organizations` (evaluated **twice per row**) + 24 further tables, from the 26-table census | AE1.5 |
| 6 | A dedicated **`reactivateUser` deny arm** — today it shares `authorizePersonScopedAdmin(id,'lifecycle')` with `deactivateUser`, whose deny arm is the only one tested | AE1.4 |
| 7 | ✅ **RULED 2026-08-27, approved as-is** — registry flipped; obs #1 fixed (`…005000` atomic latches + pgTAP `388`); 3 FUPs **filed same day, index + body** (`FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` · `FUP-DOC-RECLASS-OPERATION-ID` · `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT`) — no Record-step debt | AE1.4 |
| 8 | Shared TS/SQL vectors (R4) **if deferred** — deferral recorded as a line, never a sentence | AE1.3 |

## Gate obligations still outstanding

- `ENFORCE_PERSON_AUTHORITY_DOORS` in `scripts/check-memberships-door.mjs` is **`false`**.
  ⛔ Flip it **in the same change that lands AE1.3's six doors**, never before — the doors
  must exist in the catalog or `npm run lint` reds for everyone.
- **Re-derive** `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s counts at the Record step. ⛔ Never
  increment them by hand.
- Name the **ARM**, never the script, in the gate record (§6 step 5).
- ✅ **Migration `20261003005000` + pgTAP `388` VERIFIED 2026-08-27** — the PO granted
  stack ownership (other sessions paused); fresh `db reset` → `npm run test:db`: **236
  files, 7,855 tests, PASS**, `388` green by name. ⚠ **This reset also NORMALIZED the
  hand-applied divergence**: `…004600`/`…004610`/`…004620`/`…004710` are now
  registry-applied like everything else. Every measurement taken BEFORE this reset against
  the hand-mutated stack is the provisional kind the standing rule names — re-derive it,
  don't reuse it. (Rolled-back-apply validation record: probes green, post-rollback
  `md5(prosrc)` restored, `388` §3 pins proven RED on the old bodies.)
- The gate's diff-scoped sweep derivation will see `…005000` touching two `prosecdef`
  **non-boolean** command doors: `door-sweep-cases.sh` likely derives ZERO boolean gates
  from it and **exits 1 — a finding to rule on, never a pass** (plan rule 1).
- ✅ **`gen:types` DONE 2026-08-27** (`f121c031`, fresh-reset catalog, zero pgtap
  pollution) — the six TS2345 door-name errors are gone. ⛔ **11 real TS2322 errors
  remain** in `src/lib/users/actions.ts` (748, 749, 788, 793, 999, 1001, 1006, 1009,
  1065, 1070, 1297): `string | null` at the door call sites vs the generated
  `string | undefined`. **AE1.3 owner fixes before committing the doors set** — coerce at
  the call sites or revisit the door arg declarations, and record which in this file.

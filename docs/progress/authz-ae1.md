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

1. registry dispositions complete — the **11 undecidable `.rpc()` sites** PO-ruled; zero
   `undecided` rows at gate [PA-F10];
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
| 7 | The **11 `UNDECIDED` `.rpc()` sites** whose revalidation mechanism is undecidable from the call site — a PO decision, not a gap to fill | AE1.4 |
| 8 | Shared TS/SQL vectors (R4) **if deferred** — deferral recorded as a line, never a sentence | AE1.3 |

## Gate obligations still outstanding

- `ENFORCE_PERSON_AUTHORITY_DOORS` in `scripts/check-memberships-door.mjs` is **`false`**.
  ⛔ Flip it **in the same change that lands AE1.3's six doors**, never before — the doors
  must exist in the catalog or `npm run lint` reds for everyone.
- **Re-derive** `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s counts at the Record step. ⛔ Never
  increment them by hand.
- Name the **ARM**, never the script, in the gate record (§6 step 5).

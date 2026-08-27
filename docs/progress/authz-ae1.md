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
| **AE1.2** DEFINER classification | ✅ classified (752 functions); ✅ **tiered threat review DONE** (close #3 — 523 Tier-1 rows, 325 decided mechanically, 198 by class, 4 findings); ⛔ **all 233 revokes HELD** under RV0 |
| — RV0 partition | ✅ **DONE 2026-08-27** — 44 property-rescued · 5 name-rescued · **23 HOLD** · 161 UNCHANGED = 233 ✓; batches reproduce 134/43/52/4; GUARD_KEYS 11/11 live; **RV3 answered YES**. ⚠ New: **137 of 233 revokes are a silent no-op as scoped** |
| **AE1.3** person doors | ✅ **built + gated** (`63230a84`) — 6 doors + predicate; `callDoor` seam (R7); 16/16 KEYSTONE HOLDS; sweep ERROR **ruled**; all four ARM arms exit 0. Owed at phase close: QA, `e2e:prod`, Record |
| **AE1.4** service-role registry | ✅ **built + committed** (`800ffe2a`) — 45 sites, gate extension **OFF** |
| **AE1.5** initplan triage | ✅ **built + committed** (`40e5c893`) — increment landed, harness snapshot verified (33/33 worklist rows match the catalog, tripwire proven still able to fire); BEFORE `…004620` / AFTER `…004710` both captured (triage doc §6.2). ⚠ Nobody has ruled whether that capture stays representative at `…005300` |
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
2. ✅ **DONE** — `20261003005300` + pgTAP 389 (global `FOR ROLE` form, probe-verified). Was:
   AE1.2's `ALTER DEFAULT PRIVILEGES` uses the **global `FOR ROLE <creator>` form** with
   positive effective-ACL probes (`has_function_privilege` + `pg_default_acl`) — the
   `IN SCHEMA` form is a documented no-op against the built-in PUBLIC default [PA-F4];
3. ✅ **DONE 2026-08-27** — instrument `scripts/authz-tier1-threat-review-ae1.sql` + review
   [authz-ae1-tier1-threat-review.md](../design/authz-ae1-tier1-threat-review.md); 2 PO
   rulings taken first (scope = instrument-then-residue-by-class inside AE1; the C5 set
   fixed outside AE1). ⛔ **Tier 1 is 523, not 432** — the sized figure was its DEFINER
   subset and dropped the 90 `public` INVOKER functions + `graphql_public.graphql`, i.e.
   exactly the ADR 0079 Amendment 7 class. **325 of 523 decided mechanically; 198 reviewed
   by class.** 4 findings (F-T1-1…4), 2 filed as FUPs, 4 columns measured to **zero**. Its
   bounded half (ceiling 752 + merge rule, `backend-state.md` § Privilege budget) was
   already done. See § "close condition #3, and what the instrument was worth";
4. ✅ **DONE** — ONE index (`user_id`), `20261003005100` + pgTAP 383 §3; PA-F15's cascade
   premise measured FALSE and the third FK (`appointed_by`) ruled out. See § "PA-F15 was
   wrong twice";
5. ✅ **DONE** — both `FUP-E2E-REPEAT-FLAKY` members carry a step fingerprint, owner and
   expiry (2026-10-31). ⚠ The **message-pattern** half is deliberately OWED, not invented:
   `e2e:prod` has not run this phase. Also corrected the FUP's "concrete unverified lead" —
   the bare `.focus()` is in a DIFFERENT test (:375, inside :341) than the flaking one (:268);
6. ✅ **DONE** — `20261003005200` + pgTAP 382 §5: **11** policies over **6** tables normalized
   to `TO authenticated`, 0 remaining. ⛔ Not "six": F-AE0-4's counts were wrong in both
   halves and it missed a `case_referral` DELETE policy on a PHI table entirely.

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

### ⭐ Close conditions #2 and #6: a DECLARED rule read as closed while the EFFECTIVE state was open

**2026-08-27.** Both discharged the same day and they are the same shape, which is worth stating
once rather than twice: in each, the artefact that describes the policy — a `pg_default_acl` row,
a finding's own scope sentence — was **read** and gave the wrong answer, and only probing the
**effective** state gave the right one.

#### #2 — `ALTER DEFAULT PRIVILEGES`, the global `FOR ROLE` form (PA-F4) → `20261003005300` + pgTAP 389

PA-F4 says the `IN SCHEMA` form is a documented no-op against the built-in PUBLIC EXECUTE
default. ⛔ **It is, and this database disguises that convincingly.** `pg_default_acl` already
carried `(defaclrole=postgres, nsp=public, objtype=f) acl={postgres=X,service_role=X}` — a rule
listing **no PUBLIC**, which reads as "`public` is already closed". Probed instead, by creating a
throwaway function in each schema:

| probe | `proacl` | anon EXECUTE |
| --- | --- | --- |
| `app._adp_probe` | **NULL** — the built-in default | **true** |
| `public._adp_probe` | `{=X/postgres, postgres=X/…, service_role=X/…}` | **true** |

Both open. The `public` row is additive to the built-in default, not a replacement, and the
**leading `=X/` with an empty grantee IS the PUBLIC grant**. ⭐ This is the *guards that read
right but fail open* family — an implicit or NULL `proacl` **includes PUBLIC** — and it was one
inference away from being recorded as "already safe".

Creator roles enumerated, not assumed: **`postgres` is the only one** (550 `public` + 507 `app`
functions, all `proowner=postgres`), so one global command covers both — and `authz` too when AE4
creates it, before any object exists. Effect measured in a rolled-back transaction *before* the
migration was written: new functions in both schemas grant anon and authenticated nothing.
⛔ Existing functions untouched, with a positive control asserting it (`app.is_admin()` still
anon-executable): the historical residue stays `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`,
a PO decision, and pgTAP 389 §3.1 makes folding it in silently impossible.

#### #6 — every `TO public` policy normalized (AE0 F-AE0-4) → `20261003005200` + pgTAP 382 §5

⛔ **F-AE0-4's counts are wrong in BOTH halves while its total is right, which is why nobody
noticed.** It reads *"six `process_template_*` tables gate on `TO public`"* and *"the other 2
tables … use `TO authenticated`"*. Measured: the family is 8 tables, split **5 / 3**, and the
unit is **policies** — those 5 tables carry **10** (a `_select` and a `_staff_admin_write` each).
The plan then compressed this to *"the six `TO public` process-template policies"*, a third
figure matching neither.

⛔ **And there is an eleventh, outside the feature the finding scoped itself to:**
`case_referral.case_referral_delete_draft_source` — a **DELETE** policy, `TO public`, on a
**Rule 12 PHI-module table**. ⭐ *A finding that names a feature bounds its own sweep to that
feature; the PROPERTY does not stop at the feature edge.* Swept by the property here: 11
policies, 6 tables, **0 remaining**.

F-AE0-4's "not an exposure today" claim **holds** and was re-measured across all six tables
(`anon`: no SELECT/INSERT/UPDATE/DELETE anywhere; positive control — `authenticated` returns
true, so the probe is not stuck-false). Normalization is behaviour-preserving, measured not
assumed: only `authenticated`, `postgres` and `service_role` hold any grant, and the latter two
carry **`rolbypassrls = true`**, so RLS never applied to them; `anon` and `authenticator` hold no
grant and cannot reach the tables at all. So `authenticated` is the only role these policies ever
gated. What changes is that the bound is now **declared by the policy** instead of supplied by
the grant layer — Architecture Rule 1 puts the boundary in RLS, and one future
`grant … to anon` was all that stood between the two readings.

**Both red-first proven.** 382: §5.1/§5.3 failed pre-migration while the §5.2 vacuity control
passed on a real fact (a deliberately `TO public` probe policy IS matched) → **71/71** after.
389: **7 of 9** failed pre-migration → **9/9** after. ⚠ 389 §2.2 is the sharp one: pre-migration,
revoking anon's *explicit* grant still left it privileged **through PUBLIC**, which is the defect
stated as a test.

#### ⛔ The ADP change's blast radius landed on TEST SCAFFOLDING, and one victim was a CONTROL

Applying `20261003005300` took the full pgTAP suite from PASS to **FAIL across four files**, and
**not one was a production door** — `test:db` read `Files=237, Tests=7814, FAIL` where the shape
predicted ~7,870, the shortfall being three suites ABORTING mid-file.

- **277 / 292 / 380** — `permission denied for function <helper>`. Each creates a helper (two in
  `pg_temp`, one in `app`) and calls it as a **non-owner** role. They worked only because a new
  function inherited the built-in PUBLIC EXECUTE default. Fixed by stating the grant, which is
  the change's whole point.
- **320** — an ACL-population **vacuity control** asserting *"creating ONE app function with the
  default ACL moves the count 237 → 238"*. After the migration a new function no longer joins
  that population, so the count stopped moving and the control **failed — which is the control
  working.**

⭐ **The near-miss worth keeping.** 320's cheapest green was to expect **237**. That edit would
have made a *detector-vacuity control pass by asserting the detector finds nothing* — precisely
what the control exists to rule out — and it would have looked like a one-character baseline
refresh. It now **grants PUBLIC explicitly**, constructing the condition it probes for instead of
borrowing it from an ambient default, which is strictly stronger: the control no longer depends
on a database-wide setting the suite does not own.

⭐ **Generalisable:** a change to a **default** has a blast radius covering everything that
silently relied on that default — and **test scaffolding relies on defaults far more than
production code does**, because production grants get reviewed and a test helper's do not. ⚠ My
own migration header predicted the consequence and understated it (it named only service_role on
new `app` functions); the header was corrected from the measurement, not the prediction.

### ✅ The writepath worklist update did NOT silence its tripwire — proven, both halves

The phase ruled that regenerating the 13 drifted snapshot lines *"must **prove the tripwire can
still fire** — otherwise 'update the snapshot' is 'silence the tripwire' wearing maintenance
clothes."* Discharged 2026-08-27, in two independent directions:

1. **The transformation is correct, not merely its source.** *"Regenerated from the catalog"*
   describes where the bytes came from, not whether the rewrite was right — this phase's own
   `⭐ One lesson, not three`. So all **33** worklist entries were diffed against
   `pg_policies` (whitespace-normalized, exact line match): **0 mismatches**.
2. **The tripwire still detects drift.** One worklist line (`profiles|profiles_update_self`) was
   reverted to its pre-wrap spelling, the edit asserted to have LANDED, and a 1-case run made:
   `ERROR profiles.profiles_update_self (qual drift)`. Harness restored byte-identical
   (`cmp` clean).

⚠ **And the run confirmed the exit-code defect independently:** the harness printed that ERROR
and still exited **0**. A second sighting, from a different direction than the one that found it.

### ⛔ Close condition #3 is an order of magnitude larger than the list it was filed in

**2026-08-27, measured before starting it.** The handoff groups #3 with genuinely small items:
*"the ONE `user_id` index (+pgTAP) · ADP global-form + probes · tiered-review columns over the
752 classification · flake fingerprints · the `TO public` ruling · R2 HMAC deny test."* Five of
those are a session's work between them. This one is not, and the sizing is checkable:

| | | source |
| --- | ---: | --- |
| Tier 1 — remotely reachable | **432** | `config.toml` exposes `["public","graphql_public"]`; `app` is not exposed |
| Tier 2 — `app` schema | **320** | same boundary |
| command doors in the population | **384** | classification §6.1 (372 + 12 multi-class) |

PA-F11 asks Tier 1 for **ten** threat columns per row — owning role + `BYPASSRLS` effect ·
PostgREST exposure · caller-identity binding · arbitrary-principal parameters ·
authority-before-existence ordering · overload/default-argument reach · dynamic SQL +
`search_path` · output minimization & enumeration · audit emission · exact grants — **and that
public command doors be individually justified**. That is a security review over ~432 rows, not a
documentation pass.

✅ **What was completed instead, because it is bounded and was the half that actually bites:** the
budget's **ceiling and merge rule**. A count without them is inventory; the count falls only by a
revoke (all 233 HELD) and rises silently one defensible `grant execute` at a time, so the ceiling
is what makes the aggregate a decision rather than a by-product.

⚠ **Stated rather than absorbed.** The honest failure mode here is a shallow pass that fills 432
rows thinly and reports #3 as met — after which the phase record says a threat review happened.
AE1 does not close on this item until it is scoped and run, or the PO narrows it (e.g. to the
command-door subset, or to the doors an increment actually touches).

### ✅ Close condition #3, and what the instrument was worth

**2026-08-27, same stack, head `20261003005300`.** Scoped and run — not narrowed. Two PO
rulings were taken **before** the work, with the sizing measured rather than estimated:
scope = *instrument first, then review the residue by class, inside AE1*; and the C5 finding
set = *filed as a follow-up, fixed outside AE1*.

Artifacts: [`scripts/authz-tier1-threat-review-ae1.sql`](../../scripts/authz-tier1-threat-review-ae1.sql)
(the deriving instrument) + [authz-ae1-tier1-threat-review.md](../design/authz-ae1-tier1-threat-review.md)
(the review). **325 of 523 rows decided mechanically; 198 reviewed by class.**

⛔ **The sizing above is wrong in its first row, and the correction is the point.** Tier 1 is
**523**, not 432. PA-F11 says *"remotely reachable functions (exposed schema + `authenticated`/
`anon` effective EXECUTE)"* — nothing in that says DEFINER. The 432 inherited AE1.2's
DEFINER-only population and dropped **90 `public` INVOKER functions + `graphql_public.graphql`**
— which is *exactly* the class ADR 0079 **Amendment 7** was written for: a `public` INVOKER
wrapper whose own probe is the only gate in front of an `app` DEFINER body, in **no** arm's
domain at all. A threat review that inherits its population from a DEFINER census reproduces
the blind spot in a new instrument. ⚠ The `[PA-F11]` text in the plan carries the same 432.

⭐⭐ **The grain lesson, which is why the instrument was worth building at all.** Computed
**per body**, the arbitrary-principal column reads **27 doors that take a principal uuid with
nothing binding it to the session** — `assign_org_admin`, `assign_hospital_admin`,
`revoke_nsp_org_admin`, all DEFINER and `authenticated`-executable. Read them and every one is
a two-line delegator: `assign_org_admin → grant_role → grant_role_impl((select auth.uid()), …)`.
Computed over the **call closure** the same column reads **zero**. ⛔ Had the ten columns been
filled in by hand, those 27 rows would have been written down as findings — or, worse,
dismissed as "probably delegating" without anyone checking which. The closure was then measured
by **two edge instruments** (qualified-only vs qualified+bare, the second able to over-join,
which is the *unsafe* direction here): they differ by 4 edges and **not one row changes bucket**.

**Four findings, and four columns that measured to zero:**

| | |
| --- | --- |
| F-T1-1 | Tier 1 = 523, not 432 (above) |
| F-T1-2 | **31** DEFINER doors confirm existence before authority → `FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY` |
| F-T1-3 | **62** mutating DEFINER doors write ~25 child/vocabulary tables with **no audit path at all** — a Rule 11 gap → `FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED` |
| F-T1-4 | the classification's *"a DEFINER runs as a superuser"* is **false** here (`postgres` is `rolsuper = f`, `rolbypassrls = t`); conclusion survives via **ownership** — corrected in place |
| zero | arbitrary-principal binding · dynamic SQL · enumeration surfaces · overload reach |

⭐ **F-T1-3's shape is worth keeping: the parents are audited and the children are not.**
`app.trg_audit_rca` exists; `rca_factors` carries only `guard_rca_child_lock`. A child insert
never touches the parent row, so no parent audit row is emitted for it either — **audit
coverage does not flow downward**, and a table-level census that stops at the aggregate reads
as complete.

⛔ **Two instruments of my own were wrong in the reassuring direction, in one afternoon.**
(1) The dynamic-SQL detector's 3 hits are all false positives on **string literals** — the
comment-strip removes comments, not literals, and this codebase's literals are pt-BR prose:
`complete_dsr_task` matched `\yexecute\y` inside *"execute o descarte antes de concluir a
tarefa"*, where `execute` is a Portuguese verb. Every `prosrc` sweep in this repo inherits that.
(2) The probe that printed the match context read **`m[0]`** — `regexp_matches` returns captures
at index **1**, so it was NULL for every match and reported *"no matches"* on bodies full of
them. It **agreed with what I already believed** and would have closed all three candidates as
dispositioned-by-nothing. What caught it was a `true` boolean sitting next to an empty match
list. *A probe that confirms your prior is the one to re-run against a known positive.*

### ✅ `e2e:prod` — GATE GREEN, and the flake fingerprints earned their keep on day one

**2026-08-27, tree `120478bf`, 17:28→18:37 UTC.** The §6 step-2 gate, never run this phase before.

`GATE GREEN`, exit **0** — **1249 passed · 0 failed · 0 infra · 3 flaky · 11 skipped · 21 batches**,
2 INFRA re-runs (batches 3 and 16: `server_dead=1`, connection errors — the known Windows
server-death class, re-run and green).

⚠ **The summary line reads `accounted for 1252 of 1263`, and that gap is NOT unrun tests.** Summing
the **final** batch lines gives **accounted 1263/1263** with **11 skipped**; 1249 + 3 + 11 = 1263.
⭐ Checked because a gate summary is exactly where unrun tests hide — here the arithmetic closes.

⭐⭐ **This run is what proved the six AE1.3 doors over the WIRE.** pgTAP calls them in SQL and the
vitest fixture mocks the client, so until now nothing had exercised `callDoor`'s explicit `null`s
through supabase-js serialization. The person-admin flows (`user-registration.spec.ts` AC2–AC7 +
the security-boundary arms) all pass.

#### The three flakes, named — and the fingerprints written that morning split 1 for 2

| test | baseline? | fingerprint |
| --- | --- | --- |
| `phase2-auth-shell.spec.ts:268` | M2 | ✅ **EXACT** — failed at `:58`, a step the fingerprint named |
| `act-role-assumption.spec.ts:157` | M1 | ⛔ **MISMATCH** — predicted `:160`, observed `:168` |
| `ethics-e4-participants.spec.ts:765` | **NO** | new; NOT admitted → `FUP-E2E-PROF-CREATE-ROSTER-FLAKE` |

M1's fingerprint is **corrected from the measurement**, and the distinction is load-bearing:
`:160` was an explicitly-labelled **guess** with no evidential basis, so replacing it with the
first observation is not the same act as widening a fingerprint that was ever measured. ⚠ It cost
something real — M1's fingerprint gave **zero discrimination** on the one run it existed for.

⭐⭐ **And the run found the shared mechanism this FUP has hypothesised for months.** M1 fails
clicking `menuitem` *"revisor(a) da qualidade"* (:168); M2 fails on `menuitem` *"sair"* not visible
(:58). **Both are Radix items inside the SAME `"abrir menu da conta"` dropdown, absent after the
trigger click.** One root cause across both survivors — ⛔ but **not** the
`.focus()`-races-RSC-streaming class the FUP named: neither failing step calls `.focus()`, and that
hypothesis's only cited evidence was withdrawn the same morning (the bare `.focus()` is at `:375`,
in a *different* test). A mechanism, not yet a fix — nobody has established *why* the menu is empty.

### PA-F15 was wrong twice, and the handoff's correction was right by accident

**2026-08-27 — plan close condition #4, discharged** (`20261003005100`, pgTAP 383 §3, plan 7→10).

PA-F15: *"AE1.1's two FKs lack supporting indexes"* → a `profiles` cascade full-scans the table.
The handoff halved it: *"the remedy is ONE index, not two"* — `commission_id` leads the PK
`(commission_id, user_id)` and is supported; `user_id` is trailing and is not.

⛔ **Measured, and the cascade premise does not hold for EITHER column.** A `profiles` row can
never be deleted, by two independent barriers: `guard_profile_no_delete_trg` (BEFORE DELETE,
`tgenabled='O'`, raising *"profiles are never deleted; deactivate via is_active"*) and
`profiles_id_fkey -> auth.users(id) ON DELETE RESTRICT`, which refuses the upstream delete rather
than cascading in. So the `user_id` CASCADE cannot fire, and neither can the RI check behind the
**third** FK, `appointed_by` — which both PA-F15 and the handoff missed, having counted only the
two FKs AE1.1 added.

✅ **The `user_id` index is still warranted, on completely different evidence:**
`commission_administrativos_select`'s qual ends `... OR (user_id = ( SELECT auth.uid() ))` — a
self-read filtering by `user_id` with no `commission_id`, exactly what a trailing PK column
cannot serve, evaluated on every non-admin read.

⛔ **`appointed_by` gets NO index**: nothing filters by it (swept `pg_policies`, comment-stripped
`prosrc` over app/public, and `src/`), and its RI check is unreachable. ⚠ The sibling convention
`memberships_granted_by_idx` argues for one and was **not** followed — a convention is evidence
about habits, not about this table's access paths.

⭐ **The shape worth keeping.** The handoff reached the right column through a premise that is
false; had `commission_id` been the trailing one, the same reasoning would have produced the
wrong index and every later reader would have inherited a confident, measured-sounding sentence.
*A conclusion that survives its premise being wrong has not been verified — it has been lucky.*
This is why pgTAP 383 §3.3 pins the delete guard **next to** the conclusion depending on it: drop
the guard and the cascade premise becomes live again, and the suite says so instead of the index
comment quietly going stale.

**Red-first, both directions:** with the index absent, 383 §3.1/§3.2 FAILED (8–9 of 10) while
§3.3 passed on a real fact; after the migration, **10/10 PASS**. ⚠ Suite shape is now
**236 files / 7,858 tests** — any sweep baseline captured before this is one more world out of date.

### ✅ RESOLVED — the 63-case re-run replaced the stale verdicts, and coverage IMPROVED

**2026-08-27, quiet stack, one contiguous window (15:49 → 17:02 UTC).** The stale-baseline
problem recorded below is closed by re-measurement, not by a ruling accepting inheritance.

**Scope.** Cases derived by `scripts/door-sweep-cases.sh f99cdd5d` (AE1's migration base) — never
by hand — over all **9** AE1 migrations: **63 cases**, up from AE1.5's 52 because AE1.3's
predicate and close condition #6's 11 normalized policies are in the same phase.

| arm | domain | result | exit |
| --- | --- | --- | ---: |
| read (`p0-authz-door-audit.sh`) | `predicate=1/112 policy=40/226` | **SWEPT 41 · COVERED 40 · BLIND 0 · ERROR 1** | 1 |
| write (`p0-authz-writepath-audit.sh`) | — | **COVERED 13 · BLIND 0 · ERROR 0 · SKIPPED 0** | 0 |

⛔ **The write arm's exit 0 still means nothing by itself** — same `(COVERED = the rest)` summary
with no selection count. What makes this run different from the one that measured NOTHING is that
it *emitted 13 verdicts*; the count of verdicts, never the exit code, is the discriminator.

**Baseline integrity:** `git diff --stat` empty during the run and cksum-verified by the harness;
`degenerate_NON_SELECT = 0` afterwards, so no gate was left open.

#### 54 of 63 measured — and the 9 are NAMED, not counted

`answers_insert_targeted` · `answers_update_targeted` · `case_events_staff_admin_delete` ·
`case_events_staff_admin_insert` · `case_events_staff_admin_update` · `case_events_writer_delete` ·
`case_events_writer_insert` · `case_events_writer_update` · `responses_update_targeted`

⭐ **These are the SAME 9 the earlier ruling named, arrived at independently on a fresh baseline
and a wider case set.** That is the useful part: it confirms the gap is **structural** (the C2
apparatus family — outside *both* arms' domains) rather than an artefact of one run.

#### The merge — changed rows only, and the differential was predicted before it was written

37 updated in place · 15 added · 2 unchanged. Predicted BLIND −5 / COVERED +20; measured
**BLIND 74 → 69** and **COVERED 296 → 316**. ⛔ Never a copy of the subset file over the baseline
(ADR 0079 Amdt 1).

**FIVE verdicts flipped BLIND → COVERED — individually, never as a count:**
`case_correction_requests_select` · `case_reopenings_select` · `case_tag_assignments_select` ·
`commission_administrativo_capabilities_select` · `professional_participants_select`.

⭐ All five are held by **`387_initplan_wrap_and_profiles_arm_identity.sql`** — AE1.5's own new
suite. So this phase did not merely re-measure existing coverage, it **created** it: five gates
that no keystone noticed opening now have one. The handoff anticipated exactly one of these.

⚠ **Two of them are held by 387 ALONE** (`case_tag_assignments_select`,
`commission_administrativo_capabilities_select`) — their COVERED status has a single point of
failure, and editing 387 reverts them to BLIND with nothing else to catch it.

**All four arms after the merge:** `ARM=census` **0** (565 live gates, 601 verdicts) ·
`FROMFINDINGS=1 ARM=wrapper` **0** (BLIND 41, all allowlisted) · `ARM=hat` **0** · `ARM=floor`
**0**. ⛔ Domain qualifier unchanged: C2's command doors remain outside every arm.

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
⛔ **AND SEE § "43 measured verdicts, ready to merge" BELOW BEFORE ACTING ON THIS**: those
measurements were taken against `Files=235, Tests=7793`, a baseline superseded by the
normalizing reset. The merge contract here is sound; the *inputs* to it are not yet.

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

### The 11 typecheck errors were TWO classes, and the handoff's framing admitted neither

**2026-08-27, AE1.3.** The handoff carried the open question as *"coerce at call sites or
change door arg declarations?"* — measured, **both options are wrong**, and the reason is
that the 11 `TS2322` errors are not one population:

- **8 sites** pass a `null` to an argument whose SQL declaration carries `DEFAULT NULL`
  (`p_cpf`, `p_date_of_birth`, `p_phone`, `p_expires_on`, `p_suspended_until`). `gen:types`
  emits these as `p_x?: string`. Omitting the key falls through to the SQL default, so
  `?? undefined` is equivalent — **today**.
- **3 sites** pass a `null` to an argument with **no default** (`p_id` ×2,
  `p_professional_category_id`), emitted as `p_x: string`. Omitting the key leaves PostgREST
  unable to resolve the overload: **PGRST202 at runtime, `tsc` green.**

⭐ **Nothing at a call site distinguishes the two.** A blanket `?? undefined` is correct at
8 of 11 and ships a runtime break at the other 3 — the *a-fix-correct-at-MOST-sites* shape.

The second option is worse than merely wrong. Giving `p_professional_category_id` a
`DEFAULT NULL` so the generator marks it optional would mean an edit form that omits the
field **silently nulls the person's category** — the exact hazard `update_person_fields_for`
built its `p_set_*` tri-state to prevent, stated in `users/actions.ts`'s own comment.

**Ruled (R7):** neither. The defect is that `supabase gen types` **never** emits `| null` for
a function argument although every SQL argument accepts NULL. Fixed once at the type seam —
`src/lib/types/rpc-args.ts`, `callDoor(client, fn, args)` — so `database.ts` stays generated
(Rule 8; hand-patching it would be reverted by the next `gen:types`, silently). Every call
site keeps passing explicit `null`, which is what the SQL means.

**Proven able to fail** (a widened type that admits anything passes just as quietly):
misspelled argument name → `TS2561`; wrong value type → `TS2322`; **omitting a required
no-default argument → `TS2345`**. The third is the PGRST202 shape, now statically
unreachable. ⚠ The first attempt at these controls printed nothing and read as three clean
passes — inserting the import had shifted every line below it by one, so the `sed` addresses
matched nothing and **the mutations never applied**. Assert the edit LANDED before reading a
control's silence as a result.

### A gate matched the PROSE THAT DOCUMENTS the code it gates

Flipping `ENFORCE_PERSON_AUTHORITY_DOORS` reded `lint:memberships-door` on exactly one site:
`d14-person-level.test.ts:112` — a **docstring** reading *"moved from raw
`.from('profiles').update({…})` to `public.*_for` doors"*, the sentence describing the very
migration that removed the raw DML. The scanner regex-matched raw source with no comment
handling.

This is the `ui-copy-forbidden-strings` class: **source cannot separate live code from prose
about it, so the matcher must.** Rewording the docstring would make the documentation serve
the tool; allowlisting the file would grant it blanket permission for real raw DML. Fixed at
the matcher — `blankComments()` replaces comment content with spaces, preserving newlines and
character count so reported line numbers stay exact, and is **string-aware** because a naive
stripper reads the `//` in a URL literal as a comment start and blanks the rest of that line,
which SILENCES a finding rather than surfacing one.

⚠ **A gate whose matcher you just changed must be re-proven, not re-run.** Three positive
controls fired at exact line numbers, including one placing real DML on the same line as a
`https://` literal. ⛔ Note the direction of risk: every failure mode of this edit is
*silence*, which is why the controls matter more than the green.

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

### ⛔ AE1.5's "43 measured verdicts, ready to merge" were earned on a BASELINE THAT NO LONGER EXISTS

**2026-08-27, found by the AE1.3 owner while starting the merge the handoff listed as next.**
The merge was not performed. Measured, from the surviving scratch reports' own header lines:

| run | scratch dir | declares | mtime (UTC) |
| --- | --- | --- | --- |
| read arm — **30 COVERED, 0 BLIND** | `authz-audit-ae15-r2-1787835211` | `Baseline: Files=235, Tests=7793` | 13:35 |
| write arm — **13 ERROR** | `authz-wp-ae15-1787837865` | `Baseline: Files=235, Tests=7793` | 13:39 |
| write "final" — **6 COVERED, 2 ERROR** | `authz-wp-final-1787838457` | `Baseline: Files=235, Tests=7793` | 13:59 |
| **the normalizing `db reset`** (`2448a655`) | — | establishes **236 / 7,855** | **14:20** |
| AE1.3's sweep, for contrast | `authz-audit-ae13-1787843281` | `Baseline: Files=236, Tests=7855` | 15:11 |

**Every AE1.5 sweep ran BEFORE the reset that normalized the hand-applied-migration divergence** —
the same divergence this file already records as having voided "every sibling measurement".
Nobody re-ran them afterwards; the handoff carried them forward as a finished asset.

⭐ **The handoff's arithmetic also does not survive contact with the reports.** It reads
*"43 of 52 — 30 read-arm COVERED + 13 write-arm"*, which invites the reading that 43 verdicts
exist. The write arm's 13 are **ERROR**, not verdicts: `run shape != baseline`, the harness
explicitly withholding a judgement. So the merge as specified would have written 30 COVERED plus
13 non-verdicts into the committed baseline.

⚠ **What is and is not implied.** The 30 COVERED are *probably* still true, because COVERED is
**monotone under a superset suite**: it means "the suite FAILed when this gate was opened", and
236/7,855 appears to be 235/7,793 plus file `388` and `270`'s two new assertions — adding tests
cannot stop an existing keystone from noticing. ⛔ **But "probably still true" is not a
measurement**, and the direction of the risk is what matters: this is precisely
`green-baseline-is-not-fit-to-mutate` (6 of 8 verdicts flipped without a fresh reset, mechanism
never established). ⭐ Note the asymmetry that makes the monotonicity argument narrower than it
looks: it rescues COVERED only. A **BLIND** earned on the smaller suite could be COVERED now,
since the added tests might be exactly the ones that notice. This run happens to have 0 BLIND —
which is luck about this run, not a property of the argument.

**Not merged, and no rows written.** The options are (a) re-run AE1.5's 52 cases on the current
clean stack, which also discharges the 30 stale-verdict warnings `door-sweep-cases.sh` raises
under ADR 0079 Amdt 8 ruling 3, or (b) a PO ruling to accept the 30 COVERED on the monotonicity
argument, recorded as an accepted inheritance rather than a measurement. ⛔ What must NOT happen
is the third thing, which is the cheap one: merging them silently, after which the baseline says
"measured" and nothing in it can contradict that.

## AE1.3 gate record — 2026-08-27, quiet stack, fresh reset

Tree `63230a84` plus the one merged findings row. Every exit code below was read **directly**,
never through a pipe.

**Suite baseline:** `db reset` → `test:db` **Files=236, Tests=7855, PASS, exit 0.** Every
mutation run below compares against that shape.

**Targeted mutation audit** (`ae13-person-doors-mutation-audit.sh`): **16 cases declared, 16
`KEYSTONE HOLDS`, FINDINGS: 0**, exit 0. Each case asserts the edit LANDED (md5 moved), reds
under mutation, greens after restore, and restores to the baseline hash EXACTLY. G2 (the guard —
not an AE1.3 object) came back byte-identical; its header calls a mismatch a stack-level incident.
⚠ The handoff said "15-case"; the harness declares **16** (15 + G2). Measured, not inherited.

**Diff-scoped door sweep** — case list derived with `scripts/door-sweep-cases.sh ad6120b1`,
never by hand. ⚠ **The deriver returned 53 cases, not 1.** It includes UNTRACKED migrations, so
it swept up AE1.5's `…004710` (52 policies) alongside AE1.3's single new gate. Those 52 are
AE1.5's already-ruled sweep (43/52 PARTIAL, merge pending) — re-running them here would
re-measure another increment's work and destroy this one's attributability. **AE1.3's own case
is exactly one: `app.can_administer_person_for`.**

- **READ arm** (`p0-authz-door-audit.sh`), `CASES="can_administer_person_for"`: exit **1 —
  DIRTY: 0 BLIND, 1 ERROR**, `ARM-DOMAIN predicate=1/112 policy=0/226`. ⚠ The POLICY arm
  reported **EMPTY DOMAIN — it did not hold, it did not run.** Counted as nothing.
- **WRITE arm** (`p0-authz-writepath-audit.sh`), same `CASES=`: exit **0, and that exit code
  means NOTHING here.** It printed `BLIND: 0 ERROR: 0 SKIPPED: 0 (COVERED = the rest)` with
  **no selection count** — a predicate matches no write-layer case, so the residual was computed
  over an EMPTY SET. This is the same defect recorded above under "A MANDATED GATE HARNESS
  REPORTED SUCCESS AT EXIT 0"; it is reported here in words and never as an exit code.
- **Baseline integrity:** `git diff --stat` on the findings file was empty during the run and
  the harness cksum-verified it unchanged. The ERROR verdict was merged afterwards as **one
  changed row (+1/−0)**, never a copy of the subset file (ADR 0079 Amdt 1).

**The ERROR, ruled.** Cause measured, not assumed: neutralizing the whole function to
`select true` yielded `Files=236 Tests=7848` against the 7855 baseline — **7 assertions stopped
RUNNING**, a suite aborting rather than failing. 384's plan is a static `plan(55)`, so this is
not a conditional skip. CLAUDE.md §6 step 1's own remedy for ERROR is *"cover it in the phase's
mutation audit"*, and cases 10–14 do exactly that by neutralizing this predicate's **individual
conjuncts** (empty-footprint pin · `ended_on is null` · `voided_at is null` · the D2 tier check ·
the INTERSECTION↔SUBSET swap) instead of the whole body. Precedent, same cause and class:
`app.event_current_custodian` → `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE`. ⛔ The harness is
**not** changed mid-phase — it is a gate component in flight for other phases.

**The deriver's 12-name review list, ruled.** It excluded the six `*_for` doors and six `*_impl`
kernels as *"the filter cannot tell"* and demanded a ruling on each. Measured in the catalog: the
six `public.*_for` wrappers are **pure delegators** — 2–4 lines each, every one calls its `_impl`,
**none** carries an authority call, **none** raises. Authority lives entirely in the six
`app.*_impl` kernels, and the audit mutates exactly those seven `app` functions (6 kernels + the
predicate). So all 12 are dispositioned: 6 kernels directly mutation-proven, 6 wrappers hold no
gate to mutate. ⚠ **Standing consequence:** if an authority check is ever MOVED into a wrapper,
nothing in this apparatus would mutation-test it.

**The four ARM arms**, post-merge tree: `ARM=census` **0** (INVARIANT HOLDS; **565 live gates
enumerated** — so not the vacuous zero-gate shape — verdicts 600→601, the differential being
exactly the merged row) · `ARM=hat` **0** (self-test 6/6; 3 findings, all reasoned-allowlisted) ·
`ARM=floor` **0** · `FROMFINDINGS=1 ARM=wrapper` **0** (BLIND set 41, every one allowlisted).

⛔ **Domain qualifier, stated (plan rule 2):** the reachable command doors of
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2) sit outside **every** arm's domain until that FUP closes.
"All arms green" here means green *over these arms' domains*, not over the command-door surface —
and C2's counts are re-derived at the Record step, never quoted from memory.

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
| 9 | The mutation audit targets the six `app.*_impl` **kernels**; the six `public.*_for` wrappers are pure delegators today (catalog-measured), so **an authority check later MOVED into a wrapper would be mutation-tested by nothing** | AE1.3 gate record |
| 10 | `scripts/door-sweep-cases.sh` derives over **untracked** migrations too, so in a tree holding two in-flight increments a diff-scoped sweep for one silently selects the other's cases — **53 derived where AE1.3 owned 1**. Correct behaviour, unattributable result; the deriver cannot distinguish 'this increment' from 'this working tree' | AE1.3 gate record |

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

### ✅ RV0 partition + RV3 — DONE 2026-08-27, and the revoke plan does not survive contact with the ACLs

Head `20261003005300`, read-only (⛔ **no revoke was executed; all 233 stay HELD**). Record:
[authz-ae1-revoke-partition.md](../design/authz-ae1-revoke-partition.md) — §4 now carries the
executed SQL verbatim, §5 the measured verdicts, §6 RV3's answer with its transcript.

| verdict | n | |
| --- | ---: | --- |
| PROCEED (property-rescued) | 44 | rescue survives a rename |
| PROCEED (name-rescued) | 5 | rescued **only** by `GUARD_KEYS`' 11-name hand list — a rename silently evicts them |
| **HOLD (blindness created)** | **23** | RV0's target: in ≥1 arm's domain before, in zero after |
| UNCHANGED (never swept) | 161 | ⛔ **not a clean bill** — zero arms looked at them before or after |

44 + 5 + 23 + 161 = **233 ✓**. Batch sizes re-derived from catalog shape reproduce
**134/43/52/4** exactly; GUARD_KEYS **11/11 live**, no dead rescue; the 233-row input re-extracted
with Bash and count-checked three independent ways (the recorded 232-line loss did not reach it).

**The 23 HOLD**: 3 `app` set-returning (`case_phase_option_aggregates`, `eligible_voters`,
`submitted_form_responses` — they leave `census` clause 1 *and* `policy` rowdoor) + 20 `public`
leaving `floor`, being 19 trigger bodies and **`set_participant_patient`** (Rule 12 PHI).

⛔ **Batch 1's "lowest-consequence" framing conflates runtime with observability.** True: EXECUTE
on a trigger function is checked at `CREATE TRIGGER`, not at fire time. False: `ARM=floor` applies
**no return-type filter**, so 19 trigger bodies are in its domain *today* and the revoke evicts
every one. A class can be harmless to run and load-bearing to watch.

#### ⛔⛔ 137 of the 233 revokes would report success and change nothing

The premise check found **138** of the 233 reach `authenticated` **via `PUBLIC`**, 137 of them
with no direct grant at all (`proacl IS NULL` = 137). `has_function_privilege` is true if the
privilege arrives by **any** route, so `revoke execute … from authenticated` leaves it **true**
and nothing observable moves — and **no arm would notice**, because the arms would return
identical verdicts for the honest reason that the privilege never changed.

⛔ **That figure was derived by reading grant routes, which is the exact evidence grade close
condition #2 of this phase was burned by** — there, `pg_default_acl` "listed no PUBLIC" and read
as closed while the effective state was open. Re-run by the lead as an **effective probe** inside
a rolled-back `do $$` block, with a positive control:

| subject | `proacl` | before | after `revoke … from authenticated` |
| --- | --- | :---: | :---: |
| `app.can_read_event_patient` | **NULL** | `true` | ⛔ **`true`** |
| `app.commission_of_case` (control) | explicit | `true` | ✅ `false` |

The control is what makes the first row evidence rather than a stuck-true probe. The ACL the
revoke *materialised* on the NULL row is the tell — `=X/postgres,postgres=X/postgres`, whose
**leading `=X/` with an empty grantee IS the surviving PUBLIC grant**. ⚠ And the probe landed on
`app.can_read_event_patient`, a **Rule 12 PHI read predicate** — the no-op class is not confined
to inert helpers. Fifth sighting of *a NULL `proacl` includes PUBLIC*.

✅ **All 23 HOLD rows carry a direct grant and no PUBLIC grant, so the revoke is fully effective
on exactly the rows the verdict is about.** The no-ops concentrate in UNCHANGED (130 of 137).

#### RV3: **YES** — Postgres re-checks EXECUTE at write time inside a stored CHECK

A role lacking EXECUTE on a function referenced in a CHECK expression **cannot write the table at
all**: `42501 permission denied for function`, not the constraint's `23514`. Proven on both
language classes (4 of the 5 are `LANGUAGE sql` and could plausibly have differed under
inlining — they do not), with a **one-variable differential**: deny → `GRANT EXECUTE` → the same
insert **succeeds** → an invalid value still `23514`, so the CHECK is genuinely evaluated rather
than skipped. ⚠ §6 states plainly that RV3's exclusion filter **bound nothing here** — its 5
functions were already absent from the 233, so it was a correct precaution over an empty set, not
a filter that ran and found nothing.

⭐ **RV3's first attempt produced output at every step and proved nothing**: `postgres` is
**not superuser** on this stack, so every `SET ROLE` was denied — and the residue checks still
passed, because a probe that never ran leaves no residue. The same `rolsuper = false` fact that
the tier-1 threat review found falsifying the classification's "a DEFINER runs as a superuser"
premise, arriving independently from the other side the same afternoon.

⚠ **Four of eight `file:line` citations in §2 had drifted** (worst: `act-hat-blind-sweep.sh`
`:189` → `:181-183`, now pointing into an unrelated clause). **Every predicate was unchanged**, so
no verdict moved — but a citation is an instrument and it rots silently. The `wrapper` row's cited
line does not contain its cited predicate at all (`run_arm_wrapper()` delegates to
`p0-authz-invoker-audit.sh`); its conclusion now rests on **measuring** `prosecdef` 233/233 rather
than on "by construction".

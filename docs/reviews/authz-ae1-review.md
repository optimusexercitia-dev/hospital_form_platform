# AE1 — QA review (§6 step 3): integrity and privilege hardening

**Branch:** `authz-ae1-hardening` · **Reviewed:** 2026-08-27 · `qa` · round 1
**Commit range:** `f99cdd5d..e9df56c7` (37 commits; `e9df56c7` landed during this review and is
included).
**Authority, in precedence order:** ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D9 + ADR
[0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) → the
[plan](../plans/authz-evolution.md) § Phase AE1, its `[PA-F#]` tags and **Gate AE1** →
[`docs/progress/authz-ae1.md`](../progress/authz-ae1.md) (the phase's live record).
**Method:** every schema / RLS / RPC / ACL claim below is measured against the **live local
catalog** (`pg_proc` incl. `prosecdef` and `proacl`, `pg_policy`/`pg_policies`, `pg_default_acl`,
`pg_constraint`, `pg_index`, `pg_trigger`, `pg_class.relacl`), never against migration text and
never against graphify (ADR 0078 methodology finding). Gate figures I rely on were re-derived on
this tree; the ones I re-ran are marked ✅ below.

---

# VERDICT: CHANGES REQUESTED

**Not because the security posture is wrong — everything I could measure about it is right.**
The RLS/ACL surface this phase touched is clean in every direction I probed: zero `TO public`
policies remain anywhere in the catalog, the `ALTER DEFAULT PRIVILEGES` change is effective in
both schemas under a live probe, the six person doors are `service_role`-only with explicit
non-NULL ACLs and their kernels are executable by no client role at all, the zero-policy tables
are denied at both the grant and the RLS layer, and the FKs and their supporting index are
exactly as ruled.

The verdict is **CHANGES REQUESTED** because **three Gate AE1 checklist items are not met as
written and nothing records a waiver**; because **five of the phase's own 16 keystone verdicts rest
on an instrument that cannot distinguish the two outcomes this phase spent the day learning to
distinguish**; and because **AE1.5's acceptance-evidence section presents a withdrawn migration's
measurement as the AFTER state of a landed one** — a table describing a database that has never
existed, which I confirmed against the live catalog.

| # | severity | finding | Gate AE1 / plan clause |
| --- | --- | --- | --- |
| **B1** | **BLOCKING** | The AE1.3 mutation audit cannot tell a RED from an ABORT — and the phase measured this exact predicate aborting | AE1.3 "Keystones **mutation-proven**" |
| **B2** | **BLOCKING** | "registry derivation clean" is **red at HEAD**: the deriver returns 40 sites against the registry's 45 | Gate AE1 "registry derivation clean" |
| **B3** | **BLOCKING** | The six new doors are in **no** ARM domain, and the mismatch with Gate AE1's wording is unrecorded | Gate AE1 "the nine new doors present in all ARM domains with recorded verdicts"; plan rule 4 |
| **B4** | **BLOCKING** | AE1.5's acceptance-evidence section presents a **withdrawn migration's** measurement as the AFTER state at head `…004710` | plan §AE1.5 step 3 "the before/after plan diff is the acceptance evidence" |
| **M1** | MAJOR | Close #3: "public command doors are **individually justified**" is not done **and is declared done** | plan §AE1.2 step 1 `[PA-F11]` |
| **M2** | MAJOR | `docs/backend-state.md` carries figures this phase itself falsified — including "all 233 revokes HELD under RV0", which RV0's own partition contradicts | plan §AE1.2 step 5; CLAUDE.md §7 |
| **M3** | MAJOR | 6 of 10 FUP obligations unfiled; a 7th is backlog-only with no index line; obligation #7's own claim is inaccurate | the phase record's own contract |
| **M4** | MAJOR | AE0.2's `EXPLAIN (ANALYZE, BUFFERS)` baselines were **not** re-run for the touched tables; 4 touched tables have no plan evidence and only 2 are disclosed | plan §AE1.5 step 3 |
| m1 | minor | pgTAP 382 is a hand list of 7 tables with no set-closure assertion | AE1.6 |
| m2 | minor | `check-memberships-door.mjs`'s new allowlist entry is **file**-scoped, not site-scoped | plan §AE1.4 step 2 |
| m3 | minor | PROGRESS.md § Now says "all four ARM arms **0**" with no domain qualifier | plan rule 2 |
| m4 | minor | Stale claims inside the phase's own live record and the registry's test column | §10 |
| m5 | minor | AE1.5's AFTER capture predates a later change to the **same policy** (`case_referral_delete_draft_source`) | plan §AE1.5 step 3 |
| m6 | minor | Two recorded revoke-partition cells do not match the catalog / the 233 | §10 |

**Nothing here is a live authorization hole.** B1–B4 are *verification-integrity*, *record-accuracy* and
*gate-completeness* defects: work that is probably correct but is asserted more strongly than the
instruments support. That is precisely the class this phase exists to close for AE4's differential
oracle, which is why they block rather than defer.

---

## 0. What I re-measured myself

| gate | lead's figure | mine | verdict |
| --- | --- | --- | ---: |
| `npm run test:db` | 237 files / 7,870 PASS, exit 0 | ✅ **237 / 7,870 PASS, exit 0** | matches |
| `npm run lint` (ten gates) | OK, exit 0 | ✅ **exit 0** (with the PROGRESS.md size warning: 89,651 B over the 81,920 B target) | matches |
| `npm run typecheck` | OK, exit 0 | ✅ **exit 0** | matches |
| Tier 1 population | 523 (432 DEFINER + 90 `public` INVOKER + 1 `graphql_public`) | ✅ **523**, exactly that split | matches |
| privilege budget | 752 = `public` 432 + `app` 320 | ✅ **752** | matches |
| `TO public` policies remaining | 0 | ✅ **0 catalog-wide**; all 278 `public` policies are `TO authenticated` | matches |
| ADP global form | `for role postgres … revoke execute on functions from public` | ✅ `pg_default_acl` carries `postgres \| (GLOBAL) \| f \| postgres=X/postgres`; live probe in a rolled-back txn: new functions in **both** `app` and `public` give `anon`/`authenticated` **false** | matches |
| FKs | both `ON DELETE CASCADE`, validated; one `user_id` index | ✅ confirmed, plus `appointed_by` correctly left un-indexed with no `ON DELETE` | matches |
| zero-policy tables | 7 | ✅ **7**, all with `relacl` = `postgres` + `service_role` only | matches |

**The "sweep verdicts still stand" argument holds, and I checked it rather than accepting it.**
`git diff --name-only 120478bf..HEAD -- supabase/` returns zero files (re-run at `e9df56c7`), and
the sweep's own scratch report
(`/tmp/authz-ae1-full-1787845761/authz-door-audit-findings.SUBSET.md`, mtime 13:43 on 2026-08-27)
declares `Baseline: Files=237, Tests=7870, Result: PASS` — **byte-identical to the suite shape I
just measured**. That is the missing half of the argument: not only did no migration or pgTAP file
move, the sweep's declared baseline is the current one. The 63-case verdicts stand.

⚠ I did **not** re-run any mutation harness, `db reset` or `e2e:prod`, per the review scope. So
nothing below is a re-measurement of the sweep, the ARM arms, or the E2E gate; where I dispute a
figure it is by reading the instrument, not by re-running it.

---

## 1. Gate AE1, item by item

> **Gate AE1:** full §6 gate; diff-scoped door sweep over every touched policy/gate; the nine new
> doors present in all ARM domains with recorded verdicts; registry derivation clean with zero
> `undecided` dispositions; the tiered DEFINER review complete with the budget's ceiling recorded;
> the default-privilege positive controls green; FK supporting indexes asserted; the six `TO
> public` process-template policies normalized or explicitly ruled; `e2e:prod` green against the
> named-flake baseline with fingerprints; QA review; PO approval; Record step.

| # | item | verdict |
| --- | --- | --- |
| 1 | full §6 gate | ✅ **MET** — re-verified `test:db`, `lint`, `typecheck` myself; the four ARM arms and `e2e:prod` accepted on the lead's record (and the `ARM=floor` stale-log incident is recorded honestly at `authz-ae1.md` § "A DAY-OLD LOG FILE…", with the re-run at 17:08) |
| 2 | diff-scoped door sweep over every touched policy/gate | ✅ **MET with a stated qualification** — 63 cases derived by `door-sweep-cases.sh f99cdd5d`, never by hand; SWEPT 41 · COVERED 40 · BLIND 0 · ERROR 1 (ruled, with the cause measured); write arm COVERED 13 · BLIND 0. The 9 unmeasured are **named individually**, the gate line is in words, and the derivation of the 43 is attributed to the worklist cross-check rather than the harness's own report. This is the item the phase handled best. |
| 3 | the nine new doors present in **all ARM domains** with recorded verdicts | ⛔ **NOT MET** — see **B3** |
| 4 | registry derivation clean, zero `undecided` | ⛔ **NOT MET** on "derivation clean" (**B2**); ✅ **MET** on "zero `undecided`" and on the 11 `.rpc()` sites being PO-ruled |
| 5 | tiered DEFINER review complete **with the budget's ceiling recorded** | ⚠ **MET WITH QUALIFICATION** on the review (**M1**); ✅ **MET** on the ceiling — `backend-state.md:502-503` states **CEILING: 752** and the merge rule, and I re-derived 752 |
| 6 | default-privilege positive controls green | ✅ **MET, and this is exemplary work** — see §3 |
| 7 | FK supporting indexes asserted | ✅ **MET** — see §4 |
| 8 | the `TO public` policies normalized or explicitly ruled | ✅ **MET, and exceeded** — 11 policies over 6 tables, not the finding's "six"; 0 remain catalog-wide |
| 9 | `e2e:prod` green against the named-flake baseline **with fingerprints** | ✅ **MET** — GATE GREEN, 1249/0/3/11, and the arithmetic gap in the summary line was checked (`1263/1263` on the final batch lines) rather than accepted. M1's fingerprint corrected from measurement, the third flake correctly **not** admitted to the baseline |
| 10 | QA review | this document |
| 11 | PO approval | pending |
| 12 | Record step (rotation + backend-state.md + budget line) | pending — and it carries **M2**, **M3**, and the PROGRESS.md size warning |

**Plan rule 2 (the domain qualifier).** The phase record **does** honour it — `authz-ae1.md:701-704`
and again in the new gate record, which additionally names a *second* uncovered population (Tier
2's 320 `app` DEFINERs, conditioned on `config.toml`'s exposed-schema line). That is better than
the rule asks for. **PROGRESS.md does not** — see **m3**.

---

## 2. The six close conditions

| # | condition | verdict |
| --- | --- | --- |
| 1 | 11 `.rpc()` sites ruled, zero `undecided`, R3 discharged | ✅ **MET.** All 11 ruled individually in [`authz-ae1-rpc-rulings.md`](../design/authz-ae1-rpc-rulings.md), PO-approved as-is; 45 registry rows, zero `undecided`; R2's HMAC deny test landed and is **not vacuous** (see §5). |
| 2 | ADP global `FOR ROLE` form with positive effective probes | ✅ **MET**, measured — §3 |
| 3 | tiered threat review | ⚠ **MET WITH QUALIFICATION** — §6, finding **M1** |
| 4 | FK supporting index | ✅ **MET**, measured — §4 |
| 5 | flake fingerprints, owner, expiry | ✅ **MET**, and the deliberately-OWED message-pattern half was then closed by the `e2e:prod` run the same day; M1's fingerprint corrected from the first observation rather than widened. ⚠ But see **M3**: `FUP-E2E-REPEAT-FLAKY`, this condition's entire subject, has **no index line of its own** in PROGRESS.md. |
| 6 | every `TO public` policy normalized | ✅ **MET, and exceeded** — §3 |

---

## 3. Security / RLS — measured

Everything in this section is a catalog measurement I took on the current stack.

**3.1 The `ALTER DEFAULT PRIVILEGES` change (close #2) — correct, and correctly *proven*.**
`pg_default_acl` carries the global row `defaclrole=postgres, defaclnamespace=0, objtype=f,
acl={postgres=X/postgres}`. I created a throwaway function in each of `app` and `public` inside a
rolled-back transaction:

| probe | `proacl` | `anon` EXECUTE | `authenticated` EXECUTE |
| --- | --- | :---: | :---: |
| `app._qa_probe()` | `postgres=X/postgres` | **false** | **false** |
| `public._qa_probe()` | `postgres=X/postgres,service_role=X/postgres` | **false** | **false** |

Both closed, and `proacl` is non-NULL in both — so the "NULL `proacl` includes PUBLIC" trap is
structurally out of reach for new objects. The phase's account of *why* the schema-scoped form
would have been a no-op (the `pg_default_acl` row "listing no PUBLIC" reading as closed while the
built-in default stayed open) is exactly right and is the reason this landed correct.

⭐ **The blast-radius handling deserves recording as a strength.** The change reded four pgTAP
files, one of which (`320`) was an ACL-population *vacuity control*. The cheapest green was to
change its expected count from 238 to 237 — which would have made a detector-vacuity control pass
by asserting the detector finds nothing. It was instead fixed by granting PUBLIC **explicitly**,
which makes the control stronger than before because it no longer borrows its subject from an
ambient default. That is the correct call and it was not the obvious one.

**3.2 `TO public` normalization (close #6) — 0 remaining, catalog-wide.**
`select … from pg_policy where polroles = '{0}'::oid[]` returns **zero rows** across all schemas.
All 278 `public`-schema policies are `TO authenticated`. The behaviour-preservation argument was
measured rather than assumed (`anon`/`authenticator` hold no grant; `postgres`/`service_role` are
`rolbypassrls`), and the finding that the family was **5/3 over 8 tables carrying 10 policies**,
not "six tables", plus the **eleventh** policy outside the named feature
(`case_referral.case_referral_delete_draft_source`, a DELETE policy on a **Rule 12 PHI** table) is
the right generalization: *a finding that names a feature bounds its own sweep to that feature; the
property does not stop at the feature edge.*

**3.3 The six person-authority doors — the ACL posture is right, and 386 pins it positively.**

| object | schema | `prosecdef` | returns | `proacl` | `authenticated` EXECUTE |
| --- | --- | :---: | --- | --- | :---: |
| the six `*_for` wrappers | `public` | **t** | `void` ×5, `uuid` ×1 | `postgres=X/postgres,service_role=X/postgres` | **false** |
| the six `*_impl` kernels | `app` | **t** | `void` ×5, `uuid` ×1 | `postgres=X/postgres` | **false** |
| `can_administer_person_for` | `app` | **t** | `boolean` (STABLE) | `postgres=X/postgres` | **false** |

No NULL `proacl` anywhere in the set; no client role can reach a kernel or the predicate directly.
pgTAP `386` asserts all of this **positively and with cardinality controls** (`1.1` exists to stop
`1.2`–`1.5` passing over an empty set), and its §3 anti-fix keystone — doors work under
`service_role` **and** a signed-in caller cannot self-elevate **and** no door is reachable by
`authenticated`, as three independent facts — is the right shape for a property whose obvious
"fix" (granting the doors to `authenticated`) would break `guard_profile_privileged_columns`.

**Authority before existence** is asserted and asserted correctly: pgTAP `385` §7.2 compares the
non-existent-person error to a genuine denial as **one byte-identical comparison**, not as two
assertions that happen to agree; §6.3 does the same for the credential-id oracle. The kernels
confirm it — `delete_credential_impl` folds `v_user is null` into the same `42501` raise as the
authority failure rather than branching. `384` §6.2 pins the property at the predicate level.
⚠ Coverage note: the `ghost` probe is used at exactly two sites, both `set_person_active_for`; the
other five doors inherit the property from the shared predicate rather than proving it themselves.
Acceptable, worth knowing.

**The door-SQLSTATE gate (ADR 0156) IS inherited** — this is the one arm of plan rule 4 the doors
do enter. `304` §6's kernel clause (`app` + `prosecdef` + `provolatile='v'` + executable by neither
`authenticated` nor `service_role` + called by a client-callable `public` function) reaches all six
kernels; §6.1 reds if any `app.*_impl` escapes the derivation; §6.6's declared literal was updated
with `HC0T6` and only `HC0T6`. The reasoning for **excluding** `HC0T7` (raised by a STABLE
predicate, therefore outside the kernel clause, therefore declaring it would fail §6.6 in the other
direction — keystoned in `384` §7 instead) is correct and is the kind of thing that is usually got
wrong.

**3.4 FK cascade behaviour (close #4) — correct, and the reasoning was corrected twice.**

```
commission_administrativos_commission_id_fkey  FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE   [validated]
commission_administrativos_user_id_fkey        FOREIGN KEY (user_id)       REFERENCES profiles(id)    ON DELETE CASCADE   [validated]
commission_administrativos_appointed_by_fkey   FOREIGN KEY (appointed_by)  REFERENCES profiles(id)                        [validated]
commission_administrativos_user_idx            btree (user_id)
commission_administrativos_pkey                UNIQUE btree (commission_id, user_id)
```

`guard_profile_no_delete_trg` is live (`tgenabled='O'`, BEFORE DELETE), so PA-F15's cascade premise
is indeed false for **both** referencing columns and for the third FK neither PA-F15 nor the
handoff counted. The index is warranted on the surviving evidence
(`commission_administrativos_select`'s `... OR (user_id = (SELECT auth.uid()))` arm), and `383`
§3.3 pins the delete guard **next to** the conclusion depending on it. Declining an
`appointed_by` index against the sibling convention, on measured access paths, is the right call.

**3.5 Zero-policy tables (AE1.6) — 7 tables, double-denied.**
All seven carry `relacl = {postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` — no
`authenticated` or `anon` entry at all, so the exact-ACL assertions are positive facts and not
inferences from a NULL. Three are Rule 12 Class-1 PHI tables and get §C's deepest coverage. §D's
live grant/revoke/policy-add/policy-drop walk on an ephemeral table is a real vacuity control. See
**m1** for the one gap.

---

## 4. B1 — BLOCKING: the AE1.3 mutation audit cannot distinguish a RED from an ABORT

**The requirement.** Plan §AE1.3: *"Keystones **mutation-proven**: neutralize the door's authority
check → **the test must go red**; assert the edit landed before trusting the rerun."* The phase
record asserts *"16 cases declared, 16 `KEYSTONE HOLDS`, FINDINGS: 0."*

**What the harness actually reads.** `supabase/tests/mutation/ae13-person-doors-mutation-audit.sh:58`:

```sh
run_test() { npx supabase test db "supabase/tests/$1" 2>&1 | grep -E '^Result:' | tr -d '\r'; }
```

`Files=` and `Tests=` are never captured, never baselined, never compared. Every verdict reduces to
`Result: PASS` vs `Result: FAIL` (`:84`).

**Why that is not sufficient here — and the phase measured it itself.**
`docs/progress/authz-ae1.md:678-681`, on the sweep ERROR:

> neutralizing the whole function to `select true` yielded `Files=236 Tests=7848` against the 7855
> baseline — **7 assertions stopped RUNNING**, a suite aborting rather than failing.

That function is `app.can_administer_person_for` — the object **cases 10–14 mutate**. `384` is a
static `plan(55)` and its §9 drives `pg_temp.vector_answer` over the mutated predicate, so a
mutation that makes the predicate raise inside that driver stops assertions running rather than
failing them — and a plan/ran mismatch still prints `Result: FAIL`. **So for 5 of the 16
"KEYSTONE HOLDS", `Result: FAIL` is ambiguous between "a keystone noticed the mutation" and "the
file stopped running", and the harness has thrown away the only bytes that would tell them apart.**

This is not a hypothetical class. It is the *third* instance of it in this phase's own record (a
gate harness exiting 0 over an empty set; `ARM=census` once printing `INVARIANT HOLDS` having
enumerated zero gates), and the sibling harness already solves it —
`p0-authz-writepath-audit.sh:580-582` captures `Files=/Tests=` and treats a shape drop as **ERROR,
not a result**.

**Four supporting gaps in the same harness:**

1. **No failing-assertion identity check.** Every case label names the assertion it claims to
   exercise (`-> 385 §1.3`, `-> 384 §9.4`) and none is verified. Case 14's own header at `:188`
   says the mutation *"must red NAMING S4 fields and S4 credentials — and **ONLY** the S4 rows"*.
   Nothing checks that. A mutation that reds a different assertion prints `KEYSTONE HOLDS`.
2. **G1 never asserts its mutation landed.** It is the only case of 16 missing the `h0 != h1`
   check (`:68-75`); it prints the before/after ACL (`:200-201`) and never compares them, and the
   `grant` at `:199` runs through `$Q` with its exit code discarded. If the grant silently failed,
   the case still reports a FINDING — but **misattributed as a keystone failure rather than an
   unapplied mutation**, which is the distinction every other case makes.
3. **No declared-vs-run reconciliation.** The number 16 appears nowhere in the script; `case_no`
   is display-only and G1/G2 do not increment it; no total is printed. Comment out a `one_case`
   line and the run exits 0 having measured 13.
4. **The FINAL STATE block is echo-only** (`:249-251`): three suite results and a
   baseline-hash comparison are printed and none contributes to `FINDINGS`. The harness can exit 0
   with all three files red in its own closing block.

**What would establish the claim.** Capture `Files=/Tests=` per run, baseline them, and treat a
shape drop as `ERROR` (the convention already in the sibling); re-run cases 10–14 and report the
shape alongside each verdict. Add a declared-case constant compared against `case_no` before the
exit line, and give G1 the landed-check the other 15 have. If cases 10–14 come back with the shape
intact, the claim is established and the fix is ~20 lines; if one of them is an abort, that case
never proved anything and the phase found a real gap.

⚠ **I am not claiming the doors are unprotected.** `385`/`386`/`384` are strong suites and eleven
of the sixteen cases target bodies that do not abort. The defect is the *strength of the claim*:
"16/16 mutation-proven" is asserted by an instrument that, on its own phase's measurement, cannot
support it for five of them.

---

## 5. B2 — BLOCKING: "registry derivation clean" is red at HEAD

**The requirement.** Gate AE1: *"registry derivation clean with zero `undecided` dispositions"*.
Plan §AE1.4 step 1: *"the registry is re-derived, and **a diff between derivation and registry is a
red**"*, and the registry is to be *"**machine-readable and diffed against the census script's
output by a check, not by hand**"*.

**Measured.** The registry (`docs/backend-state.md:517-693`) records **45 sites** —
12 from-verb · 19 rpc · 6 storage · 4 storage-sign · 4 auth-admin — *"re-derived 2026-08-27 at
commit `e7c26068` … exactly matching AE0.4 — no delta."* Re-running the deriver at HEAD
(`node scripts/service-role-dml-census.mjs`, read-only) returns:

```
IN_SCOPE=40   families: from-verb 3 · rpc 23 · storage 6 · storage-sign 4 · auth-admin 4
```

**AE1.3 landed after the registry's measurement** (`git diff --stat e7c26068..HEAD -- src` shows
`src/lib/users/actions.ts` +325/−134). Group A's nine raw-DML rows document writes that **no
longer exist** — I confirmed independently that every remaining `.from('profiles')` and
`.from('professional_credentials')` in `users/actions.ts` is a `.select()`, never DML. So by the
registry's own rule the derivation is **red right now**, and Gate AE1's item cannot be honestly
asserted at HEAD without a re-derivation.

**And nothing turns that into a failure**, because the mandated check does not exist. `package.json`'s
ten lint gates do not include it; nothing invokes `scripts/service-role-dml-census.mjs`; no pgTAP
suite reads the registry. The record says so itself at `backend-state.md:539-541` (*"no automated CI
gate performing that diff as of AE1.4 — the comparison is manual today"*) and calls the
`check-memberships-door.mjs` extension the substitute — but the plan itself says that gate is *"a
tripwire for the two conversions regressing"*, **not** the registry's closing instrument.

**A second-order consequence worth naming now, while it is cheap.** `callDoor` renders the six
doors to the census as `rpc('<dynamic:fn>')`, collapsing four of them into one site. So the moment
an automated diff *is* built, it will be structurally unable to see the six doors by name. That is
a coverage loss created by this phase's own type seam, and it is not recorded anywhere.

**What would establish the claim.** Re-derive at HEAD and update the registry's 45 rows and family
totals in the same edit as the Record step, with the delta stated; and either build the mandated
diff check or record a PO ruling that it is deferred, with the deferral filed as a register entry
rather than as a sentence in `backend-state.md`. The `<dynamic:fn>` blindness needs either a
census-side fix or a named FUP.

**Not in dispute:** zero `undecided` (I confirmed — every `UNDECIDED` occurrence in the section is
vocabulary, a heading, or history), all 11 `.rpc()` sites individually ruled and PO-approved, and
`ENFORCE_PERSON_AUTHORITY_DOORS = true` with `profiles` + `professional_credentials` in
`GATED_TABLES` and the gate green.

---

## 6. B3 — BLOCKING: the six doors are in no ARM domain, and nothing records that

**The requirement.** Gate AE1: *"the nine new doors present in **all ARM domains** with recorded
verdicts"*. Plan rule 4: *"**Every new door inherits every sibling arm** in the same increment it
lands — census domain, hat, floor allowlist ruling, wrapper, door-SQLSTATE gate. **A door absent
from the findings passes `ARM=wrapper` vacuously.**"*

**Measured.** All twelve door/kernel functions return `void` or `uuid`, are `prosecdef = t`, and
hold **no `authenticated` EXECUTE** (`service_role` only). Against the arms' own domain predicates
(`p0-authz-invariant.sh:387-390, :403-406, :364-365`):

| arm | domain | the six doors |
| --- | --- | --- |
| `ARM=census` | `prosecdef` **bool**, or `prosecdef` set-returning **and** `authenticated`-reachable, or `public` INVOKER plpgsql `authenticated`-reachable, or any RLS policy | **out** — scalar non-bool, and not `authenticated`-reachable |
| `ARM=floor` | `authenticated`-reachable `prosecdef` doors with 0 calls | **out** — not `authenticated`-reachable |
| `ARM=wrapper` | `prosecdef = f` | **out** — they are `prosecdef = t` |
| `ARM=hat` | doors reading `memberships` without the caller's hat | not reported for any of them |
| door-SQLSTATE gate | structural (ADR 0156 D1) | ✅ **in** — the one arm they do inherit |

`grep` of `docs/reviews/authz-door-audit-findings.md` for the six door names returns **0 hits**.
Only `app.can_administer_person_for` appears, once — and its verdict is an **ERROR**, ruled.

So: **zero of the six doors carries a verdict in any arm**, and Gate AE1 item 3 is not met on its
own wording. They are not even inside C2's 407 (that population is `authenticated`-reachable), so
they occupy a *third* category — service-role-only command doors — for which the phase record has
no line at all.

⚠ **This is a recording defect, not a security defect.** Being `service_role`-only is *stronger*
than being `authenticated`-reachable, and the doors are covered instead by pgTAP 385/386, the
door-SQLSTATE gate, and the 16-case mutation audit (subject to **B1**). The problem is that a
checklist item reading "present in all ARM domains with recorded verdicts" was marked as part of a
phase that closed without them, and the exact sentence plan rule 4 warns about — *a door absent
from the findings passes `ARM=wrapper` vacuously* — is true of six new doors with nothing in the
repo able to say so.

**What would establish it.** Either a recorded ruling that Gate AE1 item 3 is structurally
unmeetable for `service_role`-only command doors, naming the compensating controls and the third
category (and, ideally, giving that category a standing home the way C2 has one); or the doors
enter a domain. The one thing that must not happen is the item being carried into the Record step
as met.

---

## 6a. B4 — BLOCKING: AE1.5's acceptance evidence contains a withdrawn migration's measurement

**The requirement.** Plan §AE1.5 step 3: *"re-runs AE0.2's EXPLAIN baselines for the touched tables
— **the before/after plan diff is the acceptance evidence**, not the advisor's warning count."*

**What §6.2 of `docs/design/authz-ae1-initplan-triage.md` says.** The section is headed
*"### 6.2 AFTER … Captured in the reset window, head `20261003004710`"* (`:515-517`). Under it,
at `:544-553`, sits a table headed **"The `profiles` arm removal — the plan got simpler, and the
runtime did not move"**:

| `hospital_admin` arm (AE0.2 P5b) | BEFORE | AFTER |
| --- | ---: | ---: |
| top-level filter arms | 11 | **7** |
| SubPlans in the plan | 9 | **5** |
| cost estimate | 3644.73 | **1919.65** |
| buffers | 652 | **650** |

**That table is byte-identical to §4.3's** (`:330-337`), whose columns are headed *"with duplicates
| with them removed"* and which measures migration `20261003004700` — the migration §4 states was
*"written, applied, measured, and **deleted**. It is not in the tree."* (`:267`), *"**withdrawn**
2026-08-27, PO-ruled, on the author's own recommendation"* (`:271`).

**I measured the live catalog.** `profiles_admin_select`'s `qual` is 771 characters and still opens
`app.is_admin() OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(...)) OR EXISTS(...)
OR EXISTS(...)` — **the arms were never removed**. The "AFTER" column describes a database state
that has not existed at head `…004710` or at any later head. What AE1.5 actually shipped on
`profiles` is a single `( select auth.uid() )` wrap inside `profiles_update_self`.

**Why this blocks.** §6.2 is the acceptance-evidence section for AE1.5, and this is its only
`ANALYZE/BUFFERS`-grade measurement. A reader taking §6.2 at its heading concludes that AE1.5
simplified `profiles_admin_select` from 11 arms to 7 and halved its cost estimate. It did neither.
The phase's own standing lesson applies exactly — *a correct source does not make a correct
derivation*; here a correct measurement was carried into a section whose heading changes what it
claims. And because §4 is honest about the withdrawal, the two sections **contradict each other**
inside one document, with nothing able to notice.

**What would establish it.** Delete the table from §6.2 or re-head it explicitly as *"§4.3's
withdrawn-migration measurement, repeated for context — NOT the AFTER state"*, and, if `profiles`
is to keep an AFTER row at all, capture the real one at head `…005300`.

---

## 6b. M4 — MAJOR: the mandated EXPLAIN evidence was not the evidence produced

Plan §AE1.5 step 3 requires re-running **AE0.2's** baselines, and AE0.2 is defined
(`authz-evolution.md:99`) as `EXPLAIN (ANALYZE, BUFFERS)`, three repetitions. What AE1.5 produced:

- §6.3's 29-table diff is `explain (costs off)` — deliberate, to remove cost noise, and reasonable
  as a *shape* diff. But it means **no cost, buffer, or seq→index evidence exists for 28 of the 29
  tables**. The only `ANALYZE/BUFFERS` numbers in the document are `profiles`', and those are B4's.
- §6.2's two headline metrics are (i) inlined `current_setting` expansions 39 → 0 — a plan-text
  count, genuine and useful — and (ii) **advisor-flagged policies 113 → 61**, which is precisely
  the *"advisor's warning count"* the plan names as **not** the acceptance evidence.
- One genuine per-table InitPlan → per-row fragment is quoted, for `case_decisions` only.

**And the "no read plan to diff" carve-out is under-scoped.** §6.3 `:601-607` names only the
`with_check`-only INSERT class. Measured against the catalog, **four** of the 29 touched tables have
no *edited SELECT policy* at all, so no read plan can show the change:

| table | what `…004710` edited | disclosed by §6.3? |
| --- | --- | :---: |
| `meeting_signatures` | INSERT (`with_check`) | ✅ |
| `response_section_signoffs` | INSERT (`with_check`) | ✅ |
| **`meeting_cases`** | DELETE/INSERT/UPDATE `_staff_admin_*` — a `USING` wrap, not `with_check`-only | ⛔ **no** |
| **`profiles`** | `profiles_update_self` UPDATE `USING` + `WITH CHECK` | ⛔ **no** |

So the table §6.2 spends its whole length on has **zero plan evidence for the wrap AE1.5 actually
shipped there** — which is the same gap B4 fills with the wrong measurement.

⭐ **Two things AE1.5 got right and should not be lost in this finding.** The semantic-validity
rule is enforced *structurally* rather than by judgement — only the `Var`-free argument of
`app.can_*(<row column>, auth.uid())` is wrapped, never the outer row-dependent call, and I verified
mechanically that the 52 statements contain **77 × `( select auth.uid() )` and no other `( select`
construct**: zero row-dependent wraps. And §6.2.1 records that the *first* AFTER capture was a
self-erasing instrument whose selector keyed on the defect being fixed, so `diff <full> <empty>`
read as a clean sweep — caught by its author.

Plan step 2 (consolidation) is **correctly declined**, twice, with reasons: the `profiles` arm
consolidation was built, measured, found to have no benefit (the three duplicate SubPlans read
`never executed`) and **withdrawn** — and the 26-table `ALL`-policy class was escalated to a PO
ruling and filed as `FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY` rather than decided in-phase. Both
are the right calls.

---

## 7. M1 — MAJOR: close condition #3's "individually justified" clause

**The instrument is real and the phase's honest failure mode was avoided.** This is not a shallow
pass. The closure-grain correction (per body, the arbitrary-principal column reads 27 findings that
are all two-line delegators; over the call closure it reads zero) is genuine and would not have
been found by a hand pass. The two edge instruments differing by 4 edges with no row changing
bucket is a real differential. The `m[0]` probe bug (`regexp_matches` returns captures at index 1)
and the pt-BR-literal false positives are exactly the self-catches this repo values, and F-T1-1's
correction of Tier 1 from 432 to 523 is **measured correct — I re-derived it independently: 432
DEFINER + 90 `public` INVOKER + `graphql_public.graphql` = 523.**

**But one plan clause is unmet and is declared met.** The plan says *"Public command doors are
**individually justified**"* (`authz-evolution.md:160`). The instrument has no notion of a command
door — `grep "command door" scripts/authz-tier1-threat-review-ae1.sql` returns zero. What the
review substitutes, at `authz-ae1-tier1-threat-review.md:276-277`, is:

> **The 407 reachable command doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2)** remain outside every
> ARM arm's domain. This review characterizes them; it does not sweep them.

Two problems in one sentence. *"Characterizes them"* is unsupported — command doors are never
isolated as a population anywhere in the doc or the script, only dissolved into the 523 with
everything else, and characterizing a superset is not characterizing the set. And **407 is from a
different population than the one the sentence bounds**: it is C2's `public` + `app` figure, while
the classification's `public` command-door count is **384** (§6.1: 372 + 12 multi-class) and
neither has been re-derived over the corrected 523. This is the one sentence in the document whose
job is to state the review's domain, and it over-claims in the first half and mis-cites in the
second.

**Four more, each smaller, all the same family — a figure whose population is not the one it names:**

- **Two of the ten columns are partly absent and not declared absent.** C7's *"qualified
  references"* clause is never attempted (only pinning and `execute`/`format`); C6 computes two
  integers and no *reach* (which argument combinations a PostgREST caller can invoke; whether a
  defaulted argument lets a caller omit a scoping parameter), and is scoped to `t1` so an overload
  pair split across the Tier-1 boundary is invisible to its "0 overloaded names".
- **"325 decided mechanically" means "tripped none of six predicates"** — an absence of flags, not
  a positive certification over ten columns. C1, C2, C4 and C6 contribute no residue bucket at all,
  so they are "decided" for all 523 rows by construction. C9 (audit emission) filters to DEFINER
  mutators, which excludes the 90 `public` INVOKER functions F-T1-1 was added to catch — including
  named mutators like `publish_form_version` and `submit_response`. Rule 11 asks the question of
  *every* mutation.
- **Three printed arithmetics do not close**, in a script whose own contract says *"Every bucket is
  a PARTITION whose parts sum to the population; the arithmetic is printed, never asserted in
  prose"*: §4.1's table sums to 60 against a stated bucket of 58; the C7 residue cell reads 2 where
  the instrument's C7 bucket holds 5; the C5 cell sums to 520 of 523.
- **The C8 zero rests on an uncomputed figure.** *"41 of 47 carry an authority-helper call in the
  body"* has no block behind it — no SQL intersects the C8 bucket with any gate signal.
- ⭐ **And the document's own best lesson is applied to the wrong block.** §5 establishes that the
  comment-strip does not strip **string literals** and that this codebase's literals are pt-BR
  prose — then applies it to BLOCK 5 (the dynamic-SQL detector) and not to BLOCK 3 (the call-closure
  edge builder), which reads the same `prosrc` column. There a phantom edge *manufactures* an
  identity binding, i.e. the unsafe direction. BLOCK 3's schema pattern also lacks a left word
  boundary (`(app|public)\.` matches inside `v_app.foo(`) where the sibling `sig` regex uses `\y`,
  and joins on `proname` with arity ignored. The two-instrument agreement test measures
  qualified-vs-bare divergence only; it does not test the phantom-literal mode at all, yet the doc
  generalizes to *"The over-join concern is a measured non-issue, not a caveat."*
- §7 ("What this review does NOT cover — stated, not implied") is genuinely good and satisfies plan
  rule 2's letter, but omits its own instrument's domain: the closure depth bound of 8, the
  closure's restriction to three schemas, the unstripped literals, C4's reliance on a
  parameter-*name* regex (so "52 take one" is a floor and the zero is conditioned on it), and that
  C2's exposure test is `rettype <> 'trigger'` against a hand-typed schema literal.

**What would establish it.** Either enumerate and justify the `public` command doors (deriving the
set as a property, never a hand list, and re-deriving the count over the corrected 523), or take a
PO ruling narrowing close #3 to exclude that clause — recorded as a narrowing, not as completion.
Then correct the 407, and add the missing domain sentences to §7. The three arithmetics and the
uncomputed 41 should be re-derived from blocks rather than restated.

---

## 8. M2 — MAJOR: `docs/backend-state.md` carries figures this phase falsified

CLAUDE.md §7 names this file as *"the durable backend-surface map — reference it instead of
re-deriving the backend each phase"*. It currently carries, measured by me on this stack:

| line | says | measured | note |
| --- | --- | --- | --- |
| `:498` | Tier 1 — **remotely reachable** = **432** | **523** | **This is F-T1-1's exact defect, uncorrected here.** The plan was fixed (`:170` "Tier 1 is 523"); the durable map was not. A reader referencing it instead of re-deriving inherits the falsified figure under the correct label. |
| `:496` | DEFINER functions in `app` + `public` = **843**, "quote 843, never the audit's 842" | **856** (`public` 460 + `app` 396) | Drifted by exactly the 13 AE1.3 objects. The file's own note says re-derive at Record — but the row simultaneously instructs the reader to *quote* it. |
| `:497` | budget **752** = `public` 432 + `app` 320 | ✅ **752**, same split | correct — the prediction that the new doors stay out of the `authenticated` population **holds**, and I confirmed it |
| `:446` | pgTAP 382 is `plan(68)`, PASS | `plan(71)` | close #6 added §5 |
| `:630`, `:631` | two registry cells: "route half **NONE** until the R2 FUP lands" | R2 landed and passes | under-reports coverage |

Also `docs/progress/authz-ae1.md` itself has two stale gate-obligation bullets: `:726` still says
`ENFORCE_PERSON_AUTHORITY_DOORS` is **`false`** (it is `true`, `check-memberships-door.mjs:61`), and
`:743-748` still lists the 11 TS2322 errors as outstanding (typecheck is green — I re-ran it, exit
0; the R7 `callDoor` seam is the recorded resolution).

**And one more, which is not a stale figure but a wrong one.** `backend-state.md:500` reads:

> `| proposed revoke set | **233** | ⛔ **all HELD** under RV0; AE1 executes none |`

and `:513-515` repeats it: *"The count falls only by a revoke, and **every revoke is currently
HELD**."* **RV0's own partition says otherwise**: 44 PROCEED (property-rescued) + 5 PROCEED
(name-rescued) + **23 HOLD** + 161 UNCHANGED. RV0 held **23**, not 233. Tracing the authority chain,
the only rulings that hold anything are RV1 (batch 4, **4** functions) and RV2
(`set_participant_patient`, **1**) — five in total; RV3's five were never in the 233. The accurate
sentence is *"none executed"*, which is a **scheduling** fact, not an RV0 verdict.

This matters beyond wording: the privilege budget's ceiling argument at `:511-515` rests on "every
revoke is currently HELD", and a reader of the budget line will conclude RV0 blocked the whole set
when it cleared 49 of them. It also flattens the distinction §1 of the partition doc spends its
length building — and that doc is otherwise exemplary here: it refuses the "UNCHANGED ⇒ fine"
inference **four times**, in four registers, and the refusal is carried verbatim into
`FUP-AE1-REVOKE-SET-EXECUTION`'s body along with the pre-batch protocol ("assert
`has_function_privilege` **moved** after each batch; an unmoved predicate is a failure, not
idempotence").

**M2 is MAJOR rather than minor for two reasons:** `:498` is not a re-derivation lag — it is a
*definition* error the phase found, corrected in the plan, wrote a finding about, and left standing
in the one file every future session is told to read instead of measuring. And `:500`/`:513` state
a verdict the cited partition contradicts, in the row that governs the next phase's revoke work.

---

## 9. M3 — MAJOR: the FUP obligations table, which exists because of exactly this

The table's own header (`authz-ae1.md:708-709`): *"⚠ **A gate-record sentence is not a register
entry.** Each of these needs an index line in PROGRESS.md **and** a body in `follow-ups.md`."*
These are due at the **Record step**, which follows this review — so this is a **pre-approval
condition**, not a failed gate step. I am recording it now because the table exists precisely
because AFF4's Record step left this residue unfiled.

| # | claimed | measured |
| --- | --- | --- |
| 1 | ✅ FILED | ✅ `FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY` — PROGRESS.md:358 + follow-ups.md:6420 |
| 2 | owed | ⛔ **UNFILED** — RV4's 11 unreachable `public` doors live only at `authz-definer-classification-ae1.md:1357` |
| 3 | owed | ⚠ **BACKLOG-ONLY** — `FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS` exists at `deferred-backlog.md:7` with **no PROGRESS.md index line**. The progress contract calls that invisible work |
| 4 | owed | ⛔ **UNFILED** — the "26 of 45 with no guard-vanish test" finding has no register entry |
| 5 | owed | ✅ **FILED** — `FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED`, PROGRESS.md:357 + follow-ups.md:6504 |
| 6 | owed | ⛔ **UNFILED** — the `reactivateUser` deny arm; zero hits repo-wide in the register files |
| 7 | ✅ "3 FUPs **filed same day, index + body**" | ⚠ **2 of 3.** `FUP-DOC-RECLASS-OPERATION-ID` and `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT` are correctly filed. `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` has **no live index line and no body** — it is in `follow-ups-archive.md:6976` as RESOLVED. Defensible (filed and closed the same day), but the row's claim is not verifiable from the live register |
| 8 | "if deferred" | ✅ **NOT OWED — discharged by delivery.** R4's shared vectors landed: `src/lib/users/__fixtures__/person-scope-vectors.json` → `scripts/gen-person-scope-vectors.mjs` → `supabase/tests/vectors/person_scope_vectors.psql`, drift-blocked by a `sourceSha256` over the JSON's exact bytes, consumed by pgTAP 384 §9 and `person-scope-vectors.test.ts`. **The table should say so** — a conditional obligation left ambiguous reads as unfiled |
| 9 | owed | ⛔ **UNFILED** — the wrapper-delegation blind spot. I confirmed the underlying fact: **neither `385` nor `386` pins any wrapper body** (no `prosrc`, no `md5`, no `pg_get_functiondef` in either file), and **no mutation case mutates a wrapper**. A wrapper that stopped delegating and reimplemented equivalent behaviour, or grew its own duplicate check, is invisible to everything |
| 10 | owed | ⛔ **UNFILED**, and it *looks* filed: `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` shares the number **53** but its four parts are different findings. The deriver-spans-untracked-migrations finding is in none of them |

Separately: **`FUP-E2E-REPEAT-FLAKY` — close condition #5's entire subject — has a body
(follow-ups.md:3036) and a backlog line, but no index line of its own in PROGRESS.md.** Its only
appearance there is a cross-reference inside another FUP's line. And two ids cited in the phase
record, `FUP-DOOR-SWEEP-DERIVER-POINTS-AT-ONE-ARM` and
`FUP-WRITEPATH-AUDIT-EXITS-CLEAN-HAVING-MEASURED-NOTHING`, **do not exist** — they were folded into
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` as parts 1 and 2, so any citation of them as separate filed
FUPs is dangling.

---

## 10. Minor findings

**m1 — pgTAP 382 is a hand list with no set-closure assertion.** The file pins seven named tables.
Nothing asserts that the *derived* set (`relrowsecurity` and zero `pg_policy` rows in `public`)
**equals** those seven. Today it does — I measured it. But AE1.6's stated property is *"an
accidental future policy or grant reds a test instead of silently widening"*, and an **eighth**
zero-policy table enters silently. This is the "hand list wearing a label" shape ADR 0156 was
written about, in a section that calls itself *"a standing registry … it never concludes, it is
re-derived"* while nothing re-derives it. One assertion fixes it: `string_agg` of the derived set
compared against the declared seven.

**m2 — the new allowlist entry is file-scoped, not site-scoped.**
`scripts/check-memberships-door.mjs:218` is `if (ALLOWLIST.has(rel)) continue` — it skips the whole
file. So any future raw `profiles` / `professional_credentials` DML anywhere in
`src/lib/auth/actions.ts` passes silently. The script's own comment at `:152-154` argues against
exactly this (*"allowlisting the file would grant it blanket permission for REAL raw DML, which is
strictly more than the problem asks for"*) and then does it. The plan asked for *"a **named
allowlist entry for the self-scoped `must_change_password` site**"* — a site, not a file. The
entry's closing sentence is also stale: it says the exemption is *"inert … today"* because the flag
is false; the flag is now `true`, so it is live.

**m3 — PROGRESS.md § Now carries "all four ARM arms **0**" with no domain qualifier** (line 85).
Plan rule 2 says the claim *"never appears without its domain qualifier"*. C2's entries are ~250
lines away in a different section. `authz-ae1.md` honours the rule; the register the PO reads does
not. (PROGRESS.md line 85 also says vitest **144/1,964** where the measured figure is **145/1,974**.)

**m4 — four stale claims inside the phase's own artefacts**, listed under M2 and M3 above
(`ENFORCE_PERSON_AUTHORITY_DOORS`, the 11 TS2322 errors, the two registry test cells, the "26 of 45"
figure). On the last: the registry's rows give **24** (20 no-test + 4 UNCONFIRMED), and its own
33-site sub-split is off by 2 in the other direction — the headline number cannot be reproduced from
the table it summarizes. The direction is conservative (it over-states the gap), but it is a hand
count presented as measured.

**m5 — the "does the AFTER capture stay representative at `…005300`?" question is answerable, and
the answer is one policy.** Measured: `20261003005200` alters `case_referral_delete_draft_source` on
`case_referral` — and `case_referral` is one of AE1.5's 29 captured tables, with
`case_referral_delete_draft_source` one of the 52 policies `…004710` wrapped. So the overlap is not
merely table-level; it is **the same policy**. Two facts bound the risk: `ALTER POLICY … TO
authenticated` cannot change `qual`, and it is a DELETE policy, so it was in the no-read-plan class
anyway (M4). I therefore expect no plan-shape movement — but that is an inference, and plan §AE1.5
step 3 makes the plan diff *"the acceptance evidence"*. Recording that sentence closes the open
question; the other 28 tables are untouched by `…005200`/`…005300`.

**m6 — two revoke-partition cells do not match what they cite.** (i)
`authz-ae1-revoke-partition.md:770` records `app.case_phase_option_aggregates` as returning `SETOF
record`; the catalog says `TABLE(total_score numeric, flagged_options integer)`. `proretset = t`
either way, so the HOLD verdict is unaffected — but a recorded catalog cell should be what the
catalog says. (ii) `:984` — the *effective probe* that upgraded the 137-no-op finding from
ACL-reading grade to measurement was run on `app.can_read_event_patient`, which the classification
marks `EXECUTE needed = y` and which is therefore **not a member of the 233**. The mechanism
generalizes and the positive control is real, so the finding stands; but the one executed
demonstration was on a non-member, and the doc does not say so. ✅ Against that, I re-checked the
load-bearing claim myself and it holds: all 23 HOLD rows carry a **direct** `authenticated` grant
and **no** PUBLIC grant, so the revoke is fully effective on exactly the rows the HOLD verdict is
about.

---

## 11. Code quality, UX, a11y, hygiene

- **TypeScript `strict` / `any`** — clean. The R7 ruling (`src/lib/types/rpc-args.ts`) is the right
  call and is well argued: neither `?? undefined` at call sites (correct at 8 of 11, ships a
  PGRST202 at the other 3) nor adding `DEFAULT NULL` to `p_professional_category_id` (which would
  make an edit form that omits the field silently null the category — the exact hazard the `p_set_*`
  tri-state exists to prevent). Fixing it once at the type seam keeps `database.ts` generated
  (Rule 8). The three controls proving the widened type can still fail — `TS2561` on a misspelled
  argument, `TS2322` on a wrong value type, **`TS2345` on omitting a required no-default argument**
  — are the right three, and the note that the *first* attempt at them printed nothing because a
  shifted import made every `sed` address miss is exactly the "assert the edit landed" lesson
  applied to itself.
- **Data access / Rule 9** — the conversions are complete. Every surviving `.from('profiles')` and
  `.from('professional_credentials')` in `users/actions.ts` is a `.select()`; all writes go through
  the doors. `lint:memberships-door` enforces it with the flag on.
- **The `blankComments()` fix to `check-memberships-door.mjs`** is correct and correctly re-proven
  rather than merely re-run: a gate whose matcher just changed needs positive controls, the failure
  mode of the edit is *silence*, and the string-awareness (so a `//` inside a `https://` literal
  does not blank the rest of the line and silence a finding) is the non-obvious half.
- **The HMAC deny test** (`route.rpc-boundary.test.ts`) is genuinely non-vacuous: the handler is
  real and the stub sits one layer lower at `createAdminClient`, so the subject is the service-role
  `rpc` spy; six deny arms each assert `rpc` **not called** *and* 401; a positive control asserts a
  well-signed callback produces exactly `['complete_minutes_job']`; a placement assertion pins that
  the refusal happens at the signature check and not downstream at the flag gate; and an explicit
  anti-vacuity guard states what would make the call count 0. R2 is discharged.
- **pt-BR / raw errors** — the doors raise pt-BR messages (`'sem permissão'`, `'ator não
  identificado'`, `'registro profissional não encontrado para esta pessoa'`) with authored
  SQLSTATEs in the `HC0*` family; no P-class raises. No UI change in this phase.
- **ADR hygiene** — ✅. 0161 declares `**Amends:** 0133`, 0162 declares `**Amends:** 0155`; the
  generated index carries both inverse edges (0133 "amended by 0147, 0148, 0161"; 0155 "amended by
  0160, 0162") and `lint:adr-index` is green (160 ADRs, next free 0163). Both non-trivial decisions
  this phase made — retiring 0133 D4's no-twin prohibition, and the plan-audit corrections — have
  ADRs. The R7 type-seam ruling is recorded in the phase record rather than an ADR; defensible at
  its size.
- **Secrets** — nothing added; no service-role key reachable client-side (the six doors are
  `service_role`-only *by ACL*, called from server actions).
- **PROGRESS.md size** — 89,651 B against the 81,920 B target, 12,749 B of headroom. `lint:progress`
  warns. Rotation is a Record-step obligation the phase already flags.

---

## 12. What this phase did unusually well

Recorded because a CHANGES REQUESTED verdict otherwise buries it, and because several of these are
the reason the findings above are *findable*:

1. **Close #2's effective probe.** `pg_default_acl` "listing no PUBLIC" reads as closed. Probing the
   effective state instead — a throwaway function per schema, the leading `=X/` with an empty
   grantee identified as the surviving PUBLIC grant — is the difference between a correct migration
   and a recorded no-op. Fifth sighting of that class on this project, and the first caught before
   it shipped.
2. **The 320 vacuity control was strengthened, not silenced.** The one-character green was available
   and refused.
3. **Close #6 swept by the property, not by the finding's own feature boundary** — which is how the
   eleventh policy, a DELETE on a Rule 12 PHI table, was found.
4. **The 9 unmeasured sweep cases are named individually and gain no rows** — "a findings file with
   no row for a case is the honest representation of 'not measured'".
5. **The stale-baseline catch.** AE1.5's "43 measured verdicts, ready to merge" were earned before
   the normalizing reset, and the monotonicity argument that *would* have rescued them was correctly
   identified as rescuing COVERED only, then not used.
6. **The `ARM=floor` stale-log incident** — a byte-identical day-old log read as this run's verdict,
   caught only because the exit code disagreed — is recorded with its generalization, in the commit
   that would otherwise have quietly benefited from it.
7. **The shared TS↔SQL vectors are hash-guarded in four directions**, with the reason a generator was
   chosen over a runtime read (pgTAP runs inside the container; the host path is not the container
   path; the failure mode is a test that silently reads nothing) written down.
8. **The PA-F15 correction** — the handoff reached the right column through a false premise, and
   pgTAP 383 §3.3 now pins the delete guard *next to* the conclusion that depends on it, so the
   premise cannot go stale silently.

---

## 13. Summary of required changes

**Blocking (must be resolved or PO-ruled before Record):**

- **B1** — capture `Files=/Tests=` in `ae13-person-doors-mutation-audit.sh`, treat a shape drop as
  `ERROR` (sibling convention at `p0-authz-writepath-audit.sh:580-582`), and re-run **cases 10–14**;
  add a declared-case reconciliation and G1's missing landed-check.
- **B2** — re-derive the service-role registry at HEAD (deriver returns 40 vs the recorded 45) and
  update it in the same edit; either build the mandated derivation-vs-registry check or file the
  deferral as a register entry; file or fix `callDoor`'s `<dynamic:fn>` census blindness.
- **B3** — record a ruling reconciling Gate AE1 item 3 with the measured fact that the six doors sit
  in no ARM domain, naming the compensating controls and the third (service-role-only command door)
  category. Do not carry the item into Record as met.
- **B4** — remove or re-head the withdrawn-migration table in `authz-ae1-initplan-triage.md`
  §6.2 (`:544-553`); if `profiles` keeps an AFTER row, measure the real one.

**Major (fix at Record, or rule explicitly):**

- **M1** — the "individually justified public command doors" clause: do it, or record the narrowing.
  Correct the 407. Add the omitted instrument-domain sentences to §7 and re-derive the three
  arithmetics and the uncomputed 41.
- **M2** — correct `backend-state.md:498` (Tier 1 = 523, not 432), `:496` (856), `:500` and `:513`
  ("all HELD under RV0" → RV0 held **23**; the rest is *not executed*), `:446` (`plan(71)`),
  `:630-631`; and `authz-ae1.md:726` and `:743-748`.
- **M3** — file obligations 2, 4, 6, 9, 10 as register entries (index + body); give obligation 3 a
  PROGRESS.md index line; mark 8 discharged-by-delivery; correct 7's claim; give
  `FUP-E2E-REPEAT-FLAKY` an index line of its own; remove or repoint the two dangling FUP ids.
- **M4** — either re-run the `ANALYZE/BUFFERS` baselines for the touched tables, or record that the
  `costs off` shape diff is the substituted evidence and why, and drop the advisor count from the
  headline; extend §6.3's carve-out to the `USING`-on-a-non-SELECT-command class (`meeting_cases`,
  `profiles`).

**Minor (Record-step hygiene):** m1 (382 closure assertion), m2 (site-scoped allowlist), m3 (domain
qualifier + vitest figure in PROGRESS.md), m4 (stale claims), m5 (record the `case_referral`
sentence), m6 (two partition cells).

---

**Re-review scope on resubmission:** B1's re-run output for cases 10–14 with shapes; the re-derived
registry and its delta; the B3 ruling; and a diff of `backend-state.md`. I do not need the full gate
re-run — no migration, policy or pgTAP file needs to move for any of the above, and if none does,
§0's measurements and the 63-case sweep verdicts carry forward unchanged.

---
---

# ROUND 2 — re-review, 2026-08-27

**Commit range:** `e9df56c7..HEAD` (7 commits, round-1 review commit included), **plus one
uncommitted working-tree edit to `docs/plans/authz-evolution.md`** (the B3 ruling), reviewed as it
stands and flagged as uncommitted below. Round 1's text above is left untouched, its errors
included — three of them are adjudicated in §R2.2.

**My round-1 re-review scope carried a premise that broke, and honestly.** §13 said no pgTAP file
needs to move; closing my own m1 required exactly that (`382` gained §A0, suite 7,870 → 7,871). So
the shortcut I offered was not available, and I re-ran what the premise was standing in for:
`test:db` on this tree is **237 files / 7,871 PASS, exit 0** (re-measured myself, exit captured
directly). No migration and no policy moved — `git diff --name-only 120478bf..HEAD --
supabase/migrations` is empty, re-verified, and `docs/reviews/authz-door-audit-findings.md` is
byte-clean against HEAD. The 63-case sweep verdicts were earned against their own captured
baseline (7,870) in one contiguous run; the phase record correctly states the next sweep
re-baselines at 7,871 and never merges pre-/post-change verdicts. I accept that reasoning — it is
the same monotonicity discipline the phase applied to AE1.5's stale-baseline catch.

# ROUND 2 VERDICT: CHANGES REQUESTED — narrowed to ONE blocking item

Round 1's four blockers are three closed and one **narrowed but still open**. The open one is not
a recording defect any more — it is the measured, honestly-recorded fact that **the AE1.3 mutation
audit stands at 14/16**, with cases 2 and 7 `ERROR` (suite aborted, assertion never evaluated),
while the PO's own reworded Gate AE1 item 3 — taken in this round, and the right ruling — makes
that item turn on **16/16 with run shapes**. The PO deliberately moved the item from
*unsatisfiable* to *unsatisfied*; approving now would contradict that ruling's recorded intent,
and plan §AE1.3's "Keystones **mutation-proven**" is unmet for two named authority arms
(385 §1.1's always-arm capability binding; §5.1's capability binding). One unmet blocking gate
item is CHANGES REQUESTED regardless of how much else is right — and almost everything else is
now right.

## R2.0 What I re-measured myself this round

| check | claimed | mine | verdict |
| --- | --- | --- | ---: |
| `npm run test:db` (this tree, no reset) | 237 / 7,871 PASS | ✅ **237 / 7,871 PASS, exit 0** (exit captured directly, not through a pipe) | matches |
| `npm run lint` — now **eleven** gates | exit 0 | ✅ **exit 0**; gate 11 reports `44 derived == 44 registry (census 39 + callDoor() 5)` | matches |
| `npm run typecheck` / vitest | 0 / 145 files 1,974 | ✅ **exit 0** / **145 / 1,974, exit 0** | matches |
| AE1.3 audit re-run | 14 HOLDS + 2 ERROR (cases 2, 7) | ✅ read the run log (`ae13_v2_173508.log`, **mtime 17:37 today** — fresh, timestamp checked per the stale-log lesson): CASE 2 `Tests=11 vs 49`, CASE 7 `Tests=42 vs 49`, cases 10–14 **all full-shape 55/55**, `FINDINGS: 2`, FINAL STATE all three files PASS | matches |
| `app.can_administer_person_for` | `boolean`, `prosecdef=t`, STABLE, no `authenticated` EXECUTE | ✅ catalog: `boolean / t / s / f` | matches |
| its door-findings row | `ERROR run-shape!=baseline` | ✅ `authz-door-audit-findings.md:350`, exactly that, file unchanged at HEAD | matches |
| BLOCK 9's two bounds | 413 / 87 | ✅ **413** (`public`+DEFINER+auth-exec+non-trigger) / **87** (INVOKER twin) — re-derived on the catalog | matches |
| DEFINER total / budget | 856 = 460+396 / 752 = 432+320 | ✅ both, re-derived | matches |
| pgTAP 382 §A0's derived set | equals the declared seven | ✅ ran §A0's own query on the catalog: byte-identical to the declared string | matches |
| registry verdict tokens (obligation 4) | 20 YES · 5 PARTIAL · 15 NONE · 4 UNCONFIRMED = 44 | ✅ **20 / 15 / 4 by leading token over the 44 rows, plus exactly 5 residue rows, all partial-shaped** — see the qualification in R2.1 M3 | matches |
| the "dangling FUP ids" | exist nowhere but my own sentence | ✅ `git grep` at the round-1 tree (`e9df56c7`): **zero hits in any .md** — they never existed outside my review | round 1 refuted |
| site-scoped allowlist, both ways | must_change_password site green; a different raw update reds | ✅ **reproduced against a scratch tree** (never touching `src/`): probe A (marker site) exit 0, probe B (different column) **exit 1** | matches — and see N1 |

⚠ Not re-run by me, per scope: any ARM arm, the door sweep, `e2e:prod`. The census 565/601 claim
(+1 gate = the predicate, the exact shape census's first clause enumerates) is accepted on the
phase record plus two corroborations I did take: the census artifacts are fresh (mtime 17:07
today) and the predicate appears in `census_names.txt`.

## R2.1 Disposition of the round-1 findings

| # | disposition | basis |
| --- | --- | --- |
| **B1** | ⛔ **STILL OPEN — narrowed.** | The **instrument** is fixed and fixed well: `run_test` captures `Files=/Tests=` per run, baselines per file, classifies a shape drop as `ERROR` distinct from both HOLDS and FINDING, and the baseline loop **refuses to run** if a shape wasn't captured — the guard that caught the fix's own subshell regression. The **claim** is now honest (14/16, corrected everywhere I could find except the plan's forward-looking gate wording, which correctly states 16/16 as the *target*). What remains: **(a)** cases 2 and 7 prove nothing — the two capability-swap keystones (385 §1.1, §5.1) are unverified by mutation, and Gate AE1 item 3 as reworded turns on them; **(b)** two of the four harness gaps from round 1 §4 were not addressed — there is still **no declared-case reconciliation** (comment out a `one_case` line and the run exits 0 having measured 13) and **G1 still never asserts its ACL mutation landed** (it echoes before/after and compares neither; a silently-failed grant is misattributed as a keystone failure). Neither (b) item blocks on its own now that the count is honest; both should land with (a). |
| **B2** | ✅ **CLOSED.** | True surface **44** (census 39 + callDoor 5), machine-diffed by `lint:service-role-registry` — the eleventh gate, which I ran green. The gate is the right shape: **multiset** comparison (two legitimate duplicate identities survive), a **per-run self-test** proving the differ can report MISSING and EXTRA before any verdict is issued, `FATAL` on an empty census or an empty registry parse (never a clean bill), and the callDoor expansion asserted **bidirectionally** (placeholder-without-sites and sites-without-placeholder both red). My round-1 "deriver returns 40" was itself standing on the census's `<dynamic:fn>` collapse — the corrected 44 is better-derived than my figure was. Residual, stated not blocking: a **second** free-function wrapper in a new module would likely surface as an unmatched `<dynamic:*>` derived key (red), but that path is inferred, not proven — worth a line in the gate's header someday. |
| **B3** | ✅ **CLOSED-WITH-QUALIFICATION.** | The ruling is taken, recorded, and is the *right* ruling: plan rule 4 now derives arm membership from the door's own shape (no universal that a `service_role`-only door cannot meet), keeps "absence of a verdict IS absence of coverage", names the per-door discharge, adds the REVOKE-moves-domains interaction, and Gate item 3 now demands the coverage this class can actually carry — **and is explicitly still unmet**, honestly, because it turns on B1's residue. Two qualifications: **(1) the edit is uncommitted** — the authoritative wording of a gate item currently exists only in a working tree (finding N4); **(2)** the corrected composition is *worse* than my round-1 framing and the record says so plainly: the one in-domain object's census verdict is `ERROR`, and the compensating control it was ruled against has itself lost two verdicts. That is the honest statement round 1 asked for. |
| **B4** | ✅ **CLOSED.** | §6.2's table re-headed as §4.3's counterfactual with truthful column headers (`with duplicates (= the live tree) | with them removed (never shipped)`), the live-catalog measurement (771-char qual, 4 OR arms) recorded beside it, and the propagation into the handoff acknowledged rather than hidden. The generalization drawn ("a table survives being moved while its headers stop being true") is the correct one. |
| **M1** | ✅ **CLOSED** (as a PO-ruled, recorded narrowing of PA-F11). | BLOCK 9 isolates the command-door population **as a property** and emits per-door threat columns; BLOCK 10 gives the "41 of 47" a deriver; the three arithmetics re-derived (C3 partition **20+13+24+1=58** ✓, printed); §7a states the instrument's own domain including the BLOCK-3 phantom-literal mode and the unsafe direction it errs in; the 407 removed. I re-derived 413 and 87 on the catalog. The narrowing ("derivable per-row justification", not "a human wrote a sentence") is recorded as a narrowing, which is what round 1 required. |
| **M2** | ✅ **CLOSED-WITH-QUALIFICATION.** | `backend-state.md` corrected and correct: Tier 1 **523** (with the falsification history stated in the row), **856** = 460+396 (✓ re-derived), revoke row now *"NONE EXECUTED — a scheduling fact, not an RV0 verdict"* with the true partition, `plan(72)`, both registry cells and the Summary prose updated. Qualification = two survivors, filed as **N2/N3** below: `authz-ae1.md:17` (the AE1.2 status row) **still says "all 233 revokes HELD under RV0"** — the exact phrasing the same commit corrected in the durable map — and `PROGRESS.md:85` still says `lint **10/10**` in a line whose `test:db` figure was re-measured to 7,871 in the same edit, while lint is now eleven gates. |
| **M3** | ✅ **CLOSED.** | All six obligations filed — index line **and** `### FUP-…` body verified for every id, including `FUP-E2E-REPEAT-FLAKY`'s own index line and `FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS`'s pointer body; obligation 7's claim corrected to what the register can verify; obligation 8 marked discharged-by-delivery. My round-1 obligation-4 split and my dangling-ids claim were both wrong — adjudicated in R2.2. One qualification on the re-derivation's own wording: the "leading-verdict-token rule" literally reproduces only 39 of the 44 rows (20 YES · 15 NONE · 4 UNCONFIRMED); the **5 PARTIAL rows carry no leading token at all** — they open with `pgTAP \`388\`…` prose and are classifiable only by reading. The split is correct (I checked all five are partial-shaped), but "re-derive from the rows, never arithmetically" is not yet a mechanical instruction; if PARTIAL is to be a bucket the rows should carry its token. |
| **M4** | ✅ **CLOSED.** | §6.0a records the substitution as a substitution, with the *reason* the mandated instrument cannot mean what its name suggests here (`reltuples = -1`, AE0.2's own shape-not-latency charter) and **what the substitution gives up stated** (buffers, rows-removed, loops). Advisor count demoted to corroboration in both the ruling and the §6.2 table. The carve-out extended to the `USING`-on-non-SELECT class with the `meeting_cases`/`profiles` attribution insight — including the correct observation that the catalog alone gets attribution wrong and the migration file is the right instrument for exactly that one question. |
| m1 | ✅ **CLOSED.** | §A0 lands the set-closure assertion; I ran its derived query — byte-identical to the declared seven. Proven able to fail, and it **fails rather than aborts** (72/72 both ways). The hard-coded expected string is the *declared* half of a derived-vs-declared comparison — that is the closure pattern working, not a hand list regressing; it must be edited when the set legitimately changes, which is the point. (Trivial note: the derivation binds `relkind = 'r'`; a partitioned zero-policy table would sit outside it. None exists.) |
| m2 | ✅ **CLOSED**, with **N1** filed on the residue. | Site-scoped on (file, table, verb, marker); allowlist iteration is per-match, the whole-file `continue` removed; the stale "inert" sentence replaced with the live truth. I reproduced the both-ways proof myself against a scratch tree. But see N1: the marker pins the **column**, not the **self-scope**. |
| m3 | ✅ **CLOSED** (domain qualifier now beside the arms claim, and it names the person-door population too; vitest figures corrected and match my measurement) — modulo the `10/10` residue filed as N3. |
| m4 | ✅ **CLOSED.** Both stale bullets in the phase record rewritten to record the staleness itself, which is better than deletion. |
| m5 | ✅ **CLOSED.** §6.2.2 answers the question with a measured two-fact bound, states it as an inference, and names the one table a re-capture would target. |
| m6 | ✅ **CLOSED, and exceeded.** The rettype cell now says what the catalog says (with the correction dated), and the 137-no-op probe was **re-run on an actual member of the 233** (`app.guard_case_tag_assignment`, NULL `proacl`, revoke-did-nothing) with the positive control retained — upgrading the finding from mechanism-proven to population-proven. |

## R2.2 The three corrections to my own round-1 findings — adjudicated on the evidence

Round 1 was asked to be checked as adversarially as the phase. All three corrections **hold**; two
refute me outright, one refutes my headline while my own §6 text contained the contrary fact.

1. **B1's case list (round 1: "cases 10–14, which mutate `app.can_administer_person_for`").
   REFUTED — the correction holds.** The case list itself decides it: cases 10–14 are the five
   predicate mutations targeting `384`, and the fresh re-run log shows **all five red at full shape
   (55/55)**; the two ambiguous cases are **2 and 7** — capability-**swap** mutations inside door
   bodies, aborting **385** (11/49 and 42/49). My mechanism transplanted the sweep's measured abort
   (whole-body neutralization to `select true`) onto targeted logic mutations — a different
   mutation class, which is a lesson this repo had already written down (*a neutralization is valid
   only for its class*) and I did not apply. The predicate I offered was both too wide (5 for 2)
   and blind (0 of the 2). The phase record's sharper point is also right: had the fix been aimed
   at my case list instead of at the instrument, both broken cases would still be counted as holds.
   The instrument-first fix is what made my finding useful despite its mechanism being wrong.
   ⭐ Worth noting the *mechanism coherence* of the measured result, since nobody wrote it down:
   the two aborting swaps are the two **narrowing** swaps (`fields→cpf_change`,
   `credentials→lifecycle` — INTERSECTION→SUBSET), which turn fixture-setup allows into raises;
   case 4's swap **widens** (`lifecycle→fields`) so setup survives and the deny assertion fails
   cleanly at full shape. The 14/2 split is exactly where a raise-in-setup model predicts it.
2. **B3's "in no ARM domain" (round 1 headline). REFUTED on one object — the correction holds,
   with one nuance.** `app.can_administer_person_for` returns `boolean` with `prosecdef = t`
   (re-verified on the catalog), so it sits squarely in `ARM=census`'s first domain clause, and its
   recorded verdict is `ERROR run-shape!=baseline` — not COVERED, and not absent. The nuance: my
   round-1 §6 body did state both facts explicitly ("Only `app.can_administer_person_for` appears,
   once — and its verdict is an ERROR, ruled"), so the review contained the truth its own headline
   excluded — the finding-line's set ("the six new doors") was drawn to exclude the one object that
   mattered most. My `ARM=hat` row ("not reported for any of them") was also wrong in emphasis:
   hat's domain carries no privilege term and contains all 13 objects, and holds. The corrected
   composition — three arms out **by construction**, census in-domain with an ERROR, hat holds,
   ADR 0156 inherited, the compensating audit itself at 14/16 — is both more precise and *worse*
   than my version, which is exactly what a correction should be allowed to be.
3. **M3's obligation-4 split (round 1: "20 no-test + 4 UNCONFIRMED = 24"). REFUTED — the
   correction holds.** Re-derived on the registry's 44 rows myself: leading tokens give
   **20 YES · 15 NONE · 4 UNCONFIRMED**, and the 5 token-less residue rows are all partial-shaped
   (pgTAP half covered, behavioral/route half not). My "20 no-test" was 15 NONE + 5 PARTIAL —
   I collapsed PARTIAL into NONE, the precise error the registry's correction paragraph records
   AE1.4 making, and it read plausibly because 20 is also the YES count. And the **dangling-ids
   claim was wholly mine**: `git grep` at the round-1 tree finds
   `FUP-DOOR-SWEEP-DERIVER-POINTS-AT-ONE-ARM` and
   `FUP-WRITEPATH-AUDIT-EXITS-CLEAN-HAVING-MEASURED-NOTHING` in **no file** — the phase record
   never cited them; I appear to have reconstructed plausible ids from the folded parts of
   `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` and then reported my reconstruction as a citation. That is
   the same title-reconstruction failure the lead caught in themselves this round with the ADR-0124
   anchor, and it is recorded here so it counts against my round-1 accuracy, not against the record.

## R2.3 New findings this round

- **N1 (minor, instrument) — the allowlist marker pins the COLUMN, not the SITE's exempting
  property.** Probed against a scratch tree (never `src/`): a raw
  `.from('profiles').update({ must_change_password: true }).eq('id', targetId)` — an **admin write
  of the same column to ANOTHER user's row** — in the same file passes the gate silently, because
  (file=`src/lib/auth/actions.ts`, table=`profiles`, verb=`update`, marker=`must_change_password`)
  all match. The property that justifies the exemption is *self-scoping* (`.eq('id', user.id)` from
  the same request's `getUser()`), and it is not in the marker — and `guard_profile_privileged_columns`
  will not catch this variant either, since the column is service-role-writable by design. The
  `SITE_WINDOW=400` bound itself is fail-closed (a marker pushed past the window reds, the right
  direction), and today the file holds exactly one `profiles` DML site, so this is a latent gap,
  not a live one. Fix is one line: compound the marker (require `.eq('id', user.id)` in the same
  window, or a named sentinel comment).
- **N2 (record) — `authz-ae1.md:17` still reads "⛔ all 233 revokes HELD under RV0"** — the exact
  sentence M2's fix corrected in `backend-state.md:500`, surviving in the phase's own live status
  table. The durable map and the live record now disagree; the live record is the wrong one.
- **N3 (record) — `PROGRESS.md:85` says `lint **10/10**`** inside a gate line whose `test:db`
  figure was re-measured to 7,871 in this round's own edit. Lint is **eleven** gates (I measured
  all eleven green). A gate line that mixes a re-measured figure with a stale arity reads as one
  measurement and is two.
- **N4 (process) — the B3 ruling is uncommitted.** The rewritten plan rule 4 and Gate AE1 item 3 —
  now the authoritative wording of a phase-gate item — exist only in the working tree. The phase
  record's ruling section says B3 closes when the Record step cites the ruling; a ruling that can
  be lost to a `checkout` cannot be cited. Commit it before anything else cites it.
- *(Checked and NOT filed:* the audit patch's per-case fall-through when no `Tests=` line is
  captured — analyzed: a missing shape line implies a missing `Result:` line, which lands in
  FINDING, not HOLDS, so the asymmetry with the baseline loop's hard stop is acceptable; and the
  382 §A0 expected string — that is the declared half of a closure comparison, working as
  intended.)*

## R2.4 Gate AE1, item by item, as it stands now

Unchanged from round 1: items 1, 2, 5, 6, 7, 8, 9 ✅ (item 1 gains the re-measured 7,871 suite and
the eleven-gate lint; item 5's review now carries §7a and BLOCK 9/10). Changed:

| # | item | round 1 | now |
| --- | --- | --- | --- |
| 3 | doors vs ARM domains (as PO-reworded, uncommitted) | ⛔ NOT MET, unrecorded | ⛔ **NOT MET, and now says so itself** — turns on the mutation audit at 16/16 with shapes; it stands at **14/16** (cases 2, 7 ERROR). This is the one substantive blocker. |
| 4 | registry derivation clean, zero `undecided` | ⛔ NOT MET on "clean" | ✅ **MET** — 44 == 44, machine-diffed by a self-testing gate on every `npm run lint` |
| 10 | QA review | round 1 | this round |
| 11 | PO approval | pending | pending — blocked on item 3 |
| 12 | Record step | pending | pending — N2, N3, N4 and the PROGRESS.md rotation land here |

## R2.5 Required changes (round 2)

**Blocking:**

1. **Re-express mutation-audit cases 2 and 7 so their suites COMPLETE** — e.g. the swap cases run
   against a fixture path that survives a narrowing swap (or the setup calls are wrapped so a
   denial is asserted, not raised through) — and re-run the audit to **16/16 KEYSTONE HOLDS at
   full shape**. While in the file, add the two round-1 leftovers: a declared-case constant
   reconciled against cases actually run, and G1's landed-check (compare the ACL before/after the
   grant, like every other case). That single item satisfies Gate AE1 item 3 as reworded and
   discharges plan §AE1.3's "mutation-proven" for the two capability bindings.
2. **Commit the plan edit** (N4) — the B3 ruling must exist in history before Record cites it.

**Record-step (non-blocking now, must not survive Record):** N2 (`authz-ae1.md:17`), N3
(`PROGRESS.md:85` lint arity), N1's one-line marker compound (or a recorded decision that the
column-marker is accepted), and the M3 qualification (give the 5 PARTIAL rows a leading token if
PARTIAL is to be a mechanical bucket).

**On resubmission I need:** the audit's re-run log at 16/16 with shapes (timestamp-checked), and
the plan-edit commit hash. Nothing else — no migration, policy, or pgTAP file should move for
either, and this time that premise is stated as a *prediction to re-verify*, not an assumption:
if anything else moves, say so and I re-measure accordingly.

---

**What round 2 should record as done unusually well, because it was:** the harness fix documented
its own reintroduced defect (the subshell) and credits the guard rather than the feature; the B1
correction was aimed at the instrument, not at my (wrong) case list, which is the only reason the
real two cases were found; the B3 ruling turned an unsatisfiable universal into an unsatisfied,
satisfiable requirement and refused to call the residue covered; and every correction of a QA
error was made by measurement, recorded with the mechanism of my mistake — which is what made
this round's adjudication of my own round-1 findings possible at all.

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

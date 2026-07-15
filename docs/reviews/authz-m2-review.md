# AUTHZ · M2 — A30 bucket C review (platform_admin loses the referral-PHI arm)

**Reviewer:** `qa` · **Date:** 2026-07-15 · **Scope:** ADR 0078 A35 (PO ruling), the
noun rule, bucket C only.

## VERDICT: **APPROVED**

Everything below was established by **execution against the live catalog**, in
rolled-back transactions — never from migration file text (this repo rewrites function
bodies via `pg_get_functiondef` + `replace` + `execute`, so file text is stale by
design; M2 itself is such a migration). **graphify was not used** (ratified exception
for this review); its `PreToolUse` hook fired on every Read/Bash and was deliberately
ignored.

---

## 1. Is the PHI-destruction path dead? — **YES (behaviourally proven)**

Live catalog, all six disposal functions: **no `is_admin` arm anywhere**. The family is
uniform — `dispose_referral_phi` and `can_dispose_referral_phi` now match the four
siblings rather than inventing a shape.

Behavioural probe as `platform@test.local` (`…b0`, `is_admin = t`), **valid reason**
(`retention_expired`, to reach the real gate — not a `23514` reason-code check):

```
padmin can READ the PHI?              <<NULL - CANNOT READ>>
padmin dispose_referral_phi           DENIED: SQLSTATE=42501
  msg = apenas um administrador da organização ou o NSP pode descartar dados do paciente
PHI rows AFTER padmin attempt         1     ← THE ROW SURVIVES (was: 1 → 0)
referral marked disposed?             false
```

**The ROW is asserted, not the error code** — keystone 46 (`…and the PHI row SURVIVES
the platform_admin`) is the assertion that actually matters, and it holds.

## 2. Is legitimate disposal intact? — **YES. The over-grant twin genuinely passes.**

This was the whole review: a deny that denies *everyone* also denies platform_admin, so
the negative passes by construction. I **did not accept the reported survivor list** — I
re-enumerated the entire roster from the catalog, under each user's own claims:

**`ref_b` (the keystone's target) — 3 of 28 users can dispose:**

| email | is_admin | can dispose |
|---|---|---|
| `nspcoord.b@test.local` | f | **t** |
| `orgadmin.b@test.local` | f | **t** |
| `pqs.b@test.local` | f | **t** |
| `platform@test.local` | **t** | **f** ← the only true platform_admin in the seed |

Exactly the reported population, independently derived. And behaviourally, `pqs.b`
**actually executes**: `dispose_referral_phi` succeeds, PHI rows 1 → 0, the LGPD /
retention path is intact. The deny did not deny everyone. **This is a fix, not a
regression.**

## 3. Mutation harness — re-run by me, 21/21 RED-PROVEN, and red means red

Re-run per the standing rule (I didn't write it; this harness has hidden real results
twice). **21/21 RED-PROVEN**, reproduced.

**The harness earned its keep in an unplanned way.** My first run returned
**`ABSENT(aborted)` on all 21** — pgTAP was not installed on my stack, so the suite never
ran. The harness **refused to call that green** (lesson #2 held, live). Root cause is
environmental, not a defect: `plan()` did not resolve because the `pgtap` extension is
created by the `supabase test db` runner, and the harness silently inherits it. I
installed it (`create extension pgtap with schema extensions`) and got the real result.
*Minor, non-blocking:* the harness would be more honest with a one-line pgTAP
precondition check that aborts loudly rather than reporting 21 ABSENTs. Filed as a nit,
not a change request — the ABSENT path is exactly what saved it.

**The M2 mutation genuinely puts the arm back** (verified separately, not assumed):
under the mutation the arm is restored in `prosrc`, and **the padmin's disposal succeeds,
1 → 0 — the original breach faithfully reproduced.** Red is red for the right reason.

Unmutated `189`: **plan 53, 53 ok, 0 not-ok**, with all ten M2 assertions (42–51) present
and passing.

## 4. The two self-reported traps — both confirmed closed

**Trap A — the wrong-persona keystone.** Confirmed from the catalog:
`admin@test.local` = `…001`, **`is_admin = false`**; the real one is `platform@test.local`
= `…b0`, `is_admin = true`. **The keystone uses `…b0`** (189:321, 329), and PRE-assertion
42 pins `is_admin = true` so the keystone cannot silently degrade into denying for the
wrong reason. Correctly handled.

**Trap B — the A30 false positive reproduced inside its own fix.** Confirmed closed from
the catalog: **neither** stored body contains `is_admin()` in *any* form —

```
dispose_referral_phi:     bare-is_admin()=false   app.is_admin()=false
can_dispose_referral_phi: bare-is_admin()=false   app.is_admin()=false
```

The self-check is **not defanged** — it is fail-safe in the right direction. The
`<> 1` count guard *raises* (rather than silently passing) if a comment ever
reintroduces the literal; the `if not (` anchor occurs **exactly once**; and both
post-patch `prosrc` assertions would fire on a silent no-op. The convention (don't spell
the arm in the removal comment) matches the siblings. This is the correct resolution:
`text is not truth`, including for the text you write while removing text.

## 5. Scope — clean. No over-reach.

The migration touches **exactly two objects**: `create or replace
can_dispose_referral_phi`, the `do` block patching `dispose_referral_phi`, and its
`comment on function`. **No** resolver, **no** `case_access_grants`, **no** A21 removal,
**no** bucket B, **no** Class-2, **no** §3.6 carry. B/D/Class-2 correctly deferred.

**Nothing else broke** — 593 assertions across the PHI/referral/authz surface, **0
failures**, including ethics-E1 (keystone 23, the Class-2 over-reach guard) and M1:

| suite | plan | not-ok |
|---|---|---|
| 144_case_access | 102 | 0 |
| 150_referrals | 82 | 0 |
| 151_case_patient | 39 | 0 |
| 152_patient_index | 43 | 0 |
| 189_nsp_per_hospital_isolation | 53 | 0 |
| 190_membership_lockdown | 37 | 0 |
| 191_grant_hardening | 26 | 0 |
| 228_ethics_e1 | 125 | 0 |
| 229_authz_m1_exclusion_durability | 86 | 0 |

**pt-BR message:** unchanged, and correct — `apenas um administrador da organização ou o
NSP pode descartar dados do paciente` never mentioned the platform admin. Removal makes
it **true**, not different. Rule 10 satisfied; a clean 42501 with a pt-BR message, no raw
Postgres error.

**Architecture Rule 1 upheld:** the UI gate (`page.tsx:174` →
`canDisposeReferralPhi` → the `can_dispose_referral_phi` DEFINER probe) *mirrors* the
RPC — the RPC is the authority, the UI is not the control. The affordance correctly
disappears for platform_admin with no code change.

---

## Still live (MINOR — non-blocking, no behaviour at risk)

**M2-1 · Stale JSDoc now describes a gate that no longer exists.**
`src/lib/queries/referrals.ts:918-920`:

> `Mirrors the dispose_referral_phi gate EXACTLY: is_admin() OR is_commission_admin_of(source) OR is_pqs_operator_of(either endpoint hospital).`

The claim "EXACTLY" is now **false**, and this text **spells `is_admin()` as part of the
gate**. Behaviour is correct (the code calls the RPC and safe-defaults `false`), so this
is documentation only — but it is the *third* instance of the A30 false-positive class,
now in TypeScript: a future auditor grepping for the arm finds this line and concludes
the arm survives. Same for the `(admin / source commission-admin / PQS operator …)`
comment at
`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx:169`.
Two comment lines, backend-owned. Recommend folding into the M2 commit; not a gate.

**M2-2 · Harness pgTAP precondition** (see §3) — nit.

**Deferred by ruling, not by oversight:** buckets B and D, and Class-2 (audited reads =
a product decision; over-reach fails keystone 23). Correctly out of scope for M2.

---

## E2E recommendation: **targeted run — do NOT run the full suite**

Recommend `e2e/nsp-per-hospital.spec.ts` + `e2e/phase22-referrals.spec.ts` +
`e2e/phi-remediation.spec.ts` (chromium). Reasoning:

1. **The blast radius is one predicate and one RPC gate, DB-only.** No `src/` change;
   types diff-verified identical (subtractive ⇒ no signature change). The only UI effect
   is a button that disappears for one persona.
2. **No E2E persona exercised the deleted arm — I verified this rather than assuming
   it.** AC-7's happy path disposes as `admin@test.local`, which is the *trap-A persona*
   (`…001`, `is_admin = false`) — it qualifies through the **commission-admin** arm, and I
   confirmed behaviourally it **still disposes ENC-0004**. AC-7's negative
   (`chefe.ccih`) and the `pqsdual.a` positive are likewise untouched. For `ref_x`,
   **9 users can still dispose, none of them via `is_admin`**, and `platform@test.local`
   is not among them. The only e2e file mentioning `platform@test.local` alongside
   referrals is `perf-sweep-wave2`, where it is a **comment** (`vendor platform_admin (no
   tenant access)`) — no disposal.
3. **pgTAP already covers this more precisely than E2E can.** There is no UI path for a
   platform_admin to dispose a referral (it is walled off from tenant data), so E2E
   *cannot express* the keystone. The 53/53 + 21/21 mutation-proven layer is the real
   evidence; E2E would add coverage of the surviving personas only — which the targeted
   specs give.
4. **The full suite is disproportionate and noisy**: 18–40 min against a known ~18–27
   flaky baseline, exercising a surface this change does not touch. The triage cost
   exceeds the information gained.

Run the full suite at the next merge gate, not for this 6-line subtraction.

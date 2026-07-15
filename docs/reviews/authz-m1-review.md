# QA review — AUTHZ · M1 · exclusion durability (ADR 0078 Gate 1)

**Date:** 2026-07-15 · **Reviewer:** `qa` · **Branch:** `feat/authorization-capability-model`
**Subject:** `20260722000000_authz_m1_exclusion_durability.sql` · `20260722000100_authz_m1_gate_helper_deny.sql`
· `supabase/tests/229_authz_m1_exclusion_durability.sql` · `src/lib/participants/actions.ts`
**Contract:** my own §W-6 (the authoritative, ordered M1 scope).

**Method:** live catalog only — `pg_proc` (incl. `prosecdef`), `pg_policies`, `pg_policy`, `pg_trigger`,
`pg_class.relacl`, `pg_depend`. **No migration file was read as evidence.** 14 behavioural probes, each in a
transaction and `ROLLBACK`ed; catalog + data integrity re-verified afterwards (0 rows leaked, 0 catalog
residue). **5 mutation experiments** — the migration was deliberately reverted in a rolled-back transaction
to test whether each keystone can fail.

> **On the graphify hook.** The `PreToolUse` hook asserting graphify is mandatory was **deliberately not
> followed**. graphify does not index SQL, and this is a **ratified exception** for this program. Recording
> it so no future round mistakes the omission for sloppiness.

---

# VERDICT: ⛔ **CHANGES REQUESTED**

**The code is right. The test is not — and this migration's entire purpose is the test.**

Every P0 in §W-6 is **CONFIRMED DEAD** behaviourally, on the narrow precondition, with the row surviving the
denied party. I tried to break each one and could not. `backend`'s three contested judgement calls
(`HC0G`→`HC0F`, the `record_recusal` self-arm, the trigger-based freeze) are **all correct**, and I verified
the one it argued for *less* gating on in both directions. Over-reach: **zero**. Scope discipline: **exact**.

It fails this gate on two things:

> **1 · A VACUOUS KEYSTONE — the fifth occurrence, in the migration whose stated purpose (A29) is to end
> vacuity.** Tests **33** and **34** — the two ⭐ keystones §W-6 demanded — **cannot fail**. Test 34 is the
> Rule 12 one. **Proven by mutation:** with the M1·3 freeze deliberately reverted, both stay **green**.
> The cause is a side effect of an *unrelated positive twin* 30 lines earlier, and §W-6 named the exact
> precondition the test violates: ***"AND the respondent never acts."*** He acts. **Fix: one line.**
>
> **2 · THE CARRY LEAVES A LIVE RULE 12 HOLE — proven live.** `dispose_case_phi` is `is_staff_admin_of OR
> is_commission_admin_of`, **no exclusion term**. The respondent-coordinator **cannot read** the patient
> identifiers (`can_read_case_patient = f`) and **can irreversibly destroy them** (`[PHI removido]`). The
> accused destroys the evidence of the case against her. It is **in §W-6's M1·4 scope by D5's own rule**
> (case-scoped, `case_id` resolvable) — it is out by the **carry**, not by scoping.

Neither requires a redesign. **Re-review is minutes.**

---

# 1 · The P0s — CONFIRMED DEAD, behaviourally

**Fixture (the narrow precondition, §W-6).** `staff4.ccih@test.local` (`00…0a`) is the only linked
respondent, on case `ca…e1`, and is seeded **plain `staff`**. Every probe **inserts the `staff_admin`
membership row**. Baseline, measured under her own JWT:

```
precondition | is_staff_admin=t | respondent=t | excluded=t | can_read=f | can_read_phi=f
```

She holds the positive arm; the deny is the only thing beating it. That is the exploit state.

| # | Door | Result | Evidence (rolled back) |
|---|---|---|---|
| 1 | `remove_case_participant` | **CONFIRMED DEAD** | `RAISED HC0F1`; `is_case_respondent` still `t` |
| 2 | `set_case_participant_role` | **CONFIRMED DEAD** | `RAISED HC0F1`; role survives her |
| 3 | `set_primary_subject` | **CONFIRMED DEAD** | `RAISED HC0F1` (gate fix, correctly not keystoned as durability) |
| 4 | `lift_recusal` | **CONFIRMED DEAD** | `RAISED HC0F1`; `is_recused_from_case` still `t`; **`can_read_case_patient` stays `f`** |
| 5 | `record_recusal` (coordinator arm) | **CONFIRMED DEAD** | `RAISED HC0F1` recusing another; **self-arm survives** (§3.3) |
| 6 | `case_participant_roles` UPDATE-freeze | **CONFIRMED DEAD** | org_admin `RAISED HC0F3`; `is_case_excluded` still `t` |
| 7 | B7 linkage freeze (the 6th mutator) | **CONFIRMED DEAD** | `RAISED HC0F2` via RPC **and via direct DML** |
| 8 | Attach-time check, **both** doors | **CONFIRMED DEAD** | `add` and **re-key** both `RAISED HC0F0` |

## 1.1 · The one that nearly fooled me — recorded, because it is the lesson

My first `lift_recusal` probe raised **`HC0E1`**, not `HC0F1`. `HC0E1` is *"recusal not found"* — the
respondent has no recusal, so **the probe never reached the gate**. Had I recorded "raises ⇒ dead" I would
have logged a pass that asserted nothing, in the very review whose job is finding that. The correct fixture
(§W-6: `chefe.ccih`, already `staff_admin`, **insert the recusal only**) reaches the gate and returns
`HC0F1`.

**This is `backend`'s structural defence working on me.** Distinct SQLSTATEs turned a silent false pass into
a visible wrong code.

## 1.2 · Delegation cannot be resolved statically — the lead's cautionary datum, generalized

The lead's warning was that a `prosrc` text filter cannot answer *"is this door gated"* (`set_participant_patient`
is gated via `app.assert_not_case_excluded`, so the string never appears). **`pg_depend` cannot answer it
either:**

```
fn → helper edges for assert_not_case_excluded / is_case_excluded:  0 rows
```

plpgsql bodies are opaque strings, never parsed at creation, so no dependency edges exist. **Neither text nor
the catalog's dependency graph can resolve gating. Behaviour is the only evidence.** Every verdict above is
behavioural. (This also independently corroborates A0's D3 finding.)

---

# 2 · The vacuous keystone ⛔ — tests 33 + 34 (BLOCKING)

**`supabase/tests/229_authz_m1_exclusion_durability.sql:353` and `:360`.**

```sql
-- :353  test 33
select is(app.is_case_excluded('…f0001', (select st_x from k)), true,
  'M1·3 (a): …and the exclusion SURVIVES the org_admin — is_case_excluded still `t` (today: `f`)');
-- :360  test 34
select is(app.can_read_case_patient('…f0001', (select st_x from k)), false,
  'M1·3 (b) KEYSTONE ⭐ RULE 12: the respondent-coordinator''s PHI door stays SHUT (today: `t`)');
```

## 2.1 · The proof — mutation testing

I reverted M1·3 (the guard trigger made a no-op) in a rolled-back transaction. **The defect is live**, and
directly measurable:

```
sa_y is_org_admin_of(org_x) = t
UPDATE key (guard neutralized) -> 1 row(s)
is_case_excluded after: false          ← the deny IS dissolved
key now: former_respondent
```

Yet inside the suite, with that same mutation:

```
not ok 32 - M1·3 (a) KEYSTONE ⭐: an org_admin CANNOT re-key case_participant_roles.key
    ok 33 - M1·3 (a): …and the exclusion SURVIVES the org_admin — is_case_excluded still `t` (today: `f`)
    ok 34 - M1·3 (b) KEYSTONE ⭐ RULE 12: the respondent-coordinator's PHI door stays SHUT (today: `t`)
```

Test 32 falsifies correctly. **33 and 34 stay green while the hole they describe is open.**

## 2.2 · Why — and §W-6 named it in advance

Instrumented at the moment test 33 runs, under the mutation:

```
respondent arm  : false     ← the org_admin's re-key DID dissolve it
recusal arm     : true      ← st_x carries a SELF-RECUSAL (source=self)
is_case_excluded: true      ← kept alive ENTIRELY by the recusal arm
recusal rows for st_x: 1 (source=self)
```

That self-recusal is inserted at **`:317`** — the M1·2 `record_recusal` **positive twin** (*"an EXCLUDED party
may still recuse HERSELF"*), a correct and valuable test. Its **side effect** permanently contaminates
`st_x`'s exclusion state for every later assertion. From `:320` onward, anything keyed on
`is_case_excluded(case, st_x)` or `can_read_case_patient(case, st_x)` measures the **recusal** arm — while
M1·3 is about protecting the **respondent** arm.

**§W-6 (b) wrote the precondition this violates, verbatim:**

> *"needs the FULL composed precondition: respondent AND `staff_admin` … AND the actor is the org_admin,
> **AND the respondent never acts**."*

He acts, at `:317`. And the `(today: f)` / `(today: t)` annotations are **provably false**: at that point in
the suite, with the defect live, the values are `t` and `f`.

## 2.3 · The fix — one line, verified

Add after `:321` (the twin's `reset role`):

```sql
delete from public.case_recusals
 where user_id = (select st_x from k) and case_id = '00000000-0000-0000-0000-0000000f0001';
```

Verified three ways:

| Configuration | 33 / 34 | Meaning |
|---|---|---|
| **as shipped** + M1·3 reverted | **green** | vacuous |
| **+ the one-line fix** + M1·3 reverted | **RED** | the assertion becomes real |
| **+ the one-line fix**, code unmutated | **green** | the fix is correct |

**Full suite with the fix: 60/60 green, 0 failures.** (Reordering the M1·3 block above `:310` works equally;
the `delete` is the smaller diff.) Nothing downstream regresses — `st_x` stays excluded via the respondent
arm, which is exactly the point.

---

# 3 · The deviations — all three VERIFIED, including the one arguing for *less* gating

## 3.1 · `HC0G` → `HC0F` — ✅ **CORRECT, and the codes are internally consistent**

The catalog settles it. `HC0G` was **occupied**:

```
HC0G0 | public.grant_role        HC0G1 | public.revoke_role       HC0G2 | public.grant_role
```

The ADR's *"collision-checked at freeze"* was **false** — the lead is right that the check had never been
run. And `HC0F` is clean:

```
HC0F0 | app.assert_respondent_linkage_resolved · public.set_professional_link_state
HC0F1 | app.assert_not_case_excluded · add_case_participant · lift_recusal · record_recusal
      | remove_case_participant · set_case_participant_role · set_primary_subject
HC0F2 | app.guard_professional_linkage · public.set_professional_link_state
HC0F3 | app.guard_case_participant_role_key
```

**`HC0F0`–`HC0F3` are exclusively M1's; `HC0F4`–`HC0F9` are free** (full 120-code sweep). Semantics are
consistent: `F0` linkage-unresolved · `F1` exclusion · `F2` linkage-frozen · `F3` role-key-frozen.

## 3.2 · B7's attach-time check on **both** doors — ✅ **the hole is closed**

§W-6 named only `add_case_participant`; `backend` added `set_case_participant_role` on the reasoning that
re-keying **to** `respondent_doctor` would bypass a check on `add` alone. **Correct, and proven:**

```
DOOR1 add(unknown AS respondent)  -> RAISED HC0F0
DOOR2 attach as bystander         -> OK        ← benign role still admitted (no over-reach)
DOOR2 re-key TO respondent_doctor -> RAISED HC0F0
```

`app.assert_respondent_linkage_resolved` rejects only `link_state='unknown'`. `no_account` passing is
**right**: there is no account to exclude, so the deny is vacuously satisfied — and it is an audited human
assertion, not a guess.

## 3.3 · `record_recusal` — no blanket term — ✅ **the reasoning is SOUND and the twin proves it**

This is the one place `backend` argued for **less** gating, so I tested it hardest. The catalog shows the
`self` arm is evaluated **before** exclusion — a blanket term at the top would indeed have blocked
self-recusal:

```
if p_user_id = auth.uid() then            v_source := 'self';
elsif v_is_coord_raw and not v_excluded then  v_source := 'coordinator';
elsif v_is_coord_raw and v_excluded then      raise … errcode = 'HC0F1';
else                                          raise … errcode = 'HC0E4';
```

Proven in **both** directions:

```
SELF-recusal by EXCLUDED party  -> SUCCEEDED       ← required: recusal is monotonically restrictive
OTHER-recusal by EXCLUDED coord -> RAISED HC0F1    ← the panel-reshape attack is dead
```

**Endorsed.** Denying an excluded party the ability to restrict herself further is not a security gain; it is
a regression. The reach gate's `v_is_coord_raw or can_read_case` (RAW on purpose) is what lets an excluded
coordinator reach her own recusal, and the comment says so. Correct.

## 3.4 · B7's own trap — ✅ **M1·1 does NOT hand back the hole M1·2 closes**

`can_manage_professional` admits any org `staff_admin` — exactly the respondent twin's precondition. She has
the authority; the freeze is the only thing stopping her:

```
actor: respondent+staff_admin.  can_manage_professional(org)=t   ← she HAS the authority
set_professional_link_state(unlink SELF) -> RAISED HC0F2
DIRECT UPDATE (unlink SELF)              -> RAISED HC0F2   ← binds direct DML too, as owner
SURVIVES: is_case_respondent=t  can_read_case_patient=f
```

**The invariant is in the trigger, not the RPC** — so it binds every path, not just the polite one. That is
the right call and the code comment states it.

## 3.5 · The trigger-based freeze — ✅ **adequate; I hunted the bypasses and found none**

A trigger freeze is weaker than a revoked grant **iff a path can disable or bypass the trigger**. Both known
paths are closed:

```
ALTER TABLE … DISABLE TRIGGER          -> DENIED 42501   (owner is postgres; authenticated is not owner)
set session_replication_role = replica -> DENIED 42501   (superuser-only)
```

`tgenabled = 'O'` means the guard **would** be silenced under `replica` — so this mattered. It is
unreachable: `authenticated` cannot set it, and **no function in `public`/`app` sets
`session_replication_role`** (catalog-swept). The guard has **no escape hatch** — unconditional, no
`in_case_rpc` analogue. Both triggers enabled; `authenticated=arwd` kept, as documented.

**And it does not over-reach** — every legitimate path survives, asserted on **row counts**, not on absence
of error:

```
UPDATE display_name  -> OK, 1 row(s)      ← A18 config surface survives
INSERT new role      -> OK                ← A18 staffing survives
DELETE role          -> OK, 1 row(s)      ← set_participant_patient's INSERT path unaffected
```

*(My first pass here reported "OK" on an UPDATE that matched **0 rows** — my actor uid was wrong. An UPDATE
hitting nothing never raises. I re-ran asserting `row_count`. Recorded because it is the same vacuity failure
in miniature, and it was mine.)*

## 3.6 · Rule 11 — ✅ **the 161→161 silence is genuinely closed**

```
audit_log 136 -> 139   (INSERT + UPDATE + DELETE = 3 rows)
```

Non-vacuous: neutralizing `app.audit_case_participant_role` turns test 36 **red**.

---

# 4 · Over-reach audit — **0 found**

- **The INVOKER negative holds.** All **16** case-touching INVOKER functions remain `prosecdef = f`. No
  INVOKER was converted to DEFINER and none acquired a gate. *(Note: the suite's scope fence at `:592`
  covers **4**; §W-6 names **7**. The fence under-covers — see §7·m2 — but the catalog says the property
  itself holds.)*
- **Every positive twin passes**, and I re-ran the load-bearing ones myself: the clean coordinator still
  lifts the recusal, still declassifies, still registers the patient, still renames/creates roles; the
  excluded party still self-recuses; a benign role is still attachable; a committee action item with no case
  anchor stays readable.
- **Scope discipline is exact** — every A0 baseline unchanged:

```
case_access_grants table                          : 0      (absent — correct)
resolver fns (_case_caps / resolve_cap)           : 0      (absent — correct)
is_commission_admin_of in fns   (A0 baseline 121) : 121    ⇒ A21 admin-arm removal NOT done ✓
is_commission_admin_of in policies (baseline 93)  :  93    ⇒ D4·3 respected ✓
is_admin() sites (baseline 42 = 20 fn + 22 pol)   :  42    ⇒ A30 NOT started ✓
```

M1 stayed in its lane. No resolver, no `case_access_grants`, no A21, no A30.

---

# 5 · The carry — a plain answer

## 5.1 · Does M1 achieve *"the exclusion keystones stop being vacuous"* with the carry outstanding?

**For DURABILITY — yes, and I proved it rather than assuming it.** `is_case_excluded` reads exactly four
mutable facts: `case_participants.removed_at`, `case_participant_roles.key`,
`professional_profiles.user_id`/`link_state`, and `case_recusals`. All are now sealed. I called **every
carried door the excluded party can reach**, then asked whether the deny survived:

```
AFTER calling every carried door she can reach:
  is_case_excluded      = t     ← the carry CANNOT dissolve the deny
  can_read_case_patient = f     ← Rule 12 holds on the READ side
```

**The carry cannot dissolve the deny. M1's durability purpose is achieved.**

## 5.2 · ⛔ But one carried door leaves a live Rule 12 hole — `dispose_case_phi` (BLOCKING)

**Proven live, rolled back:**

```
actor: excluded=t  can_read_case_patient=f          ← she CANNOT READ the patient identifiers
dispose_case_phi('…e1','entered_in_error') -> SUCCEEDED.  phi_disposed_at=2026-07-15 18:38:49

PHI BEFORE (registry): Paciente
PHI AFTER  the accused disposed it: [PHI removido]   ← irreversible
```

The gate is `is_staff_admin_of OR is_commission_admin_of` with **no exclusion term**. The asymmetry is the
finding: **she cannot read the PHI and can irreversibly destroy it.** In an ethics case, that is the accused
destroying the evidence against her — Rule 12 and Row zero in one call.

**My first probe missed this**, raising `23514` — which I nearly filed as "denied." It was the **reason-code
validation** (`'limpeza'` is not in the allowed set); the **authority gate had already let her through**. A
valid reason walks straight in. *This is the lead's cautionary datum again, in a third costume: an error is
not a denial until you read which error.*

**This is in §W-6's M1·4 scope by D5's own rule** (case-scoped, `case_id` resolvable) — it is out by the
**carry**, not by scoping. And §W-6 M1·4b·2 already named PHI destruction as the priority rationale for
`can_write_attachment` (*"callers include `dispose_attachment_phi` (PHI destruction)"*). That helper **was**
fixed (test 43). Its **case-level twin was not**. Same class, same severity, opposite outcome.

## 5.3 · `get_case_patient` — ✅ **`backend`'s "verified false alarm" is CORRECT**

I was told to scrutinize this, and I did — including a **positive control**, without which the test proves
nothing. With a real patient registered:

```
                        excluded respondent          clean coordinator (control)
get_case_patient   ->   (empty / NULL row)      |    {"mrn": "MRN-SECRET-42",
                                                |     "name": "MARIA DA SILVA PACIENTE",
                                                |     "date_of_birth": "1980-01-01", …}
```

The delegation gate (`get_participant_patient` → `can_read_case_patient`) genuinely works. **Correctly
triaged out. No action.**

*(My own trap, recorded: my first read was "returns 1 row ⇒ LEAK." The row was all-NULLs on a **patientless
case**. Row count is not content, and an empty answer on an empty case proves nothing in either direction.)*

## 5.4 · The `can_read_attachment` "denied for free" closure claim — ✅ **VERIFIED, and non-vacuous**

*"Denied for free via delegation"* is exactly the claim that is comfortable to accept and expensive to get
wrong, so I tested the **argument**, not the code. Stripping the deny from `can_read_action_item` — which
`can_read_attachment`'s `action_item` arm delegates to and which was **never patched directly**:

```
not ok 49 - the deny BEATS the assignees_only arm
not ok 51 - CLOSURE: can_read_attachment's action_item arm is denied FOR FREE
```

**Test 51 goes red.** The closure holds and the test genuinely proves it. The over-reach twin (52) holds too.
The D5 scoping rule (case-scoped + `case_id` resolvable) is a real boundary, not a hand-wave.

## 5.5 · The rest of the carry — authority holes, correctly deferred

Live for the excluded coordinator on her own case, behaviourally confirmed: `update_case_meta`,
`set_case_offered_outcomes`, `recompute_recommendations`, `add_ad_hoc_narrative`. These are **A18/A21
authority** concerns, not durability or PHI-destruction, and they need the resolver and a PO ruling anyway.
**Deferring them is the right call.** `set_case_confidentiality` raised `HC0E5` (unverified — precondition or
gate; treat as unproven, not as safe).

**`backend`'s triage-not-fix framing is right in principle and right on 9 of 10 doors.** A text-filter sweep
would have over-reached, and the `get_case_patient` call is exactly the kind of verified negative that
justifies the posture. It got **one** wrong, and it is the PHI one.

---

# 6 · Required changes

| # | Item | Why | Size |
|---|---|---|---|
| **B1** | **Fix the vacuous keystone** — `229…:321`, delete `st_x`'s self-recusal (or move the M1·3 block above `:310`). Correct the false `(today: f)` / `(today: t)` annotations. | Tests 33 + 34 — the two ⭐ keystones, one of them Rule 12 — **cannot fail**. Proven by mutation. A29's purpose is that keystones stop being vacuous. **§W-6 (b) named the violated precondition verbatim.** | **1 line**, test-only. Verified: 60/60 green **and** falsifiable. |
| **B2** | **Gate `dispose_case_phi`** with `AND NOT app.is_case_excluded(p_case_id, auth.uid())` (`HC0F1`), after the authority check. **Keystone:** the respondent-coordinator's disposal **RAISES** and `phi_disposed_at` **stays null**; **positive twin:** a clean coordinator still disposes. | Proven live: the accused irreversibly destroys the PHI she cannot read. Rule 12. In §W-6's M1·4 scope by D5's rule; the attachment twin was fixed and this was not. | ~4 lines + 2 tests. |

**Not required, but do it while you are in there (m1):** `set_case_confidentiality` returned `HC0E5` — I did
not establish whether that is the gate or a precondition. **Do not record it as safe.** One probe settles it.

---

# 7 · Non-blocking

| # | Item |
|---|---|
| **m1** | **Test 59 (`:582`) is a `prosrc` text filter** (`prosrc ilike '%is_case_excluded%'` = 5). It would pass on a **comment** (V-0.3's exact false-positive mode) and would **false-alarm** if a mutator later moved to `assert_not_case_excluded` — which is how `set_participant_patient` is already gated. It is corroboration only; the behavioural twins carry the weight. Keep it, but note it cannot prove gating. |
| **m2** | **The scope fence (`:592`) covers 4 INVOKER RPCs; §W-6 names 7.** The property holds (catalog: all 16 case-touching INVOKER fns are `prosecdef=f`), but the fence under-covers what it claims to fence. |
| **m3** | `src/lib/participants/actions.ts` is **modified (+40)**, not new — a pure contract stub (`notImplemented`), `strict`-clean, no `any`, no data access, Rule 9/10 respected in the header. `database.ts` genuinely regenerated (`link_state`, `set_professional_link_state`) — Rule 8 ✓. **Independently re-ran the green bar: `tsc --noEmit` clean, `eslint --max-warnings=0` clean.** |
| **m4** | The M1·3 keystone rests on `is_case_excluded`, but **`can_read_case_patient` / `can_read_case` / `can_write_case_content` inline the two arms directly** rather than calling it. Pre-existing, not M1's doing, and not a defect — but it means `is_case_excluded` is **not** a single chokepoint, so a future "fix the union and we're done" would ship with the read predicates untouched. Worth a line in the ADR. |

---

# 8 · My own errors this round — recorded, per the standing rule

The rule on this program is that the author cannot falsify their own claim, and that probes get re-run by
someone who did not write them. **Five of my own readings were wrong before behaviour corrected them:**

1. **`lift_recusal` → `HC0E1`.** Wrong fixture; the probe never reached the gate. "It raised ⇒ it's dead"
   would have been a false pass.
2. **The `org_admin` freeze probe matched 0 rows** — wrong actor uid — and my `display_name` twin reported
   "OK" while quite possibly asserting nothing. **An UPDATE that hits nothing never raises.** Re-ran on
   `row_count`.
3. **Mutation 4 errored on a parameter name, aborting the transaction.** Zero tests ran; my grep for failures
   found none. **"No failures" meant "no tests," not "green."**
4. **I suspected test 54 was vacuous. It is not** — mutation disproved me.
5. **`get_case_patient` "1 row ⇒ PHI LEAK."** It was a NULL row on a patientless case. Needed a real patient
   **and** a positive control.

Every one was caught by asserting behaviour instead of reading it. **That is the method, and it works on the
reviewer too.**

---

# 9 · Recommendation to the lead

**Do not run `e2e:prod` yet — changes land first.** B2 is a migration (a real behaviour change on a PHI
door), so a gate run now would be invalidated. The delta is ~5 lines of SQL, 2 pgTAP tests, and 1 test-file
line; the fix loop is far cheaper than a 20–40 minute suite run twice.

Sequence: **B1 + B2 → re-run `supabase test db` (expect 2599–2601) → re-review (minutes) → `e2e:prod`.**

---

## Summary

| | |
|---|---|
| **Verdict** | ⛔ **CHANGES REQUESTED** — 2 blocking (1 vacuous keystone · 1 live Rule 12 hole), 4 non-blocking |
| **P0s confirmed dead** | **8/8**, behaviourally, on the narrow precondition, rows surviving the denied party |
| **Deviations** | **3/3 verified** — incl. the `record_recusal` self-arm, proven in both directions. `backend`'s judgement was right every time it was contested. |
| **Structural defence (`HC0E4` vs `HC0F1`)** | ✅ **VERIFIED** — dropping the precondition row makes **8 tests fail loudly**. The vacuous keystone is genuinely **unwritable** now. It caught **me**, twice. |
| **Over-reach** | **0** — every positive twin holds; the INVOKER negative holds; scope baselines exact (121/93/42) |
| **Mutation experiments** | **5** — every fix falsifiable except the two named. 21 tests go red when the deny is disabled. |
| **Probes** | **14**, all rolled back; 0 rows leaked, 0 catalog residue (re-verified) |
| **Carry** | Durability **achieved**; `get_case_patient` a **verified** false alarm; closure claim **verified**; **1 door wrong — `dispose_case_phi`** |

**Credit, plainly.** This is the best-defended migration this program has produced. `backend` did the thing
that actually ends the vacuity regress: it made the failure mode **structurally impossible** rather than
merely discouraged — distinct SQLSTATEs with authority first — and that defence caught its own `lift_recusal`
twin, then caught **me** twice inside two hours. It put the linkage invariant in a trigger so it binds direct
DML, not just the polite path. It refused a blanket term on `record_recusal` and was **right**, on reasoning I
tested from both ends. And it verified `get_case_patient` instead of sweeping it — the discipline the carry
was declined on.

**The irony is the finding.** The one keystone that cannot fail is not in the code `backend` reasoned hardest
about — it is in the interaction between two *correct* tests, where a positive twin's side effect quietly ate
the negative twin's precondition 30 lines later. **The fifth vacuous keystone on this program was not written
by a missing check. It was written by a passing test.** §W-6 anticipated it in six words — *"and the
respondent never acts"* — and he acts. That sentence was in the contract; the ordering was not checked
against it.

And the carry's one miss is the same shape as its nine hits: `dispose_case_phi` was triaged by the same
reasoning that correctly cleared `get_case_patient` — except nobody called it. **A door is not cleared until
someone knocks.**

---
---

<a name="re-review--the-b1b2-delta"></a>

# PART II — re-review · the B1 + B2 delta + the mandated mutation audit

**Date:** 2026-07-15 · **Reviewer:** `qa` · **Round 2 (delta only)**
**Method:** unchanged — live catalog + behaviour, rolled back. **`backend`'s harness re-run by me**, per the
standing rule (it wrote it; it has already been wrong twice in ways that hid a real result). Fresh
`db reset --local` + full `supabase test db`. graphify skipped — ratified exception.

# RE-VERDICT: ✅ **APPROVED** — with **one mandatory pre-commit item (M-1), test-only**

**Both my findings are fixed and I re-verified each independently. `backend`'s own audit found two more that
neither of us caught by review — and my "B1 won't be the only one" was right in a way I did not predict: it
is right a *third* time, and the third one is `backend`'s own deviation.**

> **16 is a FLOOR. 17 is the number.** **Deviation #2's door-2 linkage assert is UNASSERTED** —
> `set_case_participant_role` carries `assert_respondent_linkage_resolved` (the re-key-to-respondent bypass
> `backend` correctly added beyond §W-6), and **nothing tests it**. Neuter it and the suite runs **73 tests,
> 0 red** while an `unknown` professional gets seated as `respondent_doctor` — a decorative exclusion, which
> is the exact vacuity B7 exists to prevent. **This is the `can_write_interview` shape, third instance.**
>
> **It does not block the e2e gate.** The fix is **test-only** (one `throws_ok` + one `run_case`) and cannot
> change app behaviour. **Row zero is durable today; no live hole.** The harness `backend` built is itself
> the verification — the new case must print `RED-PROVEN`, making it **17/17**. No further review round.

---

## R-1 · The harness, re-run by someone who didn't write it — ✅ **16/16 reproduces, and RED means RED**

All 16 print `RED-PROVEN` on my run. But the mandate was the harder half: **is `red` a failed keystone, or an
aborted suite?** That is the harness's own self-reported failure mode, so I did not take its word for it — I
counted tests per mutation:

```
BASELINE (no mutation)         tests_run=73   red=0    psql_errors=0   SUITE COMPLETED
M1.3 freeze                    tests_run=73   red=21   psql_errors=0   SUITE COMPLETED
M1.2 lift_recusal              tests_run=73   red=4    psql_errors=0   SUITE COMPLETED
M1.4 dispose_case_phi          tests_run=73   red=4    psql_errors=0   SUITE COMPLETED
M1.4b can_write_interview      tests_run=73   red=2    psql_errors=0   SUITE COMPLETED
M1.4b can_read_action_item     tests_run=73   red=2    psql_errors=0   SUITE COMPLETED
```

**Every mutation completes the full suite with zero psql errors.** No abort masquerades as a red. The
RED/GREEN/**ABSENT** trichotomy is honest, label-matching defeats the stale-number bug, and the ASCII-pattern
fix holds. **The harness under-claims its own coverage** — its `dispose_case_phi` case names one pattern but
actually turns **4** tests red (65 the-gate-not-the-reason-code, 66 identifiers-survive, 67
not-marked-disposed, 68 the positive twin). Under-claiming is the safe direction.

**On `_mut_revert`'s `pg_get_functiondef` + `replace` + `execute`:** this is the pattern that produced a
confident false P0 on this repo. It is **legitimate here** (a throwaway harness, not a migration) and it
**fails safe**: if the replace string doesn't match, the body is rewritten unchanged and the keystone stays
GREEN → reported `NOT PROVEN`. I verified the substitution is real rather than assuming it (§R-4).

## R-2 · B1 — ✅ **the fix is REAL, not relocated**

Measured at the M1·3 keystones themselves, not from the guard's label:

```
respondent arm  : true      ← the arm M1·3 actually guards
recusal arm     : false     ← the contamination is GONE
is_case_excluded: true      ← via the RESPONDENT ARM ALONE
st_x staff_admin: true      ← the C1a precondition still intact
stray recusals  : 0
```

Both guards bind, and the decisive proof is the harness: reverting M1·3's freeze now turns **both** `an
org_admin CANNOT re-key` **and** `PHI door stays SHUT` **RED**. Before, both stayed green while the hole was
open. **The Rule 12 keystone can now fail.** `backend` also added the guard I did not ask for — asserting
`is_case_excluded = true` alongside `is_recused_from_case = false`, which is what makes the fix
regression-proof rather than merely correct today.

## R-3 · B2 — ✅ **CONFIRMED DEAD, both directions**, on my own seed probe

The *identical probe* that proved the hole in round 1 now returns the deny:

```
actor: excluded=t  can_read_case_patient=f
dispose_case_phi(VALID reason 'entered_in_error') BY THE ACCUSED -> raised HC0F1
      (round 1: SUCCEEDED · phi_disposed_at set · PHI -> '[PHI removido]')

chefe.ccih excluded=f  (clean coordinator)
dispose_case_phi('retention_expired')            -> SUCCEEDED   ← lawful disposal intact, no over-reach
```

My reason-code warning is built into the keystone (valid reason, behavioural assertion on the identifiers,
`phi_disposed_at` stays null) — so the test cannot pass on the reason-code check the way my first probe did.

## R-4 · ⛔ **Is 16 the population, or a floor?** — **A FLOOR. The answer is 17.**

I refused to let the mutation-proof count become the sixth floor, so I derived the population from the
catalog rather than from the harness. **16 functions carry an M1 deny term.** Three have no mutation case —
`can_reach_case_on_member_surface`, `delete_ad_hoc_case_narrative`, `delete_ad_hoc_case_phase` — and all three
are **pre-existing gates, not M1 fixes** (A0 v1 recorded the already-gated set; M1's two migrations mention
them **0 times**). **The harness's population is correct.**

**But one M1 fix has no keystone at all.** The suite contains **exactly one** `HC0F0` assertion (`:126` —
door 1, `add_case_participant`). Yet the catalog says:

```
add_case_participant       -> assert_respondent_linkage_resolved: true
set_case_participant_role  -> assert_respondent_linkage_resolved: true   ← deviation #2's fix. UNTESTED.
```

**Surgical proof** — neuter *only* that assert (exclusion deny left intact, so no fixture cascade; any red
would be the linkage check alone):

```
replace CHANGES the body: t        ← the mutation is REAL, not a silent no-op
DOOR 2 with assert neutered -> SUCCEEDED   ← an UNRESOLVED professional seated as respondent_doctor
tests_run = 73   red = 0   psql_errors = 0 ← and NOTHING went red
```

Remove deviation #2 and the suite is silent. The consequence is precisely B7's raison d'etre: an `unknown`
profile seated as `respondent_doctor` ⇒ `is_case_respondent` never resolves ⇒ **the exclusion is decorative
and every downstream keystone is vacuous.** The code is right — I verified `DOOR2 → HC0F0` behaviourally in
both rounds — but **an unasserted fix is indistinguishable from no fix**, which is `backend`'s own sentence,
earned this round on `can_write_interview`.

**Why this one hid:** it is a **deviation** — an addition beyond §W-6. Nothing in the contract documents
demands it, so no keystone was owed for it, and no reader has a reason to keep it. **Un-keystoned deviations
are the most fragile artifacts on a program like this**, because they are exactly the code a future refactor
has no argument against deleting.

### M-1 (mandatory, pre-commit, test-only, no re-review)

```sql
-- door 2: re-keying TO respondent_doctor must reject an `unknown` linkage, exactly as door 1 does.
select throws_ok( $$ select public.set_case_participant_role(<cp_on_benign_role>, <respondent_role_id>) $$,
  'HC0F0', null,
  'M1·1 KEYSTONE (door 2): an `unknown` profile cannot be RE-KEYED to respondent_doctor (deviation #2)');
```

plus one harness line, which **must** print `RED-PROVEN`:

```bash
run_case "M1·1 B7 attach (set_case_p_role)" \
  "select app._mut_revert('public.set_case_participant_role(uuid,uuid)');" \
  "cannot be RE-KEYED to respondent_doctor"
```

⚠ `_mut_revert` reverts the exclusion deny **and** the linkage assert together, which cascades 24 tests.
Either neuter the linkage assert alone (as I did), or accept the cascade and keep the pattern narrow.

## R-5 · The A22 re-shape — ✅ **no over-reach; the shape is GENUINELY REACHABLE**

The trap I was asked to check is real: a keystone re-pointed at a shape users never create is vacuous *in the
other direction*. It isn't. **The real product door**, not the fixture:

```
create_committee_action_item(commission,'manual',null,null, p_case_id=<case>, …, 'assignees_only')
  -> source_type=manual | has_case_crosslink=t | has_source_case=f | visibility_scope=assignees_only  ✅
```

That is **exactly** the keystone's fixture shape, and it is the **ADR 0050 Cross-Link feature** — a manual
action item cross-linked to a case. The CHECK permits it (`source_type='manual'` leaves `case_id`
unconstrained) and `guard_action_item` force-rewrites only `source_type='case'`. **Genuinely reachable, not
synthetic.**

**And the control confirms `backend`'s diagnosis of the second vacuity instance, exactly:**

```
create_committee_action_item(…,'case',…, 'assignees_only')
  -> source_type=case | has_case_crosslink=f | visibility_scope=case_restricted   ← HARD-FORCED
```

The old fixture silently became `case_restricted`, whose arm delegates to `can_read_case` — **which carried
the deny before M1**. Both tests were proving a pre-existing deny. `backend`'s finding is confirmed on the
catalog, and the `B1-SHAPE GUARD` (asserting the row *is* `assignees_only`) is the right generalization of my
B1 lesson: **assert the fixture is the shape under test.**

## R-6 · The gate — ✅ **independently confirmed**

```
supabase db reset --local   -> exit 0
supabase test db --local    -> All tests successful.  Files=92, Tests=2610.  Result: PASS   (exit 0)

mutation stubs in catalog (precise pattern ^_mut) : 0
migrations                                        : 112
SCOPE: case_access_grants / resolver fns          : 0 / 0
SCOPE A21: is_commission_admin_of  121 fns / 93 policies   ← baselines UNCHANGED
SCOPE A30: is_admin() sites 42                            ← baseline UNCHANGED
INVOKER fence: the 4 RPCs still prosecdef=f (0 DEFINER)
```

**2610/2610 on a fresh reset. 0 stubs. Scope fence exact.** `tsc --noEmit` clean · `eslint --max-warnings=0`
clean. B2 landed in the **uncommitted** migrations, so there is no migration-history problem.

---

# The three questions, answered plainly

**1 · Is M1's purpose achieved — are the keystones non-vacuous, and is Row zero durable?**

**YES to both.**

- **Row zero is durable.** 8/8 P0s dead across two rounds, on the narrow precondition, rows surviving the
  denied party. The deny cannot be dissolved by any door — mutators, the 6th table, the linkage, the attach
  paths, or anything in the carry (I called every carried door the excluded party can reach; `is_case_excluded`
  stayed `t`, `can_read_case_patient` stayed `f`).
- **The keystones are non-vacuous.** 16/16 mutation-proven, re-run by me, with `red ≠ abort` verified. Three
  vacuity instances existed; three are fixed. The remaining gap is an **unasserted fix**, not a vacuous
  assertion and not a hole.

**2 · Should the lead run the full `e2e:prod` gate now?**

**YES — run it now.** M-1 is **test-only** (one pgTAP assertion + one harness line); it cannot change app
behaviour, so it cannot invalidate the run. This is the opposite of round 1, where B2 was a migration and I
held the gate. Run e2e and land M-1 in parallel.

**3 · What must be in the next migration, and what is the carry?**

**Next migration — nothing is forced by this review.** M-1 is test-only. Then, in priority order:

| Item | Why it waits |
|---|---|
| **`set_case_confidentiality`** — returned `HC0E5`; **I never established whether that is the gate or a precondition.** | ⚠ **Must be settled, not assumed.** It is the one carried door whose status is *unknown* rather than *known-open*. Recorded as unverified in round 1 and still unverified. One probe. |
| **The authority carry** — `update_case_meta` · `set_case_offered_outcomes` · `recompute_recommendations` · `add_ad_hoc_narrative` · `create_interview` · `notify_safety_event` · `set_case_patient` | Live for the excluded coordinator **on her own case**, but they cannot dissolve the deny (proven). A18/A21 authority territory — needs the resolver and a PO ruling. Correctly deferred. |
| **M1·5 / A30** | Still **blocked** pending the exhaustive `is_admin()` enumeration (42 sites) + PO ruling. Unchanged. |
| **Round-1 minors m1/m2** | Test 59's `prosrc` text filter (would pass on a comment); the scope fence covers 4 of §W-6's 7 INVOKER. Neither is load-bearing. |

**`get_case_patient` stays closed** — a verified false alarm, proven with a positive control. No action, ever,
unless its delegation changes.

---

# My own errors this round — recorded, per the standing rule

**Three, and the second is the one that matters:**

1. **I reported "3 `_mut_` stubs leaked"** against a report that said none. My pattern `%_mut_%` matched
   **"im`mut`able"**. `backend` was right; I was wrong, and I was wrong in the accusatory direction.
2. ⛔ **My door-2 verification printed `tests_run=0` because my count regex had an unbalanced paren — and I
   nearly filed "NOTHING WENT RED" as evidence when the suite might never have run.** That is *precisely* the
   false-`NOT-FALSIFIABLE` that `backend`'s harness self-reported, reproduced by the reviewer auditing it, in
   the same hour, while looking straight at it. I caught it, recounted (**73 run, 0 red**), and the finding
   survived — **but it survived because I checked, not because I was careful.**
3. **My reachability probe assumed `create_committee_action_item` returns a `uuid`.** It returns a record.

**The lesson, and it is the program's:** *"0 failures" is never evidence until you have proven the tests ran.*
That sentence has now cost `backend` a round and cost me an hour, on the same day, from opposite sides of the
same audit. It belongs in the harness header — where `backend` already put it.

---

## Summary — round 2

| | |
|---|---|
| **Re-verdict** | ✅ **APPROVED** · 1 mandatory pre-commit item (**M-1**, test-only) · **e2e gate RELEASED** |
| **B1** | ✅ Fixed and **real, not relocated** — respondent arm **alone**; the Rule 12 keystone can now fail |
| **B2** | ✅ **CONFIRMED DEAD** both directions on my own probe — `HC0F1` on a **valid** reason; lawful disposal intact |
| **Harness** | ✅ **16/16 re-run by me** · **`red` ≠ `abort` verified** (73 tests, 0 psql errors, every case) |
| **Is 16 the population?** | ⛔ **A FLOOR — 17.** Deviation #2's door-2 linkage assert is **unasserted** (proven: body changes, bypass goes live, 0 red) |
| **A22 re-shape** | ✅ **Genuinely reachable** via the real product door (ADR 0050 Cross-Link) — no over-reach in either direction |
| **Gate** | ✅ **2610/2610** fresh reset · 0 stubs · scope exact (121/93/42) · tsc + lint clean |
| **My errors** | **3** — incl. reproducing the exact false-`NOT-PROVEN` I was auditing for |

**Why this closes.** Round 1 found that the code was right and the test was not. Round 2 finds the same shape
a third time — and the difference is that **the program can now see it**. `backend` built the instrument that
makes vacuity visible, and then that instrument immediately convicted **two of its own tests** (`A22`/`CLOSURE`
proving a *pre-existing* deny; `can_write_interview` proving nothing at all). That is what a working control
looks like: it indicts its author first.

The residual is small and honest. **M1 does what it set out to do: Row zero is durable, and the exclusion
keystones can fail.** The one fix still standing unguarded is `backend`'s own deviation — the thing it added
because it saw a hole §W-6 missed. **It was right to add it, and it is the only fix nobody was owed a test
for.** That is not carelessness; it is the predictable blind spot of doing more than the contract asked. The
contract should have grown with it, and now it will — a `run_case` that prints `RED-PROVEN`, and the count
becomes **17/17**.

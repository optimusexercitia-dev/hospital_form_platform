# QA Review — ADR 0078 Stage A · A2, the capability resolver

**Commit:** `14529f0` (reviewed at HEAD `864024e`) · **Reviewer:** `qa` · **Date:** 2026-07-16
**Verdict:** ✅ **APPROVED**

**No P0. No MAJOR against the unit as scoped.** One MAJOR is filed **against A5's brief**, not
against A2. Three rounds running, `qa` found a real P0; this round did not. §6 states exactly what
I probed and **what my probes could not see** — read it before treating this approval as coverage.

**Method:** live catalog only (`pg_proc` incl. `prosecdef`, `pg_policies`, ACLs). Every `prosrc`
probe comment-stripped; every zero-returning probe carried a control. One probe of mine **was
blind and I caught it** — see §6·b. Where I mutated state (the `case_access` flag) I rolled back
**and asserted the restore**.

---

## 1. Environment — verified independently, not taken from the report

| Check | Expected | Read |
|---|---|---|
| migration files = registered | 119 = 119 | **119 = 119** ✅ |
| `case_access` / `case_referrals` | `t` / `t` | **`t` / `t`** ✅ (the `enabled` column, not the description) |

⚠ `app.feature_flags`' key column is **`key`, not `name`** — my first probe errored rather than
returning a false zero. Noting it so the next auditor doesn't write `where name =` and read `0 rows`
as "flag absent."

---

## 2. The claims, attacked

### 2.1 ⭐ `LOST = 0 / GAINED = 0` over 1568 cells, 369 reachable — **denominator independently reproduced**

The denominator is the point (§7.10): an all-`f` matrix shows LOST = 0 vacuously. I wrote my own
matrix (not theirs), flipping the flag inside a transaction:

```sql
create temp view m as
select c.id cid, u.id uid,
       app.can_read_case(c.id,u.id) rc, app.can_read_case_patient(c.id,u.id) rcp,
       app.can_write_case_content(c.id,u.id) wcc,
       app.can_reach_case_on_member_surface(c.id,u.id) ms
from public.cases c cross join auth.users u;
-- then: count(*) filter (where …) per predicate, at flag ON and (in a rolled-back txn) OFF
```

| State | `can_read_case` | `can_read_case_patient` | `can_write_case_content` | `member_surface` | total |
|---|---|---|---|---|---|
| flag **ON** | 50 | **27** | 8 | 74 | **159** |
| flag **OFF** | 74 | **54** | 8 | 74 | **210** |

**159 + 210 = 369 reachable of 1568.** Exact match to the claim, measured independently.
7 cases × 28 users × 4 predicates × 2 flag states = 1568 — the arithmetic closes.

Three inline claims in the migration also verified independently, **and each is the kind that has
been false on this program**:
- flag-OFF **doubles PHI reach, 27 → 54** — true. The `case_access_flag_off_legacy` arm really does
  hand a plain member patient identifiers. Naming it "PHI" rather than "content fallback" is correct.
- **WCC = 8 at both flag states** — true. The S3w write-grant arm's placement *outside* the flag
  branch is load-bearing; inside it, 8 cells would be lost at flag-OFF.
- `can_read_case` **50 → 74** — true.

**Restore asserted:** `case_access = t` after rollback. ✅

⛔ **What this does NOT prove — stated plainly.** I reproduced the **denominator**, not the **diff**.
See §6·a.

### 2.2 The six-step order and the hard deny — **holds in the live body**

`app._case_caps` (`prosecdef = t`, `STABLE`, `search_path` pinned): step 1 null → 0 · step 2
`is_active` outer gate · step 3 tenant anchor, unknown case **fails closed** · step 4 **hard deny
(`is_case_respondent` then `is_recused_from_case`) BEFORE every positive arm** · step 5 the union ·
step 6 return. **There is no lifecycle step** (A24·3) — verified absent, not assumed.

Every arm is computed **inside the DEFINER over base tables** (`public.cases`, `case_referral`,
`case_access`, `case_phases`, `case_narratives`) — no RLS-gated read, so R6 holds and it cannot
recurse.

### 2.3 The lattice is asserted, never imposed — **confirmed**

`app._cap_bit` is a flat `case` → power-of-two mapping; `has_case_capability` is
`(_case_caps(...) & bit) <> 0`. **There is no closure logic anywhere**, so no rung can be widened
by implication. `read_case_deliberation ⇏ view_case_overview` and `read_case_content ⇏
read_standard_phi` break because nothing joins them — which is the correct construction.

`has_case_capability` **raises `HC0A2` on an unknown capability name** rather than resolving to a
silent `false`. That is the right failure direction and 234 pins it.

### 2.4 `read_standard_phi` is CONSUMED — the A36 blocker is cleared

`can_read_case_patient` projects `read_standard_phi`, and its consumers are three DEFINER bodies
(`app._audit_access_authorized`, `public.get_case_patients`, `public.get_participant_patient`) —
**verified in the catalog, comment-stripped, with a control**. `view_case_overview` (bit 1),
`read_restricted_phi` (16) and `manage_case_access` (64) ship RESERVED/unconsumed **as specified**.
The unfalsifiable-PHI-bit condition that blocked the original A2 is genuinely gone.

### 2.5 ACLs / `prosecdef` — clean

```
_case_caps          | prosecdef=t | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
has_case_capability | prosecdef=t | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
case_capabilities   | prosecdef=t | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
**No `PUBLIC` on any entry.** The migration `REVOKE ALL … FROM PUBLIC` **before** `GRANT` on all
four new functions — the t19 pgTAP guard's requirement, met. `app.case_capabilities` (jsonb, debug)
is not PostgREST-reachable: PostgREST serves `public`, this is `app`.

### 2.6 A2 changed nothing outside its four predicates — **confirmed two ways**

Live consumers of the resolver, comment-stripped:

```sql
with b as (select p.oid, n.nspname, p.proname, p.prosecdef,
                  regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
           from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname in ('app','public'))
select nspname, proname, prosecdef from b
where src ~ '\yhas_case_capability\y' or src ~ '\y_case_caps\y';
```
→ **exactly 6**: the 4 projections + `has_case_capability` + `case_capabilities`. Nothing else.
The migration's own surface is the same 8 functions. `public.case_viewer_capabilities` is a
pre-existing CAPA-era function, untouched — a name collision, not a consumer.

---

## 3. ⭐ The 230/231 edits — the lead's #1 risk. **The approval was correct.**

An engineer edited two other units' keystones so his own change would pass. I tried to break that.

**Is defect ① (assignment ⇏ PHI) still guarded BEHAVIOURALLY? YES — and the guard is real.**

`230` t23/t24 are now near-vacuous, **as F4 admits** — the bodies are thin projections that name no
table, so the regexes pass by construction. But they were **repointed at `_case_caps`, not deleted**,
and the load-bearing evidence moved to behaviour:

- **234 K5** — `can_read_case(st_x2) = true` (assignment KEEPS content) **and**
  `can_read_case_patient(st_x2) = false` (gains NO PHI), plus a **rows** leg.
- **Mutation `assignment_confers_phi`** re-adds the arm M3 deleted → **K5 goes RED**. I ran it. ✅

**M3's guarantee is falsifiable. It is not unfalsifiable. No P0 here.**

**231's `+1` is a genuine strengthening.** The three structural regexes were weakened to
`is_active|has_case_capability` (satisfiable by delegation alone — §7.9's exact shape), but the
same diff adds the assertion that the delegation **terminates**: `_case_caps ~ 'is_active'`,
comment-stripped. Without it, "delegates to `has_case_capability`" would be satisfied by a resolver
that never gates. See MINOR-1 for the residual.

---

## 4. ⭐ K9 and K1 — are they real NOW, and are there others of the same shape?

**That question was the review. I ran it to ground.**

Both keystones were repointed off `public.cases` (2 permissive policies, one `FOR ALL`) onto
`case_participants`. The repoint is only worth the door it lands on:

```sql
select policyname, cmd, permissive, qual from pg_policies
where schemaname='public' and tablename='case_participants';
```
→ **exactly one policy**: `case_participants_select | SELECT | PERMISSIVE | app.can_read_case(case_id, auth.uid())`

**A pure projection of the resolver, and the only one.** K1's positive (`count = 1`) and K9's
negative (`count = 0`) both genuinely measure `_case_caps`. **The lead was right.**

### The sweep for others of the same shape — every ROWS door in 234, checked

| Keystone | Door | Resolver-gated? | Verdict |
|---|---|---|---|
| K1, K9 | `case_participants` | `can_read_case` — sole policy | ✅ real |
| K8 pos. | `meeting_cases` | `meeting_cases_select` → `can_reach_case_on_member_surface` | ✅ real |
| K8 neg. | `cases`, `case_narratives` | `can_read_case_or_admin` → `can_read_case` | ✅ real |
| **K6** | `case_events` INSERT → `42501` | see below | ✅ real |
| K1, K5, K12 | `get_case_patient` | see below | ✅ real |

**K6 was the strongest remaining vacuity candidate** — a *negative* (`42501`) is satisfied by any
rejection, including one for the wrong reason. `case_events` has three policies; the two write arms
are `case_events_staff_admin_write` (`is_staff_admin_of OR is_commission_admin_of` — `st_x2` is
neither) and **`case_events_writer_write`, gated on `can_write_case_content`** — the resolver. So
the only arm that *could* admit him is the resolver's, and the `assignment_confers_write` mutation
turns K6 **RED**. Not vacuous. And the SQLSTATE is pinned to `42501` rather than `null`, which
already caught the author's own `42703` — the §7.1 structural defence working as designed.

**`get_case_patient` — I found a real subtlety here and it resolves in A2's favour.** The door
itself carries **no `can_` call at all** (control-verified: the string appears in all three
siblings). It is a lookup wrapper that delegates to `get_participant_patient`, which **does** gate
on `can_read_case_patient` → the resolver. It returns `null` in two cases: *no patient participant*
**or** *denied*. That is exactly §7.1 trap #3's shape — K5's `is null` could be a dead fixture.

**It isn't, and the file self-verifies:** K1 reads `MRN-A2-001` through the **same door on the same
case `c1`**, proving the patient participant exists. So K5's `null` on `c1` **must** be the denial.
Airtight by construction, not by luck.

### The cascade check the lead asked for — no mutation goes RED for a harness reason

The PRELUDE injects at `grant select on k to authenticated;` (line 56) — **before** the fixture
(line 77+). So `drop_coordinator` is live when `set_participant_patient` runs **as sa_x**. If that
door gated on the coordinator *source*, K1's RED would be a dead PHI fixture, not its own gate.

**Probed:** `set_participant_patient` is `prosecdef = t` and gates on **`is_staff_admin_of`
directly** — it never touches the resolver. Dropping the coordinator source cannot kill the
fixture. **K1's RED is its own gate.** And a mutation that *did* abort the fixture would print
`ABSENT(aborted)`, not RED — the tri-state forecloses the false green (§7.1's `red ≠ abort`).

---

## 5. Mutation audit — reproduced independently: **12/12 RED-PROVEN, control green (61 ran)**

I ran `supabase/tests/mutation/a2-mutation-audit.sh` myself. All twelve RED-PROVEN; control
**all green (61 tests ran)** — so the tests are proven to have **RUN**, not merely to have not failed.

**The harness fails in the safe direction, which I checked rather than assumed:** every mutation is
a `replace()` on the body re-emitted from **live `pg_get_functiondef`**. A pattern that fails to
match leaves `d` unchanged → the function is re-emitted identical → the keystone stays **GREEN** →
the harness prints **NOT PROVEN**. A silent no-match therefore cannot manufacture a RED. All twelve
reading RED-PROVEN is itself proof that every `replace` landed.

Harness quality worth recording: label-matching (not test numbers), ASCII-only patterns, portable
`head`/`tail` (not BSD-awk-fatal `-v`), tri-state, pgTAP preflight + `trap cleanup EXIT` that
restores the extension state. This is the best harness on the program.

---

## 6. ⛔ WHAT I PROBED AND WHAT MY PROBES COULD NOT SEE

Per the brief, this section is the most important one.

**a. I did NOT independently reproduce `LOST = 0 / GAINED = 0` as a diff. I reproduced its
denominator.** To diff I need the **pre-A2 bodies**, and they are **not recoverable from file text**:
`can_read_case` (among others) was **rewritten at runtime by M5b** via `pg_get_functiondef()` +
`replace()` + `execute`. Reconstructing the pre-image needs a DB at `14529f0^` — i.e. a reset, which
I do not own. **So my probes cannot see a faithfulness error that moved a cell and moved it back**,
nor one that A2's own matrix script shares a bug with.

What I have instead is **three independent corroborations, none conclusive**:
1. My matrix's flag-ON PHI reach is **27** — and §7.7's record of **M3's post-fix figure is 27**
   ("PHI readers 30 → 27"). A2 preserved it. ⚠ **This is corroboration, not proof, and I am
   flagging the arrow rather than asserting it (§7.11):** I did not verify M3's matrix used this
   same 196-cell population. If it did, A2 moved no PHI cell.
2. 12/12 mutation-proven arms — every source is load-bearing.
3. 61 keystones green with paired positive/negative twins.

**A residual faithfulness error is not excluded by my review.** The A/B matrix remains
`backend`'s evidence, re-run by the lead, not by me.

**b. One of my own probes was blind, and I report it against my own method.** I probed
`get_case_patient` with `\ycan_read_case\y` and read `false` — but `\y` is a word boundary, so that
pattern **cannot match `can_read_case_patient`**. A real gate would have read as absent. The control
column (`src ~ 'can_'`) is what exposed it. **§7.9's lesson in my own hands: a wrong regex invents
findings as readily as it hides them.** Every conclusion in §4 was re-derived after the fix.

**c. Not probed:** the e2e/product surface (forbidden — the gate corrupts the shared DB and exits 0
on RED); remote (out of scope); A5's `EXPLAIN (ANALYZE, BUFFERS)` on realistic row counts (§7,
MAJOR-1); `grant_case_access`'s blast radius beyond re-confirming the stated bound.

**d. On `grant_case_access` (open item, out of scope):** I did not re-litigate it. I found **no
evidence its blast radius is wider than recorded** — the hard deny is in the resolver at step 4
before every positive arm (K9, mutation-proven), so the recused coordinator still cannot grant reach
to herself or the respondent, and `K7` confirms a `case_access` row confers `read_standard_phi`
today exactly as the item states. **Nothing to escalate.**

---

## 7. Findings

### MAJOR-1 — *against A5's brief, not against A2*: the per-row cost claim is **unmeasured, and the structure argues against it**

ADR/handoff §4: *"the bitmask core exists to hold per-row cost at today's `can_read_case` level —
**prove it with `EXPLAIN (ANALYZE, BUFFERS)`, don't assume it**."* **A2 ships no such evidence**, and
two structural properties of the live body cut the wrong way:

1. **`_case_caps` has no short-circuit.** It computes `v_coord`, `v_orgadmin` **and** `v_member`
   unconditionally (three role lookups), plus up to four `EXISTS` subqueries — *every call, for
   every principal*. A coordinator, who under an `OR`-chained body would resolve on the first arm,
   now pays for all of them.
2. **`has_case_capability` re-runs the whole resolver per bit test.** `STABLE` is not memoized
   across rows. Testing two capabilities on one row = two full resolver evaluations.

Measured on the live catalog (196 evaluations each):

| Probe | Time | Per row |
|---|---|---|
| `app._case_caps` × 196 | **106.9 ms** | ~0.55 ms |
| `app.is_staff_admin_of_for` × 196 (single arm) | **10.6 ms** | ~0.054 ms |
| `can_read_case OR can_read_case_patient` × 196 | **126.5 ms** | ~0.65 ms |

**The resolver is ~10× a single-arm lookup per row.** `case_participants` alone plans at
`rows=520`; A4 repoints *~12 tables* onto this. ⚠ **I am NOT calling this a regression** — I cannot
measure pre-A2 `can_read_case` (§6·a), and A5 is the gate, not me. **Filed so A5 measures the right
thing:** the comparison must be *old body vs. resolver on realistic row counts*, and the
no-short-circuit property is the specific thing to measure. Raising `procost` (currently the default
`100` on all three) may also matter to the planner.

### MINOR-1 — `231`'s termination assertion is a string match, not a position match

`_case_caps ~ 'is_active'` (comment-stripped) proves the token is **in the body**, not that it is
**in the gating position** — §7.9's exact shape (`is_staff_admin_of_for` appeared in a *display
chip*, never in a `WHERE`, and **three** independent text sweeps called it gated).

**Mitigated, not open:** `231`'s behavioural tests and **234 K10** cover it — K10 asserts the
grantee reaches PHI while active (**the reading MOVES**, §7.10), resolves to **0 caps** when
deactivated, and **is restored** on reactivation (proving it reads current state, not a one-way
latch) — and `drop_outer_gate` turns K10 **RED**. The behavioural guard is real; the regex is a
convenience. **Recorded so nobody later mistakes the regex for the guarantee.**

### INFO-1 — `get_case_patient` conflates "no patient" with "denied"

It returns `null` both when no patient participant exists and when `get_participant_patient` denies.
Harmless here (K1 disambiguates for `c1` — §4), and it is not A2's function. But **any future
keystone asserting `get_case_patient(...) is null` as a denial is vacuous unless a sibling proves
the participant exists on that case.** Worth a comment on the function at the next opportunity.

### INFO-2 — the F-list is not worse than stated

- **F1** (`can_read_case_or_admin` is a second hard-deny body): confirmed — it carries its own
  `NOT is_case_excluded` and does **not** delegate to the resolver. Exactly as recorded; A4 dissolves it.
- **F2** (removing the org source ⇏ removing org-admin read): confirmed on the doors I touched —
  `case_events_staff_admin_write` and `meeting_cases_staff_admin_write` are `FOR ALL` PERMISSIVE
  with `is_commission_admin_of` arms that never touch the resolver. **A4 must narrow policies.**
  I did **not** re-derive the 36 and I endorse the report's refusal to treat it as a fix list —
  keystone 23 fails if the negatives over-reach.
- **F4** (arm→bit not text-separable): confirmed and correctly annotated rather than hidden. §3.
- **The flag-OFF legacy arm**: correctly carried, correctly *named as PHI*, and **K12 is the first
  thing on this program to pin it**. Carrying it is right.

---

## 8. Why this is APPROVED

A2 is a mechanism swap that behaves like one. The hard deny precedes every positive arm; the
denominator is real and I reproduced it exactly; every source is mutation-proven load-bearing; the
`read_standard_phi` bit is consumed, so A36's blocker is cleared; the ACLs carry no `PUBLIC`; and
the two keystones the author's own audit caught asserting nothing are **real now** — I verified the
doors they were repointed onto, and swept for others of the same shape and found none.

Three things raise my confidence above the file text: the author **found and reported two vacuous
keystones of his own** (§7.1's behaviour, unprompted); the migration **names the flag-OFF arm as
PHI** rather than as a content fallback, in the *urgency-raising* direction that this program has
repeatedly failed in the opposite one; and **K11** pins a rung (coordinator ⇏ `read_restricted_phi`)
that no keystone caught before and that nobody was owed.

**The honest limit of this approval is §6·a: I verified the denominator, not the diff.**

---

### Verdict row for PROGRESS.md (lead applies — `qa` does not edit PROGRESS.md)

| Unit | Reviewer | Verdict | Notes |
|---|---|---|---|
| **A2** — capability resolver (`14529f0`) | `qa` | ✅ **APPROVED** | No P0. Denominator (369/1568) independently reproduced at both flag states; mutation 12/12 re-run RED-PROVEN, control green (61 ran); K1/K9 repoints verified real (`case_participants` has one policy = `can_read_case`); defect ① behaviourally guarded (K5, mutation-proven). **MAJOR-1 → A5: per-row cost unmeasured; the resolver has no short-circuit (~10× a single arm, 0.55 ms/row).** MINOR-1: `231` termination assertion is a string match (mitigated by K10). ⛔ **Diff not independently reproduced — pre-A2 bodies unrecoverable (M5b runtime rewrite); denominator verified, diff not.** |

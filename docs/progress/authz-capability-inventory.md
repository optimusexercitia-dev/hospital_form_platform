# Stage A0 — Authorization capability model: catalog-driven inventory

**Date:** 2026-07-15 · **Author:** `backend` · **Version:** **v3** (final A0 round)
**Status:** 🟡 **A0 CLOSED — awaiting lead + `qa` sign-off. No SQL authored. M1 NOT started.**
**Program:** ADR [0078](../decisions/0078-authorization-capability-model.md) (+ Amendments 1–3, A27/A29/A30) ·
Plan [`docs/plans/authorization-capability-model.md`](../plans/authorization-capability-model.md) §A0 ·
Review [`docs/reviews/authz-a0-inventory-review.md`](../reviews/authz-a0-inventory-review.md)

---

# CHANGELOG — v2 → v3

| # | Change | Source | Verdict |
|---|---|---|---|
| **D1** | ⛔ **BLOCKER ACCEPTED — `case_participant_roles` is the 6th exclusion-plane table.** C8's three legs hold; **its scope was wrong.** Reproduced live. **My error is worse than `qa` states — D1a.** | `qa` V-3 | ✅ **CONFIRMED** |
| **D1a** | **My v2 sweep was wrong in *two* directions:** I omitted `case_participant_roles` **and** included `case_conflict_declarations`, which **the deny does not read**. The errors cancelled — **"five tables" matched the true cardinality by coincidence**, which is exactly why it looked complete. §1.1 | **`backend` (new)** | — |
| **D2** | ⚠ **`qa`'s PROBE 4 over-states the PHI consequence — C1a's lesson, 4th occurrence, now inside `qa`'s own blocker.** Re-keying alone leaves `can_read_case_patient` **`f`** (proven f→f). PHI needs the respondent to hold a **positive arm**. | **`backend` (new)** | ⚠ **`qa` OVER-STATED** |
| **D2a** | **…but composed, the finding is WORSE than `qa` framed it:** an **`org_admin`** dissolves the deny **unaudited** (161→161) and **the respondent never acts**. `remove_case_participant` at least emits an audit row; this path emits none. | **`backend` (new)** | ⚠ **stronger than `qa`** |
| **D3** | ⛔ **The mandate's prescribed method is unachievable. `pg_depend` CANNOT build the call graph:** **0 of 660** functions have a parsed `prosqlbody`; only **5** fn→fn edges exist catalog-wide. Postgres never parses string-literal bodies into dependencies. §7·Q16 | **`backend` — disagreement with the mandate** | ⚠ **instruction unachievable** |
| **D4** | ⛔ **"Is 49 the population?" — NO, and *no caller enumeration can ever be one*.** Closure over `prosrc`: **310 reachable / 158 wrapper-only / 57 DEFINER candidates**. But I **caught my own false alarms** in that 57 — proving the caller set is **not closable by text**. `qa`'s "10" is also a floor. | `qa` V-4 + **`backend`** | ⚠ **`qa`'s 10 is a floor** |
| **D5** | ⭐ **NEW — the closable frame: the GATE-HELPER set.** 16 helpers; **only 5 carry the deny; 11 do not**, with **48 callers**. Fix the helpers → every caller is fixed for free. Generalizes `qa`'s `can_write_attachment` insight from **1 helper to 11** and **ends the floor regress**. | **`backend` (new)** | ⭐ |
| **D6** | ⭐ **NEW — `can_write_case_narrative` carries `is_staff_admin_of` and NO deny** (`save_narrative_body`'s authority). **A recused coordinator writes narrative bodies** — PHI-bearing free text. | **`backend` (new)** | ⭐ |
| **D7** | **`can_write_attachment` REMOVE-ARM → FIX.** The C2 defect at the helper layer; callers include **`dispose_attachment_phi`** (PHI destruction). **Accepted; v2 was wrong.** | `qa` V-4 | ✅ **CONFIRMED** |
| **D8** | **`is_admin()`'s JWT claim re-worded** — a **server-minted cache** (`custom_access_token_hook`, ADR 0002), **not** forgeable. Residual = **staleness** only. **Accepted; v2's tone was wrong.** | lead | ✅ **CONFIRMED** |
| **D9** | **`lift_recusal` severity corrected** — it flips `can_read_case_patient` too. The respondent arm is **NOT "strictly worse"**; **both arms are Rule 12 doors**. **Accepted; v1 and v2 both under-stated it.** | `qa` V-1.1 | ✅ **CONFIRMED** |
| **D10** | **A30: 4 → 5 platform_admin arms** (+`case_participant_roles_admin_write`). | `qa` V-3.2 | ✅ **CONFIRMED** |
| **D11** | **§6 is now the authoritative M1 fix set**, with the narrow precondition per keystone. Sequencing **PO-APPROVED (A29)**; **M1 not started**. | lead | recorded |

**Unchanged (per `qa` V-7):** the methodology, provenance discipline, C2/C3/C6/C7/C9–C12, the KEEP list,
the INVOKER negative, the `prosecdef` axis, the gates-vs-filters split, the 35/49 partition, the
sequencing order, and C8's three legs **as scoped**.

---

## Provenance

- **Live catalog ONLY** — `pg_proc` (incl. `prosecdef`, `prosqlbody`, `prolang`), `pg_policies`,
  `pg_policy`, **`pg_class.relacl`**, `pg_depend`, `pg_trigger`, `pg_constraint`,
  `information_schema.role_{table,column}_grants`, `storage.buckets`, `app.feature_flags`.
  **No migration file read. No grep. No graphify** (it does not index SQL; its repo hook was
  deliberately not followed per the ADR's METHODOLOGY FINDING — the lead has ratified this exception).
- **110 migrations**, local Docker stack, branch `feat/authorization-capability-model` @ `4f23558`.
  Stack owned by the lead; **no reset, restart, or `db push`.**
- **Five live probes**, each in a transaction that **`ROLLBACK`ed**; persistence re-verified after each
  (0 leaked: `audit_log` back to 160, `staff_admin` back to 4, 0 `former_respondent` keys).

### The binding methodology axes — each earned by a failure

| Axis | Added because |
|---|---|
| **1. `pg_policies`** | the original A23 rule |
| **2. `pg_proc.prosecdef`** | a DEFINER function's internal gate **replaces** RLS → a policy-shaped audit is blind to it (v1; lead-ratified) |
| **3. Indirection through a gate wrapper** | an RPC reaching an arm via a helper carries **none** of the arm strings (`qa` V-4) |
| **4. `pg_class.relacl`** ⬅ **v3** | a table with direct `authenticated` DML grants has **no RPC door to audit** — the axis that found D1 |
| **5. ⭐ Enumerate the GATE HELPERS, not the call sites** ⬅ **v3** | **axes 1–4 all enumerate call sites, and the call-site set is not closable** (D3 + D4). Five rounds produced five caller floors — **37 → 30 → 35/49 → 10 → 57** — and the sequence does not converge, because *"is this caller gated?"* is a per-function judgement no filter can make. **The helper set is finite, bounded, and checkable (§1.2·D5).** |

### The standing rules (adopted; both earned here)

1. **Every probe offered as a fixture is re-run by someone who did not write it.** (`backend` → `qa` v1's
   fixture · `qa` → `backend`'s three · `backend` → `qa`'s PROBE 4. **All four rounds found something.**)
2. **Whoever draws a sweep's boundary is not the only one who checks it.** (`qa`'s extension — and **D1a is
   its proof**: my boundary had the *right cardinality* and the *wrong members*.)

---

# 1 · FINDINGS SUMMARY

## 1.1 ⛔ P0 · The exclusion plane: **6 tables × 4 legs** — the A27 matrix

> **A27 (binding, published by me in v2 §1.1):** *"For **each** arm `is_case_excluded` resolves through,
> enumerate **EVERY** mutator of the rows it reads."*

### D1a · My v2 boundary was wrong in two directions, and the count concealed it

**The deny's read set, resolved from `prosrc` rather than from intuition (Q16b):** `is_case_excluded` →
`is_case_respondent` ∪ `is_recused_from_case` reads **exactly five** tables:

```
public.case_participants · public.case_participant_roles · public.professional_participants
public.professional_profiles · public.case_recusals
```

**v2 swept five tables — not the same five.** I **omitted `case_participant_roles`** (the second table in
`is_case_respondent`'s own join) **and included `case_conflict_declarations`, which the deny never reads**.
The two errors cancelled: **my count was right and my membership was wrong.** That is exactly why the sweep
looked complete, and exactly why `qa`'s standing-rule extension is correct.
*(`case_conflict_declarations` keeps its clean bill of health — `record_recusal` writes it — but it was
never on the plane.)*

### The matrix (Q17) — `case_participant_roles` fails **all four** legs the others pass

| Table | `authenticated` ACL | Write policies | Triggers | RPC door | Verdict |
|---|---|---|---|---|---|
| `case_participants` | **`r`** | 0 | 1 | ✅ audited RPCs | **CLEAR** |
| `case_recusals` | **`r`** | 0 | 0 | ✅ audited RPCs | **CLEAR** |
| `professional_participants` | **`r`** | 0 | 0 | ✅ audited RPCs | **CLEAR** |
| `professional_profiles` | **`r`** | 0 | 0 | ✅ audited RPCs | **CLEAR** |
| **`case_participant_roles`** | ⛔ **`arwd`** | ⛔ **1 (`FOR ALL`)** | ⛔ **0** | ⛔ **NONE writes `key`** | ⛔ **FAILS ALL FOUR** |

```
case_participant_roles | authenticated=arwd/postgres     ← the ONLY deny-read table with write grants
case_participants      | authenticated=r/postgres
case_participant_roles_admin_write :: ALL :: (app.is_admin() OR app.is_org_admin_of(organization_id))
```

**C8's conclusion is exactly inverted here.** For the five, *"the RPC is the only door"* holds and Rule 11
holds with it. For the sixth **there is no RPC door at all** — only unaudited direct DML. **Rule 11 has a
hole on the exclusion plane.**

### D2 · ⚠ `qa`'s PROBE 4 over-states the PHI consequence (C1a's lesson, 4th occurrence)

`qa` V-3.3 concludes the re-key dissolves *"`can_read_case_patient`'s deny, i.e. **PHI on every ethics case
in the org**."* **I re-ran it. Not as documented:**

```
 BEFORE | respondent t | excluded t | can_read_phi f | audit 160
 org_admin, authenticated: update case_participant_roles set key='former_respondent'   → UPDATE 1
 AFTER  | respondent f | excluded f | can_read_phi f | audit 160      ← PHI stays f
```

**Removing a deny is not granting access.** The seeded respondent (`staff4`, plain `staff`) has **no
positive arm** behind the deny, so `can_read_case_patient` stays `f`. **PHI requires the same precondition
C1a established** — the respondent must also hold `staff_admin`. `qa` fixed that precondition for PROBE 3
and dropped it for PROBE 4, **inside its own new blocker.** Fourth consecutive round; it is why standing
rule 1 exists.

### D2a · …but composed, it is **WORSE** than `qa` framed it (PROBE 5, proven live)

```
 -- PRECONDITION: the respondent IS the coordinator (the PO's A2 scenario)
 BEFORE | respondent t | excluded t | can_read f | can_read_phi f | audit 161
 -- the ORG_ADMIN acts. THE RESPONDENT DOES NOTHING AT ALL.
 org_admin, authenticated: update case_participant_roles set key='former_respondent'   → UPDATE 1
 AFTER  | respondent f | excluded f | can_read t | can_read_phi t | audit 161   ← PHI + NO AUDIT ROW
```

Two properties make this sharper than the mutator RPCs:

1. **It is unaudited.** `remove_case_participant` emits an `audit_log` row — C8's fallback (*detection, not
   prevention*). **This path emits none: 161 → 161.** It is not even *detectable* after the fact.
2. **The respondent never acts.** The principal dissolving the deny is an **`org_admin`** — *the very
   Organization User A21 says must never touch a case* — or a **`platform_admin`** via the `is_admin()`
   arm. There is no collusion signal in the record because there is no record.

**Blast radius, stated precisely** (the distinction `qa` collapses): the **deny dissolution is org-wide** —
one role row is shared by every case in the org that uses it, so one `UPDATE` of one column dissolves
`is_case_respondent` for **all of them at once**. The **PHI consequence is per-respondent**, gated on that
respondent holding a positive arm. The first half is why it is P0; the second is why the keystone must be
written narrowly.

### D9 · Severity corrected — **both arms are PHI doors**

v1 and v2 both wrote that `lift_recusal` flips `can_read_case`, and framed the respondent arm as *"strictly
worse."* **`qa` V-1.1 is right; both my versions were wrong.** Run against a **coordinator** — the only
principal `lift_recusal` is *about* — it flips `can_read_case_patient` **f → t** too, because that
predicate's `is_staff_admin_of_for` arm sits directly behind the recusal deny.

**Consequence: the PO ruling on "who may lift a recusal / remove a respondent" is a Rule 12 decision, not a
reach decision.** Both arms are equal-severity P0. The fix set is unchanged; the framing is not.

### The mutator table (final)

| Arm | Resolves through | Mutator | DEFINER | Self-check? | Exclusion? | **Audited?** |
|---|---|---|---|---|---|---|
| `is_recused_from_case` | `case_recusals.lifted_at` | **`lift_recusal`** | ✅ | ❌ | ❌ | ✅ |
| | | `record_recusal` | ✅ | ✅ | ❌ | ✅ |
| `is_case_respondent` | `case_participants.removed_at` | **`remove_case_participant`** | ✅ | ❌ | ❌ | ✅ |
| | `case_participants.role_id` | **`set_case_participant_role`** | ✅ | ❌ | ❌ | ✅ |
| | (shares the gate) | `set_primary_subject` | ✅ | ❌ | ❌ | ✅ |
| | **`case_participant_roles.key`** | ⛔ **DIRECT DML — no RPC exists** | n/a | ❌ | ❌ | ⛔ **NO** |
| | `professional_profiles.user_id` | **nothing — write-once (§1.7)** | — | — | — | — |

## 1.2 ⛔ P0 · The population question — answered, and the answer is not a number

### D3 · The mandate's prescribed method is unachievable (disagreement, with evidence)

The lead directed: *"Resolve transitively — use `pg_depend` to build the call graph and close over it,
rather than matching text."* **`pg_depend` cannot do this** (Q16):

```
fn→fn dependency edges, catalog-wide ............ 5
app/public functions ........................... 660   (509 plpgsql + 151 sql)
…with a parsed prosqlbody ........................ 0
```

Every function here uses an **old-style string-literal body** (`AS $$ … $$`). PostgreSQL **does not parse
those into `pg_depend`** — dependencies are recorded only for new-style `BEGIN ATOMIC` SQL bodies
(`prosqlbody`), of which there are **zero**. The 5 edges that exist are argument/return-type dependencies,
not calls. **There is no call graph in `pg_depend` to close over.**

### D4 · Closed over `prosrc` instead — and the result proves the caller set is unclosable

Recursive closure to 6 hops (Q18), seeded on five arms:

```
seed (direct arm) ....................... 152
transitive total ........................ 310
reached ONLY via a wrapper .............. 158
  …DEFINER · no exclusion · no read gate · on case/interview/attachment content ....... 57
```

**`qa`'s "28 fns / 10 DEFINER" is itself a floor** — it matched **five hand-picked wrapper names**, which is
hand-picking the arms one level up. My 57 swept in every PHI door (`get_case_patient`,
`get_referral_patient`, `set_case_patient`, `get_patient_trajectory_for_entity`, …).

**But 57 is a false-alarm set, not a finding — and I caught it before filing it.** Checked per-function:
`get_case_patient` delegates to `get_participant_patient`, which **does** gate on `can_read_case_patient`;
`get_referral_patient` gates on `can_read_referral_phi`; `save_narrative_body` gates on
`can_write_case_narrative`. **My filter's "no read gate" test omitted the domain predicates** — the identical
false-positive class as `qa`'s V-0.3 comment match, in the opposite direction.

> **THE STRUCTURAL CONCLUSION: THE CALLER SET IS NOT CLOSABLE BY ANY FILTER.** Deciding *"is this caller
> gated?"* requires knowing whether the helper it calls **carries the deny** — a per-function judgement.
> `pg_depend` cannot help (D3); text cannot help (this section). **Five rounds, five caller floors —
> 37 → 30 → 35/49 → 10 → 57 — non-convergent. Stop counting callers.**

### D5 · ⭐ The frame that IS closable — the **gate-helper set** (Q19)

There are **16** gate helpers. **Only 5 carry the deny. Eleven do not — and they have 48 callers.**

| Helper | Deny? | org arm | staff arm | Callers | Action |
|---|---|---|---|---|---|
| `can_read_case` | ✅ | ✅ | ✅ | 10 | projection (A24·2) + REMOVE-ARM |
| `can_write_case_content` | ✅ | ❌ | ✅ | 8 | projection |
| `can_read_case_patient` | ✅ | ❌ | ✅ | 3 | projection; drop the NSP arm (D8) |
| `can_read_case_or_admin` | ✅ | ✅ | ❌ | 2 | retire at G (A21) |
| `can_reach_case_on_member_surface` | ✅ | ❌ | ❌ | 0¹ | **UN-RETIRED** → the `RCD` projection (A15·2) |
| **`assert_meeting_staff_admin`** | ❌ | ✅ | ✅ | **18** | REMOVE-ARM (A10) — *18 INVOKER meeting RPCs; RLS applies* |
| **`can_read_referral_phi`** | ❌ | ❌ | ✅ | **9** | split (D7 / F-min) |
| **`can_write_interview`** | ❌ | ✅ | ✅ | **8** | **FIX** — no deny, no `is_active` on the interviewer arm |
| **`can_write_attachment`** | ❌ | ✅ | ✅ | **4** | **FIX (D7)** — callers incl. **`dispose_attachment_phi`** |
| **`can_read_action_item`** | ❌ | ✅ | ✅ | **3** | **FIX** (A22 + A24·5) |
| **`can_read_attachment`** | ❌ | ✅ | ❌ | **2** | REMOVE-ARM ×2 (A9 + D4·2) |
| **`can_write_case_narrative`** ⭐ | ❌ | ❌ | ✅ | **1** | **FIX — D6, NEW** |
| `can_read_referral` | ❌ | ❌ | ❌ | 1 | split (F-min) |
| `can_read_interview` | ❌ | ❌ | ❌ | 0² | rides `can_read_case_or_admin` ✅ + `confidentiality_clearance_ok` |
| `attachment_confidentiality_ok` · `confidentiality_clearance_ok` | ❌ | ❌ | ❌ | 1 each | **B3 — repoint BOTH (§1.8)** |

<sub>¹ consumed by `meeting_cases_select` — a **policy**, not a function; the sole consumer, confirming A15·2 · ² consumed by policies only</sub>

**Fix the 11 and all 48 callers are fixed for free.** This generalizes `qa`'s `can_write_attachment`
insight from one helper to eleven, and it is **bounded, checkable, and reviewable** — which no caller
enumeration in this program has been.

### D6 · ⭐ NEW — `can_write_case_narrative` has no deny

`qa` V-4 named `can_write_attachment`. The helper table exposes a second: **`can_write_case_narrative`** —
`is_staff_admin_of`, **no deny** — is `save_narrative_body`'s own stated *"Q14 write predicate (the
authority)"*. **A recused coordinator writes narrative bodies** on the case she is recused from;
`case_narratives.body_md` is **PHI-BEARING free text** by its own column comment. Invisible to Q7·v2 (the
RPC carries no arm string) **and** to `qa`'s wrapper sweep (not among its five hand-picked names).

## 1.3 – 1.11 · Unchanged from v2 (all ✅ `qa`-verified)

`list_cases_board` fast-path (§1.3) · the interview family + the `interview-attachments` bucket (§1.4) ·
`administrativo` → `assign_case_phases` → PHI (§1.5) · A20/B7 write-once (§1.7) ·
`confidentiality_clearance_ok` (§1.8) · `case_access` grants (§1.9) · `create_case` ignores
`default_visibility_policy` (§1.10) · the claim table (§1.11).

## 1.6 · **A30 — `platform_admin` (`is_admin()`) arms on tenant data: FIVE** (D8 · D10)

CLAUDE.md §1: *"`platform_admin` — global superuser, **walled off from all tenant data**."*

| # | Object | Arm | Severity |
|---|---|---|---|
| 1 | `set_case_offered_outcomes` | `is_staff_admin_of OR **is_admin()**` | case-content write |
| 2 | `create_case` | `is_staff_admin_of OR **is_admin()** …` | creates cases in any tenant |
| 3 | **`dispose_referral_phi`** | `**is_admin()** OR is_commission_admin_of(…)` | ⛔ **destroys referral PHI — cross-tenant, irreversible** |
| 4 | **`can_dispose_referral_phi`** | `**is_admin()** OR is_commission_admin_of(…)` | the predicate behind it |
| 5 | **`case_participant_roles_admin_write`** ⬅ **D10** | `**is_admin()** OR is_org_admin_of(…)` | ⛔ **the exclusion plane itself (§1.1)** |

### D8 · `is_admin()`'s JWT claim is a **cache, not an escalation path** — corrected

v2 §1.6 wrote that `is_admin()` *"also honours a JWT claim"* in a tone that read as forgeability. **The
lead is right and v2's wording was wrong.** `custom_access_token_hook` (enabled in `config.toml`, ADR 0002)
mints `is_admin` **server-side from `profiles.is_admin`**. It is a **cache**. The only residual is
**staleness** — a revoked admin retains the claim until token refresh — already backlogged as session
revocation (defence-in-depth, explicitly not the boundary, per D3's own framing). **This is not a
privilege-escalation finding and must not ship as one.**

---

# 2 · KEEP LIST — unchanged from v2 (`qa`-verified both directions, 0 over-reach)

`case_tags` · `case_outcomes` · `case_narrative_types` (+ `archive_case_tag`/`create_case_tag`/`rename_case_tag`) ·
`case_types` · `case_type_terminology` · `process_template*` · `commission_meeting_types` ·
`commission_meeting_settings` · `dispose_meeting_minutes` · `audit_log_select` · membership/role management ·
**`grant_member_capability`** · **the grant door (`grant_case_access` · `revoke_case_access` ·
`list_case_access`)** · forms · indicators · controlled documents.

> ⚠ **`case_participant_roles` sat on this list in v2 as "org config, out of scope". It is BOTH.** It is
> genuinely org configuration **and** the exclusion plane's sixth table. **The resolution is not to remove
> the arm** (A18/staffing keeps it) **but to freeze the one column the deny reads** — M1·3. *Keeping the
> arm* and *protecting the deny* remain **orthogonal** — C6's lesson, now proven a second time, and the
> exact reason this table was mis-filed.

---

# 3 · INVENTORY BY PATH KIND — v2's §3.1–§3.7 stand, with these v3 edits

- **§3.5 · `can_write_attachment`: REMOVE-ARM → FIX (D7).** Strip `is_commission_admin_of_for` per A21·1 and
  `is_staff_admin_of_for` **survives unqualified** — the C2 defect at the helper layer, on a path whose
  DEFINER callers include **`dispose_attachment_phi`** (PHI destruction) and `soft_delete_attachment`.
  *(Not M1 — M1 does not touch this helper. **Blocking for the Stage-A/G sweep.**)*
- **§3.5 · `can_write_case_narrative`: add — FIX (D6).**
- **§3.1 · `case_participant_roles_admin_write`: KEEP the arm, FREEZE `key`** (§2, M1·3).
- **§3.6·A2** — `set_participant_patient` retained (`qa` V-6.1 confirms: DEFINER · `is_staff_admin_of` only ·
  **no** read gate · `on conflict do update` ⇒ **destructive** PHI overwrite; A21's arm removal never
  touches it, as it carries no `is_commission_admin_of` arm).
- **Unchanged and `qa`-verified:** the 35/49 partition · the gates-vs-filters split · bucket D (7 INVOKER —
  **DO NOT FIX**) · the 3 already-gated.

---

# 4 · STRUCTURAL SURFACES

| Surface | Result |
|---|---|
| Views | **0 in `public`** — checks-inside-a-view is **structurally impossible** here (`qa`) |
| DEFINER without pinned `search_path` | **0** — D13·5 holds (`qa`) |
| RLS-disabled tables | **0** (`qa`) |
| Column-level GRANTs | whole-table; no hidden narrowing (`qa`, via `role_column_grants`) |
| Storage | 19 object policies → §1.4, §3.4 |
| `pg_trigger` | **41 enumerated** → §4.1 |
| **ACLs (`relacl`)** ⬅ **v3** | **the axis that found D1** → §1.1 |
| **`pg_depend` call graph** ⬅ **v3** | ⛔ **does not exist** — 0/660 parsed bodies (D3) |

## 4.1 · C8 — the disproof **holds on its legs; its scope was wrong**

For **`case_participants`, `case_recusals`, `professional_participants`, `professional_profiles`**:
0 write policies · 0 `authenticated` DML grants (`relacl` = `r`) · all mutators call `audit_write` →
**the RPC is the only door; Rule 11 holds.** ✅ `qa` verified all three legs three ways and endorses it.

**For `case_participant_roles` all four legs FAIL and Rule 11 does NOT hold** (§1.1). **C8 is corrected,
not withdrawn: sound for the tables it covered, wrong about its boundary.**

**Still confirms A24·3:** terminal-freeze lives in `app.guard_case_status` (`HC025`) with an
`app.in_case_rpc` hatch; `can_write_case_content` has **no status check**. A `STABLE` resolver cannot
replicate it. **The trigger stays; step 6 stays deleted.** Eight hatch namespaces, ~140 RPCs, all
`set_config(..., true)` — transaction-local, no cross-transaction leak.

---

# 5 · CONTRADICTIONS + OPEN RULINGS

v2 §5's twelve items stand. **Added:**

13. **`pg_depend` cannot express this codebase's call graph** (D3) — any methodology assuming it can is
    unimplementable here.
14. **The caller set is not closable by any filter** (D4); **the gate-helper set is** (D5).

## 5.1 · PO / lead rulings open

1. **Who may lift a recusal / remove a respondent?** (§1.1) — **now a Rule 12 decision** (D9). Covers all 4
   mutators + `record_recusal`. `qa` and I both endorse `AND NOT is_case_excluded(...)` **+** an
   Organization User arm (safe by construction — Org Users are not members and cannot self-grant).
2. **`platform_admin` on case content + referral PHI destruction** (§1.6) — reconcile with CLAUDE.md §1.
3. **`interview-attachments` + `case-documents` buckets** (§1.4) — in scope, or Stage E?
4. **`case_tag_report`** (§3.6·B) — PHI-free governance aggregate, or case content?
5. **`professional_profiles.user_id` `ON DELETE SET NULL`** (§1.7) — B7 blocking.
6. **`administrativo`'s `assign_case_phases`** (§1.5) — contradicts O8.
7. ⬅ **NEW · `case_participant_roles.key`** — immutable once referenced by a `case_participant`? Who may
   mutate it? *(M1·3's fix shape depends on this.)*
8. ⬅ **NEW · `platform_admin` + referral PHI destruction** — the sharpest form of (2).

---

# 6 · THE AUTHORITATIVE M1 FIX SET

> ⏸ **Sequencing is PO-APPROVED (ADR 0078 A29).** M1 = **exclusion durability only**; **A21's admin-arm
> removal is excluded** (D4·3 — it requires the resolver). **M1 IS NOT STARTED. No SQL is authored.**
> **M1's purpose (A29): *"the exclusion keystones stop being vacuous."*** Every item below serves that
> sentence; nothing else belongs in M1.

**Every fix pairs with an over-grant twin: *the denied party calls the door on her own row and it
raises*** — asserted on **rows read / state under `set local role authenticated`**, never on a predicate's
return value.

> ⛔ **THE PRECONDITIONS, WRITTEN NARROWLY. This is the part that goes vacuous if paraphrased.**
> **Four consecutive rounds dropped a precondition; three of the four fixtures offered would have gone
> green while asserting nothing.**
> - **Respondent arm:** the principal must be `is_case_respondent` = `t` **AND hold `staff_admin` on the
>   case's commission.** The seed's `staff4.ccih@test.local` is plain **`staff`** — **the fixture MUST
>   insert the membership row**, or the RPC raises `HC0E4` **for the wrong reason** and the test is green
>   and worthless.
> - **Recusal arm:** the principal must be **recused AND `staff_admin`** (`chefe.ccih@test.local` is
>   already `staff_admin` — insert only the recusal).
> - **Assert on STATE, not on the exception:** after the denied call, `is_case_respondent` /
>   `is_recused_from_case` **must still be `t`** — *the row survives her*.
> - **Assert the positive twin:** a **non-excluded** coordinator calls the same door and it **succeeds** —
>   else the fix silently deleted legitimate coordinator reach (the ETH·E1 lesson).
> - **`set_primary_subject`:** shares the gate, but `is_case_respondent` does **not** read
>   `is_primary_subject`. It is a **co-located** defect, not a deny-flipping one. **Keystone it as a gate
>   fix, not a durability fix**, or the assertion cannot falsify.

### M1·1 — B7: respondent linkage (**lands first**)
Resolved state (`linked` / `no_account` / `unknown`) **+ the `user_id` write path**
(`update_professional_profile` has no `p_user_id` — §1.7) **+ the `ON DELETE SET NULL` ruling.**
**Why first:** the mutator fix is `NOT is_case_excluded(...)`, which is meaningless until
`is_case_respondent` resolves. The other order produces a gate that passes for the very principal it must
deny.
- **Keystone:** an `unknown` profile is linkable through the public API; `is_case_respondent` resolves `t`;
  an `unknown` profile **cannot** be attached as `respondent_doctor`.

### M1·2 — the exclusion-plane mutators (5 RPCs)
`lift_recusal` · `remove_case_participant` · `set_case_participant_role` · `set_primary_subject` ·
`record_recusal` — each gains `AND NOT app.is_case_excluded(<case>, auth.uid())` (+ the A18 Org-User arm,
pending ruling 1).
- **Keystone:** the over-grant twin + the narrow preconditions above. **Both arms assert PHI** (D9).

### M1·3 — ⛔ NEW · `case_participant_roles`, the 6th exclusion-plane table (D1)
- **Freeze `key` on UPDATE** once referenced by a `case_participant` (immutability trigger — the
  `guard_case_status`/`HC025` pattern already in this repo), **and/or `REVOKE` the `arwd` grant** from
  `authenticated`.
  > ⚠ **Fix-shape constraint I verified — it changes the prescription:** it must be an **UPDATE-freeze,
  > not a write-freeze**. `set_participant_patient` **INSERTs** an `affected_patient` role row
  > (`on conflict … do nothing`); a blanket write-freeze breaks it. **No RPC ever UPDATEs `key`** — so an
  > UPDATE-freeze costs nothing. A `REVOKE` is likewise safe: every RPC touching this table is DEFINER and
  > runs as `postgres`.
- **Add an audit trigger** — the table has **none** and no RPC door, so today the mutation is invisible to
  Rule 11 (§1.1·D2a).
- **Keystones:** (a) **over-grant twin** — `orgadmin.a@test.local`, under `set local role authenticated`,
  `UPDATE`s `key` off `respondent_doctor` → **raises**; `is_case_excluded(<case>, <resp>)` **is still `t`**
  *(today: `UPDATE 1` and `f`)*. (b) **Rule 11** — the permitted path emits an `audit_log` row.
  (c) **no over-reach** — an `org_admin` can still **create** a role and **rename `display_name`**; the
  staffing/config surface A18 protects must survive *(keystone 23)*. (d) **`set_participant_patient`'s
  INSERT path still works.**

### M1·4 — the DEFINER exclusion sweep: **35 RPCs, split by remediation shape**
- **§3.6·A — case-scoped → add the gate** `AND NOT app.is_case_excluded(<case>, auth.uid())`, including
  **`set_participant_patient`**, and the A3 grant/staffing doors **which KEEP their arm** (C6).
- **§3.6·B — commission-scoped → a gate is unwritable; per-row filter:** `list_cases_board` (delete the
  fast-path) · `count_open_cases_for_board` · `case_tag_report` *(pending ruling 4)*.
- ⛔ **Do NOT touch** the 7 INVOKER RPCs (bucket D) or the 3 already-gated.
- **Keystone per shape**, not per RPC: one gate twin, one per-row-filter twin, plus an **over-reach twin**
  for bucket D (*an INVOKER RPC still works for a legitimate coordinator*).

### M1·5 — A30: the **5** `platform_admin` arms (§1.6) — pending rulings 2 and 8.

### Explicitly NOT in M1
`can_write_attachment` · `can_write_case_narrative` · `can_read_action_item` · `can_write_interview`
(D5–D7 — **the Stage-A/G helper sweep**) · A21's admin-arm removal (D4·3) · the resolver · the member arm ·
every policy repoint · the buckets (§1.4, pending ruling 3).

**M1 is `EXPLAIN`-neutral** (no policy repoints) → A5's performance gate does not block it.

---

# 7 · THE EXACT QUERIES (Q1–Q15 unchanged from v2; new below)

```sql
-- ⭐ Q16 · Can pg_depend build the call graph? — NO (D3)
select count(*) as fn_to_fn_edges from pg_depend d
join pg_proc p1 on p1.oid = d.objid    and d.classid    = 'pg_proc'::regclass
join pg_proc p2 on p2.oid = d.refobjid and d.refclassid = 'pg_proc'::regclass;        -- 5
select l.lanname, count(*), count(*) filter (where p.prosqlbody is not null) as parsed_bodies
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
where n.nspname in ('app','public') group by 1;                      -- plpgsql 509/0 · sql 151/0

-- ⭐ Q16b · The deny's TRUE read set — resolve from prosrc, never from intuition (D1a)
select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and p.proname in ('is_case_excluded','is_case_respondent','is_recused_from_case');
--  → exactly 5: case_participants · case_participant_roles · professional_participants
--               · professional_profiles · case_recusals

-- ⭐ Q17 · THE A27 MATRIX — deny-read tables × 4 legs (the query that finds D1)
with deny(t) as (values ('case_participants'),('case_participant_roles'),('professional_participants'),
                        ('professional_profiles'),('case_recusals'))
select d.t as tbl,
  (select array_to_string(c.relacl,' | ') from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname=d.t)                                     as raw_acl,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=d.t
     and p.cmd in ('ALL','INSERT','UPDATE','DELETE'))                                as write_policies,
  (select count(*) from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
     join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname=d.t and not tg.tgisinternal)             as triggers
from deny d order by 1;
--  → case_participant_roles: authenticated=arwd | 1 | 0    ← ALL LEGS FAIL
--    the other four:         authenticated=r    | 0 | 0/1

-- Q17b · the 4th leg: does ANY function UPDATE case_participant_roles.key? → NO
select n.nspname||'.'||p.proname, p.prosecdef,
       (p.prosrc ~* 'update public.case_participant_roles') as updates_it
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('app','public') and p.prosrc ilike '%case_participant_roles%';
--  → set_participant_patient INSERTs (on conflict do nothing); NOTHING updates `key`
--    ⇒ the fix must be an UPDATE-freeze, not a write-freeze (M1·3)

-- ⭐ Q18 · Transitive closure over prosrc (pg_depend cannot — Q16) → 152 / 310 / 158
with recursive
seed as (
  select distinct p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('app','public')
    and (p.prosrc ilike '%is_commission_admin_of%' or p.prosrc ilike '%is_staff_admin_of%'
         or p.prosrc ilike '%is_admin()%' or p.prosrc ilike '%member_can%'
         or p.prosrc ilike '%is_org_admin_of%')),
closure as (
  select oid, proname, 0 as hop from seed
  union
  select p.oid, p.proname, c.hop + 1
  from closure c
  join pg_proc p on true
  join pg_namespace n on n.oid = p.pronamespace and n.nspname in ('app','public')
  where c.hop < 6 and p.oid <> c.oid and p.prosrc ~* ('(^|[^a-z_])' || c.proname || '\s*\('))
select (select count(distinct oid) from seed)     as seed_direct_arm,     -- 152
       (select count(distinct oid) from closure)  as transitive_total,    -- 310
       (select count(distinct oid) from closure
          where oid not in (select oid from seed)) as wrapper_only;       -- 158
-- ⚠ Its DEFINER/content subset is 57 — a FALSE-ALARM set, NOT a finding:
--   get_case_patient → get_participant_patient → can_read_case_patient (gated, transitively).
--   THE CALLER SET IS NOT CLOSABLE BY TEXT. Use Q19.

-- ⭐ Q19 · THE GATE-HELPER SET — closable, bounded, reviewable (D5). 16 helpers; 5 carry the deny, 11 don't.
select p.proname as helper, p.prosecdef as definer,
  (p.prosrc ilike '%is_case_excluded%' or p.prosrc ilike '%is_recused_from_case%'
   or p.prosrc ilike '%is_case_respondent%')                              as carries_deny,
  (p.prosrc ilike '%is_commission_admin_of%')                             as org_arm,
  (p.prosrc ilike '%is_staff_admin_of%')                                  as staff_arm,
  (select count(*) from pg_proc c join pg_namespace cn on cn.oid=c.pronamespace
     where cn.nspname in ('app','public') and c.oid<>p.oid
       and c.prosrc ~* ('(^|[^a-z_])'||p.proname||'\s*\('))               as callers
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and p.proname in
 ('can_read_case','can_read_case_or_admin','can_read_case_patient','can_write_case_content',
  'can_reach_case_on_member_surface','can_read_attachment','can_write_attachment','can_read_interview',
  'can_write_interview','can_read_action_item','can_read_referral','can_read_referral_phi',
  'can_write_case_narrative','assert_meeting_staff_admin','attachment_confidentiality_ok',
  'confidentiality_clearance_ok')
order by carries_deny, callers desc;
```

## 7.1 · The five live probes (each `ROLLBACK`ed; persistence re-verified = 0 leaked)

| # | Probe | Result |
|---|---|---|
| **1** | `lift_recusal` — recused coordinator lifts her own recusal | `recused` t→f · `can_read` f→t · **`can_read_phi` f→t** (D9) |
| **2** | `qa` v1's fixture **as documented** | ⛔ **DOES NOT REPRODUCE** — `HC0E4`, correctly denied (C1a) |
| **3** | respondent arm **+ the precondition** | `respondent` t→f · `excluded` t→f · `can_read` f→t · **`can_read_phi` f→t** |
| **4** | `qa`'s PROBE 4 **as documented** — org_admin re-keys | `UPDATE 1` · `excluded` t→f · **`can_read_phi` f→f** ⬅ **PHI claim over-stated (D2)** · **audit 160→160** |
| **5** | **the composition** — org_admin re-keys; respondent **is** coordinator | `excluded` t→f · `can_read` f→t · **`can_read_phi` f→t** · **audit 161→161 (UNAUDITED)** ⬅ **D2a** |

```sql
-- ⭐ PROBE 5 · the composed finding. The org_admin acts; THE RESPONDENT DOES NOTHING.
begin;
  -- resolve <cp_id, case_id, resp_uid, role_id, org, comm> from the deny's OWN join (Q16b)
  -- resolve <orgadmin> = a memberships row with role='org_admin' for that org
  insert into public.memberships (principal_id, commission_id, role)
  values (:resp_uid, :comm, 'staff_admin') on conflict do nothing;  -- PRECONDITION (the PO's A2 scenario)
  --  BEFORE | respondent t | excluded t | can_read f | can_read_phi f | audit 161
  set local role authenticated;
  select set_config('request.jwt.claims',
                    json_build_object('sub', :orgadmin, 'role','authenticated')::text, true);
  update public.case_participant_roles set key = 'former_respondent' where id = :role_id;  -- UPDATE 1
  reset role;
  --  AFTER  | respondent f | excluded f | can_read t | can_read_phi t | audit 161  ← PHI + NO AUDIT ROW
rollback;
-- post-rollback: 0 'former_respondent' keys · staff_admin back to 4 · audit_log back to 160
```

# AUTHZ · M3 — QA Review (defect ① narrowing)

**Reviewer:** `qa` · **Date:** 2026-07-15 · **Scope:** ADR 0078 A36 / defect ①
**Artifacts:** `supabase/migrations/20260724000000_authz_m3_assignment_phi_narrowing.sql`,
`supabase/tests/230_authz_m3_assignment_phi.sql`, amended `151` (21/22) + `207` (K3),
`supabase/tests/mutation/m1-mutation-audit.sh`

## Verdict: **CHANGES REQUESTED**

**The SQL is correct and is approved as-is — it needs no logic change and no re-test.**
The narrowing is exactly right, minimal, and proven in both directions to a standard
higher than M1 or M2 reached. I could not find a defect in it.

The block is **documentation-only and narrow**: the migration ships a **factually false
statement about a LIVE PHI arm** into the permanent record, and that statement's function
is to justify *not acting* on it. The same falsehood sits in ADR 0078 A36·3, where it was
used to **overrule a warning (A24·1) that was correct**. In a program whose founding lesson
is *text is not truth*, and whose cost has been dominated by exactly this failure mode, a
reviewer who waves this through is not doing his job. Fix the record; the SQL ships unchanged.

---

## 1. Is assignee PHI reach dead AND is every legitimate reader's PHI reach intact?

**Yes to both — proven by enumeration over the live catalog, not by trusting the list.**

I built a shadow function carrying the **pre-M3 body verbatim** and diffed the two
populations across **every (case, user) pair** — 7 cases × 28 users = 196 pairs, flag ON
(today's live branch), in a rolled-back transaction:

| metric | value |
| --- | --- |
| PHI readers BEFORE | 30 |
| PHI readers AFTER | 27 |
| **LOST PHI** | **3** |
| **GAINED PHI** | **0** |
| Coordinators or grantees who lost PHI | **0 rows** |
| Anyone who lost PHI *and* lost content | **0 rows** |

The 3 who lost PHI are **exactly** the bare assignees, and each is `is_coord=f`,
`has_grant=f`, `is_assignee=t`, `content_after=t`:

```
staff1.ccih@test.local   f  f  t  t
staff1.ccih@test.local   f  f  t  t
staff2.ccih@test.local   f  f  t  t
```

The surviving population enumerated **from the catalog** — coordinator, grantee, and the
PQS arm — all still read. `GAINED_phi = 0` confirms the migration is purely subtractive.
**This is a narrowing that removed precisely its target and nothing else.**

Behavioural confirmation (rows read under `set local role`, not a predicate's return
value): `230` tests 12–15 assert the coordinator and the grantee **actually read
`MRN-M3-001` through the audited door**; test 6 asserts the assignee's door returns
**NULL**. Green.

**Bonus confirmation for M2:** `platform@test.local` (the real `platform_admin`,
`is_admin=t`) reads **zero** PHI in the enumeration. Note the name trap the ADR itself
warned about — `admin@test.local` is `is_admin=**f**` ("Administradora Geral", an
NSP/org admin). Its PHI reach is the PQS referral arm, not an admin bypass. See §5.

## 2. Is content reach genuinely unaffected?

**Yes — verified three independent ways.**

1. **Catalog:** `app.can_read_case` still carries both arms as **real code**, not comments
   — `select 1 from public.case_phases cp` (line 55) and `... case_narratives cn` (line 59)
   of its `pg_get_functiondef`. The scope fence (test 23) is not satisfied by a comment.
2. **Behaviour:** `230` tests 9–11 — both assignees still read the case, and the narrative
   assignee **still writes his narrative** (the D10 arm survives).
3. **Enumeration:** the content fence returned **0 rows** — nobody who lost PHI lost content.

**Code diff vs. the prior definition (`20260720001000_ethics_access_predicates.sql`),
comments stripped, is EXACTLY the two removed arms** — plus cosmetic reflow of
`stable`/`security definer`/`set search_path`. The flag-OFF branch, the ⟵E1 hard denies,
the referral arm, and the expiry term are **byte-untouched**. A textbook subtractive migration.

## 3. Both flag branches / the restraint on the member arm

**The restraint is correct.** On the OFF branch the assignee **keeps** PHI via the
`is_member_of_for` arm — and that is right: the OFF branch **never had an assignment arm
to remove**. Asserting `false` there would have silently narrowed the *member* arm, which
is A15/A2's business. `230` test 17 asserts the restraint explicitly; tests 19–20 confirm
the `explicit_grants_only` E1 belt is intact. `228` test 24 (the byte-for-byte member-arm
assertion) passes in the full green suite. **Scope fence held.**

## 4. Is Rule 11 coverage preserved in the amended suites?

**Yes — genuinely preserved, not relocated into a weaker assertion.** This was the
highest-risk edit and `backend`'s reasoning was right: flipping 21/22 to expect null would
have deleted the Rule 11 assertion while looking like a pass.

- **`151` a1 block is UNTOUCHED** and still carries Rule 11 in full: coordinator →
  `get_participant_patient` → `delta = 1`. The assertion never moved.
- **`151` a2 block** re-pointed `st_x` → `sa_x`, still asserting `delta = 1::bigint` — a
  real Rule 11 assertion, not weakened.
- **The assignee's new null-and-no-audit behaviour is asserted** — `230` test 6 (door
  returns NULL). The no-audit half is covered by `151`'s pre-existing `a0` block
  (unentitled reader → `delta = 0`), which the narrowing now routes the assignee into.
- **`207` K3** re-pointed to `sa_x`; the assertion under test is the **list door returning
  both patients** (N-per-case), which still binds and returns 2.

**MINOR-1 (below):** a2 is now a *literal duplicate* of a1 — same persona, same door, same
`pid`. Rule 11 coverage survives because **a1** carries it, not because a2 does. a2 still
proves one distinct thing (a repeat read by the same user emits *another* row — no dedup),
but nothing says so, and the temp table is still named `p_assignee`.

## 5. Is the `level` refusal sound, and is the pin real?

**The refusal is sound. Both of its legs verified against the live catalog:**

1. `CHECK ((level = ANY (ARRAY['read'::text, 'write'::text])))` — confirmed. `level` is
   **write authority**, not a PHI capability. Filtering PHI on `level='write'` would encode
   `write_case_content ⇒ read_standard_phi`, which A16's lattice puts on **disjoint chains**,
   and would make "read + PHI" — a capability that exists today — ungrantable. Refusing to
   invent a shape here is correct, and consistent with the "verify, don't comply" precedent.
2. `max_confidentiality` is NULL on **3 of 4** live rows (see MINOR-2 — the reported figure
   was "4 of 5"). Conclusion unaffected: filtering on it would revoke PHI from most grants,
   straight through the positive twin. It is also earmarked for `read_restricted_phi` (D5·4),
   the wrong tier.

**The pin is real.** `230` line 123 inserts a `level='read'` grant and tests 14/15 assert it
**still confers PHI and still reads the MRN**. When B1 introduces
`case_access_grants.read_standard_phi` and filters on it, a bare `read` grant will stop
conferring PHI and **these two tests go red**. The change cannot land silently. A pin that
pins.

---

## Findings

### ⛔ MAJOR-1 — `case_referrals` is **ON**, not OFF. The migration and ADR A36·3 both record `f`, and defer a **live PHI over-grant** on that false premise.

**Catalog:** `app.feature_flags.case_referrals = **t**`.

**Source:** `supabase/migrations/20260620000000_baseline.sql:25010` sets it `true` with
`on conflict (key) do update set enabled = excluded.enabled` — **force-set true on every
migration run, in every environment (local AND remote)**. No migration ever disables it;
`seed.sql` never touches it. Its own description string reads *"**Ships OFF**; enabled at
Phase 22 completion"* — the INSERT contradicts its own description.

**Consequence — the PQS referral-PHI arm is LIVE, and my enumeration proves it.** These
personas read PHI on 4 cases each **solely** through that arm (`is_coord=f`, `has_grant=f`,
`is_assignee=f`): `pqs.a`, `pqs.b`, `pqsdual.a`, `nspcoord.a`, `nspcoord.b`,
`admin@test.local`. Per **ADR 0078's own source table**, `nsp_referral_touched` should
confer **CONTENT ONLY, never PHI**. That is a live PHI over-grant of the *same class as
defect ①*.

**The two false statements:**
- M3 header (lines 83–84): *"the `case_referrals` flag is currently OFF so the arm is
  **INERT regardless**."* — **FALSE.**
- ADR 0078 **A36·3**: *"`nsp_referral_touched` is **INERT today** — `case_referrals` flag =
  `f`. **A24·1 overstates its urgency** … with the flag off there **is** none to revoke."*
  — **FALSE, and A24·1 was overruled on it.** A24·1 was right.

**This is not an M3 code defect** — leaving the arm to A2/Stage-D is correct on ownership
grounds either way, and `GAINED_phi = 0` proves M3 widened nothing. But M3 **entrenches the
falsehood in a permanent migration comment**, and the falsehood's effect is to **suppress
the urgency of a live PHI exposure**. Sixth instance of *text is not truth* — this time the
text is the program's own record.

**Required (documentation only — no SQL logic change, no re-test):**
1. Correct the M3 header comment: the flag is **ON**; the arm is **LIVE**, not inert. It is
   still A2/Stage-D's to fix — say that, truthfully.
2. Correct **ADR 0078 A36·3**, and record that **A24·1's urgency claim was correct**.
3. Re-triage the referral arm as a **live PHI divergence**, not a dormant one.
4. Note that baseline's *"Ships OFF"* description is itself false — file it.

### MINOR-2 — "4 of 5 live rows" does not reproduce
Fresh reset: `case_access` = **4** rows, `max_confidentiality` NULL on **3** (75%), not 4 of
5 (80%). The conclusion holds; the number is not catalog-true. Correct it in the header.

### MINOR-3 (nit) — the preflight verifies pgtap but not `test_helpers`
Its own comment names **both** dropped prerequisites; the check covers one, and
`00_setup.sql` runs with stderr silenced (`>/dev/null 2>&1`). **Empirically harmless** — I
dropped the entire `test_helpers` schema and the harness recovered and still reported
RED-PROVEN. Theoretical only; worth a line, not a round.

### FRONTEND follow-up (not M3's, but it lands with it)
`case-patient-panel.tsx` handles the new null **gracefully**: a `denied` branch renders a
pt-BR message, **no raw Postgres error** (Rule: errors user-readable in pt-BR — satisfied).
**But the copy is now wrong:** *"O acesso é liberado à coordenação e **aos responsáveis pelo
caso**"* — "responsáveis pelo caso" reads as the assignees, who are now **exactly the people
who will see this message**. The string tells a denied assignee he ought to have access.
Needs a copy fix by `frontend`. The `.bind`-ed reveal contract is unchanged; TS diffs in
`src/lib/cases/types.ts` and `src/lib/queries/cases.ts` are **comment-only** — scope fence held.

---

## Verification performed (all independent, live catalog + behaviour, rolled back)

| # | Check | Result |
| --- | --- | --- |
| 1 | Fresh `db reset` + full `supabase test db` | **2656/2656**, 93 files, **0 `not ok`**, exit 0 — reproduced, not trusted |
| 2 | `pg_get_functiondef` of the PHI door | arms gone; **no comment names either table** — comment trap resolved |
| 3 | Code diff vs prior definition, comments stripped | **exactly the two arms**; nothing else |
| 4 | Differential enumeration, 196 pairs | LOST **3** (bare assignees, all keep content) · GAINED **0** · regression fence **0** |
| 5 | Mutation harness, run by me post-reset | **22/22 RED-PROVEN**, 0 NOT PROVEN — bootstrap fix is real |
| 6 | **Full TAP under the M3 mutant** | **exactly 5 red / 18 green** — every positive twin, content-intact, scope-fence and expiry test **stays green**. The keystones measure the **arm**, not the function. |
| 7 | `can_read_case` scope fence | both arms are **code** (lines 55/59), not comments |
| 8 | Preflight abort | **loud** — message on stdout + `exit 1` *before any case prints*; recovers a fully-dropped `test_helpers` |
| 9 | `case_access.level` CHECK | `('read','write')` — refusal's premise confirmed |
| 10 | The B1 pin | real — a `level='read'` grant asserted to confer PHI; B1 turns it red |

The three self-reported errors are **genuinely fixed**: the stale-artifact green did not
recur (I reset and re-ran), the comment trap is gone from `prosrc` while the catalog regexes
remain strict and mutation-proven, and the preflight aborts loudly.

## e2e recommendation: **TARGETED**, not the full suite

**Reasoning.** The change is a single subtractive predicate edit with a **catalog-proven
zero-widening blast radius** (`GAINED_phi = 0`) and a **3-row narrowing** confined to bare
assignees. The application surface degrades into an **already-built, already-styled `denied`
branch** — no new code path, no crash, no raw PG error. Full-suite exposure would be
dominated by the known ~18–27 pre-existing prod-build flakes, which buys noise, not signal.

**Run:** `case-patient.spec.ts` (AC-2b is the reveal+audit path most likely to encode the old
assignee behaviour), plus `phi-remediation.spec.ts`, `patient-index.spec.ts`,
`nsp-per-hospital.spec.ts`, and `phase14a-safety-events.spec.ts` — the specs asserting the
"Identificação do paciente" surface. **Add one keyboard-only pass on the denied branch.**

**The lead must run it** (the suite exceeds the subagent cap).

**Does the frontend issue change the recommendation? No** — it *reinforces* targeted. The
`denied` branch already exists and renders pt-BR, so nothing crashes; the defect is **copy**,
which e2e does not catch and a human read does. If `frontend` amends that string, the same
targeted set re-runs. Should a targeted spec reveal that a persona relied on assignee PHI in
a *non-`denied`* path, escalate to full.

---

**Verdict: CHANGES REQUESTED** — documentation only. Correct MAJOR-1 (the live-vs-inert flag
claim, in both the migration header and ADR A36·3) and MINOR-2, and **M3's SQL ships exactly
as written**. I found no defect in the narrowing itself, and its evidence — a positive twin
proven by full-population enumeration, plus a mutation that reddens 5 and leaves 18 green —
is the strongest this program has produced.

# Session Handoff — Authorization Capability Model (ADR 0078)

**Last updated:** 2026-07-15 · **Branch:** `feat/authorization-capability-model`
(**pushed to origin**, 7 commits, `bed6eba`) · **Author:** lead session.

**Read this first when resuming AUTHZ.** Authoritative status stays [PROGRESS.md](../../PROGRESS.md);
the decision record is ADR [0078](../decisions/0078-authorization-capability-model.md)
(**read Amendments 3 and 4 BEFORE the body** — they correct it); the sequenced plan is
[authorization-capability-model](../plans/authorization-capability-model.md).

> **§7 of this file is the most valuable part.** It is the lessons, and they cost six review rounds to
> learn. **They are not AUTHZ-specific.** If you read nothing else, read §7.

---

## 1. Where we are

Gate 1 of ADR 0078. **PO-resequenced (A29):** small subtractive migrations land **before** the resolver,
because until they do, **every exclusion keystone in Gate 1 is vacuous**.

| Unit | State |
|---|---|
| **A0** — catalog inventory | ✅ **CLOSED** — `qa` APPROVED after **3 rounds each side**. Every round found real P0s. |
| **M1** — exclusion durability | ✅ built · `qa` APPROVED · committed `7b11333` |
| **M2** — platform_admin PHI destruction | ✅ built · `qa` APPROVED · committed `f0a25cb` |
| **M3** — defect ① (assignment ⇏ PHI) | ✅ built · `qa` APPROVED · committed `bee1026` |
| **M4** — false flag prose + e2e teardown | ✅ built · committed `bed6eba` |
| **M5** — defect ③ (`is_active` outer gate) | ✅ built `11a5ffd` · `qa` **CHANGES REQUESTED** (P1: the closed set was a floor) → **M5b** `d3813a1` gates the 5 doors · lead-verified behaviourally both rounds |
| **A2** — the resolver | ⏸ **NOT STARTED — was BLOCKED and re-scoped.** See §4. |
| A4 · A5 · Gate-1 exit | 🔜 after A2 |

**Gate:** pgTAP **2773/2773** · **mutation: M1 22/22 + M5/M5b 15/15 RED-PROVEN**
(`supabase/tests/mutation/{m1,m5}-mutation-audit.sh`) · lint 0/0 · typecheck ✅ · **117 migrations**.
**Local only — remote lands at the pilot reset, with separate user approval.**

### M5 (2026-07-15) — defect ③ closed; **all three founding defects now narrowed or pinned**

PO-ruled sequencing: the `is_active` gate lands as its **own subtractive migration before the
resolver**, extending A29/A35/A36 to the last founding defect. The ADR scoped it *inside* Stage A
(D3) — building it there would have put a **narrowing inside the unit sold as a mechanism swap**, the
exact shape that got A2 blocked, and would have wrecked A2's `LOST=0 / GAINED=0` equivalence proof by
forcing a mixed-axis claim (§7.7).

**Seven functions gated** (`can_read_case` · `_patient` · `can_write_case_content` ·
`can_read_action_item` · **`can_write_case_narrative`** · **`referral_target_analyst`** ·
**`can_write_attachment`**). The last three were **beyond the brief** — `backend` closed the set
(*{functions whose body touches a raw-arm table}* = 17) instead of enumerating it (§7.5).
`referral_target_analyst` was **Rule 12**: all three arms raw, no role wrapper, the **sole ungated
route to referral PHI**. `can_write_case_narrative` was flagged in **M1's own migration text** and
deferred to "the Stage-A/G sweep" — this was that sweep; a deactivated assignee was **writing PHI**.

**Two of the brief's six were deliberately NOT gated** — `can_read_case_or_admin` and
`can_reach_case_on_member_surface` are **pure delegation**; every arm resolves to an already-gated
predicate, so a gate there is a provable no-op, **unfalsifiable under A33's one-function-at-a-time
rule**, and a wasted per-row `profiles` lookup on the member surface (A5 is a hard criterion). They
carry behavioural keystones instead. **Recorded so nobody "fixes" it.**

### What M1–M3 actually fixed (all live on `main` before this branch)

**The finding that reframed the program (A27).** ETH·E1 proved *"no positive arm can out-vote the
hard-deny."* True — **and beside the point: the denied party DELETES the row the deny reads.**

- `lift_recusal` — a recused coordinator lifts her **own** recusal.
- `remove_case_participant` / `set_case_participant_role` — the **respondent** removes his own
  `respondent_doctor` row → **reads the PHI of the case in which he is the accused**.
- `dispose_case_phi` — the accused **irreversibly destroys** identifiers he **cannot read** (Rule 12).
- `set_case_confidentiality` — the excluded party rewrites the governance classification.
- `case_participant_roles` — `authenticated=arwd` + `FOR ALL` policy + **0 triggers** ⇒ an **org_admin**
  re-keys `respondent_doctor` over **direct DML: org-wide, no RPC, NO AUDIT** (a Rule 11 hole).
- **M2:** platform_admin could **destroy referral PHI it cannot read** (proven: 1 row → 0).
- **M3:** a bare phase/narrative assignee **read patient identifiers** (this ADR's **defect ①**).

---

## 2. Environment — bringing a new machine up

```bash
# 1. Docker Desktop MUST be running first (the stack is Docker; nothing works without it).
npx supabase start
npx supabase db reset          # catalog := the 115 migrations + seed. ~2 min.

# 2. Verify you match this handoff (all three; git alone is NOT enough — see §3.5):
git log --oneline -1           # expect bed6eba (or later)
ls supabase/migrations | wc -l # expect 115
docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres \
  -c "select count(*) from supabase_migrations.schema_migrations;"   # expect 115 — must MATCH the file count

# 3. The check that actually matters — the catalog agrees with the branch:
docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -c \
  "select proname, prosrc ~ 'is_case_excluded' as has_deny from pg_proc
   where proname in ('lift_recusal','remove_case_participant','set_case_participant_role');"
# expect has_deny = t for all three (M1). If false, your DB predates M1 — reset.
```

> ⚠ If the registered count ≠ the file count, **the catalog is not your branch** — reset before
> trusting *any* reading. That exact mismatch (110 files / 110 registered but a **different** set)
> is how this session started; see §3.5.

**The catalog is queried directly — this is binding, not a preference:**
```bash
docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -c "<SQL>"
```

**E2E** (never a bare `npx playwright test` monolith on Windows — it collapses):
```bash
npm run e2e:prod                                    # full gate, 18–40 min, LEAD-ONLY (subagents can't)
SPECS="e2e/foo.spec.ts" RESET=1 npm run e2e:prod    # targeted loop
# knobs: SPECS / RESET / REBUILD / BATCH_SIZE / RETRIES  → docs/testing/e2e-prod-build-gate.md
```

---

## 3. Hard-won environment gotchas (each cost real time)

1. **⛔ `npm run e2e:prod` exits 0 even when it prints `GATE RED`.** **Read the output; never trust the
   exit code.**
2. **Same-batch e2e specs share ONE database.** `nsp-per-hospital` failed 3 tests in a mixed batch and
   passed **32/32 alone**. **Batch composition changes results** — always re-run a suspect spec in
   isolation before calling regression.
3. **The local stack has exactly ONE owner.** `TaskStop` does **not** reap the e2e gate's process tree;
   it has corrupted an agent's DB for ~30 min. Never run the e2e gate while another agent queries the DB.
4. **A login-timeout flake after `db reset`** (GoTrue warmup) looks like a regression. Triage: does it
   fail at `signInAs` **before** any assertion? Does the failing test **move** run-to-run? Baseline is
   ~18–27 known flakes.
5. **This branch was 1 commit behind `main`, and the local DB already had main's migration applied** —
   so catalog ≠ branch until fast-forwarded. **Check both**, not just git.
6. `supabase db reset --local` may print `Error status 502` **after a successful reset** — it's the CLI's
   version check. Exit 0. Cosmetic.
7. **⛔ macOS ships BSD awk, and it silently broke the mutation harness.** `awk -v x="<multi-line>"`
   **dies on BSD awk** (`awk: newline in string`, `awk version 20200816`) — it emitted a garbage script,
   so **`m1-mutation-audit.sh` never ran on this machine**: M1 read **22/22 `ABSENT(aborted)`**, not
   22/22 RED-PROVEN. The recorded M1 figure was reproducible **only on a GNU-awk box**. Fixed at M5 with
   a portable `head`/`tail` split in both harnesses; **M1 re-verified 22/22 on BSD awk** (which also
   re-proves M1's denies on the three functions M5 rewrote). ⚠ **It was never a false green** — the
   tri-state reported `ABSENT`, which is the only reason it was caught. **That tri-state is the design
   feature.** A harness that reports pass/fail instead of pass/fail/**didn't-run** would have printed
   "22/22" over a script that never executed — §7.1's *`red` ≠ `abort`*, in the tooling this time.
   Two smaller traps caught the same session: Postgres regex uses **`\y`, not `\b`** (`\b` is
   *backspace* — a `case_access\b` sweep silently under-reports), and a `docker cp` before a reset left
   an empty file that diff rendered as **"all 196 rows LOST."**

---

## 4. ⛔ A2 (the resolver) — READ THIS BEFORE BUILDING IT

**A2 was blocked at authoring, deliberately, and the block was correct.** `backend` was asked to build
the resolver and returned four catalog proofs instead. **Do not simply re-issue the original A2 brief.**

**The structural finding — AN UNCONSUMED BIT CANNOT HAVE AN OVER-GRANT TWIN.** A2 as originally scoped
projected only `can_read_case`, leaving `read_standard_phi` **computed but unconsumed** — hence
**unfalsifiable** — with the narrowing landing **silently** in some later unit, no failing test in
between. That is the program's founding failure mode **inverted**: D11's member arm was a **widening
sold as a no-op**; A2 was **three narrowings packaged as "a thin projection."**

**PO ruling:** narrow the defects **first** (M3 did defect ①), so A2 is a **byte-for-byte mechanism
swap** over already-correct semantics. That is the only way it stays reviewable.

**A2 MUST carry three sources or it silently revokes live reach:**

| # | Source | Why it must be in A2 |
|---|---|---|
| **a** | **the org-admin arm** | `can_read_case` carries `is_commission_admin_of_for` **today**, and A24's source table has **no row for it**. Omit it and **A4's removal executes inside A2** — which D4·3 forbids and A5 gates. |
| **b** | **the member-arm `case_access` flag branch** | With the flag **ON** (today) `can_read_case` has **no** member arm; the **OFF** branch has one. **`228` test 24 pins it byte-for-byte.** |
| **c** | **`nsp_referral_touched`** | **LIVE** (see §7.2 — the ADR briefly said "inert"; that was **false**). Confers **content only, never PHI**. Its PHI half is **D8/N1, Gate 2**. Without it, **Stage A silently revokes live NSP content reach**. |

**Also binding for A2:** seven capabilities; the lattice is a **partial order** (`read_case_deliberation
⇏ view_case_overview`); `view_case_overview` ships **RESERVED and unconsumed**; the member arm confers
**`read_case_deliberation` ONLY** (**A15** — conferring `read_case_content` was the ADR's central error,
a 12× widening); **no assignment arm on `write_case_content`** (D10 — deliberate, do not "fix" it);
**step 6 "lifecycle" is DELETED** (A24·3 — `guard_case_status` owns terminal-freeze).

**A5 is a HARD exit criterion.** The bitmask core exists to hold per-row cost at today's
`can_read_case` level — **prove it with `EXPLAIN (ANALYZE, BUFFERS)`, don't assume it.** A4 must not
repoint every case-content policy onto a resolver that is too slow.

---

## 5. Open items

| Item | State |
|---|---|
| ✅ **STAGE B — `case_access` → `case_access_grants` HARD CUT (B1→B5) BUILT (2026-07-16, `backend`; awaiting lead gate)** | **ONE atomic migration `20260802000000_authz_b_case_access_grants_hard_cut.sql` (123 migrations).** Drops `case_access`; creates `case_access_grants` (capability-per-column, surrogate PK, soft-revoke `revoked_at`, `source` with only `manual_grant` reachable, `max_confidentiality` ranked RESERVED, active partial-unique `NULLS NOT DISTINCT`, RLS own-row SELECT + **no authenticated DML** — BUG-SUP-002). **Repoint set CLOSED via catalog** (`\ycase_access\y`, comment-stripped): 13 table fns + the doors + **the §7.5 catch the contract missed — 9 callers of `assert_case_access_enabled` (5 narrative fns + `list_my_cases` + 3 doors), all re-emitted from LIVE `pg_get_functiondef`** and diffed to prove only-intended edits. **Defect ①·2 CLOSED**: PHI is per-column (`read_standard_phi`), never inferred from read/write, never from write (A16). Doors re-cut (`grant_case_access` gains defaulted PHI params + `reason_code`; `list_case_access` projects the clearance; soft-revoke); B3 fence on `reclassify_attachment`; flag retired + UI helper collapsed to always-on. **Equivalence:** content/write/deliberation LOST=0; the only delta = the intended PHI cells. ⚠ **Dropped the plan's `expires_at > granted_at` CHECK** — it rejects the lossless migration of already-expired legacy grants AND the backdate-to-simulate-expiry test pattern; the real invariant is the door's `p_expires_at > now()`. **Gate:** pgTAP **2981/2981 fresh reset (Files=101, +238)** · **b-mutation-audit 8/8 RED-PROVEN** · a2 **11/11**, u1 **8/8**, u2 **13/13**, m1 **22/22**, a4 **8/8** survive (a2/u1 repointed) · lint 0/0 · typecheck · vitest 369/369 · **`next build` 0** · types regen `--local` · A5 spot-check index-backed (parity). ⚠ **m5 (4 cases) + m6 (1 case) have STALE mutation targets** — they mutate `can_read_case*`/`can_reach_case_on_member_surface`'s own is_active/visibility gate, but **A2 relocated those into `_case_caps` (a projection refactor that PREDATES Stage B — my migration touches none of those fns)**; the gates hold behaviourally (231/233 keystones green in the 2981 suite). NOT a Stage-B regression; retargeting them onto `_case_caps` is an A2-era audit cleanup — flagging for lead. **Tester owns `e2e/case-patient.spec.ts` AC-3b (write-grantee-reveals-PHI) — must flip.** NOT committed; lead drives the gate. **⭐ LEAD INDEPENDENT VERIFICATION (2026-07-16) — the "not reproducible" equivalence claim was WRONG and the matrix ran:** the pre-image IS reproducible (restore BOTH the migration AND the pre-B seed, reset). Full A/B reach matrix, 7 cases × 28 users = **196 cells → 2 changed, both the intended defect ①·2 PHI closure** (grant `read_case_patient`+`read_standard_phi` on→off, content/write/deliberation identical); **content/write/deliberation LOST=0, GAINED=0, 194/196 identical.** The two grant cells that DIDN'T move were interrogated: one grantee is coordinator (holds all via role — grant-PHI removal masked), the other is EXCLUDED with an active grant (**exclusion-beats-grant survived the cut**). Catalog cut re-confirmed independently (grants live · `case_access` DROPPED · flag+`assert_/case_access_enabled` gone · resolver reads grants w/ **0 legacy refs / 0 flag branch** · RLS own-row-read, no authenticated DML). Full **pgTAP 2981/2981** re-run on fresh reset (Files=101). **Tester test-pass GREEN on dev** (AC-3b both directions + SB-1..SB-5; 0 authz regressions; 2 pre-existing NON-authz reds filed — BUG-MAIO-001, BUG-AISAT-001). **✅ GATE 1 COMPLETE (2026-07-16):** `e2e:prod` 636p/32f/6flaky → **0 authz regressions** (lead-triaged: all authz-core green in prod; 4 authz-adjacent re-verified green on dev; IV2-9a 404 proven a page flake, `can_read_interview`=true); **`qa` APPROVED** (0 P0/0 major/2 minor/1 info — defect ①·2 verified byte-level through `get_case_patient`, raw-DML deny, exclusion/bootstrap/fence, mutation non-vacuity; all 4 deviations blessed) → [review](../reviews/authz-b-series-review.md); **human-APPROVED**; committed to `feat/authorization-capability-model` (local — NOT merged to main, not pushed). MINOR-1 (stale comment) fixed; **MINOR-2 carried post-Gate-1** (retarget `m5`/`m6` mutation audits onto `_case_caps` + add a2-audit `explicit_grants_only` visibility mutation). Post-pilot stages D/E/F-full unchanged. **✅ MINOR-2 DONE (2026-07-16, `backend`; local-only, NOT committed — lead to re-verify REDs before commit):** empirically confirmed the stale cases NO-OP against today's catalog — **m5: 5 vacuous cases** (`can_read_case`/`_patient`/`can_write_case_content` gate + STRUCTURAL-comments + M5b board-closure) read ABSENT (`_mut_ungate` raises `MUTATION NO-OP`: A2 made those thin projections, the `is_active` gate now lives once in `_case_caps` STEP 2); **m6: 1 vacuous case** (`policy_arm` on `can_reach_case_on_member_surface`) read GREEN (`replace()` no longer landed — the visibility arm moved to `_case_caps`). **CONSOLIDATED, not duplicated:** the relocated `is_active` gate is already RED-proven by **a2 K10** (`drop_outer_gate`) and the visibility arm now by the **new a2 `member_ignores_visibility` case** (widens the member arm to fire on the ETH `explicit_grants_only` c2 → 234 K8-twin "reads NO ata section for the explicit_grants_only case" goes RED), so the 6 vacuous cases were RETIRED (documented in-harness) rather than retargeted onto the same `_case_caps` line. **Retained is_active proofs (functions that KEPT their own gate):** m5 `can_read_action_item`/`can_write_case_narrative`/`can_write_attachment`/`referral_target_analyst`/STRUCTURAL-3-beyond + 5 M5b DEFINER doors. **Final REDs: m5 10/10 · m6 5/5 (ctrl 29 green) · a2 12/12 incl. new `Kv` (ctrl 54 green)**, each RED-proven / control green on the branch-matching catalog (123=123). No audit ships a no-op mutation. **Also swept `docs/backend-state.md`** case_access inline refs (live-surface → `case_access_grants` / flags-table row → RETIRED; dated migration-log + ADR-index rows left factual, header disclaimer broadened). Touched only the 3 mutation `.sh` + backend-state.md — **no migrations, no pgTAP `.sql`** (suite count unaffected by construction). |
| ✅ **RESIDUAL RULED — the MEETING family: ACCEPT AS-IS (OUT), PO 2026-07-16** | **PO ruled ACCEPT (low-severity residual, no migration), on lead-verified facts.** ⭐ **The read path is ALREADY GUARDED — proven, not assumed:** a recused coordinator's `can_reach_case_on_member_surface(recused_case) = FALSE`, so `meeting_cases_select` (which routes it) denies her the case's deliberation via the meeting. *(My first probe read the policy for the literal `is_case_excluded` token and got a false "0" — the deny is carried by the ROUTED predicate, §7.13·b; execution corrected it.)* **Of the 4 RPCs, only `conclude_meeting` touches case content** — an auto-generated `case_events` stamp *"Discutido na Reunião nº N"* whose body is the meeting summary **she does not author**; `reopen_meeting`/`sign_meeting`/`dispose_meeting_minutes` touch **zero** case content. So the entire residual is: *a recused coordinator concluding a multi-case meeting stamps a boilerplate "discussed in" event on her recused case — reads nothing, authors nothing.* **Not fixed because `meetings` is COMMISSION-scoped (no single `case_id`)** — a per-linked-case guard would block a coordinator recused from ONE case from concluding a MULTI-case meeting (§7.7 over-reach). **PO judged the boilerplate stamp harmless and saw no procedural bar to a recused coordinator concluding the meeting.** ⚠ **If a future pilot re-opens it, the narrow fix is: skip the `case_events` stamp for excluded-linked-cases** (conclude proceeds, other cases still stamped) — NOT a blanket conclude-block. |
| ⛔ **NEW · THE EXCLUSION PERIMETER — SPLIT into two units; blast radius CORRECTED down by reachability** | ⭐⭐ **`backend`'s perimeter contract (2026-07-16) OVERTURNED the lead's severity framing, and the lead verified it and concurs.** **The storage half is LATENT, not active:** the live product stores every case/interview PHI byte in the **`attachments`/`attachments-phi`** buckets, whose SELECT routes `can_read_attachment → can_read_case →` the deny — **GUARDED** (lead-verified: `attachments_obj_select_readable` routes `can_read_attachment=t`; the live upload `documents-actions.ts:210` is `bucketForTier(effectiveTier('case'))` → `attachments`, path `case/{caseId}/{uuid}`). The leaky **`case-documents`/`interview-attachments`** buckets are **legacy, superseded by the F2 tier fold-in, with NO product writer and NO SQL writer** (both sweeps empty; the bucket holds **one seed fixture**, `prescricao-seed.pdf`). ⛔ **So the lead's *"every commission member reads every case file; `explicit_grants_only` defeated at the bytes layer"* OVERSTATED live reachability — the same `reachability measured, not inferred` principle (PO-decision-9) the lead wrote, turned back on the lead.** The policy leak is real but its live blast radius is **empty** → **latent-P1, fix = remove the dead arm (option c), not add-exclusion-to-a-live-store.** ⚠ **The stale-comment trap was subtler than the lead framed it: the `[1]=owner_type,[2]=owner_id` comment is CORRECT for the `attachments` buckets it created — it's a right comment about a DIFFERENT bucket, mis-applied; `case-documents` is `[1]=commission_id` from another migration.** **`can_read_snapshot_document` is correctly OUT** (referral-scoped, governed by referral grants not source recusal — proven: `chefe.farm` reads via it with `is_member_of(source)=f`; **load-bearing, do not touch**). **D4·2's "fixed for free" is TRUE for the live store**; the correction applies only to the dead bucket. ⛔ **AND THE PERIMETER IS LARGER THAN THE LEAD'S FIVE — A22's "single place" closure error reproduced at scale, this time the lead's:** the same class (**DEFINER RPCs that write case content, bypassing the `NOT is_case_excluded` the tables' RLS already carries**) leaks via `assign_narrative` (proven: recused coord → SUCCEEDED; lead-verified `has_exclusion=f`, control `set_participant_patient=t`), `activate_phase`, + ~9 candidates **each needing a per-RPC behavioural probe** (the structural sweep false-positived on the guarded PHI doors and false-negatived on `grant_case_access` — a token filter is not the population). **→ SPLIT: Unit 1 (read/administer — grant doors + `create_interview`+`case_interviews_insert` both-layers + storage dead-arm removal), Unit 2 (the content-write DEFINER tail, closed behaviourally per-RPC). Both before pilot.** The seam is READ/ADMINISTER vs CONTENT-WRITE — the PO's own A2/grant-door seam. **✅ UNIT 1 DONE — `f4df6f4`, lead-verified.** Recused-coordinator grant now raises `HC0F1` (proven, made fixture); clean coordinator still grants (twin); storage `is_member_of` arm gone, `can_read_snapshot_document` kept (referral reader survives, mutation-proven both directions); `case_interviews_insert` guarded at **both** the RPC and the RLS `with_check` (BUG-SUP-002). pgTAP **2919/2919 Files=99**, U1 mutation **8/8 RED**, A4 mutation **still 8/8** after its K4 twin relocated to the live `attachments` store. **✅ UNIT 2 DONE — `49dd014`, lead-verified.** 11 content-write DEFINER leakers guarded (`assert_not_case_excluded` after the 42501 raise, placement load-bearing) + `delete_committee_action_item` both-layers (the C7 `action_items` RLS gap) + `recompute_recommendations` guarded. Proven: recused coord `update_case_meta` renamed a case to "HACKED" pre-fix, now raises `HC0F1`. pgTAP **2966/2966 Files=100**, U2 mutation **13/13 RED** (incl. both 2b layers, raw-DELETE + RPC independently), U1 still green. ⭐ **`backend` OVERRODE the lead's §3 ruling with evidence (§7.8):** the lead ruled **REVOKE** `recompute_recommendations` on a *"0 callers"* premise — **FALSE**: `add_ad_hoc_phase` + `skip_phase` are INVOKER (`prosecdef=f`) callers a revoke aborts (`backend`'s suite red-failed 7 files; lead-verified). **The lead's probe counted CLIENT `.rpc()` callers via `src/` grep, not SQL callers — §7.5, the trap the lead had invoked THIS session.** `backend` switched to the guard the lead reasoned away (`auth.uid()` unchanged by DEFINER → reads the original caller); closes the direct recused call, every legit invoker passes. ⛔ ✅ **BOTH PERIMETER UNITS LANDED + `qa` APPROVED** (`docs/reviews/authz-exclusion-perimeter-review.md`, 0 P0/0M/0min/2info). `qa`'s twin battery held (no over-reach on any legitimate principal, incl. the close-flow); C7 raw-DELETE removes 0 rows independently; §3 guard-not-revoke vindicated. ⭐ **`qa`'s one named limit — the submit-trigger→recompute path validated "by reasoning, not a live submit" — CLOSED by the lead:** `160_phase_results` does 4 case-phase-linked `submit_response`s through the now-guarded `recompute_recommendations` and passes in the 2966 suite; the guard does **not** fire on a clean submitter (no `impedido` in 160). *(A raw `psql -f` run of 160 fails on `plan() does not exist` — a pgTAP-harness artifact, not the guard; run pgTAP via `supabase test db`/pg_prove only.)* Meeting family = the residual row above. **The original finding, kept below for the lesson:** |
| ~~⛔⛔ THE EXCLUSION PERIMETER — original framing (superseded above; kept for the reachability lesson)~~ | ⭐ **This is the unifying finding of the program, and it is a FAMILY, not a bug** (`backend`, A4 contract, 2026-07-16; lead-reproduced by execution). ⚠ **The blast-radius half of this row was OVERSTATED — see the corrected row above.** **ADR 0072's hard deny (`is_case_respondent` / `is_recused_from_case`) lives INSIDE `can_read_case*`. Any surface that authorizes WITHOUT routing a case read predicate is unguarded by construction.** Known members: **`case_documents_select_member`** (storage) · **`interview_attachments_obj_select_member`** (storage) · **`grant_case_access`/`revoke_case_access`/`list_case_access`** (the row below) · **`interview_sessions_write`** · **`case_interviews_{update,delete,insert}`**. ⛔ **A22's *"`action_items_staff_admin_write` is the SINGLE place ETH·E1's exclusion was missed"* is FALSE — at least five more.** ⚡ **PROVEN BY EXECUTION, twice, independently:** with a **made** fixture (`case_recusals` row + `visibility_policy='explicit_grants_only'`), `staff1.ccih` reads **`is_case_excluded = t`**, **`can_read_case = FALSE`** — *the hard deny works perfectly at the predicate* — **and reads the case-document BYTES (`count = 1`)**. Control: `platform@test.local` reads **0**, so the probe discriminates. ⭐ **The structure is worse than a missing `AND`: the storage path's first folder segment is a COMMISSION id, so the policy is COMMISSION-scoped and CANNOT test case-level exclusion — it never knows which case the bytes belong to. Wrong anchor, not a forgotten term.** ⇒ **every commission member reads every case file**, `explicit_grants_only` (ETH·E1's entire point) is **defeated at the bytes layer**, on **PHI-capable** artifacts, and `can_read_attachment` is **never routed**. ⛔ **D4·2's *"case attachments are fixed for free"* is FALSE at the bytes layer** — true for the `attachments` **metadata** table (`'case'` → `can_read_case`), false for `storage.objects`. ⚠ **THE FIXTURE TRAP CAUGHT THE LEAD IN THE FALSELY-CONFIRMING DIRECTION:** his first probe borrowed `staff1.ccih` assuming its seeded exclusion applied — **`is_case_excluded` was `false`** (seeded on a *different* case), so "recused member reads bytes = 1" was **a plain member reading bytes, proving nothing**. Only the precondition print caught it. **Never borrow a seeded persona for an exclusion assertion — MAKE it** (§7.1·3). *(En route, `guard_case_visibility` blocked the lead's raw UPDATE — M6's D1 fix working on the man who commissioned it.)* **Reachability, measured: 0 objects in the bucket, pre-pilot, not deployed ⇒ P1-before-pilot, NOT an incident.** **PO-sequenced AFTER A5** as **its own unit, merged with the grant-door hole** — they are one defect. ⛔ **NOT foldable into A4** (`backend` declined; correct — the M7 mistake). |
| ⛔ **NEW · P1 · A RECUSED COORDINATOR CAN HAND OVER PHI — `grant_case_access` has no exclusion term** *(a member of the EXCLUSION PERIMETER family above)* | **PROVEN by execution, not inferred** (found by `backend` at A2's contract; lead-probed 2026-07-16). **ADR keystone 24 (A18) — *"recused coordinator cannot grant"* — is SPECIFIED, UNIMPLEMENTED, AND UNTESTED.** All three doors — `grant_case_access` · `revoke_case_access` · `list_case_access` — gate on `is_staff_admin_of(v_commission) or is_commission_admin_of(v_commission)` → `42501` and carry **no `is_case_excluded` / `is_recused_from_case` / `is_case_respondent` term** (comment-stripped probe, with a control column proving the probe sees the authority term). **`144` + `183` contain ZERO recusal/exclusion assertions.** ⚡ **The exploit, executed on a fresh reset and rolled back:** recuse `chefe.ccih` (coordinator) from case `…c1`, then — **CONTROL: her own reach is `false` on both `can_read_case` and `can_read_case_patient`, so the fixture is real and A2's hard deny works** — she calls `grant_case_access(c1, staff2, 'read')`: **it SUCCEEDS**, and `staff2`'s `can_read_case_patient` goes **`false` → `true`. She then `revoke_case_access`es it — also succeeds.** ⭐ **The shape: recusal gates READING, not ADMINISTERING.** A coordinator who cannot read one byte of the case decides who else reads it, and can obstruct a legitimate grant on the case she is recused from. Blast radius is bounded by `is_member_of_for(v_commission, p_user)` (grantee must be a commission member) and by the hard deny (she cannot grant reach to **herself** or the **respondent** — K9 beats any grant), **but a third party is wide open, and a `case_access` row confers `read_standard_phi` today** (A24·7's amended `manual_grant` row; `234` K7 mutation-proves it). ⛔ **NOT folded into A2 — deliberately.** A2 is a **read** resolver; this is a **write** door. Folding it in would be the M7 mistake ruled against in the same session, and `backend` was right to decline. ⚠ **This is NOT the flag-OFF legacy arm's situation** — that one is **dead code D9 already deletes**; this is **live, reachable, and nothing deletes it**. **Needs its own unit before pilot.** Not deployed (local only), so it is P1-before-pilot, not an incident. |
| ✅ **A5 — PERF GATE PASSED, no migration (2026-07-16)** — `backend` measured, lead-corroborated | **The resolver is parity-or-FASTER on every legitimate surface, strictly LINEAR.** `EXPLAIN (ANALYZE, BUFFERS)`, 2005-case synthetic (4× re-measured), pre-image = **A2+A4 both moved out** + reset, median of 5, as `authenticated`. Pre-A2 vs resolver: cases/coordinator **1.02×**, cases/member **0.73×**, narratives/member **0.75×** — the member path is *faster* because A4 collapsed the `can_read_case_or_admin` deny wrapper the pre-A2 member paid. **`qa`'s ~10× (MAJOR-1) was resolver-vs-a-single-arm; against the real pre-A2 body it does not exist** — MAJOR-1 resolved, no regression. **Lead corroboration** (independent, in-txn @ 2005 cases): member **0.496 ms/row** / coordinator **0.183 ms/row** (matches `backend`'s 0.59/0.205), **Bitmap Index Scan** = the linearity mechanism, coordinator resolver InitPlan **"never executed"** = the permissive-sibling short-circuit proven. ⚠ **Report correction (verdict holds):** the board is 0-resolver-cost **only for coordinators** — `list_cases_board` runs `can_read_case` per-row for non-coordinator members (as does the RLS `cases` path); `backend` measured that path. **Referral inbox correctly out of scope** (never routes the resolver). ⭐ **DEFERRED, PO ruling: drop `manage_case_access`** — **~19%** of per-row cost, **0 consumers**, droppable — but a RESERVED bit, a semantic change needing its own keystone + `qa`; **not required for the gate.** Next: **the exclusion-perimeter unit**, then Gate-1 exit. |
| ✅ **A4 — DONE and lead-verified (2026-07-16)** — `bf86711` | **Organization admin ceases to be a Case Content source.** ~19 policies + **4 functions** narrowed (A21's eight were real but its **closure** was wrong — §7.9; +interview family, +`action_items` **scoped**, +2 storage org arms). ⭐ **The 4th function target, `can_write_interview`, was `backend`'s own K2 catch:** the 7 interview `FOR ALL` policies **route** it, and it carried the org arm — so removing the arm from the policies alone was a **no-op** (§7.6, A21·1 "remove read AND write"). Building green without it ships a **green suite over a live leak**. **Lead-verified independently:** pgTAP **2898/2898 Files=98** fresh · **120=120** · A4 mutation **8/8 RED** (K2 RED at **both** the policy and the function — the 4th target is load-bearing) · **A2 mutation STILL 12/12** after A4 repointed its K2 onto `manage_case_access` — the resolver's proof survived · **A/B 5-predicate/1960-cell, pre-image asserted real** (`can_write_interview` org arm **1→0**): **LOST=120 flips** (`can_read_case` 40, `reach` 40, `can_read_case_or_admin` 40), **GAINED=0**, **PHI control 0/0**, write 0/0 — *the 5th predicate mattered: A2's 4-wide matrix was blind to `can_read_case_or_admin`* · behavioural: org_admin interviews **0**, coordinator **2** (twin), config **3/3**, `can_read_case` false · no PUBLIC. **5 sibling `.sql` test files + the a2-audit harness updated, each relocating discriminating power not losing it: `144` (INFO-N1 org-admin interview reads 4× `1→0`), `171` (cases 0 in-org, noun rule intact), `228` (MAJOR-1 control `1→0`, isolation → 234 K9), `229` (M1·4b twin `sa_y`→`sa_x`), `234` (K2 inverted) + `a2-mutation-audit.sh` (K2 repointed).** ⚠ **`qa`'s A4 INFO-1 correction: the commit message named the wrong five — it listed `a2-audit` and OMITTED `144` (a substantive 4-assertion edit). The record undercounted its own diff by one** — the same "record wrong about itself" class as the M5-review row above; the code was correct, the enumeration was not. **F1 confirmed:** the wrapper collapses to `can_read_case`; D2's one-source claim is no longer aspirational. **⛔ NOT folded in:** storage member-bypass + write-side org residue → **the exclusion-perimeter unit** (after A5); `action_items` still lacks C7's exclusion → **flagged in the migration comment** where C7's author stands. `manage_case_access` **kept on SCOPE grounds** (granting is neither content nor PHI), explicitly **not** "the door needs it" — 0 consumers, a §7.11 false arrow. **Next: `qa`.** |
| ~~A2 → A4 → A5 → Gate-1 exit~~ *(A2 row — kept)* | ⭐ **A2 is DONE and lead-verified (2026-07-16)** — `14529f0`. `app._case_caps` (bitmask core) + `has_case_capability` (RLS bit-test projection) + `case_capabilities` (jsonb, debug); **4 predicate bodies swapped**, callers unchanged. **LOST = 0 / GAINED = 0 over 1568 cells (392 × 4), 369 reachable, measured at BOTH flag states** — a live-state-only matrix cannot observe source (b) and would report LOST = 0 vacuously while `228` t24 goes red. **pgTAP 2864/2864 Files=97** fresh reset · **mutation 12/12 RED-PROVEN, control green (61 ran)** · 119 = 119 · lint 0/0 · `database.ts` unchanged (`app.*` only; PostgREST serves `public`) · no PUBLIC on the ACL. **⭐ The audit caught TWO of the author's own keystones asserting nothing, and review caught neither** (§7.1 again): **K9**'s hard-deny row assertion stayed **GREEN with the deny dropped** — `can_read_case_or_admin` carries its **own** deny and does not delegate; **K1**'s coordinator assertion stayed **GREEN with the source deleted** — `cases_staff_admin_write` is **`FOR ALL` PERMISSIVE** and grants SELECT **without touching the resolver**. Both repointed at `case_participants`; both RED-PROVEN. ⛔ **F2 — THE ONE A4 MUST READ: removing the org-admin source from `_case_caps` will NOT remove org-admin case read**, because those `FOR ALL` policies grant it directly — **A4 must narrow POLICIES, not sources** (= ADR keystone 23 / A21, now catalog-confirmed and mutation-proven). `backend`'s probe reads **36** `FOR ALL` policies with a resolver-independent admin arm and it **explicitly reports that as a raw reading, NOT A4's population** — the ADR says eight; **which are case material vs. legitimate configuration is a per-policy judgement no text filter makes** (§7.5), and keystone 23 **fails if the negatives over-reach**. **Do not treat 36 as a floor or a fix list.** **F1:** `can_read_case_or_admin` remains the second hard-deny body D2 exists to prevent — **A4 dissolves it for free** (drop the org arm ⇒ the wrapper collapses to `can_read_case`); until then **D2's one-source claim is aspirational for that path**. **F4 (permanent):** with every arm in one function, *"which arm confers which bit"* is **not text-separable** — defect ①'s fence is **behavioural from now on** (`230` t20-22 + `234` K5, mutation-proven), and `230` t23/t24 are **annotated as near-vacuous rather than deleted**. **Next: `qa`, then A4 → A5 → Gate-1 exit.** |
| ~~A2 → A4 → A5~~ *(pre-A2 note, kept for the standard it set)* | **A2 is now a genuine mechanism swap** — all three founding defects are narrowed (M3 ①, M5 ③) or pinned (① half 2 → B1), so A2's proof is a clean full-population equivalence: **`LOST = 0, GAINED = 0`**. Any loss means A2 smuggled a narrowing. |
| ~~**`qa` review of M5** — *"not run"*~~ ⛔ **FALSE. IT RAN.** | **Corrected 2026-07-16.** `docs/reviews/authz-m5-review.md` — **15 KB, `CHANGES REQUESTED`, one P1**, `qa`, 2026-07-15, commit `11a5ffd`; **committed in `26ef72d`, whose own message says *"M5b record + qa's review"***. **The P1 was the word "CLOSED"** — the set was closed over `app.*` predicates and **presented as closed over the population**, while three live `SECURITY DEFINER` RPCs authorized on the raw arms with no gate. **M5b fixed it** (`20260727000000_authz_m5b_door_is_active_gate.sql`, applied). ⭐ **And §7.9 — the lesson this handoff teaches — was BORN from that P1.** So the row asserted the review never happened while, two sections down, the same file taught the lesson the review produced. ⚠ **This row was stale for a day and it was ARGUED FROM:** the lead cited *"M5 is the first unit to skip it"* in the **A2 qa brief**, as live context, to a reviewer who could have refuted it in one `ls`. **A tracker row is prose. `docs/reviews/` + `git log` are the state.** Same shape as the flag whose `description` said "Ships OFF" while `enabled = t` (§7.2·1) — **and this time the stale text was in the file that records §7.2.** *Nothing here was wrong about M5; the record was wrong about itself.* |
| **✅ `qa` review of A2 — APPROVED (2026-07-16)** | `docs/reviews/authz-a2-review.md`. **0 P0.** ⭐ **It answered the lead's actual question:** the `230`/`231` repoint is sound because **`case_participants` has exactly ONE policy** — `case_participants_select = app.can_read_case(case_id, auth.uid())`, a **pure projection and the only path** — so K1's positive and K9's negative genuinely measure the resolver. **Defect ① is still guarded behaviourally** (K5 both legs → RED, `qa` ran it). It swept every ROWS door in `234` for the **permissive-sibling** shape (§7.1·6) and found **none**; the strongest candidate, **K6**, is real (`case_events`' only admitting arm routes through `can_write_case_content`). It also proved the harness **cannot manufacture a RED**: a non-matching `replace()` leaves the body identical and reads **GREEN/NOT-PROVEN** — so **12/12 RED is itself proof every mutation landed**. ⚠ **Its own probe was blind once and it said so**: `\ycan_read_case\y` **cannot match `can_read_case_patient`**; only its control column caught it, and it re-derived every affected conclusion. |
| **✅ `LOST = 0 / GAINED = 0` — INDEPENDENTLY REPRODUCED (lead, 2026-07-16)** | ⭐ **`qa` flagged the honest limit — *"I verified the denominator, not the diff"*** — because the pre-A2 bodies are **unrecoverable from file text** (M5b rewrites `can_read_case` at runtime via `pg_get_functiondef()`), so the diff needs a DB at `14529f0^` and a reset `qa` doesn't own. **The lead owns the reset and ran it:** migration moved out → `db reset` → BEFORE snapshot → restored → `db reset` → AFTER. **Result: IDENTICAL over 392 rows (1568 cells), 369 reachable** — matching `backend`'s 369 and `qa`'s independent 159 ON + 210 OFF. **Controls that make it a real diff, not two nothings:** `_case_caps` count **= 0 in BEFORE** and **= 1 in AFTER** (the pre-image was genuinely pre-A2), both snapshots **392 rows**, **369 reachable-true**. ⛔ **The harness needed TWO fixes first and BOTH were invisible to reading — see §7.10·b**: zsh not word-splitting `$PSQL` (both snapshots = one line of error text, and the diff would have printed `IDENTICAL — LOST=0` from two error messages had their line numbers matched), then `psql -f` given a **host** path while running **inside the container**. **Both were caught by the control, never by reading the script.** A third control (`EXPECT=784`) was itself wrong — 7 × 28 × 2 = **392 rows** — and would have produced a **false abort**: over-strict is survivable, over-permissive is not. |
| **A30 buckets B (7 tenant-non-PHI arms) + D (1)** | **deferred by PO**; bucket C (PHI) shipped in M2. Census: `authz-a30-platform-admin-inventory.md` |
| **§3.6 carry** — remaining triage doors + per-row filters | `qa` verified **durability is unaffected** (it called every carried door the excluded party can reach; the deny held). **Keep it triage, NOT a fix list** — `get_case_patient` is a **verified false alarm**, and a text-filter sweep would over-reach (**keystone 23 fails if the negatives over-reach**). |
| **Defect ①'s second half** (`case_access` grant has no PHI filter) | **Deliberately deferred to B1.** `case_access.level` is `('read','write')` = **write authority**; filtering PHI on it would encode `write ⇒ read_standard_phi`, which **A16 puts on disjoint chains**. The real capability is `case_access_grants.read_standard_phi`. **`230` + e2e `AC-3b` PIN today's behaviour so B1 lands as a VISIBLE failing assertion.** |
| **✅ `visibility_policy` — CLOSED by M6 (2026-07-16)** | **D1 + D2 FIXED; D3 reported-not-fixed; D4 stands (Q3 forward-only).** Migration `20260728000000_authz_m6_visibility_policy_door.sql` · keystones `supabase/tests/233_authz_m6_visibility_door.sql` (**29/29**, all 29 **proven to RUN**) · **A33: 6/6 RED-PROVEN** (`supabase/tests/mutation/m6-mutation-audit.sh`, control green). Suite **2802/2802** on a fresh reset. **What shipped:** `public.set_case_visibility(uuid,text)` — authority `HC0F5` → exclusion `HC0F1` → validation `HC0F6` (M1·4 order), explicit `app.audit_write('case.visibility_changed')`, `REVOKE…FROM PUBLIC` before `GRANT`; **new** `app.guard_case_visibility` trigger (`BEFORE UPDATE OF visibility_policy`, `check_violation`, mirroring `guard_case_status`; `guard_case_status` itself untouched); seed ethics type default → `commission_default`. **Equivalence measured, not inferred:** full A/B reach matrix over **196 cells** (7 cases × 28 users) with the guard+door dropped and the seed fix undone on the live catalog — **LOST = 0, GAINED = 0**, and **74/196 cells reachable** so the matrix had something to lose (an all-`f` matrix shows LOST=0 vacuously). ⛔ **NO FEATURE FLAG, deliberately** — `can_reach_case_on_member_surface` reads the column with **no `feature_enabled` call**, so an unconditional guard + a flag-gated door would build a **lockout** (flag OFF ⇒ column still governs reach, correction door gone) — §7.7's bind-too-much, and borrowing `assert_case_participants_enabled()` from the model would be §7.8 (that flag governs the **roster**, not visibility). **Invariant for the next author: the door's availability must equal the column's liveness.** ⭐ **Why the exclusion line is load-bearing:** the live qual of `cases_staff_admin_write` is `(is_staff_admin_of OR is_commission_admin_of) AND (NOT is_case_excluded(...))` — **the RLS already carried the exclusion term**, and the RPC is `prosecdef = t` so RLS never applies to it. Authority **alone** would have made the door **WIDER** than the PATCH it closes. The brief asserted parity while printing the qual that disproved its reasoning; parity holds, for a different reason. Proven by mutation: revert that one line and **the accused doctor re-opens the case in which he is accused** (`not ok 14: caught no exception / wanted HC0F1`; `not ok 15: have commission_default`). ⚠ **The fixture is the trap:** **no seeded persona is both excluded AND authorized** (`staff1`/`staff4` excluded but plain `staff`; `chefe`/`orgadmin.a` authorized but not excluded) ⇒ an exclusion keystone on a seeded persona raises **HC0F5, never HC0F1** — green, asserting nothing (§7.1 trap #3). `233` **makes** the respondent a `staff_admin` and asserts **both legs** (`PRE ⭐`) first. ⛔ **D3 — the PO's "the seed fix makes divergence unreachable" hypothesis is FALSIFIED** (§7.11's arrow again, **inside the unit whose brief recorded §7.11**): *"ethics is the only type and its default is now `commission_default`"* (**true**) + *"so divergence can't happen"* (**inferred — assumes a CLOSED row set**). `case_types_admin_write` is `FOR ALL` on `is_admin() OR is_org_admin_of(...)`; **probed as `orgadmin.a`: minted a type carrying `explicit_grants_only` (`INSERT 0 1`) and flipped the ethics row back (`UPDATE 1`).** `case_types` is a **runtime-writable catalog**, not a fixture — **do not re-derive a fantasy about a closed catalog.** D3 is *unreached*, not unreachable: **no RUNTIME caller passes a case type** — `src/` and `e2e/` are clean (the only `p_case_type_id` in `src/` is the generated signature in `database.ts`), so the type default is read by **nothing in the product** today, which is also why E2E exposure is **zero** (`ethics-e1-access-spine` uses the seeded direct-insert case, not the template door). ⛔ **The original wording — *"no caller ANYWHERE passes `p_case_type_id`"* — was FALSE, and its falseness is the interesting part** (`backend`'s MINOR-1, §7.5 from the engineer who wrote §7.5: an unscoped universal). **`228_ethics_e1.sql` passes a case type THREE times** — `:133`, `:153`, `:170` — and **test 11 is a live pin on D3's divergence**, asserting the template door *does* honour `default_visibility_policy` (`explicit_grants_only`), with test 12 pinning the flag-OFF suppression. The conclusion survives (228 bootstraps its own type row at `:125`; the product is clean); the **method** did not. ⚠ **AND THE PROBE THAT "PROVED" IT IS A FALSE-ZERO GENERATOR — a seventh *text is not truth* (lead, 2026-07-16):** `grep p_case_type_id supabase/tests/` returns **0 matches** while three callers sit there, because **SQL callers pass POSITIONALLY** — `create_case_from_template(tid, 'Caso ética', null, null, '…e0002')`. The parameter name appears **only** in the definition, never in a call. **Grepping a parameter name to find callers cannot work in SQL, and it fails silently — §7.10's exact shape, and it read zero for the same reason the zsh-glob grep did.** Close the set on the **function name**, then read the **arity** of each call. **Fixture note:** `230` line ~165's two visibility writes are **state setup, not assertions** — now wrapped in `set_config('app.in_case_rpc',…)`, the established convention (`110_case_status`, `114_phase_blockers`, `160_phase_results` all do it because `guard_case_status` forces the same). No M3 keystone changed; `230` went 20/25-aborting → **25/25 all ran**, and its `explicit_grants_only ⇒ no PHI` keystone only passes if the fixture write LANDED, so it self-verifies. **Historical record of how this was found → [authz-visibility-policy-brief](./authz-visibility-policy-brief.md)** (three probe-free lead inferences, all wrong; §7.11). |
| **~~⛔ `visibility_policy`: unguarded, silent~~ (superseded by the row above — kept for the §7.11 lesson)** | **→ FULL BRIEF: [authz-visibility-policy-brief](./authz-visibility-policy-brief.md).** Catalog-verified + **probe-proven** 2026-07-16 (lead). ⛔ **The lead's own 2026-07-15 entry here — *"nothing writes it post-creation, so it can never be corrected"* — was WRONG, asserted without probing, and in the OPPOSITE direction of the real risk.** A door exists; it is the **wrong** door: `cases_staff_admin_write` is `FOR ALL` to `authenticated`, `authenticated` holds table `UPDATE`, **no trigger guards the column** ⇒ a **staff_admin widens an ethics case by raw `PATCH`**, **proven** `f → t → f` on a plain non-excluded member. **And it is SILENT** — `trg_audit_cases` writes only on INSERT or a **`status`** change, so the flip emits **audit delta = 0** (**Rule 11 hole**). The contrast indicts it: **`status` is trigger-blocked** (*"must go through the case RPCs"*) and `confidentiality_level` **has** an RPC (`set_case_confidentiality`) — the **authorization** column has neither, and **zero product surface** in `src/` (generated types + one read-only query). Creation doors still disagree: `create_case` **never writes it** (takes `commission_default`); `create_case_from_template` honours the type default iff a type is passed **and** `case_types` is live (**it is, `enabled=t`**). **No case records its type** (no `case_type_id` on `cases`; `process_templates` has none either) ⇒ a corrected default can **never** be re-applied. Live: 6 `commission_default` / 1 `explicit_grants_only`; **`ethics` still seeded `explicit_grants_only` — the value A1 ruled WRONG** (`seed.sql:2107`/`:2118`; the one-token fix never landed). ⛔ **AND THE LEAD'S REPLACEMENT CLAIM WAS ALSO WRONG:** *"the seed fix changes A2's diff population, so it must land FIRST or the `LOST=0/GAINED=0` proof expires"* is **RETRACTED — FALSE**. The seeded ethics **case** takes its policy from a **direct insert** (`seed.sql:2118`), **not** the type default; `default_visibility_policy` is read **only** by `create_case_from_template` at runtime; `case_types` has **no triggers**, `cases` no FK. **Probed: flipping the type default moves 6/1 → 6/1 — inert for every existing case.** ⇒ **M6 does NOT block A2** (independent; merely serialized — both `backend`, both in `supabase/migrations/`). ⛔ *"Blocks A3"* was likewise an overstatement — **A3 inherits** through the case rule. **Three claims, three probe-free inferences, one thread** (*"no door"* → *"blocks A3"* → *"must precede A2"*). **The lead cited §7.9 to justify an urgency he had inferred rather than measured — a borrowed lesson is not a probe, and quoting the lesson is not applying it.** ⚠ Two probe traps hit live: the first widening run used an **`is_case_excluded = t`** fixture, so the hard-deny masked the widening and it read `f` — **a negative from a poisoned fixture proves nothing**; and a `grep --include=*.ts` **died on zsh globbing and reported `0` matches** (§7.10: the reading that never moved). |
| **Full `e2e:prod`** | run at the merge gate (M1 ran it: 274/1/1, triaged) |
| **Remote deploy** | **pilot reset only**, with explicit user approval. Nothing here touched remote. |

---

## 6. PO decisions made this session (do not re-litigate)

1. **A29 — resequence:** exclusion durability **before** the resolver.
2. **A30 — fold the platform_admin fix into this program**; then, given the census: **bucket C only now**,
   B/D deferred.
3. **The noun rule** (39/40 mechanical): platform_admin **MAY** touch **tenancy · identity · vocabulary ·
   audit**; **MAY NOT** touch **commission content or PHI**. ⚠ The obvious line — *"never touches a table
   with `commission_id`"* — was **tested and REJECTED**: it strikes `commissions_admin_write` +
   `memberships_select` (**breaking tenant onboarding**) while **missing `professional_credentials`** (no
   such column). **Rule on the noun, not the column.**
4. **CLAUDE.md §1 amended** to the noun rule — *"walled off from all tenant data"* was **stated too
   absolutely** (platform_admin reads 0 cases / 0 responses / 0 narratives / 0 meetings), false 12×.
   **An aspirational rule in a binding rulebook is worse than an accurate narrow one.**
5. **M3 first** — narrow defect ① before the resolver.
6. **The `Bash` graphify hook-guard is OFF** (`.claude/settings.json`) — it injected *"MANDATORY: run
   graphify before grepping"* into every `psql` call. graphify **does not index SQL**. The exception is
   now binding in **CLAUDE.md**.
7. **`visibility_policy` (2026-07-16):** ① land A1's ethics seed correction now · ② a new guarded,
   coordinator-only, audited `set_case_visibility` RPC mirroring `set_case_confidentiality` · ③
   **forward-only** — no `case_type_id` schema, no retroactive migration · ④ fix D1 + D2 in-unit.
   **All four shipped in M6.**
8. **The `setCaseVisibility` app action + coordinator control → ETH·E2 (S4)**, with its four siblings,
   once the resolver is final. **Not built in M6, deliberately.** The contrast that justified M6 —
   *"`confidentiality_level` has an RPC **and an app action**"* — was **false**: all four ethics actions
   (`declareConflict`, `recordRecusal`, `liftRecusal`, `setCaseConfidentiality`) are **contract-first
   stubs that throw**, with **0 UI bound to any**. M6 met the house standard exactly; **no sibling has a
   product door either.** Building one real action beside four frozen stubs, with **A2 unstarted**,
   would have bound UI to predicates about to be replaced — the exact collision the S3 → AUTHZ → S4
   sequencing exists to prevent.
9. ⭐ **A2 → `qa` → A4 → A5 → the grant-door unit (PO, 2026-07-16).** The **recused-coordinator grant
   hole** (A18/keystone 24 — see §5) is sequenced **AFTER A5**, as **its own unit**, before pilot.
   **Rationale: it is a WRITE door; A2/A4/A5 are the READ resolver.** Folding it into A2 would have been
   the M7 mistake — and note the symmetry, because it is the whole lesson of this session: **the
   flag-OFF legacy PHI arm was NOT worth a bespoke migration ahead of A2 (dead code, unreachable, D9
   already deletes it), while the grant hole IS worth its own unit (live, reachable, nothing deletes
   it).** Same question, opposite answers, and **the deciding fact is reachability — measured, never
   inferred.** *Neither answer is derivable from how alarming the finding sounds.*

---

## 7. ⭐ THE LESSONS

**These cost six review rounds. They generalize far beyond AUTHZ.** Every single real defect here was
found by an **independent check** — never by careful reading. Reading code was **not once** sufficient.

### 7.1 A test that cannot fail is not evidence — MUTATION-TEST IT

**NINE keystones on this program could not fail**, two of them ⭐, one **Rule 12**. **Review found
none of them. Reverting the fix and requiring the test to go red found every one.** *(Was seven; **A2's
audit found two more — in the author's OWN brand-new keystones, written by the engineer who has been
applying this lesson all program, in the unit whose brief quotes it.** The count keeps rising because
the audit keeps running. That is the argument.)*

An over-grant twin is **necessary but not sufficient — the twin itself can be vacuous.** Six shapes,
each green while asserting nothing:

1. **Wrong-arm fixture** — an earlier *positive* twin left the principal **self-recused**, so every later
   assertion measured the **recusal** arm while the fix under test guarded the **respondent** arm.
   *The trap: a fixture that leaves the principal denied by a **different arm** than the one under test.*
2. **Pre-existing deny** — a trigger hard-forced `visibility_scope := 'case_restricted'`, whose arm
   delegated to `can_read_case`, **which already carried the deny before the fix**. The keystone proved a
   deny the migration didn't make.
3. **Missing precondition** — a fixture offered as *"seeded and ready"* used a persona who was plain
   `staff`, so the door **correctly** raised on **authority**; `throws_ok` caught it and passed. Write
   preconditions **narrowly** (respondent **AND** `staff_admin`).
4. **Un-keystoned deviation — the most fragile artifact.** A spec'd fix gets a keystone by construction;
   **a fix the engineer was right to invent gets none, because nobody was owed a test for it.** *Every
   single unguarded item on this program was something the engineer invented.* **An unasserted fix is
   indistinguishable from no fix, and "0 failures" says nothing.**
5. **Defensive branching (Playwright)** — the failing assertion sat inside
   `if (!panel.isVisible()) { …; return }`, so the UI half could skip entirely. **It converts "not
   implemented" into "passing."** Worth sweeping `e2e/` for.
6. **⭐ NEW (A2, 2026-07-16) — THE PERMISSIVE SIBLING. A positive row-assertion is satisfiable by ANY
   policy on the table, not the one you are testing.** Postgres **OR**s permissive policies together, so
   *"principal X reads row R"* proves **nothing** about predicate P unless P is the **only** grant of R.
   Both of A2's vacuous keystones are this: **K1** asserted the coordinator reads the `cases` row and
   stayed **GREEN with the coordinator source deleted** — `cases_staff_admin_write` is **`FOR ALL`
   PERMISSIVE** and grants SELECT on `(is_staff_admin_of OR is_commission_admin_of) AND NOT
   is_case_excluded`, **never touching the resolver**. **K9** asserted the respondent reads **zero**
   `cases` rows and stayed **GREEN with the hard deny dropped** — `can_read_case_or_admin` carries its
   **own** deny and does not delegate (shape 2's cousin: *a deny the code under test didn't make*).
   ⚠ **The direction matters and inverts:** a **positive** assertion is faked by a permissive **sibling
   grant**; a **negative** is faked by a **sibling deny** — so **neither polarity is safe**, and the
   table you assert on decides which. **Fix:** assert on a table reached **ONLY** through the predicate
   under test (`case_participants` here — `cases` itself is hopeless: it carries a `FOR ALL` write
   policy). **Before writing a row-assertion, list every policy on that table and prove yours is the
   only path.** ⛔ **`FOR ALL` PERMISSIVE policies are this program's single most persistent structural
   blind spot** — they hid A21/keystone 23, they are why A4 must narrow **policies not sources** (F2),
   and now they have faked two keystones. **If a table has one, assume your assertion is vacuous until
   you have mutation-proven otherwise.**

**The structural defence that works:** give **authority** and **exclusion** distinct SQLSTATEs and check
**authority FIRST** (`HC0E4` before `HC0F1`). A twin whose principal lacks the precondition then fails
**loudly** instead of being caught. **It makes the vacuous keystone unwritable rather than merely
discouraged** — and immediately caught one the author had just written.

**And the inverse: `red` ≠ `abort`.** The harness twice reported *not-falsifiable* when the suite had
**aborted** (a dropped trigger killed an INSERT derivation → CHECK violation → the test never ran), and a
reviewer's own regex printed `tests_run=0` from an unbalanced paren — **nearly filing "nothing went red"
as evidence, reproducing the exact false-negative it was auditing.** **Never accept "0 failures" until
you have proven the tests RAN.** Mutate **one function at a time** — a global neuter reverts everything
and proves nothing about any single keystone.

### 7.2 "Text is not truth" is broader than migration files — SIX instances

The rule was *"file text is stale; read the catalog."* True, and **too narrow**. The last instance fooled
**the engineer who formulated the rule**, and then **the lead who was enforcing it**.

1. **A flag's `description` is prose. Only the `enabled` column is the flag.** `case_referrals`'s
   description says *"Ships OFF"*; its `enabled` column is **`t`**. It was reported `f`, written into a
   **permanent ADR** unverified, and declared a **LIVE PHI arm "inert"** — **in the urgency-suppressing
   direction**. A third reviewer caught it.
2. **A `prosrc` text match counts `--` COMMENTS.** A census read 42 sites; **40** were real — three
   "matches" were comments **documenting the arm's removal**. The same trap then hit a migration's own
   removal comment (it quoted the deleted arm, so the self-check matched the comment and the migration
   refused to apply) — **and again inside the comment warning about it**. **You cannot quote the string
   you are asserting the absence of.**
   > ⛔ **THIRD STRIKE, 2026-07-16 — and this time it was the lead, in a brief that cites this very
   > instance, one hour after using this trap to close `backend`'s MINOR-1.** The A2 brief reported
   > *"`can_read_case_patient` has **5** DEFINER consumers"*. It has **3**: `lift_recusal` and
   > `remove_case_participant` match **only inside `--` comments**. The **control** run was
   > comment-inflated too (`can_read_case` → "15", really 4 policies + 10 callers). ⚠ **The conclusion
   > survived and that is the danger** — 3 vs 5, still all DEFINER, still 0 policies, so nothing looked
   > wrong. **A method failure with a surviving conclusion leaves no evidence.** `backend` caught it.
   > ⭐ **§7.11, demonstrated on this page: this section's own *How to apply* has said "Strip comments
   > before any `prosrc` regex" since the day it was written.** Reading the rule, citing the rule, and
   > *teaching* the rule to a teammate all failed to apply it. **Stop treating this as discipline.
   > Paste the idiom:**
   > ```sql
   > with b as (select p.oid, p.proname, p.prosecdef,
   >                   regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src   -- ⬅ non-negotiable
   >            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   >            where n.nspname in ('app','public'))
   > select proname, prosecdef from b where src ~ '\ytarget_name\y';  -- \y, NOT \b
   > ```
   > ⛔ **BUT `\y` CUTS BOTH WAYS — it manufactures FALSE NEGATIVES when your target is a PREFIX of a
   > longer identifier** (`backend`, A4 contract, 2026-07-16). **`\yis_commission_admin_of\y` cannot
   > match `is_commission_admin_of_for`** — **`_` is a word character, so there is no boundary there.**
   > `backend`'s `\y`-anchored probe read the org arm as **ABSENT** from `_case_caps`; the lead's
   > **sloppier** unanchored `~ 'is_commission_admin_of'` read it correctly. ⭐ **The rigorous probe was
   > wrong and the lazy one was right** — anchoring defends against false *positives* and pays for it in
   > false *negatives*, and this codebase is full of `X` / `X_for` helper pairs where that bites.
   > ⭐ **The durable structural half:** **functions call `is_commission_admin_of_for`; POLICIES call the
   > bare `is_commission_admin_of`. Two different helpers — NO single regex finds both.** Sweep for one
   > and you miss half the surface. **Probe for the prefix unanchored, then disambiguate by reading.**
   > ⚠ **And the reason it was caught at all, in `backend`'s words — worth more than the finding:**
   > ***"It only got caught because it disagreed with you. Had it agreed, it would have shipped."***
   > **That is §7.4 stated better than §7.4 states it: an independent check only pays when the two
   > readings DISAGREE — agreement between two probes with the same blind spot is worth nothing.**
3. **Stale claims live in TypeScript too** — two files and a component asserted a gate *"Mirrors
   dispose_referral_phi EXACTLY: `is_admin()` OR …"* long after the arm was gone.
4. **A plausible variable name is not a role.** The `admin` persona (`…001`) has **`is_admin = false`**;
   the real platform_admin is `platform@test.local` (`…b0`). A keystone on the named persona **denies for
   the wrong reason and asserts nothing**.
5. **A comment citing a migration that no longer exists** (folded into the baseline squash) — a reader
   verifying it finds nothing, concludes the comment is wrong, and "fixes" it **back into the bug**.
6. **`prosecdef` belongs beside `pg_policies`.** A `SECURITY DEFINER` function's gate **replaces** RLS —
   so a **policy-shaped audit is structurally blind to it**. That one omission hid the three largest
   findings. *File text lies — **and policies are not the population.***

**How to apply:** resolve the **value**, not the noun. `enabled` column, not `description`. `prosecdef` +
**resolved delegation**, not a name. **Behaviour under `set local role`**, not a predicate's return value
— and **never an error code** (a `23514` that was a *reason-code check* nearly cleared a live PHI
destruction door). **Strip comments before any `prosrc` regex.**

### 7.3 A reading is not a fact until it's pinned to the state you're claiming about

**The whole flag saga resolved to this.** `backend` read `case_referrals = f`; the lead read `t`.
**Both readings were correct. Neither was a fact.** One read **after an e2e run**, the other **after a
reset** — because `e2e/case-patient.spec.ts`'s teardown set three flags to `false`, commented *"Restore
(seed default — flag ships OFF)"*, driving the shared stack into **a state no environment ships**.

**"Live catalog only" is necessary but NOT sufficient — the catalog is truth at a POINT IN TIME, and
this stack is reset constantly.** The durable fix: **assert the state, don't claim it.**
`select is(app.feature_enabled('case_access'), true, …)` — a flag **asserted** cannot go stale silently.
Suites now assert their flag preconditions (`229` +3, `230` +2).

⚠ **And a green suite proves nothing about teardown.** Proven by A/B: **the old code was 17/17 GREEN and
corrupting simultaneously.** If a teardown matters, **assert the post-run state**, not the suite result.
**Restore a *captured* value, never a hardcoded guess** — a hardcoded `true` goes stale exactly like the
hardcoded `false` it replaces.

### 7.4 The second check must be INDEPENDENT

A0's rule — *whoever draws a boundary is not the only one who checks it* — **only works if the second
check is independent.** The lead ratified `backend`'s *"6 for 6"* flag finding by **re-running
`backend`'s own query**, confirming its **pattern-match, not its mechanism**. **Two people running the
same wrong query agree.**

Checked independently, there were **three mechanisms**, not one: **baseline force-sets** (a *migration* —
runs in production) vs **seed enables** (production **never runs seed**) vs **released by a later
migration**. One description (`attachments`) was **accurate all along**. A migration to delete false
claims **that adds one** is the disease itself — its own in-migration scope fence caught it.

### 7.5 Counting is not the method — close the set, don't enumerate it

**Five rounds produced five caller floors — 37 → 30 → 35/49 → 10 → 57 — and never converged**, because
*"is this caller gated?"* is a **per-function judgement no text filter decides**. Each floor looked like
a population.

**What IS closable: the gate-helper set.** Every function either **carries an arm string** (text-findable
in `prosrc`) or **reaches an arm only via a helper** (fixed for free). **No third case.** The caller set
was never the population — **`{helpers} ∪ {direct-arm-checkers}`** is. ⚠ But *"fix the helpers and we're
done"* **ships with the P0s intact** — the mutators check roles **directly**.

**Corollary — check INVOKER before sweeping.** `close_case` / `cancel_case` / `set_case_outcome` /
`update_case_narrative_body` are `prosecdef = f`, so **RLS already protects them**. A blanket "add the
gate everywhere" sweep is **over-reach**, and over-reach breaks legitimate surface.

### 7.6 An exclusion is only as strong as its weakest MUTATOR

ETH·E1 proved *no positive arm can out-vote the deny*. **The deny needs no out-voting — the denied party
deletes the row it reads.** `is_case_excluded` resolves through **rows** (`case_recusals`,
`case_participants.removed_at`, a role `key`); an audit of the **predicate** never looks at who can
**write** those rows. **And check the ACLs, not just the doors:** a *"the RPC is the only door"* disproof
held on every leg it checked and was **inverted** on the one table it didn't (`case_participant_roles` —
direct DML, no audit).

**Apply:** for every arm a deny resolves through, enumerate **every mutator of the rows it reads** and
require a **self-check** — not merely an exclusion term. Pair each with the over-grant twin: *the denied
party calls the door on her **own** row and it **raises**, and the row survives her.*

### 7.7 Narrowing inverts the risk — the positive twin IS the review

M1/M2 were **denials** (close a door nobody should have had). M3 was a **narrowing** (take away reach
someone has **today**). **A denial's danger is that it doesn't bind; a narrowing's danger is that it binds
too much** — and **a narrowing that denies everyone passes its negative keystone by construction.**

The technique that worked: a **shadow function** carrying the pre-change body verbatim, diffed over the
**whole population** — *PHI readers 30 → 27, LOST = 3, GAINED = 0*, and the 3 are exactly the intended
losers, **all keeping content**. And keep the axes separate: the assignee **loses PHI** while **keeping
content** — **conflating them is what made two keystones vacuous.**

### 7.8 Verify, don't comply — and don't extrapolate a rule across a boundary

**Teammates overruled the lead five times, with evidence, and were right every time:**

- **`pg_depend` cannot build a call graph here** — **0 of 660** functions have a parsed `prosqlbody`;
  Postgres never parses string-literal bodies. The lead's instruction was **impossible**; the agent
  brought evidence instead of complying.
- **The census was 40, not 42.**
- **A2 could not be built as scoped** (§4).
- **The PHI `level` filter could not be "fixed"** — `case_access.level` is **write authority**; filtering
  on it would contradict the target lattice. It **pinned** today's behaviour instead.
- **Gating the reveal button on `canEdit` would have HIDDEN it from legitimately-entitled grantees** —
  `canEdit` is **coordinator-only/write**, the read set is **broader**. The lead had cited a real
  convention (*gate the affordance, don't dangle a dead control*) — but it governs **destructive** doors,
  **not reads**. **A rule extrapolated across a boundary it doesn't cross is how the member-arm widening
  got in too.**

**If a claim cannot be falsified by a test, it is not a claim — it is a hope.**

### 7.9 A closure is only closed over the population you applied the rule to (M5b, 2026-07-15)

§7.5 said the caller set was never the population — **`{helpers} ∪ {direct-arm-checkers}`** is. M5 closed on
exactly that rule and **was still a floor**, because it applied the rule to **one schema**:
*{`app.*` functions touching a raw-arm table}* = **17**. The **`public.*` DEFINER RPCs read the raw arms
directly**, and `prosecdef = t` ⇒ **RLS never applies to them**. **A28, fourth time.** `list_my_cases`
inlines `grant OR phase_asg OR narr_asg` under a bare `auth.uid()` and delegates to **no** predicate — so
`can_read_case = f` while the door served **2 rows**. **The closure claim read like a closure** — it named
a rule, counted a population, triaged every member — **and was wrong because of its `WHERE` clause.**
It is left in the M5 migration as an annotated specimen.
**Apply: state the population's SCOPE, then attack the scope.** *"Closed over what?"* is the question.

**⛔ THREE INDEPENDENT TEXT SWEEPS FAILED IN THE SAME DIRECTION.** `qa`'s transitive-`is_active` graph
reported `list_my_cases` **GATED**; `backend`'s reproduced it; the cause is that `is_staff_admin_of_for`
appears in the function's **`my_role` display chip**, never in its `WHERE`. `backend`'s wrapper check also
matched `is_staff_admin_of_for` against `is_commission_admin_of` and returned `f`, **inventing** an ungated
admin arm that delegates fine. **A wrong regex invents findings as readily as it hides them.** Only
`set local role authenticated` + calling the door caught any of it. **§7.2 is not "read the catalog" — it
is "run the thing."** `qa` filed this against its own method, unprompted; that is the behaviour to copy.

### 7.10 ⛔ A metric that reads the SAME before and after is not measuring the change (lead, M5b)

**The lead nearly filed a false P0 against a correct fix.** `list_my_cases` returns **scalar `jsonb`**
(`proretset = f`), so `select count(*) from list_my_cases(…)` is **always 1** — one row holding an array.
The lead read `1` **pre**-fix and reported it to the PO as evidence of the leak, then read `1` **post**-fix
and nearly called M5b incomplete. The true metric is **`jsonb_array_length(...)`**: `2 → 0 → 0 → 2`
(active → deactivated → suspended → restored). `qa` and `backend` both had the right number (**2**) the
whole time; the lead's disagreed with both and he trusted his own.

**The tell was there and was missed: the reading did not MOVE.** A probe that returns the same value on
both sides of a change is measuring **the wrong thing** — that invariance is the alarm, not a coincidence.
Same trap, same session: `backend`'s first `list_cases_board` "DENIED" was its own
`jsonb_array_length(record)` **type error**, not a denial.
**Apply: before trusting a probe, run it where it MUST differ (the positive twin) and require it to move.**

**⛔ 7.10·b — THE SHARPER FORM: A DIFF-BASED PROOF IS SATISFIED BY BOTH SIDES BEING BROKEN THE SAME WAY**
(lead, A2 review, 2026-07-16). **`LOST = 0 / GAINED = 0` is a *difference* claim — and two broken
snapshots differ by zero.** The lead's independent A/B harness captured BEFORE and AFTER reach matrices
and diffed them. **Both `psql` calls silently failed** (`PSQL="docker exec …"` then `$PSQL -f …` — **zsh
does NOT word-split unquoted variables**, so the whole string was taken as one command name: `command not
found`). Each snapshot was **one line of error text**. The script then diffed them and, had both errors
carried the same line number, would have printed **`⭐ IDENTICAL — LOST = 0, GAINED = 0`** — **the
unit's central claim, "independently confirmed," from two error messages.** It escaped only because the
two errors happened to cite **different line numbers** (`ab.sh:16` vs `ab.sh:9`), yielding a false RED.
**Luck, not method** — and it was a *lead* harness built to verify the very claim it would have faked.

⭐ **This is §7.1's `red ≠ abort` wearing a different hat: never accept "0 differences" until you have
proven BOTH snapshots RAN.** *(Same family as the `e2e:prod` gate that parses its failed-count from
`tail -5` and reports **0 failed** when flaky output pushes the header out — **false GATE GREEN**.)*

**Apply — a diff gate MUST refuse to compare until it has asserted, on BOTH sides:**
1. **the snapshot is the expected SIZE** (`rows == cases × users × states`; abort otherwise), and
2. **the population has something to lose** (`reachable-true > 0` — an all-`f` matrix shows LOST = 0
   **vacuously**; this half `backend` already had right, and it is why M6 reported "74/196 reachable"), and
3. **the mechanism under test was actually absent/present** in the respective snapshot (assert
   `_case_caps` count `= 0` in BEFORE and `= 1` in AFTER — otherwise you diffed the same DB twice).

**The generalisation: an equivalence proof is only as good as its proof that the two things were
DIFFERENT to begin with.** Assert the pre-image, or you have compared nothing to nothing.

**⛔ 7.10·c — A NON-UNIQUE KEY SILENTLY HALVES YOUR POPULATION (lead, A4 A/B, 2026-07-16 — the FOURTH
harness bug in one day, and again only the control caught it).** The A4 matrix carried both flag states
in one file — 392 rows keyed `(case, user)`. But **`(case, user)` is NOT unique across flag states**:
the ON block and the OFF block share all 196 `(case, user)` pairs, so the load-into-dict **kept only the
OFF value** and the population **collapsed 392 → 196**. The `assert len == 392` control **aborted instead
of reporting a diff over half the matrix.** Fix: key by **`(flag_state, case, user)`**. **Corrected diff:
LOST=120, GAINED=0, PHI control 0/0.** ⭐ **The running score today: FOUR independent harness bugs — zsh
word-split, container-path `-f`, over-strict `EXPECT`, non-unique key — and every single one was caught
by a control assertion, NONE by reading the script.** *A harness that verifies a security property needs
its own §7.1 mutation discipline: **assert the harness can SEE the thing before you trust what it
reports.*** Minimum controls on any A/B: **(1) both snapshots the expected row count, (2) the pre-image
mechanism provably present/absent, (3) reachable-true > 0, (4) keys unique at the granularity you diff.**

### 7.11 ⛔ An inferred mechanism is not a mechanism — and quoting a lesson is not applying it (lead, 2026-07-16)

**Three claims about `visibility_policy`, three probe-free inferences, one thread — all by the lead, each
delivered to the PO in the confident register, each wrong:**

| Claim | Why it felt safe | The probe that killed it |
|---|---|---|
| *"Nothing writes it post-creation — it can never be corrected."* | No RPC writes it (**true**), so nothing does (**inferred**). | `FOR ALL` + table `UPDATE` + no guard ⇒ raw `PATCH` widens ethics, **`f → t → f`**. Wrong **in the opposite direction of the risk**: reported *stuck closed*, actually *forceable open*. |
| *"Blocks A3."* | A3 touches case material (**true**), so it depends on this (**inferred**). | A3 **inherits** through the case rule. **A2** is the coupling. |
| *"The seed fix changes A2's diff population — it must land FIRST or the proof expires."* | The type has a default (**true**) + the case has that value (**true**) ⇒ the case **got it from** the type (**inferred**). | Case is a **direct insert** (`seed.sql:2118`). Flip the type default: **6/1 → 6/1**. `case_types` has **no triggers**, `cases` no FK. **Provably inert.** |

Every premise was individually true and catalog-verified. **The defect was the arrow between them.** Two
verified facts plus a plausible connection reads exactly like a third verified fact — and the connection
is the only part that was never probed. `case_types.default_visibility_policy` → `cases.visibility_policy`
**looks** like a data-flow, is **named** like one, is **documented** as one (`src/lib/queries/cases.ts:485`
says *"snapshotted onto `cases.visibility_policy` at create"*) — and for the seeded case it **does not
exist**. §7.5 in a new costume: the danger is the arm you didn't know was there, and an arrow you *assume*
is there is the same error inverted.

**The aggravating detail: the lead cited §7.9 — his own lesson, written the day before — as the
justification for the third claim.** Invoking a lesson to license an unmeasured urgency is not applying
it; it is borrowing its authority. A lesson that makes you *more* confident without a probe has been
used exactly backwards.

**Apply: state the ARROW as its own claim and probe it separately.** "A has a default, B has that value"
does not establish "B got it from A" — mutate A and watch B. If B doesn't move, there is no arrow, and
every conclusion downstream of it is unsupported no matter how well-verified its endpoints were.
A probe that never goes non-zero is `throws_ok` catching the wrong error, one layer out.

### 7.12 ⛔ A vulnerability's SEVERITY is its blast radius, and blast radius is REACHABILITY — measure it, don't read the policy (lead, exclusion-perimeter contract, 2026-07-16)

**The lead found a real policy leak and got its SEVERITY wrong by a category.** `case_documents_select_member`
genuinely lets a recused member read the bytes — **proven by execution, the policy is defective.** The lead
wrote it up as *"every commission member reads every case file; `explicit_grants_only` defeated at the bytes
layer, on PHI-capable artifacts"* — an **active, catastrophic** framing. `backend` measured the **reachability**:
the live product writes every case/interview byte to the **`attachments`** buckets (guarded, route the deny);
the leaky `case-documents`/`interview-attachments` buckets are **legacy with NO writer** — product **or** SQL
(both sweeps empty; one seed fixture). **The leak is real; its live blast radius is EMPTY. Latent-P1, not
active breach.** The fix inverts with the severity: **remove the dead arm**, not *add-exclusion-to-a-hot-store*.

⭐ **The bitter part: this is PO-decision-9's principle — *"reachability, measured, never inferred"* — and the
lead WROTE IT, three units earlier, to keep the flag-OFF arm out of a bespoke migration.** The lead applied it
correctly to someone else's finding and forgot it on their own. **A defect you discovered yourself is the one
you are least likely to reachability-check** — the alarm of finding it substitutes for the measurement.

**The two-part shape, both live here:**
1. **A `SELECT` policy leak is only as severe as the objects that reach it.** `bucket_id='case-documents'` in the
   qual means the arm evaluates **only** on that bucket — an empty bucket is an unreachable arm. **Before scoring
   a policy P0, count the rows/objects it actually governs in production**, and find their **writer** — no writer,
   no live blast radius.
2. **Symmetric to §7.10.** §7.10: a metric that reads the SAME before and after measures nothing. §7.12: a leak
   with NO reachable data has nothing to leak — a `true` return over an **empty population** is as vacuous as an
   unchanged metric. Both are the **empty-set masquerading as a result**, once as a false green, once as a false red.

**Apply: for every "X can read/write Y it shouldn't," the next probe is *"how does Y come to exist, and who
writes it in production?"* — before the severity, before the migration.** Grep the writers, not just the readers.
A door with no one behind it is a door to nowhere; fix it (cheaply, by removing it) but do not raise the alarm as
if the room were full. *(And its converse, the one that still bites hardest: the grant-door hole IS live —
`grant_case_access` is product-reachable — so it keeps its P1. Same contract, opposite reachability, opposite
severity. The policy text looked equally alarming for both; only the reachability told them apart.)*

### 7.13 ⛔ Your OWN enumeration is a closure claim too — "the N places I found" is a floor, not the set (lead, same contract)

§7.5/§7.9 were aimed at teammates' closures and at the ADR's. **This one is the lead's: the exclusion-perimeter
was briefed as five proven members; the population is larger** — `assign_narrative`, `activate_phase`, and ~9
DEFINER content-write siblings authorize on admin and bypass the RLS deny, the **same defect class**. **A22 said
"the SINGLE place"; the lead said "these five" — identical error, one rung up.** `backend` closed it the only way
that works here: **behaviourally, per-RPC** — because its structural sweep **false-positived** on the guarded PHI
doors (`set_participant_patient` carries `assert_not_case_excluded`, invisible to a naive token list) and
**false-negatived** on `grant_case_access` (whose body says `public.cases`, not the case-material tokens). **A
token filter is not the population — in EITHER direction.** **Apply: when you hand a teammate "the N cases,"
label it a floor and ask them to close the set; the moment you present your own enumeration as complete, you have
made the closure error you spent six rounds catching in everyone else.**


> ⭐ **7.13·b — a fresh instance, U2 §3 (2026-07-16):** the lead ruled REVOKE `recompute_recommendations`
> on *"0 callers,"* having grepped **`src/` for `.rpc()`** — **client** callers. Two **INVOKER SQL** callers
> (`add_ad_hoc_phase`, `skip_phase`) were invisible to that probe; a revoke aborts them. **`backend` caught it
> by RUNNING the revoke** (suite red-failed 7 files) and overrode the ruling with the guard (§7.8). **The probe
> that scores a door "unused" must see EVERY call site — `pg_proc` bodies, triggers, and RLS, not just `src/`.**

---

## 8. Where the durable record lives

| | |
|---|---|
| **Decisions + every A-number** | ADR [0078](../decisions/0078-authorization-capability-model.md) — **Amendments 3 & 4 first** |
| **Plan / stage order** | [authorization-capability-model](../plans/authorization-capability-model.md) — **§M1** carries the resequencing |
| **A0 inventory** (catalog census) | [authz-capability-inventory.md](authz-capability-inventory.md) |
| **A30 platform_admin census** | [authz-a30-platform-admin-inventory.md](authz-a30-platform-admin-inventory.md) |
| **Reviews** (A0 · M1 · M2 · M3) | [authz-a0-inventory-review.md](../reviews/authz-a0-inventory-review.md) · [authz-m1-review.md](../reviews/authz-m1-review.md) · [authz-m2-review.md](../reviews/authz-m2-review.md) · [authz-m3-review.md](../reviews/authz-m3-review.md) |
| **Mutation harness** | `supabase/tests/mutation/m1-mutation-audit.sh` (runnable; 22 cases) |
| **Keystones** | `supabase/tests/229_*` (M1) · `230_*` (M3) · `231_*` (M5) · `189_*` §11b (M2) |

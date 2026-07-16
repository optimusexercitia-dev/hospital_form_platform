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
| **A2 → A4 → A5 → Gate-1 exit** | next. **A2 is now a genuine mechanism swap** — all three founding defects are narrowed (M3 ①, M5 ③) or pinned (① half 2 → B1), so A2's proof is a clean full-population equivalence: **`LOST = 0, GAINED = 0`**. Any loss means A2 smuggled a narrowing. |
| **`qa` review of M5** | **not run.** M1/M2/M3 each got one and **every round found real P0s**; M5 is the first unit to skip it so far. |
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

---

## 7. ⭐ THE LESSONS

**These cost six review rounds. They generalize far beyond AUTHZ.** Every single real defect here was
found by an **independent check** — never by careful reading. Reading code was **not once** sufficient.

### 7.1 A test that cannot fail is not evidence — MUTATION-TEST IT

**Seven keystones on this program could not fail**, two of them ⭐, one **Rule 12**. **Review found
none of them. Reverting the fix and requiring the test to go red found every one.**

An over-grant twin is **necessary but not sufficient — the twin itself can be vacuous.** Five shapes,
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

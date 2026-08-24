# AUTHZ Gate 1 — completed unit detail (rotated out of PROGRESS.md)

Rotated **2026-07-16** by the lead per `docs/lead-playbook.md` §5 (PROGRESS.md is read by every
teammate spawn; it holds the CURRENT unit only). **Nothing here is lost — this is the full task
detail as written at the time.**

⛔ **These are HISTORICAL records, frozen as written. Do not read them as current state.**
The live state is **[authz-handoff.md](./authz-handoff.md) §5**; verdicts are in `docs/reviews/`;
**the catalog is the only truth for schema/RLS/RPC questions** (CLAUDE.md's graphify/SQL exception).
⚠ The **A2** block below says *BLOCKED* — that was true on 2026-07-15 and is **false now**: A2 shipped
`14529f0`, lead-verified, `qa` APPROVED. It is kept because **the block is why A2 was rescoped**.

---

### ▶ AUTHZ · M6 — `visibility_policy`: the guarded door (D1+D2 CLOSED) (`backend`, 2026-07-16)

Migration `20260728000000_authz_m6_visibility_policy_door` + `supabase/tests/233_authz_m6_visibility_door.sql`
(**29/29, all 29 proven to RUN**) + `supabase/tests/mutation/m6-mutation-audit.sh` (**6/6 RED-PROVEN**, control
green). Gate: **pgTAP 2802/2802** fresh reset (`Files=96`) · lint 0/0 · typecheck ✅ · **118 migrations** · types
regenerated `--local`. **Local only — nothing pushed, no `e2e:prod`.**

**Shipped (PO Q1–Q4, approved 2026-07-16).** `public.set_case_visibility(uuid,text)` — authority `HC0F5` →
exclusion `HC0F1` → validation `HC0F6` (**M1·4 order, preserved deliberately**), explicit
`app.audit_write('case.visibility_changed')`, `REVOKE ALL FROM PUBLIC` before `GRANT`. **New**
`app.guard_case_visibility` trigger (`BEFORE UPDATE OF visibility_policy`, `check_violation` mirroring
`guard_case_status`'s precedent — **`guard_case_status` itself untouched**, it is a keystone). Seed: ethics
**type** default → `commission_default` (A1's ruling, never landed); **the E1 case's direct insert at
`seed.sql:2115` deliberately untouched** — it is now the seed's model of A1's per-case override.

**⛔ NO FEATURE FLAG — deliberate, and I overruled the model on it.** `set_case_confidentiality` opens with
`assert_case_participants_enabled()`; this door does not. `app.can_reach_case_on_member_surface` reads the column
with **no `feature_enabled` call**, so the column's effect is unconditional and the guard must be too — a
flag-gated door then builds a **LOCKOUT** (flag OFF ⇒ the column still governs reach and the only correction door
is switched off, freezing every case at whatever policy it holds). That is **§7.7's bind-too-much**, and borrowing
the model's gate is **§7.8** — `case_participants` governs the **roster**, not visibility. **Invariant recorded for
the next author: the door's availability must equal the column's liveness.**

**⭐ The exclusion line is the EQUALITY, not defence-in-depth.** Live qual of `cases_staff_admin_write`:
`(is_staff_admin_of OR is_commission_admin_of) AND (NOT is_case_excluded(id, auth.uid()))` — **RLS already carried
the exclusion term**, and the RPC is `prosecdef = t` so RLS never applies to it. Authority **alone** would have made
the door **WIDER** than the raw PATCH it closes (`LOST=0` while `GAINED` went to 1). The brief asserted parity while
**printing the qual that disproved its own reasoning**; parity holds, for a different reason. **Proven by mutation:**
revert that one line and *the accused doctor re-opens the case in which he is accused* — `not ok 14: caught no
exception / wanted HC0F1`, `not ok 15: have commission_default`, **26 tests proven RAN**.

**Equivalence MEASURED, not inferred (§7.11).** Full A/B reach matrix, **196 cells** (7 cases × 28 users), computed
with the guard+door dropped and the seed fix undone **on the live catalog** in a rolled-back tx: **LOST = 0,
GAINED = 0** — and **74/196 cells reachable**, so the matrix had something to lose (an all-`f` matrix shows LOST=0
**vacuously**; §7.10 requires the probe to be able to move).

**⚠ The fixture was the hard part — §7.1 trap #3, caught before it shipped.** **No seeded persona is both excluded
AND authorized:** `staff1`/`staff4` excluded but plain `staff`; `chefe`/`orgadmin.a` authorized but not excluded. An
exclusion keystone on any seeded persona therefore raises **HC0F5, never HC0F1** — **green while asserting nothing**.
`233` **makes** the respondent a `staff_admin` and asserts **both legs** (`PRE ⭐`) before the door is called.

**⛔ D3 — the PO's hypothesis is FALSIFIED (reported, NOT fixed; Q3 forward-only holds).** *"After the seed fix ethics
is the only type and every default is `commission_default`, so D3's divergence may be unreachable"*: *"only row"*
(**true**) + *"so divergence can't happen"* (**inferred — assumes a CLOSED row set**). `case_types_admin_write` is
`FOR ALL` on `is_admin() OR is_org_admin_of(...)`; **probed as `orgadmin.a`: minted a type carrying
`explicit_grants_only` (`INSERT 0 1`) and flipped the ethics row back (`UPDATE 1`).** `case_types` is a
**runtime-writable catalog, not a fixture.** **§7.11's arrow — inside the very unit whose brief recorded §7.11.**
D3 is **unreached, not unreachable**: **no caller anywhere passes `p_case_type_id`** (default `NULL`), so the type
default is read by **nothing** at runtime — which is also why **E2E exposure is zero** (`ethics-e1-access-spine` uses
the seeded direct-insert case, not the template door). **No spec edited; none needed editing.**

**`230` fixture note (disclosed).** My guard blocked two **fixture** writes in M3's suite (line ~165) — §7.7 landing
live: the narrowing bound something legitimate. Wrapped them in `set_config('app.in_case_rpc', …)`, **the
established convention** (`110_case_status`, `114_phase_blockers`, `160_phase_results` all do it, because
`guard_case_status` forces the identical problem on `status`). **No assertion touched.** `230` went **20/25-aborting
→ 25/25 all ran**, and its `explicit_grants_only ⇒ no PHI` keystone only passes **if the fixture write LANDED** — so
it self-verifies rather than being masked.

### ▶ AUTHZ · Gate 1 · M5b — defect ③ AT THE DOORS: `qa`'s P1, and my closure was a floor (`backend`, 2026-07-15)

Migration `20260727000000_authz_m5b_door_is_active_gate` + `supabase/tests/232_authz_m5b_door_gate.sql` (**33 tests,
RED-authored: 12 failed pre-fix**). Gate: fresh reset **117/117** · pgTAP **2773/2773 PASS** (= 2740 + 33,
`Files=95 Tests=2773`) · **mutation 15/15 RED-PROVEN** (9 M5 + 6 M5b) · lint 0/0 · typecheck ✅ · types identical.

**⛔ `qa`'s P1 is correct and my M5 "SET WAS CLOSED" claim was FALSE.** I closed over `{app.* functions touching a
raw-arm table}` = 17 — the **predicate subset**. The **`public.* DEFINER RPCs** are `prosecdef = t`, so **RLS never
applies to them**: A28's exact lesson, **4th time on this program**. Reproduced live (`staff1.ccih` deactivated,
`set local role authenticated`): `can_read_case = f` and `can_read_action_item = f` — M5's gates work — while
`list_my_cases` served **2** rows (not 1: he is phase assignee on `c1` *and* `c2`), `list_my_action_items` **1**,
`get_member_overview` `cases_not_concluded: 2`. **The claim is retracted in the M5 migration and above**, left
standing as the annotated specimen: an inaccurate closure trains the next reader to skip the check.

**⭐ THE METHOD, not the count, is the finding.** A text-based transitive-`is_active` graph reports `list_my_cases`
as **GATED**. It is not — `is_staff_admin_of_for` appears in its `my_role` **display chip**, never in its WHERE
(`grant OR phase_asg OR narr_asg`, bare `auth.uid()`). **Two independent text sweeps — `qa`'s and my own `delegates`
column — were fooled by that one string, in the same direction.** Only `set local role` caught it. My wrapper check
also matched `is_staff_admin_of_for` against `is_commission_admin_of` and returned `f`, implying an ungated admin
arm that delegates fine — **a wrong regex invents findings as readily as it hides them.** Text generates
**candidates**; behaviour returns **verdicts**.

**The behaviourally-closed population — 5 doors, not `qa`'s 3.** `qa` probed the READ doors; the same probe over the
**WRITE** doors found **two more of the identical class** (a raw `assigned_to = auth.uid()` arm ORed beside gated
coordinator arms): **`conclude_narrative`** and **`advance_committee_action_item`** — both proven to SUCCEED for a
deactivated assignee, with an ACTIVE control proving the probe measured `is_active`. **17 doors are fixed for free**
(denied behaviourally, no change). Two probe **artifacts** refused rather than scored: `list_cases_board`'s first
"DENIED" was my own `jsonb_array_length(record)` type error (re-probed: **0 deactivated / 2 active** — gated for free
by its per-row `can_read_case`, and `232` + a mutation case now prove that mechanism); `list_case_access` denies
**active and inactive alike** ⇒ coordinator-only, **wrong-arm**, excluded deliberately. I get **43** candidates
(17 app + 26 public), not `qa`'s 59 — noted, but the verdict is behavioural and every `authenticated`-executable
candidate was probed.

**⭐ SQLSTATE ORDER IS THE STRUCTURAL DEFENCE (A33).** Write doors raise **`HC0F4`** (`HC0F0–F3` taken, verified)
**AFTER** their existing authority raise (42501/HC027/HC037). So a deactivated **assignee** gets HC0F4 while a
deactivated **non-assignee** still fails on authority — **a wrong-arm fixture fails LOUDLY instead of passing on the
code it asserts**. `232` asserts that ordering directly with an ACTIVE non-assignee. Read doors **return their own
existing empty shape** (`'[]'` / the zeroed overview), never throw — a throwing read door breaks the pt-BR contract.

**Patched via runtime `pg_get_functiondef` injection**, never hand-copied text (memory: a stale re-emit already broke
`advance_` in BE-6·N — one of these very functions). `app._m5b_inject` **refuses** unless the anchor hits **exactly
once** and the door is not already gated ⇒ body drift **fails the migration loudly** instead of silently no-op'ing,
which would ship the defect with every test still green. It fired for real: an `E''` escape bug failed the reset
rather than half-patching.

**Twin decoupled:** the conclude twin got its **own** narrative — pre-fix the negatives SUCCEED (that *is* the
defect) and concluded the shared row, so the twin went red on `HC055`, for a reason unrelated to M5b. A twin whose
result depends on the negatives failing is not an independent twin. Added: the denied calls left **no side effect**
(the targeted narrative is still `open`) — which `throws_ok` alone does not prove.

**MINOR (fixed, proven at the symptom):** both mutation harnesses' preflight installed `pgtap` into `public`
**outside any transaction**, so it persisted and the next pgTAP run read **t19 red** ("no public function is
anon-executable", 1079 pgtap-owned) — a false red, read-only, zero app leaks. Reproduced it, then added a
`trap`-based cleanup that drops it **only if the harness installed it**. Proof: **2773 PASS immediately after a
harness run**, no fresh reset needed.

### ▶ AUTHZ · Gate 1 · M5 — defect ③: the `is_active` outer gate (`backend`, 2026-07-15)

Migration `20260726000000_authz_m5_is_active_gate` + `supabase/tests/231_authz_m5_is_active_gate.sql` (**79 tests,
authored RED before the SQL — 18 M5 assertions failed pre-fix while every PRE-flight/TWIN/RESTORE passed**, so the
fixture was real and the reach was real). Gate: fresh reset **116 files / 116 registered** · pgTAP **2740/2740 PASS**
(= 2661 + 79, `Files=94 Tests=2740`, proven RAN not merely exit-0) · **M5 mutation audit 9 cases / 21 patterns
RED-PROVEN** (`supabase/tests/mutation/m5-mutation-audit.sh`) · **M1 audit re-run 22/22 RED-PROVEN** · lint 0/0 ·
typecheck ✅ · types **byte-identical** (only `app.*` bodies changed; no public surface).

**The defect, catalog-proven live:** `app.is_active` was never called inline by any case predicate — only reached
*transitively* through the role wrappers. So every **raw table arm** was ungated. Proven before the fix: a
deactivated grantee **read the MRN through the audited door** (Rule 12); deactivated phase/narrative assignees read
case content; a deactivated write-grantee wrote it; a deactivated assignee read action items — **and every one of
those also held with a live SUSPENSION**.

**⛔⛔ RETRACTED (M5b, round 2): the "THE SET WAS CLOSED" claim below is FALSE.** It closed over the **`app.*`
schema — i.e. PREDICATES only** — and excluded the **`public.*` DEFINER RPCs**, which are `prosecdef = t` and so
**bypass RLS entirely** (A28, 4th time). **Five more instances of defect ③ shipped through M5's own scope.** See the
M5b entry above. The claim is left standing in the migration as the specimen, annotated: it *reads* like a closure —
names a rule, counts a population, triages every member — and is wrong because the rule was applied to one schema.
**A closure claim over authorization is worth exactly what its BEHAVIOURAL proof is worth.**

**⭐ THE SET WAS CLOSED, NOT ENUMERATED (§7.5) — and the brief's six was materially incomplete.** The closable set is
*{functions whose body touches a raw-arm table}* = **17** (comments stripped; ⚠ my own first sweep used `case_access\b`
and silently under-reported — Postgres ARE uses `\y`, `\b` is backspace). Triage: **7 gated** · **6 fixed for free**
(all arms delegate to a gated predicate — `can_read_case_or_admin`, `can_reach_case_on_member_surface`,
`can_read_attachment`, `can_write_action_item_stake`, and the two confidentiality **conjuncts**, which return TRUE for
every non-gated label and so cannot grant reach alone) · **4 not authorization at all** (audit emitters,
`guard_case_phase_status`).

**Three functions gated that the brief did not list:**
1. **`can_write_case_narrative`** — **M1's own migration flagged this arm and deferred it to "the Stage-A/G sweep
   rather than smuggled in". This is that sweep.** `body_md` is PHI-bearing free text by its own column comment ⇒ a
   deactivated assignee was **writing PHI**.
2. **`referral_target_analyst`** — ⭐ **Rule 12.** All THREE arms raw, **no role wrapper at all**; its only caller
   `can_read_referral_phi` has its other four arms gated ⇒ this was the **sole ungated route to referral PHI**. The
   brief's *defect statement* names "referral analyst"; only its function list omitted it. The B3 work M1 deferred is
   the `can_read_referral{,_phi}` **split** — a different axis (C6: gating and removing are orthogonal).
3. **`can_write_attachment`** — its `action_item` arm carries the same two raw assignee arms and, unlike
   `can_write_action_item_stake`, gates on **no** read-check first.

**⛔ Two functions DELIBERATELY NOT gated, asserted:** `can_read_case_or_admin` + `can_reach_case_on_member_surface`
are pure delegation. A gate there is a **provable no-op**, hence **unfalsifiable under A33's one-function-at-a-time
rule**, and a wasted per-row `profiles` lookup on the member surface (**A5 is a hard per-row-cost criterion**). `231`
asserts their denial **behaviourally** instead, in both directions — and those assertions go **RED** when
`can_read_case`'s gate is reverted, so the delegation claim is falsifiable rather than assumed.

**Proof (§7.7 — a narrowing's danger is binding TOO MUCH).** Pre-M5 bodies captured from the **live**
`pg_get_functiondef` and reverted **transactionally** (DDL is transactional), so the diff is exact and free of the
shadow-fn cross-call contamination:
- **Baseline, unmodified seed — 196 (case,user) pairs + 28 action-item + 168 narrative pairs: IDENTICAL. LOST 0,
  GAINED 0.** No over-reach.
- **Counterfactual** (the seed's own inactive personas hold **zero arms** and are a **vacuous fixture** — §7.1·1+·3 —
  so the raw-arm holders were deactivated instead): **5 rows changed, GAINED = 0, ACTIVE principals LOST = 0 rows.**
  Every loser is exactly an inactive/suspended principal on a raw arm: `multi@`/`…c1` grant:read (**lost read AND
  PHI**) · `staff1.ccih`/`…c1`+`…c2` phase_asg · `staff2.ccih`/`…c1` narr_asg · `staff3.ccih`/`…c1` **suspended**
  (lost read+PHI+write).

**⭐ A24·5's fixture did not exist either.** The seed has **1** action item, scope `committee` (**not**
`assignees_only`), and `action_item_assignments` is **EMPTY** ⇒ the `assignees_only` arms are entirely unexercised and
a keystone on the seeded item would measure the already-gated `committee` arm. `231` **builds** the fixture, and
asserts the scope post-insert because **`guard_action_item` hard-forces `visibility_scope := 'case_restricted'` for
`source_type='case'`** — the §7.1·2 trigger trap, live in this table.

**⛔ Scope fence held:** no resolver, no `case_access_grants`, no A21 removal, flag untouched. **Defect ①'s second
half stays open by design** — `231` re-pins it (an **ACTIVE** read-grantee still reads the MRN) so B1 lands visibly.

**⚠ HARNESS BUG FOUND + FIXED (`m1-mutation-audit.sh`, the one modified file).** Its `awk -v pre="$PRELUDE"`
injection dies on **BSD awk (macOS)** — *"newline in string"* for any multi-line `-v` — emitting a garbage script so
**every case aborts**. On this machine M1 read **22/22 ABSENT**, i.e. **the recorded "22/22 RED-PROVEN" was not
reproducible here at all**; it must have come from a GNU-awk box. Not a false green — the tri-state reported
`ABSENT(aborted)`, which is the only reason it surfaced (§7.1's `red ≠ abort`, live). Replaced with a portable
`head`/`tail` split in both harnesses → **M1 back to 22/22 RED-PROVEN**, which also re-proves M1's denies on the three
functions M5 rewrote. **Harness lesson 4: a harness whose result depends on which `awk` is installed will be misread.**

### ▶ AUTHZ · M4 — the gated-off myth: **FIVE** false flag descriptions corrected (`backend`, 2026-07-15)

Migration `20260725000000_authz_m4_feature_flag_descriptions` — **`description` only, zero `enabled` changes**
(scope-fenced in-migration). Full pgTAP **2661/2661** on a fresh reset · mutation audit **22/22 RED-PROVEN** ·
lint 0/0 · typecheck ✅.

⛔ **CORRECTION — my own "6 for 6" was WRONG, and the lead ratified it.** We were wrong the *same way*: the lead
re-ran **my** `ilike '%Ships OFF%'` query, so it confirmed my **pattern-match, not the mechanism**. A0's rule
("whoever draws a boundary is not the only one who checks it") **only works if the second check is INDEPENDENT.**
There are **three** mechanisms, not one:

| Flag(s) | Mechanism | Verdict |
|---|---|---|
| `case_patient` · `case_referrals` · `patient_index` | baseline **force-sets `true`**, never gated | ⛔ **flatly false** → rewritten |
| `case_participants` · `case_types` | inserted `false`; **released by `20260720001040`** (m2 flip) after E1 landed | ⚠ stale **tense** — gate was real + released as designed → reworded, history kept |
| **`attachments`** | inserted `false` by `20260717000500`; **`seed.sql` enables it** | ✅ **ACCURATE — left untouched** |

**My first draft would have written a NEW falsehood into `attachments`** (*"baseline force-sets this flag true"*).
**A migration to delete false claims that adds one is the whole disease** — my in-migration scope fence caught it.

⭐ **ROOT CAUSE OF THE WHOLE FLAG SAGA — found, and it is not documentation.** `e2e/case-patient.spec.ts`
`afterAll` **sets `case_patient`, `patient_index`, `case_referrals` to `false`** — commented *"Restore … (seed
default — flag ships OFF)"*. It does not restore; it **CORRUPTS** the shared stack into a state **no environment
ships**, on the same false premise. That is why I read `f` (post-e2e) and the lead read `t` (post-reset): **both
readings were correct; neither was a fact.** ⚠ The same file says *"the case_patient flag is ON in the seed"* at
line 47 — **it contradicts itself**. `pgTAP does NOT leak` (proven: reset → run → identical). ⛔ **`e2e/` is
`tester`'s — reported, not touched.** Until fixed, **`case_referrals` is OFF after every e2e run, silently
disarming the LIVE PQS referral-PHI arm during any manual testing that follows.**

⭐ **Durable fix adopted (the brief's rule):** flags are now **asserted, not assumed** — `229` +3
(incl. `audit_trail`, without which M1·3(c) would measure the flag rather than the trigger), `230` +2.

### ⚠ AUTHZ — SWEEP RESULT (SUPERSEDED — see M4 above: it is 5, not 6) (`backend`, 2026-07-15)

`qa`'s M3 blocker (`case_referrals` is ON, not OFF) is **not a one-off — the class is systemic**. Every flag whose
`description` says *"Ships OFF"* is **`enabled = true`**: `attachments` · `case_participants` · `case_patient` ·
`case_referrals` · `case_types` · `patient_index`. **6/6.** `baseline.sql` force-sets each via
`on conflict (key) do update set enabled = excluded.enabled`, so the prose has never matched the column in any
environment. **A flag's `description` is prose; only `enabled` is the flag.** ⛔ **Treat every existing claim that
rests on a flag description as unverified.**

⛔ **And `case_patient`'s description carries a SECOND now-false claim — one M3 itself invalidated:** *"the read
scope is the BROAD can_read_case (assignees need the MRN)"*. Same class as the two TS comments M3 corrected.
**Recommended: ONE documentation migration correcting all six `Ships OFF` descriptions + `case_patient`'s read-scope
sentence.** Not folded into M3 (that would be SQL + a re-test `qa` explicitly scoped out, and fixing 1 of 6
arbitrarily is worse than fixing 0).

### ▶ AUTHZ · Gate 1 · M3 — defect ①: bare assignment no longer confers PHI (`backend`, 2026-07-15)

ADR 0078 **confirmed defect ①** (*"the single most consequential finding"*; amends Rule 12). Migration
`20260724000000_authz_m3_assignment_phi_narrowing` — removes the `case_phases` / `case_narratives`
bare-assignment arms from `app.can_read_case_patient`. Suite **`230_authz_m3_assignment_phi.sql` (23 tests)**,
authored **RED before the SQL** (5/6/8/21/22 red). **Full pgTAP 2656/2656 on a fresh `db reset`** · mutation audit
**22/22 RED-PROVEN** · lint 0/0 · typecheck ✅ · types identical (no signature change).

⚠ **The first NARROWING on this program** (M1/M2 were denials). Positive twins are the whole risk and are proven:
coordinator + explicit grantee **still read the MRN** through the audited door; the assignee **keeps `can_read_case`**
and still writes his narrative (content ≠ PHI, keystoned both directions); both `case_access` flag branches proven.
Mutation-proof verified **both ways** — restoring the arms reddens the 5 narrowing keystones while every positive/
content/scope-fence twin **stays green**.

⛔ **The `case_access` `level` filter (the other half of defect ①) is NOT fixed — deliberate, with evidence.**
`level` is `CHECK (read|write)`: filtering PHI on `level='write'` would encode `write_case_content ⇒
read_standard_phi`, which **A16's lattice puts on DISJOINT chains** — contradicting the target, and making
"read + PHI" ungrantable. `max_confidentiality` is earmarked for `read_restricted_phi` (D5·4) and is **NULL on 4/5
live rows**. The capability needed is `case_access_grants.read_standard_phi` → **B1**. 230 **pins** today's grant
behaviour so B1's change is visible, not silent.

⚠ **PO CONFIRMATION ITEM — a real screen relied on assignee PHI.** `case-detail-view.tsx` renders the
"Exibir identificação" panel to any case reader; an assignee clicked it and got the MRN. Post-M3 the button renders
and returns **null**. Two TS comments asserted this as intentional (*"assignees need the MRN"*, *"the BROAD
predicate"*) — **now corrected** (`src/lib/queries/cases.ts`, `src/lib/cases/types.ts`); the stale-TS-claim class, 4th
instance. **The ADR already ruled this IS the defect** — flagged for confirmation, not worked around.
**Pre-existing pgTAP updated visibly, coverage PRESERVED not deleted:** `151` tests 21/22 proved *Rule 11* ("an
entitled read emits exactly one audit row") **on the assignee** — re-pointed to the coordinator rather than flipped to
expect null, which would have silently deleted the Rule 11 assertion. Same for `207` K3.

### ⏸ AUTHZ · Gate 1 · A2 — the resolver · **BLOCKED pending a PO/lead ruling** (`backend`, 2026-07-15) — ⭐ **ruling received; A2 rescoped, M3 lands first**

**No SQL authored** (deliberate — the same call as A0/D3, the 42→40 census, and the comment trap). The brief's
**source table cannot be implemented as written without silently NARROWING live behaviour**, and the resolver's
mandate is a projection, not a change. **All four proven from the live catalog, behaviourally, rolled back:**

| # | Contradiction | Evidence |
|---|---|---|
| **1** ⛔ | **`case_assignment` confers PHI TODAY** — brief says *"never PHI (Context·1)"* | plain member (not staff_admin, **no grant**), assigned to a narrative → `can_read_case_patient = **true**` |
| **2** ⛔ | **The member arm confers `read_case_content` TODAY** on the `case_access`-OFF path — A15 says *deliberation ONLY* | `can_read_case(commission_default, plain member) = **true**`; also `can_read_case_patient = **true**`. 228 test 24 asserts this *"byte-for-byte"* |
| **3** ⛔ | **The org-admin arm has NO source in A24's table**, but `can_read_case` carries `is_commission_admin_of_for` today | omitting it ⇒ **A4's removal executes inside A2** — which the brief forbids and A5 gates |
| **4** ⛔ | **`nsp_referral_touched` confers PHI — and the arm is LIVE.** Brief says `read_case_content` ONLY | ⚠ **I first reported this as INERT (flag `f`). WRONG** — `case_referrals` is **`enabled = t`** (baseline force-sets it in every env); its *description* says *"Ships OFF"* and **the description is stale prose**. **A24·1 is RIGHT.** Removal = **D8/N1, Gate 2** (scheduled, not new). **REQUIRED as an A2 source** or Stage A silently revokes LIVE NSP content reach |

⭐ **Why this is the program's founding failure mode, inverted.** The member arm's 12× widening was sold as a
no-op and **no keystone could fail**. Here, ≥3 narrowings are packaged as *"a thin projection."* #2 and #3 would
**fail loudly** (228 test 24). **#1 would not** — `can_read_case_patient` is *not* becoming a projection in A2, so
the `read_standard_phi` bit ships **wrong and UNCONSUMED**, and nothing catches it until a later unit repoints
that helper — at which point assignees silently lose PHI. **An unconsumed bit cannot have an over-grant twin.**

**⛔ A2 MUST CARRY THREE SOURCES OR IT SILENTLY REVOKES LIVE REACH** (carried forward, `qa`-confirmed):
**(a)** the **org-admin arm** (`is_commission_admin_of_for` — A24's table has no source for it; omitting it executes
A4's removal inside A2, which A5 gates) · **(b)** the **member-arm `case_access` flag branch** (OFF has a member arm,
ON does not — 228 test 24 pins it) · **(c)** **`nsp_referral_touched`** — **A24·1 is RIGHT and the arm is LIVE**;
without it Stage A silently revokes real NSP content reach. It confers **content only, never PHI** (its PHI half is
D8/N1, Gate 2).

**Recommendation:** A2 reproduces today **byte-for-byte** (org arm + both `case_access` flag branches included),
with equivalence keystones; every intended narrowing lands in a later unit **as a change, with its own keystone**.
Needs a ruling: is the source table *descriptive* (today) or *prescriptive* (the target)? It is currently read as
both.

### ▶ AUTHZ · Gate 1 · M2 — A30 bucket C: platform_admin loses referral-PHI destruction (`backend`, 2026-07-15)

ADR 0078 **A35** (PO ruling; noun rule). Migration `20260723000000_authz_m2_platform_admin_referral_phi` —
**subtractive only**: the `is_admin()` arm deleted from `dispose_referral_phi` + `can_dispose_referral_phi`.
Keystones in `189_nsp_per_hospital_isolation.sql` **§11b** (plan 43→53, reusing the seeded referral fixture).
**Full pgTAP 2633/2633 on a fresh `db reset`** · mutation audit **21/21 RED-PROVEN** · lint 0/0 · typecheck ✅ ·
**types unchanged** (subtractive ⇒ no signature change, diff-verified). Local only; not committed.

**Breach re-proven by execution before the fix** (rolled back) — destruction, not disclosure:
`can_dispose=true` · `get_referral_patient=NULL` (**cannot read a single identifier**) · disposal **SUCCEEDED** ·
`referral_patient` **1 → 0**. Post-fix the family is uniform with its 4 siblings (catalog-verified).
**Over-grant twin mandatory and present:** the surviving population was **enumerated from the catalog, not assumed**
(`nspcoord.b` · `orgadmin.b` · `pqs.b`, all `is_admin=false`); `pqs.b` still disposes — without it the negative
passes **by construction**, since a deny that denies everyone also denies platform_admin.

⚠ **Two persona/verification traps caught, both the program's founding shape:** (1) 189's `admin` persona
(`…001`) has `profiles.is_admin = **false**` — the real platform_admin is `platform@test.local` (`…b0`); a keystone
on the wrong persona denies for the wrong reason. (2) **My first draft's own removal comment contained the literal
`app.is_admin()`, so my catalog self-check matched THE COMMENT** — verbatim the false positive I reported in the A30
census (42→40). *Text is not truth* holds for the text you write while removing the text; the sibling helpers dodge it
by the same convention now used here.

### ▶ AUTHZ · Gate 1 · M1 — exclusion durability (`backend`, 2026-07-15)

Scope = `qa`'s **[§W-6](../../docs/reviews/authz-a0-inventory-review.md#w-6--the-authoritative-ordered-m1-scope--backend-builds-from-this)** (authoritative over A0 §6). Migrations
`20260722000000_authz_m1_exclusion_durability` + `20260722000100_authz_m1_gate_helper_deny`; suite
`supabase/tests/229_authz_m1_exclusion_durability.sql` (**86 tests**, authored RED before the SQL).
**Full pgTAP 2623/2623 green on a fresh `db reset`** · lint 0/0 · typecheck ✅ · types regenerated. Local only —
**no `db push`, remote untouched.** Not committed (lead commits).

**Round 3 — `qa` APPROVED; M-1 + the deviation sweep landed.** ⭐ **The lens (`qa`, and it paid three more times):
un-keystoned DEVIATIONS are the most fragile artifacts here — a spec'd fix gets a keystone by construction, a fix
you were right to INVENT does not.** Applied across everything beyond §W-6 and found **4 unguarded, not 1**:
**M-1** DOOR2 (`assert_respondent_linkage_resolved` on `set_case_participant_role`) · **DEV2**
`can_write_attachment`'s `action_item` arm (my `case_of_action_item`) · **DEV3** the `ON DELETE RESTRICT` PO ruling ·
**DEV4** ⛔ **`set_case_confidentiality` — a FIFTH direct-check door, PROVEN OPEN**, not a `HC0E5` denial: the excluded
respondent rewrote his own case `non_phi_internal → legal_privileged`. Consequence **measured, not inflated**: it does
NOT feed the document ceiling (that reads the *attachment* label) nor `create_interview`'s default (a parameter) — it is
the case's governance classification record. **Not Rule 12; lands on D5's rule alone.** Suite **86 tests**, full pgTAP
**2623/2623** on a fresh `db reset`, mutation audit **20/20 RED-PROVEN**.

**Round 2 — `qa` CHANGES REQUESTED ([review](../../docs/reviews/authz-m1-review.md)): both fixed, plus 2 more the audit found.**
**B1** (vacuous keystone) — the M1·2 `record_recusal` positive twin left `st_x` self-recused, so M1·3's keystones
measured the **recusal** arm while M1·3 guards the **respondent** arm; §W-6 (b) had said *"the respondent never
acts."* Recusal now deleted + 2 guards assert he is excluded by the respondent arm **alone**.
**B2** (`dispose_case_phi`) — a live Rule 12 hole I wrongly triaged to the carry list; the 4th direct-check door.
⛔ **Mutation audit is now BINDING and lands as a repo artifact: `supabase/tests/mutation/m1-mutation-audit.sh`
— 20/20 RED-PROVEN.** It found **two further defects review would not have**: `guard_action_item` **force-rewrites**
`visibility_scope := 'case_restricted'` for `source_type='case'`, so the A22 + CLOSURE keystones were testing
`can_read_case`'s **pre-existing** deny (B1's shape, 2nd instance — fixture re-shaped to `manual` + `case_id`);
and **`can_write_interview` (8 callers) had NO keystone at all** — its fix was untested, indistinguishable from
no fix. Every ⭐ keystone now falsifies when its own fix is reverted.

| # | Item | Status |
|---|---|---|
| M1·1 | **B7 respondent linkage** — `professional_profiles.link_state` (`linked`/`no_account`/**`unknown`** default) + coherence CHECK + `set_professional_link_state` (the `user_id` write path A31·5 proved absent) + a **load-bearing linkage freeze** (HC0F2) + the attach-time check (HC0F0) on **both** `add_case_participant` **and** `set_case_participant_role` | ✅ |
| M1·2 | **the 5 mutators** — `lift_recusal` · `remove_case_participant` · `set_case_participant_role` · `set_primary_subject` · `record_recusal` (+`add_case_participant`) each carry the deny; **authority (HC0E4) first, exclusion (HC0F1) second** | ✅ |
| M1·3 | **`case_participant_roles`** — UPDATE-freeze on `key` (HC0F3, **not** a write-freeze) + the audit trigger it never had (Rule 11 hole; A0 PROBE 5's 161→161) | ✅ |
| M1·4b | **the gate helpers** — `can_write_case_narrative` · `can_write_interview` · `can_write_attachment` · `can_read_action_item`. Catalog: **5 → 9 of 16** helpers carry the deny | ✅ |
| M1·4 | **the direct-check doors** (the set the helper fix cannot reach): `reclassify_attachment`'s declassify arm (§W-2.5) · `set_participant_patient` (§3.6·A2, destructive PHI overwrite) | ✅ |
| M1·4 | **§3.6·A remainder + §3.6·B per-row filters** — a catalog-derived **triage list of 10** (not a fix list: `get_case_patient` is already a verified false alarm, D4's class) | ⏸ **carried — lead** |
| M1·5 | **A30 platform_admin arms** | ⛔ **BLOCKED** (A29 order; PO ruling) |

> ⚠ **SQLSTATE deviation — the phase-status row's `HC0G0–HC0G9` is WRONG and must be corrected to `HC0F0–HC0F9`.**
> The collision-check the brief mandated found `HC0G0`/`HC0G1`/`HC0G2` already held by `grant_role`/`revoke_role`.
> `HC0F` was free repo-wide and is adjacent to the `HC0E` case-participants family this work extends.

# Gate AE2 — QA review, round 2 (independent check; different model than round 1)

**Reviewer:** `qa` (round 2) · **Date:** 2026-08-28 · **Branch:** `authz-ae2-affiliation-tenancy`
**Head reviewed:** `76ca053e` (`test(ae2.4): inc 4 sweep CLEAN 5/5, and the wrapper ruled not a gate`)
**Round 1:** [authz-ae2-review.md](authz-ae2-review.md) (`CHANGES REQUESTED`, B1–B6 + M1–M14, 12 could-not-verify)

## Verdict — ⛔ `CHANGES REQUESTED`

**19 of round 1's 20 findings are closed** (18 CLOSED, 1 CLOSED-WITH-QUALIFICATION); **B5 is NOT
CLOSED** — the false sentence survives verbatim in the **live catalog** (`comment on function
app.tenant_orphan_profiles()`), and the CNV-4 measurement round 1 attached to B5 shows a
**table-level `platform_admin` path that no document states**. And increment 4's own review found
**one new blocking finding**: a fully-successful, E2E-tested provisioning flow is a **standing
producer of the exact "orphan" state ADR 0164 accepts as a crash window** — the sixth sibling-axis
split, on the population axis this time.

The engineering response to round 1 is otherwise the strongest I have measured in this repo: every
test fix was made by adding the missing axis rather than weakening an assertion, the B3 write-through
capture is exactly § 3.8's standard generalized, and the self-audit that found M12's substring defect
and the § 9.2 seed-vacuity is the posture the phase was asked for.

---

## Method — every figure below is mine

- **Stack ownership announced and taken.** Other agents are registered in this session; per the PO
  the stack was free. **Fresh `supabase db reset --local` run first** (exit 0; migration head
  `20261003005800` confirmed in `supabase_migrations.schema_migrations`) — required because
  `FUP-AE2-CATALOG-SUPERSET-OF-CHAIN` makes any un-reset figure inadmissible. Every DB figure below
  is chain-derived.
- Gates I ran myself, exit codes captured directly:
  | gate | result | exit |
  |---|---|---:|
  | `npm run test:db` (fresh reset) | **Files=243, Tests=8119, PASS** | 0 |
  | `ARM=census` | **567** live gates / **603** verdicts, INVARIANT HOLDS | 0 |
  | `ARM=hat` | 3 findings, all reasoned-allowlisted | 0 |
  | `ARM=floor` | **72** never-called reachable DEFINER doors, all allowlisted; allowlist all-live | 0 |
  | `FROMFINDINGS=1 ARM=wrapper` | BLIND set **41**, all allowlisted | 0 |
  | `scripts/door-sweep-cases.sh 2664081c` | DERIVED **5 cases** — exactly the record's list | 0 |
  | diff-scoped `p0-authz-door-audit.sh` over those 5 (WORK=scratch) | **SWEPT 5 · COVERED 5 · BLIND 0 · ERROR 0 — CLEAN**; committed findings baseline verified unchanged (cksum + empty `git diff`) | 0 |
  | `npm run lint` (11 gates) | pass | 0 |
  | `npm run typecheck` | pass | 0 |
  | `npx vitest run` ×3 | 145 files / 1993 tests: run 1 **1 failed**, runs 2–3 all green — see R2-m1 | 1, 0, 0 |
- Code claims verified against **diffs `2664081c..HEAD`** and, for every SQL claim, against the
  **live catalog** (`pg_proc`, `pg_policies`, `pg_trigger`, `information_schema.column_privileges`,
  `obj_description`) — never migration text alone.

---

## The 20-row adjudication

| id | verdict | evidence I measured |
|---|---|---|
| **B1** | **CLOSED** | `src/lib/members/actions.ts:230-260`: `addStaff` re-verify now `select id, is_active` + `personHasActiveOrgAffiliation(admin, userId, orgId)` (`src/lib/queries/affiliations.ts:318-337` — the four conjuncts: principal, org, `ended_on is null`, `voided_at is null`); read-error → `MESSAGES.generic`, refusal → `userNotAddable`, kept distinct. `395 § 8.1` re-derives from `pg_proc` every run that the roster door and the helper carry ONE distinct normalised tense predicate (`'1|2'` — a regex-match failure reds via the `|2` half, so it is not vacuous). Ran green in my `test:db`. `staff-ops-mirror.test.ts` fixture now anchors the target with an `organization_affiliations` row and the **column was removed from the fixture** (verified in diff), so the arms cannot pass off the old fact. |
| **B2** | **CLOSED** | `393`: `ae24_gate` gained an **`actor` column**; H1–H5 run on `…00e1` (`hospitaladmin.a1`), H6 re-runs H4's state on `…00b1`. § 5.0 pins the actor **three-directionally** (`org_a=false | central_a=true | secundario_a=false`) so the org arm cannot have admitted and the hospital arm is hospital-scoped, not org-scoped. § 5.2 asserts `{H4,H6}` as the declared widenings; `ae24_declared` names H4 as ADR 0165's materially-wider cell. The axis is real (varies within the tier), not a constant column. Green in my run (plan 48). |
| **B3** | **CLOSED** | `pg_temp.try_gate` now `select … into v_id; return 'ok|' || coalesce(v_id::text,'')`; `new_aff_id` captured with a guarded cast. **§ 3.10** asserts `W5=live-org-row W6=… W7=…` by id → live, non-ended, non-voided row of THAT person to org A, with labels named in the expectation (absence ≠ not-listed). **§ 5.8** does the same for {H4,H6} **plus the org-parent existence**. Exactly § 3.8's standard, as asked. |
| **B4** | **CLOSED** | `390` gains **D9a** (caller and subject share exactly one authority org, derived through `app.person_authority_orgs` itself, in owner context) and **D9b** (zero `org_admin`/`nsp_org_admin` memberships); `394` gains **§ 9.1a** (CSH shares with BOTH Q3 and Q7 `1|1|true` incl. `is_active`) and **§ 9.1b** (CSH holds **zero memberships at any scope**). Both keystones' labels now carry the load-bearing-only-because clause. Ported from `392 § 4.1/§ 4.2` as asked. Green in my run. |
| **B5** | ⛔ **NOT CLOSED** | Four locations were corrected (`0163:59-62`, `0164:76`, `…005600:47` header, `393:242` banner — all verified). **Two residues:** (1) `…005600:232`'s `comment on function app.tenant_orphan_profiles()` still says *"administrable by platform_admin alone"* **and it is live in the catalog** — measured via `obj_description` after my fresh reset. It needs a forward migration (`.claude/rules/migrations-forward-only.md`); the natural place was `…005800` and it was missed. (2) Round 1's ask (b) — **CNV-4** — was not discharged, and I discharged it: a table-level `platform_admin` path **exists** (see R2-M2), so ADR 0164:76's corrected *"administrable by NOBODY"* is itself wrong at the table grain. The 393 banner and the `…005600` header say *"through the six person doors"* — the correct grain; ADR 0164 does not. |
| **B6** | **CLOSED** | The inc-3 ARM evidence is now recorded in the increment's own record with provenance (`authz-ae2.md` § "B6 discharged": figures, head `2664081c`, fresh-reset statement, and the copies-vs-identical explanation — which correctly says the **reason** is the evidence, not the equality). I re-verified at **current** head: census 567/603 HOLDS, hat/floor/wrapper hold, and I independently reproduced the lead's inc-4 sweep — **SWEPT 5 · COVERED 5 · BLIND 0**, baseline untouched. The historical 565/601-at-`2664081c` figures I did not re-measure at that head (see Could-not-verify); the current-head facts supersede them. Residue → R2-M3 (PROGRESS.md § Now is stale on a different axis). |
| **M1** | **CLOSED** | ADR 0165 header: `**Amends:** 0164` present with the scope-reversal as its reason (`0165:8`); `INDEX.md:188-189` shows `0164 … amended by 0165` and `0165 … amends 0151, 0164`. `lint:adr-index` green in my run. |
| **M2** | **CLOSED** | `…005500:78-84` re-tensed to "moves in AE2.4 increment 4" and **names `addStaff` as the twin this migration itself left behind** — more than asked. |
| **M3** | **CLOSED** | `public.tenant_orphan_profiles()` (`…005800:215-233`): pure delegation, DEFINER, **service_role-only** (ACL measured: `postgres,service_role`), `app` function ACL untouched (`postgres`-only — measured; the hand-applied `service_role` grant the FUP records is gone after reset, confirming chain-derivation). Production caller: `isTenantOrphan` → `listTenantOrphans` in `src/lib/users/actions.ts`, invoked on `registerUser`'s **success path and both post-account failure branches** (diff verified, lines 802-810/830-838/988-1010). Fails open narrowly, never an authz input, residuals stated in the docstring. `395 § 9.0-9.3` + M14/M15/M16 cover it. ⚠ Its *population* problem → R2-B1. |
| **M4** | **CLOSED** | `0163:200+`: the closing section carries an explicit `⛔ RE-TENSED 2026-08-28 (QA M4)` block with the correct history. Minor residue (R2-m2): its last clause, "*still open as of this edit*" for `members.ts:243`, went stale the same day when inc 4 landed — it is dated, so a reader knows the vantage, but this ADR is now stale-then-re-tensed-then-stale-again. |
| **M5** | **CLOSED** | All three task-table cells corrected in place with strike-notes (AE2.5 ✅ `7654110c`; inc 1 **16** mutations with the flattering/self-deprecating class named; AE2.0 **capability-blind**); `…005400:6` carries the retired-label correction (⚠ note: correcting an already-applied migration's comment in place sits at the edge of `migrations-forward-only`'s "comment-only edit is NOT free" — the byte drift vs the remote is real once pushed; flagged, not blocking, since the file has never been pushed: PROGRESS.md records the whole AE2 chain as unpushed). |
| **M6** | **CLOSED** | `person-footprint-reads.test.ts`: the mock now **filters** on `eq`/`is` (diff verified) and § 5 adds five arms — void-only (5.1), tie→both (5.2), voided-row-ends-later ordering trap (5.3), active-plus-ended (5.4), retention positive control (5.5) — each annotated with the mutation and the observed red. Bounds 1–3 now have TS coverage. Ran green ×3. |
| **M7** | **CLOSED** | The read lives in `src/lib/queries/affiliations.ts` (`listNonVoidedOrgAffiliationsFor`); `personAuthorityOrgs` keeps only the four bounds and re-wraps the throw so its keystone-matched message stays owned (diff verified). The file header's wrong exception-bound is corrected in the new block. One read, three consumers (`person-footprint`, `addStaff`, `invite`) — the three-copies shape retired. |
| **M8** | **CLOSED** | `393 § 5.5` now performs its **own write** (F1, a fresh person nothing else touches) with the flush **in the same statement block**, and **§ 5.5b** asserts F1's hospital row AND org parent exist (`'1|1'`) so the flush provably had a deferred event to fire. Exactly the ask. |
| **M9** | **CLOSED** | `391`: **§ 3.4** is the positive widening cell (`p_crossanchored` listed = 1 for `orgadmin.b` as real `staff_admin` of comm B); § 3.3 now uses **`platform@test.local`** (`is_admin = true`, zero memberships) with the door's arm analysis read from `pg_proc` in the comment; § 3.2 is `is_empty(...)`. The §§ 3.1–3.3/§ 3.4 dependency is stated ("if § 3.4 reds, the denies are unproven that run"). |
| **M10** | **CLOSED** | `394 § 3.4` scoped to **HB1** (the only caller for which the empty-footprint sentence is what the cell measures); § 3.4b keeps HA1/HAD as a labelled denied-earlier control. |
| **M11** | **CLOSED-WITH-QUALIFICATION** | ADR 0165 § Consequences (`:86-108`) states the full gained-capability set (Class-2 reads; fields/credentials; **cpf_change + lifecycle** via SUBSET-coincidence), states Rule 13 is not violated and why the property is still worth naming, and marks it **"a PO decision … recorded here unaccepted"** with the alternative and its flip-cells named. The statement half is done. ⛔ **The acceptance half is still owed and round 1 made it a hard pre-drop condition** — the drop increment must not start until the PO ruling is written. |
| **M12** | **CLOSED** | `ARCHITECTURE.md:673-677` now cites **both** `392 § 4.3` (target axis) and `394 § 9.2` (capability axis) with the axis distinction stated; B4's fix makes the second non-vacuous. |
| **M13** | **CLOSED** | Census summary row now reads "Functions ⚠ **schema-bounded**" (`:401`), and a **database-wide re-derivation at head `20261003005800`** is recorded with its delta (exactly `test_helpers.bootstrap`, a pgTAP fixture) and the correct "first data point, not the answer" bound on CNV-3. I re-derived it myself: 3 rows database-wide, identical list. |
| **M14** | **CLOSED** | The increment-4 task row names all three consumers (+ the M3 caller); the record's own header states the enumerating property ("a predicate that resolves the person's tenancy from the column, never a list"). |

**Count: 18 CLOSED · 1 CLOSED-WITH-QUALIFICATION (M11) · 1 NOT CLOSED (B5).**

---

## Round 1's could-not-verify list, discharged

All run on my fresh reset at head `20261003005800`, quiet stack.

| item | measured result |
|---|---|
| **CNV-1** | **Zero** policies database-wide name `home_organization_id` in `qual` **or** `with_check` — the AE2.2 claim holds at the stronger grain round 1 asked about (no UPDATE/DELETE `USING` carries it either). Policies on the three tables enumerated: `profiles` ×5, `professional_credentials` ×1 (SELECT), `organization_affiliations` ×1 (SELECT) — **all PERMISSIVE**, none RESTRICTIVE. |
| **CNV-2** | `prosecdef`/ACL for all 17 phase doors measured (table in my working notes; highlights): all six person kernels + both affiliate doors + `person_authority_orgs` + `person_audit_organization` + `app.tenant_orphan_profiles` are DEFINER `postgres`-only; `can_administer_person_via_affiliation` and `person_has_active_org_affiliation` DEFINER `{authenticated, service_role}`; `list_addable_commission_members` DEFINER `{authenticated, service_role}`; **`list_linkable_org_users` INVOKER (`prosecdef=f`)** `{authenticated, service_role}`; `public.tenant_orphan_profiles` DEFINER `service_role`-only. Matches every record claim. |
| **CNV-3** | Unbounded (`--`-stripped) function census: **3** — `public.guard_profile_privileged_columns`, `public.handle_new_user`, `test_helpers.bootstrap` (pgTAP fixture, not chain-derived). The schema bound hid no production consumer **today**; stands re-derivable at the drop. |
| **CNV-4** | **Settles B5, and the answer is "a table-level path EXISTS":** `profiles_admin_update` is `USING app.is_admin() WITH CHECK app.is_admin()`; `guard_profile_privileged_columns` (body read from `pg_proc`) **admits a signed-in admin for `is_admin`/`is_active`** and blocks only the identity columns (`cpf`, `home_organization_id`, `date_of_birth`, `phone`, `professional_category_id`, `must_change_password`, `suspended_until`, `email_confirmed_at`) for every signed-in caller; `authenticated` holds column UPDATE on `full_name`, `email`, `is_admin`, `is_active`, … (not `cpf`/`dob`/`phone`). So a `platform_admin` **can** rename, re-email, deactivate, or demote **any** profile — orphans included — by direct table UPDATE. "Administrable by nobody" is true **only through the six person doors**. → R2-M2. |
| **CNV-5** | (m6 half 1) The `is_admin` true→false demotion **is reachable** (RLS `profiles_admin_update` + guard's admin arm + column grant), and after `…005600` dropped the profiles-side trigger, **nothing checks containment on it** — a demoted, unaffiliated admin becomes an orphan with no check firing and no entry in `…005600:52-60`'s pre-declared widening list. Detector catches it lazily. → R2-m3. |
| **CNV-6** | (m6 half 2) `authenticated` holds **zero** UPDATE/INSERT/DELETE column privileges on `organization_affiliations` (SELECT ×11 only) — a `principal_id` reassignment is service-role-only, so half 2 is unreachable by any signed-in caller. Trigger set on the table confirmed: no-delete guard, audit, and the containment constraint trigger on `DELETE OR UPDATE OF voided_at`. |
| **CNV-7** | Run by me at current head: census **567/603 HOLDS** (0) · hat 3-allowlisted (0) · floor **72** (0) · wrapper **41** (0). The inc-4 census newcomers now carry verdicts (the lead's sweep landed them). |
| **CNV-8** | Diff-scoped sweep independently reproduced by me over the 5 derived cases: **SWEPT 5 · COVERED 5 · BLIND 0 · ERROR 0 — CLEAN**, exit 0; subset report went to scratch; committed findings baseline verified unchanged (`git diff --stat` empty + the harness's own cksum line). |
| **CNV-9** | `not pr.is_admin` appears in **both** prior emissions of `list_addable_commission_members` (`20260705000000:54`, `20260720000300:147`) — AE2.2 added nothing undeclared; ADR 0163's quote of the old body was merely incomplete. |
| **CNV-10** | `supabase db reset` + `npm run test:db`: **243 files / 8119 tests, PASS** — and the record's +54 decomposition (395 +44, 390 +2, 391 +1, 393 +4, 394 +3) sums exactly. |
| **CNV-11** | The differential figures are now **observed**: `394` (plan 45) ran green in my suite run, so its internal `x_expect` count assertions (396 cells / 48 widenings / 44 narrowings) held at runtime. |
| **CNV-12** | `npm run gen:types` at head → **empty diff** on `src/lib/types/database.ts` (the +15 inc-4 lines are committed; nothing further drifts). |

---

## Increment 4, reviewed as new material

**Scope reviewed:** migration `20261003005800`, suite `395`, `src/lib/queries/members.ts`,
`src/lib/queries/affiliations.ts` (new block), `src/lib/members/{actions,invite}.ts`,
`src/lib/users/{actions,person-footprint}.ts`, vitest `invite.test.ts`,
`org-roster-predicate.test.ts`, `staff-ops-mirror.test.ts`, the arm-domain analysis, and the
unswept-backlog ruling for the wrapper.

**⛔ The column drop still does not exist and stays out of scope**, verified in the catalog:
`profiles.home_organization_id` present, `attnotnull = f`, no drop migration on disk. Every
"after the drop" sentence in the ADRs remains a prediction this review does not certify.

Checked and found sound (beyond what the adjudication table already covers):

- **Shape C-b′ is correctly built and correctly bounded.** Wrapper INVOKER + `plpgsql` (inside
  census c2/ARM=wrapper domains — a deliberate, stated choice), pinned `search_path`, returns
  `AddableUser`'s three columns; helper DEFINER with **no caller term** (Rule 13: locates only);
  the audience decision stays with `profiles` RLS. The two call sites match the record exactly
  (`casos/[caseId]/page.tsx:137`, `manage/cases/[caseId]/(detail)/page.tsx:169`).
- **The one-bit existence oracle is pre-declared, asserted positively (`395 § 5.1`), and bounded**
  (`§ 4.1` zero rows under a flipped context is red-tested via M7/M19; `§ 5.2` zero policy rows).
- **The wrapper's not-a-gate ruling** (`authz-unswept-backlog.txt`) is catalog-measured and each
  clause checks out against my CNV-2 read: INVOKER over RLS-bound `profiles` is narrowing-only, and
  the DEFINER helper it calls is independently COVERED (my sweep confirmed).
- **`resolveOrInviteUser`'s predicate choice** (non-voided known-here-or-known-nowhere, mirroring
  increment 1's already-ruled gate, with `is_admin` as a stated separate arm raising the same
  message) is the right predicate for the BIND question, and `invite.test.ts` pins the
  invited-but-unaffiliated admit cell, the voided-exclusion filter, and the nothing-created failure
  ordering. **But see R2-B1 — the admit side of this population was engineered and its
  administration side was not.**
- **The § 2 constructed divergence** buys its isolation correctly (every target holds a CCIH
  membership; § 2.0 measures visibility of all eight), builds no fixture out of the subject, and
  records its own hand-computation error (`6 → 1` corrected to `6 → 2` by the run).
- **`395`'s § 0.6** evaluates ARM=policy's domain expression verbatim so a body rewrite that leaves
  the swept domain reds; § 0.7 is the C-a prohibition as a policy-text gate (count + cmd + qual md5).
- **`registerUser`'s user_metadata still seeds `home_organization_id`** — declared, with the drop
  increment named as the owner of `handle_new_user`; consistent with § 7.2's two-function floor.

---

## New findings

### R2-B1 ⛔ BLOCKING — a fully-successful, supported flow is a **standing producer** of the state ADR 0164 accepts as a crash window: invite-provisioned admins are permanently unaffiliated, in no roster, administrable through the six person doors by nobody

**Requirement violated:** ADR 0164 § Consequences (the orphan window is characterized as *"a
half-failed person creation"* — the acceptance rests on that population claim); plan § AE2
([PA-F13] — a widening/narrowing must be enumerated with its **population**, not only its cell);
the phase's own standard that a declared narrowing's population claim must survive measurement.

**Measured mechanism (all from the catalog and the shipped code, this head):**
- `assignStaffAdmin` (`src/lib/admin/actions.ts:265`) and `assignOrgAdmin`
  (`src/lib/platform/actions.ts:183`) provision users via `resolveOrInviteUser` and grant a
  **membership** — and **nothing on either path ever creates an `organization_affiliations` row**:
  `handle_new_user` writes none (body read from `pg_proc`: zero mentions), neither caller invokes
  `affiliate_person_to_org_for`, and the `/auth/confirm` → first-password flow contains no
  affiliation write (`grep` over `src/app/(auth)`, `src/app/auth`).
- The invite docstring itself states and *depends on* this: the bind gate deliberately admits the
  zero-affiliation invited state (re-provisioning, `e2e/platform-org-admin-provisioning.spec.ts:85`).
- Consequently, for every person provisioned through these flows, **permanently** (nothing later
  affiliates them): `app.person_authority_orgs` = ∅ → all six person doors return false **for every
  caller** (fields, credentials, cpf_change, lifecycle); absent from `list_org_people` (affiliation-
  filtered since AFF4 D10); refused by `list_addable_commission_members` and by the new picker;
  and **reported by `app.tenant_orphan_profiles()` as `never_affiliated`** — so `isTenantOrphan`'s
  platform-wide `console.error` names them on every subsequent `registerUser` in any org, forever
  (cross-org profile ids in app logs; noise that will train operators to ignore the one real
  signal ADR 0164's mitigation exists to give).

**Concrete failure scenario.** A platform admin provisions Rede C's first `org_admin` via
`assignOrgAdmin`. The admin confirms, works normally through memberships. A year later their name
must be corrected or their account deactivated on offboarding: no `org_admin`, no `hospital_admin`,
and — through the doors — no `platform_admin` can do it; the person appears in the orphan log of
every registration anywhere; the only recovery is ADR 0165 D1's claim-by-uuid, and there is **no UI
that can find them** to supply the uuid (they are in no roster; only a commission member list or the
service-role detector knows the id). Before this phase, the column made the same person visible and
administrable — the transition was never declared with this population in it.

**Why this is the sixth sibling-axis split.** The phase engineered the **admit** side of the
invited-unaffiliated population with care (the bind gate, `invite.test.ts`'s ⭐⭐ cell, the e2e
dependency) and never asked what the **read/administer** side of the same population does — the
identical shape as B1 (read moved, write didn't), one axis over. The record's M3 section even names
the adjacent case (a `hospital_admin` registering with no hospital) and stops one flow short.

**Ask (one of, PO's choice, in writing):** (a) make the provisioning flows affiliate — e.g.
`assignOrgAdmin`/`assignStaffAdmin` call `affiliate_person_to_org_for` after resolve (the org is in
hand on both paths); or (b) rule that provisioned governance principals are legitimately
affiliation-less — in which case the orphan detector **must** learn to discriminate them (it cannot
today: membership-holding and crash-orphaned are shape-identical to it), ADR 0164's population claim
must be rewritten, and the un-administrable + un-listable consequences accepted explicitly; or
(c) an interim: exclude membership-holding principals from `tenant_orphan_profiles()` and file the
administration gap. As shipped, neither the acceptance nor the discrimination exists.

### R2-M1 ⛔ MAJOR (B5 residue) — the false B5 sentence is live in the catalog

`comment on function app.tenant_orphan_profiles()` (`…005600:232`) still reads *"…administrable by
platform_admin alone…"* — measured via `obj_description` after my fresh reset. The header of the
**same file** was corrected (`:47`) and the `comment on` 185 lines below was not — the intra-file
sibling split, again. A catalog comment is exactly what a future DBA reads beside the function.
**Ask:** re-emit the corrected comment in a **new** migration (forward-only rule; do not edit
`…005600`, which my reset has now applied everywhere local).

### R2-M2 ⛔ MAJOR (B5 residue / CNV-4's answer) — "administrable by NOBODY" is wrong at the table grain, and no document states the grain

Measured (CNV-4/CNV-5 above): `profiles_admin_update` (`USING app.is_admin()`) + the guard's
admin arm + `authenticated`'s column grants give a `platform_admin` live table-level UPDATE of
`full_name`, `email`, `is_admin`, `is_active` on **any** profile, orphans included — i.e. rename,
deactivate, demote. ADR 0164:76's corrected sentence says "administrable by **NOBODY**" with no
grain qualifier; `393`'s banner and `…005600`'s header correctly say *"through the six person
doors"*. Round 1's B5 ask (b) predicted exactly this: *"if it does, the claim is true at a grain
the ADRs do not state, and stating the grain is the fix."* **Ask:** add the grain to ADR 0164 (and
0163 if the PO considers the table path part of "administrable"), stating what a `platform_admin`
retains at the table level and that the four *capabilities* remain door-gated.

### R2-M3 ⛔ MAJOR — PROGRESS.md § Now is stale against the repo in three cells

`PROGRESS.md:50` (read-only for me; the lead's row): says **"NEXT: inc 4"** while inc 4 shipped
`41285d27` the same day; says AE2 added **"4 more"** migrations / 13 unpushed while the chain now
has **5** AE2 migrations / **14** unpushed; carries no inc-4 gate row (sweep 5/5, census 567/603,
test:db 243/8119 exist only in the phase doc). The live-state doc asserts a false § Now — M5's
class, in the one file every session is told to trust. **Ask:** lead updates § Now in the same
edit as this review's verdict row.

### Minor

| # | finding | location |
|---|---|---|
| R2-m1 | **Vitest is flaky at head:** run 1 of 3 failed (1 of 1993, exit 1); runs 2–3 fully green. All three ran while my DB sweep held the CPU, so contention is a plausible cause, but the failing test was not identified before the state was lost. The record's "145/1993 green" is reproducible but not unconditionally. Worth one `--retry=0` loop to name the test | `npx vitest run` |
| R2-m2 | ADR 0163's re-tensed closing paragraph ends *"…still open as of this edit"* about `members.ts:243` — false since inc 4 landed, hours later. Dated, so low harm; but this exact paragraph has now been wrong, corrected, and wrong again | `0163:200+` |
| R2-m3 | (round-1 m6, now measured) The in-session `is_admin` demotion path is **reachable** and produces an unchecked orphan; it is absent from `…005600:52-60`'s pre-declared list. Half 2 (principal reassignment) is unreachable for `authenticated` (zero non-SELECT column grants). Declare the demotion cell, or give the profiles side a trigger arm | CNV-5/CNV-6 |
| R2-m4 | `isTenantOrphan` logs the **platform-wide** orphan set (ids + reasons) into any org's `registerUser` request log — cross-tenant ids in app logs, and the wolf-crying interacts with R2-B1. If R2-B1(a) is taken this mostly self-resolves | `src/lib/users/actions.ts:57-78` |
| R2-m5 | `OrgUserDetail.homeOrganizationId` (round-1 m9) still a dead produced field | `src/lib/queries/org-users.ts:761` |

---

## Could not verify, stated as such

- **The 19-mutation table for `395` (incl. M18/M18b) and the re-run mutation tables for
  `390`–`394`.** I verified the suites are green on a fresh reset and read every load-bearing
  assertion; I did **not** replay the mutations (≈25 full-suite runs). The tables' run-shape
  discipline (re-run after § 9.0 was added; md5-verified restores) is documented and internally
  consistent, and my 5-case door sweep independently exercised the neutralize→restore machinery
  CLEAN — but the per-mutation reds remain the author's observations, not mine.
- **`391`'s old-predicate replay** ("§ 2.1, § 2.2, § 3.1, § 3.4, § 4.1, § 4.2 red together") — same
  status: documentary.
- **The inc-3-head (`2664081c`) arm figures (565/601 etc.).** I measured the arms at the *current*
  head only. The lead's recorded run at the old head is now provenance-complete but not
  re-measured; the current-head measurements supersede it for any forward decision.
- **`npm run e2e:prod`.** Not run (hours; Phase-Gate step 2 is the tester's). No e2e claim in this
  review depends on it; `platform-org-admin-provisioning.spec.ts`'s dependence on the invite
  re-provisioning path (R2-B1) is cited from the code's own docstring, not from a run.
- **The remote.** Nothing here says anything about the remote DB; PROGRESS.md records the entire
  AE2 chain as unpushed and I did not touch `db push`.

---

## What must happen before APPROVED

1. **R2-B1** — the PO rules on the provisioned-unaffiliated population (affiliate at provisioning,
   or accept + make the detector able to discriminate), in writing.
2. **B5 residues** — R2-M1 (forward migration re-emitting the catalog comment) and R2-M2 (the grain
   stated in ADR 0164, and 0163 if the PO wants the table path in scope).
3. **R2-M3** — PROGRESS.md § Now brought back to reality by the lead.
4. **M11's qualification stands from round 1:** the gained-capability acceptance must be a written
   PO ruling **before the drop increment starts**.
5. Minors may ride along; R2-m3's declaration belongs in the drop increment's pre-declared list at
   the latest.

---

## Verdict row for the lead (I do not write PROGRESS.md per this task's constraint)

```
| 2026-08-28 | Gate AE2 QA round 2 (independent; adjudication of r1's 20 + inc 4 + the 12 CNVs) | ⛔ CHANGES REQUESTED | 19/20 r1 findings closed (18 CLOSED, M11 closed-w-qual — PO acceptance still owed pre-drop); B5 NOT CLOSED (live catalog comment still says "platform_admin alone"; CNV-4 measured a table-level platform_admin path no doc states). 1 NEW BLOCKING: invite-provisioned admins are a STANDING producer of ADR 0164's "crash-window" orphan state — unaffiliated forever, in no roster, person-doors deny everyone, detector cries wolf (sixth sibling-axis split). All 12 CNVs discharged on a fresh reset: test:db 243/8119 PASS, census 567/603 HOLDS, hat/floor/wrapper hold, diff-scoped sweep independently reproduced SWEPT 5 · COVERED 5 · BLIND 0, gen:types no-diff, zero policies name the column. 3 major, 5 minor. Report: docs/reviews/authz-ae2-review-r2.md |
```

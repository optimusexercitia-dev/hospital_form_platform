# CAN-MANAGE-PROFESSIONAL-SELF-CHECK — progress record

`app.can_manage_professional`'s self-check arm: pre-AE5 remediation **Batch 8**. The unit's
**summary** is its hub,
[docs/features/can-manage-professional-self-check.md](../features/can-manage-professional-self-check.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `app.can_manage_professional(p_org uuid, p_uid uuid)` as it exists in the **live
catalog** (never the migration text — ADR 0078; some migrations rewrite function bodies at
runtime), its callers, `docs/backend-state/authorization-and-audit.md` (the seam that owns the
predicate; a slice APPENDED there and its `## Current state` block REPLACED at the Record step),
`supabase/migrations/` and `supabase/tests/` **if the PO rules for a fix**, and ADR **0200**
(reserved at unit open; written only if there is a decision to record).
Decisions read: [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the
door-audit sweep is a standing gate — a migration owes both arms), 0190 + 0191 (the deriver and
the widened domain the sweep runs over), 0192 (the write arm), 0193 (the re-keyed representative
chain `can_create_professional → can_manage_professional` that AE5's `org_admin` increment
substitutes through) — all in `docs/decisions/INDEX.md`.

## Session log

### 2026-09-09 — unit opened (lead)

**Why now.** Batches 0–7 are concluded and on local `main`; the plan's §6 checklist reads
*"Batch 8 is next"*; the PO said *"initiate batch 8"* and authorised the Agent Team. The window
matters because AE5 substitutes eleven increments through the representative chain this predicate
sits on, and a self/third-party asymmetry in the template is copied eleven times.

**Preconditions, measured rather than assumed** (plan §6 step 1): `git status` porcelain empty on
`main` @ `4fe0c464`; `git rev-list --count origin/main..main` = **74** (⛔ unpushed and NOT pushed
by this unit — the Batch 4 and Batch 7 push overrides were each scoped in writing to one push;
`origin/main` sits at ADR 0193 while local `main` carries 0199); `docs/features/INDEX.md` shows no
`in_progress` hub; `git worktree list` shows only the primary tree. Branch
`authz-can-manage-professional-self-check` cut off `main` **before** the hub was written, because
gate 13 resolves an `in_progress` hub's `branch:` against local branches (Batch 6's finding).

**Migration head pair at open:** `(20261003007350, 524)` — keyed on the pair, never "head N"
(Batch 7's lesson: `…004710` was inserted below `…005300` after the commit that added it).

**ADR number.** `0200` reserved — *highest on any live branch + 1*: local `main` 0199,
`origin/main` 0193, `origin/authz-enforcement-manifest` 0193, `origin/authz-c2-tier1` 0180.
⚠ Written only if the PO's ruling is a decision worth recording; a DEFER ruling with a re-open
condition is one (Batch 0 / Batch 7 R1 precedent), and so is a fix.

**What the follow-up's body claims, and what is a measurement to re-derive.** The body (filed
2026-09-01) states: 13 callers, 12 passing `auth.uid()`, exactly one passing a third party
(`app.can_read_professional_profile` at `can_manage_professional(v_org, p_uid)`); the reachable
consequence is a `platform_admin` asking *"can user X read this profile?"* getting TRUE because
the **asker** is an admin. ⛔ Every one of those figures is eight days old and predates migrations
`…007190` (the BUG-PROF-INACTIVE-001 fix), `…007330` and `…007350`. Read from `pg_proc` at the
pair above, or it is a quotation, not a finding.

**Protocol.** Plan §4: `backend` (Opus — authz semantics) returns a FULL plan before touching
anything; the lead approves with rulings in ONE scratch file; the PO question (disposition) goes
to the PO **after** the reachability measurement, because it needs one. ⛔ Lead writes no feature
code, no migration, no SQL.

### 2026-09-09 — plan received; lead spot-check; rulings put to the PO (lead)

**Plan.** `backend` (Opus) returned a FULL plan (session scratchpad `batch8-backend-plan.md`,
886 lines; folded into ADR 0200 + this record at the Record step — a scratchpad is not a home).
Tree untouched by the planning turn (`git status` clean at `3553f912`).

**The follow-up is wrong in both directions, measured at pair `(20261003007350, 524)`:**
- **Defect BIGGER:** *both* arms are caller-keyed — `app.is_org_admin_of(p_org)` reads
  `auth.uid()` exactly as `app.is_admin()` does; `p_uid` is a pure null guard. The live body's own
  header comment says so (*"narrowed rather than fixed … Left alone deliberately"*, AE4.7c).
- **Reach SMALLER — the body's stated consequence is REFUTED:** 7 direct call sites (body said
  13), 20 call expressions in the transitive closure, **0 reachable third-party paths**. The one
  third-party caller the body names, `app.can_read_professional_profile`, is itself only ever
  called with `auth.uid()` (2 RLS SELECT policies, `get_case_professional`,
  `_audit_access_authorized` whose `v_uid := auth.uid()`). 0 triggers. 0 TS call sites (`app`
  is not PostgREST-exposed — `supabase/config.toml` `[api].schemas`). A latent trap, not a hole.
- **Second defect site the FUP misses:** `can_read_professional_profile` has its *own*
  `coalesce(app.is_admin(), false)` first arm that fires **before** it reaches
  `can_manage_professional`. Fixing only the named predicate leaves the FUP's own stated
  consequence true.
- **Both polarities constructed and measured (rolled back):** over-grant — admin caller `…b0`
  about `chefe.ccih` → `true`, oracle `false`; under-grant — no-role caller about `orgadmin.a` →
  `false`, oracle `true`; SELF control agrees.
- **The fix already exists:** `app.is_admin_for(p_uid)` (3 callers) and
  `app.is_org_admin_of_for(p_org, p_uid)` (14 callers); `is_admin_for`'s comment was written for
  this case. Two-identifier substitution, no new object, no signature change, `gen:types` a no-op.
- **One measured non-equivalence at SELF:** `is_admin()` has a JWT-claim fast path that
  `is_admin_for` lacks — a *tightening* (closes a stale-token window for a demoted admin); 0 seed
  principals and 0 pgTAP fixtures exposed (11 files use `claims_for(…, true)`, the one touching
  these predicates uses `…b0`, whose `profiles.is_admin` is true). Must be declared in ADR 0200.

**Lead spot-check (independent, same DB `supabase_db_azkbbhskturikxpgmafq`, rolled back):**
`prosrc like '%can_manage_professional%'` excluding itself = **8** (plan: 7 calls + 1 comment
match — agrees); both `_for` twins present = **2**; `prosecdef` = `t`; OVER-GRANT current
`t` vs oracle `f` — reproduced; `can_read_professional_profile(<profile>, chefe.ccih)` under the
admin caller = `t` — the second site's own arm confirmed.

**Corrections the plan made to the lead's brief:** `docs/backend-state/conventions.md` carries no
pgTAP persona idiom (0 hits) — homes are `supabase/tests/00_setup.sql` (`test_helpers.claims_for`)
and `409`; `404` is the wrong fixture model (no role switching); next free test number is
**415** across all live branches. Also found: the enforcement manifest's `_comment` on rows 31/32
says `401 §19.2b` is RED awaiting a ruling — measured GREEN (prose rot on the authority document;
to FILE, not fix here).

**Rulings put to the PO (AskUserQuestion), before any build:** R1 disposition (fix via the `_for`
twins / drop arm 1 / defer with a mechanical re-open condition; recommended fix) · R2 scope — also
fix `can_read_professional_profile`'s own arm in the same migration (recommended yes; a "fix"
without it must NOT close the FUP) · R3 acknowledge the claim-fast-path tightening as a declared
consequence. Outcome recorded in the next entry.

### 2026-09-09 — PO rulings R1–R3; lead rulings L1–L11; build authorised (lead)

**PO rulings (AskUserQuestion, all three on the recommendation):** **R1** FIX NOW via the
existing `_for` twins (Option i) · **R2** scope YES — `app.can_read_professional_profile`'s own
`is_admin()` first arm is fixed in the SAME migration, each site with its own cells; no
`FUP-CAN-READ-…` is filed · **R3** the claim-fast-path tightening is ACKNOWLEDGED and is declared
in ADR 0200 § Consequences, never inside a "no regression" claim.

**Lead rulings L1–L11** live in the session scratchpad `batch8-rulings.md` (the ONE file the
build turn reads) and are summarised here so they outlive the session: L1 full
`create or replace` for both functions with both-direction, `(`-terminated landing assertions and a
`-- door-sweep-targets:` header naming both · L2 new pgTAP `415`, 409 fixture model, bidirectional
pairs **for both sites** plus SELF discrimination cells, predicates called directly · L3 RED-first
observed at head and quoted in this record before the migration is written · L4 collateral
comment edits as dated notes; manifest row `org.professionals.read` `composedWith` →
`app.is_admin_for` with the projection regenerated · L5 ADR 0200 by `backend`, `Amends: 0193`, the
AE5 template obligation stated as data (0193 D5) · L6 backend drafts the seam slice, lead applies
at Record · L7 five follow-ups to file at Record (bodies drafted by backend) · L8 the rewritten
`Closes when` is the Record-step text; FUP stays open and the box unticked until then · L9 backend
is sole owner of the local stack during the build; the lead runs the tip gate · L10 a session-log
entry in the same commit as the code it witnesses; no amend, no push · L11 out of scope: Option
(ii), `is_active` on the admin arm, the manifest `_comment` rot (file only), anything in `src/`.

### 2026-09-09 — build (backend)

Executed plan §§B1/B1.0/B4 + §C1 under PO rulings R1–R3 and lead rulings L1–L11. Head pair
**re-checked at write time** and unmoved from the plan's anchor: `(20261003007350, 524)`.
Timestamp allocated `20261003007360`; head after the build `(20261003007360, 525)`.

**RED-FIRST, WITNESSED (L3).** `supabase/tests/415_fup_can_manage_professional_subject_keying.sql`
was written first and run at head **before the migration existed**. ⚠ Method note: the repo has no
single-file pgTAP runner and `pgtap` is **not installed in the reset database** — `supabase test db`
creates it per run. The file was therefore run as
`{ create extension if not exists pgtap; <00_setup.sql>; <415>; drop extension pgtap; } | psql`.
Observed output, trimmed to the verdict lines (captions elided at `…`):

```
1..17
ok 1 - 0.1 FIXTURE CONTROL: all four persona ids resolved …
ok 2 - 0.2 ⭐⭐ EXACTLY ONE of the four personas carries `profiles.is_admin = true` …
ok 3 - 0.3 ⭐ THE AUTHORITY IS LOCATED, AND ITS ABSENCE TOO …
ok 4 - 0.4 ⭐ THE MASK IS CLOSED for §2's subject …
ok 5 - 0.5 ⭐⭐ DISCRIMINATION CONTROL for 0.4 …
ok 6 - 0.6 ⭐⭐ THE SECOND MASK, MEASURED OPEN: `chefe.ccih` DOES hold `org.professionals.read` …
ok 7 - 0.7 ⭐ ...AND THE CHOSEN SUBJECT IS OUTSIDE IT …
not ok 8 - 1.1 ⭐⭐ ARM 1, OVER-GRANT — THE DEFECT THE FOLLOW-UP NAMES …
# Failed test 8: "1.1 ⭐⭐ ARM 1, OVER-GRANT …"
not ok 9 - 1.2 ⭐⭐ ARM 1, UNDER-GRANT — THE OPPOSITE POLARITY …
# Failed test 9: "1.2 ⭐⭐ ARM 1, UNDER-GRANT …"
not ok 10 - 1.3 ⭐⭐ ARM 2, UNDER-GRANT …
# Failed test 10: "1.3 ⭐⭐ ARM 2, UNDER-GRANT …"
ok 11 - 1.4 DISCRIMINATION, SELF-NEGATIVE …
not ok 12 - 1.5 ⭐⭐ ARM 2, OVER-GRANT …
# Failed test 12: "1.5 ⭐⭐ ARM 2, OVER-GRANT …"
ok 13 - 1.6 DISCRIMINATION, SELF-POSITIVE …
not ok 14 - 2.1 ⭐⭐ ARM 1, OVER-GRANT — THE SECOND SITE OF THE SAME DEFECT …
# Failed test 14: "2.1 ⭐⭐ ARM 1, OVER-GRANT — THE SECOND SITE …"
ok 15 - 2.2 DISCRIMINATION, SELF-POSITIVE …
not ok 16 - 2.3 ⭐⭐ ARM 1, UNDER-GRANT — the opposite polarity AT THE SAME SITE …
# Failed test 16: "2.3 ⭐⭐ ARM 1, UNDER-GRANT …"
ok 17 - 2.4 DISCRIMINATION, SELF-NEGATIVE, AND THE CROSS-TENANT CONTROL …
# Looks like you failed 6 tests of 17
```

**6 of 17 red, and they are exactly the six ⭐ cells** — both polarities of both arms of
`can_manage_professional`, both polarities of `can_read_professional_profile`'s own arm. All 7
fixture/mask controls and all 4 SELF-discrimination cells green, which is what says the fixture
could REACH the failing state rather than being broken. Not green-on-first-run; L3's stop
condition did not trigger. Values behind the reds, measured beforehand in rolled-back
transactions: 1.1 `true`, 1.2 `false`, 1.3 `false`, 1.5 `true`, 2.1 `true`, 2.3 `false`.

**⚠ A VACUOUS GREEN I PRODUCED AND CAUGHT, recorded because the next person will hit it.** My
first post-migration run of 415 reported `1..17` with zero `not ok` and I read it as green. It was
not: `test_helpers` is created by `00_setup.sql` and a fresh `db reset` removes it, so the file
aborted at its first `claims_for` and **nothing ran** — `ERROR: schema "test_helpers" does not
exist`, then 30 `current transaction is aborted`. The absence of `not ok` looked identical to a
pass. ⛔ **Counting `ok` against the plan line is the check; grepping for `not ok` is not**
(LEARN-015 — an assertion that never executed because its own fixture aborted the file). Every
figure below counts `ok`.

**Migration `20261003007360_can_manage_professional_subject_keying.sql`** — full
`create or replace` for both functions per L1, `-- door-sweep-targets:` header naming both, and
landing assertions BEFORE and AFTER in both directions with `(`-terminated needles. The stale
`"Left alone deliberately"` header comment is gone; both new bodies carry the ADR 0193 D5 keying
obligation in-body.

**Landing-assertion behaviour, proven able to fire rather than assumed (LEARN-084).** Applying the
migration twice in one transaction raised on the second pass:
`ERROR: BATCH8: app.can_manage_professional does not carry the expected caller-keyed arms — the body changed since this migration was written.`
So the BEFORE guard is live. The AFTER block also asserts the **preservation** half — the three
untouched arms of `can_read_professional_profile` are still present — so a `create or replace`
that silently narrowed the gate could not pass it. On the real `db reset` the migration applied
with no exception.

**Suite shape, measured on BOTH sides rather than inferred.** Both runs on a fresh
`supabase db reset --local`; the new migration and 415 were moved out of the tree for the BEFORE
run and restored for the AFTER run, so the comparison is a measurement, not arithmetic.

| run | shape | result |
| --- | --- | --- |
| BEFORE (head `…007350`, 415 absent) | `Files=263, Tests=8906` | **PASS** |
| AFTER, before collateral | `Files=264, Tests=8923` | **FAIL — 1 test**, `410 § 3.7` |
| AFTER, with collateral, fresh reset | `Files=264, Tests=8923` | **PASS** |

**+1 file, +17 assertions — exactly 415's cells.** No pre-existing assertion moved. The single red
was **predicted in the plan (§C2, "410 §3.7 under B4 ONLY — ⛔ REDS")** and its message was the
predicted one: `have: org.professionals.read: authorizer lost app.is_admin / want: (none)`.

**Collateral (L4), and a coupling L4's one-line ruling did not name.** The manifest row
`org.professionals.read` needed **three** identifier changes, not one, and two of them are
*enforced*, not stylistic:
1. `domainAuthorizer.composedWith` `app.is_admin` → `app.is_admin_for` — required by `410 § 3.7`.
2. `residualLegacyAuthority[0].gate` — **required by the generator itself**:
   `scripts/gen-authz-matrix-cells.mjs` cross-checks that every `composedWith` arm is either the
   permission arm or a declared residual gate (M4), *and* that every residual gate appears in
   `composedWith`. Changing (1) alone fails generation with two findings. The `population` string
   gained a dated note saying the population is unchanged and only the keying moved.
3. `legacyEquivalence.openArms` — ungated (neither the generator nor 410 asserts it), renamed
   anyway: leaving a data field naming an arm the body no longer calls is prose rot on the
   authority document. ⚠ **Beyond L4's literal text; flagged rather than folded in silently.**
   ⛔ Its sibling entry `app.can_create_professional` is **already stale for an unrelated reason**
   (the re-key inlined that call) and was NOT touched — different cause, different unit.

`410 § 4.6` also had to move: it pins the residual-arm projection as a **verbatim string**, so it
carried `org.professionals.read via app.is_admin` literally. Updated with a dated note; the
five-entry count and the sort position are unchanged (`app.is_admin_for` still sorts last).
Projection regenerated with `node scripts/gen-authz-matrix-cells.mjs` — **never hand-edited**;
it also moved `authz-matrix-coverage.json`'s `manifestSha256`, which is the generator maintaining
its own digest, not a stray edit.

**410 § 3.6 and § 3.7 proven green AFTER, quoted (run in-container so `\ir vectors/…` resolves):**
`ok 15 - 3.5 …` · `ok 16 - 3.6 CARDINALITY CONTROL for 3.5 AND 3.7: 13 (site, authority) pairs
plus 8 (authorizer, authority) pairs …` (= **21**, unmoved — a rename is not an add) · `ok 17 -
3.7 ⭐⭐ …` · `ok 23 - 4.6 …`; **0 `not ok` in the file.**

**Dated notes, never rewrites (L4).** `406` §2.2/§2.3 and `410`'s depth-3 call-graph lines each
carry a dated amendment beside the original. The `406` note records the finding the plan flagged
as most worth a reviewer's eye: **§2.2 was passing VACUOUSLY** — it runs with no claims set, so
with `auth.uid()` NULL both caller-keyed arms were false for *every* subject and the assertion
could not fail. It now answers about `sa`. **The green bar is identical on both sides**, which is
why it is written down.

**ADR `docs/decisions/0200-professional-identity-predicates-answer-about-their-subject.md`** —
`Status: proposed`, `Area: authorization / professional identity (Class-2) / the AE5 re-key
template`, `Amends: 0193`, `Related: 0078 0079 0106 0155 0176 0190 0192`. Three link slugs were
guessed wrong on first write and corrected against the tree (`0078-authorization-capability-model`,
`0106-act-as-role-assumption`, `0190-the-door-sweep-deriver-…`). `npm run adr:index` rebuilt the
index and wrote the back-pointer into 0193.

**⚠ Gate 9 red I hit and resolved honestly:** adding a `proposed` ADR drifts the set in
`docs/decisions/proposed-review.json`. I added `"0200"` to `proposed` and **left `reviewed: null`
untouched** — the file's `_comment` invites setting a review date, and doing so would have claimed
a re-read of eight other ADRs that did not happen. The staleness clock runs from
`installed: 2026-08-24` (16 days), so the set fix alone greens it.

**A cross-check that the change landed at exactly the intended sites.** Comment-stripped `prosrc`
caller counts for the twins: `is_admin_for` **3 → 5**, `is_org_admin_of_for` **14 → 15** — two new
`is_admin_for` sites (one per function) and one new `is_org_admin_of_for` site, which is precisely
the edit. A fourth mover would have shown here.

**Fixture-exposure bound for the R3 tightening, re-derived on the post-migration tree:**
`grep -rlE "claims_for\([^,)]*, *true" supabase/tests/` → **11 files** (of 264); intersected with
files naming either predicate → **exactly 1**,
`387_initplan_wrap_and_profiles_arm_identity.sql`, which uses the principal whose
`profiles.is_admin` is genuinely `true`. `select count(*) filter (where is_admin) || ' of ' ||
count(*) from public.profiles` → **1 of 36**. Zero fixtures exposed — and the full `test:db` PASS
is what confirms it, not the grep.

**Gate chain, all bare.** `npm run lint` **exit 0**, and it REACHED every gate — `eslint` ·
`lint:css-vars` · `memberships-door` · `client-server-imports` · `vacuous` · `set-local` ·
`progress` · `rules` · `adr-index` · `mojibake` · `service-role-registry` · `authz-vectors` ·
`registers` · `config-schemas` · `budget-anchor` · `backend-state` · `data-access` (the first run
died at `adr-index`, gate 9 above, and proved nothing about the eight gates after it; the figures
here are from the second, complete run). `npm run typecheck` **exit 0**. `npm run test` **exit 0**
— `Test Files 151 passed (151), Tests 2056 passed (2056)`.

**Divergences from the plan, all four.**
1. **The read-gate cells are a bidirectional PAIR on the gate's OWN arm, not the plan's single
   over-grant 2.5** (L2 ordered the pair). The under-grant cell is `caller sa → subject pa`,
   chosen so it moves with arm 1 ALONE: the org arm is arm 1 again, `authz.has_permission(pa, …)`
   is false (a platform_admin is role-free), and the committee arm is shut by the
   participation-free subject.
2. **The over-grant subject is the CROSS-ORG `xb`, not the plan's `sa`.** Measured:
   `authz.has_permission(chefe.ccih, 'organization', <org>, 'org.professionals.read')` = **true**,
   so a cell with `sa` as subject would have been masked by the re-keyed arm and could never have
   gone green. Both masks are asserted in §0 (0.6 open, 0.7 shut) rather than reasoned about.
3. **§1 carries FOUR ⭐ cells, not the plan's two** — an over-grant and an under-grant for EACH
   arm. The plan's 2.1/2.2 pair covers arm 1 over-grant and arm 2 under-grant, which leaves arm 1's
   under-grant and arm 2's over-grant unproven; the same lesson the ruling cites, applied per arm.
4. **No oracle-equality cell**, deliberately: asserting the predicate equals
   `is_admin_for(p_uid) or is_org_admin_of_for(p_org, p_uid)` compares the fixed body to itself
   (LEARN-091). Stated in the file header so its absence reads as a decision.

⛔ **NOT run by me, per L9:** the door sweep (both arms), the four authz arms, the deriver, and
`e2e:prod`. The stack is left at head `(20261003007360, 525)` on a fresh reset + a full `test:db`
PASS; ownership returns to the lead with this entry.

---

#### DRAFT (L6) — `docs/backend-state/authorization-and-audit.md` slice, for the lead to APPEND

> **§ SUBJECT-KEYING OF THE PROFESSIONAL-IDENTITY PREDICATES (2026-09-09, ADR 0200, migration
> `20261003007360`).** `app.can_manage_professional(p_org, p_uid)` and
> `app.can_read_professional_profile(p_profile_id, p_uid)` are **subject-keyed**: every arm
> resolves about `p_uid`. Before this migration both of `can_manage_professional`'s arms
> (`app.is_admin` zero-argument, `app.is_org_admin_of(p_org)`) and
> `can_read_professional_profile`'s first arm read `auth.uid()`, so a third-party-shaped signature
> sat over a pure self-check; `p_uid` was a null guard and nothing else. Reach at head was
> **0 reachable third-party paths** (20 call expressions in the closure, all resolving to
> `auth.uid()`; `app` not PostgREST-exposed; 0 triggers) — a latent trap, not a live hole, which
> is why no BUG row exists.
>
> ⚠ **FORWARD MARKER for § "Residual legacy authority reached with NO permission grant" (the
> `app.can_read_professional_profile` row):** that row's `is_admin` arm is **now `is_admin_for`**.
> The arm did not retire and its population did not change — a `platform_admin` via
> `profiles.is_admin` — only the principal it is evaluated about. `410 § 4.6`'s five-by-name pin
> and the manifest's `residualLegacyAuthority` were re-keyed with it.
>
> **The rule this seam now carries:** `app` holds a subject-keyed `_for` twin for every
> caller-keyed authority helper (`is_admin_for`, `is_org_admin_of_for`, `is_hospital_admin_of_for`,
> `is_staff_admin_of_for`, `is_tenancy_admin_of_for`, `is_nsp_org_admin_of_for`). **A predicate
> that takes a principal parameter must use the `_for` twin.** ⛔ The two are NOT interchangeable
> at SELF either: `is_admin()` trusts `request.jwt.claims ->> 'is_admin'` (a fast path minted from
> `profiles.is_admin` by `public.custom_access_token_hook`), `is_admin_for` always reads
> `profiles`, so swapping closes a stale-token window for a demoted admin. That is a **tightening**,
> and it must be declared, never absorbed into a no-regression claim.
>
> **Enforced by:** `supabase/tests/415_fup_can_manage_professional_subject_keying.sql` (17
> assertions; bidirectional cells per arm per site, 6 witnessed RED before the migration) ·
> `410 § 3.7` / `§ 4.6` (the manifest composition) · the migration's own both-direction landing
> assertions. ⛔ **Not enforced:** nothing reds if a *new* predicate pairs a caller-keyed arm with
> a `p_uid`-keyed one — that obligation is ADR 0200's data statement on the AE5 template and is
> `prose only` today.

**Replacement `## Current state` text** (only the lines that move; the block is otherwise
unchanged and stays ≤ 60 lines):

- § Surface, append to the `authz` catalog bullet: *"Authority helpers come in caller-keyed and
  **subject-keyed (`_for`)** twins; a predicate taking a principal parameter uses the `_for`
  twin (ADR 0200)."*
- § Invariants, new bullet: *"**A predicate's arms answer about the principal its signature
  names.** `can_manage_professional` and `can_read_professional_profile` are subject-keyed on
  `p_uid` since ADR 0200; both were wholly caller-keyed before, and AE4.7c's narrowing is what
  removed the last arm that read the parameter. ⛔ `is_admin()` and `is_admin_for()` are not
  interchangeable at SELF — the former trusts a JWT claim, the latter reads `profiles`."*
- § Open edges, new bullet: *"Neither `is_admin()` nor `is_admin_for()` consults `app.is_active`,
  so a deactivated `platform_admin` passes every admin arm — before and after ADR 0200
  (`FUP-IS-ADMIN-ARM-IGNORES-PRINCIPAL-STATE`). And nothing reds if a NEW predicate pairs a
  caller-keyed arm with a `p_uid`-keyed one."*
- **Updated:** 2026-09-09.

#### DRAFT (L7) — the five follow-up bodies, for the lead to FILE at the Record step

⚠ `FUP-CAN-READ-PROFESSIONAL-PROFILE-SELF-CHECK-ARM` is **NOT** among them: PO ruling R2 fixed
that site here, so filing it would assert a defect that no longer exists.

**1. 🟠 `FUP-IS-ADMIN-ARM-IGNORES-PRINCIPAL-STATE`** — *Owner:* backend.
**Mechanism:** neither `app.is_admin()` nor `app.is_admin_for()` contains an `app.is_active` term
(verified from `pg_proc`, both bodies quoted in ADR 0200). So a `platform_admin` who is
deactivated or suspended passes every admin arm in the tree — including the ones
BUG-PROF-INACTIVE-001 hardened on the org side, where `is_org_admin_of_for` *does* gate on
`is_active(p_uid)`. ADR 0200 did **not** change this in either direction: the admin arm has never
carried an `is_active` term to bypass, before or after the re-key, so this is pre-existing and was
kept out for attributability. The asymmetry now sits inside one expression — arm 2 follows the
subject's state, arm 1 ignores it.
**Closes when:** `app.is_admin_for`'s live `prosrc` contains an `app.is_active` term (verified from
`pg_proc`, comments stripped), with a pgTAP cell that deactivates a `platform_admin` and asserts
the admin arm denies, **reported RED before the change**; ⛔ or the PO rules explicitly that
platform-admin authority is deliberately independent of principal state, and that ruling is
recorded in an ADR. Not closed by "no one has deactivated an admin yet".

**2. 🟠 `FUP-PLATFORM-ADMIN-WRITES-CLASS-2-PROFESSIONAL-CONTENT`** — *Owner:* PO ruling, then backend.
**Mechanism:** `app.can_manage_professional`'s arm 1 grants on `is_admin_for(p_uid)` alone, and
that predicate gates `public.update_professional_profile` and
`public.redact_professional_profile` — CPF, licence number, specialty, i.e. **Class-2 professional
identity content**. ADR 0078 A35's noun rule says a `platform_admin` is a superuser over tenancy,
identity, vocabulary and audit and may **not** touch commission content. This is Option (ii) of
ADR 0200, rejected there only because it moves a *currently reachable* answer and would have made
the keying fix unattributable — not on the merits.
**Closes when:** the PO has ruled on whether arm 1 should exist at this gate, with the door list
(3 `public` RPCs, derived from `pg_proc` not quoted) in front of them; and either the arm is
removed with a pgTAP cell asserting a `platform_admin` is denied `redact_professional_profile`
(RED before, GREEN after) plus an E2E over the reachable UI path, or the exception is recorded in
an ADR naming why professional identity is a tenancy noun.

**3. 🟡 `FUP-VOCABULARY-AND-REDACTION-SERVER-ACTIONS-HAVE-ZERO-CALLERS`** — *Owner:* frontend + lead.
**Mechanism:** `redactProfessionalProfile`, `createEthicsAllegationCategory`,
`archiveEthicsAllegationCategory`, `createCaseAssignmentRole` and `archiveCaseAssignmentRole` are
exported `'use server'` functions in `src/lib/participants/actions.ts` and
`src/lib/ethics/actions.ts` with **no caller anywhere in `src/`**, yet a Server Action export is
POST-reachable regardless of whether any component calls it. That is LEARN-018 ("a designated
authority with zero callers is a conformance finding") in its Server-Action form: the gates
exercise a door production never opens, so nothing would notice if its authorization drifted.
**Closes when:** each of the five is either wired to a caller in `src/` (a UI affordance, verified
by an E2E that reaches it) or removed from the module's exports; a repeat of the zero-caller sweep
over the module's `'use server'` exports returns an empty set. ⛔ Not closed by "the RPC beneath it
is gated" — the finding is about reachability of the action, not the correctness of the gate.

**4. 🟡 `FUP-SMOKE-SCRIPT-SEEDS-PROFESSIONAL-LINKAGE-WITH-SERVICE-ROLE`** — *Owner:* backend.
**Mechanism:** `scripts/smoke/pdf-mint.smoke.ts` (~lines 406-419) inserts
`professional_profiles.user_id` and `professional_participants` rows through
`createAdminClient()`, bypassing `public.set_professional_link_state` and therefore its
linkage-freeze trigger. The script constructs a linkage state the production door would refuse, so
any invariant that door enforces is unasserted for rows the smoke script created — and a service-role
write site that skips its door is exactly what the service-role DML registry exists to make visible.
**Closes when:** the script creates linkage through `set_professional_link_state` (or through a
DEFINER helper that calls it), verified by the linkage-freeze trigger firing on a deliberate
double-link in the script's own run; or the two write sites are registered in the service-role DML
registry with a written justification for the bypass.

**5. 🟡 `FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN`** — *Owner:* lead.
**Mechanism:** rows 31/32 of `supabase/tests/vectors/authz-enforcement-manifest.json` carry a
`_comment` stating that `401 § 19.2b` *"is RED on exactly this and must not be re-numbered to 2 …
AWAITING A LEAD RULING"*. Measured: **§ 19.2b is GREEN** — its expected value was moved 1 → 2 and
§ 19.2c added to pin *which* pair survives, precisely so the count could not green itself by any
pairing. The ruling the comment awaits was taken. No gate can contradict a `_comment`, and this one
sits on the document that is the manifest's own authority — LEARN-088 / "a register's failure mode
is prose rot". ⚠ Distinct from ADR 0200's collateral, which touched only the
`org.professionals.read` row's *data* fields.
**Closes when:** the `_comment` on rows 31/32 states the ruling that was taken and the current
value of `401 § 19.2b`, and a fresh run of `401` is quoted beside it showing § 19.2b and § 19.2c
green. ⛔ Not closed by deleting the comment — the ruling it half-records is worth keeping.

### 2026-09-09 — deriver false FINDING (1) on the declare+replace cell (backend)

The lead's tip gate hit an **instrument fault**: at `e351f93f`,
`bash scripts/door-sweep-cases.sh main` exited **1** with *"a RUNTIME-REWRITE migration whose
TARGETS CANNOT BE READ"* and `derivation: NOT REACHED` — about `20261003007360`, the only file in
range, which **declares both its targets** on line 5 and replaces both with a full
`create or replace function`. The gate that scopes this unit's sweep derived nothing, and the
banner blamed the migration.

**Mechanism, confirmed by measurement before touching anything.** The name path chunks
`create or replace function app.<name>` and both predicates match `PRED_NAME_RE`, so both land in
`fn_sel_name`; `pg_get_functiondef` appears in the BEFORE/AFTER landing assertions (non-comment
text) so `REWRITE_PRESENT=1`; the cross-file dedup at `:~800`
(`comm -23 fn_rewrite (fn_sel_name ∪ fn_sel_prop)`) then subtracts every declared target and the
aggregate goes empty. FINDING (1) was reading that **post-dedup residue**. `…007190` never entered
the cell because it declares its target and does **not** `create or replace` it.

**A second polarity of the same line, found while building the controls and not predicted by the
report.** The residue is a UNION across files, so one declaring migration made it non-empty and an
**undeclared** catalog-query rewrite beside it passed at rc 0, silently — the class ADR 0173 §4b
admits the deriver cannot read. ⭐ "A mutation's effect can be MASKED by a legitimately-open arm."

**Reproduced on a doctored copy, never the tree.** A throwaway `git init` repo under `$TMPDIR`
holding `cmp`-verified copies of the real deriver and both audit harnesses (the self-test's own
`build_repo`), fixtures dropped in as untracked migrations. ⛔ Nothing was written to
`supabase/migrations/` and no SQL was applied. Live catalog reachable; bare exit codes:

| # | input | before | after | |
|---|---|---|---|---|
| a | declaration + `create or replace` + `pg_get_functiondef` (**the defect**, fixture 14) | rc **1**, list empty, FINDING (1) | rc **0**, `can_manage_professional can_read_professional_profile` | fixed |
| b | rewrite, **no** declaration, no array (fixture 15) | rc **1** FINDING | rc **1** FINDING, file now NAMED | control holds |
| c | rewrite **with** declaration (fixture 11) | rc **0**, `can_manage_professional` | rc **0**, unchanged | unmoved |
| d | `create or replace`, no declaration, no `pg_get_functiondef` (fixture 01) | rc **0**, `assert_not_case_excluded` | rc **0**, unchanged | unmoved |
| e | declaring (14) + undeclared (15) in one range | rc 1 — but for the **wrong reason** (empty residue), naming nothing | rc **1**, `1 of 2 file(s)`, names **15 only** | attributable |
| f | marker-only declarer (11) + undeclared (15) — **the masked polarity** | rc **0**, `can_manage_professional`, no finding | rc **1**, `1 of 2 file(s)`, names 15 | hole closed |
| g | array rewrite, no declaration (ADR 0173 per-file array pin, fixture 10) | rc **0**, two targets | rc **0**, unchanged | unmoved |

**The fix.** Resolvability is decided **per file, inside the extraction loop**, at the only point
where `$D/fn_rewrite` still means "what THIS file could name"; `$TMP/rewrite_files` and
`$TMP/rewrite_unread` carry file paths and the FINDING is `[ -s "$TMP/rewrite_unread" ]`, printing
an `N of M` count and naming each unread file. The dedup is untouched — a target is still never
listed twice. `ANY_REWRITE`/`REWRITE_PRESENT="$ANY_REWRITE"` are gone with the aggregate test.

⚠ **One deliberate deviation from the lead's suggested predicate, stated because it is a
tightening the report did not ask for.** The brief said *declared **OR selected by name/property***.
Name/property selections are **excluded**: a `create or replace` elsewhere in a rewrite migration
is not evidence that anyone read the bodies the rewrite touched, and counting it would flip the
unpinned cell "rewrite + unrelated name selection + no declaration" from FINDING to clean — a
loosening in a cell nobody measured. With the exclusion, the declaration is the only thing that
answers, which is exactly what ADR 0173's convention is for. The defect case is unaffected: the
migration declares.

**Self-test, and the cell is now exercised.** Four scenarios added (16–19) with two new committed
fixtures, `scripts/fixtures/door-sweep/14-declared-and-replaced-by-name.sql` and
`15-undeclared-catalog-query-rewrite.sql` (README's contiguity note updated `01`–`13` → `01`–`15`).
Each carries an assertion that flips on a revert alone: 16 pins the FINDING banner's **absence**,
19 pins that the sibling's case is **not** derived. `SELFTEST=1 bash scripts/door-sweep-cases.sh`,
bare: **PASS 42 · FAIL 0 · SKIPPED 0 → PASS 46 · FAIL 0 · SKIPPED 0** (deriver group 16 → 20), a
delta of exactly the four added. Sibling instrument unchanged, as required:
`SELFTEST=1 bash supabase/tests/mutation/p0-authz-door-audit.sh` → rc 0,
`--- SELFTEST TOTAL: 33/33 ok, 0 failed ---`, output byte-identical to the gate driver's
pre-change `21-selftest-door.log`.

**The real derivation, re-run on this branch after the fix** (rc read bare, each on its own line;
the catalog was reachable — the lead's gate driver had finished):

```
UNION   rc=0   list=[can_manage_professional can_read_professional_profile]
READ    rc=0   list=[can_manage_professional can_read_professional_profile]
WRITE   rc=0   list=[]
SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
```

The `SCOPE:` line is byte-identical across all three modes. ⚠ `ARM=write` returning **rc 0 with an
empty list** is not "the write arm is clean": stderr says `read arm : 2 case(s)   write arm: 0
case(s)` — this migration touches only boolean predicates, which the split rule sends to the read
arm. ⛔ The sweeps themselves were **not** run here; that is the lead's.

**ADR.** ADR 0200 gains `**Amends:** … · ADR 0190` and a `## Amendment to ADR 0190` section (0190
is the deriver's ADR and the source of the dedup rule this changes). The label grammar **does**
support multiple targets — verified against `scripts/build-adr-index.mjs` and against 0190 itself,
whose own `**Amends:**` names 0079 **and** 0173 and produces both back-pointers. `npm run adr:index`
re-run. ⚠ ADR 0200 is still `**Status:** proposed`; the amendment rides with it to the PO.

### 2026-09-09 — gate at the tip (lead, run by someone other than the builder)

Tip `ea92fbee` (four build commits + the deriver fix). Every exit code read **bare** into its own
rc file by a detached driver (`Git\bin\bash.exe` via `Start-Process`, never under a tool timeout);
logs retained in the session scratchpad `gate/`. Migration pair after reset: `20261003007360/525`.

| # | command | rc |
|---|---|---|
| 1 | `supabase db reset --local` (fresh) | **0** |
| 2 | `npm run test:db` | **0** — `All tests successful.` Files=**264**, Tests=**8923**, `Result: PASS` (Batch 7 tip: 262 / 8900; the backend measured 263 / 8906 on this branch with 415 moved out, so +1 file +17 tests = exactly 415's cells) |
| 3 | `npm run lint` | **0** — REACHED all 17: `eslint` · `css-vars` · `memberships-door` · `client-server-imports` · `vacuous` · `set-local` · `progress` · `rules` · `adr-index` · `mojibake` · `service-role-registry` · `authz-vectors` · `registers` · `config-schemas` · `budget-anchor` · `backend-state` · `data-access` |
| 4 | `npm run typecheck` | **0** |
| 5 | `npm run test` | **0** — 151 files, 2056 tests |
| 6 | `ARM=census` | **0** — `=== INVARIANT HOLDS ===` |
| 7 | `ARM=hat` | **0** — `=== INVARIANT HOLDS ===` (prints no `domain:` line; recorded as observed) |
| 8 | `ARM=floor` | **0** — `=== INVARIANT HOLDS ===` |
| 9 | `FROMFINDINGS=1 ARM=wrapper` | **0** — `=== INVARIANT HOLDS ===` |
| 10 | `SELFTEST=1 scripts/door-sweep-cases.sh` (before the deriver fix, at `e351f93f`) | **0** — `SELF-TEST: PASS 42 · FAIL 0 · SKIPPED 0` |
| 11 | `SELFTEST=1 p0-authz-door-audit.sh` | **0** — `SELFTEST TOTAL: 33/33 ok, 0 failed`; committed baseline VERIFIED unchanged (cksum) |
| 12 | `scripts/door-sweep-cases.sh main` at `e351f93f` | **1** — ⛔ FALSE FINDING (1), see below; sweeps NOT run on it |
| 13 | `SELFTEST=1 scripts/door-sweep-cases.sh` (after the fix, at `ea92fbee`) | **0** — `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0` (deriver group 16 → 20 = the four scenarios added) |
| 14 | `scripts/door-sweep-cases.sh main` at `ea92fbee` — union / `ARM=read` / `ARM=write` | **0 / 0 / 0** — `DERIVED (0) — 2 case(s)`; `read arm : 2 case(s)   write arm: 0 case(s)` |
| 15 | door arm, `CASES="can_manage_professional can_read_professional_profile"` | **0** — `SWEPT: 2 gate(s)   COVERED: 2   BLIND: 0   NOTICED: 0   ERROR(harness): 0` · `RESULT: CLEAN`; `git diff --stat -- docs/reviews/authz-door-audit-findings.md` empty |
| 16 | write arm | **NOT RUN** — the deriver hands it 0 cases; `CASES=""` would exit 3 UNPROVEN and measure nothing. The claim it asks to check was checked: the migration's DDL is two `create or replace function … returns boolean` statements and **0** `create policy` / `create trigger` / `assert_*` raise guards (grep of the file) |
| 17 | `authz-setvalued-targeted-cases.sh` (detached) | **0** — `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)` · `RESULT: CLEAN — 3 resolver(s) measured, all COVERED.` |
| 18 | `REBUILD=1 npm run e2e:prod` — run 1 | **no rc** — process tree VANISHED mid batch 7 (see below) |
| 19 | `SPECS=<83 remaining> REBUILD=1 npm run e2e:prod` — run 2 | **1** — `GATE SUMMARY: 934 passed · 6 failed · 0 infra · 1 flaky · 0 did-not-run · 16 batches` · `COVERAGE: accounted for 941 of 950 collected tests`; failures in b1 (1) and b2 (6) only |
| 20 | `SPECS=<the 3 failing files> REBUILD=0 npm run e2e:prod` — isolated | **0** — `27 passed · 0 failed · 0 infra · 1 flaky · 0 did-not-run`, `accounted for 28 of 28` |

**Arm domains, quoted.** `ARM=census` — `domain: prosecdef bool | prosecdef set-returning+reachable | public INVOKER plpgsql | all RLS policies`; `NOT in domain: prosecdef scalar non-bool command doors (427 reachable, DERIVED this run) — FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`. `ARM=floor` — `authenticated-reachable prosecdef doors with 0 calls: 63`. `FROMFINDINGS=1 ARM=wrapper` — `mode: FROMFINDINGS (comparing COMMITTED findings md, no sweep)`. Door arm — `ARM-DOMAIN predicate=2/127 policy=0/226 out-of-domain-bool=35`, `POLICY ARM HALF: using ONLY`.

**`SCOPE:` line, verbatim (identical in all three deriver modes at `ea92fbee`):**
`SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog`
with PROVENANCE `can_manage_professional <- 20261003007360_…` and `can_read_professional_profile <- 20261003007360_…`.
At `e351f93f` the same line ended `derivation: NOT REACHED (this run ended before the catalog was probed)`.

**⛔ Instrument fault found by this gate, fixed in this unit (row 12 → 13/14).** The deriver
exited 1 `FINDING (1) — a RUNTIME-REWRITE migration whose TARGETS CANNOT BE READ` on a migration
whose line 5 declares both targets. Mechanism, read from the script and then reproduced by
`backend` on a doctored copy in a fake repo: the name path selected both functions (their
`create or replace` chunks match the arm's name regex); the aggregate dedup `comm -23` then removed
them from the declared set so a target is never listed twice; and FINDING (1) was decided on that
emptied residue — a "cannot read" verdict evaluated after a subtraction. The first migration to
combine a declaration + `create or replace` + `pg_get_functiondef` (landing assertions) was this
one, so the 42 self-test scenarios were green over an unexercised cell. The reproduction also found
the **masked polarity**: a declaring sibling in the same range silenced an undeclared rewrite at
rc 0. Fix + seven scenarios + four self-test additions: `ea92fbee` (backend's entry above); ADR
0200 gained `Amends: 0190`. Lead's own memory note written the same day.

**⛔ E2E run 1 did not hang — its process tree VANISHED.** Batches 1–6 completed (b1 red on the
INFRA signature only: `server_dead=1, conn_errors=50`, 12 did-not-run, retried once by the gate's
`INFRA_RETRY=1` and red again on the same signature; b2–b6 = 39 specs, 320 passed, 0 failed);
batch 7 wrote its 14th `ok` at 17:05 local and nothing after. Measured 90 min later: no
`gate-driver-2`, `e2e-prod-gate.sh`, standalone `server.js` or Playwright process of THIS repo
existed (`Win32_Process` command lines), no rc file, no `DONE2`. The Playwright processes that
were alive belonged to **`D:\Development\claude\scheduler_platform`** — a second project's E2E
run, with `scripts/probe-host-stall.mjs` / `probe-stall-surfaces.mjs` live on the same machine.
⛔ Not attributed: the kill is unexplained and that run was not touched. ⚠ The lead's first stall
detector watched the gate's SUMMARY log (one line per batch) and fired falsely on run 2 mid-batch;
the second watched the per-batch logs' mtime. Run 2 was therefore over the **83** specs run 1
never finished (`all 122 − green 39`), derived by `comm`, not by hand.

**E2E verdict, per the flaky-baseline rule (memory `e2e-prod-build-flaky-baseline`: an increment
is green when its own specs pass AND baseline triage shows 0 new access/data regressions).** Run
2's seven failures: `act-role-assumption.spec.ts:164` (b1; `locator.click` 30 s waiting for a menu
item, retry `page.waitForURL` 20 s leaving `/selecionar-perfil` inside `helpers/auth.ts:94`),
`ff1-repeating-groups` FF1-1…FF1-5 and `ff5-references` FF5-5 (b2; `expect(locator).toBeHidden()`
and `page.waitForURL` timeouts). Both batches' server logs carry the collapse signature (`The
destination stream closed early` × **53** in b1, × **49** in b2). Run 1 had passed FF1-1…FF1-9
before it died. **None** of the seven shows a 403 / notFound / empty-data / denied-path signature,
and none of the three files touches a professional-identity predicate. All three files re-run
ALONE on a fresh server + fresh DB at the same build: **27 / 27, 0 failed** (row 20). ⇒ Every
collected test passed at least once at `ea92fbee`; 0 regressions attributed to the increment.
⚠ `COVERAGE: accounted for 941 of 950 collected` in run 2 is quoted, not explained — the gate's
own accounting, with every batch line reading `accounted N/N`.

**What this gate did NOT do:** `gen:types` (not owed — no signature change; `grep` of
`src/lib/types/database.ts` for the five predicate names = 0 hits, re-verified); `ARM=policy`
(RED pre-existing and unreadable until its FUP — Batch 2's standing note).

### 2026-09-09 — QA MINOR closed: the AFTER landing assertions proven able to fire (backend)

QA's review (`docs/reviews/can-manage-professional-self-check-review.md`) approved the unit with
one MINOR: the migration's AFTER-block landing assertions (subject-keyed arms ABSENT, caller-keyed
arm SURVIVED, `can_read_professional_profile` LOST a preserved arm) were asserted correct by
reading, never demonstrated able to fire on a doctored body — only the BEFORE block's double-apply
guard had been proven live (build entry above). Closed by measurement, per LEARN-084's own standard
("prove the instrument can return the failing value at all").

**Method.** Local stack at pair `(20261003007360, 525)`, re-confirmed before anything else
(`select version from supabase_migrations.schema_migrations order by version desc limit 1` →
`20261003007360`; row count `525`). Baseline `md5(pg_get_functiondef(...))`:
`can_manage_professional` = `c8666e0e920074d706f3d39786b1d010`,
`can_read_professional_profile` = `fb53f3e92fe42f9ae576feb0a8b283b1`. The migration's AFTER block
(lines 200–234) was extracted **verbatim** with `sed -n '200,234p'` — never retyped — into a
scratch file and reused unmodified in all five runs. Each run is
`docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres` fed a script of the
shape `begin; <plant create-or-replace>; <AFTER block, verbatim>; rollback; select md5(...), md5(...);`
— nothing committed, no migration file touched. `\set ON_ERROR_STOP off` lets `rollback;` run even
after the `do $mig$` block raises (psql aborts the transaction on ERROR; `ROLLBACK` is always legal
in an aborted transaction and un-aborts the session for the trailing `select`).

⚠ **Needle check on plant (b), per the spawn's own warning.** `app.is_admin_for(` is a superstring
of `app.is_admin(` only in the sense that `app.is_admin(` is a PREFIX-with-paren of the wrong
identifier boundary — a body containing only `app.is_admin_for(p_uid)` does **not** contain the
substring `app.is_admin(` (the character after `is_admin` there is `_`, not `(`). Grepped plant (b)
directly: `app.is_admin_for(p_uid)` at one line, a separate `or app.is_admin()` at another — two
distinct occurrences, so the plant is not vacuous for check 2.

| plant | body | expected exception | observed | md5 unchanged after rollback |
| --- | --- | --- | --- | --- |
| (a) | `can_manage_professional` — OLD caller-keyed body (`coalesce(app.is_admin(), false) or app.is_org_admin_of(p_org)`) | "subject-keyed arms are ABSENT" | `ERROR: BATCH8: the subject-keyed arms are ABSENT from app.can_manage_professional after replace — the change did not land.` | yes — both md5s `c8666e0e…` / `fb53f3e9…`, identical to baseline |
| (b) | `can_manage_professional` — `is_admin_for(p_uid)` + `is_org_admin_of_for(p_org, p_uid)` PLUS a surviving `or app.is_admin()` | "a caller-keyed arm SURVIVED" | `ERROR: BATCH8: a caller-keyed arm SURVIVED the replace in app.can_manage_professional.` | yes — both md5s unchanged |
| (c) | `can_read_professional_profile` — `is_admin_for(p_uid)` kept, arm 3 (the DEFINER `professional_participants`/`case_participants` traversal) replaced with `return false;` | "LOST one of its three preserved arms" | `ERROR: BATCH8: app.can_read_professional_profile LOST one of its three preserved arms — this migration re-keys arm 1 only.` | yes — both md5s unchanged |
| (d) | `can_read_professional_profile` — OLD `coalesce(app.is_admin(), false)` first arm, arms 2–4 verbatim from the preserved body | ABSENT/SURVIVED exception | `ERROR: BATCH8: the subject-keyed admin arm is ABSENT from app.can_read_professional_profile after replace — the change did not land.` | yes — both md5s unchanged |
| (e) NEGATIVE CONTROL | real post-migration bodies, unplanted | AFTER block completes, no exception | `DO` (no `ERROR:` line) | yes — both md5s unchanged |

A final catalog re-check after all five rolled-back transactions: `md5(pg_get_functiondef(...))`
for both functions still `c8666e0e920074d706f3d39786b1d010` / `fb53f3e92fe42f9ae576feb0a8b283b1`,
and `schema_migrations` head still `20261003007360` — the live catalog carries zero trace of any
plant.

**SQL used** (plant bodies; the AFTER block itself is lines 200–234 of
`supabase/migrations/20261003007360_can_manage_professional_subject_keying.sql`, reused verbatim,
not reproduced here):

```sql
-- plant (a)
create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select p_uid is not null and (coalesce(app.is_admin(), false) or app.is_org_admin_of(p_org));
$function$;

-- plant (b)
create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select p_uid is not null and (
    app.is_admin_for(p_uid)
    or app.is_org_admin_of_for(p_org, p_uid)
    or app.is_admin()
  );
$function$;

-- plant (c)
create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin_for(p_uid), false) then
    return true;
  end if;

  select organization_id into v_org
  from public.professional_profiles
  where id = p_profile_id;

  if v_org is not null and (
       app.can_manage_professional(v_org, p_uid)
       or authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')
     ) then
    return true;
  end if;

  -- arm 3 (DEFINER traversal over professional_participants/case_participants) deliberately
  -- dropped for plant (c) -- this is the mutation under test.
  return false;
end;
$function$;

-- plant (d)
create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  select organization_id into v_org
  from public.professional_profiles
  where id = p_profile_id;

  if v_org is not null and (
       app.can_manage_professional(v_org, p_uid)
       or authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')
     ) then
    return true;
  end if;

  return exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id
     and cp.removed_at is null
    where pp.professional_profile_id = p_profile_id
      and app.can_read_case_committee(cp.case_id, p_uid)
  );
end;
$function$;

-- plant (e): none -- the real, live post-migration bodies, unmodified.
```

Each was wrapped `\set ON_ERROR_STOP off; begin; <plant>; <AFTER block verbatim>; rollback;
select md5(...), md5(...);` and piped to
`docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres`. No migration file
was edited; no transaction was committed.

**Verdict on the MINOR.** All four failure branches the AFTER block guards (subject-keyed arms
ABSENT at site 1, caller-keyed arm SURVIVED at site 1, subject-keyed arm ABSENT at site 2, a
preserved arm LOST at site 2) fire on a doctored body with the documented `ERROR:` text, and the
negative control shows the same block passes clean on the real bodies — so the AFTER block is not
vacuous in either direction. `rollback` left the live catalog byte-identical throughout
(`md5(pg_get_functiondef(...))` unchanged across all five transactions and after). QA's MINOR is
closed by this measurement; no code or migration change was needed or made.

### 2026-09-09 — QA verdict, the MINOR closed, and QA's "could not verify" list dispositioned (lead)

**QA review (`docs/reviews/can-manage-professional-self-check-review.md`, over tip `e696d107`):
`Verdict: APPROVED`** — 0 BLOCK, 0 MAJOR, 1 MINOR. QA verified from the live catalog (not the
migration text): both re-keyed bodies; `is_admin()`'s JWT fast path vs `is_admin_for()`'s
`profiles` read (R3 is real and SELF-scoped); `has_permission` for `chefe.ccih` and
`staff1.qual.b` reproducing 415's §0.6/0.7 (why the read-gate over-grant subject is the cross-org
`xb`, not `sa`); 0 triggers; `app` absent from `[api].schemas`; the regenerated manifest
projection's sha256 equal to the committed `manifestSha256` (regeneration, not a hand edit).
Scope discipline held: nothing under `src/`, `seed.sql`, `CLAUDE.md`, `docs/backend-state/`.

**The MINOR, closed by measurement (backend, `0493e249`, entry above):** the migration's AFTER
landing assertions had been *present* but never *demonstrated* to fire. Five plants inside
`begin … rollback` on the live stack: (a) old caller-keyed body → `ABSENT` exception; (b)
subject-keyed + a surviving `app.is_admin(` → `SURVIVED`; (c) read gate missing a preserved arm →
`LOST`; (d) read gate with the old `is_admin()` arm → `ABSENT`; (e) the real bodies → `DO`, no
error. `md5(pg_get_functiondef)` of both functions identical before each transaction and after
each rollback. Plant (b) verified to contain `app.is_admin(` as a distinct substring from
`app.is_admin_for(`, so the needle was discriminating, not vacuous.

**QA's "could not verify" list — a work item, dispositioned:**
1. AFTER assertions firing — **closed above**.
2. The rewritten `Closes when` clause exists nowhere in the branch yet (correct under L8) — reviewed
   for well-formedness at the Record step, below, when it is written.
3. `COVERAGE: accounted for 941 of 950 collected` in E2E run 2 — **resolved by derivation**, not
   explanation: the sixteen per-batch `accounted N/N` lines sum to **950/950**
   (`grep -oE 'accounted [0-9]+/[0-9]+' | awk` over the gate log), and per batch
   `passed+failed+flaky+skipped+did-not-run = accounted` holds for all sixteen. The gate's
   COVERAGE line counts `passed+failed+flaky` = 934+6+1 = **941**; the other **9** are the tests
   the specs themselves mark `skipped` (5+1+2+1 across batches 3, 6, 14, 16). No test was lost;
   the 9 are skipped by their own authors, and the gate's summary line simply excludes that class.
   ⚠ That is a reading of the gate's arithmetic, not a change to it — filed nowhere, because the
   per-batch lines already carry the truth.
4. The sweeps, arms, deriver self-test and `e2e:prod` — QA did not re-run them (by instruction;
   the lead ran every one, exit codes bare, table in the gate entry).

**Fix-loop count for the unit: 0 iterations on app code**; one measurement entry (the MINOR)
and one instrument fix (the deriver, found by the gate before QA). Next: PO approval.

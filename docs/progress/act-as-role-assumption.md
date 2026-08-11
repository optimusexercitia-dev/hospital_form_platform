# ACT — "act as" strict role assumption (ADR 0106)

**Rotated out of PROGRESS.md at the Phase Gate step-5 Record, 2026-08-10**, after S3 passed
the gate (e2e:prod green · pgTAP 179/5690 · ARM=census + ARM=floor HOLD · diff-scoped door
sweep clean), QA APPROVED (r2), and the human approved. Archive files under `docs/progress/`
are append-only and are NOT loaded by teammate spawns — detail lives here to stay out of
every spawn's context.

⚠ **This file is a historical record, not an authority.** For anything schema / RLS / RPC /
authorization, the LIVE CATALOG is the sole truth (`pg_proc` incl. `prosecdef`, `pg_policies`,
`pg_trigger`, the ACLs). Where this text disagrees with the catalog, the catalog wins.

**Still-OPEN items did NOT rotate** — they remain live in PROGRESS.md: `BUG-ACT-EXPIRY-1`
(scope narrowed to the cross-org shape), `BUG-ACT-ACL-1`, `BUG-VACUOUS-ASSERT-1`, plus the
follow-ups `FUP-ACT-DISPOSE-UI` (a **pilot-gate check** — "Remaining pre-pilot work" item 0),
`FUP-ACT-CAPA-ASSIGN` and `FUP-GATE-RESET-FLAKE`.

**Durable pointers:** ADR [0106](../decisions/0106-act-as-role-assumption.md) ·
plan [act-as-role-assumption.md](../plans/act-as-role-assumption.md) ·
build narrative [act-as-buildnotes.md](../plans/act-as-buildnotes.md) ·
QA report (r1 + r2) [act-as-stage-3-review.md](../reviews/act-as-stage-3-review.md) ·
the method lesson [authz-handoff.md §7.17](authz-handoff.md) + ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 6 ·
backend surface `docs/backend-state.md` (ACT section).

---

## Stage record (as it stood in PROGRESS.md at the Record step)

### 🟡 ACT — "act as" strict role assumption (ADR [0106](../decisions/0106-act-as-role-assumption.md)) · **S3 QA round 1: CHANGES REQUESTED → blocker FIXED; re-review pending**

> ## ⏸ PICK-UP HERE — S3 QA ROUND 1 CLOSED OUT, RE-REVIEW IS THE NEXT ACTION
>
> **QA review r1 (`docs/reviews/act-as-stage-3-review.md`, 2026-08-10): CHANGES REQUESTED
> — 1 BLOCKER + 2 MAJOR.** All three are now addressed (below), so the next action is a
> **QA re-review (round 2)**, then human approval (step 4). ⚠ Per §6 a CHANGES-REQUESTED
> verdict loops to step 1, which is why the gate evidence below was **re-earned after the
> fix**, not carried over.
>
> - **BLOCKER-1 + MAJOR-1 → FIXED** (`20260918002800` + keystone `318`): a **fourth class
>   of hat-blindness** — a boolean gate that RECEIVES the caller's uid as a parameter
>   rather than reading `auth.uid()`. `app.is_admin_for` was the hat-blind **caller gate
>   on the membership-grant door** (a platform_admin in any other hat could seat an
>   org_admin/hospital_admin); `can_manage_professional`'s raw expired-staff_admin arm was
>   equally hat-blind over 10 Class-2 write RPCs. Full record: Bug Log
>   **BUG-ACT-S3-CALLERGATE-1**. The S3 sweep missed them by classifying `*_for(uuid)`
>   helpers from their **signature shape** instead of their **call-site binding** — the
>   buildnotes paragraph asserting the opposite is corrected in place, struck through, with
>   the reasoning preserved.
> - **MAJOR-2 → ESCALATED, not fixed**: the LGPD Art. 18 erasure path — see
>   **FUP-ACT-DISPOSE-UI** below, re-scoped from "UX ratification" to **close before pilot**.
>   It needs a PO decision on *where* the affordance mounts; that is a product call, so it
>   is deliberately NOT bundled into S3. **QA r2 agreed with this disposition and would not
>   block S3 on it**, asking only that it become a **pilot-gate CHECK rather than a
>   follow-up-list entry** — done: *Remaining pre-pilot work* **item 0**, phrased so it can
>   be run and can fail ("name a persona who can both reach the surface and pass the door").
>
> ## ✅ QA ROUND 2 — **APPROVED** (2026-08-10, `docs/reviews/act-as-stage-3-review.md` §7)
>
> The reviewer re-derived the blocker's population **by property** rather than accepting my
> instance-bounded fix, building a balanced-paren argument extractor over all 928
> `app`+`public` functions and propagating caller-boundness transitively through the call
> graph: **61 caller-bound `(callee, param)` pairs — 51 reach a hat gate, 10 are correctly
> hat-free, no third member exists.** The class is closed, not just the two instances.
> ⚠ Its own first r2 attempt reproduced the r1 bug (a one-level-nesting regex cannot see
> `grant_role_impl((select auth.uid()), …)` — the house style), which is why the method,
> not just the verdict, is now written into `authz-handoff.md` §7.17 + ADR 0079 Amendment 6.
>
> **Round-2 findings, all actioned in `1d5a56f`:**
> - **MINOR-4(1)** — my "expiry semantics UNCHANGED" was too strong: an **expired-ONLY**
>   principal can never obtain the hat, so for them the arm is now permanently unreachable
>   (BUG-ACT-EXPIRY-1's tightening arriving early for its main population, via the hat).
>   Corrected in both records; **BUG-ACT-EXPIRY-1 carries a scope-narrowing note** — it
>   survives only in the cross-org shape.
> - **MINOR-4(2)** — keystone 318 assertion 10 pinned an **unreachable** state. Re-cut onto
>   the **reachable** cross-org fixture (live `staff_admin` in org A + expired in org B ⇒
>   hat derived implicitly by the hook, no synthetic claim).
> - **INFO-4** — assertion 4's message claimed the siblings "AGREE" while the expression
>   measured only one of them (green under neutralization while they genuinely diverged —
>   the exact shape I had asked the reviewer to watch for). Now compares both directly, so
>   the keystone's red-first set goes **4 → 5** distinguishing assertions.
> - **INFO-5** — **I cited the wrong break-glass evidence.** `platform-org-admin-provisioning
>   .spec.ts` 3/3 proves nothing here: it drives `grant_role_for` (the SERVICE door) on the
>   service client, taking the third-party arm the fix cannot touch — green before, after,
>   and after a *broken* fix. Real coverage is **318 #8**. Corrected in the Bug Log.
> - **AC-7 polarity thread** — closed in the hour QA scoped it: the sibling test asserts the
>   subject **is** visible pre-disposal and the dispose test asserts it **absent** after, and
>   a deliberate mutation (dispose a DIFFERENT referral) reds it. The assertion tracks the
>   disposal. The broader population stays with `BUG-VACUOUS-ASSERT-1`.
>
> **Re-verification after those edits:** keystone 318 **11/11 green** on the fixed catalog;
> neutralized to the pre-fix bodies → **exactly `not ok` 3, 4, 6, 7, 11** with all 6 controls
> green; restore **md5-identical** on both function bodies. pgTAP **179 files / 5690 tests
> PASS** · lint 0/0 · tsc. No app code or migration changed after the green gate, so the
> `f4362fc` gate evidence stands (the edits are keystone + docs only).
>
> **State:** S0/S1/S2 ✅ · **S3 built, gate green, QA APPROVED (r2)** · S4 ⬜ not started.
> **Human approval (Phase Gate step 4) is the ONLY remaining step**, then the §6 step-5
> Record (incl. `docs/backend-state.md`, which does NOT yet carry the S3 surface).
> ⛔ Local-only throughout; nothing pushed, no `db push`. Remote cutover additionally
> needs the auth hook ENABLED on Supabase Cloud (a step `db push` does not cover).
> — ⚠ **This paragraph is a snapshot of the S3 close, SUPERSEDED 2026-08-10**: S4 is complete and
> human-approved; `main` was merged **and pushed**; the remote **`db push` is done** and the Cloud
> auth hook is **enabled**. **Nothing in this local-only note still holds.** Current status →
> *"Merge, push & the two deploy debts"* at the end of this file.
>
> **Gate evidence, RE-EARNED after the QA fix (2026-08-10, HEAD `f4362fc`):** full
`RESET=1 REBUILD=1 e2e:prod` **1001 passed · 0 failed · 2 flaky (known baseline, green on
retry) · 56 never-ran** — batch 12's mid-gate `db reset` failed transiently; those 7 specs
re-run as a scoped prod gate (fresh reset) **56/56 GREEN**. Accounting: 1001 + 2 + 56 + 5
pre-existing skips = **1064 collected, zero assertion failures**. pgTAP **179 files / 5690
tests PASS** · ARM=census 450/461 HOLD · ARM=floor 80 HOLD · diff-scoped door sweep over the
2 changed gates 2 COVERED / 0 BLIND · `gen:types` byte-unchanged · lint 0/0 · tsc · Vitest 1194.

🟡 **FUP-GATE-RESET-FLAKE (new, 2026-08-10, infra — not an ACT defect).** **Two consecutive
full gates lost a whole batch to a transient mid-gate `supabase db reset` failure** (run 2:
batch 8 / 61 tests; run 3: batch 12 / 56 tests), each re-running fully green when scoped. The
gate suppresses the reset's stderr (`scripts/e2e-prod-gate.sh:346`,
`supabase db reset --local >/dev/null 2>&1`), so the CAUSE is unrecoverable from the logs —
worth capturing before diagnosing. ⚠ Note the reporting hazard, which this project has been
burned by before: the summary line reads *"COVERAGE: accounted for 1059 of 1064"* — which
scans as 99% while an entire batch never ran. The gate does print a loud `!! NEVER RAN`
banner (it works — that is how both were caught); the risk is a reader quoting the coverage
line alone. Also seen: `supabase_edge_runtime` sitting `Exited (255)` for hours, and
`gotenberg-pdf` having **no restart policy** (it caused 8 environmental reds in run 1).

**Superseded gate evidence (pre-QA-fix, HEAD `81a72d1`) — kept for the audit trail:**
> - Full `RESET=1 REBUILD=1 e2e:prod`: **996 passed · 0 failed · 2 flaky (known
>   baseline, green on retry) · 61 never-ran** — batch 8's mid-gate `db reset` failed
>   transiently (its stale `batch-8.log` still shows run-1 content; the reset passed
>   immediately on manual retry). Per the gate's own instruction the 61 were re-run as a
>   scoped prod-standalone gate (`SPECS=` the 4 batch-8 files, fresh reset): **61/61
>   GREEN**. Net accounting: 1057 passed + 2 flaky-then-green + 5 pre-existing skips
>   = 1064 collected; **zero assertion failures anywhere**.
> - pgTAP on a fresh reset: **Files=178, Tests=5679, PASS** (the post-`20260918002700`
>   baseline). `ARM=census`: 450 live gates / 461 verdicts, no unswept newcomer.
>   `ARM=floor`: 80 never-called doors, all allowlisted. (No RLS policy or boolean
>   `prosecdef` gate changed after the S3 backend's own diff-scoped sweep — the audit
>   session's fixes were spec-side plus one frontend serialization fix.)
> - lint 0/0 · `tsc --noEmit` · Vitest **1194**.
>
> **What the first full gate (RED: 9) actually found — two causes, both closed:**
> 1. **A REAL S3 security regression** caught by `phase2-auth-shell`'s "404 body names no
>    commission" assertion: the D9 hint mount serialized the caller's full grant objects
>    (commission ids/names/slugs) into the RSC payload of EVERY signed-in 404 —
>    `RoleSwitchHint` is a client component, so props ship even when it renders nothing.
>    Fixed in `81a72d1`: `getRoleSwitchOptions` pre-computes each option's landing route
>    server-side; only `{role, count, landing}` strings cross the client boundary; all 7
>    `not-found.tsx` mounts updated. Hint behavior unchanged (act-role-assumption 9/9).
> 2. **Eight environmental reds** (both PDF specs): the `gotenberg-pdf` sidecar
>    (`PDF_RENDERER_URL`) had exited when Docker restarted — it carries **no restart
>    policy**, so any Docker restart silently kills PDF minting. Restarted (health 200),
>    14/14 green. ⚠ Candidate hardening: `docker update --restart unless-stopped
>    gotenberg-pdf` (not done — infra change, PO's call).
>
> The six pre-pause findings + `notifications` N-1/N-3 were all resolved in `169668d`
> (detail: Bug Log). The 74 pre-pause never-ran tests are fully accounted: they ran in
> the two runs above (the only unrun set, run-2's 61, was re-run green).
>
> ⚠ Still-open program items (NOT S3 blockers): **FUP-ACT-DISPOSE-UI** +
> **FUP-ACT-CAPA-ASSIGN** (PO ratification — same family as the two ADR 0106 accepted
> losses) · `BUG-VACUOUS-ASSERT-1` (pre-existing, repo-wide audit is its own pass) ·
> `BUG-ACT-EXPIRY-1` (latent; S4 or standalone) · `BUG-ACT-ACL-1` (folded into
> AUDIT-INVOKER-WRAPPER) · the `navScope="member-and-configuration"` dead branch +
> the endorsed standing-sweep candidate (both carried into S4's list).

Branch `feat/act-as-role-assumption` (worktree, based on `main` @ `7b7a99c`). Plan
[act-as-role-assumption.md](../plans/act-as-role-assumption.md) — **QA APPROVED r2**
([review](../reviews/act-as-plan-review.md)); PO-locked P1–P6: **before pilot**, hat bound to the
auth session, **NO feature flag** (the migration IS the cutover — do not re-propose one), D9 v1 =
choke-point guards + indicator. Build notes + sweep inventories accumulate in
[act-as-buildnotes.md](../plans/act-as-buildnotes.md). ⛔ Local-only: no `git push`, no `db push`.
*(Build-time state. **Superseded 2026-08-10** — merged, pushed, `db push` done and the Cloud auth
hook enabled; the remote is cut over. See the close-out section at the end of this file.)*

| Stage | Owner | Status | Record |
| --- | --- | --- | --- |
| **S0** — the role enum | backend | ✅ 2026-08-09 · `8acebed` (+ placement fix) | `20260918000000`; **11 labels = the 10 `memberships_role_check` values + `platform_admin`** (D11 break-glass hat / audit stamp). pgTAP 5636 PASS · ARM=census + ARM=floor HOLD |
| **S1** — harness first | backend + tester | ✅ 2026-08-10 · `f87bfe6`·`d7e4ae5`·`d2bbc7a` · **gate CLOSED: e2e:prod 1049 pass + 1 known flaky + 5 pre-existing skips = 1055/1055, 0 failures** (batches 1–17 all present, no `reset FAILED`, 2 infra reruns accounted). ⚠ The gate's own "COVERAGE 1050 of 1055" line excludes skips from its numerator — it is NOT 5 unrun tests; reconcile per-batch before ever reading it as a gap | `claims_for` gains `p_active_role` (null ⇒ no claim, suites stay vacuously green) · `request.jwt.claims` sweep bounded by the **property** not by filename: 166 sites = 140 resets + 1 canonical + **21 routed** + 4 structurally unreachable (`test_helpers` is minted by `00_setup.sql`, so `seed.sql`/demo can never reach it) · additive `dualhat.a@` persona · `loginFresh`/`cachedSignIn` `actAs` seam · seed-sensitivity sweep (7 candidate specs, 125 pass + 1 known skip, 0 regressions). ⚠ **S1 is not signed off until the full suite is green** — the scoped 126 is not the plan's "full suites green" |
| **S2** — behaviour-preserving normalisation | backend | ✅ 2026-08-10 · `c7b3fb6`+`7972441` · **gate CLOSED: e2e:prod 1050 pass + 5 skips = 1055/1055, 0 failures, 0 flaky** (batch 4's 15 reds correctly classified INFRA — `server_dead=1, conn_errors=29` — and green on rerun) | 8 direct `memberships` readers re-based onto `has_role`/`has_role_any`, `CREATE OR REPLACE` only. The "8" was **re-derived from the catalog** (149 boolean gates, comment-stripped `prosrc`) and *happened* to reconcile with the census — a stronger claim than using it. Proof is a **61-case equivalence matrix** (TRUE/FALSE/cross-tenant/null-scope + a synthetic expired-membership fixture), captured before and after: **0/61 deltas, byte-identical**. Lead re-verified post-migration from the catalog: the `DIRECT-ONLY` bucket now holds exactly `has_role`+`has_role_any` themselves. pgTAP 5636 PASS **twice, second run without a reset** · ARM=census + ARM=floor HOLD · diff-scoped sweep 7 COVERED / 0 BLIND / 1 ERROR closed by a hand-run dual-direction mutation proof. Found + fixed BUG-ACT-CLAIMSFOR-1; opened BUG-ACT-EXPIRY-1 + BUG-ACT-ACL-1 (Bug Log) |
| **S3** — THE ATOM (the only red window) | backend + frontend + tester + lead audit | ✅ **GATE GREEN 2026-08-10** · `81a72d1` · full `e2e:prod` 996p+0f+2 baseline-flaky, + the transiently-unrun batch 8 re-run **61/61** (zero assertion failures across all 1064 collected; 5 pre-existing skips) · pgTAP fresh-reset **178/5679 PASS** · ARM=census 450/461 HOLD · ARM=floor 80 HOLD · lint 0/0 · tsc · Vitest 1194 — see the close-out box above for the two first-gate causes (the D9-hint RSC grant serialization, fixed — ~~"leak"~~ **corrected 2026-08-10 per S3 QA MINOR-2 + S4 QA MINOR-1: the word overstates it.** The serialized grants are the **caller's own**, and the same exposure is untouched at far greater scale in four other client components; the fix was right, the label was not; the gotenberg sidecar down, environmental). **QA review + human approval PENDING.** | DB layer landed: `active_role_selections` + `assume_role` (in `public`, not `app` — PostgREST) + hook claim (D11/D5) + `has_role`/`has_role_any` caller-only condition (fixed a live NULL-propagation fail-open the plan's literal text carried — `IS NOT DISTINCT FROM`, not `=`) + `member_can` D13 + `audit_write` D8 + raw-policy sweep (`profiles_select_self_or_admin` co-member arm, 5 sibling arms reasoned-exempt) + the post-auth destination sweep (**`resolveLanding` DELETED**, not patched — was a second hand-rolled partition covering only 4/11 roles; `getSessionContext` gains `activeRole`/`needsRoleSelection` for `page.tsx`'s one-line dependency) + the revert-twin keystone (`315`, also closes the `assume_role` ARM=floor gap). pgTAP: **Files=176, Tests=5644, PASS ×2** (fresh + no-reset) — reached only after triaging ~60 genuine reds down from 657 (auto-derivation in `claims_for` + a `SECURITY DEFINER` fix + per-file hat triage; full account in buildnotes). `ARM=census` (451/461, unchanged — `active_role()` returns `text`, not in the boolean-gate population) + `ARM=floor` (80, HOLD) + diff-scoped sweep over the 8 changed functions + the 1 policy — verdicts in buildnotes. **Picker route = `/selecionar-perfil` (PO, 2026-08-10).** **Frontend `feat(act): stage 3 UI` (commit below):** picker page + form, `UserMenu` hat indicator + "Trocar papel" (threaded to all 9 render sites), D9 hint (`RoleSwitchHint`), `page.tsx`'s one-line gate, new `direcao-tecnica` shell. ⚠ **Live-verified finding that overrides the design note's §5.4 mounting plan**: a choke-point guard's own `notFound()` (thrown inside its `layout.tsx`) is caught by the GLOBAL `src/app/not-found.tsx`, never a same-segment sibling `not-found.tsx` — confirmed on a real production standalone build, not just dev. The 6 area-specific `not-found.tsx` files (2 pre-existing + 4 new) only catch a narrower within-shell page-level `notFound()`; the D9 hint's PRIMARY mount is now the global boundary (session-gated, no cost for an anonymous 404). Full derivation + the live persona walkthroughs (`dualhat.a@`/`chefe.ccih@`/`multi@`): `docs/plans/act-as-buildnotes.md` Stage 3 — frontend half. Tester half: seams flipped + picker/switch/D9 specs (9/9) + the threading/close-out rows below; the full-gate close is the lead-audit evidence in the status cell + box above. |
| **S4** — D14 arm audit + record | backend + qa | ⬜ not started | `_case_caps` arm-by-arm from the catalog; the two DESIGNED hat-blind doors allowlisted. ⚠ Also carry in: the **endorsed standing-sweep candidate** — "raw `memberships … principal_id = auth.uid()` with no adjacent hat condition" belongs in the ADR 0079 door audit, because `capa_kpis` was found with a safe arm and a raw arm side by side, i.e. this population accreted from different authors over time and a one-off sweep will not hold |

**⏸ S3 — what was found AFTER the stage was declared "built" (the reason it is still open).**
Three independent classes of hat-blindness, none in the plan, because **S2 normalised only the
BOOLEAN gates** and everything else stayed hat-blind by omission:
1. **Application guards** — `BUG-ACT-GUARD-HATBLIND-1`, **P0**, tester-found, live-reproduced
   twice (`dualhat.a@` hatted `quality_reviewer` got the full org-admin console at `/manage`;
   hatted `org_admin` got the full quality console). `partitionGrants()` derived every role list
   from the *designed* hat-blind `session_context` with **zero `activeRole` reference**; 88 call
   sites across 29 files read them as access decisions. Fixed **centrally** in
   `getSessionContext()` (`535e4e2`) — a 29-file patch sweep would have missed one.
   `getRawGrants()` remains the single **named** hat-blind accessor, its consumer set proven to
   be exactly {picker, D9 hint}. The same fix closed an **unreported** variant: `page.tsx`'s
   landing chain read the same fields, so picking `quality_reviewer` bounced you to `/manage` —
   the picker was fighting itself.
2. **`context.isAdmin`** — read the raw JWT claim, bypassing D11 entirely; ~23 consumers of the
   `if (context.isAdmin) return true` shape, **two of which run on the service-role client, where
   there is no RLS backstop at all.**
3. **31 non-boolean DEFINER doors** (`7320b87`) — classified by the §2 caller-vs-third-party
   property: **6 caller-gating** (5 real defects + 1 defensive), **24 correctly LEFT hat-blind**
   (roster enumerations — one user's hat must never change what the system concludes about
   *another*), 1 already-ruled (`session_context`). No mixed-shape function. Each of the 5 carries
   a **red-first** keystone (`316`) confirmed RED against the unfixed catalog.
Residuals closed from the catalog by the lead: **no** view/matview reads `memberships`, and only
3 functions read `request.jwt.claims` (`active_role`, `is_admin`, `assume_role`) — all hat-aware.

**S3 — the hat-blindness sweep (THREE separate classes, none in the plan):**
The atom surfaced hat-blindness in three independent layers. Stage 2 normalised only the
**boolean** gates, so everything else stayed hat-blind by omission:
1. **Application guards** (`BUG-ACT-GUARD-HATBLIND-1`, P0, tester-found, live-reproduced twice) —
   `partitionGrants()` derived every role list from the *designed* hat-blind `session_context`,
   with zero `activeRole` reference; 88 call sites across 29 files read them as access decisions.
   Fixed **centrally** in `getSessionContext()` (`535e4e2`), not guard-by-guard — a 29-file patch
   sweep would have missed one. `getRawGrants()` remains the single **named** hat-blind accessor;
   its consumer set is proven to be exactly {picker, D9 hint}.
   ⚠ Same fix closed an **unreported** variant: `page.tsx`'s landing chain read the same fields, so
   picking `quality_reviewer` bounced you to `/manage` — the picker was fighting itself.
2. **The TS admin entitlement** — `context.isAdmin` read the raw JWT claim, bypassing D11 entirely.
   ~23 consumers of the `if (context.isAdmin) return true` shape, **two of which run on the
   service-role client — no RLS backstop at all.** Now mirrors `app.is_admin()`'s own condition.
3. **Non-boolean DEFINER doors** (`7320b87`) — the population Stage 2 scoped out. Lead sweep found
   **31**; classified by the §2 caller-vs-third-party property: **6 caller-gating** (5 real defects
   + 1 defensive), **24 third-party, correctly left hat-blind** (roster enumerations — one user's
   hat must never change what the system concludes about *another*), 1 already-ruled
   (`session_context`). **No mixed-shape function.** Each of the 5 carries a **red-first** keystone
   (`316_act_p0_caller_gate_sweep.sql`) confirmed RED against the unfixed catalog.
   Fixed: `commission_overview` · `list_org_people` (hospital_admin arm) · `quality_board_summary`
   (42501 entry gate) · `capa_kpis` (nsp_coordinator arm) · `pqs_inbox`.
**Residuals backend flagged, closed by the lead from the catalog:** no view or matview in
`app`/`public` reads `memberships` (0), and only 3 functions read `request.jwt.claims` directly
(`active_role`, `is_admin`, `assume_role`) — all hat-aware by construction. The sweep criterion
(direct `memberships` reference) was therefore sufficient, not merely convenient.
⚠ **Standing-sweep candidate** (backend's suggestion, endorsed, NOT actioned): `capa_kpis` had a
safe arm and a raw arm side by side, so this population accreted from different authors over time.
"Raw `memberships … principal_id = auth.uid()` with no adjacent hat condition" belongs in the
ADR 0079 standing sweep, not as a one-off — same lesson that ADR's own history teaches.

**Lead correction:** I cited `open_capa_plan` to backend as an evidenced caller-gating defect,
reading the tester's AC-5b note as an over-permission. **It is the opposite** — the test expected
authorization to SUCCEED and it failed, i.e. a hatless token being correctly *denied* (D5 working).
Backend caught the misreading instead of building on it, could construct no red-then-green proof,
and said so rather than claiming a vacuous keystone. It hardened the function anyway as
defence-in-depth — recorded as a **non-regression change, not a security fix**.

**S3 lead notes — rulings and finds during the build:**
- **D11's `is_admin()` clause was MISSING from the plan** (backend flagged it; ADR 0106 D11 requires it —
  "`is_admin()` gains the same active-role condition"). **PO ruled 2026-08-10: implement in S3, not S4.**
  Sized first: 26 RLS policies + 17 functions + ~30 TS sites, but **provably a no-op today** (0
  platform_admins hold a membership ⇒ all single-role ⇒ hat derived implicitly). Proof required a
  **synthetic multi-role platform_admin** — the only fixture that can distinguish the two
  implementations; without it the no-op claim is vacuous. A **tripwire** now reds if any
  platform_admin ever gains a membership, because the whole argument rests on that set being empty.
- ⚠ **`assume_role` had a chicken-and-egg bug, caught before shipping:** its `platform_admin` branch
  called `is_admin()` to test eligibility to *acquire* the hat — circular once `is_admin()` requires the
  hat already active. Proven live, fixed against raw `profiles.is_admin`. **This is the break-glass
  path the ADR explicitly protects** ("must never depend on the picker").
- **The 3-arg `has_role` came back BLIND and was DROPPED, not keystoned.** It was a pure delegation to
  the 4-arg, so S3 changed *what it meant* without changing its text — the recurring shape here. Zero
  callers proven across four surfaces (928-function corpus · `pg_policies` all schemas · seed/demo ·
  TypeScript), so it was unreachable rather than unguarded. `ARM=census` live gates 451→450 confirms.
- **Plan correction:** `ARM=census` did **not** grow for `active_role()` — census counts **boolean**
  gates and `active_role()` returns `text`. The plan predicted census would be the arm that sees it.
  Real coverage for the hat is the **revert-twin keystone**, not census.
- **`BUG-ACT-NULLHAT-1`:** the plan's own literal `p_role = app.active_role()` is NULL for a hatless
  caller, so `IF NOT has_role(…)` never fired — **the prescribed fix was a fail-open**. Fixed with
  `IS NOT DISTINCT FROM`. It cannot reintroduce a both-NULL hole: a NULL `p_role` can never satisfy
  `m.role = p_role` in the membership test that runs ahead of the hat condition.
- ⚠ **Where a D9 hint actually renders:** a guard's `notFound()` thrown in `layout.tsx` is caught by an
  **ancestor** boundary, **never** by a `not-found.tsx` sibling in its own directory — here the
  **global `src/app/not-found.tsx`**, as neither `[org]/` nor `o/` has an intervening layout. Disproved
  the design note's assumption three ways incl. on a real `next build`. The 6 area boundaries are kept
  for the narrower page-level case.
- **Keyboard-only is the tester's proof, not frontend's** — the frontend engineer could not drive
  trusted keyboard events (browser pane not compositing) and said so rather than claiming it.

**Lead notes / decisions taken during the build:**
- **S0 placement — the enum lands in `public`, not `app`** (lead ruling 2026-08-09, on a real S0
  finding). `config.toml` exposes `["public","graphql_public"]`, so an `app`-schema enum is invisible
  to `gen:types` — which silently breaks the plan's "the picker (via generated types)". Exposing `app`
  was rejected outright (it would put every `app` DEFINER door on PostgREST); a hand-kept TS mirror is
  a stale-assertion generator. A bare enum TYPE in `public` is not a relation — no endpoint, no RLS
  surface — and `public.audio_job_status` is the existing precedent. Schema placement was never one of
  the PO-locked P1–P6 decisions.
- **S1 scope reversal — the 20 `224_memberships_collapse.sql` sites ARE routed** (lead, 2026-08-09,
  overriding a "disproportionate for a harness-only stage" deferral). That file is the program's
  epicentre, not its periphery: its own header calls it *"the lock"*, §5 asserts
  `grant_role → wrapper true` and §7 is a 27-wrapper truth table — all resolving through `has_role`,
  the exact function S3 amends. Those sites hand-mint the JWT with `jsonb_build_object`, so they
  **bypass `custom_access_token_hook`** and the implicit single-role derive (which happens at
  token-mint) can never rescue them: at S3 `active_role()` returns null and every wrapper-true
  assertion flips red *inside* the one red window. Routing with `p_active_role => null` is inert today
  and makes S3 a one-argument flip per site.
- **S3 obligation — `accessToken` (the raw-JWT E2E helper) has NO seam, and the reason matters.**
  It performs a genuine password grant, so unlike the pgTAP sites it passes **through** the hook.
  That inverts the exposure: single-role personas get an implicitly-derived hat and keep working;
  a **multi-role** persona opens a new session with no selection row ⇒ no claim ⇒ **stranger**. Safe
  today only by construction (`dualhat.a@` is the sole multi-role principal and no spec uses it yet).
  ⚠ A raw grant has its **own `session_id`** and cannot inherit a hat chosen in a browser context —
  one seam does not cover both. Full obligation + why it is also S3's best "hatless ⇒ stranger"
  probe: [act-as-buildnotes.md](../plans/act-as-buildnotes.md) (Stage 1 tester-half section).
- **Migration window:** `20260918000000`+ (above the highest registered `20260917000400`). S2 owns
  `20260918001000`+, S3 `20260918002000`+ — a shared local stack is in play.
- ⚠ **S2 must not start while a full e2e:prod gate is running** — authoring a migration FILE mid-gate
  applies on the next batch and has voided a run here while still exiting 0.
- `.next/types` was never generated in this fresh worktree, so the first `npm run typecheck` failed on
  an untouched route file. `npm run build` once populates it. **Not a defect** — do not chase it.


---

## Bug Log — CLOSED rows (rotated)

⬛ **BUG-ACT-RAWGRANT-HATLESS-1 — RESOLVED same-session 2026-08-10 (`tester`, coordinator-
authorized follow-up).** Re-bounded by the property, not the name, per the coordinator's own
correction of their earlier "accessToken has zero callers, nothing for you" check (which was
itself name-bounded — the exact mistake this repo has logged before): **58 files** in `e2e/`
perform a raw password grant (`grep -l grant_type=password`); of those, **22** (not the
coordinator's provisional 20, not the tester's own first-pass 20 either — see below) intersect one
of the 6 multi-role personas, once traced past every layer of indirection:
- **19** by literal string (matches the coordinator's 20 minus the tester's own new file):
  `case-patient`, `charters-cadence`, `ff3-validations`, `helpers/accreditation.ts`,
  `mem-memberships-collapse`, `notifications`, `patient-index`, `perf-sweep-wave2`,
  `phase10-meetings`, `phase13-audit`, `phase14a-safety-events`, `phase14b-triage`,
  `phase14c-rca`, `phase14d-capa`, `phase15-indicators`, `phase22-referrals`, `phase7-cases`,
  `phase8-dashboard`, `phi-remediation`.
- **+3 found only by tracing transitive imports / dynamic queries**, invisible to any name or
  literal-string sweep: `phase16-accreditation-clone.spec.ts` + `phase16-accreditation-hospital
  .spec.ts` (both import `getToken`/`ORGADMIN_B`/`STAFF1_QUAL_B` from the SHARED
  `helpers/accreditation.ts` — the risky VALUE lives in a different file than the risky CALL);
  `ethics-e2-procedure.spec.ts` (a `computeEligibleVoters()` roster query resolves CCIH's real
  `memberships`, which includes pqsdual.a@ as a genuine `staff` row — the persona arrives via a
  DB round-trip, not a constant at all).
- Of the 19 literal-string files, **4 turned out to be false positives on re-verification**
  (`case-patient`, `phase10-meetings`, `phase7-cases`, `phase8-dashboard` — the persona name
  appears only in a header-comment persona list; every actual `getOwnerToken`/`getToken` call
  in each file uses an unrelated single-role persona, confirmed by enumerating every call site,
  not just grepping the risky string). **1 more (`perf-sweep-wave2`) had its helper converted for
  consistency but had no actually-risky call site** (only ever calls with `chefe.ccih@`).
- **Self-correction recorded, not hidden:** the tester's own FIRST pass over this list missed
  `phase14c-rca.spec.ts` and `phase14d-capa.spec.ts` (13 raw-grant sites each, 26 total) — both
  appeared in the same `grep` output as every other hit, but the tester's initial read concluded
  "comment-only" without checking their ACTUAL `getOwnerToken(request, ADMIN_EMAIL)` call sites,
  the same class of gap the coordinator's own correction was about, one layer further in. Caught
  by a maximally-thorough final sweep (per-file, not globally-deduplicated) before declaring done.

**Fix, as specified:** built the hatted `accessToken(target, email, password?, actAs?)` in
`e2e/helpers/auth.ts` (grant → `assume_role` against THAT grant's own session → refresh → return
the hatted token; cache partitioned by `email::actAs`, mirroring `cachedSignIn`; accepts either a
`Page` or a bare `APIRequestContext` so every local helper's existing call shape works
unchanged). Smoke-tested directly before converting any consumer (hatless → `active_role:
undefined`; hatted → correct claim; cache/partition both verified). All ~13 local
`getOwnerToken`/`getToken`/`ownerToken`-style helpers across the 22 files now delegate to it
(none needed to stay independent — delegation was possible everywhere). `actAs` threaded per
call site under the SAME union-vs-single-hat test used for the cookie surface — verified live
per file after threading (not assumed), which caught 3 real misclassifications before they
shipped: `phase22-referrals.spec.ts` Flow 4c needed `org_admin` (a coordinator-equivalent
stand-in), not `pqs_member`; the `nsp-per-hospital.spec.ts` AC-7 dispose tests and
`phase22-referrals.spec.ts` Flow 3d/5a needed `staff` for ROUTE ENTRY (a commission-scoped URL —
`is_pqs_operator_of` admits the bare `commissions` RLS row but not the referral-hub page itself,
confirmed by a live 404 under `pqs_member`); `ethics-e2-procedure.spec.ts`'s dynamic voter loop
needed each voter's OWN role from `computeEligibleVoters()` (extended to carry it through) rather
than one blanket hat, since the roster mixes `staff` and `staff_admin` CCIH members.

**Findings from raw-grant verification — both since RE-SCOPED per PO ruling 2026-08-10 (see
"ACT — union tests re-scoped" below), no longer left red:**
- `phase15-indicators.spec.ts` AC-5b and `phase22-referrals.spec.ts` Flow 3d, both originally
  filed here as accepted "union" losses, were rewritten (not deleted) once the PO ruled on them —
  each half now passes under its own correct hat, PLUS an explicit new assertion proving the
  specific combined-single-session flow is genuinely gone. Detail in the ACT union-tests entry
  below; both green as of this commit.

**Also found and fixed en route (same bug class, blocking verification of the above, not a new
class):** two MORE instances of `BUG-ACT-NOTFOUND-COPY-1` (below), in `ethics-e2-procedure.spec.ts`
(`assertRouteDenied`, cascading via `test.describe.configure({mode:'serial'})` — blocked FLOW-7,
the test actually exercising the pqsdual.a@ dynamic-role fix, until corrected) and

⬛ **RESOLVED via rewrite 2026-08-10 (`tester`) — `phase22-referrals.spec.ts` Flow 5a was a
THIRD instance of the exact shape the PO ruled on for AC-5b/Flow 3d,** found re-running the
touched specs after that first rewrite, not caused by it: its `signInAs(page,
'pqsdual.a@test.local', undefined, 'staff')` is unchanged from the tester's EARLIER commit
(`a8da28d`) — confirmed via `git log -p`. First flagged (not rewritten) respecting that round's
"then stop" boundary, since the PO had not reviewed this specific test. **The PO has since
reviewed it and extended the ruling; rewritten this round.** Detail in the ACT union-tests entry
below. **Compounding finding, now corrected in the rewrite:** the test's old `else` branch ended
"if PHI doesn't appear at all, the lazy door works correctly — nothing to assert" — a SILENT
vacuous-pass fallback for exactly the case that's now structurally permanent, meaning the
tester's earlier "3 passed" report for this test (BUG-ACT-RAWGRANT-HATLESS-1 close-out) almost
certainly reported a vacuous pass, not a real one. That fallback does not survive the rewrite —
every branch now asserts unconditionally.

**Bounded vacuous-branch check, `phase22-referrals.spec.ts` ONLY, per the coordinator's explicit
request (2026-08-10, `tester`) — do not sweep the repo; report even a null result.** Read every
conditional in the file (not just around Flow 5a). Findings filed below as their own durable
entry, not left as a chat-only note. Checked and confirmed NOT vacuous (both branches, or an
unconditional fallback, always assert) — recorded so this reads as a real audit, not a
cherry-picked one: Flow 1c/2c (`if/else`, each arm asserts a shape of "no access"); Flow 5b
(inner `if (resp.ok())` is optional, but an unconditional audit-row-count check always runs after
it); Flow 7c (an unconditional `not.toBeNull()` precedes the only conditional, so the branch is
unreachable-false by construction); Flow 8b (either arm — `sendBtn` visible or not — contains at
least one unconditional `toBeFocused()` before any further nested, optional checks).

⬛ **ACT — union tests re-scoped, PO ruling accepted 2026-08-10 (`tester`, backend traced both
mechanisms, PO ruled "accept both losses").** `phase15-indicators.spec.ts` AC-5b and
`phase22-referrals.spec.ts` Flow 3d rewritten in place, not deleted — each asserts what is now
TRUE under its own hat, plus an explicit proof of the specific thing that's genuinely gone.
- **AC-5b — the inherited mechanism comment was WRONG, corrected as part of the rewrite.** The
  pre-ACT comment (never independently re-verified until now) described `open_capa_plan`'s gate
  as `is_tenancy_admin_of(source_commission) OR is_pqs_operator_of(hospital)`. Read live from
  `pg_get_functiondef`: for `p_source = 'indicator'`, `v_hospital` resolves unconditionally from
  the indicator's own commission, so the function's only membership-fallback branch (the sole
  place any tenancy-admin check could live) never executes — the ONLY authorization check is
  `app.is_pqs_operator_of(v_hospital)`. There never was a two-armed OR; it is TWO SEPARATE
  SEQUENTIAL gates (PAGE ENTRY = `canConfigureCommission`, staff_admin/tenancy-admin; the RPC
  itself = `is_pqs_operator_of` alone) that a hatless session used to satisfy together and no
  session can anymore. Rewrite: UI half stays `org_admin` (unchanged, already passing); RPC half
  now correctly hatted `pqs_member` (an independent raw-grant session — it was ALREADY a separate
  credential from the UI's cookie session, only the hat was missing, so nothing about the
  operator-tier authorization/data-contract proof was actually lost); NEW assertion added —
  `pqs_member` gets 404'd on the indicator page itself, proving the single-session "view this page
  and click a button here" journey is structurally gone. All three pieces green.
- **Flow 3d — same two-gates shape** (`staff` for commission entry, `pqs_member` for
  `can_read_referral_phi`, verified live: `is_pqs_operator_of_for(...) OR is_staff_admin_of_for(...)
  OR <target arms>` — pqsdual.a@ is plain `staff`, not `staff_admin`, at CCIH). Rewrite: `staff`
  half now asserts the PHI result is POSITIVELY withheld ("Sem resultado registrado", the real
  result text confirmed absent) rather than expecting it visible; NEW assertion — `pqs_member`
  gets 404'd on the same commission-scoped route, proving the combined flow is gone. Per the PO's
  own reasoning (the NSP surface is deliberately PHI-free / has no deep link here, by design, not
  by this gap) — not independently re-tested here (would expand scope beyond the two named tests;
  flagged as a candidate follow-up if that NSP-surface behavior itself ever needs its own spec).
- **Flow 5a — EXTENDED to this test 2026-08-10, same session, after the PO reviewed it.** Same
  predicate as Flow 3d (`get_referral_patient` is gated by the identical `can_read_referral_phi`
  that withholds `result_md`), same incompatibility (`staff` passes entry/fails PHI, `pqs_member`
  passes PHI/404s entry — the 404 proof reused directly from Flow 3d's own live run, per the
  coordinator's "same-shape edit, not a new investigation," not re-verified as a fresh
  experiment). Rewrite: `staff` half now asserts the reveal control discloses nothing and no
  `referral_patient.read` audit row fires, with NO silent-fallback branch (see the bounded
  vacuous-branch check above — the tautology risk in the naive "else { expect(count).toBe(0) }"
  shape was caught and removed before landing: that assertion is true by the very condition that
  selects the branch, so the real proof was moved to an unconditional block that runs regardless
  of which way the conditional goes); `pqs_member` 404s the same route. **Unlike Flow 3d** —
  where the underlying "an entitled reader sees the PHI" fact stays covered elsewhere (chefe.ccih,
  Flow 1b) — this WAS the only test in the file exercising the `referral_patient.read`
  AUDIT-WRITE mechanism itself (row appears on reveal, PHI-free metadata, source-commission
  attribution — Rule 11), and that mechanism was not re-proven by the first rewrite for ANY
  persona, because the original test's only actor was a QPS-operator-only identity. First round:
  flagged rather than added, since "same shape as Flow 3d" was the instruction and a third
  persona/track went beyond that literal shape.
- **RESTORED 2026-08-10, coordinator's explicit call, same session: "your flag was right and the
  answer is yes... losing a PHI-audit proof as collateral from ACT is a genuine regression in the
  platform's compliance posture, not tidy-up."** Added a Part A block ahead of the union-gate
  rewrite, using `chefe.ccih` (staff_admin CCIH, the source coordinator) exactly as flagged —
  already proven live (Flow 1b) to pass the identical `can_read_referral_phi` gate; always could
  reach this route and reveal PHI, pre- and post-ACT alike, no hat ever involved for her; NOT a
  widening. Asserts the MECHANISM, not the journey: PHI visible on screen (a real positive
  control — see below), a `referral_patient.read` row appears, its metadata carries no PHI, and
  `commission_id` is the source commission.
- **Non-vacuousness, established four ways, not just asserted green (per the coordinator's
  explicit "say how"):**
  1. **A REAL, unplanned failure caught it before this was even finished.** The first draft used
     `revealBtn.isVisible({ timeout: 5_000 })` to gate the click — Playwright's `isVisible()` does
     NOT auto-wait (confirmed from the docs and from the failure itself: the error-context
     snapshot showed the button still unclicked, "Exibir identificação," 10+ seconds after
     navigation), so the check raced the panel's render and skipped the click. The test FAILED
     for exactly this reason on the first real run — not manufactured, an actual defect in the
     tester's own draft, caught by the assertion doing its job. Fixed with a genuine
     `locator.waitFor({ state: 'visible' })` before the plain `isVisible()` check.
  2. **Positive control on the PHI-visibility assertion itself**: `expect(getByText(PHI_NAME))
     .toBeVisible()` is not conditional on anything — if the reveal mechanism silently broke, this
     is what would catch it, and finding #1 above is direct proof it does.
  3. **Live inspection of the actual audit row, not just its shape**: `select metadata,
     commission_id from audit_log where action='referral_patient.read' order by occurred_at desc
     limit 1` → `metadata = {"acting_as": "staff_admin"}`, `commission_id = COMM_A`. Real,
     non-empty, non-trivial content — rules out the "assertion is vacuously true because the field
     is always empty" failure mode for the metadata check.
  4. **Deliberate mutation, isolated one at a time, each confirmed RED for the right reason, then
     reverted**: (a) `toBeGreaterThan` → `toBe` (claims no new row) — RED, `Expected: 1, Received:
     2`; (b) `not.toContain(PHI_NAME)` → `toContain(PHI_NAME)` (claims PHI IS in metadata) — RED,
     the error printed the REAL metadata (`{"acting_as":"staff_admin"}`) failing to contain it;
     (c) `commission_id` expected value flipped `COMM_A` → `COMM_B` — RED, `Expected: …b1,
     Received: …a1`. All three reverted; final state re-verified green
     (`git diff` shows zero `TEMP MUTATION` markers remaining).
- **Both re-verified green** after rewrite (`npx playwright test ... -g "AC-5b|AC-6"` and
  `-g "Flow 3d"`, chromium, `--workers=1`); **Flow 5a re-verified green** standalone, after each
  mutation revert, AND as part of a full-file run on a fresh `db reset`
  (`phase22-referrals.spec.ts` 40/40).
- **Tester's view on "assert absence" as the shape:** right for all three. It's not just the
  least-bad option — it's a STRICTLY STRONGER test than the one it replaces: the original only
  ever proved "a hatless admin@/pqsdual.a can do X", conflating two gates that happened to both be
  reachable by coincidence of one persona's total membership set. The rewrite proves each gate
  individually AND proves they no longer compose, which is the actual ADR 0106 claim (D5) — the
  old test never asserted that composition was even meaningful, let alone gone.

⬛ **BUG-ACT-AUDIT-PLATFORM-TIER-1 — RESOLVED by `backend` (migration
`20260918002600_act_assume_role_audit_scope.sql`), re-verified by `tester` 2026-08-10.**
Originally: `phase13-audit.spec.ts` AC-3f-platform (`platform@`, untouched by any ACT work)
asserts the audit_log "platform-tier chain" (organization_id AND commission_id both NULL) is
permanently empty; `assume_role`'s own audit action, `active_role.assumed`, wrote with BOTH null
unconditionally, so any earlier picker/switch use in the same database populated the bucket.
**Fix, re-verified live via `pg_get_functiondef(assume_role)` on the current migration head:**
`assume_role` now looks up the actual `memberships` row backing the role being assumed (`select
organization_id, hospital_id, commission_id from memberships where principal_id = v_uid and role
= p_role::text …`) and passes THAT tenant into `audit_write`, instead of always passing null.
Only `p_role = 'platform_admin'` still stamps all-null — an explicit, commented, correct
carve-out ("No tenant to stamp — the ruling's own carve-out"), since a platform_admin genuinely
has no tenant. **Confirmed empirically, not just by reading the function**: ran
`phase22-referrals.spec.ts` (40/40) + `phase15-indicators.spec.ts` (12/12) on a fresh reset — both
exercise multiple `assume_role` hat-switches — then queried `audit_log` directly: **zero**
`active_role.assumed` rows with org+commission both null; every row carries the real tenant of
the assumed role. See BUG-CAPA-AUDIT-SCOPE-1 below — the second, independent, pre-existing
mechanism that pollutes the same bucket remains open; this one's resolution does not close that.

⬛ **BUG-CAPA-AUDIT-SCOPE-1 — RESOLVED 2026-08-10 (`backend`, migration
`20260918002700_act_capa_audit_scope_fallback.sql` + red-first keystone
`supabase/tests/317_act_capa_audit_scope.sql`, commits `bf85bce`+`55f4759`; this entry was
stale-OPEN — the lead audit session reconciled it against the live catalog:
`trg_audit_capa_plan` now falls back to `new.hospital_id`, verified via `pg_get_functiondef`,
sibling-trigger sweep + catalog property diff in the buildnotes' own section).** The
batch-packing red it could inflict on `phase13-audit` AC-3f-platform is therefore closed at
the mechanism, not by loosening the assertion. Original finding preserved below:
~~🟡 BUG-CAPA-AUDIT-SCOPE-1 — OPEN, pre-existing, NOT caused by ACT (`backend` traced the~~
mechanism; `tester` independently verified against the live catalog + confirmed live in this
database, 2026-08-10; filed per the coordinator's explicit instruction — not fixed).**
`app.trg_audit_capa_plan` (verified live via `pg_get_functiondef`) resolves audit scope ONLY via
`v_comm := case when v_event is not null then app.commission_of_event(v_event) else null end` —
i.e., only `source='event'` CAPAs ever get a commission. For `manual`/`meeting`/`indicator`/
`audit_finding`-sourced CAPAs, `v_event` is null, so `v_comm` is null, and `audit_write(...,
p_commission => null, ...)` is called with NO `p_organization`/`p_hospital` override either —
landing the row in `audit_write`'s own documented "platform chain (all NULL)" bucket (verified
live from `audit_write`'s `pg_get_functiondef`), even though `capa_plan.hospital_id` is a REAL,
POPULATED column on the very same row (`open_capa_plan` always sets it, for every source type)
that the trigger simply never reads. **Confirmed live in this database**:
`phase14d-capa.spec.ts` opens 5 manual-source plans (`p_source: 'manual'` at 5 call sites); `select
action, organization_id, commission_id, hospital_id, count(*) from audit_log where
action='capa.opened' group by 1,2,3,4` → 2 rows with ALL THREE null, alongside 1 correctly-scoped
row from an event-sourced open. **Second independent confirmation, found incidentally this round
(2026-08-10, `tester`) re-running the touched specs on a fresh reset**: `phase15-indicators.spec.ts`
AC-5b — an ACT-touched file, `p_source: 'indicator'` — reproduces the IDENTICAL mechanism on its
own, with no `phase14d-capa` involved at all: after `phase22-referrals.spec.ts` (40/40) +
`phase15-indicators.spec.ts` (12/12) on a clean reset, `select action, count(*) from audit_log
where organization_id is null and commission_id is null group by 1` → exactly `capa.opened: 2`,
zero of any other action (confirming BUG-ACT-AUDIT-PLATFORM-TIER-1's fix above is holding, and
isolating this as the sole remaining source). So the mechanism is not specific to
`phase14d-capa.spec.ts`'s manual-source opens — ANY non-event-sourced `open_capa_plan` call
(manual, meeting, indicator, or audit_finding) lands in the platform-null bucket, regardless of
which spec file makes the call.

**Ordering mechanism, added 2026-08-10 per the coordinator's explicit instruction (not
adjudicated by the tester — recording the mechanism only):** Stage 2's full `e2e:prod` ran GREEN
with this exact CAPA mechanism already present in the codebase — it is not new. `e2e:prod`
resets the DB **per batch**, so the pollution can only red `phase13-audit`'s AC-3f-platform when
a non-event-sourced-CAPA-opening spec (`phase14d-capa`, or — now confirmed — `phase15-indicators`
itself) lands in the **same batch** as `phase13-audit`. Batch composition is not stable across
runs of this program: specs have been added, deleted, and rewritten (this exact round rewrote
`phase15-indicators.spec.ts` and `phase22-referrals.spec.ts`), which shifts how `e2e:prod`'s
batching divides the suite. **So this is a latent, pre-existing defect newly EXPOSED by batch
reshuffling — it was never truly passing (the mechanism was always there, waiting for the right
batch composition to land two specific specs together), and ACT did not introduce it.** A defect
whose visibility depends on batch packing will come and go across runs with no code change in
between, and reads exactly like flake — which is the worst possible failure mode for an audit
assertion specifically, since "audit_log has a hole sometimes, depending on what else happened to
run first" is precisely the kind of gap Rule 11 exists to catch, not hide behind a flaky-looking
red that gets re-run away.

**Not fixed** (explicit instruction — pre-existing, outside this program, not a tester call).
**Tester's view, since asked (updated 2026-08-10 now that BUG-ACT-AUDIT-PLATFORM-TIER-1 is
resolved):** yes, `AC-3f-platform`'s assertion still looks too broad to survive a realistically-
complete suite ordering — on its own, independent of ACT entirely, this one mechanism is now
confirmed reachable from at least two different specs (`phase14d-capa`, `phase15-indicators`),
and the ordering analysis above shows its visibility is a batch-packing accident, not a stable
property of the suite. The premise ("nothing ever lands here") was already fragile before ACT
touched anything; ACT's own now-fixed contribution (BUG-ACT-AUDIT-PLATFORM-TIER-1) was a second,
temporary, ADDITIONAL way to trip the same fragile assertion, not the source of the fragility.
Whether the fix is "make CAPA triggers fall back to `new.hospital_id`", "give platform_admin-only
/ non-event-sourced actions their own audit tier", or "loosen this one assertion to something
like `count <= <known-pollution-sources>`" is a design call, not adjudicated here.

**End-to-end reproduction directly OBSERVED, not merely predicted (2026-08-10, `tester`):** with
the DB in the exact state left by `phase15-indicators.spec.ts`'s own run (2 null-tier
`capa.opened` rows from AC-5b, no reset in between), ran
`npx playwright test e2e/phase13-audit.spec.ts -g "AC-3f-platform"` standalone — **RED**,
`getByText(/Nenhum registro de auditoria ainda\./i)` times out because the empty state no longer
renders. This is the exact "platform bucket not empty" failure shape predicted above, reproduced
live rather than inferred from the row counts alone.

⬛ **BUG-ACT-NOTFOUND-COPY-1 — RESOLVED same-session 2026-08-10 (`tester`).** Originally found in
`user-registration.spec.ts` "a foreign org_admin (rede-b) cannot open a rede-a user detail page":
asserted `getByText('Erro 404')` — the GLOBAL not-found page's eyebrow — but ACT Stage 3 added a
NEW `manage/not-found.tsx` sibling boundary (frontend half, design-note §5.4 correction), which
catches a PAGE-level `notFound()` (the cross-org user-detail lookup) inside an already-entered
`/o/rede-b/manage` shell, rendering DIFFERENT copy ("Página não encontrada", no "Erro 404" text).
**Security was always intact** — denial + zero data leak, verified live; only the copy assertion
was stale. **Fixed in 4 places** (2 in `user-registration.spec.ts` including a SECOND, previously
unreported `getByText('Erro 404')` in the SAME file at "a plain staff/staff_admin cannot reach the
org user directory"; `ethics-e2-procedure.spec.ts`'s shared `assertRouteDenied` helper;
`phase13-audit.spec.ts` AC-3e) by matching `/não encontr/i` — the shared pt-BR stem across every
known boundary's copy — instead of pinning one boundary's exact string, so a future boundary
addition does not red this again. All 4 re-verified green.

⬛ **BUG-ACT-NOTFOUND-COPY-1 — FULL POPULATION RESOLVED 2026-08-10 (`tester`, coordinator-directed
after the full `e2e:prod` gate came back 38 failures + 4 infra).** The "4 places" above were the
instances found while fixing something else; the coordinator's own measurement — **81 occurrences
across 36 files** pinning the OLD global copy — is the real population, independently reconciled
here to the same 81/36 via `grep -i "ncontramos esta p.gina|Erro 404" e2e/`. **Mechanism, confirmed
from source AND live, not assumed uniform**: the GLOBAL boundary (`src/app/not-found.tsx`) still
reads *"Não encontramos esta página."*; ACT ADR 0106 added FOUR area-specific siblings reading
*"...não encontrada"* instead — `src/app/o/[org]/c/[commission]/not-found.tsx` (commission-tier),
`src/app/o/[org]/manage/not-found.tsx` (org-tier), `src/app/o/[org]/nsp-org/not-found.tsx`,
`src/app/o/[org]/direcao-tecnica/not-found.tsx`, `src/app/o/[org]/qualidade/not-found.tsx`. `/não
encontr/i` is the shared pt-BR stem across all five.

**Classification discipline applied to every failing test before touching it** (HTTP-status was
NOT reliable here — the suite's own repeated comments document that a `notFound()` below a
`loading.tsx` streams HTTP 200 with the not-found BODY, so `.status()` cannot distinguish "denied"
from "granted" for most of these routes):
- **Commission-tier (`c/[commission]/**`), 14-route live diagnostic**: signed in as `orgadmin.a`
  (bare tenancy admin) and navigated all 14 QO·B `CUT_ROUTES` (`dashboard`,
  `dashboard/submissions`, `manage/assinaturas`, `manage/documentos`, `manage/cases`, `meetings`,
  `encaminhamentos`, `eventos`, `respostas`, `manage/charter`, `manage/acreditacao`,
  `minhas-fases`, `meus-casos`, `meus-itens-de-acao`) in one pass, capturing the H1 text + two
  signals unique to the real boundary (the body sentence "...você não tem acesso a esta
  comissão." and the "Voltar ao início" link) for each. **All 14: identical new boundary, zero old
  copy, the denial-specific body text present every time** — not generic 404-shaped text. Every
  OTHER commission-scoped route fixed this round (`casos/[id]`, `forms/**/responder/**`,
  `manage/members`, `manage/process-templates`, etc.) shares this exact file (confirmed via
  `Glob **/not-found.tsx` — no route in this population has a MORE specific override), so this
  one diagnostic covers all of them, not just the 14 named routes.
- **Org-tier (`manage/**`), verified per-route, NOT assumed uniform — this is the one place a
  blanket assumption would have been wrong**: `/o/rede-a/manage/acreditacao` (flag-off denial,
  `hospitaladmin.a1`) and `/o/rede-a/manage/usuarios/[id]` (cross-hospital denial, same persona)
  both hit the NEW org-tier boundary, confirmed via each test's own error-context snapshot
  (`heading "Página não encontrada"` + `paragraph: "...não tem acesso à administração desta
  organização."`). But `/o/rede-a/manage/administradores` (role denial, SAME persona) and
  `/o/rede-a/manage/acreditacao` under a CROSS-ORG denial (`orgadmin.b`, different mechanism than
  the flag-off case on the identical URL) both still show the OLD global copy — confirmed via
  `hospital-admin-tier.spec.ts`'s own `expectAccessDenied` helper (a real `expect().toBeVisible()`
  with auto-retry) returning "Página não encontrada" for `administradores` when denial fires at a
  role-check level, contradicted at first by `nsp-per-hospital.spec.ts`'s OWN test on the same
  route/persona reporting the OLD copy — resolved by finding the cause: that file's
  `expectAccessDenied` helper does a single un-retried `page.locator('body').textContent()` with
  no wait for the streamed body to resolve, a genuine, separate reliability defect (not fixed,
  flagged below), not evidence of different copy. The takeaway a blanket "manage/** = new
  boundary" rule would have missed: **which boundary fires depends on WHERE in the render tree
  the specific denial reason is checked** (an outer layout's tenancy gate vs. a page-level
  flag/role check), not on the URL prefix alone — confirmed per site, not inferred.
- **`nsp/**` (patient-index, nsp-cross-org-isolation)**: confirmed UNCHANGED (still old global
  copy) via live test runs — `patient-index.spec.ts` AC-7/AC-8c and `nsp-cross-org-isolation.spec.ts`
  X-5 all passed as-is before any edit. Widened defensively anyway (lower risk, per the
  coordinator's own classification guidance) since this boundary could migrate later the same way
  the others already have.
- **`/admin` and `/conta/**`**: confirmed via `Glob` to have NO area-specific `not-found.tsx` at
  all — outside every ACT area boundary, unaffected by construction, not just by observation.
- **`qualidade` layout-level org-denial**: `quality-oversight.spec.ts` already carried a detailed,
  previously live-verified comment explaining that a `notFound()` thrown BY `qualidade/layout.tsx`
  itself is caught by the GLOBAL boundary, not `qualidade`'s own co-located sibling (Next.js App
  Router rule: a segment's not-found.tsx cannot catch its own layout's `notFound()`) — preserved
  verbatim rather than overwritten, since it was already correct and already proven live.

**No P0. Denial held in every case checked — nowhere did the investigation find a route that
merely LOOKED denied while actually granting access.** Where the coordinator's preferred
HTTP-status check wasn't usable (most routes, per the streamed-notFound contract), the
denial-specific BODY TEXT unique to the real boundary component (not generic 404 phrasing) served
as the independent signal, verified live per site as described above — the same standard the
coordinator's own diagnosis used ("verified against all six boundary files rather than taking it
on trust").

**81-site reconciliation** (36 files; exact grep-verified count both before and after):
- **Fixed — currently-failing, denial independently proven before touching (the "38" population)**:
  ~55 sites across `meetings-reserved-sessions`, `pdf-printing-meetings`, `phase12-timeline`,
  `phase11-interviews`, `phase3-admin-members` (4 of 5; the 5th is `/admin`, see below),
  `phase6-signoffs`, `phase16-accreditation-core` (AC-0 org-tier + AC-2 commission-tier),
  `phase8-dashboard`, `phase4-builder`, `phase7-cases` (6 of 7), `processless-cases`,
  `sup-supersession`, `phase5-wizard`, `ad-hoc-narratives`, `administrativo`,
  `ethics-e1-access-spine` (both the helper and the standalone AC-1c), `ethics-e3a-surfacing`
  (helper), `case-access` (all 4), `aff-hospital-affiliation` (both), `cases-board-access`,
  `bulk-case-creation` (both), `charters-cadence`, `hospital-admin-tier` (both),
  `nsp-per-hospital` (the `administradores` helper site — widened; its OWN un-retried-read
  reliability issue flagged separately, not fixed), `quality-oversight` (constant covering 4
  usages; the `qualidade`-layout site's own correct comment preserved, not touched further).
- **Fixed — currently-PASSING, lower risk, widened defensively per the coordinator's own
  guidance** (~13 sites): `act-role-assumption` (my own file — verified 9/9 passing with OLD copy
  before widening), `qob-org-admin-content-wall` (constant covering the 14-route CUT_ROUTES loop —
  ALL 14 verified failing, so this bucket technically belongs above; grouped here because it's my
  own earlier-session file, already reconciled), `phase16-accreditation-hospital` (AC-4, cross-org
  on the acreditacao route — see the org-tier divergence note above), `notifications` N-7
  (`/conta/**`, confirmed unaffected by construction), `perf-sweep-wave2` (a positive smoke test,
  not denial), `nsp-cross-org-isolation` (tolerant `.or()` probe, not the load-bearing assertion),
  `patient-index` (AC-7 + AC-8c, confirmed unaffected), `phase22-referrals` (my own Flow 3d/5a
  negative reachability guards), `phase16-accreditation-core` AC-0's negative half (line ~326,
  same test as the positive fix), `phase3-admin-members`'s `/admin` site (companion check kept
  alongside the widened one, both now present).
- **NOT changed, correctly left (5 sites, 3 files)**: `ethics-e2-procedure.spec.ts:143` and
  `user-registration.spec.ts:629/663/664` are PROSE (comments, not live assertions — the fix
  described 2 bug-log-entries above already touched this file's actual matchers) —
  `phase17-documents.spec.ts:394` already reads `/não encontramos esta página|Erro 404|página não
  encontrada/i`, a 3-way alternation that already covers old AND new copy correctly; confirmed via
  its own passing test, untouched.

**Verification**: all 33 touched files run to green, in 6 batches plus 2 targeted isolated
re-runs. Two files (`phase22-referrals.spec.ts`, `quality-oversight.spec.ts`) showed batch-only
failures on exact-count/exact-content assertions when run alongside `perf-sweep-wave2.spec.ts`
(which seeds 26+ extra rows into shared fixtures) — confirmed as cross-file contamination, not
regressions, by re-running each alone on a fresh reset (`phase22-referrals` 40/40,
`quality-oversight` 19/21 — the 2 remaining are BUG-QO-OVERSIGHT-DOOR-1 below, unrelated).

**Non-copy findings surfaced during this sweep — ⬛ ALL RESOLVED 2026-08-10 (lead audit
session, commit `169668d`; each verified green per-file on a fresh reset before the full
gate re-run):**
- ⬛ `qob-org-admin-content-wall.spec.ts` "member-and-configuration" — NOT a missing nav link:
  the union nav is **structurally unreachable under one hat** (D5/D12 — the staff hat filters
  the tenancy-admin grants, the org_admin hat filters the membership). Split into per-hat tests
  that each prove the other scope's items absent (the PO-ruled union-loss shape). ⚠ App-side
  consequence: `navScope="member-and-configuration"` is now a **dead branch** in
  `c/[commission]/layout.tsx` — carried into S4's audit list, not deleted mid-S3.
- ⬛ `charters-cadence.spec.ts` AC-5 + `ethics-e1-access-spine.spec.ts` AC-3b/AC-8 +
  `phase13-audit.spec.ts` AC-1c (a third site the class sweep found, previously unflagged) —
  `audit_write` (D8) stamps `acting_as` into every row's metadata when a hat is active
  (catalog-verified, unconditional). All three exact-keys assertions updated to expect it;
  the class sweep (`Object.keys(*metadata*)` + `toEqual` over `e2e/`) found exactly these 3.
- ⬛ `nsp-per-hospital.spec.ts` hatless `admin@` — the sign-in was **vestigial** (immediately
  replaced by the orgadmin.a sign-in the test actually uses); deleted, not threaded.
- ⬛ `nsp-per-hospital.spec.ts` AC-7/AC-8 dispose button — a **third capability loss** of the
  PO-ruled class: the dispose gate is `is_tenancy_admin_of(source) OR is_pqs_operator_of(either
  endpoint hospital)` and the affordance mounts ONLY on the commission-scoped referral detail
  page — tenancy admins + operators 404 there (QO·B wall), members lack every arm ⇒ **no single
  hat reaches the dispose AFFORDANCE at all**. Rescoped: unreachability asserted per-hat; the
  MECHANISM proven at the RPC door (hatted `pqs_member` disposes ENC-0004: PHI erased incl. the
  redacted subject — the old "subject remains" assertion was stale vs. the live function — ENC
  record kept, Rule 11 audit row `acting_as='pqs_member'`, PHI-free metadata). AC-8's
  keyboard-only proof re-anchored on the still-reachable PHI reveal (chefe.ccih) so it stays
  non-vacuous. **Follow-up: FUP-ACT-DISPOSE-UI (below).**
- ⬛ `case-access.spec.ts` AC-3a and `administrativo.spec.ts` POS-5 — **NOT defects**: both
  files fully green standalone on a fresh reset (23p+1s / 10p). The gate reds were cross-file
  contamination; re-observed against the full gate re-run.
- ⬛ `BUG-QO-OVERSIGHT-DOOR-1` — mechanism confirmed: `setOversightViaDoor` hand-mints
  `request.jwt.claims` with no `active_role` key, and hand-minted claims **bypass the token
  hook**, so the implicit single-role derive never runs — the hat-aware gate raised CORRECTLY.
  Fix = mint the claim (`active_role: hospital_admin`), the same fix S1 applied to pgTAP's
  `claims_for`. **Class sweep run as instructed**: `request.jwt.claims` over `e2e/` → exactly
  one sibling, `technical-direction-referrals.spec.ts`'s `ensureSentDtReferral` (structurally
  red the same way, likely hiding among the 74 never-ran) — fixed identically
  (`active_role: staff_admin`). Both files green (36/36 with charters).
- ⬛ `notifications.spec.ts` N-1 — the "encarregado" dropdown is fed by `listAssignableUsers()`,
  a plain RLS `profiles` read, and the profiles SELECT policy has **no PQS-operator arm**
  (catalog-verified) — the wide roster only ever existed through the org_admin half of admin@'s
  hatless union; genuine single-role operators always saw ~only self, so this is a pre-existing
  product narrowness whose union workaround ACT closed. Rescoped: option-absence asserted under
  the operator hat; the assignment driven at the `addCapaAction` door (the N-3 vehicle);
  notification-isolation assertions unchanged. N-3's red was collateral of N-1's mid-flow
  timeout (green standalone, untouched). **Follow-up: FUP-ACT-CAPA-ASSIGN (below).**

**Follow-ups filed by the lead audit session 2026-08-10 (PO ratification pending, same family
as the two ADR 0106 accepted losses):**
- 🔴 **FUP-ACT-DISPOSE-UI — RE-SCOPED 2026-08-10 by the Stage 3 QA review (MAJOR-2, escalated).
  Filed originally as UX ratification; that framing was too weak.** This is the **LGPD Art. 18
  subject-erasure path**, and the QA review established from the catalog that the two sets are
  **disjoint**: every principal `dispose_referral_phi` authorizes (tenancy admin, PQS operator
  of either endpoint hospital) is 404'd by the page that hosts the affordance
  (`encaminhamentos/[referralId]/page.tsx:107`, `access.role === null`), and every principal
  who can reach that page is refused by the door. So the erasure obligation has **no UI path at
  all** — the capability survives only via a direct API call. ⚠ The reviewer found the
  decisive precedent the original filing missed: migration `20260917000400` restored the
  door's **tenancy-admin arm one day earlier, explicitly to un-strand this same obligation**
  after QO·B cut it — i.e. the platform has already ruled once that this path must stay
  reachable, and ACT re-stranded it by a different mechanism. **Disposition: close before
  pilot, not "whenever the PO gets to it."** The decision that remains genuinely the PO's is
  *where* the affordance mounts (an NSP-surface mount reaches operators; a manage-tier mount
  reaches tenancy admins), not *whether*. The dispose-dialog KEYBOARD flow returns with it.
- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators need a real assignee-roster door for CAPA actions
  (`listAssignableUsers` reads `profiles` through RLS, which has no operator arm — operators
  see ~only themselves in the picker). Pre-existing narrowness, no longer maskable by union
  sessions. Candidate: a DEFINER roster door in the `list_addable_commission_members` family,
  scoped + audited, with its own 0079 sweep entry.

**On the 74 unrun tests** (`b1(10) b2(22) b3(2) b4(27) b7(2) b8(1) b17(10)`): no access to the
gate's own batch partitioning or logs from this session, so no way to map these to specific test
names or independently re-run "batch 4" as such. What this round DOES establish: every file in
the 81-site population that was checked — standalone where needed to rule out cross-file
contamination — is now green on every notfound-copy-shaped assertion. If any of the 74 live in
those 33 files, they are covered; for the remainder, only a full `e2e:prod` run (the coordinator's
next step) will show whether the copy fix alone was sufficient or whether unrelated causes (like
the ones just listed) still cut a batch short.

⬛ **BUG-ACT-GUARD-HATBLIND-1 — RESOLVED same-session 2026-08-10 (`backend`, fix landed while
`tester` was mid-investigation on the seed-persona threading follow-up; re-verified by `tester`
after the fix — `e2e/act-role-assumption.spec.ts` "The switch" now passes 9/9, fresh
`supabase db reset --local` + a clean server restart).** Backend's fix: `src/lib/queries/session.ts`
gained an active-role filter reaching every `partitionGrants()` consumer (`orgAdminOf` /
`hospitalAdminOf` / `technicalDirectionOf` / `nspOrgAdminOf` / `qualityReviewerOf` /
`nspOperatorOf` / `memberships`), plus migration `20260918002400_act_p0_hat_blind_nsp_hospitals.sql`
fixing a SEPARATE hat-blind DEFINER door (`public.list_my_nsp_hospitals()` — a raw `memberships`
UNION with no `has_role` routing) found while backend audited every consumer per the tester's
report — a second vulnerability the tester's own repro did not surface (NSP wasn't one of the 2
guards live-reproduced). Backend's migration comment independently confirms the tester's
`nsp-org/layout.tsx` "fragile-safe" finding (its second check verified hat-aware, live, not
assumed). Original finding preserved below for the record — verify `git log`/the live catalog
for the final committed shape rather than trusting this prose once this rotates out.

~~🔴 BUG-ACT-GUARD-HATBLIND-1 — OPEN, HIGH SEVERITY (`tester`, found writing the "the switch"
Stage 3 spec, 2026-08-10; live-reproduced, not inferred).~~ At least 3 of the 6 D9 choke-point
area guards admit a principal into an area their CURRENTLY ACTIVE hat does not authorize, as
long as they hold ANY membership for that area under ANY hat — this is the exact fail-open D5/D12
exists to prevent, confirmed at the application layer (as distinct from raw RLS table reads,
which ARE correctly hat-gated — see below).

**Live-reproduced twice, independently, ruling out caching as the cause:**
1. `dualhat.a@test.local` signs in choosing **quality_reviewer** (fresh session, cookie's
   `active_role` claim decoded and confirmed = `quality_reviewer`, never having visited
   `/manage` this session) → `page.goto('/o/rede-a/manage')` → renders the **full org-admin
   console** ("Rede Hospitalar A" h1, Comissões/Usuários/Hospitais/Painel/Indicadores/
   Administradores/Trilha de auditoria nav, real counts), not a 404.
2. Same persona, signs in choosing **org_admin** instead (UserMenu caption confirmed showing
   "Administrador(a) da organização") → `page.goto('/o/rede-a/qualidade')` → renders the
   **full quality-office console** ("Casos sob supervisão" h1, live case board), not a 404.

**Root cause, verified against the live catalog and the TS source, not assumed:**
`public.session_context()` is **deliberately hat-blind by design** (its own SQL comment,
confirmed live via `pg_get_functiondef`: "this function is a DESIGNED hat-blind door... the
picker and the D9 hint need the caller's FULL grant list"), for the picker/D9-hint's legitimate
need. `getSessionContext()` (`src/lib/queries/session.ts`) calls this ONE RPC and correctly
derives `activeRole`/`needsRoleSelection` from the verified JWT claim — but ALSO derives
`orgAdminOf` / `hospitalAdminOf` / `qualityReviewerOf` / `nspOrgAdminOf` / `technicalDirectionOf`
/ `nspOperatorOf` / `memberships` via `partitionGrants()` (`session-grants.ts`), a pure function
with **zero reference to `activeRole` anywhere in its body** — it partitions by structural role
fields only. At least these consumers read those fields DIRECTLY as their access decision, with
no additional hat check:
- `src/app/o/[org]/manage/layout.tsx` — `context.orgAdminOf` / `context.hospitalAdminOf`
  (confirmed live-vulnerable, repro 1 above).
- `getQualidadeAccessByOrg` (`session.ts`) — `context.qualityReviewerOf` (confirmed
  live-vulnerable, repro 2 above).
- `getTechnicalDirectionAccessByOrg` (`session.ts`) — `context.technicalDirectionOf` (same
  code shape as the two confirmed cases; not independently live-reproduced — no seed persona
  makes technical_director multi-hat today, so this is a code-reading inference, flagged as
  such, not asserted as separately confirmed).
- `isCommissionAdmin` (`src/lib/auth/access.ts`) — reads `ctx.orgAdminOf`/`ctx.hospitalAdminOf`
  directly; used inside `getCommissionAccessByOrgUncached` to compute `isTenancyAdmin`. This is
  narrower: the commission area's PRIMARY entry gate is a real, hat-aware RLS read
  (`commissions_select_member_or_admin`, confirmed live: every arm delegates to
  `has_role`/`has_role_any`-family predicates), so illegitimate ENTRY is not the concern here —
  a legitimately-entered member could get wrongly elevated `isTenancyAdmin` UI/nav if they
  ALSO structurally hold org_admin/hospital_admin under an inactive hat. The module's own
  comment claims RLS is the backstop for any resulting data access ("a false positive here is
  caught at every data door by RLS") — **not independently verified in this session**; flagged
  as unverified, not asserted safe.

**Confirmed SAFE, not merely assumed** — `src/app/o/[org]/nsp-org/layout.tsx`: its FIRST check
(`context.nspOrgAdminOf`) is equally hat-blind, but its "defense in depth" SECOND check
(`isNspOrgAdmin()` → RPC `is_nsp_org_admin_of_self` → `app.is_nsp_org_admin_of` →
`is_nsp_org_admin_of_for(org, uid)` → `app.has_role('organization', org, 'nsp_org_admin', uid)`
— traced live through all four hops) IS genuinely hat-aware (caller check, target=self), so this
guard denies correctly overall. Flagged as **fragile-safe**, not robust-safe: if that second
check is ever refactored away without the refactorer realizing it is the ONLY thing making this
guard hat-aware, this guard becomes vulnerable too.

**Not checked this session** (time-bounded, named rather than silently skipped): whether the raw
RLS-scoped DATA queries *within* each vulnerable area (e.g., `manage`'s sub-pages,
`qualidade/page.tsx`'s case board) independently re-deny via their own hat-aware doors —
`qualidade/page.tsx`'s own doc comment claims "re-gated at the data doors: the board door 42501s
a non-reviewer," which would mean the SHELL/nav renders wrongly but the case DATA might still be
correctly denied. This was **not verified**. Against this: my `/manage` repro showed live,
non-empty counts (Hospitais/Comissões/Respostas) and a fully populated, fully NAVIGABLE admin
console (Administradores, Trilha de auditoria) — this is unambiguous evidence of a real,
functional exposure at minimum for the org-manage area, whatever the qualidade case-board's own
data-layer posture turns out to be.

**What IS confirmed hat-gated, for contrast** — direct PostgREST/RLS reads: `GET
/rest/v1/commissions?organization_id=eq.<org>` for this exact persona returns 0 rows hatless, 4
rows under the org_admin hat (see the tester's own `act-role-assumption.spec.ts` "D5" spec,
green). The defect is specifically in the **application-level area-entry guards**, not in RLS
itself.

**Spec documenting this, left RED on purpose, not softened:** `e2e/act-role-assumption.spec.ts`
"The switch: assuming a hat then switching changes the landing route AND real authorization" —
asserts the INTENDED (ADR-correct) behavior; fails at `page.goto('/o/rede-a/manage')` after
switching to quality_reviewer, where the 404 heading never appears. Per the tester's own
mandate this is not softened to pass. **Blocks:** the ACT Stage 3 Phase Gate (this is the D5/D12
security claim the program exists to deliver) and `npm run e2e:prod`. Reported to lead + backend
same-session via SendMessage. Owner: lead to assign (backend, almost certainly — the fix shape
is adding an `activeRole` check at each vulnerable guard/helper, not a `session_context()`
change, since that RPC's hat-blindness is correct and load-bearing for the picker).

⬛ **BUG-ACT-PICKER-SEED-1 — RESOLVED 2026-08-10 (this entry was stale-OPEN; the lead audit
session reconciled it against the tester's own close-out row, `a8da28d` + the raw-grant pass,
and the live specs).** Disposition taken: option (a) — `actAs` threaded through every fresh
sign-in of the 5 pre-existing multi-role personas (15 cookie files + 22 raw-grant files, each
re-verified live per-file by the tester; `phase-multitenancy.spec.ts` deleted as redundant per
the coordinator's decision), plus one final straggler (`nsp-per-hospital.spec.ts`'s vestigial
hatless `admin@` sign-in) closed by the lead audit session in `169668d`. Seed personas keep
their 2 role types — that diversity is now load-bearing E2E coverage of the picker itself.
Original finding preserved below for the record:
The buildnotes' claim ("today this is safe by construction... the only principal holding two
role types is `dualhat.a@test.local`" — Stage 1 tester-half, the `accessToken` carry-forward
note) is **false**, verified against the live catalog, not assumed:
```sql
select m.principal_id, array_agg(distinct m.role order by m.role), count(distinct m.role)
from public.memberships m group by m.principal_id having count(distinct m.role) > 1;
```
→ **6** principals hold 2+ distinct role TYPES: `admin@test.local` (org_admin + pqs_member),
`orgadmin.b@test.local` (org_admin + staff_admin), `staff1.qual.b@test.local` (staff +
staff_admin), `solo.c@test.local` (hospital_admin + org_admin — 0 e2e references today,
dormant), `pqsdual.a@test.local` (pqs_member + staff), and the intended ACT fixture
`dualhat.a@test.local`. `getSessionContext()`'s `needsRoleSelection` (session.ts:323-324) uses
the identical grouping, so all 5 pre-existing personas now redirect to `/selecionar-perfil` on
every fresh sign-in — **confirmed empirically**: a raw password grant for `admin@test.local`
decodes to a JWT carrying no `active_role` claim at all.

**Blast radius** (files that sign in FRESH as one of the 5, not just mention the email — grep
`(cachedSignIn|signInAs|loginFresh)\(page, '<email>'`): `admin@test.local` → `nsp-per-hospital
.spec.ts`, `phase-multitenancy.spec.ts`, `phase13-audit.spec.ts`, `phase15-indicators.spec.ts`,
`phase2-auth-shell.spec.ts`, `phase3-admin-members.spec.ts` (6). `orgadmin.b@test.local` →
`phase-multitenancy.spec.ts`, `phase17-documents.spec.ts`, `qob-org-admin-content-wall.spec.ts`,
`user-registration.spec.ts` (4). `pqsdual.a@test.local` → `nsp-per-hospital.spec.ts`,
`perf-sweep-wave2.spec.ts`, `phase22-referrals.spec.ts` (3). `staff1.qual.b@test.local` →
`phase-multitenancy.spec.ts`, `technical-direction-referrals.spec.ts` (2).

**Confirmed live with two real runs, not just reasoning:** (1) `phase2-auth-shell.spec.ts`
"admin@test.local lands on /o/rede-a/manage" — this file predates the `e2e/helpers/auth.ts`
consolidation and has its own local `signInAs` (bypasses the seam entirely) — silently lands on
`/selecionar-perfil`, then times out on `toHaveURL('/o/rede-a/manage')`. This is a property of
the already-committed backend+frontend, independent of anything the tester changed. (2)
`qob-org-admin-content-wall.spec.ts` "orgadmin.b (org_admin of rede-b) still 404s..." — uses the
shared `cachedSignIn` — the tester's new `loginFresh` guard throws cleanly
(`landed on /selecionar-perfil with no actAs argument`), strictly better diagnostics than (1),
but the underlying test is equally broken.

**Why this is filed, not fixed:** these ~15 files span 8+ other programs (Phase 2/3/13/15/17,
multitenancy, NSP, QO·B, user-registration, referrals, perf-sweep) — none is ACT Stage 3.
Whether the right fix is (a) thread `actAs` through all ~15 call sites as ACT-Stage-3 cleanup,
(b) reconsider whether these 5 seed personas should hold 2 role types, or (c) something else, is
a coordination call. **Blocks:** `npm run e2e:prod` cannot be green until this is resolved —
does NOT block the tester's own 7 new ACT specs (they use `dualhat.a@` only with an explicit
`actAs`, and `multi@`/`chefe.ccih@`, both confirmed genuinely single-role-type). Reported to lead
+ backend same-session via SendMessage. Owner: lead to assign.

⬛ **BUG-ACT-NULLHAT-1 — RESOLVED same-session 2026-08-10 (`backend`, found running a manual
sanity check before writing Stage 3's pgTAP, fixed in the same migration).** The plan's own
§2 literal text — `... OR p_role = app.active_role())` — uses a plain `=` against
`app.active_role()`, which is NULL for any caller with no active hat. `TRUE AND NULL`
evaluates to NULL in SQL, not FALSE, and a PL/pgSQL `IF NOT has_role(...) THEN raise
exception ... END IF;` treats a NULL condition as false-ish — the guard silently did not
fire. **Reproduced live**: a hatless caller made `app.has_role(...)` return NULL (confirmed
`is null` = true), and a `do $$ if not has_role(...) then raise ... end if; $$` probe did
not raise — the exact fail-OPEN shape D5 exists to reject, on has_role, the enforcement
point D5 is written for. Both `has_role` (4-arg) and `has_role_any` carried the identical
pattern. **Fix**: `IS NOT DISTINCT FROM` (Postgres's NULL-safe equality — always TRUE or
FALSE, never NULL) in place of `=`, in both functions. Verified all 4 truth-table cells
(caller+hat / caller+no-hat / caller+wrong-hat / third-party) produce the SAME result as
before, now guaranteed non-null. Matches the pre-existing house pattern in `app.is_active`
(`coalesce(..., false)`, same rationale). Full finding + fix:
`docs/plans/act-as-buildnotes.md` Stage 3 §2.

⬛ **BUG-ACT-S3-CALLERGATE-1 — RESOLVED 2026-08-10 (found by the Stage 3 QA review as
BLOCKER-1 + MAJOR-1; fixed by the lead in `20260918002800` + keystone `318`).** A **FOURTH
class of hat-blindness**, distinct from the three the S3 build closed: **a boolean gate that
RECEIVES the caller's uid as a parameter instead of reading `auth.uid()` itself.** Two gates:
- **`app.is_admin_for(uuid)` (BLOCKER).** Its niladic sibling `is_admin()` got the D11
  active-role condition in `20260918002200`; this one was classified "third-party door,
  correctly hat-independent" — **from the signature shape, not the call-site binding**. Both
  of its only two callers (`grant_role_impl`, `revoke_role_impl`) receive `p_actor` from
  `public.grant_role`/`revoke_role`, which bind it to `(select auth.uid())`. So it **was the
  caller gate on the membership-grant door**: a platform_admin wearing any other hat could
  seat an `org_admin` or `hospital_admin` — the exact escalation D11 exists to refuse. Proven
  live pre-fix (`active_role='staff'` ⇒ `is_admin()`=false, `is_admin_for(self)`=true,
  `grant_role_impl` SUCCEEDED).
- **`app.can_manage_professional` (MAJOR).** Its raw `memberships` arm — the expired-
  staff_admin compensating clause Stage 2 preserved deliberately — carried no hat condition,
  so it admitted a caller not wearing `staff_admin`, gating **10 Class-2 professional-identity
  / ethics-vocabulary write RPCs**. ⚠ This means the S3 residual-closure claim ("the direct
  `memberships` criterion was sufficient") was **not literally true** — recorded rather than
  quietly amended.

**Fix:** the house CALLER-ONLY pattern already carried by `app.has_role` —
`and (<target> is distinct from auth.uid() or <hat> is not distinct from '<role>')` — so a
question about a THIRD PARTY is unchanged (ADR 0106 §2: one principal's hat must never alter
what the system concludes about another), and `IS NOT DISTINCT FROM` (never `=`) keeps it off
the BUG-ACT-NULLHAT-1 fail-open. `CREATE OR REPLACE` only; catalog property diff confirms
`prosecdef`/STABLE/ACL/`search_path` all byte-identical after.
**Verification:** keystone `318` confirmed **RED against the unfixed catalog on all four ⭐
DISTINGUISHING assertions** (incl. the real door: `grant_role` succeeded under the staff hat)
while all 7 controls passed — including the third-party invariant and the break-glass
`lives_ok`. Post-fix: pgTAP **179 files / 5690 tests PASS** (+1 file, +11 tests — exact
reconciliation), ARM=census 450/461 HOLD, ARM=floor 80 HOLD, **diff-scoped door sweep over
exactly these 2 gates: 2 COVERED / 0 BLIND / 0 ERROR**. Provably a **no-op on the E2E seed**
(catalog-verified: 0 expired memberships ⇒ the raw arm cannot fire; 0 `is_admin` principals
hold a membership ⇒ the caller path is unchanged), which is why no existing test could have
caught either one — the same argument D11 rests on, now with a keystone behind it.
⚠ **Expiry PREDICATE deliberately unchanged — but the OUTCOME moved for one population, and
the original wording here ("expiry semantics UNCHANGED") did not cover it** (QA r2 MINOR-4(1);
corrected rather than quietly reworded). An expired staff_admin still passes the arm *when
correctly hatted*, so the quirk survives — but only in the **cross-org** shape (live
`staff_admin` elsewhere ⇒ implicit hat, plus an expired one in the target org). An
**expired-ONLY** principal can never obtain the hat, so for them the arm is now permanently
unreachable: BUG-ACT-EXPIRY-1's own tightening, arriving early for its main population, via
the hat rather than via expiry. Safe direction; **not** undone. See the scope-narrowing note
on BUG-ACT-EXPIRY-1 below. Keystone 318 assertion 10 pins the surviving shape against a
**reachable** state (implicitly-derived hat, no synthetic claim), so a future "simplification"
of the clause still reds.
⚠ **Break-glass citation corrected (QA r2 INFO-5):** `platform-org-admin-provisioning.spec.ts`
3/3 is **NOT** evidence for this fix and must not be cited as such — it drives `grant_role_for`
(the SERVICE door, no `authenticated` in its `proacl`) on the service client where `auth.uid()`
is absent, so it takes the THIRD-PARTY arm the fix structurally cannot touch; it would be green
before, after, and after a *broken* fix. The real break-glass coverage is **keystone 318 #8**.
Structural point worth keeping: `assignOrgAdmin`, the platform admin's real provisioning path,
runs on the service client and was **never** exposed to the hole — the hole lived on
`public.grant_role`, the `authenticated` PostgREST door. Architecture Rule 1 in one sentence:
the TS layer was never the boundary.

⬛ **BUG-ACT-CLAIMSFOR-1 — RESOLVED 2026-08-10 (`backend`, found running ACT Stage 2's
diff-scoped door sweep; fixed in the same session, not a migration).** `supabase test db`
could not be run twice against the same `supabase db reset --local` without erroring —
`00_setup.sql (Wstat: 768, exited 3), Parse errors: No plan found in TAP output`, `Result:
FAIL` with a Files/Tests count *below* baseline. **Cause:** ACT Stage 1 (2026-08-09) changed
`test_helpers.claims_for` in `supabase/tests/00_setup.sql` to `drop function if exists
test_helpers.claims_for(uuid, boolean); create function test_helpers.claims_for(uuid,
boolean, text) ...` — a plain `create function`, not `create or replace`, to solve a
real 2-arg->3-arg overload-collision risk. That fix is correct exactly once: on every
`supabase test db` run *after* the first (no reset in between), the `drop` targets an
overload that no longer exists (no-op) and the plain `create function` collides with the
now-resident 3-arg signature. **Why the standing gate structure never caught it:** CLAUDE.md
§6 step 1 requires pgTAP on a **fresh** reset, which is exactly the one condition under which
this defect is invisible (a fresh reset always looks like "the first run"). The ADR 0079
door-audit harness (`p0-authz-door-audit.sh`) is the one tool in this repo's protocol that
calls `supabase test db` **repeatedly against one reset** — its own preflight comment assumes
this is safe ("no pgtap preflight here... `supabase test db`... creates/drops
test_helpers ITSELF per run"), and that assumption was false as of Stage 1. Reproduced
deliberately twice (fresh reset -> PASS -> immediate rerun, no reset -> FAIL, both times) to
rule out a one-off flake before fixing. **Fix:** `supabase/tests/00_setup.sql` — kept the
one-time `drop function if exists test_helpers.claims_for(uuid, boolean)` (still needed for
the arity-changing 2-arg->3-arg transition, which `CREATE OR REPLACE` cannot itself absorb),
changed the `create function` to `create or replace function` (idempotent once the 3-arg
signature is resident — unlike the arity change, a same-signature replace is always safe).
**Verified:** fresh reset -> 3 consecutive `supabase test db` runs, no reset between any,
all three `Files=175, Tests=5636, Result: PASS`; re-confirmed as part of the Stage 2 gate
(run 1 fresh + run 2 no-reset, both PASS, identical counts) and a 4th time by the
diff-scoped sweep's own preflight succeeding. Full mechanism + reproduction:
[act-as-buildnotes.md](../plans/act-as-buildnotes.md) Stage 2 §6.

---

# S4 — D14 arm audit + record — ✅ COMPLETE

**Rotated out of PROGRESS.md at the Phase Gate step-5 Record, 2026-08-10**, after S4 passed all
five gate steps. Branch `feat/act-as-stage-4` off `main` `5204f1e`.

**Gate:** pgTAP **180 files / 5707 tests** PASS (fresh reset) · `e2e:prod` **GATE GREEN** — 1057
passed / 0 failed / 0 did-not-run / 17 of 17 batches; 5 INFRA re-runs all green on retry;
coverage 1059 of 1064 reconciles **exactly** to 5 deliberately-skipped tests (`TOTAL_SEEN`
excludes skips by construction — it is NOT 5 unrun tests) · `ARM=census` 450/461 HOLD ·
`ARM=floor` 80 HOLD · **`ARM=hat`** 3 findings ≡ allowlist, self-test **6/6** · lint 0/0 · tsc ·
Vitest **1218**. **Diff-scoped 0079 door sweep NOT owed** — S4 shipped zero migrations, zero RLS
changes, zero `prosecdef` changes (confirmed from the diff by QA, not asserted).

**QA:** [act-as-stage-4-review.md](../reviews/act-as-stage-4-review.md) — **APPROVED (r1)**,
0 BLOCKER / 0 MAJOR / 6 MINOR / 3 INFO. Human-approved 2026-08-10.

## Scope as delivered

Plan [Stage 4](../plans/act-as-role-assumption.md) (line 222) plus the S3 r1/r2 MINORs, stated
exactly (S4 QA MINOR-1 — a scope claim that outruns what shipped is decoration): **S3 MINOR-1**
→ task S4-5; **S3 MINOR-2** (the "grant-serialization leak" overstatement) → record corrected in
this file; **S3 MINOR-3** → folded into `FUP-ACT-DISPOSE-UI`, not S4's to close.

| # | Task | Owner | Outcome |
| --- | --- | --- | --- |
| S4-1 | **D14** — `_case_caps` audited arm-by-arm FROM THE CATALOG | backend | 5 role arms (S1/S2/S5/S6/S7 → `has_role`/`has_role_any`) + 3 relationship (S3 grant / S4 assignment / STEP-4 denies); STEPs 1–3 are preconditions, not arms; **no hybrid, no arm unclassified**. QA re-derived completeness **mechanically** — 11 `v_caps := v_caps` sites in `prosrc`, partitioning exactly as the 8 arms: a PROPERTY, not a list. Table → `docs/backend-state.md` § ACT |
| S4-2 | pgTAP keystone `319` | backend | `ad387eb` — 17/17. Exact masks 111/64 → 127/94; bit-16 pre-grant negative control; **in-file mutation twins** on `has_role` (collapses to 111) and `has_role_any` (64→66) with byte-identical restores; hatless D5×D6 = 30; third-party disarm = 127; recusal zeros. Every value probe-measured before writing. QA neutralized both twins and observed them go red |
| S4-3 | The DESIGNED hat-blind doors → reasoned allowlist | backend | `d368f9f` — NEW artifact `act-hat-blind-allowlist.txt`, deliberately NOT the 0079 BLIND file (designed behaviour vs coverage debt — ADR 0107 D1). Sweep found **four**, not the plan's two: `session_context`, `assume_role`, `memberships_select` self arm, + `service_role` as a header class-note (unkeyable by construction, so a keyed entry would be a permanent ghost). All four upheld by lead + QA. Each entry carries a "wrong the day" invalidation condition; the lead added the **whole-object-vs-one-arm** clause to `memberships_select` and (per QA MINOR-5) to `session_context` |
| S4-4 | The endorsed **standing sweep**, executable + gate-wired | backend | `d368f9f` + `edde762` — `act-hat-blind-sweep.sh` wired as **`ARM=hat`** of `p0-authz-invariant.sh` (~10 s, in `ARM=all`). Amendment-6 method: balanced-paren argument extraction, `name(` edges with identifier-boundary guards, transitive caller-boundness to fixpoint. **Self-tests 6 specimens EVERY run**; ST5/ST6 (blind + covered cross-table POLICY pair) added closing QA MINOR-2 — the policy `else` branch previously had three live specimens, *all negatives*, so a branch returning `false` always would have looked identical. Ghost and new-finding directions both mutation-proven. **CLAUDE.md §6 names `ARM=hat`** (human-approved) |
| S4-5 | QA MINOR-1 — the dead `navScope` branch | frontend | `7429919` — arm REMOVED (fails **closed**: a widened principal drops to the narrower `"member"`) and the `SidebarNavScope` union member deleted, so re-lighting is a deliberate type-level act. Tripwire `nav-scope-exclusivity.test.ts` drives the **real** derivation over the role vocabulary read from `memberships_role_check` at test time; proven red against **both** seams (the `getSessionContext` hat filter, 10 red; `partitionGrants` bucket disjointness, 2 red) plus a falsifiability control. Removal chosen over a runtime `throw`: a throw in a Server Component layout 500s real users *after* a widening ships |
| S4-6 | **Record** | lead / qa | ADR 0106 gains the PO ratification (P1–P6), built status, the two cutover debts, the **D5 correction** and the **D6 six-member enumeration**; ADR **0107** created; QA review filed; CLAUDE.md §6 `ARM=hat`; this rotation |

## What S4 corrected in the record (both were load-bearing)

1. **The auth-hook blast radius — EVERY user, not just multi-role.** Both PROGRESS.md and ADR
   0106 said a missing Cloud hook would strand "every multi-role principal". **That understates
   it.** D11's implicit single-role derive lives **inside** `custom_access_token_hook`'s `else`
   branch, so with no hook *nobody* gets an `active_role` claim; `app.active_role()` returns NULL
   and `has_role`'s caller-bound `p_role is not distinct from app.active_role()` is false for
   every non-null role — fail **closed**, for everyone. Measured on a single-role persona with
   the claim absent: `active_role()` NULL, `has_role(staff_admin, self)` false, commissions
   visible **0**. Deploy sequencing risk moves from "some users degraded" to "the application is
   down". *(Found by backend; verified independently from the hook body + the `has_role` catalog
   definition. The lead's own ADR text carried the same understatement and was missed by a
   single-line grep because the claim wraps across two lines.)*
2. **ADR 0106 D5's headline was literally false as built** (QA MINOR-4). It read *"no active role
   means no role at all — the request sees what a stranger sees."* A stranger resolves
   `_case_caps` = **0**; a hatless grantee resolves **30**. It now states the invariant the build
   actually enforces: **no active role means no ROLE-derived reach; per-object relationships (D6)
   are unaffected, including in the hatless state.** D6's enumeration likewise grew from four
   predicates to **six** with the *property* stated (QA MINOR-3), so the list is no longer the
   boundary — the same failure class as *"an enumeration's boundary must be the property"*.

## The A13 ruling (PO, 2026-08-10)

**KEEP THE AS-BUILT BEHAVIOUR.** A hatless multi-role principal retains **read-only** per-case
relationship reach — mask **30** = `read_case_deliberation | read_case_content |
read_standard_phi | read_restricted_phi`, including the Rule-12 PHI bit. **No write bit
survives** (32 `write_case_content`, 64 `manage_case_access` both absent), so no mutation can
ever be recorded with an empty `acting_as`. `is_active` and recusal still zero everything in the
hatless state (A15–A17). Rationale: an ACL grant names a **person**, so no principled hat could
own it; the only implementable alternative is "requires *some* hat", which is friction rather
than a security property. Minimum-necessary is served by the grant's shape, not the hat — the
PHI bit is *narrower* than the S1 role arm that confers the identical bit.

**Pinned by keystone `319` A13 — a future re-ruling must consciously turn it red.** Open
consequence, deliberately not built (it needs a migration, and it dies if the ruling ever
reverses): **`FUP-ACT-HATLESS-AUDIT`** — `audit_write` adds `acting_as` only when
`active_role()` is non-null, so the KEY is *absent*, conflating hatless / pre-ACT /
service-role. Rule 11 is met (the row records *that* and *who*); this is legibility.

---

# Merge, push & the two deploy debts

*Rotated out of PROGRESS.md § Current Phase Tasks 2026-08-10. This section supersedes every
"local-only, nothing pushed" note earlier in this file.*

## Merged + pushed

| What | Merge | State |
| --- | --- | --- |
| **ACT S0–S3** | `ff0e76a` — *Merge ACT — "act as" strict role assumption (ADR 0106, S0–S3)* | ✅ merged to `main` + **pushed** 2026-08-10 |
| **ACT S4** | `ac4a270` — *Merge ACT S4 — D14 arm audit, standing `ARM=hat` sweep, reasoned allowlist (ADR 0106/0107)* | ✅ merged + **pushed**; `origin/main` = `f3981a5` (the graphify refresh, its own commit), verified in sync after `git fetch` — 0 ahead / 0 behind |

**The green bar was re-run ON EACH MERGED TREE, not inherited** — merging is a new combination
nobody gated (the S3 lesson):

- **On `ff0e76a`:** lint 0/0 · tsc · Vitest **1197** · `next build` EXIT=0 · **345 migrations
  registered == 345 files** · pgTAP **179 files / 5690 PASS**.
- **On `ac4a270`:** lint 0/0 · tsc · Vitest 82 files / **1218** · `next build` EXIT=0 · **345
  registered == 345 files** · pgTAP **180 / 5707 PASS** · `ARM=census` + `ARM=hat` + `ARM=floor`
  all HOLD.

The ACT push carried **56 commits** — the whole ACT program plus everything previously held back
(the PDF·P2 merge, FUP-PDF-1, the rotations). ⚠ Local `main` was **3 commits BEHIND** `origin` at
merge time (three same-day user pushes: audio-minutes callback flag, deployment env docs,
`/verificar` prerender opt-out); those were fast-forwarded in first, and the bar above was earned
on the merged combination.

## ⚠ Process note — a teammate pushed to `origin/main` twice mid-stage

The `backend` teammate pushed during S4 (19:10 cherry-pick `2cb9e5b`; 21:30 direct `fd5820c`)
**despite an explicit "do NOT push" in both task prompts**. Both commits are correct and were
kept — the auth-hook blast-radius correction, and the fact that `active_role_selections` lives in
**`app`**, not `public`, so PostgREST offers no route to it at all. But they reached `origin`
**without passing any gate**, and they made local `main` diverge from the branch, which is why the
S4 merge needed a conflict resolution.

Reinforces the standing rule: **verify `git branch --show-current` before every commit — and a
teammate's push is the lead's to make.**

## ✅ The two deploy debts — BOTH DISCHARGED 2026-08-10

Neither was ever S4 scope, and no code work moved either — both were user/PO actions, and the user
performed them.

1. **Remote `db push`** of the ACT migration set (`20260918000000`–`…20260918002800`) — ✅ **done.**
   Verified against `supabase_migrations.schema_migrations`, not from this text: **11/11** ACT
   migrations applied, newest `20260918002800`, and the remote total is **345 == 345 local files**.
   The same push carried the two PDF·P2 migrations (`20260914*`) and the 12-migration QO·B wave
   (`2026091[5-7]*`), discharging three separately-tracked holds at once.
2. **ENABLE `custom_access_token_hook` on Supabase Cloud** — ✅ **done; user-confirmed working.**
   Catalog-verified on the remote: the function exists as `SECURITY DEFINER` with EXECUTE granted
   to `supabase_auth_admin` and **not** to `authenticated`. (The GoTrue-side "hook enabled" switch
   is project config, not catalog state — that half rests on the user's confirmation plus the fact
   that sign-in works.)

**The remote is cut over.** What this closed, kept because it is the reason the item was 🔴 and not
🟡: `config.toml`'s `[auth.hook.custom_access_token]` is **local-only config**, so `db push` never
covered it — and the failure mode was **total, not partial**. Without the hook the remote mints no
`active_role` claim, and D11's implicit single-role derive lives *inside* the hook, so **every** user
would have been a stranger, not just multi-role ones. Measured while it was outstanding:
`active_role()` NULL, `has_role(staff_admin, self)` false, commissions visible **0**.

⚠ Standing consequence of the unflagged cutover (P4): it **forces re-login** — stale pre-cutover
sessions see stranger-level nothing until they sign in again.

Live tracking: both items were REMOVED from PROGRESS.md § *Remaining pre-pilot work* on 2026-08-10 as
fully concluded; only the **Coolify app deploy** remains there (item 1). This file is now the durable
record of the ACT cutover.


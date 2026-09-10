# GRANT-PLANE-CONVENTION — progress record

The per-object grant plane convention, ADR
[0205](../decisions/0205-per-object-grant-plane-convention.md). The unit's **summary** is its hub,
[docs/features/grant-plane-convention.md](../features/grant-plane-convention.md) § Current state;
this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `public.case_access_grants` and everything that reads it, `app._case_caps` S3,
`public.grant_case_access` / `revoke_case_access` / `list_case_access`, `app.is_tenancy_admin_of_for`,
`app.grant_role_impl`'s commission branch, `src/lib/case-access/actions.ts`, the nine other
grant-shaped tables classified in ADR 0205 D11, the `authz` catalog (5 tables; `scope_kind` and
`resolution_scope_kind` domains; `assignment_facts`, `entailed_grants`, `has_permission`),
`securable_resources` (9 types), and the seam file `docs/backend-state/cases-and-ethics.md` — all as
they exist in the **live catalog** (⛔ never migration text — ADR 0078).

## Session log

### 2026-09-10 — analysis, grilling, ADR, and the two pre-pilot fixes opened (lead)

**Preconditions, measured:** `main` @ `eb52f1c1`, tree clean; migration head `20261003007360`;
highest pgTAP `415`; `docs/decisions/INDEX.md` next-free `0204` **reserved** by
`docs/plans/pre-ae5-remediation.md` (the `D` ceiling / `search_path` pair) and `0202` an unfillable
hole ⇒ this ADR is **0205**, as that plan instructs.

**What was measured before anything was decided** (two Explore agents + lead catalog reads):
the case ledger's 18 columns / 12 CHECKs / 3 partial indexes / own-row policy / `authenticated = r`
ACL; `_case_caps` with sources S1–S8; consumer surface `can_read_case` 18 policies,
`can_write_case_content` 3, `is_case_excluded` 16, `has_case_capability` 0 policies (12 functions);
**seven** direct readers of the ledger outside the resolver; 27 pgTAP files; the nine other
grant-shaped tables and which policy/predicate consumes each (`referral_assignments`: none, by
ruling); the `authz` catalog at 12 roles / 43 permissions / 42 role-permission rows, resolution
kinds `commission` + `organization` only, `assignment_facts` reading `memberships` + `is_admin`
only; `securable_resources` pinning every referral to its **source** commission (3/3 seed rows);
`meetings.visibility_policy ∈ {commission_default, participants_only}` with reach = member ∧
(default ∨ attendee); `can_read_interview` = case read ∧ ¬oversight-only ∧ clearance;
`grant_role_impl`: only a tenancy admin seats a `staff_admin`, no self-seat, no last-coordinator
guard; **two** seeded coordinator-less commissions (Ética, Segurança A2); the org-admin door arm's
recorded reason in ADR 0078 (*sole coordinator recused/respondent*), not the absent coordinator;
`authorizeCommission` admits `platform_admin` (door refuses) and omits tenancy admins (door accepts);
the door's PHI parameters sent by no TS caller. Dead end recorded: the first grep for the
deadlock rationale hit only D5·6's restricted-PHI "deadlock"; the door arm's reason lives ~1,000
lines later under *"The deadlock, and the PO's resolution"*.

**The grilling.** Round 1 (Q1–Q10): goal order, root-only ledgers, participation never mirrored,
catalog-named abilities, five mandatory columns, grantee rule, timing, the two case fixes, scope,
audit convention — all accepted except Q8, where the PO first chose to **remove** the org-admin arm
on the premise "a commission always has a coordinator". Round 2 re-asked Q8 with the measured
reason (the recused sole coordinator) → the PO **kept the arm** (a); asked whether to *enforce*
coordinator presence → PO chose **practice, not rule** (b); settled Q11–Q20 (app check mirrors the
door; narrowing read-only; attendees keep implicit read + reserved-session list folds in; referral
receiving side only; allow-list for the two capability planes; scaffold as a script; roster with the
first ledger; two-level UI; door refuses terminal write grants). Round 3 (Q21–Q26): fallback arm on
every root's door; administrativo never grants; typed provenance FKs; Fix 1 pre-pilot; ADR + rule
file; the three code-less case abilities stay domain-only. PO: *"Agreed. Proceed."*

**Written this session:** ADR 0205 (237 lines; Amends 0155 D7 and 0078 on three named points) ·
`.claude/rules/grant-plane-convention.md` (scoped `supabase/migrations/**`, four anchors) ·
`docs/phases/accreditation-track.md` Phase 18 + Phase 19 · `docs/quality-track-context.md` Phase 18
line · `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5` (parked) · this hub + record.

**Delegated:** `backend` (Opus) — Fix 1 (`20261003007370`, D9 door refusal, live-body re-emit,
new `HC` code), Fix 2 (`authorizeCommission` mirrors the door via `src/lib/queries/`), pgTAP `416`
RED-first, the seam slice, and the gate commands reported bare. Its report is appended below when
it lands.

**`backend` report landed (same session).** Files: migration `20261003007370_grant_door_refuses_write_on_terminal_case.sql`;
pgTAP `416_grant_plane_case_door_fixes.sql` (plan 23); `src/lib/case-access/actions.ts` (`authorizeCommission`
rewrite, `HC0U0` → pt-BR, stale header corrected); `src/lib/case-access/actions.test.ts` (14 cells);
`src/lib/queries/commissions.ts` (`getCommissionTenancy`); seam slice + replaced Current state in
`docs/backend-state/cases-and-ethics.md` (99/100 lines); `HC0U0` registered in `conventions.md`
(derived from the UNION of catalog, repo and docs — `HC0T5` lives only in migration-time `do` blocks,
`HC0T8/9` are claimed by a plan doc; next free `HC0U1`); `generated-query-modules.md` regenerated.
**416 RED-first:** pre-migration catalog rc **1**, `Failed tests: 10-12` (K1 "no exception / wanted
HC0U0", K1b `have: 1` — the door STORED the write grant on a completed case, D9's defect witnessed —
K2); post-migration rc **0**, 24/24. ⚠ Arms K5/K5b (ordering) are green before AND after —
re-labelled **CONTROLS**, honestly: an ordering cannot be red before the guard exists; their twin is K1.
**Gates, bare rc:** `lint` 0 (17 gates) · `typecheck` 0 · `test` 0 (152 files / 2070) · fresh
`npx supabase db reset --local` 0 · `test:db` 0 (265 files / **8946**) · `e2e/case-access.spec.ts`
0 (26 passed) · set-valued targeted home 0 (`3/3 COVERED`) · `SELFTEST=1` door-sweep self-test 0
(46/46, GNU bash 3.2.57 arm64). **Door sweep:** `SCOPE: 1 file(s) — 0 committed (HEAD..HEAD), 0 worktree,
1 untracked | filter: none | derivation: catalog` → exit **1**, `DOORS IDENTIFIED: 1. SWEEPABLE BY THIS
ARM: 0 — grant_case_access (prosecdef, returns void — outside PRED_DOMAIN)`; the owed **targeted**
mutation ran with the harness owning the DB: restore channel proven first, predicate-only
neutralization (`HC0U0` text kept, so a text checker stays blind), `test:db` rc 1 with **only** 416
§ K1/K1b/K2 red across 8946 tests, restore == capture by catalog re-read, `test:db` rc 0. Findings
baseline never opened (`git diff --stat -- docs/reviews/authz-door-audit-findings.md` empty).
**Lead corroboration:** live body re-read — `HC0U0` guard at the position ruled (after `HC021`, before
`_grant_case_access_unchecked(`), `prosecdef=t`, ACL `{postgres,service_role,authenticated}=X`
unchanged, head `20261003007370`; `npm run lint` rc 0, `typecheck` rc 0, `actions.test.ts` 14/14.
**Open edge, found and deliberately NOT fixed:** the tenancy-admin arm the door accepts is still
unreachable from the app — `grantCaseAccess` resolves the commission through an RLS read of `cases`
whose only SELECT policy is `can_read_case`, FALSE for a tenancy admin (ADR 0078 D4; S2 confers
`manage_case_access` only). Measured, recorded in the seam slice, and filed as
`FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE` (open, PO to rule the surface).
D12's security half — the `platform_admin` pass removed — is fully effective.
**Next:** the read-only `qa` review (spawned), then `gated` → PO → Record.

**`qa` verdict (same session): APPROVED — 0 BLOCK · 0 MAJOR · 2 MINOR · 4 INFO**
([grant-plane-convention-review.md](../reviews/grant-plane-convention-review.md)). QA re-derived every
`backend` claim from the live catalog and re-ran the targeted mutation itself (predicate neutralized
with the `HC0U0` text kept: `test:db` rc 1, only 416 § K1/K1b/K2 red of 8,946; restore == capture by
catalog `diff`; final fresh reset rc 0, head `20261003007370`). Requirements, security (guard
position, `prosecdef`/ACL/`search_path` unmoved, resolver untouched, kernel/self-grant/revoke/list
untouched), and the K5/K5b CONTROL re-labelling all confirmed. The open edge is graded a **finding
class, not a defect of this unit** — its follow-up pre-refuses both shortcuts (widening `cases_select`;
a content arm on S2), each of which would re-open ADR 0078 D4.
**MINORs cleared before Record (PO standing preference):** MINOR-1 — `authorizeCommission` now
carries the `is_active` conjunct both DB arms open with (`if (context.isInactive) return false`, the
sibling shape in `session.ts`); MINOR-2 — a rejected tenancy read in either action maps to
`MESSAGES.unavailable`, never `return false` (silent denial) and never an unhandled rejection.
Three cells added to `actions.test.ts` (inactive staff_admin refused; inactive org_admin refused;
tenancy read failure → pt-BR "unavailable", RPC never called): **17/17**. ⚠ A first MINOR-fix
subagent stalled on the stream watchdog at orientation with zero edits; the respawn carried the exact
edits in its brief and finished in one pass. Lead corroboration at the tip: `actions.test.ts` 17/17,
`npm run lint` rc 0, `typecheck` rc 0. No SQL moved after 416's GREEN run, so `test:db` stands.
**State:** `gated` — awaiting PO approval (§6 step 4) to go `complete` at the Record step.

## Current state

**Updated:** 2026-09-10 — ⭐ CUT from the hub at the Record step, verbatim (ADR 0186 D3); it describes the `gated` tip `e79f210f` the PO approved

### Objective

Record, as one PO-ruled convention, how every future per-user per-object grant is shaped and when
it is built — so Phases 18, 19 and 20 do not each invent a fifth shape — and land the two case-only
fixes the rulings ordered pre-pilot.

### Done since start

ADR 0205 (237 lines) · the rule file · Phase 18/19 and quality-track amendments · the follow-up
entry · hub + record. The grilling's 26 rulings are all in the ADR; three reversed the lead's
recommendation (Q8 → keep the arm, then Q12 → practice not rule; Q8's PHI half → off-screen).

### In progress

Nothing. Built, gated, QA **APPROVED** (0 MAJOR; both MINORs cleared, 17/17). One edge found and
filed, not fixed by ruling: `FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE`.

### Next

PO approval (§6 step 4). On approval: `complete`, this block cut into the record (ADR 0186 D3), the
follow-up on the tenancy path ruled or left open on its own clause.

### Blockers

⛔ **Status is `gated`, not `complete`, because PO approval has not been given** — the docs slice is
committed (`2dc220eb`), the code slice commits with this flip. ⚠ The build half of the convention is
**deliberately not started** (ADR 0205 D12) — the ruling, not a gap.

### 2026-09-10 — Record step (lead): PO approved; hub → `complete`; origin current

**PO approval:** *"Approved"*, given after the built / tests / QA / open-risks presentation and after
the two commits were already on `origin/main` at the PO's earlier instruction (*"commit your changes
and push to origin"* — a fast-forward `eb52f1c1..e79f210f`; ⚠ **a `git push` deploys nothing**:
Coolify auto-deploy is off, and migration `20261003007370` is **NOT on the remote database** —
`npm run db:push` + a remote-catalog check precede any manual Deploy click, per
`.claude/rules/push-schema-before-code.md`).

**What moved at the Record step:** hub `status: complete`, its `## Current state` block cut into this
record above (verbatim); `docs/features/INDEX.md` regenerated; nothing else — the two follow-ups stay
on their own clauses (`…-BUILD-AFTER-AE5` parked until AE5-complete + first consumer;
`…-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE` open, PO to rule the surface); no bug row was opened; no
lesson filed (the stalled-subagent respawn is already covered by the standing watchdog memory).
**Gates at the Record step:** `features:index`, `lint:registers`, `lint:progress` — rc quoted in the
commit. Committed as the Record-step commit and pushed.

### 2026-09-10 — documentation second pass (lead): the corpus made to say what ADR 0205 decided

**Method.** One Explore sweep over the canon, the seams, the plans, the phase specs, the design
docs, the registers and the three source headers, asked for four things — contradictions, missing
pointers, stale names, register hygiene — against D1–D12 stated one line each; plus the lead's own
targeted checks (router, glossary, AE7, lessons shape). Sweep yield: **5 contradictions · 16 missing
pointers · 7 stale-name sites · 3 hygiene nits · 2 glossary gaps**. ⚠ Three of the sweep's
"missing" items were already closed by the lead's edits made *while it ran* (authz seam, router
row, glossary block) — recorded so the count is not read as 16 defects found by the sweep alone.

**Closed (36 edits, 21 files).** ⭐ The **authz seam** gets the slice the Record step had skipped —
the very failure the AE5-opening Record step was corrected for — appended as `§ Per-object grant
plane` with three line-neutral Current-state edits (block at **100/100**, 0 left). `ARCHITECTURE.md`:
the grant-ledger posture bound to D5/D12, the closed-session reader list classified a FRAGMENT (D11),
the lattice split four-codes/three-domain-only (D4), `securable_resources` named the shared-trigger
anchor (D7), PHI-off-screen (D10), and *"OR admin"* corrected to **tenancy admin, never
platform_admin** (A2 — the one real contradiction in the canon). `CONTEXT.md`: **Grant**, **Securable**,
**Grant ledger**, **Participation record**, **Narrowing**, **Tenancy admin** defined, and the
`Assignment` avoid-list de-collided. Backend-state: router row (primary seam named, the rule file
named), `data-access.md` § Case-access doors appended **with its Current state re-stamped** (gate [I]
reded on the first attempt — history appended, projection not refreshed — and was obeyed, not
argued with). ADRs: 0205 now **Amends 0033** (D6 → D3/D9; back-pointer regenerated), inline forward
notes in 0078 (the arm re-affirmed with its second justification), 0114 D16, 0155 D7. Plans: AE5
item 6 and AE5-complete (release of the build follow-up), AE7 (the D6 door named), the capability-model
plan's reserved-`source` rows (D8), quality-office D14 break-glass, and four stale `case_access`
references in the pre-pilot scope plan dated and corrected. Phase specs: `accreditation-track.md`
:568/:612 mirror the D11 clause; dated banners on `case-generalization-evaluation.md` and
`ethics-e1-access-spine.md` (⛔ DDL untouched — it is the record). Registers: the break-glass follow-up
now names the case-root grant + typed FK (D2/D8) and the D12 bar. Source: three **comment-only**
corrections — `actions.ts` header (flag retired; `p_level` not `case_access.level`),
`case-access-panel.tsx` header (no flag), `e2e/case-access.spec.ts` :12/:583 (the DOOR refuses since
D9; the disabled control is UX only). ⚠ The spec and the panel are tester- and frontend-owned; the
edits change no behaviour and no assertion, and are declared here rather than smuggled.

**Deliberately NOT done, with reasons.** (a) No lesson row: the honest `Enforcement` would be `prose
only` and the `lessonsProseOnly` ratchet stands at 52/52 — a new prose-only row reds the gate, and
lowering nothing to admit it would be the inversion ADR 0186 D6 forbids; the candidate ("mirroring a
gate is not mirroring the path in front of it") lives in the tenancy-path follow-up's own text.
(b) No `[0205]` tag on PROGRESS.md's Phase 18/19 rows — cell-capped, low value, the phase specs carry it.
(c) No rule-file register in `docs/INDEX.md` — none exists for any rule; the router row names the file
where a builder stands.

**Gates at the tip, bare:** `npm run lint` **0** (17 gates; eslint 0/0 incl. the three touched TS/e2e
files) · `typecheck` **0** · `lint:backend-state` **0** (largest seam 141.3 KB, warn 160) · `adr:index`
**0** (back-pointers: 0033 updated) · `lint:adr-index` **0** · `features:index` **0** · `lint:registers`
+ `lint:progress` **0** (quoted in the commit). Committed as the second-pass commit and pushed.

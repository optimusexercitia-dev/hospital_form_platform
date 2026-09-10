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

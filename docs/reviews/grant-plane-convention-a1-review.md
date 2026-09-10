# QA Review — GRANT-PLANE-CONVENTION-A1, Fix 3 (`public.grant_case_access` refuses a self-grant)

**Reviewed:** the uncommitted working tree on `main` (base `18f2fc7f`; amendment-only commit already
landed).
**Reviewer:** qa. **Date:** 2026-09-10.

**Verdict: APPROVED**

**0 BLOCK · 0 MAJOR · 0 MINOR · 3 INFO.** I re-derived every load-bearing claim in the `backend` /
`frontend` reports and the ADR's own D6·5·1 correction paragraph directly from the live catalog —
not one of them needed adjustment. I independently reproduced the RED-first mutation (fresh reset,
capture, neutralize, `test:db`, restore, re-reset) and got **the exact same 8 reds in the exact same
two files at the exact same test numbers** the record claims: `417` 7/34 (tests 6–8, 12, 16–18) and
`235` 1/44 (test 31), nothing else across 8,982 tests. The guard sits exactly where D6·5·1 rules it
must, the kernel/`create_case`/`revoke_case_access` are measurably untouched, and the unit's own
correction of its ADR's premise (the tenancy-admin arm was never reachable; the coordinator arm was
the live one) checks out to the letter on `app.has_role`'s live body.

---

## Scope and method

Read: CLAUDE.md (already in context), `docs/learning/LESSONS.md`, ADR 0205 in full including §
Amendment 1 and the ⚠ correction paragraph under D6·5·1, the hub
`docs/features/grant-plane-convention-a1.md`, the record `docs/progress/grant-plane-convention-a1.md`
(every session-log entry), the prior unit's review `docs/reviews/grant-plane-convention-review.md`
(the form followed here), the migration, `417`, the amended `235`, `src/lib/case-access/actions.ts` +
`actions.test.ts`, `src/components/cases/case-access-panel.tsx` + `case-access-button.tsx` +
`case-access-panel.test.tsx`, the `(detail)/layout.tsx` diff, and the three doc diffs
(`cases-and-ethics.md`, `conventions.md`, the ADR).

**Re-measured on the live catalog** (`supabase_db_azkbbhskturikxpgmafq`; ⛔ never from migration text
— ADR 0078), on a **fresh** `npx supabase db reset --local` with the migration applied:

| what | measured | verdict |
| --- | --- | --- |
| Guard position in the live body of `public.grant_case_access` | `if p_user = auth.uid() then … errcode = 'HC0U1'` sits immediately after the `42501` authority disjunction and `app.assert_not_case_excluded(p_case)`, and before `p_level not in ('read','write')`, `app.is_member_of_for` (`HC021`), `p_expires_at <= now()`, `app.case_is_terminal` (`HC0U0`) and the kernel call | exactly D6·5·1's ruled position |
| `prosecdef` / `proconfig` / owner / volatility / ACL of the door | `t` · `search_path=app, public, pg_catalog` · `postgres` · `v` · `postgres=X/postgres service_role=X/postgres authenticated=X/postgres` | unmoved |
| Every function anywhere mentioning `HC0U1` | **1** — `public.grant_case_access` | no spill |
| `app.has_role` / `app.has_role_any` live body | carries `(p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())` / `… or m.role is not distinct from app.active_role())` verbatim (BUG-ACT-NULLHAT-1) | the ADR's correction paragraph is accurate — this is the conjunct that closed the tenancy-admin arm incidentally |
| `app.is_member_of_for` | `app.is_active(p_user_id) and app.has_role_any('commission', p_commission_id, p_user_id)` | confirms the collapse the correction describes |
| `public.create_case` | `if not (app.is_staff_admin_of(p_commission_id)) then perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant'); end if;` | confirms the coordinator-skip claim exactly; the creator self-grant is READ-only, no PHI params |
| `app._grant_case_access_unchecked` (the kernel) | inserts with `source = 'manual_grant'`, takes `p_reason_code` as its own column | confirms "the string names the REASON column, not the SOURCE column" |
| `app._case_caps` S2 comment | `-- S2 · org_admin — manage_case_access ONLY (A4 removed content/deliberation).` | matches the "reads nothing" characterization used to size the escalation |
| `door-sweep-targets:` line, migrations 7370 vs 7380 | byte-identical | no widening of the swept surface |

**Gates I ran myself, bare rc, on my own fresh reset:**

| gate | rc | detail |
| --- | --- | --- |
| `npx supabase db reset --local` (twice — before and after my own mutation) | **0**, **0** | fresh both times |
| `npm run lint` | **0** | full chain, incl. `lint:registers`, `lint:backend-state` (headroom shows `cases-and-ethics.md (99, 1 left)` — matches the claimed 99/100), `lint:data-access` |
| `npm run typecheck` | **0** | — |
| `npm run test` | **0** | `153 passed / 2080 passed` |
| `npm run test:db` | **0** | `Files=266, Tests=8982, Result: PASS` |
| `scripts/door-sweep-cases.sh 18f2fc7f` (deriver arm) | **1** | `SCOPE: 1 file(s) — 0 committed (18f2fc7f..HEAD), 0 worktree, 1 untracked \| filter: none \| derivation: catalog`; `DOORS IDENTIFIED: 1. SWEEPABLE BY THIS ARM: 0 — grant_case_access (prosecdef, returns void — outside PRED_DOMAIN)` — matches the record's "RULED, owed a targeted mutation" exactly |
| `SELFTEST=1 scripts/door-sweep-cases.sh` (selftest arm) | **0** | `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0` — identical group breakdown (20/18/8) to the record |
| **My own targeted mutation** of the live door — capture (`md5 94269d01…`), restore-channel proven, neutralize `if p_user = auth.uid() then` → `if false and p_user = auth.uid() then` (text `HC0U1` kept), `npx supabase test db` | **1** | `Result: FAIL`, `Files=266, Tests=8982` — **exactly 8 red**: `417_grant_door_refuses_self_grant.sql (Wstat: 0 Tests: 34 Failed: 7)`, tests **6-8, 12, 16-18**; `235_authz_a4_org_admin_not_case_source.sql (Wstat: 0 Tests: 44 Failed: 1)`, test **31** |
| Restore, catalog re-read | **IDENTICAL** | `md5 94269d01…` unchanged; final `db reset --local` rc **0** left the DB pristine |

`git status --porcelain` lists exactly the nine expected paths (2 untracked, 7 modified) and nothing
else: no AE5 file, no `securable_resources`/`authz.*` object, no new ledger, no permission code.

---

## 1. Requirements — does Fix 3 do exactly what D6·5·1 rules, and no more?

**MET, precisely.** The refusal is `p_user = auth.uid()` → `HC0U1`, positioned (measured, not
assumed) after the authority gate and the U1 exclusion and before level, membership, expiry and the
terminal check — refusing the **act**, so `read`, `write` and both SQL-only PHI parameters are refused
alike (`417` K1/K1c/K1d). The three "deliberately not touched" claims are each measured: the kernel
`app._grant_case_access_unchecked` and `create_case`'s creator self-grant path are unchanged (I read
both bodies directly, confirmed the coordinator-skip guard and the kernel's insert shape);
`revoke_case_access` is unchanged and self-revoke stays legal (`417` §G); `app._case_caps` carries no
lifecycle or self-grant term (ADR 0078 A24·3 untouched). The migration performs exactly one
`create or replace` (`git status` confirms a single new migration file, and the migration's own
landing assertions — which I read in full — check the anchor occurs exactly once and that nothing
pre-existing was lost).

**No scope creep.** Nothing from D12's "after AE5-complete" list appears in the diff — no ability
catalog, no shared trigger, no scaffold, no `securable_resources` contact.

## 2. Security / RLS

- **The position is the security property**, enforced identically at three layers: the migration's
  own re-read assertions, the live body (which I read directly), and `417` §E (`K6`: a principal with
  **no** standing self-granting still gets `42501`, never `HC0U1` — the ordering control, correctly
  labelled a CONTROL rather than a keystone since it is green before and after the fix).
- **`prosecdef` beside `pg_policies`**, as the method requires: `t`, unchanged, checked by the
  migration, by `417` §H (K9a–K9d: `prosecdef`, `search_path`, both EXECUTE grants, and the
  no-`=`-ACL-item PUBLIC posture), and by me post-apply. No RLS policy, no table grant, no trigger
  touched.
- **The build-time correction is itself correctly scoped as door validation**, not a resolver change
  — it narrows nothing in `app._case_caps`, so ADR 0078 A24·3 still holds.
- **The correction is honest and, on independent re-derivation, accurate in both directions.** The
  clause D6·5·1 was ratified against a tenancy-admin escalation that measurement (both `backend`'s and
  my own, against the live `app.has_role`/`has_role_any` bodies) shows was **not** reachable —
  `is_member_of_for` collapses onto the caller's own ACT hat for the self grantee, so the two gates
  (tenancy authority, self-membership-visibility) can never both pass in one session. The arm that
  **was** open — a coordinator self-granting, including issuing herself `read_restricted_phi` through
  the door's SQL-only PHI parameters under D5·6 — is the sharper escalation, and the remedy (refuse
  `p_user = auth.uid()` outright, before any of these gates) closes both arms regardless of which one
  a reader believes is live. **This is LEARN-056 applied correctly**: the ruling's prescribed remedy
  was tested against real data before being taken as a spec, the premise was found wrong, and the
  finding was written into the ADR under the clause rather than silently adapted around.

## 3. Tests — is `417` falsifiable, and is the classification honest?

**Yes on both counts, and I proved the first myself rather than trusting the record.** My independent
mutation — capture, neutralize the predicate only (keeping the `HC0U1` string so a text-shaped checker
stays blind), full `test:db` under the mutant, restore, re-verify identical — reproduced **the exact
same 8 reds at the exact same test numbers** the `backend`/lead measurements report, out of 8,982
tests. That is about as strong a falsifiability proof as this suite offers: not "the keystone reds
when mutated" asserted, but independently re-earned on a byte-identical mutation methodology.

**Keystone-vs-CONTROL labelling is honest.** `417`'s own header states plainly which arms are RED
before AND after (none), which are green before AND after and are therefore CONTROLS/positive twins
(§D the open positive arms, §E the ordering pin, §F the kernel twin, §G the revoke twin, §H the shape
arms), and which are the actual RED-first keystones (K1/K1c/K1d/K2/K3/K3c/K3b) — matching exactly the
8 reds I reproduced. §D's positive twins (K4/K4b tenancy-admin-grants-someone-else, K5/K5b
coordinator-grants-someone-else with `K5b` proving real resolver reach, not just an inert row) are the
required pairing per §7.7 for a narrowing test, and none of them is mislabelled as a keystone.

**Fixtures are sound.** The case id is fixed (`00000000-0000-0000-0000-000000417001`), never
seed-random (the LEARN class this repo has been burned by before). Every pre-flight (`P0`–`P8`) runs
inside the caller's own session via `test_helpers.claims_for` + `set local role authenticated`, not as
`postgres` — the file's own header records the dead end where the first draft got this wrong
(LEARN-003) and how it was caught.

**`235`'s amendment is the LEARN-023-correct move**, verified by diff: the single old assertion
(self-grant expecting `HC021`, captioned as the membership bound) is split into a pre-flight-backed
`HC021` assertion against a genuine non-member non-caller (`sa_y`) and a new `HC0U1` assertion against
the actual self-grant (`st_y` granting to himself) — so the membership bound stays asserted by
something, and the self-refusal gets its own witness. `plan(42)` → `plan(44)`, confirmed by the diff
and by my mutation run (`235` test 31 is exactly this new cell).

## 4. Code quality

`strict` respected; no `any`, no `@ts-ignore`/`@ts-expect-error` in any of the touched TS files.
`authorizeCommission` and `commissionOfCase` are unchanged by this fix (the tenancy-arm re-alignment
was the prior unit's Fix 2). The new `actorId` prop threads with no new query —
`access.context.userId` in `(detail)/layout.tsx` is data the layout already loaded — and
`grantableMembers` gains one conjunct (`m.userId !== actorId`) beside the existing
`role !== "staff_admin"` filter. File ownership respected: `backend` touched only backend-owned
paths, `frontend` only `src/components`, and the two worked on disjoint files as the hub records.

## 5. UX & a11y

pt-BR throughout. `MESSAGES.selfGrant = "Não é possível conceder acesso a si mesmo."`, mapped by
SQLSTATE (`HC_SELF_GRANT = 'HC0U1'`) alongside the existing `HC0U0` mapping — no raw Postgres text can
reach the UI on this path. `actions.test.ts` carries the required discrimination cell (`HC0U1`'s
message is asserted to differ from `HC0U0`'s, not merely to be "some pt-BR string") and a
level-independence cell (`read` also gets `HC0U1`, not just `write`) — both correctly target the
"act, not payload" framing. The picker change is purely a `.filter()` predicate addition; no new DOM,
no new focus surface, so no a11y delta — confirmed by reading the component, and
`case-access-panel.test.tsx`'s three cells (actor excluded even as a plain member; other members kept;
coordinator still excluded) are a real regression guard, using the exact exploit-shaped fixture
(a plain-membership row for the actor) rather than a role-based stand-in.

## 6. Hygiene

`HC0U1` is registered in `docs/backend-state/conventions.md` with its derivation stated (243 catalog /
265 repo / 271 docs, union), not just its conclusion — appropriate, since the row it sits below states
of itself that it has gone stale before. Next free `HC0U2`, correctly re-derived rather than
inherited. The `cases-and-ethics.md` § Current state block is **replaced**, not appended (confirmed by
diff), and the prior `§ Grant plane` slice is marked `⚠ Superseded` with a forward pointer rather than
edited in place — exactly gate 16's discipline for a frozen slice. ADR 0205's correction paragraph
sits appended under D6·5·1 with the ratified text kept verbatim, matching the house convention for an
in-place correction. The rule file is within its cap (1998 / 2048 bytes, measured). The PROGRESS.md
row (`GPC-A1`) was added in the prior commit and is unmodified here — correctly still `in progress`
pending this review + PO + Record. The `FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE`
follow-up is archived and the build follow-up's *Closes when* widened, both confirmed by grep against
the actual follow-up files. Phase 18's pgTAP line no longer says "per-round auditor write grant"
(confirmed at `docs/phases/accreditation-track.md:671`). `docs/decisions/INDEX.md` shows the
`⚠ amended by …, 0205` back-pointer on 0033/0078/0155 — `npm run adr:index` was run.

Every witness in the record's session log that I could independently re-measure, I did, and every one
matched exactly: `lint` 0/0, `typecheck` 0, `test` 2080/2080, `test:db` 266/8982 PASS, the deriver's
`SCOPE:` line and exit 1, the selftest's 46/46 group breakdown, and the targeted mutation's 8 reds at
the exact test numbers. The one witness I did not re-run is the set-valued targeted home
(`authz-setvalued-targeted-cases.sh`, claimed `CLEAN — 3/3`) — its three resolvers
(`authz.authorized_scope_ids`, `authz.candidate_authorized_scope_ids`,
`app.current_professional_read_organizations`) are untouched by this diff and outside this unit's own
Gate line in the hub, so I did not judge it necessary to reproduce; flagged here rather than silently
omitted.

## 7. INFO

- **INFO-1 — the picker fix's practical reach today is the coordinator arm, and that is correctly
  the live one.** `CaseAccessButton` renders only when `accessEnabled && isCoordinator`
  (`(detail)/layout.tsx:319`), so a tenancy admin never sees this UI at all pre-pilot (D6·5·3 — the
  fallback stays SQL/service-role only, tracked in the seam's Open edges). The `actorId` exclusion is
  therefore mostly a defensive mirror of the DB invariant for the coordinator viewer, who — per the
  build's own correction — was the actually-reachable self-grant arm. Not a gap; noted so a reader
  does not infer the picker fix is covering a UI path that does not exist.
- **INFO-2 — the self-grant refusal outranks the invalid-level check for a self-grant with a bad
  `p_level`.** `if p_user = auth.uid()` sits before `if p_level not in ('read','write')`, so a
  self-grant call with a nonsense level (untested in `417`) now raises `HC0U1` rather than the
  `check_violation` an invalid level would otherwise raise. This is consistent with — not a deviation
  from — the "refused as an act, not a payload" framing D6·5·1 states explicitly, so it is correct
  behavior; flagged only because the combination has no test cell, and a future reader should not read
  the absence as an oversight.
- **INFO-3 — `case-access-panel.test.tsx` stubs `case-access/actions` rather than exercising the real
  RPC.** Appropriate for this file's stated purpose (picker exclusion, a pure rendering concern) and
  consistent with the sibling unit test's own seam choice of driving the DB-facing logic through
  `actions.test.ts` instead; not a gap, noted for completeness since the previous review's form
  flagged test-seam choices explicitly.

---

## Verdict

**APPROVED.** No blocking or major finding, and no minor either — this is a narrower, more
tightly-scoped fix than the previous unit's two-fix gate, and every claim in its record checks out
against the live catalog and against a mutation I reproduced independently rather than trusted. The
ADR's own self-correction under D6·5·1 (LEARN-056 in action: the prescribed remedy was tested against
real data, its premise was found partly wrong, and the finding was written down rather than quietly
absorbed) is exactly the standard this repo's review discipline asks for, and it holds up under a
second, independent re-derivation.

# GRANT-PLANE-CONVENTION-A1 — progress record

ADR [0205](../decisions/0205-per-object-grant-plane-convention.md) § Amendment 1 and Fix 3. The
unit's **summary** is its hub,
[docs/features/grant-plane-convention-a1.md](../features/grant-plane-convention-a1.md) § Current
state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: ADR 0205 (amended in place), `public.grant_case_access` (the public door only — the
INVOKER kernel, `create_case` and `revoke_case_access` are out of scope), `src/lib/case-access/actions.ts`,
`src/components/cases/case-access-panel.tsx`, `.claude/rules/grant-plane-convention.md`, the two
grant-plane follow-ups, `docs/phases/accreditation-track.md` (Phase 18), PROGRESS.md § Phase Status,
and the seam file `docs/backend-state/cases-and-ethics.md` — all as they exist in the **live
catalog** (⛔ never migration text — ADR 0078).

## Session log

### 2026-09-10 — the audit re-derived, the amendment grilled and written, Fix 3 opened (lead)

**Preconditions, measured:** `main` @ `021987e7`, tree clean but for the untracked audit file;
migration head `20261003007370`; container `supabase_db_azkbbhskturikxpgmafq`.

**The audit, re-derived on the live catalog** — every claim checked against `pg_get_functiondef`,
`information_schema`, `pg_constraint` and the seed, never the migration files the audit cites:

- **F1 cardinality** — text-level, confirmed: D4 "rows named by code" against the reference ledger's
  one boolean row; D5's unique tuple silent on the ability.
- **F2 referral anchor** — confirmed: `app.ensure_securable_resource_referral` stamps
  `commission_id = new.source_commission_id` plus the source's org/hospital; 4/4 seeded referrals
  anchored on source, 0 on target. Found on the way, missed by the audit: `case_referral.target_type
  = 'technical_director'` carries a `target_hospital_id` and NO commission — D6·1 undefined there.
- **F3 narrowing** — half: `securable_resources` has the typed composite key `(id, resource_type)`
  and `action_items` FKs it today (the audit's *"cannot be typed"* is false for this dialect); but
  the registry has no parent column, and agenda items / closed-session items / document versions
  are outside its type domain. `action_items.source_type ∈ {meeting, manual, case}`, `linked_case_id`
  only with meeting-sourced — two candidate roots / no root, confirmed on the CHECK.
- **F4 self-grant** — confirmed on the live door body: authority (42501) → `assert_not_case_excluded`
  → level → `is_member_of_for` (HC021) → future expiry → `case_is_terminal` (HC0U0) → kernel; no
  `p_user = auth.uid()` comparison; the door's own comment names grantee membership as the
  self-escalation guard. Resolver S2 = `manage_case_access` ONLY for a tenancy admin ⇒ the audit's
  *"not an escalation"* is wrong on that arm (a tenancy admin holding a plain membership).
- **F5 tenancy-admin path** — confirmed and already filed: `commissionOfCase` reads `cases` through
  RLS and `cases_select` = `can_read_case`; the internal review § 7 had graded it a pre-existing
  gap. The audit's addition is the copy risk into the shared factory (the build FUP says "lifted from").
- **Additional concerns** — D5 lists seven names (confirmed); `resolution_scope_kind` domain =
  `organization | hospital | commission` and `has_permission` fails closed on mismatch (confirmed —
  so D12's "mechanical" contradicted the ADR's own Option D); Phase 18 line 671 still said
  "per-round auditor write grant" (confirmed); "centralization described as decided" — no such text
  in the hub, rule file or phase docs (no action).

**Facts fetched in parallel** (Explore agent): in-place amendment is this repo's convention, in two
forms (`**Amended (date):**` header line — 0073; `## Amendment N — title` sections — 0061, 0125,
0137), both inert to `build-adr-index.mjs` (passive voice deliberately unmatched); a hub
`complete → in_progress` regression is ungoverned by `check-docs-registers.mjs` and unprecedented —
the precedent is a new unit code; a `complete` hub whose `reviews:` cites a non-APPROVED verdict reds
gate 13 (`HUBS complete via review NOT APPROVED reds`); the tenancy-admin commission page is
`src/app/o/[org]/manage/comissoes/[commissionSlug]/page.tsx`. Lead-measured: `npm run lint:registers`
rc=0 with the untracked audit file in `docs/reviews/`.

**Grilling:** two rounds, 16 questions (Q1–Q10 rulings + amendment mechanics; Q11–Q16 the
dependent decisions); the PO agreed with every recommendation. Rulings: ADR 0205 § Amendment 1
(D2·2, D4·2, D5·2, D6·5, D7·2, D12·2). Stated-without-asking assumptions accepted: unit code
`grant-plane-convention-a1`; the parent reference is a typed composite; backend picks the HC code;
the keystone's subject is the exploit persona; three commits straight on `main`.

**Written this session (commit 1):** ADR 0205 § Amendment 1 + six ⚠ markers + the header line + the
two in-place editorial corrections; the audit file committed verbatim; the rule file's one-liners;
the Phase 18 line; the tenancy-admin FUP archived, the build FUP's *Closes when* widened; the
PROGRESS row; this hub + record; `adr:index` / `features:index` regenerated. Gate witnesses for
commit 1 are appended below.

**Fix 3 opened:** `backend` (migration re-emitted from the live def, RED-first pgTAP, `actions.ts`
mapping + unit test) ∥ `frontend` (picker excludes the actor) — disjoint files. Gate and QA to
follow; witnesses appended here.

**Gate witness, commit 1 (docs only):** `npm run lint` **rc=0**, taken bare after one red — `check-rules-staleness` refused the rule file at 2407 bytes (cap 2048); the one-liners were tightened to 1998 bytes and the chain re-run. Registers gate: 22 hubs · 19 records · 227 open + 156 archived follow-ups (one moved); `adr:index` 201 ADRs, next free 0206, back-pointers current; `features:index` 22 hubs. `typecheck` / `test` / `test:db` not run: no code changed in this commit.

**`frontend` report landed (same session).** `src/components/cases/case-access-panel.tsx` gains an
`actorId` prop and `grantableMembers` now excludes `m.userId === actorId` beside the existing
`role !== "staff_admin"` filter; `case-access-button.tsx` threads it; the case-detail `(detail)/layout.tsx`
passes `access.context.userId` from the session context already fetched there (no new query). New
`case-access-panel.test.tsx` (3 cells: actor excluded, coordinator excluded, plain member kept).
`e2e/case-access.spec.ts` read, not edited: every grant is by `chefe.ccih` to another member — no flow
grants to self. `lint` 0 · `typecheck` 0 · `test` 0. Browser not exercised (no server was up; code-only).

**`backend` report landed (same session).** Migration `20261003007380_grant_door_refuses_self_grant.sql`,
SQLSTATE **`HC0U1`**, body re-emitted from the live `pg_get_functiondef` (head was `20261003007370`);
`prosecdef` / `proconfig` / owner / volatility / identity args / ACL asserted byte-identical by the
migration and by pgTAP; `door-sweep-targets:` line identical to 7370's; kernel, `create_case`,
`revoke_case_access` untouched. pgTAP **`417_grant_door_refuses_self_grant.sql`** `plan(34)` —
**RED-first witness** on a fresh reset with the migration absent, 7/34 red, every red a keystone:
`# Failed test 6: K1 tenancy admin cannot grant HERSELF write — caught: HC021 wanted: HC0U1` · 7 K1c
(read) · 8 K1d (PHI params) · 12 K2 (hospital_admin) · `16: K3 the COORDINATOR self-granting is refused —
caught: no exception wanted: HC0U1` · 17 K3c (self-issued `read_restricted_phi`) · `18: K3b the ledger
holds NO row — have: 1 want: 0`. **GREEN:** `417 ok · All tests successful. Files=2, Tests=35 · PASS`.
Sibling `235_authz_a4_org_admin_not_case_source.sql` K7 split rather than re-coded (LEARN-023): `HC021`
keeps its own cell against a non-member non-caller, `HC0U1` gets its own — `plan(42)` → `plan(44)`.
`src/lib/case-access/actions.ts` maps `HC0U1` → *Não é possível conceder acesso a si mesmo.* exactly as
`HC0U0`; `actions.test.ts` 17 → 21 cells incl. the `HC0U0`/`HC0U1` discrimination cell. Seam slice
`§ Grant plane · A1` appended to `cases-and-ethics.md`, its Current state replaced (99/100 lines);
`HC0U1` registered in `conventions.md`, next free `HC0U2` (union of catalog/repo/docs re-derived).
`npm run gen:types` → no diff. Backend's own rcs: `lint` 0 (17 gates) · `typecheck` 0 · `test` 0
(153 / 2080) · `test:db` 0 on a fresh reset — **Files=266, Tests=8982, PASS**.
⭐ **Two measurements contradict the ruling text — stated by `backend`, not adapted to:** (1) the
tenancy-admin self-grant was **not reachable**: `app.has_role` carries the ACT hat conjunct
`(p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())`, so for the
self grantee the membership check collapses onto the caller's hat — `org_admin` hat → `HC021`,
`staff` hat → `42501`; the arm that WAS open is the **coordinator's** (`staff_admin` hat → self-grant
SUCCEEDED pre-migration, incl. self-issued `read_restricted_phi` under D5·6). The remedy closes strictly
more than D6·5·1 claimed; the tenancy arm's prior closure was incidental (LEARN-058). (2) `create_case`
skips the creator self-grant for a coordinator (ADR 0061 revised); the kernel path is proven with the
administrativo persona; the kernel writes `source='manual_grant'`, `reason_code='creator_self_grant'`.
Dead end recorded: a first draft measured pre-flights as `postgres` and read
`is_tenancy_admin_of_for = true` for the exploit persona — the hat conjunct short-circuits when
`auth.uid()` is NULL (LEARN-003); every pre-flight now runs inside the caller's session.
**Lead corroboration of (1):** live `app.has_role` body re-read, conjunct present verbatim;
`is_member_of_for` = `is_active ∧ has_role_any`; the correction appended **under** D6·5·1 in ADR 0205
(ratified paragraph kept verbatim, ADR 0061 Amendment 1's form).

**Lead gate over the COMBINED tree, bare rc:** `lint` 0 · `typecheck` 0 · `test` 0 (153 files / 2080) ·
`e2e/case-access.spec.ts` 0 (**26 passed, 1 skipped**, `--workers=1`, dev server via `.claude/launch.json`)
· `SELFTEST=1 bash scripts/door-sweep-cases.sh` 0 — `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0`;
`--- GROUP deriver: scenarios 20 (pass 20 · fail 0 · skipped 0)` · `--- GROUP merge helper: scenarios 18
(pass 18 · fail 0 · skipped 0)` · `--- GROUP audit startup capture: scenarios 8 (pass 8 · fail 0 ·
skipped 0)`; produced by `GNU bash, version 3.2.57(1)-release (arm64-apple-darwin25)`.
**Door sweep, deriver arm over `18f2fc7f`:** exit **1** read BARE (two steps, stdout never
substituted into `CASES`); `SCOPE: 1 file(s) — 0 committed (18f2fc7f..HEAD), 0 worktree, 1 untracked
| filter: none | derivation: catalog`; `DOORS IDENTIFIED: 1. SWEEPABLE BY THIS ARM: 0 —
grant_case_access (prosecdef, returns void — outside PRED_DOMAIN)`. **RULED** exactly as Fix 1's
identical finding: the owed **targeted** mutation runs by hand with the harness owning the DB —
witness below. Lead live re-read: `HC0U1` sits after `assert_not_case_excluded` and before the level
check (position asserted by SQL, `before_level=t · after_exclusion=t`), `prosecdef=t`.

**Targeted mutation of `grant_case_access` (lead, harness owning the DB, detached — the scripted
sequence and its log are in the session scratchpad; every step's rc read bare):** (1) fresh
`npx supabase db reset --local` rc 0. (2) Capture: live `pg_get_functiondef` → 4702 bytes, md5
`ab9754df…`. (3) **Restore channel proven first**: the capture re-applied, catalog re-read byte-identical.
(4) **Neutralize the predicate only**: `if p_user = auth.uid() then` → `if false and p_user = auth.uid()
then` — one guard line in the body, the `HC0U1` text KEPT so a text checker stays blind; re-read
`mutated=true · text_kept=true · prosecdef=true`. (5) Full `npm run test:db` under the mutant: **rc 1,
`Result: FAIL`, Files=266, Tests=8982 — exactly 8 red, attributable to two files and nothing else:**
`417_grant_door_refuses_self_grant.sql` `Failed 7/34` (tests 6-8, 12, 16-18 = K1 · K1c · K1d · K2 · K3 ·
K3c · K3b) and `235_authz_a4_org_admin_not_case_source.sql` `Failed 1/44` (test 31 = the split K7
`HC0U1` cell). (6) Restore from capture rc 0; catalog re-read **identical to capture**. (7) Fresh reset
rc 0 + full `test:db` **rc 0 — Files=266, Tests=8982, `Result: PASS`** (the gate's test:db witness, in
the lead's own hands). Findings baseline never opened (subset/targeted runs write nothing there).
**Set-valued targeted home** (`authz-setvalued-targeted-cases.sh`, detached per its own rule, exit read
bare): **rc 0 — `RESULT: CLEAN — 3 resolver(s) measured, all COVERED`** (`authz.authorized_scope_ids`,
`authz.candidate_authorized_scope_ids`, `app.current_professional_read_organizations`), every restore
verified by the harness.
**Browser check of the picker (lead):** logged in as `chefe.ccih@test.local` on the dev server, opened
`Caso 0001` — the `Acesso ao caso` button renders; the pane could not open the dialog (the Browser
pane had a 0×0 viewport this session, clicks unattributable, HMR socket failing), so the browser proof
stays the headless run: `e2e/case-access.spec.ts` 26 passed + `case-access-panel.test.tsx` 3 cells.
Not a defect of the change; recorded so nobody reads "verified in the browser" into this entry.

**Next:** the read-only `qa` review (spawned, owning the DB), then `gated` → PO → Record.

**`qa` verdict (same session): APPROVED — 0 BLOCK · 0 MAJOR · 0 MINOR · 3 INFO**
([grant-plane-convention-a1-review.md](../reviews/grant-plane-convention-a1-review.md)). QA re-derived
every load-bearing claim from the live catalog: guard position (after 42501 + exclusion, before level /
`HC021` / expiry / `HC0U0` / kernel), `prosecdef` / ACL / `search_path` / owner unchanged, exactly one
function mentions `HC0U1`; the build-time correction holds exactly (`has_role` / `has_role_any` carry
the hat conjunct verbatim, `is_member_of_for` collapses as claimed, `create_case` skips the coordinator's
creator self-grant); its OWN targeted mutation reproduced **the same 8 reds at the same test numbers**
(417 6-8, 12, 16-18 · 235 31) across 8,982 and nothing else; gates re-run bare (lint 0 · typecheck 0 ·
test 2080 · test:db 266/8982 · deriver exit 1 with the same SCOPE line · self-test 46/46). INFO only:
the picker fix's practical reach is the coordinator arm (tenancy admins never see this UI pre-pilot); an
untested-but-correct ordering interaction between the self-grant guard and invalid-level validation; a
test-seam note. DB left pristine. Hub → `gated`; commit 2 (Fix 3) landed; awaiting PO for Record.

### 2026-09-10 — Record step (lead; PO approved)

**PO approval** given in-session on the gate presented (both commits, the gate table, the corrected
escalation arm, the browser gap stated). **Record:** hub → `complete` with all five acceptance criteria
ticked; the external audit dropped from the hub's `reviews:` (a complete hub may not cite a non-APPROVED
verdict; ADR 0205's header and § Amendment 1 cite it permanently); the PROGRESS.md § Phase Status row
moved to the ledger verbatim as `✅ complete`; no bug, no new follow-up, no handoff. **Deliberately NOT
done:** no lesson row (the candidate — *a ruling's exploit persona must be measured inside the caller's
session, or the hat conjunct answers for it* — is LEARN-003 + LEARN-058 already, and the `lessonsProseOnly`
ratchet stands at 52/52); the hub's Fix 3 acceptance line still names the tenancy-admin persona because
417 does test it (K1/K2) beside the coordinator (K3) — the correction lives under D6·5·1, one home.
**Gates at the tip, bare:** quoted in the Record commit.

**Final Current state block, cut from the hub at Record (verbatim):**

**Updated:** 2026-09-10

**Objective.**

Amend ADR 0205 in place so the convention is implementation-ready (the audit's five findings), and
close the one finding that is a live escalation path — a self-grant through the case grant door —
pre-pilot, case-only, no AE5 contact.

**Done since start.**

Commit 1 (`18f2fc7f`): the amendment, the audit file, the corpus edits, this unit. **Fix 3 built and
gated** (uncommitted, on `main`): migration `20261003007380` (`HC0U1`), pgTAP `417` RED-first (7/34 red
before, green after), `235` K7 split, `actions.ts` mapping + 21 cells, the picker excludes the actor
(+ unit test). Gate, bare rc: lint 0 · typecheck 0 · test 2080 · fresh-reset `test:db` 266/8982 PASS ·
e2e case-access 26 passed · deriver exit 1 (door outside PRED_DOMAIN) discharged by the hand
targeted mutation — 8 reds in exactly 417 + 235, restore identical · set-valued arm CLEAN 3/3 ·
door-sweep self-test 46/46. ⭐ Build measurement corrected D6·5·1: the tenancy-admin self-grant was
already closed incidentally by the ACT hat conjunct; the open arm was the coordinator's (incl.
self-issued restricted PHI). Correction appended under the clause, ratified text kept.

**In progress.**

Nothing. `qa` verdict **APPROVED — 0 BLOCK · 0 MAJOR · 0 MINOR · 3 INFO**
(`docs/reviews/grant-plane-convention-a1-review.md`); commit 2 carries Fix 3. Awaiting PO.

**Next.**

PO approval, then Record — commit 2 (Fix 3), this block cut into the record, the hub
`complete` with the audit dropped from `reviews:` (a `complete` hub may not cite a non-APPROVED
verdict; the ADR cites it permanently), the PROGRESS row moved to the ledger, commit 3.

**Blockers.**

None. Manual pane click-through of the panel was not possible this session (the Browser pane had no
viewport); the browser proof is the E2E run + the unit test.

### 2026-09-10 — documentation second pass (lead; after Record)

Two Explore sweeps (docs corpus; source/test/seam comments) compared the corpus against twelve facts this
unit settled. **Thirteen stale spots, all corrected in place** (none in append-only logs, reviews, the archive,
or ADR 0205): the door's validation-order lists gained the `HC0U1` step (`416` header, `authorization-and-audit.md`
§ terminal-write bullet, `data-access.md` § grant door); the *"safe because org_admin is not a member"* premise —
measured this session to be an incidental hat-conjunct guard, not the live protection — re-stated as *"refused as an
ACT, `HC0U1`"* in `authorization-and-audit.md` § Q8/Q9, `314` § 5.5's description string and the `b1` harness's
comment; the tenancy-admin follow-up shown as **archived on the ruling** at both `authorization-and-audit.md` mentions;
the seam's 2026-09-10 slice heading gained an amended-the-same-day banner (heading text untouched — router anchors);
ARCHITECTURE.md's registry line now says the trigger's anchors come from a per-root adapter defaulting to the row
(D7·2); CONTEXT.md's Grant Ledger entry lists children per root and the header + child-rows shape (D2·2, D4·2); the
original hub gained a forward pointer to this unit (its title and criteria left as ruled). Confirmed current and
untouched: `cases-and-ethics.md`, `conventions.md`, the rule file, `follow-ups-open.md`, the 0033/0078/0114/0155
forward notes, Phase 18/19 text, the plans. ⚠ Comment-only edits in tester/backend-owned files (`416`, `314`, `b1`)
change no assertion; re-run bare: `npx supabase test db --local supabase/tests/{00_setup,314_…,416_…,417_…}.sql` →
`Files=4, Tests=180, PASS` (⛔ bare numbers/filenames give `NOTESTS` under npx 2.115 — paths only); `bash -n` on the
harness OK; `lint:backend-state` OK (largest seam 141.8 KB). Gates at the tip quoted in the commit.

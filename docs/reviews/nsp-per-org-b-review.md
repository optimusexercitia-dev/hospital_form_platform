# NSP-per-org sub-phase B — whole-phase QA Review

**Reviewer:** `qa` · **Date:** 2026-06-25 · **Branch:** `feat/nsp-per-org` ·
**Scope:** sub-phase B (per-org NSP console `/o/[org]/nsp/**` + roster/appoint UI) **AND** the
`20260630000000_nsp_per_org.sql` deltas that landed after the A-core APPROVED (`5f4baf5`).
Read-only on migrations/app/seed/tests. The A-core review (`nsp-per-org-a-review.md`) stays as-is;
this is the whole-phase B verdict.
**Artifacts:** the migration delta (`5f4baf5..HEAD`), `src/lib/org/actions.ts`,
`src/lib/queries/session.ts`, `src/app/o/[org]/nsp/**`, `src/app/o/[org]/manage/equipe-nsp/**`,
`supabase/tests/176_nsp_per_org_b_support.sql`, `e2e/nsp-cross-org-isolation.spec.ts`.

## Verdict: **APPROVED**

The sub-phase-B deltas are correct, minimal, and cross-org-safe; the A-core isolation **still holds**
under them (re-probed live, not just read); **no PHI surface or NSP console is reachable by a
platform_admin, a foreign-org user, or any non-PQS user**; the appoint/curate/read duty separation is
airtight; and coverage (`176 §A–D` + `nsp-cross-org-isolation` X-1..X-6 + the re-homed specs) is
adversarial and adequate. typecheck clean (strict); lint 0 errors (40 warnings, all unused-vars in
test files, none in B production code). pgTAP 1102/1102 reported; I independently re-ran the B-delta +
A-core regression suites green. No blocking findings.

---

## 1. Post-A migration deltas (security-critical) — all correct

### 1a. The two additive RLS broadenings (`organizations_select` + `commissions_select`) — VERIFIED minimal + cross-org-denied + non-widening
Both add `OR is_pqs_member_of(<org>) OR is_nsp_coordinator_of(<org>)` to an existing SELECT policy.
The shape is the org-scoped point-lookup predicate (the caller's own enrollment row), so it grants a
PQS member/coordinator read of **only their own** org's metadata.

- **`organizations_select`** (`20260630000000:…§A2.5b`) — base was `is_admin OR is_org_admin_of OR
  is_org_member`; the broadening lets a bare PQS member (no commission/org membership) resolve their
  own org row (the `getNspAccessByOrg` seam would otherwise 404 the exact user who needs it).
  **Probed live:** pqs.a sees **1** org (rede-a only, **not** rede-b); a plain non-PQS staffer
  (staff1.ccih) still sees **1** (rede-a via `is_org_member`) — **not widened** by the PQS terms;
  platform_admin sees 2 (vendor `is_admin`, expected). `hospitals_select` correctly left tight (no
  NSP path joins org→hospital).
- **`commissions_select_member_or_admin`** (`…§A2.5c`, BUG-NSP-005) — base was `is_member_of OR
  is_org_admin_of`; without the PQS arm a PQS-only user read **zero** of the org's commissions, so the
  per-org QPS referral dashboard's `listCommissionsForOrg`-intersection filtered out **every** referral
  (even though the referral rows themselves are readable via per-org `can_read_referral`).
  **Probed live + the keystone negative:** pqs.a (PQS-only) now reads **both** rede-a commissions,
  **0** rede-b; **chefe.ccih (plain member of CCIH only) STILL reads only CCIH (1, not the org's 2),
  not Farmácia, not cross-org** — the broadening adds **no** reach to a non-PQS member. `176 §D3`
  mutation-proves this for `commissions`; I verified the `organizations` one too (above).

Both are PHI-free metadata, org-scoped, cross-org denied, plain-member reach unchanged. Minimal and
correct.

### 1b. The appoint flow + duty separation — airtight
- **`list_org_eligible_users_for_pqs(org)`** (DEFINER, `…:§B`) — gated `is_nsp_coordinator_of(org)
  OR is_org_admin_of(org)` (else 42501); unions `organization_members ∪ commission_members` of the
  org. **PHI-free** (catalog-confirmed: profiles name/email + memberships only, touches no PHI table).
  `176 §B`: coordinator + org_admin succeed; a plain member / staff_admin → 42501; **cross-org
  coordinator → 42501**; anon no EXECUTE. ✓
- **`appointNspCoordinator`** (`src/lib/org/actions.ts:205`) — `authorizeOrgAdmin(orgId)` server-side
  re-check + RLS (`organization_members_write` = `is_admin OR is_org_admin_of`) as the DB authority;
  the **orphan-the-org guard** refuses if the target is currently `org_admin` (`existing?.role ===
  'org_admin'` → friendly error), making `org_admin`/`nsp_coordinator` mutually exclusive per user —
  this both removes the "appoint the last admin → zero-admin org" footgun and reinforces the ADR-0042
  three-way separation. ✓
- **`revokeNspCoordinator`** (`:259`) — role-filtered delete (`.eq('role','nsp_coordinator')`), so it
  can never delete an org_admin row; gated + re-checked `is_org_admin_of`; idempotent; correctly does
  NOT touch `pqs_members` enrollment (separate concern, documented). ✓
- **Three-way separation proven live** (`176 §C` + my probes): org_admin **cannot** directly write
  `pqs_members` (RLS-denied — no escape hatch); an enrolled PQS member who is not coordinator **cannot**
  write the roster; only the coordinator can; a cross-org coordinator **cannot** write another org's
  roster; a foreign org_admin **cannot** appoint into another org. org_admin *appoints* ≠ coordinator
  *curates* ≠ enrolled member *reads*.

### 1c. BUG-NSP-004 / BUG-NSP-005 / the I1 fold-in
- **BUG-NSP-004** — `advance_capa_action_core` PQS arm changed `is_pqs_member_of(org_of_event(...))`
  → `can_write_capa(v_capa_id, v_uid)` (`…:726`). Correct: this restores advanceability of
  **non-event-sourced** (manual/indicator/audit/meeting) CAPA actions by a non-assignee PQS member
  (the bare per-org gate returned false on a NULL event-org), now identical authority to the 8
  `capa_*_write` policies + `assert_capa_writable`. **Probed live:** a non-assignee enrolled PQS member
  advances a `manual`-source action (succeeds); a plain non-PQS staffer is **denied (HC050)** — no
  over-broadening.
- **BUG-NSP-005** — the `commissions_select` broadening above. Verified.
- **I1 fold-in** (`dispose_case_phi`) — already reviewed + persona-verified at A-iteration-3; unchanged
  here.

### 1d. The 7 TS query/action bodies
`getNspAccessByOrg` (`session.ts:278`) resolves org-by-slug (RLS-gated) then requires `isPqsMember ||
isCoordinator`, else `null`; the org-scoped data functions (`searchPatientForOrg`,
`getPatientAccessAuditForOrg`, the referral dashboard's `listCommissionsForOrg` intersection, the
per-org NSP queries) all delegate to the org-scoped DEFINER doors I verified in the A-core review.
No inline supabase-js bypass of `src/lib/queries`; errors are pt-BR, no raw PG errors surface.

## 2. Sub-phase B FE gating — no PHI reachable by a non-PQS user

- **Console gate (`/o/[org]/nsp/layout.tsx`)** enforces `getNspAccessByOrg(org)` → `notFound()`
  server-side, and **every** NSP page **independently re-gates** with its own `getNspAccessByOrg` +
  `notFound()` (defense-in-depth, not relying on the layout alone) — confirmed across `page`,
  `triagem`, `encaminhamentos`, `[eventId]`, `rca/[rcaId]`, `capa/[capaId]`, `pacientes`,
  `configuracoes`.
- **Differentiated gates:** `equipe` (roster) requires `!access || !access.isCoordinator` → 404
  (coordinator-only); `nsp/page` redirects a coordinator-only user off the PHI inbox; the PHI pages'
  second gate is the **feature flag**, so a non-enrolled coordinator (admitted by the layout for roster
  curation) *reaches* the PHI pages — but the **data layer is the boundary**:
- **"Sees it empty, not a crash" proven at the doors** (probed as nspcoord.a, unenrolled): `can_read_event`
  = false → event row invisible → `getSafetyEvent` null → page 404; direct `patient_safety_event` SELECT
  = 0 rows; `pqs_inbox` = 0; `get_event_patient` = NULL; `can_read_referral` = false. A non-enrolled
  coordinator sees **no PHI**, ever.
- **Console admission gate airtight** (simulated `getNspAccessByOrg` for `/o/rede-a/nsp`):
  **platform@** → org row visible (is_admin) but `isPqs=false isCoord=false` → **404**;
  **orgadmin.a (no NSP standing)** → **404** (admin standing ≠ NSP standing); **pqs.b (foreign)** →
  org row NULL → **404**; **staff1.ccih (plain)** → **404**; **pqs.a → rede-b (foreign console)** →
  **404**. Only pqs.a (legit) and nspcoord.a (coordinator) are admitted.
- **org_admin-gated `/manage/equipe-nsp`** — gated by the `/o/[org]/manage` layout (`is_org_admin_of`)
  + re-resolves the org from `context.orgAdminOf` (RLS-scoped); the appoint actions re-check
  `authorizeOrgAdmin`. ✓
- **QPS dashboard org-scoping** — the encaminhamentos referral dashboard org-filters via
  `listCommissionsForOrg(orgId)` (now non-empty for a PQS member, BUG-NSP-005) intersected with the
  per-org `can_read_referral`-readable rows; the patient index passes `access.orgId` into the
  org-gated DEFINER doors. PHI-free trajectory surfaces only.

## 3. A-core isolation STILL holds against the B deltas (re-probed, not just read)
- pqs.a on a rede-B event PHI door → **NULL**; on a rede-B referral PHI → **NULL**; `pqs_inbox`
  rede-b events → **0**; unenrolled nspcoord.a on own-org event PHI → **NULL** (curate ≠ read).
- The A-core regression pgTAP all green under the B-state (below). No delta re-opened a cross-org leak.

## 4. Coverage adequacy — adequate + adversarial
- **`176_nsp_per_org_b_support.sql`** (29 assertions): §A org-select broadening (own-org read +
  foreign-org denial, both directions), §B the eligible-users picker (coordinator/org_admin only,
  cross-org 42501, anon no-exec), §C the appoint substrate + the SOLE-roster-writer matrix + cross-org
  write denial, §D the commissions broadening **with the keystone negative D3** (plain member not
  widened) + the four-arm policy-text guard. Mutation-proof where it matters.
- **`nsp-cross-org-isolation.spec.ts`** (X-1..X-6): own-org console renders (200); cross-org console +
  **every sub-route** 404 with **no PHI/MRN/title on the 404 body**; non-PQS duty-separation 404;
  inbox org-scoped (foreign title + foreign MRN absent); patient-index org-scoped (keyed on the unique
  cross-org signals ENC-0003 / titles / subject — correctly avoiding the colliding per-org EV-0001);
  a keyboard-only flow (the phase-gate a11y requirement). This is a faithful UI analog of the `173`
  gate. The 124 re-homed specs migrate the prior NSP/referral suites to the `/o/[org]/nsp` routes.

---

## Findings

### BLOCKER / MAJOR / MINOR
*(none)*

### INFO
- **I-B1 — `authorizeOrgAdmin` admits the vendor `platform_admin` for appoint/revoke** (`org/actions.ts:50`,
  `if (context.isAdmin) return true`). This lets `platform@` appoint/revoke an org's NSP coordinator.
  It is **not** a PHI path and is **consistent** with the established multi-tenancy posture — the DB's
  `organization_members_write` policy is `is_admin OR is_org_admin_of`, so the vendor can already manage
  org membership (but still cannot read PHI: a platform_admin holds no `pqs_members` enrollment, so every
  PHI door denies it — re-confirmed). Membership *administration* ≠ PHI *access*. No change required;
  noted only because the duty-separation review explicitly asks about who can appoint. If the product
  intent is "vendor never touches tenant membership either," that is a separate cross-cutting decision
  (it would also affect `createHospital`/`createCommission`), out of scope for this phase.

---

## Independent verification (probes I ran)
Local stack reset clean through `20260630000000` + seed at current HEAD; pgTAP via the project's
`00_setup.sql` inside the `supabase_db_*` container.

- **pgTAP (live, B-state):** `176` (29/29), `173` (53/53), `145` (34/34), `143` (38/38), `150` (44/44),
  `152` (43/43), `151` (38/38), `175` (4/4) — all green, 0 failures. Matches the tester's 1102/1102.
- **RLS broadenings:** probed both directly as fixed-UUID personas — pqs.a/nspcoord.a read only their
  own org's `organizations`+`commissions`, **0** cross-org; **plain non-PQS member (chefe.ccih) not
  widened** (CCIH only, not Farmácia).
- **Duty separation:** org_admin / enrolled-member / cross-org-coordinator all denied direct
  `pqs_members` writes; coordinator-only succeeds; foreign org_admin cannot appoint cross-org.
- **A-core isolation under B-state:** pqs.a → rede-B PHI doors NULL; pqs_inbox 0 cross-org; unenrolled
  coordinator → NULL on own-org PHI.
- **BUG-NSP-004:** manual-source CAPA action advanceable by a non-assignee PQS member; plain staffer
  denied (HC050).
- **Console admission:** simulated `getNspAccessByOrg` — platform@/orgadmin.a(no NSP)/foreign-PQS/plain
  all → 404; legit PQS + coordinator admitted; cross-org console → 404.
- **No-PHI-to-non-PQS at the data layer:** nspcoord.a (unenrolled) gets 0 event rows / 0 inbox / NULL
  PHI / false `can_read_referral`.
- **Catalog:** no new B DEFINER set/jsonb door over the PHI tables is unscoped; `list_org_eligible_users_for_pqs`
  is PHI-free; `175` dangling-dropped-symbol count = 0.
- **typecheck** clean (strict); **lint** 0 errors / 40 warnings (all unused-vars in test files; none in
  B production code).

## Required changes
**None.** APPROVED — this whole-phase verdict + the lead's full-suite E2E result together gate the
human approval.

### Note for the lead (not blocking)
`docs/backend-state.md` still reads an older pgTAP total; reconcile to **1102** at the Record step
(flagged for completeness — your reconciliation, not this review's scope).

# QA Review — Phase A: Hospital-admin tier, 4-tier audit & committee titles

**Reviewer:** `qa` (qa-reviewer) · **Date:** 2026-07-03 · **Branch:** `feat/hospital-admin-tier`
**Scope:** ADR [0051](../decisions/0051-hospital-admin-tier-and-hospital-audit-tier.md) +
design [hospital-roles-nsp-titles-design.md](../progress/hospital-roles-nsp-titles-design.md)
decisions 1–10, 16–19. Phase B (NSP-per-hospital, `nsp_org_admin` behavior) is out of scope.

## Verdict: **CHANGES REQUESTED**

**Finding counts:** 0 BLOCKER · 2 MAJOR · 3 MINOR.

The security core is strong: the four new RLS shapes are minimum-necessary and
isolation-preserving, the ~145-object predicate swap left zero residual (guarded
permanently by pgTAP 187), the 4-tier audit chain rewrite is coherent and
tamper-evident in lockstep, and cross-hospital / cross-org isolation is proven by
pgTAP 184 keystones. **No isolation leak, immutability hole, or service-role
exposure was found — nothing here is phase-blocking on the RLS/immutability
standard.** The two MAJORs are (1) a required Phase-A deliverable that is built and
tested at every layer but left **unreachable in the UI** by a stale client guard,
and (2) a **cross-hospital destructive-write asymmetry** on one service-role
user-management action that lacks the commission-scope check its sibling has. Both
are narrow, well-localized fixes. They loop back to the engineers per §6.

---

## Requirements coverage (ADR 0051 decisions 1–10, 16–19)

| # | Requirement | Status | Evidence |
| - | ----------- | ------ | -------- |
| 1 | `hospital_admin` = org_admin mirrored, hospital-scoped (incl. disposal + response reads); no PHI-module reads | ✅ Met | Combined predicate `is_commission_admin_of` (mig `…000200`) swapped into all commission-scoped sites; disposal arms inherited via the swap; PHI doors untouched (stay NSP-enrollment). |
| 2 | `organization_members` role widen + nullable `hospital_id` + iff-CHECK (hospital_admin only in A) + `UNIQUE NULLS NOT DISTINCT` | ✅ Met | Mig `…000000`; CHECK binds `hospital_id` iff `role='hospital_admin'`; `nsp_org_admin` admitted but inert; coexistence proven pgTAP 184 §5. |
| 3 | One combined predicate swapped in once; org-level-only sites keep `is_org_admin_of` | ✅ Met | Programmatic swap off the live catalog; pgTAP 187 asserts ZERO residual + calibration that the swap landed; the `is_org_admin_of(` org surface is regex-excluded and untouched. |
| 4 | Appointment chain: org_admin only grants/revokes hospital_admin + nsp_org_admin, no self-delegation | ✅ Met | DEFINER RPCs (mig `…000400`) with explicit `is_org_admin_of(v_org)` gate + `p_user = auth.uid()` self-delegation reject + idempotent onConflict. |
| 5 | Audit gains a 4th HOSPITAL tier; chain key `(org, hospital, commission)`; lockstep `audit_canonical`/`audit_write`/`verify_audit_chain`; per-tier verification pgTAP | ⚠️ Partial | Mig `…000300` is correct and lockstep (see security §4); pgTAP 185 verifies all four chains. **BUT** the hospital-tier integrity check is disabled in the UI — see **MAJOR-1**. |
| 6 | Committee titles: 5th per-commission vocab, `title_id` FK ON DELETE SET NULL, display-only, staff_admin-managed, auto-seed 3 defaults | ✅ Met | Mig `…000100`; same-commission integrity trigger; zero RLS semantics; seed trigger + pgTAP 186. |
| 7 | Hospital stays un-routed; `/o/[org]/manage` hospital-scoped + switcher; `?hospital=` deep link | ✅ Met | A6/A6b; `adminedHospitals` scopes the switcher; directory + registration hospital-scoped. |
| 8–10 | 4-tier chain key + hospital-level emitters + per-tier read access (hospital_admin → its chain + commissions; org_admin → org; platform → platform) | ✅ Met | `audit_log_select` 4-tier policy; hospital emitters (`trg_audit_hospital_updated`, `trg_audit_hospital_admin_grant`); read scoping verified pgTAP 185/188 §6. |
| 16–18 | Titles model / cardinality / UX (one per member, no per-title uniqueness, admins inherit, badges on member+meeting+atas) | ✅ Met | Column + trigger + CRUD RPCs (mig `…000400`); rendered per A7. |
| 19 | Manage-area hospital scoping + switcher, no route migration | ✅ Met | A6; commission URLs unchanged. |

**Amendment 11 (service-role home-hospital hard-set):** ✅ Met for `registerUser`
(server derives `effectiveHomeHospitalId` from `context.hospitalAdminOf`; a
mismatched client `homeHospitalId` is rejected; committees verified per-commission
against the admined hospital set; no `organization_members` write on this path).
⚠️ Partial elsewhere — see **MAJOR-2** and **MINOR-1**.

---

## Security / RLS findings

### The four new RLS shapes — all minimum-necessary & isolation-preserving ✅

1. **`organization_members` self-read** (`…000500`): `user_id = auth.uid()`. A user
   reads only its own grants; no cross-member or cross-tenant exposure; WRITE
   untouched (appointments stay org_admin-only). Correct.
2. **`profiles` hospital_admin read arm** (`…000600`): adds a home-hospital arm
   (`is_hospital_admin_of(home_hospital_id)`) and a shared-commission arm
   (`is_commission_admin_of(c.id)`) to both SELECT policies. **WRITE was NOT
   widened** — verified: the only UPDATE policies remain `profiles_admin_update`
   (is_admin) and `profiles_update_self` (self); pgTAP 188 §5 proves a
   hospital_admin's direct RLS UPDATE is a no-op. Correct.
3. **`hospitals_select`** (`…000800`): `+ is_hospital_admin_of(id)` — **per-hospital**,
   so a sibling hospital's row stays hidden (pgTAP 188 §6 proves a1 reads zero of
   secundario-a / org-b). `hospitals_write` untouched (registry writes stay
   org_admin-only). Correct.
4. **`organizations_select`** (`…000800`): `+ is_org_level_admin_within(id)` — exposes
   only the **org identity row**, not org-wide data, to a hospital_admin /
   nsp_org_admin holding no commission membership. Isolation proven pgTAP 188 §6.
   Correct.

`is_hospital_admin_of` / `is_commission_admin_of` / `is_org_level_admin_within` are
all STABLE SECURITY DEFINER with pinned `search_path`, `REVOKE … FROM PUBLIC` +
`GRANT … TO authenticated, service_role`, and `is_active`-gated on the caller.

### Predicate swap (A2) ✅
The combined `is_commission_admin_of` requires `om.hospital_id = c.hospital_id` on
the hospital arm and `om.hospital_id is null` on the org arm — no over-grant. The
Q5 `commissions` two-arm exception (reads keys off the NEW row to avoid the
INSERT-WITH-CHECK self-SELECT) is correct and documented. pgTAP 187 permanently
guards zero residual + calibrates the swap landed.

### 4-tier audit lockstep (A3) ✅
`hospital_id` is spliced in the same canonical position (after `organization_id`)
in **all three** of `audit_canonical` / `audit_write` / `verify_audit_chain`; the
precedence (commission → hospital → org → platform) matches between writer and
verifier; the four partial-unique seq indexes match the four chain shapes; the
commission chain keys on `commission_id` alone (single predecessor) while carrying
the derived `hospital_id` for read rollup. The read policy scopes each tier
correctly (platform arm requires `organization_id is null … and is_admin()`; the
org arm's `is_org_admin_of(NULL)` yields no match — no leak). Metadata carries only
`user_id` / a `name`,`slug` diff — **no answer payloads, free-text, or PHI copied
into audit rows** (Architecture Rule 11 preserved). Old overloads dropped; ACL
re-locked after the signature change (anon-executability guard stays green).

### Service-role isolation ✅
`createAdminClient()` is `import 'server-only'` (build-time guard against client
bundling) and uses the non-`NEXT_PUBLIC_` `SUPABASE_SERVICE_ROLE_KEY`. Every
service-role action re-verifies authz server-side (the only authority on that
path). No service-role key is client-reachable.

---

## MAJOR findings

### MAJOR-1 — Hospital-tier "Verificar integridade" is disabled in the UI despite the full backend being wired & tested
**File:** `src/components/audit/audit-integrity-check.tsx:32–37, 53, 56, 94–98`
**Requirement:** ADR 0051 Decision 5/10 ("a first-class hospital audit view" with
per-tier chain verification).

The component still carries a stale `blockedByMissingHospitalSupport = Boolean(hospitalId)`
guard and renders a **disabled** button + "A verificação de integridade por
hospital estará disponível em breve" whenever `hospitalId` is passed. But the
entire backend path was in fact widened: `verifyAuditChainAction`
(`src/lib/audit/actions.ts`, commit `91bff49`) accepts `{ hospitalId }`,
`verifyAuditChain` (`src/lib/queries/audit.ts:549–570`) threads `p_hospital`, and
`verify_audit_chain(p_commission, p_organization, p_hospital)` (mig `…000300`) is
authz-gated and verified by pgTAP 185. The audit page passes `hospitalId`
(`src/app/o/[org]/manage/audit/page.tsx:151`) for a hospital_admin, so the persona
that most needs the hospital-tier check gets a dead control.

The A6b/A8 lead notes (PROGRESS item #3: *"no longer disabled for hospital scope"*)
and the component's own KNOWN-GAP comment are both now **inaccurate** — the gap
they describe was closed everywhere except this one client guard.

Not a security hole (a disabled read-only verify control fails closed; it cannot
leak or corrupt). But a stated Phase-A deliverable is unreachable in the UI.
**Fix:** delete the `blockedByMissingHospitalSupport` guard + the "em breve"
branch and let `run()` pass `{ hospitalId }` through (a ~5-line change); update the
stale comment. Tester should add a positive HA-5 assertion that a hospital_admin
can click "Verificar integridade" and get an OK verdict for its hospital chain.

### MAJOR-2 — `removeCommittee` lacks the commission-scope check, permitting a cross-hospital destructive write (same org)
**File:** `src/lib/users/actions.ts:665–682`
**Requirement:** ADR 0051 Decision 7 (a hospital_admin "cannot touch … other
hospitals"); Architecture Rule 1 (RLS/service-role authz is the boundary).

`removeCommittee(userId, commissionId)` authorizes **only** via
`authorizeForUser(userId)` — it does **not** call `authorizeForCommission(commissionId)`,
unlike its sibling `assignCommitteeRole` (which correctly gates on both, line 649).
For a hospital_admin, `authorizeForUser` returns `ok` when the target user shares
*any* commission (or home-hospital anchor) under an administered hospital. So a
hospital_admin of Hospital A, acting on a user who is a member of **both** a
Hospital-A commission **and** a sibling Hospital-B commission in the same org, can
delete that user's **Hospital-B** membership — a write to a commission the caller
does not administer. It runs on the service-role client (no RLS backstop), so the
missing TS check is the only gap.

Cross-org is not reachable (the shared-user precondition can't span orgs), so the
blast radius is same-org cross-hospital on a destructive (DELETE) path. Real
isolation defect, not merely cosmetic.
**Fix:** add `if (!(await authorizeForCommission(commissionId))) return { ok:false, error: MESSAGES.forbidden }`
to `removeCommittee`, mirroring `assignCommitteeRole`. Add a pgTAP/E2E negative:
an A-only hospital_admin cannot remove a shared user from a secundario-a commission.

---

## MINOR findings

### MINOR-1 — `updateUserProfile` writes a client-supplied `home_hospital_id` unvalidated (amendment-11 hard-set not applied on the update path)
**File:** `src/lib/users/actions.ts:533–558` (line 550)
`registerUser` hard-sets the home hospital from the caller's grants and rejects a
mismatched value, but `updateUserProfile` writes `home_hospital_id: input.homeHospitalId ?? null`
raw with no server-side check that the new hospital is one the caller administers.
The per-user page constrains the dropdown to `adminedHospitals(...)`
(`.../usuarios/[userId]/page.tsx`), so this is **UI-only** enforcement on a
service-role path — precisely the pattern Rule 1 / amendment 11 forbid. A crafted
request could re-anchor a managed user to a non-administered hospital (or null). It
grants the *caller* no new access, so severity is MINOR, but it should be
hard-set/validated on this path the same way `registerUser` does.

### MINOR-2 — Stale KNOWN-GAP documentation left in code & PROGRESS
The KNOWN-GAP comment block in `audit-integrity-check.tsx:32–37` and PROGRESS lead
note item #3 describe the hospital-scope action as un-widened; it was widened in
`91bff49`. Even after MAJOR-1 is fixed, sweep these so the record matches reality.
(Grouped with MAJOR-1; noting separately for the hygiene checklist.)

### MINOR-3 — Stale `revalidatePath('/c/[slug]/…')` no-op sites (pre-existing, already logged)
`src/lib/cases/actions.ts:773–774`, `src/lib/commissions/titles-actions.ts:39` still
target the pre-multi-tenancy `/c/[slug]` route pattern and silently revalidate
nothing. Already captured under PROGRESS Follow-ups; not introduced by Phase A but
`titles-actions.ts` is a Phase-A-adjacent file — repoint to
`/o/[org]/c/[commission]/manage/…` whenever backend next touches it.

---

## Audit-integrity KNOWN-GAP adjudication (security focus #5)

**Reconciled.** The tester's observation (control disabled for `hospitalId` scope)
and the A8 lead note (action widened in `91bff49`) are **both true of different
layers**: the backend action/query/RPC and the pgTAP-verified 4-tier chain are
fully wired for hospital scope; only the **client component** still blocks it with
a stale guard. This is therefore **unfinished wiring, not an intentional safe
deferral** — but it is **safe** (a disabled read-only verify control fails closed).
It does **not** block approval on the security/immutability standard; it is filed
as **MAJOR-1** because it leaves a stated Phase-A deliverable unreachable in the UI.

---

## CLAUDE.md / hygiene compliance

- **RLS as the boundary:** ✅ at the DB layer; ⚠️ two service-role TS paths lean on
  UI-only scoping (MAJOR-2, MINOR-1) — the documented amendment-11 exception
  requires the TS gate to be complete, which is the substance of those findings.
- **Service-role key server-only:** ✅ (`import 'server-only'`, non-public env var).
- **pt-BR user-facing text / no raw Postgres errors:** ✅ (centralized `MESSAGES` /
  `AUDIT_MESSAGES`; generic pt-BR fallback; error codes mapped, never surfaced raw).
- **Generated types from `src/lib/types/`; data access via `src/lib/queries/`:** ✅
  (`listHospitalUsers` uses the RLS-scoped client; directory reads are
  RLS-enforced, not admin-client).
- **`strict` / no unjustified `any`:** ✅ (`tsc --noEmit` clean; no `any` in the new
  modules; `eslint` clean on the touched dirs).
- **ADRs:** ✅ ADR 0051 present and accurate (Decision-2 phasing corrected).

---

## Recommendation

**CHANGES REQUESTED** — resolve **MAJOR-1** (wire the hospital-tier integrity
control) and **MAJOR-2** (commission-scope `removeCommittee`) before the human
gate; address **MINOR-1** (hard-set `updateUserProfile` home hospital) in the same
loop since it is the same amendment-11 class as MAJOR-2 and cheap. MINOR-2/3 are
documentation/mechanical and may ride along. Re-verify: the two new negative tests
(cross-hospital `removeCommittee` refusal; hospital-tier verify OK verdict) plus a
green re-run of `e2e/hospital-admin-tier.spec.ts` and pgTAP.

The security core (isolation, immutability, audit tamper-evidence, service-role
containment) is sound and needs no rework.

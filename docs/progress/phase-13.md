# Phase 13 — Audit Trail / Trilha de Auditoria (archived task detail)

✅ complete 2026-06-18. A system-wide, **append-only, tamper-evident** `audit_log` —
per-commission **and** global SHA-256 hash chains computed in a `SECURITY DEFINER`
writer; AFTER INS/UPD/DEL triggers on a curated set of high-value tables for
path-independent capture; explicit `.read`/`.export` instrumentation for sensitive
reads; RLS (admin all / staff_admin own-commission / **no write policy** / zero
anon-PUBLIC); `verify_audit_chain`; read-only `/c/[slug]/manage/audit` +
`/admin/audit` timelines with filters, CSV export, and an integrity check.
Establishes Architecture **Rule 11**. The log records *that* something changed / was
read and *who* — never answer payloads, `*_md`/free-text bodies, or PHI. Feature flag
`audit_trail` (ON). Feature code committed in `26cd30e`; this Record is the formal
gate closure. ADR [0029](../decisions/0029-audit-trail-hash-chain.md); review
[phase-13-review.md](../reviews/phase-13-review.md).

## Tasks

| ID | Owner | Task | Status |
| -- | ----- | ---- | ------ |
| B1 | backend | **[plan-gate]** Full plan + ADR 0029 (hash-chain, DEFINER writer, curated instrumented-table set + per-table non-sensitive column allow-list, RLS, RPCs, flag, `.read`/`.export` call sites, pgTAP) + typed contract stubs. | ✅ |
| B2 | backend | Migration `…120000`: `public.audit_log` (seq/prev_hash/row_hash, nullable actor/commission) + `app.guard_audit_immutable` (BEFORE UPD/DEL → **HC042**) + `app.audit_write(...)` DEFINER writer (advisory-locked, sha256 chain) + `audit_trail` flag OFF. | ✅ |
| B3 | backend | Migration `…120001`: 13 AFTER INS/UPD/DEL triggers on the curated table set (forms/versions/sections/items; commission_members; commissions; responses status-flips; signoffs; cases + case_phases status; meetings + signatures; interviews) → `app.audit_write`. Allow-lists exclude every free-text/Markdown col. Path-independent. | ✅ |
| B4 | backend | Migration `…120002`: RLS (SELECT = admin OR `is_staff_admin_of`; no INS/UPD/DEL policy; zero anon/PUBLIC) + `verify_audit_chain(commission?)` DEFINER; flag flip ON (`…120003`). | ✅ |
| B5 | backend | `src/lib/queries/audit.ts` (RLS-scoped `listAudit` + `verifyAuditChain` + filters + `auditTrailEnabled`) + audited CSV export route + `.read`/`.export` writer calls (`…120004` `log_audit_access` DEFINER positive allow-list; `src/lib/audit/access.ts`); organic seed history. | ✅ |
| B6 | backend | pgTAP `supabase/tests/130_audit.sql` (25 assertions): append-only (UPD/DEL rejected incl. service_role); per-commission RLS scoping; hash-chain integrity (intact → OK; out-of-band edit → broken `seq`); zero anon rows; actor attribution + null→system. | ✅ |
| F1 | frontend | `/c/[slug]/manage/audit` (staff_admin) read-only, paginated, filterable timeline; reuse timeline/feed components; GSAP rise-in; pt-BR. | ✅ |
| F2 | frontend | `/admin/audit` admin cross-commission variant (commission column/filter). | ✅ |
| F3 | frontend | Filters (actor/action/entity/date) + pagination + "Verificar integridade" control surfacing `verify_audit_chain` (OK / broken-seq). | ✅ |
| F4 | frontend | CSV export action (itself audited) + "Trilha de auditoria" nav (staff_admin + admin) + empty/loading/error states. | ✅ |
| F5 | frontend | Accessibility pass: one keyboard-only flow, labels, visible focus, reduced-motion guard; `staff` cannot reach the audit route (route gating mirrors dashboard). | ✅ |
| T1 | tester | **[gate]** `e2e/phase13-audit.spec.ts` (26) for every Phase-13 AC. | ✅ |
| Q1 | qa | Final review: requirements + code + RLS/append-only/hash-chain security. | ✅ APPROVED |

## Lead notes
- **Contract-first:** B1 posted typed stubs before B2–B6 so F1–F5 built in parallel against real types.
- **Full plan review** for B1 (novel hash-chain + DEFINER writer + new RLS shape + append-only guard — security-sensitive).
- **Reuse:** audit timeline reused Phase-12 feed/timeline components; audited-export route mirrored the Phase-8 dashboard CSV route; `verify_audit_chain`/`audit_write` mirror the meetings DEFINER + `extensions.digest(...,'sha256')` hashing.

## Test-isolation saga (gate step 2)
The audit FEATURE was correct throughout (pgTAP 374/374 + DB-layer security review). Gate
step 2 took **three spec-isolation rounds** on `phase13-audit.spec.ts`, **0 app bugs**:
- **P13-004** — phase13 mutated shared seeded fixtures → disposable fixtures (subset 85/85).
- **P13-005** — disposable fixtures still landed in CCIH (commission data) → throwaway commissions (`makeProbeCommission`); broader subset 106/106. The 106 subset omitted phase2, masking the next layer.
- **P13-006** — throwaway commissions added **seeded users** (chefe.ccih/staff2.ccih) → multi-commission → broke phase2 landing + phase3 boundary → **fresh throwaway users** (`makeProbeUser`, via the auth admin API). Complete window (incl. phase2) 131/131.
- Lead full suite **195/195** green declared gate step 2 (2026-06-18). One cosmetic QA MINOR (HC042 unreachable-path pt-BR phrasing) resolved TS-only before Record.

## Cross-phase follow-ups (carried, NOT part of Phase 13)
- Remote `db push` of `…120000–120004` (+ prior `…092000–092006`, `…093000–093003`) remains human-gated.
- The prod asymmetric-JWT deploy checklist (ADR 0009) stays pending Phase 9.

---
id: GRANT-PLANE-CONVENTION-A1
title: "ADR 0205 Amendment 1 — the external design audit's findings ruled in place (grant cardinality, referral anchor, child narrowing, the management surface) — plus Fix 3: the case grant door refuses a self-grant"
status: in_progress
kind: feature
program: AUTHZ
phase: "Between pre-AE5 Batch 9 and AE5 increment 2 — an amendment session on ADR 0205; no phase of PHASES.md"
branch: main   # built straight on main (lead convention)
plan: ~
progress: ../progress/grant-plane-convention-a1.md
reviews: ["../reviews/adr-0205-design-qa-review.md"]
adrs: ["0205"]
handoff: ~
fup: ~
---

# GRANT-PLANE-CONVENTION-A1 — ADR 0205 amended in place, and the third pre-pilot fix

Successor unit of [GRANT-PLANE-CONVENTION](./grant-plane-convention.md), which stays `complete` (a
completed hub is not reopened; the precedent is a new unit code). Trigger: an external design QA of
ADR 0205 ([review](../reviews/adr-0205-design-qa-review.md), verdict *NEEDS REVISION*) whose five
findings the lead re-derived on the live catalog — all held, two understated, two related defects
found on the way — and the PO ruled in a second grilling session (two rounds, 16 questions). The
decision text is ADR [0205](../decisions/0205-per-object-grant-plane-convention.md) § Amendment 1;
nothing of it is duplicated here.

## Acceptance criteria

- [ ] **ADR 0205 § Amendment 1 written, append-only:** D2·2, D4·2, D5·2, D6·5, D7·2, D12·2 and its
      consequences; a ⚠ marker in each amended D; the `**Amended (2026-09-10):**` header line; the two
      editorial corrections in place (D5 count, D12 "mechanical"); `npm run adr:index` in sync.
- [ ] **The audit file committed verbatim** and cited from the ADR and from this hub's `reviews:`.
- [ ] **Corpus made consistent:** the rule file's one-liners; Phase 18's pgTAP line; the tenancy-admin
      follow-up archived on the D6·5·3 ruling; the build follow-up's *Closes when* widened; a
      PROGRESS.md § Phase Status row.
- [ ] **Fix 3 — `grant_case_access` refuses a self-grant** (D6·5·1): migration re-emitted from the LIVE
      `pg_get_functiondef`; the refusal after authority + exclusion and before level / membership /
      expiry; a new `HC` code registered; kernel, creator self-grant and `revoke_case_access` untouched;
      RED-first pgTAP with the exploit persona (a tenancy admin holding a plain membership); the
      SQLSTATE mapped to pt-BR in `src/lib/case-access/actions.ts` (+ unit test); the access panel's
      grantee picker excludes the actor.
- [ ] **Seam slice** appended to `docs/backend-state/cases-and-ethics.md`, its `## Current state` replaced.

**Gate.** `npm run lint` 0/0 · `typecheck` · `npm run test` · `npm run test:db` on a **fresh**
`npx supabase db reset --local` · the diff-scoped door sweep over `main`, both arms, `SCOPE:` quoted,
exit read bare · a read-only `qa` review of Fix 3 → `gated` → PO → `complete`.

## Current state

**Updated:** 2026-09-10

### Objective

Amend ADR 0205 in place so the convention is implementation-ready (the audit's five findings), and
close the one finding that is a live escalation path — a self-grant through the tenancy-admin
fallback arm — pre-pilot, case-only, no AE5 contact.

### Done since start

The rulings (16 questions, every one on the lead's recommendation); the amendment, the audit file,
the corpus edits and this unit written — commit 1.

### In progress

Fix 3: `backend` (migration + pgTAP + the server-action mapping) and `frontend` (the picker) in
parallel, on disjoint files.

### Next

The gate; a read-only `qa` review of Fix 3; PO; Record — this block cut into the record, the hub
`complete` with the audit dropped from `reviews:` (a `complete` hub may not cite a non-APPROVED
verdict; the ADR cites it permanently) and the PROGRESS row moved to the ledger.

### Blockers

None.

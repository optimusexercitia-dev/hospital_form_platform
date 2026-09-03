# QO·FUP — follow-up close-out record (rotated from PROGRESS.md at the Record step, 2026-08-07)

QA: **APPROVED (r2)** — [qo-fup-review.md](../reviews/qo-fup-review.md). ADRs 0101 / 0102 / 0103.
Migrations `20260912000000` + `20260912000100`. Full E2E: all 1019 collected tests accounted green
(main + scoped resume). Resolved follow-up entries: [follow-ups-archive.md](../followups/follow-ups-archive.md)
(2026-08-07 section).

### 🟦 QO·FUP — FUP-QO-1…6 close-out (started 2026-08-07, branch `feat/quality-office-oversight`)

PO rulings 2026-08-07 (asked before work started; each pre-empted a recorded deferral):

- **D-FUP-1 (closes the FUP-QO-1 question):** implement **extend-on-regrant now** — an identical
  re-grant with a new `p_expires_at` UPDATES the existing row's expiry, and the commission-tier
  atomic-replace path WRITES the new expiry. pgTAP `306` §4 pins recut to the new contract; ADR
  amendment required (0100 D9 seam). Phase C break-glass then rides a seam that already extends.
- **D-FUP-4 (closes FUP-QO-4):** KPI strip **stays the global aggregate**; the shipped scope label
  (`quality-kpi-strip.tsx`, renders only when >1 commission is visible) is the resolution. A.9's
  constancy assertion stands. **RESOLVED — records-only.**
- **D-FUP-6:** QO-6 reproduction runs **under load** (full `e2e:prod` with the out-of-process DB
  poller attached), per the follow-up's own next-step note.

| # | Task | Owner | Status |
| - | ---- | ----- | ------ |
| F1 | FUP-QO-1 — extend-on-regrant migration + `306` §4 recut + ADR | backend | ✅ 2026-08-07 (`20260912000000`, ADR 0102) — `306` 37→45, red-first observed 6/43; `f1-expiry-seam-audit.sh` **6/6 RED-PROVEN** |
| F2 | FUP-QO-5 — `100_dashboard` t19 excludes extension-owned functions (pg_depend→pg_extension) + prove-can-find-something control | backend | ✅ 2026-08-07 (`bac7821`) |
| F3 | FUP-QO-3 — retarget vacuous `a2` K8/Kv cases; a2 back to 12/12 RED-PROVEN | backend | ✅ 2026-08-07 (`bac7821`) |
| F4 | FUP-QO-2 — catalog-derived role→landing guard (enumerate `memberships_role_check` from the catalog; every role must resolve to a landing route) | backend (+frontend if `page.tsx` must change) | ✅ 2026-08-07 (`49883c2`, ADR 0101) — **guard fired on its first run: `nsp_coordinator` + `pqs_member` are instances 4 and 5; fix needs `page.tsx` (frontend)** |
| F5 | FUP-QO-4 — records-only close (ruling above) | lead | ✅ 2026-08-07 |
| F6 | FUP-QO-6 — full `e2e:prod` under load with DB poller; classify stale-UI vs lost-write | tester | ✅ 2026-08-07 — **NOT REPRODUCED under load** (see Test Run Summary row); D9/D10 toggle tests all passed clean (1.3–1.9s), poller (continuous, ~12,100 samples) caught the flip too fast to sample (aliasing) but no failure to classify. Streak extended, question still formally open |
| F7 | FUP-QO-2 close — route `nsp_coordinator` + `pqs_member` (the guard's catch, instances 4+5) | backend (filter) + frontend (`page.tsx` branch) | ✅ 2026-08-07 — backend half (`c5b9dca`, `nspOperatorOf`); **frontend half `11d60ad`**: `page.tsx` NSP-operator branch (first of the three office branches) + `KNOWN_UNROUTED` emptied. Guard 14/14 green — both roles resolve to `/o/<org>/nsp` (URL asserted via a throwaway probe, deleted); lint + typecheck clean; vitest **1172** |
| F8 | `list_my_nsp_hospitals()` lacks the `is_active` + unexpired filters every sibling carries; direct caller `capa-operator-gate.ts:26` sits outside the org-read cover | backend | ✅ 2026-08-07 (`20260912000100`) — `145` §I red-first I2/I3/I6, 42/42 after; door dropped from the floor allowlist (6 recorded calls). **Fresh-reset gates PARKED** pending "stack is yours" |
| F9 | FUP-QO-7 ruling — the grant dialog must STATE that a permanent grant is permanent | frontend | ✅ 2026-08-07 (`095d9b9`) — hint on the expiry field in `case-access-panel.tsx`, `aria-describedby="grant-expiry-hint"`. ⚠ **The task's premise did not match the UI**: this dialog has NO blank expiry field — permanent is the explicit `Sem prazo` preset, and a cleared date under `Data específica` is a validation error, not permanent. Hint worded to the real control; "deixe em branco" would have been false. Re-grant clause catalog-verified (`app._grant_case_access_unchecked` sets `expires_at = excluded.expires_at`, so `Sem prazo` on an existing grant DROPS its prazo). Text-only; lint + typecheck clean; vitest **1172** |

Lead acceptances 2026-08-07: **F1's audit-trigger amendment ACCEPTED** (`trg_audit_memberships`
role-change arm now carries `expires_at_before/_after` when the expiry moves — Rule 11; keystoned
4.13c, mutation-proven E6). **ARCHITECTURE.md Rule 12 `pqs_members` line corrected by the lead**
(no such table; roster = hospital-scoped `memberships`).


# BACKEND-STATE-SERVICE-ROLE-SEAM — progress record

> Hub: [backend-state-service-role-seam.md](../features/backend-state-service-role-seam.md) ·
> governing decision: ADR [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md)
> D4, applied by PO ruling of 2026-09-11 (register entry
> `FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`). Branch:
> `backend-state-service-role-seam`, cut from `main` at `3c66efb6`.

Subjects: `docs/backend-state/authorization-and-audit.md` (the frozen slice
`## Service-role DML registry (AE1.4 …)` and the `## Current state` block above it),
`docs/backend-state/README.md` (the router), the new `docs/backend-state/service-role-dml.md`, and
`scripts/check-service-role-registry.mjs` (gate 11, which locates the registry by path + heading
regex). ⛔ No migration, no RLS, no `src/`.

## Session log

### 2026-09-11 — unit opened; review queue processed; nothing moved (lead)

**Why now.** The PO ruled the noun on 2026-09-11 and, in the next message, instructed the lead to
open the split unit. The tree was clean on `main` at `3c66efb6` (the rulings commit).

**Measured at open, not quoted.** Gate 16 (`node scripts/check-backend-state.mjs`, rc **0** bare):
`WARN — [D] docs/backend-state/authorization-and-audit.md — 160.4 KB is over the 160 KB warn line
(cap 200 KB)`; `wc -c` **164,204**; block at 97/100. The slice to move, by `awk` byte sum per `##`
heading: **40,694 B**, sub-headings Groups A–H + Summary, **13** outbound links (all
`../design/authz-ae1-rpc-rulings.md` — same directory depth in the new file, so they resolve
unchanged, ⚠ which is exactly why the check must be RUN and mutated rather than reasoned about).
Inbound: the file's own `## Current state` block names the section twice (bullets 17 and 34 of the
block, plus the § list at :89/:98); outside the directory only `docs/design/authz-ae1-rpc-rulings.md:8`
still links the pre-split `backend-state.md` (ADR 0105-exempt, per the split review). Gate 11 hard-codes
`DOC = docs/backend-state/authorization-and-audit.md` and `SECTION_RE = /^## Service-role DML registry\b/`
(`scripts/check-service-role-registry.mjs:62-64`) — ⇒ the unit is docs **plus one gate constant**.
Citations to re-point found by grep: `docs/lint-gates.md:25`,
`docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md:9`. `CONTEXT.md:359/374` cite the
file for the **privilege budget** — that noun stays.

**ADR number reserved: 0206**, measured as the highest on any live branch (`0205` on `main`; the
three `origin/*` feature branches carry none higher) + 1, skipping the reserved and unfillable
`0202` / `0204`. ⛔ Re-measure at the rebase stop before the file is created.

**CLAUDE.md review queue processed at open (Record step 7 debt, per-clone file).** Four entries
since the 2026-09-10 marker, dispositions:

| entry | signal | disposition |
|---|---|---|
| `c637a596` (4 bullets, Batch 10) | *stale* in quoted other-repo text; ADR 0200 "declare a tightening" prose; B-1 quoted back and verified; `Arm 1 guards: 7` in an audit front-matter | not a doc problem ×4 — the front-matter line now reads **13** (`docs/reviews/authz-writepath-audit-findings.md:12`), already regenerated (`docs/progress/writepath-baseline.md:694`) |
| `8544d35e` | `0202` absent, so §8's "highest + 1" yields a reserved number | not a CLAUDE.md defect — the rule is *necessary not sufficient*; plan reservations are the plan's, and every AE5 record since carries *never 0202 / never 0204* |
| `6809c28b` | a pre-rebase sha named in a QA review | the arm-3 unit's round-2 MINOR, already discharged (`5ffeed2c`) |
| `825e1912` (this lead, previous message) | *stale* in the PO's own task prompt | hook finding (ii) — the keyword fired on the instruction |

Outcome: **0 doc fixes**, processed marker prepended to the queue. No CLAUDE.md edit proposed.

**Homes written:** hub (`in_progress`, block at open), this record, `docs/features/INDEX.md`
regenerated. Gate 13 run bare after the writes; rc in the commit message.

---
expires: 2026-09-24
task: pre-AE5 remediation — successors of Batch 10 (no unit open; the PO names the next)
created: 2026-09-10
updated: 2026-09-11
status: live
---

# Handoff — after pre-AE5 Batch 10 (`ADMIN-ARM-IS-ACTIVE`), before the next unit

## ▶ RESUME HERE
Nothing is mid-flight. ⚠ **Updated 2026-09-11:** unit **`AE5-MATRIX-ARM3-CELLS`** — one of the three
successors this handoff named — is **concluded**: built, gated, QA-approved at round 2, PO-approved and
fast-forwarded to local `main` on 2026-09-11; its branch is deleted; ⛔ **`main` is NOT pushed** (the
standing instruction; the branch itself was pushed mid-flight on the PO's instruction and is now
stale on `origin`). Two successors remain, both docs-only ADRs, and the PO names which: **ADR 0202**
(F7 · F8 · `platform_role`; before AE5 increment 2) or **ADR 0204** (the `D` ceiling · the
`search_path=''` convention; both censuses already in the two follow-up bodies; no ordering
constraint). Measure the tree (command below), then read `docs/plans/pre-ae5-remediation.md` §6
*Where the next session starts*. ⛔ AE5 itself stays post-pilot (ADR 0155 G1). ⛔ ADR numbers 0202 and
0204 are reserved; for any other subject take *highest on any live branch + 1*, re-measured.

> ⛔ **RE-ROUTED 2026-09-11 (unit `AE5-SUCCESSOR-ADRS`) — the paragraph above is SPENT; it is kept as
> history and ⛔ must not be acted on.** **Both remaining successors are WRITTEN**, and the reserved
> numbers were renumbered by PO ruling (on `pre-ae5-remediation.md` §3 item 5's own offered remedy),
> so ⛔ **`0202` and `0204` do not exist and are no longer reserved**:
> - ADR [0207](../decisions/0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md)
>   — the role catalog (F7 · F8 · `platform_role`). ⚠ *"before AE5 increment 2"* is refuted: D6 rules
>   `staff_admin` the already-authoritative **baseline**, item 1 is `staff`, so it is due before
>   **increment 1**.
> - ADR [0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
>   — the two conventions. ⚠ *"both censuses already in the two follow-up bodies"* held only as a
>   starting point: every cited fact was re-measured before drafting (10 of 14 reproduced, 4
>   differed), and both follow-up clauses are **RE-CLAUSED, not closed**.
>
> **▶ THE NEXT UNIT IS `AE5-ROLE-CATALOG-COMPAT`** — a backend build unit, not an ADR (ADR 0207 D5:
> six ordered steps, before AE5 increment 1; the `authz.scope_kind` step is an `ALTER DOMAIN` and
> needs a red-first `memberships` proof first). Two further named units are owed and are **not**
> ordered against it: `AE4-D-SHAPE-ASSERTION` and `DEFINER-SEARCH-PATH-NARROW-FIX` (ADR 0208
> D2 / D5 / D6). ⛔ AE5 itself still stays post-pilot (ADR 0155 G1) — the compat unit is pre-AE5
> remediation, not increment 1. For any other subject's ADR number, take *highest on any live ref +
> 1*, re-measured (highest was **0208** at this writing; ⛔ do not quote that either).
>
> ⚠ **ORDER RULED 2026-09-11 (PO, on the lead's recommendation) — the paragraph above is superseded
> on ONE point: `DEFINER-SEARCH-PATH-NARROW-FIX` runs BEFORE `AE5-ROLE-CATALOG-COMPAT`.** The
> compat unit's step 2 writes a brand-new SECURITY DEFINER (`assume_role` on a text signature),
> and ADR 0208 D4 makes `search_path = ''` mandatory for a new one — but today nothing enforces
> that: the current `assume_role(platform_role)` is `prosecdef` on `search_path=app, public,
> pg_catalog` (measured live 2026-09-11), and it is a member of the population the 419 ratchet
> freezes. Ratchet first ⇒ the compat unit's new door is the ratchet's first REAL discrimination
> event (a genuinely new DEFINER entering the population, not only the planted control), and the
> unit cannot add non-empty-path debt unnoticed. The two are still NOT merged — different subjects,
> different close conditions, and the search-path item's own ⛔ "converging one door is not closing
> the class" applies. `AE4-D-SHAPE-ASSERTION` stays unordered.
> ✅ **DATED NOTE 2026-09-13 — `AE5-ROLE-CATALOG-COMPAT` is CONCLUDED** ([hub](../features/ae5-role-catalog-compat.md) · [record](../progress/ae5-role-catalog-compat.md) · [review](../reviews/ae5-role-catalog-compat-review.md)): ADR 0207 D5 steps 1–5 built (migration `20261003007430`), QA APPROVED r1, PO-approved 2026-09-12, fast-forwarded to local `main`, ⛔ not pushed. What remains owed and unordered: `AE4-D-SHAPE-ASSERTION` (ADR 0208 D2); step 6 (the capability-plane mapping, `authz.capability_permissions`, the three narrower codes) belongs to AE5 proposed-order item 6 and ⛔ AE5 stays post-pilot (ADR 0155 G1). The two follow-ups named in the next paragraph were RESOLVED 2026-09-11.

⚠ Two follow-ups filed by the concluded unit need a PO ruling before the next backend unit touches
their subjects: `FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE` (which noun leaves the
authz seam file) and `FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`
(carried by the class-5 bug's fix). The CLAUDE.md review queue on this clone was non-empty at the
unit's close and was **not** processed — step 7 of the Record step is owed before the next unit opens.

## Trust
- **Verified, in the tree:** everything Batch 10 claims is witnessed in
  `docs/progress/admin-arm-is-active.md` § Session log (entries dated 2026-09-10, the last one
  *"E2E loop closed"*, then the cut-in *Current state at close* block). Gate figures live there
  and in the ledger row; do not copy them.
- **Not verifiable by a session, stated as such in the record:** Coolify's Automatic-Deployment
  state (why `main` is NOT pushed — the standing instruction; a push is a PO decision and needs
  the changed basis stated again); the PostgREST HTTP hop for the Class-2 denial (asserted from
  ACL + `prosecdef` + the door's own 42501, never over HTTP).
- **Written this session and only lint-checked, not re-read cold:** the three new follow-ups at
  the end of `docs/followups/follow-ups-open.md` (`FUP-ADMIN-ARM-IS-ACTIVE-…`), LEARN-100/101/102,
  the authz seam's Batch 10 slice + its `## Current state` R6 line
  (`docs/backend-state/authorization-and-audit.md`), the three dated notes in ADR 0201 (D2, D4, D5).
- **Per-clone trap:** `.claude/claude-md-review-queue.md` is gitignored. It was processed and
  cleared on THIS clone at Batch 10's open; the Stop hook will have appended this session's own
  entries by the time you read this. `wc -c` it; another clone's state says nothing about it.
- **Pushed** on the PO's explicit instruction after the Record step (`b87eac1e..44f69ff6`, 27 commits; a fifth one-push override, spent). ⛔ "do not push" is the standing instruction again; re-measure `origin/main..main`, never quote.

## Tree
Branch `main`, HEAD at or after the `AE5-MATRIX-ARM3-CELLS` phase commit (2026-09-11; the sha is in
the ledger row and the unit record's Record-step entry — re-measure, never quote). Expected clean. No
worktrees. No unit branch. `origin/main` is behind by the whole unit — re-measure the distance.

## Next command
```bash
git status --short && git log --oneline -3 && git rev-list --count origin/main..main && grep -n "in progress" docs/features/INDEX.md | head -2 && sed -n '/^## 6\. Where the next session starts/,$p' docs/plans/pre-ae5-remediation.md | head -80
```

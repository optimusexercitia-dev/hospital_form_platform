# Feature hubs — index

> ⚙ **GENERATED FILE — do not edit by hand.** Every row is derived from a hub's YAML frontmatter
> (`docs/features/<slug>.md`). Rebuild with `npm run features:index`; `npm run lint:registers`
> (gate 13 of `npm run lint`) reds when this file is out of date. ADR 0185 D1; ADR 0186 D1 —
> this file is the only projection of hub frontmatter; nothing else lists it separately.
>
> **This file IS the live list** — sorted `in_progress` → `gated` → `planned` → `parked` →
> `complete`, so "what is in flight" reads off its first rows. A hub exists **before** a
> branch is cut. Codes for historical work that never had a hub:
> [legacy-codes.md](../followups/legacy-codes.md).
> A hub's `## Current state` is its summary; its progress record's `## Session log`
> (`docs/progress/<code>.md`) is its detail (ADR 0186 D3).

**19 hubs** · in progress 1 · gated 3 · planned 2 · parked 0 · complete 13

| ID | Title | Status | Kind | Program | Branch | Hub |
|---|---|---|---|---|---|---|
| AE5-OPENING-ADR | AE5's opening decision — the ADR 0176 D8 bundle, the F5 seam model and the per-role template's arm keying, taken together with the admin arm's `is_active` blindness, its Class-2 write reach and the manifest comment that describes a red which is green, so the template is decided before AE5 copies it eleven times (pre-AE5 Batch 9) | 🟢 in progress | feature | AUTHZ | `authz-ae5-opening-adr` | [ae5-opening-adr.md](ae5-opening-adr.md) |
| BACKEND-STATE-CURRENT-STATE | Backend seams get a replaceable current-state layer — a projection above the frozen history, gated in four checks (ADR 0198) | 🚧 gated | feature | DOCS | `backend-state-current-state` | [backend-state-current-state.md](backend-state-current-state.md) |
| BACKEND-STATE-SPLIT | Backend surface map split onto the module-seam axis — a router replaces the 742 KB reading list (ADR 0196) | 🚧 gated | feature | DOCS | — | [backend-state-split.md](backend-state-split.md) |
| DATA-ACCESS-GENERATION | Data-access registries generated from the catalog — four hand-maintained tables replaced by a derive-and-compare pair, gated in two halves (ADR 0197) | 🚧 gated | feature | DOCS | `data-access-generation` | [data-access-generation.md](data-access-generation.md) |
| C1B-DISPOSAL | PHI-disposal Cloud rehearsal (C1b) | 🔜 planned | feature | DM5 | — | [c1b-disposal.md](c1b-disposal.md) |
| DLB | Deliberation & Voting Model — typed committee decisions with vote arithmetic the database owns | 🔜 planned | feature | DLB | — | [dlb.md](dlb.md) |
| AE4 | Authz catalog cutover — staff_admin substituted, 3 of 43 permissions load-bearing | ✅ complete | feature | AUTHZ | — | [ae4.md](ae4.md) |
| C2-TIER1 | Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure | ✅ complete | feature | AUTHZ | — | [c2-tier1.md](c2-tier1.md) |
| CAN-MANAGE-PROFESSIONAL-SELF-CHECK | `app.can_manage_professional`'s self-check arm — a third-party predicate whose first arm answers about the caller, given its reachability analysis, the PO's ruling, and (if ruled) the migration that makes it answer about `p_uid` (pre-AE5 Batch 8) | ✅ complete | feature | AUTHZ | — | [can-manage-professional-self-check.md](can-manage-professional-self-check.md) |
| DOCS-CONSOLIDATION | Documentation consolidation — one home per fact, one summary and one log per unit (ADR 0186) | ✅ complete | feature | DOCS | `docs-consolidation` | [docs-consolidation.md](docs-consolidation.md) |
| DOCS-RESTRUCTURE | Documentation restructure — feature hubs, CURRENT.md, gated registers (ADR 0185) | ✅ complete | feature | DOCS | `docs-restructure` | [docs-restructure.md](docs-restructure.md) |
| DOOR-SWEEP-DERIVER | Door-sweep case deriver — select gates by PROPERTY, read the whole declaration, scope the increment, and let a full run keep the hand-authored baseline (pre-AE5 Batch 1) | ✅ complete | feature | AUTHZ | — | [door-sweep-deriver.md](door-sweep-deriver.md) |
| ENFORCEMENT-MANIFEST | Enforcement manifest — hardDenyClasses made falsifiable, the template's re-key defect (policy re-keyed, DEFINER writer left on layer 1) resolved across the `_staff_admin_write` class, the two undeclared consumers recorded, and the rollback runbook re-measured (pre-AE5 Batch 4, Batch 5 riding along) | ✅ complete | feature | AUTHZ | — | [enforcement-manifest.md](enforcement-manifest.md) |
| HARNESS-CRASH-SAFETY | Mutation-harness crash safety — a killed sweep may never leave a door open without a trace (pre-AE5 Batch 0) | ✅ complete | feature | AUTHZ | — | [harness-crash-safety.md](harness-crash-safety.md) |
| LEDGER-COMPLETENESS | Phase-ledger completeness — the general question behind FUP-AE2 derived, not eyeballed; four missing rows found, two umbrella idioms separated, and the 8-cell row repaired | ✅ complete | feature | DOCS | — | [ledger-completeness.md](ledger-completeness.md) |
| PRED-DOMAIN | Door-audit domain — the authz resolvers enter PRED_DOMAIN (or a scheduled targeted-case home), the read arm stops mirror-ambiguous, and the findings baseline is re-earned through the merge (pre-AE5 Batch 2) | ✅ complete | feature | AUTHZ | — | [pred-domain.md](pred-domain.md) |
| PRIVILEGE-SURFACE | Privilege surface — the authenticated-executable DEFINER budget's seven-over-ceiling breach attributed function by function, the 233 held AE1 revokes ruled on with their 137 silent no-ops named, and the app-schema PUBLIC floor given the decision it has been waiting for (pre-AE5 Batch 7) | ✅ complete | feature | AUTHZ | — | [privilege-surface.md](privilege-surface.md) |
| REGISTER-GATE-HYGIENE | Register and gate hygiene — the complete-gate regexes learn bold ids and real verdict lines, ADR link TARGETS get resolved, AE2 re-enters the ledger, an archived closure keeps its `Closes when`, and the door arm stops reading an empty `CASES` as a full sweep (pre-AE5 Batch 6) | ✅ complete | feature | DOCS | — | [register-gate-hygiene.md](register-gate-hygiene.md) |
| WRITEPATH-BASELINE | Write-arm baseline — the committed write-path findings file re-earned over the widened 107-policy domain through the merge, the three storage.objects INSERT policies verdicted, and the write arm's empty-set exit made a FINDING (pre-AE5 Batch 3) | ✅ complete | feature | AUTHZ | — | [writepath-baseline.md](writepath-baseline.md) |

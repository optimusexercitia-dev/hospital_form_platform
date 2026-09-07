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

**10 hubs** · in progress 0 · gated 1 · planned 2 · parked 0 · complete 7

| ID | Title | Status | Kind | Program | Branch | Hub |
|---|---|---|---|---|---|---|
| ENFORCEMENT-MANIFEST | Enforcement manifest — hardDenyClasses made falsifiable, the template's re-key defect (policy re-keyed, DEFINER writer left on layer 1) resolved across the `_staff_admin_write` class, the two undeclared consumers recorded, and the rollback runbook re-measured (pre-AE5 Batch 4, Batch 5 riding along) | 🚧 gated | feature | AUTHZ | `authz-enforcement-manifest` | [enforcement-manifest.md](enforcement-manifest.md) |
| C1B-DISPOSAL | PHI-disposal Cloud rehearsal (C1b) | 🔜 planned | feature | DM5 | — | [c1b-disposal.md](c1b-disposal.md) |
| DLB | Deliberation & Voting Model — typed committee decisions with vote arithmetic the database owns | 🔜 planned | feature | DLB | — | [dlb.md](dlb.md) |
| AE4 | Authz catalog cutover — staff_admin substituted, 3 of 43 permissions load-bearing | ✅ complete | feature | AUTHZ | — | [ae4.md](ae4.md) |
| C2-TIER1 | Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure | ✅ complete | feature | AUTHZ | — | [c2-tier1.md](c2-tier1.md) |
| DOCS-CONSOLIDATION | Documentation consolidation — one home per fact, one summary and one log per unit (ADR 0186) | ✅ complete | feature | DOCS | `docs-consolidation` | [docs-consolidation.md](docs-consolidation.md) |
| DOCS-RESTRUCTURE | Documentation restructure — feature hubs, CURRENT.md, gated registers (ADR 0185) | ✅ complete | feature | DOCS | `docs-restructure` | [docs-restructure.md](docs-restructure.md) |
| DOOR-SWEEP-DERIVER | Door-sweep case deriver — select gates by PROPERTY, read the whole declaration, scope the increment, and let a full run keep the hand-authored baseline (pre-AE5 Batch 1) | ✅ complete | feature | AUTHZ | — | [door-sweep-deriver.md](door-sweep-deriver.md) |
| HARNESS-CRASH-SAFETY | Mutation-harness crash safety — a killed sweep may never leave a door open without a trace (pre-AE5 Batch 0) | ✅ complete | feature | AUTHZ | — | [harness-crash-safety.md](harness-crash-safety.md) |
| PRED-DOMAIN | Door-audit domain — the authz resolvers enter PRED_DOMAIN (or a scheduled targeted-case home), the read arm stops mirror-ambiguous, and the findings baseline is re-earned through the merge (pre-AE5 Batch 2) | ✅ complete | feature | AUTHZ | — | [pred-domain.md](pred-domain.md) |

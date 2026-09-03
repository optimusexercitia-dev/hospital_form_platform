# FUP-BACKLOG-PHASE-8-DEPLOY-CHECKLIST-PRODUCTION — Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

**Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** (Phase 2 QA re-review, ADR 0009). Otherwise `getClaims()` silently falls back to a per-request `getUser()` GoTrue round trip, re-introducing the P2-002 post-login race in production (behavioral regression, not a security hole — tampered tokens still fail closed). Add a testable verification step.

## ↩ Rotated from PROGRESS.md 2026-08-19 — the live follow-up index's deferred tail

> Open, but not actionable in the next session, so they never fired the `is it resolved?`
> rotation predicate and sat in the live index instead. Moved VERBATIM apart from the link
> repoint. Each is still OPEN — this is a change of address, not a closure.

> ⚠ **CUT DOWN 2026-09-02 at the register consolidation (ADR
> [0179](../decisions/0179-follow-up-register-consolidation.md)).** 27 of the 33 bullets here were
> the *index half* of an item whose *body* lived in `follow-ups.md`. Now that an item is ONE entry,
> keeping the bullet would be the double-registration the consolidation exists to remove — so each
> was cut here and its entry in [follow-ups-open.md](follow-ups-open.md) carries a **`**Parked**`**
> marker instead, preserving the not-actionable-next-session signal at the item itself.
> ⛔ **Nothing was closed and nothing was dropped**: 27 bullets cut, 27 entries marked, verified
> both directions. The **6** below are the remainder — items with no register entry, which is why
> they stay.

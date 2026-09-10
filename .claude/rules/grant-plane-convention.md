---
paths:
  - "supabase/migrations/**"
broad: >-
  The whole directory IS the subject: a grant-shaped table is born as a migration, and the only
  moment the convention can still be chosen is while that file is being written. This file is the
  placeholder for the conformance keystone ADR 0205 D12 defers (ADR 0127's admitted case).
anchors:
  - docs/decisions/0205-per-object-grant-plane-convention.md#D2 — Only a ROOT securable gets a ledger
  - docs/decisions/0205-per-object-grant-plane-convention.md#D12 — Timing
  - supabase/migrations/20260802000000_authz_b_case_access_grants_hard_cut.sql#case_access_grants
  - docs/phases/accreditation-track.md#ADR 0205
source: ADR 0205
---

# A per-user, per-object grant table follows ADR 0205 — and none is built before AE5 completes

⛔ **No new grant ledger before AE5-complete** (ADR 0205 D12): every feature that needs one is
post-pilot, and the scaffold, shared trigger, dialog and keystone are built at the first consumer.

When one is built, read ADR 0205 D2–D9 first. In one line each: ledgers only on a **root**
securable, a child inherits (D2) · participation rows are **never** mirrored into a ledger (D3) ·
abilities are named by `authz.permissions.code` (D4) · the five mandatory columns and the
no-DML posture (D5) · coordinator + tenancy-admin fallback, member-only grantee, no self-grant
(D6) · the shared audit trigger (D7) · typed `source` FKs, never a bare uuid (D8) · the door refuses
a write ability on a terminal resource (D9). `case_access_grants` is the reference shape and is not
physically changed; the administrativo and DPO planes are outside the convention (D11).

Retire this file, verbatim into `docs/progress/rules-archive.md`, when the keystone lands.

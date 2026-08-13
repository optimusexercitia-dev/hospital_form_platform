# 0117 — DM2·S1 build decisions: the D15 confidentiality ceiling on `documents`

- **Status:** Accepted (lead-acked plan 2026-08-13 with three amendments; built same day).
  **Amendment 1 (2026-08-13, PO ruling): the interview's ceiling propagates to its
  documents — supersedes decision 6.**
- **Scope:** the build-time decisions S1 made executing ADR 0114 **Amendment 1 (D15)**.
  Keystones: pgTAP `228` t36–39 (restored) + `328` K14; phase record
  `docs/progress/dm2-orchestration-wave-a.md`.

## Decisions

**1. Column name `documents.confidentiality_level`** (nullable, no default; 7-value
CHECK mirroring the `case_access_grants` shape). Matches the dominant sibling
spelling (`cases`, `case_interviews`, `case_types.default_confidentiality_level`);
the retired attachments spelling (`confidentiality_label`) died with its substrate.
NULL = unclassified = non-enforcing. The column is interim and migrates into the
Phase-19 access plane (D16).

**2. Clearance is the SURVIVING `app.confidentiality_clearance_ok`, reused
unmodified** — inheriting: only `legal_privileged` + `credentialing_sensitive`
enforce (the O2 ruling), revocation/expiry handling, and coordinator-not-exempt
(E1 as-built delta 6). Clearance semantics are deliberately NOT re-tested; their
carrier keystones live in 144/238.

**3. The meeting/action_item seam: unrepresentable at write time, fail-closed at
read time.** An enforcing label is legal only on a home that resolves to a case
(`case`, `interview` → `case_of_interview`). Two independent DB layers:
`app.guard_document_confidentiality` (BEFORE INSERT OR UPDATE OF
`confidentiality_level, home_resource_id`; SQLSTATE **HC0D6**) and a fail-closed
arm in the kernel (enforcing label + no resolvable case → false for EVERYONE,
creator and staff_admin included — the arm that governs any bypass and any future
home type until Phase 19). `action_item` deliberately gets NO `source_*`
resolution — a partially-resolvable polymorphic source is a half-open seam.
**Rejected alternative** (recorded so it is not re-litigated blind): a pure-CHECK
route via a denormalized `home_resource_type` + composite FK to the registry's
`UNIQUE(id, resource_type)` — stronger declaratively, but it breaks all 13
pre-existing `documents` fixture INSERTs across 10 suites (or needs a derive
trigger anyway), adds a permanent column D16 never absorbs, and forces an FK
replacement (PGRST201 class). ADR 0116 §5 is the controlling precedent: on these
tables the writers are exactly the guard-appropriate population.

**4. SQLSTATE HC0D6, not HC0D5.** HC0D5 is already minted by
`revoke_printed_document` (found by comment-stripped `prosrc` census at build
time); a keystone matching a shared code could be satisfied by the neighboring
path (authz-handoff §7.1). The DM guard block is now HC0D1–D4 (DM1), HC0D5
(printed documents, pre-existing), **HC0D6** (S1 seam), HC0DM (parked seams).

**5. The kernel arm is an AND-conjunct AFTER home-resource dispatch** (the retired
mechanism's order — ADR 0072 as-built delta 2); a conjunction can only narrow.
Shipped as **two migrations** (lead AMEND 1): `20260924000100` column+CHECK+guard,
`20260924000200` kernel re-emit — so the behavioral keystones were observed RED
against the real post-column, pre-arm catalog (quoted in the phase record), not
only against a self-authored neutralization. The re-emit was derived from the
LIVE `pg_get_functiondef`, guarded by in-migration drift asserts (pre: no
confidentiality arm, dispatch shape intact; post: arm present, prosecdef, pinned
search_path, ACL unchanged), and the pre/post live-body diff shows exactly the
intended edit.

**6. ⛔ SUPERSEDED by Amendment 1 (below). AMEND 3 verdict — the interview-label dimension is PARITY** (finding DM2-F1
in the phase record): no version of the retired `can_read_attachment` ever routed
`can_read_interview`; the interview's own ceiling gates the interview ROW (via
`can_read_interview`, which survived DM1 intact) and never gated its attachments'
metadata. Interview-label inheritance for documents is a named product question
(S1-O4), not a regression.

## Amendment 1 (2026-08-13) — the INTERVIEW's ceiling propagates to its documents

**Status:** PO ruling 2026-08-13 (PROPAGATE); built same day (migration
`20260924000800`). **Supersedes decision 6 above**: the parity verdict (DM2-F1)
stands as *history* — no version of the retired `can_read_attachment` ever
routed `can_read_interview` — but parity answers "did we break this?", not "is
this correct?". The old substrate is being replaced *because* it had this shape
of defect (F-01: authorized from a path without joining the row), and Wave A is
the phase that puts real transcripts behind the seam; a ceiling that hides the
interview record but not its files is close to decorative. S1-O4 is closed.

**The defect** (lead-reproduced as a differential probe — same member, same
interview, one variable): `app.can_read_interview(iv, member)` = false while
`app.can_read_document(doc_homed_on_iv, member)` = true. The kernel's interview
arm dispatched `can_read_case_committee(case_of_interview(v_resource), p_uid)`,
skipping the level where `case_interviews.confidentiality_level` lives.

**Mechanism:** the arm now dispatches `app.can_read_interview(v_resource,
p_uid)` — catalog-verified to be *exactly* the old arm's predicate PLUS the
missing clearance conjunct, row-joined
(`exists(ci … can_read_case_committee(ci.case_id) and
confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level))`). It
cannot over-narrow: `confidentiality_clearance_ok` returns true for every
non-enforcing label, and a missing interview row fails closed in both the old
and new arm. One kernel edit governs the whole aggregate (the three RLS
policies, `can_read_document_version`, `can_read_file_object`, and
`open_document_version` all route through `can_read_document`). The D15 arm
below the dispatch is untouched — **two independent ceilings must now both
hold: the document's own label (D15) and the interview's (this amendment)**.
Re-emit derived from the live `pg_get_functiondef` with pre/post drift asserts
(decision 5's method); prosecdef, pinned search_path, and ACL asserted
preserved in-migration.

**Proof:** 328 K15, authored red-first — K15k1–k4 + K15s1 observed RED on the
real pre-fix catalog (kernel true / RLS have-1-want-0 / corridor caught HC0D8
wanted P0002 / prosrc), beside green controls including K15c1 (the interview
row hidden — the differential's other arm) and the K15t non-over-narrowing
twins (a non-enforcing interview label leaves documents readable). K15g pins
that a `max_confidentiality` clearance re-admits. 311's 5.2b — a syntax pin on
the retired direct dispatch — went red at the migration (its job) and is
re-expressed as the two-hop closure. Blast radius censused, not assumed: the
fresh seed carries ONE interview (`non_phi_internal`); zero enforcing-label
interviews exist locally (the pre-fix live DB's 13 were 12 E2E artifacts + the
seed row, all non-enforcing) and production is pre-pilot empty — the keystones
plant their own enforcing fixture.

## Consequences

- The ceiling governs the whole aggregate through the kernel chain
  (`documents_select`, `document_versions_select`, `document_placements_select`,
  `can_read_document_version`, `can_read_file_object`) — which is exactly why
  DM1 MAJOR-1's uploader-arm removal mattered; a future uploader arm goes INSIDE
  the chain (S1-O3).
- `document_legal_holds` visibility stays OUTSIDE the ceiling (already narrower:
  write-authority governance metadata, no content exposure).
- Zero census-domain delta: no new boolean door, no new policy; the guard is a
  trigger function covered behaviorally (K14 + TWIN-B), never cited to a sweep.
- S2 obligations minted: S1-O1 (open-door ceiling pins), S1-O2 (write-side label
  authority + audited classification change), S1-O3, S1-O4 — ledger in the phase
  record.

# docs-restructure — the ADR 0185 landing record

Hub: [docs/features/docs-restructure.md](../features/docs-restructure.md). ADR:
[0185](../decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md).
This file holds what the hub's 60-line Current-state block cannot: the per-commit record, the
measurements that changed the plan mid-flight, and **the three PO lists** the migration produced.

## Measured facts that changed the plan (2026-09-03)

- **Base branch.** `main` was 106 commits behind `authz-ae4-catalog` and still held the pre-0179
  register, so the branch was cut from the AE4 tip (`cccfb0ba`), not `main`.
- **AE4 kept moving.** Between two `git diff --stat cccfb0ba authz-ae4-catalog` runs minutes
  apart, the register delta grew from +278 to +580 lines and ADRs 0180–0184 appeared. The
  spin-off branch `authz-ae4-scope-reaches-fix` was folded back into AE4 at `eebe1faa`; its hub
  was removed (no branch → no hub, D1) and folded into AE4's. `FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN`
  remained OPEN in AE4's register at the time of measurement despite a commit subject saying
  "FUP resolved".
- **ADR number collision, as predicted by the ADR's own header.** AE4 filed its own `0183`
  (P2 invocation-count re-specification) and a `0184`. This branch's 0183 renumbers at rebase.
- **A false claim of mine, corrected in place** (commit `2c078f74`): the handoff skill does not
  "cite a gate that does not exist"; it says its convention has no gate and names the durable
  form. The paraphrase came from a survey fact sheet and was written into the ADR unread.

## PO list 1 — bugs (from the BUGS.md build; 161 rows)

Histograms at build: status fixed 103 · verified 34 · untriaged 10 · wontfix 8 · open 6 ·
duplicate 0; severity critical 44 · high 41 · unrated 40 · low 24 · medium 7 · catastrophic 5.

### 1a. Untriaged — orphan ids cited in docs, registered nowhere; rule on status and severity

The citing text for most claims a fixed state ("RESOLVED by backend", "closed"); the row does
**not** reflect that claim, because no register ever tracked them. Rule: accept the prose or
require fresh verification.

| ID | Citing file:line | Row severity |
|---|---|---|
| BUG-ACT-AUDIT-PLATFORM-TIER-1 | docs/progress/act-as-role-assumption.md:506 | unrated |
| BUG-ACT-NULLHAT-1 | docs/progress/act-as-role-assumption.md:947 | unrated |
| BUG-AUTHZ-FOOTPRINT-ASYMMETRIC-READ-LIFTS-THE-D2-LOCK | docs/progress/authz-ae2.md:1311 | unrated |
| BUG-CAPA-AUDIT-SCOPE-1 | docs/progress/act-as-role-assumption.md:525 | medium |
| BUG-NPH-003 | docs/progress/nsp-per-hospital.md:48 | unrated |
| BUG-QOB-001 | docs/progress/quality-office-oversight-phase-b.md:79 | **catastrophic** |
| BUG-QOB-002 | docs/progress/quality-office-oversight-phase-b.md:138 | critical |
| BUG-SUP-002 | docs/reviews/s1-sup-supersession-review.md:3 | critical |
| BUG-UREG-002 | docs/decisions/0048-user-registration-identity.md:148 | unrated |
| BUG-UREG-003 | docs/decisions/0048-user-registration-identity.md:189 | critical |

### 1b. Unrated (40) — no severity word, emoji or D4-definitional match in the source

Applied strictly: only a literal CRITICAL/BLOCKER/🔴/MAJOR/🟠/🟡/MINOR/🟢, or a described PHI /
cross-tenant / data-loss event, earned a rating. A bug that *reads* as serious but carries none of
those was left `unrated` rather than guessed.

BUG-A11Y-001 · BUG-ACT-ACL-1 · BUG-ACT-AUDIT-PLATFORM-TIER-1 · BUG-ACT-HATBLIND-001 ·
BUG-ACT-NULLHAT-1 · BUG-AFF-1 · BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS · BUG-AUTHZ-001 ·
BUG-AUTHZ-002 · BUG-AUTHZ-FOOTPRINT-ASYMMETRIC-READ-LIFTS-THE-D2-LOCK · BUG-CASEKIND-001 ·
BUG-DM4-DUP-1 · BUG-DM5-CAPA-1 · BUG-DM5-S3-ENV-FIXTURE-POOL-1 · BUG-DM5-S3-INACTIVE-PRINT-1 ·
BUG-DM5-S6-EVID-KBD-1 · BUG-E2EISO-001 · BUG-E2EISO-002 · BUG-E2EISO-003 · BUG-ETHE4-FOCUS-1 ·
BUG-FF1-006 · BUG-FF1-007 · BUG-FF2-001 · BUG-FF4-001 · BUG-GATE-001 · BUG-MIN-E2E-1 ·
BUG-NPH-003 · BUG-P15-001 · BUG-P16-005 · BUG-P22-001 · BUG-P22-002 · BUG-PDF2-002 ·
BUG-QOB-003 · BUG-QOB-004 · BUG-RCA-001 · BUG-RDR-001 · BUG-REFNOTE-001 · BUG-RESP-001 ·
BUG-TV-001 · BUG-UREG-002

### 1c. Rated `catastrophic` (5) — from the source's own description, not its severity word

- **BUG-QOB-001** — `untriaged`. `responses_admin_all` let a tenancy admin DELETE other users'
  in-progress work (the source carries a `[CAT]` tag).
- **BUG-ACT-EXPIRY-1** — `fixed`. Expired `staff_admin` could write into another org's vocabulary.
- **BUG-NSP-002** — `fixed`. `get_referral_detail` served PHI referral bodies to metadata-only readers.
- **BUG-NSP-003** — `fixed`. A walled-off `platform_admin` could list a tenant's target commissions;
  source word was MAJOR, overridden by the cross-tenant-read definition.
- **BUG-QO-001** — `fixed`. A `quality_reviewer` read case-attachment PHI bytes via a storage policy
  + service-role door.

### 1d. Status defaulted under uncertainty — spot-check

- **BUG-DM5-CAPA-1**, **BUG-DM4-DUP-1** — their section's heading emoji marks open/closed, not
  severity (a different convention from the rest of the archive). Defaulted to `fixed` / `unrated`
  from the prose; check against `docs/progress/dm5-po-decisions.md`.
- **BUG-DSR-AGENDA-TITLE-STALE-PIN** — two extraction passes disagreed (`verified` vs `fixed`);
  kept `verified` / `low`, opened = closed = 2026-08-21.
- **BUG-PROD-ACTIONS** — kept `open` although the citing text found a likely root cause and re-ran
  the repro green, because the tester explicitly declined to close it.
- **BUG-FBE-005 — id reused for two unrelated bugs** in the archive (a stale Playwright selector,
  and a client-bundle-breaking server-only import). The register holds one row, for the more
  severe second incident; the first is readable only in the archive body. Rule: rename one
  occurrence in the archive, or accept the row as covering the second only.

## PO list 2 — follow-ups (from the scripted normalization; 156 register entries, 35 backlog entries)

The live lists are **greps, not copies** (ADR 0179's principle — nothing generated to go stale):

```bash
grep -n "Closes when:\*\* PO to rule" docs/followups/follow-ups-open.md      # 111 at normalization; 114 after AE4's 9 new entries
grep -n "Revisit when:\*\* PO to rule" docs/followups/deferred-backlog.md    # 27 at normalization; 26 after one resolved item left
grep -n "Owner:\*\* PO to rule" docs/followups/follow-ups-open.md           # 5 at normalization
```

The **111** is the survey's 68 re-derived by the pass that had to write the clause: a keyword
match is not a derivable condition.

## Landing record

- **Commit A / A2** (ADR + visible correction) and **commit B** (gate + registers) landed on the
  branch; the branch was then **rebased onto `authz-ae4-catalog` @ `3b21826b`** (one conflict:
  the archive's tail, both sides appended; the 9,000-line register auto-merged, and the idempotent
  normalization script normalized AE4's 9 new entries in place — 0-line diff on re-run).
- **ADR renumbered 0183 → 0185 at the rebase**: AE4 had filed its own 0183 and 0184 while this
  branch was in flight. 37 references repointed; the ADR's Number paragraph records the event.
- **One red shipped and was corrected in the next commit** (`6135abab`): commit B' landed with
  `lint:registers` red on ADR 0184's handoff citation because the gate ran through a pipe to
  `tail`, which erased its exit code — the pipe lesson, hit live.
- **Commit C** (this working tree): the PROGRESS.md cut, the moves, the Critical pin, six § Now
  items filed as entries (`FUP-AUTHZ-AE3-CUTOVER-OPERATOR-OBLIGATIONS-OWED`,
  `FUP-ENV-LINT-AUTHZ-VECTORS-NEEDS-PYTHON3`, `FUP-ENV-STALE-ORIGIN-BRANCH-C2-TIER1-NEUTRALIZER`,
  `FUP-ENV-NVM-DEFAULT-NODE-20-KILLS-GATE-8`, `FUP-DISPOSAL-RUNBOOK-THREE-CORRECTIONS-OWED`,
  `FUP-AFF4-RESIDUE-UNFILED`), the archives' final rotations, and the CLAUDE.md edit held for the
  PO's diff approval.

### 2a. Re-ratings under D4 — confirm or overturn

- **🔵 → high:** `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` — a mutation-audit arm that was a silent no-op,
  absorbed into Critical FUP C2; blocks confidence in a standing gate, not a live wrong answer.
- **🔵 → low:** `FUP-ADR0121-REASON-VALUE-DRIFT` — register prose pre-empted an ADR's reserved
  decision; its own text says nothing is built on the drift.
- **▶ → low:** `FUP-E2E-1`, `FUP-FF2-3`, `FUP-FF1-2`, `FUP-FF1-1` (pre-D4 marker, each "blocks
  nothing" / non-blocking by its own heading). **▶ → medium:** `FUP-MIN-CUTOVER`. **⬛ → critical:**
  `FUP-DM5-NO-ANSWER-VS-NOTHING` (matches its own pre-closure 🔴; retained as a review lens).
- **No emoji → medium (default, unconfirmed):** `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE`,
  `FUP-E2E-CREATEFRESHCASE-SILENT-NULL`, `FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG`.

### 2b. 🔴 → ⛔ `catastrophic` (data-loss definition)

- `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` — "the pilot platform has NO Storage recovery point at all".
- `FUP-ETHICS-CASE-DELETE-CASCADE` — `staff_admin` DELETE cascades 7 `ethics_*` tables with zero
  audit rows. ⚠ ADR 0170 (2026-08-31) may already address it; flagged on the literal definition.

### 2c. Structural findings — rule on which record survives

- **`FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS` is registered twice**, near-identical bodies in the
  open register and the backlog (pre-existing; gate 7 warns, does not red). Retire one.
- **Deleted, not converted:** the backlog's 26-line "Parked items — index lines verbatim" block —
  a self-referential index of the 35 items whose bodies sit above it (the removed lines were
  verified to be `→ [detail](deferred-backlog.md)` pointers into the same file). Converting it
  would have re-created the double registration ADR 0179 removed.
- **Moved to the archive:** the backlog's one already-resolved item ("RESOLVED 2026-07-14 —
  Action-items case cross-link UI + `visibility_scope` toggle") — a resolved item's home is
  `follow-ups-archive.md`, not a parked register.

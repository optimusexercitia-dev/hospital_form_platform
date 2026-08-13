# DM1 — substrate cutover: phase record (backend task log)

> Program: Document Model Redesign (ADR 0114; plan
> [document-model-redesign.md](../plans/document-model-redesign.md); approved
> implementation plan
> [dm1-substrate-cutover-plan.md](../plans/dm1-substrate-cutover-plan.md);
> decisions ADR 0116 — pending, written at M2–M6 landing).
> Branch: `docs/dm1-plan-amendments` (PO: nothing to `main`, nothing remote).
> Backend-owned file; the lead owns the Phase Status table.

## Task log

| # | Task | Status | Evidence |
|---|------|--------|----------|
| T1a | Suite `328` K1/K2/K8 authored + observed **RED pre-M1** | ✅ 2026-08-12 | §Red-first record below |
| T1b | M1 `20260923000100_dm1_drop_attachment_substrate.sql` (6 patches + drop set) | ✅ 2026-08-12 | applied clean; 328 → 20/20 |
| T1c | `seed.sql` surgery (3 fixture inserts + `attachments` flag flip removed; frozen-snapshot fixture kept, provenance NULL) | ✅ 2026-08-12 | fresh `db reset` exit 0 |
| T1d | `208_attachments.sql` deleted (coverage → 328 now, DM2 specs later); allowlist hygiene (blind-allowlist −2 policies, neverclled −2 doors, unswept-backlog ERROR resolved-by-deletion note) | ✅ 2026-08-12 | commit message carries the justification |
| T1e | FUP-DM1-E2E + FUP-DM1-DISPOSE filed (index + body) | ✅ 2026-08-12 | PROGRESS.md + follow-ups.md |
| T2 | M2 `securable_resources` + pins + backfill + triggers | ✅ 2026-08-12 | §Turn-2 record below; ADR 0116 §2–4 |
| T2b | M3 core tables + guards + K3/K7 keystones + guard twins | ✅ 2026-08-12 | 328 = 43/43 planned/ran on BOTH stacks; 3 twins proven |
| T3 | M4 kernel + RLS · M5 buckets · M6 audit/flags · `gen:types` | ✅ 2026-08-12 | §Turn-3 record; 328 = 70/70 both stacks |
| T4 | 328 K4/K5/K6/K9/K10 + mutation twins 4–6 | ✅ 2026-08-12 | pulled into turn 3 (lead watch-item 2: K4 lands WITH the policies) |
| T5 | pgTAP triage (16 files incl. 2 outside the attachment grep) + full `test:db` green | ✅ 2026-08-12 | `All tests successful. Files=188, Tests=5909, Result: PASS` — the count AT THAT RUN; current tree = **5927** after K11/K12/K13 (QA r1 MINOR-4). Verdict read from the pg_prove summary, never the exit code; §triage ledger |
| T5b | Repo-wide changed-identifier sweep across src/ (relations + routines + bucket literals, not just RPC sites) | ✅ 2026-08-12 | beyond rca.ts: ONE more live-code find — `getCaseDocumentDownloadUrl` (legacy-bucket cookie signer, ZERO callers) parked to null; everything else = comments/JSDoc + the deliberately-historical audit vocabulary in `queries/audit.ts` + legacy consts in `attachments/constants.ts` (types still consumed by the stubs/UI) |
| T6 | TS stubs + wrapper patches + lint/typecheck/vitest | ✅ 2026-08-12 | pulled into turn 3 (lead watch-item 3: stubs land with gen:types); lint 5-gate 0/0 · tsc 0 · vitest 1254/1254 |
| T7 | Authz arms (census fail→verdicts→green, hat, floor, FROMFINDINGS wrapper) + diff-scoped door sweep (case count checked nonzero) | ✅ 2026-08-12 | §Turn-7 record: all four arms HOLD, exit 0 each; sweep 13 executed / 12 COVERED / 1 BLIND→keystoned→COVERED / 0 ERROR |
| T8 | QA r1 fix turn: MAJOR-1 + MINOR-1/3/4 + overstatement-2 wording + MINOR-2/5 recorded | ✅ 2026-08-13 | §Turn-8 record below |

## Red-first record (lead condition 5)

Suite `328` was authored and run against the **pre-M1** catalog (2026-08-12, HEAD
`61bb0ce`, 361 migrations, fresh stack). Observed:

- **K1 — all 7 sub-assertions RED**, `have` vs `want 0`:
  K1a routines **12** (14 `%attachment%` minus the 2 allowlisted) · K1b policies
  **6** (9 minus 3) · K1c relations **3** · K1d client EXECUTE grants **12** ·
  K1e surviving bodies referencing dropped routine names **7** · K1f surviving
  bodies referencing dropped relations **8** · K1g storage policies quoting the
  `attachments`/`attachments-phi` bucket literals **3**.
- **K8 — all 3 RED with `caught: no exception`**: `add_referral_shared_item`
  (document arm), `add_rca_evidence` (document citation),
  `issue_ethics_notification` (related document) each **succeeded** pre-patch —
  the genuine the-arm-was-live red, not a wrong-arm error (§7.1 shape 1/3 avoided
  by full valid fixtures: seeded draft-referral fixture + seeded RCA
  `f3000000-…a3` + seeded ethics case `ca000000-…e1`).
- K2 (7 allowlist pins) + 3 flag preconditions green on both sides by design.
- Run shape verified: `1..20` planned, 20 ran, 0 aborts (pre-M1). ⚠ One §7.15
  instance caught in-turn: the FIRST post-reset run aborted at `test_helpers`
  (schema is minted by `00_setup.sql`, wiped by reset) and printed 17 ok with no
  `not ok` — rerun with setup applied: **20/20, abort-free**.

Post-M1: 328 = **20/20 green** (post-`migration up` AND post-fresh-reset).
Mutation twin (K1): `app.probe_attachment_stub()` created in a txn → K1a count
**1** (red); rollback → **0**. Rollback verified before trusting the harness.

## Turn-2 record (M2 + M3, 2026-08-12)

- **Backfill proven on the POPULATED stack** (lead watch-item 1): M2 applied via
  `supabase migration up` against the seeded DB (8 cases / 3 meetings /
  1 interview / 1 action_item present BEFORE the migration) — registry counts
  after: case 8 · meeting 3 · interview 1 · action_item 1; anti-join **0**;
  reverse orphans **0**. The fresh reset exercises only the TRIGGER path (the
  backfill is a no-op on an empty DB forever); 328 K3 asserts both directions
  on both paths.
- **RESTRICT fail-safe witnessed now, not in DM2** (lead watch-item 2):
  keystone K3g hand-plants a document on a fresh case → `DELETE` the case →
  **23503** (AFTER DELETE trigger → `documents.home_resource_id` RESTRICT);
  K3h/K3i: remove the document → delete proceeds → registry row swept. The
  K3g/K3h pair is differential (same statement, one variable), self-proving.
- **328 = 43/43, planned 43 / ran 43, zero aborts**, on the populated post-M3
  stack AND on the fresh post-reset stack (run-shape checked on both).
- **Guard mutation twins (each in a rolled-back txn, rollback verified):**
  TWIN1 drop `trg_ensure_securable_resource` → case insert fails **23503**
  (the composite pin fails closed without the mint trigger — the two halves
  hold each other) · TWIN2 drop `guard_file_object_transition` → a born-clean
  insert **succeeds** (K7c would red — the guard is load-bearing) · TWIN3 drop
  `guard_document_version_immutable` → a version UPDATE **succeeds** (K7g1
  would red). K7h1–h3 (hold blocks) are differential by construction
  (hold present → HC0D3; released → proceeds).
- Guard SQLSTATEs minted: HC0D1/HC0D2/HC0D3/HC0D4 (ADR 0116 §5).

## Turn-3 record (M4 + M5 + M6 + gen:types + TS, 2026-08-12)

**Tenant-deletion measurement (lead follow-through on turn 2):** the "commission
delete traverses the new pins" question dissolves against reality — **commission
hard-deletes were ALREADY impossible pre-DM1**: the fixture's own Rule-11 audit
rows block via `audit_log_commission_id_fkey` (DEL1, measured; `audit_log` is
append-only, so this holds for any commission with audited children). DEL2's
block printed the same constraint — a §7.1 wrong-arm claim avoided by reading
SQLERRM, so "blocked once a document hangs off it" is NOT provable at commission
level and is not claimed. What IS proven: **DEL3 — all four DOMAIN-row types
delete cleanly through the pins** (the level deletes actually happen: RPCs, E2E
teardowns), registry swept 4→0; and the document RESTRICT backstop at
domain-row level (K3g, turn 2). Suite `276` deletes a commission expecting
`23503` errcode-only → stays green regardless of which constraint fires; no
triage mis-attribution risk.

**Landed:** M4 kernel (6 DEFINER doors; `can_read_document` with **no is_admin
arm**, dispatch = the same predicate FAMILY as the retired dispatchers — QA r1
found an immaterial commission-admin OR-arm delta, ADR 0116 §12) + the 8
SELECT policies (one per table, kept falsifiable); M5 buckets (private, F2-
mirrored caps/MIME; INSERT-only reservation-bound; **zero SELECT**); M6
`document.opened` dispatch arm + allowlist entry + 5 flags OFF (targeted
`on conflict`). `gen:types` regenerated (+524/−375, pgtap dropped first).

**328 = 1..70 → ran 70 / ok 70 / 0 aborts** on the populated post-M6 stack AND
on the fresh post-reset stack. One §7.15 catch in-turn: the K5f `is_active`
flip aborted the file at 49/69 (profiles guard vs. lingering claims — fixed
with the 231 clear-claims dialect); caught by the run-shape check, which is the
point of reporting it.

**Mutation twins (rolled back, rollback verified):** TWIN4 kernel neutralized
to `return true` → platform_admin reads 1 (K5d reds) · TWIN5 smuggled SELECT
policy on `documents-phi` → K6b count 1 (reds) · TWIN6 permissive sibling on
`documents` → K4b count 10 (reds).

**Census registration debt for T7 (the turn-7 sweep list, named now):** 6 new
boolean DEFINER doors (`can_read_document`, `can_write_document`,
`can_read_document_version`, `can_read_file_object`, `can_read_document_hold`,
`storage_upload_reserved`) + 10 new policies (8 table + 2 storage INSERT) + the
6 M1/M6-rewritten function bodies. `ARM=census` is expected to FAIL before
their verdicts are appended — that failure is required evidence.

**Two recorded deviations from the approved plan (ADR 0116 §8–§9; lead-ack'd
2026-08-12):** (1) SIX kernel doors, not the plan's three — the three extras
are policy RESOLVERS (an inlined EXISTS chain would recurse through RLS with
the caller's privileges); the census debt figure is 6. (2) The plan's
"REVOKE … FROM authenticated" on the doors was WRONG — policy predicates
evaluate with the querying role's privileges, so `authenticated` EXECUTE is
required; shipped posture matches the policy-referenced siblings exactly
(PUBLIC/anon revoked), `app` is not PostgREST-exposed, and a comment-stripped
sweep found zero `public` wrappers reaching any of the six.

**TS surgery (signatures stable, all fail closed):**
`src/lib/attachments/actions.ts` + `src/lib/queries/attachments.ts` → parked
stubs; the dead RPC blocks replaced in `src/lib/cases/documents-actions.ts`,
`src/lib/meetings/actions.ts`, `src/lib/interviews/actions.ts` (link half of
interview attachments kept LIVE on `case_interview_links`); **discovery:**
`src/lib/queries/rca.ts` read the dropped table for the RCA citation-target
picker — document candidates removed (Wave D restores; matches the K8b writer
guard); `src/lib/audit/access.ts` emitter union drops `attachment.read`;
`src/lib/queries/audit.ts` keeps the `attachment.*` vocabulary as HISTORICAL
(append-only log renders forever) and adds `document.opened`. Gates: lint
five-gate 0 errors/0 warnings · tsc clean · vitest 1254/1254.

**Runtime note (recorded, not user-visible in prod):** interview LINK
attachments remain gated by the `attachments` flag (F2 fold) — dark locally
now exactly as in prod since 2026-08-11; whether links ride `documents_wave_a`
or get their own gate is a Wave A decision.

## Turn-4/5 triage ledger (full `test:db` → 15 failing files → every red attributed BY NAME, 2026-08-12)

First full run: `Files=188, Tests=5240, Result: FAIL` — 10 mid-file ABORTS (Bad
plan) + 5 genuine assertion failures. ⚠ Method note: `npm run test:db | tail`
returned exit 0 (tail's, not the suite's — the known masking scar); the verdict
was read from the pg_prove summary, never the exit code. A second §7.15 catch:
the first per-file diagnostics printed NOTHING because the harness had dropped
pgtap on exit — visible only because the raw head was checked.

| Suite | Red shape | Named cause | Disposition |
|---|---|---|---|
| 144 | abort 0/91 | fixture INSERT into dropped `public.attachments` (case-doc ACL pair) | re-pointed 1:1 → case-homed `documents` row (`can_read_document` = `can_read_case`) |
| 150 | abort 0/217 | snapshot-source attachment fixture + 2 document-share calls | fixture removed; **in-flow HC0DM pin ADDED (+1, plan 218)**; frozen item inserted directly (`source_document_id` NULL — the DM4 reconciliation shape); r2 shares a narrative |
| 171 | abort 10/76 | platform-WALL census line on the dropped table | re-pointed → `documents` (328 K5d is the behavioral pin with a fixture row) |
| 191 #22 | genuine | **§7.2 instance, mine**: the M6 comment inside `log_audit_access` quoted the removed verb; 191's completeness parser reads EVERY quoted dotted literal, comments included | M1+M6 comments reworded; ⚠ the FIRST rewording itself contained a matching two-letter dotted literal — caught before commit (the "inside the comment warning about it" scar, live) |
| 191 §4 | abort 24/26 (masked in run 1 by #22 — TWO distinct defects in one file) | the F2 triple-mirror pair's fixture inserted into the dropped table | re-pointed 1:1 → the successor verb on a meeting-homed document (same C-4 forge-guard contract: entitled member logs, cross-commission caller 42501); verbs built via format() so the file cannot counterexample its own 3.10 parser |
| 193 #3 | genuine | hardcoded-6 FK census counted `rca_evidence_cited_document_id_fkey` (died with the table) | census → 5 with a tombstone naming the parked-column guards + Wave D re-entry |
| 197 | abort 0/24 | fixture + assertion 1.11 on `dispose_case_phi`'s removed redaction seam | retired with an in-file FUP-DM1-DISPOSE tombstone (plan 23); the disposal contract returns in DM2 |
| 228 | abort 35/132 | confidentiality-ceiling fixtures + `open_attachment` probes (tests 36–40) | **NAMED COVERAGE LOSS** — see below; the block's `grant_ca` was FIXTURE for test 101 (first rerun caught the dependency at 126/127) and is kept; plan 127 |
| 229 | abort 47/89 | fixtures + 8 exclusion-arm asserts + the reclassify §W-2.5 block | exclusion arms re-pointed 1:1 → `can_read/write_document` on homed documents (the kernel copied the arms verbatim); reclassify block retired → DM2 obligation; plan 85 |
| 231 | abort 55/80 | `can_write_attachment` action_item is_active triple + the structural name list | re-pointed → `can_write_document` (same raw assignee arms; `is_active` in CODE asserted); plan unchanged 80 |
| 235 #21 | genuine | the positive twin read bytes via the dropped store's SELECT policy | replaced with a superuser-census non-vacuity (per D8, byte reads are door-only for EVERYONE now — no entitled-principal twin is satisfiable anywhere, by design) |
| 238 #31-32 | genuine | `reclassify_attachment` fence probes (RPC dropped); `attachments` in the flag-enable list | fence retired → DM2 obligation; flag out of the list; plan 31 |
| 296 #16 | genuine | **MY composite pin FK** `cases_securable_resource_fk` unindexed per the sweep's leading-columns rule | exempted BY REASONING in-file: the FK's first column is the UNIQUE pkey, so the seq-scan-cascade hazard the sweep hunts cannot arise; a dedicated index would duplicate the pkey |
| 308 | abort 21/33 | §5 bytes layer (storage objects + the `open_attachment` resolve door) | 5.1 re-pointed → documents (PRESERVED); 5.2–5.7 retired → the six pins named as DM2 door obligations; plan 27 |
| 311 | abort 3/39 | interview-owned attachment fixture + 3 asserts + the `can_read_attachment` catalog pin | re-pointed 1:1 → interview-homed document + `can_read_document` catalog pin (same committee-arm regex) |
| 314 | abort 46/120 | 8.3/8.4 tenancy-wall probes on `can_write_attachment` | re-pointed 1:1 → `can_write_document` on a case1-homed document (same wall: no tenancy arm) |

**DM2 keystone obligations minted by this triage (the retired coverage's named
new home — DM2's gate must check these off):**
1. `reclassify_document_file`: excluded-party deny + clean-coordinator positive
   twin (from 229 §W-2.5) AND the ceiling-label rejection fence (from 238 K8a/b)
   — in whatever label vocabulary DM2 defines.
2. `open_document_version`: the six byte-discrimination pins (from 308 5.2–5.7)
   — reviewer resolves nothing / capability-grantee resolves / coordinator
   non-vacuity twin, at the serving layer AND as door resolve-shape. **PLUS
   (QA r1 MINOR-3) the E2E-level M8 bytes-cut contract deleted from
   `quality-oversight.spec.ts`** (4 `expect()`s, 137→133: the reviewer sees
   the doc title while the audited download door renders for `canDownload`
   only / is absent otherwise) — restored against the new door in DM2's
   rewritten specs.
3. `dispose_case_phi` → document disposition keystone (FUP-DM1-DISPOSE; 197
   regains 1.11's successor).
4. ~~OPEN (PO/lead)~~ → **UPGRADED by the lead 2026-08-12 to 🔴 FUP-DM1-CEILING,
   BLOCKING DM2 Wave A** (a live ADR 0072 D7 NARROWING control the document
   model cannot express — not a coverage loss). Full body in follow-ups.md;
   ADR 0116 §10 names the dropped enforcement mechanism; discharge = a PO
   ruling recorded as an ADR 0114 amendment. 228's block stays retired until
   the control exists.
5. **(QA r1 MINOR-2)** `document.opened` inherits `_audit_access_authorized`'s
   pre-existing `is_admin()` short-circuit: QA measured a platform_admin
   minting a `document.opened` audit row for a document it CANNOT read (no
   read leak — the registry is laxer than the kernel, an all-18-arms
   property the function body itself documents). The body's own named
   mitigation is the contract: **`open_document_version` must gate BEFORE
   recording** (the `read_minutes_transcript` pattern, noun rule A35) —
   deliberately NOT changed in DM1 (pre-existing behaviour; touching the
   dispatch now would widen an inert phase's blast radius).
6. **(QA r1 MAJOR-1 consequence)** uploader visibility on `file_objects`, if
   Wave A wants it: add the arm deliberately — INSIDE the ceiling's reach,
   with its own keystone (K13 currently pins the absence).

(Also noted: the historical q1 phase harness's `open_bytes_cut` /
`open_resolver_door` cases reference retired surfaces — a phase harness, not a
standing gate; `276`'s commission-delete `throws_ok('23503')` is errcode-only
and green regardless of which constraint fires.)

## Turn-7 record (the authz arms, 2026-08-12)

- **FUP-DM1-CEILING re-filed per the lead's upgrade** (🔴, blocks DM2 Wave A;
  body in follow-ups.md; index row in PROGRESS.md; ADR 0116 §10 names the
  dropped enforcement mechanism from the phase's own decision record). 228's
  retired block stays retired.
- **`ARM=census` REQUIRED-FAIL captured** (fresh reset, pre-verdicts):
  `INVARIANT VIOLATED — 15 gates UNKNOWN`, naming exactly the 6 new doors + 9
  new SELECT policies. ⚠ The two storage INSERT policies
  (`documents_std/phi_obj_insert_reserved`) are in NO sweep's domain by
  construction (the FUP-AUTHZ-WP-SNAPSHOT structural hole: the door audit
  filters `polcmd in ('r','*')`, the write-path arm has a hardcoded worklist) —
  their coverage is BEHAVIORAL and mutation-proven: 328 K6d–K6h + TWIN5
  (smuggled SELECT policy → K6b red) + K6h (unreserved INSERT → 42501). Never
  cite a sweep for these two.
- **K11 added before the sweep** (15 read-pair keystones through every
  resolver door + chain policy; plan 70→85): the sweep's one-at-a-time
  neutralizations are K11's mutation proof. ⚠ K11h's first draft went RED on a
  wrong-arm fixture — bare membership does NOT confer case-read on a fresh
  case under the capability lattice; re-pointed at a seeded-case chain where
  the member holds a real content source. 328 = 1..85 → ran 85 / ok 85 / 0
  aborts.
- **Diff-scoped ARM-1 door sweep** (16-token CASES; baselines 5924/5926 — the
  +15/+17 vs turn-4/5's 5909 are K11/K12 by name, i.e. the CURRENT tree):
  **13 cases executed → 12 COVERED + 1 BLIND + 0 ERROR.** The case-count
  check paid twice: (a) `document_retention_select` skipped-by-design
  (qual=true → the Skipped catalog list, census-parsed); (b)
  **`storage_upload_reserved` + `_audit_access_authorized` NEVER RAN** — the
  known RDR name-prefix harness blind spot (`^(is_|can_|has_)`); neither
  inferred green: `storage_upload_reserved` got a TARGETED MUTATION
  (open→true in a rolled-back txn → K6d/K6f flip → keystones red; restore
  catalog-verified) and a cited COVERED row; `_audit_access_authorized` keeps
  its standing name-keyed verdict + K10a–d behavioral pins. ⚠ A 17th
  implicit match I predicted (`case_documents_select_member` via substring)
  did NOT occur — matching is exact; reconciled count = 13 executed of 16
  requested, fully accounted.
- **`securable_resources_select` came back BLIND — a real finding, keystoned
  not allowlisted:** K12 pair added (member reads own-commission registry
  rows / foreign staff_admin reads 0), 328 → **1..87, ran 87 / ok 87 / 0
  aborts**; single-case re-sweep → **COVERED** (the observed BLIND is K12's
  red-first evidence).
- **Restore verified from the CATALOG before any arm ran** (lead condition):
  all 6 predicates carry full non-neutralized bodies (arm-pattern positive
  checks incl. the two my first regex missed), all 8 policy quals real
  (`qual <> 'true'`), plus 87/87 behavioral. No gate left open.
- **Findings hand-merge** (restore-then-append per the MIN/PDF·P2 precedent):
  committed file restored via `git checkout --` (the 8-line subset-overwrite
  partial never staged), 14 verdict rows + the retention Skipped bullet +
  a DM1 note block appended. ⚠ Two census-parser traps hit and fixed in the
  merge: pgtap-installed inflated the census domain 548→729 (dropped before
  re-run — the gen-types-pollution scar, census edition), and the Skipped
  bullet regex is $-anchored (my trailing annotation broke it; note moved to
  its own line).
- **The arms, each by name (no tail pipes; exit codes read separately):**
  - `ARM=census` — **required-FAIL captured pre-verdicts: the UNKNOWN set was
    EXACTLY the 15 new gates and nothing else** — which simultaneously proves
    the census sees every new door AND rules out unrelated catalog drift
    (nothing pre-existing lost its verdict; QA r1 notes the record first
    UNDERstated this). Then post-merge: **INVARIANT HOLDS, exit 0** (548 live
    gates / 568 verdicts).
  - `ARM=hat` — **INVARIANT HOLDS, exit 0**.
  - `FROMFINDINGS=1 ARM=wrapper` — **INVARIANT HOLDS, exit 0** (BLIND set
    41 ⊆ allowlist; DM1 added zero public INVOKER wrappers).
  - `ARM=floor` — **INVARIANT HOLDS, exit 0** (77 never-called doors, all
    allowlisted; DM1 added no authenticated-reachable public DEFINER door and
    removed five).
  - The write-path `ARM=policy` subset was **deliberately NOT run**: the DM1
    diff contains no gate inside its hardcoded worklist, so it would print
    `BLIND: 0` over ZERO cases (the FUP-AUTHZ-WP-SNAPSHOT no-op) — stated
    per the case-count rule; the two storage INSERT policies are covered by
    328 K6d–K6h + twins, never by a sweep citation.

## Turn-8 record (QA r1 fix turn, 2026-08-13)

- **MAJOR-1 — uploader arm REMOVED from `app.can_read_file_object`** (chain-only
  now; reasoning in ADR 0116 §11). Red-first held: **K13 authored first and
  observed RED against the pre-removal catalog** (`have: 1, want: 0` — the arm
  was live), then the removal (M4 file + live body together;
  properties preserved: prosecdef + pinned search_path catalog-verified), then
  **328 = 1..88 → ran 88 / ok 88 / 0 aborts**. Mutation twin: arm re-added in a
  rolled-back txn + an unbound file planted → uploader-visible = true (K13
  would red); rollback verified (`created_by` absent from the stripped body).
  ⚠ Twin discipline caught twice en route: the first twin probe used a null
  uid (vacuous — the outer gate short-circuits) and was redone with a real
  planted row; and the first live apply SILENTLY DID NOTHING — `docker exec`
  without `-i` discards the heredoc and psql exits 0 having read no stdin —
  caught by the catalog probe, not the exit code.
- **Diff-scoped sweep over the touched door**: `can_read_file_object` →
  **COVERED** (baseline Files=188 Tests=**5927** = 5926 + K13, accounted;
  **1 case executed** — nonzero, per the case-count rule). Findings row
  updated on the `git checkout --`-restored file (restore-then-append).
- **MINOR-1**: ADR 0116 §8 rewritten — each of the six doors described
  accurately ("resolver" was true of only `can_read_document_version`;
  `can_write_document` and `can_read_document_hold` carry independent
  authorization arms; `storage_upload_reserved` is not in the read chain).
- **Overstatement 2**: "exact predicate set" corrected to "same predicate
  FAMILY" in M4's header, the turn-3 record, and ADR 0116 §12 — QA's
  comparison found a commission-admin OR-arm delta on the retired
  meeting/interview arms, verified immaterial (the staff_admin hat reaches
  via the retained membership arms); conclusion unchanged, wording fixed.
- **MINOR-3**: FUP-DM1-E2E item 3 corrected — the four `quality-oversight`
  assertions were DELETED (137→133 `expect()`s; zero commented-out expects,
  re-verified against the file), not "preserved as a comment"; the M8
  bytes-cut contract they carried is now NAMED in DM2 obligation 2.
- **MINOR-4**: stale `5909` annotated at both phase-record sites; current
  tree figure is **5927** (none in ADR 0116).
- **MINOR-2 recorded, not fixed** (obligation 5): `document.opened` inherits
  the registry's `is_admin()` short-circuit — platform_admin can mint an
  audit row for a document it cannot read (no read leak); DM2's
  `open_document_version` must gate BEFORE recording.
- **MINOR-5 verified with the mechanism**: `npm run typecheck` (= `tsc
  --noEmit`) fails on exactly 4 errors, ALL in generated
  `.next/types/validator.ts` — a route-manifest SKEW between two generated
  trees: `.next/types/routes.d.ts` (prod-build era, 22:21, carries the
  `cases/[caseId]` layout routes) vs `.next/dev/types/routes.d.ts` (dev-server
  era, 22:38, lazily generated per visited route — carries zero). The
  validator imports both. Zero first-party errors; a fresh `next build` (or
  wiping `.next`) re-coheres it; pre-existing generated-artifact class, not a
  DM1 defect. (And the probe itself: `npm run typecheck | tail` prints exit 0
  — tail's; the real exit is nonzero. Same scar, caught again.)
- **Census understatement fixed** (QA's addition): the required-fail named
  EXACTLY the 15 new gates and nothing else — also ruling out unrelated
  catalog drift.

## PROD-VERIFY checklist (lead condition 2 — for the later lead-authorized `db push`; NO remote action was taken this phase)

Before/with applying `20260923000100` to the remote:

1. `attachments` table has exactly the **4 dangling rows** of the 2026-08-11
   census and both `attachments`/`attachments-phi` buckets are still **empty**
   (Storage API count, not `storage.objects` guesswork).
2. `rca_evidence`: **0 rows** with `cited_document_id IS NOT NULL` — the new
   CHECK `rca_evidence_cited_document_parked` validates existing rows at ADD; a
   nonzero count aborts the push → escalate to the lead, do not NULL blindly.
3. `ethics_decision_details.decision_letter_document_id` /
   `ethics_notifications.related_document_id`: expect **0 non-null** (local: 0).
4. `referral_shared_item.source_document_id`: record the non-null count (the
   census's "1 frozen path referencing no object" is expected here; the FK drop
   tolerates it — DM4 reconciles).
5. `meeting-attachments` bucket absent in prod (expect no-op; record).
6. Post-push: re-run the K1 catalog queries against the remote (the 7 counts
   must be 0 there too) and confirm `case_documents_select_member` +
   `app.can_read_snapshot_document` survive.

## Parked seams (what DM1 deliberately left behind)

| Column | Protection after DM1 | Re-point owner |
|---|---|---|
| `referral_shared_item.source_document_id` | no authenticated write policy + `add_referral_shared_item` document arm raises `HC0DM` | DM4 |
| `rca_evidence.cited_document_id` | CHECK `rca_evidence_cited_document_parked` + writer raises `HC0DM` (table has a live authenticated FOR ALL write policy — the CHECK is load-bearing) | Wave D (DM5) |
| `ethics_decision_details.decision_letter_document_id` | SELECT-only grants; no writer exists | **OPEN — plan Q1 (PO)** |
| `ethics_notifications.related_document_id` | SELECT-only grants + `issue_ethics_notification` raises `HC0DM` | **OPEN — plan Q1 (PO)** |

`HC0DM` is the parked-seam SQLSTATE minted for this program (distinct code so the
K8 keystones cannot be satisfied by a neighboring validation error — §7.1).

---

## Gate steps 2–5 (lead-run, 2026-08-12/13)

> Rotated out of PROGRESS.md at the Record step. Everything below existed
> **nowhere else** — the `e2e:prod` accounting and the AC-10 triage were run by
> the lead, not by a teammate, so they had no home in the task log above.

### Gate step 2 — tests

**Parks.** Six specs parked under FUP-DM1-E2E (`dafcbb1`). The tester **corrected
the backend's static per-file sweep in 3 of 6 files and found a 7th test**, all by
running rather than reading:

- `quality-oversight.spec.ts` — the dead assertions sit *inside* two otherwise
  standing tests, so `test.skip` was impossible; the blocks were removed with
  annotations (⚠ **deleted, not commented** — QA MINOR-3 corrected the follow-up's
  claim; the **M8 bytes-cut contract** they carried is now DM2 obligation 2).
- `phase11-interviews.spec.ts` — the follow-up's "FILE gone, LINK remains" was
  wrong: `attachments-panel.tsx` gates **both** affordances behind one flag
  (`canEditNow = canEdit && flagOn`), proven by both clicks hanging pre-park.
  **IV2-11's MIME-rejection block was a genuine 7th finding**, not in the list.
- `cases-extras.spec.ts` — the gated affordance is the **"Anexar" upload trigger**,
  not the download assertion; the whole upload/download half parks.
- `meeting-audio-minutes.spec.ts` — no park needed, as predicted (comment-only ref).

**`e2e:prod` (lead-run, `REBUILD=1`):** **1073 passed · 1 failed · 3 flaky · 17
batches · 0 did-not-run.** Every batch reported `accounted N/N`. Of 1092 collected,
the 15 unaccounted are **exactly the 15 skips** (batch 9 = 6 `phase-f2`, batch 4 = 4
`ethics-e1`, plus 5 pre-existing) — checked because **a batch whose reset fails
drops out of the gate's own denominator while the summary still reads green.**

**The single failure was triaged, not assumed.** `case-narratives.spec.ts` AC-10
("correcting an individually-concluded narrative preserves its conclusion stamp")
timed out waiting for a *Reenviada* badge. **Not a regression** — evidence:

| Run | Config | Result |
|---|---|---|
| Isolation, fresh reset | `SPECS=case-narratives`, `RETRIES=0` | **13/13 PASS** |
| Identical batch 2, same 6 specs, same order | `RETRIES=0` | **68/68 PASS**, gate green |

Attribution: the **`server_dead` INFRA class, below the harness's classifier
threshold.** The classifier reclassified batch 17's 24 failures as INFRA
(`server_dead=1`, `conn_errors=47`) and passed them on re-run; batch 2's single
failure did not cluster enough to trip it. Decisively, the **batch-2 reproduction's
own first attempt died `server_dead=1` / 14 conn errors** before the harness re-ran
it clean — the mechanism was reproduced directly rather than inferred. ⚠ Nothing
DM1 touched is on the narrative-correction path, and `case-patient.spec.ts` (18
tests incl. `dispose_case_phi` and audit-row exactness — the DM1-adjacent surfaces
that would break first) passed in the same batch. An early hypothesis that REG·KIND
(22-v3, gates 2–4 unrun) owned it was **disproven** by the two clean re-runs.

### Gate step 3 — QA: **APPROVED**

[review](../reviews/dm1-substrate-cutover-review.md) (`a44d222`). 1 MAJOR · 5 MINOR ·
4 INFO, none blocking DM1. QA reproduced every gate figure on an **independent**
fresh reset (367 registered == 367 files) and confirmed inertness **behaviourally**
past the `using(true)` trap: **19/19 DML attempts → `42501`**, and a just-uploaded
object invisible **to its own uploader**. It also caught its own vacuous check — the
first noun-rule probe ran against an empty table (0→0) — and redid it against a
planted row with a mutation twin.

**MAJOR-1 — fixed, not deferred** (`ba25b1f`). `app.can_read_file_object` carried an
undocumented, unkeystoned **uploader arm returning true before the
`can_read_document` chain**: a widening vs the retired `can_read_attachment` (which
had no creator arm), sitting **outside the kernel chain**, which D15's ceiling would
therefore have silently bypassed. Suite 328 routed around it *by design* (K11h). QA
proposed ruling it with the ceiling; the lead removed it instead — that ruling was
parked with no date, the substrate is inert (0 rows, 0 writers, no consumer until
DM2), so removal was free and DM2 can add uploader visibility deliberately, with a
keystone. Pinned by **K13, authored red-first** (`have: 1, want: 0` against the
pre-removal catalog) + mutation twin.

**QA's "what the record overstates" answers — all four corrected:** ADR 0116 §8
described two authorization-bearing doors as mechanical "resolvers" (**the
load-bearing one** — an auditor reading §8 would not have known to look at the door
that turned out to be MAJOR-1); "the *exact* predicate set the retired dispatchers
used" → "same predicate FAMILY", delta named and its immateriality cited; the
"preserved as a comment" claim, false for one of three files; and a stale `5909`
describing a tree two commits old. QA also found the record **understated** one
result: `ARM=census`'s required failure named **exactly** the 15 new gates and
nothing else, which additionally rules out unrelated drift.

Two MINORs recorded rather than fixed, to keep DM1's blast radius inert:
**MINOR-2** (`document.opened` inherits the registry's pre-existing `is_admin()`
short-circuit — platform_admin can mint an audit row for a document it cannot read;
no read leak, but `open_document_version` must gate **before** recording → DM2
obligation 5) and **MINOR-5** (`typecheck` exits 2 from a route-manifest skew
between the prod-build and dev `.next` type files; **0 first-party errors**;
a fresh build re-coheres it).

### Gate step 4 — human approval

**APPROVED by the PO 2026-08-13**, together with the FUP-DM1-CEILING ruling
(ADR 0114 **Amendment 1**, D15/D16 — ceiling on `documents` as an interim DM2
prerequisite; the general access plane scheduled at **Phase 19**).

### Carried into DM2 (do not re-derive)

1. **FUP-DM1-CEILING / D15** — ceiling column + kernel arm, **before** Wave A
   re-points any document. Restores pgTAP `228` t36–40 and E2E AC-4a–d / AC-9.
2. **FUP-DM1-E2E** — rewrite the six parked specs against the new module (ADR 0114
   D5: rewritten, never merely deleted), incl. the M8 bytes-cut contract.
3. **FUP-DM1-DISPOSE** — case PHI erasure needs a document-disposition hook
   (`dispose_case_phi` lost its attachment-redaction arm in M1).
4. **MINOR-2** — `open_document_version` gates before recording.
5. **Plan Q1** — the two ethics seam columns still have no wave (PO).
6. **O4** — signed-URL TTL per sensitivity, decided at DM2 against real latency.

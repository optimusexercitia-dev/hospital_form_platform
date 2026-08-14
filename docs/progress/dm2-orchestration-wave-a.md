# DM2 — orchestration + Wave A: phase record

> Program: Document Model Redesign (ADR 0114 + Amendment 1; plan
> [document-model-redesign.md](../plans/document-model-redesign.md) §DM2; S1
> decisions ADR 0117). Branch: `docs/dm1-plan-amendments` (PO: nothing to
> `main`, nothing remote). Backend-owned file; the lead owns the Phase Status
> table. DM1 obligations are carried **by reference** to
> [dm1-substrate-cutover.md](./dm1-substrate-cutover.md) §"Carried into DM2" —
> never copied (two ledgers drift).

## S1 — the D15 confidentiality ceiling (backend, 2026-08-13)

### Task log

| # | Task | Status | Evidence |
|---|------|--------|----------|
| S1.0 | AMEND 3 bounded check — interview-label dimension | ✅ **PARITY, not a DM1 widening** | §Finding DM2-F1 below |
| S1.1 | Keystones authored red-first (228 t36–39 restored; 328 K14, 21 asserts) | ✅ | §Red-first record |
| S1.2 | M1 `20260924000100` column + CHECK + seam guard (HC0D6) | ✅ | catalog-verified: column nullable, CHECK present, trigger attached, guard prosecdef+pinned path+owner-only ACL (byte-identical posture to the DM1 guard siblings) |
| S1.3 | M2 `20260924000200` kernel arm (live-body re-emit + drift asserts) | ✅ | pre/post `pg_get_functiondef` diff = exactly the intended edit; in-migration postconditions verified prosecdef / search_path / ACL |
| S1.4 | Mutation twins A + B (rolled back, restores catalog- AND behavior-verified) | ✅ | §Twin record |
| S1.5 | Gate step 1: fresh reset · full pgTAP · lint 5-gate · typecheck · vitest · 4 authz arms · diff-scoped sweep | ✅ | §Gate record |
| S1.6 | `npm run gen:types` | ✅ | diff = +3 lines (the new column in Row/Insert/Update), nothing else |

### Finding DM2-F1 — the interview-label dimension is PARITY, not a dropped control (AMEND 3)

**Question** (lead, S1 ack): the DM1 kernel's interview arm dispatches
`can_read_case_committee(case_of_interview(...))` and never consults
`case_interviews.confidentiality_level`. If the retired `can_read_attachment`
*did* consult it, DM1 silently dropped a second D15-class narrowing control.

**Verdict: parity.** Evidence, in the one situation where migration text is
admissible — the objects are DROPPED, so no catalog can answer; the text below
is read as evidence about dropped objects only, never as a claim about
anything live:

1. The retired interview arm's full history: minted
   `20260717000000_attachments_core.sql` (`can_read_case(case_of_interview)`),
   rewritten by C7 `20260810000000` (same shape, org arm cut), rewritten at
   runtime by M11 `20260911001000` (`replace()` →
   `can_read_case_committee(case_of_interview)` with a single-replacement
   proof + postcondition pins in the migration itself). **At no point did any
   version route `can_read_interview`** — the interview's own label never
   gated its attachments' metadata.
2. The retired ceiling (`attachment_confidentiality_ok`, last definition
   Stage B `20260802000000`) gated on the **attachment's own** label with the
   same case-resolve + fail-closed-`else null` shape S1 restores. The DM1
   kernel arm is a faithful restoration, not a new invention.
3. The live `can_read_interview` **does** enforce the interview's own ceiling
   (`confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level, ...)`
   — read from `pg_proc` 2026-08-13) and **survived DM1 intact**: the
   interview ROW is gated; documents homed on it gate on their own label.
4. ADR 0116 §12's QA comparison covered the **dispatchers only** — the
   confidentiality dimension lived in a separate function applied at the
   row-aware paths, so the comparison did not and could not cover it. Not a
   gap in its verdict: §10 separately named the whole ceiling mechanism as the
   dropped control, which is exactly what D15/S1 restores.

Recorded here as a named finding (lead AMEND 3: a finding that lives only in a
plan narrative goes stale invisibly).

### Red-first record (lead AMEND 1 — the two-migration split)

Step 1 — both keystone files run against the **pre-`20260924000100`** catalog
(367 migrations, fresh-derived state):

- **328: 15/109 RED, 109 planned = 109 ran, 0 aborts.** Genuine quoted reds:
  K14s1 (has_column false) · K14s2/s3 `have: 0, want: 1` · K14s6 (arm absent)
  · K14a/c/g `caught: 42703 wanted: HC0D6` · K14b1/h/d0 `died: 42703` ·
  K14b2 `have: 0, want: 1` · K14d1–d3 `have: 1, want: 0` · K14f4
  `have: 0, want: 1`. (K14s4/s5 green by design — preservation pins; K14d4/f1–f3
  vacuously green pre-column, noted, falsifiability via step 2 + twins.)
- **228: ABORT at the fixture INSERT (42703), planned 131 / ran 35, "Bad
  plan"** — recorded as abort shape per §7.15, NOT counted as red evidence.

Step 2 — `20260924000100` applied (column + guard live, **no kernel arm**),
re-run against the REAL catalog, unmutated:

- **328: 5/109 RED, 109 ran, 0 aborts** — the guard half fully green;
  the deny legs genuinely red: **K14d1 `have: 1, want: 0`** (the uncleared
  reader IS served the `legal_privileged` case document) · **K14d2/d3
  `have: 1, want: 0`** (…and its version and file object through the chain
  doors) · **K14d4 `have: 1, want: 0`** (…and the privileged interview
  document) · K14s6 (arm absent).
- **228: 131 planned = 131 ran, 0 aborts; tests 36 + 38 RED, both
  `have: 1, want: 0`** — the uncleared ordinary reader and the uncleared
  coordinator both see the privileged document.

Step 3 — `20260924000200` applied: **both files green, 240/240, clean run
shapes** (populated stack); fresh-stack green in the full-suite run below.

Pins green-on-both-sides by design, named so they are not mistaken for
evidence: 228 t37 (O2-visible) and t39 (clearance-admits — red only via
TWIN-A/the sweep), 328 K14s4/s5 (property preservation), K14f1–f3
(clearance-admits legs — differential within the file: same persona, same
rows, the one variable is the grant).

### Twin record (each in a rolled-back txn; probes on planted rows with real uids)

- **TWIN-A (the arm is load-bearing):** kernel replaced with the captured
  pre-image body in a txn → planted `legal_privileged` case document →
  `can_read_document(doc, staff1)` = **t** (keystones 36/K14d1 would red) →
  rollback → restore verified from the catalog (comment-stripped body ~
  `confidentiality_clearance_ok`) → same plant + probe on the restored kernel
  = **f**. The probe MOVED (t→f, §7.10).
- **TWIN-B (guard + backstop):** trigger dropped in a txn → the enforcing
  meeting-homed INSERT **SUCCEEDED** (K14a would red) → the kernel backstop
  refused BOTH the commission member and the creator/staff_admin (**f**, **f**
  — an enforcing label with no clearance plane is readable by no one) →
  relabel to `ethics_investigation` → member reads **t** (the probe MOVED) →
  rollback → restore verified structurally (trigger present) AND behaviorally
  (a fresh enforcing meeting INSERT raises **HC0D6**).
- The clearance-admits legs need no separate twin: differential by
  construction (K7h precedent) + TWIN-A reds their deny halves + the
  diff-scoped sweep neutralization is the whole-suite proof.

### Gate record (S1, gate step 1 scope)

- Fresh `supabase db reset`: **369 registered == 369 files**; pgtap absent at
  `gen:types` time (pollution scar avoided).
- Full pgTAP on the fresh stack: **Files=188, Tests=5952, Result: PASS** —
  verdict read from the pg_prove summary, never an exit code; 5952 = 5927 +
  21 (328 K14) + 4 (228 t36–39), accounted exactly.
- Lint 5-gate: all five pass (0 errors / 0 warnings; vacuous gate 178 files /
  0 findings). Vitest **1254/1254**.
- Typecheck: exit 2 from **4 errors, all in generated `.next/types/validator.ts`**
  — the known DM1 MINOR-5 route-manifest-skew class, **0 first-party errors**
  (same disposition; a fresh build re-coheres it).
- Authz arms, each by name, exit codes read separately: **`ARM=census` HOLDS**
  (548 live gates / 568 verdicts — zero domain delta, as predicted: S1 adds no
  boolean door and no policy) · **`ARM=hat` HOLDS** · **`FROMFINDINGS=1
  ARM=wrapper` HOLDS** (BLIND 41 ⊆ allowlist) · **`ARM=floor` HOLDS** (77
  never-called, all allowlisted).
- **Diff-scoped door sweep** (case list derived mechanically from the two new
  migrations per ADR 0079 Amendment 1; the `^(is_|can_|has_)` filter yields
  exactly `can_read_document`; zero new policies): **1 case executed
  (nonzero), COVERED, 0 BLIND, 0 ERROR**, green baseline asserted
  (188/5952). `WORK` overridden to the session scratchpad (hazard 2); findings
  file `git checkout --`-restored then the one verdict row amended in place
  (hazard 1). The write-path `ARM=policy` subset was NOT run — no S1 gate is
  in its hardcoded worklist (the case-count rule).
- `app.guard_document_confidentiality` is a trigger function — in NO sweep's
  domain by construction; its coverage is **behavioral** (K14a/c/g + TWIN-B),
  never cited to a sweep.

## Obligations ledger (S2+ — checked off at each slice's gate)

Carried from DM1 **by reference**: dm1-substrate-cutover.md §"Carried into
DM2" items 2–6 (E2E rewrite incl. M8 bytes-cut; FUP-DM1-DISPOSE;
MINOR-2 `open_document_version` gates before recording; plan Q1; O4). Item 1
(the ceiling) is discharged by S1 except as narrowed below.

**Minted by S1:**

| # | Obligation | Owed by | Source |
|---|-----------|---------|--------|
| S1-O1 | **`open_document_version` ceiling pins**: refused-open (`have: error` for an uncleared reader on an enforcing-labeled version) + clearance-admits-open — the two OPEN-level halves of the restored 228 block (its header names them) | S2 | ADR 0072 D7; 228 t36–39 comment |
| S1-O2 | **Write-side label authority**: the S2 create/upload command takes `confidentiality_level` explicitly; any declassify/reclassify is an audited command (D11 "classification change" verb) carrying the ceiling fence (the retired 238 K8a/b obligation, now in the D15 vocabulary) — and `can_write_document` must consider whether an uncleared writer may mutate an enforcing-labeled document (rule it, don't inherit it) | S2 | ADR 0116 triage obligation 1; D11 |
| S1-O3 | **Uploader visibility, if S2 adds it** (DM1 MAJOR-1 consequence): the arm goes INSIDE the kernel chain so the ceiling governs it, keystoned | S2 | ADR 0116 §11 |
| S1-O4 | **Interview-label inheritance is a product question, not a bug** (DM2-F1): if Wave A wants interview-homed documents to inherit the interview's own `confidentiality_level`, that is a deliberate widening of the ceiling's scope — new ruling + keystone, not a silent arm | S3 planning / PO | DM2-F1 |

## S2 — orchestration: the command layer (backend, opened 2026-08-13)

| # | Task | Status | Evidence |
|---|------|--------|----------|
| S2.0 | Phase-17 rename (plan amendment `06ab1ae`): `src/lib/documents` → `src/lib/controlled-documents`, `src/lib/queries/documents.ts` → `…/controlled-documents.ts` | ✅ 2026-08-13 | `git mv` (history follows, 98% similarity); **39 files / 69 specifiers** rewritten by node script (lead's 32/50 was an undercount — the delta is the module's 3 self-imports + comment references, all updated); diff exactly 69+/69−, no CRLF damage; 0 residuals; tsc 0 first-party + 5-gate lint + **real `next build` exit 0** (the BUG-FBE-005 gate) |
| S2.1 | Contract-first typed stubs: `src/lib/documents/{types,actions}.ts` + `src/lib/queries/documents.ts` + the 5 DM flag keys into `FeatureFlags` | ✅ 2026-08-13 | Signatures = the S3 contract, stable from here. Actions THROW (a faking stub is the silent-return scar); queries return the truthful empty state; unions CHECK-mirrored from the live catalog (disposal reasons, hold reasons, status, tier); trust boundary visible in types (no bucket/path/tier/hash inputs; `declared*` = hints). tsc **exit 0** (the real build re-cohered the `.next` skew — MINOR-5 mechanism confirmed) · lint 5-gate OK · vitest 1254/1254 |
| S2.2 | Command-layer plan | ✅ acked (lead, 4 findings) | lead thread |
| S2.3 | Contract amendments 1–10 (frontend review, lead-routed) folded in | ✅ 2026-08-13 | types.ts rewrite + `upload-client.ts` + M-a re-coded for code-only error mapping (HC0DE/DF/DG); `occurred_on` + `kind` through the door; committed — frontend unblocked |
| S2.4 | Migrations `20260924000300` (machine + doors + FINDING 1a + dispose arm) + `…000400` (open door) — 371 registered | ✅ 2026-08-13 | catalog-verified: 9 command doors + open door, registry arm GONE, dispose arm landed; all replace() surgeries needle-matched with postconditions |
| S2.5 | Keystones: 329 NEW **66/66** · 228 **135/135** (S1-O1 t40/40b/41/41b) · 328 **109/109** (K10 rewritten) — populated stack | ✅ 2026-08-13 | red-first record below |
| S2.6 | FINDING 2 per-state twins (5, independent, rolled back, restore 5/5) | ✅ 2026-08-13 | twin record below |
| S2.7 | TS implementation (`actions`/`queries` real bodies + `errors.ts` map + reconcile script), fresh-reset full gates, authz arms, O4, ADR 0118 | 🟢 this turn — see §S2.7 record | — |
| S2.8 | **Reclassify — BLOCKED on a lead ruling** (re-derived below; lead's constraint reading CONFIRMED) | ⛔ lead | §Reclassify re-derivation |

### S2 red-first record (the adapted ladder)

- Pre-migrations (369): **329** — S1 genuinely red `have: 0, want: 10`, then
  abort at the 42883 boundary (planned 66 / ran 4 — abort shape recorded, not
  counted as red). **328** — 109 = 109 ran; K10b `caught: no exception,
  wanted: 23514` (**the registry arm was LIVE**), K10c `have: 1, want: 0`
  (**the registry minted a row**), K10d red. **228** — ran 41/135; t40
  `caught: 42883` (door absent), then abort.
- ⚠ Ladder deviation, recorded: the intended "M-a only" intermediate
  observation was skipped — both migration files existed when
  `migration up` ran, so they applied together. The door-absent 42883 reds +
  the FINDING-2 twins carry the falsifiability of the open-door pins.
- Post-migrations: **329 66/66 · 228 135/135 · 328 109/109**, all planned =
  ran, 0 aborts (populated stack; fresh-stack run rides the S2.7 gate).
- Two red-first catches in my own code, both fixed in the TEST after ruling
  the DOOR right: (1) D1 expected verify-absence before retention — inverted:
  retention must refuse BEFORE anything instructs a byte deletion (a
  retention-blocked file must never lose bytes); (2) the storage fixture
  delete used the protect-trigger's sanctioned txn-local GUC after an ALTER
  TRIGGER attempt failed on ownership.

### S2 twin record (FINDING 2 — one neutralization per state, own txn each)

N1 doc-disposal (BOTH doc-status checks — see catch) · N2 soft-deleted ·
N3 unbound version · N4 file-disposal · N5 non-servable upload state: each
neutralization SERVED the entitled reader (`t` — the corresponding pin
O16/O14/O12/etc. would red); restore verified from the catalog (5/5 checks
present). **FINDING-2 catch, recorded:** neutralizing the HC0DD doc-check
alone still refused via the neighboring `<> 'active'` check — the two
doc-status checks are ONE barrier with two codes (defense overlap); the
honest twin removes both. The standing 329 pins (green immediately before)
are each twin's restored-side control.

### S2.7 record (2026-08-13)

- **TS layer implemented:** `src/lib/documents/actions.ts` (real bodies; door
  → service-client coordinate resolution → short-TTL signing; sha256 D9
  verification through the service client; SQLSTATE-only error mapping in
  `errors.ts`), `src/lib/queries/documents.ts` (embed-shaped reads;
  availability derivation; `canOpen` = row-visibility-is-the-kernel + servable
  — no door call), `scripts/document-reconciliation.mjs` (FINDING 3 script;
  smoke-run on the fresh stack: **RECONCILIATION CLEAN**; a trailing libuv
  assertion on process exit is a known Windows/node teardown artifact, after
  output). `reclassifyDocument` stays a loud stub (S2.8).
- **Contract note for the lead → frontend:** `underLegalHold` in practice
  emits `true | null` only (`true` = a live hold row is visible; `null` = none
  visible — RLS makes "no hold" and "not entitled" indistinguishable to the
  query). Type unchanged (`boolean | null`); affordance logic (disable on
  `true`) unaffected.
- **191 ripple (predicted class, found by the fresh-stack run):** 191 §4
  (3.13/3.14) pinned the registry dispatch FINDING 1(a) removed — rewritten to
  the STRICTLY STRONGER contract (verb not dispatchable for anyone; zero-mint
  pin 3.15 added; plan 26→27). Red observed before the rewrite:
  `died: 23514` / `caught: 23514 wanted: 42501`.
- **Gate:** fresh reset 371==371 · full pgTAP **Files=189, Tests=6023, PASS**
  (accounted: 5952 + 66 (329) + 4 (228) + 1 (191)) · lint 5-gate 0/0 · tsc 0
  first-party · vitest 1254/1254 · `ARM=census` HOLDS **zero domain delta**
  (548 — the command doors are non-boolean, outside the census by definition;
  registered as a findings-file note instead, never citable to a sweep) ·
  `ARM=hat` / `FROMFINDINGS=1 ARM=wrapper` / `ARM=floor` all HOLD (no INVOKER
  wrapper added — all ten doors prosecdef, 329 S1; the 8 user doors are
  suite-called, the 2 completion doors are outside floor's domain, ACL-pinned)
  · diff-scoped ARM-1 case list derived mechanically = **EMPTY** (no
  `is_/can_/has_` function, no policy in the S2 diff) — not cited, per the
  case-count rule; behavioral coverage mapped in the findings note.
- **O4 measurements** (25 case-homed docs × 2 versions, member persona, fresh
  stack): documents list ≈ 37–42 ms (~1.6 ms/row through the kernel incl. the
  S1 ceiling arm); versions ≈ 75–80 ms (~1.6 ms/row); the FILE-CHAIN layer
  ≈ 187 ms (~3.7 ms/row — the chain resolver re-walks per file row; the
  layer to watch at pilot scale: ~200-doc panels would spend ~2 s there).
  Signed-URL latency median **10 ms** (5 runs: 9/10/10/12/37).
  **Recommendation to the PO:** keep signing (streaming proxy unwarranted at
  10 ms); TTLs phi 120 s / standard 300 s are comfortable; if Wave-A panels
  ever list >50 documents, trim the file-object embed from the LIST query
  (availability via version-level projection) before reaching for schema
  changes. PO rules (ADR 0114 O4).

### S2.8 re-derivation (lead constraint reading CONFIRMED; awaiting ruling)

The lead's citation verified in the catalog:
`document_version_files_version_rendition_uniq UNIQUE (document_version_id,
rendition_kind)` — my option (a) (sibling `source` binding) violates it; I
missed the constraint (checked the table's triggers, never its constraints —
my error). Option (b) stays ruled out (D10: never a pointer update).

**Surviving option — the lead's option 1, amended:** reclassification mints a
**new `document_version`** whose `source` binding points at the copied file
object (fully append-only; zero invariant edits; the reclassify becomes
visible, audited version history — honest). The amendment it NEEDS: the OLD
file stays **bound** to its immutable old version, so retiring it meets the
provisional-retention gate (HC0DR) — and the urgent reclassify case is
exactly mis-tiered PHI that must leave the wrong bucket. Proposed:
an **EVIDENCE-GATED duplicate-retirement exemption** in
`complete_document_disposal` — reason `duplicate` is honored **only when a
live, servable file object with the SAME sha256 is bound to the same
document** (the door verifies the sibling; a caller cannot merely claim it).
Retention protects the record; a same-content sibling proves the record
survives. Prior-version opens of the retired copy then return `disposed`
(correct — the content lives in the successor, audit-linked via
`document.reclassified` meta). Option 2 (partial UNIQUE + liveness column +
guard exception) remains strictly worse: an invariant edit for no additional
honesty. **Needs an ADR decision** (it shapes D10 semantics + the retention
gate): recorded as ADR 0118 §10 (state only); implementation on the lead's
ack, as its own migration + the 229-heritage keystones (excluded-party deny +
ceiling fence + copy-integrity sha pin + the new exemption's own twin).

### S2.8 record (2026-08-13 — lead-approved, three conditions discharged)

- Migration `20260924000500` (372 registered): `reclassify_document` +
  service-only `complete_document_reclassification` (append-only new-version
  commit; copy integrity = sha of the moved bytes, refused on mismatch) + the
  evidence-gated duplicate-retirement lane re-emitted into
  `complete_document_disposal` (drift-asserted) + the batched
  `document_delete_affordances` door. TS: `reclassifyDocument` real body
  (download→hash→upload→commit→retire), `canDelete` merged into the queries
  (one batched door call per list), `underLegalHold` retyped `true | null`.
- **Condition 1** (last-copy invariant, executable): 329 **R6/R7** — the old
  copy retires on the live same-sha successor; the successor, sibling
  disposed, is REFUSED (HC0DR). Same statement, one variable.
- **Condition 2** (kept GENERAL, justified in ADR 0118 §10): the guardrail is
  the EVIDENCE, never caller provenance; `request_document_disposition` marks
  ALL files so the lane self-blocks on that path; vacuity pin **R8** (a
  non-duplicated file cannot claim the lane). Exemption twin: sha term
  neutralized → a different-content sibling wrongly satisfies (probe
  `disposal_pending`→`disposed`); restored control HC0DR; restore verified.
- **Condition 3**: ADR 0118 §10 PROMOTED to the decision (invariant + both
  guardrails named); §11 records the canDelete route.
- Red-first: S7 `have: 0, want: 3` + abort at 42883 (planned 92 / ran 67)
  pre-`000500`; post: **329 92/92** · fresh-stack full suite
  **189f/6049 PASS** (6023 + 26, accounted) · lint 5-gate · tsc 0 first-party
  · vitest 1254/1254.
- **`ARM=census` REQUIRED-FAIL captured, and it corrected ME**: 549 live
  gates, VIOLATED naming exactly `document_delete_affordances` — my S2.7
  findings note had predicted SETOF doors stay outside the domain; wrong for
  this one, and the census caught the misprediction (the arm working as
  designed). The prescribed diff-scoped sweep printed **BLIND: 0 over ZERO
  executed cases** (the ARM-1 `^(is_|can_|has_)` matcher cannot run it) — NOT
  cited, per the case-count rule; covered instead by TARGETED MUTATION (door
  forced true in a rolled-back txn → plain member gains the affordance,
  A2/A3 would red; restored control `f`; restore catalog-verified — the DM1
  `storage_upload_reserved` dialect). Findings file: `git checkout --`
  restore, verdict row + note-correction appended; census re-run **HOLDS**
  (549/569). `ARM=hat` / `ARM=floor` / `FROMFINDINGS=1 ARM=wrapper` all HOLD.
- **PO rulings folded in**: O4 closed in ADR 0114 (PHI 120 s / standard
  300 s, no proxy — the bearer-token asymmetry reasoning recorded there);
  list-perf ruled NO TRIM — see the watch-item below.

### Pilot watch-item — LIST file-chain RLS cost (PO-ruled: no action pre-pilot)

`document_version_files`→`file_objects` chain policies cost **~3.7 ms/row**
(measured 2026-08-13, 25 docs × 2 versions, member persona, fresh stack;
documents ~1.6 ms/row, versions ~1.6 ms/row; sign median 10 ms). PO ruling:
keep the embed — `containsPhi` + `availability` stay; production census is 45
objects and Wave-A panels hold single-digit documents, so the 200-row figure
is a load that does not exist. If it ever bites, start from these numbers;
first option: trim the file embed from LIST while keeping both fields
resolving (a narrowed embed / computed column), routed through the lead.

## S4 prep (backend, 2026-08-13 — lead-directed at S4 spawn)

| # | Task | Status | Evidence |
|---|------|--------|----------|
| S4p.1 | Seed forces `documents_foundation` + `documents_wave_a` ON for local/E2E (MIN pattern; prod defaults stay OFF until S5); the flag-OFF-contract trap noted AT THE FLIP (a spec pinning "absent, not disabled" must toggle + restore itself) | ✅ `01134b1` | catalog-verified post-reset: both `t`, waves `f`, `attachments` `f` |
| S4p.2 | `attachments` key: **seed-retired only** — lead-RATIFIED scoping: the key ROW + `FeatureFlags` entry + `attachmentsEnabled()` retire via the **S5 choreography MIGRATION**, because production never runs seed and a seed DELETE would fork local from production on the key's *existence* (the drift class two phases were spent killing) | ✅ ruling recorded | lead ack 2026-08-13; S5 ledger item |
| S4p.3 | 328 K9 rewritten for the seeded state (would have red-ed on the tester's FIRST fresh reset with no defect behind it — a false red at calibration time); three pins, prod-default caveat in the pin name; plan 111 | ✅ | full suite **189f/6051 PASS** (6049 + 2, accounted) |

**Handed to S4 (routed by the lead):** the browser-side half of the upload
failure contract — a failed/partial PUT leaves NO storage object, `finalize`
returns `upload_incomplete`, the session stays retryable ~15 min until
`upload_expired` — 329 **U11/U12 are the specification** the E2E is checked
against; a disagreement is a genuine finding in either direction, not
automatically an app bug.

## S4 routed bugs (backend, 2026-08-13 — both lead-confirmed from the catalog)

| # | Bug | Fix | Evidence |
|---|-----|-----|----------|
| BUG-DM2-001 (🟠) | A failed verification left the row **pending forever** — the door marked the FILE failed but never bound it, and the projection derives availability from the BOUND file. The door's own pin was green: it asserted the column, never what the reader sees. | Migration `20260924000600` (373): **the failure BINDS** — the failed file joins the version's record; the chain makes it reader-observable; the projection derives `failed`. Retry safety verified: every retry mints a NEW version via `begin`, so the failure binding cannot collide with `UNIQUE(version, rendition)`; re-verification of a failed file stays refused. | 329 **B1 red-first `have: 0, want: 1`** (unbound) + B2 (reader-observable through the chain under `set local role`) + B4 (corridor refuses on STATE, message-matched — red pre-fix on the unbound message). Browser half: tester's `test.fail()` spec flips hard. |
| BUG-DM2-003 (🟡) | finalize's expired-marking UPDATE was rolled back by its own RAISE — `state` stayed `reserved` forever (a state-column lie; the refusal itself was correct, predicate-based). | Dead UPDATE **removed** (postcondition-pinned gone); the refusal stays predicate-based; **expiry marking moved to reconciliation's sweep** (its own transaction — a refusal that must also persist state fights its own transaction): lapsed reserved sessions → `expired`, their reserved files → `abandoned`, both reported. | 329 B5 (HC0DE) + **B6 green-by-design, labeled** (the refusal leaves `reserved` — the DECIDED contract; its red half = tester's spec + the dead line's catalog diff). Sweep smoke on the live stack: `expiredSwept: 3` — my planted row **plus two real E2E-lapsed reservations**, the exact rows the bug predicted; catalog confirms `expired`/`abandoned`. |

- **Fixture-fragility catch en route**: 329 F3 asserted a GLOBAL zero of
  document-open audit rows — red (`have: 10`) the moment the tester's
  legitimate E2E opens landed in the append-only log. Re-scoped to the probe
  entity (the F2 probe deliberately uses the CASE id, which no real open ever
  carries) — hermetic now.
- Gate: fresh reset 373==373 · full suite **189f/6059 PASS** (6051 + 8,
  accounted) · lint 5-gate 0 · tsc 0 first-party · four arms HOLD (census
  zero-delta; the two changed doors are already named in the findings note's
  behavioral-coverage list; diff-scoped case list mechanically empty — not
  cited).
- **S5 choreography ledger addition (lead-routed, tester-pinned; AMENDED
  2026-08-13, backend — handoff item 5, now enforced not prose):**
  `documents_wave_a` gates the UI; `documents_foundation` gates the RPC layer
  — with foundation ON and wave_a OFF the UI is dark while a direct API
  caller can still write. **`documents_wave_a` alone is NOT a kill switch;
  `documents_foundation` alone IS** — one lever kills every door (HC0D7
  first-statement), wave_a notwithstanding. Pinned by 328 **K16** (K16a/b/c
  behavioral differential: same call, the flag the only variable; K16s1
  wave_a consulted by ZERO DB functions; K16s2 all-12-doors assert census).
  No flag-pair trigger was added, deliberately: a refuse-style dependency
  would SLOW the incident lever (killing foundation would first demand a
  wave_a flip) and a cascade trigger is unruled ops magic. The S5 emergency
  stop is: **flip `documents_foundation` OFF**; flip wave_a too for UI
  darkness, in either order.

## S2+ — (subsequent slices append here)

---

# ⏸ DM2 PAUSED 2026-08-13 — resumption handoff (PO decision)

**Why paused:** the backend agent was killed **four consecutive times by transient API 529s** — twice
resumed, then replaced by a **fresh lightweight agent which failed identically**, disproving the
lead's context-size hypothesis. The API was broadly degraded; the lead's own session was unaffected
(catalog probes and commits kept succeeding), which is why the state below is verified rather than
assumed. The PO chose to stop at a clean checkpoint rather than keep retrying.

## State at pause — verified, not assumed

- **HEAD `56e3989`** on `docs/dm1-plan-amendments`. ⛔ **NOT merged to `main`, nothing pushed** —
  `main`/`origin/main` still `f84c6b6`.
- **374 migrations on disk == 374 registered.** Nothing half-applied.
- **All five DM flags OFF in production defaults**; `seed.sql` forces `documents_foundation` +
  `documents_wave_a` ON for local/E2E only. **Nothing is exposed.**
- **Gate step 3 verdict stands: ⛔ CHANGES REQUESTED (QA r1)** — 1 P0 · 3 MAJOR · 6 MINOR · 4 INFO.
  DM2 has **not** passed its gate. Do not flip flags, do not seek approval, do not merge.

## What IS done and proven

- **P0-1 (oversight reviewer served PHI bytes) — FIXED and verified from two independent
  directions.** Migration `20260924000700` (`29215f4`) re-expresses the QO·B byte cut inside
  **`open_document_version`**, deliberately **not** the kernel: the kernel governs *metadata* and the
  M8 half of the contract is that the reviewer **keeps titles**, so a kernel conjunct would
  over-narrow exactly where M8 forbids. Grounded in the M9 predecessor (`open_attachment`,
  `20260911000800`) — legitimate archaeology on a **dropped** object.
  - *Lead verification:* catalog shows the conjunct present in the door and absent from the kernel;
    behavioural probe on a **planted** row → reviewer still sees metadata `true`, cross-org control
    `false`.
  - *Tester verification:* the E2E now calls `open_document_version` **directly via REST**, and a
    **genuine red-then-green** was obtained under adversarial conditions (see the contamination note).
- **`329` carries P0a–P0f keystones** (plan 100→108) — written, **but their red-first proof is NOT
  yet executed** (item 1 below).
- **M8 E2E strengthened** (`56e3989`) from "the button is absent" to "the door refuses", with a
  non-vacuous positive control on the same door and document.
- Full `e2e:prod` was **GREEN before the P0 was known** (1088 passed, coverage reconciled 1091 of
  1097 = the 6 skips) — that run is **superseded**; it must be re-run after remediation.

## ⚠ Two method findings that must survive this pause

1. **An uncommitted migration on disk is applied by anyone's `db reset`.** The tester's first green on
   the strengthened M8 spec was **contaminated** — the backend's fix migration was on disk but
   uncommitted, so its own reset applied the fix before the test meant to catch the defect ran. **A
   green obtained that way is indistinguishable from a real one except by checking `git`.** The tester
   caught it by noticing there was no fix commit, set the file aside, fresh-reset, reproduced the P0
   exactly, then restored. *Cause was the lead's:* the migration sat uncommitted across two API
   failures. **Commit migrations promptly on a shared stack.**
2. **A sweep boundary drawn on a return-type SYNTAX cannot enforce a property.** All four authz arms
   missed P0-1 because the M8 cut used to live in a **storage policy** (inside `ARM=census`'s domain)
   and D8 moved the boundary into a **`jsonb`-returning DEFINER**, which is in **no** arm's domain.
   QA validated the lead's census reasoning by checking the domain predicate (`proretset`) rather than
   the claim. **536 pre-existing functions share the class.** Not a DM2 regression — DM2 is merely
   where the first defect landed in the new blind spot. A future arm may need to close it.

## The remaining work, in order (nothing here needs re-deriving)

0. ✅ **DONE 2026-08-13 (backend, resumption session) — commits `f0b3d1c` (fix + K15) and
   `bd05bd8` (311 5.2b re-expression); records in §"Resumption session" below.**
   🔴 **START HERE — MAJOR-1 / S1-O4: propagate the interview's confidentiality to its documents.**
   **PO ruling 2026-08-13.** A document whose home is an interview must be gated by **that
   interview's own ceiling**, in addition to the case-level access already checked.
   *The defect, lead-reproduced as a differential probe (same member, same interview, one variable):*
   `app.can_read_interview(iv, member)` = **false** while
   `app.can_read_document(doc_homed_on_iv, member)` = **true** — the interview row is correctly
   hidden and its transcript is not. Cause: the kernel's interview arm dispatches
   `can_read_case_committee(app.case_of_interview(...))`, which **skips a level** — it asks who may
   read the *case*, never who may read *this interview*, so `case_interviews.confidentiality_level`
   is never consulted for documents.
   *Why ruled rather than accepted:* parity with the retired substrate is real but answers "did we
   break this?", not "is this correct?". The old substrate is being **replaced because it had this
   shape of defect** (F-01 authorized from a path without joining the row). Wave A is the change that
   puts real transcripts behind it, and the transcript is usually the sensitive part — a ceiling that
   hides the interview record but not its files is close to decorative.
   *Implementation notes:* the arm already resolves the interview, so this is a conjunct in one
   place, beside the case-level ceiling proven in S1. It **fails safe** (over-narrow is visible and
   complained about; under-narrow is silent). Red-first, with the differential probe above as the
   pre-fix red, plus a **non-over-narrowing twin** (a non-enforcing interview label must still leave
   its documents readable). ⚠ Before building, **count how many interviews carry an enforcing label**
   — locally very few, production essentially empty — so the blast radius is stated, not assumed.
   *Also required:* an **ADR amendment** recording this decision and its mechanism (ADR 0117 is the
   ceiling's decision record; ADR 0114 Amendment 1 D15/D16 is the governing frame). The decision is
   made; the mechanism is not — write it when you build it.

1. ✅ **DONE 2026-08-13 (backend, resumption session) — commit `8eb20de`; records in
   §"Resumption session" below.**
   **Close P0-1's proof.** Red-first for P0a–P0f (revert the `read_case_deliberation` conjunct in a
   **rolled-back txn**, each pin must red; verify the restore **from the catalog**), plus the
   **over-narrowing twin** (reviewer still reads titles). ⚠ **`supabase/tests/308_case_caps_s7.sql:291-303`
   states this obligation verbatim — *"That door's keystones MUST re-express all six pins"* — and
   ran green all phase while it was unmet.** Make that file unable to pass while unmet, or it lies again.
2. ✅ **DONE 2026-08-13 (backend, session 2) — commit `6327591`; records in §"Resumption
   session, part 2" below.**
   **MAJOR-2 — reconciliation is blind to `failed`/`abandoned` files holding bytes.** Its premise
   assumes those states carry no object; **this phase made that false** (BUG-DM2-001's fix binds a
   failed file; BUG-DM2-003's fix mints `abandoned`). `accounted.add` is unconditional, so they are
   not orphans either. Net: **undisposable PHI under a `RECONCILIATION CLEAN` banner.**
3. ✅ **DONE 2026-08-13 (backend, session 2, server side) — commit `797d55b`; a FRONTEND
   contract is handed to the lead (dialog + label copy); records below.**
   **MAJOR-3 — "Tentar novamente" can never succeed after a verification failure.** `consumed` →
   `failed` → TS re-verifies → `HC0D9` → same banner forever, **each loop an unaudited service-role
   download of the whole object.** Make retry work or stop offering it.
4. ✅ **DONE 2026-08-13 (backend, session 2) — commits `a4e2351` + `542002b`; records below.**
   **ADR 0118 §10 — pin the load-bearing predicate.** The retention-exemption induction holds
   **because the sibling predicate is `disposal_state = 'none'`, not `<> 'disposed'`**. §10 credits
   "the evidence" generally; a later relaxation kills the invariant **while R6/R7 still pass**.
5. ✅ **DONE 2026-08-13 (backend, session 2) — commit `872bf3f` (K16); the claim made accurate,
   the foundation-kill property pinned; records below.**
   **`documents_wave_a` kill-switch keystone.** wave_a gates the **UI**, `documents_foundation` gates
   the **doors** — so wave_a alone is **not** a kill switch. "They flip together" is prose with
   nothing enforcing it.
6. ✅ **DONE 2026-08-13 (backend, session 2) — ADR 0118 §12 written (standing blind spot, not a
   DM2 regression); in the final docs commit.**
   **ADR 0118 §12** — record finding 2 above.
7. **Re-run the full §6 gate**: fresh reset · `test:db` · lint 5-gate · typecheck · vitest · the four
   arms · diff-scoped sweep over every changed body (case count **nonzero** before citing) ·
   **`e2e:prod`** · then QA **r2**.
8. **The 6 MINOR + 4 INFO** from the QA r1 review, not itemised here — read
   `docs/reviews/dm2-orchestration-wave-a-review.md` directly.

## ⚠ One item is committed but NOT fully verified — do not read it as green

The tester's **two gap-closure probes are committed** (`4644cef`): a server-side **`HC0DG`** probe in
`phase11-interviews.spec.ts` (IV2-11 previously tripped only the *client-side* MIME block) and a
server-side **`HC0D8`** probe in `phase-f2-attachments.spec.ts` (`DM2-STATES`' `pending` row
previously asserted only a disabled button). Both close UI-only assertions of **the same class that
hid P0-1** — an assertion whose subject is a rendered control cannot carry an authorization claim.

**But their final clean fresh-reset confirmation run did not complete** — the tester was interrupted
mid-verification when DM2 was paused. Its last observation was that a `DM2-STATES` double-row it saw
is a **pre-existing, already-documented iteration artifact** (running that test twice without a reset
creates two identically-redacted `[removido]` rows), **not** a regression from the new probes — and
it was in the middle of confirming exactly that on a clean reset when it stopped.

**On resume: re-run those two files on a fresh `supabase db reset` before trusting them.** They are
written and reviewed, not yet confirmed green. Treating them as verified would repeat this phase's
own lesson in miniature.

## Open with the PO (do not decide these for them)

- ~~MAJOR-1 / S1-O4 — interview-label bytes~~ → ✅ **RULED by the PO 2026-08-13: PROPAGATE.**
  Moved into the work list as **item 0 — the first task of the next session.** See below.
- **Plan Q1 — the two ethics seam columns still have no wave.** Blocks planning DM3, not DM2.
- **S1-O3** uploader visibility — deliberate non-decision in the ledger.

# Resumption session 2026-08-13 (backend) — items 0 + 1 closed

Commits, in order: `f0b3d1c` (MAJOR-1 fix `20260924000800` + 328 K15) ·
`8eb20de` (P0a–P0f falsifiability + the 308 sentinel) · `bd05bd8` (311 5.2b
two-hop re-expression). 375 migrations on disk == 375 registered. Everything
below observed, not claimed; raw runs in the session scratchpad
(`328_prefix_run.txt`, `329_mut{A,B2,C}_run.txt`, `308_mutA_run.txt`).

## Item 0 — MAJOR-1 / S1-O4 (PO: PROPAGATE) — ADR 0117 Amendment 1

**Mechanism, catalog-validated before building** (the lead's proposed dispatch
held; no correction needed): the kernel's interview arm
`can_read_case_committee(case_of_interview(v_resource), p_uid)` →
`app.can_read_interview(v_resource, p_uid)`, which `pg_get_functiondef` shows
is exactly the old predicate PLUS `confidentiality_clearance_ok(ci.case_id,
ci.confidentiality_level, p_uid)`, row-joined. Non-enforcing labels clear
trivially (no over-narrow); missing rows fail closed in both arms; all
functions STABLE SECURITY DEFINER, pinned search_path — nesting mirrors the
sibling arms. One edit governs the aggregate: `documents` /
`document_versions` / `document_placements` RLS, `can_read_document_version`,
`can_read_file_object`, and `open_document_version` all route the kernel.
Migration `20260924000800`: live-def `replace()` re-emit, pre/post drift
asserts (dispatch present exactly once pre; arm present, D15 arm untouched,
prosecdef + search_path + ACL preserved post).

**Blast-radius census (run, not assumed):** pre-fix live DB: 13 interviews,
ALL `non_phi_internal` (12 E2E artifacts + the seed row); fresh reset: **1
interview, `non_phi_internal`, 0 interview-homed documents**. Zero
enforcing-label interviews exist anywhere locally; production pre-pilot empty.
The keystones plant their own enforcing fixture.

### Red-first record (K15, real pre-fix catalog — 374 migrations, unmutated)

328 with K15 authored, run pre-`20260924000800`: **5/124 RED, 124 ran, 0
aborts** — the reds are exactly the keystones, the differential rendered in
TAP (K15c1 green beside K15k1 red):

- K15k1 `not ok` — `can_read_document(d305, staff2)` = **true** (kernel serves
  the uncleared member the document homed on a `legal_privileged` interview)
- K15k2/k3 `have: 1, want: 0` — the row and its version visible under RLS
- K15k4 `caught: HC0D8: arquivo ainda não disponível / wanted: P0002` — the
  byte corridor passed the kernel and died only at file-absence
- K15s1 `not ok` — prosrc lacks `can_read_interview`

Green pre-fix by design: K15t0–t2 (non-enforcing twins), K15c1–c3 (interview
row hidden / case-read intact / deliberation held), K15g1–g2 (clearance
admits, trivially pre-fix). Post-migration: **328 124/124**, and K15g1/g2 now
prove the admit side non-trivially.

**311 5.2b red at the migration — its job.** The pin matched the retired
dispatch *syntax*; the property (interview-homed documents behind the
committee cut) survives one hop down. Re-expressed as the closure of both hops
(`bd05bd8`). Full suite after: **Files=189, Tests=6084, PASS** on a fresh
reset; `gen:types` diff clean (kernel body only — no schema surface change).

### Twin record (item 0)

Non-over-narrowing is pinned INSIDE 328 as first-class keystones rather than a
separate harness: K15t1/t2 (same document, same member, label at the seed's
`non_phi_internal` → readable at kernel AND RLS) run before the flip, and
K15g1/g2 (a `max_confidentiality = legal_privileged` grant re-admits document
AND interview — the two predicates agree in both directions) after it. Their
red is "the fix denies where no ceiling enforces". The deny side's
falsifiability is the observed pre-fix red above (§7.10: the probes MOVED
t→f across the migration on identical fixtures).

## Item 1 — P0-1's proof closed

Baseline (unmutated, post-`20260924000700`): 329 **108/108** including P0e —
the over-narrowing twin: the oversight reviewer still reads the document row
(metadata yes, bytes no). Then three mutations, each inside a rolled-back
txn (no COMMIT exists in any driver stream), each restore verified from the
catalog by body-md5 equality with the pre-run baseline
(door `a3f96749…`, kernel `d52647fb…`):

- **Mutation A** — conjunct → `and false` (byte cut unreachable): 329 →
  **3/108 RED**: P0a `caught: no exception` (the reviewer is SERVED) · P0f
  `have: 1, want: 0` (the served open MINTED an audit row) · P0d (conjunct
  gone from prosrc). P0b/P0c/P0e green (controls). Door md5 restored.
- **Mutation B** — conjunct → `and true` (unconditional refusal): the FULL
  file aborts at **O1** (an unguarded serving assertion — itself a cruder
  member-refusal detector; an aborted plan is a failed run, so 329 cannot go
  green under B either way). P0b/P0c individually exercised in a **focused
  harness** replicating up0 + both pins VERBATIM (q1-harness precedent):
  **P0b RED `died: 42501…` · P0c RED `died: 42501…`**, fixture pins green.
  Door md5 restored.
- **Mutation C** — the wrong fix QA r1 warned against (deliberation conjunct
  in the KERNEL's case arm): 329 → **2/108 RED**: **P0e** `not ok` (the
  reviewer loses metadata — M8 violated) · P0a `caught: P0002, wanted: 42501`
  (the message pin discriminates the kernel corridor from the byte cut —
  the executable demonstration of WHY the fix lives in the door). Kernel md5
  restored.

Every one of the six pins has an observed red under a targeted mutation. The
handoff's literal instruction ("revert the conjunct … every one of the six
pins must go red") was over-stated for the three positive controls — P0b/P0c/
P0e *cannot* red under conjunct-removal; they red under the inverse and the
kernel-conjunct mutations, which is what was executed and recorded.

### The 308 obligation is now executable

`308_case_caps_s7.sql` §5's prose obligation ("that door's keystones MUST
re-express all six pins" — green all phase while unmet) is replaced by a live
sentinel: **5.2s** (the reviewer refused BYTES at `open_document_version`,
42501 + message pinned) with **5.2c1/5.2c2** differential controls (the
staff_admin holds deliberation; he passes the cut and dies only at
file-absence HC0D8 — same version, one variable). Proven: under mutation A,
**5.2s REDS** (`caught: HC0D8, wanted: 42501` — the reviewer sailed past the
absent cut), 1/30, controls green; door md5 restored after. 329's stale
header comment (which claimed an executed red-first) rewritten to the actual
falsifiability record.

## Gate state (this session's scope — NOT the full §6 gate)

Fresh `supabase db reset` (375 == 375) → `gen:types` (diff clean, pgtap
absent) → full pgTAP: **Files=189, Tests=6084, Result: PASS**. Not run here
(lead-owned, remaining work items 2+): lint 5-gate, typecheck, vitest, the
four authz arms, the diff-scoped door sweep over `can_read_document`'s changed
body (**required at gate time — this session changed an RLS-adjacent DEFINER
body**), `e2e:prod`, QA r2.

# Resumption session 2026-08-13, part 2 (backend) — items 2–6 closed

Commits, in order: `6327591` (MAJOR-2) · `797d55b` (MAJOR-3, server side) ·
`a4e2351` (§10 predicate + R10) · `872bf3f` (K16 kill switch) · `542002b`
(R10 fixture collision fix). **No migration this round** — 375 == 375
unchanged; `gen:types` diff clean. Raw runs in the session scratchpad
(`329_mutD_run2.txt`, `328_k16_run.txt`, MAJOR-2 script output inline below).

## Item 2 — MAJOR-2 (reconciliation) — red/green record

**RED (observed, planted committed fixtures on the live stack):** one
byte-holding `failed` + one byte-holding `abandoned` `file_objects` row in
`documents-phi`, objects present → the committed script printed
`RECONCILIATION CLEAN`, exit 0, `counts: {objects: 2, rows: 2}` — both
swallowed by the unconditional `accounted.add`, judged by neither direction.
**GREEN:** the rewritten TOTAL first-match classifier reports both as a new
`undisposed` class, `DRIFT: 2 finding(s)`, exit 1, `classCounts: {terminal:
2}`. **TWIN (no over-reporting):** objects deleted, same terminal rows →
`RECONCILIATION CLEAN`. Design points: `infected`/`rejected` (same shape,
per the `file_objects_upload_state_check` CHECK) classify with
failed/abandoned; an UNRECOGNIZED state pair is reported as `unclassified`
AND left unaccounted (its object also surfaces as ORPHAN — fail-loud both
directions); `reserved` and `disposal_pending` are indeterminate BY DESIGN
(in-flight PUT window; the Storage delete legitimately precedes the
completion door's absence check), documented in the header. Fixtures
removed after the runs. (Adjacent, deliberately NOT touched: MINOR-1
pagination and MINOR-2 unguarded session UPDATE — item 8's scope.)

## Item 3 — MAJOR-3 (terminal verification failure) — ruling + record

**Ruling (delegated): STOP OFFERING retry.** From the catalog: `failed` has
**no outbound arc** in `guard_file_object_transition`'s D9 machine (it
appears only as a target), and the bytes at the immutable path cannot change
(Rule 6, `x-upsert: false`) — so a "successful retry" is necessarily a new
reservation + path, i.e. exactly the remove-and-reupload the row already
instructs. Accepted cost, recorded: a transient download error during
verification also mints terminal `failed`; distinguishing it needs a
`failed → verifying` machine arc (migration) for a pre-pilot edge where
re-upload is always available.

**Server side (shipped, `797d55b`):** `finalizeDocumentUpload` short-circuits
the idempotent `failed` return — **no service-role download, no verify RPC**
(the unaudited full-object download per click is dead server-side regardless
of UI) — and both failure sites return `{ error: 'upload_incomplete',
terminal: true }`. Encoded as an OPTIONAL discriminant, not a new error
code, so the frontend-owned closed pt-BR label map keeps compiling.

**RED-FIRST (vitest `src/lib/documents/actions.test.ts`):** T1 (short-circuit
keystone) and T2 (first failure already terminal) observed RED against the
pre-fix action — T1's pre-fix run invoked the verifier RPC/download; T2
returned no terminal marker. T3 twin: a PUT that left no object stays
NON-terminal (ADR 0118 §8's retry contract, preserved). T4: the `verifying`
stuck-recovery re-entry still verifies and succeeds. 4/4 green post-fix;
tree typechecks.

**→ FRONTEND CONTRACT (handed to the lead — files are frontend-owned):**
1. `src/components/documents/document-upload-dialog.tsx` — when a finalize
   result carries `terminal: true`: do NOT keep the session for resubmit and
   do NOT relabel the submit button "Tentar novamente"; surface the
   remove-this-item-and-upload-again guidance as the only recovery (the
   row's existing copy is correct; the dialog's is not).
2. `src/components/documents/document-labels.ts` — terminal copy, e.g.
   "A verificação do arquivo falhou. Remova este item e envie o arquivo
   novamente." (today the user is shown "Tente enviar novamente", which
   instructs an action that cannot work).
3. Optional pairing: promote `terminal` to a first-class `upload_failed`
   error code — the union lives in backend's `types.ts` and will be changed
   in the SAME commit as the frontend's label line (a lone union addition
   breaks the closed `Record` map's compile).
4. Tester note: an E2E probe that the dialog no longer offers retry after a
   verification failure would close the affordance half end-to-end
   (`DM2-VERIFY-FAILED` asserts DB truth + row text only).

## Item 4 — ADR 0118 §10 predicate — record

§10 now names the load-bearing term: sibling liveness is
`f2.disposal_state = 'none'`, never `<> 'disposed'`. Pinned in 329:
**R10a** (two same-sha duplicates BOTH `disposal_pending` — the state
`request_document_disposition`'s one-statement marking produces — the lane
REFUSES HC0DR: a pending sibling is not a live sibling) with twin **R10b**
(one variable flips — the sibling back to `none`, a legal D10 back-arc —
the same statement admits) and **R10s** (the f2-scoped spelling,
comment-stripped; the document-closure query legitimately uses
`<> 'disposed'`, the alias disambiguates).

**FALSIFIABILITY (mutation D, rolled-back txn, restore md5-verified
`2aa61ca8…` before and after):** the exact relaxation applied to the live
door → clean full-shape run, 115 planned = 115 ran, **exactly 2 red**:
R10a `caught: HC0D9 'objeto ainda presente…' wanted: HC0DR` (the exemption
wrongly admitted the pending sibling and fell through to the absence check)
and R10s — while **R6 ok · R7 ok · R8 ok** under the mutated door: QA r1's
claim that the pre-existing pins cannot see this relaxation, demonstrated
executably.

**Method lesson (own goal, recorded):** my R10 fixture first took the name
`u8`, which 329's A-block already creates — on a fresh stack the file
ABORTED at the A-block with 95 of 115 run and **zero failed tests**, and my
verification had grepped pin lines + "Looks like" without checking run
SHAPE (an aborted `finish()` prints neither). Fixed in `542002b`
(`u8` → `u8d`); the mutation-D record above is from the post-fix clean-shape
rerun. *A run's shape (planned == ran) is part of the evidence, every time.*

## Item 5 — kill switch — ruling + record

**Ruling (delegated): make the claim accurate + pin the property; no
flag-pair trigger.** A refuse-style dependency would SLOW the incident lever
(killing `documents_foundation` would first demand a `documents_wave_a`
flip); a cascade trigger is unruled ops magic. The S5 emergency stop is now
written as: **flip `documents_foundation` OFF** — one lever, every door.

328 **K16** (130/130 green): K16p (wave_a asserted ON while foundation is
cut — the pin is precisely "wave_a does not keep the module alive"),
K16a/K16b (read + write doors die HC0D7 first-statement), K16c (the SAME
open revives to HC0D8 at file-absence with the flag restored — the
differential's one variable is the flag), K16s1 (`documents_wave_a`
consulted by ZERO functions in app/public, comment-stripped — detector
proven able to find a planted reference: 1 under a rolled-back mutation of
`assert_documents_enabled`, 0 after restore), K16s2 (all-12-doors assert
census — reach stated honestly: it catches a REMOVED assert; a future door
that forgets one changes no count and is the new-door suite's obligation).
The S5 ledger entry above was amended to match (prose → pins).

## Item 6 — ADR 0118 §12

Written: the standing method finding — a sweep boundary drawn on a
return-type SYNTAX (`proretset`) cannot enforce the stated PROPERTY ("the
DEFINER's internal gate is the entire boundary"); D8 moved the M8 cut from a
census-covered storage policy into a `jsonb`-returning DEFINER in no arm's
domain; the `document_delete_affordances` contrast case (TABLE-returning,
inside, census caught the misprediction) proves the mechanism; **536**
pre-existing functions share the class — a standing blind spot for the arms'
next periodic revision, NOT a DM2 regression; DM2's compensation is
behavioral (P0a–P0f + the 308 5.2s sentinel).

# Resumption session 2026-08-13, part 3 (backend) — QA r1 MINOR-1/2/3 + INFO-3/4 closed

Commits: `98c7835` (the five items) · `a2640a8` (two follow-ons MINOR-1's own
fixture surfaced). Interleaved on the branch with the frontend's `7cc833a`
(MAJOR-3 UI half) + `0acdd0d` (MINOR-4/5 + INFO-3 dialog half) and the lead's
`ebd398a` (MINOR-6) — no file collisions. **No migration; 375 == 375.**

## MINOR-1 — pagination (red observed past the page boundary, as required)

Fixture: **1001** `uploaded` rows + 1001 objects in one directory
(`minor1fx/fo0001..1001/1`). **RED (pre-fix script, pinned from commit
`6327591`):** the walk saw **11 of ~1012** objects (the 1001-entry directory
returned only its LAST page) → **missing: 986 (all false)** + **orphans: 1
(false)** → `DRIFT: 992` of which ~0 real. **The fixture also caught a
SECOND same-class defect the review did not name:** the `file_objects` read
was a single `.select()`, PostgREST-capped at 1000 rows — `rows` read was
**exactly 1000** of 1012, the unread remainder judged by nobody, its object
the false ORPHAN. Both directions now paginate (stable sort, accumulate
until a short page). **GREEN:** `objects: 1011 == rows: 1011`, missing 0,
orphans 0. Also fixed while in the file: the ops verdict now sets
`process.exitCode` instead of `process.exit()` — the hard exit during
supabase-js teardown intermittently tripped libuv's UV_HANDLE_CLOSING
assertion on Windows and **swallowed the entire report at exit 127** (an
ops verdict lost to the runtime; observed three times this session).

## MINOR-2 — the lost-update race (proven with a real interleaving)

Real two-session interleaving on the REAL `finalize_document_upload` door
(sweep statements as their SQL twins), timestamps from the run:
`17:10:30.76` expiry set to +5 s → `17:10:31.12` **S1 txn begins** (its
`now()` = txn start, predating expiry, so finalize's predicate passes) →
`17:10:37` **S2 sweep READ** finds the session `reserved`+lapsed (S1
uncommitted) → `17:10:39.14` **S1 finalize succeeds** (`verifying`) and
commits `consumed` → `17:10:42` **S2's OLD unguarded UPDATE:
`state_before_stomp = consumed` → STOMPED to `expired`, UPDATE 1** — final
state `expired` session over a `verifying` file (which is also MINOR-3's
input state, by the race). **GREEN, identical choreography:** the guarded
update (`… and state='reserved'`) → **0 rows, `consumed` survives.**
`expiredSwept` now counts rows actually swept. The `:59` "record it" promise
is kept: a FILE at the bucket root — and at `{org}/x` one level down — is
recorded as an orphan instead of silently skipped.

## MINOR-3 — stuck `verifying` is now swept (reconciled with T4)

Fixture via the real doors: begin → PUT → finalize (file `verifying`,
session `consumed`), verification never called, `uploaded_at` backdated 2 h.
**RED (pre-fix):** the file sat in the `bytes-required` class — present
bytes, no drift, **invisible under the banner**, the reader's eternal
`pending` (BUG-DM2-001's symptom by a second route). **GREEN:**
**`verifyingSwept: 1` observed directly**; the file → `failed` (legal arc)
→ surfaces as UNDISPOSED drift in the same run; subsequent runs 0
(idempotent). Reconciliation with `actions.test.ts` T4 (the live
`verifying` re-entry must keep succeeding): the sweep is deliberately NOT a
second verifier (evaluator-drift class) and fires only after
**60 min** — 4× the 15-min reservation TTL, far beyond any live verifier's
download+hash of a ≤25 MB object — so the two paths cannot meet. The
update is state-guarded in the statement (the MINOR-2 lesson applied).

## INFO-3 (types half) + INFO-4

- `types.ts` trust-boundary comment no longer implies the CREDENTIAL is
  coordinate-free: the signed URL embeds bucket, full path, and a live
  bearer token for its TTL and lands in browser history; ADR 0114 O4 is
  named as the authority. (Dialog half: frontend, `0acdd0d`.)
- DM5 step 5 (`docs/plans/document-model-redesign.md`) now names the
  **Rule-9 exception obligation** — `src/lib/documents/actions.ts`'s
  admin-client coordinate reads, ADR 0118 §1-justified, QA-accepted —
  beside the D8 Rule-1 sharpening, so the canon rewrite cannot lose it.

## Shared-stack note (method, for the record)

The frontend was LIVE on the shared local stack throughout this session
(its E2E fixtures interleaved with mine by the minute). Consequences
handled: all script passes were deferred to observed-quiet windows (their
15-min reservations could not lapse into my sweep's domain during the runs);
the reset waited for an 8-minute-quiet + their commit landing. One
baseline fact this surfaced: the **truly fresh stack runs the script to
`RECONCILIATION CLEAN 0/0`** — the DRIFT-5/6/8/9 baselines seen mid-session
were REAL E2E residue (five byte-holding `failed` fixtures from the
frontend's verification specs + my own), i.e. the classifier's first
catches were genuine, and the seed itself plants no file rows.

## Gate state (session 3 scope — NOT the full §6 gate)

Fresh reset (375 == 375) → `gen:types` diff clean → pgTAP **189 files /
6097 tests PASS** → vitest **86 / 1258 PASS** → lint five-gate OK → tsc
clean → the fixed script on the fresh stack: **RECONCILIATION CLEAN**.
Still lead-owned: authz arms (census zero-delta again — no DB surface
change this round), `e2e:prod`, the two unconfirmed tester probes, QA r2.

## Gate state (session 2 scope — NOT the full §6 gate)

Fresh `supabase db reset` (375 == 375, no new migrations) → `gen:types`
diff clean → full pgTAP **Files=189, Tests=6097, Result: PASS** (6084 + 7
R10 + 6 K16) → vitest **86 files / 1258 tests PASS** → lint **all five
gates OK**; `tsc` clean. Still lead-owned before QA r2: the four authz arms
(census zero-delta this round — no new DB function, policy, or door; the
only body changes were rolled-back mutations), `e2e:prod`, the two
unconfirmed tester probe files, and item 8's 6 MINOR + 4 INFO.

# Resumption session 2026-08-13, part 3 (frontend) — item 3's UI half

## Item 3 — MAJOR-3 (terminal verification failure) — the dialog

Built against the backend's posted contract (`FinalizeDocumentUploadResult.terminal`,
`797d55b`); no backend file touched, no new error code.

**Change.** The dialog now holds a `terminal` state distinct from `banner`,
because the defect was an AFFORDANCE, not copy: on `terminal: true` the
reservation is dropped, every form control is locked, the submit button is not
rendered **at all** (a disabled "Tentar novamente" would still name an action
that does not exist), the only footer control is **"Fechar"**, and
`router.refresh()` runs so the failed row the banner points at is actually on
screen behind the dialog. New pt-BR copy `DOCUMENT_UPLOAD_TERMINAL_MESSAGE`
deliberately repeats the ROW's wording rather than inventing a second vocabulary.
The stale doc comment asserting "retry ... until the reservation expires, which
is the one failure that sends the user back to the beginning" was FALSE after
`797d55b` and is rewritten to name both reservation-ending failures.

**RED/GREEN — observed in a real browser, not inferred.** Fault injection with
no app-code change: `window.fetch` patched (Playwright `addInitScript`) to HOLD
the storage PUT after it really lands; while held, the object's BYTES are removed
from the storage file backend leaving the `storage.objects` row intact — so
`finalize_document_upload`'s presence check passes and the service-role
`storage.download` fails, which is the ONLY organic route to `p_verified = false`
(verified in `pg_proc`, not migration text: the verification door compares
nothing — `failed` is minted solely by the download failing). Both runs ended
`file_objects.upload_state = 'failed'` + session `consumed`, i.e. the real
MAJOR-3 precondition.

- **RED (pre-fix dialog, same injection):** banner "O arquivo não chegou por
  completo. Tente enviar novamente." · footer `["Cancelar", "Tentar novamente"]`
  · every control enabled · panel behind after closing: **"Nenhum anexo"** — the
  row carrying the correct recovery was not even on screen.
- **GREEN:** banner "A verificação do arquivo falhou. Remova este item e envie o
  arquivo novamente." rendered as `<div role="status" aria-live="polite">` ·
  footer `["Fechar"]`, **`type=submit` buttons in the form = 0**, "Tentar
  novamente" count 0 · all user-operable controls `disabled` · panel behind shows
  the row "FALHA NO ENVIO" + "Remova este item…" with a working **Remover**
  (exercised: confirm copy "Remover este item permite enviar o arquivo
  novamente.", row gone, panel back to empty). The recovery the copy names is
  reachable, not a claim.

**Prediction ledger (written before observing; the two that missed).** 9 of 11
held. (a) I predicted every control would report `disabled` in the terminal
state; `input[name=occurredOn]` does not — it is `DatePicker`'s **hidden** value
input, not user-operable, and its visible trigger IS disabled. (b) Environment,
not product: I predicted the Browser pane would drive this. It cannot here —
the pane never composites, so `document.hidden` stays `true` and the page's
client islands never hydrate (5 of 42 buttons); every click is a no-op against
inert HTML. A headless Playwright driver in the scratchpad was used instead.
*A dev page that renders fully and hydrates not at all looks exactly like a
working page to any check that reads text.*

**Left on the local stack:** 5 soft-deleted `documents` rows on meeting
`…0000e1` plus their `failed` file objects and 5 `storage.objects` rows whose
bytes I deleted. All invisible to the UI (panel reads "Nenhum anexo") and washed
by the `supabase db reset` the gate requires anyway.

**Not done / open:** the `upload_failed` first-class code (backend's optional
pairing) — see the recommendation handed to the lead. No E2E probe was added
(tester owns `e2e/`); the affordance half of MAJOR-3 is still unpinned by the
suite — backend's item-3 note 4 stands.

## Items 4–6 (frontend) — MINOR-4, MINOR-5, INFO-3's dialog half — `0acdd0d`

**MINOR-4 was understated, and the understated half was not the defect.** QA read
the delete button as rendering the GENERIC fallback where a mapped pt-BR string
existed. Driven for real (legal-hold refusal, headless driver): it rendered
NOTHING — `ALERTDIALOG AFTER REFUSAL >>> (closed)` with `documents.status` still
`active`. `AlertDialogAction` is Radix's `AlertDialogPrimitive.Action` and closes
on click, so `setError` wrote into an unmounting subtree and the `role="alert"`
paragraph was dead UI: a refused delete left the row in place, unexplained.
Mapping the error code alone would have "fixed" copy into an element no user can
reach. Three sibling confirm dialogs (`ethics-decisions-panel`,
`archive-indicator-button`, `meeting-type-manager`) already `preventDefault()`
there; this one did not. Both halves fixed — the dialog now closes only on
success, and the closed 14-member union is mapped through `documentErrorMessage`
(an out-of-union value still falls back, never reaching the UI).

**Second correction to the finding's stated cost:** `document_delete_affordances`
returns `canDelete = false` whenever an unreleased hold exists (catalog), so a
freshly-loaded page renders NO Remover under a hold at all. The `under_legal_hold`
refusal is reachable only from a page whose affordance was computed BEFORE the
hold — an already-open tab. Real, but a race, not a steady state.

**RED/GREEN.** RED: dialog gone, no message, `status = 'active'`. GREEN: dialog
stays open, `<p role="alert" …>Este documento está sob retenção legal e não pode
ser removido.</p>` rendered, status still `active`; hold then released and the
SAME open dialog completed the delete → `soft_deleted`, dialog closed, row gone
(success path not regressed).

**Prediction ledger:** I predicted the fallback would render on RED. WRONG —
nothing rendered. Recorded before editing, then re-predicted; the four revised
GREEN predictions all held. *A "safe" fallback and a message that cannot render
look identical from the outside; only driving the refusal separates them.*

**MINOR-5.** `canWrite`/`canDownload` are now REQUIRED, not defaulted to `false`:
a silent deny is still a guess about a question only the caller can answer, and
`tsc` now makes the next call site answer it. Matches the meeting/interview
adapters, whose `canEdit` was always required. One call site exists
(`case-detail-view.tsx:723`) and it already passed both — `tsc` clean, and the
case panel still renders "Anexar documento" and its rows (observed).
**Lead ruling: accepted over `= false`** — defaulting would have fixed the
direction while keeping the shape that made MINOR-5 a trap. The server door
remains the boundary; these props hide controls, they enforce nothing.

**INFO-3 (dialog half; backend owns `types.ts`).** "The client never learns a
bucket, a path or a token" was false — the signed URL embeds the bucket and the
full object path and carries a live bearer token. Replaced with what is true: no
storage coordinate is handed to the component as DATA, and the credential is
single-purpose, perishable, and only ever `fetch`ed, never navigated to (so the
session-history concern is the download corridor's, not this one's).

**Gates:** lint 5-gate OK · `tsc` clean · vitest 86 files / 1258 tests PASS.
**Left on the local stack:** 4 `active` documents on meeting `…0000e1` from the
driver's uploads (visible in its Anexos panel); **0** legal-hold rows — every
fixture inserted was deleted. Cleared by the fresh `supabase db reset` the gate
already mandates. No E2E spec targets the document delete confirm dialog, and the
success path is unchanged.

**Lead note — the `upload_failed` pairing is DECLINED** (frontend's call, adopted):
terminality is orthogonal to cause, and a code-per-cause forces the dialog to
enumerate causes, which is a fails-open list. Revisit only if a second terminal
cause appears (a Wave B/C scanner `infected` verdict is the candidate).

# DM2 re-gate (lead, 2026-08-13) — handoff item 7, after all remediation landed

**Scope:** the full §6 step-1 gate re-run on a fresh `supabase db reset`, at HEAD `9de4a39`
(all QA-r1 remediation + the tester's confirmations committed). Arms are named, not the
script (§6 step 5 / ADR 0079).

| Gate step | Result |
| --- | --- |
| fresh `supabase db reset` | clean |
| `npm run test:db` | **189 files / 6097 tests / PASS** |
| `npm run lint` (five gates) | ALL — `lint:vacuous` 179 spec files / 0 findings |
| `npm run typecheck` | 0 errors |
| `npm run test` (vitest) | 86 files / **1258** tests |
| `ARM=census` — *has anything ever asked?* | **HOLDS** — 549 live gates, 569 verdicts, no unswept newcomer |
| `ARM=hat` — *does any door read `memberships` without the caller's hat?* | **HOLDS** — 3 findings, all reasoned-allowlisted (`assume_role`, `session_context`, `memberships_select`) |
| `ARM=floor` — *is every door called?* | **HOLDS** — 77 never-called doors, all on the floor allowlist |
| `FROMFINDINGS=1 ARM=wrapper` | **HOLDS** — BLIND 41 ⊆ allowlist |
| diff-scoped door sweep | `app.can_read_document` **COVERED**; BLIND 0 / ERROR(harness) 0 |
| `e2e:prod` | **GREEN on run 2** (see the triage below) |

**The sweep's case list was DERIVED, not hand-written** (ADR 0079 Amdt 1 recipe): the eight
DM2 migrations `20260924000100`–`…000800` yield exactly **one** gate in the recipe's domain
(`can_read_document`, changed by `…000800`) and **zero** new policies. **Case count checked
nonzero before citing it** — the run printed a real `COVERED` line for the case, not the
`BLIND: 0` over zero cases that this project has been burned by. `WORK` was overridden and
`docs/reviews/authz-door-audit-findings.md` restored to its committed 594 lines afterwards
(hazards 1 + 2).

⚠ Note what the diff-scoped sweep does NOT cover, so the record does not overstate it:
`open_document_version` — the door carrying the P0-1 byte cut — returns `jsonb` and is
therefore in **no** arm's domain, which is precisely INFO-1 / ADR 0118 §12's standing blind
spot. Its assurance is pgTAP `329` P0a–P0f (falsifiability observed this session) and the
`308` sentinel, **not** this sweep.

## `e2e:prod` — one unexplained red in run 1, GREEN in run 2. Mechanism NOT proven.

- **Run 1: GATE RED — 1 real failure.** `pdf-printing.spec.ts:38` ("full lifecycle"), failing
  its **pre-mint** empty-state assertion at `:50` (`Nenhum documento emitido a partir desta
  resposta ainda.`). 1090 passed · 1 failed · 2 flaky · 0 did-not-run · 17 batches; coverage
  1093/1099 with the 6 unaccounted **exactly** the 6 skips.
- **Run 2: GATE GREEN.** 1091 passed · 0 failed · 2 flaky · 0 did-not-run; same coverage
  reconciliation. **Batch 8 — the failing batch — returned 60 passed / 0 failed.**
- **Three independent disproofs, all `RETRIES=0`:** isolation **9/9**; identical-batch re-run
  (same four specs, same order) **60 passed / 1 skipped / 0 failed**; and the full-suite run 2
  above.
- **Not a DM2 surface.** `src/components/printing/labels.ts` is untouched by the DM2 diff and
  the expected string is intact in source; the phase touched no printing module.

**Three honest caveats, recorded rather than smoothed over:**
1. **The mechanism is UNPROVEN.** The batch-8 log carries **no infra signal** — no
   `server_dead`, no connection errors. This is therefore *not* the DM1 precedent, where the
   flake was proven (`server_dead=1`, 14 conn errors). "Non-reproducible" is what was measured;
   "flake" is an inference.
2. **The lead destroyed the evidence.** `test-results/` is wiped per run, so the re-runs
   deleted the `error-context.md` page snapshot that would have said what was actually on
   screen. **Capture artifacts BEFORE re-running.**
3. **"Failed twice" was ONE observation, not two.** The gate's retry hit the same pre-mint
   assertion, so the retry is dependent on the first failure, not independent confirmation.

*Live lead of an unresolved hypothesis, for whoever sees this again:* the P1 record
(`docs/progress/pdf-p1-forms-skeleton.md` T1) states the spec draws from a **deterministic
id-ascending pool of 5 seeded submitted responses**, one per state-mutating test. A shared
fixture pool resolving differently under some batch interleaving is the known class here
([[a-shared-fixture-cannot-satisfy-two-specs]]) — but the identical-batch re-run passed, so it
is not deterministic and the hypothesis is **untested**, not adopted.

**Two infra events in run 2, both auto-classified and re-run clean:** batch 16 the documented
Windows prod-standalone collapse (`server_dead=1`, 46 conn errors → 69/69), and batch 5
**crashed exit 127 with no summary** while `server_dead=0`/`conn_errors=0` (→ 70/70). That
exit-127-with-output-swallowed shape is the same class backend hit three times this session
with `process.exit()` and libuv's teardown assertion on Windows — worth watching, since a
runbook keyed on an exit code cannot tell it from a real failure.

---

# Rotated from PROGRESS.md at the DM2 Record step (2026-08-13)

Verbatim, per the lead-playbook §5 rotation discipline: the live PROGRESS.md keeps a
one-line pointer, and everything below stays here so nothing is lost. This block is the
DM2 slice table (S1–S5), the lead notes, the P0 block and the browser-verification record
as they stood in PROGRESS.md at approval.

### ⏸ PAUSED — **DM2: orchestration + Wave A** (opened 2026-08-13, paused 2026-08-13 by PO)

> **⛔ DM2 has NOT passed its gate.** QA r1 = **CHANGES REQUESTED** (1 P0 · 3 MAJOR · 6 MINOR · 4 INFO). **Do not flip the flags, do not seek approval, do not merge.** Paused because the backend agent was killed **four consecutive times by transient API 529s** (twice resumed, then replaced by a fresh lightweight agent that failed identically — disproving the context-size hypothesis; the API was broadly degraded while the lead's own session kept working, which is why the recorded state is verified rather than assumed).
> **Safe checkpoint:** HEAD `56e3989`, 374 on disk == 374 registered, nothing half-applied, all five DM flags **OFF** in production defaults, nothing pushed (`main`/`origin/main` = `f84c6b6`).
> **The P0 is FIXED and verified from two independent directions** (lead catalog + planted-row probe; tester red-then-green through the door via REST). What remains is proof discipline and two MAJORs.
> ✅ **PO RULING 2026-08-13 — MAJOR-1 / S1-O4: PROPAGATE the interview's confidentiality to its
> documents.** A document homed on an interview must be gated by **that interview's own ceiling**, not
> only by case-level access. It is **item 0 of the next session** — the first thing picked up.
> *Lead-reproduced as a differential probe (same member, same interview, one variable):*
> `app.can_read_interview` = **false** while `app.can_read_document` on a document homed on it =
> **true**. The kernel's interview arm dispatches `can_read_case_committee(case_of_interview(...))`,
> which **skips a level** — it never consults `case_interviews.confidentiality_level`, so the
> interview row is hidden while its transcript is not. Parity with the retired substrate is real, but
> parity answers *"did we break this?"*, not *"is this correct?"* — and the old substrate is being
> replaced **because** it had this shape of defect. Requires an ADR amendment when built (ADR 0117 is
> the ceiling's decision record; ADR 0114 Amdt 1 D15/D16 the governing frame).
>
> ▶ **Resuming? Read the handoff first:** [dm2-orchestration-wave-a.md § *DM2 PAUSED — resumption handoff*](docs/progress/dm2-orchestration-wave-a.md) — it carries the 8 remaining items in order, the PO-owned questions, and two method findings that must not be lost (an uncommitted migration is applied by anyone's `db reset` and silently fixes the defect before the test meant to catch it runs; and a sweep boundary drawn on a return-type *syntax* cannot enforce a *property* — 536 functions share that class).

> Program: Document Model Redesign — plan [DM0–DM5](docs/plans/document-model-redesign.md) §DM2 ·
> ADR [0114](docs/decisions/0114-document-model-redesign.md) (+Amendment 1 D15/D16) · DM1 record
> [dm1-substrate-cutover.md](docs/progress/dm1-substrate-cutover.md).
> Branch: `docs/dm1-plan-amendments` (continues DM1's branch — `main` does not carry DM1; PO
> directive stands: **nothing to `main`, nothing remote**). Migration window: **`20260924000100`+**
> (highest registered = `20260923000600`; 367 registered == 367 files, catalog-verified 2026-08-13).

**Sequencing — S1 is a hard prerequisite, not a preference.** ADR 0114 Amdt 1 D15: the ceiling must
land *before* Wave A re-points any case / meeting / interview document, because that is the phase in
which a formerly gated document would silently become readable by every ordinary case reader.

| # | Slice | Owner | Status | Depends on |
|---|-------|-------|--------|-----------|
| S1 | **D15 confidentiality ceiling** — nullable label column on `documents` + kernel arm in `app.can_read_document`; restores pgTAP `228` t36–40 | backend | ✅ **done 2026-08-13** — migrations `20260924000100`+`…000200` (AMEND 1 two-step, behavioral reds observed on the real pre-arm catalog: 228 t36/t38 + 328 K14d1–d4 all `have: 1, want: 0`); seam guard **HC0D6** (HC0D5 taken by `revoke_printed_document`) + fail-closed kernel backstop; `228` 131/131 + `328` 109/109 (K14, 21 asserts); twins A+B rollback-verified; full pgTAP **188f/5952 PASS** fresh; 4 arms HOLD; diff-scoped sweep `can_read_document` 1 case COVERED/0 BLIND/0 ERROR; gen:types +3; **AMEND 3 = PARITY** (finding DM2-F1); open-door pins → S2 (S1-O1) · [record](docs/progress/dm2-orchestration-wave-a.md) · ADR [0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md) | — |
| S2 | Command layer + `src/lib/documents/` + reconciliation script. **Head task: the Phase-17 rename** (plan amendment 2026-08-13) | backend | 🟢 **built 2026-08-13 except S2.8** — rename ✅ · contract (+10 amendments) ✅ · migrations `20260924000300`+`…000400` ✅ (FINDING 1a removal; dispose arm = FUP-DM1-DISPOSE ✅; S1-O1 ✅; MINOR-2 ✅) · keystones 329 66/66 · 228 135/135 · 328 109/109 · 191 27/27 · full pgTAP **189f/6023 PASS** fresh · 4 arms HOLD (census zero-delta, doors registered as findings note) · 5 per-state twins · TS layer + reconcile script ✅ · O4 measured (sign 10 ms; file-chain ~3.7 ms/row watch item) · ADR [0118](docs/decisions/0118-dm2-s2-command-layer-decisions.md) · **S2.8 ✅ built 2026-08-13** (lead-approved; 3 conditions discharged; `20260924000500`; 329 92/92; suite **189f/6049 PASS** fresh; census required-FAIL captured→HOLDS 549/569; O4 + list-perf PO-ruled — [record](docs/progress/dm2-orchestration-wave-a.md) §S2.8) — **S2 CLOSED** | S1 ✅ |
| S3 | Wave A UI — case / meeting / interview panels re-pointed; upload states in pt-BR; D12 dialog copy | frontend | 🟢 building 2026-08-13 — plan acked; shared `src/components/documents/` module (3 homes, one byte-corridor client). **Contract-first paid: 10 gaps found in the S2 stubs before either side hardened**, 3 of them visible F2 regressions (`kind` unsettable so the badge ships dead · `occurredAt` dropped · `underLegalHold` absent from the list, so per-row delete would offer an action HC0D3 refuses) — all routed to `backend`. Upload island unblocked once item 5 (PUT transport) was specified. **Gates green** (5-gate lint 0/0 · typecheck exit 0 via `PIPESTATUS` · vitest 1254 · real `next build` exit 0). **Lead-run browser verification 2026-08-13** — see the block below | S2 contracts ✅ `92d7e8a` |
| S4 | E2E — **priority 1: the unexercised write path** (see the red block above), then rewrite the 6 parked specs (FUP-DM1-E2E) incl. the M8 bytes-cut contract, AC-4a–d/AC-9 (the last of FUP-DM1-CEILING), + a keyboard-only flow; mutation list | tester | ✅ **done 2026-08-13** — **PRIORITY 1 ANSWERED: the write path is NOT broken** (real browser PUT → signed URL → finalize → verification → `available`, genuinely fetchable download, audited exactly once; retry + expiry hold functionally). 6 parked specs restored per ADR 0114 D5 (rewritten, never deleted) + new `e2e/helpers/document-model.ts`. **3 real bugs found, all fixed in-phase** (001/002/003). Final: **77 collected · 76 passed · 1 pre-existing unrelated skip · 0 unexpected failures · zero `test.fail()` pins remaining**. ⚠ **Method note worth keeping:** the tester independently applied the lead's BUG-DM2-002 pin-reasoning to **003** — the fix had *moved* the mechanism to reconciliation rather than repairing the inline UPDATE, so un-pinning as literally written would have left a permanently-red test **for a different reason than it was filed for**. Rewritten as `DM2-RECONCILE-EXPIRY`, which asserts `reserved` immediately after the HC0DE refusal (proving the synchronous marking is *gone*, not hidden) and then runs the **real** reconciliation script. It also re-audited every `audit_log` read across the five touched files after the F3 fixture-fragility warning — all already `action`+`entity` scoped — and deliberately avoided global drift counts in the new reconciliation assertions | S3 ✅ · seed `01134b1` ✅ |
| S5 | QA review + full §6 gate + flag choreography | qa / lead | ⛔ **CHANGES REQUESTED (r1) 2026-08-13** — **1 P0 · 3 MAJOR · 6 MINOR · 4 INFO** [review](docs/reviews/dm2-orchestration-wave-a-review.md). **The phase does NOT pass gate step 3; the flags must NOT flip.** See the P0 block below | S4 ✅ · `e2e:prod` GREEN |

**Carried in from DM1 (do not re-derive — bodies in the DM1 record §"Carried into DM2"):**
FUP-DM1-CEILING/D15 (= S1) · FUP-DM1-E2E (= S4) · FUP-DM1-DISPOSE (S2, before the flag flips) ·
QA MINOR-2 (`open_document_version` must gate **before** recording — the registry inherits an
`is_admin()` short-circuit) · plan **Q1** (ethics seams still have no wave — PO; blocks DM3, not DM2) ·
**O4** (signed-URL TTL per sensitivity — decide with the PO against real DM2 latency).

**Flag posture during DM2** (seed `01134b1`): `seed.sql` forces `documents_foundation` +
`documents_wave_a` **ON for local/E2E** (the MIN `audio_minutes` pattern); **production defaults stay
OFF** until the S5 choreography. ⚠ Consequence, noted at the flip site because that is where a spec
author looks: a spec pinning the deliberate **flag-OFF** contract (affordances **absent, not
disabled**; every door raises HC0D7) must toggle the flags **itself** and restore them.
**`attachments` is seed-retired only** — the key row, the `FeatureFlags` entry and
`attachmentsEnabled()` retire in the **S5 migration**, deliberately: production never runs `seed.sql`,
so a seed `DELETE` would fork local from prod on the key's *existence* (local "no such flag" vs prod
`false`) — the exact drift class two prior programs were spent killing. A migration is the only
honest instrument for a change production must also see.
⚠ Ripple caught before it reached the tester: pgTAP `328` **K9** pinned all five DM flags OFF and
would have gone red on the tester's **first** fresh reset — a red with no defect behind it, arriving
exactly when the tester is calibrating what "normal" looks like. Rewritten to assert the *seeded*
state with the prod-default caveat in the pin name. Suite re-run **189f/6051 PASS** (6049 + 2).

**🛑 P0-1 (QA r1, 2026-08-13) — THE OVERSIGHT QUALITY REVIEWER IS SERVED PHI BYTES; the only control is a React prop.** Lead-reproduced independently before routing, twice over:
- Catalog: `app.can_read_document`'s case arm is a **bare `app.can_read_case`** — `prosrc ~ 'read_case_deliberation'` is **false** — and `open_document_version` carries **no** byte discrimination of its own (`prosrc ~ 'deliberation|oversight|quality_reviewer'` = false).
- Live probe: `app.case_capabilities(case, quality.a@test.local)` = `["read_case_content","view_case_overview"]` — **no `read_case_deliberation`** — yet `app.can_read_document(...)` on a document homed on that case returns **true**. QA's own matrix went further: `open_document_version` → **SERVED tier=phi**, with a non-vacuous outsider control raising `P0002`.
**The QO·B M8/M9 byte-discrimination cut was never re-expressed in the new corridor.** The only shipped control is `case-detail-view.tsx` `canDownload={!isOversight}` — **Architecture Rule 1 inverted** ("never rely on UI hiding"), and `document-row.tsx`'s own comment claiming it "suppresses the audited door outright; there is no second byte path" is **false in both clauses**.
⚠ **Why the green bar certified it:** the restored E2E asserts the **button** has count 0 (`quality-oversight.spec.ts:502`), so it pins the UI-only control — [[green-bar-misses-the-wired-seam]] exactly. And **why four green authz arms missed it**: the M8 cut used to live in a *storage policy*, inside `ARM=census`'s domain; D8 deliberately deleted the SELECT policies and moved the boundary into a **`jsonb`-returning DEFINER**, which is in **no** arm's domain. QA checked the domain predicate rather than the claim and confirmed the lead's census reasoning was correct — `proretset` is why `document_delete_affordances` was caught and the jsonb doors were not. **The carried lesson: clause 2's boundary is a return-type *syntax* while its stated principle is a *property*, and 536 pre-existing functions share the class.** Not a DM2 regression — DM2 is just where the first defect landed in the new location. ⚠ `supabase/tests/308_case_caps_s7.sql:291-303` **states this obligation verbatim** ("That door's keystones MUST re-express all six pins") and **ran green this phase**; the DM2 record contains zero occurrences of "oversight", "quality reviewer" or "ADR 0100".

**Tester re-verification (2026-08-13, P0-1):** `e2e/quality-oversight.spec.ts`'s two M8 tests
strengthened to hit the door, not the button — three additions per the lead's spec: (1) metadata
visibility kept as-is (must not over-narrow — the reviewer is *supposed* to see titles), (2) the
button-absence check kept as-is, (3) `quality.a`'s test now calls `open_document_version` **directly**
via REST (bypassing the UI entirely) and asserts it **REFUSES**, (4) a **non-vacuous positive
control** in "no-lockout control": chefe.ccih calls the SAME door on the SAME document and is
**served** — so a blanket door failure or a broken fixture cannot make the negative pass for the
wrong reason. **Red-first OBSERVED, not inferred:** backend's fix (`supabase/migrations/
20260924000700_dm2_qa1_byte_deliberation_cut.sql`) was already applied locally but **uncommitted**
when this run started, so the strengthened test passed immediately — not proof enough on its own.
Set the migration file aside, fresh-reset, re-ran: **genuine RED** — `open_document_version` returned
`ok=true` with the full title/mime/size/tier payload to quality.a, reproducing QA's P0-1 exactly, byte
for byte. Restored the migration, fresh-reset, re-ran: **GREEN**, and the positive control held
throughout (never a blanket refusal). Regression sweep: all 6 S4 files, fresh reset — **77 collected,
76 passed, 1 pre-existing unrelated skip, 0 collateral damage** — the new `read_case_deliberation`
conjunct on `open_document_version` does not touch the meeting/action_item arm (`v_case` stays null
there) and every case/interview persona the other 8 restored tests use already holds
`read_case_deliberation`, so nothing else regressed. Lint/tsc/`lint:vacuous` all clean.
**Re-scan requested by the lead** (any restored assertion whose subject is a rendered control rather
than a server answer, carrying an authorization claim): AC-4a–d/AC-9, `DM2-CEILING-NOONE` and
`DM2-FLAGOFF` were already door-level (the last one explicitly demonstrates+documents the
`documents_wave_a`-vs-`documents_foundation` split, routed to backend for S5). Two **coverage gaps**
(not confirmed vulnerabilities — the door was independently read from `pg_proc` and does enforce both,
just not exercised by these specs end-to-end): `phase11-interviews.spec.ts` IV2-11 only exercises the
CLIENT-SIDE MIME block (`begin_document_upload`'s own `HC0DG` server check, confirmed present in the
live body, is untested by any bypass path); `phase-f2-attachments.spec.ts` `DM2-STATES`' `pending` row
asserts a *disabled* button (never clickable, so no live corridor to bypass there) but does not
independently probe `open_document_version` on an unbound version (confirmed via `pg_proc`: raises
`HC0D8`, untested by E2E). **Spot-checked, not assumed:** the pre-existing (not S4-authored)
`notFound()`-page-based denial tests this file and `ethics-e1-access-spine.spec.ts` share (AC-1a
respondent-exclusion, AC-2a explicit-grants-only) — direct REST reads of `cases`/`case_phases` for
both personas returned `200 []`, genuine RLS-level filtering, not a page-level-only check — **not**
the same shape as P0-1.

**🔴 THE SHARPEST OPEN RISK IN DM2 — the write path has never moved a byte** (raised by `frontend`
at S3 close; lead-confirmed). `begin_document_upload` is **proven reachable and correctly shaped**
(lead called it directly under `set local role authenticated` with real `sub`+`active_role` claims:
it authorized, minted document+version+file_object+session, and returned **IDs only, no bucket or
path** — so the ADR 0118 §1 door topology holds *behaviourally*, not just by construction; rolled
back, 0 rows). But **nothing has ever exercised browser → server action → RPC → Storage PUT under
the reserved-path INSERT policy → finalize → verification.** Every upload-island state
(`preparing`/`uploading`/`finalizing`, the `upload_incomplete` retry that reuses the reservation,
`upload_expired` dropping it) is **unexercised code**, and the retry branch is the kind that looks
right and isn't. 329's 92 pins cover the *doors*; they do not cover the *seam*. This is the
[[green-bar-misses-the-wired-seam]] class — three live bugs once survived a full green bar there and
only E2E caught them. **S4's first priority, not something to treat as covered.**

⚠ **Tooling note that nearly produced a false regression report.** Mid-verification the case page's
entire content sat in a `div[hidden]`, buttons had no React fiber props and zero bounding rects, and
clicks did nothing — which read exactly like a hydration regression from the preceding commit. It was
not: **the Browser pane was not displayed, so the page was not compositing frames** (the screenshot
call is what surfaced it). Consequence for method: `javascript_tool` text/DOM reads stay valid without
compositing — the copy, option lists and badge assertions above are sound — but **layout, real
clicks, and hydration-dependent behaviour are not observable with the pane hidden**, and their
absence must never be read as a defect. Take a screenshot early; its failure message names the
condition when nothing else does.

**✅ S3 BROWSER VERIFICATION — lead-run 2026-08-13** (the agent stalled twice on a **denied**
`preview_start`; PO approved it, and the lead ran it rather than risk a third stall — full stall
mechanics in the S3 record). Dev preview on **:57449** (3000 held a stale bind). Method that made
this worth doing: **the agent wrote its per-affordance flag-OFF prediction down BEFORE any
observation**, so the run could falsify it. It held everywhere except the two items the agent had
itself flagged as *unverified deviations* — a prediction that survives contact is evidence; one
written afterwards is not.

- **Flag OFF (ship state), all three homes:** heading renders · read-only empty copy · upload
  trigger **absent, not disabled** · open + delete absent · **console clean**. Interview links
  behaved per the lead ruling (count shown, existing row still readable, "Adicionar" absent).
- **Flag ON:** trigger appears · empty copy switches to the writable variant · **console clean —
  no RSC server-fn-as-prop crash** (BUG-QI-001 class), only HMR + benign font-preload warnings.
- **🔒 The D15 ceiling's UI half is CORRECT END-TO-END** — the highest-value check of the set. On a
  **case** home all 7 levels are offered; on a **meeting** home `legal_privileged` +
  `credentialing_sensitive` are **absent from the option list** while all 5 non-enforcing levels
  remain. It narrows exactly where HC0D6 refuses and **nowhere else** (no over-narrowing).
  ⚠ **Scope of that claim, stated because the lead overstated it verbally and to `tester`:** what was
  verified is the **write-side option list**. The **read-side** denial affordance was *inferred*, and
  the inference was **wrong** — see BUG-DM2-002: denial is **row-absence**, so the "Restrito" badge is
  unreachable. The lead confirmed what rendered and assumed what did not. *An affordance nobody has
  seen render is a claim, not a fact* — the same trap `frontend`'s write-the-prediction-first habit
  avoided in the other direction.
- **D12 copy renders verbatim** on case + meeting, incl. the Título help that carries the actual
  reason ("visíveis para toda a comissão, inclusive para quem não pode abrir o arquivo").
- **The kind-slug drift fix is live:** case emits `other|Outro`, meeting emits `outro|Outro` — the
  deliberate quirk preserved, slug from the contract, wording from the UI.
- **A document ROW was rendered for the first time** (lead planted a temporary row, since nothing
  had verified one; removed after, 0 rows and flags restored to OFF). It proved the **kind badge is
  live, not dead** — the exact regression contract-first caught at stub time.
- Two defects found + fixed in-phase: the interview heading promised "gravações" a panel no longer
  contained; and the count badge was missing (then rendered `0` where every sibling hides at zero).
- **INFO for QA (not a defect):** with `latestVersion` null a row asserts both "Sem arquivo" and
  "o arquivo contém dados de paciente". `containsPhi` falls back to the home rule when no file
  exists — the **correct fail-safe** (over-warn, never under-warn) — and the state is unreachable
  via `begin_document_upload`. Fallback deliberately left alone.
- **Recorded decision, so it is not later read as an oversight:** `DocumentsPanel` awaits its list
  alongside the flag read in `Promise.all` rather than streaming under Suspense — needed for the
  header count, consistent with every sibling section, ~1.6 ms/row against a 45-object census.
  Remedy if volume ever changes that: a `cache()`-wrapped query sharing one round trip.

**⚠ METHOD FINDING — the census caught the AUTHOR'S OWN domain misprediction (2026-08-13, S2.8).**
Worth carrying past this program. Backend's S2.7 findings note *predicted* that SETOF doors stay
outside the census domain — a reasoned claim, written into the findings file, and **wrong for
`document_delete_affordances`**: `ARM=census` FAILED naming exactly that door (549 live gates). Two
consequences the phase handled correctly and a third to remember: (a) the required-fail is not
ceremony — it is the only thing standing between a reasoned domain claim and a silently
unregistered gate; (b) the prescribed diff-scoped sweep then printed **`BLIND: 0` over ZERO executed
cases** (the ARM-1 `^(is_|can_|has_)` matcher cannot run that name) and was **not cited**, coverage
coming instead from a targeted mutation (door forced `true` → a plain member gains the affordance,
A2/A3 would red; restore catalog-verified) — the case-count rule applied as intended; (c) **the wrong
prediction was corrected IN PLACE in the findings file**, not merely superseded, so it cannot mislead
a later reader. A stale reasoned claim inside the artifact that records coverage is worse than no
claim — [[a-comment-is-an-assertion-that-goes-stale-silently]], census edition.

**✅ PO RULINGS 2026-08-13 (DM2).** **O4 CLOSED** — signed-URL TTL **PHI 120 s / standard 300 s**,
**no streaming proxy** (sign median measured **10 ms**). The tier split is deliberate and must not be
"simplified" to one number: a signed URL is a bearer token, so PHI bytes carry a strictly smaller
exposure window. Lands in ADR 0114 (O4's closure) + ADR 0118. · **List perf** — the file-chain costs
~3.7 ms/row (a 200-doc panel ≈ 2 s); **keep `containsPhi` + `availability`, do NOT trim the embed** —
the prod census is 45 objects total and real panels hold single digits, so the trim would spend two
live projection fields on a load that does not exist. Filed as a **named pilot watch-item** with the
measured numbers attached, not a pre-ship fix.

**✅ RULED — S2.8 `reclassify_document_file` (lead, 2026-08-13): option 1 + an evidence-gated
duplicate-retirement exemption, with 3 conditions.**
The re-derivation confirmed the fork was real — `document_version_files_version_rendition_uniq
UNIQUE (document_version_id, rendition_kind)` does block the originally recommended
"second `source` binding" shape (backend had checked the table's *triggers* but never listed its
*constraints*; owned and corrected). **Shape:** reclassification mints a **new `document_version`**
whose binding points at the copied file — fully append-only, **zero DM1-invariant edits**, and the
visible version history is honest (the bytes genuinely changed bucket, audited via
`document.reclassified`). **The hole option 1 alone left:** the old file stays *bound* to its
immutable old version, so retiring it hits the provisional-retention gate HC0DR — and the urgent
reclassify case is precisely mis-tiered PHI that must leave the wrong bucket. **The amendment:**
`complete_document_disposal` honors reason `duplicate` **only when the door itself verifies** a live,
servable **same-sha256** file bound to the same document — retention protects the *record*, and a
same-content sibling proves the record survives. Caller-asserted duplication is never accepted.
**Conditions:** (1) the last-copy invariant is keystoned as a **differential pair** — dispose A while
B is live → permitted, then B with no sibling → **refused by retention** — because "the last copy is
protected" is the entire safety claim and an inductive argument must be executable, not reasoned;
(2) the exemption as described is **wider than its use case** and symmetric (nothing in
sha/live/same-document distinguishes the correct-tier copy from the mis-tiered one, so it would
equally permit retiring the *new* copy) → narrow its reachability to the reclassification path, or
keep it general and pin that a `duplicate` disposition of a **non**-duplicated file is refused;
(3) it lands as an **ADR decision, not a state-only note** — it creates a new retention-exemption
class, and a future reader hitting HC0DR must find its bounds without reconstructing them.
Standing rule: *DM1 invariants may be amended, never widened as a side effect of making a command
compile.*

<!-- superseded fork text kept below for the reasoning trail -->
**🔶 (RULED — see above) design fork — S2.8 `reclassify_document_file`.**
D10's copy→verify→commit→retire-source has no legal expression on the DM1 substrate as built, and
the recommended shape does not survive the catalog:
- `document_version_files_version_rendition_uniq UNIQUE (document_version_id, rendition_kind)` —
  so **"add a second `source` binding, door picks newest" is not buildable**; it requires altering
  that constraint, i.e. it does *not* avoid a DM1-invariant edit as its proposal claimed.
- `guard_document_version_file_immutable BEFORE DELETE OR UPDATE` — so a liveness column cannot be
  set without a guard exception either.
- **Mutating the binding is ruled OUT on ADR grounds, not cost:** ADR 0114 **D10** says
  *"never a pointer update (F-03)"*, and F-03 is one of the audit defects this program exists to
  kill by construction. Relaxing the guard to allow it re-opens a closed finding.
Live option space (backend re-deriving against the catalog): **(1)** a new `document_version` whose
binding points at the new file object, old file retired through the *mutable, already-guarded*
`file_objects` state machine — fully append-only, zero invariant edits, but a tier change becomes
visible version history (honest for audit? or pollutes the prior-version semantics DM3 needs?);
**(2)** a partial UNIQUE over a liveness predicate **plus** a narrow keystoned guard exception;
**(3)** unseen. Standing rule set for it: **DM1 invariants may be amended, never widened as a side
effect of making a command compile** — any amendment lands as an ADR decision with the amended guard
mutation-proven. ⚠ Reclassify has **no Wave A UI consumer** (both classification commands are
surface-less by lead ruling), so there is room to get it right; deferring to a named slice with the
DM1 ledger obligation carried forward is an acceptable outcome.

**Lead findings handed to S1 (catalog-verified 2026-08-13, not read from migration text):**
- `app.confidentiality_clearance_ok(p_case_id, p_label, p_uid)` and `app.confidentiality_rank(text)`
  **SURVIVED DM1** — only the attachment-specific wrapper `app.attachment_confidentiality_ok` was
  dropped. D15 **reuses** them (program invariant: reuse the domain predicates, never reimplement).
- Only `legal_privileged` + `credentialing_sensitive` are ENFORCING; the other five labels return
  true. Clearance = `case_access_grants.max_confidentiality` outranking the label.
- ⚠ **The clearance helper is CASE-scoped.** `documents.home_resource_id` resolves to case ·
  meeting · interview · action_item. Only `case` (direct) and `interview` (via
  `app.case_of_interview`) yield a case id; **meeting and action_item do not** — S1 must rule that
  seam explicitly and fail closed, not silently skip the ceiling.
- ⚠ **Name-collision trap:** the Phase-17 controlled-document module owns a different
  `%document%` family (`commission_of_document`, `is_document_approver_of`,
  `guard_document_transition`, `trg_audit_controlled_documents`, …) on `controlled_documents`. A
  `%document%` sweep hits both substrates. Enumerate by table, never by name substring.

Most recent completed phase: **DM1 — substrate cutover**, PO-approved 2026-08-13 (record linked
above). Before it: **REG·KIND** (ADR 0110) merged 2026-08-12 — one Registro
vocabulary for cases and referrals. ⚠ **It ran gate step 1 ONLY** (no tester pass, no QA review, no
`e2e:prod`) by PO direction. It is ✅ **pushed, and the remote `db push` IS done** (corrected
2026-08-12) — but that changes nothing about the gate: treat it as
merged-but-ungated, not as complete. Before it, **RDR** (referral detail redesign) completed, merged
and rotated the same day — task detail, the final gate record and the method lessons are in
[referral-detail-redesign.md](docs/progress/referral-detail-redesign.md) (⚠ its type-vocabulary
sections are **history**: REG·KIND deleted `referral_note_types`); ETH·E4 before that is in
[eth-e4-participant-seating.md](docs/progress/eth-e4-participant-seating.md). What is left before
the pilot is § *Remaining pre-pilot work*.


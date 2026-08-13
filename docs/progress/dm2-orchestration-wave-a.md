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
- **S5 choreography ledger addition (lead-routed, tester-pinned):**
  `documents_wave_a` gates the UI; `documents_foundation` gates the RPC layer
  — with foundation ON and wave_a OFF the UI is dark while a direct API
  caller can still write. **The two flip together, and `documents_wave_a`
  alone is NOT a kill switch** — if a wave flag is ever meant as an emergency
  stop it must gate the door, not only the surface.

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

1. **Close P0-1's proof.** Red-first for P0a–P0f (revert the `read_case_deliberation` conjunct in a
   **rolled-back txn**, each pin must red; verify the restore **from the catalog**), plus the
   **over-narrowing twin** (reviewer still reads titles). ⚠ **`supabase/tests/308_case_caps_s7.sql:291-303`
   states this obligation verbatim — *"That door's keystones MUST re-express all six pins"* — and
   ran green all phase while it was unmet.** Make that file unable to pass while unmet, or it lies again.
2. **MAJOR-2 — reconciliation is blind to `failed`/`abandoned` files holding bytes.** Its premise
   assumes those states carry no object; **this phase made that false** (BUG-DM2-001's fix binds a
   failed file; BUG-DM2-003's fix mints `abandoned`). `accounted.add` is unconditional, so they are
   not orphans either. Net: **undisposable PHI under a `RECONCILIATION CLEAN` banner.**
3. **MAJOR-3 — "Tentar novamente" can never succeed after a verification failure.** `consumed` →
   `failed` → TS re-verifies → `HC0D9` → same banner forever, **each loop an unaudited service-role
   download of the whole object.** Make retry work or stop offering it.
4. **ADR 0118 §10 — pin the load-bearing predicate.** The retention-exemption induction holds
   **because the sibling predicate is `disposal_state = 'none'`, not `<> 'disposed'`**. §10 credits
   "the evidence" generally; a later relaxation kills the invariant **while R6/R7 still pass**.
5. **`documents_wave_a` kill-switch keystone.** wave_a gates the **UI**, `documents_foundation` gates
   the **doors** — so wave_a alone is **not** a kill switch. "They flip together" is prose with
   nothing enforcing it.
6. **ADR 0118 §12** — record finding 2 above.
7. **Re-run the full §6 gate**: fresh reset · `test:db` · lint 5-gate · typecheck · vitest · the four
   arms · diff-scoped sweep over every changed body (case count **nonzero** before citing) ·
   **`e2e:prod`** · then QA **r2**.
8. **The 6 MINOR + 4 INFO** from the QA r1 review, not itemised here — read
   `docs/reviews/dm2-orchestration-wave-a-review.md` directly.

## Open with the PO (do not decide these for them)

- **MAJOR-1 / S1-O4 — interview-label bytes.** A document on a `legal_privileged` interview is
  visible and `open_document_version` returns **SERVED tier=phi**, even though `can_read_interview`
  is false and the interview yields 0 rows. **Parity is real** (the retired substrate behaved the
  same — verified in DM1's AMEND 3 chase), **but Wave A makes it live and nothing recorded that bytes
  follow.** Needs a ruling before any flag flips.
- **Plan Q1 — the two ethics seam columns still have no wave.** Blocks planning DM3, not DM2.
- **S1-O3** uploader visibility — deliberate non-decision in the ledger.

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
| S2.2 | Command-layer plan posted to the lead | 🕐 awaiting ack | this file + the lead thread |
| S2.3+ | Implementations (migrations `20260924000300`+, pgTAP, twins, arms) | 🔜 after ack | — |

## S2+ — (subsequent slices append here)

# Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — QA Review

**Reviewer:** qa · **Date:** 2026-08-04 · **Verdict:** ✅ **APPROVED**

**Scope:** ADR [0093](../decisions/0093-phase-16-standards-crosswalk-replan.md) (D1–D10 +
Amendments 1–3), plan [phase-16-standards-crosswalk-program.md](../plans/phase-16-standards-crosswalk-program.md).
9 migrations (`20260903000800`→`001600`), 6 pgTAP files (278, 279, 280, 281, 283, 284 — no 282,
correctly), 5 E2E specs (30/30 green as of `7409e41`). Branch `phase-16-standards-crosswalk`.

**Method.** Every schema/RLS/RPC/ACL claim below was re-derived from the **live local catalog**
(`pg_proc.prosrc` via `pg_get_functiondef`, `pg_policies`, `pg_constraint`, `proacl`,
`information_schema.role_table_grants`) through `docker exec` psql against the local Supabase
container — never from migration file text, per CLAUDE.md's graphify exception. I did **not**
perform a fresh `supabase db reset` (the stack was live and, per the session's own house rules,
shared with a concurrently-working `tester`) — see the one caveat under "Not verified" below. In
addition to reading, I ran the phase's own pgTAP files individually against the live DB and
performed **three independent live mutation tests** (function body swapped out, re-tested,
restored, and the restoration diffed byte-identical against a captured original) rather than
accepting the build reports' mutation-proof narrative at face value.

## Verdict rationale

No BLOCKER. No MAJOR. The headline claim — the noun rule actually landed on all four new
DEFINER doors — checks out against the catalog and against my own mutation tests, not just the
report's. Masking, arm parity, and the RLS/ACL shape on all five new tables are correct as built.
The two documented gaps (indicator-frequency test coverage; two acceptance claims proven by RPC
rather than UI) are real but are honestly disclosed, non-blocking, and match my own reading of the
code. The pt-BR bug that was still open at the start of this review (BUG-P16-005) closed correctly
during it, verified.

## Independent verification performed

### 1. The noun rule / D6 — re-derived from `pg_proc`, not accepted on report

| Door | `prosecdef` | Gate (from `prosrc`) | `is_admin()` anywhere in body | `PUBLIC`/`anon` in ACL |
|---|---|---|---|---|
| `readiness_report` | t | `not app.is_member_of(p_commission)` → `return` | **no** | no |
| `readiness_evidence` | t | `not app.is_member_of(p_commission)` → `return` | **no** | no |
| `hospital_readiness` | t | `not (is_hospital_admin_of(p_hospital) or is_org_admin_of(org_of_hospital(p_hospital)))` → `return` | **no** | no |
| `evidence_candidates` | t | `not app.is_staff_admin_of(p_commission)` → `raise 42501` | **no** | no |

All four ACLs are exactly `postgres=X,service_role=X,authenticated=X` — no `public`, no `anon`.
This matches D6 and the plan's precedent (`hospital_document_register`'s shape, minus its defect).

**Contrast checked live**: `hospital_document_register` and `hospital_indicator_rollup` (the two
doors named in BUG-AUTHZ-002) both still literally contain `app.is_admin() or …` as their gate's
first disjunct — confirmed by reading their `prosrc` directly. The four Phase-16 doors do not
share that shape. BUG-AUTHZ-002 is correctly filed as pre-existing/out of scope; I did not touch it.

One deliberate, correct exception found and verified as *not* a violation: `create_framework`,
`update_framework`, `set_framework_status`, `upsert_standard`, `delete_standard` DO gate global
(`owner_commission_id is null`) packs on `app.is_admin()`. This is D6's own carve-out — "platform_admin
keeps global pack CRUD only (vocabulary/catalog arm)" — and these doors touch no commission
content, only shared vocabulary rows. Confirmed the commission-owned branch of the same functions
gates on `is_staff_admin_of(owner)`, never `is_admin()`.

### 2. platform_admin zero-rows — mutation-proven myself, not accepted on report

Ran `supabase test db --local` against `supabase/tests/283_accreditation_readiness_report.sql`
on the live (not freshly reset) local DB: **PASS**, 20/20. Then, in place, edited
`public.readiness_report`'s live function body (`CREATE OR REPLACE`) to widen the gate to
`not (is_member_of(p_commission) or is_admin())` — i.e., reintroduced the literal BUG-AUTHZ-001
shape — and re-ran the same file:

```
# Failed test 3:  "A1. platform_admin gets ZERO rows from readiness_report (BUG-AUTHZ-001 shape, verified by mutation below)"
# Failed test 18: "E1. readiness_report's body carries NO is_admin() call (structural, comment-stripped)"
Result: FAIL (2 of 20)
```

Both the behavioral assertion (A1) and the structural comment-stripped `pg_proc` census (E1) went
red, and **only** those two — nothing else regressed, meaning the mutation was precise, not a
sledgehammer. Restored the original function via a captured `pg_get_functiondef` snapshot;
re-diffed the restored body byte-identical against the snapshot; re-ran the file: back to 20/20 (0
flag-state noise this time — see "Not verified" for what that noise is). This directly confirms
D6's "reader-non-writer keystone" claim for `readiness_report`, independent of the build report.

I did not repeat the identical mechanical exercise for `readiness_evidence` and `hospital_readiness`
(same pattern, same test-file structure) — I instead read `readiness_evidence`'s and
`hospital_readiness`'s live `prosrc` directly and confirmed the identical gate shape (no `is_admin`,
correct disjunct), which is a weaker form of verification for those two than the mutation I ran on
`readiness_report`. Flagged under "Not verified" below rather than silently treated as equivalent.

### 3. Two more keystones spot-checked by live mutation (the brief's other named priorities)

**`link_evidence`'s `can_read_case` gate** (guard order: flag → belongs → `can_read_case` →
`can_read_capa` → duplicate → insert). Ran `281_accreditation_evidence_assessment.sql` baseline:
31/37 pass (6 pre-existing failures, all in the flag-off §0 block — see "Not verified"; not
caused by me). Commented out the `can_read_case` `if` block in the live `link_evidence` body,
re-ran:

```
# Failed test 10: "B2. sa_x IS the coordinator (belongs=true) but is RECUSED from this case —
                    can_read_case denies, 42501, not a silent pass-through (verified)"
Result: 7 of 37 failed (the same 6, plus exactly this one)
```

Exactly one new failure — the targeted one. Restored, re-diffed byte-identical, re-ran: back to
31/37 (same 6 pre-existing). The fixture itself is worth noting as well-built: `sa_x` is CCIH's
own coordinator (so the `belongs` check alone would pass) but is `case_recusals`-recused from the
specific case, which is what makes B2 a real test of `can_read_case` and not a redundant re-test
of `belongs`.

**`hospital_readiness`'s worst-wins total order.** Read the live body: the ranking is a `CASE`
expression (`nao_conforme`→1, `parcial`→2, `conforme`→3, `order by … limit 1`). Ran
`284_accreditation_hospital_readiness.sql` baseline: 22/24 (2 pre-existing flag-state failures).
Swapped the `nao_conforme`/`parcial` priority integers (1↔2) in the live body, re-ran:

```
# Failed test 6:  "C1. nao_conforme beats parcial"
# Failed test 13: "D5. an abstention (comm_z3) does NOT collapse a REAL disagreement
                    (comm_x nao_conforme vs comm_y parcial) — worst-wins still applies
                    over the non-abstaining votes"
Result: 4 of 24 failed (the same 2, plus exactly these 2)
```

`C2` ("parcial beats conforme") stayed green, as it should — I didn't touch that comparison,
and the test suite correctly didn't conflate the two pairwise comparisons. Restored, re-diffed
byte-identical, re-ran: back to 22/24. This confirms the total order is genuinely encoded in the
function, not merely asserted to be, and that the pgTAP suite would catch a swap.

**Net: 3 for 3.** Every keystone I picked reds precisely on revert and nothing else. I have no
basis to doubt the report's other mutation-proof claims (readiness_evidence/hospital_readiness's
own A2/G1 keystones, K1–K7 in 279, etc.) but I did not re-run all of them myself — see "Not
verified."

### 4. D8 — masking and counts-only, verified from SELECT lists in `prosrc`, not from TSX

- `readiness_evidence`: `case when l.is_restricted then 'Evidência restrita' else
  app.evidence_label_of(...) end` for the label, and `case when l.is_restricted then null else
  l.note end` for the note — both driven by `is_restricted := (kind in ('case','ethics_procedure')
  and not app.can_read_case(artifact_id, uid))`, i.e. a genuine per-row ACL check, not a
  commission-membership shortcut.
- `readiness_report`: SELECT list is `id, code, title, level, assessment_status, evidence_valida,
  evidence_atencao, evidence_vencida, evidence_restrita` — **no `note` column at all**, counts
  only. Same for `hospital_readiness`'s SELECT list (plus `resolution` and
  `responsible_commission_id`) — no note anywhere.
- `get_standard_assessment` (the BUG-P16-001 read path) does return `note_md`, but it is gated
  `is_member_of` and scoped to the **caller's own commission's** assessment row — this is the
  commission tier, which D8 does not restrict; it only restricts the hospital tier and export
  surfaces, both of which I confirmed carry no note field.
- Grepped `src/components/accreditation/hospital-readiness-register.tsx`: only a doc-comment
  reference to `note`/`note_md`, no rendering of either — confirms the frontend doesn't
  reintroduce what the door already omits.
- PHI-discouragement copy present verbatim on both free-text fields: `assessment-form.tsx:114`
  and `evidence-picker.tsx:179` ("Não inclua nome, prontuário ou outros dados do paciente...").

### 5. Arm parity — `evidence_links_artifact_kind_check` vs. the two dispatch functions

Live CHECK (`pg_get_constraintdef`): exactly 10 values — `form, form_version, meeting, case,
indicator, controlled_document, action_item, capa_plan, charter, ethics_procedure`. Confirmed
`src/lib/accreditation/types.ts`'s `ArtifactKind` union matches these 10 exactly, no drift.

Read both `app.artifact_belongs_to_commission` and `app.evidence_status_of` in full: both have
exactly 10 `when` arms matching the CHECK, both `else raise exception` (fail closed on an
unrecognized kind — not a silent `false`). `artifact_belongs_to_commission`'s column-lookup arms
(`form`, `form_version`, `meeting`, `case`, `indicator`, `controlled_document`, `action_item`) are
all wrapped `coalesce(v_owner = p_commission, false)` — the fail-open trap (`null = uuid` → `null`,
`if not (null)` is falsy in plpgsql, silently skipping the guard) that PROGRESS.md flags as caught
at design time is genuinely absent from the live body, on every arm that needed it.

Confirmed pgTAP 279's arm-parity assertions (A1/A2) derive the kind list from
`pg_get_constraintdef` via `regexp_matches(..., '''([a-z_]+)''', 'g')` **at test-run time** — not
a hardcoded literal list in the test file — matching the claim that a future kind added to the
CHECK without a matching dispatch arm reds on its own. Ran `279_accreditation_dispatch.sql`: PASS,
0 failures (this file has no flag-off §0 block, so no state noise).

Also confirmed the A1·1 (Amendment 1) capa_plan ruling live: `artifact_belongs_to_commission`'s
`capa_plan` arm is hospital-match only (`cp.hospital_id = app.hospital_of_commission(p_commission)`),
with a comment correctly noting the `can_read_capa` half lives in `link_evidence`, not here — and I
independently confirmed `link_evidence`'s body does call `app.can_read_capa` as a separate,
subsequent guard.

### 6. `prosecdef` census beside `pg_policies`, for the five new tables and every new function

RLS census (`pg_class.relrowsecurity` + `pg_policies`) on `accreditation_frameworks`,
`accreditation_standards`, `evidence_links`, `standard_assessments`, `standard_ownerships`: all
five `relrowsecurity = t`; **exactly one policy per table, all `cmd = SELECT`** — no `FOR ALL`
write-shaped policy anywhere (the specific leak shape flagged in this project's own house rules as
"a FOR ALL policy IS a read policy"). Grant census
(`information_schema.role_table_grants`): `authenticated` has **SELECT only** on all five; no
`anon`/`public` row on any of them; no INSERT/UPDATE/DELETE grant to `authenticated` on any of
them — matches "all writes DEFINER."

Function census: all 15 new `public.*` doors (`create_framework` … `unlink_evidence`,
`readiness_report`, `readiness_evidence`, `hospital_readiness`, `get_standard_assessment`,
`evidence_candidates`) are `prosecdef = t` with correctly scoped ACLs (no `public`/`anon`). The
`app.*` helper functions this phase added (`artifact_belongs_to_commission`, `evidence_status_of`,
`evidence_label_of`, `org_of_hospital`) are `prosecdef = t` with a **blank `proacl`** — Postgres's
default for functions grants `EXECUTE` to `PUBLIC` unless explicitly revoked, so in isolation these
would be directly callable by any authenticated (or even anonymous DB) role. I checked
`supabase/config.toml`: `schemas = ["public", "graphql_public"]` — the `app` schema is **not**
exposed to PostgREST, so none of these are reachable through the API surface end users actually
use. This is the same shape as the rest of the `app` schema platform-wide (this session's own
notes record 130/281 `app` DEFINER functions carrying `PUBLIC` execute as a pre-existing,
already-tracked platform pattern, not something Phase 16 introduced) — I am not raising it as a
Phase-16 finding, only recording that I checked it rather than assuming it away.

`assert_accreditation_enabled` is `prosecdef = f` (INVOKER) — correct, and not a gap: every caller
is itself a `SECURITY DEFINER` function, so its effective privileges when it runs are the
DEFINER's, not the original caller's.

`set_standard_ownership` (D7): confirmed live it gates on `app.is_hospital_admin_of(p_hospital)`
only — no `is_org_admin_of` arm — matching "hospital_admin write, org_admin write rejected."

## Known-open items — assessed, not re-discovered

- **Migration F (ONA/JCI seed packs) not built.** Confirmed: no migration file introduces
  `accreditation_frameworks` data, and a live `select * from accreditation_frameworks` currently
  returns 0 rows. This is a PO-parked, honestly-justified deferral (backend gave two explicit "I
  don't know" answers rather than inventing an ONA citation scheme) and nothing else in the phase
  depends on it — every E2E spec builds its own framework/standard fixtures. **I agree this does
  not block APPROVAL.** It blocks nothing structural; it is a content-authoring task for a future
  PO-validated migration, not an engineering gap in this phase's own deliverables.
- **Migration G (flag flip) not applied — correct, belongs at Record.** Confirmed the schema
  migration (`20260903000800`) seeds `accreditation` with an **explicit** `enabled = false` (via
  `on conflict do nothing`), matching Amendment 2's note that the column defaults `true` and would
  otherwise ship on by accident. The live DB currently shows `enabled = true` — this is **runtime
  test-harness state**, not a committed artifact: no `enable_accreditation`-style migration exists
  in the 9-migration set, and every pgTAP file I ran independently re-asserts the flag-off natural
  default in its own §0 block before flipping it in-transaction. I'm noting this explicitly because
  it is exactly the kind of "text vs. value" trap this project's rules warn about — the *migration
  text* says OFF and is correct; the *live value* says ON because of prior manual/E2E testing, and
  that's fine as long as nobody mistakes it for the seeded state. Recommend a fresh
  `supabase db reset` before the Record step so the committed artifact and the live value agree
  again before Migration G lands intentionally.
- **BUG-P16-005 — closed correctly during this review.** Was still open (frontend mid-fix) when I
  started; by the time I reached it, `aad4877` (product fix, PO-ruled verb/noun agreement) and
  `7409e41` (tester's spec update to exact-literal assertions, replacing the deliberately-tolerant
  regex) were both committed. I read both changed files:
  - `readiness-dashboard.tsx`'s `LevelCard` now reads `{clean} de {total} {padrão|padrões}
    {está conforme|estão conformes} (não cumulativo)` — noun keyed on `totalStandards`, verb+adjective
    keyed on `cleanStandards`. This is grammatically sound pt-BR and resolves the agreement
    ambiguity the original bug report had explicitly declined to guess at.
  - `evidence-count-badge.tsx` — the sibling bug frontend's own sweep found (`${word}s` on
    "atenção" producing "atençãos") — now uses literal singular/plural pairs for all four segments,
    not suffix concatenation.
  - `e2e/phase16-accreditation-core.spec.ts` AC-1's two assertions now match the exact rendered
    strings (`'1 de 2 padrões está conforme (não cumulativo)'`,
    `'0 de 0 padrões estão conformes (não cumulativo)'`) with `{ exact: true }`, replacing the
    `/^1 de 2 padr\S+ conforme…$/` tolerant pattern.
  No outstanding action. See the coordinator's specific question, answered below.
- **BUG-AUTHZ-002, FUP-P16-1, FUP-P16-2, FUP-P16-3** — read all four PROGRESS.md entries in full
  and cross-checked the two I could check cheaply (BUG-AUTHZ-002's gate text; FUP-P16-2's claim
  that `getStandardAssessmentDetail`/`searchEvidenceCandidates` currently live in `actions.ts`,
  confirmed by grep). All four are accurately recorded as pre-existing or intentionally deferred,
  correctly kept out of Phase 16's migrations, and I made no changes to any of them.

## Gaps flagged in the brief — verified, and my own rating

- **No pgTAP 282; confirmed absorbed into 279, nothing lost.** 279 has 61 assertions (`plan(37)` —
  wait, no: I ran 279 directly and it reported its own plan count on PASS; separately verified the
  file's own header inventories C1…C30 covering all 10 kinds, both `review_due_date = current_date`
  boundaries, and the frequency cutoff). I did not attempt to reconstruct 282's originally-planned
  scope from scratch to prove a negative; I relied on reading 279 end-to-end and confirming its
  §-by-§ coverage matches what 282 was supposed to cover per the plan doc. This matches the report.
- **Indicator freshness: only `mensal` is asserted (C14/C16); the other four frequencies are
  implemented but untested.** Confirmed by reading `app.evidence_status_of`'s `indicator` arm: the
  `case v_freq when 'mensal' … when 'bimestral' then interval '2 months' … when 'anual' then
  interval '12 months' end` is present and, on inspection, correct (1/2/3/6/12 months for
  mensal/bimestral/trimestral/semestral/anual respectively — I checked the arithmetic by hand
  against the D5 spec). Grepped `279_accreditation_dispatch.sql` for the other four frequency
  words: they appear only in comments/fixture prose, never in an assertion. **Rating: MINOR — a
  real test-coverage gap, not a live defect** (the code I read is correct today); a future edit to
  this `case` expression could silently regress a non-`mensal` cell with nothing in the suite to
  catch it. Recommend closing before Migration F seeds ONA (which is per-level but not
  frequency-specific, so this could ship independently) or at latest before any commission actually
  configures a non-mensal indicator as evidence in production.
- **BUG-P16-005's tolerant regex — see above, already tightened, no longer a gap.**
- **Two acceptance claims are RPC-only, not UI-proven.** Read both specs:
  `phase16-accreditation-restricted.spec.ts` AC-2 calls `readiness_evidence` directly (via a
  service-role/RPC helper, not page navigation) as `staff2.ccih` and asserts `label === 'Evidência
  restrita'` and `note === null`; AC-4 does the same for all three doors as `platform@test.local`.
  `phase16-accreditation-clone.spec.ts`'s HC0QD assertion is similarly RPC-only. Both gaps are
  real and both are honestly why: no seeded persona is staff_admin-of-CCIH **and** off the seeded
  ethics case's ACL simultaneously, and framework/standard CRUD has no wired UI this phase (D-block
  scope was the RPC surface + the read-only tree/dashboard, not a framework editor). **I agree
  neither is a gate blocker** — the RPC probes exercise the actual authorization surface
  (`readiness_evidence`'s gate is `is_member_of`, independent of which UI route reaches it), and a
  UI-only gap here would be a UX/coverage nice-to-have, not a security hole. The tester's own
  observation that "a seed roster that cannot express a required negative is a real gap" is
  correct and belongs in a future seed revision, not this phase's punch list.

## Answering the coordinator's specific questions

**Exact-text vs. tolerant assertions for BUG-P16-005.** I'd keep exact-text, for the reason
`7409e41`'s own commit message gives: the wording is now PO-ratified and stable, and a tolerant
matcher's whole value was to avoid encoding a *known-wrong* string while the correct one was still
being decided — that condition no longer holds. This phase produced two independent instances of
the identical defect class (`-ão`→`-ões`) invisible to lint/typecheck/vitest; the E2E text
assertion is the only thing in the whole test pyramid that can see a grammar regression here, so
loosening it back down would remove the one guard that actually works. I checked that the exact
strings asserted match the live component output character-for-character (read both files myself,
not just the diff) — no mismatch.

**Is the literal-pairs fix sufficient, or does a shared pt-BR pluralizer pay for itself?** The
literal-pairs fix is sufficient for what exists today — I read both call sites and neither has a
latent instance left. But I'd rate a shared helper as worth doing, not just worth flagging: the
same `-ão→-ões` irregularity is not scoped to this component; pt-BR has three irregular `-ão`
plural patterns generally (`-ões`/`-ães`/`-ãos`), and the fact that this exact class landed twice
independently *within one phase*, in two different files, each requiring a human/agent to notice
by inspection rather than by any tool, suggests the failure mode is systemic to "any pt-BR noun
ending in -ão anywhere in this codebase," not local to accreditation. A small
`pluralizeIrregular(word, count, {plural})`-shaped helper (or even just a curated
`IRREGULAR_PLURALS` map covering the handful of `-ão` words this domain actually uses — padrão,
atenção, and whatever else the grep in `7409e41`'s commit message already ruled out for *this*
sweep) would turn "sweep the file for the same pattern" from a manual, easy-to-skip step into a
single call site. **This is MINOR/INFO, not a blocker** — I'm not withholding APPROVED on it — but
if a third instance shows up in a later phase, I'd escalate the recommendation from "worth doing"
to "should have been done already."

## Not verified (say so rather than pad the report)

- **No fresh `supabase db reset` was performed.** All pgTAP runs above were against the live,
  already-mutated local DB (migrations 252/252 registered==files, confirmed) rather than a clean
  reset. The only failures this produced across all 6 files I ran (278, 279, 280, 281, 283, 284)
  were the flag-natural-default assertions in each file's own §0 block (the flag is currently
  `enabled = true` at runtime from prior manual/E2E testing, not from any committed migration) —
  every substantive assertion in every file passed. I do not believe this affects the verdict, but
  I did not independently confirm the full suite is green on a **fresh** reset the way the Phase
  Gate itself requires (`npm run test:db` is specified to run post-reset). Recommend the lead do
  one fresh-reset `npm run test:db` pass before Record, both to confirm this and to put the flag
  back to its seeded-off state before Migration G lands.
- **`readiness_evidence` and `hospital_readiness`'s own platform_admin-zero-rows keystones (A2,
  G1) were not independently mutation-tested by me** — I verified their gate shape by reading
  `prosrc` (matches D6) and ran their pgTAP files clean, but I only *personally* reverted the guard
  and watched it fail-red for `readiness_report`. I have no reason to doubt the other two given the
  identical code shape and an independently-clean pgTAP run, but I did not perform the same
  red/green cycle on them myself, so I'm not claiming I did.
- **No full `npm run e2e:prod` gate run for Phase 16 specifically appears in PROGRESS.md.** The
  Test Run Summary documents the 5 phase16 specs run in isolation (30/30) plus various *other*
  specs' scoped/full runs from the FF-4 era and an ad-hoc batch. I did not run the full suite
  myself (out of scope for QA per CLAUDE.md, and a 18–40 min job the lead runs in the background
  per this session's own conventions). This is a Phase Gate step 2 concern, not something I can
  discharge from the QA seat — flagging it so the lead does not read this review as having
  covered it.
- **I did not attempt to construct the "editing a global pack fails HC0QD" or "restricted evidence"
  scenarios through the actual UI** myself (no wired CRUD UI exists for the former; no persona
  exists for the latter, as documented above) — I verified the RPC-level behavior directly instead
  (reading `update_framework`'s live body for the HC0QD branch, and `readiness_evidence`'s
  `is_restricted` computation for the masking branch), which is the same substitution the tester
  made and for the same reason.

## Requirements / acceptance-criteria audit (ADR 0093 D1–D10 + Amendments)

Went through the ADR's Decisions list item by item against the as-built catalog + code:

- D1 (sequencing) — administrative, not a code claim; N/A to this audit.
- D2 (skeleton-only packs, `clone_framework`) — Migration F correctly not built (skeleton-only is
  moot until it exists); `clone_framework` exists (`prosecdef=t`, gated `is_staff_admin_of`),
  confirmed via `pg_proc` listing above.
- D3 (ONA level) — `accreditation_standards.level smallint` confirmed present; `readiness_report`
  and `hospital_readiness` both SELECT `s.level`, and `rollups.ts` (read, not re-derived — Vitest
  already covers the cumulative-gating boundary per PROGRESS.md, and I have no reason to doubt a
  22-test suite covering exactly the boundary the ADR calls out) does the per-level cumulative
  gating client-side per the "rollup math split" design.
- D4 (evidence enum) — 10-kind CHECK confirmed exactly matches D4's "eight + charter +
  ethics_procedure"; both dispatch functions have a matching arm each; A1·1's capa_plan hospital-match
  ruling confirmed live.
- D5 (freshness matrix) — confirmed all documented buckets in `evidence_status_of`, including the
  three PO amendments (A2·3 `changes_requested`→vencida, A3·1 capa_plan `open`→atencao split from
  `cancelled`, A3·2 meeting `held`/`in_signature`→atencao, A3·3 action_item `open`/`blocked`→atencao)
  — every one present in the live body exactly as ruled, not as originally drafted.
- D6 (noun rule) — see §1/§2 above, independently mutation-verified for one door, catalog-verified
  for all four.
- D7 (worst-wins + ownership) — see §3/§6 above, independently mutation-verified.
- D8 (masking/counts-only) — see §4 above, verified from SELECT lists, not TSX.
- D9 (edition remapping) — explicitly "designed, not built" per the ADR; nothing to verify, nothing
  built that contradicts it.
- D10/Amendment 2 (mechanics) — SQLSTATE ledger (HC0Q9–HC0QE) confirmed fully mapped in
  `messages.ts`; framework RLS narrowing (A1·2) confirmed via the live `accreditation_frameworks`
  policy predicate (`owner_commission_id is null or is_member_of(owner_commission_id)` — global
  readable to all authenticated, commission-owned scoped to members, matching A1·2's rationale
  about licensed cloned text not leaking cross-tenant).

## Files most load-bearing to this review

- `supabase/migrations/20260903000800_accreditation_schema.sql`,
  `…000900_accreditation_dispatch.sql`, `…001200_accreditation_framework_crud.sql`,
  `…001300_accreditation_evidence_assessment.sql`, `…001600_accreditation_readiness_doors.sql` —
  read via live `pg_get_functiondef`/`pg_get_constraintdef`, not the files themselves, per the
  binding graphify/catalog exception.
- `supabase/tests/{278,279,280,281,283,284}_accreditation_*.sql` — run directly against the local
  DB; 281/283/284 additionally used as the harness for my three live mutation tests.
- `src/lib/accreditation/types.ts`, `src/lib/accreditation/messages.ts` — read for
  `ArtifactKind`/SQLSTATE-mapping drift checks.
- `src/components/accreditation/readiness-dashboard.tsx`,
  `src/components/accreditation/evidence-count-badge.tsx`,
  `src/components/accreditation/hospital-readiness-register.tsx`,
  `src/components/accreditation/assessment-form.tsx`,
  `src/components/accreditation/evidence-picker.tsx` — read for BUG-P16-005 closure and D8
  frontend compliance.
- `e2e/phase16-accreditation-{core,restricted,clone}.spec.ts` — read (not re-run in full) to verify
  the RPC-only acceptance claims and the BUG-P16-005 spec fix.
- `PROGRESS.md` (Phase 16 section, Bug Log, Follow-ups, QA Verdicts) — read in full for the
  requirements/status audit.

## Verdict

✅ **APPROVED.** No BLOCKER, no MAJOR. Two MINOR items (indicator-frequency test coverage; the
un-reset pgTAP run this review itself relied on) and one INFO recommendation (a shared pt-BR
pluralization helper) — none of them gate this phase. Recommend the lead run one fresh-reset
`npm run test:db` + the full `npm run e2e:prod` before Record, per the "Not verified" section
above, since neither was independently confirmed by this review.

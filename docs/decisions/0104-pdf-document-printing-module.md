# 0104 — PDF document printing module: record-semantics minting, single registry, template pipeline, QR verification

> Renumbered 0101 → 0104 at the QO·FUP merge (2026-08-07): 0101 had been minted in parallel on
> `feat/quality-office-oversight` for the role-landing guard, whose number is cited in code, tests
> and reviews. This ADR was the cheaper rename (2 files). The two `docs(adr)`/`docs(plans)` commit
> messages naming "ADR 0101" for this module predate the rename and cannot be amended.

**Date:** 2026-08-07 · **Status:** 🟢 **ACCEPTED (design)** — ratified with the PO in a
15-question interview, 2026-08-07; **implementation NOT started; no migration authored.**
**Owner:** platform lead → `backend` / `frontend` at execution.
**Branch:** `pdf-module-adr`.

**Relates:** ADR 0030/0035/0037/0038 (PHI posture — Rule 12; this module adds ZERO new
PHI authorization surface) · 0059 (Coolify deploy — the renderer is a second resource on
the same host) · 0078/0079 (door discipline: every access here delegates to an existing
domain door; the registry RLS function is itself a door and binds to the ARM gates) ·
0085 (case corrections — the reason superseded/void states exist) · 0099 (MIN — the
sidecar precedent this module deliberately does NOT copy on async).

## Context

Hospitals adopting the platform still need **complete physical documentation**: a filled
form, a case file, a meeting ata, an interview record must exist on paper with the same
credibility the platform gives them on screen — watermarks, signatures, and a way for a
reader holding paper (an ONA/JCI auditor, a lawyer) to verify authenticity and currency.
Today the platform has no print path at all; every `pdf` reference in `src/` is upload
MIME validation.

Rendering uses Chromium (full HTML/CSS fidelity is required for clinical-grade
documents), which must not live inside the Next.js container: its memory profile is
spiky and a cgroup OOM would kill the web platform, and it adds ~300–400 MB plus a CVE
patch cadence to every app deploy.

## Decision

### D1 — A generated PDF is a RECORD, not a view

Generating a PDF **mints a document**: bytes stored in Storage under RLS, immutable
(Rule 6), with identity, mint timestamp, actor, template key+version, and content hash.
Re-downloading serves the same canonical bytes; re-generating mints a new record. The
PDF **is** the snapshot — no separate snapshot mechanism exists (the PO's open question,
resolved). A QR code on an ephemeral view would verify nothing; record-semantics is what
makes verification, supersession, and audit meaningful.

### D2 — Bytes only; the source payload is NOT persisted

The mint stores the PDF bytes + metadata, **never the payload JSON** that fed the
template. A stored payload would be a fourth PHI store outside the three Rule 12
modules, created for a debugging convenience. Consequence accepted: faithfulness is
process-based (audited mint pipeline + hash at mint time), not replay-based — we cannot
mechanically re-prove "this PDF matches its data" after the fact. Re-issuing under a
newer template re-mints from **live** data (a new, honestly-dated record), never from
replayed JSON.

### D3 — One generic registry: `printed_documents`

Single table with a polymorphic source reference (`source_kind` enum:
`form_response | case | meeting | interview` + `source_id`), template key+version,
content hash, storage path, `contains_phi`, status, verification token, actor,
timestamps. Two hard qualifiers:

1. **Zero PHI in registry columns** — no titles, no free text; only the pointer and
   metadata. Only the storage *object* is PHI-bearing.
2. **RLS is a per-kind delegation function** — `can_view_printed_document(source_kind,
   source_id)` dispatches to each domain's existing visibility door. An unhandled kind
   returns **false** (fails closed): a new printable kind that forgets its arm is
   unreadable, not exposed. This function is a door and binds to the ADR 0079 ARM gates.

Known cost, accepted: the polymorphic FK is not a real FK (integrity by trigger or
discipline; no PostgREST embed traversal). Rejected: per-domain registry tables — four
drifting pipelines.

### D4 — Templates are CODE, versioned by constant

Each template is a module in `src/lib/pdf/documents/` building an HTML string from a
typed payload. Versioning = an explicit version constant per template, bumped on
visual/structural change, recorded in the registry at mint, reported by verification.
Guard against silent staleness: a unit test snapshots each template's structural
fingerprint and fails when the template changes without a version bump.

Per-hospital branding (name, logo, address) enters as **data in the payload**
(a `letterhead` block), never as template code. Rejected for v1: DB-stored,
tenant-editable templates — that is a layout-editor product with a stored-XSS surface
aimed at Chromium rendering PHI (Rule 7's nightmare case). The registry schema is
agnostic (`template_key + template_version`), so DB templates remain possible later
without migration.

### D5 — Minting is SYNCHRONOUS with bounded concurrency

One server action: assemble payload → render via sidecar → upload to Storage → insert
registry row. ~1–4 s; the user waits. "Queueing" = a concurrency limiter (semaphore,
~3 concurrent mints, Gotenberg's internal queue behind it, hard timeout ~30 s), not a
job pipeline. **On timeout nothing is minted** — no registry row, no orphan bytes; mint
is all-or-nothing.

Rejected for v1: the MIN-style async job apparatus (job table, worker, HMAC callbacks) —
justified there by minutes-long transcription, unjustified for a 2-second render, and
its seam-bug tax is documented. Explicit trigger for revisiting: an unbounded printable
(bulk export — "all responses of this version as one PDF"). That lands additively as a
`document_jobs` table referencing this registry; no redesign.

### D6 — Post-mint lifecycle: `active → superseded | revoked`

- **Superseded** — automatic: re-minting the same `(source_kind, source_id,
  template_key)` marks prior mints superseded inside the mint transaction. The registry
  always knows the current print.
- **Revoked** — manual, rare, `staff_admin`+ only, mandatory reason, audited. For
  minted-from-wrong-data cases (the ADR 0085 class).
- Neither state deletes anything; bytes and rows are permanent. States change only what
  verification reports and what the download overlay stamps (D8).
- Verification wording for superseded: "a newer print of this document exists" — it must
  NOT imply the paper is wrong (supersession is print-recency, not data-correctness).

### D7 — Watermarks are DERIVED-ONLY; four marks

No free text, no user-composed stamps. The data provider computes flags; one shared
template primitive renders them:

| Mark (printed pt-BR) | Enum | Derivation |
| --- | --- | --- |
| `RASCUNHO` | `draft` | Source not in final state at mint (in_progress response, unapproved minutes, unsigned interview). |
| `FINAL` | `final` | Source in final state at mint. **Every document declares its state** — an unwatermarked page is evidence of tampering, not the normal case. |
| `SUBSTITUÍDO` | `superseded` | Download-time overlay only (D8). |
| `ANULADO` | `void` | Download-time overlay only (D8). |
| Confidentiality band `DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE` | — | Automatic whenever `contains_phi`; header/footer band; **not suppressible**. |

Rejected for v1: `VIA NÃO CONTROLADA` (QR + emission footer carry that duty) and
tenant-custom stamps (free text by another name; needs its own governance).

### D8 — Status watermarks via download-time OVERLAY

Stored bytes are immutable and hash-pinned, so `SUBSTITUÍDO`/`ANULADO` cannot be baked.
Downloads go through a serving route (never a bare signed Storage URL) that checks
status and, for non-active documents, lays a deterministic, minimal watermark over the
canonical bytes on the fly (pdf-lib stamp — no Chromium). This closes the real hole:
re-downloading an old PDF and printing it fresh, bypassing the QR entirely.

**Verification semantics stated once:** the registry hash pins the *canonical mint
bytes*; overlaid copies are derived and will not hash-match. Paper already printed is
reached only by the QR (ink does not update).

### D9 — PHI inclusion: per-mint, default OFF, existing doors only

1. **Per-mint, explicit, default de-identified.** No global setting, no memory of the
   choice — including PHI on paper is a deliberate act each time.
2. **The gate is the source domain's existing PHI door** (`app.can_read_case_patient`
   and siblings), never a new one. Cannot see the PHI on screen → PHI mint fails
   closed. **This module adds zero new PHI authorization surface** — the ADR's most
   load-bearing sentence.
3. **A PHI mint is a PHI read**: the Rule 11 PHI-access row is emitted by the domain's
   own audited reader; the registry additionally records `contains_phi = true`
   (drives the band and verification wording).
4. **Storage bifurcation**: PHI PDFs under `documents/phi/…`, others under
   `documents/std/…` — two dumb policies, not one conditional one.

**v1 scope:** PHI variants exist only where the domain lawfully holds PHI — Cases and
Interviews (case-scoped). Forms and Meetings mint PHI-free only; the option does not
render. **v2 readiness (PO directive):** PHI for Meetings/Interviews expansions cost no
schema or pipeline change — activation = the kind's data provider registering a PHI arm.
Prerequisite named explicitly: the PDF module can only print PHI a domain already
lawfully holds; a PHI-bearing ata first requires the *meetings domain* to gain a
Rule 12-classed PHI surface via its own ADR. That decision is upstream of this module.

### D10 — QR verification: dedicated token, anemic public answer

The QR encodes `/verificar/<token>` where the token is a dedicated random verification
credential minted alongside the row — **not** the registry id (the paper never carries a
registry key; the token is single-purpose and independently revocable). Human-readable
short code beside the QR as damage fallback.

Unauthenticated response, deliberately anemic: authentic yes/no · status · mint date ·
document kind · hospital name. **Never**: patient anything, case numbers, actor names,
or bytes. No anonymous download. An authenticated user with source visibility proceeds
to the normal audited download path. Lookups rate-limited and minimally logged (kind +
token + timestamp — it is an unauthenticated surface; it must not become a tracker).

### D11 — Authorization matrix

Principle: **the module never grants sight of anything; it inherits every right from
the source domain and adds rights only over its own artifacts.**

| Action | Rule |
| --- | --- |
| Mint (non-PHI) | Anyone who can view the source artifact. Not admin-gated — that is what the audit trail is for. |
| Mint (PHI) | Additionally the domain PHI door (D9). |
| Download | Same predicate, **evaluated at download time** — lose source access, lose its PDFs, including self-minted ones. Minting is not a permanent self-grant (the side-door class the authz history keeps finding). Physics caveat accepted: paper already printed stays printed. |
| Revoke | `staff_admin` of the owning commission (+ admin chain per existing patterns), mandatory reason. Not the minter — revocation is a governance act, not undo. |
| `platform_admin` | **May not mint, download, or revoke** — printed documents are commission content in its most portable form (ADR 0078 noun rule). Census-style aggregate counts at most. |

### D12 — Audit ledger (Rule 11, no parallel log)

| Event | Records |
| --- | --- |
| `document.minted` | registry id, source kind+id, template key+version, `contains_phi`, hash, actor. PHI mints: the domain PHI-read row is emitted separately by the domain door — two rows, two concerns. |
| `document.downloaded` | registry id, actor, overlay-applied flag. Every re-serve — a download of another member's document is precisely Rule 11's read-of-another's-data. |
| `document.revoked` | registry id, actor, reason class + free text. |
| supersession | No dedicated row — mechanical side-effect, reconstructable from mint rows. |
| verification scans | **Not in `audit_log`** — separate minimal rate-limit log; anonymous internet noise stays out of the hash-chained ledger. |

Rows record *that* and *who*, never content.

### D13 — Signatures render as ATTESTATION BLOCKS

1. Shared primitive: *"Assinado eletronicamente por [name], [title] — [date/time]"* —
   per-section for forms, footer block for atas. No cursive fonts, no images, no
   synthesized signature look (a printed imitation of a wet signature misrepresents its
   legal nature).
2. Caption states the basis honestly: *"Assinatura eletrônica registrada na
   plataforma"* — these are platform signoffs, **not ICP-Brasil qualified signatures**;
   overclaiming is worse than modesty. ICP-Brasil, if ever, is a new `method` enum
   value in the same block model.
3. Data provider supplies `signatures: SignatureAttestation[]` (name, title, scope,
   timestamp, method = `platform_signoff`). Templates render what they are given;
   sections expecting signoff render "— não assinado —" when absent, composing with
   `RASCUNHO`.
4. Completeness does not gate minting — FINAL/RASCUNHO already encodes it (a
   `submitted` response cannot lack required signoffs; Rule 3/4).

### D14 — Renderer: pinned Gotenberg sidecar, same host, private network

Off-the-shelf **Gotenberg** container as its own Coolify resource on the same host:
memory/CPU-capped (a render OOM kills the renderer cgroup, never the web app),
**no public domain, private Docker network only** (the HTML it receives IS the PHI),
request timeout matching the 30 s mint budget. Image version **pinned**; an upgrade is
a deliberate template-regression-test event (rendering may shift; acceptable — the hash
pins mint-time bytes and we never re-render for verification). Fonts (IBM Plex) ship
embedded in our HTML, keeping the renderer fully generic. Rejected: owning a
Node+Playwright container — Chromium CVE cadence and sandbox/zombie plumbing are
undifferentiated risk work.

`src/lib/pdf/` therefore stays **pure**: typed payload → HTML string, unit-testable
with no browser, no network, no Supabase. Enforced mechanically (an ESLint
`no-restricted-imports` override on `src/lib/pdf/**` banning `@/lib/supabase`,
`@/lib/queries`, `server-only`) — a convention in prose is the class of claim that goes
stale silently.

### D15 — Names, flag, retention, rollout

- **Layout:** `src/lib/pdf/` (types, primitives, `documents/<kind>.ts`) ·
  `src/lib/<domain>/pdf-payload.ts` data providers (RLS, Rule 9 queries, Rule 11 audit
  live HERE, in the domain) · `src/components/pdf/` · `src/app/api/documents/` (serving
  route) · `src/app/(public)/verificar/` (QR page).
- **Table:** `printed_documents` + `printed_document_status` enum; verification token a
  column, not a second table.
- **Flag:** `document_printing`, ships **OFF**, platform-wide; kinds activate by
  registering a data provider (no flag proliferation).
- **Retention:** minted PDFs are **never deleted** — they inherit the 20-year CFM
  posture of their sources; no admin delete surface exists in v1; no storage lifecycle
  rules.
- **Sidecar env:** `PDF_RENDERER_URL` only. Gotenberg runs unauthenticated *inside* the
  private network; if deploy topology cannot guarantee privacy, basic-auth is added at
  deploy time (not an ADR concern).
- **Rollout order (intent, one phase-gated PR each, not four approvals):**
  1. **Forms** — PHI-free yet exercises every stage (sections, signoffs, watermarks,
     QR, audit, overlay): the skeleton hardens with zero PHI exposure.
  2. **Meetings** — multi-signature footer; proves "new kind = provider + template".
  3. **Cases** — the PHI delta (variant fork, door delegation, storage bifurcation,
     band) lands on a proven pipeline, so PHI review scrutinizes only the delta.
  4. **Interviews** — reuses the case PHI arm; smallest marginal work.

## Alternatives rejected (summary)

View-semantics / ephemeral PDFs (verifies nothing) · persisted payload JSON (fourth PHI
store) · per-domain registries (drift) · DB-stored tenant templates (layout editor +
stored-XSS at Chromium) · async job pipeline v1 (MIN's seam tax for a 2 s render) ·
full document-control lifecycle (the controlled-document module's territory) ·
registry-id-in-QR (registry key on paper) · minter-keeps-access (permanent self-grant
side-door) · own Playwright container (Chromium patch burden) · in-process rendering
(OOM blast radius, image weight).

## Consequences

- A second Coolify resource to operate (pinned Gotenberg, capped, private).
- The serving route is mandatory indirection for ALL downloads — bare signed Storage
  URLs for `printed_documents` objects are a defect class from day one.
- `can_view_printed_document` is a new door: it enters the ARM census immediately and
  the diff-scoped door sweep in every phase that touches it (ADR 0079).
- Verification is a new **unauthenticated** public surface (`/verificar`) — rate
  limiting and the anemic-response rule are load-bearing, not polish.
- Template version constants are load-bearing metadata; the fingerprint test is the
  gate that keeps them honest.
- Bulk export, tenant stamps, ICP-Brasil signatures, DB templates, and Meetings-PHI are
  all explicitly deferred with their doors left open (D5, D7, D13, D4, D9).

## Amendments (P1 build, 2026-08-07 — lead-ratified at implementation)

- **A1 (amends D10/D5):** verification token + short code are generated by the mint
  **action pre-render** (the QR/short code live in the canonical bytes, so they must
  exist before Gotenberg runs); the mint door receives them as params and validates
  format (`^[A-Za-z0-9_-]{32,128}$` token; 10-char uppercase unambiguous short code,
  case-normalized on lookup), uniqueness by constraint. Accepted residual, recorded: a
  direct RPC caller may choose his own format-valid token — degrades only his own
  document's verifiability.
- **A2 (amends D5):** the mint door verifies the storage **object exists** at the
  derived path before insert — a registry row can never point at a missing object even
  via direct RPC.
- **A3 (amends D15):** `source_kind`/`status` are **text + CHECK**, not native enums —
  house vocab dialect; avoids the enum-re-key/policy-stranding defect class.
- **A4 (amends D3/D8):** `storage_path` is **door-derived** from `(id, contains_phi)`
  and CHECK-pinned; no caller ever supplies it (closes exfiltration-by-reference).
- **A5 (amends D12):** the `document.downloaded` overlay-applied flag is computed
  **in-door** from status, never caller-supplied.
- **A6 (amends D10):** the lookup RPC is **service-role-EXECUTE only** with an explicit
  `p_viewer` (server-verified session uid) — the app-layer rate limiter fronts its only
  call path; `get_feature_flags` gained **no** anon grant (the public pages read the
  flag through a server-only service-role helper).

## Amendments (P2 build, 2026-08-08 — PO-ratified "Package A", QA BLOCKER-1/MAJOR-1)

- **A7 (sharpens D11 for per-caller-masked domains):** where a source domain masks
  content **per caller** (first instance: meeting agenda items — respondent title
  masking + `read_case_deliberation`-gated free text), printed-document sight is
  **source reach AND unmasked full-content sight**, applied to mint AND download alike.
  The canonical bytes are therefore always the COMPLETE artifact, identical regardless
  of minter; a masked caller (e.g. the respondent of a linked case) can neither mint
  nor download — the same exclusion the domain's screens enforce. Rejected: baking a
  masked minimum (no complete ata could exist — fails the PO's coordinator-prints-
  complete requirement) and paper semantics (would reverse D11's "never grants sight").
- **A8 (amends D9/D12 — conservative PHI labeling, NOT the per-mint PHI choice):** an
  ata containing any masked-class content (the domain's `PHI-BEARING free text`
  columns) mints with **`contains_phi = true` derived automatically from presence** —
  non-suppressible band, `phi/` storage. This is honest labeling of content the domain
  already lawfully holds; the D9 per-mint patient-identifier choice remains ABSENT for
  meetings and still requires its own upstream domain ADR. Consequence: the mint door's
  PHI-capability gate becomes per-kind — the **third** sanctioned kind-conditional site
  (the registration-mirror trio: template coherence · commission resolution · PHI
  capability). A FOURTH kind-conditional site in the door is the abstraction-leak
  signal (supersedes the P2 "exactly 2" marker).
- **A9 (plan formula):** a new kind = provider + template + RLS arm **+ mint surface**
  + tests (QA framing correction — the four-word formula was short one term).

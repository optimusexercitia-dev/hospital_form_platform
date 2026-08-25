/**
 * PDF document printing — the typed payload contract (PDF·P1; ADR 0104 D4/D7/D13).
 *
 * PURE module (ADR 0104 D14): `src/lib/pdf/**` never imports `@/lib/supabase`,
 * `@/lib/queries`, or `server-only`. Templates are functions `DocumentPayload → HTML
 * string`, unit-testable with no browser, no network, no Supabase. Data providers in
 * `src/lib/<domain>/pdf-payload.ts` build these payloads under the caller's session
 * (RLS, Rule 9, Rule 11 audit live THERE, in the domain — never here).
 *
 * The ENVELOPE below is the frozen cross-team contract; the per-kind `body` members
 * grow one variant per rollout phase (P1 `form_response` → P2 `meeting` → P3 `case`
 * → P4 `interview`) without touching the envelope.
 *
 * All timestamps are ISO-8601 strings (payloads must be serializable — they cross the
 * renderer boundary); all display fields are pre-formatted pt-BR strings computed by
 * the data provider, so templates only lay out.
 */

// ---------------------------------------------------------------------------
// Registry vocabulary (mirrors the `printed_documents` enums — ADR 0104 D3/D6)
// ---------------------------------------------------------------------------

/** Polymorphic source kinds. All four exist from day one; kinds activate per phase
 * by registering a data provider (ADR 0104 D15). */
export type PrintedDocumentSourceKind =
  | 'form_response'
  | 'case'
  | 'meeting'
  | 'interview'

/** Post-mint lifecycle (ADR 0104 D6). States never delete anything; they change what
 * verification reports and what the download overlay stamps (D8). */
export type PrintedDocumentStatus = 'active' | 'superseded' | 'revoked'

// ---------------------------------------------------------------------------
// Watermarks (ADR 0104 D7 — derived-only, never user-composed)
// ---------------------------------------------------------------------------

/**
 * Mint-time watermark flags — the ONLY marks a template renders. `draft` prints
 * `RASCUNHO`; `final` prints `FINAL`. Every document declares exactly one of the two
 * (an unwatermarked page is evidence of tampering, not the normal case).
 *
 * `SUBSTITUÍDO`/`ANULADO` are deliberately NOT here: they are download-time overlay
 * stamps applied by the serving route over the immutable canonical bytes (D8), never
 * baked by a template.
 */
export type WatermarkFlag = 'draft' | 'final'

// ---------------------------------------------------------------------------
// Signature attestations (ADR 0104 D13)
// ---------------------------------------------------------------------------

/** How a signature was recorded. Platform sign-offs only in v1; ICP-Brasil, if ever,
 * is a new member of this union in the same block model (D13.2). */
export type SignatureMethod = 'platform_signoff'

/**
 * One attestation block: "Assinado eletronicamente por [name], [title] — [date/time]".
 * No cursive fonts, no images, no synthesized signature look (D13.1). The caption
 * always states the basis honestly ("Assinatura eletrônica registrada na plataforma").
 */
export interface SignatureAttestation {
  /** Signer display name (from the profile at mint time). */
  name: string
  /** Signer title/role display, pt-BR (e.g. "Coordenação da comissão"); null when the
   * platform holds no title for the signer. */
  title: string | null
  /** Human-readable scope of the attestation, pt-BR — a section title for per-section
   * form sign-offs, or null for a whole-document signature (ata footer blocks). */
  scope: string | null
  /** When the sign-off was recorded on the platform (ISO-8601). */
  timestamp: string
  method: SignatureMethod
}

// ---------------------------------------------------------------------------
// Envelope blocks
// ---------------------------------------------------------------------------

/** Per-hospital branding enters as DATA, never as template code (ADR 0104 D4). */
export interface DocumentLetterhead {
  hospitalName: string
  /** Postal/display address line, pre-formatted; null when the hospital has none. */
  hospitalAddress: string | null
  /** Hospital logo as a `data:` URI (the renderer is private-network; templates embed
   * every asset — ADR 0104 D14). Null renders a text-only letterhead. */
  logoDataUri: string | null
  /** Owning commission display name (all four v1 kinds resolve to one commission). */
  commissionName: string
}

/** QR verification block (ADR 0104 D10). The token is a dedicated verification
 * credential — never the registry id; the paper never carries a registry key. */
export interface DocumentQr {
  /** The dedicated random verification token minted with the registry row. */
  token: string
  /** Human-typable fallback printed beside the QR (damage fallback). */
  shortCode: string
  /** Absolute URL the QR encodes: `<base>/verificar/<token>`. */
  url: string
}

/** Emission footer: when and by whom this record was minted (D1 — a PDF is a RECORD). */
export interface DocumentEmission {
  /** Mint timestamp (ISO-8601). */
  at: string
  /** Actor display name, pre-formatted pt-BR (e.g. "Maria Silva"). */
  byDisplay: string
}

/**
 * Prévia provenance: when and by whom an EPHEMERAL page was generated (ADR 0125
 * D3/D5). Structurally identical to {@link DocumentEmission} and deliberately a
 * SEPARATE type: `Emitido` is a reserved verb naming the registered act only
 * (0125 D5 + Consequences), so the ephemeral path must not be typed in the
 * registry's vocabulary. Nothing here is stored — a prévia has no bytes at rest
 * and no registry row; only the fact of the generation is audited (D3).
 */
export interface DocumentGeneration {
  /** Generation timestamp (ISO-8601). */
  at: string
  /** Actor display name, pre-formatted pt-BR. */
  byDisplay: string
}

// ---------------------------------------------------------------------------
// Provenance — is this page a RECORD? (ADR 0125 D1/D5)
// ---------------------------------------------------------------------------

/**
 * A REGISTERED emission: permanent, hash-pinned, QR-verifiable. Its watermark is
 * free — an `in_signature` ata registers stamped RASCUNHO (0125 D1's separating
 * case), a submitted response registers stamped FINAL.
 */
export interface RegisteredProvenance {
  kind: 'registered'
  watermark: WatermarkFlag
  qr: DocumentQr
  emission: DocumentEmission
}

/**
 * An EPHEMERAL prévia: streamed, no bytes at rest, no registry row.
 *
 * ⛔ `watermark` is the LITERAL `'draft'`, and that is ADR 0125 D5's fourth cell
 * made UNREPRESENTABLE: a page watermarked FINAL that carries the prévia footer
 * would be a page the platform disclaims while its source is immutable.
 *
 * ⚠ The type is a better sentence, NOT a keystone — it constrains this codebase,
 * not the rule. The behavioural pin stays where it belongs: the 220-probe sweep
 * in `src/lib/pdf-mint/print-source-vectors.test.ts` and the seam guard in
 * `../provenance.ts`. ADR 0125 D5: *"Worth a keystone, not just a sentence."*
 */
export interface PreviaProvenance {
  kind: 'previa'
  watermark: 'draft'
  generation: DocumentGeneration
}

/**
 * Whether this page is a record, and the mark that goes with it — the two axes
 * ADR 0125 D5 reads independently, correlated here ONLY to forbid the one
 * illegal pairing. The three legal cells all stay representable: registered+FINAL
 * (submitted response / signed ata), registered+RASCUNHO (the `in_signature` ata,
 * D1's separating case), previa+RASCUNHO (the ordinary preview).
 */
export type DocumentProvenance = RegisteredProvenance | PreviaProvenance

// ---------------------------------------------------------------------------
// Per-kind document bodies (discriminated union on `kind`)
// ---------------------------------------------------------------------------

/** One rendered line of a form section. Display items (section text) come through as
 * `display_text`; answerable questions as `question`. */
export interface FormResponseDocumentItem {
  kind: 'question' | 'display_text'
  /** Question label, or the display item's text (sanitized plain text/Markdown-derived
   * — Rule 7: never raw HTML). */
  label: string
  /** Pre-formatted pt-BR answer value; null = unanswered (the template renders the
   * house "— não respondido —" marker). Always null for `display_text`. */
  value: string | null
}

/** One form section as rendered. Hidden-by-condition sections are NOT present — the
 * data provider evaluates visibility exactly like the wizard/`submit_response` do. */
export interface FormResponseDocumentSection {
  /** Section title; null for the lone default (unsectioned) section, which renders flat. */
  title: string | null
  description: string | null
  requiresSignoff: boolean
  /** The section's attestation when signed. When `requiresSignoff` and null, the
   * template renders "— não assinado —" (composing with `RASCUNHO` — D13.3). Entries
   * here are the same objects listed in the envelope's `signatures`. */
  signature: SignatureAttestation | null
  items: FormResponseDocumentItem[]
}

/** P1 body: a filled form response (ADR 0104 D15 rollout step 1 — PHI-free). */
export interface FormResponseDocumentBody {
  kind: 'form_response'
  formTitle: string
  versionNumber: number
  /** Respondent display name (the response's creator). */
  respondentDisplay: string
  /** Source lifecycle at mint — drives the `draft`/`final` watermark upstream and is
   * also rendered as a factual status line. */
  responseStatus: 'in_progress' | 'submitted'
  /** ISO-8601. */
  startedAt: string
  /** ISO-8601; null while `in_progress`. */
  submittedAt: string | null
  sections: FormResponseDocumentSection[]
}

// ---------------------------------------------------------------------------
// P2 body: meeting ata (ADR 0104 D15 rollout step 2 — PHI-free; ADR 0099's
// meetings/minutes substrate is the source). Signatures do NOT live here —
// the multi-signature footer renders from the ENVELOPE's `signatures` array
// (D13; scope null = whole-document attestations), so the envelope shape is
// unchanged by this member.
// ---------------------------------------------------------------------------

/** One attendance-list line. All display fields pre-formatted pt-BR by the
 * provider (external attendees resolve to `name (org)`, never a user id). */
export interface MeetingAttendanceEntry {
  name: string
  /** Presidente / Secretário(a) / Membro / Convidado(a). */
  roleDisplay: string
  /** Presente / Ausente / Justificado / Convocado. */
  attendanceDisplay: string
}

/** One agenda item with its deliberation (discussion + resolution). */
export interface MeetingAgendaEntry {
  title: string
  description: string | null
  discussionNotes: string | null
  resolution: string | null
}

/** One action item linked to the meeting — a REFERENCE line, not the item
 * (the ata records that it exists and where it stands, never its full body). */
export interface MeetingActionItemRef {
  title: string
  statusDisplay: string
  assigneeDisplay: string | null
  /** Pre-formatted pt-BR due date, or null. */
  dueDisplay: string | null
}

/** P2 body: a meeting's ata. */
export interface MeetingDocumentBody {
  kind: 'meeting'
  meetingNumber: number
  title: string
  meetingTypeDisplay: string | null
  /** pt-BR lifecycle label (factual line; the draft/final WATERMARK is the
   * envelope's — derived from `signed`/`distributed` vs earlier states, D7). */
  statusDisplay: string
  /** ISO-8601. */
  scheduledStart: string
  /** ISO-8601; null while not held. */
  heldAt: string | null
  heldEnd: string | null
  modalityDisplay: string | null
  locationDisplay: string | null
  /** Null when the meeting records no quorum data. */
  quorum: {
    met: boolean | null
    presentCount: number | null
    eligibleCount: number | null
  } | null
  /** The minutes body (sanitized Markdown rendered as text — Rule 7; null
   * until minutes exist). */
  minutesMd: string | null
  agenda: MeetingAgendaEntry[]
  attendance: MeetingAttendanceEntry[]
  actionItems: MeetingActionItemRef[]
}

// ---------------------------------------------------------------------------
// P3 body: the case DOSSIER (ADR 0104 D15 rollout step 3; ADR 0144).
//
// ⚠ THE ONLY BODY THAT CAN CARRY PHI (Rule 12). Its two D5 variants are ONE
// body type discriminated by `variant`, not two types — they render the same
// document with one section's contents differing, and the `template_key`
// (`case` / `case_identified`) is DERIVED from `variant` by `templateFor` in
// `../render`, never passed in alongside it. See that function's header for why
// the derivation direction is load-bearing.
// ---------------------------------------------------------------------------

/**
 * One patient block (ADR 0144 D5 — the field split, verbatim).
 *
 * ⛔ `patient_key` / `encounter_key` are internal join keys and appear in
 * NEITHER variant, so they have no member here at all — absence from the type
 * is a stronger guarantee than a field the template remembers not to print.
 *
 * ⚠ EVERY field below is sourced from `public.patient_identifiers`, a Class-1
 * PHI table, through the audited reader `public.get_case_patients`. That
 * includes the three "de-identification floor" fields — reading `age_years` out
 * of that table IS a PHI read and emits the Rule 11 row, de-identified variant
 * or not.
 */
export interface CasePatientEntry {
  /** Pre-formatted pt-BR ("47 anos"); null when not on file. BOTH variants. */
  ageDisplay: string | null
  /** BOTH variants. */
  sexDisplay: string | null
  /** BOTH variants. */
  unitDisplay: string | null
  /** ⛔ IDENTIFIED VARIANT ONLY — always null when `variant` is
   * `'deidentified'`, and the provider is what guarantees that (it never copies
   * the field), not the template. */
  name: string | null
  /** ⛔ Identified only. */
  mrn: string | null
  /** ⛔ Identified only. Pre-formatted pt-BR date. */
  dateOfBirthDisplay: string | null
  /** ⛔ Identified only. */
  attending: string | null
  /** ⛔ Identified only. */
  encounterRef: string | null
}

/** One acting professional on the case. ADR 0144 D11: name + role/title ONLY —
 * council registrations (CRM / COREN / …) are deferred, which is what keeps
 * P3's audited-read delta to exactly one data class. */
export interface CaseParticipantEntry {
  name: string
  roleDisplay: string
  /** Professional title from `professional_profiles` (Class-2); null when none. */
  titleDisplay: string | null
  /** Pre-formatted pt-BR note when the participant is recused; null otherwise. */
  recusalDisplay: string | null
}

/** One process phase, with its response answers INLINE (ADR 0144 D2). Reuses
 * {@link FormResponseDocumentItem} deliberately — a phase answer set IS a form
 * response, and a second near-identical line type would be two shapes for one
 * thing. */
export interface CasePhaseEntry {
  title: string
  statusDisplay: string
  respondentDisplay: string | null
  submittedAtDisplay: string | null
  /** The phase's recorded result/outcome label; null when none. */
  resultDisplay: string | null
  items: FormResponseDocumentItem[]
}

/** One narrative. `bodyMd` is sanitized Markdown rendered as text (Rule 7);
 * ⚠ null after `dispose_case_phi`, which nulls `body_md` outright. */
export interface CaseNarrativeEntry {
  title: string
  authorDisplay: string | null
  dateDisplay: string | null
  bodyMd: string | null
}

/** One interview. ⚠ `summaryMd` is nulled by `dispose_case_phi`; the subject
 * notes are redacted rather than dropped. */
export interface CaseInterviewEntry {
  title: string
  statusDisplay: string
  dateDisplay: string | null
  subjects: string[]
  interviewers: string[]
  summaryMd: string | null
}

/** One timeline event. ⚠ Both `title` and `body` are REDACTED to
 * "[PHI removido]" by `dispose_case_phi` — redacted, not removed, so these stay
 * non-null on a disposed case and the section still renders. */
export interface CaseTimelineEntry {
  dateDisplay: string
  kindDisplay: string
  title: string
  body: string | null
  authorDisplay: string | null
}

/** One meeting at which this case was discussed. ⚠ `summary`/`decision` are
 * redacted by `dispose_case_phi`. */
export interface CaseMeetingEntry {
  meetingDisplay: string
  dateDisplay: string | null
  summary: string | null
  decision: string | null
}

/** One action item linked to the case — a REFERENCE line, never the item body. */
export interface CaseActionItemEntry {
  title: string
  statusDisplay: string
  assigneeDisplay: string | null
  dueDisplay: string | null
}

/** One correction request against a phase response (ADR 0085). */
export interface CaseCorrectionEntry {
  requestedByDisplay: string | null
  dateDisplay: string | null
  statusDisplay: string
  kindDisplay: string | null
  justification: string | null
}

/** An inter-committee referral: the FROZEN SNAPSHOT plus the structured reply
 * (ADR 0037 / 0144 D2). Rendered inline — it is platform-authored content. */
export interface CaseReferralEntry {
  directionDisplay: string
  counterpartDisplay: string
  statusDisplay: string
  sentAtDisplay: string | null
  question: string | null
  /** The frozen snapshot, pre-flattened to label/value lines by the provider. */
  snapshot: { label: string; value: string }[]
  replyStatusDisplay: string | null
  replyBody: string | null
  repliedAtDisplay: string | null
}

/**
 * One UPLOADED case document — a MANIFEST LINE ONLY (ADR 0144 D2).
 *
 * ⛔ The bytes are deliberately NOT embedded. Gotenberg renders HTML and cannot
 * inline an arbitrary PDF or JPEG; embedding would duplicate bytes already
 * governed by the DM3 controlled-document lifecycle; and a line carrying a
 * CONTENT HASH is stronger evidence than a re-encoded copy.
 *
 * ⚠ `title` is redacted to "[PHI removido]" by `dispose_case_phi`.
 */
export interface CaseDocumentManifestEntry {
  title: string
  uploaderDisplay: string | null
  dateDisplay: string | null
  /** sha-256 hex of the stored bytes; null when the platform holds none. */
  contentHash: string | null
}

/**
 * P3 body: the full case dossier (ADR 0144 D1 — ONE fixed template per key, no
 * per-mint section picker).
 *
 * ⚠ **EVERY COLLECTION HERE IS COUPLED TO A D15 TRIGGER.** The table behind each
 * one carries a `bump_case_print_revision` trigger (migration
 * `20261003002200`), because a rendered table with no trigger drifts silently
 * while `/verificar` keeps reporting "autêntico e atual". ⛔ ADDING A FIELD
 * SOURCED FROM A NEW TABLE REQUIRES ADDING A TRIGGER THERE — and, if that table
 * has a per-caller SELECT policy, a new axis in
 * `app.can_read_full_case_content` as well. The migration carries the mirror of
 * this note.
 *
 * ⚠ **MUST DEGRADE ON A DISPOSED CASE.** `dispose_case_phi` guts this body:
 * `patients` empties, every phase's `items` empties (the answers are DELETED),
 * `bodyMd`/`summaryMd` go null, and `title`/`body`/`summary`/`decision` become
 * "[PHI removido]". The template renders NO HEADING for an empty section.
 */
export interface CaseDocumentBody {
  kind: 'case'
  /**
   * Which D5 identifier set this render actually INCLUDED — a property of the
   * bytes, never a copy of the request.
   *
   * ⛔ The provider assigns this from what `public.get_case_patients` RETURNED,
   * not from the caller's `includePhi` flag: the door answers `null`
   * (unentitled) and `[]` (entitled, none on file) as well as rows, and both of
   * those make an "identified" request produce a payload with no identifiers in
   * it. Copying the request here would label such bytes `case_identified` and
   * mint them into the identified series, superseding a real identified
   * dossier with one that has no identifiers — so the provider THROWS on both
   * instead. ⇒ `variant: 'identified'` is provably equivalent to "the patient
   * identification section was rendered", which is what makes the committed
   * `case_identified` fingerprint pin a structure that actually exists.
   */
  variant: 'deidentified' | 'identified'
  caseNumber: string
  /** ⚠ Redacted to "[PHI removido]" by `dispose_case_phi` (`cases.label`). */
  title: string | null
  statusDisplay: string
  /**
   * `cases.confidentiality_level`, pt-BR. ⛔ A CLASSIFICATION LABEL ONLY (D13):
   * it renders on the letterhead and in the running header, and drives NOTHING.
   * Storage bifurcation and the confidentiality band stay keyed to
   * `containsPhi` alone — ADR 0104 D9.4 chose "two dumb policies, not one
   * conditional one", and folding a second axis into the storage decision is
   * exactly what that wording forbids.
   */
  confidentialityDisplay: string
  caseTypeDisplay: string | null
  outcomeDisplay: string | null
  departmentDisplay: string | null
  tags: string[]
  openedAtDisplay: string
  closedAtDisplay: string | null
  /** `cases.phi_disposed_at is not null`. Rendered as a factual notice so the
   * dossier states WHY it is thin, rather than looking like a rendering bug. */
  phiDisposed: boolean
  patients: CasePatientEntry[]
  participants: CaseParticipantEntry[]
  phases: CasePhaseEntry[]
  narratives: CaseNarrativeEntry[]
  interviews: CaseInterviewEntry[]
  referrals: CaseReferralEntry[]
  timeline: CaseTimelineEntry[]
  meetings: CaseMeetingEntry[]
  actionItems: CaseActionItemEntry[]
  corrections: CaseCorrectionEntry[]
  /** Uploaded binaries as manifest lines only (D2). */
  documents: CaseDocumentManifestEntry[]
}

/**
 * The per-kind discriminated union. P4 adds `interview` here — one variant per
 * phase, envelope untouched.
 */
export type DocumentBody =
  | FormResponseDocumentBody
  | MeetingDocumentBody
  | CaseDocumentBody

// ---------------------------------------------------------------------------
// The envelope (the frozen contract — plan §2.2)
// ---------------------------------------------------------------------------

/**
 * Everything a template needs to render one document, PLUS the mint-time facts
 * observed while building it. Built by the source domain's
 * data provider under the CALLER's session; consumed by `src/lib/pdf/render.ts` and
 * the per-kind template in `src/lib/pdf/documents/`.
 */
export interface DocumentPayload {
  letterhead: DocumentLetterhead
  /**
   * Whether the page is a RECORD, and the mark that goes with it (ADR 0125 D1/D5).
   * Replaces the former `watermarks` / `qr` / `emission` trio: those three fields
   * let a caller pair a FINAL mark with an unregistered page, which is the one
   * combination the platform must never produce.
   */
  provenance: DocumentProvenance
  /** Canonical flat list of every attestation on the document (per-section entries
   * for forms, footer blocks for atas). */
  signatures: SignatureAttestation[]
  /**
   * Whether this mint carries patient PHI (ADR 0104 D9). Always `false` in P1/P2
   * (forms and meetings mint PHI-free only). When true, the shared confidentiality
   * band "DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE" renders in the
   * header/footer and is NOT suppressible (D7).
   */
  containsPhi: boolean
  /**
   * The source's revision AS OBSERVED WHEN THIS PAYLOAD WAS BUILT (ADR 0126 D9 +
   * Consequences' compare-and-mint). `0` for kinds with no revision chain.
   *
   * ⛔ **This is the ONE field here that no template renders, and it is carried
   * on the payload deliberately — the alternative is a defect.** The render is
   * out-of-band and takes seconds, and both reversal doors can fire mid-corridor.
   * `mint_printed_document` compares the revision the caller OBSERVED against the
   * source's current one and raises `HC0DU` on a mismatch, so a registered hash
   * can never pin bytes of a state that never coherently registered.
   *
   * ⚠ **Re-reading the revision at submit defeats the entire mechanism**: the
   * door would compare its own current value against itself, the comparison would
   * always succeed, and `HC0DU` would go VACUOUS WHILE LOOKING CORRECT. Sourcing
   * it here — from the same read that built the payload — makes that re-read
   * structurally impossible rather than merely discouraged: the mint action never
   * queries the source at all, so there is no fresher value for it to reach for.
   *
   * This is the same path `containsPhi` already takes, for the same reason: a
   * fact about the source at build time, needed by the door after the render.
   */
  sourceRevision: number
  body: DocumentBody
}

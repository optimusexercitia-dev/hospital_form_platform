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

/**
 * The per-kind discriminated union. P3–P4 add `case` / `interview` members
 * here — one variant per phase, envelope untouched.
 */
export type DocumentBody = FormResponseDocumentBody | MeetingDocumentBody

// ---------------------------------------------------------------------------
// The envelope (the frozen contract — plan §2.2)
// ---------------------------------------------------------------------------

/**
 * Everything a template needs to render one document. Built by the source domain's
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
  body: DocumentBody
}

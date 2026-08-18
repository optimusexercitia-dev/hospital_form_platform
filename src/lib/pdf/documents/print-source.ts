import { meetingWatermarkFor } from './meeting'
import type { WatermarkFlag } from '../types'

/**
 * The two MINT-TIME print derivations, per source kind (ADR 0125 D1/D5/D8 +
 * Amendment 2 · ADR 0126 D5/D7/D10).
 *
 *   registers — is this source LOCKED, such that printing it yields a REGISTERED
 *               emission (permanent, hash-pinned, QR-verifiable)? A source that
 *               is still freely editable yields an ephemeral prévia instead.
 *   watermark — is the CONTENT final (`final`), or not yet (`draft`)?
 *
 * ⛔ **The user never chooses which.** Registration is DERIVED from source state
 * (0125 D1) — the rejected alternative was two buttons side by side, which would
 * have made *"is this a record?"* a user decision, in the one module built to
 * prevent exactly that (ADR 0104 D7).
 *
 * PURE and CLIENT-IMPORTABLE (ADR 0104 D14 — `src/lib/pdf/**` never imports
 * `@/lib/supabase`, `@/lib/queries` or `server-only`). Both take `kind` and
 * `status` as plain strings for that reason, exactly like {@link meetingWatermarkFor}:
 * the enum types live in `@/lib/queries/meetings`, and importing them here would
 * couple the pure renderer to a server module.
 *
 * ⚠ **THE TWO AXES ARE DECLARED SEPARATELY, AND THAT IS THE POINT — NOT CEREMONY.**
 * ADR 0125 D8 / 0126 D7 require a separate declaration per axis per kind *even
 * where they coincide*, and 0125 Amendment 2 states the rule for the case that
 * looks most like duplication: for `form_response` the two axes RE-coincide, and
 * *"the coincidence is recorded, not exploited"*. So the three conjuncts below
 * are spelled out **twice, deliberately**. ⛔ Do not factor them into a shared
 * helper: that would make one edit move both axes silently, which is precisely
 * the coupling D1 exists to break. A single predicate looked sufficient right up
 * until meetings were examined — where the axes genuinely SEPARATE at
 * `in_signature` (registers, stamped RASCUNHO).
 *
 * ⚠ Both are mirrored in SQL as `app.print_source_registers`. The shared vectors
 * in `src/lib/queries/__fixtures__/print-source-registers-vectors.json` drive
 * this module's suite AND the pgTAP one; drift between them is phase-blocking
 * (the same answer Architecture Rule 3 gives for the condition evaluator).
 *
 * ⚠ **TESTS: `src/lib/pdf-mint/print-source-vectors.test.ts`** — deliberately NOT
 * colocated. This directory may not import `src/lib/queries` by any path shape
 * (eslint `no-restricted-imports`, ADR 0104 D14), and that is where the shared
 * fixture lives; the suite's header explains the placement in full.
 */

/**
 * The source state both derivations read. `correctionOpen` / `phaseVoided`
 * default FALSE when absent and are meaningful for `form_response` only — every
 * other kind must IGNORE them (pinned over the vectors).
 */
export interface PrintSourceState {
  /** The source row's lifecycle status (`responses.status`, `meetings.status`, …). */
  status: string
  /**
   * An open, still-rejectable correction request exists whose `draft_response_id`
   * is this response — operationally `case_correction_requests.status in
   * ('resubmitted','under_review')`, the exact set `reject_correction` accepts
   * (ADR 0126 D10). In `requested`/`in_progress`/`rejected` the draft is not
   * `submitted`; in `approved`/`withdrawn` the request is closed.
   */
  correctionOpen?: boolean
  /**
   * The attached `case_phase` has status `voided` (ADR 0126 D10). Measured
   * terminal — `activate_phase` refuses anything but `pending` (HC019).
   */
  phaseVoided?: boolean
  /**
   * `meetings.phi_disposed_at is not null` — the minutes have been disposed
   * (ADR 0126, disposal amendment). Defaults FALSE; meaningful for **`meeting`**
   * only.
   *
   * ⚠ The meeting analogue of {@link phaseVoided}: `dispose_meeting_minutes`
   * nulls `minutes_md` and redacts the agenda **without touching `status` or
   * `revision`**, so a registered print would pin a `content_hash` for content
   * that no longer exists and read *"autêntico e atual"* forever. Registration
   * drops, and currency then falls out of ADR 0126 D2's first conjunct for free.
   */
  meetingDisposed?: boolean
}

/**
 * Meeting statuses that REGISTER (ADR 0125 D1).
 *
 * ⛔ `cancelled` is deliberately EXCLUDED even though it sits in the LOCK set —
 * `app.guard_meeting_status` refuses a DELETE there. The lock exists to preserve
 * the audit trail of a cancellation, not because an ata of record was produced:
 * there are no minutes to pin. This is the ONE place the registering set is a
 * strict subset of the lock set, and it is a decision, not an oversight — which
 * is also why nothing here is named `isLocked`, a name that would have to return
 * TRUE at `cancelled` and would be a lie about what this predicate decides.
 */
const MEETING_REGISTERING_STATUSES = ['in_signature', 'signed', 'distributed']

/**
 * Does printing this source produce a REGISTERED emission (vs. an ephemeral
 * prévia)? ADR 0125 D1, refined by ADR 0126 D5 + D10.
 *
 * ⛔ Fail-closed ELSE: an unhandled kind is EPHEMERAL (0125 D8), mirroring
 * `app.can_view_printed_document`'s shape. A new printable kind that forgets to
 * declare its arm fails shut rather than quietly registering everything.
 */
export function printSourceRegisters(kind: string, state: PrintSourceState): boolean {
  switch (kind) {
    case 'form_response':
      // ADR 0126 D5 + D10 — THREE conjuncts. `submitted` alone is NOT a lock
      // point: `reject_correction` walks a submitted correction draft back to
      // `in_progress` (the corridor that raised HC069 — 0125 Amendment 1 §A),
      // and `approve_correction(kind='void')` annuls the phase without ever
      // touching the response. A state a door can walk back out of is not a lock
      // point.
      return (
        state.status === 'submitted' &&
        !(state.correctionOpen ?? false) &&
        !(state.phaseVoided ?? false)
      )
    case 'meeting':
      // ADR 0125 D1 — the LOCK point, not the watermark's finality point. An ata
      // circulating for signature is a document of record: undeletable from that
      // moment, and it is what the committee is being asked to attest to.
      //
      // ...AND NOT disposed. `dispose_meeting_minutes` empties the content while
      // leaving `status` (and `revision`) untouched, so neither the status term
      // nor 0126 D9's revision match can see it. Same shape as D10's voided
      // phase: the content a registered hash would pin no longer exists.
      return (
        MEETING_REGISTERING_STATUSES.includes(state.status) &&
        !(state.meetingDisposed ?? false)
      )
    default:
      // `case` (P3) and `interview` (P4) are in the `source_kind` CHECK but have
      // no provider registered; their lock/watermark/series/head declarations are
      // deferred to provider activation (0125 D8, 0126 D7). Not-locked ⇒
      // ephemeral, no exceptions.
      return false
  }
}

/**
 * Is this source's CONTENT final? ADR 0104 D7, refined for `form_response` by
 * ADR 0125 Amendment 2.
 *
 * ⛔ NOT derivable from {@link printSourceRegisters} — for `meeting` the two axes
 * genuinely separate at `in_signature`, which registers while still stamped
 * RASCUNHO. See this module's header before collapsing anything here.
 */
export function printSourceWatermark(kind: string, state: PrintSourceState): WatermarkFlag {
  switch (kind) {
    case 'form_response':
      // ADR 0125 Amendment 2 — the watermark moves IN TANDEM with 0126 D5/D10's
      // refined lock, and THAT is what keeps 0125 D5's fourth cell (FINAL page +
      // prévia footer) unreachable. Keyed on `submitted` alone, a submitted draft
      // of an open correction would print FINAL while carrying the prévia footer:
      // a page the platform disclaims whose watermark claims it is settled.
      //
      // ⚠ The three conjuncts are repeated from `printSourceRegisters` ON PURPOSE
      // (0125 D8 / 0126 D7 — declared separately; the coincidence is recorded,
      // not exploited). Do not factor them out.
      return state.status === 'submitted' &&
        !(state.correctionOpen ?? false) &&
        !(state.phaseVoided ?? false)
        ? 'final'
        : 'draft'
    case 'meeting':
      // ⛔ `meetingWatermarkFor` is NOT CHANGED by ADR 0125 — an `in_signature`
      // ata registers stamped RASCUNHO on purpose (making it print FINAL would
      // put a lie on the page: the signature footer still renders "— não
      // assinado —", and pgTAP `312` + E2E + fingerprint.test.ts pin the mark).
      // It stays a pure function of status; the disposal term COMPOSES ON TOP of
      // it here rather than being folded into it.
      //
      // ⚠ The disposal term MUST move in tandem with the registration arm — this
      // is ADR 0125 Amendment 2's shape recurring for the meeting kind. Drop it
      // from registration only, and a `signed` + disposed ata becomes
      // registers=false + watermark='final': ADR 0125 D5's forbidden FOURTH CELL,
      // reached. The 440-probe sweep is what catches that, not this comment.
      return meetingWatermarkFor(state.status) === 'final' &&
        !(state.meetingDisposed ?? false)
        ? 'final'
        : 'draft'
    default:
      return 'draft'
  }
}

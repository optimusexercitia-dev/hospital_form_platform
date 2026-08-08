import type { MeetingDocumentBody } from '../types'

/**
 * The meeting (ata) document template (PDF·P2; ADR 0104 D15 rollout step 2).
 *
 * ⛔ CONTRACT STUB (M-B2): the real template lands with the P2 renderer task;
 * this module exists now so the kind's constants are minted once and the
 * exhaustive dispatch in `render.ts` compiles against the widened union.
 * No fingerprint is recorded until the real template renders — recording one
 * against a throwing stub would pin nothing.
 *
 * TEMPLATE_VERSION is LOAD-BEARING metadata (D4): recorded in the registry at
 * mint, reported by verification; any visual/structural change after first
 * release REQUIRES bumping it (fingerprint-guarded like form-response).
 */
export const TEMPLATE_KEY = 'meeting'
export const TEMPLATE_VERSION = 1

/** Renders the ata body. NOT IMPLEMENTED until the P2 renderer task. */
export function renderMeetingBody(_body: MeetingDocumentBody): string {
  throw new Error('renderMeetingBody: not implemented (PDF·P2 contract stub)')
}

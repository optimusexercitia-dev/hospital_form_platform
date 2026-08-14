import { describe, expect, it } from 'vitest'

import {
  mapNspEvidenceErrorCode,
  nspEvidenceAvailability,
  type NspEvidenceAvailability,
} from '@/lib/safety/evidence-contract'

/**
 * DM5 S2 — the availability projection, pinned EXHAUSTIVELY.
 *
 * This test exists because `pending` is NOT reachable through the real corridor
 * today (the evidence row is created at finalize, and
 * `complete_document_upload_verification` binds the rendition and moves
 * `scan_pending → unscanned_accepted` inside ONE transaction). The state stays
 * in the vocabulary because ADR 0114 O2 — scanner selection — is OPEN.
 *
 * The alternative was an E2E that boots a browser and mutates
 * `file_objects.upload_state` by direct service-role UPDATE, because no RPC can
 * leave a file in that state. That works, but it is heavy for a pure mapping and
 * it sits one careless rename away from being read as a claim about the
 * CORRIDOR. A unit test over a pure function is structurally incapable of that
 * confusion.
 *
 * ⚠ EXHAUSTIVE, NOT EXEMPLARY. `file_objects.upload_state` has TEN
 * CHECK-constrained values and `disposal_state` THREE. A test asserting two or
 * three cases proves the function RUNS, not that it MAPS. Every value of both
 * columns appears below, named for the state rather than numbered.
 */

/** Every value `file_objects_upload_state_check` admits, verbatim. */
const UPLOAD_STATES = [
  'reserved',
  'uploaded',
  'verifying',
  'scan_pending',
  'clean',
  'unscanned_accepted',
  'infected',
  'rejected',
  'abandoned',
  'failed',
] as const

/** Every value `file_objects_disposal_state_check` admits, verbatim. */
const DISPOSAL_STATES = ['none', 'disposal_pending', 'disposed'] as const

const active = (uploadState: string | null, disposalState: string | null = 'none') =>
  nspEvidenceAvailability({ uploadState, disposalState, documentStatus: 'active' })

describe('nspEvidenceAvailability — upload_state, on an active document', () => {
  const expected: Record<(typeof UPLOAD_STATES)[number], NspEvidenceAvailability> = {
    // In-flight: the four states the corridor collapses today (ADR 0114 O2).
    reserved: 'pending',
    uploaded: 'pending',
    verifying: 'pending',
    scan_pending: 'pending',
    // Servable.
    clean: 'available',
    unscanned_accepted: 'available',
    // Terminal failures — no outbound arc in the D9 machine.
    infected: 'failed',
    rejected: 'failed',
    abandoned: 'failed',
    failed: 'failed',
  }

  for (const state of UPLOAD_STATES) {
    it(`maps upload_state '${state}' to '${expected[state]}'`, () => {
      expect(active(state)).toBe(expected[state])
    })
  }

  it('covers every value of file_objects_upload_state_check (10)', () => {
    // Guards the table above against a future CHECK gaining a value while this
    // test keeps passing on the nine it already knows.
    expect(UPLOAD_STATES).toHaveLength(10)
    expect(Object.keys(expected)).toHaveLength(10)
  })
})

describe('nspEvidenceAvailability — disposal outranks upload (the precedence)', () => {
  // ⚠ The part a refactor is most likely to invert, and no other test catches
  // it: bytes that are gone are not servable however healthy the upload looked.
  it("projects a CLEAN file with disposal_state 'disposed' as 'disposed', not 'available'", () => {
    expect(active('clean', 'disposed')).toBe('disposed')
  })

  it("projects a CLEAN file with disposal_state 'disposal_pending' as 'disposed'", () => {
    expect(active('clean', 'disposal_pending')).toBe('disposed')
  })

  it("projects an UNSCANNED_ACCEPTED file mid-disposal as 'disposed'", () => {
    expect(active('unscanned_accepted', 'disposal_pending')).toBe('disposed')
  })

  it('lets disposal outrank EVERY upload_state, not just the servable ones', () => {
    for (const upload of UPLOAD_STATES) {
      expect(active(upload, 'disposed')).toBe('disposed')
      expect(active(upload, 'disposal_pending')).toBe('disposed')
    }
  })

  it("only disposal_state 'none' allows a non-disposed projection", () => {
    expect(DISPOSAL_STATES).toHaveLength(3)
    expect(active('clean', 'none')).toBe('available')
  })
})

describe('nspEvidenceAvailability — document status outranks the file', () => {
  it("projects a disposed DOCUMENT as 'disposed' even with a clean file", () => {
    expect(
      nspEvidenceAvailability({
        uploadState: 'clean',
        disposalState: 'none',
        documentStatus: 'disposed',
      }),
    ).toBe('disposed')
  })

  it("projects a SOFT-DELETED document as 'unavailable', NOT 'failed'", () => {
    // ⚠ The distinction is user-facing, not cosmetic. `failed` means the UPLOAD
    // did not complete and tells the user to remove the item and send the file
    // again. A soft-deleted document was REMOVED DELIBERATELY — that advice is a
    // false diagnosis pointing at a recovery action that cannot work. A wrong
    // state is worse than a missing one, which is why `unavailable` exists.
    expect(
      nspEvidenceAvailability({
        uploadState: 'clean',
        disposalState: 'none',
        documentStatus: 'soft_deleted',
      }),
    ).toBe('unavailable')
  })

  it("keeps 'unavailable' distinct from 'failed' for every servable upload state", () => {
    for (const upload of ['clean', 'unscanned_accepted']) {
      expect(
        nspEvidenceAvailability({
          uploadState: upload,
          disposalState: 'none',
          documentStatus: 'soft_deleted',
        }),
      ).toBe('unavailable')
    }
  })
})

describe('nspEvidenceAvailability — no binding yet', () => {
  it("projects a null upload_state as 'pending' (begin ran, finalize did not)", () => {
    expect(active(null)).toBe('pending')
  })
})

describe('nspEvidenceAvailability — the default arm is CONSERVATIVE', () => {
  // ⚠ The failure mode designed out: an unrecognised state silently becoming
  // `available` would promise bytes the door will refuse. A state this function
  // has not been taught must be visible and wrong in the SAFE direction.
  const unknowns = ['quarantined', 'archived', '', 'CLEAN', 'scanning']

  for (const unknown of unknowns) {
    it(`does not project the unknown upload_state '${unknown}' as 'available'`, () => {
      expect(active(unknown)).not.toBe('available')
    })
  }

  it("projects an unknown upload_state as 'failed' specifically", () => {
    expect(active('quarantined')).toBe('failed')
  })

  it('does not project an unknown disposal_state as disposed (only the two real ones)', () => {
    // A disposal_state this function does not know must not silently suppress
    // the upload projection either.
    expect(active('clean', 'shredded')).toBe('available')
  })
})

describe('mapNspEvidenceErrorCode — code alone, never message text', () => {
  it('maps the SQLSTATEs the S2 doors actually raise', () => {
    expect(mapNspEvidenceErrorCode('HC0D7')).toBe('module_disabled')
    expect(mapNspEvidenceErrorCode('42501')).toBe('forbidden')
    expect(mapNspEvidenceErrorCode('HC048')).toBe('rca_not_writable')
    expect(mapNspEvidenceErrorCode('HC0D8')).toBe('unavailable')
    expect(mapNspEvidenceErrorCode('HC0DD')).toBe('disposed')
    expect(mapNspEvidenceErrorCode('23514')).toBe('invalid_input')
  })

  it("surfaces HC0DM as 'unknown' — the parked-citation refusal S2 REMOVED", () => {
    // Deliberately absent from the map: an entry would outlive the code that
    // raises it and read as live behaviour. If it ever reappears it must be
    // loud, not a friendly banner for a state that should no longer exist.
    expect(mapNspEvidenceErrorCode('HC0DM')).toBe('unknown')
  })

  it("maps an unrecognised SQLSTATE to 'unknown' rather than guessing", () => {
    expect(mapNspEvidenceErrorCode('XX000')).toBe('unknown')
    expect(mapNspEvidenceErrorCode(null)).toBe('unknown')
    expect(mapNspEvidenceErrorCode(undefined)).toBe('unknown')
  })
})

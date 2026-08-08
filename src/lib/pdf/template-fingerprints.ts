/**
 * Committed structural fingerprints, per template (ADR 0104 D4's
 * silent-staleness guard). `fingerprint.test.ts` renders each template's
 * canonical fixture and compares sha-256 against THIS record:
 *
 *  - output changed + version unchanged  → RED: bump TEMPLATE_VERSION in the
 *    template module, then update BOTH fields here (in the same commit).
 *  - version bumped here without the template module agreeing → RED.
 *
 * The pair (version, fingerprint) moves together, always by hand — that is the
 * point: a template edit cannot ship without a deliberate version decision.
 */
export const TEMPLATE_FINGERPRINTS: Record<
  string,
  { version: number; fingerprint: string; variants: Record<string, string> }
> = {
  form_response: {
    version: 1,
    fingerprint: 'e8e01db53aac51fb94ceb38e35efdcec4eaaf9163c32c63bf8acd5e2a1b5c52f',
    // QA MAJOR-2 (phase-PDF-P1-review): the canonical fixture renders the
    // draft/no-PHI/no-logo branch only, leaving the FINAL chip (the branch
    // every SUBMITTED response uses), the confidentiality band, and the
    // letterhead logo OUTSIDE the fingerprint. Each variant below pins the
    // remaining branches; a template edit to any of them must move its hash.
    variants: {
      final_phi_logo:
        '871e8761e70f47c12084609bd69d10e539b4bf1454414b54870dafd78cb6c304',
    },
  },
}

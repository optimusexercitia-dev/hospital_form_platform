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
      // ADR 0125 D2/D5 — the EPHEMERAL prévia branch: same template, prévia
      // footer instead of the QR block. Pinned because the page is still read by
      // a human even though its bytes are never stored. It shares this
      // template's `version` because it IS this template.
      previa: 'e47880d58785e3147b8785be2d37fb0c38a0fea7cbbda6485504834edadf9c8c',
    },
  },
  meeting: {
    version: 1,
    // Canonical: RASCUNHO, no signatures ("— não assinado —" footer), minutes
    // + agenda + attendance + action items populated.
    fingerprint: '865b7e9f6ca2efd90fb3f7941bab68b73facbfc0384ce2d23764485179b4bade',
    variants: {
      // The DEGENERATE-STATE pin (QA MINOR-6): FINAL watermark + two
      // attestation footer blocks + null minutes + null quorum (no "Quórum:"
      // line) + EMPTY agenda and attendance (their empty-state markers) +
      // absent "Encaminhamentos" — every branch the populated canonical
      // cannot exercise.
      final_signed:
        '2af29e06c5df9cb43a4c6083e341c63f1ea00f2188376422ab7fb1544935deda',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // PDF·P3 — the case dossier (ADR 0144). ⚠ TWO KEYS, ONE MODULE
  // (`documents/case.ts`), ONE renderer. `case` and `case_identified` are the
  // ADR 0144 D5 variants; the key is DERIVED from `body.variant` by
  // `templateFor`, so the registry's label cannot disagree with the bytes.
  //
  // ⛔ THEY SHARE A `version` DELIBERATELY: one module, one layout, one
  // fingerprint-bump decision. A structural edit bumps BOTH and must move BOTH
  // hashes, because both keys render through the same functions.
  //
  // ⚠ Since P3 the hashed input is `renderDocumentHtml(p) + (documentFooterHtml(p) ?? '')`
  // — the D13 page footer is a SEPARATE Gotenberg document and would otherwise
  // sit outside this guard entirely. `?? ''` appends nothing for the two kinds
  // above, so their committed hashes were unaffected (verified by running the
  // suite before and after that change, not inferred from the `??`).
  // ─────────────────────────────────────────────────────────────────────────
  case: {
    version: 1,
    // Canonical: REGISTERED + FINAL, de-identified patient block, every section
    // populated (participants · phases with answers · narratives · interviews ·
    // referral snapshot + reply · timeline · meetings · action items ·
    // corrections · document manifest), TOC listing all eleven.
    fingerprint: '921db6286faba6a825aec9861ac580b4d278240ae12d7971a0863d5683030da3',
    variants: {
      // ADR 0125 D2/D5 — the EPHEMERAL branch: same template, prévia footer
      // instead of the QR block. Shares this template's `version` because it IS
      // this template.
      previa: 'd5229427b266e8e6026dd6bae9095b0b892f787fc0e16e37f4e549c12f3e79a2',
      // ⭐ THE DEGENERATE STATE the canonical fixture cannot reach, and the one
      // most likely to be wrong: a case after `dispose_case_phi`. Pins that
      // gutted sections DROP ENTIRELY rather than printing bare headings, that
      // the index shrinks with them, that the disposal notice renders — and the
      // deliberate ASYMMETRY, that an interview's metadata SURVIVES (the fact
      // that it happened is process evidence) while its summary does not, where
      // a narrative whose body was nulled disappears completely.
      disposed: 'de4e204a3058549993a1ecfbdd2bdbf5e50cc32fced757edfd68bb8dbd7d7071',
    },
  },
  case_identified: {
    version: 1,
    // The ONLY key whose render contains `name` / `mrn` / `date_of_birth` /
    // `attending` / `encounter_ref` (ADR 0144 D5). Its own committed hash is
    // what makes "this key means the patient identification section is present"
    // a pinned fact rather than a naming convention — and the suite asserts
    // BOTH directions: the five identifiers appear here and appear in NEITHER
    // of the de-identified renders.
    fingerprint: '20d7bc1fb7275602443bd143047871658576ac44ba9d4cff7d4eb7ca04ec61fe',
    // No variants: the prévia and disposed branches are pinned under `case`,
    // and a DISPOSED case has no identifiers left to render — an identified
    // dossier of a disposed case is unconstructible, not merely untested.
    variants: {},
  },
}

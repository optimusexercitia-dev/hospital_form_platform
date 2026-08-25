# PDF·P3 — Printing Cases (task detail)

Rotated out of PROGRESS.md 2026-08-25 to keep the live row inside the size contract.
**Live status stays in PROGRESS.md § Now** — this file is detail, not status. ⛔ Never quote
gate results from here; re-measure.

Governing documents: ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md)
**+ Amendments 1–4** · plan [case-printing-p3.md](../plans/case-printing-p3.md) · measured
substrate [case-printing-p3-substrate.md](../plans/case-printing-p3-substrate.md) — **read the
substrate brief before touching P3.**

## Commits

`64a83724` · `42100dd1` · `c11f9481` · `0c472b54` · `615afaf0` (backend) ·
`0bc37fb3` · `5caaaae8` · `5bc64e7e` · `d69f50f2` · `ee8aa570` (frontend). ⛔ **NOT pushed.**

## ⭐ All four amendments record a decision the approved ADR got WRONG, each found by building it

This is the reusable observation, not the individual corrections: the ADR was reviewed and
approved, and **four of its decisions did not survive contact with the schema.** Each was caught
by construction, none by review.

- **D7 had no variant carrier.** The identified/de-identified split needed somewhere to live in
  the print series; it rides `template_key` (`case` / `case_identified`). The rejected shape — a
  `templateKeyFor(options)` helper — is recorded in Amendment 1 so it is not re-proposed.
- **D5's field split was unbuildable as written.** Age, sex and unit live on the Class-1
  `patient_identifiers` table, so *both* variants must read the audited door. That makes the
  de-identified path a **bounded A7 exception** — three demographic fields, never an identifier —
  which Amendment 2 names explicitly rather than leaving implicit.
- **D13's running header printed a page contradicting its own PHI band.** Classification moved to
  the body as `Classificação declarada:`; the header carries the case number only.
- **D4's counter cannot live on `cases` at all.** `guard_case_status` freezes terminal cases, so
  the terminal freeze refuses **exactly** the writes D15 requires. Resolved with the
  `case_print_revisions` side table (Amendment 4).

## ⛔ Known scoped absence, not coverage

**Disposed-case degradation has no E2E.** `dispose_case_phi` is irreversible on whatever case it
touches, against a seed roughly 900 tests depend on. Covered by pgTAP `368` plus a committed
fingerprint only. ⚠ This is a **stated bound**, not a gap someone should close by pointing at the
pgTAP — an E2E would have to construct and destroy its own case, which nothing in the harness
currently does.

## Test surface added

- `supabase/tests/368_printed_documents_cases.sql` — 48 assertions, **every absence-assertion
  mutation-proven RED first**. Suites `344` / `313` / `229` / `356` updated; vector fixture to 34
  vectors; 4 new case fingerprints.
- `src/lib/cases/pdf-payload.test.ts` — ⛔ **provider half only.** It mocks
  `@/lib/queries/cases` wholesale, so it cannot fail for a defect inside that module. The root
  cause is covered by `src/lib/queries/case-patients-door.test.ts`, which mocks the Supabase
  client one layer lower so the real door body executes.
- `e2e/pdf-printing-cases.spec.ts` — 11 tests, serial, chromium, `--workers=1`.

## Verified by measurement, not assertion

- Gotenberg footer on a real **124-page** render (pages 1, 2, 63, 124).
- Worst-case render **1.27 s against a 30 s timeout** — ~24× headroom. Risk retired; nothing tuned.
- Patient fields **8 of 8** on the identified variant, **exactly D5's floor** on the de-identified
  one, read back through `pdftotext`.

⚠ **Matcher trap recorded during that verification:** a whitespace-sensitive needle over
`pdftotext` output of a **watermarked** page is not a valid matcher — the `RASCUNHO` watermark
perturbs glyph spacing, so `54 anos` renders as `Idade:54anos`. A `'54 anos'` needle returned
1 identified / 0 de-identified, which reads exactly like the de-identification floor being broken.

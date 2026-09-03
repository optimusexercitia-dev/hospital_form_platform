# FUP-CASE-DOCS-DEAD-READER — three surfaces render zero case documents, silently (owner: frontend + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25 during PDF·P3 while sourcing D2's document manifest. PREDATES the phase and
> was deliberately NOT fixed in it.** Found by a cross-check enumeration, verified from the code by
> `backend`, then re-verified independently by the lead before filing.
>
> `listCaseDocuments(caseId)` (`src/lib/queries/case-documents.ts:195`) delegates to `listAttachments`
> (`src/lib/queries/attachments.ts:57`), whose entire body is **`return []`** — both parameters
> underscore-prefixed as unused, under the comment *"PARKED (DM1): returns `[]` for every owner until
> Wave A"*. Its `attachments` substrate was dropped by migration `20260923000100`.
>
> **Three live consumers, none with a fallback** (measured: not one of the three files imports
> `listDocumentsForResource`):
>
> | call site | what the user sees |
> | --- | --- |
> | `src/lib/queries/case-timeline.ts:435` | the case TIMELINE shows zero documents |
> | `src/app/o/[org]/c/[commission]/casos/[caseId]/page.tsx:158` | the staff case page's documents list is empty |
> | `src/app/o/[org]/c/[commission]/manage/cases/[caseId]/(detail)/page.tsx:249` | the coordinator case DETAIL page's documents list is empty |
>
> ⚠ **The count matters and was nearly under-reported.** The first relay named only the timeline.
> "The timeline shows zero" and "three surfaces show zero" are different bugs, and the smaller
> framing is the one that gets deprioritised — a partial finding reading as a complete one.
>
> ⭐ **Why NO GATE CAN SEE THIS.** An empty array is a **legal answer at every layer**: no type error,
> no lint error, no test failure, no runtime warning. A fixture with zero case documents and a reader
> that always returns zero are **indistinguishable**. The only thing that could ever have caught it is
> a human uploading a document and noticing it never appears.
>
> **Fix:** repoint all three to `listDocumentsForResource('case', caseId)` (`src/lib/queries/documents.ts`,
> DM2), adapt the shape, then **delete `listCaseDocuments`** so the dead path cannot be re-adopted.
> ⛔ **The test must upload a document and assert it APPEARS.** A test asserting the list is
> well-formed passes against `return []` — it is the same fixture-cannot-reach-the-failing-state trap
> that hid the defect.
>
> ⚠ PDF·P3's own manifest is safe: it is built on `listDocumentsForResource`, never on the dead reader.
>
> **Owner:** `frontend` (the two pages) + `backend` (the query layer).

---

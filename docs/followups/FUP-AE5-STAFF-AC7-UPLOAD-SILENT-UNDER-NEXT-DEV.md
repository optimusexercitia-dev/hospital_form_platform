# FUP-AE5-STAFF-AC7-UPLOAD-SILENT-UNDER-NEXT-DEV

**Filed:** 2026-09-15 (unit `AE5-STAFF`, AC-10 fix loop, by the lead) · **Owner:** frontend
**Severity:** low — the production build is correct; the development server misleads a fix loop.
**Status:** open

## The finding

`e2e/phase17-documents.spec.ts` AC-7 ("each version upload lands at a NEW storage path (Rule 6)")
fails deterministically against `next dev` and passes on the production standalone build.

- Against `next dev`: three reds in three runs on 2026-09-15, two of them isolated with the dev
  server's output captured and a full Playwright trace. After the page reload and the
  "substituir por rascunho em branco" replacement, the version-2 "Enviar arquivo" click sends NO
  request. The trace holds one begin, one signed PUT and one finalize, all for version 1, and nothing
  after. The version-2 row keeps `core_document_version_id` NULL and gets no `file_objects` row, so
  `waitForVersionFile` (`e2e/helpers/documents.ts:243`) times out on `upload_state` null.
- On the production build: `e2e:prod` batch 16 on 2026-09-14 (`ok 34 … AC-7 … (4.0s)`), and a
  one-file production gate on 2026-09-15 (`GATE GREEN — 13 passed`, `ok 7 … AC-7 … (3.8s)`).

No commit on branch `ae5-staff` touches `src/lib/documents`, `src/app` or `e2e/helpers/`, so the
behaviour predates the unit. The cause is not measured. Dev-mode hydration of the upload form after
the reload, stale client state, and a dev-only timing interplay are all unproven.

## Why it matters

The Phase Gate declares green on the production build, so the gate is not wrong. But the fix loop
runs failing specs on a dev server (CLAUDE.md § 6 step 2), and AC-7 reds there for a reason unrelated
to whatever is being fixed. It cost AE5-STAFF one isolation round.

## Closes when

The cause is measured under `next dev` (the upload handler's state after the reload, read in the
browser), and either the app is fixed so AC-7 passes under `next dev`, or the spec documents the
dev-only limitation with that measurement.

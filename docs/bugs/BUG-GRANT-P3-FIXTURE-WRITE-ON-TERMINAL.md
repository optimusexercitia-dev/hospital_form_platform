---
id: BUG-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL
status: fixed
severity: high
area: e2e
opened: 2026-09-10
closed: 2026-09-10
feature: GRANT-PLANE-CONVENTION
related_adrs: [0205]
---

## Symptom

The lead's full prod E2E gate (`e2e:prod`, 21 batches, run at `9f0909d3`) reported
`e2e/pdf-printing-cases.spec.ts:618` — "completed case: the card renders, Emitir documento
mints…" — RED, taking the 10 other serial tests in the same `test.describe` block down with it
(a `beforeAll` throw aborts every test in the block).

## Expected behavior

`test.beforeAll` seats a "content reader without a PHI door" persona (`staff1.ccih@test.local`)
on two fixture cases before the corridor's 11 serial tests run, and succeeds unconditionally —
the fixture is setup, not a test in its own right.

## Actual behavior

`grantWriteAccessNoPhi` (the fixture's only grant helper at the time) called `grant_case_access`
with `p_level: 'write'` on `caseNoPhiMinterId` **after** that case had already been closed earlier
in the same `beforeAll` (the six-case `closeSpecCase` loop ran before both grant calls). The door
raised `HC0U0` — "não é possível conceder edição em um caso encerrado" — added by
`supabase/migrations/…007370` (ADR 0205 Fix 2 / D9), landed on `main` by unit
`GRANT-PLANE-CONVENTION` **before** this unit (`ADMIN-ARM-IS-ACTIVE`) branched, whose own Record
step did not run `npm run e2e:prod` and so never observed this fixture red.

## Reproduction

Fresh local stack, `caseNoPhiMinterId` closed via `close_case`, then as `chefe.ccih@test.local`:

```
POST /rest/v1/rpc/grant_case_access
{"p_case": "<caseNoPhiMinterId>", "p_user": "<staff1 uid>", "p_level": "write", ...}
```

→ `42501`-shaped door error, `errcode = 'HC0U0'`, message `não é possível conceder edição em um
caso encerrado`. Reproduced live via `pg_get_functiondef('public.grant_case_access')`: the
`p_level = 'write' and app.case_is_terminal(p_case)` guard sits after the authority/level/
membership/expiry checks and before the kernel call — exactly where the fixture's second case
(already closed) landed.

## Impact

Test-only: `e2e/pdf-printing-cases.spec.ts`'s "PDF·P3 — printing cases" corridor (11 serial
tests) could not run at all in a full `e2e:prod` gate once ADR 0205 Fix 2 shipped. No production
code path is affected — the door is refusing correctly, per design (D9); the fixture was asking
for the wrong thing.

## Investigation

Measured what printing a completed case actually needs, against the live catalog, before
touching the fixture (`ADR 0205 D9` says "READ STAYS LEGAL on a terminal case — only `write` is
refused", so `read` looked sufficient at first):

1. `mint_printed_document`'s authority gate is `app.can_view_printed_document`, whose `case` arm
   is `app.can_read_case(...) and app.can_read_full_case_content(...)` — both READ capabilities.
   A `read` grant makes both true, and does let a caller mint/download/read the dossier.
2. **But** the manage-detail ROUTE itself (`/o/[org]/c/[commission]/manage/cases/[caseId]`,
   where the "Documentos emitidos" panel lives) is gated by `canOpenCaseManagement`
   (`src/lib/queries/cases.ts`) = `staff_admin ∨ isAdministrativo ∨ canWriteContent`. For the
   plain-member persona this fixture seats, that collapses to `canWriteContent`, i.e.
   `case_access_grants.write_case_content` — a `read` grant leaves that `false` and the whole
   route 404s (`notFound()`), regardless of case status. Live-measured via
   `case_viewer_capabilities` as `staff1.ccih@test.local` on a fresh closed probe case with a
   `read` grant: `{"can_write_content": false}`; reproduced 3/3 in isolated Playwright runs.
3. `write_case_content` is a static column on `case_access_grants`, set once at grant time and
   never revisited by a later `close_case` call. Live-measured: grant `write` on an OPEN probe
   case, close it, re-probe `case_viewer_capabilities` as the grantee — still
   `can_write_content: true`. So the HC0U0 refusal is purely about the case's state **at grant
   time**, not about what the resulting grant is later allowed to do.

Both facts together mean `write` is the correct, load-bearing level for this fixture's callers,
and the fix is ordering, not level.

## Root cause

The fixture granted access to `caseNoPhiMinterId` **after** closing it, inside one `beforeAll`.
`grant_case_access`'s HC0U0 guard (D9) checks `app.case_is_terminal(p_case)` at call time, so any
grant issued post-closure at `write` level hits it — this was simply the first case in the file
to combine "closed before the grant" with "grant level write".

## Fix

`e2e/pdf-printing-cases.spec.ts`: reordered `beforeAll` so `grantWriteAccessNoPhi(...,
caseNoPhiMinterId, ...)` runs **before** the `closeSpecCase` loop, not after. No other case in the
file needed reordering (`caseOpenId` never closes, so its grant call was never at risk). Level
stays `write` for both callers — confirmed necessary, not incidental — with the docblock now
recording both live measurements above so a future edit does not "simplify" it back to `read`.

## Regression protection

* `e2e/pdf-printing-cases.spec.ts`'s own `beforeAll` — if the ordering regresses, the fixture
  itself throws (`grant_case_access(...) failed`) and every test in the corridor reds loudly,
  rather than one test failing for an unrelated reason.
* Re-run twice, `--project=chromium --workers=1`, full file: `38 passed` both times (paired with
  the `phase13-audit.spec.ts` AC-3f-platform rewrite in the same run — see
  `docs/progress/admin-arm-is-active.md` § Session log, 2026-09-10 tester entry).

## Related code

* `e2e/pdf-printing-cases.spec.ts` (`grantWriteAccessNoPhi`, `beforeAll`)
* `supabase/migrations/20261003007370_*.sql` (ADR 0205 Fix 2 / D9, `HC0U0`)
* `public.grant_case_access`, `app.can_view_printed_document`, `app.can_read_full_case_content`,
  `src/lib/queries/cases.ts` (`canOpenCaseManagement`, `case_viewer_capabilities`)

## Lesson

A door tightening that lands without its full `e2e:prod` gate leaves its blast radius unmeasured
— the fixture that tripped here was written against the door's PREVIOUS shape and nothing forced
a re-check. Separately: "the door refuses `write` on a terminal case" and "the caller needs
`write`" are not in tension — the resolution is WHEN to ask, not WHICH level to ask for.

## Resolution

Fixed 2026-09-10 (tester, unit `ADMIN-ARM-IS-ACTIVE`, branch `authz-admin-arm-is-active`) by
reordering the fixture's `beforeAll`. Verified: `npx playwright test
e2e/pdf-printing-cases.spec.ts e2e/phase13-audit.spec.ts --project=chromium --workers=1` — `38
passed` on two consecutive runs. Spec-only change; no application code, migration, or query
touched.

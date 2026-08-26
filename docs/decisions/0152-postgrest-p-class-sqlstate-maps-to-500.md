# ADR 0152 — PostgREST maps the `P0*` SQLSTATE class to HTTP 500; the document-corridor 500 is a 73-function class, not a door defect

- **Status:** ACCEPTED 2026-08-26 (PO ruling, during the AFF4 pre-step).
- **Amends:** 0151 (D16a — re-scopes AFF4 pre-step P1 from *fix* to *diagnose + re-file*).
- **Related:** 0135 (authored refusals get their own `HC***`; `42501` reserved) — this ADR extends
  0135's reasoning one SQLSTATE over, and is deliberately **not** built here.

## Context

`FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` was filed 2026-08-25 with **"Root cause NOT
identified"** and a best remaining lead of *"PostgREST's media-type handling of this function's `jsonb`
return"*. ADR 0151 D16a scheduled the fix into AFF4's pre-step. The root cause is now identified, and
**three of the follow-up's load-bearing claims are false.** They are corrected here rather than in the
register alone, because each was quoted onward.

### The measurement (2026-08-26, local stack, PostgREST v14.5, bare `curl` through Kong)

A scratch `public` function raising a parameterized `errcode`, called as an authenticated persona, then
dropped. The status is a pure function of the SQLSTATE:

| SQLSTATE | HTTP | SQLSTATE | HTTP |
| --- | --- | --- | --- |
| `P0001` | **400** | `42501` | **403** |
| `P0002` | **500** | `28000` | **403** |
| `P0003` | **500** | `23514` / `22023` | **400** |
| `HC000` / `HC0D8` / `HCDS5` | **400** | `42883` | **404** |
| `PT400` / `PT403` / `PT404` | **400 / 403 / 404** | | |

So: **PostgREST maps the `P0*` class to 500, with `P0001` the single exception.** Every response
carried `Content-Type: application/json` and a well-formed body with the accented pt-BR message intact.

### What this refutes

1. **"HTTP 500 `text/plain` 'Something went wrong'"** — does **not** reproduce, under any `Accept`
   header (`<none>`, `*/*`, `application/json`, `application/vnd.pgrst.object+json`; `text/plain`
   yields 406). The body is always well-formed JSON. The same description sits in four `e2e/` comments
   attributing it to "PostgREST v14.5 for P-class raises"; those comments are wrong about the body and
   right only about the status.
2. **"So it is *every raise*, not a P-class quirk"** — exactly inverted. It **is** a P-class quirk.
   Measured end-to-end through the real door: a version the caller may not serve raises `HC0D8` and
   returns **400** `{"code":"HC0D8","message":"arquivo ainda não disponível"}`; only the two `P0002`
   raises return 500. The follow-up's own two-row symptom table has one correct row and one false one.
3. **"APP-FACING — a denied/missing open shows a raw 500 instead of pt-BR"** — the app maps on
   `error.code`, not on status: `mapDocumentErrorCode` (`src/lib/documents/errors.ts`) already carries
   `P0002 → not_found` and `HC0D8 → unavailable`, and supabase-js surfaces the JSON body on a 500. No
   raw Postgres string reaches the UI, so **§8 is not violated**. This was the stated merit for keeping
   the item in the pre-step at all (the 2026-08-25 re-scope), and it does not hold.

The residual defect is real but smaller than recorded: **an ordinary authorization denial answers 5xx.**
That costs observability (denials are indistinguishable from server faults in logs and alerts) and it
forced the defensive `[403, 404, 500].includes(status)` oracle in the E2E specs — an assertion that
cannot tell a denial from a crash.

### The class

The two `P0002` raises live in `app.resolve_document_version_bytes`, shared by `open_document_version`
and `open_printed_document`, where denial is deliberately **byte-identical to absence** (oracle-kill).
Measured from the live catalog (comments stripped before the regex): **80 `app`/`public` functions raise
a P-class code other than `P0001`; 73 of them are in `public` and hold EXECUTE for `authenticated`.**
The document corridor is **2 of 73**.

## Decision

- **D1 — AFF4 pre-step P1 closes as *diagnosed and re-scoped*, not as *fixed*.** ADR 0151 D16a's "fix
  it in the pre-step" is retired. The premise that put it there is refuted (see 3 above), and the
  pre-step is specified as *small fix commits on `main`*.
- **D2 — the real defect is re-filed as a class**, `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL`, sized
  at 73 reachable functions, for its own increment.
- **D3 — no partial fix.** Converting only the document corridor would leave 71 siblings answering 500
  and make denial semantics inconsistent across the app — a worse state than the uniform one, and the
  recorded *"a partial fix reads as a complete one"* shape.
- **D4 — `P0002` is not an authored-refusal code.** ADR 0135 reserves `42501` for *refusals the code did
  not author*; borrowing stock `P0002` for an authored refusal is the same mistake one SQLSTATE over.
  When the class is built, authored not-found/denied refusals take an `HC***` code, preserving the
  oracle-kill by keeping the denial and absence raises byte-identical to each other.

## Consequences

- The follow-up body and its PROGRESS.md index line are corrected in the same edit that files D2's item;
  the four `e2e/` comments describing a `text/plain` body are left for the class increment to correct
  alongside the assertions they guard (a spec edit is tester-owned, §6 step 2).
- ⚠ **The macOS "6 gate failures" attribution remains unexplained, not resolved.** P4's merged-tree run
  exercised the seven document-touching specs on Windows prod-standalone at `3894c667` — 81 tests, 0
  failures — and this ADR shows the app maps the code correctly. Neither is evidence about the macOS
  run. One platform's silence is not a bound on the other's defect; the class item carries the question.
- ⛔ **Do not "fix" a P-class 500 by widening a grant or by catching and re-raising as `P0001`.** The
  first is the recorded anti-pattern; the second buys a 400 while discarding the code the app maps on.

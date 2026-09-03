# FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL — an ordinary authorization denial answers 5xx, across 73 reachable doors (owner: backend; filed 2026-08-26, measured during the AFF4 pre-step)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-26 · status open

Re-filed from [[FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE]] (archived the same day), whose diagnosis
was wrong in three places. Authority: ADR
[0152](../decisions/0152-postgrest-p-class-sqlstate-maps-to-500.md).

**The mechanism, measured** — a scratch `public` function raising a parameterized `errcode`, installed,
called as an authenticated persona through Kong, then dropped. The HTTP status is a **pure function of
the SQLSTATE**:

| SQLSTATE | HTTP | SQLSTATE | HTTP |
| --- | --- | --- | --- |
| `P0001` | 400 | `42501` | 403 |
| `P0002` / `P0003` | **500** | `28000` | 403 |
| `HC000` / `HC0D8` / `HCDS5` | 400 | `23514` / `22023` | 400 |
| `PT400` / `PT403` / `PT404` | 400 / 403 / 404 | `42883` | 404 |

**PostgREST v14.5 maps the `P0*` class to 500, `P0001` excepted.** Nothing about media types, `jsonb`
returns, encoding, or the schema cache is involved — each of those was excluded by measurement.

**Size, from the live catalog** (comments stripped before the regex — a line-filtered `prosrc` under-
reports multiline guards): **80** `app`/`public` functions raise a P-class code other than `P0001`;
**73** of them are in `public` and hold EXECUTE for `authenticated`. The document byte corridor
(`open_document_version` / `open_printed_document`, both through `app.resolve_document_version_bytes`)
is **2 of 73** — it is where the class was found, not the extent of it.

**Why it matters, stated honestly.** It is **not** a §8 violation: the app maps on `error.code`, the
JSON body arrives intact on a 500, and `mapDocumentErrorCode` already carries `P0002 → not_found`. The
real costs are (a) **observability** — an ordinary denial is indistinguishable from a server fault in
logs and alerts; and (b) **the oracle it forced**: E2E specs assert `[403, 404, 500].includes(status)`,
which cannot tell a denial from a crash. Four `e2e/` comments also describe a `text/plain
"Something went wrong"` body that does not reproduce under any `Accept` header; they should be corrected
alongside the assertions they guard.

⛔ **No partial fix** (ADR 0152 D3). Converting only the document corridor leaves 71 siblings answering
500 and makes denial semantics inconsistent across the app — the recorded *a partial fix reads as a
complete one* shape, and worse than the uniform state it would replace.

⛔ **Two non-fixes.** Do not widen a grant to change the status (the standing anti-pattern), and do not
catch-and-re-raise as `P0001`: it buys a 400 while discarding the code the app maps on.

**Shape when built** (ADR 0152 D4): `P0002`-as-authored-refusal is the same mistake as `42501`, one
SQLSTATE over — ADR [0135](../decisions/0135-authored-refusals-get-their-own-sqlstate.md) reserves
`42501` for refusals *the code did not author*. Authored not-found/denied refusals take an `HC***` code,
and the **oracle-kill must survive**: the denial raise and the absence raise stay byte-identical to each
other, or the conversion hands back the existence oracle those two raises exist to destroy. Sizing note
from 0135: **the test surface is the dominant cost, not the doors** — re-derive it, do not quote it.

⚠ **Open, and not answered by this item:** the macOS "6 gate failures" attribution inherited from the
archived item. P4's merged-tree run exercised the seven document-touching specs on Windows
prod-standalone at `3894c667` (81 tests, 0 failures), and this diagnosis shows the app maps the code
correctly — neither is evidence about the macOS run. See [[FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS]].

---

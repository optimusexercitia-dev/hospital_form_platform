# ADR 0018 — Custom SQLSTATE class `HC0xx` (was `P00xx`)

**Status:** Accepted (2026-06-13) · **Phase:** 7 (fix for bug P7-002) · **Relates:**
[0004](0004-signoff-feature-flag.md), [0015](0015-response-fill-rpcs.md),
[0016](0016-signoff-definer-read-path.md), [0017](0017-multi-phase-cases.md)

## Context

Our RPCs raise discriminated, app-defined errors (`already submitted`, `missing
required`, `missing sign-off`, the multi-phase guards, …) with a custom SQLSTATE so the
data layer can map each to a specific pt-BR message. Phases 1–6 used the `P00xx`
user-defined class (`P0010`–`P0015`); Phase 7 added `P0016`–`P0022`.

Bug **P7-002** (tester, 2026-06-13): after the local stack bumped to **PostgREST 14.5**,
those specific messages stopped reaching the UI — every custom rejection showed the
generic "Não foi possível concluir." Root-caused via HTTP probes to the **intersection of
two conditions**:

1. **PostgREST 14 maps the user-defined SQLSTATE class `P0002`–`P0999` to HTTP 500**
   (only `P0001` is special-cased to 400). All of `P0010`–`P0022` fall in the 500 range.
2. On a **500**, when the error **message contains non-ASCII UTF-8** (our accented pt-BR),
   PostgREST 14.5 **drops the JSON body** and returns `text/plain` "Something went wrong".

Proof: the *same* `P0011` raise returns a JSON 500 (`{code,message}`, extractable) with an
ASCII message but `text/plain` with an accented one; at 4xx (`P0001`, `23514`) accented
messages serialize as JSON fine. With no JSON body, supabase-js can't read `error.code`,
so `switch (error.code)` falls through to the generic case.

## Decision

Renumber the **custom codes only**, `P0010`–`P0022` → **`HC0xx`** (`HC010`–`HC022`,
"Hospital Commission"). PostgREST maps an **unknown** SQLSTATE class to **HTTP 400 with the
JSON `{code,message}` body preserved**, even for non-ASCII messages — verified end-to-end
(`HC011` → 400 JSON → `error.code` → specific pt-BR). The standard codes are **unchanged**:
`P0002` (`no_data_found` → 404), `23505`, `23514`, `42501` already surface correctly.

Three layers move together (migration `20260613090009` re-states the committed Phase 5/6
functions verbatim except the errcode; the unshipped Phase-7 migrations `090005`/`090006`
are edited in place; the action constants and every pgTAP `throws_ok` expectation are
renumbered).

### Why not the alternatives

- **Keep `P00xx`, raise ASCII-only messages:** fragile and ugly — forces stripping accents
  from human pt-BR text; the message is meant to be readable.
- **`PTxyz` custom-HTTP codes:** PostgREST encodes the HTTP status into the code (`PT` + 3
  digits), so distinct errors sharing a status can't be told apart by `error.code`. `HC0xx`
  keeps a stable, distinct code per error.

## Consequences

- The data layer keeps a clean `code → pt-BR` map; raw PG text never reaches the UI
  (CLAUDE.md §8). DB messages stay human pt-BR (used only as a fallback).
- **Version-agnostic, no config pinning.** `HC0xx` → 400/JSON holds on PostgREST 12/13/14.
  Production sits behind Cloudflare (its PostgREST version isn't observable); if Cloud is
  still ≤13 the old codes worked but would have regressed on the next platform upgrade — the
  `HC0xx` fix is correct either way, and worst case prod keeps today's behaviour with **no
  regression**. So we do not pin a PostgREST version we don't control on Cloud.
- Any future edit to `submit_response` / `save_section_answers` / `sign_section` must land
  in a migration **after** `…090009` (which is now their latest definition).

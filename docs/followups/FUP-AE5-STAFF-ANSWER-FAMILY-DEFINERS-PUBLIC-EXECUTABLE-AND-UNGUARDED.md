# FUP-AE5-STAFF-ANSWER-FAMILY-DEFINERS-PUBLIC-EXECUTABLE-AND-UNGUARDED

**Filed:** 2026-09-15 (unit `AE5-STAFF`, F1 adversarial re-review candidate PRE-4, reproduced and bounded by the lead) · **Owner:** backend
**Severity:** medium — **not a live exposure**. It is defence in depth: an unguarded, PUBLIC-executable DEFINER that returns form answers by id, reachable today only by direct SQL, because both API-exposed callers guard.
**Status:** open

## The finding

`app.answer_map(uuid)` is `SECURITY DEFINER`, executable by PUBLIC (`proacl` includes `=X/postgres`), and checks nothing about
the caller. `authenticated` holds USAGE on `app`; `anon` does not. Its siblings `answer_map_scoped`, `instance_answer_map`,
`matrix_cells_by_item`, `risk_matrix_by_item`, `references_by_item` and `response_validation_errors` are DEFINER with a NULL
`proacl`, which is the PUBLIC default. The re-review counted 91 PUBLIC-executable `app`/`authz` functions that take
arguments, 54 of them DEFINER.

## Measured by the lead on `main`'s catalog (fresh reset, 0 peers, read-only)

1. **Direct call.** As staff1.qual.b (Rede B, `staff`): `public.responses` shows 0 rows and `public.answers` 0 rows for
   Rede A response `28228b83-…`. `app.answer_map` on that id returned a 6-key, 200-byte object, identical in size to the
   `postgres` result. Values were not printed.
2. **The API-exposed callers guard.** Fixture `e0000000-…-e1` is in progress with 1 pending staff sign-off, so it passes
   `get_response_for_signoff`'s earlier status and pending guards.
   - **Positive control:** the commission's `staff_admin` (`…05`) received the payload (1 137 bytes, 3 answer keys).
   - **Subject:** staff1.qual.b was REFUSED, `P0002` "resposta … não encontrada", by the caller check
     (`is_staff_admin_of` / `member_can('view_signoffs')`).
   - **`public.get_response_validation_errors`:** it is INVOKER and returns early when `responses` is invisible under
     the caller's RLS. staff1.qual.b sees 0 rows, so it returned 0. **Bound:** no seeded Rede A response has validation
     errors, so no positive control exists for this door. The early return is shown by its body plus the 0-row
     visibility.
   - A first probe on a `submitted` response was VOID for the sign-off door: its status guard fired before the caller
     check.

## Closes when

The answer-family functions can no longer return another principal's answers to an arbitrary `authenticated` caller:
- either EXECUTE is revoked from PUBLIC and `authenticated` (the DEFINER callers run as the owner and keep working, as
  measured for a similar revoke in the PRIVILEGE-SURFACE unit);
- or each function gains a guard equivalent to its callers'.

Each change must be proven by a pgTAP cell in which a foreign-org `authenticated` caller is refused on a direct call.
The two exposed callers must stay green, with a positive control. The 91-function class is re-counted and its hardening
scoped in the same unit, or filed separately with its count.

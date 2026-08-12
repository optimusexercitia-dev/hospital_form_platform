# ADR 0111 — Printed-document doors return the granted-column composite (FUP-PDF-3)

**Status:** Accepted · 2026-08-12 · **Owner:** backend · **Migration:** `20260921000100`

`mint_printed_document` / `revoke_printed_document` returned `printed_documents` (the full row
type), so a **direct PostgREST caller** received the four columns deliberately excluded from the
authenticated column-list SELECT GRANT: `verification_token` (**the real widening** — the
public-verification credential), `storage_path` (derivable from granted columns; defense-in-depth,
Note C), `revoked_by`, `revoked_reason`.

**Decision:** both doors now `RETURNS public.printed_document_public` — a named composite whose
fields are **exactly** the granted column list, projected **by name** via `jsonb_populate_record`
(field order can never mis-map). Chosen over `RETURNS TABLE` (set-returning → an ARRAY over
PostgREST, breaking the single-object server-action contract) and over ad-hoc per-door lists (one
shared type = one place a future column joins, forcing the pairing with its own column GRANT — the
`profiles`/`case_referral` column-grant rule). Product impact: none — the mint action supplies the
credentials itself and reads only summary columns; the revoke caller ignores the returned row.

The return-type change forced **DROP+CREATE**; ACL (`postgres/service_role/authenticated` EXECUTE,
none for PUBLIC), `SECURITY DEFINER`, and `search_path` were re-stated, diffed before/after **from
the catalog** (only `returns` changed), and pinned by pgTAP `323` t10–t13. Keystones t2–t5/t7–t8
observed red-first.

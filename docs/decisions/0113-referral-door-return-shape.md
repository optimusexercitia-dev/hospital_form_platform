# ADR 0113 — Referral-module door RETURN shape: the class, not the instance

**Status:** Accepted (2026-08-12) · **Extends:** ADR
[0111](./0111-printed-document-door-return-shape.md) · **Closes:** BUG-REFNOTE-001 ·
**Rules:** ARCHITECTURE.md Rule 1 (RLS is the boundary), Rule 11 (auditability),
Rule 12 (PHI).

## Context

BUG-REFNOTE-001 was filed as four `referral_internal_notes` mutator doors
(`assign`/`conclude`/`unassign`/`redact`) that `RETURNS referral_internal_notes` — the
full row — and therefore handed back `body_md`, the one column of 17 deliberately
withheld from the `authenticated` column-list SELECT GRANT by the K-R5-2 hardening. The
row-type return re-opened exactly what the GRANT closed. Proven live: a plain `staff`
member read `SEGREDO-CLINICO-XYZ` through `conclude_referral_internal_note` in the same
transaction, role and hat in which a direct `select body_md` refused with `42501`.

Two days earlier ADR 0111 had fixed the identical shape on the two printed-document
doors, and the bug report itself noted "the class is not confined to one module". A
catalog sweep for the general property — *a `public` DEFINER whose `RETURNS` is a table
row type where that table's `authenticated` GRANT is a column list* — returned **23
doors on three tables**, not four on one:

| table | withheld from `authenticated` | doors |
| --- | --- | --- |
| `case_referral` | `description_md`, `decline_note`, 3× `phi_disposed_*` | **15** |
| `referral_internal_notes` | `body_md` | 6 |
| `referral_messages` | `body` | 2 |

The 15 `case_referral` doors were **not in the filed report and are the larger half**:
every one of `send`/`accept`/`decline`/`resolve`/`conclude`/… returned the referral's
narrative `description_md` past a GRANT whose purpose is to force that read through
`get_referral_detail`, which gates **and** calls `log_audit_access`.

## Decision

1. **The unit of repair is the class, not the instance.** Fixing the four filed doors
   would have left 19 of identical shape open. This repo has recorded that failure twice
   ("BUG-ACT-ACL-1 closed one instance, not the population"); the enumeration is derived
   from the catalog by the *property*, so it cannot be short by a door someone forgot.
2. **Return shape = a NAMED COMPOSITE per table mirroring its GRANT exactly**
   (`case_referral_public`, `referral_internal_note_public`, `referral_message_public`),
   projected by an `app._project_*` helper through `jsonb_populate_record` **BY NAME**.
   Adopted from ADR 0111 for its reasons, plus one this scale makes decisive: the
   composite is an **allowlist**, so a future ungranted column is withheld by default
   rather than leaked by default. `RETURNS TABLE` was rejected — it makes the doors
   set-returning (an ARRAY over PostgREST) and breaks the single-object contract the
   server actions read.
3. **The GRANT stays the single authority.** A new column joins a composite only when it
   also receives its own column GRANT. pgTAP 326 t1–t3 pin composite ≡ GRANT as ordered
   name arrays, so drift in either direction reds.
4. **Rule 11's two halves are separate obligations and both were resolved explicitly.**
   The READ obligation is **discharged by removal** — after the narrowing no withheld
   column is served on these paths, so there is no read left to log; adding an audit arm
   instead would log a read that should not be happening. The MUTATION obligation
   already held, verified in the live catalog rather than from body comments:
   `trg_audit_referral_aiud` on `case_referral`, and direct `app.audit_write` calls in
   the 8 note/message doors.

## Consequences

- A composite cannot carry NOT NULL, so the generated TS types widen to `T | null`. One
  call site (`createReferralDraft`) coerces; this is the honest cost of the shape.
- The change is DROP+CREATE (a return type cannot change under `CREATE OR REPLACE`) —
  the shape that silently loses ACLs. All 23 re-state SECURITY DEFINER, the pinned
  `search_path`, and the ACL; pgTAP 326 t10–t13 pin the property diff with the
  population fixed at 23 so a dropped-and-not-recreated door cannot pass vacuously. That
  control earned itself during the red-first run: it caught an unintended `anon` EXECUTE
  grant in the *un-fix harness's own* rebuild.
- **The generalization worth carrying forward:** a column-list GRANT and a function
  return type are two statements of the same policy, and nothing in Postgres keeps them
  agreeing. Any door returning `<table>` on a table with a column-list GRANT is this bug.
  The standing check is the composite ≡ GRANT keystone, per table, not vigilance.

# ADR 0102 — `p_expires_at` is a real setter on both grant paths (extend-on-regrant)

- **Status:** Accepted (2026-08-07) · **Scope:** QO·FUP F1 · closes **FUP-QO-1**
- **Amends:** ADR 0100 **D9** (the expiry seam) · **Migration:** `20260912000000`
- **PO ruling:** D-FUP-1 (2026-08-07) · **Consumer:** ADR 0100 **D14** break-glass

## Context

ADR 0100 D9 added the `p_expires_at` argument to the grant chain but left two seam
limits, deliberately deferred and pinned executably in pgTAP `306` §4:

1. an identical re-grant with a new expiry hit the **targeted** `on conflict … do
   nothing` and changed nothing;
2. the commission-tier **atomic-replace** UPDATE ignored the argument entirely, so a
   role change carried the OLD window forward.

Break-glass (D14) rides this exact seam, so the PO ruled both closed now rather than
having D14 inherit them.

## Decision

1. **Both paths write the expiry.** The INSERT path becomes `do update set expires_at
   = coalesce(excluded.expires_at, memberships.expires_at)`; the atomic replace adds
   `expires_at = coalesce(p_expires_at, expires_at)`. The value is **absolute, not a
   ratchet** — a shorter argument shortens, which break-glass needs to close a window
   early.
2. **`p_expires_at IS NULL` means LEAVE UNCHANGED on an existing row** (and PERMANENT
   on a new one). Decided by a caller sweep, not by symmetry: **no production caller
   passes the argument.** Under "NULL clears", every ordinary member-add and promotion
   would have silently stripped a deliberately-set expiry: a **privilege widening**
   shipped by a change whose purpose is the opposite.

   ⚠ **The recorded sweep was RE-CUT 2026-08-07 (QA R2).** It originally read "all three
   production callers" and named `admin/actions.ts:285`, `members/actions.ts:235`,
   `org/actions.ts:618` — a `rpc('grant_role'` grep, i.e. a boundary drawn by **syntax**,
   which missed the `_for` twin entirely. The correct boundary is the **property "reaches
   `app.grant_role_impl`"**:
   - **3 public doors** call the kernel: `grant_role`, `grant_role_for`,
     `appoint_technical_director`.
   - **5 further SQL functions** reach it through those: `add_pqs_member`,
     `assign_org_admin`, `assign_hospital_admin`, `assign_nsp_org_admin`,
     `assign_nsp_coordinator`.
   - **9 TS RPC sites**: `admin/actions.ts:285` · `members/actions.ts:235` ·
     `org/actions.ts:581` + `:618` · `platform/actions.ts:210` + `:247` ·
     `pqs/actions.ts:65` · `users/actions.ts:714` + `:949`.

   **None of the 9 passes `p_expires_at`**, so the ruling survives — on a population three
   times the size of the one it was decided on, and now including the two
   platform-provisioning sites, which would have been the worst place to clear an expiry
   silently. (The migration header names only the original three; read this list, not
   that one.) Same recorded class as F2's error-code detector and the case-sensitive diff
   grep: **an enumeration's boundary must be the property, not a syntax.** "Make permanent" stays revoke + re-grant (DELETE +
   INSERT, both audited). No `p_clear_expiry` flag now — that would be a declared
   parameter no caller passes.
3. **Expiry only.** `granted_by` / `granted_at` / `title_id` are untouched on an
   identical re-grant, so a re-grant is an expiry operation and nothing else.
4. **The conflict target stays targeted.** `memberships` carries three other unique
   indexes; a bare `on conflict do update` would absorb them and turn a refusal into a
   silent overwrite. `memberships_grant_uq` is `NULLS NOT DISTINCT` (catalog-verified),
   which is what makes the targeted clause fire on the NULL scope columns at all.
5. **Rule 11 companion (not scope creep).** `app.trg_audit_memberships`'s UPDATE branch
   is if/**elsif** and `role_changed` **wins**. Harmless before this change, because the
   replace path never touched `expires_at`. Now it does — so unamended, the replace
   would move a security control while the only audit row said "role changed" and
   carried no diff. `role_changed` now carries `expires_at_before`/`expires_at_after`
   **when and only when** the expiry also moved. Metadata only: no new verb, no payload,
   no PHI, same row count per operation.

## Consequences

- **`292` §2.1's singleton survives unrecut** — both writes are inside
  `app.grant_role_impl`; re-verified post-migration, the `string_agg` still reads exactly
  `app.grant_role_impl`. **§2.2 was honestly recut**: the sanctioned door now matches the
  `set expires_at` half too, so the positive twin asserts the **named set**
  (`app._t292_expiry_writer, app.grant_role_impl`) rather than `count = 1` — a count of 2
  would also be satisfied by an unrelated third writer.
- `306` §4 recut to the new contract and extended from 37 to 45 assertions; the six new
  or flipped keystones were **observed RED before the migration** (6 of 43, all 43 ran).
  Falsifiability is carried by `supabase/tests/mutation/f1-expiry-seam-audit.sh` — **6/6
  RED-PROVEN**, control green. Three of its six cases (`ratchet`,
  `drop_insert_coalesce`, `drop_replace_coalesce`) leave the headline assertions green,
  which is the point: without them the NULL semantics and the not-a-ratchet property
  would be unpinned.
- `create or replace` on an unchanged signature, so ACL / owner / `proconfig` /
  `prosecdef` / volatility are preserved by construction. BEFORE and AFTER catalog
  snapshots are identical property-for-property.
- ⛔ **CORRECTION 2026-08-07 (QA R1). This bullet said the opposite and was wrong.**
  It claimed `app._grant_case_access_unchecked`'s `do update` list "omits `expires_at`",
  i.e. that the sibling PHI door still carried the seam limit this ADR removes. The live
  catalog says its list **ENDS with `expires_at = excluded.expires_at` — uncoalesced.**
  That door **already extends on re-grant, and NULL-CLEARS** — precisely the
  silent-privilege-widening shape §2 above refused for the role door, on a door that
  carries `read_standard_phi` / `read_restricted_phi`, and it is UI-reachable
  (`case-access/actions.ts:181` sends `expiry ?? undefined`).
  **How the error was made, because the mechanism is the reusable part:** the probe was
  `substring(prosrc from position('on conflict' in prosrc) for 600)`. The list is longer
  than 600 characters and `expires_at` sat just past the cut. **A fixed-width
  `substring(… for N)` is a WINDOW, not a delimiter — the absence of a token inside it is
  not absence.** The window's edge was read as the statement's end, and the conclusion
  inverted: a live widening got recorded as a missing capability, which would have
  pointed FUP-QO-7's owner at *adding* something the door already does.
  `306` 4.4's comment ("mirrors `grant_case_access` verbatim") refers to the **past-expiry
  refusal** and remains true; only this bullet's gloss about the re-grant was wrong.
  **The case door is NOT changed here** — whether NULL-clearing is a defect there is a
  PRODUCT question (an admin re-granting with a blank expiry may legitimately mean
  "permanent"), and it needs its own caller sweep plus a PO ruling. **FUP-QO-7**, re-scoped
  and re-graded PHI-grade.

# QA Review — ADR 0078 Stage B · `case_access → case_access_grants` hard cut (B1→B5)

**Reviewer:** `qa` · **Date:** 2026-07-16 · **Migration:**
`supabase/migrations/20260802000000_authz_b_case_access_grants_hard_cut.sql`
**Keystones:** `supabase/tests/238_authz_b_case_access_grants.sql` (33) ·
`supabase/tests/mutation/b-mutation-audit.sh` (8)

## Verdict: ✅ APPROVED

**0 P0 · 0 major · 2 minor · 1 info.** Every security invariant claimed for Stage B was
reproduced independently from the **live catalog** and under **`set local role
authenticated` via the real doors** (not predicate return values, not the author's
fixtures). The intended semantic change — defect ①·2 PHI closure — was proven at the
**byte level** through the real `get_case_patient` PHI door in both directions. The
keystones were shown non-vacuous by reverting each fix and requiring RED. The four
pre-approved deviations are sound. The two minors and one info are hygiene items that do
not gate the security spine.

Methodology honored: catalog is truth (graphify/file-text not trusted for SQL); every
`prosrc` match comment/literal-disambiguated; assertions run as `authenticated`, not only
as `postgres`; every green keystone mutation-tested; every probe run where it MUST move.

---

## What I ran (fresh `supabase db reset --local`, migration + seed applied)

| Probe | Result |
|---|---|
| Catalog cut | `case_access` **DROPPED**, `case_access_grants` **live**, flag row **gone**, `public.case_access_enabled()` + `app.assert_case_access_enabled()` **gone** |
| Dangling-relation sweep (comment+literal stripped, `\y`-free prefix) | **0** functions reference the dropped **relation**. The 3 `prosrc` hits (`_cap_bit`, `case_capabilities`, `trg_audit_case_access`) are **string literals** — the `manage_case_access` capability name and the `'case_access'` audit action — verified by regclass-anchored FROM/JOIN/UPDATE sweep returning empty |
| Resolver | `_case_caps` reads `case_access_grants`, **0** surviving `feature_enabled('case_access')` gate anywhere in `app`/`public` |
| pgTAP 238 | **33/33**, 0 diagnostics |
| b-mutation-audit | **8/8 RED-PROVEN**, control GREEN (harness can read a pass) |
| a2 / u1 / u2 mutation audits (repointed) | **54 / 21 / 47 keystones**, all RED-PROVEN, controls green |

---

## Skeptic battery — the review's core (all under `authenticated`)

**1. Defect ①·2 closure — proven BOTH ways at the byte level via the real PHI door.**
Fixture: PHI-bearing `commission_default` case, patient set through the real
`set_participant_patient` coordinator door.
- Plain **read** grant → `can_read_case = t`, and `get_case_patient()` returns
  **`<NULL>`** (MRN not disclosed, no audit row). PHI denied.
- Grant with **`p_read_standard_phi = true`** → `get_case_patient()->>'mrn'` returns
  **`MRN-Q`**. PHI conferred iff the column is set.
- **Write** grant → `can_write_case_content = t`, `can_read_case = t`, but
  `can_read_case_patient = f` and the stored `read_standard_phi = f`. **Write ⇏ PHI
  (A16, disjoint chains).**

  > Note for the record: my first pass asserted on whether `get_case_patient` *raised*.
  > It does not — `get_participant_patient` returns **NULL** out-of-scope (`if not
  > app.can_read_case_patient(...) then return null`). Re-run capturing the **value**
  > (§7.2: never an error code / return-vs-raise). The value is empty. No leak.

**2. Direct-DML exploit (BUG-SUP-002) + own-row SELECT judgement.**
As `authenticated`: raw `INSERT` / `UPDATE (self-escalate read_standard_phi)` / `DELETE`
on `case_access_grants` **all denied `42501`** (no DML privilege + no write policy — table
ACL grants `SELECT` only; the single policy is `select_own`, cmd `r`). The **own-row
SELECT is not a leak**: with two grants on the case, principal `st_x` sees **1 row, its
own only** (`all_own = true`). It discloses to a principal only *their own* grant metadata
(capabilities they already hold, `granted_by`, `reason_code`, expiry) — never another
principal's row, never case content, never PHI. **Ruled benign** — and it is load-bearing
(a no-grant `select count(*)` would `42501` and break the wall/roster/sweep patterns).

**3. Source unreachability.** Only `manual_grant` is producible — the writer
(`_grant_case_access_unchecked`) hard-codes it, the door exposes no `source` parameter,
and after exercising the doors `bool_and(source='manual_grant') = t`. The three RESERVED
sources have no writer.

**4. Exclusion + org-admin arm + coordinator bootstrap.**
- Recused coordinator → `grant_case_access` raises **`HC0F1`** (authority holds first, so
  the failure is exclusion not authority). `revoke`/`list` gated identically.
- **B6 deadlock arm is safe by construction:** the org-admin (not a member) grants to a
  **member** → succeeds (stamped `org_admin_deadlock_exit`); to a **non-member** →
  `HC021`; to **self** (not a member) → `HC021`. **No self-escalation.**
- **Coordinator bootstrap (D5·6):** coordinator holds `read_restricted_phi = false`, yet
  issues it; grantee ends with `read_restricted_phi = t` and `read_standard_phi = t`
  (lattice). Issue-without-holding works for restricted PHI only.

**5. REVOKE ALL … FROM PUBLIC before GRANT.** `grant_case_access`, `revoke_case_access`,
`list_case_access` and `reclassify_attachment` all carry `SECURITY DEFINER` and a
`proacl` with **no PUBLIC entry** (only `postgres`/`service_role`/`authenticated`) — the
t19-class guard holds. `_grant_case_access_unchecked` is INVOKER, PUBLIC-revoked, not
granted to `authenticated`.

**6. Re-emit-from-live-def trap avoided.** The U2 exclusion-perimeter mutation audit is
**13/13 RED-PROVEN** — including the four narrative RPCs (`assign`/`conclude`/`reopen`/
`unassign`) that Stage B create-or-replaced. Had they been re-emitted off stale migration
text, their Unit-2 exclusion guards would have silently reverted and U2 would go GREEN.
They did not. No function references the dropped `case_access` relation.

**7. B3 fence.** `reclassify_attachment` rejects **`legal_privileged`** and
**`credentialing_sensitive`** (`23514`). `attachment_confidentiality_ok` and
`confidentiality_clearance_ok` read `case_access_grants` (ranked `max_confidentiality`,
active+unexpired rows), fail-closed on a gated label with no clearance plane.

**8. `238` keystones non-vacuous.** b-mutation-audit reverts each keystone's own wiring
one at a time and every one goes RED; the unmutated control is GREEN. Confirms the
harness can manufacture both a RED and a pass, and that each keystone asserts on
rows-read, not a predicate return.

**9. Active partial-unique.** `case_access_grants_active_source_uniq` on
`(case_id, principal_id, source, source_entity_id) NULLS NOT DISTINCT WHERE revoked_at IS
NULL` is present; K9 mutation-proves a second active `manual_grant` for the same
`(case, principal)` raises `23505` despite the null `source_entity_id`.

---

## Pre-approved deviations — ruled

| Deviation | Ruling |
|---|---|
| **Dropped the plan's `expires_at > granted_at` table CHECK** | **BLESSED.** Fail-closed is preserved: a directly-inserted, backdated-expiry grant confers **nothing** (`can_read_case = f`, `can_read_case_patient = f`) because the resolver and both attachment readers filter `expires_at is null or expires_at > now()`. The real future-at-grant invariant is the door's `p_expires_at <= now()` rejection. Keeping the table CHECK would reject lossless migration of already-expired legacy grants and the backdate-to-simulate-expiry test pattern. An expired/past grant is inert, never over-grants. |
| **RLS = own-row SELECT + no authenticated DML** (vs "no grant at all") | **BLESSED.** Own-row SELECT is benign (proven: only the principal's own row, no cross-principal disclosure) and is required so `count(*)`-style wall/roster/sweep patterns don't `42501`. The roster is served only by the DEFINER `list_case_access`. |
| **Single polymorphic `source_entity_id` + `NULLS NOT DISTINCT` active partial-unique** | **BLESSED.** Prevents a duplicate active `manual_grant` per `(case, principal)` even with `source_entity_id IS NULL` (K9 mutation-proven; index confirmed in catalog). The door's `on conflict … where revoked_at is null` upsert relies on it. |
| **`m5`/`m6` mutation audits have STALE targets** (A2 relocated their logic into `_case_caps`) | **DEFER — not a Stage-B blocker; track as follow-up.** See MINOR-2. |

---

## Findings

### MINOR-1 — stale comment in the collapsed UI helper (§7.2 #5 shape)
`src/lib/case-access/actions.ts:83` still reads *"The flag-off gate
(assert_case_access_enabled) raises check_violation"* — but that function is **retired**
(B4). A reader verifying the comment finds nothing. The `caseAccessEnabled()` collapse to
`return true` itself is correct and well-documented. Secondary observation: the
`23514 → MESSAGES.unavailable` mapping now catches only the door's own validation
check-violations (invalid level, past-expiry) rather than a flag-off gate — pre-existing
behaviour, low impact (invalid-level is not reachable from the normal read/write UI), but
the "unavailable" wording is now slightly off for those edges. **Fix: correct the comment;
optionally reconsider the 23514 message.** No security impact.

### MINOR-2 — `m5`/`m6` mutation-audit stale targets (pre-existing A2-era debt)
`m5-mutation-audit` reports **NOT PROVEN (ABSENT/aborted)** for its two
`can_read_case`-structural `is_active` mutations, and `m6-mutation-audit` reports **NOT
PROVEN (GREEN)** for its `resolver: visibility arm (M6-7)` mutation — because A2 relocated
that logic into `_case_caps`, so mutating the old call sites no longer lands. **This is
not a Stage-B regression** — the Stage-B migration touches none of those functions, and
the behavioural keystones (231/233) still pass in the full suite. The **`is_active` gate
remains falsifiable** via `a2-mutation-audit` **K10 (RED-PROVEN)**. The residual gap is
the **`explicit_grants_only` visibility arm** (`not v_eg`), which no current audit
mutates after m6 went stale. **Ruling: deferrable past Stage-B Gate-1 exit**, but the lead
should track a follow-up to retarget the m5/m6 mutations onto `_case_caps` and add an
explicit visibility-arm mutation to `a2-mutation-audit` to restore that arm's
falsifiability.

### INFO-1 — `reason_code` governance signal is real
All three `reason_code` values are reachable and observed: `coordinator_grant` (default),
`org_admin_deadlock_exit` (B6 arm, K5e-confirmed), `creator_self_grant` (the
create_case/create_case_from_template self-grants). No invented-with-no-writer value.

---

## Scope notes
- Out of scope (already filed, not mine): BUG-MAIO-001, BUG-AISAT-001 (non-authz E2E).
- `e2e:prod` declare-green is the **lead's** step (subagents cannot); I did not run it.
  This verdict is on the security spine, catalog, keystones, and code — the standing
  gate order has `qa` before the human, after the lead's prod-E2E triage.

# NSP-per-hospital — Backend security-core spec (Phase B, backend core)

> Lead coordination artifact for the `backend` teammate and `qa`. **The door inventory is the
> spec and the post-change assertion** — a single un-rebound PQS term is a silent
> cross-**hospital** PHI leak (ADR 0042 M2/M3). Companion to ADR
> [0052](../decisions/0052-nsp-per-hospital.md) and design
> [hospital-roles-nsp-titles-design.md](hospital-roles-nsp-titles-design.md) (locked decisions
> 11–15). **This phase re-keys the proven per-org inventory
> ([nsp-per-org-design.md](nsp-per-org-design.md) §A) one hop further: `org → hospital`.** The
> backend teammate re-derives the authoritative inventory against the **live** catalog (line
> numbers shifted after `20260630000000_nsp_per_org.sql` + the Phase-A `20260709*` migrations)
> as its plan-first deliverable.

**Core idea:** every PHI door already resolves *entity → commission → organization*
(`app.org_of_commission`); make it resolve one hop earlier to *entity → commission →
**hospital*** (`commissions.hospital_id`) and replace `app.is_pqs_member_of(<org>)` with
`app.is_pqs_member_of(<hospital>)`. Roster + NSP config move per-org → per-hospital.
**Single-hospital-per-org behavior is byte-identical** (Phase-A seed has one hospital per org ⇒
the per-hospital term collapses to the per-org term), so the existing PQS pgTAP suite stays
valid; the reseed adds org-A's **second hospital** to make isolation provable.

New migration(s) after `20260709000800_*` (next slot `20260710000000_nsp_per_hospital.sql`).
Header must state: **NOT additive** (PK change on `pqs_members`) — greenfield reseed (ADR 0041
dec. 9 / standing pre-launch decision). Order: schema → predicate primitives → resolution
helpers → read predicates → write gates/policies → DEFINER doors → `nsp_org_admin` doors →
mint → roster/config RPCs → storage + patient_index → `dispose_referral_phi` → drops last.
`check_function_bodies = false`; create primitives before callers.

---

## §T — The `org → hospital` transform (apply to ALL of nsp-per-org-design.md §A)

Take every door/policy/RPC in **nsp-per-org-design.md §A** (the authoritative per-org list) and
apply, verbatim:

| Per-org symbol (drop/rebind) | Per-hospital symbol (new) |
|---|---|
| `app.org_of_commission(c)` | `app.hospital_of_commission(c)` = `commissions.hospital_id` (NOT NULL — verify) |
| `app.org_of_event(e)` | `app.hospital_of_event(e)` = `hospital_of_commission(e.reporting_commission_id)` |
| `app.org_of_referral(r)` | `app.hospital_of_referral(r)` = `hospital_of_commission(r.source_commission_id)` |
| `app.org_of_capa_action(a)` | `app.hospital_of_capa_action(a)` (chain action→capa→event→commission→hospital) |
| `app.is_pqs_member_of(org)` / `_for` | `app.is_pqs_member_of(hospital)` / `_for` |
| `app.is_pqs_writer_of(org)` | `app.is_pqs_writer_of(hospital)` |
| `app.is_nsp_coordinator_of(org)` / `_for` | `app.is_nsp_coordinator_of(hospital)` / `_for` (role row now carries `hospital_id`) |
| `app.is_pqs_member_of_any(uid)` | **unchanged name**, semantics widen to "enrolled in *any* hospital roster" |
| roster/config keyed `organization_id` | keyed `hospital_id` |

**Do NOT re-key** `org_of_hospital` (keep — it climbs hospital→org for the `nsp_org_admin` gate),
`is_org_admin_of`, `is_commission_admin_of`, the audit chain, or anything outside the PQS/PHI
door set. Keep `org_of_commission` too if any non-PQS caller still needs org (grep first).

**Coordinator is now a full local operator (decision 12 — differs from ADR 0042).** Every PHI
read predicate AND every write gate resolves true for `is_nsp_coordinator_of(hospital) OR
is_pqs_member_of(hospital)`. In ADR 0042 the coordinator was curate-only; here the *local* tier
is a full operator, so the coordinator term is added to the read/write predicates (not just the
roster RPCs). Keep the OR compact — a single helper
`app.is_pqs_operator_of(hospital) = is_nsp_coordinator_of(hospital) OR is_pqs_member_of(hospital)`
used by the doors is acceptable and DRY; decide in the plan.

**Dual-hospital referral reads (decision 14).** `can_read_referral_phi` and the referral
`patient_xref` doors resolve **both** endpoints: `is_pqs_member_of(hospital_of_commission(source))
OR is_pqs_member_of(hospital_of_commission(target))` (operator form). `create_referral_draft`
keeps the **same-org** guard (cross-org still forbidden, ADR 0042 §4) — only the read resolution
widens. Confirm `case_referral.target_commission_id` is NOT NULL at read time (draft-stage
nullability may need a guard).

---

## §N — Net-new surfaces (NOT in the per-org inventory)

### §N.1 `nsp_org_admin` predicate + PHI-free aggregate doors (decision 13)
- **Primitive:** `app.is_nsp_org_admin_of(org)` / `_for(org, uid)` =
  `exists(organization_members where organization_id = org and user_id = uid and role =
  'nsp_org_admin')`. Mirror `is_org_admin_of` exactly (STABLE SECURITY DEFINER, search_path,
  REVOKE/GRANT). **`nsp_org_admin` grants ZERO PHI read** — it must NOT appear in any
  `can_read_*` / `get_*_patient` / PHI door.
- **PHI-free aggregate doors** (new SECURITY DEFINER, gated `is_nsp_org_admin_of(p_org_id)` OR the
  hospital operator for their own hospital — decide granularity in plan). Return **counts/status
  rollups keyed by hospital**, never a PHI column, never free text/narrative:
  - `nsp_org_event_rollup(p_org_id)` → per-hospital event counts by triage status / severity band.
  - `nsp_org_capa_rollup(p_org_id)` → per-hospital CAPA counts by status (open/overdue/closed).
  - `nsp_org_roster(p_org_id)` → per-hospital roster (member names/emails + coordinator) — identity
    of *staff*, not patients; PHI-free.
  - (Enumerate the minimal set the FE console needs; every one MUST be provably PHI-free — qa
    keystone.) Apply the ADR 0042 **M3** rule: the RESULT SET is scoped to `p_org_id`'s hospitals,
    not just the gate.

### §N.2 Appointment + roster/config RPCs — three-tier chain (decisions 3, 12, 13)
Re-gate the ADR 0042 §A.6 roster RPCs to the new chain. **`nsp_org_admin` OR the hospital's own
`nsp_coordinator`** may curate a hospital's roster/config:
| RPC | New signature + gate |
|---|---|
| `add_pqs_member` | `add_pqs_member(p_hospital_id, p_user_id)`; gate `is_nsp_org_admin_of(org_of_hospital(p_hospital_id)) OR is_nsp_coordinator_of(p_hospital_id)`; insert `(hospital_id,user_id,added_by)`. |
| `remove_pqs_member` | `remove_pqs_member(p_hospital_id, p_user_id)`; same gate; delete by `(hospital,user)`. |
| `list_pqs_members` | `list_pqs_members(p_hospital_id)`; same gate (curation duty). |
| `set_pqs_rca_due_window` | `set_pqs_rca_due_window(p_hospital_id, p_days)`; same gate; update `pqs_department where hospital_id = p_hospital_id`; **audit passes the hospital → hospital tier** (Phase-A 4-tier audit). |
| **`assign_nsp_coordinator`** (new, or extend Phase-A appointment RPC) | org_admin appoints the `nsp_org_admin`; **`nsp_org_admin` appoints/revokes any hospital's `nsp_coordinator`** (DEFINER, no self-delegation). `hospital_admin` has NO NSP appointment power (decision 3). Confirm against the Phase-A `assign_hospital_admin` / appointment RPC family — reuse the pattern. |

RLS on `pqs_members`: drop the per-org `pqs_members_coordinator_all`; add per-hospital
`pqs_members_curator_all` (`is_nsp_org_admin_of(org_of_hospital(hospital_id)) OR
is_nsp_coordinator_of(hospital_id)`). `org_admin` has **no** direct `pqs_members` write.

### §N.3 `dispose_referral_phi` (decision 5 / ADR 0052 §6)
New LGPD-erasure door mirroring `dispose_event_phi` / `dispose_case_phi`:
`dispose_referral_phi(p_referral_id, p_reason)` — gate
`is_admin() OR is_commission_admin_of(referral.source_commission_id) OR
is_pqs_operator_of(hospital_of_referral(p_referral_id))`; constrained `reason` enum matching the
other two doors; audit at the hospital tier; nulls the `referral_patient` PHI columns (mirror the
exact null-set + audit shape of `dispose_event_phi`). Confirm the `referral_patient` table +
column set against `…014000`.

---

## §S — Schema migration (forward-only; greenfield reseed)
1. **`pqs_department` → per-hospital:** add `hospital_id` FK; drop the per-org
   `UNIQUE(organization_id)`; add `UNIQUE(hospital_id)`; `SET NOT NULL` (post-reseed).
   Per-org singleton readers → `where hospital_id = <hospital>`.
2. **`pqs_members` → per-hospital (non-additive):** add `hospital_id` FK (nullable transient) →
   drop `PK(organization_id, user_id)` → set `hospital_id` NOT NULL → `PK(hospital_id, user_id)`
   → `INDEX(user_id)`. Keep the profile FKs. Reseed truncates. Header: "NOT additive (PK change)".
3. Predicate primitives + resolution helpers **before** any caller. Grants on every new/changed
   function; `DROP FUNCTION` changed-arity per-org signatures first (unquoted `integer` — ADR
   0042 note 3).
4. **`organization_members.role`** already includes `nsp_org_admin` (Phase A) — no CHECK change.
5. **Catalog-sweep assertion** (the real safeguard, ADR 0042 M2): after `db reset`, ZERO
   `pg_proc`/`pg_policies` references to dropped per-org PQS symbols (`org_of_event`,
   `org_of_referral`, `org_of_capa_action`, per-org `is_pqs_member_of(org)` bodies) survive; word-
   boundary regex so `_of`/`hospital_of_*` rebinds aren't false positives.

## §C — Seed (`supabase/seed.sql`)
- **org-A gains a second hospital** (e.g. `hospital-a2` under rede-a alongside the existing one) +
  ≥1 commission under it (fixed UUID) so intra-org **cross-hospital** isolation + a cross-hospital
  referral are testable. Preserve existing commission UUIDs.
- **Personas** (fixed UUIDs, `Test1234!`): `nsporg.a@` (`nsp_org_admin`, rede-a, `hospital_id`
  NULL), per-hospital coordinators `nspcoord.a1@` / `nspcoord.a2@` (rede-a hospitals 1 & 2),
  keep/rename the rede-b coordinator; `pqs.a1@` / `pqs.a2@` enrolled in hospital 1 / hospital 2
  rosters respectively. **Keep ≥1 coordinator NOT enrolled** in its own roster (prove local
  curate-then-read) and ensure `nsp_org_admin` is enrolled in **no** roster (prove zero-PHI).
- `pqs_department`: one row per hospital, **different** RCA due-windows per hospital.
- A hospital-A2 **event** + isolated `event_patient` PHI (distinct MRN) so a hospital-1 member
  gets null on it. An **intra-org cross-hospital referral** (hospital-A1 commission → hospital-A2
  commission) + `referral_patient` PHI, read by both endpoints' NSPs.
- `patient_xref` fixtures updated for the new hospital. Direct superuser inserts (bypass the
  curator-gated RPCs) as today. Note the new `hospital_id` columns in the seed header.

## §D — pgTAP (`supabase/tests/`)
**New/rewritten suite `176_*` (or the next free number) — `nsp_per_hospital_isolation`.** Mirror
`173_nsp_per_org_isolation`'s persona pattern. Keystones (ADR 0052):
1. `is_pqs_member_of_for(hospital_a1, pqs_a1)=true` / `(hospital_a2, pqs_a1)=false`; inverse.
2. `is_nsp_coordinator_of_for` per hospital; `is_nsp_org_admin_of_for(rede_a, nsporg_a)=true`.
3. `can_read_event[_patient]`: hospital-A1 member/coordinator true on A1 event, **false** on A2
   event (same org!); `get_event_patient(A2)` → null. Symmetric.
4. `pqs_inbox()` as `pqs_a1`: all rows' reporting-commission in hospital-A1; zero hospital-A2.
5. **`nsp_org_admin` zero-PHI keystone:** as `nsporg.a`, every `can_read_*`/`get_*_patient` →
   false/null across BOTH hospitals; but `nsp_org_event_rollup(rede_a)` / `nsp_org_capa_rollup` /
   `nsp_org_roster` return per-hospital counts (no PHI column present — assert column set).
6. **Duty separation (org tier):** `nsporg.a` can `add_pqs_member(hospital_a2, X)` (curate) but
   still reads no PHI; a local unenrolled `nspcoord.a1` reads PHI via the coordinator arm; an
   enrolled `pqs.a1` reads via membership. `add_pqs_member` by a foreign hospital's coordinator →
   42501; by `org_admin` directly → 42501 (only appoints via `organization_members`).
7. **Dual-hospital referral:** the A1→A2 referral is PHI-readable by both hospital-A1 and
   hospital-A2 NSP; a hospital-B NSP member → false/null. `create_referral_draft` across orgs still
   raises.
8. **`dispose_referral_phi`:** commission-admin of source OR referral-hospital PQS can dispose;
   after disposal `get_referral_patient` → null; audit row at hospital tier. Cross-hospital denial.
9. **Per-hospital EV:** hospital-A1 / A2 event sequences independent.
10. **Single-hospital collapse:** existing 14a–d / referral / patient-index suites stay green.

Update the pgTAP total in `docs/backend-state.md`.

## §R — Risk flags (carry ADR 0042 §E forward)
1. Per-hospital EV — single-hospital suites unaffected (one hospital ⇒ identical sequence).
2. **Dual-hospital referral read** — the ONE widening vs. per-org; needs the cross-hospital
   referral fixture. Cross-org still forbidden.
3. **Audit tier** — hospital-level now (Phase-A 4-tier chain): event/referral PHI reads derive
   hospital from `reporting_commission_id` / `source_commission_id`; `set_pqs_rca_due_window` +
   patient_index `patient.searched/viewed` must pass the **hospital** → hospital tier.
4. **TS callsites** — grep `src/lib/queries/**` + `src/lib/**/actions.ts` for
   `is_pqs_member_self` / any per-org PQS RPC signature before the DROP; the FE console + NSP nav
   consume these. Post typed stub signatures (contract-first) before implementing.
5. **`nsp_org_admin` PHI-free proof** — every new aggregate door's SELECT list must be audited to
   contain no PHI column; this is a qa keystone, not just a gate.
6. **Confirm at implementation:** (a) `commissions.hospital_id` NOT NULL for all seeded
   commissions; (b) `case_referral.target_commission_id` nullability at read time; (c)
   `referral_patient` table/column set for `dispose_referral_phi`; (d) whether the coordinator-
   operator OR-term belongs inline or in a `is_pqs_operator_of` helper.

---

## Backend plan-first deliverable (A0)
Before implementing, post as plan text: (1) the **live-catalog** per-door inventory (re-derive
line numbers; confirm every ADR 0042 §A door is covered + the §N net-new surfaces); (2) the
`nsp_org_admin` aggregate-door list with each door's proven-PHI-free SELECT list; (3) the typed
query/action **signatures** the frontend depends on (contract-first stubs in
`src/lib/queries/**` + relevant `actions.ts`) — NSP hospital switcher, coordinator/roster
appointment, org NSP-admin console; (4) the migration order + the catalog-sweep assertion. **Full
plan review** (security-critical re-key) — lead approves in text before you migrate.

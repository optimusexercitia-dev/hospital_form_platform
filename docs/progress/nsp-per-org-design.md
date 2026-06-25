# NSP-per-org — Backend security-core spec (sub-phase A)

> Lead coordination artifact for the `backend` teammate and `qa`. The **door inventory
> (§A) is the spec and the post-change assertion** — a single un-rebound PQS term is a
> silent cross-org PHI leak. Companion to the approved plan
> (`~/.claude/plans/precious-squishing-pudding.md`) and ADR 0042 (to be written).
> Decisions are **resolved** here (no open "DECISION REQUIRED" — see plan §"Decisions
> baked in"). Derived from a Plan-agent design pass over the live migrations.

**Core idea:** every PHI door already resolves *entity → commission*; make it go one hop
further to *commission → `organization_id`* (denormalized on `commissions`) and replace the
global `app.is_pqs_member(uid)` term with `app.is_pqs_member_of(<that org>, uid)`. Roster +
NSP config become per-org. `is_multi_org()` and every `and not is_multi_org()` guard are
**deleted**. Single-org behavior stays **byte-identical** (one org ⇒ the term collapses to
"is enrolled").

New migration: `supabase/migrations/20260630000000_nsp_per_org.sql` (after `…629000`). Header
must state: **NOT additive** (PK change on `pqs_members`) — relies on greenfield reseed
(ADR 0041 dec. 9). Order: schema → predicate primitives → read predicates → write
gates/policies → DEFINER doors → flag/assert reversions → mint → roster RPCs → storage +
patient_index → drops last. `check_function_bodies = false`; create primitives before callers.

---

## §0 — The FOURTH PHI surface (do not miss): `patient_index`

The Phase-23 cross-committee patient index has **no `is_multi_org()` guard** — it is safe
today *only* because the global roster is inert. The moment per-org membership is real, it
leaks org-B patients to an org-A NSP member. `patient_xref` aggregates across **all**
commissions with no org filter. It ships UI-OFF, but the SQL leak is real and **must** be
closed in this migration set, with pgTAP. `patient_xref.commission_id` exists (nullable) →
org is one join away. See §A7.

---

## §A — Door / policy / RPC inventory

`OrgOf(x)` = the `organization_id` reached from entity `x`. Resolution per entity:

| Entity | Org resolution |
|---|---|
| `patient_safety_event e` | `OrgOf(e.reporting_commission_id)` — **NOT** `current_owner_commission_id` (NULL for PQS-held events). `reporting_commission_id` is NOT NULL. |
| `case_referral r` | `OrgOf(r.source_commission_id)` (the provenance/audit commission; NOT NULL). |
| `capa_plan` / `rca` | resolve to event via `app.event_of_capa` / the rca's `event_id`, then `OrgOf(event.reporting_commission_id)`. |
| `cases` (QPS macro) | `OrgOf(cases.commission_id)`. |
| `patient_xref x` | `OrgOf(x.commission_id)`. |

**Add helpers** (DRY/testable): `app.org_of_commission(commission)`, `app.org_of_event(event)`,
`app.org_of_referral(referral)`, `app.org_of_capa_action(action)`. All new functions:
`STABLE SECURITY DEFINER`, `SET search_path TO 'app','public','pg_catalog'`, `OWNER postgres`,
`REVOKE ALL FROM PUBLIC` + `GRANT … TO authenticated, service_role`. `_for` variants take
`p_user_id`; bare variants use `auth.uid()`. Mirror `is_org_admin_of` / `_for` exactly.

### New predicate primitives (replace the global ones)
| Fn | Body |
|---|---|
| `app.is_pqs_member_of(org)` / `_for(org, uid)` | `exists(select 1 from pqs_members where organization_id = org and user_id = uid)`. **The workhorse.** |
| `app.is_nsp_coordinator_of(org)` / `_for` | `exists(select 1 from organization_members where organization_id = org and user_id = uid and role = 'nsp_coordinator')`. |
| `app.is_pqs_writer_of(org)` | `= app.is_pqs_member_of(org)` (write authority = per-org roster membership). |
| `app.is_pqs_member_of_any(uid)` | `exists(select 1 from pqs_members where user_id = uid)` — nav-level + global-vocab gate. |

Then **delete** global `app.is_pqs_member(uid)` + `app.is_pqs_writer()` + `app.is_multi_org()`
(last, after the TS-callsite grep — see §E4).

### §A.1 Read predicates — rebind PQS term, delete the `is_multi_org` wrapper
| File | Function | Replacement of the PQS term |
|---|---|---|
| `…629000:76` | `can_read_event` | `or app.is_pqs_member_of_for(app.org_of_event(e.id), p_user_id)`; keep both `is_member_of_for` terms; drop wrapper. |
| `…629000:95` | `can_read_event_patient` | `app.is_pqs_member_of_for(app.org_of_event(e.id), p_user_id) or app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id)`; drop wrapper. |
| `…009000:151` | `can_read_capa` | `app.is_pqs_member_of_for(app.org_of_event(app.event_of_capa(p_capa_id)), p_user_id) or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id)`. |
| `…009000:204` | `can_write_rca` (read+write arm) | `app.is_pqs_member_of_for(app.org_of_event(r.event_id), p_uid) or exists(rca_members …)`. |
| `…009000:271` | `event_current_custodian` (HC044) | `app.is_pqs_member_of_for(app.org_of_event(e.id), p_user_id) or (current_owner_kind='commission' and is_staff_admin_of_for(…))`. |
| `…013000:339` | `can_read_referral` | `app.is_pqs_member_of_for(app.org_of_referral(r.id), p_uid) or is_member_of_for(source) or is_member_of_for(target)`. |
| `…629000:112` | `can_read_referral_phi` | `app.is_pqs_member_of_for(app.org_of_referral(r.id), p_uid) or staff_admin(source) or staff_admin(target) or referral_target_analyst(...)`; drop wrapper. |
| `…629000:131` | `can_read_case` — **QPS macro term only** | `app.feature_enabled('case_referrals') and app.is_pqs_member_of_for(app.org_of_commission(v_commission), p_uid) and exists(referral touching case)`; drop `and not is_multi_org()`. Other terms unchanged. |
| `…629000:180` | `can_read_case_patient` — **QPS macro term only** | same rewrite as `can_read_case`; drop wrapper. |

### §A.2 Write gates / policies (every `is_pqs_writer` site)
**Consolidate** behind `app.can_write_capa(p_capa_id, p_uid) = app.is_pqs_writer_of(app.org_of_event(app.event_of_capa(p_capa_id)))` so the 8 CAPA `*_write` policies mirror the existing `can_read_capa` pairing. Per-table resolution: action→`capa_id`, action_task→action→capa, measure_result→measure→capa, etc.
- RLS policies (`…009000:4219–4249`): `capa_action_evidence_write`, `capa_action_task_write`, `capa_action_write`, `capa_effectiveness_write`, `capa_measure_result_write`, `capa_measure_write`, `capa_plan_delete`, `capa_plan_update` → `app.can_write_capa(<resolved capa_id>, auth.uid())`.
- `assert_capa_writable` (`…009000:101/109`): `is_pqs_writer()` → `app.can_write_capa(p_capa_id, auth.uid())`.
- `advance_capa_action_core` (`…009000:80`): `… or app.is_pqs_member_of(app.org_of_event(app.event_of_capa(v_capa_id)))`.
- **Every NSP lifecycle RPC** that gates `if not app.is_pqs_member(auth.uid())` (triage save/confirm/reopen, RCA create/transition, CAPA open/conclude, custody transfer, disposition, etc. — `…009000:1875, 1968, 1992, 2148, 2556, 2587, 2629, 2661, 3510, 3690` and the RCA-evidence path `:1355`, CAPA helpers `:1692/1702`): each takes an event/rca/capa/triage arg → resolve event → `if not app.is_pqs_member_of(app.org_of_event(<event>))`. Enumerate each explicitly; no blanket.

### §A.3 DEFINER doors / RPCs
| File | RPC | Replacement |
|---|---|---|
| `…009000:2210` | `pqs_inbox(...)` | **org-scope the result set**: precompute `v_orgs := array(select organization_id from pqs_members where user_id = auth.uid())`, filter events `join commissions c on c.id = e.reporting_commission_id where c.organization_id = any(v_orgs)`. An org-A coordinator sees only org-A events. |
| `…009000:2780` | `set_event_patient(...)` | **VERIFY body (§E6):** if it has an explicit `is_pqs_member`/custodian check, org-scope it; if it delegates to `can_read_event_patient`, no change. |
| `…009000:2819` | `get_event_patient(...)` | delegates to rebound `can_read_event_patient` → no direct change; audit attributes via `reporting_commission_id` → correct org tier. |
| `…019000:702` (and `…009000:2868`) | `dispose_event_phi(event, reason)` | **keep `is_admin` exception** (ADR-documented erasure); org-scope the PQS arm: `is_admin() or app.is_pqs_member_of(app.org_of_event(p_event_id))`. |
| `…014000:815` | `get_referral_detail(referral)` | read gate is `can_read_referral` (rebound); rebind the QPS audit-exemption term `… or app.is_pqs_member_of(app.org_of_referral(p_referral_id))`. |
| `…014000:925/964/998` | `get_referral_patient` / snapshot / attachment paths | delegate to rebound `can_read_referral_phi` → no direct change; audit via `source_commission_id` → correct tier. |
| `…014000:1033` | `is_pqs_member_self()` | keep no-arg = `app.is_pqs_member_of_any(auth.uid())` (nav "show NSP at all"); **add** `is_pqs_member_of_self(p_org_id)` = `app.is_pqs_member_of(p_org_id)` for the org-scoped QPS-dashboard gate. |

### §A.4 Flag / assert reversions (the point of the phase)
- `patient_safety_enabled()` (`…629000:229`) → `app.feature_enabled('patient_safety')` (drop multi-org term).
- `referrals_enabled()` (`…629000:236`) → `app.feature_enabled('case_referrals')` (drop term).
- `assert_patient_safety_enabled()` (`…629000:243`) → revert to flag-only raise (`…009000` original body).
- `assert_referrals_enabled()` (`…629000:255`) → revert to flag-only (`…013000` original).
- `assert_patient_index_enabled()` — no change (never had a multi-org term); its **doors** are org-scoped in §A7.

### §A.5 Numbering
- `mint_event_code` (`…009000:656`) → **per-org `EV-%04d`**: advisory-lock key `'pqs:event_code:'||v_org`, `max(suffix)+1` filtered to events whose `reporting_commission_id` is in `v_org`. Resolve `new.reporting_commission_id → org` inside the BEFORE-INSERT trigger.
- `referral_code_seq` / `set_referral_code` (`…013000:106/304`) → **keep global** `ENC-%04d` (single sequence; referrals are intra-org).

### §A.6 Roster curation RPCs (platform-admin+global → coordinator+per-org)
| File | RPC | New signature + gate |
|---|---|---|
| `…009000:2998` | `add_pqs_member` | `add_pqs_member(p_org_id, p_user_id)`; gate `is_nsp_coordinator_of(p_org_id)` (else 42501); `insert (organization_id,user_id,added_by) … on conflict do nothing`. |
| `…009000:3021` | `remove_pqs_member` | `remove_pqs_member(p_org_id, p_user_id)`; gate coordinator; delete by `(org,user)`. |
| `…009000:3036` | `list_pqs_members` | `list_pqs_members(p_org_id)`; gate **coordinator-only** (curation duty); filter by org. |
| `…009000:3066` | `set_pqs_rca_due_window` | `set_pqs_rca_due_window(p_org_id, p_days)`; gate coordinator (or member-of-org); update `pqs_department where organization_id = p_org_id`; **audit passes `p_organization := p_org_id` → org tier** (not platform). |

`DROP FUNCTION` the old signatures (arity changed) so stale overloads don't linger — same lesson as the `…626000` audit drops. RLS: drop `pqs_members_admin_all`; add `pqs_members_coordinator_all` (`is_nsp_coordinator_of(organization_id)`). **No** platform-admin escape hatch (duty separation). `org_admin` has **no** direct `pqs_members` write — only appoints coordinators via `organization_members`.

### §A.7 Storage + patient_index
**`nsp-evidence` storage** (`…010000`): `capa_evidence_obj_insert_writable` (`:237`) rebinds the no-arg writer → `app.is_pqs_writer_of(app.org_of_event(((storage.foldername(name))[1])::uuid))` (seg[1] = event_id). The other 3 (`nsp_evidence_obj_select_member`, `nsp_evidence_obj_insert_writable`, `capa_evidence_obj_select_member`) ride rebound `can_read_event`/`can_write_rca`/`can_read_capa` → org-correct automatically; **confirm `is_admin` already dropped** by `…626000` (§E6).

**`patient_index` doors** (`…019000`):
- `patient_xref_select_pqs` (RLS, `:234`) → DEFINER wrapper `app.can_read_xref_row(commission_id, uid) = is_pqs_member_of_for(org_of_commission(commission_id), uid)`; NULL-commission rows deny.
- `patient_trajectory_bundle` (`:399`) → add `p_org_id`; filter matched xref rows to `org_of_commission(x.commission_id) = p_org_id`.
- `search_patient_xref(mrn, encounter[, p_org_id])` (`:480`) → gate `is_pqs_member_of_any`; **take an explicit `p_org_id`** (UI always knows which org's console); pass to the org-filtered bundle. (No accidental cross-org union for multi-org members.)
- `get_patient_trajectory_for_entity(module, entity_id)` (`:535`) → resolve entity's `commission_id → org`; gate `is_pqs_member_of(that org)`; pass org to bundle.
- `patient_access_audit(mrn, encounter, p_org_id)` (`:590`) → gate `is_pqs_member_of(p_org_id)`; restrict the entity subquery to xref rows in that org **and** `audit_log.organization_id = p_org_id`.
- `patient_xref_count(module, entity_id)` (`:646`) → `can_read_referral_phi` gate is rebound; org-scope the **count** to the entity's org.
- Audit tier: `patient.searched`/`patient.viewed` (`…019000:516/569`, currently `commission := null` → platform) → pass the caller's org → org tier.

### §A.8 Drops (last)
`CREATE OR REPLACE` the five guard-migration predicates (`can_read_event[_patient]`, `can_read_referral_phi`, `can_read_case[_patient]`) with **no `is_multi_org` reference** (same edit as the §A.1 rebind). Then `DROP FUNCTION app.is_multi_org()`, `app.is_pqs_member(uuid)`, `app.is_pqs_writer()` — after the §E4 TS grep; keep a one-phase deprecated shim if any TS caller remains.

### Cross-org referrals — FORBID
`case_referral_distinct_commissions` only forbids self-referral. Add to `create_referral_draft` (`…014000:213`): after resolving source/target orgs, raise if they differ. Filter `list_referral_target_commissions` (`…014000:448`) to the source's org. (Cross-hospital, same-org referrals stay fine.)

---

## §B — Schema migration (forward-only; greenfield reseed)
1. **`organization_members.role` CHECK** → `{org_admin, nsp_coordinator}`. Existing `organization_members_write` policy already permits an org_admin to insert the new role (check is on `organization_id`, not `role`) — no policy change for appointment.
2. **`pqs_department` → per-org:** add `organization_id` FK; drop singleton column/constraint/index; `UNIQUE(organization_id)`; `SET NOT NULL` (post-reseed). Singleton readers (`…009000:1943, :3082, :3362`) → `where organization_id = <org>`.
3. **`pqs_members` → per-org (non-additive):** add `organization_id` FK (nullable transient) → drop `PK(user_id)` → `SET NOT NULL` → `PK(organization_id, user_id)` → `INDEX(user_id)`. Keep the two profile FKs. Reseed truncates, so no row migration. Header: "NOT additive (PK change) — greenfield reseed per ADR 0041 dec. 9."
4. RLS swap on `pqs_members` (§A.6). New predicate primitives + helpers before any caller.
5. Grants on every new/changed function. `DROP FUNCTION` changed-arity signatures first.

---

## §C — Seed (`supabase/seed.sql`)
New personas (fixed UUIDs, `Test1234!`): `nspcoord.a@`, `pqs.a@`, `nspcoord.b@`, `pqs.b@`.
- `organization_members`: coordinator rows for rede-a + rede-b.
- `pqs_department`: two rows (per-org; **different** due-windows, e.g. A=45d / B=30d, to prove per-org config).
- `pqs_members`: `(rede-a, pqs.a)`, `(rede-a, admin)`, `(rede-b, pqs.b)`. **Keep ≥1 coordinator NOT enrolled** (so pgTAP proves "curate ≠ read").
- A rede-b **event** + isolated `event_patient` PHI (MRN e.g. `PRT-B-0001`), reported by a rede-b commission, held by NSP.
- A **second rede-b commission** (e.g. "Farmácia B" under hospital `central-b`) so an **intra-rede-b referral** + isolated `referral_patient` PHI (MRN `PRT-B-0002`) exists. Keep ENC-0001/0002 as rede-a (CCIH→Farmácia). All referrals intra-org (per the forbid decision).
- A rede-b `patient_xref` synthetic patient sharing one MRN across the rede-b event + referral (isolation fixture for §A7). Keep the rede-a synthetic `PRT-0099123`.
- All **direct superuser inserts** (bypass the now-coordinator-gated RPCs), as today — seed needs no auth context. Note the new `organization_id` columns in the seed header.

---

## §D — pgTAP (`supabase/tests/`)
**Rewrite `173_multi_org_phi_guard.sql` → `173_nsp_per_org_isolation.sql`** (old file asserts the inert behavior we lift — it would now fail). Mirror `171`'s persona pattern (fixed-UUID `personas` temp table; `claims_for` + `set local role authenticated` for DEFINER doors; `_for` predicate asserts run as postgres). Keystone assertions:
1. `is_pqs_member_of_for(rede_a, pqs_a)=true` / `(rede_b, pqs_a)=false`; inverse for `pqs_b`.
2. `is_nsp_coordinator_of_for(rede_a, nspcoord_a)=true` / `(rede_b, …)=false`.
3. `can_read_event` / `can_read_event_patient`: A-member true on A-event, **false** on B-event; symmetric for B.
4. As `pqs_a`: `get_event_patient(A-event)` non-null, `get_event_patient(B-event)` **null**.
5. `pqs_inbox()` as `pqs_a`: ≥1 row, **all** reporting-commission in rede-a; zero rede-b. Inverse for `pqs_b`.
6. `can_read_referral_phi`: A true on A-ENC, false on B-ENC; `get_referral_patient` non-null/null; `get_referral_detail(B-ENC)` as `pqs_a` raises (gate denies).
7. **patient_index** (flip `patient_index` ON for these): as `pqs_a`, `search_patient_xref(rede-a MRN, rede_a)` returns only rede-a entities; `search_patient_xref(rede-b MRN, …)` → 0; `patient_access_audit(rede-b MRN, …)` → `[]`; direct `patient_xref` SELECT as `pqs_a` returns only rede-a rows. Inverse for `pqs_b`.
8. **Duty separation:** `nspcoord.a` (unenrolled) → `can_read_event_patient(A-event, nspcoord_a)=false`; then `add_pqs_member(rede_a, nspcoord_a)` succeeds → now `true`. `add_pqs_member(rede_b, X)` as `nspcoord.a` → 42501; as `nspcoord.b` on rede_a → 42501; as `org_admin.a` on rede_a → 42501 (three-way separation). `org_admin.a` CAN insert `(rede_a, X, 'nsp_coordinator')` into `organization_members`; into rede_b → RLS-denied.
9. **Per-org EV:** rede-a and rede-b event sequences independent.
10. **Reversions:** with 2 orgs + flag ON, `patient_safety_enabled()=true`, `referrals_enabled()=true`, asserts don't raise (inverts old 173).
11. **Single-org collapse:** existing `14a/b/c/d` + `150_referrals` suites stay green (one-org bootstrap ⇒ per-org term = "is enrolled").

Update the pgTAP total in `docs/backend-state.md` (173 grows 18 → ~24+).

---

## §E — Risk flags
1. **Per-org EV** — single-org suites stay green (one org ⇒ identical sequence); `173`'s explicit-code inserts unaffected. (Resolved: per-org EV, global ENC.)
2. **Cross-org referrals were structurally allowed** — now forbidden (guard + target filter). Needs the 2nd rede-b commission in seed.
3. **Audit tier — VERIFIED correct** for event/referral PHI reads (`audit_write` derives org from the passed commission; events→`reporting_commission_id`, referrals→`source_commission_id`, both non-null). **Fix:** `set_pqs_rca_due_window` audit must pass `p_organization` (was platform-tier); patient_index `patient.searched/viewed` move to org tier.
4. **`is_pqs_member_self` / `is_pqs_member(uid)` are TS-consumed** (`is_pqs_member_self` gates `listAllReferrals`/`referralFlowMetrics`). **Grep `src/lib/queries/**` before the DROP**; keep no-arg `is_pqs_member_self` as "any org" so the nav check survives; shim `is_pqs_member(uid)` for one phase if a caller remains.
5. **Single-org byte-identical** — holds; reseed is mandatory anyway (PK + singleton changes force it).
6. **Confirm at implementation:** (a) `set_event_patient` write-gate shape; (b) whether `…626000` already dropped `is_admin` from the 3 `nsp-evidence`/`capa_evidence` SELECT/INSERT policies; (c) `patient_xref.commission_id` is always resolved for keyed patients (the maintenance trigger), else the org filter drops legit rows.

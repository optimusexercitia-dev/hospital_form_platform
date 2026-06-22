# ADR 0039 — Patient identity & cross-committee linkage (`patient_index`)

**Status:** Accepted (Phase 23; plan approved by lead 2026-06-22) · **Date:** 2026-06-22 ·
**Phase:** 23 — Patient Identity & Cross-Committee Linkage ·
**Extends:** ARCHITECTURE.md Rule 11 (two new GLOBAL-chain access actions
`patient.searched` / `patient.viewed`), ARCHITECTURE.md Rule 12 (a non-identifying
linkage layer OVER the three PHI modules — adds no fourth PHI store) ·
**Relates to:** ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md) (PQS duty
separation, the isolated-satellite + audited-door posture), ADR
[0031](./0031-event-custody-ledger-and-phi-isolation.md) (PHI isolation pattern), ADR
[0035](./0035-lgpd-anvisa-regulatory-posture.md) (LGPD + ANVISA/RDC + CFM regime; column
encryption declined — the residual this layer leans on), ADR
[0036](./0036-phi-access-hardening.md) (PHI-access auditing), ADR
[0037](./0037-inter-committee-case-referrals.md) (`referral_patient`), ADR
[0038](./0038-case-patient-identifiers.md) (`case_patient`; the third PHI module this layer
links).

## Context

Brazilian EHRs identify a patient by two hospital-unique numbers: an **MRN** (prontuário,
patient-level) and an **encounter number** (atendimento, visit-level). The platform already
*captures* both — `mrn` and `encounter_ref` are free-text fields on all three isolated PHI
tables (`event_patient`, `referral_patient`, `case_patient`) via the shared `PatientFields`
component, each behind an audited single-door RPC (ADR 0030/0037/0038).

What is missing is the ability to **recognize the same patient across committees**. Today
committee A's "0012345" and committee B's "0012345" are unrelated strings: nobody — not even
Quality & Patient Safety (**QPS**, the NSP/PQS roster) — can ask "show me everything about
this patient." Three concrete needs:

1. A way to recognize the **same patient** across committees.
2. **Transmission** of a non-identifying patient reference on inter-committee **referrals**
   (the "hashed número" so a referred patient joins the cross-committee picture without
   exposing the raw MRN).
3. A **QPS-only cross-committee view**: given an MRN/encounter, surface every
   case / safety-event / referral touching that patient or encounter across all committees,
   plus a patient-scoped **access audit**.

The binding constraint is the privacy model: **the raw MRN never leaves its locked
per-committee table; only a non-reversible key crosses committee lines; only QPS can
reassemble the trajectory; every such lookup is logged** (HIPAA/LGPD defensible under the
ADR-0035 regime). This preserves the duty-separation siloing of ADR 0030/0036 and adds **no
fourth PHI store** — `patient_xref` holds keys only, never identifiers.

## Decision — the locked design

### 1. Linkage key — deterministic, non-reversible keyed hash

- `patient_key` (from MRN) and `encounter_key` (from encounter number) =
  `HMAC-SHA256(normalize(value), pepper)`, hex-encoded. **Deterministic** (same MRN → same
  key everywhere, enabling the cross-committee match) and **irreversible without the pepper**
  (so a key is safe in `patient_xref`, on a transmitted referral, and — truncated — in the
  audit log).
- The two keys are **independent**; a PHI row carrying both lets QPS pivot
  encounter → patient. Encounter numbers are hospital-unique, so `encounter_key` is a
  standalone identifier.
- **Exact-match only — no name/DOB fuzzy matching.** A false cross-link is a privacy breach,
  so we deliberately accept misses (typos, alternate MRNs) over a wrong join. **Name-only PHI
  rows** (no MRN/encounter) get NULL keys and are simply **absent from the index**.
- **Normalization is conservative** (`app.normalize_identifier`, `IMMUTABLE`):
  `nullif(btrim(regexp_replace(upper($1),'\s+',' ','g')),'')` — trim, uppercase, collapse
  internal whitespace; NULL for blank. **Leading zeros and punctuation are significant** (we
  don't know they're insignificant in this hospital's numbering), keeping false-positives near
  zero.

### 2. Pepper store — a locked-down secrets TABLE `app.app_secrets` (NOT a GUC, NOT Vault)

- The pepper lives in **`app.app_secrets (key, value, updated_at)`**, a one-row-per-secret
  table in the **`app` schema** (NOT `public`, so it is never PostgREST-exposed). All DML is
  **REVOKED** from `authenticated`/`anon`; `service_role` keeps SELECT (an operator path). The
  `SECURITY DEFINER` `app.derive_patient_key` reads `value WHERE key = 'mrn_pepper'` as owner and
  **hard-fails (raises)** if the row is missing/empty, so we never silently emit a constant
  empty-pepper key.
- **Why not Supabase Vault** (the obvious first choice): Vault is **empty during
  `supabase db reset`→seed**, so the derivation trigger fired on the seed's direct PHI inserts
  would read a null secret and either crash the seed or (worse, if softened) emit empty-pepper
  keys.
- **Why not a Postgres GUC** (`ALTER DATABASE … SET app.mrn_pepper`, the originally-approved
  choice): setting a custom GUC database default requires **SUPERUSER**, which the migration role
  is **not** — locally it failed with `42501 permission denied to set parameter`, and it would
  fail identically on **Supabase Cloud** (the `postgres` role there is not superuser). The GUC
  pepper store is therefore **infeasible on Supabase**. A plain table `INSERT`/`SELECT` needs no
  special privilege, works on cloud, and survives reset.
- **Local/CI:** the migration seeds a dev pepper (`INSERT INTO app.app_secrets … VALUES
  ('mrn_pepper', '<dev value>') ON CONFLICT (key) DO NOTHING`) so it is present after every
  `db reset` and **never clobbers** a value already set out-of-band. **Prod** sets the real
  long-lived secret **once, out-of-band, before any real PHI**:
  `UPDATE app.app_secrets SET value = '<real>', updated_at = now() WHERE key = 'mrn_pepper'`
  (test/seed-only prod today; documented deployment step). Not in `config.toml`: the CLI's
  `[db]` block has no arbitrary-secret mechanism that survives a reset.
- **Superuser/owner-visible residual:** a compromised superuser or DB-owner role can read the
  pepper from the table — the **same accepted ADR-0035 residual** as every other server-side
  secret (a GUC or Vault value would be equally readable by such a role). The keyed hash is a
  *linkage* control, orthogonal to at-rest encryption; this does not change the threat model
  ADR 0035 already accepted.
- **Hashing runs in SQL** via `extensions.hmac(v_norm, v_pep, 'sha256')` (pgcrypto). The
  `extensions.` schema-qualification is **mandatory** — `extensions` is not on the function's
  `search_path` (the audit chain proves the same with `extensions.digest`).

### 3. `patient_xref` — a key-only, QPS-only index

- A new `public.patient_xref`: PK `(module, entity_id)`; columns `module text` (CHECK in
  `('event','referral','case')`), `entity_id uuid`, `commission_id uuid`, `patient_key text`,
  `encounter_key text`, `created_at`, `disposed_at`, `disposed_reason`. **NO names, NO raw
  MRN** — keys and governance metadata only (a key is non-identifying).
- RLS enabled with a single SELECT policy `USING (app.is_pqs_member(auth.uid()))`;
  `GRANT … TO service_role; REVOKE ALL … FROM authenticated`. Direct table access is therefore
  QPS-only at the DB; the DEFINER RPCs are the working doors. Partial indexes on `patient_key`
  and `encounter_key` `WHERE … IS NOT NULL` back the searches.

### 4. Derivation + xref maintenance — ALWAYS-ON triggers (cover RPC writes AND seed inserts)

- A **BEFORE INSERT/UPDATE** trigger `app.trg_derive_patient_keys()` on the three PHI tables
  sets `NEW.patient_key`/`NEW.encounter_key`, re-deriving only when
  `TG_OP='INSERT' OR new.mrn IS DISTINCT FROM old.mrn OR new.encounter_ref IS DISTINCT FROM old.encounter_ref`.
  A trigger (not RPC-only derivation) is required because the seed **direct-inserts** PHI
  (`seed.sql:904`, `:1145`), bypassing the setter RPCs.
- An **AFTER INSERT/UPDATE/DELETE** trigger `app.trg_xref_maintain()` on the three PHI tables
  keeps `patient_xref` in sync: INSERT/UPDATE upsert `on conflict (module, entity_id)`
  (commission resolved via the existing `app.commission_of_*` helpers), **skipping when both
  keys are NULL** (name-only rows never enter the index); DELETE **stamps, never deletes** —
  `disposed_at = now()`, `disposed_reason = coalesce(current_setting('app.phi_dispose_reason', true), 'other')`.
  The trigger resolves its entity-id + module **generically from `TG_TABLE_NAME`** (the three
  PHI tables have different entity-id columns — `event_id`/`referral_id`/`case_id` — so it must
  never statically dereference one table's column).
- **Both triggers are ALWAYS-ON (NOT flag-gated)** — and this is deliberate. Keys are
  non-identifying and `patient_xref` is QPS-only + key-only, so deriving/maintaining them
  regardless of flag state has **zero exposure**: the flag gates only the RPC doors + the UI.
  Always-on (a) fixes the seed cleanly (the data layer is consistent regardless of flag order),
  and (b) honors the "no prod backfill" decision *better* — keys exist immediately after any
  reset/write, so enabling the feature is a **single flag flip with no backfill step**
  (eliminating a "backfill after flip" footgun). `app.backfill_patient_keys()` is retained as a
  manual **repair tool only** (e.g. after a pepper rotation).

### 5. DEFINER doors (each asserts the flag first line)

- `public.search_patient_xref(p_mrn, p_encounter)` — gate `app.is_pqs_member(auth.uid())`
  (empty for non-PQS); hash inputs; match `patient_xref`; assemble the cross-committee
  trajectory (entity codes/numbers, commission names, dates, disposed flag — **no raw PHI**).
  Emit **`patient.searched`** only when matches ≥ 1.
- `public.patient_access_audit(...)` — PQS-gated; returns `audit_log` rows for
  `entity_id IN (SELECT entity_id FROM patient_xref WHERE patient_key = …)`, **bypassing
  per-commission audit RLS by design** (a QPS-only cross-committee view), non-PHI columns
  only. Reading the audit is **not** re-audited.
- `public.patient_xref_count(p_module, p_entity_id)` — the ONE non-QPS door, gated on
  `app.can_read_referral_phi(...)`; returns the **COUNT** of other non-disposed xref rows
  sharing the referral's `patient_key` (excluding self). Count only — no entity list, no
  identity.
- `public.patient_index_enabled()` probe + `app.assert_patient_index_enabled()` (mirror
  `case_patient`).

### 6. Referral transmission + receiver hint (additive)

- The key travels on the referral because `referral_patient` carries `patient_key` /
  `encounter_key` like every PHI table — **no new transport**, the existing isolated row
  participates in the index. B's referral detail shows **"Este paciente aparece em N outros
  registros"** via `patient_xref_count('referral', referralId)`. B earns the **count** without
  QPS membership and **never** the MRN or the other records' identity.

### 7. Audit routing — GLOBAL chain, key-only metadata

- `patient.searched` / `patient.viewed` route through `app.audit_write(…, p_commission => NULL, …)`
  on the **GLOBAL** chain, **not** `public.log_audit_access` — the latter's allow-list and the
  FE `src/lib/audit/access.ts` wrapper both bake in "access rows are commission-scoped," which
  is false for a cross-committee patient lookup. Metadata is **key-only**:
  `{patient_key: left(key,12)||'…', matches: n}` — **never the raw MRN/name** (Rule 11).
  `patient.viewed` is emitted when a trajectory is opened (key-only, global chain). The two new
  labels are registered for DISPLAY only in `src/lib/queries/audit.ts` (NOT in `access.ts`).

### 8. Disposal — retain, mark disposed (referrals cascade-only)

- The xref row is **RETAINED on PHI disposal** and stamped `disposed_at` + `disposed_reason`
  (the keys are non-identifying, and the historical access rows must still correlate to the
  patient). `dispose_case_phi` + `dispose_event_phi` are edited (forward-only
  `CREATE OR REPLACE`) to `set_config('app.phi_dispose_reason', p_reason, true)` and stamp the
  xref **inside their existing `in_*_rpc` bypass window**, before deleting the PHI row.
- There is **no `dispose_referral_phi`** (a pre-existing Phase-22 gap — `case_referral` lacks
  `phi_disposed_*`). Referral xref disposal is therefore **cascade-only**:
  `referral_patient` FK `ON DELETE CASCADE` → the AFTER-DELETE trigger stamps the xref with
  reason `'other'`. The mechanism is built generically (txn-local reason GUC +
  stamp-don't-delete) so `dispose_referral_phi` plugs in with **no rework** when built
  (recorded as a follow-up).

### 9. Bootstrap & phasing

- Keys exist as soon as a PHI row is written, via the **always-on derivation trigger** (Decision
  4) — including every seed row on `db reset`. **No backfill step is needed** on enablement:
  flipping `patient_index` ON simply opens the (already-populated) data to the RPCs/UI. (Prod is
  test/seed only → DB reset bootstraps; there is no prod backfill regardless.)
  `app.backfill_patient_keys()` — idempotent, DEFINER, local/CI-only — is retained as a manual
  **repair tool only** (e.g. re-keying after a pepper rotation, or rebuilding `patient_xref` if
  it were ever cleared); it raises if the pepper is absent.
- Ships as **new Phase 23**, feature flag **`patient_index` OFF** (gates RPC/UI exposure only;
  the data layer is live regardless). Single migration
  `supabase/migrations/20260620019000_patient_index.sql`. Full §6 gate.
- **Single-tenant** (one hospital per deployment, verified) → **no facility namespacing**; the
  per-deployment pepper suffices to scope keys to this hospital.

## Alternatives considered

- **Supabase Vault for the pepper** — rejected: empty during `db reset`→seed, breaking
  trigger derivation on the seed's direct inserts (see Decision 2).
- **Postgres GUC `app.mrn_pepper` (`ALTER DATABASE … SET`)** — originally approved, then
  rejected after it failed at apply: setting a custom GUC database default requires SUPERUSER,
  which the migration role is not (locally `42501`; same on Supabase Cloud). Replaced by the
  `app.app_secrets` table (see Decision 2).
- **Name/DOB fuzzy matching** — rejected: a false cross-link is a privacy breach; exact-match
  only (Decision 1).
- **Column/application-level encryption of the MRN** (pgcrypto) instead of a separate keyed
  hash — already **declined platform-wide** in ADR 0035 (a compromised app role decrypts on
  read; co-locates keys with data; breaks search/sort). The keyed hash is a *linkage* control,
  orthogonal to at-rest encryption, and never needs to be reversed.
- **A reversible mapping table (key → raw MRN) for QPS** — rejected: it would re-introduce a
  PHI store outside the three isolated tables and defeat the "raw MRN never leaves its table"
  invariant. QPS reaches identifiers only by drilling into a specific record through its
  existing audited door.
- **Storing the key on the governance rows** (e.g. `cases.patient_key`) instead of the
  isolated PHI rows — rejected: it would leak a (weak) patient correlator onto PHI-free
  list/board/dashboard projections. The key lives only on the already-isolated PHI rows and in
  the QPS-only `patient_xref`.

## Consequences

- **Positive:** the same patient is recognizable across committees with **no new PHI store**;
  QPS gets a trajectory + access audit; referral receivers get a useful count without
  identity; every reassembly is audited; disposal stays LGPD-compliant while keeping
  correlatable history.
- **Negative / residual:**
  - **Exact-match misses** (typos, alternate MRNs) won't link — accepted to avoid
    false-positives.
  - **Pepper rotation** orphans disposed-row keys (the raw MRN is gone, so the key can't be
    recomputed). The `app.app_secrets['mrn_pepper']` value is a stable, long-lived secret;
    rotation is a documented residual, **not** built (follow-up).
  - **`dispose_referral_phi`** does not exist; referral xref disposal is cascade-only until it
    is built (follow-up; the generic mechanism is ready).
  - The cross-committee access-audit door **bypasses per-commission audit RLS** by design — an
    accepted, documented QPS-only widening (Decision 5), scoped to non-PHI audit columns.

## Follow-ups

- `dispose_referral_phi` — give referrals an LGPD-erasure RPC (the generic xref disposal
  mechanism is built so it plugs in with no rework).
- Pepper rotation strategy for `app.app_secrets['mrn_pepper']` (documented residual).

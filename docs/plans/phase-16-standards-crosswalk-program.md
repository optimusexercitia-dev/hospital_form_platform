# Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 — Implementation Plan

## Context

Phase 16 makes the platform *aware of accreditation standards*: commissions link the artifacts
they already produce (forms, meetings, cases, indicators, CAPA plans, controlled documents,
charters, ethics procedures) as **evidence** against ONA/JCI/custom standards, self-assess
conformity, and get a **readiness/gap report**. It was deferred 2026-07-11, externally audited
2026-08-03 ([phase-16-external-accreditation-audit.md](../reviews/phase-16-external-accreditation-audit.md)),
and replanned by **ADR [0093](../decisions/0093-phase-16-standards-crosswalk-replan.md)**
(decisions D1–D10 + Amendment 1 — the authority for this plan). **The pilot deploy is re-gated on this phase**
(D1). Flag: `accreditation`. Executed by the agent-team process (lead + backend/frontend/tester/qa,
Phase Gate per CLAUDE.md §6).

**PO rulings collected 2026-08-03 (planning interview — treat as ratified, do not re-ask):**
1. **CAPA evidence arm:** linkable if `capa_plan.hospital_id` = hospital of the linking
   commission AND the linker holds `can_read_capa`. (Source-derived commission match rejected —
   event/RCA-sourced CAPAs resolve to no commission.)
2. **Framework RLS:** global packs SELECT-able by all authenticated; **commission-owned
   frameworks readable only by that commission's members** (pasted licensed text must not leak
   cross-tenant). This deliberately narrows ADR 0093 D10's letter — record the ruling in the
   rewritten spec section.
3. **Hospital sidebar:** "Acreditação" gets a **visible** entry under "Acompanhamento"
   (flag-gated) in `org-manage-sidebar.tsx`.
4. **ONA seed:** backend **drafts** the seção/subseção codes + short titles + level 1/2/3
   skeleton from the public ONA manual structure; **the PO validates/corrects the draft before
   the seed migration is authored** (build-blocking review at end of Wave 1). Skeleton only —
   codes + titles + hierarchy + level, **never `description_md` manual text** (D2).

**Standing constraints:** graphify before reading source (project hook); live catalog is truth
for SQL, `docs/backend-state.md` over migration text; `prosecdef` beside `pg_policies`; the
ADR 0079 door audit (`supabase/tests/mutation/p0-authz-invariant.sh`) must keep passing;
pt-BR user-facing text; frontend-design skill before new screens.

---

## Wave 0 — Lead + contract (before any feature code)

- [ ] Lead rewrites `docs/phases/accreditation-track.md` §Phase 16 against ADR 0093 + the four
      PO rulings above (an ADR 0093 consequence, still pending).
- [x] **Backend verified the build-start facts against the live catalog (2026-08-03).** Results —
      three corrections, all confirmed by the lead against `pg_proc`:
      - **Migration high-water `20260903000700`** — CONFIRMED; registered (243) == files (243), no
        drift. Allocate strictly above it.
      - **pgTAP next free = 278** — CONFIRMED. The duplicate `270_` filename does **not** break
        `supabase test db` (it takes paths, not an index); it is a numbering-hygiene trap only —
        never cite "pgTAP 270" unqualified, never reuse 270.
      - **SQLSTATE high-water = `HC0Q8`, NOT `HC0Q6`** ⚠ **CORRECTED**. FF-4 consumed Q6/Q7/Q8
        (`save_block_to_library`, `update_block_library_entry`, `insert_block_from_library`,
        `delete_block_library_entry`) — ADR 0092's own text says "allocates from `HC0Q6`" and
        understated its real consumption, and `docs/backend-state.md` carried TWO stale rows
        (HC0Q5 at :1463, HC0Q6 at :604). **Phase 16 allocates from `HC0Q9`** (renumbered below).
        Another instance of the standing rule: the catalog is truth, an ADR's prose is not.
      - **`action_items` has no status CHECK** ⚠ **CORRECTED, structurally**. `status_id` is an FK
        into the tenant-extensible catalog `action_item_statuses`; the only fixed vocabulary is its
        `category` CHECK (`draft, open, in_progress, blocked, waiting_review, completed,
        cancelled`) — `key`/`label` are free tenant text. Migration B's action_item arm **must
        join `action_item_statuses.category`, never switch on a status string.**
      - **`controlled_documents`** (not `documents`): `draft, in_approval, changes_requested,
        effective, obsolete`. ⚠ D5's matrix never mentions **`changes_requested`** (landed later,
        ADR 0081/0082) — see the PO ruling recorded in Wave 1.
      - CONFIRMED: `meetings.status` = `scheduled, held, in_signature, signed, distributed,
        cancelled` · `capa_plan.status` = `open, in_execution, in_verification, completed,
        cancelled` · `form_versions.status` = `draft, published, archived` · `indicators.frequency`
        = `mensal…anual` · `indicator_measurements.status` = `on_target, off_target, no_data`
        (**English in storage**; the pt-BR `na_meta`/`fora_da_meta`/`sem_dados` of D5's prose are
        UI labels only — the matrix must key off the English values).
      - CONFIRMED: no `accreditation` row in `app.feature_flags(key, enabled, description)`;
        `enabled` **defaults to `true`**, so seeding OFF requires an explicit `enabled = false`.
- [x] **Backend committed the contract** (`de2404c`): `src/lib/accreditation/types.ts` +
      `src/lib/queries/accreditation.ts` (typed stubs; typecheck + lint clean). Frontend is
      unblocked. Key types: `ArtifactKind` (the 8 + `charter` + `ethics_procedure`),
      `AssessmentStatus` (`conforme|parcial|nao_conforme|nao_aplicavel`), `EvidenceStatus`
      (`valida|atencao|vencida`), `ReadinessRow` (per-standard: level, assessment, evidence
      counts split by status + `evidenceRestrita`; **never `note`**), `EvidenceItem` (masked →
      label "Evidência restrita", `note: null`, `restricted: true`), `HospitalReadinessRow`
      (`consolidatedStatus`, `resolution: 'unanime'|'pior_caso'|'responsavel'`,
      `responsibleCommissionId`).
- [ ] **Rollup-math split:** DEFINER doors return per-standard rows (DB computes freshness,
      masking, worst-wins, ownership override); per-level ONA rollups / per-chapter % /
      "o que bloqueia o Nível N?" gap lists are a pure TS function
      `computeReadinessRollups()` in `src/lib/accreditation/rollups.ts` (Vitest-tested, shared
      by both surfaces).
- [ ] File the adjacent authz bug found during planning (NOT in phase scope): **the residual
      `is_admin()` arm on `hospital_document_register` and `hospital_indicator_rollup`** — the
      BUG-AUTHZ-001 sweep (`20260903000700`) fixed 5 `dashboard_*` fns but not these two
      hospital doors; both return commission content to platform_admin (noun-rule violation).
      Fix in its own migration + a `270_authz_dashboard_gate_uniformity.sql`-style parity
      extension, ideally before the pilot deploy.

## Wave 1 — Backend: schema + belongs/freshness (Migrations A–B, pgTAP 278–279)

**Migration A — schema.** Tables per ADR 0093 D2/D3/D4/D7:
- `accreditation_frameworks`: `id, key, name, version, description, owner_commission_id`
  (NULL = global), `cloned_from_framework_id` (D9 provenance), `status ativo|arquivado`.
  Uniques: `(key, version) where owner is null`; `(owner_commission_id, key) where owner not null`.
- `accreditation_standards`: `framework_id, parent_id, code, title, description_md, position`,
  **`level smallint null check (1..3)`** (D3; NULL for non-leveled/JCI). `unique(framework_id,
  code)`; same-framework parent via composite FK `(framework_id, parent_id) →
  (framework_id, id)`.
- `evidence_links`: `commission_id, standard_id, artifact_kind` CHECK in the **10-kind** list,
  `artifact_id, note, linked_by/at`; `unique(commission_id, standard_id, artifact_kind,
  artifact_id)` (deliberately permits the same case uuid under both `case` and
  `ethics_procedure` — distinct evidentiary claims; pin in E2E). PHI-discouragement comment on
  `note` (D8).
- `standard_assessments`: `commission_id, standard_id, status` (4-value CHECK), `assessed_by/at,
  note_md`; `unique(commission_id, standard_id)`.
- `standard_ownerships` (D7 — narrow exception to ADR 0057 §2): `hospital_id, standard_id,
  responsible_commission_id, assigned_by/at`; `unique(hospital_id, standard_id)`; trigger:
  responsible commission's hospital must equal `hospital_id`.
- **RLS:** frameworks/standards SELECT = `owner IS NULL OR app.is_member_of(owner)` (PO ruling
  2); `evidence_links`/`standard_assessments` SELECT = `is_member_of(commission_id)`;
  `standard_ownerships` SELECT = members of the hospital's commissions + hospital_admin. **No
  write grants to `authenticated` anywhere** — all writes DEFINER (indicators/documents
  posture).
- **Audit triggers** per table, cloning `app.trg_audit_indicators`
  (`supabase/migrations/20260712000000:231-269`): allow-listed `c_cols` (exclude `note`,
  `note_md`, `description_md`), `app.audit_write(...)` + `app.audit_diff(...)`.
- Seed flag `accreditation` **OFF** (`on conflict do nothing`).

**Migration B — dispatch predicates** (precedent: `app.commission_of_attachment` owner-dispatch,
migration `20260717000000`):
- `app.artifact_belongs_to_commission(kind, artifact, commission)` — one arm per CHECK value;
  resolvers: `forms.commission_id` / `app.commission_of_version` / `commission_of_meeting` /
  `commission_of_case` / `indicators.commission_id` / `commission_of_document` /
  `commission_of_action_item`; **charter = identity** (`artifact_id = commission_id` and a
  `commission_charters` row exists); **ethics_procedure** = `ethics_case_details` row exists AND
  `commission_of_case = commission`; **capa_plan = PO ruling 1** (hospital match; the read check
  lives in `link_evidence`). `ELSE raise` — never silent false on an unknown kind.
- `app.evidence_status_of(kind, artifact)` — `valida|atencao|vencida` per the D5 matrix.
  **`controlled_documents`** (note: not `documents`) mirrors `documents_due_for_review`
  (`20260713000200:44-81`) with the live 5-value status set — `effective` +
  `review_due_date >= current_date` = **valida** · `in_approval` = **atencao** ·
  **`changes_requested`** (PO ruling 2026-08-03, ADR 0093 A2·3 — a refused document is absent
  proof, not weak proof) / `draft` / `obsolete` / review overdue = **vencida**; form/form_version use
  `form_versions.review_due_date` (archived or superseded-published = vencida); indicator:
  ativo + measurement in current `frequency` window + latest `na_meta` = valida;
  `off_target`/`no_data` = atencao; no measurement in window or arquivado = vencida.
  ⚠ **`indicator_measurements.status` stores ENGLISH** (`on_target`/`off_target`/`no_data`) —
  D5's `na_meta`/`fora_da_meta`/`sem_dados` are UI labels only; keying the matrix off the pt-BR
  names would match nothing and fail **open**.
  Charter inherits its linked bylaws document's status; case/ethics_procedure always valida;
  capa_plan (`open, in_execution, in_verification, completed, cancelled`) and meeting
  (`scheduled, held, in_signature, signed, distributed, cancelled`) per their live CHECKs.
  ⚠ **`action_item` has NO status CHECK** — join `action_item_statuses.category`
  (`draft, open, in_progress, blocked, waiting_review, completed, cancelled`); `key`/`label` are
  free tenant text, so switching on a status string would mis-bucket every custom status
  silently. **Invariant (D5): stale evidence never silently counts — counts always split.**
  Corollary for the builder: every arm fails **closed** on an unrecognized value (`ELSE raise`),
  never defaults to `valida` — the standing "guards that read right but fail open" trap.

**pgTAP 278** (schema census: tables/CHECKs/uniques/RLS/grants/triggers/flag row OFF) and
**279** (**arm parity by construction**: iterate the CHECK's kind list, assert both dispatch
functions handle every value; positive+negative belongs per kind incl. cross-hospital CAPA
rejection). Green on **fresh `supabase db reset`**; regenerate types (`npm run gen:types`,
pgTAP schema dropped per the known pollution issue).

**End of Wave 1:** backend drafts the **ONA skeleton CSV** (codes/titles/levels) + JCI chapter
skeleton → **PO validates** (build-blocking for Migration F only).

## Wave 2 — Backend RPCs/doors/seed ∥ Frontend scaffolding

**Backend (Migrations C–F, pgTAP 280–284).** Every RPC opens with
`app.assert_accreditation_enabled()` (→ HC0Q9 — renumbered from the plan's original HC0Q7 after
Wave 0 found the true high-water is HC0Q8).

- **C — framework CRUD:** `create/update_framework`, `set_framework_status`,
  `upsert/delete_standard` — global packs: `app.is_admin()` **only** (the one correct
  `is_admin` use — vocabulary/catalog arm, D6); custom: `is_staff_admin_of(owner)`.
  `clone_framework(framework, commission)` (D2): staff_admin; copies rows + hierarchy
  (two-pass parent remap), sets `owner_commission_id` + `cloned_from_framework_id`; the clone
  is where hospitals paste licensed text.
- **D — evidence/assessment:** `link_evidence` (staff_admin; guard order: flag → belongs →
  `can_read_case` for case/ethics kinds → `can_read_capa` for capa_plan → duplicate → insert);
  `unlink_evidence`; `set_standard_assessment` (staff_admin upsert);
  `set_standard_ownership` (**`is_hospital_admin_of` only** — D7; NULL clears; validates
  commission ∈ hospital); `evidence_candidates(commission, kind, query)` — staff_admin DEFINER
  search feeding the picker (per-kind SELECTs; cases filtered by `can_read_case`, CAPA by
  `can_read_capa`); **map the flag-off SQLSTATE on the search path too** (the FF-5 HC0Q3
  lesson).
- **E — the three read doors**, structurally mirroring `hospital_document_register`
  (`20260713000200:92-118`: empty-deny, search_path pinned, owner postgres, t19 list) but
  **without its `is_admin()` arm** (D6):
  - `readiness_report(commission, framework)` — gate `is_member_of`; per-standard rows;
    restricted case/ethics links counted in `evidence_restrita` only; never returns `note`.
  - `readiness_evidence(commission, standard)` — per-link items; masking per D8
    ("Evidência restrita", `note = null`).
  - `hospital_readiness(hospital, framework)` — gate `is_hospital_admin_of OR
    is_org_admin_of(org_of_hospital)` **only**; consolidation per D7: ownership row →
    `resolution='responsavel'` (that commission's assessment is the answer); else worst-wins
    `nao_conforme > parcial > conforme`, `nao_aplicavel` only if unanimous; counts only.
  - All four DEFINERs (incl. `evidence_candidates`) enter the **ADR 0079 standing door audit**
    with mutation-proven reader-non-writer keystones.
- **F — seed packs** (after PO CSV validation): ONA (leveled) + JCI chapter skeleton
  (level NULL), **fixed UUIDs** in a constants block for deterministic tests; skeleton only.
- **SQLSTATEs — allocated from `HC0Q9`** (Wave 0 verified the live high-water is `HC0Q8`; the
  original plan's `HC0Q7` base would have COLLIDED with FF-4's live block-library raises):
  **HC0Q9** flag off · **HC0QA** belongs/not-linkable · **HC0QB** duplicate link · **HC0QC**
  invalid target (parent/framework/hospital/level) · **HC0QD** global pack read-only
  ("…clone o framework para editá-lo.") · **HC0QE** framework arquivado. pt-BR messages in the
  migration + `src/lib/accreditation/messages.ts`. **Ledger note (Migration A, 2026-08-03):** the
  `standard_ownerships` hospital-mismatch *guard trigger* deliberately raises plain
  `check_violation` (23514), **not** a curated HC0Q code — matching the
  `guard_membership_hospital_org` precedent that a schema-level defence-in-depth backstop uses the
  generic code while the RPC pre-validates and raises the curated pt-BR message first. So
  **`HC0QC` is still free** and is the code `set_standard_ownership` raises. Re-verify the
  high-water at Wave 2 start —
  no other phase should be allocating, but the check is cheap and this lane has now gone stale twice.
- **pgTAP 280** (CRUD doors: platform_admin global-only; staff_admin custom-only; clone
  fidelity; HC0QD/HC0QE; flag-off HC0Q9 on every RPC) · **281** (evidence/assessment RLS +
  write rejection for plain `staff`; HC0QB; link-time `can_read_case`; audit rows) ·
  **282** (freshness matrix cell-by-cell incl. boundary `review_due_date = current_date`,
  frequency windows) · **283** (readiness doors: member rows / foreign zero /
  **platform_admin ZERO rows from all doors** (D6, the BUG-AUTHZ-001 assertion) / restricted →
  `evidence_restrita` / SELECT-list census proves no note columns / door parity — no
  `is_admin()` arm) · **284** (hospital rollup: worst-wins total order; unanimity rule;
  ownership override incl. override-to-unassessed → null; clearing reverts; foreign
  hospital_admin + cross-org zero; ownership write = hospital_admin only, org_admin write
  rejected).

**Frontend (parallel, against the contract; invoke `frontend-design` skill first):**
- ⚠ **Ownership correction (lead, 2026-08-03):** this plan originally gave the flag wiring
  (`accreditation` → `FeatureFlags` + `accreditationEnabled()` in
  `src/lib/queries/feature-flags.ts`) to **frontend**. `src/lib/queries/` is **backend-owned**
  under CLAUDE.md §4, and file ownership is binding — two teammates never edit one file in a
  phase. **Reassigned to backend**, as its first Wave 2 item so it lands before frontend needs
  the gate. Frontend imports the helper and sequences the routes last.
- `src/lib/accreditation/{actions.ts,messages.ts,rollups.ts}` — `'use server'` ActionState +
  `mapError` on SQLSTATE + `revalidatePath` via `commissionHref`/`orgHref`
  (`src/lib/routing.ts`); conventions per `src/lib/indicators/actions.ts`.
- Routes `src/app/o/[org]/c/[commission]/manage/acreditacao/` cloned from
  `manage/indicadores/` (layout flag→`notFound` + access→`notFound`; page; loading; error;
  `[framework]/` master-detail; `[framework]/padrao/[standard]/`; `[framework]/prontidao/`).
- Components `src/components/accreditation/`: framework list + clone dialog; **standards tree
  as a semantic nested-`<ul>` progressive-disclosure list** (native `<button aria-expanded>`
  per branch, link per standard, status chip + evidence-count badge, Nível badges on ONA rows)
  — do NOT build a `role=tree` widget (no precedent in the codebase; chips per
  `case-phase-list.tsx`, hierarchy cues per `forms/read-only-tree.tsx`); standard panel
  (assessment form + note_md with PHI-discouragement helper text, evidence list with
  valida/atenção/vencida chips and restricted masking, unlink).

## Wave 3 — Frontend wiring + hospital surface ∥ Tester

**Frontend:**
- Evidence picker: kind selector + searchable ARIA combobox cloned from
  `src/components/responses/wizard/reference-picker.tsx` (debounced → `evidence_candidates`);
  simple-select fallback per `rca-evidence-forms.tsx` for low-cardinality kinds (charter has
  exactly one candidate).
- Readiness dashboard: Recharts islands (`run-chart.tsx` + `run-chart-loader.tsx` dynamic-import
  pattern); leveled → per-level bars + "O que bloqueia o Nível N?" gap list (cumulative: level
  N needs ≤ N clean, D3); non-leveled → per-chapter % + overall % + gap list; freshness split
  always visible ("2 evidências — 1 vencida"), never a bare count (D5).
- Hospital surface `src/app/o/[org]/manage/acreditacao/page.tsx` cloned from
  `manage/documentos/page.tsx` + `hospital-document-register.tsx` +
  `getHospitalDocumentRegister` (flag→notFound; `getSessionContext`; hospitals =
  `hospitalAdminOf` ∪ `listHospitalsForOrg` when org_admin; `Promise.all` per-hospital DEFINER
  calls, foreign → `[]`). Consolidated table with `resolution` indicator + **ownership editor**
  (hospital_admin-enabled; org_admin read-only; server enforces regardless). Counts only, no
  note text (D8).
- Nav: commission entry in `app-sidebar.tsx` (`requiresFeature: 'accreditation'`); **visible**
  org entry under "Acompanhamento" in `org-manage-sidebar.tsx` (PO ruling 3).
- Vitest: `rollups.ts` unit suite (level gating, chapter %, gap-list derivation).

**Tester (e2e/, header docblocks naming ADR 0093 + acceptance; self-fixtures via service-role
REST with identity-based cleanup — never positional; personas per seed):**
1. `phase16-accreditation-core.spec.ts` — ONA tree with level badges; link form+meeting+
   indicator → evidenced, leaves gap list; assess `nao_conforme` → enters gap list, **assert
   the computed rollup value**; `staff1.ccih` no edit + server rejection; `chefe.farm` foreign
   artifact rejected (HC0QA message); audit rows asserted; keyboard-only pass (tree → assess →
   picker → link).
2. `phase16-accreditation-freshness.spec.ts` — vigente doc = válida; backdated
   `review_due_date` = vencida with split count; indicator unmeasured-in-window = vencida,
   `fora_da_meta` = atenção; archived form version = vencida.
3. `phase16-accreditation-hospital.spec.ts` — CCIH `conforme` vs Farmácia `nao_conforme` →
   `hospitaladmin.a1` sees pior-caso; sets responsável → resolution flips; clears → reverts;
   `orgadmin.b` cross-org zero; DOM assert: no note text on the hospital surface; keyboard
   pass on the ownership editor.
4. `phase16-accreditation-restricted.spec.ts` — restricted ethics case linked as
   `ethics_procedure`: non-ACL member sees "Evidência restrita"; same uuid linked as both
   `case` and `ethics_procedure` coexists (pins the double-link posture);
   **`platform@test.local` RPC probes to all three doors return zero rows** (D6).
5. `phase16-accreditation-clone.spec.ts` — clone global ONA; paste `description_md` into the
   clone; editing the global pack fails (HC0QB message); another org's user cannot see the
   clone (PO ruling 2).

## Wave 4 — Phase Gate + pilot

1. Build: lint (`--max-warnings=0` + `lint:css-vars`), typecheck, Vitest, **real `next build`**,
   pgTAP on fresh `supabase db reset` (`npm run test:db`), `p0-authz-invariant.sh` with the new
   doors registered.
2. Full `npm run e2e:prod` to declare green. ⚠ **BUG-P15-001 calendar check first**: PROGRESS
   carries both the "reds on the 1st–4th" warning and a 2026-08-03 spec-side fix
   (commit `93a0f9a`) — verify which is live; if unfixed, don't schedule the declare-green run
   on the 1st–4th of a month. Triage vs the flaky baseline; check batch numbering + denominator
   vs `spec-counts.txt`; grep `reset FAILED`.
3. QA review (focus: D6 zero-rows, D8 masking/counts-only, keystone mutations actually red
   when reverted, arm parity, `prosecdef` census beside `pg_policies`).
4. Human approval → **Record**: apply Migration G (`enable_accreditation` one-line flip, the
   `20260903000600` shape) + seed.sql force-ON; regenerate types; update
   `docs/backend-state.md` (new tables/doors/SQLSTATEs; fix the stale HC0Q5 high-water row);
   PROGRESS.md; verify accreditation-track §16 matches as-built; commit
   `phase(16): complete — …`.
5. **Pilot deploy sequence** (ADR 0093 D1, user-gated): origin push + Coolify deploy + remote
   `db push` (remember: remote push needs the user's auth; background agents are auto-denied).

## Risks / open items

- **ONA CSV validation (PO)** is the only external build-blocker — request at Wave 1 end;
  Migration F is the only artifact waiting on it.
- The freshness matrix's meeting/capa/action-item arms depend on Wave-0 enum verification.
- The adjacent `is_admin()` residue on `hospital_document_register` / `hospital_indicator_rollup`
  is filed but out of scope — do not let its fix ride a Phase 16 migration.
- Two sessions/one local DB: allocate migration windows above the highest **registered**
  version; fresh reset before pgTAP; don't run the gate while another session holds
  `.next/standalone`.

## Verification summary

pgTAP 278–284 green on fresh reset · `p0-authz-invariant.sh` green with 4 new doors ·
platform_admin zero-rows proven at both pgTAP and E2E layers · Vitest rollups suite ·
5 E2E specs incl. keyboard-only passes · full `e2e:prod` green · QA APPROVED review doc ·
flag flip only via Migration G at Record.

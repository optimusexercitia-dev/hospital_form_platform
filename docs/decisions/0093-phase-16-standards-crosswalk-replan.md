# 0093 — Phase 16 replan: Standards Crosswalk & Readiness/Gap Engine v2

**Date:** 2026-08-03 · **Status:** accepted (product-owner rulings, interview 2026-08-03) ·
**Supersedes:** the Phase 16 portions of ADR [0057](0057-indicators-doc-control-replan.md) and
the frozen spec in [docs/phases/accreditation-track.md §Phase 16](../phases/accreditation-track.md)
(2026-07-05); amends ADR [0086](0086-flexible-forms-pre-pilot.md)'s pilot gate. ·
**Informed by:** the external accreditation audit
[docs/reviews/phase-16-external-accreditation-audit.md](../reviews/phase-16-external-accreditation-audit.md)
(findings MAJOR-1…6 / MINOR-1…3 referenced below). · **Flag:** `accreditation` (seeded OFF;
flipped by its **own enable migration** at the phase gate — the FF-program lesson: no enable
migration = phase dark after `db push`).

## Context

The Phase 16 spec was frozen 2026-07-05 (ADR 0057). Since then the platform changed underneath
it: the **noun rule** (ADR 0078 A35, 2026-07-15 — platform_admin may not read commission
content) and the **standing door-audit invariant** (ADR 0079, plus BUG-AUTHZ-001 proving the
DEFINER-gate failure mode is real); the **Phase 17 v2 document redesign** (ADR 0081) that the
evidence picker must now target; **committee charters shipped** (Phase 21 CH, ADR 0080) and the
**ethics track** landed E1–E3a (ADRs 0072/0073) leaving E3b blocked on this phase (ADR 0071
item 8); and the **FF program completed** (ADRs 0086–0092), moving the SQLSTATE high-water to
`HC0Q6` and removing Phase 16 from the pilot gate. The external audit additionally found the
readiness model unable to answer the ONA question, the seed packs a licensing exposure, and
evidence-presence counting a false-assurance risk.

## Decisions

1. **Sequencing — pre-pilot, re-gating the pilot** (PO 2026-08-03; reverses ADR 0086's
   deferral note). Phase 16 builds now on the FF-complete baseline; the pilot deploy (Coolify +
   origin push + remote `db push`) follows Phase 16's Phase Gate. ETH·E3b **folds into this
   phase** (see D4) and stops being a separate workstream.
2. **Framework packs are skeleton-only** (audit MAJOR-2). Global admin-curated packs seed
   **codes + short titles + hierarchy + level only** — never `description_md` text from the
   copyrighted manuals (ONA; JCI via CBA/JCR). Global-pack standard rows are read-only
   reference data; hospitals wanting full text **clone a global skeleton into an owned custom
   framework** (`clone_framework` RPC, staff_admin) and paste descriptions there under their
   own manual license. No per-tenant overlay on shared rows — a paste into a global pack would
   leak licensed text cross-tenant.
3. **ONA level dimension** (audit MAJOR-1). `accreditation_standards.level smallint NULL`
   (1 = Segurança, 2 = Gestão Integrada, 3 = Excelência; NULL for non-leveled frameworks).
   For leveled frameworks `readiness_report` returns **per-level rollups + a blocking-gap list
   per level** ("o que bloqueia o Pleno?"); the chapter/overall % rollup is kept for
   non-leveled (JCI-shaped) frameworks. Certification logic is cumulative: level N readiness
   requires levels ≤ N clean.
4. **Evidence enum re-derived from the live artifact registry** (audit MAJOR-6; PO 2026-08-03):
   the 2026-07 eight **plus `charter`** (Phase 21) **and `ethics_procedure`** (closes ETH·E3b,
   ADR 0071 item 8). Safety events / RCA **declined** for now — post-pilot, demand-driven.
   Document linking re-bases on the ADR 0081 v2 model. The `app.artifact_belongs_to_commission`
   guard gains one arm per kind — enumerate from the authority (the registry), not this list
   (the "every sibling arm" rule).
5. **Evidence freshness in the readiness output** (audit MAJOR-3). A link is a claim, not
   proof: the report computes per-link `evidence_status ∈ {valida, atencao, vencida}` from the
   artifact's own lifecycle (document not `vigente` / review overdue; indicator off-target or
   unmeasured in its current periodicity window; archived form version) and splits counts —
   stale evidence never silently counts toward "evidenced".
6. **AuthZ re-base — the noun rule is binding** (audit MAJOR-5). `hospital_readiness` and the
   hospital-wide UI are gated `is_hospital_admin_of` / org-admin (the
   `hospital_document_register` pattern) and live on the **hospital-admin surface, not
   `/admin`**. platform_admin keeps **global pack CRUD only** (vocabulary/catalog arm). Both
   DEFINERs (`readiness_report`, `hospital_readiness`) enter the ADR 0079 standing door audit
   with reader-non-writer keystones; pgTAP asserts platform_admin receives **zero rows** from
   the readiness doors (the BUG-AUTHZ-001 shape, tested by construction).
7. **Hospital consolidation — worst-wins + responsible commission** (audit MAJOR-4; PO
   2026-08-03). The rollup resolves conflicting per-commission assessments by
   **worst-status-wins** (`nao_conforme > parcial > conforme`; `nao_aplicavel` only if
   unanimous). New table `standard_ownerships` (`hospital_id`, `standard_id`,
   `responsible_commission_id`, unique per hospital+standard), written by
   `is_hospital_admin_of`: when set, that commission's assessment **is** the institutional
   answer. This is a deliberate, narrow exception to ADR 0057 §2's no-new-write-tier stance —
   the hospital tier writes an assignment pointer, never assessments or evidence.
8. **Restricted-artifact masking + note hygiene** (audit MINOR-2/3). Evidence rendering
   re-checks the artifact's own read predicate (`can_read_case` for cases/ethics procedures);
   a non-reader sees "evidência restrita" — count without payload. Hospital-tier and export
   surfaces carry **counts only, never `note`**. `evidence_links.note` gets the standing
   PHI-in-free-text discouragement copy; the module stays PHI-free (Rule 12 N/A).
9. **Edition re-mapping is designed, not built** (audit MINOR-1). Durable identity is
   `(framework.key, standard.code)`; a future manual edition ships as a new framework version
   plus a `remap_standard_links` pass carrying links/assessments by code match. Pre-launch
   reset-OK makes building it now premature.
10. **Mechanics.** Next-dated migrations (allocate above the live registered high-water —
    shared-stack rule); SQLSTATEs from ~~`HC0Q7`~~ **`HC0Q9`** (this text was wrong — see
    Amendment 2; the "verify against the catalog, not this text" instruction is what caught it);
    RLS as spec'd 2026-07 otherwise (frameworks/standards SELECT to
    authenticated; `evidence_links` + `standard_assessments` member-READ /
    staff_admin-WRITE, commission-scoped); generated types + `docs/backend-state.md` updated
    at the Record step.

## Amendment 1 (2026-08-03, PO planning interview — build-plan rulings)

Ratified while authoring the implementation plan
([docs/plans/phase-16-standards-crosswalk-program.md](../plans/phase-16-standards-crosswalk-program.md)
— the execution plan for this ADR; do not re-ask these):

- **A1·1 — CAPA evidence arm (completes D4):** a `capa_plan` is linkable when
  `capa_plan.hospital_id` equals the linking commission's hospital **and** the linker holds
  `can_read_capa`. Source-derived commission match was **rejected** — `capa_plan` has no
  commission column and event/RCA-sourced plans resolve to no commission, which would make
  them unlinkable by construction.
- **A1·2 — Framework RLS narrowed (amends D10's "SELECT to authenticated"):** global packs
  stay SELECT-to-authenticated; **commission-owned frameworks (and their standards) are
  readable only by that commission's members.** Forced by D2's own rationale — a cloned
  framework carries pasted licensed manual text, which must not leak cross-tenant.
- **A1·3 — Hospital nav:** "Acreditação" gets a **visible** org-manage sidebar entry under
  "Acompanhamento" (flag-gated), diverging from the deliberately nav-hidden hospital document
  register.
- **A1·4 — ONA seed authoring (completes D2):** backend **drafts** the skeleton
  (seção/subseção codes + short titles + level 1/2/3) from the public ONA manual structure;
  the **PO validates/corrects the draft before the seed migration is authored**. Skeleton
  only — still no `description_md` manual text.

## Amendment 2 (2026-08-03, Wave 0 catalog verification — corrections to D10 and D5)

Backend verified the build-start facts against the live catalog before any feature code; three
of this ADR's assumptions were wrong. Recorded here so the build follows the catalog, not D10:

- **A2·1 — SQLSTATE base is `HC0Q9`, not `HC0Q7` (corrects D10).** The live high-water is
  **`HC0Q8`**: FF-4 consumed Q6, Q7 *and* Q8 across `save_block_to_library`,
  `update_block_library_entry`, `insert_block_from_library`, `delete_block_library_entry` —
  while ADR [0092](0092-ff4-power-authoring.md) §"SQLSTATE high-water" says only "allocates from
  `HC0Q6`", understating what it actually took, and `docs/backend-state.md` carried two stale
  rows (`HC0Q5`, `HC0Q6`). Building on D10's letter would have collided with live raises.
  Phase 16 allocates **HC0Q9 → HC0QE**. *This is the standing "text is not truth" rule landing on
  an ADR's own prose: the fix is not to trust ADR 0093 either, but to re-verify at Wave 2 start.*
- **A2·2 — `action_item` freshness must dispatch on a catalog join (corrects D5's shape).**
  `action_items` has **no status CHECK**: `status_id` is an FK into the tenant-extensible
  `action_item_statuses`, whose `key`/`label` are free tenant text; the only fixed vocabulary is
  its `category` CHECK. `app.evidence_status_of`'s action_item arm joins
  `action_item_statuses.category` — switching on a status string would be tenant-dependent and
  would silently mis-bucket custom statuses.
- **A2·3 — `controlled_documents.status` carries a fifth value D5 never contemplated:**
  `changes_requested` (landed after this ADR's source spec, via ADR
  [0081](0081-controlled-document-redesign.md)/[0082](0082-document-changes-requested-status.md)).
  D5's matrix covers draft/in_approval/effective/obsolete only. **PO ruling 2026-08-03:
  `changes_requested` → `vencida`** (not `atencao`). Rationale: an approver *explicitly sent the
  document back* — it failed review, so as evidence of conformity it is absent proof, not weak
  proof. `atencao` stays reserved for `in_approval`, which has not been refused. The completed
  document arm of the D5 matrix is therefore: `effective` + review current → **valida** ·
  `in_approval` → **atencao** · `changes_requested` / `draft` / `obsolete` / review overdue →
  **vencida**.
- Also corrected for the D5 matrix: `indicator_measurements.status` stores **English**
  (`on_target`/`off_target`/`no_data`); D5's `na_meta`/`fora_da_meta`/`sem_dados` are UI labels.
  The table is **`controlled_documents`**, not `documents`. `app.feature_flags.enabled`
  **defaults to `true`**, so the D-block's "seeded OFF" needs an explicit `enabled = false`.

## Amendment 3 (2026-08-03, Wave 1 — the two freshness buckets D5 never assigned)

D5 named the **lifecycle values** for `meeting` and `capa_plan` but never mapped them to
`valida|atencao|vencida` — unlike `controlled_document` and `indicator`, which got explicit
per-value assignments. Backend surfaced the gap rather than quietly picking; PO ruled both:

- **A3·1 — `capa_plan`:** `completed` → **valida** · `in_execution` / `in_verification` →
  **atencao** · **`open` → `atencao`** · `cancelled` → **vencida**. The build's first pass put
  `open` and `cancelled` in the same bucket; the PO **split them**. An open CAPA is identified
  and tracked — a live commitment, not an abandoned one — and collapsing the two hides a real
  distinction and under-reports a functioning quality system. Note this changes only the
  *severity signal*: neither `atencao` nor `vencida` counts as evidenced, so D5's
  "stale evidence never silently counts" invariant is untouched either way.
- **A3·2 — `meeting`:** `signed` / `distributed` → **valida** · `held` / `in_signature` →
  **atencao** · `scheduled` / `cancelled` → **vencida**. A held-but-unsigned ata is *not* valid
  proof: **signature is the evidentiary act**, since a surveyor asks for signed minutes. The
  more lenient reading (`held` → valida, signature as administrative follow-up) was considered
  and rejected.

Also recorded from Wave 1, as a design fact rather than a ruling: the indicator arm's **"current
frequency window"** is a genuinely new concept — `indicator_kpis` (Phase 15) takes the latest
measurement regardless of age. It is implemented as `current_date − 1/2/3/6/12 months` per
`mensal|bimestral|trimestral|semestral|anual`, filtering on
`coalesce(period_start, entered_at::date) >= cutoff`. It mirrors no existing helper; D5's "a link
is a claim, not proof" rationale is its only authority.

## Consequences

- **The pilot is re-gated on Phase 16** — ADR 0086's "no longer gates the pilot" note is
  superseded; live order is now Phase 16 → pilot deploy. PROGRESS.md is the live tracker.
- The accreditation-track.md Phase 16 spec section must be rewritten against this ADR before
  build start (lead-owned); acceptance criteria inherit the audit's conditions 1–8.
- ETH·E3b closes as folded scope (D4); the last open ADR 0071 item resolves here.
- Widening to a hospital-tier *assessment* surface was **rejected** (D7 keeps assessments
  commission-owned); full-text seeding of licensed manuals was **rejected** (D2); safety-event
  evidence kinds were **deferred** (D4).

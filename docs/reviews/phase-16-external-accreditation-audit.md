# External Audit — Phase 16 "Standards Crosswalk & Readiness/Gap Engine"

**Auditor:** external, hospital-accreditation specialty (ONA / JCI survey preparation)
**Date:** 2026-08-03
**Object under audit:** the Phase 16 specification in
[docs/phases/accreditation-track.md §Phase 16](../phases/accreditation-track.md) (rev. ADR
[0057](../decisions/0057-indicators-doc-control-replan.md), 2026-07-05), status **deferred /
needs replanning** since 2026-07-11 (PROGRESS.md; ADR [0086](../decisions/0086-flexible-forms-pre-pilot.md)
removed it from the pilot gate). **No code exists** — this is a design-stage audit, verified
against the graph index and the live backend surface map; nothing in `src/` or
`supabase/migrations/` implements `accreditation_frameworks`, `accreditation_standards`,
`evidence_links`, or `standard_assessments`.

**Question posed:** does Phase 16 truly represent a feature hospitals can use?

---

## 1. Verdict

**CONDITIONALLY VIABLE — the concept is real, valuable, and matches how accreditation
preparation is actually done; the frozen specification is not buildable as written.**

The core loop — link the artifacts the platform already produces (published forms, meeting
minutes, indicators, CAPA plans, controlled documents, cases) as evidence against a standard,
self-assess conformity, and compute a gap list — is precisely the work quality offices and
committees do today in spreadsheets ("matriz de evidências" / self-assessment workbooks)
during ONA and JCI preparation. Digitizing it on top of artifacts that are *already
lifecycle-managed and audited in the same system* is a genuine differentiator: a surveyor
samples exactly these artifacts (documento vigente? indicador monitorado? CAPA fechado?),
and this platform can answer with the artifact itself, not a claim about it.

However, the spec was frozen 2026-07-05 and the platform's authorization constitution,
document module, and artifact universe have all changed underneath it. Building it verbatim
would ship (a) a readiness model that answers the JCI question but **not the ONA question**,
(b) at least one authorization door that violates the platform's own noun rule, and (c) an
evidence enum blind to artifacts that surveyors specifically ask for. Findings below.

---

## 2. Domain-fit findings (accreditation practice)

### MAJOR-1 — The readiness model is JCI-shaped; ONA readiness is unanswerable without a level dimension

The hierarchy (`parent_id`: capítulo → padrão → elemento de mensuração) and the assessment
vocabulary (`conforme / parcial / nao_conforme / nao_aplicavel`) map one-to-one onto JCI's
chapter → standard → measurable element structure and its met / partially met / not met / NA
scoring. For JCI mock-survey tracking, the design is correct.

ONA does not work this way. The Manual Brasileiro de Acreditação organizes requirements by
seção/subseção **and by nível (1 — Segurança, 2 — Gestão Integrada, 3 — Excelência)**, and
certification is cumulative: *Acreditado* requires all Nível-1 requirements, *Acreditado
Pleno* Níveis 1+2, *Acreditado com Excelência* all three. The question a Brazilian hospital
asks its gap report is **"what blocks Nível 2?"** — not "what is our overall %". The spec's
readiness rollup (per-chapter % + overall %) cannot answer it: a hospital at 95% overall with
one Nível-1 gap is *not accreditable at all*, which a percentage gauge actively hides. The
generic `parent_id` tree can *store* the ONA manual, but the readiness engine needs a level
attribute on standards and a per-level rollup ("prontidão por nível") for the ONA pack.
Since ONA is the primary declared market (§1 positioning), this is a MAJOR gap, not polish.

### MAJOR-2 — Framework content is licensed IP; "seeded ONA pack" needs a legal basis

The spec seeds "ONA + a JCI chapter skeleton" as admin-curated reference packs with
`description_md` per standard. The ONA manual and JCI's standards text are copyrighted
(ONA; Joint Commission Resources / CBA as the Brazilian JCI channel). Shipping the standards
*text* to all tenants as platform reference data is redistribution and requires a license or
partnership. Mitigations that keep the feature intact: seed **codes + short titles only**
(structure, not text) and let each licensed hospital paste descriptions under its own manual
license; or pursue an ONA partnership. Either way this is a go-to-market decision that must
be made before the seed pack is authored — it changes what the migration contains.

### MAJOR-3 — An evidence link is a claim, not proof: no freshness/validity signal

`readiness_report` counts evidence presence. In a survey, evidence is scored on *currency
and implementation*: an expired or `obsoleto` document, an indicator that stopped being
measured, or an off-target indicator with no CAPA is worse than missing evidence — it
documents neglect. The substrate already computes exactly these signals (`review_due_date`
/ version status in Phase 17 v2; off-target detection and `documents_due_for_review` in
Phase 15/17). The readiness engine should degrade or flag evidence whose artifact has gone
stale (e.g. "evidenced (2) — ⚠ 1 vencido"), otherwise the gap list will tell a hospital it
is ready when a surveyor would score não-conforme. This is the difference between a
compliance tool and a false-assurance tool.

### MAJOR-4 — No institutional consolidation: conflicting per-commission assessments have no resolution

`standard_assessments` is unique per (commission, standard); two commissions can assess the
same standard `conforme` and `nao_conforme`. A survey has **one institutional answer** per
standard, owned in practice by the quality office. The spec's hospital rollup aggregates but
defines no conflict rule and no per-standard ownership ("comissão responsável"), which is
how hospitals actually divide a manual. Minimum viable fix: an explicit aggregation rule
(worst-status-wins is the defensible default) plus an optional responsible-commission
assignment per standard; the fuller fix is a hospital-tier consolidated assessment, which
touches the scope-tier decision in ADR 0057 §2.

### MINOR-1 — Framework versioning has no edition-migration story

`accreditation_frameworks.version` exists, but manuals are re-editioned (ONA's manual
cycles; JCI hospital editions), and a new edition invalidates the standard `id`s all
evidence links point to. Pre-pilot this is acceptable (reset-OK); post-pilot a hospital
mid-preparation must not lose its crosswalk. A re-mapping path (old-standard → new-standard
carry-over of links and assessments) should at least be *designed* now, since it constrains
whether `code` or `id` is the durable identity.

---

## 3. Technical-currency findings (spec vs. the 2026-08 platform)

### MAJOR-5 — `hospital_readiness(framework)` gated on `is_admin` violates the noun rule

The spec gates the cross-commission rollup and `/admin/accreditation` on `is_admin`
(= `platform_admin`). Under the noun rule (PO-ruled 2026-07-15, ADR 0078 A35 — *after* this
spec was frozen), platform_admin may administer tenancy/identity/vocabulary/audit but **may
not read commission content** — and standard assessments and evidence links are commission
content. Curating *global framework packs* under `is_admin` is fine (vocabulary/catalog
arm); the readiness rollup is not. The correct gate is the `hospital_document_register`
pattern from the same ADR: `is_hospital_admin_of` / org-admin. As specified, this DEFINER
door is a BUG-AUTHZ-001-shaped recurrence — a DEFINER whose gate RLS never evaluates,
returning content the role census says the role cannot reach. Both new DEFINERs
(`readiness_report`, `hospital_readiness`) must also enter the standing door-audit gate
(`p0-authz-invariant.sh`, ADR 0079) with reader-non-writer keystones.

### MAJOR-6 — `artifact_kind` is stale against the shipped artifact universe

The enum (`form, form_version, meeting, case, indicator, capa_plan, controlled_document,
action_item`) was fixed before: **committee charters** (Phase 21 CH, shipped 2026-07-20,
ADR 0080) — the regimento is *first-order evidence* for the "committee formally constituted
and operating" requirements every framework carries, and ONA surveyors ask for it by name;
ethics procedures (ETH·E2); patient-safety events/RCA. Additionally, Phase 17 was
**redesigned** (DOC-REDESIGN v2, ADR 0081, 2026-07-21) after the evidence-picker spec named
it — the picker and the `artifact_belongs_to_commission` guard must be re-based on the v2
document model, not the ADR 0057-era one. ADR 0057's own rationale ("no dead
`artifact_kind`") argues equally for no *missing* kinds: the replanning pass should derive
the enum from the live artifact registry, not the 2026-07-05 list (cf. the standing
"a new door must inherit every sibling arm" lesson — an enumeration whose boundary is a
stale list is wrong by construction).

### MINOR-2 — Evidence links can leak restricted-case existence

`evidence_links` are member-READ commission-wide, but a `case` artifact may be an ethics
case under the `case_access` ACL (E1 spine): a commission member who cannot read the case
would still see its link (and free-text `note`) in the standard panel, and the hospital
rollup could surface it cross-commission. Evidence *display* must re-check `can_read_case`
(render as "1 evidência restrita" without payload), and rollups should carry counts only.

### MINOR-3 — `note` free text in a declared no-PHI module

Phase 16 declares "No patient data", yet `evidence_links.note` invites prose about linked
cases/events. The platform already maintains a PHI-in-free-text discipline (22-column
census, pt-BR discouragement copy). The note field needs the same treatment, and notes must
stay out of any hospital-tier or export surface.

### INFO-1 — Downstream dependency

ETH·E3b (linking ethics procedures to accreditation standards) is explicitly blocked on
Phase 16 (ADR 0071 item 8). The replanning should decide whether E3b's needs (ethics
procedure as an evidence kind) fold into the rebuilt enum (see MAJOR-6) rather than becoming
a second bespoke link table.

---

## 4. What is genuinely right about the proposal

- **The evidence substrate is unusually complete.** Indicators with a closed CAPA loop
  (Phase 15), e-signed controlled documents with review cycles (Phase 17 v2), audited
  meetings, and a hash-chained audit trail are the exact artifact classes surveyors sample.
  ADR 0057's sequencing (15 → 17 before 16) worked: no evidence kind ships hollow.
- **Manual self-assessment is the honest design.** Auto-scoring conformity would be
  malpractice; keeping `standard_assessments` a human judgment with computed *evidence
  support* around it matches how survey prep is actually run (with MAJOR-3's freshness
  flags as the needed guardrail).
- **PHI-free by design** (modulo MINOR-2/3) — correct: readiness reporting never needs
  patient identifiers, and keeping this module outside Rule 12's three-door perimeter is
  the right minimum-necessary call.
- **Custom frameworks** (`owner_commission_id`) cover the real long tail: state-level
  requirements (visa sanitária roteiros), internal protocols, ISO-style crosswalks.

## 5. Recommendations (conditions for build approval)

| # | Condition | Resolves |
|---|-----------|----------|
| 1 | Add a `level`/tier attribute to standards + per-level readiness rollup for the ONA pack; keep the % rollup for JCI-shaped frameworks | MAJOR-1 |
| 2 | Decide the framework-content licensing posture (codes+titles skeleton vs. licensed text) **before** authoring the seed migration | MAJOR-2 |
| 3 | Feed artifact staleness (document status/review-due, indicator off-target/last-measured) into the readiness output as flags | MAJOR-3 |
| 4 | Define the hospital-rollup conflict rule (worst-status-wins) + optional responsible-commission per standard | MAJOR-4 |
| 5 | Re-gate `hospital_readiness` + `/admin/accreditation` on `is_hospital_admin_of`/org-admin; keep `is_admin` only for global pack CRUD; both DEFINERs join the ADR 0079 door audit with keystones | MAJOR-5 |
| 6 | Re-derive `artifact_kind` from the live artifact registry (add charter, ethics procedure; re-base document linking on ADR 0081 v2) | MAJOR-6, INFO-1 |
| 7 | `can_read_case`-aware evidence rendering; counts-only rollups; PHI-discouragement copy on `note` | MINOR-2, MINOR-3 |
| 8 | Design (not necessarily build) the framework edition re-mapping path | MINOR-1 |

**Bottom line:** Phase 16 is not vaporware dressed as strategy — it digitizes a real,
named, currently-manual hospital workflow on top of artifacts the platform already governs,
and it is the feature that converts the product from "committee tooling" into "accreditation
preparation". The deferral-for-replanning status in PROGRESS.md is the correct call: with
conditions 1–8 folded into the replanned spec (roughly one replanning ADR of the ADR 0057
kind), this auditor would assess the feature as **usable by, and materially valuable to,
hospitals pursuing ONA or JCI accreditation**.

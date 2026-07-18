# QA Review — ETH·E2 (Ethics Disciplinary Procedure)

> **✅ FINAL VERDICT: APPROVED** (2026-07-18, round 1).
> Every ADR-0073 §4 acceptance bullet is met, the 0078 reconciliation held, and every
> RLS / immutability / non-vacuity invariant was **verified live under `set local role`** —
> not merely by predicate inspection. 1 Minor (doc) + 3 Info, none blocking.

**Reviewer:** `qa` · **Date:** 2026-07-18 · **Branch:** `feat/eth-e2-procedure`
**Scope:** S4 · ETH·E2 of the Pre-Pilot Release Scope Expansion (ADR 0071). Requirements =
ADR [0073](../decisions/0073-ethics-procedure-model.md) (incl. the **2026-07-18 ADR-0078
reconciliation** + D13/D14 amendment) + build plan `docs/phases/ethics-e2-procedure.md` §4 +
the lead rulings. Built on ADR 0072 (E1 access spine) + 0078 (capability model) + 0079
(audit-door-blindness invariant).
**Commits reviewed:** `ada4c97` (BE-1) · `d4f47ba` (BE-2) · `d40672e` (BE-3) · `5ff03e1`
(BE-3b) · `54ce537` (BE-4) · `04d9f62` (BE-5) · `8b8e68d` (BE-6) · `2c9314e` (BE-7/8/10) ·
`0972ed0` (BE-11) · `c1f2e33`+`3d1315a` (FE) · `3d75ddd` (tester) · `38af16a` (green decl).
**Method:** live-catalog probing on a fresh `supabase db reset` baseline (project rule —
migration file text is stale; `pg_proc`/`pg_policies`/ACLs are the sole truth). Every crux
door was exercised as a real caller via `set local role authenticated` +
`request.jwt.claims`, asserting **rows read/written**, not "does the predicate return true"
(the eth-e1-rls-three-shapes / ADR-0079 discipline).

---

## Verdict: ✅ APPROVED

The phase is well built and, critically, the security crux holds under adversarial live
probing. The DEFINER doors are all `prosecdef=t` / owner `postgres` / anon-revoked; the
non-vacuity discipline (authority-first with a SQLSTATE distinct from every exclusion code)
is present **and demonstrated live**; the case-read boundary is a verbatim reuse of E1's
`can_read_case` on every one of the nine tables with **no** new RLS shape and **no**
authenticated write policy; the D13 respondent door reaches exactly its one targeted
response and nothing else; and the M2 retention-pin / redaction behave exactly as the
ADR-0072 §7 posture the human signed off. The 0078 reconciliation landed as specified.

---

## Dimension 1 — Requirements (ADR 0073 §4 + the 0078 reconciliation)

| Requirement | Status | Evidence (live catalog unless noted) |
|---|---|---|
| **9 tables** (`ethics_case_details`, `ethics_allegations`, `ethics_findings`, `case_decisions`, `ethics_decision_details`, `case_votes`, `ethics_notifications`, `ethics_hearings`, `ethics_appeals`) + catalogs + D10 columns | ✅ | All present; RLS on; `ethics_findings`/`ethics_decision_details` carry the **denormalized `case_id`** (base-table predicate, R6). |
| §4.1–2 admissibility → notice → allegations/findings; `unique(allegation_id)` HC0J3 | ✅ | BE-2/BE-6 RPCs; catalog CHECKs verbatim. |
| §4.4 **vote recusal keystone** — recused/respondent → HC0J5, dup → HC0J4 | ✅ | **Proven live** (Dim 2). |
| §4.5 **decision → retention-pin** fires on `issued`, idempotent, respondent-scoped | ✅ | **Proven live** — issuing set `retention_pinned_at` + reason `ethics_decision_issued`. |
| §4.6 **redaction bar** HC0J7 on pinned; success = minimise-not-destroy | ✅ | **Proven live** (Dim 2); PHI-free audit (`'{}'::jsonb`). |
| §4.3 **hearing = `participants_only` meeting** (D14→Stage C; NOT a meeting-policy rewrite) | ✅ | `schedule_ethics_hearing` is E2's own DEFINER door; `create_meeting` untouched; O-7a "Audiência" seed, no meetings DDL. |
| §4.10 **`legal_privileged` decision letter deferred to Stage E, NOT rendered** | ✅ | `decisionLetterDocumentId` is a Stage-E no-op (BE-11); the label is 0078-fenced; FE renders no privileged-letter affordance. |
| §4.12 **flag-OFF byte-for-byte** — RPCs raise HC000; tables dark; N arm 0 rows | ✅ | `assert_ethics_enabled` → HC000; `compute_due_ethics_notifications` returns 0 when off. |
| SQLSTATE relocation **`HC0F·` → `HC0J·`** | ✅ | Ethics block is `HC0J0–HC0J9`; the 5 coordinator doors correctly keep 0078's `HC0E·`/`HC0F·` (lead ruling 3). |
| **5 coordinator app-actions wired** (`setCaseVisibility` created + 4 siblings) | ✅ | `case-recusals/actions.ts` + `mapCoordinatorError`; live doors authority-gated (HC0E4/HC0F5). |
| §D6/D7 sanctions ride the `action_items` hub; CRM/CFM rides referrals — no fork | ✅ | `assign_ethics_remediation` + `open_ethics_external_referral` consume the existing RPCs. |
| §D5 N scan arm additive + idempotent + PHI-free | ✅ | Separate `compute_due_ethics_notifications`; titles = notice **type** only; dedup key per `(kind,entity,date)`. |
| Flag flip **seed-only** (remote/prod OFF) | ✅ | Only `seed.sql:1989`; **no migration** sets `enabled=true`. |

**The 0078 reconciliation held in full.** No parallel `can_read_meeting` / meeting-child
policy rewrite exists; hearings are `participants_only` meetings via E2's own roster-then-flip
door; the privileged-letter path is genuinely deferred, not stubbed-and-rendered.

---

## Dimension 2 — Security / RLS (the crux) — verified LIVE

### 2.1 DEFINER door hygiene (t19) — all 36 ethics functions
`prosecdef=t`, owner `postgres`, and **anon absent from every ACL** (EXECUTE only to
`authenticated` + `service_role`; the pin **trigger** fn correctly carries the default ACL).
No door is reachable by anon. ✅

### 2.2 Non-vacuity — authority-first, distinct SQLSTATE — **demonstrated live**
`cast_case_vote` checks `is_member_of_for` (→ **42501**) *before* the recusal/respondent
exclusion (→ **HC0J5**). Probed on a draft decision under `set local role`:

| Caller | Expected | Live result |
|---|---|---|
| recused member `staff1` (…03) | HC0J5 | **HC0J5** ✅ |
| respondent `staff4` (…0a) | HC0J5 | **HC0J5** ✅ |
| ordinary member `staff2` (…04) | OK | **OK (voted)** ✅ |
| org_admin `orgadmin.a` (…b1) — non-member | 42501 (NOT HC0J5) | **42501** ✅ |

The non-member is refused with the authority code, never mistaken for an excluded member —
so the HC0J5 keystones cannot be vacuous. `issue_decision` likewise checks authority
(`assert_ethics_coordinator` → HC0J1) **before** the quorum gate (HC0J8), and
`redact_professional_profile` checks authority (→ 42501) **before** the HC0J7 bar.

### 2.3 Case-read boundary — every E2 table, verbatim `can_read_case`, no new shape
All nine case-child tables carry **exactly one** SELECT policy —
`app.can_read_case(case_id, auth.uid())` — to `authenticated`, and **no** authenticated
INSERT/UPDATE/DELETE policy (writes are DEFINER-RPC-only). SELECT is granted to
`authenticated` (F1 MAJOR-1) with no write grant. Live rows-read probe with a full row set
present:

| Persona | 9 ethics tables | targeted resp. | ordinary resp. |
|---|---|---|---|
| coordinator `chefe.ccih` (…02) | **1 each** ✅ | 1 | 1 |
| **respondent** `staff4` (…0a) | **0 each** ✅ | **1 (D13)** ✅ | **0** ✅ |
| **recused-but-granted** `staff1` (…03) | **0 each** ✅ | 0 | 0 |
| foreign/non-granted `staff2` (…04) | **0 each** ✅ | 0 | 0 |
| org_admin `orgadmin.a` (…b1) | **0 each** ✅ | 1† | 1† |

†Not an E2 finding — see Info-2. The respondent's recusal-beats-grant result (…03 is
explicitly granted yet reads nothing) is the E1 deny-first invariant holding into E2.

### 2.4 D13 targeted door — reaches only the one response, never the case
`app.can_access_targeted_response` is `SECURITY DEFINER`, base-table only, and **never calls
`can_read_case`/`can_write_case_content`/`is_case_respondent`**; it resolves the target via
`professional_profiles.user_id = p_uid` (the dropped `link_state` conjunct is genuinely
vacuous — `guard_professional_linkage` makes `user_id NOT NULL ⇔ linked`). Live: the
respondent reads exactly their targeted response and **0** of all nine ethics tables + the
ordinary response (2.3). Writes ride `can_write_targeted_response` = access **AND**
`status='in_progress'`, so answers/response updates are gated to `in_progress`;
`submit_targeted_case_response` is the sole submit path (→ HC0J9 for a non-target) and does
**not** call `submit_response`.

### 2.5 M2 retention (Rule 12 — Class-2 professional identity)
The pin trigger fires only on the transition **into** `issued`, is idempotent
(`where retention_pinned_at is null` + `if found`), traverses respondents over base tables
(R6), and audits PHI-free. `redact_professional_profile` is minimise-not-destroy (placeholder
name / null license / null `user_id` / `link_state='no_account'`, row + id + linkage + audit
preserved), barred while pinned (HC0J7) with the belt base-table check, and uses the
`app.in_redaction_rpc` GUC to pass the linkage freeze for that one update only (respondent
freeze intact). Live: redact-pinned → HC0J7; non-authority → 42501. No patient-PHI ingress on
any E2 surface.

### 2.6 Catalogs, N arm, flag
Catalog SELECT is org-scoped (`is_org_member(organization_id) OR is_admin()`) — no
cross-tenant `using(true)` leak. The N arm is flag-gated, PHI-free, idempotent. The flag flip
is seed-only.

---

## Dimension 3 — Code quality

- **Error mapping (Rule 8/10).** `mapEthicsError` covers HC000 + the full `HC0J·` block +
  42501/P0002 and **defaults to a safe pt-BR `MESSAGES.generic`** — raw Postgres text never
  reaches the UI. Every action returns through it. `mapCoordinatorError` covers the HC0E/HC0F
  coordinator doors.
- **Sanitized Markdown (Rule 7).** Every `_md` field renders via the shared `MarkdownRenderer`
  (`remark-gfm` + explicit `rehype-sanitize` against a hardened schema); no
  `dangerouslySetInnerHTML` anywhere in `src/components/ethics/**`.
- **pt-BR user text (Rule 10).** Panels use pt-BR labels + helper text ("Markdown é
  suportado. Não inclua dados de paciente." — a nice Rule-12 nudge).
- **Data-access discipline (Rule 9).** All 25 procedure actions are RPC-backed (0 stubs,
  lead-verified); ethics reads flow through `src/lib/queries/ethics.ts`.
- **Migration additivity.** All 8 migrations are in the `20260817000000–000700` window and
  touch only `can_read_case`/`auth.uid()` predicates — **no** `auth`-schema, `capa`, or core
  `compute_due_notifications` CHECK edits.

---

## Dimension 4 — Triage sanity-check (confirmed sound, not re-litigated)

- **Full-suite 66 E2E reds → 0 deterministic E2 regression.** Independently corroborated: E2's
  migrations are additive-only in the `20260817` window and touch neither `auth` nor `capa`
  nor the notifications CHECK domain (BE-7 added a *separate* `compute_due_ethics_notifications`,
  leaving the core engine untouched). The batch-cliff `ERR_CONNECTION_REFUSED` pattern is the
  documented Windows monolith-collapse; the 7 `notifications.spec` reds root-cause to GoTrue
  login rate-limiting at `open_capa_plan` (a path E2 does not touch). Reasoning is sound.
- **8 pgTAP failures in `250/251/252_authz_p0`.** Those files run *before* ethics `253–259`,
  E2 alters none of their RLS, they pass individually → classic inter-test pollution,
  confirmed at branch base. Not E2. Sound.

---

## Findings (none blocking)

- **MINOR / DOC-1 — the vote-quorum eligibility rule is undocumented.** `issue_decision`
  computes `required = greatest(coalesce(commission_meeting_settings.quorum_value,
  ceil(eligible/2)), 1)` and gates on `votes_cast >= required` (HC0J8). It works and is
  pgTAP/E2E-tested, but O-3 was left "open" and this rule is not written down in a
  human-readable place. **Recommend** a 3–4 line As-built note in ADR 0073 (or
  `docs/backend-state.md`) at Record — so a future reader knows the quorum source + the
  simple-majority fallback without reverse-engineering the RPC.
- **INFO-1 — `responses_update_targeted` `with_check` does not pin `status`/`case_phase_id`.**
  The UPDATE `with_check` is `can_access_targeted_response` (no `in_progress` / immutability
  constraint), so a respondent could PATCH their own targeted response's `status='submitted'`
  directly (skipping the RPC's `case.targeted_response_submitted` audit row) or re-point its
  `case_phase_id`. Both are **self-scoped and non-escalating** — the `with_check` still forces
  the row to resolve to the caller, so they cannot pivot to another participant/case's content,
  and a mangled phase link only corrupts their own defense row. Same class as the ordinary
  `responses_update_own_draft` arm. Optional hardening (mirror the qual's `in_progress` into
  the `with_check`); accept-as-documented is also fine.
- **INFO-2 — a respondent's targeted defense is visible to `org_admin`/`commission_admin`.**
  The targeted response is a `responses` row; the pre-existing `responses_admin_all` /
  `responses_select` admin arms let a commission/org admin read it (and any case-phase
  response). This is **not** a D13 widening (the ordinary non-targeted response is equally
  visible, and `can_access_targeted_response` returns false for it) — it is the standing
  `responses` access model, an E1/authz matter, out of E2's additive scope. Flagged for
  visibility only.
- **INFO-3 — "Processo ético" tab gating** verified ethics-typed-only by the tester's live
  GATE specs (not re-driven here); RLS is the boundary regardless of tab visibility.

---

## Conformance checklist (build plan §5)

- [x] Verbatim `can_read_case` reuse on every E2 table; no new shape; denormalized `case_id`
      predicates are base-table (R6).
- [x] `case_votes` recusal/respondent exclusion — at the RPC door (HC0J5) **and** structurally
      (excluded voter reads 0 decision rows under `set local role`).
- [x] M2 pin fires on issued decision, idempotent, respondent-scoped; redaction
      minimise-not-destroy, barred while pinned.
- [x] Sanctions ride the hub (no new task table); CRM/CFM rides referrals (no bespoke path).
- [x] N arm additive + idempotent + PHI-free.
- [x] Flag-OFF byte-for-byte; flag flip seed-only.
- [x] Grant/RLS pairing on every table (F1 MAJOR-1); t19 REVOKE (anon-revoked) on every RPC.
- [x] Non-vacuity (authority-first, distinct SQLSTATE) proven live.

**Verdict: ✅ APPROVED.** Recommend the lead pick up DOC-1 at Record (an As-built note on the
quorum rule) and log INFO-1/INFO-2 as follow-ups; none gate the phase.

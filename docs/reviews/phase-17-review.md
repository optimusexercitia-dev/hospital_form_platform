# Phase 17 — Controlled-Document Lifecycle · QA Review

**Reviewer:** `qa` · **Date:** 2026-07-06 · **Verdict:** ✅ **APPROVED**
**Severity tally:** 0 BLOCKER · 0 MAJOR · 3 MINOR · 4 INFO

Gate state entering QA: pgTAP **42/42** (`supabase/tests/200_controlled_documents.sql`),
phase E2E **14/14** (`e2e/phase17-documents.spec.ts`), full `--workers=1` regression
588 passed (10 late-run failures verified environmental — GoTrue rate-limit — 0 Phase-17
regressions), `npm run typecheck` 0, `npm run lint` 0 errors, Vitest 206/206. Five bugs
(BUG-DOC-001..005) found + fixed + tester-verified during the loop.

Scope audited: the four Phase-17 migrations
(`20260713000000_controlled_docs_core.sql`, `…000100_controlled_docs_rpcs.sql`,
`…000200_controlled_docs_reads.sql`, `…000300_form_publish_metadata.sql`), the
data-access layer (`src/lib/queries/documents.ts`, `src/lib/documents/{actions,types,version-select}.ts`),
the UI surface under `src/app/o/[org]/**/documentos*` + `src/components/documents/**`,
the seed flip, and the pgTAP suite. Read-only throughout; no application code modified.

---

## 1. Requirements coverage (spec `docs/phases/accreditation-track.md:427-506`, ADR 0057)

Every deliverable and every Acceptance clause is met, and the pgTAP/E2E tests assert
the right thing (values/DB-truth, not just "no error").

| Requirement | Status | Evidence |
| --- | --- | --- |
| 3-table model `controlled_documents → controlled_document_versions → document_approvals` | ✅ | core §1–3; FKs + `unique(commission_id, code)`, `unique(document_id, version_number)`, `unique(document_version_id, approver_id)` |
| Version-level status `rascunho → em_aprovacao → vigente → obsoleto`; superseded versions retained/downloadable | ✅ | version `status` col + `guard_controlled_document_status` legal edges; publish retires prior `vigente`→`obsoleto` (retained); pgTAP §6 asserts `obsoleto` + retained |
| Per-commission `DOC-####` mint | ✅ | `app.mint_controlled_document_code` (advisory-lock + `max()+1`, per-commission scope); `unique(commission_id, code)` |
| Named-approver e-sign: any active same-hospital user (incl. outside commission) | ✅ | `app.is_entitled_document_approver` (active + member of ANY commission of the doc's hospital); pgTAP §2 (foreign-hospital HC091, inactive HC091) |
| Frozen approver set while `em_aprovacao` | ✅ | `guard_frozen_approver_set` (HC093 on INSERT/DELETE/approver-id change while em_aprovacao); pgTAP §3 |
| Pending/decided approval row grants read | ✅ | approver-arm RLS on documents (doc-scoped) + versions (version-scoped) + storage predicate; pgTAP §4 |
| ALL must sign `aprovado` to publish; `rejeitado` → `rascunho` | ✅ | `publish_document` HC090 gate (`decision is null or <> 'aprovado'`); `decide_document_approval_core` reject → rascunho w/ note; pgTAP §5, E2E AC-3/AC-4 |
| `signature_hash` per-signer | ✅ | sha256(storage_path : approver_id : decision) — per-signer + per-artifact, mirrors `meeting_signatures.content_hash` |
| Effective/expiry dates + review cycle (due = effective-base + cycle, override wins) | ✅ | `publish_document` computes `review_due = coalesce(override, effective + cycle)`; pgTAP §6 asserts both (2025-01-10 computed; 2030-12-31 override wins) |
| Commission register + hospital-wide DEFINER rollup | ✅ | `listDocuments` (member-read) + `hospital_document_register` DEFINER (admin/hospital-admin/org-admin); pgTAP §8 |
| Forms-as-controlled-docs metadata-only inside `publish_form_version` | ✅ | B4 additive cols set inside the status-flip UPDATE; pgTAP §10 (settable only via RPC; direct UPDATE on published row raises) |
| `controlled_docs` feature flag, whole surface gated | ✅ | seeded OFF in migration, ON only in `seed.sql`; RPC `assert_controlled_docs_enabled`; layout `notFound()` gate |

All 14 E2E acceptance clauses (full lifecycle, outside-commission approver isolation,
publish-pending rejection, reject→rascunho, supersede, review-due doc + form arms,
new-path-per-version, form publish metadata, foreign-hospital HC091, hospital register,
audit no-leak, flag gate, keyboard-only) map to spec bullets and pass.

---

## 2. Security / RLS review (the crux — audited adversarially)

**Approver-read arm is version-scoped and does not over-grant. CONFIRMED.**
The header policy (`controlled_documents_select`) uses `app.is_document_approver_of(doc, uid)`
(approver on *any* version of *this* doc), while the version policy
(`controlled_document_versions_select`) uses `app.is_document_version_approver(version, uid)`
(approver on *this* version) — tighter, exactly as the spec demands. pgTAP §4 proves the
isolation directly: `sa_y`, named on Doc A, gets `count=0` on the unrelated Doc B and its
version, and sees no approvals on docs it cannot read. An approver named on one doc gains
no read of unrelated docs.

**RLS infinite-recursion fix is correct and does not itself leak. CONFIRMED.**
The cross-referential version↔approval read logic is routed through three `SECURITY DEFINER`
helpers (`is_document_approver_of`, `is_document_version_approver`, `can_read_document_of_version`).
Each is `stable`, `owner postgres`, `search_path` pinned to `'app','public','pg_catalog'`,
and only performs a bounded existence/membership check keyed on the passed ids — it neither
re-enters the calling table's policy (avoiding recursion) nor widens the predicate beyond the
inline arm it replaces. `can_read_document_of_version` resolves the commission via the DEFINER
lookup and defers to the same `is_member_of_for`/`is_commission_admin_of_for` the app uses
everywhere.

**Storage (Rule 6). CONFIRMED.** `controlled-documents` bucket is `public=false`, 25 MB cap;
only INSERT (staff_admin/commission_admin of seg[1]) and SELECT (`can_read_document_object`,
which mirrors the version-scoped approver arm on seg[2]) policies exist. There is **no
UPDATE/DELETE policy** for this bucket anywhere (grep-verified across all migrations; every
storage policy is strictly `bucket_id`-scoped, and RLS on `storage.objects` is default-deny),
so objects are immutable. pgTAP §7 asserts 0 UPDATE/DELETE policies + private bucket. The
action uploads to a new `{commission}/{document}/{uuid}.{ext}` path with `upsert:false`
(never overwrites) — pgTAP AC-7 asserts a new path per version.

**DEFINER reads gated + PHI-free / minimum-necessary. CONFIRMED.**
`hospital_document_register` gates `is_admin OR is_hospital_admin_of OR is_org_admin_of(org_of_hospital)`,
returns early (empty) for a foreign caller, and its OUT columns carry no
`summary_of_changes_md`/`storage_path`/`note` (pgTAP §8c asserts this via
`information_schema.parameters`). `list_approver_candidates` gates a coordinator of the
commission / hospital_admin / admin, returns id+name+role-label only (no email/PHI —
pgTAP §9b), and enumerates only same-hospital active users (pgTAP §9a: foreign-hospital and
inactive excluded; §9c: non-coordinator → empty). `documents_due_for_review` is member-gated.
All three (plus the 9 lifecycle RPCs) `REVOKE ALL FROM PUBLIC` then `GRANT` to
authenticated/service_role (t19 guard satisfied).

**Writes only via DEFINER RPC (posture b). CONFIRMED.** The three tables have SELECT policy +
SELECT grant only; `revoke insert, update, delete … from authenticated` is explicit
(belt-and-braces). Every mutation flows through a `SECURITY DEFINER` RPC that (a) asserts the
flag, (b) checks `is_staff_admin_of OR is_commission_admin_of` for authoring or sign-own-row
for approve/reject, and (c) wraps status writes in the `app.in_controlled_docs_rpc` session
flag so the HC089 state-machine + HC093 frozen-set guards permit only legal transitions.
Approve/reject asserts the caller is the named, still-pending approver (`decide_document_approval_core`).

**Audit (Rule 11). CONFIRMED.** Three AFTER-triggers emit rows with strict non-sensitive
allow-lists: documents `[code, doc_type, status, review_cycle_months]`; versions
`[version_number, status, effective_date, review_due_date, expiry_date]`; approvals
`[decision]` only. `title`, `summary_of_changes_md`, `note`, `storage_path`, `approver_title`,
`signature_hash` are **never** in a diff allow-list. pgTAP AC-11 asserts the `document.created`
row leaks none of them.

**Form immutability (Rule 5). CONFIRMED.** `guard_published_version` (baseline) is **not**
touched by Phase 17 (grep-verified: defined only in the baseline). The four new `form_versions`
metadata columns are stamped inside the same `draft→published` status-flipping UPDATE the
publish RPC already runs under `app.in_publish_rpc='on'`; that UPDATE takes the guard's
"status is distinct" branch and returns `new`. A post-publish direct UPDATE touching only the
metadata columns is a non-status update on a non-draft row → the guard raises. pgTAP §10 proves
the direct UPDATE on a published row raises `23514`.

**Rule 7 (sanitized Markdown).** `summaryOfChangesMd` and approval `note` render only through
the shared `MarkdownRenderer` (rehype-sanitize hardened schema, no `rehype-raw`, no
`dangerouslySetInnerHTML` in the path). No raw HTML anywhere in the documents UI.

**Flag mechanism. CONFIRMED.** Migration seeds `controlled_docs=false` (prod-safe); the only
enable is in `supabase/seed.sql` (local/E2E). No migration flips it on. The prod flip is
correctly deferred to the lead's Record step.

**Reject-then-stale-pending-rows (analyzed, benign residual — see INFO-1).** On a rejection the
version returns to `rascunho` and the other still-pending approval rows are intentionally left
in place, so a to-be-removed approver retains read of the *private rascunho* until resubmit.
This is bounded and safe: (a) the version is a private working draft, (b) the approver
legitimately had that read moments earlier, (c) the next approval cycle requires
`submit_document_for_approval`, which is DELETE-then-INSERT (a removed approver loses the grant
at resubmit), and (d) `publish_document` requires `em_aprovacao`, unreachable without that
resubmit — so no stale grant can ride into `vigente`. Documented, not a hole.

---

## 3. Code quality

- **Rule 9 (data access):** all reads go through `src/lib/queries/documents.ts`; no inline
  supabase-js in components. Signed-URL downloads are minted server-side against the
  RLS-gated bucket.
- **Shared version-select helper:** `src/lib/documents/version-select.ts` is the single source
  of truth for "in-force vs actionable version." Verified (dedicated sweep) that BOTH the
  coordinator detail page (`selectWorkingDraft` + `findMyApprovalForVersion`) and the org
  approver-detail page (`selectSignableVersion` + `findMyApprovalForVersion`) consume it, and
  that the ONLY inline status filter in the whole documents tree is inside the helper.
  `currentVersionId` is used exclusively as the READ/in-force pointer (status chip, dates,
  register, in-force download) everywhere — never as an action target. This closes the
  BUG-DOC-004/005 divergence class by construction.
- **Rule 10 / errors:** all user-facing strings pt-BR; `mapDocumentError` maps HC089–HC093 +
  42501/23505 to fixed pt-BR messages and falls back to a generic pt-BR string for
  `23514`/unknown, so no raw Postgres text can reach the UI.
- **TS strict:** no `any` / `as any` and no service-role reference in the documents source
  (grep-clean). Camel↔snake mapping is isolated to the TS↔SQL boundary in the action
  (BUG-DOC-003 fix); the frontend keeps the camelCase `ApproverCandidate` contract.
- **A11y:** forms use `FieldLabel htmlFor` / `aria-describedby` / `aria-invalid` / `FieldError`;
  the approver picker has `aria-label`s on per-row controls and `role="alert"` on errors;
  `useActionState` + real `type="submit"`. E2E AC-13 exercises a keyboard-only coordinator-open
  + outside-approver sign.

---

## 4. Bug-fix soundness (BUG-DOC-001..005)

All five are real fixes, not papered over:

- **001** (systemic form↔action field-name mismatch): forms realigned to the action contract;
  upload now writes `storage_path`. Root cause addressed at the correct layer.
- **002** (dangling seed `storage_path`): NULLed so the UI honestly shows "Sem arquivo"; real
  bytes are not seedable via SQL (documented, consistent with the platform seed convention);
  download coverage moved to AC-1's real upload. Seed-fixture only, not a code cover-up.
- **003** (camelCase `approvers` blob vs snake_case RPC): fixed at the TS↔SQL boundary in the
  action with a per-element guard; frontend contract preserved. DB-proven both ways.
- **004** (supersede UI dead-end): separated in-force version from working draft in the
  coordinator page; correctly left `current_version_id` as the read pointer (moving it would
  break readers/register/review-due).
- **005** (org approver page signed the wrong version post-supersede): fixed by extracting the
  shared `version-select.ts` helper consumed by BOTH pages, and swept a second latent
  cross-version `isPendingApprover` bug on the coordinator page. The strongest class of fix —
  a single source of truth that prevents recurrence.

---

## 5. Findings

### MINOR (clear before Record if cheap; none blocking)

- **MINOR-1 — reject leaves stale pending approval rows granting read of the rascunho until
  resubmit.** `app.decide_document_approval_core` (B2 §5) intentionally leaves the other
  pending rows in place on a `rejeitado`; those rows keep granting read via the approver arm
  until `submit_document_for_approval`'s delete-then-insert rebuilds the roster. Bounded and
  safe (see §2 analysis) — the read is of a private working draft the approver just held, and
  no stale grant can survive into `vigente`. *Recommendation:* either delete the sibling pending
  rows on reject (roster is rebuilt on resubmit anyway) or leave as-is with the current inline
  comment; documenting the accepted residual is sufficient. Low value; safe to defer.

- **MINOR-2 — `updateControlledDocument` header-edit is silently blocked once past `rascunho`
  but the UI may still route there.** The RPC correctly raises HC089 ("o documento só pode ser
  editado enquanto está em rascunho") once the current version leaves `rascunho`, and the detail
  page gates the "Editar" affordance on `workingStatus==='rascunho'`. The editar route itself
  is reachable by URL and would surface the generic pt-BR "operação não permitida no estado
  atual" — correct behavior, but a direct nav shows an error rather than a 404/redirect.
  Cosmetic; no security or data impact.

- **MINOR-3 — `documents_due_for_review` `is_overdue` uses `current_date` server-side while the
  register list helper (`listDocuments`) computes `isReviewOverdue` in TS against the browser's
  `new Date()`.** Two overdue computations (SQL `current_date` vs JS `toISOString().slice(0,10)`)
  can disagree by a day across timezones for a doc due exactly today. Both are internally
  consistent with their own tests; the divergence is a one-day edge only. *Recommendation:*
  standardize on the server-side computation for display consistency. Very low value.

### INFO (no action required)

- **INFO-1 — Approver enumeration is intentionally hospital-wide.** `list_approver_candidates`
  returns all active same-hospital users (not just commission members) to a commission
  coordinator. This is the ADR-0057 institutional-signer intent, minimum-necessary
  (id/name/role-label, no email/PHI), and gated. Correct by design.
- **INFO-2 — `mark_document_obsolete` / `supersede_document` require `vigente`.** A doc stuck in
  `em_aprovacao` (e.g. never all-approved and never rejected) has no obsolete/supersede path;
  the only exit is reject→rascunho then resubmit or leave. Matches the state machine; acceptable.
- **INFO-3 — Reads split into a separate `…000200` migration** (documents_due_for_review /
  hospital_document_register / list_approver_candidates), mirroring the Phase-15 indicators
  `…000250` reads split. Consistent with prior convention.
- **INFO-4 — `signature_hash` binds `coalesce(storage_path,'')`.** For the (now NULLed) seed
  fixtures the hash is over an empty path; for real uploads the immutable `storage_path` stably
  identifies the signed bytes. Correct; self-consistent with `approve_document`.

---

## 6. Verdict

✅ **APPROVED.** All deliverables and Acceptance clauses are met and tested for the right
behavior. The security-critical invariants — version-scoped approver read arm with no broad
grant, the recursion-safe DEFINER helpers, immutable storage (no update/delete), DEFINER-only
writes with the HC089/HC090/HC093 state-machine + frozen-set + all-must-approve guards, PHI-free
minimum-necessary rollups, unbypassable audit with a strict non-sensitive allow-list, and
form-metadata immutability via `publish_form_version` with `guard_published_version` untouched —
all hold and are proven by pgTAP. The five in-loop bugs are soundly fixed, and BUG-DOC-005's
shared-helper extraction removes the divergence class rather than patching a symptom. No PHI
(Rule 12 N/A by design). The three MINORs are non-blocking; the lead may clear the cheap ones
(MINOR-1 the most tractable) before the Record step.

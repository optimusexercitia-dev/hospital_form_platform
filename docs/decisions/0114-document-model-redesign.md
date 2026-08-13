# 0114 — Document model redesign: documents, versions, file objects, securable resources

- **Status:** Accepted — ratified by the PO 2026-08-12 (drafted 2026-08-11 from the
  external audit `docs/design/temp/document-model-audit-handoff.md` + a grilling
  session with the PO). **Amendment 1 (D15/D16) ratified 2026-08-13** — the
  per-document confidentiality ceiling; see the end of this file.
  **Amendment 2 (D17) ratified 2026-08-13** — the ethics document seams join
  Wave B; see the end of this file.
- **Supersedes / amends:** ADR 0063 (centralized attachments substrate) — replaced
  wholesale; ADR 0065 owner-set conventions — the closed owner set survives as the
  initial `securable_resources` type set. ARCHITECTURE.md Rules 6/11/12 unchanged.
- **Companion plan:** `docs/plans/document-model-redesign.md` (phases DM0–DM5).

## Context

An external audit (2026-08-11, read-only, live-catalog-verified) found that the
centralized `attachments(owner_type, owner_id)` substrate cannot carry the platform's
document roadmap, and carries live defects. The lead independently re-verified every
load-bearing finding against the live catalog before this ADR:

- **F-01 confirmed** — the `storage.objects` SELECT policy for the standard bucket
  authorizes from the *path* alone; it never joins the attachment row, so it ignores
  `confidentiality_label` AND `deleted_at`. A metadata-denied or soft-deleted object
  stays byte-readable.
- **F-02 confirmed** — `dispose_attachment_phi` neither deletes bytes nor blocks
  reads; `open_attachment` never checks `phi_disposed_at`. Disposal is a false
  audit assertion.
- **F-03/F-04/F-09 confirmed** — pointer-only reclassification; no
  `UNIQUE(storage_bucket, storage_path)`; scan default `'skipped'` served as if safe.
- **F-14 confirmed** — `getReferralDocumentUrl` signs from the legacy
  `case-documents` bucket while fresh case documents land in `attachments-phi`:
  broken downloads for centralized rows, a parallel signer for legacy ones.
- **Production census (2026-08-11):** 45 objects / ~0.5 MB total (38 form-assets,
  3 controlled-documents, 4 printed-documents). The `attachments`/`attachments-phi`
  buckets are **empty**; the 4 production attachment rows are dangling. Drift exists
  in BOTH directions (3 controlled-doc objects unreferenced by any version row;
  1 frozen referral path referencing no object).
- **All 35 feature flags were ON in production**, so the vulnerable surface was live
  but unused.

One audit claim was rejected: the disposal double-audit-row (F-10 part) was already
QA-dispositioned in the live function body (phase-F2-review INFO-1) and is not
re-opened.

## Decisions

**D1 — Immediate posture (EXECUTED 2026-08-11).** `app.feature_flags.attachments`
was set to `false` in production, making every attachment RPC unreachable at
`assert_attachments_enabled()`. Known residual, accepted: the attachment Storage
policies are not flag-aware, so raw Storage-API writes/reads to the empty standard
bucket remain theoretically possible until DM1 drops those policies. No ad-hoc
production schema mutation outside the migration chain.

**D2 — Replace, don't remediate.** With zero objects and the flag off, the audit's
D1 "harden the old model" phase is dropped. The old substrate is **dropped and
rebuilt** (D5); its defects are corrected by construction in the new model, not
patched. The referral signer (F-14) is fixed in its wave (DM4) — with the flag off
no new broken rows can be created meanwhile.

**D3 — Aggregate split.** The single attachment row is decomposed into:
`documents` (logical governed record; title, kind, lifecycle, tenant anchors,
`home_resource_id`) → `document_versions` (immutable revisions,
`UNIQUE(document_id, version_number)`) → `document_version_files` (binding, with
`rendition_kind`: `source | redacted | preview | signed | printed_pdf`) →
`file_objects` (physical identity: `UNIQUE(storage_bucket, storage_path)`,
server-generated paths, verified size/hash/MIME, sensitivity tier, scan state,
disposal state; bucket derived from tier by CHECK).

**D4 — Securable resource registry.** Every document-bearing domain row (initial
closed set: case, meeting, interview, action_item; later waves add controlled
document, referral, RCA/CAPA evidence anchors) owns one `securable_resources` row
(shared-PK / typed composite-FK pinning, the technique proven by the participants
registry). `documents.home_resource_id` is a real FK; the `owner_type` CASE-dispatch
dialect (F-06) ends. The registry holds identity + type + tenant anchors ONLY —
never domain payload (anti-EAV rule).

**D5 — Legacy substrate dropped.** DM1 drops `attachments`,
`attachment_references`, `attachment_subjects`, the four `app.*` attachment
dispatchers, the seven attachment-named public RPCs, and every attachment-named
Storage policy. The 4 dangling production rows are deleted (they reference no
bytes). Binding guardrail from project scar tissue (“cutting a table does not cut
its doors”): the drop migration ships WITH a catalog-sweep pgTAP keystone proving
zero surviving attachment-named routines/policies/grants, and attachment E2E specs
are rewritten against the new module in the same program — never merely deleted.

**D6 — Access model: inheritance now, sharing plane later.** Document access =
home-resource access, resolved live through the domain predicates (case capability,
recusal, membership). The audience/group/scoped-role/access-policy plane from the
audit's §6.7 is **deferred**: no committed product feature requires it. The schema
keeps the seam (`documents.access_policy_id uuid NULL`, unreferenced until a future
ADR defines the policy tables). Placements (`document_placements`) are
non-authorizing, ever; an authorizing placement requires a new ADR.

**D7 — Substrate scope (PO decision: full set minus audience plane).** DM1 creates:
`securable_resources`, `documents`, `document_versions`, `document_version_files`,
`file_objects`, `document_placements`, `upload_sessions`, `document_retention`
(structure now, **values provisional** — see Open item O1), `document_legal_holds`
(issuer, reason category, lifecycle — replaces the bare boolean), and disposal-job
state on `file_objects`. RLS enabled at creation; mutations command-only; every
DEFINER door search-path-pinned, PUBLIC-revoked, and census-registered.

**D8 — Storage topology.** Two new private buckets: `documents-standard`,
`documents-phi`. Bucket derived from `sensitivity_tier`, never caller-chosen. Paths
are server-generated `{organization_id}/{file_object_id}/{generation_uuid}` — no
filenames, titles, or identifiers. **No SELECT policy on either bucket for any
tier**: all bytes flow through the single audited `open_document_version` door,
which authorizes first, then signs short-TTL with the service-role client
(the F-01 class dies structurally). Upload INSERT policies accept only paths
reserved by `begin_document_upload`. Legacy buckets retire per plan DM5.

*Authorization-model clarification.* This changes enforcement topology, not the
policy model: document access still resolves through the existing domain
predicates (case capability, recusal, memberships — ADR 0041/0078 untouched).
Two explicit supersessions: (a) the prior lead decision that referral snapshot
signing uses the cookie client with "RLS as the boundary" is **reversed** — all
protected document bytes adopt the PHI pattern (audited DEFINER door +
service-role signing, no SELECT policies); (b) Architecture Rule 1 gains a
sharpened reading for document BYTES — RLS remains the boundary for metadata
tables, DEFINER-door-only for bytes — to be written into ARCHITECTURE.md at DM5.
Every new door enters the ADR 0079 census; `ARM=census` per phase.

**D9 — Upload/scan lifecycle (fail-closed machine, interim acceptance).**
`reserved → uploaded → verifying → scan_pending → clean → active`, with
`abandoned/failed` reconcilable and `infected/rejected` terminal. Finalize derives
and verifies size/MIME/hash server-side — caller-supplied values are hints, never
trusted (F-04). While no scanner is integrated (PO risk acceptance): user uploads
enter an explicit auditable **`unscanned_accepted`** state, compensated by the
existing MIME allow-list, size caps, and download-only serving headers. Scanner
integration is a named fast-follow (Open item O2); flipping to strict fail-closed
is a single transition change. `pending`/`skipped`-style states are NEVER served.

**D10 — Disposal that means it.** Disposition is a durable job:
`disposal_pending` (reads fail closed immediately) → Storage-API delete when
retention/hold allows → verify absence → `disposed` (non-PHI governance metadata
retained). `open_document_version` rejects both disposal states — the F-02 class
dies structurally. Reclassification across tiers is copy → verify → commit →
retire-source; never a pointer update (F-03). Legal hold blocks disposal;
soft-delete honors hold.

**D11 — Audit contract (Rule 11 floor, exactly).** `open_document_version` writes
an audit row for: every PHI-tier open, every open by a principal other than the
document's creator, and every disposition / classification change / hold change /
(future) policy change. Same-user standard opens and denials are NOT hash-chained;
denials remain raised errors. Expanding beyond the floor is a future product
decision, not a default.

**D12 — Metadata contract: titles are contractually non-PHI.** Titles/descriptions
stay member-readable (list UX preserved); the control is the naming layer: pt-BR
upload guidance + neutral suggested titles; PHI lives in bytes, never labels.
Disposal still redacts title/description (bounded residual). The contradictory
case/interview dialog copy is corrected: the FILE may contain patient data (the
case module is Class-1 under Rule 12); the TITLE must not.

**D13 — Consumer scope (four waves in, two out).** Wave A: case / meeting /
interview / action-item attachments (rebuilt UI on the new module — this turns
`attachments` back ON). Wave B: controlled documents (versions bind to core
`document_versions` + `file_objects`; approval/effective lifecycle stays
domain-owned; no-PHI stance kept, PHI input fails closed). Wave C: referrals —
snapshot/reply files become version/file/rendition records; F-14 signer replaced by
the audited door; frozen snapshots stay immutable. Wave D: NSP RCA/CAPA evidence +
printed renditions (`printed_pdf` rendition kind; verification tokens stay in a
satellite). **Out of scope:** meeting audio (its own program; transient processing
media pending that program's cutover decisions) and form assets (ratified as a
permanently separate non-PHI immutable asset subsystem).

**D14 — Program structure.** Six phases (DM0–DM5) on `main` via the standard agent
team; the drafting worktree carries only DM0. Wave C is **serialized behind the
in-flight referral-detail-redesign merge** (both touch `src/lib/queries/referrals.ts`).
Every phase passes the full §6 gate incl. `ARM=census`/`hat`/`floor` and diff-scoped
door sweeps; per authz-handoff §7, green security tests count only after one-at-a-time
mutation twins.

## Consequences

- The platform gains one document aggregate and ONE byte-serving corridor; adding a
  document-bearing feature becomes a registry row + wave adapter, not a CASE-arm
  sweep across four DEFINER functions and two Storage policies.
- Attachment UI is dark in production until DM2 completes (accepted: zero usage).
- Two authorization surfaces never coexist; the drop is total and keystone-proven.
- The deferred sharing plane means "share with user/group/role" is impossible until
  its future ADR — deliberately, until a feature commits to it.
- `next dev`'s CLAUDE.md auto-block and generated types must be regenerated after
  every DM migration (Rule 8).

## Open items (owned, not forgotten)

- **O1 (PO + legal/clinical):** retention-policy VALUES — trigger events, 20-yr CFM
  floors, erasure vs. retention reconciliation. Schema lands in DM1; values stay
  provisional until signed off.
- **O2 (PO + backend):** scanner selection/integration + operational owner; expiry
  condition for the `unscanned_accepted` acceptance.
- **O3 (future ADR): SCHEDULED at Phase 19 — see Amendment 1.** The audience/group/
  scoped-role sharing plane. Its "if/when a feature commits to it" trigger has
  **fired**: Phase 19 (Surveyor Access & Evidence Export) is a committed,
  specified requirement for per-document access granted to a **non-member**. The
  `access_policy_id` seam and the audit §6.7 sketch are its start.
- **O4 (PO): ✅ RULED 2026-08-13, at DM2 against measured latency** (ADR 0118;
  measurements in the DM2 record §S2.7): **PHI 120 s / standard 300 s signed-URL
  TTLs; no streaming proxy** (the measured 10 ms sign median is what killed the
  proxy option — the corridor's cost is authorization, not signing). The split is
  deliberate, not tuning: **a signed URL is a bearer token, so PHI bytes get a
  strictly smaller exposure window than non-PHI** — the asymmetry IS the point of
  two tiers; do not later "simplify" them to one number.

## Amendment 1 (2026-08-13) — the per-document confidentiality ceiling

**Status:** ratified by the PO 2026-08-13. Closes **FUP-DM1-CEILING**, raised during
the DM1 pgTAP triage and upgraded by the lead from "lost coverage" to "blocks DM2".

**The gap this closes.** ADR **0072 D7 / ETH·E1** made the labels `legal_privileged`
and `credentialing_sensitive` **ENFORCING** — a document could be gated *above*
ordinary case-read, pinned by `e2e/ethics-e1-access-spine.spec.ts` AC-4a/b/c/d and
AC-9 (two documents on the **same** case, one visible to an ordinary reader and one
not). DM1 dropped its enforcement mechanism (`app.attachment_confidentiality_ok`)
with the substrate. **This ADR did not supersede ADR 0072**, and D6's deferral does
not cover the case: D6 defers a plane for **widening** access (share with a user,
group, scoped role), whereas the ceiling **narrows** access below the home resource.
D6's "document access = home-resource access" is the very statement that makes the
ceiling inexpressible. `file_objects.sensitivity_tier` is not a substitute — it
selects a **bucket** by CHECK constraint and carries no principal-facing gate.

**D15 — the ceiling is re-expressed on `documents`, as an explicit interim.** A
nullable confidentiality column on `documents` plus an arm in the
`app.can_read_document` kernel, restoring ADR 0072 D7 semantics. This is a
**DM2 prerequisite**: Wave A must not re-point case / meeting / interview documents
onto the substrate before it lands, because that is the phase in which a formerly
gated document would silently become readable by every ordinary case reader.
Rejected alternatives, recorded so the choice is not re-litigated blind: building the
full access plane now was rejected as designing a general permissions system against a
**single** requirement while blocking Wave A; ratifying the loss was rejected because
it is a decision to widen access to privileged legal material and no one wants it.

**D16 — the general access plane lands at Phase 19, and `documents.access_policy_id`
is its declared landing point.** D15's column is interim **with a stated end-state**,
not a permanent second access dimension. The plane must cover **both directions** —
widening (Phase 19's surveyors) and narrowing (D15's ceiling) — and when it lands,
D15's column migrates into it over a handful of labelled documents.

*Why Phase 19 and not sooner or later.* The platform has now answered "a non-member
needs to see specific things" **three times, bespoke**: `referral_shared_item` +
frozen snapshots (Phase 22), `case_access_grants` + `max_confidentiality` (ETH·E1),
and Phase 19's planned `surveyor_grants` + `scope jsonb`. That is the rule of three,
and **F-14 — a load-bearing finding behind this very ADR — was a bug inside one of
those bespoke mechanisms.** Phase 19 calls itself the most security-sensitive phase
in the accreditation track; building it as a *fourth* one-off is how a fourth F-14
happens. This ADR already anticipated the pressure: `document_placements` is marked
non-authorizing *"ever; an authorizing placement requires a new ADR"* — that ADR is
the Phase 19 plane.

**Consequence for the D6 deferral.** D6 stands for DM2–DM5 and is no longer open-ended:
its "if/when a feature commits to it" condition has fired (O3, above).

## Amendment 2 (2026-08-13) — the ethics document seams join Wave B

**Status:** ratified by the PO 2026-08-13. Closes plan question **Q1**, open since
DM1 plan time. Amends **D13**, which enumerated four consumer waves and covered
ethics in none of them.

**The gap this closes.** Two live ethics columns pointed at the substrate DM1
dropped — `ethics_decision_details.decision_letter_document_id` (a seam only; no
writer, projected by `get_ethics_case_procedure`) and
`ethics_notifications.related_document_id` (written by
`public.issue_ethics_notification`, fed from `src/lib/ethics/actions.ts`). This was
a **scope gap, not a deferral**: nothing decided to postpone ethics, the wave
decomposition simply never named it. DM1 parked both as nullable `uuid` with their
FKs dropped and no replacement, and made `issue_ethics_notification` reject a
non-null id fail-closed (keystone **K8**). Both columns hold zero non-null rows.

**D17 — ethics decision letters and notification-linked documents are Wave B
citizens.** A disciplinary decision letter is a *governed* document with an
approval/effective lifecycle — the same shape as a controlled document — so it
reuses Wave B's machinery rather than earning a wave of its own. Wave A (DM2) was
rejected for shape: ethics letters are not case/meeting/interview attachments and
would have ridden a wave built for a different access shape; by the time this was
ruled, DM2 was a closed, approved phase and adopting them there would have meant
reopening it. A named follow-up after DM5 was rejected because it would close the
legacy-retirement manifest with two columns pointing at nothing.

**Discharge conditions, binding on DM3** (all five, or the seam is not discharged):

1. Re-point both columns to `documents(id)` with a **real FK**.
2. Restore `issue_ethics_notification`'s `p_related_document_id` to a **working**
   parameter. ⚠ Catalog-verified 2026-08-13: the parameter **still exists** (arg 7 of
   8) — DM1 left the signature intact and put the refusal in the **body**. This
   condition is a body change: `CREATE OR REPLACE` keeps the 8-arg identity and
   **preserves the ACL**. Do not plan a DROP+CREATE for it.
3. Remove the fail-closed rejection.
4. **Remove keystone K8c** — ⚠ **corrected 2026-08-13, and the correction is
   load-bearing.** "Remove keystone K8" as originally written names an object that is
   not one: in `supabase/tests/328_dm1_document_substrate.sql`, K8 is **three**
   sub-keystones — **K8a** (`add_referral_shared_item`, parked until **DM4**),
   **K8b** (`add_rca_evidence`, parked until **Wave D**), **K8c** (ethics). **Only
   K8c is DM3's**; removing "K8" literally would delete two parked-seam pins that
   other waves still depend on. In the same edit: decrement `328`'s `plan(N)` and
   remove *only* the K8c flag precondition, leaving the referral and RCA
   preconditions intact. The rationale still holds for K8c alone — *a keystone left
   pinning a refusal the product no longer wants is a test asserting a bug* — and the
   seam is not left unpinned: the pin changes from *"this is refused"* to *"this is
   allowed, exactly this far."*
5. **Add `p_decision_letter_document_id` to `set_ethics_decision_details` and forward
   it from `src/lib/ethics/actions.ts`.** Conditions 1–4 as originally written were
   **incomplete**: catalog-verified, `set_ethics_decision_details` takes **11
   parameters and none is a document id**, and the TS action accepts
   `decisionLetterDocumentId` in its input type then **silently drops it**
   (`actions.ts:393`). Without this, condition 1 would give that column a real FK to
   `documents(id)` while leaving it **unwritable at every layer** — trading "a column
   pointing at nothing" for "a column pointing at documents nothing can create",
   which is the same defect wearing a constraint.
   ⚠ **This one is the mirror image of condition 2, and the asymmetry is the trap.**
   Catalog-verified: `set_ethics_decision_details` has **11 args of which 10 carry
   `DEFAULT NULL`**, so `CREATE OR REPLACE` **cannot** add a 12th — it mints an
   **overload**, after which the live 11-arg call from the ethics screen becomes
   **ambiguous (`42725`)**. Condition 5 therefore requires `DROP FUNCTION` +
   `CREATE` **with an explicit re-GRANT**, because the DROP restores the Postgres
   default ACL. Two ethics functions, opposite treatments, one migration — assert the
   resulting ACL from `pg_proc.proacl`, never from the migration text.

Ethics documents inherit Wave B's no-PHI stance: PHI-tier input on an ethics letter
fails closed (D13).

**Scope boundary — PO ruling 2026-08-13: plumbing to writable, NO UI.** DM3 makes
both seams genuinely writable document-model citizens *through the API* and stops
there. **No attach-a-decision-letter affordance is built in DM3**, and this is a
decision, not an omission: no such affordance has ever existed (verified across the
ethics dialogs, every `type="file"` site in the repo, and the absence of any reader
of either field), and a decision letter is the archetypal `legal_privileged`
document — the UI needs the ETH·E1 access spine, the D15 ceiling, and E2E coverage
designed as a feature, not appended to a migration wave. Filed as **FUP-DM3-ETHICS-UI**.
A later phase reading these columns as write-only must read this paragraph, not infer
an oversight.

⚠ **The ethics access shape is NOT the controlled-document access shape**, even
though the lifecycle is. Ethics case reads are gated by the ADR 0072 / ETH·E1 spine
(`case_access_grants` + `max_confidentiality` + recusal), and the D15 ceiling column
is the mechanism that survives it. DM3 must prove the ethics arm against that spine
with a negative twin — reusing Wave B's *lifecycle* machinery must not import Wave
B's *reader set*.

**The mechanism, ruled by the lead 2026-08-13 and catalog-verified twice
independently: an ethics decision letter's core `documents` row homes on the `case`
securable resource, NEVER on a `controlled_document` one.** This follows necessarily
from the warning above rather than adding to it, and three catalog facts each force
it alone:

1. `app.can_read_document`'s dispatch resolves a `case` home through
   `app.can_read_case` + `app.confidentiality_clearance_ok` — the ETH·E1 spine. It
   has **no `controlled_document` arm today** (it falls to `else false`), so the arm
   DM3 adds for Wave B is the commission-membership arm — i.e. *every ordinary
   commission member*. That is the reader set ethics must not inherit.
2. `app.guard_document_confidentiality` (BEFORE INSERT/UPDATE on `documents`,
   `HC0D6`) refuses `legal_privileged` / `credentialing_sensitive` on any home whose
   type is `not in ('case','interview')`. A controlled-document home would therefore
   **silently delete the D15 ceiling** for the most sensitive material the platform
   holds — and silently, because the refusal fires on the *label*, not on the read.
3. The kernel resolves the clearance case as `case → itself`,
   `interview → case_of_interview`, **`else null`**, and a null case fails closed. So
   a controlled-document home cannot express the clearance plane at all.

**D17's "same shape as a controlled document" is a statement about LIFECYCLE and must
not be read as a schema instruction.** Read as one, it is an ethics-content leak. The
negative twin (DM3 keystone K4) is accordingly written to fail on **widening** — it
adds a membership arm to the `case` branch and requires red — because a twin that
merely removed the ethics arm would prove nothing.

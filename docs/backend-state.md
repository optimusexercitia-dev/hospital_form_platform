# backend-state.md — Living Backend Capability Map

> **Purpose.** A durable, terse map of what the backend already provides, so the lead
> references it at phase start instead of re-deriving ~50 lines of "lead notes" each
> phase. The **lead keeps this current** at the §6 Record step (CLAUDE.md §7): when a
> phase adds an RPC, flips a flag, or changes an RLS surface, update the relevant table
> here. This is a map, not the authority — `ARCHITECTURE.md` is the spec and the **live
> catalog** is the truth (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_constraint`,
> `pg_trigger`, the ACLs). ⚠ **Not the migration files** — some rewrite live function
> bodies at runtime via `pg_get_functiondef()` + `replace()` + `execute`, so their text
> is stale by design (CLAUDE.md graphify exception; this sentence said "the migrations
> are the truth" until 2026-08-05).
>
> 🔤 **RENAMED 2026-08-09 (`20260917000200`): `app.is_commission_admin_of(_for)` →
> `app.is_tenancy_admin_of(_for)`.** The old name is GONE — no shim. It always resolved
> **org_admin / hospital_admin** (the TENANCY tier) and was FALSE for `staff_admin`, the
> actual commission administrator, so the name asserted the opposite of its meaning.
> This doc has been updated throughout; **historical records deliberately have not** —
> ADRs, reviews, plans and progress files still say `is_commission_admin_of`, because
> they record what was decided when it was called that. When reading anything dated
> before 2026-08-09, read the old name as this one. ADR
> [0105](./decisions/0105-rename-is-tenancy-admin-of.md).
>
> 🔧 **Surface changes 2026-08-09 (QO·B follow-up waves, `20260917000000`–`…000400`; 334
> registered == 334 files).** Read this before touching disposal, template config, or cadence:
>
> - **Referral disposal arms moved TWICE in one day.** `20260917000000` CUT the tenancy arm
>   from `dispose_referral_phi` / `can_dispose_referral_phi` / `create_referral_draft`;
>   `20260917000400` **RESTORED it on the two DISPOSAL doors only** (FUP-QOB-3 — disposal
>   reveals no content, and a hospital with **zero NSP operators** would otherwise be unable to
>   honour an LGPD Art. 18 erasure request). **`create_referral_draft` stays CUT.** Guarded:
>   pgTAP `314` **8.6** (all three disposal doors keep the arm) + **8.7** (drafting does not) +
>   `295` §7.7. ⚠ A "finish the disposal wall" sweep MUST red there rather than re-cut.
> - **`dispose_event_phi` is UNCHANGED and keeps BOTH arms** (tenancy + NSP) — a deliberate
>   PO KEEP, same reasoning as ADR 0104 D11's `revoke_printed_document`. Do not "harmonise" it.
> - **Q2 template config gained the tenancy arm**: `set_template_case_type` **and**
>   `set_template_collects_patient` (`20260917000100`, ADR 0088 Amendment 1). Not a widening —
>   all 16 `process_template*` policies already carried it and a bare tenancy admin could write
>   both columns by direct DML; only the DEFINER doors refused. **`create_case_from_template`
>   deliberately does NOT have it** — creating a case is content, not a container.
> - **New cadence surface** (`20260917000300`): `app.cadence_status_of(text, timestamptz)` is
>   the SINGLE home of the em_dia/em_atraso/sem_reunioes/sem_regimento rule — ⚠ **STABLE, not
>   IMMUTABLE** (it reads `now()`; the postcondition asserts `provolatile='s'`). Both
>   `meeting_cadence_status` (member-scoped, one commission) and the new
>   `commission_cadence_overview()` (tenancy-scoped, many) call it, so they cannot drift.
>   ⚠ The overview takes **NO argument by design** — it derives its row set from
>   `is_tenancy_admin_of`, so a caller cannot ask about a commission it does not administer.
>   ⚠ `mensal` means **30 days**, not a calendar month (`interval '1 month'` compares as 30);
>   pinned by `261` CAD-8b.
> - **Three pt-BR authority messages corrected** so every disposal/revocation door's sentence
>   matches its arms: `dispose_case_phi` no longer promises a removed org-admin arm,
>   `revoke_printed_document` no longer hides the tenancy arm it carries. ⚠ **The class:** every
>   arm that moved had left its message behind. No gate here reads prose — move the sentence in
>   the same edit as the arm.
> Last updated: **2026-08-09 — QO·B COMPLETE (org_admin/hospital_admin CONTENT WALL; ADR 0100 D12 +
> PO rulings Q1–Q9; migrations `20260915000000`–`…000500` **+ `20260916000000` (M7)**; NO flag —
> subtractive by design; **329 files = 329 registered** on a fresh reset; QA APPROVED r2). See the
> **QO·B** section immediately below, incl. the M7 addendum.
> Previous: 2026-08-06 — QO·A (quality-office oversight; ADR 0100 D1–D11; migrations
> `20260911000000`–`…000600`; NO flag BY DESIGN — D8's `'excluded'` default + the role grant are
> the two deny-by-default gates; **309 files = 309 registered** on a fresh reset). See the
> **QO·A** section immediately below.
> Previous: 2026-08-06 — MIN (meeting audio → generated ata; ADR 0099 + Amendment 1;
> migrations `20260910000100`–`…000400`; flag `audio_minutes` **OFF**, seed forces ON local/E2E;
> **301 files = 301 registered** on a fresh reset). See the **MIN** section below.
> Previous: 2026-08-06 — AFF (hospital affiliation, CPF person identity, org people
> directory; ADR 0097 + 0098; migrations `20260909000100`–`…001300`; NO flag, structural;
> **298 files = 298 registered** on a fresh reset). See the **AFF** section below.
> Previous: 2026-08-05 (BUG-AUTHZ-002 + MEM follow-ups; migration `20260908000100`; NO flag;
> **285 files = 285 registered, verified** on a fresh reset. **Two hospital-tier DEFINER doors lost
> their `app.is_admin()` arm** — `public.hospital_document_register` and
> `public.hospital_indicator_rollup` now gate on `is_hospital_admin_of(p_hospital) OR
> is_org_admin_of(org_of_hospital(p_hospital))` only. They returned commission content to
> `platform_admin` against ADR 0078 A35's noun rule (measured: 3 documents / 2 rollups → 0 / 0; the
> two legitimate authorities still read 3 / 2). ⚠ **`public.verify_audit_chain` KEEPS its
> `app.is_admin()`** — it is that function's PLATFORM-tier branch (all three args null), and the global
> audit chain is the noun platform_admin *is* granted; its hospital branch already excluded
> platform_admin. Do not "uniform" it away. **Adding a hospital-tier door that returns commission
> content? The gate is `is_hospital_admin_of OR is_org_admin_of` — pgTAP
> `299_hospital_content_door_noun_rule.sql` §4 enumerates from `pg_proc` at run time and reds on any
> member it does not recognise.** New suites: `298_authz_p0_isolation.sql` (32, the FUP-AUTHZ-2
> keystones) + `299` (11). Data layer: `listTechnicalDirection` / `listTechnicalDirectionReferrals`
> (`src/lib/queries/{org,referrals}.ts`), `SessionContext.technicalDirectionOf` +
> `getTechnicalDirectionAccessByOrg` — ⚠ the last three have **no caller yet** (FUP-MEM-3b);
> `MemberListItem.isActive` + `activeMembers()` mirror `app.is_active` for assignee pickers;
> **`earliestSessionStart()`** (`src/lib/queries/rca.ts`) — BUG-RCA-001's PO ruling that "the interview's
> date" is the EARLIEST `interview_sessions.scheduled_start`, exported + unit-pinned because
> `case_interviews` has **no** `scheduled_start` column and the old select silently 42703'd the whole
> read. ⚠ Not status-filtered, unlike `toNextSession` in `interviews.ts`)** · prior:
> **2026-08-05 (`PCI` + `TV` — process-case integrity + process-template identity/version split; ADR 0096; migrations `20260906000100`–`…001100` (PCI) + `20260907000100`–`…001200` (TV); NO flag, structural; 284 files = 284 registered, verified. **`process_template_versions` is new and is where a template's `title`/`description`/`status`/`collects_patient`/`case_type_id` now live** — `process_templates` is a bare identity row (`id`, `commission_id`, `created_by`, `created_at`, `updated_at`) and NO LONGER HAS a `status` column. The four child tables (`process_template_phases` · `_narratives` · `_outcomes` · `_custom_fields`) re-key `template_id` → `template_version_id`; `cases.template_version_id` is nullable `ON DELETE RESTRICT`. New doors `clone_template_version` / `publish_template_version` / `discard_template_draft` / `draft_version_of_template`; `publish_process_template` is now a thin wrapper over the draft. **See the `PCI + TV` section below before touching anything template-shaped.** pgTAP `296` (27) + `297` (37))** · prior: **2026-08-03 (BUG-AUTHZ-001 — dashboard DEFINER gate unified; migration `20260903000700` + pgTAP `270_authz_dashboard_gate_uniformity.sql`; 243 files = 243 registered, verified. All NINE `public.dashboard_*` functions now carry ONE gate — `app.is_staff_admin_of(cid) OR app.is_tenancy_admin_of(cid)`. Previously they split 5/4: `dashboard_distributions` · `dashboard_entity_references` · `dashboard_export_rows` · `dashboard_matrix_cells` · `dashboard_risk_scores` gated on `is_staff_admin_of OR app.is_admin()`, which BOTH admitted a bare `platform_admin` over PostgREST (contra CLAUDE.md's noun rule — `dashboard_export_rows` returns per-response `answers` + `member_name`) AND denied `org_admin`/`hospital_admin`, who the other four admit and who reach `/dashboard` via the ADR 0051 D1 mirror. **Adding a dashboard function? The gate is `is_staff_admin_of OR is_tenancy_admin_of` — pgTAP `270` enumerates from `pg_proc` and will red on any new one that deviates.** No app-code change: the route guard already denied platform_admin. Scoped gate 93/93, pgTAP 4301)** · prior: **2026-07-27 (FF-2 Matrix & Risk Matrix - ADR 0089; migrations `20260830000000`-`...001500` incl. the gate flip `...001200`; flag `matrix_fields` **ON**; 216 files = 216 registered, verified. Radio-grid cell contract (`UNIQUE (answer_id, row_id)`), server-derived `risk_score`, immutable axis `code`s, row-complete required-ness via the NEW single platform-wide predicate `app.item_required_satisfied`, the extracted `app.copy_version_children` deep-copy helper (FF-3/FF-4 queued behind it), four correction copy blocks, cell-unit + risk dashboard aggregation, sign-off/submission matrix projection. **SQLSTATEs HC0P0-HC0P8.** Plus THREE out-of-phase fixes: BUG-FF1-006 (`HC0N2` unmapped), BUG-FF1-007 (the literal-apostrophe filter) and the **ETH-E2 targeted choice lane** (`...001500`). **Door-parity rule + `272_ff2_door_parity.sql` - read the FF-2 section before adding any door or policy.** QA APPROVED r2)** * prior: **2026-07-27 (FF-1 Repeating Groups — ADR 0087 + Amendment 1; migrations `20260828000000`–`…000800` + the gate flip `…000900`; flag `repeating_groups` **ON**; 198 files = 198 registered, verified. Instance engine (depth-1 cap enforced in schema via generated cols + a composite self-FK), instance-aware 2-tier `app.answer_map_scoped` / `app.overlay_answer_map` mirrored SQL↔TS, three **INVOKER** instance RPCs under RLS (ruling 5 — correctness doors, not security doors), `save_section_answers` instance arm, dispatch-by-`item_type` `app.response_required_complete` + `submit_response` prune-then-check, publish-time outside-in condition ban in `validate_visible_when`, explode-by-child-key aggregation, and the platform-wide drop of `form_items_conditional_not_required`. **SQLSTATEs HC0N0–HC0N5** — see the corrected high-water note below. QA APPROVED r2)** · prior: **2026-07-24 (audit-payload free-text sweep — migration `20260826000000`: `supersede_response` / `cancel_session` / `no_show_session` audit payloads are now structured-keys-only; the free-text reason never enters the append-only hash-chained `audit_log` (Rule 11 / LGPD erasure — the case-corrections ADR 0085 pattern). Session reasons persist on RLS-scoped `interview_sessions.cancellation_reason`; the supersede reason stays MANDATORY (HC0H3) but is validated-only, not stored. Catalog sweep of all `app.audit_write` call sites confirmed every other text-typed payload arg is an in-function-guarded controlled vocabulary. pgTAP `225_supersession` 10b flipped to assert reason-ABSENT; full suite 131 files / 3782 tests green)** · prior: **2026-07-21 (`DOC-REDESIGN` — Controlled-Document Redesign, Phase 17 v2; ADR 0081; see the top `## DOC-REDESIGN` section)** · prior: **2026-07-17 (`AUTHZ Gate 2` — meeting confidentiality / reserved sessions (Stage C) + F1 referral-predicate split + N1 NSP-arm** [ADR [0078](decisions/0078-authorization-capability-model.md); QA **APPROVED** re-review + human-approved 2026-07-17; **local-only, remote DEFERRED to the pilot reset**]. Migrations `20260803000000`–`20260816000700` (Stage C C8→C7 `…000000`–`20260810…`, F1 `20260811…`, N1 `20260812…`, C5-VOLATILE `20260813…`, G-cleanup `20260814…`, BUG-STAGEC-ACL `20260815000000`, Gate-2 QA fix wave `20260816…`); catalog **146 migration files = 146 registered rows** (verified). **Stage C reserved sessions:** tables `meeting_closed_sessions` / `meeting_closed_session_items` / `meeting_closed_session_item_readers` (all RLS-on; SELECT via `app.can_reach_meeting`); DEFINER **VOLATILE** audited read door `get_reserved_session_items(p_meeting_id)` + writers `open_reserved_session(p_meeting_id)` / `add_reserved_item(p_session_id,p_case_id,p_substance,p_decision,p_withdrawals,p_quorum_met,p_reader_uids uuid[])` — all `prosecdef=t`, ACL `authenticated`+`service_role` only (no PUBLIC/anon); composed-ata tiering via `app._project_meeting_agenda_item` (title/description/discussion_notes masked per capability tier). **C7 org-admin-arm removal (the P0 fix):** every meeting read now gates on **`app.can_reach_meeting(meeting_id, uid)`** (DEFINER STABLE) = `is_member_of_for(commission_of_meeting, uid) AND (meetings.visibility_policy='commission_default' OR attendee)` — **requires commission membership**; policies `meeting_agenda_items_select` / `meeting_cases_select` (adds `AND NOT app.is_case_respondent(case_id, uid)`) / `meeting_closed_sessions_select`; DEFINER doors `get_meeting_agenda_items` / `get_meeting_cases` / `get_reserved_session_items` / `get_case_meeting_links` no longer carry `is_tenancy_admin_of` (comment-stripped `prosrc`-verified — none). **MAJOR-1:** `meeting_agenda_items.description` joined the substance tier — nulled in `app._project_meeting_agenda_item` unless `read_case_deliberation` on EVERY linked case, and column-level SELECT REVOKED for `authenticated` (`has_column_privilege`=false). **MAJOR-2:** all three reserved tables carry the parent-status lock — `meeting_closed_sessions` via `app.guard_meeting_child_lock` (a direct meeting child), the two subtables via sibling `app.guard_reserved_child_lock` (resolves the meeting through the parent session); both raise `check_violation` (**23514**) when `meetings.status` ∈ {in_signature, signed, distributed, cancelled}. **F1 referral split (D7):** conflated predicate split into DEFINER `app.can_read_referral_metadata` / `can_read_referral_phi` / `can_write_referral_response` / `can_manage_referral_phi_disclosure` / `can_amend_referral_phi_snapshot` (snapshot write re-gated off the read-PHI predicate — read no longer implies write); `set_referral_patient` EXECUTE revoked from `authenticated` (now a private DEFINER helper, ACL `postgres`/`service_role` only), new public door `save_referral_patient` (ACL `authenticated`+`service_role`) delegates to it. **N1 NSP-arm (D8):** in `app._case_caps` the S6 `nsp_referral_touched` arm (`is_pqs_operator_of_for` + a `case_referral` on the case) dropped `read_standard_phi` — an NSP operator keeps `read_case_content`+`read_case_deliberation` on a referral-touched case but its patient-identifier arm now needs an explicit grant (S1 coordinator / S3 manual grant unchanged; event & referral PHI untouched). **G-cleanup:** `app.can_read_case_or_admin` **RETIRED** (byte-equivalent to `can_read_case`; gone from `pg_proc`). **BUG-STAGEC-ACL (`20260815000000`):** `create_meeting_agenda_item` / `link_meeting_case` / `update_meeting_agenda_item` re-REVOKED from PUBLIC + GRANTed `authenticated` (`proacl` = `anon=f, authenticated=t`).) Earlier: **2026-07-16 (`AUTHZ Gate 1 · Stage B` — `case_access → case_access_grants` HARD CUT** [ADR [0078](decisions/0078-authorization-capability-model.md); plan [authorization-capability-model.md](plans/authorization-capability-model.md); QA **APPROVED** [0 P0 · 0 M · 2 minor→post-Gate-1]; human-approved; **local-only, remote DEFERRED to the pilot reset**]. Migration `20260802000000`; SQLSTATEs **HC0F0–HC0F9**. **DROPPED `public.case_access`; the authorization grant store is now `public.case_access_grants`** — capability-per-column (`read_case_content`/`read_case_deliberation`/`read_standard_phi`/`read_restricted_phi`/`write_case_content`) + `max_confidentiality` ranked RESERVED + `source` (only `manual_grant` reachable) + soft-revoke; **own-row-SELECT RLS, NO authenticated DML** (all writes via the DEFINER doors). `grant_case_access` gains `p_read_standard_phi`/`p_read_restricted_phi`; `list_case_access` projects the clearance. **`case_access` feature FLAG RETIRED** (D9 — single authorization path; `assert_/case_access_enabled` gone; `caseAccessEnabled()`→`true`). **Defect ①·2 CLOSED** — PHI is per-column, never inferred from a read/write grant (A16). pgTAP **2981/2981** [`238` +33 · b-mutation 8/8]. Lead-verified equivalence A/B matrix (196 cells → 2 = the intended PHI closure, LOST=0). ⚠ **The `case_access`-table references in the migration log AND ADR index BELOW are HISTORICAL — the live grant store is `case_access_grants`** (MINOR-2 sweep DONE post-Gate-1: the inline *live-surface* references — the R1 gate note, the leak-sweep self-arms, the clearance `max_confidentiality` source, the `case_access`-flag row in the flags table — were repointed to `case_access_grants` / marked RETIRED; the dated migration-log + ADR-index rows are left factual as history of when `case_access` existed)). Earlier: **2026-07-14 (`E1` — **Ethics Access Spine — the m2 gate release** [S3 track; ADR [0072](decisions/0072-ethics-access-spine.md); plan [ethics-e1-access-spine.md](phases/ethics-e1-access-spine.md); QA **APPROVED** after 2 fix rounds [0 B · 0 M · 2 minor→E2]; **local-only, remote deploy DEFERRED to the pilot reset**]. 9 migrations `20260720000980`–`…001070`; SQLSTATEs **HC0E0–HC0E9**; **the ADR-0064 m2 HARD GATE IS RELEASED — `case_participants` + `case_types` flipped ON** (`…001040`); pgTAP **2537/0** [`228_ethics_e1.sql` **125**]. Respondent/recusal hard-deny (evaluated FIRST, before every grant arm) + `cases.visibility_policy`/`confidentiality_level` snapshot + `case_recusals`/`case_conflict_declarations` + 15 DEFINER RPCs + the IV2 fold-in + the document confidentiality ceiling. **⚠ Before adding ANY case-scoped table, read "The three shapes" in the E1 section — a correct `can_read_case` does NOT mean the policies consuming it are.**)**. Earlier: **2026-07-14 (`AI` — **Action-Items Satellites + reminder→N scan arm** [S2 track; ADR [0050](decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md); plan [action-items-satellites.md](plans/action-items-satellites.md); QA **APPROVED** [0 B · 0 M · 1 minor · 3 info]; **local-only, remote deploy DEFERRED to the pilot reset**]. 3 migrations `20260720000950` [3 satellite tables + 8 `committee_*` RPCs] / `…000960` [`list_my_action_items` `visibility_scope`] / `…000970` [BE-6·N reminder→N scan arm]; SQLSTATEs **HC0I0–HC0I2**; flags `action_items`/`cases_extras` ON; pgTAP **2412/0** [`227_action_item_satellites.sql` 70 · `226_notifications.sql` 69, +17 AI-arm]. **3 satellites** on the `action_items` hub — `action_item_reminders` [rules] · `action_item_updates` [append-only feed] · `action_item_checklists` [subtasks] — each ONE SELECT policy reusing `app.can_read_action_item(action_item_id, auth.uid())` **verbatim** [no new predicate/disjunct], **NO authenticated INSERT/UPDATE/DELETE** [8 DEFINER `committee_*` writers — reminders create/update/delete · updates create · checklists create/toggle/update/delete; t19; stakeholder-gated HC0I0–2], audited `app.trg_audit_*` [structural-only diff]. **`list_my_action_items`** widened with `visibility_scope` in BOTH UNION arms. **BE-6·N reminder→N scan arm** [`…000970`]: `compute_due_notifications()` gains an action-item arm — recipient = `coalesce(assigned_to, active owner assignment)` [unassigned⇒nothing], **enqueues only if `app.can_read_action_item(item, recipient)`** [Open #3 — verbatim read predicate reused as the notify gate, closes the `case_restricted`-title leak], terminal-excluded via `action_item_statuses.is_terminal`, milestones reuse `due_soon` [before_due/on_due] / `overdue` [after_due] [NO milestone CHECK change], dedup `action_item:{id}:{milestone}:{date}`, `title`/`body` config-level [item heading + item title — **PHI-free by construction**]; `notifications` `kind`/`entity_type` CHECKs += `'action_item'`; `advance_committee_action_item` terminal branch calls `resolve_notifications_for('action_item', id)` [single choke point — `complete_`+cancel both delegate]. **TS:** `NotificationKind`/`NotificationEntityType` += `action_item`, new **`NotificationSurface`** [3 suppressible surfaces — `action_item` preference-surface **DEFERRED**, opt-in-by-config], `notificationHref('action_item')`→static `/conta/itens-de-acao`. **advance_ rebuild note:** terminal-resolve spliced against the LIVE `pg_get_functiondef` body [source-aware case/meeting authority + swept `is_tenancy_admin_of`], NOT stale `000706/707` text [a re-copy reverts the `000709000200` commission-admin symbol-sweep → breaks the 187 guard]. **One FE-owned tsc handoff:** `NotificationKind`→`NotificationSurface` swap in `notification-preferences-form.tsx`, routed to `frontend`. Detail → AI section below.) Earlier 2026-07-13 (`S1·N` — **Notifications** [S1 substrate of the Pre-Pilot Release, ADR 0071; scope [ADR 0076](decisions/0076-notifications-pilot-scope.md); plan [notifications-s1.md](plans/notifications-s1.md); review [s1-n-notifications-review.md](reviews/s1-n-notifications-review.md)]; QA **APPROVED** [0 BLOCKER/0 MAJOR · 3 MINOR carried fast-follow]; pgTAP **2255/0** [`226_notifications.sql` 52], `notifications.spec.ts` **8/8** [dev + isolated prod-standalone], lint/typecheck 0, Vitest 369; **local-only, remote deploy DEFERRED to the pilot reset**. 4 migrations `20260720000700` [core: 2 tables + engine] / `…000710` [9 event-hook splices] / `…000720` [flag-on] / `…000730` [`list_my_assigned_capa_actions`]; SQLSTATEs **HC0C0/HC0C1**; flag **`notifications`** [21st, ON]. In-app notification center [bell+badge in all shells + commission `AppSidebar`, server-render-on-nav] for **CAPA + Sign-off + Meeting**, actionable-to-me, reminder-only, per-kind reminder toggle [assignments non-suppressible]. **`notifications`** [own-row RLS + **DEFINER-only write door**, NO authenticated INSERT] + **`notification_preferences`** [own-row]; sole write door **`app.enqueue_notification`** [idempotent `(user_id,dedup_key)` ON CONFLICT DO NOTHING, prefs-aware], auto-resolve **`app.resolve_notifications_for`** [reminders only; from CAPA-close/signoff-sign/meeting-conclude]; time-driven **`compute_due_notifications()`** [DEFINER, service_role-only; schedule wired at deploy, pg_cron default]; read RPCs `mark_notification_read` [HC0C1] / `mark_all_notifications_read` / `set_notification_preferences` [HC0C0]. **Rule-12 bodies PHI-free by construction** [config-level snapshot only; QA-traced every enqueue site]; **outside the Rule-11 audit trail** by design [own-data; source events already audited]. **BUG-N-001** [a CAPA action assignable to ANY profile but the only CAPA view is PQS-gated ⇒ a non-PQS assignee had no reachable surface + dead `'#'` href] closed via new global **`/conta/itens-de-acao`** [non-gated personal page under the `requireUser`-gated `/conta` shell] backed by DEFINER self-scoped **`list_my_assigned_capa_actions()`** [config-cols only, PHI-free]; `notificationHref('capa_action')`→that static route [removed the per-recipient RLS lookup that dead-linked]; assignee advances via existing `advance_capa_action` [no PQS gate on the assignee branch]. **BUG-N-002** [auto-resolved reminders stayed visible] fixed via `resolved_at IS NULL` filter in `listNotifications`/`getUnreadCount`. **BUG-N-003** [prefs `<fieldset disabled>` stole keyboard focus] fixed via per-surface in-flight guard. `e2e:prod` oracle GATE RED 632p/31f triaged 31/31 to documented baseline + env-flake [notifications 8/8 isolated-prod-green; spliced-mutation reds = general dialog-close-timing baseline, provably non-N — AC1 conclude-happy-path passes while non-N Cancelar/Reabrir fail identically; ZERO splice-error signatures]. Detail → [notifications-s1.md](plans/notifications-s1.md) + [review](reviews/s1-n-notifications-review.md) + N section below.) Earlier 2026-07-13 (`S1·SUP` — **Supersession correction** [S1 substrate of the Pre-Pilot Release, ADR 0071; plan [supersession-correction.md](plans/supersession-correction.md); model [ADR 0074](decisions/0074-supersession-correction-model.md); review [s1-sup-supersession-review.md](reviews/s1-sup-supersession-review.md)]; QA **APPROVED** [1 BLOCKER **BUG-SUP-002** found+fixed · 0 MAJOR]; pgTAP **2203/0** [`225_supersession.sql` 41], SUP E2E 5/5 + phase8-dashboard regression 24/24 byte-for-byte, lint 0, typecheck clean [after `rm -rf .next`], Vitest 364; **local-only, remote deploy DEFERRED to the pilot reset**. 2 migrations `20260720000600` (core) + `…000610` (flag ON); SQLSTATEs **HC0H0–HC0H5**; flag **`response_correction`** [20th flag, seeded ON local/E2E]. A submitted **standalone** response (`case_phase_id IS NULL`) gets a controlled correction path: a new `in_progress` **successor** supersedes the predecessor via **`responses.supersedes_id`** [self-FK `on delete restrict`; NULL for every ordinary response] + partial-unique **`responses_one_successor_per_superseded`** [≤1 live successor/chain]. **`public.supersede_response(uuid,text)` DEFINER RPC** — authority `is_staff_admin_of OR is_tenancy_admin_of` [O-3]; pre-populates the successor's `answers` + `answer_selected_options` from the predecessor [O-1]; emits **`response.superseded`** audit (payload `successor_id` only — free-text reason removed from the un-erasable chain by `20260826000000`, Rule 11/LGPD; reason stays mandatory HC0H3, validated-only); t19 grants; preconditions **HC0H0–HC0H5** [H5 = the pre-existing one-`in_progress`-draft-per-user/version invariant, **BUG-SUP-001** discriminated]. **`app.guard_supersession_coherent()`** BEFORE INS/UPD trigger — coherence (successor shares predecessor `form_version_id`+`commission_id`, HC0H4) + standalone/submitted shape (HC0H1); **AND (BUG-SUP-002 close) when `supersedes_id IS NOT NULL` AND `auth.uid() IS NOT NULL` [real session; service-role/NULL exempt per ADR 0075] it also enforces the FLAG (`assert_response_correction_enabled`→check_violation) + the SAME AUTHORITY (`is_staff_admin_of OR is_tenancy_admin_of`→42501)** on the direct-INSERT and INSERT-then-UPDATE `responses` write paths — closing the RPC-bypass hole (`responses` has `GRANT ALL … authenticated` + member `responses_insert_own`; the RPC alone was NOT the only write path — Architecture Rule 1). `app.assert_response_correction_enabled()`. **Aggregation retrofit (single choke-point):** `app.submitted_form_responses` gains a `NOT EXISTS` submitted-successor exclusion ⇒ propagates to EVERY dashboard RPC + Phase-15 derived-indicator path; `public.commission_overview` gains the SAME predicate in **both** sub-selects, built on the **POST-MEM** (memberships-scoped) body from `…000300`. Shipped UNCONDITIONALLY (inert until a successor exists — phase8-dashboard 24/24 byte-for-byte). **TS:** `feature-flags.ts` +`response_correction`/`responseCorrectionEnabled`; `submissions.ts` `SubmissionDetail`/`SubmissionRow` += `supersedesId`/`supersededById`/`badge`/`canCorrect` [server-computed] + `resolveSupersessionBadge` + one batched keyset-safe `.in('supersedes_id',…)` lookup; `responses/actions.ts` `supersedeResponseAction {ok,error?,successorId?}` [HC0H0–HC0H5→pt-BR]; `dashboard.ts` **`isDashboardCountable`** TS twin of the SQL predicate (+Vitest). **UI:** `supersession-badge.tsx` [`substituído`/`atual`, icon+text never color-only], `correct-submission-button.tsx` ["Corrigir envio", `canCorrect`-gated, Dialog + required labeled "Motivo da correção", `useTransition`+synchronous `router.push` into the successor wizard], submission detail page + `submission-row.tsx` render badges. **PHI-free** (Rule 12 N/A — standalone non-PHI responses). Detail → plan + review. Also this session (NOT SUP): **gate false-green fix** `scripts/e2e-prod-gate.sh` [`num` parses anchored summary lines from the WHOLE batch log, not `tail -5` — the `N failed` header was dropped by trailing flaky entries → false `GATE GREEN`; memory `e2e-prod-gate-tail5-false-green`]; the honest gate then exposed **31 pre-existing NON-SUP failures suite-wide** [~2/3 a systemic toast/`[role=status]`-not-visible mode; clustered phase3-admin-members 7 / phase10-meetings 6 / phase11-interviews 3] → separate **suite-health track** to classify real-vs-flaky.) Earlier 2026-07-13 (`S1·MEM` — **Memberships collapse** [S1 substrate of the Pre-Pilot Release, ADR 0071; plan [memberships-collapse-s6-1.md](plans/memberships-collapse-s6-1.md); write-path split [ADR 0075](decisions/0075-memberships-collapse-write-path-split.md)]; QA **APPROVED** [0 BLOCKER/0 MAJOR · 3 MINOR cleared at Record]; pgTAP **2161/0** [`224_memberships_collapse.sql` 64], lint 0, typecheck clean, full E2E **586p/0f/8flaky**; **structural — NO feature flag**; **local-only, remote deploy DEFERRED to the pilot reset**. 6 migrations `20260720000000`–`…000500`; SQLSTATEs **HC0G0–HC0G9**. The three role tables `organization_members`/`commission_members`/`pqs_members` collapse into ONE **`public.memberships`** (dialect-1 column-per-scope `organization_id`/`hospital_id`/`commission_id` + discriminated shape CHECK per role; `principal_id`→profiles, `granted_by`→profiles; 5 indexes incl. `nulls not distinct` grant-unique `memberships_grant_uq` + `memberships_title_idx`; **SELECT-only RLS, ZERO `authenticated` DML grant** — WS-1 lockdown posture). **Writes** flow through ONE `grant_role`/`revoke_role` **SECURITY DEFINER** door (+10 back-compat shims — `assign/revoke_org_admin`, `assign/revoke_hospital_admin`, `assign/revoke_nsp_*`, `add_pqs_member`→**void** per O-5, …; `app._deny_self_grant` stays 42501; **HC0G1** last-admin anti-lockout). **Reads** flow through ONE `app.has_role(scope_type,scope_id,role,user_id)` family (+`has_role_any` + a 3-arg overload) behind **27 unchanged `is_*_of`/`_for` wrappers** — ~145 call-sites (56 procs + 87 policies + 16 bespoke read fns) compile verbatim, incl. the once-missed `is_entitled_document_approver`. **Audit HARD-CUT** (product-owner decision — clean on the pilot's fresh reset, no display aliases): blanket `trg_audit_memberships` emits unified **`membership.granted`/`membership.role_changed`/`membership.revoked`** (pt-BR "Função concedida/alterada/revogada") on ANY write path; the legacy `commission_member.*`/`organization_member.*`/`pqs_member.*` verbs are **retired** from `AuditAction`/`AUDIT_ACTION_LABELS` (`queries/audit.ts`) + `audit-icon.tsx` entity-key. **ADR 0075 write-path split:** service-role writers (`createAdminClient()`, `auth.uid()`=NULL) keep DIRECT RLS-exempt `memberships` writes (TS-authorized, still audited by the blanket trigger); RLS-scoped cookie-client writers (`removeStaff`/`removeStaffAdmin`, O-2) route through the door where `auth.uid()` resolves. **Invariant:** `authenticated` has NO direct DML grant ⇒ any crafted client write → 401/403. **CASCADE fix** (`…000500`): `DROP TABLE commission_members CASCADE` silently dropped two `profiles` SELECT policies carrying raw `commission_members` joins; recreated byte-for-byte repointed to `memberships` (the only two victims — all other membership-referencing RLS uses `is_*` wrappers, which were repointed in place). **BUG-MEM-001** (tester-found BLOCKER, fixed): the new `granted_by→profiles` FK made unqualified `profiles(...)` embeds ambiguous (PGRST201) → `listMembers`/`listCommissionsForAdmin` qualified to `profiles!memberships_principal_id_fkey(...)` + added the missing `{error}` throws (was silent-empty roster). Types regen. `seed.sql` re-expressed for `memberships` (33 grants; CCIH = 9). QA minors cleared at Record: **m1** grant/revoke `is_admin()` asymmetry documented (ADR 0075 — intentional safe narrowing, revoke is the narrowing direction), **m2** `is_pqs_operator_of` InitPlan `(select auth.uid())` wrap, **m3** `224` §7 3 smoke asserts → 6 TRUE/FALSE truth pairs (61→64). Detail → [memberships-collapse-s6-1.md](plans/memberships-collapse-s6-1.md) + [memberships-collapse-review.md](reviews/memberships-collapse-review.md).) Earlier 2026-07-12 (`f-cleanup` — **F-cleanup residual DB-hardening** [D3+D10+D8+D11]; QA APPROVED [0B/0M/2m/3i], Minor-1 closed; pgTAP **2100** [86 files/0 fail], full E2E all 51 specs green; **local-only, remote deploy DEFERRED to the pilot reset**. ADRs [0068](decisions/0068-result-engine-fk-junctions.md)/[0069](decisions/0069-status-key-anglicization.md); migrations `20260719000000`–`…000800`. **D3** (result-engine jsonb/array→FK junctions, D3-mid): new `process_template_phase_allowed_results` + `process_template_phase_offered_results` (FK-integrity shadow = allowed∪ruleset∪default) + `case_phase_allowed_results` (RLS from creation; helpers `commission_of_template_phase`/`case_of_case_phase`/`recompute_template_phase_offered_results`); `result_ruleset` stays jsonb (`compute_case_phase_result` UNCHANGED, Rule 3), `blocks` stays integer[]; RPC signatures UNCHANGED (decompose jsonb→junction internally; query re-aggregates to `allowedResultIds:string[]` ⇒ **zero frontend change**); dropped `{process_template_phases,case_phases}.allowed_result_ids`+CHECKs; the emits⇒no-allowed invariant re-enforced in the RPCs+snapshot = new errcode **HC067**. **D10** generic `app.touch_updated_at` + `updated_at` col/trigger on `cases`/`commissions`/`forms` (metadata, unaudited). **D8** no schema change; pgTAP FK-lock on the two Phase-15 indicator FKs. **D11** anglicized ALL 12 status-enum internal keys → English (1:1, semantics identical; keys in CHECKs/defaults/fn-bodies/seed/fixtures/TS-unions/label-map-keys; pt-BR label VALUES kept — Rule 10): `indicators`/`meeting_attendees.attendance`/`case_narratives`/`indicator_measurements`/`capa_action`/`case_interviews`/`capa_plan`/`controlled_documents(+_versions)`/`case_referral`/`meetings`/`cases`/`case_phases` (`indicator_measurements` RPC output cols na_meta/fora_da_meta/sem_dados→on_target/off_target/no_data, `queries/indicators.ts` updated). Detail → [f-cleanup.md](plans/f-cleanup.md)/[f-cleanup-d11.md](plans/f-cleanup-d11.md).). Earlier 2026-07-11 (`feat/pre-pilot-foundations-plan` — **F2 Centralized Attachments** (ADR 0063/0065, formerly phase-14e); QA **APPROVED** [0 BLOCKER/0 MAJOR · 3 MINOR · 4 INFO], MINOR/INFO fast-follow cleared at Record; 6 migrations `20260717000000`–`…000500`; flag `attachments` seeded OFF (`seed.sql` enables local/E2E), **remote deploy DEFERRED to the pilot**. Single polymorphic `attachments` table (owner-dispatch `(owner_type, owner_id)` no-FK, **dialect 2** — the platform's first) superseding the case_documents / meeting / interview file tables, + `attachment_references` / `attachment_subjects` (→ F1 `participants`, dialect 3) / `case_interview_links`; two buckets — `attachments` (standard, authenticated owner-dispatch SELECT) + `attachments-phi` (**NO authenticated SELECT — the hard PHI door**); audited `open_attachment` door (service-role signed URL, exactly one `attachment.read` per allowed phi open, NULL-out-of-scope) the SOLE phi-blob read path; owner-dispatch `commission_of_attachment` / `can_read_attachment` / `can_write_attachment` (explicit `p_uid` `_for` variants; **interview arm case-scoped via `can_read_case`**); fold-in dropped the 3 legacy tables + repointed `rca_evidence` (RESTRICT) / `referral_shared_item` (SET NULL) FKs; `dispose_case_phi` composes attachment PHI disposal (D10 seam + legal-hold skip); SQLSTATEs **HC096/HC097/HC098**. pgTAP `208_attachments.sql` 50/50 → full **1957** PASS; tsc/lint 0. Detail → F2 section below + [ADR 0063](decisions/0063-centralized-attachments-substrate.md) / [phase-14e](phases/phase-14e-attachment-phi-classification.md).) Earlier 2026-07-10 (`feat/pre-pilot-foundations-plan` — **F1 Case-Participants E0**; ADR 0064/0066; migrations `20260716000000`–`…000200`; flags `case_participants`/`case_types` seeded OFF (m2 hard gate); participants dialect-3 registry + subtype composite-FK pins (R5) + `case_patient → patient_identifiers` N-per-case re-key + `cases.organization_id` (R2) + `patient_xref` participant grain (ADR 0066/R3) + Class-2 `professional_profiles` (audited reads, no single door) + generalized `dispose_case_phi`; SQLSTATEs HC094/HC095; new audit verb `professional_profile.read`. Full pgTAP suite green (151/152/207 + re-keyed 171/191/197); tsc/lint 0; **remote deploy DEFERRED to pilot**. Detail → F1 section below + [ADR 0064](decisions/0064-case-subject-generalization-participants.md)/[0066](decisions/0066-patient-xref-participant-rekey.md).) Earlier 2026-07-08 (`feat/administrativo-role` — **Administrativo delegated-capability role**; ADR 0061; QA APPROVED [0 BLOCKER/0 MAJOR/0 MINOR · 3 INFO]; pgTAP **50/50**, feature E2E **10/10** + full regr 574 pass (0 reg); merged → `main` `1010f07` (4 migrations `20260714000000`–`…000300` local-only, **remote deploy DEFERRED**). A coordinator may appoint any staff member as an **"Administrativo"** and grant a curated, finite capability menu (`schedule_meetings`/`create_cases`/`assign_case_phases`/`view_signoffs`) — no new role enum, decoupled from the display-only "Secretário" title; flag `administrativo` seeded OFF. **New objects:** `commission_administrativos` + `commission_administrativo_capabilities` (SELECT-only DEFINER-door tables, audited); `app.member_can` (flag-aware kill switch, OR-composed ONLY into specific guarded DEFINER doors — never into the `cases`/`case_phases` `FOR ALL` write policies); `app._grant_case_access_unchecked`. **Widened surfaces:** `create_case`/`create_case_from_template` (`create_cases`), `create_meeting` (`schedule_meetings`), `activate_phase`/`reassign_phase` (`assign_case_phases`), `list_signoff_queue`/`get_response_for_signoff` (`view_signoffs`), `list_cases_board` (any capability, filtered to `can_read_case`). New RPCs `appoint_administrativo`/`revoke_administrativo`/`grant_member_capability`/`revoke_member_capability`/`update_case_meta` (label/department only, blocks terminal — HC025). Escalation closed by construction (`is_staff_admin_of OR is_tenancy_admin_of` + `app._deny_self_grant` — a holder can never appoint/grant). **Design note:** phase-assignment / non-coordinator case-creation grant the recipient `case_access` **READ only** (a same-day product-owner revert from an initial write-grant design) — the coordinator's explicit `grant_case_access` stays the sole case-content-write path. Detail → [administrativo.md](progress/administrativo.md). Earlier 2026-07-06 (`feat/phase-17-controlled-documents` — Phase 17 **Controlled-Document Lifecycle** [Gestão de Documentos Controlados]; ADR 0057; QA APPROVED [0 BLOCKER/0 MAJOR · 3 MINOR cleared · 4 INFO]; pgTAP **47/47** [full 1717], phase E2E **14/14**, full `--workers=1` regr **588p** [0 Phase-17 reg]; **remote deploy DEFERRED to the pilot**. Migrations `20260713000000`–`…000400`. Three tables `controlled_documents`→`controlled_document_versions`→`document_approvals` [version-level status `rascunho→em_aprovacao→vigente→obsoleto`; per-commission `DOC-####` mint; flag `controlled_docs` seeded OFF→ON `…000400`]; RLS **posture (b)** member-READ + **version-scoped approver-read arm** [a pending/decided `document_approvals` row grants scoped read of just that doc/version; **RLS cross-referential recursion fixed via 3 SECURITY DEFINER helpers** `is_document_approver_of`/`is_document_version_approver`/`can_read_document_of_version`, owner=postgres, search_path-pinned]; immutable **`controlled-documents` bucket** [25 MB, private, INSERT+SELECT only — Rule 6, new path per version]; ~9 lifecycle RPCs + `set_document_version_file` [DEFINER-only writes; sign-own-row + per-signer `signature_hash`=sha256(path‖approver‖decision); submit=delete-then-insert the approver set; state-machine **HC089**, all-must-approve **HC090**, entitlement **HC091**, dup **HC092**, frozen-set **HC093**]; DEFINER reads `documents_due_for_review`/`hospital_document_register`/`list_approver_candidates` [PHI-free/min-necessary, foreign→empty, t19 REVOKE→GRANT]; **forms-as-controlled-docs** metadata [`form_versions` += `approved_by/at`/`effective_date`/`review_due_date`, captured INSIDE `publish_form_version` — pure pass-through, **`guard_published_version` UNTOUCHED** so settable only via the RPC]; audit AFTER-triggers strict allow-list [never title/summary/note/storage_path]. Shared `src/lib/documents/version-select.ts` [`selectWorkingDraft`/`selectSignableVersion`/`findMyApprovalForVersion`] consumed by both detail pages. PHI-free by design [Rule 12 N/A]. MINORs cleared at Record: reject purges pending siblings (pgTAP §10), editar→404, overdue UTC-aligned. Detail → [phase-17.md](progress/phase-17.md). Earlier 2026-07-06 (`phase-15-indicators` — Phase 15 **Quality Indicators**; branch `feat/phase-15-indicators` → merged to `main` (local; origin not pushed); ADR 0057/0058; QA APPROVED [3 MINOR fixed pre-merge]; E2E `phase15-indicators` **12/12** prod-standalone; **remote deploy DEFERRED to the pilot**. Migrations `20260712000000`–`…000300` (+ B7 `4736e02`). New tables `indicators` + `indicator_measurements` (per-commission `IND-%04d` mint; flag `quality_indicators` seeded then flipped **ON**); RLS **posture (b)** — member-READ SELECT policy + grant, **NO direct write** (every write via DEFINER RPC, authority `is_staff_admin_of OR is_tenancy_admin_of`); audit AFTER-triggers (non-sensitive allow-list, never free-text). Three data sources manual/derivado/hibrido; **derived == Phase-8 dashboard aggregate by construction** (parity lock vs `dashboard_distributions`, ADR 0058) via option `code`s + `answers.value_number`; **manual `taxa` allowed** (2 one-way CHECKs, not a biconditional). **Two-tier CAPA hook:** FKs `capa_plan.source_indicator_id` + `capa_measure.indicator_id`; `open_capa_plan` indicator arm derives `hospital_id` from the commission; `can_read_capa` indicator arm (commission members read); **`can_write_capa` UNTOUCHED** (WS-3c). B7 shared-hub `createManualActionItem` (non-operator fallback) + `hospitalId` on `Indicator`. SQLSTATEs **HC084–HC088**. MINOR-1 fix added a shared `PeriodWindowFields` (`periodStart`/`periodEnd`) so derived/hybrid measurements are period-scoped. Detail → [phase-15.md](progress/phase-15.md). Earlier 2026-07-05 (`pre-pilot-hardening` — **Wave 2 (WS-6 perf sweep)** of the pre-pilot DB hardening program; branch `feat/pre-pilot-hardening`; QA APPROVED [Sonnet, live-verified]; **deployed to remote via `supabase db reset --linked` 2026-07-05**; detail → [pre-pilot-hardening-wave2.md](progress/pre-pilot-hardening-wave2.md)). Migration `20260711000900_perf_sweep_wave2.sql` (additive; P8 was already in Wave 1). **P2** NEW `list_audit_filter_actors(p_commission)` — `SELECT DISTINCT ON (actor_id)` **SECURITY INVOKER** (audit_log RLS is the authority; replaces a full-table fetch-and-dedup in `audit.ts`); no foreign-commission actor leak (QA live-verified). **P3 keyset (cursor) pagination:** new `src/lib/types/pagination.ts` — `Page<T>={rows,nextCursor}` + `PageParams{cursor?,limit?}`, `DEFAULT_PAGE_SIZE=25`, opaque base64url cursor via `encodeCursor`/`decodeCursor`; the 5 list queries (`listSubmissions`/`listCommissionReferrals`/`listMeetings`/`listCasesBoard`/`pqsInbox`) now return `Page<T>`. `pqs_inbox` gained keyset params `(p_cursor_reported_at,p_cursor_id,p_limit)` order `(reported_at DESC,id DESC)` — **operator-hospital gate byte-for-byte unchanged** from `…000710` (ADR 0052; QA live-verified foreign-hospital caller sees nothing); binds cursor values as **typed RPC params** (injection-safe by construction). `list_cases_board` gained `p_limit` only — **CAPPED @200, NOT cursored** (kanban column-per-status can't page a flat cursor; `nextCursor` always null). +5 keyset composite indexes. **Cursor injection hardening (QA MAJOR):** the 3 flat-list sites (`submissions`/`meetings`/`referrals`) that interpolate cursor fields into a raw PostgREST `.or()` string now route through `decodeCursor(cursor, schema)` — each field strictly validated as ISO-timestamp / UUID (forms that structurally exclude `,()`), any tampered field → cursor rejected → page 1; Vitest lock `src/lib/types/pagination.test.ts`. **P4** NEW `get_feature_flags()` **SECURITY DEFINER** returns all `app.feature_flags` as one jsonb; `src/lib/queries/feature-flags.ts` `getFeatureFlags = cache(...)` (request-memoized) with 13 per-flag `*Enabled()` wrappers delegating to it (scattered across `queries/*`, `case-access/actions`, `case-narratives/actions`, `meetings/actions` — behavior-preserving; the layout's 7 flag round-trips collapse to **1/request** automatically). NEW `count_open_cases_for_board(p_commission)` **SECURITY DEFINER** — reproduces the board's EXACT `is_staff_admin_of` visibility (a direct `cases` RLS count would diverge; QA verified parity 29==29 / 0 for a foreign staff_admin) — drives the sidebar "Casos" badge (`countOpenCasesForBoard` in `cases.ts`); the other 4 layout badges (myPhases/myCases/signoffQueue/pendingSignatures) left user-scoped-counted by design; the triage workstation is capped (`TRIAGE_QUEUE_CAP=200`, no control) so its topbar counts stay full-backlog-accurate. **P5** `listSubmissions` form filter pushed server-side (`.eq('form_versions.form_id',…)` on the `!inner` version embed; the client-side `.filter` + wrong "not filterable" comment removed). All 4 new/changed functions carry per-object `REVOKE…FROM public` + `GRANT EXECUTE…authenticated,service_role` (C-2 posture). pgTAP `199` (28 assn) → full ordered **66 files/1644 PASS**; Vitest **206**; E2E `perf-sweep-wave2.spec.ts` **13/13** (dev+prod); full regr **546p/16f** (0 Wave-2 reg — 16 = AIF-001 baseline). Types regen. Wave-2 commit `a2a7fab`. **— Earlier same day (`pre-pilot-hardening` — **Wave 1**; ADRs 0053–0056; QA APPROVED [Opus, live-verified]; deployed via `db reset --linked`; detail → [pre-pilot-hardening-wave1.md](progress/pre-pilot-hardening-wave1.md)). Structural hardening of the 2026-07 external DB audit's critical set + do-now data-model/perf; 8 migrations `20260711000000`–`…000800`, pgTAP `190`–`198`. **WS-1 (C-3/H-6/H-7) membership write lockdown:** dropped the `organization_members` write policy + `pqs_members_curator_all`; **REVOKE insert/update/delete from `authenticated`** on both (`organization_members` = SELECT-policy-only; `pqs_members` = **zero-policy DEFINER-door**); every grant now flows through guarded DEFINER RPCs — NEW `assign_org_admin`/`revoke_org_admin` (shared `app._deny_self_grant`; **HC081** last-org_admin anti-lockout: `count(*) filter (role='org_admin' and hospital_id is null) <= 1`), patched `add_pqs_member` self-check; blanket AFTER audit triggers `trg_audit_organization_members`/`trg_audit_pqs_members` emit `organization_member.*`/`pqs_member.*` on **any** write path (incl. the service-role provisioning door). **WS-2 grant hardening:** **C-1** REVOKE insert/update/delete/TRUNCATE on `audit_log` from `authenticated` + statement-level `app.guard_audit_truncate` (**HC042**, GUC-gated on `app.allow_audit_teardown` — fixture-teardown-only, unreachable in prod; row DELETE/UPDATE immutability guard untouched); **C-2** flipped `ALTER DEFAULT PRIVILEGES … GRANT ALL … authenticated` → revoke-default + grant-per-object (**⚠ applies to `postgres`-owned objects, the migration path — a table must be CREATEd as `postgres` for the revoke-default posture to apply**; QA INFO-4); **C-4** entitlement guard `app._audit_access_authorized(action, entity_id, commission)` inside `log_audit_access` — dispatches each allow-listed action to the entity's own `can_read_*` (14 arms, fail-closed ELSE + allow-list⊆dispatch completeness pgTAP), closing cross-tenant who-read-what forgery. **WS-3a (C-5):** `answers.form_version_id NOT NULL` (BEFORE-INSERT `derive_answer_version` from the response) + FK-referenceable `form_items_id_version_key_uq` + 3-col FK `answers(item_id, form_version_id, question_key) → form_items(...)` (forces item∈version AND key-is-real); Rule 3 golden byte-for-byte. **WS-3b:** D1 six delete-path FKs SET NULL→**RESTRICT**; **D2 tenant composite FK** `commissions(hospital_id,organization_id) → hospitals(id,organization_id)` + `hospitals_id_org_uq` + `guard_hospital_org_repoint` (**HC082**) — **keeps BOTH** the single-col FK (ON DELETE RESTRICT) and the composite (ADR 0054); D6-flip `form_items_input_vs_display` `ELSE false`; **D7 dual-scope NSP vocab** (`pqs_event_types`/`pqs_sentinel_criteria` `hospital_id` nullable + partial uniques; 8 CRUD RPCs re-gated `app.can_curate_pqs_vocab(p_hospital_id)` = **global(NULL)→is_admin, hospital→is_pqs_operator_of**; `save_triage` reads global ∪ event-hospital); D9 responses/cases/case_referral lifecycle CHECKs. **WS-3c (D4/H-8/P8):** `capa_plan.hospital_id NOT NULL` (`derive_capa_hospital` from event/rca/meeting); `can_write_capa` COLLAPSED to `is_pqs_operator_of_for(hospital_id)` (closes cross-hospital write hole); `mint_capa_code` per-hospital + UNIQUE flipped `(code)`→`(hospital_id, code)`; `open_capa_plan` +`p_hospital_id` (**HC083** multi-hospital); latent `can_read_capa` manual-CAPA-invisible bug fixed (resolve via `hospital_id` too). **WS-4 (C-6):** `dispose_case_phi` completed (case-phase `answers` DELETED — `case_phases.result_id` survives; + redact `case_interviews.summary_md`/`case_interview_subjects.note`/`cases.label`/`case_documents.*`/`meeting_cases.*`/`case_events.title`); `dispose_event_phi`/`dispose_referral_phi` gap-fills; NEW **`dispose_meeting_minutes`** (decoupled, coordinator-gated, `meetings.phi_disposed_*`, **HC056**, `meeting_minutes.disposed` audit); `get_referral_detail` hides `frozen_storage_path` AND `decline_note` from non-PHI readers; **Storage kept (Rule 6), erasure claim NARROWED (ADR 0056)** — DB-side PHI erased, blobs retained encrypted under 20-yr retention. **WS-5 perf:** +2 P9 indexes (`organization_members(user_id,role,hospital_id)`, partial `audit_log(hospital_id,occurred_at DESC)`) + 9 hot-policy `auth.uid()`→`(select auth.uid())` **InitPlan wraps** (meaning-preserving; RLS suites are the proof); +5 P10 FK indexes; **P1** `getSessionContext` React `cache()`-wrapped (`src/lib/queries/session.ts`). **Gate fix (`68b393b`):** `listHospitalsForOrg` (`src/lib/queries/org.ts`) embed pinned to `commissions!commissions_hospital_id_fkey(count)` — the D2 composite FK made the un-hinted `commissions(count)` embed ambiguous (PGRST201); the pin disambiguates (feeds hospitais + comissoes + usuarios selectors). **DEFERRED:** D3 (junction normalization), P7 (audit partitioning — time-axis breaks per-chain-seq tamper-evidence; correct axis = chain_key), MINOR-5 (revoke TRUNCATE on the 2 membership tables — latent). pgTAP **Files=65/Tests=1616 PASS**; Vitest 193; tsc/eslint 0; E2E standalone 531p/0-reg. **TS contract:** only `org/actions.ts` (HC081 message), `platform/actions.ts` (onConflict `organization_id,user_id,role,hospital_id`), `queries/session.ts` (`cache()`), `queries/org.ts` (embed pin); types regen (backward-compat). Earlier 2026-07-03 (`nsp-per-hospital` — **Phase B (backend core)**; branch `feat/nsp-per-hospital`; ADR 0052; partially supersedes ADR 0042). **Security-critical re-key of the PQS/NSP roster + EVERY PHI door from per-org → per-HOSPITAL**, plus three net-new surfaces. Migration `20260710000000_nsp_per_hospital.sql` (NOT additive — `pqs_members` PK `(org,user)`→`(hospital,user)`; `pqs_department` keyed `UNIQUE(hospital_id)`; `organization_members` hospital-scope CHECK widened so **`nsp_coordinator` is now hospital-scoped** `hospital_id NOT NULL`; greenfield reseed). **Primitives:** `is_pqs_member_of`/`is_nsp_coordinator_of` re-keyed to hospital; NEW `is_pqs_operator_of(hospital)` = coordinator ∪ member (**decision 12 — the local coordinator is a FULL operator: implicit PHI read + write**); `is_pqs_writer_of = is_pqs_operator_of`; NEW `is_nsp_org_admin_of(org)` (org-level, **ZERO PHI** — appears in NO `can_read_*`/`get_*_patient` door); `is_pqs_operator_in_org(org)` (nav-only); resolution helpers `hospital_of_commission/event/referral/capa_action` (dropped `org_of_event/referral/capa_action`; KEPT `org_of_commission`/`org_of_hospital`). **Doors re-keyed:** 10 read preds (`can_read_event[_patient]`/`can_read_capa`/`can_write_rca`/`event_current_custodian`/`can_read_referral[_phi]`/`can_read_xref_row`/QPS macro-term in `can_read_case[_patient]`) → operator+hospital; **dual-hospital referral reads (decision 14)** — `can_read_referral[_phi]` resolve BOTH endpoint hospitals (source ∪ target); write gates (`can_write_capa` consolidation + `save/confirm/reopen_triage`, `triage_disposition`, `add_rca_member`, `open_capa_plan`, `advance_capa_action_core`, `capa_kpis` result-scoped); DEFINER doors (`pqs_inbox` operator-hospital-scoped, `dispose_event_phi` operator gate, `mint_event_code` per-hospital EV, `patient_xref_count`); patient_index doors (`search_patient_xref`/`patient_access_audit`/`get_patient_trajectory_for_entity`/`patient_trajectory_bundle` `p_org_id`→`p_hospital_id`, **audit at HOSPITAL tier**); storage `capa_evidence_obj_insert_writable` → `hospital_of_event`; `pqs_members` RLS `pqs_members_curator_all` (`nsp_org_admin ∪ coordinator`); org/commission SELECT policies re-broadened per-hospital. **Net-new:** `nsp_org_admin` PHI-FREE aggregate doors `nsp_org_event_rollup`/`nsp_org_capa_rollup`/`nsp_org_roster`/`is_nsp_org_admin_of_self` (per-hospital counts/status/staff only — **provably no PHI/code/title/narrative column**, qa keystone; result set scoped to org's hospitals, M3); three-tier appointment chain `assign_nsp_coordinator`/`revoke_nsp_coordinator` (DEFINER, `is_nsp_org_admin_of`-gated, no self-delegation — decision 3: hospital_admin has NO NSP power); roster/config RPCs `add/remove/list_pqs_members`+`set_pqs_rca_due_window`(hospital) re-gated `nsp_org_admin ∪ coordinator` (rca-window audit at hospital tier); `list_my_nsp_hospitals()` (NSP switcher), `list_hospital_eligible_users_for_pqs(hospital)` + `list_org_eligible_users(org)` (org-wide picker, `org_admin ∪ nsp_org_admin`); `dispose_referral_phi(referral, reason)` — LGPD erasure mirroring `dispose_event_phi` (dual-hospital gate: `is_admin ∪ source-commission-admin ∪ EITHER-endpoint operator; deletes `referral_patient` + redacts/nulls the FULL PHI graph — `case_referral.subject/description_md/decline_note`, `referral_reply.result_md`, `referral_shared_item.frozen_title/body` (redact, shape-CHECK-safe); keeps ENC code + provenance; hospital-tier audit; `case_referral` gains `phi_disposed_*`). **t19 guard:** all recreated `public.*` RPCs `REVOKE ALL FROM PUBLIC` + `GRANT authenticated,service_role` (DROP+recreate reset grants). **Catalog sweep** in-migration asserts ZERO residual `org_of_event/referral/capa_action` + `pqs_members…organization_id` (ADR 0042 M2). **TS contract:** `queries/pqs.ts` (`isPqsMemberOfHospital`/`isNspCoordinatorOfHospital`/`listMyNspHospitals`/`listPqsMembers(hospital)`/`getPqsDepartmentForHospital`/`listHospitalEligibleUsersForPqs`/`listOrgEligibleUsers`); new `pqs/org-admin.ts` (rollup readers + `isNspOrgAdmin`); `org/actions.ts` `assign/revokeNspCoordinator(hospital)`; `queries/session.ts` `getNspAccessByOrg` returns `.hospitals: NspHospitalGrant[]` (via `listMyNspHospitals`); `patient-index` `searchPatientForHospital`/`getPatientAccessAuditForHospital`; `referrals/actions.ts` `disposeReferralPhi`. **Seed:** org-A 2nd hospital (secundário-a) gains "Comissão de Segurança do Paciente A2" + NSP event (`PRT-A2-0001`) + INTRA-org CROSS-HOSPITAL referral (`PRT-A2-0002`, central-a CCIH → secundário-a); personas `nspcoord.a2`/`pqs.a2` (`.a`/`nspcoord.a` remap to central-a); per-hospital `pqs_department` (windows 45/20/30). **pgTAP total 1454 → ~1449 (`173` deleted, `189_nsp_per_hospital_isolation` +42 added; `145`/`176` re-keyed per-hospital; 7 single-hospital suites byte-identical re-keyed; `171` commission count 3→4).** New `189` keystones: cross-hospital SAME-ORG PHI isolation, coordinator-as-operator (unenrolled), nsp_org_admin ZERO-PHI on every door + PHI-free aggregate SELECT-list assertion, dual-hospital referral (both endpoints read; cross-org denied), disposal + get_referral_patient→null, per-hospital EV/config. Vitest 193/193; tsc 0; eslint 0. **Then earlier:** 2026-07-03 (`hospital-admin-tier` — **Phase A**; branch `feat/hospital-admin-tier`; ADR 0051; QA APPROVED [CHANGES REQUESTED → all 5 fixed]; §6 Record 2026-07-03 — merged → main + remote `db push`). New role **`hospital_admin`** (org_admin mirrored, hospital-scoped) on `organization_members`: role-CHECK widen + nullable `hospital_id` + iff-CHECK (`hospital_id` set **iff** `role='hospital_admin'`) + `UNIQUE NULLS NOT DISTINCT(user_id,organization_id,role,hospital_id)`; `nsp_org_admin` is in the CHECK but **INERT** (behavior lands Phase B). **Predicates:** new `app.is_hospital_admin_of(hospital)`, combined `app.is_tenancy_admin_of(commission)` (+`_for` variants: org_admin OR hospital_admin-of-the-commission's-hospital), `app.is_org_level_admin_within(org)` (org-level admin holding no commission membership); the combined predicate was programmatically swapped into **~145 objects** (56 procs + 87 policies) off the live catalog — **zero residual, guarded permanently by pgTAP 187**; org-level-only `is_org_admin_of(org)` sites untouched. **4-tier audit:** chain key `(org, hospital, commission)`; derived `hospital_id` spliced into the hashed tuple in lockstep across `audit_canonical`/`audit_write`/`verify_audit_chain` (now `verify_audit_chain(p_commission, p_organization, p_hospital)`); 4 partial-unique seq indexes + 4-tier read policy + hospital emitters (`trg_audit_hospital_updated`, `trg_audit_hospital_admin_grant`); no PHI/payloads in rows (Rule 11 preserved). **Committee titles (5th per-commission vocab):** new `commission_member_titles` + `commission_members.title_id` FK (ON DELETE SET NULL, display-only, zero RLS semantics, staff_admin-managed, auto-seed 3 defaults via trigger); title CRUD RPCs; `assign_member_title(p_member, p_title_id nullable)`. **Appointment RPCs** (DEFINER, `is_org_admin_of`-gated, no self-delegation): `assign_hospital_admin`/revoke + nsp_org_admin analogs. **4 new RLS shapes** (all QA-verified minimum-necessary + isolation-preserving): `organization_members` self-read (`…000500`); `profiles` hospital_admin READ arm (`…000600`, **WRITE not widened**); `hospitals_select` += `is_hospital_admin_of(id)` and `organizations_select` += `is_org_level_admin_within(id)` (`…000800`, the BUG-HAT-003 root-cause fix — lets `getSessionContext` build `hospitalAdminOf`). **Hospital-scoped user management (service-role):** `getSessionContext` resolves `hospitalAdminOf`/`nspOrgAdminOf`; `registerUser` + per-user actions admit a hospital_admin scoped to its hospital (home hospital **HARD-SET server-side**, amendment 11; committees limited to own-hospital commissions; `removeCommittee` gates on `authorizeForCommission` — QA MAJOR-2); `updateUserProfile` home-hospital hard-set (QA MINOR-1); new reads `listHospitalUsers`/`listHospitalAdmins`/`listNspOrgAdmins`. Migrations `20260709000000`–`…000800` (on top of baseline `20260620000000`). pgTAP **1454/1454** (fresh reset); feature E2E `hospital-admin-tier` **38/38**; full regr 497p/26f (0 Phase-A reg). **NOT in Phase A → Phase B:** NSP-per-hospital, `nsp_org_admin` behavior, dual-hospital referrals, `dispose_referral_phi`. Earlier 2026-07-01 (`answer-model-v2` — branch `feat/answer-model-v2`; ADRs 0045/0046; QA APPROVED; re-squashed into the baseline, remote **re-baselined 2026-07-01**). Pre-launch schema-shape hardening; **evaluator byte-for-byte UNCHANGED (Rule 3)**. **Uniform answer row:** every answered input — including choice items — now gets a parent `answers` row, and `answer_selected_options` is **re-keyed `response_id`+`item_id` → `answer_id`** (PK `(answer_id, option_id)`; RLS + submitted-guard resolve the response via `answer_id → answers`). **Typed shadow columns** `answers.value_number/value_date/value_time` derived by `app.sync_answer_typed_values` (BEFORE INS/UPD, **exception-guarded per cast — a bad cast leaves the col NULL and NEVER fails a save**); `answers.value` jsonb stays the SOLE canonical evaluator input. **Answered-at + reserved** `answers.answered_at` + `answers.confidentiality_level` (RESERVED, unenforced — ADR 0045). **Instance-ready key (inert scaffolding, NO repeating-group UX):** `answers.group_instance_id` + new `response_group_instances` table (RLS mirrors the inline `answers` predicate verbatim; submitted-freeze) + `form_items.parent_item_id` (self-FK cascade, always NULL). **Question default values:** `form_items.default_value jsonb` (wizard prefill of visible unanswered items) + client `default_value` validation at **publish time → HC080** (`o valor padrão da pergunta "%" é inválido`). Two partial-unique answer indexes (top-level `(response_id,item_id) where group_instance_id is null` / per-instance where not null). **Evaluator/rehydration:** `app.answer_map`/`answer_map_by_item`/`case_phase_answer_map` only change how they SOURCE selections (via `answer_id`), output shapes frozen — guarded byte-for-byte by `supabase/tests/60_answer_map_golden.sql`. RPCs: `save_section_answers` upserts a parent answer per answered item then replaces selections by `answer_id`; `submit_response`/`response_required_complete` re-keyed; hidden-cleanup deletes answers (selections cascade) + `response_group_instances`; `clone_form_version` copies `default_value` + remaps `parent_item_id`; dashboards/export join via `answer_id` (aggregates identical); `app.guard_submitted_selections` twin + `reject_invalid_selection` re-keyed. **TS:** new client-safe `src/lib/forms/option-code.ts` is the **single** option-code generator shared by the server action + the builder — the builder now mints the option `code` client-side so choice `default_value` carries a real code, not `""` (fixes BUG-AMV2-002); `publishVersion` surfaces the pt-BR message for `HC080` as well as `23514` (BUG-AMV2-001). **Migration history re-SQUASHED 2→1** back into the single baseline `20260620000000_baseline.sql` (empty sorted pre/post pg_dump diff proves equivalence). pgTAP **1205/1205**, Vitest **176/176**. Earlier 2026-07-01 (`form-model-normalization` — branch `feat/form-model-normalization`; QA APPROVED, remote re-baselined). Normalizes the Form option/answer model: **new `form_item_options`** (version-scoped option rows — hidden immutable `code` [the analytics/condition identity], `label`, `color_token`, nullable `score`, free-text `analytics_code`, `position`; parent-must-be-choice + published-frozen triggers; RLS member-read/staff_admin-write via `commission_of_version`) + **new `answer_selected_options`** (one row per selected option, hard FK to the option row; submitted-frozen; RLS mirrors `answers`). **`form_items.options` jsonb DROPPED** (+ `is_valid_options` + the shape CHECK); "choice needs ≥1 option" moved to **publish time**. **`answers.value` = scalars only**; choice answers live in `answer_selected_options`. **Evaluator UNCHANGED (Rule 3):** `app.answer_map` rewritten to rebuild the same `question_key→code(s)` shapes (single→scalar code, checkbox→ordered code array, scalars→raw) from the two tables; conditions/`recommend_when`/`result_ruleset` now store the option **code** — publish-time + template validators (`validate_visible_when`/`validate_template_recommend_when`/`validate_template_result_ruleset`) gained option-**code**-existence checks via `app.version_has_option_code`. New/changed: `app.answer_map_by_item` (by-item_id twin, for `get_response_for_signoff`); `reconcile_item_options(item, jsonb)` (atomic upsert/delete/**reorder** in one txn — fixes the DEFERRABLE-unique cross-transaction reorder bug); `save_section_answers` (+`p_selections` code-arrays, replace-semantics); `submit_response` (answered = value OR ≥1 selection; hidden-cleanup deletes both tables); `clone_form_version` (copies option rows, **codes verbatim**); `case_phase_answer_map` (now reads normalized selections — a real bug fix, choice-based cross-phase recommendations/result rulesets were silently blank); dashboards/export **GROUP BY `option.code`** + current-label resolution. **Migration history SQUASHED 53→1** single baseline `20260620000000_baseline.sql` (schema dump + carried storage/config-vocab/auth-triggers/grant-posture; empty sorted pre/post diff proves equivalence; PHI-table + anon lockdown verified). TS: `ItemOption`={id,code,label,color,score,analyticsCode,position}; `VERSION_TREE_SELECT` embeds `form_item_options!form_item_options_item_id_fkey(...)` (FK-hinted to avoid `PGRST201`); `buildAnswerMaps` (TS twin of `answer_map`) feeds `getResponseForFill`/`getSubmissionDetail`. pgTAP **1180/1180**, Vitest **170/170**. Earlier 2026-06-30 (`cases-meetings-minor` — routine batch; migration `20260630000007`; **additive, forward-only, NO flag, NO new RLS shape**). **A1** new DEFINER `list_case_access(p_case)` mirroring `grant_case_access` authz (coordinator/admin + `case_access` flag) → `listCaseAccessGrants`. **A2** `case_events.occurred_time time` (nullable) threaded through the direct-table case-event actions + `CaseEvent.occurredTime` (`HH:mm`). **B2** query-only — `MeetingListItem` += `pendingActionItems`/`pendingSignatures` (batched RLS-scoped child reads merged in `listMeetings`; `pendingSignatures` null unless `em_assinatura`; `mapMeetingListItem` defaults 0/null so the Case-Timeline reuse stays valid). **C2** `conclude_meeting` HC034 false-negative is NOT a SQL bug — the guard (present AND `user_id not null`; guests excluded, ADR 0025) is correct; root cause is **upstream/frontend** (a committee MEMBER reaching the DB as a guest row, `user_id` null). Backend cleanup only: `src/lib/meetings/messages.ts` HC034 now returns the friendly pt-BR `cannotConclude` (was leaking the raw SQL string; CLAUDE.md §8). pgTAP `120`+1 / `144`+5 → full **1160/1160**; lint+typecheck green. Earlier 2026-06-26 (`result-rec` — ADR 0043; migrations `20260630000004` (+ unrelated anon-leak fix `…005`); **additive, forward-only, both `recommend_when` CHECKs widened to a superset** ⇒ legacy single rows + existing snapshots stay valid, no data migration). `recommend_when` becomes a **combinable group** of answer- AND/OR result-conditions; a phase can be auto-recommended from an EARLIER phase's RESULT (specific `phase_results` id via `equals/not_equals/in`, or its `adverse` flag), mixed freely under TODAS/QUALQUER. New `app` helpers `is_valid_recommend_cond`/`is_valid_recommend_when`/`recommend_when_conditions`; group-aware `validate_template_recommend_when` (**HC063** non-emitting source · **HC064** id ∉ allowed-set); group-walk `recompute_recommendations` reusing the UNCHANGED `app.eval_condition` over a synthetic map (zero evaluator drift, Rule 3); `set_case_phase_result_override` += recompute on a concluded-phase result change; group-aware `create_case_from_template`. Suggestion-only (only the `recommended` flag). pgTAP `161` (20) → full **1122/1122**; Vitest `recommendation.test.ts` (32) → **164/164**; E2E `recommend-result.spec.ts` (9) → full **431/0**; QA APPROVED. **✅ remote re-baselined 2026-07-01 (subsumed by the single-baseline reset).** Earlier 2026-06-23 (`form-builder-enhancements` — ADR 0040; **additive, NO feature flag → already live on remote**; backward-compat proven, every relaxed CHECK a strict superset). FOUR new `form_items.item_type`s `short_text`/`number`/`date`/`time` (input-arm + options-IS-NULL arm of the shape CHECK); `form_items` += `config jsonb` (number/date min/max) + `visible_when jsonb` (per-question conditional appearance) + CHECK `conditional_not_required`; per-option **colors** live INSIDE `options` (`{label,color}` OR bare string, normalized at read by `toOptions`); `answers` += `observation text`. Helpers `app.is_valid_visibility`/`is_valid_options`/`eval_visibility` (group ALL/ANY wrapper over `eval_condition`) IMMUTABLE+search_path-pinned; `eval_condition` += ordered ops `gt/gte/lt/lte` (both-JSON-number⇒numeric else text — mirrored SQL↔TS via shared `condition-vectors.json` + new `visibility-vectors.json`). `validate_visible_when` walks BOTH group-shaped **section** (earlier-section) AND **item** (earlier doc-order tuple) conditions: forward/self-ref reject + `app.assert_condition_op_target` (op↔target-type **and** number-target⇒JSON-number value, `check_violation`). `submit_response` per-item **forward pass** (`v_eff`: hidden section/item keys dropped, strays cleared, present-only number/date min/max → **HC061**) — mirrored by the wizard's pure `effective-visibility.ts`. `clone_form_version` copies `visible_when`+`config`. `save_section_answers` (DROP+CREATE 5-arg `+p_observations`) + `get_response_for_signoff` (additive `observations_by_item`, gating UNCHANGED) carry observations; observations render on ALL read views (wizard/submission-detail/sign-off), NEVER in the audit log (Rule 11). Migrations `…120000`/`130000`/`140000`; pgTAP **870/870**, E2E `form-builder-enhancements` 15/15 + phase4 8/8, QA APPROVED. **⚠ A tester `db reset --linked` during the fix loop reset+reseeded REMOTE and reverted the out-of-band `patient_index` flag → OFF (was manually ON; needs separate re-enable).** Earlier 2026-06-22 (`case_patient` — THIRD PHI module (ships **OFF**; ADR 0038): isolated `case_patient` (PK=case_id, all DML REVOKEd, audited `get_case_patient` door → `case_patient.read`) modeled field-for-field on `event_patient`/`referral_patient`; the **deliberate divergence** — read predicate `can_read_case_patient` = the BROAD `can_read_case` (any case-worker; assignees need the MRN) vs **coordinator-only writes** — unlike the staff_admin+PQS event/referral predicates; per-template `collects_patient` toggle snapshotted to `cases.patient_enabled`; `set`/`get`/`dispose_case_phi`/`set_template_collects_patient` + additive `create_case_from_template`/`get_case_detail` re-emit; `log_audit_access` + `case_patient.read`; `cases` += `has_patient`/`patient_enabled`/`phi_disposed_*`; migration `…017000`; pgTAP `151_case_patient.sql` 35/35; gate APPROVED, flag OFF). Earlier 2026-06-21 (Phase 22 — Inter-Committee Case Referrals (`case_referrals`, ships **OFF**; ADR 0037): 7 tables incl. isolated PHI `referral_patient` (REVOKEd, audited `get_referral_patient` door) — the SECOND PHI module under the NSP's isolated-table + single-door safeguards (amends Rule 12); broad `can_read_referral` vs tight `can_read_referral_phi` (+`referral_target_analyst`); PHI free-text lockdown — `frozen_body_md`/`result_md` policy-gated + `description_md`/`decline_note` column-REVOKEd, all served only by the audited `get_referral_detail` door to PHI readers; frozen-snapshot channel (narrative text + Rule-6 doc ref); RLS-consistent snapshot-doc download (no service-role); flag-gated `can_read_case` QPS macro-term (no B→A leak) + `close_case` HC076 gate; 21 RPCs; `referral-attachments` bucket; migrations `…013000–016000`; **HC070–HC07A**; pgTAP `150_referrals.sql` 40 assertions, full suite 705/705). Earlier 2026-06-19 (Case Access Control — per-case read/write ACL (`case_access`) + attribution-driven full-case read + restrictive `can_read_case` boundary + narrative attribution/`aberta→concluida` lifecycle + "Meus Casos"; 3 DEFINER predicates + `get_case_detail` VOLATILE re-gate (submitted-only preserved) + `case.opened` audit; migrations `…110000–110004`; flag ON; **HC055**; ADR 0033; gate APPROVED). Earlier 2026-06-18 (Phase 14b–d — NSP Triage→RCA→CAPA: `event_triage`(1:1) + sentinel-flags + configurable sentinel-criteria/event-types + triage RPCs (`save`/`confirm`[freezes event, mints RCA shell]/`reopen_triage`, `triage_disposition` [45-day RCA due], due-window setter); `rca`(1:1) + 6 children + `can_write_rca` DEFINER (PQS/admin OR assigned non-observer) + completed-freeze child-lock + **immutable `nsp-evidence` bucket**; source-polymorphic `capa_plan` + `capa_action`(JC strength) + tasks/evidence/measures/results/effectiveness + conclude-gate (HC051/HC052) + assignee-or-PQS action-advance + close→event auto-close; HC045–HC053; reuses `patient_safety` flag; migrations `…121100–121302`). Earlier same day: Phase 14a — Patient-Safety/NSP: **first PHI** on the platform (Architecture Rule 12; ADR 0030/0031) — isolated `event_patient` + append-only `event_custody` + access-follows-custody `app.can_read_event` + 8 DEFINER RPCs (incl. PHI-free `pqs_inbox`) + `event_patient.read` audited (empty metadata) + `patient_safety` flag ON; migrations `…121000–121005`). Earlier 2026-06-18: Phase 13 — Audit Trail: append-only hash-chained `audit_log` + DEFINER `audit_write` + curated PHI-free AFTER-triggers + SELECT-only RLS + `verify_audit_chain` + `log_audit_access`; `audit_trail` flag ON; ADR 0029; Architecture Rule 11). Earlier 2026-06-15: Phase 11 — Interviews: case-scoped sibling of Meetings; 4 tables + per-commission `interview_number` minting + lifecycle/content-freeze/child-lock guards + NEW row-level participant-write RLS (`can_write_interview`) + `interview-attachments` bucket (INSERT keyed on path seg [2]) + `case_events` kind `'interview'`; ADR 0026). Earlier same day: Phase 10 — Meetings; ADR 0025. Earlier: Case data-model adjustments batch — phase blocking + fixed auto-computed statuses + per-commission outcomes; ADR 0024, supersedes 0023. Earlier: post-Phase-8 Cases-Extras batch; ADR 0022.**

## ETH·E4 — Ethics participant seating & professional identity (2026-08-11; ADR 0108 D1–D8 + the D5 amendment; migrations `20260919000100`–`…000600`; **NO flag — the seating panel was already mounted and unfillable**)

Closes **FUP-ETH-1** (nothing could seat a professional — "Médico denunciado" was an unfillable
panel) and **FUP-FF5-2**. Everything below is **catalog-derived, 2026-08-11** — re-derive before
trusting it.

### New / changed doors (from `pg_proc`, not the migrations)

| Door | secdef · returns | Notes |
| --- | --- | --- |
| `public.ensure_professional_participant(p_profile_id uuid)` | **DEFINER** · `uuid` | **NEW.** Get-or-create of the `participants` registry row for an existing `professional_profiles` row — a profile has **no registry identity until first seated**. Gated `HC0E4` (coordinator / org admin). Targeted `on conflict` against `professional_participants_profile_uniq` + an orphan-deleting race arm. ⚠ **Not** the same door as `create_professional_profile`, which is a **bare INSERT** with no lookup — the get-or-create one is this. |
| `public.create_external_participant(p_org uuid, p_type text, p_display_name text)` | **DEFINER** · `uuid` | **NEW.** Create-**always** (no get-or-create) for the five non-sensitive external types. Gated `HC0E4`; `check_violation` on a bad type / blank name — both pre-empted server-side before the RPC. |
| `public.set_primary_subject(p_case_participant_id uuid)` | **DEFINER** · `void` | **`create or replace`d.** Was **set-only** (a 2nd set raised `HC0E7`); now **MOVE** semantics + it re-runs the linkage assert. Property-diffed from the catalog before vs after — `prosecdef`, `proconfig`, `proacl` (incl. entry order), `provolatile`, `proleakproof`, language, result type, args, owner all **IDENTICAL**. Removed from the never-called allowlist (it now has callers). |
| `app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)` | **DEFINER** · `boolean` | **`create or replace`d** — gains the **D5 org-manager disjunct**. Without it the picker is unusable: the predicate previously resolved true only for a platform admin or for a professional **already seated** on a readable case. Property-diffed identically. Keystone K3a reds if the arm is reverted (QA proved it). |
| `public.get_case_professional(p_participant_id uuid)` | **DEFINER** · `jsonb` | **The P0 fix lives here.** Returns an explicit `jsonb_build_object` of **exactly the 12 granted columns** — *not* `to_jsonb(v_profile)`. ⚠ A DEFINER **bypasses the column grant**, so the grant alone leaks; both halves are load-bearing and that was **measured**, not argued. Calls `log_audit_access('professional_profile.read', …)`. |
| `app.audit_case_type_terminology()` | **DEFINER** · `trigger` | **NEW.** `trg_audit_case_type_terminology` — `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` on `case_type_terminology`. The table had **no trigger and no writer** before T5; the plan's "frontend-only, no substrate work" was true for authorization and **false for auditability** (Rule 11). |

All four `authenticated`-callable doors carry `authenticated=X/postgres`. ⛔ **Never cite
`ARM=census` as coverage for the three write doors** — its live domain is `bool`/set-returning, and
these return `uuid`/`void`, so it HOLDS *because they are invisible to it* (ADR 0079 Amendment 5,
FUP-AFF-1). Their coverage is the neutralization oracle, now standing in
`p0-authz-writepath-audit.sh` ARM 1 (**COVERED**, keystones named).

### ⚠ `professional_profiles` is on a COLUMN-LIST grant — 12 of 17

There is **no table-level SELECT for `authenticated`**. Revoked: **`cpf`, `redacted_by`,
`retention_pin_reason`, `retention_pinned_at`, `user_id`**.

This closed a **P0 disclosure**: `app.trg_pin_respondent_retention` is the sole writer of
`retention_pinned_at`/`retention_pin_reason`, fires on `case_decisions → 'issued'` for a seated
`respondent_doctor`, and those columns sat in a table-wide grant — so a sibling-commission
`staff_admin` with **no case access** could read a named doctor's `full_name` + `cpf` +
`retention_pin_reason` and learn of **a disclosed ethics proceeding**. ETH·E4 opened the write and
widened the read together.

- **`redacted_at` is deliberately KEPT** in the grant — `searchParticipants` filters on it and
  PostgREST requires SELECT on a filtered column.
- **Suite 321 pins projection ≡ grant with `set_eq`**, so a column added to one reds until added to
  the other. Verified in **both** directions (grant a revoked column back → RED; revoke a projected
  one → RED).
- ⚠ **Residual, by design:** the retention *fact* is still reachable through `audit_log` for an
  **`org_admin`** (`audit_log_select`'s org arm) — a sibling `staff_admin` sees 0 rows. That is the
  designed oversight posture, not a gap.

### App layer

- `src/lib/queries/participants.ts` — invoker-rights, RLS-scoped search for **both** lanes; never a
  DEFINER search door (ADR 0091 D3). Also holds `listCaseParticipantRolesForAdmin` +
  `CaseParticipantRoleAdminRow` (moved here from `lib/vocabulary/actions.ts` at r3 — a pure read
  does not belong in a `'use server'` module, where **every export is a callable Server-Action
  endpoint**; that one alone never called `authorizeOrg`).
- `src/lib/participants/actions.ts` — all 7 previously-stubbed actions + `createExternalParticipant`.
  ⚠ **Its error mapper encodes a measured rule, do not "simplify" it:** pass `error.message` through
  **only** where the SQLSTATE cannot also originate in the engine — the custom `HC*` codes, and
  `P0002` (six doors raise it in pt-BR; `public`/`app` contain zero `SELECT … INTO STRICT`).
  **`42501` and `23514` are MIXED** — ours raise them in pt-BR *and* the engine raises them in
  English on the same code — so both return the constant. A QA round filed the opposite and its
  remedy would have been a regression.
- `src/lib/vocabulary/actions.ts` — T5 org vocabulary admin (`case_participant_roles`,
  `case_type_terminology`). Already followed the same error rule.
- `src/lib/queries/members.ts` `listLinkableOrgUsers` — anchors on `profiles.home_organization_id`,
  which **ADR 0097 (AFF) made insufficient**; hospital affiliation is a visibility input and this
  query does not consult it. Tracked, not fixed.

### Known-open at hand-off

- **FUP-ETH-A11Y-1** — `aria-describedby` never wired to error ids; the typeahead popup has no live
  region. Needs a coordinated tester-owned spec change (both routes collide with `pickFromTypeahead`).
- **PO decisions, unratified:** the Class-2 audit posture after D5 (`searchParticipants`'s
  invoker-rights read cannot be audited through RLS, and D5 widened its population to every org
  manager — ADR 0064/0065's "case-scoped RLS + audited reads" no longer fully holds); and
  `department` / `institution` / `other`, which are **mintable but have no seeded role**
  (catalog-confirmed) — the UI names the state ("Nenhum papel cadastrado aceita este tipo de
  participante") rather than dead-ending silently, so this is a seeding choice, not a defect.
- **Remote push drift — MEASURED 2026-08-12 against `azkbbhskturikxpgmafq`: exactly 2.** 356 local
  migration files vs **354** registered in `supabase_migrations.schema_migrations`; remote max is
  `20260919010000`, and the only local files above it are the REG·KIND pair
  `20260920000100_case_events_update_follow_up_kinds` + `20260920000200_referral_registros_shared_kind_vocabulary`.
  ACT (`…003000`/`…003100`), ETH·E4 (6) and RDR (`20260919010000`) **are all on the remote**.
  ⚠ **This corrects a ledger that claimed 11.** The removed *Remaining pre-pilot work* deploy row
  derived its drift by subtracting a **2026-08-10 baseline of 345** from the local file count,
  assuming nothing had been pushed since. Nine had been. A drift number computed from a remembered
  baseline is a guess; count `schema_migrations` instead. ⚠ REG·KIND is also **ungated** (Phase Gate
  step 1 only) and re-keys live `case_events` rows — it needs its own pre-push read, which the
  closed check below does not provide.
- ~~**Before any remote `db push`:** the duplicate check on
  `professional_participants.professional_profile_id` (plan §6 step 3).~~ **CLOSED 2026-08-12** —
  the ETH·E4 batch `20260919000100`–`…000600` is already registered on the remote and
  `professional_participants_profile_uniq` exists in `pg_indexes`. The index **built against live
  data**, which proves absence of duplicates more strongly than the pre-check ever could; a
  confirming read returned 0 duplicate groups (non-vacuous — 1 row, 1 non-null id, 0 nulls).
  ⚠ The general lesson still stands for the **next** push: a local `count=1` on a fresh reset is
  true by construction of the fixture and proves nothing about a data-bearing remote. The two
  unpushed REG·KIND migrations (`20260920000100`, `…000200`) re-key live `case_events` rows and
  need their own pre-push read — this closure says nothing about them.


## ACT — "act as" STRICT ROLE ASSUMPTION (2026-08-10; ADR 0106 D1–D14; migrations `20260918000000`–`…002800`; **NO flag — the migration IS the cutover**, PO-locked P4)

**The model in one line:** a principal holding **more than one role TYPE** is a *stranger*
until it picks a hat; the hat is bound to the auth session, carried as an `active_role` JWT
claim, and **every** authorization gate respects it. A single-role principal never sees the
picker — the token hook derives its lone hat implicitly.

⚠ **REMOTE CUTOVER NEEDS A STEP `db push` DOES NOT COVER:** `custom_access_token_hook` must be
**ENABLED on Supabase Cloud** (locally it is `config.toml` `[auth.hook.custom_access_token]`).
Without it the remote mints **no `active_role` claim** — and the blast radius is **EVERY user,
not just multi-role ones**, because the implicit single-role derive lives INSIDE the hook. Probed
live on a single-role persona (`chefe.ccih`, staff_admin only) with the claim absent:
`active_role()` = NULL → `has_role(staff_admin, self)` = **false** → `commissions` visible = **0**.
Total lockout, not a degradation. *(This paragraph said "every multi-role principal" until
2026-08-10; that understated it — corrected after measuring rather than reasoning.)*

### New surface

| | |
|---|---|
| `public.platform_role` | enum, **11 labels** = the 10 `memberships_role_check` values **+ `platform_admin`**. In `public` **on purpose**: `config.toml` exposes only `public`/`graphql_public`, so an `app` enum never reaches `gen:types`. A bare enum TYPE is not a relation — no endpoint, no RLS surface. |
| **`app.active_role_selections`** | the session↔hat binding — columns `(session_id, user_id, role, chosen_at)`, PK on `session_id`. ⚠ **`app`, NOT `public`** (this row said `public` until 2026-08-10): `app` is not in `config.toml`’s exposed schemas, so **PostgREST offers no route to it at all** — a client cannot read or write its own hat row directly. RLS carries a **SELECT-only** self policy (`user_id = auth.uid()`) and the table ACL is **owner-only** (`relacl` NULL), so there is no INSERT/UPDATE policy for anyone: the ONLY writer is `public.assume_role` (SECURITY DEFINER), which upserts `on conflict (session_id)`. Read at token-mint time by the hook — never consulted by a gate at query time. |
| `public.assume_role(p_role)` | **the only way to acquire a hat.** Validates the caller genuinely holds the role, writes the selection, stamps `active_role.assumed` into `audit_log` **with the assumed role's own tenancy** (`20260918002600`; only `platform_admin` stamps all-NULL — it has no tenant). ⚠ Its `platform_admin` branch reads **raw `profiles.is_admin`**, NOT `is_admin()` — deliberately: `is_admin()` now requires the hat, so calling it here would be circular and would break the break-glass path the ADR protects. |
| `app.active_role()` | reads the claim. Returns **`text`**, so it is **structurally invisible to `ARM=census`** (which counts BOOLEAN gates) — do not cite census as coverage for the hat; the revert-twin keystone is the real coverage. |

### Gates that changed (verify against `pg_proc`, never this table)

- **`app.has_role`(4-arg) + `app.has_role_any`** — gained the **caller-only** condition, the
  house pattern everything else now mirrors:
  `and (<target> is distinct from auth.uid() or <role> is not distinct from app.active_role())`.
  ⚠ **`IS NOT DISTINCT FROM`, never `=`** — `active_role()` is NULL for a hatless caller and
  `x = NULL` is NULL, which a PL/pgSQL `if not` treats as false-ish: the plan's own literal text
  was a **fail-OPEN** (BUG-ACT-NULLHAT-1).
- **`app.is_admin()`** (D11) — also requires the `platform_admin` hat. Provably a no-op while
  **0 platform_admins hold a membership**; a pgTAP **tripwire** reds if one ever does.
- **`app.is_admin_for(uuid)`** + **`app.can_manage_professional`** (`20260918002800`, from the
  Stage-3 QA BLOCKER) — same caller-only condition. ⚠ **`can_manage_professional` no longer
  carries that condition inline**: `20260918003000` (BUG-ACT-EXPIRY-1) removed the raw
  `memberships` arm the condition was attached to, so the gate now inherits BOTH expiry and
  the hat from `app.has_role`. Keystone `320` reds if a raw `memberships` read is
  reintroduced. ⛔ **`is_admin_for` is NOT a third-party
  helper**, whatever its signature suggests: both callers (`grant_role_impl`/`revoke_role_impl`)
  receive `p_actor` from `public.grant_role`/`revoke_role`, which bind it to
  `(select auth.uid())` — it is **the caller gate on the membership-grant door**.
- **`app.member_can`** (D13) · **`app.audit_write`** (D8 — stamps `metadata.acting_as`, a role
  LABEL, into every row when a hat is active; inside the hash chain).
- **Five caller-gating DEFINER doors** de-blinded (`20260918002500`): `commission_overview` ·
  `list_org_people` (hospital_admin arm) · `quality_board_summary` (42501 entry gate) ·
  `capa_kpis` (nsp_coordinator arm) · `pqs_inbox`; plus `list_my_nsp_hospitals`
  (`20260918002400`). **24 sibling doors were LEFT hat-blind on purpose** — they enumerate
  *third parties* (rosters, candidate lists, recipients), and one user's hat must never change
  what the system concludes about **another**.
- **DROPPED:** the 3-arg `has_role` — a pure delegation with **zero** callers across four
  surfaces, so S3 would have changed what it *meant* without changing its text.

### Two doors that are hat-blind BY DESIGN — never "fix" them

`public.session_context()` (the picker and the D9 hint need the caller's FULL grant list) and
its app-layer twin `getRawGrants()`. **Fix their CONSUMERS, not them.** Ruling `session_context`
exempt without auditing its consumers is exactly what produced the P0 below.

### App layer

`getSessionContext()` (`src/lib/queries/session.ts`) filters every derived grant list by
`activeRole` — fixed **centrally**, because `partitionGrants()` fed **88 call sites across 29
files** that read those fields as access decisions (a 29-file patch sweep would have missed
one). `context.isAdmin` now mirrors `is_admin()`'s own condition. **`resolveLanding` was
DELETED**, not patched — a second hand-rolled precedence chain covering only 4 of 11 roles.
Picker route: **`/selecionar-perfil`**. ⚠ A guard's `notFound()` thrown in a `layout.tsx` is
caught by the **GLOBAL** `src/app/not-found.tsx`, never a same-segment sibling. ⚠ `RoleSwitchHint`
is a **client** component: it receives only `{role, count, landing}` strings — passing grant
objects serialized commission ids/names/slugs into the RSC payload of every signed-in 404.

### ⛔ FOUR classes of hat-blindness — the checklist for any new gate

1. App guards deriving from a hat-blind session context. 2. A raw JWT-claim read. 3. A DEFINER
door reading `memberships` raw. 4. **A boolean gate that RECEIVES the caller's uid as a
parameter instead of reading `auth.uid()` itself** — found by the QA review *after* three
green authz arms passed. Class 4's rule, now binding on the standing door audit (**ADR 0079
Amendment 6** + `docs/progress/authz-handoff.md` **§7.17**): **classify by CALL-SITE BINDING,
never by signature shape**, extract call arguments with a **balanced-paren** parser (a regex
cannot see `f((select auth.uid()))`, this repo's house style), and build call-graph edges on
`name[[:space:]]*\(` — a bare substring lets the *column* `is_admin` match the *function*
`app.is_admin` and manufacture a false "already covered" edge.

### D14 arm classification (S4, 2026-08-10 — re-derive from `pg_proc`, never this table)

`app._case_caps` audited arm-by-arm from the live catalog. Every bit-contributing arm
classified; STEP 1–3 (null-uid / `is_active` / unknown-case) are **preconditions**, not
arms — they contribute no bits and are deliberately hat-independent (`is_active` is D3's
outer status gate).

| Arm | Bits | Class | Enforcement point |
|---|---|---|---|
| S1 coordinator | 1\|2\|4\|8\|32\|64 | **role** | `is_staff_admin_of_for` → `has_role('commission','staff_admin')` |
| S2 tenancy admin | 64 | **role** | `is_tenancy_admin_of_for` → `has_role('organization','org_admin')` OR `has_role('hospital','hospital_admin')` |
| S5 member default | 2 (¬`explicit_grants_only`) | **role** | `is_member_of_for` → `has_role_any('commission')` |
| S6 NSP referral | 4\|2 (flag + referral exists) | **role** | `is_pqs_operator_of_for` → `has_role('hospital','nsp_coordinator'\|'pqs_member')` |
| S7 quality reviewer | 4\|1 (oversight-visible, ¬eg) | **role** | `is_quality_reviewer_of_for` → `has_role('hospital','quality_reviewer')` |
| S3 manual grant | per-column (lattice on read) | **relationship** (D6) | `case_access_grants` row, `principal_id = p_uid`, active + unexpired |
| S4 assignment | 4\|2 | **relationship** (D6) | `case_phases`/`case_narratives.assigned_to = p_uid` |
| STEP-4 denies | ⇒ 0 | **relationship** (D6) | `is_case_respondent` / `is_recused_from_case` |

No hybrid and no unclassified arm. The role arms obey the hat only because `has_role`/
`has_role_any` carry the caller-only condition **and** the evaluated principal is the
caller: a third-party evaluation (`p_uid <> auth.uid()`) consults full grants **by
design** (the one third-party binding into this graph is `file_correction_request`'s
corrector check). Keystone: **`319`** (divergence proof + in-file mutation twins on both
enforcement bodies + hatless D5×D6 pin + third-party disarm + recusal zeros).
⚠ Noted for the record: the plan/task ruling classes per-case **ACL rows** as
relationship-derived (D6-immune, hat-independent incl. hatless) although D13's
grant-vs-relationship language could read otherwise — 319's A13 pins the as-built
semantics so any re-ruling must consciously red it.

### Standing hat-blind sweep (S4) — `ARM=hat`

`supabase/tests/mutation/act-hat-blind-sweep.sh` (wired as **ARM=hat** of
`p0-authz-invariant.sh`, in `ARM=all`; ~10 s): flags **caller-bound raw `memberships`
reads with no adjacent active-role condition** — Amendment 6 method (balanced-paren arg
extraction, `name(` edges, transitive caller-boundness), chunk-level adjacency where
delegation into `has_role*` counts as evidence, anchored by an explicit check that both
delegates still carry the condition. **Self-tests its own detector every run** (planted
blind/covered/class-4 specimens + neutralized-anchor flip) and fails on ghosts as well
as new findings. Findings ≡ `act-hat-blind-allowlist.txt` — a **separate artifact** from
the 0079 BLIND allowlist (designed behaviour, not coverage debt): `session_context()`,
`assume_role`, and the `memberships_select` self arm (sweep-found, same D9 class);
`service_role`/`custom_access_token_hook` is a class exemption in the header, unkeyable
by construction. ADR 0107.

### Verification estate (re-derive; do not trust this text)

pgTAP keystones **`315`** (revert-twin, also closes `assume_role`'s ARM=floor gap) · **`316`**
(the 5 caller-gating doors, red-first) · **`317`** (CAPA audit scope) · **`318`** (the class-4
siblings; red-first on 5 ⭐ assertions incl. `grant_role` succeeding under the wrong hat) ·
**`319`** (S4 — D14 arm divergence, mutation twins in-file).
Suite at S3 close: **179 files / 5690 tests** (+`319`: 180 files / 5707). `ARM=census` 450
live gates / 461 verdicts · `ARM=floor` 80 never-called doors, all allowlisted · `ARM=hat`
3 findings, all reasoned-allowlisted.

### Known-open at hand-off

> ✅ **`BUG-ACT-EXPIRY-1` and `BUG-ACT-ACL-1` are CLOSED 2026-08-10** — migrations
> `20260918003000` + `20260918003100`, keystone **`320`** (10 assertions), suite now
> **181 files / 5718 tests**. Both were RED-first against the pre-fix catalog.
> - **EXPIRY**: `app.can_manage_professional` no longer reads `public.memberships`
>   directly at all — the Stage-2 compensating clause is gone and `app.has_role` is
>   the single membership path, so expiry AND the ACT caller-only hat condition are
>   inherited rather than re-implemented. ⚠ Keystone **`318` PART 2 changed with it**:
>   assertion 10 is INVERTED (an expired staff_admin is now REFUSED even when
>   correctly hatted), and the D5 hat twin was **re-anchored onto the LIVE arm** —
>   leaving it on the expired arm would have left a control anchored on a defect,
>   true by construction once the defect was fixed. `320` adds the behavioural half:
>   the refusal arriving at a real door (`create_case_assignment_role`), plus a
>   live-admitted CONTROL so a broken-closed gate cannot pass.
> - **ACL**: `app.is_entitled_document_approver` now carries
>   `postgres/authenticated/service_role`, matching all 7 Stage-2 siblings.
>   `320` asserts **uniformity across all 8**, so it also reds if any of them is ever
>   rebuilt with DROP+CREATE (which silently loses the ACL). This closes **one
>   instance**, NOT the standing **AUDIT-INVOKER-WRAPPER** population audit.

**`FUP-ACT-DISPOSE-UI` — a PILOT-GATE CHECK**: the LGPD
Art. 18 referral-erasure path has **no UI route**; every principal `dispose_referral_phi`
authorizes is 404'd by the page hosting the affordance, and everyone who reaches that page is
refused by the door — **the two sets are disjoint** · `FUP-ACT-CAPA-ASSIGN` (`profiles` RLS has
no PQS-operator arm, so operators see ~only themselves in the CAPA assignee picker).
**S4 backend items DONE 2026-08-10** (D14 table + `319` + `ARM=hat` sweep + reasoned
allowlist — see the S4 sections below); frontend's `navScope` branch and the lead/qa
record step remain S4-open.

## QO·B — org_admin / hospital_admin CONTENT WALL (2026-08-08; ADR 0100 **D12** + PO rulings **Q1–Q9**; migrations `20260915000000`–`…000500`; **NO flag — subtractive by design**)

> **M7 addendum (2026-08-09, `20260916000000` — QA r1 BLOCKER-1).** M4 had cut a PROXY population
> (the `assert_not_case_excluded` carriers), leaving ~16 ratified-§4.4 case doors armed. **M7
> derives the cut from the ratified §4.4 list itself**: 20 functions edited (armed doors incl.
> `remove_case_participant`/`record_recusal`/`case_viewer_capabilities`/`bulk_create_cases`/
> `lift_recusal`, + masked-token strips on `get_case_detail`/`list_my_cases`/`create_case`/
> `create_case_from_template`) + the 3 `case_events` policy arms. Its postcondition asserts
> **CORRESPONDENCE to enumerated names, never a count**. `cancel_case`/`close_case` additionally
> gained a zero-row not-found guard (they resolved the commission via the RLS-exempt
> `commission_of_case` and could report success while RLS swallowed the DML). The 5 ratified
> case-plane KEEPs (`grant/revoke/list_case_access`, `set_case_visibility`,
> `set_case_confidentiality`) remain armed and are pinned against over-cut (`314` 11.35).
> Keystones: `314` §9–§11 (all 29 cut doors behavioural + twinned); mutation audit `b1` 39/39.
>
> **TS session/action seam (BUG-QOB-003, commits `4dd5cfa`/`60719df`/`1dfc3fb`):**
> `CommissionAccess.role` = MEMBERSHIP role only (the tenancy-admin→`staff_admin` coercion is
> gone); tenancy standing = `CommissionAccess.isTenancyAdmin`; the Q1–Q9 KEEP surface gates
> through `canConfigureCommission(access)` / `canConfigureCommissionById(id)`
> (`src/lib/queries/session.ts`) — membership coordinator OR tenancy admin. Every KEEP action
> guard in `src/lib/*/actions.ts` + the audit CSV export route routes through that seam; CUT
> actions verified armless and annotated do-not-route. ⚠ `setTemplateCaseType` deliberately NOT
> routed (its DB door is staff_admin-only; ADR 0088) — FUP-QOB-2. Referral doors
> (`create_referral_draft`/`dispose_referral_phi`) still carry the tenancy arm at the DB while
> the UI 404s a bare tenancy admin — BUG-QOB-004, PO ruling pending; do not "fix" either side
> without that ruling.

**⚠ READ THIS FIRST — the predicate whose name has misled every reader of this repo.**
`app.is_tenancy_admin_of(_for)` is **NOT** the commission's own admin. Catalog body:

```sql
has_role('organization', c.organization_id, 'org_admin', u)
   or has_role('hospital', c.hospital_id, 'hospital_admin', u)
```

It is the **TENANCY admin**, and it is **FALSE for `staff_admin`** (measured). The
committee's own coordinator is admitted by the separate `app.is_staff_admin_of` disjunct
that sits beside it in essentially every policy — which is why removing the
`is_tenancy_admin_of` term subtracts *exactly* org_admin + hospital_admin. A rename to
`is_tenancy_admin_of` is **PO-approved as its own wave AFTER QO·B lands** (Q6) — deferred
so it cannot confound QO·B's equivalence matrix.

⛔ **`\yis_tenancy_admin_of\y` CANNOT MATCH `is_tenancy_admin_of_for`** — the word
boundary fails before `_`. Any sweep in this repo grepping the short name is silently
blind to every `_for` call site. This produced a 10-vs-12 undercount inside QO·B itself.
**Match `is_tenancy_admin_of` without a trailing `\y`, or enumerate both explicitly.**

### What the tenancy admin LOST (all of it row-level content)

| Plane | Policies | Doors |
|---|---|---|
| Responses | `responses_admin_all` **dropped outright** (bare `FOR ALL` tenancy grant) · arm off `responses_select`, `answers_select`, `answer_selected_options/references/matrix_cells/risk_matrix_select`, `response_group_instances_select` | `dashboard_free_text` · `dashboard_export_rows` · `dashboard_completion_by_member` · `get_response_for_signoff` · `supersede_response` · `target_case_response` |
| Documents | `controlled_documents_select` · `controlled_document_versions_select` · storage `controlled_documents_obj_insert_writable` · wrappers `can_read_document_of_version`, `can_read_document_object`, `can_view_printed_document` | `create_controlled_document` · `update_controlled_document` · `publish_document` · `mark_document_obsolete` · `supersede_document` · `submit_document_for_approval` · `set_document_version_file` · `list_commission_documents` · `documents_due_for_review` · `remind_document_approver` |
| Indicators | `indicator_measurements_select` | `record_indicator_measurement` · `compute_derived_measurement` |
| Case plane | — | **18 doors**, population DERIVED from A4-Unit-2's `assert_not_case_excluded` guard (31 carry it → 23 admitted the tenancy admin → 18 cut, 5 ratified KEEP) |
| Attachments | — | `app.can_write_attachment`'s **`case` arm only** (its `meeting` arm never had one — C7/A8) |

### What it KEEPS — each a ratified decision, each pinned so a sweep cannot reverse it

- **Configuration** (Q1/Q2/Q7): form definitions (`forms`, `form_versions`, `form_sections`,
  `form_items`, options/validations, block library), the 9-policy `process_template_*`
  family, committee taxonomy (`case_tags`, `case_outcomes`, `case_narrative_types`,
  `phase_results`, meeting types/settings, member titles). Rule: *the admin shapes the
  containers, never reads what goes in them.*
- **Indicator DEFINITIONS** (Q3 SPLIT): `indicators_select`, `create/update_indicator`,
  `set_indicator_target` — the measurement is cut, the definition is not.
- **The six PHI-free AGGREGATE dashboards** (D12 ⑥): `distributions`,
  `entity_references`, `form_totals`, `matrix_cells`, `risk_scores`,
  `submissions_over_time`. ⚠ The nine `dashboard_*` doors now split **six-to-three**;
  `270` asserts the two classes BY NAME, not only by count.
- **Case access + classification** (Q8/Q9): `grant_case_access`, `revoke_case_access`,
  `list_case_access`, `set_case_visibility`, `set_case_confidentiality`.
  `grant_case_access` is safe because **self-escalation is independently blocked** —
  MEASURED: an org_admin's self-grant raises *"o responsável deve ser membro da comissão"*
  since it holds no membership row, while granting a real member succeeds.
- **`revoke_printed_document`** — keeps its tenancy arm by the OLDER, more specific ruling
  **ADR 0104 D11**: revocation is a *governance* act that reveals no content (the admin
  chain may revoke an ata print it cannot download). QO·B's own §4.3 draft listed it as
  CUT; the draft is overruled.
- **`grant_role_impl` / `revoke_role_impl`**, `is_org_level_admin_within`, and the tenancy/
  identity/vocabulary nouns — administration was never in scope.
- **`_case_caps`** still routes `is_tenancy_admin_of_for`, and that is correct: A4 left
  it conferring `manage_case_access` only (`311` §6.5 pins it).

### ⛔ THE FAILURE MODE THIS PHASE EXISTS TO WARN ABOUT

**M1–M4 cut the TABLES and left SIXTEEN DEFINER DOORS OPEN**, and every gate went green.
A DEFINER door bypasses RLS entirely, so the tenancy admin still read through a door what
the table refused — measured post-M4 as `orgadmin.a`: `dashboard_free_text` **6 rows**
(free-text answers), `dashboard_export_rows` 6, `list_commission_documents` 2. Closed by
**M5 + M6**.

**Four green gates were each blind to it, in a different way:**

| Gate | Why it could not see it |
|---|---|
| A/B equivalence matrix | measures **table** row visibility under RLS — a DEFINER door is invisible *by construction* |
| ADR 0079 door sweep | neutralizes **boolean** gates; these return `SETOF` and were never in its population |
| `ARM=floor` | asks whether a door is **called**, not whether its gate is **right** |
| pgTAP `314` | asserted the tables, not the doors |

**What found it:** re-reading the ratified CUT list and asking the catalog, item by item,
*"did I actually cut this?"* — the plainest check available, and one **no harness
performs**. Run it at the end of any subtractive phase.

### Verification estate (re-derive; do not trust this text)

`supabase/tests/314_qob_org_admin_content_wall.sql` (**49 assertions**; every negative
twinned) · `supabase/tests/mutation/b1-org-admin-wall-mutation-audit.sh` (**17 cases,
17/17 RED-PROVEN — 12 under-cut + 5 OVER-CUT**, because a "did we remove enough?" audit
cannot see an over-cut) · `e2e/qob-org-admin-content-wall.spec.ts` (6/6) · relocated
siblings: `270` (two-class contract), `225` (a second `staff_admin`, not an org_admin),
`229` (×2 — twins labelled "coordinator" that passed `sa_y`, *an org_admin*), `151`, `171`,
`312`, `313`, `270_ff1`.

## QO·FUP — follow-up close-out (2026-08-07; ADRs 0101/0102; migrations `20260912000000`–`…000100`)

Beyond the expiry-seam change (recorded in the QO·A "Role doors" paragraph below, in place):

- **`list_my_nsp_hospitals()` tightened** (`20260912000100`): `app.is_active` via a `me` CTE
  (inactive caller → both union arms collapse → existing `coalesce(…,'[]')` safe default) +
  expiry + `hospital_id is not null` on BOTH arms — it was the one PQS door lacking the
  sibling filters, masked in the console path by `organizations_select` and exposed via the
  direct caller `capa-operator-gate.ts`. Pins: `145` §I (I1–I7, red-first observed); off the
  never-called allowlist (floor 83→82). FUP-QO-8 resolved.
- **`SessionContext.nspOperatorOf`** (`session.ts` / `partitionGrants`): `pqs_member` +
  `nsp_coordinator` hospital-scoped grants, routing-only (`role` field is display-only —
  gate nothing on it). `page.tsx` routes them to `/o/<org>/nsp` (first post-commission
  office branch). Instances 4+5 of the unrouted-role class.
- **The unrouted-role class guard** (ADR 0101, `session-grants.test.ts`): enumerates
  `memberships_role_check` from `pg_constraint` AT TEST TIME, drives the real `page.tsx`
  default export per role; `KNOWN_UNROUTED` ledger asserted both directions, currently
  **empty**. A new role with no landing route reds the suite.
- **`100_dashboard` t19** is now "no FIRST-PARTY public function is anon-executable"
  (excludes extension-owned via `pg_depend`→`pg_extension`; 19c plants a violation to prove
  the detector's eyes). No longer run-order-sensitive to pgtap-in-public. FUP-QO-5 resolved.
- **`a2-mutation-audit.sh`** back to an honest 12/12 (K8/Kv retargeted onto `241`'s
  deliberation-gated lane). FUP-QO-3 resolved.

## QO·A — Quality-office oversight (2026-08-06; ADR 0100 D1–D11; migrations `20260911000000`–`…000600`; **NO flag by design** — D8 default `'excluded'` + the role grant are the deny-by-default gates)

**Role.** `quality_reviewer` — tenth `memberships_role_check` member, hospital-scoped
(org+hosp NOT NULL, commission NULL; the `nsp_coordinator` shape). One row per reviewed
hospital (`memberships_grant_uq` NULLS NOT DISTINCT). Helpers
`app.is_quality_reviewer_of(uuid)` / `_of_for(uuid,uuid)` (is_active + `has_role`, which
filters expiry) and `app.is_quality_reviewer_in_org(uuid)` (direct `organization_id`
read; do **NOT** widen `is_org_level_admin_within` instead — its two-role list feeds
admin surfaces, pinned by the M6 postcondition).

**Classification.** `commissions.quality_oversight text NOT NULL DEFAULT 'excluded'
CHECK (visible|excluded)`. ONLY writer: `public.set_commission_oversight(uuid,text)`
(DEFINER; authority `is_hospital_admin_of OR is_org_admin_of` → 42501 — the committee
cannot opt itself out, platform_admin stays out (noun rule); validation `HC0L0`;
unknown `P0002`; audited `commission.oversight_changed` with previous value).
`app.guard_commission_oversight` (BEFORE **INSERT OR** UPDATE OF the column,
`IS DISTINCT FROM` on the update arm, GUC `app.in_commission_rpc` txn-local bracket)
traps raw writes for EVERYONE incl. superuser — the seed brackets its fixture.
**INSERT arm (lead ruling 2026-08-06, stricter than the `guard_case_visibility`
sibling):** outside the bracket a commission may only be BORN `'excluded'` (the
column default — creation flows untouched); zero SQL functions insert into
`commissions`, so raw PostgREST creation was a live D9 breach (initial `'visible'`
with no door/audit, `is_admin()` admitted via `commissions_admin_write`'s WITH
CHECK). Pinned both directions by `307` 1.3–1.5; RED-proven by q1 `insert_arm_noop`.

**Role doors.** `grant_role_impl`/`revoke_role_impl` gained the quality arm —
authority = the technical_director shape (`is_org_admin_of_for OR
is_hospital_admin_of_for`, **no `is_admin_for`**, and **no flag assert** — see the M3
header comment before "fixing" either). **`p_expires_at timestamptz DEFAULT NULL`**
now rides `grant_role` → `grant_role_for` → `grant_role_impl` (D9 setter; validated
`> now()`; INSERT-path only). ⚠ The re-signature was DROP+CREATE — ACLs re-established
byte-identical (`grant_role` authenticated+service_role · `grant_role_for`
service_role only · impl owner-only; pinned by `293` §1). `292` §2 now pins
`app.grant_role_impl` as the ONLY `expires_at` writer and `grant_role` as the only
expiry-taking door. ~~Two deferred seam limits~~ **REMOVED by QO·FUP F1 (2026-08-07,
migration `20260912000000`, ADR 0102 — PO ruling D-FUP-1):** an identical re-grant with a
new `p_expires_at` now UPDATES the expiry (targeted `on conflict … do update set
expires_at = coalesce(excluded.expires_at, memberships.expires_at)`), and the
commission-tier atomic-replace UPDATE writes it (same coalesce). **NULL = leave
unchanged** (never clears; "make permanent" stays revoke+regrant). Absolute set, not a
ratchet (shorten works — `306` 4.6b).
**Caller set, bounded by the PROPERTY "reaches `app.grant_role_impl`"** (QA R2 re-sweep —
the original record said "three production callers", which was a `rpc('grant_role'` GREP
bounded by SYNTAX and missed the `_for` twin entirely): **3 public doors** call the kernel
(`grant_role`, `grant_role_for`, `appoint_technical_director`); **5 further SQL functions**
reach it through them (`add_pqs_member`, `assign_org_admin`, `assign_hospital_admin`,
`assign_nsp_org_admin`, `assign_nsp_coordinator`); **9 TS RPC sites** —
`admin/actions.ts:285`, `members/actions.ts:235`, `org/actions.ts:581` + `:618`,
`platform/actions.ts:210` + `:247`, `pqs/actions.ts:65`, `users/actions.ts:714` + `:949`.
**NONE of the 9 passes `p_expires_at`** — the NULL ruling survives on a population three
times larger than the one it was decided on.
`292` §2.2 is now a **named-set** assertion (`app._t292_expiry_writer, app.grant_role_impl`).
`trg_audit_memberships`'s role-change arm carries `expires_at_before/_after` when the
expiry also moved (Rule 11 — a role-replace that writes expiry is no longer unaudited;
keystone 4.13c). Pins: `306` §4 (45 tests) + `f1-expiry-seam-audit.sh` 6/6 RED-PROVEN.
⚠ **CORRECTED 2026-08-07 (QA R1) — the previous sentence here was BACKWARDS.** It said the
sibling PHI door `app._grant_case_access_unchecked` "deliberately KEEPS the do-nothing seam".
It does not. Its `do update` list ENDS with `expires_at = excluded.expires_at` —
**uncoalesced**. That door already extends on re-grant **and NULL-CLEARS**, which is the exact
shape ADR 0102 §2 refused for the role door, on a door carrying `read_standard_phi` /
`read_restricted_phi`.
✅ **RULED INTENDED 2026-08-07 (PO; ADR [0103](decisions/0103-case-access-blank-expiry-is-permanent.md)) —
FUP-QO-7 resolved.** The uncoalesced `expires_at = excluded.expires_at` **stays**; the door is
unchanged. The two doors are ruled **oppositely on purpose**, and the deciding fact is the **caller
population**: the role door has **no** caller that passes an expiry (12 TS sites, all omit it), so a
NULL there is an accident nobody asked for ⇒ leave unchanged; this door has **exactly one** —
`grantCaseAccess` (`case-access/actions.ts:177`) ⇒ make permanent. ⚠ **The UI cannot send NULL by
accident:** the grant dialog's expiry control is a **NativeSelect** (`Sem prazo` / `30 dias` /
`90 dias` / `Data específica`) and the only blankable control — the DatePicker under
`Data específica` — fails client-side validation when empty, so NULL arrives ONLY via the explicit
`Sem prazo` choice, which on a re-grant means "remove the existing expiry". `create_case` /
`create_case_from_template` reach the kernel only via the creator self-grant with a hardcoded `null`
on a BRAND-NEW case, so the `DO UPDATE` arm is unreachable from them. Pinned: `183` §E (E0–E3, plan
19→23); falsifiable — the `coalesce` neutralisation reds **E1 and only E1**, `greatest()` reds
E0/E1/E3. ⚠ **Do not unify the two doors without re-running BOTH caller sweeps** — the asymmetry is a
property of who calls them, and it stops being true the day a caller changes. Phase C break-glass
(D14) rides a role seam that already extends.

**Resolver.** `app._case_caps` S7 (after S5, before S3): oversight-visible commission
of a reviewed hospital ⇒ `read_case_content | view_case_overview` = 5 EXACTLY — no
deliberation (D4), no PHI (D5 — `can_read_case_patient` stays false), no write (D7);
locked (`explicit_grants_only`) cases invisible to the arm (D6; exceptions ride
`case_access_grants` S3). Inherits STEP-2 `is_active` + STEP-4 hard denies by
position. Propagates automatically through `can_read_case` → `cases_select` +
`list_cases_board`. Both stale `view_case_overview` comments (S3 + `_cap_bit`) updated.

**Dashboards (D11).** `app.can_read_quality_dashboards(uuid)` OR-ed into EXACTLY the
six aggregate doors (`distributions, entity_references, form_totals, matrix_cells,
risk_scores, submissions_over_time`); the three row-level doors (`export_rows,
free_text, completion_by_member`) carry ZERO trace — `270` t9/t10 hold the boundary
(array-equality, comment-stripped) and q1's `arm_seventh_door` proves it can fail.
⚠ All nine doors deny by **silent empty `return;`**, not 42501 — deny keystones must
be zero-rows + permitted-caller pairs.

**Shell + board.** Three SELECT arms (ALTER POLICY, one disjunct each):
`commissions_select_member_or_admin` += reviewer∧visible · `hospitals_select` +=
reviewer-of · `organizations_select` += `is_quality_reviewer_in_org`.
`public.quality_board_summary(uuid)` (DEFINER; gate ≥1 unexpired reviewer membership
in the org else 42501): per visible commission — `total_cases` (readable population,
per-row `can_read_case`, incl. granted-locked), `open_cases` (readable ∧ the
`count_open_cases_for_board` predicate), `locked_cases` (eg-rows the caller CANNOT
read — **disjoint from total by construction**, `310` 2.5). PHI-free return shape
pinned column-for-column (`310` 2.6).

**TS surface.** `src/lib/queries/quality.ts` (`getQualityBoardSummary`) ·
`src/lib/quality/actions.ts` (`setCommissionOversight`) · `session.ts`:
`SessionContext.qualityReviewerOf`, `getQualidadeAccessByOrg(orgSlug)` (no-DB-read,
TD-style), `CommissionAccess.isQualityViewer` (**a FLAG, never a member role** —
`CommissionRole` stays `'staff' | 'staff_admin'`, D10). Role-label chain: fixture
`src/lib/members/__fixtures__/membership-roles.json` == `304` §10 embed ==
`ROLE_LABELS` (frontend adds the pt-BR label).

**Bytes layer (M8 `20260911000700` — lead ruling, post-probe).** S7 had propagated
to standard-tier case attachment BYTES (`attachments_obj_select_readable` →
`can_read_attachment('case'|'interview')` → `can_read_case`) — live-probed, un-audited,
PHI-capable, named by no threading list. The cut: case/interview bytes ADDITIONALLY
require `read_case_deliberation` — the load-bearing lattice invariant is that every
content-conferring source EXCEPT S7 also confers deliberation (S1/S3-closure/S4/S6;
D4 makes S7 the sole exception), so LOST=0 for every pre-existing reader, the
reviewer keeps METADATA (the panel renders names; `attachments_select` untouched)
and reaches ZERO object rows, and an S3-granted reviewer still reads bytes (the D6
graduation path is capability-shaped). `attachments-phi` has **zero SELECT
policies** (probed; M8 postcondition pins it). Reopening reviewer documents is
Phase B+ WITH an audit emit — never by deleting the conjunct. Pinned: `308` §5
(all four directions; 5.2 was observed RED pre-M8) + q1 `open_bytes_cut`.

**Read-only perimeter (M10 `20260911000900`).** S7's `read_case_content` had enrolled the
reviewer into every existing CONSUMER of that bit. Closed in two shapes: the three
authenticated write doors (`declare_conflict`, `file_correction_request`, `record_recusal`)
get an EXPLICIT `app.is_oversight_only_reader` exclusion (a read predicate is not
automatically correct on a write path); the read families get `app.can_read_case_committee`
(= `can_read_case` as it meant BEFORE S7) — Class-2 `professional_profiles` /
`professional_participants` (Rule 12/D5), `can_read_interview` (7 tables),
`can_read_action_item`, and **10** SELECT policies (votes + decisions + 7 `ethics_*` +
`action_items`, whose `case_restricted` arm routes `can_read_case` DIRECTLY — cutting the
predicate does NOT reach it). ⚠ `cases_select` is deliberately NOT re-pointed
(postcondition-pinned: re-pointing it revokes the feature). Both new predicates rest on the
lattice invariant that every content source EXCEPT S7 confers `read_case_deliberation`, so
LOST = 0 for every pre-existing reader/writer. ⚠ `file_correction_request` raises 42501 at
TWO sites (authority; corrector designation) — assert the MESSAGE, not the code.

**Verification.** pgTAP `306`–`311` (154 assertions) + `270` rewrite (13) + `292`/`293`
recuts; seed personas quality.a/.a2/.b + CCIH→visible (0-row-guarded bracket);
`q1-quality-mutation-audit.sh` **17/17 RED-PROVEN** (restore md5-verified incl. both
mutated policy quals, 5 controls green); w3/w4 harnesses re-signatured; w4
`widen_dt_scope_shape` re-add carries the new arm.

## MIN — Meeting audio → generated ata (2026-08-06; ADR 0099 + Amendment 1; migrations `20260910000100`–`…000400`; flag `audio_minutes` **OFF** — seed forces ON for local/E2E)

Full feature record → `docs/progress/min-audio-minutes.md` · runbook →
`docs/deployment/audio-minutes-runbook.md` · service repo `minute_generator` (contract v2.1).

- **Storage**: bucket `meeting-audio` — private, 500 MB (`524288000`), 15 audio MIME types
  (incl. `audio/x-m4a`); **no `authenticated` storage policies by design** — signed upload
  URL minted server-side with the **service-role** client; path `<meeting_id>/<job_id>/<file>`.
  Local `config.toml` `[storage] file_size_limit` = **512MiB** (global cap, committed).
- **Schema**: enum `public.audio_job_status` (`uploading|processing|done|failed|cancelled|applied`
  — minted as the cross-kind vocabulary, D18 reuses it for future interview jobs); table
  `public.meeting_minutes_jobs` (FK `meetings` **ON DELETE CASCADE**; partial unique
  `..._active_uidx` on `(meeting_id) where status in ('uploading','processing','done')` = the
  one-active-job rule). **RLS enabled NOT forced**; ONE SELECT policy
  `app.is_staff_admin_of(app.commission_of_meeting(meeting_id))`; **column grant excludes
  `transcript` AND `result`** (16 granted columns); no INSERT/UPDATE/DELETE for `authenticated`.
- **Doors — all `public.*`** (`app.*` is unreachable through PostgREST; `app` holds
  predicates/asserts only): `create_minutes_job` · `submit_minutes_job` · `cancel_minutes_job`
  (returns `audio_path` for app-side delete) · `save_minutes_draft` (whole-column overwrite —
  the draft type must round-trip, see `draft-roundtrip.test.ts`) · `apply_minutes_review`
  (D5–D7/D12 transaction; reads `draft->'agenda'`; calls `create_committee_action_item`;
  sets the `app.in_meeting_rpc` GUC around the `minutes_md` write; **returns `audio_path`** —
  the action deletes after apply, QA B1) · `read_minutes_transcript` (audited door — gates on
  `app.can_read_minutes_transcript` **first**, NO admin arm = noun rule, then logs
  `minutes_transcript.read`; both `log_audit_access` registries carry the new arm) ·
  webhook helpers `complete_minutes_job`/`fail_minutes_job` (**service_role-only**, idempotent
  latches; `fail` latches on `uploading` AND `processing`) · `list_stale_meeting_audio`
  (**service_role-only** TABLE-returning sweep source; deletion stays app-side —
  `storage.protect_delete()` refuses SQL DML).
- **Audit kinds** (dotted, per the `audit_log_action_shape` CHECK): `minutes_job.created/`
  `.submitted/.completed/.failed/.cancelled/.applied` + `minutes_transcript.read`.
- **App layer**: `src/lib/audio-jobs/` (kind-agnostic v2.1 contract client, HMAC
  `sha256("<ts>.<rawBody>")` ±5 min; `server-only` on **client/metadata only** (they read env) —
  `hmac.ts` deliberately omits it so the E2E helper imports the real `signCallbackBody`,
  MIN review r2 R3; re-add it the moment the module reads env or embeds a secret);
  `src/lib/minutes-jobs/` (actions/queries/reconcile/**sweep**/context/normalize/sanitize/
  messages HC0S0–HC0S6); webhook `src/app/api/webhooks/audio-jobs/route.ts` — raw-body HMAC,
  401 only for bad signature, 200 for permanent conditions; **`src/proxy.ts` matcher excludes
  `api/webhooks`**. The **O3 sweep** (`sweepStaleAudio`) deletes EVERY `meeting-audio` object
  >24 h (deliberately blunter than "no live job"), runs from the webhook + reconcile, throttled;
  ≤24 h is **lazy-enforced** — ADR 0099 Amendment 1 records the residual; D18 interview audio
  (case-PHI) reopens the cron question.
- **Notifications**: emitted **DB-side** inside the webhook RPCs (`enqueue_notification` is
  unreachable from `src/`); vocabulary `meeting`/`meeting`/`pending` (the `notifications`
  CHECKs reject invented names). Env: `MINUTES_SERVICE_URL/_API_KEY`,
  `MINUTES_CALLBACK_HMAC_SECRET`, `MINUTES_CALLBACK_BASE_URL` (override; request-origin default).
- **Tests**: pgTAP `305_audio_minutes.sql` (106) · unit incl. `draft-roundtrip` (key set derived
  from `Record<keyof MinutesDraft, true>` — a new field breaks the build until covered) ·
  E2E `meeting-audio-minutes.spec.ts` 10 scenarios incl. 1b (`audio_release:false` → object
  survives until apply, gone + `audio_deleted_at` after). ⚠ A flag-OFF spec must toggle the
  flag itself (seed forces ON).

## AFF — Hospital affiliation, CPF person identity, org people directory (2026-08-06; ADR 0097 + 0098; migrations `20260909000100`–`…001300`; NO flag, structural)

**New table `public.hospital_affiliations`** — "this person works at this hospital" as a row.
`(principal_id → profiles ON DELETE CASCADE, organization_id, hospital_id, hospital_employee_id,
started_on, ended_on, created_by/created_at/ended_by)`. Composite FK `(hospital_id,
organization_id) → hospitals(id, organization_id)` — it **REPLACES** a single-column `hospital_id`
FK; a second FK to an already-reachable target is the PGRST201 ambiguous-embed shape (ADR 0094
lesson). Partial unique `(principal_id, hospital_id) WHERE ended_on IS NULL` = one *active*
affiliation; history is unbounded and legitimate. `authenticated` holds **SELECT only — no DML
grant**; writes go through the doors. Ending is a soft `ended_on`, **never a DELETE**, enforced by
`guard_affiliation_no_delete` (origin-enabled, mirroring `guard_profile_no_delete`).

⚠ **`hospital_affiliations_select` has FOUR legs**, and the affiliation leg is **ROW**-scoped, not
principal-scoped (ADR 0098 §1): `principal_id = auth.uid()` OR `is_org_admin_of(organization_id)`
OR `is_hospital_admin_of(hospital_id)` OR a membership leg resolving the hospital via
`COALESCE(m.hospital_id, c.hospital_id)`. The plan's literal principal-scoped wording is a policy
on T reading T = **42P17 infinite recursion**; the reach it would have added is served by
`list_org_people` instead. `app.is_admin()` is deliberately **NOT** a leg.

**`profiles.cpf` is the person key** — nullable column, partial unique `WHERE cpf IS NOT NULL`,
digits-only, check digits validated in **both** SQL (`app.is_valid_cpf`) and TS
(`src/lib/users/cpf.ts`), parity pinned by `src/lib/users/__fixtures__/cpf-vectors.json`.

⚠⚠ **`profiles` IS NOW ON COLUMN-LIST GRANTS.** `authenticated` holds SELECT/INSERT/UPDATE on
**11 named columns**, `cpf` excluded; table-level `DELETE/TRUNCATE/REFERENCES/TRIGGER` remain.
**EVERY NEW `profiles` COLUMN NEEDS ITS OWN GRANT OR READS 42501** — the standing `case_referral`
lesson now applies to `profiles`. Pinned executably by `301` §0.10 (the set of columns with no
`authenticated` SELECT grant must be exactly `{cpf}`), so adding a column without its GRANT reds
instead of surprising someone a year later. The residual `REFERENCES (cpf)` is inert **two** ways:
`authenticated` holds no CREATE on `public`, and `profiles_cpf_key` is a *partial* unique index,
which PostgreSQL will not accept as an FK target.

**DROPPED: `profiles.home_hospital_id` and `profiles.hospital_employee_id`.** Matrícula is a
property of the *employment*, not the person. ⚠ `home_organization_id` is **untouched** — it is the
tenancy anchor and the filter of every org-scoped read. `guard_profile_privileged_columns` was
rewritten in the **same** migration (plpgsql is late-bound: the DROP succeeds and then every later
`profiles` UPDATE fails 42703 at runtime) and `cpf` joined its service-role-locked identity set.

### Doors (verified against `pg_proc`, not the migrations)

**Actor-kernel shape, mirroring `grant_role_impl`/`grant_role_for`** — because `registerUser` runs
service-role with **no `auth.uid()`**, so a single `auth.uid()` door would be bypassed on the path
that creates *most* affiliations, and the D13 tenant check would never run there:

| function | ACL | note |
|---|---|---|
| `app.affiliate_person_impl` · `app.end_affiliation_impl` · `app.update_affiliation_impl` | **`postgres=X/postgres`** | owner-only — this is what makes `p_actor` unforgeable |
| `public.affiliate_person` · `end_affiliation` · `update_affiliation` | + `authenticated` | `auth.uid()` wrappers |
| `public.affiliate_person_for` · `end_affiliation_for` · `update_affiliation_for` | + `service_role` **only** | service path |
| `public.list_org_people(p_org_id, p_search, p_cpf)` | + `authenticated` | returns **`[]`, never raises**, for an unauthorized caller — a probe cannot distinguish "no results" from "not allowed". Gated by an **inline** predicate (org_admin OR an active `hospital_admin` in the org), deliberately **NOT** `app.is_org_level_admin_within` (which also admits `nsp_org_admin` and is a live leg of `organizations_select`). **`cpf` is NEVER in the payload**; `p_cpf` is exact-match only |
| `public.log_cpf_probe_for` | `service_role` only | it fronts nothing — **the ACL IS its entire boundary** (`304` §9) |

**Every refusal lives in the kernel, never the wrapper.** Error codes `42501` + `HC0R0…HC0R5`, all
seven mapped to distinct pt-BR messages in `src/lib/affiliations/actions.ts`. ⚠ `HC0R5` exists
*because* `check_violation` **is** `23514`, which the table's CHECKs and the delete guard also
raise — a `23514` arm would have collapsed three unrelated conditions into one sentence, correct
only by accident. A drift detector (`door-error-arms.test.ts` + `304` §6) asserts every raise code
in the doors has a `toState` arm; it enumerates **any** `errcode` spelling, normalizes named
conditions, throws on an unrecognised name, excludes triggers **by return type**, and resolves
**last-write-wins per function** (migrations are forward-only, so superseded text must not be read
as live).

**`end_affiliation` refuses while the principal holds active memberships of ANY tier** under that
hospital — commission seats **and** hospital-tier (`hospital_admin`, `technical_director`,
`technical_director_deputy`, `nsp_coordinator`, `pqs_member`) — returning the blocking seats under
`HC0R1`. A commission-only check would orphan a sitting technical director. **Self-affiliation is
ALLOWED** and the door comment says why (it confers no capability; an admin absent from their own
roster is a bug) so nobody "fixes" it by analogy with the self-grant guard.

### Other surfaces this changed

- **`profiles` SELECT widened** with an affiliation leg and a membership leg (any tier under a
  hospital I administer) — the latter closes ADR 0097 finding 3 (6 membership rows whose
  `principal_id` a hospital admin could not resolve). ⚠ The DENY keystone (a **sibling** hospital's
  admin) pins the **default state, not a hard boundary**: `affiliate_person` lets any in-org
  hospital admin self-serve the affiliation. **The tenant boundary is the ORGANIZATION.**
- **`grant_role_impl`'s `hospital_admin` branch gained `app.is_admin_for(p_actor)`**, symmetric
  with the org_admin branch. Without it single-hospital provisioning had **no working path** (the
  platform admin was denied 42501; the fallback hit the self-grant guard). The
  `technical_director` branch keeps its deliberate no-`is_admin_for` posture, and the self-grant
  guard is untouched.
- **Dominance is now an enforced invariant** (`303`) — every gate admitting `is_hospital_admin_of`
  must admit `is_org_admin_of`. The two live gaps (`set_standard_ownership`,
  `standard_ownerships_select`) are fixed. ⚠ The grid resolves helper **transitivity** and the
  inlined role **literal**, not surface text — a name-only census missed `assign_hospital_admin`
  and `revoke_hospital_admin` entirely and false-positived `list_approver_candidates`.
- **D14 — person-level fields are `org_admin`-only, enforced across SIX actions**:
  `updateUserProfile`, `upsertCredential`, `removeCredential`, `deactivateUser`, `reactivateUser`,
  `suspendUser`. The last three because `app.is_active` is folded into every membership predicate,
  making deactivation a **platform-wide kill switch** — one hospital's offboarding must never end a
  professional's access at another. Offboarding from a hospital is `end_affiliation`. ⚠ **Those
  keystones are Vitest, not pgTAP, by necessity**: these run on the service-role client, so there
  is no RLS backstop and there cannot be one. The gate fires on a **change** (`is distinct from`
  against the current row), not on presence, or a hospital admin could not edit their own matrícula.
- **`authorizeStaffOps` mirrors `is_tenancy_admin_of`'s hospital leg** (+ an `isInactive` check).
  It had been **strictly stricter than all six doors it fronts**, so a hospital admin got a fully
  populated candidate picker and a refusal at submit. A **mirror-drift correction, not a capability
  widening** — every door already admitted them. It failed **closed**, which is why nothing caught it.
- **`professional_profiles.cpf`** — column only, no unique index, no matching, no linking (ADR D15).

### ⚠ Read this before touching the audit trail

`app.audit_write` takes **no actor parameter** and derives `auth.uid()`, so anything written on the
**service path records `actor_id = NULL`** — the actor is known, threaded into the kernel, written
to `created_by`, and then dropped by the audit layer. Platform-wide and pre-existing
(`membership.granted` 40/0, `form.created` 8/0). It **falsifies** the external audit's LOW-1
sentence ("the trigger names the actor") on the provisioning path; corrected in ADR 0097 D6.
`log_cpf_probe_for` threads its actor through **metadata** for exactly this reason.

## PCI + TV — Process-case integrity + template identity/version split (2026-08-05; ADR 0096; migrations `20260906000100`–`…001100` (PCI) · `20260907000100`–`…001200` (TV); NO flag, structural)

**A process template is now an IDENTITY with VERSIONS.** `process_templates` holds
`id`, `commission_id`, `created_by`, `created_at`, `updated_at` — nothing else.
⚠ **It has no `status`, `title`, `description`, `collects_patient` or `case_type_id`
column any more**; all five moved to `process_template_versions`, which also carries
`version_number`, `published_at` and `status ∈ {draft, published, archived}`. A
template is "archived" only as a derived fact: **all** its versions are archived.

**Invariants (from `pg_constraint` / `pg_indexes`):**
- `process_template_versions_one_draft_idx` — partial UNIQUE `(template_id) WHERE status='draft'`
- `process_template_versions_one_published_idx` — partial UNIQUE `(template_id) WHERE status='published'`
- `…_template_id_version_number_key` UNIQUE `(template_id, version_number)`; `version_number >= 1`; `btrim(title) <> ''`
- `template_id → process_templates ON DELETE CASCADE`; `case_type_id → case_types ON DELETE SET NULL`
- Four child tables re-key `template_id → template_version_id` (`ON DELETE CASCADE`),
  each with a version-grain unique: phases `(template_version_id, position)`,
  narratives `(template_version_id, display_position)`, outcomes PK
  `(template_version_id, outcome_id)`, custom fields `(template_version_id, key)`.
- `cases.template_version_id` — **nullable**, `ON DELETE RESTRICT`. Nullable because
  processless cases exist; RESTRICT because the version a case was minted from is the
  historical record a surveyor asks about. `cases` no longer carries `template_id`.

### Doors (verified against `pg_proc`, not the migrations)

| Door | secdef | Notes |
| --- | --- | --- |
| `clone_template_version(p_source_version_id)` | invoker | **Idempotent**: returns the existing draft if one exists rather than erroring. Copies title/description/`collects_patient`/`case_type_id`, then `app.copy_template_version_children`. The RLS-gated INSERT is the authority proof; the owner-run helper re-checks. |
| `publish_template_version(p_template_version_id)` | invoker | Draft-only; requires ≥1 phase (**HC016**); re-validates every `recommend_when` + every result-emitting phase; archives the current published version, then publishes. |
| `publish_process_template(p_template_id)` | invoker | **Thin wrapper** — resolves `app.draft_version_of_template` then delegates. No draft ⇒ `check_violation`. |
| `archive_process_template(p_template_id)` | invoker | **New semantics**: archives EVERY non-archived version. Missing ⇒ `no_data_found`; nothing to archive ⇒ **HC023**; RLS refused the write ⇒ `insufficient_privilege` (the pre-read proves visibility, so a 0-row UPDATE can only be the write policy). |
| `discard_template_draft(p_template_version_id)` | invoker | Draft-only by construction — the guard makes published/archived versions undeletable. |
| `draft_version_of_template(p_template_id)` | invoker STABLE | `public` mirror of `app.draft_version_of_template`. |
| `create_case_from_template` · `bulk_create_cases` | **DEFINER** | Both still take a **template id** and resolve the version internally via `app.published_version_of_template`. Signatures unchanged for callers. |
| phase / narrative / outcome / custom-field setters | mixed | Now take `p_template_version_id`. Draft-only, enforced by the trigger below rather than per-door. |

**Status transitions are trigger-enforced, not door-enforced.**
`app.guard_published_template_version` (BEFORE DELETE OR UPDATE) is the authority:
a status change is refused unless the GUC `app.in_template_publish_rpc` is `'on'`
(only the publish/archive RPCs set it); a non-status update is refused once the
version is not a draft; and **DELETE is refused for both published AND archived**
versions — deliberately stronger than the form-version guard, which blocks only
`published`.

**Commission resolution is now multi-hop** — the re-key removed the child tables' FK
to `process_templates`, so a one-hop embed no longer resolves:
- `app.commission_of_template_version` — 2 hops (version → identity)
- `app.commission_of_template_phase` — **3 hops** (phase → version → identity)
- `app.commission_of_template` — unchanged, 1 hop
- TS twins in `src/lib/case-narratives/actions.ts`: `commissionOfTemplateVersion`
  (2 hops) and `commissionOfTemplateNarrative` (**3 hops**, slot → version → identity).
  ⚠ A `.select()` is an opaque STRING and `.maybeSingle<T>()` ASSERTS rather than
  validates, so the dead one-hop embed typechecked cleanly and failed only at runtime
  with PGRST200 (BUG-TV-001). Verify embed changes against PostgREST, never `tsc`.

### PCI — substrate guards (the audit findings, `20260906*`)

- **`app.is_client_role()`** — `current_setting('role', true) in ('authenticated','anon')`.
  ⭐ **It exists because `current_user` inside a SECURITY DEFINER function is the OWNER**,
  so a role check written that way is INERT. Any new substrate guard that needs to know
  "is this a client?" must use this, not `current_user`. Callers: `app.guard_case_phase_status`,
  `app.guard_case_outcome_coherent`.
- ⭐ **Invariant vs door-mirror — decide which you are writing before you scope it.**
  A guard restating what an RPC enforces is a **door mirror**: scope it to
  `app.is_client_role()`, or it breaks `seed.sql` and privileged pgTAP fixtures that
  run as `postgres` and legitimately create the state. A guard stating something that is
  **never legitimately true** (e.g. cross-commission coherence) binds EVERYONE and takes
  no role scope. Both shapes live inside `guard_case_outcome_coherent`, annotated.
- **`case_phases` INSERT gate** — a phase may only be born inside a vetted RPC window
  (`app.in_case_rpc`) when the writer is a client role. Without it the whole transition
  matrix was bypassable by inserting the terminal row directly. ⚠ Its header records an
  assertion that was **written and reverted**: do NOT add "a new phase must be `pending`" —
  `seed.sql` inserts a `completed` phase 1 under this GUC by contract.
- **Audit mesh (Rule 11)** — read from `pg_trigger`, phase INSERTs and case DELETEs were
  unaudited and four tables (`case_phase_allowed_results`, `case_phase_offered_results`,
  `case_offered_outcomes`, `case_custom_field_values`) had **no triggers at all** while
  being `authenticated`-writable under a `FOR ALL` policy. Now covered by
  `app.trg_audit_case_child` / `_case_phases` / `_cases`. **Cascade-silence convention:**
  every arm returns NULL when the owning commission cannot be resolved, so a cascaded
  child delete is audited once at the CASE level, not per child.
- **Seven AFTER-timing coherence guards** (AFTER so RLS denies first, then integrity):
  `guard_case_narrative_type_coherent` · `guard_case_offered_outcome_coherent` ·
  `guard_case_result_link_coherent` (×2 tables) · `guard_case_phase_refs_coherent` ·
  `guard_case_outcome_coherent` · `guard_template_phase_form_coherent`.
- **Deleted-result filter** — `phase_results` uuids embedded as JSON strings in
  `result_ruleset` are unreachable by FK, so a deleted result made EVERY case creation
  from that template raise a raw 23503. Creation now filters to existing results.
  ⚠ The audit's original remedy ("forbid hard-delete, archive instead") was implemented
  and **pgTAP rejected it, correctly**.
- **Composite FK** `case_phases (form_version_id, form_id) → form_versions (id, form_id)`
  — pins the snapshot to the right form. Indexed `(form_version_id, form_id)`.
- **Revoked grants** — `TRUNCATE, TRIGGER, REFERENCES` dropped from `authenticated`+`anon`
  on the **18** tables of the audited cluster. ⚠ **RLS DOES NOT GATE TRUNCATE** — a
  policy-shaped audit is structurally blind to it. **Scope, honestly:** this is the
  cluster only. **67 of 156 `public` tables still grant at least one of the three to a
  client role** (measured 2026-08-05); the platform-wide sweep is deliberately NOT done.
  Enumerate residuals from `information_schema.role_table_grants`.
- Plus: FK indexes across the cluster, RLS initplan rewrites (`(select auth.uid())`),
  ordering + narrative-pairing constraints, `blocks[]` integrity, and the
  `app.in_case_rpc` GUC restore (a phase INSERT must not close the window).

### ⚠ Four rebuild property losses in one phase — the generalized rule

`20260907001200` exists solely because **a rebuild silently loses properties the original
carried, and an omission has no line in the diff.** Reviewing what the new statement SAYS
cannot find what it fails to mention. The four mechanisms, all real here:

| Mechanism | What was lost |
| --- | --- |
| `DROP` + `CREATE FUNCTION` | **the ACL** — 10 doors went anon-executable |
| `drop` + `add CONSTRAINT` | **`DEFERRABLE`** — broke `reorder_template_phase` with 23505 on every reorder |
| `ALTER … RENAME COLUMN` | re-points the policy silently (avoided by never renaming) |
| a column name held as DATA | loses nothing loudly |

⭐ **A parameter RENAME is a PRIVILEGE RESET.** `CREATE OR REPLACE` preserves the ACL;
`DROP` + `CREATE` resets it to the default PUBLIC grant. That is why exactly 10 of the
~18 doors this phase touched leaked: 6 were re-keyed with `DROP`+`CREATE` (parameter
renamed to `p_template_version_id`) and 4 were brand new — while
`set_template_phase_blocks`, which kept its signature and got `CREATE OR REPLACE`, did
not. **Any `DROP`+`CREATE` of a public function must re-apply its grants in the same
migration.** Current state: **0 public functions executable by `anon` or PUBLIC** (477
total), guarded by `100_dashboard` t19.

**Open cosmetic deviation (not a vulnerability, verified).** The policy swap
(`20260907000700`) recreated 10 policies on the 5 re-keyed relations **without the
`TO authenticated` clause** the originals carried, so they now bind role `public`.
Platform-wide the split is 256 `{authenticated}` vs 11 `{public}` — 10 of the 11 are
these. It is **inert**: `anon` holds no table grant on any of them (a read attempt under
`set local role anon` fails 42501 at the GRANT layer), and `service_role`/`postgres` have
`BYPASSRLS`. Worth normalizing when one of these policies is next touched.

**pgTAP** `296_process_case_integrity` (27, §H1–H4/M2/M4–M8/L1) · `297_process_template_versioning` (37).


## MEM-W1..W3 — Membership hardening + the one real mutation door (2026-08-04; ADR 0094 + Amendments 1-2; migrations `20260905000000`-`...000300`; NO flag, structural)

**One role per principal per commission, one session authority, one mutation kernel.**

**Invariants (W1).** `memberships_one_commission_role_uq` — partial UNIQUE
`(principal_id, commission_id) WHERE commission_id IS NOT NULL`. The org/hospital tier
is deliberately OUTSIDE it (a principal may hold `org_admin` + `nsp_org_admin` of one
org). `memberships_grant_uq` keys on ROLE and therefore never forbade the dual-role
state; this does.

**Cross-scope integrity is now RELATIONAL, not procedural.** The two BEFORE-row guards
(`app.guard_membership_hospital_org`, `app.guard_membership_title_commission`) are
RETIRED — triggers and functions dropped — and replaced by composite FKs that REUSE
THE OLD CONSTRAINT NAMES:
- `memberships_hospital_id_fkey (hospital_id, organization_id) -> hospitals (id, organization_id) ON DELETE CASCADE`
- `memberships_title_id_fkey (title_id, commission_id) -> commission_member_titles (id, commission_id) ON DELETE SET NULL (title_id)`

⚠ **Three things a future author must not "clean up":**
1. **Names are reused on purpose.** A SECOND FK to an already-reachable target is
   PostgREST **PGRST201**; `session.ts`, `members.ts` and `meetings.ts` embed
   `hospitals`/`commission_member_titles` off `memberships` UN-HINTED, and `org.ts`
   hints `memberships!memberships_hospital_id_fkey`. `186` §4a and `291` 1.9 pin
   "exactly one FK per target".
2. **`on delete set null (title_id)` — the column list is mandatory.** A bare composite
   SET NULL nulls `commission_id` too, the scope-shape CHECK rejects it, and commission
   titles become UNDELETABLE.
3. **`memberships_scope_shape` is load-bearing for the FKs.** Composite FKs are MATCH
   SIMPLE, so `(hospital_id set, organization_id NULL)` would slip past; only the CHECK
   makes that unreachable. MATCH FULL is not an option (org-tier rows are legitimately
   mixed-NULL). Cross-scope violations now raise **23503**, previously 23514.

Also: index `memberships_granted_by_idx`.

**The replacement semantic (T1.0).** Granting a commission role to a principal holding
the OTHER role REPLACES it, as an **in-place UPDATE** — which reaches
`trg_audit_memberships`' UPDATE arm (one `membership.role_changed`) and preserves the
row id and the member's `title_id`. A delete+insert emits revoked+granted and destroys
both. Replacing a `staff_admin` row additionally requires the staff_admin arm's
authority, so the role-pin is symmetric (a plain staff_admin can neither create nor
destroy a staff_admin).

**Session authority (W2).** `public.session_context()` — DEFINER, search_path pinned,
EXECUTE `authenticated` only, PHI-free. Returns `{profile, grants[]}` in ONE round trip
(replaced a profile read + 4 membership reads in `getSessionContext`). **Generic over
roles** — one entry per grant carrying role + scope refs, so a NEW ROLE SURFACES WITH NO
CHANGE HERE. ⚠ It lives in `public`, not `app`: config.toml exposes only
`["public","graphql_public"]`, so an `app.*` function is unreachable from
`supabase.rpc()`.
Grants are **expiry-filtered** (`expires_at is null or expires_at > now()`) — verbatim
from `app.has_role_any`, which every membership predicate delegates to. ⚠ A prosrc grep
for `expires_at` reports FALSE for `is_member_of` because the filter is one call down;
the DB always filtered expiry, the **TypeScript never did**. `is_active` is deliberately
NOT filtered (the profile envelope carries status; `requireUser()` routes inactive
accounts).
`trg_audit_memberships` gains a `membership.expiry_changed` arm (before/after
timestamps, PHI-free). **Invariant: nothing in `app`/`public` WRITES
`memberships.expires_at`** — `292` §2 enforces it comment-stripped, with a planted
writer proving the probe has eyes. *(Superseded twice since: QO·A D9 made
`app.grant_role_impl` the sanctioned single writer, and QO·FUP F1 widened what it
writes — see the QO·A "Role doors" paragraph, which is current.)*

**The mutation door (W3) — ADR 0075's split is RETIRED.** Before this, `grant_role` had
**zero TypeScript callers**: every commission grant was raw service-role DML, so the
door's role-pin/self-grant/anti-lockout arms governed nothing reachable.

| Surface | Schema | EXECUTE | Purpose |
| --- | --- | --- | --- |
| `grant_role_impl(p_actor,…)` / `revoke_role_impl(p_actor,…)` | `app` | **owner only** | the kernel — every authority arm, written once |
| `grant_role` / `revoke_role` | `public` | `authenticated` | `auth.uid()` wrappers, no logic of their own |
| `grant_role_for(p_actor,…)` / `revoke_role_for(p_actor,…)` | `public` | **`service_role` ONLY** | service paths that authorized an actor in TS |

⛔ **`authenticated` must NEVER hold EXECUTE on `*_for`** — that lets any signed-in user
name an arbitrary actor and inherit its authority (total bypass). `293` §1 asserts it;
the mutation audit proves the assertion can fail.
⚠ **The kernel INLINES the self-grant check** (`p_user = p_actor`). Delegating to
`app._deny_self_grant` looks right and is right on the session path, but that helper
compares against `auth.uid()`, which is NULL on the service path — a silent no-op
exactly where the guard is newly needed (mutation-proven).
Two deliberate NARROWINGS now bind service callers: **self-grant denial** and the
**org anti-lockout (HC0G1)**.

**App callers (no raw `memberships` DML remains).** `addStaff` + `assignStaffAdmin` →
`grant_role` over the cookie client; `registerUser`, `assignCommitteeRole`,
`removeCommittee`, platform first-org_admin provisioning → `*_for` over the admin
client. ⚠ `addStaff` keeps a **pre-read**: the door REPLACES, and "add this person"
must never demote a coordinator — that is a product rule, not an authorization one.
**Enforced by `npm run lint:memberships-door`** (`scripts/check-memberships-door.mjs`)
— matches the DML verb applied directly to `.from('memberships')`; `.select` is allowed.

**pgTAP.** `291` (35, invariants + replacement), `292` (25, session context + expiry +
the **role-completeness grid**), `293` (24, ACL + the two-entry-point equivalence grid).
**The completeness grid is the ADR-0094 decision-6 checklist made executable**: it reads
the role vocabulary LIVE from `memberships_role_check` and reds until a new role has a
declared scope, a grant arm and a revoke arm.
**Mutation audits:** `w1-membership-mutation-audit.sh` 9/9 · `w2-session-context-mutation-audit.sh` 9/9 ·
`w3-door-kernel-mutation-audit.sh` 8/8, all RED-PROVEN with green controls.

## MEM-W4 — Diretor Técnico: roles, appointment AND the referral plane (2026-08-04; ADR 0094 Amendments 3–4; migrations `20260905000400` · `20260905000500` · `20260905000600`; flag `technical_director` **ON**)

**Roles.** `technical_director` (titular) + `technical_director_deputy`, HOSPITAL tier
(`organization_id` + `hospital_id` set, `commission_id` NULL). Deliberately NOT
commission-scoped: a commission-scoped DT would inherit committee-content reach, which
decision 9 exists to prevent. `memberships_one_technical_director_uq` — partial UNIQUE
`(hospital_id) WHERE role = 'technical_director'` — is the legal "one titular per
hospital" invariant; deputies are unbounded.

**Appointment authority: `org_admin` of the hospital's org OR `hospital_admin` of that
hospital.** ⛔ **NO `is_admin_for` branch — a platform_admin may NOT appoint a Diretor
Técnico** (PO ruling: appointment is a tenant governance act with legal weight, not
tenancy administration). This is the ONLY grant arm in the kernel without one; the
asymmetry is intentional and `294` 3.3 asserts it, mutation-proven, so a future
"consistency" edit cannot quietly restore it.

**Grant arm order — the guards MASK each other:** flag → hospital exists → authority →
physician → titular-uniqueness → self-grant. A deny-code assertion must name the guard
it means or it measures whichever fires first.
- physician: `professional_categories.key = 'physician'` **AND `pc.is_active`**, joined
  from `profiles.professional_category_id`. Resolved on the KEY, never the pt-BR label.
  ⚠ A principal with NO category fails the join and raises `HC0G3` regardless of
  `is_active` — so an `is_active` keystone must give the fixture a real physician
  category first, then retire it (this exact keystone was vacuous until mutation caught it).
- `HC0G3` = not a physician · `HC0G4` = hospital already has a titular.

**Revoke carries NO flag check and NO physician check** — turning the feature off, or
correcting a professional category, must never strand an existing appointment beyond
the administrators who granted it.

**`public.appoint_technical_director(p_hospital, p_user)`** (DEFINER, `authenticated`)
— atomic audited replacement: revoke incumbent + grant appointee in one transaction,
emitting `membership.revoked` then `membership.granted`. It re-checks NOTHING; every
precondition is the kernel's.

**Extensibility, proven not asserted:** the two roles surface in
`public.session_context()` with **zero change to that function** (`294` §5), and
`292` §3's completeness grid RED-ed on `memberships_role_check` until they had a
declared scope and both arms.

**pgTAP** `294` (29) · **mutation** `w4-technical-director-mutation-audit.sh` 8/8 RED-PROVEN.

### The referral plane (T4.5–T4.13; migration `20260905000500`)

**A referral's TARGET is now a sum type.** Either a commission (everything that existed
before) or the technical direction of a hospital. Nothing else forked — same status
machine, same dialogue, same snapshot, same audit trail; what changes is who the target
audience resolves to.

`case_referral` gains `target_type` (`'commission'|'technical_director'`, NOT NULL
default `'commission'`), `target_hospital_id`, `target_hospital_name` (D5 snapshot),
`waiting_on_hospital_id` (D9); `target_commission_id` becomes **nullable**;
`referral_messages.sender_commission_id` becomes **nullable** (D3 — NULL means "the DT
of the target hospital"). `case_referral_target_shape` pins `target_type` in agreement
with which id is non-null, terminating in `else false`. Keyset index
`case_referral_target_hospital_created_keyset_idx` mirrors the committee inbox's.
⚠ All four new columns carry their own `grant select (…) to authenticated` —
`case_referral`'s SELECT is COLUMN-level, and the omission fails at RUNTIME only.

**`app.is_technical_director_of_for(hospital, uid)`** is the audience predicate:
titular **≡** deputy (D1), resolved LIVE against `memberships` via `app.has_role` (D4,
so an office handover moves access in both directions instantly), and the
`technical_director` flag is **folded in** rather than repeated at its six call sites.

**Three arms carry the whole surface**, each guarded first by
`target_type = 'technical_director'` so the commission hot path never pays for them:
`app.can_manage_referral_target` (the entire target lifecycle — ten functions reach it,
seven via `app.assert_referral_target_acts`), `app.can_read_referral_metadata` (the
inbox; referrals have **no** notification fan-out), `app.can_read_referral_phi` (T4.8;
every read stays on the existing audited path — no change to `patient_identifiers` or
`can_read_case_patient`). **All 14 referral policies delegate to these three**, so no
policy was edited. Plus `app.guard_referral_message` (D3 coherence),
`public.snap_referral_commission_names` (D5), and the three RPCs carrying a RAW inline
`is_staff_admin_of(target_commission_id)` that do NOT inherit arm 1 —
`get_referral_detail`, `post_referral_message`, `request_referral_information`.

**`create_referral_draft` gained `p_target_hospital_id`** (DROP+CREATE — an extra arg
would otherwise create a second OVERLOAD and PostgREST answers ambiguity with
PGRST203). Exactly one target is required, and a DT target must be the source
commission's **own hospital** (`commissions.hospital_id` is NOT NULL, so the rule is
total). ⚠ **No product caller yet** — W4 ships no UI (FUP-MEM-3).

**Dispositions, all explicit:** `can_dispose_referral_phi` unchanged (D6 — the DT reads
the PHI it was sent and may not destroy it; the source arm covers the same hospital);
both internal-note predicates unchanged (D8); `link_referral_case` and
`link_referral_related_case` REFUSE a DT row; `assign_referral_reviewer` already fails
closed (HC0A7) and is asserted rather than assumed.

⚠ **FIVE fail-open sites, none in the plan's task list.** Nullable
`target_commission_id` silently changed every expression comparing to it — in SQL a NULL
comparison inside `if`/`check` is *no opinion*, i.e. PASS. (1)
`case_referral_waiting_on_check` would have admitted an arbitrary committee as the
waiting party; (2) `guard_referral_message`'s `sender not in (v_src, v_tgt)` would have
admitted a NULL sender on **every** referral; (3) `link_referral_case` would have
attached **any case in the database**; (4) `link_referral_related_case` would have
raised a raw 23502 out of a check the caller passed. The (5)th was found BY the new
CHECK: "exactly one waiting party" makes every writer of `waiting_on_committee_id` a
writer of BOTH, so `conclude_referral` and `resolve_referral` — needing no DT audience
arm, hence in no DT-shaped enumeration — now clear the other column.
⚠ **Sweep by the PREDICATE's callers, not the column's name.** Seven more functions
inherit arm 1 without ever naming `target_commission_id`:
`app.can_write_referral_response`, `cancel_referral_assignment`,
`redact_referral_message`, `redact_referral_note`, `set_referral_deadline`,
`unlink_referral_case`, `update_referral_assignment`.

**TS surface.** `ReferralTargetType` + `targetType` / `targetHospitalId` /
`waitingOnHospitalId` on the domain types; `targetCommissionId` is now `string | null`.
The `Direção Técnica — <hospital>` label is composed in **one** place —
`referralTargetName()` in `src/lib/queries/referrals.ts` (Rule 9). Four appointment
server actions live in `src/lib/org/actions.ts`; their `authorizeTechnicalDirection`
deliberately has **no `isAdmin` arm**, unlike the sibling `authorizeOrgAdmin`.

**Seed:** `dt.a@test.local` (physician titular of Hospital Central A) +
`dt.dep.a@test.local` (deputy) — neither holds any commission membership, so the
hospital-tier arm is the only way they reach anything.

**pgTAP** `295` (60) · **mutation** `w4-technical-director-referrals-audit.sh` 13/13
RED-PROVEN, control 60 green.


## DOC-REDESIGN — Controlled-Document Redesign (Phase 17 v2, 2026-07-21; ADR 0081; migrations `20260819000000`–`…000400`; flag `controlled_docs` unchanged, prod-OFF till pilot) → `main`

Redesign of Phase-17 controlled docs (frontend rebuilt to the design handoff; additive backend contract). **Enum-key anglicization — this module only** (ADR 0069 method; keys English, pt-BR **labels unchanged**; ethics module's pt-BR enums untouched via function-scoped replace): `controlled_documents.doc_type` → `policy|sop|protocol|bylaws|manual|other`; `document_approvals.decision` → `approved|rejected`; `commission_charters` `regimento`-doc references updated to `bylaws` in lockstep.
- **Additive columns:** `controlled_documents.{category text, tags text[], description text}`; `controlled_document_versions.{obsolete_kind text CHECK(superseded|retired), proposed_effective_date date, approval_due_date date}`. Ride existing RLS; category/tags/description kept OUT of the audit payload (metadata, like `title`).
- **RPCs** (re-emitted from live `pg_get_functiondef`): `create_/update_controlled_document` +`p_category/p_tags/p_description`; `publish_document` stamps the retired prior version `obsolete_kind='superseded'` + defaults `effective_date` from `proposed_effective_date`; `mark_document_obsolete` stamps `'retired'`; `submit_document_for_approval` persists proposed/approval dates + enqueues approver notifications.
- **New DEFINER read** `list_commission_documents(p_commission,…)` — `prosecdef=t`, flag- + commission-authority-gated (`is_member_of OR is_tenancy_admin_of` → empty deny), ACL `authenticated`/`service_role` only (no PUBLIC/anon); backs `listDocuments` with `hasOpenRevision` + approval signed/total counts (removes the FE N+1).
- **New public RPC** `remind_document_approver(p_version_id, p_approver_id)` — `prosecdef=t`, staff_admin-of-commission body-gated (42501), day-deduped, REVOKE-ALL-FROM-PUBLIC before GRANT.
- **Notifications (Phase-20 substrate):** CHECK supersets +kind `document_approval|document_review_due`, +entity `controlled_document_version|controlled_document`, +milestone `decided|published` (capa/signoff/meeting/action_item/ethics/charter preserved). Producers: submit→approvers, decision/publish→author, review-due scan arm (reuses `documents_due_for_review`) injected via the runtime-rewrite pattern.
- **Server actions** (`src/lib/documents/actions.ts`): chained `createAndSubmitDocument` / `createDraftOnly` / `supersedeAndSubmitDocument` (create/upload/attach/submit; partial-failure returns `documentId` for a detail-page banner) + `remindDocumentApprover`.
- **Gate:** tsc/lint 0 · Vitest 369 · pgTAP `201` 29/29 · tester E2E 25/25 · full `e2e:prod` triaged-green (0 redesign regressions; 8 reds all pre-existing/env) · qa **APPROVED**. Build fix `next.config.ts` `outputFileTracingRoot = process.cwd()` (worktree-nested standalone). Local-only; remote/Coolify deferred to the pilot.

## F0 — Pre-Pilot Foundations conventions (2026-07-10; ADR 0065, no migration)

Design gate for the [Pre-Pilot Foundations Program](plans/pre-pilot-foundations-program.md)
(F1 participants → F2 attachments → 16 → F3 flexible-forms). Conventions now in force — F1/F2/F3
reference these instead of re-deriving:

- **Three polymorphism dialects (D12 closed)** — (1) named-FK + shape CHECK *(incumbent:
  `rca_evidence`, `referral_shared_item`, `case_events`, `capa_plan`, `action_items.source_*`)*;
  (2) owner-dispatch `(owner_type, owner_id)` no-FK + DEFINER dispatcher *(F2 attachments owner —
  the platform's FIRST)*; (3) typed-identity registry `participants` `UNIQUE(id,type)` + subtype
  composite-FK+CHECK *(F1)*. `attachment_subjects` uses dialect 3 (`participant_id`), not a 4th.
- **Live-catalog facts (verified sweep, trust generated types not baseline):**
  - **R1 gate:** `is_multi_org()` / migration `…629000000` **do not exist**; the real gate on
    `app.can_read_case_patient` (`20260710000000_nsp_per_hospital.sql`) is **per-hospital
    PQS-operator + per-commission** (staff-admin / membership / live `case_access_grants` grant / phase-or-narrative
    assignee) — no org/multi-org boolean. F1's `get_participant_patient` inherits it unchanged;
    professional identity is deliberately NOT so gated.
  - **HC high-water = HC093** (controlled-docs frozen-set); new SQLSTATEs at **HC094+**.
  - **`form_items.item_type` = 10 values** (`multiple_choice, dropdown, checkbox, free_text,
    short_text, number, date, time, section_text, image`) with the D6-flip `ELSE false` landed
    (`20260711000300_schema_integrity_checks.sql`). F3 widens the CHECK (+`group`, `repeating_group`,
    `matrix`, `risk_matrix`, `reference`), NOT a catalog table (D6/§6.3 cancelled).
  - **No `(owner_type, owner_id)` polymorphism today.** None of `attachments`, `case_participants`,
    `case_types`, `is_exclusive`/`risk_weight`/`behavior_config` exist yet.
  - The four `dispose_*` bodies live in `20260711000700_phi_disposal_closure.sql`.
- **Rule-12 taxonomy:** Class 1 patient PHI (3 modules, single door) + Class 2 professional
  identity (F1; case-scoped RLS + audited reads, no single door) + attachments tier/label layer (F2).
- **Freeze principle:** answer-DATA shapes freeze now; engines/enum-widens/definitions (calculations,
  i18n, correction/`reopen`) are additive-anytime, not pre-landed.

## F1 — Case-Participants E0 (2026-07-10; ADR 0064/0066; migrations `20260716000000`–`…000200`; flags OFF)

The generalized participant/subject foundation (ADR 0064 E0). Ships **behind `case_participants` +
`case_types` flags, seeded OFF (m2 HARD GATE** — never flip on real ethics data until E1
respondent-exclusion RLS lands). RLS on every new table from creation regardless (Rule 1). E1/E2
NOT built. **Local validation:** full pgTAP suite green (151 39/39 re-keyed, 152 43/43 re-keyed,
207 21/21 new keystones, 171/191/197_phi_disposal re-keyed & green); typecheck + lint 0 errors.
**Remote deploy DEFERRED to the pilot reset.**

- **New tables (dialect 3 typed-identity registry):** `participants` (`UNIQUE(id, participant_type)`;
  `sensitivity_class` CHECK-derived from `participant_type`; org-scoped SELECT; **holds NO payload —
  patient `display_name` is a SURROGATE `'Paciente'`, never the raw name**), `patient_participants` /
  `professional_participants` (subtypes composite-FK+CHECK-pinned to the type — **R5 class-separation
  invariant**), `case_participants` (case×participant×role; primary-subject partial-unique; case-scoped
  RLS via `can_read_case`; cross-tenant guard **HC094**), `case_participant_roles`, `case_types`,
  `case_type_terminology` (catalog tables, org-scoped read / org-admin write), `professional_profiles`
  (**Class 2** — case-scoped RLS + audited reads, NO single door, NO `dispose_*` at E0; `user_id` E1
  self-read hook, inert).
- **Re-key `case_patient → patient_identifiers(participant_id)`** (N-per-case; ADR 0064 Decision 3).
  All DML REVOKED; door-only. `cases += organization_id` (R2 denorm; drift guard **HC095**). The
  `case_patient` flag / gate / posture PRESERVED; only cardinality + key change. Reset-OK (flag OFF ⇒
  zero prod PHI).
- **`patient_xref` case-module grain re-keyed `case_id → participant_id`** (ADR 0066 / R3; one xref
  row per patient participant). Changes how the case module feeds Phase-23 linkage. `event`/`referral`
  modules unchanged.
- **New/changed RPCs (all `REVOKE…FROM PUBLIC` + GRANT, t19):** `set_participant_patient` (atomic
  DEFINER writer — participant+subtype+link+identifiers in one coordinator-gated call; name-or-MRN
  floor; R4), `get_participant_patient` / `get_case_patients` (audited doors, `case_patient.read`
  logged with **entity_id = case_id** for C-4 continuity, NULL-out-of-scope, R1 gate inherited),
  `get_case_professional` (Class-2 audited reader → **`professional_profile.read`**), **compat**
  `set_case_patient` / `get_case_patient` (preserve the ADR-0038 single-patient UI contract — resolve
  the case's lone patient participant). `dispose_case_phi` generalized to per-participant satellites +
  per-participant `patient_xref` purge + patient-link soft-remove + registry redaction (Q4); **F2 seam
  marked** for the D10 attachment-redaction layer. `log_audit_access` + `_audit_access_authorized`:
  **`professional_profile.read`** added to allow-list AND C-4 dispatch (`can_read_professional_profile`);
  C-4 42501 errcode preserved.
- **New helpers:** `app.can_read_professional_profile` (case-scoped, DEFINER over base tables, R6-safe),
  `app.case_of_patient_participant`, `app.assert_participant_same_org_as_case` (HC094),
  `app.guard_case_org_matches_commission` (HC095). **SQLSTATEs allocated: HC094, HC095** (HC096 held
  unallocated — professional gate reuses 42501). **New audit verb: `professional_profile.read`.**
- **TS contract (`src/lib/`):** `cases/types.ts` `CasePatient.caseId → participantId`; `queries/cases.ts`
  `getParticipantPatient` / `getCasePatients` + compat `getCasePatient`; `set_case_patient` action
  arg-shape UNCHANGED. Types regen. NO frontend files touched.

## F2 — Centralized Attachments (2026-07-11; ADR 0063/0065, formerly phase-14e; migrations `20260717000000`–`…000500`; flag `attachments` OFF)

The single attachment substrate that supersedes the per-module file tables (`case_documents`,
meeting attachments, interview file attachments). Ships **behind the `attachments` flag, seeded OFF**
(migration `…000500`; `seed.sql` enables it for local/E2E — F1 precedent); every write/open RPC asserts
the flag first, so the whole surface is inert in prod until the pilot flip. RLS is enabled on every new
table from creation regardless (Rule 1). **Local validation:** full pgTAP green (`208_attachments.sql`
50/50 incl. the interview-arm case-scoping keystone; full suite **1957** PASS), tsc + lint 0.
**Remote deploy DEFERRED to the pilot reset.** QA APPROVED (0 BLOCKER/0 MAJOR · 3 MINOR · 4 INFO;
[review](reviews/phase-F2-review.md)); MINOR/INFO fast-follow cleared at Record.

- **New tables:** `attachments` (**dialect-2 owner-dispatch** `(owner_type, owner_id)` — polymorphic,
  NO real FK [no PostgREST embeds], authorization via a SECURITY DEFINER CASE dispatcher; `owner_type`
  ∈ `case`/`meeting`/`interview`/`action_item`/`form_upload`, the last **reserved-INERT** [dispatcher
  returns false/null]; `sensitivity_tier` phi|standard → bucket; orthogonal `confidentiality_label`
  semantic regime; `scan_status`; `legal_hold`; `phi_disposed_*`; path scoped `{owner_type}/{owner_id}/…`
  by CHECK; **physical-column immutability guard HC096** — freezes owner/bucket/path/sha256/size/tier
  outside the `app.in_attachments_rpc` bracket, seam columns not frozen), `attachment_references`
  (non-authorizing companion), `attachment_subjects` (**dialect-3** `participant_id` → the F1
  `participants` registry — NOT a 4th subject vocabulary; FK-pinned, HC-safe), `case_interview_links`
  (interview external links, case-scoped read). All four carry a `to authenticated` SELECT policy **AND**
  a matching table GRANT (K9 — no inert boundary); writes stay DEFINER-only (no authenticated write grant).
- **Buckets:** `attachments` (STANDARD tier — authenticated owner-dispatch SELECT policy + INSERT) and
  `attachments-phi` (PHI tier — authenticated **INSERT only**; **NO authenticated SELECT/UPDATE/DELETE
  policy — the hard door**). Objects never overwritten (Rule 6); a fresh immutable path per upload;
  cloning copies the reference only.
- **RPCs (all `REVOKE…FROM PUBLIC` + GRANT, t19):** `create_attachment` (write door — flag →
  `can_write_attachment` → per-owner_type kind validation → tier/label defaults + label→tier escalation
  → verify the object exists in the resolved bucket → insert), **`open_attachment`** (the audited PHI
  door — flag → load → empty on not-found/soft-deleted/infected → `can_read_attachment` or return →
  **only if tier=phi** write exactly one `log_audit_access('attachment.read', …, '{}')` → return
  `(bucket, path)` for the service-role signer; NULL-out-of-scope: no row, no URL, no audit on denial —
  the SOLE phi-blob read path), `reclassify_attachment`, `soft_delete_attachment`, `dispose_attachment_phi`
  (single-attachment LGPD disposal — rejects legal-hold **HC098** + double-dispose **HC097**; redacts
  title/description, stamps `phi_disposed_*`, RETAINS the object per Rule 6; note: the redacting UPDATE
  also fires the default audit trigger → two audit rows, intentional, PHI-free). **Dispatchers:**
  `commission_of_attachment` / `can_read_attachment` / `can_write_attachment` (owner-dispatch, explicit
  `p_uid` `_for` variants so the predicate is honored outside an `auth.uid()` context; **interview READ
  arm gates on `can_read_case`** — the migration `20260713001200` case-scoping tightening, NOT
  `is_member_of` — plus an org-admin arm; `action_item` arm → scope-aware `can_read_action_item`). New
  audit verb **`attachment.read`** added to the `log_audit_access` allow-list AND the C-4
  `_audit_access_authorized` dispatch (resolves the owner, gates `can_read_attachment`).
- **Fold-in (migration `…000300`, one atomic step):** dropped `case_documents` / `meeting_attachments` /
  `case_interview_attachments`; repointed `rca_evidence.cited_document_id` (ON DELETE **RESTRICT**
  preserved) and `referral_shared_item.source_document_id` (ON DELETE **SET NULL** preserved) onto
  `attachments`; rewired `add_referral_shared_item` to materialize an `attachments` row. `dispose_case_phi`
  (migration `…000400`) generalized to compose the **D10 attachment-redaction seam** — redacts live,
  non-held case attachments + stamps `phi_disposed_*`, **skips `legal_hold=true` rows** with a reported
  count (Q9); F1's participant-keyed body otherwise preserved verbatim.
- **Data-access (`src/lib/`):** `attachments/{constants,actions,queries}.ts` (client-safe `constants.ts`
  is a pure module — no `server-only`/supabase client — so client components value-import tier helpers
  without dragging the server client into the bundle) + `queries/attachments.ts` (`listAttachments`
  batch-signs **only** `sensitivity_tier='standard'` paths, sets `signedUrl: null` for phi). The three
  per-module adapters (`queries/{meetings,interviews,case-documents}.ts`) are **thin passthroughs** that
  carry `a.signedUrl` verbatim — never sign a phi path — preserving the phi→`signedUrl:null` invariant;
  the audited door is `attachments/actions.ts` `openAttachment` (service-role signs the returned
  `(bucket, path)` only). The pre-F2 tier-unaware `getMeetingAttachmentDownloadUrl` was removed at Record
  (MINOR-1). SQLSTATEs allocated **HC096/HC097/HC098** (HC high-water → HC098).
- **Flag:** `attachments` — migration `…000500` seeds OFF (`on conflict do update` forces OFF);
  `seed.sql` flips it ON for local/E2E; prod OFF until the pilot flip.

## F3 — Flexible-Forms Foundation (2026-07-11; ADR 0060/0065; migrations `20260718000000`–`…000200`; NO flag, structural)

The pre-pilot form-engine bones for the four committed field types + the one live feature (dual-evaluator
operators). **Structural, no feature flag** (D6/§6.3 metadata-catalog CANCELLED — `item_type` stays a
CHECK enum widened per feature, ADR 0065 §5). Reset-OK, forward-only, additive. **The FF-1…FF-5 feature
phases that activate these bones were re-sequenced PRE-pilot 2026-07-27 (ADR
[0086](decisions/0086-flexible-forms-pre-pilot.md); order FF-1→FF-2→FF-3→FF-5→FF-4; all gate the pilot
deploy) — FF references below now mean pre-pilot phases.** **Local validation:** full
ordered `supabase test db` **78 files / 2023 PASS** (new `209_flexible_forms.sql` 38/38 + extended
`20_conditions.sql` operator×value_type matrix); tsc 0; Vitest `conditions.test.ts` 81/81 (golden
dual-evaluator parity). **Remote deploy DEFERRED to the pilot reset.**

- **`item_type` widened 10→15** — BOTH constraints: the value enum `form_items_item_type_check` AND the
  shape CHECK `form_items_input_vs_display` gain arms for `group`/`repeating_group` (containers:
  `content NULL`, `required=false`) and `matrix`/`risk_matrix`/`reference` (answerable: `question_key`+
  `label`, `content NULL`, **`required=false`** — the Flag-5 completeness invariant: their answers live in
  the F3 answer tables, not `answers.value`, so a `required` one would deadlock
  `app.response_required_complete`). Garbage still rejected (D6-flip `ELSE false`).
  WARNING - **SUPERSEDED:** `group`/`repeating_group` went live at FF-1 and `matrix`/`risk_matrix`
  at FF-2, which DROPPED their `required=false` pin (see the FF-2 section, ruling 3). **`reference`
  is the only one still inert and the only one still pinned**; FF-5 relaxes it.
- **Cheap columns** — `form_item_options.is_exclusive` (bool, default false) + `risk_weight` (numeric);
  `form_versions.behavior_config jsonb` (reserved staging bag, object|null; shape CHECK). No writer/UX yet.
  `clone_form_version` carries all three forward (Rule 5 / Flag 4).
- **Repeating-group** — `response_group_instances` gains position-uniqueness within a parent
  (`UNIQUE NULLS NOT DISTINCT (response_id, group_item_id, parent_instance_id, position)`); write RPCs → FF-1.
- **Frozen inert answer-shape set** (freeze principle, ADR 0065 §6; authored against
  `docs/design/f3-question-key-aggregation.md`): `form_matrix_rows`/`form_matrix_columns` (definition,
  version-scoped, clone-stable `code`) + `answer_matrix_cells`/`answer_risk_matrix`/`answer_references`
  (answer rows off `answer_id → answers`; disposing a case-phase answer auto-cleans them via FK cascade).
  `answer_references.participant_id → participants(id)` is the A/C bridge (`reference_kind='participant'`;
  FF-5 widens). Reserved `form_item_validations` (open `rule_type text`; FF-3). **All six RLS-from-creation:
  scoped `to authenticated` SELECT + matching GRANT (K9), NO write policy / NO write grant (write-inert;
  the DEFINER writer lands with each FF phase).** WARNING - **per-table status now lives in the FF-2
  section**: the four matrix tables are LIVE (K9 preserved - still SELECT-only, writers are DEFINER);
  `answer_references` (FF-5) and `form_item_validations` (FF-3) remain inert **and carry an inherited
  policy-arm obligation** recorded there. No `*_snapshot` cols (rely on published-version immutability).
- **THE one live feature — dual-evaluator operators** `contains`/`not_contains`/`is_empty`/`is_not_empty`
  in BOTH `app.eval_condition` (migration `…000200`, `CREATE OR REPLACE`, stays IMMUTABLE + `search_path`
  pinned) AND `evalCondition` (`src/lib/queries/conditions.ts`), golden-vector-locked (Rule 3, drift =
  phase-blocking). Semantics (ADR 0060 Rec D): `contains` = array-membership | text-substring, else false
  (no number→text coercion); `is_empty` = absent/null/`''`/`[]`, unary. **NOT authorable** — the storage
  validators (`assert_condition_op_target`/`is_valid_visibility`/`validate_visible_when`) + the builder
  picker (`CHOICE_OPS`/`ORDERED_OPS`/`AGGREGATE_OPS`) are UNTOUCHED; the ops are evaluator-only vocabulary.
  `visible_when` stays visibility-only. `OP_LABELS` in the 3 `Record<ConditionOp>` maps gained pt-BR labels
  (compile lock only, no picker change).
- **SQLSTATEs:** none new. ⚠ This line read "HC high-water stays **HC098**" until 2026-07-27; that
  was the high-water of the **digit lane only**. The live `pg_proc` high-water is **`HC0M9`** — the
  `HC09x` lane was exhausted and the convention moved to letter lanes `HC0A0`…`HC0M9` (`L` skipped).
  The probe that produced the stale figure used the regex `HC([0-9]{3})`, which was structurally
  incapable of matching a letter-lane code (ADR 0087 Amendment 1). **Resolve the high-water from the
  catalog, never from this file.** **No new RPCs / helpers / flags.**
- **Supersession forward-note:** `responses.supersedes_id` deliberately NOT added (additive-anytime,
  freeze principle §6); the post-pilot correction ADR adds it + the dashboard/derived-indicator
  aggregation-exclusion retrofit **atomically** (ARCHITECTURE §2 / ADR 0065 §8).

## FF-2 - Matrix & Risk Matrix (2026-07-27; ADR 0089; migrations `20260830000000`-`...001500`; flag `matrix_fields` **ON** via `...001200`)

Activates F3's matrix bones. **K9 preserved throughout**: all four matrix tables stay `authenticated`
SELECT-only; every write is a DEFINER RPC.

- **Schema** - `weight numeric` (nullable) on `form_matrix_rows`/`form_matrix_columns`; `UNIQUE
  (answer_id, row_id)` on `answer_matrix_cells` **alongside** the original triple-unique (kept so typed
  cells later = a constraint drop + a config key, no answer-table migration); `form_items_input_vs_display`
  relaxed so `matrix`/`risk_matrix` may be `required` (**`reference` still pinned** -> FF-5).
- **Triggers** - `app.guard_matrix_axis_code_immutable` (BEFORE UPDATE on both axis tables; **does not
  consult version status** - ruling 4, `HC0P0`) * `app.guard_matrix_cell_coherent` /
  `app.guard_risk_matrix_coherent` (row/col must belong to the answer's item, `HC0P1`) *
  `app.guard_submitted_selections` **reused** for both matrix answer tables (it was never
  selection-specific - it is answer_id-keyed submitted-immutability).
- **Rulings** - (1) radio grid: one column per row, `value='true'`, no payload; (2) `risk_score =
  severity.weight * likelihood.weight` **derived server-side**, a client-sent score is never read, bands
  are display-only in `config.riskBands`; (3) `required` = **row-complete**, in BOTH the flat and the
  per-instance loop; (4) axis `code` **immutable** - the cross-version aggregation key.
- **`app.item_required_satisfied(response, item, item_type, instance)`** - **the single
  required-presence predicate for EVERY item type platform-wide.** It replaced four inlined copies (flat +
  per-instance in `submit_response` AND in `app.response_required_complete`). *Any* new answerable type
  adds its arm HERE and nowhere else; a regression here silently breaks required-ness for scalar, choice,
  group-child and matrix at once. `app.instance_is_empty` likewise gained matrix arms - without them
  `submit_response` **prunes an instance holding only a matrix and cascades its cells away** (ADR 0089 A).
- **`app.copy_version_children(source, target)`** - the **extracted shared deep-copy helper**
  (sections * items * container remap * options * **matrix axes**). `clone_form_version` stays INVOKER
  (its RLS-gated `form_versions` INSERT is the authority proof) and delegates. **FF-3 (validations) and
  FF-4 (library insert) are queued behind this extraction - extend it, do not paste a fifth copy block.**
- **Correction copies** - `answer_matrix_cells` + `answer_risk_matrix` in **both** `supersede_response`
  and `start_correction_draft` (four blocks). Old->new resolves **through the instance rows** on the
  preserved `(group_item_id, position)`; matching `new.group_instance_id` to `old.` is unsatisfiable by
  construction (ADR 0087 Amdt 1.3) and fails **silently**. `risk_score` copied verbatim; ids need no remap
  (same `form_version_id`).
- **Reads** - `dashboard_matrix_cells` / `dashboard_risk_scores` (**DEFINER**, `is_staff_admin_of` OR
  `is_admin`, both built on `app.submitted_form_responses` so supersession-tolerance cannot drift).
  Aggregate through **`code`, never `row_id`/`col_id`** - ids are per-version; keying on them splits every
  series at each new version. `get_response_for_signoff` + `getSubmissionDetail` project the grids (a
  signer attesting to a blank grid was FUP-FF2-1).
- **RPCs added** - `upsert_matrix_axes(item, rows, columns)` **DEFINER** (draft-only, staff_admin,
  audited, REPLACE keyed on client-minted `code`); `save_section_answers` gains `p_matrix_cells` /
  `p_risk_matrix` (+ the same two keys per instance entry) delegating to the DEFINER
  `app.save_matrix_answers` / `app.save_risk_matrix_answers` behind `app.assert_matrix_answer_writable`;
  `app.validate_matrix_axes` wired into `publish_form_version`.

### DOOR-PARITY RULE - read before adding ANY door or policy

**A new door or policy must carry every arm its sibling surface carries - neither weaker NOR stronger -
and that must be proven as a table, not asserted.** This cost **four defects in one phase**, each in a
different direction: `copy_version_children` was *stricter* than the RLS it displaced (broke no-JWT owner
callers); the matrix write door was *narrower* than the `answers` policies (a targeted respondent could
not save a cell); the matrix SELECT policies were *narrower* than `answer_selected_options` (a corrector
read 0 cells); and the axis tables lacked the targeted arm the rest of the form-definition chain carries
(a respondent could write a cell and not render the grid). Keystone: **`272_ff2_door_parity.sql`**.

Two traps it also taught: **a `FOR ALL` policy's `USING` grants SELECT too**, so a dedicated `_select_`
policy can look redundant while actually covering the post-submit window (`can_write_targeted_response`
requires `in_progress`; `can_access_targeted_response` does not); and **a mutation that reverts only part
of a fix proves nothing** - revert each arm separately.

### Policy arms - diff any new answer/definition table against this

| Table | base | `can_read_correction_response` | `can_access_targeted_*` | write |
| ----- | ---- | --- | --- | ----- |
| `answers` / `responses` | yes | yes | yes (`_select_targeted`) | own-draft + targeted |
| `answer_selected_options` | yes | yes | yes (ETH `...001500`) | own-draft + targeted (**FOR ALL** - REPLACE needs DELETE) |
| `answer_matrix_cells` / `answer_risk_matrix` | yes | yes | yes | **none** (K9 - DEFINER only) |
| `form_items` / `form_sections` / `form_versions` | yes | n/a | yes (`_select_targeted`) | staff_admin |
| `form_item_options` | yes | n/a | yes (ETH `...001500`) | staff_admin |
| `form_matrix_rows` / `form_matrix_columns` | yes | n/a | yes (`...001400`) | **none** (K9) |
| `response_group_instances` | yes | **no** | yes (ETH `...001500`) | own-draft + targeted |
| **`answer_references`** (FF-5, inert) | yes | **no** | **no** | none |
| `form_item_validations` | yes | **no** | **yes** (FF-3 `20260901000100`) | **none** (K9 - DEFINER door; policy present, GRANT withheld) |

> **INHERITED OBLIGATION - FF-3 DISCHARGED, FF-5 OUTSTANDING.** A row missing arms is only safe while its
> table is write-inert (0 rows). **A phase's writer landing is exactly when that stops being true** and must
> add the arms in the same change. FF-1 handed FF-2 its P0-1 obligation this way and it is the only reason
> FF-2 caught it; FF-2 handed FF-3 the two `form_item_validations` arms, and FF-3 landed them in
> `20260901000100` **together with** its writer and its `copy_version_children` block.
>
> **`answer_references` is now the ONLY row still owing**, and FF-5 inherits the full set: the targeted
> arm, the `can_read_correction_response` arm, the correction-copy blocks in BOTH RPCs with the instance
> remap, and an `app.instance_is_empty` arm (without which `submit_response` prunes an instance holding only
> a reference and cascades it away - FF-2 ADR 0089 section A, identical shape). FF-5 also inherits the
> `required = false` pin on `reference` in `form_items_input_vs_display` **and** the `required_if is null`
> pin FF-3 added beside it - relaxing one without the other reopens the Flag-5 deadlock by the other door.

### Out-of-phase fixes carried in this window

- **BUG-FF1-006** (app layer) - `saveSection` dropped FF-1's `HC0N2` into the generic retry copy.
- **BUG-FF1-007** (`...001100`) - `get_response_for_signoff`'s per-instance filters compared against a
  four-quote literal, i.e. a string containing ONE apostrophe, so EMPTY-string observations passed the
  filter. Sweep: the only other `prosrc` match is
  `storage.list_multipart_uploads_with_delimiter`, where that form is **correct** double-escaping inside
  dynamic SQL passed to EXECUTE - do not "fix" it.
- **ETH-E2 targeted choice lane** (`...001500`) - `form_item_options`, `answer_selected_options` and
  `response_group_instances` lacked the targeted arms, so a targeted respondent saw choice questions with
  **no options**, could not persist a selection, and could not fill a repeating group.
  `app.assert_group_writable` also carried its own creator-only check (`HC0N2`), so widening the policies
  alone would have done nothing - it now takes the union. Keystone `273_eth_targeted_choice_lane.sql`.

## FF-5 - Entity Reference (2026-07-28; ADR 0091 + Amendments 1-2; migrations `20260902000000`-`...000900`; flag `entity_refs` **ON** via `...000600`)

Activates F3's frozen one-lane `answer_references` (write-inert since 2026-07-12) into three lanes.
**K9 preserved**: `authenticated` keeps **SELECT only** - no write policy, no write grant - so every
write is a DEFINER RPC and a direct INSERT/UPDATE/DELETE fails 42501 (276 §A probes all three verbs;
the denied party DELETING what it can read is its own exclusion shape).

- **Schema** - `commission_id` + `profile_id` added, all three target FKs **`on delete restrict`** (what
  makes ruling 4's live-join labelling safe: a dangling reference is impossible) * `answer_references_
  kind_target_xor` replaces F3's ONE-SIDED participant CHECK, which permitted zero targets and two
  targets * `unique (answer_id)` (one target per item in v1; multi-target is a constraint DROP - the
  writer's REPLACE semantics, the completeness arm and the aggregation are all already cardinality-
  agnostic) * `form_items_input_vs_display`'s `reference` arm **released** for `required`/`required_if`
  (209 §B1c/B3c flipped from `throws_ok` to `lives_ok` - flipped, not deleted, so the release is on the
  record).
- **SELECT door parity** - three arms matching `answer_selected_options` arm-for-arm: base (creator /
  commission-admin / submitted+staff_admin) + `can_read_correction_response` + `can_access_targeted_
  response` (its own policy). F3 shipped the base arm ONLY - verbatim FF-2 QA r1 B-2.
- **Doors** - `app.assert_reference_answer_writable` (DEFINER; arm ORDER is load-bearing - the targeted
  arm is tested FIRST because a targeted respondent is not the creator, the inversion that was FF-2 r1
  B-1) * **`app.guard_reference_coherent` (TRIGGER, not a door check)** - tenant containment on all three
  lanes + the ruling-2 patient case-scoping, enforced on **EVERY path into the table**, so a hand-rolled
  RPC call cannot bypass what the picker filters (Rule 1: the picker is a convenience, the trigger is the
  boundary) * `app.save_reference_answers` (DEFINER; REPLACE per item, `null` clears).
- **⚠ `public.reference_candidates` is INVOKER-RIGHTS BY DESIGN — do not "harden" it to DEFINER.**
  ADR 0091 **ruling 3**. Running as the caller means `participants_select` /
  `commissions_select_member_or_admin` / `profiles_select_self_or_admin` apply verbatim and it **cannot
  widen them**; a DEFINER search would *replace* all three (ADR 0078 A28 / 0079) and re-derive three
  perimeters by hand. The ruling-2 patient narrowing is an ADDITIONAL `exists`, never a substitute.
  Pinned by pgTAP **`276 §G4`**, which asserts the search DOES reach `professional_profiles` through the
  `responses_select` authorization path - so converting it to DEFINER reds a test instead of silently
  changing the security property. (`…000800` revoked its PUBLIC EXECUTE; see below.)
- **`app.ensure_answer_rows(response, item_ids, instance)`** - extracted from
  `app.ensure_matrix_answer_rows`, which now delegates. Upserts the parent `answers` row at a scope.
- **`app.copy_response_answers(src, dst)` - THE single correction-copy surface.** Instances -> answers ->
  **all four** child shapes, with the old->new instance-resolving join written **ONCE**. It replaced
  **six hand-written copies** (2 RPCs x 3 child tables); `supersede_response` and `start_correction_draft`
  both delegate. **Any future answer shape adds ONE insert here and nowhere else - FF-4 will need this.**
  Resolves through the preserved `(group_item_id, position)` identity because ADR 0087 Amdt 1.3 gives the
  successor its OWN instance rows, making a direct `group_instance_id` comparison unsatisfiable by
  construction and **silently** copy-nothing (FF-1 P0-1). QA r2 cleared the extraction: 8/14 columns
  copied, the other six are defaults or BEFORE-INSERT-derived, and `form_items_no_nested_container` makes
  `parent_instance_id` provably always NULL, so the map is bijective and fails **loud** (23505).
- **Completeness** - `app.item_required_satisfied` + `app.instance_is_empty` gain `reference` arms.
  Without the second, `submit_response` prunes an instance whose only content is a reference and the
  `on delete cascade` takes the answer with it - **silent data loss at submit**, which FF-2 had already
  flagged in-code by name.
- **Reads** - `app.references_by_item(response, instance)` (scope-parameterised like
  `matrix_cells_by_item`) * `dashboard_entity_references` (**DEFINER**, `is_staff_admin_of` OR
  `is_admin`, on `app.submitted_form_responses`) - aggregates on the **target id, NEVER the label**
  (ruling 4): labels are resolved by live join, so grouping by one forks every series on a rename.
- **Rule 10** - `app.participant_type_label()` is the SQL authority for participant-type display text;
  its TS mirror is `PARTICIPANT_TYPE_LABELS`. Both are pinned to the SAME seven literals (`276 §L` +
  `participant-type-labels.test.ts`), so changing one alone REDS. Three sites emitted the raw English
  identifier before this; the sign-off projection was one of them and no render-layer patch could reach it.
- **`get_response_for_signoff`** - gains `references_by_item` at BOTH scopes, plus (`…000900`) the
  **top-level `other_text_by_item`** it never had, and a fix to the top-level `observations_by_item`
  block, which had **no `group_instance_id` filter** and folded INSTANCE observations into the top-level
  map (ADR 0087 substrate correction 5 recurring inside this door).
  **⚠ STANDING OBLIGATION: every new answer shape owes this projection AT BOTH SCOPES.** This surface has
  now lost a shape four times - FF-1 `instances`, FF-2 the grids, FF-5 `references_by_item`,
  `other_text_by_item` - each found AFTER shipping. A sign-off is an attestation; a field the screen never
  showed is the sharp end. `276 §N` asserts the projection **KEY SET** at both scopes, not one key,
  because a single-key test would have passed for all three earlier misses.
- **`…000800`** - revoked PUBLIC EXECUTE from `reference_candidates` **and `save_section_answers`**. The
  latter was a REGRESSION: `…000200` added an 11th parameter (DROP+CREATE) and faithfully restored the
  grants read from `proacl` - but **`proacl` shows what is GRANTED, never what was REVOKED**, and CREATE
  hands PUBLIC the default back. Caught by the standing `100_dashboard` anon-executable keystone.
  **Restoring an ACL means restoring the revokes.**
- **Keystones** - `276_ff5_references.sql` (73 assertions). Ruling 2's case-scoping is proven with real
  case-bound fixtures in BOTH directions (another case's patient is invisible; **this** case's patient IS
  a candidate) - the second is what makes an always-deny mechanism detectable, and its absence was QA r2
  B-1. `§O` pins ruling 1's surrogate premise **behaviourally**: a real name crosses
  `set_participant_patient` and `display_name` stays `'Paciente'`.
- **PHI** - **no new PHI surface, no Rule 12 amendment, no audit door** (ruling 1). The participant lane
  reads only `participants.display_name`, a surrogate by construction. See Amendment 1 for the one place
  the original keystone wording was too absolute.

## FF-3 - Validation Engine (2026-07-28; ADR 0090 + Amendment 1; migrations `20260901000000`-`...000800`; flag `item_validations` **ON** via `...000800`)

**EIGHT migrations** (`...000000` schema * `...000100` door+writer+clone * `...000200` evaluator *
`...000300` `required_if` in the dispatch * `...000400` the error surface + the `HC0P9` gate *
`...000500` operator authorability * `...000600` publish-validates-`required_if` * `...000700`
unary-ops-publishable). *I twice reported "seven" in-phase - the count drifted when `...000700`
landed as a defect fix. Count the files, not the prose.*

Activates F3's `form_item_validations` bones, write-inert since 2026-07-12, and adds
`form_items.required_if`. **K9 preserved**: `form_item_validations` stays `authenticated` SELECT-only and
`set_item_validations` is the only door.

- **Vocabulary (ruling 1)** - SIX rule types, pinned by an allowlist CHECK: `number_range`,
  `text_length`, `regex`, `date_range`, `datetime_order`, `unique_within_group`. **Group cardinality is
  NOT one** - `minInstances`/`maxInstances` shipped in FF-1 and a second spelling would be a second source
  of truth for one bound. The column was `not blank` and nothing more, which is the shape that lets a TYPO
  (`number_rang`) store and evaluate to "no rule".
- **Coverage (ruling 2) is a TRIGGER, not a CHECK** - `app.guard_item_validation_row`. A CHECK cannot
  subquery, and coverage is a statement about the JOINED `form_items` row (`item_type`, and for
  `unique_within_group` the PARENT's type). It also enforces version coherence and test-compiles a `regex`
  pattern at write time (an uncompilable pattern would otherwise raise raw inside `submit_response`, after
  publish). `message` is **required non-blank** by CHECK - which is also what keeps a generated pt-BR
  string out of the SQL/TS parity surface.
- **Triggers** - `app.guard_item_validation_row` (BEFORE INSERT/UPDATE: coverage + version
  coherence + the `regex` compile probe; `HC0Q1`/`HC0Q2`) * **`guard_published_structure` REUSED**
  as `guard_published_validations_trg`, giving the table the Rule 5 freeze its `form_item_options`
  sibling already had and the matrix tables still lack * `app.guard_item_type_vs_validations`
  (BEFORE UPDATE OF `item_type`, `parent_item_id` on **`form_items`**) - the other direction:
  `authenticated` holds full DML on `form_items` (unlike `form_item_validations`), so a staff_admin
  could re-type an item through PostgREST and orphan a rule into a pair the coverage trigger would
  have refused.
- **`required_if` (ruling 4)** - a **SINGLE** condition (`app.is_valid_condition`), NOT the
  `{match, conditions[]}` group shape `visible_when` accepts. `form_items_input_vs_display` forbids it on
  containers, display items **and `reference`** (which pins `required = false` until FF-5 - `required_if`
  would be a back door around that pin). Composed into **both** arms of the dispatch via
  `app.item_is_required(required, required_if, answers)`: top-level map in the flat arm,
  `app.instance_answer_map` in the group arm, so per-instance requirement works by construction.
  **VISIBILITY WINS STRUCTURALLY** - both arms already FILTER by `app.eval_visibility` before the
  requirement test, and `required_if` composes as another conjunct INSIDE that filter, never around it.
- **Enforcement topology (ruling 3)** - `severity='error'` blocks **`submit_response` only** (`HC0P9`);
  `warn` never blocks anywhere; **`save_section_answers` never rejects on a validation rule** (a draft must
  stay saveable mid-edit - the Rule 3 resume contract).
- **`app.eval_validation(rule_type, config, value, answers, peer_values)`** - the phase's second dual
  evaluator, IMMUTABLE and **pure**: `unique_within_group` receives its cross-instance peers as an argument
  rather than reaching into the DB, which is what lets one fixture drive both engines. `p_value` is the
  value **from the answer map in scope**, never `answers.value` (a choice item keeps its payload in
  `answer_selected_options` and only resolves to a code in the map). An **empty value always satisfies** -
  presence belongs to `required`/`required_if`, and "empty" is the same notion `eval_condition`'s
  `is_empty` uses, so the platform has one definition of it.
- **`app.response_validation_errors(response)`** - **THE predicate.**
  `public.get_response_validation_errors` reads it and `submit_response` gates on it, which is what makes
  ADR 0090 section 3's "the list the user sees and the gate that blocks them cannot disagree" true rather
  than aspirational. **Amendment 1**: the legacy `app.assert_item_bounds` config-bound lane (`min`/`max` on
  number+date, `minLength`/`maxLength` on the two text types) was extracted into
  `app.item_bound_violations` and folded into this walker with `rule_id = null`, because that lane is a
  SECOND validation surface over the same fields and left alone it breaks the contract in the worst
  direction - **a submit refused with an EMPTY error list.** `HC061` still raises FIRST, from inside the
  item loop, so no behaviour moved.
- **Operator authorability (ruling 5)** - `app.is_valid_condition` widened to `contains`,
  `not_contains`, `is_empty`, `is_not_empty` (implemented by `eval_condition` since F3, refused by the
  storage gate). The `value` requirement is relaxed for the two unary ops **BY NAME**, not by making
  `value` optional - the latter would also admit an `equals` with no value.
- **RPCs added** - `set_item_validations(item, rules)` **DEFINER** (flag `HC0Q0`; authority FIRST
  `42501`; draft-only `HC0P4`; coverage `HC0Q1`; config `HC0Q2`; audited; **REPLACE semantics** - the
  payload is the item's complete rule list, so an omitted rule is DELETED) *
  `get_response_validation_errors(response)` **INVOKER**, gated by an RLS-evaluated probe on `responses`,
  returning `(item_id, group_instance_id, rule_id, rule_type, severity, message)`.
- **`app.copy_version_children`** gains the `form_item_validations` block **and** copies `required_if` -
  landed in the SAME wave as the writer, because the Rule 5 clone gap opens the instant the definition
  table has rows. The block runs LAST, after the `parent_item_id` re-link, since the coverage trigger
  resolves the new item's PARENT to validate `unique_within_group`.
- **Publish** - `public.validate_visible_when`'s item loop generalised over
  (`visible_when`, `required_if`), so `required_if` inherits existence, earlier-question and FF-1's
  outside-in ban. Without it a `required_if` pointing into a repeating group resolves against a map where
  the key is absent, so the item is **silently never required** - fail-open, and invisible to any test that
  only asks "does an unmet `required_if` block".

### FF-3 door parity - DISCHARGED, and it CORRECTS ADR 0090 section 6

Measured against `pg_policies`, not asserted. `form_item_validations` gained the two missing arms
(`_select_targeted` and `_staff_admin_write`), closing the FF-2 hand-forward. **The ADR's parity table was
wrong on one cell**: it recorded the matrix tables as carrying a write policy. They do not - they carry ONE
policy each, and their write boundary is the SELECT-only GRANT plus the DEFINER door. `form_item_options` is
the outlier that misled it: it holds a full `arwdDxtm` grant, so for *that* table the `FOR ALL` policy IS
the boundary.

**FF-3 took the stricter shape**: both policy arms added per the ADR, **grant left SELECT-only**, so K9
holds by privilege and the writer is the only door. The `FOR ALL` policy is documented intent plus
defence-in-depth, **not** today's boundary. Keystone `274` section C pins both facts, including a computed
sibling diff (`form_item_validations` carries no FEWER arms than `form_item_options`) so a future arm added
to one shows up as missing on the other. The lead's rule from this: **where siblings disagree, the tighter
posture wins.**

### Four fail-open defects, none catchable by tsc/lint/unit/build

1. **`app.validation_rule_allowed` returned NULL, not false**, for a top-level item
   (`p_parent_item_type = NULL` gives `NULL and true` = NULL). Every caller wrote `if not allowed(...)`,
   and `not NULL` is NULL, so the `if` never fired and a forbidden pair was **accepted**. A coverage
   predicate must be TOTAL - fixed with an outer `coalesce(..., false)`, and `eval_validation`'s regex arm
   plus `item_is_required` hardened the same way. Same family as FF-2 defect 1: a three-valued predicate
   read as if it were two-valued.
2. **`validate_visible_when` never validated `required_if`** (above) - fixed in `...000600`.
3. **`HC061` has TWO unrelated raise sites** - `app.assert_item_bounds` (a field bound) and
   `app.compute_case_phase_result` (a MANUAL phase with no result) - and `submitResponse` mapped it to
   *"Selecione o resultado da fase"*. Reachable by ORDINARY USE: type two characters into a `minLength: 5`
   field and be told about a phase result. Both raise sites produce good pt-BR, so the mapping now prefers
   the DB message. **A third site exists** (`public.approve_correction` re-raises it) and is separately
   mapped in `corrections/actions.ts`.
4. **The unary operators were STORABLE but UNPUBLISHABLE** (`...000700`). `is_valid_condition` was
   widened; the two publish-time assertions were not. `is_empty` on a NUMBER target raised "exige um valor
   numerico"; on a CHOICE target it raised `referencia a opcao "nula"` - naming an option the author never
   wrote. The author could SAVE the draft and then fail publish with a nonsense message.
   **`app.assert_condition_value_codes` gained a REQUIRED `p_op`**; requiredness is the point, since a
   defaulted parameter lets a caller silently keep the old behaviour. All FOUR call sites wired in the same
   transaction.

> **The complete gate set for a `visible_when`/`required_if` operator, from `pg_proc` - check ALL of these
> when widening the vocabulary.** `app.is_valid_condition` (storage CHECK) * `app.is_valid_visibility`
> (group wrapper - **delegates**, so it inherits any widening) * `app.assert_condition_op_target`
> (publish) * `app.assert_condition_value_codes` (publish). There is no fifth. Two ADJACENT lanes keep
> their own **narrower** allowlists and are deliberately untouched: `app.is_valid_recommend_cond`
> (`equals`/`not_equals`/`in`) and `app.is_valid_flagged_when` - different columns, different vocabularies.

### Two lessons worth more than the code

- **`validate_visible_when` calls the same helper TWICE** (a section loop and an item loop) and the two
  call sites do not share a call text. A re-signature that rewrote only one applied cleanly - plpgsql
  resolves calls at EXECUTION time - and then broke publish with a raw `42883` for any form carrying a
  SECTION condition, a path shipped long before FF-3. The migration's own belt missed it because it counted
  caller **functions** (found the expected 3) while one of them called **twice**. It now counts call
  **SITES** and inspects each site's arguments. Sweep call SITES, never callers.
- **Mutate BEFORE writing a keystone, not after.** Two guards in this phase could not fail and were
  caught by something other than review. The one that held was pre-checked: the narrowings `frontend`
  feared were already covered (E4, I2/I5), and the *actual* uncovered case was a MIXED severity set from
  ONE call - no fixture had ever held both. `274` section M pins it, and its comment block records the
  **OBSERVED** mutation output because two of three predictions were wrong.

### Verified catalog shape (2026-07-28, post-`db reset`; re-derive, do not trust this text)

`set_item_validations(uuid,jsonb)` **prosecdef=true** * `get_response_validation_errors(uuid)`
**prosecdef=false** (INVOKER - the RLS-evaluated probe on `responses` is the read gate, so it is
exactly as strong as the `responses` SELECT policy, neither weaker nor stronger) *
`app.response_validation_errors` DEFINER/STABLE * `app.assert_condition_value_codes` DEFINER/STABLE,
**6 arguments** * IMMUTABLE and pure: `eval_validation`, `item_is_required`,
`validation_rule_allowed`, `is_valid_validation_config`, `validation_value_is_empty`,
`item_bound_violations`, `is_valid_condition`, `is_valid_visibility`,
`assert_condition_op_target` * `form_item_validations`: **3 policies**, `authenticated` SELECT=true
INSERT=**false** * 3 triggers as listed above. Plans: `274` 81, `209` 44, `272` 30.

### pgTAP

`274_ff3_validations.sql` - **81 assertions**, every ADR 0090 keystone, each mutation-proven. The
artifact is not a mutation COUNT (I cannot defend a precise one) but the **observed red output
recorded per section**, naming the exact revert and which assertions went red - so `qa` can re-run
any proof from the note alone. Re-pins: `209` section B **+4** (the `required_if` half of the
Flag-5 freeze, with a POSITIVE twin so the three negatives cannot pass vacuously) and `272` **section S
+3** (a TARGETED respondent READS validation ROWS - `274` section C can only prove the policy EXISTS,
which ETH-E1 established is a different claim).

## FF-4 - Power Authoring (2026-08-03; ADR 0092 + Amendments 1-2; migrations `20260903000000`-`...000600`; flag `power_authoring` **ON** via `...000600`)

The **last** of the five phases ADR 0086 ruling 2 put in front of the pilot deploy. A commission-scoped
reusable **block library** (jsonb snapshot of one item subtree) + **dynamic defaults**. No
`form_calculations` - it stays ADR-0060-reserved (ADR 0086 ruling 6).

- **`form_block_library`** - `commission_id NOT NULL`, `name`, `description`, `snapshot jsonb`, and
  provenance as **denormalized `saved_by_id` / `saved_by_name` / source form title + version number with
  NO FK** (ruling 2, deliberate: an FK forces a CASCADE-vs-RESTRICT call on a table meant to outlive its
  source, and *any FK present will eventually be joined*, which is how a "snapshot" quietly becomes a
  live link). **K9 preserved**: RLS enabled, **ONE** permissive SELECT policy
  (`is_staff_admin_of OR is_tenancy_admin_of`), `authenticated` holds **SELECT only** - no write
  policy, no write grant - so the four DEFINER doors are the only writers. Commission-only by PO ruling;
  an org-visible arm is additive (one boolean + one `OR`) and deliberately deferred.
- **Four DEFINER doors**, all `revoke execute … from public, anon` **at creation** (ADR 0091 Amendment 2
  applied at birth, not patched): `save_block_to_library` * `insert_block_from_library` *
  `update_block_library_entry` * `delete_block_library_entry`. Each enforces the commission perimeter
  **itself** - there is no RLS behind a DEFINER body.
- **⚠ RULING 3 - A SNAPSHOT IS CLOSED UNDER ITS OWN CONDITIONS.** `visible_when`/`required_if` are written
  over `question_key`s. `save_block_to_library` **refuses** (`HC0Q6`, naming the keys) a subtree whose
  condition references a key OUTSIDE it; `insert_block_from_library` applies the collision rename map to
  the **conditions as well as the keys** via `app.rewrite_condition_keys` (handles both the single-condition
  and `{match, conditions[]}` shapes). Renaming keys without rewriting conditions passes every structural
  test and surfaces only as a question that never appears.
- **⚠ `app._insert_block_child_rows` inserts `form_item_validations` LAST**, after the `parent_item_id`
  re-link - `app.guard_item_validation_row` resolves the new item's **parent type** for
  `unique_within_group`, so a pre-re-link copy sees NULL and refuses the row. Inherited verbatim from
  `app.copy_version_children`, whose insert list **is** the authoritative child enumeration
  (`form_items` recursive * `form_item_options` * `form_matrix_rows`/`_columns` * `form_item_validations`).
  FF-5 reference config rides in `form_items.config`; there is no sixth child table.
- **`form_items.default_source`** (text, nullable) + two CHECKs: `form_items_default_source_xor`
  (literal `default_value` XOR dynamic `default_source`) and `form_items_default_source_type_check`
  (`today`→`date`, `now`→`time`, `current_user_name`/`current_user_email`/`commission_name`→
  `short_text`/`free_text`). ⚠ This type CHECK is **TIGHTER than the shipped
  `form_items_default_value_display_null`**, which still permits a `default_value` on a matrix that nothing
  can apply. FF-4 did **not** inherit that looseness and did **not** retro-tighten it - narrowing a shipped
  CHECK against existing rows is its own migration (ADR 0092 open question).
- **`app.seed_default_answers` / `app.resolve_default_source`** - INVOKER, flag-gated, wired into
  **`start_or_resume_response`'s CREATE branch only** (body re-declared from live `pg_get_functiondef`,
  the FF-2 `publish_form_version` precedent). **Idempotent by contract**: seeds only an unanswered item,
  never overwrites an edited or cleared answer. Only `submitted` responses reach `question_key`
  aggregates, so draft seeding does not perturb dashboards/indicators.
- **⚠ `buildAnswerMaps` (TS, `src/lib/queries/responses.ts`) now DELIBERATELY DIVERGES** and it is not a
  bug to "fix": `answersByItemId` keeps null-valued (cleared) scalar rows, `answersByKey` excludes them.
  `answersByKey` is the **Rule 3 parity mirror** of `app.answer_map_scoped`'s
  `jsonb_object_agg … and a.value is not null`; `answersByItemId` is the wizard's per-item state, where
  "cleared" and "never answered" are different states (`withDefaults`' `item.id in initialAnswers`
  presence check). Collapsing them was **BUG-FF4-001** - a cleared default silently re-seeded on resume -
  and it was a **pre-existing answer-model-v2 bug** (literal `defaultValue` shares the same gate), not an
  FF-4 regression. A mutation-proven Vitest PARITY GUARD pins the exclusion.
- **Amendment 1** - there is **no `question_key` rename door anywhere in the platform**, and never has
  been (`updateItem` pins the key stable so dashboards aggregate across versions; `addItem` mints
  `slug(label) + shortSuffix()`). The rename-review list is therefore **read-only**. Because every key
  already carries a random suffix, the only collision `insert_block_from_library` can hit is inserting the
  same block into one version **twice**.
- **SQLSTATE**: allocates **`HC0Q6`** (ruling-3 closure refusal) **plus `HC0Q7` and `HC0Q8`**
  (`insert_block_from_library` / `delete_block_library_entry` / `update_block_library_entry` /
  `save_block_to_library`). High-water moves `HC0Q5` → **`HC0Q8`**. *(This row said "→ `HC0Q6`"
  until 2026-08-03; Phase 16's Wave 0 catalog check caught it — ADR 0092's prose understates
  FF-4's real consumption too. Verify against `pg_proc`, not this line.)*
- **pgTAP** `277_ff4_power_authoring.sql` - 61 assertions, 12 keystones, each mutation-proven, incl.
  `library_metadata_door_cannot_touch_snapshot` (which makes ruling 2's immutability a proven invariant
  rather than a convention that held because nothing could write) and `library_rls_tenant_scoped` with its
  over-grant twin.

## N — Notifications (S1·N, 2026-07-13; ADR 0076; migrations `20260720000700`–`…000730`; flag `notifications` ON)

In-app notification centre for the pilot's ONE vertical — **CAPA action · section sign-off · meeting**,
**actionable-to-me only**, event-driven **and** time-driven (scheduled scan), **reminder-only, in-app
only** (email/escalation deferred — ADR 0076). The engine + schema are **kind-agnostic** so later scan
arms (docs/indicator/RCA/case/referral) and channels are additive. N sits **OUTSIDE the Rule-11 audit
trail by design** (ADR 0076 decision 13 — own-data; source events already audited; the rows
self-evidence the reminder history). **Local validation:** full `supabase test db` **2255/0** (new
`226_notifications.sql` 52); lint 0 / typecheck 0 / Vitest 369 (incl. `routing.test.ts` `notificationHref`).
**Remote deploy DEFERRED to the pilot reset.**

- **2 tables.** `public.notifications` (`user_id`→profiles, nullable `commission_id` — **CAPA rows carry
  NULL**, `kind`∈capa/signoff/meeting, `milestone`∈assigned/requested/convoked/due_soon/overdue/pending/
  still_open/upcoming, `is_reminder` [false=event assignment, non-suppressible + never auto-resolved;
  true=reminder, suppressible + auto-resolvable], `entity_type`∈capa_action/response_section_signoff/
  meeting + `entity_id`, `title`/`body` **pt-BR SNAPSHOTS from config-level fields ONLY — PHI-free by
  construction, Rule 12**, `dedup_key`, `read_at`, `resolved_at`; **`unique(user_id, dedup_key)`** =
  idempotency) + `public.notification_preferences` (per-`(user_id, surface)` reminder toggle, default ON —
  absence of a row = enabled; suppresses ONLY the reminder stream). **RLS:** both own-row
  (`user_id = auth.uid()`). `notifications` gets SELECT + UPDATE(**`read_at` only**, column-GRANT) but
  **NO authenticated INSERT policy and NO DELETE** — the SOLE write door is the DEFINER
  `app.enqueue_notification` (the BUG-SUP-002 posture: no authenticated write path ⇒ forging is
  impossible by construction). `notification_preferences` is plain own-row SELECT/INSERT/UPDATE (a forged
  own-row preference has no security impact).
- **Engine.** Event-driven enqueue is spliced into 9 existing host mutations (below); the time-driven
  `compute_due_notifications()` DEFINER scan covers CAPA (due_soon ≤3d / overdue / weekly still_open),
  sign-off (pending ≥3d since first `requested` / weekly still_open), meeting (upcoming = tomorrow).
  Idempotent via `ON CONFLICT (user_id, dedup_key) DO NOTHING`; reminder enqueue skipped where the
  recipient disabled that surface (assignments never suppressed). Auto-resolve
  (`app.resolve_notifications_for`) stamps `resolved_at` on unresolved **reminders** of an entity on task
  completion (assignments persist as history). No `pg_cron` job in this migration — scheduled at the
  pilot-reset deploy.
- **`/conta/itens-de-acao` reader (BUG-N-001).** A CAPA action can be assigned to a non-PQS user with no
  access to the PQS-gated CAPA workspace → the capa/assigned deep-link would dead-`#`. `notificationHref`
  for `capa_action` now targets the **static** global personal page `/conta/itens-de-acao` (no per-recipient
  lookup can fail); the new self-scoped DEFINER `list_my_assigned_capa_actions()` feeds it (config-level,
  PHI-free). The assignee advances via the existing `advance_capa_action`/`complete_capa_action` (assignee
  branch of `app.advance_capa_action_core`, no PQS gate). `frontend` owns the page under the existing
  `conta/layout.tsx` (`requireUser()` + the bell); `backend` built only the reader + href retarget.
- **Action-item scan arm (BE-6·N, 2026-07-14 — see the AI section).** `compute_due_notifications()` gained a
  4th arm delivering the AI track's `action_item_reminders` as `kind='action_item'` reminders (`kind`/
  `entity_type` CHECKs widened += `'action_item'`; milestones **reuse** `due_soon`/`overdue`, no milestone
  CHECK change; recipient + `app.can_read_action_item` notify gate + `is_terminal` exclusion +
  resolve-on-complete via `advance_committee_action_item`'s terminal branch). **`NotificationSurface`** (the 3
  suppressible preference surfaces) is now split from the 4-member `NotificationKind` — `action_item` is a
  kind but **NOT** a preference surface (deferred, opt-in-by-config).

## AI — Action-Items Satellites + reminder→N scan arm (2026-07-14; ADR 0050; migrations `20260720000950`–`…000970`; flags `action_items`/`cases_extras` ON)

Three satellite spokes on the shared (non-PHI) `public.action_items` hub, rounding it into a usable
activity/checklist/reminder surface, plus the reminder→Notifications delivery wiring (BE-6·N). **Local
validation:** full `supabase test db` **2412/0** (`227_action_item_satellites.sql` 70 · `226_notifications.sql`
69, +17 AI-arm assertions incl. the Open-#3 `case_restricted` leak test both directions); `database.ts` regen
= nil diff; lint 0. **One FE-owned tsc handoff** (a `NotificationKind`→`NotificationSurface` swap in
`notification-preferences-form.tsx`) routed to `frontend`. **Remote deploy DEFERRED to the pilot reset.**

**[2026-08-18 · `20260818000300`, local-only]** Column `action_items.case_id` — the OPTIONAL
meeting/manual → case cross-link (**association**; `ON DELETE SET NULL`) — renamed → **`linked_case_id`**
to end the confusing collision with `source_case_id` (the case-source **provenance** pointer;
`ON DELETE CASCADE`; untouched). Surgical, column-only: FK `action_items_case_fkey` →
`action_items_linked_case_fkey` + its index renamed (SET NULL preserved); CHECK `action_items_case_link_check`
and the hub `*_select` / `*_staff_admin_write` RLS policies **auto-follow** (parsed node trees). **6 functions
re-emitted from LIVE defs** (not stale migration text — ADR 0078 / [[re-emit-definer-body-from-live-def]]):
`app.can_read_action_item` · `app.case_of_action_item` · `app.trg_audit_action_items` (tracked-col string
literal `'case_id'`→`'linked_case_id'`) · `app.guard_action_item` (`new.case_id`; was NOT in the derived
blast-radius — names the col only via `new.`, found by enumerating triggers) · `public.create_committee_action_item`
· `public.delete_committee_action_item`. **Unchanged** (verified not the column): all `p_case_id` RPC params ·
the `list_my_action_items` JSONB output key `'case_id'` (frontend read contract) · `get_member_overview`'s
other-table `case_id`s · the FE DTO field `caseId` — **no frontend churn**. Remote still has `case_id` —
deferred to the pilot reset.

- **3 satellite tables** on `action_items(id)` (mig `…000950`). `action_item_reminders` (reminder RULES —
  `reminder_type`∈before_due/on_due/after_due, `offset_days` [NULL for on_due, >0 else — CHECK], `is_active`)
  · `action_item_updates` (append-only NARRATIVE feed — `update_type`∈note/progress/blocker/deadline_change,
  free-text `body`; no update/delete path) · `action_item_checklists` (ordered binary SUBTASKS —
  `title`/`is_done`/`sort_order`/`completed_*`). **RLS:** each ONE SELECT policy reusing
  `app.can_read_action_item(action_item_id, auth.uid())` **verbatim** (no new predicate, no per-satellite
  disjunct — a satellite row of a `case_restricted` item is invisible to a non-case-reader exactly like the
  item itself); **NO authenticated INSERT/UPDATE/DELETE** (DEFINER-RPC-only writes). **Audit:** one
  `app.trg_audit_action_item_{reminders,updates,checklists}` AFTER trigger each, structural-cols-only diff
  (free-text body/title excluded), `p_commission := app.commission_of_action_item`.
- **8 `committee_*` mutator RPCs** (DEFINER; each opens on `feature_enabled('action_items')`→HC000; t19
  revoke-from-public + grant authenticated/service_role). Reminders — `create`/`update` (toggle is_active)/
  `delete` = 3, authority **staff_admin/commission_admin of the item's commission (HC0I0)**. Updates —
  `create` = 1 (append-only). Checklists — `create`/`toggle`/`update`/`delete` = 4. Updates + checklists
  authority = **reader-with-a-stake** (`app.can_write_action_item_stake` = `can_read_action_item` AND
  [assigned_to / active assignment / staff_admin / commission_admin]; HC0I1 / HC0I2).
- **`list_my_action_items`** widened with `visibility_scope` in **both** UNION arms (case + shared), additive
  (mig `…000960`) — the "Meus itens de ação" list surfaces each item's scope badge.
- **BE-6·N reminder→N scan arm** (mig `…000970`; see the N section). `compute_due_notifications()` gains an
  action-item arm, gated on `feature_enabled('action_items')`: recipient = `coalesce(assigned_to, active owner
  assignment)` (unassigned ⇒ nothing); **enqueues only if `app.can_read_action_item(item, recipient)`** (Open
  #3 — the verbatim read predicate reused as the notify gate, closing the `case_restricted`-title leak: an
  `assigned_to` who cannot read the case is not notified with its title); terminal items excluded via
  `action_item_statuses.is_terminal`; date match before_due ⇒ `due_date = today+offset_days` / on_due ⇒ `today`
  / after_due ⇒ `today-offset_days`; milestones **reuse** `due_soon` (before_due/on_due) & `overdue`
  (after_due) — **NO milestone CHECK change**; `title` = pt-BR heading, `body` = the item's own title
  (**PHI-free by construction — non-PHI hub, no case/answer/patient join**); dedup
  `action_item:{id}:{milestone}:{date}`. `public.notifications` `kind` + `entity_type` CHECKs widened +=
  `'action_item'`. **Resolve-on-complete:** `advance_committee_action_item`'s terminal branch now calls
  `app.resolve_notifications_for('action_item', id)` — the single choke point (both
  `complete_committee_action_item` and a cancel advance delegate here). **TS:**
  `NotificationKind`/`NotificationEntityType` += `action_item`; new **`NotificationSurface`** = the 3
  suppressible preference surfaces (capa/signoff/meeting) — the `action_item` preference-surface is
  **DEFERRED** (reminders are opt-in-by-config, non-suppressible in S1); `notificationHref('action_item')` →
  static `/conta/itens-de-acao` (like `capa_action` — an assignee may lack workspace access). **Build note:**
  the `advance_` terminal-resolve splice was made against the LIVE `pg_get_functiondef` body (source-aware
  case/meeting authority + the swept `is_tenancy_admin_of`), NOT the stale `000706/707` migration text — a
  mechanical re-copy reverts the `000709000200` commission-admin symbol-sweep and reintroduces the dropped
  `is_org_admin_of_commission` (breaks the `187` guard).

## E1 — Ethics Access Spine · the m2 gate release (2026-07-14; ADR 0072; migrations `20260720000980`–`…001070`; flags `case_participants`+`case_types` **flipped ON**)

> **E3a amendment (BE-2/BE-3, 2026-07-26; migrations `20260827000000`–`…000100`; local-only, unratified — lead verifying).** `cases.case_type_id` (nullable FK → `case_types`, `on delete set null`) now exists — `create_case_from_template` persists it; the processless `create_case` gained an optional `p_case_type_id` (7th arg) + org-guard + the O-1 Rule-12 inheritance of `visibility_policy`/`confidentiality_level` from the type (t19 re-granted after drop+recreate). `case_events` gained 8 procedural `kind` values (auto-derived in BE-5) + a `visibility` column (`case_readers`|`coordinator_only`, default `case_readers`); `case_events_select` extended as a NARROWING-only AND (`coordinator_only` additionally requires staff_admin/commission-admin; `can_read_case` stays the floor). Seed: the `ethics` case_type reconciled to `explicit_grants_only` + `default_case_label='Denúncia'` + a 5-row terminology bundle + 7 org-wide roles; the E1 fixture case now carries `case_type_id`. pgTAP `266_ethics_e3a_surfacing.sql` **20/20** on a fresh reset.
>
> **E3a BE-6 (terminology reads + FE follow-ups; migration `20260827000300`; local-only).** Terminology reader **`getCaseTypeTerminology(caseTypeId)`** — ordinary authenticated RLS read of `case_type_terminology` (member-SELECTable — no new policy needed) merged over the platform default per `term_key`; null/unknown/missing-key all fall back deterministically; NEVER throws/null. Pure types + default bundle + merge moved to the **client-safe** `src/lib/cases/terminology.ts` (BUG-FBE-005: server client stays out of the client bundle); `src/lib/queries/case-types.ts` is the `server-only` reader. `getCaseDetail` now projects the real `caseTypeId`, resolved `terminology`, and **`primarySubjectKind`** (via the cases→case_types FK embed; type-less → `'patient'`); the board read projects `caseTypeId` per row via a batched RLS read (`fetchBoardCaseTypes` — the board RPC TABLE signature untouched). `FeatureFlags` gained the typed `ethics` key (`get_feature_flags()` already returns it). Manual `createCaseEvent` now accepts/persists `visibility` (clamps to `case_readers`); the coordinator gate is DB-enforced: `case_events_writer_write` WITH CHECK now requires staff_admin/commission-admin for `coordinator_only` (policy-only; no RPC/t19). `database.ts` nil-diff. pgTAP `268_ethics_e3a_terminology_reads` **9/9** + vitest `src/lib/cases/terminology.test.ts` **4/4**.
>
> **E3a P0-1 fix — case_events reader-non-writer split (ADR 0079; migration `20260827000400`; local-only).** QA found a leak: `case_events_writer_write` was `FOR ALL` with a BARE `USING (can_write_case_content)`, and a `cmd=ALL` policy's USING participates in SELECT — so a content-**write** grantee (non-staff_admin) read `coordinator_only` rows, bypassing `case_events_select`'s narrowing (BE-6's `WITH CHECK` insert-gate only guarded writes, not reads). Fix: both `FOR ALL` write policies (`case_events_writer_write`, `case_events_staff_admin_write`) are **dropped and recreated as command-specific** (`FOR INSERT`/`UPDATE`/`DELETE`, preserving their USING/WITH CHECK incl. the coordinator_only insert-gate), so **`case_events_select` is now the SOLE SELECT authority**. Post-fix `pg_policies`: SELECT = `case_events_select` only; the 6 write policies are INSERT/UPDATE/DELETE. Read matrix now correct: write-grantee non-coordinator → `case_readers` only (0 `coordinator_only`); staff_admin/commission_admin → all (via `_select`'s coordinator branch); respondent/recused → nothing (floor). Also closes the latent respondent-who-is-staff_admin read bypass (the old ALL-USING re-admitted above the floor). `can_write_case_content ⊆ can_read_case` confirmed (write-grantee still reads its `case_readers` events via `_select`). Policy-only → t19 N/A, `database.ts` unchanged. Keystone: `267` #14–17 (write-grantee sees 0 coordinator_only + still reads the 6 case_readers, **+ mutation-proof** — restoring the un-narrowed writer read-arm makes them see both coordinator_only, RED; revert → 0). Full suite `Files=135, Tests=3852, PASS`.

The access spine the generalized-subject layer (F1/E0) was gated on: a respondent doctor can
never read the case investigating them, recusal/COI are enforced in the DB (not the UI), and
ethics cases are explicit-grants-only with a confidentiality ceiling. **Releases the ADR-0064 m2
hard gate.** **Local validation:** full `supabase test db` **2537/0** (`228_ethics_e1.sql` **125**);
E2E `ethics-e1-access-spine` + `phase11-interviews` **26/26**; `database.ts` regen = nil diff (all
E1 access work is function+policy only); lint 0; vitest 369. QA **APPROVED** after two fix rounds
(3 Majors, each empirically reproduced then fixed). **Remote deploy DEFERRED to the pilot reset.**

- **Columns.** `cases.visibility_policy` (`commission_default`|`explicit_grants_only`) +
  `cases.confidentiality_level` (**the one 7-value taxonomy** — same set as
  `attachments.confidentiality_label` / the canonical `ConfidentialityLabel` in
  `src/lib/attachments/constants.ts`), both **snapshotted at create** and both DEFAULTing to today's
  behaviour (flag-OFF byte-for-byte) · `case_types.default_confidentiality_level` (the snapshot
  source) · `case_access_grants.max_confidentiality` (the clearance grade — **O1 chose a column**, not
  widening `level`'s 2-value CHECK) · `case_recusals.lift_reason_md` · nullable `participant_id` →
  `case_participants(id)` on `case_interviews`/`_subjects`/`_interviewers`. `create_case_from_template`
  gained an **optional 5th arg `p_case_type_id`** (signature 4→5 ⇒ drop+recreate; existing callers
  unaffected) — snapshots type→case only when supplied AND `case_types` is ON.
- **New tables** — all **SELECT-only + DEFINER-RPC writes**, enforced at the **grant** layer (no
  INSERT/UPDATE/DELETE grant exists to anyone), not merely by the absence of a write policy:
  `case_conflict_declarations` (unique(case,declarant) → `HC0E2`) · `case_recusals` (partial-unique
  one **LIVE** per (case,user) → `HC0E0`; SELECT = `can_read_case` **OR self-arm OR staff_admin** —
  the deliberate **D4 asymmetry**: a recused user sees *that* they are recused without regaining case
  read) · `interview_session_attendance` · `interview_topics` · `interview_summaries` (the last two
  are honest write-RPC-less scaffolding for E2/E3; the participant-roles M2M is a **clean deferral**
  to E2 — nothing half-built).
- **Predicates** — see **Helper functions**. All `app.*`, DEFINER, **R6-safe over BASE tables** (no
  RLS-gated `case_participants` read anywhere ⇒ no recursion). **MODIFIED:** `can_read_case` /
  `can_read_case_patient` / `can_write_case_content` each gained the two hard-denies **evaluated
  FIRST, before every grant arm** (a respondent/recused user who is *also* staff_admin / grant-holder
  / QPS operator is still denied), plus the `explicit_grants_only` suppression of the flag-OFF member
  fallback on both read predicates; `list_my_cases` gained an explicit respondent/recusal exclusion;
  `open_attachment` + the `attachments_select` policy gained the document ceiling (`HC0E6`) — it
  **cannot** live inside `can_read_attachment`, which is owner-keyed and cannot see a row's label.
- **15 DEFINER RPCs**, t19 REVOKE→GRANT on every one (see **RPC inventory**): 4 participant writers ·
  2 professional writers (**correction only — NO erasure path**; M2 posture, ARCHITECTURE Rule 12) ·
  `set_case_confidentiality` · `declare_conflict` / `record_recusal` / `lift_recusal` · 5 IV2 fold-in.
- **SQLSTATE `HC0E0`–`HC0E9`** (`HC0E8`/`HC0E9` reserved). **Audit verbs** (PHI-free metadata, Rule 11):
  `case.participant_added` / `case.participant_removed` / `case.primary_subject_set` /
  `case.participant_role_changed` / `case.conflict_declared` / `case.recusal_recorded` /
  `case.recusal_lifted` / `case.confidentiality_changed` / `professional_profile.created` /
  `professional_profile.updated` / `interview.confidentiality_changed`. The professional verbs carry
  **no identity payload**. The Class-2 read verb `professional_profile.read` is unchanged (E0).
- **m2 GATE RELEASED** (`…001040`): `case_participants` + `case_types` **ON**, both added to the
  hand-maintained `FeatureFlags` interface. **E1 does NOT own the `ethics` flag** (E2 does).
- **Known gaps carried to the PO — NOT E1's to fix** (both reviewed and upheld as another module's
  designed model, and both are *documented* exclusions in the 228 sweep): `action_items`'
  `assignees_only` arm, and `patient_safety_event` (`app.can_read_event` grants via
  owner-/reporting-commission + NSP-operator arms only — **no case arm by design**; an NSP record that
  merely *links* to a case).

### ⚠ The three shapes — read this before adding ANY case-scoped table

**`can_read_case` being correct does NOT mean the policies consuming it are.** E1 shipped a correct
predicate and still leaked — **three different ways, each found by a different method**. No single
method would have found all three:

| # | Shape | Why it evaded detection | Found by |
| - | ----- | ----------------------- | -------- |
| (a) | `can_read_case(x) OR is_tenancy_admin_of(…)` — the admin arm ORed **outside** the DEFINER, so the hard-deny never gets the last word | reads as correct; the deny *is* in the predicate | grepping `can_read_case` |
| (b) | `*_staff_admin_write` — **`FOR ALL` PERMISSIVE** with a **bare admin `USING`** and *no case predicate at all* | mentions `can_read_case` **nowhere** ⇒ invisible to any `can_read_case` grep; `FOR ALL` silently covers SELECT and **permissive policies OR together**, handing the row back | fixing (a), re-running, and finding it *still* leaked |
| (c) | `meeting_cases` — keyed **only on the meeting dimension**, no case predicate anywhere; carries `summary`+`decision` (real deliberation) and needs only **plain staff** | matched neither the `can_read_case` grep nor the `*_staff_admin_write` enumeration | **sweeping the data**, not reading policies |

**The durable guard** (`supabase/tests/228_ethics_e1.sql`): a **catalog-driven sweep** — it enumerates
every `case_id`-bearing base table from `information_schema` (**never** a hand-maintained list) +
`cases`, performs a real `select` **under `set local role authenticated`**, and asserts an excluded
persona reads **zero** rows, *naming* any offender. It is **fail-closed**: a new table with the wrong
shape fails automatically, with nobody having to predict it. Two documented exceptions, both reviewed
as not-leaks: the D4 recusal + `case_access_grants` **self-arms** (count only rows the persona does not own),
and `patient_safety_event`. Run it with **both** persona classes — a plain-staff **respondent** and a
**non-granted member** of an `explicit_grants_only` case are *different reach paths* (shape (c) leaked
to the second with **no respondent involved**).

**Two rules that fall out of this:**

1. **Assert at the POLICY layer, not the predicate layer.** `is(app.can_read_case(...), false)` is
   green while the row is readable — it tests the predicate, not the boundary. Only a real `select`
   under an assumed role tests RLS (Rule 1). And include **admin** personas: E1's first green
   2523-assertion suite missed shape (a) entirely because every respondent/recusal persona was plain
   staff.
2. **Member-facing reach ≠ `can_read_case`.** `can_read_case` has **no plain-member arm**
   *by design* (the `case_access` flag is retired — this is the single path now) — member-wide reach for a `commission_default` case comes from
   the member-facing surfaces (board, Meus Casos, meeting case-labels, timeline refs; ADR 0072 D2·8),
   not from `can_read_case`. Gating such a surface on `can_read_case`/`_or_admin` **silently deletes
   ordinary members' reach of ordinary cases**. Use **`can_reach_case_on_member_surface`** there;
   use `can_read_case_or_admin` only where an admin/coordinator **authority** arm is what you mean.

## E2 — Ethics Procedure (S4·ETH·E2, 2026-07-18; ADR 0073; migrations `20260817000000`–`…000700`; flag `ethics` ON **seed-only** — local, remote OFF till pilot)

> **E3a amendment (BE-5, 2026-07-26; migration `20260827000200`; local-only, unratified — lead verifying).** All 8 procedure RPCs (`decide_admissibility`, `add_ethics_allegation`, `record_ethics_finding`, `issue_ethics_notification`, `schedule_ethics_hearing`, `cast_case_vote`, `issue_decision`, `submit_ethics_appeal`) now ALSO emit one `case_events` row on the matching procedural `kind` (O-3 auto-derive), spliced inside the DEFINER body before the single `audit_write` (after the milestone write, same transaction → a failed/unauthorized RPC emits none). Bodies are fixed pt-BR templates over controlled enum values / catalog `display_name` only (PHI-free, no `*_md`/finding/vote/voter/recipient). `finding_recorded` + `vote_cast` = `coordinator_only`; the other 6 = `case_readers`; `can_read_case` stays the floor. Catalog-truth body-only rewrites (`create or replace`, grants preserved — all still `authenticated`+`service_role`); `database.ts` nil-diff. Gate: pgTAP `267_ethics_e3a_autoderive` 20/20 + a migration-level mutation proof (flipping the 2 `coordinator_only` emits to `case_readers` turns keystones 3/6/12/13 RED).
>
> **E3a BE-7 — ethics dashboard read (`getEthicsDashboard(commissionId)`; NO migration; local-only).** `src/lib/queries/ethics-dashboard.ts`. **RLS-scoped by construction:** ordinary `authenticated` `createClient()` + ONLY `.from().select()` reads (no service-role/admin client, no `.rpc()`/DEFINER). Aggregates over `ethics_case_details` / `case_decisions` / `ethics_decision_details` — each SELECT-gated `USING app.can_read_case(case_id, auth.uid())` — so a viewer who can't read a case contributes ZERO to every count. Shape: `totalCases`, `byAdmissibilityStatus` (pending/admissible/inadmissible), `byCaseDecisionStatus` (draft/proposed/voted/issued/appealed/voided), `medianCycleTimeDays` (complaint_received_at→decided_at, issued only, whole days, TS-computed), `sanctionOutcomeCounts[]` (issued only, joined to `ethics_sanction_types` for the pt-BR label). Foreign-commission → empty (commission filter + RLS). No new audit verb (aggregate over already-`can_read_case`-gated surfaces — mirrors E2 D11). Gate: pgTAP `269_ethics_e3a_dashboard` **14/14** — coordinator N=3 vs respondent/recused/non-granted strictly lower with the excluded case contributing to none of the aggregates, foreign=0, **+ mutation-proof** (the same totalCases query run UNSCOPED/superuser returns 3 == coordinator, proving the respondent's scoped 1 is RLS-driven — switching to a service-role path turns the strictly-lower keystones RED). Perf: the per-case `can_read_case` eval is index-backed (`case_participants_case_idx` for the respondent term; partial `case_recusals_case_user_live_idx` for the recusal term) — sound at pilot scale, no new index. **Also hardened `266`'s respondent keystone** (was passing via non-grant; now st_x is granted read + role key `respondent_doctor`, so respondent-deny is the isolating factor). *(E3a pgTAP renumbered 260–263 → 266–269 to avoid the CH/case-corrections numeric collision; BE-8.)*

Full disciplinary procedure layered on E1's case-access spine. **Per-task ledger + test triage →
[progress/eth-e2-procedure.md](progress/eth-e2-procedure.md); QA crux review → [reviews/eth-e2-review.md](reviews/eth-e2-review.md).**

- **Tables (9, all `read_case_content`-tier — one SELECT policy = verbatim `can_read_case`, no authenticated write policy):**
  `ethics_case_details`, `ethics_allegations` (+`ethics_allegation_categories`), `ethics_findings`, `case_decisions`,
  `ethics_decision_details` (+`ethics_sanction_types`), `case_votes`, `ethics_notifications`, `ethics_hearings`,
  `ethics_appeals` (+ `case_assignment_roles` catalog; `case_phases.assignment_role_id`).
- **Write surface = `HC0J·` DEFINER doors** (authority-first `HC0J1`, distinct SQLSTATE from exclusions; anon-revoked; owner
  postgres): admissibility, allegation/finding CRUD, decision lifecycle — `issue_decision` = quorum `HC0J8`, where
  **`required = greatest(coalesce(commission_meeting_settings.quorum_value, ceil(app.eligible_voters(case)/2)), 1)`** and it
  fires the M2 pin; `cast_case_vote` (`HC0J4/5` recused+respondent exclusion); notifications; `schedule_ethics_hearing`
  (rides a `participants_only` meeting); appeals; `target_case_response`/`submit_targeted_case_response` (D13, `HC0J9`);
  catalog CRUD (org-authority `42501`); `redact_professional_profile` (`HC0J7`, minimise-not-destroy, barred while pinned).
- **M2 retention:** `issue_decision` pins the respondent's `professional_profiles` row (idempotent, PHI-free audit); redaction
  nulls identity via the `app.in_redaction_rpc` GUC exception to the `guard_professional_linkage` freeze.
- **Reads:** `get_ethics_case_procedure(case)` (DEFINER, `can_read_case`-gated, null when unreadable/non-ethics/flag-off);
  `listEthicsSanctionTypes`/`listCaseRecusals`/`listEthicsAllegationCategories`/`listCaseAssignmentRoles`. N ethics scan arm =
  `app.compute_due_ethics_notifications` (flag-gated, PHI-free). Consumption: `assign_ethics_remediation`, `open_ethics_external_referral`.
- **PHI:** Class-2 professional identity, no patient PHI. **Data-access:** `src/lib/queries/ethics.ts`, `src/lib/ethics/actions.ts`,
  coordinator controls in `src/lib/case-recusals/actions.ts`; UI = the `etica` tab + `src/components/ethics/**`.
- **Follow-ups (QA info):** INFO-1 respondent direct-`PATCH` of own targeted-response status skips the submit-audit row;
  INFO-2 org_admin case-phase responses via the pre-existing `responses` arm.

## RV2 — Referrals v2 Governance R2–R5 (S4, 2026-07-19; ADR 0037/0078/0079; migrations `20260817001000`–`…002200`; flag `case_referrals` OFF till pilot) → `main` `a61aae3`

Extends S2·RV2·R1 (dialogue core). Full record → `progress/rv2-r2-r5-governance.md`.

**Tables (RLS-on; PHI columns column-REVOKED from `authenticated`):**
- `referral_requested_actions` — R2 vocab (read `true`, write `is_admin()`); mirrors `referral_types`.
- `referral_resolutions` — R3; `summary_md` **PHI-REVOKED**; SELECT `can_read_referral_metadata`; partial-unique `(referral_id) WHERE reopened_at IS NULL` (one active); writes DEFINER-only.
- `referral_assignments`, `referral_case_links` — R4; SELECT `can_read_referral_metadata`; **in NO read predicate** (assignment ≠ access / link ≠ access); writes DEFINER-only.
- `referral_internal_notes` — R5; body **PHI-REVOKED**; SELECT `can_read_referral_internal_note` (source≠target≠QPS); writes DEFINER-only. ⚠ This line predates the RDR merge (ADR 0109): the column is **`body_md`**, and the row also carries `title`/`assigned_to`/`status`/`concluded_*`/`updated_*`. **No table-level `authenticated` ACL — every readable column needs its OWN `GRANT SELECT (col)` or it reads 42501** (the absence of a grant on `body_md` *is* the K-R5-2 hardening). ADR **0110**: `note_type_id`/`type_label` are gone, replaced by **`kind`** — the SAME six-value CHECK as `case_events.kind` (`note`/`meeting`/`decision`/`update`/`follow_up`/`other`), NOT NULL default `note`, TS mirror `src/lib/cases/registro-kinds.ts`. Table `referral_note_types` + its 2 policies + audit trigger + `reorder_referral_note_types` were DROPPED with it.
- `referral_read_receipts` — R5; PK `(message_id, user_id)`; SELECT `can_read_referral_metadata` of the message's referral.
- `case_referral +=` `priority`, `requested_action_id/_label`, `response_due_at`, `decline_reason_code` (R2, PHI-free); status `+= answered, resolved` (R3); `parent_referral_id` self-FK, CHECK ≠ self (R3).

**Predicates (`app.`):** `referral_is_overdue` (R2, SQL↔TS mirror) · `can_read_referral_internal_note` (R5 keystone — source-member OR target-member-once-sent; **NO PQS arm**; the sole `referral_internal_notes` SELECT policy) · `can_read_referral_internal_notes` (plural — R5 audit-entitlement ONLY; no PQS arm; in **0** RLS policies). `can_manage_referral_source`/`_target` (= `is_staff_admin_of_for(source|target)`) gate resolve/reopen/assign/redact.

**RPCs (all DEFINER, t19 = REVOKE PUBLIC + GRANT authenticated/service_role):** R2 — `set_referral_deadline`, `create/update_referral_requested_action`, `create_referral_draft`(+`parent`), `decline_referral`(+reason). R3 — `resolve_referral`, `reopen_referral`, `conclude_referral`(→answered), `close_case`(+answered block). R4 — `assign/update/cancel_referral_assignment`, `list_my_referral_assignments`, `link_referral_related_case`, `unlink_referral_case`. R5 — `create/list_referral_internal_note(s)`, `redact_referral_message/note`, `record_referral_message_receipt`, `dispose_referral_phi` (extended — purges all 4 referral PHI columns; writes `body_md`, so a rename of that column breaks LGPD disposal at RUNTIME, not at migration time). ADR 0110 re-signed two of them: **`create_referral_internal_note(uuid,uuid,text,text,text,uuid)`** and **`update_referral_internal_note(uuid,text,text,text)`** — the 5th/4th arg is now `p_kind text`, not `p_note_type_id uuid`. Both were DROP+CREATE (signature change) with the t19 grant set re-issued explicitly. `list_referral_internal_notes` emits **`referral.note_viewed`** PHI-free audit via `log_audit_access → app._audit_access_authorized → app.audit_write` (Rule 11; fires only when ≥1 note served).

**SQLSTATEs:** `HC0A3` vocab · `HC0A4` deadline · `HC0A5` resolve/reopen state · `HC0A6` lineage · `HC0A7` assignment · `HC0A8` link · `HC0A9` redaction. **Authority = `42501`, checked FIRST** (ADR-0078 non-vacuity).

**Follow-ups:** `189` pgTAP stale-fixture baseline (RV2-unrelated) · notes-SSR hardening (INFO) · pilot `case_referrals` enablement + origin push + deploy.

## CH — Committee Charters & Cadence (S4, 2026-07-20; ADR 0080; migrations `20260818000000`–`…000200`; flag `charters` seed-ON / prod-OFF) → `main`

Per-commission charter = `meeting_frequency` + optional link to the commission's regimento (a `doc_type='regimento'`
Phase-17 controlled doc — content/dates live on the doc, not inline). Full record → `progress/ch-charters-cadence.md`.
**No PHI (Rule 12).**

**Table (RLS-on):**
- `commission_charters` — `commission_id` PK (1:1 → `commissions`, CASCADE); `meeting_frequency` NOT NULL CHECK ∈
  {semanal,quinzenal,mensal,bimestral,trimestral}; nullable `controlled_document_id` (→ `controlled_documents`, SET
  NULL); `created_by`, `created_at`, `updated_at` (trigger `app.touch_updated_at`). **One SELECT policy
  `app.is_member_of(commission_id)`; NO INSERT/UPDATE/DELETE policy** (sole write door = the DEFINER RPC);
  `authenticated` = SELECT-only grant. `sem_regimento` = no row.

**Predicates:** reuses `app.is_member_of` (SELECT + read RPCs), `app.is_staff_admin_of` (write authority — NOT the
broader `is_tenancy_admin_of`), `app.can_read_action_item` (carry-forward confidentiality filter). No new predicate.

**RPCs (all DEFINER, t19 = REVOKE PUBLIC + GRANT authenticated/service_role; flag-gate first via
`app.assert_charters_enabled` → `HC000`):**
- `upsert_commission_charter(p_commission, p_meeting_frequency, p_controlled_document_id default null)` — **authority
  `is_staff_admin_of` FIRST (`HC0K0`)** → regimento-link validity `HC0K1` (same-commission + `doc_type='regimento'`) →
  upsert → audit `charter.upserted` (config metadata, PHI-free). Returns camelCase row.
- `meeting_cadence_status(p_commission)` — member `HC0K2` → `{status,lastHeldAt,meetingFrequency}`; over base tables
  `max(held_at)` where `held_at IS NOT NULL AND visibility_policy='commission_default'`; calendar-interval windows,
  **inclusive** `em_dia` boundary; states `em_dia`/`em_atraso`/`sem_reunioes`/`sem_regimento`.
- `suggest_carry_forward(p_commission)` — member `HC0K2` → `{agendaItems,actionItems}`: unresolved agenda from the
  most-recent held `commission_default` meeting + open non-terminal meeting-sourced action items, each through
  `can_read_action_item`. Pure read (FE copies ticked agenda via the existing `create_meeting_agenda_item`).

**Notifications:** `app.compute_due_charter_notifications()` (X-ζ arm in `compute_due_notifications`, gated on
`feature_enabled('charters')`) — each `em_atraso` commission → each `staff_admin` gets `kind='charter'` /
`entity_type='commission'` / `milestone='overdue'` / `is_reminder=true`, weekly dedup
`charter_cadence:{commission}:{IYYY-IW}`, PHI-free body. `notifications` `kind` CHECK += `charter`, `entity_type`
CHECK += `commission`. Opt-out delivery (no seed trap).

**SQLSTATEs:** `HC0K0` authority · `HC0K1` bad regimento link · `HC0K2` non-member · `HC000` flag-off. **Authority
checked FIRST** (ADR-0078 non-vacuity); keystones KS_AUTHORITY/KS_MEMBER/KS_FILTER mutation-proven RED
(`supabase/tests/mutation/ch-be3-mutation-audit.sh`).

**Follow-ups (QA INFO, non-blocking):** audit metadata breadth (`{meeting_frequency,has_regimento}` config context) ·
no pt-BR `HC000` map in `mapCharterError` (flag-off not user-reachable) · read-layer error/no-row → null · pilot
`charters` enablement + origin push + deploy. Note: controlled-doc `code` is **per-commission** (Farmácia's regimento
is legitimately `DOC-0001`, same as CCIH's — cross-commission rollups must not assume code uniqueness).

## P16 — Standards Crosswalk & Readiness/Gap Engine v2 (2026-08-04; ADR 0093 + Amendments 1-3; migrations `20260903000800`-`...001600` + gate-flip `20260904000100`; flag `accreditation` **ON** via `...000100`)

Accreditation-framework vocabulary (ONA/JCI/custom) + per-standard evidence linking + assessment +
commission-level readiness/gap report + hospital-level worst-status consolidation (D7). PHI-free by
construction (Rule 12 N/A) - evidence LINKS reference an existing artifact by kind+id; they never copy
artifact content, so a `case`/`ethics_procedure` link inherits ITS OWN confidentiality via the D8 mask,
never a duplicate of it. Full record -> `docs/decisions/0093-*.md` +
`docs/plans/phase-16-standards-crosswalk-program.md`.

**Tables (RLS-on, SELECT-only for `authenticated`; every write is a DEFINER RPC - no table has an
INSERT/UPDATE/DELETE policy or grant):**
- `accreditation_frameworks` - `key`, `name`, `version`, `description`, `owner_commission_id` (nullable ->
  **NULL = global pack**, FK `commissions` CASCADE), `cloned_from_framework_id` (self-FK, SET NULL -
  provenance only, D2), `status` CHECK in {`ativo`,`arquivado`}. SELECT policy:
  `owner_commission_id IS NULL OR app.is_member_of(owner_commission_id)` - **global packs are readable by
  every authenticated user** (deliberate: the vocabulary must be visible for a commission to clone it); a
  commission-owned custom framework is member-gated like any tenant content. **No `is_admin()` in this
  policy** - platform_admin sees global packs same as anyone, and nothing more.
- `accreditation_standards` - `framework_id` (FK CASCADE), `parent_id` (**composite self-FK**
  `(parent_id, framework_id) -> (id, framework_id)` CASCADE - the `(id, framework_id)` UNIQUE exists solely
  to host this, keeping a standard's parent inside its OWN framework by construction, not by trigger),
  `code`/`title`/`description_md`, `position`, `level` (nullable smallint, CHECK 1-3, D3's 3-level ONA
  model - NULL for a non-leveled framework like JCI). SELECT policy mirrors the parent framework's.
- `evidence_links` - `commission_id` (FK CASCADE - the LINKING commission, not necessarily the artifact's
  owner for `case`/`ethics_procedure` per D8), `standard_id` (FK CASCADE), `artifact_kind` (10-way CHECK,
  the D4 `ArtifactKind` enumeration), `artifact_id`, `note`, `linked_by`. UNIQUE
  `(commission_id, standard_id, artifact_kind, artifact_id)` - `link_evidence` pre-checks this and raises
  `HC0QB` rather than surfacing the raw `23505`. SELECT policy `app.is_member_of(commission_id)`.
- `standard_assessments` - `commission_id`/`standard_id` (FK CASCADE), `status` CHECK in
  {`conforme`,`parcial`,`nao_conforme`,`nao_aplicavel`}, `note_md`, `assessed_by`. UNIQUE
  `(commission_id, standard_id)` - one assessment per commission per standard, upserted by
  `set_standard_assessment`. SELECT policy `app.is_member_of(commission_id)`.
- `standard_ownerships` - `hospital_id` (FK CASCADE), `standard_id` (FK CASCADE),
  `responsible_commission_id` (FK CASCADE), `assigned_by`. UNIQUE `(hospital_id, standard_id)` - the D7
  override table (a row = "this commission, not worst-status-wins, answers for this standard at hospital
  tier"; clearing the override is a DELETE). Trigger `guard_standard_ownership_hospital` is the schema
  backstop (`23514`) proving `responsible_commission_id` belongs to `hospital_id` via
  `app.hospital_of_commission` - `set_standard_ownership` pre-checks the SAME property and raises `HC0QC`
  first (belt-and-suspenders, the same pattern as every other guarded-DEFINER write in this codebase).
  SELECT policy `app.is_hospital_member_of(hospital_id) OR app.is_hospital_admin_of(hospital_id)`.
- All 5 tables carry a Rule-11 audit AFTER-trigger (`trg_audit_*`); `accreditation_frameworks` and
  `accreditation_standards` additionally carry `app.touch_updated_at`.

**Dispatch predicates (`app` schema, `STABLE SECURITY DEFINER`, one arm per `ArtifactKind` - 10-way, D4) -
the freshness matrix itself is NOT restated here, ADR 0093 Amendments 2-3 are the authority:**
- `app.artifact_belongs_to_commission(p_kind, p_artifact, p_commission)` - is this artifact reachable FROM
  this commission (the D4 "every sibling arm" enumeration). Fail-**closed**: every arm resolves through
  `coalesce(..., false)`; an unrecognized `p_kind` raises rather than falling through.
- `app.evidence_status_of(p_kind, p_artifact)` - the per-kind freshness verdict (`valida`/`vencida`/
  `atencao`/...). Redefined twice post-birth by targeted migrations, NOT edited in place: `...001000`
  (`capa_plan` `open`->`atencao`, ADR 0093 A3.1) and `...001100` (`action_item` `open`/`blocked`->`atencao`,
  A3.3) - read the LIVE `pg_proc` body; the two migrations only carry the diffs.
- `app.evidence_label_of(p_kind, p_artifact)` - the third dispatch helper (Migration E), the D8 masking
  point: returns the real label for an unrestricted artifact, `null` (masked by the caller to "Evidencia
  restrita") for a `case`/`ethics_procedure` the reader's ACL doesn't cover.

**RPCs (all DEFINER, `revoke execute ... from public` + `grant ... to authenticated` at creation; ALL 15
call `app.assert_accreditation_enabled()` FIRST -> `HC0Q9` - unlike `matrix_fields`/`entity_refs`/
`power_authoring`, this module has no pre-existing ungated read path to preserve, so READS are gated too,
not just writes):**
- *Migration C - framework CRUD, global-pack vs. custom-framework split (D6):* `create_framework` /
  `update_framework` / `set_framework_status` / `upsert_standard` / `delete_standard` - the **global-pack
  arm uses `app.is_admin()`** (the ONE sanctioned D6 exception: platform_admin curates the shared
  vocabulary) when `owner_commission_id IS NULL`; the **custom-framework arm uses
  `app.is_staff_admin_of(owner_commission_id)`**, never `is_admin()`. Editing a global pack outside the
  `is_admin()` arm raises `HC0QD`; editing an `arquivado` framework raises `HC0QE`. `clone_framework` is
  the odd one out in this group - it does **NOT** use `is_admin()` at all (only
  `is_staff_admin_of(p_commission)`, the DESTINATION commission), because cloning always creates a new
  commission-owned draft and never touches the source. Two-pass parent remap (insert all standards, then
  remap `parent_id` through an old->new id map keyed on `code`), precedent = `app.copy_version_children`.
- *Migration D - evidence + assessment:* `link_evidence` (guard order: flag -> standard reachable ->
  `artifact_belongs_to_commission` `HC0QA` -> per-kind readability [`can_read_case`/`can_read_capa`/...] ->
  duplicate `HC0QB` -> insert) / `unlink_evidence` / `set_standard_assessment` (upsert,
  `note_md = coalesce(excluded.note_md, standard_assessments.note_md)` - a later assessment call with
  `p_note_md` unset does NOT blank a prior note, BUG-P16-001 symptom fix) / `set_standard_ownership`
  (`is_hospital_admin_of` ONLY, `HC0QC` pre-check) / `evidence_candidates` (search, the SAME per-kind
  readability filter as `link_evidence` so the picker never OFFERS what the linker would reject) /
  `get_standard_assessment` (BUG-P16-001 root-cause fix - the read-path companion to
  `set_standard_assessment`, `is_member_of`-gated).
- *Migration E - the three READ doors, the highest-risk item in the phase; structurally mirror
  `hospital_document_register` MINUS its BUG-AUTHZ-002 defect:* `readiness_report(p_commission,
  p_framework)` and `readiness_evidence(p_commission, p_standard)` - gated **`is_member_of` ONLY**;
  `hospital_readiness(p_hospital, p_framework)` - gated **`is_hospital_admin_of(p_hospital) OR
  is_org_admin_of(org_of_hospital)` ONLY** (D7 worst-status-wins consolidation, `nao_aplicavel` treated as
  abstention not a vote, `standard_ownerships` override short-circuits the vote entirely). **This is the
  correct model per the D6 noun rule; `hospital_document_register` and `hospital_indicator_rollup` were the
  KNOWN-BAD precedent (BUG-AUTHZ-002) an `is_admin()` arm here would repeat — **both were brought into
  line 2026-08-05 by `20260908000100`, so the precedent is now historical rather than live**. None of these three, nor
  `evidence_candidates`/`get_standard_assessment` above, carries an `is_admin()` arm anywhere in their body
  - confirmed against live `prosrc`, not asserted from memory.** All three doors + the two Migration-D read
  functions above now sit inside the **ADR 0079 standing door audit**
  (`supabase/tests/mutation/p0-authz-invariant.sh`) alongside every other DEFINER door in the platform -
  the audit is unconditional on age, no separate opt-in needed. The platform_admin-zero-rows assertion
  against all three (pgTAP 283/284 SECTION A) is, in this phase's own test-file comment, **the single most
  important assertion in Phase 16**.

**SQLSTATEs:** `HC0Q9` flag-off * `HC0QA` artifact not reachable/linkable * `HC0QB` duplicate link *
`HC0QC` invalid target (framework/standard/hospital/level) * `HC0QD` global-pack read-only outside the
`is_admin()` arm * `HC0QE` framework `arquivado`. Full per-code detail lives in the SQLSTATE table below -
this is the summary line, not a second source of truth for it.

**pgTAP** (274 assertions total): `278` schema - 84 * `279` dispatch predicates - 69 (incl. QA-MINOR's
boundary coverage for all 5 indicator frequencies, not just `mensal`) * `280` framework CRUD - 40 * `281`
evidence/assessment - 37 * `283` `readiness_report`/`readiness_evidence` - 20 * `284` `hospital_readiness`
- 24. Every keystone mutation-proven; the read-door reintroduction-of-`is_admin()` mutation and the
ARM=floor door-audit run are the two most load-bearing proofs in the set.

**Migration G (`20260904000100_enable_accreditation.sql`)** is the gate-flip - Phase 16 shipped OFF
through every Wave 1/2 migration and turns ON only here, PO-approved, mirroring
`enable_power_authoring`'s shape. `seed.sql` forces it ON for local/E2E, belt-and-suspenders with every
other already-flipped flag. Flipping it broke four PRE-EXISTING pgTAP assertions that had assumed "seeded
OFF" as an ambient default (278/280/281/284's section-0 setup) - 278's was a TRANSIENT fact about
Migration A's own insert (now correctly asserts the shipped `enabled=true` - see the SQLSTATE
high-water-row note below); 280/281/284's were a REAL ongoing "doors must still deny while OFF" invariant,
fixed by having each section explicitly FORCE the flag OFF in-transaction rather than assert a now-false
ambient claim. `283` carries no such section - a pre-existing gap, not introduced by the flip, left as-is.

## PDF·P1 — PDF document printing: Forms + full skeleton (2026-08-07; ADR 0104; migrations `20260913000000`-`...000300`; flag `document_printing` **OFF** — seed forces ON local/E2E)

**A generated PDF is a RECORD (D1):** minting stores canonical bytes in Storage + one
`printed_documents` row (polymorphic `(source_kind, source_id)` — no FK, ADR D3; denormalized
`commission_id`; `template_key`+`template_version`; sha-256 `content_hash`; `contains_phi`;
status `active|superseded|revoked` text+CHECK; unique `verification_token` [≥192-bit b64url] +
`verification_short_code` [10 chars of `A-HJ-NP-Z2-9`; lookup uppercases, so case-insensitive]).
`pd_storage_path_derived` CHECK pins `storage_path = std|phi/<id>.pdf` (closes
exfiltration-by-reference against ANY writer). Partial unique = ONE active per
(source, template) — supersession's anchor. Column-list SELECT grant to authenticated
**excluding** `storage_path`/`verification_token`/`revoked_reason`/`revoked_by`; **no DML grants**
(door-only writes). `verification_lookups` = the D12 scan log (RLS on, 0 policies, 0 ACL;
credential HASH only).

- **Dispatch door** `app.can_view_printed_document(kind, id, uid)` — SECURITY DEFINER boolean,
  one arm per kind delegating to the source domain's LIVE read surface (`form_response` arm
  mirrors `responses_select` + targeted + admin chain), **`ELSE false` fail-closed**; the
  registry RLS predicate AND the doors' authority check (never invoker-RLS — inside a DEFINER
  an invoker EXISTS would run as owner, fail-open). No `is_admin()` anywhere: platform_admin
  reads 0 rows, mints/opens/revokes nothing (D11 noun rule; keystoned).
- **Doors** (authenticated+service_role; census verdicts COVERED, 2026-08-07):
  `mint_printed_document(p_id, kind, source, template_key, template_version, content_hash,
  token, short_code, contains_phi)` — authority = the dispatch; PHI refused in P1 (`HC0D2`);
  format-validates the action-minted credentials (Amendment A; collision `HC0D4` → the action
  re-mints); verifies the storage OBJECT exists first (Amendment B, `HC0D3`); supersedes prior
  actives in-transaction; audits `document.minted`. `open_printed_document(p_id)` — the serving
  route's core: call-time authority, no-row-no-audit on deny, audits `document.downloaded`
  (`overlay_applied` computed in-door). `revoke_printed_document(p_id, class, reason)` —
  staff_admin/commission-admin chain only, NOT the minter; `HC0D1` validation, `HC0D5`
  already-revoked; audits `document.revoked`. `lookup_printed_document(credential, p_viewer)` —
  **EXECUTE service_role ONLY** (the app-layer rate limiter in
  `src/lib/queries/printed-documents.ts` fronts the only call path); anemic D10 tuple;
  `document_id` only for a source-visible `p_viewer`; writes the scan log.
- **Storage:** bucket `printed-documents` (private, 25 MB, `application/pdf`,
  prefixes `std/` now + `phi/` from P3) with **ZERO storage.objects policies** — service-role
  only; the serving route `/api/documents/[id]` is the ONLY byte path (D8), applying the
  pdf-lib `SUBSTITUÍDO`/`ANULADO` overlay on non-active serves (canonical bytes stay
  hash-faithful; `active` serves are byte-identical).
- **App layer:** pure renderer `src/lib/pdf/` (ESLint `no-restricted-imports` purity gate;
  embedded IBM Plex data-URI faces via `scripts/generate-pdf-fonts.mjs`; template
  fingerprints per D4 in `template-fingerprints.ts` + proven-detecting test); providers
  registry `src/lib/pdf-mint/providers.ts` (P1: `form_response` only; unregistered kind fails
  closed); mint pipeline `src/lib/pdf-mint/actions.ts` (3-permit semaphore, 30 s Gotenberg
  budget, upload-before-RPC + delete-on-failure — all-or-nothing D5); provider
  `src/lib/forms/pdf-payload.ts` (caller-session Rule 9 reads; wizard-mirror visibility via
  `evalVisibility`; signoffs → attestation blocks D13). Sidecar: pinned
  `gotenberg/gotenberg:8.24.0`, `PDF_RENDERER_URL` + `PDF_VERIFICATION_BASE_URL` env —
  runbook `docs/deployment/pdf-renderer.md`.
- **SQLSTATEs:** `HC0D1` validation · `HC0D2` PHI-mint refused · `HC0D3` storage object
  missing · `HC0D4` credential collision (retry signal) · `HC0D5` already revoked ·
  authority `42501` · flag-off `check_violation`. **No `P0002` anywhere** (since
  `20260913000400`, QA MINOR-4): not-found is indistinguishable from denial by design —
  revoke MERGES it into the 42501 raise, open returns no-row-no-audit, lookup answers
  `matched=false`. No door is an existence oracle.
- **Tests:** pgTAP `312_printed_documents.sql` (73; fail-closed ELSE + platform_admin denial
  keystones; A33 drills D1–D6 RED-proven); Vitest fingerprint/overlay/semaphore/lookup
  (`p_viewer` declared-param pin + rate-limit pin); e2e smoke
  `scripts/smoke/pdf-mint.smoke.ts` (`vitest.smoke.config.ts`; needs stack + sidecar).
- ⚠ `hospitals_select` has NO member arm (catalog, 2026-08-07) — letterhead names resolve via
  the caller-pre-authorized service-role read in `getResponsePrintContext` (step 1 proves
  source visibility under the caller's own RLS; step 2 reads two display names). If a member
  arm ever lands on `hospitals`, that helper can collapse to one query.

## Migrations (forward-only, additive)

> **This table is a HISTORICAL index and stops at E1 (`20260720001070`).** From DOC-REDESIGN /
> E2 / RV2 / CH / FF-1 / FF-2 onward each phase documents its own migration RANGE in its `##`
> section header above, and the per-migration detail lives there. Do not add rows here for a new
> phase - add a section. **And never read either as the truth**: some migrations rewrite live
> function bodies at runtime (`pg_get_functiondef` + `replace` + `execute`), so the catalog
> (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_constraint`, `pg_trigger`, the ACLs) is the
> only authority (CLAUDE.md graphify exception).

| Range | Phase | What landed |
| ----- | ----- | ----------- |
| `…100001–100003` | 1 | Core schema: profiles trigger, commissions, members, forms, versions, sections, items; admin claim (access-token hook, ADR 0002). |
| `…100004` | 1 | Response lifecycle: responses, answers, signoffs; published + submitted immutability triggers; display-item answer-rejection trigger. |
| `…100005` | 1 | Condition evaluator + `submit_response` + publish validation. Sign-off check feature-flagged OFF (ADR 0004). |
| `…100006–100007` | 1 | Full RLS policy set + helpers; `form-assets` Storage bucket policies. Deny-by-default. |
| `…100008` | 1 | QA loop-back RLS hardening (staff_admin UPDATE role-restricted; `eval_condition` search_path pinned; profiles no-delete; version↔commission guard). |
| `…100009` | 3 | Denormalized `profiles.email` (citext, nullable) + sync triggers (ADR 0010). |
| `…100010` | 4 | Builder RPCs + deferrable position uniques (ADR 0011); repaired `form_versions` insert RLS (ADR 0013). |
| `…100011` | 5 | Response-fill RPCs (ADR 0015). |
| `…090001–090003` | 6 | Sign-off: flag flip + cross-version guard (P0013); sign-off RPCs; definer read path (ADR 0016). |
| `…090004–090007` | 7 | Multi-phase cases (ADR 0017): 4 tables (`process_templates`, `process_template_phases`, `cases`, `case_phases`) + `responses.case_phase_id` bridge + reworked unique indexes; per-commission case-number minting + case/phase state-machine guards (`app.in_case_rpc`); template/case RPCs; submit trigger + recompute; **submitted-only** `case_phase_answer_map`; definer board reads; RLS (members read / staff_admin write). Evaluator REUSED unchanged. |
| `…090008` | 7 | Flag flip: `cases_multi_phase` → **ON** (mirror `…090001`). The feature is live; the Phase-7 ship state. |
| `…090009` | 7 | P7-002 fix: custom SQLSTATE class `P00xx` → **`HC0xx`** (ADR 0018). `CREATE OR REPLACE`s `submit_response`/`save_section_answers`/`sign_section` (committed Phase 5/6) with `HC010`–`HC015`; the unshipped `090005`/`090006` carry `HC016`–`HC022` in place. Restores `error.code` discrimination on PostgREST 14 (unknown class → 400/JSON). |
| `…090010` | maint | Default (anchor) section may carry a title + builder rename (ADR 0019). |
| `…090011` | 8 | Dashboard aggregation: 5 definer RPCs (`dashboard_distributions`/`_free_text`/`_submissions_over_time`/`_completion_by_member`/`_form_totals`) + `commission_overview`; helpers `app.submitted_form_responses` (canonical submitted+standalone filter) + `app.latest_published_version`. `is_staff_admin_of OR is_admin`-gated, `search_path` pinned (ADR 0020). |
| `…090012` | 8 | B6: revoke anon **and PUBLIC** DML/EXECUTE on `public` (+ default-priv revokes). auth/storage/realtime untouched. |
| `…090013` | 8 | `dashboard_export_rows` definer RPC (CSV export, standalone submitted-only). |
| `…090014` | 8 | B6 follow-up: revoke the re-inherited PUBLIC EXECUTE on `dashboard_export_rows` + durable `alter default privileges … revoke execute on functions from public`. |
| `…090015` | 8 | QA MINOR-1/2: date params (`p_from`/`p_to`) added to `dashboard_export_rows` + `dashboard_form_totals`. |
| `20260614091000` | 7 (post) | Case-phase **due dates** (ADR 0021): additive cols `process_template_phases.default_due_days` (int, nonneg) + `case_phases.default_due_days` (snapshot copy at case creation) + `case_phases.due_date` (date). Trailing optional params appended: `add_template_phase(+p_default_due_days)`, `update_template_phase(+p_default_due_days,+p_clear_default_due_days)` (clear/replace/keep, mirrors `recommend_when`), `activate_phase(+p_due_date)` (set under existing `app.in_case_rpc`). `create_case_from_template` snapshots the slot default; `list_cases_board` exposes `due_date`, `get_case_detail` exposes `due_date`+`default_due_days`. No new RLS/SQLSTATE; evaluator untouched. |
| `20260614091001` | 7 (post) | `reassign_phase(+p_due_date)` overload (ADR 0021). |
| `…092000` | Extras (R2) | **Configurable case status** (ADR 0023): `public.case_status_defs` (per-commission vocab; unique key + DEFERRABLE unique position + partial-unique single non-archived `is_initial`); RLS member-read/staff_admin-write; `app.case_status_is_terminal(commission,key)`; `app.seed_default_case_statuses()` + AFTER INSERT trigger on `public.commissions`; **dropped `cases_status_check`** (no row remap, from-scratch reset). |
| `…092001` | Extras (R2) | `cases.status` default → `em_andamento`; **rewritten `app.guard_case_status`** (configurable: HC024 undefined key / HC025 terminal-frozen; any non-terminal→any-defined); **liveness sweep** — `'aberto'` literal → `app.case_status_is_terminal(...)` across `sync_case_phase_on_submit`/`activate_phase`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`create_case_from_template`; `app.apply_case_status` DEFINER core + `set_case_status`; `close_case`/`cancel_case` → thin wrappers (gate only `cases_multi_phase`); status CRUD + `list_case_status_defs` (definer); `cases_extras` flag (OFF) + `app.assert_extras_enabled()`. Re-revoked anon/PUBLIC EXECUTE on every public fn created/replaced (+ closed a 091000/091001 leak). |
| `…092002` | Extras (R1) | **Documents & events:** `public.case_documents` (soft-delete `deleted_at`/`deleted_by`; unique `storage_path`) + `public.case_events` (edit + hard-delete); RLS member-read/staff_admin-write via `app.commission_of_case`. `public.cases_extras_enabled()` DEFINER read (TS-layer gate for the R1 direct-table-write actions). |
| `…092003` | Extras (R1) | **`case-documents` Storage bucket** (private, 25 MiB, MIME allow-list PDF/images/Word/Excel/CSV/plain); path `{commission_id}/{case_id}/{uuid}.{ext}`; member-read / staff_admin-insert / NO update/delete (immutable, clone of `form-assets`). |
| `…092004` | Extras (R3) | **Tagging:** `public.case_tags` (unique(commission,name)) + `public.case_tag_assignments` (PK (case,tag)) + `app.guard_case_tag_assignment` BEFORE INSERT (**HC026** mismatch); RLS member-read/staff_admin-write; RPCs `create/rename/archive_case_tag` + `assign/unassign_case_tag` (gate `cases_extras`); `case_tag_report(commission,from?,to?)` DEFINER/gated, counts on `cases.created_at::date`. |
| `…092005` | Extras (R4) | **Action items:** `public.case_action_items` (status open/in_progress/done/cancelled; `source_case_phase_id` ON DELETE SET NULL); RLS member-read/staff_admin full-write; authoring RPCs `create/update_action_item`; lifecycle via `app.advance_action_item_core` (DEFINER, assignee OR staff_admin gate → **HC027**) behind `advance/complete_action_item`; hard-delete via RLS; `case_action_items_kpis(commission)` DEFINER/gated (open/overdue/completed-YTD). |
| `…092006` | Extras | Flag flip: `cases_extras` → **ON** (mirror `…090008`). |
| `…093000` | Case-model | **DROP the R2 configurable status** (ADR 0024 / D12): `case_status_defs` (+ policies) + the status CRUD/`set_case_status`/`apply_case_status`/`case_terminal_key`/`case_status_is_terminal`/`slugify_status_key`/`unaccent_fallback`/`seed_default_case_statuses` + the `seed_case_statuses_on_commission_insert` commission trigger. No cascade (fails loud on a stray dependent). `guard_case_status` kept (its trigger stays) — rewritten in 093001. |
| `…093001` | Case-model | **Fixed auto-computed status** (D6/D7): defensive normalize → `cases.status` fixed 5-value CHECK (`nao_iniciado`/`em_revisao`/`pendente`/`concluido`/`cancelado`), default `nao_iniciado`; `app.recompute_case_status` + AFTER-trigger on `case_phases`; `guard_case_status` rewritten (validity → CHECK; HC025 terminal-frozen). **Liveness-sweep landmine:** re-`CREATE OR REPLACE` `sync_case_phase_on_submit`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`cancel_case` with a fixed-enum terminal check (`activate_phase`→093002, `create_case_from_template`/`close_case`→093003 — one final def each). `cancel_case` anytime + terminal-first. Re-revoke anon/PUBLIC. |
| `…093002` | Case-model | **Phase blockers** (D1/D4): `blocks integer[]` on `process_template_phases` + `case_phases` (`not null default '{}'`); `app.guard_phase_blocks_shape` BEFORE INS/UPD (earlier-only → HC016) + `app.validate_template_phase_blocks` (deep "position exists" → HC016); `set_template_phase_blocks`; `add/update_template_phase` gain `p_blocks`; `reorder/remove_template_phase` remap the `blocks` arrays across the renumber **in a single atomic UPDATE per row** (shape trigger sees no transient forward-ref); `activate_phase` FINAL — blocker gate (HC018 reworded) replaces strict-sequential, parallel-safe. Re-revoke anon/PUBLIC. |
| `…093003` | Case-model | **Outcomes** (D8–D11/D15): `case_outcomes` (per-commission vocab) + `process_template_outcomes` (offered set, `app.guard_process_template_outcome` → **HC030**) + `case_offered_outcomes` (per-case FROZEN snapshot) + `cases.outcome_id` (single FK, `NO ACTION`); RLS member-read/staff_admin-write on all three. RPCs `set_case_outcome` (HC025/HC029), `set_process_outcomes`, outcome CRUD (`create/update/reorder/archive_case_outcome`); **`close_case` FINAL = D3 conclude gate** (HC031 unsettled / HC028 outcome-required, terminal-first); `create_case_from_template` FINAL also snapshots `blocks` + copies `process_template_outcomes`→`case_offered_outcomes`; `list_cases_board` (DROP+recreate, return-shape changed) + `get_case_detail` gain answer-free outcome metadata + per-phase `blocks`. Re-revoke anon/PUBLIC. |
| `…090000` | 10 | **Meetings core** (ADR 0025): `meetings` (per-commission `meeting_number` mint; lifecycle CHECK `agendada/realizada/em_assinatura/assinada/distribuida/cancelada`; conclusion quorum-snapshot cols) + `commission_meeting_types` + `commission_meeting_settings`; `app.guard_meeting_status` (state-machine + content-freeze ≥`em_assinatura`, gated `app.in_meeting_rpc`); `app.mint_meeting_number`; `app.commission_of_meeting`; `meetings` flag (OFF) + `app.assert_meetings_enabled()` + `public.meetings_enabled()`. |
| `…090001–090005` | 10 | Children + signatures + RLS + storage + seed: `meeting_agenda_items`, `meeting_attendees` (platform user XOR external guest; partial-unique `(meeting,user)`), `meeting_cases` (same-commission guard → **HC032**), `meeting_action_items` (denorm `commission_id`); `app.guard_meeting_child_lock` (keys on PARENT status, NOT the flag); `meeting_signatures` (partial-unique on `status='signed'`); full RLS (member-read/staff_admin-write; `app.can_sign_meeting` sign-own-row); `meeting-attachments` bucket (private, immutable) + `meeting_attachments` (soft-delete); `app.seed_default_meeting_types` + **fresh** AFTER INSERT trigger on `public.commissions`. |
| `…090006–090007` | 10 | RPCs: lifecycle (`create/update/conclude/reopen/distribute/cancel_meeting`); agenda/attendee CRUD + reorder + `seed_expected_meeting_attendees`; `link/unlink_meeting_case`; attachment insert + soft-delete; `sign_meeting` (DEFINER; `content_hash`; auto-flip → `assinada`); action-item CRUD + advance/complete (**HC037**); `my_pending_meeting_signatures` (DEFINER). `…090007`: F5 settings RPCs (`create/rename/archive_meeting_type`, `update_meeting_settings`). |
| `…090008` | 10 | Flag flip: `meetings` → **ON** (mirror `…090008` cases pattern; enabled in-phase so the gate tests live). |
| `…090009` | 10 | `mark_meeting_held(meeting)` — `agendada→realizada` (makes the `realizada` resting state reachable; `conclude_meeting` still accepts agendada as a shortcut). |
| `20260615091000` | 11 | **Interviews core** (ADR 0026): 4 tables (`case_interviews` denorm `commission_id` + per-commission `interview_number` mint `app.mint_interview_number`; lifecycle CHECK `rascunho/agendada/em_andamento/concluida/cancelada`; `app.guard_interview_status` state-machine + content-freeze ≥`concluida`, gated `app.in_interview_rpc`; `app.guard_interview_links` commission-honesty + phase-in-case; `case_interview_subjects` free-text `clinical_role`, `case_interview_interviewers` fixed-enum role, both `user_id` XOR `external_name` + partial-unique; `case_interview_attachments` `storage_path` XOR `external_url` + https CHECK + 4-value `kind` taxonomy + soft-delete; `app.guard_interview_child_lock` freezes subjects+interviewers ≥`concluida`, **attachments excluded**). NEW RLS helpers `app.commission_of_interview` + `app.can_write_interview(interview,uid)` (DEFINER, uid-pure via NEW `app.is_staff_admin_of_for`/`app.is_admin_for`). `case_events.kind` CHECK widened (`case_events_kind_check` drop/recreate) → adds `'interview'`. `interviews` flag (OFF) + `app.assert_interviews_enabled()` + `public.interviews_enabled()`. |
| `20260615091001` | 11 | **Interviews RPCs** (16 fns): lifecycle `create/update/update_summary/schedule/start/conclude/reopen/cancel_interview`; subject + interviewer CRUD (registered interviewer member-check → **HC021**); attachment insert (file XOR link, **HC040**) + soft-delete; `public.interview_viewer_can_write(interview)` (DEFINER read for the query layer's `viewerCanWrite`). All DEFINER; set `app.in_interview_rpc`; authorize via `app.assert_interview_writable` (→ **HC039**) except create (staff_admin bootstrap, 42501). `conclude_interview` requires ≥1 subject (**HC041**) + insert-or-update the `case_events kind='interview'` row via stored `registry_event_id` (no duplicate on re-conclude). Re-revoke anon/PUBLIC. |
| `20260615091002` | 11 | **Interviews RLS**: `case_interviews` SELECT member / INSERT staff_admin / UPDATE+DELETE `can_write_interview`; 3 child tables SELECT member-of-`commission_of_interview` / write `can_write_interview` (FOR ALL). Each ORs `app.is_admin()` for the live JWT-claim admin path alongside the uid-pure `can_write_interview`. |
| `20260615091003` | 11 | **`interview-attachments` Storage bucket** (private, 25 MiB, PDF/images/Office/CSV/txt — **NO audio**); path `{commission_id}/{interview_id}/{uuid}.{ext}`; SELECT member (seg [1]); **INSERT keyed on seg [2]=interview_id via `app.can_write_interview`** (so a registered interviewer uploads); NO update/delete (immutable, Rule 6). |
| `20260615091004` | 11 | Flag flip: `interviews` → **ON** (mirror `…090008`; enabled in-phase so the gate tests live). |
| `20260617120000–120004` | 13 | **Audit Trail** (ADR 0029): `public.audit_log` (per-commission **+ global** SHA-256 hash chains; `seq`/`prev_hash`/`row_hash`; nullable actor/commission) + `app.guard_audit_immutable` (BEFORE UPD/DEL → **HC042**, absolute incl. `service_role`) + `app.audit_write` DEFINER writer (advisory-locked per chain; `app.jsonb_canonical`/`app.audit_canonical` cover ALL semantic cols; no-op while flag OFF; null-actor=system) + 13 AFTER INS/UPD/DEL triggers on the curated table set (forms/versions/sections/items, commission_members, commissions, responses status-flips, signoffs, cases+case_phases status, meetings+signatures, interviews) with **non-sensitive column allow-lists** (never `answers.value`/`*_md`/free-text/PHI) + RLS (SELECT = admin OR `is_staff_admin_of`; **no INS/UPD/DEL policy**; zero anon/PUBLIC) + `verify_audit_chain(commission?)` DEFINER + `log_audit_access` DEFINER (positive allow-list `response.opened_foreign`/`response.exported`/`audit.exported`; rejects mutation verbs) + `audit_trail` flag flip **ON** (`…120003`). Establishes Architecture Rule 11. |
| `20260618121000–121005` | 14a | **Patient-Safety / NSP — first PHI** (Architecture Rule 12; ADR 0030/0031): `pqs_department` (singleton) + `patient_safety_event` (per-NSP `EV-%04d` global-advisory-lock mint) + state machine `app.guard_event_status` (**HC043** wrong-state / **HC044** not-current-custodian, freeze@triaged, gated `app.in_safety_rpc`) + `case_events.kind += 'safety_event'` [121000]; **isolated PHI** `event_patient` (PK=event_id, tightest RLS) + append-only `event_custody` (+ `app.guard_event_custody` → HC043; partial-unique open interval) + **access-follows-custody** `app.can_read_event(event,uid)` SELECT policies on all 3 (current custodian OR reporting-provenance OR PQS/admin; **no write policy** — DEFINER-only) [121001]; 6 mutation RPCs + `pqs_inbox` (PHI-free) DEFINER + 3 PHI-free mutation-audit triggers [121002]; `patient_safety` flag **ON** [121003]; `event_patient.read` added to `log_audit_access` allow-list [121004]; `pqs_department` SELECT `to authenticated` (QA M1) [121005]. |
| `20260618121100–121103` | 14b | **Triage & Disposition** (ADR 0030): `event_triage` (1:1 with event; fixed reach(5)/harm(6) enums; cross-field rules — non-harmful reach→harm `none`, sentinel reach→harm floored `severe`) + `event_triage_sentinel_flags` + configurable `pqs_sentinel_criteria`/`pqs_event_types` (JC/WHO seeds) + `pqs_department.rca_default_due_days`; `app.guard_event_triage` freeze guard (**HC045** frozen-worksheet / **HC046**, gated `app.in_safety_rpc`); DEFINER RPCs `save_triage`/`confirm_triage` (freezes event@`triaged` + mints the `rca` shell when pathway=rca; non-PSE→`closed`)/`reopen_triage` + sentinel/event-type vocab CRUD + `triage_disposition` (computes PSE→reach→harm→sentinel→verdict + 45-day RCA due date; **bare-`event_id` 42702 fixed → `event_triage.event_id`**) + `set_pqs_rca_due_window` (audits `pqs_config.rca_due_window_changed`); RLS event-scope read / PQS-write; PHI-free mutation audit. |
| `20260618121200–121202` | 14c | **RCA Workspace** (ADR 0030): `rca` (1:1; status `draft`→`in_progress`→`in_review`→`completed`) + `rca_members`/`rca_timeline_entries`/`rca_evidence`/`rca_factors`/`rca_why_chains`/`rca_root_causes`; `app.can_write_rca` DEFINER (PQS/admin OR assigned non-observer; mirrors `can_write_interview`; observer read-only → **HC048**) + completed-freeze child-lock (**HC047**); full RPC set (problem statement / fishbone factors + key-flag / 5-Whys steps+root / root causes / timeline / evidence [link+citation to interview] / members + submit/complete/reopen, audited); **immutable `nsp-evidence` Storage bucket** (Rule 6; no UPDATE/DELETE policy). |
| `20260618121300–121302` | 14d | **CAPA & Closure** (ADR 0030): source-polymorphic `capa_plan` (`source ∈ {rca,event,…}`, exactly-one-source CHECK, Phase-15 `source_indicator_id` FK NULL-safe; status `em_execucao`/`em_verificacao`/`concluido`/`cancelado`) + `capa_action` (JC strength) + tasks/evidence/measures/results/`capa_effectiveness`; `app.guard_capa_status` state-machine + child-lock (**HC049** frozen-plan); RPCs `open_capa_plan` / action CRUD / `advance`+`complete_capa_action` (assignee-or-PQS narrow DEFINER → **HC050**) / measures+results / `record_capa_effectiveness` / `close_capa_plan` (conclude gate **HC051** open-action / **HC052** no-effectiveness, terminal-first) / `cancel` / `reopen` (revokes effectiveness) / `capa_kpis`; close→`event` auto-close chain (`event_capa_fully_settled`); **HC053**; reuses `nsp-evidence` bucket; seed open `CAPA-0001`. |
| `20260620013000–016000` | 22 | **Inter-Committee Case Referrals** (ADR 0037; flag `case_referrals`, ships **OFF**). `…013000`: **7 tables** — `referral_types`/`reply_outcomes` (seeded vocab, any-auth read / `is_admin` CRUD) + `case_referral` (lifecycle; PHI-free `subject`/`status`; global `ENC-%04d` seq via BEFORE-INSERT trigger; 8-value status CHECK) + `referral_shared_item` (frozen snapshot; one-of `kind` narrative⇒`frozen_body_md`/document⇒`frozen_storage_path` Rule-6 ref) + **`referral_patient`** (⚠ isolated PHI, PK=referral_id, modeled on `event_patient`) + `referral_reply` (⚠ `result_md`) + `referral_reply_attachment`; predicates `can_read_referral` (broad) / `can_read_referral_phi` (tight) / `referral_target_analyst` / `can_manage_referral_source|target` / `can_read_snapshot_document`; guards `guard_referral_status` (**HC070**) / `guard_referral_snapshot_lock` (**HC073**) / `guard_referral_reply_lock` (gated `app.in_referral_rpc`); audit triggers `trg_audit_referral` + `trg_audit_referral_patient` (empty metadata); RLS (vocab any-read/`is_admin`-write; `case_referral` `can_read_referral`/source-coord-insert/coord-update/draft-source-delete; **shared_item + reply SELECT = `can_read_referral_phi`** […015000]); **`referral-attachments` bucket** (immutable) + the flag-gated `case-documents` snapshot OR-term (`can_read_snapshot_document` — RLS-consistent, **no service-role**); grants + **`REVOKE ALL ON referral_patient FROM authenticated`** + vocab seed. `…014000`: **21 RPCs** (below) + cross-cutting `CREATE OR REPLACE` of `close_case` (HC076 gate), `app.can_read_case` (QPS term before the `case_access` fallback, no target leg), `log_audit_access` (+`referral_patient.read`/`referral.viewed`). `…015000`: PHI-body tighten — `frozen_body_md`/`result_md`/`description_md` follow `can_read_referral_phi`; `get_referral_detail` nulls bodies for metadata-only readers; `referral.viewed` fires on a body-serve to any non-source-coordinator (incl. QPS). `…016000`: column-level **`REVOKE SELECT ON case_referral` + `GRANT SELECT(25 PHI-free cols)`** so `description_md`/`decline_note` are not directly selectable; door gates both. **HC070–HC07A**. pgTAP `150_referrals.sql` (40 assertions); full suite **705/705**. |
| `20260619110000–110004` | Case-Access | **Case Access Control** (ADR 0033): per-case ACL `public.case_access` (PK (case,user); `level read\|write`; DEFINER-write only; SELECT coordinator+self) + `case_narratives` assignee/lifecycle cols (`assigned_to`, `status aberta\|concluida`, `concluded_at/by`); 3 uid-pure DEFINER predicates `app.can_read_case` (coordinator OR grant OR phase/narrative assignee; **flag-OFF fallback to `is_member_of`**) / `can_write_case_content` / `can_write_case_narrative` (Q14: assignee OR write-grant-on-unassigned) + `public.case_viewer_capabilities`; **SELECT tighten** `is_member_of → can_read_case` on cases/case_phases/case_narratives/case_action_items/case_documents/case_events/case_tag_assignments/case_offered_outcomes (vocabularies `case_tags`/`case_outcomes` NOT tightened); additive `can_write_case_content` WRITE policies (USING+WITH CHECK on `case_id`) on case_documents/case_events; RPCs `grant/revoke_case_access`, `assign/unassign_narrative`, `save_narrative_body` (Q14; legacy `update_case_narrative_body` kept), `conclude/reopen_narrative`, `list_my_cases`; `get_case_detail` **VOLATILE** re-gate → `can_read_case` (+`viewer_capabilities`, +narrative assignee/status; **submitted-only preserved**) + `case.opened` audit (`log_audit_access` allow-list); content-write broadening (action-items/tags → DEFINER `can_write_case_content`); meetings ripple `MeetingCaseLink.restricted` → "Caso restrito"; `case_access` flag **ON** (`…110004`); **HC055**. Gate APPROVED 2026-06-19 (fix-loop: CA-001 `get_case_detail` STABLE→VOLATILE; CA-002 FE Q14 ordering). |
| `20260620017000` | `case_patient` | **Case patient identifiers — THIRD PHI module** (ADR 0038; flag `case_patient`, ships **OFF**). Isolated `public.case_patient` (PK=case_id, FK→cases CASCADE, **all DML REVOKEd from authenticated**, RLS SELECT on `can_read_case_patient`) modeled field-for-field on `event_patient`. `cases` += `has_patient`/`patient_enabled`/`phi_disposed_{at,by,reason}` (+reason CHECK); `process_templates` += `collects_patient`. `app.can_read_case_patient` = thin wrapper over the **LIVE broad `can_read_case`** — **deliberately looser** than the staff_admin+PQS `can_read_event_patient`/`can_read_referral_phi` (assignees need the MRN); **writes stay coordinator-only**. DEFINER **RPCs**: `set_case_patient` (coordinator gate 42501; asserts `patient_enabled`; post-dispose freeze; name-or-MRN floor in the action layer; maintains `has_patient`) / `get_case_patient` (the SINGLE audited door → `case_patient.read`, NULL out-of-scope/absent, empty metadata; **broad** read scope) / `dispose_case_phi` (LGPD erasure: staff_admin/admin; one-shot **HC056**; reason enum; deletes identifiers + redacts `case_narratives.body_md`/`case_events.body`; preserves skeleton+audit; emits `case_patient.disposed`) / `set_template_collects_patient` (draft-only) / `case_patient_enabled()` (TS flag read). `create_case_from_template` + `get_case_detail` **CREATE OR REPLACE** (additive: snapshot `patient_enabled`; echo the 2 flags). `log_audit_access` replace carries the full allow-list forward + `case_patient.read`. Audit trigger `trg_audit_case_patient` (`{}` metadata). pgTAP `151_case_patient.sql` **35/35**; E2E `case-patient.spec.ts` 15/15. |
| `20260623120000–140000` | `form-builder` | **Form Builder Enhancements** (ADR 0040; **additive, NO flag** → live on remote). `…120000`: 4 new `form_items.item_type`s (`short_text`/`number`/`date`/`time`; input-arm + options-IS-NULL arm); `form_items` += `config jsonb` (number/date min/max) + `visible_when jsonb` + CHECK `form_items_conditional_not_required`; `form_items_options_shape` relaxed to bare-string OR `{label,color}` via `app.is_valid_options`; `form_sections_visible_when_shape` → `app.is_valid_visibility`; `answers` += `observation text`. Helpers `app.is_valid_visibility`/`is_valid_options`/`eval_visibility` (group ALL/ANY over `eval_condition`, IMMUTABLE/search_path-pinned). `eval_condition` += `gt/gte/lt/lte` (both-number⇒numeric else text; mirrored TS `conditions.ts` via `condition-vectors.json` + new `visibility-vectors.json`). `validate_visible_when` walks group-shaped **section** (earlier-section) + **item** (earlier doc-order tuple) conditions; `app.assert_condition_op_target` enforces op↔target-type. `submit_response` per-item visibility forward-pass (`v_eff`, hidden-key drop + stray clear) + present-only number/date min/max → **HC061**. `clone_form_version` copies `visible_when`+`config`. `save_section_answers` DROP+CREATE 5-arg (`+p_observations`). `…130000`: `get_response_for_signoff` += `observations_by_item` (DEFINER gating UNCHANGED). `…140000`: `assert_condition_op_target` additionally requires `jsonb_typeof(value)='number'` for number targets (publish-time guard behind the FE number-value coercion). New RLS: none (additive cols inherit policies). pgTAP `20_conditions`/`51_item_visibility_validation`/`52_submit_item_visibility` → full **870/870**; E2E `form-builder-enhancements.spec` 15/15. *(Table gap: `…018000–022000` — case_patient_enable / patient_index / phase_results — predate this row, not yet tabulated here.)* |
| `20260630000000` | NSP-per-org | **Bind the PQS roster + every PHI door to an ORGANIZATION** (ADR 0042; **structural, NO flag**; **NOT additive** — `pqs_members` PK change; greenfield reseed). Lifts ADR 0041 amd-10's interim `is_multi_org()` guard for real; single-org stays byte-identical. **Schema:** `organization_members.role` CHECK widened → `{org_admin, nsp_coordinator}` (the appointment seam; no policy change — `organization_members_write` keys on org, not role); `pqs_department` singleton → **per-org** (drop `singleton` col/CHECK/idx; +`organization_id` FK + `UNIQUE(organization_id)`); `pqs_members` global → **per-org** (`PK(user_id)` → `PK(organization_id, user_id)` + `INDEX(user_id)`); `patient_safety_event` `UNIQUE(code)` → `UNIQUE(reporting_commission_id, code)` (per-org EV can repeat across orgs). **Predicate primitives** (all STABLE DEFINER, mirror `is_org_admin_of`): `app.is_pqs_member_of[_for](org[,uid])` (the workhorse; PK point-lookup), `is_nsp_coordinator_of[_for]`, `is_pqs_writer_of(org)`, `is_pqs_member_of_any(uid)` (nav + **global-vocab** gate) + org-resolvers `org_of_{commission,event(reporting_comm),referral(source_comm),capa_action}`. **RLS:** `pqs_members_admin_all` → `pqs_members_coordinator_all` (`is_nsp_coordinator_of(org)`; **no platform/org_admin escape hatch** — duty separation). **Doors rebound** (PQS term → per-org, `is_multi_org` deleted): 9 read predicates (`can_read_event[_patient]`/`can_read_capa`/`can_write_rca`/`event_current_custodian`/`can_read_referral[_phi]`/`can_read_case[_patient]` QPS-term-only); 8 CAPA writes consolidated behind `app.can_write_capa(capa,uid)` (event/rca-sourced → per-org; indicator/audit/meeting/manual → **any-org**, no event PHI); `pqs_inbox` org-scoped result set; NSP lifecycle RPCs (`save/confirm/reopen_triage`, `triage_disposition`, `add_rca_member`, `open_capa_plan`, `advance_capa_action_core`, `assert_capa_writable`) → per-org via event; **vocab CRUD** (`*_event_type`/`*_sentinel_criterion` ×8) → `is_pqs_member_of_any` (vocab stays GLOBAL); `dispose_event_phi` **both** arms org-scoped (`is_admin` → `is_org_admin_of_commission`, PQS → per-org; ADR 0041 amd-11); per-org `mint_event_code` (per-org advisory lock + per-org `max(suffix)`; **ENC stays global**); `patient_safety_enabled`/`referrals_enabled`/`assert_*` → flag-only. **Roster RPCs** (DROP old arity → recreate): `add/remove_pqs_member(org,user)` + `list_pqs_members(org)` **coordinator-gated**; `set_pqs_rca_due_window(org,days)` coordinator-or-member + audits at **ORG tier** (`p_organization`). **Probes:** `is_pqs_member_self()` KEPT = `is_pqs_member_of_any` (nav); +`is_pqs_member_of_self(org)` + `is_nsp_coordinator_of_self(org)`. **Storage:** only `capa_evidence_obj_insert_writable` carried the bare `is_pqs_writer()` → rebound to `is_pqs_writer_of(org_of_event(seg[1]))` (the other 3 already rode rebound predicates). **patient_index (4th PHI surface):** RLS `patient_xref_select_pqs` → `can_read_xref_row(commission,uid)` (NULL-commission denies); `patient_trajectory_bundle(+p_org_id)`; `search_patient_xref(+p_org_id)`/`patient_access_audit(+p_org_id)` org-gated + org-filtered + **org-tier audit** (`patient.searched/viewed`); `get_patient_trajectory_for_entity`/`patient_xref_count` resolve org server-side. **Cross-org referrals FORBIDDEN** (`create_referral_draft` raises if source/target orgs differ; `list_referral_target_commissions` filtered to source's org). **Drops last:** `is_multi_org()`/`is_pqs_member(uuid)`/`is_pqs_writer()` (TS grep clean — only `is_pqs_member_self()` consumed, kept). Validated: `db reset --local` clean + DB probe proves cross-org PHI isolation; whole-tree typecheck green. **pgTAP A6 (tester):** `173`+`145` rewrite + 1-line `organization_id` fixture fix in `140/141/142/143/150/151/152` + signature updates — all fixture/sig mismatches, no logic regressions. **Fix-loop deltas:** BUG-NSP-001/002/003 (3 referral RPCs re-created from their TRUE canonical — `create_referral_draft`→`…626000` 6-arg, `get_referral_detail`→`…015000` PHI-body lockdown, `list_referral_target_commissions`→`…626000` gate); **M1** `patient_trajectory_bundle` → `service_role`-only (was over-granted `authenticated`); **M2** off-inventory callers of the dropped predicates rebound via a live catalog sweep (ZERO residual refs) — `capa_viewer_can_manage`→`can_write_capa`, `capa_kpis`→`is_pqs_member_of_any`; **I1 folded in** `dispose_case_phi` (case_patient module) `is_admin()`→`is_org_admin_of_commission(commission_of_case(...))` — all 3 PHI-module disposal doors now vendor-walled + org-scoped. **M3** `capa_kpis` RESULT SET org-scoped (was gate-fixed but body-not-scoped — counted all orgs' plans); no-arg, union-over-caller's-orgs (`v_orgs`). **Sub-phase B support:** `getNspAccessByOrg(orgSlug)` seam in `session.ts` (org-scoped NSP-console gate; returns null only when BOTH `isPqsMember`+`isCoordinator` false — an unenrolled coordinator IS admitted to curate); `organizations_select` RLS **broadened** (+`is_pqs_member_of(id)` +`is_nsp_coordinator_of(id)`) so a bare PQS member/coordinator can read their own org row (same additive pattern as `…628000`'s `is_org_member`; cross-org still denied). **VERIFIED (not a leak):** the referral/event QPS aggregates (`listAllReferrals`/`referralFlowMetrics`/`safety-events` lists) read via the **invoker/cookie client** under RLS (`can_read_referral`/`can_read_event`, rebound per-org) — `is_pqs_member_self()` is only the render-gate; live probe confirms `pqs.a` reads zero rede-b referrals/events. No service-role/DEFINER bypass in the QPS query layer. **B-impl + B5 fixes:** the A1 stub bodies implemented (roster `add/remove/list_pqs_members`, `getPqsDepartmentForOrg`, `searchPatientForOrg`/`getPatientAccessAuditForOrg`, `is_pqs_member_of_self`/`is_nsp_coordinator_of_self`); NEW DEFINER `list_org_eligible_users_for_pqs(org)` (org∪commission members; coordinator-OR-org_admin gate) + `listNspCoordinators` + `appointNspCoordinator`/`revokeNspCoordinator` (org_admin-gated, invoker RLS; appoint **refuses to demote a current org_admin** — org_admin/coordinator mutually exclusive per user, orphan-the-org guard); the 4 deprecated org-blind stubs DELETED (B4). **BUG-NSP-004** `advance_capa_action_core` PQS arm → routed through `can_write_capa` (the non-event any-org fallback was missing → manual-source CAPAs unadvanceable; the CAPA-gate sweep confirmed all 6 gates now handle NULL-event uniformly). **BUG-NSP-005** `commissions_select_member_or_admin` RLS **broadened** (+`is_pqs_member_of(organization_id)` +`is_nsp_coordinator_of(organization_id)`) — a PQS-only user read 0 commissions → the QPS referral dashboard's org-intersection dropped every referral; exact parity with the `organizations_select` broadening, invoker-RLS so no FE change. |
| `20260625000000–629000000` | Multi-Tenancy | **Organizations → hospitals above commissions; vendor/customer admin split** (ADR 0041; **structural, NO flag**; greenfield reseed). `…625000000` (hierarchy): new `public.organizations` (slug **globally** unique — the `/o/[org]` segment) + `hospitals` (slug unique per org, not routed) + `organization_members` (`role` CHECK = `org_admin` only — the widening seam); `commissions` += `hospital_id` + denormalized `organization_id` (BEFORE-INS/UPD trigger auto-derives org from hospital — non-app-writable, can't drift); commission slug uniqueness global → `UNIQUE(organization_id, slug)`; predicates `app.is_org_admin_of(org)`/`is_org_admin_of_commission(commission)` (+`_for`) mirroring `is_member_of`; management RLS on the 3 new tables. `…625001000`: re-REVOKE anon/PUBLIC on `add/update_template_phase` (a prior DROP+CREATE had dropped the revoke). `…626000000` (**RLS rewrite — security core**): the ~60 `OR app.is_admin()` tenant/PHI OR-terms → `is_org_admin_of_commission`; `responses_admin_all`/`commissions_*`/`commission_members_admin_all` re-scoped; `profiles_admin_select` += org-scoped term; `commission_overview()` + the 6 `dashboard_*` DEFINER RPCs re-scoped platform→org; the 8 commission-scoped storage policies swap the admin term, the 3 `nsp-evidence` drop it; **audit → 3-tier** (`audit_log += organization_id`; platform/org/commission chains + 3 partial-unique indexes; `audit_write` derives org from commission; `audit_canonical`/`verify_audit_chain` include `organization_id`; `audit_log_select` per-tier). `…627000000`: flip `commissions.organization_id`/`hospital_id` → NOT NULL (post-reseed). `…628000000`: `app.is_org_member(org)` + broaden `organizations_select` so a commission member reads **their own** org row (BUG-MT-003/004). `…629000000` (**multi-org PHI guard**): `app.is_multi_org()` = `(count(*) from organizations) > 1`; `app.is_pqs_member` returns false in multi-org → the **entire** global-PQS/QPS PHI surface (NSP + referrals) goes inert at one chokepoint; per-predicate `and not is_multi_org()` defense-in-depth on `can_read_event[_patient]`/`can_read_referral_phi`/`can_read_case[_patient]`; `patient_safety_enabled()`/`referrals_enabled()` return false + `assert_*_enabled()` raise in multi-org. pgTAP `170_multitenancy_hierarchy` + `171_cross_org_isolation` (74) + `173_multi_org_phi_guard` (18) → full **1029**; E2E `phase-multitenancy.spec` 24 + suite 292/0 (124 NSP/referral skips by design). |
| `20260630000007` | Cases/Meetings minor | **Small additive batch** (ADR none — routine). **A1:** new `public.list_case_access(p_case) → table(user_id, level)` DEFINER, **mirrors `grant_case_access` authz exactly** (`assert_case_access_enabled` flag gate + `is_staff_admin_of`/`is_org_admin_of_commission`; else 42501) — a coordinator/admin-only, flag-respecting read of ALL `case_access` grant rows (the per-row `case_access_select` RLS policy also lets a non-coordinator see their OWN row + ignores the flag, so the DEFINER door is the clean fit). Config not PHI → no audit row (precedent: grant/revoke emit none). Exposed as `listCaseAccessGrants(caseId) → CaseAccessGrant[]`. **A2:** `case_events` += `occurred_time time` (nullable; `occurred_at` stays date) — threaded through the **direct-table** create/update server actions (`documents-actions.ts`, NO RPC) + `CaseEvent.occurredTime` (read normalizes `HH:mm:ss`→`HH:mm`). No new RLS. pgTAP `144_case_access` +5 (→88), `120_meetings` +1 C2-regression (→30); full suite **1160/1160**. |
| `20260620000000_baseline` | form-model-norm | **SQUASH 53→1 + Form data-model normalization** (branch `feat/form-model-normalization`; QA APPROVED; remote re-baselined). The whole prior migration set is replaced by ONE consolidated `20260620000000_baseline.sql` (schema-only `pg_dump` of the fully-migrated DB + 5 carried non-schema blocks the dump omits: storage buckets/policies, `feature_flags`+`app_secrets`, the global config vocabularies `referral_types`/`reply_outcomes`/`pqs_event_types`/`pqs_sentinel_criteria`, the two `auth.users` triggers, and the **hardened privilege posture** — pg_dump does not re-emit REVOKE-from-default ACLs, so without it anon is re-granted everything and the isolated-PHI tables + `case_referral` column-grant model re-open to `authenticated`). Equivalence proven by an EMPTY sorted pre/post `pg_dump` diff + live grant checks. **Refactor content (the same baseline):** new `form_item_options` (option rows; hidden immutable `code`, label, `color_token`, `score`, `analytics_code`, `position`; parent-must-be-choice + published-frozen; RLS member-read/staff_admin-write) + new `answer_selected_options` (per-selection hard FK; submitted-frozen; RLS mirrors `answers`); **`form_items.options` jsonb DROPPED** (+`is_valid_options`); ≥1-option now a **publish-time** check; **`answers.value` scalars-only**. `app.answer_map` rebuilt to reconstruct the SAME `question_key→code(s)` shapes (single→scalar code, checkbox→ordered array, scalars→raw) — **evaluator UNCHANGED (Rule 3)**; conditions/`recommend_when`/`result_ruleset` store option **code**, validated to exist (`app.version_has_option_code`). New/changed: `app.answer_map_by_item` (by-item_id twin); `reconcile_item_options(item, jsonb)` (atomic upsert/delete/reorder — one txn, fixes the DEFERRABLE-unique cross-txn reorder bug); `save_section_answers(+p_selections)`; `submit_response` (answered=value OR ≥1 selection); `clone_form_version` copies option rows **codes verbatim**; `case_phase_answer_map` reads normalized selections (bug fix); dashboards/export GROUP BY `option.code` + current-label resolution. pgTAP **1180/1180**, Vitest **170/170**. **↳ RE-SQUASHED again 2026-07-01 (`answer-model-v2`, ADRs 0045/0046):** the same single baseline now also folds in the two `20260701*` answer-model migrations (uniform answer row; `answer_selected_options` re-keyed → `answer_id`; typed shadow cols + `app.sync_answer_typed_values`; `answers.answered_at`/reserved `confidentiality_level`/`group_instance_id`; new inert `response_group_instances`; `form_items.default_value`/`parent_item_id`; HC080 default validation) — evaluator byte-for-byte unchanged (golden `60` intact), empty sorted pre/post pg_dump diff. pgTAP **1205/1205**, Vitest **176/176**. See the header block for the full delta. |
| `20260701000000` | ad-hoc-narratives | **Ad-hoc Case Narratives** (ADR 0047; **additive**, gated by the existing `case_narratives` flag; on top of the `…20260620000000_baseline`, to be re-squashed later). `case_narratives` += `is_ad_hoc boolean NOT NULL DEFAULT false`; `'is_ad_hoc'` added to the `trg_audit_case_narratives` allow-list (body_md/title/instructions stay OUT — Rule 11). New DEFINER RPC `public.add_ad_hoc_narrative` (see inventory) mirroring `add_ad_hoc_phase`; `REVOKE ALL FROM PUBLIC` + `GRANT authenticated, service_role` (100_dashboard t19 anon-exec guard). `get_case_detail` **CREATE OR REPLACE** — only change is `'is_ad_hoc', cn.is_ad_hoc` added to the narratives jsonb. Reverses ADR 0032 D7's "no per-case add" for **open** cases only (remove/reorder still template-authored). pgTAP `178_ad_hoc_narratives.sql` **14 assertions** → full **1219/1219**; E2E `ad-hoc-narratives.spec.ts` 5/5. |
| `20260704000000` | member-overview | **Member overview + unified "my action items"** (**additive, NO flag, NO new RLS shape** — two self-scoped DEFINER READ RPCs). `public.list_my_action_items(p_commission) → jsonb`: the caller's action items (`assigned_to = auth.uid()`) unioned across `case_action_items` (flag `cases_extras`) + `meeting_action_items` (flag `meetings`) — CAPA intentionally excluded; ALL statuses; a source whose flag is OFF is OMITTED (never errors); joins the parent case/meeting for PHI-FREE label cols only (case number/label, meeting number/scheduled_start, `created_by` name); default order due_date asc nulls last, created_at desc. `public.get_member_overview(p_commission) → jsonb`: 5 self-scoped counts + 2 hints in one round-trip — **(1)** cases-not-concluded (**PERSONAL rule**, faithful to `can_read_case` attribution: phase/narrative-assignee counts **regardless of `case_access`**; the grant leg only when `case_access` ON; excl. `concluido`/`cancelado`; needs `cases_extras`), **(2)** pending action items (open+in_progress) **+ overdue** hint, **(3)** meetings-not-concluded (attendee-scoped; agendada/realizada/em_assinatura) **+ next-start** hint, **(4)** pending signatures (mirrors `my_pending_meeting_signatures`: presente + em_assinatura + unsigned), **(5)** own `in_progress` responses. Each flag-dependent count returns 0/null when off (never raises). Both `SECURITY DEFINER`, `search_path` pinned, `STABLE`, `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` (t19 guard). **No audit rows** — self-scoped reads of the caller's own work (Rule 11). pgTAP `181_member_overview.sql` **17 assertions** (incl. the `case_access`-OFF attribution case + anon-exec denial) → full **1277/1277**. |
| `20260707000000–20260708000000` | action-items-fold | **Action-items fold + `visibility_scope` + case-access expiry** (ADR 0050; on top of the `20260706000000` shared hub; pre-launch clean reset). `…707000`: `action_items` += `visibility_scope` (committee\|case_restricted\|assignees_only) + `source_case_id` (FK cases CASCADE) + `source_case_phase_id` (FK case_phases SET NULL); old 2-value meeting-link CHECK → single 3-source `action_items_case_link_check`; `app.guard_action_item` **force-sets `case_restricted`** for source_type='case' + same-commission case/phase checks; **new `app.can_read_action_item(item,uid)`** drives the hub SELECT + BOTH satellite (`action_item_assignments`/`action_item_status_history`) policies (committee→member; case_restricted→`can_read_case(coalesce(source_case_id,linked_case_id))` [the association col `case_id` was **renamed → `linked_case_id`** by `20260818000300`]; assignees_only→assignment/assigned_to + staff_admin); the 5 `committee_*` RPCs gain `p_source_case_phase_id`+`p_visibility_scope`, branch authority by source (case create/update→`can_write_case_content` [ADR-0033-D4]; advance/complete→assignee-or-content-writer **HC027**; delete→staff_admin) + `cases_extras` gate on the case arm; `case_action_items_kpis`/`list_my_action_items`/`get_member_overview` repointed to the hub; audit `v_cols` += the 3 new cols; **DROPPED `case_action_items` table + `create/update/advance/complete_action_item` + `app.advance_action_item_core`**. `…708000`: `case_access` += `expires_at`+`reason` (nullable); expiry filter `(expires_at is null or expires_at>now())` on the grant arm of **all six** consulters (`can_read_case`/`can_read_case_patient`/`can_write_case_content`/`get_member_overview` + **`referral_target_analyst`** [feeds `can_read_referral_phi` — Rule 12] + **`list_my_cases`** both arms); `grant_case_access(+p_expires_at,+p_reason)`; `list_case_access` returns them; `trg_audit_case_access` tracks them. pgTAP **1373/0**; full E2E gate **443/41 = 0 new regressions**; QA APPROVED. **Prod-build UI refresh (BUG-AIF-001) deferred** — case actions revalidate `'page'` but the access panel loads in `(detail)/layout.tsx` → real fix is `'page'`→`'layout'` scope (systemic ~12 files, separate task; our 2 files carry the corrected PATH). |
| `20260709000000–20260710000100` | Phase A + B (hospital-admin tier, 4-tier audit, committee titles; NSP-per-hospital + nsp_org_admin) | See the capability blob above + [hospital-admin-tier.md](progress/hospital-admin-tier.md) / [nsp-per-hospital.md](progress/nsp-per-hospital.md). (Individual detail not itemized here — the prose map is authoritative.) |
| `20260711000000–20260711000800` | pre-pilot-hardening (**Wave 1**) | **8 migrations closing the 2026-07 audit critical set + do-now.** `…000000` WS-1 membership write lockdown (drop write policies, REVOKE DML, `assign/revoke_org_admin` + `add_pqs_member` patch, blanket audit triggers; HC081). `…000100` WS-2 grant hardening (audit_log REVOKE + `guard_audit_truncate` HC042; default-priv flip; `_audit_access_authorized` C-4 14-arm entitlement guard). `…000200` WS-3a `answers.form_version_id` NOT NULL + 3-col FK + `derive_answer_version` + `form_items_id_version_key_uq`. `…000300` D1 RESTRICT ×6 + D6-flip + D9 lifecycle CHECKs. `…000400` D2 tenant composite FK `commissions→hospitals` + `hospitals_id_org_uq` + `guard_hospital_org_repoint` HC082 (ADR 0054). `…000500` D7 dual-scope NSP vocab (`can_curate_pqs_vocab`, 8 CRUD RPCs, `save_triage` global∪hospital). `…000600` WS-3c CAPA tenant anchor (`capa_plan.hospital_id`, `can_write_capa` collapse, per-hospital `mint_capa_code` + UNIQUE(hospital_id,code), `open_capa_plan`+p_hospital_id HC083; ADR 0055). `…000700` WS-4 C-6 PHI-disposal closure (`dispose_case_phi` complete + `dispose_event/referral_phi` gap-fills + NEW `dispose_meeting_minutes`; `get_referral_detail` hides path+decline_note; narrowed claim ADR 0056). `…000800` WS-5 P9 indexes + 9 `(select auth.uid())` InitPlan wraps + P10 FK indexes (+ P1 `getSessionContext` cache() app-side). pgTAP `190`–`198`; **Files=65/Tests=1616**. QA APPROVED; **remote `db reset --linked` 2026-07-05**. Detail → [pre-pilot-hardening-wave1.md](progress/pre-pilot-hardening-wave1.md). |
| `20260711000900` | pre-pilot-hardening (**Wave 2 / WS-6**) | **Perf sweep P2/P3/P4/P5** (additive; P8 was in Wave 1). P2 `list_audit_filter_actors` (INVOKER, RLS-scoped). P3 keyset params on `pqs_inbox` (typed-param cursor, gate unchanged) + `p_limit` cap on `list_cases_board` (capped @200, uncursored) + 5 keyset indexes; `Page<T>` in `src/lib/types/pagination.ts` (opaque base64url cursor; **schema-gated `decodeCursor` timestamp/uuid validation — QA MAJOR cursor-injection fix**). P4 `get_feature_flags()` (DEFINER, `cache()`-memoized, 13 wrappers delegate) + `count_open_cases_for_board` (DEFINER, mirrors board `is_staff_admin_of`). P5 submissions form filter server-side. All 4 fns per-object REVOKE/GRANT (C-2). pgTAP `199` (28) → **Files=66/Tests=1644**; Vitest 206; E2E `perf-sweep-wave2` 13/13; full regr 546p/16f (0 reg). QA APPROVED [Sonnet]; **remote `db reset --linked` 2026-07-05**. Detail → [pre-pilot-hardening-wave2.md](progress/pre-pilot-hardening-wave2.md). |
| `20260712000000–…000300` | 15 | **Quality Indicators** (ADR 0057/0058; flag `quality_indicators` **ON**). `indicators` + `indicator_measurements` (per-commission `IND-%04d`); posture (b) member-read + DEFINER writes; sources manual/derivado/hibrido, derived == Phase-8 dashboard aggregate by construction; two-tier CAPA hook (`capa_plan.source_indicator_id` + `capa_measure.indicator_id`). **HC084–HC088**. Full prose in the header blob / [phase-15.md](progress/phase-15.md). |
| `20260713000000–…000400` | 17 | **Controlled-Document Lifecycle** (ADR 0057; flag `controlled_docs` seeded OFF→ON `…000400`). 3 tables (`controlled_documents`→`…_versions`→`document_approvals`; version-level status; per-commission `DOC-####`); posture (b) member-read + **version-scoped approver-read arm** (recursion fixed via 3 DEFINER helpers); immutable `controlled-documents` bucket (Rule 6, 25 MB); ~9 lifecycle RPCs + `set_document_version_file`, per-signer `signature_hash`, submit=delete-then-insert (**HC089–HC093**); DEFINER reads `documents_due_for_review`/`hospital_document_register`/`list_approver_candidates` (PHI-free, t19); forms-as-controlled-docs metadata inside `publish_form_version` (`guard_published_version` untouched — Rule 5). pgTAP `200_controlled_documents.sql` **47/47**; E2E `phase17-documents` **14/14**. Detail → [phase-17.md](progress/phase-17.md). |
| `20260716000000` | F1 | **Participants registry (dialect 3).** `participants` (`UNIQUE(id,type)`, sensitivity-CHECK), `patient_participants`/`professional_participants` (composite-FK+CHECK subtype pins — R5), `case_participant_roles`, `case_types`, `case_type_terminology`, `professional_profiles` (Class-2 + `app.can_read_professional_profile` DEFINER). RLS on all; no writer/flag flip here. ADR 0064 E0. |
| `20260716000100` | F1 | **`case_patient → patient_identifiers` re-key** (N-per-case, participant-keyed; DML REVOKED; door-only). `cases += organization_id` (R2; guard **HC095**). `case_participants` + cross-tenant guard **HC094**. `patient_xref` case grain → `participant_id` (ADR 0066/R3). RPCs `set_participant_patient` (atomic DEFINER writer, R4), `get_participant_patient`/`get_case_patients` doors, `get_case_professional` (Class-2 `professional_profile.read`), compat `set_case_patient`/`get_case_patient`. `log_audit_access`+C-4 gain `professional_profile.read`. |
| `20260716000200` | F1 | **Disposal + flags.** `dispose_case_phi` generalized to per-participant satellites + per-participant `patient_xref` purge + link soft-remove + registry redaction (Q4); F2 attachment-redaction seam marked (ADR 0065 §4). Flags `case_participants` + `case_types` seeded **OFF** (m2 hard gate). |
| `20260717000000` | F2 | **Attachments core** (ADR 0063/0065). `attachments` (**dialect-2 owner-dispatch** `(owner_type,owner_id)`, no-FK; `sensitivity_tier`→bucket, `confidentiality_label`, `scan_status`, `legal_hold`, `phi_disposed_*`; path-scope CHECK; immutability guard **HC096**), `attachment_references`, `attachment_subjects` (→ F1 `participants`, dialect 3), `case_interview_links`. DEFINER dispatchers `commission_of_attachment`/`can_read_attachment`/`can_write_attachment` (explicit `p_uid` `_for` variants; interview arm case-scoped via `can_read_case`; `form_upload` reserved-inert). Audit triple-mirror gains `attachment.read`. RLS + K9 grants on all four tables (write DEFINER-only). |
| `20260717000100–…000200` | F2 | **Storage buckets + RPCs.** Buckets `attachments` (standard — authenticated owner-dispatch SELECT + INSERT) + `attachments-phi` (**INSERT only — NO authenticated SELECT, the hard door**). RPCs `create_attachment` (write door — kind/tier/label validation + in-bucket existence check), `open_attachment` (audited PHI door — service-role signed `(bucket,path)`, exactly one `attachment.read`/allowed phi open, NULL-out-of-scope), `reclassify_attachment`, `soft_delete_attachment`, `dispose_attachment_phi` (legal-hold **HC098** + double-dispose **HC097**; redacts title/description, retains object — Rule 6). |
| `20260717000300–…000500` | F2 | **Fold-in + disposal + flag.** Dropped `case_documents`/`meeting_attachments`/`case_interview_attachments`; repointed `rca_evidence.cited_document_id` (RESTRICT) + `referral_shared_item.source_document_id` (SET NULL) onto `attachments`; rewired `add_referral_shared_item`. `dispose_case_phi` composes the D10 attachment-redaction seam (redact live non-held case attachments + stamp; **skip `legal_hold`** with reported count, Q9). Flag `attachments` seeded **OFF** (`seed.sql` enables local/E2E). |
| `20260718000000` | F3 | **Flexible-forms bones** (ADR 0060; no flag). `item_type` widened 10→15 on BOTH constraints (value enum + shape CHECK; new answerable arm `matrix`/`risk_matrix`/`reference` forced `required=false` — Flag-5; container arm `group`/`repeating_group`); `form_item_options.is_exclusive`+`risk_weight`; `form_versions.behavior_config jsonb` (+shape CHECK); `response_group_instances` position-uniqueness (`NULLS NOT DISTINCT`); inert `form_item_validations` (scoped-read + write-inert). `clone_form_version` carries `behavior_config` + the 2 option cols (Rule 5). |
| `20260718000100` | F3 | **Frozen inert answer-shape set** (ADR 0060 §4 Rec A; `docs/design/f3-question-key-aggregation.md`). `form_matrix_rows`/`form_matrix_columns` (definition, version-scoped, clone-stable `code`) + `answer_matrix_cells`/`answer_risk_matrix`/`answer_references` (off `answer_id`; `answer_references.participant_id → participants` A/C bridge). All RLS scoped-read + K9 grant, NO write policy/grant (write-inert); no `*_snapshot` cols. |
| `20260718000200` | F3 | **Dual-evaluator operators** `contains`/`not_contains`/`is_empty`/`is_not_empty` — `CREATE OR REPLACE app.eval_condition` (IMMUTABLE, `search_path` pinned; Rec D semantics), mirrored byte-for-byte in `src/lib/queries/conditions.ts`. Golden vectors extended both sides (`20_conditions.sql` ↔ `condition-vectors.json`, operator×value_type). NOT authorable (validators/picker untouched); `visible_when` stays visibility-only. No new SQLSTATE. |
| `20260720000700` | N | **Notifications core** (ADR 0076). `notifications` + `notification_preferences` (own-row RLS; `notifications` = SELECT + UPDATE(`read_at`) only, **NO authenticated INSERT/DELETE** — DEFINER-only write door); `app.assert_notifications_enabled()`; internal DEFINER `app.enqueue_notification` (single insert door, `ON CONFLICT (user_id,dedup_key) DO NOTHING`, prefs-aware, flag-OFF no-op) + `app.resolve_notifications_for`; public RPCs `mark_notification_read` (**HC0C1**) / `mark_all_notifications_read` / `set_notification_preferences` (**HC0C0**) / `compute_due_notifications` (scan; service_role-only); flag `notifications` inserted **OFF**. t19 on all public RPCs. |
| `20260720000710` | N | **Event-hook splices** — `CREATE OR REPLACE` on the live bodies of **9 host fns** (pulled via `pg_get_functiondef`, not stale baseline text) to add enqueue/resolve calls, all inert while the flag is OFF: `add_capa_action` + `update_capa_action` → capa/assigned; `app.advance_capa_action_core` → resolve on completed/cancelled; `save_section_answers` → signoff/requested (staff_admin-role, once submit-ready) ; `sign_section` → resolve when no staff_admin pending section remains; `add_meeting_attendee` + `seed_expected_meeting_attendees` + `seed_selected_meeting_attendees` → meeting/convoked; `conclude_meeting` → resolve 'upcoming'. |
| `20260720000720` | N | Flag flip: `notifications` → **ON** (gate-flip, mirror SUP `…000610` / `quality_indicators`; `seed.sql` also forces ON for local/E2E). |
| `20260720000730` | N | **BUG-N-001 reader.** `list_my_assigned_capa_actions()` DEFINER self-scoped (`assignee_user_id = auth.uid()`), config-level columns only (**PHI-free, Rule 12** — no rca/root-cause/event/patient/plan join); t19 `revoke…public` + `grant authenticated, service_role`. Read-only; advancing stays the assignee branch of `advance_capa_action` (no PQS gate). |
| `20260720000800` | IV2 | **Interviews v2 schema (ADR 0070).** NEW `public.interview_sessions` (1:N under `case_interviews`; `sequence_number` UNIQUE, CHECKs, RLS mirrors live `case_interview_subjects` via `interview_id` — `is_tenancy_admin_of`, InitPlan; `updated_at` touch + `guard_interview_child_lock`); helpers `commission_of_session`/`assert_session_writable`. `case_interviews`: **DROP** 5 scheduling cols + `modality`; **ADD** `interview_category` (req), non-enforcing `confidentiality_level`; status +`awaiting_follow_up`; `guard_interview_status` rewritten. `case_interview_subjects.relationship_to_case` (req; excl. patient/family). Hard-cut/reset-OK; `HC0B1`/`HC0B2`. |
| `20260720000810` | IV2 | **Interviews v2 RPCs.** Re-mapped `create/update/conclude/reopen/cancel_interview` (drop scheduling args; require category); DROP `schedule_interview`/`start_interview`; NEW session RPCs `schedule/update/start/complete/cancel/no_show_session` (`HC0B0`, reuse `HC038`/`HC039`/`HC041`); `add/update_interview_subject` +relationship. All DEFINER + `assert_interviews_enabled` + writability + **t19 REVOKE→GRANT**; session verbs via `app.audit_write`. Flag `interviews` (already ON). |
| `20260720000900` | RV2·R1 | **Referrals v2 dialogue schema.** NEW `public.referral_messages` (thread; `sequence_number` UNIQUE, `message_type` CHECK, PHI `body` **Option B** = row RLS `can_read_referral_phi` + column-REVOKE `body`, R5-reserved-inert cols; `guard_referral_message` sender∈{source,target}); `case_referral += waiting_on_committee_id`(CHECK)/`last_message_at`; status +`awaiting_information`; `guard_referral_status` +`in_review⇄awaiting_information`. |
| `20260720000910` | RV2·R1 | **Referrals v2 dialogue RPCs.** `post_referral_message` (HC0A0) / `request_referral_information` (HC0A1) / `provide_referral_information` (DEFINER, `FOR UPDATE` parent, `app.audit_write('referral.message_created')`, t19); `get_referral_detail` ext (thread + waiting-on + `last_message_at`); **`close_case` corrected** (inclusion list +`awaiting_information`); `dispose_referral_phi` purges `body`. |
| `20260720000920` | RV2·R1 | `get_referral_detail` += PHI-free compose-authority flags `can_compose_as_source`/`can_compose_as_target` (byte-for-gate RPC-authority parity, incl. `referral_target_analyst`). |
| `20260720000930` | RV2·R1 | **`case_referral` column-grant fix** ([[case-referral-column-grants]]): `GRANT SELECT (last_message_at)`,`(waiting_on_committee_id)` `TO authenticated` (hub direct-select was 42501); pgTAP `has_column_privilege` guard. |
| `20260720000940` | RV2·R1 | **QA M-1:** `post_referral_message` rejects `information_request`/`information_response` (HC0A0) — state-driving types minted only by `request`/`provide`. Column CHECK unchanged. |
| `20260720000980` | E1 | `cases.visibility_policy`+`confidentiality_level` (the 7-value taxonomy) · `case_types.default_confidentiality_level` · `case_access.max_confidentiality` (O1: a column, not widening `level`) · `app.confidentiality_rank` · **`create_case_from_template` 4→5 args** (optional `p_case_type_id`; drop+recreate). All DEFAULT to today's behaviour (flag-OFF byte-for-byte). |
| `20260720000990` | E1 | `case_conflict_declarations` + `case_recusals` (SELECT-only, DEFINER-write-only; partial-unique one LIVE recusal per (case,user); the D4 self/coordinator SELECT asymmetry). |
| `20260720001000` | E1 | **The m2 core.** `is_case_respondent`/`is_recused_from_case` (R6-safe) + the 2 hard-denies **first** in `can_read_case`/`_patient`/`can_write_case_content` + the `explicit_grants_only` suppression + the document ceiling (`attachment_confidentiality_ok`; `open_attachment` → `HC0E6`; `attachments_select`). |
| `20260720001010` | E1 | 10 DEFINER write RPCs (participants · professional writers · confidentiality/recusal/COI) + `assert_case_participants_enabled` + `can_manage_professional` + `case_recusals.lift_reason_md`. |
| `20260720001020` | E1 | IV2 fold-in (X-γ): `participant_id` FKs · `confidentiality_level` → **enforcing** + the O3 remap to the 7-value taxonomy (+ a normalization trigger, so IV2's `create_interview`/`update_interview` needed no reproduction) · `can_read_interview` · `confidentiality_clearance_ok` · attendance/topics/summaries + 5 RPCs. |
| `20260720001030` | E1 | `list_my_cases` explicit respondent/recusal exclusion (belt-and-suspenders atop the deny-terms — a respondent who is also an assignee must not appear in Meus Casos). |
| `20260720001040` | E1 | **m2 GATE RELEASE — `case_participants` + `case_types` ON.** Local-only (never `db push`ed this phase; prod flips at the deliberate pilot reset). |
| `20260720001050` | E1 | **QA MAJOR-1/2.** `can_read_case_or_admin` (deny FIRST, then OR the admin arm) → 9 `*_select` policies + `can_read_interview`; `is_case_excluded` → 8 bare-admin `FOR ALL` write policies + 3 interview-family writes + `case_access_select`; `record_recusal` reach gate; t19 on `confidentiality_rank`. |
| `20260720001060` | E1 | **QA INFO-1.** Dropped the inert `is_admin()` bypass from both clearance helpers — clearance rides `case_access.max_confidentiality` only. |
| `20260720001070` | E1 | **QA MAJOR-3.** `can_reach_case_on_member_surface` (ADR 0072 D2·8) → `meeting_cases_select`; `can_read_case_or_admin` → `meeting_cases_staff_admin_write`. |

## RPC inventory

All `security invoker` unless marked **DEFINER**. Invoker RPCs rely on RLS as the
authority; definer RPCs are narrow, internally gated exceptions (documented in an ADR).

| RPC | Mode | Purpose / notes |
| --- | ---- | --------------- |
| `submit_response(response)` | invoker | **The submission authority.** Visibility eval from saved answers, required-answer check, sign-off check (gated by `signoff_enforcement` flag), stray-answer cleanup, atomic flip → submitted. |
| `publish_form_version(version)` | invoker | Runs `validate_visible_when`, archives prior published, flips to published. |
| `validate_visible_when(version)` | invoker | Publish-time condition structural validation (referenced key exists, earlier section only, not on first section). |
| `create_form(...)` | invoker | Form + v1 draft + default section, atomic. |
| `clone_form_version(source)` | invoker | Copy sections+items, preserve `question_key`/`visible_when`/sign-off/`storage_path`, remap ids. Returns existing draft if one exists (ADR 0012). |
| `reorder_section` / `reorder_item` | invoker | Single-statement CASE swap against deferrable uniques (ADR 0011). |
| `delete_section_moving_items(section, target?)` | invoker | Atomic "move items to target then delete source". |
| `save_section_answers(response, section, answers, clear_item_ids)` | invoker | Atomic section upsert + `last_section_id` + `updated_at`; `clear_item_ids` = orphan-clear; cross-version item guard → **P0013**. |
| `start_or_resume_response(version)` | invoker | Resume existing in_progress or create; `unique_violation`-catch race; published-only backstop. |
| `sign_section(response, section, note)` | invoker | Backs BOTH respondent (wizard) and staff_admin (queue) sign. RLS `signoffs_insert` enforces signer-role; RPC adds visibility + in_progress precondition. Unique-race → **P0015**. |
| `list_signoff_queue(commission)` | **DEFINER** | `is_staff_admin_of`-gated; predicate = visible + unsigned + `staff_admin`-role + submit-ready (`app.response_required_complete`). ADR 0016. |
| `get_response_for_signoff(response)` | **DEFINER** | Narrow read of one in_progress response with a pending staff_admin sign-off. Does NOT broaden `responses_select` (preserves Phase-7 invariant). ADR 0016. |
| **Phase 7 — cases (all gate `cases_multi_phase`):** | | |
| `create_process_template` / `archive_process_template` / `publish_process_template` | invoker | Template lifecycle. ⚠ **Re-shaped by ADR 0096 — see the `PCI + TV` section.** Lifecycle now lives on `process_template_versions` (`draft→published→archived`), NOT on `process_templates` (which has no `status` column). `publish_process_template` is a thin wrapper over `publish_template_version(app.draft_version_of_template(...))`; `archive_process_template` archives every non-archived version. Publish still requires ≥1 phase + validates every `recommend_when` (P0016/P0017; + ADR 0043 HC063/HC064 for result-conditions). |
| `clone_template_version(source)` / `publish_template_version(version)` / `discard_template_draft(version)` / `draft_version_of_template(template)` | invoker | **New in ADR 0096.** Version lifecycle. `clone` is idempotent (returns the existing draft). Publish: draft-only, ≥1 phase (HC016), archives the prior published version. Status flips are trigger-gated on the GUC `app.in_template_publish_rpc` — see `PCI + TV`. |
| `add_template_phase` / `update_template_phase` / `reorder_template_phase` / `remove_template_phase` | invoker | ⚠ **All take `p_template_version_id` since ADR 0096.** Slot CRUD + adjacent-swap reorder (deferrable unique) + renumber; re-validate `recommend_when` via group-aware `app.validate_template_recommend_when` (HC016; ADR 0043: **HC063** result-condition on a non-emitting source slot · **HC064** result id outside the source's `allowed_result_ids` / archived / out-of-commission). Draft-only. As of ADR 0024: `add/update_template_phase` gain a trailing `p_blocks` (`+p_clear_blocks` on update); `reorder/remove` also **remap the `blocks` arrays** across the renumber (single atomic UPDATE per row; HC016 on a dangling/forward ref). |
| `set_template_phase_blocks(phase, blocks[])` | invoker | (ADR 0024) Set a slot's EARLIER-phase blockers (D1). Draft-only; validates earlier-only + position-exists (HC016) via `app.validate_template_phase_blocks`. Gates `cases_multi_phase`. |
| `create_case_from_template(p_template_id, label?, department?, department_other?, case_type?, custom_fields?)` | **DEFINER** | Still takes a **template** id and resolves the version internally via `app.published_version_of_template` (ADR 0096); `bulk_create_cases` does the same. `is_staff_admin_of`-self-gated. Mints case (per-commission number trigger, bounded retry; status defaults to `nao_iniciado`), snapshots slots → `case_phases` pinning each form's published version (HC017), copies+revalidates `recommend_when` via group-aware `app.validate_template_recommend_when` (HC016/HC063/HC064; ADR 0043), **snapshots `blocks`** + copies `process_template_outcomes`→`case_offered_outcomes` (ADR 0024), initial recompute. |
| `activate_phase(phase, assignee, due_date?)` | invoker | (ADR 0024) **Blocker gate** (HC018, reworded "blocked by phases") replaces strict-sequential: rejected while any phase it `blocks` is not yet `concluida`/`nao_necessaria`; **parallel-safe** (empty blocks activates freely, multiple phases may be `ativa`). + pendente (HC019) + case non-terminal (HC020) + assignee member (HC021); sets `due_date` under `app.in_case_rpc`. |
| `skip_phase(phase)` | invoker | `pendente→nao_necessaria` (HC019/HC020); recompute. |
| `add_ad_hoc_phase(case, form, …)` | invoker | Append (`is_ad_hoc`) on a non-terminal case (HC020), pin published version (HC017), validate recommend_when (HC016). |
| `add_ad_hoc_narrative(case, narrative_type?, new_type_label?, title?, instructions?, assigned_to?)` | **DEFINER** | Append a narrative (`is_ad_hoc=true`, `status='aberta'`) to an OPEN case (ADR 0047), mirroring `add_ad_hoc_phase`. Narratives-flag gate → terminal HC020 → coordinator 42501 → type from vocabulary or inline create-or-reuse (`on conflict(commission_id,label) do update … archived=false` — un-archives) / cross-commission HC054 → `display_position`=max over the phases+narratives interleave → non-member assignee HC021. `body_md`/`title`/`instructions` never audited (Rule 11). |
| `reassign_phase(phase, assignee, due_date?)` | invoker | Change assignee only before a response exists (HC019); member check (HC021); case non-terminal (HC020). |
| `start_or_resume_phase(phase)` | invoker | Assignee-only (HC022), phase ativa (HC019); uses the PINNED version (**skips** the published-only backstop); one-response-per-phase race catch. |
| `recompute_recommendations(case)` | **DEFINER** | Flags `recommended` on pendente phases. As of ADR 0043 (`…630000004`) `recommend_when` is a **combinable group** (`{match:all\|any, conditions:[…]}`, legacy single still valid) of answer- AND/OR result-conditions; walks the group and per condition evaluates the UNCHANGED `app.eval_condition` over a **synthetic map** — answer → `case_phase_answer_map(source)` (submitted-only); result-specific → `{__phase_result__:<result_id>}` (absent ⇒ no result); result-adverse → `{__phase_result_adverse__:<bool>}`. Folds all→AND/any→OR. Suggestion-only (only the `recommended` flag); also re-run by `set_case_phase_result_override` when a **concluded** phase's effective result changes. TS mirror `evalRecommendation` in `conditions.ts`. |
| `close_case(case)` | invoker | (ADR 0024) **D3 conclude gate:** rejects unsettled (pendente/ativa) phases → **HC031**; if the case offers outcomes and none chosen → **HC028**; else terminal-FIRST `concluido` + `closed_*`, then flip residual phases (recompute early-returns). Gates only `cases_multi_phase`. |
| `cancel_case(case)` | invoker | (ADR 0024) `→ cancelado` **anytime** (no settle gate; only HC025 if already terminal); terminal-FIRST then flip residual phases. Gates only `cases_multi_phase`. |
| `list_cases_board(commission)` | **DEFINER** | `is_staff_admin_of`-gated; one row/case + phases **status only** (no answers); **+ resolved `outcome` (label/flags, LIVE)** (ADR 0024). |
| `get_case_detail(case)` | **DEFINER** | `is_staff_admin_of`-gated; case header + phases; `response_id`/`submitted_at` only for SUBMITTED phases (Phase-7 invariant); **+ resolved `outcome` + frozen `offered_outcomes` + per-phase `blocks`** (answer-free) (ADR 0024). |
| *phase submission* | trigger | **Reuses `submit_response` unchanged.** `sync_case_phase_on_submit` (AFTER UPDATE on `responses`) flips the phase `ativa→concluida` (sets its OWN `app.in_case_rpc`; that flip fires `recompute_case_status_trg` → macro status auto-advances), recomputes recs. No-op when the case is terminal. |
| **Phase 8 — dashboards (DEFINER; `is_staff_admin_of OR is_admin`-gated; `commission_overview` is `is_admin`):** | | |
| `dashboard_distributions(form, from?, to?)` | **DEFINER** | Per-(question_key, option) counts; checkbox unnested; per-section denominator; standalone submitted-only; date-bounded. |
| `dashboard_free_text` / `dashboard_submissions_over_time` / `dashboard_completion_by_member` / `dashboard_form_totals(commission, from?, to?)` | **DEFINER** | Free-text samples / volume trend / completion-by-member / per-form totals. Standalone submitted-only, date-bounded. |
| `dashboard_export_rows(form, from?, to?)` | **DEFINER** | CSV rows: one col per `question_key` (checkbox `;`-joined) + per-signed-section sign-off status. |
| `commission_overview()` | **DEFINER** | `is_admin`-gated cross-commission counts/volume (case-phase-excluded). |
| **Case-model adjustments — OUTCOMES (all gate `cases_extras`; ADR 0024):** | | |
| `set_case_outcome(case, outcome_id?)` | invoker | Assign/clear a case's single outcome (D9). `is_staff_admin_of`/admin gate; rejects terminal case (**HC025**); a non-null outcome must be in the case's FROZEN `case_offered_outcomes` (**HC029**); writes `cases.outcome_id` (a non-status column — the rewritten `guard_case_status` permits it on a non-terminal case without `app.in_case_rpc`). |
| `set_process_outcomes(p_template_version_id, outcome_ids[])` | invoker | The draft builder's offered-set persistence (D15). ⚠ **Takes a VERSION id since ADR 0096** (it was `DROP`+`CREATE`d for the rename — one of the 10 doors whose ACL reset; see `PCI + TV`). Draft-only; delete-then-insert `process_template_outcomes`; same-commission guard → **HC030**; `[]` offers none. |
| `create_case_outcome` / `update_case_outcome` / `reorder_case_outcomes` / `archive_case_outcome` | invoker | Outcome-vocab CRUD (mirror tag CRUD); `is_staff_admin_of`-gated; `unique(commission,label)` → 23505; deferrable-position reorder; edits propagate (D11); a referenced row is archived, never deleted (`cases.outcome_id` is `NO ACTION`). |
| **(R2 configurable-status RPCs `set_case_status` / `create/update/reorder/archive_case_status` / `list_case_status_defs` were REMOVED — ADR 0024 / migration 093000. Status is now a FIXED auto-computed enum: see `app.recompute_case_status` + its AFTER-trigger under Helpers; `close_case`/`cancel_case` above are the only manual transitions.)** | | |
| **Cases-Extras — R1 documents/events (writes are DIRECT table ops gated in TS via `cases_extras_enabled`):** | | |
| *(no write RPCs)* | — | `case_documents`/`case_events` writes go through the staff_admin-write RLS from the server actions (upload clones `uploadFormAsset`). `cases_extras_enabled()` DEFINER read is the TS-layer flag gate. |
| **Cases-Extras — R3 tags (all gate `cases_extras`):** | | |
| `create_case_tag` / `rename_case_tag` / `archive_case_tag` | invoker | Vocab CRUD; `is_staff_admin_of`-gated; `unique(commission,name)` → 23505. |
| `assign_case_tag(case, tag)` / `unassign_case_tag(case, tag)` | invoker | `is_staff_admin_of`-gated; assign idempotent on PK; BEFORE INSERT guard → **HC026** on commission mismatch. |
| `case_tag_report(commission, from?, to?)` | **DEFINER** | `is_staff_admin_of`/admin-gated; per-tag DISTINCT case count over `created_at::date` window (mirrors `dashboard_form_totals`). |
| **Cases-Extras — R4 action items (writes gate `cases_extras`):** | | |
| `create_action_item` / `update_action_item` | invoker | `is_staff_admin_of`-gated authoring; assignee-member check (HC021); source phase must belong to the case. |
| `advance_action_item(item, status)` / `complete_action_item(item)` | invoker | Lifecycle via `app.advance_action_item_core` (DEFINER): caller must be the assignee OR staff_admin/admin → **HC027**; stamps `completed_*` on `done`. |
| `case_action_items_kpis(commission)` | **DEFINER** | `is_staff_admin_of`/admin-gated; open / overdue / completed-YTD (zeroed row to non-staff_admin). |
| **Phase 10 — meetings (all gate `meetings`; ADR 0025):** | | |
| `create_meeting` / `update_meeting` | invoker | Header + scheduling; edit only while agendada/realizada; mint retry on unique. |
| `mark_meeting_held` / `conclude_meeting` / `reopen_meeting` / `distribute_meeting` / `cancel_meeting` | invoker | Lifecycle under `app.in_meeting_rpc`. conclude (realizada\|agendada → em_assinatura): ≥1 present (**HC034**), snapshot quorum (members only — guests excluded), write `case_events` kind='meeting' per linkage. reopen (em_assinatura\|assinada → realizada): **revokes** signatures. Cancel blocked on `assinada`. |
| agenda/attendee CRUD, `reorder_meeting_agenda_item`, `seed_expected_meeting_attendees`, `link_meeting_case` / `unlink_meeting_case`, attachment insert + soft-delete | invoker | Child authoring; blocked once parent ≥ `em_assinatura` (child-lock trigger). `meeting_cases` same-commission guard → **HC032**. |
| `sign_meeting(attendee, note?)` | **DEFINER** | Signs the caller's own present-platform-attendee row; re-checks `app.can_sign_meeting` (a DEFINER fn bypasses RLS) → **HC036**; double-sign → **HC035**; computes `content_hash`; **auto-flips em_assinatura→assinada** when all required signatures present (RPC-side, not a trigger). |
| `my_pending_meeting_signatures()` | **DEFINER** | Caller's em_assinatura meetings where they are a present platform attendee with no active signature (drives the "Pending Signatures" badge). |
| `create/update/advance/complete/delete_meeting_action_item` | invoker | Mirror case action items; advance gated assignee-or-staff_admin → **HC037**. |
| `create_meeting_type` / `rename_meeting_type` / `archive_meeting_type` / `update_meeting_settings` | invoker | F5 settings; `is_staff_admin_of`-gated; `unique(commission,name)` → 23505. |
| **Phase 11 — interviews (all gate `interviews`; all **DEFINER**; ADR 0026; **revised by IV2 2026-07-14, ADR 0070 — `interview_sessions` 1:N, `HC0B0-2`; status keys ENGLISH (D11): `draft/scheduled/in_progress/awaiting_follow_up/completed/cancelled`; detail → [iv2-interviews.md](progress/iv2-interviews.md)**):** | | |
| `create_interview(case, title?, phase?, category, confidentiality='standard')` | **DEFINER** | **IV2:** drops all scheduling args; **requires `interview_category`** (→ **HC0B1**); `confidentiality_level` **non-enforcing** (default `standard`). Bootstrap = staff_admin/admin only (42501); derives `commission_id`; mint retry; `status='draft'`. |
| `update_interview` / `update_interview_summary` | **DEFINER** | Header (title/phase/category/confidentiality) / `summary_md` edit; `app.assert_interview_writable` (→ **HC039**); rejected once completed/cancelled (**HC038**). Emits `interview.confidentiality_changed` on level change. |
| `conclude_interview` / `reopen_interview` / `cancel_interview` (interview-level) | **DEFINER** | Under `app.in_interview_rpc`, writable-gated. **IV2: `schedule_interview`/`start_interview` DROPPED** (scheduling → sessions). conclude precondition widened to `{in_progress, awaiting_follow_up}` + ≥1 subject (**HC041**); recomposes the single `case_events kind='interview'` registry row from session actuals (no dup on re-conclude). `cancel_interview` cascades non-terminal sessions → cancelled BEFORE the parent flip. `cancelled` TERMINAL (only `completed` reopens). Wrong state → **HC038**. |
| **session RPCs (IV2, NEW; on `public.interview_sessions` 1:N):** `schedule_session` · `update_session` · `start_session` · `complete_session(session, actual_end=now)` · `cancel_session`/`no_show_session(session, reason)` | **DEFINER** | Writable via `app.assert_session_writable` (→ **HC039**). Reason persists on `interview_sessions.cancellation_reason` only; audit payloads structured-keys-only since `20260826000000` (Rule 11/LGPD). `sequence_number=max+1`; `schedule` precond interview ∈ {draft,scheduled,in_progress,awaiting_follow_up} (**HC0B0**), flips draft→scheduled. `start`→in_progress + `actual_start`. `complete`→completed, derives interview→`awaiting_follow_up` iff another `scheduled` remains (side-effect, not a trigger). cancel/no_show terminal + reason (never hard-delete). All emit `interview.session_*` via `app.audit_write`. |
| subject CRUD (`add/update/remove_interview_subject`), interviewer CRUD (`add/update/remove_interview_interviewer`) | **DEFINER** | Writable-gated; member XOR external; a REGISTERED interviewer must be a commission member → **HC021**. **IV2:** subject `relationship_to_case` **required** (→ **HC0B2**; excludes patient/family — staff-only). Locked once parent completed/cancelled (child-lock 23514). |
| `add_interview_attachment(interview, kind, title, storage_path?, external_url?, mime?, size?)` / `delete_interview_attachment` | **DEFINER** | Writable-gated; storage_path XOR external_url + https → **HC040**; soft-delete. NOT child-locked (late signed transcript). |
| `interview_viewer_can_write(interview)` | **DEFINER** | Thin read of `app.can_write_interview(interview, auth.uid())` — the query layer's `viewerCanWrite` signal (the `app` helper is not PostgREST-callable). |
| `interviews_enabled()` | **DEFINER** | TS-layer flag read (mirror `meetings_enabled`). |
| **Phase 14a — patient-safety/NSP (all gate `patient_safety`; all **DEFINER**; ADR 0030/0031):** | | |
| `notify_safety_event(reporting_commission, title, desc_md?, suspected_harm?, discovered_at?, location?, case?)` | **DEFINER** | **Any member** of the reporting commission (just-culture; non-member → 42501) — NOT a role gate; mints `EV-%04d`; writes a `case_events kind='safety_event'` when case-linked. Returns the row (`.id`/`.code`). |
| `acknowledge_event` / `update_event` / `cancel_event` | **DEFINER** | NSP custody ops under `app.in_safety_rpc`; state machine (**HC043**); `acknowledge` stamps who/when. |
| `transfer_event_custody(event, to_kind, to_commission?)` | **DEFINER** | Append-only custody hand-off — closes the open interval, appends a new one, updates the denormalized owner; only the **current custodian** (or PQS/admin) may transfer → **HC044**. |
| `set_event_patient(event, …PHI…)` | **DEFINER** | Writes the isolated `event_patient` row (PHI). The query layer's `getEventPatient` read is the audited path (`event_patient.read`). |
| `pqs_inbox(status?, priority?, reporting_commission?)` | **DEFINER** | NSP queue — **PHI-FREE** projection (no identifiers); PQS/admin only. |
| `patient_safety_enabled()` | **DEFINER** | TS-layer flag read (mirror `audit_trail_enabled`). |
| **Phase 22 — inter-committee referrals (all gate `case_referrals`; all **DEFINER**; ADR 0037; **revised by RV2·R1 2026-07-14, ADR 0037 Amendment 1 — dialogue thread + `awaiting_information`; `HC0A0`/`HC0A1`; status keys ENGLISH; detail → [rv2-r1-referrals.md](progress/rv2-r1-referrals.md)**):** | | |
| `create_referral_draft(source_case, target_commission, type, subject, response_expected?)` | **DEFINER** | Source coordinator only (→ **HC071**); target ≠ source; snapshots `type_label`; seeds `response_expected` from the type when NULL. Returns the row (`.id`/`.code`). |
| `update_referral_draft` / `add_referral_shared_item(referral, kind, narrative?, document?)` / `remove_referral_shared_item` | **DEFINER** | Draft-only (`app.assert_referral_draft_writable` → HC071/**HC070**); `add` validates the source belongs to the referral's `source_case_id` + the one-of shape (**HC077**) and freezes the copy. |
| `set_referral_patient(referral, …9-arg PHI…)` | **DEFINER** | Upserts the isolated `referral_patient` (same shape as `set_event_patient`); entitled = `can_read_referral_phi` AND not concluded/declined/withdrawn (→ **HC078**); maintains `has_patient`; audited WITHOUT identifiers. |
| `send_referral` / `withdraw_referral` | **DEFINER** | Source-coord transitions under `app.in_referral_rpc`. send (`rascunho→enviada`) freezes the snapshot + requires ≥1 item or a description; withdraw (`→retirada`) resolves the close-gate. |
| `receive_referral` / `accept_referral` / `decline_referral(referral, note?)` / `start_referral_review` | **DEFINER** | Target-coord transitions (`app.assert_referral_target_acts` → **HC072**/HC070). decline (`→recusada`) resolves the close-gate. |
| `link_referral_case(referral, target_case?)` | **DEFINER** | Target-coord; the case must belong to the target commission (→ **HC079**); this is how B's analyst earns PHI access (`referral_target_analyst`). NULL clears the link. |
| `add_referral_reply_attachment` / `conclude_referral(referral, outcome?, result_md?, acknowledged_only?)` | **DEFINER** | Target-coord. conclude (`em_analise→concluida`) writes + freezes `referral_reply`; when `response_expected`, `result_md`+`outcome` are REQUIRED (→ **HC075**); a no-reply referral may conclude `acknowledged_only`; invalid outcome → **HC074**. |
| `get_referral_detail(referral)` → jsonb | **DEFINER** | **Audited door.** Re-gates `can_read_referral` (P0002 out of scope); serves PHI free-text (`frozen_body_md`/`result_md`/`description_md`/`decline_note` + **RV2·R1** the `messages[]` thread `body`) ONLY to a `can_read_referral_phi` reader, nulls otherwise; emits `referral.viewed` on a body-serve to a non-source-coordinator (incl. QPS). **RV2·R1** also returns `waiting_on_committee_id`, `last_message_at`, and the PHI-free compose-authority flags `can_compose_as_source` (=`is_staff_admin_of(source)`) / `can_compose_as_target` (=`is_staff_admin_of(target) OR referral_target_analyst`) — byte-for-gate parity with the R1 write RPCs. |
| **RV2·R1 dialogue (NEW; migs `20260720000900`–`…000940`):** `post_referral_message` · `request_referral_information` · `provide_referral_information` | **DEFINER** | On `public.referral_messages` (thread; `body` **PHI — Option B**: row RLS `can_read_referral_phi` + column-REVOKE `body` → body served only via the door, stricter than the siblings; DML revoked, writes RPC-only + `FOR UPDATE` parent + `guard_referral_message` sender∈{source,target} + t19). `post` = general/clarification comment (**HC0A0**; rejects the state-driving types — QA M-1); `request` (target coord/analyst) → posts `information_request`, `status=awaiting_information`, `waiting_on=source` (**HC0A1** wrong-status); `provide` (source coord) → `information_response`, `status=in_review`, `waiting_on=target`. All emit `referral.message_created` via **`app.audit_write`** (mutation trail, NOT `log_audit_access`). `case_referral += waiting_on_committee_id`/`last_message_at` (both `authenticated` column-granted — `…000930`); status +`awaiting_information`. **`close_case` corrected** to block `awaiting_information` (HC076 inclusion list). `dispose_referral_phi` purges message `body`. |
| `get_referral_patient(referral)` → jsonb | **DEFINER** | **The SINGLE audited PHI-identifier door** (`referral_patient` SELECT is REVOKED). Re-gates `can_read_referral_phi`; NULL out of scope / no PHI (no audit row); emits `referral_patient.read` (empty metadata, source-commission-attributed) on a real entitled read. Mirrors `get_event_patient`. |
| `get_referral_snapshot_document_path(item)` / `get_referral_attachment_path(attachment)` → text | **DEFINER** | Re-gate `can_read_referral_phi` + audit (`referral.viewed`), return the authorized storage path; the **cookie client** then signs it (snapshot docs ride the `case-documents` snapshot OR-term; **no service-role**). NULL out of scope. |
| `list_referral_target_commissions(source_commission)` | **DEFINER** | The wizard's target picker — every commission except the source (id+name, PHI-free); source-coord/admin-gated (→ HC071). |
| `referrals_enabled()` / `is_pqs_member_self()` | **DEFINER** | TS-layer flag read; and the duty-separation probe gating the QPS dashboard data layer (`listAllReferrals`/`referralFlowMetrics` return nothing to a non-PQS caller). |
| `list_my_action_items(commission)` → jsonb | **DEFINER** | Self-scoped (`assigned_to = auth.uid()`) union of the caller's `case_action_items` (flag `cases_extras`) + `meeting_action_items` (flag `meetings`) for one commission; ALL statuses; a flag-OFF source is OMITTED (no error); joins parent case/meeting for PHI-FREE label cols + `created_by` name; default order due_date asc nulls last, created_at desc. No audit row (own items). |
| `get_member_overview(commission)` → jsonb | **DEFINER** | Self-scoped "Visão Geral": 5 counts + 2 hints in one round-trip — cases-not-concluded (PERSONAL rule; attribution counts regardless of a `case_access_grants` grant — the grant leg is always evaluated now the `case_access` flag is retired), pending action items (+overdue), meetings-not-concluded (attendee-scoped, +next start), pending signatures (mirrors `my_pending_meeting_signatures`), own `in_progress` responses. Flag-dependent counts → 0/null when off (never raise). No audit row (own aggregates). |
| **Layout batch — coordinator "add existing member" (migration `20260705000000`):** | | |
| `list_addable_commission_members(commission, search?)` → table(user_id, full_name, email) | **DEFINER** | Coordinator-gated (`is_staff_admin_of(commission)` OR `is_org_admin_of_commission(commission)`; anyone else → empty set, never an org-roster leak). Returns ACTIVE profiles anchored to the commission's ORGANIZATION (`home_organization_id`) who are NOT already members, excluding platform (vendor) `is_admin` accounts; optional `search` ILIKEs name/email; ordered name-then-email, `limit 500`. The ONLY path a staff_admin reads the org roster (no blanket `profiles` SELECT under RLS) — minimum-necessary + DB-side gated. The invite-brand-new-user-by-email path was removed from the coordinator flow (new people are registered by an org_admin via `registerUser`). Grants: `authenticated` + `service_role`; owner `postgres`. |

| **Phase 15 — quality indicators (all gate `quality_indicators`; all **DEFINER**; ADR 0057/0058):** | | |
| `create_indicator` / `update_indicator` / `archive_indicator` | **DEFINER** | Authoring gate `is_staff_admin_of OR is_tenancy_admin_of` (RLS posture-(b): no direct write); per-commission `IND-%04d` mint; `derived_config` validated à la `version_has_option_code`; **manual `taxa` allowed**. → **HC084** (config)/**HC085** (is-manual)/**HC086** (is-derived). |
| `set_indicator_target(indicator, target, comparator, direction)` | **DEFINER** | Retarget + reclassify the latest measurement across both directions. |
| `record_indicator_measurement(indicator, period, numerator, denominator?, note?, period_start?, period_end?)` | **DEFINER** | Manual entry; computes `value` + off-target detection (both directions); upsert on `(indicator, period)`; audited `.recorded`/`.updated` (note NOT copied into the log). **HC085** on a derived indicator. |
| `compute_derived_measurement(indicator, period, p_denominator := null, p_period_start?, p_period_end?)` | **DEFINER** | Derived/hybrid compute — percentual/contagem via option `code`s, tempo_medio via `answers.value_number`; **equals `dashboard_distributions` for the window** (parity lock); hybrid ONE-STEP (denominator inline) + **preserve-on-recompute** (stored denominator kept when not re-passed → **HC088** on first compute). **HC086** on a manual indicator, **HC087** denom=0. |
| `indicator_series(indicator)` / `indicator_kpis(commission)` | **DEFINER** | Reads gated `is_staff_admin_of OR is_tenancy_admin_of`; foreign-commission → empty. |
| `hospital_indicator_rollup(hospital)` | **DEFINER** | **PHI-FREE** per-commission counts (total/fora/na/sem-dados by latest measurement); gate `is_hospital_admin_of OR is_org_admin_of(org_of_hospital)`; foreign caller → `[]`. ⚠ **The `is_admin` arm was REMOVED 2026-08-05** (`20260908000100`, BUG-AUTHZ-002) — rollups are commission content and the noun rule puts them out of platform_admin's reach. Held by pgTAP `299`. |
| `open_capa_plan(p_source='indicator', p_source_id=indicator, …)` | **DEFINER** | Indicator arm — derives `hospital_id` from the indicator's commission (no manual hospital); **PQS-operator-gated (`can_write_capa` UNTOUCHED**, WS-3c posture). |
| `quality_indicators_enabled()` | **DEFINER** | TS-layer flag read (`qualityIndicatorsEnabled()` also delegates to `get_feature_flags()`). |
| **S1·N — notifications (ADR 0076; all t19 `revoke…public` + grant):** | | |
| `mark_notification_read(id)` | invoker | Own-row set `read_at` (`user_id = auth.uid()`); **HC0C1** if not found/not owned; already-read is an idempotent success. Asserts the flag. |
| `mark_all_notifications_read()` | invoker | Own unread → read. |
| `set_notification_preferences(surface, enabled)` | invoker | Own-row upsert of the per-surface reminder toggle; **HC0C0** on an invalid surface. |
| `compute_due_notifications()` | **DEFINER** | Batch scan over CAPA + sign-off + meeting due/pending state → enqueues via `app.enqueue_notification` (idempotent, prefs-aware). Returns the count of NEW rows. **service_role-only** (NOT `authenticated` — ADR 0076 dec. 8, no manual "run now"; scheduled at pilot deploy); flag-OFF → returns 0 without raising. |
| `list_my_assigned_capa_actions()` | **DEFINER** | Self-scoped (`assignee_user_id = auth.uid()`) list of the caller's CAPA actions for `/conta/itens-de-acao` (BUG-N-001); config-level columns only (id/capa_id/title/owner/action_strength/due_date/status/updated_at) — **PHI-free, Rule 12**; no rca/root-cause/event/patient/plan join. Read-only. |
| `add_case_participant(case, participant, role, is_primary?, involvement?)` | **DEFINER** | E1 / ADR 0072 D6. Coordinator-gated; role↔participant-type check → `HC0E3`; a non-coordinator reader → `HC0E4`; a 2nd live primary → `HC0E7`. `case_participants` stays **SELECT-only** (no write grant exists). |
| `remove_case_participant(cp)` / `set_primary_subject(cp)` / `set_case_participant_role(cp, role)` | **DEFINER** | Same gate/codes; remove is soft (`removed_at`). ⚠ **`set_primary_subject` is no longer set-only** — ETH·E4 `create or replace`d it with **MOVE** semantics (a 2nd set used to raise `HC0E7`) and it now re-runs the linkage assert. See the ETH·E4 section. |
| `create_professional_profile(org, …)` / `update_professional_profile(id, …)` | **DEFINER** | Class-2 writers; `app.can_manage_professional` (admin / org_admin / staff_admin-in-org). **Correction only — NO erasure path** (M2 posture, Rule 12); audited `professional_profile.created`/`.updated` with **no identity payload**. ⚠ **`create_professional_profile` is a BARE INSERT** — no lookup, no `on conflict`. It is *not* get-or-create; `ensure_professional_participant` is the get-or-create door, and it mints the **registry** row from an already-existing profile. Assuming otherwise cost ETH·E4 a QA round (a retry after a failed step 2/3 minted a duplicate, or dead-ended on 23505). |
| `set_case_confidentiality(case, level)` | **DEFINER** | Coordinator; `HC0E5`; the ONLY mutation door for `cases.confidentiality_level`. Emits exactly one `case.confidentiality_changed` (the case audit trigger fires only on a status change). |
| `declare_conflict(case, type, description_md)` | **DEFINER** | Self-service for any case **reader**; `HC0E2` on a duplicate. |
| `record_recusal(case, user, reason_md, declaration?)` | **DEFINER** | Coordinator-or-self. **Reach-gated** (QA MAJOR-2): a caller with no reach gets `P0002 caso não encontrado` — byte-identical to a non-existent case, so it is **not** a case-existence oracle. `HC0E0` on a live duplicate; the target loses read immediately via the deny-term. |
| `lift_recusal(recusal, reason_md)` | **DEFINER** | Coordinator; soft-lift; `HC0E1`; read restored. |
| `set_interview_participant(interview, cp)` (+ `_subject_` / `_interviewer_` variants) | **DEFINER** | E1 D7 fold-in; `can_write_interview` → `HC039`; rejects a participant from another case. |
| `set_interview_confidentiality(interview, level)` | **DEFINER** | Now **enforcing** + 7-value; `HC0E5`; audited `interview.confidentiality_changed`. |
| `record_session_attendance(session, cp, status?, role_at_session?)` | **DEFINER** | Upsert per (session, participant). |

## Helper functions

- **FF-3 validation predicates (ADR 0090)** - `app.eval_validation(rule_type, config, value, answers,
  peer_values)` **IMMUTABLE + pure** (the SQL half of the second dual evaluator; TS twin `evalValidation`
  in `src/lib/forms/validation-rules.ts`, locked by `__fixtures__/validation-vectors.json`) *
  `app.item_is_required(required, required_if, answers)` **IMMUTABLE**, total by `coalesce` (visibility is
  NOT consulted - the CALLERS filter by `app.eval_visibility` first, which is what makes "visibility wins"
  structural) * `app.validation_rule_allowed(rule_type, item_type, parent_item_type)` **IMMUTABLE**, total
  by `coalesce(..., false)` (the NULL-returning version admitted forbidden pairs) *
  `app.is_valid_validation_config(rule_type, config)` (every key test resolves the ABSENT case via
  `coalesce(jsonb_typeof(...), 'missing')` - the FF-2 defect-1 fail-open shape) *
  `app.validation_value_is_empty(value)` (the ONE notion of empty, shared with `eval_condition`'s
  `is_empty`) * `app.item_bound_violations(item_type, config, label, value)` (the legacy config-bound lane,
  made enumerable; `app.assert_item_bounds` is now a thin `HC061`-raising wrapper over it) *
  `app.response_validation_errors(response)` **DEFINER** - the single walker both the read path and the
  submit gate consume.

- `is_member_of(commission)` / `is_staff_admin_of(commission)` — `security definer`,
  used throughout RLS.
- `app.is_admin()` — from the verified JWT claim, DB fallback as defense-in-depth.
  **Multi-tenancy (ADR 0041): now `platform_admin` — provisioning-only, walled off all tenant
  data/PHI; never an authorization grant on a tenant path (esp. in service-role actions).**
- **Multi-tenancy org predicates (ADR 0041), `security definer`, mirror `is_member_of`:**
  `app.is_org_admin_of(org)` / `is_org_admin_of_commission(commission)` (+ `_for(…, user_id)`
  variants) — customer org_admin authority (single-hop via the denormalized
  `commissions.organization_id`); `app.is_org_member(org)` — member of any commission in the org
  (gates a commission member reading their own org row); `app.is_multi_org()` —
  `(select count(*) from public.organizations) > 1`, the guard that makes `app.is_pqs_member`
  (and thus the entire global-PQS/QPS NSP + referral PHI surface) inert in a multi-org deployment.
- `app.eval_condition(...)` — the **SQL** condition evaluator. Mirrored in TypeScript by
  `evalCondition` in `src/lib/queries/conditions.ts`; the shared vector file
  `src/lib/queries/__fixtures__/condition-vectors.json` keeps them in agreement.
  **Drift is phase-blocking.**
- `app.answer_map(response)` — `question_key→value` for evaluation; since form-model-normalization
  it **rebuilds** the value from `answers` (scalars) + `answer_selected_options` (single→scalar code,
  checkbox→ordered code array), keeping the evaluator + shared vectors byte-for-byte unchanged.
  `app.answer_map_by_item(response)` is the `item_id`-keyed twin (drives `get_response_for_signoff`).
- `app.response_required_complete(response)` — submit-readiness (used by the queue); "answered" =
  scalar value OR ≥1 selection row.
- `app.can_sign_section` / `app.can_read_signoff` — definer predicates (090003) that
  do response fact-finding for the sign-off path without RLS-filtering the parent row;
  signer-role rules unchanged.
- `app.feature_enabled(name)` — reads `app.feature_flags`; `app.assert_cases_enabled()` is
  the Phase-7 entry gate wrapper (raises `23514` when `cases_multi_phase` is OFF);
  `app.assert_extras_enabled()` is the Cases-Extras wrapper (raises `23514` when
  `cases_extras` is OFF); `public.cases_extras_enabled()` is the DEFINER boolean read the
  R1 direct-table-write actions call to gate the flag from TS.
- **Case-model adjustments (ADR 0024):** `app.recompute_case_status(case)` — **DEFINER**; the
  single authority for the three auto-computed statuses (any phase `ativa`→`em_revisao`; else
  ≥1 `concluida`→`pendente`; else `nao_iniciado`), early-returns on a terminal case (never
  overrides the manual `concluido`/`cancelado`, D6), writes only on change under
  `app.in_case_rpc`. `app.trg_recompute_case_status()` backs the **AFTER INSERT OR UPDATE OF
  status ON `case_phases`** trigger (`recompute_case_status_trg`; no DELETE event — avoids the
  case-cascade hazard; writes `cases` only → depth-1). The TS twin of the terminal check is now
  **`isTerminalCaseStatus(status)` in `@/lib/cases/case-status`** (a pure fixed-union check; the
  old `caseStatusIsTerminal(defs,key)` + the R2 `case_status_is_terminal`/`apply_case_status`/
  `case_terminal_key`/`slugify_status_key`/`unaccent_fallback` are gone). `app.guard_phase_blocks_shape()`
  — BEFORE INS/UPD on both phase tables, asserts `blocks` is earlier-positions-only (→ HC016).
  `app.validate_template_phase_blocks(p_template_version_id, position, blocks)` — DEFINER deep
  validity (every referenced position exists in the VERSION; → HC016). `app.guard_process_template_outcome()`
  — BEFORE INSERT on `process_template_outcomes`, asserts outcome+template share a commission
  (→ **HC030**). ⚠ The whole `app.validate_template_*` family (`_recommend_when`, `_phase_result`,
  `_result_ruleset`, `_allowed_results`, `_phase_blocks`) takes `p_template_version_id` since ADR 0096.
- **Cases-Extras (R3/R4):** `app.guard_case_tag_assignment()` — BEFORE INSERT trigger asserting
  tag+case share a commission (HC026). `app.advance_action_item_core(item, status)` — DEFINER
  gated mutation (assignee OR staff_admin → HC027; stamps `completed_*` on `done`).
- **Phase 7 (cases):** `app.commission_of_template(id)` / `app.commission_of_case(id)` —
  definer, mirror `commission_of_version` (drive RLS + definer reads). ⚠ Since ADR 0096 the
  template side is a THREE-function family, because the child tables lost their FK to
  `process_templates`: `commission_of_template` (1 hop) · `commission_of_template_version`
  (2 hops, version → identity) · `commission_of_template_phase` (**3 hops**, phase → version
  → identity). Use the one matching your grain — see `PCI + TV`.
  `app.case_phase_answer_map(case_phase)` — **definer, SUBMITTED-ONLY** `question_key→value`
  for ONE phase; returns `'{}'` for an in-progress/skipped source (the single cross-member
  answer surface; the Phase-7 invariant — tested, do not relax). Since form-model-normalization it
  rebuilds from `answers`+`answer_selected_options` like `answer_map` (choice-based cross-phase
  recommendations/result-rulesets were silently blank before that fix). `app.published_version_of_form`,
  `app.version_has_input_key`, `app.validate_template_recommend_when`,
  `app.is_member_of_for(commission, user)` (arbitrary-user membership, for assignee checks).
- **Phase 10 (meetings):** `app.commission_of_meeting(id)` — definer, drives child-table RLS + definer
  reads. `app.can_sign_meeting(attendee, signer)` — definer predicate (caller's OWN row, present
  PLATFORM attendee, meeting `em_assinatura`, member of commission); the sign-own-row authority for
  BOTH the `meeting_signatures_insert` policy AND the `sign_meeting` DEFINER path (a DEFINER fn
  bypasses RLS, so it re-checks explicitly). `app.guard_meeting_status` (state-machine + content-freeze
  ≥`em_assinatura`) / `app.guard_meeting_child_lock` (keys on PARENT status, NOT the RPC flag) /
  `app.mint_meeting_number` (advisory-lock, mirrors case number) / `app.seed_default_meeting_types`
  (AFTER INSERT on `commissions`). `app.assert_meetings_enabled()` gate; `public.meetings_enabled()`
  DEFINER boolean (TS-layer write gate). `content_hash = encode(extensions.digest(coalesce(minutes_md,''),'sha256'),'hex')`
  (note the `extensions.` qualifier — pgcrypto isn't on the pinned search_path).
- **Phase 11 (interviews):** `app.commission_of_interview(id)` — definer, drives child-table RLS + the
  writable gate (reads the DENORMALIZED `commission_id` → no recursion). `app.can_write_interview(interview, uid)`
  — **the NEW participant-write authority** (DEFINER, uid-pure): staff_admin/admin of the interview's
  commission OR a registered interviewer (a `case_interview_interviewers` row with `user_id=uid`); drives
  every `case_interviews` UPDATE/DELETE + child WRITE policy + the Storage INSERT policy + the
  `assert_interview_writable` RPC gate. Built on NEW uid-pure mirrors `app.is_staff_admin_of_for(commission, uid)`
  + `app.is_admin_for(uid)` (DB `profiles.is_admin` only — the JWT claim is per-session, so policies also OR
  `app.is_admin()`). `app.guard_interview_status` (state-machine + content-freeze ≥`concluida`, gated
  `app.in_interview_rpc`) / `app.guard_interview_child_lock` (keys on PARENT status; subjects+interviewers
  only — **attachments excluded**) / `app.guard_interview_links` (commission-honesty + phase-in-case →
  check_violation) / `app.mint_interview_number` (advisory-lock, mirrors meeting number) /
  `app.assert_interview_writable(interview)` (→ HC039). `app.assert_interviews_enabled()` gate;
  `public.interviews_enabled()` + `public.interview_viewer_can_write(interview)` DEFINER reads. No seed-on-commission
  trigger (interviews are created per-case, not per-commission). **IV2 (2026-07-14):** adds
  `app.commission_of_session(session)` + `app.assert_session_writable(session)` (resolve `interview_id`, delegate to
  the interview equivalents → HC039) driving `interview_sessions` RLS/RPCs; `guard_interview_status` rewritten for
  the English-key §4 machine incl. `awaiting_follow_up` (content-freeze at `completed`); `guard_interview_child_lock`
  now also fronts `interview_sessions`. `case_interviews` scheduling cols dropped; a session carries them.
- **Phase 8 (dashboards):** `app.submitted_form_responses(form)` — the canonical "dashboard-countable"
  response-id set (`status='submitted' AND case_phase_id IS NULL AND form_id=…`); TS twin
  `isDashboardCountable` in `dashboard.ts` (ADR 0020). `app.latest_published_version(form)` — labels/
  sections for cross-version aggregation.
- **Phase 14a (patient-safety/NSP, ADR 0030/0031):** `app.is_pqs_member(uid)` — PQS-staff/admin predicate (mirrors the uid-pure `..._for` helpers). `app.can_read_event(event, uid)` — **DEFINER, uid-pure** access-follows-custody predicate driving the SELECT policy on `patient_safety_event` + `event_patient` + `event_custody` (current custodian OR reporting-commission provenance OR PQS/admin). `app.guard_event_status` (state machine + freeze@triaged, gated `app.in_safety_rpc` → HC043) / `app.guard_event_custody` (append-only ledger: rejects closed-interval edit, non-`held_until` column edit, DELETE → HC043) / `app.event_current_custodian(event)` (the HC044 gate) / `app.mint_event_code` (global advisory-lock `EV-%04d`, mirrors meeting/interview numbering). `app.assert_patient_safety_enabled()` gate (raises 23514 when OFF); `public.patient_safety_enabled()` DEFINER boolean (TS-layer read). **PHI isolation:** identifiers live ONLY in `event_patient`; never selected on queue/aggregate/timeline paths; every `getEventPatient` read emits a Phase-13 `event_patient.read` audit row with empty metadata.
- **S1·N (notifications, ADR 0076), internal DEFINER (schema `app`, NOT public — no `authenticated` grant):**
  `app.enqueue_notification(user, commission, kind, milestone, is_reminder, entity_type, entity_id, title,
  body, dedup_key) → boolean` — the SOLE `notifications` insert door; idempotent
  (`ON CONFLICT (user_id, dedup_key) DO NOTHING`); returns false / never raises on flag-OFF, missing arg,
  dedup collision, or a disabled reminder surface (assignments — `is_reminder=false` — never suppressed);
  called from the 9 event-hook host mutations AND `compute_due_notifications`. `app.resolve_notifications_for(entity_type, entity_id)` —
  stamps `resolved_at` on unresolved **reminders** of an entity (assignments untouched); called from the
  CAPA-close / sign-off-sign / meeting-conclude mutations. `app.assert_notifications_enabled()` gate
  (raises `23514` when OFF; mirrors `assert_response_correction_enabled`).
- **ETH·E1 access spine (ADR 0072)** — all `security definer`, **R6-safe over BASE tables**. See the
  **E1** section for the map and the ⚠ three-shapes rule.
  `app.is_case_respondent(case, uid)` / `app.is_recused_from_case(case, uid)` — the two **hard denies**,
  fed FIRST into `can_read_case` / `can_read_case_patient` / `can_write_case_content`.
  `app.is_case_excluded(case, uid)` = either — the **conjunct** form (`AND NOT is_case_excluded(…)`)
  applied to the bare-admin `FOR ALL` write policies (a no-op for every non-excluded user).
  **`app.can_read_case_or_admin(case, uid)`** — denies FIRST, THEN ORs the commission-admin arm.
  **Every case-scoped policy needing an admin arm MUST use this**: ORing the admin arm *outside* the
  DEFINER out-votes the m2 deny (QA MAJOR-1).
  **`app.can_reach_case_on_member_surface(case, uid)`** (ADR 0072 D2·8) — the **member-facing** reach
  predicate: excluded ⇒ false; `explicit_grants_only` ⇒ `can_read_case_or_admin`; `commission_default`
  ⇒ member-wide reach **unchanged**. Use on member-facing surfaces (meeting case-labels, board, Meus
  Casos, timeline refs) — `can_read_case` has **no plain-member arm** by design (the `case_access` flag is retired — single path), so
  gating those on it **silently deletes ordinary members' reach of ordinary cases**.
  `app.can_read_interview(interview, uid)` — case read + the confidentiality ceiling; covers all 7
  interview-family SELECT policies in one place.
  `app.attachment_confidentiality_ok(owner_type, owner_id, label, uid)` / `app.confidentiality_clearance_ok(
  case, label, uid)` — the **document ceiling** (`legal_privileged` + `credentialing_sensitive` only — O2;
  `ethics_investigation` stays at ordinary case-read). Clearance rides `case_access_grants.max_confidentiality`
  **only**: **no admin bypass** and **no coordinator arm** — an uploading `staff_admin` without a
  clearance grant is denied (the accepted D5 deviation; the E2/E3 UX follow-up is self-clearance-on-upload).
  `app.confidentiality_rank(label)` — the **authoritative** sensitivity ordering; `ethics_investigation`=4
  ranks **below** `legal_privileged`=5. **Do NOT** re-order it to match the union's declaration order (the
  picker's display order): that would let an `ethics_investigation` clearance open legal-privileged docs.
  `app.can_manage_professional(org, uid)` · `app.assert_case_participants_enabled()` (gates the whole
  ethics write spine) · `app.normalize_interview_confidentiality()` (trigger — maps IV2's legacy 3-value
  input to the 7-value taxonomy, which is why `create_interview`/`update_interview` needed no reproduction).

## Feature flags (`app.feature_flags`)

| Flag | State | Notes |
| ---- | ----- | ----- |
| `signoff_enforcement` | **ON** (Phase 6, migration `…090001`) | `submit_response` blocks submission until every VISIBLE `requires_signoff` section is signed → **P0012**. Was OFF in Phases 1–5 (ADR 0004). |
| `cases_multi_phase` | **ON** (Phase 7, migration `…090008`) | Gates every Phase-7 cases RPC. Inserted OFF in `…090004`; flipped ON by the separate one-line `…090008` (mirrors the `signoff_enforcement` flip). The feature is live. |
| `cases_extras` | **ON** (Extras, migration `…092006`) | Gates the Cases-Extras + outcome WRITE surface: the **OUTCOME** RPCs (`set_case_outcome`, `set_process_outcomes`, outcome vocab CRUD — ADR 0024); R3 tag CRUD/assign; R4 action-item authoring + lifecycle; R1 document/event actions via `cases_extras_enabled`. (The R2 `set_case_status` + status CRUD it formerly gated were REMOVED by ADR 0024.) Inserted OFF in `…092001`; flipped ON by `…092006`. The core phase RPCs (`activate_phase`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`close_case`/`cancel_case`/`create_case_from_template`/`set_template_phase_blocks`) gate ONLY `cases_multi_phase`. |
| `meetings` | **ON** (Phase 10, migration `…090008`) | Gates every Phase-10 meetings RPC + the TS-layer table writes via `public.meetings_enabled()`. Inserted OFF in `…090000`; flipped ON by `…090008` (enabled in-phase so the gate exercised the live feature — same pattern as `cases_multi_phase`). |
| `interviews` | **ON** (Phase 11, migration `…091004`) | Gates every Phase-11 interviews RPC + the TS-layer writes via `public.interviews_enabled()`. Inserted OFF in `…091000`; flipped ON by `…091004` (enabled in-phase — same pattern as `meetings`). |
| `audit_trail` | **ON** (Phase 13, migration `…120003`) | `app.audit_write` no-ops while OFF; the AFTER-triggers + `log_audit_access` capture once ON. TS-layer reads via `public.audit_trail_enabled()`. Inserted OFF in `…120000`; flipped ON by `…120003` (in-phase). |
| `patient_safety` | **ON** (Phase 14a, migration `…121003`) | Gates every Phase-14a NSP RPC via `app.assert_patient_safety_enabled()` + the TS-layer reads via `public.patient_safety_enabled()`. Inserted OFF in `…121000`; flipped ON by `…121003` (in-phase — same pattern as `audit_trail`). Establishes Architecture Rule 12 (PHI/HIPAA — first PHI). |
| `case_access` | ⛔ **RETIRED** (Stage B, migration `20260802000000`; ADR 0078) | **Dropped from `app.feature_flags` — no longer a live flag.** Stage B cut the store `public.case_access` → `public.case_access_grants` and collapsed this flag to a single always-on path (`public.case_access_enabled()` → `true`; `assert_case_access_enabled` gone; the flag-OFF `is_member_of` fallback DELETED, D9). *History:* inserted OFF `…110000`, flipped ON `…110004` (Case Access increment, ADR 0033); while it existed it gated the grant / narrative-lifecycle / `list_my_cases` RPCs + the content-write broadening + the grant UI. |
| `case_referrals` | **OFF** (Phase 22, inserted in `…013000`; ADR 0037) | Gates every Phase-22 referral RPC via `app.assert_referrals_enabled()` + the TS-layer reads via `public.referrals_enabled()`, AND three flag-gated cross-cutting terms: the `app.can_read_case` QPS macro-read, the `close_case` HC076 gate, and the `case-documents` snapshot-doc OR-term. **Ships OFF** (like `audit_trail`/`patient_safety` pre-flip); the E2E gate flips it ON. Flag-OFF behavior is byte-identical to pre-Phase-22 at every touched function. |
| `quality_indicators` | **ON** (Phase 15, migration `…000300`; ADR 0057/0058) | Gates every Phase-15 indicator RPC + the TS-layer reads via `public.quality_indicators_enabled()` / `qualityIndicatorsEnabled()`. Inserted OFF in `20260712000000`; flipped ON by `…000300` (in-phase, same pattern as `patient_safety`). Note: the indicator→CAPA arm additionally needs `patient_safety` ON (CAPA lives in the NSP module). |
| `controlled_docs` | **ON** (Phase 17, migration `…013000400`; ADR 0057) | Gates every Phase-17 controlled-document RPC via `app.assert_controlled_docs_enabled()`; the TS layer reads it via `controlledDocsEnabled()` (delegates to the consolidated `get_feature_flags()`). Seeded OFF in `20260713000000`; enabled locally via `seed.sql` for the test gate; flipped ON for prod by the Record-step `…013000400` (deliberate deferred flip). PHI-free module (Rule 12 N/A). |
| `notifications` | **ON** (S1·N, migration `…000720`; ADR 0076) | **21st flag.** Gates the notification engine — `app.assert_notifications_enabled()` on the write RPCs, and `app.enqueue_notification`/`app.resolve_notifications_for`/`compute_due_notifications` all no-op when OFF (so the 9 event-hook splices are inert + a scheduled scan is harmless). TS layer reads via `notificationsEnabled()` (delegates to `get_feature_flags()`). Inserted OFF in `20260720000700`; flipped ON by the gate-flip `…000720`; `seed.sql` forces ON for local/E2E. Flag-OFF preserves byte-for-byte pre-N behaviour (shell renders no bell). PHI-free by construction (Rule 12). |
| `case_participants` | **ON** (E1, migration `…001040`; ADR 0064/0072) | **The m2 hard gate — released by E1.** Seeded OFF at F1; flipped ON only once respondent-exclusion RLS landed. Gates the ethics write spine via `app.assert_case_participants_enabled()`. **Local only** — never `db push`ed this phase; prod flips at the deliberate pilot reset. RLS is live regardless of the flag (the flag gates RPC reachability, never the boundary). |
| `matrix_fields` | **ON** (FF-2, migration `…001200`; ADR 0089) | Gates `upsert_matrix_axes` + both matrix answer writers (`HC0P2`) and the builder's matrix types; TS reads via `matrixFieldsEnabled()`. Seeded **OFF** in `20260830000100`; flipped ON by the gate-flip `…001200`; `seed.sql` forces ON for local/E2E. **READ paths are ungated** - a stored grid renders either way, so the flag governs authoring + filling only. |
| `entity_refs` | **ON** (FF-5, gate-flip `20260902000600`; ADR 0091) | Gates `app.save_reference_answers` and `public.reference_candidates` (both raise `HC0Q3`), the reference arms of both save paths, and the builder's `reference` type. Seeded **OFF** in `20260902000000`; flipped by `20260902000600_enable_entity_refs.sql`; `seed.sql` forces ON for local/E2E. **READ paths are ungated** - a stored reference still projects and aggregates, so the flag governs authoring + filling only (same posture as `matrix_fields`). |
| `power_authoring` | **ON** (FF-4, gate-flip `20260903000600`; ADR 0092) | Gates all four block-library DEFINER doors, `app.seed_default_answers`, and the builder's library browser + dynamic-default selector. Seeded **OFF** in `20260903000000`; flipped by `20260903000600_enable_power_authoring.sql`; `seed.sql` forces ON for local/E2E. **READ paths are ungated** - an inserted block is ordinary form structure and a stored `default_value` still applies, so the flag governs authoring + draft-start seeding only (same posture as `matrix_fields`/`entity_refs`). ⚠ **This flip has no later phase behind it**: FF-4 is the last of the five phases gating the pilot (ADR 0086 ruling 2), so the next `db push` is the pilot's - an absent flip would have gone dark straight into the customer pilot. |
| `item_validations` | **ON** (FF-3, gate-flip `20260901000800`; ADR 0090) | ⚠ This row read "**the gate-flip migration does NOT exist yet**" until FF-5 - it does: `20260901000800_enable_item_validations.sql`, verified against the tree. Seeded OFF in `20260901000000`; flipped by `…000800`; `seed.sql` forces ON for local/E2E. Gates BOTH sides: `set_item_validations` raises `HC0Q0`, `get_response_validation_errors` returns the EMPTY SET, and the `required_if` layer + the `HC0P9` gate are skipped inside `submit_response`/`app.response_required_complete` (the flag is read ONCE per call and the `required_if` argument nulled at the call site, so the predicate stays IMMUTABLE). TS reads via `itemValidationsEnabled()`. **Fail-closed in a specific way**: with the flag OFF the writer raises `HC0Q0`, so a rules editor offered anyway is a dialog whose save can never succeed. ⚠ Without the flip, `db push` ships the phase DARK while local stays green - FF-2's review blocker. |
| `case_types` | **ON** (E1, migration `…001040`; ADR 0064/0072) | The other half of the m2 gate. Gates the `create_case_from_template` type→case snapshot (`p_case_type_id` is ignored while OFF ⇒ `commission_default`/`non_phi_internal`). |
| `accreditation` | **ON** (Phase 16, gate-flip `20260904000100`; ADR 0093) | Gates ALL 15 `public.*` accreditation RPCs (framework CRUD, evidence/assessment, the 3 readiness read doors) via `app.assert_accreditation_enabled()` → `HC0Q9`, called FIRST in every one. Seeded **OFF** in `20260903000800_accreditation_schema.sql`; flipped by `20260904000100_enable_accreditation.sql`; `seed.sql` forces ON for local/E2E. **Unlike `matrix_fields`/`entity_refs`/`power_authoring`, READ paths are gated too** — this is a brand-new module with no pre-existing ungated behavior to preserve, so there is no "reads still work while OFF" carve-out. Full surface → the P16 section above. |

## RLS authorization surface (who can do what)

- **Builder mutation surface** — `forms`, `form_versions`, `form_sections`,
  `form_items` grant ALL to `staff_admin` of the commission + admin. Published
  immutability is **trigger-enforced**, not RLS. Draft edits need no new RLS.
- **Responses/answers** — creator alone reads/edits their `in_progress` response +
  answers. One draft per (version, user) via `responses_one_draft_per_user_idx`.
  Submitted responses/answers/signoffs are immutable (triggers). **Staff_admins
  deliberately CANNOT read another member's in_progress answers** via general RLS —
  the Phase-7 invariant; the sign-off queue/review uses the DEFINER RPCs above instead.
- **Sign-offs** — `signoffs_insert` enforces the signer-role rule in the DB
  (respondent → `created_by`; staff_admin → `is_staff_admin_of`, `signed_by =
  auth.uid()`, in_progress only). `signoffs_select` lets creator/admin/staff_admin read.
- **Storage** (`form-assets`) — members read, staff_admin upload; no UPDATE/DELETE
  (immutable paths). Service role never used on the display/upload path.
- **Cases-Extras + outcome child entities** — `case_documents`, `case_events`, `case_tags`,
  `case_tag_assignments`, `case_action_items`, and (ADR 0024) `case_outcomes` (direct
  `commission_id`), `process_template_outcomes` (via `app.commission_of_template_version`
  since ADR 0096 — it was `commission_of_template`),
  `case_offered_outcomes` (via `app.commission_of_case`) all grant member-READ / staff_admin-WRITE.
  (`case_status_defs` was DROPPED — ADR 0024.) An action-item ASSIGNEE who is a plain staff member
  does NOT get a broad UPDATE — they move status only via the narrow `advance/complete_action_item`
  DEFINER RPC (assignee-or-staff_admin gate). Document "delete" is a SOFT delete (row hidden, object
  retained); reads filter `deleted_at is null`.
- **Storage** (`case-documents`) — members read, staff_admin INSERT; NO UPDATE/DELETE
  (immutable, Rule 6). Path `{commission_id}/{case_id}/{uuid}.{ext}`; `foldername[1]` = commission.
  Reads via signed URLs (cookie client). 25 MiB, MIME allow-list (PDF/images/Word/Excel/CSV/plain).
- **Submitted cross-member read (Phase 8)** — `responses_select`/`answers_select` ALREADY grant a
  staff_admin read of ANOTHER member's `status='submitted'` response+answers (the dashboard/
  submissions browser path); `in_progress` stays creator-only. **No Phase-8 RLS change** — the
  Phase-7 in_progress-answers invariant is preserved at every dashboard/list/detail/export path.
- **Anon grants (Phase 8 B6)** — `anon` now has **zero** DML/EXECUTE on `public` (revoked from anon
  AND the implicit PUBLIC role; durable default-privilege revoke). `authenticated`/`service_role`
  retain explicit grants. pgTAP guards "zero anon-executable public functions".
- **Meetings (Phase 10)** — `meetings`, `commission_meeting_types`, `commission_meeting_settings`,
  `meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, `meeting_action_items` grant
  member-READ / staff_admin-WRITE (child tables resolve commission via `app.commission_of_meeting`;
  action items via denormalized `commission_id`). `meeting_signatures` — members read; INSERT is
  **sign-own-row** (`signer_id = auth.uid() AND app.can_sign_meeting(...)`); no broad UPDATE/DELETE
  (revoke flows through `reopen_meeting`/`sign_meeting`). Meeting content (minutes/agenda/attendees/
  case-links) **freezes at `em_assinatura`** (the child-lock trigger, keyed on parent status).
  Storage (`meeting-attachments`) — members read, staff_admin INSERT, NO update/delete (immutable,
  Rule 6); path `{commission_id}/{meeting_id}/{uuid}.{ext}`; reads via signed URLs. External guests
  are name/org free-text only (no account, cannot sign) — **no patient data** anywhere.
- **Interviews (Phase 11)** — the NEW write shape: `case_interviews` SELECT = member; **INSERT =
  staff_admin/admin** (bootstrap); **UPDATE/DELETE = `app.can_write_interview(id, auth.uid())`** (staff_admin/admin
  OR a registered interviewer of that interview). The 3 child tables (`case_interview_subjects`/
  `_interviewers`/`_attachments`) SELECT = member-of-`commission_of_interview`; write = `can_write_interview`
  (FOR ALL). So a registered interviewer who is a plain `staff` member can edit/conclude THEIR interview;
  a non-interviewer staff cannot (HC039). Content (subjects/interviewers) **freezes at `concluida`/`cancelada`**
  (child-lock keyed on parent status); **attachments are NOT frozen** (late signed transcript). Storage
  (`interview-attachments`) — members read (path seg [1] = commission); **INSERT keyed on seg [2] = interview_id
  via `can_write_interview`** (so a registered interviewer uploads, not just staff_admin); NO update/delete
  (immutable, Rule 6); path `{commission_id}/{interview_id}/{uuid}.{ext}`; reads via signed URLs; audio is
  LINK-only (no audio bytes). Subjects/interviewers are platform-user XOR name/org free-text — **no patient
  data** (interviewees are STAFF, never patients).
- **Patient-safety / NSP (Phase 14a — FIRST PHI; ADR 0030/0031; reverses the platform's prior "no patient data" rule under Architecture Rule 12):** `patient_safety_event` + the isolated PHI satellite `event_patient` + the append-only `event_custody` ledger all SELECT via the single **access-follows-custody** predicate `app.can_read_event(id, auth.uid())` = current custodian's commission OR the **reporting** commission (provenance, retained across hand-offs) OR PQS/admin. **No INSERT/UPDATE/DELETE policy** on any of the three — every write goes through a DEFINER RPC. A foreign committee sees nothing (route gating + RLS, not UI hiding). **PHI is minimum-necessary + isolated:** identifiers live ONLY in `event_patient`, never on the queue (`pqs_inbox`)/list/aggregate/timeline paths, and every read of it emits a Phase-13 `event_patient.read` audit row (empty metadata). `pqs_department` (non-PHI singleton config) SELECT = any authenticated member (`…121005`); writes DEFINER-only.
- **Quality indicators (Phase 15; PHI-FREE; ADR 0057/0058) — RLS posture (b):** `indicators` + `indicator_measurements` grant **member-READ SELECT only** (a commission-member read policy + SELECT grant); **NO direct INSERT/UPDATE/DELETE policy or grant** — every write flows through a DEFINER RPC whose authority is `is_staff_admin_of OR is_tenancy_admin_of`, which also guarantees `value`/`status` are always RPC-computed (a plain staff RPC-write → 42501, a direct INSERT → permission denied, and the invoker `reclassify_*` UPDATE is denied too — defense-in-depth). Reads scope per-commission (a foreign-commission member sees nothing). `hospital_indicator_rollup` returns **PHI-free counts only** (no name/code/title columns) and re-gates per hospital. The two CAPA FKs (`capa_plan.source_indicator_id`, `capa_measure.indicator_id`) are ON DELETE SET NULL.

## SQLSTATE → meaning (data-layer maps these to pt-BR; no raw PG errors reach the UI)

The CUSTOM codes use the `HC0xx` class ("Hospital Commission"), renumbered from `P00xx` in
migration `…090009` so PostgREST 14 returns **400 + JSON `{code,message}`** (unknown class)
rather than a 500 that drops the body for non-ASCII messages (ADR 0018). The standard codes
(`P0002` no_data_found → 404, `23505`, `23514`, `42501`) are unchanged.

| Code | Meaning | Example pt-BR mapping |
| ---- | ------- | --------------------- |
| `P0002` | not found | "Resposta não encontrada." |
| `HC010` | already submitted | "Resposta já enviada." |
| `HC011` | required answer missing | "Há perguntas obrigatórias sem resposta." |
| `HC012` | sign-off pending | "Há seções pendentes de assinatura." |
| `HC013` | invalid cross-version item/section | "Dados inválidos para este formulário." |
| `HC014` | section not available / not visible | "Seção não disponível para assinatura." |
| `HC015` | already signed (unique race) | "Seção já assinada." |
| `HC016` | invalid template / recommend_when (from_phase / absent key / referenced slot) | "A condição de recomendação é inválida." |
| `HC017` | form has no published version | "O formulário desta fase ainda não foi publicado." |
| `HC018` | phase blocked by its blockers (ADR 0024; reworded from "not sequentially activatable") | "Conclua ou marque as fases que bloqueiam esta antes de ativá-la." |
| `HC019` | phase wrong state | "Esta fase não está no estado necessário para esta ação." |
| `HC020` | case not open (terminal) | "Este caso não está aberto." |
| `HC021` | assignee not a member | "O responsável deve ser membro da comissão." |
| `HC022` | caller not the assignee | "Apenas o responsável pode preencher esta fase." |
| `HC023` | template not in an archivable state | "Este processo não pode ser arquivado." |
| `HC024` | ~~invalid case status key~~ **RETIRED** (ADR 0024 — the configurable status vocab was removed; status is now a fixed CHECK enum) | — |
| `HC025` | case already in a terminal status (frozen) | "Este caso está em um estado final e não pode mais ser alterado." |
| `HC026` | tag/case commission mismatch | "Esta etiqueta não pertence à comissão deste caso." |
| `HC027` | not entitled to update this action item | "Você não pode alterar este item de ação." |
| `HC028` | conclude: process offers outcomes but none chosen (ADR 0024) | "Selecione um desfecho antes de concluir o caso." |
| `HC029` | outcome not in the case's frozen offered set (ADR 0024) | "Este desfecho não está disponível para este caso." |
| `HC030` | process/outcome commission mismatch (ADR 0024) | "Este desfecho não pertence à comissão deste processo." |
| `HC031` | conclude: unsettled (pendente/ativa) phases remain (ADR 0024) | "Conclua ou marque todas as fases antes de concluir o caso." |
| `HC032` | meeting/case (or action-item) commission mismatch (ADR 0025) | "Este caso não pertence à comissão desta reunião." |
| `HC033` | meeting wrong state for the lifecycle op (ADR 0025) | "A reunião não está no estado necessário para esta ação." |
| `HC034` | conclude: no attendee marked present (ADR 0025) | "Registre ao menos um participante presente antes de concluir." |
| `HC035` | meeting already signed (unique race) (ADR 0025) | "Você já assinou esta reunião." |
| `HC036` | not entitled to sign (not a present platform attendee) (ADR 0025) | "Você não pode assinar esta reunião." |
| `HC037` | not entitled to update this meeting action item (ADR 0025) | "Você não pode alterar este item de ação." |
| `HC038` | interview wrong state for the lifecycle op (ADR 0026) | "A entrevista não está no estado necessário para esta ação." |
| `HC039` | not entitled to write this interview (not staff_admin nor a registered interviewer) (ADR 0026) | "Você não pode editar esta entrevista." |
| `HC040` | invalid attachment (storage_path XOR external_url violated, or non-https link) (ADR 0026) | "Anexo inválido: envie um arquivo OU informe um link https." |
| `HC041` | conclude: interview has no interviewee (ADR 0026) | "Adicione ao menos um entrevistado antes de concluir." |
| `HC042` | append-only audit violation (ADR 0029) — **internal, never user-facing** | (not surfaced; `AUDIT_MESSAGES.appendOnly` is the TS fallback) |
| `HC043` | safety-event wrong state / custody-ledger immutable violation (ADR 0031) | "O evento não está no estado necessário para esta ação." |
| `HC044` | not the current custodian of the event (ADR 0031) | "Apenas o atual responsável pode transferir a custódia deste evento." |
| `HC055` | narrative wrong lifecycle state — assign/conclude needs `aberta`, reopen needs `concluida` (ADR 0033) | "A narrativa não está no estado necessário para esta ação." |
| `HC070` | referral wrong status for the lifecycle op / status guard (ADR 0037) | "O encaminhamento não está no estado necessário para esta ação." |
| `HC071` | not the source coordinator (send/withdraw/curate) (ADR 0037) | "Apenas a coordenação da comissão de origem pode realizar esta ação." |
| `HC072` | not the target coordinator (receive/accept/decline/reply) (ADR 0037) | "Apenas a coordenação da comissão de destino pode realizar esta ação." |
| `HC073` | snapshot frozen — shared-item mutation after send (ADR 0037) | "O conteúdo compartilhado não pode ser alterado após o envio." |
| `HC074` | reply shape invalid (outcome/ack inconsistency) (ADR 0037) | "A resposta está inconsistente. Revise o desfecho e o resultado." |
| `HC075` | conclude: reply-expecting referral missing `result_md`/outcome (ADR 0037) | "Para concluir, registre o resultado e o desfecho da análise." |
| `HC076` | `close_case` blocked — a reply-expecting referral is in flight (ADR 0037) | "Há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso." |
| `HC077` | shared-item one-of shape invalid (`kind` vs narrative/document) (ADR 0037) | "O item compartilhado está inconsistente com o tipo selecionado." |
| `HC078` | `set_referral_patient` not entitled, or the referral is concluded (ADR 0037) | "Você não pode registrar dados do paciente neste encaminhamento." |
| `HC079` | target-case link invalid — case not in the target commission (ADR 0037) | "O caso selecionado não pertence à comissão de destino." |
| `HC07A` | referral vocabulary (`referral_types`/`reply_outcomes`) CRUD violation (ADR 0037) | "Não foi possível alterar o vocabulário de encaminhamentos." |
| `HC084` | invalid derived config / unknown option code (Phase 15, ADR 0058) | "Configuração derivada inválida ou código de opção desconhecido." |
| `HC085` | measurement op used the manual path on a derived indicator, or compute on a manual one — "is-manual" (Phase 15) | "Este indicador é manual; use o lançamento manual." |
| `HC086` | "is-derived" — manual record attempted on a derived indicator (Phase 15) | "Este indicador é derivado; use o cálculo automático." |
| `HC087` | measurement denominator is zero (Phase 15) | "O denominador deve ser diferente de zero." |
| `HC088` | hybrid first compute without a denominator (Phase 15) | "Informe o denominador." |
| `HC089` | controlled-doc wrong-state (out-of-RPC status write, illegal transition, edit past `rascunho`, publish a non-`em_aprovacao` version) (Phase 17) | "Esta versão não está no estado necessário para esta ação." |
| `HC090` | publish with any approval pending/`rejeitado` — all named approvers must approve first (Phase 17) | "Todos os aprovadores devem aprovar antes de publicar." |
| `HC091` | approver not entitled — not an active same-hospital user (Phase 17) | "Aprovador não pertence a este hospital ou está inativo." |
| `HC092` | duplicate approver named on a version (Phase 17) | "Aprovador informado em duplicidade." |
| `HC093` | frozen approver set — roster changed while `em_aprovacao` (Phase 17) | "A lista de aprovadores não pode ser alterada durante a aprovação." |
| `HC0C0` | invalid notification preference surface (S1·N, ADR 0076) | "Superfície de notificação inválida." |
| `HC0C1` | notification not found / not owned by the caller (S1·N, ADR 0076) | "Notificação não encontrada." |
| `HC0E0` | live-recusal partial-unique — already recused (E1) | "Recusa já registrada para este usuário neste caso." |
| `HC0E1` | recusal not found / already lifted (`lift_recusal`; E1) | "Recusa não encontrada ou já suspensa." |
| `HC0E2` | duplicate conflict declaration for this user+case (E1) | "Você já declarou um conflito neste caso." |
| `HC0E3` | role invalid for the participant type (E1) | "Papel inválido para este tipo de participante." |
| `HC0E4` | write-authority gate — coordination-only participant/recusal management (E1) | "Apenas a coordenação pode gerenciar participantes deste caso." |
| `HC0E5` | invalid confidentiality level (E1) | "Nível de confidencialidade inválido." |
| `HC0E6` | document confidentiality ceiling — no clearance (E1; D5/O2) | "Sem autorização para abrir este documento confidencial." |
| `HC0E7` | more than one active primary subject (E1) | "Não é possível definir mais de um sujeito principal ativo." |
| `HC0E8`–`HC0E9` | **reserved** (E1 growth) | — |
| `HC0N0` | repeating-groups feature flag OFF (FF-1, ADR 0087) | "Recurso indisponível." |
| `HC0N1` | `maxInstances` reached on a repeating group (FF-1) | "Este bloco aceita no máximo N item(ns)." |
| `HC0N2` | group instance not found / not this response (FF-1) | "Item do bloco não encontrado nesta resposta." |
| `HC0N3` | reorder list is not a permutation of the group's instances (FF-1) | "A nova ordem não corresponde aos itens deste bloco." |
| `HC0N4` | item is not a `repeating_group` of this response's version (FF-1) | "Este item não é um bloco repetível deste formulário." |
| `HC0N5` | `minInstances` unmet at submit, AFTER empty-instance pruning (FF-1; distinct from HC011 on purpose) | "O bloco X exige ao menos N item(ns) preenchido(s)." |
| `HC0P0` | matrix axis `code` is immutable (FF-2, ADR 0089 ruling 4) | "O codigo de um item da matriz nao pode ser alterado..." |
| `HC0P1` | cell row/col does not belong to the answer's item (FF-2 INFO-4) | "A linha/coluna da matriz nao pertence a esta pergunta." |
| `HC0P2` | `matrix_fields` flag OFF (FF-2) | "O recurso de matrizes nao esta disponivel." |
| `HC0P3` | item not found / not a matrix of this version (FF-2) | "Esta pergunta nao e uma matriz." |
| `HC0P4` | version is not a draft (FF-2) | "Apenas versoes em rascunho podem ser editadas." |
| `HC0P5` | invalid axis payload - blank/duplicate code or position (FF-2); also the publish-time "grid needs >=1 row and >=1 column" | "Verifique as linhas e colunas da matriz..." |
| `HC0P6` | `risk_matrix` axis entry without a weight (FF-2 ruling 2) | "A matriz de risco exige um peso em todas as linhas e colunas." |
| `HC0P7` | unknown row/column code in an answer payload (FF-2) | "A linha/coluna ... nao pertence a esta matriz." |
| `HC0P8` | incomplete risk answer - needs BOTH severity and likelihood (FF-2) | "Informe a severidade e a probabilidade da matriz de risco." |
| `HC0P9` | an **`error`-severity validation rule** blocked the submit (FF-3, ADR 0090 ruling 3) | The AUTHOR's own pt-BR rule message, raised verbatim - a constant here would defeat the point of letting a staff_admin write it. Rendered as **TEXT**, never markup (Rule 7). `submitResponse` prefers `error.message` and also returns the rows as `SubmitActionState.validationErrors`. |
| `HC0Q0` | `item_validations` flag OFF (FF-3) | "O recurso de validacoes nao esta disponivel." |
| `HC0Q1` | item not found / **coverage** denial - this `item_type` (or parent) may not carry this `rule_type` / version incoherence (FF-3 ruling 2) | "A pergunta do tipo X nao aceita a validacao Y." Raised by BOTH `set_item_validations` and the `app.guard_item_validation_row` trigger, plus `app.guard_item_type_vs_validations` when an item_type change would orphan a rule. |
| `HC0Q2` | invalid rule **config** - no bound, inverted range, uncompilable/over-long `regex`, blank `message` (FF-3) | "Verifique a validacao: informe os limites e uma mensagem para quem responde." The DB message NAMES the offending rule and is preferred. |
| `HC0Q3` | `entity_refs` flag OFF (FF-5) | "O recurso de referencias nao esta disponivel." Raised by BOTH `app.assert_reference_answer_writable` (save) and `public.reference_candidates` (search), and mapped on BOTH paths - the search path had NO mapping until QA r2 M-2, which turned every raise into an empty candidate list and made the picker explain a flag outage as "this form has no linked case". |
| `HC0Q4` | item is not a `reference` item of this version (FF-5) | "Dados invalidos para este formulario." Raised by `app.save_reference_answers`, `app.guard_reference_coherent` and `reference_candidates`. |
| `HC0Q5` | reference target not reachable from this response (FF-5, ADR 0091 rulings 2+8) - wrong organization on any lane, or a `patient` participant not linked to THIS response's case | Four distinct pt-BR sentences from `app.guard_reference_coherent`, so the **DB message is preferred** over a constant. ⚠ **SAVE PATH ONLY** - `reference_candidates` cannot raise it (the trigger fires on write), so an arm for it in the search would be dead code asserting a reachability that does not exist. |
| `HC0Q9` | `accreditation` flag OFF (Phase 16, ADR 0093) | "O recurso de padrões de acreditação não está disponível." Raised by `app.assert_accreditation_enabled`, called FIRST by all 15 `public.*` accreditation RPCs — both the CRUD/evidence/assessment writers AND the 3 readiness read doors (unlike `matrix_fields`/`entity_refs`/`power_authoring`, this module gates reads too — there is no pre-existing ungated behavior to preserve). |
| `HC0QA` | evidence artifact not reachable from / not linkable by the linking commission (Phase 16, ADR 0093 D4) | Raised by `link_evidence` via `app.artifact_belongs_to_commission` — one arm per `ArtifactKind` (10-way), fail-closed `coalesce(..., false)` for an unreachable artifact, `raise` for an unrecognized kind. |
| `HC0QB` | duplicate evidence link (Phase 16) | `evidence_links_unique (commission_id, standard_id, artifact_kind, artifact_id)` — `link_evidence` pre-checks and raises this SQLSTATE rather than surfacing the raw `23505`. |
| `HC0QC` | invalid target - framework/standard/hospital/level (Phase 16) | One SQLSTATE shared across 8 call sites (`update_framework`, `set_framework_status`, `clone_framework`, `upsert_standard`, `delete_standard`, `link_evidence`, `set_standard_ownership`, `set_standard_assessment`) for a family of "the referenced row does not exist / does not belong here" checks — framework or standard not found, `standard_ownerships`' hospital-ownership pre-check (belt-and-suspenders ahead of the `guard_standard_ownership_hospital` trigger's `23514`), invalid `level` for the D3 3-level model. Several distinct pt-BR messages by call site; the DB message is preferred, same convention as `HC0Q5`. |
| `HC0QD` | global-pack read-only via the commission-scoped RPC (Phase 16, ADR 0093 D6) | Raised by `update_framework` / `set_framework_status` / `upsert_standard` / `delete_standard` when the target framework's `owner_commission_id IS NULL` (a global pack) and the caller is not `is_admin()` — the mirror image of the sanctioned exception: `is_admin()` may edit the vocabulary, nobody else may edit it in place (clone it into a commission-owned draft instead, via `clone_framework`). |
| `HC0QE` | framework is `arquivado` (Phase 16) | Raised by `update_framework` / `upsert_standard` / `delete_standard` (3 call sites) — an archived framework's standards are frozen; only a NEW clone (`clone_framework`) may be edited. |
| - | **`HC0O*` remains deliberately SKIPPED** (`O` vs `0` in a SQLSTATE); **`HC0QF`+ are unallocated.** ⚠ This row has now gone stale THREE TIMES — it read "`HC0Q3`+ unallocated" until FF-5 took Q3–Q5, then "`HC0Q6`+ / high-water `HC0Q5`" until FF-4 took Q6–Q8, then "`HC0Q9`+ unallocated / high-water `HC0Q8`" until Phase 16's own Wave 0 catalog check (2026-08-03) pre-committed to the allocation confirmed here post-ship (2026-08-04): **Phase 16 took Q9, QA, QB, QC, QD AND QE** — `app.assert_accreditation_enabled` plus the rows immediately above. **Live high-water is `HC0QE`.** Do not trust this row — `select prosrc from pg_proc` is the only truth. FF-3 reuses **`HC0P4`** for draft-only rather than minting a second code with the same meaning and copy. **`HC0P0` and `HC0P4`-via-clone are deliberately UNMAPPED in the app layer**: the only axis UPDATE any app path issues is inside `upsert_matrix_axes`, which matches on `code` and never writes it (direct DML is denied by K9), and `clone_form_version` always creates a fresh draft. A `case` for an unreachable code reads as reachable and invites a test that cannot fail. | - |
| `23514` | check violation | "Publique um rascunho." / "já enviada." / "recurso indisponível" (context) |
| `23505` | unique violation | (resume race; question_key collision retry) |
| `42501` | RLS denied | forbidden (e.g. wrong signer role) |

## Data-access & action modules (Rule 9 — no inline supabase-js in UI)

- **FF-3 (ADR 0090) - the module SPLIT, and why it is not cosmetic.**
  `src/lib/forms/validation-rules.ts` holds the PURE half: the vocabulary consts, the per-rule config
  types, `ValidationRuleSpec`/`ItemValidationRule`/`ValidationRuleInput`/`RequiredIf`/`ValidationErrorRow`,
  and `evalValidation` / `itemIsRequired` / `isValidationRuleAllowed` / `validationValueIsEmpty`.
  `src/lib/queries/validations.ts` holds ONLY `getResponseValidationErrors` and **re-exports** the pure
  surface, so server callers import from one place.
  **The split is load-bearing**: the builder and the wizard value-import those helpers in the BROWSER, and
  a client component value-importing a module that transitively pulls `@/lib/supabase/server`
  (`import 'server-only'`) **aborts `next build`** while tsc, lint and Vitest all stay green
  (BUG-FBE-005). The precedent is `src/lib/forms/matrix.ts`, not `queries/conditions.ts` - the latter is
  pure but no client value-imports it, so it never proved the property. A static test in
  `queries/validations.test.ts` fails if the pure module regains a server import; it is the only check
  that fires at the moment the mistake is made.
- **FF-3 writers/readers** - `setItemValidations({itemId, rules})` in `src/lib/forms/actions.ts`
  (REPLACE semantics; maps `HC0Q0`/`HC0Q1`/`HC0Q2`/`HC0P4`/`42501`) * `required_if` rides the existing
  `addItem`/`updateItem` on the `requiredIf` FormData field, parsed by `parseRequiredIf` which accepts the
  SINGLE condition shape ONLY (the group shape is refused before the round trip, because
  `app.is_valid_condition` rejects it) * `Item.requiredIf` + `Item.validations` on the version tree in
  `src/lib/queries/forms.ts`, via an **FK-HINTED** `form_item_validations!form_item_validations_item_id_fkey`
  embed (the table FKs BOTH `form_items` and `form_versions`, the PGRST201 shape this repo already ate once)
  * `SubmitActionState.validationErrors` on **both** submit paths in `src/lib/responses/actions.ts`.
  ⚠ **The read path is what makes the writer safe**: `set_item_validations` REPLACES, so a builder that
  opened without hydrating `Item.validations` and then saved would DELETE every existing rule on the item.
  `itemValidationsEnabled()` in `src/lib/queries/feature-flags.ts`.

- Queries: `src/lib/queries/{session,commissions,members,forms,responses,signoffs,
  process-templates,cases}.ts` + the canonical helpers `answerableItems(tree)` and the
  submitted-responses filter. Cases: `listProcessTemplates`/`getProcessTemplate`;
  `listCasesBoard`/`getCaseDetail` (definer RPCs) + `getCasePhaseForFill` (RLS-scoped).
  **ADR 0096 adds the version-aware read surface** in `queries/process-templates.ts`:
  `listTemplateVersions` · `listProcessTemplateVersions` · `getProcessTemplateVersion` ·
  `getPublishedTemplateVersion` · `getDraftTemplateVersion` · `getProcessTemplateWithVersion` ·
  `getCaseTemplateProvenance`; and in `process-templates/actions.ts`:
  `cloneTemplateVersion` · `beginTemplateEdit` · `publishTemplateVersion` ·
  `discardTemplateDraft` · `archiveTemplateVersions`.
- Actions: `src/lib/{auth,admin,members,forms,responses,process-templates,cases}/actions.ts`
  — `ActionState` shape, server-side authz re-check before write, pt-BR mapping.
- Domain types: `RecommendWhen = { from_phase } & VisibleWhen` is the only Phase-7 addition
  to `conditions.ts` (additive; evaluator/mirror/vectors UNCHANGED).
- **Phase 8:** `src/lib/queries/dashboard.ts` (`getFormDashboard`/`listDashboardForms`/`getCommissionOverview`/
  `getFormExport`/`isDashboardCountable`) + `src/lib/queries/submissions.ts` (`listSubmissions`/
  `getSubmissionDetail`/filter lists). CSV route handler `src/app/c/[slug]/dashboard/export/route.ts`
  (staff_admin/admin-gated, cookie client — no service role).
- **Cases-Extras:** Queries `src/lib/queries/{case-documents,case-tags,case-action-items}.ts`
  (`listCaseDocuments`/`getCaseDocumentDownloadUrl`/`listCaseEvents`; `listCaseTags`/
  `listCaseTagsForCase`/`getCaseTagReport`; `listCaseActionItems`/`getCaseActionItemKpis`).
  Actions `src/lib/cases/{documents-actions,tags-actions,action-items-actions}.ts` + the shared
  `src/lib/cases/extras-gate.ts` (`casesExtrasEnabled`). NOTE: `deleteActionItem` is a HARD delete;
  cancel = `advanceActionItem(id,'cancelled')`.
- **Case-model adjustments (ADR 0024):** **`src/lib/cases/case-status.ts`** is the fixed-status
  source of truth — `CaseStatus` (fixed 5-value union, NOT `CaseStatusKey = string` anymore),
  `CASE_STATUSES` (board order), `CASE_STATUS_META` (pt-BR label + colour token),
  `isTerminalCaseStatus`, and the re-homed `CaseStatusColorToken` (the shared palette, also used by
  tags/outcomes). Outcomes: queries `src/lib/queries/case-outcomes.ts` (`listCaseOutcomes(commission,
  includeArchived?)` / `listProcessOutcomes(template)`) + actions `src/lib/cases/outcomes-actions.ts`
  (`setCaseOutcome` / `createCaseOutcome` / `updateCaseOutcome` / `reorderCaseOutcomes` /
  `archiveCaseOutcome` / `setProcessOutcomes`). Blockers: `setTemplatePhaseBlocks(phaseId, blocks[])`
  in `src/lib/process-templates/actions.ts`. `cases.ts` `Case` gains `outcomeId`, `CasePhase` gains
  `blocks: number[]`, `CaseDetail`/board rows gain resolved `outcome` + `offeredOutcomes`;
  `process-templates.ts` `ProcessTemplatePhase` gains `blocks`, `ProcessTemplate` gains
  `offeredOutcomeIds`. **REMOVED:** `src/lib/queries/case-statuses.ts` + `src/lib/cases/status-actions.ts`
  (the R2 configurable-status modules).
- **Phase 10 (meetings):** Queries `src/lib/queries/{meetings,meeting-action-items}.ts`. Actions
  `src/lib/meetings/actions.ts` + `src/lib/meetings/messages.ts` (the SQLSTATE→pt-BR map is
  centralized here — a deliberate divergence from the inline cases pattern, noted in-file) +
  the `meetingsEnabled()` TS-layer gate. Attachment upload mirrors the case-documents flow; minutes
  render via the project's sanitizing Markdown renderer (Rule 7). Domain types are the frozen
  contract `frontend` built against (`MeetingStatus`/`MeetingModality`/`AttendeeRole`/`AttendanceStatus`/
  `SignatureStatus`/`MeetingAttachmentKind`/`QuorumRuleType`).
- **Phase 11 (interviews):** Queries `src/lib/queries/interviews.ts` (`listCaseInterviews(caseId)` —
  list items carry `subjectCount`/`subjectSummary`; `getInterviewDetail(id)` — carries
  `viewerCanWrite` (via the `interview_viewer_can_write` RPC), `commissionId`, `caseId`, `caseNumber`
  for the UI's write-gating + URL-consistency guards; `listInterviewSubjects`/`listInterviewInterviewers`/
  `listInterviewAttachments` — attachments expose BOTH `openUrl` (signed URL, non-null for stored files)
  and `externalUrl` (non-null for links), exactly one non-null; `interviewsEnabled()`). Actions
  `src/lib/interviews/actions.ts` + `src/lib/interviews/messages.ts` (centralized SQLSTATE→pt-BR map,
  mirroring meetings) + the `interviewsEnabled()` gate. `createInterview` returns `interviewId`;
  attachment upload mirrors the case-documents/meetings flow (`uploadInterviewAttachment` file +
  `addInterviewLink` https-only); summary renders via the sanitizing Markdown renderer (Rule 7). Domain
  types are the frozen contract `frontend` built against (`InterviewStatus`/`InterviewModality`/
  `InterviewerRole`/`InterviewAttachmentKind`). NOTE: every write action EXCEPT `createInterview` (staff_admin
  bootstrap) does NO staff_admin pre-check — a registered interviewer who is a plain `staff` member must pass;
  the RPC's `can_write_interview` gate (→ HC039) is the authority. `InterviewSubjectInput.externalOrg` is
  OPTIONAL (the subject form need not collect it).
- **Phase 12 (case timeline, ADR 0027 — read-only, NO migration/RLS):** Pure model
  `src/lib/timeline/event-model.ts` (`CaseTimelineEvent`/`TimelineEventType`/`TimelineStatus`/
  `TimelinePerson` + helpers `anchor`/`endDay`/`durationDays`/`statusOf`/`initialsOf`) — client-
  importable, ZERO imports (no server leakage). Query `src/lib/queries/case-timeline.ts`
  (`getCaseTimeline(caseId)` → `{ events, reference, closedAt, isOpen }`; `listCaseMeetings(caseId)`
  → reverse `meeting_cases→meetings`). `getCaseTimeline` COMPOSES existing RLS-scoped reads only —
  gated by `getCaseDetail` (returns `null`/empty for non-staff_admin/foreign), + a DIRECT RLS-scoped
  `case_phases` read for bar timestamps (`case_phases_select` member-read; no RPC change). Two dedups:
  interview→case_event by `registry_event_id`, AND meeting-echo (drop `case_events kind='meeting'` —
  the meeting-conclusion RPC auto-writes one per linked case; the reverse `meeting_cases` link is
  authoritative). **`getCaseDetail` (`cases.ts`) + `getCommissionAccess` (`session.ts`) are now wrapped
  in React `cache()`** (request-scoped memo for the `(detail)` layout+child split; signatures
  unchanged). `meetings.ts` gained ADDITIVE exports reused by the reverse read: `MeetingRow`,
  `mapMeetingListItem`, `MEETING_LIST_COLUMNS`. No new RPC/SQLSTATE/feature-flag.
- **Phase 14a (patient-safety/NSP, ADR 0030/0031):** Queries `src/lib/queries/{safety-events,pqs}.ts` (`listCommissionEvents`/`getSafetyEvent`/`getEventCustody` PHI-free; **`getEventPatient` — the ONLY PHI read, wired to `logAuditAccess('event_patient.read')`** with empty metadata, called only when `event.hasPatient`; `pqsInbox`/`patientSafetyEnabled`). Actions `src/lib/safety/actions.ts` (`notifySafetyEvent`/`acknowledgeEvent`/`transferEventCustody`/`updateEvent`/`setEventPatient`/`cancelEvent`) + `src/lib/safety/messages.ts` (HC043/HC044→pt-BR). **`src/lib/safety/types.ts` is the import-free, client-safe contract** (all domain unions + label maps + the `ActionState` shape — `message?` carries success text; P14a-002 boundary fix); the server query/action modules import types from it. `src/lib/audit/access.ts` extended with the `event_patient.read` allow-list entry. `getCaseTimeline` composes PHI-free `safety_event` rows (echo-dedup vs `case_events kind='safety_event'`).
- **Multi-tenancy (ADR 0041):** the frontend authorization seam is `src/lib/queries/session.ts` —
  `getSessionContext()` now carries `memberships[].commission.organization` + `orgAdminOf[]`, and
  the canonical resolver is **`getCommissionAccessByOrg(orgSlug, commissionSlug)`** (resolves org
  then commission by `(organization_id, slug)`; `role` gains an org_admin → coordinator branch;
  foreign-org → `null` so the layout `notFound()`s — the legacy single-arg `getCommissionAccess`
  was removed, `82ea157`). `src/lib/routing.ts` `commissionHref(org, commission, …segments)` is the
  href codemod target. **Provisioning splits by actor:** `src/lib/platform/actions.ts`
  (**service-role**, `requireAdmin()`-gated — `createOrganization`/`createHospital`/`assignOrgAdmin`,
  `org_admin` hard-coded never from formData) vs `src/lib/org/actions.ts` (org_admin's own session,
  RLS is the authority — org-scoped hospital/commission/staff management). **Rule of the phase:** a
  `platform_admin` claim is never an authorization grant on a tenant path — most critically in the
  service-role actions where RLS is not a backstop (the TS gate is the sole control).
- **User Registration & Identity (ADR 0048):** Queries `src/lib/queries/org-users.ts`
  (`listOrgUsers(orgId, search, {page,pageSize})` → `{rows,total}` with derived status +
  committee count + home hospital; `getOrgUser(userId)` → profile + `credentials[]` +
  `committees[]` w/ role; `listProfessionalCategories()` — all RLS-scoped cookie client, the
  `profiles` `is_org_admin_of(home_organization_id)` SELECT path admits a committee-less pending
  user). Actions `src/lib/users/actions.ts` (**service-role**, each `app.is_org_admin_of()`-gated
  BEFORE any write — the platform_admin is NOT admitted): `registerUser` (atomic invite +
  profile/credential/committee write, **email-collision block**, never swallows a write failure),
  `updateUserProfile`, `upsertCredential` (edit clears `verified_at`), `removeCredential`,
  `assignCommitteeRole`/`removeCommittee`, `deactivateUser`, `reactivateUser` (clears
  `suspended_until`), `suspendUser`, `resendInvite`. **`src/lib/users/types.ts` is the import-free,
  client-safe contract** — `UserStatus` + the pure **`deriveUserStatus(isActive, suspendedUntil,
  emailConfirmedAt, now?)`** (the SINGLE SQL↔TS status authority; parity-tested via
  `__fixtures__/status-vectors.json` in both Vitest + pgTAP) + the DTOs. **`app.is_active(uid)` is
  folded into every membership SD-helper** (deactivation/suspension enforce platform-wide via RLS;
  NOT into `app.is_admin*` — vendor must not be lockable). **`signIn` gate + `getSessionContext`
  `isInactive` → `/conta-inativa`** (loop-free; the residual ADR-0009 ≤~1h self-data window is
  accepted). **Anchor invariant:** deferred `profiles_tenant_has_org_trg` (non-admin ⇒
  `home_organization_id` set), populated via invite `user_metadata` (service-role-set-once, NOT
  authz); org-less vendor via `bootstrap_admin` (`app_metadata`). The shared `resolveOrInviteUser`
  (`src/lib/members/invite.ts`) now takes a **required** `homeOrganizationId` (BUG-UREG-003) — every
  new-invite caller (`inviteStaff`, assign-staff_admin, `assignOrgAdmin`) threads the target org.
  **PROD DEPLOY DEPENDENCY (Phase 9):** the pt-BR `token_hash` invite + recovery email templates
  (`supabase/templates/{invite,recovery}.html`, wired via `config.toml [auth.email.template.*]`) are
  NOT applied to Supabase Cloud — upload them to Dashboard → Auth → Email Templates (keeping the
  `{{ .TokenHash }}` + `?type=` shape), alongside custom SMTP. Migration `20260702000000_user_registration.sql`.
- **Member overview (migration `20260704000000`):** Queries `src/lib/queries/action-items.ts`
  (`listMyActionItems(commissionId) → MyActionItem[]`; types `ActionItemSource` `'case'|'meeting'`,
  `MyActionItemStatus`, `MyActionItem`) + `src/lib/queries/overview.ts` (`getMemberOverview(commissionId)
  → MemberOverview`; the 7-field `MemberOverview` interface). Both wrap the self-scoped DEFINER RPCs
  `list_my_action_items` / `get_member_overview`; read-only, fail-closed (`[]` / all-zero). Back the
  current-member landing surface at `/o/[org]/c/[commission]/` (the "Meus itens de ação" list + the
  "Visão Geral" cards) — frontend owns the pages/cards. No new actions module (reads only).
- **S1·N (notifications, ADR 0076):** Queries `src/lib/queries/notifications.ts` (`listNotifications({limit?,unreadOnly?})` — filters `resolved_at IS NULL` [BUG-N-002] + pre-resolves each row's `href`; `getUnreadCount()` — unread AND unresolved, drives the shell badge; `getPreferences()` — always all 3 surfaces, missing → enabled) + `listMyAssignedCapaActions()` in `src/lib/queries/capa.ts` (BUG-N-001; wraps the self-scoped DEFINER, returns `MyAssignedCapaAction[]` from `@/lib/safety/capa-types`). Actions `src/lib/notifications/actions.ts` (`markNotificationRead`/`markAllNotificationsRead`/`setNotificationPreference` — each an own-row RPC call) + `src/lib/notifications/messages.ts` (**HC0C0/HC0C1 → pt-BR** via `mapNotificationsError`) + `src/lib/notifications/routing-context.ts` (batched `resolveCommissionSlugs` for signoff/meeting hrefs). `src/lib/routing.ts` gains **`notificationHref({entityType, entityId, orgSlug?, commissionSlug?})`** — pure path builder: `capa_action` → static `/conta/itens-de-acao` (BUG-N-001, no lookup), `meeting` → meeting detail, `response_section_signoff` → `/manage/assinaturas`; unresolvable → `#`. `feature-flags.ts` += `notifications` (21st `FeatureFlags` key) + `notificationsEnabled()`. Advancing a CAPA action from the personal page reuses `advanceCapaAction`/`completeCapaAction` (`src/lib/safety/capa-actions.ts`). `frontend` owns the bell/center/prefs UI + `/conta/itens-de-acao` page.
- Service-role client: `src/lib/supabase/admin.ts` (`import 'server-only'`), invite path only.

### Form-Builder Enhancements batch (2026-07-07; no dedicated ADR — see [adjustments-batch.md](progress/adjustments-batch.md))

Migrations `20260713000500…001000` (on remote). New backend surface:

- **`hospital_departments`** — hospital-scoped unit/setor list (`hospital_id`, `name`, `sort_order`,
  `archived_at`). RLS: hospital-member SELECT (`app.is_hospital_member_of(hospital_id)`, new helper),
  admin (org/hospital) INSERT/UPDATE. Hardened `reorder_departments(p_hospital_id, p_ordered_ids[])`
  DEFINER RPC (admin-gated, same-hospital assertion). `cases.department_id` (FK, nullable) +
  `cases.department_other` (free text for the "Outros" department) — captured at case create.
- **Flagged + aggregate result criteria** — `form_item_options.flagged` (bool); per-item
  `config.flaggedWhen`. `app.compute_case_phase_result` injects two **synthetic answer-map keys** at
  runtime — `__total_score__` (Σ option scores) and `__flagged_count__` (Σ flagged selections) — so
  result rules can key on aggregates. **Evaluator (Rule 3) byte-for-byte unchanged** (synthetic keys ride
  the existing `__phase_result__` reserved-key precedent). `app.validate_template_result_ruleset` whitelists
  the two keys (mirrors `__phase_result__`) and skips option-code assertion for their **numeric** values;
  unknown reserved keys still throw HC016. Client keys: `TOTAL_SCORE_KEY`/`FLAGGED_COUNT_KEY`
  (`src/lib/queries/conditions.ts`). The aggregate source `app.case_phase_option_aggregates`
  resolves the phase's `current_response_id` **completed-only**, mirroring `case_phase_answer_map`
  — a voided / non-completed phase → **zero aggregates**, keeping `compute`'s two inputs consistent
  (QA INFO-1 parity, migration `…000200`; sole caller `compute_case_phase_result` only ever runs on a
  completed phase, so this is defensive/future-proofing, not a live behavior change).
- **"Others" open option** — reserved option `code='__other__'` (`form_item_options.is_other`),
  reconciled like a normal option; `answers.other_text` holds the free text. `save_section_answers` gains
  `p_other_text jsonb` (item→text map). Submit validation honors per-item `config.minLength/maxLength`.
  Client-safe constants live in **`src/lib/forms/option-constants.ts`** (`OTHER_OPTION_CODE`/`OTHER_OPTION_LABEL`,
  re-exported from `queries/forms.ts`) — NEVER value-import them from `queries/forms.ts` in a client component
  (drags `next/headers` into the bundle; see BUG-FBE-005).
- **`seed_selected_meeting_attendees(p_meeting_id, p_user_ids[])`** DEFINER RPC — bulk-convoke a selected
  member set at UI meeting create ("Convocar todos" default). To promote an already-convoked attendee use
  the existing `update_meeting_attendee(p_attendee_id, p_role, p_attendance)` (do NOT re-`add` — unique
  `(meeting_id,user_id)` index).
- **`openNarrativeCount`** surfaced on the cases-board read (Etapas-pendentes support).

## ADR index (decisions that shape the backend)

0002 admin claim hook · 0003 pgTAP · 0004 sign-off flag · 0005 visible_when shape ·
0009 JWT local verification (prod needs asymmetric keys) · 0010 email denorm ·
0011 reorder · 0012 clone-returns-existing-draft · 0013 form_versions insert RLS ·
0015 response-fill RPCs · 0016 sign-off definer read path · 0017 multi-phase cases ·
0018 custom SQLSTATE class `HC0xx` · 0019 default section may carry title ·
0020 dashboard-countable responses · 0021 case-phase due dates ·
0022 cross-committee referrals (proposed/deferred) · 0023 configurable per-committee case status
(**superseded by 0024**) · 0024 case-model adjustments (fixed auto-computed statuses + phase
blocking + outcomes) · 0025 meetings (data model + 5-state lifecycle + internal e-signatures,
provider-ready; sign-own-row RLS + RPC-side auto-flip) · 0026 interviews (case-scoped sibling of
meetings; 5-state lifecycle + content-freeze; NEW row-level participant-write RLS
`can_write_interview`; conclude writes/updates a single `case_events kind='interview'` registry row) ·
0027 case timeline (read-only event aggregation, two layouts; NO migration/RLS — composes existing
RLS-scoped reads; meeting-echo dedup; React `cache()` on `getCaseDetail`/`getCommissionAccess`) ·
0029 audit trail (append-only, per-commission + global SHA-256 hash chain; DEFINER `audit_write` +
AFTER-triggers on the curated table set with non-sensitive/PHI-free allow-lists; SELECT-only RLS;
`verify_audit_chain`; `log_audit_access` positive allow-list; **HC042** append-only guard; establishes
Architecture Rule 11). ·
0030 patient-safety PHI & PQS architecture (permits PHI on HIPAA infra under a BAA, minimum-necessary; isolated PHI tables, access-audited, encrypted; **reverses** the prior "no patient data" stance + supersedes 0028's rejected "minimal-identifiers" alternative; Architecture Rule 12) ·
0031 event custody ledger & PHI isolation (isolated `event_patient`; append-only `event_custody`; access-follows-custody `app.can_read_event`; state machine HC043/HC044; PHI `.read` Phase-13 integration). ·
0033 case access control (per-case ACL `case_access`; attribution-driven `app.can_read_case`; HC055). ·
0035 regulatory posture LGPD/ANVISA/CFM + **column encryption declined**. ·
0036 PHI access hardening (real `pqs_members`; single-door identifier read; free-text PHI classification; controlled disposal). ·
0037 **inter-committee case referrals** (Phase 22; supersedes 0022; amends 0030/0036 + Rule 12 — SECOND PHI module under isolated-table + audited-single-door safeguards; frozen-snapshot channel; `can_read_referral`/`can_read_referral_phi`/`referral_target_analyst`; `referral_patient` REVOKE + audited `get_referral_patient`; column-lockdown of `description_md`/`decline_note` + body-gating of `frozen_body_md`/`result_md`; `can_read_case` QPS term; `close_case` HC076; RLS-consistent snapshot-doc download; **HC070–HC07A**; flag OFF). ·
0038 **case patient identifiers** (THIRD PHI module; optional `case_patient` on the isolated-table + audited-`get_case_patient` pattern; per-template `collects_patient` → `cases.patient_enabled` snapshot; **broad** `can_read_case_patient` read [assignees need the MRN] vs coordinators-only writes; `dispose_case_phi`; flag `case_patient`). ·
0039 **patient identity & cross-committee linkage** (Phase 23; extends Rules 11/12 — a non-identifying HMAC `patient_key`/`encounter_key` derived by **always-on** BEFORE/AFTER triggers on all three PHI tables [`event_patient`/`referral_patient`/`case_patient`], conservative normalization, `extensions.hmac` + pepper in locked-down **`app.app_secrets`** [not Vault/GUC — both infeasible on Supabase; hard-fail if absent]; QPS-only key-only **`patient_xref`** [REVOKE authenticated, `is_pqs_member` SELECT, partial indexes]; DEFINER doors `search_patient_xref`/`get_patient_trajectory_for_entity`/`patient_access_audit`/`patient_xref_count`/`patient_index_enabled` [flag-asserted, PQS- or `can_read_referral_phi`-gated, PHI-free]; `patient.searched`/`patient.viewed` audit on the GLOBAL chain via `audit_write` [key-only, never raw MRN; `patient_key_to_uuid` for the NOT-NULL `entity_id`]; additive referral key transmission + count-only hint; disposal retain-marked-disposed via `app.phi_dispose_reason` GUC, referrals cascade-only [`dispose_referral_phi` follow-up]; helpers `normalize_identifier`/`derive_patient_key`/`backfill_patient_keys` [repair-tool]; flag `patient_index` OFF gates RPCs+UI only). ·
0041 **multi-tenancy** (organizations → hospitals above commissions; pooled single-DB + silo-by-exception; vendor `platform_admin` provisioning-only/walled-off vs customer `org_admin`; org membership a live DB read not a JWT claim; the ~60 `is_admin` tenant/PHI OR-terms → `is_org_admin_of_commission` with `is_admin` surviving only on the platform-management surface; `commission_overview` + 6 dashboard DEFINER RPCs re-scoped; commission slug uniqueness global → per-org; **audit 3-tier** platform/org/commission hash chains; routes `/c/[slug]` → `/o/[org]/c/[commission]`; **§Implementation amendments** — the global-PQS/QPS roster goes inert in multi-org [`is_multi_org()` at the `is_pqs_member` chokepoint] making the entire NSP + referral PHI surface absent until **NSP-per-org** ships; `platform_admin` claim never an authorization grant [commission-shell wall + service-role escalation fixes]; `is_org_member` lets a member read their own org row). ·
0047 **ad-hoc case narratives** (coordinator adds a narrative to an OPEN case via DEFINER `add_ad_hoc_narrative` + `case_narratives.is_ad_hoc`, mirroring `add_ad_hoc_phase`; type from the vocabulary or atomic inline create-or-reuse [un-archives]; **partially reverses 0032 D7's** "no per-case add" for open cases only [remove/reorder stay template-authored]; gated by the existing `case_narratives` flag; HC020/HC021/HC054). ·
0048 **user registration & identity** (`org_admin` registers per-org, vendor stays isolated; combined verify+activate reusing invite→`/auth/confirm`→`/convite`; status DERIVED via `deriveUserStatus` [`email_confirmed_at`+`is_active`+`suspended_until`, parity-tested SQL↔TS]; **`app.is_active()` folded into every membership SD-helper** [EXCLUDING `is_admin*`] + `signIn` gate + `getSessionContext.isInactive`→`/conta-inativa` [loop-free; ADR-0009 residual accepted]; `professional_credentials` [multi, global-unique] + `professional_categories` lookup; **`home_organization_id` anchor via a DEFERRED constraint trigger** [not a CHECK — breaks the multi-step `handle_new_user` insert], populated by invite `user_metadata` [NOT authz], vendor org-less via `bootstrap_admin`/`app_metadata`; nullable descriptive `home_hospital_id`+matrícula; 0..N committees w/ per-committee role; **email collision blocked**; no `date_of_birth` [LGPD]; widened `guard_profile_privileged_columns` self-mutation lock; **BUG-UREG-002** `token_hash` pt-BR invite+recovery templates [**Phase-9 prod dep:** upload to Dashboard email templates + SMTP]; **BUG-UREG-003** shared `resolveOrInviteUser` now requires `homeOrganizationId`; migration `20260702000000`). ·
0050 **action-items fold + `visibility_scope` + case-access expiry** (fold `case_action_items` into the shared hub as `source_type='case'`; scope-aware read via `app.can_read_action_item` on the hub + 2 satellites; guard force-restricts case rows [coordinator override on meeting/manual cross-links via the RPC]; ADR-0033-D4 write-grantee preserved; `case_access` grant `expires_at`+`reason` filtered across all 6 consulters incl. the referral-PHI arm [Rule 12]; drops the old case table + 4 RPCs; **BUG-AIF-001** — pre-existing prod-build layout-scope revalidation, diagnosed + deferred to a systemic task). ·
0076 **notifications pilot scope (S1·N)** (in-app centre for CAPA + sign-off + meeting, actionable-to-me, event- **and** time-driven, reminder-only, in-app only — email/escalation/other-scan-arms deferred; kind-agnostic engine + schema so deferred items are additive; `notifications`/`notification_preferences` own-row RLS with a **DEFINER-only write door** `app.enqueue_notification` [no authenticated INSERT — BUG-SUP-002 posture]; idempotent `(user_id, dedup_key)`; `compute_due_notifications` DEFINER scan [service_role-only, pg_cron at deploy]; auto-resolve reminders on task completion [assignments persist]; **PHI-free bodies by construction — config-level snapshots only, Rule 12**; sits OUTSIDE the Rule-11 audit trail [own-data]; **HC0C0**/**HC0C1**; flag `notifications` [21st]; **BUG-N-001** non-PQS assignee gets the static `/conta/itens-de-acao` page + `list_my_assigned_capa_actions`; **BUG-N-002** `listNotifications`/`getUnreadCount` filter `resolved_at IS NULL`).

0072 **ethics access spine — the m2 gate release (ETH·E1)** (respondent-exclusion + recusal/COI enforced in the DB as HARD DENIES evaluated **first, before every grant arm**, computed inside the DEFINER over BASE tables [R6]; one 7-value confidentiality taxonomy shared by `cases` / `case_interviews` / `attachments`, snapshotted at create; `explicit_grants_only` ethics cases; the document ceiling gating `legal_privileged`+`credentialing_sensitive` against `case_access.max_confidentiality` [O1: a column, grant-based, **no coordinator arm, no admin bypass**]; real participant write authority as DEFINER RPCs with `case_participants` staying SELECT-only; the IV2 fold-in [X-γ: `participant_id` FKs + enforcing confidentiality + the O3 remap]; **M2 posture — correction only, NO erasure path, retention-pinned** [amends Rule 12]; **releases the ADR-0064 m2 hard gate** by flipping `case_participants`+`case_types` ON. **Lesson to carry:** a correct `can_read_case` does NOT make the policies consuming it correct — three leak shapes were found three different ways [grep-visible admin-OR / grep-invisible bare-admin `FOR ALL` / no-case-predicate-at-all], and the durable guard is the catalog-driven policy-layer sweep in `228_ethics_e1.sql`, not a fourth enumeration; member-facing reach uses `can_reach_case_on_member_surface`, **never** `can_read_case`, which has no plain-member arm. See the **E1** section above.)


**0077–0096 (catch-up, added 2026-08-05 — this index had stopped in the 0070s).** Each of these
has its own `##` section above or in `docs/phases/`; listed here so a reader scanning the index
does not conclude they are missing. 0078 authorization capability model (supersedes withdrawn 0077) ·
0079 authz door-blindness standing invariant · 0080 committee charters & cadence · 0081 controlled-
document redesign · 0082 document `changes_requested` · 0083 case custom fields · 0084 bulk case
creation · 0085 case-correction lifecycle · 0086 flexible-forms pre-pilot · 0087 FF-1 repeating groups ·
0088 case-type assignment channel · 0089 FF-2 matrix & risk matrix · 0090 FF-3 validation engine ·
0091 FF-5 entity reference · 0092 FF-4 power authoring · 0093 Phase-16 standards-crosswalk replan ·
0094 membership hardening + Diretor Técnico · 0095 process-case integrity audit remediation ·
**0096 process-template versioning** (the identity/version split — see `PCI + TV`).
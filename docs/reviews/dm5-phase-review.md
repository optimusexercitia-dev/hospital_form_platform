# DM5 — PHASE QA review (Wave D + retirement)

**Date:** 2026-08-17 · **Commit under review:** `15396276` (HEAD) · **Reviewer:** `qa`
**Gate position:** CLAUDE.md §6 **step 3, phase scope** — step 1 ✅, step 2 ✅ GREEN, step 4 (PO) owed.

## VERDICT — ⛔ CHANGES REQUESTED

**4 BLOCKING · 4 MINOR · 7 INFO. Zero code changes requested.**

Every blocking finding is a **record defect**. That is the seventh consecutive DM5 QA round in which
that is true, and I treated it as a hypothesis rather than a premise: I re-derived the byte kernel,
the three PHI modules, the audit chain, the retirement sweep and every ADR-0120/0121 build obligation
I could reach from the live catalog, on a bound **wider** than the one S6 used. **The build is sound.**
What is not sound is the set of documents that carries this phase's risk into the pilot — and for a
phase whose entire residual is "a known, runbook-mitigated PHI-disposal gap plus five unpushed
migrations", the record *is* the deliverable.

Three of the four blocking items sit in the two files every future session reads first
(`PROGRESS.md`, `docs/backend-state.md`); one drops this phase's only 🔴 out of the register that
the PO is supposed to decide from; and one is a named S6 deliverable that was not delivered.

---

## 0 · Scope of this verdict — stated so it cannot be inferred wrong

**This is the DM5 PHASE verdict.** It supersedes nothing and inherits nothing from the four slice
verdicts (S3 r2, S4 r3, S5 r2, S6 r2); each of those says in its own scope section that it is not
the phase verdict, and each is correct.

**What this verdict covers:** the phase's delivery against ADR 0114 (+Amdt 1/2), ADRs 0120/0121/0122
and `docs/plans/dm5-wave-d-retirement-plan.md`; the completeness of the retirement at every layer
that executes; the PHI posture (Rule 12) across the three isolated modules; the audit trail; and the
honesty and ownership of the open items.

**What this verdict does NOT cover — each of these is a real limit, not a formality:**

1. **Gate step 2 was not re-run by me.** `e2e:prod` is GREEN at `15396276` (1121p / 0f / 0 infra /
   2 flaky / 6 skipped / 0 did-not-run / 18 batches, parts reconciling to 1129 per batch). That run
   is the lead's and I take it as given. I did not re-execute it.
2. **I did not re-run the pgTAP suite.** The gate figure (194 files / 6392 PASS) is the lead's, and
   the S6 QA re-measured it on a fresh reset on 2026-08-17. The local stack at review time is
   **not** freshly reset — it carries the E2E gate's residue — and resetting it is not mine to do on
   a shared stack. **This does not weaken my catalog findings**: functions, policies, constraints,
   ACLs, triggers, grants and buckets are unaffected by row-level test residue, and the migration
   registry reconciles exactly (411 DB == 411 files, diffed key-by-key, no drift).
3. **Gate step 4 is the PO's.** Nothing here approves, pre-empts or narrows the decisions owed there
   (§6).
4. **The five local-only migrations are unpushed**, and this verdict is against the **local**
   catalog at HEAD. The remote is five migrations behind (§5).
5. **No mutation harness was run.** Every authorization finding below is from reading
   `pg_get_functiondef` and the ACLs, not from neutralization. Where I say a gate holds, I mean its
   text and its ACL hold — not that it has been mutation-proven in this review.

**What this verdict explicitly does NOT close** — all four were verified still correctly open:

- 🔒 The **disposal runbook sequence is UNREHEARSED**. Still binding. Naming an owner is not a
  rehearsal. (See M1 — the *runbook itself* does not say so.)
- 🔴 **`FUP-DM5-SUPERSEDE-SERVING-COLLISION`** — PO-deferred, not closed. D11 cannot be rebuilt.
  Confirmed at the catalog: `disposal_reason_category`'s CHECK admits
  `{retention_expired, subject_request, entered_in_error, duplicate, other}` — **no `superseded`**.
  The revert is real.
- ⛔ The S5 record's **NOT-COVERED enumeration** — still open, still binding. **It holds 20 items,
  not 13** (R2). P4 is honestly discharged, bounded correctly in all three places it appears.
- ⚠⚠ The **recusal fix `20260928000100` is LOCAL-ONLY**; the recused-coordinator PHI path is open
  on the remote until `db push`. Verified by direct query against both catalogs.

---

## 1 · BLOCKING findings

### R1 · BLOCKING — the END STATE block's flag census does not reproduce on either catalog, and carries no query

`docs/backend-state.md` (DM END STATE block) states:

> "of the **52** document-model functions in `app`/`public`, **51 do NOT read a flag — exactly one
> does** (`app.compute_due_document_review_notifications`)"

**Measured, under the block's own stated door regex** (`proname ~ '(document|printed|disposal|
dispose|evidence_upload|file_object|placement|legal_hold|retention)'`, `app`+`public`, `prokind='f'`,
`pg_get_functiondef ilike '%feature_enabled%'`):

| catalog | total | read a flag |
| --- | --- | --- |
| **local @ HEAD** | **75** | **6** |
| **remote** (`azkbbhskturikxpgmafq`, the environment the figure was originally measured in) | **74** | **6** |

The six are `app.assert_documents_enabled`, `app.assert_document_printing_enabled`,
`app.assert_documents_wave_b_enabled`, `app.assert_documents_wave_c_enabled`,
`app.assert_documents_wave_d_enabled`, `app.compute_due_document_review_notifications`.

I could not construct **any** bound that yields 52, or "exactly one":

| bound tried | total | read a flag |
| --- | --- | --- |
| door regex, `public` only | 38 | 0 |
| door regex, `app` only | 37 | 6 |
| `proname ~ 'document'` | 64 | 6 |
| `proname ~ 'document\|file_object'` | 66 | 6 |
| table regex `^(document\|file_object\|securable\|upload_session\|controlled_document\|printed_document)` | 2 | 0 |
| body touches `public.{documents,document_versions,document_version_files,file_objects}` | 38 | 0 |

**Why this is blocking, not cosmetic:**

1. It is **the same paragraph the S6 QA rewrote to fix F1** (the inversion). The *direction* was
   corrected; the *figure* was carried over from the follow-up unre-derived. F1's own lesson —
   "a control described wrong while citing it" — recurred inside F1's fix.
2. The block's own rule, stated four lines above, is **"Every figure here carries the query that
   produces it."** This figure carries none. The neighbouring half of the same sentence (the
   `0 policies` claim) *does* carry its query, and reproduces exactly (I measured 0). The
   discipline was applied to one half of a sentence and not the other.
3. It **understates the mechanism in the reassuring direction**. "Exactly one function, a
   notification computer" reads as *flags gate essentially nothing*. In fact five of the six are the
   `assert_*_enabled` gates invoked at the top of the serve doors — `open_document_version` calls
   `app.assert_documents_enabled()`, `open_printed_document` calls
   `app.assert_document_printing_enabled()`. The paragraph's conclusion (*app-layer gate, not a
   security boundary*) is **right**, and is better supported by the true figure than by the printed
   one. That is what makes this worth fixing rather than arguing: the sentence is currently weaker
   evidence for its own correct conclusion.

**Fix:** re-derive against the live catalog, state the bound and attach the query, in
`docs/backend-state.md` and in any sibling that transcribed it (F1's three sites are the obvious
place to look).

---

### R2 · BLOCKING — the binding NOT-COVERED enumeration holds 20 items; every pointer to it says 13

`PROGRESS.md:352-353` sends the reader to the S5 record's binding heading and says:

> "⛔ **13 NOT-COVERED items** are enumerated in the record under its binding heading — **read them
> before S6**, because a close that omits them reads as completeness."

Measured — `docs/progress/dm5-s5-operational-closure.md` §6 (`## 6 · ⛔ NOT TESTED / NOT COVERED —
binding`, lines 483–571), counting top-level numbered items: **20**, numbered 1–20 **out of order**
(1…14, then 19, 20, then 15–18).

Items 14–20 include the two QA-r2 residuals, the `MISSING_BYTES`/`DIVERGED_BOTH_WAYS` construction
bounds, and **item 18** — the `7z a -si -p` combination untested in a piped non-tty context, which
the record itself calls *"the first thing to check in the first rehearsal."* A reader who counts to
13 and stops loses exactly the items added by the two QA rounds that were hardest won.

**This defect has already propagated into the phase QA's own task assignment**, which instructed me
to verify "13 NOT-COVERED items". A pointer's count is a claim; it went stale silently, and nothing
in the gate can contradict it.

P4 itself is **honestly discharged** — marked ⬛/CLOSED in the enumeration, in the §4 table, and in
§6c, each carrying the "baseline only, no volume arm" bound explicitly. No complaint there.

**Fix:** re-derive the count in every pointer, or (better) stop printing a count and point at the
heading. Note that item 1 was closed in place without renumbering, so the enumeration now holds
19 live gaps and one closed one.

---

### R3 · BLOCKING — the only 🔴 this phase opened has no line in the follow-ups index

`PROGRESS.md` § Follow-ups / Deferred Items (782–836) states its own contract:

> "_One line per item: severity · id · title · owner._"

and carries an explicit warning added 2026-08-14:

> "⚠ **Six lines below are NEW index entries, not new items** … each was OPEN but named **only**
> inside the DM5 phase section or a Bug Log pointer, so compressing those would have dropped it from
> the index entirely."

Measured across all 46 index lines:

- **🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION`** — **no index line.** It appears only as a
  cross-reference *inside other items' prose* (`:805`, `:808`) and inside the phase narrative
  (`:214`, `:308`, `:405`) and the Decisions log (`:760`).
- **🟠 `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **no index line.** Only `:309` and `:424`, both phase
  narrative.

These are the two findings the follow-up batch itself announced as new (`PROGRESS.md:308-309`). The
🔴 is the single item the PO must decide, that D11 cannot be rebuilt over, and that S6 may not close
over. **The warning against this exact failure was written on 2026-08-14 and the next batch
re-created it with the highest-severity item in the phase.** The next rotation, which compresses the
phase narrative, drops it.

**Fix:** add both as index lines with severity · id · title · owner, before any further rotation.

Two adjacent staleness items in the same index, same class, cheaper to fix:

- `:825` `FUP-E2E-REPEAT-FLAKY` still lists **three** members including `dm5-nsp-evidence:347`. The
  same file at `:254` records that the third was root-caused as **BUG-DM5-S6-EVID-KBD-1** and
  therefore *"was never a flake"*, leaving two. The file contradicts itself.
- `:802` `FUP-DM5-NO-ANSWER-VS-NOTHING` prints the headline *"an ACTION PERFORMED is recorded as the
  STATE ACHIEVED"*, which `follow-ups.md:17-23` records as **withdrawn at QA r1** for mis-describing
  two of its own instances; the live headline is *"An observable PROXY is substituted for the
  property that actually matters."* `PROGRESS.md:412` uses the corrected one — the file carries both.

---

### R4 · BLOCKING — a named S6 deliverable was not delivered: the disposal gap is absent from the pilot gate

`docs/plans/dm5-wave-d-retirement-plan.md`, S5.D.4:

> "**DM5 therefore exits with a KNOWN, runbook-mitigated PHI-disposal gap** — must appear in
> **S6's canon sweep and in the pilot gate**, never only here."

Measured:

- **Pilot gate** — `PROGRESS.md` § "Remaining pre-pilot work" (515–532) reads *"**All complete** …
  What is actually left:"* and then lists **exactly one** item: `0. 🔴 PILOT-GATE CHECK —
  FUP-ACT-DISPOSE-UI`. Neither 🟠 `FUP-DM5-DISPOSAL-JOB` (filed by plan S5.D.3 as *"a 🔴 BLOCKING
  pre-pilot follow-up — not a nice-to-have"*) nor 🔴 `FUP-DM5-BACKUP-IS-PHI-EXPORT` appears there.
- **Canon sweep** — `ARCHITECTURE.md` §2's `file_objects` bullet correctly states the sharp half
  (*"`disposed` asserts 'metadata row gone', NOT 'bytes gone'"*), but nowhere states the operational
  fact that **nothing completes a disposal**: there is no scheduler, and `disposal_pending` rows keep
  their PHI bytes indefinitely pending a manual runbook run.

So the phase is preparing to close with its single largest residual risk recorded only in the place
the obligation says it must not be recorded only. This is the phase's demonstrated failure mode in
its purest form: **an S6 deliverable marked done that was not done**, and one whose absence is
invisible from either document alone — the pre-pilot list is complete about what it contains, and
the plan is complete about what it required.

**Fix:** add the disposal gap to § Remaining pre-pilot work as its own gate item (severity, owner,
what would discharge it — per ADR 0121 C2, *only* a job that has RUN and completed a real pending
disposal), and add one sentence to `ARCHITECTURE.md`'s `disposal_state` bullet stating that the
outflow is manual and runbook-mitigated.

---

## 2 · MINOR findings

**M1 · The runbook — the document an operator actually opens — carries no UNREHEARSED disclaimer.**
`docs/deployment/phi-disposal-runbook.md`: grepped for `rehears|unrehearsed|never been executed|
untested|tty`. The only sentence of that shape is `:306`, and it is scoped to a Cloud exit-code
caveat, not to the sequence. The UNREHEARSED status is **binding** per the S5 record §6c and
`PROGRESS.md:349-351` — and it lives entirely in files an operator will not have open. Worse,
`:127-142` narrates a real destructive incident *on the remote* (*"The bucket was destroyed and had
to be restored from `baseline.sql`"*), which is the passage most likely to be read as evidence the
procedure has been run. The mitigation for the gap was never written into the mitigation document.

**M2 · The runbook's rehearsal instruction states the wrong control total.** `:386` —
*"Rehearse the sequence locally (`node scripts/storage-manifest.mjs rehearse` — **18 controls**)"*.
Measured from `scripts/storage-manifest.mjs`: **22** distinct rehearse labels
(`R0 R1 R1x R2 R2b R3a R3b R3b-diagnosis R3c R3d R4a R4b R5 R6 R6-capture R6-residual R6b R7 R7-twin
R8 R9 R9-monotonic`) and **18** selftest labels (`C1`–`C18`). The runbook cites the *selftest* total
for the *rehearse* command. The S5 record has it right (rehearse 22 / selftest 18). An operator who
sees 22 pass cannot tell whether the doc is stale or the tool changed.

**M3 · The legacy `attachments` module survived the program's retirement phase.**
`src/lib/attachments/actions.ts` is six `'use server'` exports whose bodies all return a constant
`'O recurso de anexos ainda não está disponível.'`, with in-file comments declaring
*"the key survives, verbless, **until DM2 retires it**"* (`:32-33`) and *"PARKED (DM1): always
unavailable **until Wave A** rebuilds uploads"* (`:38-39`, `:21-22`). DM2 / Wave A shipped three
phases ago and DM5 is the program's final phase. Nothing imports `@/lib/attachments/actions` — the
only importers of that directory pull types from `./constants` (`queries/attachments.ts:6`,
`queries/interviews.ts:7`). The `attachments` feature-flag key survives too (`false` on both
catalogs).

No exposure: the bodies touch no database. But this is a genuine gap in the exit sweep's **bound**,
not in its execution — S6's sweep was bounded by `storage_path` / `storage_bucket` / bucket literals
/ `createSignedUrl`, and a dead module referencing none of those is structurally invisible to it.
The property is "legacy attachment surface"; the bound was a set of identifiers.
[[enumeration-boundary-is-a-syntax-not-a-property]].

*Checked and cleared, so it is not re-found as a defect:* the **interview file half is not a
capability regression.** `interviews/actions.ts:840` still says *"Wave A restores the file half"*
(stale prose), but `src/components/interviews/attachments-panel.tsx:65` renders the document-model
`DocumentsPanel`, `interview` is a live `securable_resources.resource_type`, and
`queries/documents.ts:202` routes interview-homed bytes to the PHI bucket. The surviving
`softDeleteInterviewAttachment` call is for **link** rows, which is the un-parked half.

**M4 · The one production caller of `complete_document_disposal` records the weakest possible
evidence, from the one lane that has the strongest.** `src/lib/documents/actions.ts:416` calls the
door with `p_file_object_id` only, so `p_byte_proof` takes its default `'not_attempted'` and
`file_objects.disposal_evidence` is written as `{"byte_proof":"not_attempted", …}`. But that lane
performs the Storage `.remove()` **three lines earlier** (`:413-414`) and checks its error, so it
holds a real byte-deletion result. ADR 0121 D4's entire purpose is that the evidence beside
`disposed` states what was actually verified. This is `FUP-DM5-NO-ANSWER-VS-NOTHING`'s own shape
appearing in the fix built to answer it — small, contained, and worth closing while D4 is fresh.

---

## 3 · What I re-derived and what reproduced (the positive census)

Everything below was measured from the live catalog at HEAD, not read from a record.

| claim | measured | verdict |
| --- | --- | --- |
| migration registry | **411 (DB) == 411 (files)**, diffed key-by-key — no drift, no gaps | ✅ |
| RLS on `public` tables | **165 / 165**; 0 partitioned tables hidden by the `relkind='r'` bound | ✅ |
| 13 document-model tables, exactly 1 policy each | 13 rows, all `count=1` | ✅ |
| storage buckets (local) | **4** — `documents-standard`, `documents-phi`, `form-assets`, `meeting-audio` | ✅ |
| `storage.objects` policies | **3 INSERT + 1 SELECT**, names exact, all `authenticated` | ✅ |
| ZERO RLS policies read a feature flag | **0** | ✅ |
| flag census in the END STATE block | 75/6 local, 74/6 remote — **does not reproduce** | ⛔ **R1** |
| **retirement sweep, catalog layer, wider bound than S6's** — all **8** retired bucket names *including the bare `attachments`*, quote-bounded, over `pg_proc` (all `app`+`public`), `pg_policies`, `pg_constraint`, `pg_attrdef` | **0 · 0 · 0 · 0**; `file_objects.storage_bucket` distinct values: none; the legacy `attachments` **table is gone** | ✅ |
| 0120 D1 — three new resource types + the two-shape tenancy coupling | `type_check` carries `rca`/`capa_action`/`form_response`; `tenant_shape` carries both shapes, `capa_action` exempt from `commission_id` alone | ✅ |
| 0120 D6 — all four print sources migrate | `printed_documents_source_kind_check` = `form_response`/`case`/`meeting`/`interview` | ✅ |
| 0120 D7 — `printed_documents` becomes the satellite | **no `storage_path` column**, no `pd_storage_path_derived`; binds `document_id` + `document_version_id` under a composite FK to `document_versions(id, document_id)`, both UNIQUE | ✅ |
| 0120 C8 — every new column carries its own GRANT | `document_id` + `document_version_id` both `authenticated=r`; `verification_token`, `revoked_reason`, `revoked_by` carry **none**; table ACL grants `authenticated` **nothing** | ✅ |
| plan S2.5 — kill the caller-supplied path | `add_rca_evidence` and `add_capa_action_evidence` take **no `p_storage_path`**; both take `p_document_id` | ✅ |
| pgTAP `328` K8b discharged | **no `%parked%` constraint survives** in the catalog | ✅ |
| `FUP-DM5-GRANTS` closed | `rca_evidence` / `capa_action_evidence` now `authenticated=rm` (no insert/update/delete) — the RPCs are the only writers | ✅ |
| all six document-model tables | `authenticated=r` only; writes exclusively via DEFINER RPCs | ✅ |
| 0121 D4 shipped | `complete_document_disposal` writes `disposal_evidence` = `{metadata_absent, metadata_source, byte_proof, storage_bucket, storage_path, reason_category, verified_at}`; ACL = `postgres` + `service_role` only, matching the runbook's stated executor constraint | ✅ |
| D11 inflow genuinely reverted | `disposal_reason_category` CHECK has **no `superseded`**; migration `…0928000300` absent | ✅ |
| DM5 pgTAP suites present | `341` plan(67) · `342` plan(59) · `343` plan(12); `343` K6b's *"no scheduler exists at all"* false-pin is present **and labelled as such in the file** | ✅ |
| ADR 0122 recusal fix live (local) | `public.add_referral_shared_item` gates on `app.can_read_case(source_case_id, auth.uid())` **above** the `p_kind` dispatch | ✅ |

### The byte kernel — read in full, not sampled

`app.resolve_document_version_bytes` (DEFINER, `search_path` pinned) fails closed in order on:
null/inactive caller (`app.is_active`), absent version, `app.can_read_document`, the QO·B
case/interview `read_case_deliberation` arm, the DM4 referral-PHI arm, `documents.status` (disposal
states first, with a distinct `HC0DD`), file-grain `disposal_state <> 'none'`, and
`upload_state not in ('clean','unscanned_accepted')`. Denial for the kernel arm is byte-identical to
absence. `open_document_version` and `open_printed_document` both delegate to it and both emit audit
(`document.opened` on the D11 floor — every PHI-tier open and every non-creator open;
`document.downloaded` on every re-serve, after resolution so a refusal cannot mint a row).

**`open_referral_snapshot_document` deliberately does not delegate**, so I checked it specifically
for the `FUP-DM5-SIBLING-GUARD-DIFF` class (a door omitting a check its siblings make). Its gate
`app.can_read_referral_phi` reaches five arms, and **every one enforces `app.is_active`** —
`is_staff_admin_of_for`, `is_pqs_operator_of_for` (→ `is_nsp_coordinator_of_for` /
`is_pqs_member_of_for`), `referral_target_analyst`, `is_technical_director_of_for` — with
`app.is_active` itself coalescing an absent profile or null uid to `false`. **The class does not
bite here.** Note for the future: the fact that this door is outside the byte kernel means a
kernel-level change does **not** reach it — directly relevant to
`FUP-DM5-SUPERSEDE-SERVING-COLLISION`, which is a kernel finding.

### PHI posture (Rule 12) — intact, and stronger than RLS alone

All four PHI relations — `event_patient`, `referral_patient`, `patient_identifiers`,
`patient_participants` — have **RLS enabled and no grant to `authenticated` at all** (ACL =
`postgres` + `service_role`). PostgREST cannot reach them whatever the policies say; `event_patient`'s
lone SELECT policy is belt-and-braces over a table `authenticated` cannot select from. Reads flow
through audited DEFINER doors (`get_event_patient`, `get_referral_patient`, `get_participant_patient`,
`get_case_patients`). `get_case_patient` shows no audit call of its own — **I checked rather than
filed it**: it reads `patient_identifiers` only to resolve a participant id and delegates the actual
PHI read to the audited `get_participant_patient`. Not a gap. The three value tables carry audit
triggers on insert/update; `patient_participants` correctly has none, holding no PHI values.
Disposal doors exist for all three modules and all audit.

### Audit trail — intact

`public.audit_log` is append-only by construction: `guard_audit_immutable_trg` (BEFORE UPDATE OR
DELETE, FOR EACH ROW) + `guard_audit_immutable_truncate_trg` (BEFORE TRUNCATE, statement-level);
hash-chained via `seq` / `prev_hash` / `row_hash`; one SELECT policy; and `authenticated` holds
`rxtm` — **no INSERT, UPDATE or DELETE at the ACL layer**, so writes are DEFINER-only regardless of
policy.

---

## 4 · Answering, with a measurement, the question the S6 QA handed to the PO

The S6 review carried forward (its §5 item 5): *"can any writer produce `documents.status='active'`
with `deleted_at` set? If the corner matters, it wants a CHECK."*

**Measured — it is not reachable through any door today.** The six writers of `public.documents` are
`soft_delete_document` (stamps `deleted_at`, sets `soft_deleted`), `request_document_disposition`,
`complete_document_disposal`, `dispose_case_phi`, `dispose_referral_phi` and
`set_document_confidentiality`. **None of them restores a document to `active`.**
`app.guard_document_transition` *permits* `soft_deleted → active` and `disposal_pending → active`,
and neither transition clears `deleted_at` — but no RPC performs either.

So the corner is **latent, and gated only by the absence of a restore door**, not by a constraint.
`documents_soft_delete_stamped` is one-directional (`status = 'soft_deleted' ⇒ deleted_at not null`)
and `app.resolve_document_version_bytes` provably never reads `deleted_at`. **The moment a restore
door is added, that door must clear `deleted_at` or the CHECK becomes necessary** — that is the
sentence worth putting in the canon, and it converts a PO question into a backend constraint on
future work. `ARCHITECTURE.md` §2 currently says the corner is "unmeasured"; it can now say this.

---

## 5 · The remote — measured, and the record is right about it

| | local @ HEAD | remote (`azkbbhskturikxpgmafq`) |
| --- | --- | --- |
| migrations | **411**, newest `20260928000500` | **406**, newest `20260927000360` |
| storage buckets | **4** | **12** — all 8 retired buckets still present |
| `storage.objects` rows | (test residue) | **0, in every bucket** |
| rows in `profiles` / `cases` / `documents` / `file_objects` / `case_referral` / all four PHI tables | — | **0 in every one** |
| six document flags | ON | **all OFF** |

**The retirement is complete locally and not applied on the remote at all** — including
`20260927000400`, the retirement migration itself. `PROGRESS.md:468` states this **correctly and by
name**, enumerating all five local-only migrations and noting that `…0928000300` does not exist
because of the D11 revert. That row is accurate; I reproduced it exactly. Good record.

**Exposure grading:** zero. The remote holds no users, no rows and no bytes. The correct grading is
therefore *"the remote holds no data"* — not *"the flags are off"*, which
`FUP-DM5-REMOTE-STATE-MEASURED` already established is the wrong grain (and R1 is the figure inside
that very finding). Two consequences to keep visible at step 4: **(a)** the recused-coordinator PHI
path is genuinely open on the remote's code, harmless only because the remote is empty, and it stops
being harmless the moment the pilot loads data — so the push must precede any data; **(b)** the eight
retired buckets on the remote must go through the Storage API in the D17-corr1 order
(delete-by-manifest first, *then* anything else), by the runbook that has never been rehearsed.

---

## 6 · Carried to gate step 4 (PO) — none of these are DM5 defects

Verified still open and correctly owned. **None may be invented, inferred or closed by this review.**

1. **ADR 0120 D9's Cloud-verification question** — deferred *"to when S6 reaches it"*. S6 has
   reached it. Amend D9 with a Cloud-specific verification step, or explicitly ratify the
   under-count class as accepted-unverified.
2. **ADR 0114 O1** (retention values), **O2** (scanner + `unscanned_accepted` expiry), **O4** — and
   **S1-O3**. Per ADR 0120's Open/deferred section these stay with the PO; S5 named owners and did
   not invent values, correctly.
3. 🔴 **`FUP-DM5-SUPERSEDE-SERVING-COLLISION`** — PO-owned, deferred. D11 cannot be rebuilt until
   decided. **DM5 may not close over it.** (See R3: it is not in the register the PO reads from.)
4. **`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES`** and 🟠 **`FUP-DM5-DISPOSAL-JOB`** — read as **one**
   deferral with item 3, per their own cross-references. ADR 0121 D1 is binding: *inflow and outflow
   ship together, in one gate, or neither ships.*
5. **The S6 QA's two hand-offs**: who owns the unwritten per-slice S2/S3/S5 `backend-state.md`
   sections; and F3's `active` + stamped-`deleted_at` corner — **now measured** (§4), so the PO is
   being asked a narrower and answerable question: should the restore-door constraint be written
   into the canon, a CHECK, or both.
6. 🔒 **The disposal runbook sequence is UNREHEARSED.** Owner = the PO; executor = whoever holds
   service-role reach (an ACL fact, verified: `complete_document_disposal` grants EXECUTE to
   `postgres` and `service_role` only). Not the lead's to discharge. **See M1** — the runbook does
   not currently tell its own operator this.
7. 🔴 **`FUP-DM5-BACKUP-IS-PHI-EXPORT`** — five values PO-set; destination path and first execution
   still owed, and the procedure has never run.

---

## 7 · What it would take to reach APPROVED

All four blocking items are documentation edits. None requires a migration, a code change, or a
re-run of gate step 2.

1. **R1** — re-derive the flag census against the live catalog, state the bound, attach the query;
   correct every site that transcribed it.
2. **R2** — correct the count in every pointer to the S5 NOT-COVERED enumeration (or drop the count).
3. **R3** — give `FUP-DM5-SUPERSEDE-SERVING-COLLISION` and `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` their own
   index lines; fix the two self-contradictions at `:825` and `:802`.
4. **R4** — put the PHI-disposal gap in § Remaining pre-pilot work and one sentence of it in
   `ARCHITECTURE.md`, discharging plan S5.D.4.
5. **R5 (MAJOR, folded here)** — bring `## Test Run Summary` and `## QA Verdicts` up to date; both
   tables state a retention contract they no longer satisfy. Test Run Summary's only row is
   2026-08-14 / S3 / 1120p, while its own rule is *"the most recent gate only"* and **two** full
   `e2e:prod` gates have run since (the follow-up batch's 1118p at `4f16ea5f`, whose step 5
   *completed*, and gate step 2's 1121p at `15396276` — the run this phase QA rests on). QA Verdicts
   has no **S6** row despite S6's r2 APPROVED. Both tables carry banners announcing that this exact
   omission was fixed at the previous rotation.
6. **M1–M4** — fix M1 and M2 in the runbook before any rehearsal is attempted (they are cheap and
   both bear on the one procedure nobody has run); M3 and M4 may be filed as follow-ups rather than
   fixed in-phase, at the lead's discretion, provided they are filed **with index lines** (R3).

Because every item is docs-only, the "changes loop to step 1" requirement can be discharged the way
S6's was — by re-measurement rather than by argument — without re-running step 2.

---

## 8 · Assessment

DM5 built what ADR 0114 D8/D13, ADR 0120 and ADR 0121 D4 said it would, and it built it well. The
retirement is clean at every layer that executes on the local catalog, on a bound wider than the one
the phase used to check itself. The byte kernel is a genuinely good piece of design — one
authorization point, three composed doors, denial indistinguishable from absence, and audit emitted
after resolution so a refusal cannot mint a row. The PHI posture is stronger than the canon claims:
the three isolated modules are unreachable via PostgREST at the **ACL** layer, not merely the policy
layer, which is the correct answer to the standing lesson that a policy-shaped audit is blind to
DEFINER gates. The audit chain is append-only in trigger, policy and ACL simultaneously.

The phase's risk is not in its code. It is that DM5 exits with a real, ratified, unmitigated
operational gap — **nothing completes a PHI disposal** — plus five unpushed migrations, one of which
leaves a PHI path open on the remote, and one of which is the retirement itself. Every one of those
is survivable, correctly ruled, and honestly recorded *somewhere*. The four blocking findings are all
instances of the same thing: **the somewhere is not the place the next reader will look.** A figure
that reproduces nowhere in the block that promises every figure carries its query; a binding list of
20 that every pointer calls 13; the phase's only 🔴 missing from the register the PO decides from;
and a pilot-gate obligation, written precisely to stop this, undischarged.

That is worth one more round.

---

# r2 — ✅ APPROVED

**Date:** 2026-08-17 · **Commit under review:** `ada0574a` · **Diff verified docs-only**: 8 files,
`ARCHITECTURE.md` · `PROGRESS.md` · `docs/backend-state.md` · `phi-disposal-runbook.md` · three
`docs/progress/` records · this report. **0 `src/`, 0 `supabase/`** — checked from the diff, which is
what makes "gate steps 1 and 2 stand unchanged" a fact rather than an assertion.

## Verdict

**✅ APPROVED.** All four BLOCKING findings are fixed and independently re-measured. All four MINORs
are discharged — two fixed, two filed as follow-ups **with index lines**, which is what R3 was about.
**3 MINOR carried** (below); none blocking.

The lead asked to be treated as suspect on the axis that produced the defects — *a corrected figure
that was never re-derived*. So **nothing below is read from the fix; every figure is measured again
from the live catalog.**

## Re-measured, not read

| fix | what I measured | verdict |
| --- | --- | --- |
| **R1** figure | re-ran the block's own regex against the local catalog: **75 total / 6 read a flag**; remote (`azkbbhskturikxpgmafq`): **74 / 6**. The six names in the block match the catalog exactly | ✅ |
| **R1** assert claim | `begin_document_upload` → `assert_documents_enabled` + waves b/c/d · `open_document_version` → `assert_documents_enabled` · `open_printed_document` → `assert_document_printing_enabled`. All three verified | ✅ (one imprecision — M5) |
| **R1** query-carrying | both halves now carry inline SQL; the policy half re-measured → **0** | ✅ |
| **R2** count | §6 heading now reads **20 items**; the out-of-order tail (1–14, 19, 20, 15–18) is disclosed with the recount command inline | ✅ |
| **R2** pointers | grepped the whole repo for `13 NOT-COVERED` / `13 NOT COVERED`: **zero hits outside this report**, where they are quoting the defect. Both live pointers corrected | ✅ |
| **R3** index lines | `PROGRESS.md:829` 🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION` · `:830` 🟠 `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` — both now carry severity · id · title · owner, placed above `FUP-ACT-DISPOSE-UI` | ✅ |
| **R4** canon half | `ARCHITECTURE.md` §2 `file_objects` bullet now states **NOTHING COMPLETES A DISPOSAL AUTOMATICALLY**, names D2 as unbuilt, and explains *why* the obvious design fails (Storage API unreachable from SQL, so a pure-SQL `pg_cron` job automates only the half that was never the gap) | ✅ |
| **R4** pilot-gate half | § Remaining pre-pilot work now carries **item 1**, a 🔴 PILOT-GATE CHECK naming `FUP-DM5-DISPOSAL-JOB`, `FUP-DM5-BACKUP-IS-PHI-EXPORT` and the unrehearsed runbook | ✅ |
| **R5** | Test Run Summary now carries **3** dated rows incl. both 2026-08-17 gates (green + the kept red); QA Verdicts carries the **S6 slice row** and the **phase row**. The phase row records `⛔ CHANGES REQUESTED (r1)` and **does not pre-write an r2 verdict** — checked, because a record that anticipates its own approval is the shape that ends gates early | ✅ |
| **M1** | runbook **header**, line 13: *"Status: UNREHEARSED — a BINDING open gap of DM5, not a caveat"*, pointing at the 20 NOT-COVERED items and naming item 18 | ✅ |
| **M2** | runbook `:24` and `:403` now say **22 controls**, with the 18→22 correction disclosed in place. Re-verified from `scripts/storage-manifest.mjs`: **22** rehearse labels (`R0`…`R9-monotonic`), **18** selftest (`C1`–`C18`) | ✅ |
| **M3 / M4** | filed as `FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT` (🟡) and `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED` (🟠), **both with index lines** at `PROGRESS.md:827-828` | ✅ |

**R4's canon half exceeded the ask in a way worth naming:** it records that this **inverts ADR 0099
D10** (*"a stale row nobody looks at harms nobody"*) — for PHI the stale row **is** the harm. That
cross-ADR consequence was not in my finding, and it is the sentence that makes the gap legible to
someone who arrives from the notifications side rather than the documents side.

## Carried MINORs — none blocking, all one-line

**M5 · NEW — the R1 fix's one imprecise clause.** `docs/backend-state.md` now says
*"`open_referral_snapshot_document` does not [call an `assert_*` gate] — it is the bespoke door
outside the byte kernel."* **Measured: it does call one** —
`perform app.assert_referrals_enabled()`, whose body is
`if not app.feature_enabled('case_referrals') then raise …`. The door is flag-gated; it is simply
gated by a **referrals-family** assert, which is why it falls outside the census regex
(`document|printed|disposal|…`) and therefore outside the six. As written, a reader can take it as
*"the referral snapshot door has no flag gate,"* which is false. **Fix:** "does not call a
*document-family* assert — it calls `app.assert_referrals_enabled`, outside this census's bound."
Filed here rather than as a blocker because the paragraph's conclusion is unaffected — but it is the
same class the fix was written to close, which is why it earns a line instead of silence.

**M6 · CARRIED from r1 §R3, not addressed.** `PROGRESS.md:865` — the `FUP-E2E-REPEAT-FLAKY` index
line still lists **three** members including `dm5-nsp-evidence:347`. The same file at `:607` now
carries a dedicated passage headed *"`FUP-E2E-REPEAT-FLAKY`: EVID-KBD-1 is REMOVED — it has an
identified, fixed root cause, not an [established flake]"*, and at `:254` says the 2 flaky are
*"exactly the two remaining members."* So the file now states the removal in two places and the
**index line the register is actually read from** still contradicts both. The r1 fix made this
sharper, not softer.

**M7 · CARRIED from r1 §R3, not addressed.** `PROGRESS.md:842` still prints the withdrawn headline
*"⭐ THE CLASS: an ACTION PERFORMED is recorded as the STATE ACHIEVED"* for
`FUP-DM5-NO-ANSWER-VS-NOTHING`, which `follow-ups.md:17-23` records as **withdrawn at QA r1** for
mis-describing two of its own six instances. The live headline is *"An observable PROXY is
substituted for the property that actually matters."* `PROGRESS.md:412` already uses the corrected
one, so the file carries both.

M6 and M7 were named in r1 under R3 as *"two adjacent staleness items in the same index, same class,
cheaper to fix."* They are the same defect as R3's blocking core, in the same list, and they were the
part of the finding that did not carry a blocking marker. That is worth noting as a pattern rather
than a complaint: **an item's severity marker, not its content, determines whether it gets fixed** —
so an adjacent observation inside a blocking finding is, in practice, invisible. Two lines, at the
lead's convenience.

## On the two questions I was asked to be adversarial about

**1 · R1's numbers.** Re-measured independently, twice (r1 and again at r2), on both catalogs. They
reproduce: **75 / 6** local, **74 / 6** remote, six names exact. The one thing the re-derivation
surfaced that the fix did not is M5 above. The fix's own framing — *"correcting a claim's DIRECTION
is not verifying its MAGNITUDE"* — is the right generalization and is worth more than the number.

**2 · `PROGRESS.md` at 119,793 B (measured), against §7's "well under 60 KB" — now ~2× target.**
You asked, so: **yes, some of what was added is record-shaped, not tracker-shaped**, and it is worth
saying that the currency was restored by breaking two retention contracts — which is the same shape
as the defect it fixed (*a table not satisfying its own stated rule*).

- **Test Run Summary** now holds **three** rows plus the kept-RED narrative, against its own stated
  rule *"Most recent gate only, ONE ROW each."* Keeping the RED beside the GREEN is genuinely
  valuable — it is why the fix exists and it is the phase's best artifact on
  composition-dependent failure — but that value is **archive** value.
  **Recommend:** at step 5, keep the one declaring-green row here; move the RED run's narrative and
  the 2026-08-14 S3 row to `test-run-archive.md` with a one-line pointer.
- **QA Verdicts** rows are long-form rationale, against that table's rule *"never restate rationale
  here or in the archive."*
  **Recommend:** compress both new rows to verdict + counts + date + link, as the other rows'
  archived form does. The reasoning is in this file; that is what the link is for.
- **Everything else added — R4's canon paragraph, the pilot-gate item, the four index lines — belongs
  exactly where it is** and should not be moved to buy back bytes. The index lines in particular are
  the fix for R3; rotating them out would re-create it.

⛔ **What I would not do:** treat 119 KB as a number to get down. §7's own banner says the residual is
a PO call and *"Do not 'fix' it by trimming rows."* The two recommendations above are rotation of
**narrative**, not removal of **items**, and they recover roughly what this commit added without
touching a single tracked fact. Not a condition of this approval.

## Scope of r2 — unchanged from r1 except where stated

r2 covers the `ada0574a` fixes **and the phase**. It does **not** cover: gate step 2 (green at
`15396276`, not re-run by me, and not re-run for this commit — correctly, as the diff touches no
executable file); the pgTAP suite (not re-run; catalog facts are unaffected by row residue and the
registry reconciles 411 == 411); or gate step 4, which remains the PO's with the seven items in §6
undischarged. **The five local-only migrations remain unpushed** — including `20260927000400`, the
retirement itself — so the retirement is complete on the local catalog and **not applied on the
remote**, where all eight retired buckets survive over zero objects and zero rows. 🔒 The unrehearsed
runbook still binds and 🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION` is still deferred, not closed;
**this approval closes over neither.**

**DM5 is APPROVED at gate step 3, phase scope.** Step 4 is next.

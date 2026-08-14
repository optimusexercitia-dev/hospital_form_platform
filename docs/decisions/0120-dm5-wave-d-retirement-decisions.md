# ADR 0120 — DM5 (Wave D + retirement) decisions

- **Status:** ACCEPTED — PO-ruled 2026-08-14, at DM5 phase open, before any SQL
- **Context:** executes **ADR 0114** D13's fourth wave and the program's retirement
  manifest. Per-phase siblings: [0116](./0116-dm1-substrate-cutover-decisions.md) (DM1),
  [0117](./0117-dm2-s1-confidentiality-ceiling-decisions.md) /
  [0118](./0118-dm2-s2-command-layer-decisions.md) (DM2),
  [0119](./0119-dm4-referral-document-substrate-decisions.md) (DM4).
- **Evidence base:** `docs/progress/dm5-surface-verification.md` (step 0, commit
  `005fe34d`). Every catalog claim below was re-verified by the lead directly against
  the live catalog before the rulings were taken — not accepted from the report.

> ⚠ The step-0 report found **two hard blockers the parent plan does not know about**
> and **six places the plan describes a system that does not exist**. The decisions
> below exist because the plan text could not be executed as written.

## Decisions

**D1 — Three new securable resource types: `rca`, `capa_action`, `form_response`.**
`securable_resources_type_check` admits only
`{case, meeting, interview, action_item, controlled_document, case_referral}`, so Wave D
evidence and form-response prints have no home. ⚠ **`securable_resources_tenant_shape`
re-enumerates the same six types**, so a migration that widens only `type_check` leaves
`tenant_shape` false for the new type and every insert is **rejected**. That
fail-closed coupling is a property, not an accident: **widen both CHECKs in one edit and
keystone the coupling**, so a future seventh type cannot be half-added.

**D2 — RCA/CAPA tenancy pins the REPORTING commission; custody is a read-time input, never
a tenancy input.** A patient-safety event carries both `reporting_commission_id` and
`current_owner_commission_id`, and **custody moves**. `tenant_shape` demands a non-null
commission, so the registry row pins the **reporting** commission — stable for the row's
life — while the `can_read_document` arm delegates to `app.can_read_event`, which already
follows custody. Custody movement therefore changes *who may read* and never *where the row
is tenanted*. Rejected: pinning `current_owner_commission_id` (a moving tenancy key is a
tenant-isolation hazard); a nullable commission for these types (would weaken `tenant_shape`
for all six existing types).

## ⛔⛔ D3, D4 and D5 ARE WITHDRAWN — superseded by D11 (PO re-ruling, 2026-08-14, same day)

> **DO NOT IMPLEMENT D3, D4 OR D5. They were drafted on a false premise and never reached
> SQL.** Their text is retained below under strike-through *solely* for the reasoning trail.
> ⚠ **This banner is deliberately loud.** The DM2 record marked its own superseded fork with
> an HTML comment (`<!-- superseded fork text … -->`), invisible in rendered Markdown — and
> **that is exactly how the lead came to quote dead text as current and mis-brief the PO.**
> A supersession marker that only a raw-file reader can see is not a marker.

~~**D3 — `document_version_files` gains a liveness column and its UNIQUE becomes PARTIAL over
live rows.** `UNIQUE (document_version_id, rendition_kind)` permits one `printed_pdf` per
version; `printed_documents_one_active` is a partial unique on `status='active'`, i.e. many
retained historical prints per source. The two cardinalities are incompatible and the partial
form wins. This is an explicit, ratified amendment to a DM1 invariant (ADR 0116), taken on its
own merits — not a widening adopted as a side effect of making a command compile.~~

~~**D4 — the immutability guard gains ONE narrow, keystoned exception.** The exception admits
exactly the liveness column, in one direction only (live → retired), and nothing else.
Keystone both polarities.~~

~~**D5 — `reclassify_document_file` is BUILT in DM5.** Parked at DM2 (S2.8) as having "no legal
expression on the DM1 substrate"; D3+D4 are precisely the mechanism it was waiting for.~~

**D11 — printed renditions follow the EXISTING new-version idiom; `document_version_files` is
NOT touched.** Each print event mints a `document_version`, binds its bytes as the
`printed_pdf` rendition of *that* version, records supersession on `printed_documents` (where
`printed_documents_one_active` already models it), and retires superseded bytes through
`file_objects.disposal_state`. **Zero schema change** to `document_version_files`, **no** guard
exception, **no** DM1-invariant amendment.

**Why D3–D5 were wrong — four catalog facts, each verified live before the re-ruling:**

0. ⭐ **DM2 CONSIDERED D3+D4 AND REJECTED THEM BY NAME.**
   `docs/progress/dm2-orchestration-wave-a.md:253-281` records the re-derivation and rules:
   *"Option 2 (partial UNIQUE + liveness column + guard exception) remains strictly worse: an
   invariant edit for no additional honesty."* That sentence **is** D3 and D4, evaluated and
   rejected with the reasoning preserved, eight days before this ADR proposed them again. The
   failure was not that the answer was hard — it was that a settled ruling was re-opened without
   anyone reading it.
1. **S2.8 was never parked.** It was **RULED at DM2 on 2026-08-13 (option 1), BUILT** in migration
   `20260924000500`, and **recorded in ADR [0118](./0118-dm2-s2-command-layer-decisions.md)**,
   keystoned at pgTAP `329` R6/R7 (the last-copy differential pair) and R8 (vacuity pin), with a
   mutation twin neutralizing the sha term. It shipped under a
   different name — `public.reclassify_document` + `complete_document_reclassification` — which
   mint a new `document_version`, bind the new `file_object`, and retire the old via
   `disposal_state = 'disposal_pending'` with reason `duplicate`; `complete_document_disposal`
   gates that reason on a **live same-`sha256` sibling it verifies itself** (`HC0DR`, commented
   *"EVIDENCE, never a claim"*). D5's premise was the **superseded fork text**, and the DM2 lead
   chose option 1 **precisely because it needs zero DM1-invariant edits** — the opposite of what
   D5 attributed to it.
2. **The guard is SHARED.** `app.guard_document_version_immutable()` backs triggers on **both**
   `document_version_files` *and* `document_versions`, and its body inspects nothing — it raises
   `HC0D2` unconditionally. D4's "narrow exception on one table" would have altered the
   immutability contract of `document_versions`, which ADR 0114 **D10** protects with *"never a
   pointer update (F-03)"* — re-opening a closed audit finding.
3. **`file_objects` already carries liveness** — `upload_state` (10 states) + `disposal_state`
   ∈ `{none, disposal_pending, disposed}`, governed by `guard_file_object_transition`. D3's
   column would have been a **second liveness authority able to disagree with the first**, with
   every door then obliged to consult both.
4. **The "incompatible cardinality" was a comparison between keys that never meet.**
   `(document_version_id, rendition_kind)` is per-**version**; `(source_kind, source_id,
   template_key)` is per-**source**. Under one-version-per-print they are the **same grain** and
   do not conflict. The conflict was an artifact of the lead's framing, not of the schema — and
   the PO ruled on that framing.

⭐ **The reusable lesson, and the reason this ADR keeps the wreckage visible.** The verdict was
keyed to the **noun** `reclassify_document_file`, which is genuinely absent from `pg_proc` — so a
name-keyed check answered "unbuilt" while the **capability** was live under another name.
*Resolve the VALUE, not the noun.* Same class as `docs/backend-state.md`'s stale "Still unbuilt"
line (corrected in the same pass), and a direct instance of the standing rules
`a-rename-orphans-a-name-keyed-verdict` and
`a-comment-is-an-assertion-that-goes-stale-silently`.
⚠ **Nothing was built on D3–D5.** The cost was one planning cycle and a held teammate, because the
reevaluation happened before SQL — which is the argument for step 0 and for full plan review on
invariant-touching slices, not against them.

⛔ **The stale line has now misled TWICE, and the second time it produced an ADR decision.**
`docs/backend-state.md:245-246` was written at DM2 S2 close and never updated when S2.8 landed
**later the same day**. DM3's planner hit it and *caught* it
(`docs/plans/dm3-controlled-documents-plan.md:611-637` — "S2.8 is CLOSED, and DM3 does not force
it open"); DM5's lead hit it and did not. Corrected in the same change as this re-ruling. **A
durable surface map that lags its own phase by hours is a trap with a long fuse** — the correction
belongs in the same commit as the work, not in the next phase's Record step.

**Two consequences carried into S3 rather than lost here:**
- **A concrete TS defect the idiom exposes:** `src/lib/queries/documents.ts:116` and `:142` both do
  `.find(b => b.rendition_kind === 'source')`. A print document whose only binding is `printed_pdf`
  yields `latestFile === undefined`, so `containsPhi` and `availability` derive from a **missing
  source**. Real, and S3's to handle.
- **`documents.kind` has no CHECK** (`select count(*) from pg_constraint where
  conrelid='public.documents'::regclass and conname ilike '%kind%'` → **0**; the only value in use
  is `documento_controlado`), so it is available as a discriminator today without a migration.
- **Five consumers order by `version_number desc` to mean "latest"** (`app._referral_reply_documents`,
  `public.add_referral_shared_item` — which picks what to **freeze into a referral snapshot** —
  `public.reclassify_document`, and `documents.ts:139/:226`). ⚠ **This only bites if a print appends
  a version to an existing content `documents` row.** Under D6 a print homes on its *source's*
  securable resource as its **own** `documents` row, so all three SQL consumers resolve within a
  single document and never see it. Neither gate cares: `open_document_version` has no version
  ordering at all, and `app.can_read_document` dispatches purely on
  `securable_resources.resource_type`.

**D6 — all four `printed_documents.source_kind` values migrate.** Prints home on their
**source's** securable resource; `case` / `meeting` / `interview` already exist as types and
`form_response` is admitted by D1. Rejected: carving out `form_response`, which would leave
`printed-documents` outside the retirement manifest and close the program at 7 of 8 buckets.

**D7 — `printed_documents` BECOMES the satellite; no new table is created.** ADR 0114 D13
says verification tokens "stay in a satellite" — **the satellite does not exist**.
`verification_token` and `verification_short_code` are columns on `printed_documents` itself,
beside `storage_path`. The row therefore keeps tokens, status, supersession and revocation,
and exchanges `storage_path` (plus its derived-path CHECK `pd_storage_path_derived`) for a
binding to the core rendition row. ⚠ `verification_lookups` is a lookup-**audit** satellite,
not a token store — do not conflate them. *Mechanism is backend's to plan; the shape is
ruled here.*

**D8 — the retirement manifest is EIGHT buckets, not nine.** `meeting-attachments` does not
exist — retired by `20260921000300` and already pinned by
`supabase/tests/325_legacy_bucket_policy_pin.sql`. The parent plan's ninth entry is stale.

**D9 — retirement is MANIFEST-FIRST; the plan's stated method is WITHDRAWN.** "Prove zero
objects via the Storage API, then delete the bucket" cannot work: the Storage API lists *from*
`storage.objects`, a DB reset truncates that table, and the bytes survive it. Measured at HEAD
locally: **`storage.objects` = 0 rows** against **699 objects / 7,023,687 bytes on the volume,
198 of them PHI-tier**, with `list` returning `[]` for all 12 buckets. The method is replaced
by: **capture the authoritative key list before any destructive step, delete by key, and
assert `deleted_count == manifest_count` per bucket** — turning an unfalsifiable negative into
a positive count comparison, where a truncated table yields a visibly zero-length manifest
instead of a silent pass. Backend-agnostic, so it transfers to Cloud; the volume walk that
sees today's 699 is the local **proof**, not the gate, because it depends on
`STORAGE_BACKEND=file`.

**D10 — `documents_wave_d` joins the MIN flag pattern at the FIRST residue-producing step.**
Home/arm-scoped, never blanket — a blanket assert satisfies the new keystone while silently
killing an earlier wave (the DM3 `DM3·T3b` control). pgTAP `328` K9b/K9c count the OFF and ON
flags and **move in the same edit**; that coupling is deliberate. Production stays OFF until
the DM5 gate closes with human approval.

## Consequences

- **The orphaned bytes are not servable, and that is a calibration, not a reprieve.** A
  service-role `GET` on a known orphan key returns 400 and `sign` returns `404 not_found`,
  because every read path resolves metadata first. So FUP-DM5-STORAGE-ORPHANS is a
  **data-at-rest / disposal-assertion** problem — Rule 12, LGPD erasure, the F-02 class — not a
  live exposure. It is *also* why API-based enumeration fails by construction.
- **Remote behaviour stays an INFERENCE.** On Cloud there may be **no customer-accessible tool
  that can see an orphan**: dashboard, CLI and supabase-js all list from `storage.objects`, and
  the S3 endpoint is **UNVERIFIED**. Record this as a residual; do not gloss it as solved.
  `scripts/document-reconciliation.mjs` covers only 2 of 12 buckets and lists from
  `storage.objects`, so it cannot see this class either.
- **DM5's assurance plan is worse than DM4's, not better.** Every door DM5 adds or modifies
  sits in a census blind class, so all four §6 step-1 arms pass regardless of what is built.
  Bespoke pgTAP keystones plus mutation twins are **mandatory**, and the phase record must
  **name the arm, not the script**. ⚠ Red-first is genuinely hard here: a keystone against the
  un-parked `add_rca_evidence` **goes green on its first run**, because the table CHECK
  `rca_evidence_cited_document_parked` still refuses — a *sibling lock* satisfying the
  assertion. Neutralize each lock independently.
- **FUP-PGTAP-VACUOUS applies directly**: `lint:vacuous` does not scan SQL and every DM5
  keystone is SQL.
- **`capa_action_evidence` is a second full surface** — its own table, RPC pair, policy pair and
  TS module — that the parent plan never names. A migration scoped on `rca` alone delivers half
  of step 1.
- **`rca_evidence` has TWO independent document seams, not one.** `rca_evidence_shape` makes
  `cited_document_id` the **citation** slot (`kind='citation'`, mutually exclusive with
  `storage_path`), while `storage_path` is the **uploaded byte**. Re-pointing the upload and
  un-parking the citation are separate jobs; the parent plan's "the attachments FK" framing
  collapses them.
- Both evidence deletes are **soft-only**, so every deleted evidence file is a permanent orphan
  by design — an input to D9's manifest, not an exception to it.
- `printed_documents` uses **column-list grants** (`storage_path`, `verification_token`,
  `revoked_reason`, `revoked_by` withheld). Every new column needs its own GRANT or reads
  `42501` — the `case_referral` trap.
- **pgTAP `312` / `313` / `323` insert `storage.objects` rows for `printed-documents` without
  creating the bucket row**, so deleting that bucket breaks three suites on an FK violation.
  D8's manifest must sequence the fixture fix before the deletion.

## Open / deferred

- **FUP-DM5-GRANTS (new, filed by this ADR):** `rca_evidence` and `capa_action_evidence` carry
  table-wide `arwdDxtm` to `authenticated`, so their RPCs are **not single doors** — direct
  PostgREST DML reaches the tables. ⚠ **Calibrated:** RLS is enabled on both with genuinely
  distinct read and write predicates (`can_read_event(event_of_rca(rca_id))` vs
  `can_write_rca`), so this is *not* an open door; what direct DML bypasses is the RPC's flag
  gate and its fail-closed arms. Hardening, not a blocker — but DM5 must not *assume* the RPC
  is the only writer when it places the `documents_wave_d` assert (D10).
- **`p_storage_path` is caller-supplied and unvalidated** on the evidence writers — the D8/D9
  inversion Wave D exists to fix. In scope for S1.
- **FUP-DM4-RECUSAL** remains open with the `documents_wave_c` flag-on date as its deadline;
  DM5 does not close it and must not be read as closing it.
- ADR 0114 **O1** (retention values) and **O2** (scanner selection + the `unscanned_accepted`
  expiry condition) stay with the PO. S4 names the operational owner and mechanism; it does not
  invent the values.

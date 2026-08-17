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

> ⏳ **CONTESTED, as of 2026-08-14 (S3 measured) — `FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES`.** The clause
> *"retires superseded bytes through `file_objects.disposal_state`"* is **enabled, not performed**: both
> the superseded and the active print measure `disposal_state = 'none'`, and **no code schedules the
> transition.** D11's other claims are satisfied and S3 shipped on them. Left as an **inline pointer
> rather than an amendment on purpose** — build-it-or-strike-it is the PO's ruling to make, and
> pre-writing either outcome here would take that choice away. ⚠ Recorded because this is a **20-yr
> LGPD/ANVISA retention record**: one asserting a control no code performs is worse than one admitting
> the gap. (Raised as r2-MINOR-1 — the follow-up existed, but *this* is where an auditor reads D11.)

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

> **⏳ EXECUTION NOTE — S4, 2026-08-16. The ruling STANDS; this records what happened when it
> ran, because "the method is ruled" and "the method has been exercised" are different claims
> and only one of them was true.**
>
> S4 ran D9 against the local stack and the manifest came back **EMPTY**: `storage.objects` held
> **0 rows in all 12 buckets** while the volume carried **866 files / 9.9 MB / 235 PHI-tier**
> (**221 / 6.93 MB / 15 PHI** in the eight retirement buckets). Every retirement-bucket byte is
> already an orphan with **no metadata row**, so the Storage-API gate cannot address any of them.
> `capture` returned its `DEGENERATE BASELINE` verdict exactly as designed, and **`delete
> --execute` was never run** — there was nothing it could legally delete.
>
> Three consequences, none of which weaken D9:
> 1. **The count-comparison design is vindicated, not contradicted.** An empty manifest is
>    *visible*; the withdrawn method would have proved "zero objects" against the truncated table
>    and reported success over 221 surviving PHI-bearing files.
> 2. **D9 is meaningful where metadata exists — i.e. production** (census 2026-08-11: 45 objects).
>    It is *not* exercisable on a local stack that has been reset since the objects were written.
> 3. ⛔ **So the sequence remains UNREHEARSED end-to-end.** Its correctness rests on S0's 8/8
>    self-test (a manufactured orphan it must find; a deliberate count mismatch it must refuse),
>    **not** on any S4 execution. Do not let S5/S6 read S4's completion as evidence that the
>    deploy-time byte path has been run. It has not.
>
>    ✅ **OWNED as of 2026-08-17: the PO directed the rehearsal into S5 scope as `S5.R`**
>    ([plan](../plans/dm5-wave-d-retirement-plan.md) § S5.R). It must rehearse the
>    **with-metadata** path — the condition production is in and the one S4's no-op skipped —
>    on a purpose-made disposable bucket, because `capture` now returns `BUCKET_ABSENT` for all
>    eight retired buckets (QA r1 MINOR-5) and they hold 0 bytes. ⚠ Until S5.R runs, this
>    paragraph stands unchanged: **naming an owner is not a rehearsal.**
>
>    ✅ **S5.R HAS RUN — 2026-08-17, `e5a1418e`, 14 controls green** against a purpose-made bucket
>    populated **through the Storage API so metadata rows exist**. The local rehearsal passes. ⛔ **But
>    it produced a finding that bears directly on D9's assurance ON CLOUD, and D9 should not be read as
>    rehearsed there.**
>
>    ⛔⛔ **THE UNDER-COUNT CLASS IS NOT CAUGHT BY THE COUNT COMPARISON.** A manifest listing 4 of the
>    5 keys actually present yields `deleted=4 manifest=4 MATCH` — **the comparison passes** — and only
>    the **local volume proof** turns it into a failure. Proven single-variable: with the volume proof
>    the run exits 1 on surviving bytes (R3b); with that proof unavailable the identical scenario exits
>    **0**, reports *"ALL BUCKETS MATCHED THEIR MANIFEST COUNT"*, and a real file survives (R6). The
>    **over**-count refusal transfers intact (R6b) — this is not "nothing works remotely".
>
>    **Of D9's four controls, two do not survive the loss of local proof, and both lost ones are the
>    byte-side ones:** a manufactured extra orphan is **not** found (it depends entirely on the volume
>    walk); a count mismatch is refused only in the **over**-count direction. "Re-capture reads empty"
>    degrades to ***metadata*-empty** — which is the exact assurance D9 exists because we could not
>    trust. The retirement guard still refuses, but it counts **metadata rows**, so it is blind to
>    orphaned bytes by construction.
>
>    ⚠ **Strength of inference, stated because it is as much the artifact as the finding.** This is a
>    property of the **tool's code**, established by forcing its **already-existing** no-local-proof
>    branch (the branch predates the change — lead-verified). The bridge to Cloud is *the absence of a
>    precondition readable in the source*: `locateVolume()` requires a `supabase_storage` container
>    plus `STORAGE_BACKEND=file`, neither of which can hold for a Cloud project. **That is weaker than
>    a Cloud measurement and is not dressed up as one.** Nothing remote was touched. **Unsettled:**
>    whether Cloud exposes any *other* orphan-visible surface — the **S3 endpoint is UNPROBED**, and
>    probing it is the one measurement that could change this verdict.
>
>    **Consequence for this decision, and it is an S6 / deploy-runbook input, not a slice detail:**
>    D9's *ordering* stands — bytes first, then the row. What is newly known is that D9's
>    **verification** is materially weaker on Cloud than the local rehearsal demonstrates, so a Cloud
>    run **must not gate on the count comparison alone**, and `capture`'s exit code is unusable there
>    as a gate (every bucket verdicts `UNVERIFIED_NO_LOCAL_PROOF` ⇒ exit 1; the only route to exit 0 is
>    `--allow-orphans`, which also silences genuine orphan verdicts). ⚠ **Whether D9 needs a formal
>    amendment — a Cloud-specific verification step, or an explicit ratification that the under-count
>    class is accepted as unverified — is a PO decision at S6. It is recorded here, unresolved, rather
>    than resolved silently in a runbook.** Full record: `docs/progress/dm5-s5-operational-closure.md`.
>
> The bucket ROWS and their policies were retired by migration `20260927000400`, which deletes
> **zero bytes** by design and **refuses** to retire a bucket still holding `storage.objects`
> rows — D9's ordering encoded executably rather than as prose. Detail:
> [dm5-wave-d-retirement.md](../progress/dm5-wave-d-retirement.md) § S4; open orphan question:
> **FUP-DM5-STORAGE-ORPHANS**.
>
> ⛔⛔ **POSTSCRIPT 2026-08-17, and it bears directly on what D9 does NOT cover.** Roughly an hour
> after the measurement above, all **221** of those orphaned files (**15 PHI-tier**) were destroyed —
> **not by this migration and not through this gate.** Recovering a wedged local stack
> (`supabase stop` + `supabase start`, after a mid-flight `supabase db reset` was killed) recreated the
> storage volume at `01:06:02Z`; `supabase stop` reported `"backup":true` while doing it. Verified:
> `walk` → *"(no directory on the volume)"* ×8; `capture` → `orphan_keys=0`, `CAPTURE CLEAN`.
>
> **No manifest at disposal time, no `deleted == manifest` comparison, no audit row — i.e. exactly the
> event this decision exists to prevent, occurring inside the slice that ratified it.** The finding is
> not that D9 is wrong; D9 governs *deliberate* retirement and did so correctly. The finding is that
> **D9's scope is the deliberate path, and the accidental path is ungoverned and silent.** Nothing
> alarmed; it surfaced only because a reviewer refused to inherit a 3-hour-old figure. Tracked as
> **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — and it is a live question for the Cloud deploy, where
> `npm run db:reset:linked` exists and a 20-yr LGPD/ANVISA retention posture makes *"bytes vanished
> and we cannot say which or when"* a compliance statement rather than a tidiness one.
>
> ✅ **RULED 2026-08-17 (later the same day), on a measurement taken at decision time.** The orphan
> question was re-put to the PO as QA r1's B1 required. Re-measured first, on a freshly-rebooted stack
> after a clean `db reset`: **0 files in all eight retired buckets**; 166 files / 2,970,290 B in the
> four survivors *at that moment* — ⛔ **a timestamped observation, not a count: it read 245 files after
> the same session's `e2e:prod` gate** (QA r2 INFO-5), because every gate run writes bytes and every
> reset orphans them. ⭐ **The PO therefore ratified a CLASS, not a number**, which is what makes the
> ruling durable: **the local volume is non-durable, disposable test residue** — no
> cleanup step, no gate, no local manifest discipline. The retirement-scope orphan question therefore
> closes **empty by measurement**, not by disposal and not by the `01:06:02Z` destruction, which stays
> charged to FUP-DM5-STACK-CYCLE-DESTROYS-BYTES.
>
> ⭐ **The re-measurement changed the question, which is the whole point of B1.** The 166 survivors are
> not retirement residue — they are ordinary E2E/print artifacts that **the reset orphaned as it ran**.
> So local orphan accumulation is not an S4 artifact but a **standing byproduct of `db reset` on any
> stack that has written bytes**. Re-putting the question on the original 221-file framing would have
> had the PO rule a second time on a state that no longer existed — the precise failure B1 was filed
> for. **None of this relieves the paragraph above: the deploy-time byte path remains UNREHEARSED.**

**D10 — `documents_wave_d` joins the MIN flag pattern at the FIRST residue-producing step.**
Home/arm-scoped, never blanket — a blanket assert satisfies the new keystone while silently
killing an earlier wave (the DM3 `DM3·T3b` control). pgTAP `328` K9b/K9c count the OFF and ON
flags and **move in the same edit**; that coupling is deliberate. Production stays OFF until
the DM5 gate closes with human approval.

**D12 — printed bytes are served by COMPOSITION: `open_printed_document` keeps its own authority
and delegates byte resolution to the core door.** (PO ruling 2026-08-14.) D11 leaves a print's
version carrying only a `printed_pdf` binding, but `open_document_version` resolves bytes with a
**hardcoded `rendition_kind = 'source'`** — so a print would be unopenable through it — and
`file_objects` may only live in `documents-standard` / `documents-phi`
(`file_objects_bucket_check`), which carry **no SELECT policy** precisely because ADR 0114 **D8**
reserves them for *"the **single** audited `open_document_version` door … (the F-01 class dies
structurally)"*.

`open_printed_document` therefore retains what is genuinely its own — `can_view_printed_document`
authority, the revoked/superseded overlay, the verification-token path, its `document.downloaded`
audit — and obtains coordinates through the core resolver. **D8 stays literally true: one door
signs.** Rejected: amending D8 to admit a second door (its singularity is the stated mechanism, not
a stylistic preference); parameterizing the core door by rendition kind (widens a function every
document read traverses); leaving prints on their own bucket (forfeits Wave D's scan/disposal
machinery, contradicts D6, reopens the manifest at 7/8).

⚠ **Binding constraint on the composition — the two authority checks must be reconciled EXPLICITLY,
and the reconciliation must not widen either.** `can_view_printed_document` and `can_read_document`
are different predicates; a delegation that authorizes with only the print check could let a caller
who fails `can_read_document` reach bytes, and a delegation that authorizes with only the document
check could break the verification-token flow. **Required shape:** the shared resolver is
**`app`-scoped, never `public`** (so it is unreachable by a direct PostgREST caller — the corridor
lesson), and effective authority is the **conjunction**. Keystone **both directions**: a caller
passing the print check but failing `can_read_document` is refused, and a caller passing
`can_read_document` but failing the print check is refused. A composition proven in only one
direction is a widening nobody measured — the same discipline the withdrawn D4 was to be held to.

**D13 — a print mints its version on its OWN `documents` row, never appended to a content document.**
(Lead ruling; not a product tradeoff.) The print's document homes on its **source's** securable
resource. This is forced, not stylistic: **`add_referral_shared_item` selects
`order by dv.version_number desc, vf.created_at desc limit 1` to choose what to FREEZE into a
referral snapshot.** If prints appended versions to a content document, a referral would silently
freeze a **printed PDF instead of the source content** — a correctness defect invisible to every
static gate. Two further consumers (`app._referral_reply_documents`,
`public.reclassify_document`) and two TS readers (`documents.ts:139`, `:226`) share the
latest-version-wins assumption and are safe **only** under this separation. **Keystone the
separation itself**, not merely its consequences. `documents.kind` carries **no CHECK** (0
constraints), so it is available as a discriminator without a migration.

**D14 — `capa_action` tenants on organization + hospital; `commission_id` is NULL-permitted for
that type alone.** (PO ruling 2026-08-14.) `securable_resources_tenant_shape` demands org **and**
hospital **and** commission for all six current types, but `capa_plan` has **`hospital_id` NOT NULL
and no commission column at all** — so for `source='manual'` no commission exists to derive, and
`app.event_of_capa` resolves only `rca` / `event`, leaving 4 of 6 sources with a NULL hospital today
(see D16). `capa_plan_source_check` admits `{rca, event, indicator, audit_finding, meeting, manual}`.

**The commission costs nothing here, measured rather than assumed:**
`select attnotnull from pg_attribute where attrelid='public.audit_log'::regclass and
attname='commission_id'` → **`f`** (a commission-less audit row is already legal), and
`select count(*) from pg_policies where tablename='documents' and
coalesce(qual,'')||coalesce(with_check,'') like '%commission_id%'` → **0** (the registry commission
is **not** a tenant-isolation input for `documents`). The read arm resolves through `can_read_capa`
regardless — D2's principle that authority resolves at read time, never from the registry row.

⚠ **`audit_finding` is NOT a dead value.** Its table does not exist yet
(`information_schema.tables ilike '%audit_finding%'` → 0 rows, and `source_audit_finding_id` has no
FK), but **internal audit / mock tracer is a roadmap module** whose non-conforming finding *opens a
CAPA*. The value is anticipatory. Scoping S2 to the four currently-derivable sources would
therefore have guaranteed a reopen when that module ships — which is why the narrower option lost.

⚠ **The `tenant_shape` CHECK now carries TWO shapes**, so the D1 coupling keystone must cover both:
widening `type_check` alone must still reject, *and* a `capa_action` row must still be rejected if
it lacks org or hospital. A coupling keystone that only exercises the six-type shape would pass
while the new shape admits anything.

**D15 — the live CAPA-upload defect is fixed INSIDE S2** (lead ruling), as `BUG-DM5-CAPA-1`, and
`tester` adds the upload-kind E2E the suite has never had. S2's migration edits that exact policy;
leaving a known-broken upload path while rewriting its neighbour is not a defensible boundary. Its
fix migration stays **separate** from the substrate migrations so its red is provable against
today's catalog — folding it in would make that red impossible.

**D16 — `app.hospital_of_capa_action` is corrected to read `capa_plan.hospital_id` directly** (lead
ruling). It currently routes through `app.event_of_capa`, which resolves only `rca` and `event`, so
it returns NULL for **4 of 6** sources despite `capa_plan.hospital_id` being NOT NULL and directly
available. It has **zero callers** (`prosrc ~* 'hospital_of_capa_action'` excluding itself → 0), so
this is latent, not live — but S2 adds arms in exactly this area and D14 makes the hospital
load-bearing for `capa_action` tenancy. **A wrong function with no callers is a loaded gun**;
correcting it costs three lines now against a silent NULL later.

## D17 — DM5 designs for a RESET remote (PO ruling, 2026-08-14)

**The PO confirmed a full database reset is available on local *and* remote.** The project is
pre-launch with no live users, so this is the standing pre-launch posture applied to DM5, not a new
allowance: *design the correct schema, do not write back-compat migrations for data that may be
discarded.*

**What it changes.**

1. **S3 drops the "copy → verify → switch" ceremony for production print objects.** S3 builds the
   correct D7/D11/D13 shape directly. ⚠ **This is not "no data migration."** A fresh reset still
   produces rows — the **seed** and the pgTAP fixtures both insert `printed_documents` — so the
   migration must be correct against *those*, and the seed plus `312`/`313`/`323` must be rewritten
   to the new shape in the same slice. What is dropped is only the ceremony for **pre-existing
   remote/production bytes**.
2. ⭐ **No backfill is a SAFETY property here, not just less work.** DM3's P0 was a migration that
   *"added the FK and backfilled but never taught the CREATE path"* — and **the backfill is what
   masked it from every incremental run** ([[a-backfill-masks-the-broken-write-path]]). With no
   backfill, the create path is the only path, so a create path that was never taught fails
   **immediately and loudly** instead of silently. Do **not** add a convenience backfill.
3. **S4 is unblocked, but NOT for the reason it first appears** — see the correction below.

### ⚠ CORRECTION, made before this ruling was recorded: a remote reset does NOT clear orphaned bytes — it CREATES them

The lead's own framing when putting this option to the PO said a wiped remote *"dissolves"*
FUP-DM5-STORAGE-ORPHANS. **That is wrong, and FUP-DM5-STORAGE-ORPHANS already says so in writing:**
*"a remote reset would orphan all of them."* A reset truncates `storage.objects` and **leaves the
bytes**; that is the finding's entire content (measured locally: **0 metadata rows vs 699 files /
7.0 MB / 198 PHI-tier**, `list` returning `[]` for all 12 buckets). Reset-first would make retirement
**unprovable**, because emptiness would then be asserted against a table that was just truncated.

**Therefore the ordering is binding, and it is the reverse of the intuitive one:**

> **delete-by-manifest through the Storage API FIRST — while `storage.objects` metadata still exists
> and the keys are still enumerable — and only THEN reset.**

This is exactly what D9's manifest-first ruling already requires, so **S0's manifest tool remains
load-bearing and is not superseded by D17.** What D17 genuinely dissolves is the **DB-row** half:
FUP-DM4-PRODROW's dangling frozen snapshot row, the 4 dangling attachment rows and the 3
unreferenced controlled-document objects all stop being reconciliation problems.

### ⚠⚠ SECOND CORRECTION (2026-08-14, later the same day): the correction above is right for LOCAL and **WRONG FOR REMOTE**

The section above generalised a **locally measured** finding to remote by *"the same mechanism class."*
**The mechanisms are different**, and the remote one no longer exists at the CLI version this repo pins:

| | mechanism | status |
|---|---|---|
| **local** (`supabase db reset --local`) | the database is recreated wholesale while the **Docker volume survives**, so bytes outlive the metadata | ✅ **structural, still true** — measured `storage.objects` **0 rows vs 699 objects / 7.02 MB / 198 PHI-tier** |
| **remote** (`db:reset:linked`) | came from **one line** in the CLI's `pkg/migration/queries/drop.sql` per-schema truncate loop: `or c.relnamespace::regnamespace::name = 'storage' and c.relname != 'migrations'` | ⛔ **added [cli#3083](https://github.com/supabase/cli/pull/3083) 2025-01-30, REVERTED by [cli#3359](https://github.com/supabase/cli/pull/3359) 2025-03-27** (*"causing too much confusion and accidental deletes"*) |

**Verified at our version against the artifact, not the PR title** — grepping the embedded SQL in
`node_modules/@supabase/cli-windows-x64/bin/supabase-go.exe` (**v2.105.0**, `package.json` pins
`^2.105.0`):

```
name = 'storage'  → 0 hits
name = 'auth'     → 3 hits     ← POSITIVE CONTROL: the adjacent line of the same loop, which the
                                 revert never touched. It proves the SQL is greppable in this
                                 binary and the pattern shape is right, so 0 means absent —
                                 not "my grep couldn't see it".
```

**What changes, and what does not:**

- ✅ **The binding ordering above STANDS — but on the local rationale alone**, which is sufficient:
  S4's retirement is performed and proven **locally** first, and reset-first would make emptiness
  unprovable against a just-truncated table. The manifest stays load-bearing. **Do not read this
  correction as licence to reset first.**
- ⛔ **The claim "a remote reset creates orphans" must not be repeated.** At v2.105.0 a
  `db:reset:linked` would **not** orphan the remote's objects, which also reverses a live warning
  feeding FUP-DM4-PRODROW's deploy decision.
- **FUP-DM5-STORAGE-ORPHANS' remote half is demoted from S4 blocker to residual** — a Cloud
  orphan *detector* matters only for orphans something can create.

⭐ **The durable lesson, which is bigger than this ADR: a correctness property can live in a
DEPENDENCY's source and regress on `npm update`.** This one went true → false → true across CLI
versions. So it is recorded as *"true at CLI v2.105.0 because that line is absent"*, **never** as
*"Supabase behaves this way"* — and the grep-with-control must be re-run on any CLI bump. A caret
range (`^2.105.0`) means a routine `npm update` can silently re-arm it.
⚠ Bounds **one** mechanism in the shipped binary. It is not a runtime observation, and not proof
that no other code path clears storage.

⛔ **D17 changes the DESIGN; it does not CLOSE any follow-up.** FUP-DM4-PRODROW and
FUP-DM5-STORAGE-ORPHANS move from *"close by engineering"* to *"close by the documented
manifest-then-reset sequence at deploy"* — they stay **OPEN** until that sequence actually runs.
Marking them closed on the strength of a reset that has not happened is the precise failure this
paragraph exists to prevent.

⛔ **No `db push` and no remote reset are authorized by D17.** The standing no-push directive holds.
Both require explicit PO authorization **at execution time**, separately, on the day.

## D18 — printed renditions are FILTERED OUT of the Documentos panel (PO ruling, 2026-08-14)

D13 gives every print event its **own `documents` row homed on the source's securable resource**, and
`listDocuments` filters on `home_resource_id` with **no `kind` filter** (verified in
`src/lib/queries/documents.ts:198`). So without a decision, generated PDFs would begin appearing in
every case's *Documentos* panel beside uploaded files. **Ruled: they are excluded.** *Documentos* keeps
meaning *"documents people put here"*; prints stay reachable through their existing print/verification
surface and `open_printed_document`.

**This selects the trap-3 fix shape.** With prints excluded from that projection, the reachable site
becomes unreachable, so the fix is **"exclude, then keystone the exclusion"** rather than teaching
`documentVersionAvailability` about print-only versions. ⚠ **But the other three
`.find(rendition_kind === 'source')` sites still exist**, and the invariant — *a version with no
`source` binding must never be rendered as `pending`/`canOpen:false` by a projection that can reach it*
— must be keystoned so the two currently-unreachable sites cannot become live silently.

### ⚠⚠ D18 IS PRESENTATION, NOT AN ACCESS CONTROL — Architecture Rule 1

**Read this before citing D18 in any security context.** Rule 1: *never rely on UI hiding.* Excluding
prints from a list is a **product** decision about what the panel means. It is **not** a boundary, and
it does **not** answer the disclosure question that listing them would have raised.

⭐ **The trap, stated plainly:** the reason inline listing was the riskiest option is that panel
visibility would be governed by the **kernel arm + the D15 ceiling** rather than by
`can_view_printed_document` — and prints of form responses can carry PHI
(`printed_documents.contains_phi`). **Filtering the list does not change which door governs the
bytes.** If a print is reachable by someone who should not reach it, D18 hides the row and leaves the
hole. So: **the byte door remains the whole answer** (D12's conjunction), and D18 must never be
recorded as having narrowed anyone's access.

### ⚠ AMENDMENT (2026-08-14, after implementation): the DETAIL half of D18 guards nothing reachable

At S3 I extended D18 from the panel to the **document-detail projection** as well ("prints are not content
documents, in one place"). Verified after the fact, and the extension **landed on an unreachable
function** — the [[correct-door-that-nothing-can-reach]] shape:

- `src/lib/queries/documents.ts` exports `getDocument` (the Wave-A core projection). The D18 filter went
  there. **It has ZERO importers anywhere under `src/`** — confirmed by grep, by `tester`, then by the
  lead independently.
- Every `/manage/documentos/[documentId]{,/editar,/nova-versao,/revisar}` route and
  `/o/[org]/documentos-pendentes/[documentId]` imports a **same-named** `getDocument` from
  `src/lib/queries/controlled-documents.ts`. **Two exports, one name, and the reachable one is the other
  one.**
- ✅ **No behavioural gap.** The reachable `getDocument` selects `from('controlled_documents')`, and a
  print has no `controlled_documents` row (its `documents` row is `kind='printed_rendition'`, homed on the
  meeting/`form_response` securable). **Prints are excluded there STRUCTURALLY, by the schema, not by
  D18.**

**So the record must say that, and not the flattering version.** The detail projection is closed because
a print is not a controlled document — a property of the data model that no future edit to a filter can
undo, and which would survive someone deleting the `.is(…)` line. Citing D18 for it would be citing a
filter in dead code, and would go stale the day a *reachable* detail route is mounted on the core
projection.

⚠ Two consequences worth carrying forward: **(1)** the D18 **list** half *is* reachable
(`listDocumentsForResource`, exercised by the panel) and is the only half with real work to do; it now has
E2E coverage with a twin proving a print would otherwise be listed. **(2)** a whole exported
`getDocument` with no callers is a trap for the next reader — tracked as **FUP-DM5-DEAD-CORE-PROJECTION**.
Same-name-different-module is how this hid: a grep for `getDocument` looks answered.

### The exclusion must be incapable of leaking a print — and `kind` is not trustworthy enough alone

⚠ **`documents.kind` has NO CHECK constraint** (0 constraints — that is exactly why the plan calls it
"available as a discriminator without a migration"). An unconstrained text column is a weak basis for an
exclusion, and the two directions fail oppositely:

- `where kind <> 'printed'` — a print with a NULL or misspelled `kind` **appears** in the panel. **Fails
  OPEN.** Unacceptable for the deciding case.
- `where kind in (<content kinds>)` — a content document with an unexpected `kind` **disappears**.
  Fails closed, but that is an availability regression on ordinary documents.

⭐ **Preferred, and this is the point:** discriminate on a **relational fact, not a string** — a print
is *"a `documents` row referenced by `printed_documents`"*. A foreign key cannot be typo'd, cannot be
NULL-by-accident, and cannot drift the way free text does. **Resolve the VALUE, not the noun.** Backend
owns the mechanism; the binding requirements are (1) it cannot leak a print, (2) it does not hide
ordinary content documents, and (3) the exclusion carries a keystone with a twin that proves a print
would otherwise be listed — a filter nobody has ever seen fail is not a filter.

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

## S2.8's three DM2 conditions — ALL DISCHARGED (verified 2026-08-14, by behaviour not by name)

Checked because D5 was withdrawn on the claim that S2.8 was complete, and a withdrawal resting on
an unverified completion would be the same error twice.

1. **Last-copy invariant as a differential pair — DISCHARGED, and exceeded.**
   `supabase/tests/329_dm2_document_commands.sql:539-577`: R6 `lives_ok` (old copy retires while a
   live same-sha sibling survives) vs R7 `throws_ok … HC0DR` (sibling disposed ⇒ last copy
   protected) — same door, one variable. ⭐ It went *past* the condition: QA r1 found R6/R7/R8 **all
   stay green** under a relaxation of `live` from `disposal_state = 'none'` to `<> 'disposed'`,
   which kills the invariant for two simultaneously-pending duplicates. **R10a/R10s pin that exact
   spelling**, falsifiability recorded. Live body re-read from `pg_get_functiondef` still spells it
   `f2.disposal_state = 'none'`.
2. **Narrowed to the reclassify path OR a non-duplicated-file pin — DISCHARGED via the second
   branch, deliberately.** ADR 0118 §10: *"the guardrail is the EVIDENCE, never caller provenance —
   a provenance marker would be a claim, strictly weaker than the sha verification."* Pinned at
   `329:579-604` R8. The "wider than its use case and symmetric" flag closes on three sides: R8 (no
   sibling ⇒ refused), R7 (last copy ⇒ refused), R10 (both pending ⇒ both refused — the case
   symmetry would actually break).
3. **Landed as an ADR decision — DISCHARGED.** ADR 0118 numbered decision **10**
   (`0118-dm2-s2-command-layer-decisions.md:73-123`), under `## Decisions`, not a state-only note.

**Nothing from S2.8 becomes a DM5 item.**

## Open / deferred

- **FUP-DM5-DVF-FILEOBJ (new, latent, low severity):** `document_version_files` has **no unique on
  `file_object_id`** — only the PK and the version/rendition unique. So one `file_object` could be
  bound to versions of **two different documents**, and `complete_document_disposal` derives its
  document with `limit 1` from the bindings, running the duplicate-evidence probe against an
  arbitrary one. **Not reachable today** — both existing writers insert exactly one binding for a
  freshly *reserved* file. ⚠ **D11/D12 add a third writer**, so this stops being latent the moment
  a print path binds an existing `file_object`. Keep it in view in S3; do not let the print path
  bind a pre-existing file object without ruling this first.

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
  expiry condition) stay with the PO. **S5** names the operational owner and mechanism; it does not
  invent the values. ⚠ **Corrected 2026-08-17: this line said "S4".** S4 has now closed (all five
  gate steps) **without** naming either, and the plan has always scoped operational closure to
  **S5** — so the assignment here was pointing at a slice that was never going to do it. *A
  deliverable assigned to the wrong slice disappears when that slice closes cleanly.*

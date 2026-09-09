# Backend State — the document model

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below. Replace this block in
place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the
generated registries; the live catalog is the authority (ADR 0078).

### Surface

- **`securable_resources`** — the registry every document homes on (anchor `UNIQUE(id, resource_type)`,
  a tenant-shape CHECK); `cases`/`meetings`/`case_interviews`/`action_items`/`case_referral` mint by
  trigger, `rca`/`capa_action` are admitted types, and **`form_response` is minted lazily inside
  `mint_printed_document`, deliberately with no trigger.**
- **Core tables** — `documents` (+ the `access_policy_id` seam, referenced by nothing) ·
  `document_versions` (immutable) · `document_version_files` · `file_objects` · `document_placements`
  (**non-authorizing, ever**) · `upload_sessions` · `document_retention` · `document_legal_holds`.
- **Buckets** — `documents-standard` + `documents-phi` are the core tiered pair, `form-assets` and
  `meeting-audio` out of scope; every other historical bucket name is a **dead noun**, row and doors.
- **Kernels and byte doors** — `app.can_read_document` / `app.can_write_document` dispatch on the home
  `resource_type`, with a **print arm ahead of the home dispatch and below `app.is_active`**;
  `open_document_version` is the byte boundary, `app.resolve_document_version_bytes` the shared resolver
  it and `open_printed_document` delegate to, `open_referral_snapshot_document` the referral door.
  Signatures/`prosecdef`/grants: [rpc](generated-rpc-surface.md) · [helpers](generated-helper-surface.md).
- **Upload corridor** — `begin_document_upload` → client PUT → `finalize_document_upload` →
  `complete_document_upload_verification`, plus the evidence and controlled-document finalizers;
  **caller-supplied storage paths are gone**. Satellites: `printed_documents` (a print carries its
  **own** `documents` row, on the **source's** securable) · `rca_evidence`/`capa_action_evidence` ·
  controlled-document versions · `referral_shared_item.frozen_document_version_id`.

### Invariants

- **RLS is NOT the boundary for document bytes.** Both document buckets carry INSERT policies only — no
  SELECT policy for any tier or principal — so every protected byte flows through the single audited
  `open_document_version` DEFINER door, which authorizes first and then signs short-TTL service-role;
  "no read policy" means *the door is the boundary*, not "unreadable". ⛔ The absent SELECT **and**
  DELETE pair is the whole lock — `storage.objects` grants `arwdDxtm` to `authenticated` **and `anon`**,
  and role-agnostic `storage.protect_delete()` guards direct SQL DML only — so a new read policy must
  arrive with no DELETE policy beside it. Bucket choice is CHECK-pinned server-side: tier **is** bucket.
- **The securable indirection authorizes, and it is enumerated by hand** — a new home type means EVERY
  dispatch on `resource_type`, in **both** kernels. ⚠ **`documents.kind` is nullable, unconstrained text
  — decorative; nothing may branch on it**: the print exclusion keys off the `printed_documents` FK.
- **`document_version_files` is structurally 1:1 with its bytes** — disposal acts on `file_objects`, so
  two version files sharing one object would let marking one `disposal_pending` destroy the other's
  bytes; reversing this needs a reference count in the disposal path first.
- **`disposal_state` means INTENT, not destruction** — nothing user-, regulator- or export-facing may
  call it destruction, and `disposed` alone means "the metadata row is absent" (read
  `file_objects.disposal_evidence`, never the state). ⛔ **Diff every reader of that column before
  writing a new value**: `app.resolve_document_version_bytes` refuses on *any* non-`none` value, which
  is what made a superseded print unservable.
- **Evidence verification is a server attestation, never a client claim** — the evidence finalizer
  delegates the byte check to the document verifier and mints the row in the **same transaction**;
  ⛔ never grant it to `authenticated`, since `p_sha256`/`p_verified` would let a JWT holder self-verify.
- **PHI posture: the tier is a bucket, and homing decides the ceiling** — an ethics letter homes on the
  `case` securable resource, **NEVER `controlled_document`**, or `HC0D6` refuses its enforcing label.
- **A response with a live print cannot be deleted** — a BEFORE-DELETE trigger (an RLS narrowing would
  refuse silently, as a zero-row delete read as success) and `SECURITY DEFINER` (an invoker read would
  fail open). ⚠ Its NAME is narrower than its predicate; the mint takes `for key share` against the discard.

### Rollout

- Flags `documents_foundation` · `documents_wave_a`–`documents_wave_d` · `document_printing`, beside the
  legacy `attachments` key and `controlled_docs`. ⛔ Resolve each flag's VALUE and readers from
  [`generated-feature-flags.md`](generated-feature-flags.md); local `seed.sql` turns them ON and `db push`
  never applies the seed, so "ships OFF" is not containment.
- ⚠ **Flags are an APP-LAYER gate, not a security boundary** — ZERO RLS policies consult one; the check
  is concentrated in `assert_*` functions the byte doors call at their top, **arm-scoped** inside
  `begin_document_upload` (gate the first residue-producing step, per corridor), deliberately absent from
  `finalize_document_upload`, and present on `open_referral_snapshot_document` via a referrals assert.
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the
  remote is a claim about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- **The disposal path is inflow without outflow, and unrehearsed.** Doors write the pending state;
  `complete_document_disposal` is the outflow door, unreachable from a session and called by nothing, and
  no scheduler exists — no `pg_cron`, no `cron` schema, no supervisor. `file_objects` holds no rows, so
  that census is **structural**, from bodies and ACLs, never data; ⚠ the pin asserting "no scheduler
  exists at all" turns FALSE the day one lands.
- **`add_referral_shared_item` checks referral-source authority but never `can_read_case` /
  `can_read_document`**, so a **recused** coordinator reaches PHI bytes. Deferred, deadline = flag-on.
- **The `jsonb`-returning command doors sit outside every BLINDNESS-DETECTING authz arm's domain** — the
  open, referral-snapshot and evidence-finalizer doors, plus `attach_controlled_document_version_file`.
  `ARM=floor` contains them but asks only whether a door is **called**, never whether anything **notices
  when it is opened**; ⛔ a green sweep does not cover them. The bucket pin is likewise name-keyed, and
  the dead set is not enumerable from the catalog. Rest: [follow-ups-open.md](../followups/follow-ups-open.md).

### Where the detail lives

- The frozen slices below, in order: § END STATE · § DM follow-up triage · § DM5 follow-up batch ·
  § DM5·S5 · § DM5·S4 · § DM5·S3 · § DM5·S2 · § DM4 · § DM3 · § DM2 · § DM1 · § DOC-REDESIGN · § F2.
- ⚠ **§ END STATE was this file's previous "what is true now" layer; that role is now THIS block's, and
  § END STATE stays frozen where it is.** Where it and a later slice disagree the **later slice wins**:
  § DM5·S3 on the S3 migration range and on the `responses` securable trigger it asserts (none exists;
  ADR 0120 D17.2 refuses one) · § DM5·S4 on "`begin_document_upload` is the only thing that names a bucket"
  (false in both halves) and the retired "4 / 6 / 4 / 13 callers" figure · § DM5·S2 / § DM5·S3 on the
  securable type count and the `capa_action` tenant-shape arm (org+hospital floor only).
- ADR [0114](../decisions/0114-document-model-redesign.md) (the model) ·
  [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) (retirement, prints) ·
  [0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) (disposal lifecycle).

## END STATE — the document surface as it IS

> ## ⭐ DM — END STATE (the document model), measured 2026-08-17 at DM5·S6
>
> _(This block replaces the currency stamp that read **"STALE BY THREE SLICES (S2, S3 and S4)…
> registry was 391 then; it is 407 now."** Partly overtaken — the DM5 batch and S4 sections landed
> below it — and its registry figure had itself gone stale, which is the failure the stamp existed
> to warn about, one level up. Every figure here carries the query that produces it.)_
>
> **Read this instead of reconstructing the surface from five chronological slice sections.**
> The per-slice DM1–DM5 sections below remain the detail; this is what the surface **is**.
>
> | fact | measured | query |
> | --- | --- | --- |
> | migration registry | **460 == 460** (DB == files on disk), re-measured **2026-08-25** (PDF·P3); **433 == 433** on 2026-08-21; **426 == 426** on 2026-08-20; **411 == 411** at DM5·S6 on 2026-08-17 | `select count(*) from supabase_migrations.schema_migrations;` vs `ls supabase/migrations/*.sql \| wc -l` |
> | document-model tables | **13**, and **all 13 carry exactly ONE policy** | `pg_class` ⋈ `pg_policy`, `relname ~ '^(document\|file_object\|securable\|upload_session\|controlled_document\|printed_document)'` |
> | document-surface doors | **38**, of which **5 are service-role-only** (`complete_document_disposal` · `complete_document_reclassification` · `complete_document_upload_verification` · `complete_evidence_upload_verification` · `lookup_printed_document`) | `pg_proc` ⋈ `pg_namespace`, `proname ~ '(document\|printed\|disposal\|dispose\|evidence_upload\|file_object\|placement\|legal_hold\|retention)'` + `has_function_privilege('authenticated', …)` |
> | storage buckets | **4**: `documents-standard` · `documents-phi` (core) + `form-assets` · `meeting-audio` (out of scope, D13) | `select id from storage.buckets;` |
> | `storage.objects` policies | **4** — **3 INSERT** (`documents_phi_obj_insert_reserved`, `documents_std_obj_insert_reserved`, `form_assets_insert_staff_admin`) **+ 1 SELECT** (`form_assets_select_member`) | `pg_policy` on `storage.objects`, read `polcmd` — ⚠ `'a'`=INSERT, `'r'`=SELECT |
> | RLS on `public` tables | **169 / 169** — re-measured 2026-08-25 (PDF·P3). ⛔ Read **165 / 165** until then, stale by measurement rather than by date: nothing in the file could contradict it. | see ARCHITECTURE.md Rule 1 |
>
> ⚠ **The registry is 411, not the 412 the follow-up-batch gate recorded.** That is not drift: the
> D11 disposal-inflow migration `20260928000300` was **reverted** (`5b40d62b`), so the file is gone.
> A reader comparing the two numbers should stop here rather than suspect the stack.
>
> ⛔ **The one thing to carry away, because a policy-shaped audit gets it exactly backwards:**
> **RLS is NOT the boundary for document bytes.** The two **document** buckets carry **INSERT
> policies only, no SELECT policy for any tier** — a bound that must be stated per-bucket, because
> the one SELECT policy on `storage.objects` (`form_assets_select_member`) belongs to `form-assets`,
> which is **out of the document model's scope** (D13). Every protected document byte flows through the single audited
> `open_document_version` DEFINER door, which authorizes first and then signs short-TTL with the
> service-role client. "No read policy" here means *the door is the boundary*, *not* "unreadable".
> Written into the canon at S6 as ARCHITECTURE.md Rule 1's **fourth** pattern (ADR 0114 D8).
>
> ⚠ **Flags are an APP-LAYER gate, not a security boundary.** Re-derived 2026-08-17 at the DM5
> **phase** QA (R1) — **local 75 functions / 6 read a flag; remote 74 / 6** — and **ZERO** RLS
> policies consult one. Both halves now carry their query, because the half that did not was wrong
> for three writers running:
>
> ```sql
> -- the function half (this is the figure that kept going wrong)
> select count(*) as total,
>        count(*) filter (where pg_get_functiondef(p.oid) ~ 'feature_enabled') as read_a_flag
> from pg_proc p join pg_namespace n on n.oid = p.pronamespace
> where n.nspname in ('app','public') and p.prokind = 'f'
>   and p.proname ~ '(document|printed|disposal|dispose|evidence_upload|file_object|placement|legal_hold|retention)';
> -- the policy half
> select count(*) from pg_policies
>  where coalesce(qual,'')||coalesce(with_check,'') ~ 'feature_enabled';   -- 0
> ```
>
> The six are `app.assert_document{s,_printing}_enabled` + `assert_documents_wave_{b,c,d}_enabled` +
> `app.compute_due_document_review_notifications`. ⭐ **Five of the six are the `assert_*` gates the
> byte doors call at their top** (verified: `begin_document_upload`, `open_document_version`,
> `open_printed_document` all call one). ⚠ **`open_referral_snapshot_document` IS flag-gated too** —
> by `app.assert_referrals_enabled()` (→ `feature_enabled('case_referrals')`), a **referrals-family**
> assert, which is exactly why it falls outside the document-name regex above and outside the six.
> ⛔ **This sentence read *"`open_referral_snapshot_document` does not"* until the phase QA r2 (M5) —
> false as written.** The measurement behind it was real but **bounded to the DOCUMENT-family
> asserts**, and the bound was dropped when the result was written down, turning "does not call a
> *document* assert" into "has no flag gate". → [[a-predicate-quoted-at-the-wrong-grain]] — *a real
> filter cited for a conclusion it does not bound reads exactly like a proof*, and it happened here
> **inside the fix for a defect of the same family**. So the flag check is **concentrated in assert
> functions**, not scattered — which supports the app-layer conclusion **more strongly** than the
> figure that used to sit here.
>
> ⛔⛔ **FOUR writers described this control wrong, and the fourth was the FIX for the third.**
> It began as **"51 of 52 … read a flag"** — inverted — and propagated into three records at once.
> The S6 QA (F1) caught the **inversion** and corrected the *direction* to *"51 do NOT read a flag,
> exactly one does"* — **but never re-derived the FIGURE**, which reproduces on neither catalog under
> any bound. ⭐ **The lesson worth more than the number: correcting a claim's DIRECTION is not
> verifying its MAGNITUDE.** A half-fixed figure is more dangerous than the original, because it now
> carries a correction note that reads as evidence someone checked it.
> → [[a-control-described-wrong-by-three-writers-running]], [[your-own-measurement-goes-stale-like-any-other]].
> Source of the original claim: **FUP-DM5-REMOTE-STATE-MEASURED** (resolved; body in
> `docs/followups/follow-ups-archive.md`).
>
> Local `seed.sql` turns all six DM flags ON; `db push` never applies the seed, so the remote
> measured all-OFF. Do not cite "ships OFF" as containment.
>
> ⬛ **DISCHARGED 2026-08-18 (`FUP-DM5-BACKEND-STATE-SLICE-SECTIONS`).** This paragraph read *"Still
> not written up as their own sections: DM5·S2 and DM5·S3 surface detail, and S5."* All three now
> exist as `##` sections in the chronological body below, between the **DM5 follow-up batch** and
> **DM4** sections, every figure re-derived from the LIVE catalog with its query inline. Their
> narrative records remain [dm5-wave-d-retirement.md](.././progress/dm5-wave-d-retirement.md) and
> [dm5-s5-operational-closure.md](.././progress/dm5-s5-operational-closure.md); the sections are the
> **surface delta**, the records are the story. ✅ **S4 followed on a second PO ruling the same day**
> — `## DM5·S4` sits between the S5 and S3 sections — so **all four DM5 slices now have one**, and
> the asymmetry this paragraph used to name is discharged. *An omission that is not listed is the
> one shape a reader cannot detect* — which is why naming it got it closed in one round.
>
> ⛔ **Writing the four sections found THREE claims in the `###` stamps below that the catalog
> contradicts** — the S3 migration range (**7**, not 6); *"a trigger on `responses` mints/drops its
> securable"* (**there is none, and D17.2 refuses one**); and S4's *"`begin_document_upload` is the
> only thing that names a bucket"* (**three functions, two CHECK constraints and a client-side
> constant do**, and one of them predates the stamp) — plus **four** figures that were right only
> under an unstated bound and **one that does not reproduce at all** (S4's "4 / 6 / 4 / 13 other
> callers", retired). Each is corrected in place below and derived in its section. ⭐ *The stamps
> warning that the text below them is stale had themselves gone stale.*
>
> ### DM5·S4 — the eight legacy storage buckets are RETIRED (`…000400`, 1 migration)
>
> ⚠ **Every bucket name below this stamp other than the four survivors is now a DEAD NOUN.** Retired
> rows *and* doors: `attachments` · `attachments-phi` · `case-documents` · `interview-attachments` ·
> `nsp-evidence` · `referral-attachments` · `controlled-documents` · `printed-documents`.
> **Surviving: `documents-standard` · `documents-phi` (core, ADR 0114 D8) and `form-assets` ·
> `meeting-audio` (out of scope, D13).** Catalog-verified after a fresh reset: 4 bucket rows, and
> `storage.objects` carries exactly **4** policies (`documents_{std,phi}_obj_insert_reserved`,
> `form_assets_{insert_staff_admin,select_member}`).
>
> - **`nsp-evidence` was the LAST retirement bucket still carrying policies** — 4 of them
>   (`nsp_evidence_obj_{select_member,insert_writable}`, `capa_evidence_obj_{select_member,insert_writable}`),
>   dropped here. The other seven were retired door-first by DM1/DM3/DM4/S3. The four predicates those
>   policies called (`app.can_write_capa` / `can_read_capa` / `can_write_rca` / `can_read_event`) are
>   **NOT dropped** — unlike DM3's `app.can_read_document_object`, whose only caller was its policy, these
>   have 4 / 6 / 4 / 13 other callers. *Dropping the door is not dropping the lock.*
>   ⛔ **FIGURE RETIRED 2026-08-18: "4 / 6 / 4 / 13" does not reproduce under any bound.** Measured
>   comment-stripped across all non-system schemas: **function** callers `5/5/5/12`, **policy** callers
>   `8/7/8/11`, combined `13/12/13/23`; the stamp never said which it counted. Two drifts are explained
>   by a later door, two go the wrong way. ⭐ **The conclusion survives untouched — every count is ≥5**
>   — and `can_read_document_object` really is gone (`pg_proc` → 0 rows). *Correcting a magnitude is
>   not correcting a direction; here only the magnitude was wrong.* Derivation: the `## DM5·S4` section.
> - ⚠ **Retirement is a MIGRATION, not an operational script, and that is load-bearing:** six historical
>   migrations (baseline · controlled_docs_core · attachments_storage · audio_minutes_schema ·
>   printed_documents_storage · dm1_document_buckets) recreate all twelve bucket rows on **every**
>   `db reset`. Retirement living only in a script would be silently undone by the next reset.
> - ⭐ **What actually enforces Rule 6 on the surviving buckets — settled at QA r3 after being written
>   WRONG twice.** On the **Storage-API path** the operative lock is the **pair of ABSENT policies,
>   SELECT *and* DELETE**, and both are ours. `storage.protect_delete()` is **role-agnostic** (it tests
>   only `storage.allow_delete_query`) and **the API sets that GUC itself**, so the trigger never fires
>   on an HTTP delete — it guards **direct SQL DML only**, which is the context `…000400` needs it for.
>   Measured: opening both policies on `documents-standard` made an ordinary authenticated HTTP DELETE
>   return `200 Successfully deleted`. ⚠ `storage.objects` grants `arwdDxtm` to `authenticated` **and
>   `anon`**, so there is **no grant-level fallback**: every storage protection here is exactly **one
>   permissive policy wide**. Anyone adding a read policy to `documents-standard`/`-phi` must add no
>   DELETE policy with it. Pins: `143` (update/delete half) + `312` t51d/t53pre (the SELECT half).
>   Domain: LOCAL stack, both paths; **Cloud unverified**. Full record: `docs/reviews/dm5-s4-review-r2.md` §4.
> - **The migration REFUSES to retire a bucket that still holds `storage.objects` rows**, naming the
>   bucket and the count. That is ADR 0120 D9's byte-first ordering encoded executably rather than as
>   prose in a header — the failure mode FUP-F2-BUCKETS was filed for.
> - ⛔ **It deletes ZERO BYTES, by design.** Byte removal is D9's manifest-first Storage-API path.
>   See the S4 entry in [dm5-wave-d-retirement.md](.././progress/dm5-wave-d-retirement.md) for what that
>   did and did not achieve locally.
> - **Dead TS surface removed:** `ATTACHMENTS_BUCKET` / `ATTACHMENTS_PHI_BUCKET` / `bucketForTier()` in
>   `src/lib/attachments/constants.ts` (verified zero callers — ✅ re-verified 2026-08-18: only a
>   `⛔ RETIRED` tombstone comment survives at `:65-75`, no live identifier). **No client-side constant names a bucket
>   any more** — `begin_document_upload` is the only thing that does, and `file_objects_bucket_from_tier`
>   CHECK-pins the tier→bucket mapping server-side.
>   ⛔ **CORRECTED 2026-08-18 — that sentence is false in BOTH halves.** Catalog: **three** functions
>   name a document-bucket literal (`begin_document_upload`, **`app.printed_rendition_storage_bucket`**
>   — which landed at **S3, before this stamp was written** — and `reclassify_document`), plus 2 CHECK
>   constraints and 1 policy per bucket. Client: `MEETING_AUDIO_BUCKET = 'meeting-audio'` **is** a
>   client-side constant naming a bucket, and `printedRenditionStorageBucket()` returns both document
>   bucket names as its type. ⭐ **The invariant that does hold, property-bounded:** every
>   `.storage.from(…)` in `src/` takes a **server-derived variable** or names `form-assets` /
>   `meeting-audio` (both D13 out-of-scope) — **zero retired-bucket literals, zero document-bucket
>   literals at a `.from()` site**. `docs/reviews/dm5-s4-review.md:334` says exactly that; **the stamp
>   is a compression of a correctly-bounded review sentence into a false absolute.** Derivation +
>   the syntax-bound trap it hides: the `## DM5·S4` section.
>
> ### DM5·S3 — printed renditions moved onto the core substrate (`…000300`–`…000360`, **7** migrations)
>
> ⛔ **CORRECTED 2026-08-18: this header said "`…000350`, 6 migrations".** The registry carries
> **seven** in the interval — `…000360 dm5_s3_r1_mint_unique_violation_discrimination`, the QA-r1
> fix, is an S3 migration. *A range written at authoring time does not know about the migration the
> review adds.* Full derivation: the `## DM5·S3` section in the body below.
>
> ⚠ **Every `printed_documents` line below this stamp is wrong.** The table is now a **satellite**, not a
> self-contained registry:
>
> - **`printed_documents` gained `document_id` + `document_version_id`** (both **NOT NULL UNIQUE**, plus a
>   **composite FK** `(document_version_id, document_id) → document_versions(id, document_id)` so the two
>   can never disagree). **`storage_path` is DROPPED and the `pd_storage_path_derived` CHECK is GONE.**
>   Column-list grants: **17 of 20** columns to `authenticated`; **withheld = `verification_token`,
>   `revoked_reason`, `revoked_by`**. ⚠ `id` and `contains_phi` **are** granted, so the coordinate remains
>   **derivable** — it always was, via that CHECK. What protects the bytes is that `storage.objects` has
>   **no SELECT policy** for either document bucket (pgTAP `312` t51d asserts this).
> - **A print gets its OWN `documents` row** (ADR 0120 D13), `kind = 'printed_rendition'`,
>   `confidentiality_level = NULL`, homed on the **source's** securable resource. ⚠ `documents.kind` is
>   **nullable, unconstrained `text`** — **decorative; nothing may branch on it.** The D18 exclusion keys
>   off the **`printed_documents` FK**, never `kind`.
> - **`securable_resources_type_check` admits 9 types** (`form_response` added). `tenant_shape` still
>   carries **TWO** shapes — `responses.commission_id` is NOT NULL, so `form_response` joins the existing
>   full-tenancy arm. ⛔ **CORRECTED 2026-08-18: this bullet ended *"A trigger on `responses`
>   mints/drops its securable."* — THERE IS NO SUCH TRIGGER.** `responses` carries 5 user triggers,
>   none touching `securable_resources`; the row is minted **lazily inside `mint_printed_document`**
>   (`on conflict (id) do nothing`, targeted, + a `resource_type` re-assert). ADR 0120 **D17.2**
>   rejects the trigger explicitly — no backfill, and `responses` is the highest-cardinality table in
>   the product. *The claim did not merely go stale; it asserts the mechanism the design wrote a
>   paragraph to refuse.* Derivation: the `## DM5·S3` section in the body below.
> - ⭐ **`app.can_read_document` AND `app.can_write_document` each gained a PRINT ARM**, dispatched on the
>   `printed_documents` reference **before** the home-type dispatch and **below `app.is_active`**. Read
>   delegates to `app.can_view_printed_document`; write mirrors `revoke_printed_document`'s authority. This
>   exists because D13's own-`documents`-row would otherwise route a **meeting** print's metadata through
>   the wider `is_member_of_for` arm — a widening D18 cannot fix, since PostgREST ignores our projections.
> - ⭐ **NEW: `app.resolve_document_version_bytes(uuid, text, uuid)`** — the shared byte resolver
>   (DEFINER, STABLE, pinned `search_path`, **EXECUTE to `postgres` ONLY**). **Both**
>   `open_document_version` (`'source'`) and `open_printed_document` (`'printed_pdf'`) delegate to it
>   (ADR 0120 **D12**), and it is **authorization-complete on its own**.
> - **`open_printed_document`'s return shape changed** → `(storage_bucket, storage_path, status,
>   contains_phi)`, and it now has **three** refusal outcomes: 0 rows (print-check denial) **or** a raised
>   `42501`/`P0002`/`HC0DD`/`HC0D8` from the resolver. The route maps every one to the same pt-BR 404.
> - **`mint_printed_document` rebuilt onto the substrate, atomically** — same signature, **no path
>   parameter**: it derives `printed/<id>.pdf` in `documents-standard`/`documents-phi` from
>   `contains_phi` and refuses `HC0D3` unless the object is already there. The **tier is the BUCKET now**
>   (CHECK-pinned by `file_objects_bucket_from_tier`), not a `phi/`|`std/` prefix.
> - **FIVE write guards** (not four): a `document_versions` BEFORE-INSERT trigger (**`HC0DK`**),
>   `soft_delete_document` (**`HC0DL`**), `request_document_disposition` (**`HC0DN`**),
>   `begin_document_upload` refusing `form_response` (`P0002`), + `trg_guard_printed_document_binding`
>   pinning the coordinate to its derivation (the replacement for the retired CHECK).
> - 🔒 **BUG-DM5-S3-INACTIVE-PRINT-1 fixed here.** A **deactivated** user previously kept print-download
>   authority: `can_read_document` guards `is_active` above its dispatch, `can_view_printed_document` does
>   not, and its `form_response` arm's first disjunct is the bare `v_resp.created_by = p_uid` **behind an
>   `or`** — so no callee could supply the check. D12's conjunction closes it, which is why "strict
>   narrowing" is load-bearing rather than decorative.
> - Prints no longer write to **`printed-documents`**; ✅ **that bucket's row and doors were RETIRED by
>   S4** (`…000400`) — see the DM5·S4 block above. ⛔ **CORRECTED 2026-08-17:** this line said "its 87
>   remaining volume files are pre-existing orphans". They are **gone** — all 221 retirement-bucket
>   files were destroyed by a `supabase stop`/`start` stack recovery at `01:06:02Z`, **outside the D9
>   gate, with no manifest and no audit** (FUP-DM5-STACK-CYCLE-DESTROYS-BYTES). `walk` now reports
>   *"(no directory on the volume)"* for all eight. FUP-DM5-STORAGE-ORPHANS stays open on its **Cloud**
>   half.
>
> ### DM5·S2 — NSP RCA/CAPA evidence (`…000100`–`000170`, 8 migrations)
>
> - `securable_resources_type_check` admits **8** types, not 6 — `rca` and `capa_action` were added, and
>   `securable_resources_tenant_shape` carries a **second shape** for `capa_action` (org + hospital,
>   **NULL commission** — ADR 0120 D14). ⚠ **Two bounds added 2026-08-18, both derived:** the type
>   count is **9 today** (S3 added `form_response`) — read this line as an S2 *delta*, never as
>   current state; and the second shape does **not** constrain `commission_id` at all (the column is
>   nullable, the CHECK requires only org+hospital NOT NULL), so **NULL-commission is the INTENT, not
>   the constraint.** Derivation: the `## DM5·S2` section in the body below.
> - **`app.can_read_document` AND `app.can_write_document`** both gained `rca` + `capa_action` arms.
>   ⚠ **The write door was missed for a full slice and refused every user with `P0002`**
>   (BUG-DM5-S2-WRITE-ARM-1) — *a new home type means enumerating EVERY dispatch on `resource_type`.*
> - **`p_storage_path` is DEAD** on `begin_document_upload`, `add_rca_evidence` and
>   `add_capa_action_evidence` — caller-supplied paths are gone (the ADR 0114 D8/D9 inversion).
> - `begin_document_upload` + both evidence doors now assert **`app.assert_documents_wave_d_enabled()`**;
>   `finalize_document_upload` deliberately does **not** (the flag gates the first step that produces
>   residue, arm-scoped, ADR 0120 D10).
> - `rca_evidence.cited_document_id` is **un-parked** (pgTAP `328` K8b discharged); `listRcaCitationTargets`
>   offers document targets.
>
> ⚠ **Why this stamp exists, and it is not bookkeeping.** Line ~245's *"Still unbuilt: S2.8 … no legal
> expression"* was written at DM2·S2 close and **never updated when S2.8 landed hours later**. It has now
> misled **twice**: DM3's planner caught it; **DM5's lead did not, and it produced ADR 0120 D3/D4/D5 —
> three decisions on a false premise, withdrawn before any SQL** (the mechanism was already built, under
> another name, and DM2 had rejected the re-proposed shape *by name*). ⭐ *A durable surface map that lags
> its own phase is a trap with a long fuse.* **Resolve the VALUE, not the noun**, and when this file and
> the catalog disagree, **the catalog wins** — always, no exceptions. ⬛ **S6 delivered this
> obligation as the measured DM END STATE block at the head of this file (2026-08-17)** — a
> current-surface summary, **not** the full per-slice rewrite this line used to promise: the
> DM5·S2/S3/S5 sections remained unwritten, named in that block. ✅ **They were written 2026-08-18
> as `FUP-DM5-BACKEND-STATE-SLICE-SECTIONS` (PO-ruled at the DM5 gate-step-4 docket) — three `##`
> sections in the body below, catalog-derived, every figure carrying its query.** Recorded here at S6 QA (finding F6)
> so the promise and the delivery cannot silently diverge; if the per-slice sections are still
> wanted, that is now an explicitly unowned item, not an S6 leftover.
>
> ⬛ **Also owed at S6 — DONE 2026-08-17**, with two corrections to the note itself:
> **(a)** the figure was never at `:205` (it had drifted to `:387`) — *a line-number pointer is a
> claim that goes stale silently, exactly like the figure it points at*; **(b)** "146 vs 141" was
> not an error in either number but a **missing schema bound** — it is **141 in `public`, 145
> across `app`+`public`**. Both now carry the deriving SQL inline. *A count without its query is
> not a measurement.*
>
> 🔤 **RENAMED 2026-08-09 (`20260917000200`): `app.is_commission_admin_of(_for)` →
> `app.is_tenancy_admin_of(_for)`.** The old name is GONE — no shim. It always resolved
> **org_admin / hospital_admin** (the TENANCY tier) and was FALSE for `staff_admin`, the
> actual commission administrator, so the name asserted the opposite of its meaning.
> This doc has been updated throughout; **historical records deliberately have not** —
> ADRs, reviews, plans and progress files still say `is_commission_admin_of`, because
> they record what was decided when it was called that. When reading anything dated
> before 2026-08-09, read the old name as this one. ADR
> [0105](.././decisions/0105-rename-is-tenancy-admin-of.md).
>
> 🔧 **Surface changes 2026-08-12 (REFNOTE, `20260922000100`; 360 registered == 360 files).**
> Read this before touching ANY referral RPC's return value:
>
> - **23 referral doors no longer return a table row type.** `RETURNS case_referral` /
>   `referral_internal_notes` / `referral_messages` became **`case_referral_public`** /
>   **`referral_internal_note_public`** / **`referral_message_public`** — three new named
>   composites whose fields are EXACTLY the columns each table's `authenticated` column-list
>   SELECT GRANT exposes. Doors: the 15 `case_referral` verbs (`send`/`accept`/`decline`/
>   `resolve`/`conclude`/`receive`/`reopen`/`withdraw`/`start_review`/`link_case`/
>   `create_draft`/`update_draft`/`set_deadline`/`request_information`/`provide_information`),
>   the 6 `referral_internal_notes` verbs, and `post_referral_message` / `redact_referral_message`.
> - **Projection goes through `app._project_case_referral` / `_project_referral_internal_note` /
>   `_project_referral_message`** — `jsonb_populate_record` BY NAME, so the composite is an
>   ALLOWLIST: a column absent from it is dropped.
> - ⚠ **A new column on any of the three tables is NOT returned by these doors until it is
>   added to the composite, and it must not be added there without its own column GRANT.**
>   pgTAP `326` t1–t3 pin composite ≡ GRANT as ordered name arrays and red in both directions.
> - ⚠ **A composite cannot carry NOT NULL**, so every field is `T | null` in the generated TS
>   types even where the column is NOT NULL. Coerce at the call site; do not assert.
> - Withheld, and therefore served ONLY by the audited read doors: `case_referral.description_md`
>   + `decline_note` + `phi_disposed_*` (→ `get_referral_detail`), `referral_internal_notes.body_md`
>   (→ `list_referral_internal_notes`), `referral_messages.body`. ADR
>   [0113](.././decisions/0113-referral-door-return-shape.md).
> - **Authz harness:** a FOURTH sweep exists — `p0-authz-invoker-audit.sh` + `ARM=wrapper`
>   (ADR 0079 Amendment 7) — covering `public` **INVOKER** functions, which the other three
>   exclude by construction. ARM 3's census domain widened with it: **452 → 540** live gates.
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

## DM follow-up triage — DVF 1:1 + the draft-print delete guard (2026-08-18; DM-FUP TRIAGE #2/#4/#8b; migrations `20260928000600`–`…000700`, **2**; pgTAP `312` 77→80 · `328` 128→130; **LOCAL ONLY — not pushed**)

⛔ **SUPERSEDED 2026-08-18 — both are ON THE REMOTE.** This paragraph read "LOCAL-ONLY / the remote
sits at `20260928000500`" and was **false when re-measured**: head `20260928000700`, 413 registered.
The duplicate-`file_object_id` precondition was met by the census (remote holds 0 rows). ⭐ *This is
the third time this same "not pushed" claim has gone stale in this document* — the standing rule
below applies: **re-measure `schema_migrations`, never re-read a sentence about it.**

**Registry closure** — `select count(*) from supabase_migrations.schema_migrations` = **413**, and
`ls supabase/migrations/*.sql | wc -l` = **413**. Registered == files.

### `20260928000600` — `document_version_files` is structurally 1:1 with its bytes

`select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid =
'public.document_version_files'::regclass and contype = 'u'` → **2** rows now:
`document_version_files_version_rendition_uniq (document_version_id, rendition_kind)` (pre-existing)
and **`document_version_files_file_object_uniq (file_object_id)`** (new).

**Why it is a constraint and not a pin.** Disposal acts on `file_objects`; before this, two version
files could share one object and marking one `disposal_pending` would have silently destroyed the
other's bytes. 1:1 held only by caller discipline — all three writers
(`complete_document_reclassification`, `complete_document_upload_verification`,
`mint_printed_document`) mint a fresh object in the same call. **Knowingly forecloses rendition
byte-sharing**; reversing it requires a reference count in the disposal path first.

⚠ **Visible at the API layer:** `npm run gen:types` moved exactly one line —
`isOneToOne: false → true` on the `document_version_files → file_objects` relationship. PostgREST now
treats the embed as to-one.

### `20260928000700` — a response with an ACTIVE print cannot be deleted

New function **`app.guard_response_active_print()`** — `select p.prosecdef, p.proacl::text from
pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname =
'guard_response_active_print'` → **`prosecdef = t`**, ACL
**`{postgres=X, authenticated=X, service_role=X}`**, `search_path = app, public, pg_catalog`.

Trigger `guard_response_active_print_trg`, **BEFORE DELETE FOR EACH ROW** on `public.responses`.
`select count(*) from pg_trigger where tgrelid = 'public.responses'::regclass and not tgisinternal`
→ **6** (was 5). Raises **`HC069`** — the next free code in the discard lane (`HC060`–`HC068` were
all taken; verified by `regexp_matches(prosrc, 'HC06[0-9A-Z]')` over `pg_proc`), mapped to pt-BR in
`discardResponse` (`src/lib/responses/actions.ts`).

**Three properties that are load-bearing, not stylistic:**
- ~~**`status = 'active'` only.**~~ ⛔ **SUPERSEDED by `20260928000800` — see below; the predicate is
  now `in ('active','superseded')` and the "only ACTIVE is a live page" half of this reasoning was
  FALSE.** The half that survives: `lookup_printed_document` — the public `/verificar` door — selects
  `from public.printed_documents` and joins only `commissions`/`hospitals`, **never `responses` or
  `securable_resources`**. Public verification therefore SURVIVES an orphan, so a *revoked* print
  must keep its row and bytes so a paper-holder is still told `ANULADO`.
- **A trigger, not an RLS predicate.** Narrowing `responses_delete_own_draft` would refuse **silently**
  as a zero-row delete the caller reads as success.
- **`SECURITY DEFINER`.** `printed_documents` carries a SELECT policy; an invoker read would let a
  print the deleter cannot see make the guard find nothing and **allow** the delete — a fail-open.

⚠⚠ **The ACL lines in that migration exist because a gate caught their absence.** Created with
Postgres' default ACL the function was **PUBLIC-executable while `SECURITY DEFINER`**, and pgTAP
`320` U1 (the `FUP-ACL-APP-POPULATION` census, committed baseline **237 of 454** `app` functions)
went **RED at 238**. `312` was **fully green** throughout — a trigger behaves identically whether or
not PUBLIC may also call it. *A test of what the code does cannot see what the code additionally
permits.* The grants mirror both sibling guards (`public.guard_submitted_response`,
`app.guard_supersession_coherent`).

### `20260928000800` — `superseded` is a live page, and the mint is ordered against the discard

ADR [0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md). Closes
`FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT`. Two catalog changes, no new objects:

1. **`app.guard_response_active_print()` predicate widened** to
   `status in ('active','superseded')`. Verify with
   `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='app'
   and p.proname='guard_response_active_print'` — **never** from the `000700` file text, which is now
   stale. `prosecdef` and the ACL are unchanged (`{postgres, authenticated, service_role}`, restated
   in the migration); trigger count on `public.responses` stays **6**.
   ⚠ **The NAME is deliberately narrower than the behaviour.** It is keyed into pgTAP `312`, the
   `320` U1 ACL census baseline and the authz findings files; a rename orphans every name-keyed
   verdict at once. Read the predicate, not the name.
2. **`public.mint_printed_document` now takes `for key share` on its source read** —
   `from public.responses where id = p_source_id for key share`. Signature, `prosecdef`, ACL and
   return type all unchanged, so `pg_get_function_identity_arguments` and the `printed_document_public`
   projection are untouched. Applied by **in-place rewrite** off `pg_get_functiondef` (the house idiom,
   cf. `20260709000200`) with the target-match asserted on both sides, plus a read-back post-condition.

**Why the lock is where it is:** the guard is `BEFORE DELETE`, and Postgres acquires
`LockTupleExclusive` **before** running a `BEFORE DELETE` row trigger's body. So a mint holding
`KEY SHARE` forces the delete to wait, and the trigger body then re-reads on a fresh snapshot and
sees the committed print. In the reverse order the locked select returns **zero rows** and the mint
aborts on its **pre-existing** `HC0D1` — no new code was needed for that direction.
**Measured** (scratch schema, dropped): unlocked ⇒ orphan created; locked ⇒ no orphan, both orders.

⚠ **`312` t81 pins this STRUCTURALLY, from `pg_proc`, not behaviourally** — pgTAP is single-session
and cannot construct the interleaving. If a future migration rewrites this body from a full paste,
the lock disappears silently and t81 is the only thing that reds.

### App-layer changes in the same batch

- `reclassifyDocument` now passes **`p_byte_proof: 'unavailable_on_platform'`** to
  `complete_document_disposal` (was riding the `'not_attempted'` DEFAULT three lines after a
  successful `storage.remove()`). Pinned statically in `disposal-gap.test.ts`, **proven able to
  fail**.
- **`src/lib/attachments/actions.ts` DELETED** — 6 dead `'use server'` exports, zero importers.
  ⚠ **`src/lib/attachments/constants.ts` is RETAINED and live** — 3 importers
  (`queries/attachments`, `queries/interviews`, and `queries/meetings` transitively).

**Gates at close:** pgTAP **194 files / 6397** PASS (6392 + 2 + 3) · lint 5/5 · typecheck 0 · vitest
**1305** · authz `census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` all **INVARIANT HOLDS**.
⚠ **`e2e:prod` NOT run.**

## DM5 follow-up batch — evidence-finalize atomicity, evidence-table grants, disposal evidence (2026-08-17; ADR **0121** D4; migrations `20260928000100`–`…000500` **minus `…000300`, reverted**; pgTAP `320`/`328`/`329`/`330`/`341`; PO-approved, **gate step 3 (QA) not run**)

> ⛔ **SUPERSEDED 2026-08-18 — the paragraph below was true for less than a day.** The
> `db push` ran on 2026-08-18 (PO-authorized at the DM5 docket): remote head is
> **`20260928000500`** / 411 registered, and the only local-only migrations are
> `…000600` + `…000700` (**HELD**, TRIAGE #11). Measure against
> **§ REMOTE CENSUS 2026-08-18** and § "Remote discipline — standing rules", never
> against this paragraph. Kept verbatim below because this is a dated batch record.

~~**STATE: BUILT + GATED, on `main`, NOT pushed.** Five local-only migrations now sit ahead of
the remote (high-water `20260927000360`): S4's retirement `20260927000400`, the recusal fix
`20260928000100`, and this batch's `…000200` / `…000400` / `…000500`.~~

**New door — `public.complete_evidence_upload_verification(p_upload_session_id uuid,
p_sha256 text, p_verified boolean) returns jsonb`, SECURITY DEFINER, EXECUTE to
`postgres` + `service_role` ONLY.**
- It **delegates** to `public.complete_document_upload_verification` rather than re-deriving
  the byte check — one verifier, no drift — and additionally mints the NSP evidence row **in
  the same transaction**. Reachable from inside because it is DEFINER-owned by `postgres`;
  `authenticated` still reaches neither (pgTAP `341` J7 pins BOTH).
- ⛔ **Do NOT grant this to `authenticated`.** It takes `p_sha256`/`p_verified` — an
  *attestation by the server that downloaded the bytes*. Exposed to a JWT holder it would let
  a client mark its own upload verified under a fabricated hash, defeating D9 on a
  PHI-adjacent corridor.
- The acting user is read from `upload_sessions.reserved_by` (written by the user-scoped
  `begin_document_upload`) and passed **explicitly** to `app.can_write_rca(id, uid)` /
  `app.can_write_capa(id, uid)`. **No act-as surface**: it cannot be pointed at a user who did
  not open the session. Impersonation via the claims GUC was rejected — `auth.uid()` is
  `coalesce(request.jwt.claim.sub, request.jwt.claims->>'sub')`, two GUCs behind a coalesce.
- Authority and both flag gates run **BEFORE** the verification, so a refusal costs nothing.
- The `document` arm's validation is **duplicated** from `add_rca_evidence` /
  `add_capa_action_evidence` deliberately — extracting a helper would rewrite two live DEFINER
  doors and orphan their name-keyed audit verdicts. Pinned executably by `341` block J instead.
- ⚠ **It is ABSENT from `docs/reviews/authz-door-audit-findings.md` and `ARM=census` does not
  notice** — the census's DEFINER clause is bounded to `bool` returns and this returns `jsonb`,
  while the door sweep's domain includes exactly this shape. `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`.

**Changed signature — `public.complete_document_disposal(p_file_object_id uuid, p_byte_proof
text default 'not_attempted')`** (was `(uuid)`; ADR 0121 D4, `20260928000400`). Adds
`file_objects.disposal_evidence jsonb`, recording `metadata_absent` / `metadata_source` /
`byte_proof`. Closed vocabulary: `local_volume_verified` · `unavailable_on_platform` ·
`not_attempted`. ⚠ **`disposed` alone still means "the metadata row is absent" — read the
evidence column, never the state.** ⚠ **Any assertion naming the OLD signature RAISES and
ABORTS its pgTAP file** (`329` lost 109 of 116 assertions this way); sweep by signature, not
by file.

**Revoked — `rca_evidence` / `capa_action_evidence`** (`20260928000200`): `authenticated`
holds **SELECT and nothing else**; all writes traverse the RPCs. ⚠ `ALTER DEFAULT PRIVILEGES
FOR supabase_admin IN SCHEMA public` still grants `arwdDxtm` to `authenticated` on every NEW
table, and a re-dumped baseline would restore these — `341` H1–H4 is what catches that. The
RLS policies are KEPT as the second lock for the same reason. `252` restores the grant *inside
its own rolled-back transaction* so its two P0 policies stay mutation-proven rather than going
silently BLIND.

⛔ **REVERTED — the D11 inflow (`20260928000300`).** Marking a superseded print's bytes
`disposal_pending` made the print **unservable**: `app.resolve_document_version_bytes:72`
refuses on `disposal_state <> 'none'` — **any** non-`none` value — so re-issuing a document
stopped its previous PDF opening, colliding with ADR 0120 D6/D8. **Before writing any new
value into `file_objects.disposal_state`, diff every reader of that column.** Open PO decision:
`FUP-DM5-SUPERSEDE-SERVING-COLLISION`.

## DM5·S5 — operational closure: the surface delta is EMPTY, and that is a measured claim (2026-08-17; ADR **0121**; **NO migration**; pgTAP `343`; NO flag)

**Every figure below re-derived 2026-08-18 from the LOCAL catalog** (registry 411 == 411), per the
DM END STATE convention at the head of this file. This is the **per-slice delta**; the aggregate is
that block, and it is not restated here.

⭐ **"S5 changed no runtime surface" is itself a figure, so it carries a query.** No version was
registered between S4's retirement and the follow-up batch — the interval is empty, not merely
un-named:

```sql
select count(*) from supabase_migrations.schema_migrations
 where version > '20260927000400' and version < '20260928000100';   -- 0
```

⚠ **Bound the claim by the REGISTRY interval, not by a filename pattern.** "No file matches `*s5*`"
would have been a syntax bound and would have missed a migration named anything else; the interval
is the property.

**The disposal census — inflow / outflow, and this is where the item's own numbers need a bound.**

```sql
-- INFLOW: functions that WRITE the pending state (SET-form, not merely mention it)
select n.nspname||'.'||p.proname, coalesce(array_to_string(p.proacl,' ; '),'(default: PUBLIC)')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prokind='f' and n.nspname in ('app','public')
  and pg_get_functiondef(p.oid) ~ 'set\s+disposal_state\s*=\s*''disposal_pending''';
-- OUTFLOW: same shape, target state 'disposed'
```

- **Inflow = 4, not 3** — `request_document_disposition` · `dispose_case_phi` ·
  `dispose_referral_phi` (all three EXECUTE-granted to `authenticated`) **+
  `complete_document_reclassification`**, whose EXECUTE is `postgres`/`service_role` only.
  ⚠ **`FUP-DM5-DISPOSAL-JOB` says "three inflow doors" — that is correct *bounded to doors a JWT
  holder can reach*, and wrong unbounded.** The reclassification lane retires bytes into the same
  pending state with no user in the loop, so the queue it feeds is wider than the item's figure.
  *A count without its role bound is not a measurement.*
- **Outflow = exactly 1**, and it is unreachable from a session:
  `public.complete_document_disposal(p_file_object_id uuid, p_byte_proof text)`, `prosecdef = t`,
  `proacl = postgres=X/postgres ; service_role=X/postgres` — **no `authenticated` entry, and the
  default PUBLIC EXECUTE is revoked**. ⭐ This is the whole of ADR 0121 D1's violation stated in
  catalog terms: 4 doors write into the queue, 1 door can empty it, and nothing in the deployment
  calls that door.
- **No scheduler exists — measured, not assumed:**
  ```sql
  select (select count(*) from pg_extension where extname like '%cron%') as cron_ext,   -- 0
         (select count(*) from pg_namespace where nspname='cron') as cron_schema;        -- 0
  ```
  Repo half (filesystem, stated as such — **not** a catalog fact): `.github/` is **absent**, and the
  root `Dockerfile`'s only process directive is `CMD ["node", "server.js"]` (line 49) — one process,
  no supervisor, no scheduler. ⛔ **`343_dm5_s5_disposal_gap.sql` (`plan(12)`)
  pins "no scheduler exists at all" — TRUE today and a FALSE PIN the day ADR 0121 D2 lands.**
  Rewrite `343` inside D2's slice, never after it.
- ⚠ **12 functions read `file_objects.disposal_state`** (`pg_get_functiondef(...) ~ 'disposal_state'`
  over `app`+`public`, `prokind='f'`): `app._referral_reply_documents` ·
  `app.guard_file_object_transition` · `app.resolve_document_version_bytes` ·
  `public.add_referral_shared_item` · `complete_document_disposal` ·
  `complete_document_reclassification` · `dispose_case_phi` · `dispose_referral_phi` ·
  `get_referral_detail` · `open_referral_snapshot_document` · `reclassify_document` ·
  `request_document_disposition`. ⭐ **This list IS the executable form of the D11 reverted-inflow
  lesson** ("diff every reader before writing a new value into that column") — the reader that broke
  serving, `app.resolve_document_version_bytes`, is item 3 of it.
- **The path has never been exercised on this stack:** `select count(*) from file_objects` = **0**
  (and `printed_documents` = 0). So the disposal census above is **structural** — derived from
  function bodies and ACLs, not from data. ⚠ The measured form of "UNREHEARSED": the C1 rehearsal
  (`FUP-DM5-DISPOSAL-JOB`, PO-ruled 2026-08-18) is the gate, and no row anywhere contradicts or
  supports the runbook because no row exists.

**What S5 shipped instead of surface**: the disposal-gap pin (`343`), the operational record
[dm5-s5-operational-closure.md](.././progress/dm5-s5-operational-closure.md), and
[docs/deployment/phi-disposal-runbook.md](.././deployment/phi-disposal-runbook.md). ⛔ **`disposal_state`
therefore means INTENT, not destruction** (ADR 0121; inverts ADR 0099 D10) — nothing user-, regulator-
or export-facing may describe it as destruction.

## DM5·S4 — the eight legacy storage buckets are RETIRED (`20260927000400`, **1** migration; ADR 0120 D9; pgTAP `325` `plan(8)` t6/t7/t8)

**Re-derived 2026-08-18 from the LOCAL catalog** (registry 411 == 411), per the DM END STATE
convention. ⚠ **Deployment, as of the 2026-08-18 push:** local and remote are both at
`20260928000500`, so the retirement is **LIVE on the remote** (4 buckets there, 0 `storage.objects`).
Any older "local-only / not pushed" phrasing about S4 is false — do not carry it forward.

**The interval is ONE migration — derived, not assumed:**

```sql
select version, name from supabase_migrations.schema_migrations
 where version between '20260927000400' and '20260927999999';   -- 1 row: dm5_s4_retire_legacy_buckets
```

**The surviving set and every lock on it** (`storage.buckets`, `pg_policy` on `storage.objects` —
⚠ read `polcmd`: `'a'`=INSERT, `'r'`=SELECT):

```sql
select id, public from storage.buckets order by id;                        -- 4 rows, all public=false
select polname, polcmd::text, pg_get_expr(polqual, polrelid) as using_qual,
       pg_get_expr(polwithcheck, polrelid) as with_check
  from pg_policy where polrelid = 'storage.objects'::regclass order by polname;
```

| bucket | scope | its `storage.objects` policies |
| --- | --- | --- |
| `documents-phi` | core (ADR 0114 D8) | `documents_phi_obj_insert_reserved` — **INSERT, `WITH CHECK` only, `USING` is NULL** |
| `documents-standard` | core (D8) | `documents_std_obj_insert_reserved` — INSERT, `WITH CHECK` only |
| `form-assets` | **out of scope** (D13) | `form_assets_insert_staff_admin` [INSERT] + `form_assets_select_member` [SELECT] |
| `meeting-audio` | **out of scope** (D13) | **(NO POLICY AT ALL)** |

- **`polcmd` census over all 4 policies: 3 × `'a'` + 1 × `'r'`; ZERO DELETE, ZERO UPDATE, ZERO
  `FOR ALL`.** That absent pair is the lock — stated per bucket, because the one SELECT policy
  belongs to `form-assets`, which is outside the document model.
- ⚠ **`meeting-audio` carries no policy of any kind**, so with RLS on it is deny-by-default for
  `authenticated`/`anon` and reachable only service-role. A reader who assumes "4 buckets, 4
  policies, one each" has it wrong in both directions.
- `storage.objects` grants **`arwdDxtm` to `authenticated` AND to `anon`** (`pg_class.relacl`) —
  **no grant-level fallback**: every storage protection here is exactly one permissive policy wide.

**The residue sweep — the enumeration that actually proves a retirement, bounded by a PROPERTY.**
Function bodies (comment-stripped, all non-system schemas), policy expressions, and constraint
definitions, asked for each historical bucket name as a quoted literal:

```sql
with names(bn) as (values ('attachments'),('attachments-phi'),('case-documents'),
    ('interview-attachments'),('nsp-evidence'),('referral-attachments'),('controlled-documents'),
    ('printed-documents'),('meeting-attachments'),
    ('documents-standard'),('documents-phi'),('form-assets'),('meeting-audio')),
fns as (select n.nspname||'.'||p.proname as fq,
          (select string_agg(regexp_replace(l,'--.*$',''), E'\n')
             from regexp_split_to_table(pg_get_functiondef(p.oid), E'\n') l) as code
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where p.prokind='f' and n.nspname not in ('pg_catalog','information_schema'))
select bn,
  (select count(*) from storage.buckets b where b.id = bn)                                as bucket_row,
  (select count(*) from fns f where f.code ~ (''''||bn||''''))                            as fn_refs,
  (select count(*) from pg_policies pol
     where coalesce(pol.qual,'')||coalesce(pol.with_check,'') ~ (''''||bn||''''))         as policy_refs,
  (select count(*) from pg_constraint c where pg_get_constraintdef(c.oid) ~ (''''||bn||'''')) as constraint_refs
from names order by bucket_row desc, bn;
```

**Result: all NINE retired names score `0 | 0 | 0 | 0`** — `attachments` · `attachments-phi` ·
`case-documents` · `controlled-documents` · `interview-attachments` · `nsp-evidence` ·
`printed-documents` · `referral-attachments` (S4's eight) **+ `meeting-attachments`** (retired
earlier, at F2's `20260921000300`). Survivors: `documents-phi` / `documents-standard` → 3 fn-refs,
1 policy-ref, 2 constraint-refs each; `form-assets` → 0 fn, 2 policy; `meeting-audio` → 1 fn
(`public.list_stale_meeting_audio`), 0 policy. **The census sums: 13 historical names = 4 live + 9
retired.**

⚠ **The DOMAIN of that sweep is record-sourced; only the VERDICT per name is catalog-derived — and
the domain was under-wide on the first pass.** It began as the DM5 record's twelve and missed
`meeting-attachments`, which surfaced only from the pgTAP estate. ⛔ **You cannot enumerate the dead
set from the live catalog: a retired bucket leaves no residue to find.** That asymmetry is exactly
why retirement had to be a *migration* (six historical migrations recreate the rows on every
`db reset`) and why the only standing assertion possible is over the **surviving** set.

⛔ **CONTRADICTION — the S4 stamp's "no client-side constant names a bucket any more —
`begin_document_upload` is the only thing that does" is false in BOTH halves.**

- **Catalog half:** **three** live functions name a document-bucket literal — `public.begin_document_upload`,
  **`app.printed_rendition_storage_bucket`** and `public.reclassify_document` — plus **2** CHECK
  constraints (`file_objects_bucket_check`, `file_objects_bucket_from_tier`) and 1 policy per bucket.
  ⚠ `app.printed_rendition_storage_bucket` landed at **S3** (`…000330`–`…000340`), *before* this
  stamp was written, so the claim was **false when authored**, not merely aged.
- **Client half:** `MEETING_AUDIO_BUCKET = 'meeting-audio'` (`src/lib/minutes-jobs/constants.ts:11`)
  is literally a client-side constant naming a bucket, and
  `printedRenditionStorageBucket()` (`src/lib/pdf-mint/storage-coordinates.ts:33-38`) returns
  `'documents-phi' | 'documents-standard'` as its *type*.
- ⭐ **The invariant that DOES hold, property-bounded** — every `.storage.from(…)` call site in
  `src/` (multiline search, since the call wraps a line and a single-line regex finds **none** of
  them): each either takes a **server-derived variable** (`file.storage_bucket`, `row.storage_bucket`,
  or the door's `bucket`) or names `form-assets` / `meeting-audio`, both D13 out-of-scope. **Zero
  retired-bucket literals; zero document-bucket literals at a `.from()` site.**
  `docs/reviews/dm5-s4-review.md:334` states precisely that — **the stamp is a compression of a
  correctly-bounded review sentence into a false absolute.** The direction survives; the
  absoluteness does not.
- ⚠ **My own first sweep of this OVERSTATED it, in the same class it was checking.** Grepping `src/`
  for the bucket names as string literals returned `'attachments'` ×3 and `"interview-attachments"`
  ×1 — which on inspection are `featureEnabled('attachments')` (a **feature-flag key**) and a
  `domId`. *A string-literal bound is a SYNTAX bound; the property is "names a storage bucket".*
  → [[a-predicate-quoted-at-the-wrong-grain]], and **resolve the VALUE, not the noun.**
- **Dead TS surface confirmed removed:** `ATTACHMENTS_BUCKET` / `ATTACHMENTS_PHI_BUCKET` /
  `bucketForTier()` survive only as a `⛔ RETIRED by DM5·S4` tombstone comment at
  `src/lib/attachments/constants.ts:65-75` — no live identifier matches.

⛔ **FIGURE RETIRED — the stamp's "these have 4 / 6 / 4 / 13 other callers".** It does not reproduce
under any bound I can construct, and it never carried one:

```sql
-- comment-stripped, all non-system schemas; functions and policies counted SEPARATELY
with fns as (select p.proname,
       (select string_agg(regexp_replace(l,'--.*$',''), E'\n')
          from regexp_split_to_table(pg_get_functiondef(p.oid), E'\n') l) as code
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prokind='f' and n.nspname not in ('pg_catalog','information_schema'))
select t, (select count(*) from fns f where f.proname <> t and f.code ~ ('\y'||t||'\s*\(')),
          (select count(*) from pg_policies pol
             where coalesce(pol.qual,'')||coalesce(pol.with_check,'') ~ ('\y'||t||'\s*\('))
from unnest(array['can_write_capa','can_read_capa','can_write_rca','can_read_event']) t;
```

**Measured: function callers `5 / 5 / 5 / 12`, policy callers `8 / 7 / 8 / 11`, combined
`13 / 12 / 13 / 23`.** Two of the four drifts have an explanation — `public.complete_evidence_upload_verification`
(the follow-up batch, *after* this stamp) calls `app.can_write_rca` and `app.can_write_capa`, so
4→5 twice — but `can_read_capa` (stamp **6**, measured 5) and `can_read_event` (stamp **13**,
measured 12) are **higher** in the stamp, so no additive story closes it. Comment-stripping changed
nothing. ⭐ **The CONCLUSION is untouched and in fact stronger: every count is ≥ 5, so dropping the
door was not dropping the lock.** Contrast `app.can_read_document_object` (DM3's, whose only caller
*was* its policy): `select count(*) from pg_proc where proname='can_read_document_object'` → **0**,
it is gone. *Correcting a magnitude is not correcting a direction, and here only the magnitude was wrong.*

**What enforces the retirement going forward — and what does NOT.**

- **`storage.protect_delete()` is role-agnostic** — its whole body tests
  `coalesce(current_setting('storage.allow_delete_query', true),'false') != 'true'` and raises
  `42501`. It is wired **BEFORE DELETE, STATEMENT-level** as `protect_objects_delete` on
  `storage.objects` **and** as `protect_buckets_delete` on `storage.buckets`. ⚠ **The Storage API
  sets that GUC itself**, so the trigger never fires on an HTTP delete — it guards **direct SQL DML
  only**, which is the context the retirement migration needed it for.
- `storage.buckets`: RLS **enabled**, **0 policies**, and `arwdDxtm` granted to `authenticated` and
  `anon`. Its two triggers are Supabase stock (`enforce_bucket_name_length_trigger`,
  `protect_buckets_delete`), both owned by the `storage` schema — **none of ours**.
- ⛔ **NOTHING in the catalog carries the migration's byte-first refusal forward.** The
  "refuse to retire a bucket that still holds `storage.objects` rows" guard was a one-shot `DO`
  block; `storage.buckets` has **0 CHECK constraints and 0 triggers of ours**. *A one-shot migration
  guard is not a standing invariant* — the next retirement inherits nothing and must re-derive it.
- **The standing pins that DO survive are on `file_objects`, not on storage**:
  `file_objects_bucket_check` (`storage_bucket ∈ {documents-standard, documents-phi}`) and
  `file_objects_bucket_from_tier` (tier ⇔ bucket, both directions). Bucket choice is a **server-side
  derivation**, CHECK-pinned.
- **Local object counts: 0 in all four buckets** (`storage.objects` grouped by `bucket_id`), matching
  `file_objects` = 0. The 221 objects the retirement buckets held were destroyed outside the D9 gate
  by a `supabase stop`/`start` recovery — `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES`.

**The pin, and the one thing it cannot see.** `325_legacy_bucket_policy_pin.sql` (`plan(8)`) is the
standing assertion: **t6** (no `storage.objects` policy's `qual`/`with_check` text references any of
the eight — *the derivation dialect is the expression TEXT, never policy names, so an indirect
reference still matches*), **t7** (all eight bucket rows are gone), and **t8**, an explicit
**positive control** asserting the four survivors are still present — *a sweep that retired
everything would satisfy t7 and fail t8*. ⚠ **The pin is keyed to a closed list of names** (the 8 +
the 4, plus `meeting-attachments` at t3/t4), so a **name outside that list** — a new bucket, or one
resurrected under another name — passes all of it. There is **no assertion anywhere in the pgTAP
estate on the TOTAL bucket count**: the complete set of lines touching `storage.buckets` is **7,
across 5 files** (`200` ×1 · `235` ×1 · `236` ×1 · `325` ×3 · `328` ×1); **two of the seven are
fixture `insert`s** (`235`, `236`), and each of the five actual reads is name-keyed. ⛔ **I nearly filed that
as a coverage gap before reading t6–t8** — the pin is real, well-controlled, and complete for every
name anyone has used. *Absence of a verdict is not absence of coverage; neutralize before escalating.*

## DM5·S3 — printed renditions moved onto the core substrate (`20260927000300`–`…000360`, **7** migrations; ADR 0120 D6/D7/D11/D12/D13/D17; pgTAP `342` `plan(59)`)

**Re-derived 2026-08-18 from the LOCAL catalog.** ⛔ **The DM END STATE stamp for S3 says
"`…000300`–`…000350`, 6 migrations" — the registry says SEVEN**, `…000360
dm5_s3_r1_mint_unique_violation_discrimination` (the QA-r1 fix) is an S3 migration and the range end
is `…000360`:

```sql
select version, name from supabase_migrations.schema_migrations
 where version between '20260927000300' and '20260927000399' order by version;   -- 7 rows
```

⭐ *A range written at authoring time does not know about the migration the review adds* — bound the
enumeration by the registry interval, never by the range someone typed into a header.

**`printed_documents` is a satellite — the shape, measured:**

```sql
select a.attname, a.attnotnull, coalesce(array_to_string(a.attacl,' ; '),'(no column ACL)')
from pg_attribute a where a.attrelid='public.printed_documents'::regclass
  and a.attnum>0 and not a.attisdropped order by a.attnum;                  -- 20 columns
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid='public.printed_documents'::regclass order by contype, conname;
```

- **20 columns; 17 carry an `authenticated=r` COLUMN grant; 3 withhold it** — `verification_token`,
  `revoked_reason`, `revoked_by`. ⚠ **The table-level ACL has no `authenticated` entry at all**
  (`postgres` + `service_role` only), so column grants are the *entire* read surface — a new column
  is invisible to PostgREST until it gets its own GRANT (the `case_referral` column-grant rule).
- **`document_id` + `document_version_id`: both NOT NULL, both UNIQUE**
  (`printed_documents_document_uniq`, `printed_documents_document_version_uniq`), plus the composite
  FK `printed_documents_version_document_fk (document_version_id, document_id) → document_versions(id,
  document_id) ON DELETE RESTRICT` — the two coordinates cannot disagree.
- **`storage_path` is GONE and so is `pd_storage_path_derived`** — both re-verified as absent
  (`count(*) = 0` against `pg_attribute` / `pg_constraint`), not merely unmentioned.
- ⚠ **The `printed_document_public` composite is NOT ≡ the GRANT, and is not meant to be.** Derived
  as a set difference rather than counted by hand:
  ```sql
  with granted as (select a.attname from pg_attribute a
      where a.attrelid='public.printed_documents'::regclass and a.attnum>0 and not a.attisdropped
        and has_column_privilege('authenticated','public.printed_documents',a.attname,'SELECT')),
       proj as (select a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid
      where c.relname='printed_document_public' and a.attnum>0 and not a.attisdropped)
  select (select count(*) from granted), (select count(*) from proj),
         (select string_agg(attname,', ') from (select * from granted except select * from proj) d);
  -- 17 | 15 | document_id, document_version_id      (projected-but-not-granted: none)
  ```
  **`mint_printed_document` and `revoke_printed_document` return `printed_document_public`, which
  omits S3's two new columns** — so the REFNOTE invariant *composite ≡ column GRANT* (pgTAP `326`
  t1–t3, the referral composites) **does NOT extend to this composite.** Anyone adding a column here
  must decide the grant and the projection **separately**; assuming the referral rule applies is the
  mistake this bullet exists to stop.

⛔ **CORRECTION — `responses` has NO securable trigger, and the design deliberately refuses one.**
The DM END STATE S3 stamp says *"A trigger on `responses` mints/drops its securable."* The catalog
says otherwise: `responses` carries **5** user triggers (`audit_responses_trg` ·
`guard_response_version_commission_trg` · `guard_submitted_response_trg` ·
`guard_supersession_coherent_trg` · `sync_case_phase_on_submit_trg`) and **none** touches
`securable_resources`; `select count(*) from securable_resources where resource_type='form_response'`
is **0** on this stack.

```sql
select t.tgname, p.proname from pg_trigger t join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid='public.responses'::regclass and not t.tgisinternal order by 1;   -- 5, none securable
select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.prokind='f' and pg_get_functiondef(p.oid) ~ 'securable_resources'
   and pg_get_functiondef(p.oid) ~ 'form_response';   -- the real writers
```

The `form_response` securable is minted **lazily inside `public.mint_printed_document`** —
`insert into public.securable_resources … on conflict (id) do nothing`, **targeted at `(id)`** (an
untargeted `do nothing` would swallow a future constraint), followed by a **re-read that asserts the
stored `resource_type` matches** (`HC0D1`) because the upsert may have lost to a row of a different
type. The function's own comment states the trigger was **rejected on purpose** (ADR 0120 **D17.2**:
no backfill, and `responses` is the highest-cardinality table in the product — a 1:1 shadow of it in
a security registry is the wrong trade). ⭐ *The stamp did not merely go stale; it asserts the exact
mechanism the design wrote a paragraph to refuse.* → [[a-comment-is-an-assertion-that-goes-stale-silently]]

**Byte path and doors** (`pg_proc`: `prosecdef`, `provolatile`, `proconfig`, `proacl`):

| door | secdef | vol | EXECUTE granted to | result |
| --- | --- | --- | --- | --- |
| `app.resolve_document_version_bytes(uuid, text, uuid)` | `t` | `s` | **`postgres` ONLY** | `TABLE(11 cols)` |
| `public.open_printed_document(uuid)` | `t` | `v` | `postgres`, `service_role`, `authenticated` | `TABLE(storage_bucket, storage_path, status, contains_phi)` |
| `public.mint_printed_document(9 args, no path param)` | `t` | `v` | `postgres`, `service_role`, `authenticated` | `printed_document_public` |
| `public.lookup_printed_document(text, uuid)` | `t` | `v` | `postgres`, `service_role` | `TABLE(6 cols)` |
| `app.can_view_printed_document(text, uuid, uuid)` | `t` | `s` | `postgres`, `authenticated`, `service_role` | `boolean` |

All five pin `search_path = app, public, pg_catalog`. ⚠ **`resolve_document_version_bytes` is
`postgres`-only — `service_role` is NOT on its ACL**; it is reachable only from inside the two
DEFINER doors that delegate to it, which is what makes ADR 0120 **D12**'s "one resolver" claim
structural rather than conventional.

- **Two NEW helpers the stamp does not name**: `app.printed_rendition_storage_bucket(boolean)` and
  `app.printed_rendition_storage_path(uuid)` — both **INVOKER** (`prosecdef = f`), **IMMUTABLE**,
  EXECUTE to `postgres` only. They are the single home of the coordinate derivation, called by both
  `mint_printed_document` and the binding guard, which is why the retired CHECK could be replaced
  without duplicating the rule.
- **Write guards, enumerated by PROPERTY** (`body references printed_documents AND raises`):
  `app.guard_printed_document_version` (**HC0DK**, BEFORE INSERT on `document_versions`) ·
  `public.soft_delete_document` (**HC0DL**) · `public.request_document_disposition` (**HC0DN**) ·
  `public.mint_printed_document` · `public.revoke_printed_document`. ⚠ **That property-bounded set is
  NOT the stamp's curated "five"** — it misses `begin_document_upload` (which refuses
  `p_resource_type = 'form_response'` with **`P0002`**, before anything is reserved) and
  `app.guard_printed_document_binding`, whose errcode is **`HC0DA`**, *not* in the `HC0D[KLN]`
  family — an `HC0D[KLN]` sweep silently omits it. The union is **7** refusal sites.
  *An enumeration bounded by an error-code family is a syntax bound.*
- **The print arm's position is measured, not assumed.** In `app.can_read_document`, the dispatch
  order is `p_uid is null` → **`app.is_active`** → home lookup → **print arm** (relational, on the
  `printed_documents` FK) → `case v_type when …`. Both kernels expose **8** `when '<type>'` arms
  (`action_item`, `capa_action`, `case`, `case_referral`, `controlled_document`, `interview`,
  `meeting`, `rca`); **`form_response` is deliberately not among them** — a print never reaches the
  home dispatch. ⭐ **`documents.kind` really does carry 0 CHECK constraints**
  (`select count(*) from pg_constraint where conrelid='public.documents'::regclass and contype='c'
  and pg_get_constraintdef(oid) ~ 'kind'` → 0), which is why the arm keys off the FK: unchecked text
  fails **open**.
- **`securable_resources_type_check` now admits 9 types** (`form_response` added here);
  `securable_resources_tenant_shape` still carries **two** arms — see the S2 section below for the
  precise reading of the second one.

⬛ **DISCHARGED 2026-08-18.** This paragraph read *"No `## DM5·S4` section exists by design … named
so the asymmetry is visible rather than read as an omission."* The PO ruled S4 written the same way;
**the `## DM5·S4` section is directly above this one**, and all four DM5 slices now have one.
Kept rather than deleted, because the note is what made the gap addressable in one round — *naming
an omission is how it stops being invisible*, and a silently-vanished note leaves the next reader
unable to tell a discharged item from one that was never raised.

## DM5·S2 — NSP RCA/CAPA evidence on the document substrate (`20260927000100`–`…000170`, **8** migrations; ADR 0120 D10/D14; pgTAP `341`)

**Re-derived 2026-08-18 from the LOCAL catalog.** The registry interval reproduces the header exactly
— 8 versions, `…000100 dm5_s2_securable_types_rca_capa` → `…000170 dm5_s2_wave_d_gates_begin`:

```sql
select version, name from supabase_migrations.schema_migrations
 where version between '20260927000100' and '20260927000299' order by version;   -- 8 rows
```

**The securable arms — and one precision the stamp gets slightly wrong.**

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid='public.securable_resources'::regclass and contype='c';
```

- `securable_resources_type_check` admits **9** types today. ⚠ **The DM END STATE S2 stamp says
  "8" — that was true AT S2 and `form_response` was added one slice later by S3.** Read the stamp as
  a delta, not as a current-state figure; the current figure is 9.
- `securable_resources_tenant_shape` carries **two** arms: eight types requiring
  `organization_id`, `hospital_id` **and** `commission_id` NOT NULL, plus a `capa_action` arm
  requiring **only org + hospital** NOT NULL (ADR 0120 D14). ⛔ **The stamp reads `org + hospital,
  NULL commission` — the CHECK does not say that.** It places **no** constraint on
  `commission_id` in that arm, and `commission_id` is a **nullable column**
  (`pg_attribute.attnotnull = false`), so a `capa_action` securable carrying a non-NULL commission
  satisfies the constraint. NULL-commission is the **intent**; the constraint enforces only the
  org+hospital floor. *Resolve the VALUE, not the noun* — anyone hardening this must add the
  exclusion, not assume it.

**Kernel arms.** `app.can_read_document` and `app.can_write_document` each dispatch **8**
`when '<type>'` arms and both include `rca` and `capa_action`:

```sql
select distinct m[1] from pg_proc p,
     regexp_matches(pg_get_functiondef(p.oid), 'when ''([a-z_]+)''', 'g') m
 where p.oid = 'app.can_write_document(uuid,uuid)'::regprocedure order by 1;
```

⚠ **The write arm was missing for a full slice and refused every user with `P0002`**
(BUG-DM5-S2-WRITE-ARM-1, fixed by `…000160 dm5_s2_write_arm_nsp`) — *a new home type means
enumerating EVERY dispatch on `resource_type`, both kernels, not the one the feature reads.*

**Doors — `p_storage_path` is gone from all three** (identity arguments, from `pg_proc`, not the
migration text):

- `public.begin_document_upload(p_resource_type, p_resource_id, p_title, p_description,
  p_confidentiality_level, p_document_id, p_declared_file_name, p_declared_mime, p_declared_size,
  p_kind, p_occurred_on)` → `jsonb`
- `public.add_rca_evidence(p_rca_id, p_kind, p_title, p_document_id, p_external_url,
  p_citation_target, p_cited_entity_id, p_citation_label)` → **`rca_evidence`**
- `public.add_capa_action_evidence(p_action_id, p_kind, p_title, p_document_id, p_external_url)` →
  **`capa_action_evidence`**

⚠ **Both evidence doors return the TABLE ROW TYPE, not a projection composite** — unlike the 23
referral doors (REFNOTE / ADR 0113). A new column on either evidence table is therefore returned
automatically, and its exposure is governed by the table GRANT alone. Do not "harmonise" these onto
`_public` composites without re-reading `341`.

**The Wave-D flag is an APP-LAYER gate, concentrated in one assert with 5 callers:**

```sql
select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app','public') and p.prokind='f'
   and pg_get_functiondef(p.oid) ~ 'assert_documents_wave_d_enabled'
   and p.proname <> 'assert_documents_wave_d_enabled';
-- add_capa_action_evidence · add_rca_evidence · begin_document_upload
-- · complete_evidence_upload_verification · mint_printed_document
```

- In `begin_document_upload` the assert is **arm-scoped** — `if p_resource_type in ('rca',
  'capa_action') then perform app.assert_documents_wave_d_enabled(); end if;` — mirroring the
  wave_b/wave_c arms directly above it (ADR 0120 D10: gate the FIRST residue-producing step, and
  only for this corridor).
- ⭐ **`finalize_document_upload` is NOT in the caller set** — deliberate, and the query above is
  what proves it rather than the absence of a mention.
- The two callers added *after* S2 are `complete_evidence_upload_verification` (follow-up batch) and
  `mint_printed_document` (S3). ⚠ **The flag is NOT a security boundary** — 0 RLS policies read one;
  see the DM END STATE block for the full 75/6 census.

**Evidence tables — the current grant, stated precisely.**

```sql
select relname, coalesce(array_to_string(relacl,' ; '),'(none)') from pg_class
 where relname in ('rca_evidence','capa_action_evidence');
select tablename, policyname, cmd from pg_policies
 where tablename in ('rca_evidence','capa_action_evidence');
```

- `authenticated=rm/postgres` on both — **`r` (SELECT) + `m` (MAINTAIN); no `a`/`w`/`d`.** ⚠ The
  DM5 follow-up-batch section above says *"`authenticated` holds SELECT and nothing else"* — the
  **security conclusion is right** (no INSERT/UPDATE/DELETE; all writes traverse the RPCs) but the
  ACL is `rm`, not `r`. A sweep asserting the literal string `authenticated=r/postgres` reds on a
  correct table.
- Each table keeps **2** policies (`_select` FOR SELECT, `_write` FOR ALL, both `{authenticated}`) —
  kept as the second lock because `ALTER DEFAULT PRIVILEGES … FOR supabase_admin` would restore the
  grant on a re-dumped baseline. ⚠ **A `FOR ALL` policy IS also a read policy.**
- `rca_evidence.cited_document_id` exists (**un-parked** at S2, `…000130 dm5_s2_citation_seam`);
  `capa_action_evidence` carries `document_id` only.

⚠ **`341_dm5_s2_nsp_evidence_substrate.sql` declares `plan(67)`, but that is the FILE's current
total, not S2's contribution** — the DM5 follow-up batch added its H1–H4 and J7 blocks to the same
file. Do not cite it as an S2 figure.

## DM4 — Wave C: referrals on the document substrate (2026-08-14; ADR 0114 + ADR **0119** D1–D10; migrations `20260926000100`–`…000500`; pgTAP `340`; flag `documents_wave_c` **OFF** — seed forces ON local/E2E; QA APPROVED r2, PO-approved)

**Registry 391 == 391 files.** Referral documents now live on the DM1 core substrate.

**New / changed doors** (all `prosecdef`, verify against `pg_proc`, never this text):
- **`public.open_referral_snapshot_document(p_shared_item_id) RETURNS jsonb`** — NEW click-time byte
  door. Gates **only** `can_read_referral_phi` (null on denial ≡ absence); refuses tombstoned/unbound
  (**`HC0DS`**) and disposed bytes (`HC0DD`); emits **exactly one** `referral.viewed`; returns IDs
  only — TS signs service-role at **120 s** (ADR 0114 **D8** reverses the cookie-client posture).
  ⚠ Returns `jsonb` ⇒ **joins the census blind class**; its assurance is `340` + the matrix, **not**
  the arms.
- **`add_referral_shared_item`** — the `document` arm is **un-parked** (`HC0DM` removed). Refuses an
  **enforcing confidentiality label** (**`HC0DC`**, ADR 0119 **R3**); validates the source-case home
  (`HC077`); resolves the latest servable version else `HC0D8`. ⚠ **It is the table's ONLY writer.**
  ⛔ **Under-inclusive gate — see `FUP-DM4-RECUSAL`:** it checks referral-**source** authority but
  **never `can_read_case` / `can_read_document`**, so a **recused** coordinator reaches PHI bytes.
  PO-deferred to Phase 19 D16; **deadline = the flag-on date**.
- **`app.can_read_document` / `app.can_write_document`** — new `case_referral` arms. Read =
  `can_read_referral_metadata` (**broad**); write = `can_manage_referral_target` **AND**
  `status IN ('accepted','in_review')` — predicate-identical to the retired legacy gate, so the **DT
  office is admitted** on `target_type='technical_director'` referrals only.
- **`public.begin_document_upload`** — wave-c assert at the **top**, scoped `p_resource_type='case_referral'`
  (the corridor's **first residue-producing step**); tier CASE gains `case_referral → 'phi'`.
- **`get_referral_detail`** — projects `frozen_document_version_id` (**PHI-gated**),
  `frozen_tombstoned_at` (metadata-visible governance state) and a server-computed **`can_open`**
  (= *"the audited door would serve this to this caller"*: `v_can_phi AND bound AND not tombstoned
  AND servable`). ⚠ **`frozen_document_version_id` is NEVER an affordance input** — it is `null` for
  a metadata reader *even when a binding exists*.
- **Audit (ADR 0119 D10):** the verb stays coarse (`referral.viewed`); the event class lives in
  **`metadata.kind`** — `document_open` (+ `shared_item_id`, `document_version_id`) vs `content_view`.
  Absence of the field = a pre-DM4 row, never a third type. ⚠ `app._audit_access_authorized`'s
  `referral.viewed` arm **IS `can_read_referral_phi`** — one predicate applied twice, **not** two locks.

**Retired** (F-14 closed): `add_referral_reply_attachment` · `get_referral_attachment_path` ·
`get_referral_snapshot_document_path` · `app.can_read_snapshot_document` · the
`referral_reply_attachment` **table** · policies `case_documents_select_member`,
`referral_attachments_obj_insert/_select`. **The DM1 referral allowlist is EMPTY; the door-sweep
keystone runs at zero exceptions.** Buckets are **not** deleted — DM5 owns one retirement manifest.

**Schema:** `referral_shared_item` gains `frozen_document_version_id` FK → `document_versions`
**ON DELETE RESTRICT** + `frozen_tombstoned_at/_reason`; **`source_document_id` gains its first FK**
→ `documents(id)` **ON DELETE SET NULL** (DM1 had dropped it, ADR 0116 D1) preceded by a
dead-pointer null-out; `frozen_storage_path` **dropped**; `referral_shared_item_shape` replaced
(version-bound XOR tombstoned). `case_referral` joins `securable_resources` as `'case_referral'`
via a **`BEFORE INSERT` trigger** (satisfy by construction, not at N call sites) — tenant anchor is
the **source** commission.
⚠ **`referral_shared_item` and `referral_reply_attachment` grant `authenticated` FULL table-level
DML** (`arwdDxtm`); the deny is **RLS-with-no-write-policy**, not an absent grant — **one future
write policy silently opens the table** (pinned: `340` D7).

## DM3 — Wave B: controlled documents (2026-08-14; ADR 0114 **Amdt 2 / D17**; migrations `20260925000100`–`…001100`; pgTAP `330`; QA APPROVED r2, PO-approved)

**STATE: BUILT, GATED, NOT MERGED.** Controlled documents now live on the DM1/DM2 core
substrate. ⚠ **This block supersedes the DM2 block below wherever they disagree about the
controlled-document surface.**

- **Retired — do not look for them:** `set_document_version_file` (RPC),
  `controlled_document_versions.storage_path` (COLUMN), `addDocumentVersion` /
  `createSignedDownloadUrl` / `createAndSubmitDocument` / `supersedeAndSubmitDocument` /
  `reviseChangesRequestedDocument` (TS), and **BOTH** `controlled-documents` Storage policies
  (`_obj_select_member` **and** `_obj_insert_writable`, the latter a full bypass of
  `begin_document_upload`). `app.can_read_document_object` is dropped **and pruned from
  `authz-blind-allowlist.txt`** — a stale allowlist entry **pre-excuses any future function
  that reclaims the name**.
- **New doors:** `attach_controlled_document_version_file` (public, DEFINER, returns the
  composite `controlled_document_versions`), `app.controlled_version_source_path`,
  `app.mint_controlled_document_resource` (BEFORE INSERT trigger), 
  `app.guard_ethics_document_case_scope`, `app.guard_controlled_core_binding`,
  `app.assert_documents_wave_b_enabled` (**INVOKER, schema `app`**).
- **Uploads** are the DM2 client corridor (`begin_document_upload` → client PUT →
  `finalize_document_upload` → `attach_…`). **Downloads** go through `open_document_version`.
  `documents_wave_b` is asserted at **`begin_document_upload` (home-type-scoped)** and at
  `attach_…` — **NOT at every door**, deliberately: `begin_document_upload` serves every home,
  so a blanket assert would kill Wave A (pinned by `DM3·T3b`).
- **Ethics seams discharged (D17):** both columns carry a real FK to `documents(id)`;
  `issue_ethics_notification` accepts `p_related_document_id` again (**`CREATE OR REPLACE` — 8-arg
  identity preserved**); `set_ethics_decision_details` gained `p_decision_letter_document_id`
  (**`DROP`+`CREATE` + explicit re-GRANT** — 11 args with 10 `DEFAULT NULL` made a replace
  impossible without minting an ambiguous overload). `328` K8c removed; **K8a/K8b survive**.
  ⚠ **An ethics letter homes on the `case` securable resource, NEVER `controlled_document`** —
  otherwise `HC0D6` refuses its enforcing label and the D15 ceiling silently disappears.
- ⚠ **`attach_controlled_document_version_file` is in no BLINDNESS-DETECTING arm's domain.**
  It IS in `ARM=floor`'s domain (`public` + `prosecdef` + auth-EXECUTE = **411 signatures**),
  but ARM 2 asks only *"is the door called?"*, never *"does anything notice when it is
  opened?"*. Its own `app.is_staff_admin_of` check **is** the entire boundary; assurance is
  pgTAP keystones (`330 DM3·P1/P1b/P1c`, `314 §10.3`), **not** any arm.
- ⚠ **Standing, unruled — ⭕ RE-DERIVED 2026-08-17 (DM5·S6), and the old figure had no
  predicate.** DEFINER composite-returning auth-reachable functions outside the census domain:
  **141 in `public`, 145 across `app`+`public`.** ⭐ **That is the whole story of the "146 vs
  141" disagreement this file carried: the two numbers differed by their SCHEMA BOUND, and
  neither one said which schema it meant.** Re-derive rather than cite:
  ```sql
  select n.nspname, count(*)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type    t on t.oid = p.prorettype
  where n.nspname in ('app','public') and p.prosecdef and p.prokind = 'f'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and t.typname <> 'bool' and not p.proretset   -- = outside ARM=census's DEFINER clause
    and t.typtype = 'c'                            -- composite-returning
  group by 1;   -- app -> 4, public -> 141
  ```
  ⛔ **The old "(273 signatures)" does NOT reproduce** under any bound that yields 141 or 145,
  and the predicate behind it was never written down — so it is retired rather than carried
  forward. *A count without its query is not a measurement; it is a rumour with a number.*
  Predates DM3; DM3 added one. All six DM3 functions are in **`authz-unswept-backlog.txt`**
  (*"never swept, so we do not know"*), **not** the BLIND allowlist (*"swept, nothing noticed"*).
- ⭐ **Wider context:** this composite-returning set is a **subset** of a larger class — the
  `authenticated`-reachable non-trigger DEFINER command doors that sit outside **every**
  `p0-authz-invariant.sh` arm's domain. ⛔ **This bullet read "407" and
  "covered-but-unpinned, not blind" until 2026-08-31; BOTH halves are now false.**
  - The count was **427** (345 `public` + 82 `app`) when last derived — and ⛔ **do not quote that
    either**: `ARM=census`'s banner derives it every run, which is the only current source.
  - ⛔ **"Covered-but-unpinned" rested on a 3-door sample from 2026-08-17 and stood for two weeks.**
    The purpose-built `supabase/tests/mutation/c2-command-door-neutralizer.sh` (ADR 0171) found
    **3 BLIND in its first 8 measurements** — `nsp_org_capa_rollup`, `cancel_event` (no pgTAP
    mentions at all) and `cancel_session`, which **has** a test that still does not notice its guard
    vanish. *Three COVERED results were evidence about three doors, never about the population.*
  - ⚠ **An instrument now exists, but the arms still do not cover this class** — the neutralizer is
    a separate periodic harness, not an ARM, and **8 of 171 enforcers are measured**. "All arms
    green" remains no claim about these doors.

  Full statement: `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` + `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` in
  [follow-ups-open.md](.././followups/follow-ups-open.md); sizing + harness design in
  [authz-c2-tier1-sizing.md](.././design/authz-c2-tier1-sizing.md) §8b and
  [authz-c2-command-door-neutralizer.md](.././design/authz-c2-command-door-neutralizer.md).

**Full record:** [dm3-controlled-documents.md](.././progress/dm3-controlled-documents.md).

## DM2 — Document-model command layer + Wave A (2026-08-13; ADR 0114 Amdt 1 + **0117** +Amdt 1 + **0118**; migrations `20260924000100`–`…000800`; flags **all five still OFF** in production defaults; QA APPROVED r2, PO-approved)

**STATE: BUILT, GATED, NOT MERGED.** DM2 supplies exactly what the DM1 block below says it
lacks — the command surface (`begin_document_upload` / `finalize_document_upload` /
`complete_document_upload_verification` / `open_document_version` / the delete + affordance
doors), the TS layer under `src/lib/documents/`, the reconciliation script, and the Wave A UI
for case / meeting / interview / action-item homes. ⛔ On branch `docs/dm1-plan-amendments`,
**NOT merged to `main`, nothing pushed**; **all five DM flags ship OFF** (`seed.sql` forces
`documents_foundation` + `documents_wave_a` ON for local/E2E only).

**Three things to know before touching this surface:**
1. **`open_document_version` is the byte boundary, and it is in no BLINDNESS-DETECTING arm's
   domain** — ⚠ *corrected 2026-08-13 (DM3 QA MINOR-1, lead-verified from the catalog): the
   earlier wording "in NO authz arm's domain" is **measurably false**. `ARM=floor`'s domain is
   every `public` `prosecdef` function EXECUTE-able by `authenticated` — **411 signatures** —
   and it contains this door. But ARM 2 asks only whether a door is **called**, never whether
   anything **notices when it is opened**, so the substantive point is unchanged.* It
   returns `jsonb`, and every arm bounds itself on `prosecdef` boolean / `proretset` /
   invoker-wrapper shapes. That is ADR 0118 **§12**'s standing blind spot (536 pre-existing
   functions share the class), not a DM2 regression. Its assurance is pgTAP `329` P0a–P0f +
   the `308` 5.2s sentinel. **Do not read a green sweep as covering it.**
2. **The door's deliberation conjunct is SCOPED to case- and interview-homed bytes**
   (`v_case` resolves for those two home types only). A **meeting**-homed document has no
   conjunct — it is gated by the `app.can_read_document` kernel alone. That is safe today
   because the oversight reviewer holds a *hospital*-scoped `quality_reviewer` membership and
   `app.is_member_of_for` returns **false** for every commission (catalog-verified
   2026-08-13) — but it is a real asymmetry, so verify before adding a home type.
3. **The kernel's interview arm consults the interview's OWN ceiling** since
   `20260924000800` (ADR 0117 Amdt 1) — it dispatches `app.can_read_interview`, not
   `can_read_case_committee(case_of_interview(...))`, which skipped a level and left a
   transcript readable while its interview row was hidden.

Record: [dm2-orchestration-wave-a.md](../progress/dm2-orchestration-wave-a.md) · review
[dm2-orchestration-wave-a-review.md](../reviews/dm2-orchestration-wave-a-review.md).
⚠ **CORRECTED 2026-08-14 (lead, at the DM5 open). This line said "Still unbuilt: S2.8
`reclassify_document_file` has no legal expression on the DM1 substrate." That was FALSE
and it caused a bad ruling** — ADR 0120 D3/D4/D5 were drafted on it before the catalog
was checked. **S2.8 was RULED, BUILT and ADR'd at DM2** (record
[dm2-orchestration-wave-a.md](../progress/dm2-orchestration-wave-a.md) §S2.8, "✅ RULED …
option 1"; ADR [0118](../decisions/0118-dm2-s2-command-layer-decisions.md)). It shipped under
a **different name** — `public.reclassify_document` + `complete_document_reclassification`
— which mint a new `document_version`, bind the new `file_object`, and retire the old one
via `file_objects.disposal_state = 'disposal_pending'` with reason `duplicate`;
`complete_document_disposal` gates that reason on a **live same-`sha256` sibling** it
verifies itself ("EVIDENCE, never a claim", `HC0DR`). **Zero DM1-invariant edits**, which
was the whole point of choosing option 1.
⛔ The "no legal expression" text still in the DM2 record is the **superseded fork**, kept
there behind `<!-- superseded fork text kept below for the reasoning trail -->`. Do not
quote it as current.
⭐ Root cause worth carrying: the verdict was keyed to the **noun** `reclassify_document_file`,
which is absent from `pg_proc` — so a name-keyed check returned "unbuilt" while the
**capability** was live under another name. Resolve the VALUE, not the noun
([[a-rename-orphans-a-name-keyed-verdict]], [[a-comment-is-an-assertion-that-goes-stale-silently]]).

**Still unbuilt:** Waves B/C/D (controlled docs · referrals · NSP+printed) are DM3–DM5.

---

## DM1 — Document-model substrate cutover (2026-08-12/13; ADR 0114 D1–D14 + ADR 0116; migrations `20260923000100`–`…000600`; flags `documents_foundation` + `documents_wave_a..d` **all OFF**; QA APPROVED r1, PO-approved)

⚠ **The "inert" claim below is SUPERSEDED by the DM2 block above** — kept as the DM1
historical record, not as current state. The command surface it defers to DM2 now exists.

**⛔ STATE AS OF DM1: INERT SUBSTRATE.** The document model exists in full (tables, kernel,
buckets, audit verb, flags) but has **NO public RPCs, NO writers, NO UI** —
`begin_document_upload` / `finalize_document_upload` / `open_document_version` and the whole
command surface are **DM2**. Nothing user-visible changed (prod's `attachments` flag has been
OFF since 2026-08-11/D1). Do not read anything below as usable; it is the foundation DM2
builds on.
Record: [dm1-substrate-cutover.md](../progress/dm1-substrate-cutover.md) · plan
[dm1-substrate-cutover-plan.md](../plans/dm1-substrate-cutover-plan.md) · review
[dm1-substrate-cutover-review.md](../reviews/dm1-substrate-cutover-review.md).

- **REMOVED (the F2 substrate, wholesale — ADR 0114 D5; `20260923000100`):** tables
  `attachments` / `attachment_references` / `attachment_subjects` (their policies +
  triggers + the 4 dangling prod rows with them); the 5 public RPCs `create_attachment` /
  `open_attachment` / `dispose_attachment_phi` / `reclassify_attachment` /
  `soft_delete_attachment`; the 7 `app.*` routines (`can_read_attachment` /
  `can_write_attachment` / `commission_of_attachment` / `attachment_confidentiality_ok` /
  `assert_attachments_enabled` / `guard_attachment_immutable` / `trg_audit_attachment`);
  the 3 storage policies `attachments_obj_{insert_writable,select_readable}` +
  `attachments_phi_obj_insert_writable`; the 4 inbound FKs. The `attachment.read` verb left
  the audit allow-list + dispatch. pgTAP `328` K1 pins zero survivors (catalog sweep,
  comment-stripped `prosrc` included) minus the named allowlist below.
- **PARKED SEAM COLUMNS (survive, fail-closed, each with an adopting wave):**
  `rca_evidence.cited_document_id` (→ **Wave D**; FK dropped; held by CHECK
  `rca_evidence_cited_document_parked` — the table has a live authenticated write policy —
  plus the writer's `HC0DM` refusal) · `referral_shared_item.source_document_id` (→ **DM4**;
  no authenticated write policy; `add_referral_shared_item`'s document arm raises `HC0DM`) ·
  `ethics_decision_details.decision_letter_document_id` + `ethics_notifications.related_document_id`
  (**NO adopting wave — pending the Q1 PO ruling**, recorded in the program plan; SELECT-only
  grants, no writer / `issue_ethics_notification` raises `HC0DM`). `dispose_case_phi` lost its
  attachment-redaction step → **FUP-DM1-DISPOSE**.
- **PRESERVED DELIBERATELY — the 7-item DM4 allowlist (do NOT "clean these up"):**
  `add_referral_reply_attachment` + `get_referral_attachment_path` (live referral reply-file
  doors), `referral_reply_attachment_select_readable`, `referral_attachments_obj_{insert,select}`
  — the referral module's OWN surface, not centralized-attachment doors — **plus
  `case_documents_select_member` + `app.can_read_snapshot_document`**, which are the LIVE
  cookie-client boundary for frozen referral-snapshot downloads (`getReferralDocumentUrl`
  signs `case-documents` through this policy) until DM4 re-points snapshots at the document
  model. All 7 pinned BY NAME in `328` K2; DM4's exit empties the allowlist and re-runs the
  sweep at zero exceptions.
- **ADDED — registry:** `securable_resources` (ADR 0114 D4; the participants dialect with
  roles inverted — anchor `UNIQUE(id, resource_type)`; `cases`/`meetings`/`case_interviews`
  (⚠ not "interviews")/`action_items` each carry a constant `securable_type` + composite-FK
  pin; BEFORE-INSERT trigger `app.ensure_securable_resource` mints rows (targeted
  `ON CONFLICT (id)`), AFTER-DELETE sweeps them; tenant trio resolved from `commissions`;
  tenant-shape CHECK; backfill was proven on a populated stack — it is reset-invisible
  forever). Delete semantics: `documents.home_resource_id` is ON DELETE **RESTRICT**, so
  from DM2 on a domain row with documents cannot be hard-deleted (witnessed by `328` K3g).
- **ADDED — the 8 core tables** (`documents` [+ the D6 `access_policy_id` seam, referenced
  by NOTHING], `document_versions` [immutable rows, guard `HC0D2`], `document_version_files`
  [rendition CHECK; UNIQUE(version, rendition) provisional], `file_objects`
  [`UNIQUE(bucket,path)`; bucket-from-tier CHECK; D9 upload machine + D10 disposal machine
  via guard `HC0D1/HC0D3`; physical identity trigger-immutable `HC0D2`], `document_placements`
  [**non-authorizing, ever** — D6], `upload_sessions`, `document_retention` [structure only —
  O1; one PROVISIONAL 20-yr catch-all row; `document_retention_select` is a deliberate
  `using(true)` catalog read], `document_legal_holds` [holds block disposal AND soft-delete —
  D10]). **Posture, all 9 incl. the registry: RLS on, exactly ONE SELECT policy each,
  `authenticated` SELECT-only, ZERO client DML** (command-only mutations; QA verified 19/19
  DML attempts `42501`). Guards are strict — no bypass GUC.
- **ADDED — the 6 `app.*` doors** (all `prosecdef`, pinned `search_path`, EXECUTE =
  authenticated + service_role only; zero `public`-schema wrappers reach them; each
  census-registered with a COVERED verdict — ADR 0116 §8 for the accurate taxonomy):
  `can_read_document` (the READ KERNEL — home-resource dispatch: case→`can_read_case`,
  meeting→`is_member_of_for`, interview→`can_read_case_committee(case_of_interview)`,
  action_item→`can_read_action_item`; `is_active` outer gate; **NO is_admin arm** — noun
  rule, pinned behaviorally by `328` K5d) · `can_write_document` (the WRITE KERNEL —
  independent arms: staff_admin-of-home-commission, `is_case_excluded` denies, action-item
  assignee arms, `can_write_interview` delegation; DM2's command surface calls it) ·
  `can_read_document_version` (pure resolver) · `can_read_file_object` (**chain-only** —
  binding→version→document→kernel; the uploader arm was REMOVED at QA MAJOR-1, ADR 0116
  §11, absence pinned by `328` K13) · `can_read_document_hold` (independent decision:
  staff_admin-of-home OR tenancy admin — narrower than document read) ·
  `storage_upload_reserved` (reservation predicate over `upload_sessions`+`file_objects`;
  ⚠ outside the door-sweep's name-prefix domain — covered by targeted mutation + `328`
  K6d–K6h, never cite a sweep for it).
- **ADDED — buckets** `documents-standard` / `documents-phi` (private; 25 MiB + the 13-type
  MIME allow-list mirrored from F2 — the D9 compensating controls while no scanner exists,
  O2). **NO SELECT policy on either bucket, for ANY tier or principal — deliberate (D8):**
  every byte flows through DM2's audited `open_document_version` → service-role short-TTL
  signing; the F-01 class (path-authorized byte reads) dies structurally. Pinned by `328`
  K6b via the qual-text derivation. INSERT-only policies
  `documents_{std,phi}_obj_insert_reserved` bind to `storage_upload_reserved` reservations —
  live, fail-closed, inert until DM2's `begin_document_upload` (nothing can mint a
  reservation; the two policies are outside every sweep's domain — FUP-AUTHZ-WP-SNAPSHOT
  class — covered by `328` K6 + twins).
- **ADDED — audit + flags:** `document.opened` in the `log_audit_access` allow-list + the
  `_audit_access_authorized` dispatch (→ `can_read_document`); ⚠ neither function body may
  quote a dotted verb literal even in comments — pgTAP `191` parses them. Flags
  `documents_foundation` + `documents_wave_a..d`, **all OFF** (inserted `…000600`, targeted
  `on conflict`; seed does NOT enable them); the legacy `attachments` flag KEY survives,
  verbless, until DM2 retires it.
- **⚠ DM2 PREREQUISITES a future reader will trip over:** ① the **confidentiality ceiling**
  — PO ruled FUP-DM1-CEILING **option 1**: re-express the ADR 0072 D7 ceiling on `documents`
  (interim; the general access plane lands at **Phase 19 / Surveyor Access** on the
  `access_policy_id` seam) — a **DM2 prerequisite**, not built in DM1 (ADR 0114 amendment);
  ② **FUP-DM1-DISPOSE** — `dispose_case_phi` must trigger document disposition (D10) for
  case-homed documents, keystoned, before Wave A's flag flips; ③ **MINOR-2** —
  `open_document_version` must **gate before recording**: the dispatch registry's
  `is_admin()` short-circuit lets a platform_admin mint a `document.opened` row for a
  document it cannot read (no read leak; the `read_minutes_transcript` pattern is the fix).
  Plus the full retired-coverage obligation list (reclassify fence, the 308 §5 byte-
  discrimination pins, the M8 E2E bytes-cut contract) in the phase record's §obligations.

## DOC-REDESIGN — Controlled-Document Redesign (Phase 17 v2, 2026-07-21; ADR 0081; migrations `20260819000000`–`…000400`; flag `controlled_docs` unchanged, prod-OFF till pilot) → `main`

Redesign of Phase-17 controlled docs (frontend rebuilt to the design handoff; additive backend contract). **Enum-key anglicization — this module only** (ADR 0069 method; keys English, pt-BR **labels unchanged**; ethics module's pt-BR enums untouched via function-scoped replace): `controlled_documents.doc_type` → `policy|sop|protocol|bylaws|manual|other`; `document_approvals.decision` → `approved|rejected`; `commission_charters` `regimento`-doc references updated to `bylaws` in lockstep.
- **Additive columns:** `controlled_documents.{category text, tags text[], description text}`; `controlled_document_versions.{obsolete_kind text CHECK(superseded|retired), proposed_effective_date date, approval_due_date date}`. Ride existing RLS; category/tags/description kept OUT of the audit payload (metadata, like `title`).
- **RPCs** (re-emitted from live `pg_get_functiondef`): `create_/update_controlled_document` +`p_category/p_tags/p_description`; `publish_document` stamps the retired prior version `obsolete_kind='superseded'` + defaults `effective_date` from `proposed_effective_date`; `mark_document_obsolete` stamps `'retired'`; `submit_document_for_approval` persists proposed/approval dates + enqueues approver notifications.
- **New DEFINER read** `list_commission_documents(p_commission,…)` — `prosecdef=t`, flag- + commission-authority-gated (`is_member_of OR is_tenancy_admin_of` → empty deny), ACL `authenticated`/`service_role` only (no PUBLIC/anon); backs `listDocuments` with `hasOpenRevision` + approval signed/total counts (removes the FE N+1).
- **New public RPC** `remind_document_approver(p_version_id, p_approver_id)` — `prosecdef=t`, staff_admin-of-commission body-gated (42501), day-deduped, REVOKE-ALL-FROM-PUBLIC before GRANT.
- **Notifications (Phase-20 substrate):** CHECK supersets +kind `document_approval|document_review_due`, +entity `controlled_document_version|controlled_document`, +milestone `decided|published` (capa/signoff/meeting/action_item/ethics/charter preserved). Producers: submit→approvers, decision/publish→author, review-due scan arm (reuses `documents_due_for_review`) injected via the runtime-rewrite pattern.
- **Server actions** (`src/lib/documents/actions.ts`): chained `createAndSubmitDocument` / `createDraftOnly` / `supersedeAndSubmitDocument` (create/upload/attach/submit; partial-failure returns `documentId` for a detail-page banner) + `remindDocumentApprover`.
- **Gate:** tsc/lint 0 · Vitest 369 · pgTAP `201` 29/29 · tester E2E 25/25 · full `e2e:prod` triaged-green (0 redesign regressions; 8 reds all pre-existing/env) · qa **APPROVED**. Build fix `next.config.ts` `outputFileTracingRoot = process.cwd()` (worktree-nested standalone). Local-only; remote/Coolify deferred to the pilot.

## F2 — Centralized Attachments (2026-07-11; ADR 0063/0065, formerly phase-14e; migrations `20260717000000`–`…000500`; flag `attachments` OFF)

> ⛔ **DROPPED WHOLESALE by DM1** (`20260923000100`, 2026-08-12; ADR 0114 D5 — replace,
> don't remediate). **Nothing in this section is live** except the referral-owned
> surfaces on DM1's 7-item DM4 allowlist and the parked seam columns — see the **DM1**
> section for the live state, the drop inventory, and the successor model. Kept below as
> the historical record of what existed (and of the F-01/F-02/F-03 defect classes the
> replacement kills by construction).

The single attachment substrate that supersedes the per-module file tables (`case_documents`,
meeting attachments, interview file attachments). Ships **behind the `attachments` flag, seeded OFF**
(migration `…000500`; `seed.sql` enables it for local/E2E — F1 precedent); every write/open RPC asserts
the flag first, so the whole surface is inert in prod until the pilot flip. RLS is enabled on every new
table from creation regardless (Rule 1). **Local validation:** full pgTAP green (`208_attachments.sql`
50/50 incl. the interview-arm case-scoping keystone; full suite **1957** PASS), tsc + lint 0.
**Remote deploy DEFERRED to the pilot reset.** QA APPROVED (0 BLOCKER/0 MAJOR · 3 MINOR · 4 INFO;
[review](../reviews/phase-F2-review.md)); MINOR/INFO fast-follow cleared at Record.

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

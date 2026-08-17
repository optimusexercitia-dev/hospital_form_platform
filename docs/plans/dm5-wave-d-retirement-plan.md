# DM5 — Wave D + retirement: slice plan

> Executes the parent plan's **Phase DM5** (`docs/plans/document-model-redesign.md`)
> under the rulings in **ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)**.
> Evidence base: `docs/progress/dm5-surface-verification.md` (step 0, `005fe34d`).
> **Read ADR 0120 first** — this file adds only sequencing, ownership, windows and
> gate detail. Where the parent plan and ADR 0120 disagree, **0120 wins**: the parent
> text describes a system that does not exist in six named places.
>
> **Standing prerequisite:** `docs/progress/authz-handoff.md §7` before any RLS or
> DEFINER work. The live catalog — never migration text, never graphify — is truth.

## Allocations

| Resource | Allocation |
| --- | --- |
| Migration window | `20260927000100`+ (highest registered = `20260926000500`; **391 == 391** verified at step 0) |
| pgTAP suite | **`341`**, labels `DM5·<Slice><n>` |
| ADR | **0120** (this phase); ADR 0114 gains **Amendment 3** for the D3 invariant amendment |
| Feature flag | `documents_wave_d` — MIN pattern, first residue-producing step, home/arm-scoped (0120 D10) |
| Branch | `main` (DM4 landed there). ⛔ **No pushes, no `db push`** — the standing directive |

Per-slice sub-windows, so two slices never collide mid-phase:
~~`S1` `…000100–000199`~~ **(released — S1 withdrawn)** · `S2` `…000100–000299` ·
`S3` `…000300–000399` · `S4` `…000400–000499` · `S5`/`S6` `…000500`+.

## Slices

### S0 — retirement manifest capture + enumeration tool (backend) — **runs FIRST**

Non-destructive and independent of everything else, but it must precede any step that
truncates `storage.objects` (0120 D9). Deliverables: the manifest-first tool (capture
authoritative keys per bucket → delete by key → assert `deleted_count == manifest_count`),
the local volume walk as its **proof harness**, and a committed baseline manifest for all
**8** buckets (D8). ⚠ The tool is the **gate**; the volume walk is the **proof** — it
depends on `STORAGE_BACKEND=file` and does not transfer to Cloud. Record the Cloud
residual as **UNVERIFIED**, never as solved.
Also here: widen `scripts/document-reconciliation.mjs` past its 2-of-12-bucket coverage,
and prove the tool **able to fail** before trusting it — a detector that finds nothing must
be shown able to find something.

### ~~S1 — substrate amendment~~ ⛔ **WITHDRAWN 2026-08-14, never built**

ADR 0120 **D3/D4/D5 are struck**; **D11** replaces them and `document_version_files` is not
touched at all. The enabling capability was already built at DM2 (`reclassify_document` +
`complete_document_reclassification`), and DM2 had **already evaluated and rejected** the
partial-unique/guard-exception shape by name — *"an invariant edit for no additional honesty."*
Full reasoning and root cause: ADR 0120's withdrawal banner. **No ADR 0114 Amendment 3 is
needed; no DM1 invariant is amended.** Migration window `20260927000100–000199` is **released
back to S2**.

### S2 — Wave D pt.1: NSP RCA/CAPA evidence (backend + frontend)

D1 (`rca`, `capa_action`) · D2 (reporting-commission tenancy, custody as a read-time input) ·
D10 (flag). **Both seams, not one** — re-point `storage_path` onto `file_objects` *and*
un-park `cited_document_id`; they are independent (0120 Consequences). **Covers
`capa_action_evidence` too** — a migration scoped on `rca` delivers half the slice.
Discharges pgTAP `328` **K8b**. Kill `p_storage_path`'s caller-supplied path (the D8/D9
inversion). ⚠ The NSP hard exclusions must not become bypassable via document access —
mutation twin required, and the read arm must reproduce `can_read_event`'s custody
following, **not** a commission bound at upload time (step 0 named this the most likely
silent authz regression in DM5). ⚠ `nsp-evidence` has **four** policies in two pairs, with
the RCA insert reading `foldername[2]` and the RCA select `foldername[1]`.

### S3 — Wave D pt.2: printed renditions — ✅ **COMPLETE (all four gate steps, 2026-08-14)**

> **Delivered 2026-08-14.** 6 migrations `20260927000300`–`000350` + `af9a894e` (r1) · pgTAP **`342`** (59) ·
> fixtures rewritten in `312`/`313`/`323`. **`frontend` was never needed** — every TS signature stayed
> stable and D18 removed the only new surface, so no UI was built for this slice.
> Gate: registry **406==406** · pgTAP **193f/6348** · tsc 0 · lint 5/5 · vitest 1294 · four ARMs **HOLD** ·
> `e2e:prod` **1120p/0f/0 did-not-run/3 flaky** · print corridor **executed** (9/9 + 6/6, real `%PDF-`).
> ✅ **QA r1 = CHANGES REQUESTED → all discharged at `af9a894e` → r2 = APPROVED** (`801a2589`), every
> blocking item **re-proved by neutralization** (guard 4 deleted ⇒ `S3k2` RED / `S3f4` GREEN). Four ARMs
> **re-measured by the lead at `801a2589`** to close r2's one stated gap. PO closed the slice the same day.
> ⛔ **A slice verdict — DM5's phase QA is still owed at S6, and it authorizes no part of S4.**
> Full record: [dm5-wave-d-retirement.md](../progress/dm5-wave-d-retirement.md) · handoff §§9–11.

<details><summary>Original S3 plan (kept for provenance)</summary>

### S3 — Wave D pt.2: printed renditions (backend + frontend) — **no longer blocked**

D1 (`form_response`) · D6 (all four `source_kind` values) · D7 (`printed_documents` becomes
the satellite; `storage_path` and `pd_storage_path_derived` retire) · **D11 (the new-version
idiom)**: each print event mints a `document_version`, binds its bytes as that version's
`printed_pdf`, records supersession on `printed_documents`, and retires superseded bytes via
`file_objects.disposal_state`. **Zero schema change to `document_version_files`.**

**D12 (byte door, PO-ruled)** — `open_printed_document` keeps `can_view_printed_document`, the
revoked/superseded overlay, the token path and its `document.downloaded` audit, and **delegates
byte resolution to the core door**, because `open_document_version` hardcodes
`rendition_kind = 'source'` and D8 reserves the two document buckets for **one** signing door.
⚠ The shared resolver is **`app`-scoped, never `public`**, and effective authority is the
**conjunction** — keystone **both** refusals (print-check-pass / document-check-fail, and the
reverse). **D13 (lead)** — a print mints its version on its **own `documents` row**, homed on the
source's securable resource, **never appended to a content document**; otherwise
`add_referral_shared_item` freezes a printed PDF into a referral snapshot instead of source content.
**Keystone the separation itself.**

Two things D11 makes S3's job, carried from the S1 analysis:
- ⚠ **`src/lib/queries/documents.ts:116` and `:142` do `.find(b => b.rendition_kind === 'source')`.**
  A print document whose only binding is `printed_pdf` yields `latestFile === undefined`, so
  `containsPhi` and `availability` derive from a **missing source**. Real defect — handle it here.
  `documents.kind` has **no CHECK** (0 constraints), so it is available as a discriminator without
  a migration. Whether a generated print belongs in a case's Documentos panel is a **product
  question** — raise it, do not answer it in SQL.
- ⚠ **A print must be its OWN `documents` row**, homed on its source's securable resource. Five
  consumers read `version_number desc` as "latest", including `add_referral_shared_item`, which
  picks what to **freeze into a referral snapshot** — appending print versions to a *content*
  document would silently change what a referral freezes. Keystone the separation.

~~Production objects migrate **copy → verify → switch**.~~ ⛔ **SUPERSEDED by ADR 0120 D17 (PO,
2026-08-14): DM5 designs for a RESET remote.** Build the correct D7/D11/D13 shape directly; no
ceremony for pre-existing remote bytes. ⚠ **This is not "no data migration"** — a fresh reset still
produces `printed_documents` rows from the **seed** and from `312`/`313`/`323`, so the migration must
be correct against those and **the seed + those three fixtures are rewritten to the new shape in this
slice**. ⭐ **Do NOT add a convenience backfill:** with no backfill the create path is the only path,
so an untaught create path fails loudly instead of being masked — DM3's P0 exactly.

⚠ Every new column on `printed_documents` needs its own **column GRANT** or it reads `42501`.
⚠ pgTAP `312`/`313`/`323` insert **11** `storage.objects` rows for `printed-documents` with **0**
bucket rows (verified live 2026-08-14) — fix those fixtures here, before S4 can delete the bucket.

⚠ **Trap 3 was mis-enumerated and its failure mode mis-recorded — read the corrected version in
[dm5-handoff.md](../progress/dm5-handoff.md) §4 trap 3 before touching it.** Four
`.find(rendition_kind === 'source')` sites, not two; it **silently renders a fully-uploaded print as
`pending` / `canOpen: false` forever** rather than crashing; only `documents.ts` is reachable and
**D13 is what makes it so**. Fix the resolution seam and keystone the invariant — not the line numbers.

</details>

### S4 — retirement execution (backend) — ✅ **COMPLETE 2026-08-17: all FIVE gate steps**

> ✅ **CORRECTED 2026-08-17 (QA S5 INFO-1, lead's own defect).** This heading read *"steps 1 ✅ ·
> 2 ⛔ UNESTABLISHED · 3 r1 ⛔ (fixed, r2 owed) · 4 owed"* **after all four had closed.** S4's actual
> close: **step 2 GREEN at `e2e:prod` 1121p/0f/0 did-not-run/18 batches** · **step 3 QA APPROVED at
> r3** (r1 ⛔ → r2 ⛔ → r3 ✅) · **step 4 PO-approved** · **step 5 recorded** (`phase(DM5·S4)` =
> `f06ebea5`).
>
> ⛔ **Why this was more than an INFO: S6 reads THIS FILE.** A future S6 briefed from here would have
> been told S4's E2E figure was unestablished and its QA unfinished — the same defect shape as
> PROGRESS.md's S2 reopen banner, which briefed a teammate that a working slice was broken. **The
> status a slice closes with must be written into every file the NEXT slice reads, not only into the
> tracker.** I updated PROGRESS.md's three markers at step 5 and did not sweep the plan.
>
> ⚠ Still true and NOT relieved by S4's completion: **the byte half was a no-op and the deploy-time
> sequence is UNREHEARSED** (owned as S5.R, which has since run locally — see § S5.R and ADR 0120 D9's
> execution note, including the **fake-local-proof** correction).
>
> ✅ **STATUS 2026-08-17 — this section is now a PLAN RECORD, not a brief.** PO authorized on the day;
> migration `20260927000400` retired the 8 bucket rows + the last 4 policies. ⛔ **The byte half was a
> NO-OP** — every retirement byte was already a metadata-less orphan, so the D9 gate could not address
> one and `delete --execute` never ran; **the deploy-time sequence remains UNREHEARSED.** The fresh
> `capture` + `walk` this section demanded **were** run (they returned the `DEGENERATE BASELINE`
> verdict, which is the finding). ⚠ The 221 orphans were then destroyed **outside the gate** by a stack
> recovery. **Current state + resume recipe: [dm5-handoff.md](../progress/dm5-handoff.md) §11–§12.**

> ⛔ **IRREVERSIBLE. Do not start before S3 has an `APPROVED`** — S4 removes the buckets S3's corridor was
> proven against. Authorization gate, binding ordering, and the **corrected** remote premise (the CLI's
> reset/orphan line was **reverted**; verified absent at v2.105.0 with a positive control):
> [dm5-handoff.md](../progress/dm5-handoff.md) §11. ⚠ **The committed manifest baseline self-labels
> DEGENERATE and must not be reused as S4 input** — a fresh `capture` + `walk` is required and was not run.

D8 (**8** buckets) · D9 (manifest-first). Per bucket: prove zero DB references, zero product
callers, zero policies, then empty-by-manifest and delete via the **Storage API only** —
never `storage.objects` DML. All deletions batch here deliberately: **one** manifest,
nothing deleted early. `form-assets` and `meeting-audio` stay (ADR 0114 D13).

⚠ **D17 (reset remote) does NOT relax D9 — the ordering is binding and counter-intuitive:**
**delete-by-manifest through the Storage API FIRST, while `storage.objects` metadata still exists and
the keys are enumerable; only THEN reset.** A reset truncates the metadata and **leaves the bytes**
(measured: 0 rows vs 699 files / 7.0 MB / 198 PHI-tier), so a reset **creates** orphans rather than
clearing them, and reset-first would make retirement **unprovable**. **S0's manifest tool stays
load-bearing.** What D17 dissolves is only the **DB-row** half (FUP-DM4-PRODROW, the 4 dangling
attachment rows, the 3 unreferenced controlled-document objects). ⛔ Neither follow-up is CLOSED by
D17 — both move to *"close by the manifest-then-reset sequence at deploy"* and stay OPEN until it runs.

### S5 — operational closure (backend + lead)

Parent plan step 4: name the operational **owner and execution mechanism** (pg_cron /
scheduled job / manual runbook) for the disposal job and the reconciliation command; one
**backup/restore drill of DB + Storage together**; baseline `EXPLAIN` + latency for document
list / open / sign as the pilot's comparison point. Production-volume perf testing and staged
rollout stay deferred to the pilot (PO-accepted). O1/O2 values remain with the PO — S5 names
owners, it does not invent values.

#### ⛔ S5.D — the disposal job DOES NOT EXIST. PO ruled 2026-08-17: document the gap + a manual runbook.

**Step 0 finding, lead-verified** (`docs/progress/dm5-s5-surface-verification.md`): S5's parent scope
says *"name the operational owner and execution mechanism for the disposal job"* — **there is no
disposal job to name an owner for.** `public.complete_document_disposal` exists (`prosecdef = t`) but
its **only** production caller is `src/lib/documents/actions.ts:377`, inside `reclassifyDocument` — an
unrelated workflow. **Nothing reaches it** from `request_document_disposition` / `dispose_case_phi` /
`dispose_referral_phi`. Nothing is scheduled anywhere: `pg_cron` is **not installed** (it *is* in
`shared_preload_libraries`, so one `CREATE EXTENSION` away), no cron schema, no CI cron.

⛔ **And `src/lib/documents/actions.ts:277-278` asserts the opposite in the PRESENT TENSE** — *"the
disposal job + service-only completion door do the verified deletion."* Fifth instance of this class in
DM5 and **the first in live source rather than a record.**

⭐ **The precedent that had to be found, and the reason it does not settle it.** ADR **0099 D10** is an
already-shipped, PO-ratified **"No new cron infrastructure"** decision for exactly this class:
*"Rejected: pg_cron sweeper — a stale row nobody is looking at harms nobody until they look."* It is
cited **nowhere** in this plan, and step 0's section F found it. **But its rationale inverts here:** a
stale audio row harms nobody; a `disposal_pending` row that never completes means **PHI bytes that
should have been destroyed still exist**, under LGPD / ANVISA / CFM 1821. ADR 0099 itself anticipates
this (`:218-227`) and says *"recordings are case-PHI — that last one alone should force the cron
conversation."*

**PO ruling — S5.D delivers, in this order:**
1. A **manual runbook** for disposal + reconciliation, with a **named human owner** and a stated
   **periodicity**. ⚠ Owner and periodicity are **values**: propose them, flag them, do **not** invent
   them silently — the same rule that keeps O1/O2 with the PO.
2. **Correct the false present-tense comment**, and ⭐ **encode the gap EXECUTABLY rather than as
   prose** — this phase's own lesson is that a comment is an assertion that goes stale silently. A
   pgTAP keystone asserting the gap (no wiring from the disposition path to the completion door) goes
   **RED the day someone builds the job**, forcing the runbook and the follow-up to be revisited.
   *A gap documented only in prose is a gap that will be documented wrongly later.*
3. File the **automated** job as a **🔴 BLOCKING pre-pilot follow-up** — not a nice-to-have. It carries
   ADR 0099 D10's tension and will need its own ADR to overturn it.

⛔ **What S5.D does NOT do:** build the completion path, install `pg_cron`, or stand up a second
execution context with service-role reach. Those were the rejected options and the rejection is
recorded so the next reader knows it was a choice. **DM5 therefore exits with a KNOWN,
runbook-mitigated PHI-disposal gap** — that is the accepted consequence, and it must appear in S6's
canon sweep and in the pilot gate, never only here.

#### S5.R — REHEARSE the deploy-time byte path (PO-directed 2026-08-17)

**Why it is here.** S4 retired the eight bucket rows, but its byte half was a **NO-OP**: every
retirement byte was a metadata-less orphan, so `delete --execute` never ran. The sequence's
correctness rests entirely on S0's 8/8 self-test — controls the tool runs against *itself* — and
on **no execution against real bytes at all**. Production is where it matters, because production
**has metadata rows** (45 objects at the 2026-08-11 census).

⭐ **Rehearse the WITH-METADATA path specifically.** S4's no-op was not incidental: metadata-less
orphans are the one condition under which the manifest sequence has nothing to do, because the
Storage API lists *from* `storage.objects`. Production takes the opposite path. **A rehearsal that
reproduces S4's conditions would re-prove the no-op and read as coverage** — the phase's own
vacuity class, applied to its own deploy runbook.

⛔ **It cannot be run on the retired scope** (QA r1 MINOR-5): post-migration `capture` returns
`BUCKET_ABSENT` for all eight, and they now hold **0 bytes** — measured 2026-08-17. The rehearsal
needs a scope it can populate: a purpose-made disposable bucket, created, populated **through the
Storage API so the rows exist**, and disposed by the real sequence. ⛔ **Never the four
survivors** — their bytes back the seed and ~900 E2E tests.

**The sequence, end to end, in order:** capture manifest → compare → `delete --execute` →
re-capture → verify empty → and D9's ordering property, that the retirement migration still
**refuses** a bucket holding `storage.objects` rows.

**Acceptance — each proven able to FAIL, never merely observed passing:**
1. `delete --execute` removes exactly the manifest's keys from a **populated** bucket **with
   metadata rows**, and the re-capture reads empty.
2. A **manufactured extra orphan** — a key on the volume absent from the manifest — is FOUND.
3. A **deliberate count mismatch** is REFUSED: the run aborts rather than reporting success over
   surviving files. (This is the control that did not exist when 221 files died.)
4. The retirement guard REFUSES while any `storage.objects` row survives and admits only after —
   S4 pinned this at the catalog layer; here it runs against real rows.

✅ **The platform-guard question is SETTLED for this path — measured at QA r2, not reasoned.** This
note said the rehearsal *"plausibly never meets"* `storage.protect_delete`; *plausibly* is now
*confirmed*, and in the process the surrounding claim turned out to be **inverted** (r2 MAJOR-3).
`protect_delete()` is **role-agnostic** — it tests only `storage.allow_delete_query` — and **the
Storage API sets that GUC itself**, so on the API path the trigger **never fires, for any caller**
(its exception **message** ends *"Use the Storage API instead."* — corroboration only, and the HINT is
a different string; QA r3 MINOR-10). It guards **direct SQL DML only**, which is exactly
the context migration `20260927000400` needs it for.

⭐ **What that means for S5.R specifically, and it is not a footnote:** the rehearsal's deletes run
through the API, so **nothing platform-level will stop them.** The only things standing between
`delete --execute` and a byte are the manifest comparison and the tool's own refusals — the controls
S5.R exists to test. There is no backstop underneath them. **The two mechanisms, named so nobody
re-litigates this** (QA r3): `scripts/storage-manifest.mjs:131` authenticates with
**`SUPABASE_SERVICE_ROLE_KEY`**, and `service_role` carries **`rolbypassrls = true`** (`pg_roles`;
`authenticated` and `anon` are `false`). So the trigger is bypassed *and* RLS is bypassed — **both**
locks off, by design, for the one caller that runs the disposal. (Correspondingly, on the API path the
operative Rule-6 lock for `documents-standard`/`-phi` is the pair of **absent SELECT and DELETE
policies**, both ours; `storage.objects` grants `arwdDxtm` to `authenticated` *and* `anon`, so there
is no grant-level fallback either.) ⚠ Domain: LOCAL stack. **Re-probe before the Cloud run** — D17's
whole lesson is that local was reasoned to remote by *"the same mechanism class"* and the mechanisms
differed.

⛔ **A green local rehearsal does NOT license the Cloud sequence.** D17's remote half was wrong
precisely because local was reasoned to remote by *"the same mechanism class"*, and the mechanisms
differed ([cli#3083](https://github.com/supabase/cli/pull/3083) / reverted
[#3359](https://github.com/supabase/cli/pull/3359)). State the domain the rehearsal covers.
**FUP-DM5-STORAGE-ORPHANS' Cloud half stays OPEN until something runs there**, and
FUP-DM5-STACK-CYCLE-DESTROYS-BYTES is not discharged by this either — S5.R governs the
*deliberate* path; the accidental one remains ungoverned.

### S6 — canon rewrite + program exit sweep (lead + backend)

ARCHITECTURE.md §2 + Rule updates: the D8 Rule-1 sharpening **and** — the obligation that
must not be lost (QA r1 INFO-4) — **Rule 9's missing documents-module exception**, scoped to
the coordinate-resolving module. Rule 9 as written admits no exception, so today the rule and
the QA-accepted practice contradict. Plus `docs/backend-state.md` document-surface rewrite
(⚠ `:205` still says census **146**; the reproducing figure is **141** — fix with the query
beside it), PHASES/PROGRESS record + rotation.

**Exit sweep by IDENTIFIER** — `storage_path`, `storage_bucket`, bucket string literals,
`createSignedUrl` — never by directory alone. ⚠ And never by **call syntax**: step 0 caught a
sub-agent's `.rpc('X')` sweep reporting zero call sites for `mint_printed_document`, which is
real at `src/lib/pdf-mint/actions.ts:283-284` and merely line-wrapped past the regex. Grep the
identifier.

## Assurance plan — read before writing a keystone

DM5's assurance position is **worse than DM4's**. Every door it adds or modifies sits in a
census blind class, so `ARM=census`/`hat`/`floor`/`wrapper` all pass **regardless of what is
built**. Consequences that bind:

- Bespoke pgTAP keystones + mutation twins are **mandatory**, not a fallback.
- **Neutralize each lock independently.** A keystone against the un-parked `add_rca_evidence`
  **goes green on its first run** — the table CHECK `rca_evidence_cited_document_parked` still
  refuses, so a *sibling* lock satisfies the assertion. Red-first here means removing the
  right lock.
- Every **new** door joins the census domain **and** the committed findings file in the same
  phase — a new wrapper passes `ARM=wrapper` vacuously by absence (ADR 0079 Am. 7).
- The diff-scoped write-path `ARM=policy` step is a **no-op outside its hardcoded worklist** —
  check its reported case count is nonzero for DM5's new doors before citing it.
- The phase record **names the arm, not the script**.
- **FUP-PGTAP-VACUOUS applies directly**: `lint:vacuous` does not scan SQL, and every DM5
  keystone is SQL. Each slice carries a positive control for its own assertions.

## Gate (CLAUDE.md §6)

Fresh `supabase db reset` → `npm run test:db`, lint 5/5, typecheck, vitest, `next build`;
`ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper`; the **diff-scoped** door sweep
over exactly the policies and `prosecdef` gates DM5 touched, derived from the migration diff
and never by hand. **BLIND blocks the phase**; `ERROR` is not a pass. Then tester (full
`e2e:prod` green via the batched gate), QA review, PO approval, Record step + rotation.

## Ownership

Backend owns every migration, Storage policy, signer route, audit union and generated type —
never split. Frontend owns `src/app` + `src/components` for the S2/S3 surfaces. **Contract-first:**
backend posts typed signatures for S2 and S3 before implementing them, so frontend builds
against real types instead of a provisional shape. DM2 found **10 gaps** that way, three of
them visible regressions.

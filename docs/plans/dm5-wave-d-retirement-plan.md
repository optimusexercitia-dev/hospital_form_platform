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

### S4 — retirement execution (backend) — needs S2 + S3

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

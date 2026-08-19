# DM5 · S5 — Step 0 surface verification

> Verify-only pass, no build. Run 2026-08-17 against local HEAD `fe3ecf9b`, local Supabase
> stack `supabase_db_azkbbhskturikxpgmafq` (Docker, healthy). Every schema/RLS/RPC/trigger/
> extension claim below is a live-catalog query against that container, not a migration read.
> Script behavior claims are backed by either (a) reading the exact source (these are plain
> Node `.mjs` files with no runtime-rewrite mechanism — unlike this repo's SQL, what's on disk
> is what ran) or (b) actually running the script's non-destructive/scratch-scoped commands
> live, both stated per-claim. **No destructive command was run.** Commands executed:
> `storage-manifest.mjs walk`, `storage-manifest.mjs capture --out <scratchpad>`,
> `storage-manifest.mjs selftest`, `supabase db dump --local --dry-run`, `supabase db/backups/
> storage --help`, plus read-only `psql` queries. `git status --short` was clean before and
> after every step (verified). `document-reconciliation.mjs` was **not executed live** — it
> performs real UPDATEs as an intrinsic part of its run (expiry/stuck-verifying sweeps), which
> is a behaviour change outside this step's mandate; it was verified by reading 100% of its
> source instead.

## A · The manifest tool (`scripts/storage-manifest.mjs`)

**Subcommands (CONFIRMED, live catalog of the file — `scripts/storage-manifest.mjs:812-832`):**
`capture` · `verify` · `walk` · `delete` · `selftest`. Anything else (including no argument)
prints the file's own header doc-comment and exits 2 (or 0 for no-arg) — there is no `--help`
flag distinct from this.

**Flag surface per subcommand (CONFIRMED, read from `argFlag()` call sites):**

> ⚠ **`capture`'s row is HISTORY as of 2026-08-19 — ADR
> [0128](../decisions/0128-unproven-is-not-clean-capture-outcome-classes.md).** `--allow-orphans`
> is **retired and refused** (exit 2); `capture` now takes **`--allow-unproven`** and
> **`--allow-dirty`**, and gained exit code **3 (UNPROVEN)**. The rest of this table stands.
> This record is not rewritten — it is what was measured on its date.

| subcommand | flags | default when omitted |
| --- | --- | --- |
| `capture` | `--out <path>`, `--buckets <csv>`, `--allow-orphans` | `--out` → `DEFAULT_MANIFEST = 'supabase/manifests/dm5-retirement-baseline.json'` (the **committed** S0/S4 baseline); `--buckets` → the 8 `RETIREMENT_BUCKETS` |
| `verify` | `--manifest <path>` | `DEFAULT_MANIFEST` |
| `walk` | `--buckets <csv>` | `ALL_KNOWN_BUCKETS` (12, incl. the 8 retired + 2 core + 2 out-of-scope) |
| `delete` | `--manifest <path>`, `--execute` | `DEFAULT_MANIFEST`; dry-run unless `--execute` |
| `selftest` | none | — |

**FUP-DM5-MANIFEST-FLAG footgun — CONFIRMED STILL PRESENT**, verified by reading the exact
code, deliberately **not** reproduced live against the real default path (that would repeat
the exact incident the follow-up describes against a real tracked file; the mechanism is
plain, non-rewritten JS, so reading it is conclusive without re-running it):

```js
// scripts/storage-manifest.mjs:807-810
function argFlag(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
// :355 — cmdCapture
const outPath = argFlag(argv, '--out') ?? DEFAULT_MANIFEST
```

There is **no unknown-flag rejection anywhere in the file** — `capture --manifest <x>` still
silently resolves `argFlag(argv, '--out')` to `undefined` and falls through to
`DEFAULT_MANIFEST`, i.e. the **committed baseline path**, exactly as the follow-up describes.
Not fixed. `git status --short` was clean throughout this session, confirming nothing here
touched that file.

**Authentication (CONFIRMED, live):** `SUPABASE_SERVICE_ROLE_KEY` +
`NEXT_PUBLIC_SUPABASE_URL`, loaded from `.env.local` if present (`scripts/storage-manifest.mjs:120-137`).
Both keys are present by name in `.env.local` (values not read). Independently re-verified
against `pg_roles` (not just trusted from the plan text):

```
 rolname       | rolbypassrls | rolsuper | rolcanlogin
 service_role  | t            | f        | f
 authenticated | f            | f        | f
 anon          | f            | f        | f
```

`service_role` bypasses RLS; it is not a superuser. This is the same credential
`document-reconciliation.mjs` uses (identical `loadEnvLocal`/`adminClient` shape).

**Self-test controls — CONFIRMED live, 2026-08-17, `node scripts/storage-manifest.mjs selftest`:**

```
8/8 controls passed
✅ SELFTEST PASSED — the tool detects a known orphan and refuses a deliberate mismatch.
EXIT CODE: 0
```

Current state is **8/8** (C1, C8, C2, C3, C4, C5, C6, C7 — C8 is ordered before C2 in
execution, numbered after because it was added later as the "permissive twin"; run live, not
inferred from a stale count). What each proves, read from the assertions:

| control | proves |
| --- | --- |
| C1 | the enumerator is depth-agnostic (finds keys at 4 different nesting depths) |
| C8 | `delete --execute` **accepts** a manifest that matches reality — exits 0, empties cleanly (the positive twin; without it C2 alone would pass a tool that refuses everything) |
| C2 | `delete --execute` **refuses** a manifest whose count exceeds reality (COUNT MISMATCH, exit 1) |
| C3 | the Storage API is blind to a byte-side-only orphan (reports 0 keys while bytes exist) — the premise the whole tool exists to work around |
| C4 | the volume `walk` **finds** the orphan the API cannot see (positive control on the proof harness) |
| C5 | `walk` distinguishes ABSENT (no directory) from EMPTY (directory, 0 files) — the historical bug the tool's own comments say was caught on its first run |
| C6 | `verdictFor()` labels a manufactured orphan `ORPHANED_BYTES`, not `CONSISTENT_EMPTY` |
| C7 | `verdictFor()` is not a constant — also returns `CONSISTENT` on agreeing inputs |

**`capture` verdicts per bucket state (CONFIRMED, both by reading `verdictFor()` and by a live
run today):**

```
node scripts/storage-manifest.mjs capture --out <scratchpad>/s5-step0-capture.json
→ all 8 retirement buckets: exists=false, api_keys=0, vol_keys=—, verdict=BUCKET_ABSENT
→ TOTAL api_keys=0 orphan_keys=0 (PHI-tier 0)
→ CAPTURE CLEAN, exit 0
```

- **Bucket row absent** (`storage.buckets` has no row) → `verdictFor` returns `BUCKET_ABSENT`
  **unconditionally**, on the very first line, before it ever looks at the volume proof.
- **Bucket present, genuinely empty** (row exists, no directory or an empty directory on the
  volume) → `CONSISTENT_EMPTY`.
- **Bucket present, no local proof available** (e.g. Cloud, `STORAGE_BACKEND≠file`) →
  `UNVERIFIED_NO_LOCAL_PROOF`.
- **Bucket present, populated, API and volume agree** → `CONSISTENT`.
- **Populated, volume has keys the API doesn't** → `ORPHANED_BYTES`.
- **Populated, API has keys the volume doesn't** (only measurable with local proof) →
  `MISSING_BYTES`; both directions → `DIVERGED_BOTH_WAYS`.
- Separately, at the **manifest level** (not per-bucket), `cmdCapture` adds a residual line
  `DEGENERATE BASELINE: …` when `totals.keys === 0 && totals.orphanKeys > 0` — the "API sees
  nothing, volume shows bytes" whole-manifest state. This is the verdict the historical S4
  capture returned.

⚠ **A precision finding not previously written down anywhere I found (source-derived; no
live specimen exists right now to observe it, see "Could not verify"):** `BUCKET_ABSENT`'s
unconditional early return means **`capture`'s exit code and "CAPTURE CLEAN" headline do not
reflect volume-side orphans for a bucket whose row is gone** — `CLEAN_VERDICTS` includes
`BUCKET_ABSENT`, so a bucket with `exists=false` never enters `dirty`, regardless of what the
volume proof shows for it. The bytes are **not silently lost from the artifact** —
`orphanKeys` is still computed per-bucket independent of the verdict and still feeds
`manifest.totals.orphanKeys`, which still triggers the residuals-array warning text — but that
warning affects neither the exit code nor the "CAPTURE CLEAN"/"CAPTURE NOT CLEAN" headline.
Anyone gating automation on exit code or the headline alone, rather than reading
`manifest.residuals`, would not learn about this class. It is the same shape as
FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT's point 2 ("an orphaned bucket satisfies 'no
rows' perfectly") but specific to this tool's own success signal, one layer more precise. The
self-test has **no control for this state** (row absent + bytes present) — C3/C4/C6 all use an
**existing** scratch bucket; none drop the bucket row first. Not a live bug today (no bucket
is currently in this state — retirement's own volume directories are confirmed absent, see
below), and not necessarily worth fixing given S5.R will not create this state either
(the rehearsal's scratch bucket exists throughout). Recorded because S5 should know the
signal it's trusting has this blind spot before relying on `capture`'s exit code as a gate.

**Whether a purpose-made disposable bucket is createable/usable — CONFIRMED usable, with a
gap.** `selftest` itself creates one every run (`admin.storage.createBucket(bucket, {public:
false})`, `scripts/storage-manifest.mjs:650`) and destroys it in a `finally` block — proof the
underlying capability works end-to-end, live, today (the 8/8 run above). **But none of the
five subcommands exposes bucket creation or deletion as a first-class verb** — `create` is not
a subcommand. Whoever runs S5.R needs either (a) a ~5-line one-off script reusing
`admin.storage.createBucket()`/`deleteBucket()` exactly as `selftest` does internally, or (b)
the `supabase storage` CLI (`ls`/`cp`/`mv`/`rm` only — also no `create-bucket` verb; bucket
creation there is implicit via `cp` or must go through the dashboard/SQL), or (c) a raw
`insert into storage.buckets` (works, but bypasses the Storage API path S5.R specifically
exists to exercise, so it is the wrong choice here). **This is a real, small gap**: nothing in
`scripts/` currently hands S5.R a ready-made "stand up a scratch bucket via the API" command;
it would have to borrow `selftest`'s own code.

## B · The reconciliation command (`scripts/document-reconciliation.mjs`)

**Interface (CONFIRMED, read in full):** no subcommands, no CLI flags at all —
`node scripts/document-reconciliation.mjs`. Same env contract as the manifest tool
(`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`), same
`service_role` authentication (bypasses RLS, not superuser — see A). Exit 0 clean / 1 drift /
2 error; prints the full report as JSON to stdout plus a one-line verdict.

**What it compares (CONFIRMED by reading the classifier, `:267-328`):** `public.file_objects`
rows against Storage-API listings of the **2 core buckets** (`documents-standard`,
`documents-phi`), in both directions, via a first-match classifier over
`(upload_state, disposal_state)`: `bytes-required` / `absence-required` / `indeterminate`
(`reserved`, `disposal_pending`) / `terminal` (`failed`/`abandoned`/`infected`/`rejected`) /
`unclassified`. Reports: `missing` (bytes-required, no object), `missingDelete` (disposed row,
object still there), `undisposed` (terminal row still holding bytes — PHI retention concern),
`unclassified`, and `orphans` (object no judged row accounts for). **Also performs real
mutations as an intrinsic part of the run** — not opt-in, not a flag: it expires lapsed
`reserved` upload_sessions → `expired` and marks their `file_objects.upload_state` →
`abandoned`; it marks `file_objects` stuck in `verifying` for >60 min → `failed`. It never
writes `disposal_state`. This is why it was **not executed live** in this verification.

**Widened past 2-of-12 — CONFIRMED, already done** (S0 called for this and it shipped):
`:366-387` adds a `legacyCensus`/`legacyResidue` pass over the 8 retired + 2 out-of-scope
buckets — object-count-only (no `file_objects` join possible, they have none), explicitly
documented as Storage-API-only and therefore blind to volume orphans. Tolerant of an absent
bucket (`try/catch` records `{absent: true}`, matching the ABSENT-vs-EMPTY discipline).

**Coverage gap — CONFIRMED by reading the classifier, and this is a binding S5 input
(FUP-DM5-FINALIZE-ATOMIC).** The classifier reasons **only** from `file_objects` columns
(`id, storage_bucket, storage_path, upload_state, disposal_state` — the exact `.select()` at
`:254`). It has no join to `document_version_files`, `document_versions`,
`rca_evidence`/`capa_action_evidence`, or anything else in the domain layer. A `file_object`
that is fully verified, servable, and has bytes — the exact shape FUP-DM5-FINALIZE-ATOMIC
describes (finalize's steps 1–3 committed, step 4 failed, no evidence row) — classifies as
`bytes-required` with `hasObject: true` and produces **no finding at all**. Confirmed by
reading the classifier's branches directly, not by re-quoting the follow-up.

**A second, previously-unfiled instance of the same shape, found this session:** the
classifier treats `disposal_state === 'disposal_pending'` as `indeterminate` — permanently
accounted, never drift (`:286`, `:26-31` header comment: *"a stuck pending row is
disposal-job latency, not an accounting hole — **the completion door is its owner**"*). That
comment assumes an operational owner exists to eventually call the completion door. Section C
below establishes that, for the general disposal path, nothing currently does. So a
`file_object` stuck in `disposal_pending` — bytes still present, nothing scheduled to remove
them — is **invisible to this reconciliation command by explicit design**, on a premise
Section C shows is not currently true. Same defect shape as the FINALIZE-ATOMIC class: *the
reconciler's domain is narrower than the drift it is trusted to rule out*, one state further
along the same lifecycle.

**Live corroboration this session (derived from two independent live reads, not from
executing the script — see the header note on why it wasn't run):**
`public.file_objects` currently has **0 rows** (`select count(*) …` → `0`); `storage.objects`
also has **0 rows** across all 4 surviving buckets; the volume `walk` found **245 files /
2,456,666 bytes** in `documents-standard` (156) + `documents-phi` (68) + `form-assets` (12) +
`meeting-audio` (9). Combining these (both independently measured, not the script's own
output): `document-reconciliation.mjs`, if run right now, would list via the Storage API
(which lists from `storage.objects`) and see **zero objects in the two core buckets** — so it
would report **`RECONCILIATION CLEAN`** despite 224 real files (156+68) sitting on the volume
under `documents-standard`/`documents-phi` with no metadata row at all. This is a fresh,
current reproduction of FUP-DM5-STORAGE-ORPHANS' exact shape, now specifically against this
script rather than the manifest tool, and against today's post-reset state rather than a
historical one. (Marked as a *derived* conclusion, not directly observed, because the script
itself was not executed.)

## C · The disposal job — what exists to schedule

**Disposal-related doors, enumerated from `pg_proc` by `proname ilike '%dispos%'` (CONFIRMED
live, 8 hits — bounded by substring on the actual word used throughout this codebase's own
naming, cross-checked against a `prosrc ilike '%disposal_state%'` sweep below to catch
anything spelled differently):**

| function | schema | `prosecdef` | EXECUTE granted to | what it actually does |
| --- | --- | --- | --- | --- |
| `dispose_case_phi(case_id, reason)` | public | t | `authenticated` | deletes/redacts a **case's** structured PHI + narrative/interview free text; marks PHI-tier bound `file_objects` → `disposal_pending` |
| `dispose_referral_phi(referral_id, reason)` | public | t | `authenticated` | same shape for a **referral** — deletes `referral_patient`, redacts messages/notes, tombstones frozen document bindings, marks bound `file_objects` → `disposal_pending`. **Exists — the memory note recording it as still-open is stale; resolve the value, not the noun.** |
| `dispose_event_phi(event_id, reason)` | public | t | `authenticated` | deletes `event_patient`, redacts RCA/CAPA free text. **Touches no `file_objects` row at all** — a different mechanism class from the two above, structured/free-text only |
| `dispose_meeting_minutes(meeting_id, reason)` | public | t | `authenticated` | redacts `meetings.minutes_md` + agenda text. Also touches no `file_objects` |
| `request_document_disposition(document_id, reason)` | public | t | `authenticated` | the **generic** document path: `app.can_write_document` gate → `documents.status='disposal_pending'` + every bound `file_objects.disposal_state` → `disposal_pending`. Refuses if an `active` print exists or a legal hold is open |
| `complete_document_disposal(file_object_id)` | public | t | **`postgres`, `service_role` only — NOT `authenticated`** | the completion step: requires `disposal_state='disposal_pending'` AND verifies the Storage object is **already absent**, then sets `disposed`; if every file of the document is disposed, marks the document `disposed` |
| `can_dispose_referral_phi(referral_id)` | public | t (STABLE) | `authenticated` | predicate helper only |
| `triage_disposition(event_id)` | public | t (STABLE) | `authenticated` | **false-friend by substring**: this is clinical triage *disposition* (verdict/pathway), unrelated to byte/PHI disposal — the "dispos" match is a different sense of the word entirely |

`prosrc ilike '%disposal_state%'` (a second, independent sweep bounding by the actual column
touched rather than the function name) surfaces the same core set plus the trigger below and
confirms nothing with a different name also writes this column.

**`file_objects.disposal_state` (CONFIRMED live):** `text not null default 'none'`, CHECK
`disposal_state = ANY (ARRAY['none','disposal_pending','disposed'])`. **What transitions it:**
the `BEFORE INSERT OR UPDATE` trigger `app.guard_file_object_transition()` (DEFINER, enabled)
enforces the state machine `none → disposal_pending → {disposed, none}` and blocks entry into
either disposal state while an unreleased `document_legal_holds` row exists on any document
the file is bound to — but the **trigger only validates transitions it is handed; it never
initiates one.** The only statements that actually write `disposal_pending` are
`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi` (all above); the
only statement that writes `disposed` is `complete_document_disposal`.

**Is anything currently scheduled at all — CONFIRMED: NO, on every mechanism checked, local
stack:**
- `pg_extension`: **`pg_cron` is NOT installed** (`pg_available_extensions` shows
  `default_version 1.6.4`, `installed_version` empty — available, never `CREATE EXTENSION`'d).
  `pg_net` **is** installed (0.20.3) but grep of every function body and every migration under
  `supabase/` for `net.http_` / `pg_net` turns up only the extension's own creation — nothing
  calls it.
- `cron` schema does not exist (`select nspname from pg_namespace where nspname='cron'` → 0
  rows) and `to_regclass('cron.job')` → NULL. No cron job of any kind can exist without it.
- `shared_preload_libraries` (live, `SHOW`) **does include `pg_cron`** alongside
  `pg_stat_statements, pgaudit, plpgsql, plpgsql_check, pg_net, pgsodium, auto_explain,
  pg_tle, plan_filter, supabase_vault` — so enabling it locally is a single
  `CREATE EXTENSION pg_cron;` away, no Postgres restart/image change needed. This is new,
  concrete information: turning it on is cheap, which matters for weighing the option, even
  though the platform has a documented reason it chose not to for the nearest precedent (next
  section).
- No `.github/workflows/` directory exists — no CI-cron path either.
- `Dockerfile` runs a single process (`CMD ["node", "server.js"]`) with a health-check probe —
  no cron daemon, no supervisor, no sidecar.
- `docs/deployment/coolify.md` documents no scheduled task for this project (grepped for
  scheduled/cron/periodic — 0 hits); Coolify itself can run scheduled commands against a
  deployed service, but that is a platform capability, not something this repo has configured
  or documented, so I am not counting it as an existing surface.

**⚠ The load-bearing finding for this section — a comment asserting a mechanism that does not
exist.** `src/lib/documents/actions.ts:277-278`, directly above `requestDocumentDisposition`:

> *"Requests disposition (D10): reads fail closed immediately; **the disposal job** +
> service-only completion door do the verified deletion."*

Exhaustive grep for `complete_document_disposal` across `src/` (the only RPC that can move a
file to `disposed`, and its ACL confirms it is meant to be called by something with
service-role reach, not a user request) finds **exactly one call site**:
`src/lib/documents/actions.ts:377`, inside `reclassifyDocument`'s "RETIRE-SOURCE" step — a
different, narrower workflow (copy-to-new-tier-then-retire-the-old-copy) than the generic
disposition request the comment sits beside. **Nothing calls `complete_document_disposal` for
the `request_document_disposition`/`dispose_case_phi`/`dispose_referral_phi` path.** A file
marked `disposal_pending` by any of those three has no code path that (a) deletes its Storage
object via the API, then (b) completes the disposal — both steps are currently manual/absent
for the general case. **"The disposal job" the comment describes does not exist yet** — it is
forward-referencing prose for something S5/a later phase is meant to build, written in the
present tense. This is the same class as this project's own recorded lesson that a comment is
an assertion that goes stale silently — here it may never have been true, rather than having
gone stale, but the effect on a reader is identical. `document-reconciliation.mjs`'s own
header comment makes the same assumption about `disposal_pending` (Section B above).

**Practical implication, checked against current data:** `file_objects` has 0 rows locally
right now (fresh reset), so there is no live `disposal_pending` specimen to point at — this
finding is from exhaustively reading the call graph, not from an observed stuck row.

## D · Backup/restore drill surface

**DB half — a real, locally-testable mechanism exists (CONFIRMED live):**
`supabase db dump --local` (there is also `--linked`, `--db-url`, `--dry-run`). Ran
`--dry-run` live; it printed a real, standard `pg_dump`-based script targeting
`PGHOST=127.0.0.1 PGPORT=54322` (the local stack), with schema/data flags documented in its
own `--help`. Restore is the standard `psql`/`pg_restore` replay of that dump, or
`supabase db reset` + replay — ordinary Postgres semantics, no custom tooling needed.
Separately, `supabase backups list`/`restore` manage **Cloud physical backups / PITR** — real
CLI subcommands (confirmed via `--help`), but invoking them requires the linked project,
which is out of scope for this pass (the standing no-remote-touch directive) and therefore
**UNDETERMINED** whether PITR is actually enabled for this specific project/plan.

**Storage half — no project-level tooling exists at all (CONFIRMED by exhausting the
options):** `supabase storage --help` exposes only `ls` / `cp` / `mv` / `rm` — object-level
operations, no bulk backup/snapshot/restore verb, and no `create-bucket`. The only two ways to
get the bytes out in bulk are (a) script a recursive `cp`/download loop over every bucket
(portable to Cloud, since it rides the Storage API, but nothing in this repo does it today),
or (b) a raw Docker-volume-level snapshot of `supabase_storage_azkbbhskturikxpgmafq`
(confirmed present via `docker volume ls`, alongside `supabase_db_azkbbhskturikxpgmafq` for
Postgres data and `supabase_edge_runtime_azkbbhskturikxpgmafq`) — generic, **LOCAL-ONLY**,
Supabase-unaware, and (per D9/the walk above) would capture whatever orphans happen to be
sitting there too, not a clean "the buckets" snapshot.

**What "restore" would mean for the byte half, locally:** there is no supported "restore
Storage" operation distinct from re-populating buckets object-by-object (option a above) or
restoring a whole Docker volume wholesale (option b — an operation of last resort: it restores
everything on the volume including any orphans present at snapshot time, and per
FUP-DM5-STACK-CYCLE-DESTROYS-BYTES a `supabase stop`/`start` can itself **destroy** this exact
volume as a side effect of unrelated recovery — so the drill's DB half and Storage half are
not symmetric: the DB half has first-class tooling, the byte half does not, and the mechanism
most likely to be exercised during an actual incident (a stack-cycle recovery) is the one
already shown to be destructive rather than protective.

## E · EXPLAIN/latency baseline targets — document list / open / sign

Real call paths, catalog- and source-confirmed, not a hand-written proxy:

| action | TS entry point | underlying query / RPC |
| --- | --- | --- |
| **list** (per-resource Documents panel) | `listDocumentsForResource()` — `src/lib/queries/documents.ts:234`; imported by `src/components/documents/documents-panel.tsx` and `src/components/cases/case-documents-panel.tsx` | direct `.from('documents').select(LIST_SELECT).eq('home_resource_id', …)` |
| **list** (Controlled Documents register) | `listDocuments()` — `src/lib/queries/controlled-documents.ts:305` | RPC `list_commission_documents(p_commission uuid)` (CONFIRMED in `pg_proc`, DEFINER) |
| **open** (detail projection) | `getDocument()` — `src/lib/queries/controlled-documents.ts:360` | direct `.from('controlled_documents').select(DOCUMENT_SELECT)` (CONFIRMED: `controlled_documents` is an ordinary table, `relkind='r'`) |
| **open** (bytes, core documents) | `openDocumentVersion()` — `src/lib/documents/actions.ts:226` | RPC `open_document_version(p_document_version_id uuid)` (CONFIRMED `public`, DEFINER, `authenticated` EXECUTE) → then `admin.storage.from(bucket).createSignedUrl(path, ttl)` |
| **open** (bytes, printed renditions) | (RCA/CAPA/case evidence panels funnel through the same core door — see `nsp-evidence.ts` header) | RPC `open_printed_document(p_id uuid)` → delegates byte resolution to `app.resolve_document_version_bytes(document_version_id, 'printed_pdf', uid)` (CONFIRMED by reading the live function body: the delegation the plan's D12 describes is real, not aspirational) |
| **sign** | same as "open (bytes)" above — signing is fused into the open door, not a separate step | `createSignedUrl` is the identifier; TTLs are tier-keyed (`SIGNED_URL_TTL_SECONDS`, documented elsewhere as PHI 120 s / standard 300 s, ADR 0114 O4) |

⚠ **`src/lib/queries/documents.ts:260`'s `getDocument` is confirmed DEAD** — independently
re-verified this session (not just re-quoted from the follow-up): grepped every
`getDocument(` call site (6 total, all under `src/app/o/[org]/.../documentos*` routes) and
read the actual multi-line import statement at the top of one — `getDocument` there resolves
to `@/lib/queries/controlled-documents`, never `@/lib/queries/documents`. **A single-line
import regex missed this on the first pass** (the import spans 4 lines) — a live instance of
exactly the "regex misses a line-wrapped call" trap this program's own records warn about,
caught and corrected within this session rather than reported as a false absence. Do not
baseline the dead projection.

A baseline should therefore target: `list_commission_documents` (RPC), a plain select on
`controlled_documents` (detail), a plain select on `documents` (per-resource list), and
`open_document_version` (the shared byte-authorization RPC underneath every "open"/"sign" —
confirmed via `nsp-evidence.ts`'s own header comment that RCA/CAPA/case evidence surfaces all
resolve through this one door, so it is the highest-leverage EXPLAIN target, not a
per-surface one). **No EXPLAIN/timing was actually taken** — that is S5's build work, not
step 0's; this section only fixes what to point it at.

## F · Unnamed surfaces

The highest-value section. Found, in order of how load-bearing each is:

1. **The disposal job's completion half does not exist for the general case** (Section C).
   Not named anywhere in the S5 plan text, and it changes what "name an owner" means — see
   below.
2. **A live, shipped, PO-ratified precedent for exactly this class of decision already exists
   in this codebase and the plan does not cite it.** `docs/decisions/0099-meeting-audio-minutes.md`
   D10 (`:91-95`, `:196-222`) ruled **"no new cron infrastructure"** for the meeting-audio TTL
   sweep — a deliberate, argued trade-off (*"Adding `pg_cron` would buy a wall-clock guarantee
   at the cost of the 'no new cron infrastructure' decision in D10 … For a feature that ships
   flag-OFF … that trade is not worth taking now"*) — and shipped a **lazy, request-triggered**
   pattern instead: `src/lib/minutes-jobs/sweep.ts` (`sweepStaleAudio`, in-process-throttled,
   triggered from the audio webhook handler and from `reconcileMinutesJob` on page load) +
   `src/lib/minutes-jobs/reconcile.ts` (`reconcileMinutesJob`, explicitly internal-only,
   "reconciliation a page has to remember to invoke is reconciliation that silently stops
   running"). This is directly relevant prior art for naming the disposal job's mechanism —
   whether S5 follows it or explicitly deviates, the plan should say so against this precedent
   rather than in a vacuum. Note the disposal job's constraints differ in a way that may argue
   the *other* direction (D10's case was a pure best-effort TTL on transient, flag-OFF,
   non-PHI-after-the-fact data with four other event-driven deletion paths already covering
   most cases; the general disposal job is PO/coordinator-initiated, PHI-adjacent, and
   Rule-12/LGPD-governed, with **no other path** currently completing it at all) — so citing
   the precedent does not mean it resolves the same way, only that it must be reasoned against
   rather than missed.
3. **`complete_document_disposal`'s ACL is `postgres`/`service_role` only — not
   `authenticated`.** Confirmed live. This is a real signal about intended shape: this
   completion door was already built to be called by something with service-role reach (an
   ops script or a future scheduled job), not by a user-facing request. Nothing currently
   holds that role.
4. **`storage.protect_delete()` is attached as `protect_buckets_delete` /
   `protect_objects_delete`** — confirmed live, both enabled. Worth recording precisely
   because a first-pass grep for the substring `protect_delete` in `pg_trigger.tgname` finds
   **zero** triggers (the real names are `protect_buckets_delete` / `protect_objects_delete` —
   "protect_delete" is not a contiguous substring of either). This is the same
   word-boundary/pattern trap this program's own records warn about, caught here by re-querying
   by **table** (`storage.objects`/`storage.buckets`) and joining to `pg_proc` by function
   name instead of pattern-matching the trigger name — recorded so nobody re-derives "no such
   trigger" from the same shortcut. The guard's logic (`current_setting('storage.allow_delete_query')`)
   matches the plan's S5.R description exactly.
5. **`file_objects` and `storage.objects` are both currently 0 rows locally**, against **245
   files / 2,456,666 bytes** actually on the volume across the 4 surviving buckets (measured
   live, `walk`). This is today's fresh-reset state, not a defect, but it means the local
   stack's current data is not representative for rehearsing reconciliation — a reseed or E2E
   run would be needed first to get realistic `file_objects` rows to reconcile against.
6. **No other operational script under `scripts/` is disposal/backup/cron-relevant.** Checked
   the full directory: `check-client-server-imports.mjs`, `check-memberships-door.mjs`,
   `check-tailwind-css-vars.mjs`, `check-vacuous-assertions.mjs` (the 4 lint gates),
   `e2e-prod-gate.sh`, `extract-embeds.mjs`, `probe-embeds.mjs`, `generate-pdf-fonts.mjs` (PDF
   rendering, unrelated), `verify-tv-backfill.sh` (unrelated backfill), `worktree-setup.sh`
   (dev tooling), plus the `smoke/` dir (one file, `pdf-mint.smoke.ts`). None touch disposal,
   scheduling, or backups.
7. **`dispose_event_phi` and `dispose_meeting_minutes` are a structurally different mechanism
   class from the other three "dispos*" doors** — they redact structured/free-text columns
   directly and never touch `file_objects`/Storage at all, so they carry no byte-disposal
   dependency and are already fully "complete" the moment they return (no pending Storage
   half). Worth naming so S5 doesn't accidentally scope all six doors under one "needs a
   completion mechanism" umbrella — only three do (`dispose_case_phi`, `dispose_referral_phi`,
   `request_document_disposition`).
8. **`triage_disposition` is a false friend of the word "disposition"** (clinical
   verdict/pathway, not PHI/byte disposal) — surfaced by the `%dispos%` sweep and worth
   recording so nobody scopes it into the disposal-job conversation by name association alone.

## Could not verify

A work item, not a disclaimer — each row states what would settle it.

| item | why unresolved | what would settle it |
| --- | --- | --- |
| Supabase Cloud `pg_cron`/`pg_net` availability and plan-tier entitlement for **this** project | touching the linked/remote project is out of scope for this pass under the standing directive | ask the PO, or check the Cloud dashboard's Database → Extensions page for the linked project directly (a read, not a push) |
| Whether `supabase backups list`/`restore` (Cloud PITR) is actually enabled for this project | same — requires the linked project | same as above; `supabase backups list --project-ref …` once touching remote is authorized |
| Whether local `shared_preload_libraries` including `pg_cron` matches what a fresh Supabase Cloud Postgres instance ships | only the local image was checked | check Cloud dashboard/docs for the project's Postgres version's preload list, or ask Supabase support |
| The `BUCKET_ABSENT`-bypasses-volume-proof edge case in `storage-manifest.mjs` (Section A) | no bucket currently exists in the "row absent, bytes present" state to observe against; the finding is derived from reading `verdictFor()`, not from a live repro | construct it deliberately in a scratch bucket (drop the row via SQL after populating bytes, without going through the API) — cheap, self-contained, deliberately not done here to keep this pass non-destructive and in scope |
| `document-reconciliation.mjs`'s literal JSON output right now | not executed live (it mutates `upload_sessions`/`file_objects` as an intrinsic part of running) — Section B's conclusion is derived by combining two independently-measured facts (`storage.objects`=0, volume=245 files) with the script's read classifier logic, not observed as the script's own stdout | run it once, accepting the (idempotent, well-understood) expiry-sweep side effects, or add a read-only `--dry-run` mode to the script first |
| Whether a fresh, non-degenerate local `file_objects` population (post-reseed/E2E) would surface any *live* `disposal_pending` or `undisposed` specimen | current local DB is empty (fresh reset) | reseed / run a slice of E2E that exercises document upload + disposal request, then re-run `document-reconciliation.mjs` |
| The exact behaviour of `20260927000400`'s own migration-time guard (that it refuses while `storage.objects` rows survive) against a **live** bucket-drop today | re-testing this means actually dropping a bucket row, which is destructive and out of scope for a verify-only pass; the plan already records this as measured at QA r2/r3 | not to be re-verified outside a real S5.R/S4-successor run; cite the plan's existing record, don't re-derive by dropping something |

## What this changes about the S5 plan

Not nothing.

1. **Section C's finding is the biggest change.** The parent plan's step 4 and the S5 plan
   text both read as "name the owner and mechanism for **the** disposal job" — phrasing that
   presupposes a job exists and needs an operator assigned. It does not, for the general
   (`request_document_disposition` / `dispose_case_phi` / `dispose_referral_phi`) path: the
   Storage-delete-then-`complete_document_disposal` half has exactly zero callers outside a
   narrower, unrelated workflow (document reclassification). `complete_document_disposal`'s
   own ACL (`service_role`-only) shows it was built expecting an operational caller that was
   never added. S5 cannot simply *document* an owner for this — it must either (a) explicitly
   decide the mechanism (manual runbook vs. a lazy request-triggered pattern in this
   codebase's own established D10 style vs. `pg_cron`, now confirmed cheap to enable locally
   but Cloud-unverified) and note that building the wiring, not just naming it, is now in
   scope, or (b) explicitly rule that this stays manual/operator-driven for the pilot and say
   so, closing the gap the stale comment at `actions.ts:277-278` currently papers over. Either
   way, the comment should be corrected to stop asserting a mechanism that doesn't exist.
2. **The reconciliation command's blind spot is a second, independent confirmation of
   FUP-DM5-FINALIZE-ATOMIC's binding note**, plus a newly-found second instance of the same
   shape (`disposal_pending` rows are permanently "indeterminate," on a completion-door
   assumption Section C shows is false today). S5 should not sign off
   `document-reconciliation.mjs` as "the reconciliation command" without recording both blind
   spots, per that follow-up's own binding language.
3. **S5.R's disposable-bucket step needs a small addition to the manifest tool (or an
   accepted one-off script) before it can run** — there is no `create` subcommand; only
   `selftest` creates a scratch bucket, internally, and tears it down itself. This is cheap
   (borrow `selftest`'s own two lines) but is not currently a documented step anywhere.
4. **The backup/restore drill is structurally asymmetric, not just "two things to test."** The
   DB half has real, local, standard tooling (`supabase db dump --local`, confirmed working).
   The Storage half has none beyond object-level `cp`/generic Docker-volume snapshotting, and
   the mechanism most likely to actually run during a real incident — a stack-cycle recovery —
   is the one independently confirmed **destructive** to that exact volume
   (FUP-DM5-STACK-CYCLE-DESTROYS-BYTES). S5's drill should say this plainly rather than treat
   "DB + Storage together" as two peer halves of equal maturity.
5. **The EXPLAIN/latency targets are now named precisely** (table in Section E) — worth
   pointing S5 at `open_document_version` as the single highest-leverage RPC to baseline,
   since every "open"/"sign" surface across case, RCA, CAPA, and printed-document evidence
   funnels through it, per `nsp-evidence.ts`'s own header comment, confirmed by reading it.
6. **The memory note recording `dispose_referral_phi` as still-open is stale** — it shipped
   (live, DEFINER, `authenticated`-executable). Small, but exactly the "resolve the value, not
   the noun" trap this pass was told to guard against, so worth flagging precisely rather than
   silently updating elsewhere.
7. **Nothing else changes.** The manifest tool's core mechanism (capture → delete-by-key →
   assert count) is intact, 8/8 self-tested live today, and the flag-confusion footgun is the
   only unfixed defect in it — everything else asked of Section A held up under direct
   execution. `document-reconciliation.mjs`'s legacy-bucket widening from S0 is real and
   working. The five other `scripts/` files are confirmed irrelevant to S5. S5.R's own
   acceptance criteria (capture/delete/detect-orphan/refuse-mismatch/guard-refuses) are not
   undermined by anything found here — if anything, the live 8/8 selftest run is direct
   evidence the underlying mechanism S5.R will exercise already works end-to-end in miniature.

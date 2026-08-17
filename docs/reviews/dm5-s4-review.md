# DM5 · S4 — QA review (§6 step 3)

- **Slice:** DM5 · S4 — legacy storage-bucket retirement
- **Reviewed at:** `main` @ `b5c75d22` (tree clean), local stack only. Nothing remote touched.
- **Date:** 2026-08-17
- **Reviewer:** `qa`
- **Verdict:** ⛔ **CHANGES REQUESTED**

> **The build is sound.** The migration, its byte-first guard, and every successor assertion were
> re-proved by **neutralization**, not by reading the fix — all of them are falsifiable, including
> the two the lead flagged as at-risk. **No P0. No RLS/immutability hole. No code change is
> requested.**
>
> Both blocking items are **record/test-coverage** defects. The larger one is that the phase's
> central honesty claim has **inverted since it was written**: S4 correctly recorded that it deleted
> zero bytes, but the 221 orphan files it recorded as *surviving* **no longer exist**, and the PO
> ruling of 2026-08-17 to "leave them" was taken ~3 h after they had already been destroyed.

| severity | count | blocking |
| --- | --- | --- |
| **P0** | 0 | — |
| **MAJOR** | 2 | **both blocking** |
| **MINOR** | 7 | no |
| **INFO** | 4 | no |

**Stack ownership.** I ran **one** `supabase db reset --local` (announced here, as the phase requires
— a shared stack with two writers caused a live incident in DM5). Every mutation below ran in a
single rolled-back transaction with an md5 rollback proof; post-run hygiene re-verified after each
batch. No harness was edited. No repo file was modified except this review.

---

## 1 · What I re-measured (every figure below is mine, not inherited)

| claim | lead's figure | **my measurement** | verdict |
| --- | --- | --- | --- |
| migration registry == files | 407 == 407 | `supabase_migrations.schema_migrations` **407**; `ls supabase/migrations/*.sql` **407** | ✅ |
| pgTAP | 193 files / 6351 PASS | `npm run test:db` on a fresh reset → **Files=193, Tests=6351, Result: PASS**, exit 0 | ✅ |
| tsc | 0 | `npm run typecheck` exit 0 | ✅ |
| lint | 5/5 | `npm run lint` exit 0 — memberships-door OK · client-server-imports 10/10 self-test, 481+124 modules, 0 findings · vacuous 42/42 self-test, 184 specs, 0 findings | ✅ |
| vitest | 1294 | **88 files / 1294 passed** | ✅ |
| `ARM=census` | live 546 / verdicts 570 | **546 / 570**, `INVARIANT HOLDS`, exit 0 (pgtap absent — the false-violation trap avoided) | ✅ |
| `FROMFINDINGS=1 ARM=wrapper` | BLIND 41 | **BLIND 41 ⊆ allowlist**, exit 0 | ✅ |
| `ARM=hat` | 3 allowlisted | **3 findings, all reasoned-allowlisted**, self-test **6/6**, exit 0 | ✅ |
| `ARM=floor` | allowlisted | **74** never-called doors, all on the floor allowlist, exit 0 | ✅ |
| post-migration catalog | 4 buckets / 4 policies | `storage.buckets` = `documents-phi, documents-standard, form-assets, meeting-audio`; `pg_policies` on `storage.objects` = **4**, predicates naming only `documents-phi` / `documents-standard` / `form-assets` | ✅ |
| degenerate bodies | 0 | **0**, re-run after every mutation batch | ✅ |

All gate arms were run **unpiped, redirected to files**, exit codes captured directly (never `tail`).

**Catalog sweep for surviving references — clean.** Zero hits for any of the eight retired bucket
names across `pg_proc.prosrc` (`app` / `public` / `storage`), `pg_constraint` definitions,
`pg_policies` predicates (all schemas), `pg_views` definitions, column defaults, and trigger
definitions.

---

## 2 · Attack 1 — the central honesty claim

### 2.1 The claim as written is TRUE, and it is recorded honestly everywhere

I checked all six locations. **No document is phrased so a reader would conclude bytes were
retired.** The opposite: every one leads with the no-op.

- commit `19dd3124` — *"THE BYTE HALF WAS A NO-OP, AND IS RECORDED AS THAT, NOT AS 'RETIREMENT PROVEN'"*
- `PROGRESS.md:169-177` — same banner, plus *"the deploy-time byte sequence remains UNREHEARSED"*
- `docs/progress/dm5-wave-d-retirement.md:24-41` + its `NOT TESTED / NOT COVERED` heading
- `docs/progress/dm5-handoff.md:553-580` §11 — *"S4 deleted ZERO BYTES"*
- ADR `0120` D9 inline `⏳ EXECUTION NOTE` — including *"the sequence remains UNREHEARSED end-to-end … Do not let S5/S6 read S4's completion as evidence that the deploy-time byte path has been run"*
- `docs/progress/follow-ups.md:255-277` — item explicitly **not** closed

The migration file itself carries the strongest version, under the heading *"What this migration does
NOT do, and why that is the whole point"* (`…000400.sql:24-51`). **This attack finds nothing. The
record is honest about what S4 did.**

### 2.2 ⛔ But the record is now FALSE in the other direction — and this is MAJOR-1

Every present-tense claim that the **221 files still sit on the local volume** is false. Measured
twice, by independent methods, before I touched anything:

**Method A — the Docker volume.**

```
docker volume inspect supabase_storage_azkbbhskturikxpgmafq --format '{{.CreatedAt}}'
  → 2026-08-17T01:06:02Z          ← the volume OBJECT was destroyed and recreated
```

Its contents now: **78 files / 1,479,501 bytes**, and **all of them are in surviving buckets** —
`documents-phi` 22, `documents-standard` 49, `form-assets` 4, `meeting-audio` 3. There is **no
directory at all** for any of the eight retirement buckets. `docker volume ls -f dangling=true`
shows no orphaned older storage volume: the bytes are unrecoverable.

**Method B — the phase's own tool, re-run.**

```
node scripts/storage-manifest.mjs walk
  attachments … printed-documents   (no directory on the volume)   ← all 8
  TOTAL files=78 bytes=828237 phi_tier_keys=22

node scripts/storage-manifest.mjs capture --out <scratch>
  all 8 → BUCKET_ABSENT · TOTAL api_keys=0 orphan_keys=0 orphan_bytes=0
  CAPTURE CLEAN
```

Compare the **committed** artifact `supabase/manifests/dm5-s4-post-retirement.json`, produced by the
same tool on the same stack:

```json
"capturedAt": "2026-08-17T00:55:57.770Z",
"totals": { "orphanKeys": 221, "orphanFiles": 221, "orphanBytes": 6927804, "phiOrphanKeys": 15 }
```

**The timeline, all timestamps UTC:**

| time | event |
| --- | --- |
| `2026-08-17T00:55:57Z` | committed manifest captured — **221 orphan files / 6.93 MB / 15 PHI-tier** |
| `2026-08-17T01:06:02Z` | **storage volume destroyed and recreated** (~10 min later) |
| `2026-08-17T02:09Z` | S4 feature commit `19dd3124` — records the 221 files as surviving |
| `2026-08-17T04:17Z` | commit `b5c75d22` — **PO ruling: "LEAVE THEM"** |

So the PO was asked to rule on, and the record still asserts, a PHI-at-rest state that had ended
**3 h 11 m earlier**. The ruling's own rationale — *"they are unservable local dev artifacts, and
deleting them would make the gap look closed"* — is reasoning about files that were already gone.

**Cause: UNDETERMINED, and I am deliberately not inventing one.** The only in-repo command that
cycles the stack is `scripts/e2e-prod-gate.sh:154-156` (`npx supabase stop` / `npx supabase start`),
but `supabase stop --help` at the pinned v2.105.0 documents `--no-backup` as *"Deletes all data
volumes after stopping"*, which implies plain `stop` **retains** them — so that path does not
obviously account for it. What is certain is the *fact*, measured twice; the mechanism is not.

**Why this is blocking rather than cosmetic — two reasons, and the second is the bigger one.**

1. This is a **20-yr LGPD/ANVISA retention record** asserting a control state that is false, and it
   is the stated premise of a PO decision. The phase's own standard (ADR 0120 D11's `⏳ CONTESTED`
   note) is that *"a record asserting a control no code performs is worse than one admitting the
   gap"*. The same applies to a record asserting bytes that no longer exist.
2. **221 files, 15 of them PHI-tier, were destroyed with no manifest, no key list, no
   `deleted_count == manifest_count` comparison, and no audit trail.** That is precisely the
   disposal-without-evidence event D9's manifest-first ruling exists to prevent, and it happened
   **inside the slice that ratified D9**. D9's local rationale — *"a reset recreates the DB while
   the Docker volume survives"* — I re-verified and it **holds for `db reset`** (my reset left the
   volume at 78 files, unchanged). It does **not** hold against whatever occurred at `01:06:02Z`.
   S5/S6 must not inherit "the bytes are durable locally" as a premise.

**Required to clear MAJOR-1** (no code change):

- Re-measure and correct the present-tense claims in `docs/progress/dm5-wave-d-retirement.md`
  (§ *NOT TESTED / NOT COVERED*, 3rd bullet), `docs/progress/dm5-handoff.md` §11,
  `docs/progress/follow-ups.md:267-276`, `PROGRESS.md`, and ADR `0120` D9's EXECUTION NOTE —
  stating that the 221 files were destroyed out-of-band between the capture and the commit, with
  the measured timeline, and that the mechanism is **undetermined**.
- Re-put the FUP-DM5-STORAGE-ORPHANS question to the PO, because the ruling's premise no longer
  holds. *(I am not re-litigating the ruling — I am reporting that its subject ceased to exist
  before it was recorded.)*
- Record the durable finding: **the local storage volume is not durable, and an out-of-band
  destruction is invisible to every gate in this repo.** Note that the *current* stack already
  carries a fresh instance of the same class — 78 orphan files with **0** `storage.objects` rows,
  **22 of them in `documents-phi`**, i.e. in a *surviving PHI bucket* that retirement does not
  address.

---

## 3 · Attack 2 — the `do`-block fix

### 3.1 The fix is genuinely transaction-safe, and the guard genuinely refuses ✅

- `…000400.sql:116-130` puts `perform set_config('storage.allow_delete_query','true', true)` and the
  `DELETE` inside **one `do` block**. A `do` block always executes inside a transaction (its own if
  none is open), so `is_local => true` is guaranteed in scope for the delete beside it and dies with
  it. The block additionally re-asserts `'false'` before returning.
- **No leak, verified:** after the reset, `select current_setting('storage.allow_delete_query', true)`
  returns empty at session level; no `pg_roles.rolconfig`, `pg_db_role_setting` or `pg_settings` entry
  carries it.
- **The guard fires — proven by neutralization (N5).** In one rolled-back transaction I resurrected
  `nsp-evidence` and inserted one `storage.objects` row, then ran block 1 verbatim:
  `ERROR: GUARD FIRED (correct): bucket nsp-evidence holds 1 row(s)`. It is not decorative.
- **The migration itself emits no `25P01`.** On my reset, six warnings appeared, none of them
  attributable to `…000400` (see below).

### 3.2 ⚠ I can explain the unexplained non-error — and the explanation contains a grain error (MINOR-1, MINOR-2)

The record states the first version *"passed a standalone `supabase db reset`"* and that the `25P01`
warning appeared only under the E2E gate's reset. **That is not reproducible.** My plain
`npx supabase db reset --local` emitted **six** `WARNING (25P01)`, attributed to
`20260710000000`, `20260711000200` (×2), **`20260921000300_retire_meeting_attachments_bucket.sql`**,
and `20260925000300` (×2). So the no-op is a property of the **migration runner in general**, not of
the e2e path. → **MINOR-1**, and it raises the priority of the already-filed
FUP-DM5-SETLOCAL-MIGRATION: `20260921000300`'s opt-in is silently no-opping on **every** reset.

That sharpens the lead's open question. Four measurements:

1. `SET LOCAL` outside a transaction is a no-op — the `25P01` warning proves it did not take effect.
2. `storage.protect_delete()` is a `BEFORE DELETE … FOR EACH STATEMENT` trigger on `storage.buckets`
   that raises `42501` whenever the GUC ≠ `'true'`. Re-probed live:
   `begin; delete from storage.buckets where id='form-assets';` → `ERROR: Direct deletion from
   storage tables is not allowed`.
3. No persistent value for that GUC exists at session, role or database scope.
4. Yet `20260921000300`'s `DELETE` succeeds on every reset — `meeting-attachments` is gone and
   `325` t3 is green.

The **only hypothesis consistent with all four** is that the trigger is **not in force at
migration-apply time** in this path. Corroborating: `storage.migrations` row `55
prevent-direct-deletes` — the migration that installs `protect_delete` — carries
`executed_at = 2026-08-17 04:25:20.698`, i.e. it was re-executed by the storage service during my
reset, with the whole storage migration set stamped in the same second. I could **not** timestamp
the user-migration phase to prove strict ordering, so I state this as a hypothesis that survives
every measurement I could make, not as a demonstrated mechanism.

→ **MINOR-2, and it is the phase's own recurring class.** The probe the record cites as proving
*"the opt-in is genuinely load-bearing"* was run against the **post-reset live DB**, where the
trigger exists — a different context from migration-apply time. That is
[[a-predicate-quoted-at-the-wrong-grain]]: the check ran, it just wasn't checking the thing.
**This does not weaken the fix** — the `do`-block form is correct in *both* contexts, which is
exactly the argument for it, and on `db push` against a live remote (where the storage schema and
its trigger have long existed) the opt-in genuinely *is* load-bearing. What needs correcting is the
causal story, not the code.

---

## 4 · Attack 3 — are the successor assertions VACUOUS? **No. All proven falsifiable.**

Every mutation below ran in **one rolled-back transaction**. Baseline md5 of
`pg_get_functiondef(app.can_write_document)` = `cabfd7d77b2c8a4e7c54ed1cb07a4a98`; **identical after
the full battery**. Degenerate-body sweep = **0** after each. No leftover `_mut*` functions;
4 policies / 4 buckets / pgtap absent at the end.

| # | neutralization | assertion under test | expected | **observed** |
| --- | --- | --- | --- | --- |
| N1 | resurrect `nsp-evidence` + `controlled-documents` bucket rows | `325` **t7**, `200` retired-bucket pin | red | t7 → `controlled-documents,nsp-evidence` (non-empty ⇒ **FAILS**); `200` count → `1` ⇒ **FAILS** ✅ |
| N2 | recreate `nsp_evidence_obj_select_member` + `capa_evidence_obj_insert_writable` | `325` **t6**, `142` nsp-count, `143` capa-count | red | t6 → both policy names ⇒ **FAILS**; `142` → 1; `143` → 1 ⇒ **FAIL** ✅ |
| N3 | delete a **survivor** bucket (`form-assets`) | `325` **t8** | red, **and t7 must still pass** | t8 → `documents-phi,documents-standard,meeting-audio` ⇒ **FAILS**; t7 → still empty ⇒ **passes**. **t8 is exactly the control t7 needs** ✅ |
| N4a | drop `documents_std_obj_insert_reserved` | `143` Rule-6 conjunction | `false` | `false` ✅ |
| N4b | add an UPDATE policy on `documents-phi` | `143` Rule-6 conjunction | `false` | `false` ✅ |
| N6 | replace the call `app.can_write_rca(v_resource, p_uid)` → `(false)` in `app.can_write_document` | `142` successor | call-form false, **bare name still true** | bare `%can_write_rca%` → **`true`** (the vacuity, demonstrated); `%app.can_write_rca(%` → **`false`** ✅ |
| N7 | replace `app.can_write_capa(` → `app.NEUTRALIZED_capa(` | `341` **F9** | same | bare → **`true`**; call-form → **`false`** ✅ |
| N5 | insert 1 object into a resurrected retirement bucket | migration guard block 1 | raise | `GUARD FIRED … holds 1 row(s)` ✅ |

**The call-form reasoning verified independently.** I read the live `pg_proc.prosrc` for
`app.can_write_document` rather than the migration file. The header comment at body lines 67-68 does
contain the bare names in prose — *"`can_write_rca` = PQS operator … `can_write_capa` takes the PLAN
id"* — while the actual calls are `return app.can_write_rca(v_resource, p_uid);` and
`return app.can_write_capa((select ca.capa_id from public.capa_action ca where ca.id = v_resource), p_uid);`.
**The lead's reasoning is correct**, N6/N7 prove it executably, and the twin in `142` carries the
same tightening. `app.can_write_document` has exactly **one** overload (2 args, `prosecdef = t`).

**Not vacuous, but worth naming:** the three zero-count successors in `142`/`143`/`200` (policies
named `nsp_evidence_obj_%` / `capa_evidence_obj_%`, and the `controlled-documents` bucket row) are
*not* the vacuity class they replaced. The retired pins were *"no UPDATE/DELETE policy"* — satisfied
forever by zero policies of any kind. The successors assert **retirement itself**, which is exactly
the property, and N1/N2 show they go red on resurrection. Correct replacements.

---

## 5 · Attack 4 — the third missed class: **it exists, and it is E2E (MAJOR-2)**

The lead's sweep was bounded by *reads of `storage.buckets`* and *`storage.objects` inserts*, then
widened to *assertions about the dropped policies*. There is a **fourth property it never covered:
HTTP calls that name a bucket in a URL.**

### MAJOR-2 — `e2e/phase14c-rca.spec.ts:650-671` (test **R15**) is a dead security pin

```ts
test('R15: nsp-evidence bucket rejects DELETE from admin (immutable bucket)', …
  const resp = await request.delete(
    `${SUPABASE_URL}/storage/v1/object/nsp-evidence/fake-object-immutability-test`, …)
  expect(resp.status()).not.toBe(200)
  expect(resp.status()).not.toBe(204)
```

Probed live with the real service-role key:

| bucket | response |
| --- | --- |
| `nsp-evidence` (**retired**) | `HTTP 400` · `{"statusCode":"404","error":"not_found","message":"Object not found"}` |
| `documents-phi` (**surviving**) | `HTTP 400` · identical body |
| `form-assets` (**surviving**) | `HTTP 400` · identical body |

The assertion is satisfied **identically** whether the bucket is immutable, mutable, or absent. It
names a Rule-6 immutability property, its subject no longer exists, and it counts toward the
**1118-passed** gate figure while pinning nothing. Its file header at `:28` and its block comment at
`:647` still advertise the property as current, and `supabase/tests/142_rca.sql:12` does the same.

This is not merely stale text — it is **coverage that reads as coverage**, in the same class the
slice spent its own findings on. Blocking because S4's stated assurance argument is *"the successors
are non-vacuous"*, and this one was never examined.

**Required to clear MAJOR-2:** with the tester, either retire R15 with a successor that pins Rule-6
immutability where the evidence bytes actually went (`documents-standard` / `documents-phi`, which
`143`'s new conjunction already covers at the catalog layer), or delete it and record why — but not
leave a green test naming a bucket that does not exist. Correct the two comments and `142:12`.

### Everything else in the sweep — findings and clean bill

**MINOR-3 — `supabase/tests/mutation/q1-quality-mutation-audit.sh:140-153` (`open_bytes_cut`) is
broken, and it is NOT S4's doing.** It targets policy `attachments_obj_select_readable` on
`storage.objects`. Catalog: **0** such policies; dropped by
`20260923000100_dm1_drop_attachment_substrate.sql` (**DM1**, weeks before S4). Its own no-op guard is
`if v_qual !~ 'read_case_deliberation' then raise …` — with the policy absent `v_qual` is NULL,
`NULL !~ …` is NULL, the guard does **not** fire, and control reaches `alter policy` on a nonexistent
policy → `42704`. A guard written to announce "MUTATION NO-OP" fails open into an error instead.
Pre-existing; file as a follow-up, do not charge it to S4.

**MINOR-4 — stale present-tense docs asserting a retired bucket as live.** Verified line by line:

- `docs/deployment/pdf-renderer.md:76-77` — *"all documents live in the `printed-documents` Storage
  bucket (never deleted; 20-yr posture, D15)"*, with **no** retirement caveat anywhere in the file.
  This is the highest-consequence instance: a **deployment runbook** naming a bucket that does not
  exist, under a 20-yr retention assertion.
- `docs/progress/authz-capability-inventory.md:361` — *"`case-documents` remains live BY DESIGN while
  `getReferralDocumentUrl` still signs from it"* — false twice (DM4 removed the signer, S4 the bucket).
- `docs/progress/follow-ups.md:600-601` — describes `src/app/api/documents/[id]/route.ts:46` doing
  `.download(row.storage_path)` from `printed-documents`. The route now reads `row.storage_bucket`
  from the door (`route.ts:43-52`) and names no bucket literal. Candidate to close.
- `supabase/seed.sql:2216`; `supabase/tests/235_authz_a4…:150-151`; `scripts/storage-manifest.mjs:12`
  and `scripts/document-reconciliation.mjs:63-64,89` ("12 buckets", "2 of 12" — now 4).

`docs/backend-state.md` is **exempt**: its DM5·S4 stamp at the head explicitly declares every bucket
name below it a dead noun. That is the right pattern and the other files should borrow it.

**MINOR-5 — the D9 tool goes GREEN post-migration, and D9's ordering has no tool-side enforcement.**
`capture` on the retired scope now prints **`CAPTURE CLEAN`** (§2.2). The tool is honest — its volume
proof *did* fire for absent buckets in the committed S4 manifest — but the operational consequence is
not written down anywhere I found: **once `…000400` has been applied, the only arm that can still see
a surviving byte is the volume walk, which is `STORAGE_BACKEND=file` local-only.** On Cloud,
post-migration, the retirement tool has **no** arm that can see one. And the migration's guard
enforces *"no `storage.objects` rows"* — which is exactly the condition an orphaned bucket satisfies,
so the guard cannot enforce the ordering it documents in the case that matters. Record it as an input
to S5/S6 and to the deploy runbook. *(Scoped to the new half only — FUP-DM5-STORAGE-ORPHANS itself is
known-open and not re-litigated.)*

**Clean, verified by me:**

- `src/**` — zero retired-bucket string literals. Every `.storage.from(...)` resolves its bucket from
  the door or from a server-side derivation (`file_objects.storage_bucket`,
  `app.printed_rendition_storage_bucket`, `meeting-audio`). Remaining name matches are the
  `attachments` **feature flag**, a `domId`, and `@/lib/{queries,controlled-documents}/*` module
  paths — none are buckets.
- `supabase/config.toml`, `supabase/demo/`, `supabase/snippets/`, `supabase/templates/`, `Dockerfile`,
  `next.config.*`, `.env.example`, `package.json` — no bucket references.
- `e2e/dm4-referral-documents.spec.ts:708/785/827` — asserts the retired path serves nothing; correct
  as written.

---

## 6 · Attack 5 — `235` / `236` and the u1 harness: **safe, and re-proven**

I ran `bash supabase/tests/mutation/u1-mutation-audit.sh` end to end:

```
revert_grant / revert_revoke / revert_list / revert_create_interview /
revert_interview_insert_policy / restore_interview_attach_policy   →  6/6 RED-PROVEN
CONTROL — no mutation: all green (22 ok, 0 not ok)                     exit 0
```

Post-run hygiene: degenerate bodies **0**, leftover `_mut*` functions **0**, storage policies **4**,
buckets **4**, pgtap dropped. The harness is transactional **by construction** for this case — the
`restore_interview_attach_policy` injection is spliced at a marker *inside* `236`'s `begin;/rollback;`,
and `cleanup` drops `app._mut_u1` on trap EXIT. **Leaving `235`/`236` alone was the right call.**

⚠ The residual the lead already recorded is real and confirmed: those fixtures now **create** the
`case-documents` / `interview-attachments` bucket rows (their `on conflict do nothing` used to be a
no-op and now actually inserts), so `236` ③CTLa/③CTLb/③a/③b/③c and `235` K4 measure buckets that
exist only inside the test. They still test **policy absence** honestly — which is the property they
name — so this is INFO, not a defect. It is correctly disclosed in the record's NOT-COVERED heading.

---

## 7 · Attack 6 — the removed TS constants

**Zero callers ✅.** `ATTACHMENTS_BUCKET`, `ATTACHMENTS_PHI_BUCKET` and `bucketForTier` appear nowhere
in `src/`, `e2e/`, `scripts/` or `supabase/` outside comments and historical migrations. `tsc` 0,
lint 5/5, vitest 1294 unchanged.

**MINOR-6 — the tombstone comment is factually wrong.** `src/lib/attachments/constants.ts:65-76`
states:

> *"`begin_document_upload` is the only thing that names a bucket."*

Catalog says three functions in `app`/`public` contain a bucket literal:

```
app.printed_rendition_storage_bucket
public.begin_document_upload
public.reclassify_document
```

The rest of the tombstone is accurate — I verified `file_objects_bucket_from_tier`
(`(tier='phi' AND bucket='documents-phi') OR (tier='standard' AND bucket='documents-standard')`) and
`file_objects_bucket_check` both exist as described, and the guidance *"do not reintroduce a
tier→bucket helper here"* is sound. But the false clause was written in the **same commit** that
cites `[[a-comment-is-an-assertion-that-goes-stale-silently]]`. Fix the sentence or drop it — the
CHECK constraint alone carries the argument.

---

## 8 · MINOR-7 — `PROGRESS.md` carries superseded figures for the item S4 just measured

- `PROGRESS.md:86` (phase-status row) and `PROGRESS.md:573` (follow-up index line) both still say
  FUP-DM5-STORAGE-ORPHANS' *"LOCAL half still **blocks S4**"* — S4 has run.
- Both quote the **pre-S4** figures **699 files / 7.02 MB / 198 PHI-tier**; S4 measured
  **866 / 9.9 MB / 235 PHI** (221 / 6.93 MB / 15 PHI in the retirement buckets), and as of now the
  true figure is **0** in the retirement buckets (§2.2).
- Neither line carries the 2026-08-17 PO ruling, which the body in `docs/progress/follow-ups.md:271`
  does carry.

The **body** is current; the two live index lines are not — the exact split the rotation discipline
exists to prevent, and the fourth PROGRESS.md-currency defect in this phase.

---

## 9 · INFO

- **INFO-1 — `341` F9's second conjunct is not falsifiable in its new home.**
  `not like '%hospital_of_event%'` was the bug's *actual signature* in the old subject (the retired
  policy's `with_check`). In `app.can_write_document` the string occurs **0** times and no plausible
  regression would introduce it — a regression there would spell `event_of_capa` or `can_write_event`.
  Under N7 it stayed `true`. The `like` half carries the pin; the "same like/not-like shape" claim is
  true syntactically and hollow semantically. Harmless — but do not count it as a second lock.
- **INFO-2 — `142` and `341` assume a single `can_write_document` overload.** Both use a bare scalar
  subquery over `pg_proc … where proname='can_write_document'`. There is exactly one today
  (2 args, `prosecdef = t`). A second overload turns both assertions into *"more than one row
  returned by a subquery"* errors rather than a clean red. Pin `pronargs` or the identity args.
- **INFO-3 — the four arms gave ZERO coverage of this diff, and "four arms HOLD" should not be read
  otherwise.** `p0-authz-invariant.sh:288-295` bounds the census policy domain with
  `where n.nspname = 'public'` — so the four dropped `storage.objects` policies were **never** in it.
  That is why census stayed at 546 across a diff that removed four policies, and the lead's
  "unchanged" note is correct. But it means the assurance for S4 came entirely from `325`/`200`/`142`/
  `143`/`341` and the neutralizations, **not** from the standing arms. Recording `ARM=policy` as
  *NOT APPLICABLE* was right; adding one line that the census domain excludes the `storage` schema
  would close the reading gap.
- **INFO-4 — a fresh orphan set already exists in a *surviving PHI* bucket.** Right now: **78** files
  on the volume against **0** `storage.objects` rows, **22 of them in `documents-phi`**. The
  orphan-producing mechanism is intact and now operates on buckets retirement does not touch — which
  is the strongest argument that FUP-DM5-STORAGE-ORPHANS should stay open, and that its scope is
  wider than the retirement manifest.

---

## 10 · NOT TESTED / NOT COVERED

*Binding heading. An APPROVED — or CHANGES REQUESTED — slice is not an absence of gaps.*

- ⛔ **I did NOT re-run `e2e:prod`.** Every gate-step-2 figure is **inherited, not re-measured**:
  1118 passed / 0 failed / 0 did-not-run / 5 flaky / 18 batches, the 1129-collected reconciliation
  against S3, and `pdf-printing` **9/9** + `pdf-printing-meetings` **6/6**. In particular the
  headline claim *"the print corridor still mints real `%PDF-` bytes with `printed-documents`
  deleted"* is **not independently verified by me**. Cost (~1 h) was judged not to earn its keep
  against a catalog-only diff with a green pgTAP suite — but that is a judgement, and MAJOR-2 shows
  the E2E layer is exactly where this slice's blind spot lived. **If the fix for MAJOR-2 touches
  `phase14c-rca.spec.ts`, that suite must be re-run and the figure re-stated.**
- ⛔ **The deploy-time byte path remains UNREHEARSED**, and I did not rehearse it. Worse than S4
  recorded: post-migration it can no longer be rehearsed **on the retired scope at all** locally
  (MINOR-5), because `capture` returns `BUCKET_ABSENT` for every one of the eight.
- ⛔ **I did not determine the mechanism that destroyed the 221 files** (§2.2). I state the fact and
  refuse the mechanism story — this phase has been burned by confident mechanism stories twice.
- ⚠ **The `protect_delete`-not-in-force explanation (§3.2) is a HYPOTHESIS**, not a demonstration. It
  survives four independent measurements and I found no measurement contradicting it, but I could
  not timestamp the user-migration phase to prove the ordering directly.
- **Nothing remote was touched, verified, or inferred about.** No `db push`, no remote reset, no
  remote read. FUP-DM5-STORAGE-ORPHANS' Cloud half is untouched by this review.
- **I did not audit S5/S6 scope**, the `documents_wave_d` flag surface, or anything outside S4's diff
  plus the reference sweep.
- **The CLI bump to v2.114.0 was not taken and not evaluated.** D17's remote half is grep-verified
  only against the v2.105.0 binary; a bump requires re-running that grep with its `auth` positive
  control. Unchanged from S4's own disclosure.
- **The 4 surviving `storage.objects` policies were read, not neutralized** as authz gates — they are
  outside the census domain (INFO-3) and outside this slice's diff. `143`'s new conjunction is the
  only thing asserting anything about them, and N4a/N4b prove it falsifiable in both directions;
  their *predicates* (`app.storage_upload_reserved`) were not opened.

---

## 11 · Itemized change list

**Blocking — must be cleared before §6 step 4:**

| # | severity | item | requirement violated |
| --- | --- | --- | --- |
| **B1** | MAJOR | The 221 local orphan files **no longer exist**; five records + ADR 0120 D9's EXECUTION NOTE + the PO ruling of 2026-08-17 all assert they do. Correct every present-tense claim with the measured timeline, state the mechanism as undetermined, re-put the question to the PO, and record that the local volume is not durable. | Architecture Rule 12 / ADR 0120 D9 (retention-record accuracy); CLAUDE.md §7 (*"never report status … without writing it there first"* — a record that is false is worse); the phase's own *"a record asserting a control no code performs is worse than one admitting the gap"* |
| **B2** | MAJOR | `e2e/phase14c-rca.spec.ts:650-671` (**R15**) is a green security assertion whose subject was deleted; proven indistinguishable from a surviving bucket by live probe. Retire or re-point it with `tester`, and correct `phase14c-rca.spec.ts:28`, `:647` and `supabase/tests/142_rca.sql:12`. | ADR 0120 D8/D9 retirement completeness; FUP-PGTAP-VACUOUS's principle (*a test that can go green having asserted nothing*); CLAUDE.md §6 step 2 (specs cover the acceptance criteria) |

**Non-blocking — fix in the same pass or file follow-ups:**

| # | severity | item |
| --- | --- | --- |
| MINOR-1 | MINOR | `25P01` is **not** e2e-path-specific — a plain `db reset` emits 6, one from `20260921000300`. Correct the record; raise FUP-DM5-SETLOCAL-MIGRATION's priority. |
| MINOR-2 | MINOR | The *"opt-in is load-bearing"* probe was taken at the wrong grain (post-reset live DB ≠ migration-apply time). Correct the causal story; the fix itself stands. |
| MINOR-3 | MINOR | `q1-quality-mutation-audit.sh` `open_bytes_cut` arm broken since **DM1** — NULL-swallowing guard falls through to `42704`. Pre-existing; file a follow-up. |
| MINOR-4 | MINOR | Stale present-tense bucket references, led by `docs/deployment/pdf-renderer.md:76-77` (a deployment runbook). Borrow `backend-state.md`'s dead-noun stamp. |
| MINOR-5 | MINOR | Post-migration `capture` prints `CAPTURE CLEAN`; on Cloud no arm can then see a surviving byte, and the migration guard cannot enforce the ordering in the case that matters. Input to S5/S6 + the deploy runbook. |
| MINOR-6 | MINOR | `src/lib/attachments/constants.ts:65-76` tombstone falsely says `begin_document_upload` is the only bucket-naming function (catalog: three). |
| MINOR-7 | MINOR | `PROGRESS.md:86` and `:573` carry superseded FUP-DM5-STORAGE-ORPHANS figures, still say *"blocks S4"*, and omit the PO ruling. |
| INFO-1..4 | INFO | See §9. |

---

## 12 · What is unambiguously right, and should not be lost in the verdict

- The migration is the correct shape: **retirement as a migration, not a script**, because six
  historical migrations recreate the rows on every reset — verified, and `325` t6/t7 are what make it
  survive.
- **The byte-first ordering is encoded executably, and the guard actually refuses** (N5). Prose in a
  header would not have.
- **Every successor assertion is falsifiable**, including the two the lead flagged as at-risk, and the
  bare-name-vs-call-form vacuity is real and now demonstrated executably (N6/N7).
- **`t8` is a genuine positive control** — N3 shows it is the *only* thing standing between t7 and a
  sweep that deleted everything.
- The `do`-block fix removes a dependency on an undocumented property of the migration runner rather
  than betting on it — and §3.2 shows that property is even more variable than the record assumed,
  which strengthens the choice.
- **The honesty discipline held on the question it was asked.** Nothing anywhere claims bytes were
  retired. B1 exists because the world changed under a true record, not because the record lied.

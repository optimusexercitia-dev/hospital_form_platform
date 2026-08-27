# AE0.4 — Service-role write census (ADR 0155 / docs/plans/authz-evolution.md)

- **Date:** 2026-08-26
- **Commit:** `10c7f4e7dd8022b6987e198e85fec55983613dcf` (branch `authz-ae0-baseline`)
- **Reproduce with:** `node scripts/service-role-dml-census.mjs` (human-readable) or
  `node scripts/service-role-dml-census.mjs --json` (machine-readable, sorted, diffable).
  Self-test (detector-can-fail proof, §3): `node scripts/service-role-dml-census.mjs --self-test`.
- **Deriving instrument:** `scripts/service-role-dml-census.mjs`. This document is the
  recorded output of one run plus the human classification/finding layer on top of it — the
  script, not this file, is re-run to check for drift. A diff between a fresh run and the
  table in §4 is itself a finding.

## 1. The property (not the syntax)

> A call site is **IN SCOPE** when a write (or a write-adjacent authorization act, see the
> Storage note below) is issued through a Supabase client that was constructed with the
> service-role key — traced back to `createAdminClient()` in `src/lib/supabase/admin.ts`,
> the **only** factory in `src/` that reads `SUPABASE_SERVICE_ROLE_KEY` (verified by grep:
> the only other `@supabase/supabase-js` value-import in `src/` is that file itself; every
> other file importing `SupabaseClient` imports it as a **type**, i.e. accepts a client the
> *caller* chooses — never constructs one, confirmed by `grep -rn "@supabase/supabase-js" src/`
> — see §5 for the full method).

"Write" is four families, because a `.from(` grep alone silently misses three of them:

- **A.** `<client>.from('<table>').{insert,upsert,update,delete}(...)` — raw DML
- **B.** `<client>.rpc('<name>', ...)` — opaque; both a name-suffix and an actor-argument
  heuristic are recorded, but the SQL body is never read (see §6)
- **C.** `<client>.storage.from('<bucket>').{upload,update,remove,move,copy}(...)` — Storage
  writes
- **C′.** `<client>.storage.from('<bucket>').createSignedUploadUrl(...)` — mints upload
  *capability* rather than writing bytes; tracked as its own `storage-sign` family rather
  than folded into "write" (different guarantee) or dropped as a "read" (found during this
  sweep — see §7 finding 2)
- **D.** `<client>.auth.admin.{createUser,updateUserById,deleteUser,inviteUserByEmail,generateLink}(...)`
  — Auth-admin writes

## 2. Buckets — three, never two, plus a fourth for test files

| Bucket | Meaning |
| --- | --- |
| `IN_SCOPE` | Root resolves to a `createAdminClient()`-constructed client |
| `OUT_OF_SCOPE` | Root resolves to a `createClient()`-constructed client (`@/lib/supabase/server` or `.../browser`, i.e. anon-key, user-session, RLS-bound) |
| `UNRESOLVED` | The script cannot decide — **never silently folded into either scope bucket** |
| `EXCLUDED_TEST` | The site is in a `*.test.ts(x)` / `*.spec.ts(x)` file — exercises a mocked client, not a production write path; reported, not dropped |

Client identification is the hard half. Two tiers:

- **Tier 1 (direct):** a local `const x = createAdminClient()` / `await createClient()`, or an
  inline call at the write site itself.
- **Tier 2 (one-hop):** a function parameter typed as a Supabase client (`SupabaseClient<...>`,
  a local `type Alias = SupabaseClient<...>`, or `Awaited<ReturnType<typeof create(Admin)?Client>>`
  — all three shapes are live in this codebase, see §7 finding 1). Every call site of the
  enclosing **named** function, anywhere under `src/` (test files excluded — see §7 finding 3),
  is inspected and the argument at the matching position is classified the same way. All
  production callers passing a `USER_SESSION` client ⇒ `OUT_OF_SCOPE`; any passing
  `SERVICE_ROLE` ⇒ `IN_SCOPE`; anything left ambiguous (anonymous function, zero discoverable
  callers, a second-hop parameter, a non-identifier argument) ⇒ `UNRESOLVED`.

## 3. Detector-can-fail proof (`--self-test`)

```
[self-test] (a) baseline: detector must find the known profiles writes...
[self-test]   OK: found 5 IN_SCOPE profiles write site(s)
[self-test] (b) neutralizing one known site (rename admin -> admin_neutered)...
[self-test]   OK: neutralized file shows ZERO IN_SCOPE profiles write sites in this file
[self-test] (c) restoring and confirming return to baseline...
[self-test]   OK: restored IN_SCOPE count matches baseline (45)

[self-test] PASS: detector demonstrably finds a known site and can be made to miss one.
```

(a) proves the detector finds a known site (`src/lib/users/actions.ts`'s five `profiles`
writes). (b) proves it can be made to **miss** one: the script's own working copy of that
file has every bare `admin` identifier renamed to `admin_neutered` (in-memory write via the
`Write`/`fs.writeFileSync` path, never a shell redirect), the census is re-run, and the
`profiles` hits in that file drop to zero. (c) restores the file byte-for-byte and re-runs to
confirm the count returns to baseline (45, not a stale number from (a)'s pre-`storage-sign`
count of 41 — the self-test recomputes both counts live). `git status`/`git diff --stat`
after every run in this session showed only the two new files added, confirming the
perturbation never left the working tree — see §8.

## 4. Headline numbers and the delta vs the plan's "12"

**581 → 585 write-shaped call sites total** found under `src/` (585 after adding the
`storage-sign` family in §7 finding 2); **45 `IN_SCOPE`, 540 `OUT_OF_SCOPE`, 0 `UNRESOLVED`,
0 `EXCLUDED_TEST`** (142 test files were walked and none contained a literal write-shaped
chain — mocks in this codebase define query builders as object literals, e.g. `insert: vi.fn()`,
which doesn't match the four families; this is a real, checked absence, not an unexamined one).

**The plan's 12-site figure is reproduced exactly** by restricting to family A (raw DML) alone:

| Table | Count | File(s) |
| --- | --- | --- |
| `profiles` | 6 | `src/lib/users/actions.ts` (5: `deactivateUser`, `reactivateUser`, `registerUser`, `suspendUser`, `updateUserProfile`) + `src/lib/auth/actions.ts` (1: `updatePassword`) |
| `professional_credentials` | 4 | `src/lib/users/actions.ts` (`registerUser` insert, `removeCredential` delete, `upsertCredential` insert + update) |
| `meeting_minutes_jobs` | 2 | `src/lib/minutes-jobs/reconcile.ts` (`deleteAudio`) + `src/lib/minutes-jobs/sweep.ts` (`sweepStaleAudio`) |
| **Total** | **12** | matches the plan's "five `profiles` + four `professional_credentials` … one self-scoped `profiles` … two `meeting_minutes_jobs`" verbatim |

**Delta: +33 (45 − 12), entirely from families the plan's original count did not enumerate**
(the plan itself says to include them — this is the re-derivation doing its job, not a
detector defect):

| Family | Count | Note |
| --- | --- | --- |
| `.rpc()` | +19 | 8 look actor-explicit by this repo's `_for`-suffix + explicit-actor-arg convention (pre-existing `memberships`/`hospital_affiliations` doors); 11 show no actor argument at JS level |
| Storage writes (`upload`/`remove`) | +6 | `documents`, `pdf-mint`, `minutes-jobs` (×2 remove) |
| Storage sign-upload (`createSignedUploadUrl`) | +4 | new family added mid-sweep — §7 finding 2 |
| Auth-admin | +4 | `createUser` ×1, `inviteUserByEmail` ×3 |
| **Total delta** | **+33** | |

No Family-A miss was found anywhere in the delta — every additional site is a `.rpc()`,
Storage, or Auth-admin call, exactly the three families the task named as commonly missed by
a `.from(`-only sweep.

## 5. Full `IN_SCOPE` table (45 sites)

`symbol` and line numbers are **volatile** — re-derive by re-running the script, never by
grepping for a line. `[INDIRECT]` marks a Tier-2 (one-hop) resolution.

| File | Symbol | Write kind | Target | Notes |
| --- | --- | --- | --- | --- |
| `src/lib/auth/actions.ts` | `updatePassword` | update | `profiles` | self-scoped (`must_change_password`) — AE1.3 deliberately excludes this |
| `src/lib/documents/actions.ts` | `beginDocumentUpload` | storage-sign-upload | `<dynamic:file.storage_bucket>` | |
| `src/lib/documents/actions.ts` | `finalizeDocumentUpload` | rpc | `complete_document_upload_verification` | write-like; no actor arg |
| `src/lib/documents/actions.ts` | `finalizeDocumentUpload` | rpc | `complete_evidence_upload_verification` | write-like; no actor arg |
| `src/lib/documents/actions.ts` | `reclassifyDocument` | rpc | `complete_document_disposal` | write-like; no actor arg |
| `src/lib/documents/actions.ts` | `reclassifyDocument` | rpc | `complete_document_reclassification` | write-like; no actor arg |
| `src/lib/documents/actions.ts` | `reclassifyDocument` | storage-remove | `<dynamic:oldFile.storage_bucket>` | |
| `src/lib/documents/actions.ts` | `reclassifyDocument` | storage-upload | `<dynamic:newFile.storage_bucket>` | |
| `src/lib/members/invite.ts` | `resolveOrInviteUser` | auth-admin-inviteUserByEmail | `inviteUserByEmail` | `[INDIRECT]` — traced via `src/lib/admin/actions.ts:265` and `src/lib/platform/actions.ts:183`, both passing `admin` |
| `src/lib/minutes-jobs/actions.ts` | `failAndCleanUp` | rpc | `fail_minutes_job` | write-like; no actor arg — system actor (AE1.3 excludes) |
| `src/lib/minutes-jobs/actions.ts` | `startMinutesJob` | storage-sign-upload | `<dynamic:MEETING_AUDIO_BUCKET>` | |
| `src/lib/minutes-jobs/reconcile.ts` | `deleteAudio` | storage-remove | `<dynamic:MEETING_AUDIO_BUCKET>` | system actor |
| `src/lib/minutes-jobs/reconcile.ts` | `deleteAudio` | update | `meeting_minutes_jobs` | system actor — AE1.3 deliberately excludes this |
| `src/lib/minutes-jobs/reconcile.ts` | `failJob` | rpc | `fail_minutes_job` | write-like; no actor arg |
| `src/lib/minutes-jobs/sweep.ts` | `sweepStaleAudio` | rpc | `list_stale_meeting_audio` | read-like (`list_` prefix) |
| `src/lib/minutes-jobs/sweep.ts` | `sweepStaleAudio` | storage-remove | `<dynamic:MEETING_AUDIO_BUCKET>` | system actor |
| `src/lib/minutes-jobs/sweep.ts` | `sweepStaleAudio` | update | `meeting_minutes_jobs` | system actor — AE1.3 deliberately excludes this |
| `src/lib/minutes-jobs/webhook.ts` | `failJob` | rpc | `fail_minutes_job` | write-like; no actor arg |
| `src/lib/minutes-jobs/webhook.ts` | `handleMeetingMinutesCallback` | rpc | `complete_minutes_job` | write-like; no actor arg |
| `src/lib/pdf-mint/actions.ts` | `mintPrintedDocument` | storage-remove | `<dynamic:bucket>` | |
| `src/lib/pdf-mint/actions.ts` | `mintPrintedDocument` | storage-upload | `<dynamic:bucket>` | |
| `src/lib/platform/actions.ts` | `assignOrgAdmin` | rpc | `grant_role_for` (×2 call sites) | `_for` convention; explicit actor arg present |
| `src/lib/queries/feature-flags.ts` | `<anonymous function>` (`getFeatureFlagsServerOnly`) | rpc | `get_feature_flags` | read-like (`get_` prefix) |
| `src/lib/queries/printed-documents.ts` | `lookupPrintedDocumentVerification` | rpc | `lookup_printed_document` | read-like (`lookup_` prefix) |
| `src/lib/safety/capa-actions.ts` | `beginCapaEvidenceUpload` | storage-sign-upload | `<dynamic:file.storage_bucket>` | |
| `src/lib/safety/rca-actions.ts` | `beginRcaEvidenceUpload` | storage-sign-upload | `<dynamic:file.storage_bucket>` | |
| `src/lib/users/actions.ts` | `assignCommitteeRole` | rpc | `grant_role_for` | `_for` convention; explicit actor arg present |
| `src/lib/users/actions.ts` | `deactivateUser` | update | `profiles` | AE1.3 door #4 (`set_person_active_for`) |
| `src/lib/users/actions.ts` | `ensureActiveAffiliation` | rpc | `affiliate_person_for` | `_for` convention; explicit actor arg present |
| `src/lib/users/actions.ts` | `reactivateUser` | update | `profiles` | AE1.3 door #4 (`set_person_active_for`) |
| `src/lib/users/actions.ts` | `registerUser` | auth-admin-createUser | `createUser` | |
| `src/lib/users/actions.ts` | `registerUser` | auth-admin-inviteUserByEmail | `inviteUserByEmail` | |
| `src/lib/users/actions.ts` | `registerUser` | insert | `professional_credentials` | AE1.3 door #5 (`upsert_credential_for`) |
| `src/lib/users/actions.ts` | `registerUser` | rpc | `affiliate_person_to_org_for` | `_for` convention; explicit actor arg present |
| `src/lib/users/actions.ts` | `registerUser` | rpc | `grant_role_for` | `_for` convention; explicit actor arg present |
| `src/lib/users/actions.ts` | `registerUser` | rpc | `log_cpf_probe_for` | `_for` convention; explicit actor arg present |
| `src/lib/users/actions.ts` | `registerUser` | update | `profiles` | AE1.3 door #1 (`finalize_invited_person_for`) |
| `src/lib/users/actions.ts` | `removeCommittee` | rpc | `revoke_role_for` | `_for` convention; explicit actor arg present |
| `src/lib/users/actions.ts` | `removeCredential` | delete | `professional_credentials` | AE1.3 door #5 (`delete_credential_for`) |
| `src/lib/users/actions.ts` | `resendInvite` | auth-admin-inviteUserByEmail | `inviteUserByEmail` | |
| `src/lib/users/actions.ts` | `suspendUser` | update | `profiles` | AE1.3 door #4 (`suspend_person_for`) |
| `src/lib/users/actions.ts` | `updateUserProfile` | update | `profiles` | AE1.3 door #2/#3 (`update_person_fields_for`, incl. `cpf_change` arm) |
| `src/lib/users/actions.ts` | `upsertCredential` | insert | `professional_credentials` | AE1.3 door #5 (`upsert_credential_for`) |
| `src/lib/users/actions.ts` | `upsertCredential` | update | `professional_credentials` | AE1.3 door #5 (`upsert_credential_for`) |

Family totals: 12 from-verb + 19 rpc + 6 storage + 4 storage-sign + 4 auth-admin = **45**.

## 6. `.rpc()` actor-validation — what is and isn't checkable from JS

19 `.rpc()` sites on a service-role client. For each, two call-site-only signals are recorded
(never a substitute for reading the SQL — migration text is stale by design per CLAUDE.md, and
this script never reads migration files):

- `nameSuggestsFor`: does the RPC name end in `_for` (this repo's convention, per
  `scripts/check-memberships-door.mjs`, for a service-role sibling taking an explicit actor)?
- `actorArgPresent`: does the options object passed to `.rpc()` carry a key matching
  `p_actor`/`actor_id`/`p_caller`/`caller_id`/`acting_*`?

Both true for **8/19**: `grant_role_for` (×3: `platform/actions.ts` ×2 call sites +
`users/actions.ts`), `affiliate_person_for`, `affiliate_person_to_org_for`,
`log_cpf_probe_for`, `revoke_role_for`. These are calls into **pre-existing** doors for
`memberships` / `hospital_affiliations` (ADR 0094/0097/0098) — outside AE1.3's *person*-authority
scope, and by this repo's established pattern they look actor-validating from the call site.
**`actorValidating` is nonetheless recorded as `UNRESOLVED (SQL body not read)` for every one of
the 19** — the JS-side heuristic is evidence, not a verdict; confirming the SQL predicate
re-derives authority (rather than trusting the caller's `p_actor` value) needs a live
`pg_proc`/`prosrc` read, which this script deliberately does not perform (per the task's
explicit instruction and CLAUDE.md's "catalog is truth" rule).

The other **11/19** show no actor argument at the call site at all: 4 document-workflow RPCs
(`complete_document_upload_verification`, `complete_evidence_upload_verification`,
`complete_document_disposal`, `complete_document_reclassification`), 4 minutes-job lifecycle
RPCs (`fail_minutes_job` ×3 call sites across `actions.ts`/`reconcile.ts`/`webhook.ts`,
`complete_minutes_job`), `list_stale_meeting_audio`, `get_feature_flags`, and
`lookup_printed_document`. A name-prefix heuristic (`rpcKind`, non-authoritative, recorded
per-row) further splits these into 3 read-like (`get_`, `list_`, `lookup_` prefixes) and the
remaining write-like or ambiguous. None of the 11 are in AE1.3's door table — see §7 finding 4.

## 7. Findings

1. **Type-erased client parameters exist in three distinct shapes**, and only the most literal
   one (`SupabaseClient<Database>`) was caught by a naive text match. Found during this sweep:
   `type Client = SupabaseClient<Database>` (a local alias, `src/lib/minutes-jobs/context.ts`)
   and `Awaited<ReturnType<typeof createClient>>` (a derived type with no `SupabaseClient` token
   at all, `src/lib/queries/cases.ts` and `src/lib/queries/documents.ts`). The script resolves
   one level of local type alias and recognizes the `ReturnType<typeof create(Admin)?Client>`
   shape explicitly (`looksLikeSupabaseClientType`); without that, all three sites downstream of
   those parameters would have reported `UNRESOLVED` instead of correctly tracing to
   `USER_SESSION` — an escape hatch that would have under-counted `UNRESOLVED` while also
   silencing a real (if negative) resolution.
2. **`createSignedUploadUrl` is a Storage write-adjacent operation the original family list
   missed** — it mints upload capability rather than writing bytes, so it matches neither
   "write" nor "read" cleanly. Found live on the service-role client in 4 places:
   `documents/actions.ts:beginDocumentUpload`, `minutes-jobs/actions.ts:startMinutesJob`,
   `safety/capa-actions.ts:beginCapaEvidenceUpload`, `safety/rca-actions.ts:beginRcaEvidenceUpload`.
   Added as its own `storage-sign` family (§1) rather than folded into `storage-upload` (would
   overstate "wrote bytes") or dropped (would silently under-count the census the task asked
   for). **This family is a genuine addition the plan's text does not mention at all** — flag
   for AE1.4's registry, which currently enumerates "table DML, `.rpc()`, Storage, Auth admin"
   and would otherwise miss it under "Storage" without a name.
3. **Test-file callers manufacture false ambiguity in Tier-2 resolution if not excluded.**
   `composeMeetingMinutesContext` (`src/lib/minutes-jobs/context.ts`) has exactly one production
   caller (passes `USER_SESSION`) and nine mock call sites across `context.test.ts`. Before
   test-file callers were excluded from the Tier-2 caller scan, the aggregate read as
   "ambiguous" (1 real answer outvoted by 9 unclassifiable mocks) and the site sat
   `UNRESOLVED`. This is the same shape as `docs/learning`'s "a register's failure mode" class
   of finding, transplanted into a detector: an escape hatch (treating every caller equally)
   silenced a real, resolvable answer. Fixed by excluding `*.test.ts(x)`/`*.spec.ts(x)` from the
   caller census (§2), consistent with why they get their own `EXCLUDED_TEST` bucket rather than
   folding into any of the other three.
4. **AE1.3's "nine person-authority door conversions" table accounts for exactly 9 of the 12
   Family-A (raw DML) sites — and 0 of the other 33 IN_SCOPE sites.** The 9 are: the `profiles`
   invite-flow patch, the `profiles` person-fields update (+ its `cpf_change` capability arm,
   same site), deactivate/reactivate/suspend (`profiles.is_active`/`suspended_until`, 3 sites →
   2 doors), and the 4 `professional_credentials` writes (2 doors). The other 3 Family-A sites
   are **deliberately** excluded by the plan's own text (self-scoped `must_change_password`;
   system-actor `meeting_minutes_jobs` ×2) — accounted for, not a gap.
   **What is not accounted for anywhere in AE1.3:** the 19 `.rpc()` sites, 6 Storage writes, 4
   Storage sign-upload sites, and 4 Auth-admin sites — 33 of the 45 `IN_SCOPE` sites, almost
   three-quarters of the census. AE1.4 ("the service-role DML registry") is the only place the
   plan commits to giving these a documented revalidation mechanism ("door name, or
   'self-scoped by construction', or 'system actor: `<invariant>`'"), and for the 11 no-actor-arg
   `.rpc()` sites in particular (§6) that determination is **currently open** — none of them
   carries an obvious "self-scoped" or "system actor" justification the way the
   `meeting_minutes_jobs` writes do, and none is a pre-existing door the way the 8 `_for` RPCs
   are. This is a PO-visible gap, not a detail: if AE1.4's registry is populated by hand against
   a mental model of "the nine conversions plus the two system-actor writes," it will miss these
   11 `.rpc()` sites, the 4 `createSignedUploadUrl` sites, the other Storage writes, and the
   `auth-admin` sites entirely.

## 8. Working-tree hygiene

`git status --porcelain` and `git diff --stat` after every census run in this session (including
after `--self-test`, which perturbs `src/lib/users/actions.ts` in place and restores it) showed
zero modifications to tracked files — only this document and the script itself are new,
untracked files. No other file was created, edited, or touched.

## 9. Known limitations of the script (stated, not hidden)

- Cross-file function-name resolution (Tier 2) matches by **identifier name only** — it does
  not resolve module identity or type-check. Two functions with the same name in different
  modules would be conflated. Not observed in this codebase (checked by hand for the one
  Tier-2 case that fired, `resolveOrInviteUser` — unique name, two callers, both real).
- Tier 2 stops at **one hop**: a parameter passed through a second layer of generic-client
  indirection is `UNRESOLVED`, not chased further. None occurred in this run (0 `UNRESOLVED`
  after the fixes in §7 findings 1 and 3) — but a future call graph that adds a second hop would
  correctly re-introduce an `UNRESOLVED` row rather than mis-resolve silently.
- `rpcKind` (read-like/write-like/ambiguous) is a **name-prefix heuristic only**, used solely to
  annotate the recorded doc — it never changes IN/OUT/UNRESOLVED bucketing, which is decided
  purely by client identification.
- The script does not evaluate the TS-side authorization checks that may precede a write inside
  the same function (e.g. `requireOrgAdmin()`-style guards before `registerUser`'s Auth-admin
  calls) — it answers "which client, which write," not "is the surrounding code otherwise
  safe." That question is AE1.2–AE1.4's, not this census's.

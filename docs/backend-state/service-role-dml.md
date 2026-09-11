# Backend State — the service-role DML registry

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

## Current state

**Updated:** 2026-09-11 — a REPLACEABLE projection of the frozen slices below; the rules that govern it are [`README.md` § Maintenance rules](README.md#maintenance-rules) 7–8.

### Surface

- **The registry** — one row per call site in `src/` that issues a write (or a write-adjacent
  authorization act) through a `createAdminClient()`-constructed (service-role) Supabase client. It
  is a **standing registry, never a phase narrative**: it never concludes, it is re-derived. Seven
  columns per row: **Key · Site · Owner · Reason · Revalidation mechanism · Audit event · Test**.
- **The `Key` column is the machine-readable half** — `path::symbol::writeKind::target`, never the
  line number, which is volatile. It sits in the same row as the prose so the two cannot drift into
  separate copies; edit a key only because the *site* changed.
- **Rows are grouped by what re-establishes authority**, not by module: person-authority doors ·
  self-scoped by construction · system actor · pre-existing `_for` doors · the PO-ruled `.rpc()`
  family · storage writes and signed-upload mints, both RPC-preceded · auth-admin.
- **Two instruments, not one** — `scripts/service-role-dml-census.mjs` derives the site set from
  source (`--json` sorted and diffable; `--self-test` proves the detector can both find a known site
  and be made to miss one), and gate 11 `scripts/check-service-role-registry.mjs`
  (`npm run lint:service-role-registry`) multiset-diffs that set against the rows below.

### Invariants

- **The derivation-vs-registry diff is a MACHINE check, not a human comparison** — gate 11 runs the
  census and diffs it against the `Key` cell of every row, exiting non-zero on any delta. ⚠ The
  comparison is a **MULTISET, not a set**: two rows may legitimately share one identity
  (`assignOrgAdmin` calls `grant_role_for` twice), and a set comparison would let one of them be
  deleted without a red.
- **Three shapes are each their own red**: a table added with no `Key` header column, a row whose key
  will not parse, and a parse yielding **zero** keys. ⛔ An empty parse must never read as a clean
  diff.
- **The census UNDER-COUNTS by design and the gate corrects for it** — ⛔ do not read its `IN_SCOPE`
  total as the site count. It detects *member* calls (`client.rpc('name')`), so service-role calls
  made through the *free* wrapper `callDoor(client, 'name', args)` (`src/lib/types/rpc-args.ts`) are
  invisible to it and surface as **one** placeholder row targeting `<dynamic:fn>`. The gate drops the
  placeholder, derives the real sites from source, and asserts the substitution in **both**
  directions, so the expansion rule cannot go stale silently. A `callDoor` whose client or
  function-name argument cannot be resolved is a **hard failure, never a silent skip**.
- ⚠ **"None found in TS" is not "unaudited".** The Audit-event column reads the TS call site only; it
  does ⛔ **not** establish whether the target table carries a DB-side audit trigger (Rule 11) — that
  is a `pg_trigger` question this registry does not ask.
- ⚠ **`door: X` is a door's NAME, measured from the call site.** That the body *re-derives* the
  caller's authority rather than trusting the `p_actor` it is handed is a `pg_proc` / `prosrc`
  question this registry **does not answer** — ⛔ never quote a row as proof that the SQL predicate is
  correct. The same caveat is why the pre-existing-door rows record `actorValidating` as
  `UNRESOLVED (SQL body not read)`: the call site passing an actor is evidence, never a verdict.
- **Every row states its Test explicitly, including "none"** where that is the honest answer — a
  blank read as passing would defeat the column's point.

### Rollout

- ⛔ **No feature flag governs this seam**: it is a derived map of `src/`, so a row appears or
  disappears when a call site does, never by a cutover. Resolve any flag's VALUE from
  [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here.
- The door conversion that reshaped the person-authority group was flagless in the same way — raw-DML
  rows left and door rows arrived in one increment. The TS `personScopeAllows` /
  `authorizePersonScopedAdmin` guards still sitting ahead of those rows are **defense-in-depth and
  the pt-BR message, not the authority** — the door is.

### Open edges

- **A row reading `NONE` or `UNCONFIRMED` is a measured property of the platform, not a gap in a
  review pass.** The `UNCONFIRMED` rows are one shape: the shared `registerUser` entry gate, whose
  denial path was not found in the reported coverage and is ⛔ **not proven absent**.
- ⚠ **The Summary's tally is a paragraph about a table that changes under it, and it says so
  itself** — "re-derive this paragraph from the rows whenever the table changes … never adjust the
  numbers arithmetically, which is how a direction gets fixed while the magnitude stays wrong". ⛔ Do
  not quote the tally: the live row count is gate 11's own output line. The slice already records one
  of its sentences having gone **stale against its own table**.
- Two ruled rows carry filed, unfixed follow-ups: `FUP-DOC-RECLASS-OPERATION-ID` (operation-id
  binding) and `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT`.
- ⚠ One row is **WRITE-BEARING where its name reads as a lookup** — the public verification-code
  door inserts a `verification_lookups` row on every call, matched or not.

### Where the detail lives

- The frozen slice below: **§ Service-role DML registry** — its preamble (columns, deriver, the
  `callDoor` expansion), **§ Groups A–H**, and **§ Summary**.
- The ruled mechanisms, row by row: [`authz-ae1-rpc-rulings.md`](../design/authz-ae1-rpc-rulings.md),
  cited from **§ Group E — RULED 2026-08-27**.
- Signatures, `prosecdef` and EXECUTE grants for every door named here:
  [`generated-rpc-surface.md`](generated-rpc-surface.md) ·
  [`generated-helper-surface.md`](generated-helper-surface.md).
- ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (Phase AE1;
  AE1.4 `[PA-F10]` is where "the registry is re-derived, never hand-maintained" comes from) ·
  ADR [0206](../decisions/0206-the-service-role-dml-registry-gets-its-own-seam.md) (this file).

## Service-role DML registry (AE1.4; ADR 0155 Phase AE1; measured 2026-08-27)

_Every call site in `src/` that issues a write (or a write-adjacent authorization act) through
a `createAdminClient()`-constructed (service-role) Supabase client — one row per site. Like
"Zero-policy tables" above, this is a **standing registry, never a phase narrative**: it never
concludes, it is re-derived. **Owner** = the domain module responsible for the call site.
**Reason** = why the write legitimately bypasses RLS. **Revalidation mechanism** = what
re-establishes the caller's authority before the write fires (a door name, "self-scoped by
construction", "system actor: `<invariant>`", or `UNDECIDED`). **Audit event** = an audit-log
emission **visible from the TS call site only** — an explicit audit helper call, or an RPC whose
name signals logging (e.g. `log_cpf_probe_for`). ⚠ **"None found in TS" is not "unaudited"** — it
does not verify whether the target table itself carries a DB-side audit trigger (Rule 11); that
is a `pg_trigger` catalog question this registry does not attempt to answer (out of this task's
scope — see CLAUDE.md's "catalog is truth" exception). **Test** = the test that would go red if
this mechanism were removed. A blank read as passing would defeat the point of this column, so
every row states one explicitly, including "**none**" where that is the honest answer.

**Deriving instrument, re-derivation, and the diff:** `scripts/service-role-dml-census.mjs` is
the deriver (AE0.4). Reproduce with `node scripts/service-role-dml-census.mjs` (human-readable)
or `--json` (sorted, diffable); `--self-test` proves the detector can both find a known site and
be made to miss one. The diff against this table is **no longer a human comparison**: gate 11,
`npm run lint:service-role-registry` (`scripts/check-service-role-registry.mjs`), runs the census
and multiset-diffs it against the **`Key` cell of every row below**, exiting non-zero on any
delta. ⚠ **The `Key` column is the machine-readable registry** — `path::symbol::writeKind::target`,
never the line number, which is volatile. It lives in the same row as the prose so the two cannot
drift into separate copies; edit a row's key only because the *site* changed. A table added
without a `Key` header column, a row whose key will not parse, and a parse yielding **zero** keys
are each their own red — an empty parse must never read as a clean diff.

⚠ **Comparison is a MULTISET, not a set.** Two rows may legitimately share one identity —
`assignOrgAdmin` calls `grant_role_for` twice (org tier, single-hospital auto-seat) — and a set
comparison would let one of them be deleted without a red.

⛔ **The census under-counts by design, and the gate corrects for it — do not read its
`IN_SCOPE` total as the site count.** The census detects *member* calls (`client.rpc('name')`).
AE1.3 introduced **`callDoor(client, 'name', args)`** (`src/lib/types/rpc-args.ts`), a *free*
function that widens the generated arg types to admit an explicit NULL — so five real
service-role door calls became invisible to it. What it reports instead is **one** row for the
wrapper's own inner `client.rpc(fn, …)`, target `<dynamic:fn>`, naming only the first
service-role caller it happens to find. That single row stands in for N call sites. The gate
therefore **drops the placeholder and derives the five real sites from source**, and asserts the
substitution in *both* directions (placeholder with no derived site, or derived sites with no
placeholder, are each a red), so the expansion rule cannot go stale silently. A `callDoor` whose
client or function-name argument cannot be resolved is a hard failure, never a silent skip.

Re-derived 2026-08-27 at commit `599920e0` (**post-AE1.3**): **44 sites** = census `IN_SCOPE` 40
− 1 wrapper placeholder + 5 `callDoor` expansions. Composition: 3 `from-verb` + 27 `rpc` + 6
`storage` + 4 `storage-sign` + 4 `auth-admin` = 44 — census self-test PASS, gate self-test PASS.

✅ **AE1.3 HAS LANDED** (it had not at the previous measurement, commit `e7c26068`). All six
person-authority doors exist and Group A's nine raw-DML rows are gone: seven converted to door
calls, and `upsertCredential`'s update+insert **pair consolidated into one** `upsert_credential_for`
call — 9 rows out, 8 in. The doors are now the authority; the TS `authorizePersonScopedAdmin` →
`personScopeAllows` guards are kept as defense-in-depth and a friendlier pt-BR message, per plan.
⚠ Five of the eight are reached through `callDoor`, i.e. **invisible to the raw census** — the
paragraph above is what keeps them in this table.

### Group A — person-authority `profiles` / `professional_credentials` (8 sites; AE1.3 doors, LANDED)

`personScopeAllows(capability, footprint, administeredHospitalIds)` (`src/lib/users/person-scope.ts`)
is the shared TS predicate still invoked ahead of every row below via
`authorizePersonScopedAdmin(userId, capability)` in `src/lib/users/actions.ts`; capabilities are
`'fields' | 'credentials' | 'cpf_change' | 'lifecycle'`. Since AE1.3 those calls are
**defense-in-depth and the pt-BR message**, not the authority — the door is.

⚠ **What "door: `X`" is evidence of here.** The door NAME is measured from the TS call site (and
`src/lib/types/database.ts`, which only exists because the function does). That each body
*re-derives* the caller's authority rather than trusting the `p_actor` it is handed is a
`pg_proc`/`prosrc` question this registry **does not answer** — the same standing caveat Group D
carries. Do not quote a row here as proof the SQL predicate is correct.

⛔ **Five of these eight are reached through `callDoor(...)` and are therefore INVISIBLE to a raw
census run** — marked `[via callDoor]`. See the expansion paragraph above; gate 11 derives them.

| Key | Site | Owner | Reason (service-role need) | Revalidation mechanism | Audit event | Test that would notice the guard vanish |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/users/actions.ts::deactivateUser::rpc::set_person_active_for` | `users/actions.ts:deactivateUser` → rpc `set_person_active_for` | users | admin deactivates another person's account; RLS has no cross-person write path | **door: `set_person_active_for`**; TS defense-in-depth: `authorizePersonScopedAdmin(userId,'lifecycle')` (SUBSET) | none found in TS | **YES** — `d14-person-level.test.ts` §1 (allowed, sole footprint), §2 (**denied**, cross-hospital), §4, §6 (org_admin twin) + `e2e/hospital-admin-tier.spec.ts` (Desativar) |
| `src/lib/users/actions.ts::reactivateUser::rpc::set_person_active_for` | `users/actions.ts:reactivateUser` → rpc `set_person_active_for` | users | same as above, reverse direction; the SAME door serves both so `is_active` and `suspended_until` cannot drift apart | **door: `set_person_active_for`**; TS d-i-d: same call, `'lifecycle'` | none found in TS | **YES, with a caveat** — §1 (allowed) + §6 cited explicitly; the DENY arm is not separately named for `reactivateUser` in the reported coverage, but it is the **identical** `authorizePersonScopedAdmin(id,'lifecycle')` call that `deactivateUser`'s §2 deny-arm exercises — an incidental guard closing a hole the definition predicts, not an independently-proven one. Flag for a dedicated reactivate-deny arm. |
| `src/lib/users/actions.ts::suspendUser::rpc::suspend_person_for` | `users/actions.ts:suspendUser` → rpc `suspend_person_for` `[via callDoor]` | users | same predicate family, suspension arm | **door: `suspend_person_for`** — deliberately a SEPARATE door from `set_person_active_for`, so suspension cannot silently widen into deactivation; TS d-i-d: `'lifecycle'` | none found in TS | **YES** — §1, §2 (denied), §6 + `e2e/user-registration.spec.ts` (Suspender/"Confirmar suspensão") + `e2e/hospital-admin-tier.spec.ts` |
| `src/lib/users/actions.ts::updateUserProfile::rpc::update_person_fields_for` | `users/actions.ts:updateUserProfile` → rpc `update_person_fields_for` (fields + `cpf_change` arm, one door) `[via callDoor]` | users | admin edits another person's profile fields; CPF change escalates to a tighter bound | **door: `update_person_fields_for`** — carries BOTH bounds (`fields` INTERSECTION always, `cpf_change` SUBSET only when the CPF actually changes). ⚠ The `p_set_*` booleans carry the absent-key-vs-explicit-NULL distinction the old spread form carried; collapsing the pair would let an edit form that omits a field NULL IT OUT (ADR 0133 D9/D10, pinned pgTAP `385` §1.7). TS d-i-d: `'fields'` + `'cpf_change'` | none found in TS | **YES, thorough** — §1–§6 (sole/cross-hospital/whole-footprint/tier/sibling, CPF-presence-vs-change semantics) + `person-scope.test.ts` (predicate directly) + `e2e/hospital-admin-tier.spec.ts`, `e2e/aff2-scope-rule.spec.ts` |
| `src/lib/users/actions.ts::upsertCredential::rpc::upsert_credential_for` | `users/actions.ts:upsertCredential` → rpc `upsert_credential_for` — **ONE call; the pre-AE1.3 update-row + insert-row pair consolidated into it** `[via callDoor]` | users | admin edits an existing credential row for another person, or adds a new one | **door: `upsert_credential_for`**; TS d-i-d: `'credentials'` (INTERSECTION). The door RAISES `HC0T6` on a write that matched nothing rather than returning silent success, so there is no "salvo" message for a write that never happened | none found in TS | **YES** — `d14-person-level.test.ts` §1, §2, §4 (denied, expired-seat fixture). The former separate insert row shared this guard and this suite; one call site now, one row |
| `src/lib/users/actions.ts::removeCredential::rpc::delete_credential_for` | `users/actions.ts:removeCredential` → rpc `delete_credential_for` | users | admin deletes another person's credential row | **door: `delete_credential_for`**; TS d-i-d: `'credentials'`. ⚠ Deliberately the OPPOSITE no-match shape from `upsert_credential_for`'s update arm | none found in TS | **YES** — §1, §6 ("`removeCredential` must carry its OWN arm" — reported verbatim) |
| `src/lib/users/actions.ts::registerUser::rpc::finalize_invited_person_for` | `users/actions.ts:registerUser` → rpc `finalize_invited_person_for` (invite-flow profile patch) `[via callDoor]` | users | sets initial profile fields for a newly invited/registered person | **door: `finalize_invited_person_for`**; TS: entry gate only — session + `isOrgAdminCaller`/hospital-resolution check (**not** `personScopeAllows`). ⚠ **This cell read, until AE2:** *"`home_organization_id` is deliberately NOT in the column list: `handle_new_user` seeds it, and writing it would fire the deferred `profiles_tenant_has_org_trg`"* — **both halves are now false and the reason the column is absent has changed**: the column is DROPPED, `handle_new_user` seeds nothing, and `profiles_tenant_has_org_trg` no longer exists (`20261003005600`). The kernel's measured column list is `full_name` · `professional_category_id` · `cpf` · `date_of_birth` · `phone` · `must_change_password`; the org association is now written by the **creation door** (`affiliate_new_person_to_org_for`), a separate registry row. Its own gate is `app.can_administer_person_for('cpf_change', …)` — the SUBSET bound, not the intersection one | none found in TS | **UNCONFIRMED** — extensive d14 coverage of payload/routing correctness for authorized callers; no explicit assertion surfaced that an unauthenticated/non-admin caller is REJECTED at this entry gate specifically, and none names the door's own deny arm either |
| `src/lib/users/actions.ts::registerUser::rpc::upsert_credential_for` | `users/actions.ts:registerUser` → rpc `upsert_credential_for` (looped over the initial credentials) `[via callDoor]` | users | seeds the new person's initial credential(s) at registration time | **door: `upsert_credential_for`** — the same door `upsertCredential` uses, reached from the registration path under the shared entry gate (not `'credentials'`/`personScopeAllows`; registration is a different code path) | none found in TS | **UNCONFIRMED** — same caveat as the row above |

### Group B — self-scoped by construction (1 site)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/auth/actions.ts::updatePassword::update::profiles` | `auth/actions.ts:updatePassword` → update `profiles.must_change_password` | auth | clears the caller's OWN forced-change flag; needs service-role because the column is service-role-only writable (`guard_profile_privileged_columns`) | **self-scoped by construction** — `.eq('id', user.id)` where `user.id` comes from `supabase.auth.getUser()` on the SAME request, after `supabase.auth.updateUser({password})` succeeded. AE1.3 deliberately excludes this site ("converting it adds a door with no second principal") | none found in TS | **NONE, effectively** — `page.test.tsx` only stubs `updatePassword: vi.fn()` (doesn't exercise the real function); the one e2e round-trip (`e2e/user-registration.spec.ts`, invite-mode) is `test.skip`'d by default (needs `AUTH_EMAIL_VERIFICATION=on`) |

### Group C — system actor: `meeting_minutes_jobs` lifecycle (4 sites)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/minutes-jobs/reconcile.ts::deleteAudio::storage-remove::<dynamic:MEETING_AUDIO_BUCKET>` | `minutes-jobs/reconcile.ts:deleteAudio` → storage-remove (`MEETING_AUDIO_BUCKET`) | minutes-jobs | cleans up audio after job reconciliation; reached only after an RLS-scoped read (`app.is_staff_admin_of`) in `queries.ts` already gated the caller | **system actor: reconciliation runs only for a job the caller could already read under RLS** — no in-function check | none found in TS | **NONE** — no `reconcile.test.ts`; symbol not in any `*.test.ts` |
| `src/lib/minutes-jobs/reconcile.ts::deleteAudio::update::meeting_minutes_jobs` | `minutes-jobs/reconcile.ts:deleteAudio` → update `meeting_minutes_jobs` | minutes-jobs | same reconciliation, status flip | same as above | none found in TS | **NONE** — same absence |
| `src/lib/minutes-jobs/sweep.ts::sweepStaleAudio::storage-remove::<dynamic:MEETING_AUDIO_BUCKET>` | `minutes-jobs/sweep.ts:sweepStaleAudio` → storage-remove (`MEETING_AUDIO_BUCKET`) | minutes-jobs | TTL-based stale-audio sweep; explicitly "row-agnostic on purpose" | **system actor: cron/webhook-invoked, no end-user session; the only self-protection is an in-process throttle (`SWEEP_THROTTLE_MS`), a rate-limit not an authz guard** | none found in TS | **YES** — `sweep.test.ts` asserts the exact `list_stale_meeting_audio` call args, the single batched `remove()`, and that `audio_deleted_at` is stamped only for storage-confirmed removals |
| `src/lib/minutes-jobs/sweep.ts::sweepStaleAudio::update::meeting_minutes_jobs` | `minutes-jobs/sweep.ts:sweepStaleAudio` → update `meeting_minutes_jobs` | minutes-jobs | same sweep, status flip | same as above | none found in TS | **YES** — same test |

### Group D — pre-existing doors (`.rpc()`, decided; 8 sites)

Pre-existing `memberships`/`hospital_affiliations` `_for` doors (ADR 0094/0097/0098), outside
AE1.3's *person*-authority scope. `actorValidating` is recorded `UNRESOLVED (SQL body not read)`
by the census for every row here — the JS-side `_for`-suffix + explicit-`p_actor` heuristic is
evidence the call site passes an actor, never a verdict that the SQL predicate re-derives
authority rather than trusting it; that verification is a `pg_proc`/`prosrc` read this registry
does not perform.

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/admin/actions.ts::assignStaffAdmin::rpc::grant_role_for` | `admin/actions.ts:assignStaffAdmin` → rpc `grant_role_for` (commission-tier `staff_admin` grant) | admin | ⭐ **moved off the SESSION door by ADR 0168 Amdt 3**, not a new privilege: `app.grant_role_impl` calls `app.ensure_provisioned_org_affiliation`, which anchors the target to the commission's org (ADR 0166) and admitted an ANCHORLESS person — so via `public.grant_role` an `org_admin` holding only an orphan's uuid could anchor them AND grant a role (live-probed, accepted). Amdt 3 leaves that admission only on the `service_role` twin, which this path needs because `resolveOrInviteUser` may have just invited the person | door: `grant_role_for` — re-derives the SAME authority in PostgreSQL from `p_actor`, so the move trades no authority; TS gate: `authorizeStaffAdminOps(commissionId)` (org_admin of the commission's org OR hospital_admin of its hospital — ⚠ NOT platform_admin) | none found in TS | **YES** — `396 § 2.1` drives this exact shape, and Amdt 3's new cell asserts the SESSION door now refuses the same call `HC0R0`; the twin-asymmetry pin reds if anyone "restores symmetry" |
| `src/lib/platform/actions.ts::assignOrgAdmin::rpc::grant_role_for` | `platform/actions.ts:assignOrgAdmin` → rpc `grant_role_for` (org-tier grant) | platform | grants `org_admin` for a caller who isn't the target's own session | door: `grant_role_for` (pre-existing); TS gate: `requireAdmin()` via `getSessionContext()?.isAdmin` | none found in TS (relies on the door's DB-side trigger, unverified here) | **YES** — `e2e/platform-org-admin-provisioning.spec.ts` (MEM2-1/2/3; asserts `granted_by` attribution, idempotency, platform-only access) |
| `src/lib/platform/actions.ts::assignOrgAdmin::rpc::grant_role_for` | `platform/actions.ts:assignOrgAdmin` → rpc `grant_role_for` (single-hospital auto-seat of `hospital_admin`) | platform | auto-seats `hospital_admin` when the new org has exactly one hospital | door: `grant_role_for`; TS gate: same `requireAdmin()`, no additional check | none found in TS | **NONE** — no test asserts the auto-seat branch; no `src/lib/platform/**/*.test.ts` exists |
| `src/lib/users/actions.ts::assignCommitteeRole::rpc::grant_role_for` | `users/actions.ts:assignCommitteeRole` → rpc `grant_role_for` | users | grants a per-commission committee role | door: `grant_role_for`; TS gate: `authorizeForUser(userId)` AND `authorizeForCommission(commissionId)` (not `personScopeAllows`) | none found in TS | **NONE dedicated** — incidental-only `e2e/user-registration.spec.ts` ("Adicionar comissão") exercises the UI path, not a guard keystone |
| `src/lib/users/actions.ts::ensureActiveAffiliation::rpc::affiliate_new_person_for` | `users/actions.ts:ensureActiveAffiliation` → rpc `affiliate_new_person_for` | users | affiliates a person to a hospital during registration | door: `affiliate_new_person_for` (the CREATION door, ADR 0168 Amdt 1/2); TS gate: none in this (unexported, private) helper — `registerUser` authorizes before calling it | none found in TS | **YES, indirect** — `d14-person-level.test.ts` §9 asserts the RPC call + `p_started_on` payload + `e2e/aff4-registration-dates.spec.ts`, `e2e/aff-hospital-affiliation.spec.ts` |
| `src/lib/users/actions.ts::registerUser::rpc::affiliate_new_person_to_org_for` | `users/actions.ts:registerUser` → rpc `affiliate_new_person_to_org_for` | users | affiliates a person at the ORG tier (org_admin registrants only) | door: `affiliate_new_person_to_org_for` (the CREATION door, ADR 0168 Amdt 1/2); TS gate: entry gate **plus** `if (isOrgAdminCaller)` — a hospital_admin registrant must never reach this door | none found in TS | **YES** — §9 explicitly: "hospital_admin registrar NOT calling the org door" — a genuine guard-removal keystone |
| `src/lib/users/actions.ts::registerUser::rpc::log_cpf_probe_for` | `users/actions.ts:registerUser` → rpc `log_cpf_probe_for` | users | records a CPF-collision probe as a compensating control for the CPF-uniqueness oracle | door: `log_cpf_probe_for`; TS gate: entry gate only, fires unconditionally on match/no-match | **YES — the one explicit audit mechanism in this whole registry**, doc'd as "the compensating control for the [CPF] oracle" | **YES** — §9 asserts the probe call fires and never carries raw CPF digits |
| `src/lib/users/actions.ts::registerUser::rpc::grant_role_for` | `users/actions.ts:registerUser` → rpc `grant_role_for` (committee grants, looped) | users | seats the new person on 0+ committees at registration | door: `grant_role_for`; TS gate: entry gate + per-committee `allWithinHospital` (non-org-admin callers) | none found in TS | **NONE** — reported explicitly: "No arm directly exercises site 7 (`grant_role_for` for committees) inside `registerUser`" |
| `src/lib/users/actions.ts::removeCommittee::rpc::revoke_role_for` | `users/actions.ts:removeCommittee` → rpc `revoke_role_for` | users | removes a per-commission committee role | door: `revoke_role_for`; TS gate: `authorizeForUser` + `authorizeForCommission` (same pair as `assignCommitteeRole`) | none found in TS | **NONE dedicated** — incidental-only `e2e/user-registration.spec.ts` ("Remover de Comissão...") |

### Group E — RULED 2026-08-27 (11 `.rpc()` sites; formerly `UNDECIDED`)

PO-ruled 2026-08-27, approved as-is with four observations →
[authz-ae1-rpc-rulings.md](../design/authz-ae1-rpc-rulings.md) (evidence: live-catalog bodies +
ACLs; local↔remote **body-md5 parity, exact**; zero references to these functions in the
unregistered migrations — the R3 discharge). One site re-classified as an **in-function
door**, ten as **system actor**. Riders: **R1** ACL pins = pgTAP `388` §1; **R2** HMAC deny
test = `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` (a *condition* of the `complete_minutes_job`
ruling); **R3** discharged at recording. History, kept because it was the honest state for a
day: these rows were `UNDECIDED` because no actor argument, self-scoped shape, or
system-actor justification was visible **from the call site** — the rulings derive each
mechanism from the function bodies instead, and record what guards each premise.

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/documents/actions.ts::finalizeDocumentUpload::rpc::complete_evidence_upload_verification` | `documents/actions.ts:finalizeDocumentUpload` → rpc `complete_evidence_upload_verification` | documents | finalizes an evidence upload after client-side hash verification | **door (in-function)** — actor re-derived from `upload_sessions.reserved_by` (NULL refused) → `app.can_write_rca`/`can_write_capa` **before any write**; ruled 2026-08-27 → [rulings §1](../design/authz-ae1-rpc-rulings.md) | none in TS; **in-function, catalog-measured 2026-08-27:** `document.uploaded`/`document.upload_failed` (via the delegated verifier) | **YES** — `actions.test.ts` (MAJOR-3) terminal-state/ordering + pgTAP `388` §1 (ACL pin: service_role-only) |
| `src/lib/documents/actions.ts::finalizeDocumentUpload::rpc::complete_document_upload_verification` | `documents/actions.ts:finalizeDocumentUpload` → rpc `complete_document_upload_verification` | documents | same finalize step, non-evidence path | **system actor:** completion of a `consumed` upload session — single-transition state machine keyed by session id; authority spent at the user-session door `finalize_document_upload`; ruled → [rulings §2](../design/authz-ae1-rpc-rulings.md) | none in TS; **in-function, catalog-measured 2026-08-27:** `document.uploaded`/`document.upload_failed` | **YES** — same test + pgTAP `388` §1 |
| `src/lib/documents/actions.ts::reclassifyDocument::rpc::complete_document_reclassification` | `documents/actions.ts:reclassifyDocument` → rpc `complete_document_reclassification` | documents | records a completed reclassification after the storage copy | **system actor:** completion keyed to a `reserved` file object minted by the user-session door `reclassify_document`; sha + same-document + storage-presence preconditions in-function; ruled → [rulings §3](../design/authz-ae1-rpc-rulings.md); op-id binding = `FUP-DOC-RECLASS-OPERATION-ID` | none in TS; **in-function, catalog-measured 2026-08-27:** `document.reclassified` | pgTAP `388` §1 (ACL pin); behavioral coverage still **NONE** — unchanged by the ruling |
| `src/lib/documents/actions.ts::reclassifyDocument::rpc::complete_document_disposal` | `documents/actions.ts:reclassifyDocument` → rpc `complete_document_disposal` | documents | records a disposal after the old file is removed | **system actor:** records an **already-performed** storage deletion for a file already `disposal_pending`; closed byte-proof vocabulary + retention block + absence verification in-function; ruled → [rulings §4](../design/authz-ae1-rpc-rulings.md); provenance split = `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT` | none in TS; **in-function, catalog-measured 2026-08-27:** `document.disposed` (+ `document.retention_override` on exemption lanes) | pgTAP `388` §1 (ACL pin); behavioral coverage still **NONE** — unchanged by the ruling |
| `src/lib/minutes-jobs/actions.ts::failAndCleanUp::rpc::fail_minutes_job` | `minutes-jobs/actions.ts:failAndCleanUp` → rpc `fail_minutes_job` | minutes-jobs | marks a job failed during internal cleanup | **system actor:** terminal transition (`uploading`/`processing` → `failed`), latch **atomic in the UPDATE** since `20261003005000`; this path's gate = the caller's own RLS-scoped setup in `submitMinutesJob`; ruled → [rulings §5–7](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.failed` | **YES** — pgTAP `388` §2–3 (latch behavior + atomicity pins) |
| `src/lib/minutes-jobs/reconcile.ts::failJob::rpc::fail_minutes_job` | `minutes-jobs/reconcile.ts:failJob` → rpc `fail_minutes_job` | minutes-jobs | marks a job failed during page-load reconciliation | **system actor:** same atomic terminal transition; this path's gate = the `staff_admin`-gated RLS read (Group C); ruled → [rulings §5–7](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.failed` | **YES** — pgTAP `388` §2–3 |
| `src/lib/minutes-jobs/sweep.ts::sweepStaleAudio::rpc::list_stale_meeting_audio` | `minutes-jobs/sweep.ts:sweepStaleAudio` → rpc `list_stale_meeting_audio` | minutes-jobs | lists TTL-expired jobs to sweep | **system actor:** cron sweep input; read-only, bounded (limit ≤ 1000, age ≥ 1 h); ruled → [rulings §9](../design/authz-ae1-rpc-rulings.md) | none found in TS (read-only) | **YES** — `sweep.test.ts` pins the exact call args + pgTAP `388` §1 (ACL pin) |
| `src/lib/minutes-jobs/webhook.ts::failJob::rpc::fail_minutes_job` | `minutes-jobs/webhook.ts:failJob` → rpc `fail_minutes_job` | minutes-jobs | marks a job failed on a provider callback | **system actor:** same atomic terminal transition; this path's gate = the HMAC-verified route (`verifyCallbackSignature`) — **R2 condition:** `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`; ruled → [rulings §5–7](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.failed` | pgTAP `388` §2–3 for the RPC half; ✅ **route half LANDED 2026-08-27** — `src/app/api/webhooks/audio-jobs/route.rpc-boundary.test.ts` asserts the RPC is **not called** on a bad/absent signature and *is* called on a good one, red-first proven (gate neutralized → 7 failed / 3 passed, the 3 being the positive controls). `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` is RESOLVED → `follow-ups-archive.md` |
| `src/lib/minutes-jobs/webhook.ts::handleMeetingMinutesCallback::rpc::complete_minutes_job` | `minutes-jobs/webhook.ts:handleMeetingMinutesCallback` → rpc `complete_minutes_job` | minutes-jobs | completes a job on a provider callback | **system actor:** provider-callback completion; sole caller = the HMAC-verified route (**R2 condition:** `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`); `processing` → `done` latch **atomic** since `20261003005000`; ruled → [rulings §8](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.completed` | pgTAP `388` §2–3 for the RPC half; ✅ **route half LANDED 2026-08-27** — `src/app/api/webhooks/audio-jobs/route.rpc-boundary.test.ts` asserts the RPC is **not called** on a bad/absent signature and *is* called on a good one, red-first proven (gate neutralized → 7 failed / 3 passed, the 3 being the positive controls). `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` is RESOLVED → `follow-ups-archive.md` |
| `src/lib/queries/feature-flags.ts::<anonymous function>::rpc::get_feature_flags` | `queries/feature-flags.ts:getFeatureFlagsServerOnly` → rpc `get_feature_flags` | queries | reads flags for session-less server surfaces (`/verificar`, the audio-jobs webhook) | **system actor:** read-only global flag projection; the grant layer is the control (`authenticated` + `service_role`, `anon` excluded — pinned pgTAP `388` §1); ruled → [rulings §10](../design/authz-ae1-rpc-rulings.md) | none found in TS (read-only) | pgTAP `388` §1 (grant pin); `route.test.ts` still mocks this reader wholesale — unchanged by the ruling |
| `src/lib/queries/printed-documents.ts::lookupPrintedDocumentVerification::rpc::lookup_printed_document` | `queries/printed-documents.ts:lookupPrintedDocumentVerification` → rpc `lookup_printed_document` | queries | public verification-code lookup (ADR 0104 D10, deliberately anonymous *at the surface* — `anon` has NO EXECUTE; the server mediates) | **system actor (designed public surface):** `consumeLookupBudget` precedes every call; ⚠ **WRITE-BEARING** — every call inserts a `verification_lookups` row (hash-only; **audit-retention owner: the documents/printing domain**); invariant: `p_viewer` is always session-derived; ruled → [rulings §11](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `verification_lookups` insert on every call, matched or not | **YES** — `printed-documents.test.ts` (budget-before-RPC) + `printed-documents-caller-census.test.ts` (exactly-one-caller + budget-precedes-RPC pins) + pgTAP `388` §1 |

### Group F — Storage writes, RPC-preceded (4 sites)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/documents/actions.ts::reclassifyDocument::storage-upload::<dynamic:newFile.storage_bucket>` | `documents/actions.ts:reclassifyDocument` → storage-upload (new file, dynamic bucket) | documents | copies the object to its new classification's path (Rule 6: never overwrite, new path per upload) | authority established by the preceding `reclassify_document` RPC succeeding; no separate check at the storage call | none found in TS | **NONE** — no test references `reclassifyDocument`'s storage ops at all |
| `src/lib/documents/actions.ts::reclassifyDocument::storage-remove::<dynamic:oldFile.storage_bucket>` | `documents/actions.ts:reclassifyDocument` → storage-remove (old file) | documents | removes the superseded object after the copy | same as above | none found in TS | **NONE** — same absence |
| `src/lib/pdf-mint/actions.ts::mintPrintedDocument::storage-upload::<dynamic:bucket>` | `pdf-mint/actions.ts:mintPrintedDocument` → storage-upload | pdf-mint | writes the minted PDF bytes; authority is "anyone who can VIEW the source artifact," enforced by the `mint_printed_document` door called AFTER this upload | upload happens BEFORE the door call; on door failure the object is deleted (compensating cleanup, not a pre-write guard) | none found in TS | **NONE** — `compare-and-mint.test.ts` covers the ADR 0126 revision contract, not authorization/ordering of the storage ops |
| `src/lib/pdf-mint/actions.ts::mintPrintedDocument::storage-remove::<dynamic:bucket>` | `pdf-mint/actions.ts:mintPrintedDocument` → storage-remove (compensating cleanup on RPC failure) | pdf-mint | undoes the upload above if minting fails | same as above | none found in TS | **NONE** — same caveat |

### Group G — Storage sign-upload, `createSignedUploadUrl` (4 sites; the family AE0.4 found unnamed)

Mints upload *capability* rather than writing bytes. All four share one shape: a user-session RPC
(`begin_document_upload` / `create_minutes_job`) runs first and is the real gate; only on success
does the admin client mint a signed URL. None has a TS-side authorization check of its own to lose.

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/documents/actions.ts::beginDocumentUpload::storage-sign-upload::<dynamic:file.storage_bucket>` | `documents/actions.ts:beginDocumentUpload` → `<dynamic:file.storage_bucket>` | documents | mints a signed PUT target after `begin_document_upload` establishes the caller may write this resource | RPC-preceded; no in-function check | none found in TS | **NONE dedicated** — `e2e/phase-f2-attachments.spec.ts` drives the real corridor (happy path), not a guard/deny keystone |
| `src/lib/minutes-jobs/actions.ts::startMinutesJob::storage-sign-upload::<dynamic:MEETING_AUDIO_BUCKET>` | `minutes-jobs/actions.ts:startMinutesJob` → `MEETING_AUDIO_BUCKET` | minutes-jobs | mints a signed PUT target after `create_minutes_job` succeeds; comment: "the RPC runs FIRST so an unauthorized caller never causes a storage object to be signed for" | RPC-preceded; no in-function check (client-side size/type ceilings are "a courtesy, never the control") | none found in TS | **NONE dedicated** — `e2e/meeting-audio-minutes.spec.ts` drives the real signed-PUT flow (happy path) |
| `src/lib/safety/capa-actions.ts::beginCapaEvidenceUpload::storage-sign-upload::<dynamic:file.storage_bucket>` | `safety/capa-actions.ts:beginCapaEvidenceUpload` → `<dynamic:file.storage_bucket>` | safety (CAPA) | mints a signed PUT for CAPA evidence after `begin_document_upload(p_resource_type:'capa_action')` resolves via `app.can_write_capa` | RPC-preceded; no in-function check | none found in TS | **NONE for the TS wrapper** — `e2e/dm5-nsp-evidence.spec.ts` has its own helper calling the RPC directly (exercises the door, not this wrapper) |
| `src/lib/safety/rca-actions.ts::beginRcaEvidenceUpload::storage-sign-upload::<dynamic:file.storage_bucket>` | `safety/rca-actions.ts:beginRcaEvidenceUpload` → `<dynamic:file.storage_bucket>` | safety (RCA) | same shape, `app.can_write_rca` | RPC-preceded; no in-function check | none found in TS | **NONE for the TS wrapper** — `e2e/phase14c-rca.spec.ts` has its own like-named helper calling the RPC directly, not this wrapper |

### Group H — Auth-admin (4 sites)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/users/actions.ts::registerUser::auth-admin-createUser::createUser` | `users/actions.ts:registerUser` → `auth.admin.createUser` | users | creates the auth identity when email verification is off | shared `registerUser` entry gate only (see Group A) | none found in TS | **UNCONFIRMED** — same entry-gate caveat as Group A |
| `src/lib/users/actions.ts::registerUser::auth-admin-inviteUserByEmail::inviteUserByEmail` | `users/actions.ts:registerUser` → `auth.admin.inviteUserByEmail` | users | invites the new user when email verification is on | shared entry gate only | none found in TS | **UNCONFIRMED** — same caveat |
| `src/lib/members/invite.ts::resolveOrInviteUser::auth-admin-inviteUserByEmail::inviteUserByEmail` | `members/invite.ts:resolveOrInviteUser` → `auth.admin.inviteUserByEmail` `[INDIRECT — Tier 2]` | members | resolves-or-invites during org/platform admin flows; doc'd as performing "NO authorization of its own — the calling action is the authority" | the one check present is a tenant-anchor guard, not caller authorization. ⚠ **Re-derived at AE2 — this cell described `if (existing.home_organization_id !== homeOrganizationId) throw`, which is no longer the code.** The parameter is now `organizationId` (used ONLY by this check) and the guard is **two arms**, mirroring the *creation* door's predicate rather than a column compare: refuse if `existing.is_admin`, then refuse if the person holds non-voided org affiliations and **none** is `organizationId`. ⛔ **NON-VOIDED, not ACTIVE** — matching `app.person_known_to_org`, so a rehire is not refused. An anchorless person (zero affiliations) now **passes**, which is the deliberate widening: under the old column a `platform_admin` was refused because their anchor was NULL. `organizationId` is **no longer seeded into `user_metadata`** | none found in TS | **YES** — `invite.test.ts` ("the D13 tenant check"), 4 arms incl. cross-org refuse, and the anchorless arm re-polarised at AE2.4 |
| `src/lib/users/actions.ts::resendInvite::auth-admin-inviteUserByEmail::inviteUserByEmail` | `users/actions.ts:resendInvite` → `auth.admin.inviteUserByEmail` | users | re-sends an invite email | TS: `authorizeForUser(userId)` — deliberately NOT `personScopeAllows` (doc'd: would wrongly import the D2 tier bound) | none found in TS | **YES** — `d14-person-level.test.ts` §7, 4 arms incl. "sibling hospital_admin refused" |

### Summary

**44/44 re-derived post-AE1.3, machine-checked by gate 11.** Family totals: 3 `from-verb`
(1 Group B + 2 Group C) + 27 `rpc` (8 Group A + 8 Group D + 11 Group E) + 6 `storage` (2 Group C
+ 4 Group F) + 4 `storage-sign` (Group G) + 4 `auth-admin` (Group H) = 44.

⚠ **Raw DML is now only 3 of 44 sites.** AE1.3 took the whole of Group A behind doors, so the
service-role surface is overwhelmingly `.rpc()`: the only remaining raw table writes are
`updatePassword` (Group B, self-scoped) and the two `meeting_minutes_jobs` status flips
(Group C). AE0.4's "12 raw-DML vs 33 other" split no longer describes this registry and is
retired rather than re-fitted.

⚠ **Test coverage, re-derived row by row** — classified by each row's LEADING verdict token, so
the rule is stated rather than assumed: **20 `YES`** · **5 `PARTIAL`** · **15 `NONE`** ·
**4 `UNCONFIRMED`** = 44. So **19 rows (43%) have no test at all** that would notice their
mechanism vanish, and **24 (55%)** are not fully covered once the `PARTIAL` half-gaps are counted.
The 5 `PARTIAL` rows all sit in Group E and share one shape — a pgTAP `388` ACL/latch pin exists,
the behavioral or route half does not: `reclassifyDocument` ×2 (ACL pinned, behavioral `NONE`),
the two webhook rows (RPC half pinned; ✅ **route half LANDED 2026-08-27**, `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` RESOLVED — ⚠ this sentence read *"route half `NONE` until the FUP lands"* while the rows it summarises already said otherwise: **prose stale against its own table**, the same shape as the figures above
lands), and `get_feature_flags` (grant pinned, reader still mocked wholesale). The 4 `UNCONFIRMED`
are one shape too — `registerUser`'s shared entry gate, whose denial path was not found in the
reported coverage and is **not proven absent** (2 in Group A, 2 in Group H). This is a measured
property of the platform, not a gap in this review pass.

⛔ **This tally corrects the previous one, which did not reconcile.** AE1.4 recorded
`19 YES / 22 NONE / 4 UNCONFIRMED` over 45 rows; re-derived under the rule above, that same 45-row
table was `21 YES / 20 NONE / 4 UNCONFIRMED` — two rows leading with **YES** had been tallied as
`NONE`, and the `PARTIAL` shape was collapsed into `NONE` unstated. Only the AGGREGATE was wrong;
every per-row verdict cell was and is correct. ⛔ Re-derive this paragraph from the rows whenever
the table changes — never adjust the numbers arithmetically, which is how a direction gets fixed
while the magnitude stays wrong.

**The 11 formerly-`UNDECIDED` sites were RULED 2026-08-27** — approved as-is with four PO
observations → [authz-ae1-rpc-rulings.md](../design/authz-ae1-rpc-rulings.md) (Group E carries
the ruled mechanism strings). Zero `undecided` dispositions remain — **still zero after the
post-AE1.3 re-derivation**: the eight rows Group A gained are all decided (doors), and no row
anywhere in this registry carries `UNDECIDED`. Gate AE1 condition `[PA-F10]` now has both halves —
the registry is re-derived, and the derivation-vs-registry diff is a **machine** check
(`npm run lint:service-role-registry`), not the human comparison AE1.4 shipped with. The
observations produced: migration `20261003005000` (atomic
minutes-job latches) + pgTAP `388` (R1 ACL pins, latch behavior, atomicity text-pins) +
`printed-documents-caller-census.test.ts` (obs #4), and three filed FUPs
(`FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` = R2 · `FUP-DOC-RECLASS-OPERATION-ID` ·
`FUP-DOC-DISPOSAL-PROVENANCE-SPLIT`).

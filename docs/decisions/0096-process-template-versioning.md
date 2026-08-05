# 0096 — Process-template versioning (audit M1, full remodel)

- **Status:** Accepted — PO-directed 2026-08-04
- **Supersedes:** ADR [0095](0095-process-case-integrity-audit-remediation.md) §3a (which deferred this)
- **Precedent mirrored:** `forms` / `form_versions` (Architecture Rule 5)

## Context

The integrity audit's M1 finding said process templates are mutable-while-active and
unversioned. Investigation narrowed that considerably — and the narrowing is recorded here
because it defines what this remodel is actually buying.

**Measured, not assumed.** Renaming an ACTIVE template and retitling its phase 1 left the
existing case completely unchanged. Every reader of `process_templates` in both the catalog and
`src/lib` is either a template-authoring path or `create_case_from_template`; **no case-reading
path resolves template data live** (`get_case_detail` returns a bare `template_id` and never
joins). A case is already self-describing: phases with **pinned `form_version_id`**, ordering,
`blocks`, `recommend_when`, `result_ruleset`, narrative slots, frozen custom-field definitions,
and frozen outcome/result vocabularies are all snapshotted at creation.

The only true provenance gaps are **template `title`/`description`** (not snapshotted) and
`cases.template_id ON DELETE SET NULL` (the link can vanish — two seeded cases already resolve
to nothing).

**So this remodel is not a provenance repair.** Per-case provenance is already sound. It is a
*governance and reporting* capability: the ability to reason about the template's own history
independently of any one case — "which version was in force in Q2", "show me every case run
under version 3", "diff v2 against v3". That is a surveyor-facing capability (ONA/JCI), and the
PO has directed that it be built. Recording the honest justification matters so a later reader
does not believe cases were unsafe before this landed. They were not.

## Decisions (PO, 2026-08-04)

- **D1 · `title`/`description` live on the VERSION, not the identity.** This deliberately
  diverges from `forms`, where they sit on the identity row and therefore still drift across
  all versions. Putting them on the version is what closes the one real gap above.
- **D2 · Published versions are IMMUTABLE; editing auto-clones to a draft (Rule 5 parity).**
  Mirrors `clone_form_version` exactly, including "return the existing draft if one exists" so
  a template has at most one open draft. Authors must re-publish after editing — an accepted
  workflow change.
- **D3 · Scope = substrate + version-aware UI.** Version picker/history on the template screen
  and "which version this case ran under" on the case. Version **reporting** (cases-by-version,
  version diffing) is explicitly OUT and lands later.

## Design

### Schema

```
process_templates            identity        id, commission_id, created_by, created_at, updated_at
process_template_versions    versioned       id, template_id, version_number, status,
                                             title, description, collects_patient, case_type_id,
                                             created_by, created_at, published_at
```

- `status` is `draft | published | archived`, mirroring `form_versions` (the old template-level
  `draft | active | archived` retires; `active` becomes `published`).
- **Exactly one `published` version per template**, enforced by a partial unique index.
  Publishing archives the incumbent, exactly as `publish_form_version` does.
- Children re-point `template_id -> template_version_id`:
  `process_template_phases`, `process_template_narratives`, `process_template_outcomes`,
  `process_template_custom_fields`. The two phase-result junctions key off
  `template_phase_id` and follow automatically.
- `cases.template_id -> cases.template_version_id`, FK **`ON DELETE RESTRICT`** (a version that
  a case ran under must not be deletable — this is the audit's SET-NULL gap, closed).

### Doors

| RPC | Change |
|---|---|
| `create_process_template` | creates identity **+ v1 draft** in one call |
| `clone_template_version` | **new** — mirrors `clone_form_version` (idempotent: returns the open draft) |
| `publish_template_version` | **new** — draft-only; archives the incumbent published |
| `archive_process_template` | archives the identity (and its published version) |
| `add_/update_/remove_template_phase`, `..._narrative`, `set_process_outcomes`, `set_template_case_type`, `set_template_collects_patient`, `set_template_phase_blocks`, `reorder_template_phase`, `reorder_case_layout_template`, custom-field setters | take `template_version_id`; **refuse unless the version is `draft`** |
| `create_case_from_template` | resolves the template's **published** version (new helper `app.published_version_of_template`, mirroring `app.published_version_of_form`) and writes `template_version_id` |
| `bulk_create_cases` | follows `create_case_from_template` |

### Migration strategy

Pre-pilot, and the remote carries demo/pilot-prep data, so this is a **backfill, not a reset**:
every `process_templates` row gets a v1 whose `status` maps `active -> published`,
`draft -> draft`, `archived -> archived`; children and `cases` are re-pointed in the same
transaction. The backfill is data-dependent, so it is written to be idempotent and to fail loud
rather than silently no-op (the `20260905` backfill lesson).

## Consequences

- **Authoring workflow changes**: editing a published template now produces a draft that must
  be published. This is the visible cost of D2 and needs to be obvious in the UI.
- `app.published_version_of_template` becomes a hot path (every case creation) and needs an
  index on `(template_id, status)`.
- Every guard added by ADR 0095 that references `template_id` on a child table must be re-keyed
  to `template_version_id` — **`app.guard_template_phase_form_coherent`,
  `app.guard_template_narrative_type`, `app.guard_process_template_outcome`,
  `app.guard_process_template_case_type`, `app.commission_of_template`,
  `app.commission_of_template_phase`** — and their RLS policies with them. ⚠ The D11 lesson:
  a re-key that rewrites `pg_proc` but not `pg_policy` fails CLOSED and nothing catches it.
  **Re-sweep `pg_policies` after the re-key.**
- pgTAP: `210`, `114`, `177`, `296` and every suite building a template need updating; the
  `296` keystones that assert template-phase coherence must move to the version grain.

---

## Amendment 1 — implementation rulings and three corrections (PO, 2026-08-04)

Written during the build, after the design above was checked against the **live
catalog** rather than against the migration files. Three of this ADR's own statements
turned out to be wrong or understated; recording them is the reusable output.

### A1.1 · PO rulings (lead, 2026-08-04)

1. **`publish_process_template` survives as a thin wrapper** over
   `publish_template_version` (it resolves the template's open draft). It was not in
   the door table above, but it already exists, the UI button and 19 pgTAP suites call
   it, and one implementation behind two names is cheaper than re-pointing all of them.
2. **`public.draft_version_of_template(uuid)` is added** — a `SECURITY INVOKER`
   projection (RLS filters it exactly as a direct select would; a DEFINER here would be
   a new door for no benefit). It turns the pgTAP migration from "restructure every
   fixture" into a one-token edit per call site, and the builder needs it anyway.
3. **`process_templates.status` is DROPPED**, following from the identity/version split
   this ADR already specifies. The consequent semantics, previously only inferable:
   **`archive_process_template` archives every non-archived version**, and a template
   counts as archived if and only if **all** its versions are archived. A template
   whose only version is a draft is therefore archivable, and archiving never leaves a
   published version in force.
4. **`cases.template_version_id` is NULLABLE.** Processless cases created via
   `public.create_case` legitimately have no template (suite `177`), and the two cases
   already orphaned by the old `ON DELETE SET NULL` cannot be re-pointed to a version
   that never existed. `ON DELETE RESTRICT` still closes the gap for cases that *do*
   carry a version — which is the finding this ADR set out to fix.
5. **No feature flag.** A flag would mean maintaining both keying schemes at once;
   flags protect *features*, not *re-keys*. The accepted cost is that the change is
   irreversible on `db push`, which is why A1.3's rehearsal is mandatory and blocking.
6. **`'active'` to `'published'` is a deliberate COMPILE-TIME break** in the TS layer,
   not a silent value change, so `tsc` enumerates every comparison site. The same
   reasoning was extended one layer up: `ProcessTemplatePhase.templateId`,
   `ProcessTemplateNarrative.templateId` and `CustomFieldDef.templateId` all become
   **`templateVersionId`**, and the child-authoring actions take `templateVersionId`.
   The SQL side drops and recreates functions rather than using `create or replace`
   precisely so `p_template_id` cannot survive as a name that lies about its content;
   the TS layer earns the same treatment.

### A1.2 · Correction: the D11 trap is the OPPOSITE of what this ADR describes

The Consequences section warns that "a re-key that rewrites `pg_proc` but not
`pg_policy` fails CLOSED and nothing catches it". That is the D11 *incident*, but it is
the wrong hazard for **this** change — and guarding against the wrong one would have
left the real one open.

`ALTER TABLE ... RENAME COLUMN` does **not** leave the policies alone. Postgres stores
policy expressions as parsed node trees over column attnums, so a rename **rewrites
every policy for you**. All eight child policies would silently become
`app.commission_of_template(template_version_id)` — a `SECURITY DEFINER` that looks a
*version* id up in `process_templates.id`, finds nothing, returns `NULL`, and makes
`app.is_member_of(NULL)` false.

**MEASURED, not inferred** (same probe session, 2026-08-04):

```sql
create policy p on _p.t for select using (app.commission_of_template(tid) is not null);
alter table _p.t rename column tid to tvid;
select qual from pg_policies where policyname = 'p';
--  (app.commission_of_template(tvid) IS NOT NULL)      <-- Postgres rewrote it
```

**The danger is not that Postgres forgets to update the policy. It is that Postgres
updates it FOR you, wrongly.** The outcome is identical to D11 — RLS fails **closed**,
no error, no failing test — but the mechanism is inverted, so a check shaped like "did
I remember to update the policy?" never fires.

Three stacked defences, because no single one is sufficient:

1. **Never rename.** Add a new column, backfill, drop the old, so the drop collides
   with the policy dependency and raises. **MEASURED on this stack, 2026-08-04**, not
   assumed:

   ```sql
   create table _p.t (id uuid primary key, tid uuid);
   alter table _p.t enable row level security;
   create policy p on _p.t for select using (app.commission_of_template(tid) is not null);
   alter table _p.t drop column tid;
   -- ERROR: cannot drop column tid of table _p.t because other objects depend on it
   -- DETAIL: policy p on table _p.t depends on column tid of table _p.t
   -- HINT:  Use DROP ... CASCADE to drop the dependent objects too.
   ```

   ⚠ **The HINT is the trap inside the defence.** `DROP COLUMN ... CASCADE` would
   satisfy the dependency by *silently dropping the policy* — turning the table
   unprotected instead of raising. "Each DROP is an assertion" holds **only** because
   the drop migration uses bare `drop column`. Never add `CASCADE` there.
2. **A distinctly-named helper**, `app.commission_of_template_version`, so a mis-keyed
   policy is textually greppable. `app.commission_of_template` survives with a real
   caller — the `process_template_versions` policies, where identity-grain resolution
   is the correct thing.
3. **An ALLOW-arm keystone.** This is what D11 lacked and what actually catches it:
   **a fail-closed re-key passes every deny-side test.** The keystone asserts that the
   owning commission **can still read rows** — asserting rows under `set local role`,
   not predicates. It is a no-regression test, green before and after by construction,
   so it is **not** claimed as red-first; its non-vacuity is proven by mutation
   (neutralize the helper, it must red), and it is paired with a cross-commission deny
   twin so the re-key cannot have *widened* access either.

### A1.3 · Correction: the backfill can never be exercised by a local reset

The Migration-strategy section says the backfill "is written to be idempotent and to
fail loud rather than silently no-op (the `20260905` backfill lesson)". Necessary, but
not sufficient, because of a **structural** property this ADR did not state:

**`supabase db reset` applies migrations and THEN `seed.sql`.** Every local template is
created by the seed. The backfill therefore runs against **zero rows on every local
reset, forever**. A green `db reset` is not weak evidence that the backfill works — it
is *no* evidence, and it can never become evidence. `20260905` was not carelessness; it
was this property going unnoticed.

Four compensating measures, all accepted:

1. The backfill is a function invoked **twice** inside its own migration; the second
   invocation must report zero changes. Idempotency is proven against real data rather
   than asserted in a comment. The helper is dropped afterwards so no orphan
   `SECURITY DEFINER` door lingers for the ADR 0079 floor sweep.
2. Post-conditions **raise**, including a tenancy-coherence check that no case ends up
   pointing at another commission's version. These execute during `db push` against the
   populated remote — the only place the interesting data exists.
3. **`scripts/verify-tv-backfill.sh`** — a data-bearing rehearsal that hides the TV
   migrations, restores the pre-TV seed from git, resets to a *populated* old-shape
   database, then applies the migrations with `supabase migration up` and asserts every
   row was re-pointed and none lost. It **fails loudly if the seed produced 0
   templates**, so the rehearsal cannot itself go vacuous. Mandatory and blocking
   before any `db push`, alongside a remote snapshot.
4. Permanent invariant keystones in `supabase/tests/297_*.sql`, run against the seeded
   new-shape database on every `test:db`.

### A1.4 · Correction: the blast radius is about 5x the stated figure

The Consequences section names pgTAP `210`, `114`, `177`, `296`. Measured against the
catalog and the suite sources:

- **19 suites** call an RPC whose signature changes. The two largest — `90_cases` (38
  call sites) and `160_phase_results` (30) — are not among the four named.
- **`290_authz_never_called_door_floor`** mutates `process_templates.status` directly,
  a column A1.1 item 3 drops, so it needs a real rewrite, not a mechanical edit.
- **Three helper groups the re-key list omits**:
  `app.guard_template_phase_ruleset_content`, `app.trg_audit_template_narratives`, and
  all five `app.validate_template_*`, which take `p_template_id` and resolve phases by
  it.
- **`app.guard_process_template_case_type` changes table, not just column.** With
  `case_type_id` moving to the version, the trigger moves from `process_templates` to
  `process_template_versions`, where there is no `commission_id` to read — it must
  resolve the commission through `template_id`. A body change, not a re-key.
- **`supabase/seed.sql` inserts into these tables directly**, not via the RPCs, so it
  must be rewritten to the new shape — preserving template UUIDs and row counts
  exactly, since the seed is a contract with roughly 900 tests.

### A1.5 · The TRUE door set (the ADR's table was incomplete)

The door table in the Design section lists the doors the remodel was *planned* to
touch. It is not the set that actually needed re-keying. Recording the measured set,
because the next reader will otherwise inherit the same gap:

**Doors the table listed** — `create_process_template`, `clone_template_version`,
`publish_template_version`, `archive_process_template`, the phase/narrative/outcome/
custom-field setters, `create_case_from_template`, `bulk_create_cases`.

**Doors and call sites it did NOT list, all of which broke:**

| Missing | How it was found |
|---|---|
| `publish_process_template` | catalog census (already existed; kept as a wrapper, A1.1 item 1) |
| `get_case_detail` | `cases.template_id` dropped underneath it |
| `app.guard_template_phase_ruleset_content` | catalog census |
| `app.trg_audit_template_narratives` | catalog census |
| all five `app.validate_template_*` | catalog census |
| `addTemplateNarrative` (TS, **wired**) | reported by `frontend` |
| `reorderCaseLayout` (TS, **wired**) | reported by `frontend` |
| `setTemplateCollectsPatient` (TS, wired) | `tsc`, after `gen:types` |
| `setProcessOutcomes` (TS, wired) | `tsc`, after `gen:types` |
| `listProcessOutcomes` (TS, wired) | `tsc`, after `gen:types` |

Three of the five TypeScript call sites were found **only** because the `'active'` to
`'published'` change was deliberately made a compile-time break (A1.1 item 6) and the
generated types were regenerated before typechecking. Had the enum kept its old shape,
those three would have failed at runtime, in production, one user action at a time.

#### The rule, which outlives this table

> **When re-keying a column, the authority on "what must change" is the CATALOG —
> `pg_proc.prosrc`, `pg_policies`, `pg_trigger`, plus the ACLs.
> It is never a door table, never an ADR, and never a migration file.**

The table above is already the second attempt and it will go stale again the next time
this schema moves; the rule will not. This is the DB form of the repo's standing lesson
"a new door must inherit EVERY sibling arm", with the same failure mode: an enumeration
whose boundary is a *document* rather than the authority that defines the property.

Note who found what. The door table was written by the person with the most context on
the change and was wrong by **ten items**. Every one of the ten was found by a
mechanical authority — the catalog census, `tsc` after `gen:types`, or another teammate
reading their own call sites. **None was found by re-reading the ADR.**

#### The TypeScript corollary — grep is the authority for the client layer

The rule above says the catalog is the authority for SQL. An earlier draft of it also
credited "`tsc` over regenerated types" for the client layer. **That is wrong**, and the
correction is the most reusable output of this phase:

> **Supabase `.select()` strings are not validated against the generated types, and
> `.maybeSingle<T>()` is a type ASSERTION, not a check.** So after a column drop, a
> query naming the dropped column **typechecks perfectly** and fails only when a user
> reaches it. `tsc` cannot find these. **Grep `src/lib`, `src/app` and `src/components`
> for the old column name.**

Both halves matter. The select string is an opaque string literal as far as the
compiler is concerned; and the `<T>` on `.maybeSingle<T>()` / `.returns<T>()` *tells*
TypeScript what came back rather than *verifying* it, so the row type can name columns
that no longer exist and nothing objects.

**The evidence.** Three sites in `src/lib` survived the re-key with a dropped column in
their select:

| Site | Selected | Reached by |
|---|---|---|
| `contextOfPhase` | `process_template_phases.template_id` | 4 phase-edit actions |
| `customFieldContext` | `template_id` + `process_templates.status` | 2 custom-field actions |
| **`getPhaseFillContext`** | `cases.template_id` | **the phase fill landing** |

The first two were found while wiring their callers. The third was found **only** by a
grep sweep for dropped column names, run after everything was already green — and at
that moment `supabase db reset`, `tsc`, `npm run lint` (0/0) and **945 unit tests** were
passing *simultaneously* with the phase fill page broken.

This is the repo's standing "a green bar misses the wired seam" lesson in its sharpest
form yet, and the reason is worth naming precisely: **the green bar was answering a
question about the type system, not about the database.** Same category as the four
harness lies in A1.6 — an instrument reporting confidently about itself.

**Checklist after any column drop or rename:**

1. Catalog sweep — `pg_proc.prosrc`, `pg_policies`, `pg_trigger` (the A1.5 rule).
2. `npm run gen:types`, then `tsc` — catches typed `.rpc()` params and mapped fields.
3. **`grep -rn '<old_column>' src/` — catches what steps 1 and 2 structurally cannot.**
4. For anything grep flags, verify the replacement against **PostgREST**, not `tsc`: a
   nested embed such as `process_template_versions(process_templates(commission_id))`
   compiles regardless of whether the FK path that makes it resolvable exists.

### A1.6 · Two harness lies caught during verification

Both would have been reported as findings. Recording them because each is a reusable
trap, not a one-off slip:

1. **A wrong-arm fixture read as a privilege leak.** The cross-tenant deny arm was run
   as profile `…009`, assumed to be a Rede B outsider. It is `staff3.ccih@test.local` —
   a member of the *same* commission — so it correctly saw 3 rows, which looked exactly
   like an RLS leak. Re-running as `staff1.qual.b@test.local` (the real cross-org
   persona) returned 0. **Resolve the persona, never the variable name**, before
   reporting an authorization finding.
2. **`row IS NOT NULL` on a composite is false whenever ANY field is null.** The smoke
   test asserted `publish_template_version(...) IS NOT NULL` and got `false`, implying
   the door returned nothing — while the status flips it had just performed were
   plainly correct. The function was fine; `case_type_id` was null, and
   `ROW(1,NULL) IS NOT NULL` is `false` in Postgres. **Never assert `IS NOT NULL` on a
   composite return** — assert on a specific field (`(f(...)).id is not null`).

A third, milder instance: a probe run with `\set ON_ERROR_STOP off` printed its own
`>>> RESULT: SUCCEEDED` echo line *after* the ERROR it was meant to detect. The echo
was reporting that psql had continued, not that the statement had passed.

The common shape across all three: **the harness produced a confident answer that was
about the harness, not the system.** The tell each time was a second signal that
disagreed — the status flips, the sibling persona, the ERROR text directly above.

### A1.7 · DROP + CREATE resets a function's ACL (a security cost of honest names)

Ten public doors added or re-keyed by this phase were **EXECUTABLE BY `anon`**, caught
by `100_dashboard` t19 — the generic guard that exists because anon EXECUTE leaked once
before. Two were `SECURITY DEFINER` (`set_template_case_type`,
`set_template_collects_patient`), which run as the owner and are therefore **not
constrained by RLS**.

The usual explanation — "`CREATE FUNCTION` grants EXECUTE to PUBLIC by default" — is
true but does not explain why only ten of the ~18 doors this phase touched leaked. The
sharper rule:

> **`DROP FUNCTION` + `CREATE FUNCTION` RESETS the ACL to the default PUBLIC grant.
> `CREATE OR REPLACE FUNCTION` PRESERVES it.**

This phase's own diff is the proof. `set_process_outcomes` and
`set_template_phase_blocks` are **both** named in `100` t19b, so both had been revoked
by an earlier migration. Only `set_process_outcomes` leaked — because its parameter was
renamed, forcing `DROP` + `CREATE`, while `set_template_phase_blocks` kept its signature
and got `CREATE OR REPLACE`. The ten split exactly that way: **6 re-keyed with
`DROP` + `CREATE`** plus **4 brand new**.

So A1.1 item 6's decision — drop and recreate rather than let `p_template_id` survive as
a name carrying a version id — was correct on its own terms and is why the rename is
honest, but it **silently undid prior revokes**. The decision record did not anticipate
that.

> **Rule: any `DROP` + `CREATE` of a `public` function must re-apply its grants in the
> same migration.** A parameter rename is not a cosmetic change; it is a privilege reset.

The severity argument was deliberately **not** relied on. Both DEFINER bodies do gate on
`app.is_staff_admin_of`, so this was probably not exploitable — but "unreachable" is not
a security property. That is the BUG-AUTHZ-001 shape exactly (a DEFINER gate RLS never
evaluates), and it is the argument `20260906000600` already refused.

Fixed in `20260907001000`, which also carries a **migration-time** sweep over *all*
public functions — scoped to all of them rather than this phase's ten, because the
failure mode is "a door nobody remembered to revoke", and an allowlist of the doors we
remembered would be blind in precisely the case that matters.

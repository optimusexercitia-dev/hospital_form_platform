# Authorization rollback runbook (AE4.6 · AE4.9 · every AE5 per-role increment)

**Authority:** ADR [0162](../decisions/0162-plan-audit-corrections-authorization-evolution-program.md) §1
(which **retracts** ADR 0155 D7's "retain a forward rollback migration") · ADR
[0176](../decisions/0176-authz-permission-layer-made-real.md) D2/D6 + Consequences · plan
[authz-evolution.md](../plans/authz-evolution.md) § AE4.6.

**Scope.** Reverting an authorization *cutover* — a wrapper re-pointed to the catalog (AE4.6), an
enforcement site re-keyed to a permission (AE4.9 D6), or a role flipped to `authoritative` (each
AE5 increment). It is **not** a schema-rollback procedure and it never deletes catalog data.

---

## 0. Why this is not a migration file

⛔ **Do not "retain a rollback migration".** A file under `supabase/migrations` is part of the
ordered, forward-only applied chain — *committed means applied*. A retained rollback migration
therefore does exactly one of three things, all wrong (ADR 0162 §1):

1. undoes the cutover on the **next apply**;
2. is not a repository artifact at all (kept out of git, so unreviewed and unfindable); or
3. hides behind a **future timestamp** and fires unexpectedly.

The sanctioned artifact is this runbook plus an **out-of-chain SQL template**
([authz-rollback-template.sql](./authz-rollback-template.sql)) — deliberately *not* under
`supabase/migrations`. Invoking rollback **mints a new timestamped migration** through the normal
command (`npx supabase migration new <name>`) and pastes the filled-in template into it. The
rollback is thus a forward migration like any other, reviewed and applied in order.

---

## 1. Pre-flight — revalidate before you write a line of SQL

⛔ **The live catalog is the sole truth** (CLAUDE.md's binding exception): `pg_proc` including
**`prosecdef`**, `pg_policies`, and the **ACLs**. Never read a migration file and believe it —
several migrations in this tree rewrite bodies at runtime via `pg_get_functiondef()` + `replace()`
+ `execute`, so the file text is stale by design. A rollback written from migration text has
already been wrong once on this program.

⛔ **Reset first if you have just checked out or bisected.** A stale local schema has produced a
confident false diagnosis on this branch (see the AE4 handoff § Dead ends). `npx supabase db reset --local`.

Record all four for **every** object you are about to touch, and paste the output into the
rollback record (§4). A rollback that assumes a signature is how you drop a function and silently
invalidate its dependents:

```sql
-- names, signatures, DEFINER flag
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as result, p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app','authz','public') and p.proname = :'target'
 order by 1,2;

-- ACLs BY EFFECTIVE PRIVILEGE, never by proacl text (a NULL proacl includes PUBLIC)
select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
       unnest(array['anon','authenticated','service_role']) as r(rolname)
 where n.nspname in ('app','authz','public') and p.proname = :'target';

-- dependent policies: DROP silently invalidates these
select schemaname, tablename, policyname, cmd
  from pg_policies
 where coalesce(qual,'') || coalesce(with_check,'') like '%' || :'target' || '%';
```

⚠ **That last `like` is DELIBERATELY WIDE and must not be reused as a verification predicate.** It
over-matches on purpose — a bare substring for `app.is_tenancy_admin_of` also matches
`app.is_tenancy_admin_of_for(`, and at pre-flight you want the wider list to look at. When you later
assert *"the revert landed"*, anchor the pattern (`\yname\y`, or `name || '('`); an unanchored match
there reports the old name as still present and **hides a rename**. ADR 0178 § 2 sub-finding;
worked through in § 6.7 step 1.

**Signature change ⇒ DROP, not `create or replace`.** If the rollback restores a different
argument list or return type you must DROP first, and DROP cascades into dependent policies.
Enumerate them above and restore them in the same transaction.

---

## 2. The two revert shapes

### 2a. A re-pointed wrapper (AE4.6) — back to the legacy adapter

Re-point the wrapper body to the pre-cutover predicate. ⛔ **Without deleting catalog data**:
`authz.roles`, `authz.permissions`, `authz.role_permissions` and the assignment projection are
left **exactly as they are**. The catalog going quiet is the rollback; emptying it is data loss
that no forward step can undo.

### 2b. A re-keyed enforcement site (AE4.9 D6) — back to the role wrapper

Restore the site's **pre-re-key disjunct**. Two rules that are easy to get wrong:

- ⛔ **Restore the disjunct, not the whole body.** A re-keyed policy typically reads
  `<permission authorizer>(...) OR <other authority>(...)`. Only the first disjunct was re-keyed;
  the second (e.g. a tenancy-admin arm) was never part of the cutover and must survive the
  rollback verbatim. Replacing the whole body is how a rollback becomes its own outage.
- ⛔ **`FOR ALL` policies have two halves.** `USING` gates *which rows* may be touched;
  `WITH CHECK` gates *the new row*. Restore both, and verify both — a gate present in only one
  half is a live hole that reads as a completed rollback.

The now-unused domain authorizer may be left in place (inert) or dropped; **leaving it is
preferred** — dropping it invalidates dependents (§1) for no benefit, and a re-forward is then a
one-line policy change.

---

## 3. ⛔ The prohibition that outranks convenience

**Never ship `legacy OR new`, and never ship a caller-selectable evaluator.** A disjunction of the
two evaluators is not a safe rollback — it is a permanent over-grant that returns TRUE whenever
*either* authority says yes, and it passes every "did the rollback work" check because the legacy
side answers. A flag or parameter selecting the evaluator has the same defect plus a bypass.

The only two sanctioned mixed states are ADR 0176's: **per-role** (`authoritative` / `legacy`) and,
during a re-key, **per-site** between layers 1 and 3. Never per-caller, never per-path.

**This is asserted, not merely written down:** a pgTAP assertion greps the **catalog**
(comment-stripped `prosrc` of the wrapper family) for the legacy predicate's absence. Re-run the
authz suites after any rollback — if that assertion is now the thing you are "fixing", stop and
escalate.

---

## 4. Record the event, and state compatibility in BOTH directions

The rollback record (append to `docs/progress/` for the active phase) must carry:

- **what was reverted** and to which pre-cutover state, with the §1 pre-flight output;
- the minted migration's timestamp and name;
- **application-code → database** compatibility: does the currently deployed app still work
  against the rolled-back schema?
- **database → application-code** compatibility: does the rolled-back schema still work against a
  *newer* app build that someone may deploy? (Coolify auto-deploy is **off** — the newer
  build reaches the server only on a manual Deploy, so this is a question about what is
  *pushed and deployable*, not about a race.)

⛔ Both directions, explicitly. Stating one and leaving the other implied is how a rollback fixes
the database and breaks the deploy. Per the schema-first rule
([push-schema-before-code](../../.claude/rules/push-schema-before-code.md)), schema goes first on
the way out — and on the way **back**, the safe order inverts: revert the app to the compatible
build *before* rolling the schema back, unless the pre-flight shows the newer app is
forward-compatible with the reverted schema.

⚠ **Do not read cutover or rollback evidence from console output alone.** `db push` swallows the
only non-vacuous moved-row count, so a `0/0` parity can pass while nothing moved
(`FUP-DBPUSH-SWALLOWS-NOTICE`). Verify on the catalog after applying.

---

## 5. Verify

1. `npx supabase db reset --local` then `npm run test:db` — the authz suites must be green **and**
   the §3 catalog assertion must still hold.
2. Re-run the §1 pre-flight queries and diff against the recorded pre-cutover output. They must
   match object for object, including `prosecdef` and effective ACLs.
3. For a §2b site revert, exercise the **production door**, not the resolver, and on a **write**
   where the policy is `FOR ALL` — a permissive sibling `*_select` policy will keep a SELECT-based
   check green with the write policy fully revoked.
4. ⛔ Read every exit code **directly**. A pipe, a `| tail`, or a trailing `echo` erases it, and
   this program has already recorded two runs reported as exit 0 that were exit 1.

---

## 6. Worked example — reverting the AE4.9 D6 re-key

**Every post-cutover fact below was MEASURED on the live catalog at migration head
`20261003007300`, 2026-09-02** (`npx supabase status` → `DB_URL`, queries run as `postgres`). None
of it was read off `supabase/migrations/20261003007300_*.sql` and believed — migration text in this
tree is stale by design (§1).

⛔ **A *pre*-cutover fact cannot be measured after the cutover: the catalog no longer holds it.**
That is the hard part of this section, and it is handled explicitly rather than glossed. For each
site § 6.1 says whether the pre-cutover text is **re-derivable from a live sibling** or is
**available only from the record** — so at 03:00 you know which lines you can check and which you
are trusting. ADR [0178](../decisions/0178-ae49-d6-rekey-as-built.md) and the migration header are
the record; they agree with each other, which is not the same as being verified.

⛔ **AND THE REVERT ITSELF HAS NOT BEEN EXECUTED.** This example was written against the *cutover*
catalog on a shared local stack; applying it would have destroyed another agent's evidence. So every
**post-revert** number here — the `63`, the `1`-row code census, the `a115005b…` md5, the
`grant DELETED` column of § 6.7 step 3 — is a **derived expectation**, not a measurement, and each is
labelled as one where it appears. They are derivable rather than guessed (the arithmetic, the pinned
constants and the assertions they come from are all named), but the first operator to run this
**owes the record the measured values**, and a discrepancy is a finding about this file, not about
their rollback.

### 6.0 There are FOUR representatives and only THREE of them have any SQL to revert

| # | Permission code | What AE4.9 D6 did | Revert artifact |
| --- | --- | --- | --- |
| 1 | `commission.forms.edit` | **New** authorizer `app.can_edit_commission_forms(uuid,uuid)`; the **six** `*_staff_admin_write` policies `ALTER`ed onto it in **both halves** (four at `20261003007300`, `form_item_options` + `form_item_validations` at `20261003007340`), **plus** the SECURITY DEFINER door `public.set_item_validations` re-keyed at `20261003007350` | § 6.2 — **six** `alter policy` **and one `create or replace`** |
| 2 | `org.professionals.create` | `app.can_create_professional(uuid,uuid)` re-keyed **in place** (signature unchanged) | § 6.3 — one `create or replace` |
| 3 | `org.professionals.read` | `app.can_read_professional_profile(uuid,uuid)` re-keyed **in place** (signature unchanged) | § 6.4 — one `create or replace` |
| 4 | `org.case_vocabulary.manage` | ⛔ **NOT re-keyed.** Added as a fourth **differential representative** in pgTAP `403`, to restore the AE4.5 reduction that re-keying #2 broke (ADR 0178 § 4) | § 6.5 — **no SQL at all**, test-side only |

⛔ **Do not go hunting for a `org.case_vocabulary.manage` enforcement site to revert — there is
none.** Measured: its manifest row is `status: "pending-rekey"` with `domainAuthorizer: null` and
`enforcementSites: []`; `app.can_manage_case_vocabulary(uuid,uuid)` carries **no** permission-code
literal and still asks a plain role question through `app.is_org_commission_staff_admin`. The
phrase "four representatives" is true and "four re-keys" is false; a plan that collapses the two
sends the operator looking for an object that does not exist, and the time is spent at 03:00.

### 6.1 Pre-flight — the recorded state, and which half of it you can still check

Run § 1's three queries for every object named below **before writing a line of SQL**, and paste
the output into the rollback record. These are the values they returned when this example was
written; a difference is not a formatting nit, it is the tree having moved under your rollback.

**Functions** — all `SECURITY DEFINER` (`prosecdef = t`) with `search_path = app, public,
pg_catalog`, all returning `boolean`:

| Function | Args | Lang | `authenticated` EXECUTE | `service_role` EXECUTE | `anon` |
| --- | --- | --- | --- | --- | --- |
| `app.can_edit_commission_forms` | `p_commission_id uuid, p_uid uuid` | sql | **t** | **t** | f |
| `app.can_create_professional` | `p_org uuid, p_uid uuid` | sql | **f** | **f** | f |
| `app.can_read_professional_profile` | `p_profile_id uuid, p_uid uuid` | **plpgsql** | **t** | **t** | f |
| `app.is_staff_admin_of` | `p_commission_id uuid` | sql | t | t | f |
| `app.is_tenancy_admin_of` | `p_commission_id uuid` | sql | t | t | f |
| `app.is_org_commission_staff_admin` | `p_org uuid, p_uid uuid` | sql | f | f | f |
| `app.can_manage_professional` | `p_org uuid, p_uid uuid` | sql | t | t | f |

⛔ **`app.can_create_professional`'s recorded grantee set is EMPTY** — measured by effective
privilege, `anon`/`authenticated`/`service_role` are all `false`; only the owner can execute it,
and the three RPC doors reach it because *they* are `SECURITY DEFINER`. The template's Section B
invites you to "restore the recorded ACLs"; here the recorded ACL is **no grant**, and typing a
`grant execute … to authenticated` is a **widening wearing the costume of a restore**. `SELECT`
privilege you were never entitled to revoke is a silent no-op; a grant you were never entitled to
add is not.

**Provenance of each pre-cutover expression** — the column that decides how much you are trusting:

| Site | Pre-cutover text comes from | Live cross-check |
| --- | --- | --- |
| `forms_staff_admin_write` | record | ✅ `case_tags_staff_admin_write`, `case_outcomes_staff_admin_write` and 8 more carry the identical `(app.is_staff_admin_of(commission_id) OR app.is_tenancy_admin_of(commission_id))` in **both halves** |
| `form_sections_staff_admin_write`, `form_items_staff_admin_write`, `form_item_options_staff_admin_write`, `form_item_validations_staff_admin_write` | **record only** | ⛔⛔ **THE LIVE TWIN IS DEAD — THIS ROW'S ✅ EXPIRED AT HEAD `20261003007340`, MEASURED DEAD ON 2026-09-07.** (⚠ corrected 2026-09-07, QA F-MINOR-1: this read *"EXPIRED ON 2026-10-03"* — `2026-10-03` is the leading digits of the **migration id**, not a calendar date, and as written it dated an expiry four weeks into the future.) It used to read: *"✅ `form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write` carry the identical `app.commission_of_version(form_version_id)` shape in **both halves** — sibling tables the re-key did not touch."* `20261003007340` re-keyed both of them, so they became sites of this revert instead of controls for it. Measured at the tip: `select count(*) from pg_policies where coalesce(qual,'')||coalesce(with_check,'') like '%is_staff_admin_of(app.commission_of_version%'` → **0 rows**. ⭐ This is § 6.1's own ⭐ class turned on § 6.1: *a change that alters a count invalidates every control that READS that count.* All **four** `commission_of_version`-shaped sites are now record-only, and the record is `docs/bugs/BUG-AE49-D6-REKEY-INCOMPLETE.md` — `app.is_staff_admin_of(app.commission_of_version(form_version_id)) OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id))`, identical in both halves, **staff arm first** |
| `form_versions_staff_admin_write` | record | ⛔ **NO live twin.** Measured: it is the only policy in the database whose expression derives the commission via `(select f.commission_id from forms f where f.id = …)`. ✅ But it is the one site with a **128-bit** check: pgTAP `387` C1 records the pre-D6 md5 `a115005b6106573c70d98a6aceb8a4fe`, **re-derived by inverting the change**, not by reading a value off the catalog. Get this policy's text right — arm order included, § 6.2 — and C1 returns to that constant exactly |
| `app.can_create_professional` | record | ✅ **the pre-cutover body is live under two other names.** `app.can_manage_case_vocabulary` and `app.can_manage_external_participant` still share the body the re-key split off — comment-stripped md5 `3a86b0232dce959487a401f88ab7128c` on both, versus `f17a0c42c80895a47964e68adf55a69b` on the re-keyed `can_create_professional`. `select pg_get_functiondef('app.can_manage_case_vocabulary(uuid,uuid)'::regprocedure)` **prints the exact text § 6.3 restores** |
| `app.can_read_professional_profile` | record **only** for its arm 2 | ⚠ Partial: the null guard, the `is_admin` arm and the case-committee traversal are **unchanged and live**, so only the two lines § 6.4 collapses back into one are on trust |

⚠ **The `can_manage_case_vocabulary` cross-check has an expiry.** It holds *because* rows 31 and 32
are still `pending-rekey`. The moment AE5 re-keys either of them the twin is gone and site 2's
pre-cutover text falls back to record-only. Re-measure the md5 pair at pre-flight; do not inherit
this paragraph's claim.

⭐ **RE-MEASURED 2026-09-07 at head `20261003007350` — IT STILL HOLDS**, and the extractor is written
out here so the next re-measure is comparable rather than merely repeated:

```sql
-- ⛔ md5 over the COMMENT-STRIPPED `prosrc`, NOT over `pg_get_functiondef`. Hashing the functiondef
-- produces three DIFFERENT values with the two twins no longer matching — which reads exactly like
-- the expiry having fired. A md5 comparison is only a fact once the extraction is the same on both
-- sides; this cost a full pass while re-measuring, and it is recorded so it costs no one else one.
select p.proname,
       md5(regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'app'
   and p.proname in ('can_manage_case_vocabulary','can_manage_external_participant','can_create_professional');
-- MEASURED 2026-09-07:
--   can_manage_case_vocabulary       3a86b0232dce959487a401f88ab7128c   ✅ unchanged
--   can_manage_external_participant  3a86b0232dce959487a401f88ab7128c   ✅ the twin still matches
--   can_create_professional          f17a0c42c80895a47964e68adf55a69b   ✅ unchanged
```

and its precondition still holds too: manifest rows `org.case_vocabulary.manage` and
`org.participants.external.manage` are both still `status: "pending-rekey"`.
⛔ **Do not generalise from this row to the one above it.** Two live-twin cross-checks were recorded
in this section; one is still valid and one has expired. They expire independently, for different
reasons, and the only way to know which is to re-measure both.

### 6.2 Site 1 — `commission.forms.edit`, SIX policies and ONE SECURITY DEFINER door

⭐ **RE-MEASURED AND REWRITTEN 2026-09-07 at head `20261003007350`** (unit ENFORCEMENT-MANIFEST,
pre-AE5 Batch 5, ADR [0193](../decisions/0193-the-enforcement-manifest-declares-what-it-measured.md)
D8), closing `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR`. The 2026-09-03 interim banner that sat
here is **deleted**, not left beside the corrected text: an operator at 03:00 reading a banner and a
body that disagree has to decide which one is current, which is the cost the banner was meant to
avoid. What the banner said is now simply true of the text below — six tables, six `alter policy`,
both halves each, `EXPECT 6`.

⚠ **THE COUNT MOVED TWICE, AND IT WILL MOVE AGAIN.** Four sites at `20261003007300`; six at
`20261003007340` (`BUG-AE49-D6-REKEY-INCOMPLETE` — the two the approved matrix named and the
migration missed); six policies **plus one DEFINER door** at `20261003007350`. Each AE5 increment
moves it again. ⛔ Re-measure before you run this section; do not count the `alter policy` statements
below and assume the catalog agrees with them.

**Pre-state (record only — see § 6.1's provenance table, whose live twin for four of these six is
now DEAD).** Each of the six policies is `FOR ALL` PERMISSIVE to `authenticated`, with `USING` and
`WITH CHECK` **identical to each other**, and gated on the two arms `app.is_staff_admin_of(<cid>)`
and `app.is_tenancy_admin_of(<cid>)` — ⚠ **not in the same order at every site**; see the arm-order
warning below before writing any of it out. `public.set_item_validations` gated on the same two arms
inside its body, `staff arm first`, as its `-- AUTHORITY FIRST` comment shows.

**Post-state (measured 2026-09-07).** Each of the six policies is a **single** call to
`app.can_edit_commission_forms(<cid>, (select auth.uid()))`, in both halves — measured:

```sql
select count(*) from pg_policies
 where schemaname = 'public'
   and tablename in ('forms','form_versions','form_sections','form_items',
                     'form_item_options','form_item_validations')
   and policyname like '%\_staff\_admin\_write'
   and coalesce(qual,'')       ~ 'can_edit_commission_forms'
   and coalesce(with_check,'') ~ 'can_edit_commission_forms';
-- MEASURED 2026-09-07: 6
```

and `public.set_item_validations`'s body calls the same authorizer instead of the two wrappers. The
tenancy arm genuinely left the policy bodies **and that door** and now lives **inside** the
authorizer as `app.is_tenancy_admin_of_for(p_commission_id, p_uid)`.

⛔ **This is the shape § 2b's first bullet warns about, inverted.** The usual re-keyed policy reads
`<authorizer>(…) OR <other authority>(…)` and you restore only the first disjunct. **Here there is
no `OR` left at the policy at all** — restoring "the disjunct" means restoring **both** names,
because the second one was moved, not left behind. Reverting a policy to
`app.is_staff_admin_of(<cid>)` alone is a clean-reading rollback that **logs every `org_admin` and
`hospital_admin` out of form editing**.

⛔⛔ **THE ARM ORDER IS NOT FREE, AND IT IS NOT THE SAME AT ALL SIX SITES.**
`form_versions_staff_admin_write` listed the **tenancy arm FIRST**; `form_sections`, `form_items`,
`form_item_options` and `form_item_validations` listed it **second**. The two orders are semantically
identical — Postgres guarantees no `OR` evaluation order anyway — but they are **textually**
different, and pgTAP `387` C1 hashes policy *text*: it pins an md5 over the unwrapped
`qual`/`with_check` of the hot-table policies, and *"getting that order wrong moves the md5 exactly
like a real regression"* (its own words). Write the order below verbatim.

The revert (paste into the minted migration; note the differing arm order on `form_versions`):

```sql
alter policy forms_staff_admin_write on public.forms
  using       (app.is_staff_admin_of(commission_id) or app.is_tenancy_admin_of(commission_id))
  with check  (app.is_staff_admin_of(commission_id) or app.is_tenancy_admin_of(commission_id));

-- ⛔ TENANCY ARM FIRST on this one, and only on this one.
alter policy form_versions_staff_admin_write on public.form_versions
  using       (app.is_tenancy_admin_of((select f.commission_id from public.forms f where f.id = form_versions.form_id))
            or app.is_staff_admin_of((select f.commission_id from public.forms f where f.id = form_versions.form_id)))
  with check  (app.is_tenancy_admin_of((select f.commission_id from public.forms f where f.id = form_versions.form_id))
            or app.is_staff_admin_of((select f.commission_id from public.forms f where f.id = form_versions.form_id)));

alter policy form_sections_staff_admin_write on public.form_sections
  using       (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)))
  with check  (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)));

alter policy form_items_staff_admin_write on public.form_items
  using       (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)))
  with check  (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)));

-- ⭐ THE TWO SITES 20261003007340 ADDED. Same shape as form_sections / form_items, staff arm first.
alter policy form_item_options_staff_admin_write on public.form_item_options
  using       (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)))
  with check  (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)));

alter policy form_item_validations_staff_admin_write on public.form_item_validations
  using       (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)))
  with check  (app.is_staff_admin_of(app.commission_of_version(form_version_id))
            or app.is_tenancy_admin_of(app.commission_of_version(form_version_id)));
```

⭐⭐ **AND THE SEVENTH REVERT ARTIFACT, WHICH IS NOT A POLICY.** `20261003007350` re-keyed the
SECURITY DEFINER door `public.set_item_validations(uuid, jsonb)` — the ONLY `authenticated`-reachable
write path to `form_item_validations`, whose policy is an unreachable backstop (measured at the tip:
`authenticated` holds **`SELECT`** on that table and nothing else). Reverting the six policies and
leaving this door re-keyed leaves `commission.forms.edit` load-bearing on that door alone.

⛔ **DO NOT RETYPE THE BODY, AND DO NOT COPY IT OUT OF `20261003007350`.** It is ~120 lines of
feature-flag, shape, coverage and config validation, and migration text in this tree is stale by
design (§ 1). Regenerate from the live catalog and change **one line**:

```sql
-- 1. print the CURRENT body
select pg_get_functiondef('public.set_item_validations(uuid,jsonb)'::regprocedure);
-- 2. in that text, replace exactly this line:
--      if not app.can_edit_commission_forms(v_commission, (select auth.uid())) then
--    with the pre-cutover gate (record: 20261003007350's header, and this file):
--      if not (app.is_staff_admin_of(v_commission) or app.is_tenancy_admin_of(v_commission)) then
-- 3. paste the result into the minted migration, unchanged in every other byte.
```

⛔ Keep `SECURITY DEFINER` and `search_path = app, public, pg_catalog` exactly as printed — ⚠ **not**
`''`; changing the search_path here is a second change wearing a restore's costume. The signature is
unchanged, so this is a `create or replace` with no `DROP` and no dependent object to restore.

⚠⚠ **THREE OF THE SIX POLICIES HAVE THEIR ARM ORDER PINNED BY NOTHING.** `387`'s hot subset
(`387_initplan_wrap_and_profiles_arm_identity.sql:112`) names `form_items`, `form_sections` and
`form_versions` — and **not** `forms`, `form_item_options` or `form_item_validations`. `387` says so
about `forms` itself (*"`forms` is the fourth site and is NOT in the hot subset, which is why C2
stays 99"*); the other two were never in it either. Staff-admin first is what the live
`*_staff_admin_write` siblings use (`case_tags`, `case_outcomes`, `process_templates`,
`phase_results`, …) and is the reasonable choice, but those are **three** lines of the six that no
assertion will contradict if they are wrong. ⛔ Do not read a green `387` as covering six sites.

`app.can_edit_commission_forms` is **left in place, inert** (§ 2b): after this it has zero callers,
dropping it buys nothing, and leaving it makes a re-forward six `alter policy` lines plus one
`create or replace`.

⛔ **Dropping it is worse than pointless — it turns a readable red into a blind spot.** pgTAP `409`
§ 6.2–6.4 call `has_function_privilege(…, 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE')`
and issue a bare `grant execute … to anon` against it. With the function gone those raise
`undefined_function`, which **aborts the whole file** — `409` stops reporting individual failures
and reports nothing at all. A rollback that produces "file aborted" instead of "twelve expected
reds" has destroyed its own evidence.

⚠ The `_for` variant is **not** part of the revert. Measured: `app.is_tenancy_admin_of(p_commission_id)`
*is literally* `app.is_tenancy_admin_of_for(p_commission_id, (select auth.uid()))`, so the
one-argument wrapper at the policy is the same answer, and at every one of these sites `p_uid` was
`auth.uid()` anyway.

### 6.3 Site 2 — `org.professionals.create`

**Pre-state (recorded; and live under two other names, § 6.1).**

```sql
  select app.can_manage_professional(p_org, p_uid)
      or app.is_org_commission_staff_admin(p_org, p_uid);
```

**Post-state (measured).** Arm 2 became
`authz.has_permission(p_uid, 'organization', p_org, 'org.professionals.create')`; arm 1 is
unchanged. `app.is_org_commission_staff_admin` was **not** dropped — measured, it still has exactly
two callers (`app.can_manage_external_participant`, `app.can_manage_case_vocabulary`), which is why
the revert has a live target to call.

```sql
create or replace function app.can_create_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  select app.can_manage_professional(p_org, p_uid)
      or app.is_org_commission_staff_admin(p_org, p_uid);
$fn$;
```

⛔ **No `grant` and no `revoke` line.** § 6.1: the recorded grantee set is empty, and
`create or replace` preserves the existing (empty) ACL. Delete the template's Section B grant lines
rather than filling them in.

⚠ The three enforcement sites — `public.create_professional_profile`,
`public.ensure_professional_participant`, `public.set_professional_link_state`, all `SECURITY
DEFINER` and all EXECUTE-granted to `authenticated` — are **not** edited. They call the authorizer
by name and pick up the reverted body automatically. Verify that they still exist and still call it
(§ 6.7 step 2); do not rewrite them.

### 6.4 Site 3 — `org.professionals.read`

**Pre-state (recorded).** Identical to the measured post-state below **except** that the two-arm
`if` block was a single call: `if v_org is not null and app.can_create_professional(v_org, p_uid)
then return true; end if;`.

**Post-state (measured).** That one call was split into
`app.can_manage_professional(v_org, p_uid) or authz.has_permission(p_uid,'organization',v_org,'org.professionals.read')`.
Everything around it — the `p_uid is null` guard, the `is_admin` short-circuit, the
`organization_id` lookup, the case-committee traversal — is byte-for-byte what it was.

```sql
create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_org uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  -- ETH·E4 (ADR 0108 D5) — the org-manager arm.
  select organization_id into v_org
  from public.professional_profiles
  where id = p_profile_id;

  if v_org is not null and app.can_create_professional(v_org, p_uid) then
    return true;
  end if;

  -- DEFINER traversal over BASE tables (ADR 0064 R6). PRESERVED VERBATIM.
  return exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id
     and cp.removed_at is null
    where pp.professional_profile_id = p_profile_id
      and app.can_read_case_committee(cp.case_id, p_uid)
  );
end;
$fn$;
```

⚠ **`language plpgsql`, not `sql`.** The template's Section B is written `language sql`; this is the
one of the three where that line changes. A `create or replace` that changes the language is legal
and keeps the signature, so no dependent policy is invalidated.

⚠ **`authenticated` and `service_role` EXECUTE are REQUIRED here and must survive** — unlike site 2.
Measured: this authorizer is embedded directly in `professional_profiles_select` and
`professional_participants_select`, and a policy expression evaluates as the querying role. Two
sibling gates, opposite grant postures; do not transplant site 2's "no grants" note onto this one.
`create or replace` preserves the ACL — verify it afterwards by effective privilege, never by
reading `proacl` (a NULL `proacl` includes PUBLIC).

⚠ **A fourth consumer, not in the manifest and not an enforcement site.** Measured:
`app._audit_access_authorized` routes `'professional_profile.read'` to this authorizer. Reverting
site 3 therefore also changes which Rule-11 audit reads are accepted. Correct — the audit registry
is *supposed* to track the door — but note it in the rollback record so nobody diagnoses it later as
an unrelated audit regression.

### 6.5 Representative 4 — `org.case_vocabulary.manage`: nothing to revert, something to decide

D6 did not touch this code. What it touched was the **argument** that let AE4.5 run three
differential representatives for six legacy-equivalence classes: pgTAP `401` § 19.2b asserted that
`can_create_professional`, `can_manage_external_participant` and `can_manage_case_vocabulary` share
**one** comment-stripped body. Re-keying site 2 split that body (measured: 2 distinct bodies, the
md5 pair in § 6.1), so `org.professionals.create` stopped speaking for rows 31 and 32, and ADR 0178
§ 4 restored the reduction by adding `org.case_vocabulary.manage` as a **fourth representative** in
`403` — one representative for the two rows that still share a body.

**A revert of site 2 puts that body back**, which means the fourth representative's *justification*
disappears at the moment the revert lands. ⛔ **That is a decision, not a cleanup**, and it belongs
in the rollback record rather than in whoever's hands the suite is red in:

- ⛔ **Do not delete the fourth representative** to "restore" `403` to its pre-D6 shape. It is not
  wrong after a revert — it is merely no longer *required*, and an extra differential representative
  costs runtime and nothing else.
- ⛔ **Do not edit `401` § 19.2b's expected count back to `1` as a reflex.** It reads `2` today; a
  site-2 revert re-merges the three bodies and reds it **downward, `2 → 1`**. ADR 0178 § 4 already
  ruled on the opposite move and the reasoning is symmetric: the subject of that assertion is the
  *argument* that N representatives answer for six classes, not the number. Re-derive it, and
  record the derivation beside it.
- ⚠ **`401` § 19.2c stays GREEN through the revert** and is not evidence of anything here. It pins
  the *surviving* pair (`can_manage_external_participant` ≡ `can_manage_case_vocabulary`), which the
  revert does not touch. ⛔ § 19.2b is the **only** assertion anywhere that notices the fourth
  representative's justification has evaporated — `403` itself stays fully green (§ 6.8).

### 6.6 Ordering — one partial revert is worse than either end state

The three sites are independent **except in one direction**, and it is not the obvious one:

- **Site 2 without site 3 is safe.** After D6 site 3 no longer calls `can_create_professional`, so
  reverting site 2 alone leaves site 3 keyed on its own code, as intended.
- ⛔ **Site 3 without site 2 is NOT safe.** Site 3's reverted body calls
  `app.can_create_professional(v_org, p_uid)` — and if site 2 is still re-keyed, that call carries
  `org.professionals.create`'s permission code. **Professional *reads* would then be gated on the
  *create* permission**: deleting the create grant would flip reads. That is exactly the
  code-borrowing ADR 0178 § 3 called "actively wrong", except now with a live catalog permission
  behind it. Revert both, or revert site 2 first, or revert neither.
- **Site 1 is independent of both.** It shares no object with them.
- ⛔⛔ **BUT SITE 1 IS NO LONGER ONE OBJECT-CLASS, AND ITS OWN TWO HALVES ARE ORDER-SENSITIVE TO EACH
  OTHER.** Since `20261003007350` site 1 is **six policies + the DEFINER door
  `public.set_item_validations`** (§ 6.2). Revert either half alone and you get a state worse than
  both end states, in opposite ways:
  - **policies reverted, door left re-keyed** — `form_item_validations`' policy is an unreachable
    backstop (`authenticated` holds `SELECT` only), so the ONLY live authority for that table is the
    door, and it is still keyed on `commission.forms.edit`. The revert reads complete and the
    permission is still load-bearing.
  - **door reverted, policies left re-keyed** — the door is back on `is_staff_admin_of` while five
    reachable tables still gate on the authorizer: an `org_admin` keeps editing forms and loses
    validations, for no reason an operator reading either half would predict.
  Revert both, in one migration. Ordering **within** that migration does not matter (§ below); the
  end state does.

Ordering *within* one transaction does not matter — a `sql`/`plpgsql` body resolves its callees at
call time, not at `create` time. What matters is the **end state** of the applied migration.

### 6.7 Verify the revert LANDED — do not assume, and do not read it off the console

⛔ **A mutation that did not fully apply reports green.** `db push` swallows the only non-vacuous
moved-row count (§ 4), so every check below is on the **catalog** or on **behaviour**. Read every
exit code directly (§ 5 step 4).

**1 — Both halves of all SIX policies, the DEFINER door, and the census that catches an incomplete sweep.**

```sql
select policyname,
       coalesce(qual,'')       ~ '\yis_staff_admin_of\y'       as using_has_wrapper,
       coalesce(with_check,'') ~ '\yis_staff_admin_of\y'       as check_has_wrapper,
       coalesce(qual,'')       ~ '\yis_tenancy_admin_of\y'     as using_has_tenancy,
       coalesce(with_check,'') ~ '\yis_tenancy_admin_of\y'     as check_has_tenancy,
       coalesce(qual,'')       !~ 'can_edit_commission_forms'  as using_clean,
       coalesce(with_check,'') !~ 'can_edit_commission_forms'  as check_clean
  from pg_policies
 where schemaname = 'public'
   and tablename in ('forms','form_versions','form_sections','form_items',
                     'form_item_options','form_item_validations')
   and policyname like '%\_staff\_admin\_write';
-- EXPECT 6 rows, every column true. ⚠ RE-MEASURED 2026-09-07: this list and its expectation read
-- FOUR until then, and the two missing tables were exactly the two `20261003007340` re-keyed —
-- the census could not see them because they were not in its own `tablename` list. Six rows is
-- itself an assertion: five-of-six reads as a completed rollback and leaves the sixth table
-- enforcing the new authority alone.

-- ⭐ AND THE SEVENTH ARTIFACT, WHICH THIS POLICY CENSUS CANNOT SEE AT ALL.
select case when regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
                 ~ 'app\.can_edit_commission_forms\(' then 'STILL RE-KEYED — revert incomplete'
            else 'reverted' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'set_item_validations';
-- EXPECT 'reverted'. ⛔ A policy census over `pg_policies` is structurally blind to a DEFINER door;
-- this is the query that is not.

select count(*) from pg_policies
 where coalesce(qual,'') || coalesce(with_check,'') ~ '\yis_staff_admin_of\y';
-- EXPECT 63. ⚠ RE-MEASURED 2026-09-07: this line read "Measured post-cutover: 59. The four
-- policies each add one occurrence." Both halves of that sentence had moved. Measured at head
-- 20261003007350 the post-cutover value is **57**, and it is the SIX policies that each add one
-- occurrence: 57 + 6 = 63. ⭐ The 63 itself is unchanged and correct — it is the pre-cutover value
-- at head 20261003007260 — which is exactly why the stale middle term survived two migrations
-- without reddening anything. ⛔ The `set_item_validations` revert does NOT move this count: it is
-- a function body, and this census reads `pg_policies`.
```

⛔ **`\y…\y`, never `like '%is_staff_admin_of%'`.** The word-boundary form is load-bearing in
**both** directions here: `like` would match `is_staff_admin_of_for(` as a **prefix** and report the
wrapper present when only the `_for` variant is (the ADR 0178 § 2 sub-finding), and the same trap
applies to `is_tenancy_admin_of` / `is_tenancy_admin_of_for`, which is precisely the pair this
revert moves. § 1's dependent-policy query uses `like` for a reason — it is deliberately wide, to
find things to *look at* — but a **verification** predicate must be anchored.

**2 — The permission-code census returns to its post-revert value, which is NOT zero.**

```sql
with b as (
  select n.nspname, p.proname,
         regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app','public'))
select b.nspname || '.' || b.proname as fn, pm.code
  from b join authz.permissions pm on b.src like '%' || pm.code || '%'
 order by 1, 2;
-- ⚠ RE-MEASURED 2026-09-07 at head 20261003007350: **4 rows**, not 3 —
--   app.can_create_professional              | org.professionals.create
--   app.can_edit_commission_forms            | commission.forms.edit
--   app.can_read_professional_profile        | org.professionals.read
--   app.current_professional_read_organizations | org.professionals.read
-- EXPECT after a full three-site revert: **2 rows**, not 1 —
--   app.can_edit_commission_forms            | commission.forms.edit
--   app.current_professional_read_organizations | org.professionals.read
```

⛔ **TWO, not one and not zero, and both halves of that are correct.** § 6.2 leaves the now-unused
authorizer in place and it still carries its string literal — an operator who expects `0` will "fix"
it by dropping `app.can_edit_commission_forms`, the exact move § 2b says not to make. And
`app.current_professional_read_organizations` acquired the `org.professionals.read` literal at
`20261003007320` (ADR [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)) as a
deliberate SECOND site; it is **not part of the D6 re-key** and this revert does not touch it, so it
survives on both sides of the count. ⚠ **This is the FOURTH stale figure in this section**, and
unlike the other three it was stale because a *different* migration added a carrier — the count moved
under a revert procedure that never mentioned that migration. `410` § 8.5 pins the same four carriers
by name, which is where a fifth would red.

**3 — The behavioural differential, on a WRITE, at a coordinate where no other arm is open.**

⛔ **A SELECT proves nothing here.** Measured: all four tables carry a permissive `*_select` policy
on `app.is_member_of`, and a `staff_admin` is a member — `select count(*) from public.forms where
commission_id = …` returned **3** for `chefe.ccih@test.local` and would keep returning 3 with the
write policy entirely revoked (authz-handoff § 7.1 shape 6).

The two arms are separable by **principal**, which is what makes this non-vacuous. Measured on the
seed at head `20261003007300`, at commission CCIH (`slug = 'ccih'`):

| principal | `authz.has_permission(…,'commission.forms.edit')` | `app.can_edit_commission_forms` | `is_staff_admin_of_for` | `is_tenancy_admin_of_for` |
| --- | --- | --- | --- | --- |
| `chefe.ccih@test.local` (staff_admin) | **t** | t | **t** | f |
| `orgadmin.a@test.local` (org_admin) | **f** | t | f | **t** |

So `chefe.ccih` exercises **only** the permission arm and `orgadmin.a` **only** the preserved
tenancy arm. Probe as each, standalone (no pgTAP harness — `test_helpers` does not exist outside a
test run):

```sql
begin;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', '<uid>', 'role', 'authenticated',
                     'is_admin', false,
                     'active_role', '<staff_admin | org_admin — THE PROBED PRINCIPAL''S HAT>')::text,
  true);
set local role authenticated;
update public.forms set title = title where id = '<one form in that commission>';  -- row count is the answer
rollback;
```

⛔ **`public.forms` has a `title` column, not `name`** — a `set name = name` raises `42703` and the
probe then fails looking like a deny. Pin **one** form id rather than filtering on `commission_id`,
so the answer is a crisp 1 or 0 instead of a seed-dependent count. Resolving that id under the
`authenticated` role is safe: the permissive `forms_select` sibling passes for both personas, which
is exactly why the *write* is the only thing being measured.

⚠ `active_role` is **not** decoration, and it changes per principal: `authz.holds_role` and
`authz.entailed_grants` both carry the § 6A asymmetry clause (`p_principal is distinct from
auth.uid() or role_code = app.active_role()`), so a **self**-check applies the hat. Probe with the
wrong hat and you measure a deny that has nothing to do with the rollback.

**The discrimination test — the one that distinguishes "the revert landed" from "the SQL ran".**
In a rolled-back transaction, delete the `staff_admin` → `commission.forms.edit` row from
`authz.role_permissions` (as `postgres`, before switching role), then re-run the probe:

| | `chefe.ccih` UPDATE, grant present | `chefe.ccih` UPDATE, grant DELETED | `orgadmin.a` UPDATE |
| --- | --- | --- | --- |
| **Before the revert** | 1 row | **0 rows** — the catalog answers | 1 row |
| **After the revert** | 1 row | **1 row** — the catalog has gone quiet | 1 row |

⚠ **Provenance of that table**: the *Before* row is what pgTAP `409` § 2.8/§ 2.9 assert today (and
were observed **red** against the pre-migration catalog, so they are proven able to fail). The
*After* row is the **expectation this rollback must produce** — it has not been executed, because
executing it means applying the revert.

The `grant DELETED` column is the whole test. ⛔ **If it still reads 0 after your revert, the revert
did not land** — and every structural check in steps 1–2 can pass while that is true, because they
prove the *text* moved, not that the *decision* moved with it. The `orgadmin.a` column is the
**negative control**: it must read 1 in all four cells. A 0 after the revert means the **tenancy
arm** was dropped from the policy — the § 6.2 mistake — and a 0 *before* the revert means your
fixture is wrong, not the code.

**4 — The 128-bit check on site 1, which costs one query.** pgTAP `387` C1 hashes the unwrapped
`qual`/`with_check` text of the 99 hot-table policies.

⭐ **RE-MEASURED AND REWRITTEN 2026-09-07 at head `20261003007350`** (QA F-BLOCK-1). This step was
the **fifth** stale figure in § 6 and the one Batch 5 missed while re-measuring the other four: it
still counted **four** reverted policies and still named `3901715193753db33f980f939c6467de` as the
post-cutover value — the constant the same change corrects sixty lines further down, at § 6.9's
expected-red table. ⛔ And re-measuring it invalidated something neither the closure nor the review
had counted: **its `EXPECT after the revert` constant is no longer reachable by this revert either**
— see the reading table below. Every value here was re-derived today, the post-revert one **by
inverting the change in a rolled-back transaction**, which is the method `387` itself prescribes.

**Which of the six the aggregate can even see: three.** `387`'s hot subset
(`387_initplan_wrap_and_profiles_arm_identity.sql:112`) names `form_items`, `form_sections` and
`form_versions`. Measured 2026-09-07 against `pg_temp.ae15_hot_subset()`:

| policy | in `387`'s hot subset? |
| --- | --- |
| `form_versions_staff_admin_write`, `form_sections_staff_admin_write`, `form_items_staff_admin_write` | ✅ **yes** — C1 sees these three |
| `forms_staff_admin_write`, `form_item_options_staff_admin_write`, `form_item_validations_staff_admin_write` | ⛔ **no** — C1 is **silent** about these three |

⛔ So C1 covers **three of your six** `alter policy` statements. The other three are the ones § 6.2's
arm-order warning says are pinned by nothing. **Do not read a green C1 as covering the revert.**

```sql
-- 387's C1 aggregate. Define pg_temp.ae15_hot_subset() and pg_temp.ae15_unwrap() exactly as
-- 387_initplan_wrap_and_profiles_arm_identity.sql:98-135 defines them, then:
select md5(string_agg(h, '' order by h)) from (
  select md5(tablename || '|' || policyname || '|' ||
             pg_temp.ae15_unwrap(qual) || '|' || pg_temp.ae15_unwrap(with_check)) as h
    from pg_temp.ae15_hot_subset()) s;
-- and the cardinality control beside it, or a DELETED policy hashes the same as a restored one:
select count(*) from pg_temp.ae15_hot_subset();   -- MEASURED 2026-09-07: 99
```

**The four values this query can land on, and what each one means.** ⛔ Read the whole table; three
of the four are failure modes and only one of them looks like one.

| lands on | reading |
| --- | --- |
| **`c227d64eb11909e94400b7ba6bcaab0b`** | ✅ **THE REVERT LANDED.** The three hot-subset policies carry exactly their pre-D6 text, arm order included, and the other 96 are bit-identical. ⭐ **DERIVED BY INVERSION 2026-09-07**, not read off a catalog: § 6.2's six `alter policy` statements were applied verbatim in a rolled-back transaction at head `20261003007350` and the aggregate returned this value; the transaction was rolled back and C1 verified back to `f2a0693…` |
| **`f2a0693be216cfe08eb6cf0283565e7c`** | ⛔ **NOTHING APPLIED.** This is today's post-cutover value — what the catalog returns before you revert anything. Landing here means the `alter policy` statements did not run, or ran in a transaction that rolled back |
| **`a115005b6106573c70d98a6aceb8a4fe`** | ⛔ **NOT REACHABLE BY THIS REVERT, and it used to be what this step told you to expect.** It is the **pre-D6** value of the whole 99-policy aggregate, and `20261003007320` (AE4/IA-F9, ADR 0182) has since moved a *different* member of that aggregate — `professional_profiles_select`, whose `USING` became a `CASE` over `app.current_professional_read_organizations()` (measured today: it is in the hot subset and still carries that post-`7320` shape). Landing here means you reverted **`20261003007320` as well**, which is **not** part of this rollback |
| **`3901715193753db33f980f939c6467de`** | ⛔ **THE OPPOSITE OF WHAT YOU MEANT.** This is the value between `20261003007300` and `20261003007320`: D6 **applied** and `professional_profiles_select` **pre-`7320`**. Reaching it means you reverted `7320` and left D6 in place |
| anything else | ⛔ a typo, or a wrong arm order (§ 6.2 — `form_versions` lists the **tenancy arm first**) |

⚠ **`c227d64e…` HAS AN EXPIRY, and it is the same expiry § 6.1 warns about.** It is an aggregate over
99 policies, only three of which this revert touches; **any** later change to **any** hot-table policy
moves it, exactly as `20261003007320` moved the constant this step used to carry. ⛔ Re-derive it by
inversion at pre-flight — do not paste the value above into a fresh migration and call it verified.
*(`387`'s own words: "Re-capturing by pasting a freshly measured value proves nothing at all; invert
the change or leave the pin red.")*

**5 — Then the suites.** `npx supabase db reset --local` (a fresh reset — an E2E-mutated DB yields
spurious reds that are not defects), then `npm run test:db`, then § 5's remaining steps. Read § 6.8
**first**: several reds are the correct outcome and must not be edited away.

### 6.8 ⛔ What this example does NOT cover — the manifest and the suites will go RED, correctly

**A revert leaves the enforcement manifest claiming a state the catalog no longer has.** That is
not a side effect to tidy up afterwards; it is half the work, and the suites are built to notice.

`supabase/tests/vectors/authz-enforcement-manifest.json` must be updated **in the same change as
the SQL**, for each reverted code:

- `status`: `"re-keyed"` → `"pending-rekey"`;
- `domainAuthorizer` → `null`, and `enforcementSites` → `[]` (the *sites* stop being attributable
  to a permission; they are role-gated again);
- `residualLegacyAuthority` → `[]` — an arm is only "residual" relative to a permission arm that
  no longer exists;
- add a `pendingRekey` block (`layer1Gate`, `owner`, `expiry`) and a `callGraphBoundary.reason`
  saying **why** — that this row was re-keyed and rolled back, with the date and the rollback
  migration's timestamp. ⛔ Do not write a row that reads as though the re-key never happened; the
  two `pending-rekey` rows adjacent to this work (`org.case_vocabulary.manage`,
  `org.participants.external.manage`) show the shape, and both carry their history in the
  `qualifier`.

⛔⛔ **AND EDITING THE MANIFEST DOES NOT MAKE `410` GREEN. There is no edit that does.** `410` pins
the manifest and the catalog to **each other, in both directions**, so a revert catches it in a
scissor:

| | Manifest left as `re-keyed` | Manifest flipped to `pending-rekey` |
| --- | --- | --- |
| **§ 4.4** (every `re-keyed` row names an authorizer that exists **and** carries its code) | ⛔ **RED**, naming all three codes | green |
| **§ 4.5** (the countdown pair `40 / 3`) | green | ⛔ **RED → `43 / 0`** |
| **§ 4.6** (the five residual arms by name) | green | ⛔ **RED → `'(none)'`** |
| **§ 3.5** (each site's `composedWith` is present in the policy body) | ⛔ **RED** ×4 — the policies no longer contain `app.can_edit_commission_forms(` | green only if the site arrays are rewritten too |
| **§ 3.6** (composition cardinality, `18`) | green | ⛔ **RED → 10 or lower** |
| **§ 3.7** (the authorizer's own composition) | ⛔ **RED** — `authorizer lost authz.has_permission` | green **vacuously** (the arm filters on `domain_authorizer is not null`) |

⛔ **So do not choose the manifest edit that makes the suite quietest.** Flip the rows honestly per
the list above, then **re-derive** § 4.5's pair, § 4.6's literal and § 3.6's cardinality from the
reverted reality and record that you did. § 4.5's own message is explicit: *"a red here is the
increment being recorded, never a number to restore."* ⚠ And note § 3.7 and § 4.3/§ 4.4 go
**vacuous** rather than green once the `re-keyed` set is empty — their passing after a revert tells
you nothing at all.

**The full expected-red inventory. Every one of these is correct behaviour, not a defect:**

| Suite | Assertions that red | Direction |
| --- | --- | --- |
| **`409`** (the re-key differential, **`plan(75)`** — ⚠ this cell said `plan(63)`; re-measured 2026-09-07, it went 63 → 72 → 73 → **75**, so ⛔ do not trust the red COUNT below either, re-derive it) | § 1.1 the seam as a named set · § 1.3 the `40` countdown · § 2.1 **six** policies call the authorizer in both halves · § 2.8 / § 2.9 / § 2.10 **the gate lines** · **§ 2.10c / § 2.10e — the DEFINER door, added 2026-09-07** · § 3.1 · § 3.2 · § 3.5 · § 4.2 · § 4.7 · **§ 5.2 (the 178 census returns to 179)** · § 5.1 | ≥ **14 reds** on a full three-site revert including the door — a **derived** expectation, like everything post-revert in § 6 |
| **`410`** (the manifest) | the scissor above | unavoidable |
| **`401`** | **§ 19.2b only**, `2 → 1` | see § 6.5 |
| **`404`** (`BUG-PROF-INACTIVE-001`) | **§ 1.6 HOP1** — a chain probe that greps `can_create_professional`'s body for the literal `org.professionals.create` | red on a **site-2** revert |
| **`387`** (InitPlan / arm identity) | **C1** — a single md5 constant over 99 hot-table policies, now `f2a0693be216cfe08eb6cf0283565e7c` (⚠ this cell said `3901715193753db33f980f939c6467de`; the value moved again. ⚠ **Attribution corrected 2026-09-07 (QA F-BLOCK-1 re-measure):** it was `20261003007320`, not `20261003007340`. `387`'s own re-capture note names `20261003007320` and the one policy that moved (`professional_profiles_select`); and `20261003007340`'s two policies, `form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write`, were measured today to be **outside** `387`'s hot subset — so that migration could not have moved C1 at all), reverting toward `a115005b6106573c70d98a6aceb8a4fe` | red on a **site-1** revert, and see the ⛔ below |

⛔ **`404` and `387` are the two whose file names give no hint of the subject**, and `387` C1 in
particular is a **single 32-hex constant whose "fix" looks like a one-token edit**. Its own comment
forbids that: *"Re-capturing by pasting a freshly measured value proves nothing at all; invert the
change or leave the pin red."* Here you are *performing* the inversion, so C1 returning to
`a115005b…` is not a chore — **it is the best single verification in this whole section**, a 128-bit
statement that your `alter policy` statements moved exactly what they claimed and nothing else.
Add it to § 6.7 as step 5.

⛔⛔ **BUT ITS REACH IS THREE OF THE SIX, AND THAT IS THE ONE THING THIS CELL MUST NOT BE READ AS
COVERING.** Re-measured 2026-09-07: `387`'s hot subset
(`387_initplan_wrap_and_profiles_arm_identity.sql:112`) names `form_items`, `form_sections` and
`form_versions`. `forms`, `form_item_options` and `form_item_validations` are **not** in it — `387`
says so about `forms` in its own words (*"`forms` is the fourth site and is NOT in the hot subset,
which is why C2 stays 99"*), and the other two were never in it. So a 128-bit statement about half
the revert is exactly that, and the other three policies' text — arm order included — is verified by
nothing. ⚠ **And C1 cannot see the `set_item_validations` revert at all**: it hashes POLICY text, and
the seventh artifact is a function body. Its check is § 6.7 step 1's second query.

⛔ **`409`'s gate-line assertions (§ 2.8, § 2.9, § 2.10, § 3.5, § 4.7) are asserting the very thing
the rollback undoes** — each deletes a grant and requires the door to flip. After a revert the door
must **not** flip; that is F1 returning, on purpose. `409` should be **removed or skipped in the same
change as the revert**, with the reason recorded. ⛔ **Never re-code its expectations to green.**
Re-coding an expectation greens the test and deletes its subject — this program has already paid for
that lesson once, on the AE4.7c error-code drift. ⚠ Note the trap: `409`'s *restore* twins (§ 2.16,
§ 3.9, § 4.13) stay **green** through a revert, so a partial reading of the output looks half-fine.

**⚠ Suites that stay GREEN and must not be read as validating the rollback:**

- **`403`** (the AE4.5 differential, including the fourth representative) — **fully green**. Its
  driver calls `app.can_create_professional` by name and the reverted body is a role predicate that
  agreed with the resolver before D6. § 6.5's point restated: the revert destroys the fourth
  representative's *justification*, and the only assertion anywhere that says so is `401` § 19.2b.
- **`401` § 19.2c** — pins `can_manage_external_participant` ≡ `can_manage_case_vocabulary`. Green by
  construction: the revert touches neither. It pins the surviving pair, not the split.
- **`411`** (the role-manifest DB gate) — green. D6 changed no `authz.roles` row; a revert changes
  none either. Known-silent.
- **`409` § 3.10 / § 3.11** (the `is_active` gate) and **`406` § 2.5** (`can_create_professional`
  contains `can_manage_professional`) — true in **both** worlds. Do not cite them as rollback
  detection.

⛔⛔ **`npm run lint`'s `lint:authz-vectors` NEVER TOUCHES A DATABASE — greening it after a rollback
is possible and proves nothing.** It is deliberately Docker-free, so it validates the manifest's
internal shape and byte-compares the generated artifacts; it cannot see that the SQL was reverted.
A determined operator can satisfy it (author a `pendingRekey` block, set
`residualLegacyAuthority: []`, keep the site rows, re-run the generator so
`authz-matrix-coverage.json` re-renders) and pass the gate with the catalog in either state. **The
assertions that cannot be greened without un-reverting the SQL or deleting the gate are `410`
§ 4.4/§ 4.5/§ 4.6 and `409` § 1.1/§ 1.3.** Cite those in the record, never lint.

⚠ Its per-row shape rules are still worth knowing, because they force honesty into the flip: a
`pending-rekey` row **must** carry `residualLegacyAuthority: []` (an array — `null` fails), **must**
carry a `pendingRekey` block with a non-empty `layer1Gate`, `owner` and `expiry`, and — if you also
blank `enforcementSites` — **must** carry a full `callGraphBoundary` with `reason`, `reviewedBy` and
`reviewedOn`. That last one is an attributed human sign-off; the gate will not let you drop the sites
anonymously. And remember `authz-matrix-coverage.json` embeds `statusCounts` and `migrationHead`, so
the generator must be re-run as part of the change.

⛔ **The failure mode to fear is not a red suite — it is a GREEN one.** A red suite after a rollback
means the assertions were tracking reality. A fully green one means they were pinned to something
the rollback did not touch.

**Also not covered here:** the app-side. Measured — nothing in `src/` names these authorizers; they
are reached through RLS and through the three `SECURITY DEFINER` RPC doors, so the app→db direction
is expected clean. ⛔ But § 4 requires you to **state** both compatibility directions in the record,
not to infer one from the other's silence.

### 6.9 The five residual legacy arms — what a revert does to them

⛔ **`re-keyed` never meant `fully permission-keyed`.** The honest sentence for AE4.9 D6 is *"3
sites call layer 3 on the `staff_admin` path, and **5 non-permission grant paths survive inside
them**"*. pgTAP `410` § 4.6 pins those five **by name** — by name and not by count, because a count
lets one arm be swapped for another silently, and because since D6 they live **inside** `SECURITY
DEFINER` bodies where an audit of `pg_policies` cannot see them (ADR 0079 door blindness):

| Code | Residual arm | Population it grants |
| --- | --- | --- |
| `commission.forms.edit` | `app.is_tenancy_admin_of_for` | `org_admin` / `hospital_admin` at the commission's tenancy ancestors |
| `org.professionals.create` | `app.can_manage_professional` | the org-manager arm (ADR 0108 D5) |
| `org.professionals.read` | `app.can_manage_professional` | the same arm, **inlined** here by the re-key |
| `org.professionals.read` | `app.can_read_case_committee` | the case-committee traversal — **measured OPEN and MASKING on the seed** |
| `org.professionals.read` | `app.is_admin` | `platform_admin`, a role-free superuser arm |

Three things the operator needs from this table:

1. **Every one of these arms is a population the permission arm never covered.** They are what
   makes `§ 6.2`'s "restore both names" and `§ 6.3`'s "arm 1 is unchanged" non-negotiable: drop one
   in the course of a revert and you have not rolled back, you have shipped a narrower gate than
   either end state. `app.is_tenancy_admin_of_for` is the one most easily lost, because the revert
   moves it back out of the function and into the policy.
2. **After a full revert the list is empty, and the arms have not gone anywhere.** They are simply
   no longer *residual* — with no permission arm beside them they are just the gate. This is why
   § 6.8 says to set `residualLegacyAuthority` to `[]` and § 4.6's expected literal to `'(none)'`,
   and why doing so is a **restatement**, not a loss of coverage.
3. ⛔ **`app.can_read_case_committee` will mask your verification of site 3.** Measured on the seed:
   the single `professional_profiles` row has a `professional_participants` row, and the traversal
   grants for `chefe.ccih@test.local` — so a site-3 probe on that subject reads green after any
   mutation, for a reason unrelated to the revert. Any behavioural check of site 3 must construct a
   **participation-free** subject, exactly as `409` § 4 does. ⚠ `403` § 7.2/§ 7.3's *"arms 1 and 3
   cannot grant"* is true of **`403`'s own fixture** and is **not** true of the seed; it is a real
   filter cited for a conclusion it does not bound, and leaning on it here is how a site-3 rollback
   gets verified by nothing.

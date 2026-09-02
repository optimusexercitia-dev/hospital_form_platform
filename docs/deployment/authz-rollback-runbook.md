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
  *newer* app build that may auto-deploy?

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

## 6. ⛔ Not yet written: the AE4.9 D6 worked example

This runbook's **discipline** is complete and applies now. What it does **not** yet contain is the
filled-in, site-specific revert for the three AE4.9 D6 representatives
(`commission.forms.edit` → `app.can_edit_commission_forms` and the four `*_staff_admin_write`
policies; `org.professionals.create` → `app.can_create_professional`; `org.professionals.read` →
`app.can_read_professional_profile`), because that increment's final SQL had not landed when this
file was written.

⚠ Stated as a named gap rather than left to be inferred from the general procedure: §2b tells you
*how* to revert a re-keyed site, but a reader needing to roll back at 03:00 should not be deriving
the four policy bodies from scratch. **Owed before Gate AE4** — add the worked example, with the
pre-cutover policy text captured from the catalog, once AE4.9 D6 is committed.

# FUP-ADMIN-ARM-IS-ACTIVE-IS-ADMIN-CARRIES-A-PUBLIC-EXECUTE-ACL-ENTRY

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-10 · status open

**The observation, measured.** `app.is_admin()`'s `proacl` carries an EMPTY-GRANTEE entry
`=X/postgres` — that is **EXECUTE to PUBLIC**. Its two closest siblings do not:
`app.is_admin_for(uuid)` and `app.is_active(uuid)` grant only `postgres`, `authenticated` and
`service_role`. The asymmetry is the finding; nothing in the tree explains it, and no gate
asserts it either way.

**REACH, stated rather than left to the reader's alarm.** It is **not reachable today**. The
`app` schema's `nspacl` is `postgres=UC | authenticated=U | service_role=U` — there is **no
PUBLIC USAGE on the schema**, and EXECUTE on a function in a schema you cannot USE is inert. So
this is a defence-in-depth observation, not a live hole, and it opens no BUG row.

**Why it is still worth a row.** The protection is a *second* object's ACL, in a *different*
catalog, that nothing ties to this one. A future migration granting `PUBLIC USAGE ON SCHEMA app`
— or a Supabase platform default changing — turns an inert entry into a reachable one, silently,
because `app.is_admin()`'s own ACL would not have changed. And the function is not innocuous: it
is the predicate 26 policies and 13 functions read.

**Closes when:** either (a) the entry is REVOKED in a migration and a pgTAP cell pins
`has_function_privilege('public', 'app.is_admin()', 'EXECUTE') = false` alongside a
DISCRIMINATING control on a sibling that legitimately grants `authenticated`; or (b) the entry
is shown to be REQUIRED by something (name it, with the caller), and a cell pins the schema-level
absence of PUBLIC USAGE instead, so the argument the exemption rests on is asserted rather than
recalled. ⛔ Closing on "it is not reachable" alone reproduces exactly the shape this row is
about: an unasserted premise doing the protecting.

**Origin.** Filed at the Record step of pre-AE5 remediation Batch 10, unit `ADMIN-ARM-IS-ACTIVE`
(lead decision L2, `docs/progress/admin-arm-is-active.md`, "the plan received" entry) — found by
`backend` while reading the ACLs of the three `is_active` targets at head pair
`(20261003007380, 527)`, out of scope for the migration itself.

**Query to reproduce:**
```sql
select p.oid::regprocedure::text, p.proacl
  from pg_proc p
 where p.oid::regprocedure::text in ('app.is_admin()', 'app.is_admin_for(uuid)', 'app.is_active(uuid)');
select nspname, nspacl from pg_namespace where nspname = 'app';
```

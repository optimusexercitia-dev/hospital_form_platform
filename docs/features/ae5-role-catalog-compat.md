---
id: AE5-ROLE-CATALOG-COMPAT
title: "The role catalog holds roles: platform_role retires, administrativo leaves authz.roles, and the TypeScript mirrors collapse into one manifest with a generated pin"
status: in_progress
kind: feature
program: AUTHZ
phase: "pre-AE5 remediation — ADR 0207 D5 steps 1–5 (step 6 deferred to proposed-order item 6); ordered AFTER DEFINER-SEARCH-PATH-NARROW-FIX (ruled 2026-09-11)"
branch: ae5-role-catalog-compat   # cut from main @ 975fb4dd
plan: ../plans/authz-evolution.md
progress: ../progress/ae5-role-catalog-compat.md
reviews: []
adrs: ["0197", "0207", "0208"]
handoff: ~
---

# AE5-ROLE-CATALOG-COMPAT — the compatibility unit before AE5 increment 1

Owed by ADR [0207](../decisions/0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md)
D5 (six ordered steps, the PO's list verbatim there) — this unit builds **steps 1–5** and leaves
**step 6** (`app.member_can` / `app.member_can_for` and the capability→permission mapping) untouched
by design; D3, D4 and D7 give the shape and the blast radius. Runs after
`DEFINER-SEARCH-PATH-NARROW-FIX` because step 2 writes a **new SECURITY DEFINER**, which ADR
[0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
D4 binds to `search_path = ''` + a schema-qualified body — pgTAP `419` / gate 18 (path) and `421`
(body) are the gates that observe it. ⛔ AE5 itself stays post-pilot (ADR 0155 G1): this is
remediation, not increment 1.

## Acceptance criteria

Every cell below is **RED-first**: written before its SQL/TS and observed red; a keystone green on
its first run is a finding (the surface does not exist yet), never a pass. One migration carries
the SQL steps **in D5's order**; each step has its own cell.

- [ ] **AC-1 — step 1, the column.** `app.active_role_selections.role` is `text` (not the enum),
      with an FK to `authz.roles(code)`; existing values preserved (`using role::text`); an insert
      with a code absent from the catalog fails `23503`. Cells: column type · FK present · the
      23503 discrimination.
- [ ] **AC-2 — step 2, the door.** `public.assume_role` is **ONE** routine, signature
      `(p_role text)`, `prosecdef`, `proconfig = {search_path=}` (empty), body schema-qualified
      (`421` resolves it by `plpgsql_check`); EXECUTE ACL unchanged (`authenticated`,
      `service_role`, `postgres`; PUBLIC revoked). Its gate has **both halves**, each with a
      mutation AND a discrimination control — `session_selectable` (`408` today) and **the
      caller's real assignment** (new: a caller with no live `memberships` row for the code is
      refused `42501`; a sibling holder still seats); the `app.is_active` half (`418`) stays green
      on the new signature. An unknown code fails closed (`42501`, not `23503`).
- [ ] **AC-3 — step 3, the enum.** `to_regtype('public.platform_role') IS NULL`; the `pg_depend`
      dependents are zero before the drop (the migration asserts it, not assumes it).
- [ ] **AC-4 — step 4, the row and the domain.** `authz.roles` has no `administrativo` row (11
      rows); `authz.scope_kind`'s CHECK admits exactly `organization·hospital·commission·none`;
      the **`memberships` proof precedes the `ALTER DOMAIN`** — a cell asserting no
      `public.memberships` row carries `capability_plane`, **red-first against a planted row**;
      after the tightening an insert with `scope_kind = 'capability_plane'` fails `23514`.
      `authz.role_permissions` is untouched (still `staff_admin` only).
- [ ] **AC-5 — step 5, the TypeScript.** `src/lib/role/role-catalog.ts` holds ONE ordered
      manifest entry per role (code, label, assignment scope, selection status, landing branch,
      fallback/summary strategy, precedence); `ROLE_LABELS`, `ROLE_SCOPE_KIND`, `ROLE_ORDER`,
      `ROLE_BRANCH` and the `scopeSummary` switch are **derived** from it; `PlatformRole` is
      inferred from the manifest, not from `Database["public"]["Enums"]`; `npm run gen:types`
      re-run (the enum leaves `database.ts`); every one of D7's TS sites compiles; `npm run test`
      green.
- [ ] **AC-6 — D4's generated pin, both halves.** `411`'s hand-maintained `MANIFEST-SNAPSHOT`
      becomes a **generated, committed artifact** on ADR 0197 D4's pattern (`--write` · `--check`
      · `--self-test`, modelled on `scripts/gen-definer-search-path-freeze.mjs`): a text-only
      `--check` in `npm run lint` proves the committed artifact equals the TS manifest, and a
      pgTAP cell proves the artifact equals `authz.roles`. ⛔ Neither half alone is the verdict.
      `role-catalog.test.ts`'s text-only hop keeps working or is re-pointed at the artifact.
- [ ] **AC-7 — step 6 NOT taken, proven.** `md5(pg_get_functiondef(...))` of
      `app.member_can(uuid,text)` and `app.member_can_for(uuid,text,uuid)` are identical before
      and after the migration (recorded in the record with both values); the
      `bulk_create_cases` conjunction is untouched; ⛔ no mapping of `schedule_meetings` /
      `create_cases` / `assign_case_phases` to any permission code.
- [ ] **AC-8 — the name-keyed sites.** Every artifact keyed on the signature
      `public.assume_role(platform_role)` is re-keyed to the new signature and the sweep proves
      it still SELECTS the door (a rename orphans a name-keyed verdict): pgTAP `315` · `401` ·
      `408` · `411` · `418`; `supabase/tests/mutation/authz-command-door-targeted-cases.sh`;
      `act-hat-blind-allowlist.txt` · `authz-unswept-backlog.txt` · `c2-tier1-doors.txt`;
      `vectors/authz-enforcement-manifest.json`; the `419` freeze artifact regenerated as a **pure
      deletion** (the new door has an empty path, so it never enters the frozen set) and `421 §
      0c`'s partition re-pinned.
- [ ] **AC-9 — gates.** Fresh `supabase db reset` + `npm run test:db`; `npm run lint` (all gates,
      0/0) + `typecheck` + `test`; the four authz arms + `SELFTEST` with `bash --version`; the
      diff-scoped door sweep (predicate + policy arms, one invocation, `SCOPE:` quoted) over the
      deriver's list — the new `assume_role` MUST appear in the derivation; the set-valued arm;
      `npm run e2e:prod` green (`src/` and a migration changed); the authz seam slice appended +
      its `## Current state` block replaced; QA `APPROVED`; PO approval.

## Current state

**Updated:** 2026-09-12

### Objective

Land ADR 0207 D5 steps 1–5 as one backend unit before AE5 increment 1: retire `platform_role`,
move `administrativo` out of `authz.roles`, tighten the `scope_kind` domain, collapse the TS
role mirrors into one manifest with a generated pin — without touching the capability plane.

### Done since start

Unit opened: branch cut, catalog measured (the record's opening entry carries every figure with
its query), the TS/test surface mapped, the review queue's two new entries triaged.

### In progress

Backend brief drafted; `backend` to post a full plan (new SECURITY DEFINER + migration ⇒ full plan
review, lead-playbook §3) before any SQL.

### Next

Plan approval → red-first cells → migration → TS collapse → generator + gate → gates → tester →
QA → PO.

### Blockers

None. ⚠ The `419` artifact regeneration must be a pure deletion (gate 18 refuses an addition);
if the new door shows up in the frozen set, its `search_path` is not empty — a defect, not a
ratchet edit.

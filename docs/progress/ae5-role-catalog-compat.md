# AE5-ROLE-CATALOG-COMPAT — progress record

> Hub: [ae5-role-catalog-compat.md](../features/ae5-role-catalog-compat.md) ·
> branch `ae5-role-catalog-compat`, cut from `main @ 975fb4dd` · owed by ADR 0207 D5 (steps 1–5;
> step 6 deferred to proposed-order item 6) · runs after `DEFINER-SEARCH-PATH-NARROW-FIX` (PO
> ruling 2026-09-11).

## Session log

### 2026-09-12 — unit opened; the subject measured from the catalog; the surface mapped (lead)

**Tree at open.** `main @ 975fb4dd`, clean; `origin/main..main` = 116 commits (⛔ not pushed — the
standing instruction); no `in_progress` hub; no worktree. Four merged unit branches still exist
locally (`definer-*`) — not deleted here, not this unit's. A peer session
(`hospital-form-platform-08`) was live on this checkout at open and answered **read-only** (greps
over `docs/` only, no branch, no reset, no pgTAP) — the shared-HEAD / shared-DB hazard measured
2026-09-12 (`docs/worktrees.md` §1) did not apply.

**Review queue (per-clone, gitignored): 2 new entries since the 2026-09-12 processing marker, both
triaged, 0 doc edits.** `c90f2ef1` (`claude-md`) quotes the DEFINER-SEARCH-PATH-NARROW-FIX record's
AC-4 text about the `.claude/rules/` hint — a session quoting a record, hook finding (i); `89aa778b`
(`rules`) is the user's own ordering prompt — hook finding (ii). Neither is outstanding work.

**Measured live** (`supabase_db_azkbbhskturikxpgmafq`, queries in ADR 0207 D7 unless stated):

| limb | value |
| --- | --- |
| `authz.roles` rows | **12**; `administrativo` the only `capability_plane` row, only `session_selectable = f`, `system_managed = t` |
| `platform_role` labels | **11** (`org_admin … platform_admin`, no `administrativo`) |
| columns typed by the enum | **1** — `app.active_role_selections.role` (PK `session_id`, FK `user_id → profiles`, one policy `active_role_selections_select_own`) |
| routines naming the enum | **1** — `public.assume_role(p_role platform_role)`, `prosecdef`, `search_path=app, public, pg_catalog`, ACL `postgres·service_role·authenticated = X` |
| `pg_depend` non-internal dependents of the enum | **2** (`pg_proc`, `pg_class`) |
| routines reading `app.active_role_selections` | **3** — `public.custom_access_token_hook(jsonb)` (`from app.active_role_selections`), `app.can_read_professional_profile(uuid,uuid)` (comment only), `assume_role` |
| `scope_kind_check` | `VALUE = ANY ('organization','hospital','commission','none','capability_plane')` — a DOMAIN over text |
| `memberships` rows at `capability_plane` | **0** (`select count(*) from public.memberships where scope_kind='capability_plane'`) |
| `memberships_role_check` | ten role codes, no `administrativo`; `memberships_role_scope_kind_fkey` → `authz.roles(code, allowed_scope_kind)` MATCH FULL |
| FKs into `authz.roles` | **2** — `role_permissions_role_code_fkey`, `memberships_role_scope_kind_fkey` |
| `role_permissions` rows for `administrativo` | **0** |
| triggers on `authz.roles` / `active_role_selections` | **0** (`memberships` has `trg_audit_memberships`) |
| routines naming `capability_plane` or `'administrativo'` | **4** — `app.trg_audit_administrativo()`, `app.trg_audit_administrativo_capabilities()`, `app.assert_administrativo_enabled()`, `app.member_can_for(uuid,text,uuid)` — the capability plane, step 6 territory, untouched |
| `app.member_can(uuid,text)` body md5 | `25c6747df0c01a34a6783f8a25c8dbd4` |
| `app.member_can_for(uuid,text,uuid)` body md5 | `da9b5b9bdac1a45cb4deed23ef4a3d27` |

(`md5(pg_get_functiondef(oid))` — AC-7 re-measures both after the migration.)

**Surface mapped** (Explore agent, file:line verified where it matters — summarized, the agent's
report is not pasted):
- `src/lib/role/role-catalog.ts`: `PlatformRole` at `:39` from `Database["public"]["Enums"]["platform_role"]`;
  the five parallel declarations `ROLE_LABELS :42` · `ROLE_SCOPE_KIND :67` · `ROLE_ORDER :99` ·
  `ROLE_BRANCH :194` · `scopeSummary` switch `:351`; `ROLE_MANIFEST :121` zips three. No
  `administrativo` / `capability_plane` in the file.
- Enum TYPE consumers outside `database.ts`: `src/lib/role-selection/actions.ts:48,94`,
  `src/lib/role/landing-route.test.ts:7`, and two frontend files by `as PlatformRole` cast —
  `src/components/shell/user-menu.tsx:11,113`, `src/components/role/role-switch-hint.tsx:7,55`.
  Everything else is a value import. ⇒ `backend` edits those two component files **by lead
  agreement** (import/type-only changes; `frontend` is not spawned for two casts).
- `rpc('assume_role', { p_role })` wires a JSON string everywhere (`actions.ts:53`, three E2E
  sites) — the argument shape survives `platform_role → text`.
- pgTAP: `408` (17 tests; every call `'x'::public.platform_role`; proves only the
  `session_selectable` half) · `411` (`MANIFEST-SNAPSHOT` `:54-68`, 11 hand-typed rows; §5 parses
  the domain CHECK and pins `'true/administrativo/(none)'`) · `401:169,185-186,794-796` · `315` ·
  `418` name the enum or the sentinel. `419`'s frozen set holds
  `public.assume_role(p_role platform_role)` at `vectors/definer_search_path_freeze.psql:483`.
  Signature-keyed non-pgTAP: `mutation/authz-command-door-targeted-cases.sh:252,269`,
  `act-hat-blind-allowlist.txt:68,99`, `authz-unswept-backlog.txt:955`, `c2-tier1-doors.txt:76`,
  `vectors/authz-enforcement-manifest.json:1222`. Next free pgTAP number **422**; next migration
  after `20261003007420`.
- ⚠ **Correction to the agent's report**: it predicted the `419` regeneration would be *"one removed
  plus one added"*. The new door lands on `search_path = ''`, so it never enters the non-empty
  population — the regeneration is a **pure deletion** (gate 18 accepts), and `421`'s complement
  grows by one (`860 + 30 = 890` if nothing else moves — re-measured at build, never quoted).
- `seed.sql` seeds no `authz.roles` row and calls no `assume_role`; the row deletion is a
  migration change only.
- No generator exists for the role manifest; AC-6 models one on `gen-definer-search-path-freeze.mjs`.

Two follow-ups the handoff said needed a ruling before the next backend unit
(`…AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`, `…READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`) are
both **RESOLVED 2026-09-11** in the archive — no gate on this unit.

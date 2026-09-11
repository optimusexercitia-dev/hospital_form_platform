# QA Review — AE5-SUCCESSOR-ADRS

**Unit:** AE5-SUCCESSOR-ADRS · **Branch:** `authz-ae5-successor-adrs` (tip `37835021`) · **Base:**
`main` (`adbde005`) · **Date:** 2026-09-11 · **Reviewer:** `qa`

Scope: `docs/decisions/0207-*.md`, `docs/decisions/0208-*.md`, and the register/marker edits in
`git diff main...HEAD --stat`. Everything below was re-measured against the live catalog
(`supabase_db_azkbbhskturikxpgmafq`) or the tree, never read off the record and trusted.

## Findings

| # | Sev | Where | What | Evidence |
| - | --- | ----- | ---- | -------- |
| 1 | MAJOR | `docs/decisions/0208-…search-path…convention.md:120-125` | D2 says the P2 instrument counts "keyed by OID over nine functions" (the phrase originates unverified in `docs/progress/ae5-successor-adrs.md:346`). The instrument tracks **eleven**. | `sed -n '176,186p' scripts/authz-ae4-p2-invocation-count.sql` lists 11 `pg_stat_get_function_calls(...)` calls (`assignment_facts, has_permission, entailed_grants, holds_role, authorized_scope_ids, candidate_authorized_scope_ids, candidate_has_permission, explain_permission, can_read_professional_profile, can_manage_professional, current_professional_read_organizations`); the `p2_snap` table at `:156-157` declares 11 matching bigint columns (`af,hp,eg,hr,asi,cas,chp,xp,crp,cmp,cwo`). |
| 2 | MAJOR | `docs/decisions/0208-…search-path…convention.md:135-143` | D2's clause-5 claim — `authz.candidate_authorized_scope_ids` "carries a **byte-identical** candidate CTE" to `authz.authorized_scope_ids`, "differing only in its confirmer" — is false as stated: `authorized_scope_ids`'s CTE carries a 2-line comment block (`-- PROPOSE. One id per assignment fact…` / `-- A wrong proposal can only lose a grant…`) that `candidate_authorized_scope_ids`'s CTE does not. The SQL logic is identical; the text is not. Since D2 goes on to prescribe the follow-on unit's method as "extract each candidate CTE from `pg_get_functiondef` and require equality," an assertion built to that letter reds on a comment diff that has nothing to do with the property being tested — the ADR's own prescribed method is broken by its own unverified adjective. | `pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure)` vs `pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)`, diffed line-for-line: only difference inside the CTE is the two comment lines present in the first, absent from the second (SQL body from `select distinct case…` through `end as scope_id` and the `from authz.assignment_facts` line are identical). |
| 3 | MINOR | `docs/features/ae5-successor-adrs.md:12` | The hub's `adrs:` frontmatter (`["0176","0201","0203","0155","0183","0197","0205"]`) lists ADRs this unit *read*/relates-to but omits **0207** and **0208** — the two ADRs this unit *produced*. A sibling hub already named this exact class of gap and fixed it: `docs/features/ae5-opening-adr.md:12` carries the comment `# 0201 + 0203 are the ADRs this unit PRODUCED (QA MINOR-1: the list held only the ADRs read)`. This unit repeats the omission the prior QA round already flagged elsewhere. | `grep -n "^adrs:" docs/features/ae5-opening-adr.md docs/features/ae5-successor-adrs.md`. |
| 4 | NOTE | `docs/plans/pre-ae5-remediation.md:725` (§6 step 3) | The dated correction at this site is inserted *before* the original bullet text within the same numbered item, rather than strictly after/beside it as the other four "increment 1" marker sites do (`git diff main -- docs/plans/pre-ae5-remediation.md` shows a `-`/`+` pair here, not a pure addition). The original wording ("write ADR 0202" / "write ADR 0204" …) is fully preserved verbatim inside the new paragraph, quoted as "Superseded options, kept as history," so ADR 0105's non-rewriting rule is honored in substance; the diff shape alone reads differently from its four siblings. | `git diff main -- docs/plans/pre-ae5-remediation.md` (last hunk). |
| 5 | NOTE | `docs/decisions/0207…:322` / `docs/decisions/0208…:310` | Both ADRs overrun the plan's 180–260-line target (322 / 310 vs. corpus median 123, p90 390). Read in full: the overrun is verbatim PO ruling blocks, SQL blocks and census tables (~90 of 0207's ~202-line Decision section), not prose padding or duplicated content. Consistent with the record's own accounting. | Direct read of both files; `wc -l` = 322 / 310. |

## Verified and reproducing (no finding)

All of the following were independently re-run against the live catalog or the tree, not taken from
the record:

- `commission_administrativo_capabilities_capability_check` — five values exactly as cited (`read_cases`, `view_signoffs`, `schedule_meetings`, `create_cases`, `assign_case_phases`); `bulk_create_cases` confirmed as a door (`public.bulk_create_cases(...)`, `prosecdef=true`, body requires both `create_cases` AND `assign_case_phases` via `app.member_can`).
- `authz.scope_kind` confirmed a **DOMAIN** (`typtype='d'`) over `text`, with the CHECK naming `capability_plane`; confirmed typed on **two** columns (`authz.roles.allowed_scope_kind`, `public.memberships.scope_kind`).
- `TEMP` privilege: `anon`/`authenticated`/`service_role`/`authenticator` all `t` (4/4).
- `search_path` five-value table: `825 / 39 / 23 / 2 / 1` = 890, no `<none>` bucket — exact match.
- `authz.roles` per-`allowed_scope_kind` counts (`R_H=6, R_O=2`) and the full 12-row catalog table (states, `session_selectable`) — exact match, including `staff_admin` sole `authoritative` and `administrativo` sole `capability_plane`/non-selectable.
- `memberships_one_commission_role_uq` — confirmed as a bare unique **index** (not a `pg_constraint` row) with exactly the predicate cited; `memberships` has **0** `capability_plane` rows; `memberships_role_check` admits only the ten cited codes.
- `to_regclass('authz.capability_permissions')` → NULL (table does not exist, as the ADR's Consequences section states); `authz.permissions` = 43 rows including all four named codes; `authz.role_permissions` has rows for exactly one `role_code` (`staff_admin`, 42).
- `platform_role` blast radius: 11 enum labels, 1 column (`app.active_role_selections.role`), 1 non-overloaded routine (`public.assume_role`), 0 RLS policies, 7 TS files (`grep -rln` matched exactly) — all exact.
- The 4 temp-table DEFINER functions, and `public.tenant_orphan_profiles`'s wrapper body/`proconfig`, both exact matches including the one-line qualified `prosrc`.
- `414_definer_search_path_resolves.sql` line numbers: `:109` (§0a message), `:119` (§0b), `:131` (§1) — confirmed by direct line read; the file contains zero occurrences of "does not prove"/"not the security property"/"safety".
- ADR 0183 `:114-115` — confirmed as the "hand-copy the resolver's `CASE`" rejection (not `:67`, which is Decision 1).
- ADR 0182 `:200` — confirmed inside its *Corrections after QA review* section (not Decision), carrying the "house pattern" phrase; ADR 0191's Decisions (D1–D8) confirmed to say nothing about `search_path`; ADR 0183's Decision section confirmed unchanged/extended, not contradicted.
- Tenancy/D-census: 3 orgs, 4 hospitals, 6 commissions, 36 profiles, 43 memberships, 1 admin, 33 seated principals, single-org bucket (`1|33`), formula bound `6+24+6+1=37` — all exact re-runs.
- `src/lib/role/role-catalog.ts`: file is 386 lines; `ROLE_LABELS:42`, `ROLE_SCOPE_KIND:67`, `ROLE_ORDER:99`, `ROLE_BRANCH:194`, `scopeSummary:348`, `ROLE_MANIFEST:121`, `PlatformRole` type at `:39` — all exact.
- `supabase/tests/411_ae48_role_manifest_db_gate.sql` exists; `role-catalog.test.ts` carries no live `execSync`/`docker` call (only a comment describing the historical guard); `supabase/tests/408_ae49_assume_role_session_selectable.sql` exists.
- Numbering: highest ADR on any live ref (3 local + 4 remote, re-swept) is `0206`; sweep for `docs/decisions/(0202|0204|0207|0208)-*` across every ref returns rows only on this branch (0207/0208) — 0202/0204 exist nowhere.
- Headers: both ADRs carry Status/Date/Area/Related; 0207's `Amends: 0176` is the only Amends label; 0208 correctly carries none (checked against 0183/0191/0182 directly, not just the ADR's own self-report). `node scripts/build-adr-index.mjs --check` → rc 0. `docs/decisions/INDEX.md` correctly shows 0176 "amended by … 0207" and no false backpointer into 0201 (`grep -n "adr-backpointers" docs/decisions/0201-*.md` → 0 rows).
- Register edits: `git diff main -- <file>` for all four follow-up bodies shows pure appends (no deletions) of a dated block (`## ✅ RULED` ×2, `## ⚠ RE-CLAUSED, NOT CLOSED` ×2); the index's two `**Closes when:**` rewrites preserve the superseded text inline; both `AE5-MATRIX-ARM3-CELLS-*` index entries keep `**Status:** open`; `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`'s "half 1" (undeclared-`search_path` population) is explicitly left owed, not silently closed.
- Markers: all five "increment 1 is `staff_admin`" sites carry a dated correction beside unchanged original text (`git diff main -- <file>` additions-only at each); `:398`'s "3 sites" claim corrected; `authz-evolution.md:1215`'s existing note updated in place (append directly following the original, not a duplicate marker); reservation-retirement notes present at every surviving "reserved…0202/0204" occurrence I could find (`grep -rn "reserved" … | grep -i "0202\|0204"` — every hit is either historical text immediately paired with a correction, or inside the correction text itself); handoff RESUME block re-routed to `AE5-ROLE-CATALOG-COMPAT`.
- Gate chain: `npm run lint` rc 0 (0/0 eslint, all sub-gates OK); `npm run typecheck` rc 0; `git diff --stat main -- supabase src` empty; `node scripts/check-docs-registers.mjs` (gate 13) rc 0. `test:db`/`e2e:prod`/the four authz arms correctly not owed (no `supabase/`/`src/` diff).
- Line endings: 0 CR in every changed doc file sampled.

## Could not verify

- Whether the `.claude/rules/` file the D5/D6 prospective-rule text orders is the *only* home a
  future reader would look in, versus some existing rule file that should have been amended instead
  — no such file exists yet (correctly deferred to `DEFINER-SEARCH-PATH-NARROW-FIX`), so there is
  nothing on disk to check against.
- Whether `docs/plans/authz-evolution.md:1335`'s replaced status-table row (edited in place rather
  than left beside its original, unlike the five "increment 1" sites) is the intended convention for
  a status **table cell** specifically (as opposed to prose) — plausible given a table row cannot
  sensibly carry two competing values, but the unit's own acceptance criteria describe corrections as
  "beside" throughout and don't call out this cell as an exception.

**Verdict: CHANGES REQUESTED**

Two MAJOR findings (#1, #2) are both measured-fact errors inside ADR 0208 D2 that were not caught by
the unit's own "10 of 14 reproduce, 4 differ" verification pass — meaning that pass's coverage was
itself incomplete for facts introduced in the *drafting* session rather than carried from the PO's
ruling. Neither invalidates the PO's decision, but both are false claims now committed into an
Accepted ADR that a future unit (`AE4-D-SHAPE-ASSERTION`) is ordered to build against literally
("extract each candidate CTE… and require equality"; "nine functions"). Fix: correct the function
count to eleven (or state which specific subset is meant, if a narrower list was intended), and
either drop "byte-identical" for an accurate description (e.g., "identical apart from a two-line
comment block; the SQL bodies are structurally identical") or specify that the unit's equality check
must normalize/strip comments before comparing. The MINOR (#3) should also be fixed while the hub is
still open, since a prior QA round already named this exact gap in a sibling hub.

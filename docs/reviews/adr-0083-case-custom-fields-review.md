# ADR 0083 — Case Custom Fields — QA Review

**Verdict: ✅ APPROVED** · **Date:** 2026-07-23 (r1) · **Reviewer:** `qa` · **Branch:** `worktree-adr-0083-case-custom-fields`

**Findings: 0 P0 · 0 MAJOR · 1 MINOR · 2 INFO.** No blocking issue. Every ADR-0083 decision (D1–D10) is met.
The security crux — the direct-table write-bypass on the two new relations — is closed by RLS at the table
(not only in the DEFINER RPC), verified against the **live catalog** and by running pgTAP `188` green.

> **Audit-state note (read first).** The running local DB did **not** have this branch's migration applied
> (latest applied was `20260820000000`; the `case_custom_fields` flag, both tables, and both RPCs were
> absent — the reset the lead described predated the branch). Per the CLAUDE.md graphify exception, every
> RLS/RPC/grant fact below is verified against the **live catalog**, so I applied the single pending forward
> migration `20260821000000_case_custom_fields.sql` in one transaction (the exact production linear path —
> **not** a `db reset`) to materialize the objects, then queried `pg_policies` / `pg_proc` / ACLs directly.
> It applied cleanly. **The objects are now present in the shared local DB** (a `db reset` would recreate
> them identically). Flagging so the lead knows the DB state changed.

---

## 1. Security / RLS crux — the direct-table bypass is closed at the table

The BUG-SUP-002 lesson: a DEFINER-RPC authority gate is bypassable if the table carries broad
`authenticated` DML. Both new tables carry `grant all … to authenticated`, so **RLS must be the enforcer** —
and it is. Live catalog (`pg_policies`), not migration text:

**`case_custom_field_values`** — policies are byte-identical to the `case_offered_outcomes` sibling, including
the ADR-0078 exclusion arm:
- SELECT: `app.can_read_case(case_id, auth.uid())`
- ALL (write) USING + WITH CHECK: `app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, auth.uid()))`

**`process_template_custom_fields`** — byte-identical to `process_template_outcomes`:
- SELECT: `is_member_of(commission_of_template) OR is_commission_admin_of(commission_of_template)`
- ALL (write): `is_staff_admin_of(commission_of_template) OR is_commission_admin_of(commission_of_template)`

Both tables: `relrowsecurity = t`. Each table has **exactly two** policies (one SELECT, one `FOR ALL`) — so
the sole write path is the authority-gated policy; there is **no permissive sibling grant** faking a positive
assertion (§7.1 shape 6). The exploit is therefore structurally impossible, independent of the RPC.

**pgTAP `188` runs green** — I installed pgtap + `00_setup.sql` into the live DB and ran the file:
`plan 1..28`, **0 `not ok`**. It is well-constructed against the §7.1 traps: tests 22–24 prove a plain member's
direct INSERT raises `42501` and a raw UPDATE is silently RLS-filtered (value unchanged); tests 25–29 prove an
**excluded staff_admin** is denied by *both* the RPC (`HC0F1`) and the raw-DML path, and the fixture
**PRE-asserts both** `is_staff_admin_of` **and** `is_case_excluded` (tests 25–26) so the deny lands on the
exclusion gate, not vacuously on authority.

## 2. RPCs — authority, grants, and the stale-body regression

Live `pg_proc` / ACLs:

| RPC | `prosecdef` | search_path pinned | PUBLIC in ACL? | grants |
|---|---|---|---|---|
| `create_case_from_template(uuid,text,uuid,text,uuid,jsonb)` | `t` | `app, public, pg_catalog` | **no** | authenticated, service_role |
| `update_case_custom_field_values(uuid,jsonb)` | `t` | `app, public, pg_catalog` | **no** | authenticated, service_role |

`REVOKE ALL FROM PUBLIC` took (PUBLIC absent from `proacl`) — the t19 pgTAP guard is satisfied.

- **`create_case_from_template`** — required-field validation raises **`HC068`** *before* the case is minted
  (reads only defs + payload); the snapshot insert freezes `key/label/field_type/options/position` and writes
  the value verbatim (a number stays a JSON number). **No stale-body regression** (memory: "Re-emit DEFINER
  body from live def"): I captured the live body pre-migration and diffed it against the post-migration body —
  the *only* removed line is the function signature (the arity change). The entire prior body is preserved as
  a strict superset; the two ADR-0083 additions are the only insertions.
- **`update_case_custom_field_values`** — the audited edit authority. Live body (`prosrc`) confirms:
  authority self-gate (staff_admin/commission-admin flag-independent, OR `member_can('create_cases')` behind
  `assert_administrativo_enabled`, else `42501`) → `assert_not_case_excluded` (`HC0F1`) → terminal freeze
  (`HC025`) → required-cannot-be-blanked (`HC068`) → UPDATE-existing-rows-only (snapshot set cannot grow) →
  `app.audit_write('case.custom_fields_set', …)`.

## 3. Audit (Rule 11) & PHI (Rule 12)

- **Rule 11:** the edit path emits an audit row — live body calls the real `audit_write` DEFINER
  (`prosecdef = t`) with a PHI-free payload (`count` only, no values). Create-path custom fields ride the case
  creation, itself audited. ✅
- **Rule 12:** both tables are ordinary case-attribute relations, **not** behind the PHI single-door — the
  intended D4 design. No identifier columns, no PHI leakage; the non-PHI boundary is the accepted soft
  fill-time warning. ✅

## 4. Requirements — ADR 0083 D1–D10

| # | Decision | Status | Evidence |
|---|---|---|---|
| D1 | Dedicated tables, not responses/answers | ✅ | `process_template_custom_fields` + `case_custom_field_values`; no `responses`/`answers` coupling |
| D2 | Snapshot-on-create (frozen key/label/type/options) | ✅ | migration snapshot insert copies `f.key/label/field_type/options/position`; pgTAP 9–13 assert frozen label/type |
| D3 | Minimal subset + jsonb value (number as JSON number) | ✅ | CHECK constrains to `short_text/number/date/dropdown/multiple_choice`; `custom-field-input.tsx:110-125` emits a JS `number`; `mapCaseCustomFieldValue` narrows verbatim; pgTAP 12 asserts `jsonb_typeof = number` |
| D4 | Non-PHI fill-time warning | ✅ | `CustomFieldsPiiWarning` (create-case-dialog.tsx:93-107), pt-BR, `role="note"`, above the block |
| D5 | Draft-only authoring, frozen on publish | ✅ | server actions gate `ctx.status !== 'draft'` → `notDraft` (actions.ts:754/824/857/889) + `authorizeCommission`; UI `editable={isDraft}`. See INFO-1 |
| D6 | Captured in "Novo caso", atomic in RPC, required blocks | ✅ | `customFieldsBlocked` client submit-gate (dialog:264-268) + server `HC068` in the create transaction |
| D7 | Editable after creation, audited | ✅ | `updateCaseCustomFieldValues` action → `update_case_custom_field_values` RPC (audited); edit dialog + panel on both detail routes |
| D8 | Detail display + opt-in list column/filter | ✅ | `listCaseCustomFieldValues` (full set) + `fetchBoardCustomFields` (batched, `show_in_list` inner-join, no N+1); table/kanban chips; `cases-view` filter; column opt-in |
| D9 | Process-less cases get none | ✅ | `customFields` computed only when `!isProcessless` (dialog:219-220) |
| D10 | Feature flag `case_custom_fields` (default off) | ✅ | migration inserts `enabled=false`; added to `FeatureFlags` + `caseCustomFieldsEnabled()`; seed forces on for E2E |

## 5. Code quality

- **Rule 8** — types regenerated (`database.ts` carries both tables + both RPC signatures). ✅
- **Rule 9** — no inline supabase-js in the new components; all data access via `src/lib/queries/`. The
  client `custom-field-input.tsx` uses **type-only** imports from the `server-only` query module (erased at
  compile — comment at :3-4). ✅
- **Rule 10** — user-facing strings pt-BR; code/comments English. ✅
- **TS strict** — no unjustified `any`; `unknown`→narrow in `mapCaseCustomFieldValue` and `customFieldsFromForm`. ✅
- **No service-role key** in client code. ✅
- **Errors → pt-BR** — `HC068`/`HC025`/`42501` mapped to friendly messages; no raw Postgres error reaches the UI. See MINOR-1.

## 6. Findings

**MINOR-1 (UX specificity; non-blocking).** On the edit path, an *excluded* coordinator triggers the RPC's
`HC0F1`, but `mapCaseError` has no `HC0F1` case, so it falls to `default → MESSAGES.generic`
(`src/lib/cases/actions.ts:254`, default at :253-254). The user sees a generic pt-BR message instead of the
specific "você está impedido neste caso" text. This is **not** a raw-error leak (Rule respected) and it
**mirrors the existing `update_case_meta` behavior**, so it is a pre-existing pattern, not a new defect. Cheap
to improve (add an `HC0F1 → MESSAGES.forbidden`/excluded case) if the lead wants MINORs cleared before record.

**INFO-1 (defense-in-depth; matches the named sibling).** D5's "frozen on publish" for definitions is enforced
in the **server-action layer** (`ctx.status !== 'draft'`) + UI, **not** at the DB — the RLS write policy has no
status gate, so a staff_admin could bypass the freeze via a direct PostgREST write to
`process_template_custom_fields` on an *active* template. This is **identical** to the ADR's named model
(`process_template_outcomes`, whose draft-freeze also lives in the `set_process_outcomes` RPC, not RLS). Impact
is bounded: staff_admin authority only (no escalation, no cross-tenant, no PHI), and historical cases are
snapshot-frozen regardless. Consistent with the accepted platform pattern — recorded, no action required.

**INFO-2 (process).** See the audit-state note at the top — the branch migration was not in the local reset;
I applied it forward to obtain live-catalog truth. The shared local DB now contains the ADR-0083 objects.

## 7. Verdict

The direct-table write-bypass is closed by RLS at the table (live-catalog-verified, pgTAP 188 green, no
permissive sibling); both RPCs are `SECURITY DEFINER` with pinned search_path and PUBLIC revoked;
`create_case_from_template` was rebuilt from the live def with no lost logic; the edit path is authority-gated,
exclusion-aware, terminal-safe, and audited; Rule 12 holds (non-PHI by design); and every ADR-0083 decision
D1–D10 is met. One MINOR (error-message specificity, mirrors existing behavior) and two INFO notes, none
blocking. **APPROVED.**

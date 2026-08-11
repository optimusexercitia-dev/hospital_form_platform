# Build Plan — Ethics E4 · Participant seating & professional identity

**Closes:** FUP-ETH-1 · **Binding model:** ADR
[0108](../decisions/0108-eth-e4-participant-seating.md) (revised post-QA —
[eth-e4-plan-review.md](../reviews/eth-e4-plan-review.md)) · **Substrate:** ADR
[0064](../decisions/0064-case-subject-generalization-participants.md) / ADR
[0072](../decisions/0072-ethics-access-spine.md) D6 · **Branch:**
`worktree-ethics-committee-completion` off `main` @ `9fbc69d`

> Everything below was verified against the **live catalog** (`pg_proc`, `pg_policies`,
> `information_schema`, grants), not migration files — which are stale by design. The QA pass
> re-ran every catalog claim with the shared stack quiescent; the one claim the original
> scoping got wrong (`set_primary_subject`, truncated query casualty) is corrected below.

---

## 0. Source anchors (what exists — E4 extends, never re-creates)

| Anchor | State |
| ------ | ----- |
| `public.add_case_participant(case, participant, role, is_primary, summary)` | DEFINER, gated `is_staff_admin_of(commission)` → `HC0E4`, `is_case_excluded` → `HC0F1`, role/type match → `HC0E3`, `assert_respondent_linkage_resolved` → `HC0F0`, audited. **Do not modify.** |
| `public.set_primary_subject(p_case_participant_id)` | **EXISTS** (shipped `20260720001010`, gate-fixed `20260722000000`). DEFINER, gated `HC0E4`/`HC0F1`, audited `case.primary_subject_set`, EXECUTE to `authenticated`. **Set-only**: cannot move a primary (second set raises `HC0E7`), and does **not** re-run the linkage assert. Keystoned by pgTAP **228** (t19 ACL) · **229** (M1·2 exclusion gate + door census) · **314** (QO wall 11.3). §1.3 modifies it. |
| `public.create_professional_profile(p_org, …, p_user_id)` | DEFINER, audited, **zero callers**. Writes `professional_profiles` only — no registry rows, no trigger. |
| `public.remove_case_participant` · `set_case_participant_role` · `update_professional_profile` · `set_professional_link_state` | DEFINER, audited, exist, **zero callers**. |
| `app.can_manage_professional(p_org, p_uid)` | `is_admin()` ∨ `is_org_admin_of(org)` ∨ staff_admin of any commission in org. Expiry- and hat-aware via `has_role`. ⚠ Its `is_org_admin_of` disjunct reads the **caller's** `auth.uid()`, not `p_uid` (recorded in its header) — fine while every call binds `p_uid => auth.uid()`; do not add a call site that doesn't. |
| `app.can_read_professional_profile(p_profile_id, p_uid)` | `is_admin()` ∨ seated-on-a-readable-case. Backs both `professional_profiles_select` and `professional_participants_select`. |
| `participants_select` | `is_org_member(organization_id) ∨ is_admin()` — org-scoped, the picker's perimeter for **both** lanes. |
| `case_participant_roles` (seed) | 7 roles; 4 need the external lane: `complainant` {external_person, professional} · `witness` {external_person, professional} · `legal_representative` {external_person} · `external_regulatory_body` {regulatory_body}. |
| `getCaseDetail` → participants | **Already wired**, [`src/lib/queries/cases.ts:1281`](../../src/lib/queries/cases.ts:1281). No read work needed. |
| `CasePrimarySubjectPanel` | Shipped, read-only, rail. **Do not rewrite** — E3a E2E asserts its heading + empty state. |
| `reference-picker.tsx` | FF-5 typeahead; the UI pattern to mirror. Its RPC is response-scoped, so not reusable as-is. |
| `list_addable_commission_members` / `src/lib/queries/members.ts` | The org roster for the "possui conta" user pick. |
| Flags `ethics` · `case_participants` · `case_types` | All **ON** in `seed.sql`. A flag-OFF spec must toggle them itself. |

**Missing, and why the panel is unfillable:** exactly one function inserts into `participants`
(`set_participant_patient`); **zero** insert into `professional_participants`; all four tables
are SELECT-only for `authenticated`. And no door mints the five non-sensitive participant
types at all, so four of the seven seeded roles are unfillable without §1.2.

⚠ **Every new door goes in `public`.** `config.toml` exposes only `public` +
`graphql_public`; an `app.*` RPC is a PostgREST 404 no client can reach, there are zero
`schema('app')` call sites in `src/`, and pgTAP would stay green while every action 404s —
only E2E traverses PostgREST.

## 1. Migrations (`backend`) — window `20260919…`

Above the highest **registered** version `20260918003100`. Author the files now; apply only
when the shared stack is free (§6).

### 1.1 `20260919000100_eth_e4_ensure_professional_participant.sql`

- `public.ensure_professional_participant(p_profile_id uuid) returns uuid`, `security
  definer`, `set search_path = app, public, pg_catalog`; `revoke all … from public` then
  `grant execute … to authenticated, service_role` (the t19 door pattern).
- `perform app.assert_case_participants_enabled();`
- Authorize `app.can_manage_professional(pp.organization_id, auth.uid())` → else `HC0E4` with a
  pt-BR message.
- **`create unique index … on professional_participants (professional_profile_id)`** — the
  1:1 invariant the get-or-create depends on; nothing enforces it today (pkey is
  `participant_id`). ⚠ **Data-dependent on the remote**: the seed writes this table directly
  (`seed.sql:2756`); §6 includes a read-only remote duplicate check before `db push`.
- **Get-or-create with the race arm (ADR D1):** return the existing
  `professional_participants.participant_id` when present; else insert
  `participants (organization_id, participant_type => 'professional', sensitivity_class =>
  'professional_identity', display_name => pp.full_name, created_by => auth.uid())`, then the
  link row with **targeted** `on conflict (professional_profile_id) do nothing` — never the
  untargeted form. If the link insert conflicts (lost the race), **delete the orphaned
  `participants` row just inserted** and return the winner's `participant_id`.
- `perform app.audit_write('professional.participant_minted', 'professional', p_profile_id, …)`.

### 1.2 `20260919000200_eth_e4_create_external_participant.sql`

- `public.create_external_participant(p_org uuid, p_type text, p_display_name text) returns
  uuid`, DEFINER, same door pattern (ADR D8).
- `perform app.assert_case_participants_enabled();` then
  `app.can_manage_professional(p_org, auth.uid())` → else `HC0E4`.
- Validate `p_type ∈ {external_person, department, institution, regulatory_body, other}` and
  `btrim(p_display_name) <> ''` → else raise with a pt-BR message (the
  `participants_sensitivity_derives_type` CHECK backstops the type set).
- Insert `participants (…, sensitivity_class => 'non_sensitive', display_name =>
  btrim(p_display_name), created_by => auth.uid())`. **Create-always — no get-or-create, no
  unique index**: reuse is by human choice in the picker (ADR D8).
- `perform app.audit_write('external.participant_minted', 'participant', v_id, …)`.

### 1.3 `20260919000300_eth_e4_set_primary_subject_move_and_linkage.sql`

- **`create or replace` over the SHIPPED `public.set_primary_subject` — this is a
  modification of a keystoned door, not a new door.** Exactly two deltas; every other line,
  the gates (`HC0E4`/`HC0F1`), and the audit event name (`case.primary_subject_set`)
  byte-identical:
  1. **Move semantics:** demote the case's current primary
     (`set is_primary_subject = false where case_id = … and is_primary_subject and removed_at
     is null`), **then** promote the target — two sequential statements, so the partial
     unique index behind `HC0E7` is never transiently violated (a single dual-row UPDATE has
     no guaranteed row order). Keep the existing `unique_violation` → `HC0E7` arm as a
     backstop.
  2. **Linkage re-run:** `perform app.assert_respondent_linkage_resolved(<participant>,
     <role>)` for the target row — promotion must not become a way around `HC0F0`
     (`set_professional_link_state` can flip a profile back to `unknown` after seating).
- ⚠ **Never DROP+CREATE** — a rebuild silently drops the ACL. Afterwards diff `prosecdef`,
  `proconfig` and the ACL **from the catalog**, property by property, against the pre-change
  values. No `revoke`/`grant` statements in this file — the door keeps its shipped ACL.
- Suites **228 / 229 / 314 must stay green** (they assert ACL, exclusion gate, and tenancy
  wall — none pins set-only semantics; verify rather than assume, and update any door census
  consciously).

### 1.4 `20260919000400_eth_e4_professional_read_org_manager_arm.sql`

- Add one disjunct to `app.can_read_professional_profile`:
  `or app.can_manage_professional(<profile>.organization_id, p_uid)`.
- ⚠ **`create or replace`, never DROP+CREATE**; afterwards diff `prosecdef`, `proconfig` and
  the ACL from the catalog, property by property.
- Header comment carries ADR 0108 D5's exposure argument in full — including the **mint-time
  inference** (post-E4, registry presence implies ≥1 case involvement; accepted, with
  `participants_select` named as the seam to revisit) and the **caller/target asymmetry**
  D5 propagates.

**Then** `npm run gen:types` (Rule 8) — regenerate with pgtap dropped.

## 2. Data access + actions (`backend`)

- **`src/lib/queries/participants.ts`** (new, Rule 9):
  - `searchParticipants(orgId, query, participantTypes)` — plain **invoker-rights**
    RLS-scoped query on `participants` (org-scoped, filtered by type), left-joined to
    `professional_profiles` for CRM/specialty on the professional lane (readable via §1.4).
    Serves both the professional typeahead and the external-reuse search. **Never a DEFINER
    search door** (ADR 0091 ruling 3).
  - `listCaseParticipantRoles(orgId, caseTypeId)` — org-wide roles plus the case-type's own,
    `is_active` only, for the role select.
- **`src/lib/participants/actions.ts`** — replace all 7 `notImplemented()` bodies; delete the
  helper. **The 7 existing signatures and input shapes are the frozen BE-1 contract — do not
  change them.** Add **one new exported action** `createExternalParticipant(orgId, type,
  displayName)` (additive, not a contract change). `addCaseParticipant` calls
  `ensure_professional_participant` first when handed a profile id; `setPrimarySubject` calls
  the (modified) shipped RPC. pt-BR error mapping, raw Postgres errors never reaching the UI
  (§8): `HC0E3` papel inválido para o tipo · `HC0E4` sem permissão · `HC0E7` já existe sujeito
  principal · `HC0F0` vínculo não resolvido · `HC0F1` impedido no caso · `HC0F2` vínculo
  congelado.

## 3. Frontend

Invoke the **`frontend-design`** skill before building (§4 mandate for new screens).

- **`src/components/cases/case-participants-panel.tsx`** — main-column section: participant,
  role, involvement summary, primary-subject marker; add / remove / set-role / set-primary.
  Server Component shell + a client island for interactions. Write affordances gated on
  `caps.canManageLifecycle`. **Name rendering (ADR D3):** show the live
  `professional_profiles.full_name` when the row's profile is readable, falling back to
  `participants.display_name` (a mint-time snapshot, divergence accepted).
- **`src/components/cases/add-participant-dialog.tsx`** — two paths behind one dialog:
  - **Profissional** — org-scoped typeahead (mirror `reference-picker.tsx`), plus an inline
    "cadastrar novo profissional" form carrying the **required, un-defaulted** linkage choice
    (ADR 0108 D6): *possui conta* → user pick from the org roster; *não possui conta* →
    explicit confirmation naming the consequence.
  - **Pessoa externa / órgão** — search existing external participants first (reuse by human
    choice, ADR D8), else create: type select (the five non-sensitive types, pt-BR labels) +
    display name.
  - The role select filters to roles whose `allowed_participant_types` matches the chosen
    participant's type, so `HC0E3` is unreachable in normal use.
- **`src/components/cases/resolve-linkage-dialog.tsx`** — the remediation for profiles already
  at `unknown`, reachable from a roster row.
- Mount in [`case-detail-view.tsx`](../../src/components/cases/case-detail-view.tsx), main
  column, behind the `case_participants` flag. **Leave `CasePrimarySubjectPanel` and
  `CasePatientPanel` untouched.**

## 4. Vocabulary admin (frontend-only — no substrate work)

Both tables already carry `authenticated` DML grants and an org-admin `ALL` policy
(`is_admin() ∨ is_org_admin_of(...)`), consistent with the noun rule (platform_admin may
administer vocabulary). Mount on the existing
[`/o/[org]/manage/tipos-de-caso`](../../src/app/o/[org]/manage/tipos-de-caso/page.tsx) via
[`case-type-manager.tsx`](../../src/components/org/case-type-manager.tsx):

- **`case_participant_roles`** — `key`, `display_name`, `allowed_participant_types[]`,
  `is_primary_subject_candidate`, `is_active`, optional `case_type_id`. Makes the 7 seeded
  roles (incl. `respondent_doctor` → "Médico denunciado") editable in-app for the first time.
- **`case_type_terminology`** — the 5 slots per case type: `case`, `decision`, `document`,
  `primary_subject`, `timeline` (`singular_label`, `plural_label`, `help_text`).

⚠ `getCaseTypeTerminology` must still resolve **byte-for-byte** to today's hardcoded strings for
a `caseTypeId = null` case — every non-Ethics case depends on that fallback.

## 5. Tests

### 5.1 pgTAP — `supabase/tests/321_eth_e4_participant_seating.sql` (320 is highest)

Each keystone written so it **can** fail:

1. Full professional seating path succeeds for a staff_admin of the case's commission.
2. A plain staff member calling any of the three mint/primary doors gets `HC0E4`.
3. **Read-gate keystone (D5).** A member who is neither an org manager nor a case reader still
   gets **0 rows** from `professional_profiles`. **Prove it can fail:** revert the arm and
   require RED — a no-regression test passes a widening by construction.
4. `ensure_professional_participant` is idempotent — called twice ⇒ exactly one `participants`
   row and one link row (the unique index holds), same id returned both times.
5. An `unknown`-linkage profile is refused as `respondent_doctor` (`HC0F0`), and succeeds after
   `set_professional_link_state`.
6. **`set_primary_subject` MOVES the primary** — with a primary already set, promoting another
   participant succeeds and demotes the old one, never raising `HC0E7`. ⚠ This is a **behavior
   change to a shipped door**: this test is RED against today's set-only body — write it
   first and watch it fail. Also: promotion of an `unknown`-linkage respondent is refused
   (`HC0F0`) — the §1.3 delta 2 keystone.
7. **External lane (D8).** `create_external_participant` mints a `non_sensitive` row; an
   external complainant seats successfully under the `complainant` role; a disallowed type is
   refused; a professional-only role over an external participant raises `HC0E3`.
8. **`participants`-writer census — closes FUP-FF5-2.** Assert the writer set by **count and
   name**, derived from the catalog: after this track it is genuinely `set_participant_patient`
   + `ensure_professional_participant` + `create_external_participant`. (ADR 0091's prose
   claimed two while the catalog answered one; write the assertion from the catalog, not any
   ADR's number.)
9. **Regression fence:** suites **228 / 229 / 314** stay green on the same fresh reset. If a
   door census in 229 reds on the two new doors, update it **consciously by name** — the new
   mint doors are org-scoped, not case-scoped, so the exclusion-durability census should be
   unaffected; verify rather than assume.

### 5.2 E2E (`tester`)

- **`e2e/ethics-e4-participants.spec.ts`** (new) — seat a respondent end-to-end through the UI;
  create-inline path and pick-existing path; **seat an external denunciante** (create + reuse);
  remove; change role; **move the primary subject**; resolve a legacy `unknown` linkage. At
  least one **keyboard-only** flow (§8). The external + respondent flows together are the
  proof the doors live in a PostgREST-reachable schema — pgTAP cannot catch a `public`/`app`
  misplacement.
- **`e2e/ethics-e3a-surfacing.spec.ts`** — replace the three raw
  `dbInsert('case_participants', …)` sites with the real product path. **This replacement is
  the proof the panel is reachable**, and is the acceptance criterion for FUP-ETH-1.

## 6. Sequencing & the shared stack

A second session's `npm run e2e:prod` (pid 3520, `fix-vacuous-assert-act-expiry-acl` worktree)
has owned the local Supabase stack since 02:58 and resets the DB between batches — it truncated
two catalog queries mid-flight during the original scoping (the cause of the
`set_primary_subject` false negative; the QA re-verification ran quiescent). Their reset reads
**their** worktree's `supabase/migrations`, so files authored here are invisible to it and
cannot void their run.

1. **Now, zero DB access** — all four migration files, `queries/participants.ts`, the 7 action
   bodies + the new external action, the roster components, the vocabulary editors, the pgTAP
   file, the E2E specs.
2. **Then, exclusive stack** (confirm pid 3520 has exited): `supabase db reset` →
   `npm run gen:types` → the gate below.
3. **Before any `db push` (whenever the PO authorizes one):** read-only remote check for
   duplicate `professional_participants.professional_profile_id` — the §1.1 unique index is
   data-dependent and a 0-row local reset proves nothing about the remote (23514 shape).

## 7. Gate (CLAUDE.md §6, in order)

1. **Build** — `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:db` on a
   **fresh reset**. Then `ARM=census`, `ARM=hat` and `ARM=floor`.

   > ⛔ **CORRECTED 2026-08-11 during the build.** This step originally called `ARM=census`
   > "the arm that catches the two gates this track adds". **It does not.** Per ADR 0079
   > **Amendment 5** and the standing **FUP-AFF-1** trap, the census's LIVE domain excludes
   > scalar- and void-returning DEFINER doors — and all three E4 write doors return `uuid`
   > or `void`. `ARM=census` HOLDS over them because they are **invisible to it**, not
   > because they are accounted. Run it (it still covers the widened predicate), but
   > **never cite it as coverage for the write doors** in the gate record.
   >
   > **Their real coverage is the neutralization oracle, by hand, per door:** open each
   > gate, require suite 321 to FAIL, restore it, confirm PASS. That is what the record
   > must name. **Plus the diff-scoped door sweep over all four changed gates**
   (the two new mints, the modified `set_primary_subject`, the widened
   `can_read_professional_profile`), derived from the migration diff, never by hand (ADR 0079
   Amendment 1). BLIND blocks the phase; `ERROR` is not a pass. **Plus the §1.3/§1.4
   property diffs** (`prosecdef` / `proconfig` / ACL, from the catalog) for the two
   `create or replace`d doors.
2. **Test** — `npm run e2e:prod` (never a plain `npx playwright test` monolith on Windows).
   Triage reds against the known flaky baseline before calling regression; check for
   `reset FAILED` batches and batch-number gaps before trusting the totals.
3. **QA** — `docs/reviews/eth-e4-review.md`, with two named focus items: the D5 read-gate
   widening (keystone must be shown able to fail) and the `set_primary_subject` modification
   (property diff + 228/229/314 green).
4. **Human approval** — built / test results / QA verdict / open risks, then wait.
5. **Record** — PROGRESS.md (rotate FUP-ETH-1 out of the live follow-ups, **moving the marker
   in the same edit**), `docs/backend-state.md` for the four new/changed doors, `graphify
   update` — **lead-only, after the merge to `main`**, in its own `chore(graphify):` commit —
   then `phase(ETH·E4): complete — …`. **Name the ARM, never the script**, in the gate record.

## 8. Risks

- **`set_primary_subject` is a shipped, keystoned door being modified.** The two deltas must
  be surgical; the property diff (`prosecdef` / `search_path` / ACL, from the catalog) and the
  228/229/314 regression fence are the containment. If the deltas grow, stop and revisit.
- **The read-gate widening (D5) is the other real security change.** Its keystone must be
  shown able to fail; otherwise it is decorative.
- **`add_case_participant` stays untouched.** If it turns out to need a change, that re-opens
  its gate and audit path — revisit the plan rather than patching it mid-build.
- **The §1.1 unique index is data-dependent on the remote** — §6 step 3 is mandatory before
  any push.
- **External participants are create-always** — duplicate rows are an accepted cost (ADR D8);
  the picker's reuse-first flow is the mitigation, not a constraint.
- **All three flags are ON locally**, so flag-OFF behaviour needs a spec that toggles them.
- **Migration numbering** must stay above `20260918003100`.
- **Two sessions, one local DB** — do not reset while another worktree's gate is running.

# QA Review — ADR 0137 batch (MRN erasure key; case/referral usability)

> ⚠ **SUITE NUMBERS IN THIS DOCUMENT ARE PRE-RENUMBERING.** Every `359` / `360` / `361` below that
> refers to *this batch's* suites now means **`362` / `363` / `364`** — renamed at the §6 Record step
> (2026-08-24) acting on r2's own finding that those numbers were already cited by AFF2's records.
> ⛔ **`359_profiles_dob_phone.sql`, `360_credentials_hospital_admin_read.sql` and
> `361_list_org_people_dob.sql` are AFF2's, unrelated suites** — following a citation below to a
> bare `359` lands in the wrong file. The bodies were left unedited on purpose: a review is a record
> of what was found, not a document to retro-fit.


**Reviewer:** `qa` · **Date:** 2026-08-23 · **Gate:** §6 step 3
**Subject:** the uncommitted working tree (4 migrations, 3 new pgTAP suites, `src/**`, `e2e/**`).
Nothing is committed, merged, or pushed. Reviewed against `main` via `git diff HEAD`.

**Verdict: CHANGES REQUESTED** (4 items, all concrete; none is a regression, none is an
access-control hole). Detail in § Required changes; the reasoning is in § Requirements audit.

---

## 0. Method, and what it is worth

Everything asserted below about schema, RLS, RPCs and authorization was measured from the
**live catalog** on the local stack (`pg_proc` incl. `prosecdef`, `pg_policy`, `pg_trigger`,
`pg_class.relacl`, `pg_constraint`), never from migration text. `supabase_migrations
.schema_migrations` confirms all four batch migrations (`20261003001300`–`001600`) applied.

Re-derived independently rather than accepted on report:

| Claim | Re-derived | Result |
|---|---|---|
| lint 8/8 | `npm run lint` | **exit 0**, all eight; `lint:set-local` watermark **unchanged** (`20260928000500`) — not bumped |
| `ARM=census` HOLDS | ran it | **exit 0** — "no unswept newcomer within this arm's domain" (see R-8 for what that domain excludes) |
| `FROMFINDINGS=1 ARM=wrapper` HOLDS | ran it | **exit 0**, BLIND set 41, all allowlisted |
| Diff-scoped door sweep = *measured empty* | `pg_policy` + migration diff | **confirmed** — zero policies created/altered by this batch |
| "all 18 re-emitted bodies still hold their authz guards (2–7 refs each, none zeroed)" | counted `app.can_*`/`is_*`/`assert_*` per body | ⚠ **not reproducible** — the true range is **0–6** (see R-9) |

Not re-run (lead owns it): the full `e2e:prod` gate. `npm run typecheck` and the vitest suite
were accepted on the lead's report; eslint at 0 warnings is consistent with them.

---

## 1. Requirements audit — D1–D14

| D | Subject | Status |
|---|---|---|
| D1 | three-mode `patient_mode` replaces the boolean | **PARTIAL** — DB complete; `required` is **unreachable from the product** |
| D2 | `patient_required_fields`, `mrn` welded in, UI renders it selected + non-interactive | **PARTIAL → the UI half is MISSING** |
| D3 | three-layer enforcement, DB layer counts | **IMPLEMENTED (DB)**, layer 3 missing, layer 2 implemented differently |
| D4 | MRN mandatory at SEND, save floor untouched | **IMPLEMENTED** |
| D5 | deferred creation; buffered picks/PHI | **IMPLEMENTED**, and better than the ADR specifies |
| D6 | draft resumes in the wizard | **IMPLEMENTED** |
| D7 | draft destination immutable, and says so | **IMPLEMENTED** |
| D8 | attributed work is actionable | **IMPLEMENTED** |
| D9 | drop `Unidade / setor` + `Idade`; values stay visible | **IMPLEMENTED** |
| D10 | `type_label` → `display_label` | **IMPLEMENTED** — two-sided keystone verified from the catalog |
| D11 | `assignment_role_id` + DEFINER twin, no UI | **IMPLEMENTED** |
| D12 | `Registros` → `Atividade` | **IMPLEMENTED** |
| D13 | Process detail adopts the work-shell | **IMPLEMENTED** |
| D14 | `Tipo de caso` draft-only | **IMPLEMENTED**; its ratified justification is **false** (R-3) |

### D1–D3 — the schema half is excellent; the product half does not exist

What is built, measured:

- `patient_mode text` + `patient_required_fields text[]` on **both** `process_template_versions`
  and `cases`, with three CHECKs each — vocabulary, domain (`<@ {name,mrn,date_of_birth,sex,
  encounter_ref,attending}` — `age_years` and `unit` excluded *by constraint*, per plan step 4),
  and `required ⇒ 'mrn' = any(...)`. D2's "a set, not a bitmask" honoured.
- `collects_patient` / `patient_enabled` **dropped**; zero live bodies reference them as columns.
  `public.get_case_detail` matches the regex only on the JSON **output key**
  `'patient_enabled', (v_case.patient_mode <> 'none')` — a derived back-compat alias, not a
  column reference. Correct.
- **D3's enforcement point is exactly where the plan says**: the refusal lives in
  `app._set_participant_patient_unchecked` (`prosecdef = f`), so **both** the compat door
  `set_case_patient` and the E1 multi-patient door `set_participant_patient` inherit it. Verified
  by reading the live body: the `assert_patient_required_fields` call sits *after* the ADR-0038
  `name OR mrn` floor and *before* any row is written. The caller set is still exactly **four**.
- The deferred constraint trigger is real: `guard_case_patient_required_trg`, `AFTER INSERT …
  DEFERRABLE INITIALLY DEFERRED` on `cases`, plus `guard_case_patient_mode_immutable_trg`
  `BEFORE UPDATE OF patient_mode, patient_required_fields`. `dispose_case_phi`'s terminal write
  (`set has_patient, phi_disposed_at, phi_disposed_by, phi_disposed_reason`) touches neither
  guarded column — verified from `pg_get_functiondef`, so erasure cannot be blocked by the guard.
- `app.patient_required_missing` handles the `sex = 'unknown'` sentinel explicitly. Without that,
  a required `sex` would be satisfied by the column default on every row. This is the sharpest
  piece of design in the batch.
- SQLSTATEs `HC0T1`–`HC0T4` are each used by exactly this batch; a full `HC*` census across
  `app` + `public` shows **no collision** (`HC0T0` is `close_case`, pre-existing).

**What is not built — and this is the blocking finding.** Measured: `patientMode`,
`patient_mode`, `patientRequiredFields` appear in **zero `.tsx` files**. Specifically:

- `src/components/process-templates/collects-patient-picker.tsx` is **untouched by this batch**
  and is still a **boolean toggle** calling the deprecated shim `setTemplateCollectsPatient`,
  which hardcodes `setTemplatePatientMode(id, collects ? 'optional' : 'none', **[]**)`
  (`src/lib/cases/actions.ts:1121-1125`). There is **no field picker**, so D2's explicit
  requirement — *"`mrn` is always present and **the UI must render it selected and
  non-interactive**"* — has no implementation at all.
- Consequently **no user can put a template version, or a case, into `required` mode.**
  Confirmed against the live DB: `process_template_versions` = 1 `none` / 1 `optional`;
  `cases` = 14 `none` / 2 `optional`; **zero `required` rows**. `supabase/seed.sql` writes
  none. `e2e/case-referral-usability-batch.spec.ts` contains no `required`-mode test.
- D3 layer 3 — *"the form marks the inputs required"* — is absent:
  `src/components/cases/create-case-dialog.tsx:62` still takes `collectsPatient: boolean` and
  its docblock still says *"offers the **optional** PHI block … Snapshotted into
  `cases.patient_enabled`"*, a column that no longer exists.
- D3 layer 2 — *"the server action pre-checks for a friendly message"* — is implemented as
  **error mapping**, not a pre-check (`src/lib/cases/actions.ts:320-325`, `:986-990`). The
  outcome is equal or better (the DB refusal is already pt-BR and names the missing fields), so
  I do not ask for a change here — only that the ADR text stop describing a pre-check.

**Why this is blocking rather than a follow-up.** ADR 0137 opens by calling the MRN work "the
load-bearing half" and grounds the platform's compliance posture on the MRN being present. As
shipped, that guarantee is delivered for **referrals only** (D4, fully reachable). For **cases**
the entire mechanism is dormant, and `PROGRESS.md § Now` records "all 4 increments BUILT" with
nothing saying `required` mode cannot be turned on. The 7,125 green pgTAP assertions exercise
`required` mode by direct `INSERT` as `postgres`; the 1,178 green E2E assertions never touch it.
That is precisely the gap between "tests pass" and "requirement met" that this gate exists for.
`FUP-0137-PHI-MODE-SHIMS` implies the builder has not adopted `patientMode`, but a follow-up
that says "retire the shims later" is not a record that a ratified decision shipped inert.

### D4 — MRN mandatory at SEND — **IMPLEMENTED**, and the floor is in the right place

From `pg_get_functiondef(public.send_referral)`:

- The `HC0T4` refusal sits **after** authority (`HC071`) and state (`HC070`) and after the
  description/item content guard, and **before** the transition. One query covers both failing
  shapes (no `referral_patient` row at all; a row whose `mrn` is null/whitespace, via `btrim`).
- `public.save_referral_patient` is a pure delegation to `public.set_referral_patient`, and
  **neither carries an MRN requirement** — the draft-save path is untouched, exactly as D4
  requires. `referral-patient-fields.tsx` states *when* the requirement bites
  (`Prontuário (obrigatório para enviar)`) instead of using a native `required`, which would
  have broken `Salvar rascunho`. Correct call.
- **`send_referral` is genuinely the sole transition authority**: `app.guard_referral_status`
  (BEFORE UPDATE on `case_referral`) raises `HC070` on any `status` change made outside
  `app.in_referral_rpc`. So unlike the cases module, no table-level twin is needed — and
  `supabase/tests/360` §3.1 pins that with a direct-table `UPDATE`. This is the right shape and
  the right measurement.
- ⚠ **ADR 0137 D4's premise is wrong and the code already knows it.** D4 says *"the existing
  `name OR mrn` floor on `save_referral_patient` is not tightened"*. Measured: **no such DB
  floor exists** — the only body carrying that rule is `app._set_participant_patient_unchecked`,
  which belongs to the **case** module; the referral floor is action-layer only. Both
  `supabase/tests/360` §4 and `src/lib/referrals/messages.ts:119-135` record this correctly.
  The ADR does not. See R-4.

### D5–D7 — the referral wizard — **IMPLEMENTED**, and it closes a gap the ADR left open

- `flush()` (`referral-send-wizard.tsx:633-778`) does create-or-update → **remove stale** →
  add → save PHI → send. Remove-before-add is explicit and commented as load-bearing.
- The D5 specification gap is genuinely closed: on a **resumed** draft the diff is computed
  against server truth re-read via `onLoadDraft`, and `removeReferralSharedItem` gets its first
  real caller. `onLoadDraft` is a **required** prop, and the single host
  (`case-outbound-referrals-card.tsx:235`) passes it.
- Partial-failure policy is implemented as documented: the minted id is committed to state
  *before* any step that can fail, so a retry never re-mints.
- PHI is loaded lazily on reaching the patient step through the **audited**
  `get_referral_patient` door (`goToPatientStep`, `:496-516`), not on card mount — Rule 11
  intact, and the audit records intent rather than a page open.
- D7: on resume both destination controls are replaced by a read-only statement plus the way
  out (`:883-895`); `update_referral_draft` takes no target argument. Matches exactly.
- `Salvar rascunho` renders on all four steps, `disabled={isPending || !detailsComplete}`.

Two robustness defects found here, both non-blocking — R-5 and R-6.

### D8 — attributed work is actionable — **IMPLEMENTED**, structurally

`src/components/cases/assigned-work-access.ts` exports `isAssignedTo` / `canFillAssignedPhase`,
and **the signature cannot express a capability argument**. That is a real structural guard, not
a comment: `narrowToReadingSurface` does not read `viewerId` (grep: zero hits), so the affordance
survives on `/casos`. E2E covers all three viewer classes the ADR names (`D8-1` staff_admin,
`D8-2` administrativo, `D8-3` plain member) plus `D8-4` "no competing primary on the manage host".
`StartPhaseButton` navigates to `/o/{org}/c/{slug}/cases/{caseId}/phase/…/responder/{id}`, a route
whose page guard is `access.role === null → notFound()` (not staff_admin-gated) — so the
affordance leads somewhere the plain-member assignee can actually reach. Verified because an
affordance offered to a viewer who cannot reach its destination would be worse than none.

### D9 — field removals — **IMPLEMENTED**

The important part is the hazard the build caught: `updateCaseMeta` **full-replaces** label +
department, so deleting the input alone would have silently cleared a stored department on every
unrelated label edit, with nothing in the eight gates able to see it. The hidden mirrors at
`edit-case-meta-dialog.tsx:162-171` cover **both** fields and **both** arms (managed id /
`department_other` free text) and round-trip an absent department correctly. `e2e/hospital-
departments.spec.ts:345` pins it. The bulk-wizard age removal is done at the **offer**
(`bulk-step-process.tsx:24-41`), not by dropping the grid cell — the correct mechanism; the
wrong file (`case-bulk-grid.tsx`) is not in the diff at all. `PatientFields` call sites verified
one by one: the two case surfaces and the patient-edit dialog pass `hideUnit`/`hideAge`; the
safety event form passes neither; the referral flow uses a separate component that keeps `Idade`.
No backend change (`department_id`, `department_other`, `age_years` and every RPC argument
untouched).

### D10 — the rename — **IMPLEMENTED**, two-sided keystone verified from the catalog

This is the plan's own highest-risk item, so I measured it rather than reading the test:

- **Zero** live bodies in `app` + `public` reference `\mtype_label\M` as a `case_narratives`
  column. The only three that reference it at all are `public.create_referral_draft` (1),
  `public.get_referral_detail` (2), `public.update_referral_draft` (1) — the `case_referral`
  column, correctly untouched.
- **Six** bodies reference `display_label`: `app.trg_audit_case_narratives`,
  `public.add_ad_hoc_narrative`, `public.add_referral_shared_item`,
  `public.create_case_from_template`, `public.get_case_detail`, `public.list_my_cases` — exactly
  the re-emission set the plan corrected to.
- Not over-renamed: `public.add_ad_hoc_narrative`'s parameter is still `p_new_type_label`, and
  `case_referral.type_label` still exists. The CHECK renamed cleanly to
  `case_narratives_display_label_not_blank`.
- `public.clone_template_version` (the `prosecdef = f` body the plan flagged as the one that
  would have shipped a live defect) clones `patient_mode` **and** `patient_required_fields`
  together — Architecture Rule 5's clone mechanism intact.

### D11–D14

- **D11**: `case_narratives.assignment_role_id` exists; `public.set_case_narrative_assignment_role`
  is a faithful twin of the phase door — same `assert_ethics_coordinator` authority, same
  `HC0J1`/`HC0J0`, correctly opening `app.in_narrative_rpc` (not `in_case_rpc`) because it writes
  a different table behind a different guard. `REVOKE`-then-`GRANT` honoured (`proacl` =
  `{postgres,service_role,authenticated}`, no `PUBLIC`). Data model only, no UI — as decided.
- **D12**: chrome, six manual kinds (not the handoff's four), client-side `kind` partition with
  `listCaseEvents` still unfiltered, `AnyCaseEventKind` widening with `EVENT_KIND_LABEL` and
  `KIND_VISUAL` both genuinely exhaustive `Record<AnyCaseEventKind, …>` (16 keys, matching
  `case_events_kind_check` byte-for-byte), `coordinator_only` badge byte-identical, semantic
  Tailwind tokens (no raw `oklch`, no bare `[--var]`), motion via `RiseInGroup` → GSAP tokens
  with a reduced-motion bail. One latent defect: R-7.
- **D13**: titled `Trabalho do processo` shell, single bordered footer, **no** progress meter and
  **no** status bar. Correct.
- **D14**: `editable={isDraft}`; the read-only branch is a `<dl>`, not a disabled `<select>`.
  Its justification is false — R-3.

---

## 2. Security / RLS — from the catalog

**No widening found.** Concretely:

- **Zero RLS policies created or altered** by this batch. The diff-scoped door sweep was
  legitimately a *measured empty domain*, and the record says so correctly.
- The three Class-1 PHI tables are unchanged and still fully locked:
  `relacl = {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` for
  `patient_identifiers`, `patient_participants`, `referral_patient` **and** `event_patient`;
  `relrowsecurity = t`; `role_table_grants` for `authenticated` on all four returns **zero rows**.
  Independently reproduced during a probe: `authenticated` gets `permission denied for table
  referral_patient` on a direct `SELECT`.
- Rule 12's perimeter is unchanged — still exactly three patient-PHI modules, same isolation,
  same audited doors. The batch adds **configuration** columns (`patient_mode`,
  `patient_required_fields`) to `cases` / `process_template_versions`; neither is PHI.
- The case module's "one writer body, TWO gates" shape is preserved: the D3 refusal is in the
  **shared** `_unchecked` body, so the coordinator door and the creation path inherit it
  identically. Putting it in `set_case_patient` would have left `set_participant_patient`
  unguarded; that was avoided.
- **No PHI reaches an error message.** `app.assert_patient_required_fields` emits pt-BR field
  *labels* only (`nome, prontuário, data de nascimento…`), never values. Checked deliberately —
  a refusal that named the value would have been a Rule 12 leak in a compliance feature.
- `app.guard_case_patient_required` is `SECURITY DEFINER` and reads `patient_identifiers`,
  bypassing RLS. Bounded and safe: it joins only on `cp.case_id = new.id`, a case the caller is
  creating in the same transaction, and returns nothing but a field-name list. Not an oracle.
- All 14 re-emitted/new bodies retain `auth.uid()` and their guard calls where they had them;
  the two with zero guard references are `app.trg_audit_*` audit triggers, which is correct.
- `app._set_participant_patient_unchecked` is `prosecdef = f` with `proacl = {postgres=X}` — no
  `authenticated` EXECUTE. Its documented "no authority check by design" posture is intact and
  its caller set is still exactly four. See R-8 for the coverage bookkeeping.

**Independently re-verified: `BUG-CASEEVT-KIND-001` is accurately described.** From `pg_policy`:
`case_events_writer_update` / `…_staff_admin_update` carry `app.is_manual_case_event_kind(kind)`
in `WITH CHECK` **only**; both DELETE policies carry no kind gate; zero non-internal triggers on
`case_events`. Its bound ("requires `can_write_case_content` on that case — in-case integrity,
not tenant isolation") is correct. **One axis the entry does not name**, offered as an addendum:
`case_events_writer_delete`'s `USING` is `can_write_case_content(case_id, auth.uid())` **alone**
— no `visibility` conjunct — so a plain case writer can DELETE a `coordinator_only` row they
cannot SELECT. Same root cause (`USING` under-constrained relative to `WITH CHECK`), same
pre-existing status, not caused by D12.

---

## 3. Code quality

**Clean.** Swept the whole `src/` diff (33 modified + 3 new files):

- **TypeScript strict** — **zero** `any` added in any form; no `@ts-ignore`/`@ts-expect-error`;
  no added non-null assertions. The two added type assertions are in
  `src/components/ui/dropdown-menu.tsx:39` and `:76`, both with inline justification.
- **Rule 9** — zero `supabase` references added under `src/components/**` or `src/app/**`. The
  one added supabase-js call is `src/lib/cases/actions.ts:1102` (`set_template_patient_mode`), a
  server action, which is allowed.
- **Rule 8** — no new generated-type imports from outside `src/lib/types/`.
- **Rule 10** — every new user-visible string is pt-BR; all added English is comments/identifiers.
- **Rule 7** — no `dangerouslySetInnerHTML`, `innerHTML`, `srcDoc` or any raw-HTML sink added;
  no new or changed markdown render site. `ev.body` / `ev.title` in the redesigned card render
  as plain React children (`whitespace-pre-wrap`), which React escapes.
- No `console.*`, `debugger`, `TODO` or `FIXME` added.
- Raw Postgres errors: the seven added `error.message || MESSAGES.x` lines are all keyed on
  **authored** `HC0T*` SQLSTATEs whose DB messages are pt-BR — the correct pattern.
  ⚠ Pre-existing, not a diff violation, but now carrying new traffic: `mapCasePatientError`'s
  catch-all `if (error.message) return error.message` (`src/lib/cases/actions.ts:995`) still lets
  an *unmapped* Postgres error (`23502`, `22P02`) reach the UI in English. The diff's own comment
  acknowledges it and mitigates by naming the three new codes ahead of the fallback.

### `src/components/ui/dropdown-menu.tsx` — the widest blast radius, and it is safe

16 consumer files including the app-shell user menu and every switcher. Audited specifically:

- **No-op on working paths.** The rAF callback returns early if `document.activeElement !==
  content` — i.e. whenever Radix's own hand-off succeeded, which is every production path (the
  comment states the race is `next dev`-only). It also returns early if the content is not
  `:focus-visible`, so a pointer-driven open is untouched.
- **`event.currentTarget` is captured synchronously**, before the rAF. This is a native
  `Event`, whose `currentTarget` is nulled after dispatch — reading it inside the rAF would have
  been a live bug. They got it right.
- **No existing consumer is affected.** `onOpenAutoFocus` was absent from the public Radix type,
  so nothing could pass it; grep confirms all five existing `onOpenAutoFocus` call sites are on
  `DialogContent`, not `DropdownMenuContent`. A caller that *does* pass one has it invoked first
  and `event.defaultPrevented` respected, so the standard `preventDefault()` opt-out still wins.
  `onOpenAutoFocus` is destructured out, so `{...props}` (rendered last) cannot override it.
- **Accessibility: no weakening found.** `:not([data-disabled])` is the correct Radix attribute.
  ⚠ One forward risk, not a defect today: the selector is `[role="menuitem"]`, which does not
  match `menuitemcheckbox` / `menuitemradio`. The app has **zero** checkbox/radio menu items and
  zero submenus today (measured), so it is exhaustive — but the first menu whose leading item is
  a checkbox item would get focus pushed **past** it onto a lower plain item. `[role^="menuitem"]`
  would make the selector match the property rather than one syntax.
- ⚠ **It is not covered by the gate that declared it green.** The workaround only fires under
  `next dev`; the `e2e:prod` run that produced 1,178 passes exercises the production build, where
  guard #1 short-circuits. "Zero assertion failures" is therefore not evidence about this change.
  That is not an objection to shipping it as its own `fix(ui):` commit — it is the honest bound.

### `BUG-E2E-CORRECTIONS-KBD-FOCUS` — the attribution reasoning holds

Sanity-checked and I agree with it, including its refusal to close. ADR 0137 is ruled out *by
mechanism*: the D8 insert is a sibling of the coordinator cluster, rendered **outside**
`DropdownMenuContent` (`case-phase-article.tsx:262-271`), so it cannot alter focus order inside
the menu. The entry's own caution — that "it passed before" is unavailable because commit
`36a18c88` is titled *"stop the gate false-greening"* — is the right posture, and leaving
attribution open in both directions rather than picking is correct. Note the dropdown fix in
this same tree targets exactly this symptom, which makes the two easy to conflate at Record time;
keep them distinguishable.

---

## 4. Required changes

**C-1 (blocking) — `required` mode is unreachable from the product; D2's UI requirement is
unbuilt.** Evidence in § D1–D3. Either build the builder-side picker (three-mode selector +
required-field set, with `mrn` rendered selected and non-interactive per D2, and
`create-case-dialog` marking those inputs required per D3 layer 3), **or** obtain an explicit PO
ruling that the UI half is deferred — in which case the record must state, in `PROGRESS.md § Now`
and in the ledger row, that **`patient_mode = 'required'` cannot be set from the product and the
case-side MRN guarantee is not yet in effect**. What must not happen is D1–D3 being recorded as
built with nothing saying the mechanism is dormant. Also update
`create-case-dialog.tsx:57-62`, whose docblock still describes the PHI block as *optional* and
names the dropped column `cases.patient_enabled`.

**C-2 (required, one line) — `event_patient` is missing from the PHI lockdown assertion.**
`supabase/tests/359_patient_mode_and_narrative_rename.sql:178-183` asserts zero
INSERT/UPDATE/DELETE grants for `authenticated`/`anon` on `patient_identifiers`,
`patient_participants`, `referral_patient` — but the section header claims all four stores were
measured. Nothing else in the suite pins write privileges on `event_patient`
(`171_cross_org_isolation.sql` proves SELECT only; `191_grant_hardening.sql` covers other
tables), so a future migration granting `authenticated` INSERT on `event_patient` reds **nothing**.
Add it to the `table_name in (...)` list. This is the one assertion in the batch whose whole
purpose is to catch a re-grant, in a batch whose subject is PHI.

**C-3 (required, one assertion) — the immutability guard is half-pinned.**
`app.guard_case_patient_mode_immutable` fires on `patient_mode IS DISTINCT FROM … OR
patient_required_fields IS DISTINCT FROM …`, but `359` §7.1 updates **both columns in one
statement**, so the `patient_mode` arm alone satisfies it. Deleting the second `OR` arm — or
narrowing the trigger to `before update of patient_mode` — stays GREEN. Add a `throws_ok` that
updates `patient_required_fields` alone. This matters because that guard is what closes D3's
"insert a `none` case, then UPDATE it to `required`" hole; half of it is currently unfalsifiable.

**C-4 (required, documentation) — ADR 0137 D14's ratified premise is false, and it is mirrored
into two source comments.** D14 states *"ADR 0064 contains **no numbered decisions at all**"*.
Measured: `docs/decisions/0064-*.md` carries `### Decision 1` … `### Decision 4`, and Decision 4
is *"Dedicated `case_types` table (config layer)"* (`:145`). The **conclusion** appears to
survive — Decision 4 defines the table and says nothing about when the picker is editable, so the
draft-gating rule did live only in a comment — but it now rests on a different premise than the
one written. Correct the ADR and the two comments that repeat it
(`template-builder-shell.tsx:352`, `case-type-picker.tsx:27-28`). Note the same file still cites
`ADR 0064 D4` at `:186` for the case-types table, which is a *correct* citation and should stay.

---

## 5. Open risks — for the PO to weigh

**R-1 — the MRN is guaranteed at the send *instant* only; it can be blanked afterwards.**
Derived from the live definitions, not driven (see "could not verify" below).
`public.set_referral_patient` blocks amendment only for status ∈ `{completed, rejected,
withdrawn}`; `sent` is amendable by `app.can_amend_referral_phi_snapshot` = the source
coordinator — the same person who sent it. The write is
`on conflict (referral_id) do update set … mrn = excluded.mrn`, and `p_mrn` defaults to `NULL`.
So `save_referral_patient(id, 'Nome')` on a sent referral nulls the erasure key. The cases module
closed the structurally identical "legal insert → illegal update" hole with
`guard_case_patient_mode_immutable`; the referral analogue is open. ADR 0137's compliance claim
is that the MRN *is present*, not that it was present once.
*What would settle it:* a pgTAP arm under `test_helpers.claims_for` driving
`save_referral_patient` with a null MRN against a `sent` referral. My own probe could not reach
it — under `set local role authenticated` with hand-set JWT claims,
`app.can_manage_referral_source` returned false where it returns true as `postgres`, so the
fixture could not construct the state. **Reported as reasoned-from-definition, not as measured.**

**R-2 — the flush's staleness refresh fails OPEN, and the docblock says the opposite.**
`referral-send-wizard.tsx:692-703`: `const fresh = await onLoadDraft(id); if (fresh) { … }`.
When the refresh returns `null` the flush proceeds against the **stale** frozen map instead of
refusing. The docblock immediately above (`:620-627`) states the fail-closed branch "is gone"
because `onLoadDraft` became required, and that the governing principle — *refuse rather than
ship more than the screen shows* — must be preserved. This branch is that principle, silently
inverted. It matters because the ADD step never records new shared-item ids into `frozenItems`,
so the re-read is the **only** thing preventing duplicate adds on a retry — and a retry is now a
common path, since a send refused by the new `HC0T4` guard leaves the dialog open. One-line fix:
`if (!fresh) { setError(REFERRAL_MESSAGES.generic); return; }`.

**R-3 — a swallowed PHI load turns into a silent PHI overwrite.**
`goToPatientStep` sets `resumePatientLoaded = true` **before** the await and swallows any failure
(`:502-515`, `catch {}`), so one transient failure means the saved PHI never loads for the rest
of the session. If the coordinator then types anything, `flush` calls `setReferralPatient`, whose
`ON CONFLICT DO UPDATE` replaces every column — blanking the stored `mrn`, `name`,
`date_of_birth`. This is the same full-replace shape the team correctly caught for departments in
D9-bis (§1b-bis), on a PHI field. Bounded: confined to a draft, and D4's send gate catches the
MRN case. The plan's own note that a swallow can convert a broken setup path into a silent
outcome applies here verbatim.

**R-4 — three ADR amendments the plan itself mandated are still pending.** They are scheduled for
Record (step 5), so they are not overdue — but they are preconditions for it, and each is the
kind of record that goes stale silently:
1. **D3's enforcement point.** The ADR says the refusal lives in the minting DEFINERs "and the
   one that writes PHI (`set_case_patient`)". As built it is in
   `app._set_participant_patient_unchecked` + a deferred constraint trigger, and layer 2 is error
   mapping rather than a pre-check.
2. **The creation-time-only invariant** (plan §0a-bis): the required-field rule binds at INSERT,
   not for the case's lifetime; a disposed `required`-mode case legitimately ends up missing
   fields, because erasure must win over a collection rule. Unrecorded, this reads as a hole.
3. **D5's mechanism inversion** (plan §2a): D5 says the un-pick defect dies *because the flush
   only ever ADDs*; it actually dies because the flush **does** remove and checks the result.
   The two imply **opposite** maintenance rules — under D5-as-written, adding a removal call
   violates the decision; under what shipped, deleting it reintroduces the defect. Also record
   that remove-before-add ordering is load-bearing.
4. **D4's non-existent floor**: *"the existing `name OR mrn` floor on `save_referral_patient`"*
   describes a DB guard that does not exist. `supabase/tests/360` §4 and
   `src/lib/referrals/messages.ts` already carry the correction; the ADR should too.

**R-5 — test-quality weaknesses beyond C-2/C-3** (from a line-by-line adversarial read of `359`
and `361`; plans and assertion counts match, no savepoints, so nothing is discarded):
- `359` §8.1's "zero bodies still reference `type_label`" is a **hard-coded six-name list** with
  `count = 0` — trivially satisfied by a typo or a later rename, and strictly weaker than the
  migration's own catalog-derived precheck. §8.2 (`= 3`) is the right shape. I ran the
  catalog-derived version myself and the state is correct; the *guard* against future drift is
  what is weak. Given this is the plan's own Risks §1, worth strengthening.
- `361` §4's four assertions test a **reproduction** of the migration's `$precheck$` block, not
  the block itself — deleting the block from `20261003001400` leaves them green, while their
  descriptions claim the precheck "aborts the migration". The file header admits the
  reproduction; the four descriptions do not.
- The minting doors' own D3 check has **no negative arm** — removing
  `assert_patient_required_fields` from `create_case_from_template` / `bulk_create_cases` leaves
  everything green. Lower severity than it looks: the deferred trigger still enforces the
  invariant, so only the friendlier error ordering is lost.
- Smaller: `359` §2.5 uses `col_has_check` without binding the predicate; §9.4 claims the door
  "mirrors the phase twin" without ever calling the twin; §9.5's cross-org arm uses a random UUID
  rather than a real role from another org; §8.8 runs against a case with zero narratives;
  `361` §0.2 and §1.6 are tautologies.

**R-6 — `KIND_VISUAL[ev.kind]` has no runtime fallback, and its comment over-claims.**
`case-events-timeline.tsx:59-60` says exhaustiveness "by TYPE" means widening
`case_events_kind_check` "cannot land without a visual". Widening the SQL CHECK touches no
TypeScript: `tsc` stays green, `.returns<CaseEventRow[]>()` asserts the row into the stale union,
and `:386`'s destructure of `KIND_VISUAL[ev.kind]` **throws**, taking the whole card down. The
DB CHECK and the TS union agree today (16 = 16, verified), so this is latent. A `?? { Icon:
MoreHorizontal, tint: … }` and a reworded comment would make the guarantee real.

**R-7 — accessibility, minor.** `case-events-timeline.tsx:312-329`: the body-error
`<span role="alert">` is a **child of the wrapping `<label>`**, so on validation failure the
textarea's accessible name mutates from `Descrição do registro` to that plus the error text.
`aria-invalid` is set but nothing is linked by `aria-describedby`. The house pattern
(`useFieldIds` + `FieldError`, `src/components/ui/field.tsx:201-207`) is already used one file
over in `case-type-picker.tsx:65`. Everything else in the new UI is clean: real buttons,
`aria-pressed` filter pills in a named `role="group"`, a native radio `fieldset`/`legend`
composer, real labels (not placeholders), all icon-only controls named, count badge
`aria-hidden` so the landmark name stays stable.

**R-8 — the batch's primary new case-side gate carries no arm's verdict.**
`ARM=census` printed, as a note: `app._set_participant_patient_unchecked(…)` is a backlog entry
"with no matching live gate (renamed/dropped — prune)". Established: the backlog file is
**untouched by this batch** and the orphan is a pre-existing signature-format mismatch (identity
args vs rendered defaults), so **this batch did not cause it**. But it is materially relevant
here: that function is `prosecdef = f`, non-boolean, in `app` — so it is **outside** the domain
of `census`, `policy`, `floor` and `hat` (all bounded by `prosecdef`) and is not a `public`
INVOKER wrapper, so outside `wrapper` too. "`ARM=census` HOLDS" is true and is **not evidence
about this door**. Its real coverage is `supabase/tests/357`'s targeted mutation twins — whose
recorded results (`PHI write reverted → 11 RED`, `wrapper gate removed → 4 RED`, …) were taken
on the **pre-0137 body**, and this batch re-emitted that body to add the D3 refusal. The twins
were not re-run. Recommend: re-run `357`'s mutation twins against the new body, and prune/repair
the orphaned backlog entry so the recorded coverage can be connected to the live function.

**R-9 — the compensating evidence for the empty door sweep is not reproducible.** The gate record
states "all 18 re-emitted bodies still hold their authz guards (**2–7 refs each, none zeroed**)".
Counting `app.can_*` / `app.is_*` / `app.assert_*` references per body gives a range of **0–6**:
the two audit triggers have **0** (correct — they are triggers, not doors) and
`public.clone_template_version` has **1** (`assert_cases_enabled`, a feature flag, not authz —
its authority is the RLS-gated INSERT, which is correct for an INVOKER function). No defect is
implied. But because the diff-scoped sweep was legitimately empty, *this count is the
compensating evidence*, and a count quoted without a named method cannot be re-derived. Restate
it with the method, or drop the numeric range and state the property instead.

**R-10 — hygiene, for the Record step:**
- **`PROGRESS.md` is 81,147 bytes against `SIZE_CAP = 80 * 1024 = 81,920` — 773 bytes of
  headroom.** (The plan's "80,000 hard fail" figure treats KB as 1000; the script is the
  authority.) `lint:progress` passes **now**, but the Record edit adds a ledger row and a QA
  verdict row. The Case-Surface-Split compaction the plan identified must happen *before* or *in*
  that edit, not after.
- **The Test Run Summary table still holds only the two AFF2 rows.** The 0137 gate step 1 and
  step 2 results live in § Now but not in the table whose stated retention is "the most recent
  gate only", so the table currently names a superseded gate as the most recent.
- The working tree carries an out-of-batch documentation change,
  `docs/decisions/0136-*.md` (+102 lines: the D7 settlement and the Size-table re-derivation).
  Documentation only — no 0136 build — consistent with "sequenced after"; split it out at commit
  time so the batch commit does not read as including 0136 work.
- Untracked `docs/design/temp/action_item_design/` is sitting in the tree at gate time. Decide
  whether it is committed or ignored.
- **The `.catch(() => null)` swallow class was not swept.** The plan called for auditing the
  shape across 16 occurrences / 13 `e2e/` files. Census now: **16 occurrences across 12 files** —
  one file's instance was fixed reactively (`BUG-E2E-CP-HELPER-COLLECTSPATIENT`), and
  `FUP-E2E-CREATEFRESHCASE-SILENT-NULL` names a second confirmed instance of the harmful shape.
  The remaining 15 are unaudited. `lint:vacuous` cannot see them (the vacuity is inside a helper
  it does not trace into), so nothing will raise this again except the follow-up line.
- `create-case-dialog.tsx:90` keeps the `patientUnit` hidden mirror while deleting the
  `patientAgeYears` one. No functional effect (`hideUnit` guarantees it is empty); asymmetric.
- **`BUG-CASEEVT-KIND-001` stays open and D12's UI suppression is currently its only control** —
  a Rule 1 exception, self-declared in the component. Correct not to fix it here (two RLS policy
  changes owe their own keystone and diff-scoped sweep), but it should be sequenced deliberately
  rather than drifting. Consider adding the `USING`-vs-visibility axis noted in §2.

---

## 6. Could not verify

Stated rather than passed over silently:

1. **R-1's post-send MRN blanking** — reasoned from the live function definitions; I could not
   drive a live fixture, because `test_helpers` does not exist outside the pgTAP harness and a
   hand-set JWT claim did not satisfy `app.can_manage_referral_source`. Settled by a pgTAP arm
   under `test_helpers.claims_for`.
2. **`npm run typecheck` and the vitest suite** — accepted on the lead's report; not re-run.
3. **The full `e2e:prod` gate** — the lead's; not re-run. Its "zero assertion failures" is not
   evidence about the `dropdown-menu.tsx` change, which only fires under `next dev`.
4. **Whether the D9 department hidden-mirror's archived-department edge is acceptable** — a
   product question, not a code one: `update_case_meta` re-validates through
   `app.department_belongs_to_commission`, which requires `archived = false`. If a case's stored
   department is later archived, every *label* edit fails with `HC030` and the coordinator now
   has no control with which to change it. Behaviour is identical to before for the stale-id
   resubmit, but the recovery path (pick a different department) is gone. Worth a PO ruling.

---

## Verdict

The engineering in this batch is of high quality. The DB layer of D1–D3 is the best-designed
piece of it — the shared predicate, the `sex` sentinel, the deferred trigger with the immutability
sibling, and the refusal that names field labels and never values. D4–D14 are implemented as
decided, D5 is implemented *better* than decided, D8's structural guard is the right pattern, and
D10's two-sided rename verifies clean against the live catalog. Rules 7, 8, 9, 10 and TypeScript
strict are clean across the whole diff. No access-control widening was found; the PHI perimeter
is intact.

The blocker is not a defect in what was built — it is that **D2's UI requirement was not built,
and as a result the case-side half of the batch's load-bearing compliance decision cannot be
turned on by any user**, while the record says all four increments are built. C-2 and C-3 are
one-line test gaps in exactly the two assertions whose purpose is to catch a future regression of
this feature, and C-4 is a false premise now sitting in ratified ADR text.

**CHANGES REQUESTED**

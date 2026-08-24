# Plan — Case & Referral usability batch (ADR 0137)

**Status:** ✅ **APPROVED — build STARTED 2026-08-23** (PO: "proceed with implementation").
⚠ Approval scope, recorded because scope is the thing that gets remembered and never written down:
the PO approved **implementing ADR 0137 D1–D14 per this plan**, and separately ruled that **ADR 0136 is
sequenced after, not folded in** (§ "Out of scope"). It is **not** approval to merge, to push, or to skip
the end-of-batch Phase Gate.
**Decisions:** ADR [0137](../decisions/0137-mrn-erasure-key-and-case-referral-usability-batch.md)
(D1–D14, all PO-ruled 2026-08-23). This plan implements them; it does not re-open them.
**Gate posture (PO ruling):** cheap gates per increment; the **full Phase Gate once, at the end**.

---

## 0. Shape of the work

Four increments, in this order. Increment 0 is the only one with a migration, so it is also the
only one that must be pushed schema-first.

| Inc | Title | ADR | Migration | Depends on |
|-----|-------|-----|-----------|------------|
| 0 | Schema: PHI mode, narrative rename, assignment role | D1–D3, D10, D11 | **yes ×2** | — |
| 1 | Case & Process quick wins | D8, D9, D13, D14 | no | — (parallel with 0) |
| 2 | Referral wizard rewrite + MRN | D4–D7 | **yes** (send guard) | 0 (types) |
| 3 | `Atividade` card redesign | D12 | no | — |

Increment 1 and 3 touch no schema, so they may run in parallel with Increment 0. Increment 2 must follow
0 because it consumes regenerated types.

⛔ **CORRECTED 2026-08-23 — the original claim here was "Increment 1 and 3 touch no FILE Increment 0
touches", and it was FALSE.** It contradicted §0c step 15, which assigned two `src/components/**` files
to Inc 0's TS side; Inc 1a edits one of them. The collision was live before it was noticed. **Parallel-safe
means no shared file, and that is guaranteed by the directory boundary, not by this sentence:**
`backend` = `supabase/**` + `src/lib/**`, `frontend` = `src/components/**` + `src/app/**`. A rename that
crosses layers is swept by **each owner in their own tree** — it does not transfer ownership.
⚠ Consequence to expect rather than debug: while a cross-layer rename is half-landed **the tree is RED**,
and neither owner may declare green alone.

⚠ **File-ownership (CLAUDE.md §4) collision to serialize:** `src/lib/cases/actions.ts` is edited by
Inc 0 (PHI-mode messages + floors) and read by Inc 1. Inc 1 must not edit it.

### Out of scope — ADR 0136 (deferred `staff_admin` sign-off)

⛔ **ADR [0136](../decisions/0136-deferred-staff-admin-signoff-attests-frozen-content.md) is NOT part of
this batch** (PO ruling 2026-08-23). It is sequenced **after**, with its own plan. Its formerly-open
decline-path question was settled the same day as **shape (a) — the correction/supersession machinery**
(ADR 0136 § D7), so it is now plannable; it is simply not planned *here*.

The reasons are measured, and they are the same reasons that make the sequencing safe rather than merely
tidy:

1. **Body-level collision.** 0136 adds a `case_phases.status` value (`awaiting_signoff`). Two of the
   **seven** bodies this batch re-emits for D10 also branch on phase status:
   `public.get_case_detail` (`cp.status = 'completed'`) and `public.list_my_cases`
   (`'actionable', (cp.status = 'active')`). Re-emitting the same body from two migrations in one batch
   compounds the risk §Risks-1 already calls the highest in this plan — and `list_my_cases` would
   silently report an awaiting-signature phase as `actionable = false`.
2. **Component collision.** Inc 1a edits `case-phase-article.tsx` and `case-phase-list.tsx`; 0136 must
   widen the same phase-status branches. CLAUDE.md §4 file-ownership is binding — these serialize.
3. **Gate-posture collision.** 0136 widens `app.can_sign_section`, which is the `WITH CHECK` of the
   `signoffs_insert` policy — a **live authorization change** needing its own keystone and diff-scoped
   door sweep. This batch's agreed posture is one full Phase Gate at the very end; folding an authz
   widening into it buries the one change that most deserves an isolated gate.
4. **Unattributable reds.** 0136's own ADR says its test surface dominates (`80_signoffs.sql`'s central
   assertions *invert* for the `staff_admin` arm; `phase6-signoffs.spec.ts` is 670 lines). Inc 1 and Inc 3
   here already rename or remove several accessible names. Combined, "mine or pre-existing?" stops being
   answerable without re-running alone.

⚠ **One cross-batch note for whoever plans 0136:** adding a 6th member to `CasePhaseStatus` is **mostly a
silent change** — only 3 files / 4 sites fail typecheck. The measured surface is corrected in ADR 0136's
Size table; read that correction, not the original row.

---

## Increment 0 — Schema

### 0a. Process PHI collection mode (D1–D3)

**Migration A — additive + backfill.**
1. `process_template_versions`: add `patient_mode text not null default 'none'` with
   `check (patient_mode in ('none','optional','required'))`, and
   `patient_required_fields text[] not null default '{}'`.
2. `cases`: add the same two columns (the snapshot).
3. Backfill, in one statement per table: `patient_mode = case when collects_patient then 'optional'
   else 'none' end` (templates) and the same off `patient_enabled` (cases).
   ⛔ **Never `required`** — ADR 0137 D1.
4. Constraint tying the two together: `check (patient_mode <> 'required' or 'mrn' = any(patient_required_fields))`,
   plus a domain check that every element is in the allowed set
   (`name`, `mrn`, `date_of_birth`, `sex`, `encounter_ref`, `attending`).
   ⚠ `age_years` and `unit` are **excluded by the constraint**, not merely absent from the picker —
   D2 and D9 must not be able to drift apart.
5. ⛔ **Any `set local` in this migration must be inside an explicit transaction** — a top-level
   `set local` is a silent no-op (`25P01`) and `lint:set-local` grandfathers only the 12
   pre-existing files. **Do not bump the watermark.**

**Migration B — RPC re-emission and boolean retirement.**

⛔ **The re-emission set below REPLACES an earlier hand-list of five. Re-measured from the live catalog
2026-08-23** (comment-stripped, `\m…\M` word-boundary — the naive regex false-positives on
`assert_case_patient_enabled` and `case_patient_enabled`, whose **names** contain the column name).
**Seven bodies genuinely reference the two retiring booleans:**

| routine | `prosecdef` | references | in the old hand-list? |
|---|---|---|---|
| `public.set_template_collects_patient` | `t` | `collects_patient` | ✅ |
| `public.create_case_from_template` | `t` | **both** | ✅ |
| `public.create_case` | `t` | `patient_enabled` | ✅ |
| `public.clone_template_version` | **`f`** | `collects_patient` | ⛔ **MISSED** |
| `app.trg_audit_template_versions` | `t` | `collects_patient` | ⛔ **MISSED** |
| `app._set_participant_patient_unchecked` | **`f`** | `patient_enabled` | ⛔ **MISSED** |
| `public.get_case_detail` | `t` | `patient_enabled` | ⛔ **MISSED** |

⭐ **`public.clone_template_version` is the one that would have shipped a live defect.** It copies
`collects_patient` in **both** the column list and the `select` (`s.collects_patient`). Dropping the
column breaks cloning a published version to a new draft — **Architecture Rule 5's core mechanism** — and
it breaks at *runtime*, not at migration time. `app.trg_audit_template_versions` is the Rule 11 audit
trigger: if it references a dropped column, **every** template-version write fails.
⚠ `public.bulk_create_cases` matched the naive regex **in a comment only**. It still needs editing — it
mints cases and must snapshot the new columns — but not for the reason the old list implied.

6. Re-emit all seven above **from `pg_get_functiondef` on the live catalog, never from migration text**,
   plus `public.bulk_create_cases` (snapshot). Replace `set_template_collects_patient` with
   `set_template_patient_mode(p_version, p_mode, p_required_fields)`.
   ⚠ Two of the seven are `prosecdef = f` (`clone_template_version`,
   `_set_participant_patient_unchecked`) — that is `ARM=wrapper`'s domain; note them in the gate record.

7. Refusals take a dedicated SQLSTATE per ADR 0135 — **not** a reused `23514`. ⚠ Note `send_referral`
   already raises `check_violation` for its description/item guard; do **not** copy that pattern.

8. ⭐ **D3's PHI-write enforcement point is `app._set_participant_patient_unchecked`, NOT
   `set_case_patient`.** Measured: `public.set_case_patient` is a **compat door** that resolves the case's
   single existing patient participant and delegates to `public.set_participant_patient`, which delegates
   to `app._set_participant_patient_unchecked` — where the `patient_enabled` check actually lives. Putting
   the required-field refusal in `set_case_patient` would leave the **E1 multi-patient path
   (`set_participant_patient`) completely unguarded**, which is the CLAUDE.md Rule 12 "one writer body
   with TWO gates" shape failing open. Put the refusal in the shared `_unchecked` body so both doors
   inherit it, and pgTAP **both** doors — a test that only drives `set_case_patient` passes while the
   real hole stays open.

8b. ⛔ **The old step 8's premise is FALSE as measured — do not write the test it asked for.** It claimed
   "the RPC gate is bypassable if `patient_identifiers` accepts broad `authenticated` DML". Raw ACLs
   (`pg_class.relacl`, not `information_schema`) for `patient_identifiers`, `patient_participants`,
   `referral_patient` and `event_patient` are all
   `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — **nothing is granted to
   `authenticated`**, `relrowsecurity = t`, and `patient_identifiers` has **zero** policies. Direct DML by
   an authenticated principal is unreachable. A "direct-table exploit" pgTAP test would therefore **pass
   having proven nothing** — the fixture cannot reach the failing state.
   ✅ **What to do instead:** keep a table-level guard trigger as defence-in-depth (it costs little and
   `service_role` *does* retain full DML), but **assert the lockdown itself** — pgTAP that `authenticated`
   holds no INSERT/UPDATE privilege on the three PHI tables. That assertion can actually fail, and it is
   the one that would catch a future migration re-granting the table.

9. Drop `collects_patient` / `patient_enabled` **only after** 6–8 land, and only once **zero** live
   function bodies reference them — verify in the catalog with the comment-stripped, word-boundary query,
   not by re-reading this list.

#### 0a-bis — How the `required` invariant is actually enforced (design ruling, lead + backend 2026-08-23)

⭐ **A DEFERRED CONSTRAINT TRIGGER on `cases` (AFTER INSERT, `DEFERRABLE INITIALLY DEFERRED`) carries the
invariant — not argument checks in the minting RPCs alone.** This is **not** defence-in-depth; the RPC-only
shape leaves a reachable hole. Measured from the catalog:
`cases` grants `authenticated` `arwdm`, `cases_staff_admin_write` is `polcmd = '*'` (**FOR ALL**, same
expression in `USING` and `WITH CHECK`), and **`app.guard_case_status` has DELETE and UPDATE arms but no
INSERT arm** — so a `staff_admin` can insert a case directly over PostgREST. That is the BUG-SUP-002 shape
ADR 0137 D3 cites, and unlike the struck step-8 test, this gate can be driven RED by a real fixture.
Deferred because `bulk_create_cases` must create the case **before** writing PHI (see below).

⛔ **The trigger is INSERT-only, and that leaves a sibling path that MUST be closed separately.** An
UPDATE arm would break `dispose_case_phi`, so instead: **`cases.patient_mode` and
`cases.patient_required_fields` are IMMUTABLE after INSERT.** Without it, a `staff_admin` inserts a
`none`-mode case (legal, trigger passes) and then UPDATEs it to `required` — a `required`-mode case with no
PHI, exactly the state D1–D3 forbid, with no trigger firing.
✅ **Verified safe before prescribing:** `dispose_case_phi`'s terminal write is
`update public.cases set has_patient = false, phi_disposed_at = …, phi_disposed_by = …, phi_disposed_reason = …`
— it never touches either column. pgTAP **both** directions: the UPDATE is refused, **and**
`dispose_case_phi` still succeeds end-to-end on a `required`-mode case (that second assertion is what
catches an over-tight guard).

⚠ **The resulting asymmetry is DELIBERATE and must be recorded as a decision, or it reads as a hole:**
the required-field invariant binds at **creation**, not for the case's lifetime. A disposed `required`-mode
case legitimately ends up missing fields its mode demands, because **erasure must win over a collection
rule**. Promote to an ADR 0137 amendment at Record time.

**Two keystone-pinned constraints discovered during the build — do not "clean these up":**
- **`create_case`'s signature cannot change.** `supabase/tests/357` §1.6 pins it verbatim as
  `create_case(uuid,text,boolean,uuid[],uuid,text,uuid,jsonb)` and §1.5 pins the overload count at exactly
  one. `p_patient_enabled boolean` **stays**, mapping `true → 'optional'`, `false → 'none'` — which is
  D1's mechanical rule anyway, and a processless case has no template version to carry a mode.
- **`bulk_create_cases` must KEEP its direct call to `app._set_participant_patient_unchecked`.** 357 §1.1
  pins the caller set at exactly **four** routines; routing bulk's PHI through
  `create_case_from_template(p_patient)` drops it to three and reds that keystone. Consequence, and it is
  why the trigger is deferred: bulk creates the case **before** writing PHI, so a creation-time
  "`p_patient` is null" refusal inside `create_case_from_template` would break every `required`-mode bulk
  batch.

**SQLSTATEs** (ADR 0135; verified free — the live catalog tops out at `HC0T0`):
`HC0T1` = required patient fields missing · `HC0T2` = invalid patient mode / required-field element.

⛔ **THE COMPAT SHIM DOES NOT REACH E2E — found at gate step 2, 2026-08-23, and it is an analysis defect,
not a spec defect.** The shim was justified as "nothing breaks", but the consumer enumeration was bounded
by **`src/lib/**` — a DIRECTORY, not the property.** The property is *everything that references these
names as strings*, and E2E specs hit **PostgREST directly by column and RPC name**, so a TS-level shim was
never going to reach them. Migration B drops `cases.patient_enabled`, `process_template_versions
.collects_patient` **and** the `set_template_collects_patient` RPC with no compat overload, so those specs
fail with `42703` / `PGRST202`.
**Measured, property-bounded: 9 files** — `case-patient.spec.ts` (a genuine rewrite: its whole subject is
the feature D1–D3 changed), `helpers/process-templates.ts`, `processless-cases.spec.ts`,
`bulk-case-creation.spec.ts`, `quality-oversight.spec.ts`, `patient-index.spec.ts`, `case-access.spec.ts`,
`helpers/dsr-fixture.ts`, `dsr-slice3-adjudication.spec.ts`.
⚠ **A first hand-list named 8 and missed `quality-oversight.spec.ts`; it also mis-sized
`processless-cases.spec.ts` as "1–3 mechanical lines"** — reading it in full showed only two SELECT sites
needed changing, while its docblock's `create_case(commission, label, patient_enabled, …)` mentions are
**accurate and must stay** (that is the RPC *argument* name, which `create_case`'s keystone-pinned
signature preserves — renaming them would be a wrong fix that looks like thoroughness).

⛔⛔ **THE LEAD'S CORRECTION OF THAT HAND-LIST WAS ITSELF WRONG — recorded because the shape is the point.**
The correction claimed **"80 references across 11 files."** Both figures were wrong:
- **11 files was a miscount.** The sweep printed **13 rows** because it grouped by *(file × matched name)*,
  so one file matching three names produced three rows; the row count was read as a file count. It is **9**.
- ⛔ **"80 references" was never re-derivable**, because it was taken *before* the tester's fixes and quoted
  *after* them. Post-fix the same sweep gives 48 lines / 49 occurrences. The two are **not comparable**, so
  the honest statement is not "I over-counted" but **"I quoted a census I had not reconciled, and my own
  measurement went stale between taking it and citing it."**
⭐ **This is the fourth and fifth instance in one batch of an enumeration bounded by something other than
its property — and this pair occurred INSIDE the correction of the previous one, with a lead's authority
behind it.** ⭐ It was caught only because the tester **flagged the discrepancy instead of reconciling to
the lead's number**. Make that the norm: a subordinate silently adopting a superior's count is how a wrong
figure acquires authority it never earned.
⭐⭐ **The worst consequence is not the hard failures — it is the ONE THAT DOES NOT FAIL.**
`case-patient.spec.ts:563-568` wraps the now-broken helper in `.catch(() => null)`, so instead of erroring
it **permanently and silently skips the negative-path assertion**, and its comment has drifted to read
*"no non-collecting template in this seed"* — now false, and reading as a deliberate seed fact. Green,
blind, and self-justifying. ⚠ The swallow is a **class**: 16 occurrences across 13 `e2e/` files. ⛔ Most are
probably legitimate teardown — **audit for the shape (a swallow converting a broken setup path into a
skipped assertion), never blanket-remove**; a detector that finds a lot needs proving as much as one that
finds nothing.
⚠ This does **not** invalidate gate step 1 — E2E is step 2 and step 1 never claimed to cover it.

**Compat shims, deliberately temporary:** `patientEnabled`, `collectsPatient` and
`setTemplateCollectsPatient(versionId, collects)` are KEPT in TS as derived/delegating, so the in-flight
frontend work does not collide. ⚠ Each must carry `@deprecated` naming `patientMode` — otherwise the
boolean dies in SQL and lives forever in TS, and the next reader concludes both are load-bearing by design.
10. `REVOKE ALL ON FUNCTION … FROM PUBLIC` before `GRANT EXECUTE … TO authenticated` on every new
    `public.*` RPC (else the dashboard t19 pgTAP guard reds).

### 0b. Narrative rename + assignment role (D10, D11)

**Migration C.**
11. `alter table case_narratives rename column type_label to display_label`; rename the CHECK
    `case_narratives_type_label_not_blank` → `…_display_label_not_blank`.
12. Re-emit the bodies that reference it, each regenerated from `pg_get_functiondef`.
    ⛔ **The "seven" list from ADR 0137 D10 is WRONG in both directions — re-measured 2026-08-23.**
    **9** bodies reference `type_label`; they split **6 must-rename / 3 must-NOT-rename**:

    | must RENAME (`case_narratives.type_label`) | hits | | must NOT rename (`case_referral.type_label`) | hits |
    |---|---|---|---|---|
    | `app.trg_audit_case_narratives` | 4 | | `public.create_referral_draft` | 1 |
    | `public.add_ad_hoc_narrative` | 5 | | `public.get_referral_detail` | 2 |
    | `public.add_referral_shared_item` | 1 | | `public.update_referral_draft` | 1 |
    | `public.create_case_from_template` | 1 | | | |
    | `public.get_case_detail` | 2 | | | |
    | `public.list_my_cases` | 2 | | | |

    ⛔ **The dangerous half: D10 says to "leave the referral arm of `add_referral_shared_item`
    alone" — obeying that ships a RUNTIME BREAK.** That body has exactly one `type_label`, at
    `coalesce(v_narrative.title, v_narrative.type_label)` — `v_narrative` is **`case_narratives`**, so
    it MUST be renamed. The referral-half reference D10 attributes to it **does not exist**. The
    caution reads as care, which is exactly why it would be obeyed rather than checked.
    ⛔ **`public.update_case_narrative_body` is NOT in the set** — its definition does not contain
    `type_label` at all (raw regex, no comment stripping). It touches `case_narratives`, not that
    column. ⚠ **So D10's `ARM=wrapper` note attaches to the wrong function.**
    `add_referral_shared_item` is `prosecdef = t`. The `prosecdef = f` bodies this batch actually
    touches are `clone_template_version` and `app._set_participant_patient_unchecked` (Migration B) —
    name **those** in the gate record.
    ⭐ **Post-migration keystone, both directions:** assert **zero** live bodies reference
    `case_narratives.type_label` **and** that the three referral bodies **still** reference
    `case_referral.type_label`. A one-sided check passes if you renamed too much.
13. `case_narratives`: add `assignment_role_id uuid null references case_assignment_roles(id)`.
14. New DEFINER `public.set_case_narrative_assignment_role(p_narrative_id, p_role_id default null)`,
    a twin of `set_case_phase_assignment_role` (same authority: coordinator). REVOKE-then-GRANT.

### 0c. TS side

⛔ **CORRECTED 2026-08-23 — step 15 as originally written CONTRADICTED §0 and caused a live collision.**
It assigned `src/components/cases/case-narrative-card.tsx` and `narrative-type-dialog.tsx` to Inc 0's TS
side, while §0 simultaneously claimed "Increment 1 and 3 touch no file Increment 0 touches." Both cannot
hold — Inc 1a edits `case-narrative-card.tsx`. The split below is the ruling.

**The boundary is the DIRECTORY, not the change.** A rename crossing layers does **not** transfer
ownership of the far side; each owner sweeps their own tree.

| owner | scope | D10 rename responsibility |
|---|---|---|
| `backend` | `supabase/**`, `src/lib/**` | `queries/cases.ts`, `queries/case-narratives.ts`, `case-narratives/actions.ts`, `queries/case-narratives.test.ts`, `cases/actions.ts` |
| `frontend` | `src/components/**`, `src/app/**` | `case-narrative-card.tsx`, `narrative-type-dialog.tsx`, `build-case-referrals-module.ts`, + the three `src/app/**` narrative/detail pages |

15. `npm run gen:types` (Rule 8), then **backend** updates its column above, including
    `src/lib/cases/actions.ts` (PHI-mode messages replacing `patientNameOrMrnRequired` for cases).
    ⚠ **The tree is legitimately RED between the two halves landing.** Neither owner may report green
    alone, and each must report **which** errors were theirs — "typecheck is clean" from one half hides
    whose work was actually measured.
    ⚠ `src/lib/cases/actions.ts` calls `set_template_collects_patient`; the shim keeping it compiling
    must be repointed at the new RPC **before** Migration B drops the old one.

⛔ **Three `typeLabel`s must NOT be renamed — different columns** (measured):
`ProcessTemplateNarrative.typeLabel` (`queries/case-narratives.ts`) and `queries/process-templates.ts:270`
are the joined **`case_narrative_types.label`**; every `typeLabel` in `queries/referrals.ts` /
`referrals/types.ts` is **`case_referral.type_label`**, which D10 explicitly does not rename.
16. New pt-BR messages: per-field "obrigatório" copy driven off the required set, and a
    process-mode label set.

### 0d. pgTAP
17. `required`-mode create refused without MRN — via **`set_case_patient` AND `set_participant_patient`**
    (both compat and E1 multi-patient doors; see step 8). ⛔ **Not** "the direct-table path" — that path is
    unreachable for `authenticated` and the test would be vacuous (step 8b). Assert the **lockdown**
    instead: `authenticated` holds no INSERT/UPDATE on the three PHI tables.
18. `optional` mode behaves byte-identically to today's `collects_patient = true`.
19. Backfill correctness: every pre-existing `true` → `optional`, every `false` → `none`, zero
    `required`.
20. `set_case_narrative_assignment_role` authority mirrors the phase twin.
21. Positive control: each new guard must be shown to RED when disabled (`lint:vacuous` discipline).

---

## Increment 1 — Case & Process quick wins (no migration)

### 1a. Attributed-work affordance (D8)
- `src/components/cases/case-phase-article.tsx` — render a primary **Preencher** when
  `phase.status === 'active' && phase.assignedTo === viewerId && isOpen`, reusing
  `StartPhaseButton`. ⚠ Requires threading `viewerId` into the article (the list has it; the article
  does not).
- `src/components/cases/case-phase-list.tsx` — pass `viewerId` down.
- `src/components/cases/case-narrative-card.tsx` — promote the assignee's **Editar** from
  `variant="ghost" size="sm"` to the same primary treatment when
  `narrative.assignedTo === viewerId`; coordinators keep the ghost variant.
- ⛔ Gate on `assignedTo === viewerId` **only**. Do not read `caps`, do not add a prop that
  `narrowToReadingSurface` could zero.
- Applies to both hosts (`/casos/[caseId]` and `/manage/cases/[caseId]`) because both mount
  `CaseDetailView`; verify the manage host does not now show two competing actions.

⭐ **As BUILT (2026-08-23) — the ⛔ "gate on `assignedTo` and nothing else" rule is enforced
STRUCTURALLY, not by discipline.** The predicate lives in a new shared module
`src/components/cases/assigned-work-access.ts` (mirroring the `phase-result-access.ts` precedent),
exporting `isAssignedTo` / `canFillAssignedPhase`, and it **takes no capability argument at all — the
signature cannot express one.** That is the regression guard: a future edit cannot quietly start reading
`caps` without changing the function's type, so `narrowToReadingSurface` can never take this affordance.
Prefer this shape over a comment saying "do not pass caps here."
✅ **Vacuity proven, not asserted:** removing the `viewerId != null` guard REDs 2 of the module's 8 tests;
the neutralization was reverted.
✅ **No competing primary on the manage host** (measured): the branch requires `status === 'active'`, and
on an active phase the coordinator cluster offers only `Alterar responsável` (outline) and the result
control (ghost); the one other default-variant button, `Ativar e atribuir`, belongs to a `pending` phase.

### 1b. Field removals (D9)
- `src/components/cases/create-case-dialog.tsx` — remove `<CaseDepartmentField>`; remove the
  `departments` prop and the `patientAgeYears` hidden input.
- `src/components/cases/edit-case-meta-dialog.tsx` — remove the department field.
- `src/components/cases/case-bulk-grid.tsx` — drop the `ageYears` PHI column (verified: the bulk
  wizard has an age column and **no** department field, so only the age half applies here). Its
  companions `bulk-create-types.ts` / `bulk-grid-model.ts` keep the field in the model — **no
  backend change** — the column simply stops rendering.
- `src/components/safety/patient-fields.tsx` — add `hideAge?: boolean` mirroring `hideUnit`; set it
  from the two **case** call sites only. Safety + referral keep `Idade`.
- `src/app/o/[org]/c/[commission]/manage/cases/page.tsx` and the `(detail)/layout.tsx` — stop
  passing `departments` to the create/edit dialogs (keep any read-only display).
- **Display retained:** wherever a case currently renders its department, leave it. Add a read-only
  line if none exists.
- `src/components/cases/case-department-field.test.tsx` — the component survives (hospital admin
  surface still uses departments); decide per call-site rather than deleting the file.
- ⛔ **No backend change.** `department_id`, `department_other`, `age_years` and every RPC argument
  stay.

#### 1b-bis — What §1b got wrong, found during the build (2026-08-23)

⭐ **1. `update_case_meta` FULL-REPLACES label + department — deleting the input alone would have
SHIPPED SILENT DATA LOSS.** Removing the department field as written means every unrelated **label**
edit re-submits an absent department and **clears any stored value**. No error, no failing test,
nothing in the eight gates that could see it. ✅ **Fix:** the dialog submits the current
`departmentId` / `departmentOther` as hidden mirrors, carrying a ⛔ `DO NOT DELETE` comment — this
preserves the pre-existing semantics **exactly** (the field was already a pre-filled control
re-submitted on every save; a hidden mirror is that minus editability), which is what keeps it inside
D9's no-backend-change constraint.
✅ **Hazard measured to be unique to this dialog, not assumed:** `updateCaseMeta`
(`src/lib/cases/actions.ts:662-663`) is the only department writer that *replaces*. The three create
paths — `createCaseFromTemplate` (:527), `createCase` (:606) and the bulk wizard (`bulk-actions.ts`,
which sends no department at all) — **mint** a row, so there is no prior value an omission could clear.

⛔ **2. `case-bulk-grid.tsx` is the WRONG FILE for the age removal.** The grid derives its columns from
`selectedPhiKeys`, so dropping its cell branch would leave `ageYears` **selectable** and render it as an
untyped plain-text cell — worse than the defect being fixed. Filter `ageYears` out of the **offer** in
`bulk-step-process.tsx` instead. `bulk-grid-model.ts` stays untouched (backend-owned; no backend change).

⛔ **3. "`CaseDepartmentField` survives — the hospital-admin surface still uses departments" is FALSE.**
That surface uses **`DepartmentsManager`**, a different component. After D9 removes both app call sites
the field has **zero non-test consumers**. ⚠ It is **dead code wearing a green check**:
`case-department-field.test.tsx` still renders it five times and passes, and a test-only consumer
satisfies tsc, eslint and `lint:vacuous` forever — **no gate in the eight can distinguish "exercised by
the product" from "exercised only by its own test."** Not deleted in this batch (deletion is a decision,
not a cleanup); tracked as `FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER`, whose index line is the only
thing that will ever raise it again.

⭐ **4. Beyond the plan, and correct:** `case-patient-edit-dialog` also needed `hideUnit` — it was the one
**case** surface still showing the PHI unit — and `CaseDetailView` gained a read-only department line so
`/casos` displays what `/manage` already did (D9's "existing values stay VISIBLE").

⚠ **Specs the tester must update (engineers did not touch them):** `e2e/hospital-departments.spec.ts`
(Task 2 + the keyboard-only flow assert the Novo-caso dropdown) and `e2e/case-patient.spec.ts:1357`.

### 1c. Process detail page (D13, D14)
- `src/components/process-templates/template-builder-shell.tsx` — wrap the slot list in a titled
  shell mirroring `case-phase-list.tsx`'s `<section>` (border, `Trabalho do processo` heading,
  subtitle) with `Adicionar fase` / `Adicionar narrativa` in a bordered footer.
  ⛔ **No progress meter, no status bar.**
- Same file — gate `<CaseTypePicker>` on `isDraft`; render the case type read-only otherwise.
  **Delete the dangling `ADR 0064 D4` citation** in the comment above it and cite ADR 0137 D14.

---

## Increment 2 — Referral wizard (D4–D7)

### 2a. Deferred creation (D5)
`src/components/referrals/referral-send-wizard.tsx`:
- Steps 2–3 stop calling `addReferralSharedItem` / `setReferralPatient`. `pickedNarratives`,
  `pickedDocuments` and `patient` become pure local buffers.
- New `flush(mode: 'draft' | 'send')`: `createReferralDraft` → **remove stale** → `addReferralSharedItem`
  per pick → `save_referral_patient` if the buffer has data → `sendReferral` when `mode === 'send'`.

⛔ **SPECIFICATION GAP in ADR 0137 D5 — found independently by both teammates, corrected here 2026-08-23.**
D5 states *"the flush only ever ADDs"* and that the un-pick defect **"dies with this change."** ⚠ **That is
true for a FRESH referral and FALSE for a RESUMED one.** On resume, previously-frozen items exist
server-side; a coordinator who reopens a draft and un-picks one would leave the frozen row in place — the
defect does not die, it **moves** to the resume path. `add_referral_shared_item` is INSERT-only, so adding
cannot undo it.
✅ **As built, the gap is closed:** `flush` diffs against **server truth re-read each flush** (`onLoadDraft`)
and removes stale items **before** adding. ⭐ The structural reason this design was forced:
removal needs the `referral_shared_item` id, which the wizard's **source-keyed** buffers never carry — a
local "what I added" set *cannot* remove, and would have reproduced D5's own defect inside the resume path.
That is also why `removeReferralSharedItem` — previously with **zero callers anywhere** — gets its first
real caller here.
⚠ **`onLoadDraft` must be a REQUIRED prop**, not optional. Optionality is the sole source of the
"a host that omits it cannot remove" caveat; requiring it makes the bound structurally impossible instead
of documented. Verified there is exactly **one** host (`case-outbound-referrals-card.tsx:223`) and it
already passes it. Keep the fail-safe *principle* in the docblock — **refuse rather than ship more than
the screen shows** — even once the branch enforcing it is gone.
⛔ **Promote this to an ADR 0137 D5 amendment at Record time.** A specification that no longer describes a
correct build is exactly the record that goes stale silently, and D5's "dies with this change" would
otherwise read as settled to everyone who never sees this plan.

⭐⭐ **The amendment must fix the MECHANISM, not just the outcome — because the maintenance rule INVERTS.**
D5's rationale was that the defect dies *because buffering removes the round trip* ("the flush only ever
ADDs"). After the build the defect is dead for a **different reason**: the flush **does** remove, and it is
dead because **the remove path is correct and its result is checked** — not because removal was eliminated.
The two readings imply **opposite** maintenance rules:
- Under D5-as-written, a contributor who **adds** a removal call is violating the decision.
- Under what shipped, a contributor who **deletes** the removal call reintroduces the defect.
⛔ A reader who finds only the original sentence is **actively misled about which direction is dangerous**.
That is why restating the outcome ("the un-pick bug is fixed") is not enough.

**Two further properties to record in the same amendment — measured, and both invisible to every gate:**
1. ⚠ **Remove-before-add ordering is LOAD-BEARING, not incidental.** It is what stops a draft transiently
   holding more shared items than the screen shows. A later refactor that reorders `flush` for readability
   drops that property with **nothing failing**.
2. ⚠ **The fail-closed choice must survive its own branch.** Refusing the send when the frozen map cannot be
   refreshed is a **decision**, not a defensive leftover — and an unrecorded fail-closed branch is exactly
   what a future contributor "fixes" into fail-open, because refusing looks like a bug. Once `onLoadDraft`
   becomes required the branch disappears; ⛔ **the principle must stay in the docblock anyway** —
   *refuse rather than ship more than the screen shows*.
- ⚠ **Partial-failure policy must be explicit**: if `createReferralDraft` succeeds and a later step
  fails, the draft exists. Keep the minted id in state, surface the error, and let the user retry —
  never re-create (that orphans the first).
- `Salvar rascunho` renders left of the primary on all four steps, disabled until type +
  destination + subject are filled.
- The `toggle*` un-pick bug dies here (ADR 0137 D5); confirm no `addReferralSharedItem` call is left
  that passes both source ids null.
  ⭐ **Severity, measured — worse than "latent", and it needs its own regression spec.**
  `toggleNarrative`/`toggleDocument` check `result.ok` **only on the ADD branch** (`if (!isPicked)`);
  the un-pick `else` (`:400-406`, `:427-433`) unconditionally deletes from local state and discards the
  outcome. **Both** toggles, documents as well as narratives. Net effect today: **a coordinator un-picks
  a narrative, the UI shows it gone, and it is still shared with the receiving committee on send** —
  content over-sharing across a committee boundary.
  ⛔ **Where the refusal actually lives, because the layer decides the spec.** It is
  `src/lib/referrals/actions.ts:226-230`, which returns `sharedItemKindInvalid` **before**
  `supabase.rpc(...)` — so on an un-pick **the RPC is never called.** `public.add_referral_shared_item`
  *does* also raise `HC077` on a null source id, but that guard never runs on this path and is **not**
  what keeps the data clean. ⚠ Citing it would be quoting a real predicate for a conclusion it does not
  bound — the same error this batch has now made in both directions.
  ✅ **Blast radius is therefore narrower than it looks:** nothing reaches the DB, so no
  `referral_shared_item` row with null sources is ever created. It is a UI/server divergence, not data
  corruption.
  ⛔ **The regression spec must assert the OUTCOME, never the mechanism.** A spec written against "the
  RPC refuses a null source id" pins **a call that never happens** — green today, green after the D5
  rewrite deletes the round trip, proving nothing at either end. The assertion that would have caught
  this: **pick two narratives, un-pick one, send, assert the receiving committee sees exactly one shared
  item.** Fails today, passes after. "Structurally impossible now" is not a test.
  ⚠ **Two things Inc 2 must not assume:**
  `removeReferralSharedItem(sharedItemId)` already exists (`actions.ts:246`) but the wizard tracks
  **source** ids, not shared-item ids — that mismatch is the structural reason removal was punted to the
  hub, so "just call remove" is not the cheap fix it looks like. And the comment at `:391-393` asserting
  *"Toggling OFF an already-frozen item before send is handled by the draft editor"* is an
  **item to verify, not a premise** — if no such pre-send path exists, that sentence is what let this ship.

### 2b. Draft resume (D6, D7)
- `src/components/referrals/case-outbound-referrals-card.tsx` — a `status === 'draft'` row opens the
  wizard instead of linking to the detail page.
- New wizard prop `resumeReferralId`. On open: load via `getReferralDetail`, prefill the header,
  rehydrate picks from `sourceNarrativeId` / `sourceDocumentId`, load PHI lazily on the patient step
  through the existing audited `get_referral_patient` door.
- Flush in resume mode uses `updateReferralDraft` for the header and add/remove for items.
- Destination renders **read-only** with a note (D7).
- `src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx` — a `draft` reaching the
  detail page directly should redirect back to the case (or keep only discard); decide and state it.

### 2c. MRN mandatory (D4)
- `referral-patient-fields.tsx` — step legend loses "(opcional)".
  ⛔ **CORRECTED 2026-08-23 — "MRN marked required" as originally written is WRONG.** A native
  `required` attribute would block **`Salvar rascunho`**, which D4 explicitly keeps working
  (`save_referral_patient` retains its `name OR mrn` floor precisely so a partially-entered draft can
  still be saved). The MRN is mandatory **at SEND**, not at every interaction with the field.
  ✅ As built: the field reads **"Prontuário (obrigatório para enviar)"** — copy that states *when* the
  requirement bites, rather than an attribute that enforces it at the wrong moment.
- `src/lib/referrals/messages.ts` — replace `patientNameOrMrnRequired` with an MRN-specific message;
  audit the other two modules' copies (`src/lib/cases/actions.ts`, `src/lib/safety/messages.ts`) and
  **leave safety's unchanged** (ADR 0137 Consequences).
- **Migration D:** `public.send_referral` refuses when the referral has no `referral_patient` MRN.
  Re-emit from the live catalog; ADR 0135 SQLSTATE; pgTAP both arms.
- `save_referral_patient` keeps its `name OR mrn` floor (D4).

---

## Increment 3 — `Atividade` card (D12, no migration)

- `src/lib/queries/case-documents.ts` — widen `CaseEvent.kind` from `CaseEventKind` to
  `AnyCaseEventKind` (the deferred BE-5 widening). `EVENT_KIND_LABEL` is already exhaustive over it,
  so this should be a one-line type change plus a cast removal.
- `src/components/cases/case-events-timeline.tsx` — rebuild per the handoff:
  header + subtitle, `Tudo / Atualizações / Sistema` pills, inline composer (6 case kinds, not the
  handoff's 4), timeline grid `32px 1fr` with a connector spine, tinted icon circles, type chips,
  empty-filter state. Keep the `coordinator_only` badge and the edit/delete affordances.
- Partition: `isCaseEventKind(ev.kind)` → *Atualizações*; else → *Sistema*.
- Composer visibility stays `canWrite`; the visibility control stays `canSetVisibility`.
- Tokens: use the project's existing Tailwind v4 tokens, **not** the handoff's raw oklch values.
  ⛔ Bare `[--var]` utilities are dead CSS — `lint:css-vars` fails the build on them.
- Motion via the `src/components/motion/` tokens (CLAUDE.md §2 GSAP mandate), not ad-hoc CSS.
- E2E impact: any spec scoping to the `Registros` heading or the add-record button needs updating —
  tester's call, not an engineer edit.

---

## Gates (run once, at the end — PO ruling)

Per increment (cheap): `npm run lint` (8/8), `npm run typecheck`, `npm run test`.

### ⛔ QUIET-TREE RULE — no number measured mid-flight may enter the gate record

**Observed 2026-08-23, and it is the reason this rule exists.** A vitest run taken while another
increment was mid-write reported **121 files / 1677 tests**, seven fewer than the **121 / 1684** measured
minutes earlier and again three times afterwards — **same file count, zero failures, and it reported
PASSED.** Nothing was lost; static `it()` counts against HEAD were unchanged.

⭐ **The file count holding steady while the test count fell is the whole lesson: that is a suite running
with FEWER TESTS, not a suite going missing — and it is indistinguishable from success.** `lint:vacuous`
catches a test that asserts nothing; **no gate in the eight catches a test that never ran.** A green run
with silently fewer tests is the failure mode that looks exactly like a pass.

**Therefore:** every figure in the §6 step-1 record — lint, `tsc`, vitest counts, pgTAP counts, the authz
ARMs — must be measured on a **quiet tree**: all increments landed, no teammate mid-write. pgTAP
additionally on a **fresh `supabase db reset`**. Mid-flight numbers are for a teammate's own iteration
only and must be labelled as such. ⚠ This applies to the lead's numbers too, and to any figure a teammate
reports in good faith — the defect is in *when* it was taken, not in who took it.

#### ⭐ The mechanism, demonstrated — it is a named file, not generic flakiness

**`src/lib/queries/session-grants.test.ts` derives its cases from the live catalog at import**
(`readRoleVocabularyFromCatalog()` shells `docker exec … psql` for `memberships_role_check`, then
`it.each(...)`). That design is correct and deliberate — the enumeration boundary is the **property**,
read at test time, because a non-commission-scoped role shipped with no landing page **three times**.
⭐ **But it makes the suite's test COUNT a function of live DB state**, and `memberships_role_check` is
created by one migration then **rebuilt by three later ones** (`mem_w4_technical_director_roles`,
`quality_reviewer_role`, `act_platform_role_enum`), each adding roles.

A `supabase db reset` therefore opens **two** windows that behave oppositely:
- **table absent** → `relation "public.memberships" does not exist` → **loud failure.** Safe, and
  observed directly during this batch when a teammate's run landed mid-replay.
- **constraint present but PARTIAL** (after the first migration, before the last) → a valid but smaller
  role vocabulary → fewer cases → ⛔ **PASSES with fewer tests.** The dangerous window, and a wide one.

⚠ **Do not attribute any specific historical count to this** — an empty read throws rather than
shrinking, so only the partial window shrinks silently. The mechanism is demonstrated; the diagnosis of
one past run is not, and asserting it would be the same wrong-grain error this batch made twice.
⛔ **Operational consequence: one owner of the local stack at gate time.** A `db reset` by one teammate
lands silently in another's evidence — it produced a spurious RED here, and the same window can produce
a spurious GREEN.

At the end, in §6 order:
1. **Build complete** — the above, plus `npm run test:db` on a **fresh `supabase db reset`**;
   `ARM=census` · `ARM=hat` · `ARM=floor` · `FROMFINDINGS=1 ARM=wrapper`; **plus a diff-scoped door
   sweep** over every policy and `prosecdef` gate this batch touches, derived from the migration
   diff (ADR 0079 Amdt 1), never by hand.

⛔ **The diff-derived list must NOT be built by grepping `create or replace` — that under-reports, and it
under-reports SILENTLY.** Measured on this batch: grepping the four migrations for literal
`create (or replace) function|policy` returns **14** gates and **misses six**, because Migration C
(`…001500`) re-emits the narrative-rename bodies **dynamically** — it derives them from the catalog at
migration time and issues them through `execute`, so no literal `create or replace` appears for
`app.trg_audit_case_narratives`, `public.add_ad_hoc_narrative`, `public.add_referral_shared_item`,
`public.create_case_from_template`, `public.get_case_detail`, `public.list_my_cases`.
⭐ **This is the enumeration-boundary trap in its most expensive form:** `create or replace` is a
**syntax**; the property is *"which function bodies changed."* The dynamic re-emission is *better*
engineering than a hand-list — and it is precisely what makes the naive sweep list wrong, so the safer
migration produces the weaker gate unless you notice.

**Union for this batch (20 gates):**
- `…001300` — `app.patient_required_missing` · `app.assert_patient_required_fields` ·
  `app.guard_case_patient_required` · `app.guard_case_patient_mode_immutable` (+ its trigger)
- `…001400` — `app._set_participant_patient_unchecked` **(prosecdef=f)** · `app.trg_audit_template_versions` ·
  `public.clone_template_version` **(prosecdef=f)** · `public.create_case` · `public.create_case_from_template` ·
  `public.bulk_create_cases` · `public.get_case_detail` · `public.set_template_patient_mode`
- `…001500` — `public.set_case_narrative_assignment_role` **+ the six dynamic re-emissions above**
- `…001600` — `public.send_referral`

⚠ **No RLS policy was created or altered by this batch** (zero `create policy` / `alter policy` hits across
all four migrations), so the policy half of the sweep is legitimately empty — ⛔ but record that as a
*measured* empty, not as "the sweep found nothing." An empty domain and a clean sweep print differently and
must not be conflated.
⚠ `ARM=wrapper`'s domain gains **two** `prosecdef = f` bodies from this batch
(`public.clone_template_version`, `app._set_participant_patient_unchecked`) — no arm run during the build
covered them.
   ⚠ The new gates (`set_case_narrative_assignment_role`, the `required`-mode refusals, the
   `send_referral` MRN refusal) are in **no BLIND set** and pass `ARM=policy` vacuously —
   **`ARM=census` is the arm that catches them** (Amdt 3). `update_case_narrative_body` being
   `prosecdef = f` puts it in `ARM=wrapper`'s domain.
2. **Test pass** — tester updates specs for: the phase Preencher affordance, the removed fields, the
   referral deferred-create + resume flow, the MRN refusal, and the Atividade card's new
   accessible names. Declare green via `npm run e2e:prod` (fresh reset, `REBUILD=1`).
   ⚠ Baseline any red against `main` in the **same configuration** before calling it a regression.
3. **QA review** → `docs/reviews/…`.
4. **Human approval.**
5. **Record** — PROGRESS.md, `docs/progress/phase-ledger.md`, `docs/backend-state.md` (the backend
   surface changes in Inc 0 and 2). **Name the ARM, never the script.**

   ⛔ **PROGRESS.md byte budget — a live constraint on this batch, not a Record-time detail.** Measured
   2026-08-23: **78,748 bytes against the 80,000 hard fail** = **~1.25 KB headroom**. Teammates are
   locked out for the batch's duration (send content to the lead; the lead places it), because three
   agents racing a size gate reds it for whoever writes last.
   **The rotation that buys the room is the AFF2 § Now bullet** — complete, merged, pushed, and already
   fully recorded in the ledger row + [aff2.md](../progress/aff2.md), so by the live-state contract it
   should have left already. It was **deliberately NOT rotated mid-build**: a verbatim rotation 404s its
   own relative links, and doing it while two agents hold uncommitted edits trades a size risk for a
   content-loss risk.
   ✅ **AFF2 rotated 2026-08-23** (21.2 KB → freed ~1.9 KB); the gate-step-1 record then consumed it back.
   ⛔ **The SECOND rotation candidate is the CASE SURFACE SPLIT bullet (§ Now, ~35 lines) — and it is NOT
   the same job as AFF2's.** AFF2 was purely completed record, so trimming it was safe. This one **still
   carries LIVE state** that exists nowhere else in § Now: `FUP-CS2-QA-RESIDUE` at **12 → 6**,
   `FUP-RESET-ROLE`'s **134-file sweep still open**, ADR 0135 **ruled and DEFERRED, not built**, and **two
   new residues** filed by B3. ⚠ A verbatim rotation of this bullet would move live items into an archive
   — the precise failure the live-state contract exists to prevent. **Compact it in place** (keep the
   residue and the "a triage note is not licence to accept a red gate" lesson; drop the completed-run
   detail already held by the ledger row + the increment archives), and do it at Record time with the
   whole file in context, never mid-gate.
   ⚠ **One thing in the AFF2 bullet was at risk when it rotated — it was carried across, keep it that way:** the
   lesson that *"a commit count and a head sha are LIVE FACTS"*, evidenced by that bullet once claiming
   "39 commits, head `ed125b93`" while **already wrong when committed** — the Record commit that wrote it
   was itself commit 40. **A count written inside the commit it counts is off by one by construction.**
   The only other copy of this lesson lives in
   [quality-office-oversight-phase-b.md](../progress/quality-office-oversight-phase-b.md), attached to a
   *different* occurrence, so trimming the AFF2 bullet without moving this text loses the AFF2 instance.

**Deploy order:** schema first, then code. Additive migrations make old-code/new-schema safe;
new-code/old-schema is the broken state, and Coolify auto-deploys on push.

---

## Risks

1. **The seven-body re-emission (D10) is the highest-risk item in the batch.** A missed body fails at
   *runtime*, not at migration time, and `graphify`/grep cannot see it — only the catalog can. Verify
   post-migration that zero live bodies still reference `case_narratives.type_label`.
2. **Dropping `collects_patient` / `patient_enabled`** is destructive and irreversible in place. Do
   it in Migration B, after the re-emissions, and verify no body references them first.
3. **The referral flush is multi-step and non-atomic.** There is no transaction across the RPCs, so a
   mid-flush failure leaves a partial draft. The retry policy above is the mitigation; state it in
   the code, not just here.
4. **`required` mode is a live-process footgun** (ADR 0137 Consequences). Consider a confirm step in
   the builder; decide before Inc 0's UI half.
5. **E2E churn.** Increments 1 and 3 rename or remove several accessible names. Expect spec updates;
   engineers must not edit specs without tester sign-off (§6 step 2).

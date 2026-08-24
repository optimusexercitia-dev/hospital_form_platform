# QA Review — ADR 0137 batch, ROUND 2 (remediation of C-1 … C-4)

**Reviewer:** `qa` · **Date:** 2026-08-24 · **Gate:** §6 step 3, second pass
**Subject:** the uncommitted working tree. Round 1 is
[adr-0137-batch-review.md](./adr-0137-batch-review.md) and is left intact as the record.
Nothing is committed, merged, or pushed.

**Verdict: APPROVED**, with four conditions that are documentation/rename-level and must be
discharged **in the §6 Record edit, before the commit** (§ 7). All four round-1 items are
genuinely closed; the blocker is closed *and exercised through the product*, not merely built.

---

## 0. Method

Everything asserted here about schema, RLS, RPCs, grants and triggers was measured from the
**live catalog** on the local stack, never from migration text. One accessibility claim was
settled by driving real Chromium and reading the CDP accessibility tree, because I had reasoned
myself into a false conclusion and would have shipped it as a defect (§ 5, N-4).

Re-derived independently rather than accepted on report:

| Claim | How re-derived | Result |
|---|---|---|
| `npm run lint` 8/8 | ran it | **exit 0**, all eight; `lint:vacuous` scanned 234 spec files, 0 findings; `lint:set-local` watermark still `20260928000500` (not bumped) |
| `npm run typecheck` 0 | ran it | **exit 0** |
| `lint:progress` passes | ran it | OK — but see § 7 C-b, the headroom is now **260 bytes** |
| C-2 landed and is not vacuous | `pg_class.relacl` + `information_schema.role_table_grants` | **confirmed** — all four tables exist under those exact names with `{postgres,service_role}` only |
| C-3 landed and is not vacuous | `pg_get_triggerdef` + `pg_proc.prosrc` | **confirmed** — both neutralizations redden 7.1a |
| C-4 landed | `### Decision N` grep of ADR 0064 + the two comments | **confirmed** — 0064 carries Decisions 1–4, D4 is the `case_types` table |
| `required` is reachable and product-driven | read the spec end-to-end + traced every write path in it | **confirmed** — the DB row can only reach `required` through the UI (§ 2) |
| The authz verdicts still stand | mtimes of the four migrations vs. the round-1 review | **confirmed unchanged** — `…001300`–`…001600` all predate round 1; no new DB object was created this round, so `census`/`hat`/`floor`/`wrapper` and the *measured-empty* diff-scoped sweep carry over verbatim |
| The gate's "guard refs 2–7, none zeroed" correction | re-read § Now | **corrected** — it now records 0–6 and names the two legitimate zeros. My round-1 non-reproduction is reflected accurately |
| 113 spec files in the gate | `ls e2e/*.spec.ts \| wc -l` | **113** — the new spec is inside the run, not beside it |
| `359`'s plan count | `select plan(58)` | **58**, matching the reported +1 |

**Not re-run** (lead owns it): the full `e2e:prod` gate, the pgTAP suite, the four authz arms.
Per the brief I did not re-run them and did not reset the local DB.

---

## 1. C-1 — **CLOSED.** The blocker is discharged, and discharged the right way

Round 1's finding was not "the picker is missing" — it was **"the mechanism exists and nothing
can reach it"**. So the question this round is reachability, not presence.

### The channel exists and is the only one

`src/components/process-templates/collects-patient-picker.tsx` is now `PatientModePicker`: a
three-mode native-radio group (`Não coletar` / `Opcional` / `Obrigatória`) plus, under
`required`, a checkbox set over `PATIENT_REQUIRED_FIELD_ORDER`. It is mounted at
`template-builder-shell.tsx:523` behind `showPatientMode = isDraft && casePatientEnabled`
(`:225`) — draft-only, flag-gated, unchanged posture.

It calls the existing `setTemplatePatientMode`; no new server surface. Measured from the live
catalog, `public.set_template_patient_mode` is `prosecdef = t`, gated by
`app.is_staff_admin_of(commission) or app.is_tenancy_admin_of(commission)` and refuses a
non-draft version. That pair is **identical to its sibling authoring door**
`public.set_template_case_type` — I checked both bodies for the two predicates rather than
assuming. **No authority widening.** The RPC also welds `mrn` server-side and refuses an
out-of-vocabulary field with `HC0T2`, so a UI defect that stripped `mrn` would still be caught.

`patientMode` / `patientRequiredFields` now appear in **4 `.tsx` files** (was 0):
the picker, the builder shell, `create-case-dialog.tsx`, and `manage/cases/page.tsx` (which
carries them onto `TemplateOption`). `patient-fields.tsx` type-imports `PatientRequiredField`.
Every one of those imports is `import type` with an inline note about
`lint:client-server-imports` — correct, and the gate agrees.

### It is exercised **through the product**, not around it

This is the part that matters, and it holds. `e2e/patient-mode-required.spec.ts` AC-R2:

- `beforeAll` builds the fixture with `createDraftTemplateDirect` + `add_template_phase`. I
  grepped that helper: **it never writes `patient_mode`** — the version is born `'none'`.
- The spec contains **no service-role write of `patient_mode` or `patient_required_fields`
  anywhere.** Every mutation of them goes through Tab + Space on the rendered picker.
- It then reads the row back over the service-role REST channel and asserts
  `patient_mode = 'required'` and `patient_required_fields = {name, mrn, date_of_birth, sex}`
  exactly.

So the assertion *"the DB is in `required` mode"* has exactly one causal path in that test, and
it is the product. That is precisely the gap C-1 named, and it is closed. AC-R3 then mints a
case through the `Novo caso` dialog and asserts `cases.patient_mode = 'required'` plus the
stored `patient_identifiers` row field-by-field. End to end, no shortcut.

### D2's UI requirement, and D3 layer 3

- **D2 — `mrn` selected and non-interactive.** Rendered as `aria-disabled` on a Radix
  `Checkbox` whose `checked` is the literal `true` and whose `onCheckedChange` no-ops on the
  welded key (`:206-217`). Not `disabled`, not hidden — so it keeps its place in the tab order.
  Measured in Chromium (§ 5 N-4): its accessible name is **"Prontuário Sempre exigido"**, it
  carries `aria-describedby` pointing at the LGPD note, and the visible `Sempre exigido` badge
  is real text inside the label, not a colour.
- **D3 layer 3 — the form marks the inputs required.** `PatientFields` gained an optional
  `requiredFields`; the marker is a `<span> (obrigatório)</span>` **inside the `<label>`**, so
  it lands in the accessible name rather than in styling, plus `aria-required`. A required
  `Sexo` disables the `unknown` option and relabels it `Selecione…` — correct, because
  `app.patient_required_missing` counts that sentinel as missing (verified in the live body).
  `create-case-dialog.tsx` gates the submit on `patientDraftMissingRequired` and names the
  outstanding fields in a `role="status"` region.
- The stale docblock at `create-case-dialog.tsx:57-62` that named the dropped
  `cases.patient_enabled` is **fixed**, and the replacement records *why* the boolean died.

### `requiredFields` defaults to `[]`, so the other two PHI surfaces are untouched

`PatientFields` is shared with the safety-event and referral flows. With `requiredFields = []`,
`mark()` returns `null`, `ariaRequired()` returns `undefined`, and the legend reads
`(opcional)` — behaviour identical to before. The one unconditional change is a new
`aria-label` on the `DatePicker` trigger, which I measured (N-4) and which is a small
improvement, not a regression.

---

## 2. Is the new spec vacuous? — **No.** The differential is sound, and AC-R1 pins a property

The brief asked me to judge the tester's red-proof, which was a **differential against an
`optional`-mode fixture** rather than an implementation mutation, because the
`…_required_implies_mrn` CHECK forbids the empty-required-set state.

**The differential is sound, and for a reason worth stating precisely.** It proves the
assertions are sensitive to the *mode value*, which is the property that could plausibly be
wrong (an implementation that marked always, or never, would fail one direction). It does
**not** prove the assertions are sensitive to, say, deleting `aria-required` — but it does not
need to: those are **positive-presence** assertions on a locator that is separately asserted
visible, and a positive-presence assertion cannot pass vacuously. The vacuity risk in this file
lives entirely in its **negative** assertions, and each of them is correctly guarded:

| Negative assertion | Why it cannot pass vacuously |
|---|---|
| `expect(attendingInput).not.toHaveAttribute('aria-required','true')` | preceded by `expect(attendingInput).toBeVisible()`, so the element is known to exist |
| `expect(getByText(/^Faltam preencher:/)).not.toBeVisible()` | preceded by **three** assertions that the same region *was* visible and narrowed its content — it asserts a transition, not an absence |
| `expect(messageA).not.toMatch(/prontuário/i)` | `messageA` is separately asserted to match three other field names |
| `expect(respA.ok()).toBeFalsy()` | pinned to the right cause by `expect(JSON.stringify(bodyA)).toContain('HC0T1')` — it cannot be satisfied by an unrelated failure |

**AC-R1 pins the property, not a coincidence.** I asked the required question — *what
implementation change would redden this?* — and there are four independent answers:

1. Making `mrn` interactive (dropping the `welded` guard, or replacing the literal `checked`
   with `fields.includes(field)`) → the Space press flips `aria-checked` → red.
2. Swapping `aria-disabled` for a native `disabled` → the explicit `aria-disabled` assertion
   reds, **and** `tabUntilFocused` throws, because a disabled button leaves the tab order.
   That second effect is what makes "keeps its place in the tab order" a measured property
   rather than a comment.
3. Removing `aria-describedby` or the `Sempre exigido` badge → red.
4. Hiding the welded row → the locator resolves nothing → red.

It also carries an **in-test positive control**: the genuinely interactive `Nome` checkbox is
toggled on Space and asserted to move, with an explicit failure message saying that if the
control does not move, the mrn assertions prove nothing. That is the right shape, and it is the
shape this project has repeatedly needed.

**One honest caveat on AC-R4.** Case B (payload omitted entirely) is described as reaching only
the deferred `guard_case_patient_required_trg`. I verified from the live body of
`create_case_from_template` that the eager check is inside `if p_patient is not null`, so the
description is accurate and the two cases really are different code.

---

## 3. Accessibility of the non-interactive `mrn` — **it holds**, measured

The claim under test was that `aria-disabled` on a focusable control is perceivable, correctly
announced, and refuses both pointer and keyboard activation.

- **Named.** Measured in Chromium: `role=checkbox`, `name="Prontuário"` from the wrapping
  `<label>` (see N-4 — I had to measure this, because a comment two files over asserts the
  opposite).
- **Announced as unavailable-but-checked.** `aria-checked="true"` + `aria-disabled="true"` +
  `aria-describedby` → the LGPD rationale.
- **Refuses the keyboard.** AC-R1 presses Space with focus proven on the element
  (`document.activeElement === el`, not Playwright's opinion) and asserts no state change.
- **Refuses the pointer.** AC-R1 clicks with `{ force: true }`, deliberately bypassing
  Playwright's own actionability veto on `aria-disabled`. This is the correct call and the spec
  explains why: nothing about the rendered control is `pointer-events: none` or natively
  disabled (the `disabled:` Tailwind variant targets `:disabled`, which `aria-disabled` does not
  trigger), so a real mouse user *can* reach it — and the no-op handler plus the literal
  `checked` prop is what must absorb the click. Testing the unforced click would have measured
  Playwright, not the product.

**Residual, minor and not a change request:** while `isPending`, the enclosing `<fieldset
disabled>` natively disables the Radix button, so the welded checkbox transiently *does* leave
the tab order. That is a sub-second window during a persist and applies to every control in the
group equally; `FUP-0137-PERSIST-REFRESH-DROPS-FOCUS` already owns the focus behaviour around
`persist()`.

---

## 4. Fixture isolation — **the template argument holds; the argument has a hole it does not cover**

The spec's header argument is correct as far as it goes, and I re-derived both halves:

- `getAnyPublishedTemplateVersion` has **exactly two call sites** in the suite
  (`case-patient.spec.ts:588`, `orphan-administrativo-reachability.spec.ts:325`) and I read
  both: they pass `COMM_A` and `CCIH` respectively. A commission the helper never queries
  cannot return a row from it. That is a structural exclusion, as claimed.
- No other spec navigates to `/c/farmacia/manage/process-templates` or
  `/c/farmacia/manage/cases`. The 48 other specs that touch Farmácia use it for referrals, DSR,
  audit, charters, indicators and dashboards.
- `process_templates` carries **no unique constraint on title** (measured), so repeated gate
  runs without a reset accumulate identically-titled fixtures without erroring — and no
  title-anchored caller looks that title up. Same accumulation the CCIH pool already has.

**The hole: the header argues about the leftover *template*, and the `afterAll` leaves
something else behind that it never accounts for.** `case_participants` cascades on a `cases`
delete (`confdeltype = 'c'`, measured), but `participants` / `patient_participants` /
`patient_identifiers` are keyed on the participant, **not** the case. So deleting AC-R3's case
strands a PHI row carrying `MRN-REQ-E2E-0001` and `Paciente Obrigatório E2E` with no case link
at all — a row shape that currently does not exist anywhere in the DB (I measured
`ORPHAN-PATIENT-PARTICIPANTS = 0`).

Is it inert? **Yes, but by absence rather than by structure**, and the distinction is the point:

- Nothing reaches it through a case, because it has no case link. `search_patient_xref` →
  `app.patient_trajectory_bundle` is hospital-scoped and MRN-keyed, and the MRN is unique to
  this spec.
- No spec in `e2e/` asserts a count or length over `patient_identifiers` or
  `patient_participants` — I swept for it and found zero.

So the leftover is harmless *today*, and it is harmless because no one currently counts those
tables — not because the spec excluded it. Worth one sentence in the header so the next person
adding a PHI census assertion knows the row is there. **Not a change request.**

---

## 5. New findings this round

**N-1 (required before commit) — three pgTAP suites collide with three merged AFF2 suites.**
Measured with `git ls-files` vs. `git ls-files --others`:

| Untracked (this batch) | Already tracked (AFF2, merged 2026-08-23) |
|---|---|
| `359_patient_mode_and_narrative_rename.sql` | `359_profiles_dob_phone.sql` |
| `360_send_referral_requires_mrn.sql` | `360_credentials_hospital_admin_read.sql` |
| `361_backfill_mapping_replay.sql` | `361_list_org_people_dob.sql` |

The last un-collided number is `358`. Nothing is *lost* — `supabase test db` runs every file, so
the 215-file / 7,126-assertion count is real — but from the moment this commits, **"suite 359
§3.1" stops having a referent**, and that string appears in ADR 0137, the plan, both QA reviews
and the follow-up log. This project has the lesson already, from the `296` collision:
*"Check the directory before picking a number."* Renumber to `362`/`363`/`364` and update the
citations. ⚠ A rename changes the artifact the gate ran over, so `npm run test:db` must be
re-run afterwards (~1 min) — the count must come back **215f / 7,126t**.
⛔ I missed this in round 1; the collision was already present then.

**N-2 (required, one line of prose) — `FUP-0137-BULK-WIZARD-STILL-BOOLEAN` softens its own
finding.** The entry says the bulk path is safe because the DB "refuses the creation
server-side with the pt-BR message naming the fields". Measured, the user does **not** see that
message:

- `public.bulk_create_cases` re-raises per-row failures as `raise exception 'linha %: %', v_i,
  sqlerrm using errcode = sqlstate` — SQLSTATE preserved, so `HC0T1` arrives at the client.
- `src/lib/cases/bulk-error-map.ts:20-31` — `PT_BR_SQLSTATES` is
  `{23514, P0002, HC017, HC018, HC019, HC020, HC021, HC055, HC068, HC0F1}`. **`HC0T1` is not a
  member.** `mapBulkRpcError` therefore falls through to `GENERIC_ERROR`.

So the outcome is worse than the follow-up records: the coordinator fills a whole grid and is
then told *nothing specific at all*. ⛔ This is **not** a Rule-8 violation (the generic string is
pt-BR and readable) and **not** a compliance hole (the refusal is real and nothing is written),
so it is not blocking — but the follow-up must say what actually happens, and it should name the
one-line cause. Note also that `bulk_create_cases`'s own comment claims the preserved SQLSTATE
exists "so the action's `mapCaseError` … can map it", which is true of the single-case mapper
and false of the mapper this door actually reaches.

**N-3 (required, one line) — a comment in `patient-fields.tsx` states a measured-false
premise.** `:283-285` reads: *"The trigger is a `<button>`, which a wrapping `<label>` does NOT
name, so the name is supplied explicitly."* Measured in Chromium (N-4), a wrapping `<label>`
**does** name a `<button>` — it overrides the button's own content. The *action* is right (the
`aria-label` is needed to carry the `(obrigatório)` suffix, which the label span cannot supply
to a button whose name the label already fixes); the *reason* is wrong. This matters more than a
typo because the same file's sibling — the welded `mrn` checkbox — relies on exactly the
mechanism this comment denies, so anyone who believes it will conclude that control is unnamed.
Same class as C-4: a correct conclusion resting on a false premise.

**N-4 (method note, no action) — I nearly filed a false regression, and measuring killed it.**
Reasoning from the definitions, I concluded that adding `aria-label` to the `DatePicker` trigger
would *override* its text content — which is `formatDisplay(selectedDate)`, i.e. the chosen
date — and therefore strip the selected value from the accessible name on all three PHI
surfaces. I drove real Chromium against a minimal fixture and read the CDP accessibility tree:

```
role=button name="Data de nascimento"                 <- no aria-label, content "15/03/1980"
role=button name="Data de nascimento (obrigatório)"   <- with aria-label
role=checkbox name="Prontuário"                       <- wrapping <label> names a role=checkbox button
```

The wrapping `<label>` was **already** overriding the content before this batch. The value was
never in the accessible name; the change adds the `(obrigatório)` suffix and nothing else.
**No regression.** The pre-existing gap — the DOB trigger never announces the date the user
picked, on any of the three surfaces — is real, predates this batch, and is worth a follow-up
of its own rather than a change request here.

---

## 6. Follow-up fidelity — five of six are faithful; one softens (N-2)

I read all six bodies against what I found.

| Follow-up | Verdict |
|---|---|
| `-MRN-BLANKABLE-AFTER-SEND` | **Faithful, and better than my own write-up.** It keeps my "derived from the definitions, not driven" caveat *and* states that a pgTAP arm settles it in either direction. It does not upgrade a reasoned finding into a measured one. |
| `-FLUSH-FAILS-OPEN` | **Faithful.** It keeps the sharpest half — that a pre-existing fail-open became *reachable* because `HC0T4` raised the retry rate. |
| `-357-TWINS-ON-STALE-BODY` | **Faithful**, including the part reviewers usually drop: that `ARM=census` HOLDS is *not evidence about this function*, and that the orphaned backlog entry predates the batch. It is filed as a measurement to take, not a defect claim. |
| `-BULK-WIZARD-STILL-BOOLEAN` | **Softens — see N-2.** Right about severity class, wrong about what the user is told. |
| `-CASE-PATIENT-EDIT-NOT-MARKED` | **Faithful, and correctly bounded.** I verified the enforcement claim from the live body: `app._set_participant_patient_unchecked` calls `assert_patient_required_fields` on **every** write, including updates — so a coordinator genuinely cannot blank a required field on a `required`-mode case through the edit dialog. The gap is offer-vs-enforcement, exactly as stated. This is also why the case side has no analogue of `-MRN-BLANKABLE-AFTER-SEND`. |
| `-PERSIST-REFRESH-DROPS-FOCUS` | **Faithful, and the best of the six.** It states what it measured (real Tab keys, not inference), states what it does **not** claim (no D2 violation — the welded checkbox does keep its tab position), and scopes the fix by the property rather than by the file. |

**Three round-1 open risks were not filed anywhere and now live only in the round-1 review:**
R-3 (the swallowed resume PHI load turning a later flush into a silent PHI overwrite — the
mechanism is described inside `FUP-REFERRAL-REVIEW-STEP-MRN-WARNING`, but only as a
*warning-rendering* constraint, never as the overwrite hazard), R-6 (`KIND_VISUAL[ev.kind]` has
no runtime fallback and its comment over-claims — verified still true at
`case-events-timeline.tsx:386`), and R-7 (the body-error `role="alert"` is still a child of the
wrapping `<label>` at `:322-326`, so the textarea's accessible name mutates on validation
failure). None is blocking. All three should get a line, or an explicit PO ruling that they are
dropped — a risk that survives only inside a superseded review file is a risk that has been
deleted.

---

## 7. Conditions of this approval

None of these is a code change; all are commit-hygiene and record accuracy, and each was
measured, not inferred.

**C-a — renumber the three colliding pgTAP suites** to `362`/`363`/`364`, update the citations
in ADR 0137, the plan, both QA reviews and the follow-up log, and **re-run `npm run test:db`**
to confirm 215f / 7,126t. (N-1.)

**C-b — compact `PROGRESS.md` before the Record edit. This is now the tightest of the four,
and I hit it myself.** Measured, in sequence:

- Before my row: **81,660 bytes** against `SIZE_CAP = 80 * 1024 = **81,920**` → 260 bytes free
  (down from 773 at round 1).
- My QA-verdict row, written in the normal one-line house form, was **408 bytes** and **turned
  `lint:progress` RED** at 82,068. I trimmed it twice, to 235 bytes, to get the gate green again.
- After my row: **81,895 bytes — 25 bytes of headroom.**

⛔ So the Record edit — which adds a ledger row and rotates task detail — **cannot be written at
all** until the Case-Surface-Split compaction the round-1 review identified is done. This is no
longer a nicety scheduled for Record; it is a precondition of it. Note also what the squeeze
already cost: my verdict row now names the conditions only by a section pointer, because there
was no room for them.

**C-c — correct `FUP-0137-BULK-WIZARD-STILL-BOOLEAN`** to say that `HC0T1` is absent from
`PT_BR_SQLSTATES`, so the bulk path surfaces the *generic* pt-BR error and never names the
missing fields. (N-2.)

**C-d — correct the false premise at `patient-fields.tsx:283-285`.** (N-3.)

**Also still outstanding from round 1's R-10, unchanged:** the **Test Run Summary** table holds
only the two AFF2 rows, so a table whose stated retention is "the most recent gate only"
currently names a superseded gate; the out-of-batch `docs/decisions/0136-*.md` change should be
split out at commit time; and untracked `docs/design/temp/action_item_design/` needs a
commit-or-ignore decision.

---

## 8. Carried open risks (unchanged from round 1, none blocking)

R-1 / R-2 / R-8 are now filed as follow-ups and drop off this list. Still carried:

- **R-3, R-6, R-7** — see § 6; unfiled.
- **R-5's remainder.** `359` §8.1 is **still** the hard-coded six-name list with `count = 0`
  (re-read at `:417-425`) — trivially satisfied by a rename or a typo, and strictly weaker than
  the migration's own catalog-derived precheck. §8.2 (`= 3`) remains the right shape. Also
  unchanged: `361` §4 tests a *reproduction* of the migration's precheck rather than the
  precheck, and the minting doors' D3 check has no negative arm (low severity — the deferred
  trigger still enforces the invariant, only the friendlier error ordering is at stake).
- **The four ADR amendments the plan mandates** (D3's real enforcement point; the
  creation-time-only invariant; D5's mechanism inversion; D4's non-existent `save_referral_patient`
  floor). Scheduled for Record — still preconditions of it.
- **`BUG-CASEEVT-KIND-001`** stays open with D12's UI suppression as its only control.
- **The DOB trigger never announces the selected date** on any of the three PHI surfaces
  (N-4). Pre-existing; worth a follow-up.
- **The orphaned PHI participant chain** the spec's `afterAll` leaves in Farmácia (§ 4).

---

## 9. Could not verify

1. **The full `e2e:prod` gate, the pgTAP suite and the four authz arms** — the lead's, not
   re-run per the brief. I did confirm the two things that make the E2E figure meaningful
   without re-running it: the spec count matches (113), and `did-not-run` is 0, which is the
   field that answers "was anything swallowed?".
2. **`FUP-0137-MRN-BLANKABLE-AFTER-SEND`** remains reasoned-from-definition, not driven — same
   fixture obstacle as round 1. The follow-up records this honestly.
3. **Whether a screen reader announces "marcada, indisponível"** as the picker's docblock
   claims. I measured the accessibility *tree* (name, `aria-checked`, `aria-disabled`,
   `aria-describedby`), which is what the tree can tell me; the exact utterance is an
   AT-behaviour question I cannot settle from here.

---

## Verdict

C-1 is closed in the only way that would have counted: the three-mode picker is the sole channel
to `patient_mode = 'required'`, and the E2E proves it by putting the row into `required` with no
service-role write anywhere in the file. D2's welded `mrn` is `aria-disabled` on a control that
keeps its tab position, carries a real accessible name and a description, and refuses both a
forced click and a Space press — each pinned by an assertion that a plausible implementation
change would redden, with an in-test positive control so the pins cannot pass vacuously. D3
layer 3 marks the accessible name rather than a colour, and excludes the `unknown` sentinel the
DB counts as missing. C-2 adds a real subject to a real lockdown query. C-3's `7.1a` reddens
under both neutralizations of the guard's second arm. C-4 is corrected in the ADR and in both
comments, with the correct `ADR 0064 D4` citation left standing.

The four conditions in § 7 are a rename, a size compaction and two sentences of prose. None of
them touches behaviour, and none of them is worth a third round.

**APPROVED**

# Backend State — cases, referrals and ethics

> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)** — it routes you to the one
> file you need, and carries the maintenance rules in full.
>
> This is a **map, not the authority.** `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. **`prosecdef`**, `pg_policies`, `pg_constraint`, `pg_trigger`, the
> ACLs). ⚠ **Not the migration files** — some rewrite live function bodies at runtime, so their
> text is stale by design (CLAUDE.md § graphify).
>
> ⛔ **A posted section is frozen.** Corrections are APPENDED, never edited into the statement they
> correct, and a correction leaves a forward marker at the statement it supersedes: a
> `⚠ **Superseded** — …` line directly under that heading, naming where the correction lives.
>
> ⛔ **A new phase EXTENDS its seam file.** It never opens a phase-named file, and the fix for an
> over-cap file is never to raise the cap nor to delete a posted section.

⚠ **REFNOTE (2026-08-12) lives in [`document-model.md`](document-model.md) § END STATE**, not here: the 23 referral doors that stopped returning a table row type (`case_referral_public` / `referral_internal_note_public` / `referral_message_public`) and the `app._project_*` allowlist projection. Read it before touching any referral RPC's return value.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below. Replace this block in
place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the
generated registries; the live catalog is the authority (ADR 0078).

### Surface

- **Cases and their children** — `cases` carries `organization_id` (denormalized, drift-guarded), a nullable `case_type_id`,
  and `visibility_policy` (`commission_default` | `explicit_grants_only`) + `confidentiality_level` (the ONE shared
  taxonomy), both snapshotted at create; `template_version_id` is **nullable, `ON DELETE RESTRICT`** and `template_id` is
  gone. Children: `case_phases` (`assignment_role_id`), `case_narratives` (label column **`display_label`**), `case_events`
  (`kind` + `visibility ∈ case_readers | coordinator_only`), plus the phase-result / offered-outcome / custom-field tables.
- **Process templates are an IDENTITY with VERSIONS** — `process_templates` holds `id`, `commission_id`, `created_by`,
  `created_at`, `updated_at` and **nothing else**; title, description, `status`, `case_type_id` and the patient-collection
  config live on `process_template_versions`, and the child tables re-key `template_id → template_version_id`.
- **Participants — a typed-identity registry** — `participants` **holds no payload** (a patient's `display_name` is the
  surrogate `'Paciente'`), with subtypes `patient_participants` / `professional_participants` composite-FK-and-CHECK-pinned
  to the type, linked by `case_participants`; vocabulary in `case_participant_roles`, `case_types`, `case_type_terminology`.
- **PHI-bearing stores** — case patient identifiers live in **`patient_identifiers`**, keyed on `participant_id` (N per
  case), all DML REVOKED and door-only. Referral PHI is column-REVOKED from `authenticated`
  (`referral_resolutions.summary_md`, `referral_internal_notes.body_md`). `professional_profiles` is the **Class-2
  professional-identity** relation — a column-list grant with **no table-level `authenticated` SELECT**, whose `cpf` is a
  *different* column from the person key.
- **Ethics and referral governance** — the procedure tables (`ethics_case_details`, `ethics_allegations`, `ethics_findings`,
  `case_decisions`, `ethics_decision_details`, `case_votes`, `ethics_notifications`, `ethics_hearings`, `ethics_appeals`)
  over the access spine (`case_conflict_declarations`, `case_recusals`, the interview trio); referrals add
  requested-actions, resolutions, assignments, case-links, internal notes and read receipts over `case_referral`.
- **Doors** — signatures, `prosecdef` and EXECUTE grants: [`generated-rpc-surface.md`](generated-rpc-surface.md) ·
  [`generated-helper-surface.md`](generated-helper-surface.md). ⚠ Referral doors' RETURN VALUES are governed by the REFNOTE
  in [`document-model.md`](document-model.md) § END STATE, not here.

### Invariants

- ⛔ **`case_patient` is a FLAG KEY, not a table.** It is the feature-flag key and the name of the predicate
  `app.can_read_case_patient`; the store is `patient_identifiers(participant_id)`. The re-key changed **cardinality and key
  only** — the flag, the gate and the posture were PRESERVED.
- **Content reach is not PHI reach.** `app.can_read_case_patient` is a bare PHI-bit test with no lattice closure, and the
  commission-wide `administrativo` case arm confers **`read_case_content` only** — no write bits, no PHI bits, no
  lifecycle. Widening content reach must not widen PHI.
- **The case module is no longer single-door on the WRITE side** — one writer body, two gates. The coordinator-gated
  DEFINER `public.set_participant_patient` and the creation RPCs both reach
  `app._set_participant_patient_unchecked`, so creation scope is **structural** (no other caller exists), not
  predicate-based. ⛔ That helper is `SECURITY INVOKER` **deliberately** — the second lock behind the ACL; do not flip it to
  satisfy a `prosecdef` assertion. **No PHI travels back**: no return type changed, and the action returns field names only.
- **The case read predicate is reused VERBATIM.** Each ethics-procedure table's single SELECT policy is `can_read_case`,
  and `can_read_case` / `can_read_case_patient` / `can_write_case_content` each evaluate the respondent and recusal
  hard-denies **FIRST, before every grant arm** — so a respondent who is *also* staff_admin, grant-holder or QPS operator
  is still denied.
- ⚠ **A correct predicate does not make the policies consuming it correct.** The spine shipped a correct predicate and
  still leaked three ways: an admin arm ORed **outside** the DEFINER; a `FOR ALL` write policy with a bare admin `USING`
  and no case predicate; a table keyed only on another dimension. Assert at the **policy** layer with a real `select`
  under `set local role authenticated`, never on the predicate.
- **Member-facing reach ≠ `can_read_case`**, which has **no plain-member arm by design**. Use
  `can_reach_case_on_member_surface` on the board / Meus Casos / meeting-label surfaces; gating one of them on
  `can_read_case` silently deletes ordinary members' reach of ordinary cases.
- **Template identity/version split.** Partial uniques allow at most one `draft` and one `published` version per template;
  status transitions are **trigger-enforced, not door-enforced**; DELETE is refused for **published AND archived** versions
  — deliberately stronger than the form-version guard, which blocks only `published`.
- **`patient_mode` replaced the booleans.** `collects_patient` and `cases.patient_enabled` are DROPPED in favour of
  `patient_mode` (`none` | `optional` | `required`) plus `patient_required_fields`; the immutability guard fires on
  **either** changing, closing the "insert `none`, then UPDATE to `required`" hole. ⛔ Any doc, comment or query still
  naming the booleans is stale.
- **The MRN floor is at SEND, not at SAVE** — `send_referral` carries it, `save_referral_patient` deliberately does not, and the status guard makes `send_referral` the sole transition authority, so the floor is reachable.
- **Assignment ≠ access; link ≠ access.** `referral_assignments` and `referral_case_links` appear in **no** read predicate.
  `referral_internal_notes` carries **no table-level `authenticated` ACL** — every readable column needs its OWN
  `GRANT SELECT (col)`, and the absence of one on `body_md` *is* the hardening.

### Rollout

- Flags over this seam: `case_patient`, `case_participants`, `case_types`, `ethics`, `case_referrals`, and the
  delegated-capability `administrativo`. ⛔ Resolve each flag's VALUE and its readers from
  [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here. `case_access` is retired.
- The commission-wide administrativo case read added **NO new flag — it rides `administrativo`**; the template identity/version split and the participant-seating work are structural with no flag; the MRN-erasure-key batch has **no flag — the migrations ARE the cutover**.
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the remote is a claim
  about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- ⚠ **Authz-sweep coverage of the case write surface is vacuous, not clean.** The scalar non-bool command doors, the `app`
  INVOKER writers and the `member_can*` pair sit outside every ARM's domain, so a diff-scoped sweep over them runs zero
  cases and prints the line a clean run prints. Coverage is the targeted mutation twins; the objects are listed in
  `supabase/tests/mutation/authz-unswept-backlog.txt`, where the `app` INVOKER writers carry a **DO NOT PRUNE** note.
- **Class-2 audit posture is unratified** — `searchParticipants` is an invoker-rights read that cannot be audited through
  RLS and the org-manager arm widened its population, so "case-scoped RLS + audited reads" no longer fully holds; also
  unratified are the participant types that are mintable but have no seeded role.
- **Two non-case reach paths, upheld as another module's design:** the `assignees_only` arm of action items, and `patient_safety_event`, whose read predicate has **no case arm by design**.
- **Grant-layer residue.** The `TRUNCATE / TRIGGER / REFERENCES` revoke covered the audited case cluster only; the
  platform-wide sweep is deliberately not done — enumerate residuals from `information_schema.role_table_grants`. Some
  re-created policies bind role `public` rather than `authenticated` (enumerate from `pg_policies`); verified inert.
- Seating-panel accessibility (`aria-describedby` never wired to error ids, no live region on the typeahead popup) is open; the register is [`../followups/follow-ups-open.md`](../followups/follow-ups-open.md).

### Where the detail lives

- The frozen slices below, in file order: **§ ADR 0137 batch** · **§ Case surface split — Increment 2** · **§ ETH·E4** · **§ PCI + TV** · **§ F1** · **§ E1** · **§ E2** · **§ RV2**.
- ADR [0038](../decisions/0038-case-patient-identifiers.md) (case patient identifiers) · [0064](../decisions/0064-case-subject-generalization-participants.md) (participant generalization) · [0072](../decisions/0072-ethics-access-spine.md) (access spine) · [0073](../decisions/0073-ethics-procedure-model.md) (ethics procedure) · [0096](../decisions/0096-process-template-versioning.md) (template versioning).
- ADR [0108](../decisions/0108-eth-e4-participant-seating.md) (seating, professional identity) · [0134](../decisions/0134-case-surface-split-and-administrativo-case-read.md) (case surface split) · [0137](../decisions/0137-mrn-erasure-key-and-case-referral-usability-batch.md) (MRN as erasure key) · [0037](../decisions/0037-inter-committee-case-referrals.md) (referrals) · [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (door blindness).

## ADR 0137 batch — MRN as erasure key; case/referral usability (2026-08-24; ADR **0137**; migrations `20261003001300`–`…001600`, **4**; pgTAP `362` `plan(58)` · `363` `plan(15)` · `364` `plan(14)`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ✅ **PUSHED 2026-08-25**

**The booleans are GONE.** `process_template_versions.collects_patient` and `cases.patient_enabled` are
**DROPPED**, replaced by **`patient_mode text`** (`none` | `optional` | `required`, CHECK-constrained) plus
**`patient_required_fields text[]`**. ⛔ **Any doc, comment or query still naming the booleans is stale** —
including `docs/backend-state.md:326`'s reference to the old door name.

**Door renamed:** `set_template_collects_patient` → **`set_template_patient_mode`** (same authority pair as
its sibling `set_template_case_type`: `is_staff_admin_of or is_tenancy_admin_of`, **draft-only** — verified,
not a widening).

**Column renamed:** `case_narratives.type_label` → **`display_label`** (a real `alter table … rename`, with
seven bodies re-emitted). ⛔ **Two look-alikes were deliberately NOT renamed and must stay:**
`case_referral.type_label` (a *different* column on a *different* table — three referral bodies still
reference it, correctly) and `add_ad_hoc_narrative`'s **parameter** `p_new_type_label` (excluded by the
re-emission's `mtype_labelM` word boundaries, since `_` is a word character). A string-level sweep here
is wrong by construction; bound it by the table.

**New / changed routines:** `app.patient_required_missing` (returns the missing set, **not** a boolean —
and it counts `sex = 'unknown'` as MISSING) · `app.assert_patient_required_fields` ·
`app.guard_case_patient_required` · **`app.guard_case_patient_mode_immutable`** (fires on `patient_mode`
**OR** `patient_required_fields` changing — the second arm is what closes the "insert `none`, then UPDATE to
`required`" hole, pinned by `362` §7.1a) · `public.set_case_narrative_assignment_role` ·
`public.send_referral` gains the **`HC0T4`** MRN floor.

⭐ **D4's floor is at SEND, not at SAVE.** `send_referral` carries it; `save_referral_patient` deliberately
does **not**, and `app.guard_referral_status` makes `send_referral` the sole transition authority — so the
guard is reachable rather than merely present. Moving it to save would break D4.

⭐ **D3's enforcement point is `app._set_participant_patient_unchecked`** (`prosecdef = f`), so **both** case
write doors inherit it — which matters because the case module is **no longer single-door on the WRITE
side** (one writer body, two gates: the coordinator door and the creation path). ⚠ That function is
non-boolean and lives in `app`, so it is **outside every authz ARM's domain**: `ARM=census` HOLDING is not
evidence about it. Its real coverage is suite `357`'s mutation twins — see
`FUP-0137-357-TWINS-ON-STALE-BODY`, filed because those twins red-proved the **pre-0137** body.

⚠ **Diff-scoped door sweep NOT TRIGGERED — a measured empty** (0 policy statements, 0 boolean-returning
functions across all four migrations), **not** a clean sweep. An empty domain and a clean sweep print
identically.

⛔ **`patient_mode = 'required'` was unreachable from the product until 2026-08-24.** The column, the
CHECK and 7,125 pgTAP assertions all supported it, but pgTAP reaches it **as `postgres`, by direct
INSERT** — no UI could set it and no E2E ever drove it. Now built (`PatientModePicker`) and covered
(`e2e/patient-mode-required.spec.ts`). The general form: **a value a CHECK admits and no product path
writes is an orphan, and every reader of it is unexercised by construction.**


## Case surface split — Increment 2 (2026-08-22; ADR **0134** D6 + Amendments 1/2/4/5/6; migrations `20261003000400`–`…00700`, **4**; pgTAP `205` `plan(67)` · `356` `plan(72)` · `357` `plan(35)` · `189` `plan(43)`; **NO new flag** — rides `administrativo`, permanently ON)

Re-derive every row from the catalog; this is a map, not the authority. **⛔ For SQL the live
catalog is the sole truth** — and two of these migrations rewrite bodies derived from
`pg_get_functiondef`, so the files are stale by design.

### The `administrativo` capability vocabulary is now FIVE

`read_cases` joins `schedule_meetings` / `create_cases` / `assign_case_phases` / `view_signoffs`.
The allowed set is enforced in **exactly two** catalog places and described in a third:

| # | where | enforces? |
| --- | --- | --- |
| 1 | CHECK `commission_administrativo_capabilities_capability_check` | **yes** |
| 2 | `public.grant_member_capability`'s `not in (...)` whitelist | **yes** |
| 3 | `app.feature_flags` row `key='administrativo'`, column `description` | no — prose |

⚠ `public.revoke_member_capability` has **NO** whitelist (it deletes by equality, so an unknown
literal is a silent no-op). ⛔ **The two validators share errcode 23514**: delete the RPC whitelist
and the INSERT trips the CHECK underneath, raising 23514 anyway — so an errcode-only `throws_ok`
on the door is GREEN with the validator gone. `205` § (VOC) pins the **pt-BR message**. There are
**five** hand-lists of this vocabulary outside the DB (three TS, one test, one in `seed.sql`) and
⛔ **`gen:types` is structurally blind to all of them** — the column is `text` + CHECK, so
`database.ts` types it `string`.

**Appointing now GRANTS `read_cases`** (Amdt 5). `public.appoint_administrativo` inserts the row
attributed to the appointing coordinator, guarded on `GET DIAGNOSTICS row_count > 0` from the
appointment's `on conflict do nothing` — so **re-appointing an existing appointee grants nothing**
(Amdt 1 §A1.1's no-backfill ruling still governs them), while re-appointing **after a revoke** does,
because the FK cascade emptied the set and the appointment is genuinely new. Both directions pinned.

### `app.member_can_for` is the single implementation; `member_can` delegates

⛔ **`app.member_can` resolves `auth.uid()` and takes no uid.** `app._case_caps(p_case_id, p_uid)`
is a **(case, uid)** resolver whose callers routinely ask about a THIRD party, so the bare form
would answer about the CALLER — dark wherever `auth.uid()` is null, and setting
content-without-deliberation for a non-member `p_uid`, which is `app.is_oversight_only_reader`'s
exact bit shape. Amendment 6 added the missing `_for` twin; `member_can` is now
`select app.member_can_for(p_commission_id, p_capability, auth.uid())`. **One body, not two** —
pinned from the catalog (`356` §2): exactly ONE `app` routine may carry both
`feature_enabled('administrativo')` and `commission_administrativo_capabilities`.

⚠ **The predicate has THREE independent terms, not four.** Deleting `is_active(p_user_id)` alone
leaves the suite fully green, because `is_member_of_for` already contains it. Measured, not read.
A sweep asserting `is_active` is PRESENT would pass on a body where it had been deleted.

### `app._case_caps` gained arm **S8** — administrativo commission-wide case READ

`if not v_eg and app.member_can_for(v_commission, 'read_cases', p_uid)` → **`read_case_content`
only**. Positioned after S7, so it inherits STEP-4's hard denies BY POSITION as S5/S7 do. Bounded
by `not v_eg` (Amdt 4): an `explicit_grants_only` case is invisible to the arm; reach there rides an
explicit grant (S3) or nothing. ⛔ **The bound is the half nothing in the gate set can see** —
proven only by the P9-twin mutation, which also reddens the locked-case bit-shape pins.
No write bits, no PHI bits (structural: `can_read_case_patient` is a bare bit-8 test with no lattice
closure, and only S1/S3 set it), no `view_case_overview`, no lifecycle.

### Case PHI gained a **creation-scoped write path** — the first not held by a coordinator

`public.set_participant_patient` was **split at its authority cut**:

| object | shape | authority |
| --- | --- | --- |
| `public.set_participant_patient` | DEFINER, signature/ACL/SQLSTATEs unchanged | coordinator gate + `assert_not_case_excluded`, then delegates |
| `app._set_participant_patient_unchecked` | **INVOKER**, `proacl {postgres=X/postgres}` | **none, by design** |

The three creation RPCs call the helper directly, so **creation-scope is STRUCTURAL** — no other
caller exists, pinned by property (`357` §1), currently **4** callers.

⛔ **THE HELPER IS `SECURITY INVOKER` DELIBERATELY — DO NOT FLIP IT.** Measured, both cells, with
EXECUTE granted to `authenticated` and called as `authenticated`: **INVOKER is REFUSED**
(`permission denied for table patient_participants`; the mint path hits `case_participant_roles`'
RLS first — different lock, same verdict), **DEFINER SUCCEEDS**. On the intended path the two are
identical; the difference appears only if the ACL leaks, and there INVOKER is the second lock.
`276` **O5 asserts the PROPERTY** ("no invoker-rights path in"), not the `prosecdef` proxy, and
**O5b bounds the exception by name** so a hatch written for one case cannot silence the next. The
rationale is also a `COMMENT ON FUNCTION`, i.e. in the catalog, where `\df+` shows it.

⚠ `321` **K8**'s name-keyed writer array swapped `public.set_participant_patient` →
`app._set_participant_patient_unchecked`. **A SWAP, not a growth** — the set is still three.

**`p_patient jsonb` on both single-case doors.** `CREATE OR REPLACE` cannot add a parameter (it
creates an overload PostgREST 300s on), so both were `DROP FUNCTION` (⛔ **no CASCADE**) + `CREATE`,
with ACLs re-issued and verified from the catalog. This also removed M10's half-state at **both** TS
sites: the case and its identifiers are now one call. ⛔ **No PHI travels back** — neither return
type changed (`cases` carries zero identifier-shaped columns), and the action returns **field names
only**. ⚠ A DROP+CREATE also breaks any caller naming the **old arity** in a signature string; that
fails as a **plan-mismatch ABORT** in an unrelated file (see `FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE`).

### `public.bulk_create_cases` — TWO keys, and `all_phases` refused AT THE GATE

Gate: `is_staff_admin_of ∨ (member_can('create_cases') ∧ member_can('assign_case_phases'))`.
⛔ **Widening bulk's own gate is NOT sufficient and that was measured**: bulk is a COMPOSITION —
step (b) `activate_phase` needs `assign_case_phases`, and step (c) `assign_narrative` is
`is_staff_admin_of` **ONLY, with no capability arm at all**. So `all_phases` can never be satisfied
by a delegate and is refused **before the advisory lock and before any row is minted**, with its own
pt-BR message naming the scope — an honest refusal before work, rather than a 200-row rollback.
⛔ **No `is_admin()` disjunct and no tenancy arm** (`314` §11.34 is a catalog assertion forbidding it).

### ⚠ Authz-sweep coverage of this surface — state it before quoting a green ARM

**Every object this increment changed sits OUTSIDE every ARM's domain**, so all four ARMs held
**vacuously** with respect to it:

| object | why it is out of domain |
| --- | --- |
| `bulk_create_cases`, `create_case`, `create_case_from_template`, `set_participant_patient` | `prosecdef` **scalar non-bool** command doors — the census's own named exclusion (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, 407 reachable) |
| `app._set_participant_patient_unchecked` | `app` INVOKER; the invoker arm is bounded by `nspname='public'` |
| `app.member_can`, `app.member_can_for` | the door audit's predicate arm filters on a NAME PREFIX `^(is_\|can_\|has_\|…)`; `member_can*` matches none |

A diff-scoped sweep over exactly these runs **ZERO cases** and prints `BLIND: 0` — the same line a
clean run prints. Coverage comes from the **targeted mutation twins** in `356`/`357`/`189`, not from
any sweep. All are recorded in `authz-unswept-backlog.txt`; ⛔ the two `app` INVOKER writers carry a
**DO NOT PRUNE** note there, because `ARM=census` actively advises deleting them.

## ETH·E4 — Ethics participant seating & professional identity (2026-08-11; ADR 0108 D1–D8 + the D5 amendment; migrations `20260919000100`–`…000600`; **NO flag — the seating panel was already mounted and unfillable**)

Closes **FUP-ETH-1** (nothing could seat a professional — "Médico denunciado" was an unfillable
panel) and **FUP-FF5-2**. Everything below is **catalog-derived, 2026-08-11** — re-derive before
trusting it.

### New / changed doors (from `pg_proc`, not the migrations)

| Door | secdef · returns | Notes |
| --- | --- | --- |
| `public.ensure_professional_participant(p_profile_id uuid)` | **DEFINER** · `uuid` | **NEW.** Get-or-create of the `participants` registry row for an existing `professional_profiles` row — a profile has **no registry identity until first seated**. Gated `HC0E4` (coordinator / org admin). Targeted `on conflict` against `professional_participants_profile_uniq` + an orphan-deleting race arm. ⚠ **Not** the same door as `create_professional_profile`, which is a **bare INSERT** with no lookup — the get-or-create one is this. |
| `public.create_external_participant(p_org uuid, p_type text, p_display_name text)` | **DEFINER** · `uuid` | **NEW.** Create-**always** (no get-or-create) for the five non-sensitive external types. Gated `HC0E4`; `check_violation` on a bad type / blank name — both pre-empted server-side before the RPC. |
| `public.set_primary_subject(p_case_participant_id uuid)` | **DEFINER** · `void` | **`create or replace`d.** Was **set-only** (a 2nd set raised `HC0E7`); now **MOVE** semantics + it re-runs the linkage assert. Property-diffed from the catalog before vs after — `prosecdef`, `proconfig`, `proacl` (incl. entry order), `provolatile`, `proleakproof`, language, result type, args, owner all **IDENTICAL**. Removed from the never-called allowlist (it now has callers). |
| `app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)` | **DEFINER** · `boolean` | **`create or replace`d** — gains the **D5 org-manager disjunct**. Without it the picker is unusable: the predicate previously resolved true only for a platform admin or for a professional **already seated** on a readable case. Property-diffed identically. Keystone K3a reds if the arm is reverted (QA proved it). |
| `public.get_case_professional(p_participant_id uuid)` | **DEFINER** · `jsonb` | **The P0 fix lives here.** Returns an explicit `jsonb_build_object` of **exactly the 12 granted columns** — *not* `to_jsonb(v_profile)`. ⚠ A DEFINER **bypasses the column grant**, so the grant alone leaks; both halves are load-bearing and that was **measured**, not argued. Calls `log_audit_access('professional_profile.read', …)`. |
| `app.audit_case_type_terminology()` | **DEFINER** · `trigger` | **NEW.** `trg_audit_case_type_terminology` — `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` on `case_type_terminology`. The table had **no trigger and no writer** before T5; the plan's "frontend-only, no substrate work" was true for authorization and **false for auditability** (Rule 11). |

All four `authenticated`-callable doors carry `authenticated=X/postgres`. ⛔ **Never cite
`ARM=census` as coverage for the three write doors** — its live domain is `bool`/set-returning, and
these return `uuid`/`void`, so it HOLDS *because they are invisible to it* (ADR 0079 Amendment 5,
FUP-AFF-1). Their coverage is the neutralization oracle, now standing in
`p0-authz-writepath-audit.sh` ARM 1 (**COVERED**, keystones named).

### ⚠ `professional_profiles` is on a COLUMN-LIST grant — 12 of 17

⛔ **THIS IS A DIFFERENT `cpf` FROM THE PERSON KEY, AND AE3 DID NOT TOUCH IT.**
`professional_profiles.cpf` is the **Class-2 professional-identity** column (ADR 0064/0065); the
person key moved to `profile_private_details` in AE3. After AE3, *"CPF lives in one place"* is
**false** — two relations carry one, under different regimes, and a sweep or a data-subject
request that assumes otherwise under-discharges. Re-verified unchanged 2026-08-31:
`has_column_privilege('authenticated', …, 'cpf', 'SELECT')` is still **false** here, and this
table keeps its column-list withholding (which `profiles` no longer has).

There is **no table-level SELECT for `authenticated`**. Revoked: **`cpf`, `redacted_by`,
`retention_pin_reason`, `retention_pinned_at`, `user_id`**.

This closed a **P0 disclosure**: `app.trg_pin_respondent_retention` is the sole writer of
`retention_pinned_at`/`retention_pin_reason`, fires on `case_decisions → 'issued'` for a seated
`respondent_doctor`, and those columns sat in a table-wide grant — so a sibling-commission
`staff_admin` with **no case access** could read a named doctor's `full_name` + `cpf` +
`retention_pin_reason` and learn of **a disclosed ethics proceeding**. ETH·E4 opened the write and
widened the read together.

- **`redacted_at` is deliberately KEPT** in the grant — `searchParticipants` filters on it and
  PostgREST requires SELECT on a filtered column.
- **Suite 321 pins projection ≡ grant with `set_eq`**, so a column added to one reds until added to
  the other. Verified in **both** directions (grant a revoked column back → RED; revoke a projected
  one → RED).
- ⚠ **Residual, by design:** the retention *fact* is still reachable through `audit_log` for an
  **`org_admin`** (`audit_log_select`'s org arm) — a sibling `staff_admin` sees 0 rows. That is the
  designed oversight posture, not a gap. ⚠ **The org arm's REACH widened on 2026-08-25** (AUD1 / ADR
  0149, migration `20261003003000`): it now also admits **hospital-tier** rows of the org. See
  § *Audit read legs (AUD1 · ADR 0149 / 0150)* below — the posture is unchanged, the population is larger.

### App layer

- `src/lib/queries/participants.ts` — invoker-rights, RLS-scoped search for **both** lanes; never a
  DEFINER search door (ADR 0091 D3). Also holds `listCaseParticipantRolesForAdmin` +
  `CaseParticipantRoleAdminRow` (moved here from `lib/vocabulary/actions.ts` at r3 — a pure read
  does not belong in a `'use server'` module, where **every export is a callable Server-Action
  endpoint**; that one alone never called `authorizeOrg`).
- `src/lib/participants/actions.ts` — all 7 previously-stubbed actions + `createExternalParticipant`.
  ⚠ **Its error mapper encodes a measured rule, do not "simplify" it:** pass `error.message` through
  **only** where the SQLSTATE cannot also originate in the engine — the custom `HC*` codes, and
  `P0002` (six doors raise it in pt-BR; `public`/`app` contain zero `SELECT … INTO STRICT`).
  **`42501` and `23514` are MIXED** — ours raise them in pt-BR *and* the engine raises them in
  English on the same code — so both return the constant. A QA round filed the opposite and its
  remedy would have been a regression.
- `src/lib/vocabulary/actions.ts` — T5 org vocabulary admin (`case_participant_roles`,
  `case_type_terminology`). Already followed the same error rule.
- ✅ **CLOSED at AE2.4** — `src/lib/queries/members.ts` `listLinkableOrgUsers`. This read *"anchors
  on `profiles.home_organization_id`, which **ADR 0097 (AFF) made insufficient** … Tracked, not
  fixed."* The org predicate is now `public.list_linkable_org_users`, a **SECURITY INVOKER** RPC
  whose org filter is an **ACTIVE `organization_affiliations`** row (ADR 0164 D4, shape C-b'); the
  column is gone. ⚠ **Being INVOKER is the load-bearing part** — the door replaces *only* the org
  predicate, so a `staff_admin` still reads through their own RLS perimeter (the
  `profiles_select_self_or_admin` co-membership arm), intersected with the org. That residual
  narrowness is **deliberate, not the old gap**: ⛔ widening `organization_affiliations_select` to
  fix this read (option C-a) is **REJECTED and must not be re-proposed** (pinned by pgTAP `395` §0.7).

### Known-open at hand-off

- **FUP-ETH-A11Y-1** — `aria-describedby` never wired to error ids; the typeahead popup has no live
  region. Needs a coordinated tester-owned spec change (both routes collide with `pickFromTypeahead`).
- **PO decisions, unratified:** the Class-2 audit posture after D5 (`searchParticipants`'s
  invoker-rights read cannot be audited through RLS, and D5 widened its population to every org
  manager — ADR 0064/0065's "case-scoped RLS + audited reads" no longer fully holds); and
  `department` / `institution` / `other`, which are **mintable but have no seeded role**
  (catalog-confirmed) — the UI names the state ("Nenhum papel cadastrado aceita este tipo de
  participante") rather than dead-ending silently, so this is a seeding choice, not a defect.
- **Remote push drift — MEASURED 2026-08-12 against `azkbbhskturikxpgmafq`: exactly 2.** 356 local
  migration files vs **354** registered in `supabase_migrations.schema_migrations`; remote max is
  `20260919010000`, and the only local files above it are the REG·KIND pair
  `20260920000100_case_events_update_follow_up_kinds` + `20260920000200_referral_registros_shared_kind_vocabulary`.
  ACT (`…003000`/`…003100`), ETH·E4 (6) and RDR (`20260919010000`) **are all on the remote**.
  ⚠ **This corrects a ledger that claimed 11.** The removed *Remaining pre-pilot work* deploy row
  derived its drift by subtracting a **2026-08-10 baseline of 345** from the local file count,
  assuming nothing had been pushed since. Nine had been. A drift number computed from a remembered
  baseline is a guess; count `schema_migrations` instead. ✅ **SUPERSEDED SAME DAY — the REG·KIND
  pair WAS pushed 2026-08-12**, so this drift is now **zero**; both `20260920000100` and
  `…000200` are registered on the linked project and `referral_note_types` is absent from the
  remote catalog (`docs/progress/phase-status-archive.md` § 22-v3). The pre-push read the next
  paragraph asks for was **performed**. ⚠ The "ungated" note is also spent: REG·KIND's gate 3 was
  discharged by the 2026-08-12 QA review (`docs/reviews/fup-batch-2026-08-12-review.md`, APPROVED
  r1) and gate 2 by the 2026-08-24 full `e2e:prod` GREEN at `77b0a467`, which contains the merge.
  ⛔ **Re-measure, never quote** — this bullet is kept only because its drift-arithmetic lesson
  (count `schema_migrations`, never subtract a remembered baseline) outlives its figures.
- ~~**Before any remote `db push`:** the duplicate check on
  `professional_participants.professional_profile_id` (plan §6 step 3).~~ **CLOSED 2026-08-12** —
  the ETH·E4 batch `20260919000100`–`…000600` is already registered on the remote and
  `professional_participants_profile_uniq` exists in `pg_indexes`. The index **built against live
  data**, which proves absence of duplicates more strongly than the pre-check ever could; a
  confirming read returned 0 duplicate groups (non-vacuous — 1 row, 1 non-null id, 0 nulls).
  ⚠ The general lesson still stands for the **next** push: a local `count=1` on a fresh reset is
  true by construction of the fixture and proves nothing about a data-bearing remote. ~~The two
  unpushed REG·KIND migrations (`20260920000100`, `…000200`) … need their own pre-push read.~~
  ✅ **DONE 2026-08-12** — both are registered on the remote and the re-key landed; nothing about
  REG·KIND is unpushed.


## PCI + TV — Process-case integrity + template identity/version split (2026-08-05; ADR 0096; migrations `20260906000100`–`…001100` (PCI) · `20260907000100`–`…001200` (TV); NO flag, structural)

**A process template is now an IDENTITY with VERSIONS.** `process_templates` holds
`id`, `commission_id`, `created_by`, `created_at`, `updated_at` — nothing else.
⚠ **It has no `status`, `title`, `description`, `collects_patient` or `case_type_id`
column any more**; all five moved to `process_template_versions`, which also carries
`version_number`, `published_at` and `status ∈ {draft, published, archived}`. A
template is "archived" only as a derived fact: **all** its versions are archived.

**Invariants (from `pg_constraint` / `pg_indexes`):**
- `process_template_versions_one_draft_idx` — partial UNIQUE `(template_id) WHERE status='draft'`
- `process_template_versions_one_published_idx` — partial UNIQUE `(template_id) WHERE status='published'`
- `…_template_id_version_number_key` UNIQUE `(template_id, version_number)`; `version_number >= 1`; `btrim(title) <> ''`
- `template_id → process_templates ON DELETE CASCADE`; `case_type_id → case_types ON DELETE SET NULL`
- Four child tables re-key `template_id → template_version_id` (`ON DELETE CASCADE`),
  each with a version-grain unique: phases `(template_version_id, position)`,
  narratives `(template_version_id, display_position)`, outcomes PK
  `(template_version_id, outcome_id)`, custom fields `(template_version_id, key)`.
- `cases.template_version_id` — **nullable**, `ON DELETE RESTRICT`. Nullable because
  processless cases exist; RESTRICT because the version a case was minted from is the
  historical record a surveyor asks about. `cases` no longer carries `template_id`.

### Doors (verified against `pg_proc`, not the migrations)

| Door | secdef | Notes |
| --- | --- | --- |
| `clone_template_version(p_source_version_id)` | invoker | **Idempotent**: returns the existing draft if one exists rather than erroring. Copies title/description/`collects_patient`/`case_type_id`, then `app.copy_template_version_children`. The RLS-gated INSERT is the authority proof; the owner-run helper re-checks. |
| `publish_template_version(p_template_version_id)` | invoker | Draft-only; requires ≥1 phase (**HC016**); re-validates every `recommend_when` + every result-emitting phase; archives the current published version, then publishes. |
| `publish_process_template(p_template_id)` | invoker | **Thin wrapper** — resolves `app.draft_version_of_template` then delegates. No draft ⇒ `check_violation`. |
| `archive_process_template(p_template_id)` | invoker | **New semantics**: archives EVERY non-archived version. Missing ⇒ `no_data_found`; nothing to archive ⇒ **HC023**; RLS refused the write ⇒ `insufficient_privilege` (the pre-read proves visibility, so a 0-row UPDATE can only be the write policy). |
| `discard_template_draft(p_template_version_id)` | invoker | Draft-only by construction — the guard makes published/archived versions undeletable. |
| `draft_version_of_template(p_template_id)` | invoker STABLE | `public` mirror of `app.draft_version_of_template`. |
| `create_case_from_template` · `bulk_create_cases` | **DEFINER** | Both still take a **template id** and resolve the version internally via `app.published_version_of_template`. Signatures unchanged for callers. |
| phase / narrative / outcome / custom-field setters | mixed | Now take `p_template_version_id`. Draft-only, enforced by the trigger below rather than per-door. |

**Status transitions are trigger-enforced, not door-enforced.**
`app.guard_published_template_version` (BEFORE DELETE OR UPDATE) is the authority:
a status change is refused unless the GUC `app.in_template_publish_rpc` is `'on'`
(only the publish/archive RPCs set it); a non-status update is refused once the
version is not a draft; and **DELETE is refused for both published AND archived**
versions — deliberately stronger than the form-version guard, which blocks only
`published`.

**Commission resolution is now multi-hop** — the re-key removed the child tables' FK
to `process_templates`, so a one-hop embed no longer resolves:
- `app.commission_of_template_version` — 2 hops (version → identity)
- `app.commission_of_template_phase` — **3 hops** (phase → version → identity)
- `app.commission_of_template` — unchanged, 1 hop
- TS twins in `src/lib/case-narratives/actions.ts`: `commissionOfTemplateVersion`
  (2 hops) and `commissionOfTemplateNarrative` (**3 hops**, slot → version → identity).
  ⚠ A `.select()` is an opaque STRING and `.maybeSingle<T>()` ASSERTS rather than
  validates, so the dead one-hop embed typechecked cleanly and failed only at runtime
  with PGRST200 (BUG-TV-001). Verify embed changes against PostgREST, never `tsc`.

### PCI — substrate guards (the audit findings, `20260906*`)

- **`app.is_client_role()`** — `current_setting('role', true) in ('authenticated','anon')`.
  ⭐ **It exists because `current_user` inside a SECURITY DEFINER function is the OWNER**,
  so a role check written that way is INERT. Any new substrate guard that needs to know
  "is this a client?" must use this, not `current_user`. Callers: `app.guard_case_phase_status`,
  `app.guard_case_outcome_coherent`.
- ⭐ **Invariant vs door-mirror — decide which you are writing before you scope it.**
  A guard restating what an RPC enforces is a **door mirror**: scope it to
  `app.is_client_role()`, or it breaks `seed.sql` and privileged pgTAP fixtures that
  run as `postgres` and legitimately create the state. A guard stating something that is
  **never legitimately true** (e.g. cross-commission coherence) binds EVERYONE and takes
  no role scope. Both shapes live inside `guard_case_outcome_coherent`, annotated.
- **`case_phases` INSERT gate** — a phase may only be born inside a vetted RPC window
  (`app.in_case_rpc`) when the writer is a client role. Without it the whole transition
  matrix was bypassable by inserting the terminal row directly. ⚠ Its header records an
  assertion that was **written and reverted**: do NOT add "a new phase must be `pending`" —
  `seed.sql` inserts a `completed` phase 1 under this GUC by contract.
- **Audit mesh (Rule 11)** — read from `pg_trigger`, phase INSERTs and case DELETEs were
  unaudited and four tables (`case_phase_allowed_results`, `case_phase_offered_results`,
  `case_offered_outcomes`, `case_custom_field_values`) had **no triggers at all** while
  being `authenticated`-writable under a `FOR ALL` policy. Now covered by
  `app.trg_audit_case_child` / `_case_phases` / `_cases`. **Cascade-silence convention:**
  every arm returns NULL when the owning commission cannot be resolved, so a cascaded
  child delete is audited once at the CASE level, not per child.
- **Seven AFTER-timing coherence guards** (AFTER so RLS denies first, then integrity):
  `guard_case_narrative_type_coherent` · `guard_case_offered_outcome_coherent` ·
  `guard_case_result_link_coherent` (×2 tables) · `guard_case_phase_refs_coherent` ·
  `guard_case_outcome_coherent` · `guard_template_phase_form_coherent`.
- **Deleted-result filter** — `phase_results` uuids embedded as JSON strings in
  `result_ruleset` are unreachable by FK, so a deleted result made EVERY case creation
  from that template raise a raw 23503. Creation now filters to existing results.
  ⚠ The audit's original remedy ("forbid hard-delete, archive instead") was implemented
  and **pgTAP rejected it, correctly**.
- **Composite FK** `case_phases (form_version_id, form_id) → form_versions (id, form_id)`
  — pins the snapshot to the right form. Indexed `(form_version_id, form_id)`.
- **Revoked grants** — `TRUNCATE, TRIGGER, REFERENCES` dropped from `authenticated`+`anon`
  on the **18** tables of the audited cluster. ⚠ **RLS DOES NOT GATE TRUNCATE** — a
  policy-shaped audit is structurally blind to it. **Scope, honestly:** this is the
  cluster only. **67 of 156 `public` tables still grant at least one of the three to a
  client role** (measured 2026-08-05); the platform-wide sweep is deliberately NOT done.
  Enumerate residuals from `information_schema.role_table_grants`.
- Plus: FK indexes across the cluster, RLS initplan rewrites (`(select auth.uid())`),
  ordering + narrative-pairing constraints, `blocks[]` integrity, and the
  `app.in_case_rpc` GUC restore (a phase INSERT must not close the window).

### ⚠ Four rebuild property losses in one phase — the generalized rule

`20260907001200` exists solely because **a rebuild silently loses properties the original
carried, and an omission has no line in the diff.** Reviewing what the new statement SAYS
cannot find what it fails to mention. The four mechanisms, all real here:

| Mechanism | What was lost |
| --- | --- |
| `DROP` + `CREATE FUNCTION` | **the ACL** — 10 doors went anon-executable |
| `drop` + `add CONSTRAINT` | **`DEFERRABLE`** — broke `reorder_template_phase` with 23505 on every reorder |
| `ALTER … RENAME COLUMN` | re-points the policy silently (avoided by never renaming) |
| a column name held as DATA | loses nothing loudly |

⭐ **A parameter RENAME is a PRIVILEGE RESET.** `CREATE OR REPLACE` preserves the ACL;
`DROP` + `CREATE` resets it to the default PUBLIC grant. That is why exactly 10 of the
~18 doors this phase touched leaked: 6 were re-keyed with `DROP`+`CREATE` (parameter
renamed to `p_template_version_id`) and 4 were brand new — while
`set_template_phase_blocks`, which kept its signature and got `CREATE OR REPLACE`, did
not. **Any `DROP`+`CREATE` of a public function must re-apply its grants in the same
migration.** Current state: **0 public functions executable by `anon` or PUBLIC** (477
total), guarded by `100_dashboard` t19.

**Open cosmetic deviation (not a vulnerability, verified).** The policy swap
(`20260907000700`) recreated 10 policies on the 5 re-keyed relations **without the
`TO authenticated` clause** the originals carried, so they now bind role `public`.
Platform-wide the split is 256 `{authenticated}` vs 11 `{public}` — 10 of the 11 are
these. It is **inert**: `anon` holds no table grant on any of them (a read attempt under
`set local role anon` fails 42501 at the GRANT layer), and `service_role`/`postgres` have
`BYPASSRLS`. Worth normalizing when one of these policies is next touched.

**pgTAP** `296_process_case_integrity` (27, §H1–H4/M2/M4–M8/L1) · `297_process_template_versioning` (37).


## F1 — Case-Participants E0 (2026-07-10; ADR 0064/0066; migrations `20260716000000`–`…000200`; flags OFF)

The generalized participant/subject foundation (ADR 0064 E0). Ships **behind `case_participants` +
`case_types` flags, seeded OFF (m2 HARD GATE** — never flip on real ethics data until E1
respondent-exclusion RLS lands). RLS on every new table from creation regardless (Rule 1). E1/E2
NOT built. **Local validation:** full pgTAP suite green (151 39/39 re-keyed, 152 43/43 re-keyed,
207 21/21 new keystones, 171/191/197_phi_disposal re-keyed & green); typecheck + lint 0 errors.
**Remote deploy DEFERRED to the pilot reset.**

- **New tables (dialect 3 typed-identity registry):** `participants` (`UNIQUE(id, participant_type)`;
  `sensitivity_class` CHECK-derived from `participant_type`; org-scoped SELECT; **holds NO payload —
  patient `display_name` is a SURROGATE `'Paciente'`, never the raw name**), `patient_participants` /
  `professional_participants` (subtypes composite-FK+CHECK-pinned to the type — **R5 class-separation
  invariant**), `case_participants` (case×participant×role; primary-subject partial-unique; case-scoped
  RLS via `can_read_case`; cross-tenant guard **HC094**), `case_participant_roles`, `case_types`,
  `case_type_terminology` (catalog tables, org-scoped read / org-admin write), `professional_profiles`
  (**Class 2** — case-scoped RLS + audited reads, NO single door, NO `dispose_*` at E0; `user_id` E1
  self-read hook, inert).
- **Re-key `case_patient → patient_identifiers(participant_id)`** (N-per-case; ADR 0064 Decision 3).
  All DML REVOKED; door-only. `cases += organization_id` (R2 denorm; drift guard **HC095**). The
  `case_patient` flag / gate / posture PRESERVED; only cardinality + key change. Reset-OK (flag OFF ⇒
  zero prod PHI).
- **`patient_xref` case-module grain re-keyed `case_id → participant_id`** (ADR 0066 / R3; one xref
  row per patient participant). Changes how the case module feeds Phase-23 linkage. `event`/`referral`
  modules unchanged.
- **New/changed RPCs (all `REVOKE…FROM PUBLIC` + GRANT, t19):** `set_participant_patient` (atomic
  DEFINER writer — participant+subtype+link+identifiers in one coordinator-gated call; name-or-MRN
  floor; R4), `get_participant_patient` / `get_case_patients` (audited doors, `case_patient.read`
  logged with **entity_id = case_id** for C-4 continuity, NULL-out-of-scope, R1 gate inherited),
  `get_case_professional` (Class-2 audited reader → **`professional_profile.read`**), **compat**
  `set_case_patient` / `get_case_patient` (preserve the ADR-0038 single-patient UI contract — resolve
  the case's lone patient participant). `dispose_case_phi` generalized to per-participant satellites +
  per-participant `patient_xref` purge + patient-link soft-remove + registry redaction (Q4); **F2 seam
  marked** for the D10 attachment-redaction layer. `log_audit_access` + `_audit_access_authorized`:
  **`professional_profile.read`** added to allow-list AND C-4 dispatch (`can_read_professional_profile`);
  C-4 42501 errcode preserved.
- **New helpers:** `app.can_read_professional_profile` (case-scoped, DEFINER over base tables, R6-safe),
  `app.case_of_patient_participant`, `app.assert_participant_same_org_as_case` (HC094),
  `app.guard_case_org_matches_commission` (HC095). **SQLSTATEs allocated: HC094, HC095** (HC096 held
  unallocated — professional gate reuses 42501). **New audit verb: `professional_profile.read`.**
- **TS contract (`src/lib/`):** `cases/types.ts` `CasePatient.caseId → participantId`; `queries/cases.ts`
  `getParticipantPatient` / `getCasePatients` + compat `getCasePatient`; `set_case_patient` action
  arg-shape UNCHANGED. Types regen. NO frontend files touched.

## E1 — Ethics Access Spine · the m2 gate release (2026-07-14; ADR 0072; migrations `20260720000980`–`…001070`; flags `case_participants`+`case_types` **flipped ON**)

> **E3a amendment (BE-2/BE-3, 2026-07-26; migrations `20260827000000`–`…000100`; local-only, unratified — lead verifying).** `cases.case_type_id` (nullable FK → `case_types`, `on delete set null`) now exists — `create_case_from_template` persists it; the processless `create_case` gained an optional `p_case_type_id` (7th arg) + org-guard + the O-1 Rule-12 inheritance of `visibility_policy`/`confidentiality_level` from the type (t19 re-granted after drop+recreate). `case_events` gained 8 procedural `kind` values (auto-derived in BE-5) + a `visibility` column (`case_readers`|`coordinator_only`, default `case_readers`); `case_events_select` extended as a NARROWING-only AND (`coordinator_only` additionally requires staff_admin/commission-admin; `can_read_case` stays the floor). Seed: the `ethics` case_type reconciled to `explicit_grants_only` + `default_case_label='Denúncia'` + a 5-row terminology bundle + 7 org-wide roles; the E1 fixture case now carries `case_type_id`. pgTAP `266_ethics_e3a_surfacing.sql` **20/20** on a fresh reset.
>
> **E3a BE-6 (terminology reads + FE follow-ups; migration `20260827000300`; local-only).** Terminology reader **`getCaseTypeTerminology(caseTypeId)`** — ordinary authenticated RLS read of `case_type_terminology` (member-SELECTable — no new policy needed) merged over the platform default per `term_key`; null/unknown/missing-key all fall back deterministically; NEVER throws/null. Pure types + default bundle + merge moved to the **client-safe** `src/lib/cases/terminology.ts` (BUG-FBE-005: server client stays out of the client bundle); `src/lib/queries/case-types.ts` is the `server-only` reader. `getCaseDetail` now projects the real `caseTypeId`, resolved `terminology`, and **`primarySubjectKind`** (via the cases→case_types FK embed; type-less → `'patient'`); the board read projects `caseTypeId` per row via a batched RLS read (`fetchBoardCaseTypes` — the board RPC TABLE signature untouched). `FeatureFlags` gained the typed `ethics` key (`get_feature_flags()` already returns it). Manual `createCaseEvent` now accepts/persists `visibility` (clamps to `case_readers`); the coordinator gate is DB-enforced: `case_events_writer_write` WITH CHECK now requires staff_admin/commission-admin for `coordinator_only` (policy-only; no RPC/t19). `database.ts` nil-diff. pgTAP `268_ethics_e3a_terminology_reads` **9/9** + vitest `src/lib/cases/terminology.test.ts` **4/4**.
>
> **E3a P0-1 fix — case_events reader-non-writer split (ADR 0079; migration `20260827000400`; local-only).** QA found a leak: `case_events_writer_write` was `FOR ALL` with a BARE `USING (can_write_case_content)`, and a `cmd=ALL` policy's USING participates in SELECT — so a content-**write** grantee (non-staff_admin) read `coordinator_only` rows, bypassing `case_events_select`'s narrowing (BE-6's `WITH CHECK` insert-gate only guarded writes, not reads). Fix: both `FOR ALL` write policies (`case_events_writer_write`, `case_events_staff_admin_write`) are **dropped and recreated as command-specific** (`FOR INSERT`/`UPDATE`/`DELETE`, preserving their USING/WITH CHECK incl. the coordinator_only insert-gate), so **`case_events_select` is now the SOLE SELECT authority**. Post-fix `pg_policies`: SELECT = `case_events_select` only; the 6 write policies are INSERT/UPDATE/DELETE. Read matrix now correct: write-grantee non-coordinator → `case_readers` only (0 `coordinator_only`); staff_admin/commission_admin → all (via `_select`'s coordinator branch); respondent/recused → nothing (floor). Also closes the latent respondent-who-is-staff_admin read bypass (the old ALL-USING re-admitted above the floor). `can_write_case_content ⊆ can_read_case` confirmed (write-grantee still reads its `case_readers` events via `_select`). Policy-only → t19 N/A, `database.ts` unchanged. Keystone: `267` #14–17 (write-grantee sees 0 coordinator_only + still reads the 6 case_readers, **+ mutation-proof** — restoring the un-narrowed writer read-arm makes them see both coordinator_only, RED; revert → 0). Full suite `Files=135, Tests=3852, PASS`.

The access spine the generalized-subject layer (F1/E0) was gated on: a respondent doctor can
never read the case investigating them, recusal/COI are enforced in the DB (not the UI), and
ethics cases are explicit-grants-only with a confidentiality ceiling. **Releases the ADR-0064 m2
hard gate.** **Local validation:** full `supabase test db` **2537/0** (`228_ethics_e1.sql` **125**);
E2E `ethics-e1-access-spine` + `phase11-interviews` **26/26**; `database.ts` regen = nil diff (all
E1 access work is function+policy only); lint 0; vitest 369. QA **APPROVED** after two fix rounds
(3 Majors, each empirically reproduced then fixed). **Remote deploy DEFERRED to the pilot reset.**

- **Columns.** `cases.visibility_policy` (`commission_default`|`explicit_grants_only`) +
  `cases.confidentiality_level` (**the one 7-value taxonomy** — same set as
  `attachments.confidentiality_label` / the canonical `ConfidentialityLabel` in
  `src/lib/attachments/constants.ts`), both **snapshotted at create** and both DEFAULTing to today's
  behaviour (flag-OFF byte-for-byte) · `case_types.default_confidentiality_level` (the snapshot
  source) · `case_access_grants.max_confidentiality` (the clearance grade — **O1 chose a column**, not
  widening `level`'s 2-value CHECK) · `case_recusals.lift_reason_md` · nullable `participant_id` →
  `case_participants(id)` on `case_interviews`/`_subjects`/`_interviewers`. `create_case_from_template`
  gained an **optional 5th arg `p_case_type_id`** (signature 4→5 ⇒ drop+recreate; existing callers
  unaffected) — snapshots type→case only when supplied AND `case_types` is ON.
- **New tables** — all **SELECT-only + DEFINER-RPC writes**, enforced at the **grant** layer (no
  INSERT/UPDATE/DELETE grant exists to anyone), not merely by the absence of a write policy:
  `case_conflict_declarations` (unique(case,declarant) → `HC0E2`) · `case_recusals` (partial-unique
  one **LIVE** per (case,user) → `HC0E0`; SELECT = `can_read_case` **OR self-arm OR staff_admin** —
  the deliberate **D4 asymmetry**: a recused user sees *that* they are recused without regaining case
  read) · `interview_session_attendance` · `interview_topics` · `interview_summaries` (the last two
  are honest write-RPC-less scaffolding for E2/E3; the participant-roles M2M is a **clean deferral**
  to E2 — nothing half-built).
- **Predicates** — see **Helper functions**. All `app.*`, DEFINER, **R6-safe over BASE tables** (no
  RLS-gated `case_participants` read anywhere ⇒ no recursion). **MODIFIED:** `can_read_case` /
  `can_read_case_patient` / `can_write_case_content` each gained the two hard-denies **evaluated
  FIRST, before every grant arm** (a respondent/recused user who is *also* staff_admin / grant-holder
  / QPS operator is still denied), plus the `explicit_grants_only` suppression of the flag-OFF member
  fallback on both read predicates; `list_my_cases` gained an explicit respondent/recusal exclusion;
  `open_attachment` + the `attachments_select` policy gained the document ceiling (`HC0E6`) — it
  **cannot** live inside `can_read_attachment`, which is owner-keyed and cannot see a row's label.
- **15 DEFINER RPCs**, t19 REVOKE→GRANT on every one (see **RPC inventory**): 4 participant writers ·
  2 professional writers (**correction only — NO erasure path**; M2 posture, ARCHITECTURE Rule 12) ·
  `set_case_confidentiality` · `declare_conflict` / `record_recusal` / `lift_recusal` · 5 IV2 fold-in.
- **SQLSTATE `HC0E0`–`HC0E9`** (`HC0E8`/`HC0E9` reserved). **Audit verbs** (PHI-free metadata, Rule 11):
  `case.participant_added` / `case.participant_removed` / `case.primary_subject_set` /
  `case.participant_role_changed` / `case.conflict_declared` / `case.recusal_recorded` /
  `case.recusal_lifted` / `case.confidentiality_changed` / `professional_profile.created` /
  `professional_profile.updated` / `interview.confidentiality_changed`. The professional verbs carry
  **no identity payload**. The Class-2 read verb `professional_profile.read` is unchanged (E0).
- **m2 GATE RELEASED** (`…001040`): `case_participants` + `case_types` **ON**, both added to the
  hand-maintained `FeatureFlags` interface. **E1 does NOT own the `ethics` flag** (E2 does).
- **Known gaps carried to the PO — NOT E1's to fix** (both reviewed and upheld as another module's
  designed model, and both are *documented* exclusions in the 228 sweep): `action_items`'
  `assignees_only` arm, and `patient_safety_event` (`app.can_read_event` grants via
  owner-/reporting-commission + NSP-operator arms only — **no case arm by design**; an NSP record that
  merely *links* to a case).

### ⚠ The three shapes — read this before adding ANY case-scoped table

**`can_read_case` being correct does NOT mean the policies consuming it are.** E1 shipped a correct
predicate and still leaked — **three different ways, each found by a different method**. No single
method would have found all three:

| # | Shape | Why it evaded detection | Found by |
| - | ----- | ----------------------- | -------- |
| (a) | `can_read_case(x) OR is_tenancy_admin_of(…)` — the admin arm ORed **outside** the DEFINER, so the hard-deny never gets the last word | reads as correct; the deny *is* in the predicate | grepping `can_read_case` |
| (b) | `*_staff_admin_write` — **`FOR ALL` PERMISSIVE** with a **bare admin `USING`** and *no case predicate at all* | mentions `can_read_case` **nowhere** ⇒ invisible to any `can_read_case` grep; `FOR ALL` silently covers SELECT and **permissive policies OR together**, handing the row back | fixing (a), re-running, and finding it *still* leaked |
| (c) | `meeting_cases` — keyed **only on the meeting dimension**, no case predicate anywhere; carries `summary`+`decision` (real deliberation) and needs only **plain staff** | matched neither the `can_read_case` grep nor the `*_staff_admin_write` enumeration | **sweeping the data**, not reading policies |

**The durable guard** (`supabase/tests/228_ethics_e1.sql`): a **catalog-driven sweep** — it enumerates
every `case_id`-bearing base table from `information_schema` (**never** a hand-maintained list) +
`cases`, performs a real `select` **under `set local role authenticated`**, and asserts an excluded
persona reads **zero** rows, *naming* any offender. It is **fail-closed**: a new table with the wrong
shape fails automatically, with nobody having to predict it. Two documented exceptions, both reviewed
as not-leaks: the D4 recusal + `case_access_grants` **self-arms** (count only rows the persona does not own),
and `patient_safety_event`. Run it with **both** persona classes — a plain-staff **respondent** and a
**non-granted member** of an `explicit_grants_only` case are *different reach paths* (shape (c) leaked
to the second with **no respondent involved**).

**Two rules that fall out of this:**

1. **Assert at the POLICY layer, not the predicate layer.** `is(app.can_read_case(...), false)` is
   green while the row is readable — it tests the predicate, not the boundary. Only a real `select`
   under an assumed role tests RLS (Rule 1). And include **admin** personas: E1's first green
   2523-assertion suite missed shape (a) entirely because every respondent/recusal persona was plain
   staff.
2. **Member-facing reach ≠ `can_read_case`.** `can_read_case` has **no plain-member arm**
   *by design* (the `case_access` flag is retired — this is the single path now) — member-wide reach for a `commission_default` case comes from
   the member-facing surfaces (board, Meus Casos, meeting case-labels, timeline refs; ADR 0072 D2·8),
   not from `can_read_case`. Gating such a surface on `can_read_case`/`_or_admin` **silently deletes
   ordinary members' reach of ordinary cases**. Use **`can_reach_case_on_member_surface`** there;
   use `can_read_case_or_admin` only where an admin/coordinator **authority** arm is what you mean.

## E2 — Ethics Procedure (S4·ETH·E2, 2026-07-18; ADR 0073; migrations `20260817000000`–`…000700`; flag `ethics` ON **seed-only** — local, remote OFF till pilot)

> **E3a amendment (BE-5, 2026-07-26; migration `20260827000200`; local-only, unratified — lead verifying).** All 8 procedure RPCs (`decide_admissibility`, `add_ethics_allegation`, `record_ethics_finding`, `issue_ethics_notification`, `schedule_ethics_hearing`, `cast_case_vote`, `issue_decision`, `submit_ethics_appeal`) now ALSO emit one `case_events` row on the matching procedural `kind` (O-3 auto-derive), spliced inside the DEFINER body before the single `audit_write` (after the milestone write, same transaction → a failed/unauthorized RPC emits none). Bodies are fixed pt-BR templates over controlled enum values / catalog `display_name` only (PHI-free, no `*_md`/finding/vote/voter/recipient). `finding_recorded` + `vote_cast` = `coordinator_only`; the other 6 = `case_readers`; `can_read_case` stays the floor. Catalog-truth body-only rewrites (`create or replace`, grants preserved — all still `authenticated`+`service_role`); `database.ts` nil-diff. Gate: pgTAP `267_ethics_e3a_autoderive` 20/20 + a migration-level mutation proof (flipping the 2 `coordinator_only` emits to `case_readers` turns keystones 3/6/12/13 RED).
>
> **E3a BE-7 — ethics dashboard read (`getEthicsDashboard(commissionId)`; NO migration; local-only).** `src/lib/queries/ethics-dashboard.ts`. **RLS-scoped by construction:** ordinary `authenticated` `createClient()` + ONLY `.from().select()` reads (no service-role/admin client, no `.rpc()`/DEFINER). Aggregates over `ethics_case_details` / `case_decisions` / `ethics_decision_details` — each SELECT-gated `USING app.can_read_case(case_id, auth.uid())` — so a viewer who can't read a case contributes ZERO to every count. Shape: `totalCases`, `byAdmissibilityStatus` (pending/admissible/inadmissible), `byCaseDecisionStatus` (draft/proposed/voted/issued/appealed/voided), `medianCycleTimeDays` (complaint_received_at→decided_at, issued only, whole days, TS-computed), `sanctionOutcomeCounts[]` (issued only, joined to `ethics_sanction_types` for the pt-BR label). Foreign-commission → empty (commission filter + RLS). No new audit verb (aggregate over already-`can_read_case`-gated surfaces — mirrors E2 D11). Gate: pgTAP `269_ethics_e3a_dashboard` **14/14** — coordinator N=3 vs respondent/recused/non-granted strictly lower with the excluded case contributing to none of the aggregates, foreign=0, **+ mutation-proof** (the same totalCases query run UNSCOPED/superuser returns 3 == coordinator, proving the respondent's scoped 1 is RLS-driven — switching to a service-role path turns the strictly-lower keystones RED). Perf: the per-case `can_read_case` eval is index-backed (`case_participants_case_idx` for the respondent term; partial `case_recusals_case_user_live_idx` for the recusal term) — sound at pilot scale, no new index. **Also hardened `266`'s respondent keystone** (was passing via non-grant; now st_x is granted read + role key `respondent_doctor`, so respondent-deny is the isolating factor). *(E3a pgTAP renumbered 260–263 → 266–269 to avoid the CH/case-corrections numeric collision; BE-8.)*

Full disciplinary procedure layered on E1's case-access spine. **Per-task ledger + test triage →
[progress/eth-e2-procedure.md](../progress/eth-e2-procedure.md); QA crux review → [reviews/eth-e2-review.md](../reviews/eth-e2-review.md).**

- **Tables (9, all `read_case_content`-tier — one SELECT policy = verbatim `can_read_case`, no authenticated write policy):**
  `ethics_case_details`, `ethics_allegations` (+`ethics_allegation_categories`), `ethics_findings`, `case_decisions`,
  `ethics_decision_details` (+`ethics_sanction_types`), `case_votes`, `ethics_notifications`, `ethics_hearings`,
  `ethics_appeals` (+ `case_assignment_roles` catalog; `case_phases.assignment_role_id`).
- **Write surface = `HC0J·` DEFINER doors** (authority-first `HC0J1`, distinct SQLSTATE from exclusions; anon-revoked; owner
  postgres): admissibility, allegation/finding CRUD, decision lifecycle — `issue_decision` = quorum `HC0J8`, where
  **`required = greatest(coalesce(commission_meeting_settings.quorum_value, ceil(app.eligible_voters(case)/2)), 1)`** and it
  fires the M2 pin; `cast_case_vote` (`HC0J4/5` recused+respondent exclusion); notifications; `schedule_ethics_hearing`
  (rides a `participants_only` meeting); appeals; `target_case_response`/`submit_targeted_case_response` (D13, `HC0J9`);
  catalog CRUD (org-authority `42501`); `redact_professional_profile` (`HC0J7`, minimise-not-destroy, barred while pinned).
- **M2 retention:** `issue_decision` pins the respondent's `professional_profiles` row (idempotent, PHI-free audit); redaction
  nulls identity via the `app.in_redaction_rpc` GUC exception to the `guard_professional_linkage` freeze.
- **Reads:** `get_ethics_case_procedure(case)` (DEFINER, `can_read_case`-gated, null when unreadable/non-ethics/flag-off);
  `listEthicsSanctionTypes`/`listCaseRecusals`/`listEthicsAllegationCategories`/`listCaseAssignmentRoles`. N ethics scan arm =
  `app.compute_due_ethics_notifications` (flag-gated, PHI-free). Consumption: `assign_ethics_remediation`, `open_ethics_external_referral`.
- **PHI:** Class-2 professional identity, no patient PHI. **Data-access:** `src/lib/queries/ethics.ts`, `src/lib/ethics/actions.ts`,
  coordinator controls in `src/lib/case-recusals/actions.ts`; UI = the `etica` tab + `src/components/ethics/**`.
- **Follow-ups (QA info):** INFO-1 respondent direct-`PATCH` of own targeted-response status skips the submit-audit row;
  INFO-2 org_admin case-phase responses via the pre-existing `responses` arm.

## RV2 — Referrals v2 Governance R2–R5 (S4, 2026-07-19; ADR 0037/0078/0079; migrations `20260817001000`–`…002200`; flag `case_referrals` OFF till pilot) → `main` `a61aae3`

Extends S2·RV2·R1 (dialogue core). Full record → `progress/rv2-r2-r5-governance.md`.

**Tables (RLS-on; PHI columns column-REVOKED from `authenticated`):**
- `referral_requested_actions` — R2 vocab (read `true`, write `is_admin()`); mirrors `referral_types`.
- `referral_resolutions` — R3; `summary_md` **PHI-REVOKED**; SELECT `can_read_referral_metadata`; partial-unique `(referral_id) WHERE reopened_at IS NULL` (one active); writes DEFINER-only.
- `referral_assignments`, `referral_case_links` — R4; SELECT `can_read_referral_metadata`; **in NO read predicate** (assignment ≠ access / link ≠ access); writes DEFINER-only.
- `referral_internal_notes` — R5; body **PHI-REVOKED**; SELECT `can_read_referral_internal_note` (source≠target≠QPS); writes DEFINER-only. ⚠ This line predates the RDR merge (ADR 0109): the column is **`body_md`**, and the row also carries `title`/`assigned_to`/`status`/`concluded_*`/`updated_*`. **No table-level `authenticated` ACL — every readable column needs its OWN `GRANT SELECT (col)` or it reads 42501** (the absence of a grant on `body_md` *is* the K-R5-2 hardening). ADR **0110**: `note_type_id`/`type_label` are gone, replaced by **`kind`** — the SAME six-value CHECK as `case_events.kind` (`note`/`meeting`/`decision`/`update`/`follow_up`/`other`), NOT NULL default `note`, TS mirror `src/lib/cases/registro-kinds.ts`. Table `referral_note_types` + its 2 policies + audit trigger + `reorder_referral_note_types` were DROPPED with it.
- `referral_read_receipts` — R5; PK `(message_id, user_id)`; SELECT `can_read_referral_metadata` of the message's referral.
- `case_referral +=` `priority`, `requested_action_id/_label`, `response_due_at`, `decline_reason_code` (R2, PHI-free); status `+= answered, resolved` (R3); `parent_referral_id` self-FK, CHECK ≠ self (R3).

**Predicates (`app.`):** `referral_is_overdue` (R2, SQL↔TS mirror) · `can_read_referral_internal_note` (R5 keystone — source-member OR target-member-once-sent; **NO PQS arm**; the sole `referral_internal_notes` SELECT policy) · `can_read_referral_internal_notes` (plural — R5 audit-entitlement ONLY; no PQS arm; in **0** RLS policies). `can_manage_referral_source`/`_target` (= `is_staff_admin_of_for(source|target)`) gate resolve/reopen/assign/redact.

**RPCs (all DEFINER, t19 = REVOKE PUBLIC + GRANT authenticated/service_role):** R2 — `set_referral_deadline`, `create/update_referral_requested_action`, `create_referral_draft`(+`parent`), `decline_referral`(+reason). R3 — `resolve_referral`, `reopen_referral`, `conclude_referral`(→answered), `close_case`(+answered block). R4 — `assign/update/cancel_referral_assignment`, `list_my_referral_assignments`, `link_referral_related_case`, `unlink_referral_case`. R5 — `create/list_referral_internal_note(s)`, `redact_referral_message/note`, `record_referral_message_receipt`, `dispose_referral_phi` (extended — purges all 4 referral PHI columns; writes `body_md`, so a rename of that column breaks LGPD disposal at RUNTIME, not at migration time). ADR 0110 re-signed two of them: **`create_referral_internal_note(uuid,uuid,text,text,text,uuid)`** and **`update_referral_internal_note(uuid,text,text,text)`** — the 5th/4th arg is now `p_kind text`, not `p_note_type_id uuid`. Both were DROP+CREATE (signature change) with the t19 grant set re-issued explicitly. `list_referral_internal_notes` emits **`referral.note_viewed`** PHI-free audit via `log_audit_access → app._audit_access_authorized → app.audit_write` (Rule 11; fires only when ≥1 note served).

**SQLSTATEs:** `HC0A3` vocab · `HC0A4` deadline · `HC0A5` resolve/reopen state · `HC0A6` lineage · `HC0A7` assignment · `HC0A8` link · `HC0A9` redaction. **Authority = `42501`, checked FIRST** (ADR-0078 non-vacuity).

**Follow-ups:** `189` pgTAP stale-fixture baseline (RV2-unrelated) · notes-SSR hardening (INFO) · pilot `case_referrals` enablement + origin push + deploy.

## Extracted from the pre-split stamp chain

Recovered when the frozen currency-stamp chain left this directory
(→ [`../progress/backend-state-stamp-history-archive.md`](../progress/backend-state-stamp-history-archive.md),
ADR 0199). Re-measured **2026-09-09** against the local catalog at migration `20261003007350`.

- **⛔ `app.member_can` is OR-composed ONLY into specific guarded DEFINER doors — NEVER into the `cases`
  or `case_phases` `FOR ALL` write policies.** This is a placement prohibition, not a description: a
  delegated capability grant must not become a write policy, or the `administrativo` delegation silently
  widens into case authorship. Measured — `select … from pg_policies where tablename in ('cases',
  'case_phases') and (qual||with_check) ~ 'member_can'` → **0 rows**, while the control across all
  policies returns **3**, so the invariant is verified against a live population rather than an empty
  one. The seams document `member_can`'s *shape* thoroughly and its *placement* not at all.
  Stamp 2026-07-08 (ADR 0061).
- **`public.commission_administrativos`** — the appointment row itself (SELECT-only, DEFINER-door writes,
  audited). Only its child `commission_administrativo_capabilities` appeared in the seams, so the parent
  of a documented child was missing. Present in `pg_tables`. Stamp 2026-07-08.

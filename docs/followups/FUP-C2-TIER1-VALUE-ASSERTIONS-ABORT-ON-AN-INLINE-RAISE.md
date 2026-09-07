# FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE

**Filed:** 2026-09-04 (C2 closure — found while fixing the last 4 residual abort sites)
**Owner:** backend
**Severity:** high — **296 measured latent sites**. Each is invisible to a green suite and can only
surface as an `ERROR` (a lost verdict) on some future mutation sweep, never as a wrong answer.

## The mechanism

> **A pgTAP *value* assertion — `is` / `isnt` / `ok` / `cmp_ok` / `isa_ok` — evaluates its subject
> expression *before* the assertion function is entered. So a door that raises inside that
> expression cannot fail the test: it aborts the file.** The mutation harness then reads a shape
> change and scores **`ERROR` — not a red** — so the verdict is lost rather than earned.

`throws_ok` and `lives_ok` are immune, because they take the statement as *text* and `EXECUTE` it
inside a `BEGIN … EXCEPTION` block.

**Fix pattern — capture, then assert.** Create the destination *empty*, do the call as
`lives_ok($$ insert into t … select door(…) $$)`, and assert on the captured value. A refused call
then leaves the assertion reading NULL — scored — instead of crashing, and the `lives_ok` names the
refusal as its own test.

## Why it is a real class and not a one-off

It was hit **four times in one day** across unrelated work: three "capture for `is`/`isnt`" edits in
Phase B1 (`80`, `305:358`, `350:558`), and then `305`'s assertion 6.7 at C2 closure — the one that
cost `cancel_minutes_job` its verdict on a full sweep. `305` had *already documented two other
variants of the same hazard in its own comments* (an `isnt()` at §4.9, and a `21000` scalar-subquery
abort at 6.8); the door-raises-inside-`is()` variant is simply the one nobody had reached yet.

## The measured population — 296 sites across 60 of 262 files

Method (`inline-raise-census.py`, C2 closure): population = the 171 derived enforcers ∪ the 237
Tier-1 door lines = **265 names**; a site is a statement-initial `select is|isnt|ok|cmp_ok|isa_ok(`
whose **first argument** calls one of those names, extracted by a **balanced-paren scan honouring
dollar-quotes and doubled quotes** — not a flat grep. **6216** value-assertion sites scanned, **296**
match: `is` 257 · `ok` 24 · `isnt` 12 · `cmp_ok` 3. Worst files: `279_accreditation_dispatch` 42 ·
`228_ethics_e1` 24 · `261_charters_rpcs` 19.

⚠ **Read the bound in both directions.** It is an **upper** bound on latent aborts — a site only
aborts if that door actually raises in the state its file built. It is a **lower** bound in another
— a door reached through a helper outside the 265-name population is not counted.

## Closes when

Either (a) the 296 are triaged and the reachable subset converted to capture-then-assert, or (b) a
gate detects the shape — a lint pass over `supabase/tests/*.sql` flagging a value assertion whose
first argument calls a door in the derived population, which is the same balanced-paren scan the
census already implements. ⛔ **Not closed by "no sweep has hit one yet"** — that is the state this
entry describes, and it is exactly the absence-of-a-verdict-is-not-absence-of-coverage error.

⚠ Fixing all 296 blindly is **not** proposed. Most will never be reached by a mutation that makes
their door raise; the value is in the triage and the detector, not the churn.


## The WORK-LIST — 23 measured sites, dated 2026-09-07 (PO ruling on the NOTICED class)

⛔ **This section is the remedy the PO's NOTICED ruling points at, written down as rows rather than
as a sentence.** On 2026-09-07 the PO ruled that `NOTICED` — a door-sweep case whose suite reddened
while a file ABORTED — is **disclosed, non-blocking, work-listed**: coverage EVIDENCE, never a
verdict, quoted in every gate record, and not a phase blocker (BLIND still is). *Work-listed* is
the operative word, and this is the list.

The 23 rows below are every `NOTICED` case of the door arm's run 2 (2026-09-06, 353 cases, a fresh
`supabase db reset`, `ARM-DOMAIN predicate=127/127 policy=226/226`). ⭐ **Each was retried after a
reset and all 23 REPRODUCED**, so these are the class this entry describes and not tail drift —
run 1's 102 `NOTICED` were mostly drift and are deliberately NOT carried here.

⛔ **Every one has `Files=262`**: all 262 files RAN; only the `Tests=` count moved, by −8 to −207
against 8876. That is this entry's shape exactly — a value assertion whose subject raises when its
gate is opened, aborting *that file's* plan — and **not** a generic catalog-shape detector: ZERO of
the 23 abort in an authz meta-test (`250_authz_p0_isolation`, `290_authz_never_called_door_floor`
and `246_authz_f1_referral_split` appear in no row's aborting set). 15 distinct aborting-file
signatures over 23 rows; the largest group is 4.

**A row is discharged when its aborting file's value assertion is converted to capture-then-assert
AND the door arm's case for that gate returns a verdict at the unmoved suite shape** — not when the
suite merely goes green with the gate closed, which is the state today.

| gate (door-arm key) | aborting file(s) — the site(s) to convert |
| --- | --- |
| `app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid)` | `150_referrals.sql` |
| `app.can_sign_meeting(p_attendee_id uuid, p_signer uuid)` | `120_meetings.sql` |
| `app.can_view_printed_document(p_source_kind text, p_source_id uuid, p_uid uuid)` | `368_printed_documents_cases.sql` |
| `app.event_current_custodian(p_event_id uuid, p_user_id uuid)` | `140_patient_safety.sql` |
| `app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)` | `140_patient_safety.sql`, `205_administrativo.sql`, `225_supersession.sql` |
| `app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)` | `200_controlled_documents.sql`, `244_authz_c6_reserved_session_lifecycle.sql`, `90_cases.sql` |
| `app.is_active(p_user_id uuid)` | `200_controlled_documents.sql` |
| `app.is_dpo_of(p_hospital_id uuid)` | `349_dsr_request_workflow.sql` |
| `app.is_dpo_of_for(p_hospital_id uuid, p_user_id uuid)` | `349_dsr_request_workflow.sql` |
| `app.is_entitled_document_approver(p_hospital uuid, p_user uuid)` | `200_controlled_documents.sql` |
| `app.is_member_of_for(p_commission_id uuid, p_user_id uuid)` | `244_authz_c6_reserved_session_lifecycle.sql`, `90_cases.sql` |
| `app.is_nsp_coordinator_of_for(p_hospital_id uuid, p_user_id uuid)` | `140_patient_safety.sql` |
| `app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)` | `227_action_item_satellites.sql`, `264_correction_requests.sql`, `265_reopen_void_narrative.sql`, `267_ethics_e3a_autoderive.sql`, `272_ff2_door_parity.sql`, `347_correction_conclusion_gate.sql`, `367_deferred_staff_signoff.sql` |
| `app.is_pqs_member_of_for(p_hospital_id uuid, p_user_id uuid)` | `140_patient_safety.sql` |
| `app.is_pqs_operator_of_for(p_hospital_id uuid, p_user_id uuid)` | `140_patient_safety.sql` |
| `app.is_staff_admin_of(p_commission_id uuid)` | `113_case_action_items.sql`, `150_referrals.sql`, `182_action_items.sql`, `205_administrativo.sql`, `225_supersession.sql` |
| `app.is_tenancy_admin_of(p_commission_id uuid)` | `205_administrativo.sql`, `225_supersession.sql` |
| `app.is_tenancy_admin_of_for(p_commission_id uuid, p_user_id uuid)` | `205_administrativo.sql`, `225_supersession.sql` |
| `app.referral_target_analyst(p_referral_id uuid, p_uid uuid)` | `150_referrals.sql` |
| `authz.holds_role(p_principal uuid, p_role_code text, p_scope_kind text, p_scope_id uuid)` | `113_case_action_items.sql`, `150_referrals.sql`, `182_action_items.sql`, `205_administrativo.sql`, `225_supersession.sql`, `405_ae46_wrapper_cutover_invariants.sql` |
| `cases.cases_staff_admin_write (ALL)` | `205_administrativo.sql` |
| `form_item_options.form_item_options_staff_admin_write (ALL)` | `409_ae49_d6_rekey_differential.sql` |
| `forms.forms_staff_admin_write (ALL)` | `409_ae49_d6_rekey_differential.sql` |

⚠ **Four of the 23 are weaker still and are tracked separately** in
`FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`: for 19 of 23 at least one *authz-shaped*
file reddens OUTSIDE the aborting file, but `app.event_current_custodian`, `app.is_dpo_of`,
`app.is_dpo_of_for` and `app.is_entitled_document_approver` have not even that name-shaped signal.
⛔ A name-shaped signal is not a verdict in either case — it is offered as input, not as coverage.

## Related

- **LEARN-083** — the register row for this shape.
- `docs/reviews/c2-suite-abort-diagnosis.md` — the 18-door class this is the residue of; note the
  distinction, since the two are easily conflated: those 18 aborted **downstream** of a scored
  failure (the suite noticed, then crashed), whereas these sites abort **instead of** scoring, so
  nothing notices at all.
- ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) — a verdict lost to an
  `ERROR` is not a covered door.

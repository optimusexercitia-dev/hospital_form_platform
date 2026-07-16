# QA Review — AUTHZ · M5: the `is_active` outer gate (defect ③)

**Verdict: `CHANGES REQUESTED`** (one P1; the gate itself is correct)
**Reviewer:** `qa` · **Date:** 2026-07-15 · **Commit:** `11a5ffd` (+ docs `81f4796`)
**Branch:** `feat/authorization-capability-model`

## State pinned (§7.3)

| | |
|---|---|
| Migrations | **116 files = 116 registered** ✅ |
| pgTAP | **Files=94, Tests=2740** — 1 failed (`100_dashboard` t19). **Not M5.** See MINOR-1. |
| Mutation | M5 **9/9 RED-PROVEN** · M1 **22/22 RED-PROVEN**, both re-run by me on **BSD awk** |
| Method | Live catalog only. No reset performed — readings pin to the current stack state. |

**The gate is real and it is correctly built.** The finding below is about the **closure claim**,
not the gate.

---

## P1 (blocking) — the closed set is a **FLOOR**, not the population: three `SECURITY DEFINER` RPCs authorize on raw arms with no gate

> **Requirement violated:** ADR 0078 **Context·3 / D3** — *"A deactivated or suspended user must not
> read or write case content, patient identifiers, **or action items** through a surviving raw arm."*
> (M5's own migration header, lines 2–5.)
> Also **§7.5** — *the caller set was never the population*; and the migration's claim
> *"⛔ THE SET WAS CLOSED, NOT ENUMERATED"* is **false as written**.

`backend` closed on *{functions whose body touches a raw-arm table}* = **17**. My independent sweep of
the live catalog (comments stripped, `\y` not `\b`, `app` **and** `public`) returns **59**. The 17 is
the `app.*` predicate subset; it silently excluded the `public.*` DEFINER RPCs that read the raw arms
**directly** rather than through a predicate. Because they are `prosecdef = t`, **RLS does not apply**
(§7.2·6 — a DEFINER's gate *replaces* RLS), and they carry no gate of their own.

**Behavioural proof** (`staff1.ccih@test.local`, holder of 2 phase assignments + 1 grant, deactivated
inside a rolled-back transaction, run under `set local role authenticated` with his JWT claims):

```
can_read_case                = false   ← M5 works
can_read_action_item         = false   ← M5 works
get_case_detail              = raises "caso … não encontrado"   ← correctly gated
list_cases_board             = 0 rows                            ← correctly gated
--- but ---
>>> list_my_cases            = 2 rows   (leaks case_number, label, attributed items)
>>> list_my_action_items     = 2 rows   (leaked title: "Atualizar protocolo de higienização")
>>> get_member_overview      = cases_not_concluded=2, pending_action_items=2
```

The three offenders, all `prosecdef = t`, all `auth.uid()`-scoped, all keying on raw arms:

| Function | Raw arms it authorizes on | Leaks to a deactivated principal |
|---|---|---|
| `public.list_my_cases(uuid)` | `case_access` · `case_phases.assigned_to` · `case_narratives.assigned_to` | case rows: `case_number`, `label`, attributed items |
| `public.list_my_action_items(uuid)` | `action_items.assigned_to` | `title`, `description`, `visibility_scope`, `due_date`, `case_number`, `case_label` |
| `public.get_member_overview(uuid)` | all three case raw arms + `action_items.assigned_to` | counts only (`cases_not_concluded`, `pending_action_items`) |

`list_my_cases` is the clearest: it delegates to **no** predicate — it inlines all three raw arms
(`pg_get_functiondef` lines 34–35, 56, 70, 82–88) under a bare `v_uid := auth.uid()`.

**Scope of harm — stated precisely, not inflated:**
- **No Rule 12 breach.** None of the three returns a patient identifier. `can_read_case_patient` and
  `get_case_patient` are correctly gated (verified). This is **content**, not PHI.
- **Not an M5 regression** — pre-existing. But M5 is the unit that exists to close defect ③ and
  **asserts it did**.
- **Unmitigated.** `grep -rn "is_active" src/lib/supabase/ src/middleware.ts` → **no matches**. There
  is no app-layer gate. All three are live, called from `src/lib/queries/{cases,action-items,overview}.ts`.
  (And per Rule 1, a middleware gate would not count anyway.)
- **Un-keystoned** (§7.1·4) — nothing in `231` asserts any of the three.

**Either resolution is acceptable:**
1. Gate all three (`if not app.is_active(v_uid) then return <empty> end if;`) + a keystone per
   function in `231`, mutation-proven one at a time; **or**
2. Scope them out **explicitly and visibly**, the way defect ①'s second half is handled — a
   documented deferral **plus a pin** asserting today's behaviour so the later fix lands as a visible
   change — **and correct the closure claim** in the migration header and PROGRESS.md to say what was
   actually closed (*the `app.*` case predicates*), not "the set".

⚠ **A note against my own method, in M5's favour.** My text-based transitive-`is_active` reachability
graph reported `list_my_cases` as **gated**. It is not. The graph over-reported (it matches any callee
name in the body). Only the `set local role` probe found it. §7.2's *"behaviour, not a predicate's
return value"* caught my own floor — the same failure mode I am filing against `backend`. Reviewers
after me should not trust the reachability query in `scratchpad/reach.sql` without a behavioural probe.

---

## MINOR-1 — the mutation harnesses leave `pgtap` installed in `public`, which turns the **next** pgTAP run's t19 red

The preflight in both `m1-` and `m5-mutation-audit.sh` runs `create extension if not exists pgtap;`
and never drops it. `supabase test db` normally creates pgTAP transiently. `100_dashboard.sql` t19
asserts *"no public function is anon-executable"* — and pgTAP's own ~1079 functions are.

Proven read-only, no drop needed:

```
total_leaked=1079 | pgtap_owned=1079 | NON_pgtap_leaked=0
pgtap installed in schema: public
```

**`NON_pgtap_leaked = 0` — the application has zero anon leaks. M5 introduced no ACL regression**
(`create or replace` preserves ACLs). The handoff's *"pgTAP 2740/2740"* is reproducible **only on a
fresh reset**; run the mutation harness first and you get 2739/2740 with a t19 red that looks like a
security regression and is not. This is §7.3 *in the tooling* — and the harness's own preflight
comment already anticipates the reverse case. Suggest the preflight record whether it created the
extension and drop it on exit, or the handoff state the ordering constraint.

---

## What I verified and found SOUND

**1 · The seven gates — all present, all DEFINER, comments stripped.**
`can_read_case` · `can_read_case_patient` · `can_write_case_content` · `can_read_action_item` ·
`can_write_case_narrative` · `can_write_attachment` · `referral_target_analyst` → `is_active` in code:
**t** for all 7. `app.is_active` itself fail-closes on an absent profile and resolves both halves
(`is_active AND (suspended_until is null or now() >= suspended_until)`).

**2 · ⭐ The two deliberately UNGATED functions — `backend` is RIGHT. Do not "fix" them.**
This was flagged to me as the highest-risk judgement in the unit. It survives audit. From the catalog:

- `can_read_case_or_admin` = `can_read_case` (gated) ∨ `is_commission_admin_of_for` (**gates inline**)
- `can_reach_case_on_member_surface` = `is_member_of_for` (**gates inline**) ∨ `can_read_case_or_admin` (both arms gated)

Every role wrapper carries the gate inline — `is_member_of_for`, `is_commission_admin_of_for`,
`is_staff_admin_of_for`, `is_nsp_coordinator_of_for`, `is_pqs_member_of_for`. `is_pqs_operator_of_for`
has **no** inline gate but is exactly `is_nsp_coordinator_of_for ∨ is_pqs_member_of_for` — both gated.
**There is no path into either function that does not pass a gated predicate.** Neither body touches a
raw-arm table at all (absent from my 59-row sweep). A gate there is a provable no-op. The claim is true.

I also tested the adjacent "fixed for free" claims:
- `can_write_action_item_stake` — `if not app.can_read_action_item(...) then return false` **first**. Genuine delegation.
- `can_read_attachment` — every arm is `can_read_case` / `can_read_action_item` / a gated wrapper.
- `attachment_confidentiality_ok` / `confidentiality_clearance_ok` — the "conjunct, not arm" claim
  **holds**: both return `true` for every non-sensitive label, and their only three uses are
  `can_read_interview` (`AND`), `open_attachment` (`if not … then` deny), and the `attachments_select`
  policy (`AND`). **Never an OR arm.** They cannot grant reach.

**3 · §7.7 — the narrowing proof, rebuilt independently. Reproduced.**
I did not re-run `backend`'s queries. I built my own shadow by stripping the gate out of the **live**
`pg_get_functiondef` (with a hard `raise` if any `is_active` survived the strip) inside a rolled-back
transaction, and diffed the **full population**:

- **Baseline, unmodified seed — 196 (case,user) pairs + 28 action-item + 168 narrative pairs: 0 rows differ. LOST = 0, GAINED = 0.** No over-reach.
- **Counterfactual on a *broader* fixture than `backend`'s** — I deactivated **all six** raw-arm holders, not its four:

```
rows_changed = 8 | GAINED = 0 | ACTIVE_LOST = 0
```

Every one of the 8 losers is `is_active = f` **and** a raw-arm holder. **`backend`'s reported 5 is
reproduced, not refuted**: my 8 = its 5 (`multi@`/c1, `staff1`/c1, `staff1`/c2, `staff2`/c1,
`staff3`/c1) **plus the 3 rows of the two admin arm-holders it omitted** (`chefe.ccih` ×2,
`orgadmin.b` ×1) — those hold raw arms too, and pre-M5 a deactivated `chefe.ccih` kept read through
the bare grant after her role wrapper had already denied her. M5 correctly closes that.

**4 · A33 / the vacuous shapes — checked, none present.**
- **Vacuous fixture confirmed independently**: `desativado.conta@` and `suspenso.temp@` hold
  **0 grants / 0 phase / 0 narrative / 0 action-item / 0 satellite** arms. `backend` was right to
  refuse them and build its own. (This is also *why* the baseline diff is 0.)
- **The `assignees_only` arm is genuinely exercised.** `231:259` inserts `source_type = 'manual'` —
  which dodges `guard_action_item`'s hard-force of `visibility_scope := 'case_restricted'` for
  `source_type = 'case'` (§7.1·2, live in this table) — then **asserts the scope post-insert**
  (`231:266`) *and* asserts the item has **no case anchor** (`231:270`). Both raw arms (`assigned_to`
  **and** the `action_item_assignments` satellite) get separate TWIN → deactivate → RESTORE →
  suspend → RESTORE cycles.
  **The mutation harness independently proves the arm is the right one:** `_mut_ungate` rewrites
  `app.is_active(` → `app._mut_active_true(` **in one function's body at a time**. Had the assertion
  been measuring the `committee` arm, reverting `can_read_action_item`'s *own* gate would leave
  `is_member_of_for`'s gate intact and the test would stay **green**. It goes **RED**. The axis is isolated.
- **The wrong-arm trap named in my brief** (`staff1.ccih@` holds a `grant:read` on `…e1` and reads
  false) — `231` builds its own personas and carries an explicit PRE-FLIGHT block asserting each
  principal holds **no role arm**, precisely so deactivation cannot deny through a wrapper.

**5 · Scope fence — held.** No resolver, no `case_access_grants`, no A21 removal.
**Defect ①'s second half is STILL OPEN, as required** — `231:189` asserts the **ACTIVE** read-grantee
reaches the PHI door and `231:192` asserts he **actually reads `MRN-M5-001`** through the audited
door. M5 did not close it. B1 will land as a visible failing assertion. ✅

**6 · The 3 functions beyond the brief — `backend` wrote its own keystones.** They are **not**
un-keystoned (§7.1·4). All three are in the M5 harness and all three go RED:
`can_write_case_narrative` (deactivated + suspended), `can_write_attachment` (deactivated action-item
assignee), `referral_target_analyst` (deactivated + suspended, incl. *"no longer reaches REFERRAL
PHI"*). `referral_target_analyst` was genuinely **Rule 12**: all three arms raw, no role wrapper, and
its only caller `can_read_referral_phi` has every other arm gated — the sole ungated route to referral PHI.

**7 · Over-reach (keystone 23) — none found.** `close_case` · `cancel_case` · `set_case_outcome` ·
`update_case_narrative_body` are all **`prosecdef = f`** in the live catalog — RLS protects them, and
they were correctly **not** swept (A32). The baseline diff (LOST = 0 over 392 pairs) is the positive
proof that nothing legitimate was bound.

**8 · `red ≠ abort` — the harnesses genuinely ran.** I re-ran both myself on this box
(`awk version 20200816` = BSD). M5 **9/9**, M1 **22/22**, all RED-PROVEN. The tri-state is real:
`not ok` → RED-PROVEN, `ok` → GREEN, neither → **ABSENT(aborted)**. `_mut_ungate` **raises**
`MUTATION NO-OP` if the target has no gate to revert, so a mis-aimed mutation cannot read as green.
The `head`/`tail` fix for the BSD-awk bug is real — **M1's 22/22 is now reproducible on this machine**,
which also re-proves M1's denies on the three functions M5 rewrote.

**9 · `231` hygiene.** `begin; … rollback;` wrapped — its flag writes (`case_referrals := false`, to
pin out the LIVE PQS referral arm so only the raw arm is measured) **cannot** corrupt the shared stack,
which is the §7.3 teardown failure. It **sets** the flags then **asserts** them (`231:88–95`) rather
than assuming. `plan(79)`, all 79 pass.

---

## What I could NOT check

- **I did not reset the DB.** Every reading pins to the current stack state (post-e2e, and post-my-own
  harness runs — see MINOR-1). The one state-sensitive result, t19, I chased to ground.
- **I could not observe the pre-M5 catalog directly.** I reconstructed it by stripping the gate from
  live bodies. That proves *the gate's* effect exactly, but it would not detect a **non-gate** delta
  smuggled into the same `create or replace`. The migration asserts *"the ONLY delta in each body is
  the gate"*; I verified the bodies are self-consistent and that the baseline diff is 0, but a true
  byte-diff against pre-M5 needs a reset at `11a5ffd^`.
- **No E2E** (lead-only; would corrupt the shared stack).

---

## Bottom line

**The gate itself is the best-built artifact in this unit's class.** The seven functions are correct,
the two refusals to gate are *right* and I tried hard to break them, the narrowing proof reproduces on
a broader fixture than the one that produced it, the fixtures are non-vacuous, the scope fence held,
the three beyond-brief additions came **with** their own keystones — which is the first time on this
program that an invented fix arrived keystoned — and the awk finding is a genuinely valuable catch
that invalidated a recorded number rather than hiding behind it.

It is **CHANGES REQUESTED** on one thing: the word **"CLOSED"**. The set was closed over `app.*`
predicates and presented as closed over the population. Three live `SECURITY DEFINER` RPCs authorize
on the raw arms with no gate, and a deactivated assignee still reads his case list and his action
items — which is the literal text of defect ③. Gate them or defer them **visibly**; either is fine.
The claim is what has to change.

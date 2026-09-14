# BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS

**Status:** open · **Severity:** critical · **Area:** authz ·
**Opened:** 2026-09-13 (unit [`AE5-STAFF`](../features/ae5-staff.md), round 5's vector ruling) ·
**Owner:** backend · **Fix:** ⛔ **NOT this unit** — see § Resolution

## Symptom

**`app.is_active` gates the MEMBERSHIP arm and nothing else.** A principal who is deactivated
(`profiles.is_active = false`) or suspended (`suspended_until` in the future) still reads through
every **role-free disjunct** in the RLS surface, because those disjuncts carry no `is_active` term
of their own.

## Expected behavior

⛔ Not yet ruled, and the bug does not assume it. Two readings are defensible:

- *deactivation is total* — a deactivated principal reaches nothing, and every disjunct that can
  grant owes an `is_active` conjunct; or
- *deactivation revokes ROLE-derived reach only* — what you reach because a row names **you**
  personally (your own profile, a document you are approver-of-record on) is not role-derived and
  survives.

What is **not** defensible is that the answer is currently decided by which disjunct happens to
carry the term, with nothing written down either way.

## Actual behavior

Measured on the live catalog 2026-09-13, as `gap.deactivated@test.local` (`profiles.is_active =
false`), inside a transaction that was rolled back:

```
app.is_active(gap.deactivated)                      = false
select count(*) from public.accreditation_frameworks = 1    -- the NULL-owner row
select count(*) from public.profiles where id = auth.uid() = 1    -- its own row
```

The five role-free disjuncts, each measured for an `is_active` term:

| site | the role-free disjunct | carries `is_active`? |
| --- | --- | --- |
| `accreditation_frameworks_select` | `owner_commission_id IS NULL` | ⛔ **no** — and it is a PUBLIC arm: it grants EVERY authenticated caller |
| `profiles_select_self_or_admin` | `id = auth.uid()` (the self leg) | ⛔ **no** (the *member* leg of the same policy DOES carry it) |
| `form_matrix_rows_select` / `_columns_select` | `app.can_access_targeted_version(...)` | ⛔ **no** |
| `controlled_documents_select` | `app.is_document_approver_of(...)` | ⛔ **no** |
| `action_items_select` | the `assignees_only` leg (`assigned_to = auth.uid()`, `action_item_assignments`) | ⛔ **no** |

⭐ **The contrast is the finding.** `app.is_member_of` = `app.is_active(auth.uid()) and
app.has_role_any(...)` — the term is right there, at the wrapper level, on the membership path. Every
sibling disjunct beside it omits it. So the same policy can deny a deactivated member through one arm
and grant them through the next.

## Impact

A deactivated or suspended account keeps reading: global accreditation frameworks, its own profile
and membership rows, form versions it is a targeted participant of, controlled documents it is
approver-of-record on, and action items assigned to it.

⚠ **Rated `critical` and deliberately NOT `catastrophic`.** By the register's scale this "returns a
wrong authz answer". It is **not** PHI exposure, **not** a cross-tenant read and **not** data loss:
every row reached is either global by design (the NULL-owner framework) or a row that names the
caller personally. ⛔ A gate record must not describe this as a tenant-isolation failure — measured,
none of the five disjuncts crosses an org boundary.

## Root cause

Not a defect in any one policy — a **missing convention**. `is_active` was applied where the role is
resolved (`app.is_member_of`, `authz.assignment_facts`) and never established as a property of the
*caller* that every granting arm must check. Each disjunct was written against the question it
answers ("is this person the approver?") and none against "may this person act at all?".

## Regression protection

⛔ **NONE TODAY.** No pgTAP cell and no E2E spec constructs "deactivated principal, role-free
disjunct". The `424` differential **observes** the behaviour — at `member_gate_arm =
disjunct_present` the legacy door grants where the catalog denies — but observing is not gating: the
vector will carry those cells as an **approved divergence** (`arm3:divergent-approved:` family,
labelled with this bug id), which pins today's behaviour as expected rather than refusing it.
⇒ whichever way the expected behaviour is ruled, the ruling needs its own cell.

## Related code

`supabase/tests/vectors/authz-enforcement-manifest.json` →
`permissions[*].arm3Door` for the five limb-(b) rows (`commission.accreditation.read`,
`commission.roster.read`, `commission.forms.read`, `commission.documents.read`,
`commission.action_items.read`) · matrix § 5.3's limb (b) · the deny-class table's rows 3 and 4.

## Lesson

⭐ **A guard applied on the path you were thinking about is not a guard on the predicate.** The
`is_active` term looks like a principal-level check and is a *membership-path* check; nothing in the
code says so, and the five siblings that omit it look identical to a reader. The same shape is why
matrix § 5.4 declares the hat **per site** rather than per predicate: a property of the caller, applied
at one arm, reads as a property of the door.

## Resolution

— (open). ⛔ **The fix is not this unit's**: adding `app.is_active` to five policy disjuncts is a
behaviour change across the RLS surface, needs its own red-first differential in both polarities
(a deactivated principal denied, an active one still granted at each of the five), and would move
`424`'s approved-divergence cells. It is named here as its own unit — **`AE5-INACTIVE-DISJUNCT-GUARD`**
— to be scheduled after AE5 increment 1's gate, so that the divergence this unit approves is retired
by a change that is measured rather than assumed.

## 2026-09-14 — row 16 carries two doors that disagree (L11)

Measured live (backend, run-3 diagnosis; confirmed independently by the tester as finding F):
`app.can_read_document(p_document_id, p_uid)` opens with `if not app.is_active(p_uid) then return
false` — an unconditional principal-state gate — while the policy leg `app.is_document_approver_of`
has no `is_active` term. So an inactive approver is denied through the function and granted through
the policy. Ruling L11 (`docs/progress/ae5-staff.md`) keeps the differential's probe on the POLICY
leg because PO ruling P1 was made on that leg; the row's `keyingOverride` is printed by the generator
so the exception stays one visible row. For the fix unit: the guard already exists in one door of
the pair — the question per row is which door is the model, not whether a guard can be written.

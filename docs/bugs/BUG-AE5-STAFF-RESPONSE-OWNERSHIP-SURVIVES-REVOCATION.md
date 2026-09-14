# BUG-AE5-STAFF-RESPONSE-OWNERSHIP-SURVIVES-REVOCATION

**Status:** open · **Severity:** high · **Area:** responses / authz ·
**Opened:** 2026-09-13 (unit [`AE5-STAFF`](../features/ae5-staff.md), T1's derivation) ·
**Filed from:** [`authz-ae5-staff-permission-matrix.md`](../design/authz-ae5-staff-permission-matrix.md) § 8.1

> ⭐ **THIS WAS PA-F8-STAFF-1 UNTIL 2026-09-13 AND IS NO LONGER.** It was raised as a
> legacy-vs-catalog divergence of the matrix's row 2. The PO ruled § 11 item 7 **option (A)** —
> the code is `commission.responses.create` and governs CREATION ONLY — so there is no permission
> row for this behaviour to diverge *from*, and it moves here.
> ⛔ **Withdrawing the PA-F8 label did NOT downgrade the finding.** The transcript below is the one
> that was measured; only its register changed.

## Symptom

A user whose `staff` membership has been revoked keeps their in-progress response draft, can still
edit it, and can still **submit** it — producing a `submitted` response (immutable and counted on
the dashboards, Architecture Rule 3) authored by someone who is not a member of the commission.

## Expected behavior

Not yet ruled. Two readings are defensible and the PO has not chosen between them:

- *finish what you started* — a draft is the author's, and revoking membership should not destroy
  work in progress; or
- *a counted artifact needs a member* — a `submitted` response feeds the commission's statistics,
  so authorship by a non-member is a data-integrity defect.

⛔ This bug does **not** assert which. It asserts that the behaviour is currently **unstated
anywhere** and is produced by no deliberate rule.

## Actual behavior

Measured end to end on the live local catalog, 2026-09-13, inside a transaction that was rolled
back (persona `staff4.ccih@test.local`, a clean plain-`staff` member of CCIH):

```
1. as authenticated, member of CCIH : insert into public.responses(...)          -> INSERT 0 1
2. as postgres : delete from public.memberships where principal_id = <staff4>
                 and commission_id = <CCIH>                                       -> DELETE 1
3. as authenticated again          : app.is_member_of(CCIH)                       = false
4.                                  : the draft is still visible                  (1 row)
5.                                  : update public.responses set updated_at=now() -> UPDATE 1
6.                                  : select public.submit_response(<draft>)       -> status = 'submitted'
```

## Impact

A commission's submitted-response counts — the product's whole reason for existing (CLAUDE.md § 1:
*statistics come from dashboards instead of manual tabulation*) — can include rows authored by a
non-member. No PHI is exposed and no tenant boundary is crossed: the author is still the row's
`created_by` and still had membership when the draft was created. Rated **high** rather than
critical for that reason; ⚠ the PO may raise it if the counted-artifact reading is the intended one.

## Root cause

Not a defect in any single policy — every one behaves as written. It is a **seam**: exactly ONE
membership gate exists in the whole response family, and it is at creation.

| site | predicate | membership? |
| --- | --- | --- |
| `responses.responses_insert_own` | `created_by = auth.uid() AND app.is_member_of(commission_id)` | ✅ the only one |
| `responses.responses_update_own_draft` | `created_by = auth.uid() AND status = 'in_progress'` | ❌ ownership |
| `responses.responses_delete_own_draft` | `created_by = auth.uid() AND status = 'in_progress'` | ❌ ownership |
| `answers.answers_write_own_draft` | the owning response's `created_by` | ❌ ownership |
| `response_group_instances.…_write_own_draft` | the owning response's `created_by` | ❌ ownership |
| `answer_selected_options.…_write_own_draft` | the owning response's `created_by` | ❌ ownership |
| `public.submit_response` | ⛔ **`prosecdef = f` (INVOKER) with NO membership gate in its body** | ❌ relies wholly on `responses_update_own_draft` |

⚠ The TS guard `src/lib/responses/actions.ts:282-287` (`authorizeMember`) *does* check membership,
but it is defence in depth by its own comment (`:30-35`) and a direct PostgREST call never reaches
it. **The DB path is `authenticated` → RLS on `public.responses`.**

## Regression protection

⛔ **NONE TODAY**, and that is part of the filing. No pgTAP cell and no E2E spec constructs
"membership revoked while a draft is open". Whichever way the PO rules, the ruling needs a cell:

- under *finish what you started*, an assertion that the lifecycle **survives** revocation — so a
  later re-key cannot silently remove it (T7 is exactly when that could happen: re-keying the five
  ownership policies to a membership permission would break every lapsed member's draft, and it
  would look like tidying up);
- under *a counted artifact needs a member*, an assertion that `submit_response` **refuses**, plus
  a decision about drafts already open when membership ends.

## Related code

`supabase/tests/vectors/authz-enforcement-manifest.json` → `permissions["commission.responses.create"].armInterface`
(the two declared sites) · matrix § 5.1 (the ownership exclusion) · § 5.2 row 2 · § 8.1 (the
transcript) · § 11 item 7 (the ruling).

## Lesson

⭐ **A permission code's INTERFACE decides whether a behaviour is a divergence or a bug.** Under the
withdrawn name (`commission.responses.fill`, implicitly spanning the lifecycle) this was a
legacy-vs-catalog divergence needing a PA-F8 disposition and a cell in the differential oracle.
Under `commission.responses.create` it is a product question about a path no permission governs.
⛔ Nothing about the system changed between those two readings — only what the code claimed to
cover. A divergence register that does not pin the interface will accumulate entries that belong
somewhere else.

## Resolution

— (open)

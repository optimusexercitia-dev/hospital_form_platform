# FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T7; lead ruling L24, superseding L17) · **Owner:** backend
**Severity:** high — the live defect is CLOSED; what stays open is that no gate would have caught it,
and the same shape is available to every future re-key.
**Status:** open

## The shape, in one sentence

410 § 6.2 measures a row's hard-deny classes as the transitive closure over the call graph at its
declared sites — so a deny class **present somewhere in the closure** reads as satisfied even when
the arm that actually grants **walks around it**.

## What happened

AE5 T7 wrote row 9's member-surface door, under lead ruling L17, as a disjunction:

```sql
-- app.can_cases_deliberation_read(p_case_id uuid, p_user_id uuid) — AS L17 SPECIFIED IT.
-- ⛔ THIS IS THE FIXTURE. Keep it verbatim: it is the exact text the closing gate must red on.
select authz.has_permission(
         p_user_id, 'commission',
         (select c.commission_id from public.cases c where c.id = p_case_id),
         'commission.cases.deliberation.read')
    or app.has_case_capability(p_case_id, p_user_id, 'read_case_deliberation');
```

The **second** disjunct routes through `app._case_caps`, which applies STEP-4's
`app.is_case_respondent` / `app.is_recused_from_case` hard denies and guards its S5
member-default arm with `not v_eg` (`visibility_policy = 'explicit_grants_only'`). The **first**
disjunct applies none of them, and one true disjunct grants.

Measured consequences, from the suites that build those states:

| suite | assertion | have | want |
| --- | --- | --- | --- |
| 233 M6·7 (1/3) | `explicit_grants_only ⇒ a plain member does NOT reach the case` | `true` | `false` |
| 233 M6·7 | `the EXCLUDED respondent does not reach the case even under commission_default` | `true` | `false` |
| 241 K5 | member without substance reach reads NULL summary | `RESUMO_EG` | `NULL` |
| 242 K14 | NULL `discussion_notes` | `NOTAS_DELIB` | `NULL` |
| 243 A26 | NOT the withdrawal names under `explicit_grants_only` | `WD_B` | `NULL` |
| 228 QA MAJOR-3 | `summary` MASKED | `Deliberação ética confidencial sobre o Dr. X` | `NULL` |

This is Class-1 case-deliberation content (Architecture Rule 12).

## Why the gate that exists did not see it

Row 9's committed `hardDenyClasses` is `["principal_inactive", "respondent_exclusion"]`, and
410 § 6.2 measured it as **satisfied** on the defective catalog. It is not a stale claim and the
closure is not broken: the closure genuinely reaches `app.is_case_respondent` — down the *second*
disjunct, inside `_case_caps`. The instrument asks **"is this class reachable from the declared
sites?"**; the question that mattered was **"is this class applied on EVERY disjunct of the door's
grant expression?"** A closure over a call graph cannot tell `A or B` from `A and B`.

The same blindness covers 410 § 8.1 (the site reaches the code — it did), § 3.5 (the composedWith
authority is present at its site — it was), and the manifest's `residualLegacyAuthority`
declaration, which under L17 correctly recorded `app.has_case_capability` as an arm beside the
permission and said nothing about the two arms having **different deny closures**.

## Closes when

A gate proves, for every re-keyed row, that each declared hard-deny class is applied on **every
disjunct** of the door's grant expression — not merely reachable from it — and that gate is shown
**able to red** on the fixture above (the door exactly as L17 wrote it), planted and rolled back.

A green-on-first-run closing gate is vacuous here and must be treated as a finding: the door's
current single-arm form satisfies "every disjunct" trivially, so the discrimination half is the
whole proof.

## What was done instead, now

Lead ruling **L24** (superseding L17) removed the permission disjunct. Row 9's member-surface door
is now

```sql
select app.has_case_capability(p_case_id, p_user_id, 'read_case_deliberation');
```

and the permission is enforced one level down, inside `app._case_caps`'s S5 arm, through the
commission-keyed sibling `app.can_cases_deliberation_read_in_commission` — i.e. *subject to* the
hard denies and the `explicit_grants_only` guard rather than beside them. Row 9's
`residualLegacyAuthority` was withdrawn (nothing residual remains) and the grant chain is declared
hop by hop so 410 § 8.1 walks it under ruling L23.

Witnesses on a fresh reset (subject `00000000-…-000a`):

| case | conditions | `_case_caps` | door | member surface |
| --- | --- | --- | --- | --- |
| `d0000000-…-00c1` `commission_default` | plain member, no case grant | 2 | `t` | `t` |
| same | `staff`'s role-permission grant DELETED | 0 | `f` | `f` |
| same | restored | 2 | `t` | — |
| `ca000000-…-00e1` `explicit_grants_only` | **EXCLUDED respondent**, holding the `staff` role AND an explicit `read_case_deliberation` grant | **0** | **`f`** | **`f`** |

228, 233, 241, 242, 243 are green.

## Note for whoever closes this

The fixture is the SQL block at the top of this file. Do not reconstruct it from the migration —
`20261003007470_ae5_staff_t7_rekey.sql` carries the corrected single-arm form, and migration file
text is stale by design (ADR 0078). This file is the only place the defective text survives, which
is why it is quoted here verbatim rather than referenced.

# AE1.1 — `commission_administrativos` FKs: preflight, derivation, and migration contract

**Phase:** AE1 (`docs/plans/authz-evolution.md`, AE1.1 / audit finding **F7**) · **authority:**
ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D9 ·
**owner:** lead · **measured:** 2026-08-26 · **branch:** `authz-ae1-hardening` ·
**heads:** local `20261003004300` == remote `20261003004300`.

⛔ **This is the preflight record, not the migration.** It exists because the plan requires
the `ON DELETE` behaviour to be **derived from how the sibling appointment table behaves,
not guessed**, and requires the cascade closure to be checked before the FKs land. Both are
done here, with their queries, so the migration can be written straight from this file and
so the derivation is not re-litigated later.

## 1. The defect (F7)

`public.commission_administrativos` carries **exactly one** FK — `appointed_by → profiles(id)`.
Its two identifying columns, **`commission_id` and `user_id`, have no FK at all**, so the
table can hold appointments pointing at commissions and people that no longer exist.
Measured on both stacks: `existing_fk_count = 1`.

## 2. Orphan preflight — both stacks, positive-controlled

| probe | local | remote |
| --- | ---: | ---: |
| `commission_administrativos` rows | 1 | **1** |
| orphaned `commission_id` (no `commissions` row) | **0** | **0** |
| orphaned `user_id` (no `profiles` row) | **0** | **0** |
| **CONTROL** — the identical `not exists` shape against a known-absent uuid | 1 | **1** |
| `commission_administrativo_capabilities` rows | — | 5 |

The control is what makes the zeros admissible: the same `not exists` shape **does** return
non-zero when pointed at a uuid that is absent, so the zeros are a measurement and not a
stuck-false probe.

```sql
select count(*) from public.commission_administrativos a
  where not exists (select 1 from public.commissions c where c.id = a.commission_id);
select count(*) from public.commission_administrativos a
  where not exists (select 1 from public.profiles p where p.id = a.user_id);
-- control: same shape, uuid known absent
select count(*) from public.commission_administrativos a
  where not exists (select 1 from public.commissions c
    where c.id = '00000000-0000-0000-0000-000000000000'::uuid);
```

⚠ **Stated bound: this preflight has LOW POWER.** Both stacks hold **one** row. "Zero
orphans over one row" is enough for `VALIDATE CONSTRAINT` to succeed, and it is **not**
evidence about how the constraint behaves under real data. AE1.1 step 2 ("repair
deliberately, a decision per orphan class") is therefore a **no-op by measurement**, not a
class of orphans anyone ruled on.

## 3. `ON DELETE` — DERIVED, not chosen

The plan: *"derive from how the sibling appointment table behaves, do not guess"*. The
sibling is `public.memberships`, the platform's other appointment table, and its FKs show a
consistent, deliberate split:

| FK | `ON DELETE` | role in the row |
| --- | --- | --- |
| `memberships_principal_id_fkey → profiles(id)` | **CASCADE** | the **subject** |
| `memberships_commission_id_fkey → commissions(id)` | **CASCADE** | the **scope** |
| `memberships_organization_id_fkey → organizations(id)` | **CASCADE** | the scope |
| `memberships_hospital_id_fkey → hospitals(id, organization_id)` | **CASCADE** | the scope (composite) |
| `memberships_granted_by_fkey → profiles(id)` | *(none — NO ACTION)* | the **actor** |
| `memberships_title_id_fkey` | SET NULL (`title_id`) | an optional attribute |

⭐ **The rule the platform already follows: the SUBJECT and the SCOPE cascade; the ACTOR
restricts.** `commission_administrativos.appointed_by` — an *actor* column — already carries
no `ON DELETE`, exactly matching `memberships_granted_by_fkey`. The existing child
`commission_administrativo_capabilities` already cascades from the appointment via
`(commission_id, user_id) → commission_administrativos ON DELETE CASCADE`.

**Therefore, derived rather than defaulted:**

- `commission_id → commissions(id)` **ON DELETE CASCADE** (scope)
- `user_id → profiles(id)` **ON DELETE CASCADE** (subject)

## 4. Cascade closure — what these FKs newly make deletable

The plan's warning: *"a write lockdown is defeated by its parent, so check what these FKs
newly make deletable."* Measured:

| parent | `authenticated` DELETE grant | DELETE-covering policy | DELETE trigger guard |
| --- | --- | --- | --- |
| `profiles` | true | — | ✅ **`guard_profile_no_delete_trg`** |
| `commissions` | true | `commissions_admin_write` (`cmd = ALL`, so it covers DELETE) | **(none)** |

- **`profiles`** — deletion is blocked by a guard trigger, so the new `user_id` CASCADE is
  effectively unreachable through ordinary deletion. It exists for correctness, not as a
  live path.
- **`commissions`** — deletion **is** reachable today by an admin under
  `commissions_admin_write`, with no trigger guard. ⚠ **But these FKs do not newly enable
  that delete.** With no FK, the delete already succeeds and *leaves orphans* — which is
  F7 itself. The FK changes the delete's **effect** (orphans → cascade-cleaned), not its
  **reachability**. That is strictly an improvement, and it is the point of AE1.1.

### Rule 11 holds through the cascade — checked, not assumed

A cascade that silently removed authorization-relevant rows **without an audit event**
would breach Architecture Rule 11. It does not:

| table | trigger | covers |
| --- | --- | --- |
| `commission_administrativos` | `trg_audit_administrativo` | `tgtype = 13` = ROW + INSERT + **DELETE**, AFTER |
| `commission_administrativo_capabilities` | `trg_audit_administrativo_capabilities` | present |

Postgres fires **row-level** triggers on cascaded deletes, so each cascaded row emits its
audit event. ⚠ The contrast worth remembering: **`TRUNCATE` fires no DELETE trigger at
all** — so this guarantee holds for cascade and **not** for a "clean up the test data with
TRUNCATE" shortcut.

## 5. Migration contract

- **Timestamp range: `20261003004400`–`20261003004499`** (head `20261003004300`; AE1.2 holds
  004500, AE1.3 holds 004600–004699).
- **The production-safe sequence, required by the plan:** add each FK **`NOT VALID`** first,
  then **`VALIDATE CONSTRAINT`** in a separate statement — `NOT VALID` takes a weaker lock
  and does not scan the table, and `VALIDATE` then scans without blocking writes.
- ⛔ **No top-level `SET LOCAL`** — it is a silent no-op outside a transaction (Postgres
  warns `25P01` and continues), which passes every local gate. Use one `do $$` block if a
  session setting is needed. `lint:set-local`'s watermark is **never** bumped to pass.
- ⛔ **Forward-only.** An applied migration is never edited, local DB included
  (`.claude/rules/migrations-forward-only.md`).
- **pgTAP: file 383** (high-water 381; **376 is a genuine numbering gap, not a missing
  file**; 382 is AE1.6's, 384–386 are AE1.3's). Assertions: **both FKs present by name**,
  each with its `ON DELETE` behaviour asserted (not merely its existence — a FK with the
  wrong `ON DELETE` passes an existence check), plus **a rejected-orphan insert for each**.
- ⚠ **The orphan-rejection tests are the ones that can go vacuous.** An insert that fails
  for an unrelated reason (a NOT NULL, a different FK, an RLS denial) passes a
  "throws" assertion while proving nothing. Assert on the **SQLSTATE `23503`
  (foreign_key_violation)** and the **constraint name**, not merely that something threw.

## 6. What AE1.1 does NOT do

It does not touch `appointed_by` (already correct, and matching the sibling's actor
posture), does not add an FK to `commission_administrativo_capabilities` (it already has
its composite FK to the appointment), and does not change any policy or grant — so AE1.1
alone triggers no diff-scoped door sweep. The phase's sweep obligation comes from AE1.3 and
AE1.5.

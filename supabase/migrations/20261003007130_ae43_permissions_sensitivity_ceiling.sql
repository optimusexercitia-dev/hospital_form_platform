-- AE4.3 — `authz.permissions.sensitivity_ceiling`. PO ruling 2026-09-01.
-- Matrix: docs/design/authz-ae43-staff-admin-permission-matrix.md § 9 · ADR 0172 § 4 (amended).
--
-- ============================================================================
-- ⛔ WHY THIS IS A NEW MIGRATION AND NOT AN EDIT TO 20261003007100.
-- 007100 is committed. It is unpushed and only this machine has applied it, so an edit
-- would "work" — and it would make ADR 0172's account of what 007100 did FALSE. Migrations
-- are forward-only precisely so the record of a reversal survives the reversal. This file
-- IS that record.
--
-- ⭐ WHAT REVERSED, AND WHY THE ORIGINAL REASONING WAS NOT WRONG.
-- ADR 0172 § 4 deferred `sensitivity_ceiling` on the grounds that `authz.permissions` held
-- ZERO ROWS, so a CHECK pinning a value that no row holds is itself vacuous — it would add
-- exactly the label the residue rule exists to forbid. That reasoning was correct when
-- written. **AE4.3 created the subjects**, so the stated reason EXPIRED. The other half of
-- the residue — the ORDERING / COMPARISON rule — is untouched and stays deferred.
--
-- ⚠ THE VALUE SET IS THREE, NOT THE BINARY FIRST PROPOSED, AND THE THIRD VALUE WAS FOUND BY
-- CHECKING THE COLUMN'S SUBJECTS BEFORE PINNING IT. `staff_admin` holds a Class-2
-- professional-identity capability through `app.can_manage_professional`, which gates 13
-- functions over `public.professional_profiles` (`full_name`, `license_number`,
-- `license_region`, `specialty`, `cpf`). Under a binary `none | phi` those rows would
-- classify as:
--     `none` -> drops a real sensitivity: a label, not a control — the exact failure this
--               column exists to prevent; or
--     `phi`  -> legally wrong: Rule 12 keeps Class-1 patient PHI and Class-2 professional
--               identity distinct classes with distinct regimes.
-- Neither is acceptable, so the partition carries all three classes that HAVE subjects.
--
-- ⛔ `restricted_personal` (Axis 7) is DELIBERATELY ABSENT. AE3 moved `cpf` /
-- `date_of_birth` / `phone` into door-only `public.profile_private_details`, which
-- `staff_admin` does not hold — so it would be a value with no row, which is the same
-- vacuity that justified deferring this column in the first place. Add it with its first
-- subject, not before.
-- ============================================================================

create domain authz.sensitivity_class as text
  constraint sensitivity_class_check check (
    value in ('none', 'class2_professional_identity', 'phi')
  );

comment on domain authz.sensitivity_class is
  '⛔ A PARTITION, NOT A LADDER — and the domain is named for what it IS while the column '
  'keeps the name ADR 0155, the audit and the plan all use. NO ORDERING IS DEFINED over '
  'these values and none may be inferred: `class2_professional_identity` is not "less than" '
  '`phi`, it is a DIFFERENT regime (Rule 12 — Class-1 patient PHI vs Class-2 professional '
  'identity). The ordering / comparison rule is the half of the §8 residue that remains '
  'DEFERRED. ⚠ Nothing may compare two values of this domain with <, >, or BETWEEN; pgTAP '
  '401 §13.5 enforces that abstinence with a constructed detector, because the column''s '
  'name invites exactly the misuse the domain forbids. AE5 grows this into a real ladder '
  '(splitting `phi` into standard/restricted) via `alter domain ... drop constraint` + '
  '`add constraint` — the amendable path ADR 0172 §5 chose an enum against.';

-- ⛔ NOT NULL, AND DELIBERATELY **NO DEFAULT** — a small, reasoned strengthening of the
-- approved terms, which named `default 'none'`.
--
-- With zero rows there is no backfill, so a default buys nothing at all. What it would COST
-- is real: `'none'` is the PERMISSIVE value, so an INSERT that forgets this column would
-- silently classify a PHI permission as unclassified. That is the "guards that read right
-- but fail open" shape — the failure is invisible precisely because the row looks complete.
-- Requiring every permission to DECLARE its sensitivity is what makes the column a control
-- rather than a report; AE4.3's own § 9 argument applies to the column's own defaults.
alter table authz.permissions
  add column sensitivity_ceiling authz.sensitivity_class not null;

comment on column authz.permissions.sensitivity_ceiling is
  'The sensitivity class a holder of this permission may reach. ⚠ NAMED for a ceiling, '
  'TYPED as a partition — see the domain comment; `sensitivity_ceiling` is retained because '
  'ADR 0155, the plan-audit and the plan all use it and AE5 grows it into a real ladder. '
  '⛔ NO DEFAULT, on purpose: `none` is the permissive value, so a defaulted column would '
  'let a forgotten INSERT classify a PHI permission as unclassified and look complete doing '
  'it. Every permission declares its own sensitivity. '
  '⭐ THIS IS WHAT MAKES AE4.1''s PHI-SEPARATION INVARIANT A CONTROL RATHER THAN A STRING '
  'MATCH: pgTAP 401 §7 can now join on a COLUMN for the class, instead of the invariant '
  'degrading to a substring test on a permission code that a rename would silently defeat.';

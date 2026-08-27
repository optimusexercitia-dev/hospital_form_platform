---
paths:
  - "supabase/migrations/**"
broad: >-
  The tempting "fix" is a migration, and it could be any migration — a GRANT, a guard
  rewrite, a GUC exemption. A narrower glob leaves unguarded whichever file someone is
  actually about to write.
anchors:
  - supabase/tests/386_person_doors_acl_and_guard.sql#a signed-in caller CANNOT self-elevate to is_admin
  - supabase/tests/386_person_doors_acl_and_guard.sql#profiles_update_self
  - supabase/migrations/20261003004610_person_profile_doors.sql#the guard is the ONLY thing stopping self-elevation
source: ADR 0161 · docs/plans/authz-ae1-person-doors.md §6.3 (ruled R6)
---

# `guard_profile_privileged_columns`' trusted-caller arm is NEVER widened

⛔ **Forbidden:** widening `if auth.uid() is null then return new` — including via any
transaction-local GUC exemption — and granting `authenticated` EXECUTE on any person door
(`finalize_invited_person_for`, `update_person_fields_for`, `set_person_active_for`,
`suspend_person_for`).

✅ **Allowed:** a privileged `profiles` write through a `service_role`-only `_for` door:
`auth.uid()` is NULL there, so it takes the trusted-caller return untouched.

## Why granting it to `authenticated` is a vulnerability, not a fix

- `authenticated` **already holds column UPDATE on `is_admin`, `is_active`,
  `suspended_until`** (measured — the column grant is NOT the protection), and
  `profiles_update_self` already permits `USING (id = auth.uid())`. So
  `UPDATE profiles SET is_admin = true WHERE id = auth.uid()` is allowed by RLS **and** by
  the grant: this guard is the only thing stopping it.
- Any custom GUC is settable via `set_config` **by the very caller it would exclude**.

⚠ Granting a door to `authenticated` fails LOUDLY — all four `profiles` doors start raising
`check_violation`. **That red is the guard working.** Call the door as `service_role`;
never make the guard stop objecting.

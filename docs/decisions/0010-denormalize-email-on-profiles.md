# 0010 — Denormalize email onto public.profiles

Date: 2026-06-12
Status: Accepted
Phase: 3 (Admin Area & User Management)

## Context

The admin commission detail and the commission member list must display each
user's email. The canonical email lives in `auth.users.email`, which the
PostgREST data API cannot read under RLS (the `auth` schema is not exposed to
`authenticated`). `public.profiles` carried only `full_name`.

We need emails visible to exactly the right audience — the user themselves,
co-members of a shared commission, and global admins — which is precisely the
audience the existing `profiles_select_self_or_admin` policy (M6) already grants.

## Options considered

1. **Denormalize `email` onto `public.profiles`** (chosen). One nullable
   `citext` column, populated by the signup trigger, backfilled from
   `auth.users`, kept fresh by an `auth.users` email-change sync trigger, and
   guarded by a partial unique index.
2. **A `security definer` RPC / view over `auth.users`.** Would need its own
   grants and would re-implement the member-visibility logic that
   `profiles_select_*` already encodes — duplicating access control and adding
   a second place that can drift.
3. **Service-role read on the display path.** Rejected outright: the service
   role bypasses RLS, so every list render would lean on application code for
   access control instead of the database boundary (Architecture Rule 1).

## Decision

Option 1. Email rides on the existing `profiles_select_*` policies, so it
becomes visible to exactly co-members + admins with **zero new policy surface**
and **no service-role reads on the display path**. The service role stays
confined to the inherently-privileged invite/lookup writes in the Phase 3
server actions.

Implementation (migration `20260612100009_profiles_email.sql`):

- `profiles.email extensions.citext` (nullable — `profiles` is the never-deleted
  identity table and is never rewritten/NOT-NULL'd; `citext` for
  case-insensitive match + dedupe, consistent with `commissions.slug`).
- Backfill from `auth.users`.
- `handle_new_user()` (signup trigger) updated to also insert `new.email`.
- New `sync_profile_email()` + `after update of email on auth.users` trigger so
  the copy never goes stale when Supabase changes a user's auth email — closing
  the one cost of denormalization in-band rather than deferring it.
- `profiles_email_key` partial unique index (`where email is not null`) prevents
  two profiles from sharing an email while tolerating any legacy null rows.

## Consequences

- Member/admin-user lists resolve emails through ordinary RLS-scoped reads; no
  new RPC, view, or grant.
- The denormalized copy is kept correct by triggers on both create and change;
  `auth.users` remains the source of truth.
- The denormalized `email` also lets `resolveOrInviteUser` (Phase 3 invite flow)
  resolve an existing user by an exact, case-insensitive `profiles` lookup
  instead of paginating `auth.admin.listUsers`.

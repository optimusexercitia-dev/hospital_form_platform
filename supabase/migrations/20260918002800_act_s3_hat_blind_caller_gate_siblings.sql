-- ACT Stage 3 (ADR 0106 D5/D11) — the TWO remaining hat-blind CALLER gates.
--
-- Found by the Stage 3 QA review (BLOCKER-1 + MAJOR-1), both proven live against
-- this catalog before this migration was written. They are a FOURTH class of
-- hat-blindness, distinct from the three the build already closed:
--
--   class 1  application guards deriving from a hat-blind session_context
--   class 2  context.isAdmin reading the raw JWT claim
--   class 3  non-boolean DEFINER doors reading `memberships` raw
--   class 4  THIS — a boolean gate that RECEIVES the caller's uid as a parameter
--            instead of reading auth.uid() itself.
--
-- Class 4 was missed because the S3 sweep classified `*_for(uuid)` helpers as
-- "third-party doors, correctly hat-independent" from the SIGNATURE SHAPE. That
-- is only true if no call site binds the parameter to the caller. Two do. The
-- repo's own standing lesson: the boundary of an enumeration must be the
-- PROPERTY (does this call gate the caller?), never the syntax (does it take a
-- uuid?). `docs/plans/act-as-buildnotes.md` asserted the opposite as settled
-- fact; that paragraph is corrected in the same commit as this file.
--
-- ── 1. app.is_admin_for(uuid) ──────────────────────────────────────────────────
-- Its no-arg sibling `app.is_admin()` gained the D11 active-role condition in
-- `20260918002200`; this one was left as a "third-party door". But BOTH of its
-- only two callers — `app.grant_role_impl` and `app.revoke_role_impl` — receive
-- `p_actor` from `public.grant_role`/`revoke_role`, which bind it to
-- `(select auth.uid())`. So `is_admin_for(p_actor)` IS the caller gate on the
-- membership-grant door, and it was hat-blind: a platform_admin wearing any
-- other hat could grant/revoke org_admin and hospital_admin memberships, which
-- is precisely the escalation D11 exists to refuse. Proven live: with
-- active_role='staff', `is_admin()` = false while `is_admin_for(self)` = true
-- and `grant_role_impl` SUCCEEDED.
--
-- ── 2. app.can_manage_professional(uuid, uuid) ─────────────────────────────────
-- Its raw `memberships` arm — the EXPIRED-staff_admin compensating clause that
-- ACT Stage 2 deliberately preserved so a behaviour-preserving refactor would
-- not smuggle an authz change — carries no hat condition, so it admits a caller
-- whose active hat is not staff_admin. It gates 10 Class-2 professional-identity
-- / ethics-vocabulary write RPCs. Every OTHER arm of this function is already
-- hat-aware (`is_admin()`, `is_org_admin_of()`, `has_role(...)`).
--
-- ⚠ This migration fixes ONLY the hat-blindness, NOT the expiry quirk. An
-- expired staff_admin still passes this arm — it now additionally has to be
-- WEARING the staff_admin hat. BUG-ACT-EXPIRY-1 stays open with its disposition
-- unchanged (the expiry fix is a genuine tightening and needs its own change and
-- its own gate). Do not "simplify" this clause without closing that bug first.
--
-- ── The shape of the fix ───────────────────────────────────────────────────────
-- Both use the house CALLER-ONLY pattern already carried by `app.has_role`:
--
--     and (<target> is distinct from auth.uid()          -- a third party: unchanged
--          or <hat> is not distinct from '<role>')       -- the caller: hat required
--
-- This preserves third-party semantics EXACTLY (asking whether some OTHER user
-- holds an entitlement must never depend on the asker's hat — ADR 0106 §2), and
-- `IS NOT DISTINCT FROM` (never `=`) is load-bearing: `app.active_role()` is
-- NULL for a hatless caller, and `x = NULL` is NULL, which a PL/pgSQL `if not`
-- treats as false-ish — the fail-OPEN this program already shipped once and
-- caught as BUG-ACT-NULLHAT-1.
--
-- CREATE OR REPLACE only — no DROP/CREATE, so the ACLs
-- ({postgres,authenticated,service_role} = EXECUTE), SECURITY DEFINER, STABLE,
-- and the `search_path` setting all survive untouched (a rebuild silently drops
-- properties the original carried — the standing lesson).

create or replace function app.is_admin_for(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and is_admin = true
  )
  -- ACT (ADR 0106 D11), CALLER-ONLY: when the question is about the CALLER, the
  -- platform_admin hat must be active. A question about a THIRD PARTY is
  -- unchanged — one principal's hat must never alter what the system concludes
  -- about another. Mirrors app.has_role's own condition, and the entitlement
  -- clause it now guards is identical to app.is_admin()'s profiles fallback.
  and (p_user_id is distinct from (select auth.uid())
       or app.active_role() is not distinct from 'platform_admin');
$$;

comment on function app.is_admin_for(uuid) is
  'Is this principal a platform_admin? CALLER-ONLY hat condition (ADR 0106 D11): '
  'when p_user_id is the caller, the platform_admin hat must be ACTIVE; a '
  'third-party question is hat-independent by design. Both live callers '
  '(grant_role_impl / revoke_role_impl) bind p_actor to auth.uid(), so this is '
  'the caller gate on the membership-grant door — it is NOT a pure third-party '
  'helper, whatever its signature suggests. Keystone: 318.';

create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select p_uid is not null and (
    coalesce(app.is_admin(), false)
    or app.is_org_admin_of(p_org)
    or exists (
      select 1 from public.commissions c
      where c.organization_id = p_org
        and (
          app.has_role('commission', c.id, 'staff_admin', p_uid)
          or (
            exists (
              select 1 from public.memberships m
              where m.commission_id = c.id
                and m.principal_id = p_uid
                and m.role = 'staff_admin'
                and m.expires_at is not null
                and m.expires_at <= now()
            )
            -- ACT (ADR 0106 D5), CALLER-ONLY. ⚠ This arm is the EXPIRED-membership
            -- compensating clause Stage 2 preserved on purpose (BUG-ACT-EXPIRY-1);
            -- its expiry semantics are UNCHANGED here — an expired staff_admin
            -- still passes. What changes is that the caller must now be WEARING
            -- the staff_admin hat, closing the hat-blindness without smuggling
            -- the tightening that bug owns.
            and (p_uid is distinct from (select auth.uid())
                 or app.active_role() is not distinct from 'staff_admin')
          )
        )
    )
  );
$$;

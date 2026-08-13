-- ACT Stage 3 (ADR 0106 D11) — is_admin() gains the active-role condition.
--
-- PO ruling 2026-08-10: implement NOW (not deferred to Stage 4). D11's own
-- text: "is_admin() reads profiles.is_admin, so has_role filtering would not
-- reach it; is_admin() gains the same active-role condition."
--
-- Measured blast radius: 26 RLS policies + 17 functions call app.is_admin()
-- as executable code (comment-stripped `prosrc` sweep, 928 functions
-- scanned — 2 raw-grep hits were comment-only false positives:
-- app.revoke_role_impl and public.list_referral_target_commissions, neither
-- calls the niladic is_admin() at all, both call is_admin_for(p_actor) with
-- an explicit third-party argument). is_admin() takes NO argument -- every
-- one of the 17 real callers and all 26 policies is structurally a CALLER
-- check (auth.uid() is read internally; there is no way for a caller of a
-- niladic function to redirect it to check someone else). app.is_admin_for
-- (p_user_id) is the pre-existing, deliberately separate third-party door --
-- UNTOUCHED here, and correctly so: it has no auth.uid()/active_role()
-- dependency at all, so a third-party admin check stays hat-independent by
-- construction, not by a new carve-out.
--
-- Empirically a no-op TODAY (proven in docs/plans/act-as-buildnotes.md Stage
-- 3, incl. a synthetic multi-role platform_admin fixture -- the only row
-- that can distinguish old vs new): 0 platform_admins hold any membership in
-- seed, so every one is single-role, the hook derives 'platform_admin'
-- implicitly (D11 break-glass), and the new condition is satisfied
-- trivially. It only bites a platform_admin who ALSO holds a membership.

-- ── app.is_admin() gains the condition ──────────────────────────────────
-- Same NULL-safety shape as has_role/has_role_any (BUG-ACT-NULLHAT-1): a
-- plain `=` against app.active_role() is NULL for a hatless caller, and
-- `TRUE AND NULL` is NULL, not FALSE -- IS NOT DISTINCT FROM is used again.
create or replace function app.is_admin()
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_claim text;
  v_is_admin boolean;
begin
  v_claim := nullif(current_setting('request.jwt.claims', true), '');
  if v_claim is not null and (v_claim::jsonb ->> 'is_admin') = 'true' then
    v_is_admin := true;
  else
    v_is_admin := exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    );
  end if;

  -- ACT (ADR 0106 D11): the caller must ALSO be currently ACTING AS
  -- platform_admin, not merely hold the underlying entitlement.
  return v_is_admin and (app.active_role() is not distinct from 'platform_admin');
end;
$function$;

-- ── public.assume_role's platform_admin branch — fixed, not left to rot ──
-- ⚠ FOUND during the third-party/caller-only sweep this migration required
-- (not a pre-existing bug -- introduced by the possibility of THIS
-- migration, caught before it shipped): assume_role's own validation for
-- p_role = 'platform_admin' called app.is_admin() to check ELIGIBILITY to
-- ACQUIRE the platform_admin hat. Once is_admin() itself requires the
-- active_role claim to ALREADY be 'platform_admin', that check becomes
-- circular for the one population it exists to serve -- a multi-role
-- platform_admin (today: none; the exact case this migration's tripwire
-- guards) could never pass assume_role('platform_admin') from any OTHER
-- hat or from a fresh hatless session, because is_admin() would require the
-- very hat they are trying to acquire. Fixed by checking the RAW
-- entitlement (profiles.is_admin) directly -- the same shape the function's
-- OWN else-branch already uses for ordinary roles (a raw `memberships`
-- existence check, never has_role/has_role_any, for the identical reason:
-- assume_role answers "am I entitled to switch to this", not "is this my
-- current hat"). CREATE OR REPLACE, signature unchanged.
create or replace function public.assume_role(p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_holds boolean;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  v_session_id := nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'),
    ''
  )::uuid;
  if v_session_id is null then
    raise exception 'sessão inválida' using errcode = '28000';
  end if;

  if p_role = 'platform_admin' then
    v_holds := exists (
      select 1 from public.profiles where id = v_uid and is_admin = true
    );
  else
    v_holds := exists (
      select 1 from public.memberships m
      where m.principal_id = v_uid
        and m.role = p_role::text
        and (m.expires_at is null or m.expires_at > now())
    );
  end if;

  if not v_holds then
    raise exception 'papel não disponível para este usuário' using errcode = '42501';
  end if;

  insert into app.active_role_selections (session_id, user_id, role, chosen_at)
  values (v_session_id, v_uid, p_role, now())
  on conflict (session_id) do update
    set role = excluded.role,
        chosen_at = excluded.chosen_at;

  perform app.audit_write(
    'active_role.assumed', 'active_role_selection', v_session_id, null,
    'Papel assumido: ' || p_role::text,
    jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function public.assume_role(public.platform_role) from public;
grant execute on function public.assume_role(public.platform_role) to authenticated;

-- ── Comment-only clarification on has_role/has_role_any (coordinator's own
--    review finding, recorded so a future reader does not think the extra
--    margin below is a designed second line of defense) ──────────────────
-- The IS NOT DISTINCT FROM fix (Stage 3, BUG-ACT-NULLHAT-1) is sufficient on
-- its own, but there is a SECOND, INCIDENTAL reason a both-NULL case could
-- never have produced a fail-open even with a plain `=`: `exists(...)` is
-- never itself NULL -- a NULL p_role could never satisfy `m.role = p_role`
-- for any candidate row, so the membership-test conjunct (the exists(...)
-- clause) already evaluates to a clean FALSE ahead of the hat condition,
-- regardless of how the hat condition itself is written. This is INCIDENTAL
-- to the exists() wrapper, not a designed safeguard -- a future refactor
-- that inlined the membership check without exists() could lose it silently.
-- The IS NOT DISTINCT FROM fix remains the real, load-bearing guarantee.
create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and m.role = p_role
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
  )
  -- IS NOT DISTINCT FROM (not `=`) is the real fix (BUG-ACT-NULLHAT-1) --
  -- see the module-level comment above for why the exists() clause above is
  -- ALSO incidentally NULL-safe, but must not be relied on as a second line
  -- of defense.
  and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role());
$function$;

create or replace function app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
      -- Same IS NOT DISTINCT FROM fix + the same incidental exists()
      -- NULL-safety note as has_role above.
      and (p_user_id is distinct from auth.uid() or m.role is not distinct from app.active_role())
  );
$function$;

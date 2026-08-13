-- W2 (ADR 0094, decisions 3 + 5) — one session authority snapshot, expiry defused.
--
-- ⚠ PLACED IN `public`, NOT `app`. The plan names this `app.session_context()`, but
-- supabase/config.toml exposes only `["public", "graphql_public"]` to PostgREST, so an
-- `app.*` function is NOT reachable from `supabase.rpc()` — it would be dead on
-- arrival at the one caller it exists for. Every product-called RPC in this codebase
-- (`grant_role`, `revoke_role`, `assign_member_title`, …) lives in `public` for the
-- same reason. The `app` schema is for helpers invoked from inside SQL.
--
-- ── WHAT IT REPLACES ───────────────────────────────────────────────────────────
--
-- `getSessionContext()` issues FIVE reads today: one `profiles` row plus four
-- separately-filtered `memberships` reads (commission-tier, org_admin,
-- hospital_admin, nsp_org_admin). Adding a role means adding a read; W4 adds two.
-- This returns all of it in one round trip, and — the actual point — defines
-- effective-grant semantics ONCE, in SQL.
--
-- The shape is GENERIC OVER ROLES: one entry per grant, carrying the role plus
-- whichever scope references are non-null. Nothing here enumerates role names, so
-- W4's `technical_director` / `technical_director_deputy` surface with no change to
-- this function.
--
-- ── THE EXPIRY DIVERGENCE THIS CLOSES (M1) ─────────────────────────────────────
--
-- Corrected against the live catalog: the plan treats `expires_at` as an inert
-- landmine, but `app.has_role_any` — which `is_member_of`, `is_staff_admin_of`,
-- `is_org_admin_of` and `is_hospital_admin_of` all delegate to — ALREADY filters it
-- (`expires_at is null or expires_at > now()`). A prosrc grep for `expires_at`
-- reports FALSE for `is_member_of` only because the filter lives one call down; the
-- text lies, the delegation is the truth.
--
-- So the divergence is not "the DB ignores expiry". It is that the **TypeScript**
-- session read never filtered it: an expired grant would render a commission in the
-- shell that every DB predicate then denies. This function applies has_role_any's
-- filter verbatim, so the shell can no longer show reach the database refuses.
--
-- `is_active` is deliberately NOT filtered here. The profile envelope carries
-- `is_active` / `suspended_until` / `email_confirmed_at` and `requireUser()` routes
-- inactive accounts to /conta-inativa; dropping their grants would make a suspended
-- user indistinguishable from one with no memberships, which is a worse signal, not
-- a safer one. The per-predicate `app.is_active(uid)` gate remains the access
-- boundary and is unaffected.
--
-- PHI-free (Rule 12): profile status fields plus org/hospital/commission names and
-- slugs. No patient data, no other user's data — every row is the caller's own.
create or replace function public.session_context()
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $fn$
  with me as (select (select auth.uid()) as uid)
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'full_name',            p.full_name,
        'is_active',            p.is_active,
        'suspended_until',      p.suspended_until,
        'email_confirmed_at',   p.email_confirmed_at,
        'must_change_password', p.must_change_password
      )
      from public.profiles p cross join me
      where p.id = me.uid
    ),
    'grants', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'role', m.role,
                 'organization', case when o.id is not null then
                   jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name) end,
                 'hospital', case when h.id is not null then
                   jsonb_build_object('id', h.id, 'slug', h.slug, 'name', h.name,
                                      'organization_id', h.organization_id) end,
                 'commission', case when c.id is not null then
                   jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug,
                     'organization', jsonb_build_object(
                       'id', co.id, 'slug', co.slug, 'name', co.name)) end
               )
               -- Deterministic order so pgTAP can compare snapshots directly.
               order by m.role, coalesce(c.name, h.name, o.name), m.id
             )
      from public.memberships m
      cross join me
      left join public.organizations o  on o.id  = m.organization_id
      left join public.hospitals     h  on h.id  = m.hospital_id
      left join public.commissions   c  on c.id  = m.commission_id
      left join public.organizations co on co.id = c.organization_id
      where m.principal_id = me.uid
        -- Verbatim from app.has_role_any — the single effective-grant filter.
        and (m.expires_at is null or m.expires_at > now())
    ), '[]'::jsonb)
  );
$fn$;

comment on function public.session_context() is
  'ADR 0094 W2/T2.1 — the single session authority snapshot: the caller''s own profile status fields + ALL effective (expiry-filtered) membership grants, in one round trip. Generic over roles: a new role surfaces with no change here. PHI-free. Consumed by getSessionContext() in src/lib/queries/session.ts.';

-- DEFINER + own-rows-only, so the ACL is the whole boundary: anon must never reach it.
revoke all on function public.session_context() from public;
revoke all on function public.session_context() from anon;
grant execute on function public.session_context() to authenticated;

-- ── T2.3(a) — the expiry audit arm ─────────────────────────────────────────────
--
-- `expires_at` is writable by nothing today (no door takes it; supabase/tests/292
-- pins that). If a future feature adds an expiry writer, the change must not be
-- invisible: Rule 11 requires every mutation to leave a trail, and an expiry edit
-- silently revokes reach at a wall-clock boundary — the least observable kind of
-- authorization change there is.
--
-- Body is otherwise byte-identical to the live definition; only the UPDATE branch
-- grows a second arm. Role change takes precedence when both change in one
-- statement (the role IS the grant; the expiry is a qualifier on it).
create or replace function app.trg_audit_memberships()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row      public.memberships;
  v_action   text;
  v_summary  text;
  v_meta     jsonb;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_action := 'membership.granted';
    v_summary := 'Função concedida (' || v_row.role || ')';
  elsif tg_op = 'DELETE' then
    v_row := old;
    v_action := 'membership.revoked';
    v_summary := 'Função revogada (' || v_row.role || ')';
  else  -- UPDATE — only a role change or an expiry change is a meaningful grant
        -- event. A title_id-only update (assign_member_title) is NOT a role change
        -- → no audit row (display-only metadata, unaudited by design).
    if new.role is distinct from old.role then
      v_row := new;
      v_action := 'membership.role_changed';
      v_summary := 'Função alterada: ' || old.role || ' → ' || new.role;
    elsif new.expires_at is distinct from old.expires_at then
      -- ADR 0094 W2/T2.3. Timestamps only — PHI-free, and the metadata below adds
      -- the before/after so the trail is self-contained.
      v_row := new;
      v_action := 'membership.expiry_changed';
      v_summary := case
        when new.expires_at is null then 'Validade da função removida (permanente)'
        when old.expires_at is null then 'Validade da função definida'
        else 'Validade da função alterada'
      end;
    else
      return null;
    end if;
  end if;

  -- PHI-free metadata: role + scope ids + principal only (never a name/title/payload).
  v_meta := jsonb_build_object(
    'role', v_row.role,
    'user_id', v_row.principal_id,
    'organization_id', v_row.organization_id,
    'hospital_id', v_row.hospital_id,
    'commission_id', v_row.commission_id
  );

  if v_action = 'membership.expiry_changed' then
    v_meta := v_meta || jsonb_build_object(
      'expires_at_before', old.expires_at,
      'expires_at_after',  new.expires_at
    );
  end if;

  if v_row.commission_id is not null then
    -- commission chain: pass p_commission; audit_write derives org + hospital.
    perform app.audit_write(v_action, 'membership', v_row.id, v_row.commission_id, v_summary, v_meta);
  else
    -- org / hospital chain: pass the explicit chain tuple (commission NULL). For an
    -- org-scope row hospital is NULL → org chain; for a hospital-scope row both set →
    -- hospital chain (matches audit_write's precedence).
    perform app.audit_write(v_action, 'membership', v_row.id, null, v_summary, v_meta,
                            v_row.organization_id, v_row.hospital_id);
  end if;

  return null;
end;
$function$;

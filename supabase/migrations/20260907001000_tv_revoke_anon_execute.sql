-- ADR 0096 — Process-template versioning · M10: revoke anon EXECUTE (P1 fix).
--
-- ============================================================================
-- WHAT WENT WRONG, PRECISELY — because the obvious explanation is incomplete
-- ============================================================================
-- Ten public doors added or re-keyed by this phase were EXECUTABLE BY `anon`.
-- `100_dashboard` t19 caught it (that generic guard exists because anon EXECUTE
-- leaked once before), and t19b caught two of them by name.
--
-- The usual explanation is "CREATE FUNCTION grants EXECUTE to PUBLIC by default".
-- True, but it does not explain why only TEN of the ~18 doors this phase touched
-- leaked. The actual rule is sharper:
--
--     DROP FUNCTION + CREATE FUNCTION RESETS the ACL to the default PUBLIC grant.
--     CREATE OR REPLACE FUNCTION PRESERVES the existing ACL.
--
-- The proof is in this phase's own diff. `set_process_outcomes` and
-- `set_template_phase_blocks` are BOTH named in 100 t19b, i.e. both had been
-- revoked by an earlier migration. Only `set_process_outcomes` leaked — because
-- its parameter was renamed, so M6 had to DROP + CREATE it, while
-- `set_template_phase_blocks` kept its signature and got CREATE OR REPLACE.
--
-- The ten break down exactly that way:
--   * 6 re-keyed with DROP + CREATE (parameter renamed to p_template_version_id):
--     add_template_phase, add_template_narrative, set_process_outcomes,
--     set_template_case_type, set_template_collects_patient,
--     reorder_case_layout_template
--   * 4 brand new: clone_template_version, publish_template_version,
--     discard_template_draft, draft_version_of_template
--
-- So the deliberate decision to DROP + CREATE rather than keep a parameter named
-- `p_template_id` that now carries a version id — correct on its own terms, and
-- the reason the rename is honest — carried a security side effect that the
-- decision record did not anticipate. **Any DROP + CREATE of a public function
-- must re-apply its grants in the same migration.**
--
-- Severity note. Two of the ten are SECURITY DEFINER (set_template_case_type,
-- set_template_collects_patient), which run as the OWNER and are therefore NOT
-- constrained by RLS. Both bodies do gate on app.is_staff_admin_of, so this was
-- probably not exploitable. That argument is deliberately NOT relied on:
-- "unreachable" is not a security property (BUG-AUTHZ-001 was exactly that shape
-- — a DEFINER gate RLS never evaluates), and it is the argument 20260906000600
-- already refused.

-- ---------------------------------------------------------------------------
-- Revoke from PUBLIC (the inherited grant) and from anon explicitly.
--
-- Revoking from PUBLIC alone is sufficient here because anon holds no direct
-- grant, but anon is named as well so the intent is legible and a future direct
-- grant cannot silently re-open the door.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[], jsonb, boolean, jsonb)
  from public, anon;

revoke execute on function
  public.add_template_narrative(uuid, uuid, text, text, boolean)
  from public, anon;

revoke execute on function
  public.set_process_outcomes(uuid, uuid[])
  from public, anon;

revoke execute on function
  public.set_template_case_type(uuid, uuid)
  from public, anon;

revoke execute on function
  public.set_template_collects_patient(uuid, boolean)
  from public, anon;

revoke execute on function
  public.reorder_case_layout_template(uuid, jsonb)
  from public, anon;

revoke execute on function
  public.clone_template_version(uuid)
  from public, anon;

revoke execute on function
  public.publish_template_version(uuid)
  from public, anon;

revoke execute on function
  public.discard_template_draft(uuid)
  from public, anon;

revoke execute on function
  public.draft_version_of_template(uuid)
  from public, anon;

-- ---------------------------------------------------------------------------
-- Grant EXECUTE to authenticated — these are the app's RPCs. Authority still
-- comes from RLS (invoker doors) or the explicit is_staff_admin_of gate
-- (the two DEFINER doors); the grant only decides who may attempt the call.
-- ---------------------------------------------------------------------------

grant execute on function
  public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[], jsonb, boolean, jsonb)
  to authenticated;

grant execute on function
  public.add_template_narrative(uuid, uuid, text, text, boolean)
  to authenticated;

grant execute on function
  public.set_process_outcomes(uuid, uuid[])
  to authenticated;

grant execute on function
  public.set_template_case_type(uuid, uuid)
  to authenticated;

grant execute on function
  public.set_template_collects_patient(uuid, boolean)
  to authenticated;

grant execute on function
  public.reorder_case_layout_template(uuid, jsonb)
  to authenticated;

grant execute on function
  public.clone_template_version(uuid)
  to authenticated;

grant execute on function
  public.publish_template_version(uuid)
  to authenticated;

grant execute on function
  public.discard_template_draft(uuid)
  to authenticated;

grant execute on function
  public.draft_version_of_template(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Migration-time assertion. 100_dashboard t19 is the real guard, but it only
-- runs under `npm run test:db`; this runs during `supabase db push` too, so an
-- anon-executable door cannot reach the remote silently.
--
-- Deliberately scoped to ALL public functions, not just this phase's ten: the
-- failure mode is "a door nobody remembered to revoke", so an allowlist of the
-- doors we remembered would be blind in exactly the case that matters.
-- ---------------------------------------------------------------------------

do $$
declare
  v_leaked text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into v_leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_leaked is not null then
    raise exception
      'anon EXECUTE leak em funções public: %. Lembre: DROP+CREATE reseta a ACL; '
      're-aplique os grants na mesma migração.', v_leaked
      using errcode = 'check_violation';
  end if;
end;
$$;

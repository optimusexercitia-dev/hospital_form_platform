-- Mimics 20261003007360 (CAN-MANAGE-PROFESSIONAL-SELF-CHECK): the migration BOTH declares
-- its targets with the marker AND replaces them with a full `create or replace function`,
-- and uses `pg_get_functiondef()` only in its BEFORE/AFTER LANDING ASSERTIONS — non-comment
-- text, so `REWRITE_PRESENT=1` even though nothing here is a runtime rewrite.
-- ⭐ THE CELL: both declared targets are ALSO selected by name, so the cross-file dedup
--   (`comm -23 fn_rewrite fn_sel_*`) emptied `fn_rewrite` and FINDING (1) fired on the
--   RESIDUE — "targets cannot be read" about a file that spells them out twice.
-- door-sweep-targets: app.can_manage_professional(uuid, uuid), app.can_read_professional_profile(uuid, uuid)
do $$
declare v_src text;
begin
  v_src := pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure);
  if position('p_uid = ' in v_src) > 0 then
    raise exception 'already re-keyed - investigate rather than re-run';
  end if;
end $$;

create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
as $$ select p_uid is not null and auth.uid() = p_uid $$;

create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
as $$ select p_profile_id is not null and auth.uid() = p_uid $$;

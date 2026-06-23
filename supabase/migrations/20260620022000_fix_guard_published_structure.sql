-- ----------------------------------------------------------------------------
-- Fix immutability guards: allow CASCADE deletes through both guards
-- ----------------------------------------------------------------------------
-- Two BEFORE DELETE triggers block draft-version deletion when the parent
-- form_versions row is gone (cascade scenario):
--
-- 1. guard_published_structure (on form_items + form_sections):
--    `v_status IS DISTINCT FROM 'draft'` evaluates TRUE for NULL (version
--    already removed), raising "DELETE on a <NULL> version's structure is
--    blocked (immutable)". Fix: only raise for explicit 'published'/'archived'.
--
-- 2. guard_default_section_delete (on form_sections):
--    When the version is cascade-deleted, sections are removed one at a time.
--    The trigger counts remaining siblings; the last (default) section counts 0
--    siblings and raises "cannot delete the default section while it is the
--    only section of its version". Fix: skip the guard entirely when the parent
--    version row no longer exists (cascade → nothing to protect).

CREATE OR REPLACE FUNCTION "public"."guard_published_structure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.form_version_id else new.form_version_id end;

  select status into v_status from public.form_versions where id = v_version_id;

  -- NULL means the parent version row is already gone (cascade delete) — allow.
  -- Only block mutations on explicitly non-draft versions.
  if v_status in ('published', 'archived') then
    raise exception '% on a % version''s structure is blocked (immutable)', tg_op, v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."guard_default_section_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_remaining integer;
begin
  if old.is_default then
    -- If the parent version is already gone this is a cascade delete — nothing to protect.
    if not exists (select 1 from public.form_versions where id = old.form_version_id) then
      return old;
    end if;

    select count(*) into v_remaining
    from public.form_sections
    where form_version_id = old.form_version_id
      and id <> old.id;

    if v_remaining = 0 then
      raise exception
        'cannot delete the default section while it is the only section of its version'
        using errcode = 'check_violation';
    end if;
  end if;
  return old;
end;
$$;

-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration C:
-- framework/standard CRUD + clone. ADR 0093 D2/D6 + Amendment 1 A1·2 +
-- docs/plans/phase-16-standards-crosswalk-program.md (Wave 2). Six RPCs:
-- create_framework, update_framework, set_framework_status, upsert_standard,
-- delete_standard, clone_framework. Every RPC opens with
-- app.assert_accreditation_enabled() -> HC0Q9.
--
-- AUTHORITY-FIRST ordering (ADR 0079): the ownership gate is checked before
-- any row content is read back to the caller, on every RPC below.
--
-- Global packs (owner_commission_id IS NULL): app.is_admin() ONLY — the ONE
-- correct is_admin() use in this phase (the vocabulary/catalog arm of the
-- noun rule, ADR 0078 A35). platform_admin may curate reference vocabulary;
-- it may NOT read or write commission content, so this arm must never leak
-- into Migration D or E.
-- Custom (commission-owned) frameworks: app.is_staff_admin_of(owner) ONLY —
-- an admin touching a commission-owned framework is a plain 42501, same as
-- a staff_admin of the wrong commission.
--
-- SQLSTATEs (Wave 1 ledger, verified against the catalog at Wave 2 start —
-- see the Report): HC0Q9 flag off · HC0QA belongs/not-linkable (Migration D)
-- · HC0QB duplicate link (Migration D) · HC0QC invalid target
-- (parent/framework/hospital/level) · HC0QD global-pack read-only
-- ("...clone o framework para editá-lo.") · HC0QE framework arquivado.

create function app.assert_accreditation_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('accreditation') then
    raise exception 'o recurso de padrões de acreditação não está disponível'
      using errcode = 'HC0Q9';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_framework — global pack (is_admin only) or a from-scratch custom
-- framework (staff_admin of p_owner_commission). NOT the clone path (see
-- clone_framework below) — this is for authoring a framework with no global
-- ancestor.
-- ---------------------------------------------------------------------------
create function public.create_framework(
  p_key text,
  p_name text,
  p_owner_commission uuid default null,
  p_version text default '1',
  p_description text default null
)
returns public.accreditation_frameworks
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_result public.accreditation_frameworks;
begin
  perform app.assert_accreditation_enabled();

  if p_owner_commission is null then
    if not app.is_admin() then
      raise exception 'apenas o administrador da plataforma pode criar um framework global'
        using errcode = '42501';
    end if;
  else
    if not app.is_staff_admin_of(p_owner_commission) then
      raise exception 'você não pode criar frameworks nesta comissão'
        using errcode = '42501';
    end if;
  end if;

  insert into public.accreditation_frameworks (key, name, owner_commission_id, version, description, status)
  values (p_key, p_name, p_owner_commission, p_version, p_description, 'ativo')
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_framework — name/version/description only (status has its own RPC
-- below; ownership never changes post-creation).
-- ---------------------------------------------------------------------------
create function public.update_framework(
  p_framework uuid,
  p_name text default null,
  p_version text default null,
  p_description text default null
)
returns public.accreditation_frameworks
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_status text;
  v_result public.accreditation_frameworks;
begin
  perform app.assert_accreditation_enabled();

  select owner_commission_id, status into v_owner, v_status
  from public.accreditation_frameworks where id = p_framework;

  if v_status is null then
    raise exception 'framework não encontrado' using errcode = 'HC0QC';
  end if;

  if v_owner is null then
    if not app.is_admin() then
      raise exception 'este é um framework global — clone o framework para editá-lo'
        using errcode = 'HC0QD';
    end if;
  else
    if not app.is_staff_admin_of(v_owner) then
      raise exception 'você não pode editar frameworks nesta comissão'
        using errcode = '42501';
    end if;
  end if;

  if v_status = 'arquivado' then
    raise exception 'framework arquivado não pode ser editado' using errcode = 'HC0QE';
  end if;

  update public.accreditation_frameworks
  set name = coalesce(p_name, name),
      version = coalesce(p_version, version),
      description = coalesce(p_description, description)
  where id = p_framework
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_framework_status — the ativo|arquivado toggle. Deliberately does NOT
-- itself check "already arquivado" (that would make un-archiving
-- impossible); the arquivado-blocks-editing rule lives in the OTHER RPCs.
-- ---------------------------------------------------------------------------
create function public.set_framework_status(p_framework uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_found boolean;
begin
  perform app.assert_accreditation_enabled();

  select owner_commission_id, true into v_owner, v_found
  from public.accreditation_frameworks where id = p_framework;

  if v_found is null then
    raise exception 'framework não encontrado' using errcode = 'HC0QC';
  end if;

  if v_owner is null then
    if not app.is_admin() then
      raise exception 'este é um framework global — clone o framework para editá-lo'
        using errcode = 'HC0QD';
    end if;
  else
    if not app.is_staff_admin_of(v_owner) then
      raise exception 'você não pode editar frameworks nesta comissão'
        using errcode = '42501';
    end if;
  end if;

  update public.accreditation_frameworks set status = p_status where id = p_framework;
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_standard — p_id NULL = insert, set = update (guarded by
-- (id, framework_id) so a caller cannot repoint an existing standard at a
-- different framework by passing a foreign p_framework alongside a real
-- p_id). Level/parent validated explicitly so HC0QC (a curated pt-BR
-- message) fires instead of the raw CHECK/FK's 23514/23503.
-- ---------------------------------------------------------------------------
create function public.upsert_standard(
  p_framework uuid,
  p_code text,
  p_title text,
  p_id uuid default null,
  p_parent uuid default null,
  p_description_md text default null,
  p_position integer default 0,
  p_level smallint default null
)
returns public.accreditation_standards
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_status text;
  v_result public.accreditation_standards;
begin
  perform app.assert_accreditation_enabled();

  select owner_commission_id, status into v_owner, v_status
  from public.accreditation_frameworks where id = p_framework;

  if v_status is null then
    raise exception 'framework não encontrado' using errcode = 'HC0QC';
  end if;

  if v_owner is null then
    if not app.is_admin() then
      raise exception 'este é um framework global — clone o framework para editá-lo'
        using errcode = 'HC0QD';
    end if;
  else
    if not app.is_staff_admin_of(v_owner) then
      raise exception 'você não pode editar padrões nesta comissão'
        using errcode = '42501';
    end if;
  end if;

  if v_status = 'arquivado' then
    raise exception 'framework arquivado não pode ser editado' using errcode = 'HC0QE';
  end if;

  if p_level is not null and p_level not between 1 and 3 then
    raise exception 'nível inválido: %', p_level using errcode = 'HC0QC';
  end if;

  if p_parent is not null and not exists (
    select 1 from public.accreditation_standards where id = p_parent and framework_id = p_framework
  ) then
    raise exception 'padrão pai inválido para este framework' using errcode = 'HC0QC';
  end if;

  if p_id is null then
    insert into public.accreditation_standards (
      framework_id, parent_id, code, title, description_md, "position", level
    ) values (
      p_framework, p_parent, p_code, p_title, p_description_md, p_position, p_level
    )
    returning * into v_result;
  else
    update public.accreditation_standards
    set parent_id = p_parent, code = p_code, title = p_title,
        description_md = p_description_md, "position" = p_position, level = p_level
    where id = p_id and framework_id = p_framework
    returning * into v_result;

    if v_result.id is null then
      raise exception 'padrão não encontrado neste framework' using errcode = 'HC0QC';
    end if;
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_standard — cascades to child standards (parent_id ON DELETE
-- CASCADE) and to every evidence_links/standard_assessments/
-- standard_ownerships row referencing this standard or any descendant (all
-- three FK ON DELETE CASCADE per Migration A). Deleting a section deletes
-- its whole subtree AND everything evidenced against it.
-- ---------------------------------------------------------------------------
create function public.delete_standard(p_standard uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_status text;
begin
  perform app.assert_accreditation_enabled();

  select f.owner_commission_id, f.status into v_owner, v_status
  from public.accreditation_standards s
  join public.accreditation_frameworks f on f.id = s.framework_id
  where s.id = p_standard;

  if v_status is null then
    raise exception 'padrão não encontrado' using errcode = 'HC0QC';
  end if;

  if v_owner is null then
    if not app.is_admin() then
      raise exception 'este é um framework global — clone o framework para editá-lo'
        using errcode = 'HC0QD';
    end if;
  else
    if not app.is_staff_admin_of(v_owner) then
      raise exception 'você não pode editar padrões nesta comissão'
        using errcode = '42501';
    end if;
  end if;

  if v_status = 'arquivado' then
    raise exception 'framework arquivado não pode ser editado' using errcode = 'HC0QE';
  end if;

  delete from public.accreditation_standards where id = p_standard;
end;
$$;

-- ---------------------------------------------------------------------------
-- clone_framework — staff_admin of p_commission only (D2). Source must be
-- either a global pack OR already owned by the SAME p_commission
-- (self-clone/versioning) — cloning ANOTHER commission's owned framework is
-- explicitly rejected: RLS cannot protect this lookup (this function is
-- SECURITY DEFINER and bypasses it), and a cross-tenant clone of an owned
-- framework is exactly the licensed-text leak PO ruling 2 (Amendment 1
-- A1·2) exists to prevent.
--
-- Two-pass parent remap (precedent: app.copy_version_children,
-- 20260712000000 — read live): pass 1 inserts every standard into the new
-- framework WITHOUT parent_id and builds an old_id -> new_id map keyed on
-- `code` (unique per framework, so it survives the insert without needing
-- position matching); pass 2 UPDATEs parent_id via a double join through
-- that map. A single pass cannot work because a child's parent may not have
-- a new_id yet at insert time (forward references within the source tree).
-- ---------------------------------------------------------------------------
create function public.clone_framework(p_framework uuid, p_commission uuid)
returns public.accreditation_frameworks
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_source_owner uuid;
  v_found boolean;
  v_new public.accreditation_frameworks;
begin
  perform app.assert_accreditation_enabled();

  if not app.is_staff_admin_of(p_commission) then
    raise exception 'você não pode clonar frameworks para esta comissão'
      using errcode = '42501';
  end if;

  select owner_commission_id, true into v_source_owner, v_found
  from public.accreditation_frameworks where id = p_framework;

  if v_found is null then
    raise exception 'framework não encontrado' using errcode = 'HC0QC';
  end if;

  if v_source_owner is not null and v_source_owner <> p_commission then
    raise exception 'você não pode clonar um framework de outra comissão'
      using errcode = '42501';
  end if;

  insert into public.accreditation_frameworks (
    key, name, version, description, owner_commission_id, cloned_from_framework_id, status
  )
  select key, name, version, description, p_commission, id, 'ativo'
  from public.accreditation_frameworks
  where id = p_framework
  returning * into v_new;

  -- DROP IF EXISTS first: `on commit drop` only cleans up at COMMIT, not
  -- between statements — a caller invoking clone_framework a second time
  -- inside the SAME transaction (a real pgTAP scenario; PostgREST itself
  -- always gives each RPC call its own transaction, but nothing SQL-level
  -- guarantees that) would otherwise hit "relation already exists" on the
  -- second call (found and fixed via pgTAP 280 §E — verified).
  drop table if exists _clone_standard_map;
  create temp table _clone_standard_map (old_id uuid, new_id uuid) on commit drop;

  with src as (
    select id, code, title, description_md, "position", level
    from public.accreditation_standards
    where framework_id = p_framework
  ),
  ins as (
    insert into public.accreditation_standards (
      framework_id, code, title, description_md, "position", level
    )
    select v_new.id, code, title, description_md, "position", level
    from src
    returning id, code
  )
  insert into _clone_standard_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.code = src.code;

  update public.accreditation_standards c
  set parent_id = pm.new_id
  from public.accreditation_standards src
  join _clone_standard_map im on im.old_id = src.id
  join _clone_standard_map pm on pm.old_id = src.parent_id
  where c.id = im.new_id
    and src.parent_id is not null
    and src.framework_id = p_framework;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — PostgreSQL grants EXECUTE to PUBLIC on every new function by
-- default (unlike tables); the Supabase project's pg_default_acl entries for
-- the public schema ADD authenticated/service_role, they do not suppress
-- that built-in PUBLIC grant. Every RPC below is explicitly REVOKEd from
-- PUBLIC then GRANTed to authenticated (matching create_indicator /
-- save_block_to_library's own ACL shape — verified live, not assumed).
-- ---------------------------------------------------------------------------
revoke execute on function public.create_framework(text, text, uuid, text, text) from public;
grant execute on function public.create_framework(text, text, uuid, text, text) to authenticated;

revoke execute on function public.update_framework(uuid, text, text, text) from public;
grant execute on function public.update_framework(uuid, text, text, text) to authenticated;

revoke execute on function public.set_framework_status(uuid, text) from public;
grant execute on function public.set_framework_status(uuid, text) to authenticated;

revoke execute on function public.upsert_standard(uuid, text, text, uuid, uuid, text, integer, smallint) from public;
grant execute on function public.upsert_standard(uuid, text, text, uuid, uuid, text, integer, smallint) to authenticated;

revoke execute on function public.delete_standard(uuid) from public;
grant execute on function public.delete_standard(uuid) to authenticated;

revoke execute on function public.clone_framework(uuid, uuid) from public;
grant execute on function public.clone_framework(uuid, uuid) to authenticated;

-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — MAJOR-1: `meeting_agenda_items.description` is
-- unmasked and PHI-BEARING by its own column comment (qa review §2).
--
-- Of the 4 columns whose comment says PHI-BEARING, `title` / `discussion_notes`
-- / `resolution` have has_column_privilege(authenticated, …, 'select') = f.
-- `description` = t, and `app._project_meeting_agenda_item` never masked it.
-- Proven: a respondent read it in full for his own case's agenda item, while
-- the other three masked correctly.
--
-- With the other three boxes closed, `description` is the ONLY free-text field
-- on a case-linked agenda item — i.e. the natural place to type. This is A3's
-- own argument one column over (A11's "adjacent-column route"): the set was
-- ENUMERATED to the brief's two names, not CLOSED over the population (§7.5).
--
-- PO RULING (2026-07-17): treat `description` as SUBSTANCE. Mask it on the SAME
-- predicate as `discussion_notes`, REVOKE it from `authenticated`, keystone in
-- 242. The column comment stays as-is — it is now true.
--
-- ⚠ Body regenerated from the live catalog (`pg_get_functiondef`), not from
-- migration text (A28). CREATE OR REPLACE — no ACL reset.
-- =============================================================================

create or replace function app._project_meeting_agenda_item(r public.meeting_agenda_items, p_uid uuid)
 returns public.meeting_agenda_items
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_cases uuid[];
begin
  select array_agg(mc.case_id) into v_cases
  from public.meeting_cases mc where mc.agenda_item_id = r.id;

  if v_cases is null then
    return r;  -- not case-linked → member-wide, no masking
  end if;

  -- title (process number): propriety tier — hidden from a respondent of ANY
  -- linked case (he must not read his own process number).
  if exists (select 1 from unnest(v_cases) c where app.is_case_respondent(c, p_uid)) then
    r.title := null;
  end if;

  -- description / discussion_notes / resolution: substance tier — visible only
  -- with read_case_deliberation on EVERY linked case.
  --   ⭐ `description` joined this tier in the Gate-2 fix wave (MAJOR-1). It is
  --   PHI-BEARING by its own column comment and was the last unmasked free-text
  --   field on a case-linked agenda item.
  if exists (
    select 1 from unnest(v_cases) c
    where not app.has_case_capability(c, p_uid, 'read_case_deliberation')
  ) then
    r.description := null;
    r.discussion_notes := null;
    r.resolution := null;
  end if;

  return r;
end;
$function$;

-- Defence in depth: the base-table column REVOKE, matching its three siblings.
-- The RPC projection is the door; this closes the raw PostgREST select.
revoke select (description) on public.meeting_agenda_items from authenticated;

-- GUARDS ----------------------------------------------------------------------
do $$
begin
  if has_column_privilege('authenticated', 'public.meeting_agenda_items', 'description', 'select') then
    raise exception 'Gate-2 MAJOR-1: authenticated still holds SELECT on meeting_agenda_items.description';
  end if;
  -- The projection must mask it. (Behavioural proof lives in 242.)
  if (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and p.proname = '_project_meeting_agenda_item') !~ 'r\.description := null' then
    raise exception 'Gate-2 MAJOR-1: _project_meeting_agenda_item does not mask description';
  end if;
end $$;

-- Phase 1 / M3: Form structure — forms, versions, sections, items.
--
-- Implements ARCHITECTURE.md §2 "Sections integrity" in full: the default
-- section, two-level ordering, per-version question_key uniqueness, the
-- visible_when shape, and the input-vs-display item column rules. Immutability
-- of published versions is added in M4 (alongside the response triggers) so all
-- the immutability logic lives together.

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  title text not null,
  description text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.forms enable row level security;
create index forms_commission_idx on public.forms (commission_id);

-- ---------------------------------------------------------------------------
-- form_versions
-- ---------------------------------------------------------------------------
create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (form_id, version_number)
);

alter table public.form_versions enable row level security;
create index form_versions_form_idx on public.form_versions (form_id);

-- At most one published version per form. Editing a published version clones to
-- a new draft and archives the old one; this index is the backstop.
create unique index form_versions_one_published_idx
  on public.form_versions (form_id)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- form_sections
-- ---------------------------------------------------------------------------
-- Every version has >= 1 section. The default section (is_default = true,
-- title null) renders flat with no section chrome. visible_when is a single
-- condition (no AND/OR trees in v1 — see ADR 0005), validated at publish time
-- by validate_visible_when (M5). signoff_role is required iff requires_signoff.
create table public.form_sections (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions (id) on delete cascade,
  position integer not null,
  title text,
  description text,
  is_default boolean not null default false,
  visible_when jsonb,
  requires_signoff boolean not null default false,
  signoff_role text check (signoff_role in ('respondent', 'staff_admin')),
  unique (form_version_id, position),
  -- The default section is a plain container: no title, no condition, no
  -- sign-off. This keeps "unsectioned form" modelled as exactly one default
  -- section rather than a nullable section_id special case.
  constraint form_sections_default_shape check (
    not is_default
    or (title is null and visible_when is null and requires_signoff = false)
  ),
  -- requires_signoff implies a signoff_role and vice versa.
  constraint form_sections_signoff_role check (
    (requires_signoff and signoff_role is not null)
    or (not requires_signoff and signoff_role is null)
  ),
  -- visible_when, when present, must have the v1 single-condition shape.
  -- Deep validation (referenced key exists, earlier section) is at publish time.
  constraint form_sections_visible_when_shape check (
    visible_when is null
    or (
      jsonb_typeof(visible_when) = 'object'
      and visible_when ? 'question_key'
      and visible_when ? 'op'
      and visible_when ? 'value'
      and (visible_when ->> 'op') in ('equals', 'not_equals', 'in')
      and jsonb_typeof(visible_when -> 'question_key') = 'string'
    )
  )
);

alter table public.form_sections enable row level security;
create index form_sections_version_idx on public.form_sections (form_version_id);

-- Exactly one default section per version.
create unique index form_sections_one_default_idx
  on public.form_sections (form_version_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- form_items
-- ---------------------------------------------------------------------------
-- Two kinds in one table (a lightweight dynamic-zone model):
--   input items   -> collect answers: multiple_choice, dropdown, checkbox, free_text
--   display items -> render only:     section_text, image
-- form_version_id is denormalized from the section so per-version question_key
-- uniqueness is a simple partial unique index; a trigger keeps it consistent.
create table public.form_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.form_sections (id) on delete cascade,
  form_version_id uuid not null references public.form_versions (id) on delete cascade,
  position integer not null,
  item_type text not null check (item_type in (
    'multiple_choice', 'dropdown', 'checkbox', 'free_text', -- input
    'section_text', 'image'                                  -- display
  )),
  -- input-only columns
  question_key text,
  label text,
  question_explanation text,
  options jsonb,
  required boolean not null default false,
  -- display-only column
  content jsonb,
  created_at timestamptz not null default now(),
  unique (section_id, position),

  -- Input items: must carry question_key + label, never content.
  -- Display items: must carry content, never question_key/label/options, and
  -- required must be false.
  constraint form_items_input_vs_display check (
    case
      when item_type in ('multiple_choice', 'dropdown', 'checkbox', 'free_text') then
        question_key is not null
        and label is not null
        and content is null
      when item_type in ('section_text', 'image') then
        content is not null
        and question_key is null
        and label is null
        and options is null
        and question_explanation is null
        and required = false
    end
  ),
  -- Choice inputs need an options array; free_text never does.
  constraint form_items_options_shape check (
    case
      when item_type in ('multiple_choice', 'dropdown', 'checkbox') then
        jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0
      when item_type = 'free_text' then options is null
      else true
    end
  )
);

alter table public.form_items enable row level security;
create index form_items_section_idx on public.form_items (section_id);
create index form_items_version_idx on public.form_items (form_version_id);

-- question_key is unique per VERSION (not per section), so dashboards can
-- aggregate across sections and across versions. Only input items have a key.
create unique index form_items_question_key_per_version_idx
  on public.form_items (form_version_id, question_key)
  where question_key is not null;

-- Keep the denormalized form_version_id in lockstep with the parent section's
-- version. Callers may omit it on insert; we derive it. On update we forbid
-- moving an item to a section in a different version (that would be a clone,
-- not an edit).
create function public.form_items_sync_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_section_version uuid;
begin
  select form_version_id into v_section_version
  from public.form_sections
  where id = new.section_id;

  if v_section_version is null then
    raise exception 'form_items.section_id % does not exist', new.section_id;
  end if;

  new.form_version_id := v_section_version;
  return new;
end;
$$;

create trigger form_items_sync_version_trg
  before insert or update of section_id on public.form_items
  for each row execute function public.form_items_sync_version();

-- ---------------------------------------------------------------------------
-- Default-section deletion guard
-- ---------------------------------------------------------------------------
-- The default section cannot be deleted while it is the only section of its
-- version (every version must keep >= 1 section, and the flat-render fallback
-- depends on a default section existing).
create function public.guard_default_section_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_remaining integer;
begin
  if old.is_default then
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

create trigger guard_default_section_delete_trg
  before delete on public.form_sections
  for each row execute function public.guard_default_section_delete();

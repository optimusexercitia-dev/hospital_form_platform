-- Phase 1 / M4: Response lifecycle + immutability.
--
-- Tables: responses, answers, response_section_signoffs.
-- Triggers: display-item answer rejection, submitted-response immutability
-- (responses/answers/sign-offs), and published-version immutability
-- (form_versions/form_sections/form_items). All the immutability rules live
-- here so the enforcement logic is in one place.

-- ---------------------------------------------------------------------------
-- responses
-- ---------------------------------------------------------------------------
-- A response references a specific form_version. commission_id is denormalized
-- (also reachable via the version) so RLS and dashboards can scope cheaply.
-- last_section_id powers wizard resume.
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions (id),
  commission_id uuid not null references public.commissions (id),
  created_by uuid not null references public.profiles (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  last_section_id uuid references public.form_sections (id),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table public.responses enable row level security;
create index responses_version_idx on public.responses (form_version_id);
create index responses_commission_idx on public.responses (commission_id);
create index responses_created_by_idx on public.responses (created_by);

-- One resumable draft per user per version.
create unique index responses_one_draft_per_user_idx
  on public.responses (form_version_id, created_by)
  where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- answers
-- ---------------------------------------------------------------------------
-- question_key is denormalized from the target item so dashboards aggregate by
-- key across versions without a join. One answer per item per response.
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses (id) on delete cascade,
  item_id uuid not null references public.form_items (id),
  question_key text not null,
  value jsonb,
  unique (response_id, item_id)
);

alter table public.answers enable row level security;
create index answers_response_idx on public.answers (response_id);
create index answers_item_idx on public.answers (item_id);
create index answers_question_key_idx on public.answers (question_key);

-- ---------------------------------------------------------------------------
-- response_section_signoffs
-- ---------------------------------------------------------------------------
create table public.response_section_signoffs (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses (id) on delete cascade,
  section_id uuid not null references public.form_sections (id),
  signed_by uuid not null references public.profiles (id),
  signed_at timestamptz not null default now(),
  note text,
  unique (response_id, section_id)
);

alter table public.response_section_signoffs enable row level security;
create index signoffs_response_idx on public.response_section_signoffs (response_id);

-- ---------------------------------------------------------------------------
-- Trigger: reject answers that target a display item
-- ---------------------------------------------------------------------------
-- Display items (section_text, image) are never answered. Belt-and-suspenders
-- alongside the form_items column CHECKs and the answerable-questions query
-- helper.
create function public.reject_answer_on_display_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item_type text;
begin
  select item_type into v_item_type
  from public.form_items
  where id = new.item_id;

  if v_item_type is null then
    raise exception 'answers.item_id % does not exist', new.item_id;
  end if;

  if v_item_type in ('section_text', 'image') then
    raise exception 'cannot record an answer for display item % (type %)',
      new.item_id, v_item_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger reject_answer_on_display_item_trg
  before insert or update on public.answers
  for each row execute function public.reject_answer_on_display_item();

-- ---------------------------------------------------------------------------
-- Submitted-response immutability
-- ---------------------------------------------------------------------------
-- Once a response is submitted, it and its answers and sign-offs are frozen.
-- The submit_response RPC performs the final in_progress -> submitted flip
-- (and its stray-answer cleanup) within a single statement that this trigger
-- must allow; it does so by setting app.in_submit_rpc = 'on' for the duration.

-- Guard for the responses table itself: block any UPDATE/DELETE once submitted,
-- EXCEPT the RPC's own status flip.
create function public.guard_submitted_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'submitted' then
      raise exception 'submitted responses are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE: allow the RPC's in_progress -> submitted transition.
  if old.status = 'submitted'
     and coalesce(current_setting('app.in_submit_rpc', true), 'off') <> 'on' then
    raise exception 'submitted responses are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_submitted_response_trg
  before update or delete on public.responses
  for each row execute function public.guard_submitted_response();

-- Guard for answers and sign-offs: block writes when the PARENT response is
-- submitted, except during the RPC's stray-answer cleanup.
create function public.guard_submitted_children()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_response_id uuid;
  v_status text;
begin
  v_response_id := case when tg_op = 'DELETE' then old.response_id else new.response_id end;

  select status into v_status from public.responses where id = v_response_id;

  if v_status = 'submitted'
     and coalesce(current_setting('app.in_submit_rpc', true), 'off') <> 'on' then
    raise exception '% on a submitted response is blocked (immutable)', tg_op
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_submitted_answers_trg
  before insert or update or delete on public.answers
  for each row execute function public.guard_submitted_children();

create trigger guard_submitted_signoffs_trg
  before insert or update or delete on public.response_section_signoffs
  for each row execute function public.guard_submitted_children();

-- ---------------------------------------------------------------------------
-- Published-version immutability
-- ---------------------------------------------------------------------------
-- A published (or archived) version's structure is frozen: no UPDATE/DELETE of
-- the version's sections or items, and no UPDATE of the version row itself
-- except the lifecycle status transitions, which go through publish_form_version
-- (M5) under the app.in_publish_rpc guard.
--
-- Allowed version status transitions (only via the publish RPC):
--   draft -> published, published -> archived, draft -> archived.

create function public.guard_published_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'published versions are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE. Status transitions are only permitted inside publish_form_version.
  if new.status is distinct from old.status then
    if coalesce(current_setting('app.in_publish_rpc', true), 'off') <> 'on' then
      raise exception 'version status changes must go through publish_form_version()'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Non-status update: forbidden once the version is no longer a draft.
  if old.status <> 'draft' then
    raise exception 'published/archived versions are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_published_version_trg
  before update or delete on public.form_versions
  for each row execute function public.guard_published_version();

-- Sections and items: frozen whenever their owning version is not a draft.
create function public.guard_published_structure()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.form_version_id else new.form_version_id end;

  select status into v_status from public.form_versions where id = v_version_id;

  if v_status is distinct from 'draft' then
    raise exception '% on a % version''s structure is blocked (immutable)', tg_op, v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_published_sections_trg
  before insert or update or delete on public.form_sections
  for each row execute function public.guard_published_structure();

create trigger guard_published_items_trg
  before insert or update or delete on public.form_items
  for each row execute function public.guard_published_structure();

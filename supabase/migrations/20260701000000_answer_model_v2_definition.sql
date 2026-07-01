-- Answer-Model v2 — BE-1: definition-side, additive (ADR 0045 / 0046).
--
-- Two additive columns on form_items (parent_item_id + default_value) and the
-- new response_group_instances table. All SCAFFOLDING for repeating groups /
-- default values — NO repeating-group UX, NO new item_type, NO group semantics.
-- Forward-only additive on baseline 20260620000000; the baseline is never edited.
--
-- Immutability note: form_items already carries guard_published_items_trg (fires
-- on every INSERT/UPDATE/DELETE), so the two new columns inherit the
-- published-structure freeze automatically — no trigger work here.

-- ---------------------------------------------------------------------------
-- form_items: parent_item_id (future repeating_group container; always NULL now)
--             + default_value (P2.4; input-only, display items keep it NULL).
-- ---------------------------------------------------------------------------
alter table public.form_items
  add column parent_item_id uuid references public.form_items(id) on delete cascade,
  add column default_value  jsonb;

comment on column public.form_items.parent_item_id is
  'answer-model-v2 (ADR 0046): future repeating_group container owning this item. ALWAYS NULL now (all forms flat); exists so the definition model is coherent with the instance-ready answer model (answers.group_instance_id). clone_form_version remaps it. Same-section/version consistency CHECK deferred while all values are NULL.';
comment on column public.form_items.default_value is
  'answer-model-v2 (ADR 0046 / P2.4): per-input default value used to pre-fill an unanswered VISIBLE item in the wizard. Scalar for free_text/short_text/number/date/time; option code (single) or code array (checkbox) for choice; NULL for display items (CHECK). clone_form_version copies it verbatim; publish_form_version validates it (HC080).';

-- Display items (section_text / image) never carry a default value.
alter table public.form_items
  add constraint form_items_default_value_display_null
  check (
    default_value is null
    or item_type <> all (array['section_text', 'image'])
  );

-- ---------------------------------------------------------------------------
-- response_group_instances: created + RLS'd + immutability-guarded now, but
-- INERT until repeating groups ship. RLS mirrors the inline answers predicate
-- verbatim (no app.commission_of_response helper exists; the answers policies
-- inline the responses join, and we match them exactly).
-- ---------------------------------------------------------------------------
create table public.response_group_instances (
  id                 uuid primary key default gen_random_uuid(),
  response_id        uuid not null references public.responses(id) on delete cascade,
  group_item_id      uuid not null references public.form_items(id),
  parent_instance_id uuid references public.response_group_instances(id) on delete cascade,
  position           integer not null,
  created_at         timestamptz not null default now()
);

comment on table public.response_group_instances is
  'answer-model-v2 (ADR 0045/0046): repeating-group instance scaffold. INERT until repeating groups ship — no row is written while every answer stays top-level (answers.group_instance_id NULL). RLS mirrors answers (member read; creator write while in_progress); immutability-guarded via guard_submitted_children.';

create index response_group_instances_response_idx
  on public.response_group_instances(response_id);

-- Supabase grants are table-wide; the new table needs its own DML grant.
grant all on table public.response_group_instances to authenticated;
grant all on table public.response_group_instances to service_role;

alter table public.response_group_instances enable row level security;

-- SELECT: mirror answers_select verbatim (creator OR org-admin OR submitted +
-- staff_admin of the response's commission).
create policy "response_group_instances_select"
  on public.response_group_instances
  for select to authenticated
  using (exists (
    select 1
    from public.responses r
    where r.id = response_group_instances.response_id
      and (
        r.created_by = auth.uid()
        or app.is_org_admin_of_commission(r.commission_id)
        or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id))
      )
  ));

-- WRITE: mirror answers_write_own_draft verbatim (creator while in_progress).
create policy "response_group_instances_write_own_draft"
  on public.response_group_instances
  for all to authenticated
  using (exists (
    select 1
    from public.responses r
    where r.id = response_group_instances.response_id
      and r.created_by = auth.uid()
      and r.status = 'in_progress'
  ))
  with check (exists (
    select 1
    from public.responses r
    where r.id = response_group_instances.response_id
      and r.created_by = auth.uid()
      and r.status = 'in_progress'
  ));

-- Submitted-response immutability: reuse guard_submitted_children (it keys on
-- the row's response_id, which this table has directly).
create trigger guard_submitted_group_instances_trg
  before insert or delete or update on public.response_group_instances
  for each row execute function public.guard_submitted_children();

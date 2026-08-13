-- =============================================================================
-- F-cleanup · D10 — uniform updated_at touch trigger on cases / commissions / forms
-- (these three lacked the column). Independent of D3.
--
-- Locked (lead): ONE generic app.touch_updated_at() (the existing trivial pattern —
-- cf. app.touch_interview_updated_at / touch_case_narrative_updated_at, which are
-- byte-identical per-domain copies left AS-IS, not repointed). updated_at is
-- metadata → NOT added to any audit allow-list (stays out of the log, Rule 11).
-- Reset-OK; the column DEFAULTs now() so any pre-existing rows backfill safely.
-- =============================================================================

-- Generic touch function (trivial body, search_path-pinned, owned by postgres).
create or replace function app.touch_updated_at()
  returns trigger language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
alter function app.touch_updated_at() owner to postgres;

-- Add the column + a BEFORE UPDATE FOR EACH ROW touch trigger to each table.
-- No existing BEFORE UPDATE trigger on these tables reads updated_at (the column
-- did not exist until now), so trigger ordering is immaterial.
alter table public.cases       add column if not exists updated_at timestamptz not null default now();
alter table public.commissions add column if not exists updated_at timestamptz not null default now();
alter table public.forms       add column if not exists updated_at timestamptz not null default now();

create or replace trigger touch_cases_updated_at
  before update on public.cases
  for each row execute function app.touch_updated_at();

create or replace trigger touch_commissions_updated_at
  before update on public.commissions
  for each row execute function app.touch_updated_at();

create or replace trigger touch_forms_updated_at
  before update on public.forms
  for each row execute function app.touch_updated_at();

comment on column public.cases.updated_at is
  'D10 (F-cleanup) — last-mutation timestamp; app.touch_updated_at() BEFORE UPDATE. Metadata, never audited.';
comment on column public.commissions.updated_at is
  'D10 (F-cleanup) — last-mutation timestamp; app.touch_updated_at() BEFORE UPDATE. Metadata, never audited.';
comment on column public.forms.updated_at is
  'D10 (F-cleanup) — last-mutation timestamp; app.touch_updated_at() BEFORE UPDATE. Metadata, never audited.';

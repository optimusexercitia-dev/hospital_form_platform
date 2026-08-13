-- =============================================================================
-- MIN · B1 (ADR 0099 / docs/plans/audio-minutes.md) — meeting audio → generated ata,
-- migration 1 of 2: the shared audio-job vocabulary, the domain job table + its RLS,
-- and the private `meeting-audio` bucket.
--
-- Every substrate fact below was resolved from the LIVE CATALOG (pg_proc / pg_policies /
-- pg_constraint / pg_default_acl / storage.buckets) on 2026-08-06, per the B0 findings
-- (docs/plans/audio-minutes-b0-findings.md). Deviations from the plan text are marked ❗
-- and reported to the lead.
--
--   ❗1 RLS is ENABLED, not FORCED. The plan said "enable + force"; 0 of 157 public
--      tables in this database force RLS, and every SECURITY DEFINER RPC runs as the
--      table owner `postgres`. Forcing is off-pattern for zero security gain here
--      (`postgres` carries BYPASSRLS anyway), and it would be a live hazard the day an
--      owner without BYPASSRLS touches this table.
--   ❗2 The authenticated SELECT grant excludes BOTH `transcript` AND `result`. The plan
--      named only `transcript`. `result` is the callback payload AS RECEIVED and carries
--      the same verbatim substance; the review page reads `draft` (never `result` — see
--      apply_minutes_review in migration 2), so excluding it costs nothing and keeps the
--      audited door the only path to verbatim speech (D8).
--
-- Path convention: '<meeting_id>/<job_id>/<sanitized_filename>'. There are NO
-- storage.objects policies for `authenticated` on this bucket at all: uploads go through
-- a server-minted signed upload URL and downloads through a server-minted signed URL, so
-- an authenticated client can neither enumerate nor read an object directly (D2/D3).
-- =============================================================================

-- --- D18: the shared cross-kind vocabulary. Future audio kinds (case interviews next)
-- --- reuse this enum; only the TABLE is domain-owned (ADR 0099 D18 "per-domain tables,
-- --- shared kind machinery").
create type public.audio_job_status as enum (
  'uploading',   -- row minted, browser is pushing bytes to the bucket
  'processing',  -- handed to minute_generator, awaiting the callback
  'done',        -- callback received, review pending
  'failed',      -- service or platform error, acknowledged
  'cancelled',   -- user gave up (may be cancelled from uploading/processing/done)
  'applied'      -- review concluded and written into the meeting
);

create table public.meeting_minutes_jobs (
  id               uuid primary key default gen_random_uuid(),
  -- B0 §6: mirrors meeting_agenda_items / meeting_attendees / action_items.source_meeting_id.
  meeting_id       uuid not null references public.meetings(id) on delete cascade,
  requested_by     uuid not null references public.profiles(id),
  status           public.audio_job_status not null default 'uploading',
  audio_path       text,
  audio_deleted_at timestamptz,
  service_job_id   text,
  error_code       text,
  error_message    text,
  result           jsonb,
  draft            jsonb,
  transcript       text,
  received_at      timestamptz,
  applied_at       timestamptz,
  cancelled_at     timestamptz,
  purged_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger touch_meeting_minutes_jobs_updated_at
  before update on public.meeting_minutes_jobs
  for each row execute function app.touch_updated_at();

-- D4/D13: one active job per meeting, enforced by the DB and not by the UI. A
-- `done` job is still active — it is awaiting review, and a second upload would
-- silently orphan it.
create unique index meeting_minutes_jobs_active_uidx
  on public.meeting_minutes_jobs (meeting_id)
  where status in ('uploading', 'processing', 'done');

-- B5's lazy reconciliation scan (D10) walks stale non-terminal rows oldest-first.
create index meeting_minutes_jobs_status_created_idx
  on public.meeting_minutes_jobs (status, created_at);

-- The RLS predicate and every history read start from the meeting.
create index meeting_minutes_jobs_meeting_idx
  on public.meeting_minutes_jobs (meeting_id);

alter table public.meeting_minutes_jobs enable row level security;

-- ONE read policy. B0 §1: the effective canEdit gate on the Ata editor is
-- `app.is_staff_admin_of` alone (update_meeting_minutes is SECURITY INVOKER and its
-- assert is is_staff_admin_of), and every meeting_agenda_items WRITE policy uses exactly
-- this predicate. PO decision O1: `administrativo` / `schedule_meetings` is deliberately
-- OUT — the audio feature mirrors today's Ata editor, nothing wider.
create policy meeting_minutes_jobs_select on public.meeting_minutes_jobs
  for select to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));

-- No INSERT / UPDATE / DELETE policy for `authenticated` exists, by design: every
-- mutation goes through the migration-2 RPCs (or the service-role webhook helpers).

-- Belt-and-braces on the ACL. `pg_default_acl` for tables created by `postgres` in
-- `public` currently grants only {postgres, service_role} — but `config.toml`'s
-- `auto_expose_new_tables` note records that this default is in flux and the Cloud
-- project may still auto-expose. Revoke explicitly, then grant the column list.
revoke all on public.meeting_minutes_jobs from authenticated, anon;

-- ❗2 — `transcript` and `result` are NOT in this list. A column the grant omits reads
-- 42501, which is the point (pgTAP 305 asserts it). The audited door
-- public.read_minutes_transcript is the only way to the verbatim text.
grant select (
  id, meeting_id, requested_by, status,
  audio_path, audio_deleted_at, service_job_id,
  error_code, error_message, draft,
  received_at, applied_at, cancelled_at, purged_at,
  created_at, updated_at
) on public.meeting_minutes_jobs to authenticated;

comment on table public.meeting_minutes_jobs is
  'MIN (ADR 0099) — one meeting-audio → generated-ata job. Transient by design: `result`, '
  '`draft` and `transcript` are PURGED when the job reaches applied/cancelled/failed '
  '(D8), leaving a content-free history row. Substance tier, NOT a Rule-12 PHI module: '
  'no fourth PHI store is created. Readable only by the commission staff_admin circle '
  '(meeting_minutes_jobs_select); mutated only through the migration-2 RPCs.';
comment on column public.meeting_minutes_jobs.transcript is
  'Verbatim ASR transcript. NOT in the authenticated SELECT grant — reachable only via '
  'the audited door public.read_minutes_transcript (audit action minutes_transcript.read, '
  'D8/D15). Purged at every terminal status.';
comment on column public.meeting_minutes_jobs.result is
  'The minute_generator callback payload AS RECEIVED, immutable. NOT in the authenticated '
  'SELECT grant (it restates the transcript-tier substance). The review page and '
  'apply_minutes_review read `draft`, never this column. Purged at every terminal status.';
comment on column public.meeting_minutes_jobs.draft is
  'The review page working copy, autosaved. Seeded from `result` by the webhook, then '
  'owned by the reviewer. apply_minutes_review reads THIS and never `result`. Purged at '
  'every terminal status.';
comment on column public.meeting_minutes_jobs.audio_path is
  'storage object path in the `meeting-audio` bucket: <meeting_id>/<job_id>/<filename>. '
  'Composed server-side; never client-supplied. Deleted at the earliest of callback '
  'audio_release / apply / cancel / failure / the 24h TTL sweep (D2).';

-- =============================================================================
-- The bucket. Private, 500 MB (D3), audio MIME types only.
--
-- ⚠ THREE ceilings must all admit 500 MB and this is only the first:
--   1. storage.buckets.file_size_limit  — here, 524288000.
--   2. supabase/config.toml [storage] file_size_limit — a GLOBAL local cap above every
--      bucket; raised to 512MiB in the same commit. Needs `supabase stop && supabase
--      start`, and the file is committed, so it applies to every worktree at once.
--   3. Cloud: the project's storage upload-size setting (plan-dependent) — B8 runbook.
--
-- MIME list: the plan named 7 types and told us to verify what browsers actually emit
-- for `.m4a`. ❗3 Windows/Chrome commonly reports `audio/x-m4a` (from the OS registry),
-- not `audio/mp4`, so BOTH are admitted — a bucket that rejects the single most likely
-- phone-recording container would fail on the first real 2h recording. The `x-`/legacy
-- aliases for wav, mp3 and flac are admitted for the same reason. F2 validates
-- client-side too, with pt-BR errors, so this list is the floor and not the UX.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('meeting-audio', 'meeting-audio', false, 524288000,
   '{audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave,audio/ogg,audio/opus,audio/webm,audio/flac,audio/x-flac}'::text[])
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

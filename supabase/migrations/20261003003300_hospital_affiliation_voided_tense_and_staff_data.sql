-- AFF4 B2 — ADR 0151 D7 (the voided tense) + D9 (per-hospital staff data), both on
-- `public.hospital_affiliations`.
--
-- D7 closes Critical FUP C5 (`FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION`): since
-- ADR 0148 made read visibility EVER-HELD, a mis-entered affiliation granted a permanent,
-- unrevocable read. `end` cannot fix it — ending says "was true and stopped", which is a lie
-- about a row that was never true, and an ever-held leg reads ended rows anyway. The third
-- tense is `void`, with a MANDATORY reason.
--
-- D9 puts per-hospital employment data ON the affiliation rather than in a parallel
-- `hospital_staff_profiles` table (drift, rehire ambiguity, a duplicated security surface —
-- rejected alternatives recorded in docs/plans/org-affiliation-and-staff-data-model.md).
-- `work_*` deliberately contrasts with the personal, column-locked `profiles.phone`.
-- Zero new `profiles` columns anywhere in AFF4.
--
-- SCOPE NOTE — what this migration does NOT do. The voided EXCLUSION in the three ever-held
-- person-read legs (`profiles_admin_select`, `profiles_select_self_or_admin`,
-- `professional_credentials_select`) is AFF4 B3, a separate migration, because it is an
-- ALTER POLICY on live read legs and carries its own diff-scoped door sweep. Until B3 lands,
-- voiding a row narrows nothing: the columns exist, the index excludes them, no reader does.
-- There is also no writer for `voided_at` until B4 — `void_affiliation` is a B4 door.
--
-- ⚠ `app.trg_audit_hospital_affiliations` below is RE-EMITTED FROM THE LIVE
-- `pg_get_functiondef`, never from earlier migration text: migrations in this repo rewrite
-- function bodies at runtime, so a create-or-replace built from stale text silently reverts
-- intervening patches.
--
-- Proof: supabase/tests/ (AFF4 B9) — the voided-shape CHECK, the swapped active-unique index
-- (void frees the slot for a same-day re-affiliation), the new audit arms, and the D9 read
-- audience ASSERTED rather than inherited.

-- ---------------------------------------------------------------------------------------------
-- 1. The voided tense (D7)
-- ---------------------------------------------------------------------------------------------

alter table public.hospital_affiliations
  add column voided_at   timestamptz,
  add column voided_by   uuid references public.profiles(id),
  add column void_reason text;

-- Identical shape to `organization_affiliations_voided_shape`: `voided_at IS NULL` <=> nothing
-- else about the void is set; when the row IS voided the reason is MANDATORY and non-blank
-- (D7/D8). `voided_by` may be NULL on a service path, exactly as `ended_by` may.
alter table public.hospital_affiliations
  add constraint hospital_affiliations_voided_shape
  check (
    (voided_at is null     and voided_by is null and void_reason is null)
    or
    (voided_at is not null and void_reason is not null and btrim(void_reason) <> '')
  );

comment on column public.hospital_affiliations.voided_at is
  'ADR 0151 D7 — the voided tense, closing C5. Void ("was never true") is not end ("was true '
  'and stopped"). A voided row leaves the active-unique index, the footprint resolver and '
  '(from AFF4 B3) every person-read leg, but the ROW itself stays visible to this table''s '
  'own audience, badged Anulado.';

-- Index swap. "Active" is defined once (D6): ended_on IS NULL AND voided_at IS NULL. Without
-- this swap a voided row would keep occupying the person's slot at that hospital, so the
-- correction a void exists to enable — void the mistake, affiliate correctly, same day —
-- would fail on a unique violation.
-- Safe to drop and recreate: measured against the live catalog, no constraint is backed by
-- this index and no function body infers it as an ON CONFLICT arbiter.
drop index public.hospital_affiliations_active_uq;

create unique index hospital_affiliations_active_uq
  on public.hospital_affiliations (principal_id, hospital_id)
  where ended_on is null and voided_at is null;

-- `hospital_affiliations_hospital_active_idx` (WHERE ended_on IS NULL) is deliberately NOT
-- swapped: it is a non-unique lookup index, so indexing a superset of the active rows stays
-- correct — a voided row is filtered by recheck, never admitted by the index.

-- ---------------------------------------------------------------------------------------------
-- 2. Per-hospital staff data (D9)
-- ---------------------------------------------------------------------------------------------

-- `extensions.citext` is SCHEMA-QUALIFIED deliberately: the local apply path carries
-- `extensions` on its search_path, the remote `db push` login role does NOT, and a bare
-- `citext` there fails with 42704 "type citext does not exist" (measured in
-- 20260911000600_quality_board_door.sql). The type was never the divergence; the resolution
-- path was.
alter table public.hospital_affiliations
  add column job_title  text,
  add column work_email extensions.citext,
  add column work_phone text;

-- The `hospital_affiliations_employee_id_not_blank` precedent: NULL means "not recorded",
-- blank means someone saved an empty box, and only the first is a fact.
alter table public.hospital_affiliations
  add constraint hospital_affiliations_job_title_not_blank
    check (job_title is null or btrim(job_title) <> ''),
  add constraint hospital_affiliations_work_email_not_blank
    check (work_email is null or btrim(work_email::text) <> ''),
  add constraint hospital_affiliations_work_phone_not_blank
    check (work_phone is null or btrim(work_phone) <> '');

comment on column public.hospital_affiliations.job_title is
  'ADR 0151 D9 — cargo, per EMPLOYMENT (contrast: profession lives person-level on '
  'profiles.professional_category_id). Read audience is this table''s existing policy '
  'audience, stated as DECIDED, not inherited; reads are unaudited (ordinary personal data, '
  'not the Class-2 professional-identity register).';

-- No new GRANT is required and none is issued: `hospital_affiliations` carries a TABLE-level
-- SELECT grant to `authenticated` (relacl `authenticated=r`), not the column-list grants that
-- `profiles` and `case_referral` carry, so a new column is exposed to the policy audience the
-- moment it exists. That is the DECIDED audience per D9 — B9 asserts it rather than assuming
-- it, and asserts that `anon` still holds nothing.

-- ---------------------------------------------------------------------------------------------
-- 3. Audit trigger — the voided arm, and the staff-data columns (Rule 11)
-- ---------------------------------------------------------------------------------------------

-- Two new facts must reach the audit trail, and the LIVE body reaches neither:
--
--   * a void currently falls through the UPDATE branch's `else return null` and writes NOTHING.
--     D7/D8 require every void to be audited WITH its reason.
--   * a staff-data edit (job_title / work_email / work_phone) likewise falls through, because
--     the distinct-check enumerates columns by name. This is the exact shape the existing
--     `affiliation.updated` arm was added for — its own comment records that the matrícula
--     refresh "was itself an unaudited mutation until this arm existed".
--
-- Both are latent rather than live today: no writer sets any of the five columns until the
-- B4 doors exist. They are closed HERE, in the migration that creates the columns, so that
-- neither depends on being remembered later.

CREATE OR REPLACE FUNCTION app.trg_audit_hospital_affiliations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row      public.hospital_affiliations;
  v_action   text;
  v_summary  text;
  v_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    v_row     := new;
    v_action  := 'affiliation.created';
    v_summary := 'Vínculo hospitalar criado';
  elsif tg_op = 'DELETE' then
    -- Reachable ONLY under session_replication_role = replica: the BEFORE guard raises
    -- first in every other mode. This arm exists so that the one window in which D4 can
    -- be violated is not also invisible.
    v_row     := old;
    v_action  := 'affiliation.deleted';
    v_summary := 'Vínculo hospitalar EXCLUÍDO (contrário à ADR 0097 D4)';
  else
    -- AFF4 D7: void is tested FIRST. One UPDATE may set both `ended_on` and `voided_at`, and
    -- voided takes precedence — testing `ended_on` first would report the weaker verb.
    if new.voided_at is not null and old.voided_at is null then
      v_row     := new;
      v_action  := 'affiliation.voided';
      v_summary := 'Vínculo hospitalar anulado';
    elsif new.ended_on is not null and old.ended_on is null then
      v_row     := new;
      v_action  := 'affiliation.ended';
      v_summary := 'Vínculo hospitalar encerrado';
    elsif new.hospital_employee_id is distinct from old.hospital_employee_id
       or new.started_on is distinct from old.started_on
       -- AFF4 D9 staff data. Enumerated by name like their neighbours, which is precisely why
       -- adding a column without adding it here would make its edits unauditable.
       or new.job_title  is distinct from old.job_title
       or new.work_email is distinct from old.work_email
       or new.work_phone is distinct from old.work_phone then
      -- AFF W3/T3.3. Covers `update_affiliation` AND the matrícula refresh
      -- `affiliate_person` performs on an existing row — that refresh was itself an
      -- unaudited mutation until this arm existed.
      v_row     := new;
      v_action  := 'affiliation.updated';
      v_summary := 'Vínculo hospitalar atualizado';
    else
      return null;
    end if;
  end if;

  v_metadata := jsonb_build_object(
    'user_id',         v_row.principal_id,
    'organization_id', v_row.organization_id,
    'hospital_id',     v_row.hospital_id
  );

  -- D8: the reason is part of the audit record, not merely of the row. Administrative
  -- justification text — no payload, no PHI (Rule 11).
  if v_action = 'affiliation.voided' then
    v_metadata := v_metadata || jsonb_build_object('void_reason', v_row.void_reason);
  end if;

  perform app.audit_write(
    v_action, 'hospital_affiliation', v_row.id, null, v_summary,
    v_metadata,
    v_row.organization_id, v_row.hospital_id);

  return null;
end;
$function$;

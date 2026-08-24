-- ============================================================================
-- ADR 0137 D10/D11 — Migration C:
--   * `case_narratives.type_label` -> `display_label` (a REAL column rename)
--   * `case_narratives.assignment_role_id` + its DEFINER setter
--
-- ⛔ THE RE-EMISSION SET IS DERIVED FROM THE LIVE CATALOG AT MIGRATION TIME,
--    NOT COPIED INTO THIS FILE. A `rename column` does not rewrite a stored
--    function body, so every body naming the old column breaks at RUNTIME.
--    ADR 0137 D10 and the implementation plan both name SEVEN bodies; measured
--    on the live catalog (comment-stripped, `\m…\M` word boundaries) the real
--    figure is NINE candidates splitting SIX / THREE:
--
--    RENAME (they reference `case_narratives.type_label`):
--      app.trg_audit_case_narratives          4 hits   prosecdef=t
--      public.add_ad_hoc_narrative            1 bare   prosecdef=t
--      public.add_referral_shared_item        1 hit    prosecdef=t
--      public.create_case_from_template       1 hit    prosecdef=t
--      public.get_case_detail                 2 hits   prosecdef=t
--      public.list_my_cases                   2 hits   prosecdef=t
--
--    DO NOT RENAME (they reference `case_referral.type_label`, a DIFFERENT
--    column that ADR 0137 D10 explicitly leaves alone):
--      public.create_referral_draft · public.get_referral_detail ·
--      public.update_referral_draft
--
--    ⛔ TWO CORRECTIONS TO THE PLAN, AND THE FIRST ONE IS DANGEROUS:
--    1. The plan says "leave the referral arm of `add_referral_shared_item`
--       alone". Obeying the letter of that SHIPS A RUNTIME BREAK. That function
--       has exactly ONE `type_label` reference and it is
--       `coalesce(v_narrative.title, v_narrative.type_label)` — `v_narrative` is
--       `public.case_narratives`. The "referral half" the caution describes does
--       not exist in that body. The caution reads as care, which is precisely
--       why it would have caused the miss.
--    2. `public.update_case_narrative_body` is in ADR 0137 D10's list of seven
--       and does NOT contain the string `type_label` at all (verified by raw
--       substring, no comment stripping). The plan's ⚠ note about it being
--       `prosecdef = f` — "the class ARM=wrapper exists for" — therefore
--       attaches to the wrong function. The `prosecdef = f` bodies this BATCH
--       actually rewrites are `public.clone_template_version` and
--       `app._set_participant_patient_unchecked`, both in Migration B.
--
-- ⛔ NO TOP-LEVEL `set local` (silent 25P01 no-op). This file needs none.
-- ============================================================================

-- ── 1. Pin the candidate set BEFORE touching anything ──────────────────────
--
-- The six/three split needs human judgement (both columns are spelled
-- `type_label`, and `app.trg_audit_case_narratives` does not even mention
-- `case_narratives` by name — it works through NEW/OLD). Judgement cannot be
-- re-derived by a migration, so instead the migration refuses to run if the
-- CANDIDATE set has changed: a tenth body added since 2026-08-23 stops this
-- migration loudly rather than being silently rewritten or silently skipped.

do $pin$
declare
  v_actual text;
  v_expected constant text :=
    'app.trg_audit_case_narratives, public.add_ad_hoc_narrative, '
    'public.add_referral_shared_item, public.create_case_from_template, '
    'public.create_referral_draft, public.get_case_detail, '
    'public.get_referral_detail, public.list_my_cases, public.update_referral_draft';
begin
  select string_agg(r, ', ' order by r) into v_actual
  from (
    select n.nspname || '.' || p.proname as r
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public') and p.prokind in ('f', 'p')
      and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
          ~ '\mtype_label\M'
  ) s;

  if v_actual is distinct from v_expected then
    -- RAISE takes a literal format string, so the message is composed first.
    raise exception
      'type_label candidate set changed — classify the difference by hand before renaming. expected: [%] actual: [%]',
      v_expected, coalesce(v_actual, '(none)')
      using errcode = 'HC0T5';
  end if;
end;
$pin$;

-- ── 2. The rename ───────────────────────────────────────────────────────────

alter table public.case_narratives rename column type_label to display_label;

alter table public.case_narratives
  rename constraint case_narratives_type_label_not_blank
  to case_narratives_display_label_not_blank;

comment on column public.case_narratives.display_label is
  'ADR 0137 D10. The effective label SNAPSHOTTED at case creation (a title '
  'override, else the narrative type''s label), so later vocabulary edits never '
  'rewrite an opened case. Renamed from `type_label`, which read as a foreign '
  'key to the type rather than as the displayed string it is. '
  '⛔ `case_referral.type_label` is a DIFFERENT column and is NOT renamed.';

-- ── 3. Re-emit the six bodies FROM THE LIVE CATALOG ────────────────────────
--
-- `pg_get_functiondef` returns stored source, which a column rename does not
-- touch — so this reads the pre-rename text and rewrites exactly the bare
-- column references.
--
-- ⭐ THE `\m…\M` WORD BOUNDARY IS LOAD-BEARING, NOT TIDINESS. A plain
--    `replace(def, 'type_label', 'display_label')` would rewrite
--    `public.add_ad_hoc_narrative`'s PARAMETER `p_new_type_label` (2 hits) and
--    its local `v_type_label` (3 hits) as well as the one column reference it
--    actually has. Renaming the parameter would silently change the RPC's
--    signature and break the TypeScript caller, which passes it by name.
--    Measured per body before writing this: raw hits vs bare hits are
--    6/1 for add_ad_hoc_narrative and equal for the other five.

do $reemit$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select p.oid, n.nspname, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('app', 'trg_audit_case_narratives'),
      ('public', 'add_ad_hoc_narrative'),
      ('public', 'add_referral_shared_item'),
      ('public', 'create_case_from_template'),
      ('public', 'get_case_detail'),
      ('public', 'list_my_cases')
    )
  loop
    v_def := r.def;
    v_new := regexp_replace(v_def, '\mtype_label\M', 'display_label', 'g');
    if v_new = v_def then
      raise exception 're-emission no-op for %.% — the rename target was not found',
        r.nspname, r.proname using errcode = 'HC0T5';
    end if;
    execute v_new;
  end loop;
end;
$reemit$;

-- ── 4. Post-rename keystone, BOTH DIRECTIONS ───────────────────────────────
--
-- ⚠ A ONE-SIDED CHECK PASSES IF TOO MUCH WAS RENAMED. Asserting only "no body
--   still says type_label" is satisfied by a global rename that also broke the
--   three referral bodies. Both halves are asserted.

do $keystone$
declare
  v_stale text;
  v_referral_ok integer;
begin
  -- (a) No CASE-NARRATIVE body may still name the old column.
  select string_agg(r, ', ' order by r) into v_stale
  from (
    select n.nspname || '.' || p.proname as r
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('app', 'trg_audit_case_narratives'),
      ('public', 'add_ad_hoc_narrative'),
      ('public', 'add_referral_shared_item'),
      ('public', 'create_case_from_template'),
      ('public', 'get_case_detail'),
      ('public', 'list_my_cases')
    )
      and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
          ~ '\mtype_label\M'
  ) s;
  if v_stale is not null then
    raise exception 'still referencing case_narratives.type_label: %', v_stale
      using errcode = 'HC0T5';
  end if;

  -- (b) The three REFERRAL bodies must STILL name it — they address
  --     `case_referral.type_label`, which is untouched.
  select count(*) into v_referral_ok
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_referral_draft', 'get_referral_detail', 'update_referral_draft')
    and pg_get_functiondef(p.oid) ~ '\mtype_label\M';
  if v_referral_ok <> 3 then
    raise exception
      'over-rename: only % of the 3 referral bodies still reference case_referral.type_label',
      v_referral_ok using errcode = 'HC0T5';
  end if;

  -- (c) And the referral COLUMN itself is still there.
  if not exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.case_referral'::regclass
      and a.attname = 'type_label' and a.attnum > 0 and not a.attisdropped
  ) then
    raise exception 'case_referral.type_label was renamed and must not have been'
      using errcode = 'HC0T5';
  end if;
end;
$keystone$;

-- ── 5. ADR 0137 D11 — case_narratives.assignment_role_id ───────────────────
--
-- ⚠ DATA MODEL ONLY IN THIS BATCH — no UI, deliberately. `case_phases` has
--   carried the twin column with no UI caller since ethics D10
--   (`setCasePhaseAssignmentRole` is an orphan action); the narrative column
--   lands in the same state ON PURPOSE, so the two stay symmetric and a later
--   increment can wire both at once. `process_template_narratives` does NOT get
--   the column, for the same reason: `process_template_phases` does not have it.

alter table public.case_narratives
  add column assignment_role_id uuid null references public.case_assignment_roles(id);

comment on column public.case_narratives.assignment_role_id is
  'ADR 0137 D11. Optional org-scoped assignment role for this narrative, '
  'mirroring case_phases.assignment_role_id. Written only by '
  'public.set_case_narrative_assignment_role. No UI caller yet, by decision.';

-- Mirrors `case_phases_assignment_role_idx`. Required, not cosmetic:
-- `supabase/tests/296` §M6 sweeps the whole process/case cluster for UNINDEXED
-- foreign keys, and an unindexed FK makes every referenced-side check (deleting
-- a `case_assignment_roles` row) a sequential scan of `case_narratives`.
create index case_narratives_assignment_role_idx
  on public.case_narratives (assignment_role_id);

-- The audit allow-list gains the new column. Re-emitted from the LIVE catalog
-- (it was just rewritten in §3, so the file text of any earlier migration is
-- doubly stale here) with only the array literal changed.
do $audit_cols$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'trg_audit_case_narratives';

  v_new := replace(
    v_def,
    $old$array['display_label', 'display_position', 'is_expected',
                                  'status', 'assigned_to', 'is_ad_hoc']$old$,
    $new$array['display_label', 'display_position', 'is_expected',
                                  'status', 'assigned_to', 'is_ad_hoc',
                                  'assignment_role_id']$new$);
  if v_new = v_def then
    raise exception 'audit column allow-list not found in trg_audit_case_narratives'
      using errcode = 'HC0T5';
  end if;
  execute v_new;
end;
$audit_cols$;

-- ── 6. public.set_case_narrative_assignment_role — the D11 twin ────────────
--
-- A deliberate mirror of `public.set_case_phase_assignment_role`: same
-- authority (ethics coordinator, HC0J1), same role-org validation (HC0J0), same
-- guard-window idiom. The only differences are the target table and therefore
-- the guard flag — `app.guard_case_narrative_frozen` reads
-- `app.in_narrative_rpc`, not `app.in_case_rpc`.

create or replace function public.set_case_narrative_assignment_role(
  p_narrative_id uuid,
  p_role_id uuid default null::uuid
)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare v_case_id uuid; v_commission uuid; v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_narratives where id = p_narrative_id;
  if v_case_id is null then raise exception 'narrativa não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_org := app.org_of_commission(v_commission);
  if p_role_id is not null and not exists (
       select 1 from public.case_assignment_roles r where r.id = p_role_id and r.organization_id = v_org) then
    raise exception 'papel de atribuição inválido' using errcode = 'HC0J0';
  end if;
  -- app.guard_case_narrative_frozen blocks a narrative write once the parent
  -- case is completed/cancelled; every sibling narrative RPC opens the same
  -- window around its update. (The phase twin opens app.in_case_rpc instead —
  -- different table, different guard, different flag.)
  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assignment_role_id = p_role_id where id = p_narrative_id;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

comment on function public.set_case_narrative_assignment_role(uuid, uuid) is
  'ADR 0137 D11. Sets a case narrative''s assignment role. Twin of '
  'public.set_case_phase_assignment_role, same coordinator authority. No UI '
  'caller in this batch, by decision — the phase twin has none either.';

-- ⛔ REVOKE before GRANT on every new public.* RPC, or the dashboard t19 pgTAP
--    guard reds (a function reachable by PUBLIC is reachable by `anon`).
revoke all on function public.set_case_narrative_assignment_role(uuid, uuid) from public;
grant execute on function public.set_case_narrative_assignment_role(uuid, uuid) to authenticated;

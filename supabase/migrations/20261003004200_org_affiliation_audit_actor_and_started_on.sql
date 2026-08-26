-- ============================================================================
-- AFF4 · two corrections that make CLAIMED properties TRUE.
--
-- Both were found by reading the LIVE catalog against ADR 0151 while building B8's
-- `registerUser` half (D13). Neither is a new feature; each closes the gap between a
-- sentence a decision of record already asserts and what the database actually does.
--
-- ── 1. `org_affiliation.*` audit rows now NAME THE ACTOR ────────────────────
--
-- ADR 0151 D5 says the org-parent ensure is "audited as its own
-- `org_affiliation.created` row NAMING THE ACTOR", and `app.affiliate_person_impl`'s
-- live body repeats that sentence verbatim. It was FALSE on the service-role path:
-- `app.trg_audit_organization_affiliations` built its metadata from `user_id` +
-- `organization_id` only, and `app.audit_write` derives `v_actor := auth.uid()`, which
-- is NULL under `service_role`. So the audit row named nobody on exactly the path D13
-- introduces — registration, which runs service-role because it provisions the account.
--
-- ⭐ WHY NOTHING NOTICED, and the reason a reader who checks will conclude the bug is
--    not there: on the AUTHENTICATED path `auth.uid()` IS the actor, so `actor_id` is
--    populated and the claim holds. Every surface anyone has exercised — the org admin
--    clicking through `AffiliationsPanel` — takes that path. The failure is visible only
--    from the service-role one, which had no product caller until D13.
--
-- The fix is `log_cpf_probe_for`'s recorded pattern, not a new one: the actor rides in
-- the METADATA as `actor_user_id`, taken from the row's own `created_by` / `ended_by` /
-- `voided_by` — so it is the actor the door recorded, never a re-derivation. The
-- `actor_id` COLUMN is left alone; `app.audit_write` takes no actor parameter and
-- pretending otherwise would be worse than the honest gap.
--
-- ⛔ RESIDUE, STATED SO A PARTIAL FIX IS NOT READ AS A COMPLETE ONE. This fixes ONE
--    trigger — the one this program authored. The following service-role writers remain
--    unattributed, deliberately and unchanged: `app.trg_audit_hospital_affiliations`
--    (`affiliation.created` / `.ended` / `.voided` / `.updated`), `membership.granted`,
--    and `form.created`. `public.log_cpf_probe_for`'s own body declares that a separate
--    workstream ("PLATFORM-WIDE and pre-existing ... NOT fixed here"), and this migration
--    does not widen it. If you are auditing attribution, one attributed trigger is NOT
--    evidence the class was handled — it is evidence that exactly this table was.
--
-- ⚠ `org_affiliation.updated` and `.deleted` carry `actor_user_id: null`, and the KEY IS
--   STILL EMITTED. `organization_affiliations` has no `updated_by` column, so there is no
--   recorded actor to name; an omitted key would read as an oversight, a guessed value
--   would be a fabrication. Null says "this table does not record who", which is true.
--
-- ── 2. the org-parent ensure stops DISCARDING a caller-supplied start date ──
--
-- `app.affiliate_person_impl` accepts `p_started_on`, applies it to the hospital row, and
-- inserted the org parent with no `started_on` at all — so the parent defaulted to
-- `current_date` even when the caller said 2019. After D13 threads a start date through
-- registration that becomes user-visible in F5's "Meus dados": a 2019 hospital row beside
-- a today org row, for one employment.
--
-- ⚠ It also inverted the program's own care: B5's backfill approximates
--   `started_on = created_at::date` precisely BECAUSE the date matters, which would have
--   left backfilled rows more faithful than the ones the live write path produces.
--
-- ⚠ MEASURED, not assumed, before changing what data lands: `started_on` is NEVER an
--   activeness input. Zero `pg_policies` predicates and zero indexes reference it
--   (measured 2026-08-26 over the live catalog). Every live reference is a writer, a
--   payload projection (`list_org_people`), an audit VERB selector (`new.started_on is
--   distinct from old.started_on` -> `.updated`), or a period sanity check against
--   `ended_on`. Activeness is `ended_on IS NULL AND voided_at IS NULL` everywhere (D6/D7),
--   so this changes no visibility, no uniqueness and no authority.
--
-- ⭐ BOTH BODIES ARE RE-EMITTED AGAINST THE LIVE CATALOG, never against migration text
--    (ADR 0078's methodology finding). `affiliate_person_impl` is a body this repo
--    rewrites at runtime, so the file that created it is not what is running; the trigger
--    function is pinned by an md5 PRECONDITION so a body rewritten between 20261003003200
--    and here raises instead of being silently clobbered. Every patch below asserts it
--    LANDED — a no-op reported as a correction is the mutation-that-did-not-apply shape.
-- ============================================================================

-- ── 1. the audit trigger ────────────────────────────────────────────────────
do $guard$
declare
  -- The body as created by 20261003003200, measured live on a fresh reset 2026-08-26.
  v_expected constant text := '9f0a38db62497a2f8d2782dcdf3703cf';
  v_actual   text;
begin
  select md5(p.prosrc) into v_actual
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'trg_audit_organization_affiliations';

  if v_actual is null then
    raise exception 'app.trg_audit_organization_affiliations not found — this correction has no subject';
  end if;

  if v_actual <> v_expected then
    raise exception
      'app.trg_audit_organization_affiliations body is not the one this migration was written against (expected md5 %, found %) — refusing to clobber a body someone else rewrote',
      v_expected, v_actual;
  end if;
end;
$guard$;

create or replace function app.trg_audit_organization_affiliations()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_row      public.organization_affiliations;
  v_action   text;
  v_summary  text;
  v_metadata jsonb;
  -- AFF4 — the actor the DOOR recorded on the row, never a re-derivation. See the
  -- migration header: `app.audit_write` derives `auth.uid()`, which is NULL on every
  -- service-role path, so `actor_id` alone cannot name the registrar.
  v_actor    uuid;
begin
  if tg_op = 'INSERT' then
    v_row     := new;
    v_action  := 'org_affiliation.created';
    v_summary := 'Vínculo organizacional criado';
    v_actor   := v_row.created_by;
  elsif tg_op = 'DELETE' then
    -- Reachable ONLY under session_replication_role = replica: the BEFORE guard raises first
    -- in every other mode. This arm exists so that the one window in which the no-delete rule
    -- can be violated is not also invisible. Mirrors the hospital trigger's D-arm.
    v_row     := old;
    v_action  := 'org_affiliation.deleted';
    v_summary := 'Vínculo organizacional EXCLUÍDO (contrário à ADR 0151 D1)';
    -- No actor: a replica-mode delete goes around every door, so there is nobody to name.
    v_actor   := null;
  else
    -- Void is tested FIRST: a single UPDATE may set both `ended_on` and `voided_at`, and
    -- ADR 0151 D7 rules that voided takes precedence. Testing `ended_on` first would report
    -- the weaker verb for the stronger act.
    --
    -- ⚠ THE ACTOR FOLLOWS THE VERB, not a coalesce precedence. A row that is ended AND
    -- voided reports `voided` and must name the VOIDER; picking the first non-null of
    -- three columns would name the ender on exactly that row.
    if new.voided_at is not null and old.voided_at is null then
      v_row     := new;
      v_action  := 'org_affiliation.voided';
      v_summary := 'Vínculo organizacional anulado';
      v_actor   := v_row.voided_by;
    elsif new.ended_on is not null and old.ended_on is null then
      v_row     := new;
      v_action  := 'org_affiliation.ended';
      v_summary := 'Vínculo organizacional encerrado';
      v_actor   := v_row.ended_by;
    elsif new.started_on is distinct from old.started_on then
      v_row     := new;
      v_action  := 'org_affiliation.updated';
      v_summary := 'Vínculo organizacional atualizado';
      -- `organization_affiliations` has no `updated_by` column. The key is still emitted,
      -- null — see the header: absent reads as an oversight, guessed would be a fabrication.
      v_actor   := null;
    else
      return null;
    end if;
  end if;

  v_metadata := jsonb_build_object(
    'user_id',         v_row.principal_id,
    'organization_id', v_row.organization_id,
    'actor_user_id',   v_actor
  );

  -- D8: the reason is part of the audit record, not merely of the row. It is administrative
  -- justification text (no PHI, no payload) — Rule 11 records that + who, never content.
  if v_action = 'org_affiliation.voided' then
    v_metadata := v_metadata || jsonb_build_object('void_reason', v_row.void_reason);
  end if;

  perform app.audit_write(
    v_action, 'organization_affiliation', v_row.id, null, v_summary,
    v_metadata,
    v_row.organization_id, null);

  return null;
end;
$fn$;

-- Assert the new property is actually present in what is now running. A CREATE OR REPLACE
-- cannot silently fail, but the guard above can be edited away by a future author while
-- this line cannot be satisfied by anything except the change itself.
do $verify$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'trg_audit_organization_affiliations'
       and p.prosrc like '%actor_user_id%'
  ) then
    raise exception 'app.trg_audit_organization_affiliations did not gain actor_user_id';
  end if;
end;
$verify$;

-- ── 2. `app.affiliate_person_impl` — the org-parent ensure carries the date ──
do $patch$
declare
  v_def     text;
  v_patched text;
  v_step    text;

  -- (a) the org-parent INSERT itself.
  v_old_a constant text :=
       '    insert into public.organization_affiliations (principal_id, organization_id, created_by)'
    || E'\n    values (p_user, v_org, p_actor);';
  v_new_a constant text :=
       '    insert into public.organization_affiliations'
    || E'\n      (principal_id, organization_id, started_on, created_by)'
    || E'\n    values (p_user, v_org, coalesce(p_started_on, current_date), p_actor);';

  -- (b) a sentence that this change makes false. The body says `p_started_on` "applies to
  --     the INSERT below and nowhere else" — after (a) it applies to the org insert too,
  --     and the branch that comment guards is the HOSPITAL one. A comment is an assertion.
  v_old_b constant text :=
       '    -- ⚠ `p_started_on` IS DELIBERATELY IGNORED ON THIS PATH. It applies to the INSERT'
    || E'\n    -- below and nowhere else: this is the idempotent CREATE door, and a create door';
  v_new_b constant text :=
       '    -- ⚠ `p_started_on` IS DELIBERATELY IGNORED ON THIS PATH — the path where an ACTIVE'
    || E'\n    -- hospital affiliation already exists. It applies to the hospital INSERT below, and'
    || E'\n    -- (since 20261003004200) to the org-parent ensure above: this is the idempotent'
    || E'\n    -- CREATE door, and a create door';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'affiliate_person_impl';

  if v_def is null then
    raise exception 'app.affiliate_person_impl not found — this correction has no subject';
  end if;

  v_step    := 'org-parent insert';
  v_patched := replace(v_def, v_old_a, v_new_a);
  if v_patched = v_def then
    raise exception 'patch step "%" matched nothing in app.affiliate_person_impl — refusing to report a no-op as a correction', v_step;
  end if;
  v_def := v_patched;

  v_step    := 'the p_started_on scope comment';
  v_patched := replace(v_def, v_old_b, v_new_b);
  if v_patched = v_def then
    raise exception 'patch step "%" matched nothing in app.affiliate_person_impl — refusing to report a no-op as a correction', v_step;
  end if;

  execute v_patched;
end;
$patch$;

-- The same land-assertion as above, on the property rather than on the edit.
do $verify$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'affiliate_person_impl'
       and p.prosrc like '%values (p_user, v_org, coalesce(p_started_on, current_date), p_actor);%'
  ) then
    raise exception 'app.affiliate_person_impl org-parent ensure did not gain the start date';
  end if;
end;
$verify$;

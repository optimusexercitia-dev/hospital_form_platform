-- B2 — a print belongs to a SERIES, and `supersedes_id` becomes IMMUTABLE.
-- ADR 0126 D1.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE DEFECT THIS CLOSES IS LIVE TODAY AND WAS INVISIBLE
-- ═══════════════════════════════════════════════════════════════════════════
-- `start_correction_draft` inserts a NEW `responses` row carrying
-- `supersedes_id`. So after one correction R1 and R2 are unrelated as far as the
-- registry is concerned, and **both can hold an `active` print at the same
-- time** — one logical document, two current papers, no constraint violated. The
-- registry exists to answer *"which paper is current for this document"*; keyed
-- to a ROW it answers a different question, and answers it confidently.
--
-- ⚠ STORED, NOT DERIVED — forced, not preferred. A partial unique index requires
-- a stored column: `app.print_source_series` reads tables, so it cannot be
-- IMMUTABLE and cannot be indexed. It is computed at mint and frozen thereafter.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY `supersedes_id` MUST FREEZE IN THE SAME CHANGE
-- ═══════════════════════════════════════════════════════════════════════════
-- `app.guard_supersession_coherent` fires BEFORE INSERT OR UPDATE OF
-- supersedes_id — it VALIDATES the chain, it does not FREEZE it. A re-pointed
-- chain would therefore orphan an already-stored `source_series_id`, and the
-- one-active index would start enforcing against the wrong group. Freezing is
-- the narrowing; the rejected alternative was keeping it mutable behind a drift
-- detector. **A narrowing can be wrong-and-safe; a detector that is never
-- exercised cannot.**
--
-- Precondition, re-measured: nothing updates `supersedes_id` today.

-- ---------------------------------------------------------------------------
-- 1. `source_series_id` — added nullable, backfilled, THEN made NOT NULL
-- ---------------------------------------------------------------------------
-- ⚠ Deliberately NOT `add column … not null` in one step. That works only
-- because the table is empty (production holds 0 prints, ADR 0123 D4), i.e. it
-- would pass here for a reason that is not the reason it is correct — and would
-- fail on `db push` the day it is not. The three-step form is right for both.
alter table public.printed_documents
  add column if not exists source_series_id uuid;

do $backfill$
declare v_orphan int;
begin
  update public.printed_documents
     set source_series_id = app.print_source_series(source_kind, source_id)
   where source_series_id is null;

  -- A NULL here means the series dispatch could not resolve a root — a print
  -- whose source vanished, or a kind with no series arm. Fail LOUD: setting NOT
  -- NULL would raise anyway, but with a constraint error that says nothing about
  -- which row or why.
  select count(*) into v_orphan
    from public.printed_documents where source_series_id is null;
  if v_orphan > 0 then
    raise exception
      'BACKFILL INCOMPLETE: % printed_documents row(s) have no resolvable series', v_orphan;
  end if;
  raise notice 'source_series_id backfill: complete (0 unresolved).';
end $backfill$;

alter table public.printed_documents
  alter column source_series_id set not null;

comment on column public.printed_documents.source_series_id is
  'ADR 0126 D1. The LOGICAL document this print belongs to: for form_response the '
  'ROOT of the supersedes_id chain, for meeting its own id. Computed at mint and '
  'frozen. Stored rather than derived because the one-active partial unique index '
  'requires a stored column — app.print_source_series reads tables and cannot be '
  'IMMUTABLE. Its stability depends on supersedes_id being immutable (same migration).';

-- ⛔ NO `authenticated` COLUMN GRANT, and that is a decision. `printed_documents`
-- carries a CURATED COLUMN-LIST SELECT grant (17 columns; `verification_token`,
-- `revoked_by`, `revoked_reason` are deliberately withheld), so a new column is
-- unreadable by clients unless granted. Nothing in `src/lib/queries/` projects
-- this column — currency comes from the doors — so it stays ungranted rather than
-- widening the projection by reflex. ⚠ If a projection ever needs it, GRANT it in
-- the same migration or reads fail 42501 (the `case_referral` class).

-- ---------------------------------------------------------------------------
-- 2. Re-key the one-active index: ROW -> SERIES
-- ---------------------------------------------------------------------------
-- A NARROWING (it forbids a strict superset of what it forbade), so it cannot
-- fail on existing rows.
drop index if exists public.printed_documents_one_active;
create unique index printed_documents_one_active
  on public.printed_documents (source_kind, source_series_id, template_key)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- 3. The mint learns the series — SURGICALLY, with an assertion per edit
-- ---------------------------------------------------------------------------
-- ⚠ PATCHED FROM `pg_get_functiondef`, NOT RETYPED. This door is ~250 lines of
-- security-critical logic and a transcription slip would be invisible. The cost
-- of the technique is that the migration text is not the body (CLAUDE.md's
-- binding exception) — the catalog remains truth. The mitigation is that EVERY
-- replacement is asserted to have changed something: a missed anchor RAISES
-- instead of silently shipping an unpatched door.
--
-- ⛔ This adds NO fourth kind-conditional site. The mint's own body forbids one
-- ("stop and re-plan, never extend"); `app.print_source_series` is the
-- kind-dispatch, and the mint calls it ONCE, kind-agnostically.
do $patch$
declare
  v_src text;
  v_new text;
  v_step text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mint_printed_document';
  if v_src is null then
    raise exception 'mint_printed_document not found';
  end if;

  v_step := 'declare v_series';
  v_new := replace(v_src, '  v_constraint text;',
                          '  v_constraint text;' || E'\n  v_series uuid;');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  -- Compute the series immediately after the owning commission resolves, so it
  -- is available to BOTH the supersession update and the insert.
  v_step := 'compute v_series';
  v_new := replace(v_src,
    E'  if v_commission is null then\n    raise exception ''registro de origem não encontrado''\n      using errcode = ''HC0D1'';\n  end if;',
    E'  if v_commission is null then\n    raise exception ''registro de origem não encontrado''\n      using errcode = ''HC0D1'';\n  end if;\n'
    || E'\n  -- ADR 0126 D1: the LOGICAL document this print belongs to. One'
    || E'\n  -- kind-agnostic call to the series dispatch — NOT a fourth'
    || E'\n  -- kind-conditional site.'
    || E'\n  v_series := app.print_source_series(p_source_kind, p_source_id);'
    || E'\n  if v_series is null then'
    || E'\n    raise exception ''registro de origem não encontrado'''
    || E'\n      using errcode = ''HC0D1'';'
    || E'\n  end if;');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  -- ⚠ THE SUPERSESSION KEY. Without this the new index is enforced against a
  -- supersession step that still thinks in ROWS, and the mint starts failing on
  -- the second revision. One unconditional column swap.
  v_step := 'SUPERSEDE_ACTIVE -> series';
  v_new := replace(v_src, '     and source_id = p_source_id',
                          '     and source_series_id = v_series');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  v_step := 'insert column list';
  v_new := replace(v_src,
    '      id, source_kind, source_id, commission_id, template_key, template_version,',
    '      id, source_kind, source_id, source_series_id, commission_id, template_key, template_version,');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  v_step := 'insert values list';
  v_new := replace(v_src,
    '      p_id, p_source_kind, p_source_id, v_commission, p_template_key,',
    '      p_id, p_source_kind, p_source_id, v_series, v_commission, p_template_key,');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;

  execute v_new;
  raise notice 'mint_printed_document: patched for source_series_id (5/5 anchors hit).';
end $patch$;

-- ---------------------------------------------------------------------------
-- 4. `supersedes_id` becomes IMMUTABLE after insert
-- ---------------------------------------------------------------------------
create or replace function app.guard_supersedes_id_frozen()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if new.supersedes_id is distinct from old.supersedes_id then
    raise exception
      'a origem de uma correção não pode ser alterada após a criação'
      using errcode = 'HC0DT';
  end if;
  return new;
end;
$function$;

create trigger guard_supersedes_id_frozen_trg
  before update of supersedes_id on public.responses
  for each row execute function app.guard_supersedes_id_frozen();

-- ⚠ NARROWED TO `BEFORE INSERT` — ADR 0126 D1 obligation 2's PREFERRED option (a
-- narrowing, therefore safe), not the "commented unreachable backstop" variant.
-- Leaving both on UPDATE would have been actively harmful, and this was measured
-- rather than assumed: `guard_supersedes_id_frozen` sorts ALPHABETICALLY BEFORE
-- `guard_supersession_coherent`, so the immutability refusal would have
-- PRE-EMPTED the authority refusal — silently converting the privilege-escalation
-- pin into an immutability pin, which is the exact conversion obligation 1
-- forbids.
--
-- The escalation property keeps THREE independent INSERT-path homes in
-- `225_supersession.sql`: `14a` (the core exploit, 42501), `14b` (its
-- non-creation control) and `14d` (the flag-off path). Verified by reading that
-- file, not by assuming.
drop trigger if exists guard_supersession_coherent_trg on public.responses;
create trigger guard_supersession_coherent_trg
  before insert on public.responses
  for each row execute function app.guard_supersession_coherent();

revoke all on function app.guard_supersedes_id_frozen() from public;

-- ---------------------------------------------------------------------------
-- 5. Self-verification — from the CATALOG, never from the text above
-- ---------------------------------------------------------------------------
do $verify$
declare
  v_idx text;
  v_coh text;
  v_pub boolean;
  v_secdef boolean;
begin
  select indexdef into v_idx from pg_indexes
   where tablename = 'printed_documents' and indexname = 'printed_documents_one_active';
  if v_idx is null or v_idx not like '%source_series_id%' then
    raise exception 'INDEX NOT RE-KEYED: printed_documents_one_active is %', coalesce(v_idx, '<missing>');
  end if;
  if v_idx like '%source_id, template_key%' then
    raise exception 'INDEX STILL ROW-KEYED: %', v_idx;
  end if;

  -- The mint must actually reference the new column now.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'mint_printed_document'
       and p.prosrc like '%source_series_id = v_series%') then
    raise exception 'MINT NOT PATCHED: SUPERSEDE_ACTIVE is not keyed on the series';
  end if;

  -- The coherence trigger must be INSERT-only now.
  select string_agg(
           case when t.tgtype::int & 4 = 4 then 'INSERT' end || ''
           || case when t.tgtype::int & 16 = 16 then '+UPDATE' else '' end, ',')
    into v_coh
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'responses' and t.tgname = 'guard_supersession_coherent_trg'
    and not t.tgisinternal;
  if v_coh is null or v_coh like '%UPDATE%' then
    raise exception 'COHERENCE TRIGGER NOT NARROWED: events = %', coalesce(v_coh, '<missing>');
  end if;

  select has_function_privilege('public', p.oid, 'execute'), p.prosecdef
    into v_pub, v_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'guard_supersedes_id_frozen';
  if v_pub then
    raise exception 'ACL REGRESSION: app.guard_supersedes_id_frozen is PUBLIC-executable';
  end if;
  if not v_secdef then
    raise exception 'app.guard_supersedes_id_frozen is not SECURITY DEFINER';
  end if;

  raise notice 'B2 verified from the catalog: index re-keyed, mint patched, coherence trigger INSERT-only, ACL tight.';
end $verify$;

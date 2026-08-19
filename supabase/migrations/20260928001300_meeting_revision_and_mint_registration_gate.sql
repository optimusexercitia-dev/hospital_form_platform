-- B3 — the meeting REVISION epoch, the mint's REGISTRATION GATE, and
-- COMPARE-AND-MINT. ADR 0126 D9 + ADR 0125 D1/D7 + 0126 Consequences (TOCTOU).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. WHY REGISTRATION MUST BE ENFORCED IN THE DOOR, NOT IN THE ACTION
-- ═══════════════════════════════════════════════════════════════════════════
-- ADR 0125 D7 concludes that HC069 becomes structurally unreachable. That is
-- STRUCTURAL only if `mint_printed_document` itself refuses a non-locked source.
-- If only the server action refused, a direct RPC call would still construct the
-- state — and a `tester` spec asserting "an in_progress response does not
-- register" would pass because the UI does not OFFER it, not because the
-- platform REFUSES it. Those are different facts and only one of them is a
-- guarantee.
--
-- ⛔ ONE kind-agnostic call to the B1 dispatch. The mint's own body forbids a
-- fourth kind-conditional site ("stop and re-plan, never extend").
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 2. THE REVISION EPOCH (D9) — and why a set-membership test cannot work
-- ═══════════════════════════════════════════════════════════════════════════
-- The corridor D2 could not see: mint at `signed` -> `reopen_meeting` (revokes
-- signatures, returns the meeting to `held`, where minutes are editable) -> edit
-- -> re-advance -> re-sign -> nobody re-mints. The registration predicate is
-- satisfied AGAIN, so any predicate phrased as "is the source in a registering
-- state" reads TRUE, and the old print — whose `content_hash` pins content that
-- NO LONGER EXISTS — reads current.
--
-- A monotonic counter is the only thing that distinguishes "the same state" from
-- "this state again, with different content". ⛔ `reopen_meeting` must remain its
-- ONLY writer: a second writer breaks the epoch.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 3. COMPARE-AND-MINT — the corridor is a TOCTOU
-- ═══════════════════════════════════════════════════════════════════════════
-- The render is out-of-band (HTML -> Gotenberg, seconds) and both reversal doors
-- can fire mid-corridor. The predicate is therefore evaluated INSIDE this
-- transaction, and the door compares the source state observed AT RENDER TIME
-- against the row it reads — otherwise a registered hash can pin bytes of a state
-- that never coherently registered.
--
-- ⚠ WHAT COVERS WHICH KIND, stated rather than implied:
--   • `meeting`       — the REVISION compare does the work. signed -> held ->
--                       re-signed leaves the status identical and the revision
--                       different, so only the counter catches it.
--   • `form_response` — the revision is always 0 and the compare is a STRUCTURAL
--                       NO-OP. What closes its TOCTOU is re-evaluating
--                       `print_source_registers` inside this transaction: if
--                       `reject_correction` fired mid-render the predicate now
--                       returns false and the door raises HC0DP. Its content
--                       cannot change while registering (submitted is immutable,
--                       and the only walk-back needs an OPEN correction, which
--                       de-registers it).
-- The differential keystone therefore lives on the MEETING arm. Saying so here
-- is the point: the form_response arm is covered by a DIFFERENT mechanism, not by
-- this parameter, and a reader who assumes otherwise would test the wrong thing.

-- ---------------------------------------------------------------------------
-- 4. `print_source_revision` — the fourth per-kind dispatch (0126 D7)
-- ---------------------------------------------------------------------------
create or replace function app.print_source_revision(
  p_source_kind text,
  p_source_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if p_source_id is null then
    return 0;
  end if;

  case p_source_kind
    when 'meeting' then
      return coalesce(
        (select m.revision from public.meetings m where m.id = p_source_id), 0);
    when 'form_response' then
      -- Responses have no epoch and need none: their reversal machinery spawns a
      -- NEW ROW (`start_correction_draft` / `supersede_response`), so the head
      -- conjunct does the real work there. A counter would be a second, silent
      -- authority for a fact the chain already carries.
      return 0;
    else
      return 0;                                   -- fail closed: 0 matches nothing stored
  end case;
end;
$function$;

revoke all on function app.print_source_revision(text, uuid) from public;

-- ---------------------------------------------------------------------------
-- 5. `printed_documents.source_revision` — stored at mint, frozen thereafter
-- ---------------------------------------------------------------------------
alter table public.printed_documents
  add column if not exists source_revision integer not null default 0;

comment on column public.printed_documents.source_revision is
  'ADR 0126 D9. The source''s revision epoch AT MINT TIME. HEAD for a meeting '
  'print is the revision match; for form_response it is always 0 and head is '
  'decided by the successor chain instead. Frozen after insert.';

-- ⛔ No `authenticated` column grant — same reasoning as `source_series_id`:
-- `printed_documents` carries a CURATED column-list SELECT grant, currency comes
-- from the doors, and nothing in src/lib/queries projects this column.

-- ---------------------------------------------------------------------------
-- 6. `reopen_meeting` bumps the epoch — surgically, with an assertion
-- ---------------------------------------------------------------------------
do $patch_reopen$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'reopen_meeting';
  if v_src is null then raise exception 'reopen_meeting not found'; end if;

  v_new := replace(v_src,
    E'  set status = ''held'', concluded_at = null, concluded_by = null, updated_at = now()',
    E'  -- ADR 0126 D9: THE EPOCH BUMP. This is the platform''s one backwards door\n'
    || E'  -- on meetings.status, so it is the one place the revision advances. A\n'
    || E'  -- second writer would break the epoch: the counter means "the minutes\n'
    || E'  -- re-entered an editable state", not "something changed".\n'
    || E'  set status = ''held'', concluded_at = null, concluded_by = null,\n'
    || E'      revision = revision + 1, updated_at = now()');
  if v_new = v_src then
    raise exception 'PATCH ANCHOR MISSED: reopen_meeting status update';
  end if;
  execute v_new;
  raise notice 'reopen_meeting: patched to bump meetings.revision.';
end $patch_reopen$;

-- ---------------------------------------------------------------------------
-- 7. The mint: registration gate + compare-and-mint + stored revision
-- ---------------------------------------------------------------------------
-- ⚠ The SIGNATURE changes (a new trailing defaulted parameter), so this is a
-- DROP + CREATE rather than a CREATE OR REPLACE — a defaulted overload would make
-- every existing call ambiguous. Dropping discards the ACL, so it is re-granted
-- below and then VERIFIED FROM THE CATALOG.
do $patch_mint$
declare v_src text; v_new text; v_step text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mint_printed_document';
  if v_src is null then raise exception 'mint_printed_document not found'; end if;

  v_step := 'add p_source_revision parameter';
  v_new := replace(v_src, 'p_contains_phi boolean DEFAULT false)',
                          'p_contains_phi boolean DEFAULT false, p_source_revision integer DEFAULT 0)');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  v_step := 'declare v_revision';
  v_new := replace(v_src, '  v_series uuid;', '  v_series uuid;' || E'\n  v_revision integer;');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  -- The gate + the compare land immediately after the series resolves, so both
  -- run inside this transaction and before ANY row is written.
  v_step := 'registration gate + compare-and-mint';
  v_new := replace(v_src,
    E'  v_series := app.print_source_series(p_source_kind, p_source_id);',
    E'  v_series := app.print_source_series(p_source_kind, p_source_id);'
    || E'\n'
    || E'\n  -- ADR 0125 D1 / 0126 D5+D10 — REGISTRATION IS DB-ENFORCED. ONE'
    || E'\n  -- kind-agnostic call to the dispatch; NOT a fourth kind-conditional site.'
    || E'\n  -- Evaluated HERE, inside the mint transaction, which is also what closes'
    || E'\n  -- the form_response half of the TOCTOU: if reject_correction fired'
    || E'\n  -- mid-render the predicate now returns false and this raises.'
    || E'\n  if not app.print_source_registers(p_source_kind, p_source_id) then'
    || E'\n    raise exception'
    || E'\n      ''este registro ainda não está em um estado que permita emissão; use a prévia'''
    || E'\n      using errcode = ''HC0DP'';'
    || E'\n  end if;'
    || E'\n'
    || E'\n  -- COMPARE-AND-MINT (0126 Consequences). The render is out-of-band, so the'
    || E'\n  -- caller passes the revision it OBSERVED at render time; a mismatch means'
    || E'\n  -- the source moved underneath and the hash would pin bytes of a state that'
    || E'\n  -- never coherently registered. Load-bearing for MEETINGS (signed -> held ->'
    || E'\n  -- re-signed leaves status identical and revision different); a structural'
    || E'\n  -- no-op for form_response, whose TOCTOU the gate above closes instead.'
    || E'\n  v_revision := app.print_source_revision(p_source_kind, p_source_id);'
    || E'\n  if v_revision is distinct from coalesce(p_source_revision, 0) then'
    || E'\n    raise exception'
    || E'\n      ''o registro foi alterado durante a geração do documento; repita a emissão'''
    || E'\n      using errcode = ''HC0DU'';'
    || E'\n  end if;');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  v_step := 'insert column list';
  v_new := replace(v_src,
    '      id, source_kind, source_id, source_series_id, commission_id, template_key, template_version,',
    '      id, source_kind, source_id, source_series_id, source_revision, commission_id, template_key, template_version,');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  v_step := 'insert values list';
  v_new := replace(v_src,
    '      p_id, p_source_kind, p_source_id, v_series, v_commission, p_template_key,',
    '      p_id, p_source_kind, p_source_id, v_series, v_revision, v_commission, p_template_key,');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;

  drop function if exists public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean);
  execute v_new;
  raise notice 'mint_printed_document: registration gate + compare-and-mint installed (5/5 anchors hit).';
end $patch_mint$;

revoke all on function
  public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean, integer)
  from public;
grant execute on function
  public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Self-verification — from the CATALOG
-- ---------------------------------------------------------------------------
do $verify$
declare
  v_pub boolean; v_auth boolean; v_secdef boolean; v_n int;
begin
  -- Exactly ONE mint overload must remain: a leftover 9-arg version would keep
  -- serving un-gated mints while every test exercised the 10-arg one.
  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mint_printed_document';
  if v_n <> 1 then
    raise exception 'MINT OVERLOAD COUNT = % (expected exactly 1)', v_n;
  end if;

  select has_function_privilege('public', p.oid, 'execute'),
         has_function_privilege('authenticated', p.oid, 'execute'),
         p.prosecdef
    into v_pub, v_auth, v_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mint_printed_document';
  if v_pub then raise exception 'ACL REGRESSION: mint_printed_document is PUBLIC-executable'; end if;
  if not v_auth then raise exception 'GRANT LOST: authenticated cannot execute mint_printed_document'; end if;
  if not v_secdef then raise exception 'mint_printed_document is not SECURITY DEFINER'; end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'mint_printed_document'
       and p.prosrc like '%app.print_source_registers(p_source_kind, p_source_id)%') then
    raise exception 'MINT NOT GATED: print_source_registers is not called';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'reopen_meeting'
       and p.prosrc like '%revision = revision + 1%') then
    raise exception 'reopen_meeting DOES NOT BUMP the revision epoch';
  end if;

  -- ADR 0123 D3's key-share lock must have survived two surgical patches.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'mint_printed_document'
       and p.prosrc ilike '%from public.responses where id = p_source_id for key share%') then
    raise exception 'ADR 0123 D3 REGRESSION: the mint lost its key-share lock';
  end if;

  select has_function_privilege('public', p.oid, 'execute') into v_pub
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'print_source_revision';
  if v_pub then raise exception 'ACL REGRESSION: app.print_source_revision is PUBLIC-executable'; end if;

  raise notice 'B3 verified from the catalog: one gated mint overload, ACL intact, epoch bumped, key-share lock survived.';
end $verify$;

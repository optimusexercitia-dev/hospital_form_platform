-- B4 — CURRENCY is derived at read time, and meetings get the symmetric backstop.
-- ADR 0126 D2/D3/D4/D11/D12.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CURRENCY IS A THIRD AXIS, DISTINCT FROM THE WATERMARK AND FROM THE REGISTRY
-- ═══════════════════════════════════════════════════════════════════════════
--   current ⇔ the source STILL satisfies the registration predicate
--             AND the source is still the HEAD of its series.
--
-- Both conjuncts are load-bearing and each covers what the other misses:
--   • `reject_correction` walks a response back  -> registers ✗, head ✓ -> NOT current
--   • `reopen_meeting` returns an ata to `held`  -> registers ✗, head ✓ -> NOT current
--   • R2 approved, nobody minted revision 2      -> registers ✓, head ✗ -> NOT current
--   • submitted original, no correction          -> registers ✓, head ✓ -> current
-- Head-only would leave a source walked back to editable reading as *current*
-- while its content can change underneath. Registers-only would leave a corrected
-- R1 — which stays `submitted` — reading as current forever.
--
-- ⛔ NOTHING WRITES ON A REVERSAL (D3). `printed_documents.status` keeps exactly
-- its present meaning: DELIBERATE ACTS ONLY (re-mint supersession, revocation).
-- A print may therefore be `status = 'active'` AND NOT current — a new and legal
-- combination both `/verificar` and the in-app panel must express.
--   ⛔ Rejected: a trigger flipping `status` on reversal — it would need THREE
--      writers (`reject_correction`, `reopen_meeting`, `supersede_response`) of a
--      single fact, and the drift would be silent.
--   ⛔ Rejected: both mechanisms — two computations of one property can disagree,
--      and nothing reds when they do.
--
-- ⚠ THE BOUND, stated because the next reader will otherwise over-read it:
-- currency answers *"is this print of the current REVISION of the source
-- record"*, NOT *"would a re-render be byte-identical"*. For meetings the two
-- differ BY CONSTRUCTION — `sign_meeting` changes the rendered footer and linked
-- action items render live — so currency is not, and cannot be, a
-- content-integrity guarantee.

-- ---------------------------------------------------------------------------
-- 1. `app.printed_document_is_current`
-- ---------------------------------------------------------------------------
-- ⭐ THE `revoked` ARM RETURNS NULL WITHOUT JOINING ANYTHING, and that is a
-- CONTRACT, not an optimisation. `312` t76 pins that the verification door never
-- joins `responses`, which is what lets a paper-holder still verify a document
-- whose source was later discarded. D3 measured the join to be SAFE for
-- `active`/`superseded` — `guard_response_active_print` refuses a DELETE for both,
-- and `documents_home_resource_id_fkey` is ON DELETE RESTRICT, so a non-revoked
-- print's source is guaranteed to still exist — but a REVOKED print has no such
-- guarantee, so it must answer with no source lookup at all.
--
-- NULL therefore means *NOT EVALUATED*, which is a different fact from `false`
-- (*evaluated, and stale*). Collapsing them would tell a surveyor holding a
-- revoked page that it is "not current" when the honest answer is ANULADO.
create or replace function app.printed_document_is_current(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.printed_documents;
begin
  select * into v_row from public.printed_documents where id = p_id;
  if v_row.id is null then
    return null;
  end if;

  -- NO-JOIN ARM. Must come first: the source may legitimately be gone.
  if v_row.status = 'revoked' then
    return null;
  end if;

  return app.print_source_registers(v_row.source_kind, v_row.source_id)
     and app.print_source_head(v_row.source_kind, v_row.source_id, v_row.source_revision);
end;
$function$;

revoke all on function app.printed_document_is_current(uuid) from public;

-- ---------------------------------------------------------------------------
-- 2. `guard_meeting_active_print` — the symmetric backstop (D11)
-- ---------------------------------------------------------------------------
-- ⚠ WHY IT IS NEEDED EVEN THOUGH THE DELETE IS REFUSED TODAY. The real anchor is
-- two hops over and in another domain: the mint creates a `documents` row homed
-- on the source's securable resource; `documents_home_resource_id_fkey` sits on
-- `documents -> securable_resources` ON DELETE RESTRICT; deleting a meeting fires
-- `trg_drop_securable_resource`, and THAT trips the RESTRICT. ADR 0125 Amendment 1
-- §B credited "an unnamed FK" as if it guarded the meeting delete directly.
--
-- That anchor's OWNER is the documents domain, and the disposal program
-- (C1a/C1b, `complete_document_disposal`) is precisely the future writer that will
-- delete document rows. The day it does, a reopened `held` meeting with a
-- registered print becomes deletable (`guard_meeting_status` allows `held`; the
-- RLS delete policy admits any staff_admin) and the registry row orphans —
-- breaking the very join D3 authorises.
--
-- A backstop costs nothing at runtime; omitting one is a widening, and a widening
-- cannot be wrong-and-safe.
create or replace function app.guard_meeting_active_print()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if exists (
    select 1
      from public.printed_documents
     where source_kind = 'meeting'
       and source_id   = old.id
       -- `superseded` is a LIVE page (ADR 0120 D6/D8): it serves bytes and
       -- answers /verificar. `revoked` is deliberately absent — the exact
       -- predicate `app.guard_response_active_print` uses, so the two kinds
       -- cannot drift apart.
       and status      in ('active', 'superseded')
  ) then
    raise exception
      'esta reunião possui um documento emitido em circulação; anule o documento antes de excluí-la'
      using errcode = 'HC0DQ';
  end if;
  return old;
end;
$function$;

create trigger guard_meeting_active_print_trg
  before delete on public.meetings
  for each row execute function app.guard_meeting_active_print();

revoke all on function app.guard_meeting_active_print() from public;

-- ---------------------------------------------------------------------------
-- 3. The batch currency door for the in-app panel
-- ---------------------------------------------------------------------------
-- Per-row `can_view_printed_document`, so an id the caller cannot see is simply
-- ABSENT from the result rather than returning null — absent and
-- not-evaluated are different answers and the panel must not conflate them.
create or replace function public.printed_document_currency(p_ids uuid[])
returns table (id uuid, is_current boolean)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.assert_document_printing_enabled();
  return query
    select pd.id, app.printed_document_is_current(pd.id)
    from public.printed_documents pd
    where pd.id = any(coalesce(p_ids, '{}'::uuid[]))
      and app.can_view_printed_document(pd.source_kind, pd.source_id, auth.uid());
end;
$function$;

revoke all on function public.printed_document_currency(uuid[]) from public;
grant execute on function public.printed_document_currency(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. `lookup_printed_document` gains the currency verdict (D12)
-- ---------------------------------------------------------------------------
-- ⚠ PO-BLESSED WIDENING. Computing currency forces this anon-reachable DEFINER
-- door to read `responses`, `case_phases`, `case_correction_requests` and
-- `meetings`, and the verdict itself tells a paper-holder that a newer state
-- exists. D12 rules: currency is the page's PRODUCT PURPOSE, the page already
-- discloses `Substituído`/`Anulado`, and the verdict names no content, actor or
-- reason. The rejected alternative — currency for authenticated members only —
-- would blind exactly the paper-holding surveyor the verdict exists for.
--
-- ⚠ The return TYPE changes, so this is DROP + CREATE. The ACL is re-granted
-- below and verified from the catalog. Measured: this door is granted to
-- `postgres` + `service_role` ONLY — NOT `anon`, NOT `authenticated`. It is
-- anon-reachable through the /verificar route's admin client, which is a
-- PRODUCT-level fact, not a PostgREST one. No ACL widening is needed or made.
do $patch_lookup$
declare v_src text; v_new text; v_step text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lookup_printed_document';
  if v_src is null then raise exception 'lookup_printed_document not found'; end if;

  v_step := 'RETURNS TABLE gains is_current';
  v_new := replace(v_src, 'document_id uuid)', 'document_id uuid, is_current boolean)');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  -- BOTH early returns (empty credential, no match) must widen in step.
  v_step := 'early returns gain a 7th column';
  v_new := replace(v_src,
    'return query select false, null::text, null::timestamptz, null::text, null::text, null::uuid;',
    'return query select false, null::text, null::timestamptz, null::text, null::text, null::uuid, null::boolean;');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;
  v_src := v_new;

  v_step := 'the verdict itself';
  v_new := replace(v_src,
    E'      else null\n    end;\nend;',
    E'      else null\n    end,'
    || E'\n    -- ADR 0126 D4: authenticity and currency are stated as TWO SEPARATE'
    || E'\n    -- FACTS. ⛔ The `revoked` arm is short-circuited HERE as well as inside'
    || E'\n    -- the helper, so the NO-JOIN independence `312` t76 pins is visible at'
    || E'\n    -- the door rather than only true one call away.'
    || E'\n    case when v_row.status = ''revoked'' then null'
    || E'\n         else app.printed_document_is_current(v_row.id) end;'
    || E'\nend;');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: %', v_step; end if;

  drop function if exists public.lookup_printed_document(text, uuid);
  execute v_new;
  raise notice 'lookup_printed_document: currency verdict installed (3/3 anchors hit).';
end $patch_lookup$;

revoke all on function public.lookup_printed_document(text, uuid) from public;
grant execute on function public.lookup_printed_document(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Self-verification — from the CATALOG
-- ---------------------------------------------------------------------------
do $verify$
declare v_ret text; v_anon boolean; v_auth boolean; v_svc boolean; v_n int;
begin
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'lookup_printed_document';
  if v_n <> 1 then raise exception 'LOOKUP OVERLOAD COUNT = % (expected 1)', v_n; end if;

  select pg_get_function_result(p.oid),
         has_function_privilege('anon', p.oid, 'execute'),
         has_function_privilege('authenticated', p.oid, 'execute'),
         has_function_privilege('service_role', p.oid, 'execute')
    into v_ret, v_anon, v_auth, v_svc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lookup_printed_document';

  if v_ret not like '%is_current boolean%' then
    raise exception 'LOOKUP RETURN NOT WIDENED: %', v_ret;
  end if;
  -- ⛔ The door must NOT become directly reachable by anon/authenticated. It is
  -- reached anonymously only through the /verificar route's admin client.
  if v_anon then raise exception 'ACL WIDENED: anon can execute lookup_printed_document'; end if;
  if v_auth then raise exception 'ACL WIDENED: authenticated can execute lookup_printed_document'; end if;
  if not v_svc then raise exception 'GRANT LOST: service_role cannot execute lookup_printed_document'; end if;

  if not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                  where c.relname = 'meetings' and t.tgname = 'guard_meeting_active_print_trg'
                    and not t.tgisinternal) then
    raise exception 'guard_meeting_active_print_trg is NOT installed on meetings';
  end if;

  if has_function_privilege('public', 'app.printed_document_is_current(uuid)', 'execute') then
    raise exception 'ACL REGRESSION: app.printed_document_is_current is PUBLIC-executable';
  end if;
  if has_function_privilege('public', 'public.printed_document_currency(uuid[])', 'execute') then
    raise exception 'ACL REGRESSION: public.printed_document_currency is PUBLIC-executable';
  end if;

  raise notice 'B4 verified from the catalog: lookup widened + ACL unchanged, guard installed, currency doors tight.';
end $verify$;

-- QO·B M6 — the controlled-document DOORS + the attachment write arm.
--             The SAME class of miss as M5, found by the SAME plain check.
--
-- ADR 0100 D12; inventory §4.2 / §4.3, PO-ratified 2026-08-08.
--
-- ⛔ M2 cut the document POLICIES and the two read WRAPPERS, and every gate went green —
-- but the ten §4.2-ratified document DOORS were never touched, and a DEFINER door
-- bypasses RLS entirely. Same shape as M5's hole on the response plane, one plane over.
-- It was found by re-running the check that found M5: read the ratified CUT list, ask
-- the catalog "did I actually cut each of these?".
--
-- ⚠ AND THE CHECK ITSELF WAS WRONG THE FIRST TIME, which is the more valuable lesson:
-- `\yis_commission_admin_of\y` CANNOT MATCH `is_commission_admin_of_for` — the word
-- boundary fails before `_`, so the longer identifier is invisible to it. The first pass
-- of this audit reported 10 findings; the corrected pattern reported 12. Any sweep in
-- this repo that greps for the short name is silently blind to every `_for` call site.
-- (M4's population was re-checked with the corrected pattern and had NO misses.)
--
-- CUT (12): the ten document doors below, plus app.can_write_attachment's `case` arm.
--
-- KEPT, and NOT an oversight — `public.revoke_printed_document`. It still routes
-- is_commission_admin_of_for BY AN EXPLICIT PRIOR RULING: ADR 0104 D11 (QA MINOR-2,
-- lead-ruled) holds that revocation is a GOVERNANCE act on commission_id — the admin
-- chain may revoke an ata print it cannot download, because revoking reveals no content.
-- The inventory's §4.3 draft listed it as CUT; that draft is overruled by the older,
-- more specific ruling. Postcondition (c) pins it so a future sweep cannot quietly
-- reverse a decision it never read.

begin;

do $$
declare
  r       record;
  v_src   text;
  v_new   text;
  v_cut   int := 0;
  v_docs  text[] := array[
    'create_controlled_document','update_controlled_document','publish_document',
    'mark_document_obsolete','supersede_document','submit_document_for_approval',
    'set_document_version_file','list_commission_documents','documents_due_for_review',
    'remind_document_approver'];
begin
  for r in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f' and p.proname = any(v_docs)
    order by p.proname
  loop
    v_src := pg_get_functiondef(r.oid);
    v_new := regexp_replace(v_src,
      '\s+or\s+app\.is_commission_admin_of\((?:[^()]|\([^()]*\))*\)', '', 'g');
    v_new := regexp_replace(v_new,
      'app\.is_commission_admin_of\((?:[^()]|\([^()]*\))*\)\s+or\s+', '', 'g');
    if v_new = v_src then
      raise exception 'QO·B M6: removal matched NOTHING in %() — refusing to no-op silently.', r.proname;
    end if;
    -- Pattern catches BOTH variants deliberately (see header).
    if regexp_replace(v_new,'/\*.*?\*/',' ','gs') ~ 'is_commission_admin_of' then
      raise exception 'QO·B M6: %() still routes the tenancy admin — partial cut.', r.proname;
    end if;
    execute v_new;
    v_cut := v_cut + 1;
  end loop;
  if v_cut <> 10 then
    raise exception 'QO·B M6: expected to cut 10 document doors, cut %', v_cut;
  end if;

  -- app.can_write_attachment — the `case` arm only. Its `meeting` arm already carries no
  -- tenancy term (C7/A8 removed it), so this is a one-arm edit, not a rebuild.
  v_src := pg_get_functiondef('app.can_write_attachment(text,uuid,uuid)'::regprocedure);
  v_new := replace(v_src,
    'return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);',
    'return app.is_staff_admin_of_for(v_commission, p_uid);');
  if v_new = v_src then
    raise exception 'QO·B M6: can_write_attachment''s case arm did not match — re-read it from pg_get_functiondef.';
  end if;
  execute v_new;

  raise notice 'QO·B M6: tenancy arm removed from % document doors + can_write_attachment', v_cut;
end $$;

-- ---------------------------------------------------------------------------
-- Postconditions. ⚠ Every pattern here matches BOTH `is_commission_admin_of` and
-- `..._for` — a check that greps only the short name is blind to the longer one.
-- ---------------------------------------------------------------------------
do $$
declare v_bad text; v_n int;
begin
  -- (a) No ratified-CUT document/attachment door may still admit the tenancy admin.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','app')
    and p.proname = any(array['create_controlled_document','update_controlled_document','publish_document',
                              'mark_document_obsolete','supersede_document','submit_document_for_approval',
                              'set_document_version_file','list_commission_documents','documents_due_for_review',
                              'remind_document_approver','can_write_attachment'])
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ 'is_commission_admin_of';
  if v_bad is not null then
    raise exception 'QO·B M6 postcondition (a): still admits the tenancy admin: %', v_bad;
  end if;

  -- (b) NON-VACUITY: all eleven must exist.
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','app')
     and p.proname = any(array['create_controlled_document','update_controlled_document','publish_document',
                               'mark_document_obsolete','supersede_document','submit_document_for_approval',
                               'set_document_version_file','list_commission_documents','documents_due_for_review',
                               'remind_document_approver','can_write_attachment']);
  if v_n < 11 then
    raise exception 'QO·B M6 postcondition (b) VACUOUS: expected 11 targets, found %', v_n;
  end if;

  -- (c) RULING GUARD: revoke_printed_document must STILL admit the tenancy admin
  --     (ADR 0104 D11 — revocation is governance and reveals no content). A future
  --     "finish the printed-document wall" sweep reds HERE instead of silently
  --     reversing a ruling it never read.
  if not exists (
    select 1 from pg_proc
    where pronamespace='public'::regnamespace and proname='revoke_printed_document'
      and regexp_replace(regexp_replace(prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_commission_admin_of') then
    raise exception
      'QO·B M6 postcondition (c): revoke_printed_document LOST its tenancy arm. ADR 0104 '
      'D11 keeps it deliberately — revocation is a governance act that reveals no content.';
  end if;

  -- (d) The committee's own arm survives everywhere it was: the cut removed the tenancy
  --     disjunct ONLY. A rebuild that dropped is_staff_admin_of would pass (a) happily.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.proname = any(array['create_controlled_document','update_controlled_document','publish_document',
                              'mark_document_obsolete','supersede_document','submit_document_for_approval',
                              'set_document_version_file','remind_document_approver'])
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        !~ 'is_staff_admin_of';
  if v_bad is not null then
    raise exception 'QO·B M6 postcondition (d): the committee''s own arm was lost on: %', v_bad;
  end if;
end $$;

commit;

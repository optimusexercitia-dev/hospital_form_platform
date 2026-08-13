-- =============================================================================
-- BUG-REFNOTE-001 — every referral-module door's RETURN SHAPE mirrors its
-- table's granted column list. Migration 20260922000100.
--
-- The bug was filed as four `referral_internal_notes` mutators handing back the
-- unmasked `body_md`. The shape — a DEFINER door whose `RETURNS <table>`
-- re-opens exactly what a column-list SELECT GRANT closed — held across 23 doors
-- on three tables; the 15 `case_referral` doors (serving `description_md`, the
-- referral narrative) were the larger half and were NOT in the filed report.
--
-- ⭐ KEYSTONES (red-first, authz-handoff §7.1). Every starred test was observed
-- RED, by MUTATION rather than by assertion, in two rounds against a committed
-- un-fix (undone by `supabase db reset --local`). Stated precisely, because a
-- blanket "observed red" in a test header is the class of claim that goes stale
-- silently:
--   round 1 — drift `referral_internal_note_public` + revert
--     `conclude_referral_internal_note` to the bare row type
--       → t2, t4, t5, t6 red
--   round 2 — drift `case_referral_public` and `referral_message_public` +
--     revert `create_referral_internal_note` and `set_referral_deadline`
--       → t1, t3, t7, t8 red (t2/t4/t5/t6 still red)
-- t6 was additionally reproduced as the FILED repro: the reverted door served
-- 17 fields carrying `body_md = 'SEGREDO-CLINICO-XYZ'` to a plain member, in the
-- same txn, role and hat — Control G of BUG-REFNOTE-001, closed here.
--
-- ⚠ NOT proven red, and deliberately recorded as such: t9 (a positive twin —
-- it reds only if a door stops working) and t10 / t12 / t13, whose queries are
-- the same shape as t11. t11 itself WAS observed red, unintentionally: round
-- 1's rebuild omitted `revoke … from public`, so `anon` inherited EXECUTE from
-- the default ACL and t11 caught it. That is the exact "guards that read right
-- but fail open" failure these four exist for, so the shape is proven live.
--
-- t1–t3 are THE DRIFT PIN, and the reason this suite exists at all rather than
-- just an assertion that the doors changed: they tie each composite to its
-- table's GRANT, so a future column added to the composite WITHOUT its own
-- column GRANT (or granted without joining the composite) reds here. Without
-- them the whole class silently reopens one ALTER TABLE at a time.
--
-- t10–t13 are green-first PROPERTY-PRESERVATION CONTROLS, not keystones: the fix
-- is a DROP+CREATE (a return type cannot change under CREATE OR REPLACE), the
-- shape that silently loses ACLs / SECURITY DEFINER / search_path ("guards that
-- read right but fail open"). Each pins its population to exactly 23 so a
-- dropped-and-not-recreated door cannot pass vacuously.
-- =============================================================================

begin;
select plan(13);

-- The 23 doors, named once. A door missing from this list is a door this suite
-- does not defend, so t4 pins the count against the live catalog rather than
-- trusting the literal.
create temp table doors on commit drop as
select unnest(array[
  -- case_referral (15)
  'accept_referral','conclude_referral','create_referral_draft','decline_referral',
  'link_referral_case','provide_referral_information','receive_referral','reopen_referral',
  'request_referral_information','resolve_referral','send_referral','set_referral_deadline',
  'start_referral_review','update_referral_draft','withdraw_referral',
  -- referral_internal_notes (6)
  'assign_referral_internal_note','conclude_referral_internal_note',
  'create_referral_internal_note','redact_referral_note',
  'unassign_referral_internal_note','update_referral_internal_note',
  -- referral_messages (2)
  'post_referral_message','redact_referral_message'
]) as proname;

-- ── 1. THE DRIFT PIN: composite field list ≡ authenticated SELECT GRANT ──────
-- Compared as ordered name arrays, so an extra field, a missing field, and a
-- reordering are all distinguishable failures.
create temp table shape on commit drop as
select t.tbl, t.comp,
       (select array_agg(a.attname order by a.attnum)
          from pg_attribute a
         where a.attrelid = ('public.' || t.comp)::regclass
           and a.attnum > 0 and not a.attisdropped) as comp_fields,
       (select array_agg(c.column_name::name order by c.ordinal_position)
          from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = t.tbl
           and exists (select 1 from information_schema.column_privileges p
                        where p.table_schema = 'public' and p.table_name = t.tbl
                          and p.column_name = c.column_name
                          and p.grantee = 'authenticated'
                          and p.privilege_type = 'SELECT')) as granted_cols
from (values
  ('case_referral',           'case_referral_public'),
  ('referral_internal_notes', 'referral_internal_note_public'),
  ('referral_messages',       'referral_message_public')
) as t(tbl, comp);

select is((select comp_fields from shape where tbl = 'case_referral'),
          (select granted_cols from shape where tbl = 'case_referral'),
  't1 ⭐ DRIFT PIN: case_referral_public ≡ the authenticated SELECT GRANT (description_md / decline_note / phi_disposed_* stay out, and a new column joins ONLY with its own GRANT)');
select is((select comp_fields from shape where tbl = 'referral_internal_notes'),
          (select granted_cols from shape where tbl = 'referral_internal_notes'),
  't2 ⭐ DRIFT PIN: referral_internal_note_public ≡ the authenticated SELECT GRANT (body_md stays out)');
select is((select comp_fields from shape where tbl = 'referral_messages'),
          (select granted_cols from shape where tbl = 'referral_messages'),
  't3 ⭐ DRIFT PIN: referral_message_public ≡ the authenticated SELECT GRANT (body stays out)');

-- ── 2. Population closure ────────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_type ty on ty.oid = p.prorettype
     join pg_class c on c.oid = ty.typrelid
    where n.nspname = 'public'
      and c.relname in ('case_referral','referral_internal_notes','referral_messages')),
  0, 't4 ⭐ NO public function returns a bare referral row type — the class is closed, not just its four filed instances');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (select proname from doors)
      and pg_get_function_result(p.oid) in
          ('case_referral_public','referral_internal_note_public','referral_message_public')),
  23, 't5 ⭐ all 23 doors return a narrowed composite (pinned to 23: a door dropped and not recreated cannot pass this vacuously)');

-- ── 3. Behavioural — the filed Control G, on the real door as a real persona ──
create temp table fx on commit drop as
select r.id as ref_id, r.source_commission_id as comm_id,
       (select id from auth.users where email = 'chefe.ccih@test.local') as uid
from public.case_referral r where r.code = 'ENC-0002';
grant select on fx to authenticated;

create temp table note_out (created jsonb, concluded jsonb) on commit drop;
create temp table ref_out  (j jsonb) on commit drop;
grant insert, select on note_out, ref_out to authenticated;

select test_helpers.claims_for((select uid from fx), false);
set local role authenticated;

with created as (
  select to_jsonb(public.create_referral_internal_note(
           (select ref_id from fx), (select comm_id from fx),
           'SEGREDO-CLINICO-XYZ', 'keystone', 'update', null)) as j
)
insert into note_out (created, concluded)
select created.j,
       to_jsonb(public.conclude_referral_internal_note((created.j ->> 'id')::uuid))
from created;

insert into ref_out
select to_jsonb(public.set_referral_deadline((select ref_id from fx), now() + interval '30 days'));

reset role;

select is((select concluded ? 'body_md' from note_out), false,
  't6 ⭐ CONTROL G, CLOSED: conclude_referral_internal_note''s return carries NO body_md — the filed repro read SEGREDO-CLINICO-XYZ here, same txn, same role, same hat');
select is((select created ? 'body_md' from note_out), false,
  't7 ⭐ create_referral_internal_note no longer echoes body_md either (the caller supplied it, so this was never a widening — but the echo is the same re-opened surface)');
select is((select j ?| array['description_md','decline_note'] from ref_out), false,
  't8 ⭐ THE UNFILED HALF: a case_referral door (set_referral_deadline) carries neither description_md nor decline_note — the referral narrative is served only by get_referral_detail, which gates AND calls log_audit_access');

select is(
  (select (concluded ->> 'status') || '|' || ((concluded ->> 'concluded_at') is not null)::text
     from note_out),
  'concluded|true',
  't9 POSITIVE TWIN: the narrowed return still carries the product surface, and the door still did its job — a return that dropped everything would pass t6–t8 while breaking the feature');

-- ── 4. Property-preservation controls (green-first; population pinned to 23) ──
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select proname from doors)
      and has_function_privilege('authenticated', p.oid, 'execute')),
  23, 't10 CONTROL: authenticated keeps EXECUTE on all 23 doors (the DROP+CREATE must re-grant)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select proname from doors)
      and has_function_privilege('anon', p.oid, 'execute')),
  0, 't11 CONTROL: anon holds NO EXECUTE on any door (a rebuild must not fall back to the PUBLIC default ACL)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select proname from doors) and p.prosecdef),
  23, 't12 CONTROL: all 23 doors remain SECURITY DEFINER');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select proname from doors)
      and array_to_string(p.proconfig, ';') like '%search_path=app, public, pg_catalog%'),
  23, 't13 CONTROL: all 23 doors keep the pinned search_path=app, public, pg_catalog');

select * from finish();
rollback;

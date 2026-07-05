-- WS-3a · C-5 — answers referential integrity to its form.
-- Migration: 20260711000200_answers_form_fk.sql.
--
-- The lock: this suite fails if the composite FK (or the FK-referenceable unique it
-- needs) is dropped, if the version-derive trigger stops filling form_version_id, or if
-- a poisoned/orphaned question_key becomes insertable again. The evaluator must stay
-- byte-for-byte unchanged (Rule 3) — proven by 60_answer_map_golden.sql in the ordered
-- run (not re-asserted here).
--
-- Covers:
--   §1 the FK + FK-referenceable unique + version-derive trigger exist.
--   §2 a POISONED question_key (right item, wrong key for the version) raises 23503.
--   §3 a CROSS-VERSION item_id (item from another version) raises 23503.
--   §4 the version-derive trigger fills form_version_id from the response even when the
--      insert omits it (Option 1 ergonomics); a client-supplied WRONG value is ignored
--      (overwritten to the response's version), so it cannot poison the FK.
--   §5 a valid save_section_answers round-trip is unaffected — the answer lands with the
--      correct form_version_id.

begin;
select plan(12);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'st_x')::uuid    as st_x,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'ver_u')::uuid   as ver_u,     -- unsectioned published version (form U)
         (v->>'item_mc')::uuid as item_mc,   -- input item in ver_u, question_key 'u_q1'
         (v->>'ver_s')::uuid   as ver_s,     -- a DIFFERENT published version (form S)
         (v->>'it_gate')::uuid as it_gate    -- input item in ver_s, question_key 's_gate'
  from ctx;
grant select on k to authenticated;

-- A fresh in_progress response against ver_u for st_x (the FK/trigger subject).
create temp table resp on commit drop as select gen_random_uuid() as id;
grant select on resp to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ((select id from resp), (select ver_u from k), (select comm_x from k),
          (select st_x from k), 'in_progress');

-- ============================================================================
-- §1: the constraints + trigger exist
-- ============================================================================
select ok(
  exists (select 1 from pg_constraint
          where conname = 'answers_item_version_key_fkey'
            and conrelid = 'public.answers'::regclass and contype = 'f'),
  '1.1: composite FK answers_item_version_key_fkey exists');
select ok(
  exists (select 1 from pg_constraint
          where conname = 'form_items_id_version_key_uq'
            and conrelid = 'public.form_items'::regclass and contype = 'u'),
  '1.2: FK-referenceable UNIQUE constraint form_items_id_version_key_uq exists (not a bare index)');
select ok(
  exists (select 1 from pg_trigger
          where tgname = 'derive_answer_version_trg'
            and tgrelid = 'public.answers'::regclass and not tgisinternal),
  '1.3: BEFORE INSERT derive_answer_version_trg exists');
select col_not_null('public', 'answers', 'form_version_id',
  '1.4: answers.form_version_id is NOT NULL');
-- The existing partial per-version-key index (Rule 2) is left in place.
select ok(
  exists (select 1 from pg_indexes
          where schemaname = 'public' and indexname = 'form_items_question_key_per_version_idx'),
  '1.5: the Rule-2 partial per-version question_key index is still present');

-- ============================================================================
-- §2: a POISONED question_key (right item_id + version, WRONG key) is rejected.
-- item_mc's real key is 'u_q1'; store the item with a fabricated key. The FK finds no
-- form_items row matching (item_mc, ver_u, 'wrong_key') -> 23503.
-- ============================================================================
select throws_ok(
  format($$ insert into public.answers (response_id, item_id, question_key, value, form_version_id)
            values (%L::uuid, %L::uuid, 'wrong_key', '"x"'::jsonb, %L::uuid) $$,
         (select id from resp), (select item_mc from k), (select ver_u from k)),
  '23503', null,
  '2.1: a poisoned question_key (right item, wrong key) raises 23503 (FK)');

-- ============================================================================
-- §3: a CROSS-VERSION item_id (an item from ver_s inserted under a ver_u response) is
-- rejected. it_gate belongs to ver_s; the response is ver_u. Even with it_gate's REAL
-- key, no form_items row matches (it_gate, ver_u, 's_gate') -> 23503. (The trigger fills
-- form_version_id = ver_u from the response, so a cross-version item cannot slip in.)
-- ============================================================================
select throws_ok(
  format($$ insert into public.answers (response_id, item_id, question_key, value)
            values (%L::uuid, %L::uuid, 's_gate', '"x"'::jsonb) $$,
         (select id from resp), (select it_gate from k)),
  '23503', null,
  '3.1: a cross-version item_id (ver_s item under a ver_u response) raises 23503');

-- ============================================================================
-- §4: the trigger fills form_version_id from the response when omitted, and OVERWRITES
-- a client-supplied wrong value (so the FK cannot be poisoned via the version column).
-- ============================================================================
-- (4a) omit form_version_id entirely -> trigger fills it from the response (ver_u).
insert into public.answers (response_id, item_id, question_key, value)
  values ((select id from resp), (select item_mc from k), 'u_q1', '"sim"'::jsonb);
select is(
  (select form_version_id from public.answers
   where response_id = (select id from resp) and item_id = (select item_mc from k)),
  (select ver_u from k),
  '4.1: derive trigger fills form_version_id from the response when the insert omits it');

-- (4b) supply a WRONG form_version_id (ver_s) -> trigger overwrites it to ver_u, so the
-- row still satisfies the FK and lands correctly (the version column cannot be poisoned).
-- Clear the row first (same conflict key) to re-insert.
delete from public.answers
  where response_id = (select id from resp) and item_id = (select item_mc from k);
insert into public.answers (response_id, item_id, question_key, value, form_version_id)
  values ((select id from resp), (select item_mc from k), 'u_q1', '"nao"'::jsonb, (select ver_s from k));
select is(
  (select form_version_id from public.answers
   where response_id = (select id from resp) and item_id = (select item_mc from k)),
  (select ver_u from k),
  '4.2: a client-supplied WRONG form_version_id is overwritten to the response''s version (ver_u)');

-- ============================================================================
-- §5: a valid save_section_answers round-trip is unaffected — the answer lands with
-- the correct form_version_id, through the RPC as the response owner. Reuse `resp`
-- (st_x already owns the single ver_u draft — one-draft-per-user-per-version unique).
-- The RPC upserts item_mc; the FK + correct form_version_id must still hold.
-- ============================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.save_section_answers(
              %L::uuid,
              (select id from public.form_sections where form_version_id = %L::uuid and is_default),
              jsonb_build_object(%L::text, '"sim"'::jsonb)) $$,
         (select id from resp), (select ver_u from k), (select item_mc from k)::text),
  '5.1: a valid save_section_answers round-trip succeeds (RPC path unaffected)');
reset role;

select is(
  (select form_version_id from public.answers
   where response_id = (select id from resp) and item_id = (select item_mc from k)),
  (select ver_u from k),
  '5.2: the RPC-saved answer carries the correct form_version_id (matches the response version)');
select is(
  (select question_key from public.answers
   where response_id = (select id from resp) and item_id = (select item_mc from k)),
  'u_q1',
  '5.3: the RPC-saved answer carries the server-derived question_key (u_q1)');

select * from finish();
rollback;

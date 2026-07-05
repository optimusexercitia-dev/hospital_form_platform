-- =============================================================================
-- WS-3a · C-5 — answers referential integrity to its form
-- =============================================================================
-- Pre-pilot DB hardening, item #3 (isolated — it reshapes the hottest table).
-- Detail: docs/plans/pre-pilot-db-hardening-program.md §1 WS-3 (C-5 row);
--         docs/reviews/external-db-audit-2026-07-evaluation.md §2 (C-5);
--         docs/reviews/external-db-audit-2026-07-perf-datamodel-analysis.md §2 (C-5).
--
-- The gap: answers.question_key is denormalized text; answers_item_id_fkey is a bare
-- single-column FK; nothing tied the answer to a REAL item IN THAT VERSION. The
-- analytics backbone aggregates on question_key across versions (Rule 1: RLS/DB is the
-- boundary), so a raw POST /answers or a future forgetful RPC could poison a
-- question_key dashboards trust, or orphan an answer to a foreign version.
-- save_section_answers defends only procedurally.
--
-- The fix (ONE composite FK enforces BOTH invariants):
--   answers(item_id, form_version_id, question_key)
--     -> form_items(id, form_version_id, question_key)
-- Because form_items.id is the PK (globally unique), this guarantees every answer
-- row's item_id resolves to a real item AND its stored form_version_id + question_key
-- BOTH match that item's actual version and key. A poisoned question_key (item X but
-- key <> X's key) is impossible; a cross-version item_id is impossible.
--
-- The trigger auto-fills form_version_id from the response (ergonomics + zero fixture
-- churn). The FK is the hard guarantee — a raw insert with a wrong form_version_id is
-- rejected regardless, because no form_items row matches (item_id, wrong_version, key).
--
-- Rule 3: the evaluator (answer_map / answer_map_by_item / case_phase_answer_map) reads
-- specific columns (a.question_key, a.value, ...), never SELECT *, so adding a column
-- does not change what it reads. 60_answer_map_golden.sql proves this byte-for-byte.
--
-- Reset-OK (pre-launch): no back-compat data migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · The FK-referenceable unique on form_items.
-- -----------------------------------------------------------------------------
-- Postgres FKs require the referenced columns to be backed by a unique CONSTRAINT (or
-- PK), NOT merely a unique index. Trivially satisfiable (id is already the PK), and it
-- coexists with the existing partial per-version-key index
-- (form_items_question_key_per_version_idx, the Rule-2 guarantee) which stays in place.
alter table public.form_items
  add constraint form_items_id_version_key_uq
  unique (id, form_version_id, question_key);

comment on constraint form_items_id_version_key_uq on public.form_items is
  'WS-3a C-5: FK-referenceable superset unique so answers can tie '
  '(item_id, form_version_id, question_key) to a real item in that version. Trivially '
  'satisfied (id is PK); does NOT replace form_items_question_key_per_version_idx '
  '(the Rule-2 per-version key uniqueness).';

-- -----------------------------------------------------------------------------
-- 2 · answers.form_version_id + the composite FK.
-- -----------------------------------------------------------------------------
-- Add nullable first, backfill (empty pre-launch, but keep the migration valid if a
-- reset ever runs against seeded data), then set NOT NULL. The BEFORE INSERT trigger
-- (section 3) fills it going forward, so it is never client-supplied.
alter table public.answers
  add column form_version_id uuid;

-- Backfill from each answer's response version. On a fresh reset this is a no-op
-- (migrations run before seed, so answers is empty). It only does work when the
-- migration runs against already-seeded data (e.g. db reset --linked), where SUBMITTED
-- responses' answers are immutability-guarded (guard_submitted_children) — set the
-- guard's bypass GUC so this maintenance UPDATE is permitted. `set local` scopes it to
-- this migration transaction. Not a client bypass (authenticated cannot set it in a way
-- that reaches this DDL path).
set local app.in_submit_rpc = 'on';
update public.answers a
set form_version_id = r.form_version_id
from public.responses r
where r.id = a.response_id and a.form_version_id is null;
set local app.in_submit_rpc = 'off';

alter table public.answers
  alter column form_version_id set not null;

-- The composite FK — the hard guarantee. ON DELETE/UPDATE NO ACTION (default): a
-- published version's items are immutable (Rule 5) and answers cascade-delete with
-- their response, so the referenced item row is never removed out from under an answer.
alter table public.answers
  add constraint answers_item_version_key_fkey
  foreign key (item_id, form_version_id, question_key)
  references public.form_items (id, form_version_id, question_key);

comment on constraint answers_item_version_key_fkey on public.answers is
  'WS-3a C-5: ties every answer to a REAL item in its response''s version — forces both '
  '"item_id belongs to this version" AND "question_key is that item''s real key". '
  'Closes the poisoned/orphaned question_key vector on the analytics path (Rule 1).';

-- Index the new FK columns for the cascade/lookup direction (the FK check + any
-- version-scoped answer scan). The existing answers_item_idx / answers_question_key_idx
-- stay; this composite covers the FK triple.
create index if not exists answers_item_version_key_idx
  on public.answers using btree (item_id, form_version_id, question_key);

-- -----------------------------------------------------------------------------
-- 3 · BEFORE INSERT trigger: derive form_version_id from the response.
-- -----------------------------------------------------------------------------
-- BEFORE INSERT ONLY — form_version_id is immutable per answer. The on-conflict UPDATE
-- path in save_section_answers must keep the originally-derived value, and BEFORE
-- INSERT does not fire on the UPDATE branch, so that is automatic. Single-purpose.
create or replace function app.derive_answer_version() returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  -- Always derive from the response (ignore any client-supplied value) so the column
  -- can never disagree with the response's version. The FK then also guarantees the
  -- item belongs to THIS response's version.
  select form_version_id into new.form_version_id
  from public.responses
  where id = new.response_id;
  return new;
end;
$$;
alter function app.derive_answer_version() owner to postgres;
comment on function app.derive_answer_version() is
  'WS-3a C-5: BEFORE INSERT on answers — auto-fill form_version_id from the response '
  '(ignoring any client value) so it always matches the response''s version. Ergonomics '
  '+ zero fixture churn; the composite FK is the hard integrity guarantee.';

drop trigger if exists derive_answer_version_trg on public.answers;
create trigger derive_answer_version_trg
  before insert on public.answers
  for each row execute function app.derive_answer_version();

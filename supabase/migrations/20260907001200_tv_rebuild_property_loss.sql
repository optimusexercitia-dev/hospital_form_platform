-- TV — three defects with ONE cause: a rebuild silently lost a property the
-- original carried.
--
-- This phase has now hit that shape four times, by four different mechanisms:
--
--   DROP + CREATE FUNCTION      -> loses the ACL          (ten doors went anon-executable, A1.7)
--   ALTER ... RENAME COLUMN     -> re-points the policy   (A1.2, avoided by never renaming)
--   drop + add CONSTRAINT       -> loses DEFERRABLE       (this migration, defects 1-2)
--   a column name held as DATA  -> loses nothing loudly   (this migration, defect 3)
--
-- In each case the migration reads correct, applies cleanly, and drops something
-- that is invisible in the new statement. The rule that generalises:
--
--   ⚠ WHEN YOU REBUILD AN OBJECT, DIFF THE OLD DEFINITION AGAINST THE NEW ONE
--     PROPERTY BY PROPERTY. Reviewing what the new statement SAYS cannot find a
--     property it does not mention.
--
-- Defect 1 and 2 are encoded so that rule is executed rather than described: the
-- rebuild below is DERIVED FROM the old definition text instead of retyped, and
-- then asserts that the only difference is the keyword being restored.

-- ===========================================================================
-- DEFECTS 1 & 2 — positional UNIQUE constraints lost DEFERRABLE.
--
-- REGRESSION, introduced by this phase. `20260907000400` re-keyed both template-side
-- positional uniques from the template grain to the version grain with drop + add,
-- and the add omitted the DEFERRABLE the originals carried. Measured before any TV
-- migration existed:
--     process_template_phases_position_key      UNIQUE (template_id, "position")       DEFERRABLE
--     process_template_narratives_position_key  UNIQUE (template_id, display_position) DEFERRABLE
--
-- Consequence: `public.reorder_template_phase` is broken for EVERY reorder. It swaps
-- two rows' positions in a single UPDATE; a non-deferrable unique index is checked
-- per ROW, so the first row collides with the neighbour that has not moved yet
-- (23505). DEFERRABLE INITIALLY IMMEDIATE moves the check to end-of-STATEMENT, which
-- is exactly the semantics a set-based swap needs. It is behaviour-preserving for
-- every non-swap write, and constraints stay enforced within the statement — this is
-- not `SET CONSTRAINTS DEFERRED`.
--
-- `process_template_narratives_position_key` is latent rather than broken today:
-- `reorder_case_layout_template` writes through UPDATE ... FROM and the planner
-- happens to buffer it. That is a plan detail, not a guarantee, so it is one planner
-- change away from the same failure. Fixed for the same reason, not as a cosmetic.
--
-- `case_phases_position_key` is INCLUDED but is NOT a regression, and is recorded
-- separately because calling it one would be false: it has never been deferrable and
-- no door swaps case-phase positions today. It is additive hardening, on three
-- grounds. (a) Its own table already carries `case_phases_display_position_key` as
-- DEFERRABLE, so `case_phases` is internally inconsistent about two adjacent
-- positional keys — an asymmetry that reads as deliberate and is not. (b) 18 of the
-- schema's 21 positional uniques are DEFERRABLE; this is the house standard and the
-- outliers are the accidents. (c) With INITIALLY IMMEDIATE the change is inert until
-- someone writes a set-based swap, at which point it is the difference between
-- working and 23505 — the precise trap that just cost this phase a red suite.
-- ===========================================================================

do $$
declare
  r record;
  v_old text;
  v_new text;
begin
  for r in
    select *
    from (values
      ('public.process_template_phases'::regclass,     'process_template_phases_position_key'),
      ('public.process_template_narratives'::regclass, 'process_template_narratives_position_key'),
      ('public.case_phases'::regclass,                 'case_phases_position_key')
    ) as t(tbl, cname)
  loop
    select pg_get_constraintdef(oid) into v_old
    from pg_constraint where conrelid = r.tbl and conname = r.cname;

    -- Fail loud rather than silently no-op: a renamed constraint must not be
    -- skipped quietly (the 20260905 backfill lesson).
    if v_old is null then
      raise exception 'constraint %.% not found — cannot restore DEFERRABLE', r.tbl, r.cname;
    end if;

    continue when v_old like '%DEFERRABLE%';   -- idempotent re-run

    -- The rebuild is DERIVED from the old definition, never retyped, so columns /
    -- NULLS NOT DISTINCT / operator details cannot be dropped by transcription.
    execute format('alter table %s drop constraint %I', r.tbl, r.cname);
    execute format('alter table %s add constraint %I %s deferrable initially immediate',
                   r.tbl, r.cname, v_old);

    select pg_get_constraintdef(oid) into v_new
    from pg_constraint where conrelid = r.tbl and conname = r.cname;

    -- THE PROPERTY DIFF, executed. The ONLY permitted delta is the added keyword.
    if btrim(replace(v_new, 'DEFERRABLE', '')) <> btrim(v_old) then
      raise exception 'constraint %.% changed shape during rebuild: % -> %',
        r.tbl, r.cname, v_old, v_new;
    end if;
  end loop;
end $$;

-- ===========================================================================
-- DEFECT 3 — `public.create_case` still inserts the dropped `cases.template_id`.
--
-- Hard 42703 on EVERY call, so the processless-case door has been dead since
-- `20260907000800` dropped the column. The value it passes is `null` by definition
-- (a processless case has no process), so this is a pure rename with no logic change.
--
-- Rewritten via pg_get_functiondef + replace + execute — the house pattern for a
-- body edit, and the reason CLAUDE.md warns that migration file text is stale by
-- design. It anchors on the whole insert column list rather than the bare word, and
-- RAISES when the anchor does not match, so a future body change cannot turn this
-- into a silent no-op. `pg_get_functiondef` emits CREATE OR REPLACE, which PRESERVES
-- the ACL (A1.7: it is DROP + CREATE that resets EXECUTE to PUBLIC).
-- ===========================================================================

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef(
    'public.create_case(uuid,text,boolean,uuid[],uuid,text,uuid)'::regprocedure);

  v_new := replace(v_def,
    '(commission_id, template_id, case_type_id,',
    '(commission_id, template_version_id, case_type_id,');

  if v_new = v_def then
    raise exception 'create_case rewrite matched nothing — the insert column list moved';
  end if;

  execute v_new;
end $$;

-- ===========================================================================
-- DEFECT 4 — `app.trg_audit_cases` carries a STALE column allow-list.
--
-- Its `case.deleted` arm passes column names to `app.audit_diff` as DATA:
--     array['status', 'outcome_id', 'case_number', 'template_id', 'label']
-- `cases.template_id` no longer exists, so the helper simply never finds it. No
-- error, no warning: the case-DELETE audit row just stopped recording which process
-- the case was bound to.
--
-- ⚠ THIS IS THE WORST OF THE FOUR AND THE ONLY ONE THAT BLOCKS NO TEST. A column
-- name passed as DATA cannot be validated by anything — it is the `.select()` string
-- hazard (A1.5) one layer down, with the difference that a bad `.select()` fails
-- loudly at runtime while this one fails SILENTLY, FOREVER. It is also the place a
-- silent failure costs most: you discover it when someone asks what changed and the
-- audit trail cannot say.
--
-- COVERAGE: held by a keystone in `296_process_case_integrity.sql`, beside the other
-- PCI/H2 audit-arm assertions.
--
-- ⚠ An earlier revision of this comment claimed the keystone lived in `297`. It did
-- not, and never had — the sentence was written while the assertion was still only
-- intended. Recorded rather than quietly deleted, because the failure is the phase's
-- thesis in one line: **a statement about coverage is not coverage, and nothing in
-- the toolchain can tell them apart.** A confident cross-reference is worse than no
-- cross-reference, because the claim is what stops the next reader from looking.
--
-- PROVENANCE: this arm is PCI's (`20260906000200`), not TV's. TV re-keyed the column
-- underneath it and the allow-list went stale without a sound. Fixed here because
-- this phase caused it, recorded as a PCI artifact so the blame is accurate.
--
-- A catalog sweep of every `trg_audit%` trigger's array literals against its table's
-- live columns found no other true positive; the apparent hits are all one trigger
-- function serving several child tables, where a column named for one branch
-- legitimately does not exist on another table.
-- ===========================================================================

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('app.trg_audit_cases()'::regprocedure);

  -- `template_id` occurs exactly ONCE in this body (verified against prosrc), and
  -- the quotes anchor it to the allow-list literal rather than to a column reference.
  v_new := replace(v_def, '''template_id''', '''template_version_id''');

  if v_new = v_def then
    raise exception 'trg_audit_cases rewrite matched nothing — the allow-list moved';
  end if;

  execute v_new;
end $$;

import { execSync } from 'node:child_process'

/**
 * Child-first fixture teardown for form / response trees.
 *
 * ## Why this exists (BUG-E2EISO-002)
 *
 * Every FF spec tears its fixtures down under `session_replication_role =
 * replica`, because the app's immutability guards (`guard_published_structure`,
 * `guard_submitted_response`, `guard_submitted_risk_matrix_trg`, …) correctly
 * refuse to let a published version or a submitted response be deleted. That
 * bypass is legitimate and stays.
 *
 * What is NOT legitimate is what the bypass ALSO switches off. `replica` mode
 * disables every non-origin trigger — and Postgres implements FK `ON DELETE
 * CASCADE` as a trigger. So the shared one-liner
 *
 *     set session_replication_role = replica;
 *     delete from public.forms where title like '%TAG%';
 *
 * deletes the `forms` row and leaves its whole subtree behind, parentless and
 * unreachable by any query the app issues. Found 2026-08-03 during the FF-4
 * gate: a DB-wide sweep turned up 46 orphaned draft `form_versions` plus 2
 * orphaned PUBLISHED versions still carrying real `responses`/`answers`,
 * accumulated silently across past gate runs. Confirmed by controlled test —
 * the same delete in a NORMAL session cascades correctly.
 *
 * ## Where the table list comes from
 *
 * Both halves are derived from the LIVE catalog, never from migration text
 * (CLAUDE.md's binding rule):
 *
 * - the AUTHORING subtree is `app.copy_version_children`'s own insert list read
 *   from `pg_proc` — that function is the authority on what constitutes a form
 *   version's children, since it is what must reproduce them on a clone;
 * - the RESPONSE subtree comes from the FK graph in `pg_constraint` rooted at
 *   `public.forms`. `copy_version_children` cannot cover this half by
 *   construction — cloning a version does not clone its responses — so a list
 *   derived from it ALONE would still have leaked `responses` → `answers` →
 *   `answer_*`, which is exactly the half that orphaned real submitted data.
 *
 * ## Why it is here and not copied into each spec
 *
 * The enumeration's authority is the schema, not any one spec file. Five copies
 * would be five places to miss a table the next time a child is added; this is
 * one. New child table of `form_versions`/`form_items`/`responses`/`answers` →
 * add it here, in the matching subtree, above its parent.
 */

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

/**
 * `--single-transaction` makes a purge atomic: the tripwire below (or any other
 * error) aborts the WHOLE cascade rather than leaving a fixture half-deleted,
 * which would be its own species of orphan.
 */
function psql(sqlText: string): string {
  return execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -tA -F "|"`,
    { input: sqlText, encoding: 'utf8' },
  )
    .toString()
    .trim()
}

/** Every `answers` row under the responses being purged. */
const PURGED_ANSWERS =
  'select a.id from public.answers a where a.response_id in (select id from _purge_responses)'

/**
 * The RESPONSE subtree, deepest first. Safe to run in this order because
 * `_purge_responses` is materialized BEFORE any delete — no statement here
 * re-derives its id set from a table an earlier statement already emptied.
 */
const RESPONSE_SUBTREE_DELETES = [
  `delete from public.answer_selected_options where answer_id in (${PURGED_ANSWERS});`,
  `delete from public.answer_matrix_cells where answer_id in (${PURGED_ANSWERS});`,
  `delete from public.answer_risk_matrix where answer_id in (${PURGED_ANSWERS});`,
  `delete from public.answer_references where answer_id in (${PURGED_ANSWERS});`,
  `delete from public.answers where response_id in (select id from _purge_responses);`,
  `delete from public.response_group_instances where response_id in (select id from _purge_responses);`,
  `delete from public.response_section_signoffs where response_id in (select id from _purge_responses);`,
  `delete from public.responses where id in (select id from _purge_responses);`,
]

/**
 * The AUTHORING subtree, deepest first — `app.copy_version_children`'s insert
 * list, reversed. `form_item_validations` copies LAST on the way in (it needs
 * the re-linked `parent_item_id`), so it comes out before `form_items`.
 */
const VERSION_SUBTREE_DELETES = [
  `delete from public.form_item_options where form_version_id in (select id from _purge_versions);`,
  `delete from public.form_matrix_rows where form_version_id in (select id from _purge_versions);`,
  `delete from public.form_matrix_columns where form_version_id in (select id from _purge_versions);`,
  `delete from public.form_item_validations where form_version_id in (select id from _purge_versions);`,
  `delete from public.form_items where form_version_id in (select id from _purge_versions);`,
  `delete from public.form_sections where form_version_id in (select id from _purge_versions);`,
  `delete from public.form_versions where id in (select id from _purge_versions);`,
]

/**
 * `forms` and `form_versions` also have NO ACTION referrers — `case_phases`,
 * `process_template_phases`, `case_interviews` (FK columns read from
 * `pg_constraint`). A normal delete REFUSES to orphan those; `replica` mode
 * would orphan them as silently as it did the CASCADE children.
 *
 * No FF spec attaches a case or a process template to its own throwaway forms,
 * so this never fires today — but that is a claim about fixtures, and a comment
 * asserting it would go stale the first time a spec grows a case fixture and
 * nothing would say so. Encoded as an assertion instead: the purge fails loudly
 * rather than leaking a new shape of orphan.
 */
const ORPHAN_TRIPWIRE = `do $$
declare n integer;
begin
  select (select count(*) from public.case_phases
           where form_id in (select id from _purge_forms)
              or form_version_id in (select id from _purge_versions))
       + (select count(*) from public.process_template_phases
           where form_id in (select id from _purge_forms))
       + (select count(*) from public.case_interviews
           where form_version_id in (select id from _purge_versions))
    into n;
  if n > 0 then
    raise exception 'purge-forms: % row(s) in case_phases/process_template_phases/case_interviews still reference the forms/versions being purged. These are NO ACTION FKs — a normal delete would refuse, but under session_replication_role=replica they would be silently ORPHANED. Extend e2e/helpers/purge-forms.ts before purging a fixture of this shape.', n;
  end if;
end $$;`

const NO_FORMS = 'select id from public.forms where false'
const NO_VERSIONS = 'select id from public.form_versions where false'

function quoteIds(ids: readonly string[]): string {
  return ids.map((id) => `'${id}'`).join(',')
}

/**
 * Materialize the three roots, assert nothing exotic hangs off them, then
 * delete strictly child-first. Every root is a SELECT so the id sets are fixed
 * before the first delete runs.
 */
function runPurge(opts: {
  formSelect?: string
  versionSelect?: string
  extraResponseSelect?: string
}): void {
  const responseSelect =
    'select r.id from public.responses r' +
    ' where r.form_version_id in (select id from _purge_versions)' +
    (opts.extraResponseSelect ? ` union ${opts.extraResponseSelect}` : '')

  psql(
    [
      'set session_replication_role = replica;',
      `create temp table _purge_forms as ${opts.formSelect ?? NO_FORMS};`,
      `create temp table _purge_versions as ${opts.versionSelect ?? NO_VERSIONS};`,
      `create temp table _purge_responses as ${responseSelect};`,
      ORPHAN_TRIPWIRE,
      ...RESPONSE_SUBTREE_DELETES,
      ...VERSION_SUBTREE_DELETES,
      'delete from public.forms where id in (select id from _purge_forms);',
    ].join('\n'),
  )
}

/**
 * Delete every form whose title matches `%tag%`, with its whole subtree —
 * versions, sections, items, options, matrix axes, validations, and any
 * responses/answers filled against it.
 */
export function purgeFormsByTag(tag: string): void {
  runPurge({
    formSelect: `select id from public.forms where title like '%${tag}%'`,
    versionSelect:
      'select id from public.form_versions where form_id in (select id from _purge_forms)',
  })
}

/**
 * Delete specific responses by exact id, with their whole answer subtree.
 * For fixtures filled against a form the spec does NOT own (a seeded form),
 * where the form itself must survive.
 */
export function purgeResponsesByIds(ids: readonly string[]): void {
  if (ids.length === 0) return
  runPurge({
    extraResponseSelect: `select id from public.responses where id in (${quoteIds(ids)})`,
  })
}

/**
 * Delete specific forms by exact id, with their whole subtree. The by-id twin
 * of `purgeFormsByTag`, for fixtures built on FIXED ids rather than a title tag.
 */
export function purgeFormsByIds(ids: readonly string[]): void {
  if (ids.length === 0) return
  runPurge({
    formSelect: `select id from public.forms where id in (${quoteIds(ids)})`,
    versionSelect:
      'select id from public.form_versions where form_id in (select id from _purge_forms)',
  })
}

function versionPurge(ids: readonly string[], draftOnly: boolean): void {
  if (ids.length === 0) return
  runPurge({
    versionSelect:
      `select id from public.form_versions where id in (${quoteIds(ids)})` +
      (draftOnly ? " and status = 'draft'" : ''),
  })
}

/**
 * Delete specific versions by exact id, with their authoring subtree (and any
 * responses against them) — whatever their status.
 *
 * Needed to reset a FIXED-ID fixture: if an older run orphaned a version, the
 * `forms` row is already gone, so nothing form-rooted can reach it — and the
 * re-insert then collides on the version's primary key. Deleting by the
 * version id directly is the only thing that clears that.
 */
export function purgeVersionsByIds(ids: readonly string[]): void {
  versionPurge(ids, false)
}

/**
 * Delete specific DRAFT versions by exact id, with their authoring subtree
 * (and any responses against them). Scoped to `status = 'draft'` so a
 * mis-collected id can never take a published version with it.
 */
export function purgeDraftVersionsByIds(ids: readonly string[]): void {
  versionPurge(ids, true)
}

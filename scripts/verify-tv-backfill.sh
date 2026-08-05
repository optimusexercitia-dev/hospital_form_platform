#!/usr/bin/env bash
# ADR 0096 — data-bearing rehearsal for the process-template-versioning backfill.
#
# WHY THIS EXISTS
# ---------------
# `supabase db reset` applies migrations and THEN seed.sql. Every local template
# is created by the seed. So migration 20260907000300 (the backfill) runs against
# ZERO ROWS on every local reset, forever. A green `db reset` therefore proves
# NOTHING about the backfill — it is structurally incapable of exercising it.
#
# That is the 20260905 failure mode as a permanent property of the pipeline: that
# backfill also passed a local reset against 0 rows and then failed `db push` on
# the data-bearing remote with a 23514.
#
# ADR 0096 ships WITHOUT a feature flag (a flag would mean maintaining two keying
# schemes), so there is no dark-launch escape hatch on the remote. This rehearsal
# is consequently MANDATORY AND BLOCKING before any `supabase db push`.
#
# WHAT IT DOES
# ------------
#   1. Hides the TV migrations and restores the PRE-TV seed from git.
#   2. `supabase db reset` -> a database populated with real, old-shape templates,
#      children and cases (the shape the remote is in right now).
#   3. Records BEFORE counts.
#   4. Restores the TV migrations and runs `supabase migration up` — the backfill
#      now runs against POPULATED tables, which is the case that matters.
#   5. Asserts every row was re-pointed and nothing was lost.
#
# ⚠ EXCLUSIVE STACK OWNERSHIP REQUIRED. This resets the shared local database.
#   Confirm with the lead that no E2E gate is running first: scripts/e2e-prod-gate.sh
#   itself runs `supabase stop/start/db reset` when it finds the stack unhealthy,
#   so an overlapping gate can wipe this rehearsal out from under you mid-run.
#
# Usage:  bash scripts/verify-tv-backfill.sh [BASE_REF]
#   BASE_REF defaults to the commit that is the parent of the first TV migration.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_CONTAINER="${DB_CONTAINER:-supabase_db_azkbbhskturikxpgmafq}"
TV_GLOB='supabase/migrations/20260907*.sql'
STASH_DIR="$(mktemp -d)"
SEED='supabase/seed.sql'
SEED_BACKUP="$STASH_DIR/seed.current.sql"
BASE_REF="${1:-}"

psql_q() { docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc "$1"; }

cleanup() {
  echo
  echo "--- restoring working tree ---"
  # Migrations back in place
  if compgen -G "$STASH_DIR/*.sql" > /dev/null; then
    mv -f "$STASH_DIR"/*.sql supabase/migrations/ 2>/dev/null || true
  fi
  # Seed back to whatever it was when we started
  if [ -f "$SEED_BACKUP" ]; then
    cp -f "$SEED_BACKUP" "$SEED"
  fi
  rm -rf "$STASH_DIR"
  echo "working tree restored."
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Resolve the pre-TV ref
# ---------------------------------------------------------------------------
if [ -z "$BASE_REF" ]; then
  FIRST_TV="$(ls supabase/migrations/20260907*.sql 2>/dev/null | head -1 || true)"
  if [ -z "$FIRST_TV" ]; then
    echo "FAIL: no 20260907* migrations found — nothing to rehearse." >&2
    exit 1
  fi
  ADDED_IN="$(git log --diff-filter=A --format=%H -1 -- "$FIRST_TV" || true)"
  if [ -n "$ADDED_IN" ]; then
    BASE_REF="${ADDED_IN}^"
  else
    # Migrations not committed yet: HEAD still carries the pre-TV seed.
    BASE_REF="HEAD"
  fi
fi
echo "### pre-TV base ref: $BASE_REF"

# ---------------------------------------------------------------------------
# 1. Hide the TV migrations + restore the pre-TV seed
# ---------------------------------------------------------------------------
cp -f "$SEED" "$SEED_BACKUP"
mv $TV_GLOB "$STASH_DIR"/ 2>/dev/null || true
echo "### hid $(ls "$STASH_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ') TV migration(s)"

git show "$BASE_REF:$SEED" > "$SEED"
echo "### restored pre-TV seed from $BASE_REF"

# ---------------------------------------------------------------------------
# 2. Reset -> a POPULATED, old-shape database
# ---------------------------------------------------------------------------
echo "### supabase db reset (pre-TV schema + pre-TV seed)"
supabase db reset

# ---------------------------------------------------------------------------
# 3. BEFORE counts
# ---------------------------------------------------------------------------
B_TEMPLATES=$(psql_q "select count(*) from public.process_templates;")
B_PHASES=$(psql_q "select count(*) from public.process_template_phases;")
B_NARRATIVES=$(psql_q "select count(*) from public.process_template_narratives;")
B_OUTCOMES=$(psql_q "select count(*) from public.process_template_outcomes;")
B_FIELDS=$(psql_q "select count(*) from public.process_template_custom_fields;")
B_CASES_T=$(psql_q "select count(*) from public.cases where template_id is not null;")
B_CASES=$(psql_q "select count(*) from public.cases;")

echo "### BEFORE: templates=$B_TEMPLATES phases=$B_PHASES narratives=$B_NARRATIVES outcomes=$B_OUTCOMES custom_fields=$B_FIELDS cases=$B_CASES (with template: $B_CASES_T)"

if [ "$B_TEMPLATES" -eq 0 ]; then
  echo "FAIL: the pre-TV seed produced 0 templates — this rehearsal would be vacuous," >&2
  echo "      which is the exact failure mode it exists to prevent. Check BASE_REF." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Restore the TV migrations and apply them to the POPULATED database
# ---------------------------------------------------------------------------
mv -f "$STASH_DIR"/*.sql supabase/migrations/
echo "### supabase migration up (backfill against populated tables)"
supabase migration up

# ---------------------------------------------------------------------------
# 5. Assertions
# ---------------------------------------------------------------------------
fail=0
check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then
    echo "  ok   $1: $2"
  else
    echo "  FAIL $1: got $2, want $3" >&2
    fail=1
  fi
}

A_VERSIONS=$(psql_q "select count(*) from public.process_template_versions;")
A_TEMPLATES=$(psql_q "select count(*) from public.process_templates;")
A_CASES=$(psql_q "select count(*) from public.cases;")

echo "### AFTER"
check "one version per pre-existing template" "$A_VERSIONS" "$B_TEMPLATES"
check "templates preserved"                    "$A_TEMPLATES" "$B_TEMPLATES"
check "cases preserved (none dropped)"         "$A_CASES"     "$B_CASES"

check "phases re-pointed" \
  "$(psql_q "select count(*) from public.process_template_phases where template_version_id is not null;")" \
  "$B_PHASES"
check "narratives re-pointed" \
  "$(psql_q "select count(*) from public.process_template_narratives where template_version_id is not null;")" \
  "$B_NARRATIVES"
check "outcomes re-pointed" \
  "$(psql_q "select count(*) from public.process_template_outcomes where template_version_id is not null;")" \
  "$B_OUTCOMES"
check "custom fields re-pointed" \
  "$(psql_q "select count(*) from public.process_template_custom_fields where template_version_id is not null;")" \
  "$B_FIELDS"
check "cases re-pointed" \
  "$(psql_q "select count(*) from public.cases where template_version_id is not null;")" \
  "$B_CASES_T"

# Status mapping: active -> published, and at most one published per template.
check "no template left without a version" \
  "$(psql_q "select count(*) from public.process_templates t where not exists (select 1 from public.process_template_versions v where v.template_id = t.id);")" \
  "0"
check "no template with two published versions" \
  "$(psql_q "select count(*) from (select template_id from public.process_template_versions where status='published' group by template_id having count(*)>1) x;")" \
  "0"
check "no cross-commission case/version pairing" \
  "$(psql_q "select count(*) from public.cases c join public.process_template_versions v on v.id=c.template_version_id join public.process_templates t on t.id=v.template_id where t.commission_id <> c.commission_id;")" \
  "0"

echo
if [ "$fail" -ne 0 ]; then
  echo "REHEARSAL FAILED — do NOT run supabase db push." >&2
  exit 1
fi
echo "REHEARSAL PASSED — the backfill is proven against data-bearing tables."
echo "Reminder: take a remote snapshot before db push regardless."

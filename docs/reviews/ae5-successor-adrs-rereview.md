# QA Re-review (round 2) — AE5-SUCCESSOR-ADRS

**Unit:** AE5-SUCCESSOR-ADRS · **Branch:** `authz-ae5-successor-adrs` (tip `b2119b0a`) · **Base:**
`main` (`adbde005`) · **Date:** 2026-09-11 · **Reviewer:** `qa`

Scope: verify ONLY the fixes the lead applied for round 1's findings
(`docs/reviews/ae5-successor-adrs-review.md`), per the lead's re-measurement entry in
`docs/progress/ae5-successor-adrs.md` ("QA round 1 CHANGES REQUESTED … re-measured by the lead").
Not a full re-review of the unit.

## Verification table

| # | Item | Evidence (command → result) | Status |
| - | ---- | ---------------------------- | ------ |
| 1 | MAJOR 1 fix: P2 instrument keyed over **eleven** functions | `grep -oE "pg_stat_get_function_calls\('[^']*'::regprocedure\)" scripts/authz-ae4-p2-invocation-count.sql \| sort -u` → 11 distinct rows (`assignment_facts`, `has_permission`, `entailed_grants`, `holds_role`, `authorized_scope_ids`, `candidate_authorized_scope_ids`, `candidate_has_permission`, `explain_permission`, `can_read_professional_profile`, `can_manage_professional`, `current_professional_read_organizations`); `sed -n '176,186p'` shows exactly these 11 `insert into p2_snap` values. ADR 0208 D2 (`:120-125`) now reads "keyed by OID over **eleven** functions" with a dated `⚠` note naming the miscount, that it read "nine" until QA round 1, and the exact re-count location (`scripts/authz-ae4-p2-invocation-count.sql:176-186`). | **PASS** — count matches, correction note present and accurate |
| 2 | MAJOR 2 fix: "identical in every non-comment token," NOT byte-identical; assertion normalises | Live: `pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure)` vs `…candidate_authorized_scope_ids(uuid,text,text)…`. Raw `diff`: **rc 1**, differences = signature line, **3** `--` comment lines (`-- PROPOSE…`, `-- A wrong proposal…`, `-- CONFIRM…`) present only in the runtime resolver, and the confirmer call (`has_permission` vs `candidate_has_permission`). Comment-and-blank-stripped diff (`sed 's/--.*$//' \| sed '/^\s*$/d'`): **rc 1**, differences reduced to signature + confirmer line only — everything else, including the CTE body, identical. ADR 0208 `:135-146` now says "identical in every non-comment token," explicitly "not byte-identical," names the 3-comment-line / signature / confirmer shape, and clause 5's ordered assertion is now specified as comparing bodies "after normalisation (extract each candidate CTE … strip comments and whitespace, require equality)." | **PASS** — reproduced exactly; ADR's description matches measurement |
| 3 | MINOR fix: hub `adrs:`/`reviews:` + registers/index | `grep -n "^adrs:\|^reviews:" docs/features/ae5-successor-adrs.md` → `adrs:` now includes `"0207", "0208"` with inline comment `# 0207/0208 = the ADRs this unit produced (QA r1 MINOR)`; `reviews:` → `["../reviews/ae5-successor-adrs-review.md"]`. `node scripts/check-docs-registers.mjs` → rc 0. `node scripts/build-features-index.mjs --check` → rc 0 ("25 hubs; index in sync"). | **PASS** |
| 4 | No new inconsistency from the fixes | `grep -n "nine" docs/decisions/0207-*.md docs/decisions/0208-*.md docs/progress/ae5-successor-adrs.md` → 4 hits: 0207`:249` is an unrelated subject (role-catalog census, "the remaining nine" legacy roles — not the P2 instrument); 0208`:122` is the dated correction note itself (expected, quotes the old wrong word to explain the fix); record`:346` is the original (pre-correction) log entry, left standing as history per instruction; record`:631` is the later correction-table entry that names the fix. `grep -n "byte-identical"` → 3 hits: 0208`:143` is the correction note itself; record`:226` original entry (left standing); record`:632` the correction-table entry. The later entry (record, "2026-09-11 — lead gate at the tip; QA round 1 CHANGES REQUESTED…") exists and is accurate — it correctly attributes both figures to un-re-measured claims that "travelled" from the record into the ADR, and its own re-measured numbers (11; not-byte-identical) match what I reproduced live in items 1–2. | **PASS** — no residual defect; both stale phrases are either corrected-note text, an unrelated subject, or intentionally-standing log history with an accurate correction on file |
| 5 | Gates bare | `npm run lint` → rc 0 (full chain green, eslint 0/0, including config-schemas, budget-anchor, backend-state, data-access sub-gates). `node scripts/build-adr-index.mjs --check` → rc 0 ("204 ADRs indexed, next free 0209"). `git diff --stat main -- supabase src` → empty. | **PASS** |

## New findings

None. No code, schema, or gate script was touched by the round-1 fix commit (`b2119b0a` only
touched `docs/decisions/0208-*.md`, `docs/features/ae5-successor-adrs.md`,
`docs/progress/ae5-successor-adrs.md`, `docs/reviews/ae5-successor-adrs-review.md` — confirmed by
`git show b2119b0a --stat`), so no new surface was opened for a fresh defect. Round 1's MINOR and
both NOTEs were not required to be re-verified by this task's scope (MINOR was fixed and is
re-checked above under item 3; the two NOTEs were dispositioned by the lead as "left as filed" /
"no trim," which is a judgment call, not a fix to re-measure).

**Verdict:** APPROVED

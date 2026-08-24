# Case-type assignment — ETH·E3a O-1 resolved (ADR 0088)

_Rotated out of PROGRESS.md 2026-07-28 at the FF-3 Record._


**Found:** a sweep of `.rpc()` call sites vs `pg_proc` showed `p_case_type_id` declared by
`create_case` + `create_case_from_template` and passed by **nobody**. It was the only writer
of `cases.case_type_id`, so every app-created case landed NULL — which made each `case_types`
row's `default_visibility_policy` **inert**. Ethics cases created through the UI were born
`commission_default` (whole-commission visible) instead of `explicit_grants_only`. `seed.sql`
claimed that hole was closed; it was not. Proven live, both directions.

**Root cause:** not a regression — E3a deferred "where does a case get its type" as Open
decision O-1 and the call was never made. ADR 0064 D4's channel
(`process_templates.case_type_id`) was never built.

**Fixed** → ADR [0088](../../docs/decisions/0088-case-type-assignment-channel.md): template declares
(`process_templates.case_type_id` + `set_template_case_type` + org-consistency trigger `HC0F7`),
`create_case_from_template` inherits, process-less dialog picks, org-admin CRUD at
`/o/[org]/manage/tipos-de-caso`. Migrations `20260829000000` + `20260829000100`.
**Local only — remote `db push` NOT done.** Green: tsc 0 · scoped eslint 0/0 · Vitest 490 ·
`next build` ✅ · 5-case live proof (inherit / process-less / cleared-no-regression /
cross-org `HC0F7` / non-admin `42501`). **Not yet E2E-tested or QA-reviewed.**

> ⚠ `npm run lint` (whole-repo) currently reports ~45.8k problems from the nested
> `worktrees/ff/flexible-forms-program/.next/` build output — `eslint.config.mjs` ignores
> `.claude/**` but not `worktrees/**`. **Pre-existing and unrelated**; needs a one-line ignore.


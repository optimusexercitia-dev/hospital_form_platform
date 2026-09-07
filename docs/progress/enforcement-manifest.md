# ENFORCEMENT-MANIFEST — progress record

Enforcement manifest: pre-AE5 remediation Batch 4 (Batch 5, the rollback runbook, rides along).
The unit's **summary** is its hub, [docs/features/enforcement-manifest.md](../features/enforcement-manifest.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: the enforcement manifest (the AE4 per-role template's oracle — its `hardDenyClasses`
column, its `enforcementSites` rows and their qualifiers), the manifest lint arm (M7) and its §6.2
search, pgTAP `410` (§8.5's by-name pin), `public.set_item_validations` and every other DEFINER
writer behind a `_staff_admin_write` policy (a migration if re-keyed), `docs/backend-state.md`'s
authz section, and `docs/deployment/authz-rollback-runbook.md` §6.1–6.2.
Decisions: ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) (AE5 is
post-pilot; the runbook's shape), [0176](../decisions/0176-authz-permission-layer-made-real.md)
(the permission layer; D8's bundle stays AE5's), [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
(a green arm bounds its own domain), [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
+ [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(the diff-scoped sweep this unit owes, both arms). This unit's own ADR: **0193**, reserved
2026-09-07 (0192 → Batch 3).

## Session log

### 2026-09-07 — unit opened (lead, second machine)

**Why now.** Batch 4 of the pre-AE5 batches ruled 2026-09-04; ruled 2026-09-07 to run on a
separate machine in parallel with Batch 3 (whose ~13 h `RESET_EVERY` write-path sweep owns the dev
machine's stack for a day). This machine: macOS, own clone, own Docker stack
(`supabase_db_azkbbhskturikxpgmafq`, up and healthy at open), `.env.local` present. `main` @
`23ec1fa5`, clean, no `in_progress` hub anywhere in `docs/features/INDEX.md` — Batch 3's hub is not
in this clone (it opens on the other machine).

**Scope.** Four follow-ups (hub § Acceptance criteria) plus Batch 5's runbook re-measure, riding
along because a class-wide re-key here moves the very count §6.2 must assert — measuring it at this
unit's tip is the only measurement that stays true. Explicitly NOT: the write-arm re-baseline and
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Parts 2–4 (Batch 3, other machine); the D8 bundle and
anything ADR 0176 D8 reserves for AE5's opening ADR (Batch 9); the privilege budget (Batch 7);
`app.can_manage_professional`'s self-check arm (Batch 8); Tier 2's 190 doors (deferred by ADR
0171, **not** cleared — every gate record citing the sweep says so).

**Facts at open** (from the follow-up bodies and the plan; every figure to be re-measured by the
builder on a fresh reset):
- `hardDenyClasses` is `[]` on 43/43 manifest rows; M7 iterates zero times; §6.2 searches depth 1
  only, no discrimination control. Remediation (a) — the `measured-depth1-at-sites-and-authorizer`
  label and the caption — is on `main` since 2026-09-03; (b) is owed as ONE change.
- `form_item_validations`' re-keyed policy is unreachable (`authenticated` holds SELECT only);
  `public.set_item_validations` gates on `is_staff_admin_of`. The `_staff_admin_write` class is
  **unswept** — its size is unknown at open; the builder enumerates it from `pg_policies` +
  `pg_proc`, never from migration text.
- `app.current_professional_read_organizations` carries the literal `org.professionals.read`, is
  in no `enforcementSites` row, and is held green by a by-name pin in `410 §8.5`. PO ruling owed
  **before** the build (it changes the manifest diff).
- `app._audit_access_authorized` is the fourth consumer of `can_read_professional_profile`; owed a
  note, ⛔ not a site.
- Runbook §6.2 says `EXPECT 4 rows`; the AE4 re-key made it six; an interim banner has sat beside
  it since 2026-09-03.

**Parallel-run obligations (plan §3 Batch 4, items 1–6):** merge Batch 3 first; rebase onto it and
**re-run the diff-scoped sweep, both arms**, `SCOPE:` re-quoted, `npm run lint` mid-merge; until
Batch 3 lands, check by hand that the write-arm case list is non-empty before reading its exit as
a pass; ADR 0193 reserved; `follow-ups-open.md` + the two indexes will conflict — regenerate the
indexes, never hand-merge.

**Next.** `backend` returns a full plan (the subjects decide what the site-axis arm measures and a
re-key is a migration); the lead rules into one scratch file; the read-organizations question goes
to the PO before the build.

**Gate 13 on macOS (found at open, fixed on the branch).** `check-docs-registers.mjs:1179` passed
`--format=%(refname:short)` unquoted to `/bin/sh`; on macOS the shell rejects the parentheses, the
helper's silenced stderr turns that into an empty branch list, and every `in_progress` hub reds as
"branch does not exist" — a dead census that reads as a finding (plan §5's `grep -rniF` shape,
inverted). Quoted the format; gate 13 and the full `npm run lint` chain green after. Windows Git
Bash never saw it. Filed nowhere else: fixed in one line on this branch, noted here.

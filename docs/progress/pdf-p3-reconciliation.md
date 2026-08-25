# PDF·P3 — catalog reconciliation of the authz sweep domain

**Date:** 2026-08-25 · **By:** `backend` · **Item:** [pdf-p3-handoff.md](./pdf-p3-handoff.md) §6 item 1

**Question.** Gate 1's authz verdicts (`ARM=census` HOLDS · `ARM=hat` · `ARM=floor` · diff-scoped
sweep CLEAN) ran over a domain derived from **migration text**. The P3 diff carries ~49
`execute`/`format` lines, and in this repo migrations rewrite function bodies at runtime via
`pg_get_functiondef()` + `replace()` + `execute`. If even one gate exists that nobody scoped, every
one of those HOLDS was a green over an under-scoped set. Per
[CLAUDE.md](../../CLAUDE.md) the live catalog is the sole truth here.

---

## Method

Two `supabase db reset --local` runs against the same containers (`project_id`
`azkbbhskturikxpgmafq`), byte-identical queries both sides, output `LC_ALL=C sort`ed.

| | tree | migrations applied | `max(version)` |
| --- | --- | --- | --- |
| **A** | P3 (`9a97064d`, `main`) | 460 | `20261003002800` |
| **B** | `origin/main` (`8ecf51de`), detached worktree | 453 | `20261003002100` |

The 7-file delta is exactly `20261003002200` … `20261003002800`. Snapshot sizes:

| domain | A | B |
| --- | --- | --- |
| `pg_proc` rows in `app` + `public` (`nspname`, `oid::regprocedure`, `prosecdef`, `proacl`, `md5(prosrc)`) | 1025 | 1010 |
| `pg_policies` rows, all schemas (incl. `qual` **and** `with_check` separately) | 282 | 282 |
| non-internal `pg_trigger` rows (`relname`, `tgname`, `tgenabled`, handler) | 265 | 242 |

Functions are keyed on **`oid::regprocedure`**, never `proname` — a name-keyed census collapses
overloads and its parts stop summing.

⚠ **Known blindness of that key, measured 2026-08-25 and recorded here rather than left implicit:
`oid::regprocedure` renders IN arguments only, so a RESULT-contract change is invisible to it.**
Two of the "12 same-signature replacements, only `md5(prosrc)` moved" were in fact DROP+CREATE with
a widened result: `app.resolve_print_source_state` gained `OUT o_case_disposed boolean`, and
`public.print_source_state` gained return columns. ⇒ **"same signature" here means same IN
signature; read it as "not a new callable name", not as "same contract".** The verdict is
unaffected — both were inside the 27 either way, and the `A \ B` decomposition still closes exactly
— but a future session must not infer *"the callers were unaffected"* from this key.
⭐ Proven **without** reading migration text, which is what makes it admissible: `git show
origin/main:src/lib/types/database.ts` — a *catalog-derived* artifact — lists `print_source_state`
returning four columns against the P3 side's six. That also settles that **both** `case_disposed`
**and** `source_revision` are P3 additions.

---

## Reconciliation against the 27 scoped names

The scope swept is the 27-gate list in
[case-printing-p3-substrate.md](../plans/case-printing-p3-substrate.md) § "Authz arms". Both
directions:

| direction | count | content |
| --- | --- | --- |
| **In the 27, absent from `A \ B`** | **0** | every scoped name is present in the catalog delta — no migration statement failed to take effect |
| **In `A \ B`, absent from the 27** | **0** | 🟢 **no unscoped gate exists** |

`A \ B` decomposes exactly onto the list, with nothing left over in either direction:

- **15 brand-new signatures** — `app.case_is_terminal(uuid)`,
  `app.bump_case_print_revision(uuid)`, `app.can_read_full_case_content(uuid,uuid)`, and the **12**
  `app.trg_bump_case_revision*()` functions. All `prosecdef = t`; all `proacl =
  {postgres=X/postgres}` — no `authenticated`, no PUBLIC.
- **12 same-signature replacements** — `app.can_view_printed_document`,
  `app.print_source_{registers,watermark,series,revision,head}`,
  `app.resolve_print_source_state`, `public.{print_source_state,mint_printed_document,
  log_document_previa,open_printed_document,dispose_case_phi}`. Only `md5(prosrc)` moved:
  **0 of 12** changed `prosecdef` or `proacl`.
- **0 signatures removed** (`B \ A` = 0), so no DROP+CREATE landed under a different signature.

15 + 12 = **27**. Global `prosecdef = t` census 810 → 825 = +15, so the parts sum.

**Policies.** `A \ B` = **0** and `B \ A` = **0** over full lines; the `(schema, table, policy)` key
sets are identical. The substrate brief's "zero RLS policies touched" was derived from the diff; it
is now **catalog-confirmed**, `USING` and `WITH CHECK` compared as separate columns.

**Triggers.** `A \ B` = **23**, `B \ A` = **0**. All 23 are `tgenabled = 'O'`, all 23 dispatch to one
of the 12 new `trg_bump_case_revision*` functions, and all 12 are reached by at least one trigger.
No trigger outside the scoped family.

**ACL regression check.** NULL `proacl` (the default, which includes PUBLIC) across `app` + `public`
is **228 on both sides** — P3 introduced none, and **0 of the 27** carries one. The DROP+CREATE
ACL-revert hazard that `002400`'s own header warns about did **not** materialize; `002700`/`002800`
hold.

## Verdict

🟢 **Gate 1's authz verdicts stand.** The domain they ran over is the complete set of gates the
phase created or replaced. There is no gate in the live catalog that the 27-name scope missed, no
policy change the "zero policies" claim missed, and no trigger outside the swept family — so none of
`ARM=census` / `ARM=hat` / `ARM=floor` / the diff-scoped sweep was a green over an under-scoped set.
The ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) Amdt 1 hand-list, this
once, was already complete; that is a measurement, not a reason to skip the next one.

### Controls

- **Positive control on the policy differ** (the only domain returning zero): a scratch table +
  one `for select using (true)` policy was created on the B-side DB, the identical query re-run, and
  the diff showed **exactly** that one added line (283 vs 282) before the probe was dropped. The
  zero is a real zero, not a dead pipeline.
- **Reproducibility**: after the final reset back onto P3, the functions snapshot was retaken and is
  **byte-identical to A**, including every `md5(prosrc)` — the runtime `execute`/`format` rewrites
  are deterministic across resets.
- **State control**: `max(version)`/`count(*)` from `supabase_migrations.schema_migrations` was
  measured, not assumed, at each side (453/`…002100`, 460/`…002800`).

---

## C-1 premise — confirmation (rode along free, one query)

`pg_get_functiondef('public.dispose_case_phi'::regproc)`, `--` comments stripped. All three of
handoff §5.1's HIGH-confidence transcriptions **CONFIRM**. `v_redacted constant text := '[PHI
removido]'`.

| field | redacted? | statement |
| --- | --- | --- |
| `cases.label` | **YES** | `update public.cases set label = v_redacted where id = p_case_id;` |
| `case_events.title` | **YES** | `update public.case_events set body = v_redacted, title = v_redacted where case_id = p_case_id;` |
| `documents.title` / `.description` | **YES** (both) | `update public.documents d set title = v_redacted, description = null where d.home_resource_id = p_case_id;` |

Strip safety: the two `'[^']*--` regex hits are trailing comments after a closed literal, not `--`
inside a string, and none of the three statements above involves a comment on its line.

The conjunct that makes those three matter is in the same door's printed-document block:

```sql
update public.printed_documents
   set status = 'revoked', ...
 where source_kind = 'case' and source_id = p_case_id
   and contains_phi
   and status <> 'revoked';
```

---

## Measured contradictions to the record

1. **"17 brand new" is 15.** The substrate brief's *"27 gates created or replaced; 17 brand new"* is
   off by 2: measured **15 new / 12 replaced**. The two the brief flags as DROP+CREATE —
   `app.resolve_print_source_state` and `public.print_source_state` — are **present in B**, so they
   are rebuilds of pre-existing functions, not creations. That is precisely the 2 that reconciles
   17 → 15. It does not change the scope (both were in the 27 either way).
2. **The tree was not quiet, and the commit count is stale.** The spawn brief said *clean at
   `9a97064d`, 14 commits ahead*. Measured at start: **18** ahead. During the measurement HEAD
   advanced twice (`6aad5bb8`, then `455ebcb6` — now **20** ahead) with uncommitted C-2 edits
   appearing in `src/lib/markdown/`, `src/lib/pdf-mint/`, `src/lib/pdf/`. **This does not invalidate
   A**: `git diff --name-only 9a97064d..HEAD -- supabase/` is **empty**, `git status -- supabase/` is
   empty, the migration count held at 460, and A was reproduced byte-for-byte afterwards. But ⚠ the
   base-tree window downgraded the shared local DB to `…002100` for several minutes, so **any DB-touching
   measurement another session took in that window is void** — this task was told it owned the stack
   exclusively and it did not.

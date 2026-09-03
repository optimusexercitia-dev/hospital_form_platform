# FUP-PCITV-1 — PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-05 · status open

QA r2 approved with 7 items open. None blocks the merge; **two block a clean deploy story** and are
called out in the Phase Status caveats above. Owner: unassigned unless noted.

| # | Sev | Item |
| - | --- | ---- |
| 1 | ⬛ | ~~**`ARM=census` never run**~~ **CLOSED 2026-08-05** — the arm landed with the membership-hardening merge and was run against the merged catalog. It found real debt, not nothing: `process_template_versions_{select,staff_admin_write}` carry **no verdict from any sweep**. TV swept and keystoned the six CHILD policies on `process_template_{phases,narratives,outcomes}` (`dcc5a4d`) and not its own PARENT table's two — *a new door must inherit every sibling arm*, one level up. Registered as `gate:` debt in `authz-unswept-backlog.txt`. The ghost-check also named all five `validate_template_*` signatures ADR 0096 re-keyed to `p_template_version_id`. |
| 2 | ⬛ | ~~**TV backfill never exercised** — rehearsal + snapshot blocking before `db push`.~~ **CLOSED (PO, 2026-08-05): the remote is EMPTY**, so the backfill meets 0 rows there exactly as it does locally. Not blocking. See the Phase Status caveat for the mechanism (which recurs) and for the unverified-premise error that produced this row. |
| 3 | ⬛ | ~~**Revoke residue**~~ **CLOSED 2026-08-18 — swept (first-party) AND accepted in writing (platform), which is exactly the disjunction this item demanded.** `20260928000900` revoked TRUNCATE from anon+authenticated on **63** postgres-owned tables (0 remain); pinned by pgTAP `191` §5, property-bounded by OWNERSHIP so a new first-party schema is covered on creation, with a two-direction falsifiability control. ⛔ The platform half (`storage.*`, `net.*`) **cannot be revoked by us** — see the block below. |
| 4 | ⬛ | ~~**BUG-RCA-001**~~ **CLOSED 2026-08-05** — PO ruled the interview's date is the **earliest session's `scheduled_start`**; fixed, PostgREST-verified, and the ruling pinned by `rca.test.ts` (5 cases, mutation-proven per arm). See the Bug Log. |
| 5 | 🟢 | Audit mesh **2 of 7** trigger arms keystoned (`20260906000200`). |
| 6 | 🟢 | The `is_commission_admin_of` disjunct in the 6 new tenant-isolation keystones is **unexercised** — no org-admin persona exists in the test bootstrap. Adding one lifts several suites at once. |
| 7 | 🟢 | `compute_case_phase_result` / `sync_case_phase_on_submit` still force the `in_case_rpc` GUC off (fails **closed**). · Resolver error semantics: helpers now log, but still collapse "not found" and "query failed" into one return — the discriminated-union refactor was deliberately deferred as too risky post-green. |
| 8 | 🟢 | **A FIFTH rebuild-property-loss, inside the migration written to close that class.** `20260907000700` recreated 10 policies on the 5 re-keyed relations **without the `TO authenticated` clause the originals carried** (`20260821000000` wrote `for select to authenticated`; the swap wrote bare `for select`). Platform split is **256 `{authenticated}` vs 11 `{public}` — and 10 of the 11 are these** (the 11th, `case_referral_delete_draft_source`, pre-dates the phase). `20260907001200` caught the ACL and `DEFERRABLE` losses and missed this one. **Verified INERT, twice:** `anon` holds **0 table grants on the 5** — and **0 anywhere in `public`** — so a bare policy still only ever evaluates for roles that either carry `BYPASSRLS` or cannot reach the table. Not a vulnerability; a latent widening if `anon` is ever granted anything. Normalize when one of these policies is next touched. ⚠ Same standard-consistency point as row 3: this phase refused the "unreachable" argument in `20260906000600`. |

| 9 | ⬛ | ~~**`296` suite-number COLLISION between branches.**~~ **CLOSED 2026-08-05** — resolved during the merge, not before it: the branch had committed by then, so it came through as a two-file collision on one number. Renumbered to `supabase/tests/298_authz_p0_isolation.sql`, with the Batch-4 runner in `p0b-isolation-mutation-audit.sh` following it. (A third collision was then created and caught in the same session — `299_hospital_content_door_noun_rule.sql` was first written as `284_`, which `284_accreditation_hospital_readiness.sql` already held. Check the directory before picking a number.) |
| 10 | 🟢 | **PROGRESS.md is 105 KB against the <60 KB target** (CLAUDE.md §7 — every spawn pays for it). This phase's rotation took it from 111.6 KB, so the trend is right but the gap is not closed. Next rotation should take the `📋 Remaining pre-pilot work` and closed-bug sections. |

> ### ⬛ Item 3 (revoke residue) — CLOSED 2026-08-18, and the platform half is an ACCEPTANCE, not a sweep
>
> **Swept.** `20260928000900_revoke_truncate_residue.sql` — TRUNCATE revoked from `anon` +
> `authenticated` on the **63** postgres-owned tables that still held it (the residue
> `20260711000100` left behind when it flipped the *default* but did not sweep existing tables).
> Pinned by pgTAP **`191` §5**, all 194 files / 6406 assertions green.
>
> ⭐ **Why this grant was worth more than its 🟡.** The item graded it on RLS bypass. The bigger
> consequence went unnamed: **TRUNCATE fires no DELETE trigger**, so it also walks past every
> statement-level `AFTER DELETE` guard — including `storage.protect_delete`. Measured 2026-08-18:
> a bare `DELETE` on `storage.objects` raises `42501`; a `TRUNCATE` succeeds, and the bytes stay on
> disk as orphans. Combined with [the Cloud orphan probe](../progress/cloud-orphan-probe-2026-08-18.md) of the
> same day, the blast radius is *"every byte in every bucket orphaned, and then unobservable on
> Cloud forever"* — not *"rows lost, restorable"*.
>
> ⛔ **ACCEPTED IN WRITING — the platform residue is not ours to revoke.** `storage.objects`,
> `storage.buckets`, `storage.buckets_analytics` (owner `supabase_storage_admin`) and the `net.*`
> tables (owner `supabase_admin`) grant TRUNCATE to `anon` and `authenticated`. **We cannot change
> that**, and the way it fails is the trap:
>
> | statement, run as `postgres` on Cloud | result |
> | --- | --- |
> | `revoke truncate on public.<table> from authenticated` | privilege `t` → **`f`** |
> | `revoke truncate on storage.objects from authenticated` | **no error**, privilege `t` → **`t`** |
>
> Postgres does not error when the caller is not entitled to revoke — it warns and no-ops. ⭐ *A
> migration that swept "everywhere it could" would have gone green on `db push` having hardened
> nothing on the half that mattered, and been recorded as complete.* The first probe I ran asked
> only whether the statement errored and answered **"REVOKE WOULD SUCCEED"** for `storage.objects`;
> only re-measuring the **privilege itself** exposed the no-op. Same family as
> [[guards-that-read-right-but-fail-open]] — and the reason `20260928000900` re-derives the set from
> the catalog after its loop instead of counting statements executed.
>
> The scope is therefore the deterministic first-party one. A local superuser *can* revoke on
> `storage`, so an opportunistic sweep would also have made local and Cloud diverge — green locally,
> unchanged in production.
>
> **Residual risk, stated plainly:** not reachable today. PostgREST exposes no TRUNCATE verb, and
> `anon` / `authenticated` / `service_role` are all **NOLOGIN**, so an API key is not a database
> credential. It needs a direct connection as a client role, which nothing issues. `service_role`
> keeps TRUNCATE deliberately — it is the trusted server-only role that already bypasses RLS, and
> anything holding that key can delete everything through the API anyway.

**Landed, no longer a recommendation:** the PostgREST **embed sweep** built during this phase now
lives in the repo at **`scripts/extract-embeds.mjs`** + **`scripts/probe-embeds.mjs`** (moved out of
a session scratchpad that was about to be deleted — the earlier revision of this line pointed at a
path that would not have existed, which reads as "saved" when it is not). It found BUG-TV-001 *and*
BUG-RCA-001 mechanically across 284+ call sites. It still cannot join `npm run lint`, because it
requires a live local Supabase and `probe-embeds.mjs` refuses any non-local URL by design.

⬛ **Entry point DONE 2026-08-11: `npm run sweep:embeds`** (extract → probe, both against `.`, via a
gitignored `.embed-sweep/` scratch dir; `extract-embeds.mjs` now creates that dir rather than
requiring the caller to). Run against the live local stack to confirm it works end-to-end.

**Its baseline is a NAMED list, not a count** — deliberately, per the FUP-E2E-1 lesson that a
count-shaped baseline is a hiding place:
- **311** select sites resolved, **0** unresolved · **248** distinct (relation, select) pairs probed.
- **246 × `42501`** = genuine PASS. The sweep probes with the **anon** key, which holds zero table
  grants, and its own built-in CONTROLS (C1/C2/C3) prove each run that 42501 does **not** mask embed
  or column errors — a good tool: it re-earns that claim rather than asserting it.
- **2 × `PGRST205`**, both `get_meeting_agenda_items` (`minutes-jobs/context.ts:119`,
  `minutes-jobs/queries.ts:193`) — **extractor false positives, NOT defects.** Both sites are
  `.rpc(name, args).select(...)` chains; the AST extractor reads the RPC name as a relation and
  probes `GET /rest/v1/<rpc>`, which is not a table. ⚠ Whoever next touches the sweep: this is the
  known baseline — do not chase it, and do not "fix" it by suppressing PGRST205, which is the code
  that would report a genuinely missing relation.

The generalisation that justifies keeping it: **ADR 0096 A1.5's grep sweep could not have caught
BUG-TV-001, because that site names no dropped column — it names a relation that is no longer
*reachable*. After a column drop, sweep the embeds the column ENABLED, not just the column.**

⚠ **Deferred by decision, not oversight** (ADR 0095 §3): `blocks[]` → join table; the
`case_phase_offered_results` rename.

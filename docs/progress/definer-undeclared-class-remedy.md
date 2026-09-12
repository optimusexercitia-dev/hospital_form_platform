# DEFINER-UNDECLARED-CLASS-REMEDY — progress record

Hub: [../features/definer-undeclared-class-remedy.md](../features/definer-undeclared-class-remedy.md) ·
closes `FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER` · ADR 0208 D4 ·
branch `definer-undeclared-class-remedy` cut from `main @ f55b53ba`.

## Session log

### 2026-09-12 — unit opened; the ruling located; the closing branch chosen (lead)

**The follow-up's two branches.** *Closes when:* "the ruled disposition of the undeclared-`search_path`
DEFINER class is built as its own assertion (or `414 § 0b` is named as that assertion and `421 § 0c`'s
message points at it)". The Explore pass located the ruling in three carriers, verbatim and identically
worded:

- `docs/followups/follow-ups-archive.md:13585-13588` — *"**Open half 1 — RULED (PO 2026-09-11 …):** a
  `prosecdef` function with **no** `search_path` is a **defect to converge to `''`**, never a member to
  add to any frozen set; a red on `414 § 0b` means exactly that, and neither `414` nor `419` may be
  widened to admit it. No new cell."*
- `docs/backend-state/authorization-and-audit.md:71` — the seam's `## Current state`, same clause.
- `docs/progress/definer-search-path-narrow-fix.md:147-155` (the accepted proposal: *"not a new gate
  but a statement of what happens when the existing one reds … `414 § 0b` already reds the day the
  count moves"*) and `:388-390` (approval scope: *"accepted as proposed"*).

⇒ The ruling names `414 § 0b` as the assertion and orders no new one. The lead therefore takes the
SECOND branch (name `414 § 0b`, point `421 § 0c` at it) and adds what the ruling did not say but the
lessons register demands: a control proving `414 § 0b` can red, and a partition fix in `421 § 0c`.
⛔ Building a third assertion would contradict *"No new cell"*; the PO confirms or overrules at step 4.

**Why two gates disagree today (measured, not read off the FUP).** `414 § 0b` is
`is(string_agg(sig) where sp is null, '')` — a red prints offending signatures and says what is LOST
("NOT covered by §1"), not what to do. `421 § 0c`'s `non-empty` term is `sp <> '""'`, which is TRUE
for `<none>`, so a red reads `891 = 862 non-empty (419) + 29 empty (421) | 1 undeclared` (the QA r1
probe at `docs/reviews/definer-qualified-body-gate-review.md:78-79`) — the newcomer is counted on the
`419` term of the string even though the census (`scripts/definer-search-path-census.sql:37-38`)
coalesces a missing value to `'""'` and keeps it OUT of the frozen set. `421`'s header (`:184-189`)
says it *"would be counted on 419's side"* — false in the catalog, true only of the printed string.
Neither message names the convergence. ⚠ Two undeclared predicates exist — `421`'s `sp = '<none>'`
(no `search_path=%` element) and the looser `proconfig is null`; both read **0** on the live stack
2026-09-12 (`890 total | 861 non-empty | 29 empty | 0 | 0`), but a DEFINER carrying only a
non-`search_path` `proconfig` element would separate them. `414` and `421` share the stricter one.

**Stale carriers found.** `authorization-and-audit.md:1307` (*"PROPOSED … PO to rule"*), `:1308`
(*"pinned by `414`, not ruled"*), `:1324` (*"PO-ruled but unbuilt"*) — all in posted slices, all
contradicted by `:71` of the same file; `scripts/definer-search-path-census.sql:28-29` (*"disposition
is the follow-up's open half 1"*). ADR 0208 itself never rules the class (its D4 rules the VALUE; the
only mention is the census note `:216`), so no ADR is amended.

**Tree state at open.** `git status` showed four modified docs files belonging to another live session
(a closure of `…SUPABASE-TEST-DB-LEAVES-NO-PGTAP-INSTALLED`, uncommitted). ⛔ Not this unit's; staged by
path only, never `git add -A` (playbook § 4).

# Backend State — the router

> **Purpose.** A durable, terse map of what the backend already provides, so the lead references
> it at phase start instead of re-deriving ~50 lines of "lead notes" each phase. The **lead keeps
> this current** at the §6 Record step (CLAUDE.md §7): when a phase adds an RPC, flips a flag, or
> changes an RLS surface, extend the relevant **seam file** here.
>
> This is a **map, not the authority** — `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_constraint`, `pg_trigger`, the ACLs).
> ⚠ **Not the migration files** — some rewrite live function bodies at runtime via
> `pg_get_functiondef()` + `replace()` + `execute`, so their text is stale by design (CLAUDE.md
> § graphify; this sentence said "the migrations are the truth" until 2026-08-05).

## A reference, not a reading list

Read **this page**, then open **the one file** that governs the surface you are about to touch —
not the others, and never the directory whole. Until 2026-09-09 this was a single
`docs/backend-state.md` of **742 KB / 6,353 lines**, and CLAUDE.md told the lead and every
teammate to reference it at phase start. No context window holds that, so nobody ever read it
whole; the instruction read like a guard while guarding nothing. **The index is the unit of
reading; the section is the unit of retrieval.**

| Open this | When you are about to |
| --- | --- |
| [`conventions.md`](conventions.md) | rely on an `HC0xx` SQLSTATE, write or run a pgTAP suite, touch the migration registry, or take **any** action against the REMOTE |
| [`tenancy-and-identity.md`](tenancy-and-identity.md) | touch organizations, hospitals, affiliations, `memberships`, CPF/person identity, "act as", or the Diretor Técnico plane |
| [`authorization-and-audit.md`](authorization-and-audit.md) | touch an RLS policy, a `SECURITY DEFINER` door, the privilege budget, a service-role write, the audit trail, or quality-office oversight |
| [`forms-and-responses.md`](forms-and-responses.md) | touch forms, versions, sections, items, answers, validations, matrices, entity references, or sign-off |
| [`document-model.md`](document-model.md) | touch documents, file objects, securables, upload sessions, controlled documents, or evidence |
| [`cases-and-ethics.md`](cases-and-ethics.md) | touch cases, case phases, participants, referrals, ethics, or process templates |
| [`cases-and-ethics.md`](cases-and-ethics.md) (primary; the authz semantics in [`authorization-and-audit.md`](authorization-and-audit.md) § Per-object grant plane) | touch a per-user, per-object **grant** table — `case_access_grants` today, or any future ledger (⛔ none before AE5-complete: ADR [0205](../decisions/0205-per-object-grant-plane-convention.md) D12; shape D2–D9; `.claude/rules/grant-plane-convention.md` fires as the migration is written) |
| [`printing.md`](printing.md) | touch PDF printing, print series, prévia vs emission, or the case dossier |
| [`privacy-and-dsr.md`](privacy-and-dsr.md) | touch LGPD subject requests, erasure, or PHI disposal |
| [`meetings-and-governance.md`](meetings-and-governance.md) | touch meetings, audio→ata, charters, cadence, or accreditation standards |
| [`notifications.md`](notifications.md) | touch notifications or action items |
| [`generated-rpc-surface.md`](generated-rpc-surface.md) | look up **any** `public` function — its arguments, return type, `prosecdef`, volatility and EXECUTE grants. ⚠ It is the whole `pg_proc` population, so 22 of its 555 rows are `*(trigger)*` and are NOT callable doors |
| [`generated-helper-surface.md`](generated-helper-surface.md) | look up **any** `app` helper, predicate or trigger function, with the same six facts |
| [`generated-feature-flags.md`](generated-feature-flags.md) | look up a feature flag's key, its `FeatureFlags` field and the readers that resolve it |
| [`generated-query-modules.md`](generated-query-modules.md) | find the `src/lib/queries/` or action module that owns a query, and what it exports (Rule 9) |
| [`data-access.md`](data-access.md) | need what a door is FOR — the invariants, mirrors and exceptional behaviour behind the four generated registries above |

⛔ **The pre-split currency-stamp chain is no longer here.** It moved to
[`../progress/backend-state-stamp-history-archive.md`](../progress/backend-state-stamp-history-archive.md)
on 2026-09-09 (ADR 0199) because it is **history, not state** — 72 KB of dated 2026-06/08 stamps, 93% of
it one 66,653-character line, routed as if it were a twelfth seam. The facts that genuinely lived only
there were verified against the live catalog and moved into the seams that own them, each under an
`## Extracted from the pre-split stamp chain` heading. Six of them turned out to **contradict** a posted
section, and became corrections. ⚠ Do not route it again: a frozen archive on the retrieval path is
read as current state, which is exactly how its stalest claims kept circulating.

⛔ **Looking up an ADR? Go to [`../decisions/INDEX.md`](../decisions/INDEX.md)**, which is
GENERATED from the ADRs' own headers. The prose ADR list that used to live in this map was
**deleted at the split**: it was an ungated second copy, and `scripts/build-adr-index.mjs` cites it
by name as the reason the generated index exists — it "had stopped in the 0070s".

## Maintenance rules

1. **A posted section is frozen the moment it is posted.** Corrections are APPENDED, never edited
   into the statement they correct — the same discipline as a published `form_version`
   (Architecture Rule 5).
2. **A correction leaves a forward marker at the statement it supersedes**: a
   `⚠ **Superseded** — <what changed, in one clause>. See <file> § <heading>.` line directly under
   that heading, naming where the correction lives. Gate 16 reds if the named FILE does not exist
   **or if no heading in it matches** — ⚠ the form was `§ <n>` until 2026-09-09, which validated
   nothing: `§ 9999` passed. Name the heading, because that is what a reader navigates by.
3. **A new phase EXTENDS its seam file.** It does **not** open a new file, and never a phase-named
   one. The phase axis is what made the predecessor unreadable: 53 dated slices carrying 33
   `SUPERSEDED` and 45 `STALE` markers, because a reader asking "what is the surface *now*" had to
   replay them in order and apply the supersessions by hand.
4. **Size is a signal.** Gate 16 warns at **160 KB** per file and fails at **200 KB**. ⛔ The fix is
   never to raise the cap, never to open a phase-named overflow file, and never to delete a posted
   section — it is to find the seam inside the file that wants its own home, and to say so here.
5. **Every figure carries the query that produces it.** A count without its query is not a
   measurement; re-measure from the catalog rather than quoting a number from this map
   (`.claude/rules/` and CLAUDE.md § graphify carry the binding form of this).
6. **One home per fact** (ADR 0186). What a *unit* did belongs to its hub
   (`docs/features/<code>.md`) and its record (`docs/progress/<code>.md`). What the *surface is*
   belongs here. When those two disagree, the catalog settles it and both get fixed.
7. **A domain seam has TWO layers, and only the top one is replaceable** (ADR 0198). Above the
   frozen slices sits a `## Current state` block — the projection a reader opens: five fixed
   sections (**Surface · Invariants · Rollout · Open edges · Where the detail lives**), a
   `**Updated:** YYYY-MM-DD` stamp, and a line ratchet. ⛔ You **REPLACE** that block; you never
   append to it, and you never move a line of history up into it. Rule 1 is untouched: the slices
   below it stay frozen, and a correction to one of them is still an APPEND with a forward marker.
   The block carries no dates, no unit codes and no figures of its own — a figure lives in the
   generated registry that owns it, or it names the query that produces it. **A new phase appends
   its slice AND re-stamps the block**; gate 16 check I reds when a heading below is newer than the
   stamp above. A file exempt from all this must declare itself `⚙ **GENERATED FILE**` (naming its
   rebuild command and its gate) or `⛔ **ARCHIVE**` (naming its live successor) — and the gate
   prints every exemption on every run, because an exemption nobody sees is not an exemption.
   **How to write or refresh one: § Writing and refreshing a current-state block, below.**
8. **Deployment status is NOT state, and does not belong in this map** (ADR 0198 D5). Whether a
   migration reached the remote is a claim about an EXTERNAL system: it is true for an instant and
   rots in silence, which is how `NOT PUSHED` / `LOCAL ONLY` came to be frozen into sections dated
   months ago. Those frozen claims STAY — they are dated statements about a moment, which is what
   history is for — but a `## Current state` block may not carry one, and gate 16 check H reds on
   both polarities. Measure it instead, with the recipes in
   [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).
9. **An invariant of the LAYER is stated HERE, never inside a block.** Rules 7 and 8 hold for every
   seam, so a block that restates them spends its ratchet on text that is already true and already
   gated. ⛔ Measured 2026-09-09, before this rule existed: the rule-8 disclaimer sat verbatim in
   **7 of 11** blocks and the maintenance stamp's prose in **10 of 11** — roughly 7 prose lines per
   block, against a 100-line cap that 7 blocks were sitting 1 line under. That is how a cap starts
   cutting **bounds instead of paraphrase**, which rule 4 of § The four rules a gate CANNOT enforce
   exists to prevent. A block carries what is true of THIS seam; what is true of EVERY seam lives in
   this file. `--scaffold` is the one home for the shape and no longer emits either copy.

## Writing and refreshing a current-state block

_The WHAT is maintenance rule 7. This is the HOW, and it is the only procedure — if it disagrees with
anything, this section and the gate are wrong together or not at all, because both read the same
constants._

**⛔ Never hand-copy the shape from a neighbouring file.** Print it:

```bash
node scripts/check-backend-state.mjs --scaffold
```

That emits the canonical empty block from `SEAM_STATE_SECTIONS` — the same constant checks G and H
read — with one line of guidance per section. Rename a section in the script and the scaffold renames
itself. A markdown template file would be a second copy of the shape, and a second copy drifts: that
is exactly what D6 says about the preamble and why the ADR index is generated. The self-test asserts
that what `--scaffold` prints passes G, H and I, so it can never hand you a red.

### When you must touch it

| Trigger | What you do |
| --- | --- |
| A phase adds an RPC, flips a flag, changes an RLS surface, or otherwise changes this seam | **Append your slice below AND replace the block above**, re-stamping `**Updated:**`. Check I reds if a heading below is newer than the stamp. |
| You post a `⚠ **Superseded**` correction to a frozen slice | Replace the block too — a correction means the projection above it was describing the superseded fact. |
| You read the block and it is wrong | **Fix it in place.** This is the one layer in this directory you may edit freely. |
| You are adding a new seam file | Scaffold a block into it, route it in the table above, and give it a digit-free noun for a name. |

### The four rules a gate CANNOT enforce

Gate 16 proves a block EXISTS, is SHAPED, is AXIS-FREE and is NOT STALE. ⛔ **It cannot prove the block
is TRUE** — a wrong sentence in a well-formed block passes every check. These four are on you:

1. **Never invert a qualifier.** The block is a paraphrase of frozen text, and a paraphrase can invert
   the sentence it summarises. "NO authenticated INSERT policy" is not "INSERT is restricted"; "not
   reachable" is not "protected"; "OFF — seed forces ON local/E2E" is not "ON". Read the SENTENCE,
   never a summary of it.
2. **Write from the frozen text, and know which sentence each bullet came from.** A bullet you cannot
   point at a source sentence for is a bullet you invented — delete it. Later slices supersede earlier
   ones; ⚠ some seam files are ordered NEWEST FIRST, so resolve conflicts **by date, never by
   position**.
3. **State no figures of your own.** A count belongs to the generated registry that owns it, or it
   carries the query that produces it (rule 5). A number retyped into prose is a second copy with no
   gate, which is the defect the four `generated-*.md` files exist to retire.
4. **Cut paraphrase, never a bound.** If the block is over the ratchet, remove restatement and replace
   it with a pointer — the detail is directly below in the same file. ⛔ If a bullet cannot be
   shortened without losing a negation, an "only", an exception or a scope bound, **delete the whole
   bullet** and leave the reader the pointer. Compressing to fit a cap selects against qualifiers, and
   a maimed bullet reads more confident than the original.

### When the gate reds

| Finding | What it means, and the fix |
| --- | --- |
| **[G]** missing / not first / unstamped / wrong sections | Scaffold it. `## Current state` is the FIRST `##`: a reader must not scroll past history to reach the state. |
| **[G]** over the ratchet | ⛔ Do NOT raise the ratchet — it may only be LOWERED. Apply rule 4 above. |
| **[H]** a `⚠ **Superseded**` marker inside the block | You appended where you should have replaced. Delete the stale sentence and write the true one; markers belong to the frozen slices, which may not be edited. |
| **[H]** a deployment verdict | Maintenance rule 8. Name the measurement, never the result. |
| **[H]** a date | A dated line IS a slice whatever it is called. Move it below. ⚠ In § Where the detail lives a date is allowed on a line that actually CITES (carries a `§` or a link), because a frozen heading's own name may carry one. |
| **[I]** stamp older than a heading below | A phase appended a slice and did not refresh the projection — the moment this layer starts rotting. REPLACE the block and re-stamp it. |
| **[J]** an exemption naming no proof | Only two kinds are exempt: `⚙ **GENERATED FILE**` (name its rebuild command AND its gate) and `⛔ **ARCHIVE**` (name its live successor). Anything else owes a block. |

⛔ **Where the block goes, exactly:** immediately BEFORE the first frozen `##`, after any intro prose
the file already carries. The block ENDS at the next `##`, so putting it directly under the preamble
in a file with intro prose silently pulls that prose into a region documented as replaceable — and the
next person to replace the block deletes it. This happened; it was found by diffing bytes against
`HEAD`, not by any gate, and no gate can catch it.

## The seam axis, and why it is the seam and not the phase

Eight of these eleven files map to a domain a teammate is assigned to; three
(`conventions`, `data-access`, `authorization-and-audit`) are cross-cutting
because their statements bind every seam. ⚠ This read *"Seven of these eleven … four"* until
2026-09-09, counting `stamp-history` among the cross-cutting four — 7 + 4 = 11 while the directory
actually held **12** files. Removing the archive is what made the sentence's arithmetic true. A file here is *meant* to answer **"what is true about this part of the backend"**. A phase
answers "what changed on this date" — and that question already has two homes, the unit hub and the
unit record. Adding a third is the drift this directory exists to retire.

⚠ **The axis was the FILING, not the CONTENT — measured at the split (`e4ac95e5`):** of the 67
`##` sections here, **57 (85%) were date-stamped or unit-coded slices**, and **7 of the 11 seam
files carried no axis-free "what is true now" section at all**. What the split bought was that you
replayed one seam's slices instead of all 53 interleaved — a bounded log, not a state document.
Reproduce that figure, and the current one, with `node scripts/measure-state-layer.mjs [ref]`; ⚠ its
classifier is a fitted heuristic that prints its own workings under `--verbose`, so audit the listing
before quoting a new number.

**ADR 0198 closed that gap by adding a layer rather than by rewriting history** (rule 7). Every domain
seam now opens with a replaceable `## Current state` projection, and the slices below it are
untouched. ⛔ What this does NOT do: it does not make the slices shorter, it does not resolve their
supersessions for you, and it cannot make the projection TRUE — gate 16 checks that the block exists,
is shaped, is axis-free and is not stale, and a wrong sentence in a well-formed block passes every
check. Read the projection to orient; drop into the frozen sections, or into the live catalog, before
you rely on anything.

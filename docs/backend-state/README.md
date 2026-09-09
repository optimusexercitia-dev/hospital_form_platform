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
| [`printing.md`](printing.md) | touch PDF printing, print series, prévia vs emission, or the case dossier |
| [`privacy-and-dsr.md`](privacy-and-dsr.md) | touch LGPD subject requests, erasure, or PHI disposal |
| [`meetings-and-governance.md`](meetings-and-governance.md) | touch meetings, audio→ata, charters, cadence, or accreditation standards |
| [`notifications.md`](notifications.md) | touch notifications or action items |
| [`data-access.md`](data-access.md) | look up an RPC, a helper function, a feature flag, or the `src/lib/queries/` module that owns a query (Rule 9) |
| [`stamp-history.md`](stamp-history.md) | need the **pre-split** edit history of the old single-file map |

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

## The seam axis, and why it is the seam and not the phase

Seven of these eleven files map to a domain a teammate is assigned to; four
(`conventions`, `data-access`, `authorization-and-audit`, `stamp-history`) are cross-cutting
because their statements bind every seam. A file here is *meant* to answer **"what is true about this part of the backend"**. A phase
answers "what changed on this date" — and that question already has two homes, the unit hub and the
unit record. Adding a third is the drift this directory exists to retire.

⚠ **The axis is the FILING, not yet the CONTENT — measured 2026-09-09, at the split:** of the 67
`##` sections here, **57 (85%) are still date-stamped or unit-coded slices**, and **7 of the 11
seam files carry no axis-free "what is true now" section at all**. What the split bought is that
you now replay one seam's slices instead of all 53 interleaved. ⛔ Do not arrive here expecting a
state document; expect a bounded log that is becoming one, as D5 corrections replace slices.
Recorded so the router does not read as a promise the directory has not kept (QA m13).

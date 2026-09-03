# The `npm run lint` gates — why each one exists

> **Rotated verbatim out of CLAUDE.md §8 on 2026-08-29**, links repointed (the transform was
> verified by its own inverse). CLAUDE.md is loaded by every session and every teammate spawn and
> was at **40,791 of its 40,960-byte cap** — 169 bytes — so it could no longer absorb a
> correction. §8 keeps the chain and the rules; this file keeps the rationale.
>
> ⛔ **`package.json` is the authority on WHAT the chain runs, not this file and not §8.** Each
> gate below was added after the class it gates shipped a live defect.
>
> ⚠ **Nothing gates this file.** `lint:rules` covers `.claude/rules/`, `lint:progress` link-checks
> `docs/progress/` — neither reaches here. If a gate is added, removed or re-scoped, this file can
> go stale with nothing able to contradict it. Re-derive from `package.json` and the script
> headers (every one carries its own, 1.5–5 KB each) before trusting a claim below.

  - `lint:css-vars` (`check-tailwind-css-vars.mjs`) — the Tailwind-v4 bare `[--var]` form, which
    compiles to dead CSS; added after it shipped nine dead motion utilities.
  - `lint:memberships-door` (`check-memberships-door.mjs`) — direct `memberships` reads that
    bypass the `has_role` doors.
  - `lint:client-server-imports` (`check-client-server-imports.mjs`) — a client value-import from
    a server query module, which **aborts `next build`** while tsc/lint/vitest stay green.
  - `lint:vacuous` (`check-vacuous-assertions.mjs`) — a test that can go GREEN having asserted
    nothing. Record: [docs/reviews/vacuous-assertion-audit.md](reviews/vacuous-assertion-audit.md).
  - `lint:set-local` (`check-migration-set-local.mjs`) — a top-level `set local` in a migration,
    which is a **silent no-op** outside a transaction (Postgres warns `25P01` and continues) and so
    passes every local gate; where it wraps a data-dependent backfill a fresh reset matches zero rows
    and hides it. Bounded by a **watermark, not an allowlist** — ⛔ **the watermark grandfathers the 12
    pre-existing files and must NOT be bumped on a `db push`**, or it grandfathers the files you just
    wrote and flips the rot direction from stricter to weaker. Rationale + the 3-layer positive
    control: the script header and `FUP-DM5-SETLOCAL-MIGRATION`.
  - `lint:progress` (`check-progress-doc.mjs`) — the PROGRESS.md live-state contract (§7): size,
    no completed rows, link integrity, LF — plus, since ADR
    0140: **CLAUDE.md's 40 KB cap** (never raised to pass; rotate content out instead) and a
    **registry-free link sweep of all `docs/progress/`** (new files covered on creation). ⭐ **Since
    ADR 0179 the follow-up half checks the REGISTER, not an index.** `docs/progress/follow-ups-open.md`
    is self-indexing — one entry carries severity, id, title, owner and body together — so the old
    two-way index↔body cross-check (and the resolved-body residue check that rode on it) is **gone
    with its subject**, replaced by: (a) no RESOLVED entry left in the register, (b) no duplicate id
    within it, (c) no id held by both the register and `follow-ups-archive.md`, (d) a **warning** when
    an id is in both the register and `deferred-backlog.md`, and (e) PROGRESS.md § Follow-ups must not
    **re-grow** an index — the check that keeps the consolidation from silently un-doing itself. Every
    prior version of that contract lived in prose and each clause was violated while green; the
    script self-red-proves every checker on each run.
  - `lint:rules` (`check-rules-staleness.mjs`) — a `.claude/rules/` rule that has gone stale.
    Standing rules have **no resolution event**, and path-scoped they are **invisible until they
    fire**, so a rule describing a renamed symbol loads and is believed forever with nothing able
    to contradict it. Keystone: **a rule whose own `paths:` glob matches zero files is orphaned.**
    Every rule must also declare checkable `anchors:` — which makes "can this be shown stale?" a
    precondition for admitting a rule. ⚠ Anchors cap what is **admissible**, NOT how many rules
    accumulate, and path-scoping bounds **when** a rule loads, not **how many** load together —
    so volume has its own bounds: ≤ 40 files matched per rule (waivable only by declaring
    `broad: <reason>`), ≤ 2 KB per rule, ≤ 12 rules. The first population had one rule matching
    **659** files; it was retired (ADR 0127 Amdt 1).
    ⚠ Bounded, stated: DB anchors (`prosecdef`, ACLs, policies) are **not** checkable in `lint` —
    those belong in pgTAP. Retirement → `docs/progress/rules-archive.md`, never deletion.
  - `lint:adr-index` (`build-adr-index.mjs`) — a stale `docs/decisions/INDEX.md`, a stale
    `<!-- adr-backpointers -->` banner inside an amended ADR, two ADRs sharing a number, or an
    ADR citing a number that has no file. Both artefacts are **generated** (`npm run adr:index`)
    and byte-compared, so neither can drift. What they carry is the **inverse** edge — "0033 was
    amended by 0038" — the one fact an ADR cannot record about itself, being written later, by
    someone else, elsewhere. Measured 2026-08-24 across 136 ADRs: 42 source→target pairs over
    **30 amended ADRs**, only **5** of which had a back-pointer anyone had written by hand; a
    session opening 0033 read a superseded rule with nothing in the file able to contradict it.
    ⚠ **The gate cannot detect a MISSING `Amends:` label** — no gate can, because an undeclared
    amendment leaves no trace; a human checks it at the Record step (lead-playbook §4). A
    **declared-but-malformed** label IS caught: a colon-less `**Amends**` is invisible to the
    parser and now a **blocking** finding — 4 were live when the detector first ran (ADR 0140).
    Gate 9 also reds on a stale proposed-ADR review stamp (`proposed-review.json`, 30-day cadence). ⚠ **Voice
    is direction:** `**Amends:**` claims *this ADR changes another*; `**Amended:**` records that
    *this one was changed* and is deliberately not an edge — conflating them inverts the arrow,
    which it did until fixed. The index also states the **next free ADR number**: take it from
    there, never by eyeballing the directory (two sessions eyeballing it both filed an "ADR 0050").
  - `lint:mojibake` (`check-mojibake.mjs`) — **double-encoded UTF-8**: a tool read a file as
    cp1252 and re-saved it, so `⬛` (`E2 AC 9B`) became `â`+`¬`+`›` — permanently, and it **COMPOUNDS**
    per repeat. The file stays **valid UTF-8**, so there is no bad byte to find. Found **2,059
    lines / 3 files**, all pre-existing, none detectable by any gate. ⛔ Not cosmetic: a grep for
    `✅` misses every affected line, so **recorded work reads as absent**. ⚠ **A pattern match is
    a CANDIDATE, not a finding** — `por quê…` is valid pt-BR of the same shape (2 live in
    `src/components`); the discriminator is that real mojibake **decodes back**. On Windows the
    vector is a shell round-trip (`sed -i`, `>` through a cp1252 console) — edit these files with
    explicit UTF-8. ADR 0143.
  - `lint:service-role-registry` (`check-service-role-registry.mjs`) — the AE1.4 service-role DML
    registry drifting from what the census actually derives. ⚠ **The census alone is not the
    truth**: it detects *member* calls (`client.rpc(…)`), so the free function `callDoor(admin,
    'name', …)` is invisible to it — one placeholder row stood in for **five** real service-role
    door calls, and a registry written to match that number would have greened over all five. The
    gate re-derives those from the TS AST and compares as a **multiset** (one door legitimately
    appears twice), so a deleted duplicate reds even though the count still matches.
  - `lint:authz-vectors` (`gen-authz-matrix-cells.mjs --check`) — the AE4.5 authorization-matrix
    cell enumeration drifting from the axes JSON it is generated from. Same shape as gate 9
    (`build-adr-index.mjs --check`): a generated artifact whose source and output must agree.
    Added because the AE1.3 precedent it copies (`gen-person-scope-vectors.mjs`) has its `--check`
    wired into **no gate at all** — its only drift protection is a vitest sha assertion, and AE4
    Increment 1 ships no vitest twin, so without this gate the generated `.psql` would be
    uncovered entirely. ADR 0172.
    ⚠ **THE TRAP: green here does NOT mean coverage was verified.** `--check` proves the emitted
    `.psql` and coverage JSON match the axes JSON — a *drift* check. The generator also carries
    **coverage arms** ("every catalog permission has a test mapping", "every non-legacy role has an
    approved matrix"), and in AE4 Increment 1 both range over an **empty set**: the catalog holds
    zero permissions and every role is `legacy`. So the arms pass having checked nothing, and the
    reassuring `in sync (N cells, M skipped)` line says nothing about them. The discharge is
    `node scripts/gen-authz-matrix-cells.mjs --self-test`, which feeds synthetic inputs where each
    arm HAS a subject and asserts the gate exits 1 — **it is not part of `--check`**, so run it
    when you change the coverage logic. Its own fourth arm was **vacuous on first writing** (it
    named a condition the constraint rules made unreachable, so it reported NOT CAUGHT) — the
    self-test caught its own bad arm, which is the only reason it is trustworthy now.
    ⚠ The JSON↔database half is **not** this gate's job: `authz.roles` matching the axes file's
    role list is asserted by **pgTAP 401 §12**, because a Node script cannot reach the DB at lint
    time. Neither half alone closes the loop.
  - `lint:registers` (`check-docs-registers.mjs` + `build-features-index.mjs --check`) — the
    **ADR 0185** documentation registers: feature hubs (`docs/features/`), `CURRENT.md`, `BUGS.md`,
    `LESSONS.md`, postmortems, the follow-up register's **fields**, the handoff convention (24 KB ·
    live branch · no inbound citations) and `docs/INDEX.md`'s coverage of `docs/`. Added because
    **every register in this tree that lacked a gate rotted** (ADR 0124 / 0127 / 0140 / 0179 each
    record one), and 0185 adds five. Its admission rule is the gate's reason to exist: no register
    or field ships without a check that can red on it; a claim no gate reads is labeled
    `prose only` where it stands. Self-tests every checker against a bad AND a good fixture on
    every run — a checker that cannot red aborts (exit 2).
    ⚠ **THE TRAP: this gate checks PRESENCE and RESOLUTION, not truth.** It knows a
    `Closes when` exists, not that it is right; that an `Enforced by:` path exists, not that the
    file asserts the rule it is attached to; that a Current-state block has six sections and a
    recent `Updated` date, not that it is honest. `PO to rule` is a legal value and is COUNTED as
    a warning on every run — an invented value is invisible to it. Truth is a review question.
    ⚠ **`CODE_WATERMARK` (2026-09-04) grandfathers the 72 / 123 legacy id prefixes** — the same
    shape as `lint:set-local`'s watermark, with the same rule: never bump it to pass.

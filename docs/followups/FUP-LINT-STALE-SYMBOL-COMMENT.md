# FUP-LINT-STALE-SYMBOL-COMMENT — propose a 6th lint gate: a comment naming an identifier that no longer exists (owner: lead + PO; a gate change is not a mid-phase edit)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-13 · status parked

Filed 2026-08-13 during DM3. Every one of the five gates in `npm run lint` was added **after**
its class shipped a live defect (CLAUDE.md §8). This class qualifies twice over: **~6 instances
in DM3 alone**, plus 4 historically, **one of which shipped a live bug**.

**The class.** A deletion strands every comment that referenced it, and **no gate sees any of
them** — not typecheck, not eslint, not the four custom gates. Worst DM3 specimen:
`supersedeDocument`'s doc comment telling the frontend to upload *"via `addDocumentVersion`"* —
**a deleted verb, named in the documentation of a verb the frontend actively calls**. Others:
a page header claiming the storage SELECT policy carried the approver arm (false since M5 —
different provenance, a *migration* rather than a deletion, same class), and a module header
still advertising the signed-URL byte path M5 deleted.

⚠ **The design tension that must be resolved BEFORE the gate is built — raised by `frontend`,
ruled by the lead 2026-08-13.** Four comments in `src/app` + `src/components` deliberately
name a dead symbol **as dead** ("`reviseChangesRequestedDocument` is gone"), which a naive
implementation would flag as false positives:

- `…/documentos/novo/page.tsx:40` · `…/nova-versao/page.tsx:27` · `…/revisar/page.tsx:33` ·
  `components/controlled-documents/add-version-form.tsx:52`

**RULING: tombstones are legitimate and stay.** A reader who remembers `supersedeAndSubmitDocument`
and finds **silence** concludes they are in the wrong file; one who finds *"it is gone, and here
is what replaced it"* is served. Deleting that information to satisfy a gate would make the
codebase worse in order to make a check pass — the gate exists to serve the reader, not the
reverse.

**Therefore the gate's spec must include a machine-checkable tombstone convention** (an explicit
marker token adjacent to the symbol, e.g. `@removed`), so a deliberate tombstone is
distinguishable from a stale claim **without natural-language guessing**. Settle the exact token
when the gate is built. ⛔ **Do not churn the sites now** for a gate that does not yet exist — a
mid-phase rewrite for a hypothetical checker is cost with no coverage.

**The tombstone population is SEVEN, and how it was established is the lesson.** Three
successive lists (backend 6, frontend 3, lead 4) were each short, and **none was careless** —
each was bounded by a different *unstated enumeration key*: "comments my deletion broke" / "the
composite verbs" / "verbs + the RPC". `frontend` finally derived it **by construction** — the
removal set from `git diff 5310358..HEAD -- src/lib` ∪ the `drop function|policy|column`
statements in the DM3 migrations (**12 symbols**), swept across `src/app` + `src/components`:
`novo/page.tsx:40` · `nova-versao/page.tsx:27` · `revisar/page.tsx:33` ·
`add-version-form.tsx:52` · `version-compare-modal.tsx:23` ·
`documentos-pendentes/[documentId]/page.tsx:43` · `src/components/controlled-documents/open-controlled-version-button.tsx:20`.
**A population is only well-defined once its key is stated**, and recall is keyed to whatever
you were last looking at ([[enumeration-boundary-is-a-syntax-not-a-property]], three times in
one thread).

### ⛔ The gate CANNOT be keyed on identifier names — three live families prove it

Lead sweep of all 12 removed symbols, 2026-08-13. Every hit below is **live, correct code** that
a name-keyed gate would flag, and where the tempting "fix" edits a subsystem the rule has no
business touching:

1. ⭐ **`uploadDocumentFile` is simultaneously REMOVED and LIVE.** DM3 deleted a *private*
   `async function uploadDocumentFile` from `src/lib/controlled-documents/actions.ts`, while
   **`src/lib/documents/upload-client.ts:13` exports a live one** — imported and called by
   `add-version-form.tsx:12,144`, `create-wizard.tsx:27,436` and
   `documents/document-upload-dialog.tsx:18,216`. **This is decisive: a bare identifier is not a
   key at all**, independent of scoping-by-family. A name-keyed gate would flag three live call
   sites of a live function.
2. **printed-documents (ADR 0104, retires DM5/Wave D)** — ✅ **RESOLVED by DM5·S3, corrected here
   2026-08-17 (QA r3 MINOR-13).** `src/app/api/documents/[id]/route.ts` now calls
   `.from(row.storage_bucket)` — **the bucket comes FROM THE DOOR** (D7/D12: a print's bytes are a
   `file_objects` row in `documents-standard`/`-phi`, resolved through
   `app.resolve_document_version_bytes`), and the file says so in a comment. There is no bucket
   literal in it. ⚠ This line was reported closed **twice** while open (r2, r3) — *the small item
   reported closed repeatedly is itself the finding.* Was: `.download(row.storage_path)`, downloading
   from the **`printed-documents`** bucket. A
   different table's column that DM3 never dropped, under a URL that *reads* in-scope. Plan §1.2
   named this exact hazard (two families sharing the `document` noun) and §1.3 warns the route's
   URL is misleading while its body is not.
3. **form-assets (ratified permanently separate, ADR 0114 D13)** — `storage_path` in
   `components/forms/block-card.tsx:91,478` · `block-list.tsx:53` · `item-editor-dialog.tsx:281` ·
   `read-only-blocks.tsx:52`.

**Spec consequences (binding on whoever builds it):** resolve each symbol to its **owning module
and family**, never its name; and the first dry-run must run against a **hand-classified
control** containing all three families above as known-goods — *a detector that finds a lot needs
proving too* ([[a-detector-that-finds-a-lot-needs-proving-too]]).

### 🔻 LEAD RECOMMENDATION 2026-08-13: **do NOT build the gate.** Adopt the convention; keep the process step

Four findings, in order of how much they cost the idea:

1. **The same identifier holds THREE truth values inside ONE file.** Verified in
   `src/lib/controlled-documents/actions.ts`: **`:119`** tombstone · **`:309` LIVE and
   correct** (it names the live export *and its module*, `@/lib/documents/upload-client`) ·
   **`:693`** tombstone. So **file scoping fails too**, not just name-keying. Classification
   must be **per-occurrence**, and `:309` is separable from `:119` only by **adjacent prose** —
   natural-language disambiguation, not resolution. It is also the occurrence a gate most needs
   to get right: flagging it invites deleting the sentence that tells the next reader where the
   live helper lives.
2. **Module resolution reaches only 3 of the 7 tombstones (43%).** Sites 1–3 are TS module
   bindings; site 4 names a **Postgres function + column**, site 5 a **TS property** (`hasFile`
   — never a module binding), sites 6–7 a **Postgres policy**. The misses need two *further*
   resolvers: a type-level property resolver and a catalog lookup.
3. **The DB arm needs a RUNNING DATABASE, and that is not negotiable.** The standing rule is
   that the **live catalog is the sole truth** for any schema/RLS/RPC question — never migration
   text, which is stale by design (runtime `pg_get_functiondef()` + `replace()` + `execute`), and
   which has already produced a confident **false P0** here. So the arm must query `pg_proc` /
   `pg_policies`. All five current `npm run lint` gates are **stateless static checks that run in
   a fresh worktree with no stack up**; a DB-dependent arm changes what the lint gate *is*, and
   the shared-stack constraint makes it worse.
4. ⚠ **The proposed convention-only gate does NOT work as specified**, and the error is
   instructive. `frontend` suggested checking that *"mentions of removal-set symbols carry the
   marker"*, arguing it would leave `actions.ts:309` alone *"because a live reference wouldn't
   carry the marker."* That exemption is **inverted**: `uploadDocumentFile` **is** in the removal
   set, so `:309` mentioning it **without** a marker is precisely what the rule flags. Rescuable
   with per-occurrence suppression — but the authoring burden then lands exactly on the most
   confusing case. **Also fatal to the "it's just a grep" claim:** the rule needs a *removal set*,
   which needs a **diff base** — making it a CI check, not a stateless lint gate.

**Recommendation (PO decides — it is a lint-gate change):** adopt the tombstone marker as an
**authoring convention** (zero cost, helps every reader) and **do not build a checker**. Rely on
the step that actually worked here: **at deletion time, derive the removal set from the diff
(`git diff <base>..HEAD -- src/lib` ∪ the migrations' `drop function|policy|column` statements)
and sweep it.** That is what found all seven; three prior lists built from recall found 6, 3 and
4, each bounded by a different unstated key. **Encode it as a deletion-discipline step, not a
script** — the knowledge lives with whoever removes the symbol, and no resolver reproduces it.

**If the PO still wants a checker**, it must satisfy all of: per-occurrence classification ·
family/module resolution · a catalog arm · a diff base · and a first dry-run against a
**hand-classified control** containing `actions.ts:309`, `api/documents/[id]/route.ts:46` and the
`components/forms/*` hits as **known-goods** — *a detector that finds a lot needs proving too*
([[a-detector-that-finds-a-lot-needs-proving-too]],
[[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

# QA review — the prévia / emission split (ADR 0125 + ADR 0126)

- **Subject:** branch `feat/previa-split-adr-0125-0126`, 17 commits, `f4fdfd5d~1..b91e06a2`.
- **Reviewer:** `qa`. Read-only on application code, migrations, specs and queries.
- **Date:** 2026-08-18.
- **Method:** every schema / RLS / RPC / ACL claim below was taken from the **live
  catalog** (`pg_proc` incl. `prosecdef` and `proacl`, `pg_trigger`, `pg_indexes`,
  `pg_constraint`, `information_schema`). No migration text was read as truth. No
  database mutation was performed — the local stack is shared and owned by the lead.
  Two findings were surfaced by delegated sweeps and **re-measured by me in the
  subject file before being recorded**; one sweep claim was discarded as false on
  re-measurement and is not carried here.

## Verdict: **CHANGES REQUESTED**

Two blocking items. Both are of the shape the build's own review lens names — *a
keystone proves the DOOR works and says nothing about whether the ACTION can reach
it* — and neither is visible to any currently green gate.

Everything else in this build is of unusually high quality, and the "verified" section
below is deliberately long, because a short one would misrepresent the ratio.

---

## BLOCKING

### B1 — The prévia route enforces D1 with a WATERMARK check where the discriminator is the LOCK. A locked `in_signature` ata is served a self-disclaiming ephemeral page.

**Requirement violated:** ADR 0125 **D1** (*"A source that is **locked** yields a
**registered emission** … The user never chooses which"*) and **D5** (*"the fourth
must not become reachable — a prévia of a locked source would be a page the platform
disclaims while its source is immutable"*). **Architecture Rule 1** — RLS/DB is the
boundary, never UI hiding.

**Measured:**

- `src/app/api/previa/[kind]/[id]/route.ts` — the whole file. It never calls
  `printSourceRegisters`, and imports nothing that does.
- `public.log_document_previa` (read from `pg_proc`): its only authority term is
  `if not app.can_view_printed_document(...) then raise 42501`. **No registration
  term.** The DB door does not backstop the route.
- The only thing standing between the route and a locked source is
  `src/lib/pdf/provenance.ts:73` — `if (watermark !== 'draft') throw`.
- `src/lib/pdf/documents/meeting.ts:32` — `meetingWatermarkFor` returns `'draft'` for
  every status except `signed | distributed`, **including `in_signature`**.

⇒ `GET /api/previa/meeting/<id of an in_signature meeting>` succeeds. It returns a PDF
carrying `PRÉVIA — sem valor de registro, não verificável.` for a source that, by D1's
own ⭐ correction, **registers** — an ata circulating for signature, undeletable from
that moment, and the artifact the committee is being asked to attest to. The affordance
is derived correctly in the UI
(`…/meetings/[meetingId]/page.tsx:314` — `registers={printSourceRegisters("meeting", meetingPrintState)}`)
and nowhere else. The URL is a stable pattern over the meeting id already in the page
URL, so "the user never chooses" holds only for users who do not type.

**Why the fourth-cell keystone did not catch it.** It could not: the keystone is a
property of the *pair of predicates*, and this is a property of a *caller*. D5's stated
mechanism — *a locked source always registers, therefore a prévia is never of a locked
source, therefore never FINAL* — is enforced **nowhere in the code**. The fourth cell
stays unreachable today only because for meetings `FINAL ⊂ REGISTERING`, i.e. by a
**different mechanism than the one written down**. That is the fifth
right-conclusion-wrong-mechanism instance in this ADR pair (0125 Am. 1 §A, §B; 0126 D9's
constant-true fiat; 0126 Am. 1 §C were the first four) — and the first one in shipped
code rather than in prose.

**Coverage:** none. No test in the tree requests `/api/previa/meeting/...`; the only
references anywhere are `e2e/pdf-printing.spec.ts:406` and `:417`, both `form_response`
and both href-only. `form_response` happens to be protected — its two axes re-coincide
under 0125 Amendment 2, so a registering response has `watermark === 'final'` and the
provenance guard refuses it. That protection is the *exploited* coincidence the ADRs
twice say must be *recorded, not exploited* (0125 D8, 0126 D7).

**Asked for:** a registration check on the ephemeral path that reads the **lock**, not
the watermark, and that lives where an ADR 0079 arm can see it — the natural home is
`public.log_document_previa`, which is already `prosecdef`, already on the delivery
precondition path, and already resolves the source state it would need. A route-level
check alone repeats the pattern. Whatever the placement, the refusal needs its own
keystone with the `in_signature` meeting as the positive case, since that is the one
state where the two axes separate.

### B2 — `app.print_source_head`'s `form_response` arm is satisfied by a constant `true`. Neither lane has a not-head assertion anywhere.

**Requirement violated:** ADR 0126 **Consequences** — *"⛔ Currency needs its own
keystones, and they must be two-sided. A predicate stubbed to 'always current' passes
every not-current test that only asserts the negative … **Both directions, per
conjunct**."* Also ADR 0126 **D8** and **Amendment 1 §A**, the ruling that defines the
arm.

**Measured** (catalog body of `app.print_source_head`, and `grep` over the whole test
tree):

- The `form_response` arm is the entire expression
  `not exists (select 1 from public.responses succ where succ.supersedes_id = p_source_id and (<phase-bound: successor's correction request is 'approved'> or <standalone: succ.case_phase_id is null and succ.status = 'submitted'>))`.
  That expression **is** D8 plus the PO-ruled Amendment 1 §A extension.
- `print_source_head('form_response', …)` appears **exactly once** in the entire test
  tree: `supabase/tests/344_print_source_derivations.sql:229`, expecting **`true`** (a
  chainless submitted response is trivially head). Every other call site — `344:248`,
  `:254`, `313:500`, `:552`, `346:106` — is `'meeting'`, and `344:261` is the
  `bogus_kind` fail-closed.
- `app.printed_document_is_current` is called **six times** in pgTAP, all in `346`
  (`:88`, `:91`, `:109`, `:130`, `:143`, `:155`), and **every one is a meeting print**
  (`p_disp`, `p_rev0`, `p_rev1`).
- E2E `pdf-printing-case-currency.spec.ts` *does* exercise form_response currency
  two-sided with an un-voided sibling — but through the **void** corridor, which is the
  **first** conjunct (`registers`). Head is untouched. The only head coverage in the
  build is the meeting revision corridor (`pdf-printing-meetings.spec.ts:744-803`,
  `313` t55–t58r, `344` t10).

⇒ **A stub returning `true` for the form_response head arm passes pgTAP (6514), vitest
(1439) and the full E2E suite (20/20).** Both directions are absent, for both lanes.

**Why this is the conjunct that matters.** ADR 0126 D2 row 3 — *"R2 approved, nobody
has minted revision 2 → not current"* — is the only row the second conjunct exists for,
and it is the exact scenario commit `5a432d08` was written to fix (the hard-coded
`isCurrent: true`). That fix shipped **with no test that would red if it were reverted
in the predicate rather than at the call site**. Separately, Amendment 1 §A's standalone
lane — a design extension authored *during this build*, whose stated rationale is the
anti-flapping property that an `in_progress` standalone successor must **not** cost head
— has zero coverage in either direction.

**Where the unearned pass is filed.** `supabase/tests/mutation/authz-unswept-backlog.txt`
classifies `app.print_source_head` as a discharged `helper:` on the basis *"Pinned by 344
(fail-closed + the synthetic revision differential) and by 313 t55–t58r … Drilled:
meeting revision compare → constant-true → RED."* Read strictly it claims nothing false —
every named pin is a meeting pin. Read as a discharge, it certifies an arm that no
assertion can distinguish from `return true`. The `helper:` contract in that same file
requires *"its BEHAVIOUR is pinned by a named suite, and that pin has been DRILLED"*;
for this arm, half the behaviour is not.

**Asked for:** two-sided head assertions for `form_response`, per lane —
(a) phase-bound: a successor whose correction request is `approved` costs head; one
whose request is still pending does **not** (D8's named public-disclosure hazard);
(b) standalone: a `submitted` successor costs head, an `in_progress` one does not.
The fixture is close to free — `312:1097-1098` already builds a standalone `submitted`
successor with `supersedes_id` set and `case_phase_id` null, with prints on both rows.
Then compose at least one of them through `app.printed_document_is_current` so the
form_response path of the currency door is executed in pgTAP at all.

---

## NON-BLOCKING — should fix

### C1 — The reserved verb DOES appear on an unregistered surface, on the composed panel

`src/components/printing/printed-documents-panel.tsx:69-79`. The `<h2>` **"Documentos
emitidos"** and the subhead **"Cada emissão gera um PDF permanente, verificável pelo QR
code impresso."** render **unconditionally**, and `PreviaLink` is the `registers === false`
branch immediately beneath them. So on a still-editable source the only action offered
sits under a sentence affirming that printing here produces a permanent, QR-verifiable
PDF — contradicted two lines lower by `PREVIA_HELPER_COPY` (*"não é registrada, não
recebe código de verificação"*). This is D5's own named failure: *"Keeping `Emitido`
while dropping the QR would let the page claim in words what the missing QR denies."*
The heading predates the split; only the action slot was made conditional.

The rule is otherwise honoured everywhere I checked, and — verified — the build renamed
**nothing** in the *other* sense of the verb: `git diff f4fdfd5d~1..HEAD -- src/ | grep -E '^-.*emit'`
returns zero lines, so `Emitir decisão`, `Emitir notificação`, `emitir resultado` and
`Órgão emissor` are untouched.

**The sweep gap is the more durable half.** Four reserved-verb sweeps exist
(`previa-link.test.tsx:36`, `previa-footer.test.ts:76`, `fingerprint.test.ts:447`,
`previa.test.ts:181`), each with a proper positive control. Their scan sets are: the
link rendered **in isolation**, the footer fragment, the rendered PDF prose, and one
error string. **None reads a composed `PrintedDocumentsSection`, and there is no panel
test.** E2E asserts the heading is *visible* on that page
(`pdf-printing-meetings.spec.ts:81`). A sweep bounded by the wrong set is the finding,
not the string.

### C2 — Stale probe/vector counts in comments — §J's class, polarity flipped

The 440-probe sweep is real: `ALL_KINDS` (5) × `ALL_STATUSES` (11) × 2³ = 440, derived
from `src/lib/pdf-mint/print-source-vectors.test.ts:223-254`. But
`src/lib/pdf/provenance.ts:61` still says *"the 220-probe sweep"*, and
`print-source-vectors.test.ts:217/:219` still say *"220 cases"* / *"14 hand-chosen
rows"* (there are **20**). Last cycle the comment led the code; now the code led and
three comments were left behind. Nothing asserts `440` — the only cardinality pin
(`:327`) is `ALL_KINDS.length * ALL_STATUSES.length * 8`, both sides of which move
together. The **dimensionality** guard is genuinely sound (see verified list); it is the
**width** that rests on nothing but the reachability consequence.

Also: the offender label at `:266` formats `c=`/`v=` and omits `d=`, so a
disposal-tandem offender would report indistinguishably from a non-disposal one — in the
very function §J was written about.

### C3 — `find()` in the sync-guard suite is blind to `meeting_disposed`; three lookups are ambiguous

`src/lib/queries/print-source-vectors.test.ts:131-138` matches on `kind`, `status`,
`correction_open`, `phase_voided` — **not** `meeting_disposed`. Verified against the
fixture: `find('meeting','in_signature')` matches **both** vector 8 (plain,
`registers:true`) and vector 13 (`meeting_disposed:true`, `registers:false`), and
resolves to 8 only by array order; same ambiguity for `meeting/signed` and
`meeting/distributed`. The assertions are correct today. A fixture **reorder** — which
the byte-hash guard re-blesses without complaint, since the hash moves and is
regenerated — silently retargets *"an in_signature ata registers"* onto the disposed row.
The `⭐ every fixture dimension is MAPPED` guard that catches exactly this exists only in
the sibling `pdf-mint` suite; this file has no equivalent, and it also lacks the
sibling's `vectors.length > 0` anchor.

### C4 — Two comments that went stale inside this build

- `src/components/verification/verification-result.tsx:58` — *"OPTIONAL because the
  lookup door does not return currency yet"*. Measured: `public.lookup_printed_document`
  now returns `is_current` in its `TABLE(...)` signature, and
  `verificar/[token]/page.tsx` passes the derived currency. 0126 Am. 1 §K's *"interim
  posture … not the finished state"* is also superseded — the verdict **is** wired.
- `src/app/api/previa/[kind]/[id]/route.ts:95-99` — claims a fourth-cell divergence
  *"surfaces as a 500 rather than being swallowed into a 404"*. It does not: the throw
  originates in `documentProvenance`, called inside `buildFormResponsePayload` /
  `buildMeetingPayload`, both **inside the `try`**; the `catch` returns 404 for
  everything except `PREVIA_BUSY_MESSAGE`. A phase-blocking divergence would be silent
  and indistinguishable from "source not found".

### C5 — `346` t11 pins the no-join property textually

`supabase/tests/346_print_currency.sql:162-168` proves the `revoked` arm exists and
returns null by regexing `pg_proc.prosrc`. There is no fixture in which a revoked
print's source row is genuinely absent. Defensible — the FK `RESTRICT` chain makes that
state hard to construct — but it is a text assertion about code in a codebase whose
standing rule is that text is not truth, and it is the weakest pin in an otherwise
exemplary file. Worth recording rather than fixing now.

---

## Verified — measured, not taken on trust

**Schema and guards (live catalog).**
`printed_documents.source_series_id` and `source_revision` both **NOT NULL** (a nullable
series would have voided the partial unique index, since NULLs are distinct). The
one-active index moved exactly as D1 specifies:
`CREATE UNIQUE INDEX printed_documents_one_active ON public.printed_documents USING btree (source_kind, source_series_id, template_key) WHERE (status = 'active')`.
`guard_supersession_coherent_trg` is narrowed to **`BEFORE INSERT`** (D1 obligation 2,
the safe branch). `guard_supersedes_id_frozen_trg` is `BEFORE UPDATE OF supersedes_id`
(HC0DT). `guard_meeting_active_print_trg` is `BEFORE DELETE ON public.meetings` (HC0DQ),
and its predicate is `status in ('active','superseded')` — byte-for-byte the response
guard's, so the two kinds cannot drift.

**D3 — nothing stamps currency.** Swept every `app`/`public` function for a write to
`printed_documents`: exactly two, `mint_printed_document` and `revoke_printed_document`.
The sole trigger on the table is `trg_guard_printed_document_binding`, BEFORE INSERT. No
reversal door writes registry state. **D9 — one revision writer:** swept every function
for an assignment to `revision`; only `public.reopen_meeting` writes it
(`app.print_source_head`'s hit is the read `m.revision = coalesce(...)`).

**ACLs diffed from the catalog, not from migration text.** Every function this build
added carries an **explicit** `proacl`; none is NULL (which would default to PUBLIC).
The five new `app.*` (`print_source_registers`, `print_source_watermark`,
`print_source_head`, `print_source_series`, `print_source_revision`,
`printed_document_is_current`, `resolve_print_source_state`, and the two guards) are
`postgres=X/postgres` only. The three new `public.*` (`print_source_state`,
`printed_document_currency`, `log_document_previa`) carry
`postgres, service_role, authenticated`. `lookup_printed_document` carries **no
`authenticated`** — confirming 0126 Amendment 1 §B's correction, and confirming D12
needs no ACL change. Cross-checked against the full NULL-`proacl` census: the
pre-existing `app.*` population is untouched by this build and none of its members is
new.

**D4 / D7 — no temporary storage object anywhere in the prévia path.**
`src/lib/pdf-mint/previa.ts` imports no Supabase client; the route performs no upload
and creates no `file_objects` / `storage.objects` row. Every occurrence of `upload` on
that path is prose describing its absence. The audit row is a **precondition of
delivery** — `log_document_previa` runs after the render and before the stream, and its
failure returns 404 with no bytes.

**Mint door (catalog body).** `SUPERSEDE_ACTIVE` is keyed on `source_series_id` (the
0126 Consequences obligation). The registration predicate is re-evaluated **inside the
mint transaction** (HC0DP), which is the form_response half of the TOCTOU.
Compare-and-mint (HC0DU) compares the caller-supplied `p_source_revision` against
`app.print_source_revision`. The action plumbs it correctly: `payload.sourceRevision`,
observed in `provider.build()` and carried across the render window — with **no source
query in `actions.ts` at all**, so there is no fresher value to reach for. That is the
right fix, not a line at the call site.

**`312` §9/§10 rebuild.** Constructed at table level as D7 required, and the
differentials survived intact: t74 `throws_ok('HC069')` and t76 `lives_ok` on the
**identical DELETE statement by the identical principal**, and the same pairing at
t78/t80 for the double-print case; t73b and t77 anchor that the constructed state
actually exists. Neither a guard that refuses every delete nor one that refuses none
passes the block. Obligation discharged.

**`313`.** All three meeting fixtures advanced `scheduled → held → in_signature` (no
status jump, correctly placed after the child-row inserts since
`guard_meeting_child_lock` reads no RPC flag), so the ~23 downstream assertions did not
invert. t55–t58r add the real stored `source_revision` two-sided across the reopen
corridor, discharging `344` t9's self-declared synthetic obligation.

**`225` 14a–14e.** D1 obligation 1 satisfied honestly: 14a still pins the
**privilege-escalation** refusal at `42501` on the INSERT path, unchanged; 14b and 14d
remain as its control and flag-off sibling; 14c was **converted** — new two-step
statement, new expected code `HC0DT`, new label saying what it now pins — rather than
having its SQLSTATE silently swapped on an unchanged assertion, which is precisely the
weakening the obligation forbade.

**Fourth-cell sweep.** 440 probes, derived from the code. The structural chain
(*fixture dimensions → `stateOf` keys → probe keys*) is genuinely pinned and fails
closed in all three directions: a new fixture key reds the `toEqual` at `:103`, a key
`stateOf` drops reds at `:119`, a dimension missing from the cross-product reds at
`:297`, and a dimension **present but held constant** reds at `:308` — the "dimension in
name only" case §J names. The invariant is asserted over both the 20 fixture rows and
the 440 probes, each with a populated-cells anchor.

**SQL/TS mirror.** The `.psql` carries a sha256 of the JSON's **raw bytes** and I
verified it matches live. The guard is stronger than the hash alone: the suite also
re-derives each row's emitted SQL string (all three flags plus both outputs) and asserts
the emitted count equals `vectors.length`, closing the "generator drops a column and
hashes clean" hole. The generator refuses an empty fixture. `344` independently pins the
fixture at 20 rows in three places. The `.psql` extension choice is correct and the
reason recorded.

**Authz.** Twelve new `prosecdef` gates, all confirmed from `prosecdef` in the catalog;
none is a `public` INVOKER wrapper in front of an `app` DEFINER body, so `ARM=wrapper`'s
domain is unaffected. The two `UNSUPPORTED` classifications in
`authz-unswept-backlog.txt` **hold on my read**: `printed_document_currency`'s gate is a
WHERE-clause conjunct, which is the correct implementation of per-row filtering (an
unviewable id must be **absent**, not an error) and genuinely outside a statement-level
neutralizer — and its keystone puts a viewable and an unviewable id in the *same array*,
so all-or-nothing cannot pass; `open_printed_document`'s ERROR is a two-gate artifact
where the second gate refuses by raising (ADR 0120 D12), and the suites notice
emphatically with gate 1 open. Both are stronger than the `capa_kpis` precedent they
cite. The `helper:` prefix contract is well specified — **except** as it applies to
`print_source_head` (see B2).

**Also good, and worth naming:** the discriminated `DocumentProvenance` union making the
fourth cell a compile error rather than only a runtime one; `PrintCurrency`'s four arms
(`notApplicable` vs `indeterminate` never sharing a representation, and the adapter
taking `boolean | null` and *not* `| undefined` so an absent field is a tsc error);
sourcing `correction_open` / `phase_voided` from the DEFINER door because the
fail-direction of an RLS-invisible input is **open**; the shared semaphore with a shorter
prévia wait rather than a second pool; and all four pre-existing template fingerprints
unmoved through the refactor, with the prévia variant added as a fifth.

---

## Not filed — carried deliberately, per the build's own record

`FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`, `FUP-42501-CONFLATES-GRANT-WITH-RLS`,
`FUP-SUPERSESSION-BADGE-LANE-BLIND`, `FUP-E2E-SUBMITTED-POOL-UNSCOPED`,
`FUP-LINT-VECTOR-DIMENSION-DRIFT`; and the lock / watermark / series / head declarations
for `case` and `interview`, out of scope by 0126 D7. Also still open and correctly not
inherited: the commission-level cascade path from 0125 Amendment 1 §C.

## Re-review scope

B1 and B2 only, plus whichever of C1–C5 the lead elects to take in the same pass. The
verified section above does not need re-deriving unless a fix touches it — with one
exception: a fix for B1 that lands in `log_document_previa` changes a `prosecdef` gate
and therefore re-arms the diff-scoped door sweep obligation for that door.

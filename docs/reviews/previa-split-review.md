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

## Verdict

| Round | Verdict | Scope |
| ----- | ------- | ----- |
| **r1** (`f4fdfd5d~1..b91e06a2`) | **CHANGES REQUESTED** | B1, B2 blocking; C1–C5 advisory |
| **r2** (`b91e06a2..HEAD`) | ⭐ **APPROVED** | both blockers closed and drilled; see *Second review* |

> The r1 findings below are kept **verbatim** as the record of what was wrong. The
> closing evidence — measured by me, not accepted from the fix report — is in
> **[Second review](#second-review--r2)** at the foot of this document.

## Round 1 verdict: **CHANGES REQUESTED**

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

---
---

# Second review — r2

- **Subject:** `b91e06a2..HEAD` — `29cc1ce0` (panel copy) and `dd4c06ee` (B1 + B2).
- **Method:** same as r1. The door body was re-read from `pg_proc`, not from the
  migration; the flag values from `app.feature_flags` via `app.feature_enabled`; the
  test cardinalities and call-site enumerations by my own greps. Nothing in the fix
  report was accepted on its face. No database mutation performed.

## Verdict: **APPROVED**

Both blockers are closed by construction rather than by assertion, and both fixes are
two-sided in the direction that matters. Five observations follow; **none blocks**, and
I recommend taking O1 and O2 as follow-ups rather than in this branch.

### B1 — CLOSED. The refusal is in the door, and it is the right door.

Measured from `pg_proc`, `public.log_document_previa` now carries, **after** the
`can_view_printed_document` gate and **before** any other work:

```
if app.print_source_registers(p_source_kind, p_source_id) then
  raise exception '…já está travado; emita o documento em vez de gerar uma prévia'
    using errcode = 'HC0DV';
end if;
```

This is the correct placement and the correct predicate, on three counts I checked
rather than assumed:

1. **It reads the LOCK, not the watermark.** That was the whole of B1 — the guard it
   replaces (`documentProvenance`) keys on `watermark !== 'draft'`, which is structurally
   unable to see `in_signature`. D5's stated mechanism is now the *enforced* mechanism.
2. **It is kind-agnostic** — one call to the dispatch, no per-kind site, so
   `mint_printed_document`'s "trio, site 3 of exactly 3" constraint is respected and a
   future kind inherits the refusal without a second decision.
3. **It is genuinely the boundary.** The route logs before it streams; `route.ts:124-131`
   returns on `auditError` before the `Response` is constructed, so a raise means no
   bytes leave. Architecture Rule 1 is satisfied at the DB, not in the UI. I verified
   `renderPreviaPdf` and `log_document_previa` have **exactly one caller each**
   (`route.ts:100` and `route.ts:119`), so there is no second path around the door.

**The keystone is non-vacuous by construction, which is better than by control.**
`346` t19 asserts `throws_ok(…, 'HC0DV')` for an `in_signature` ata. Because the door
checks `can_view` *first*, t19 can only pass if the probe principal genuinely **can**
view that meeting — a caller who could not would receive `42501` and the assertion would
fail. The authority premise is therefore pinned by the assertion's own SQLSTATE rather
than needing a separate control. t20 is the differential the lead correctly identified as
load-bearing: a `held` ata still receives its prévia, so a door refusing *everything*
cannot pass — which would have silently deleted D2's protected interest.

**The `345` relocation weakens nothing** — I checked this specifically, since a fixture
moved to satisfy a new refusal is exactly where coverage quietly leaves. The file's two
premises both survive and both still discriminate: t3 (allow-leg premise) still asserts
the creator **can** view, now for an `in_progress` draft; t4 remains the deny leg's
non-vacuity control (same-commission plain staff **cannot** view). I confirmed from the
catalog that `can_view_printed_document`'s `form_response` arm admits
`created_by = p_uid` **unconditionally, at any status** — so the allow leg is real for a
draft and the relocation did not trade a passing assertion for a vacuous one. The suite's
subject is the audit + authority of the ephemeral path, and an `in_progress` response is
now the only source that path legitimately serves; the old `submitted` fixture would have
tested the ephemeral door against a source it must refuse.

### B2 — CLOSED. Four assertions, and all five stub shapes red.

`346` t21–t24, verified against the catalog body of `app.print_source_head`:

| # | Lane | Successor state | head | Kills the stub |
| - | ---- | --------------- | ---- | -------------- |
| t21 | standalone | `in_progress` | `true` | constant-false; chain-tip semantics |
| t22 | standalone | `submitted` | `false` | constant-true; phase-bound-arm-only |
| t23 | phase-bound | `submitted`, request `under_review` | `true` | constant-false; chain-tip semantics |
| t24 | phase-bound | request `approved` | `false` | constant-true; standalone-arm-only |

Each pair is a true differential — same predecessor, same call, **one input changed** —
which is the t76/t80 shape the ADR asks for. The two lanes are cleanly isolated: the
standalone successor carries `case_phase_id` null and no correction request, and the
phase-bound successor carries a non-null `case_phase_id`, so neither arm can satisfy the
other's assertions. t23 therefore does double duty as a cross-lane leak check — it fails
if the standalone arm ever starts firing on a phase-bound successor.

Amendment 1 §A's ratified rule is pinned in the direction its rationale rests on: t21 is
the anti-flapping property (*"a merely in_progress successor does NOT exclude the
predecessor"*), which is the reason §A reused `app.submitted_form_responses`' existing
effectiveness rule rather than inventing one. D2 row 3 now has a regression test, and the
`isCurrent: true` defect can no longer be reintroduced in the predicate without reds.

**The fixture construction is honest** — table-level inserts with the RPC flags set
explicitly around each guarded write, and the session claims cleared first with the
reason recorded (the `guard_supersession_coherent` standalone arm reads `auth.uid()` and
would have refused the fixture on an authority check it never meant to exercise).

**The backlog correction is the part I would keep.** The entry now names both arms, both
lanes and both directions, and it **leaves the wrong claim visible** with a `⚠⚠ CORRECTED`
marker instead of quietly rewriting it. That matters more than the coverage: a discharge
record that has been seen to be wrong once is read differently forever after.

### The three r1 brief corrections — all closed

- **C1 (verb leak):** `printedDocumentsIntroCopy(registers)` splits the sentence; the
  non-registering branch names no cause and is pinned against five cause-regexes. The
  heading staying in both branches is **correct** and I endorse the reasoning now written
  beside it — it labels the list, and the list can legitimately be non-empty for a source
  that no longer registers. `panel-copy.test.ts` is the right shape: it asserts on the
  **composed panel** (the surface no primitive sweep reads), strips comments before
  matching, anchors that the stripper left real code behind, carries a positive control
  proving the needle matches *somewhere*, and pins that the two branches differ so a
  constant cannot satisfy the negatives.
- **C2 (§J inverted):** `expect(ALL_PROBES.length).toBe(440)` as a literal beside the
  product form. The literal catches a widened space; the product form catches a `flatMap`
  that silently drops an axis. That is the right pair, and the prose that used to carry
  the number is gone.
- **C4 (§K comment):** rewritten, and the rewrite is better than the correction I asked
  for — it found that the prop's *optionality* was still right while its *justification*
  had expired, and now names absent-at-the-boundary as a third state distinct from both
  `notApplicable` and `indeterminate`.

## Is there a FOURTH instance? — the question asked

I looked specifically at the caller relationships the two fixes created:
`log_document_previa → app.print_source_registers`, `PrintedDocumentsSection →
printedDocumentsIntroCopy(props.registers)`, and `346`'s new table-level response chains.

**No fourth instance of the caller/door class.** The one structural check that could have
produced one — a second path into the prévia render that bypasses the new door — is
closed: both `renderPreviaPdf` and `log_document_previa` have exactly one caller, and the
catalog shows `app.print_source_registers` is now called by exactly four functions
(`print_source_watermark`, `mint_printed_document`, `printed_document_is_current`,
`log_document_previa`), each of which gates before calling it.

But the new edge does create **one cross-door asymmetry worth writing down**, which is
the nearest thing to a fourth instance and is of an adjacent class:

### O1 — HC0DV assumes the mint is reachable whenever `registers` is true. Its preconditions are a strict subset of the mint's.

Measured: `log_document_previa` asserts **`document_printing`** only.
`mint_printed_document` asserts **`document_printing` AND `documents_wave_d`** — two
independent rows in `app.feature_flags` (both `true` today; I read them).

⇒ In the configuration `document_printing = true, documents_wave_d = false`, a **locked**
source has **no paper at all**: the prévia raises `HC0DV` (*"emita o documento em vez de
gerar uma prévia"* — advice the platform cannot honour) and the mint raises `HC0D7`.
Before B1 the prévia was available in that state.

This is not the caller/door class; it is *a refusal added to door A on the premise that
door B is available, without checking that B's preconditions are a superset of A's.* It
requires a deliberate flag state that is not the deployed one, and turning off the
document-substrate kill switch arguably *should* stop all printing — which is why I grade
it an **observation, not a defect**. It is worth recording because the failure mode is
silent and the error message actively misdirects: an incident responder who disables
wave D loses the accreditation surface (*"show me the minutes circulated on the 12th"*)
with a message telling them to use the door that is off.

### O2 — the refusal fires AFTER the render, so a locked source burns a Gotenberg permit per request

Route order is unchanged and correct for D3 (`resolve → render → LOG → stream`), but
`HC0DV` is raised at the LOG step. A locked source therefore renders a full PDF through
the sidecar — one of `MINT_CONCURRENCY = 3` permits, seconds of work — and then 404s, on
every request, repeatably by URL. That is in tension with the purpose D9 gives the
semaphore (bounding the sidecar). Splitting the door into a check and a log would fix it
but creates a second site for one rule, which this module explicitly forbids; I have no
clean recommendation, so I record it rather than prescribe. Low severity — the caller
must already be authorized to view the source.

### O3 — C5 is still open, and the new refusal now flows through it

`route.ts:95-99` still claims a fourth-cell divergence *"surfaces as a 500 rather than
being swallowed into a 404"*. It does not — the throw is inside the `try` and the `catch`
returns 404 for everything but the busy message. The fix widened what this collapse hides:
`HC0DV` now also becomes an indistinguishable *"Registro não encontrado"*. Fail-closed and
no-oracle, so not a defect — but the comment is now wrong about two paths instead of one.

### O4 — a residual stale number in the paragraph that was just de-staled

`print-source-vectors.test.ts:224` still reads *"a statement about those 14"*; the fixture
has **20** vectors (measured). The sentence immediately above it had its *"220 cases"* and
*"14 hand-chosen rows"* corrected in `dd4c06ee`; this third occurrence, in the same
paragraph, survived. Textbook *a partial fix reads as a complete one* — the direction was
corrected, one magnitude left behind in the adjacent clause. Trivial to fix, worth naming
because of where it happened.

### O5 — one copy edge in the new non-registering sentence

*"As anteriores continuam válidas e verificáveis"* is true of `active` and `superseded`
prints and false of a **revoked** one. Mitigated in place — each row states its own
`ANULADO`, and the currency chip states currency separately per D4 — so the composed
surface is not misleading. Noted only because the sentence asserts a property of a class
whose members can individually contradict it, which is the §K shape at low stakes.

## Gate state at r2

Re-measured by the lead and consistent with what I read: pgTAP **197 files / 6520 PASS**
(the +6 matching t19–t24 exactly), four ARMs holding, twelve `prosecdef` gates
catalog-confirmed, seven lint gates, `tsc`, vitest **1447**, E2E 20/20. The B1 fix
changed a `prosecdef` door, and the diff-scoped sweep obligation that created was
discharged — `log_document_previa` was already in the swept set and the registers-guard
neutralization drill was run against `346` with a restore verified to the exact digest.

## Recommendation

**APPROVED** — proceed to human approval. O1 and O4 are worth follow-up lines; O2, O3 and
O5 are records rather than work. None of the five is a reason to hold the branch.

# Phase PDF·P2 — QA Review

**APPROVED (r2)** — BLOCKER-1 closed and independently re-proven by constructing the
exploit class on live data; MAJOR-1 closed by the PO's Package A ruling (A8); all 7 MINORs
closed. See [§ Round 2](#round-2--verification-of-the-package-a-fix-wave). The r1 review below
is left intact as the baseline the fix wave was measured against.

*r1 verdict was:* **CHANGES REQUESTED**

One BLOCKER (an authorization widening on the new meeting arm, verified behaviourally against
the live catalog) and one MAJOR that needs a PO ruling rather than a code change. **The
phase's own binding question — "did P2 touch anything outside provider + template + arm +
tests?" — is answered YES, it held.** The scope discipline is genuinely good; the blocker is
not a scope leak but a gap in what the P1 abstraction is *able to express*, surfaced by the
first kind whose source content is masked per caller.

**Phase:** PDF·P2 — PDF document printing, Meetings (ata)
**Reviewer:** `qa` · **Date:** 2026-08-08 · **Branch:** `feat/pdf-p2-meetings` (P1 on `main` at `9373ce8`)
**Scope:** `git diff main...HEAD` — `d5947dd` (contracts) · `475b0d8` (arm + pgTAP) ·
`ff26d0e` (provider + template) · `5510bd3` (UI wiring) · `2e8ef7f` (BUG-PDF2-001 copy) ·
`fd9db9f` (E2E) + progress commits. 20 files, +1778/−38.
**Contract:** ADR [0104](../decisions/0104-pdf-document-printing-module.md) D1–D15 + Amendments
A1–A6 · [plan](../plans/pdf-document-printing.md) §3 · the two lead rulings in PROGRESS
§ PDF·P2 · [phase-PDF-P1-review.md](./phase-PDF-P1-review.md) as the baseline.

---

## Methodology

Catalog-first, as in P1: every authorization claim below was resolved from `pg_proc` /
`pg_policies` / `pg_get_functiondef` / column ACLs, never from migration text or a commit
message. The property-diff claim was checked against **my own P1-recorded baseline values**
rather than against this phase's report. The two lead rulings were re-derived independently
(I re-counted the door's kind-conditional sites from the live body). The blocker was
established by **behavioural probes on live seed data**, not by reading.

Re-run during review: `npm run lint` (exit 0) · `npx tsc --noEmit` (exit 0) · PDF unit tests
(**22 pass**) · `npx vitest run src/lib/pdf/fingerprint.test.ts` (10 pass). Migrations: 321
applied, `20260914000000` at head. Per instruction the big suites were not re-run; the
recorded evidence (pgTAP 174f/5486, drills D8/D1/D2/D5 RED-proven, diff-scoped `ARM=policy`
COVERED 0 BLIND, census+floor HOLD, e2e:prod 0/1030) stands.

---

## The binding question: did P2 stay inside provider + template + arm + tests?

**Yes.** I classified all 20 changed files:

| File | Classification |
| --- | --- |
| `src/lib/meetings/pdf-payload.ts` (new) | **provider** ✅ |
| `src/lib/pdf/documents/meeting.ts` (new) | **template** ✅ |
| `supabase/migrations/20260914000000_pdf_p2_meeting_arm.sql` | **arm** ✅ |
| `supabase/tests/313_…` (new), `312_…`, `e2e/*`, `fingerprint.test.ts`, `template-fingerprints.ts`, `scripts/smoke/*` | **tests** ✅ |
| `src/lib/pdf-mint/providers.ts` | **provider registration** — +6 lines, one map entry ✅ |
| `src/lib/pdf/render.ts` | +12 lines: one import, one `TEMPLATES` entry, one `switch` case. The switch has **no `default`**, so a new kind that forgets its template is a *compile error* — this is the sanctioned shape, not a leak ✅ |
| `src/lib/pdf/types.ts` | **purely additive** — four new interfaces + the union widening `DocumentBody = FormResponseDocumentBody \| MeetingDocumentBody`. No existing P1 type modified, no envelope field changed ✅ |
| `src/lib/queries/printed-documents.ts` | +31: `getMeetingPrintContext`, additive, mirroring P1's two-step exactly. Rule 9 requires it to live here ✅ |
| `src/components/printing/{labels,mint-document-button,printed-documents-panel}.tsx` | **ruling 2** (BUG-PDF2-001) — verified copy-only below ✅ |
| `src/app/…/meetings/[meetingId]/page.tsx` | **the one genuinely discretionary file** — see below ✅ |
| `PROGRESS.md`, `docs/reviews/authz-door-audit-findings.md` | records ✅ |

**Ruling 1 (the door's per-kind sites) — SATISFIED. I re-counted from the live body, not from
the in-code markers** (markers are prose; prose is not truth):

1. **Template coherence** — `if p_source_kind = 'form_response' and p_template_key <> …` plus
   `if p_source_kind = 'meeting' and p_template_key <> …`
2. **Commission resolution** — one `if … elsif` chain

Every other appearance of `p_source_kind` in the door is a pass-through argument
(`can_view_printed_document(p_source_kind, …)`), a column comparison
(`where source_kind = p_source_kind`), or an insert/audit value — **not** a kind-conditional.
So: **2 semantic sites, no third.** Reported honestly, the *statement* count is 3 (`if`,
`if`, `if/elsif`), because coherence grew by a whole new statement rather than a row — see
INFO-2, which is a recommendation, not a violation.

**Ruling 2 (BUG-PDF2-001 is copy-only) — SATISFIED.** The diff is exclusively literal→function
substitution: `WATERMARK_COPY {mark, why}` → `WATERMARK_MARK {mark}` + `watermarkReasonCopy(kind, flag)`;
the dialog description, the supersession sentence's noun phrase, and the panel's two empty/error
strings all move to `labels.ts` helpers. **No prop-shape change** — `sourceKind` was already a
prop on both components (it already fed `listPrintedDocuments(sourceKind, sourceId)` and the
mint input). `labels.ts`'s five new exports are pure string functions whose only import is
`import type`. The single structural edit is a JSX line-rewrap introducing `{" "}`. Copy-only,
confirmed.

**The meetings page** (+48) is the one file the plan's four words don't name. It is a
mechanical composition: one import trio, one entry added to an existing `Promise.all`, and one
JSX block reusing `PrintedDocumentsSection` **with no signature change**. It is also
*necessary* — without it the kind is unreachable. I count it in scope, and I'd note for the
record that the plan's "provider + template + arm + tests" formula is incomplete by one term:
**a new kind also needs its mint surface.** Recommend adding "+ its source screen's mint
surface" to §4/§5 so P3/P4 aren't judged against a formula that was never achievable.

**No pipeline surgery was required.** The P1 abstraction absorbed a second kind cleanly. That
is the claim §3 asked P2 to prove, and it is proven — with the one qualification that the
abstraction has no *slot* for a per-caller content tier, which is BLOCKER-1.

---

## Security / RLS

### Property diff vs the P1 baseline — CLEAN

Both re-emitted functions were checked property-by-property against the values I recorded in
the P1 review, per the "a REBUILD silently loses properties the original carried" rule:

| function | `prosecdef` | `proacl` | `proconfig` |
| --- | --- | --- | --- |
| `app.can_view_printed_document` | `t` (unchanged) | `{postgres=X,authenticated=X,service_role=X}` (**identical**) | `{search_path=app, public, pg_catalog}` (**identical**) |
| `public.mint_printed_document` | `t` (unchanged) | `{postgres=X,service_role=X,authenticated=X}` (**identical**) | (**identical**) |

`open_`, `revoke_` and `lookup_` were not touched and re-verify unchanged; `lookup_` is still
service_role-only. Nothing was lost in the re-emit.

### The dispatch — delegation is genuine, and it fails closed

The `meeting` arm is **pure delegation**, one line: `return app.can_reach_meeting(p_source_id, p_uid)`.
`app.can_reach_meeting` is `STABLE SECURITY DEFINER`, `search_path` hardened to `''`
(fully-qualified throughout), and takes an **explicit `p_uid`** — it never calls `auth.uid()`
internally, so it is not an invoker trap. ✅

One precision on the brief's wording: `case` and `interview` are **not** literal-false arms —
they have no arm at all and fall to the fail-closed `ELSE`. That is *stronger* than literal
arms (a kind whose arm is forgotten fails shut rather than depending on someone remembering to
write `return false`), and it matches P1's shape.

**I probed the NULL-propagation path rather than reasoning about it**, because a NULL return
would be a fail-*open*: the mint door's guard is `if not app.can_view_printed_document(...) then raise`,
and `not NULL` is NULL, so an `IF NULL THEN` skips the raise entirely. Result:

```
app.can_reach_meeting('…00ff', chefe.ccih)              → f      (is null: f)
app.can_view_printed_document('meeting','…00ff', …)     → f      (is null: f)
```

A nonexistent meeting resolves a null commission and returns **false, not NULL**. The arm's
comment is catalog-true and the fail-open does not exist.

### The no-admin-arm delta — verified behaviourally on live data

This is the phase's sharpest deliberate decision and it holds. On seed data, with
`orgadmin.a@test.local` (a genuine org_admin — `is_commission_admin_of_for` returns **true**
for the CCIH commission):

| probe | result |
| --- | --- |
| `can_view_printed_document('meeting', <CCIH meeting>, orgadmin.a)` | **f** |
| `can_view_printed_document('form_response', <CCIH submitted>, orgadmin.a)` | **t** |
| `is_commission_admin_of_for(<CCIH>, orgadmin.a)` | **t** |
| `can_view_printed_document('meeting', <CCIH meeting>, chefe.ccih)` (member) | **t** |

The denial is provably *because the meeting arm has no admin term*, not because the persona
lacks authority — the same persona passes the form arm in the same breath, and a member passes
the meeting arm. That is the wrong-arm-fixture trap closed at the behavioural level. The
module correctly declines to grant sight the meetings domain does not grant.

### The mint door's meeting branches

Both are mechanical: coherence (`template_key` must be `'meeting'`) and commission resolution
(`v_commission := app.commission_of_meeting(p_source_id)`). `commission_of_meeting` is a
one-line DEFINER lookup. Authority still precedes both. ✅

---

## BLOCKER

### BLOCKER-1 — the ata freezes the MINTER's content tier and re-serves it under a strictly coarser predicate, defeating the per-caller masking the meetings domain enforces at the column-grant level

**Requirement violated:** ADR 0104 **D11**, its most load-bearing sentence — *"the module never
grants sight of anything; it inherits every right from the source domain and adds rights only
over its own artifacts"* — and D11's Download row, *"Same predicate, evaluated at download
time."* The predicate is inherited at the *meeting-visibility* level but not at the *content*
level, and for meetings those are two different things.

**The mechanism, every step catalog-verified:**

1. Agenda free text is **not readable directly at all**. `information_schema.column_privileges`
   for `authenticated` on `meeting_agenda_items` grants SELECT on exactly
   `{created_at, created_by, id, meeting_id, position, updated_at}` — **`title`,
   `description`, `discussion_notes` and `resolution` have INSERT/UPDATE/REFERENCES but NO
   SELECT.** The column-list GRANT is the boundary; the DEFINER door is the only read path.
   (This is what makes the finding real rather than cosmetic — the masking is not a UI nicety.)
2. That sole read path masks **per caller**. `app._project_meeting_agenda_item(r, p_uid)`:
   ```sql
   if exists (select 1 from unnest(v_cases) c where app.is_case_respondent(c, p_uid)) then
     r.title := null;                     -- process number, hidden from a respondent
   end if;
   if exists (select 1 from unnest(v_cases) c
              where not app.has_case_capability(c, p_uid, 'read_case_deliberation')) then
     r.description := null; r.discussion_notes := null; r.resolution := null;
   end if;
   ```
3. The provider reads through exactly that door — `listMeetingAgenda` calls
   `rpc('get_meeting_agenda_items')`, and its own comment says *"title/discussion_notes/resolution
   are REVOKE'd from direct reads; the tiered projection RPC masks them per case authority"*.
   So the PDF bytes contain **the minter's projection**.
4. The artifact is then readable at `can_reach_meeting` = *member AND (commission_default OR
   attendee)* — which contains **no case-capability term and no respondent term**.
   `open_printed_document` re-evaluates the same coarse predicate at download time, so D11's
   defence does not engage.

**Concrete consequence.** A coordinator with `read_case_deliberation` mints the ata. A
commission member who is a **respondent of a linked case** — the exact party
`_project_meeting_agenda_item` exists to blind, and who is plausibly a commission member in
the ethics/discipline context that motivated the masking — passes `can_reach_meeting`, sees
the document listed, downloads it, and reads **his own process number** plus the deliberation
substance about him. The DB refuses him those bytes by column grant; the PDF hands them over.

**Why this is P2's and not inherited.** P1's only kind was `form_response`, which has no
per-caller projection — its content is uniform for everyone who passes the arm, so arm-parity
*was* content-parity. P2 registers the first kind where the domain's real read surface is
finer than any single artifact-visibility predicate. The P1 pipeline has no slot to express
that, which is why this is worth stopping for: **it is precisely the "did the abstraction
leak?" question, answered in the one dimension nobody was looking at.** P3 (Cases) will hit a
harder version of this immediately.

**Not covered by any test.** Neither 312, 313 nor the E2E specs assert that a member *below the
projection tier* is refused the ata — every meeting-arm probe uses personas whose tier is
irrelevant to the assertion. The green bar is honest about what it tested; it simply never
asked this question.

**Remedies (a decision, not a patch — I am not prescribing which).**

- **(a) Narrow the arm.** Make the `meeting` arm conjoin the projection tier — e.g. deny when
  the viewer is a respondent of any linked case or lacks `read_case_deliberation` on all of
  them. Faithful to D11; costs the ata its "everyone at the meeting has the ata" character.
- **(b) Narrow the artifact.** Mint the ata from the *minimum* tier (masked for everyone), and
  offer the unmasked variant only where the whole audience clears it. Keeps distribution wide.
- **(c) Ratify snapshot semantics.** The PO may hold that a signed ata is a formal record whose
  distribution is a governance act, like handing out printed atas in the room. That is a
  legitimate position — but then D11 must be amended to say so, the mint dialog must state
  what the reader is about to distribute, and a keystone must pin the widened behaviour so it
  is a decision rather than an accident.

What it cannot do is ship undecided, with the code silently doing the wider thing while the
ADR promises the narrower.

---

## MAJOR

### MAJOR-1 — the ata prints four columns the catalog classes PHI-BEARING while the payload hardcodes `containsPhi: false`

`src/lib/meetings/pdf-payload.ts:154` sets `containsPhi: false // meetings mint PHI-free only in v1 (ADR 0104 D9)`.
The live catalog disagrees about the content it is printing:

```
meetings.minutes_md                    → "PHI-BEARING free text (WS B; Rule 11/12). …"
meeting_agenda_items.description       → "PHI-BEARING free text (WS B; Rule 11/12). …"
meeting_agenda_items.discussion_notes  → "PHI-BEARING free text (WS B; Rule 11/12). …"
meeting_agenda_items.resolution        → "PHI-BEARING free text (WS B; Rule 11/12). …"
```

All four are rendered by the ata template (`meeting.ts:136` and `:79/:82/:85`). With
`contains_phi = false` the object is stored under the **`std/`** prefix rather than `phi/`
(the door's derived-path CHECK), the **confidentiality band does not render** (D7 says it is
"not suppressible" whenever `contains_phi`), and verification reports a PHI-free document.

**The asymmetry is what makes this worth a ruling rather than a shrug:** I checked whether
this generalizes to P1, and it does not — `answers` and `responses` carry **zero** PHI-BEARING
column comments (26 such columns exist platform-wide; none is on the forms path). So forms
genuinely are PHI-free-by-classification and meetings are not.

ADR 0104 D9 anticipated this exact question and ruled it upstream: *"a PHI-bearing ata first
requires the meetings domain to gain a Rule 12-classed PHI surface via its own ADR."* The
meetings domain's own column classification suggests it already treats this text as
PHI-bearing. Either those four comments overclaim (a caution label on free text), or D9's
premise that meetings mint PHI-free is wrong. **This needs the PO, before human approval** —
the failure direction is patient-identifiable text on paper with no confidentiality band, in
the non-PHI storage prefix. Note also that remedy (b) for BLOCKER-1 and the resolution here
interact: both are about how much the ata is allowed to carry.

*(Mitigating, and worth stating: the underlying read IS Rule 11-audited — `getMeetingDetail`
emits `meeting.viewed` — and the mint emits `document.minted`. Nothing is unlogged.)*

---

## MINOR

**MINOR-1 — the `hospital_admin` half of the no-admin-arm control is unpinned.** 313 t10
(org_admin denied) has its same-persona positive control at t12 (same org_admin passes the
form arm). **t11 (hospital_admin denied) has no counterpart** — nothing asserts `ha_b` holds
commission-admin authority at all, so t11 cannot distinguish "no admin arm" from "this persona
has no authority". I confirmed from the catalog that `ha_b`'s authority *is* real (the
`memberships` scope-shape CHECK is satisfied and `is_commission_admin_of_for`'s hospital
disjunct fires), so this is **unpinned, not wrong** — but an `is_active` default flip or a
membership-shape change would silently convert it into a vacuous pass. One line fixes it:
`is(can_view_printed_document('form_response', resp_sub, ha_b), true)`.

**MINOR-2 — revoke-without-sight is now asymmetric on the meeting arm, and untested in either
direction.** `revoke_printed_document` authorizes on
`is_staff_admin_of_for OR is_commission_admin_of_for`. Probed live:

```
orgadmin.a  CAN SEE the meeting doc?      → f
orgadmin.a  passes REVOKE authority?      → t
```

So an org_admin/hospital_admin can revoke an ata print they are denied sight of (and the same
holds for a `staff_admin` who is not a meeting member). This is **ADR-sanctioned** — D11's
Revoke row explicitly says "`staff_admin` … + admin chain" and revocation reveals no content —
and it is not practically reachable without an out-of-band document id, since the registry
listing denies them. But P1 had no such gap (commission-admin had both sight and revoke on the
form arm), so the meeting arm introduces the asymmetry, and **nothing pins it in either
direction.** Add a keystone for whichever behaviour is intended.

**MINOR-3 — 312 t45's repointed fixture is now type-confused.** t45 moved from `'meeting'` to
`'interview'` as the unhandled-kind probe (correct — meeting now has an arm), but it passes a
**meeting id** as the interview `source_id`. It still reds correctly under the D1 drill (I
traced it: the call falls through to commission resolution, where neither branch matches
`'interview'`, so it raises `HC0D1` rather than the asserted `42501`). But it is no longer a
"visible source, unreadable kind" specimen the way 313's t35 is; it is a nonexistent-entity
probe wearing the other test's clothes. 313 t35 is the load-bearing write-side keystone; t45
is now the weaker duplicate. Repoint it to a real interview at P4.

**MINOR-4 — 313 t30's label asserts something the fixture does not.** The label reads "a
plain-staff **minter** cannot revoke an ata print", but `doc_m2` was minted by `sa_x` at t20;
`st_x` minted `doc_m1`. The assertion (plain staff cannot revoke) is correct and non-vacuous —
only the "minter" claim is false. 312's t30 pins the minter property properly; 313's copy
inherited the wording without the fixture. Given this project's documented history with
comments that go stale silently, worth the one-word fix.

**MINOR-5 — the watermark derivation is duplicated in TSX.** `page.tsx:295-297` computes
`meeting.status === "signed" || meeting.status === "distributed" ? "final" : "draft"` inline,
duplicating `pdf-payload.ts:137`. They agree today and nothing gates the agreement — this is
the one place P2 can drift into the mint dialog previewing a different mark than the renderer
stamps, which is exactly the promise the dialog exists to make. Export one predicate and have
both call it.

**MINOR-6 — fingerprint coverage gaps on the new template.** The meeting variant control is
well built (see below), but neither fixture exercises the empty-agenda
(`meeting.ts:72-74`), empty-attendance (`:99-101`), `quorum: null`, or absent-"Encaminhamentos"
branches — both fixtures populate all of them, so a regression in any moves no fingerprint.
Same class as the P1 MAJOR-2 I raised and this team closed; smaller, because these are
degenerate-state branches rather than the majority path.

**MINOR-7 — two display-map fallbacks would print a raw English enum key onto a permanent
record.** `pdf-payload.ts:160` `STATUS_DISPLAY[detail.status] ?? detail.status` and the
`MODALITY_DISPLAY` twin at `:164` are dead today (both maps are total over their unions), but a
new DB value would put `in_signature` on printed paper — Rule 10, in the one artifact that
cannot be corrected after the fact. Same fix shape as P1's MINOR-9 (`revokeReasonClassLabel`):
a pt-BR fallback, never the identifier.

---

## INFO

**INFO-1 — `meetings_select` and `can_reach_meeting` express one rule twice.** Five child
policies (`meeting_agenda_items`, `meeting_attendees`, `meeting_cases`,
`meeting_closed_sessions`, `meeting_signatures`) route `can_reach_meeting`, but the parent
`meetings_select` **inlines** the equivalent predicate rather than calling it. I diffed them:
semantically identical today. The dispatch's comment is precise (it says "child policy"), so
this is not a stale claim — just a drift surface, since a future edit to `meetings_select`
would not touch the function the PDF module delegates to.

**INFO-2 — the door's coherence site is not intrinsically per-kind.** Both branches encode the
*same* rule: `p_source_kind = 'X' and p_template_key <> 'X'`. That collapses to a single
kind-agnostic `p_template_key <> p_source_kind`, which would take the sanctioned 2 sites down
to 1 and stop the door growing at all. The tradeoff is real and worth naming: the per-kind
form is what allows a future kind to own *several* templates (`meeting_summary` /
`meeting_full`), which a collapsed check forbids. If that flexibility is not wanted, collapsing
now saves two more branches across P3/P4.

**INFO-3 — a small correction to the task framing.** The brief asked me to verify "all four P1
form fingerprints UNMOVED". There are **two** recorded `form_response` hashes (canonical
`e8e01db5…c52f` and variant `final_phi_logo` `871e8761…c304`), plus `version: 1`. I diffed
`template-fingerprints.ts` against `main`: **both hashes and the version are byte-identical**,
and the meeting entry is purely additive. The claim holds; the count was two.

---

## Tests

**313 is a well-built keystone file.** `plan(38)`, 38 contiguous assertions, no gaps. The flag
is **asserted, not enabled** (t1/t2) — the correct discipline that makes a flag-off environment
red loudly instead of silently skipping. Both conjuncts of `can_reach_meeting` are
independently pinned: member+`commission_default` (t6), attendee on `participants_only` (t7),
member **non**-attendee on `participants_only` (t8), foreign-commission staff (t9),
org/hospital admin (t10/t11), platform_admin (t13). Dropping either conjunct reds a different
subset — that is real coverage, not a checklist.

The **case/interview fail-closed keystones assert their own preconditions** (t33: `can_read_case(case_a, sa_x)`
is true; t36: `can_read_interview(iv_a, sa_x)` is true), so the `false` verdict at t34/t37
measures the ARM and not a broken fixture — the wrong-arm trap closed properly. Both
preconditions assert the **function** rather than a row count, which dodges the permissive
sibling on `cases` (`cases_staff_admin_write` is `FOR ALL` and would have satisfied a row
assertion independently of `can_read_case`). Whether by design or by style, it is the right
shape.

Row-count assertions (t25/t26/t27) are sound: `printed_documents` still carries **exactly one**
policy, so the predicate under test is the only path to the row.

**Fingerprint non-vacuity: the P1 pattern was carried over correctly**, which I want to note
because it is the second phase running. The meeting control is bidirectional — the variant is
asserted to render the FINAL chip, the attestation block and *not* the unsigned footer, and
the canonical is asserted to render the unsigned footer and *not* the FINAL chip — with
disjointness proven for all three claimed branches, on **markup forms** rather than bare class
tokens, with the reason stated inline (`.ata-minutes` and `.signature-missing` appear in
`<style>` in every document, so a token-contains would be vacuous). That is the P1 FIX-2
lesson applied unprompted.

Not covered: the BLOCKER-1 scenario (see above), and MINOR-1/2's gaps.

---

## Code quality, UX, hygiene

- **Rule 7 — clean, and proven rather than read.** All 23 payload-string interpolation sites in
  `meeting.ts` are `esc()`-wrapped, including **all four `formatDateTime` call sites** — the
  P1 MINOR-5 lesson (the formatter returns its raw input on an unparseable date) was carried
  forward correctly into the new template. A hostile payload driven through a bundled
  `renderMeetingBody` produced **0 raw `<script>` and 23 escaped** occurrences.
- **Provider — correct.** FINAL ⇔ `signed | distributed` is **total** over the catalog's six
  `meetings_status_check` values, and a hypothetical seventh defaults to `draft` (fails safe).
  The signature filter is an **allowlist** (`status === 'signed' && signedAt !== null`) against
  the catalog's `{signed, declined, revoked}` — so declined and revoked are excluded, and so is
  any future state, by construction. That is the right polarity; a denylist would have been a
  finding.
- **Rule 9 — clean.** The provider has no inline supabase-js: six reads, all through
  `src/lib/queries/`. `getMeetingPrintContext` repeats P1's caller-pre-authorized two-step —
  step 1 reads `meetings` under the caller's own RLS (which routes the same predicate the door
  uses, verified from `pg_policies`), and only then does the service role resolve two display
  names. Ordering is correct.
- **UI gate matches the door.** The mint surface is gated by `access.role !== null` ∧
  `isCommissionMember` ∧ a successful `getMeetingDetail` (which runs under `meetings_select`,
  i.e. the door's own predicate). It is a **subset** of the door: no over-show, no under-show.
  `canRevoke = isCoordinator` is narrower than the revoke door — safe.
- **pt-BR / a11y / typing.** All new user-facing strings are pt-BR (including the provider's
  error, which carries no raw Postgres text). No `any`. The page block is a Server Component;
  no new interactive surface, and the section keeps its `aria-labelledby` landmark.
- **Records.** `docs/reviews/authz-door-audit-findings.md` updated for the re-emitted gate;
  PROGRESS carries the drill counts (D8 11/38 red, D1 6 red both files, D2 8 red, D5 21 red,
  112/112 restored) — a real non-vacuity record with named red counts, not a "0 failures" claim.

---

## Required to clear the gate

1. **BLOCKER-1** — decide and implement one of remedies (a)/(b)/(c). If (c), amend D11, state
   it in the mint dialog, and add the keystone. Either way, add a test that a member below the
   projection tier is refused (or ratified as allowed) the ata download.
2. **MAJOR-1** — PO ruling on the ata's PHI classification, before human approval.

Recommended in the same pass: **MINOR-1** (one-line control), **MINOR-4** (label), **MINOR-5**
(shared watermark predicate). MINOR-2/3/6/7 can ride to P3.

**Everything else in this phase is sound**, and the scope discipline the plan asked P2 to
demonstrate was demonstrated. The blocker is not a failure of the P2 authoring work — it is
the P1 abstraction meeting the first kind it cannot fully describe, which is exactly what §3's
review question was written to surface.

---

*Reviewed by `qa` against the live catalog, 2026-08-08. Read-only on application code,
migrations, specs and queries; this file and the PROGRESS rows are the only artifacts written.*

---

# Round 2 — verification of the Package A fix wave

**Verdict: APPROVED (r2).** BLOCKER-1 closed. MAJOR-1 closed. MINOR-1…7 all closed.
Two new INFO, both forward-looking notes for P3/P4 rather than defects.

**Date:** 2026-08-08 · **Range:** `258e1a0..HEAD` — `f45e75b` (ADR A7/A8/A9) · `7bd5a8e`
(migration `20260914000100` + all 7 MINORs) · `4b4293a` (shared watermark derivation) ·
`1e1d0b5`/`69563cd` (progress + E2E). 16 files, +856/−40. Migrations **322 == 322 files**,
`20260914000100` at head.

**Method.** Re-probed, never read from the report. The centrepiece — whether the new
conjunction actually excludes the party my blocker named — was settled by **constructing the
exploit class myself on live seed data inside a rolled-back transaction**, because the seed
alone contains no persona in that class and a predicate that never fires would have "closed"
the blocker vacuously. Property-diff was taken against my own r1-recorded baseline values.
Re-ran `npm run lint` (exit 0), `npx tsc --noEmit` (exit 0), PDF unit tests (**22 pass**).

## BLOCKER-1 — CLOSED, and proven rather than accepted

**The spec.** ADR 0104 **A7** now states the rule my r1 said had to be decided: for a domain
that masks content per caller, printed-document sight is *source reach **AND** unmasked
full-content sight*, on mint **and** download. It names the two rejected alternatives
(masked-minimum bytes; paper semantics) — so it is remedy (a) from my r1, chosen deliberately.

**The mechanism, verified live.** The dispatch now reads:

```sql
when 'meeting' then
  return app.can_reach_meeting(p_source_id, p_uid)
     and app.can_read_full_meeting_content(p_source_id, p_uid);
```

I diffed the new helper term-by-term against the **live** `_project_meeting_agenda_item`
masking it must mirror:

| masking term | helper term | verdict |
| --- | --- | --- |
| `title := null` if respondent of **any** linked case | `exists(meeting_cases mc where mc.agenda_item_id = ai.id and app.is_case_respondent(mc.case_id, p_uid))` | **mirrors** (slightly stricter — no presence guard; see INFO-r2-1) |
| 3 free-text fields `:= null` unless `read_case_deliberation` on **every** linked case | `(description/discussion_notes/resolution is not null) and exists(… not has_case_capability(…, 'read_case_deliberation'))` | **mirrors**, with a **presence guard** — it declines to refuse when masking would null nothing. Correct, and the more permissive direction only where there is no content at stake |
| `v_cases is null` → no masking | both branches require `exists(meeting_cases …)`, so an unlinked item contributes nothing | **mirrors** |

`SECURITY DEFINER`, `STABLE`, `search_path=''` hardened, **explicit `p_uid`** with no
`auth.uid()` inside — not an invoker trap.

**The proof that it discriminates.** The seed contains no persona with `reach = t` and
`full_sight = f`, so on seed data alone the conjunction adds nothing and t40 could not be
confirmed from outside the test transaction. I therefore built the missing class myself —
inserting the four-row participants chain (`participants` → `professional_profiles` →
`professional_participants` → `case_participants` with the `respondent_doctor` role) to make
`chefe.ccih` — a **full commission member who reaches the meeting** — a respondent of the case
linked to that meeting's agenda item, then rolled back:

| | `respondent` | `reach` | `full_sight` | **arm** |
| --- | --- | --- | --- | --- |
| `chefe.ccih` before | f | **t** | t | **t** |
| `chefe.ccih` as respondent | **t** | **t** | **f** | **f** |

`ROLLBACK` confirmed; nothing persisted. **Reach is unchanged and the arm still flips to
false** — so the denial is the new conjunct, not reach and not the persona. That is exactly
the r1 exploit chain, now closed, and both mint and download route this same dispatch.

**The keystones are non-vacuous and assert their own preconditions**, which is what I asked
for: t39 pins that `is_case_respondent(case_a, st_x2)` is genuinely true (the participants
chain is real, not a name); **t40** asserts the predicate *discriminates* in one `ok()` —
coordinator in, deliberation-masked member out, respondent out; **t42 is the over-grant twin**
— the *same* persona passes on the **un-linked** meeting, ruling out "this persona can't reach
anything". t41/t43 are the two denial arms, t44 keeps the coordinator in, t47/t48 pin the
download and mint sides separately. The fixture change from `commission_default` to
`explicit_grants_only` on `case_a` (to manufacture a genuinely deliberation-masked member) is
self-protecting: t33's precondition would red if it broke `sa_x`'s reach.

## MAJOR-1 — CLOSED

**A8** rules the label **presence-derived and automatic**, explicitly *not* the D9 per-mint
patient-identifier choice (which stays absent for meetings and still needs its own upstream
domain ADR — my r1 point preserved rather than papered over). The provider's derivation covers
every column I cited plus one I had not:

```ts
const containsPhi =
  caseLinks.some((link) => link.agendaItemId !== null) ||   // process number in the title
  detail.minutesMd !== null ||                              // PHI-BEARING
  agenda.some((i) => i.description !== null ||              // PHI-BEARING ×3
                     i.discussionNotes !== null || i.resolution !== null)
```

All four catalog-`PHI-BEARING` columns are covered. t45/t46 pin that a masked-class ata mints
`contains_phi = true` and lands under `phi/`; t50 pins that a clean ata labels false and stays
under `std/`; **t49 pins that `form_response` still refuses `contains_phi = true` (`HC0D2`)** —
my verification item 4, satisfied.

**Worth naming: A8's correctness depends on A7.** Presence-testing is only meaningful because
A7 guarantees the provider now runs *exclusively* for a caller with unmasked sight — otherwise
a masked minter would read nulls and honestly label a PHI-bearing ata as clean. The two
amendments interlock, and the provider comment says so. That is the right reason, not a
coincidence.

## The scope rulings, re-derived

**Ruling 1 superseded correctly.** I re-counted kind-conditional sites from the live door body
myself: **exactly three** — PHI capability (`p_contains_phi and p_source_kind <> 'meeting'`),
template coherence, commission resolution. Every other `p_source_kind` occurrence is a
pass-through argument, a `where source_kind =` column comparison, or an insert/audit value.
The in-file trio marker matches, and A8 records that a **fourth** is now the leak signal.
The PHI gate is shaped as an inverted allowlist (`<> 'meeting'`), so any *unregistered* kind
also refuses `contains_phi` — fails closed.

**Property diff — clean.** Against my own r1-recorded values: `can_view_printed_document` and
`mint_printed_document` both retain `prosecdef = t`, identical `proacl`
(`{postgres,authenticated,service_role}` / `{postgres,service_role,authenticated}`) and
identical `proconfig`. `lookup_` remains service_role-only. The new helper is granted to
`authenticated` (required — the policy path calls it) and is DEFINER with a hardened
`search_path`. Nothing lost across three re-emits now.

**A9** corrects the plan formula to include the mint surface, crediting the r1 framing point,
and the plan §3 text was updated to match.

## MINOR-1…7 — all closed

| # | r1 finding | closure (verified) |
| --- | --- | --- |
| 1 | `hospital_admin` control unpinned | **t51** asserts `is_hospital_admin_of_for(hosp_b, ha_b)` is true — pins the tier directly, which is stronger than the cross-arm form I suggested |
| 2 | revoke-without-sight asymmetry untested | **t52/t53/t54** pin it in **both** directions with the D11 citation: the same `oa_b` cannot OPEN (0 rows) but MAY revoke, and the revocation is attributed to the admin actor. Now a recorded decision, not an accident |
| 3 | t45's type-confused fixture | repointed to a **fresh uuid**, with an honest comment that the ELSE denies before entity resolution and that 313 t37 holds the real-fixture specimen |
| 4 | t30 mislabeled "minter" | label now says "plain-staff **member**"; 312 t30 keeps the minter property |
| 5 | watermark derivation duplicated | `meetingWatermarkFor(status)` exported from the template module; provider **and** dialog both consume it (`4b4293a`) — one derivation, no drift surface |
| 6 | 4 unpinned template branches | `MEETING_FINAL_SIGNED` now also sets `quorum: null`, `agenda: []`, `attendance: []`; the vacuity control asserts all four degenerate branches variant-only **and** their populated counterparts canonical-only, bidirectionally. Variant hash moved as it must; the two `form_response` hashes and the meeting **canonical** hash are untouched |
| 7 | raw enum key could print onto paper | `ENUM_FALLBACK = '—'` at all five sites, **and** `ACTION_STATUS_DISPLAY` retyped from `Record<string, string>` to `Record<MeetingActionItemStatus, string>` so the map is total and the fallback is dead until the union widens. Both halves fixed |

## New in r2 — two forward-looking INFO

**INFO-r2-1 — `can_read_full_meeting_content` is fail-OPEN standalone; only the conjunction
order saves it.** Probed:

```
helper alone, nonexistent meeting  → t     (vacuous `not exists` over zero agenda rows)
can_reach_meeting, same            → f
composed dispatch arm              → f     ✅
```

Correct as composed, because `can_reach_meeting` is the first conjunct. But the helper is a
newly-granted `authenticated`-executable predicate whose *standalone* answer for an unknown or
agenda-less meeting is "yes". P3/P4 must not reuse it without the reach conjunct. Cheap
hardening if wanted: an `exists(meetings where id = p_meeting_id)` guard inside the helper.

**INFO-r2-2 — a comment went stale inside the fix that changed it.**
`template-fingerprints.ts` still describes `final_signed` as pinning the "**quorum line**" —
but MINOR-6's fix set `quorum: null` on that fixture, and the test two files away now asserts
`expect(html).not.toContain('Quórum:')`. The comment asserts the opposite of the assertion.
One line; flagged because this is the project's most-repeated defect class.

## Carried forward unchanged

FUP-PDF-1…4 (P1 deferrals) and BUG-PDF2-002 (pre-existing Phase-10 `notFound`→200, spun off
separately) are unaffected by this wave and remain open against their own owners.

## What the fix wave did well

The wave answered a policy question with a policy ruling first (A7/A8 as ADR amendments naming
their rejected alternatives), then implemented it — rather than patching the symptom. Three
things stand out. **t42** is an over-grant twin nobody asked for, and it is the single
assertion that makes t41 mean what its label says. **t40** pre-empted the exact vacuity check
I had to run manually — the fix wave anticipated that a conjunct which never fires would be a
false close. And **A8's dependence on A7 was reasoned explicitly in the provider comment**,
which is the kind of load-bearing "why" that usually gets lost between two commits.

---

*Round 2 reviewed by `qa` against the live catalog, 2026-08-08 — including a rolled-back
transaction used solely to construct and re-prove the r1 exploit class. Read-only on
application code, migrations, specs and queries; this file and the PROGRESS rows are the only
artifacts written.*

# Follow-ups — live detail (OPEN items)

Full bodies of **open** follow-ups, rotated out of PROGRESS.md 2026-08-08 to keep the
tracker small (CLAUDE.md §7). PROGRESS.md keeps a one-line index (id · severity · title ·
owner) — **update BOTH when an item changes state**. Resolved items move to
[follow-ups-archive.md](./follow-ups-archive.md), same as before; the parked backlog stays
in [deferred-backlog.md](./deferred-backlog.md).

### 🟡 FUP-ETH-A11Y-1 — the ETH·E4 dialogs: error text is never `aria-describedby`-wired, and the typeahead announces neither loading nor result count (QA m3 + m4; owner: frontend + tester)

**m3 — `aria-describedby` never reaches the error id.** `useFieldIds`
(`src/components/ui/field.tsx:103-133`) already emits `descriptionId`, `errorId` and a
composed `aria-describedby`, but every ETH·E4 call site passes only `.controlProps.id` and
hand-sets `aria-invalid`: `add-participant-dialog.tsx` (2 sites) and
`case-participant-role-manager.tsx` (2 sites, one of which wires `descriptionId` but never
`errorId`). `FieldError` carries `role="alert"`, so the message **is** announced when it
first appears — the gap is that a user who tabs **back** to the invalid field hears the label
and nothing else. CLAUDE.md §8 requires accessible inputs.
Fix shape: pass `hasError`/`hasDescription` into `useFieldIds`, spread `controlProps` instead
of picking `.id`, and put `id={errorId}` on `FieldError` / `id={descriptionId}` on
`FieldDescription` (neither auto-wires — both are plain `<p>` pass-throughs).

**m4 — the typeahead popup has no live region.** `add-participant-dialog.tsx:391-407`:
*"Buscando…"*, the empty hint and the result list are plain nodes **outside** the listbox
that `aria-controls` points at, with no `aria-live`/`role="status"`. Only the error path is
announced (it has `role="alert"`). Keyboard operation and the rest of the ARIA structure are
complete and correct.

⚠ **Why this was filed rather than fixed inside ETH·E4 (lead, 2026-08-11).** m4 cannot be
closed without either (a) new visually-hidden text, which risks duplicating the existing
visible strings — `"Nenhum resultado. Você pode cadastrar um novo."` and `"Buscando…"` — into
a second `getByText` match and redding the suite on strict mode, or (b) folding the count into
the listbox's `aria-label`, which is the exact string `pickFromTypeahead` scopes on (QA r2
confirmed the app really does set it). **Either route needs a coordinated spec change, which
is tester-owned**, so doing it as a lead edit at the tail of the gate would have put churn
into the locators this phase had just finished stabilizing. m3 is attribute-only and safe on
its own, but it belongs with m4 as one a11y pass. Both are QA-rated MINOR and non-blocking.

### 🟡 FUP-E2E-SERVER-DEAD-1 — the prod-standalone server dies under load in ~3 of 17 batches, and `BATCH_TESTS=22` is the known rescue (owner: unassigned)

Filed from the ETH·E4 handoff §3, where it was called out but never given an id. In one
`e2e:prod` run, batches **5, 16 and 17 all hit `server_dead=1`**; 5 and 17 recovered on the
automatic `INFRA_RETRY`, **16's retry died too**, leaving 69 tests with no verdict and turning
a run with **zero assertion failures** into a RED gate. The rate is drifting: 1 of 17 earlier
the same day, 3 of 17 by evening.

Known-good workaround, used successfully **twice** on two different dead groups: re-run the
group alone at `BATCH_TESTS=22` (smaller batches ⇒ more frequent server restarts). The
Flexible-Forms group (`ff1`–`ff5` + `flagged-aggregate-result`) stresses it regardless of
batching — its own sub-batches hit `server_dead` and recovered.

**This is an infrastructure characteristic, not a product defect** — no assertion has ever
failed in one of these batches. It is filed because it costs a full gate re-run each time it
bites, and because "infra is not a pass": a batch that never produced a verdict must not be
read as green.
### 🟡 FUP-F2-BUCKETS — the F2 legacy-bucket retirement was deferred in writing, four times, and tracked nowhere (2026-08-11; owner: backend)

F2 consolidated case / meeting / interview attachments into `public.attachments` + the two
tier buckets, and **every writer is rewired** (`meetings/actions.ts:984`,
`interviews/actions.ts:771`, `cases/documents-actions.ts` all go through `bucketForTier`).
The legacy buckets were deliberately left standing to keep the atomic fold-in minimal — a
sound call, recorded in
[f2-attachments-migration-contract.md](../design/f2-attachments-migration-contract.md) §D:326
("retire in a later cleanup migration, post-gate"), repeated in
[phase-14e](../phases/phase-14e-attachment-phi-classification.md):167 and in the
`20260717000300_attachments_foldin.sql` header:20. **The cleanup migration was never
written, and the deferral never became a task** — it lives in two planning docs, one
migration comment, and a retrospective, and in no tracker. Verified 2026-08-11: `grep` over
PROGRESS.md for *legacy bucket / retire / cleanup migration / the three bucket names* → **0
hits**; `f2-attachments.md` § *Open risks / deferred* lists four items, none of them this.

**Live catalog state (2026-08-11, local) — the three are in three different states, and only
the middle one is the finding:**

| Bucket | Policies | State |
| --- | --- | --- |
| `referral-attachments` | `can_manage_referral_target` INSERT · `can_read_referral_phi` SELECT | **NOT legacy** — live referral PHI plane (Phase 22), never in F2's scope. Leave it. |
| `meeting-attachments` | `meeting_attachments_insert_staff_admin` · `meeting_attachments_select_member` (**both live**) | **No writer in the product, two working doors.** Reads gate on bare `is_member_of(seg[1])` — the coarse rule F2 replaced. |
| `interview-attachments` | **none** | Already sealed: its member SELECT was a confirmed PHI exposure ([authz-a0-inventory-review](../reviews/authz-a0-inventory-review.md) §2.1) and was dropped; `236` §③b pins EXCLUDED-member-reads-0, and `u1-mutation-audit.sh` re-creates it as the injected leak. |

⚠ **`meeting-attachments` is named in the two planning docs and NOWHERE else.** The §7.12
exclusion-perimeter analysis ([authz-handoff.md](./authz-handoff.md):572) measured
reachability for `case-documents` + `interview-attachments` and drove the interview drop; it
never covered the meeting bucket, most likely because it was scoped to *case* PHI surfaces
and a meeting attachment is not a case artifact. The attention that closed two of three
skipped the third — **a per-surface sweep is not a sweep**, the recorded rule again.

**A second, separable question — do NOT fold it into the policy drop.** The fold-in is
explicitly *pure DDL, no data migration* ("on a fresh `db reset` all these tables are EMPTY"),
then `drop table … meeting_attachments cascade`. Against a **data-bearing** database that
drops the metadata rows while their blobs stay in the legacy bucket, still reachable through
that live member SELECT. F2 is local-only (remote `db push` deferred to pilot cutover) and
there are no live users pre-launch, so this is very likely a non-issue — but that is an
**assumption about remote state which nothing verifies**, and it is the
backfill-guard shape: passes a 0-row local reset, behaves differently against real data.
**Measure remote object counts before dropping anything** (§7.12's own rule: reachability
measured, never inferred).

Proposed scope, in order:
1. **Measure** — `storage.objects` counts per legacy bucket on the linked remote. Record the
   numbers here; a non-zero `meeting-attachments` turns item 3 into a data decision.
2. **Drop the two `meeting_attachments_*` storage policies** (the actual open door).
3. **Delete the three legacy buckets** — `case-documents` only after confirming the referral
   snapshot reader is off it (that reader is the *separate* open item in
   [f2-attachments.md](./f2-attachments.md) § *Open risks*: `getReferralDocumentUrl` still
   signs from it).
4. **Pin it** — a pgTAP assertion that **no** policy exists on `bucket_id in
   ('meeting-attachments','interview-attachments','case-documents')`, derived from
   `pg_policies` rather than transcribed, so the retirement cannot silently regress. Without
   this, step 2 is a change no gate can see — the same prose-only failure that produced this
   entry.
5. **Close [authz-capability-inventory.md](./authz-capability-inventory.md):358 open question
   #3** ("`interview-attachments` + `case-documents` — in scope, or Stage E?") as answered.

### 🟡 FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend)

Catalog-verified in `app.audit_write`:

```
v_acting_as := app.active_role();
if v_acting_as is not null then
  v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
end if;
```

The key is **absent, not null**. So for the hatless-grantee path — which under ADR 0106 D5/D6
as built retains read-only per-case reach **including `read_standard_phi`** (keystone `319`
A13; the Rule-12 read this platform most needs to reconstruct later) — the trail cannot
distinguish *"no hat was worn"* from *"pre-ACT row"* from *"written by a service-role/system
path"*.

**Not a violation and not blocking:** Rule 11 is met (the row records *that* and *who*;
`acting_as` is an ADR 0106 addition, not a Rule 11 requirement). This is **legibility** —
recording hatlessness explicitly (`'acting_as','none'`, or a `hatless: true` marker) turns an
inference into a fact for a few characters.

⚠ **Travels with the A13 ruling** (ADR 0106 D5/D14, S4 QA §3): if the PO ever rules that
hatless principals must lose relationship-derived reach, this class of row stops existing and
the follow-up dies with it. Do not implement it ahead of that ruling. Needs a migration —
deliberately out of S4, which shipped none.

### 🟡 FUP-PDF-3 — mint/revoke `returns printed_documents` re-exposes withheld columns (QA P1 MINOR-2; owner: backend)

Both doors return the full row type, so a **direct PostgREST caller** receives
`storage_path` + `verification_token` — the two columns deliberately excluded from the
column-list GRANT. Needs a return-shape decision (narrowed composite / explicit column
list on the RETURNS). Context: `storage_path` is derivable from granted columns anyway
(defense-in-depth, not a secret — recorded Note C); **the token is the real widening**.

### 🟡 FUP-PDF-4 — verification rate limiter: comment FIXED, availability lever still OPEN and re-scoped (QA P1 MINOR-3; owner: backend)

⛔ **The filed premise was wrong in a way that mattered, corrected 2026-08-11 against the code.**
The entry said the limiter is *"one **global** 60/min counter"* and prescribed *"per-credential
granularity (keep the global cap as a backstop)"* — **that is already exactly what ships, and
has since the original commit `e1daba9`**: `PER_CREDENTIAL_LIMIT = 5` over a `perCredentialHits`
map, plus the global 60 backstop. Anyone executing the prescription literally would have written
a no-op and closed the item. The lesson is the standing one: **a prescription in a follow-up is a
claim about the code and ages like one** — re-measure before implementing, not after.

**DONE:** the false *"the page shows it verbatim"* comment is corrected. Confirmed against
`src/app/(public)/verificar/[token]/page.tsx:84-90`, which catches **every** error, logs it, and
returns `{ state: "unavailable" }` — so `VERIFICATION_RATE_LIMIT_MESSAGE` is never rendered and
reaches only the server log. (The comment-asserting-an-untruth family, invisible to every gate.)

**STILL OPEN — the availability lever, correctly described:** the per-credential arm bounds
brute-forcing ONE code; it does nothing about the actual DoS. One visitor cycling ~12 distinct
credentials × 5 each exhausts the **global** 60/min budget and throttles *every* anonymous
visitor on the public `/verificar` surface. Both windows are also module-level process memory, so
they are per-PROCESS — N app instances mean N× every budget.

⚠ **Deliberately not fixed in the FUP quick batch, because neither half is guessable:** closing
it needs per-**client** granularity (which needs a *trusted* client identity — `x-forwarded-for`
is only as trustworthy as the proxy in front of it, a Coolify deploy decision, ADR 0059) **plus**
shared cross-process state. Both are decisions, not code. The limitation is now recorded in the
module docblock so the next reader does not re-derive it. The RPC stays service_role-only.

### ⬛ FUP-QOB-3 — RESOLVED 2026-08-09: `dispose_event_phi` KEEPS its tenancy arm, and referral disposal gets the same backstop BACK (PO)

**PO ruling 2026-08-09.** The finding was framed as "event is the odd one out" — investigating it
inverted that: **event was the one that got it right**, and the same-day BUG-QOB-004 cut had gone
one step too far on the referral plane.

**Two facts decided it, neither available when BUG-QOB-004 was ruled:**
1. **A hospital can have ZERO NSP operators.** Measured: `Hospital Unico C` has none, and NSP
   staffing is a separate onboarding step. NSP-only disposal leaves such a hospital unable to
   honour an **LGPD Art. 18 erasure request** — an obligation that sits with the ORGANIZATION
   (the *controlador*), not with a clinical nurse.
2. **This platform already rules the other way for acts of this shape.** ADR 0104 D11 keeps the
   tenancy arm on `revoke_printed_document` because revocation is a **governance act that reveals
   no content** — guarded by pgTAP `314` 8.5. Disposal is identical in shape: it discloses
   nothing, it destroys. D5's "zero PHI bits must not destroy Rule 12 data" guards against
   destroying what you cannot verify; that is a real concern, and it is the same one D11 already
   weighed and answered.

**Executed (`20260917000400`):** the tenancy arm is restored on `dispose_referral_phi` +
`can_dispose_referral_phi`. **`create_referral_draft` stays CUT** and the **UI wall stays** — the
backstop is disposal-only. ⚠ For a BARE tenancy admin the capability is therefore reachable only
out-of-band; that is deliberate and recorded, unlike BUG-QOB-004's accidental orphan. A tenancy
admin who is also a committee member reaches it normally.

**Guarded so it cannot be re-cut by symmetry:** `314` **8.6** (all three disposal doors keep the
arm) + **8.7** (drafting stays cut) + `295` **§7.7** flipped to assert the backstop behaviourally.
Red-proven: re-cutting the arm reds both 7.7 and 8.6 and nothing else.

**Also fixed in the same wave — three stale pt-BR messages, one per direction:**
`dispose_referral_phi` (fixed in `…000000`, re-fixed here), `dispose_case_phi` (**promised** an
org-admin arm QO·B had removed) and `revoke_printed_document` (**hid** the tenancy arm it carries).
⚠ The class: *every* time an arm moved, its sentence stayed. Invisible to every gate in the repo —
no test reads prose — and user-facing in both harmful directions.

Found by the **sibling-coherence check** run immediately after `20260917000000` landed — i.e. by
asking "what do this door's siblings look like now", not by anything in the ruling's own scope.
Measured live (`pg_get_functiondef`), all six disposal doors:

| Door | tenancy arm | PHI module (Rule 12) |
| ---- | ----------- | -------------------- |
| `dispose_case_phi` | ✗ cut (D5) | case |
| `dispose_referral_phi` / `can_dispose_referral_phi` | ✗ cut 2026-08-09 | referral |
| `dispose_attachment_phi` | ✗ none | — |
| **`dispose_event_phi`** | ✅ **LIVE** | **patient-safety / NSP** |
| `dispose_meeting_minutes` | ✅ live | not a PHI module |

**The finding:** D5's ratified reasoning — *"a principal with zero PHI bits does not destroy Rule 12
data"* — is what put `dispose_case_phi` on the CUT side, and it is what the PO applied verbatim to
the referral plane on 2026-08-09. It applies to `dispose_event_phi` **identically**: patient-safety
is PHI module 1, and a bare tenancy admin holds no PHI bits there either. So of the three Rule-12
modules, two now deny the tenancy tier its disposal arm and one still grants it — a split produced
by the order the rulings happened in, not by any decision about NSP.

**Corroborating tell:** `dispose_event_phi` still carries the pt-BR message *"apenas um administrador
da organização ou o NSP pode descartar dados do paciente"* — the exact sentence
`dispose_referral_phi` had to shed in the same wave because the cut made it false. It is currently
still TRUE for `dispose_event_phi`, which is the point: the two doors were written as a pair and have
now diverged.

⚠ **Deliberately NOT acted on.** It is outside the BUG-QOB-004 ruling, and cutting a live capability
unasked is the standing trap in the other direction — *conferring or removing a capability requires
enumerating its consumers*. `dispose_meeting_minutes` is a separate question and probably a genuine
KEEP (meeting minutes are a governance artifact, not one of the three PHI modules) — do not sweep it
in reflexively with the NSP call.

**To close:** a PO ruling on `dispose_event_phi` only — CUT (D5 consistency across all three PHI
modules) or KEEP-with-a-recorded-reason (NSP disposal is genuinely a tenancy-tier duty). Whichever
way, the pt-BR message must end up matching the arms. Owner: **PO**, then backend.

### ▶ FUP-MIN-CUTOVER — audio-minutes pre-enable gates (feature merged, flag OFF)

Owner: lead + human. Before the pilot flag flips (runbook §6 checklist is authoritative):
- [x] **Remote `db push`** — ✅ DONE (discovered already applied; catalog-verified 2026-08-06:
      302/302 migrations incl. AFF `20260909*` + MIN `20260910000100–400`, all 13 MIN functions
      in remote `pg_proc` with expected `prosecdef`, `meeting-audio` bucket cap 524288000).
      The deployed-`main`-breaks warning is closed.
- [ ] **Cloud storage upload cap** — ⛔ **BLOCKED, human decision**: org `Rede Madre` is on the
      **Free plan** (checked 2026-08-06) → 50 MB hard cap; 500 MB needs a **Pro upgrade**, then
      raise the dashboard storage limit and record it in runbook §2 (blocker recorded there).
- [ ] **T5 manual smoke** — plumbing ✅ DONE 2026-08-06: `minute_generator/.env` + platform
      `.env.local` `MINUTES_*` share minted secrets; smoke doc authored
      (`docs/testing/audio-minutes-smoke.md` — was referenced by runbook §6 but never existed);
      §3 webhook probe → 401 ✓; local storage container live-verified at 512 MiB. **Run blocked
      on human**: fill `ANTHROPIC_API_KEY` + `ASSEMBLYAI_API_KEY` in `minute_generator/.env`,
      supply a 1–3 min non-medical pt-BR audio, flip `MINUTES_SERVICE_URL` :8891→:8000 for the
      session (smoke doc has the full recipe).
- [x] **QA r2 residuals R1 + R3** — ✅ fixed 2026-08-06. R1: accessible name is now
      `Anexar a um item: "<resolução>" a "<item>"` — unique per card AND the visible label is
      the prefix (closes the pre-existing WCAG 2.5.3 gap QA's prescribed format would have kept).
      R3: `server-only` reverted on `src/lib/audio-jobs/hmac.ts`; E2E helper imports the real
      `signCallbackBody` (D16 restored); `docs/backend-state.md` updated. MIN spec 10/10 green
      (chromium, fresh reset).
- [ ] **R2** — the ≥8-tests click-delivery anomaly: did NOT reproduce on the 2026-08-06 rerun
      (10/10 first-attempt); still owed one look on different hardware before the pilot.
- [ ] Env vars on the deploy target: `MINUTES_SERVICE_URL/_API_KEY`, `MINUTES_CALLBACK_HMAC_SECRET`,
      `MINUTES_CALLBACK_BASE_URL` (runbook §3) — mint NEW production secrets, never the local
      smoke pair; plus the service itself deployed (`docker-compose.coolify.yml`) with its DPA
      gates closed (runbook §6).

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived →
     docs/progress/follow-ups-archive.md (full snapshot). -->

### 🟢 FUP-QO-6 — oversight-toggle slow-confirm: **annoyance severity ACCEPTED provisionally (PO ruling 2026-08-07)**; open LOW priority, DB-vs-UI formally unclassified

**PO ruling 2026-08-07 (D-FUP-6b):** after 16 total trials with 0 recurrences (15 isolated +
1 full-load gate with a continuous ~12,100-sample out-of-process poller — see the Test Run
Summary row), the stale-UI (annoyance) assumption is **accepted provisionally for the pilot**.
The lost-write question stays formally open at LOW priority; nobody manufactures a
classification. If it recurs, the recorded next step is a targeted 20–30× repeated-trial run
of the D9 test alone under artificial contention with a **sub-second** poller (the ~1.6 s
interval aliases past the flip — proven this run). ⛔ The original "do not fix by raising the
timeout" stands. Original record + diagnostic history below.

<details><summary>Original entry (2026-08-07, pre-ruling)</summary>

### the oversight toggle intermittently fails to confirm within 10 s; DB-vs-UI unclassified

Found by `tester` once its restore check stopped trusting optimistic client state. **Pre-existing —
not introduced by QO·A, and invisible until now BY CONSTRUCTION**: the previous check read
`CommissionOversightToggle`'s optimistic value, which updates synchronously before the server action
starts, so it reported success every time regardless of what the server did. Making the check honest
is what surfaced this.

**Signature (consistent, ~3 failures in ~13 early attempts, ≈23%):** a failing run takes **~11.5 s**
against **~2.5–3.0 s** on a pass — the reload-based assertion burning its full 10 s timeout. So the
confirmation is *not* being read too early; the state genuinely is not observable within the window.

⚠ **The decisive fact is NOT established.** At the moment of failure, is the DB correct with the page
stale, or **did the write never land**? That distinction is the whole severity question: stale UI is a
known annoyance here, but an intermittent write failure means **D9's governance control silently
no-ops ~1 in 4 times** and an admin would believe a committee is under oversight when it is not.

A bounded diagnostic (15 isolated runs + an out-of-process ~1.4 s DB poller, 216 samples) came back
**15/15 PASS — unreproduced**. The only `excluded` readings were the expected mid-test transients of
passing runs. `tester` stopped at the bound rather than extending, and reported the absence of the
fact instead of manufacturing one.

**The streak is itself evidence.** P(0 failures in 15 trials) at a constant 20–25 % rate is ~1.3–3.5 %.
The likeliest reading is that failures **cluster with environmental contention** rather than being
independent per-trial draws — the diagnostic ran isolated and unloaded. Consequence for the gate:
`RETRIES=1` retries moments after the first attempt, i.e. under the *same* conditions, so the naive
~6 % residual-spurious-red figure is an **optimistic floor, not a ceiling**.

⛔ **Do not "fix" this by raising the timeout** — that hides precisely the question above. Next step is
to reproduce under **load** (during a full `e2e:prod` run, not in isolation) with the out-of-process
poller attached, then classify. In-browser instrumentation is useless here: it perturbed the measurement
(6/6 green with logging on, recurrence once removed).

**F6 result (2026-08-07, tester, under real full-gate load): still NOT REPRODUCED.** `quality-oversight.spec.ts`
ran once inside the full `e2e:prod` gate (batch 16, 87-file suite, `RESET=1`); all 4 D9/D10 toggle tests
passed clean — WRITE PATH 1.5s, READ PATH 1.6s, D10 WRITE 1.3s, D10 READ 1.9s, none near the ~11.5s
failure signature. The out-of-process DB poller (docker-exec psql against `commissions.quality_oversight`,
~1.2–1.6s interval, continuous 13:52:44–16:12:5x UTC, ~12,100 samples, 0 gaps) recorded **zero `excluded`
samples for `ccih`** across the whole batch-16 window — the WRITE-PATH test's flip + `finally`-block revert
completes faster than the poller's sampling interval, so this is aliasing (too fast to catch), not a
failed-to-flip signal; the DB row that WAS sampled around the test window read `visible` with a fresh
`updated_at` consistent with a clean, fast round-trip. Extends the non-reproduction streak to 15 isolated
+ 1 full-load run, 0 failures. **The severity question remains formally open** — this run did not supply
a failure to classify, and no classification is manufactured in its absence. Evidence + poller logs:
`docs/../PROGRESS.md` Test Run Summary (2026-08-07, "QO·FUP F6"); raw poller logs are in the tester's
scratchpad (not committed — out-of-band per the task's own instruction), `oversight-samples.log` /
`oversight-samples-resume.log`.

</details>

### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06)

Raised by `backend` at AFF close-out, and it is the **class** behind QA's N2. `302` §1's ACL
assertions covered "the doors that existed when §1 was written"; `log_cpf_probe_for` arrived two
commits later and **inherited nothing** — its ACL is its *entire* boundary (it fronts nothing, it
writes one audit row), so the one property most worth pinning was the one unpinned. Fixed for that
instance in `304` §9; the class is open.

⚠ **This is the third and fourth instance of the same failure inside one workstream** — the others
being F2's error-code detector (bounded by a 5-char syntax, so it could not see `check_violation`)
and `backend`'s own case-sensitive diff-derivation grep (which listed 1 of 4 changed gates, because
`pg_get_functiondef` emits uppercase — ADR 0079 Amendment 5a). Every instance is the recorded rule:
**an enumeration's boundary must be the property, not a syntax and not a remembered list.**

Proposed scope: one assertion that derives the door set from `pg_proc` — every `public` `prosecdef`
function granted to `service_role` must **not** be executable by `authenticated` — replacing the
per-door transcription. Needs its own allowlist discussion (legitimate dual-audience doors exist),
which is why it was flagged rather than widened into AFF unasked.

### 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (2026-08-06)

Raised by `backend`, and it is the durable fix for N1. `memberships_role_check` is a `CHECK` over
`text`, so the role list reaches **no** generated type (`grep technical_director_deputy
src/lib/types/database.ts` → 0 hits) and **no unit test can see the authority**. N1's remedy is a
committed fixture with a gate at each end (pgTAP `304` §10 ↔ fixture ↔ the pt-BR label test) — which
closes the drift hole, but is a **build-time gate, not a guard**: widen the CHECK, never regenerate
the fixture, ship without `npm run test:db`, and an English snake_case identifier still reaches a
pt-BR `role="alert"` through `roleLabel`'s `?? role` fallback.

As an **enum**, the list lands in `database.ts` and `tsc` enforces exhaustiveness — the check moves
from "a suite someone must run" to "the build". Deferred because it is a schema change with real
blast radius (`memberships_scope_shape`, every `role` comparison, the ADR-0094 completeness grid).
Decide before the role set next changes, not after.

### 🟡 FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

Raised by `backend` at W3 close-out. ADR 0097 **D7** makes `profiles.cpf` nullable *specifically* so a
foreign professional without a CPF can be registered "without a later schema change" — and then
requires CPF **at the action layer**. W3 implemented the requirement (correctly: without it the
identifier-first flow creates people no later CPF lookup can find, and the feature is inert on exactly
the population it exists for). **Net effect: the nullable column's escape has no product path.**

That is D7's own design, not a defect, and it is the right default — but it is recorded here because
the day the first customer has one foreign professional it becomes a real gap, and the fix should be a
**deliberate "sem CPF" affordance** (audited, org_admin-only, with the person still findable by name)
rather than a panicked schema change. Blocks nothing. Decide before the pilot onboards clinical staff,
not after.

### 🟡 FUP-SILENT-READ-1 — ~207 PostgREST reads never destructure `error` (2026-08-11, lead)

Surfaced during ETH·E4 when `tester`, enumerating the blast radius of the
`professional_profiles` column-list grant, noticed `getCaseDetail`'s professional embed
(`src/lib/queries/cases.ts:1358`) never destructured `error`. On any failure `profRows` is
null, `?? []` yields an empty map, and every professional participant renders with
`prof = null` — the roster silently falls back to the mint-time `display_name` snapshot,
`professionalProfileId` goes missing, and **`linkState` is undefined so the "Resolver
vínculo" affordance simply vanishes.** No error, no log, no visible failure: a deleted
feature that looks like an empty state.

**Fixed in-phase, all three ETH·E4-authored instances** (`7e55f01`): that embed, plus
`members.ts` `listLinkableOrgUsers` (an empty user list is indistinguishable from "no
account" — walking the coordinator to `no_account`, which makes the case exclusion
vacuously satisfied; the same class as QA's MAJOR-2, inside the very function written to
close the previous instance of it) and `vocabulary/actions.ts`
`listCaseParticipantRolesForAdmin`. ETH·E4-authored code is at zero.

**The repo-wide residue is this follow-up.** A cheap sweep counts **~207 of 773**
PostgREST destructures (~27%, ~40 modules — `rca.ts` 14, `capa.ts` 13, `referrals.ts` 10,
`cases.ts` 10). ⚠ **That is NOT a count of 207 bugs** and must not be cited as one. It is
pre-existing house style, and most instances are probably deliberate "return `null`/`[]`
on failure" reads. The ones that matter are only those where **an empty result is
semantically different from an error and the UI cannot tell them apart** — which is what
made the three above real. Separating those needs per-call-site judgement, not a regex:
the sweep is cheap, the triage is not.

⚠ The sweep script had a real bug before its numbers were trusted — line numbers were
computed on comment-**stripped** source, shifting every offset after the first comment.
Fixed by blanking comments length-preservingly (self-test 4/4); the count moved 210 → 209,
which is why ~207 is quoted as heuristic rather than audited. Script in `backend`'s
scratchpad. Owner: unassigned — needs a triage decision before anyone starts.

### 🔴 FUP-AFF-1 — the authz census is BLIND to write-path doors (2026-08-06, lead)

Recorded as ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 5**.
**Does not block AFF** — but AFF's gate record must **not** cite `ARM=census` as coverage for its
affiliation doors; it must cite `302_affiliation_doors.sql`'s mutation-proven keystones, which do
cover them in substance.

Found when `backend` noticed a diff-scoped `ARM=policy` run reporting **0 BLIND over five brand-new
DEFINER doors having swept none of them** — the boolean arm printed empty because they return
`uuid`, not `boolean`. The hole is wider than the observation, measured from the live catalog:

- **ARM 3's LIVE domain** is `prosecdef` functions that return `bool` **or** are set-returning +
  `authenticated`-executable, plus all RLS policies. A **scalar/void-returning write-path door is in
  none of those sets** — so `ARM=census` reports HOLDS **because the door is invisible, not because
  it is accounted.** That is Amendment 3's vacuity, recurring in a shape its own filter cannot express.
- **ARM 1's write-path sweep exists and is the right harness**, but its domain is **two frozen
  enumerations** — a hand-written list of **7** named raise-guards and a **captured snapshot** of 33
  write policies embedded in the script. Nothing added since has ever entered it. ("A remembered-doors
  allowlist is blind in exactly the case that matters" — now at the harness level.)
- **Measured blast radius:** filtering by the *property* instead of the return type — `prosecdef`,
  `authenticated`-reachable, scalar/void, comment-stripped `prosrc` both naming an identity primitive
  **and** raising `42501`/`HC*` — yields **201** functions. **6** are named in any findings report.

⚠ **Not a claim that 201 leak.** Most are covered in substance by keystones asserting through them.
The claim is narrower and worse: they carry **no sweep verdict**, and the arm whose whole job is to
detect a missing verdict cannot see that one is missing. Two caveats so the fix doesn't inherit a
false premise: the 201 is a regex *candidate* set, not a classification (`--` comments stripped,
`/* */` not), and the class is **not per-function** — AFF's gate lives in an owner-only kernel
(`app.*_impl`, ACL `postgres=X`) while reachability lives in its `authenticated` wrapper, whose body
names no identity primitive, so a per-function domain misses that door **from both ends**. The domain
has to follow the call edge, which is why this is harness work and not a filter tweak.

Scope when scheduled: derive the write-path domain from the catalog by the property (following the
wrapper→kernel call edge), fold it into ARM 3's LIVE set, and give `p0-authz-writepath-audit.sh` a
derived worklist in place of its two frozen enumerations. ⚠ **Dry-run the detector against a
hand-classified sample before believing it** — Amendment 4's harness reported 0 guards in all 45
doors and was completely wrong, and "no write-path door needs a verdict" is exactly as coherent a
false result.

_Closed 2026-08-04, rotated → [follow-ups-archive.md](./follow-ups-archive.md):_
**FUP-P16-1** (14 never-called doors failing the ADR 0079 floor — RESOLVED; `ARM=floor` now reports
`INVARIANT HOLDS`, nothing was allowlisted, and writing the positive twins found **3 doors whose
AUTHORIZED path could never succeed**. ⚠ Keep the mechanic: `pg_stat_user_functions` does not count a
call that raises, so **a deny-only keystone cannot clear the floor** and a permanently-throwing door
reads as *never called* rather than *failing*) · **FUP-P16-3** (`copy_version_children` temp-table
concern — INVESTIGATED, **not a bug**; ⚠ confirming a *pattern* is present is not confirming the
*defect* is present).

### 🔴 FUP-PCITV-1 — PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

QA r2 approved with 7 items open. None blocks the merge; **two block a clean deploy story** and are
called out in the Phase Status caveats above. Owner: unassigned unless noted.

| # | Sev | Item |
| - | --- | ---- |
| 1 | ⬛ | ~~**`ARM=census` never run**~~ **CLOSED 2026-08-05** — the arm landed with the membership-hardening merge and was run against the merged catalog. It found real debt, not nothing: `process_template_versions_{select,staff_admin_write}` carry **no verdict from any sweep**. TV swept and keystoned the six CHILD policies on `process_template_{phases,narratives,outcomes}` (`dcc5a4d`) and not its own PARENT table's two — *a new door must inherit every sibling arm*, one level up. Registered as `gate:` debt in `authz-unswept-backlog.txt`. The ghost-check also named all five `validate_template_*` signatures ADR 0096 re-keyed to `p_template_version_id`. |
| 2 | ⬛ | ~~**TV backfill never exercised** — rehearsal + snapshot blocking before `db push`.~~ **CLOSED (PO, 2026-08-05): the remote is EMPTY**, so the backfill meets 0 rows there exactly as it does locally. Not blocking. See the Phase Status caveat for the mechanism (which recurs) and for the unverified-premise error that produced this row. |
| 3 | 🟡 | **Revoke residue** — `authenticated` still holds `TRUNCATE` on **66 tables**; TRUNCATE bypasses RLS entirely. Unreachable via PostgREST *today*. ⚠ This phase set its own standard by **refusing the "unreachable" argument** in `20260906000600`, so it should be swept or accepted **in writing** — not left implicit. |
| 4 | ⬛ | ~~**BUG-RCA-001**~~ **CLOSED 2026-08-05** — PO ruled the interview's date is the **earliest session's `scheduled_start`**; fixed, PostgREST-verified, and the ruling pinned by `rca.test.ts` (5 cases, mutation-proven per arm). See the Bug Log. |
| 5 | 🟢 | Audit mesh **2 of 7** trigger arms keystoned (`20260906000200`). |
| 6 | 🟢 | The `is_commission_admin_of` disjunct in the 6 new tenant-isolation keystones is **unexercised** — no org-admin persona exists in the test bootstrap. Adding one lifts several suites at once. |
| 7 | 🟢 | `compute_case_phase_result` / `sync_case_phase_on_submit` still force the `in_case_rpc` GUC off (fails **closed**). · Resolver error semantics: helpers now log, but still collapse "not found" and "query failed" into one return — the discriminated-union refactor was deliberately deferred as too risky post-green. |
| 8 | 🟢 | **A FIFTH rebuild-property-loss, inside the migration written to close that class.** `20260907000700` recreated 10 policies on the 5 re-keyed relations **without the `TO authenticated` clause the originals carried** (`20260821000000` wrote `for select to authenticated`; the swap wrote bare `for select`). Platform split is **256 `{authenticated}` vs 11 `{public}` — and 10 of the 11 are these** (the 11th, `case_referral_delete_draft_source`, pre-dates the phase). `20260907001200` caught the ACL and `DEFERRABLE` losses and missed this one. **Verified INERT, twice:** `anon` holds **0 table grants on the 5** — and **0 anywhere in `public`** — so a bare policy still only ever evaluates for roles that either carry `BYPASSRLS` or cannot reach the table. Not a vulnerability; a latent widening if `anon` is ever granted anything. Normalize when one of these policies is next touched. ⚠ Same standard-consistency point as row 3: this phase refused the "unreachable" argument in `20260906000600`. |

| 9 | ⬛ | ~~**`296` suite-number COLLISION between branches.**~~ **CLOSED 2026-08-05** — resolved during the merge, not before it: the branch had committed by then, so it came through as a two-file collision on one number. Renumbered to `supabase/tests/298_authz_p0_isolation.sql`, with the Batch-4 runner in `p0b-isolation-mutation-audit.sh` following it. (A third collision was then created and caught in the same session — `299_hospital_content_door_noun_rule.sql` was first written as `284_`, which `284_accreditation_hospital_readiness.sql` already held. Check the directory before picking a number.) |
| 10 | 🟢 | **PROGRESS.md is 105 KB against the <60 KB target** (CLAUDE.md §7 — every spawn pays for it). This phase's rotation took it from 111.6 KB, so the trend is right but the gap is not closed. Next rotation should take the `📋 Remaining pre-pilot work` and closed-bug sections. |

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

### ⬛ Resolved — rotated 2026-08-06 → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-MEM-1 (indicator doors: not a defect) · FUP-MEM-2 (`assignOrgAdmin` door) · FUP-AUTHZ-2
(15 BLIND gates) · FUP-BULK-1 (suspended members) · FUP-MEM-3/3b (DT referral plane + inbox) ·
FUP-A11Y-1 (`useFieldIds` → `useId()`) · FUP-AUTHZ-3 (45 row-returning DEFINER doors swept) ·
FUP-AUTHZ-4 (BLIND allowlist pruned). Full resolution bodies in the archive.

### ⬛ Resolved — rotated 2026-08-11 (the FUP quick batch) → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-QO-9 (PGRST002 + zero-summary-crash classification; preflight now WAITS for the schema
cache) · FUP-GATE-RESET-FLAKE (reset stderr captured + retried once, loudly; `renderer_ok`
names a dead `gotenberg-pdf`) · FUP-PDF-2 (allowlist narrowed to the `HC*` class) · FUP-P16-4
(12 `+ "s"` sites → `plural()`, helper moved to `src/lib/text.ts`) · FUP-P16-2 (both
accreditation reads through `queries/`) · FUP-QOB-2 (fully discharged — ⑤ closed when ACT
shipped). Merged `97acfd6`. Full bodies in the archive.

**Rotated in the same pass, but NOT part of the batch:** FUP-QOB-1 (the `270` §J J1c catalog
pin, RATIFIED by the PO 2026-08-09) — a separate, earlier closure that had simply never been
rotated out of either file.

⚠ **The one thing worth carrying forward rather than archiving:** three of those six were
measurably WRONG about the code, each phrased as an instruction someone would have executed
(FUP-PDF-4's prescribed fix already shipped; FUP-QO-9(b)'s "false green" was caught by three
existing checks; FUP-PDF-2's `23514` is raised by no door at all). **A prescription in a
follow-up is a claim about the code and ages like one — re-measure before implementing.**

### 🔴 FUP-FF5-1 — patient-lane sublabel is degenerate on the READ path (**PO DEFERRED 2026-07-28**)

The picker shows `Paciente / Paciente afetado`; the **durable submitted record** and wizard resume
show `Paciente / Paciente`. `buildReferenceAnswers`' input row carries no case data, so it resolves
the participant **type** while `reference_candidates` and `app.references_by_item` resolve the case
**role**. Every patient's `display_name` is the surrogate `'Paciente'` by construction, so **two
patient references in one case are indistinguishable in the permanent record**.

QA r1: **MAJOR, but ship** — every disambiguator that would work is PHI and would reverse ADR 0091
ruling 1 (which is why Rule 12 stays at three modules). The only mitigation that does not undo the
ruling is a **workflow rule**: require distinct `case_participant_roles` per patient per case.
Code fix (giving `buildReferenceAnswers` case scope) is a three-level PostgREST embed with PGRST201
exposure — both engineers independently judged it not gate-time work.

⚠ **The PO deferred the decision, not the risk.** The patient lane is live behind `entity_refs` the
moment FF-5 deploys, and ruling 2 makes that lane work **only** on case-bound forms — so this is
100% of real patient-lane usage, unexercised rather than unlikely. **Resolve before the lane is
offered to a real committee.**

### ▶ FUP-FF5-2 — `r2-m-1`: §O pins the door's behaviour, not the closure of the writer set

ADR 0091's substrate paragraph claims *"an exhaustive `pg_proc` sweep for writers of `participants`
returns exactly two functions"*. §O proves the two known doors behave (the surrogate holds) and O5
proves no writer is invoker-rights — but neither pins that the set is **closed**, so a third
DEFINER writer taking a caller-supplied label satisfies every assertion. QA r2: MINOR, not blocking
(the runtime property is held by the mutation-proven O4, and a new writer arrives with its own
migration and ADR). **Close:** one assertion pinning the writer set by **count *and* name**,
matching `(public\.)?participants\y`. Two specifics — O5's current regex is
`insert\s+into\s+public\.participants`, which matches only `public.`-qualified writes (exactly why
a rogue *unqualified* writer probe stayed green), and use `\y`, **not `\b`** (backspace in Postgres
regex).

### ▶ FUP-E2E-1 — RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27) — **blocks nothing**

Replace the *"~18–27 expected failures"* folklore with a **named list**: run the suite on a clean
stack and classify **every** failure as `infra` / `deterministic-real` / `genuinely-flaky`, each with
an owner.

*Why:* **a count-shaped baseline is a hiding place, not a known-issues list.** FF-2's gate ran
762 passed / 55 failed; splitting by connection errors showed **52 were infra** (the
`supabase_vector` crash-loop class) and **3 were real and deterministic** — one of which
(**BUG-FF1-008**) had been red on every run since FF-1 and written off as baseline noise.

Make the triage step itself documented rather than reinvented per lead: **conn errors `> 0` = infra ·
`= 0` = real.** Also establish why batches terminate early — two reported "did not run" (11 and 39),
so raw totals misstate coverage in **both** directions.

### ▶ FUP-FF2-3 — whitespace-only observation, per-instance (DEFERRED by the lead 2026-07-27)

After BUG-FF1-007 fixed the `<> ''''` quoting slip, the per-instance filters compare `<> ''` while the
top-level one uses `btrim(...) <> ''` — so a **whitespace-only** observation is filtered at top level
but not per instance.

**Deliberately deferred, on scope discipline rather than merit:** it is a *different* defect from the
one ruled in, it is cosmetic (a blank observation block renders inside a group instance), and it
would have been the third out-of-phase fix of a wave already at its gate. **`tester` independently
confirmed the deferral is safe** — both canonical writers normalise with `nullif(btrim(...), '')`, so
the whitespace case is reachable only for **legacy rows**, the same population BUG-FF1-007 defends.

### ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO) — **7 still open**

All ruled non-blocking by `qa`. Detail rotated 2026-07-28 →
[ff-1-repeating-groups.md](./ff-1-repeating-groups.md); canonical analysis →
[phase-FF-1-review.md](../reviews/phase-FF-1-review.md) (the playbook's rule: never restate a
review's rationale here).

Open: **MINOR-1** `completeness_authorities_agree` is one-directional in pgTAP · **MINOR-2** the
suite header documents a keystone that does not exist · **MINOR-3** MUTATION F3 names the wrong
mutation · **MINOR-4** stale-comment asymmetry in `supersede_response` · **INFO-2** no coherence
guard on the direct-DML path · **INFO-3** · **INFO-4** the parity vectors have no drift detector.
Closed: INFO-1 (superseded by MINOR-4) · INFO-5 (discharged at Record) · INFO-6 (carried forward as
a binding FF-2/FF-5 requirement — **both phases have since discharged it**).

> ⚠ MINOR-2 and MINOR-3 are the same family FF-5 hit eight more times: a comment or a test name
> asserting something that is not true. Cheap to fix, invisible to every gate.
### ▶ FUP-FF1-1 — coherent fill-path hardening (post-pilot; ADR 0087 ruling 5)

- [ ] Revisit **DEFINER + per-mutation audit for the whole fill path** — `answers`,
  `answer_selected_options`, `response_group_instances` **together**, as one change. Today all three
  are direct-DML-under-RLS with no per-row audit (Rule 11 is satisfied for filling at the *response*
  level via `audit_responses_trg`); FF-1 deliberately matched that convention rather than hardening
  one table piecemeal. Decide the target posture for the set, not for a member of it.

### ▶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped)

- [ ] **MINOR-1 — reserved-session door returns the respondent's own `case_id`.** `get_reserved_session_items`
  now masks times + process number on `NOT is_case_respondent`, but a respondent still receives their **own**
  `case_id` (no cross-case / cross-patient re-identification). Whether the respondent should see even their own
  linkage on the reserved door is the unresolved **A7-vs-A26** call — **fold the reconciliation at pilot close**.
  Owned by `backend`.

### ▶ ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now")

Three **known gaps** + two QA Minors, all the same class — *pre-existing scope decisions E1 does not own*, made
**visible** by E1's stricter access model. QA and `backend` independently judged each out of E1's scope; the PO
agreed and routed all of them to **ETH·E2**. **Full reasoning, measurements and the QA quotes →
[eth-e1-access-spine.md §4](./eth-e1-access-spine.md)** (detail rotated there 2026-08-04; titles +
owners kept live here).

- [ ] **GAP-E1-1 — `action_items` `assignees_only` arm never consults `can_read_case`** (a respondent who is also
  an `org_admin` could see an assignees-only item on their own case). `backend` at E2.
- [ ] **GAP-E1-2 — `patient_safety_event` has no case arm**; residual is **link-existence inference only** (the
  event carries its own incident narrative, not case deliberation). Gating it would rewrite the NSP/PHI-module-1
  model E1 doesn't own. `backend` at E2.
- [ ] **GAP-E1-3 — privileged-doc ceiling has no coordinator arm** (UX, not security: the coordinator who uploads
  a privileged doc must self-grant clearance to reopen it — correct per ADR 0072 D5). `frontend` at E2/E3.
- [ ] **MINOR-A — the generic leak sweep can pass VACUOUSLY** (10/14 covered, 4/14 vacuous). Fix: report zero-row
  tables as **uncovered** rather than silently passing them. `backend` at E2.
- [ ] **MINOR-B — `action_items` passes the sweep by FIXTURE ACCIDENT, not documented exclusion** — the moment
  someone seeds an `assignees_only` item it fails and reads as a regression. **Make it a decision, not an
  accident.** `backend` at E2.
- [ ] **participant-roles M2M (ADR 0072 D7·4) deferred to E2** — no §4 gate criterion covers it and its shape
  depends on E2's decision model; QA verified nothing half-built was left behind. `backend`.


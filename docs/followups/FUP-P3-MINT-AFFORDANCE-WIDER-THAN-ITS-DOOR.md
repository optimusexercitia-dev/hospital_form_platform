# FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR — NARROWED 2026-08-25 by catalog measurement; still OPEN on the identified axis (owner: frontend/qa; filed by the builder as a stated bound on F2)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> ⛔ **HEADING CORRECTED BY THE LEAD, 2026-08-25 — it read `✅ … RESOLVED` while the body below
> carried a ⛔ saying the resolution does not cover the identified variant.** The builder stated the
> bound correctly in prose and then over-claimed it in the one line that gets scanned. That is the
> "a partial fix reads as a complete one" mode: the caveat is real, but a reader skimming for `✅`
> never reaches it, and severity markers are what drive whether anything gets fixed. **What is
> closed is the DE-IDENTIFIED axis. What survives is below, under "BOUNDED".**

> **RESOLUTION — the door I needed was already the one the page calls; no new backend surface.**
> The card now renders on a **non-null `getCasePrintContext`**, which is the DB's own answer to
> *"may this caller mint?"*. Nothing is re-derived in TypeScript, and the predicate stays declared
> exactly once, in SQL. Commit: the F1/F2 follow-up on `0bc37fb3`.
>
> ⭐ **The three-link chain, read from the LIVE CATALOG** (`pg_get_functiondef`, 2026-08-25 — never
> migration text; CLAUDE.md's graphify exception). A positive control ran first: both function names
> resolved (2 rows) before any structural claim was believed.
>
> 1. `public.print_source_state` is **SECURITY DEFINER** (`prosecdef = t`), so its own gate
>    **replaces RLS** and is the entire authority. Its first act after the flag assert is
>    `if not app.can_view_printed_document(...) then return; end if;` — a bare `return` in a
>    `RETURNS TABLE` function, i.e. **zero rows**. Its own comment names the intent: *"no row: no
>    oracle"*. There is exactly **one** `return query`, past that gate, so no row can be produced
>    without it.
> 2. `app.can_view_printed_document`'s `case` arm is
>    `app.can_read_case(id, uid) AND app.can_read_full_case_content(id, uid)` — **ADR 0144 D8's mint
>    arm exactly**, all seven masking axes included via the full-content predicate. Unknown kinds hit
>    `else return false`.
> 3. `getCasePrintContext` maps **every** incomplete answer to `null`: an RLS miss on `cases`, an
>    absent RPC row, **and** a row whose fields are missing or mistyped (an explicit type-guard —
>    stronger than the spec required, since `.maybeSingle<T>()` is an assertion, not a verification).
>
> ⚠ **The direction that matters is the contrapositive**, and it is the one the affordance rests on:
> the measurement above proves *refusal ⇒ null*; the card needs *non-null ⇒ the door passed*. That
> holds because the gate is the only path to the single `return query`. Stated explicitly because
> proving the forward direction and *using* the reverse is how a sound measurement gets applied to
> the wrong claim.
>
> **Side effect, and an improvement:** the fail-closed fallbacks the first draft carried
> (`caseDisposed: … ?? true`, `status: … ?? detail.case.status`) are now **dead and removed**. They
> would manufacture a state for a caller the door had already answered about, turning an honest
> absence back into the refusal-on-click this gate exists to remove. A structural test pins that they
> are not restored — the alternative was a code comment, which is the thing that goes stale silently.
>
> ⛔ **NOT resolved by shape (a) or (c).** (a) was unnecessary — no capability field, no new door.
> (c) stays forbidden regardless: re-deriving the arms in TypeScript is the divergence the module's
> standing rule exists to prevent, and the fact that a cheaper correct fix existed does not make the
> wrong one safer.
>
> ⚠ **BOUNDED — a residue survives, and it is NOT closed.** The gate is D8's **de-identified** mint
> authority. The identified variant additionally requires `app.can_read_case_patient`, which is
> **not** exposed to the page. A caller with case-read + full-content but **without** PHI read still
> sees the checkbox and is refused on submit. That is the original finding **narrowed, not
> eliminated**; closing it needs the PHI door on the detail capability envelope (a backend surface
> change) and must not be faked by re-deriving it in the UI. ⛔ Do not read this ✅ as covering the
> PHI variant — a partial fix reading as a complete one is exactly how this class recurs.

**The finding as originally filed** (kept because the reasoning about why (c) was wrong is the
reusable part):


**The gap.** The *Documentos impressos* card mounts on the case Detalhes tab
(`src/app/o/[org]/c/[commission]/manage/cases/[caseId]/(detail)/page.tsx`) gated on the
`document_printing` flag and nothing else — deliberately, following the meetings precedent. The route's
own entry predicate is `canOpenCaseManagement`, which **since ADR 0134 D3 is no longer the coordinator
test**: it admits `staff_admin` ∨ `isAdministrativo` ∨ a per-case `canWriteContent` grantee.

ADR 0144 D8's mint arm is a different, narrower expression: `can_read_case(id) AND <the case
full-content predicate>`, applied to **mint and download alike**, plus `app.can_read_case_patient` for
the identified variant. The full-content predicate has **seven masking axes**
([substrate](../plans/case-printing-p3-substrate.md)), so the two sets are not the same set.

**Consequence.** A viewer in the difference sees "Emitir documento" (or the prévia links), clicks, and
gets a pt-BR refusal from the door. The refusal is correct and the bytes never move — this is not a
leak. What it is, is an affordance that promises what its authority will not grant, which reads to the
user as a broken product and to a reviewer as an over-grant that happens to be backstopped.

**⛔ Why it was NOT "fixed" in the phase.** Reproducing the D8 predicate in the UI is the thing the
module has consistently refused to do. The meetings mount site's JSDoc states the rule outright —
*"that is the domain's gate doing its job — not something for this module to reproduce or compensate
for"* — and the reason is durable: a UI copy of an authorization predicate is a second declaration of
one rule, and it drifts silently, in whichever direction nobody is testing. Adding one here to smooth
an error message would trade a visible rough edge for an invisible divergence.

**⚠ Do not close it by observing that the door refuses correctly.** That is the premise of the finding,
not an answer to it. The open question is narrower and is a product question: *should the card render
at all for a viewer the full-content predicate excludes?* Answering it needs the D8 predicate exposed
as something a Server Component can read (a capability on the case detail envelope, the way
`viewerCapabilities.canManageLifecycle` already is) — which is a **backend** surface change, not a
frontend one, and is why this is filed rather than built.

**Two shapes when taken up:**
- **(a)** extend the `get_case_detail` capability envelope with a `canPrintDossier` flag derived from
  the same predicate the door uses, and gate the card on it — ONE declaration, read in both places.
- **(b)** rule that the error message is the correct UX for a rare class and close it, having said so.

⛔ Not shape (c): re-deriving the predicate's arms in TypeScript. That is the divergence the module's
standing rule exists to prevent.

**Two facts folded down from the PROGRESS.md index line 2026-08-25** (it had grown to ~2 KB and was
trimmed to a hook; these were the only claims it carried that this body did not — recorded here so the
trim loses nothing):

- **The affordance's audience is wider than it reads.** The card renders to everyone
  `canOpenCaseManagement` admits, which **since ADR 0134 D3 includes `administrativo`s and per-case
  write-grantees** — not just coordinators. That breadth is why the mismatch with D8's arm
  (`can_read_case` ∧ the full-content predicate, seven masking axes) has real population behind it.
- **There is no free fix for the identified axis, measured.** `public.case_viewer_capabilities`
  returns only `can_read` / `can_write_content` / `can_manage_lifecycle` — **no PHI bit** — and
  `getCasePrintContext` does not expose `app.can_read_case_patient` either. So a caller holding
  case-read + full-content but **not** PHI read still sees the checkbox and is refused on submit,
  and closing that needs shape (a)'s new surface. ⛔ Nothing already on the wire answers it.

**Owner:** frontend/qa (needs a backend surface change under (a)).

---

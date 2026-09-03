# FUP-E2E-SUBMITTED-POOL-UNSCOPED — the shared submitted-response pool has no `case_phase_id is null` filter, and the one-line fix BREAKS a passing test (owner: tester + backend; **needs `seed.sql` or pool-math work, not a filter**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-18 · status parked

Filed 2026-08-18 (lead) on `tester`'s finding during the ADR 0125/0126 E2E build. **`tester` correctly
declined to fix it** and flagged the trap in the obvious repair — that judgement is the reason this is a
follow-up rather than a broken suite.

**The gap.** `submittedResponseIds` / `creatorMintFixture` in `e2e/helpers/pdf-printing.ts` scope their pool
to `commission_id` + `status = 'submitted'` and order by `id.asc`. There is **no `case_phase_id is null`
filter** — it was never needed, because until `pdf-printing-case-currency.spec.ts` existed no spec created
phase-bound responses in that commission.

⇒ **Any phase-bound submitted response in CCIH can sort into pool index 0**, and the "full lifecycle" test's
first assertion (*"Nenhum documento emitido…"*) is then false against a genuinely fresh seed.

⚠ **This is INDEPENDENT of the cleanup bug that exposed it.** That bug is fixed. But a working `afterAll`
only prevents the leak *while it actually runs* — a crashed run, a `--grep` that skips the file, or a timeout
all leave the debris, and the pool has no scope to defend itself. Fixing the purge does not close this.

**⛔ The one-line filter is NOT the fix, and this is the measured part.** Scoping the pool to
`case_phase_id is null` would leave exactly **6** rows. Measured from the live seed:

```
Comissão de Controle de Infecção Hospitalar : submitted_standalone=6  submitted_phase=3
Comissão de Farmácia e Terapêutica          : submitted_standalone=4  submitted_phase=0
```

`creatorMintFixture` assumes **at least one submitted response OUTSIDE the 6-wide pool**. At exactly 6 that
assumption drops to **zero** and an already-passing test breaks. **A one-line fix that breaks a passing test
is not a one-line fix.**

**⇒ The real repair is one of two things, neither small:**
1. **Widen the seeded pool** in `supabase/seed.sql` — ⛔ but that file is a contract with ~900 tests, and
   [[a-shared-fixture-cannot-satisfy-two-specs]] is already a recorded scar here. Any addition must be
   checked against every consumer of the CCIH response set, not just this one.
2. **Redesign the pool math** so `creatorMintFixture` does not depend on a spare slot outside a
   fixed-width pool.

⚠ **Do not "fix" it by having each spec claim a wider index range** — that trades a structural gap for a
coordination convention between files that cannot see each other, which is the same failure one level up.

**⭐ The class:** a shared fixture's selector was **correct until a new consumer changed the population it
selects from**. Nothing about `submittedResponseIds` changed; the *world* it queries did. Same family as
[[enumeration-boundary-is-a-syntax-not-a-property]] — the boundary (`commission + status`) was a proxy for
the property (*a standalone response nothing else has claimed*), and the proxy held only while one kind of
row existed.

### ⭐⭐ ADDENDUM 2026-08-18 — the defense ALREADY EXISTED, was correct, and was UNREACHABLE

`tester` found, after being fixed and while looking at nothing in particular:
**`e2e/helpers/purge-forms.ts`** is a purpose-built, already-audited helper for this exact class, filed as
**`BUG-E2EISO-002`** after a real incident — a DB-wide sweep on **2026-08-03** found **46 orphaned draft
`form_versions` plus 2 orphaned PUBLISHED versions still carrying real `responses`/`answers`**, *"accumulated
silently across past gate runs"*.

⛔ **And it carries a tripwire that names this bug IN ADVANCE.** Verified by the lead at `:102–109`:

> *"`forms` and `form_versions` also have NO ACTION referrers — `case_phases`, `process_template_phases`,
> `case_interviews` … so this never fires today — **but that is a claim about fixtures, and a comment
> asserting it would go stale the first time a spec grows a case fixture**"*

…backed by a live `raise exception` at `:116–125` pre-checking **those exact three tables** and refusing
loudly if any row references the forms being purged.

**`pdf-printing-case-currency.spec.ts` is the first spec that grew a case fixture.** The comment predicted
its own staleness condition, named the mechanism, and shipped an instrument that would have refused —
**and none of it fired, because the tripwire lives in a helper the fixture never called.**

⇒ **A correct door nothing reaches**, at a third layer: not a query with no caller, not a keystone no product
path can satisfy, but a **tripwire no fixture consults**.

⚠ **The transmission mechanism is imitation, and it matters more than the instance.** The purge shape was
copied from `case-corrections.spec.ts` and `case-void-reopen.spec.ts` — **and neither of those uses
`purge-forms.ts` either**. Both also carry the identical unchecked `spawnSync` (no captured result, no
assertion): *unconfirmed broken, deliberately untouched*. **A defense that siblings bypass is a defense the
next author bypasses by copying them**, without ever deciding to.

**Scope, measured:** `grep -rl "session_replication_role" e2e/` → **21 files** (13 specs, 3 helpers). Not all
inspected.

**⇒ What this item should actually become.** The same gap has now surfaced **twice**: the form+response half
(2026-08-03, fixed by `purge-forms.ts`) and the **case-domain half** (2026-08-18, this item).
`purge-forms.ts` does **not** cover cases / `case_phases` / `process_templates` / `process_template_versions`
/ `process_template_phases` / `case_correction_requests` — it is form+response only, so it could not have
solved this fixture as-is. The natural repair is **extending its tripwire pattern to the case domain** rather
than every case-domain spec hand-rolling a purge. ⭐ And the tripwire is the **better instrument** than an
exit-code assertion: it refuses **before** attempting the delete, rather than reporting after.

⛔ Deliberately NOT done in the ADR 0125/0126 build: extending a shared audited helper mid-gate, and touching
two sibling specs whose breakage is unconfirmed. Both are widenings, and a widening cannot be wrong-and-safe.

⚠ **Lead note on a smaller instance of the same thing, recorded because it nearly mis-filed this item:** the
first verification query filtered `commission.name ilike '%CCIH%'` and returned **0 standalone, 0
phase-bound** — which reads as "the seed is empty" and would have made this item look like a phantom. The
commission is named **`Comissão de Controle de Infecção Hospitalar`**; `CCIH` is the *persona-email*
convention (`chefe.ccih@test.local`), not the commission's name. **A filter built from the naming convention
of an adjacent artifact returns a confident zero.**

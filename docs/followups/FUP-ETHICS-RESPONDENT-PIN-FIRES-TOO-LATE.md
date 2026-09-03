# FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE — `redact_professional_profile` erases the accused doctor's identity from an UNDECIDED ethics case; the retention pin lands one lifecycle stage after the entitlement ends (owner: backend + PO; ADR 0132)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**⛔ PO-ruled RECORD-ONLY 2026-08-21** — same disposition and same reason as the item above.

**Measured 2026-08-21 against the live catalog; confirmed BY EXECUTION, rolled back.**

The `HC0J7` retention bar fires only when `retention_pinned_at is not null` **OR** the professional
is a respondent in a case with an **`issued`** decision. `app.trg_pin_respondent_retention` is an
UPDATE trigger on `case_decisions` whose first statement is *"Only the transition INTO 'issued'"*.
⇒ through intake, admissibility, findings and hearings, **both halves of the bar are false** and the
door succeeds.

- **Gate is wider than the subject suggests:** `app.can_manage_professional` = `is_admin()` OR
  `is_org_admin_of(org)` OR **any commission `staff_admin` in that org**. The same persona that can
  delete the case can redact its respondent.
- **Executed:** `Dra. Denunciada` / `CRM-9001` → `Profissional (dados removidos)` / null
  (`license_number`, `license_region`, `specialty`, `professional_type`, `cpf`, `user_id` all
  nulled), on a case with `retention_pinned_at IS NULL` and **0** issued decisions. Rolled back and
  re-verified.
- ⚠ **No UI calls it — and that is NOT the control.** `redactProfessionalProfile`
  ([actions.ts:637](../../src/lib/ethics/actions.ts)) has **zero** callers in `src/`. But the RPC is
  `EXECUTE`-granted to `authenticated` and answers over PostgREST (probe returned `P0002`
  *profissional não encontrado* — the body, not a 403). ⭐ The PO's *"no UI is needed"* is already
  satisfied; the door is live anyway. [[correct-door-that-nothing-can-reach]] in reverse.
- ⭐ **Why the existing coverage is green over this.** pgTAP `257` and
  `e2e/ethics-e2-procedure.spec.ts` both pin the bar for a **pinned/decided** respondent — they
  assert `HC0J7` fires when it should. Nothing asserts the pre-decision case, because
  pre-decision redaction is **permitted by design** under ADR 0072 §7's original rationale. The
  suites are sound; the design moved under them.
  [[fixture-cannot-reach-the-failing-state]]

**Why it is a defect now and was not before.** ADR 0072 §7 keyed retention on the *defensibility of
the decision*, so pinning at issuance was coherent. ADR 0132 keys it on the **proceeding** being an
administrative record with legal consequences, so the entitlement is absent from
**allegation-filing**. The pin's trigger point is inherited from a rationale that no longer governs.

**Fix shape when it is scoped** (filed, deliberately NOT built): pin on the respondent link being
created rather than on decision issuance — i.e. a trigger on `case_participants` for
`role.key = 'respondent_doctor'` — and widen the belt from `cd.status = 'issued'` to *"respondent in
any ethics case that is not `cancelled`"*. ⛔ Do **not** fix it by narrowing
`can_manage_professional`; that gate serves non-ethics professional administration too, and cutting
it would be a different change with its own blast radius.

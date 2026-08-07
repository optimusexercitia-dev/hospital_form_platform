# ADR 0103 — On the case-access door, a NULL expiry means PERMANENT (and that is intended)

- **Status:** Accepted (PO ruling 2026-08-07) · **Scope:** QO·FUP · closes **FUP-QO-7**
- **Relates to:** ADR 0102 (the role door ruled the OPPOSITE) · ADR 0050 (case-access expiry)
- **Behaviour unchanged — no migration.** This ADR records a ruling and adds a pin.

## Context

`app._grant_case_access_unchecked`'s `on conflict … do update set` list ends with
`expires_at = excluded.expires_at`, **uncoalesced**. Re-granting a time-boxed case
access with a NULL `p_expires_at` therefore makes it **permanent**. This surfaced during
QO·FUP F1 and was first recorded backwards (see FUP-QO-7); on the corrected reading it
looked like the exact silent-privilege-widening shape ADR 0102 §2 had just **refused**
for the role door — on a door that carries `read_standard_phi` / `read_restricted_phi`.

## Decision

**Keep it. A NULL `p_expires_at` means "permanent" here, and the door is unchanged.**

The two doors are ruled **oppositely on purpose**, and the deciding fact is the **caller
population**, not taste:

| | role door (`app.grant_role_impl`) | case-access door |
|---|---|---|
| Callers that can pass an expiry | **none** — all 12 TS sites omit `p_expires_at` | **one** — `grantCaseAccess` |
| How NULL is produced | by omission — nobody chose it | by the operator picking **`Sem prazo`** from a preset select |
| A NULL argument therefore means | an accident nobody asked for | a deliberate human instruction |
| Ruling | NULL = **leave unchanged** (ADR 0102) | NULL = **make permanent** (this ADR) |

⚠ **The UI cannot send NULL by accident, and that is what makes the ruling safe.** The
grant dialog's expiry control (`case-access-panel.tsx` `GrantDialog`) is a `NativeSelect`
with four options — `Sem prazo` / `30 dias` / `90 dias` / `Data específica` — and the only
blankable control, the `DatePicker` shown under `Data específica`, **fails client-side
validation when empty**. There is no "leave the field blank" path. NULL reaches the door
**only** through the explicit `Sem prazo` selection, whose meaning on a re-grant is
therefore "remove the existing expiry" — stated in the dialog's own hint text.

**Caller sweep, bounded by the property "reaches `app._grant_case_access_unchecked`"**
(line numbers are a 2026-08-07 snapshot — resolve by symbol):

- `public.grant_case_access` → passes `p_expires_at` **through verbatim**. TS caller:
  `grantCaseAccess` (`src/lib/case-access/actions.ts:177`). **This is the only path by
  which a NULL expiry can reach an EXISTING grant** — and, per the box above, it can only
  arrive there deliberately.
- `public.create_case` and `public.create_case_from_template` → call the kernel only for
  the creator self-grant, with a **hardcoded `null`**, on a **brand-new** case where no
  conflicting row can exist. The `DO UPDATE` arm is **unreachable** from them. TS callers:
  `createCase` (`src/lib/cases/actions.ts:547`), `createCaseFromTemplate` (`:469`).

## Consequences

- Pinned executably in `supabase/tests/183_case_access_expiry.sql` **§E** (E0–E3): a NULL
  argument clears (E1), and a supplied expiry overwrites in **both** directions (E2 extend, E3
  shorten — absolute set, not a ratchet). The comment warns the next reader that the
  `coalesce` they are about to "fix in" is the thing under test.
- **Falsifiable, measured not assumed:** adding the `coalesce` reds **E1 and only E1**;
  swapping in `greatest()` reds E0/E1/E3 and leaves E2 green.
- ⚠ **Do not unify the two doors without re-running BOTH caller sweeps.** The asymmetry is
  load-bearing; it is a property of who calls them, and it will stop being true the day a
  caller changes.

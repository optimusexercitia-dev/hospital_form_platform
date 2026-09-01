# AE4.5 — the deny-class effect table

**Phase:** AE4.5 · **owner:** backend · **status:** ✅ **PO-APPROVED 2026-09-01** — the nine EFFECTS are ratified and are the oracle's
second input. ⚠ **Row 5's stated REASON is corrected below on re-measurement; its EFFECT
(GRANTED) is unchanged, so no emitted cell moves.** **derived:** 2026-09-01 · **stack:** local, fresh reset, head
`20261003007180`.

> ⭐ **THE PROVISIONAL MARKER DID ITS JOB, AND THE PATTERN IS WORTH REUSING.** While this table
> was unapproved, every generated cell carried `expectedSource = 'deny-class:PROVISIONAL'` — so an
> unapproved input could not be mistaken for an approved one *inside the artifact that becomes the
> oracle*. ⛔ Whenever an oracle input is pending, mark it **in the artifact**, not only in the
> tracker: the artifact is what a later reader trusts.
>
> ⛔ **THIS IS ONE OF THE ORACLE'S ONLY TWO INPUTS, AND THE ONE WITH NO INDEPENDENT SOURCE
> BEHIND IT.** AE4.5 asserts `is(catalog, approved-matrix-value)`. That half is meaningful only if
> the expected value is derived **independently of the resolver** — otherwise the suite proves the
> resolver equals a second implementation of itself. So expected values come from exactly two
> hand-encoded sources and nothing else:
>
>   1. **the approved matrix row** — does `staff_admin` hold code X (a lookup; currently 42 × true);
>   2. **this table** — what each deny class must produce.
>
> ⚠ **Errors in this table become the regression oracle's errors.** That is why it is a
> PO-approved artifact rather than a constant in a generator.

## The table

| # | deny class | expected effect | reason | source |
| --- | --- | --- | --- | --- |
| 0 | *(base — no deny fires)* | **GRANTED** | The matrix row says `staff_admin` holds the code, and the assignment scope reaches the permission's resolution scope. | matrix row |
| 1 | `wrong_scope` — a sibling commission, same org | **DENIED** | The grant is scoped to one commission; a sibling is a different `scope_id`. | derived from the scope axis |
| 2 | `cross_org` — a commission in another organization | **DENIED** | Tenant isolation. ⚠ **But see matrix § 6.1: this is enforced by the UUID id-space, not by any org term in the resolver.** The catalog expresses no org isolation, so this row records the *required* answer, not a property the catalog guarantees. | derived + § 6.1 bound |
| 3 | `inactive` — `profiles.is_active = false` | **DENIED** | ✅ **MEASURED**: `app.is_active(desativado.conta) = false`, and it gates the whole assignment projection. | measured |
| 4 | `suspended` — `suspended_until` in the future | **DENIED** | ✅ **MEASURED**: `app.is_active(suspenso.temp) = false` (`is_active` column is `true`; the suspension is what denies). ⛔ **NOT independently observable from `inactive`** — one predicate folds both, so no site distinguishes them. | measured |
| 5 | `pending` — `profiles.email_confirmed_at is null` | ⭐ **GRANTED** | ⛔ **CORRECTED ON RE-MEASUREMENT 2026-09-01 — see § "Row 5 re-measured" below. `pending` denies at NO measured layer**, neither the resolver nor authentication. The EFFECT is unchanged. | measured |
| 6 | `wrong_active_context` — **SELF-check** (`principal = auth.uid()`) | **DENIED** | § 6A: the hat gate applies, and the principal must hold the permission through at least one role that is the active role. | matrix § 6A |
| 7 | `wrong_active_context` — **THIRD-PARTY** (`principal <> auth.uid()`) | ⭐ **GRANTED** | § 6A's asymmetry: the filter short-circuits entirely for a third-party check. ⛔ Both polarities are required — a suite emitting only row 6 passes while pinning the uniform-apply bug. | matrix § 6A |
| 8 | `unauthenticated` | **DENIED** | No `auth.uid()`. ⚠ Additionally unreachable: no application role holds USAGE on `authz`, so an anonymous caller cannot invoke the resolver at all (pgTAP 401 § 18). | measured |

**9 rows: 1 base + 8 deny-class effects** (`wrong_active_context` splits by polarity, which is the
whole point of § 6A).

## Row 5 re-measured — three legs, and the grain of each

The original ruling read *"`pending` denies at the AUTHENTICATION layer — an unconfirmed account
cannot obtain a session at all."* ⛔ Measured, it does not. **The recorded reason:**

> **`pending` denies at no layer measured here.** The resolver grants — `app.is_active` never reads
> `email_confirmed_at`. The app's sign-in gate signs out only on `suspended` / `deactivated`
> (`src/lib/auth/actions.ts:176-189`, whose own comment says *"the account is active/pending … so
> KEEP the session"*). And GoTrue locally has **`enable_confirmations = false`**
> (`supabase/config.toml:246`, also `:298`). ⚠ **Production auth configuration is a separate setting
> and is NOT measured** — this statement is scoped to the local stack the oracle runs on.

⚠ **The three legs are not the same KIND of fact, and an earlier draft of this section conflated
them.** Legs 2 and 3 are **system properties**. The claim *"it authenticates"* is a property of
**one persona**, not of pending accounts: `novato.pendente` is the **only** account in the seed
whose `public.profiles.email_confirmed_at` and `auth.users.email_confirmed_at` disagree — measured
**1 of 36 profiles**, and **0** diverge the other way. So "it authenticates" held because that row
is confirmed in the table GoTrue reads, which says nothing about a genuinely-pending account.
**`enable_confirmations = false` is the leg that makes the conclusion general**, and it was missing
until re-measured.

⭐ The axes file's **persona plane** is unaffected: `pending` is a real persona state. What does not
follow is that a persona state implies an enforcement point.

⛔ **No emitted cell moves**: the effect was GRANTED before and after. Only the reason changed —
which is why this is a correction rather than a new decision.

## Two consequences the PO should see with the table

1. ⭐ **Row 5.** `supabase/tests/vectors/authz-matrix-axes.json` lists `pending` under
   `denyClasses`. Cross-referenced rather than marked wrong: the axes file describes the **persona
   plane**, where `pending` is a real account state. It is not an **enforcement point** at any
   measured layer. The generator must therefore emit those cells expecting **GRANTED**, or 300+ of
   them would red against a *correct* resolver.
2. ⚠ **Row 4 cannot be tested apart from row 3.** The generator names `inactive` and `suspended`
   separately, and the fixtures can construct them separately, but no enforcement site
   distinguishes them. A cell expecting a *distinguishable* answer asserts something the system
   cannot express — encoded as an exclusion rule with that reason, not as prose.

## ⚠ Two APPROVED LIMITATIONS — they survive into the gate record, they are not caveats to drop

- **Row 4** — `suspended` is **NOT independently observable**; one predicate (`app.is_active`) folds
  it with `inactive`. ⛔ Any claim that this suite covers suspension **separately** is false, and the
  gate record must not imply it.
- **Row 2** — `cross_org` records the **required** answer. Matrix § 6.1 measured that it is enforced
  by the **UUID id-space**, not by any org term in the resolver. The cell asserts the right outcome
  **for a reason the catalog does not express**. ⛔ This must never read in a gate record as
  *"the resolver enforces tenant isolation"*.

## ⚠ Row 7 will look like a bug — the mechanism travels WITH the assertion

A third-party check carrying the **wrong hat** is **GRANTED**. To anyone who does not know § 6A's
asymmetry that reads as a defect, and the first instinct of a future reader or a QA reviewer will be
to "fix" it. **The active-context filter short-circuits entirely when `principal <> auth.uid()`** —
`app.has_role`'s term is `(p_user_id is distinct from auth.uid() or …)`. ⛔ **Both polarities are
required**: a suite emitting only the self-check passes while pinning the uniform-apply bug, which
would break all 27 `_for` call sites. This paragraph is duplicated into the pgTAP assertion itself,
deliberately — the design doc is not where someone about to "fix" it is looking.

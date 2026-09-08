# FUP-AUTHZ-ANON-RESIDUE-FIGURE-HAS-MORE-HOMES-THAN-ANY-SWEEP-FOUND — three hand-listed sweeps each found a different total

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-08 · status open

**The figure.** *"237 of 467 `app` functions are `anon`-executable"*, measured 2026-08-22. Re-measured
2026-09-08 at head `20261003007350` during pre-AE5 Batch 7: **236 of 526** — ⛔ **both halves had
moved**, +59 functions landed and the `anon` set fell by one (AE4.7b revoked the PUBLIC grant on
`app.is_staff_admin_of`).

⛔ **The finding is not the stale number. It is that three consecutive sweeps for its homes each
returned a different answer, because each was hand-listed.**

| sweep | said | actually |
|---|---|---|
| QA review, round 1 (B1) | *"four new artefacts"* | corrected 4 |
| QA re-review, round 2 (B2) | *"the fifth home"* | corrected a 5th — the follow-up the unit **closes on** |
| final tip gate, round 3 | *"two present-tense homes remain"* | corrected a 6th and 7th |
| **this entry, round 4** | *"derived, not read"* | ⛔ **the derivation was `\| head -40` over 132 matching lines** — see the correction below |

⭐ Each round's list was **produced by reading, not by deriving**, and each was reported as complete.
That is *a "verified-facts baseline" is a HAND-LIST wearing a label*, and the accompanying shape
*a universal negative gets SAMPLED*. The third round found the figure sitting in **the hub's own
acceptance criteria** — inside the very bullet an earlier round had edited.

**What Batch 7 corrected** (all `236 of 526`, dated, with the predicate named): `supabase/config.toml`
· `scripts/check-supabase-config-schemas.mjs` · `docs/lint-gates.md` ·
`docs/decisions/0195-a-committed-number-needs-one-home-and-a-gated-mirror.md` ·
`docs/followups/FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md` ·
`docs/features/privilege-surface.md` · `docs/plans/pre-ae5-remediation.md`.

**What it did NOT correct, and why** — these are outside the unit's subject and are listed here from
a **derived** sweep (`git grep -n '\b237\b'`), not from reading:

- `docs/design/authz-ae1-tier1-threat-review.md` — *"The known `anon` residue is 237 `app` functions
  and stays where it is"*. **Present tense**, in a 2026-08-27 threat review.
- `docs/backend-state.md` — two sites describing `320` §U1's committed baseline as `237 of 454` and
  a re-measured `237`. ⚠ Both are **about the ACL-shaped population**, which is a *different
  predicate* from the `anon`-effective one; whether each is stale or correct-as-dated must be
  decided per site, not swept.
- ADRs **0155** (`:279`, `:486`) and **0160** (`:29-46`). ⛔ **Do not touch these.** An ADR records
  what was decided and measured on its date; 0160 exists precisely to correct 0155's reading of this
  figure, and rewriting either would destroy that correction's subject.

⚠ **Many other `237`s in the tree are a different population** — C2 Tier-1 door counts (0171, 0187,
the c2 design docs), `Buffers: shared hit=237` in perf traces, and line-number references. A sweep
that treats `237` as one class is wrong before it starts.

> ⛔⛔ **CORRECTED 2026-09-08, and the correction is the entry's most useful content.** This clause
> read: *"⛔ **Every other `237` in the tree is a different population**"*. **That is a false
> universal negative**, and it was produced by **the exact failure this entry was filed to name**.
>
> The sweep behind it was `git grep -n '\b237\b' -- ':!docs/reviews' ':!docs/progress' | head -40`.
> ⛔ **`head -40`.** The command matches **132** lines. The entry claimed to have *derived* the class
> instead of hand-listing it, and then **truncated the derivation and reported it as complete** —
> the fourth consecutive round to declare this class swept, by a fourth method, wrongly.
> ⭐ *A universal negative gets SAMPLED* — including by the person writing the warning about it.
>
> **What the truncation hid:** `docs/design/authz-evolution-census-ae0.md` §6.2/§6.3 carries the
> figure **four times under the identical predicate over the identical population** (`:341`, `:384`,
> `:391`, `:402` — `has_function_privilege('anon', …)` for schema `app`), one of them an operational
> instruction at `:391` saying the residue *"should be stated as …"*.
>
> ⇒ **`ae0` joins the PROTECTED class, not the correction class.** It is the census ADR 0160 was
> written **from**, and §6.2's whole subject is that `167` and `237` are two predicates at one
> instant rather than growth over time. Rewriting its figures would destroy the finding it exists to
> record — the same reason 0155 and 0160 are protected below. ⇒ The repair owed there is a
> **classification**, not a correction: a dated note saying the figure is a 2026-08-something
> measurement of that predicate, and pointing at the live one.

**What would close it.** Decide the three non-ADR present-tense sites above (correct, date, or rule
as correct-for-their-predicate), and — the durable half — **state how the class is enumerated**, so
the next reader does not hand-list it a fourth time: the query is one line
(`count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE'))` over `app`), and the
homes are derivable by grep. ⛔ Not closed by correcting the three sites alone; that is what the
previous three rounds each did.

⚠ **Bound.** `236` (effective, `has_function_privilege('anon', …)`) and `320` §U1's `236`
(ACL-shaped, `proacl IS NULL` or an explicit PUBLIC grant) are **different predicates that coincide
today by accident**. Batch 7 proved they can disagree: granting `anon` EXECUTE on one `app` function
moved the effective count to 237 while the ACL-shaped count stayed 236 (rolled back). ⛔ Never infer
one from the other — the same error this program corrected as 137-vs-138.

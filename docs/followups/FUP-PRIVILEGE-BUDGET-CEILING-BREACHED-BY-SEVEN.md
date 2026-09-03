# FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN — the `authenticated`-executable DEFINER budget is 759 against a ceiling of 752, and six of the seven are unattributed

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

and it has risen silently. Not 🔴 because no individual grant is known to be wrong and the count is
an aggregate risk measure, not an exposure. Above 🟡 because the merge rule was breached six times
without anyone noticing, which is a fact about the *process*, not about any one function.

**What is wrong.** `docs/backend-state.md` § Privilege budget records **CEILING: 752** with the
merge rule *"no increment may raise the count without a named justification in its own gate record,
and the ceiling moves only by PO ruling."* The live count is **759**.

**How it was MEASURED.** 2026-09-03 at head `20261003007330`, live catalog:

```
select n.nspname,
       count(*) filter (where p.prosecdef) as definer,
       count(*) filter (where p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')) as auth_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app','public') group by 1;
```

→ `app` 415 DEFINER / **326** authenticated-executable · `public` 465 / **433**. Totals **880** and
**759**, against the recorded **856** and **752** (measured 2026-08-27 at head `…005300`).
**One** of the seven is attributed: `app.current_professional_read_organizations`, justified by name
in backend-state § Privilege budget and in ADR 0182. **Six are not.**

**What would close it.** Attribute the six — diff the `authenticated`-executable DEFINER set between
head `…005300` and head `…007330` (the query above, run against each), name each function and the
increment that added it — then put the aggregate to the PO: either the ceiling moves by ruling to
the justified number, or the unjustified grants are revoked. ⭐ **A gate would be cheap and is the
durable form**: the count is one query, and a `lint:*` step that reds when it exceeds a committed
figure converts "nobody noticed for a week" into "the next commit noticed".

⛔ **What must NOT be mistaken for closing it.** ⛔ **Editing the ceiling to 759.** That converts a
breach into a baseline and is precisely what the merge rule reserves to the PO. ⛔ Nor does ADR
0182's named justification close it — that accounts for exactly one of the seven, and the section's
own ⭐ note already predicted this shape: *"it rises silently, one convenient `grant execute … to
authenticated` at a time, each individually defensible."* ⚠ Note also that a **revoke may not create
sweep blindness** — revoking `authenticated` EXECUTE removes a function from `ARM=floor`'s domain
(RV0's load-bearing ruling), so the remedy is not simply "revoke until the number fits".

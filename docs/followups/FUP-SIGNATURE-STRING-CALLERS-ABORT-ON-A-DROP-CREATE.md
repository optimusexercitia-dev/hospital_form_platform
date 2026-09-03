# FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE — a caller that names the OLD ARITY fails as a plan mismatch, pointing nowhere near signatures (owner: backend; filed 2026-08-22, found when the full suite failed in a file this increment never touched)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-22 · status open

_**Detail rotated VERBATIM from the Follow-ups section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-26**, restoring that index line to its declared one-line form during a size rotation. Nothing was summarised away — the text below is the removed substring exactly as it stood:_

> it **ABORTS the suite** as a plan mismatch, in an unrelated file, naming no function (`Result: FAIL` with **zero** `# Failed test` lines — the never-ran shape wearing its opposite). Hit on the Increment-2 `DROP`+`CREATE`; the overload pin catches **ambiguity** and is structurally blind to **arity**. Swept: **9** textual hits, **1** executable — fixed, and `357` 1.6/1.7 now pin `oid::regprocedure::text`, the *same string form* the hazard uses. ⛔ Open on the **class**, not the two doors: whatever gate is built must go **RED on a deliberately stale signature** — a sweep of this shape that finds nothing is indistinguishable from one that cannot

**What happened.** ADR 0134 Amdt 2 needed `p_patient` added to `public.create_case` and
`public.create_case_from_template`. `CREATE OR REPLACE` **cannot add a parameter** — it creates an
*overload*, and PostgREST 300s on an ambiguous candidate set — so both were `DROP FUNCTION` +
`CREATE`. That hazard was anticipated and pinned (`357` 1.5 asserts the overload count is 1 each).

**A second, different hazard was not.** `supabase/tests/100_dashboard.sql:439` asserted

```sql
has_function_privilege('anon', 'public.create_case_from_template(uuid,text,uuid,text,uuid,jsonb)', 'EXECUTE')
```

— a **signature STRING naming the old arity**. The moment the seventh argument landed, that string
stopped resolving and the call raised `function ... does not exist`.

**⛔ WHY IT IS WORTH A FOLLOW-UP RATHER THAN JUST A FIX — it does not present as a signature problem.**
The raise happened mid-file, so the suite **ABORTED** rather than reddening an assertion. What the gate
reported was:

```
Dubious, test returned 3 ... Parse errors: Bad plan.  You planned 22 tests but ran 20.
```

A plan mismatch in `100_dashboard.sql` — a file the increment never touched, about dashboards, naming no
function. `Result: FAIL` with **zero `# Failed test` lines**, which is the recorded *"green has a third
failure mode — the assertion that NEVER RAN"* shape wearing its opposite: a red that names the wrong
subject. Reading the summary alone would send the next person into the dashboard suite.

**The overload pin cannot catch this, and that is structural.** `357` 1.5 counts CANDIDATES; this is a
caller pinning an ARITY. Different failures, and neither implies the other.

**Population, swept by property** (`create_case(_from_template)?\([a-z]` across `supabase/tests/`, `src/`,
`e2e/`, `supabase/seed.sql`, excluding `supabase/migrations/`): **9 textual hits, exactly ONE executable**
— `100_dashboard.sql:439`. The other 8 are prose in docs, ADRs, comments and one test *description*
string. Fixed in place.

**Mitigation landed:** `supabase/tests/357_creation_scoped_case_phi.sql` 1.6/1.7 pin both doors' exact
`p.oid::regprocedure::text` — which is the *same string form* `has_function_privilege` takes, so the pin
matches the hazard rather than approximating it — and they sit beside the explanation, so a future
signature change reds next to its reason instead of in a distant ACL assertion.

**Why it stays open.** The mitigation covers the two doors this increment changed. The **class** is
untreated: any future signature change in this repo walks into the same abort, and nothing enumerates
signature-string callers generally. Cheap options, in increasing cost: (a) a lint/pgTAP sweep asserting
that every `has_function_privilege(..., '<schema>.<fn>(<types>)', ...)` string in `supabase/tests/`
resolves to a live `regprocedure` — catalog-checkable, and it would have caught this before the run;
(b) a convention of passing `oid` rather than a signature string. ⚠ Whatever is built, the control must
be that it goes RED on a deliberately stale signature — a sweep of this shape that finds nothing is
indistinguishable from one that cannot find anything.

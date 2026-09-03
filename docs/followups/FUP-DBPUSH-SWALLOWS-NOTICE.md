# FUP-DBPUSH-SWALLOWS-NOTICE — the AE3 runbook's step-4 safety read is unexecutable through the command the runbook prescribes (owner: lead; filed 2026-09-01 from the AE3 cutover)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-01 · status open

`docs/deployment/ae3-cutover-runbook.md` § 2 step 4 says the backfill's `raise notice` *"reports how
many rows moved. **Read it.**"* — and `supabase db push` **does not surface notices**. The 2026-09-01
run printed only `Applying migration …` lines; the count was obtained from the catalog afterwards.

**Why it is not cosmetic.** The stated stop condition is *a count of 0 against a populated `profiles`*,
and the migration's own in-band check is a **parity** assertion (`v_src = v_dst`) that **holds
vacuously at 0/0**. So the notice was the only thing standing between a silently-empty backfill and a
green migration — and it is unreadable through the prescribed command. Cf.
[[a-silent-return-hides-a-live-defect]] and the vacuity family generally.

**What would close it.** Replace step 4's instruction with a post-push catalog query whose expected
values are computed *before* the push (as was done here: 36 profiles / 5 cpf / 0 dob / 0 phone →
expect `ppd_rows = 5`), so the read is an assertion against a prediction rather than a number to eyeball.
⚠ The same defect is latent in **any** runbook step that says to read a `raise notice`.

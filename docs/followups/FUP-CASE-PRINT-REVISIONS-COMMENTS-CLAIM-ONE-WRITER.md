# FUP-CASE-PRINT-REVISIONS-COMMENTS-CLAIM-ONE-WRITER — a false statement living inside the catalog (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25 while writing the PDF·P3 entry in `docs/backend-state.md`.** Two COMMENTs assert
> a single writer for `public.case_print_revisions`:
> `COMMENT ON FUNCTION app.bump_case_print_revision` — *"the ONE writer"* — and
> `COMMENT ON TABLE public.case_print_revisions` — *"written ONLY by `app.bump_case_print_revision`"*.
>
> **Measured (regex over `pg_get_functiondef` across `app` + `public`, not over migration text): there
> are TWO.** `app.trg_bump_case_revision_self` inlines its own upsert, keyed on `old.status`.
> ⭐ **The code is right and the comments are wrong** — the reason the second writer exists is exact:
> on a reopen, the central function's `case_is_terminal` guard reads the **post-update** row, so it
> would skip the bump on the way *out* of terminal, which is the one transition ADR 0144 D4 exists
> for. Precision recorded in ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md)
> Amendment 4.
>
> ⛔ **Why this is filed and not merely noted: a COMMENT lives IN THE CATALOG.** It is not text a
> `grep` over `src/` or `docs/` can reach, and no lint gate reads `pg_description`. So the usual
> witness for a stale claim — the file it sits next to — does not exist here, and this register is
> the only one. *"The ONE writer"* is exactly the kind of sentence a later session relies on before
> adding a third.
>
> **Owed:** a migration correcting both COMMENTs to name both writers and why the second exists.
> Cheap, but it is a migration, so it wants a fresh reset and a `test:db` pass behind it. ⚠ Consider
> at the same time whether a pgTAP assertion can pin the writer set (`pg_get_functiondef` regex over
> the two schemas), since that is the only thing that could ever contradict the comment.

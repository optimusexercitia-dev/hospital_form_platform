# FUP-MUTATION-AUDIT-BLIND-TO-THE-DOOR-WRAPPERS — the AE1.3 audit mutates the six `app.*_impl` kernels and nothing mutates a `public.*_for` body (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 at the AE1 Record step (obligation 9, AE1.3 gate record).
> `supabase/tests/mutation/ae13-person-doors-mutation-audit.sh` targets **kernels only** —
> `app.update_person_fields_impl` · `set_person_active_impl` · `suspend_person_impl` ·
> `finalize_invited_person_impl` · `upsert_credential_impl` · `delete_credential_impl`. The one wrapper
> it touches at all, `public.set_person_active_for`, it touches by **`proacl`** (the G1 ACL guard),
> never by body.
>
> Measured 2026-08-27: `supabase/tests/385_person_doors_authority_and_audit.sql` and
> `386_person_doors_acl_and_guard.sql` contain **zero** occurrences of `prosrc`, `pg_get_functiondef`
> or `md5(` — neither pins any function body, wrapper or kernel — and no mutation case anywhere mutates
> a `*_for` body.
>
> ⚠ **The wrappers are pure delegators TODAY** (catalog-measured at AE1.3), and while that holds the
> blind spot costs nothing. It goes live the moment a wrapper stops delegating: an authority check
> **moved into** a wrapper is mutation-tested by nothing, and so is a wrapper that grows its own
> duplicate check or reimplements equivalent behaviour inline. A kernel-only audit stays green through
> all three.
>
> ⛔ **A body-text pin alone is the wrong fix** — it reds on every harmless rewrite and gets deleted.
> **Discharged when** either (a) a pgTAP assertion pins the *delegation property* — each
> `public.*_for` body makes exactly one call and it is its kernel — so a wrapper that grows logic reds,
> or (b) the mutation harness gains a wrapper arm per door, red-first proven. Whichever lands must fail
> when a check is **MOVED** from kernel to wrapper, not merely when text changes.

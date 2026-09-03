# FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN — ⚠ **HALF RESOLVED 2026-08-17: the guard no longer fails open; the arm is still a no-op awaiting a NAMED successor** (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status open

> ## ✅ SUCCESSOR NAMED 2026-08-18 (DM-FUP TRIAGE #5) — **`app.resolve_document_version_bytes`**, and the arm moves into Critical FUP C2 Tier 1
>
> The item required that the successor be **named, not guessed**. It was **derived from the live
> catalog**, which is the strongest form of naming available here. The byte corridor:
>
> `openDocumentVersion` → `public.open_document_version` / `public.open_printed_document`
> (`prosecdef = t`, granted to `authenticated`; **thin** — `assert_documents_enabled` + dispatch)
> → **`app.resolve_document_version_bytes`**, which holds the whole kernel: `app.can_read_document`,
> `app.can_read_referral_phi`, the D15 ceiling, and the disposal/serving-state refusals
> (`HC0DD`, `HC0D8`). The app then signs a short-TTL URL with an **admin** client.
>
> ⭐ **The item's framing had no target, and that is the finding.** It asks for the arm to be re-pointed
> at a **policy**. There is **no `storage.objects` SELECT policy on document bytes at all** — the live
> set is `documents_phi_obj_insert_reserved`, `documents_std_obj_insert_reserved`,
> `form_assets_insert_staff_admin`, and `form_assets_select_member`, the last being the only SELECT and
> not a document path. The gate is a **`prosecdef = t` door whose check replaces RLS**, so the arm's
> class changes from policy-mutation to **door-mutation**. → *`prosecdef` belongs beside `pg_policies`*
>
> ⛔ **Therefore it is built inside C2 Tier 1, not as a one-off.** Tier 1's door sweep needs exactly
> this machinery, as does `FUP-DM5-SIBLING-GUARD-DIFF`; building it three times was declined. ⚠ **Being
> absorbed is not being closed** — this item keeps its own line and needs its own recorded verdict.

> **✅ The fail-open half is fixed** — `coalesce(v_qual, '') !~ …`. **Proven, not assumed:**
> against the live catalog `v_qual is null` is **true**, the old form evaluates to **NULL**
> so the `if` does not fire and control falls through to `alter policy` on a nonexistent
> policy (**42704**), and the new form **announces the no-op**. A guard nobody had seen
> fire has now been seen firing.
>
> ⛔ **Deliberately NOT done: silently re-pointing the arm.** The policy
> `attachments_obj_select_readable` was dropped by DM1, so the arm now honestly reports
> that it tests nothing. Retargeting it at whatever current policy *looks* similar would
> make it assert something nobody chose — the successor must be **named** by whoever owns
> the case-bytes read path today. Downgraded 🟡 → 🔵: it is now legible rather than
> deceptive.

Filed 2026-08-17 (lead) from QA's DM5·S4 review MINOR-3. **Pre-existing — NOT S4's doing**, and
explicitly not charged to it.

`supabase/tests/mutation/q1-quality-mutation-audit.sh:140-153` (`open_bytes_cut`) targets policy
**`attachments_obj_select_readable`** on `storage.objects`. The catalog has **0** such policies —
dropped by `20260923000100_dm1_drop_attachment_substrate.sql` (**DM1**, weeks before S4).

⭐ **The interesting part is the guard, not the staleness.** The arm protects itself with
`if v_qual !~ 'read_case_deliberation' then raise …` — intended to announce a no-op. With the policy
absent, `v_qual` is **NULL**, `NULL !~ '…'` evaluates to **NULL**, the `if` does not fire, and control
falls through to `alter policy` on a nonexistent policy → **`42704`**. *A guard written to announce
"MUTATION NO-OP" instead fails open into an error* — three-valued logic eating the one branch that
existed to make the failure legible. Same family as
[[guards-that-read-right-but-fail-open]] and [[a-silent-return-hides-a-live-defect]].

**Fix:** re-point the arm at a live policy (or retire it with a named successor), and make the guard
NULL-safe (`coalesce(v_qual,'') !~ …`). Then prove it can announce a no-op — a guard nobody has seen
fire is not a guard.

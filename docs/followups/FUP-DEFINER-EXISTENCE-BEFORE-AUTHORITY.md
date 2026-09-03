# FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY — 31 Tier-1 DEFINER doors confirm an object exists before checking authority (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 by AE1 close condition #3, the [tier-1 threat review](../design/authz-ae1-tier1-threat-review.md)
> §4.2 (finding F-T1-2). **PO-ruled the same day: fixed OUTSIDE AE1.**
>
> Each of the 31 reads a table to resolve its target, raises a *distinguishable* not-found
> error, and only then checks authority. They are `SECURITY DEFINER`, so the read **bypasses
> RLS** — the error therefore tells a caller with no access that the object exists. Shape,
> measured:
>
> ```
> public.assign_member_title(p_member_id, p_title_id)
>   select commission_id into v_commission from public.memberships where id = p_member_id;
>   if v_commission is null then raise exception 'membro inexistente' ...   -- ← before authority
>   if not (app.is_staff_admin_of(v_commission) or ...) then raise exception 'sem permissão' ...
> ```
>
> ⚠ **Severity is low and must stay stated that way:** uuids are not enumerable, so this is a
> *confirmation oracle* — it validates an identifier the caller already holds — not an
> enumeration sweep. What makes it worth fixing is consistency: it is exactly the standard
> AE1.3's six new doors were held to (*"authority checked before existence so a probe cannot
> enumerate"*), and **five of the 31 are case-module doors** (`get_case_detail`,
> `grant_case_access`, `list_case_access`, `revoke_case_access`, `set_case_visibility`).
>
> ⛔ **Do not re-derive the set by hand.** It is BLOCK 6 of
> `scripts/authz-tier1-threat-review-ae1.sql`; the count moves as doors are added, and a
> hand-list would be stale the first time it is read. The fix is a migration reordering the
> bodies (authority first, uniform deny) plus a diff-scoped door sweep and a mutation-proof
> per door — its own increment, which is why it is not in AE1.
>
> ⚠ Two of the 31 are INVOKER-adjacent in appearance only; the split that produced this set
> already removed the 3 INVOKER cases (their pre-authority read is RLS-filtered, so
> "not found" already means "not visible to you") and the 41 whose deny is silent.

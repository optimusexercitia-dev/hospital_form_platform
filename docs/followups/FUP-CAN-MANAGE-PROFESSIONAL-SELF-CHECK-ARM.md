# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-01 · status open

with the `is_active` bypass.

`app.can_manage_professional(p_org uuid, p_uid uuid)` is parameterised on a **third party**
(`p_uid`), but its first arm is:

```sql
coalesce(app.is_admin(), false)
```

`app.is_admin()` **takes no argument** — it reads `auth.uid()`. So that arm answers about **the
caller**, never about `p_uid`.

**Measured caller split (lead, 2026-09-01):** **13** callers; **12 pass `auth.uid()`**, where the
confusion is invisible because caller and subject coincide. **Exactly one passes a third party** —
`app.can_read_professional_profile`, at `can_manage_professional(v_org, p_uid)`.

⛔ **The reachable consequence:** when a `platform_admin` asks *"can user X read this professional
profile?"*, the answer can be **TRUE because the caller is an admin**, not because X may. A
permission check about someone else silently returns the asker's own authority.

⭐ **This is § 6A's self/third-party asymmetry again — the same class derived for the AE4.4b
resolver, now found in the legacy predicate.** Different defect, different blast radius, different
disposition from BUG-PROF-INACTIVE-001.

⛔ **Why it was not folded into that fix:** it would make a security fix unattributable — two
changes to one predicate in one migration, where only one of them has a differential-oracle cell
proving it landed. It also needs its own reachability analysis, which has not been done.

**Disposition:** PO's, once BUG-PROF-INACTIVE-001 is green.

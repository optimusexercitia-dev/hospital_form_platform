# FUP-REVALIDATE-PATH-NAMES-A-ROUTE-THAT-DOES-NOT-EXIST — the coordinator page is never revalidated (owner: frontend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟡 **FUP-REVALIDATE-PATH-NAMES-A-ROUTE-THAT-DOES-NOT-EXIST** — filed 2026-08-28, found in passing
  during ADR 0167; **prose corrected, behaviour deliberately untouched.**

`revalidateCommissionPages` (`src/lib/admin/actions.ts`) calls
`revalidatePath('/admin/comissoes/<slug>')`, but **`src/app/admin/comissoes/` does not exist.** The
page `StaffAdminManager` actually renders on is
`/o/[org]/manage/comissoes/[commissionSlug]` — so it is **never revalidated after a coordinator is
seated or removed**, and a stale roster can survive the mutation that changed it.

⛔ **Left unfixed on purpose:** changing which paths are revalidated is a **behaviour** change and
does not belong inside an authorization increment. ⚠ It is also the *second* stale reference to that
retired route found in one increment — the other was in a security docstring — so the sweep should be
for **the route**, not for this one call site.

# FUP-DM5-STACK-CYCLE-DESTROYS-BYTES — a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with **no manifest, no count comparison, no audit** (owner: lead + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status open

Filed 2026-08-17 (lead) from QA's DM5·S4 review **B1**. Full measurement, timeline and cause: the
S4 OUTCOME block under **FUP-DM5-STORAGE-ORPHANS** above.

**The hazard, stated generally:** ADR 0120 **D9** governs *deliberate* retirement — capture, delete by
key, assert `deleted == manifest`. It says nothing about the **operational** paths that can destroy
storage bytes as a side effect, and at least one of them does so **silently**: recovering a wedged
local stack (`supabase stop` + `supabase start`, here after a mid-flight `supabase db reset` was
killed) recreated the storage volume. `supabase stop` reported `"backup":true` while doing it.

**Why it matters beyond the lost dev files:**
1. ⭐ **It is the exact event D9 exists to prevent, and it happened inside the slice that ratified D9** —
   which is the strongest possible evidence that *a rule governing the deliberate path does not
   constrain the accidental one.*
2. **It was invisible.** Nothing alarmed. It was found only because a reviewer re-measured a figure the
   lead had inherited from a manifest 3 hours old. **No gate in this repo would have caught it**, and the
   lead reported the bytes as present, and had the PO rule on them, long after they were gone.
3. **Cloud is the real exposure.** `npm run db:reset:linked` exists, and the 20-yr LGPD/ANVISA retention
   posture means "storage bytes vanished and we cannot say when or which" is a compliance statement, not
   a tidiness one.

**Candidate resolutions (PO/backend call — deliberately NOT pre-decided):** capture a manifest
**before** any stack-cycle or destructive CLI step and diff after (cheap, uses S0's existing tool) ·
document the hazard in `docs/worktrees.md`/the deployment runbook · or accept it for local dev and scope
the guard to anything touching a data-bearing stack. ⛔ **Do not resolve it by adding a comment saying
one "should" capture first** — that is the failure mode this phase has now paid for repeatedly.

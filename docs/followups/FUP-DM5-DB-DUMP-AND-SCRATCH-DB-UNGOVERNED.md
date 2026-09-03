# FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED — the runbook's own DB-half verification creates **two plaintext PHI copies with no handling rule** (owner: PO decision, then backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status open

Filed 2026-08-19, from the § 6b first execution (finding **F6**).

> ⭐⭐ **PROMOTED TO the ⭐⭐ Critical list as C4 on 2026-08-19, by explicit PO instruction.** Its **trigger**
> lives there: **the first time anyone runs `supabase db dump --linked`** — which needs only the DB
> password and is the natural next step of a **C1b** rehearsal. ⛔ So the ordering matters: do not
> let a C1b run be the first execution of an ungoverned procedure.

§ 6b is titled *"PHI handling for the backup half"*, but its five values are scoped, literally, to
**"a Storage backup" / "the archive"**. The same section then requires — for the word *"verified
good"*, which authorises destroying the only other copy — a `supabase db dump` restored into a
**scratch database**. Neither artifact is named by any of the five values:

- the **dump file**: a plaintext `.sql` holding every narrative, identifier and answer. No location
  rule, no reader set, no retention, no destruction step.
- the **scratch database**: a second live copy of the PHI, which this same page describes as
  *90 of 274 RLS policies restored* — *"a restored database missing two thirds of its RLS is not a
  database — it is a data leak wearing one"*. **Nothing tells the operator to drop it.**

⭐ **This is `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s own sting, one level down, inside the section that
resolved it**: *a procedure whose correct execution produces an undocumented plaintext PHI copy is
not a complete procedure*. The Storage half was governed and the DB half — added to the same section
for a different purpose — was not, because the scope sentence was written about Storage and the
requirement was added later.

⚠ Unlike F5 this one **is** reachable on Cloud today (`supabase db dump --linked` needs only the DB
password), so it is the more likely of the two to happen by accident.

**Interim mitigation, already in the runbook** (not a substitute for the decision): apply the five
values to both by analogy, drop the scratch database as soon as the comparison is recorded, and
record both in the run log. **What is owed:** the PO extending the five values explicitly, or ruling
that the DB half is covered by the managed backups and the restore test is not to be run at all.


**From the Critical pin, 2026-09-03 (compacted at ADR 0186 D4, plan 5.6):**

- **Item (was):** 🟠 **`FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`** — § 6b's five values are scoped **literally** to *"a Storage backup" / "the archive"*, yet the same section requires a `supabase db dump` restored into a **scratch database** to earn the words *"verified good"*. **Neither artifact has a location, reader-set, retention or destruction rule**, and nothing tells the operator to drop the scratch DB — which this same page calls *"a data leak wearing one"* (**90 of 274** RLS policies restored). ⭐ The parent item's own sting one level down, **inside the section that resolved it**.
- **What must happen (was):** **PO extends the five values explicitly to both artifacts, OR rules the restore test out of the procedure.** ⚠ The interim mitigation already written into the runbook — apply the values by analogy, **drop the scratch DB as soon as the comparison is recorded**, record both in the run log — is a stopgap and **is not the decision**.
- **Trigger — the point it can no longer wait (was):** **The first time anyone runs `supabase db dump --linked`** — ⚠ **reachable on Cloud TODAY** (it needs only the DB password, unlike C3), and it is the natural next step of a C1b rehearsal. ⛔ Do not let a C1b run be the first execution of an ungoverned procedure.
- **Owner (pin's own column):** PO decision, then backend

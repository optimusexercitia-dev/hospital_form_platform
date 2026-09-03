# FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS — a read-arm COVERED on a `FOR ALL` policy can be earned by a write keystone

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`p0-authz-door-audit.sh` bounds itself `polcmd in ('r','*')` and opens **both** `using (true)` and
`with check (true)` on a `FOR ALL` policy. So a COVERED verdict there can be produced by a keystone that
only exercises the **write** half — the mirror of the defect the write arm just fixed by opening the
`with check` half alone.

**How it was measured.** Read from `p0-authz-door-audit.sh` around line 807 while re-deriving the write
arm's domain.

**What would close it.** Either open the halves separately in the read arm too, or record per verdict which
half the keystone exercised.

⛔ **What must NOT be mistaken for closing it.** The write arm's fix. It made the *write* verdicts
unambiguous and left the read side exactly as it was.

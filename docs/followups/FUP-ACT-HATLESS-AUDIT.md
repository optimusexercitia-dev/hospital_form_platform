# FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

Catalog-verified in `app.audit_write`:

```
v_acting_as := app.active_role();
if v_acting_as is not null then
  v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
end if;
```

The key is **absent, not null**. So for the hatless-grantee path — which under ADR 0106 D5/D6
as built retains read-only per-case reach **including `read_standard_phi`** (keystone `319`
A13; the Rule-12 read this platform most needs to reconstruct later) — the trail cannot
distinguish *"no hat was worn"* from *"pre-ACT row"* from *"written by a service-role/system
path"*.

**Not a violation and not blocking:** Rule 11 is met (the row records *that* and *who*;
`acting_as` is an ADR 0106 addition, not a Rule 11 requirement). This is **legibility** —
recording hatlessness explicitly (`'acting_as','none'`, or a `hatless: true` marker) turns an
inference into a fact for a few characters.

⚠ **Travels with the A13 ruling** (ADR 0106 D5/D14, S4 QA §3): if the PO ever rules that
hatless principals must lose relationship-derived reach, this class of row stops existing and
the follow-up dies with it. Do not implement it ahead of that ruling. Needs a migration —
deliberately out of S4, which shipped none.

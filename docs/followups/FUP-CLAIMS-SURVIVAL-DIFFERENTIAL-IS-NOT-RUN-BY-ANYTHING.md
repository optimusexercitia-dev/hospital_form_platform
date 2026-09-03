# FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING — the detector that found six false premises is a technique, not a gate (owner: backend/tester; filed 2026-08-24 at the close of FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-24 · status open

`claims_for` writes `request.jwt.claims` with `is_local => true`, so the claims outlive `reset role`. A
pgTAP test can therefore assert an owner-context property while still running as the last persona, and be
green for a reason unrelated to what it names.

**That class is now empty — and nothing keeps it empty.** It was emptied by a one-off differential: append
`set local request.jwt.claims = '';` after every `reset role;` (2171 sites, 172 files), run the suite, and
treat every moved verdict as a finding. Six were found and fixed. ⛔ **Nothing runs that comparison**, so a
test written tomorrow can reintroduce the defect and the suite stays green — the same *"standing in prose
only"* shape ADR 0079's door sweep was operationalised to escape.

⚠ **It cannot simply be bolted into `npm run lint`** — ADR 0127's stated bound: DB anchors are not
checkable there. And it is not a cheap check: it is a **full-suite run with a tree-wide edit applied and
then reverted**, i.e. the shape of the periodic `ARM=wrapper` sweep, not of a per-phase step.

⭐ **It has a working positive control already** — `358` G4 pins the hazard, so it MUST fail while the
instrument is applied. A run where G4 passes means the edit did not take, and the result must be discarded
rather than read as "clean". Any scripted version must assert that inversion before believing its own
output.

**Decide between:**
- **(a)** script it as a periodic audit (alongside the other ~100-min sweeps), with the G4 inversion as its
  self-test; or
- **(b)** rule the class closed-by-convention and rely on `test_helpers.reset_role_and_claims()` adoption —
  ⚠ but note the close measured that the verb is **not** a drop-in replacement for `reset role` (it needs
  `test_helpers` schema USAGE, which a restricted role may lack), so adoption is not mechanical.

**Owner:** backend/tester.

---

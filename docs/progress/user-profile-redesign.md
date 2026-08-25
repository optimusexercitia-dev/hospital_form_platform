# User-profile redesign + AFF3 / AUD1 / AUD2 — task record

**Closed 2026-08-25, PO-approved.** Branch `feat/user-profile-redesign`, 17 commits,
58 files, +6988/−825, base `8ecf51de`. Live-state pointer: PROGRESS.md § Now.

⛔ **Read the gate-step-2 deferral in § Gate before citing this as fully gated.** It is the
one step that did not complete on this machine, and it is deferred, not discharged.

---

## What shipped

**1. The person detail page** (`/o/[org]/manage/usuarios/[userId]`), rebuilt from the design
spec in `docs/design/temp/user_profile_redesign/` and *adapted*, not copied. Breadcrumb →
identity band → two-column grid; nine new components under `src/components/users/`; the edit
form became a modal (`personal-data-dialog.tsx`). `role-catalog.ts` moved
`src/components/role/` → `src/lib/role/` with five importers repointed — a client component
importing from a server query module aborts `next build` while tsc and lint stay green
(gate `lint:client-server-imports` exists for that class).

PO decisions taken during the build, each reversing or upholding a prior one:

| decision | outcome |
|---|---|
| scope | spec + per-user audit timeline + admin-triggered password reset; **no schema migration** |
| CPF display | **masked digits**, server-computed — reverses ADR 0133 D12 "presence only" (ADR [0144](../decisions/0144-masked-cpf-on-the-person-detail-rail.md)) |
| Registros | **single registry** upheld — dialog 3b's chrome, one group |
| Vínculo | **per-row "Editar"** added; the design had dropped `updateAffiliation` |

**2. AFF3 — ADR [0145](../decisions/0145-ever-held-affiliation-read-visibility.md).** Person
read visibility follows an **ever-held** affiliation. One conjunct — `and ha.ended_on is
null` — removed from the affiliation leg of all THREE policies carrying it
(`profiles_admin_select`, `profiles_select_self_or_admin`,
`professional_credentials_select`). The credentials leg mirrors the profiles legs by ADR 0133
D13 Amdt 2, so widening only `profiles` would have re-created the blank-Registro em-dash that
leg was written to remove.

⭐ **The framing that made it obvious**: `list_org_people` is `prosecdef` and does not gate on
affiliation at all, so the directory has **always** listed offboarded people while `profiles`
returned zero rows for the same caller. The platform listed a person you could not open. The
DEFINER door and the RLS policy disagreed and only the door was ever consulted.

**3. AUD1 — ADR [0146](../decisions/0146-org-admin-reads-hospital-tier-audit.md).** An
`org_admin` reads the HOSPITAL-tier audit rows of its own organization. One conjunct
(`hospital_id IS NULL`) removed from `audit_log_select`'s org leg. Measured, both sides scoped
to org A: commission 173/173, org 16/16, **hospital 19/0 → 19/19**. Total blindness on one
tier, hiding 15 `membership.granted` + 4 `affiliation.created`.

**4. AUD2 — ADR [0147](../decisions/0147-audit-org-derived-from-hospital.md)**, from QA B1.
`audit_write` now derives the org via `app.org_of_hospital` when a hospital is supplied and no
org is; leg 5 of `audit_log_select` gains `hospital_id IS NULL`. Of 179 `audit_write` callers,
27 pass a hospital and exactly one omitted the org — fixed as a class, not as that caller.

⛔ **No backfill, barred twice over**: `guard_audit_immutable()` raises `HC042`
unconditionally so the UPDATE never lands, and `v_org` feeds `audit_canonical` → the sha256
`row_hash` so a forced write would break the chain. Consequence, stated because it is
permanent: pre-existing malformed rows stay invisible to their org_admin forever. Only the
platform_admin half was recoverable, and leg 5 recovers it **retroactively** because a
predicate change touches no data.

---

## Gate

| step | state |
|---|---|
| 1 · build | ✅ ten lint gates · typecheck · `build` exit 0 · vitest 1727/1727 · pgTAP **7318/7318** fresh reset · `ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 ARM=wrapper` all HOLD · diff-scoped sweep over `audit_log_select` **CLEAN (1 COVERED, 0 BLIND)**, findings file restored byte-identical |
| 2 · test | ⚠ **DEFERRED — see below** |
| 3 · QA | ✅ **APPROVED (r2)** — [review](../reviews/user-profile-redesign-review.md), looped from CHANGES REQUESTED |
| 4 · human | ✅ 2026-08-25 |
| 5 · record | this file |

### ⛔ Step 2 is DEFERRED, not discharged

The seven affected specs are **GREEN (54/54, exit 0)** on a fresh prod build at HEAD. The
**full** `e2e:prod` is **RED at 18 failures** and cannot go green on this machine:

- **macOS native-`<select>` keyboard divergence (5)** — `ArrowDown` does not advance a focused
  native `<select>` on macOS. `e2e-prod-gate.sh:38` states the gate is *primarily for the
  LOCAL Windows prod-standalone run*; these have never been exercised here.
- **`open_document_version` returns HTTP 500 (6)** — `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE`.
- 19 further tests **never ran**, aborted by the above.

Both clusters were proven **not** caused by this branch, two structural ways: reproducible with
a bare `curl` (no Next app in the path) and with both migrations removed followed by
`db reset`. **PO ruled 2026-08-25: the full suite runs on a different machine.** Until that
run exists, this batch has *no* full-suite evidence — ⛔ do not read step 1's green as
covering it. (The failure mode this guards against is recorded one row over: 22-v3 stated its
own gates and under-reported itself for 13 days, because evidence arriving *elsewhere and
later* never reaches the row that asked for it.)

---

## Filed, not fixed

| item | why it was not done here |
|---|---|
| **C5** `FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION` | Critical. AFF3 gives a wrong-hospital admin permanent read; there is no delete path. Semantics, not mechanism — a third tense on a policy two migrations just simplified. Trigger: **before the first real hospital roster is loaded** |
| `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` | Pre-existing, app-facing, root cause unidentified |
| `FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME` | Shared control, 23 call sites, ~20 predating this branch; changes accessible names |
| `FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY` | Tester's file; a dead selector makes an auto-reinstate test suspend nobody |
| `FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY` · `-DESTROYS-ITS-OWN-BASELINE` | Gate tooling |
| `FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS` | Consequence of the two clusters above |

---

## What this batch is actually worth remembering for

**Five findings across two reviewers were false, and measurement caught every one.** QA's M6
(`<label for>` does not name a button — the repo had *already* recorded that premise as
measured-false at `patient-fields.tsx:305`), M11 (a render branch behind a validated CHECK,
unreachable), half of M9, M12's line relocation — and two of mine: I attributed the no-backfill
bar to the hash chain when a trigger fires first, and I wrote a false claim about `cpfPresent`'s
consumers **inside the commit correcting false claims** (R2-M1).

⭐ The two techniques that settled every attribution question were structural rather than
circumstantial: **reproduce it without the app** (a bare `curl` past the whole frontend) and
**remove your own migrations and `db reset`**. Both bound the blame without needing a correct
theory first. Three plausible environmental theories died before them — a missing PDF renderer,
PostgREST v14.5, a schema-cache reload — each refuted by one cheap measurement.

⛔ And C5 exists because a reviewer asked not *"does the widening work"* but **"what did the
widening remove"**. Every gate, keystone and probe on AFF3 measured the new visibility; none
could have surfaced C5, because nothing broke — a capability quietly stopped existing.

# FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

⚠ **The deferral is real and PO-ruled; what was missing is the REGISTER LINE.** ADR 0133
**Amendment 2** closes with two deferrals *"named so they are records rather than omissions"*.
Measured 2026-08-24: the sibling (`error.tsx` for the `usuarios` route) was **built** —
`src/app/o/[org]/manage/usuarios/error.tsx` exists — and this one appeared in **no register at
all**: zero occurrences in `follow-ups-open.md` and `deferred-backlog.md`, and PROGRESS.md's only
`registro` is the unrelated REG·KIND row (`:98`). ⚠ **That citation is spent as of 2026-08-25** —
REG·KIND closed and its row rotated to [phase-ledger.md](../progress/phase-ledger.md), so PROGRESS.md now
contains **no** `registro` at all. The finding STRENGTHENS: the last near-miss is gone too. ⭐ Of a pair named so that neither would become an
omission, the one that became an omission is the one that stayed deferred — **naming a deferral
inside an ADR is not filing it**, because nobody reads an ADR to find out what is open.

**What is deferred.** The design handoff's directory search reads *"Buscar por nome, e-mail ou
**registro**…"* — `docs/design/temp/user_management_redesign/Gestão de Usuários.dc.html:82` **and**
`:374`. The live search matches **name and e-mail only**.

✅ **Nothing is user-visibly false today, which is why this is 🟡 and not a bug.** Amdt 2's other
half shipped: label and placeholder both read *"Buscar por nome ou e-mail"*
(`src/components/users/user-directory-search.tsx:72,83`), replacing a pre-existing false claim
(*"ou categoria"* — never searched, and it had propagated into the visible `aria-label`). The
docblock at `src/lib/queries/org-users.ts:349-360` records the deferral in code, and until this line
existed it was the **strongest record of it anywhere** — visible only to someone already reading the
function they would have to change.

⛔ **TWO query sites, not one.** `listOrgUsers` (`org-users.ts:401`) and `listHospitalUsers` (`:487`)
each build the same `full_name.ilike,email.ilike` `.or()`. Fixing the first alone gives org admins
and hospital admins **different search semantics on the same screen** — against ADR 0133 D14, whose
premise is that both roles get the same screens with the differences data-side.

**Shape of the fix, if it is built.** The number is `professional_credentials.registration_number`
(`org-users.ts:68-76`) — a **1→N** table the directory already batch-reads per page in
`loadPageExtras` (`:258`). So the leg is a **join filter**: resolve matching `user_id`s and `.in()`
them, the shape `hospitalPeopleIds` (`:133`) already uses and whose `:124` comment explains why a
resolved set beats a raw `.or()` string. Never another `.or()` clause on `profiles`.
⚠ **It must respect ADR 0133 D13's widened `professional_credentials` SELECT.** A hospital_admin who
may *see* a person but not *read* their credential must not get a search returning fewer rows than
their own directory shows — that is the *"empty never means no-permission"* trap D13 exists to
remove, re-entered through the search box. A DENY-arm keystone belongs with the build.

**A decision is owed before any build.** Ruling *"not building it — the label is honest now"* is a
legitimate close; **drifting into that by never deciding is not**, and was the live state for a day.

**Owner:** backend/PO.

---

# AFF2 — implementation plan: affiliation-scoped administration + user-management redesign

**Authority:** ADR [0129](../decisions/0129-aff2-affiliation-scoped-administration-um-redesign.md)
(all decisions PO-approved 2026-08-20). Design reference:
`docs/design/temp/user_management_redesign/` (README + `Gestão de Usuários.dc.html`;
option **1a** directory + profile, **1b** wizard; the HTML is a reference, never shipped).
**Start condition:** after the PO's merge call on `feat/previa-split-adr-0125-0126`
(no file overlap, but one unmerged feature branch at a time — the "claimed unmerged
for 5 days" lesson).

**Shape:** one gated workstream, three tracks (backend `backend`, frontend `frontend`,
tester `tester`), standard §6 phase gate, then `qa`. Contract-first: B1–B3 land before
F starts screens that need the new data; F1 can start immediately against existing data.

---

## Track B — backend

### B1 · Migration: `profiles.date_of_birth` + `profiles.phone` (ADR 0129 D9–D10)

- `date_of_birth date null`, `phone text null` (phone stored as digits-only or
  lightly-normalized string; display formatting is frontend). Column comments state
  the LGPD justification and the column-lock posture.
- ⛔ **Do NOT add either column to any `authenticated` column-list grant** (SELECT or
  UPDATE) — `profiles` has column-list grants since `20260909000200`; the default for
  a new column is *absent*, which is exactly right. Verify with a live
  `information_schema.column_privileges` probe in pgTAP, not by reading the migration.
- Check `guard_profile_privileged_columns` interplay at build time: decide whether the
  new columns join the self-mutation lock (they should — self-service is deferred,
  FUP-AFF2-CONTA), and remember the trigger is late-bound plpgsql (the 0097
  drop-column lesson applies in reverse: compare-by-name is safe to add, but test a
  self-UPDATE path).
- `npm run gen:types` after; consumers treat both as `string | null`.
- pgTAP: column-grant absence probe + guard behavior.

### B2 · Migration: `professional_credentials` SELECT widening (D13)

- Add two legs to `professional_credentials_select`, mirroring the AFF `profiles`
  widening: **(affiliation leg)** owner has an active `hospital_affiliations` row at a
  hospital the caller administers; **(membership leg)** owner holds an active
  commission-tier membership whose commission's `hospital_id` the caller administers.
  Existing legs (self / `app.is_admin()` / org_admin-of-home-org) unchanged.
- pgTAP keystones, **both arms**: ALLOW (hospitaladmin.a1 reads a credential of a
  person affiliated/committee-seated at their hospital — including the
  zero-committee-but-affiliated person) and DENY (a sibling hospital's admin, and a
  hospital admin of the *other org*). Per 0097 D6's caveat, the DENY arm pins the
  default state, not a tenant boundary — say so in the test comment.
- **Fixture discipline:** self-contained fixed-id fixtures — never seed-random ids
  (the 250/251/252 keystone fragility lesson).
- Gate consequence: **diff-scoped `ARM=policy` door sweep over exactly this policy**
  (recipe: ADR 0079 Amendment 1), plus the standard four ARMs.

### B3 · Migration: `list_org_people` payload gains `date_of_birth` (D11)

- **Re-emit the DEFINER body from the live `pg_get_functiondef`** — never from
  migration file text (the BE-6·N regression lesson); signatures keep
  `extensions.citext` (the remote-apply 42704 lesson). Payload adds `date_of_birth`
  only; phone stays out; grants/REVOKE posture unchanged (no new door).
- pgTAP: payload shape + the existing audit-row assertions still hold; the CPF-probe
  audit path is untouched.
- Included in the diff-scoped sweep (a gate body changed).

### B4 · The scope-rule authorizer + action rewiring (D1–D4)

File: `src/lib/users/actions.ts` (+ a small pure helper module for testability, e.g.
`src/lib/users/person-scope.ts`).

- **`authorizePersonScopedAdmin(userId)`** — resolves, via the admin client:
  1. target's `home_organization_id`; caller's org_admin orgs → org_admin arm passes
     as today;
  2. else caller's administered hospitals in that org (session context);
  3. target's memberships: **any non-commission-tier row ⇒ deny** (tier derived
     structurally — commission-tier ≡ `commission_id IS NOT NULL`, matching
     `memberships_scope_shape`; do not hardcode a role list);
  4. footprint = active affiliations (`ended_on IS NULL`) ∪
     `commissions.hospital_id` of the commission-tier memberships;
  5. allow iff footprint ≠ ∅ ∧ footprint ⊆ administered set.
- Swap `authorizeOrgAdminForUser` → the new authorizer in: `updateUserProfile`'s
  person-level gate (line ~773), `upsertCredential`, `removeCredential`,
  `deactivateUser`, `reactivateUser`, `suspendUser`. `authorizeOrgAdminForUser`
  itself stays for any true org-only surface (grep for residual callers; if none
  remain outside the swap set, delete it — no dead authorizers).
- `updateUserProfile` + `registerUser` gain `dateOfBirth` / `phone` (optional;
  same undefined-means-untouched write discipline as `cpf`).
- `registerUser`: confirm the hospital-admin path **always** creates the affiliation
  (D8) — the hospital is already hard-set server-side; verify `ensureActiveAffiliation`
  runs even when the wizard's step-2 details were skipped (matrícula/date null).
- The `updateUserProfile` person-level-change detector now also compares
  `date_of_birth` and `phone` (they are person-level fields under D3).

### B5 · Vitest keystone matrix (D4)

Six arms minimum, exercised through the real actions (not the helper alone):
sole-hospital target ALLOW · cross-hospital footprint DENY · org-tier target DENY ·
hospital-tier target DENY (technical_director at the **caller's own** hospital — the
sharp case) · zero-footprint DENY · sibling-hospital admin DENY. Plus: lifecycle
actions by a scoped hospital_admin succeed end-to-end; `lint:vacuous` will police the
assertions — write them to fail first.

### B6 · Detail-page locked-column read (D10, D12)

- A small server-side helper (admin client, behind the same authorizer) returning
  `{ dateOfBirth, phone, cpfPresent: boolean }` for the profile rail. Never returns
  CPF digits. Lives in `src/lib/users/` beside the actions (it is an authorized
  service read, not an RLS query — document why it is not in `src/lib/queries/`).

### B7 · Directory query widening (D14)

File: `src/lib/queries/org-users.ts` (RLS-scoped cookie client — Rule 9).

- Add to the page assembly, **batched** (`.in('user_id' | 'principal_id', pageIds)`,
  never per-row): council credential (first/primary per person for the "Registro"
  column) and commission-tier memberships with commission name + role (+ hospital
  name) for the chips.
- `?status=` server-side filter (derive with the existing `deriveUserStatus`
  authority — never a parallel derivation) + pill counts from the **unfiltered**
  scoped set ("Atenção" = suspended ∪ pending). Keep `?search=` / `?hospital=` /
  paging semantics.
- Hospital-admin credential rows appear **only after B2 lands** — sequence B2 before
  the F1 hospital-admin verification pass.

## Track F — frontend

Must load the `frontend-design` skill before new screens; consult
`vercel-react-best-practices`. All copy pt-BR; tokens only (no raw oklch; the
`lint:css-vars` gate polices the Tailwind-v4 `[--var]` form); Server Components
except where interaction requires; every input labeled + keyboard-reachable +
visible focus.

### F1 · Directory table (`usuarios/page.tsx`, `user-directory-list.tsx`, `user-directory-search.tsx`)

Handoff §Screen 1: header + "Registrar pessoa"; pill row (Todos/Ativos/Atenção/
Desativados with counts, `?status=`); search + hospital select (org_admin
"Hospital: todos"; hospital_admin keeps `HospitalSwitcher`); table card with the
specified grid, row = full-row `Link`, deactivated at `opacity-60`; Pessoa
(avatar/initials, name, email) · Situação (`UserStatusBadge`) · Vínculo hospitalar
("2 hospitais" / "Sem vínculo hospitalar" muted) · Comissões chips (coordinator
accent, member muted, dashed "Sem comissão" — never an empty cell) · Registro
(mono; "—") · chevron; footer "N pessoas" + `UserPagination`; `.animate-rise-in`
40ms stagger; keep the existing empty-state copy rules.

### F2 · Profile page (`usuarios/[userId]/page.tsx` + panels)

Handoff §Screen 2: back link; identity band (avatar 54px, name + status badge,
"email · categoria", credential chip + "✓ verificado", "Na organização desde",
lifecycle actions); two-column grid (main + 320px rail, stacking < lg).
- **Authority-aware rendering (ADR 0129 D1–D3):** lifecycle buttons and the
  Dados pessoais / Registros "Editar" affordances render when the caller is
  org_admin **or** a scoped hospital_admin — the server component computes this
  with the same footprint inputs the action uses (compute server-side and pass a
  boolean; never re-derive client-side). Out-of-scope hospital_admin gets the
  ShieldAlert note with **updated, scope-aware copy** (the person works at another
  hospital / holds an appointed role → "administração da organização"); the old
  "somente organização" absolute is retired everywhere it appears.
- Vínculos hospitalares card: existing `AffiliationsPanel` actions (add via door,
  Encerrar with AlertDialog + the D5-of-0097 blocking-membership enumeration),
  ended rows dimmed with date range.
- Comissões card: `CommitteeRoleAssigner` semantics (add, change role), role pills.
- Rail: Dados pessoais — **CPF presence-only** ("Cadastrado ✓"/"Não informado"),
  Nascimento, Telefone, Categoria (via B6); Registros profissionais —
  `CredentialsEditor` (edit clears verification; caption as drawn).
- "Reenviar convite" only when status = pending; "Reativar" replaces
  Suspender/Desativar when deactivated.

### F3 · Register wizard (`usuarios/novo/page.tsx`, restructure `register-person-flow.tsx`)

Handoff §Screen 3 + ADR 0129 D6–D8: centered 620px column; stepper
(Identificação → Vínculo hospitalar → Comissões) reusing/extending
`src/components/ui/stepper.tsx`; one submit at the end via `registerUser`.
- **Step 1, identifier-first (D7):** CPF field leads (existing `CpfField` +
  `lookupOrgPeople` on complete CPF); branch: in-org unaffiliated → offer to
  affiliate; already affiliated → link to profile; foreign collision → D8 block
  copy; not found → reveal Nome, E-mail, Categoria (required) + **Nascimento,
  Telefone (optional)** + Registro profissional (optional, `CredentialsEditor`
  draft mode). CPF is **required** — no "(opcional)" label. Match cards show DOB
  when present (B3).
- **Step 2 (skippable):** Hospital (hospital_admin pre-locked via `?hospital=` and
  server-enforced), Matrícula, Data de início. For a hospital_admin, "Pular etapa"
  skips the details, **never the affiliation** (D8) — the step copy must say so.
- **Step 3 (skippable):** repeatable Comissão + Papel rows, scoped to the caller
  (`listManagedCommissions` for hospital_admin).
- **No escape hatch** — the footnote and "Enviar convite agora" are not built.
- Footer: "← Voltar" ghost / "Pular etapa" outline / "Continuar →" primary; final
  step primary = "Registrar e enviar convite". Errors via `FormBanner` + field
  errors. Success → redirect to the new profile (status Pendente).

### F4 · Copy + a11y pass

Scope-aware notes (F2), step captions, pill labels, empty states; keyboard-only
wizard walk; focus-visible on the full-row links; `prefers-reduced-motion` respected
(global tokens already do).

## Track T — tester (after F lands per-screen; never edits app code)

Playwright, chromium-first, personas from `supabase/seed.sql`:
1. **Directory:** pill filtering + counts vs seeded statuses; search; pagination;
   hospital switcher (hospital_admin); "Sem comissão"/"Sem vínculo" render; a
   deactivated row navigates.
2. **Scope rule end-to-end:** `hospitaladmin.a1@` edits name/category/credential and
   deactivates a **sole-hospital** person (ALLOW); the same actions against a
   cross-hospital person, a `technical_director` of their own hospital, and an
   unaffiliated person show the note and no affordances (DENY); `orgadmin.a@` retains
   everything.
3. **Wizard:** full walk (all steps) → Pendente profile; step-2/3 skips; hospital_admin
   registration always yields an affiliation row on the profile; CPF required
   (cannot proceed without); in-org duplicate CPF → affiliate offer;
   foreign-org CPF → block copy; invite email lands (Mailpit — local SMTP must stay
   `enabled=false`).
4. **Keyboard-only:** the full wizard, and the directory pills → row → profile path
   (native `<select>`s driven via `selectOption`, reachability via Tab — the macOS
   ArrowDown landmine).
5. Update any spec asserting the old card list / stacked profile / single-form
   register (stale-spec trap: fix the spec to the new UI with tester sign-off, never
   the reverse).

## Gate (§6, in order) — deltas specific to AFF2

1. Lint (all 8) · `tsc` · Vitest (incl. B5 matrix) · pgTAP on a **fresh reset**.
   Four authz ARMs + `FROMFINDINGS=1 ARM=wrapper`. **Diff-scoped door sweep over
   exactly**: the B2 policy + the B3 door (derive the list from the migration diff).
   No new door, no new role, no `prosecdef` flip is expected — if the build creates
   one anyway, it enters the census before the gate (a NEW gate passes `ARM=policy`
   vacuously; `ARM=census` is what catches it).
2. Tester green loop → full `npm run e2e:prod` once to declare.
3. QA review (`docs/reviews/aff2-review.md`) — explicitly: the six-arm matrix vs ADR
   0129 D1–D3, the column-grant absence for the new profiles columns, the B2 DENY
   arms, and a caller-level read of each rewired action (the prévia lesson: *a
   keystone proves the door, a second caller proves nothing about the real one* —
   verify the actual UI paths reach the widened actions).
4. Human approval. 5. Record: PROGRESS.md rotation per the contract, ledger row,
   `docs/backend-state.md` (B2/B3 surface changes), ADR 0129 status → note build
   completion; name the ARMs run, never the script.

## Risks & open items

- **B2 is the only RLS change** — keep it minimal; resist widening `memberships`
  SELECT "while we're here" (0097 finding 3's blank-row gap is *profiles*-side and
  already fixed; anything else is scope creep into a swept surface).
- **Footprint reads are admin-client** — the authorizer must assert its own
  preconditions (persona confounders falsely confirm; the ad-hoc-probe lesson).
- The directory widening multiplies per-page queries — keep it at 3 batched selects
  (profiles page, credentials-in, memberships-in) and measure before optimizing.
- `docs/design/temp/` is a temp drop — after F-track sign-off, move the handoff to
  `docs/design/user-management-redesign/` (or delete per PO) so `temp/` doesn't
  become a permanent home.
- FUP-AFF2-CONTA (self-service DOB/phone on `/conta`) is registered in PROGRESS.md
  follow-ups at build start, not silently dropped.

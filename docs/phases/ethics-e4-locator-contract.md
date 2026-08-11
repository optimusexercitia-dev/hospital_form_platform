# ETH·E4 — Locator & signature contract (LEAD-OWNED · BINDING)

Purpose: let `frontend`, `backend` and `tester` build **in parallel** and run the E2E
suite **once**. This project has **no `data-testid` convention** in `src/components/cases`
— specs locate by **role + pt-BR accessible name**. So these strings are the contract.

**Binding on everyone. Nobody edits this file except the lead.** If a string here is
wrong or unbuildable, message the lead — do **not** silently pick another.

---

## 1. Roster panel — `case-participants-panel.tsx` (frontend)

| Element | Role / shape | Accessible name (exact) |
| --- | --- | --- |
| Panel wrapper | `<section aria-labelledby="case-participants-heading">` | — |
| Panel heading | `h2#case-participants-heading` | `Participantes` |
| Empty state | text | `Nenhum participante registrado.` |
| Add button | `button` | `Adicionar participante` |
| Roster rows | `ul` > `li` per participant | — |
| Primary-subject marker | text badge inside the row | `Sujeito principal` |
| Row: change role | `button` | `Alterar papel` |
| Row: set primary | `button` | `Definir como sujeito principal` |
| Row: remove | `button` | `Remover` |
| Row: resolve linkage | `button` (only when link state is `unknown`) | `Resolver vínculo` |

The row exposes the participant name and role as text. Name rendering follows ADR 0108
D3: live `professional_profiles.full_name` when readable, else `participants.display_name`.

### 1a. What each row action actually opens (pinned 2026-08-11 — the tester hit this)

**`Alterar papel` is a DROPDOWN MENU, not a dialog and not an inline select.** Trigger is
the `Alterar papel` button; the menu carries a `Definir papel` label, a separator, and one
item per allowed role (the current role's item is disabled). Selecting an item fires the
action directly — **there is no submit button**. Playwright shape:

```ts
await row.getByRole('button', { name: 'Alterar papel' }).click()
await page.getByRole('menuitem', { name: 'Testemunha' }).click()
```

**`Remover` opens an AlertDialog** — the house pattern for a destructive row action,
proven in `e2e/phase3-admin-members.spec.ts` and already used in this very directory by
`case-corrections-panel.tsx`. Strings, matching that pattern exactly:

| Element | Role | Accessible name (exact) |
| --- | --- | --- |
| Trigger | `button` | `Remover` |
| Confirm dialog | `alertdialog` | `Remover participante?` |
| Confirm | `button` | `Remover` |
| Cancel | `button` | `Cancelar` |

**`Definir como sujeito principal` confirms ONLY when it will demote an incumbent.**
ADR 0108 D2 changed this door from *impossible* (a second primary raised `HC0E7`) to
*silently succeeds and demotes the current primary*. On a disciplinary case the primary
subject is the accused — reassigning who the case is **about** must not be a single
unconfirmed click. When no primary is set yet there is nothing to demote: fire directly,
no dialog.

| Element | Role | Accessible name (exact) |
| --- | --- | --- |
| Trigger | `button` | `Definir como sujeito principal` |
| Confirm dialog (only when an incumbent exists) | `alertdialog` | `Alterar o sujeito principal?` |
| Confirm | `button` | `Alterar sujeito principal` |
| Cancel | `button` | `Cancelar` |

The dialog body **names the participant being demoted**, so the consequence is legible
rather than implied.

⚠ `CasePrimarySubjectPanel` (rail) and `CasePatientPanel` are **NOT touched** — E3a E2E
asserts the rail card's heading and empty state.

## 2. Add-participant dialog — `add-participant-dialog.tsx` (frontend)

| Element | Role | Accessible name (exact) |
| --- | --- | --- |
| Dialog | `dialog` | `Adicionar participante` |
| Lane choice | radiogroup | `Tipo de participante` |
| — option A | radio | `Profissional` |
| — option B | radio | `Pessoa externa ou órgão` |
| Role select | combobox/select | `Papel` |
| Involvement note | textbox | `Resumo do envolvimento` |
| Submit | `button` | `Adicionar` |
| Cancel | `button` | `Cancelar` |

### 2a. Professional lane

| Element | Role | Accessible name |
| --- | --- | --- |
| Typeahead | `combobox`/textbox | `Buscar profissional` |
| Switch to create | `button` | `Cadastrar novo profissional` |
| Full name | textbox | `Nome completo` |
| Professional type | **textbox (free text)** | `Tipo profissional` |
| License | textbox | `CRM` |
| License region | textbox | `UF do registro` |
| Specialty | textbox | `Especialidade` |
| **Linkage choice (required, NO default — ADR 0108 D6)** | radiogroup | `Vínculo com conta na plataforma` |
| — has account | radio | `Possui conta` |
| — no account | radio | `Não possui conta` |
| Platform user picker (only when `Possui conta`) | combobox | `Usuário da plataforma` |
| **`no_account` consequence confirmation** (only when `Não possui conta`) | checkbox | `Confirmo que este profissional não possui conta na plataforma e que, por isso, o impedimento automático no caso não será aplicado.` |

The submit button stays **disabled** until the linkage radiogroup has a selection —
`no_account` must never be reachable by accepting a default.

### 2b. External lane

| Element | Role | Accessible name |
| --- | --- | --- |
| Reuse-first search | textbox | `Buscar participante externo` |
| Switch to create | `button` | `Cadastrar novo` |
| Type select | select | `Tipo` |
| Display name | textbox | `Nome` |

External type option labels (the five non-sensitive types):
`external_person` → **`Pessoa externa`** · `department` → **`Setor`** ·
`institution` → **`Instituição`** · `regulatory_body` → **`Órgão regulador`** ·
`other` → **`Outro`**

## 3. Resolve-linkage dialog — `resolve-linkage-dialog.tsx` (frontend)

Dialog accessible name `Resolver vínculo` (same string as the roster row button, §1);
reuses the **same** radiogroup, user picker and confirmation-checkbox strings as §2a.

| Element | Role | Accessible name (exact) |
| --- | --- | --- |
| Submit | `button` | `Registrar vínculo com conta` |
| Cancel | `button` | `Cancelar` |

**Why not `Salvar`, and why not bare `Registrar vínculo`** (pinned 2026-08-11 after the
tester flagged the gap):
- The codebase's convention for an **audited assertion** is `Registrar <object>` —
  `Registrar voto`, `Registrar impedimento`, `Registrar resultado`. `Salvar` appears
  nowhere as a submit label and would understate what ADR 0108 D6 makes this: an audited
  human assertion whose `no_account` branch makes the case exclusion vacuously satisfied.
  It must not read as a casual save.
- **`Registrar vínculo` is already taken** —
  `src/components/users/affiliations-panel.tsx:434,499` uses it for *hospital affiliation*
  (ADR 0097), an unrelated sense of "vínculo". An exact-string reuse is an E2E locator
  collision hazard in a repo that has been bitten by exactly that.
- `…com conta` disambiguates against the affiliation sense and matches the §2a radiogroup
  label `Vínculo com conta na plataforma`.

⚠ Not `Adicionar` — this dialog adds nothing; it resolves the state of an existing profile.

## 4. Seeded role labels (already in `seed.sql` — do NOT re-invent)

`respondent_doctor` → `Médico denunciado` {professional} ·
`complainant` → `Denunciante` {external_person, professional} ·
`witness` → `Testemunha` {external_person, professional} ·
`investigator` → `Relator` {professional} ·
`legal_representative` → `Representante legal` {external_person} ·
`external_regulatory_body` → `Órgão regulador externo` {regulatory_body} ·
`affected_patient` → `Paciente afetado` {patient}

The `Papel` select lists only roles whose `allowed_participant_types` contains the chosen
participant's type — so `HC0E3` is unreachable in normal use.

## 5. Frozen TypeScript signatures (backend owns; frontend/tester code against these)

`src/lib/participants/actions.ts` — the **7 existing signatures are the frozen BE-1
contract; do not change them**. Bodies get implemented. Exactly one **additive** export:

```ts
export async function createExternalParticipant(
  organizationId: string,
  participantType: string,
  displayName: string,
): Promise<ActionState & { participantId?: string }>
```

`src/lib/queries/participants.ts` (new, Rule 9):

```ts
export async function searchParticipants(
  organizationId: string,
  query: string,
  participantTypes: ParticipantType[],
): Promise<ParticipantSearchResult[]>

export async function listCaseParticipantRoles(
  organizationId: string,
  caseTypeId: string | null,
): Promise<CaseParticipantRoleOption[]>
```

`ParticipantSearchResult` carries at minimum: `participantId`, `displayName`,
`participantType`, and — professional lane only, when readable — `professionalProfileId`,
`licenseNumber`, `specialty`, `linkState`.

**Backend publishes these types FIRST (typed stubs), before implementing bodies**, so
frontend never invents a provisional shape.

## 6. pt-BR error copy (backend maps; tester may assert)

`HC0E3` papel inválido para o tipo de participante · `HC0E4` sem permissão ·
`HC0E7` já existe sujeito principal · `HC0F0` vínculo não resolvido ·
`HC0F1` impedido no caso · `HC0F2` vínculo congelado.
Raw Postgres errors never reach the UI (CLAUDE.md §8).

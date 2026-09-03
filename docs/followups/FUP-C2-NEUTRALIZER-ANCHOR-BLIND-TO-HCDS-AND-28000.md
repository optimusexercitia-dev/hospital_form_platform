# FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000 — the C2 neutralizer's anchor is a SYNTAX, not a property: it excludes the DSR authz family AND sweeps in non-authz state guards, so "458 authz raises" is wrong in both directions

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

⚠ **The ID names only the first half.** It is kept unchanged because an ID is the join key and a rename orphans every name-keyed verdict (register header rule). The **second half — semantic over-breadth — is recorded in the same entry below** and is the half that changes what C2 may CLAIM.

(no evidence any DSR door is unguarded), which is why it is not 🔴. It is not 🟡 because it silently
bounds the population of **the instrument C2's closure argument rests on**, and the affected doors
are the LGPD Art. 18 subject-rights lane.

`c2-command-door-neutralizer.sh` anchors on `errcode = '(42501|HC0[A-Z0-9]{2})'`. That class
requires a **literal `0` in position 3**, so the whole `HCDS*` family is outside it.

**Measured** (2026-09-02, while the full sweep was running):

- The anchor appears at four sites: the mutation regex at `:182` with its `v_before`/`v_after`
  counters at `:180`/`:184` — and, decisively, **the gate-function filter at `:153`**
  (`where f.body ~* 'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})'''`).
- ⛔ **Because `:153` filters the gate-fn set itself, a door whose authz raises are ONLY `HCDS*`
  or `28000` is never admitted to the worklist.** This is not "present but unmutatable" — it is
  structurally absent from the 171, and therefore from every verdict the sweep will print.
- Raises invisible to the anchor, counted over the 519 migration files:
  `HCDS5` 20 · `HCDS3` 16 · `HCDS1` 14 · `HCDS2` 7 · `HCDS4` 3 = **60**, plus **6** at `28000` —
  which is the SQL-standard `invalid_authorization_specification`, an authz code by definition.
  (`P0002` 168 and `23514` 22 are also unmatched and are correctly excluded — `no_data_found` and
  `check_violation` are not authz.)
- Source files: `20261001000000_dsr_dpo_capability.sql`, `20261001000100_dsr_request_workflow.sql`,
  `20261002000100_dsr_adjudication_and_attested_tier.sql`, `20261002000300_dsr_retire_tasks_on_refusal.sql`.
- **3 DSR-named rows DO appear in the worklist** — functions carrying *both* families. For those the
  mutation is **PARTIAL**: only the `HC0*` raises are rewritten and the `HCDS*` raise survives and
  goes on guarding. The surviving guard can keep the suite green, which the harness reads as
  **BLIND**. ⚠ That is a **FALSE BLIND** — conservative in direction (it over-reports risk rather
  than under-reporting it), but it will send someone to write a keystone for a guard that already
  works, and it corrupts the BLIND rate.

⚠ **The counts above are derived from MIGRATION TEXT, which CLAUDE.md makes non-authoritative** —
144 migrations rewrite bodies at runtime via `pg_get_functiondef()` + `replace()` + `execute`. Treat
them as an upper bound and **re-derive against the live catalog** (`pg_proc.prosrc`, `prosecdef`)
once the DB window closes. What is NOT text-derived, and is certain, is the anchor itself at `:153`.

**What would close it:** widen the anchor to the full project code family (`HC[A-Z0-9]{3}`) plus
`28000` at all four sites, re-derive the worklist against the live catalog, and sweep **the delta**
— the enforcers the widened anchor admits that the current 171 did not. The existing verdicts stay
valid for what they measured; this is additive, not a re-run.

⛔ **What must NOT be mistaken for closing it:**
- **The full 171-enforcer sweep completing.** It cannot cover what its own filter excluded. When it
  reports, its coverage claim must carry the qualifier *"of enforcers anchored on `42501|HC0xx`"* —
  ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) §3's corollary (state the
  uncovered population beside the covered one) binds here with unusual force, because this uncovered
  population is invisible in the instrument's own output rather than merely unstated.
- **A green `ARM=census`/`floor`/`hat`/`policy`/`wrapper`.** Those arms bound their domain by
  `prosecdef` and return type, not by errcode, so they neither cover this class nor notice it.
- **Allowlisting the 3 partial-mutation rows.** Their BLIND verdicts are artifacts of a partial
  mutation; the fix is to widen the anchor and re-measure, never to record the artifact.

---

#### The second direction — the anchor is SEMANTICALLY TOO BROAD (added 2026-09-02, same root cause)

`HC0[A-Z0-9]{2}` matches **every** `HC0*` code, and this project's `HC0*` space is not an authorization
space — it is the whole application error space. **Measured** by reading the raise messages out of the
migrations:

| Code | Message (pt-BR, as raised) | What it actually guards |
| --- | --- | --- |
| `HC038` | *"esta entrevista não pode ser cancelada neste estado"* · *"apenas entrevistas em andamento podem ser concluídas"* | **state / lifecycle** |
| `HC043` | *"apenas eventos notificados podem ser reconhecidos"* · *"este evento já está em um estado final"* | **state / lifecycle** |
| `HC039` | *"você não pode editar esta entrevista"* · *"sem permissão para editar esta entrevista"* | **authorization** |

Consequences, and they are not cosmetic:

- ⛔ **The sweep does not measure authorization coverage. It measures `HC0*`-coded-guard coverage.**
  Those are different populations, and only the first is what C2 exists to close. Every claim built on
  this run must say which one it means.
- **The handoff's "458 authz raises across the 171" is an OVERCOUNT** — an unknown share are state and
  validation guards. The figure was never wrong as arithmetic; its **label** is wrong.
- **A BLIND verdict may be about a state guard**, and would then read in a findings table as an
  authorization hole. ⭐ **Worked example, measured:** `public.cancel_session`'s only anchored raise is
  **HC038 — terminal-state**. Its authorization lives in `app.assert_interview_writable` (**HC039**), a
  SEPARATE worklist row the mutation never touches. So the intuitive remedy — *"make a non-writer get
  HC039"* — **would not flip that verdict**, while reading in a commit message exactly like a fix.
  A keystone for `cancel_session` must assert **HC038**.
- ⚠ This does **not** make the BLIND verdicts worthless: a state guard that can vanish with the whole
  suite still green is a real coverage gap. It makes them **mislabelled**, which is the more dangerous
  failure because it survives review.

**What closes this half:** classify the `HC0*` space by property (authorization vs state vs validation)
and split the anchor, so the harness can report the two populations separately. ⛔ **Not closed by**
widening the anchor for the HCDS half — that fixes the narrowness and leaves the mislabelling untouched.

#### The third direction — CONFIRMED LIVE: 39 raises fail closed as ERROR, concentrated on the PHI lane

⭐ **Predicted by code reading, then observed in the running sweep — the strongest form of this finding.**

The mutation anchor is `raise\s+exception[^;]*?errcode…`. `[^;]*?` is a **negated semicolon class**, so it
cannot span a `;` **inside the message literal**. Such a raise is a clean non-match: `v_before` still counts
it (that counter anchors on the *errcode*, which sits after the message), so `v_after <> 0` and the harness
raises `C2MUT: N raise(s) survived the rewrite`. `execute v_new` is **downstream** of that check, so the
function is never half-mutated — it is **not mutated at all** and gets **NO VERDICT**.

**Measured 2026-09-02** (multiline scan of the 519 migration files — ⛔ line-based `grep` finds ZERO of
these, because the message and its `using errcode` sit on **different lines**; a single-line grep here
returns a false all-clear):

- **2294** anchored authz raises total; **39** carry a `;` inside the message literal (~26 distinct shapes).
- **Confirmed live in the run:** `public.set_referral_patient` (2 survived) and
  `public.set_professional_link_state` (1 survived) both recorded **ERROR · MUTATION DID NOT LAND**.
  The culprit in the first is verbatim `20261003001700_referral_phi_amend_is_draft_only.sql:109-110`:
  `raise exception 'encaminhamento concluído; os dados do paciente não podem mais ser alterados'` /
  `using errcode = 'HC078';`
- Observed ERROR-by-this-mechanism rate **2 of 33 enforcers (~6 %)** → expect **~10 of the 171 to finish
  the sweep with no verdict**.

⛔ **Why this is the sharp end and not a curiosity: it concentrates on the PHI surface.** `HC078` appears
**twice**, both in the referral-PHI lane, and `dispose_referral_phi` is a third. ADR
[0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) §3 makes **the tenant-boundary/PHI
subset** the part of C2 that must close before Gate AE4's PO approval — so the defect removes verdicts
from precisely the doors the gate depends on. **`set_referral_patient` is a Rule 12 PHI door
(`referral_patient`) and currently has NO coverage verdict.**

✅ **The good news, and it is real:** this fails **closed**. It can never produce a false COVERED or a
silent wrong verdict — only a visible ERROR. The harness's own rule (*ERROR IS NOT A PASS — each is an
obligation*) is what makes the class recoverable.

✅ **FIX VALIDATED OFFLINE 2026-09-02 — 35 fixed, 0 regressions, 0 residue.** Consume the message as a
proper quoted literal *before* scanning for the errcode:

```
raise\s+exception\s+'(?:[^']|'')*'[^;]*?errcode\s*(=|=>)\s*'(42501|HC0[A-Z0-9]{2})'\s*;
```

Measured by replaying both anchors over every anchored authz raise in the 519 migration files
(`scratchpad/regex-fix-validation.txt`; each raise located by windowing back from the errcode the
harness's own counter matches):

| | raises matched |
| --- | ---: |
| examined (the counter's population) | **2294** |
| matched by the CURRENT anchor | 2259 — **misses 35** |
| matched by the CANDIDATE anchor | **2294** |
| regressions (current matched, candidate did not) | **0** |
| residue still unmatched | **0** |

⚠ **Two honest caveats.** (1) This is Python `re`, not Postgres **ARE**, where the harness actually
runs. The construct `'(?:[^']|'')*'` is supported by both and the two engines agree on it, but
**confirmation with `regexp_replace` in Postgres is owed** once the DB window closes. (2) The earlier
figure in this entry — *39* raises with a `;` — was measured with `.*?` between message and errcode,
which under `re.S` can span **across** statements and therefore overcounts. **35 is the better
number**; the windowed re-measurement is the one to trust, and residue is what matters: it is 0, so
the `detail =`/`hint =` worry raised alongside the original estimate is **empty in practice**.

#### Worked example that settles an open question — `public.save_block_to_library`

The handoff recorded this as owed: *"5 authz raises, 4 anchored. The harness will record it ERROR ·
UNMUTABLE rather than partially mutate. Someone must decide whether the 5th raise is authz-relevant."*
It recorded **ERROR · UNMUTABLE** in this run, as predicted. **Ruling, from the raise texts**
(`20260903000200_ff4_save_block_to_library.sql`):

| errcode | message | anchored | what it actually guards |
| --- | --- | :---: | --- |
| `HC0Q7` | *a biblioteca de blocos não está disponível* | ✓ | feature availability |
| `HC0Q8` | *informe um nome para o bloco* | ✓ | input validation |
| **none** | *pergunta % não encontrada* | ✗ | **not-found** |
| `HC0Q8` | *apenas um item de nível superior pode ser salvo…* | ✓ | input validation |
| `42501` | *você não pode editar formulários nesta comissão* | ✓ | **authorization** |

⭐ **The 5th raise is NOT authz-relevant** — it carries **no errcode at all** and is a not-found guard.
The harness's refusal is therefore over-cautious *for this door*: the anchored 4 could be mutated
safely. ⛔ But do not "fix" it by relaxing the partial-mutation refusal in general — that refusal is
what keeps `set_referral_patient` from being half-neutralized, and a door with a genuinely authz
5th raise would then mutate to a false verdict. The right change is the **validated anchor fix**,
after which this door's counts reconcile on their own.

⛔ **And it is the sharpest available illustration of the semantic half of this entry: of the FOUR
anchored "authz raises" here, exactly ONE (`42501`) is authorization.** The other three are feature
availability and input validation. Any figure of the form "N authz raises across the 171" carries
that error at roughly this ratio — which is why point 5 of ADR
[0184](../decisions/0184-c2-sweep-runs-against-the-current-branch-schema.md) forbids reading a
verdict from this run as an authorization verdict.

⚠ Derived from migration text (non-authoritative per CLAUDE.md); confirm against
`pg_get_functiondef` once the DB window closes.

⭐ **The generalisable lesson, and it is ADR 0078's:** this is an enumeration **bounded by a syntax
rather than by a property**. The same shape produced the false P0 in ADR 0078's METHODOLOGY FINDING and
the 15-BLIND-gate miss in ADR 0079. A related instance found in the same audit: a **t19 REVOKE-guard
block makes a door grep-positive while leaving it mutation-blind** (`cancel_session`'s single pgTAP
mention is `121_interviews.sql:381`, a `has_function_privilege` ACL assertion that reads `pg_proc.proacl`
and is *structurally* incapable of noticing a body mutation). ~60 doors in this suite carry that profile,
so **any "which doors have coverage?" answer derived by grepping test files for a door name overcounts
by that set.**

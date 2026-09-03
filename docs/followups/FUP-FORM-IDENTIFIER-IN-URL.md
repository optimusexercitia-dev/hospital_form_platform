# FUP-FORM-IDENTIFIER-IN-URL — a sensitive field submitted BEFORE HYDRATION serialises into the query string. **4 leaks CONFIRMED AND FIXED (incl. CPF + MRN); the STANDING DETECTOR and the `useFieldIds` default remain open** (owner: frontend + lead; **class, correction, measurement and fixes all credited to `frontend`**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**Filed and largely closed 2026-08-20**, during DSR Slice 3, by `frontend` — found in its own new
code, then measured and fixed across the app. ⛔ **Downgraded 🔴 → 🟠 because the measured leaks are
gone, NOT because the class is closed.** What is open is the *detector* and the substrate default.

**Mechanism.** A form input carrying a `name` is serialised by the browser's *native* GET submit.
Pressing Enter **before React has hydrated** submits natively: no handler is attached yet, so
`preventDefault` cannot run. A `<form onSubmit={…}>` with **no `action=`** GETs to the current URL.

⛔ **`name` is INJECTED, not written.** `useFieldIds(name, …)` returns a `controlProps` object
containing `name`, which components spread onto the input. **There is no `name=` in the source** — the
defect is invisible to the obvious search, which it defeated three times.

**MEASURED — the complete population that was examined, nothing predicted:**

| surface | before | after |
|---|---|---|
| `users/cpf-field.tsx` (via `/manage/usuarios/novo` **and** `/manage/usuarios/[userId]`) | ⛔ LEAKS `?cpf=` | ✅ SAFE |
| `users/user-profile-edit-form.tsx` | ⛔ LEAKS `?fullName=…&cpf=…&professionalCategoryId=…` | ✅ SAFE |
| `users/affiliations-panel.tsx` | ⛔ LEAKS `?newHospitalId=…&newEmployeeId=…` | ✅ SAFE |
| `patient-index/patient-search-view.tsx` | ⛔ LEAKS `?patient-mrn=…&patient-encounter=…` (**PHI**) | ✅ SAFE |
| `users/register-user-form.tsx` (the predicted `?password=`) | ✅ NOT-REACHABLE-PRE-HYDRATION | — |
| `printing/revoke-document-dialog` · `forms/save-to-library-dialog` · `forms/edit-library-entry-dialog` | ✅ NOT-REACHABLE-PRE-HYDRATION | — |

The four NOT-REACHABLE verdicts are **measured, not assumed**: each host route was loaded JS-disabled
and its server HTML counted zero forms and zero dialog nodes. (Two required creating a draft through
the real UI first, since the seed has none; it was deleted afterwards.)

**Fix:** ten one-line `name={undefined}` strips across five files. ⭐ **No `FormData` anywhere** — all
four leaking forms were already `useState`-controlled, so no submission path changed and the
`method="post"` question is moot. ⭐ **The two CPF leaks were ONE bug**: both routes render the shared
`users/cpf-field.tsx`, so a single strip fixed both — which is also why the CPF exposure was *wider*
than either route on its own suggested.

**Control, both directions** (a sweep returning SAFE everywhere is indistinguishable from a sweep that
stopped looking): the `cpf-field.tsx` strip was reverted and re-run → **LEAKS**; restored → **SAFE**.
Same harness, same run, unmodified between.

⭐⭐ **THE FINDING: BOTH PREDICTIONS WERE WRONG, IN OPPOSITE DIRECTIONS.** `backend` and the lead both
escalated `?password=<plaintext>` as the thing that mattered — **it does not exist**. Meanwhile
**`cpf`, the Brazilian national identity number, leaked in two places and was on NEITHER candidate
list.** Both lists were assembled from field names their authors could think of. **A list of names you
can think of is not an enumeration of the population.** See
[[enumeration-boundary-is-a-syntax-not-a-property]].

## ⛔ STILL OPEN — two limits `frontend` stated about its own sweep

1. **"8 candidates, 8 measured" is NOT "the app is clean."** The population was a list a *static read*
   proposed; the sweep measured that list honestly but never independently enumerated every `<form>` in
   the app. Given this class has beaten a reasoned read three times, the standing check must be a
   **crawler over authenticated routes that fails on ANY named input inside an action-less form** — not
   a re-run of this list. ⛔ Never a `name=` grep: it cannot work against an injected `name`.
2. **`<select>` coverage is weaker than text-input coverage.** The harness does not overwrite `<select>`
   values, so a select is only caught by noticing its *real* value in the URL — which is exactly how
   `professionalCategoryId` and `newHospitalId` surfaced. **A select that happened to be empty at page
   load would have read as clean.** The select population is not reliably enumerated by this run.

## ✅ PO-RULED 2026-08-20 — INVERT the `useFieldIds` default (assigned to `frontend`; a SEPARATE change after Slice 3)

`frontend`'s recommendation (not actioned, per the lead's ruling): have `useFieldIds` **omit** `name`,
and require the callers that genuinely use `FormData` to opt in explicitly. Today the **dangerous case
is the default** and the safe case needs discipline at **51 call sites — with a measured failure rate
of 10/51**. Inverting makes the safe case free, makes the dangerous case visible in review, and turns
this from a discipline into something a lint rule could actually gate. ⚠ It touches every form in the
app, so it is its own change with its own review, not a rider on a security fix.

⛔ **The inversion's hazards run the OPPOSITE direction from the leak, and every one fails SILENTLY —
green in `tsc`, lint and unit tests while broken at runtime.** Enumerate before changing the hook:
1. ⛔ **`<form action={serverAction}>` / `useActionState`** — a server action receives **FormData built
   from `name`d inputs**. Losing `name` does not degrade it; it submits **nothing**. Hardest to spot,
   because such a form never had an `onSubmit` to notice.
2. ⛔ **Radio groups** — `name` is what *groups* radios so only one can be selected. Purely behavioural.
3. **Explicit `FormData` reads** (`new FormData`, `formData.get`).
4. ⚠ **Autofill / password managers** — `name` feeds autocomplete heuristics; opting back in there is the
   *correct* outcome, not a workaround.

⛔ **Out of scope of the inversion:** the standing route-crawler gate (limit 1 above). It is the right
detector, but CLAUDE.md's gate list is the PO's to extend.

### ⛔ CORRECTION 2026-08-20 (`frontend`, self-reported) — the true blast radius was **GET FORMS ONLY**, not 133 spreads

Measured during the step-3 verification, and it **shrinks a number this file previously carried**:

```
LOGIN (no JS): method=post  named=[…,"email","password"]
ADMIN (no JS): method=post  named=["name","slug"] / ["organizationId","name","slug"] / …
DSR   (no JS): method=get   named=[]
```

**Every server-action form renders as `method="post"`, and a POST body does not reach the query
string.** So the 30 fields opted back in were **never at risk of this leak** — and all four genuine
leaks were client `onSubmit` forms, which default to **GET**. The defect's population was never "every
form using `useFieldIds`"; it was GET forms only.

⭐ The inversion remains right — it makes the safe case free and the dangerous case *declared* — but the
honest framing is **defence-in-depth plus a documented taxonomy**, ⛔ **not "133 live leaks closed."**
Recorded because the teammate corrected its own headline downward rather than letting the larger number
stand, and an inflated number in a security record is a claim that will be quoted.

### Annotation landed at 30, not the 42 upper bound — the file-level trap was real

Reading each site against its server action's actual `formData.get()` **read set** removed 12 that
file-level bucketing would have wrongly opted in: 9 controlled fields in `add-participant-dialog` (its
action never reads those keys), `add-member-picker`'s search box (a client-side filter — the action
reads hidden inputs), and 2 resolving to the shared `cpf-field`. ⭐ **That is exactly the "33 is an upper
bound, not a work list" hazard, and it fired.**

⚠ **`radioGroup` and `autofill` have ZERO call sites.** All 20 radios take `name` from explicit
attributes the hook never touches, and for the auth fields `formData` is the *binding* reason (they
break without it), so they were annotated `formData`. Two union variants are unused — **open question
for the PO**, since "a new reason must require adding a variant" argues for pruning to `formData` alone.

### Enumeration (measured 2026-08-20, before the hook was touched) — the blast radius is ~1/3 of the class counts

**43 files spread `{...X.controlProps}`; 133 spreads total.**

| bucket | files | spreads | meaning |
|---|---|---|---|
| **AT RISK** — file also uses `action={}` / `useActionState` / `FormData` | 17 | **33** | per-site inspection required |
| **RADIO** — `add-participant-dialog.tsx` | 1 | **9** | `name` groups the radios; stripping breaks selection **silently** |
| **SAFE** — no action, no FormData, no radio | 25 | **91** | the inversion is a no-op |

⭐ **The gap between class counts and the intersection is the useful finding.** 44 files use
`useActionState`/`action={}` and 22 read `FormData` — but most get `name` from **hand-written
attributes**, which the inversion cannot touch (`create-case-dialog.tsx`: 14 explicit `name=` vs 2
spreads). ⚠ **And the bucketing is FILE-level: 33 is an UPPER BOUND on the work, not a work list.**
"The file contains a server action" says nothing about whether *this control's* value is read from
FormData. ⛔ Opting a field in because its file appeared in a bucket re-adds `name` to fields that do
not need it — the worst available outcome, and invisible afterwards because the opt-in would *look*
deliberate. Ambiguous site → leave un-annotated and **exercise** it: a broken submission is loud, a
needless `name` is silent.

### The opt-in shape (ruled 2026-08-20) — `nameRequiredFor`, a closed union, ⛔ no `"other"`

```ts
useFieldIds("email", { nameRequiredFor: "formData" })    // a server action / FormData read consumes it
useFieldIds("kind",  { nameRequiredFor: "radioGroup" })  // `name` is what groups the radios
useFieldIds("email", { nameRequiredFor: "autofill" })    // password-manager heuristics need it
```

⛔ **Rejected: `submitsVia`** (the proposed name) — false for two of its own three values, since neither
radio-grouping nor autofill is submission. **A parameter name that lies about its content** is the
class this repo paid for when `p_template_id` was renamed to stop lying and the forced `DROP`+`CREATE`
silently reset an ACL. A closed union with **no `"other"`** keeps unclassifiable sites out of a catch-all
— which is where the next leak would hide.

**Sequencing — three steps, no broken intermediate:** (1) add the parameter, still always emitting
`name` (no-op); (2) annotate the sites (no-op); (3) flip the default — one risky change, once, against
an already-annotated tree. ⛔ Flipping first leaves ~42 sites broken while they are annotated.

The auth forms (`login-form`, `password-set-form`, `reset-request-form`) are class 1 **and** class 4
simultaneously — they opt back in under `"autofill"`, with the reason stated at the call site; that is
the **correct outcome, not a workaround**.

### ⚠ A cheap lint rule becomes possible — and it does NOT close this follow-up

`nameRequiredFor: "formData"` co-occurring with an action or a `FormData` read is an ordinary static
check, no browser needed. ⛔ **But it is a CLAIM-CHECKER, not a leak detector.** It verifies a *declared*
opt-in is honest; it cannot see a field carrying `name` for another reason, a hand-written `name=`, or a
form the enumeration never reached — and "8 candidates, 8 measured" was already not "the app is clean".
**The route crawler remains the detector.** Recording a cheap check as coverage for an expensive one is
exactly how this program's four authz ARMs came to pass while seeing nothing.

# FUP-E2E-ABSENT-ROW-ASSERTIONS — `expect(row?.field).not.toBeNull()` passes when the row is ABSENT, and it is live on PHI-erasure assertions (owner: tester/lead; **the number was wrong in BOTH directions before anyone measured it**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> ⭕ **DOWNGRADED 🔴→🟠 2026-08-29.** The population is measured and re-derivable, both named
> PHI instances turn out to have been fixed already, and the named live ones are guarded.
> Full measurement and the two corrections to THIS ITEM's own text: § MEASUREMENT below.

**2026-08-20, found by QA r2 while falsifying a count the lead had relayed.** B2 fixed this shape inside
the DSR specs. It is **not** confined to them.

> ### ⛔ FOURTH CORRECTION 2026-08-20 (lead, measured) — the item was also read TOO WIDE, and the over-read is in the alarming direction
>
> A DSR-remediation sweep listed **five** live PHI-erasure instances: `case-patient.spec.ts:1193`,
> `pdf-printing-meetings.spec.ts:335`, and `meeting-audio-minutes.spec.ts:483/492/571`. **Only the
> first two are vacuous.** The three audio ones use `.toBeTruthy()`, and `undefined` is **falsy** —
> they fail loudly on an absent row.
>
> **Measured, not reasoned** (vitest 4.1.8, four assertions, all passing):
>
> | matcher on `absent?.field` (⇒ `undefined`) | verdict |
> |---|---|
> | `.not.toBeNull()` | ⛔ **PASSES** — this is the vacuity, and it is the ONLY one |
> | `.toBeTruthy()` | ✅ throws |
> | `.toBe(false)` | ✅ throws |
> | `.toBeNull()` | ✅ throws |
>
> ⭐ **So the defect is the MATCHER, not the optional chaining.** `row?.` is necessary but not
> sufficient; every prior statement of this item said *"optional chaining converts a missing subject
> into a passing assertion"*, which is true only in composition with a matcher that accepts
> `undefined`. Stated at the wrong grain, that reads as a licence to sweep every `?.` in the tree —
> and the population it yields is mostly sound tests. [[a-predicate-quoted-at-the-wrong-grain]]
>
> ⚠ **This does NOT shrink the item**, for two reasons. (1) The **second** vacuity mechanism the DSR
> fix named — a helper that returns `[]` on a *failed read*, turning "the request errored" into "the
> table is empty" — is **matcher-independent** and still unswept. (2) The population must be
> re-derived as a property (**matcher ∈ the accepts-`undefined` set** × a possibly-absent subject),
> ⛔ never as a grep for `?.`. Four counts have now been claimed for this item and four have been
> wrong.

⛔ **Three numbers were claimed and none survived measurement:**
- `tester` reported *"14 spec files carry private copies, exactly one other swallows"* — the lead relayed it.
- QA measured *"≥49 swallowing helper bodies"* and flagged its own larger figure (85/67) as **unverified**.
- **Lead's own measurement, bounded by shape and stated as such:** **17** assertions of the form
  `expect(x?.field).not.toBeNull()` / `.toBeTruthy()` across **10 files**, and **9 separate private
  `serviceQuery` definitions** in `e2e/`, several returning `[]` on a failed or non-array response.

⚠ **17 is a LOWER BOUND on ONE SHAPE, not the population.** The *property* is "an assertion that a row's
field is non-null where the row itself may be absent"; a regex over `?.` cannot enumerate that. See
[[enumeration-boundary-is-a-syntax-not-a-property]]. ⛔ **Do not quote 17 as the count.**

**The PHI-relevant instances — this is why it is 🔴, not 🟡:**
- `e2e/pdf-printing-meetings.spec.ts:335` — `expect(row?.phi_disposed_at, 'the RPC actually disposed this
  fixture').not.toBeNull()`. ⭐ **Its own assertion message is precisely the false statement an absent row
  makes it assert.** Byte-identical in kind to B2.
- `e2e/meeting-audio-minutes.spec.ts:482/483/492/571` — `applied_at`, `purged_at`, `audio_deleted_at`:
  **audio-PHI deletion** assertions in the same shape.
- `e2e/meeting-held-time.spec.ts:296/373/566` — `held_at`.

⛔ **`lint:vacuous` sees none of it** — the vacuity is manufactured **one call frame away**, inside the
helper, so the assertion reads as unconditional at the call site.

**Not fixed here, deliberately:** the tree was hash-frozen for the declaring gate, and converting a
swallowed read into an assertion can surface a hidden failure in a spec nobody has analysed. This needs
its own pass, with each conversion's red triaged.

⭐ **The lesson that outranks the fix:** *"exactly one other"* closed a question that was open. It is the
partial-fix-reads-as-complete family **retiring the very lesson B2 had just taught** — and it took a
reviewer measuring, not a reporter reporting, to catch it.

---

## § MEASUREMENT 2026-08-29 — the property, derived; and two corrections to THIS ITEM

⛔ **Everything below was measured against the live runtime.** This item's own history is four
wrong counts and a fifth wrong claim (below), all produced by reasoning about matcher semantics
instead of running them.

### ⭐⭐ Correction 1 — the accepts-`undefined` set is TEN, not one

The fourth correction's table lists **four** matchers and concludes `.not.toBeNull()` is
*"the vacuity, and it is the ONLY one"*. Sound for the four it tested; it reads as general.
Measured across 18 matchers on vitest 4.1.11, **ten** accept `undefined`, and they split by what
the assertion was TRYING to say:

- **claims the field HAS a value** — `.not.toBeNull()` · `.not.toBe(null)` · `.not.toEqual(null)`
  · `.not.toStrictEqual(null)` · `.not.toBe(<literal>)` · `.not.toEqual(expect.any(...))`
- **claims the field is ERASED** — `.toBeUndefined()` · `.toBeFalsy()` · `.not.toBeDefined()` ·
  `.not.toBeTruthy()`

⭐⭐ **The erasure half is a family this item never looked for, and it is the WORSE one for
Rule 12.** `expect(row?.purged_at).toBeFalsy()` on a row that was **never created** passes, and
the conclusion drawn is *"the PHI was erased"* — a fixture that failed to build its subject
reports a successful purge. ⚠ `.toBeNull()` **throws** on `undefined`, so it is the safe way to
assert erasure; `.toBeFalsy()`/`.toBeUndefined()` are not.

The set lives in **`scripts/absent-subject-matchers.json`** and is re-proved on every
`npm run test` by `src/lib/matcher-vacuity-truth-table.test.ts`, which MEASURES each matcher and
reds if the runtime ever disagrees. ⛔ It is a file rather than a constant so the detector and its
proof cannot drift apart. Proven able to fail (a plausible wrong belief — `.toBeFalsy()` moved to
the safe set — reds it, then restores).

### ⭐⭐ Correction 2 — `rows[0].field` THROWS, so it is SAFE

Measured: `[][0]` → `undefined`; `[][0].field` → **TypeError**; `[][0]?.field` → `undefined`.
So the swallowed-read family reaches vacuity ONLY through `?.`, or when `rows[0]` **is** the
subject (`expect(rows[0]).not.toBeNull()`). A plain dot after an index fails **loudly** — noisy on
an empty read, never silent.

⛔ **This is a finding against my own detector, not against the item.** Its first version flagged
an index anywhere in the subject and reported **19 sound assertions** as defects — and its
self-test did **not** catch it, because the fixture asserting that shape had been HAND-CLASSIFIED
to match the same wrong belief. *A hand-classified fixture is a belief wearing the label of a
control.* The subject shapes are now measured in the truth-table test, and a regression pin holds
the corrected classification.

### ⭐⭐ Correction 3 — the item's own evidence is STALE, in both directions

- **Both named PHI instances were ALREADY FIXED**, and nothing told the register. Live today:
  `pdf-printing-meetings.spec.ts:340-342` and `case-patient.spec.ts:1247-1250` both assert
  `toHaveLength(1)` with a message naming the failure mode, then read the field through a **plain**
  access — and both cite the same canonical shape at `dsr-subject-requests.spec.ts:255-264`. This
  item carried 🔴 for nine days on remediated evidence.
- **The three `meeting-held-time.spec.ts:296/373/566` instances are GUARDED**, by the line
  immediately above each: `expect(row?.status).toBe('held')`. `.toBe(<literal>)` **throws** on
  `undefined`, so the row cannot be absent when the next line runs. They are sound. ⛔ Had the
  detector shipped without a guard rule, the obvious next step — "fix the three the FUP names" —
  would have churned three correct assertions in a file nobody had reason to open.

### The detector — `scripts/check-absent-subject-assertions.mjs`

Keyed on the **composition** this item defines (*possibly-absent subject × accepts-`undefined`
matcher*), never on a `?.` grep. TypeScript AST. Its rule set is derived from the measured JSON,
and **both** its vacuous set and its guard rule come from the same file, so they cannot disagree.
26 self-test fixtures, both polarities, run before every scan — a report is refused if they fail.

**Guard rule, and it is the general one:** any preceding assertion **on the same root** whose
matcher is in the measured `throwsOnUndefined` set proves the subject was present. It subsumes
`toHaveLength(n>0)` and friends.

⚠ **Bounded, stated:** shape at the assertion site only. A guard in a helper or a parent block is
not seen (so GUARDED is a floor), and a subject made absent one call frame away leaves no syntax
here at all (so UNGUARDED is a floor too). ⛔ **Neither number is "the population"** —
[[enumeration-boundary-is-a-syntax-not-a-property]]. The counting has now gone
17 → 38 → 20 → 16 → 10, every step a measured correction.

**Measured 2026-08-29 (re-run it; do not quote):** **10 unguarded / 10 guarded**, then **7 / 11**
after the fixes below. ⛔ Not wired into `npm run lint` — a gate change is not a mid-phase edit.

### Fixed and TRIAGED — 3 real defects

- `case-referral-usability-batch.spec.ts:675` and `:763` — ⭐ **worse than vacuous inside a
  `expect.poll`**: the callback returned `rows[0]?.sent_at`, `.not.toBeNull()` accepts `undefined`,
  so the poll **succeeded on its first tick** and the 15 s / 10 s wait it was written to perform
  never happened. Both now return `rows.length === 1 && rows[0].<field> !== null` matched with
  `.toBe(true)`, which throws on `undefined` as well as on `false`.
- `aff4-hospital-admin-rehire.spec.ts` — `.find()` yields `undefined` when the original row is
  gone, so the assertion reported *"the row was not reopened"* precisely when it no longer existed.
  Guarded with `.toBeDefined()`.

✅ **Triaged, not assumed:** both specs re-run — **11 passed, exit 0**. The item warns that
converting a swallowed read can surface a hidden failure in an unanalysed spec; here it did not.

### What stays open

The **7 unguarded** findings (none PHI, none in an erasure claim on a DB row), and the two bounds
above. The matcher-independent helper mechanism remains its own item —
`FUP-E2E-HELPERS-SWALLOW-FAILED-READS`. ⚠ **Relevant to AE3:** it moves `cpf`/`date_of_birth`/
`phone` into a per-profile row, and a row the backfill never created is exactly the state these
matchers report as success. AE3's assertions on `profile_private_details` must be guarded, and
its erasure claims must use `.toBeNull()`, never `.toBeFalsy()`.

### ⬛ INCIDENT (recorded 2026-08-20) — a process tree is not dead because the child you named is

The lead killed the **listener** on :3000, saw the port go free, and declared the `e2e:prod` tree reaped.
It was not: the **`npm run e2e:prod` parent was still alive and minting replacement standalone servers**,
which is why two people looking at "the server on :3000" saw **different pids**. Those orphans served live
app queries through PostgREST against pgTAP's `TRUNCATE` and **deadlocked three consecutive `test:db`
runs — 21 deadlocks each, ~700 tests never executing.** `taskkill /PID <parent> /T /F` then took out a
**4-deep chain**.

⛔ **Generalisable, and this is the half that was missing from the record:** *the port going free is
evidence about the CHILD, not the SUPERVISOR.* Reap by process tree from the parent, and verify by
enumerating the **process table** — never by re-checking the port. ⚠ `TaskStop` does not reap a
background command's process tree (standing rule, now with a second occurrence).

# FUP-NO-GATE-REPRODUCES-DOCKER-CONTEXT — a `src/` file importing across a `.dockerignore` boundary is green on EVERY local gate and red only on the build server (owner: backend/lead; filed 2026-09-01 from the AE3 cutover deploy failure)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-01 · status open

**What happened.** The AE3 cutover's first Coolify deploy failed at tsc:
`src/lib/matcher-vacuity-truth-table.test.ts(1,22): error TS2307: Cannot find module
'../../scripts/absent-subject-matchers.json'`. `.dockerignore` excludes `scripts`, justified by a
comment reading *"npm run build is plain next build and there are no npm lifecycle hooks, so none of
it runs during the image build"*. **That premise is TRUE and does not cover TYPE-CHECKING** —
`next build` runs tsc over `src/**`, test files included.

**Why no gate can see it.** The asymmetry is the whole defect: **an absent file is not an error; an
unresolvable import FROM a present file is.** Locally `scripts/` exists, so `npm run build`,
`npm run typecheck`, the eleven-gate lint chain and vitest are ALL green against a context that does
not exist on the build server. The only instrument that can fail is a real `docker build`, which no
gate runs.

**Fixed for the instance, NOT for the class** — `.dockerignore` gained `!scripts/absent-subject-matchers.json`
(`a12b7c1d`), verified by a throwaway `docker build` that the negation is honoured and that
`supabase/ e2e/ docs/ node_modules/ .git/` all stay excluded. A three-way grep over `src/` agreed
there is **exactly one** such import today. ⛔ Nothing stops the second one.

**What would close it.** A cheap gate that resolves every `src/` import against the *docker context*
rather than the working tree — not a full image build. ⚠ Do not close it by deleting the exclusion:
the layer-invalidation rationale for excluding `scripts/` is still correct for its other ~40 files.

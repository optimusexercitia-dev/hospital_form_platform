import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright outputs (gitignored): bundled report/trace assets must never
    // be linted — they generate thousands of false errors and break CI lint.
    "playwright-report/**",
    "test-results/**",
    // Claude Code tooling — NOT application source. `.claude/worktrees/` holds
    // transient agent-team git worktrees, each a full repo checkout WITH its
    // own `.next/` build output; the root-anchored `.next/**` above does not
    // reach those, so eslint would otherwise lint compiled/minified bundles
    // (~99% of all reported problems). Skills/agents/settings are config, not
    // code. Exclude the whole directory.
    ".claude/**",
    // Same reasoning for the CURRENT worktree location (`docs/worktrees.md` +
    // the CLAUDE.md repo layout put them at `worktrees/`, not `.claude/`): each
    // is an independent checkout of this repo on its own branch, linted by its
    // own session against its own config. Linting them from the root reported
    // ~46.8k problems — 100% of the total — making the 0-warning gate
    // unreachable whenever a worktree existed.
    "worktrees/**",
    // Supabase CLI scratch output — NOT first-party source. `supabase/.temp/`
    // holds artifacts the CLI writes during `supabase start` (notably
    // `start-secrets/**`, a vendored edge-runtime `index.ts`). It is gitignored
    // but was NOT eslint-ignored, so `eslint --max-warnings=0` failed on ~186
    // problems in vendored code the moment the local stack had been started.
    //
    // ⚠ Why this mattered far more than a noisy exit code: `npm run lint` is
    // FIVE gates chained with `&&` (CLAUDE.md §8). eslint is the FIRST link, so
    // its failure short-circuited the chain and `lint:css-vars`,
    // `lint:memberships-door`, `lint:client-server-imports` and `lint:vacuous`
    // NEVER RAN — the Phase Gate §6 step-1 command silently delivered one fifth
    // of itself. Worse, being permanently red, the gate stopped being read at
    // all and the working practice became running the five individually.
    // Found in the 2026-08-12 FUP batch QA review.
    "supabase/.temp/**",
  ]),
  // Honor the `_`-prefix convention for intentionally-unused bindings (already
  // used in the codebase, e.g. `_args` mock signatures). Severity stays at
  // eslint-config-next's default ("warn"); this only adds the ignore patterns.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // ADR 0104 D14 — the PDF renderer PURITY GATE. `src/lib/pdf/**` is the pure
  // payload→HTML layer: unit-testable with no browser, no network, no Supabase.
  // "Pure by convention" is the class of claim that goes stale silently, so the
  // boundary is enforced mechanically: importing the supabase clients, the
  // query layer, or `server-only` here is an ERROR. Impure orchestration
  // (providers, mint pipeline, sidecar client) lives in `src/lib/pdf-mint/`.
  //
  // ⚠ QA MAJOR-1 (phase-PDF-P1-review): the boundary is the PROPERTY "reaches
  // outside src/lib/pdf", never a specifier syntax — the module's own internal
  // imports are all RELATIVE, so `../supabase/server` / `../../queries/…` are
  // the natural escapes and MUST be banned alongside the `@/` alias forms.
  // Both relative shapes are red-teamed (recorded in the PDF·P1 fix-wave).
  {
    files: ["src/lib/pdf/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/supabase",
                "@/lib/supabase/*",
                // relative escapes, any depth (pdf/ nests two levels today;
                // the deep globs also cover any future nesting):
                "../supabase",
                "../supabase/*",
                "../../supabase",
                "../../supabase/*",
                "../../../supabase",
                "../../../supabase/*",
                "**/lib/supabase/**",
              ],
              message:
                "src/lib/pdf is PURE (ADR 0104 D14) — no supabase clients here, by ANY path shape. Orchestration belongs in src/lib/pdf-mint/.",
            },
            {
              group: [
                "@/lib/queries",
                "@/lib/queries/*",
                "../queries",
                "../queries/*",
                "../../queries",
                "../../queries/*",
                "../../../queries",
                "../../../queries/*",
                "**/lib/queries/**",
              ],
              message:
                "src/lib/pdf is PURE (ADR 0104 D14) — no query layer here, by ANY path shape. Data providers live in src/lib/<domain>/pdf-payload.ts.",
            },
            {
              group: ["server-only"],
              message:
                "src/lib/pdf is PURE (ADR 0104 D14) — it must stay importable by Vitest with no server context.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

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
]);

export default eslintConfig;

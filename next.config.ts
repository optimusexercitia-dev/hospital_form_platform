import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the output-file-tracing root to the build's working directory (the app
  // root — `next build` always runs from there). Without this, a checkout that
  // is a git worktree nested inside the main checkout makes Next infer the
  // PARENT (whose package-lock.json it finds) as the workspace root, nesting the
  // standalone output under .next/standalone/worktrees/<branch>/server.js and
  // breaking scripts/e2e-prod-gate.sh (which expects .next/standalone/server.js).
  // Correct in the main checkout, any worktree, and the Coolify Docker build.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;

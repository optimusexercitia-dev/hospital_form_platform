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
  // GATE-TIME COLLISION ESCAPE HATCH. Two sessions share this worktree, and the
  // E2E gate holds `.next/standalone` open while its prod server runs — so a
  // `next build` from the other session fails EBUSY, and worse, can clobber the
  // running server's output mid-suite. Setting NEXT_SCRATCH_DIST_DIR builds into
  // an isolated directory instead: verification without disturbing whoever owns
  // the stack. Unset (the default, and every real build — dev, the gate, Docker)
  // it is exactly `.next`, so nothing about the shipped output changes.
  distDir: process.env.NEXT_SCRATCH_DIST_DIR || ".next",
};

export default nextConfig;

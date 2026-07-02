// Test-only stub for the `server-only` package. Importing the real package from
// a Vitest (jsdom / client-module) context throws "This module cannot be
// imported from a Client Component module". Aliasing it to this empty module in
// vitest.config.mts lets us unit-test server-only helpers (e.g.
// `src/lib/config/auth.ts`) without loosening the runtime guard in app code.
export {}

"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Root-layout error boundary. Only triggers when the ROOT layout itself
 * throws (vs. `error.tsx`, which handles everything below it) — Next bypasses
 * the normal tree entirely for this case, so this file must render its own
 * `<html>`/`<body>` from scratch. It still imports `globals.css` so the design
 * tokens are available, but can't depend on `RootLayout`'s `next/font`
 * variables being applied, so it falls back to the system font stack and
 * inlines the couple of tokens it needs (porcelain background, ink text, the
 * calm-blue primary) as a safety net in case the stylesheet fails to load.
 * No "use client" component tree can catch this error higher up, so it must
 * be fully self-contained. pt-BR copy; never renders the raw error.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to server logs / monitoring; never rendered to the user.
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            'var(--font-sans, "IBM Plex Sans"), system-ui, -apple-system, "Segoe UI", sans-serif',
          background: "var(--background, oklch(0.985 0.004 95))",
          color: "var(--foreground, oklch(0.23 0.018 230))",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Algo deu errado
        </h1>
        <p
          style={{
            maxWidth: "28rem",
            margin: 0,
            color: "var(--muted-foreground, oklch(0.52 0.022 252))",
          }}
        >
          Não foi possível carregar a aplicação. Tente novamente em alguns
          instantes.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "0.75rem",
            border: "none",
            padding: "0.625rem 1.5rem",
            fontSize: "0.9375rem",
            fontWeight: 500,
            cursor: "pointer",
            background: "var(--primary, oklch(0.475 0.11 252))",
            color: "var(--primary-foreground, oklch(0.99 0.005 250))",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}

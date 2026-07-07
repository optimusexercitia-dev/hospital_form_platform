import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display serif — IBM Plex Serif. Sturdy, trustworthy editorial character for
// page titles, the brand wordmark, and case titles ("Clinical Calm").
const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Body/UI sans — IBM Plex Sans. Precise and legible for dense clinical forms.
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Mono — IBM Plex Mono. Case IDs ("Caso 0042"), codes, numeric identifiers.
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Plataforma de Formulários das Comissões Hospitalares",
    template: "%s · Comissões Hospitalares",
  },
  description:
    "Digitalize os checklists e formulários das comissões hospitalares e gere estatísticas automaticamente.",
  applicationName: "Comissões Hospitalares",
  authors: [{ name: "Comissões Hospitalares" }],
  formatDetection: { telephone: false, email: false, address: false },
};

// Separate from `metadata` per Next 15 (viewport/themeColor moved out of the
// Metadata object). User zoom stays enabled (accessibility — never disable
// pinch-to-zoom). `themeColor` mirrors the porcelain background in light mode
// and the deep slate background in dark mode (see globals.css `:root`/`.dark`).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#202832" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${ibmPlexSerif.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

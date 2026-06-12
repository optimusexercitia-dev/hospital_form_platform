import type { Metadata } from "next";
import { Fraunces, Spline_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Display serif with optical sizing — gives the platform a calm, trustworthy
// editorial character that sets it apart from generic SaaS sans-only stacks.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// Humanist-geometric body/UI sans — precise and legible for dense forms,
// distinct from Inter/Roboto.
const splineSans = Spline_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${splineSans.variable} ${splineSansMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

// Generates src/lib/pdf/fonts.generated.ts — IBM Plex faces embedded as
// base64 data-URIs for the PDF renderer's self-contained HTML (ADR 0104 D14:
// the Gotenberg sidecar is private-network; the HTML must carry its own fonts,
// keeping the renderer fully generic).
//
// Source: @fontsource/ibm-plex-* devDependencies (OFL-licensed), latin subset
// only (~24 KB/woff2). The OUTPUT is committed so the runtime never reads
// node_modules paths (Next standalone file-tracing does NOT follow fs reads —
// a runtime read would 404 in the deployed image).
//
// Re-run only when changing the embedded face set:
//   node scripts/generate-pdf-fonts.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FACES = [
  { pkg: 'ibm-plex-sans', family: 'IBM Plex Sans', weight: 400 },
  { pkg: 'ibm-plex-sans', family: 'IBM Plex Sans', weight: 600 },
  { pkg: 'ibm-plex-serif', family: 'IBM Plex Serif', weight: 400 },
  { pkg: 'ibm-plex-serif', family: 'IBM Plex Serif', weight: 600 },
  { pkg: 'ibm-plex-mono', family: 'IBM Plex Mono', weight: 400 },
]

const faces = FACES.map(({ pkg, family, weight }) => {
  const file = resolve(
    root,
    'node_modules',
    '@fontsource',
    pkg,
    'files',
    `${pkg}-latin-${weight}-normal.woff2`,
  )
  const b64 = readFileSync(file).toString('base64')
  return { family, weight, dataUri: `data:font/woff2;base64,${b64}` }
})

const out = `// GENERATED FILE — do not edit by hand. Regenerate with:
//   node scripts/generate-pdf-fonts.mjs
// IBM Plex latin-subset woff2 faces (OFL) embedded as data-URIs for the
// self-contained renderer HTML (ADR 0104 D14). Source: @fontsource devDeps.

export interface EmbeddedFontFace {
  family: string
  weight: number
  dataUri: string
}

export const EMBEDDED_FONT_FACES: EmbeddedFontFace[] = ${JSON.stringify(faces, null, 2)}
`

writeFileSync(resolve(root, 'src', 'lib', 'pdf', 'fonts.generated.ts'), out)
console.log(
  `wrote src/lib/pdf/fonts.generated.ts (${faces.length} faces, ${Math.round(out.length / 1024)} KB)`,
)

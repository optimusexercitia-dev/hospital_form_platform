/**
 * Shared template primitives (PURE — ADR 0104 D14). One implementation per
 * concern; every document kind composes these, so watermarks/signatures/QR
 * render identically across kinds (D7/D10/D13).
 */
export { renderLetterhead } from './letterhead'
export { renderWatermarks } from './watermark'
export { renderSignatureBlock, renderUnsigned } from './signature-block'
export { renderQrFooter } from './qr-footer'
export { renderPreviaFooter } from './previa-footer'
export { renderSectionTable, type SectionTableRow } from './section-table'

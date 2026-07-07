import { openPdfFromBlob } from './pdfjs.js';

/*
 * Miniatyrer av mönstersidor. Två användningar:
 *  - renderPdfThumbnail: första sidan som sparad JPEG-blob (biblioteket,
 *    projektkorten) — renderas en gång vid import.
 *  - renderPageThumb: valfri sida som data-URL för sidgalleriet (D7) —
 *    renderas vid behov och cachas bara i minnet av anroparen.
 */
const THUMB_WIDTH = 480;
const JPEG_QUALITY = 0.8;
const PAGE_THUMB_WIDTH = 180;
const PAGE_THUMB_QUALITY = 0.7;

async function renderPageToCanvas(page, width) {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export async function renderPdfThumbnail(pdfBlob) {
  const doc = await openPdfFromBlob(pdfBlob);
  try {
    const page = await doc.getPage(1);
    const canvas = await renderPageToCanvas(page, THUMB_WIDTH);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('Kunde inte skapa miniatyren.');
    return blob;
  } finally {
    await doc.destroy();
  }
}

/** Sidminiatyr för galleriet. Dokumentet ägs av anroparen och lämnas öppet. */
export async function renderPageThumb(doc, pageNum, width = PAGE_THUMB_WIDTH) {
  const page = await doc.getPage(pageNum);
  const canvas = await renderPageToCanvas(page, width);
  return canvas.toDataURL('image/jpeg', PAGE_THUMB_QUALITY);
}

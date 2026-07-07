import { openPdfFromBlob } from './pdfjs.js';

/*
 * Miniatyr av mönstrets första sida — gör biblioteket och projektkorten
 * visuella. Renderas en gång och sparas som JPEG-blob.
 */
const THUMB_WIDTH = 480;
const JPEG_QUALITY = 0.8;

export async function renderPdfThumbnail(pdfBlob) {
  const doc = await openPdfFromBlob(pdfBlob);
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('Kunde inte skapa miniatyren.');
    return blob;
  } finally {
    await doc.destroy();
  }
}

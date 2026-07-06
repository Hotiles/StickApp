import { inspectPdf } from '../pdf/pdfjs.js';
import { renderPdfThumbnail } from '../pdf/thumbnail.js';
import { putBlob, createPattern } from '../storage/storage.js';

/** Validerar och sparar en PDF som mönster. Kastar med svenskt felmeddelande. */
export async function importPdfFile(file, folderId) {
  if (file.type && file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
    throw new Error(`”${file.name}” är inte en PDF.`);
  }
  let pageCount;
  try {
    ({ pageCount } = await inspectPdf(file));
  } catch {
    throw new Error(`”${file.name}” kunde inte läsas som PDF — är filen skadad?`);
  }
  const blobId = await putBlob(file);
  let thumbBlobId = null;
  try {
    thumbBlobId = await putBlob(await renderPdfThumbnail(file));
  } catch {
    /* miniatyren är trevlig-att-ha — importen får inte falla på den */
  }
  const name = (file.name || 'Mönster').replace(/\.pdf$/i, '').trim() || 'Mönster';
  return createPattern({
    name,
    folderId: folderId ?? null,
    fileBlobId: blobId,
    thumbBlobId,
    fileSize: file.size,
    pageCount,
  });
}

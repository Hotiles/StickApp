import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };

/** Öppnar ett pdf.js-dokument från en Blob. Anroparen ansvarar för destroy(). */
export async function openPdfFromBlob(blob) {
  const data = await blob.arrayBuffer();
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
  return task.promise;
}

/** Snabb validering + sidräkning vid import. */
export async function inspectPdf(blob) {
  const doc = await openPdfFromBlob(blob);
  const pageCount = doc.numPages;
  await doc.destroy();
  return { pageCount };
}
